import { projectOnSegment } from '../core/geoPlane';
import { cumulativeDistancesM, haversineDistance, initialBearing } from '../core/geo';
import { joinLegs, samePlace } from './legJoin';

/**
 * Itinéraire planifié : des points de passage posés par l'utilisateur (les
 * balises d'un parcours), reliés deux à deux par des tronçons. Un tronçon va
 * en ligne droite, ou reprend le tracé d'un GPX chargé (`routeFromTrack`).
 * Rien ne se calcule : chaque tronçon est prêt dès qu'il est posé.
 *
 * Toutes les opérations sont pures : elles rendent un nouvel itinéraire.
 *
 * Unités SI (règle 1) : mètres, degrés décimaux.
 */

export interface Waypoint {
  lat: number;
  lon: number;
}

/**
 * Façon de relier deux points : en ligne droite, ou par le tracé d'un GPX
 * chargé (`imported`), gardé tel quel.
 */
export type RouteMode = 'straight' | 'imported';

/** Mode par défaut, et celui d'un tronçon illisible. */
export const DEFAULT_ROUTE_MODE: RouteMode = 'straight';

/** Mode relu d'une fiche ; `null` s'il est inconnu (dont les types de voie d'avant le lot 304). */
export const readRouteMode = (value: unknown): RouteMode | null =>
  value === 'straight' || value === 'imported' ? value : null;

/** Point de la géométrie d'un tronçon. */
export interface RoutePoint {
  lat: number;
  lon: number;
}

/** `ready` : géométrie définitive, seul état depuis que plus rien ne se calcule. */
export type LegStatus = 'ready';

export interface RouteLeg {
  mode: RouteMode;
  status: LegStatus;
  /** Géométrie, du point de départ du tronçon à son point d'arrivée. */
  points: RoutePoint[];
}

/** `legs[i]` relie `waypoints[i]` à `waypoints[i + 1]` : un tronçon de moins que de points. */
export interface PlannedRoute {
  waypoints: Waypoint[];
  legs: RouteLeg[];
}

export const EMPTY_ROUTE: PlannedRoute = { waypoints: [], legs: [] };

/**
 * Tronçon neuf entre deux points, en ligne droite : une trace importée ne se
 * refait pas entre deux points quelconques.
 */
export const newLeg = (from: Waypoint, to: Waypoint): RouteLeg => ({
  mode: 'straight',
  status: 'ready',
  points: [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }],
});

/** Ajoute un point à la fin, relié au précédent en ligne droite. */
export const addWaypoint = (route: PlannedRoute, waypoint: Waypoint): PlannedRoute => {
  const last = route.waypoints[route.waypoints.length - 1];
  return {
    waypoints: [...route.waypoints, waypoint],
    legs: last ? [...route.legs, newLeg(last, waypoint)] : route.legs,
  };
};

/**
 * Insère un point au milieu du tronçon `legIndex`, qui devient deux tronçons
 * du même mode. Sur une trace importée, le point se pose sur la trace, au plus
 * près de `waypoint`, et la coupe en deux sans rien en perdre ; au bout de la
 * trace, il n'y a rien à couper.
 */
export const insertWaypoint = (route: PlannedRoute, legIndex: number, waypoint: Waypoint): PlannedRoute => {
  const leg = route.legs[legIndex];
  if (!leg) return route;
  if (leg.mode === 'imported') {
    const cut = splitPath(leg.points, waypoint);
    if (!cut) return route;
    return {
      waypoints: [...route.waypoints.slice(0, legIndex + 1), { lat: cut.at.lat, lon: cut.at.lon }, ...route.waypoints.slice(legIndex + 1)],
      legs: [
        ...route.legs.slice(0, legIndex),
        { mode: 'imported', status: 'ready', points: cut.before },
        { mode: 'imported', status: 'ready', points: cut.after },
        ...route.legs.slice(legIndex + 1),
      ],
    };
  }
  const from = route.waypoints[legIndex];
  const to = route.waypoints[legIndex + 1];
  return {
    waypoints: [...route.waypoints.slice(0, legIndex + 1), waypoint, ...route.waypoints.slice(legIndex + 1)],
    legs: [...route.legs.slice(0, legIndex), newLeg(from, waypoint), newLeg(waypoint, to), ...route.legs.slice(legIndex + 1)],
  };
};

