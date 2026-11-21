import { FILE_FORMATS } from '../core/appIdentity';
import { isFiniteNumber, isObject, parseJson, stringifyJson } from '../core/basics';
import { MEMORY_FORMAT, MEMORY_VERSION, readMarkerVersion } from './folderLayout';

/**
 * Base de la synchronisation entre l'ordinateur et un téléphone : l'état des deux dossiers à la fin de la dernière
 * synchronisation, gardé par l'ordinateur seul, dans son dossier mémoire. Le téléphone ne garde rien.
 *
 *     synchro/
 *       <id du téléphone>.json                          la base : une ligne par session présente des deux côtés
 *       <id du téléphone>/fiches/<startMs>-ordinateur.json   la fiche de l'ordinateur à cette synchronisation
 *       <id du téléphone>/fiches/<startMs>-telephone.json    celle du téléphone
 *
 * Une ligne n'existe que pour une session rapprochée des deux côtés : c'est ce qui permet de lire une absence comme
 * une suppression. Une session qui n'a pas de ligne n'est jamais supprimée, seulement recopiée ou fondue. Les deux
 * fiches gardées sont les ancêtres de la fusion à trois (`syncRecordMerge.ts`) : une par côté, parce que la fiche
 * d'un appareil porte ce qui lui est propre (son résumé, le nom de son GPX, sa date d'entrée).
 *
 * Les dossiers se reconnaissent à un identifiant tiré au hasard, écrit dans leur marqueur (champ `id`) : l'application
 * ne lit du marqueur que son format, sa version et l'instant de la dernière synchronisation (`synchro`), et ne le
 * réécrit que s'il manque. Un dossier remis à zéro revient donc sans identifiant, et rien ne se déduit de lui. Ce
 * module ne lit ni n'écrit aucun fichier.
 */

export const SYNC_DIR = 'synchro';
export const SYNC_BASE_FORMAT = FILE_FORMATS.synchro;
export const SYNC_BASE_VERSION = 1;

/** Les deux côtés d'une synchronisation. */
export type SyncSideName = 'computer' | 'phone';
export const SYNC_SIDES: readonly SyncSideName[] = ['computer', 'phone'];
export const otherSyncSide = (side: SyncSideName): SyncSideName => (side === 'computer' ? 'phone' : 'computer');

/** Un fichier de `sessions/` vu d'un côté : son nom, sa taille et sa date, comme le listage les donne. */
export interface SyncStamp {
  name: string;
  size: number;
  /** Peut valoir 0 (fournisseur du téléphone qui ne la donne pas) : le fichier est alors toujours relu. */
  mtimeMs: number;
}

/** Les fichiers d'une session d'un côté. */
export interface SyncFiles {
  gpx: SyncStamp;
  record: SyncStamp | null;
  imu: SyncStamp | null;
}

/** Une session présente des deux côtés à la fin de sa dernière synchronisation. */
export interface SyncBaseSession {
  /** Instant du premier point : l'identité de la session, la même que dans la mémoire. */
  startMs: number;
  computer: SyncFiles;
  phone: SyncFiles;
}

export interface SyncBase {
  /** Identifiant du dossier de l'ordinateur à qui cette base appartient : un autre dossier en fait une paire neuve. */
  computerId: string;
  phoneId: string;
  /** Où est le dossier sur le téléphone ; un autre chemin (une vieille copie) en fait une paire neuve. */
  phonePath: string | null;
  /** Fin de la dernière synchronisation menée au bout, horloge de l'ordinateur ; `null` : aucune encore. */
  syncedAtMs: number | null;
  sessions: SyncBaseSession[];
  /**
   * Sessions dont la synchronisation a mené la suppression au bout, encore dans la corbeille de l'ordinateur. Une
   * telle session revue sur le téléphone y a été remise exprès : elle revient. Sans cette trace, une session de la
   * corbeille encore sur le téléphone est laissée où elle est, ni ramenée ni supprimée.
   */
  removed: number[];
  /**
   * Sessions du téléphone laissées où elles sont parce que l'ordinateur les avait supprimées sans que la
   * synchronisation y soit pour rien (elles étaient dans sa corbeille, sans ligne ici). Retenues pour qu'elles ne
   * reviennent pas d'elles-mêmes sur l'ordinateur le jour où sa corbeille les purge : tant qu'elles sont ici, elles
   * restent laissées, et dites.
   */
  held: number[];
}

/**
 * Base lue : `absent` (jamais synchronisé avec ce téléphone), `ok`, `unreadable` (illisible : la paire repart comme
 * une première rencontre, sans aucune suppression) ou `newer` (écrite par une version plus récente : ne pas
 * synchroniser, elle serait réécrite sans ce que cette version n'y comprend pas).
 */
