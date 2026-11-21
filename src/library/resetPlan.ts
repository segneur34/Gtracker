import { FORMAT_ID, STORAGE_KEYS } from '../core/appIdentity';
import { t, tn } from '../core/i18n';
import type { FolderEntry, MemoryFolder } from '../platform/memoryFolder';
import {
  JOURNALS_DIR, LEARNED_PLACES_FILE, MARKER_FILE, README_FILE, RESTING_HR_FILE, ROUTES_DIR, SESSIONS_DIR, SETTINGS_DIR,
} from './folderLayout';
import { TRASH_DIR, TRASH_INDEX_FILE, isTrashDirName } from './trash';
import { SYNC_DIR, isSyncId, markerTextWithoutId } from './syncBase';

/**
 * Remise à zéro (Réglages › Mémoire) : ce que chacun des deux boutons efface, sans rien effacer ici.
 *
 * - « Réglages d'usine » : les réglages de l'appareil reviennent à leur défaut, et son fichier de réglages quitte le
 *   dossier mémoire ; sessions, itinéraires, profil du pratiquant, tests de FC repos et lieux corrigés restent.
 * - « Tout supprimer » : tout ce que l'application a écrit, clés de l'appareil et fichiers du dossier mémoire, et
 *   seulement cela : un fichier qu'elle n'a pas écrit, ou rangé hors de ses sous-dossiers, reste en place.
 *
 * Le dossier désigné reste désigné dans les deux cas (`memoryFolder`).
 */

/** Rôle d'une clé de l'appareil : réglage (effacé par les deux boutons), donnée (par « Tout supprimer » seulement), dossier désigné (jamais). */
export type KeyClass = 'reglage' | 'donnee' | 'dossier';

/**
 * Chaque clé de l'appareil, classée. Le typage oblige à classer une clé ajoutée plus tard à `STORAGE_KEYS`.
 * `settingsSavedAt` est une donnée : « Réglages d'usine » le pose à maintenant au lieu de le retirer, sans quoi
 * l'appareil se croirait neuf et reprendrait de lui-même le fichier de réglages d'un autre appareil.
 */
export const KEY_CLASSES: Record<keyof typeof STORAGE_KEYS, KeyClass> = {
  sportSettings: 'reglage',
  athleteProfile: 'donnee',
  theme: 'reglage',
  sections: 'reglage',
  profil: 'reglage',
  tutoriels: 'reglage',
  statistiques: 'reglage',
  panelSizes: 'reglage',
  partage: 'reglage',
  libraryCache: 'donnee',
  settingsSavedAt: 'donnee',
  deviceId: 'donnee',
  deviceName: 'donnee',
  seenSettingsFiles: 'reglage',
  summaryGestures: 'donnee',
  followedTrace: 'donnee',
  fondCarte: 'reglage',
  restingHr: 'donnee',
  planning: 'reglage',
  routeList: 'reglage',
  triBibliotheque: 'reglage',
  heartRateBelts: 'reglage',
  memoryFolder: 'dossier',
  permissionsSeenVersion: 'donnee',
  autostartOpened: 'donnee',
  tileCache: 'reglage',
  tileUrls: 'reglage',
  rechercheLieu: 'reglage',
  lieuxAppris: 'donnee',
  langue: 'reglage',
  brouillons: 'donnee',
};

const keysOf = (wanted: (c: KeyClass) => boolean): string[] =>
  (Object.keys(KEY_CLASSES) as (keyof typeof STORAGE_KEYS)[]).filter((k) => wanted(KEY_CLASSES[k])).map((k) => STORAGE_KEYS[k]);

/** Clés jamais effacées : le dossier désigné. */
const KEPT_KEYS: ReadonlySet<string> = new Set(keysOf((c) => c === 'dossier'));

/**
 * Valeurs d'usine posées au lieu d'un retrait : les réglages des activités voyagent dans le fichier de l'appareil,
 * dont la réécriture garde les clés absentes de l'appareil (`buildSettingsFile`) ; une valeur vide (« rien de
 * réglé », la même que l'absence) y remplace donc les anciens réglages, même si le fichier n'a pas pu être retiré.
 */
