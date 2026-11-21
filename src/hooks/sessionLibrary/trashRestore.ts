import { errorMessage } from '../../core/basics';
import { t } from '../../core/i18n';
import { ROUTES_DIR, SESSIONS_DIR } from '../../library/folderLayout';
import { imuFileName, parseRecordWithRaw, recordFileName } from '../../library/record';
import { isBlankRecordText, recordToKeep } from '../../library/recordText';
import { routeRestorePlan, sessionRestorePlan, sessionTrashEntries, trashFilePath, type TrashEntry } from '../../library/trash';
import { copyFromTrash, dropTrashEntries, emptyTrash } from '../../library/trashFolder';
import type { MemoryFolder } from '../../platform/memoryFolder';
import { addGpx, type AddOptions } from './addSession';
import { refreshLibrary } from './lifecycle';
import { findSessionAt, lib } from './memory';
import { reloadTrash, trashFolderOf, trashReleased, trashStore } from './trash';

/**
 * Gestes de Réglages › Mémoire sur la corbeille du programme Windows : restaurer une entrée, la supprimer
 * définitivement, vider la corbeille. Chacun rend la phrase à montrer, ou lève avec elle.
 */

const openTrash = async (): Promise<MemoryFolder> => {
  await lib.opening;
  // Une synchronisation compte sur ce que tient la corbeille : le geste attend sa fin.
  await trashReleased();
  const f = trashFolderOf(lib.folder);
  if (!f) throw new Error(t("La corbeille n'est pas ouverte : le dossier mémoire ne répond pas."));
  return f;
};

/** Fiche de la corbeille, à donner à `addGpx` comme le fait un import (`recordToCopy`). */
const trashRecordOptions = (text: string | null): Pick<AddOptions, 'record' | 'unreadable' | 'keepRecordText'> => {
  if (text === null || isBlankRecordText(text)) return { record: null };
  const parsed = parseRecordWithRaw(text);
  const keepRecordText = recordToKeep(text, parsed);
  return keepRecordText ? { record: null, keepRecordText } : { record: parsed?.parts ?? null, unreadable: parsed?.unreadable };
};

/**
 * Session déjà revenue dans la mémoire : la copie de la corbeille complète sa fiche et ses capteurs sans rien
 * écraser (`addGpx`, `completeRecord`).
 */
const completeFromTrash = async (f: MemoryFolder, entry: TrashEntry): Promise<string> => {
  const gpx = await f.readText(trashFilePath(entry.dir, entry.main));
  if (gpx === null) throw new Error(t('{file} manque dans la corbeille.', { file: entry.main }));
  const options = trashRecordOptions(await f.readText(trashFilePath(entry.dir, recordFileName(entry.main))));
  const motion = await f.readBytes(trashFilePath(entry.dir, imuFileName(entry.main)));
  const source = options.record?.source ?? options.keepRecordText?.parts?.source ?? 'import';
  const result = await addGpx(gpx, source, { ...options, motion: motion ?? undefined });
  return result.recordCompleted || result.motionAdded
    ? t('« {name} » était déjà dans la mémoire : sa fiche a reçu ce qui lui manquait.', { name: entry.name })
    : t('« {name} » était déjà dans la mémoire : rien à reprendre de la corbeille.', { name: entry.name });
};

/**
 * « Restaurer » : une session revient dans `sessions/` (capteurs, fiche, GPX en dernier, sous un nom libre), puis
 * ses entrées quittent la corbeille, et la mémoire est relue ; déjà revenue, elle n'est que complétée. Un
 * itinéraire revient dans `itineraires/` sous une base libre. Rend la phrase du compte rendu ; lève en clair.
 */
export const restoreFromTrash = async (entry: TrashEntry): Promise<string> => {
  const f = await openTrash();
  try {
    if (entry.kind === 'itineraire') {
      const plan = routeRestorePlan(entry, (await f.list(ROUTES_DIR)).map((e) => e.name));
      await copyFromTrash(f, plan.copies);
      await dropTrashEntries(f, [entry.dir]);
      return t('« {name} » est revenu dans les itinéraires.', { name: entry.name });
    }
    const startMs = entry.startMs;
    if (startMs === null) throw new Error(t('Entrée de corbeille sans instant de départ.'));
    // Première lecture du dossier en cours : la session n'est peut-être pas encore publiée.
    if (!findSessionAt(startMs) && lib.scanCompletion) await lib.scanCompletion.then(() => undefined, () => undefined);
    // Les entrées de l'autre origine restent : la copie du téléphone rangée à part peut tenir une autre version.
    const dirs = [entry.dir, ...sessionTrashEntries(trashStore.get().entries, startMs).filter((e) => e.origin === entry.origin).map((e) => e.dir)];
    if (findSessionAt(startMs)) {
      const message = await completeFromTrash(f, entry);
      await dropTrashEntries(f, dirs);
      return message;
    }
    const plan = sessionRestorePlan(entry, (await f.list(SESSIONS_DIR)).map((e) => e.name));
    await copyFromTrash(f, plan.copies);
    await dropTrashEntries(f, dirs);
    await refreshLibrary();
    return t('« {name} » est revenue dans la mémoire.', { name: entry.name });
  } catch (err) {
    throw new Error(t('Restauration impossible : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }));
  } finally {
    await reloadTrash();
  }
};

/** « Supprimer définitivement » une entrée : l'index d'abord, puis ses fichiers. */
export const deleteFromTrash = async (entry: TrashEntry): Promise<void> => {
  const f = await openTrash();
  try {
    await dropTrashEntries(f, [entry.dir]);
  } finally {
    await reloadTrash();
  }
};

/** « Vider la corbeille ». */
export const emptyWholeTrash = async (): Promise<void> => {
  const f = await openTrash();
  try {
    await emptyTrash(f);
  } finally {
    await reloadTrash();
  }
};
