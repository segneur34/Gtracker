import { useSyncExternalStore } from 'react';
import { LEARNED_PLACES_FILE } from '../library/folderLayout';
import {
  LEARNED_PLACES_KEY, learnedPlacesFileText, mergeLearnedPlaces, parseLearnedPlacesFile, readLearnedPlaces, sameLearnedPlaces,
} from '../library/learnedPlaces';
import type { LearnedPlace, PlaceRules } from '../library/places';
import type { MemoryFolder } from '../platform/memoryFolder';
import { jsonStore, storageStartupFailure } from '../platform/storage';

/**
 * Lieux appris sur l'appareil (clé `gtracker.lieuxAppris`) et dans le dossier mémoire (`lieux.json`, à la racine),
 * qui les fait suivre d'un appareil à l'autre ; sur le modèle des tests de FC repos (`restingHrFile.ts`). Lecture et
 * écriture par l'interface du stockage et du dossier (règle 12).
 */

let deviceCache: { raw: unknown; places: LearnedPlace[] } | null = null;

/**
 * Liste de l'appareil, relue de sa clé. La même liste tant que la clé ne change pas : la file des lieux s'en sert pour
 * savoir qu'un lieu a été appris depuis son dernier passage.
 */
export const readDeviceLearnedPlaces = (): readonly LearnedPlace[] => {
  const raw = jsonStore.read<unknown>(LEARNED_PLACES_KEY);
  if (deviceCache !== null && deviceCache.raw === raw) return deviceCache.places;
  const places = readLearnedPlaces(raw);
  deviceCache = { raw, places };
  return places;
};

const subscribe = (listener: () => void): (() => void) => jsonStore.subscribeKey(LEARNED_PLACES_KEY, listener);

/** Lieux appris de l'appareil, suivis : une ligne de la liste regarde de nouveau son lieu quand un lieu est appris. */
export const useLearnedPlaces = (): readonly LearnedPlace[] => useSyncExternalStore(subscribe, readDeviceLearnedPlaces);

/** Range la liste sur l'appareil. */
export const writeDeviceLearnedPlaces = (places: readonly LearnedPlace[]): void => jsonStore.write(LEARNED_PLACES_KEY, places);

/**
 * Écrit `places` dans le dossier, fondus avec ceux du fichier en place, sauf en lecture seule ou si ce fichier ne se
 * lit pas ou vient d'une version plus récente (jamais écrasé). Lève si l'écriture échoue : à l'appelant de ne pas en
 * faire un obstacle.
 */
export const saveLearnedPlacesFile = async (f: MemoryFolder, places: readonly LearnedPlace[], rules: PlaceRules): Promise<void> => {
  if (f.readOnly) return;
  const file = parseLearnedPlacesFile(await f.readText(LEARNED_PLACES_FILE));
  if (file === null || !file.writable) return;
  const merged = mergeLearnedPlaces(places, file.places, rules);
  if (!sameLearnedPlaces(merged, file.places)) await f.writeText(LEARNED_PLACES_FILE, learnedPlacesFileText(merged));
};

/**
 * À l'ouverture du dossier : fond le fichier et la liste de l'appareil (`mergeLearnedPlaces`). La clé de l'appareil et
 * le fichier ne sont réécrits que si la fusion a changé quelque chose. Fichier illisible : rien n'est touché. Stockage
 * de l'appareil illisible au démarrage : sa liste n'est pas fiable, rien n'est écrit de son côté.
 */
export const syncLearnedPlacesFile = async (f: MemoryFolder, rules: PlaceRules): Promise<void> => {
  const file = parseLearnedPlacesFile(await f.readText(LEARNED_PLACES_FILE));
  if (file === null || storageStartupFailure()) return;
  const local = readDeviceLearnedPlaces();
  const merged = mergeLearnedPlaces(local, file.places, rules);
  if (!sameLearnedPlaces(merged, local)) writeDeviceLearnedPlaces(merged);
  if (!f.readOnly && file.writable && !sameLearnedPlaces(merged, file.places)) await f.writeText(LEARNED_PLACES_FILE, learnedPlacesFileText(merged));
};
