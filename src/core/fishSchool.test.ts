import { describe, expect, it } from 'vitest';
import {
  brushCorner, brushDoor, createSchoolPlanner, fishCount, fishShape, fishSize, frameWalls, isSchoolStyle, schoolLayoutKey,
  schoolPlaces, SCHOOL_RULES, SCHOOL_STYLES, sessionOfFish, type FrameCorner, type SchoolFish, type SchoolFrame, type SchoolLayout,
} from './fishSchool';
import { waterOutline } from './schoolWater';
import type { Box } from './rootPath';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, r: x + w, b: y + h });
const CORNERS: FrameCorner[] = ['hd', 'bd', 'bg', 'hg'];

/** Lignes de texte et chiffres d'un cadre : un libellé à gauche, un chiffre à droite, toutes les 40 px. */
const textsOf = (b: Box): Box[] => {
  const out: Box[] = [];
  for (let y = b.y + 26; y + 18 < b.b - 20; y += 40) {
    out.push(box(b.x + 26, y, Math.min(160, (b.r - b.x) * 0.45), 16));
    out.push(box(b.r - 26 - 56, y - 2, 56, 20));
  }
  return out;
};

/** Profil de synthèse : la photo ronde et son bouton, le texte de l'en-tête, puis une colonne de cadres. */
const column = (w: number, heights: readonly number[], corner: (i: number) => FrameCorner | null = (i) => CORNERS[i % 4]): SchoolLayout => {
  const margin = w >= 360 ? 20 : 16;
  const frames: SchoolFrame[] = [];
  let y = 128;
  heights.forEach((hh, i) => {
    frames.push({ box: box(margin, y, w - 2 * margin, hh), corner: corner(i), trait: 12 });
    y += hh + 24;
  });
  return {
    zone: { w, h: y + 20 },
    corner: { x: w - 4, y: 6 },
    rigid: [box(18, 0, 84, 100), box(112, 38, 130, 52)],
    frames,
    texts: frames.flatMap((f) => textsOf(f.box)),
  };
};

const PHONE = column(390, [170, 360, 300, 420, 230]);
const NARROW = column(320, [170, 360, 300, 420, 230]);
const DESKTOP: SchoolLayout = {
  zone: { w: 1180, h: 1100 },
  corner: { x: 1176, y: 6 },
  rigid: [box(18, 0, 84, 100), box(112, 38, 200, 52), box(800, 20, 360, 60)],
  frames: [
    { box: box(20, 128, 740, 220), corner: 'hd', trait: 12 },
    { box: box(20, 372, 740, 380), corner: 'bd', trait: 12 },
    { box: box(20, 776, 740, 300), corner: 'bg', trait: 12 },
    { box: box(784, 128, 376, 948), corner: 'hg', trait: 12 },
  ],
  texts: [],
};
DESKTOP.texts = DESKTOP.frames.flatMap((f) => textsOf(f.box));
/** Petite page vite pleine : les marges saturent, le banc passe dans les cadres. */
const SMALL = column(390, [200, 220]);

/** Rectangle orienté d'un poisson, de demi-côtés `hl` et `hw` en part de sa longueur, contre un rectangle droit (axes séparateurs). */
const fishTouchesBox = (f: SchoolFish, b: Box, hl: number, hw: number): boolean => {
  const a = (f.angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const l = f.size * hl;
  const wd = f.size * hw;
  const cx = (b.x + b.r) / 2 - f.x;
  const cy = (b.y + b.b) / 2 - f.y;
  const bw = (b.r - b.x) / 2;
  const bh = (b.b - b.y) / 2;
  if (Math.abs(cx) >= bw + Math.abs(ux) * l + Math.abs(uy) * wd) return false;
  if (Math.abs(cy) >= bh + Math.abs(uy) * l + Math.abs(ux) * wd) return false;
  if (Math.abs(cx * ux + cy * uy) >= l + Math.abs(ux) * bw + Math.abs(uy) * bh) return false;
  return Math.abs(-cx * uy + cy * ux) < wd + Math.abs(uy) * bw + Math.abs(ux) * bh;
};

/** Coins du rectangle orienté d'un poisson (demi-longueur 0,5, demi-largeur 0,2 de sa longueur). */
const corners = (f: SchoolFish): [number, number][] => {
  const a = (f.angle * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)];
  const v = [-u[1], u[0]];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, t]) =>
    [f.x + u[0] * s * f.size * 0.5 + v[0] * t * f.size * 0.2, f.y + u[1] * s * f.size * 0.5 + v[1] * t * f.size * 0.2] as [number, number]);
};

