import { t, tn } from '../core/i18n';

/**
 * Compte rendu d'un import de sessions (fichiers GPX ou FIT, dossier mémoire) et sa
 * phrase pour l'utilisateur, purs.
 */

export interface ImportReport {
  added: string[];
  /** Sessions déjà présentes, par leur nom dans la mémoire. */
  existing: string[];
  duplicates: number;
  invalid: string[];
  /**
   * GPX vides ou blancs (écriture interrompue) : ni sessions ni illisibles. Comptés, pas dits dans
   * la phrase du compte rendu.
   */
  ignored: string[];
  /** FIT lisibles qui ne sont pas des activités (réglages, parcours…) : ignorés, dits seulement si rien d'autre n'est à dire. */
  notActivities: string[];
  /**
   * Sessions de course, de vélo ou d'entraînement (fiche, `<type>` d'un GPX sans fiche, sport d'un FIT), laissées de
   * côté : comptées dans la phrase, jamais nommées une à une (montre prêtée, dossier entier).
   */
  otherSports: string[];
  unsaved: number;
  /** Fichiers qu'on n'a pas pu lire ou ranger, avec la raison. */
  failed: string[];
  /**
   * Parmi `failed`, ceux dont le rangement a levé une erreur (écriture dans la mémoire, lecture passagère), par leur nom :
   * un nouvel essai peut réussir, à la différence d'un fichier illisible.
   */
  retryable: string[];
  /** Sessions déjà présentes qui ont reçu leurs capteurs (`.imu`). */
  motionAdded: number;
  /** GPX rangés ou déjà présents dont les capteurs (`.imu`) ne se sont pas lus : gardés sans eux, un nouvel import les ajoute. */
  motionFailed: string[];
  /** Sessions déjà présentes dont la fiche a été complétée. */
  recordCompleted: number;
  /** Sessions déjà présentes à compléter dont la fiche n'a pas pu être relue : rien n'y a été ajouté. */
  recordNotRead: number;
  /**
   * GPX rangés ou déjà présents dont la fiche, de l'autre application, est d'une version plus récente ou illisible :
   * elle n'est pas reprise (nom, notes, repères), la trace seule entre (`library/legacyImport.ts`).
   */
  legacyRecordsIgnored: string[];
}

/** Phrase des sessions d'un sport que Gtracker ne range pas. */
const otherSportsSentence = (n: number): string =>
  // Les sports écartés entrent par une variable : la phrase existe au singulier et au pluriel, leur liste une seule fois.
  tn(
    n,
    '{n} session {sports} laissée de côté : Gtracker ne range que les sessions avec ou sans vent.',
    '{n} sessions {sports} laissées de côté : Gtracker ne range que les sessions avec ou sans vent.',
    { sports: t("de course, de vélo ou d'entraînement") }
  );

/** Phrase du compte rendu : sessions ajoutées, déjà présentes, complétées ou non, illisibles, non rangées, d'un autre sport. */
export const describeImport = (report: ImportReport): string => {
  const nothingElse = report.added.length === 0 && report.duplicates === 0 && report.invalid.length === 0 && report.unsaved === 0
    && report.failed.length === 0 && report.otherSports.length === 0;
  if (report.notActivities.length > 0 && nothingElse) {
    return report.notActivities.length > 1
      ? t("Ces {n} fichiers de montre ne sont pas des activités (réglages, parcours…) : rien n'a été importé.", { n: report.notActivities.length })
      : t("Ce fichier de montre n'est pas une activité (réglages, parcours…) : rien n'a été importé.");
  }
  const parts: string[] = [];
  parts.push(tn(report.added.length, '{n} session ajoutée', '{n} sessions ajoutées', undefined, report.added.length !== 1));
  if (report.duplicates > 0) parts.push(tn(report.duplicates, '{n} déjà présente', '{n} déjà présentes'));
  if (report.motionAdded > 0) {
    parts.push(tn(report.motionAdded, 'capteurs ajoutés à {n} session déjà présente', 'capteurs ajoutés à {n} sessions déjà présentes'));
  }
  if (report.motionFailed.length > 0) {
    parts.push(tn(
      report.motionFailed.length,
      'capteurs illisibles pour {n} session ({names}), gardée sans eux : un nouvel import les ajoutera',
      'capteurs illisibles pour {n} sessions ({names}), gardées sans eux : un nouvel import les ajoutera',
      { names: report.motionFailed.join(', ') }
    ));
  }
  if (report.recordCompleted > 0) {
    parts.push(tn(report.recordCompleted, 'fiche complétée pour {n} session déjà présente', 'fiche complétée pour {n} sessions déjà présentes'));
  }
  if (report.recordNotRead > 0) {
    parts.push(tn(
      report.recordNotRead,
      'fiche non relue pour {n} session déjà présente : non complétée',
      'fiche non relue pour {n} sessions déjà présentes : non complétées'
    ));
  }
  if (report.invalid.length > 0) {
    parts.push(tn(report.invalid.length, '{n} illisible ({names})', '{n} illisibles ({names})', { names: report.invalid.join(', ') }));
  }
  if (report.unsaved > 0) {
    parts.push(tn(
      report.unsaved,
      "{n} non rangée : désignez d'abord le dossier mémoire (Réglages › Mémoire)",
      "{n} non rangées : désignez d'abord le dossier mémoire (Réglages › Mémoire)"
    ));
  }
  if (report.legacyRecordsIgnored.length > 0) {
    parts.push(tn(
      report.legacyRecordsIgnored.length,
      "fiche de l'autre application d'une version plus récente ou illisible pour {n} session ({names}) : trace seule rangée, sans nom, notes ni repères",
      "fiche de l'autre application d'une version plus récente ou illisible pour {n} sessions ({names}) : trace seule rangée, sans nom, notes ni repères",
      { names: report.legacyRecordsIgnored.join(', ') }
    ));
  }
  const others = report.otherSports.length;
  if (others === 0) return `${parts.join(', ')}.`;
  // Rien d'autre que des sessions d'un autre sport : leur phrase seule.
  const onlyOthers = parts.length === 1 && report.added.length === 0 && report.failed.length === 0;
  return onlyOthers ? otherSportsSentence(others) : `${parts.join(', ')}. ${otherSportsSentence(others)}`;
};

/**
 * Compte rendu de « Mettre à jour » : sessions apparues et disparues, d'après les débuts de trace d'avant et
 * d'après la relecture.
 */
export const describeRefresh = (before: ReadonlySet<number>, after: ReadonlySet<number>): string => {
  const added = [...after].filter((startMs) => !before.has(startMs)).length;
  const removed = [...before].filter((startMs) => !after.has(startMs)).length;
  const changes = [
    ...(added > 0 ? [tn(added, '{n} session de plus', '{n} sessions de plus')] : []),
    ...(removed > 0 ? [tn(removed, '{n} session en moins', '{n} sessions en moins')] : []),
  ];
  return t('Dossier relu : {changes}.', { changes: changes.length > 0 ? changes.join(', ') : t('rien de nouveau') });
};
