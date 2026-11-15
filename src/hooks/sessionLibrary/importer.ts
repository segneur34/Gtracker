import { t, tn } from '../../core/i18n';
import type { SessionMark } from '../../core/sessionMarks';
import type { SportType } from '../../core/types';
import { describeImport, type ImportReport } from '../../library/importReport';
import { importRecordChoice } from '../../library/importEntry';
import { upgradeImportedImu } from '../../library/legacyImport';
import { fitToGpx, isFitActivity, type FitConversion } from '../../library/fitToGpx';
import { isBlankGpxText, isFitFileName, isGpxFileName } from '../../library/record';
import { unbundleSessionGpx } from '../../library/sessionBundle';
import { readPickedBytes, readPickedFile } from '../../platform/files';
import { memoryLabelText, pickFolderToImport, type ImportEntry } from '../../platform/memoryFolder';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { libraryState, reportError, setState, type LibraryState } from './store';
import { hasSessionMotion, lib } from './memory';
import { scheduleCacheUpdate } from './cache';
import { addGpx, type AddResult } from './addSession';

/**
 * Import de sessions et rangement d'un enregistrement : GPX ou FIT choisis, dossier mémoire entier, session
 * qui vient d'être enregistrée.
 */

/**
 * Range une session qui vient d'être enregistrée, avec ses repères (`marks`), ses capteurs (`motion`, le contenu du
 * `.imu`) et le foil de son activité (`foil`, `null` hors voile et surf). Rend son nom dans la mémoire et, en clair, l'endroit où elle se
 * trouve. Ne lève d'erreur que si l'écriture échoue : l'enregistreur garde
 * alors son journal. Une session mise en attente faute de dossier y attend
 * avec ses capteurs et sa fiche (activité, foil, repères),
 * rangées avec elle dès qu'un dossier est là (`flushPending`). Une session
 * déjà dans la mémoire (fiche coupée par un arrêt de l'application) reçoit
 * de l'enregistrement ce qui manque à sa fiche (`completeRecord`). `kept` : faux si la session
 * n'a été rangée nulle part (ni mémoire ni attente), seulement rendue pour être téléchargée. Une
 * session refusée pour son contenu lève une erreur marquée `refused: true` : un nouvel essai n'y
 * changerait rien, contrairement à une écriture en échec.
 */
export const saveRecordedSession = async (
  text: string,
  sport: SportType | null,
  activityId: string | null,
  motion: Uint8Array | null = null,
  marks: SessionMark[] = [],
  foil: boolean | null = null
): Promise<{ file: string | null; location: string; kept: boolean }> => {
  await lib.opening;
  const result = await addGpx(text, 'enregistrement', {
    // Calcul inconnu (journal sans en-tête) : rien de deviné, la session est rangée « à classer ».
    sport, activityId: activityId ?? undefined, marks, motion: motion ?? undefined, foil: foil ?? undefined,
  });
  // Rangée, ou déjà là : son lieu est cherché s'il ne l'a jamais été.
  if ((result.status === 'added' || result.status === 'duplicate') && result.file) lib.onSessionsAdded([result.file]);
  switch (result.status) {
    case 'added':
      return { file: result.file, location: memoryLabelText(libraryState().folderLabel ?? t('mémoire')), kept: true };
    case 'duplicate':
      // Fiche de la session déjà rangée non relue ou en lecture seule : rien n'y est ajouté, l'enregistreur garde son journal.
      if (result.recordNotRead) throw new Error(t("session déjà dans la mémoire, mais sa fiche n'a pas pu être relue pour la compléter"));
      if (result.recordReadOnly) throw new Error(t('session déjà dans la mémoire, mais sa fiche y est en lecture seule (non lue, illisible ou plus récente)'));
      return { file: result.file, location: t('déjà dans la mémoire'), kept: true };
    case 'pending':
      return { file: null, location: t("en attente d'un dossier mémoire (dossier privé de l'application)"), kept: true };
    case 'unsaved':
      return { file: null, location: t('non rangée, aucune mémoire accessible : à télécharger'), kept: false };
    default:
      // Refusée pour son contenu (trop peu de points horodatés…) : la retenter ne changera rien.
      throw Object.assign(new Error(result.message ?? t('session illisible')), { refused: true });
  }
};