/** Deux rectangles orientés se recouvrent-ils ? (axes séparateurs) */
const fishOverlap = (p: SchoolFish, q: SchoolFish): boolean => {
  const cp = corners(p);
  const cq = corners(q);
  for (const poly of [cp, cq]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % 4];
      const nx = y1 - y2;
      const ny = x2 - x1;
      const proj = (c: [number, number][]) => c.map(([x, y]) => x * nx + y * ny);
      const a = proj(cp);
      const b = proj(cq);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
  }
  return true;
};

const inside = (b: Box, x: number, y: number): boolean => x > b.x && x < b.r && y > b.y && y < b.b;

describe('fishCount et sessionOfFish', () => {
  it('trois par session jusqu’à 30, deux jusqu’à 40, puis un', () => {
    expect([0, 1, 30, 31, 40, 41, 50, 100].map((n) => fishCount(n))).toEqual([0, 3, 90, 92, 110, 111, 120, 170]);
  });

  it('chaque poisson porte sa session, inverse du compte', () => {
    expect([0, 2, 3, 89, 90, 91, 92, 109, 110, 169].map((i) => sessionOfFish(i))).toEqual([0, 0, 1, 29, 30, 30, 31, 39, 40, 99]);
    for (let n = 0; n <= 120; n++) {
      expect(sessionOfFish(fishCount(n))).toBe(n);
      if (n > 0) expect(sessionOfFish(fishCount(n) - 1)).toBe(n - 1);
    }
  });
});

