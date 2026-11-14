import { describe, expect, it } from 'vitest';
import { fishCount, schoolPlaces, type FrameCorner, type SchoolLayout } from './fishSchool';
import { WATER_RULES, waterField, waterMaps, waterOutline } from './schoolWater';
import type { Box } from './rootPath';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, r: x + w, b: y + h });
const CORNERS: FrameCorner[] = ['hd', 'bd', 'bg', 'hg'];

/** Profil de synthèse de 390 px : l'en-tête, puis des cadres de hauteurs données, 24 px entre eux. */
const column = (heights: readonly number[]): SchoolLayout => {
  let y = 128;
  const frames = heights.map((h, i) => {
    const f = { box: box(20, y, 350, h), corner: CORNERS[i % 4], trait: 12 };
    y += h + 24;
    return f;
  });
  return {
    zone: { w: 390, h: y + 20 }, corner: { x: 386, y: 6 },
    rigid: [box(18, 0, 84, 100), box(112, 38, 130, 52)],
    frames,
    texts: frames.map((f) => box(f.box.x + 26, f.box.y + 26, 150, 16)),
  };
};

const PAGE = column([170, 360, 300, 420]);
const SMALL = column([200, 220]);
const centre = (b: Box): [number, number] => [(b.x + b.r) / 2, (b.y + b.b) / 2];

describe('waterOutline', () => {
  it('vide sans poisson', () => {
    expect(waterOutline(PAGE, [])).toEqual({ edge: '', tides: [] });
  });

  it('un bord et deux lignes de marée dès le premier poisson', () => {
    const w = waterOutline(PAGE, schoolPlaces(PAGE, 3));
    expect(w.edge.startsWith('M')).toBe(true);
    expect(w.edge.endsWith('Z')).toBe(true);
    expect(w.tides).toHaveLength(WATER_RULES.tides.length);
  });
});

describe('waterField', () => {
  const maps = waterMaps(PAGE);

  it('chaque poisson est dans l’eau, qui le précède', () => {
    const fish = schoolPlaces(PAGE, fishCount(15));
    const field = waterField(maps, fish);
    for (const f of fish) expect(field(f.x, f.y)).toBeLessThan(0);
  });

  it('ne recule jamais d’une session à la suivante', () => {
    const all = schoolPlaces(PAGE, fishCount(51));
    for (const sessions of [1, 5, 15, 30, 50]) {
      const before = waterField(maps, all.slice(0, fishCount(sessions)));
      const after = waterField(maps, all.slice(0, fishCount(sessions + 1)));
      for (let y = 0; y <= PAGE.zone.h; y += 10) {
        for (let x = 0; x <= PAGE.zone.w; x += 10) {
          if (before(x, y) < 0) expect(after(x, y)).toBeLessThan(0);
        }
      }
    }
  });

  it('tant que le banc est dans les marges, le centre des cadres reste sec', () => {
    const fish = schoolPlaces(PAGE, fishCount(30));
    expect(fish.every((f) => f.phase === 1)).toBe(true);
    const field = waterField(maps, fish);
    for (const f of PAGE.frames) expect(field(...centre(f.box)) > 0 || !Number.isFinite(field(...centre(f.box)))).toBe(true);
  });

  it('quand le banc entre dans un cadre, l’eau l’y précède', () => {
    const fish = schoolPlaces(SMALL, 500);
    const inside = fish.filter((f) => f.inFrame);
    expect(inside.length).toBeGreaterThan(0);
    const field = waterField(waterMaps(SMALL), fish);
    for (const f of inside) expect(field(f.x, f.y)).toBeLessThan(0);
  });
});