/** Fichier choisi dans le navigateur, lu seulement au moment de le ranger. */
const pickedEntry = (file: File): ImportEntry => ({
  name: file.name,
  key: (file.webkitRelativePath || file.name).replace(/\.(gpx|fit|json|imu)$/i, '').toLowerCase(),
  readText: () => readPickedFile(file),
  readBytes: () => readPickedBytes(file),
});

/** Réponse attendue à la question de `importQuestion`. */
let importAnswer: ((yes: boolean) => void) | null = null;

/** Répond à la question posée avant d'importer un dossier (`ImportQuestion`). */
export const answerImportQuestion = (yes: boolean): void => {
  const answer = importAnswer;
  importAnswer = null;
  setState({ importQuestion: null });
  answer?.(yes);
};

/**
 * Plusieurs activités de montre dans un dossier : on demande avant de tout prendre. La montre peut être prêtée, et les
 * activités de la personne qui la prête ne doivent pas entrer par mégarde. Chaque FIT est lu pour son type, puis relâché.
 */
const confirmWatchFolder = async (entries: ImportEntry[]): Promise<boolean> => {
  const fits = entries.filter((entry) => isFitFileName(entry.name));
  if (fits.length < 2) return true;
  let watchActivities = 0;
  for (const entry of fits) {
    const bytes = await entry.readBytes().catch(() => null);
    if (bytes && isFitActivity(bytes)) watchActivities += 1;
  }
  if (watchActivities < 2) return true;
  return new Promise<boolean>((resolve) => {
    importAnswer = resolve;
    setState({ importQuestion: { watchActivities } });
  });
};

/** Fichier non rangé : son nom et la raison, gardés à part. */
export interface FailedImport {
  name: string;
  reason: string;
}

/** Compte rendu de `importEntries` : celui de l'import, et chaque fichier non rangé, nom et raison à part (`failedFiles`). */
export interface ImportOutcome extends ImportReport {
  /** Les mêmes fichiers que `failed`, dans le même ordre ; `failed` en porte la ligne affichée. */
  failedFiles: FailedImport[];
}

/** Porte au compte rendu un fichier non rangé : nom et raison à part, et la ligne qui les assemble pour l'affichage. */
const noteFailure = (report: ImportOutcome, name: string, reason: string): void => {
  report.failedFiles.push({ name, reason });
  report.failed.push(t('{name} : {reason}', { name, reason }));
};

/** Porte au compte rendu ce que `addGpx` a fait d'un fichier. */
const noteAddResult = (report: ImportReport, result: AddResult, name: string): void => {
  if (result.status === 'added' && result.file) report.added.push(result.file);
  else if (result.status === 'duplicate') {
    report.duplicates += 1;
    if (result.file) report.existing.push(result.file);
    if (result.motionAdded) report.motionAdded += 1;
    if (result.recordCompleted) report.recordCompleted += 1;
    if (result.recordNotRead) report.recordNotRead += 1;
  }
  else if (result.status === 'invalid') report.invalid.push(name);
  else if (result.status === 'other-sport') report.otherSports.push(name);
  else report.unsaved += 1;
};

