import { t } from '../core/i18n';
import { downloadBaseName } from './naming';
import type { SessionPlace } from './places';
import type { SessionRecord } from './record';

/**
 * Nom montré d'une session, la seule place où il se compose : celui que l'utilisateur a donné, sinon
 * « Activité · Lieu », calculé à chaque affichage et jamais écrit dans la fiche. Changer l'activité d'une
 * session change donc son nom ; effacer le nom donné rend le nom calculé. Sans lieu connu, l'activité seule ;
 * une session qui finit ailleurs, « Activité · Départ → Arrivée ».
 */

/** Séparateur de l'activité et du lieu. */
export const NAME_SEPARATOR = ' · ';

/** Ce que le nom lit de la fiche. */
export type NamedRecord = Pick<SessionRecord, 'name'> & { place?: SessionPlace };

/** Séparateur du lieu de départ et de celui d'arrivée. */
export const ARRIVAL_SEPARATOR = ' → ';

/**
 * Nom du lieu d'arrivée, seulement s'il porte un autre nom que le départ (sans tenir compte de la casse) ;
 * `null` sinon, ou sans arrivée nommée.
 */
export const distinctArrival = (place: SessionPlace | null | undefined): string | null => {
  const arrival = place?.arrival?.name?.trim() || null;
  if (arrival === null) return null;
  const departure = place?.name?.trim() || null;
  return departure !== null && arrival.toLocaleLowerCase('fr') === departure.toLocaleLowerCase('fr') ? null : arrival;
};

/**
 * Nom du lieu de la session, `null` s'il n'est pas connu (pas encore cherché, rien trouvé, ou vidé) :
 * « Départ → Arrivée » quand l'arrivée, loin du départ, porte un autre nom ; sinon le départ seul.
 */
export const placeLabel = (place: SessionPlace | null | undefined): string | null => {
  const departure = place?.name?.trim() || null;
  if (departure === null) return null;
  const arrival = distinctArrival(place);
  return arrival !== null ? `${departure}${ARRIVAL_SEPARATOR}${arrival}` : departure;
};

/** Nom donné par l'utilisateur, rogné, `null` sans nom. */
export const customName = (record: NamedRecord): string | null => record.name?.trim() || null;

/**
 * Nom montré : le nom donné, sinon l'activité et le lieu (`NAME_SEPARATOR`), sinon ce qu'on en connaît,
 * sinon `fallback`. `activityName` : nom de l'activité de la session, `null` si elle n'en a pas.
 */
export const sessionDisplayName = (record: NamedRecord, activityName: string | null, fallback = t('Session')): string =>
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
