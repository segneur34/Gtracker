/**
 * Noms techniques de l'application, rangés dans ses fichiers et dans la mémoire de l'appareil : formats des fichiers
 * (fiche, capteurs, réglages, journal…), clés de l'appareil, caches, bloc XML. Dans `core/` pour que tous les dossiers
 * puissent les lire (`platform/` et `theme/` n'importent que le noyau, `src/architecture.test.ts`). Java ne peut pas
 * les importer : il les écrit en dur, `platform/nativeConstants.test.ts` le contrôle.
 *
 * Valeurs figées dès la première installation : les changer ensuite fait perdre toutes les données (fiches, capteurs,
 * réglages et dossiers mémoire écrits sous l'ancien nom ne seraient plus reconnus).
 *
 * Les noms de l'ancienne application ne sont lus qu'à la porte d'import (`library/legacyImport.ts`).
 */

export const APP_NAME = 'Gtracker';
export const APP_SLUG = 'gtracker';

/** Formats écrits dans les fichiers (champ `format`). */
export const FILE_FORMATS = {
  /** Fiche `.json` d'une session (`library/record.ts`). */
  session: `${APP_SLUG}-session` as const,
  /** En-tête des capteurs `.imu` (`core/imuFile.ts`, et le Java qui les écrit). */
  capteurs: `${APP_SLUG}-capteurs` as const,
  /** Marqueur du dossier mémoire (`library/folderLayout.ts`). */
  memoire: `${APP_SLUG}-memoire` as const,
  /** Fichier de réglages d'un appareil (`library/settingsFile.ts`). */
  reglages: `${APP_SLUG}-reglages` as const,
  /** Résultats du test de FC repos (`library/restingHrStore.ts`). */
  fcRepos: `${APP_SLUG}-fc-repos` as const,
  /** En-tête du journal d'enregistrement (`recording/journal.ts`). */
  journal: `${APP_SLUG}-journal` as const,
  /** Fiche d'un itinéraire (`planning/routeRecord.ts`). */
  itineraire: `${APP_SLUG}-itineraire` as const,
};

/** Blocs du GPX : préfixe des éléments et espace de noms, sans domaine ni dépôt. */
export const XML = {
  /** Paquet d'une session (`library/sessionBundle.ts`). */
  session: { prefix: APP_SLUG, ns: `urn:${APP_SLUG}:session` },
  /** Fiche d'un itinéraire (`planning/routeGpx.ts`). */
  itineraire: { prefix: APP_SLUG, ns: `urn:${APP_SLUG}:itineraire` },
} as const;

/** Marqueur à la racine du dossier mémoire, qui le reconnaît et dit sa version. */
export const MARKER_FILE = `${APP_SLUG}.json` as const;

/**
 * Clés de l'appareil (`platform/storage.ts` : Preferences natives ou `localStorage`). `sportSettings` et
 * `athleteProfile` voyagent : ce sont aussi les clés de `values` des fichiers `reglages/<appareil>.json`.
 */
export const STORAGE_KEYS = {
  sportSettings: `${APP_SLUG}.sportSettings` as const,
  athleteProfile: `${APP_SLUG}.athleteProfile` as const,
  theme: `${APP_SLUG}.theme` as const,
  sections: `${APP_SLUG}.sections` as const,
  profil: `${APP_SLUG}.profil` as const,
  tutoriels: `${APP_SLUG}.tutoriels` as const,
  statistiques: `${APP_SLUG}.statistiques` as const,
  panelSizes: `${APP_SLUG}.panelSizes` as const,
  partage: `${APP_SLUG}.partage` as const,
  libraryCache: `${APP_SLUG}.libraryCache` as const,
  settingsSavedAt: `${APP_SLUG}.settingsSavedAt` as const,
  deviceId: `${APP_SLUG}.deviceId` as const,
  deviceName: `${APP_SLUG}.deviceName` as const,
  seenSettingsFiles: `${APP_SLUG}.seenSettingsFiles` as const,
  summaryGestures: `${APP_SLUG}.summaryGestures` as const,
  followedTrace: `${APP_SLUG}.followedTrace` as const,
  fondCarte: `${APP_SLUG}.fondCarte` as const,
  brouterProfile: `${APP_SLUG}.brouterProfile` as const,
  zoneAlertTarget: `${APP_SLUG}.zoneAlertTarget` as const,
  restingHr: `${APP_SLUG}.restingHr` as const,
  planning: `${APP_SLUG}.planning` as const,
  routeList: `${APP_SLUG}.routeList` as const,
  triBibliotheque: `${APP_SLUG}.triBibliotheque` as const,
  heartRateBelts: `${APP_SLUG}.heartRateBelts` as const,
  memoryFolder: `${APP_SLUG}.memoryFolder` as const,
  permissionsSeenVersion: `${APP_SLUG}.permissionsSeenVersion` as const,
  tileCache: `${APP_SLUG}.tileCache` as const,
  tileUrls: `${APP_SLUG}.tileUrls` as const,
};

/** Caches du navigateur (Cache API, IndexedDB) et en-tête des tuiles gardées. */
export const CACHE_NAMES = {
  tuiles: `${APP_SLUG}-tuiles` as const,
  vignettes: `${APP_SLUG}-vignettes` as const,
  vignettesImages: `${APP_SLUG}-vignettes-images` as const,
  /** Base IndexedDB de la poignée du dossier mémoire, et `id` du sélecteur de dossier. */
  memoire: `${APP_SLUG}-memoire` as const,
  /** En-tête qui date une tuile gardée. */
  savedAtHeader: `x-${APP_SLUG}-saved-at` as const,
};
