import { describe, expect, it } from 'vitest';
import type { Activity } from '../core/activities';
import { activityShares, favoriteActivities, favoriteActivity, favoriteSpot } from './profile';
import { statSessionOf } from './stats';
import { sessionRecord, statSession } from '../test/record.fixture';

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

describe('favoriteSpot', () => {
  it('prend le lieu qui revient le plus, avec son nombre de sessions', () => {
    expect(favoriteSpot([
      session(at(2026, 3, 1), { placeName: 'Carnon' }),
      session(at(2026, 3, 2), { placeName: 'Palavas' }),
      session(at(2026, 3, 3), { placeName: 'Carnon' }),
      session(at(2026, 3, 4), { placeName: 'Palavas-les-Flots' }),
    ])).toEqual({ name: 'Carnon', sessions: 2 });
  });

  it('compte par nom exact : accents et casse séparent deux lieux', () => {
    expect(favoriteSpot([
      session(at(2026, 3, 1), { placeName: 'Étang de Thau' }),
      session(at(2026, 3, 2), { placeName: 'Etang de Thau' }),
      session(at(2026, 3, 3), { placeName: 'étang de Thau' }),
      session(at(2026, 3, 4), { placeName: 'Etang de Thau' }),
    ])).toEqual({ name: 'Etang de Thau', sessions: 2 });
  });

  it('à égalité, prend le lieu de la session la plus récente, dans quelque ordre que viennent les sessions', () => {
    const list = [
      session(at(2026, 3, 5), { placeName: 'Carnon' }),
      session(at(2026, 3, 1), { placeName: 'Palavas' }),
      session(at(2026, 3, 9), { placeName: 'Palavas' }),
      session(at(2026, 3, 2), { placeName: 'Carnon' }),
    ];
    expect(favoriteSpot(list)).toEqual({ name: 'Palavas', sessions: 2 });
    expect(favoriteSpot([...list].reverse())).toEqual({ name: 'Palavas', sessions: 2 });
  });

  it('ignore les sessions sans lieu ou au nom vide', () => {
    expect(favoriteSpot([
      session(at(2026, 3, 1)),
      session(at(2026, 3, 2)),
      session(at(2026, 3, 3), { placeName: '  ' }),
      session(at(2026, 3, 4), { placeName: 'Carnon' }),
    ])).toEqual({ name: 'Carnon', sessions: 1 });
  });

  it('est nul quand aucune session n’a de lieu, ou sans session', () => {
    expect(favoriteSpot([session(at(2026, 3, 1)), session(at(2026, 3, 2), { placeName: '' })])).toBeNull();
    expect(favoriteSpot([])).toBeNull();
  });
});

describe('statSessionOf et le lieu', () => {
  it('porte le nom du lieu de départ, pas celui de l’arrivée', () => {
    const record = sessionRecord({ place: { name: 'Carnon', source: 'carte', lat: 43.5, lon: 3.9, arrival: { name: 'Palavas', source: 'carte', lat: 43.52, lon: 3.93 } } });
    const activity: Activity = { id: 'a-paddle', name: 'Paddle', base: 'surf', color: '#847c6e' };
    expect(statSessionOf('a.json', record, activity).placeName).toBe('Carnon');
    expect(statSessionOf('a.json', sessionRecord(), activity).placeName).toBeNull();
  });
});
