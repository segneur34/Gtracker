import { isFiniteNumber, isObject } from '../core/basics';
import { haversineDistance } from '../core/geo';
import type { LatLon } from '../core/types';
import { roundedPoint, type PhotonFeature } from '../planning/geocoding';

/**
 * Lieu d'une session : le nom du plan d'eau (plage, port, marina, étang, baie) le plus proche de son point
 * de départ, sinon de la commune, trouvé une fois par la recherche inverse et gardé dans sa fiche
 * (`SessionRecord.place`). Il compose le nom montré de la session (`library/sessionName.ts`). Pur : la
 * recherche passe par la file des lieux, qui seule touche au réseau.
 */

/** D'où vient le lieu : trouvé sur la carte, repris d'un lieu appris, ou corrigé par l'utilisateur. */
export type PlaceSource = 'carte' | 'appris' | 'utilisateur';

const PLACE_SOURCES: readonly PlaceSource[] = ['carte', 'appris', 'utilisateur'];

/**
 * Lieu gardé dans la fiche. `name` nul : cherché, rien de nommé trouvé (la recherche ne se refait pas).
 * `lat` et `lon` : le point de départ arrondi qui a servi à la recherche.
 */
export interface SessionPlace {
  name: string | null;
  source: PlaceSource;
  lat: number;
  lon: number;
}

/**
 * Distances du choix d'un lieu, en mètres : rayon où un plan d'eau nommé est retenu (`waterRadiusM`, aussi
 * le rayon demandé au service), rayon où une session prend un lieu appris (`learnedRadiusM`), distance
 * entre départ et arrivée à partir de laquelle l'arrivée compte comme un autre lieu (`elsewhereM`) ; et
 * nombre d'objets demandés au service (`resultLimit`).
 */
export interface PlaceRules {
  waterRadiusM: number;
  learnedRadiusM: number;
  elsewhereM: number;
  resultLimit: number;
}

/** Valeurs par défaut, passées en paramètre partout où elles servent. */
export const PLACE_RULES: PlaceRules = {
  waterRadiusM: 1500,
  learnedRadiusM: 500,
  elsewhereM: 2000,
  resultLimit: 25,
};

/** Nom lisible : au moins une lettre, ni vide ni fait que de chiffres et de signes. */
export const isUsablePlaceName = (name: string | null | undefined): name is string =>
  typeof name === 'string' && /\p{L}/u.test(name);

/** Lieu relu dans la fiche, `null` s'il est absent ou mal formé (il sera cherché de nouveau). */
export const readSessionPlace = (raw: unknown): SessionPlace | null => {
  if (!isObject(raw)) return null;
  const { name, source, lat, lon } = raw;
  if (!PLACE_SOURCES.includes(source as PlaceSource)) return null;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (name !== null && typeof name !== 'string') return null;
  const trimmed = typeof name === 'string' ? name.trim() : null;
  return { name: isUsablePlaceName(trimmed) ? trimmed : null, source: source as PlaceSource, lat, lon };
};

/**
 * Étiquettes OpenStreetMap d'un plan d'eau nommé, `clé` ou `clé:valeur` : plage, baie, marina, port,
 * étang ou lac.
 */
const WATER_TAGS: ReadonlySet<string> = new Set([
  'natural:beach', 'natural:bay', 'natural:water', 'leisure:marina', 'leisure:beach_resort', 'landuse:harbour',
  'harbour', 'water:lake', 'water:lagoon', 'water:pond', 'water:reservoir',
]);

/** Étiquettes d'une localité dont le nom vaut pour la commune. */
const TOWN_VALUES: ReadonlySet<string> = new Set(['city', 'town', 'village', 'hamlet']);

const isWater = (f: PhotonFeature): boolean =>
  f.osmKey !== null && (WATER_TAGS.has(f.osmKey) || (f.osmValue !== null && WATER_TAGS.has(`${f.osmKey}:${f.osmValue}`)));

/** Nom de commune d'un objet : le sien si c'est une localité, sinon sa commune. */
const townOf = (f: PhotonFeature): string | null =>
  f.osmKey === 'place' && f.osmValue !== null && TOWN_VALUES.has(f.osmValue) && isUsablePlaceName(f.name) ? f.name : f.city;

/**
 * Lieu retenu parmi les objets rendus autour de `start` : le plan d'eau nommé le plus proche, à
 * `rules.waterRadiusM` au plus ; sinon la commune de l'objet le plus proche qui en a une ; sinon `null`.
 * Un nom vide ou sans lettre est écarté.
 */
export const choosePlace = (features: readonly PhotonFeature[], start: LatLon, rules: PlaceRules): string | null => {
  const byDistance = features
    .map((f) => ({ f, d: haversineDistance(start.lat, start.lon, f.lat, f.lon) }))
    .sort((a, b) => a.d - b.d);
  for (const { f, d } of byDistance) {
    if (d <= rules.waterRadiusM && isWater(f) && isUsablePlaceName(f.name)) return f.name.trim();
  }
  for (const { f } of byDistance) {
    const town = townOf(f);
    if (isUsablePlaceName(town)) return town.trim();
  }
  return null;
};

/** Lieu à ranger dans la fiche après une recherche autour de `start` : le nom choisi, la position arrondie envoyée. */
export const foundPlace = (name: string | null, start: LatLon): SessionPlace => ({ name, source: 'carte', ...roundedPoint(start) });

/**
 * Premier point de la trace d'un GPX, lu sans tout analyser : la première balise `<trkpt>` qui porte une
 * latitude et une longitude lisibles. `null` sans point.
 */
export const firstTrackPoint = (gpxText: string): LatLon | null => {
  const pattern = /<(?:\w+:)?trkpt\b([^>]*)>/g;
  for (let m = pattern.exec(gpxText); m !== null; m = pattern.exec(gpxText)) {
    const attributes = m[1];
    const attr = (name: string): number => {
      const found = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(attributes);
      return found ? Number(found[1]) : NaN;
    };
    const lat = attr('lat');
    const lon = attr('lon');
    if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
};
