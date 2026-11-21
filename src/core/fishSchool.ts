import { distanceSlope, gridDistances, gridOver, readDistance, type Box, type DistanceGrid } from './gridDistance';

/** Hasard reproductible : la même graine rend toujours la même suite de nombres de [0, 1[. */
export const seededRandom = (seed: number) => {
  let a = seed;
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export {
  DEFAULT_SCHOOL_STYLE, fishCount, fishForDuration, isSchoolStyle, SCHOOL_FISH_MAX, SCHOOL_STYLES, SCHOOL_TRIAL_MAX, sessionOfFish,
  type SchoolStyle,
} from './schoolBasics';

/**
 * Le banc de poissons du Profil, pur : combien de poissons pour des sessions (selon leur durée), et la place, la taille, la forme
 * et l'orientation de chacun sur la page. La page arrive mesurée (`SchoolLayout` : zone, angle de départ, obstacles
 * rigides, cadres et leurs ouvertures, textes des cadres) ; le dessin est l'affaire du composant.
 *
 * Les places sont prises une à une dans l'ordre de la distance à l'angle de départ, mesurée en contournant les
 * obstacles (Dijkstra sur une grille, `core/gridDistance.ts`), un peu bruitée pour un front en lobes : le banc longe les
 * cadres et descend dans les couloirs. D'abord les marges seules, les cadres interdits ; quand elles n'ont plus de
 * place, les cadres s'ouvrent par l'ouverture de leur trait au pinceau (murs partout ailleurs), lents à traverser, et
 * leurs textes restent interdits. Le poisson n prend toujours la même place : la suite ne dépend que de la page,
 * jamais du nombre demandé, si bien qu'une session de plus ajoute ses poissons sans bouger les autres.
 */

/** Ouverture d'un cadre peint : haut gauche, haut droite, bas gauche, bas droite. */
export type FrameCorner = 'hg' | 'hd' | 'bg' | 'bd';

/** Cadre de la page : sa boîte, l'angle ouvert de son trait (`null` : cadre fermé) et l'épaisseur du trait, en px. */
export interface SchoolFrame {
  box: Box;
  corner: FrameCorner | null;
  trait: number;
}

/**
 * Page mesurée, en px relatifs à la zone du banc (origine en haut à gauche) : la zone, l'angle d'où le banc entre,
 * les obstacles rigides (photo, bouton, texte de l'en-tête…), les cadres, et les textes, chiffres et dessins des
 * cadres (jamais touchés).
 */
export interface SchoolLayout {
  zone: { w: number; h: number };
  corner: { x: number; y: number };
  rigid: Box[];
  frames: SchoolFrame[];
  texts: Box[];
}

/** Angle de départ : rentré de `inset` px de son bord ; `marginPx`, écart laissé contre la colonne voisine. */
export interface SchoolCornerRules {
  inset: { x: number; y: number };
  marginPx: number;
}

/**
 * Angle d'où entrent le banc et l'eau, en px de la zone (origine en haut à gauche, sous la photo d'en-tête). Téléphone,
 * ou « Vos activités » sous le Profil (`activities` nul ou plus bas) : en haut à droite de la zone. Ordinateur, « Vos
 * activités » à côté de la colonne du Profil : en haut à gauche de cette colonne, juste sous la photo ronde et son
 * bouton de période (`headBottom`, bas de l'en-tête de la colonne), contre son bord gauche, dans la marge qui la borde.
 * Le reste du calcul ne suppose aucun côté : places, caps et eau se lisent tous depuis cet angle.
 */
export const schoolCorner = (
  zoneW: number, column: Box, activities: Box | null, headBottom: number, rules: SchoolCornerRules,
): { x: number; y: number } => {
  const besideProfile = activities !== null && activities.x >= column.r;
  if (!besideProfile) return { x: zoneW - rules.inset.x, y: rules.inset.y };
  return { x: Math.max(0, column.x - rules.marginPx) + rules.inset.x, y: headBottom + rules.inset.y };
};

/** Un poisson placé : centre, longueur (px), cap en degrés (0 : vers la droite, sens horaire), forme, dans un cadre. */
export interface SchoolFish {
  x: number;
  y: number;
  size: number;
  angle: number;
  shape: number;
  inFrame: boolean;
  /** 1 : placé dans les marges, cadres interdits ; 2 : après elles, cadres ouverts par leur ouverture. */
  phase: 1 | 2;
}

export interface SchoolRules {
  /** Pas de la grille des distances, en px. */
  gridPx: number;
  /** Longueur des poissons : tirage gaussien autour de `base`, écart `spread`, borné de `min` à `max`, au demi-pixel. */
  size: { base: number; spread: number; min: number; max: number };
  /** Nombre de formes par style. */
  shapes: number;
  /** Corps d'un poisson contre les obstacles : demi-longueur et demi-largeur, en part de sa longueur. */
  body: { halfLength: number; halfWidth: number };
  /** Garde entre deux poissons : ellipse de demi-axes `long` et `wide` fois leur longueur moyenne, dans le repère de chacun. */
  guard: { long: number; wide: number };
  /** Écart du cap à la pente, propre à chaque poisson : amplitude de `startDeg`, plus `stepDeg` par rang, au plus `maxDeg`. */
  spread: { startDeg: number; stepDeg: number; maxDeg: number };
  /** Cadres gonflés de tant de px quand ils sont interdits. */
  frameMarginPx: number;
  /** Murs d'un cadre ouvert : le trait plus tant de px. */
  wallExtraPx: number;
  /** Coût d'un pas dans un cadre ouvert, en fois sa longueur. */
  frameCost: number;
  /** Bruit du front : part de la distance (0,1 : un dixième) et échelle de ses ondes, en px ; graine du tirage. */
  noise: number;
  noiseScalePx: number;
  /** Forme du bruit : nombre d'ondes, diviseur qui ramène leur somme vers −1..1, longueurs d'onde de `scaleMin` à `scaleMin + scaleRange` fois l'échelle. */
  noiseShape: { waves: number; divisor: number; scaleMin: number; scaleRange: number };
  seed: number;
  /**
   * Places candidates : une grille au pas de `pitchShare` fois la plus petite longueur (au moins `minPitchPx`), chaque
   * point secoué de `jitter` fois le pas, et sa distance poussée d'un tirage jusqu'à `dust` fois le pas (front moins net).
   */
  candidates: { pitchShare: number; minPitchPx: number; jitter: number; dust: number };
  /** Opacité d'un poisson dans un cadre. */
  frameOpacity: number;
}

export const SCHOOL_RULES: SchoolRules = {
  gridPx: 4,
  size: { base: 13, spread: 1.5, min: 10, max: 16 },
  shapes: 8,
  body: { halfLength: 0.55, halfWidth: 0.3 },
  guard: { long: 1.38, wide: 0.86 },
  spread: { startDeg: 6, stepDeg: 0.45, maxDeg: 120 },
  frameMarginPx: 2,
  wallExtraPx: 2,
  frameCost: 3,
  noise: 0.1,
  noiseScalePx: 110,
  noiseShape: { waves: 5, divisor: 2.4, scaleMin: 0.6, scaleRange: 0.8 },
  seed: 3,
  candidates: { pitchShare: 0.42, minPitchPx: 2.5, jitter: 0.9, dust: 1.5 },
  frameOpacity: 0.32,
};

/** Tirage reproductible dans [0, 1) pour le rang `k` et le sel `salt`. */
const hashUnit = (k: number, salt: number): number => seededRandom((k * 2654435761) ^ (salt * 40503) ^ 0x9e3779b9)();

/** Longueur du poisson de rang `index`, en px : surtout des moyens, quelques petits et quelques grands. */
export const fishSize = (index: number, rules: SchoolRules = SCHOOL_RULES): number => {
  const { base, spread, min, max } = rules.size;
  const u1 = Math.max(1e-6, hashUnit(index + 1, 31));
  const u2 = hashUnit(index + 1, 37);
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.round(Math.min(max, Math.max(min, base + spread * g)) * 2) / 2;
};

/** Forme du poisson de rang `index`, de 0 à `shapes` − 1. */
export const fishShape = (index: number, rules: SchoolRules = SCHOOL_RULES): number =>
  Math.min(rules.shapes - 1, Math.floor(hashUnit(index + 1, 41) * rules.shapes));

/** Écart du cap à la pente pour le poisson de rang `index`, en degrés. */
const fishSpread = (index: number, rules: SchoolRules): number => {
  const { startDeg, stepDeg, maxDeg } = rules.spread;
  return (hashUnit(index + 1, 53) - 0.5) * 2 * Math.min(maxDeg, startDeg + index * stepDeg);
};

/** Angle ouvert d'un cadre peint d'après les retournements de son trait (`--brush-fx`, `--brush-fy` : 1 ou −1). */
export const brushCorner = (fx: number, fy: number): FrameCorner =>
  fy < 0 ? (fx < 0 ? 'hg' : 'hd') : fx < 0 ? 'bg' : 'bd';

/**
 * Ouverture du trait au pinceau, mesurée sur son dessin (1 000 unités, coupé en neuf à 350 : les coins sur quatre
 * traits, le milieu étiré) : depuis l'angle ouvert, le coin entier puis le milieu jusqu'à l'unité 599, soit 51 des
 * 300 unités étirées.
 */
const BRUSH_CORNER_TRAITS = 4;
const BRUSH_MIDDLE_OPEN = (650 - 599) / 300;

/** Longueur de l'ouverture le long d'un côté de `length` px, pour un trait de `trait` px. */
const doorLength = (length: number, trait: number): number => {
  const corner = BRUSH_CORNER_TRAITS * trait;
  return Math.max(0, Math.min(length, corner + BRUSH_MIDDLE_OPEN * (length - 2 * corner)));
};

/** Ouverture d'un cadre : sa longueur le long du côté horizontal (`h`) et du côté vertical (`v`) de l'angle ouvert, en px. */
export const brushDoor = (box: Box, trait: number): { h: number; v: number } => ({
  h: doorLength(box.r - box.x, trait),
  v: doorLength(box.b - box.y, trait),
});

/**
 * Murs d'un cadre : quatre bandes d'épaisseur `band` le long de ses bords, sur sa boîte rentrée de `inset` px, moins
 * les deux segments de son ouverture (comptés depuis l'angle ouvert) ; un cadre fermé est entièrement muré.
 */
export const frameWalls = ({ box, corner, trait }: SchoolFrame, band: number, inset = 0): Box[] => {
  const x = box.x + inset;
  const y = box.y + inset;
  const r = box.r - inset;
  const b = box.b - inset;
  if (r <= x || b <= y) return [];
  const door = corner === null ? { h: 0, v: 0 } : brushDoor(box, trait);
  const walls: Box[] = [
    { x: corner === 'hg' ? box.x + door.h : x, y, r: corner === 'hd' ? box.r - door.h : r, b: y + band },
    { x: corner === 'bg' ? box.x + door.h : x, y: b - band, r: corner === 'bd' ? box.r - door.h : r, b },
    { x, y: corner === 'hg' ? box.y + door.v : y, r: x + band, b: corner === 'bg' ? box.b - door.v : b },
    { x: r - band, y: corner === 'hd' ? box.y + door.v : y, r, b: corner === 'bd' ? box.b - door.v : b },
  ];
  return walls.filter((w) => w.r > w.x && w.b > w.y);
};

const grow = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, r: b.r + m, b: b.b + m });

