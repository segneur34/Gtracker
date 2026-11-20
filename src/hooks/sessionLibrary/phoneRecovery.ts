import { useSyncExternalStore } from 'react';
import { t } from '../../core/i18n';
import { SESSIONS_DIR } from '../../library/folderLayout';
import { choosePhoneFiles, describeArrivalRecovery, type PhoneRecoveryChannel, type PhoneRecoveryOutcome } from '../../library/phoneRecovery';
import { NO_FOLDER_IMPORT_MESSAGE, READ_ONLY_MEMORY_MESSAGE, folderImportPaths } from '../../platform/memoryFolder';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { listPhoneFiles, phoneChannel, phoneImportEntries, phoneState, type PhoneFile, type PhoneState } from '../../platform/phoneCable';
import { wirelessAvailable, wirelessState } from '../../platform/wirelessPhone';
import { createStore } from '../createStore';
import { libraryState, setState } from './store';
import { lib, writableFolder } from './memory';
import { canImportSessions, importEntries } from './importer';

/**
 * « Récupérer », dans le programme Windows : les sessions du téléphone, relié par le Wi-Fi sinon branché par câble, que
 * le PC n'a pas encore sont rangées dans la mémoire du PC, par l'import de « Ajouter les sessions d'un dossier »
 * (`importEntries`). Rien n'est écrit sur le téléphone. L'avancement et l'issue se lisent hors des composants
 * (`usePhoneRecovery`) : la fenêtre peut être fermée et rouverte pendant la récupération, qui continue.
 *
 * Quand un téléphone relié se présente (`recoverOnArrival`), la même récupération se lance seule, et une ligne discrète
 * en dit le résultat (`useArrivalNote`). Jamais deux récupérations à la fois.
 */

/** Où en est la récupération. */
export type PhoneRecoveryStep =
  | { step: 'idle' }
  | { step: 'searching' }
  /** `done` fichiers lus sur les `total` à lire, sur le téléphone `phone`, lu par `channel`. */
  | { step: 'reading'; phone: string; done: number; total: number; channel?: PhoneRecoveryChannel }
  | { step: 'over'; outcome: PhoneRecoveryOutcome };

const progress = createStore<PhoneRecoveryStep>({ step: 'idle' });

/** La ligne que dit le PC après avoir rangé seul les sessions d'un téléphone qui se présentait. */
export interface ArrivalNote {
  text: string;
  /** Heure à laquelle elle a été posée, en millisecondes depuis 1970 : le composant la laisse s'effacer. */
  atMs: number;
}

const arrival = createStore<ArrivalNote | null>(null);

/** Ligne de la dernière arrivée, lue hors d'un composant. */
export const arrivalNote = arrival.get;

/** Ligne de la dernière arrivée, suivie par le composant ; `null` quand il n'y en a pas. */
export const useArrivalNote = (): ArrivalNote | null => useSyncExternalStore(arrival.subscribe, arrival.get);

/** Efface la ligne de l'arrivée (elle s'est affichée assez longtemps, ou une récupération commence). */
export const clearArrivalNote = (): void => arrival.set(null);

/** Étape de la récupération, lue hors d'un composant. */
export const phoneRecoveryStep = progress.get;

/** Étape de la récupération, suivie par le composant. */
export const usePhoneRecovery = (): PhoneRecoveryStep => useSyncExternalStore(progress.subscribe, progress.get);

/** Où en est le sans-fil du PC, pour le message d'un téléphone absent ; `undefined` quand il n'y a rien à en dire. */
const wirelessMode = async (): Promise<'listening' | 'off' | undefined> => {
  if (!wirelessAvailable()) return undefined;
  try {
    const state = await wirelessState();
    if (!state.actif) return 'off';
    return state.ecoute ? 'listening' : undefined;
  } catch {
    return undefined;
  }
};

/** Issue d'un téléphone qui n'est pas prêt. */
const notReady = async (state: Exclude<PhoneState, { etat: 'pret' }>): Promise<PhoneRecoveryOutcome> => {
  if (state.etat === 'adbIntrouvable') return { kind: 'tool-missing', folder: state.dossier };
  if (state.etat !== 'absent') return { kind: 'phone', state: state.etat };
  const wireless = await wirelessMode();
  return wireless ? { kind: 'phone', state: 'absent', wireless } : { kind: 'phone', state: 'absent' };
};