describe('fishSize et fishShape', () => {
  it('de 10 à 16 px au demi-pixel, surtout des moyens, stables', () => {
    const sizes = Array.from({ length: 400 }, (_, i) => fishSize(i));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(16);
    expect(sizes.every((s) => Number.isInteger(s * 2))).toBe(true);
    const mean = sizes.reduce((s, x) => s + x, 0) / sizes.length;
    expect(mean).toBeGreaterThan(12.5);
    expect(mean).toBeLessThan(13.5);
    expect(sizes.filter((s) => s >= 11.5 && s <= 14.5).length / sizes.length).toBeGreaterThan(0.6);
    expect(fishSize(17)).toBe(sizes[17]);
  });

  it('huit formes, tirées du rang', () => {
    const shapes = Array.from({ length: 200 }, (_, i) => fishShape(i));
    expect(new Set(shapes)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(fishShape(5)).toBe(shapes[5]);
  });

  it('sept styles, Deux arcs parmi eux', () => {
    expect(SCHOOL_STYLES.map((s) => s.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
    expect(isSchoolStyle('P4')).toBe(true);
    expect(isSchoolStyle('P8')).toBe(false);
  });
});

describe('ouverture d’un cadre peint', () => {
  it('l’angle ouvert se lit dans les retournements du trait', () => {
    expect([brushCorner(1, 1), brushCorner(-1, 1), brushCorner(1, -1), brushCorner(-1, -1)]).toEqual(['bd', 'bg', 'hd', 'hg']);
  });

  it('environ 90 px sur un côté de 342 px pour un trait de 12, jamais plus que le côté', () => {
    const door = brushDoor(box(0, 0, 342, 120), 12);
    expect(door.h).toBeCloseTo(48 + (51 / 300) * (342 - 96), 6);
    expect(door.h).toBeGreaterThan(85);
    expect(door.h).toBeLessThan(95);
    expect(door.v).toBeLessThan(door.h);
    expect(brushDoor(box(0, 0, 40, 40), 12).h).toBeLessThanOrEqual(40);
  });

  it('murs partout sauf l’angle ouvert ; un cadre fermé est muré', () => {
    const b = box(20, 100, 342, 200);
    const walled = (walls: Box[], x: number, y: number) => walls.some((w) => x >= w.x && x <= w.r && y >= w.y && y <= w.b);
    const bd = frameWalls({ box: b, corner: 'bd', trait: 12 }, 14);
    expect(walled(bd, b.r - 5, b.b - 5)).toBe(false);
    expect(walled(bd, b.r - 60, b.b - 5)).toBe(false);
    expect(walled(bd, b.r - 120, b.b - 5)).toBe(true);
    expect(walled(bd, b.x + 5, b.y + 5)).toBe(true);
    expect(walled(bd, b.x + 100, b.y + 100)).toBe(false);
    const hg = frameWalls({ box: b, corner: 'hg', trait: 12 }, 14);
    expect(walled(hg, b.x + 5, b.y + 5)).toBe(false);
    expect(walled(hg, b.r - 5, b.b - 5)).toBe(true);
    const shut = frameWalls({ box: b, corner: null, trait: 12 }, 14);
    for (const [x, y] of [[b.x + 5, b.y + 5], [b.r - 5, b.y + 5], [b.x + 5, b.b - 5], [b.r - 5, b.b - 5]]) expect(walled(shut, x, y)).toBe(true);
  });
});

describe('schoolPlaces', () => {
  it('une session de plus ajoute ses poissons sans bouger les autres (390, 320 et 1 180 px)', () => {
    for (const layout of [PHONE, NARROW, DESKTOP]) {
      for (const sessions of [1, 15, 30, 50]) {
        const before = schoolPlaces(layout, fishCount(sessions));
        const after = schoolPlaces(layout, fishCount(sessions + 1));
        expect(before).toHaveLength(fishCount(sessions));
        expect(after.slice(0, before.length)).toEqual(before);
      }
    }
  });

  it('un planificateur prolongé rend la même suite qu’un neuf', () => {
    const planner = createSchoolPlanner(PHONE);
    planner.places(10);
    planner.places(40);
    expect(planner.places(90)).toEqual(schoolPlaces(PHONE, 90));
  });

  it('les premiers poissons partent de l’angle et en sortent', () => {
    const fish = schoolPlaces(PHONE, 6);
    for (const f of fish) {
      expect(Math.hypot(f.x - PHONE.corner.x, f.y - PHONE.corner.y)).toBeLessThan(70);
      // Le cap s'écarte de l'angle : vers la gauche ou le bas.
      const a = (f.angle * Math.PI) / 180;
      expect(Math.cos(a) * (f.x - PHONE.corner.x) + Math.sin(a) * (f.y - PHONE.corner.y)).toBeGreaterThan(0);
    }
  });

  it('aucun poisson sur un texte, un obstacle ou un autre poisson, ni hors de la zone', () => {
    for (const layout of [PHONE, NARROW, SMALL]) {
      const fish = schoolPlaces(layout, 400);
      for (const f of fish) {
        for (const t of [...layout.texts, ...layout.rigid]) expect(fishTouchesBox(f, t, 0.55, 0.3)).toBe(false);
        for (const [x, y] of corners(f)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(layout.zone.w);
          expect(y).toBeLessThanOrEqual(layout.zone.h);
        }
      }
      for (let i = 0; i < fish.length; i++) {
        for (let j = i + 1; j < fish.length; j++) {
          if (Math.abs(fish[i].x - fish[j].x) > 20 || Math.abs(fish[i].y - fish[j].y) > 20) continue;
          expect(fishOverlap(fish[i], fish[j])).toBe(false);
        }
      }
    }
  });

  it('les cadres ne s’ouvrent qu’une fois les marges pleines, par leur ouverture', () => {
    const fish = schoolPlaces(SMALL, 500);
    const first = fish.findIndex((f) => f.phase === 2);
    expect(first).toBeGreaterThan(0);
    expect(fish.slice(0, first).every((f) => f.phase === 1 && !f.inFrame)).toBe(true);
    expect(fish.slice(first).every((f) => f.phase === 2)).toBe(true);
    // Les cadres fermés ne changent rien aux marges : la même suite, jusqu'à la même saturation, puis plus rien.
    const shut: SchoolLayout = { ...SMALL, frames: SMALL.frames.map((f) => ({ ...f, corner: null })) };
    const shutFish = schoolPlaces(shut, 500);
    expect(shutFish.filter((f) => f.phase === 1)).toEqual(fish.slice(0, first));
    expect(shutFish.some((f) => f.inFrame)).toBe(false);
    // Le premier poisson entré dans un cadre est près de son ouverture.
    const firstIn = fish.find((f) => f.inFrame)!;
    const frame = SMALL.frames.find((f) => inside(f.box, firstIn.x, firstIn.y))!;
    const door = brushDoor(frame.box, frame.trait);
    const cx = frame.corner === 'hg' || frame.corner === 'bg' ? frame.box.x : frame.box.r;
    const cy = frame.corner === 'hg' || frame.corner === 'hd' ? frame.box.y : frame.box.b;
    expect(Math.hypot(firstIn.x - cx, firstIn.y - cy)).toBeLessThan(Math.max(door.h, door.v) * 1.5);
    expect(firstIn.size * SCHOOL_RULES.frameOpacity).toBeGreaterThan(0);
  });

  it('un cadre fermé n’est jamais rempli, les autres si', () => {
    const mixed = column(390, [200, 220], (i) => (i === 0 ? null : 'hd'));
    const fish = schoolPlaces(mixed, 600);
    expect(fish.some((f) => inside(mixed.frames[0].box, f.x, f.y))).toBe(false);
    expect(fish.some((f) => inside(mixed.frames[1].box, f.x, f.y))).toBe(true);
  });
});

describe('schoolLayoutKey', () => {
  it('les textes des cadres ne changent que la clé entière', () => {
    const moved: SchoolLayout = { ...PHONE, texts: PHONE.texts.map((t) => ({ ...t, r: t.r + 10 })) };
    expect(schoolLayoutKey(moved, 'margins')).toBe(schoolLayoutKey(PHONE, 'margins'));
    expect(schoolLayoutKey(moved)).not.toBe(schoolLayoutKey(PHONE));
    expect(schoolLayoutKey({ ...PHONE, zone: { w: 391, h: PHONE.zone.h } }, 'margins')).not.toBe(schoolLayoutKey(PHONE, 'margins'));
  });

  it('un chiffre qui change ne déplace pas les poissons des marges', () => {
    const moved: SchoolLayout = { ...SMALL, texts: SMALL.texts.map((t) => ({ ...t, r: t.r + 10 })) };
    const a = schoolPlaces(SMALL, 500).filter((f) => f.phase === 1);
    const b = schoolPlaces(moved, 500).filter((f) => f.phase === 1);
    expect(b).toEqual(a);
  });
});

describe('coût du calcul', () => {
  it('page de 390 × 1 700 px, 170 poissons : places et eau', () => {
    const page = column(390, [170, 330, 300, 420, 260]);
    expect(page.zone.h).toBeGreaterThan(1650);
    const t0 = performance.now();
    const fish = schoolPlaces(page, 170);
    const t1 = performance.now();
    const water = waterOutline(page, fish);
    const t2 = performance.now();
    expect(fish).toHaveLength(170);
    expect(water.edge).not.toBe('');
    console.log(`banc 390 × ${page.zone.h} px, 170 poissons : places ${Math.round(t1 - t0)} ms, eau ${Math.round(t2 - t1)} ms`);
    expect(t2 - t0).toBeLessThan(3000);
  });
});