/** Bruit lisse, à peu près dans −1..1 : quelques ondes planes tirées de la graine. */
export const smoothNoise = (
  seed: number, scale: number, shape: SchoolRules['noiseShape'] = SCHOOL_RULES.noiseShape,
): ((x: number, y: number) => number) => {
  const rng = seededRandom(seed * 7 + 3);
  const waves = Array.from({ length: shape.waves }, () => {
    const a = rng() * Math.PI * 2;
    const k = (2 * Math.PI) / (scale * (shape.scaleMin + rng() * shape.scaleRange));
    return { cx: Math.cos(a) * k, cy: Math.sin(a) * k, p: rng() * Math.PI * 2 };
  });
  return (x, y) => waves.reduce((s, w) => s + Math.sin(x * w.cx + y * w.cy + w.p), 0) / shape.divisor;
};

/**
 * Rectangles rangés par case, pour ne tester que les voisins d'un poisson. La taille de case ne règle que la vitesse :
 * chaque rectangle est rangé dans toutes les cases qu'il couvre, si bien qu'aucune taille ne change une sortie.
 */
class BoxIndex {
  private readonly cells = new Map<number, Box[]>();
  private static readonly CELL = 32;

  constructor(boxes: readonly Box[]) {
    for (const box of boxes) {
      const [i0, i1, j0, j1] = BoxIndex.range(box);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const key = j * 65536 + i;
        const list = this.cells.get(key);
        if (list) list.push(box); else this.cells.set(key, [box]);
      }
    }
  }

  private static range(box: Box): [number, number, number, number] {
    const c = BoxIndex.CELL;
    return [Math.max(0, Math.floor(box.x / c)), Math.max(0, Math.floor(box.r / c)), Math.max(0, Math.floor(box.y / c)), Math.max(0, Math.floor(box.b / c))];
  }

  /** Le rectangle orienté de centre (x, y), d'axe (ux, uy), de demi-côtés `hl` et `hw`, touche-t-il un rectangle rangé ? */
  hits(x: number, y: number, ux: number, uy: number, hl: number, hw: number): boolean {
    const ex = Math.abs(ux) * hl + Math.abs(uy) * hw;
    const ey = Math.abs(uy) * hl + Math.abs(ux) * hw;
    const [i0, i1, j0, j1] = BoxIndex.range({ x: x - ex, y: y - ey, r: x + ex, b: y + ey });
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      for (const b of this.cells.get(j * 65536 + i) ?? []) {
        if (x + ex <= b.x || x - ex >= b.r || y + ey <= b.y || y - ey >= b.b) continue;
        const cx = (b.x + b.r) / 2 - x;
        const cy = (b.y + b.b) / 2 - y;
        const bw = (b.r - b.x) / 2;
        const bh = (b.b - b.y) / 2;
        if (Math.abs(cx * ux + cy * uy) >= hl + Math.abs(ux) * bw + Math.abs(uy) * bh) continue;
        if (Math.abs(-cx * uy + cy * ux) >= hw + Math.abs(uy) * bw + Math.abs(ux) * bh) continue;
        return true;
      }
    }
    return false;
  }
}

