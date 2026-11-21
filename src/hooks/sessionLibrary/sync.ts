import { MARKER_FILE } from '../../core/appIdentity';
import { errorMessage, newId, stringifyJson } from '../../core/basics';
import { LEARNED_PLACES_FILE, RESTING_HR_FILE, SESSIONS_DIR, SETTINGS_DIR, sessionPath, settingsPath } from '../../library/folderLayout';
import { isCompleteGpxText } from '../../library/pendingTemps';
import type { SessionRecord } from '../../library/record';
import {
  SYNC_DIR, SYNC_SIDES, emptySyncBase, markerTextWithId, markerTextWithSync, otherSyncSide, parseSyncBase, readMarkerId, serializeSyncBase,
  syncAncestorPath, syncBaseLine, syncBasePath, syncRefusal, withSyncDone, withSyncHeld, withSyncLine, withoutSyncLine,
  type SyncBase, type SyncFiles, type SyncSideName, type SyncStamp,
} from '../../library/syncBase';
import { emptySyncOutcome, type SyncOutcome, type SyncUnknownActivity } from '../../library/syncOutcome';
import {
  planSync, restrictSyncPlan, syncListing, syncPair, syncRecordsToRead, syncSide,
  type SyncAncestors, type SyncFirstReason, type SyncHeldChoice, type SyncItem, type SyncListing, type SyncOp, type SyncPlan,
  type SyncTargetNames, type SyncTrashed,
} from '../../library/syncPlan';
import { planSyncExtras, unknownSyncActivity, type SyncNamedText } from '../../library/syncExtras';
import { inspectSyncRecord, mergeSyncRecords } from '../../library/syncRecordMerge';
import { deletesToTrash, isWritableTrash, sessionTrashEntries, trashFilePath, type TrashEntry, type TrashOrigin } from '../../library/trash';
import { addFilesToTrashEntry, readTrashIndex, rewriteTrashText, stashFilesInTrash } from '../../library/trashFolder';
import { sessionDisplayName } from '../../library/sessionName';
import type { FileStat, MemoryFolder } from '../../platform/memoryFolder';
import { readStoredActivities } from '../useSportSettings';
import { deviceId, flushWrites } from './deviceSettings';
import { canImportSessions } from './importer';
import { refreshLibrary } from './lifecycle';
import { lib } from './memory';
import { libraryState, setState } from './store';
import { holdTrashDuring, recordShownName, reloadTrash, trashFolderOf } from './trash';

/**
 * Exécutant de la synchronisation des sessions entre le dossier mémoire de l'ordinateur et un dossier distant (le
 * téléphone) : il lit ce que le plan demande (`library/syncPlan.ts`), fait ses opérations une à une, et tient la base
 * (`library/syncBase.ts`). Seules les opérations du plan s'exécutent, jamais une boucle sur un listage.
 *
 * - Une copie s'écrit capteurs, fiche, puis GPX en dernier : une coupure laisse une fiche ou des capteurs sans GPX,
 *   que l'application ignore, jamais un GPX sans fiche qui en recevrait une neuve.
 * - Un retrait commence par le GPX. Avant de retirer quoi que ce soit du téléphone, son listage est relu et chaque
 *   fichier doit être celui du plan (taille, date) ; sinon la session est laissée pour la fois suivante.
 * - Ce qui quitte l'ordinateur passe par sa corbeille ; ce qu'il faut sauver du téléphone avant de l'en retirer y
 *   entre aussi, dans une entrée à part, d'origine « telephone ».
 * - La ligne de base d'une session n'est réécrite qu'une fois toutes ses opérations faites, et seulement si ses
 *   fichiers sont encore ceux que la synchronisation a lus ou écrits : la reprise ne refait rien en double et ne
 *   prend rien pour supprimé à tort. `synchro/en-cours.json`, posé au départ et retiré à la fin, dit qu'une
 *   synchronisation a été coupée.
 * - Une session dont l'état a changé depuis le listage est laissée ; une erreur sur l'ordinateur arrête cette session ;
 *   une erreur du dossier distant (câble débranché) arrête tout.
 * - Après les sessions, les fichiers de réglages, les tests de FC repos et les lieux appris suivent leur propre plan
 *   (`library/syncExtras.ts`) : recopiés ou fondus, jamais supprimés, jamais adoptés.
 * - À la fin, si un fichier du téléphone a été écrit ou retiré, l'instant de la synchronisation est posé dans son
 *   marqueur : l'application du téléphone le relit au retour au premier plan et relit alors sa mémoire.
 */

/** Témoin d'une synchronisation en cours : présent au départ suivant, la précédente a été coupée. */
export const SYNC_RUNNING_PATH = `${SYNC_DIR}/en-cours.json`;

export type { SyncExtrasOutcome, SyncFailure, SyncOutcome, SyncStop, SyncUnknownActivity } from '../../library/syncOutcome';

