import { dayMonthNumeric } from '../core/calendar';
import { haversineDistance } from '../core/geo';
import { t } from '../core/i18n';
import type { LatLon } from '../core/types';
import { isLooped, type Waypoint } from '../planning/route';
import { isWritableRouteRecord, type RouteRecord } from '../planning/routeRecord';
import { PLACE_RULES, isElsewhere, readSessionPlace, type PlaceRules, type PlaceSpot, type SessionPlace } from './places';
import { distinctArrival } from './sessionName';

/**
 * Nom montré d'un itinéraire planifié, la seule place où il se compose : celui que l'utilisateur a saisi, sinon
 * « Boucle à Lieu le 20/11 » ou « Aller de Départ à Arrivée le 20/11 », calculé à chaque affichage et jamais
 * écrit dans la fiche, qui garde un nom vide, son lieu (`place`, trouvé comme celui d'une session) et sa date de
 * création. Le nom suit donc la langue, et le lieu trouvé après le rangement.
 */

/** Boucle (le dernier point revient au départ) ou aller. */
export type RouteKind = 'boucle' | 'aller';

/** Ce que le nom lit de la fiche. */
export type RouteNameSource = Pick<RouteRecord, 'name' | 'waypoints' | 'createdAt'> & { place?: unknown };

/** Genre d'un itinéraire d'après ses points : une boucle a au moins trois points, le dernier sur le départ (`isLooped`). */
export const routeKind = (waypoints: readonly Waypoint[]): RouteKind =>
  isLooped({ waypoints: [...waypoints], legs: [] }) ? 'boucle' : 'aller';

/** Lieu rangé dans la fiche, `undefined` s'il est absent ou mal formé (il sera cherché de nouveau). */
export const routePlace = (record: { place?: unknown }): SessionPlace | undefined => readSessionPlace(record.place) ?? undefined;

/** Vrai si le lieu a été trouvé à moins de `rules.learnedRadiusM` du point : il vaut encore pour lui. */
const stillAt = (spot: PlaceSpot, point: LatLon, rules: PlaceRules): boolean =>
  haversineDistance(spot.lat, spot.lon, point.lat, point.lon) <= rules.learnedRadiusM;

/**
 * Nom montré : le nom saisi, sinon le nom composé du genre, du lieu et du jour de création (jour et mois, dans
 * l'ordre de la langue). L'arrivée d'un aller n'y paraît que si elle porte un autre nom que le départ. Un lieu
 * périmé n'est jamais cité : celui du départ seulement si le départ n'a pas bougé de plus de `learnedRadiusM`
 * depuis qu'il a été trouvé, celui de l'arrivée de même pour le dernier point (même contrôle que
 * `routePlaceTarget`, qui le fera chercher de nouveau).
 */
export const routeDisplayName = (record: RouteNameSource, rules: PlaceRules = PLACE_RULES): string => {
  const typed = record.name.trim();
  if (typed) return typed;
  const date = dayMonthNumeric(Date.parse(record.createdAt) || 0);
  const place = routePlace(record);
  const { waypoints } = record;
  const start = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const departure = place && start && stillAt(place, start, rules) ? place.name?.trim() || null : null;
  if (routeKind(waypoints) === 'boucle') {
    return departure ? t('Boucle à {place} le {date}', { place: departure, date }) : t('Boucle du {date}', { date });
  }
  if (!departure) return t('Aller du {date}', { date });
  const arrival = place?.arrival && last && stillAt(place.arrival, last, rules) ? distinctArrival(place) : null;
  return arrival ? t('Aller de {from} à {to} le {date}', { from: departure, to: arrival, date }) : t('Aller de {from} le {date}', { from: departure, date });
};

/**
 * Ce que la recherche du lieu d'un itinéraire doit faire : le départ (`start`) et son lieu gardé (`departure`, nul :
 * à chercher) ; le point d'arrivée à chercher (`end`, nul : rien à chercher), et sinon l'arrivée à ranger
 * (`arrival` : un lieu encore juste, ou nul quand l'arrivée n'a pas de lieu à elle).
 */
export interface RoutePlaceTarget {
  start: LatLon;
  departure: PlaceSpot | null;
  end: LatLon | null;
  arrival: PlaceSpot | null;
}

/**
 * Fiche relue à qui ranger le lieu trouvé, `null` si elle a changé depuis le début de la recherche (autre
 * `updatedAt` : rangée de nouveau entre-temps), si elle a reçu un nom saisi ou si elle est d'une version plus
 * récente. Le lieu ne compte pas comme un rangement : `updatedAt` est gardé.
 */
export const routeRecordWithPlace = (record: RouteRecord, place: SessionPlace, expectedUpdatedAt: string): RouteRecord | null =>
  record.updatedAt === expectedUpdatedAt && record.name.trim() === '' && isWritableRouteRecord(record) ? { ...record, place } : null;

const spotOf = ({ name, source, lat, lon }: PlaceSpot): PlaceSpot => ({ name, source, lat, lon });

/**
 * Recherche à faire pour le lieu d'un itinéraire, `null` s'il n'y a rien à faire (moins de deux points, ou lieu
 * à jour). Le lieu du départ vaut tant que le départ n'a pas bougé de plus de `learnedRadiusM` ; l'arrivée n'a un
 * lieu à elle que sur un aller qui finit à plus de `elsewhereM` du départ, et le sien vaut de même tant qu'elle
 * n'a pas bougé. Une boucle, ou un aller qui finit près du départ, range une arrivée nulle, sans recherche.
 */
export const routePlaceTarget = (
  place: SessionPlace | undefined, waypoints: readonly Waypoint[], rules: PlaceRules
): RoutePlaceTarget | null => {
  if (waypoints.length < 2) return null;
  const start = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const departure = place && stillAt(place, start, rules) ? spotOf(place) : null;
  const needsArrival = routeKind(waypoints) === 'aller' && isElsewhere(start, last, rules);
  const known = needsArrival && place?.arrival && stillAt(place.arrival, last, rules) ? place.arrival : null;
  const end = needsArrival && !known ? last : null;
  if (departure && !end && place?.arrival === (needsArrival ? known : null)) return null;
  return { start, departure, end, arrival: known ? spotOf(known) : null };
};
