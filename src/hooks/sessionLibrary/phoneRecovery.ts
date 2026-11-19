import { useSyncExternalStore } from 'react';
import { t } from '../../core/i18n';
import { SESSIONS_DIR } from '../../library/folderLayout';
import { choosePhoneFiles, type PhoneRecoveryOutcome } from '../../library/phoneRecovery';
import { NO_FOLDER_IMPORT_MESSAGE, READ_ONLY_MEMORY_MESSAGE, folderImportPaths } from '../../platform/memoryFolder';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { listPhoneFiles, phoneImportEntries, phoneState, type PhoneFile, type PhoneState } from '../../platform/phoneCable';
import { createStore } from '../createStore';
import { libraryState, setState } from './store';
import { lib, writableFolder } from './memory';
import { canImportSessions, importEntries } from './importer';

/**
 * « Récupérer », dans le programme Windows : les sessions du téléphone branché par câble que le PC n'a pas encore
 * sont rangées dans la mémoire du PC, par l'import de « Ajouter les sessions d'un dossier » (`importEntries`). Rien
 * n'est écrit sur le téléphone. L'avancement et l'issue se lisent hors des composants (`usePhoneRecovery`) : la
 * fenêtre peut être fermée et rouverte pendant la récupération, qui continue.
 */

/** Où en est la récupération. */
export type PhoneRecoveryStep =
  | { step: 'idle' }
  | { step: 'searching' }
  /** `done` fichiers lus sur les `total` à lire, sur le téléphone `phone`. */
  | { step: 'reading'; phone: string; done: number; total: number }
  | { step: 'over'; outcome: PhoneRecoveryOutcome };

const progress = createStore<PhoneRecoveryStep>({ step: 'idle' });

/** Étape de la récupération, lue hors d'un composant. */
export const phoneRecoveryStep = progress.get;

/** Étape de la récupération, suivie par le composant. */
export const usePhoneRecovery = (): PhoneRecoveryStep => useSyncExternalStore(progress.subscribe, progress.get);

/** Issue d'un téléphone qui n'est pas prêt. */
const notReady = (state: Exclude<PhoneState, { etat: 'pret' }>): PhoneRecoveryOutcome =>
  state.etat === 'adbIntrouvable' ? { kind: 'tool-missing', folder: state.dossier } : { kind: 'phone', state: state.etat };

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
  try {
    const state = await phoneState();
    if (state.etat !== 'pret') return notReady(state);
    const phone = state.nom;
    let listed: PhoneFile[] | null;
    try {
      listed = await listPhoneFiles();
    } catch (err) {
      // Débranché entre l'état et le listage : l'état du moment, plutôt qu'une panne.
      const now = await phoneState().catch(() => null);
      if (now && now.etat !== 'pret') return notReady(now);
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
    progress.set({ step: 'reading', phone, done, total: choice.toRead });
    const reading = phoneImportEntries(choice.toImport, () => {
      done += 1;
      progress.set({ step: 'reading', phone, done, total: Math.max(choice.toRead, done) });
    });
    // L'import tient lui-même l'état « import en cours » et le lève à sa fin.
    handedOver = true;
    const report = await importEntries(reading.entries, { fromFolder: true, quiet: true });
    report.duplicates += choice.alreadyHere.length;
    return { kind: 'done', phone, report, sessionsOnPhone, unplugged: reading.unplugged() };
  } catch (err) {
    return { kind: 'error', detail: nativeErrorMessage(err, t('erreur inconnue')) };
  } finally {
    if (!handedOver) setState({ importing: false });
  }
};

let running: Promise<void> | null = null;

/**
 * Lance la récupération ; pendant qu'elle tourne, un nouvel appel rend la même. Chaque appel suivant repart du début :
 * état du téléphone, listage, choix, import.
 */
export const recoverFromPhone = (): Promise<void> => {
  if (running) return running;
  progress.set({ step: 'searching' });
  running = recover()
    .then((outcome) => progress.set({ step: 'over', outcome }))
    .finally(() => {
      running = null;
    });
  return running;
};
