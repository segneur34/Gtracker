import type { MemoryFolder } from '../platform/memoryFolder';
import {
  TRASH_DIR, TRASH_INDEX_PATH, expiredTrashEntries, isTrashDirName, isWritableTrash, orphanTrashDirs, parseTrashIndex,
  reusableRouteEntry, reusableTrashEntry, serializeTrashIndex, trashDirName, trashFilePath, withoutTrashEntries,
  type TrashCopy, type TrashEntry, type TrashFile, type TrashIndex, type TrashKind, type TrashOrigin,
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
  kind: Exclude<TrashKind, 'restes'>;
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
    const present: TrashFile[] = [];
    if (request.kind === 'session') {
      for (const path of request.paths) {
        const stat = await f.stat(path);
        if (stat) present.push({ name: baseName(path), size: stat.size });
      }
    }
    const reused = request.kind === 'session'
      ? reusableTrashEntry(index.entries, request.startMs ?? NaN, mainName, present)
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
 * Fichiers à ranger tels quels, lus ailleurs (la synchronisation : de l'ordinateur ou du téléphone) : ceux d'une
 * session (par défaut), ses restes, ou ceux d'un itinéraire (`itineraire` : sa fiche et son GPX).
 */
export type TrashBytesRequest = {
  name: string;
  origin: TrashOrigin;
  /**
   * Session : nom de son GPX ; il peut manquer parmi `files` (restes d'une suppression coupée : fiche, capteurs).
   * Itinéraire : nom de sa fiche.
   */
  main: string;
  /** Les fichiers, dans l'ordre de leur retrait (GPX d'abord pour une session, fiche d'abord pour un itinéraire), sous leurs noms d'origine. */
  files: { name: string; bytes: Uint8Array }[];
} & (
  /** `restes` : fiche ou capteurs sans leur GPX, jamais montrés comme une session ; par défaut `session`. */
  | { kind?: 'session' | 'restes'; startMs: number }
  /** Itinéraire : base de ses noms de fichiers, et création (`null` : fiche sans date, reconnue à sa base). */
  | { kind: 'itineraire'; routeBase: string; createdAt: string | null }
);

/** Entrée qui tient déjà ces fichiers d'un itinéraire, de même base, même création et même origine (reprise après une coupure). */
const reusableRouteBytesEntry = (
  entries: readonly TrashEntry[], request: Extract<TrashBytesRequest, { kind: 'itineraire' }>, files: readonly TrashFile[],
): TrashEntry | null =>
  entries.find((e) => e.kind === 'itineraire' && e.origin === request.origin && e.createdAt === request.createdAt
    && e.routeBase?.toLowerCase() === request.routeBase.toLowerCase() && e.main.toLowerCase() === request.main.toLowerCase()
    && files.every((file) => e.files.some((g) => g.name.toLowerCase() === file.name.toLowerCase() && g.size === file.size))) ?? null;

/**
 * Range dans une entrée neuve de la corbeille des fichiers déjà lus, dans l'ordre inverse de leur retrait (pour une
 * session : capteurs, fiche, puis GPX en dernier), puis l'entrée de l'index. Une entrée de même identité, même
 * origine, même fichier principal, qui tient déjà chacun de ces fichiers à la même taille (reprise après une coupure)
 * est rendue sans rien recopier. Lève sans rien changer si l'index ne se lit pas.
 */
export const stashFilesInTrash = (f: TrashFolder, request: TrashBytesRequest, nowMs: number): Promise<TrashEntry> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    const sizes = request.files.map((file) => ({ name: file.name, size: file.bytes.byteLength }));
    const route = request.kind === 'itineraire' ? request : null;
    const session = request.kind === 'itineraire' ? null : request;
    const reused = route
      ? reusableRouteBytesEntry(index.entries, route, sizes)
      : reusableTrashEntry(index.entries, session?.startMs ?? NaN, request.main, sizes, request.origin, session?.kind ?? 'session');
    if (reused) return reused;
    const listed = await f.list(TRASH_DIR);
    const identity = route ? route.routeBase : String(session?.startMs);
    const dir = trashDirName(nowMs, identity, [...listed.map((e) => e.name), ...index.entries.map((e) => e.dir)]);
    for (const file of [...request.files].reverse()) await f.writeBytes(trashFilePath(dir, file.name), file.bytes);
    const entry: TrashEntry = {
      dir, kind: route ? 'itineraire' : session?.kind ?? 'session', startMs: session ? session.startMs : null,
      routeBase: route ? route.routeBase : null, createdAt: route ? route.createdAt : null, name: request.name, deletedAtMs: nowMs,
      origin: request.origin, reason: 'supprimee', main: request.main, files: sizes,
    };
    await writeIndex(f, [...index.entries, entry]);
    return entry;
  });

/**
 * Ajoute des fichiers à une entrée existante (les restes d'une session, rangés avec elle), sans rien y écraser : un
 * fichier déjà là à la même taille est tenu pour gardé ; déjà là à une autre taille, rien n'est ajouté et la réponse
 * est `false`, pour que l'appelant les range ailleurs. Lève si l'index ne se lit pas. Les fichiers ajoutés sont
 * écrits avant l'index : une coupure laisse au pire un fichier hors de l'index, effacé avec l'entrée.
 */
export const addFilesToTrashEntry = (f: TrashFolder, dir: string, files: readonly { name: string; bytes: Uint8Array }[]): Promise<boolean> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    const entry = index.entries.find((e) => e.dir === dir);
    if (!entry) return false;
    const added: TrashFile[] = [];
    for (const file of files) {
      const at = await f.stat(trashFilePath(dir, file.name));
      if (at && at.size !== file.bytes.byteLength) return false;
      const listed = entry.files.some((e) => e.name.toLowerCase() === file.name.toLowerCase());
      if (!at || !listed) added.push({ name: file.name, size: file.bytes.byteLength });
    }
    for (const file of files) {
      if (!(await f.stat(trashFilePath(dir, file.name)))) await f.writeBytes(trashFilePath(dir, file.name), file.bytes);
    }
    if (added.length === 0) return true;
    const known = new Set(entry.files.map((e) => e.name.toLowerCase()));
    const merged = [...entry.files, ...added.filter((a) => !known.has(a.name.toLowerCase()))];
    await writeIndex(f, index.entries.map((e) => (e === entry ? { ...e, files: merged } : e)));
    return true;
  });

/**
 * Réécrit un fichier texte d'une entrée (une fiche de la corbeille dans laquelle on a fondu ce que le téléphone y
 * ajoutait), puis sa taille dans l'index. Lève si l'index ne se lit pas ou si l'entrée n'y est plus ; une coupure
 * entre les deux laisse l'ancienne taille dans l'index, sans autre effet.
 */
export const rewriteTrashText = (f: TrashFolder, dir: string, name: string, text: string): Promise<void> =>
  inTrashQueue(async () => {
    const index = await readTrashIndex(f);
    if (!isWritableTrash(index)) throw new Error(TRASH_LOCKED_MESSAGE);
    const entry = index.entries.find((e) => e.dir === dir);
    if (!entry) throw new Error(t('{file} manque dans la corbeille.', { file: `${dir}/${name}` }));
    const bytes = new TextEncoder().encode(text);
    await f.writeBytes(trashFilePath(dir, name), bytes);
    const files = entry.files.map((file) => (file.name === name ? { ...file, size: bytes.byteLength } : file));
    await writeIndex(f, index.entries.map((e) => (e === entry ? { ...e, files } : e)));
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
