import { FILE_FORMATS } from '../core/appIdentity';
import { isFiniteNumber, isObject, parseJson, stringifyJson } from '../core/basics';
import { t, tn } from '../core/i18n';
import { uniqueSessionFileName } from './naming';
import { routeFileBase } from '../planning/routeRecord';
import { ROUTES_DIR, SESSIONS_DIR } from './folderLayout';
import type { MemoryKind } from '../platform/memoryFolder';

/**
 * Corbeille du programme Windows : ce qu'on y range, combien de temps, et comment le ramener, sans rien lire ni
 * écrire ici (les gestes sur le dossier sont dans `trashFolder.ts`).
 *
 *     corbeille/
 *       corbeille.json                 l'index : une entrée par suppression
 *       <instant>-<startMs ou base>/   les fichiers supprimés, sous leurs noms d'origine
 *
 * Une session ou un itinéraire supprimé sur l'ordinateur y passe au lieu d'être effacé, et y reste
 * `TRASH_KEEP_DAYS` jours, comptés depuis son entrée dans la corbeille. La corbeille est hors de la mémoire : ni le
 * balayage, ni l'import, ni « Récupérer » ne la lisent ; ses sessions ne comptent nulle part. Le téléphone et le
 * navigateur n'en ont pas.
 */

export const TRASH_DIR = 'corbeille';
export const TRASH_INDEX_FILE = 'corbeille.json';
export const TRASH_INDEX_PATH = `${TRASH_DIR}/${TRASH_INDEX_FILE}`;
export const TRASH_FORMAT = FILE_FORMATS.corbeille;
/** 2 : l'origine « telephone » s'ajoute ; un index de la version 1 se lit toujours, et se réécrit en 2. */
export const TRASH_VERSION = 2;

/** Durée de garde d'une entrée, en jours (demande de l'utilisateur : « au moins 30 jours »). */
export const TRASH_KEEP_DAYS = 30;
const DAY_MS = 86_400_000;
export const TRASH_KEEP_MS = TRASH_KEEP_DAYS * DAY_MS;

/**
 * `restes` : fiche ou capteurs d'une session sans leur GPX (restes d'une suppression coupée), que la synchronisation
 * a dû retirer et qu'aucune entrée de la même session ne pouvait recevoir sans rien écraser. Ce n'est pas une
 * session : ni montrée, ni restaurée, ni comptée ; gardée le temps de la corbeille, puis purgée.
 */
export type TrashKind = 'session' | 'itineraire' | 'restes';
/**
 * D'où viennent les fichiers de l'entrée : `ordinateur`, sa mémoire (suppression faite ici, ou copie de l'ordinateur
 * d'une session supprimée sur le téléphone) ; `telephone`, une copie du téléphone que la synchronisation y a rangée
 * avant de la retirer du téléphone, parce que la corbeille ne la tenait pas à l'identique. Les deux restent dans
 * des entrées distinctes : deux traces du même instant peuvent porter le même nom.
 */
export type TrashOrigin = 'ordinateur' | 'telephone';
/** Pourquoi l'entrée est là. */
export type TrashReason = 'supprimee';

export interface TrashFile {
  /** Nom d'origine, sans son dossier, gardé tel quel dans le sous-dossier de l'entrée. */
  name: string;
  size: number;
}

export interface TrashEntry {
  /** Sous-dossier de `corbeille/` qui tient les fichiers. */
  dir: string;
  kind: TrashKind;
  /** Session : instant du premier point (`summary.startMs`), son identité ; `null` pour un itinéraire. */
  startMs: number | null;
  /** Itinéraire : base de ses noms de fichiers ; `null` pour une session. */
  routeBase: string | null;
  /** Itinéraire : création (`RouteRecord.createdAt`), qui le distingue d'un autre de même base. */
  createdAt: string | null;
  /** Nom montré au moment de la suppression. */
  name: string;
  /** Entrée dans la corbeille, horloge de l'ordinateur. */
  deletedAtMs: number;
  origin: TrashOrigin;
  reason: TrashReason;
  /** Fichier qui fait l'entrée : le GPX de la session, la fiche de l'itinéraire. */
  main: string;
  files: TrashFile[];
}

