import type { MemoryFolder } from '../platform/memoryFolder';
import {
  TRASH_DIR, TRASH_INDEX_PATH, expiredTrashEntries, isTrashDirName, isWritableTrash, orphanTrashDirs, parseTrashIndex,
  reusableRouteEntry, reusableTrashEntry, serializeTrashIndex, trashDirName, trashFilePath, withoutTrashEntries,
  type TrashCopy, type TrashEntry, type TrashFile, type TrashIndex, type TrashKind,
} from './trash';
import { t } from '../core/i18n';

/**
 * Gestes de la corbeille sur le dossier mémoire (`trash.ts` pour ce qu'elle range) : y mettre, purger, vider,
 * retirer une entrée, recopier les fichiers d'une entrée. Une seule opération à la fois (`inTrashQueue`) : une purge
 * qui listerait la corbeille pendant une mise à la corbeille prendrait son sous-dossier, pas encore dans l'index,
 * pour un reste à effacer.
 */

export type TrashFolder = Pick<MemoryFolder, 'list' | 'readText' | 'readBytes' | 'writeText' | 'writeBytes' | 'remove' | 'removeDir' | 'stat'>;

/** Refus d'écrire dans une corbeille dont l'index ne se lit pas : ses entrées seraient perdues. */
export const TRASH_LOCKED_MESSAGE = t("La corbeille ne se lit pas (corbeille/corbeille.json) : rien n'y est rangé, et rien n'est supprimé.");

let queue: Promise<unknown> = Promise.resolve();

/** Lance `action` après les opérations de corbeille en cours, une à la fois. */
export const inTrashQueue = <T,>(action: () => Promise<T>): Promise<T> => {
  const next = queue.then(action, action);
  queue = next.then(() => undefined, () => undefined);
  return next;
};

export const readTrashIndex = async (f: Pick<MemoryFolder, 'readText'>): Promise<TrashIndex> =>
  parseTrashIndex(await f.readText(TRASH_INDEX_PATH));

const writeIndex = (f: TrashFolder, entries: readonly TrashEntry[]): Promise<void> =>
  f.writeText(TRASH_INDEX_PATH, serializeTrashIndex(entries));

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Efface les fichiers d'un sous-dossier de la corbeille, puis le sous-dossier s'il le sait. */
const eraseTrashDir = async (f: TrashFolder, dir: string): Promise<void> => {
  for (const e of await f.list(`${TRASH_DIR}/${dir}`)) {
    if (e.kind === 'file') await f.remove(trashFilePath(dir, e.name));
  }
  await f.removeDir?.(`${TRASH_DIR}/${dir}`);
};

/** Ce qu'on met à la corbeille. */
export interface TrashRequest {
  kind: TrashKind;
  /** Fichiers, chemins depuis la racine, dans l'ordre où on les retire de la mémoire (GPX d'abord pour une session). */
  paths: string[];
  /** Le fichier qui fait l'entrée (GPX de la session, fiche de l'itinéraire) ; parmi `paths`. */
  main: string;
  /** Session : `summary.startMs`. */
  startMs?: number;
  /** Itinéraire : base des noms et création. */
  routeBase?: string;
  createdAt?: string;
  /** Nom montré. */
  name: string;
}

/**
 * Range dans la corbeille une copie des fichiers de `request` : recopiés dans l'ordre inverse de leur retrait (pour
 * une session : capteurs, fiche, GPX en dernier), puis l'entrée écrite dans l'index. Les originaux ne sont pas
 * retirés ici : l'appelant les retire ensuite, comme il le faisait sans corbeille. Une entrée déjà faite pour la même
 * session (suppression coupée après l'index) est reprise sans rien recopier. Fichier absent : sauté. Lève sans rien
 * changer si l'index ne se lit pas (`TRASH_LOCKED_MESSAGE`) ; une copie coupée laisse un sous-dossier hors de l'index,
 * effacé à la purge suivante.
 */
