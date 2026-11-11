import { describe, expect, it } from 'vitest';
import { computeKinematics, detectTrackDeviceSpeedUnit } from '../core/kinematics';
import { kinematicsOptionsOf, referenceSpeedMs, scalesFiltersToSession } from '../core/sessionSpeed';
import { buildCumulativeTrack, computeActiveDistanceM, computeActiveTimeMs, thresholdActivityMask } from '../core/sessionStats';
import { bestWindowSpeedMs } from '../core/topSegments';
import { FAMILY_BASE } from '../core/activities';
import { defaultActiveThresholdOf, getSportProfile } from '../core/sportProfiles';
import type { RawTrackPoint } from '../core/types';
import { msToKnots } from '../core/units';
import { suggestActiveThresholdKn } from '../sailing/sailingConfig';
import { runSurfSession, surfProfileOf } from '../surfing/surfSession';
import { SUMMARY_CALC_VERSION } from './record';
import { ORIGIN, at, mPerDegLon } from '../test/geo.fixture';
import { phasesTrack } from '../test/track.fixture';
import { analysisTrack, summarizeSession } from './summary';

const START_MS = Date.parse('2026-09-20T10:00:00Z');

/**
 * Trace vers l'est, `hz` points par seconde, à la vitesse de chaque phase
 * (`[durée en s, vitesse en m/s]`). `climbPerS`, facultatif, fait monter
 * l'altitude d'autant de mètres par seconde.
 */
const buildTrack = (phases: [number, number][], hz = 1, climbPerS?: number): RawTrackPoint[] => phasesTrack(phases, hz, { startMs: START_MS, climbPerS });

