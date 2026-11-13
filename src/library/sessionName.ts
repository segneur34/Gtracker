import { downloadBaseName } from './naming';
import type { SessionPlace } from './places';
import type { SessionRecord } from './record';

/**
 * Nom montré d'une session, la seule place où il se compose : celui que l'utilisateur a donné, sinon
 * « Activité · Lieu », calculé à chaque affichage et jamais écrit dans la fiche. Changer l'activité d'une
 * session change donc son nom ; effacer le nom donné rend le nom calculé. Sans lieu connu, l'activité seule.
 */

/** Séparateur de l'activité et du lieu. */
export const NAME_SEPARATOR = ' · ';

/** Ce que le nom lit de la fiche. */
export type NamedRecord = Pick<SessionRecord, 'name'> & { place?: SessionPlace };

/** Nom du lieu de la session, `null` s'il n'est pas connu (pas encore cherché, ou rien trouvé). */
export const placeLabel = (place: SessionPlace | null | undefined): string | null => place?.name?.trim() || null;

/** Nom donné par l'utilisateur, rogné, `null` sans nom. */
export const customName = (record: NamedRecord): string | null => record.name?.trim() || null;

/**
 * Nom montré : le nom donné, sinon l'activité et le lieu (`NAME_SEPARATOR`), sinon ce qu'on en connaît,
 * sinon `fallback`. `activityName` : nom de l'activité de la session, `null` si elle n'en a pas.
 */
export const sessionDisplayName = (record: NamedRecord, activityName: string | null, fallback = 'Session'): string =>
  customName(record) ?? ([activityName?.trim() || null, placeLabel(record.place)].filter(Boolean).join(NAME_SEPARATOR) || fallback);

/**
 * Nom du GPX téléchargé ou partagé, sans extension (`downloadBaseName`) : `AAAA-MM-JJ Activité - Nom` pour
 * une session nommée, `AAAA-MM-JJ Activité - Lieu` sinon, `AAAA-MM-JJ Activité` sans lieu ; `null` sans
 * nom, ni lieu, ni activité (l'appelant garde le nom du fichier).
 */
export const sessionFileBaseName = (
  record: NamedRecord, activityName: string | null, startMs: number | null, fileName: string
): string | null => {
  const label = customName(record) ?? placeLabel(record.place);
  if (label) return downloadBaseName(label, activityName, startMs, fileName);
  return activityName ? downloadBaseName(activityName, null, startMs, fileName) : null;
};
