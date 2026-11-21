import type { LatLon } from '../core/types';
import {
  PLACE_RULES, learnedSpot, nearestLearnedPlace, spotFromSearch, type LearnedPlace, type PlaceRules, type PlaceSpot,
  type SessionPlace,
} from '../library/places';
import { sameJson } from '../library/record';
import { routePlace, routePlaceTarget } from '../library/routeName';
import { reversePlaces, type PhotonFeature } from '../planning/geocoding';
import { readDeviceLearnedPlaces } from './learnedPlacesFile';
import { saveRoutePlace, type SavedRoute } from './routeFiles';
import { isPlaceSearchOn } from './usePlaceSearch';

/**
 * Lieu d'un itinéraire planifié sans nom saisi, qui compose son nom montré (`library/routeName.ts`) : cherché comme
 * celui d'une session, après son rangement et à son ouverture dans Planifier, jamais pour toute la liste.
 *
 * - Un lieu appris par les sessions à moins de `learnedRadiusM` du point est pris sans interroger le service,
 *   recherche coupée comprise ; un itinéraire n'apprend aucun lieu.
 * - Sinon le lieu est cherché en ligne si la recherche est permise (Réglages) : deux requêtes au plus (départ, puis
 *   arrivée d'un aller lointain), espacées d'au moins `intervalMs`, une recherche à la fois.
 * - Sans réseau, le départ n'est pas rangé : l'itinéraire reste sans lieu et sera cherché au prochain rangement ou
 *   à la prochaine ouverture. Une arrivée qui n'a pu être cherchée reste à regarder de même.
 * - Le lieu n'est rangé que si la fiche n'a pas été rangée de nouveau entre-temps et n'a toujours pas de nom saisi.
 */

/** Ce dont la recherche a besoin, remplaçable dans les tests. */
export interface RoutePlaceDeps {
  /** Recherche en ligne active (Réglages). */
  enabled: () => boolean;
  /** Lieux appris par les sessions. */
  learned: () => readonly LearnedPlace[];
  /** Objets de la carte autour du point ; lève une erreur sans réponse. */
  search: (point: LatLon, rules: PlaceRules) => Promise<PhotonFeature[]>;
  /** Range le lieu dans la fiche relue, si elle n'a pas changé depuis `expectedUpdatedAt` (`saveRoutePlace`). */
  save: (base: string, place: SessionPlace, expectedUpdatedAt: string) => Promise<SavedRoute | null>;
  rules: PlaceRules;
  /** Écart minimal entre deux requêtes, en millisecondes. */
  intervalMs: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recherche du lieu des itinéraires sur `deps` : voir l'en-tête. La fonction rendue range le lieu de l'itinéraire
 * s'il reste à trouver, et rend l'itinéraire mis à jour ; `null` si rien n'est rangé.
 */
export const createRoutePlaceFinder = (deps: RoutePlaceDeps) => {
  let lastRequestAt = -Infinity;
  let chain: Promise<unknown> = Promise.resolve();

  /** Lieu d'un point : un lieu appris, sinon une recherche en ligne ; `null` sans lieu appris, recherche coupée ou sans réponse. */
  const lookup = async (point: LatLon): Promise<PlaceSpot | null> => {
    const known = nearestLearnedPlace(point, deps.learned(), deps.rules);
    if (known) return learnedSpot(known, point);
    if (!deps.enabled()) return null;
    const wait = lastRequestAt + deps.intervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    if (!deps.enabled()) return null;
    lastRequestAt = Date.now();
    let features: PhotonFeature[];
    try {
      features = await deps.search(point, deps.rules);
    } catch {
      return null;
    }
    return deps.enabled() ? spotFromSearch(features, point, deps.learned(), deps.rules) : null;
  };

  const find = async (saved: SavedRoute): Promise<SavedRoute | null> => {
    const { record } = saved;
    if (saved.readOnly || record.name.trim() !== '') return null;
    const before = routePlace(record);
    const target = routePlaceTarget(before, record.waypoints, deps.rules);
    if (!target) return null;
    const departure = target.departure ?? await lookup(target.start);
    if (!departure) return null;
    const arrival = target.end ? await lookup(target.end) : target.arrival;
    // Arrivée à chercher restée sans réponse : laissée à regarder (absente de la fiche).
    const place: SessionPlace = arrival === null && target.end ? { ...departure } : { ...departure, arrival };
    if (sameJson(place, before)) return null;
    return deps.save(saved.base, place, record.updatedAt);
  };

  return (saved: SavedRoute): Promise<SavedRoute | null> => {
    const next = chain.then(() => find(saved));
    chain = next.catch(() => undefined);
    return next;
  };
};

/** Au plus une requête par seconde, comme pour les sessions. */
const ROUTE_PLACE_REQUEST_INTERVAL_MS = 1000;

/**
 * Range le lieu d'un itinéraire sans nom saisi s'il reste à trouver (voir l'en-tête) ; rend l'itinéraire mis à
 * jour, `null` si rien n'est rangé. Un échec d'écriture est tu : la recherche sera refaite plus tard.
 */
export const findRoutePlace = createRoutePlaceFinder({
  enabled: isPlaceSearchOn,
  learned: readDeviceLearnedPlaces,
  search: (point, rules) => reversePlaces(point, { limit: rules.resultLimit, radiusM: rules.waterRadiusM }),
  save: (base, place, expectedUpdatedAt) => saveRoutePlace(base, place, expectedUpdatedAt).catch(() => null),
  rules: PLACE_RULES,
  intervalMs: ROUTE_PLACE_REQUEST_INTERVAL_MS,
});