describe('summarizeSession', () => {
  it('ne range plus ni le meilleur kilomètre ni les meilleures 5 min, ni les meilleurs efforts (course et vélo retirés, lot 303)', () => {
    const run = summarizeSession(buildTrack([[200, 3], [200, 4], [200, 3]]), 'kite')!;
    const ride = summarizeSession(buildTrack([[150, 7], [300, 9], [150, 7]]), 'wingfoil')!;
    for (const summary of [run, ride]) {
      for (const field of ['best1kmS', 'best5minMs', 'bests']) expect(summary).not.toHaveProperty(field);
    }
  });

  it('range la FC de la session, rien sans FC', () => {
    const points = buildTrack([[600, 3]]).map((p, i) => ({ ...p, hr: 140 + (i % 20) }));
    const hr = summarizeSession(points, 'wingfoil')!.heartRate!;
    expect(hr.avgBpm).toBeGreaterThan(140);
    expect(hr.avgBpm).toBeLessThan(160);
    expect(hr.coveredS).toBe(600);
    expect(hr.histogram.seconds.reduce((a, b) => a + b, 0)).toBeCloseTo(600, -1);
    expect(summarizeSession(buildTrack([[600, 3]]), 'wingfoil')!.heartRate).toBeUndefined();
  });

  it("ne range plus ni la cadence ni le test guidé (lot 301 : la version voile et surf n'en a pas)", () => {
    const points = buildTrack([[600, 3]]).map((p, i) => ({ ...p, cadence: 85, hr: 140 + (i % 20) }));
    for (const sport of ['kite', 'surf', 'wingfoil'] as const) {
      const summary = summarizeSession(points, sport)!;
      expect(summary).not.toHaveProperty('cadence');
      expect(summary).not.toHaveProperty('test');
    }
  });

  it('rend la distance intégrée et les bornes', () => {
    const summary = summarizeSession(buildTrack([[600, 3]]), 'wingfoil')!;
    expect(summary.calcVersion).toBe(SUMMARY_CALC_VERSION);
    expect(summary.startMs).toBe(START_MS);
    expect(summary.endMs).toBe(START_MS + 600_000);
    expect(summary.distanceM).toBeCloseTo(1800, -1);
    expect(summary.pointCount).toBe(601);
    expect(summary.samplingS).toBeCloseTo(1, 5);
    expect(summary.maxSpeedMs).toBeCloseTo(3, 1);
  });

  it('trace clairsemée (un point toutes les 15 s, chaque pas est un trou) : vitesse max lissée, pas 0 (lot 81)', () => {
    const summary = summarizeSession(buildTrack([[1200, 4]], 1 / 15), 'wingfoil')!;
    expect(summary.maxSpeedMs).toBeCloseTo(4, 1);
  });

  it('part de la trace d\'analyse, celle que la vignette colore', () => {
    // Pic de 1 s à 60 m/s : au-delà de la vitesse plausible d'une voile, il est écrêté.
    const raw = buildTrack([[300, 3], [1, 60], [300, 3]]);
    for (const sport of ['kite', 'wingfoil'] as const) {
      const track = analysisTrack(raw, sport);
      const summary = summarizeSession(raw, sport)!;
      expect(summary.pointCount).toBe(track.length);
      // Vitesse max : la meilleure moyenne sur 2 s de la trace d'analyse (Q34, lot 81).
      expect(summary.maxSpeedMs).toBe(bestWindowSpeedMs(track, buildCumulativeTrack(track), 2));
    }
    expect(Math.max(...analysisTrack(raw, 'wingfoil').map((p) => p.smoothedSpeedMs))).toBeLessThan(20);
    // Sans support, aucun filtre : la trace brute enrichie.
    expect(analysisTrack(raw, null)).toEqual(computeKinematics(raw));
  });

  it("donne la trace de l'analyse, mêmes options de cinématique, pour chaque famille (lot 72)", () => {
    // Le module d'analyse (`useGpxSession`) calcule sa trace avec ces mêmes options.
    const raw = buildTrack([[120, 2], [1, 40], [240, 6], [60, 1]]);
    for (const sport of [...Object.values(FAMILY_BASE), 'bateau', 'kite'] as const) {
      const profile = getSportProfile(sport);
      const options = kinematicsOptionsOf(profile, { scaleToSession: scalesFiltersToSession(profile), referenceMs: referenceSpeedMs(raw) });
      expect(analysisTrack(raw, sport), sport).toEqual(computeKinematics(raw, options));
    }
  });

  it("voile, vitesse Doppler en km/h : la liste donne les chiffres de l'analyse, à 1 Hz comme à 5 Hz (lot 95)", () => {
    // Wingfoil 10 min à 20 nœuds puis 5 min à 2 nœuds, positions bruitées de ±0,5 m (bruit déterministe),
    // vitesse de l'appareil écrite en km/h, absente sur un point sur 37.
    const dopplerKmh = (hz: number): RawTrackPoint[] => {
      let seed = 95;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      const clean = buildTrack([[600, 10.3], [300, 1]], hz);
      const eastM = clean.map((p) => (p.lon - clean[0].lon) * mPerDegLon(ORIGIN.lat));
      return clean.map((p, k) => {
        const speed = (eastM[Math.max(1, k)] - eastM[Math.max(1, k) - 1]) * hz;
        const noisy = at(eastM[k] + (rnd() - 0.5), rnd() - 0.5);
        return { ...p, ...noisy, ...(k % 37 === 5 ? {} : { speedMs: speed * 3.6 * (1 + (rnd() - 0.5) * 0.02) }) };
      });
    };
    for (const hz of [1, 5]) {
      const raw = dopplerKmh(hz);
      const unit = detectTrackDeviceSpeedUnit(raw);
      expect(unit).toBe('kmh');
      // Allure de l'analyse (`useGpxSession`) : unité détectée une fois, puis passée.
      const ref = referenceSpeedMs(raw, unit);
      // Garde-fou : l'unité change bien l'allure, sinon le test ne prouverait rien.
      expect(Math.abs(referenceSpeedMs(raw, null) - ref), `${hz} Hz`).toBeGreaterThan(0.01);
      expect(referenceSpeedMs(raw, 'ms') / ref, `${hz} Hz`).toBeCloseTo(3.6, 1);
      expect(ref, `${hz} Hz`).toBeCloseTo(10.3, 0);
      for (const sport of ['wingfoil', 'kite'] as const) {
        const name = `${sport}, ${hz} Hz`;
        const profile = getSportProfile(sport);
        const track = computeKinematics(raw, kinematicsOptionsOf(profile, { scaleToSession: true, referenceMs: ref }));
        expect(analysisTrack(raw, sport), name).toEqual(track);
        // Chiffres de l'analyse : seuil suggéré par l'allure, masque d'activité, ratio sur le temps en mouvement.
        const mask = thresholdActivityMask(track, profile, suggestActiveThresholdKn(sport, msToKnots(ref)));
        const summary = summarizeSession(raw, sport)!;
        expect(summary.movingTimeS, name).toBe(computeActiveTimeMs(track, mask) / 1000);
        expect(summary.movingDistanceM, name).toBe(computeActiveDistanceM(track, mask));
        expect(summary.inMotionS, name).toBe(computeActiveTimeMs(track, thresholdActivityMask(track, profile, 0)) / 1000);
        expect(summary.maxSpeedMs, name).toBe(bestWindowSpeedMs(track, buildCumulativeTrack(track), 2));
        expect(summary.pointCount, name).toBe(track.length);
        expect(summary.movingTimeS!, name).toBeGreaterThan(590);
        expect(summary.movingTimeS!, name).toBeLessThan(610);
      }
    }
  });

  it('accorde le seuil de la voile à l\'allure de la session, comme le module', () => {
    // Wingfoil à 20 nœuds pendant 10 min, puis 5 min à 2 nœuds : seul le vol compte.
    const summary = summarizeSession(buildTrack([[600, 10.3], [300, 1]]), 'wingfoil')!;
    expect(summary.movingTimeS).toBeGreaterThan(590);
    expect(summary.movingTimeS).toBeLessThan(610);
  });

  it('mesure la distance parcourue en action, avec le même masque que le temps', () => {
    // 10 min à 3 m/s, 5 min à 0,5 m/s (sous un seuil de 3 nœuds) : seuls les 1 800 m en action comptent.
    const summary = summarizeSession(buildTrack([[600, 3], [300, 0.5]]), 'wingfoil', { activeThreshold: 3 })!;
    expect(summary.distanceM).toBeCloseTo(1950, -1);
    expect(summary.movingDistanceM!).toBeGreaterThan(1750);
    expect(summary.movingDistanceM!).toBeLessThan(1850);
    expect(summary.movingDistanceM! / summary.movingTimeS!).toBeCloseTo(3, 1);
    // Toute en action : la distance entière.
    const all = summarizeSession(buildTrack([[600, 3]]), 'wingfoil', { activeThreshold: 3 })!;
    expect(all.movingDistanceM!).toBeGreaterThan(all.distanceM - 20);
    // Voile : seul le vol.
    const wing = summarizeSession(buildTrack([[600, 10.3], [300, 1]]), 'wingfoil')!;
    expect(wing.movingDistanceM! / wing.movingTimeS!).toBeCloseTo(10.3, 0);
  });

  it('range le temps en mouvement de la voile à seuil, dénominateur du ratio de vol (version 12)', () => {
    // 5 min à l'arrêt, 10 min de vol à 20 nœuds, 5 min à 3 nœuds, 5 min à l'arrêt.
    for (const hz of [1, 5]) {
      const summary = summarizeSession(buildTrack([[300, 0], [600, 10.3], [300, 1.5], [300, 0]], hz), 'wingfoil', { activeThreshold: 7 })!;
      expect(summary.calcVersion).toBe(SUMMARY_CALC_VERSION);
      expect(summary.inMotionS!).toBeGreaterThan(890);
      expect(summary.inMotionS!).toBeLessThan(910);
      expect(summary.movingTimeS! / summary.inMotionS!).toBeCloseTo(2 / 3, 1);
    }
    // Ni le surf ni le bateau, sans ratio de vol.
    expect('inMotionS' in summarizeSession(buildTrack([[600, 3]]), 'surf')!).toBe(false);
    expect('inMotionS' in summarizeSession(buildTrack([[600, 2.06]]), 'bateau')!).toBe(false);
  });

  it('compte toute une session bateau en navigation, sans seuil, bords lents compris', () => {
    // 10 min à 4 nœuds, 5 min à 0,5 nœud : rien n'est écarté, même un seuil imposé.
    const raw = buildTrack([[600, 2.06], [300, 0.26]]);
    for (const summary of [summarizeSession(raw, 'bateau')!, summarizeSession(raw, 'bateau', { activeThreshold: 3 })!]) {
      expect(summary.movingTimeS).toBeCloseTo((summary.endMs - summary.startMs) / 1000, 5);
      expect(summary.movingDistanceM).toBeCloseTo(summary.distanceM, 5);
    }
  });

  it('suit un seuil imposé', () => {
    // À 5,8 nœuds, un seuil de 12 nœuds ne voit jamais la session en mouvement.
    const summary = summarizeSession(buildTrack([[600, 3]]), 'wingfoil', { activeThreshold: 12 })!;
    expect(summary.movingTimeS).toBe(0);
  });

  it('sans seuil (réglé à 0), ôte tout de même un arrêt complet du temps en mouvement (plancher, 27/10)', () => {
    // 10 min à 3 m/s, 5 min immobile : l'arrêt sort au plancher d'arrêt de la voile.
    const summary = summarizeSession(buildTrack([[600, 3], [300, 0]]), 'wingfoil', { activeThreshold: 0 })!;
    expect(summary.movingTimeS!).toBeGreaterThan(595);
    expect(summary.movingTimeS!).toBeLessThan(605);
    // Seuls manquent les mètres des premières secondes, le temps de confirmer le départ.
    expect(summary.distanceM - summary.movingDistanceM!).toBeGreaterThanOrEqual(0);
    expect(summary.distanceM - summary.movingDistanceM!).toBeLessThan(10);
  });

  it("ne compte ni la distance ni le temps en mouvement d'une pause de l'enregistrement, à 1 Hz comme à 5 Hz", () => {
    // 5 min à 3 m/s, pause de 10 min (un second `<trkseg>`), 5 min à 3 m/s ; vitesse Doppler sur chaque point,
    // celle de la reprise comprise : intégrée sur la pause, elle ajoutait 1 800 m (bug du 17/10).
    const paused = (hz: number): RawTrackPoint[] => {
      const pauseStart = START_MS + 300_000;
      const pauseEnd = START_MS + 900_000;
      return buildTrack([[300, 3], [600, 0], [300, 3]], hz)
        .filter((p) => Date.parse(p.time as string) <= pauseStart || Date.parse(p.time as string) >= pauseEnd)
        .map((p) => ({ ...p, speedMs: 3, ...(Date.parse(p.time as string) === pauseEnd ? { segmentStart: true as const } : {}) }));
    };
    for (const hz of [1, 5]) {
      for (const activeThreshold of [0, 3]) {
        const summary = summarizeSession(paused(hz), 'wingfoil', { activeThreshold })!;
        expect(summary.distanceM).toBeCloseTo(1800, -1);
        expect(summary.movingTimeS!).toBeGreaterThan(590);
        expect(summary.movingTimeS!).toBeLessThan(601);
        expect(summary.endMs - summary.startMs).toBe(1_200_000);
      }
    }
  });

  it('donne le même résumé à 1 Hz et à 5 Hz', () => {
    const phases: [number, number][] = [[300, 3], [120, 0], [300, 3.5]];
    const at1 = summarizeSession(buildTrack(phases, 1), 'wingfoil', { activeThreshold: 3 })!;
    const at5 = summarizeSession(buildTrack(phases, 5), 'wingfoil', { activeThreshold: 3 })!;
    expect(at5.distanceM).toBeCloseTo(at1.distanceM, -1);
    expect(Math.abs(at5.movingTimeS! - at1.movingTimeS!)).toBeLessThan(3);
    expect(Math.abs(at5.movingDistanceM! - at1.movingDistanceM!)).toBeLessThan(10);
    expect(at5.endMs - at5.startMs).toBe(at1.endMs - at1.startMs);
  });

  it('rend le dénivelé positif si la trace a des altitudes, `null` sinon', () => {
    // 100 m de montée régulière en 10 min.
    const withEle = summarizeSession(buildTrack([[600, 3]], 1, 100 / 600), 'wingfoil')!;
    expect(withEle.elevationGainM).toBeGreaterThan(90);
    expect(withEle.elevationGainM).toBeLessThan(105);
    expect(summarizeSession(buildTrack([[600, 3]]), 'wingfoil')!.elevationGainM).toBeNull();
  });

  it('résume une trace sans support, sauf le temps en mouvement', () => {
    const summary = summarizeSession(buildTrack([[600, 3]]), null)!;
    expect(summary.distanceM).toBeCloseTo(1800, -1);
    expect(summary.movingTimeS).toBeNull();
    expect(summary.movingDistanceM).toBeNull();
  });

  it('rend `null` pour une trace de moins de deux points', () => {
    expect(summarizeSession([], 'wingfoil')).toBeNull();
    expect(summarizeSession(buildTrack([]), 'wingfoil')).toBeNull();
  });
});