export interface SyncOptions {
  /** Faux : le dossier distant se lit sans s'écrire, seule la moitié de l'ordinateur est faite. Par défaut : s'il n'est pas en lecture seule. */
  phoneWritable?: boolean;
  /** « Synchroniser sans rien supprimer ». */
  withoutDeletions?: boolean;
  /** L'utilisateur a confirmé les suppressions que le garde-fou retenait. */
  confirmDeletions?: boolean;
  /**
   * Les suppressions que la confirmation a montrées (session et côté d'où elle part). Donnée, la confirmation ne vaut
   * que si le plan du moment n'en fait pas d'autre : sinon rien n'est supprimé, et le garde-fou repose sa question.
   */
  confirmedDeletions?: readonly SyncDeletionKey[];
  /** Où est le dossier sur le téléphone ; un autre chemin que celui de la base en fait une paire neuve. */
  phonePath?: string | null;
  heldOnPhone?: SyncHeldChoice;
  /**
   * Avec `heldOnPhone: 'remove'`, les sessions de la corbeille encore sur le téléphone que l'utilisateur a vues et
   * accepté de retirer (`startMs`). Donnée, si une autre attend d'être retirée, aucune ne l'est : elles restent
   * laissées, et la question revient avec la liste du moment.
   */
  heldToRemove?: readonly number[];
  /** Horloge de l'ordinateur (corbeille, base). */
  now?: () => number;
  /** Identifiant neuf d'un dossier, écrit dans son marqueur. */
  newFolderId?: () => string;
  /** Nom montré dans la corbeille d'une session qui y entre. */
  shownName?: (record: SessionRecord | null, gpx: string) => string;
  /**
   * Fichiers de sessions traités sur leur total (« 12 fichiers sur 50 ») : chaque fichier copié, réécrit, mis à la
   * corbeille ou retiré compte une fois ; une session laissée en route compte comme faite.
   */
  onProgress?: (done: number, total: number) => void;
  /**
   * Appelée à la première rencontre d'un téléphone qu'on peut écrire, avant la moindre écriture (témoin, marqueurs) :
   * la copie de sécurité des deux dossiers. Rend où la copie est rangée. Si elle lève, rien n'est fait : refus
   * `safetyCopy`, sa raison dans `error`.
   */
  beforeWrites?: (first: SyncFirstReason) => Promise<string | null>;
  /**
   * Appelée une fois le plan fait et réduit à ce qui est permis, avant la première opération : de quoi dire « Première
   * synchronisation… » avant toute copie.
   */
  onPlanned?: (plan: SyncPlan, first: SyncFirstReason | null) => void;
  /**
   * Identifiant de l'ordinateur, celui de son fichier de réglages : ce fichier fait foi, il n'est jamais remplacé sur
   * l'ordinateur par une copie venue du téléphone. Absent : seule la règle des dates protège les fichiers propres.
   */
  computerDeviceId?: string | null;
  /** Identifiants des activités de chaque appareil ; un côté absent n'est pas vérifié. */
  knownActivities?: Partial<Record<SyncSideName, readonly string[]>>;
}

const emptyOutcome = emptySyncOutcome;

/** Fichiers de sessions que touche une opération, pour l'avancement. */
const filesOfOp = (op: SyncOp): number => {
  switch (op.kind) {
    case 'copy':
      return 1 + (op.source.record && op.target.record ? 1 : 0) + (op.source.imu && op.target.imu ? 1 : 0);
    case 'trash':
    case 'removeFromPhone':
      return op.files.length;
    default:
      return 1;
  }
};

/** Opérations d'une session qui écrivent ou retirent quelque chose sur le téléphone. */
const phoneOpsOf = (item: SyncItem | undefined): number =>
  item?.ops.filter((op) => op.kind === 'removeFromPhone' || ('to' in op && op.to === 'phone') || ('on' in op && op.on === 'phone')).length ?? 0;

/** Dossier de la copie de sécurité que garde le témoin d'une synchronisation coupée, s'il couvre ce téléphone. */
const witnessSafetyCopy = (text: string | null, phone: string): string | null => {
  try {
    const witness: unknown = text === null ? null : JSON.parse(text);
    if (typeof witness !== 'object' || witness === null) return null;
    const { safetyCopy, phone: covered } = witness as { safetyCopy?: unknown; phone?: unknown };
    return typeof safetyCopy === 'string' && covered === phone ? safetyCopy : null;
  } catch {
    return null;
  }
};

/** Une suppression : la session (`startMs`) et le côté d'où elle part (`computer` : mise à la corbeille). */
export interface SyncDeletionKey {
  startMs: number;
  side: SyncSideName;
}

const sameDeletion = (a: SyncDeletionKey, b: SyncDeletionKey): boolean => a.startMs === b.startMs && a.side === b.side;

/**
 * Les suppressions que font ces sessions, une par session, du côté où elle s'applique : la règle de la liste que
 * montre le garde-fou (`describeSyncQuestion`), supprimée sur le téléphone, elle part de l'ordinateur, sinon du
 * téléphone.
 */
const deletionKeysOf = (items: readonly SyncItem[]): SyncDeletionKey[] =>
  items.filter((item) => item.ops.some((op) => op.kind === 'trash' || op.kind === 'removeFromPhone'))
    .map((item) => ({ startMs: item.startMs, side: item.case === 'deletedOnPhone' ? 'computer' : 'phone' }));

