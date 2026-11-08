import { describe, expect, it } from 'vitest';
import { isSessionSort, sortSessions } from './sessionSort';

const session = (name: string, startMs: number, durationMs: number, distanceM: number, maxSpeedMs: number, sport = 'wingfoil') =>
  ({ name, record: { sport, summary: { startMs, endMs: startMs + durationMs, distanceM, maxSpeedMs } } }) as never as { name: string; record: { sport: string; summary: { startMs: number } } } & Parameters<typeof sortSessions>[0][number];

const names = (list: { name: string }[]) => list.map((s) => s.name).join(',');

describe('sortSessions', () => {
  const a = session('a', 1000, 60_000, 5000, 8);
  const b = session('b', 3000, 30_000, 9000, 6);
  const c = session('c', 2000, 90_000, 1000, 12);

  it('récentes : la plus récente d\'abord', () => {
    expect(names(sortSessions([a, b, c], 'recent'))).toBe('b,c,a');
  });
  it('distance, durée et vitesse max : du plus grand au plus petit', () => {
    expect(names(sortSessions([a, b, c], 'distance'))).toBe('b,a,c');
    expect(names(sortSessions([a, b, c], 'duration'))).toBe('c,a,b');
    expect(names(sortSessions([a, b, c], 'maxSpeed'))).toBe('c,a,b');
  });
  it('sans valeur (distance illisible) : en fin de liste, par date', () => {
    const broken = session('n', 4000, 120_000, Number.NaN, Number.NaN);
    expect(names(sortSessions([broken, a, b], 'distance'))).toBe('b,a,n');
  });
  it('surf sans vague (vitesse max 0) : en fin de liste au tri « v. max », par date', () => {
    const old = session('p1', 1500, 60_000, 500, 0);
    const recent = session('p2', 2500, 60_000, 500, 0);
    expect(names(sortSessions([old, a, recent, b], 'maxSpeed'))).toBe('a,b,p2,p1');
  });
  it('égalité : la plus récente d\'abord', () => {
    const x = session('x', 1000, 10_000, 100, 5);
    const y = session('y', 2000, 10_000, 100, 5);
    expect(names(sortSessions([x, y], 'distance'))).toBe('y,x');
  });
  it('ne modifie pas la liste reçue', () => {
    const list = [a, b, c];
    sortSessions(list, 'distance');
    expect(names(list)).toBe('a,b,c');
  });
  it('reconnaît un tri valide', () => {
    expect(isSessionSort('distance')).toBe(true);
    expect(isSessionSort('autre')).toBe(false);
  });
});
