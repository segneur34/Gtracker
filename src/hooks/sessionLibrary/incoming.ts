import { errorMessage } from '../../core/basics';
import { t } from '../../core/i18n';
import { describeImport } from '../../library/importReport';
import { MAX_LISTED_FILE_BYTES } from '../../library/reconcile';
import { incomingFiles, type IncomingFile, type IncomingFilesPort, type IncomingRefusal } from '../../platform/incomingFile';
import { NO_FOLDER_IMPORT_MESSAGE, READ_ONLY_MEMORY_MESSAGE, type ImportEntry } from '../../platform/memoryFolder';
import { libraryState, sentence, setState, subscribe, type IncomingNotice } from './store';
import { lib } from './memory';
import { canImportSessions, importEntries, type ImportOutcome } from './importer';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { isGpxFileName } from '../../library/record';
import { isRouteGpx } from '../../planning/routeImport';

/**
 * Fichiers reçus d'une autre application (« Ouvrir avec Gtracker », « Partager vers Gtracker »), côté page : la
 * copie privée faite par le greffon (`platform/incomingFile.ts`) passe par la même chaîne que l'import (`importEntries` :
 * doublon « déjà présente », refus, FIT illisible avec sa raison), un fichier à la fois, et le résultat se lit dans un
 * bandeau (`IncomingFileNotice`), car un brouillon peut être ouvert : aucune navigation automatique.
 *
 * La copie est retirée une fois le verdict rendu, l'original restant chez l'application d'origine, sauf si le
 * rangement a levé une erreur (écriture dans la mémoire) ou n'a rien dit : elle est retentée au lancement suivant,
 * jamais avant, pour ne pas redire la même erreur en boucle. Une relance après un rangement réussi dont la copie n'a pas pu
 * être retirée donne « déjà présente », jamais un double (début de trace, `addGpx`).
 *
 * Pendant un enregistrement, la copie native se fait, et la page ne touche à rien : la file reprend à l'arrêt.
 *
 * Un GPX qui est un itinéraire (fiche d'un itinéraire de Gtracker, ou tracé sans aucun point daté,
 * `isRouteGpx`) est rangé dans `itineraires/` au lieu des sessions (`routeArrival`) ; tout autre fichier suit l'import.
 */

/** Verdict d'un fichier passé par `importEntries` : `retry` garde la copie, les autres la retirent. */
type IncomingVerdict =
  | { kind: 'added'; file: string }
  | { kind: 'duplicate'; file: string | null }
  | { kind: 'retry'; reason: string | null }
  | { kind: 'refused'; text: string };

/** Raison du premier fichier non rangé, gardée à part de son nom par l'import. */
const firstReason = (report: ImportOutcome): string | null => report.failedFiles[0]?.reason ?? null;

const quoted = (name: string): string => t('« {name} »', { name });

/** Refus sans mémoire ou en lecture seule : la phrase de l'import, et de quoi recommencer. */
const refusedForMemory = (name: string, readOnly: boolean): string =>
  t("{quoted} n'a pas été rangé. {why}", {
    quoted: quoted(name),
    why: readOnly
      ? READ_ONLY_MEMORY_MESSAGE
      : t("{message} Le fichier d'origine n'a pas bougé : ouvrez-le de nouveau ensuite.", { message: NO_FOLDER_IMPORT_MESSAGE }),
  });

/** Ce que `importEntries` a fait d'un seul fichier. Rien dit : prudence, la copie reste. */
const incomingVerdict = (report: ImportOutcome, name: string): IncomingVerdict => {
  if (report.added.length > 0) return { kind: 'added', file: report.added[0] };
  if (report.duplicates > 0) return { kind: 'duplicate', file: report.existing[0] ?? null };
  const reason = firstReason(report);
  if (report.retryable.length > 0) return { kind: 'retry', reason };
  if (reason !== null) return { kind: 'refused', text: t("{quoted} n'a pas été rangé : {reason}", { quoted: quoted(name), reason: sentence(reason) }) };
  if (report.invalid.length > 0) return { kind: 'refused', text: t("{quoted} n'a pas été rangé : fichier illisible.", { quoted: quoted(name) }) };
  if (report.notActivities.length > 0) return { kind: 'refused', text: describeImport(report) };
  // Course, vélo, entraînement : refusé pour de bon, la copie est retirée.
  if (report.otherSports.length > 0) return { kind: 'refused', text: describeImport(report) };
  if (report.ignored.length > 0) return { kind: 'refused', text: t("{quoted} n'a pas été rangé : fichier vide.", { quoted: quoted(name) }) };
  if (report.unsaved > 0) return { kind: 'refused', text: refusedForMemory(name, false) };
  return { kind: 'retry', reason: null };
};