/**
 * Index lu : `absent` (pas encore de corbeille), `ok`, `unreadable` (illisible) ou `newer` (version plus récente de
 * l'application). Les deux derniers ne s'écrivent jamais et ne purgent rien : leurs entrées pourraient être perdues.
 */
export interface TrashIndex {
  state: 'absent' | 'ok' | 'unreadable' | 'newer';
  entries: TrashEntry[];
}

export const isWritableTrash = (index: TrashIndex): boolean => index.state === 'absent' || index.state === 'ok';

const isString = (v: unknown): v is string => typeof v === 'string';
const stringOrNull = (v: unknown): string | null | undefined => (v === null ? null : isString(v) ? v : undefined);

const parseFile = (v: unknown): TrashFile | null =>
  isObject(v) && isString(v.name) && v.name !== '' && isFiniteNumber(v.size) ? { name: v.name, size: v.size } : null;

const parseEntry = (v: unknown): TrashEntry | null => {
  if (!isObject(v)) return null;
  const { dir, kind, startMs, routeBase, createdAt, name, deletedAtMs, origin, reason, main, files } = v;
  if (!isString(dir) || !isTrashDirName(dir) || (kind !== 'session' && kind !== 'itineraire' && kind !== 'restes')) return null;
  if (!(startMs === null || isFiniteNumber(startMs)) || !isString(name) || !isFiniteNumber(deletedAtMs)) return null;
  const base = stringOrNull(routeBase);
  const created = stringOrNull(createdAt);
  if (base === undefined || created === undefined || (origin !== 'ordinateur' && origin !== 'telephone') || reason !== 'supprimee') return null;
  if (!isString(main) || !Array.isArray(files)) return null;
  const parsed = files.map(parseFile);
  if (parsed.some((f) => f === null)) return null;
  return {
    dir, kind, startMs: startMs as number | null, routeBase: base, createdAt: created, name, deletedAtMs, origin, reason, main,
    files: parsed as TrashFile[],
  };
};

/** Index lu dans son texte (`null` : fichier absent). Une seule entrée illisible rend tout l'index illisible. */
export const parseTrashIndex = (text: string | null): TrashIndex => {
  if (text === null) return { state: 'absent', entries: [] };
  const value = parseJson(text);
  if (!isObject(value) || value.format !== TRASH_FORMAT || !isFiniteNumber(value.version)) return { state: 'unreadable', entries: [] };
  if (value.version > TRASH_VERSION) return { state: 'newer', entries: [] };
  if (!Array.isArray(value.entries)) return { state: 'unreadable', entries: [] };
  const entries = value.entries.map(parseEntry);
  if (entries.some((e) => e === null)) return { state: 'unreadable', entries: [] };
  return { state: 'ok', entries: entries as TrashEntry[] };
};

export const serializeTrashIndex = (entries: readonly TrashEntry[]): string =>
  `${stringifyJson({ format: TRASH_FORMAT, version: TRASH_VERSION, entries })}\n`;

/** Caractères qu'un nom de dossier de Windows refuse (les caractères de contrôle aussi, écartés à part). */
const FORBIDDEN_IN_DIR = /[\\/:*?"<>|]/;

/** Le texte, chaque caractère refusé dans un nom de dossier remplacé par `_`. */
const dirSafe = (text: string): string =>
  [...text].map((c) => (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f || FORBIDDEN_IN_DIR.test(c) ? '_' : c)).join('');

/** Longueur maximale de l'identité dans le nom d'un sous-dossier. */
const IDENTITY_MAX = 80;

/** Identité telle que l'écrit le nom d'un sous-dossier : caractères refusés remplacés, blancs réduits, rognée. */
const dirIdentity = (identity: string): string =>
  dirSafe(identity).replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, IDENTITY_MAX) || 'sans-nom';