const FACTORY_VALUES: Readonly<Record<string, unknown>> = { [STORAGE_KEYS.sportSettings]: {} };

/** Clés que « Réglages d'usine » retire, et celles qu'il écrit (valeurs d'usine, instant des réglages à `nowMs`). */
export const factoryKeyPlan = (nowMs: number): { remove: string[]; write: Record<string, unknown> } => ({
  remove: keysOf((c) => c === 'reglage').filter((key) => !(key in FACTORY_VALUES)),
  write: { ...FACTORY_VALUES, [STORAGE_KEYS.settingsSavedAt]: nowMs },
});

/**
 * Clés que « Tout supprimer » retire : réglages et données, et toute autre clé de l'application encore rangée sur
 * l'appareil (`stored`, préfixe `gtracker.`), sauf le dossier désigné.
 */
export const eraseKeyPlan = (stored: readonly string[]): string[] => {
  const prefix = `${FORMAT_ID}.`;
  return [...new Set([...keysOf((c) => c !== 'dossier'), ...stored.filter((key) => key.startsWith(prefix))])]
    .filter((key) => !KEPT_KEYS.has(key));
};

// --- Dossier mémoire ---

/** Ancien fichier unique de réglages, à la racine, d'avant un fichier par appareil. */
const OLD_SETTINGS_FILE = 'reglages.json';

/** Fichiers de l'application à la racine du dossier, en minuscules (le dossier d'un PC ignore la casse). */
const ROOT_FILES = [RESTING_HR_FILE, LEARNED_PLACES_FILE, OLD_SETTINGS_FILE, README_FILE, MARKER_FILE].map((n) => n.toLowerCase());

/** Extensions des fichiers de l'application dans chacun de ses sous-dossiers. */
const DIR_FILES: Readonly<Record<string, RegExp>> = {
  [SESSIONS_DIR]: /\.(gpx|json|imu)$/i,
  [ROUTES_DIR]: /\.(json|gpx)$/i,
  [SETTINGS_DIR]: /\.json$/i,
  // Journaux d'enregistrement copiés tels quels : leur nom et leur extension viennent du journal d'origine.
  [JOURNALS_DIR]: /./,
};

/** Suffixes d'une écriture interrompue : le fichier qu'elle remplaçait ou créait, puis ce suffixe. */
const TEMP_SUFFIXES = [`.${FORMAT_ID}-tmp`, `.${FORMAT_ID}-new`, '.tmp'];

const withoutTempSuffix = (name: string): string => {
  const suffix = TEMP_SUFFIXES.find((s) => name.toLowerCase().endsWith(s) && name.length > s.length);
  return suffix ? name.slice(0, name.length - suffix.length) : name;
};

/**
 * Vrai pour un fichier que l'application écrit, par son dossier (`''` pour la racine) et son nom : à la racine,
 * ses fichiers nommés ; dans `sessions/`, `itineraires/` et `reglages/`, ses extensions ; et leurs temporaires.
 * Un GPX déposé à la main dans `sessions/` est une session pour l'application : il en est. Rien d'autre, ni un
 * autre sous-dossier, ni un fichier d'un sous-dossier de ceux-ci.
 */
export const isAppMemoryFile = (dir: string, name: string): boolean => {
  const base = withoutTempSuffix(name);
  if (base === '' || base.includes('/')) return false;
  if (dir === '') return ROOT_FILES.includes(base.toLowerCase());
  const pattern = DIR_FILES[dir];
  return pattern !== undefined && pattern.test(base);
};

