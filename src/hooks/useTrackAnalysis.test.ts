import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareTrack } from '../core/prepareTrack';
import { resetTrackWorker, runInWorker } from '../library/trackWorkerClient';
import { analysisMemoryKey, handleTrackRequest, type TrackRequest, type TrackResponse } from '../library/trackWorkerProtocol';
import { gpxOf, sailRaw, upDownLegs } from '../test/sailing.fixture';
import { directSailing, sailingPageView, sailingRequest } from '../test/trackAnalysis.fixture';
import type { AnalyzeSailingOptions, SailingAnalysisReply } from '../library/analysisStore';
import { retainedWind } from '../sailing/sailingSession';
import type { AnalysisSource } from './useGpxSession';
import { analysisTarget, analysisView, colorKeyOf, createTrackAnalysisRequests, type AnalysisPair } from './useTrackAnalysis';

/**
 * Logique de `useTrackAnalysis`, hors React : ce que la page montre d'une analyse reçue (jamais celle d'un autre
 * fichier, en attente tant qu'elle ne répond pas à la trace et aux entrées demandées), et les demandes au calcul, en
 * ligne comme par un faux calcul en arrière-plan : la dernière gagne, une session changée jette l'ancienne, quitter
 * vide la mémoire.
 */

/** Faux calcul en arrière-plan : répond par le vrai aiguillage, messages clonés ; `hold` garde les demandes jusqu'à `flushHeld`. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static hold = false;
  onmessage: ((event: { data: TrackResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  held: TrackRequest[] = [];
  received: string[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(data: TrackRequest): void {
    const request = structuredClone(data);
    this.received.push(request.kind);
    if (FakeWorker.hold) this.held.push(request);
    else queueMicrotask(() => this.answer(request));
  }

  answer(request: TrackRequest): void {
    this.onmessage?.({ data: structuredClone(handleTrackRequest(request)) });
  }

  flushHeld(): void {
    const held = this.held;
    this.held = [];
    for (const request of held) this.answer(request);
  }

  terminate(): void {}
}

const textA = gpxOf(sailRaw({ windDeg: 20, legs: upDownLegs(2, 60), hz: 5 }));
const textB = gpxOf(sailRaw({ windDeg: 200, legs: upDownLegs(3, 40), hz: 1, seed: 3 }));

/** Trace affichée d'une session, comme `useGpxSession` la donne à l'analyse. */
const sourceOf = (text: string, name: string, key = 'page'): { source: AnalysisSource; base: AnalyzeSailingOptions } => {
  const base = { ...sailingRequest(name, text, 'wingfoil'), key };
  return {
    source: { from: { text, fileName: `${name}.gpx` }, prepared: prepareTrack(text, base.prepare), prepare: base.prepare, key },
    base,
  };
};

/** Demande d'analyse à voile de la page pour une trace et des entrées. */
const sailingCompute = (source: AnalysisSource, options: AnalyzeSailingOptions) => () =>
  runInWorker('analyzeSailing', source.from.text, { ...options, key: source.key, prepare: source.prepare });

afterEach(() => {
  resetTrackWorker();
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
  FakeWorker.hold = false;
});

