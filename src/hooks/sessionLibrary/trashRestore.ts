import { errorMessage } from '../../core/basics';
import { t } from '../../core/i18n';
import { ROUTES_DIR, SESSIONS_DIR, sessionPath } from '../../library/folderLayout';
import { imuFileName, parseRecordWithRaw, recordFileName } from '../../library/record';
import { isBlankRecordText, recordToKeep } from '../../library/recordText';
import { routeRestorePlan, sessionRestorePlan, trashFilePath, trashGroupOf, type TrashEntry } from '../../library/trash';
import { copyFromTrash, dropTrashEntries, emptyTrash } from '../../library/trashFolder';
import type { MemoryFolder } from '../../platform/memoryFolder';
import { addGpx, type AddOptions } from './addSession';
import { refreshLibrary } from './lifecycle';
import { findSessionAt, lib } from './memory';
import { writeRecordNow } from './recordWrites';
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

const sameBytes = (a: Uint8Array | null, b: Uint8Array): boolean => a !== null && a.byteLength === b.byteLength && a.every((byte, k) => byte === b[k]);

/** Ce qu'une copie de la corbeille a fait pour une session déjà dans la mémoire. */
interface TrashCompletion {
  message: string;
  /**
   * Vrai seulement si la copie n'a plus rien que la mémoire ne tienne : la même trace, sa fiche lue et reçue (écrite
   * sur le disque quand elle a complété quelque chose), ses capteurs déjà là. Faux : elle doit rester dans la corbeille.
   */
  merged: boolean;
}

/**
 * Session déjà revenue dans la mémoire : la copie de la corbeille complète sa fiche et ses capteurs sans rien
 * écraser (`addGpx`, `completeRecord`), et dit si elle peut quitter la corbeille sans rien perdre.
 */
const completeFromTrash = async (f: MemoryFolder, entry: TrashEntry): Promise<TrashCompletion> => {
  const gpx = await f.readText(trashFilePath(entry.dir, entry.main));
  if (gpx === null) throw new Error(t('{file} manque dans la corbeille.', { file: entry.main }));
  const recordText = await f.readText(trashFilePath(entry.dir, recordFileName(entry.main)));
  const options = trashRecordOptions(recordText);
  const motion = await f.readBytes(trashFilePath(entry.dir, imuFileName(entry.main)));
  const source = options.record?.source ?? options.keepRecordText?.parts?.source ?? 'import';
  const result = await addGpx(gpx, source, { ...options, motion: motion ?? undefined });
  if (result.status !== 'duplicate' || result.file === null) {
    // GPX illisible ou trop court, ou relu comme une autre session : rien n'a été repris.
    return { message: result.message ?? t('« {name} » était déjà dans la mémoire : rien à reprendre de la corbeille.', { name: entry.name }), merged: false };
  }
  const file = result.file;
  // Une fiche gardée telle quelle, ou dont un champ ne se lit pas, n'a pas pu être reprise en entier.
  const recordWhole = recordText === null || isBlankRecordText(recordText)
    || (options.record !== null && Object.keys(options.unreadable ?? {}).length === 0);
  const recordTaken = recordWhole && !result.recordNotRead && !result.recordReadOnly && (!result.recordCompleted || (await writeRecordNow(file)));
  const sameTrack = (await f.readText(sessionPath(file))) === gpx;
  const motionHeld = motion === null || result.motionAdded === true || sameBytes(await f.readBytes(sessionPath(imuFileName(file))), motion);
  const message = result.recordCompleted || result.motionAdded
    ? t('« {name} » était déjà dans la mémoire : sa fiche a reçu ce qui lui manquait.', { name: entry.name })
    : t('« {name} » était déjà dans la mémoire : rien à reprendre de la corbeille.', { name: entry.name });
  return { message, merged: sameTrack && recordTaken && motionHeld };
};

/**
 * « Restaurer » une ligne de la corbeille (`groupedTrashEntries`) : la session revient dans `sessions/` depuis
 * l'entrée de l'ordinateur (capteurs, fiche, GPX en dernier, sous un nom libre), la mémoire est relue, puis chaque
 * autre entrée de la ligne (la copie du téléphone rangée à part) complète sa fiche et ses capteurs sans rien écraser,
 * et la ligne entière quitte la corbeille ; déjà revenue, elle n'est que complétée. Une entrée qui ne peut pas
 * compléter reste dans la corbeille. Un itinéraire revient dans `itineraires/` sous une base libre. Rend la phrase du
 * compte rendu ; lève en clair.
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
    const [first, ...others] = trashGroupOf(trashStore.get().entries, entry).entries;
    let message: string;
    const done: string[] = [];
    if (findSessionAt(startMs)) {
      const completion = await completeFromTrash(f, first);
      message = completion.message;
      if (completion.merged) done.push(first.dir);
    } else {
      const plan = sessionRestorePlan(first, (await f.list(SESSIONS_DIR)).map((e) => e.name));
      await copyFromTrash(f, plan.copies);
      await refreshLibrary();
      message = t('« {name} » est revenue dans la mémoire.', { name: first.name });
      done.push(first.dir);
    }
    for (const other of others) {
      // Seule une copie fondue sans reste part avec la ligne : une autre trace du même instant, une copie illisible
      // ou qui n'a pas pu tout donner reste dans la corbeille, rien n'est perdu. Sans la session publiée dans la
      // mémoire, la copie y entrerait comme une seconde session : elle attend.
      const completion = findSessionAt(startMs) ? await completeFromTrash(f, other).catch(() => null) : null;
      if (completion?.merged) done.push(other.dir);
    }
    await dropTrashEntries(f, done);
    return done.length === others.length + 1
      ? message
      : `${message} ${t("Une autre copie de cette session reste dans la corbeille : elle n'a pas pu compléter sa fiche.")}`;
  } catch (err) {
    throw new Error(t('Restauration impossible : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }));
  } finally {
    await reloadTrash();
  }
};

/** « Supprimer définitivement » la ligne qui tient `entry`, toutes ses entrées : l'index d'abord, puis leurs fichiers. */
export const deleteFromTrash = async (entry: TrashEntry): Promise<void> => {
  const f = await openTrash();
  try {
    await dropTrashEntries(f, trashGroupOf(trashStore.get().entries, entry).entries.map((e) => e.dir));
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