/** Contenu des dossiers lus par la remise à zéro. */
export interface MemoryListings {
  /**
   * Corbeille du programme Windows (`trash.ts`) : son dossier, et chacun de ses sous-dossiers d'entrée par son nom.
   * Absente ailleurs.
   */
  trash?: { root: readonly Pick<FolderEntry, 'name' | 'kind'>[]; dirs: Readonly<Record<string, readonly Pick<FolderEntry, 'name' | 'kind'>[]>> };
  /**
   * Synchronisation avec les téléphones (`syncBase.ts`) : `synchro/`, et les fiches gardées de chaque téléphone
   * (`synchro/<id>/fiches/`), par identifiant. Absente si le dossier n'en a pas.
   */
  sync?: { root: readonly Pick<FolderEntry, 'name' | 'kind'>[]; fiches: Readonly<Record<string, readonly Pick<FolderEntry, 'name' | 'kind'>[]>> };
  root: readonly Pick<FolderEntry, 'name' | 'kind'>[];
  /** `journaux/` : absent de la lecture, il n'y a rien à effacer. */
  journals?: readonly Pick<FolderEntry, 'name' | 'kind'>[];
  sessions: readonly Pick<FolderEntry, 'name' | 'kind'>[];
  routes: readonly Pick<FolderEntry, 'name' | 'kind'>[];
  settings: readonly Pick<FolderEntry, 'name' | 'kind'>[];
}

/** Chemins à effacer, dans l'ordre, et ce qu'ils comptent. */
export interface MemoryTargets {
  paths: string[];
  /** GPX de `sessions/` : les sessions effacées. */
  sessions: number;
  /** Fiches d'itinéraire de `itineraires/`. */
  routes: number;
  /** Sous-dossiers de la corbeille qui ont encore des fichiers : ses entrées. */
  trash: number;
}

/** Fichiers d'une entrée de la corbeille : ceux d'une session ou d'un itinéraire. */
const TRASH_FILES = /\.(gpx|json|imu)$/i;

/** Fichiers de la corbeille, l'index d'abord : une coupure laisse des sous-dossiers hors de l'index, effacés à la purge. */
const trashPaths = (trash: MemoryListings['trash']): { paths: string[]; entries: number } => {
  if (!trash) return { paths: [], entries: 0 };
  const index = trash.root.filter((e) => e.kind === 'file' && withoutTempSuffix(e.name).toLowerCase() === TRASH_INDEX_FILE).map((e) => `${TRASH_DIR}/${e.name}`);
  const dirs = Object.entries(trash.dirs)
    .filter(([dir]) => isTrashDirName(dir))
    .map(([dir, entries]) => entries.filter((e) => e.kind === 'file' && TRASH_FILES.test(withoutTempSuffix(e.name))).map((e) => `${TRASH_DIR}/${dir}/${e.name}`))
    .filter((paths) => paths.length > 0);
  return { paths: [...index, ...dirs.flat()], entries: dirs.length };
};

/** Base d'un téléphone (`<id>.json`) et témoin d'une synchronisation en cours, à la racine de `synchro/`. */
const SYNC_ROOT_FILE = /^(?:([A-Za-z0-9][A-Za-z0-9_-]{7,63})|en-cours)\.json$/;
/** Fiche gardée d'un côté (`syncAncestorPath`). */
const SYNC_ANCESTOR_FILE = /^\d+-(?:ordinateur|telephone)\.json$/;

/**
 * Fichiers de la synchronisation : les bases des téléphones d'abord, puis le témoin et les fiches gardées. Sans base,
 * la synchronisation suivante est une première rencontre, d'où rien ne se supprime : une remise à zéro coupée après
 * les bases ne peut plus faire prendre les sessions déjà effacées pour des suppressions à reporter sur le téléphone.
 */
const syncPaths = (sync: MemoryListings['sync']): string[] => {
  if (!sync) return [];
  const rootFiles = sync.root.filter((e) => e.kind === 'file' && SYNC_ROOT_FILE.test(withoutTempSuffix(e.name))).map((e) => e.name);
  const isBase = (name: string): boolean => withoutTempSuffix(name).toLowerCase() !== 'en-cours.json';
  const fiches = Object.entries(sync.fiches)
    .filter(([id]) => isSyncId(id))
    .flatMap(([id, entries]) => entries
      .filter((e) => e.kind === 'file' && SYNC_ANCESTOR_FILE.test(withoutTempSuffix(e.name)))
      .map((e) => `${SYNC_DIR}/${id}/fiches/${e.name}`));
  return [
    ...rootFiles.filter(isBase).map((n) => `${SYNC_DIR}/${n}`),
    ...rootFiles.filter((n) => !isBase(n)).map((n) => `${SYNC_DIR}/${n}`),
    ...fiches,
  ];
};

