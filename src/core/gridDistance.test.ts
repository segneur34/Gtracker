import { describe, expect, it } from 'vitest';
import { contours, distanceSlope, gridDistances, gridOver, readDistance } from './gridDistance';
import type { Box } from './rootPath';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, r: x + w, b: y + h });
const SPEC = gridOver(box(0, 0, 100, 100), 2);

describe('gridDistances', () => {
  it('sans obstacle : la distance à vol d’oiseau, à un pas près', () => {
    const g = gridDistances(SPEC, { x: 10, y: 10 }, []);
    expect(readDistance(g, 10, 10)).toBe(0);
    expect(readDistance(g, 90, 10)).toBeCloseTo(80, 5);
    expect(readDistance(g, 90, 90)).toBeCloseTo(80 * Math.SQRT2, 5);
  });

  it('un mur se contourne, et ses nœuds sont hors d’atteinte', () => {
    const wall = box(48, 0, 4, 80);
    const g = gridDistances(SPEC, { x: 10, y: 10 }, [wall]);
    const around = readDistance(g, 90, 10);
    // Par le bas du mur : deux fois la diagonale de (10, 10) à (50, 82) environ.
    expect(around).toBeGreaterThan(2 * Math.hypot(40, 70));
    expect(around).toBeLessThan(2 * Math.hypot(40, 72) * 1.15);
    expect(readDistance(g, 50, 40)).toBe(Infinity);
    expect(readDistance(g, 200, 10)).toBe(Infinity);
  });

  it('un rectangle lent coûte plus cher à traverser', () => {
    const fast = gridDistances(SPEC, { x: 10, y: 50 }, []);
    const slow = gridDistances(SPEC, { x: 10, y: 50 }, [], [{ box: box(40, 0, 20, 100), cost: 3 }]);
    // Onze nœuds lents (de 40 à 60 px), chaque pas de 2 px y coûte 6 : 44 de plus.
    expect(readDistance(slow, 90, 50) - readDistance(fast, 90, 50)).toBeCloseTo(44, 5);
  });

  it('la pente pointe à l’opposé du départ', () => {
    const g = gridDistances(SPEC, { x: 0, y: 0 }, []);
    const [gx, gy] = distanceSlope(g, 60, 60)!;
    expect(gx).toBeCloseTo(Math.SQRT1_2, 1);
    expect(gy).toBeCloseTo(Math.SQRT1_2, 1);
  });
});

describe('contours', () => {
  it('un disque donne une boucle fermée sur son cercle', () => {
    const loops = contours((x, y) => Math.hypot(x - 50, y - 50) - 30, box(0, 0, 100, 100), 2);
    expect(loops).toHaveLength(1);
    for (const [x, y] of loops[0]) expect(Math.abs(Math.hypot(x - 50, y - 50) - 30)).toBeLessThan(0.5);
  });

  it('un anneau donne deux boucles, un champ sans intérieur aucune', () => {
    const ring = contours((x, y) => Math.abs(Math.hypot(x - 50, y - 50) - 30) - 8, box(0, 0, 100, 100), 2);
    expect(ring).toHaveLength(2);
    expect(contours(() => 1, box(0, 0, 100, 100), 2)).toHaveLength(0);
    expect(contours(() => Infinity, box(0, 0, 100, 100), 2)).toHaveLength(0);
  });
});