/** Instant d'entrée en millisecondes, écrit sur 13 chiffres (de 2001 à 2286), puis un tiret, l'identité, un suffixe. */
const TRASH_DIR_NAME = /^\d{13}-(.+?)(-\d+)?$/;

/**
 * Vrai pour un sous-dossier que la corbeille a créé (`trashDirName`), à sa forme exacte : seuls ceux-là sont vidés
 * et effacés par elle. Un dossier posé là à la main (« 2024-vacances ») n'en est pas.
 */
export const isTrashDirName = (name: string): boolean => {
  const m = TRASH_DIR_NAME.exec(name);
  return m !== null && dirIdentity(m[1]) === m[1];
};

/**
 * Sous-dossier d'une entrée neuve : `<instant>-<identité>` (`startMs` d'une session, base d'un itinéraire), suivi
 * de `-2`, `-3`… s'il est déjà pris (`taken`, sans égard à la casse : le disque de Windows l'ignore).
 */
export const trashDirName = (nowMs: number, identity: string, taken: Iterable<string>): string => {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  const base = `${String(Math.max(0, Math.floor(nowMs))).padStart(13, '0')}-${dirIdentity(identity)}`;
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
};

/** Chemin d'un fichier d'une entrée, depuis la racine du dossier mémoire. */
export const trashFilePath = (dir: string, name: string): string => `${TRASH_DIR}/${dir}/${name}`;

/**
 * Entrées à purger à `nowMs` : entrées depuis plus de `TRASH_KEEP_DAYS` jours. Une date dans le futur (horloge
 * reculée depuis) n'est jamais purgée : elle attend que l'horloge la dépasse.
 */
export const expiredTrashEntries = (entries: readonly TrashEntry[], nowMs: number): TrashEntry[] =>
  entries.filter((e) => e.deletedAtMs <= nowMs && nowMs - e.deletedAtMs > TRASH_KEEP_MS);

/**
 * Sous-dossiers de la corbeille absents de l'index (copie coupée avant l'écriture de l'entrée, entrée retirée
 * avant ses fichiers) : à effacer. Seuls ceux dont le nom est celui d'une entrée (`isTrashDirName`) ; un dossier posé
 * là à la main reste.
 */
export const orphanTrashDirs = (entries: readonly TrashEntry[], listing: readonly { name: string; kind: 'file' | 'directory' }[]): string[] => {
  const known = new Set(entries.map((e) => e.dir.toLowerCase()));
  return listing.filter((e) => e.kind === 'directory' && isTrashDirName(e.name) && !known.has(e.name.toLowerCase())).map((e) => e.name);
};

/**
 * Entrée déjà faite pour la même session, à reprendre au lieu d'en créer une seconde : une suppression coupée après
 * l'écriture de l'entrée a laissé la session des deux côtés, et on la supprime de nouveau. Même identité, même
 * origine, même fichier principal (`mainName`), et chacun des fichiers à ranger (`files`) y est déjà, sous le même
 * nom et à la même taille : sinon la copie du moment (une fiche saisie depuis) serait retirée sans avoir été gardée.
 */
export const reusableTrashEntry = (
  entries: readonly TrashEntry[], startMs: number, mainName: string, files: readonly TrashFile[], origin: TrashOrigin = 'ordinateur',
  kind: 'session' | 'restes' = 'session',
): TrashEntry | null =>
  entries.find((e) => e.kind === kind && e.startMs === startMs && e.origin === origin && e.main.toLowerCase() === mainName.toLowerCase()
    && files.every((file) => e.files.some((f) => f.name.toLowerCase() === file.name.toLowerCase() && f.size === file.size))) ?? null;

