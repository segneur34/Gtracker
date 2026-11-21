import { sanitizeMarkGuide, type MarkGuideSettings } from '../recording/markGuide';
import { DEFAULT_ROUTE_MODE, newLeg, readRouteMode, type PlannedRoute, type RouteLeg, type RouteMode, type RoutePoint, type Waypoint } from './route';
import { isFiniteNumber, isObject, parseJson } from '../core/basics';
import { FILE_FORMATS } from '../core/appIdentity';

/**
 * Fiche d'un itinéraire : le fichier JSON rangé dans `itineraires/` du
 * dossier mémoire, à côté de son GPX (`routeGpx.ts`).
 *
 * La fiche fait foi : elle seule porte les points de passage, le mode de
 * chaque tronçon et leur tracé. Le GPX n'en est que l'export, réécrit à
 * chaque rangement.
 *
 * Mêmes règles de compatibilité que les fiches de session
 * (`library/record.ts`) : champs inconnus conservés à la réécriture, fiche
 * d'une version future lue mais jamais réécrite.
 */

export const ROUTE_FORMAT = FILE_FORMATS.itineraire;
/**
 * 4 : balises reliées en ligne droite (`straight`) et traces d'un GPX chargé
 * (`imported`), points en `[lat, lon]`, depuis le retrait du planificateur
 * routier. Les fiches de version 2 et 3, écrites avant lui, se
 * relisent sans code à part et restent modifiables : un tronçon calculé (type
 * de voie, mode inconnu) devient une ligne droite neuve, l'altitude des points
 * est ignorée, leurs autres champs (`loop`, `surfaces`, `pending`) passent sans
 * servir ; réécrites, elles prennent la version 4. Une version 5 ou plus vient
 * d'une version plus récente : lue, jamais réécrite.
 */
export const ROUTE_VERSION = 4;

/** Point de tracé compact : `[lat, lon]` ; une altitude en troisième place, d'avant le retrait du routage, est ignorée. */
type StoredPoint = number[];

interface StoredLeg {
  mode: RouteMode;
  points: StoredPoint[];
}

export interface RouteRecord {
  format: typeof ROUTE_FORMAT;
  version: number;
  /** Nom saisi par l'utilisateur ; vide : le nom se compose à l'affichage (`routeDisplayName`, `library/routeName.ts`). */
  name: string;
  /** Activité choisie pour l'itinéraire (unités d'affichage, terrain) ; `null` : aucune. */
  activityId: string | null;
  /** Dates ISO de création et de dernier rangement. */
  createdAt: string;
  updatedAt: string;
  waypoints: Waypoint[];
  legs: StoredLeg[];
  /**
   * Bips d'approche propres à ce parcours (voile, surf), tels que rangés ; absents :
   * ceux de l'activité. À relire par `routeMarkGuide`.
   */
  markGuide?: unknown;
  /**
   * Lieu du départ et de l'arrivée, trouvé comme celui d'une session tant que le nom est vide ; gardé à la
   * réécriture. À relire par `routePlace` (`library/routeName.ts`), qui écarte un lieu mal formé.
   */
  place?: unknown;
  [unknown: string]: unknown;
}


const round = (value: number, digits: number): number => Number(value.toFixed(digits));

const storePoint = (p: RoutePoint): StoredPoint => [round(p.lat, 7), round(p.lon, 7)];

const readPoint = (raw: unknown): RoutePoint | null =>
  Array.isArray(raw) && isFiniteNumber(raw[0]) && isFiniteNumber(raw[1]) ? { lat: raw[0], lon: raw[1] } : null;

const readWaypoint = (raw: unknown): Waypoint | null =>
  isObject(raw) && isFiniteNumber(raw.lat) && isFiniteNumber(raw.lon) ? { lat: raw.lat, lon: raw.lon } : null;

/**
 * Fiche d'un itinéraire. `previous` : la fiche relue, dont les champs
 * inconnus sont gardés. `meta.markGuide` : bips propres au parcours ;
 * `null` les retire, absent garde ceux de `previous`.
 */
