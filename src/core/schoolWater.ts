import { contours, gridDistances, gridOver, MinHeap, readDistance, type Box, type DistanceGrid, type Loop } from './gridDistance';
import { frameWalls, SCHOOL_RULES, smoothNoise, type SchoolFish, type SchoolLayout, type SchoolRules } from './fishSchool';

/**
 * L'eau qui précède le banc de poissons du Profil, pure : une mer très pâle qui entre par le même angle que le banc,
 * suit la même distance (les cadres contournés, leur joint passé sous le trait), avance un peu devant le poisson le
 * plus loin et ne recule jamais. Rend des chemins SVG : le bord ondulé et deux lignes de marée à l'intérieur.
 */

export interface WaterRules {
  /** Pas de la grille, en px. */
  gridPx: number;
  /** Avance du bord sur le poisson le plus loin, en px, plus `sizeLead` fois la longueur de ce poisson. */
  leadPx: number;
  sizeLead: number;
  /** Cadres interdits rentrés de tant de px, tant que le banc est dans les marges : le bord passe sous le trait. */
  insetPx: number;
  /**
   * Murs d'un cadre pour l'eau, sous son trait : rentrés de `wallInsetPx`, épais du trait moins `wallThinPx`, et jamais
   * moins que le pas de la grille, pour qu'aucun pas de l'eau ne les franchisse.
   */
  wallInsetPx: number;
  wallThinPx: number;
  /** Débord de la grille autour de la zone, en px : le bord de l'eau ne se ferme pas dans la page. */
  marginPx: number;
  /** Boucles de moins de points écartées : les flaques d'une ou deux cases. */
  minLoopPoints: number;
  /** Bords et lignes rééchantillonnés tous les tant de px avant d'onduler. */
  resamplePx: number;
  /** Ondulation du bord : amplitude et longueur d'onde, en px. */
  wave: { ampPx: number; lengthPx: number };
  /** Lignes de marée : retrait sous le bord, amplitude, longueur d'onde (px) et phase de leur ondulation. */
  tides: readonly { offsetPx: number; ampPx: number; lengthPx: number; phase: number }[];
  /**
   * Chenal qui rattache au corps de l'eau une flaque détachée où nagent des poissons : demi-largeur, et profondeur sous
   * le col, en px (`connectedWater`).
   */
  bridge: { halfWidthPx: number; depthPx: number };
}

export const WATER_RULES: WaterRules = {
  gridPx: 5,
  leadPx: 26,
  sizeLead: 0.6,
  insetPx: 7,
  wallInsetPx: 2,
  wallThinPx: 4,
  marginPx: 30,
  minLoopPoints: 8,
  resamplePx: 2,
  wave: { ampPx: 2.6, lengthPx: 24 },
  tides: [
    { offsetPx: -12, ampPx: 2, lengthPx: 30, phase: 1.5 },
    { offsetPx: -26, ampPx: 2, lengthPx: 30, phase: 3 },
  ],
  bridge: { halfWidthPx: 10, depthPx: 6 },
};

/** Distances de l'eau d'une page : cadres interdits (marges), puis ouverts par leur ouverture. À garder tant que la page ne change pas. */
export interface WaterMaps {
  margins: DistanceGrid;
  frames: DistanceGrid;
  bounds: Box;
}

const shrink = (b: Box, m: number): Box => ({ x: b.x + m, y: b.y + m, r: b.r - m, b: b.b - m });

export const waterMaps = (layout: SchoolLayout, water: WaterRules = WATER_RULES, rules: SchoolRules = SCHOOL_RULES): WaterMaps => {
  const m = water.marginPx;
  const bounds: Box = { x: -m, y: -m, r: layout.zone.w + m, b: layout.zone.h + m };
  const spec = gridOver(bounds, water.gridPx);
  const inner = layout.frames.map((f) => shrink(f.box, water.insetPx)).filter((b) => b.r > b.x && b.b > b.y);
  const walls = layout.frames.flatMap((f) => frameWalls(f, Math.max(water.gridPx, f.trait - water.wallThinPx), water.wallInsetPx));
  return {
    margins: gridDistances(spec, layout.corner, inner),
    frames: gridDistances(spec, layout.corner, walls, layout.frames.map((f) => ({ box: f.box, cost: rules.frameCost }))),
    bounds,
  };
};

