import { describe, expect, it } from 'vitest';
import { fishCount, schoolPlaces, type FrameCorner, type SchoolLayout } from './fishSchool';
import { connectedWater, WATER_RULES, waterField, waterMaps, waterOutline } from './schoolWater';
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

/** Boucles d'un bord (`M x yLx y…Z`). */
const loopsOf = (d: string): [number, number][][] =>
  d.split('M').filter(Boolean).map((s) => s.replace('Z', '').split('L').map((p) => p.split(' ').map(Number) as [number, number]));
const inLoop = ([x, y]: [number, number], loop: readonly [number, number][]): boolean => {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Un grand cadre qui ne laisse à droite qu'un couloir de `gap` px pour descendre vers un second. */
const corridor = (gap: number): SchoolLayout => ({
  zone: { w: 390, h: 900 }, corner: { x: 386, y: 6 },
  rigid: [box(18, 0, 84, 100)],
  frames: [
    { box: box(0, 120, 390 - gap, 300), corner: 'bd', trait: 12 },
    { box: box(20, 440, 350, 300), corner: 'hd', trait: 12 },
  ],
  texts: [],
});

describe('connectedWater', () => {
  it('un couloir étroit : un seul corps d’eau, qui contient tous les poissons', () => {
    for (const gap of [20, 24, 30]) {
      const layout = corridor(gap);
      for (const sessions of [60, 80, 100]) {
        const fish = schoolPlaces(layout, fishCount(sessions));
        const loops = loopsOf(waterOutline(layout, fish).edge);
        const bodies = loops.filter((l, i) => !loops.some((m, k) => k !== i && inLoop(l[0], m)));
        expect(bodies, `${gap} px, ${sessions} sessions`).toHaveLength(1);
        expect(fish.filter((f) => !inLoop([f.x, f.y], bodies[0])), `${gap} px, ${sessions} sessions`).toEqual([]);
      }
    }
  });

  it('ne recule jamais, chenaux compris', () => {
    const layout = corridor(24);
    const maps = waterMaps(layout);
    const all = schoolPlaces(layout, fishCount(110));
    const water = (sessions: number) => {
      const fish = all.slice(0, fishCount(sessions));
      return connectedWater(waterField(maps, fish), maps.bounds, WATER_RULES.gridPx, layout.corner, fish, WATER_RULES.bridge);
    };
    for (let sessions = 60; sessions < 110; sessions++) {
      const before = water(sessions);
      const after = water(sessions + 1);
      for (let y = 0; y <= layout.zone.h; y += WATER_RULES.gridPx) {
        for (let x = 0; x <= layout.zone.w; x += WATER_RULES.gridPx) {
          if (before(x, y) < 0) expect(after(x, y), `${sessions} sessions, ${x}, ${y}`).toBeLessThan(0);
        }
      }
    }
  });

  it('une eau déjà d’un seul tenant n’est pas touchée', () => {
    const maps = waterMaps(PAGE);
    const fish = schoolPlaces(PAGE, fishCount(15));
    const raw = waterField(maps, fish);
    const joined = connectedWater(raw, maps.bounds, WATER_RULES.gridPx, PAGE.corner, fish, WATER_RULES.bridge);
    for (let y = maps.bounds.y; y <= maps.bounds.b; y += WATER_RULES.gridPx) {
      for (let x = maps.bounds.x; x <= maps.bounds.r; x += WATER_RULES.gridPx) {
        const a = raw(x, y);
        expect(Number.isFinite(a) ? a : Infinity).toBe(joined(x, y));
      }
    }
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