/**
 * Déplace un point : seuls les tronçons qui le touchent sont refaits, en
 * ligne droite (un tronçon importé touché aussi). Sur une boucle, départ et
 * arrivée ne font qu'un point : ils bougent ensemble et la boucle reste
 * fermée.
 */
export const moveWaypoint = (route: PlannedRoute, index: number, waypoint: Waypoint): PlannedRoute => {
  const last = route.waypoints.length - 1;
  if (index < 0 || index > last) return route;
  const moved = isLooped(route) && (index === 0 || index === last) ? [0, last] : [index];
  const waypoints = route.waypoints.map((w, i) => (moved.includes(i) ? waypoint : w));
  const legs = route.legs.map((leg, i) =>
    moved.includes(i) || moved.includes(i + 1) ? newLeg(waypoints[i], waypoints[i + 1]) : leg
  );
  return { waypoints, legs };
};

/**
 * Retire un point. Au milieu, ses deux tronçons sont remplacés par une ligne
 * droite ; deux tronçons importés sont recollés, tracé intact. Si les deux
 * voisins sont au même endroit (retour au départ), ils fusionnent : la boucle
 * A → B → A privée de B est le seul A.
 */
export const removeWaypoint = (route: PlannedRoute, index: number): PlannedRoute => {
  const n = route.waypoints.length;
  if (index < 0 || index >= n) return route;
  const waypoints = route.waypoints.filter((_, i) => i !== index);
  if (index === 0) return { waypoints, legs: route.legs.slice(1) };
  if (index === n - 1) return { waypoints, legs: route.legs.slice(0, -1) };
  // Ses deux voisins au même endroit (B dans A → B → A) : ils ne font plus qu'un point, sans tronçon de lui à lui-même.
  if (samePlace(route.waypoints[index - 1], route.waypoints[index + 1])) {
    return {
      waypoints: route.waypoints.filter((_, i) => i !== index && i !== index + 1),
      legs: [...route.legs.slice(0, index - 1), ...route.legs.slice(index + 1)],
    };
  }
  const before = route.legs[index - 1];
  const after = route.legs[index];
  const merged: RouteLeg = before.mode === 'imported' && after.mode === 'imported'
    ? { mode: 'imported', status: 'ready', points: joinPaths(before.points, after.points) }
    : newLeg(route.waypoints[index - 1], route.waypoints[index + 1]);
  return { waypoints, legs: [...route.legs.slice(0, index - 1), merged, ...route.legs.slice(index + 1)] };
};

/** Change le mode d'un tronçon : passé en ligne droite, une trace importée est refaite entre ses deux points. */
export const setLegMode = (route: PlannedRoute, legIndex: number, mode: RouteMode): PlannedRoute => {
  const leg = route.legs[legIndex];
  if (!leg || leg.mode === mode || mode === 'imported') return route;
  const legs = route.legs.map((l, i) => (i === legIndex ? newLeg(route.waypoints[i], route.waypoints[i + 1]) : l));
  return { ...route, legs };
};

/** Parcours dans l'autre sens : chaque tracé est simplement retourné. */
export const reverseRoute = (route: PlannedRoute): PlannedRoute => ({
  waypoints: [...route.waypoints].reverse(),
  legs: [...route.legs].reverse().map((leg) => ({ mode: leg.mode, status: 'ready', points: [...leg.points].reverse() })),
});

