import { describe, expect, it } from 'vitest';
import { setLanguage } from '../core/i18n';
import { prepareTrack } from '../core/prepareTrack';
import { SPORT_PROFILES, getSportProfile, sportFamily, type SportProfile } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import { knotsToMs } from '../core/units';
import { withWindAt } from '../sailing/sailingAnalytics';
import { gpxOf, sailRaw, upDownLegs } from '../test/sailing.fixture';
import { SURF_FOIL_FLIGHTS, SURF_TWO_WAVES, surfRaw } from '../test/surf.fixture';
import {
  colorOptionsOf, directSailing, directSurf, englishDictionary, functionPaths, numberMismatches, prepareOptionsOf, sailingPageView,
  sailingRequest, surfRequest,
} from '../test/trackAnalysis.fixture';
import { createAnalysisStore, type AnalyzeSailingOptions, type SailingAnalysisReply } from './analysisStore';

/**
 * Mémoire de l'analyse ouverte : la tâche rend, après un clonage structuré comme celui d'un message, exactement ce que
 * la page calcule aujourd'hui sur le fil de l'affichage (mêmes nombres au sens d'`Object.is`), à 1 Hz et à 5 Hz ; elle
 * ne refait que ce dont les entrées ont changé.
 */

const sailText = (hz: number) => gpxOf(sailRaw({ windDeg: 20, legs: upDownLegs(6, 60), hz }));
const SAIL = { 1: sailText(1), 5: sailText(5) } as const;
const surfText = (phases: [number, number][], hz: number) => gpxOf(surfRaw(phases, hz));
const SURF = { 1: surfText(SURF_TWO_WAVES, 1), 5: surfText(SURF_TWO_WAVES, 5) } as const;
const FOIL = { 1: surfText(SURF_FOIL_FLIGHTS, 1), 5: surfText(SURF_FOIL_FLIGHTS, 5) } as const;

const SAILING_SPORTS = (Object.keys(SPORT_PROFILES) as SportType[]).filter((s) => sportFamily(s) === 'voile');
const SURF_SPORTS = (Object.keys(SPORT_PROFILES) as SportType[]).filter((s) => sportFamily(s) === 'surf');

/** La valeur passée par un clonage structuré, comme par `postMessage`. */
const cloned = <T>(value: T): T => structuredClone(value);

/** Même valeur, au sens de `toStrictEqual` et nombre par nombre au sens d'`Object.is`. */
const expectSame = (actual: unknown, expected: unknown): void => {
  expect(actual).toStrictEqual(expected);
  expect(numberMismatches(actual, expected)).toEqual([]);
};

/** Une réponse d'analyse à voile, passée par un clonage puis rebâtie comme la page la lira, vaut ce que la page calcule aujourd'hui. */
const sameAsPage = (reply: SailingAnalysisReply, gpxText: string, request: AnalyzeSailingOptions): void => {
  const passed = cloned(reply);
  expect(functionPaths(passed)).toEqual([]);
  expectSame(sailingPageView(passed), directSailing(gpxText, request).view);
};

/** Toutes les chaînes d'une valeur. */
const stringsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  return Object.values(value).flatMap(stringsOf);
};