/** Refus du greffon, à la réception. */
const refusalText = (name: string, refusal: IncomingRefusal): string => {
  switch (refusal) {
    case 'format':
      return t("{quoted} n'a pas été rangé : ce n'est ni un GPX ni un FIT.", { quoted: quoted(name) });
    case 'trop-gros':
      return t("{quoted} n'a pas été rangé : il dépasse {size} Mo.", { quoted: quoted(name), size: MAX_LISTED_FILE_BYTES / (1024 * 1024) });
    default:
      return t("{quoted} n'a pas été rangé : Gtracker n'a pas pu le lire. Essayez de l'ouvrir de nouveau.", { quoted: quoted(name) });
  }
};

/** Range l'itinéraire d'un GPX (`hooks/routeFiles.ts`, passé par `main.tsx`) ; rend le nom de ses fichiers et son nom. */
export type IncomingRouteImporter = (text: string, fileName: string) => Promise<{ base: string; record: { name: string } }>;

let port: IncomingFilesPort = incomingFiles;
/** Absent : un GPX d'itinéraire suit l'import des sessions. */
let importRoute: IncomingRouteImporter | null = null;
let isRecording: () => boolean = () => false;
/** Fichiers déjà passés pendant ce lancement : gardés pour le suivant, ou dont le retrait a échoué. */
const handled = new Set<string>();
/** La file a reculé devant un enregistrement, ou devant un autre import : reprise quand il finit. */
let waitingForRecording = false;
let waitingForImport = false;
/** Passage en cours de la file, et demande reçue pendant lui. */
let running: Promise<void> | null = null;
let again = false;

/** La copie privée, lue seulement au moment de la ranger (`ImportEntry`) ; `read` : son contenu, déjà lu une fois. */
const entryOf = (file: IncomingFile, read?: Uint8Array): ImportEntry => {
  const readBytes = () => (read ? Promise.resolve(read) : port.read(file.id));
  return {
    name: file.name,
    key: file.id,
    size: file.size,
    readBytes,
    readText: async () => {
      const bytes = await readBytes();
      return bytes === null ? null : new TextDecoder().decode(bytes);
    },
  };
};

const notify = (notice: IncomingNotice): void => {
  setState({ incomingNotices: [...libraryState().incomingNotices, notice] });
};

/** Retire la copie. Un échec n'est pas une perte : au lancement suivant, le rangement dira « déjà présente ». */
const forget = async (file: IncomingFile): Promise<void> => {
  await port.remove(file.id).catch((err: unknown) => console.warn('Fichier reçu non retiré', err));
};

/**
 * GPX reçu, lu une fois pour savoir si c'est un itinéraire : rangé dans les itinéraires, `'route'` ; sinon son contenu,
 * que l'import des sessions reprend sans relire la copie. Ni GPX, ni rangement d'itinéraire injecté, ou copie illisible :
 * `undefined`, et l'import la lit lui-même (une lecture en échec y garde la copie pour le lancement suivant). Un échec du
 * rangement de l'itinéraire est dit, la copie gardée pour le lancement suivant, comme une session.
 */
const routeArrival = async (file: IncomingFile): Promise<'route' | Uint8Array | undefined> => {
  const { id, name } = file;
  if (!importRoute || !isGpxFileName(name)) return undefined;
  let bytes: Uint8Array | null;
  try {
    bytes = await port.read(id);
  } catch {
    return undefined;
  }
  if (bytes === null) return undefined;
  if (!isRouteGpx(new TextDecoder().decode(bytes))) return bytes;
  try {
    const saved = await importRoute(new TextDecoder().decode(bytes), name);
    notify({ id, text: t('{quoted} est rangé dans les itinéraires, sous « {route} ».', { quoted: quoted(name), route: saved.record.name }), file: null, route: saved.base, trouble: false });
    await forget(file);
  } catch (err) {
    notify({
      id,
      text: t("{quoted} n'a pas pu être rangé dans les itinéraires ({detail}). Gtracker le garde et réessaiera au prochain lancement.", {
        quoted: quoted(name),
        detail: nativeErrorMessage(err, t('erreur inconnue')),
      }),
      file: null,
      trouble: true,
    });
  }
  return 'route';
};