/** Vrai si le dernier point est au départ : l'itinéraire est déjà bouclé. */
export const isLooped = (route: PlannedRoute): boolean => {
  const n = route.waypoints.length;
  return n >= 3 && route.waypoints[0].lat === route.waypoints[n - 1].lat && route.waypoints[0].lon === route.waypoints[n - 1].lon;
};

/** Boucle : un dernier tronçon, en ligne droite, ramène au départ. Sans effet sous deux points, ni sur un itinéraire déjà bouclé. */
export const closeLoop = (route: PlannedRoute): PlannedRoute =>
  route.waypoints.length < 2 || isLooped(route) ? route : addWaypoint(route, route.waypoints[0]);

/** Un bord d'un parcours de voile : d'une balise à la suivante, en ligne droite. */
export interface CourseLeg {
  distanceM: number;
  /** Cap de la balise de départ vers la suivante, en degrés depuis le nord. */
  bearingDeg: number;
}

/** Bords du parcours, de balise en balise : `courseLegs(route)[i]` va du point `i` au point `i + 1`. */
export const courseLegs = (route: PlannedRoute): CourseLeg[] =>
  route.waypoints.slice(1).map((to, i) => {
    const from = route.waypoints[i];
    return {
      distanceM: haversineDistance(from.lat, from.lon, to.lat, to.lon),
      bearingDeg: initialBearing(from.lat, from.lon, to.lat, to.lon),
    };
  });

/**
 * Change la place d'un point dans l'ordre du parcours. Un tronçon dont les
 * deux extrémités n'ont pas changé est gardé tel quel ; les autres sont
 * refaits en ligne droite.
 */
export const reorderWaypoint = (route: PlannedRoute, from: number, to: number): PlannedRoute => {
  const n = route.waypoints.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return route;
  const waypoints = [...route.waypoints];
  const [moved] = waypoints.splice(from, 1);
  waypoints.splice(to, 0, moved);
  const legs = waypoints.slice(1).map((w, i) => {
    const kept = route.legs.find((_, j) => route.waypoints[j] === waypoints[i] && route.waypoints[j + 1] === w);
    return kept ?? newLeg(waypoints[i], w);
  });
  return { waypoints, legs };
};

/** Écart sous lequel l'arrivée d'une trace chargée est prise pour son départ, en mètres. Défaut de `routeFromTrack`. */
export const DEFAULT_LOOP_CLOSE_M = 30;

/**
 * Itinéraire tiré d'une trace chargée (un GPX téléchargé ailleurs) : la trace
 * est gardée telle quelle, en tronçons `imported`, entre le départ et
 * l'arrivée, seuls points de passage. Points répétés et positions illisibles
 * retirés, altitude laissée de côté. Si l'arrivée est à moins de `loopCloseM`
 * du départ, c'est une boucle : elle revient exactement au départ, par un
 * point posé à mi-parcours (une boucle a trois points, `isLooped`). `null`
 * sous deux points distincts.
 */
export const routeFromTrack = (
  points: ReadonlyArray<RoutePoint>,
  { loopCloseM = DEFAULT_LOOP_CLOSE_M }: { loopCloseM?: number } = {}
): PlannedRoute | null => {
  const kept: RoutePoint[] = [];
  for (const p of points) {
    if (!isFinite(p.lat) || !isFinite(p.lon) || samePlace(kept[kept.length - 1], p)) continue;
    kept.push({ lat: p.lat, lon: p.lon });
  }
  if (kept.length < 2) return null;
  const first = kept[0];
  const last = kept[kept.length - 1];
  const start: Waypoint = { lat: first.lat, lon: first.lon };
  const closes = kept.length >= 3 && haversineDistance(first.lat, first.lon, last.lat, last.lon) <= loopCloseM;
  if (!closes) {
    return { waypoints: [start, { lat: last.lat, lon: last.lon }], legs: [{ mode: 'imported', status: 'ready', points: kept }] };
  }

  const path = samePlace(first, last) ? kept : [...kept, { ...first }];
  const cum = cumulativeDistancesM(path);
  const half = cum[cum.length - 1] / 2;
  // Point à mi-parcours, jamais au départ ni à l'arrivée.
  const mid = Math.min(path.length - 2, Math.max(1, cum.findIndex((d) => d >= half)));
  return {
    waypoints: [start, { lat: path[mid].lat, lon: path[mid].lon }, start],
    legs: [
      { mode: 'imported', status: 'ready', points: path.slice(0, mid + 1) },
      { mode: 'imported', status: 'ready', points: path.slice(mid) },
    ],
  };
};