/** Une opération à laquelle l'exécutant renonce : l'état du moment n'est pas celui du plan. */
class StaleError extends Error {}

/** Le dossier distant ne répond plus : toute la synchronisation s'arrête. */
class SyncLinkError extends Error {}

/** Le dossier distant, dont chaque erreur devient une perte de liaison. */
const linkedFolder = (folder: MemoryFolder): MemoryFolder => {
  const guard = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (err) {
      throw new SyncLinkError(errorMessage(err, String(err)));
    }
  };
  return {
    kind: folder.kind,
    label: folder.label,
    ...(folder.readOnly ? { readOnly: true as const } : {}),
    list: (dir) => guard(() => folder.list(dir)),
    readText: (path) => guard(() => folder.readText(path)),
    readBytes: (path) => guard(() => folder.readBytes(path)),
    stat: (path) => guard(() => folder.stat(path)),
    writeText: (path, text) => guard(() => folder.writeText(path, text)),
    writeBytes: (path, bytes) => guard(() => folder.writeBytes(path, bytes)),
    remove: (path) => guard(() => folder.remove(path)),
  };
};

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** Même fichier : même taille, et même date quand les deux en ont une. */
const sameFileStat = (a: FileStat, b: FileStat): boolean => a.size === b.size && (a.mtimeMs === 0 || b.mtimeMs === 0 || a.mtimeMs === b.mtimeMs);

/** Nom du GPX d'une session d'après ses fichiers : le sien, ou celui que nomme une fiche ou des capteurs restés seuls. */
const mainOf = (files: readonly SyncStamp[]): string =>
  files.find((f) => /\.gpx$/i.test(f.name))?.name ?? (files[0]?.name ?? '').replace(/\.(json|imu)$/i, '.gpx');

const defaultShownName = (record: SessionRecord | null, gpx: string): string => (record ? sessionDisplayName(record, null, gpx) : gpx);

const parentDir = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/**
 * Fichiers de réglages, tests de FC repos et lieux appris : lus des deux côtés, puis écrits selon leur plan
 * (`planSyncExtras`), chacun seulement s'il est encore tel qu'il a été lu, et jamais vers un côté qu'on ne peut pas
 * écrire. Rien n'est supprimé. Une erreur du téléphone arrête tout (liaison perdue) ; une erreur de l'ordinateur en
 * écrivant laisse ce fichier et passe au suivant. Aucun n'entre dans le garde-fou des suppressions.
 */
const syncExtraFiles = async (
  folders: Record<SyncSideName, MemoryFolder>, scope: Record<SyncSideName, boolean>, computerDeviceId: string | null, outcome: SyncOutcome,
): Promise<void> => {
  const settingsOf = async (folder: MemoryFolder): Promise<SyncNamedText[]> => {
    const files: SyncNamedText[] = [];
    for (const entry of await folder.list(SETTINGS_DIR)) {
      if (entry.kind !== 'file' || !/\.json$/i.test(entry.name)) continue;
      files.push({ name: entry.name, text: await folder.readText(settingsPath(entry.name)) });
    }
    return files;
  };
  const rootOf = async (path: string): Promise<Record<SyncSideName, string | null>> =>
    ({ computer: await folders.computer.readText(path), phone: await folders.phone.readText(path) });
  const plan = planSyncExtras({
    settings: { computer: await settingsOf(folders.computer), phone: await settingsOf(folders.phone) },
    restingHr: await rootOf(RESTING_HR_FILE),
    places: await rootOf(LEARNED_PLACES_FILE),
    computerDeviceId,
  });
  outcome.extras.left.push(...plan.left);
  for (const op of plan.ops) {
    if (!scope[op.to]) {
      outcome.extras.withheld.push(op);
      continue;
    }
    const folder = folders[op.to];
    try {
      // Relu juste avant d'écrire : le câble ne voit un fichier que par son dernier listage.
      await folder.list(parentDir(op.path));
      if ((await folder.readText(op.path)) !== op.replaces) {
        outcome.extras.left.push({ kind: op.kind, path: op.path, side: op.to, reason: 'changed' });
        continue;
      }
      await folder.writeText(op.path, op.text);
      outcome.extras.done.push(op);
    } catch (err) {
      if (err instanceof SyncLinkError) throw err;
      outcome.extras.left.push({ kind: op.kind, path: op.path, side: op.to, reason: 'failed' });
    }
  }
};

/**
 * Synchronise les sessions de `computer` (le dossier mémoire de l'ordinateur, qui doit avoir une corbeille) et de
 * `remote` (le téléphone). N'agit sur aucun état de l'application : `synchronizePhone` y ajoute le verrou et la
 * relecture. Ne lève pas : tout ce qui s'est passé est dans le résultat.
 */