export type SyncBaseRead =
  | { state: 'absent' | 'unreadable' | 'newer' }
  | { state: 'ok'; base: SyncBase };

/**
 * Identifiant de dossier acceptable : il sert de nom de fichier sur l'ordinateur. Tout autre texte trouvé dans un
 * marqueur est tenu pour absent, et remplacé.
 */
export const isSyncId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(value);

export const syncBasePath = (phoneId: string): string => `${SYNC_DIR}/${phoneId}.json`;

const ANCESTOR_SUFFIX: Readonly<Record<SyncSideName, string>> = { computer: 'ordinateur', phone: 'telephone' };

/** Où est gardée la fiche d'un côté à la dernière synchronisation de la session. */
export const syncAncestorPath = (phoneId: string, startMs: number, side: SyncSideName): string =>
  `${SYNC_DIR}/${phoneId}/fiches/${startMs}-${ANCESTOR_SUFFIX[side]}.json`;

const readMarker = (text: string | null): Record<string, unknown> | null => {
  const marker = text === null ? undefined : parseJson(text);
  return isObject(marker) && marker.format === MEMORY_FORMAT ? marker : null;
};

/** Identifiant écrit dans un marqueur ; `null` sans marqueur, sans identifiant, ou si ce n'en est pas un. */
export const readMarkerId = (text: string | null): string | null => {
  const id = readMarker(text)?.id;
  return isSyncId(id) ? id : null;
};

/**
 * Texte du marqueur avec cet identifiant, tout le reste gardé tel quel (champs que cette version ne connaît pas
 * compris). `null` si le texte n'est pas un marqueur : on n'en fabrique pas un à la place de l'application.
 */
export const markerTextWithId = (text: string | null, id: string): string | null => {
  const marker = readMarker(text);
  return marker ? `${stringifyJson({ ...marker, id })}\n` : null;
};

/**
 * Instant de la dernière synchronisation qui a changé ce dossier, écrit par l'ordinateur dans le marqueur du téléphone
 * (champ `synchro`, horloge de l'ordinateur) ; `null` sans marqueur ou sans cet instant. Le téléphone ne compare que
 * deux lectures entre elles : un instant qui change dit que ses sessions ont changé sous lui.
 */
export const readMarkerSync = (text: string | null): number | null => {
  const synchro = readMarker(text)?.synchro;
  return isFiniteNumber(synchro) ? synchro : null;
};

/**
 * Texte du marqueur avec l'instant d'une synchronisation, tout le reste gardé tel quel, toujours différent de celui
 * qu'il portait (deux synchronisations de la même milliseconde se distinguent encore). `null` si le texte n'est pas
 * un marqueur, ou s'il est d'une version plus récente : un tel marqueur n'est jamais réécrit.
 */
export const markerTextWithSync = (text: string | null, atMs: number): string | null => {
  const marker = readMarker(text);
  if (!marker || readMarkerVersion(text) > MEMORY_VERSION) return null;
  const synchro = atMs === readMarkerSync(text) ? atMs + 1 : atMs;
  return `${stringifyJson({ ...marker, synchro })}\n`;
};

/** Pourquoi deux dossiers ne se synchronisent pas, avant tout listage. */
export type SyncRefusal = 'computerNoMarker' | 'phoneNoMarker' | 'computerNewer' | 'phoneNewer';

/**
 * Refus d'après les marqueurs des deux dossiers (leur texte, `null` s'il manque) : un dossier sans marqueur n'est pas
 * un dossier mémoire (dossier vide ou mal désigné), et un dossier d'une version plus récente n'est pas réécrit.
 */
export const syncRefusal = (computerMarker: string | null, phoneMarker: string | null): SyncRefusal | null => {
  if (!readMarker(computerMarker)) return 'computerNoMarker';
  if (!readMarker(phoneMarker)) return 'phoneNoMarker';
  if (readMarkerVersion(computerMarker) > MEMORY_VERSION) return 'computerNewer';
  if (readMarkerVersion(phoneMarker) > MEMORY_VERSION) return 'phoneNewer';
  return null;
};

export const emptySyncBase = (computerId: string, phoneId: string, phonePath: string | null): SyncBase =>
  ({ computerId, phoneId, phonePath, syncedAtMs: null, sessions: [], removed: [], held: [] });

const parseStamp = (v: unknown): SyncStamp | null =>
  isObject(v) && typeof v.name === 'string' && v.name !== '' && isFiniteNumber(v.size) && isFiniteNumber(v.mtimeMs)
    ? { name: v.name, size: v.size, mtimeMs: v.mtimeMs }
    : null;

/** Fichier facultatif : `null` écrit, ou un tampon ; `undefined` s'il est mal formé. */
const parseOptionalStamp = (v: unknown): SyncStamp | null | undefined => (v === null || v === undefined ? null : parseStamp(v) ?? undefined);