const handle = async (file: IncomingFile): Promise<void> => {
  const { id, name } = file;
  handled.add(id);
  if (file.refusal) {
    notify({ id, text: refusalText(name, file.refusal), file: null, trouble: true });
    await forget(file);
    return;
  }
  const state = libraryState();
  if (!canImportSessions(state)) {
    notify({ id, text: refusedForMemory(name, state.memoryReadOnly), file: null, trouble: true });
    await forget(file);
    return;
  }
  const arrival = await routeArrival(file);
  if (arrival === 'route') return;
  const verdict = incomingVerdict(await importEntries([entryOf(file, arrival)], { quiet: true }), name);
  switch (verdict.kind) {
    case 'added':
      notify({ id, text: t('{quoted} est rangé dans la mémoire.', { quoted: quoted(name) }), file: verdict.file, trouble: false });
      break;
    case 'duplicate':
      notify({ id, text: t('{quoted} : cette session est déjà présente.', { quoted: quoted(name) }), file: verdict.file, trouble: false });
      break;
    case 'refused':
      notify({ id, text: verdict.text, file: null, trouble: true });
      break;
    case 'retry':
      notify({
        id,
        text: verdict.reason
          ? t("{quoted} n'a pas pu être rangé ({reason}). Gtracker le garde et réessaiera au prochain lancement.", { quoted: quoted(name), reason: verdict.reason })
          : t("{quoted} n'a pas pu être rangé. Gtracker le garde et réessaiera au prochain lancement.", { quoted: quoted(name) }),
        file: null,
        trouble: true,
      });
      return;
  }
  await forget(file);
};

/** Un passage : les fichiers un par un, jusqu'à la fin de la file ou jusqu'à ce qu'il faille attendre. */
const run = async (): Promise<void> => {
  for (;;) {
    again = false;
    if (isRecording()) {
      waitingForRecording = true;
      return;
    }
    const next = (await port.list()).find((file) => !handled.has(file.id));
    if (!next) {
      if (again) continue;
      return;
    }
    await lib.opening.catch(() => undefined);
    // Deux imports à la fois pourraient ranger deux fois la même session (`addGpx`, entre son test et son écriture).
    if (libraryState().importing) {
      waitingForImport = true;
      return;
    }
    if (isRecording()) continue;
    await handle(next);
  }
};

/** Vide la file autant qu'il se peut ; pendant un passage, en demande un autre après lui. */
export const drainIncomingFiles = (): Promise<void> => {
  if (running) {
    again = true;
    return running;
  }
  running = run()
    .catch((err: unknown) => console.warn(`Fichiers reçus : ${errorMessage(err, 'erreur inconnue')}`))
    .finally(() => {
      running = null;
    });
  return running;
};

/**
 * Lance la file, une fois l'enregistrement interrompu tranché (`main.tsx`). `isRecordingActive` et
 * `subscribeRecording` viennent de l'enregistreur, injectés comme pour `startLibraryUi` ; `routeImporter` range les
 * itinéraires reçus, injecté pour que la bibliothèque n'importe pas celle des itinéraires, qui l'importe. Une ouverture normale, file vide,
 * ne fait que lire une liste vide.
 */
export const startIncomingFiles = (
  isRecordingActive: () => boolean,
  subscribeRecording: (listener: () => void) => unknown,
  source: IncomingFilesPort = incomingFiles,
  routeImporter: IncomingRouteImporter | null = null,
): Promise<void> => {
  port = source;
  importRoute = routeImporter;
  isRecording = isRecordingActive;
  source.subscribe(() => void drainIncomingFiles());
  // À chaque position : un seul test tant que rien n'attend.
  subscribeRecording(() => {
    if (!waitingForRecording || isRecording()) return;
    waitingForRecording = false;
    void drainIncomingFiles();
  });
  subscribe(() => {
    if (!waitingForImport || libraryState().importing) return;
    waitingForImport = false;
    void drainIncomingFiles();
  });
  return drainIncomingFiles();
};