describe('analyse à voile : la tâche rend ce que la page calcule', () => {
  for (const hz of [1, 5] as const) {
    it(`${hz} Hz : chaque calcul de voile, vent estimé puis saisi, seuil de la page puis relevé`, () => {
      for (const sport of SAILING_SPORTS) {
        const store = createAnalysisStore();
        const cases = [
          sailingRequest('a', SAIL[hz], sport),
          sailingRequest('a', SAIL[hz], sport, { windDeg: 35 }),
          sailingRequest('a', SAIL[hz], sport, { windDeg: 35, thresholdKn: 14 }),
          sailingRequest('a', SAIL[hz], sport, { windDeg: null, thresholdKn: 14, color: colorOptionsOf(sport, { sessionRange: { minMs: 2, maxMs: 9 } }) }),
        ];
        for (const request of cases) {
          const reply = cloned(store.analyzeSailing(SAIL[hz], cloned(request)));
          expect(functionPaths(reply)).toEqual([]);
          sameAsPage(reply, SAIL[hz], request);
        }
      }
    });

    it(`${hz} Hz : le vent rebâti par withWindAt vaut celui de la page à cent instants`, () => {
      const request = sailingRequest('a', SAIL[hz], 'wingfoil');
      const direct = directSailing(SAIL[hz], request);
      const reply = cloned(createAnalysisStore().analyzeSailing(SAIL[hz], request));
      expect(direct.windAt).not.toBeNull();
      expect(reply.analysis.windStats).not.toBeNull();
      const rebuilt = withWindAt(reply.analysis.windStats!);
      const startMs = direct.track[0].timeMs;
      const spanMs = direct.track[direct.track.length - 1].timeMs - startMs;
      // Cent instants sur la trace et un peu au-delà, pour passer aussi par les trous et les bords.
      for (let k = 0; k < 100; k++) {
        const timeMs = startMs - 60_000 + ((spanMs + 120_000) * k) / 99;
        expect(Object.is(rebuilt.windAt(timeMs), direct.windAt!(timeMs))).toBe(true);
      }
      expect(reply.analysis.maneuverStats?.locations.length).toBeGreaterThan(2);
    });
  }

  it('trace d’un seul point : mêmes chiffres que la page', () => {
    const one = gpxOf(sailRaw({ windDeg: 0, legs: upDownLegs(1, 60), hz: 1 }).slice(0, 1));
    const request = sailingRequest('un', one, 'wingfoil', { thresholdKn: 10 });
    sameAsPage(createAnalysisStore().analyzeSailing(one, request), one, request);
  });

  it('XML illisible : la même erreur que la lecture', () => {
    const bad = '<gpx><trk>';
    const request = sailingRequest('x', SAIL[1], 'wingfoil', { thresholdKn: 10 });
    expect(() => createAnalysisStore().analyzeSailing(bad, request)).toThrow(/illisible/);
  });
});

describe('analyse de surf : la tâche rend ce que la page calcule', () => {
  for (const hz of [1, 5] as const) {
    it(`${hz} Hz : chaque calcul de surf, sans foil puis sur foil, seuil de vague imposé`, () => {
      for (const sport of SURF_SPORTS) {
        const store = createAnalysisStore();
        const cases: [string, ReturnType<typeof surfRequest>][] = [
          [SURF[hz], surfRequest('s', sport)],
          [SURF[hz], surfRequest('s', sport, { settings: { threshold: 9, foil: false, waveThreshold: null } })],
          [FOIL[hz], surfRequest('f', sport, { settings: { threshold: 12, foil: true, waveThreshold: null } })],
          [FOIL[hz], surfRequest('f', sport, { settings: { threshold: 12, foil: true, waveThreshold: 18 }, color: null })],
        ];
        for (const [text, request] of cases) {
          const reply = cloned(store.analyzeSurf(text, cloned(request)));
          expect(functionPaths(reply)).toEqual([]);
          expectSame(reply, directSurf(text, request));
        }
      }
      const reply = createAnalysisStore().analyzeSurf(SURF[hz], surfRequest('s', 'surf'));
      expect(reply.analysis?.summary.waveCount).toBe(2);
      expect(reply.segments.length).toBeGreaterThan(100);
    });
  }

  it('un calcul de voile envoyé à l’analyse de surf : pas d’analyse, les couleurs quand même, comme la page', () => {
    const request = { ...surfRequest('s', 'surf'), profile: getSportProfile('wingfoil') };
    const reply = cloned(createAnalysisStore().analyzeSurf(SURF[1], request));
    expect(reply.analysis).toBeNull();
    expectSame(reply, directSurf(SURF[1], request));
  });
});