/** Fichiers à importer du téléphone, comme d'un dossier copié : GPX, FIT, fiches et capteurs, à la racine et dans `sessions/`. */
const importable = (files: readonly PhoneFile[]): PhoneFile[] => {
  const prefix = `${SESSIONS_DIR}/`;
  const entry = (name: string) => ({ name, kind: 'file' as const });
  const wanted = new Set(folderImportPaths(
    files.filter((f) => !f.path.includes('/')).map((f) => entry(f.path)),
    files.filter((f) => f.path.startsWith(prefix)).map((f) => entry(f.path.slice(prefix.length))),
  ));
  return files.filter((f) => wanted.has(f.path));
};

const recover = async (): Promise<PhoneRecoveryOutcome> => {
  await lib.opening.catch(() => undefined);
  const memory = libraryState();
  if (!canImportSessions(memory)) return { kind: 'memory', text: memory.memoryReadOnly ? READ_ONLY_MEMORY_MESSAGE : NO_FOLDER_IMPORT_MESSAGE };
  // Deux imports à la fois pourraient ranger deux fois la même session : on attend que l'autre finisse.
  if (memory.importing) return { kind: 'busy' };
  setState({ importing: true });
  let handedOver = false;
  let channel: PhoneRecoveryChannel | undefined;
  try {
    const state = await phoneState();
    if (state.etat !== 'pret') return await notReady(state);
    const phone = state.nom;
    channel = phoneChannel(state);
    let listed: PhoneFile[] | null;
    try {
      listed = await listPhoneFiles();
    } catch (err) {
      // Parti entre l'état et le listage : l'état du moment, plutôt qu'une panne.
      const now = await phoneState().catch(() => null);
      if (now && now.etat !== 'pret') return await notReady(now);
      throw err;
    }
    if (listed === null) return { kind: 'no-phone-folder', phone };
    const folder = writableFolder();
    if (!folder) return { kind: 'memory', text: NO_FOLDER_IMPORT_MESSAGE };
    const files = importable(listed);
    const pc = (await folder.list(SESSIONS_DIR)).filter((e) => e.kind === 'file').map((e) => ({ path: e.name, size: e.size }));
    const choice = choosePhoneFiles(files, pc);
    const sessionsOnPhone = files.filter((f) => /\.(gpx|fit)$/i.test(f.path)).length;
    let done = 0;
    progress.set({ step: 'reading', phone, done, total: choice.toRead, channel });
    const reading = phoneImportEntries(choice.toImport, () => {
      done += 1;
      progress.set({ step: 'reading', phone, done, total: Math.max(choice.toRead, done), channel });
    });
    // L'import tient lui-même l'état « import en cours » et le lève à sa fin.
    handedOver = true;
    const report = await importEntries(reading.entries, { fromFolder: true, quiet: true });
    report.duplicates += choice.alreadyHere.length;
    return { kind: 'done', phone, report, sessionsOnPhone, unplugged: reading.unplugged(), channel };
  } catch (err) {
    return { kind: 'error', detail: nativeErrorMessage(err, t('erreur inconnue')), channel };
  } finally {
    if (!handedOver) setState({ importing: false });
  }
};

let running: Promise<void> | null = null;

/** Arrivée qui attend la fin de la récupération en cours : les arrivées qui suivent se joignent à elle. */
let waitingArrival: Promise<void> | null = null;

/** Une récupération, de l'état du téléphone à l'issue ; `phone` : le téléphone dont l'arrivée l'a lancée, sinon `null`. */
const launch = (phone: string | null): Promise<void> => {
  progress.set({ step: 'searching' });
  arrival.set(null);
  running = recover()
    .then((outcome) => {
      progress.set({ step: 'over', outcome });
      const text = phone === null ? null : describeArrivalRecovery(outcome, phone);
      if (text !== null) arrival.set({ text, atMs: Date.now() });
    })
    .finally(() => {
      running = null;
    });
  return running;
};

/**
 * Lance la récupération ; pendant qu'elle tourne, un nouvel appel rend la même. Chaque appel suivant repart du début :
 * état du téléphone, listage, choix, import.
 */
export const recoverFromPhone = (): Promise<void> => running ?? launch(null);

/**
 * Un téléphone relié se présente (`phone` : son nom) : le PC range seul les sessions qu'il n'a pas, comme « Récupérer »,
 * et dit le résultat par une ligne (`useArrivalNote`). Une récupération déjà en cours n'est pas doublée : l'arrivée
 * attend sa fin, puis repart du début (ce que la première a rangé n'est pas relu).
 */
export const recoverOnArrival = (phone: string): Promise<void> => {
  if (waitingArrival) return waitingArrival;
  if (!running) return launch(phone);
  const waiting = running.then(() => {
    waitingArrival = null;
    return launch(phone);
  });
  waitingArrival = waiting;
  return waiting;
};
