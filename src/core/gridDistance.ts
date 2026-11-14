import type { Box } from './rootPath';

/**
 * Distances sur une grille de pixels, pures : le plus court chemin d'un point de départ à chaque nœud, en contournant
 * des rectangles interdits et en payant plus cher le passage dans des rectangles lents (Dijkstra à huit voisins, tas
 * en tableaux typés), puis les lignes de niveau d'un champ (carrés marchants). Sert au banc de poissons du Profil
 * (`core/fishSchool.ts`) et à son eau (`core/schoolWater.ts`).
 */

/** Grille : coin haut gauche, pas, nombre de nœuds par ligne et par colonne. Le nœud (i, j) est en (x0 + i·step, y0 + j·step). */
export interface GridSpec {
  x0: number;
  y0: number;
  step: number;
  nx: number;
  ny: number;
}

/** Rectangle lent : un pas qui entre dans l'un de ses nœuds coûte `cost` fois sa longueur. */
export interface SlowBox {
  box: Box;
  cost: number;
}

export interface DistanceGrid {
  spec: GridSpec;
  /** 1 : nœud libre, 0 : interdit. */
  free: Uint8Array;
  /** Distance au départ, `Infinity` si le nœud est interdit ou hors d'atteinte. */
  dist: Float64Array;
}

/** Grille qui couvre le rectangle `bounds` au pas `step` (nœuds sur les deux bords). */
export const gridOver = (bounds: Box, step: number): GridSpec => ({
  x0: bounds.x,
  y0: bounds.y,
  step,
  nx: Math.ceil((bounds.r - bounds.x) / step) + 1,
  ny: Math.ceil((bounds.b - bounds.y) / step) + 1,
});

/** Applique `paint(k)` à chaque nœud situé dans `box`, bords compris. */
export const forNodesIn = (spec: GridSpec, box: Box, paint: (k: number) => void): void => {
  const { x0, y0, step, nx, ny } = spec;
  const i0 = Math.max(0, Math.ceil((box.x - x0) / step));
  const i1 = Math.min(nx - 1, Math.floor((box.r - x0) / step));
  const j0 = Math.max(0, Math.ceil((box.y - y0) / step));
  const j1 = Math.min(ny - 1, Math.floor((box.b - y0) / step));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) paint(j * nx + i);
};

/** Tas binaire minimal sur des paires (clé, nœud), en tableaux typés qui s'agrandissent. */
export class MinHeap {
  private keys: Float64Array;
  private nodes: Int32Array;
  size = 0;

  constructor(capacity: number) {
    this.keys = new Float64Array(Math.max(16, capacity));
    this.nodes = new Int32Array(Math.max(16, capacity));
  }

  push(key: number, node: number): void {
    if (this.size === this.keys.length) {
      const keys = new Float64Array(this.size * 2);
      const nodes = new Int32Array(this.size * 2);
      keys.set(this.keys);
      nodes.set(this.nodes);
      this.keys = keys;
      this.nodes = nodes;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.nodes[i] = this.nodes[p];
      i = p;
    }
    this.keys[i] = key;
    this.nodes[i] = node;
  }

  /** Retire la plus petite clé ; rend son nœud, sa clé dans `lastKey`. */
  lastKey = 0;
  pop(): number {
    const top = this.nodes[0];
    this.lastKey = this.keys[0];
    const n = --this.size;
    if (n > 0) {
      const key = this.keys[n];
      const node = this.nodes[n];
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        if (a >= n) break;
        const b = a + 1;
        const m = b < n && this.keys[b] < this.keys[a] ? b : a;
        if (this.keys[m] >= key) break;
        this.keys[i] = this.keys[m];
        this.nodes[i] = this.nodes[m];
        i = m;
      }
      this.keys[i] = key;
      this.nodes[i] = node;
    }
    return top;
  }
}

/**
 * Distance de `start` à chaque nœud de la grille, à huit voisins (pas droit : `step`, pas en diagonale : `step·√2`),
 * multipliée par le coût du nœud où l'on entre. Un nœud dans un rectangle de `blocked` est interdit ; le départ est
 * le nœud le plus proche de `start`, ramené dans la grille.
 */
export const gridDistances = (spec: GridSpec, start: { x: number; y: number }, blocked: readonly Box[], slow: readonly SlowBox[] = []): DistanceGrid => {
  const { nx, ny, step } = spec;
  const total = nx * ny;
  const free = new Uint8Array(total).fill(1);
  for (const box of blocked) forNodesIn(spec, box, (k) => { free[k] = 0; });
  const cost = new Float32Array(total).fill(1);
  for (const { box, cost: c } of slow) forNodesIn(spec, box, (k) => { cost[k] = c; });
  const dist = new Float64Array(total).fill(Infinity);
  const i0 = Math.max(0, Math.min(nx - 1, Math.round((start.x - spec.x0) / step)));
  const j0 = Math.max(0, Math.min(ny - 1, Math.round((start.y - spec.y0) / step)));
  const heap = new MinHeap(total);
  dist[j0 * nx + i0] = 0;
  heap.push(0, j0 * nx + i0);
  const diag = step * Math.SQRT2;
  while (heap.size > 0) {
    const k = heap.pop();
    const d = heap.lastKey;
    if (d > dist[k]) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj;
      if (jj < 0 || jj >= ny) continue;
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ii = i + di;
        if (ii < 0 || ii >= nx) continue;
        const kk = jj * nx + ii;
        if (!free[kk]) continue;
        const nd = d + (di !== 0 && dj !== 0 ? diag : step) * cost[kk];
        if (nd < dist[kk]) {
          dist[kk] = nd;
          heap.push(nd, kk);
        }
      }
    }
  }
  for (let k = 0; k < total; k++) if (!free[k]) dist[k] = Infinity;
  return { spec, free, dist };
};

