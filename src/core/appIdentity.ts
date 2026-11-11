/**
 * Noms techniques de l'application, rangés dans ses fichiers : format de la fiche d'une session, de ses capteurs et de
 * son GPX complet, marqueur et format du dossier mémoire. Dans `core/` pour que tous les dossiers puissent les lire
 * (`platform/` et `theme/` n'importent que le noyau, `src/architecture.test.ts`).
 *
 * Valeurs figées dès la première installation : les changer ensuite fait perdre toutes les données (fiches, capteurs
 * et dossiers mémoire écrits sous l'ancien nom ne seraient plus reconnus).
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
};

/** Bloc du GPX complet (`library/sessionBundle.ts`) : préfixe des éléments et espace de noms, sans domaine ni dépôt. */
export const XML = {
  session: { prefix: APP_SLUG, ns: `urn:${APP_SLUG}:session` },
} as const;

/** Marqueur à la racine du dossier mémoire, qui le reconnaît et dit sa version. */
export const MARKER_FILE = `${APP_SLUG}.json` as const;
