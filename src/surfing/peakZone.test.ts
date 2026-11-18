import { describe, expect, it } from 'vitest';
import { planeProjection } from '../core/geo';
import { computeKinematics } from '../core/kinematics';
import { SPORT_PROFILES } from '../core/sportProfiles';
import type { LatLon, RawTrackPoint, TrackPoint } from '../core/types';
import { ZONE_INSIDE_M, ZONE_MARGIN_M, ZONE_MIN_ASPECT, buildPeakZone, isInZone, peakZoneOutline, zoneEntry, type PeakZone } from './peakZone';
import type { WaveSense } from './waveSense';

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);
const ORIGIN = { lat: 43.4, lon: 3.6 };
/** Plan local du test : x vers l'est, y vers le nord (le large), en mètres. */
const plane = planeProjection(ORIGIN.lat, ORIGIN);
const MAX_GAP_S = SPORT_PROFILES.surf.maxGapS;

interface At {
  t: number;
  x: number;
  y: number;
  segmentStart?: true;
}

/** Trace par positions en mètres et instants en secondes. */
const trackOf = (points: At[]): TrackPoint[] => {
  const raw: RawTrackPoint[] = points.map((p) => ({
    ...plane.from(p), time: new Date(T0 + Math.round(p.t * 1000)), ...(p.segmentStart ? { segmentStart: true as const } : {}),
  }));
  const profile = SPORT_PROFILES.surf;
  return computeKinematics(raw, { medianWindowSeconds: profile.medianWindowSeconds, maxSpeedMs: profile.maxPlausibleSpeedMs });
};

/** Départs posés aux positions données, dix secondes l'un après l'autre, puis un dernier point : la trace et leurs indices. */
const departuresAt = (positions: { x: number; y: number }[]) => {
  const last = positions[positions.length - 1];
  return {
    track: trackOf([...positions.map((p, k) => ({ t: 10 * k, ...p })), { t: 10 * positions.length, x: last.x, y: last.y + 1 }]),
    departures: positions.map((_, k) => k),
  };
};

const senseTo = (directionDeg: number): WaveSense => ({ directionDeg, R: 0.9, samples: 6 });
/** Les vagues déferlent vers le sud, la plage. */
const SOUTH = senseTo(180);

/** Position décalée de `dx`, `dy` mètres. */
const moved = (p: LatLon, dx: number, dy: number): LatLon => {
  const q = plane.to(p);
  return plane.from({ x: q.x + dx, y: q.y + dy });
};

/** Écart signé entre deux caps d'axe (modulo 180°). */
const axisGap = (a: number, b: number): number => ((a - b + 90 + 180) % 180) - 90;

