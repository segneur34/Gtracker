import { isIgnoredLegacyRecord, parseImportedRecord } from './legacyImport';
import { isWritableRecord, type RecordUnreadable, type RecordWithoutSummary } from './record';
import { isBlankRecordText, recordToKeep, type KeptRecordText } from './recordText';
import type { UnbundledGpx } from './sessionBundle';

/**
 * Fiche d'un GPX importé (lot 113, sorti de la bibliothèque) : celle posée à côté de lui, à défaut celle que
 * porte le GPX complet (`library/sessionBundle.ts`). L'une et l'autre se lisent par la porte d'import
 * (`library/legacyImport.ts`), qui accepte aussi l'ancienne application.
 */

/** Ce que l'import apporte à la fiche de la session (`addGpx` de la bibliothèque). */
export interface ImportRecordChoice {
  /** Fiche à fondre, résumé refait ; `null` sans fiche, ou si elle est gardée telle quelle. */
  record: RecordWithoutSummary | null;
  /** Champs illisibles de cette fiche, réécrits tels quels. */
  unreadable: RecordUnreadable | undefined;
  /** Fiche qu'on ne sait pas réécrire (version plus récente, illisible) : rangée telle quelle. */
  keepRecordText: KeptRecordText | undefined;
  /** Sport de la fiche que Gtracker ne range pas (course, vélo, entraînement) : la session est refusée. */
  otherSport: string | null;
  /**
   * Fiche de l'ancienne application illisible ou d'une version plus récente (`isIgnoredLegacyRecord`) : ni fondue ni
   * rangée, seul le GPX entre, et le compte rendu le dit.
   */
  legacyRecordIgnored: boolean;
}

/**
 * Fiche posée à côté (`recordText`, `undefined` ou `null` sans fichier), sinon celle du paquet : une fiche vide
 * est tenue pour absente ; une qu'on ne sait pas réécrire (version plus récente, illisible) est rangée telle
 * quelle, au caractère près, et la session reste sans fiche fondue ; sauf une de l'ancienne application, qui n'est
 * pas rangée du tout.
 */
export const importRecordChoice = (
  recordText: string | null | undefined,
  bundle: Pick<UnbundledGpx, 'record' | 'recordText' | 'unreadable' | 'otherSport'>
): ImportRecordChoice => {
  const hasSidecar = typeof recordText === 'string' && !isBlankRecordText(recordText);
  // Sans fiche à côté, celle du paquet n'est relue ici que s'il n'a pas su la lire (version plus récente, illisible).
  const bundleUnread = !hasSidecar && bundle.record === null && bundle.recordText !== null && !isBlankRecordText(bundle.recordText);
  const text = hasSidecar ? recordText : bundleUnread ? bundle.recordText : null;
  const read = text === null ? null : parseImportedRecord(text);
  const legacyRecordIgnored = read !== null && isIgnoredLegacyRecord(read);
  // Fiche posée à côté, ou à défaut portée par le GPX complet, qu'on ne sait pas réécrire (version plus récente, illisible) : rangée telle quelle.
  const keepRecordText = text !== null && read !== null && !legacyRecordIgnored ? recordToKeep(text, read.parsed) : undefined;
  const sidecar = hasSidecar && read?.parsed && isWritableRecord(read.parsed.parts) ? read.parsed : null;
  const fromBundle = !hasSidecar && !bundleUnread;
  return {
    record: sidecar ? sidecar.parts : fromBundle ? bundle.record : null,
    unreadable: sidecar ? sidecar.unreadable : fromBundle ? bundle.unreadable : undefined,
    keepRecordText,
    otherSport: hasSidecar ? read?.otherSport ?? null : bundle.otherSport,
    legacyRecordIgnored,
  };
};