describe('analysisView : appariement de la trace et de son analyse', () => {
  const a = sourceOf(textA, 'a').source;
  const b = sourceOf(textB, 'b').source;
  const pairOf = (source: AnalysisSource, inputs: string): AnalysisPair<string> => ({ source, inputs, result: inputs });

  it('rien de lu : rien de montré, rien en attente', () => {
    expect(analysisView(pairOf(a, 'x'), null, 'x')).toStrictEqual({ pair: null, reading: false, pending: false });
  });

  it('trace neuve sans sa première analyse : rien de montré, lecture ; l’analyse d’un autre fichier n’est jamais montrée', () => {
    expect(analysisView(null, a, 'x')).toStrictEqual({ pair: null, reading: true, pending: true });
    expect(analysisView(pairOf(a, 'x'), b, 'x')).toStrictEqual({ pair: null, reading: true, pending: true });
  });

  it('autre session demandée par l’adresse, ancienne trace encore affichée : ni analysée ni montrée, lecture', () => {
    const pair = pairOf(a, 'x');
    expect(analysisTarget(a, 'b.gpx')).toBeNull();
    expect(analysisTarget(a, 'a.gpx')).toBe(a);
    expect(analysisTarget(a, null)).toBe(a);
    expect(analysisView(pair, a, 'x', true, 'b.gpx')).toStrictEqual({ pair: null, reading: true, pending: true });
    expect(analysisView(pair, a, 'x', true, 'a.gpx')).toStrictEqual({ pair, reading: false, pending: false });
  });

  it('session demandée dont l’ouverture a échoué, ancienne trace encore affichée : rien de montré, plus de lecture', () => {
    expect(analysisView(pairOf(a, 'x'), a, 'x', true, 'b.gpx', true)).toStrictEqual({ pair: null, reading: false, pending: true });
    // L'échec ne touche pas une trace qui est bien celle demandée.
    const pair = pairOf(a, 'x');
    expect(analysisView(pair, a, 'x', true, 'a.gpx', true)).toStrictEqual({ pair, reading: false, pending: false });
  });

  it('analyse à jour : montrée, sans attente', () => {
    const pair = pairOf(a, 'x');
    expect(analysisView(pair, a, 'x')).toStrictEqual({ pair, reading: false, pending: false });
  });

  it('recalcul en cours (autres entrées, trace relue du même fichier, lecture pas à jour) : les anciens chiffres restent, en attente', () => {
    const pair = pairOf(a, 'x');
    expect(analysisView(pair, a, 'y')).toStrictEqual({ pair, reading: false, pending: true });
    const reread: AnalysisSource = { ...a, prepared: prepareTrack(textA, a.prepare) };
    expect(analysisView(pair, reread, 'x')).toStrictEqual({ pair, reading: false, pending: true });
    expect(analysisView(pair, a, 'x', false)).toStrictEqual({ pair, reading: false, pending: true });
  });
});

describe('vent montré (`retainedWind`) pendant un recalcul', () => {
  const { base } = sourceOf(textA, 'a');
  /** Analyse montrée : celle d'avant le réglage, vent saisi à 20°. */
  const before = directSailing(textA, { ...base, windDeg: 20 }).view.analysis;

  it('vent saisi pendant le recalcul : montré tout de suite, l’analyse montrée n’a pas encore bougé', () => {
    expect(before.currentWindValue).toBe(20);
    expect(retainedWind(200, before.windEstimate)).toBe(200);
    expect(retainedWind(-160, before.windEstimate)).toBe(200);
  });

  it('vent effacé : l’estimation de l’analyse montrée, celle que le recalcul retiendra', () => {
    const after = directSailing(textA, { ...base, windDeg: null }).view.analysis;
    expect(after.currentWindValue).not.toBeNull();
    expect(retainedWind(null, before.windEstimate)).toBe(after.currentWindValue);
  });

  it('sans vent saisi : le vent retenu de l’analyse ; estimation non fiable ou absente, aucun', () => {
    const estimated = directSailing(textA, base).view.analysis;
    expect(retainedWind(null, estimated.windEstimate)).toBe(estimated.currentWindValue);
    expect(retainedWind(null, estimated.windEstimate && { ...estimated.windEstimate, reliable: false })).toBeNull();
    expect(retainedWind(null, null)).toBeNull();
  });
});

describe('colorKeyOf', () => {
  it('bornes ordonnées comme le calcul : session, activité, suggestion, défaut ; sans couleurs, texte vide', () => {
    const color = { sessionRange: null, activityRange: null, fallback: { minMs: 3, maxMs: 12 } };
    expect(colorKeyOf(null, null)).toBe('');
    expect(colorKeyOf(color, { minMs: 4, maxMs: 10 })).toBe(JSON.stringify([4, 10]));
    expect(colorKeyOf({ ...color, sessionRange: { minMs: 5, maxMs: 9 } }, { minMs: 4, maxMs: 10 })).toBe(JSON.stringify([5, 9]));
  });
});

