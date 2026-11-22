/**
 * Noms techniques de l'application, rangés dans ses fichiers et dans la mémoire de l'appareil : formats des fichiers
 * (fiche, capteurs, réglages, journal…), clés de l'appareil, caches, bloc XML. Dans `core/` pour que tous les dossiers
 * puissent les lire (`platform/` et `theme/` n'importent que le noyau, `src/architecture.test.ts`). Java ne peut pas
 * les importer : il les écrit en dur, `platform/nativeConstants.test.ts` le contrôle.
 *
 * Deux noms distincts : `APP_NAME`, le nom affiché, se renomme librement ; `FORMAT_ID`, l'identifiant de format dont
 * dérivent toutes les valeurs écrites plus bas, ne change jamais, même si l'application change de nom. Ces valeurs sont
 * figées dès la première installation : les changer ensuite fait perdre toutes les données (fiches, capteurs, réglages
 * et dossiers mémoire écrits sous l'ancien identifiant ne seraient plus reconnus). `core/appIdentity.test.ts` les écrit
 * en toutes lettres.
 *
 * Les noms de l'ancienne application ne sont lus qu'à la porte d'import (`library/legacyImport.ts`).
 */

/** Nom affiché de l'application : se renomme sans toucher aux données. */
export const APP_NAME = 'Gtracker';
/** Identifiant de format, rangé dans les fichiers et la mémoire de l'appareil : figé, distinct du nom affiché. */
export const FORMAT_ID = 'gtracker';

/** Formats écrits dans les fichiers (champ `format`). */
export const FILE_FORMATS = {
  /** Fiche `.json` d'une session (`library/record.ts`). */
  session: `${FORMAT_ID}-session` as const,
  /** En-tête des capteurs `.imu` (`core/imuFile.ts`, et le Java qui les écrit). */
  capteurs: `${FORMAT_ID}-capteurs` as const,
  /** Marqueur du dossier mémoire (`library/folderLayout.ts`). */
  memoire: `${FORMAT_ID}-memoire` as const,
  /** Fichier de réglages d'un appareil (`library/settingsFile.ts`). */
  reglages: `${FORMAT_ID}-reglages` as const,
  /** Résultats du test de FC repos (`library/restingHrStore.ts`). */
  fcRepos: `${FORMAT_ID}-fc-repos` as const,
  /** En-tête du journal d'enregistrement (`recording/journal.ts`). */
  journal: `${FORMAT_ID}-journal` as const,
  /** En-tête du journal des positions tenu par le service du téléphone (`recording/nativeLog.ts`, et le Java qui l'écrit). */
  positions: `${FORMAT_ID}-positions` as const,
  /** Fiche d'un itinéraire (`planning/routeRecord.ts`). */
  itineraire: `${FORMAT_ID}-itineraire` as const,
  /** Lieux appris, à la racine du dossier mémoire (`library/learnedPlaces.ts`). */
  lieux: `${FORMAT_ID}-lieux` as const,
  /** Index de la corbeille du programme Windows (`library/trash.ts`). */
  corbeille: `${FORMAT_ID}-corbeille` as const,
  /** Base de la synchronisation avec un téléphone, gardée par l'ordinateur (`library/syncBase.ts`). */
  synchro: `${FORMAT_ID}-synchro` as const,
};

/** Blocs du GPX : préfixe des éléments et espace de noms, sans domaine ni dépôt. */
export const XML = {
  /** Paquet d'une session (`library/sessionBundle.ts`). */
  session: { prefix: FORMAT_ID, ns: `urn:${FORMAT_ID}:session` },
  /** Fiche d'un itinéraire (`planning/routeGpx.ts`). */
  itineraire: { prefix: FORMAT_ID, ns: `urn:${FORMAT_ID}:itineraire` },
} as const;

/** Marqueur à la racine du dossier mémoire, qui le reconnaît et dit sa version. */
export const MARKER_FILE = `${FORMAT_ID}.json` as const;

/**
 * Clés de l'appareil (`platform/storage.ts` : Preferences natives ou `localStorage`). `sportSettings` et
 * `athleteProfile` voyagent : ce sont aussi les clés de `values` des fichiers `reglages/<appareil>.json`.
 */
export const STORAGE_KEYS = {
  sportSettings: `${FORMAT_ID}.sportSettings` as const,
  athleteProfile: `${FORMAT_ID}.athleteProfile` as const,
  theme: `${FORMAT_ID}.theme` as const,
  sections: `${FORMAT_ID}.sections` as const,
  profil: `${FORMAT_ID}.profil` as const,
  tutoriels: `${FORMAT_ID}.tutoriels` as const,
  statistiques: `${FORMAT_ID}.statistiques` as const,
  panelSizes: `${FORMAT_ID}.panelSizes` as const,
  partage: `${FORMAT_ID}.partage` as const,
  libraryCache: `${FORMAT_ID}.libraryCache` as const,
  settingsSavedAt: `${FORMAT_ID}.settingsSavedAt` as const,
  deviceId: `${FORMAT_ID}.deviceId` as const,
  deviceName: `${FORMAT_ID}.deviceName` as const,
  seenSettingsFiles: `${FORMAT_ID}.seenSettingsFiles` as const,
  /** Réponse au bandeau des réglages d'un autre appareil, par fichier (`library/settingsFile.ts`, `AnsweredSettings`). */
  answeredSettings: `${FORMAT_ID}.answeredSettings` as const,
  summaryGestures: `${FORMAT_ID}.summaryGestures` as const,
  followedTrace: `${FORMAT_ID}.followedTrace` as const,
  fondCarte: `${FORMAT_ID}.fondCarte` as const,
  restingHr: `${FORMAT_ID}.restingHr` as const,
  planning: `${FORMAT_ID}.planning` as const,
  routeList: `${FORMAT_ID}.routeList` as const,
  triBibliotheque: `${FORMAT_ID}.triBibliotheque` as const,
  heartRateBelts: `${FORMAT_ID}.heartRateBelts` as const,
  memoryFolder: `${FORMAT_ID}.memoryFolder` as const,
  permissionsSeenVersion: `${FORMAT_ID}.permissionsSeenVersion` as const,
  autostartOpened: `${FORMAT_ID}.autostartOpened` as const,
  tileCache: `${FORMAT_ID}.tileCache` as const,
  tileUrls: `${FORMAT_ID}.tileUrls` as const,
  rechercheLieu: `${FORMAT_ID}.rechercheLieu` as const,
  lieuxAppris: `${FORMAT_ID}.lieuxAppris` as const,
  langue: `${FORMAT_ID}.langue` as const,
  /** Brouillons des sessions de la mémoire pas encore enregistrés (`library/sessionDrafts.ts`). */
  brouillons: `${FORMAT_ID}.brouillons` as const,
};

/** Caches du navigateur (Cache API, IndexedDB) et en-tête des tuiles gardées. */
export const CACHE_NAMES = {
  tuiles: `${FORMAT_ID}-tuiles` as const,
  vignettes: `${FORMAT_ID}-vignettes` as const,
  vignettesImages: `${FORMAT_ID}-vignettes-images` as const,
  /** Base IndexedDB de la poignée du dossier mémoire, et `id` du sélecteur de dossier. */
  memoire: `${FORMAT_ID}-memoire` as const,
  /** En-tête qui date une tuile gardée. */
  savedAtHeader: `x-${FORMAT_ID}-saved-at` as const,
};
