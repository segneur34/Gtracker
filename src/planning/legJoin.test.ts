import { describe, expect, it } from 'vitest';
import { joinLegs } from './legJoin';
import type { RouteMode } from './route';

const P = (lat: number, lon: number) => ({ lat, lon });
const leg = (mode: RouteMode, ...points: { lat: number; lon: number }[]) => ({ mode, points });

describe('tronçons mis bout à bout', () => {
  const a = leg('imported', P(0, 0), P(0, 1));
  const b = leg('straight', P(0, 1), P(0, 2));
  const c = leg('imported', P(0, 2), P(0, 3));

  it('sans filtre : un seul trait, jonctions comptées une fois', () => {
    expect(joinLegs([a, b, c])).toEqual([[P(0, 0), P(0, 1), P(0, 2), P(0, 3)]]);
  });

  it('un tronçon écarté coupe la suite en deux traits', () => {
    expect(joinLegs([a, b, c], (l) => l.mode === 'imported')).toEqual([[P(0, 0), P(0, 1)], [P(0, 2), P(0, 3)]]);
  });

  it('sans tronçon : aucun trait', () => {
    expect(joinLegs([])).toEqual([]);
  });

  it('deux tronçons qui ne se touchent pas gardent tous leurs points', () => {
    expect(joinLegs([a, c])).toEqual([[P(0, 0), P(0, 1), P(0, 2), P(0, 3)]]);
  });
});
