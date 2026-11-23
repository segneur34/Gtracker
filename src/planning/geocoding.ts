import { fetchJson } from './fetchJson';
import type { Waypoint } from './route';
import { isObject } from '../core/basics';
import { currentLang, t } from '../core/i18n';

/** Langue demandée au service de noms de lieux : il ne connaît pas l'espagnol, l'anglais le remplace. */
const placesLang = (): string => (currentLang() === 'fr' ? 'fr' : 'en');

/**
 * Recherche d'un lieu par son nom (commune, sommet, refuge, adresse), et
 * recherche inverse (les lieux autour d'une position), par le service public
 * Photon de komoot, bâti sur les données OpenStreetMap. Sans clé ; il autorise
 * l'appel depuis n'importe quelle page. Seuls `searchPlaces` et `reversePlaces`
 * touchent au réseau.
 */

export const PHOTON_URL = 'https://photon.komoot.io/api/';

/** Adresse de la recherche inverse du même service. */
export const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';

/**
 * Décimales gardées d'une position envoyée à la recherche inverse : trois, une centaine de mètres. Le
 * service ne reçoit jamais la position exacte.
 */
export const REVERSE_COORD_DECIMALS = 3;

/**
 * Décimales gardées du centre de la carte envoyé à la recherche d'un lieu par son nom : deux, environ un
 * kilomètre. Il ne sert qu'à faire passer les lieux proches devant leurs homonymes, pas à situer l'utilisateur.
 */
export const NEAR_COORD_DECIMALS = 2;

/** Délai accordé à la recherche, en millisecondes : au-delà, elle échoue, et l'on peut relancer. */
export const PHOTON_TIMEOUT_MS = 20_000;

export interface Place extends Waypoint {
  /** Nom du lieu. */
  label: string;
  /** Où il se trouve : commune, département, pays, ce qui est connu. */
  detail: string;
}

/**
 * Adresse de la recherche. `near` : le centre de la carte, pour que les
 * lieux proches passent devant leurs homonymes lointains.
 */
export const photonUrl = (query: string, near?: Waypoint, limit = 6): string => {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: placesLang() });
  if (near) {
    params.set('lat', near.lat.toFixed(NEAR_COORD_DECIMALS));
    params.set('lon', near.lon.toFixed(NEAR_COORD_DECIMALS));
  }
  return `${PHOTON_URL}?${params.toString()}`;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Entrées de la réponse qui ont une position lisible, avec leurs propriétés. */
const readFeatures = (json: unknown): { p: Record<string, unknown>; lat: number; lon: number }[] => {
  if (!isObject(json) || !Array.isArray(json.features)) return [];
  const out: { p: Record<string, unknown>; lat: number; lon: number }[] = [];
  for (const feature of json.features) {
    if (!isObject(feature) || !isObject(feature.properties) || !isObject(feature.geometry)) continue;
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates)) continue;
    const [lon, lat] = coordinates as unknown[];
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) continue;
    out.push({ p: feature.properties, lat, lon });
  }
  return out;
};

/**
 * Objet de la carte rendu par la recherche inverse : son nom tel quel (`null` sans nom), son étiquette
 * principale dans OpenStreetMap (`osm_key`, `osm_value` : `natural` et `beach` pour une plage), sa commune
 * et sa position.
 */
export interface PhotonFeature {
  name: string | null;
  osmKey: string | null;
  osmValue: string | null;
  city: string | null;
  lat: number;
  lon: number;
}

/** Objets de la réponse, dans son ordre ; les entrées sans position sont écartées. */
export const parsePhotonFeatures = (json: unknown): PhotonFeature[] =>
  readFeatures(json).map(({ p, lat, lon }) => ({
    name: text(p.name), osmKey: text(p.osm_key), osmValue: text(p.osm_value), city: text(p.city), lat, lon,
  }));

/** Lieux de la réponse ; les entrées mal formées sont écartées. */
export const parsePhoton = (json: unknown): Place[] => {
  const places: Place[] = [];
  for (const { p, lat, lon } of readFeatures(json)) {
    const street = text(p.street);
    const label = text(p.name) ?? (street ? [text(p.housenumber), street].filter(Boolean).join(' ') : null) ?? text(p.city);
    if (!label) continue;
    const detail = [text(p.city), text(p.county), text(p.country)]
      .filter((part, i, all): part is string => part !== null && part !== label && all.indexOf(part) === i)
      .join(', ');
    places.push({ label, detail, lat, lon });
  }
  return places;
};

/** Position arrondie à `REVERSE_COORD_DECIMALS` décimales, celle qui part en ligne. */
export const roundedPoint = (point: Waypoint): Waypoint => {
  const factor = 10 ** REVERSE_COORD_DECIMALS;
  return { lat: Math.round(point.lat * factor) / factor, lon: Math.round(point.lon * factor) / factor };
};

/** Ce que demande une recherche inverse, en plus de la position : nombre d'objets rendus, rayon en mètres. */
export interface ReverseQuery {
  limit: number;
  radiusM: number;
}

/**
 * Adresse de la recherche inverse : la position arrondie (`roundedPoint`), la langue, le nombre d'objets
 * et le rayon (en kilomètres pour le service), rien d'autre. Aucun filtre côté serveur : le choix se
 * fait dans l'application, sur les étiquettes de chaque objet.
 */
export const photonReverseUrl = (point: Waypoint, { limit, radiusM }: ReverseQuery): string => {
  const at = roundedPoint(point);
  const params = new URLSearchParams({
    lat: at.lat.toFixed(REVERSE_COORD_DECIMALS),
    lon: at.lon.toFixed(REVERSE_COORD_DECIMALS),
    lang: placesLang(),
    limit: String(limit),
    radius: String(radiusM / 1000),
  });
  return `${PHOTON_REVERSE_URL}?${params.toString()}`;
};

/** Objets de la carte autour de `point` (`photonReverseUrl`). Lève une erreur au message lisible, réseau absent compris. */
export const reversePlaces = async (point: Waypoint, query: ReverseQuery, signal?: AbortSignal): Promise<PhotonFeature[]> =>
  parsePhotonFeatures(await fetchJson(photonReverseUrl(point, query), { signal }, {
    noNetwork: t('Pas de réseau : le lieu de la session sera cherché plus tard.'),
    timeout: t('La recherche du lieu ne répond pas.'),
    timeoutMs: PHOTON_TIMEOUT_MS,
    unreadable: t('Réponse de la recherche du lieu illisible.'),
    httpError: (status) => t("La recherche du lieu n'a pas répondu (erreur {status}).", { status }),
  }));

/** Lieux qui répondent à `query`. Lève une erreur au message lisible. */
export const searchPlaces = async (query: string, near?: Waypoint, signal?: AbortSignal): Promise<Place[]> =>
  parsePhoton(await fetchJson(photonUrl(query, near), { signal }, {
    noNetwork: t('Pas de réseau : la recherche de lieux est impossible.'),
    timeout: t('La recherche de lieux ne répond pas : réessayez.'),
    timeoutMs: PHOTON_TIMEOUT_MS,
    unreadable: t('Réponse de la recherche de lieux illisible.'),
    httpError: (status) => t("La recherche de lieux n'a pas répondu (erreur {status}).", { status }),
  }));