interface Candidate {
  x: number;
  y: number;
  key: number;
}

interface Phase {
  grid: DistanceGrid;
  list: Candidate[];
  next: number;
  obstacles: BoxIndex;
}

interface Placed extends SchoolFish {
  ux: number;
  uy: number;
}

/** Suite des places d'une page, prolongée à la demande ; le poisson n a toujours la même place. */
export interface SchoolPlanner {
  readonly layout: SchoolLayout;
  /** Les `count` premiers poissons, moins si la page est pleine. */
  places(count: number): SchoolFish[];
}

/** Planificateur des places d'une page : garder le même tant que la page ne change pas (`schoolLayoutKey`). */
export const createSchoolPlanner = (layout: SchoolLayout, rules: SchoolRules = SCHOOL_RULES): SchoolPlanner => {
  const { w, h } = layout.zone;
  const bounds: Box = { x: 0, y: 0, r: w, b: h };
  const spec = gridOver(bounds, rules.gridPx);
  const noise = smoothNoise(rules.seed, rules.noiseScalePx, rules.noiseShape);
  const { pitchShare, minPitchPx, jitter, dust: dustShare } = rules.candidates;
  const pitch = Math.max(minPitchPx, rules.size.min * pitchShare);
  const walls = layout.frames.flatMap((f) => frameWalls(f, f.trait + rules.wallExtraPx));

  const candidates = (grid: DistanceGrid): Candidate[] => {
    const rng = seededRandom(rules.seed * 101 + 17);
    const list: Candidate[] = [];
    for (let y = 0; y <= h; y += pitch) {
      for (let x = 0; x <= w; x += pitch) {
        const px = x + (rng() - 0.5) * pitch * jitter;
        const py = y + (rng() - 0.5) * pitch * jitter;
        const dust = rng() * pitch * dustShare;
        const d = readDistance(grid, px, py);
        if (Number.isFinite(d)) list.push({ x: px, y: py, key: d * (1 + rules.noise * noise(px, py)) + dust });
      }
    }
    return list.sort((a, b) => a.key - b.key);
  };

  const buildPhase = (blocked: Box[], slow: { box: Box; cost: number }[]): Phase => {
    const grid = gridDistances(spec, layout.corner, blocked, slow);
    return { grid, list: candidates(grid), next: 0, obstacles: new BoxIndex(blocked) };
  };
  const phases: [Phase | null, Phase | null] = [null, null];
  const phaseAt = (k: 0 | 1): Phase => {
    if (!phases[k]) {
      phases[k] = k === 0
        ? buildPhase([...layout.rigid, ...layout.frames.map((f) => grow(f.box, rules.frameMarginPx))], [])
        : buildPhase([...layout.rigid, ...layout.texts, ...walls], layout.frames.map((f) => ({ box: f.box, cost: rules.frameCost })));
    }
    return phases[k];
  };

  const placed: Placed[] = [];
  // Case des voisins : au moins la portée de la garde (`guard.long` fois la plus grande longueur), si bien que les neuf
  // cases autour d'un poisson contiennent tous ceux qu'il peut gêner ; le jeu de 1,2 ne règle que la vitesse, aucune sortie.
  const cell = rules.size.max * rules.guard.long * 1.2;
  const neighbours = new Map<number, Placed[]>();
  const cellKey = (i: number, j: number): number => j * 65536 + i;
  let current: 0 | 1 = 0;
  let full = false;

  const fits = (x: number, y: number, ux: number, uy: number, size: number, obstacles: BoxIndex): boolean => {
    const hl = size * rules.body.halfLength;
    const hw = size * rules.body.halfWidth;
    const ex = Math.abs(ux) * hl + Math.abs(uy) * hw;
    const ey = Math.abs(uy) * hl + Math.abs(ux) * hw;
    if (x - ex < 0 || y - ey < 0 || x + ex > w || y + ey > h) return false;
    if (obstacles.hits(x, y, ux, uy, hl, hw)) return false;
    const ci = Math.floor(x / cell);
    const cj = Math.floor(y / cell);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      for (const q of neighbours.get(cellKey(i, j)) ?? []) {
        const m = (size + q.size) / 2;
        const a = rules.guard.long * m;
        const b = rules.guard.wide * m;
        const dx = x - q.x;
        const dy = y - q.y;
        const u1 = dx * q.ux + dy * q.uy;
        const v1 = -dx * q.uy + dy * q.ux;
        const u2 = dx * ux + dy * uy;
        const v2 = -dx * uy + dy * ux;
        if ((u1 / a) ** 2 + (v1 / b) ** 2 < 1 || (u2 / a) ** 2 + (v2 / b) ** 2 < 1) return false;
      }
    }
    return true;
  };

  const placeNext = (): void => {
    const n = placed.length;
    const size = fishSize(n, rules);
    const spread = (fishSpread(n, rules) * Math.PI) / 180;
    for (;;) {
      const phase = phaseAt(current);
      while (phase.next < phase.list.length) {
        const c = phase.list[phase.next++];
        const away = Math.hypot(c.x - layout.corner.x, c.y - layout.corner.y) || 1;
        const slope = distanceSlope(phase.grid, c.x, c.y) ?? [(c.x - layout.corner.x) / away, (c.y - layout.corner.y) / away];
        const a = Math.atan2(slope[1], slope[0]) + spread;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        if (!fits(c.x, c.y, ux, uy, size, phase.obstacles)) continue;
        const fish: Placed = {
          x: c.x, y: c.y, size, angle: (a * 180) / Math.PI, shape: fishShape(n, rules),
          inFrame: layout.frames.some((f) => c.x > f.box.x && c.x < f.box.r && c.y > f.box.y && c.y < f.box.b),
          phase: current === 0 ? 1 : 2, ux, uy,
        };
        placed.push(fish);
        const key = cellKey(Math.floor(c.x / cell), Math.floor(c.y / cell));
        const list = neighbours.get(key);
        if (list) list.push(fish); else neighbours.set(key, [fish]);
        return;
      }
      if (current === 1) {
        full = true;
        return;
      }
      current = 1;
    }
  };

  return {
    layout,
    places(count: number): SchoolFish[] {
      while (placed.length < count && !full) placeNext();
      return placed.slice(0, Math.max(0, count)).map(({ ux: _ux, uy: _uy, ...fish }) => fish);
    },
  };
};

/** Les `count` premiers poissons d'une page (un planificateur jetable : `createSchoolPlanner` pour prolonger). */
export const schoolPlaces = (layout: SchoolLayout, count: number, rules: SchoolRules = SCHOOL_RULES): SchoolFish[] =>
  createSchoolPlanner(layout, rules).places(count);

const boxKey = (b: Box): string => [b.x, b.y, b.r, b.b].map(Math.round).join(',');

/**
 * Clé d'une page, au pixel près : les places se recalculent quand elle change. `margins` ne retient que ce dont
 * dépendent les poissons des marges (zone, angle, obstacles rigides, cadres), sans les textes des cadres.
 */
export const schoolLayoutKey = (layout: SchoolLayout, part: 'margins' | 'all' = 'all'): string => {
  const head = [
    `${Math.round(layout.zone.w)}x${Math.round(layout.zone.h)}`,
    `${Math.round(layout.corner.x)},${Math.round(layout.corner.y)}`,
    layout.rigid.map(boxKey).join(';'),
    layout.frames.map((f) => `${boxKey(f.box)}:${f.corner ?? '-'}:${f.trait}`).join(';'),
  ];
  return (part === 'all' ? [...head, layout.texts.map(boxKey).join(';')] : head).join('|');
};
