import { describe, expect, it } from 'vitest';
import { computeKinematics } from '../core/kinematics';
import { SPORT_PROFILES, type SportProfile } from '../core/sportProfiles';
import type { LocationFix } from '../platform/location';
import { M_PER_DEG_LAT } from '../test/geo.fixture';
import { SETTLED_ACCURACY_M, SETTLE_MAX_WAIT_S, fromSettledStart, judgeSettle } from './gpsSettle';
import { computeLiveStats } from './liveStats';

const T0 = Date.UTC(2026, 8, 23, 12, 0, 0);
const LAT0 = 43.5;
const SPEED_MS = 2.7;

/** Valeur interpolée entre les secondes 0 à 4, la dernière tenue ensuite. */
const atSecond = (values: number[], t: number): number => {
  if (t >= values.length - 1) return values[values.length - 1];
  const k = Math.floor(t);
  return values[k] + (values[k + 1] - values[k]) * (t - k);
};

/**
 * Départ mal calé : déplacement régulier vers le nord à 2,7 m/s, les positions des secondes 0 à 4 décalées vers
 * l'arrière de 22, 12,5, 6, 2 et 0 m, d'incertitude 30, 20, 12, 6 et 4 m (entre deux secondes, de l'une à l'autre),
 * puis justes, à 4 m près.
 */
const badStart = (hz: number, withSpeed: boolean, durationS = 60): LocationFix[] => {
  const fixes: LocationFix[] = [];
  const n = Math.round(durationS * hz);
  for (let k = 0; k <= n; k++) {
    const t = k / hz;
    const alongM = SPEED_MS * t - atSecond([22, 12.5, 6, 2, 0], t);
    fixes.push({
      timeMs: T0 + Math.round(t * 1000), lat: LAT0 + alongM / M_PER_DEG_LAT, lon: 3.9,
      accuracyM: atSecond([30, 20, 12, 6, 4], t), speedMs: withSpeed ? SPEED_MS : undefined,
    });
  }
  return fixes;
};

/** Ce que deviennent la trace et ses chiffres, par la chaîne du direct (`computeLiveStats`) et par la cinématique. */
const measure = (fixes: LocationFix[], profile: SportProfile) => {
  const stats = computeLiveStats([fixes], profile);
  const track = computeKinematics(fixes.map((f) => ({ lat: f.lat, lon: f.lon, time: new Date(f.timeMs), rawTimeMs: f.timeMs, speedMs: f.speedMs })), {
    medianWindowSeconds: profile.medianWindowSeconds, maxSpeedMs: profile.maxPlausibleSpeedMs, maxGapS: profile.maxGapS,
  });
  const startS = (fixes[0].timeMs - T0) / 1000;
  return {
    maxSpeedMs: stats.maxSpeedMs ?? 0,
    distanceM: stats.distanceM,
    /** Distance vraie depuis la première position gardée. */
    trueDistanceM: SPEED_MS * ((fixes[fixes.length - 1].timeMs - fixes[0].timeMs) / 1000),
    topPointSpeedMs: Math.max(...track.map((p) => p.speedMs)),
    /** Écart de la première position gardée à la vraie, en mètres. */
    startOffM: SPEED_MS * startS - (fixes[0].lat - LAT0) * M_PER_DEG_LAT,
    startS,
  };
};

const fix = (s: number, accuracyM?: number): LocationFix => ({ timeMs: T0 + Math.round(s * 1000), lat: LAT0, lon: 3.9, accuracyM });

describe('judgeSettle', () => {
  it('juge calée une position d’incertitude au plus SETTLED_ACCURACY_M, ou sans incertitude', () => {
    expect(judgeSettle(null, fix(0, SETTLED_ACCURACY_M))).toEqual({ settled: true, firstSeenMs: T0 });
    expect(judgeSettle(null, fix(0, SETTLED_ACCURACY_M + 0.1)).settled).toBe(false);
    expect(judgeSettle(null, fix(0)).settled).toBe(true);
    expect(judgeSettle(T0, fix(3)).settled).toBe(true);
  });

  it('garde l’heure de la première position vue, et démarre quand même au bout du délai', () => {
    expect(judgeSettle(null, fix(2, 30))).toEqual({ settled: false, firstSeenMs: T0 + 2000 });
    expect(judgeSettle(T0, fix(SETTLE_MAX_WAIT_S - 0.2, 30)).settled).toBe(false);
    expect(judgeSettle(T0, fix(SETTLE_MAX_WAIT_S, 30)).settled).toBe(true);
    expect(judgeSettle(T0, fix(5, 30), { accuracyM: SETTLED_ACCURACY_M, maxWaitS: 5 }).settled).toBe(true);
  });
});

