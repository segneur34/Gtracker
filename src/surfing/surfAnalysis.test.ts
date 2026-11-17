import { describe, expect, it } from 'vitest';
import { computeKinematics } from '../core/kinematics';
import { activeRuns, buildCumulativeTrack, computeActivityMask, thresholdActivityMask } from '../core/sessionStats';
import { SPORT_PROFILES, defaultActiveThresholdOf, getActiveThresholds } from '../core/sportProfiles';
import type { RawTrackPoint, TrackPoint } from '../core/types';
import { fromDisplaySpeed } from '../core/units';
import { summarizeSession } from '../library/summary';
import { analyzeSurf, summarizeSurf, type SurfParams } from './surfAnalysis';
import { countDirectionChanges } from './gpsTurns';
import { runSurfSession, surfProfileOf } from './surfSession';
import { M_PER_DEG_LAT } from '../test/geo.fixture';

/**
 * Session de surf synthétique : une suite de phases à vitesse et cap
 * constants, positions intégrées le long du cap, vitesse de l'appareil
 * (Doppler) et cap de l'appareil sur chaque point. Le nord est le large.
 */
interface Phase {
  s: number;
  speed: number;
  /** Rampe : la vitesse passe linéairement de `speed` à `to` pendant la phase. */
  to?: number;
  heading?: number;
  /** Rampe du cap : de `heading` à `headingTo`, linéairement pendant la phase. */
  headingTo?: number;
  /** Phase sans aucun point : le téléphone sous l'eau. */
  gap?: boolean;
}

/**
 * Options du générateur : `doppler` à faux, ni vitesse ni cap de l'appareil
 * (le noyau les tire des positions) ; `dropBetweenS`, aucun point strictement
 * entre ces deux instants (en secondes depuis le premier point) : une
 * cadence variable, un seul long pas.
 */
interface BuildOptions {
  doppler?: boolean;
  dropBetweenS?: [number, number];
}

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);