export const stashInTrash = (f: TrashFolder, request: TrashRequest, nowMs: number): Promise<TrashEntry | null> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    const mainStat = await f.stat(request.main);
    if (mainStat === null) return null;
    const mainName = baseName(request.main);
    const reused = request.kind === 'session'
      ? reusableTrashEntry(index.entries, request.startMs ?? NaN, mainName, mainStat.size)
      : reusableRouteEntry(index.entries, request.routeBase ?? '', request.createdAt ?? '', mainStat.size);
    if (reused) return reused;
    const listed = await f.list(TRASH_DIR);
    const identity = request.kind === 'session' ? String(request.startMs) : request.routeBase ?? mainName;
    const dir = trashDirName(nowMs, identity, [...listed.map((e) => e.name), ...index.entries.map((e) => e.dir)]);
    const files: TrashFile[] = [];
    for (const path of [...request.paths].reverse()) {
      const bytes = await f.readBytes(path);
      if (bytes === null) continue;
      await f.writeBytes(trashFilePath(dir, baseName(path)), bytes);
      files.unshift({ name: baseName(path), size: bytes.byteLength });
    }
    const entry: TrashEntry = {
      dir,
      kind: request.kind,
      startMs: request.kind === 'session' ? request.startMs ?? null : null,
      routeBase: request.kind === 'itineraire' ? request.routeBase ?? null : null,
      createdAt: request.kind === 'itineraire' ? request.createdAt ?? null : null,
      name: request.name,
      deletedAtMs: nowMs,
      origin: 'ordinateur',
      reason: 'supprimee',
      main: mainName,
      files,
    };
    await writeIndex(f, [...index.entries, entry]);
    return entry;
  });

/**
 * Purge : les entrées de plus de `TRASH_KEEP_DAYS` jours, fichiers d'abord, entrées ensuite ; puis les sous-dossiers
 * absents de l'index. Rien si l'index ne se lit pas. Rend les entrées restantes. Une erreur sur un sous-dossier
 * n'arrête pas les autres ; l'entrée dont les fichiers n'ont pas tous été effacés reste, pour la purge suivante.
 */
export const purgeTrash = (f: TrashFolder, nowMs: number): Promise<TrashIndex> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) return index;
    const purged: string[] = [];
    for (const entry of expiredTrashEntries(index.entries, nowMs)) {
      try {
        await eraseTrashDir(f, entry.dir);
        purged.push(entry.dir);
      } catch {
        // Laissée : reprise à la purge suivante.
      }
    }
    const entries = withoutTrashEntries(index.entries, purged);
    if (purged.length > 0) await writeIndex(f, entries);
    for (const dir of orphanTrashDirs(entries, await f.list(TRASH_DIR))) {
      await eraseTrashDir(f, dir).catch(() => undefined);
    }
    return { state: index.state === 'absent' && entries.length === 0 ? 'absent' : 'ok', entries };
  });

/**
 * Retire de la corbeille les entrées `dirs` (restaurées, revenues par un import, ou supprimées définitivement) :
 * l'index d'abord, puis leurs fichiers. Une coupure entre les deux laisse un sous-dossier hors de l'index, effacé à
 * la purge suivante, jamais une entrée sans ses fichiers. Rend les entrées restantes.
 */
export const dropTrashEntries = (f: TrashFolder, dirs: readonly string[]): Promise<TrashEntry[]> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    const known = new Set(index.entries.map((e) => e.dir.toLowerCase()));
    const gone = dirs.filter((d) => known.has(d.toLowerCase()));
    if (gone.length === 0) return index.entries;
    const entries = withoutTrashEntries(index.entries, gone);
    await writeIndex(f, entries);
    for (const dir of gone) await eraseTrashDir(f, dir).catch(() => undefined);
    return entries;
  });

/** « Vider la corbeille » : l'index vidé, puis chaque sous-dossier de la corbeille, entrées et restes compris. */
export const emptyTrash = (f: TrashFolder): Promise<void> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    await writeIndex(f, []);
    for (const e of await f.list(TRASH_DIR)) {
      if (e.kind === 'directory' && isTrashDirName(e.name)) await eraseTrashDir(f, e.name);
    }
  });

/** Recopie les fichiers d'une entrée vers la mémoire, dans l'ordre du plan (`sessionRestorePlan`, `routeRestorePlan`). */
export const copyFromTrash = (f: TrashFolder, copies: readonly TrashCopy[]): Promise<void> =>
  inTrashQueue(async () => {
    for (const { from, to } of copies) {
      const bytes = await f.readBytes(from);
      if (bytes === null) throw new Error(t('{file} manque dans la corbeille.', { file: from }));
      await f.writeBytes(to, bytes);
    }
  });