/** Même chose pour un itinéraire : même base, même création, fiche de même taille. */
export const reusableRouteEntry = (entries: readonly TrashEntry[], base: string, createdAt: string, recordSize: number): TrashEntry | null =>
  entries.find((e) => e.kind === 'itineraire' && e.routeBase?.toLowerCase() === base.toLowerCase() && e.createdAt === createdAt
    && e.files.some((f) => f.name === e.main && f.size === recordSize)) ?? null;

/** Entrées que la corbeille montre et sait restaurer : toutes, sauf les restes d'une session (`TrashKind`). */
export const shownTrashEntries = (entries: readonly TrashEntry[]): TrashEntry[] => entries.filter((e) => e.kind !== 'restes');

/** Entrées d'une session, par son identité. */
export const sessionTrashEntries = (entries: readonly TrashEntry[], startMs: number): TrashEntry[] =>
  entries.filter((e) => e.kind === 'session' && e.startMs === startMs);

/** Les entrées, sans celles de `dirs`. */
export const withoutTrashEntries = (entries: readonly TrashEntry[], dirs: readonly string[]): TrashEntry[] => {
  const gone = new Set(dirs.map((d) => d.toLowerCase()));
  return entries.filter((e) => !gone.has(e.dir.toLowerCase()));
};

/** Entrées de la plus récemment supprimée à la plus ancienne. */
export const sortedTrashEntries = (entries: readonly TrashEntry[]): TrashEntry[] =>
  [...entries].sort((a, b) => b.deletedAtMs - a.deletedAtMs);

/** Une copie à faire pour restaurer : de la corbeille vers la mémoire. */
export interface TrashCopy {
  from: string;
  to: string;
}

const withoutExtension = (name: string): string => name.replace(/\.[^.]+$/, '');

/**
 * Restauration d'une session : capteurs, fiche, puis GPX en dernier (une coupure laisse une fiche ou des capteurs
 * sans GPX, ignorés, jamais un GPX sans fiche qui recevrait une fiche neuve), sous un nom de GPX libre dans
 * `sessions/` (`taken` : noms déjà là, `uniqueSessionFileName`). Seule la session de l'entrée revient, pas les
 * copies en double rangées avec elle. Rend aussi le nom du GPX restauré.
 */
export const sessionRestorePlan = (entry: TrashEntry, taken: Iterable<string>): { gpx: string; copies: TrashCopy[] } => {
  const gpx = uniqueSessionFileName(entry.main, taken);
  const stem = withoutExtension(entry.main).toLowerCase();
  const targetStem = withoutExtension(gpx);
  const has = (ext: string) => entry.files.find((f) => f.name.toLowerCase() === `${stem}.${ext}`);
  const copies = (['imu', 'json', 'gpx'] as const)
    .map((ext) => has(ext))
    .filter((f): f is TrashFile => f !== undefined)
    .map((f) => ({ from: trashFilePath(entry.dir, f.name), to: `${SESSIONS_DIR}/${targetStem}${f.name.slice(stem.length)}` }));
  return { gpx, copies };
};

/**
 * Restauration d'un itinéraire : le GPX, puis la fiche, qui fait foi et le fait paraître dans la liste, sous une
 * base libre de `itineraires/` (`routeFileBase`). Rend la base retenue.
 */
export const routeRestorePlan = (entry: TrashEntry, taken: Iterable<string>): { base: string; copies: TrashCopy[] } => {
  const original = entry.routeBase ?? withoutExtension(entry.main);
  const base = routeFileBase(original, taken);
  const stem = original.toLowerCase();
  const copies = (['gpx', 'json'] as const)
    .map((ext) => entry.files.find((f) => f.name.toLowerCase() === `${stem}.${ext}`))
    .filter((f): f is TrashFile => f !== undefined)
    .map((f) => ({ from: trashFilePath(entry.dir, f.name), to: `${ROUTES_DIR}/${base}${f.name.slice(stem.length)}` }));
  return { base, copies };
};

// --- Textes ---