describe('rien de ce qui revient du calcul ne dépend de la langue', () => {
  // Le calcul en arrière-plan n'a pas la langue de l'interface : il écrit toujours en français, sans dictionnaire.
  const english = englishDictionary();

  /** Exécute `run` sous une langue posée, puis repose le français. */
  const inLanguage = <T>(lang: 'fr' | 'en', run: () => T): T => {
    setLanguage(lang, lang === 'en' ? english : {});
    try {
      return run();
    } finally {
      setLanguage('fr', {});
    }
  };

  for (const hz of [1, 5] as const) {
    it(`${hz} Hz, voile : tâche en français, page en anglais, mêmes valeurs que la page en anglais aujourd’hui`, () => {
      const request = sailingRequest('a', SAIL[hz], 'wingfoil');
      const reference = inLanguage('en', () => directSailing(SAIL[hz], request).view);
      const inFrench = cloned(inLanguage('fr', () => createAnalysisStore().analyzeSailing(SAIL[hz], request)));
      const inEnglish = cloned(inLanguage('en', () => createAnalysisStore().analyzeSailing(SAIL[hz], request)));
      expectSame(inFrench, inEnglish);
      expectSame(inLanguage('en', () => sailingPageView(inFrench)), reference);
      // La référence est bien écrite en anglais : la relance moyenne a son point décimal.
      const relaunch = [reference.analysis.maneuverSummary.tack, reference.analysis.maneuverSummary.jibe]
        .map((s) => s?.averages.relaunch).find((v) => v !== undefined && v !== '-');
      expect(relaunch).toMatch(/^\d+\.\d s$/);
      // Et aucune chaîne du résultat n'écrit un nombre à la française.
      expect(stringsOf(inFrench).filter((s) => /\d,\d/.test(s))).toEqual([]);
    });

    it(`${hz} Hz, surf : même réponse quelle que soit la langue posée`, () => {
      const request = surfRequest('s', 'surf');
      const inFrench = cloned(inLanguage('fr', () => createAnalysisStore().analyzeSurf(SURF[hz], request)));
      const inEnglish = cloned(inLanguage('en', () => createAnalysisStore().analyzeSurf(SURF[hz], request)));
      expectSame(inFrench, inEnglish);
      expect(stringsOf(inFrench).filter((s) => /\d,\d/.test(s))).toEqual([]);
    });
  }
});

describe('ce qui traverse un message', () => {
  it('chaque profil de SPORT_PROFILES se clone à l’identique', () => {
    for (const profile of Object.values(SPORT_PROFILES) as SportProfile[]) {
      expect(functionPaths(profile)).toEqual([]);
      expectSame(structuredClone(profile), profile);
    }
  });

  it('chaque demande que la page enverra se clone à l’identique', () => {
    const requests = [
      ...SAILING_SPORTS.map((sport) => sailingRequest('a', SAIL[1], sport, { thresholdKn: 12, windDeg: 40 })),
      ...SAILING_SPORTS.map((sport) => sailingRequest('a', SAIL[1], sport, {
        thresholdKn: 0, prepare: prepareOptionsOf(getSportProfile(sport), null, knotsToMs(9)),
        color: colorOptionsOf(sport, { activityRange: { minMs: 1, maxMs: 12 } }),
      })),
      ...SURF_SPORTS.map((sport) => surfRequest('s', sport, { settings: { threshold: 10, foil: true, waveThreshold: 16 } })),
    ];
    for (const request of requests) {
      expect(functionPaths(request)).toEqual([]);
      expectSame(structuredClone(request), request);
    }
  });
});

