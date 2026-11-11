import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITIES, SURF_ACTIVITY, SURF_FOIL_ACTIVITY } from '../core/activities';
import { presetOf } from './activityPresets';
import { SPORT_PROFILES } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import { knotsToMs } from '../core/units';

describe('presetOf', () => {
  it('une activité créée sur le wingfoil ou la planche reprend les 8 nœuds', () => {
    for (const base of ['wingfoil', 'windsurf'] as const) {
      const p = presetOf({ id: `a-${base}-2`, base });
      expect(p.threshold).toBe(8);
      expect(p.speedRangeMs?.minMs).toBeCloseTo(knotsToMs(8), 9);
    }
  });

  it("virages mesurés d'office pour Surf et Surf foil, pas pour une activité créée en surf (lot 40)", () => {
    expect(presetOf(SURF_ACTIVITY).turns).toBe(true);
    expect(presetOf(SURF_FOIL_ACTIVITY).turns).toBe(true);
    expect(presetOf({ id: 'a-paddle', base: 'surf' }).turns).toBeUndefined();
  });

  it('un calcul sans pré-réglage rend un objet vide, toujours le même', () => {
    const a = presetOf({ id: 'a-surf-2', base: 'surf' });
    expect(a).toEqual({});
    expect(presetOf({ id: 'autre', base: 'surf' })).toBe(a);
    expect(presetOf({ id: 'a-bateau', base: 'bateau' })).toBe(a);
  });

  it("sauts mesurés d'office en voile (wing, planche, kite), pas ailleurs (05/11)", () => {
    for (const base of ['wingfoil', 'windsurf', 'kite'] as const) {
      expect(presetOf({ id: `a-${base}-2`, base }).jumps?.enabled).toBe(true);
    }
    expect(presetOf({ id: 'a-kite', base: 'kite' }).jumps).toEqual({ enabled: true, placement: 'poitrine', minHeightM: 1 });
    for (const activity of DEFAULT_ACTIVITIES.filter((a) => a.base !== 'wingfoil')) {
      expect(presetOf(activity).jumps?.enabled ?? false).toBe(false);
    }
  });

  it('chaque pré-réglage de calcul porte des bornes de couleur croissantes', () => {
    for (const base of Object.keys(SPORT_PROFILES) as SportType[]) {
      const p = presetOf({ id: `test-${base}`, base });
      if (p.speedRangeMs) expect(p.speedRangeMs.minMs).toBeLessThan(p.speedRangeMs.maxMs);
      if (p.autoPause) expect(p.autoPause.delayS).toBeGreaterThan(0);
    }
  });

  it('toutes les activités de départ rendent un pré-réglage sans surprise', () => {
    for (const activity of DEFAULT_ACTIVITIES) expect(() => presetOf(activity)).not.toThrow();
  });
});