const filesOf = (dir: string, entries: MemoryListings['root']): string[] =>
  entries.filter((e) => e.kind === 'file' && isAppMemoryFile(dir, e.name)).map((e) => e.name);

const isGpx = (name: string): boolean => /\.gpx$/i.test(name);

/**
 * Fichiers de l'application à effacer pour « Tout supprimer », dans l'ordre : les GPX des sessions d'abord (une
 * interruption laisse des sessions entières ou absentes, jamais une trace sans fiche qui se recrée), puis leurs
 * fiches et capteurs, les itinéraires, les fichiers de réglages, ceux de la racine, et le marqueur en dernier : tant
 * qu'il reste quelque chose, le dossier se reconnaît. Les bases de la synchronisation (`synchro/`) partent avant tout :
 * un dossier vidé, même à moitié, ne vide jamais le téléphone. Puis la corbeille du programme Windows (son index,
 * puis les fichiers de ses entrées) et les journaux gardés de côté (`journaux/`). Jamais un dossier : sur le
 * téléphone, effacer un dossier efface tout ce qu'il contient.
 */
export const memoryResetTargets = (listings: MemoryListings): MemoryTargets => {
  const sessions = filesOf(SESSIONS_DIR, listings.sessions);
  const gpx = sessions.filter(isGpx);
  const routes = filesOf(ROUTES_DIR, listings.routes);
  const root = filesOf('', listings.root);
  const isMarker = (name: string): boolean => withoutTempSuffix(name).toLowerCase() === MARKER_FILE.toLowerCase();
  const at = (dir: string) => (name: string): string => `${dir}/${name}`;
  const trash = trashPaths(listings.trash);
  return {
    paths: [
      ...syncPaths(listings.sync),
      ...trash.paths,
      ...filesOf(JOURNALS_DIR, listings.journals ?? []).map(at(JOURNALS_DIR)),
      ...gpx.map(at(SESSIONS_DIR)),
      ...sessions.filter((n) => !isGpx(n)).map(at(SESSIONS_DIR)),
      ...routes.map(at(ROUTES_DIR)),
      ...filesOf(SETTINGS_DIR, listings.settings).map(at(SETTINGS_DIR)),
      ...root.filter((n) => !isMarker(n)),
      ...root.filter(isMarker),
    ],
    sessions: gpx.length,
    routes: routes.filter((n) => /\.json$/i.test(n)).length,
    trash: trash.entries,
  };
};

/** Corbeille lue pour la remise à zéro (dossier du disque seulement) ; illisible ou absente, rien à effacer. */
const readTrashListings = async (folder: Pick<MemoryFolder, 'list' | 'kind'>): Promise<MemoryListings['trash']> => {
  if (folder.kind !== 'disk') return undefined;
  try {
    const root = await folder.list(TRASH_DIR);
    const dirs: Record<string, readonly Pick<FolderEntry, 'name' | 'kind'>[]> = {};
    for (const e of root) {
      if (e.kind === 'directory' && isTrashDirName(e.name)) dirs[e.name] = await folder.list(`${TRASH_DIR}/${e.name}`);
    }
    return { root, dirs };
  } catch {
    return undefined;
  }
};

/** `synchro/` lu pour la remise à zéro, quelle que soit la sorte du dossier (une copie peut l'avoir emporté). */
const readSyncListings = async (folder: Pick<MemoryFolder, 'list'>): Promise<MemoryListings['sync']> => {
  const root = await folder.list(SYNC_DIR);
  const fiches: Record<string, readonly Pick<FolderEntry, 'name' | 'kind'>[]> = {};
  for (const e of root) {
    if (e.kind === 'directory' && isSyncId(e.name)) fiches[e.name] = await folder.list(`${SYNC_DIR}/${e.name}/fiches`);
  }
  return { root, fiches };
};

