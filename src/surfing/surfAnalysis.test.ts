import { describe, expect, it } from 'vitest';
import { computeKinematics } from '../core/kinematics';
import { activeRuns, buildCumulativeTrack, computeActivityMask, thresholdActivityMask } from '../core/sessionStats';
import { SPORT_PROFILES, defaultActiveThresholdOf, getActiveThresholds } from '../core/sportProfiles';
import type { RawTrackPoint, TrackPoint } from '../core/types';
import { fromDisplaySpeed } from '../core/units';
import { summarizeSession } from '../library/summary';
import { analyzeSurf, riseStartOf, summarizeSurf, type RiseOptions, type SurfParams } from './surfAnalysis';
import { countDirectionChanges } from './gpsTurns';
import { runSurfSession, surfProfileOf } from './surfSession';
import { M_PER_DEG_LAT } from '../test/geo.fixture';
import { seededRandom } from '../core/fishSchool';

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
  /** Bruit de la vitesse de l'appareil : tiré uniformément dans ± `noiseMs`, à la graine `seed`. */
  noiseMs?: number;
  seed?: number;
}

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);

const buildSurfSession = (phases: Phase[], cadenceS = 1, options: BuildOptions = {}): TrackPoint[] => {
  const doppler = options.doppler ?? true;
  const drop = options.dropBetweenS;
  const noise = options.noiseMs ?? 0;
  const random = seededRandom(options.seed ?? 1);
  const raw: RawTrackPoint[] = [];
  let lat = 43.4;
  let lon = 3.6;
  let t = 0;
  const push = (speed: number, heading: number) => {
    if (drop && t > drop[0] + 1e-9 && t < drop[1] - 1e-9) return;
    const measured = noise > 0 ? Math.max(0, speed + (random() * 2 - 1) * noise) : speed;
    raw.push({
      lat, lon, time: new Date(T0 + t * 1000),
      ...(doppler ? { speedMs: measured, ...(speed > 0 ? { courseDeg: heading } : {}) } : {}),
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

/** Détente basse du masque au seuil donné, en km/h, en m/s. */
const exitMsAt = (thresholdKmh: number): number => fromDisplaySpeed(getActiveThresholds(SPORT_PROFILES.surf, thresholdKmh).exit, 'kmh');

const params: SurfParams = {
  ...surf, maxGapS: SPORT_PROFILES.surf.maxGapS, maxSpeedWindowS: SPORT_PROFILES.surf.maxSpeedWindowS,
  // Un seul plancher d'arrêt : celui du profil, 2 km/h.
  stillMs: fromDisplaySpeed(SPORT_PROFILES.surf.stillThreshold, 'kmh'),
  rideExitMs: exitMsAt(SPORT_PROFILES.surf.defaultActiveThreshold),
  waveExitMs: null,
};

/** Réglages de l'analyse sans foil, ou sur foil (détentes basses du vol et des vagues). */
const paramsOf = (foil: boolean): SurfParams =>
  foil ? { ...params, rideExitMs: exitMsAt(surf.foilActiveThreshold), waveExitMs: exitMsAt(surf.foilWaveThreshold) } : params;

/** Masque au seuil donné, en km/h, avec l'hystérésis du profil. */
const maskAt = (track: TrackPoint[], thresholdKmh: number): boolean[] => {
  const t = getActiveThresholds(SPORT_PROFILES.surf, thresholdKmh);
  return computeActivityMask(track, {
    enterThresholdMs: fromDisplaySpeed(t.enter, 'kmh'),
    exitThresholdMs: fromDisplaySpeed(t.exit, 'kmh'),
    minStateDurationS: SPORT_PROFILES.surf.minStateDurationS,
  });
};

const analyze = (track: TrackPoint[], foil = false, opts: Partial<SurfParams> = {}) => {
  const cum = buildCumulativeTrack(track);
  const rideMask = maskAt(track, foil ? surf.foilActiveThreshold : SPORT_PROFILES.surf.defaultActiveThreshold);
  const waveMask = foil ? maskAt(track, surf.foilWaveThreshold) : null;
  const analysis = analyzeSurf(track, cum, rideMask, waveMask, { ...paramsOf(foil), ...opts });
  return { analysis, summary: summarizeSurf(track, cum, analysis, params.stillMs) };
};

/**
 * Une matinée : plage, marche, sortie avec deux canards, attente, trois
 * vagues ; la troisième prise en remontant, sans attente. Trois vagues ne
 * disent pas le sens des vagues : la zone du pic suit l'axe de leurs départs.
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

  it('mesure le retour au pic jusqu\'à l\'entrée dans la zone ; sans sens des vagues, aucune vague n\'est de l\'intérieur', () => {
    expect(analysis.waveSense).toBeNull();
    expect(analysis.peakZone!.orientation).toBe('departs');
    expect(analysis.peakZone!.insideDepartures).toEqual([]);
    // 100 s de rame vers le large à 1 m/s jusqu'à l'attente : la zone, étirée sur les départs, est atteinte avant.
    const afterFirst = analysis.returns.find((r) => r.after === 1)!;
    expect(afterFirst.returnS).toBeCloseTo(55, -1);
    expect(afterFirst.entryMs).toBeCloseTo(afterFirst.startMs + afterFirst.returnS! * 1000, 3);
    expect(afterFirst.straightM).toBeCloseTo(afterFirst.returnS!, 0);
    expect(afterFirst.returnSpeedMs).toBeCloseTo(1, 3);
    expect(afterFirst.paddleSpeedMs).toBeCloseTo(1, 1);
    // La troisième vague part dans la zone : la remontée qui la précède y entre, elle n'est plus enchaînée.
    const afterSecond = analysis.returns.find((r) => r.after === 2)!;
    expect(afterSecond.returnS!).toBeGreaterThan(0);
    expect(afterSecond.returnS!).toBeLessThan(40);
    expect(summary.chainedCount).toBe(0);
    expect(summary.avgReturnS).toBeCloseTo((afterFirst.returnS! + afterSecond.returnS!) / 2, 6);
  });

  it('compte la première sortie jusqu\'à la zone, marche comprise, sans s\'arrêter aux canards', () => {
    // Du premier pas (60 s) à l'entrée dans la zone, plus tôt que la première attente (188 s de marche et de rame).
    expect(summary.firstOutS).toBeCloseTo(142, -1);
    expect(summary.firstOutS!).toBeLessThan(60 + 120 + 8);
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
    // Le départ d'une vague tombe à un pas près de la cadence la plus lente, et le bord de la zone du pic le suit.
    expect(Math.abs(fast.avgReturnS! - slow.avgReturnS!)).toBeLessThan(2.5);
    expect(Math.abs(fast.firstOutS! - slow.firstOutS!)).toBeLessThan(2.5);
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

  it('mesure la remontée entre deux vols, jusqu\'à la zone des deux décollages', () => {
    // Deux départs : la zone est un cercle qui les contient, le posé du premier vol est à quelques mètres de son bord.
    expect(analysis.peakZone!.orientation).toBe('cercle');
    const back = analysis.returns.find((r) => r.after === 1)!;
    expect(back.returnS!).toBeGreaterThan(0);
    expect(back.returnS!).toBeLessThan(40);
    expect(back.returnSpeedMs).toBeCloseTo(0.8, 2);
  });

  it('deux vols ne disent pas le sens des vagues : rien n\'est écarté', () => {
    expect(analysis.waveSense).toBeNull();
  });
});

describe('analyzeSurf, sens des vagues et remontées pompées sur foil', () => {
  /**
   * Un vol : sa vague vers le sud (la plage), du pompage, un second passage
   * au-dessus du seuil de vague au cap `second`, du pompage, puis le posé.
   */
  const flight = (waveHeading: number, second: number): Phase[] => [
    { s: 40, speed: 0.8 },
    { s: 30, speed: 0.1 },
    { s: 5, speed: 2, heading: 180 },
    { s: 12, speed: 6.5, heading: waveHeading },
    { s: 10, speed: 4, heading: 90 },
    { s: 12, speed: 6.5, heading: second },
    { s: 10, speed: 4, heading: 90 },
  ];
  /** Cinq vols : les quatre premiers remontent vers le large en pompant (cap 0), le cinquième prend une vague en biais (cap 100). */
  const FIVE: Phase[] = [
    ...flight(200, 0), ...flight(160, 0), ...flight(200, 0), ...flight(160, 0), ...flight(190, 100),
    { s: 40, speed: 0.8 },
  ];
  /** Sens jamais estimé : les chiffres d'avant. */
  const NO_SENSE = { waveSenseMinWaves: Number.POSITIVE_INFINITY };

  const analyzeWith = (phases: Phase[], cadenceS: number, opts = {}) => {
    const track = buildSurfSession(phases, cadenceS);
    const cum = buildCumulativeTrack(track);
    const rideMask = maskAt(track, surf.foilActiveThreshold);
    const waveMask = maskAt(track, surf.foilWaveThreshold);
    return analyzeSurf(track, cum, rideMask, waveMask, { ...paramsOf(true), ...opts });
  };

  for (const cadenceS of [1, 0.2]) {
    it(`sort les remontées pompées des vagues et les compte pompées, vague en biais gardée (pas de ${cadenceS} s)`, () => {
      const before = analyzeWith(FIVE, cadenceS, NO_SENSE);
      const after = analyzeWith(FIVE, cadenceS);
      expect(before.waveSense).toBeNull();
      expect(before.waves).toHaveLength(10);
      expect(Math.abs(after.waveSense!.directionDeg - 180)).toBeLessThan(10);
      expect(after.waveSense!.samples).toBe(5);

      expect(after.flights.map((f) => f.waveCount)).toEqual([1, 1, 1, 1, 2]);
      expect(after.waves.map((w) => w.flight)).toEqual([1, 2, 3, 4, 5, 5]);
      expect(after.waves.map((w) => w.n)).toEqual([1, 2, 3, 4, 5, 6]);
      // La remontée reste dans le vol : sa durée passe du temps des vagues au temps pompé.
      after.flights.forEach((f, k) => {
        const b = before.flights[k];
        expect(f.durationS).toBe(b.durationS);
        expect(f.waveS + f.pumpS).toBeCloseTo(f.durationS, 6);
        if (k < 4) expect(f.pumpS - b.pumpS).toBeCloseTo(b.waveS - f.waveS, 6);
        if (k < 4) expect(b.waveS - f.waveS).toBeGreaterThan(10);
      });
      expect(after.flights[4]).toEqual(before.flights[4]);
      expect(after.phases).toEqual(before.phases);
      // Rame et attente inchangées ; le retour, et la première sortie, suivent la zone, que le sens oriente.
      const paddling = (rs: typeof after.returns) => rs.filter((r) => r.after > 0).map(({ after: n, startMs, endMs, paddleS, paddleDistanceM, waitS }) => ({ n, startMs, endMs, paddleS, paddleDistanceM, waitS }));
      expect(paddling(after.returns)).toEqual(paddling(before.returns));
      expect(after.peakZone!.orientation).toBe('vagues');
    });
  }

  it('sans sens estimable (trois vols), rien n\'est écarté', () => {
    const three: Phase[] = [...flight(200, 0), ...flight(160, 0), ...flight(200, 0), { s: 40, speed: 0.8 }];
    const after = analyzeWith(three, 1);
    expect(after.waveSense).toBeNull();
    expect(after).toEqual(analyzeWith(three, 1, NO_SENSE));
    expect(after.waves).toHaveLength(6);
  });

  it('sans foil, le sens se mesure sur les vagues sans en écarter aucune', () => {
    expect(analyze(buildSurfSession(MORNING)).analysis.waveSense).toBeNull();
    const wave = (heading: number): Phase[] => [
      { s: 40, speed: 1 }, { s: 30, speed: 0.1 }, { s: 5, speed: 1.6, heading }, { s: 12, speed: 5, heading },
    ];
    const six = [200, 160, 200, 160, 190, 0].flatMap(wave);
    const { analysis } = analyze(buildSurfSession([...six, { s: 40, speed: 1 }]));
    expect(Math.abs(analysis.waveSense!.directionDeg - 180)).toBeLessThan(10);
    expect(analysis.waves).toHaveLength(6);
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
  /**
   * Rogné au début, en secondes, depuis le début vrai de la rampe : en tout ;
   * puis, de la mise en vitesse, (a) la part entre les deux détentes, (b) la part
   * sous la détente basse.
   */
  startCutS: number;
  a: number;
  b: number;
  /** Début de la vague moins l'instant vrai où la vitesse atteint la détente basse, en secondes. */
  fromLowS: number;
  startCutM: number;
  aM: number;
  bM: number;
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
    startCutS: tStart - rampAtS, a: tHigh - tLow, b: tLow - rampAtS, fromLowS: tStart - tLow,
    startCutM, aM, bM,
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
 * Secondes rognées au début de chaque cas, depuis le début vrai de la rampe :
 * avec Doppler à 1 Hz, 5 Hz et pas de 6 s, puis sans Doppler aux mêmes
 * cadences. Sans le recul du début, la vague molle en perdait 7 à chaque
 * cadence sans Doppler, la planche à pagaie 5 à 6, le vol 4 à 5.
 */
const SOFT_START_CUT_S: Record<string, [number, number, number, number, number, number]> = {
  molle: [3, 3.2, 1, 3, 3.4, 1],
  lente12s: [4, 4.8, 3, 5, 5, 3],
  breve2s: [3, 3.4, 1, 4, 3.6, 1],
  pagaie: [1, 1.2, 1, 1, 1.2, 1],
  cap: [3, 3.2, 1, 3, 3.4, 1],
  foilVol: [2, 2.2, 1, 2, 2.4, 1],
  foilVague: [1, 1.4, 0, 1, 1.4, 0],
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
 * Départ des vagues molles. Le masque entre en glisse à sa détente haute
 * (seuil + 1 km/h) et n'en sort qu'à sa détente basse (seuil − 2 km/h) ; le
 * début d'une glisse remonte ensuite à la détente basse tant que la vitesse
 * monte (`riseStartOf`). La part (a) de la mise en vitesse, entre les deux
 * détentes, est donc dans la vague, comme la même plage de vitesse l'est à la
 * fin ; la part (b), sous la détente basse, reste de la rame de départ. La fin
 * ne bouge pas. Le lissage n'ajoute aucun retard (médiane centrée sur une rampe
 * monotone). Un long pas dont le point d'arrivée dépasse la détente basse est
 * compté en entier, avec ou sans Doppler.
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
        it(`${name}, ${cadence}, ${doppler ? 'avec' : 'sans'} Doppler : début à la détente basse, fin entière`, () => {
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

  it('aux cadences régulières, le début tombe à la détente basse à un pas près, sur la rampe de la planche à pagaie sans avaler la rame plate', () => {
    for (const [name, ride] of Object.entries(SOFT_CASES)) {
      for (const doppler of [true, false]) {
        for (const cadenceS of [1, 0.2]) {
          const m = measureSoftRide(ride, cadenceS, { doppler });
          if (name === 'pagaie') {
            // Rame plate au-dessus de la détente basse : le recul s'arrête au début de la rampe, moins de 5 % de gain en 4 s près.
            expect(m.startCutS, name).toBeGreaterThanOrEqual(0);
            expect(m.startCutS, name).toBeLessThanOrEqual(1.2 + 1e-6);
          } else expect(Math.abs(m.fromLowS), name).toBeLessThanOrEqual(cadenceS + 1e-6);
        }
      }
    }
  });

  it('vague molle à 1 Hz : (a) rendue à la vague, (b) reste de la rame de départ', () => {
    const m = measureSoftRide(SOFT_CASES.molle, 1);
    expect(m.kept).toBe(true);
    expect(m.aM).toBeCloseTo(8.75, 1);
    expect(m.bM).toBeCloseTo(5.2, 1);
    // 3 s et 4,6 m rognés au début (7 s et 13,9 m sans le recul) : moins que (b), le pas qui franchit la détente basse étant compté.
    expect(m.startCutS).toBeCloseTo(3, 1);
    expect(m.startCutM).toBeCloseTo(4.6, 1);
    expect(m.startCutM).toBeLessThan(m.bM);
    expect(m.durationS).toBeCloseTo(13, 1);
  });

  it('une vague qui ne passe 10 km/h que 2 s est comptée, à toute cadence, avec ou sans Doppler', () => {
    const ride = SOFT_CASES.breve2s;
    for (const doppler of [true, false]) {
      for (const cadence of cadences) {
        const [cadenceS, options] = cadenceOf(ride, cadence, doppler);
        const m = measureSoftRide(ride, cadenceS, options);
        expect(m.kept).toBe(true);
        expect(m.distanceM).toBeGreaterThanOrEqual(params.minWaveM);
      }
    }
  });

  it('un demi-tour au début de la rampe, sous la détente basse, n\'est pas dans la vague', () => {
    const ride = SOFT_CASES.cap;
    for (const cadence of cadences) {
      const [cadenceS, options] = cadenceOf(ride, cadence, true);
      const m = measureSoftRide(ride, cadenceS, options);
      expect(m.turns).toBe(0);
      // Le début remonté à la détente basse ne le compte pas ; remonté au début de la rampe, il le compterait.
      expect(m.turnsFromLow).toBe(0);
      expect(m.turnsFromRamp).toBe(1);
    }
  });

  it('le recul du début n\'ajoute aucun virage GPS, dans aucun cas', () => {
    for (const [name, ride] of Object.entries(SOFT_CASES)) {
      for (const doppler of [true, false]) {
        for (const cadence of cadences) {
          const [cadenceS, options] = cadenceOf(ride, cadence, doppler);
          expect(measureSoftRide(ride, cadenceS, options).turns, name).toBe(0);
        }
      }
    }
  });
});

/**
 * Début du passage mesuré d'un cas, en secondes depuis le début vrai de sa
 * rampe, avec ces constantes du recul ; `null` si aucun passage n'est gardé.
 */
const softCutS = (ride: SoftRide, cadenceS: number, options: BuildOptions = {}, rise: RiseOptions = {}): number | null => {
  const track = buildSurfSession(ride.phases, cadenceS, options);
  const cum = buildCumulativeTrack(track);
  const rideMask = maskAt(track, ride.foil ? surf.foilActiveThreshold : SPORT_PROFILES.surf.defaultActiveThreshold);
  const waveMask = ride.foil ? maskAt(track, surf.foilWaveThreshold) : null;
  const a = analyzeSurf(track, cum, rideMask, waveMask, { ...paramsOf(ride.foil), ...rise });
  const spans = ride.kind === 'vol' ? a.flights : a.waves;
  const tEnd = ride.rampAtS + ride.rampS + 20;
  const f = spans.find((w) => (w.startMs - T0) / 1000 < tEnd && (w.endMs - T0) / 1000 > ride.rampAtS);
  return f ? (f.startMs - T0) / 1000 - ride.rampAtS : null;
};

/** Point de la trace à cet instant, en secondes depuis le premier point. */
const indexAtS = (track: TrackPoint[], s: number): number => track.findIndex((p) => Math.abs((p.timeMs - T0) / 1000 - s) < 1e-6);

describe('recul du début d\'une glisse : bruit, constantes et bornes', () => {
  it('vitesse bruitée (± 0,15 m/s, trente graines), à 1 Hz et 5 Hz : début à la détente basse, rame plate de la planche à pagaie gardée', () => {
    for (const name of ['molle', 'lente12s', 'pagaie', 'foilVol', 'foilVague']) {
      const ride = SOFT_CASES[name];
      const [, b] = SOFT_SPLIT_S[name];
      for (let seed = 1; seed <= 30; seed++) {
        for (const cadenceS of [1, 0.2]) {
          const cut = softCutS(ride, cadenceS, { noiseMs: 0.15, seed });
          const label = `${name}, graine ${seed}, ${cadenceS} s`;
          expect(cut, label).not.toBeNull();
          if (name === 'pagaie') {
            // Une seconde de rame plate avalée au pire, jamais plus.
            expect(cut!, label).toBeGreaterThanOrEqual(-1);
            expect(cut!, label).toBeLessThanOrEqual(3);
          } else expect(Math.abs(cut! - b), label).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  for (const cadenceS of [1, 0.2]) {
    it(`à ${1 / cadenceS} Hz, les constantes passent en option : sans montée admise, le début d'avant ; recul plafonné en secondes ; fenêtre courte`, () => {
      const molle = SOFT_CASES.molle;
      expect(softCutS(molle, cadenceS, {}, { riseMaxRatio: 0 })).toBeCloseTo(7, 1);
      expect(softCutS(molle, cadenceS, {}, { maxRiseS: 2 })).toBeCloseTo(5, 1);
      // Sur la rampe lente de la planche à pagaie, une seconde ne gagne pas 5 % : le recul s'arrête aussitôt.
      expect(softCutS(SOFT_CASES.pagaie, cadenceS, {}, { riseWindowS: 1 })).toBeGreaterThanOrEqual(5);
    });

    it(`à ${1 / cadenceS} Hz, riseStartOf ne part jamais avant le point plancher, ni à travers une reprise de pause ou un trou`, () => {
      const track = buildSurfSession(SOFT_CASES.molle.phases, cadenceS);
      const run = activeRuns(track, maskAt(track, SPORT_PROFILES.surf.defaultActiveThreshold))[0];
      const low = params.rideExitMs;
      // Détente basse atteinte à 53,3 s : le pas qui la franchit est compté.
      expect(riseStartOf(track, run.start, 0, low, params)).toBe(indexAtS(track, cadenceS === 1 ? 53 : 53.2));
      expect(riseStartOf(track, run.start, indexAtS(track, 55), low, params)).toBe(indexAtS(track, 55));
      const paused = track.map((p, k) => (k === indexAtS(track, 55) ? { ...p, segmentStart: true as const } : p));
      expect(riseStartOf(paused, run.start, 0, low, params)).toBe(indexAtS(track, 55));
      // Aucun point de 44 à 56 s : un trou de 12 s, plus long que `maxGapS`.
      const holed = buildSurfSession(SOFT_CASES.molle.phases, cadenceS, { dropBetweenS: [44, 56] });
      const holedRun = activeRuns(holed, maskAt(holed, SPORT_PROFILES.surf.defaultActiveThreshold))[0];
      expect(riseStartOf(holed, holedRun.start, 0, low, params)).toBe(indexAtS(holed, 56));
    });
  }
});

describe('analyzeSurf, zone du pic et retour au pic', () => {
  /** Une vague : la rame de départ vers la plage (le sud), puis la glisse au cap donné, gauche ou droite. */
  const ride = (heading: number): Phase[] => [{ s: 5, speed: 1.6, heading: 180 }, { s: 12, speed: 5, heading }];
  /** Après une vague, la rame vers le large qui ramène au pic (61 m à 1 m/s), puis l'attente. */
  const backToPeak: Phase[] = [{ s: 61, speed: 1 }, { s: 30, speed: 0.1 }];
  /**
   * Une session au pic : 100 m de rame depuis la plage, quatre vagues, gauches
   * et droites, chacune suivie du retour au pic ; puis, après 10 m de rame
   * seulement, une vague de l'intérieur, environ 55 m vers la plage.
   */
  const PEAK: Phase[] = [
    { s: 30, speed: 0 }, { s: 100, speed: 1 }, { s: 30, speed: 0.1 }, ...ride(200),
    ...backToPeak, ...ride(160), ...backToPeak, ...ride(200), ...backToPeak, ...ride(160),
    { s: 10, speed: 1 }, ...ride(200),
    { s: 40, speed: 1 }, { s: 30, speed: 0.1 },
  ];

  for (const cadenceS of [1, 0.2, 4]) {
    it(`zone en travers des vagues, vague de l'intérieur écartée ; retour jusqu'à l'entrée dans la zone (pas de ${cadenceS} s)`, () => {
      const { analysis, summary } = analyze(buildSurfSession(PEAK, cadenceS));
      const zone = analysis.peakZone!;
      expect(analysis.waves).toHaveLength(5);
      expect(Math.abs(analysis.waveSense!.directionDeg - 180)).toBeLessThan(10);
      expect(zone.orientation).toBe('vagues');
      expect(Math.abs(zone.majorAxisDeg - 90)).toBeLessThan(10);
      expect(zone.semiMajorM).toBeGreaterThan(zone.semiMinorM);
      expect(zone.departures).toEqual(analysis.waves.slice(0, 4).map((w) => w.start));
      expect(zone.insideDepartures).toEqual([analysis.waves[4].start]);

      // Rame à 1 m/s : la zone est atteinte avant le pic, une vingtaine de mètres avant l'attente.
      const measured = analysis.returns.filter((r) => r.after > 0 && r.returnS !== null);
      expect(measured.map((r) => r.after)).toEqual([1, 2, 3]);
      for (const r of measured) {
        expect(r.returnS!).toBeGreaterThan(30);
        expect(r.returnS!).toBeLessThan(50);
        expect(r.entryMs).toBeCloseTo(r.startMs + r.returnS! * 1000, 3);
        expect(r.returnSpeedMs).toBeCloseTo(1, 2);
        // L'attente reste l'immobilité, mesurée à part.
        expect(r.waitS).toBeCloseTo(30, 0);
      }
      // La vague de l'intérieur, prise sans être rentré dans la zone : enchaînée, hors de la moyenne.
      const chained = analysis.returns.find((r) => r.after === 4)!;
      expect(chained.returnS).toBeNull();
      expect(chained.entryMs).toBeNull();
      expect(chained.straightM).toBeNull();
      expect(summary.chainedCount).toBe(1);
      expect(summary.avgReturnS).toBeCloseTo(measured.reduce((s, r) => s + r.returnS!, 0) / 3, 6);

      // Première sortie : du premier coup de rame (30 s) à l'entrée dans la zone, avant les 100 m jusqu'au pic.
      const first = analysis.returns[0];
      expect(first.after).toBe(0);
      expect(summary.firstOutS!).toBeGreaterThan(70);
      expect(summary.firstOutS!).toBeLessThan(100);
      const firstMoveS = (first.entryMs! - summary.firstOutS! * 1000 - T0) / 1000;
      expect(Math.abs(firstMoveS - 30)).toBeLessThanOrEqual(cadenceS);
    });
  }

  it('les mêmes retours à 1 Hz, à 5 Hz et à 4 s', () => {
    const slow = analyze(buildSurfSession(PEAK, 1)).summary;
    for (const cadenceS of [0.2, 4]) {
      const other = analyze(buildSurfSession(PEAK, cadenceS)).summary;
      expect(other.chainedCount).toBe(slow.chainedCount);
      expect(Math.abs(other.avgReturnS! - slow.avgReturnS!)).toBeLessThan(2.5);
      expect(Math.abs(other.firstOutS! - slow.firstOutS!)).toBeLessThan(2.5);
    }
  });

  it('une glisse finie dans la zone : retour nul, compté, sans vitesse de remontée', () => {
    // Une marge de 70 m : chaque vague finit dans la zone, la vague de l'intérieur aussi.
    const { analysis, summary } = analyze(buildSurfSession(PEAK), false, { zoneMarginM: 70 });
    const after = analysis.returns.filter((r) => r.after > 0);
    expect(after).toHaveLength(4);
    for (const r of after) {
      expect(r.returnS).toBe(0);
      expect(r.straightM).toBe(0);
      expect(r.returnSpeedMs).toBeNull();
    }
    expect(summary.avgReturnS).toBe(0);
    expect(summary.bestReturnS).toBe(0);
    expect(summary.chainedCount).toBe(0);
  });

  it('partie de la zone même, la première sortie n\'est pas mesurée ; sans glisse, ni zone ni retour', () => {
    const atPeak: Phase[] = [{ s: 30, speed: 0 }, { s: 5, speed: 1 }, { s: 30, speed: 0.1 }, ...PEAK.slice(3)];
    const started = analyze(buildSurfSession(atPeak));
    expect(started.analysis.peakZone).not.toBeNull();
    expect(started.analysis.returns[0].after).toBe(1);
    expect(started.summary.firstOutS).toBeNull();

    const still = analyze(buildSurfSession([{ s: 30, speed: 0 }, { s: 100, speed: 1 }, { s: 60, speed: 0.1 }]));
    expect(still.analysis.peakZone).toBeNull();
    expect(still.analysis.returns).toEqual([]);
    expect(still.summary.firstOutS).toBeNull();
  });
});
