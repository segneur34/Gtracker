import { errorMessage } from '../../core/basics';
import { ROUTES_DIR, routePath } from '../../library/folderLayout';
import { routeDisplayName } from '../../library/routeName';
import {
  SYNC_SIDES, otherSyncSide, withRouteHeld, withRouteLine, withoutRouteLine,
  type SyncBase, type SyncSideName, type SyncStamp,
} from '../../library/syncBase';
import type { SyncRoutesOutcome } from '../../library/syncOutcome';
import {
  routeRecordsToRead, syncRouteId, syncRouteLineOf, syncRouteListing, syncRouteSide,
  type RouteSyncInput, type RouteSyncItem, type RouteSyncOp, type RouteSyncPlan, type SyncRouteListed, type SyncTrashedRoute,
} from '../../library/syncRoutes';
import { trashFilePath, type TrashEntry, type TrashOrigin } from '../../library/trash';
import { readTrashIndex, stashFilesInTrash } from '../../library/trashFolder';
import { isWritableRouteRecord, parseRouteRecord } from '../../planning/routeRecord';
import type { FileStat, MemoryFolder } from '../../platform/memoryFolder';

/**
 * Exécutant de la synchronisation des itinéraires (`itineraires/`) entre l'ordinateur et le téléphone, appelé par celui
 * des sessions (`sync.ts`) après elles : il lit les deux côtés et la corbeille pour le plan (`library/syncRoutes.ts`),
 * puis fait ses opérations une à une, et tient les lignes d'itinéraires de la base.
 *
 * - Une copie s'écrit GPX puis fiche : une coupure laisse un GPX sans fiche, que l'application ignore et que la
 *   copie suivante reprend. Ce qui est remplacé doit être encore ce que le plan a vu (`stat`), et une fiche qui n'est
 *   pas modifiable (version plus récente de l'application) n'est jamais écrasée.
 * - Un retrait commence par la fiche. Avant d'effacer, le fichier doit être celui du plan (taille, date) ; avant de
 *   retirer quoi que ce soit du téléphone, son listage est relu, et sa copie est rangée dans la corbeille de
 *   l'ordinateur sauf si celle-ci, relue, tient déjà la même fiche au contenu près.
 * - La ligne de base d'un itinéraire est réécrite une fois ses opérations faites, d'après les tampons relus, et
 *   seulement si les fichiers sont encore ceux que la synchronisation a lus ou écrits.
 * - Un itinéraire dont l'état a changé depuis le listage est laissé ; une erreur sur l'ordinateur arrête cet
 *   itinéraire ; une erreur du dossier distant arrête tout (l'appelant la reconnaît, `isLinkError`).
 */

/** Une opération à laquelle l'exécutant renonce : l'état du moment n'est pas celui du plan. */
class StaleRouteError extends Error {}

/** Identité d'un itinéraire que tient la corbeille (`syncRouteId`). */
export const trashedRouteId = (entry: TrashEntry): string =>
  syncRouteId(entry.createdAt, entry.routeBase ?? entry.main.replace(/\.json$/i, ''));

const routeEntriesOf = (entries: readonly TrashEntry[]): TrashEntry[] => entries.filter((e) => e.kind === 'itineraire');

/** Identités des itinéraires que tient la corbeille, toutes origines comprises. */
export const trashedRouteIds = (entries: readonly TrashEntry[]): Set<string> => new Set(routeEntriesOf(entries).map(trashedRouteId));

/**
 * Ce que le plan des itinéraires demande de lire : les listages des deux côtés, les fiches que la base ne suffit pas à
 * connaître, et la fiche de chaque itinéraire de la corbeille de l'ordinateur (pour comparer leur contenu).
 */