/**
 * Champ de l'eau : négatif dans l'eau, positif ou non fini hors d'elle. Le niveau de chaque carte est la plus grande
 * distance des poissons placés avec elle, plus l'avance ; l'eau est la réunion des deux.
 */
export const waterField = (
  maps: WaterMaps, fish: readonly SchoolFish[], water: WaterRules = WATER_RULES, rules: SchoolRules = SCHOOL_RULES,
): ((x: number, y: number) => number) => {
  const noise = smoothNoise(rules.seed, rules.noiseScalePx, rules.noiseShape);
  const bend = (x: number, y: number): number => 1 + rules.noise * noise(x, y);
  const level = (grid: DistanceGrid, phase: 1 | 2): number => {
    let top = -Infinity;
    for (const f of fish) {
      if (f.phase !== phase) continue;
      const d = readDistance(grid, f.x, f.y);
      if (Number.isFinite(d)) top = Math.max(top, d * bend(f.x, f.y) + f.size * water.sizeLead);
    }
    return top + water.leadPx;
  };
  const l1 = level(maps.margins, 1);
  const l2 = level(maps.frames, 2);
  return (x, y) => {
    const b = bend(x, y);
    const a = l1 > -Infinity ? readDistance(maps.margins, x, y) * b - l1 : Infinity;
    const c = l2 > -Infinity ? readDistance(maps.frames, x, y) * b - l2 : Infinity;
    return Math.min(a, c);
  };
};

/**
 * L'eau d'un seul tenant, lue aux nœuds de la grille des contours (`bounds`, pas `step`). Le bruit du front, qui
 * multiplie la distance, peut faire passer sous le niveau un point plus loin qu'un autre resté au-dessus : l'eau se
 * casserait en flaques détachées au bout du banc, dans un couloir surtout. Chaque poisson est donc relié à l'angle par
 * un chenal qui suit le chemin au col le plus bas, s'il le faut ; puis une flaque qui ne touche pas l'eau de l'angle
 * sèche. Une eau d'un seul tenant, où chaque poisson est sous l'eau d'au moins `bridge.depthPx` sur tout son chemin,
 * n'est pas touchée ; et comme le col baisse autant que le niveau, l'eau ne recule toujours pas d'une session à l'autre.
 */
