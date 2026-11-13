import { FILE_FORMATS, STORAGE_KEYS } from '../core/appIdentity';
import { isFiniteNumber, isObject, parseJson, stringifyJson } from '../core/basics';
import { haversineDistance } from '../core/geo';
import { isUsablePlaceName, type LearnedPlace, type PlaceRules } from './places';

/**
 * Lieux appris (`library/places.ts`, `LearnedPlace`) tels qu'ils sont gardés : sur l'appareil (clé
 * `gtracker.lieuxAppris`) et dans `lieux.json` à la racine du dossier mémoire, fondus entre appareils
 * (`hooks/learnedPlacesFile.ts`). Relecture tolérante, champs inconnus gardés, au plus `MAX_LEARNED_PLACES`.
 */

/** Clé de l'appareil où la liste est gardée. */
export const LEARNED_PLACES_KEY = STORAGE_KEYS.lieuxAppris;

/** Nombre de lieux appris gardés : les plus récents. */
export const MAX_LEARNED_PLACES = 1000;

/** Un lieu appris relu, champs inconnus compris ; `null` s'il est mal formé. */
const readLearnedPlace = (raw: unknown): LearnedPlace | null => {
  if (!isObject(raw)) return null;
  const { name, lat, lon, savedAt } = raw;
  if (typeof name !== 'string' || !isUsablePlaceName(name.trim())) return null;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { ...raw, name: name.trim(), lat, lon, savedAt: isFiniteNumber(savedAt) ? savedAt : 0 };
};

/** Liste relue : les lieux bien formés, du plus récent au plus ancien, au plus `MAX_LEARNED_PLACES`. */
export const readLearnedPlaces = (raw: unknown): LearnedPlace[] =>
  (Array.isArray(raw) ? raw : [])
    .map(readLearnedPlace)
    .filter((p): p is LearnedPlace => p !== null)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_LEARNED_PLACES);

/**
 * Fusion de deux listes (l'appareil, le fichier) : du plus récent au plus ancien, un lieu n'est gardé que si
 * aucun plus récent n'est à moins de `rules.learnedRadiusM` ; deux corrections au même endroit, sur deux
 * appareils, ne gardent donc que la dernière. À même date, celui de `a` passe d'abord.
 *
 * Limite assumée, comme pour les tests de FC repos : sans mémoire des retraits.
 */
export const mergeLearnedPlaces = (a: readonly LearnedPlace[], b: readonly LearnedPlace[], rules: PlaceRules): LearnedPlace[] => {
  const kept: LearnedPlace[] = [];
  const all = [...a, ...b].map((p, i) => ({ p, i })).sort((x, y) => y.p.savedAt - x.p.savedAt || x.i - y.i);
  for (const { p } of all) {
    if (kept.length >= MAX_LEARNED_PLACES) break;
    if (!kept.some((k) => haversineDistance(k.lat, k.lon, p.lat, p.lon) < rules.learnedRadiusM)) kept.push(p);
  }
  return kept;
};

/** Deux listes disent-elles la même chose ? */
export const sameLearnedPlaces = (a: readonly LearnedPlace[], b: readonly LearnedPlace[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const FILE_FORMAT = FILE_FORMATS.lieux;
const FILE_VERSION = 1;

/** Texte du fichier `lieux.json` du dossier mémoire. */
export const learnedPlacesFileText = (places: readonly LearnedPlace[]): string =>
  `${stringifyJson({ format: FILE_FORMAT, version: FILE_VERSION, places })}\n`;

/** Fichier relu : ses lieux, et s'il peut être réécrit (pas d'une version plus récente). */
export interface LearnedPlacesFile {
  places: LearnedPlace[];
  writable: boolean;
}

/**
 * Relecture tolérante du fichier : vide et inscriptible s'il est absent (`text` nul) ; `null` s'il ne se lit pas
 * (abîmé, d'un autre format), et l'appelant n'écrit alors rien par-dessus. Un fichier d'une version plus récente
 * est lu, jamais réécrit.
 */
export const parseLearnedPlacesFile = (text: string | null): LearnedPlacesFile | null => {
  if (text === null) return { places: [], writable: true };
  const file = parseJson(text);
  if (!isObject(file) || file.format !== FILE_FORMAT || !Array.isArray(file.places)) return null;
  const writable = !isFiniteNumber(file.version) || file.version <= FILE_VERSION;
  return { places: readLearnedPlaces(file.places), writable };
};
