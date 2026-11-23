import { roundBearingDeg } from '../core/angles';
import { cumulativeDistancesM } from '../core/geo';
import { t } from '../core/i18n';
import type { ShareStat } from '../core/shareImage';
import { MISSING, formatDistance, toDisplayDistance, type DistanceUnit } from '../core/units';
import { courseLegs, isLooped, routeTotals, waypointDistances, type PlannedRoute, type RoutePoint } from './route';
import { markLabel } from './routeGpx';

/**
 * Image de partage d'un itinéraire : ce qu'elle montre, calculé sans dessin.
 * Le tracé, les balises numérotées (départ, arrivée, ou départ d'une boucle,
 * qui est aussi son arrivée), une pastille par bord, « distance · cap », posée
 * au milieu du bord et écartée de ce qu'elle chevaucherait (`placeLegPills`),
 * les trois chiffres du bloc Parcours de Planifier, et le texte de l'image. Le
 * dessin est dans `components/drawRouteOverlay.ts`.
 */

/** Rôle d'une balise sur l'image : sa couleur. */
export type RouteMarkRole = 'start' | 'end' | 'mark' | 'loop';

export interface RouteImageMark {
  lat: number;
  lon: number;
  /** Numéro de la balise : 1, 2, 3… */
  label: string;
  role: RouteMarkRole;
}

/** Pastille d'un bord. */
export interface RouteLegPill {
  /** Balises de départ et d'arrivée du bord. */
  from: string;
  to: string;
  /** « 1,60 km · 65° » ; la distance seule sur un tronçon tiré d'une trace, qui n'a pas de cap. */
  text: string;
  /** Milieu du bord, le long de son tracé. */
  anchor: RoutePoint;
  /** Extrémités du morceau de tracé où tombe le milieu : la direction du bord à cet endroit. */
  before: RoutePoint;
  after: RoutePoint;
}

export interface RouteShareContent {
  /** Tracé de chaque tronçon. */
  paths: RoutePoint[][];
  marks: RouteImageMark[];
  pills: RouteLegPill[];
}

/** Sous cette longueur, un bord n'a pas de pastille : départ et arrivée y sont au même endroit. */
const MIN_PILL_LEG_M = 1;

/** Milieu d'un tracé, le long de sa longueur, et le morceau qui le porte ; `null` sans longueur. */
const midpointOf = (points: ReadonlyArray<RoutePoint>): { at: RoutePoint; before: RoutePoint; after: RoutePoint } | null => {
  const cum = cumulativeDistancesM(points);
  const total = cum[cum.length - 1] ?? 0;
  if (!(total > 0)) return null;
  const half = total / 2;
  const i = Math.max(1, cum.findIndex((d) => d >= half));
  const a = points[i - 1];
  const b = points[i];
  const span = cum[i] - cum[i - 1];
  const f = span > 0 ? (half - cum[i - 1]) / span : 0;
  return { at: { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f }, before: a, after: b };
};

/** Balises, tracé et pastilles de l'image d'un itinéraire, distances dans `unit`. */
export const routeShareContent = (route: PlannedRoute, unit: DistanceUnit): RouteShareContent => {
  const looped = isLooped(route);
  const last = route.waypoints.length - 1;
  /** Sur une boucle, l'arrivée est le départ : 1. */
  const labelOf = (i: number) => markLabel(looped && i === last ? 0 : i);
  const marks: RouteImageMark[] = [];
  route.waypoints.forEach((w, i) => {
    if (looped && i === last) return;
    const role: RouteMarkRole = i === 0 ? (looped ? 'loop' : 'start') : i === last ? 'end' : 'mark';
    marks.push({ lat: w.lat, lon: w.lon, label: labelOf(i), role });
  });
  const straight = courseLegs(route);
  const along = waypointDistances(route);
  const pills: RouteLegPill[] = [];
  route.legs.forEach((leg, i) => {
    const imported = leg.mode === 'imported';
    const distanceM = imported ? along[i + 1]?.legM ?? 0 : straight[i]?.distanceM ?? 0;
    const middle = distanceM >= MIN_PILL_LEG_M ? midpointOf(leg.points) : null;
    if (!middle) return;
    const distance = formatDistance(distanceM, unit);
    pills.push({
      from: labelOf(i),
      to: labelOf(i + 1),
      text: imported ? distance : `${distance} · ${roundBearingDeg(straight[i].bearingDeg)}°`,
      anchor: middle.at,
      before: middle.before,
      after: middle.after,
    });
  });
  return { paths: route.legs.map((leg) => leg.points), marks, pills };
};

/**
 * Chiffres de l'image : ceux du bloc Parcours de Planifier, aux mêmes
 * arrondis (distance le long des tracés, balises, boucle comptée une fois,
 * plus long bord de balise à balise).
 */