export const connectedWater = (
  field: (x: number, y: number) => number, bounds: Box, step: number, start: { x: number; y: number },
  fish: readonly SchoolFish[], bridge: WaterRules['bridge'],
): ((x: number, y: number) => number) => {
  const { x0, y0, nx, ny } = gridOver(bounds, step);
  const total = nx * ny;
  const v = new Float64Array(total);
  const free = new Uint8Array(total);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const d = field(x0 + i * step, y0 + j * step);
      v[j * nx + i] = d;
      free[j * nx + i] = Number.isFinite(d) ? 1 : 0;
    }
  }
  const nodeOf = (x: number, y: number): number => {
    const i = Math.max(0, Math.min(nx - 1, Math.round((x - x0) / step)));
    const j = Math.max(0, Math.min(ny - 1, Math.round((y - y0) / step)));
    return j * nx + i;
  };
  const read = (x: number, y: number): number => v[nodeOf(x, y)];
  const origin = nodeOf(start.x, start.y);
  if (!free[origin]) return read;

  // Chemins de moindre col depuis l'angle, par les nœuds libres, voisins en croix (deux nœuds voisins en diagonale
  // peuvent rester séparés au tracé du bord) : la clé d'un nœud est le plus haut point du chemin qui y mène.
  const pass = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const heap = new MinHeap(total);
  pass[origin] = v[origin];
  heap.push(v[origin], origin);
  while (heap.size > 0) {
    const k = heap.pop();
    const key = heap.lastKey;
    if (key > pass[k]) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj] of CROSS) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const kk = jj * nx + ii;
      if (!free[kk]) continue;
      const next = Math.max(key, v[kk]);
      if (next < pass[kk]) {
        pass[kk] = next;
        parent[kk] = k;
        heap.push(next, kk);
      }
    }
  }

  // Chenal de chaque poisson dont le col n'est pas sous l'eau d'au moins `bridge.depthPx` : le long de son chemin, sur
  // `bridge.halfWidthPx`, l'eau monte de ce qu'il faut, nœuds libres seulement. Le col baisse avec le niveau de l'eau,
  // autant qu'elle : le chenal ne fait que s'élargir, puis se fond dans l'eau quand elle le rejoint d'elle-même.
  const lift = new Float64Array(total);
  const reach = Math.ceil(bridge.halfWidthPx / step);
  const lifted = new Uint8Array(total);
  for (const f of fish) {
    const end = nodeOf(f.x, f.y);
    const rise = pass[end] + bridge.depthPx;
    if (!(rise > 0) || !Number.isFinite(rise)) continue;
    for (let k = end; k >= 0; k = parent[k]) {
      if (lifted[k] && lift[k] >= rise) break;
      lifted[k] = 1;
      const pi = k % nx;
      const pj = (k - pi) / nx;
      for (let jj = Math.max(0, pj - reach); jj <= Math.min(ny - 1, pj + reach); jj++) {
        for (let ii = Math.max(0, pi - reach); ii <= Math.min(nx - 1, pi + reach); ii++) {
          const kk = jj * nx + ii;
          if (free[kk] && Math.hypot(ii - pi, jj - pj) * step <= bridge.halfWidthPx) lift[kk] = Math.max(lift[kk], rise);
        }
      }
    }
  }
  for (let k = 0; k < total; k++) if (lift[k] > 0) v[k] -= lift[k];

  // Puis les flaques : celle de l'angle reste, les autres sèchent (celles des poissons y sont désormais rattachées).
  const label = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  if (v[origin] < 0) {
    label[origin] = 1;
    queue[tail++] = origin;
  }
  while (head < tail) {
    const k = queue[head++];
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj] of CROSS) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const kk = jj * nx + ii;
      if (label[kk] || !(v[kk] < 0)) continue;
      label[kk] = 1;
      queue[tail++] = kk;
    }
  }
  for (let k = 0; k < total; k++) if (v[k] < 0 && !label[k]) v[k] = Infinity;
  return read;
};

const CROSS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Lissage de Chaikin d'une boucle fermée. */
const chaikin = (pts: Loop): Loop => pts.flatMap((p, i) => {
  const q = pts[(i + 1) % pts.length];
  return [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]] as Loop;
});

/** Boucle rééchantillonnée tous les `step` px, chaque point décalé selon la normale d'une sinusoïde qui court le long du bord. */
const wavy = (pts: Loop, step: number, amp: number, length: number, phase: number): Loop => {
  const out: Loop = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!l) continue;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    for (let t = 0; t < l; t += step) {
      const k = amp * Math.sin((2 * Math.PI * (s + t)) / length + phase);
      out.push([a[0] + (b[0] - a[0]) * (t / l) + nx * k, a[1] + (b[1] - a[1]) * (t / l) + ny * k]);
    }
    s += l;
  }
  return out;
};

const pathOf = (loops: readonly Loop[]): string =>
  loops.map((loop) => `M${loop.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`).join('');

/** Chemins de l'eau : `edge` (le bord, à remplir en `fill-rule: evenodd` et à tracer) et les lignes de marée ; vides sans poisson. */
export interface WaterOutline {
  edge: string;
  tides: string[];
}

export const waterOutline = (
  layout: SchoolLayout, fish: readonly SchoolFish[], water: WaterRules = WATER_RULES, rules: SchoolRules = SCHOOL_RULES,
  maps: WaterMaps = waterMaps(layout, water, rules),
): WaterOutline => {
  if (fish.length === 0) return { edge: '', tides: [] };
  const field = connectedWater(waterField(maps, fish, water, rules), maps.bounds, water.gridPx, layout.corner, fish, water.bridge);
  const smooth = (offset: number): Loop[] =>
    contours((x, y) => field(x, y) - offset, maps.bounds, water.gridPx).filter((l) => l.length >= water.minLoopPoints).map(chaikin);
  const step = water.resamplePx;
  return {
    edge: pathOf(smooth(0).map((l) => wavy(l, step, water.wave.ampPx, water.wave.lengthPx, 0))),
    tides: water.tides.map((t) => pathOf(smooth(t.offsetPx).map((l) => wavy(l, step, t.ampPx, t.lengthPx, t.phase)))),
  };
};