describe('fromSettledStart', () => {
  it('démarre au même instant à 1 Hz et à 5 Hz : au délai, sur un GPS qui ne se cale jamais', () => {
    for (const hz of [1, 5]) {
      const fixes = Array.from({ length: 20 * hz + 1 }, (_, k) => fix(k / hz, 30));
      expect(fromSettledStart(fixes)[0].timeMs, `${hz} Hz`).toBe(T0 + SETTLE_MAX_WAIT_S * 1000);
    }
  });

  it('démarre au même instant à 1 Hz et à 5 Hz : à la première position assez précise', () => {
    for (const hz of [1, 5]) {
      const fixes = Array.from({ length: 10 * hz + 1 }, (_, k) => fix(k / hz, k / hz < 3 ? 25 : 5));
      expect(fromSettledStart(fixes)[0].timeMs, `${hz} Hz`).toBe(T0 + 3000);
    }
  });

  it('ne retire rien d’une trace sans incertitude (navigateur, rejeu d’un fichier)', () => {
    const fixes = [fix(0), fix(1), fix(2)];
    expect(fromSettledStart(fixes)).toEqual(fixes);
  });

  it('ne joue plus après la première position calée : une incertitude large ensuite est gardée', () => {
    const fixes = [fix(0, 40), fix(1, 8), fix(2, 50), fix(3, 60)];
    expect(fromSettledStart(fixes)).toEqual(fixes.slice(1));
  });

  it('rend une trace vide quand rien ne se cale avant la fin', () => {
    expect(fromSettledStart([fix(0, 40), fix(1, 30)])).toEqual([]);
  });
});

describe('départ mal calé, trace synthétique', () => {
  const profiles = [SPORT_PROFILES.wingfoil, SPORT_PROFILES.surf];

  it('sans calage : la vitesse du GPS ne voit pas le saut, mais sans elle la vitesse part d’un pic', () => {
    for (const profile of profiles) {
      for (const hz of [1, 5]) {
        const label = `${profile.id} ${hz} Hz`;
        const withSpeed = measure(badStart(hz, true), profile);
        expect(withSpeed.maxSpeedMs, label).toBeCloseTo(SPEED_MS, 6);
        expect(withSpeed.distanceM, label).toBeCloseTo(withSpeed.trueDistanceM, 6);
        expect(withSpeed.startOffM, label).toBeCloseTo(22, 3);
        const derived = measure(badStart(hz, false), profile);
        expect(derived.topPointSpeedMs, label).toBeGreaterThan(12);
        expect(derived.maxSpeedMs, label).toBeGreaterThan(10);
        expect(derived.distanceM - derived.trueDistanceM, label).toBeGreaterThan(20);
      }
    }
  });

  it('avec calage : la trace part de la première position calée, sans pic, distance juste à son écart près', () => {
    for (const profile of profiles) {
      for (const hz of [1, 5]) {
        const label = `${profile.id} ${hz} Hz`;
        const kept = fromSettledStart(badStart(hz, false));
        expect(kept[0].accuracyM, label).toBeLessThanOrEqual(SETTLED_ACCURACY_M);
        const derived = measure(kept, profile);
        // Le reste de l'écart, dans l'incertitude de la position calée, se rattrape en une ou deux secondes.
        expect(derived.startOffM, label).toBeLessThanOrEqual(kept[0].accuracyM ?? 0);
        expect(derived.maxSpeedMs, label).toBeLessThan(5);
        expect(derived.distanceM - derived.trueDistanceM, label).toBeLessThan(5);
        const withSpeed = measure(fromSettledStart(badStart(hz, true)), profile);
        expect(withSpeed.maxSpeedMs, label).toBeCloseTo(SPEED_MS, 6);
        expect(withSpeed.distanceM, label).toBeCloseTo(withSpeed.trueDistanceM, 6);
      }
    }
  });
});
