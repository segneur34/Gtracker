import { describe, expect, it } from 'vitest';
import { activityShares, favoriteActivities, favoriteActivity, favoriteFamily } from './profile';
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

describe('favoriteActivities', () => {
  const HOUR = 3_600_000;
  const order = ['a-paddle', 'kite', 'voile', 'a-moth'];

  it('prend les trois activités qui ont le plus de temps, de la première à la troisième place', () => {
    const top = favoriteActivities([
      session(at(2026, 3, 1), { endMs: at(2026, 3, 1) + HOUR }),
      session(at(2026, 3, 2), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 2) + 3 * HOUR }),
      session(at(2026, 3, 3), { activityId: 'voile', family: 'voile', endMs: at(2026, 3, 3) + 2 * HOUR }),
      session(at(2026, 3, 4), { activityId: 'a-moth', family: 'voile', endMs: at(2026, 3, 4) + 0.5 * HOUR }),
    ], order);
    expect(top.map((s) => s.activityId)).toEqual(['kite', 'voile', 'a-paddle']);
  });

  it('donne les sessions et la distance de chaque activité', () => {
    const top = favoriteActivities([
      session(at(2026, 3, 1), { distanceM: 4000 }),
      session(at(2026, 3, 2), { distanceM: 6000 }),
      session(at(2026, 3, 3), { activityId: 'kite', family: 'voile', distanceM: 9000, endMs: at(2026, 3, 3) + HOUR }),
    ], order);
    expect(top[0].activityId).toBe('a-paddle');
    expect(top[0].totals.sessions).toBe(2);
    expect(top[0].totals.distanceM).toBe(10_000);
  });

  it('à durée égale, celle qui a le plus de sessions, puis la plus récente', () => {
    const half = 0.5 * HOUR;
    // Paddle : deux sessions d'une demi-heure ; kite : une session d'une heure ; voile : une heure, plus récente.
    const top = favoriteActivities([
      session(at(2026, 3, 1), { endMs: at(2026, 3, 1) + half }),
      session(at(2026, 3, 2), { endMs: at(2026, 3, 2) + half }),
      session(at(2026, 3, 3), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 3) + HOUR }),
      session(at(2026, 3, 9), { activityId: 'voile', family: 'voile', endMs: at(2026, 3, 9) + HOUR }),
    ], order);
    expect(top.map((s) => s.activityId)).toEqual(['a-paddle', 'voile', 'kite']);
  });

  it('en montre moins de trois quand il y en a moins, et aucune sans session', () => {
    expect(favoriteActivities([session(at(2026, 3, 1))], order).map((s) => s.activityId)).toEqual(['a-paddle']);
    expect(favoriteActivities([], order)).toEqual([]);
  });

  it("range une activité supprimée sous son calcul, comme l'anneau du temps", () => {
    // Les sessions d'une activité supprimée portent l'identifiant du calcul de base : elles se regroupent avec lui.
    const list = [
      session(at(2026, 3, 1), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 1) + HOUR }),
      session(at(2026, 3, 2), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 2) + HOUR }),
      session(at(2026, 3, 3)),
    ];
    const top = favoriteActivities(list, ['a-paddle']);
    expect(top.map((s) => [s.activityId, s.totals.sessions])).toEqual([['kite', 2], ['a-paddle', 1]]);
    expect(top.map((s) => s.activityId)).toEqual(activityShares(list, ['a-paddle']).map((s) => s.activityId));
  });

  it('première place : celle du sport préféré', () => {
    const list = [
      session(at(2026, 3, 1), { endMs: at(2026, 3, 1) + 2 * HOUR }),
      session(at(2026, 3, 2), { activityId: 'kite', family: 'voile', endMs: at(2026, 3, 2) + 3 * HOUR }),
    ];
    expect(favoriteActivities(list, order)[0].activityId).toBe(favoriteActivity(list, order));
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