describe('vitesse max du surf : celle de la page, une vague (Q34)', () => {
  /** Vitesse max que la page d'analyse montre : `maxWaveSpeedMs`, de la même trace et du même seuil. */
  const pageMax = (raw: RawTrackPoint[], foil = false): number | null => {
    const profile = getSportProfile('surf');
    const track = analysisTrack(raw, 'surf');
    return runSurfSession(track, buildCumulativeTrack(track), surfProfileOf(profile)!, {
      threshold: defaultActiveThresholdOf(profile, foil), foil, waveThreshold: null,
    }).summary.maxWaveSpeedMs;
  };
  const session: [number, number][] = [[60, 0.2], [6, 1.6], [12, 5], [80, 1], [60, 0.2], [6, 1.6], [12, 4], [80, 1], [60, 0.2]];

  for (const hz of [1, 5]) {
    it(`à ${hz} Hz : le résumé et la page donnent la même, ni la rame ni le retour ne comptent`, () => {
      const raw = buildTrack(session, hz);
      const summary = summarizeSession(raw, 'surf')!;
      expect(summary.waveCount).toBe(2);
      expect(pageMax(raw)).not.toBeNull();
      expect(summary.maxSpeedMs).toBe(pageMax(raw));
      expect(summary.maxSpeedMs).toBeCloseTo(5, 0);
    });

    it(`à ${hz} Hz : une rame sans vague n'a pas de vitesse max (0, lu « absent » partout)`, () => {
      const raw = buildTrack([[1800, 2.2], [20, 2.4]], hz);
      const summary = summarizeSession(raw, 'surf')!;
      expect(pageMax(raw)).toBeNull();
      expect(summary.waveCount).toBe(0);
      expect(summary.maxSpeedMs).toBe(0);
    });

    it(`à ${hz} Hz : une pointe hors vague (trop courte pour en être une) ne compte pas`, () => {
      const raw = buildTrack([[60, 0.2], [6, 1.6], [12, 4], [80, 1], [2, 7], [60, 1], [60, 0.2]], hz);
      const summary = summarizeSession(raw, 'surf')!;
      expect(summary.maxSpeedMs).toBe(pageMax(raw));
      expect(summary.maxSpeedMs).toBeLessThan(5);
    });

    it(`à ${hz} Hz : sur foil, la même que la page`, () => {
      const raw = buildTrack([[60, 0.2], [6, 1.6], [10, 6], [20, 3.8], [10, 6], [60, 1], [60, 0.1]], hz);
      const summary = summarizeSession(raw, 'surf', { foil: true })!;
      expect(summary.maxSpeedMs).toBe(pageMax(raw, true));
      expect(summary.maxSpeedMs).toBeGreaterThan(0);
    });
  }

  it('la voile garde la meilleure moyenne de 2 s de toute la trace', () => {
    const raw = buildTrack([[300, 3], [20, 6], [300, 3]]);
    for (const sport of ['wingfoil', 'kite', 'bateau'] as const) {
      const summary = summarizeSession(raw, sport)!;
      const track = analysisTrack(raw, sport);
      expect(summary.maxSpeedMs).toBe(bestWindowSpeedMs(track, buildCumulativeTrack(track), getSportProfile(sport).maxSpeedWindowS));
    }
  });
});