export const routeShareStats = (route: PlannedRoute, unit: DistanceUnit): ShareStat[] => {
  const distanceM = routeTotals(route).distanceM;
  const legs = courseLegs(route);
  return [
    { key: 'distance', label: t('Distance'), value: formatDistance(distanceM, unit, toDisplayDistance(distanceM, unit) >= 100 ? 1 : 2) },
    { key: 'balises', label: t('Balises'), value: String(route.waypoints.length - (isLooped(route) ? 1 : 0)) },
    {
      key: 'plusLongBord',
      label: t('Plus long bord'),
      value: legs.length > 0 ? formatDistance(Math.max(...legs.map((l) => l.distanceM)), unit) : MISSING,
    },
  ];
};

/** Texte de l'image, pour qui ne la voit pas : son titre, ses chiffres et chacun de ses bords. */
export const routeImageDescription = (
  title: string,
  subtitle: string,
  content: RouteShareContent,
  stats: ReadonlyArray<ShareStat>
): string => {
  const figures = stats.map((s) => `${s.label} ${s.value}`).join(', ');
  const legs = content.pills.map((p) => `${p.from} → ${p.to} : ${p.text}`).join(' ; ');
  return legs === ''
    ? t("Image de l'itinéraire « {title} », {subtitle} : {figures}.", { title, subtitle, figures })
    : t("Image de l'itinéraire « {title} », {subtitle} : {figures}. Bords : {legs}.", { title, subtitle, figures, legs });
};

/** Pastille à poser : son ancre et la direction du bord, en pixels de l'image, et sa taille. */
export interface PillRequest {
  x: number;
  y: number;
  /** Direction du bord, de longueur quelconque ; nulle, la pastille s'écarte verticalement. */
  dx: number;
  dy: number;
  width: number;
  height: number;
}

/** Pastille posée : son centre et sa taille. */
export interface PlacedPill {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ce qu'une pastille ne doit pas couvrir : une balise, ronde. */
export interface PillObstacle {
  x: number;
  y: number;
  radius: number;
}

/** Cadre où les pastilles restent : sous le titre, au-dessus du cartouche, dans l'image. */
export interface PillFrame {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Écart gardé entre une pastille et ce qu'elle évite, en pixels de l'image. */
export const PILL_GAP_PX = 8;
/** Pas d'écartement le long de la normale du bord, en hauteurs de pastille, et nombre de pas de chaque côté. */
const PILL_STEP_HEIGHTS = 1;
const PILL_MAX_STEPS = 5;

const clamp = (v: number, min: number, max: number): number => (min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max));

/** Surface où deux rectangles (centre et taille), agrandis de l'écart, se chevauchent. */
const overlapArea = (a: PlacedPill, b: PlacedPill, gapPx: number): number => {
  const ox = (a.width + b.width) / 2 + gapPx - Math.abs(a.x - b.x);
  const oy = (a.height + b.height) / 2 + gapPx - Math.abs(a.y - b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
};

/**
 * Place les pastilles, dans l'ordre des bords : chacune au milieu de son bord,
 * ou, si elle y chevauche une balise ou une pastille déjà posée, poussée le
 * long de la normale du bord, d'un côté puis de l'autre, de plus en plus loin ;
 * faute de place libre, là où elle chevauche le moins. Toutes restent dans le
 * cadre. Une balise compte pour le carré qui l'entoure.
 */
export const placeLegPills = (
  requests: ReadonlyArray<PillRequest>,
  obstacles: ReadonlyArray<PillObstacle>,
  frame: PillFrame,
  { gapPx = PILL_GAP_PX }: { gapPx?: number } = {}
): PlacedPill[] => {
  const placed: PlacedPill[] = [];
  const blocks: PlacedPill[] = obstacles.map((o) => ({ x: o.x, y: o.y, width: 2 * o.radius, height: 2 * o.radius }));
  for (const r of requests) {
    const length = Math.hypot(r.dx, r.dy);
    const nx = length > 0 ? -r.dy / length : 0;
    const ny = length > 0 ? r.dx / length : 1;
    const step = PILL_STEP_HEIGHTS * r.height;
    let best: { pill: PlacedPill; cost: number } | null = null;
    for (let k = 0; k <= 2 * PILL_MAX_STEPS; k++) {
      const offset = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * step;
      const pill: PlacedPill = {
        x: clamp(r.x + nx * offset, frame.left + r.width / 2, frame.right - r.width / 2),
        y: clamp(r.y + ny * offset, frame.top + r.height / 2, frame.bottom - r.height / 2),
        width: r.width,
        height: r.height,
      };
      const cost = [...blocks, ...placed].reduce((sum, other) => sum + overlapArea(pill, other, gapPx), 0);
      if (best === null || cost < best.cost) best = { pill, cost };
      if (cost === 0) break;
    }
    placed.push(best!.pill);
  }
  return placed;
};