export const routeToRecord = (
  route: PlannedRoute,
  meta: { name: string; activityId: string | null; createdAt: string; updatedAt: string; markGuide?: MarkGuideSettings | null },
  previous?: RouteRecord
): RouteRecord => {
  const record: RouteRecord = {
    ...previous,
    format: ROUTE_FORMAT,
    version: ROUTE_VERSION,
    name: meta.name,
    activityId: meta.activityId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    waypoints: route.waypoints.map((w) => ({ lat: round(w.lat, 7), lon: round(w.lon, 7) })),
    legs: route.legs.map((leg) => ({ mode: leg.mode, points: leg.points.map(storePoint) })),
  };
  if (meta.markGuide === null) delete record.markGuide;
  else if (meta.markGuide !== undefined) record.markGuide = meta.markGuide;
  return record;
};

/** Bips d'approche propres au parcours, s'ils sont lisibles ; `null` : ceux de l'activité. */
export const routeMarkGuide = (record: RouteRecord): MarkGuideSettings | null => sanitizeMarkGuide(record.markGuide);

/**
 * Itinéraire d'une fiche. Un tronçon illisible, d'un mode inconnu (un type de
 * voie d'avant le retrait du routage), ou des tronçons qui ne correspondent pas aux
 * points, deviennent des lignes droites neuves plutôt que d'être perdus
 * (`newLeg`).
 */
export const recordToRoute = (record: RouteRecord): PlannedRoute => {
  const { waypoints } = record;
  const legs: RouteLeg[] = [];
  for (let i = 0; i + 1 < waypoints.length; i++) {
    const stored = record.legs.length === waypoints.length - 1 ? record.legs[i] : undefined;
    const mode = readRouteMode(stored?.mode);
    const points = (stored?.points ?? []).map(readPoint).filter((p): p is RoutePoint => p !== null);
    legs.push(mode && points.length >= 2 ? { mode, status: 'ready', points } : newLeg(waypoints[i], waypoints[i + 1]));
  }
  return { waypoints, legs };
};

/** Tronçon relu d'une fiche : son mode, ou une ligne droite sans tracé (à refaire) s'il est inconnu. */
const readStoredLeg = (leg: Record<string, unknown>): StoredLeg & Record<string, unknown> => {
  const mode = readRouteMode(leg.mode);
  return { ...leg, mode: mode ?? DEFAULT_ROUTE_MODE, points: mode && Array.isArray(leg.points) ? (leg.points as StoredPoint[]) : [] };
};

/** Lit une fiche ; `null` si le texte n'en est pas une lisible. Les champs inconnus sont gardés. */
export const parseRouteRecord = (text: string): RouteRecord | null => {
  const raw = parseJson(text);
  if (!isObject(raw) || raw.format !== ROUTE_FORMAT || !isFiniteNumber(raw.version)) return null;
  if (!Array.isArray(raw.waypoints)) return null;
  const waypoints = raw.waypoints.map(readWaypoint);
  if (waypoints.some((w) => w === null)) return null;
  const legs = Array.isArray(raw.legs) ? raw.legs.filter(isObject) : [];
  const now = new Date(0).toISOString();
  return {
    ...raw,
    format: ROUTE_FORMAT,
    version: raw.version,
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    activityId: typeof raw.activityId === 'string' && raw.activityId !== '' ? raw.activityId : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    waypoints: waypoints as Waypoint[],
    legs: legs.map(readStoredLeg),
  };
};

/** Texte de la fiche. Sans indentation : le tracé compte des milliers de points. */
export const serializeRouteRecord = (record: RouteRecord): string => `${JSON.stringify(record)}\n`;

/** Faux pour une fiche écrite par une version plus récente : on la lit sans jamais la réécrire. */
export const isWritableRouteRecord = (record: RouteRecord): boolean => record.version <= ROUTE_VERSION;

/** Caractères refusés dans un nom de fichier par Windows ou Android (ceux de contrôle ne se saisissent pas). */
const FORBIDDEN = /[\\/:*?"<>|]/g;

/**
 * Nom de fichier (sans extension) d'un nouvel itinéraire, tiré de son nom :
 * `nom`, sinon `nom-2`, `nom-3`… `taken` : les noms déjà présents dans le
 * dossier, extension comprise. La comparaison ignore la casse, comme Windows.
 * Le nom de fichier ne change plus ensuite, même si l'itinéraire est renommé.
 */
export const routeFileBase = (name: string, taken: Iterable<string>): string => {
  const used = new Set([...taken].map((n) => n.toLowerCase().replace(/\.(json|gpx)$/, '')));
  const base = name.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80) || 'itineraire';
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
};
