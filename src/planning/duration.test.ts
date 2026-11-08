import { describe, expect, it } from 'vitest';
import { KM_EFFORT_CLIMB_FACTOR, estimateDurationFromProfile, runningDurationS } from './duration';
import { routePoints, routeProfileRows, routeTotals, type PlannedRoute, type RoutePoint } from './route';
import { estimateRouteDurationS } from './routeList';
import { at as geoAt } from '../test/geo.fixture';

/** Itinéraire en ligne droite vers le nord, altitude donnée en fonction de la distance (0,01° ≈ 1 112 m). */
const straightRoute = (km: number, eleAt: (m: number) => number | undefined): PlannedRoute => {
  const points: RoutePoint[] = [];
  const steps = Math.round(km * 10);
  for (let i = 0; i <= steps; i++) {
    const m = (i * km * 1000) / steps;
    points.push({ ...geoAt(0, m), eleM: eleAt(m) });
  }
  return {
    waypoints: [points[0], points[points.length - 1]],
    legs: [{ mode: 'straight', status: 'ready', points }],
  };
};

describe('temps estimé en course (km-effort)', () => {
  it('sur le plat : distance divisée par la vitesse', () => {
    expect(runningDurationS({ distanceM: 10_000, gainM: 0 }, { flatSpeedMs: 10 / 3.6, climbFactor: KM_EFFORT_CLIMB_FACTOR })).toBeCloseTo(3600, 6);
  });

  it('100 m de D+ ajoutent 1 km de plat', () => {
    const flat = runningDurationS({ distanceM: 10_000, gainM: 0 }, { flatSpeedMs: 10 / 3.6, climbFactor: KM_EFFORT_CLIMB_FACTOR });
    const hilly = runningDurationS({ distanceM: 10_000, gainM: 500 }, { flatSpeedMs: 10 / 3.6, climbFactor: KM_EFFORT_CLIMB_FACTOR });
    expect(hilly - flat).toBeCloseTo(5000 / (10 / 3.6), 6);
  });

  it('un D+ inconnu compte pour zéro', () => {
    expect(runningDurationS({ distanceM: 5000, gainM: null }, { flatSpeedMs: 2.5, climbFactor: 10 })).toBeCloseTo(2000, 6);
  });
});

describe('temps estimé d\'un itinéraire', () => {
  it('rien sans réglage (voile) ni sans tracé', () => {
    expect(estimateRouteDurationS(straightRoute(5, () => 100), 3, null)).toBeNull();
    expect(estimateRouteDurationS({ waypoints: [], legs: [] }, 3, { family: 'course', flatSpeedMs: 2.5, climbFactor: 10 })).toBeNull();
  });

  it('course : distance et D+ du tracé, en km-effort', () => {
    // 5 km, 200 m de montée régulière : 7 km-effort à 10 km/h.
    const route = straightRoute(5, (m) => 100 + (m / 5000) * 200);
    const s = estimateRouteDurationS(route, 3, { family: 'course', flatSpeedMs: 10 / 3.6, climbFactor: KM_EFFORT_CLIMB_FACTOR });
    expect(s).not.toBeNull();
    expect(s! / 60).toBeCloseTo(42, 0);
  });

  it('d\'après les totaux et le profil déjà calculés : le même temps', () => {
    const route = straightRoute(10, (m) => 100 + 50 * Math.sin(m / 700));
    const profile = routeProfileRows(routePoints(route));
    const totals = routeTotals(route, 3);
    const settings = { family: 'course' as const, flatSpeedMs: 3, climbFactor: KM_EFFORT_CLIMB_FACTOR };
    expect(estimateDurationFromProfile(totals, profile, settings)).toBe(estimateRouteDurationS(route, 3, settings));
    expect(estimateDurationFromProfile(totals, profile, null)).toBeNull();
  });
});
