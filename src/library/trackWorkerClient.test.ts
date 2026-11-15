import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../core/i18n';
import { kinematicsProfileOf, prepareTrack } from '../core/prepareTrack';
import { getSportProfile } from '../core/sportProfiles';
import { sessionRecord } from '../test/record.fixture';
import { gpxOf, sailRaw, upDownLegs } from '../test/sailing.fixture';
import { SURF_TWO_WAVES, surfRaw } from '../test/surf.fixture';
import { directSailing, directSurf, numberMismatches, sailingPageView, sailingRequest, surfRequest } from '../test/trackAnalysis.fixture';
import { sessionColorTrack } from './sessionTrack';
import { summarizeGpx, summarizeGpxOptions } from './summarizeGpx';
import { TRACK_QUEUE, resetTrackWorker, runInWorker } from './trackWorkerClient';
import { analysisMemoryKey, handleTrackRequest, type TrackRequest, type TrackResponse } from './trackWorkerProtocol';

/**
 * Client du worker des traces, sous node par un faux worker : il répond par le vrai aiguillage
 * (`handleTrackRequest`), messages passés par un clonage structuré à l'aller et au retour, comme un vrai. Un seul
 * worker pour plusieurs demandes, réponses rendues par leur identifiant, worker mort ou refusé : calcul en ligne,
 * mêmes chiffres, mêmes erreurs.
 */