describe('buildPeakZone', () => {
  it('sans départ, pas de zone', () => {
    expect(buildPeakZone(trackOf([{ t: 0, x: 0, y: 0 }, { t: 1, x: 0, y: 1 }]), [], SOUTH)).toBeNull();
  });

  it('en travers du sens des vagues, oblongue, chaque départ dedans avec sa marge', () => {
    // Le pic s'étale d'est en ouest, les vagues vont au sud.
    const { track, departures } = departuresAt([{ x: -30, y: 2 }, { x: -10, y: -3 }, { x: 5, y: 4 }, { x: 30, y: 0 }]);
    const zone = buildPeakZone(track, departures, SOUTH)!;
    expect(zone.orientation).toBe('vagues');
    expect(axisGap(zone.majorAxisDeg, 90)).toBeCloseTo(0, 6);
    expect(zone.semiMajorM).toBeGreaterThanOrEqual(30 + ZONE_MARGIN_M);
    expect(zone.semiMinorM).toBeGreaterThanOrEqual(3.5 + ZONE_MARGIN_M);
    expect(zone.semiMajorM).toBeGreaterThanOrEqual(ZONE_MIN_ASPECT * zone.semiMinorM);
    expect(zone.departures).toEqual(departures);
    expect(zone.insideDepartures).toEqual([]);
    // Un départ bougé de presque la marge, dans tous les sens, reste dans la zone.
    for (const i of departures) {
      for (const [dx, dy] of [[0, 14], [0, -14], [14, 0], [-14, 0], [10, 10], [-10, -10]]) {
        expect(isInZone(zone, moved(track[i], dx, dy))).toBe(true);
      }
    }
    // Les vagues vers l'est : la zone court du nord au sud.
    const east = buildPeakZone(track, departures, senseTo(90))!;
    expect(axisGap(east.majorAxisDeg, 0)).toBeCloseTo(0, 6);
  });

  it('écarte un départ de l\'intérieur, loin vers la plage ; sans sens des vagues, aucun', () => {
    const { track, departures } = departuresAt([
      { x: -20, y: 0 }, { x: 0, y: 3 }, { x: 15, y: -2 }, { x: 25, y: 1 },
      { x: 5, y: -30 }, { x: 0, y: -(ZONE_INSIDE_M + 20) },
    ]);
    const zone = buildPeakZone(track, departures, SOUTH)!;
    expect(zone.insideDepartures).toEqual([5]);
    expect(zone.departures).toEqual([0, 1, 2, 3, 4]);
    expect(isInZone(zone, track[5])).toBe(false);
    expect(isInZone(zone, track[4])).toBe(true);
    // Vers le large, rien n'est écarté : la plage est de l'autre côté.
    const offshore = departuresAt([{ x: -20, y: 0 }, { x: 0, y: 3 }, { x: 15, y: -2 }, { x: 25, y: 1 }, { x: 0, y: 70 }]);
    expect(buildPeakZone(offshore.track, offshore.departures, SOUTH)!.insideDepartures).toEqual([]);
    const blind = buildPeakZone(track, departures, null)!;
    expect(blind.insideDepartures).toEqual([]);
    expect(isInZone(blind, track[5])).toBe(true);
  });

  it('sans sens des vagues : l\'axe principal des départs, sinon un cercle', () => {
    const line = departuresAt([{ x: 0, y: 0 }, { x: 20, y: 21 }, { x: 45, y: 44 }]);
    const zone = buildPeakZone(line.track, line.departures, null)!;
    expect(zone.orientation).toBe('departs');
    expect(Math.abs(axisGap(zone.majorAxisDeg, 45))).toBeLessThan(2);
    for (const i of line.departures) expect(isInZone(zone, line.track[i])).toBe(true);

    const two = departuresAt([{ x: 0, y: 0 }, { x: 40, y: 0 }]);
    const circle = buildPeakZone(two.track, two.departures, null)!;
    expect(circle.orientation).toBe('cercle');
    expect(circle.semiMajorM).toBe(circle.semiMinorM);
    expect(circle.semiMajorM).toBeCloseTo(20 + ZONE_MARGIN_M, 1);
  });

  it('un seul départ : la marge, oblongue en travers des vagues, ronde sans sens', () => {
    const one = departuresAt([{ x: 0, y: 0 }]);
    const zone = buildPeakZone(one.track, one.departures, SOUTH)!;
    expect(zone.semiMinorM).toBeCloseTo(ZONE_MARGIN_M, 6);
    expect(zone.semiMajorM).toBeCloseTo(ZONE_MIN_ASPECT * ZONE_MARGIN_M, 6);
    const round = buildPeakZone(one.track, one.departures, null)!;
    expect(round.orientation).toBe('cercle');
    expect(round.semiMajorM).toBeCloseTo(ZONE_MARGIN_M, 6);
    // Constantes surchargeables.
    const wide = buildPeakZone(one.track, one.departures, SOUTH, { zoneMarginM: 30, zoneMinAspect: 2 })!;
    expect(wide.semiMinorM).toBeCloseTo(30, 6);
    expect(wide.semiMajorM).toBeCloseTo(60, 6);
  });

  it('contour : sur le bord de la zone', () => {
    const { track, departures } = departuresAt([{ x: -30, y: 2 }, { x: -10, y: -3 }, { x: 30, y: 0 }]);
    const zone = buildPeakZone(track, departures, senseTo(200))!;
    const outline = peakZoneOutline(zone, 32);
    expect(outline).toHaveLength(32);
    const local = planeProjection(zone.center.lat, zone.center);
    for (const p of outline) {
      const q = local.to(p);
      expect(isInZone(zone, local.from({ x: q.x * 0.99, y: q.y * 0.99 }))).toBe(true);
      expect(isInZone(zone, local.from({ x: q.x * 1.01, y: q.y * 1.01 }))).toBe(false);
    }
  });
});

