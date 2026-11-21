import { activityDisplayName, sessionActivity } from '../../core/activities';
import { errorMessage } from '../../core/basics';
import { t } from '../../core/i18n';
import { sessionDisplayName } from '../../library/sessionName';
import { deletesToTrash, sessionTrashEntries, shownTrashEntries, type TrashEntry } from '../../library/trash';
import { dropTrashEntries, purgeTrash, readTrashIndex, stashInTrash, type TrashRequest } from '../../library/trashFolder';
import type { LibrarySession } from '../../library/record';
import type { MemoryFolder } from '../../platform/memoryFolder';
import { createStore } from '../createStore';
import { readStoredActivities } from '../useSportSettings';
import { lib } from './memory';

/**
 * Corbeille du programme Windows, côté mémoire (`library/trash.ts`, `library/trashFolder.ts`) : purgée à
 * l'ouverture du dossier, remplie par la suppression d'une session ou d'un itinéraire, allégée d'une session qui
 * revient par un import. Seul le dossier du disque en a une ; ailleurs, rien ne change.
 */

export interface TrashState {
  /** Entrées de la corbeille du dossier ouvert ; vide hors du programme Windows. */
  entries: TrashEntry[];
  /** L'index ne se lit pas : rien n'entre ni ne sort de la corbeille. */
  error: string | null;
}

export const trashStore = createStore<TrashState>({ entries: [], error: null });

/** Le dossier ouvert s'il a une corbeille (`deletesToTrash` : dossier du disque, en écriture) ; `null` sinon. */
export const trashFolderOf = (f: MemoryFolder | null): MemoryFolder | null => (f && deletesToTrash(f.kind, f.readOnly === true) ? f : null);

/** Phrase d'une corbeille illisible ou d'une version plus récente. */
const lockedText = (state: string): string | null =>
  state === 'unreadable' ? t('La corbeille ne se lit pas : son fichier corbeille/corbeille.json est abîmé. Rien ne la remplit ni ne la vide.')
    : state === 'newer' ? t("La corbeille vient d'une version plus récente de Gtracker : mettez l'application à jour pour l'ouvrir.")
      : null;

let trashGate: Promise<void> = Promise.resolve();

/**
 * Tient la corbeille pendant `action` (une synchronisation, qui compte sur ce qu'elle tient pour retirer une session
 * du téléphone) : « Restaurer », « Supprimer définitivement », « Vider la corbeille » et la purge attendent sa fin.
 */
export const holdTrashDuring = <T,>(action: () => Promise<T>): Promise<T> => {
  const running = action();
  trashGate = running.then(() => undefined, () => undefined);
  return running;
};

/** Attend qu'aucune synchronisation ne tienne la corbeille. */
export const trashReleased = (): Promise<void> => trashGate;

/** Relit l'index de la corbeille du dossier ouvert ; vide hors du programme Windows. Les restes d'une session n'y sont pas montrés. */
export const reloadTrash = async (): Promise<void> => {
  const f = trashFolderOf(lib.folder);
  if (!f) {
    trashStore.set({ entries: [], error: null });
    return;
  }
  try {
    const index = await readTrashIndex(f);
    if (f !== lib.folder) return;
    trashStore.set({ entries: shownTrashEntries(index.entries), error: lockedText(index.state) });
  } catch (err) {
    trashStore.set({ entries: [], error: t('Corbeille non relue : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }) });
  }
};

/**
 * À l'ouverture d'un dossier : purge des entrées de plus de 30 jours et des restes, puis lecture de la corbeille.
 * Sans effet hors du programme Windows ; un échec n'empêche rien d'autre.
 */
export const startTrash = async (opened: MemoryFolder): Promise<void> => {
  const f = trashFolderOf(opened);
  if (!f) {
    trashStore.set({ entries: [], error: null });
    return;
  }
  try {
    await trashReleased();
    await purgeTrash(f, Date.now());
  } catch {
    // Purge reprise au lancement suivant ; la corbeille se lit quand même.
  }
  if (f === lib.folder) await reloadTrash();
};

/**
 * Nom montré d'une session au moment où elle part à la corbeille, le même que dans la liste des sessions : une
 * session sans activité inscrite (importée) prend celle de son calcul (`sessionActivity`).
 */
export const recordShownName = (record: LibrarySession['record'], file: string): string => {
  const activity = sessionActivity(readStoredActivities(), record.activityId, record.sport);
  return sessionDisplayName(record, activity ? activityDisplayName(activity) : null, file);
};

const shownName = (session: LibrarySession): string => recordShownName(session.record, session.file);

/**
 * Met à la corbeille une copie d'une session (`paths` : ses fichiers et ceux de ses copies en double, dans l'ordre
 * de leur retrait, GPX d'abord) avant que l'appelant ne retire les originaux. Lève si la copie échoue : rien n'est
 * alors retiré.
 */
export const stashSession = async (f: MemoryFolder, session: LibrarySession, paths: string[], main: string): Promise<void> => {
  const request: TrashRequest = { kind: 'session', paths, main, startMs: session.record.summary.startMs, name: shownName(session) };
  await stashInTrash(f, request, Date.now());
  await reloadTrash();
};

/**
 * Même chose pour un itinéraire du dossier `folder` (`paths` : sa fiche, puis son GPX, dans l'ordre de leur
 * retrait) ; sans effet hors du programme Windows.
 */
export const stashRoute = async (
  folder: MemoryFolder, route: { base: string; name: string; createdAt: string }, paths: string[], main: string
): Promise<void> => {
  const f = trashFolderOf(folder);
  if (!f) return;
  const request: TrashRequest = { kind: 'itineraire', paths, main, routeBase: route.base, createdAt: route.createdAt, name: route.name };
  await stashInTrash(f, request, Date.now());
  await reloadTrash();
};

/**
 * Une session entrée dans la mémoire (import, restauration) : ses entrées de corbeille venues de l'ordinateur
 * partent, pour qu'elle ne soit pas montrée deux fois. Une copie du téléphone, rangée à part par la synchronisation,
 * reste : elle peut tenir une autre version que celle qui revient. Sans effet si la corbeille n'en a pas ; un échec
 * est tu (l'entrée reste, sans gêne).
 */
export const forgetReturnedSession = async (startMs: number): Promise<void> => {
  const f = trashFolderOf(lib.folder);
  if (!f) return;
  const dirs = sessionTrashEntries(trashStore.get().entries, startMs).filter((e) => e.origin === 'ordinateur').map((e) => e.dir);
  if (dirs.length === 0) return;
  try {
    await dropTrashEntries(f, dirs);
  } catch {
    // L'entrée reste dans la corbeille ; « Supprimer définitivement » l'en retire.
  }
  await reloadTrash();
};