describe.each([
  ['en ligne', false],
  ['par le calcul en arrière-plan', true],
])('demandes d’analyse, %s', (_label, withWorker) => {
  const useWorker = () => vi.stubGlobal('Worker', withWorker ? FakeWorker : undefined);

  it('trois seuils tirés vite : seule la dernière réponse est rendue, aux chiffres du calcul direct', async () => {
    useWorker();
    const { source, base } = sourceOf(textA, 'a');
    const requests = createTrackAnalysisRequests<SailingAnalysisReply>();
    const asked = [6, 9, 12].map((thresholdKn) =>
      requests.request(source, `seuil ${thresholdKn}`, sailingCompute(source, { ...base, thresholdKn })));
    const [first, second, last] = await Promise.all(asked);
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(last?.inputs).toBe('seuil 12');
    expect(last?.source).toBe(source);
    expect(sailingPageView(last!.result)).toStrictEqual(directSailing(textA, { ...base, thresholdKn: 12 }).view);
  });

  it('vent saisi puis effacé : la dernière réponse est celle du vent estimé', async () => {
    useWorker();
    const { source, base } = sourceOf(textA, 'a');
    const requests = createTrackAnalysisRequests<SailingAnalysisReply>();
    const typed = await requests.request(source, 'vent 200', sailingCompute(source, { ...base, windDeg: 200 }));
    expect(sailingPageView(typed!.result)).toStrictEqual(directSailing(textA, { ...base, windDeg: 200 }).view);
    const quick = requests.request(source, 'vent 210', sailingCompute(source, { ...base, windDeg: 210 }));
    const erased = await requests.request(source, 'vent estimé', sailingCompute(source, { ...base, windDeg: null }));
    expect(await quick).toBeNull();
    expect(sailingPageView(erased!.result)).toStrictEqual(directSailing(textA, base).view);
  });
});

describe('demandes d’analyse : session changée, page quittée', () => {
  it('session changée pendant un calcul : le résultat de l’ancienne est jeté, la nouvelle a ses chiffres et sa trace', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.hold = true;
    const a = sourceOf(textA, 'a');
    const b = sourceOf(textB, 'b');
    const requests = createTrackAnalysisRequests<SailingAnalysisReply>();
    const oldOne = requests.request(a.source, 'a', sailingCompute(a.source, a.base));
    const newOne = requests.request(b.source, 'b', sailingCompute(b.source, b.base));
    const worker = FakeWorker.instances[0];
    expect(worker.received).toEqual(['analyzeSailing']);
    FakeWorker.hold = false;
    worker.flushHeld();
    expect(await oldOne).toBeNull();
    const reply = await newOne;
    expect(reply?.source).toBe(b.source);
    expect(sailingPageView(reply!.result)).toStrictEqual(directSailing(textB, b.base).view);
  });

  it('page quittée : la demande en attente est abandonnée, la mémoire du calcul vidée', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { source, base } = sourceOf(textA, 'a', 'quittée');
    const requests = createTrackAnalysisRequests<SailingAnalysisReply>();
    await requests.request(source, 'x', sailingCompute(source, base));
    FakeWorker.hold = true;
    const inFlight = requests.request(source, 'y', sailingCompute(source, { ...base, thresholdKn: 7 }));
    const waiting = requests.request(source, 'z', sailingCompute(source, { ...base, thresholdKn: 8 }));
    const left = requests.leave('quittée');
    const worker = FakeWorker.instances[0];
    FakeWorker.hold = false;
    worker.flushHeld();
    await left;
    expect(await inFlight).toBeNull();
    expect(await waiting).toBeNull();
    expect(worker.received).toEqual(['analyzeSailing', 'analyzeSailing', 'release']);
  });

  it('page quittée, en ligne : la mémoire du fil de l’affichage est vidée', async () => {
    vi.stubGlobal('Worker', undefined);
    const { source, base } = sourceOf(textA, 'a', 'en ligne');
    const requests = createTrackAnalysisRequests<SailingAnalysisReply>();
    await requests.request(source, 'x', sailingCompute(source, base));
    expect(analysisMemoryKey()).toBe('en ligne');
    await requests.leave('en ligne');
    expect(analysisMemoryKey()).toBeNull();
  });
});