/**
 * Importe des fichiers : des GPX, des FIT, ou un dossier mémoire entier, dont chaque
 * fiche accompagne son GPX (notes et support compris). Chaque session est lue
 * juste avant d'être rangée, GPX, fiche et capteurs, puis relâchée : un
 * dossier entier n'est jamais chargé d'un coup. Une session déjà
 * présente n'est pas dupliquée ; si elle n'avait pas ses capteurs, elle reçoit
 * ceux du dossier (`.imu`). Un fichier qu'on ne peut lire ou ranger n'arrête
 * pas les autres : il est nommé, avec la raison, dans une erreur. Des capteurs
 * illisibles ne retiennent ni le GPX ni la fiche : comptés à part
 * (`motionFailed`), un nouvel import les ajoute (`motionAdded`). Sans
 * dossier mémoire, rien n'est rangé ni mis en attente.
 *
 * Les GPX passent d'abord, les FIT ensuite : le GPX d'une session garde sa fiche, et le FIT
 * de la même sortie compte alors « déjà présente », rien n'est écrasé. Un FIT est converti
 * en GPX (`library/fitToGpx.ts`) puis rangé comme lui ; un FIT qui n'est pas une activité
 * est écarté sans bruit (`notActivities`). `fromFolder` : les fichiers forment un dossier,
 * dont plusieurs activités de montre demandent d'abord confirmation (refus : rien n'est importé).
 * `quiet` : rien dans le message de la mémoire, l'appelant dit lui-même le résultat (fichier reçu d'une autre application).
 */
export const importEntries = async (
  entries: ImportEntry[],
  { fromFolder = false, quiet = false }: { fromFolder?: boolean; quiet?: boolean } = {},
): Promise<ImportOutcome> => {
  setState({ importing: true });
  const report: ImportOutcome = {
    added: [], existing: [], duplicates: 0, invalid: [], ignored: [], notActivities: [], otherSports: [], unsaved: 0, failed: [], retryable: [],
    motionAdded: 0, motionFailed: [], recordCompleted: 0, recordNotRead: 0, legacyRecordsIgnored: [], failedFiles: [],
  };
  try {
    await lib.opening;
    if (fromFolder && !(await confirmWatchFolder(entries))) {
      setState({ message: t("Import annulé : rien n'a été importé.") });
      return report;
    }
    const records = new Map<string, ImportEntry>();
    const motions = new Map<string, ImportEntry>();
    for (const entry of entries) {
      if (/\.json$/i.test(entry.name)) records.set(entry.key, entry);
      else if (/\.imu$/i.test(entry.name)) motions.set(entry.key, entry);
    }

    for (const entry of entries) {
      if (!isGpxFileName(entry.name)) continue;
      try {
        const text = await entry.readText();
        if (text === null) {
          noteFailure(report, entry.name, t('illisible'));
          continue;
        }
        // GPX vide : pas une session, ni illisible.
        if (isBlankGpxText(text)) {
          report.ignored.push(entry.name);
          continue;
        }
        // GPX complet (`library/sessionBundle.ts`) : la fiche et les capteurs qu'il porte servent
        // à défaut de fichiers posés à côté ; la mémoire range le GPX sans eux.
        const bundle = unbundleSessionGpx(text);
        const recordText = await records.get(entry.key)?.readText();
        // Fiche posée à côté, sinon celle du paquet ; gardée telle quelle si on ne sait pas la réécrire.
        const { record, unreadable, keepRecordText, otherSport, legacyRecordIgnored } = importRecordChoice(recordText, bundle);
        // Fiche d'une session de course, de vélo ou d'entraînement : refusée, comptée sans être nommée.
        if (otherSport !== null) {
          report.otherSports.push(entry.name);
          continue;
        }
        // Capteurs illisibles : la session est rangée sans eux, et comptée à part ; ceux du paquet les remplacent s'il en porte.
        let motionFailed = false;
        const sideMotion = await motions.get(entry.key)?.readBytes().catch(() => {
          motionFailed = true;
          return null;
        });
        // Capteurs de l'ancienne application : convertis en entrant, chaque source à part (ceux du paquet servent si ceux
        // posés à côté ne se convertissent pas) ; s'il n'en reste aucun, comptés comme illisibles.
        const motion = (sideMotion ? upgradeImportedImu(sideMotion) : null) ?? (bundle.motion ? upgradeImportedImu(bundle.motion) : null) ?? undefined;
        if ((sideMotion || bundle.motion) && !motion) motionFailed = true;
        const result = await addGpx(bundle.gpx, 'import', { record, motion, unreadable, keepRecordText });
        noteAddResult(report, result, entry.name);
        if (legacyRecordIgnored && (result.status === 'added' || result.status === 'duplicate')) report.legacyRecordsIgnored.push(entry.name);
        // Une session qui a déjà ses capteurs n'a rien perdu.
        if (motionFailed && !motion && result.file && !hasSessionMotion(result.file)) report.motionFailed.push(entry.name);
      } catch (err) {
        noteFailure(report, entry.name, nativeErrorMessage(err, t('erreur inconnue')));
        report.retryable.push(entry.name);
      }
    }
    for (const entry of entries) {
      if (!isFitFileName(entry.name)) continue;
      try {
        const bytes = await entry.readBytes();
        if (bytes === null) {
          noteFailure(report, entry.name, t('illisible'));
          continue;
        }
        // Un fichier qui n'est pas un FIT ne le deviendra pas : refusé pour de bon, à la différence d'une écriture en échec.
        let fit: FitConversion;
        try {
          fit = fitToGpx(bytes);
        } catch (err) {
          noteFailure(report, entry.name, nativeErrorMessage(err, t('fichier illisible')));
          continue;
        }
        if (fit.kind === 'not-activity') report.notActivities.push(entry.name);
        else if (fit.kind === 'other-sport') report.otherSports.push(entry.name);
        else if (fit.kind === 'refused') noteFailure(report, entry.name, fit.reason);
        else noteAddResult(report, await addGpx(fit.gpx, 'import', {}), entry.name);
      } catch (err) {
        noteFailure(report, entry.name, nativeErrorMessage(err, t('erreur inconnue')));
        report.retryable.push(entry.name);
      }
    }
    if (lib.folder) scheduleCacheUpdate(lib.folder);
    // Quelques fichiers choisis : leur lieu est cherché tout de suite. Un dossier entier, au fil de l'eau (liste, analyse).
    if (!fromFolder && report.added.length > 0) lib.onSessionsAdded(report.added);
    if (quiet) return report;
    if (report.failed.length === 0) {
      setState({ message: describeImport(report) });
    } else {
      // Le compte rendu va avec l'échec : le bandeau d'erreur cacherait sinon le message.
      const n = report.failed.length;
      reportError(`${describeImport(report)} ${tn(n, '{n} fichier non rangé ({list})', '{n} fichiers non rangés ({list})', { list: report.failed.join(' ; ') })}`);
    }
  } catch (err) {
    if (!quiet) reportError(t('Import interrompu : {detail}', { detail: nativeErrorMessage(err, t('erreur inconnue')) }));
  } finally {
    setState({ importing: false });
  }
  return report;
};