/** Faux worker : répond au tour suivant, sauf `hold`, où il garde les demandes jusqu'à `release`. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static hold = false;
  onmessage: ((event: { data: TrackResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  held: TrackRequest[] = [];
  /** Genre de chaque demande reçue, dans l'ordre. */
  received: string[] = [];
  readonly url: string;
  readonly options: unknown;

  constructor(url: URL, options: unknown) {
    this.url = String(url);
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(data: TrackRequest): void {
    const request = structuredClone(data);
    this.received.push(request.kind);
    if (FakeWorker.hold) this.held.push(request);
    else queueMicrotask(() => this.answer(request));
  }

  answer(request: TrackRequest): void {
    if (!this.terminated) this.onmessage?.({ data: structuredClone(handleTrackRequest(request)) });
  }

  /** Rend les demandes gardées, dans l'ordre donné. */
  release(order: 'reverse' | 'same' = 'same'): void {
    const held = order === 'reverse' ? [...this.held].reverse() : [...this.held];
    this.held = [];
    for (const request of held) this.answer(request);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const wing = kinematicsProfileOf(getSportProfile('wingfoil'));
const textA = gpxOf(sailRaw({ windDeg: 20, legs: upDownLegs(2, 60), hz: 5 }));
const textB = gpxOf(sailRaw({ windDeg: 200, legs: upDownLegs(3, 40), hz: 1, seed: 3 }));
const BAD = '<gpx><trk>';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** Erreur levée par un appel, ou `null`. */
const thrown = async (run: () => Promise<unknown>): Promise<Error | null> => {
  try {
    await run();
    return null;
  } catch (err) {
    return err as Error;
  }
};

afterEach(() => {
  resetTrackWorker();
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
  FakeWorker.hold = false;
});

describe('runInWorker', () => {
  it('sans Worker : en ligne, le résultat de prepareTrack', async () => {
    vi.stubGlobal('Worker', undefined);
    expect(await runInWorker('prepare', textA, { profile: wing, fileName: 'a.gpx' })).toStrictEqual(prepareTrack(textA, { profile: wing, fileName: 'a.gpx' }));
  });

  it('un worker par file, le même script, créé à sa première demande ; mêmes résultats qu’en ligne', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const record = sessionRecord({ sport: 'wingfoil' });
    const options = summarizeGpxOptions(record, () => ({ thresholdOverride: 8, foil: true }));
    const a = runInWorker('prepare', textA, { profile: wing });
    const b = runInWorker('prepare', textB, {});
    // Deux analyses : un seul worker, celui de la file « analyse » ; celui du fond n'existe pas encore.
    expect(FakeWorker.instances).toHaveLength(1);
    const summary = runInWorker('summarize', textA, options);
    expect(FakeWorker.instances).toHaveLength(2);
    await Promise.all([a, b, summary]);
    await runInWorker('colorTrack', textB, { sport: 'kite', referenceOverrideMs: null, family: 'voile' });
    await runInWorker('prepare', textB, {});
    expect(FakeWorker.instances).toHaveLength(2);
    for (const instance of FakeWorker.instances) {
      expect(instance.url).toMatch(/trackWorker\.ts/);
      expect(instance.options).toEqual({ type: 'module' });
    }
    expect(TRACK_QUEUE).toEqual({
      prepare: 'analyse', analyzeSailing: 'analyse', analyzeSurf: 'analyse', release: 'analyse', summarize: 'fond', colorTrack: 'fond',
    });
    expect(await a).toStrictEqual(prepareTrack(textA, { profile: wing }));
    expect(await b).toStrictEqual(prepareTrack(textB, {}));
    expect(await summary).toStrictEqual(summarizeGpx(textA, options));
  });

  it('une analyse demandée derrière des vignettes en attente reçoit sa réponse sans attendre les leurs', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const color = { sport: 'wingfoil', referenceOverrideMs: null, family: 'voile' } as const;
    // Le worker du fond garde ses demandes : des vignettes longues encore en calcul.
    FakeWorker.hold = true;
    const thumbnails = [textA, textB, textA, textB].map((gpx) => runInWorker('colorTrack', gpx, color));
    const background = FakeWorker.instances[0];
    FakeWorker.hold = false;
    let done = false;
    const prepared = runInWorker('prepare', textA, { profile: wing }).then((p) => { done = true; return p; });
    await flush();
    expect(done).toBe(true);
    expect(await prepared).toStrictEqual(prepareTrack(textA, { profile: wing }));
    expect(background.held).toHaveLength(4);
    background.release();
    expect(await Promise.all(thumbnails)).toStrictEqual([textA, textB, textA, textB].map((gpx) => sessionColorTrack(gpx, color.sport, null, color.family)));
  });

  it('la panne du worker d’une file ne touche pas l’autre', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    await runInWorker('prepare', textB, {});
    const analysis = FakeWorker.instances[0];
    FakeWorker.hold = true;
    const sumOptions = summarizeGpxOptions(sessionRecord({ sport: 'wingfoil' }), () => ({ thresholdOverride: 8, foil: true }));
    const waiting = runInWorker('summarize', textA, sumOptions);
    const background = FakeWorker.instances[1];
    // Mort avant toute réponse : le fond passe en ligne, sa demande refaite.
    background.onerror?.();
    expect(background.terminated).toBe(true);
    expect(await waiting).toStrictEqual(summarizeGpx(textA, sumOptions));
    FakeWorker.hold = false;
    expect(analysis.terminated).toBe(false);
    expect(await runInWorker('prepare', textA, {})).toStrictEqual(prepareTrack(textA));
    expect(await runInWorker('summarize', textB, sumOptions)).toStrictEqual(summarizeGpx(textB, sumOptions));
    // Ni l'analyse recréée, ni le fond retenté.
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('réponses dans le désordre : chacune rendue à sa demande', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.hold = true;
    const a = runInWorker('prepare', textA, {});
    const b = runInWorker('prepare', textB, {});
    FakeWorker.instances[0].release('reverse');
    expect(await a).toStrictEqual(prepareTrack(textA));
    expect(await b).toStrictEqual(prepareTrack(textB));
  });

  it('erreur du calcul : même nom et même message qu’en ligne', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const viaWorker = await thrown(() => runInWorker('prepare', BAD, {}));
    vi.stubGlobal('Worker', undefined);
    resetTrackWorker();
    const inline = await thrown(() => runInWorker('prepare', BAD, {}));
    expect(viaWorker).toBeInstanceOf(Error);
    expect(viaWorker?.message).toBe(inline?.message);
    expect(viaWorker?.name).toBe(inline?.name);
    expect(inline?.message).toMatch(/illisible/);
  });

  it('erreur de lecture rendue dans la langue de l’interface, par le worker comme en ligne', async () => {
    // Le calcul a été chargé en français, comme le worker, qui n'a jamais de dictionnaire.
    setLanguage('en', { 'Fichier GPX illisible : le XML est mal formé.': 'Unreadable GPX file: malformed XML.' });
    try {
      vi.stubGlobal('Worker', FakeWorker);
      const viaWorker = await thrown(() => runInWorker('prepare', BAD, {}));
      vi.stubGlobal('Worker', undefined);
      resetTrackWorker();
      const inline = await thrown(() => runInWorker('prepare', BAD, {}));
      expect(viaWorker?.message).toBe('Unreadable GPX file: malformed XML.');
      expect(inline?.message).toBe('Unreadable GPX file: malformed XML.');
      expect(viaWorker?.name).toBe('Error');
    } finally {
      setLanguage('fr', {});
    }
    const french = await thrown(() => runInWorker('prepare', BAD, {}));
    expect(french?.message).toBe('Fichier GPX illisible : le XML est mal formé.');
  });

  it('worker mort après avoir répondu : demandes en cours refaites en ligne, le suivant est recréé', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    await runInWorker('prepare', textB, {});
    FakeWorker.hold = true;
    const waiting = runInWorker('prepare', textA, { profile: wing });
    FakeWorker.instances[0].onerror?.();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(await waiting).toStrictEqual(prepareTrack(textA, { profile: wing }));
    FakeWorker.hold = false;
    expect(await runInWorker('prepare', textB, {})).toStrictEqual(prepareTrack(textB));
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('worker mort avant toute réponse : en ligne jusqu’au rechargement', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.hold = true;
    const waiting = runInWorker('prepare', textB, {});
    FakeWorker.instances[0].onmessageerror?.();
    expect(await waiting).toStrictEqual(prepareTrack(textB));
    FakeWorker.hold = false;
    expect(await runInWorker('prepare', textA, {})).toStrictEqual(prepareTrack(textA));
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('création qui lève : en ligne, sans retenter', async () => {
    let attempts = 0;
    vi.stubGlobal('Worker', class {
      constructor() {
        attempts += 1;
        throw new Error('refusé');
      }
    });
    expect(await runInWorker('prepare', textB, {})).toStrictEqual(prepareTrack(textB));
    expect(await runInWorker('prepare', textB, {})).toStrictEqual(prepareTrack(textB));
    expect(attempts).toBe(1);
  });

  it('trace colorée d’une vignette : par le worker comme en ligne, le résultat de sessionColorTrack', async () => {
    const cases = [
      { gpx: textA, options: { sport: 'wingfoil', referenceOverrideMs: null, family: 'voile' } },
      { gpx: textB, options: { sport: 'kite', referenceOverrideMs: 6.5, family: 'voile' } },
      { gpx: textB, options: { sport: null, referenceOverrideMs: null, family: 'surf' } },
    ] as const;
    vi.stubGlobal('Worker', FakeWorker);
    const viaWorker = await Promise.all(cases.map(({ gpx, options }) => runInWorker('colorTrack', gpx, { ...options })));
    expect(FakeWorker.instances).toHaveLength(1);
    vi.stubGlobal('Worker', undefined);
    resetTrackWorker();
    const inline = await Promise.all(cases.map(({ gpx, options }) => runInWorker('colorTrack', gpx, { ...options })));
    cases.forEach(({ gpx, options }, i) => {
      const expected = sessionColorTrack(gpx, options.sport, options.referenceOverrideMs, options.family);
      expect(expected?.points.length).toBeGreaterThan(100);
      expect(viaWorker[i]).toStrictEqual(expected);
      expect(inline[i]).toStrictEqual(expected);
    });
    expect(viaWorker[0]?.suggested).not.toBeNull();
  });

  it('trace colorée : moins de deux points, `null` ; XML illisible, la même erreur traduite, par les deux chemins', async () => {
    const options = { sport: 'surf', referenceOverrideMs: null, family: 'surf' } as const;
    const onePoint = gpxOf(sailRaw({ windDeg: 0, legs: upDownLegs(1, 60), hz: 1 }).slice(0, 1));
    setLanguage('en', { 'Fichier GPX illisible : le XML est mal formé.': 'Unreadable GPX file: malformed XML.' });
    try {
      vi.stubGlobal('Worker', FakeWorker);
      expect(await runInWorker('colorTrack', onePoint, options)).toBeNull();
      const viaWorker = await thrown(() => runInWorker('colorTrack', BAD, options));
      vi.stubGlobal('Worker', undefined);
      resetTrackWorker();
      expect(await runInWorker('colorTrack', onePoint, options)).toBeNull();
      const inline = await thrown(() => runInWorker('colorTrack', BAD, options));
      expect(viaWorker?.message).toBe('Unreadable GPX file: malformed XML.');
      expect(inline?.message).toBe('Unreadable GPX file: malformed XML.');
    } finally {
      setLanguage('fr', {});
    }
  });

  it('analyses voile et surf : par le worker, trace gardée par prepare ou relue, puis en ligne, ce que la page calcule', async () => {
    const sail = sailingRequest('a', textA, 'wingfoil', { windDeg: 30 });
    const surf = surfRequest('s', 'surf');
    const surfText = gpxOf(surfRaw(SURF_TWO_WAVES, 5));
    const expectedSail = directSailing(textA, sail).view;
    const expectedSurf = directSurf(surfText, surf);
    const same = (actual: unknown, expected: unknown) => {
      expect(actual).toStrictEqual(expected);
      expect(numberMismatches(actual, expected)).toEqual([]);
    };
    vi.stubGlobal('Worker', FakeWorker);
    expect(await runInWorker('prepare', textA, { ...sail.prepare, analysisKey: 'a' })).toStrictEqual(prepareTrack(textA, sail.prepare));
    same(sailingPageView(await runInWorker('analyzeSailing', textA, sail)), expectedSail);
    // Mémoire relâchée, puis une autre clé : la trace est relue, même résultat.
    expect(await runInWorker('release', '', { key: 'a' })).toBeNull();
    same(sailingPageView(await runInWorker('analyzeSailing', textA, sail)), expectedSail);
    same(await runInWorker('analyzeSurf', surfText, surf), expectedSurf);
    const calm = { ...sail, windDeg: null };
    same(sailingPageView(await runInWorker('analyzeSailing', textA, calm)), directSailing(textA, calm).view);
    // Tout dans la file « analyse » : un seul worker.
    expect(FakeWorker.instances).toHaveLength(1);
    vi.stubGlobal('Worker', undefined);
    resetTrackWorker();
    await runInWorker('prepare', textA, { ...sail.prepare, analysisKey: 'a' });
    same(sailingPageView(await runInWorker('analyzeSailing', textA, sail)), expectedSail);
    same(await runInWorker('analyzeSurf', surfText, surf), expectedSurf);
  });

  it('release ne crée jamais de worker : sans worker vivant, il vide la mémoire en ligne', async () => {
    const sail = sailingRequest('a', textA, 'wingfoil');
    vi.stubGlobal('Worker', undefined);
    await runInWorker('prepare', textA, { ...sail.prepare, analysisKey: 'a' });
    expect(analysisMemoryKey()).toBe('a');
    vi.stubGlobal('Worker', FakeWorker);
    resetTrackWorker();
    // Une autre clé ne vide rien ; la bonne vide la mémoire en ligne, sans worker créé.
    expect(await runInWorker('release', '', { key: 'b' })).toBeNull();
    expect(analysisMemoryKey()).toBe('a');
    expect(await runInWorker('release', '', { key: 'a' })).toBeNull();
    expect(analysisMemoryKey()).toBeNull();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('release avec un worker vivant : vidé des deux côtés, la trace gardée en ligne par un prepare refait comprise', async () => {
    const sail = sailingRequest('a', textA, 'wingfoil');
    vi.stubGlobal('Worker', FakeWorker);
    await runInWorker('prepare', textB, {});
    const worker = FakeWorker.instances[0];
    // Un prepare dont la réponse n'arrive pas, worker mort : refait en ligne, la trace gardée sur le fil de l'affichage.
    FakeWorker.hold = true;
    const prepared = runInWorker('prepare', textA, { ...sail.prepare, analysisKey: 'a' });
    worker.onerror?.();
    await prepared;
    expect(analysisMemoryKey()).toBe('a');
    FakeWorker.hold = false;
    // Un worker recréé par une autre demande, puis la page quittée.
    await runInWorker('prepare', textB, {});
    const alive = FakeWorker.instances[1];
    alive.received = [];
    expect(await runInWorker('release', '', { key: 'a' })).toBeNull();
    expect(analysisMemoryKey()).toBeNull();
    expect(alive.received).toEqual(['release']);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('worker mort pendant une analyse : refaite en ligne, même résultat', async () => {
    const sail = sailingRequest('b', textB, 'kite', { windDeg: 210 });
    vi.stubGlobal('Worker', FakeWorker);
    await runInWorker('prepare', textB, { ...sail.prepare, analysisKey: 'b' });
    FakeWorker.hold = true;
    const waiting = runInWorker('analyzeSailing', textB, sail);
    FakeWorker.instances[0].onerror?.();
    expect(sailingPageView(await waiting)).toStrictEqual(directSailing(textB, sail).view);
  });

  it('une réponse d’un worker déjà remplacé n’est rendue à personne', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.hold = true;
    const waiting = runInWorker('prepare', textB, {});
    const first = FakeWorker.instances[0];
    resetTrackWorker();
    // Refaite en ligne par l'oubli du worker ; sa réponse tardive ne change rien.
    first.terminated = false;
    first.release();
    await flush();
    expect(await waiting).toStrictEqual(prepareTrack(textB));
  });
});