describe('zoneEntry', () => {
  // Deux départs à 20 m de part et d'autre du centre, vagues vers le sud : la zone court d'est en ouest.
  const pic = departuresAt([{ x: -20, y: 0 }, { x: 20, y: 0 }]);
  const zone: PeakZone = buildPeakZone(pic.track, pic.departures, SOUTH)!;
  /** Bord sud de la zone, à son demi-petit axe du centre : atteint après `60 − edge` secondes de rame. */
  const edge = zone.semiMinorM;
  const entryS = (track: TrackPoint[], from = 0, to = track.length - 1): number | null => {
    const entry = zoneEntry(track, zone, from, to, MAX_GAP_S);
    return entry === null ? null : (entry.timeMs - T0) / 1000;
  };
  /** Rame vers le nord à 1 m/s, partie de 60 m au sud du centre, aux instants donnés. */
  const paddle = (times: number[]): TrackPoint[] => trackOf(times.map((t) => ({ t, x: 0, y: -60 + t })));
  const range = (to: number, stepS: number): number[] => Array.from({ length: Math.round(to / stepS) + 1 }, (_, k) => k * stepS);

  it('la zone : centrée, la marge gardée au bout du grand axe', () => {
    expect(plane.to(zone.center).x).toBeCloseTo(0, 3);
    expect(plane.to(zone.center).y).toBeCloseTo(0, 3);
    expect(zone.semiMajorM).toBeGreaterThan(20 + ZONE_MARGIN_M);
    expect(zone.semiMinorM).toBeGreaterThan(ZONE_MARGIN_M);
    expect(zone.semiMinorM).toBeLessThan(20);
    // Au bout du grand axe, l'ellipse se resserre : elle grandit pour que la marge y tienne.
    for (const [dx, dy] of [[15, 0], [10, 10], [5, 14], [10, -10]]) expect(isInZone(zone, moved(pic.track[1], dx * 0.99, dy * 0.99))).toBe(true);
  });

  it('entrée au bord, interpolée sur le pas : la même à 1 Hz, à 5 Hz et sur un long pas de 8 s', () => {
    expect(entryS(paddle(range(60, 1)))).toBeCloseTo(60 - edge, 3);
    expect(entryS(paddle(range(60, 0.2)))).toBeCloseTo(60 - edge, 3);
    expect(entryS(paddle([...range(36, 1), 44, 45, 46]))).toBeCloseTo(60 - edge, 3);
    const entry = zoneEntry(paddle(range(60, 1)), zone, 0, 60, MAX_GAP_S)!;
    expect(plane.to(entry).y).toBeCloseTo(-edge, 3);
  });

  it('un seul pas qui traverse toute la zone compte', () => {
    // De 60 m au sud à 60 m au nord en 10 s : le bord sud franchi aux (60 − edge) / 120 du pas.
    const track = trackOf([{ t: 0, x: 0, y: -60 }, { t: 10, x: 0, y: 60 }]);
    expect(entryS(track)).toBeCloseTo((10 * (60 - edge)) / 120, 3);
  });

  it('pas d\'entrée interpolée à travers un trou de la trace ou une pause', () => {
    expect(entryS(trackOf([{ t: 0, x: 0, y: -60 }, { t: 30, x: 0, y: 60 }]))).toBeNull();
    expect(entryS(trackOf([{ t: 0, x: 0, y: -60 }, { t: 30, x: 0, y: 0 }]))).toBe(30);
    expect(entryS(trackOf([{ t: 0, x: 0, y: -60 }, { t: 1, x: 0, y: -59 }, { t: 9, x: 0, y: 60, segmentStart: true }]))).toBeNull();
  });

  it('déjà dans la zone : l\'instant du départ ; à côté de la zone, ou trop tard : aucune entrée', () => {
    const track = paddle(range(60, 1));
    expect(entryS(track, 50)).toBe(50);
    expect(entryS(track, 0, 40)).toBeNull();
    expect(entryS(trackOf(range(60, 1).map((t) => ({ t, x: -60 + 2 * t, y: -20 }))))).toBeNull();
  });
});