describe('mémoire : ne refait que ce qui a changé', () => {
  const text = SAIL[1];

  it('un vent seul changé ne refait ni la préparation ni le calcul au seuil ; un seuil changé ne refait pas la préparation', () => {
    const store = createAnalysisStore();
    const base = sailingRequest('a', text, 'wingfoil');
    store.analyzeSailing(text, base);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 1, atThreshold: 1, wind: 1, surf: 0, colors: 1 });
    const windy = { ...base, windDeg: 50 };
    sameAsPage(store.analyzeSailing(text, windy), text, windy);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 1, atThreshold: 1, wind: 2, surf: 0, colors: 1 });
    const higher = { ...windy, thresholdKn: base.thresholdKn + 3 };
    sameAsPage(store.analyzeSailing(text, higher), text, higher);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 1, atThreshold: 2, wind: 3, surf: 0, colors: 1 });
    // La même demande : rien n'est refait.
    store.analyzeSailing(text, higher);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 1, atThreshold: 2, wind: 3, surf: 0, colors: 1 });
    // Les couleurs seules : ni les manœuvres ni le seuil.
    const recolored = { ...higher, color: colorOptionsOf('wingfoil', { sessionRange: { minMs: 3, maxMs: 11 } }) };
    sameAsPage(store.analyzeSailing(text, recolored), text, recolored);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 1, atThreshold: 2, wind: 3, surf: 0, colors: 2 });
    // Un autre calcul refait la préparation voile, pas la lecture de la trace.
    const kite = { ...recolored, sport: 'kite' as const, profile: getSportProfile('kite') };
    sameAsPage(store.analyzeSailing(text, kite), text, kite);
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 2, atThreshold: 3, wind: 4, surf: 0, colors: 2 });
  });

  it('une autre allure relit la trace ; une trace gardée par prepare n’est pas relue', () => {
    const store = createAnalysisStore();
    const base = sailingRequest('a', text, 'wingfoil');
    store.keepTrack('a', text, base.prepare, prepareTrack(text, base.prepare));
    store.analyzeSailing(text, base);
    expect(store.work.prepareTrack).toBe(0);
    const imposed = { ...base, prepare: prepareOptionsOf(getSportProfile('wingfoil'), 'a.gpx', knotsToMs(10)) };
    sameAsPage(store.analyzeSailing(text, imposed), text, imposed);
    expect(store.work).toMatchObject({ prepareTrack: 1, prepareSailing: 2 });
    // Mêmes options, objet bâti dans un autre ordre : la trace n'est pas relue.
    const reordered = { ...imposed, prepare: { referenceSpeedOverrideMs: knotsToMs(10), profile: imposed.prepare.profile, fileName: 'a.gpx' } };
    store.analyzeSailing(text, reordered);
    expect(store.work.prepareTrack).toBe(1);
  });

  it('clé absente : la trace est relue, même résultat qu’avec la trace gardée', () => {
    const request = sailingRequest('a', text, 'wingfoil', { windDeg: 25 });
    const kept = createAnalysisStore();
    kept.keepTrack('a', text, request.prepare, prepareTrack(text, request.prepare));
    const fresh = createAnalysisStore();
    expectSame(cloned(fresh.analyzeSailing(text, request)), cloned(kept.analyzeSailing(text, request)));
    expect(fresh.work.prepareTrack).toBe(1);
    expect(kept.work.prepareTrack).toBe(0);
  });

  it('release vide la mémoire de sa clé seulement ; une autre session remplace la première', () => {
    const store = createAnalysisStore();
    const a = sailingRequest('a', text, 'wingfoil');
    store.analyzeSailing(text, a);
    store.release('b');
    expect(store.key).toBe('a');
    store.release('a');
    expect(store.key).toBeNull();
    store.analyzeSailing(text, a);
    expect(store.work.prepareTrack).toBe(2);
    const b = sailingRequest('b', SAIL[5], 'wingfoil');
    sameAsPage(store.analyzeSailing(SAIL[5], b), SAIL[5], b);
    expect(store.key).toBe('b');
    store.analyzeSailing(text, a);
    expect(store.work.prepareTrack).toBe(4);
    // Même clé, autre texte : la trace est relue, jamais l'analyse d'une session sur la trace d'une autre.
    sameAsPage(store.analyzeSailing(SAIL[5], { ...a, thresholdKn: b.thresholdKn }), SAIL[5], { ...a, thresholdKn: b.thresholdKn });
    expect(store.work.prepareTrack).toBe(5);
  });

  it('surf : un seuil changé refait l’analyse, les couleurs seules non', () => {
    const store = createAnalysisStore();
    const base = surfRequest('s', 'surf');
    store.analyzeSurf(SURF[1], base);
    store.analyzeSurf(SURF[1], cloned(base));
    expect(store.work).toEqual({ prepareTrack: 1, prepareSailing: 0, atThreshold: 0, wind: 0, surf: 1, colors: 1 });
    const recolored = { ...base, color: colorOptionsOf('surf', { activityRange: { minMs: 1, maxMs: 6 } }) };
    expectSame(store.analyzeSurf(SURF[1], recolored), directSurf(SURF[1], recolored));
    expect(store.work).toMatchObject({ surf: 1, colors: 2 });
    const lower = { ...recolored, settings: { ...recolored.settings, threshold: 6 } };
    expectSame(store.analyzeSurf(SURF[1], lower), directSurf(SURF[1], lower));
    expect(store.work).toMatchObject({ prepareTrack: 1, surf: 2, colors: 2 });
  });
});