export const readRouteSyncInput = async (
  folders: Record<SyncSideName, MemoryFolder>, base: SyncBase | null,
): Promise<Omit<RouteSyncInput, 'heldOnPhone'>> => {
  const trash: SyncTrashedRoute[] = [];
  for (const entry of routeEntriesOf((await readTrashIndex(folders.computer)).entries)) {
    trash.push({ id: trashedRouteId(entry), text: await folders.computer.readText(trashFilePath(entry.dir, entry.main)) });
  }
  const alsoRead = new Set(trash.map((e) => e.id));
  const sideOf = async (side: SyncSideName) => {
    const listing = syncRouteListing(await folders[side].list(ROUTES_DIR));
    const texts = new Map<string, string | null>();
    for (const name of routeRecordsToRead(listing, base, side, alsoRead)) texts.set(name, await folders[side].readText(routePath(name)));
    return syncRouteSide(listing, texts);
  };
  return { base, computer: await sideOf('computer'), phone: await sideOf('phone'), trash };
};

/** Fichiers d'itinéraires que touche une opération, pour l'avancement. */
const filesOfOp = (op: RouteSyncOp): number => {
  const files = op.kind === 'copy' ? op.source : op.files;
  return 1 + (files.gpx ? 1 : 0);
};

/** Fichiers d'itinéraires que touche un plan, pour l'avancement. */
export const routePlanFiles = (plan: RouteSyncPlan): number =>
  plan.items.reduce((sum, item) => sum + item.ops.reduce((n, op) => n + filesOfOp(op), 0), 0);

/** Vrai si l'opération écrit ou retire quelque chose sur le téléphone. */
export const routeOpWritesPhone = (op: RouteSyncOp): boolean =>
  op.kind === 'removeFromPhone' || (op.kind === 'copy' && op.to === 'phone');

/** Une suppression d'itinéraire : son identité, et le côté d'où il part (`computer` : mis à la corbeille). */
export interface SyncRouteDeletionKey {
  id: string;
  side: SyncSideName;
}

/** Les suppressions que font ces itinéraires, une par itinéraire, du côté où elle s'applique (même règle que les sessions). */
export const routeDeletionKeysOf = (items: readonly RouteSyncItem[]): SyncRouteDeletionKey[] =>
  items.filter((item) => item.ops.some((op) => op.kind === 'trash' || op.kind === 'removeFromPhone'))
    .map((item) => ({ id: item.id, side: item.case === 'deletedOnPhone' ? 'computer' : 'phone' }));

/** Nombre de suppressions d'un itinéraire, pour retrouver celles qu'une restriction a retenues. */
export const routeRemovalsOf = (item: RouteSyncItem | undefined): number =>
  item?.ops.filter((op) => op.kind === 'trash' || op.kind === 'removeFromPhone').length ?? 0;

export interface RouteRunContext {
  folders: Record<SyncSideName, MemoryFolder>;
  /** Vrai pour une erreur du dossier distant, qui arrête toute la synchronisation : relancée telle quelle. */
  isLinkError: (err: unknown) => boolean;
  /** Horloge de l'ordinateur (corbeille). */
  now: () => number;
  /** La base du moment. */
  base: () => SyncBase;
  /** Retient la base changée, et l'écrit si la synchronisation écrit sa base. */
  setBase: (base: SyncBase) => Promise<void>;
  /** Appelée avant chaque écriture ou retrait sur le téléphone. */
  onPhoneChange: () => void;
  /** Appelée après chaque opération, avec le nombre de fichiers qu'elle a traités. */
  onFiles: (files: number) => void;
}

/** Même fichier : même taille, et même date quand les deux en ont une. */
const sameFileStat = (a: FileStat, b: FileStat): boolean => a.size === b.size && (a.mtimeMs === 0 || b.mtimeMs === 0 || a.mtimeMs === b.mtimeMs);

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.byteLength === b.byteLength && a.every((byte, k) => byte === b[k]);

/**
 * Fait le plan des itinéraires (déjà réduit à ce qui est permis), itinéraire par itinéraire, et range le sort de
 * chacun dans `outcome`. `input` : ce qui a servi au plan, dont les tampons sont ceux qu'on attend des fichiers.
 * Lève seulement sur une erreur du dossier distant.
 */