/**
 * Lit les dossiers de la remise à zéro ; `journaux/`, facultatif, ne bloque pas s'il ne se lit pas, ni la corbeille
 * du programme Windows. `synchro/` doit se lire : une base laissée en place ferait prendre les sessions effacées pour
 * des suppressions à reporter sur le téléphone.
 */
export const readMemoryListings = async (folder: Pick<MemoryFolder, 'list' | 'kind'>): Promise<MemoryListings> => ({
  sync: await readSyncListings(folder),
  trash: await readTrashListings(folder),
  root: await folder.list(''),
  journals: await folder.list(JOURNALS_DIR).catch(() => []),
  sessions: await folder.list(SESSIONS_DIR),
  routes: await folder.list(ROUTES_DIR),
  settings: await folder.list(SETTINGS_DIR),
});

/** Fin de l'effacement d'un dossier : sessions effacées sur leur nombre, et l'erreur qui l'a arrêté. */
export interface EraseResult {
  sessionsDone: number;
  sessionsTotal: number;
  error: unknown;
}

/**
 * Efface du dossier les fichiers de l'application (`memoryResetTargets`), un par un, et s'arrête au premier échec,
 * sans rien tenter d'autre. Avant le premier effacement, le marqueur perd son identifiant de synchronisation
 * (`markerTextWithoutId`) : un dossier vidé exprès, même coupé au milieu, n'est plus celui que l'autre appareil
 * connaît, et la synchronisation suivante, une première rencontre, ne supprime rien chez lui et lui rend ses sessions.
 * Si cette réécriture échoue, rien n'est effacé. `onProgress` reçoit le nombre de fichiers effacés et leur total.
 */