export const executeSync = async (computer: MemoryFolder, remote: MemoryFolder, options: SyncOptions = {}): Promise<SyncOutcome> => {
  const now = options.now ?? Date.now;
  const shownName = options.shownName ?? defaultShownName;
  const phone = linkedFolder(remote);
  const folders: Record<SyncSideName, MemoryFolder> = { computer, phone };
  const scope = { computer: true, phone: options.phoneWritable ?? remote.readOnly !== true, deletions: options.withoutDeletions !== true };
  const outcome = emptyOutcome(null);
  outcome.phoneWritable = scope.phone;
  /** Vrai dès qu'un fichier de sessions du téléphone a été écrit ou retiré. */
  let phoneChanged = false;
  /**
   * Le téléphone qui a changé l'apprend par l'instant posé dans son marqueur (`markerTextWithSync`), relu au retour
   * de l'application au premier plan. Écriture de plus, jamais un échec de la synchronisation : sans elle, le compte
   * rendu dit toujours de toucher « Mettre à jour ».
   */
  const notifyPhone = async (): Promise<void> => {
    if (!phoneChanged && !outcome.extras.done.some((op) => op.to === 'phone')) return;
    try {
      const text = markerTextWithSync(await remote.readText(MARKER_FILE), now());
      if (text !== null) await remote.writeText(MARKER_FILE, text);
    } catch {
      // Téléphone injoignable à cet instant : la ligne du compte rendu suffit.
    }
  };
  try {
    if (!deletesToTrash(computer.kind, computer.readOnly === true)) return emptyOutcome('noTrash');
    const markers = { computer: await computer.readText(MARKER_FILE), phone: await phone.readText(MARKER_FILE) };
    const refusal = syncRefusal(markers.computer, markers.phone);
    if (refusal) return emptyOutcome(refusal);
    // Le plan dépend de la corbeille (ce qu'elle tient déjà, ce qu'elle a retenu) : illisible, rien ne se fait.
    if (!isWritableTrash(await readTrashIndex(computer))) return emptyOutcome('trashLocked');
    const ids = { computer: readMarkerId(markers.computer), phone: readMarkerId(markers.phone) };
    const read = ids.phone ? parseSyncBase(await computer.readText(syncBasePath(ids.phone))) : { state: 'absent' as const };
    if (read.state === 'newer') return emptyOutcome('newerBase');
    const pair = syncPair(ids.computer, ids.phone, options.phonePath ?? null, read.state === 'ok' ? read.base : null);
    outcome.first = pair.first;
    const running = await computer.readText(SYNC_RUNNING_PATH);
    outcome.interrupted = running !== null;
    // La copie de sécurité d'une première rencontre coupée en route n'est pas refaite : le témoin la garde, avec le
    // téléphone qu'elle couvre (son identifiant, ou son marqueur tant qu'il n'en a pas).
    const phoneKey = (): string => ids.phone ?? `marqueur:${markers.phone ?? ''}`;
    const writeWitness = (startedAtMs: number): Promise<void> => computer.writeText(SYNC_RUNNING_PATH,
      `${stringifyJson({ startedAtMs, ...(outcome.safetyCopy ? { safetyCopy: outcome.safetyCopy, phone: phoneKey() } : {}) })}\n`);
    if (pair.first !== null && scope.phone && options.beforeWrites) {
      const earlier = witnessSafetyCopy(running, phoneKey());
      try {
        outcome.safetyCopy = earlier ?? await options.beforeWrites(pair.first);
      } catch (err) {
        return { ...emptyOutcome('safetyCopy'), first: pair.first, interrupted: false, error: errorMessage(err, String(err)) };
      }
    }
    const startedAtMs = now();
    await writeWitness(startedAtMs);
    for (const side of SYNC_SIDES) {
      if (!pair.newId[side] || !scope[side]) continue;
      const id = (options.newFolderId ?? newId)();
      const text = markerTextWithId(markers[side], id);
      if (text === null) continue;
      await folders[side].writeText(MARKER_FILE, text);
      ids[side] = id;
      if (side === 'phone' && outcome.safetyCopy) await writeWitness(startedAtMs);
    }

    const listings: Record<SyncSideName, SyncListing> = {
      computer: syncListing(await computer.list(SESSIONS_DIR)), phone: syncListing(await phone.list(SESSIONS_DIR)),
    };
    /** Tampon attendu de chaque fichier de `sessions/` : celui du listage, puis celui de nos propres écritures. */
    const expected: Record<SyncSideName, Map<string, FileStat>> = { computer: new Map(), phone: new Map() };
    for (const side of SYNC_SIDES) {
      const stamps = [...listings[side].sessions.flatMap((s) => [s.gpx, s.record, s.imu]), ...listings[side].orphans];
      for (const stamp of stamps) if (stamp) expected[side].set(stamp.name, { size: stamp.size, mtimeMs: stamp.mtimeMs });
    }
    const ancestors = new Map<number, SyncAncestors>();
    for (const line of pair.base?.sessions ?? []) {
      ancestors.set(line.startMs, {
        computer: await computer.readText(syncAncestorPath(pair.base?.phoneId as string, line.startMs, 'computer')),
        phone: await computer.readText(syncAncestorPath(pair.base?.phoneId as string, line.startMs, 'phone')),
      });
    }
    const sideOf = async (side: SyncSideName) => {
      const texts = new Map<string, string | null>();
      for (const name of syncRecordsToRead(listings[side], pair.base, side, (startMs, of) => (ancestors.get(startMs)?.[of] ?? null) !== null)) {
        texts.set(name, await folders[side].readText(sessionPath(name)));
      }
      const state = syncSide(listings[side], texts);
      // Un GPX que la base ne connaît pas est lu pour savoir s'il est fini : il faudra de toute façon le recopier.
      const known = new Set(pair.base?.sessions.map((s) => s[side].gpx.name));
      for (const session of state.sessions) {
        if (known.has(session.gpx.name)) continue;
        session.gpxComplete = isCompleteGpxText((await folders[side].readText(sessionPath(session.gpx.name))) ?? '');
      }
      return state;
    };
    const trashNow = async (): Promise<TrashEntry[]> => (await readTrashIndex(computer)).entries;
    const trashedOf = (entries: readonly TrashEntry[]): SyncTrashed[] =>
      entries.flatMap((e) => (e.kind !== 'itineraire' && e.startMs !== null ? [{ startMs: e.startMs, files: e.files }] : []));
    const input = { pair, computer: await sideOf('computer'), phone: await sideOf('phone'), ancestors, trash: trashedOf(await trashNow()) };
    let plan = planSync({ ...input, heldOnPhone: options.heldOnPhone });
    if (options.heldOnPhone === 'remove' && options.heldToRemove) {
      // Retirer seulement les sessions montrées : une autre apparue depuis la question les fait toutes laisser.
      const shown = new Set(options.heldToRemove);
      const heldNow = planSync({ ...input, heldOnPhone: 'leave' });
      if (heldNow.items.some((item) => item.left === 'inTrash' && !shown.has(item.startMs))) plan = heldNow;
    }
    const full = plan;
    // Le garde-fou ne compte que les suppressions que cette passe peut faire : un téléphone qu'on ne peut pas écrire
    // ne perd rien, et ses retraits ne retiennent pas les mises à la corbeille de l'ordinateur.
    const possible = restrictSyncPlan(full, { ...scope, deletions: true });
    const confirmed = options.confirmDeletions === true
      && (!options.confirmedDeletions || deletionKeysOf(possible.items).every((key) => options.confirmedDeletions?.some((c) => sameDeletion(c, key))));
    const unconfirmedShown = options.confirmDeletions === true && !confirmed;
    outcome.deletions = !scope.deletions ? 'excluded' : (possible.guard.tripped || unconfirmedShown) && !confirmed ? 'awaitingConfirmation' : 'made';
    plan = restrictSyncPlan(full, { ...scope, deletions: outcome.deletions === 'made' });
    outcome.plan = plan;
    const deletionsOf = (item: SyncItem | undefined): number => item?.ops.filter((op) => op.kind === 'trash' || op.kind === 'removeFromPhone').length ?? 0;
    outcome.withheldDeletions = possible.items.filter((item) => deletionsOf(item) > deletionsOf(plan.items.find((i) => i.startMs === item.startMs)));
    if (!scope.phone) outcome.withheldForPhone = full.items.filter((item) => phoneOpsOf(item) > 0);
    options.onPlanned?.(plan, pair.first);

    let base: SyncBase = pair.base ?? emptySyncBase(ids.computer ?? '', ids.phone ?? '', options.phonePath ?? null);
    const saveBase = async (): Promise<void> => {
      if (plan.saveBase) await computer.writeText(syncBasePath(base.phoneId), serializeSyncBase(base));
    };

    /** Renonce si le fichier n'est plus celui du plan. */
    const expect = async (side: SyncSideName, file: SyncStamp | null): Promise<void> => {
      if (!file) return;
      const at = await folders[side].stat(sessionPath(file.name));
      if (!at || !sameFileStat(at, file)) throw new StaleError(file.name);
    };
    const bytesOf = async (side: SyncSideName, name: string): Promise<Uint8Array> => {
      const bytes = await folders[side].readBytes(sessionPath(name));
      if (!bytes) throw new StaleError(name);
      return bytes;
    };
    const write = async (side: SyncSideName, name: string, bytes: Uint8Array): Promise<void> => {
      if (side === 'phone') phoneChanged = true;
      await folders[side].writeBytes(sessionPath(name), bytes);
      const at = await folders[side].stat(sessionPath(name));
      if (at) expected[side].set(name, at);
      else expected[side].delete(name);
    };
    /** Écrit un fichier qui ne doit pas exister, sinon seulement sous la forme d'un reste de même taille d'une copie coupée. */
    const writeNew = async (side: SyncSideName, name: string, bytes: Uint8Array): Promise<void> => {
      const at = await folders[side].stat(sessionPath(name));
      if (at && at.size !== bytes.byteLength) throw new StaleError(name);
      await write(side, name, bytes);
    };
    const remove = async (side: SyncSideName, name: string): Promise<void> => {
      if (side === 'phone') phoneChanged = true;
      await folders[side].remove(sessionPath(name));
      expected[side].delete(name);
    };
    /** Fichiers d'un côté à poser dans la base : présents, et tels que la synchronisation les a lus ou écrits. */
    const filesOf = async (side: SyncSideName, names: SyncTargetNames): Promise<SyncFiles> => {
      const stamp = async (name: string | null): Promise<SyncStamp | null> => {
        if (name === null) return null;
        const at = await folders[side].stat(sessionPath(name));
        const wanted = expected[side].get(name);
        if (!at || !wanted || !sameFileStat(at, wanted)) throw new StaleError(name);
        return { name, size: at.size, mtimeMs: at.mtimeMs };
      };
      const gpx = await stamp(names.gpx);
      return { gpx: gpx as SyncStamp, record: await stamp(names.record), imu: await stamp(names.imu) };
    };

    /**
     * Range des fichiers d'une session à la corbeille. Avec leur GPX : une entrée de session. Sans lui (fiche ou
     * capteurs restés seuls) : avec une entrée de la même session qui peut les recevoir sans rien écraser, de la même
     * origine et du même GPX d'abord ; sinon dans une entrée de restes, que la corbeille ne montre ni ne restaure.
     */
    const stash = async (startMs: number, origin: TrashOrigin, stamps: readonly SyncStamp[], files: { name: string; bytes: Uint8Array }[]): Promise<void> => {
      const main = mainOf(stamps);
      const recordBytes = files.find((f) => /\.json$/i.test(f.name))?.bytes;
      const name = shownName(recordBytes ? inspectSyncRecord(decode(recordBytes)).record : null, main);
      if (files.some((f) => /\.gpx$/i.test(f.name))) {
        await stashFilesInTrash(computer, { startMs, name, origin, main, files }, now());
        return;
      }
      const rank = (e: TrashEntry): number => (e.origin === origin ? 0 : 2) + (e.main.toLowerCase() === main.toLowerCase() ? 0 : 1);
      const hosts = sessionTrashEntries(await trashNow(), startMs).sort((a, b) => rank(a) - rank(b));
      for (const host of hosts) if (await addFilesToTrashEntry(computer, host.dir, files)) return;
      await stashFilesInTrash(computer, { startMs, name, origin, main, files, kind: 'restes' }, now());
    };

    /** Range à la corbeille, à part, les fichiers du téléphone d'une session avant leur retrait. */
    const keepFromPhone = async (startMs: number, files: readonly SyncStamp[]): Promise<void> => {
      const read = [];
      for (const file of files) read.push({ name: file.name, bytes: await bytesOf('phone', file.name) });
      await stash(startMs, 'telephone', files, read);
      if (!outcome.keptFromPhone.includes(startMs)) outcome.keptFromPhone.push(startMs);
    };

    /**
     * Vrai si la corbeille, relue sur le disque au moment du retrait, tient encore ce que le plan a compté : un GPX et
     * des capteurs de la même taille que ceux du téléphone, et une fiche : présente (`present`), de la même taille aussi
     * (`same`), ou sans exigence (`any`). Elle a pu être vidée depuis.
     */
    const trashStillHolds = async (startMs: number, files: readonly SyncStamp[], record: 'any' | 'present' | 'same'): Promise<boolean> => {
      const held: { name: string; size: number }[] = [];
      for (const entry of (await trashNow()).filter((e) => e.startMs === startMs && e.kind !== 'itineraire')) {
        for (const f of entry.files) {
          if ((await computer.stat(trashFilePath(entry.dir, f.name)))?.size === f.size) held.push(f);
        }
      }
      for (const file of files) {
        const ext = /\.[^.]+$/.exec(file.name)?.[0].toLowerCase() ?? '';
        const same = (f: { name: string }): boolean => f.name.toLowerCase().endsWith(ext);
        const ok = ext === '.json' && record !== 'same'
          ? record === 'any' || held.some(same)
          : held.some((f) => same(f) && f.size === file.size);
        if (!ok) return false;
      }
      return true;
    };

    /**
     * Fiche du téléphone, changée depuis la base, fondue dans celle que la corbeille garde de l'ordinateur. Si elle ne
     * se fond pas sans perte (fiche de la corbeille absente ou illisible, champ changé des deux côtés), la copie du
     * téléphone est rangée entière, à part.
     */
    const keepPhoneRecord = async (item: SyncItem, op: Extract<SyncOp, { kind: 'removeFromPhone' }>): Promise<void> => {
      const line = syncBaseLine(base, item.startMs);
      const candidates = sessionTrashEntries(await trashNow(), item.startMs)
        .filter((e) => e.origin === 'ordinateur')
        .map((entry) => ({ entry, json: entry.files.find((f) => /\.json$/i.test(f.name)) }))
        .filter((c): c is { entry: TrashEntry; json: { name: string; size: number } } => c.json !== undefined)
        .sort((a, b) => b.entry.deletedAtMs - a.entry.deletedAtMs);
      const target = candidates.find((c) => c.entry.main.toLowerCase() === line?.computer.gpx.name.toLowerCase()) ?? candidates[0];
      const trashText = target ? await computer.readText(trashFilePath(target.entry.dir, target.json.name)) : null;
      const kept = ancestors.get(item.startMs) ?? { computer: null, phone: null };
      const merged = trashText === null || op.recordText === null ? null
        : mergeSyncRecords({ computer: trashText, phone: op.recordText, computerAncestor: kept.computer, phoneAncestor: kept.phone });
      if (!target || !merged || merged.conflicts.length > 0) {
        await keepFromPhone(item.startMs, op.files);
        return;
      }
      if (merged.computer !== null) await rewriteTrashText(computer, target.entry.dir, target.json.name, merged.computer);
    };

    /** Activités inconnues des fiches écrites pour la session en cours, retenues si toute la session est faite. */
    let receivedActivities: SyncUnknownActivity[] = [];
    const noteActivity = (side: SyncSideName, startMs: number, recordText: string): void => {
      const known = options.knownActivities?.[side];
      const activityId = known ? unknownSyncActivity(recordText, known) : null;
      if (activityId !== null) receivedActivities.push({ side, startMs, activityId });
    };

    const execute = async (op: SyncOp, item: SyncItem): Promise<void> => {
      switch (op.kind) {
        case 'copy': {
          const from = otherSyncSide(op.to);
          for (const file of [op.source.gpx, op.source.record, op.source.imu]) await expect(from, file);
          const gpx = await bytesOf(from, op.source.gpx.name);
          if (!isCompleteGpxText(decode(gpx))) throw new StaleError(op.source.gpx.name);
          if (await folders[op.to].stat(sessionPath(op.target.gpx))) throw new StaleError(op.target.gpx);
          if (op.source.imu && op.target.imu) await writeNew(op.to, op.target.imu, await bytesOf(from, op.source.imu.name));
          if (op.source.record && op.target.record) {
            const record = op.recordText === null ? await bytesOf(from, op.source.record.name) : encode(op.recordText);
            await writeNew(op.to, op.target.record, record);
            noteActivity(op.to, item.startMs, decode(record));
          }
          await writeNew(op.to, op.target.gpx, gpx);
          return;
        }
        case 'writeRecord':
          await expect(op.on, op.file);
          await write(op.on, op.file.name, encode(op.text));
          noteActivity(op.on, item.startMs, op.text);
          return;
        case 'copyRecord': {
          const from = otherSyncSide(op.to);
          await expect(from, op.source);
          await expect(op.to, op.file);
          const record = await bytesOf(from, op.source.name);
          await write(op.to, op.file.name, record);
          noteActivity(op.to, item.startMs, decode(record));
          return;
        }
        case 'copyImu': {
          const from = otherSyncSide(op.to);
          await expect(from, op.source);
          await writeNew(op.to, op.target, await bytesOf(from, op.source.name));
          return;
        }
        case 'trash': {
          if (op.absent !== null && (await phone.stat(sessionPath(op.absent)))) throw new StaleError(op.absent);
          const files = [];
          for (const file of op.files) {
            const bytes = await computer.readBytes(sessionPath(file.name));
            // Le GPX doit être celui du plan ; une fiche saisie depuis est gardée telle qu'elle est maintenant.
            if (/\.gpx$/i.test(file.name) && (!bytes || bytes.byteLength !== file.size)) throw new StaleError(file.name);
            if (bytes) files.push({ name: file.name, bytes });
          }
          if (files.length === 0) return;
          await stash(item.startMs, 'ordinateur', op.files, files);
          for (const file of files) await remove('computer', file.name);
          return;
        }
        case 'removeFromPhone': {
          if (op.absent !== null && (await computer.stat(sessionPath(op.absent)))) throw new StaleError(op.absent);
          // Le listage du téléphone est relu : rien n'en part qui ne soit encore, à l'identique, ce que le plan a vu.
          await phone.list(SESSIONS_DIR);
          for (const file of op.files) await expect('phone', file);
          // Le plan a compté sur la corbeille telle qu'il l'a lue : relue maintenant, elle doit tenir encore la copie.
          // Tout garder : rien à ranger si la corbeille tient déjà ces mêmes fichiers (une session supprimée sur
          // l'ordinateur avant toute synchronisation), sinon la copie du téléphone y entre à part.
          const held = await trashStillHolds(item.startMs, op.files, op.keep === 'all' ? 'same' : op.keep === 'none' ? 'present' : 'any');
          if (!held) await keepFromPhone(item.startMs, op.files);
          else if (op.keep === 'record') await keepPhoneRecord(item, op);
          for (const file of op.files) await remove('phone', file.name);
        }
      }
    };

    const filesOfItem = (item: SyncItem): number => item.ops.reduce((sum, op) => sum + filesOfOp(op), 0);
    const total = plan.items.reduce((sum, item) => sum + filesOfItem(item), 0);
    let before = 0;
    options.onProgress?.(0, total);
    for (const item of plan.items) {
      receivedActivities = [];
      let reached = before;
      before += filesOfItem(item);
      try {
        for (const op of item.ops) {
          await execute(op, item);
          reached += filesOfOp(op);
          options.onProgress?.(reached, total);
        }
        if (item.base.kind === 'forget') {
          base = withoutSyncLine(base, item.startMs);
          await saveBase();
          for (const side of SYNC_SIDES) await computer.remove(syncAncestorPath(base.phoneId, item.startMs, side));
        } else if (item.base.kind === 'hold') {
          base = withSyncHeld(base, item.startMs);
          await saveBase();
        } else if (item.base.kind === 'set' && plan.saveBase) {
          const line = { startMs: item.startMs, computer: await filesOf('computer', item.base.computer), phone: await filesOf('phone', item.base.phone) };
          for (const side of SYNC_SIDES) {
            const text = item.base.ancestors[side];
            if (text !== null) await computer.writeText(syncAncestorPath(base.phoneId, item.startMs, side), text);
          }
          base = withSyncLine(base, line);
          await saveBase();
        }
        outcome.done.push(item);
        for (const note of receivedActivities) {
          if (!outcome.unknownActivities.some((u) => u.side === note.side && u.startMs === note.startMs)) outcome.unknownActivities.push(note);
        }
      } catch (err) {
        if (err instanceof SyncLinkError) throw err;
        if (err instanceof StaleError) outcome.skipped.push(item);
        else outcome.failed.push({ item, detail: errorMessage(err, String(err)) });
        if (before > reached) options.onProgress?.(before, total);
      }
    }
    options.onProgress?.(total, total);
    await syncExtraFiles(folders, scope, options.computerDeviceId ?? null, outcome);
    const extrasStopped = outcome.extras.left.some((l) => l.reason === 'changed' || l.reason === 'failed');
    outcome.complete = scope.phone && outcome.deletions === 'made' && outcome.skipped.length === 0 && outcome.failed.length === 0 && !extrasStopped;
    if (outcome.complete) {
      const trashed = new Set(trashedOf(await trashNow()).map((e) => e.startMs));
      base = withSyncDone(base, now(), trashed);
      await saveBase();
    }
    await notifyPhone();
    await computer.remove(SYNC_RUNNING_PATH);
    return outcome;
  } catch (err) {
    const detail = errorMessage(err, String(err));
    if (err instanceof SyncLinkError) return { ...outcome, linkLost: detail, complete: false };
    // Arrêtée par une erreur de l'ordinateur : ce qui a déjà changé sur le téléphone s'y voit quand même.
    await notifyPhone();
    return { ...outcome, error: detail, complete: false };
  }
};