/** Importe des fichiers choisis dans le navigateur (`importEntries`), ou le contenu d'un dossier (chemin relatif posé par le navigateur). */
export const importFiles = (files: File[]): Promise<ImportOutcome> =>
  importEntries(files.map(pickedEntry), { fromFolder: files.some((file) => file.webkitRelativePath !== '') });

/**
 * Sur le téléphone, ajoute les sessions d'un dossier que l'utilisateur désigne
 * (un dossier de sessions copié depuis le PC) : `importEntries` sur ses GPX, ses FIT, ses
 * fiches et ses capteurs, lus un par un. L'import est annoncé dès le
 * sélecteur, boutons grisés. `null` si l'utilisateur renonce.
 */
export const importFromFolder = async (): Promise<ImportOutcome | null> => {
  setState({ importing: true });
  let entries: ImportEntry[] | null;
  try {
    entries = await pickFolderToImport();
  } catch (err) {
    setState({ importing: false, message: t('Lecture du dossier impossible : {detail}', { detail: nativeErrorMessage(err, String(err)) }) });
    return null;
  }
  if (!entries) {
    setState({ importing: false });
    return null;
  }
  return importEntries(entries, { fromFolder: true });
};

/**
 * Peut-on importer : seulement dans une mémoire ouverte, où l'on peut écrire.
 * Sans dossier, un import est refusé plutôt que mis en attente (choix du produit) :
 * seuls les enregistrements attendent un dossier.
 */
export const canImportSessions = (s: Pick<LibraryState, 'status' | 'memoryReadOnly'>): boolean => s.status === 'ready' && !s.memoryReadOnly;
