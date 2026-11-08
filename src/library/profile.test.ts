import { describe, expect, it } from 'vitest';
import { activityShares, favoriteActivity, favoriteFamily } from './profile';
import { statSession } from '../test/record.fixture';

// Dates construites à l'heure locale : les tests ne dépendent pas du fuseau de la machine.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

/** Un paddle (`a-paddle`, famille surf) par défaut. */
const session = statSession;

describe('activityShares', () => {
  it('répartit le temps par activité, de la plus longue à la plus courte', () => {
    const shares = activityShares([
      session(at(2026, 3, 1), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 1) + 3 * 3_600_000 }),
      session(at(2026, 3, 2)),
      session(at(2026, 3, 3), { activityId: 'voile', family: 'voile' }),
      session(at(2026, 3, 4)),
    ], ['voile', 'a-paddle', 'kite']);
    expect(shares.map((s) => s.activityId)).toEqual(['kite', 'a-paddle', 'voile']);
    expect(shares.map((s) => s.share)).toEqual([0.5, 2 / 6, 1 / 6]);
    expect(shares.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1);
    expect(shares[1].totals.sessions).toBe(2);
  });

  it("garde l'ordre des activités à durée égale", () => {
    const shares = activityShares([session(at(2026, 3, 1)), session(at(2026, 3, 2), { activityId: 'voile', family: 'voile' })], ['voile', 'a-paddle']);
    expect(shares.map((s) => s.activityId)).toEqual(['voile', 'a-paddle']);
  });

  it('est vide sans session', () => {
    expect(activityShares([], ['a-paddle'])).toEqual([]);
  });
});

describe('favoriteActivity', () => {
  it('prend l’activité qui a le plus de temps', () => {
    expect(favoriteActivity([
      session(at(2026, 3, 1)),
      session(at(2026, 3, 2), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 2) + 3 * 3_600_000 }),
      session(at(2026, 3, 3)),
      session(at(2026, 3, 4), { activityId: 'voile', family: 'voile' }),
    ], ['a-paddle', 'kite', 'voile'])).toBe('kite');
  });

  it('à durée égale, la plus récemment pratiquée', () => {
    expect(favoriteActivity([
      session(at(2026, 3, 5), { activityId: 'voile', family: 'voile' }),
      session(at(2026, 3, 1)),
    ], ['a-paddle', 'voile'])).toBe('voile');
  });

  it('sans session, aucun', () => {
    expect(favoriteActivity([], ['a-paddle'])).toBeNull();
  });
});

describe('favoriteFamily', () => {
  it('donne la famille du sport préféré, pas celle qui a le plus de temps en tout', () => {
    // Deux activités de voile font plus de temps à elles deux, mais le paddle est l’activité préférée.
    expect(favoriteFamily([
      session(at(2026, 3, 1), { endMs: at(2026, 3, 1) + 2 * 3_600_000 }),
      session(at(2026, 3, 2), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 2) + 1.5 * 3_600_000 }),
      session(at(2026, 3, 3), { activityId: 'a-moth', family: 'voile', endMs: at(2026, 3, 3) + 1.5 * 3_600_000 }),
    ], ['a-paddle', 'kite', 'a-moth'])).toBe('surf');
  });

  it('sans session, aucune', () => {
    expect(favoriteFamily([], ['a-paddle'])).toBeNull();
  });
});