/** Point entre `a` et `b` à la fraction `t`. */
const interpolatePoint = (a: RoutePoint, b: RoutePoint, t: number): RoutePoint => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

/**
 * Point du tracé le plus proche de `p` : le tronçon `index` et la fraction `t`
 * le long de lui. Plan local équirectangulaire centré sur `p`, exact à mieux
 * que le mètre à l'échelle d'un toucher sur la carte.
 */
const nearestOnPath = (points: ReadonlyArray<RoutePoint>, p: Waypoint): { index: number; t: number } => {
  let best = { index: 0, t: 0, d2: Infinity };
  for (let i = 0; i + 1 < points.length; i++) {
    const { t, offsetX, offsetY } = projectOnSegment(p, points[i], points[i + 1]);
    const d2 = offsetX ** 2 + offsetY ** 2;
    if (d2 < best.d2) best = { index: i, t, d2 };
  }
  return best;
};

/**
 * Tracé coupé au point le plus proche de `target` : les deux parts partagent
 * le point de coupe. `null` si la coupe tombe à un bout (rien à couper).
 */
const splitPath = (
  points: ReadonlyArray<RoutePoint>,
  target: Waypoint
): { at: RoutePoint; before: RoutePoint[]; after: RoutePoint[] } | null => {
  if (points.length < 2) return null;
  const { index, t } = nearestOnPath(points, target);
  const at = interpolatePoint(points[index], points[index + 1], t);
  const before = points.slice(0, index + 1);
  if (!samePlace(before[before.length - 1], at)) before.push(at);
  const rest = points.slice(index + 1);
  const after = samePlace(rest[0], at) ? rest : [at, ...rest];
  if (samePlace(at, points[0]) || samePlace(at, points[points.length - 1])) return null;
  return { at, before, after };
};

/** Deux tracés qui se suivent, d'un seul trait : le point de jonction n'est compté qu'une fois. */
const joinPaths = (a: RoutePoint[], b: RoutePoint[]): RoutePoint[] =>
  samePlace(a[a.length - 1], b[0]) ? [...a, ...b.slice(1)] : [...a, ...b];

/** Tout l'itinéraire d'un seul trait, point de jonction entre deux tronçons compté une fois. */
export const routePoints = (route: PlannedRoute): RoutePoint[] => joinLegs(route.legs)[0] ?? [];

/**
 * Pour chaque point : distance depuis le départ, et longueur du tronçon qui y
 * arrive (0 pour le départ), en mètres, le long des tracés.
 */
export const waypointDistances = (route: PlannedRoute): { cumulativeM: number; legM: number }[] => {
  let cumulativeM = 0;
  return route.waypoints.map((_, i) => {
    const leg = i > 0 ? route.legs[i - 1] : undefined;
    const cum = leg ? cumulativeDistancesM(leg.points) : [];
    const legM = cum.length > 0 ? cum[cum.length - 1] : 0;
    cumulativeM += legM;
    return { cumulativeM, legM };
  });
};

export interface RouteTotals {
  distanceM: number;
}

/** Distance le long des tracés, jonctions comptées une fois. */
export const routeTotals = (route: PlannedRoute): RouteTotals => {
  const cum = cumulativeDistancesM(routePoints(route));
  return { distanceM: cum.length > 0 ? cum[cum.length - 1] : 0 };
};