/** Distance lue au nœud le plus proche de (x, y) ; `Infinity` hors de la grille, sur un nœud interdit ou hors d'atteinte. */
export const readDistance = (grid: DistanceGrid, x: number, y: number): number => {
  const { x0, y0, step, nx, ny } = grid.spec;
  const i = Math.round((x - x0) / step);
  const j = Math.round((y - y0) / step);
  if (i < 0 || j < 0 || i >= nx || j >= ny) return Infinity;
  return grid.dist[j * nx + i];
};

/** Sens où la distance augmente en (x, y), vecteur unitaire ; `null` à plat ou isolé. */
export const distanceSlope = (grid: DistanceGrid, x: number, y: number): [number, number] | null => {
  const h = grid.spec.step;
  const d0 = readDistance(grid, x, y);
  const diff = (a: number, b: number): number => {
    const fa = Number.isFinite(a);
    const fb = Number.isFinite(b);
    if (fa && fb) return (a - b) / 2;
    if (!Number.isFinite(d0)) return 0;
    if (fa) return a - d0;
    if (fb) return d0 - b;
    return 0;
  };
  const gx = diff(readDistance(grid, x + h, y), readDistance(grid, x - h, y));
  const gy = diff(readDistance(grid, x, y + h), readDistance(grid, x, y - h));
  const n = Math.hypot(gx, gy);
  return n > 0 ? [gx / n, gy / n] : null;
};

export type Loop = [number, number][];

/**
 * Lignes de niveau zéro d'un champ (`value` négatif dedans, non fini : dehors), en boucles fermées de points, sur une
 * grille de pas `step` qui couvre `bounds` ; le bord de la grille compte dehors, si bien que toute boucle se ferme.
 * Les boucles de trois points ou moins sont écartées.
 */
export const contours = (value: (x: number, y: number) => number, bounds: Box, step: number): Loop[] => {
  const spec = gridOver(bounds, step);
  const { x0, y0, nx, ny } = spec;
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
      const d = edge ? 1 : value(x0 + i * step, y0 + j * step);
      v[j * nx + i] = Number.isFinite(d) ? d : 1;
    }
  }
  const at = (i: number, j: number): number => v[j * nx + i];
  /** Point de passage à zéro sur l'arête entre deux nœuds voisins. */
  const cross = (i0: number, j0: number, i1: number, j1: number): [number, number] => {
    const a = at(i0, j0);
    const b = at(i1, j1);
    const t = a / (a - b);
    return [x0 + (i0 + (i1 - i0) * t) * step, y0 + (j0 + (j1 - j0) * t) * step];
  };
  // Arêtes d'une case : 0 haut, 1 droite, 2 bas, 3 gauche ; identifiant global (horizontale paire, verticale impaire).
  const edgeId = (i: number, j: number, side: number): number =>
    side === 0 ? (j * nx + i) * 2 : side === 2 ? ((j + 1) * nx + i) * 2 : side === 3 ? (j * nx + i) * 2 + 1 : (j * nx + i + 1) * 2 + 1;
  const edgePoint = (i: number, j: number, side: number): [number, number] =>
    side === 0 ? cross(i, j, i + 1, j) : side === 2 ? cross(i, j + 1, i + 1, j + 1) : side === 3 ? cross(i, j, i, j + 1) : cross(i + 1, j, i + 1, j + 1);
  const links = new Map<number, number[]>();
  const points = new Map<number, [number, number]>();
  const link = (a: number, b: number): void => {
    const la = links.get(a);
    if (la) la.push(b); else links.set(a, [b]);
    const lb = links.get(b);
    if (lb) lb.push(a); else links.set(b, [a]);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = at(i, j);
      const tr = at(i + 1, j);
      const br = at(i + 1, j + 1);
      const bl = at(i, j + 1);
      const c = (tl < 0 ? 8 : 0) | (tr < 0 ? 4 : 0) | (br < 0 ? 2 : 0) | (bl < 0 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const centre = (tl + tr + br + bl) / 4 < 0;
      const pairs = CASES[c](centre);
      for (const [sa, sb] of pairs) {
        const a = edgeId(i, j, sa);
        const b = edgeId(i, j, sb);
        if (!points.has(a)) points.set(a, edgePoint(i, j, sa));
        if (!points.has(b)) points.set(b, edgePoint(i, j, sb));
        link(a, b);
      }
    }
  }
  const seen = new Set<number>();
  const loops: Loop[] = [];
  for (const first of links.keys()) {
    if (seen.has(first)) continue;
    const loop: Loop = [];
    let prev = -1;
    let cur: number | undefined = first;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      loop.push(points.get(cur)!);
      const next: number | undefined = (links.get(cur) ?? []).find((x) => x !== prev && !seen.has(x));
      prev = cur;
      cur = next;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
};

/** Arêtes reliées dans une case selon ses coins dedans (haut gauche 8, haut droit 4, bas droit 2, bas gauche 1). */
const CASES: Record<number, (centre: boolean) => [number, number][]> = {
  1: () => [[3, 2]],
  2: () => [[2, 1]],
  3: () => [[3, 1]],
  4: () => [[0, 1]],
  5: (centre) => (centre ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]]),
  6: () => [[0, 2]],
  7: () => [[3, 0]],
  8: () => [[3, 0]],
  9: () => [[0, 2]],
  10: (centre) => (centre ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]]),
  11: () => [[0, 1]],
  12: () => [[3, 1]],
  13: () => [[2, 1]],
  14: () => [[3, 2]],
};