const buildSurfSession = (phases: Phase[], cadenceS = 1, options: BuildOptions = {}): TrackPoint[] => {
  const doppler = options.doppler ?? true;
  const drop = options.dropBetweenS;
  const raw: RawTrackPoint[] = [];
  let lat = 43.4;
  let lon = 3.6;
  let t = 0;
  const push = (speed: number, heading: number) => {
    if (drop && t > drop[0] + 1e-9 && t < drop[1] - 1e-9) return;
    raw.push({
      lat, lon, time: new Date(T0 + t * 1000),
      ...(doppler ? { speedMs: speed, ...(speed > 0 ? { courseDeg: heading } : {}) } : {}),
    });
  };
  push(0, 0);
  for (const ph of phases) {
    const steps = Math.max(1, Math.round(ph.s / cadenceS));
    const dt = ph.s / steps;
    const speedAt = (k: number) => (ph.to === undefined ? ph.speed : ph.speed + ((ph.to - ph.speed) * k) / steps);
    const headingAt = (k: number) => {
      const h = ph.heading ?? 0;
      return ph.headingTo === undefined ? h : h + ((ph.headingTo - h) * k) / steps;
    };
    for (let k = 0; k < steps; k++) {
      // Vitesse linéaire sur le pas : la distance est celle de sa vitesse moyenne, le long du cap du milieu du pas.
      const d = ((speedAt(k) + speedAt(k + 1)) / 2) * dt;
      const heading = headingAt(k + 0.5);
      lat += (d * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
      lon += (d * Math.sin((heading * Math.PI) / 180)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
      t += dt;
      if (!ph.gap) push(speedAt(k + 1), headingAt(k + 1));
    }
  }
  const profile = SPORT_PROFILES.surf;
  return computeKinematics(raw, { medianWindowSeconds: profile.medianWindowSeconds, maxSpeedMs: profile.maxPlausibleSpeedMs });
};

const surf = SPORT_PROFILES.surf.surf!;
const params: SurfParams = {
  ...surf, maxGapS: SPORT_PROFILES.surf.maxGapS, maxSpeedWindowS: SPORT_PROFILES.surf.maxSpeedWindowS,
  // Un seul plancher d'arrêt : celui du profil, 2 km/h.
  stillMs: fromDisplaySpeed(SPORT_PROFILES.surf.stillThreshold, 'kmh'),
};

/** Masque au seuil donné, en km/h, avec l'hystérésis du profil. */
const maskAt = (track: TrackPoint[], thresholdKmh: number): boolean[] => {
  const t = getActiveThresholds(SPORT_PROFILES.surf, thresholdKmh);
  return computeActivityMask(track, {
    enterThresholdMs: fromDisplaySpeed(t.enter, 'kmh'),
    exitThresholdMs: fromDisplaySpeed(t.exit, 'kmh'),
    minStateDurationS: SPORT_PROFILES.surf.minStateDurationS,
  });
};

const analyze = (track: TrackPoint[], foil = false) => {
  const cum = buildCumulativeTrack(track);
  const rideMask = maskAt(track, foil ? surf.foilActiveThreshold : SPORT_PROFILES.surf.defaultActiveThreshold);
  const waveMask = foil ? maskAt(track, surf.foilWaveThreshold) : null;
  const analysis = analyzeSurf(track, cum, rideMask, waveMask, params);
  return { analysis, summary: summarizeSurf(track, cum, analysis, params.stillMs) };
};

/**
 * Une matinée : plage, marche, sortie avec deux canards, attente, trois
 * vagues ; la troisième prise en remontant, sans attente.
 */
const MORNING: Phase[] = [
  { s: 60, speed: 0 },
  { s: 60, speed: 1.2 },
  { s: 50, speed: 1 },
  { s: 4, speed: 0.1 },
  { s: 40, speed: 1 },
  { s: 4, speed: 0.1 },
  { s: 26, speed: 1 },
  { s: 90, speed: 0.1 },
  { s: 6, speed: 1.6, heading: 180 },
  { s: 12, speed: 5, heading: 200 },
  { s: 100, speed: 1 },
  { s: 60, speed: 0.1 },
  { s: 5, speed: 1.5, heading: 180 },
  { s: 20, speed: 6, heading: 160 },
  { s: 40, speed: 1 },
  { s: 5, speed: 1.6, heading: 180 },
  { s: 8, speed: 4.5, heading: 190 },
  { s: 80, speed: 1 },
  { s: 30, speed: 0.1 },
];

describe('analyzeSurf, sans foil', () => {
  const { analysis, summary } = analyze(buildSurfSession(MORNING));

  it('trouve les trois vagues, leur durée et leur distance', () => {
    expect(analysis.waves).toHaveLength(3);
    const [a, b, c] = analysis.waves;
    expect(a.durationS).toBeCloseTo(12, -0.5);
    expect(a.distanceM).toBeCloseTo(60, -1);
    expect(b.distanceM).toBeCloseTo(120, -1);
    expect(c.distanceM).toBeCloseTo(36, -1);
    expect(b.maxSpeedMs).toBeCloseTo(6, 1);
    expect(summary.longestWaveM).toBe(b.distanceM);
    expect(summary.avgWaveDistanceM).toBeCloseTo((a.distanceM + b.distanceM + c.distanceM) / 3, 6);
  });

  it('mesure la rame de départ de chaque vague', () => {
    const [a, b] = analysis.waves;
    expect(a.takeoffS).toBeGreaterThanOrEqual(5);
    expect(a.takeoffS).toBeLessThanOrEqual(8);
    expect(a.takeoffSpeedMs).toBeGreaterThan(1.3);
    expect(b.takeoffS).toBeLessThanOrEqual(params.takeoffSearchS);
  });

  it('mesure le retour au pic, et compte la vague enchaînée à part', () => {
    const afterFirst = analysis.returns.find((r) => r.after === 1)!;
    expect(afterFirst.returnS).toBeCloseTo(100, -1);
    expect(afterFirst.straightM).toBeCloseTo(100, -1);
    expect(afterFirst.paddleSpeedMs).toBeCloseTo(1, 1);
    expect(analysis.returns.find((r) => r.after === 2)!.returnS).toBeNull();
    expect(summary.chainedCount).toBe(1);
    expect(summary.avgReturnS).toBeCloseTo(afterFirst.returnS!, 6);
  });

  it('compte la première sortie, marche comprise, sans s\'arrêter aux canards', () => {
    expect(summary.firstOutS).toBeCloseTo(60 + 120 + 8, -1);
  });

  it('répartit le temps entre glisse, rame et attente', () => {
    expect(summary.glisseS).toBeCloseTo(40, -1);
    expect(summary.attenteS).toBeGreaterThan(60 + 90 + 60 + 30 - 10);
    expect(summary.glisseS + summary.rameS + summary.attenteS + summary.trouS).toBeCloseTo(summary.totalS, 6);
    expect(summary.paddleSpeedMs).toBeGreaterThan(0.9);
    expect(summary.paddleSpeedMs).toBeLessThan(1.3);
  });
});

describe('analyzeSurf, cadence', () => {
  it('donne le même résultat à 1 Hz et à 5 Hz', () => {
    const slow = analyze(buildSurfSession(MORNING, 1)).summary;
    const fast = analyze(buildSurfSession(MORNING, 0.2)).summary;
    expect(fast.waveCount).toBe(slow.waveCount);
    expect(fast.waveDistanceM).toBeCloseTo(slow.waveDistanceM, -1);
    expect(fast.avgReturnS!).toBeCloseTo(slow.avgReturnS!, -0.5);
    expect(fast.firstOutS!).toBeCloseTo(slow.firstOutS!, -0.5);
  });

  it('garde une vague compressée en trois points (cadence de 4 s)', () => {
    const sparse = analyze(buildSurfSession(MORNING, 4));
    expect(sparse.analysis.waves).toHaveLength(3);
    expect(sparse.summary.longestWaveM).toBeCloseTo(120, -1);
  });

  it('ne compte pas un trou de la trace (téléphone sous l\'eau) comme de la glisse', () => {
    const withGap: Phase[] = [
      ...MORNING.slice(0, 14),
      { s: 25, speed: 1, gap: true },
      ...MORNING.slice(14),
    ];
    const { analysis, summary } = analyze(buildSurfSession(withGap));
    expect(analysis.waves).toHaveLength(3);
    expect(summary.trouS).toBeCloseTo(26, -0.5);
    expect(analysis.waves[1].distanceM).toBeCloseTo(120, -1);
  });

  it('une glisse qui traverse un trou parcouru en mouvement reste une glisse, le pas du trou garde sa phase « trou »', () => {
    // La deuxième vague (20 s à 6 m/s) perd ses points du milieu pendant 12 s, planche lancée : un seul pas de 13 s.
    const through: Phase[] = [
      ...MORNING.slice(0, 13),
      { s: 4, speed: 6, heading: 160 },
      { s: 12, speed: 6, heading: 160, gap: true },
      { s: 4, speed: 6, heading: 160 },
      ...MORNING.slice(14),
    ];
    const { analysis, summary } = analyze(buildSurfSession(through));
    expect(analysis.waves).toHaveLength(3);
    expect(analysis.waves[1].durationS).toBeCloseTo(20, -0.5);
    // La distance du trou est celle de sa corde (règle 6) : 12 s à 6 m/s en ligne droite.
    expect(analysis.waves[1].distanceM).toBeCloseTo(120, -1);
    expect(summary.trouS).toBeCloseTo(13, -0.5);
  });
});

describe('analyzeSurf, sur foil', () => {
  /** Un vol de trois vagues reliées par du pompage, un posé, puis un vol court d'une vague. */
  const FOIL: Phase[] = [
    { s: 60, speed: 1 },
    { s: 30, speed: 0.1 },
    { s: 5, speed: 2, heading: 180 },
    { s: 15, speed: 6.5, heading: 200 },
    { s: 20, speed: 4, heading: 20 },
    { s: 15, speed: 6.5, heading: 190 },
    { s: 20, speed: 4, heading: 10 },
    { s: 10, speed: 6.5, heading: 200 },
    { s: 40, speed: 0.8 },
    { s: 30, speed: 0.1 },
    { s: 5, speed: 2, heading: 180 },
    { s: 12, speed: 6.5, heading: 200 },
    { s: 30, speed: 0.8 },
  ];
  const { analysis, summary } = analyze(buildSurfSession(FOIL), true);

  it('relie les vagues d\'un même vol, et mesure le pompage', () => {
    expect(analysis.flights).toHaveLength(2);
    const [first, second] = analysis.flights;
    expect(first.waveCount).toBe(3);
    expect(first.durationS).toBeCloseTo(80, -1);
    expect(first.pumpS).toBeGreaterThan(30);
    expect(first.pumpSpeedMs).toBeCloseTo(4, 0);
    expect(second.waveCount).toBe(1);
    expect(summary.longestFlightS).toBe(first.durationS);
    expect(summary.maxWavesInFlight).toBe(3);
    expect(summary.flightS).toBeCloseTo(first.durationS + second.durationS, 5);
  });

  it('mesure la distance en glisse, celle des pas en phase « glisse »', () => {
    const track = buildSurfSession(FOIL);
    const cum = buildCumulativeTrack(track);
    let expected = 0;
    for (let i = 1; i < track.length; i++) if (analysis.phases[i] === 'glisse') expected += cum.cumDist[i] - cum.cumDist[i - 1];
    expect(summary.glisseDistanceM).toBeCloseTo(expected, 5);
    expect(summary.glisseDistanceM).toBeGreaterThan(0);
    expect(summary.glisseDistanceM).toBeLessThan(cum.cumDist[cum.cumDist.length - 1]);
  });

  it('numérote les vagues sur toute la session, chacune avec son vol', () => {
    expect(analysis.waves.map((w) => w.flight)).toEqual([1, 1, 1, 2]);
    expect(analysis.waves.map((w) => w.n)).toEqual([1, 2, 3, 4]);
    expect(summary.waveCount).toBe(4);
  });

  it('mesure la remontée entre deux vols', () => {
    const back = analysis.returns.find((r) => r.after === 1)!;
    expect(back.returnS).toBeCloseTo(40, -1);
  });
});

describe('runSurfSession et résumé de la bibliothèque', () => {
  const profile = surfProfileOf(SPORT_PROFILES.surf)!;

  it('prend le seuil de vol par défaut sur foil, et celui de vague sinon', () => {
    expect(defaultActiveThresholdOf(SPORT_PROFILES.surf, true)).toBe(surf.foilActiveThreshold);
    expect(defaultActiveThresholdOf(SPORT_PROFILES.surf, false)).toBe(SPORT_PROFILES.surf.defaultActiveThreshold);
    // En voile, le foil ne touche pas au seuil.
    expect(defaultActiveThresholdOf(SPORT_PROFILES.wingfoil, true)).toBe(SPORT_PROFILES.wingfoil.defaultActiveThreshold);
  });

  it('donne les mêmes vagues que le découpage, seuil de vague en foil imposé compris', () => {
    const track = buildSurfSession(MORNING);
    const cum = buildCumulativeTrack(track);
    const run = runSurfSession(track, cum, profile, { threshold: SPORT_PROFILES.surf.defaultActiveThreshold, foil: false, waveThreshold: null });
    expect(run.summary).toEqual(analyze(track).summary);
    // Sur foil, un seuil de vague au-dessus de toutes les vitesses : des vols, aucune vague.
    const high = runSurfSession(track, cum, profile, { threshold: surf.foilActiveThreshold, foil: true, waveThreshold: 40 });
    expect(high.summary.waveCount).toBe(0);
    expect(high.summary.flightCount).toBeGreaterThan(0);
  });

  it('sans foil, la glisse est faite des vagues : même durée que « sur la vague » (la légende ne la redit pas)', () => {
    for (const cadenceS of [1, 0.2]) {
      const { summary } = analyze(buildSurfSession(MORNING, cadenceS));
      expect(summary.waveCount).toBeGreaterThan(0);
      expect(summary.glisseS).toBeCloseTo(summary.waveS, 6);
    }
  });

  it('résume une session de surf pour la liste : vagues, plus longue, temps sur la vague', () => {
    const raw: RawTrackPoint[] = buildSurfSession(MORNING).map((p) => ({ lat: p.lat, lon: p.lon, time: p.time, speedMs: p.speedMs }));
    const summary = summarizeSession(raw, 'surf')!;
    expect(summary.waveCount).toBe(3);
    expect(summary.longestWaveM).toBeCloseTo(120, -1);
    expect(summary.longestFlightS).toBeNull();
    expect(summary.movingTimeS).toBeCloseTo(40, -1);
    // Distance en glisse : à peu près la vitesse sur la vague fois le temps de glisse.
    expect(summary.movingDistanceM! / summary.movingTimeS!).toBeGreaterThan(3);
    expect(summary.flightS).toBeNull();
    // Sur foil : le temps total des vols.
    const foil = summarizeSession(raw, 'surf', { foil: true })!;
    expect(foil.flightS).not.toBeNull();
    expect(foil.flightS!).toBeGreaterThanOrEqual(foil.longestFlightS ?? 0);
    // Sur une autre famille, pas de champ du surf.
    expect(summarizeSession(raw, 'kite')!.waveCount).toBeUndefined();
  });
});

describe('vitesse max des vagues, plancher d’arrêt unique, pause manuelle', () => {
  const profile = surfProfileOf(SPORT_PROFILES.surf)!;

  for (const cadenceS of [1, 0.2]) {
    it(`à ${1 / cadenceS} Hz, la vitesse max d'une vague est sa meilleure moyenne sur 2 s`, () => {
      // Une vague à 6 m/s portée 3 s à 8 m/s : la meilleure moyenne sur 2 s tient dans le plateau.
      const phases: Phase[] = [
        ...MORNING.slice(0, 13),
        { s: 6, speed: 6, heading: 160 }, { s: 3, speed: 8, heading: 160 }, { s: 11, speed: 6, heading: 160 },
        ...MORNING.slice(14),
      ];
      const { analysis, summary } = analyze(buildSurfSession(phases, cadenceS));
      const b = analysis.waves[1];
      expect(b.maxSpeedMs).toBeGreaterThan(7.5);
      expect(b.maxSpeedMs).toBeLessThanOrEqual(8 + 1e-6);
      expect(summary.maxWaveSpeedMs).toBe(b.maxSpeedMs);
    });

    it(`à ${1 / cadenceS} Hz, une pause manuelle de 8 s n'est ni rame ni attente`, () => {
      const track = buildSurfSession(MORNING, cadenceS);
      // Pause dans la remontée qui suit la première vague (rame à 1 m/s), à 450 s.
      const k0 = Math.round(450 / cadenceS);
      const paused = track.map((p, k) => {
        if (k < k0) return p;
        const timeMs = p.timeMs + 8000;
        return { ...p, timeMs, time: new Date(timeMs).toISOString(), ...(k === k0 ? { segmentStart: true as const } : {}) };
      });
      const before = analyze(track).summary;
      const { analysis, summary } = analyze(paused);
      expect(analysis.phases[k0]).toBe('trou');
      expect(summary.trouS - before.trouS).toBeCloseTo(8 + cadenceS, 6);
      expect(summary.rameS + summary.attenteS).toBeCloseTo(before.rameS + before.attenteS - cadenceS, 6);
      expect(summary.waveCount).toBe(before.waveCount);
    });
  }

  it('seuil à 0 : le masque tombe au plancher d’arrêt du profil, comme thresholdActivityMask', () => {
    const track = buildSurfSession(MORNING);
    const run = runSurfSession(track, buildCumulativeTrack(track), profile, { threshold: 0, foil: false, waveThreshold: null });
    expect(run.rideMask).toEqual(thresholdActivityMask(track, SPORT_PROFILES.surf, 0));
    expect(run.rideMask.some((m) => m)).toBe(true);
    expect(run.rideMask.every((m) => m)).toBe(false);
  });

  it('résumé : vitesse max sur 2 s, à 1 Hz et 5 Hz ; la plus haute vitesse lissée si aucune fenêtre ne tient', () => {
    for (const cadenceS of [1, 0.2]) {
      const raw: RawTrackPoint[] = buildSurfSession(MORNING, cadenceS).map((p) => ({ lat: p.lat, lon: p.lon, time: p.time, speedMs: p.speedMs }));
      expect(summarizeSession(raw, 'surf')!.maxSpeedMs).toBeCloseTo(6, 1);
    }
    const two: RawTrackPoint[] = [
      { lat: 43.4, lon: 3.6, time: new Date(T0).toISOString(), speedMs: 3 },
      { lat: 43.40001, lon: 3.6, time: new Date(T0 + 1000).toISOString(), speedMs: 3 },
    ];
    expect(summarizeSession(two, 'bateau')!.maxSpeedMs).toBeCloseTo(3, 6);
  });
});

/** Vitesse vraie de la trace synthétique à l'instant `t`, en secondes depuis le premier point. */
const trueSpeedAt = (phases: Phase[], t: number): number => {
  let t0 = 0;
  for (const ph of phases) {
    if (t <= t0 + ph.s) return ph.to === undefined ? ph.speed : ph.speed + ((ph.to - ph.speed) * (t - t0)) / ph.s;
    t0 += ph.s;
  }
  return 0;
};

const FINE_S = 0.001;

/** Distance vraie parcourue entre deux instants, en mètres (signée). */
const trueDistanceM = (phases: Phase[], from: number, to: number): number => {
  const sign = to >= from ? 1 : -1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  let d = 0;
  for (let t = a; t < b; t += FINE_S) d += trueSpeedAt(phases, t + FINE_S / 2) * Math.min(FINE_S, b - t);
  return sign * d;
};

/** Premier instant, à partir de `from`, où la vitesse vraie vérifie `test`. */
const firstTimeS = (phases: Phase[], from: number, test: (v: number) => boolean): number => {
  let t = from;
  while (!test(trueSpeedAt(phases, t))) t += FINE_S;
  return t;
};

/** Début d'une phase, en secondes depuis le premier point. */
const phaseStartS = (phases: Phase[], index: number): number => phases.slice(0, index).reduce((s, ph) => s + ph.s, 0);

/**
 * Une mise en vitesse : la rampe part de `rampAtS` ; `low` et `high` sont la
 * détente basse et la détente haute du masque qui la découpe, en m/s.
 */
interface SoftRide {
  phases: Phase[];
  rampAtS: number;
  rampS: number;
  foil: boolean;
  /** Le passage mesuré : la vague, ou le vol sur foil. */
  kind: 'vague' | 'vol';
}

const thresholdsMs = (thresholdKmh: number) => {
  const t = getActiveThresholds(SPORT_PROFILES.surf, thresholdKmh);
  return { low: fromDisplaySpeed(t.exit, 'kmh'), high: fromDisplaySpeed(t.enter, 'kmh') };
};

/** Seuil de vague sans foil, de vol et de vague sur foil, comme `runSurfSession` les pose. */
const boundsOf = (ride: SoftRide) =>
  thresholdsMs(!ride.foil ? SPORT_PROFILES.surf.defaultActiveThreshold : ride.kind === 'vol' ? surf.foilActiveThreshold : surf.foilWaveThreshold);

interface SoftMeasure {
  kept: boolean;
  /** Rogné au début, en secondes : en tout, puis (a) entre les deux détentes, (b) sous la détente basse, (c) le reste (échantillonnage, lissage). */
  startCutS: number;
  a: number;
  b: number;
  c: number;
  startCutM: number;
  aM: number;
  bM: number;
  cM: number;
  /** Rogné à la fin, du retour vrai sous la détente basse : positif, la fin est coupée. */
  endCutS: number;
  endCutM: number;
  turns: number;
  /** Virages que compterait un début remonté à la détente basse, puis au début de la rampe. */
  turnsFromLow: number;
  turnsFromRamp: number;
  durationS: number;
  distanceM: number;
}

const softProfile = surfProfileOf(SPORT_PROFILES.surf)!;

const measureSoftRide = (ride: SoftRide, cadenceS: number, options: BuildOptions = {}): SoftMeasure => {
  const { phases, rampAtS } = ride;
  const { low, high } = boundsOf(ride);
  const track = buildSurfSession(phases, cadenceS, options);
  const cum = buildCumulativeTrack(track);
  const threshold = ride.foil ? surf.foilActiveThreshold : SPORT_PROFILES.surf.defaultActiveThreshold;
  const run = runSurfSession(track, cum, softProfile, { threshold, foil: ride.foil, waveThreshold: null });
  const tLow = firstTimeS(phases, rampAtS, (v) => v >= low);
  const tHigh = firstTimeS(phases, tLow, (v) => v >= high);
  const tExit = firstTimeS(phases, tHigh, (v) => v < low);
  const tOf = (i: number) => (track[i].timeMs - T0) / 1000;
  const spans = ride.kind === 'vol' ? run.analysis.flights : run.analysis.waves;
  const found = spans.find((w) => (w.startMs - T0) / 1000 < tExit && (w.endMs - T0) / 1000 > rampAtS);
  // Vague écartée : le passage du masque, avant le filtre de durée et de distance.
  const masked = activeRuns(track, run.rideMask).find((r) => tOf(r.start) < tExit && tOf(r.end) > rampAtS);
  const span = found ?? (masked ? { start: masked.start, end: masked.end } : null);
  if (!span) throw new Error('aucun passage du masque');
  const tStart = tOf(span.start);
  const tEnd = tOf(span.end);
  const startCutM = trueDistanceM(phases, rampAtS, tStart);
  const aM = trueDistanceM(phases, tLow, tHigh);
  const bM = trueDistanceM(phases, rampAtS, tLow);
  const pointAtOrBefore = (s: number) => {
    let i = span.start;
    while (i > 0 && tOf(i) > s + 1e-9) i--;
    return i;
  };
  return {
    kept: found !== undefined,
    startCutS: tStart - rampAtS, a: tHigh - tLow, b: tLow - rampAtS, c: tStart - tHigh,
    startCutM, aM, bM, cM: startCutM - aM - bM,
    endCutS: tExit - tEnd, endCutM: trueDistanceM(phases, tEnd, tExit),
    turns: countDirectionChanges(track, span.start, span.end, params.turnMinDeg),
    turnsFromLow: countDirectionChanges(track, pointAtOrBefore(tLow), span.end, params.turnMinDeg),
    turnsFromRamp: countDirectionChanges(track, pointAtOrBefore(rampAtS), span.end, params.turnMinDeg),
    durationS: tEnd - tStart, distanceM: cum.cumDist[span.end] - cum.cumDist[span.start],
  };
};

/** Une vague molle : attente, rame, rampe de mise en vitesse, plateau, retour, rame et attente. */
const softWave = (o: { paddle?: number; from?: number; peak?: number; rampS?: number; plateauS?: number; downS?: number; turn?: boolean } = {}): SoftRide => {
  const paddle = o.paddle ?? 1.2;
  const from = o.from ?? paddle;
  const peak = o.peak ?? 3;
  const rampS = o.rampS ?? 8;
  const ramp: Phase[] = o.turn
    // Le surfeur se retourne vers le bord en partant : le cap tourne de 180° pendant les 3 premières secondes de la rampe.
    ? [
        { s: 3, speed: from, to: from + ((peak - from) * 3) / rampS, heading: 0, headingTo: 180 },
        { s: rampS - 3, speed: from + ((peak - from) * 3) / rampS, to: peak, heading: 180 },
      ]
    : [{ s: rampS, speed: from, to: peak, heading: 180 }];
  const phases: Phase[] = [
    { s: 20, speed: 0.1 },
    { s: 30, speed: paddle },
    ...ramp,
    { s: o.plateauS ?? 6, speed: peak, heading: 180 },
    { s: o.downS ?? 4, speed: peak, to: 1, heading: 180 },
    { s: 40, speed: 1 },
    { s: 30, speed: 0.1 },
  ];
  return { phases, rampAtS: 50, rampS, foil: false, kind: 'vague' };
};

/** Sur foil : mise en vol de 1,5 à 4 m/s, pompage, vague de 4 à 5,8 m/s, pompage, posé. */
const softFoil = (kind: 'vague' | 'vol'): SoftRide => {
  const phases: Phase[] = [
    { s: 20, speed: 0.1 },
    { s: 30, speed: 1.2 },
    { s: 8, speed: 1.5, to: 4, heading: 180 },
    { s: 6, speed: 4, heading: 180 },
    { s: 6, speed: 4, to: 5.8, heading: 180 },
    { s: 6, speed: 5.8, heading: 180 },
    { s: 4, speed: 5.8, to: 4, heading: 180 },
    { s: 6, speed: 4, heading: 180 },
    { s: 4, speed: 4, to: 1, heading: 180 },
    { s: 40, speed: 1 },
    { s: 30, speed: 0.1 },
  ];
  return { phases, rampAtS: kind === 'vol' ? phaseStartS(phases, 2) : phaseStartS(phases, 4), rampS: kind === 'vol' ? 8 : 6, foil: true, kind };
};

const SOFT_CASES: Record<string, SoftRide> = {
  molle: softWave(),
  lente12s: softWave({ rampS: 12 }),
  breve2s: softWave({ peak: 2.9, plateauS: 1.2 }),
  pagaie: softWave({ paddle: 8 / 3.6 }),
  cap: softWave({ turn: true }),
  foilVol: softFoil('vol'),
  foilVague: softFoil('vague'),
};

/** Cadence variable : un seul pas de 6 s au milieu de la rampe, sur une trace à 1 Hz. */
const sparseRamp = (ride: SoftRide): BuildOptions => {
  const mid = Math.round(ride.rampAtS + ride.rampS / 2);
  return { dropBetweenS: [mid - 3, mid + 3] };
};

type SoftCadence = '1 Hz' | '5 Hz' | 'pas de 6 s';

/** Trace d'un cas à une cadence : 1 Hz, 5 Hz, ou 1 Hz avec un seul pas de 6 s en pleine rampe. */
const cadenceOf = (ride: SoftRide, cadence: SoftCadence, doppler: boolean): [number, BuildOptions] =>
  cadence === '5 Hz' ? [0.2, { doppler }] : [1, cadence === '1 Hz' ? { doppler } : { ...sparseRamp(ride), doppler }];

/**
 * Secondes rognées au début de chaque cas, mesurées sur le calcul d'aujourd'hui :
 * avec Doppler à 1 Hz, 5 Hz et pas de 6 s, puis sans Doppler aux mêmes cadences.
 */
const SOFT_START_CUT_S: Record<string, [number, number, number, number, number, number]> = {
  molle: [7, 7, 1, 7, 7, 7],
  lente12s: [10, 10.4, 10, 11, 10.6, 11],
  breve2s: [7, 7.4, 1, 7, 7.4, 7],
  pagaie: [5, 5.6, 1, 6, 5.8, 1],
  cap: [7, 7, 1, 7, 7, 7],
  foilVol: [4, 4.8, 1, 5, 5, 1],
  foilVague: [4, 4.2, 0, 4, 4.2, 0],
};

/**
 * Part (a), entre la détente basse et la détente haute du masque, et part (b),
 * sous la détente basse, de chaque mise en vitesse, en secondes : elles ne
 * dépendent que de la rampe.
 */
const SOFT_SPLIT_S: Record<string, [number, number]> = {
  molle: [3.7, 3.31],
  lente12s: [5.56, 4.96],
  breve2s: [3.92, 3.5],
  pagaie: [5.71, 0],
  cap: [3.7, 3.31],
  foilVol: [2.67, 2.31],
  foilVague: [2.78, 1.48],
};

/**
 * Départ des vagues molles. Ces attentes décrivent le défaut mesuré sur le
 * calcul d'aujourd'hui, et changeront avec sa correction : une vague commence
 * au franchissement de la détente haute du masque (seuil + 1 km/h) et ne finit
 * qu'au retour sous la détente basse (seuil − 2 km/h). Toute la mise en vitesse
 * est donc rognée au début, de plusieurs secondes, et rien à la fin. Le lissage
 * n'y ajoute pas de retard (médiane centrée sur une rampe monotone) : l'écart
 * qui reste, d'un pas au plus, vient de l'échantillonnage. Un long pas qui
 * finit au-dessus de la détente haute est compté en entier.
 */
describe('départ des vagues molles', () => {
  const cadences: SoftCadence[] = ['1 Hz', '5 Hz', 'pas de 6 s'];

  for (const [name, ride] of Object.entries(SOFT_CASES)) {
    it(`${name} : la mise en vitesse se partage entre (a) et (b)`, () => {
      const m = measureSoftRide(ride, 1);
      const [a, b] = SOFT_SPLIT_S[name];
      expect(m.a).toBeCloseTo(a, 1);
      expect(m.b).toBeCloseTo(b, 1);
    });

    for (const doppler of [true, false]) {
      cadences.forEach((cadence, k) => {
        it(`${name}, ${cadence}, ${doppler ? 'avec' : 'sans'} Doppler : début rogné, fin entière`, () => {
          const [cadenceS, options] = cadenceOf(ride, cadence, doppler);
          const m = measureSoftRide(ride, cadenceS, options);
          expect(m.startCutS).toBeCloseTo(SOFT_START_CUT_S[name][k + (doppler ? 0 : 3)], 1);
          // Rien n'est rogné à la fin : moins d'un demi-pas, de part et d'autre.
          expect(m.endCutS).toBeGreaterThan(-0.2);
          expect(m.endCutS).toBeLessThan(0.4);
          expect(m.endCutM).toBeLessThan(1);
        });
      });
    }
  }

  it('aux cadences régulières, le reste (c) tient dans un pas : le lissage ne retarde pas le départ', () => {
    for (const [name, ride] of Object.entries(SOFT_CASES)) {
      for (const doppler of [true, false]) {
        for (const cadenceS of [1, 0.2]) {
          const m = measureSoftRide(ride, cadenceS, { doppler });
          expect(Math.abs(m.c), name).toBeLessThanOrEqual(cadenceS + 1e-6);
        }
      }
    }
  });

  it('vague molle à 1 Hz : 7 s et 14 m rognés au début, (a) en fait 8,8 m et (b) 5,2 m', () => {
    const m = measureSoftRide(SOFT_CASES.molle, 1);
    expect(m.kept).toBe(true);
    expect(m.startCutM).toBeCloseTo(13.9, 0);
    expect(m.aM).toBeCloseTo(8.75, 1);
    expect(m.bM).toBeCloseTo(5.2, 1);
    expect(m.durationS).toBeCloseTo(9, 1);
  });

  it('une vague qui ne passe 10 km/h que 2 s est écartée, sauf quand un long pas la rallonge avec Doppler', () => {
    const ride = SOFT_CASES.breve2s;
    for (const doppler of [true, false]) {
      for (const cadenceS of [1, 0.2]) {
        const m = measureSoftRide(ride, cadenceS, { doppler });
        expect(m.kept).toBe(false);
        // Écartée par la distance : le passage du masque fait moins de `minWaveM`.
        expect(m.durationS).toBeGreaterThanOrEqual(params.minWaveS);
        expect(m.distanceM).toBeLessThan(params.minWaveM);
      }
    }
    expect(measureSoftRide(ride, 1, sparseRamp(ride)).kept).toBe(true);
    expect(measureSoftRide(ride, 1, { ...sparseRamp(ride), doppler: false }).kept).toBe(false);
  });

  it('un demi-tour au début de la rampe, sous la détente basse, n\'est pas dans la vague', () => {
    const ride = SOFT_CASES.cap;
    for (const cadence of cadences) {
      const [cadenceS, options] = cadenceOf(ride, cadence, true);
      const m = measureSoftRide(ride, cadenceS, options);
      expect(m.turns).toBe(0);
      // Un début remonté à la détente basse ne le compterait pas ; remonté au début de la rampe, si.
      expect(m.turnsFromLow).toBe(0);
      expect(m.turnsFromRamp).toBe(1);
    }
  });
});