export const executeRoutePlan = async (
  plan: RouteSyncPlan, input: Omit<RouteSyncInput, 'heldOnPhone'>, ctx: RouteRunContext, outcome: SyncRoutesOutcome,
): Promise<void> => {
  const { folders } = ctx;
  /** Tampon attendu de chaque fichier de `itineraires/` : celui du listage, puis celui de nos propres écritures. */
  const expected: Record<SyncSideName, Map<string, FileStat>> = { computer: new Map(), phone: new Map() };
  for (const side of SYNC_SIDES) {
    const stamps = [...input[side].routes.flatMap((r) => [r.json, r.gpx]), ...input[side].orphans];
    for (const stamp of stamps) if (stamp) expected[side].set(stamp.name, { size: stamp.size, mtimeMs: stamp.mtimeMs });
  }

  const statOf = (side: SyncSideName, name: string): Promise<FileStat | null> => folders[side].stat(routePath(name));
  /** Renonce si le fichier n'est plus celui du plan. */
  const expect = async (side: SyncSideName, file: SyncStamp | null): Promise<void> => {
    if (!file) return;
    const at = await statOf(side, file.name);
    if (!at || !sameFileStat(at, file)) throw new StaleRouteError(file.name);
  };
  /** Renonce si ce qui est sous ce nom n'est pas ce que le plan remplace (`null` : rien ne doit y être). */
  const expectReplaced = async (side: SyncSideName, name: string, replaced: SyncStamp | null): Promise<void> => {
    const at = await statOf(side, name);
    if (replaced === null ? at !== null : !at || !sameFileStat(at, replaced)) throw new StaleRouteError(name);
  };
  const bytesOf = async (side: SyncSideName, name: string): Promise<Uint8Array> => {
    const bytes = await folders[side].readBytes(routePath(name));
    if (!bytes) throw new StaleRouteError(name);
    return bytes;
  };
  const write = async (side: SyncSideName, name: string, bytes: Uint8Array): Promise<void> => {
    if (side === 'phone') ctx.onPhoneChange();
    await folders[side].writeBytes(routePath(name), bytes);
    const at = await statOf(side, name);
    if (at) expected[side].set(name, at);
    else expected[side].delete(name);
  };
  /** Efface un fichier, s'il est encore celui du plan. */
  const remove = async (side: SyncSideName, file: SyncStamp): Promise<void> => {
    await expect(side, file);
    if (side === 'phone') ctx.onPhoneChange();
    await folders[side].remove(routePath(file.name));
    expected[side].delete(file.name);
  };

  /** Fiche et GPX d'un côté, lus pour être rangés : la fiche doit être celle du plan, le GPX est pris tel qu'il est. */
  const readFiles = async (side: SyncSideName, files: SyncRouteListed): Promise<{ name: string; bytes: Uint8Array }[]> => {
    await expect(side, files.json);
    const read = [{ name: files.json.name, bytes: await bytesOf(side, files.json.name) }];
    const gpx = files.gpx ? await folders[side].readBytes(routePath(files.gpx.name)) : null;
    if (files.gpx && gpx) read.push({ name: files.gpx.name, bytes: gpx });
    return read;
  };

  /** Range une copie d'un itinéraire dans la corbeille de l'ordinateur, sous les noms qu'il porte de ce côté. */
  const stash = async (item: RouteSyncItem, origin: TrashOrigin, files: SyncRouteListed, read: { name: string; bytes: Uint8Array }[]): Promise<void> => {
    const record = parseRouteRecord(new TextDecoder().decode(read[0].bytes));
    await stashFilesInTrash(folders.computer, {
      kind: 'itineraire', routeBase: files.base, createdAt: item.createdAt, origin, main: files.json.name,
      name: record ? routeDisplayName(record) : files.base, files: read,
    }, ctx.now());
  };

  /** Vrai si la corbeille, relue maintenant, tient une fiche de cet itinéraire identique, octet pour octet. */
  const trashHolds = async (id: string, json: Uint8Array): Promise<boolean> => {
    for (const entry of routeEntriesOf((await readTrashIndex(folders.computer)).entries)) {
      if (trashedRouteId(entry) !== id) continue;
      const theirs = await folders.computer.readBytes(trashFilePath(entry.dir, entry.main));
      if (theirs && sameBytes(theirs, json)) return true;
    }
    return false;
  };

  const execute = async (op: RouteSyncOp, item: RouteSyncItem): Promise<void> => {
    switch (op.kind) {
      case 'copy': {
        const from = otherSyncSide(op.to);
        await expect(from, op.source.json);
        await expect(from, op.source.gpx);
        const json = await bytesOf(from, op.source.json.name);
        const gpx = op.source.gpx ? await bytesOf(from, op.source.gpx.name) : null;
        const target = { json: `${op.base}.json`, gpx: `${op.base}.gpx` };
        // Relu juste avant d'écrire : le câble ne voit un fichier que par son dernier listage.
        await folders[op.to].list(ROUTES_DIR);
        await expectReplaced(op.to, target.json, op.replaces.json);
        if (op.replaces.json) {
          const text = await folders[op.to].readText(routePath(target.json));
          const record = text === null ? null : parseRouteRecord(text);
          if (!record || !isWritableRouteRecord(record)) throw new StaleRouteError(target.json);
        }
        if (gpx) {
          await expectReplaced(op.to, target.gpx, op.replaces.gpx);
          await write(op.to, target.gpx, gpx);
        }
        await write(op.to, target.json, json);
        return;
      }
      case 'trash': {
        await folders.phone.list(ROUTES_DIR);
        if (op.absent !== null && (await statOf('phone', op.absent))) throw new StaleRouteError(op.absent);
        const read = await readFiles('computer', op.files);
        await stash(item, 'ordinateur', op.files, read);
        await remove('computer', op.files.json);
        const gpx = read[1];
        if (op.files.gpx && gpx) await remove('computer', { ...op.files.gpx, size: gpx.bytes.byteLength, mtimeMs: 0 });
        return;
      }
      case 'removeFromPhone': {
        if (op.absent !== null && (await statOf('computer', op.absent))) throw new StaleRouteError(op.absent);
        // Le listage du téléphone est relu : rien n'en part qui ne soit encore, à l'identique, ce que le plan a vu.
        await folders.phone.list(ROUTES_DIR);
        await expect('phone', op.files.json);
        await expect('phone', op.files.gpx);
        const read = await readFiles('phone', op.files);
        // La corbeille relue doit tenir encore la même fiche ; sinon la copie du téléphone y entre d'abord.
        if (op.keep || !(await trashHolds(item.id, read[0].bytes))) await stash(item, 'telephone', op.files, read);
        await remove('phone', op.files.json);
        if (op.files.gpx) await remove('phone', op.files.gpx);
        return;
      }
      case 'loserToTrash': {
        await expect(op.side, op.files.gpx);
        await stash(item, op.side === 'computer' ? 'ordinateur' : 'telephone', op.files, await readFiles(op.side, op.files));
      }
    }
  };

  /** Tampon relu d'un fichier, pour la base : il doit être celui que la synchronisation a lu ou écrit. */
  const stampFor = async (side: SyncSideName, name: string): Promise<SyncStamp | null> => {
    const at = await statOf(side, name);
    if (!at) return null;
    const wanted = expected[side].get(name);
    if (!wanted || !sameFileStat(at, wanted)) throw new StaleRouteError(name);
    return { name, size: at.size, mtimeMs: at.mtimeMs };
  };

  for (const item of plan.items) {
    try {
      for (const op of item.ops) {
        await execute(op, item);
        ctx.onFiles(filesOfOp(op));
      }
      const step = item.base;
      if (step.kind === 'set') {
        const stamps = async (side: SyncSideName) => ({
          json: await stampFor(side, `${step[side].base}.json`), gpx: await stampFor(side, `${step[side].base}.gpx`),
        });
        const line = syncRouteLineOf(item.id, step, { computer: await stamps('computer'), phone: await stamps('phone') });
        if (line) await ctx.setBase(withRouteLine(ctx.base(), line));
      } else if (step.kind === 'forget') {
        await ctx.setBase(withoutRouteLine(ctx.base(), item.id));
      } else if (step.kind === 'hold') {
        await ctx.setBase(withRouteHeld(ctx.base(), item.id));
      }
      outcome.done.push(item);
    } catch (err) {
      if (ctx.isLinkError(err)) throw err;
      if (err instanceof StaleRouteError) outcome.skipped.push(item);
      else outcome.failed.push({ item, detail: errorMessage(err, String(err)) });
    }
  }
};