export const eraseAppFiles = async (
  folder: Pick<MemoryFolder, 'list' | 'remove' | 'kind' | 'readText' | 'writeText'>,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<EraseResult> => {
  let listings: MemoryListings;
  try {
    listings = await readMemoryListings(folder);
    const withoutId = markerTextWithoutId(await folder.readText(MARKER_FILE));
    if (withoutId !== null) await folder.writeText(MARKER_FILE, withoutId);
  } catch (error) {
    return { sessionsDone: 0, sessionsTotal: 0, error };
  }
  const { paths, sessions } = memoryResetTargets(listings);
  let sessionsDone = 0;
  for (let i = 0; i < paths.length; i++) {
    onProgress(i, paths.length);
    try {
      await folder.remove(paths[i]);
    } catch (error) {
      return { sessionsDone, sessionsTotal: sessions, error };
    }
    if (paths[i].startsWith(`${SESSIONS_DIR}/`) && isGpx(paths[i])) sessionsDone += 1;
  }
  onProgress(paths.length, paths.length);
  return { sessionsDone, sessionsTotal: sessions, error: null };
};

/** Fichiers de réglages de cet appareil (`deviceId`) : les seuls que « Réglages d'usine » retire du dossier. */
export const ownSettingsFiles = (entries: readonly { fileName: string; deviceId: string | null }[], deviceId: string): string[] =>
  entries.filter((e) => e.deviceId === deviceId).map((e) => e.fileName);

// --- Textes ---

export type ResetKind = 'usine' | 'tout';

/** Ce que « Tout supprimer » effacera, compté avant de demander. */
export interface EraseCounts {
  /** Sessions du dossier mémoire (leurs GPX). */
  sessions: number;
  /** Sessions enregistrées qui attendent un dossier, dans le dossier privé du téléphone. */
  pending: number;
  routes: number;
  /** Entrées de la corbeille du programme Windows ; absent ailleurs. */
  trash?: number;
}

/** Question posée après l'appui tenu. */
export const resetConfirmText = (kind: ResetKind, counts: EraseCounts): string => {
  if (kind === 'usine') {
    // Une seule clé : le texte tient sur une ligne, que le lecteur de clés lit en entier.
    // prettier-ignore
    return t("Revenir aux réglages d'usine ? Les activités, les unités, les onglets, les couleurs de trace et tous les autres réglages de cet appareil reprennent leur valeur de départ. Les activités que vous avez créées et vos listes de matériel sont effacées ; leurs sessions restent, sous le nom de leur calcul. Les sessions, les itinéraires, le profil et les lieux corrigés restent. L'application va redémarrer.");
  }
  const total = counts.sessions + counts.pending;
  const sessionsText = tn(total, '{n} session et leur fiche', '{n} sessions et leurs fiches');
  const sessions = total === 0 ? null
    : counts.pending > 0 ? t("{base} (dont {pending} en attente d'un dossier)", { base: sessionsText, pending: counts.pending })
      : sessionsText;
  const items = [
    sessions,
    counts.routes > 0 ? tn(counts.routes, '{n} itinéraire', '{n} itinéraires') : null,
    (counts.trash ?? 0) > 0 ? tn(counts.trash ?? 0, '{n} élément de la corbeille', '{n} éléments de la corbeille') : null,
    t('le profil'), t('les tests de FC repos'), t('les lieux corrigés'), t('les réglages'), t('les cartes gardées'),
  ].filter((item): item is string => item !== null);
  return `${t('Tout supprimer ? Seront effacés définitivement : {others} et {last}.', { others: items.slice(0, -1).join(', '), last: items[items.length - 1] })} `
    + t("Les autres fichiers posés à la main dans le dossier restent. L'application redémarrera comme à sa première ouverture.");
};

/** Ce qui décide si les boutons sont permis. */
export interface ResetContext {
  /** Enregistrement en cours (démarrage et arrêt compris). */
  recording: boolean;
  /** Session arrêtée qui attend d'être rangée ou supprimée. */
  pendingSession: boolean;
  memoryStatus: 'opening' | 'ready' | 'needs-permission' | 'unavailable';
  readOnly: boolean;
  importing: boolean;
  /** Un dossier est désigné, ouvert ou non : sans mémoire ouverte, ses sessions ne pourraient pas être effacées. */
  designated: boolean;
}

/** Phrase d'un enregistrement en cours, qui grise les deux boutons. */
export const RECORDING_REFUSAL = t("Impossible pendant un enregistrement : arrêtez-le d'abord.");

/** Phrase de « Tout supprimer » refusé : un dossier est désigné, mais la mémoire ne l'a pas ouvert. */
export const FOLDER_CLOSED_REFUSAL = t(
  "Redonnez d'abord l'accès au dossier mémoire, plus haut : sans lui, ses sessions ne peuvent pas être effacées."
);

/** Pourquoi un bouton est refusé, `null` s'il est permis. */
export const resetRefusal = (kind: ResetKind, c: ResetContext): string | null => {
  if (c.recording) return RECORDING_REFUSAL;
  if (c.pendingSession) return t("Une session arrêtée attend d'être rangée : terminez-la d'abord, page Enregistrer.");
  if (c.importing) return t('Un import est en cours : attendez sa fin.');
  if (c.memoryStatus === 'opening') return t("La mémoire s'ouvre encore : patientez un instant.");
  if (kind === 'tout' && (c.memoryStatus === 'needs-permission' || (c.memoryStatus === 'unavailable' && c.designated))) {
    return FOLDER_CLOSED_REFUSAL;
  }
  if (kind === 'tout' && c.memoryStatus === 'ready' && c.readOnly) {
    return t("Ce dossier vient d'une version plus récente de Gtracker : mettez l'application à jour avant de tout supprimer.");
  }
  return null;
};

/** Refus d'une remise à zéro demandée pendant qu'une autre est en cours. */
export const RESET_RUNNING_REFUSAL = t('Une remise à zéro est déjà en cours.');

/** Compte rendu d'une remise à zéro arrêtée par le dossier mémoire : rien d'autre n'a été touché. */
export const resetInterruptedText = (result: Pick<EraseResult, 'sessionsDone' | 'sessionsTotal'>, reason: string): string =>
  `${tn(
    result.sessionsDone,
    'Remise à zéro interrompue ({reason}) : {n} session effacée sur {total} ; réglages, profil et cartes intacts.',
    'Remise à zéro interrompue ({reason}) : {n} sessions effacées sur {total} ; réglages, profil et cartes intacts.',
    { reason, total: result.sessionsTotal }
  )} `
  + t("Vérifiez l'accès au dossier mémoire, puis recommencez.");