export interface SyncLockOptions extends SyncOptions {
  /**
   * Vrai pendant un enregistrement (`isRecordingActive` de l'enregistreur, passé par l'appelant : l'enregistreur
   * dépend de la bibliothèque, pas l'inverse). Absent : aucun enregistrement possible.
   */
  recording?: () => boolean;
}

const settle = (pending: Promise<unknown> | null): Promise<unknown> => pending?.then(() => undefined, () => undefined) ?? Promise.resolve();

/**
 * Synchronise la mémoire ouverte avec le dossier distant `phone` (le téléphone branché) : la mémoire doit être
 * ouverte en écriture sur le dossier du disque du programme Windows (qui a la corbeille). Pendant toute la durée, la
 * mémoire est tenue comme pendant un import (« import en cours » : imports et remises à zéro attendent), et la
 * corbeille aussi (`holdTrashDuring` : restaurer, supprimer définitivement, vider et purger attendent), après que les
 * saisies en attente ont été écrites ; à la fin, la mémoire et la corbeille sont relues. Refusée pendant un import,
 * une autre synchronisation ou un enregistrement (`busy`). Ne lève pas.
 */
export const synchronizePhone = async (phone: MemoryFolder, options: SyncLockOptions = {}): Promise<SyncOutcome> => {
  await lib.opening.catch(() => undefined);
  const memory = libraryState();
  if (!canImportSessions(memory)) return emptyOutcome('memory');
  // Deux imports, ou un import et une synchronisation, rangeraient deux fois la même session.
  if (memory.importing || options.recording?.()) return emptyOutcome('busy');
  setState({ importing: true });
  try {
    return await holdTrashDuring(async () => {
      await flushWrites();
      await settle(lib.scanCompletion);
      await settle(lib.scanPass);
      const folder = trashFolderOf(lib.folder);
      if (!folder) return emptyOutcome('noTrash');
      return executeSync(folder, phone, {
        shownName: (record, gpx) => (record ? recordShownName(record, gpx) : gpx),
        computerDeviceId: deviceId(),
        // Le téléphone n'est pas vérifié : son fichier de réglages ne se distingue pas sûrement des copies des autres.
        knownActivities: { computer: readStoredActivities().map((a) => a.id) },
        ...options,
      });
    });
  } catch (err) {
    return { ...emptyOutcome(null), error: errorMessage(err, String(err)) };
  } finally {
    await refreshLibrary().catch(() => undefined);
    setState({ importing: false });
    await reloadTrash();
  }
};