const parseFiles = (v: unknown): SyncFiles | null => {
  if (!isObject(v)) return null;
  const gpx = parseStamp(v.gpx);
  const record = parseOptionalStamp(v.record);
  const imu = parseOptionalStamp(v.imu);
  return gpx && record !== undefined && imu !== undefined ? { gpx, record, imu } : null;
};

const parseSession = (v: unknown): SyncBaseSession | null => {
  if (!isObject(v) || !isFiniteNumber(v.startMs)) return null;
  const computer = parseFiles(v.computer);
  const phone = parseFiles(v.phone);
  return computer && phone ? { startMs: v.startMs, computer, phone } : null;
};

/**
 * Base lue dans son texte (`null` : fichier absent). Lecture tolérante : une ligne mal formée, ou en double, est
 * écartée seule, et sa session redevient une première rencontre, d'où rien ne se supprime. L'en-tête, lui, doit se
 * lire : sans les identifiants de la paire, la base entière est illisible.
 */
export const parseSyncBase = (text: string | null): SyncBaseRead => {
  if (text === null) return { state: 'absent' };
  const value = parseJson(text);
  if (!isObject(value) || value.format !== SYNC_BASE_FORMAT || !isFiniteNumber(value.version)) return { state: 'unreadable' };
  if (value.version > SYNC_BASE_VERSION) return { state: 'newer' };
  if (!isSyncId(value.computerId) || !isSyncId(value.phoneId)) return { state: 'unreadable' };
  const seen = new Set<number>();
  const sessions = (Array.isArray(value.sessions) ? value.sessions : []).flatMap((line): SyncBaseSession[] => {
    const session = parseSession(line);
    if (!session || seen.has(session.startMs)) return [];
    seen.add(session.startMs);
    return [session];
  });
  /** Liste d'identités sans ligne ; mal formée ou absente : vide. */
  const starts = (list: unknown, without: ReadonlySet<number>): number[] =>
    [...new Set((Array.isArray(list) ? list : []).filter((v): v is number => isFiniteNumber(v) && !seen.has(v) && !without.has(v)))];
  const held = starts(value.held, new Set());
  const removed = starts(value.removed, new Set(held));
  return {
    state: 'ok',
    base: {
      computerId: value.computerId,
      phoneId: value.phoneId,
      phonePath: typeof value.phonePath === 'string' ? value.phonePath : null,
      syncedAtMs: isFiniteNumber(value.syncedAtMs) ? value.syncedAtMs : null,
      sessions,
      removed,
      held,
    },
  };
};

export const serializeSyncBase = (base: SyncBase): string =>
  `${stringifyJson({ format: SYNC_BASE_FORMAT, version: SYNC_BASE_VERSION, ...base })}\n`;

export const syncBaseLine = (base: SyncBase | null, startMs: number): SyncBaseSession | null =>
  base?.sessions.find((s) => s.startMs === startMs) ?? null;

/** La base avec cette ligne, à la place de celle de la même session : la session est de nouveau des deux côtés. */
export const withSyncLine = (base: SyncBase, line: SyncBaseSession): SyncBase => ({
  ...base,
  sessions: [...base.sessions.filter((s) => s.startMs !== line.startMs), line].sort((a, b) => a.startMs - b.startMs),
  removed: base.removed.filter((startMs) => startMs !== line.startMs),
  held: base.held.filter((startMs) => startMs !== line.startMs),
});

const withStart = (list: readonly number[], startMs: number): number[] =>
  (list.includes(startMs) ? [...list] : [...list, startMs].sort((a, b) => a - b));

/** La base sans la ligne d'une session qui n'est plus d'aucun côté, sa suppression retenue (`SyncBase.removed`). */
export const withoutSyncLine = (base: SyncBase, startMs: number): SyncBase => ({
  ...base,
  sessions: base.sessions.filter((s) => s.startMs !== startMs),
  removed: withStart(base.removed, startMs),
  held: base.held.filter((held) => held !== startMs),
});

/** La base qui se souvient d'une session du téléphone laissée où elle est (`SyncBase.held`). */
export const withSyncHeld = (base: SyncBase, startMs: number): SyncBase => ({
  ...base,
  removed: base.removed.filter((removed) => removed !== startMs),
  held: withStart(base.held, startMs),
});

/**
 * La base à la fin d'une synchronisation menée au bout : sa date, et les suppressions retenues réduites à celles
 * que la corbeille de l'ordinateur tient encore (`trashed`, leurs identités) ; les autres ne servent plus.
 */
export const withSyncDone = (base: SyncBase, nowMs: number, trashed: ReadonlySet<number>): SyncBase => ({
  ...base,
  syncedAtMs: nowMs,
  removed: base.removed.filter((startMs) => trashed.has(startMs)),
});
