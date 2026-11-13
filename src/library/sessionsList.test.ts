import { describe, expect, it } from 'vitest';
import type { Activity } from '../core/activities';
import { commonDistanceUnit, filterChoices, filterSessions, sessionsTotals, totalsLine } from './sessionsList';

const wing: Activity = { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#003e52' };
const kite: Activity = { id: 'kite', name: 'Kite', base: 'kite', color: '#e6c229' };
const surf: Activity = { id: 'surf', name: 'Surf', base: 'surf', color: '#000000' };
const paddle: Activity = { id: 'a-paddle', name: 'Paddle', base: 'surf', color: '#646464', hidden: true };
/** Calcul d'une activité supprimée : ses sessions restent, sous le nom du calcul. */
const windsurf: Activity = { id: 'windsurf', name: 'Windsurf', base: 'windsurf', color: '#123456' };

const HOUR = 3600_000;
const session = (file: string, activity: Activity | null, km: number, hours: number) => ({
  file,
  activity,
  record: { summary: { startMs: 1_000_000, endMs: 1_000_000 + hours * HOUR, distanceM: km * 1000 } },
});
type Row = ReturnType<typeof session>;
const activityOf = (s: Row) => s.activity;
const isShown = (a: Activity) => !a.hidden;

describe('filterChoices', () => {
  it('toutes les activités montrées, même sans session, puis le calcul des activités supprimées', () => {
    expect(filterChoices([wing, kite, surf], [wing, windsurf, null, windsurf, surf], null).map((a) => a.id))
      .toEqual(['wingfoil', 'kite', 'surf', 'windsurf']);
  });

  it("l'activité choisie par l'adresse, cachée, vient en dernier", () => {
    expect(filterChoices([wing, surf], [wing], paddle).map((a) => a.id)).toEqual(['wingfoil', 'surf', 'a-paddle']);
    expect(filterChoices([wing, surf], [wing], surf).map((a) => a.id)).toEqual(['wingfoil', 'surf']);
  });
});

describe('filterSessions', () => {
  const sessions = [
    session('a', wing, 10, 1), session('b', paddle, 3, 1), session('c', null, 1, 1), session('d', kite, 20, 2), session('e', paddle, 2, 1),
  ];

  it('sans filtre : les sessions des activités montrées, celles des cachées comptées à part, jamais celles à classer', () => {
    const { listed, hidden } = filterSessions(sessions, activityOf, isShown, null);
    expect(listed.map((s) => s.file)).toEqual(['a', 'd']);
    expect(hidden).toBe(2);
  });

  it("filtrée : les sessions de l'activité, même cachée", () => {
    expect(filterSessions(sessions, activityOf, isShown, 'a-paddle')).toEqual({ listed: [sessions[1], sessions[4]], hidden: 0 });
    expect(filterSessions(sessions, activityOf, isShown, 'kite').listed.map((s) => s.file)).toEqual(['d']);
    expect(filterSessions(sessions, activityOf, isShown, 'surf').listed).toEqual([]);
  });
});

describe('sessionsTotals', () => {
  it('additionne distances et durées de session', () => {
    expect(sessionsTotals([session('a', wing, 12.5, 1.5), session('b', kite, 7.5, 0.5)]))
      .toEqual({ count: 2, distanceM: 20_000, durationMs: 2 * HOUR });
  });

  it('ignore une durée négative ou une distance illisible', () => {
    const broken = { record: { summary: { startMs: 5000, endMs: 1000, distanceM: Number.NaN } } };
    expect(sessionsTotals([broken, session('a', wing, 3, 1)])).toEqual({ count: 2, distanceM: 3000, durationMs: HOUR });
  });
});

describe('commonDistanceUnit', () => {
  it("l'unité commune, sinon le kilomètre", () => {
    expect(commonDistanceUnit(['nm', 'nm'])).toBe('nm');
    expect(commonDistanceUnit(['nm', 'km'])).toBe('km');
    expect(commonDistanceUnit([])).toBe('km');
  });
});

/** Espaces des milliers (insécable fine en français) ramenées à une espace simple. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('totalsLine', () => {
  it('toutes les sessions : « sur l\'eau » en fin de ligne', () => {
    expect(plain(totalsLine({ count: 102, distanceM: 2_846_300, durationMs: 187.2 * HOUR }, 'km')))
      .toBe("102 sessions · 2 846 km · 187 h sur l'eau");
  });

  it("filtrée sur une activité : son nom dans la phrase, sans « sur l'eau »", () => {
    expect(plain(totalsLine({ count: 42, distanceM: 1_204_000, durationMs: 61 * HOUR }, 'km', 'Wingfoil')))
      .toBe('42 sessions de wingfoil · 1 204 km · 61 h');
    expect(totalsLine({ count: 1, distanceM: 1852 * 12.34, durationMs: 1.4 * HOUR }, 'nm', 'Optimist'))
      .toBe("1 session d'optimist · 12,3 NM · 1 h 24");
    expect(totalsLine({ count: 2, distanceM: 500, durationMs: 0.75 * HOUR }, 'km', 'SUP')).toBe('2 sessions de SUP · 0,5 km · 45 min');
  });

  it('sans session', () => {
    expect(totalsLine({ count: 0, distanceM: 0, durationMs: 0 }, 'km')).toBe('Aucune session');
    expect(totalsLine({ count: 0, distanceM: 0, durationMs: 0 }, 'km', 'Kite')).toBe('Aucune session de kite');
  });
});