/**
 * Vrai si le dossier ouvert (`kind`, `readOnly`) a une corbeille : le dossier du disque du programme Windows, en
 * écriture. Le programme Windows revenu à la mémoire du navigateur n'en a pas : ses suppressions sont définitives,
 * et les phrases de confirmation le disent. La même condition décide de la mise à la corbeille (`trashFolderOf`).
 */
export const deletesToTrash = (kind: MemoryKind | null | undefined, readOnly: boolean): boolean => kind === 'disk' && !readOnly;

/**
 * Bouton qui confirme la suppression d'un itinéraire : il dit la corbeille quand le dossier ouvert en a une
 * (`toTrash`, `deletesToTrash`), sinon `otherwise`.
 */
export const routeDeleteButton = (toTrash: boolean, otherwise: string): string =>
  toTrash ? t('Mettre à la corbeille ({days} jours)', { days: TRASH_KEEP_DAYS }) : otherwise;

/** Question de la ligne d'une session, avant sa suppression ; `toTrash` : le dossier ouvert a une corbeille. */
export const sessionDeleteQuestion = (toTrash: boolean): string =>
  toTrash
    ? t('Mettre cette session à la corbeille ? Elle y reste {days} jours (Réglages › Mémoire).', { days: TRASH_KEEP_DAYS })
    : t('Supprimer cette session de la mémoire ?');

/**
 * Question posée après l'appui tenu sur « Supprimer » ; `toTrash` : le dossier ouvert a une corbeille ; `drafted` : un
 * brouillon de la session serait perdu.
 */
export const sessionDiscardQuestion = (toTrash: boolean, drafted: boolean): string => {
  if (!toTrash) {
    return drafted
      ? t('Supprimer cette session ? Elle sera supprimée de la mémoire, avec sa fiche et ses capteurs, et ne pourra pas être récupérée. Les modifications non enregistrées seront perdues.')
      : t('Supprimer cette session ? Elle sera supprimée de la mémoire, avec sa fiche et ses capteurs, et ne pourra pas être récupérée.');
  }
  return drafted
    ? t('Supprimer cette session ? Elle part à la corbeille de cet ordinateur, avec sa fiche et ses capteurs, et y reste {days} jours (Réglages › Mémoire). Les modifications non enregistrées seront perdues.', { days: TRASH_KEEP_DAYS })
    : t('Supprimer cette session ? Elle part à la corbeille de cet ordinateur, avec sa fiche et ses capteurs, et y reste {days} jours (Réglages › Mémoire).', { days: TRASH_KEEP_DAYS });
};

/** Combien la corbeille garde de sessions et d'itinéraires. */
export const trashCounts = (entries: readonly TrashEntry[]): { sessions: number; routes: number } => ({
  sessions: entries.filter((e) => e.kind === 'session').length,
  routes: entries.filter((e) => e.kind === 'itineraire').length,
});

/** Repère de la zone de la corbeille dans Réglages › Mémoire, où mène le menu « … » de Sessions. */
export const TRASH_ZONE_ID = 'zone-corbeille';

/** Ligne de Réglages › Mémoire : « Corbeille : 4 sessions, gardées 30 jours » ; `null` si elle est vide. */
export const trashSummaryText = ({ sessions, routes }: { sessions: number; routes: number }): string | null => {
  if (sessions + routes === 0) return null;
  const days = TRASH_KEEP_DAYS;
  if (routes === 0) return tn(sessions, 'Corbeille : {n} session, gardée {days} jours', 'Corbeille : {n} sessions, gardées {days} jours', { days });
  if (sessions === 0) return tn(routes, 'Corbeille : {n} itinéraire, gardé {days} jours', 'Corbeille : {n} itinéraires, gardés {days} jours', { days });
  return t('Corbeille : {sessions} et {routes}, gardés {days} jours', {
    sessions: tn(sessions, '{n} session', '{n} sessions'),
    routes: tn(routes, '{n} itinéraire', '{n} itinéraires'),
    days,
  });
};
