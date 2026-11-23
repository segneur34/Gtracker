import {
  MARKER_FILE, MEMORY_VERSION, README_FILE, markerText, readMarkerVersion, readmeText, sessionPath,
} from '../../library/folderLayout';
import { t, tn } from '../../core/i18n';
import { describeRefresh } from '../../library/importReport';
import { LEGACY_MARKER_FILE } from '../../library/legacyImport';
import { markerTextWithDevice } from '../../library/syncBase';
import { folderId } from '../../library/libraryCache';
import { imuFileName } from '../../library/record';
import {
  canChooseFolder, chooseMemoryFolder, FolderRefusedError, forgetChosenFolder, openMemoryFolder, readOnlyFolder,
  reconnectMemoryFolder, type DesktopChoiceStart, type MemoryFolder,
} from '../../platform/memoryFolder';
import { isDesktopApp } from '../../platform/runtime';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { jsonStore, settleStoredWrites, storageStartupFailure } from '../../platform/storage';
import { errorMessage } from '../../core/basics';
import { libraryState, reportError, setState } from './store';
import { holdUnwritten, lib, publish, takeUnwritten, writableFolder } from './memory';
import { noteSettingsGestures, readGestures, refreshFailed } from './summarySettings';
import { cancelRecordWrite, carryUnwritten, recordEdits, recordTimers, settleRecordWrites } from './recordWrites';
import { cancelCacheUpdate } from './cache';
import { scan } from './scan';
import { completeScan } from './summaryQueue';
import {
  applySettingsChange, deviceId, flushWrites, forgetSettingsEntries, libraryUiStarted, syncSettingsSafely, watchDeviceSettings,
} from './deviceSettings';
import { addGpx, countPending } from './addSession';
import { flushPending } from './pending';
import { recordToCopy } from './sessionRecords';
import { sessionDraftStore } from '../sessionDraftStore';
import { reloadTrash, startTrash } from './trash';
import { createSyncMarkerWatch, pollWhileVisible } from '../../library/syncWatch';

/**
 * Ouverture de la mémoire : le dossier mis en service ou quitté, le lancement, le choix d'un autre
 * dossier, le retour à la mémoire du navigateur et la relecture (« Mettre à jour »).
 */

/**
 * Le dossier désigné, en lecture seule si son marqueur dit une disposition plus récente : il pourrait
 * ne plus se ranger comme on le croit (`MEMORY_VERSION`). Marqueur illisible ou non lu : dossier ordinaire.
 * Rend aussi le texte du marqueur lu.
 */
const guardedFolder = async (f: MemoryFolder): Promise<{ folder: MemoryFolder; marker: string | null }> => {
  const marker = await f.readText(MARKER_FILE).catch(() => null);
  return { folder: readMarkerVersion(marker) > MEMORY_VERSION ? readOnlyFolder(f) : f, marker };
};

/** Relecture de la mémoire quand une synchronisation faite par l'ordinateur l'a changée (`library/syncWatch.ts`). */
const syncWatch = createSyncMarkerWatch(() => refreshLibrary());

/** Arrêt de la relecture lente du marqueur en cours (`pollWhileVisible`) : une seule à la fois. */
let stopMarkerPolling: (() => void) | null = null;

/**
 * Retour de l'application au premier plan : le marqueur de la mémoire est relu, et la mémoire aussi si une
 * synchronisation l'a changée entre-temps. Rien pendant une ouverture ou une relecture, qui le relisent elles-mêmes.
 */
const checkSyncMarker = async (): Promise<void> => {
  const f = lib.folder;
  if (!f || libraryState().status !== 'ready' || lib.refreshing) return;
  await syncWatch.check(folderId(f), () => f.readText(MARKER_FILE));
};

/** Refus du dossier mémoire de l'ancienne application choisi comme mémoire : ses sessions entrent par l'import. */
export const LEGACY_FOLDER_REFUSAL = t("Ce dossier est celui de l'autre application : ajoutez ses sessions par « Ajouter les sessions d'un dossier ».");

/**
 * Vrai pour le dossier mémoire de l'ancienne application : son marqueur, sans celui de Gtracker. Il n'est pas ouvert
 * comme mémoire, et rien n'y est écrit (ni marqueur, ni mode d'emploi). Marqueur non lu : dossier ordinaire. La mémoire
 * du navigateur n'est jamais refusée : seul un dossier choisi l'est.
 */
const isLegacyMemory = async (f: MemoryFolder): Promise<boolean> =>
  (await f.readText(LEGACY_MARKER_FILE).catch(() => null)) !== null && (await f.readText(MARKER_FILE).catch(() => null)) === null;

/** Contrôle d'un dossier désigné (`FolderCheck`) : fait avant que le choix ne soit gardé, le dossier gardé reste celui d'avant. */
const legacyFolderCheck = async (f: MemoryFolder): Promise<string | null> => ((await isLegacyMemory(f)) ? LEGACY_FOLDER_REFUSAL : null);

/**
 * Marqueur écrit s'il manque, et complété de l'identifiant de cet appareil s'il ne le porte pas : l'ordinateur qui
 * synchronise ce dossier y reconnaît le fichier de réglages propre au téléphone (`readMarkerDevice`). Mode d'emploi
 * récrit s'il manque ou a changé. Rien en lecture seule.
 */
const ensureLayout = async (f: MemoryFolder): Promise<void> => {
  if (f.readOnly) return;
  const read = await f.readText(MARKER_FILE);
  const marker = read ?? markerText();
  const text = markerTextWithDevice(marker, deviceId()) ?? (read === null ? marker : null);
  if (text !== null) await f.writeText(MARKER_FILE, text);
  if ((await f.readText(README_FILE)) !== readmeText()) await f.writeText(README_FILE, readmeText());
};

/**
 * Met un dossier en service. Rend vrai si des réglages du dossier ont
 * remplacé ceux de l'appareil. Seule la lecture de `sessions/` est
 * indispensable : marqueur, réglages et sessions en attente, s'ils échouent,
 * sont dits, et l'ouverture continue ; une fiche qu'on ne peut lire laisse
 * sa session en lecture seule (`NOT_READ_RECORD_WARNING`). Un dossier d'une
 * disposition plus récente est ouvert en lecture seule (`guardedFolder`). Dossier
 * fermé ou remplacé pendant la lecture de son marqueur : il n'est pas ouvert.
 */
const attach = async (opened: MemoryFolder): Promise<boolean> => {
  lib.generation += 1;
  cancelCacheUpdate();
  const gen = lib.generation;
  const { folder: f, marker } = await guardedFolder(opened);
  if (gen !== lib.generation) return false;
  // Fiches pas écrites de l'ancien dossier : mises de côté, pour le report dans un dossier désigné (`carryUnwritten`).
  holdUnwritten();
  lib.folder = f;
  syncWatch.note(folderId(f), marker);
  sessionDraftStore.enterMemory(folderId(f));
  lib.all = [];
  lib.publishPending = false;
  lib.knownNames = new Set();
  refreshFailed.clear();
  lib.diskStamps = new Map();
  recordEdits.clear();
  setState({
    status: 'opening',
    folderKind: f.kind,
    folderLabel: f.label,
    memoryReadOnly: f.readOnly === true,
    reason: null,
    sessions: [],
    duplicates: [],
    unreadable: [],
    tooLarge: [],
    scanning: null,
    toUpdate: 0,
    error: null,
  });
  try {
    await ensureLayout(f);
  } catch (err) {
    reportError(t('Marqueur du dossier non écrit : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }));
  }
  const settingsChanged = await syncSettingsSafely(f);
  noteSettingsGestures(settingsChanged);
  const jobs = await scan(f, gen);
  if (gen !== lib.generation) return settingsChanged;
  setState({ status: 'ready' });
  // Programme Windows : la corbeille perd ce qu'elle garde depuis plus de 30 jours ; sans effet ailleurs.
  void startTrash(f);
  // `sessions/` lu en entier : les brouillons faits dans cette mémoire, dont elle ne porte plus la session, sont jetés.
  // Jamais avant (une session pas encore lue n'est pas une session supprimée), jamais ceux d'une autre mémoire (un
  // dossier désigné à l'instant ne porte pas encore les sessions recopiées), et aucun si le dossier est vide (mal ouvert ?).
  if (lib.knownNames.size > 0) sessionDraftStore.keepOnly(folderId(f), lib.knownNames);
  // Le balayage d'abord : une session en attente déjà rangée, mais coupée avant sa fiche, est retrouvée
  // (`scanCompletion`, attendu par `addGpx`) au lieu d'être rangée une seconde fois sous un autre nom.
  void completeScan(f, gen, jobs).catch((err) =>
    setState({ scanning: null, toUpdate: 0, error: t('Lecture du dossier interrompue : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }) })
  );
  await flushPending();
  return settingsChanged;
};

const detach = (status: 'needs-permission' | 'unavailable', label: string | null, reason: string | null): void => {
  lib.generation += 1;
  cancelCacheUpdate();
  // Accès perdu (« needs-permission ») ou dossier inutilisable : les fiches pas écrites attendent le dossier désigné ensuite.
  holdUnwritten();
  lib.folder = null;
  sessionDraftStore.enterMemory(null);
  lib.all = [];
  lib.publishPending = false;
  lib.knownNames = new Set();
  forgetSettingsEntries();
  refreshFailed.clear();
  lib.diskStamps = new Map();
  recordEdits.clear();
  setState({
    status,
    folderKind: null,
    folderLabel: label,
    memoryReadOnly: false,
    reason,
    sessions: [],
    duplicates: [],
    unreadable: [],
    tooLarge: [],
    scanning: null,
    toUpdate: 0,
    settingsFiles: [],
    settingsOffer: null,
  });
  void reloadTrash();
};

/**
 * Remise à zéro : la mémoire cesse tout ce qu'elle fait (balayage, résumés, écritures différées des fiches, cache
 * des fiches), comme si elle quittait son dossier, mais le dossier reste désigné et la liste affichée telle quelle
 * jusqu'au rechargement. Rend le dossier qu'elle tenait, `null` s'il n'y en avait aucun. Une remise à zéro
 * interrompue rouvre la mémoire (`openLibrary`).
 */
export const stopForReset = (): MemoryFolder | null => {
  const f = lib.folder;
  lib.generation += 1;
  cancelCacheUpdate();
  [...recordTimers.keys()].forEach(cancelRecordWrite);
  lib.folder = null;
  lib.publishPending = false;
  return f;
};

/**
 * Stockage de l'appareil illisible au démarrage (`storageStartupFailure`) : les réglages touchés valent par
 * défaut, en mémoire seulement. Dit dès l'interface affichée, et redit après l'ouverture de la mémoire, qui
 * efface les erreurs précédentes.
 */
const reportStorageStartupFailure = (): void => {
  const failure = storageStartupFailure();
  if (!failure) return;
  reportError(failure.all
    ? t("Réglages de l'appareil illisibles au démarrage : les réglages par défaut valent jusqu'à la fermeture, et les changements faits d'ici là ne seront pas gardés. Relancez l'application")
    : t("Une partie des réglages de l'appareil n'a pas pu être lue au démarrage : elle vaut par défaut jusqu'à la fermeture, et ses changements ne seront pas gardés. Relancez l'application"));
};

/**
 * Ouvre la mémoire : le dossier choisi s'il est accessible, sinon celle du
 * navigateur. À lancer au démarrage, avant le premier rendu si possible : les
 * réglages repris du dossier sont alors en place pour les pages.
 */
export const openLibrary = (): Promise<void> => {
  // Première comparaison de l'appareil posée tout de suite, sur ses réglages d'avant : une mise à jour des pré-réglages,
  // faite au démarrage sans attendre une ouverture lente, y reste un geste au lieu de devenir la référence.
  if (readGestures() === null) noteSettingsGestures();
  lib.opening = (async () => {
    setState({ status: 'opening' });
    const access = await openMemoryFolder();
    if (access.state === 'ready') {
      const settingsChanged = await attach(access.folder);
      if (access.notice) reportError(access.notice);
      if (libraryUiStarted()) reportStorageStartupFailure();
      await applySettingsChange(settingsChanged);
      return;
    }
    detach(
      access.state,
      access.state === 'needs-permission' ? access.label : null,
      access.state === 'unavailable' ? access.reason : null
    );
    await countPending();
  })().catch((err) => {
    detach('unavailable', null, errorMessage(err, t('Ouverture de la mémoire impossible.')));
  });
  return lib.opening;
};

/**
 * À appeler une fois l'interface affichée. `isBusy` dit si un rechargement
 * interromprait quelque chose (un enregistrement).
 */
export const startLibraryUi = (isBusy: () => boolean): void => {
  watchDeviceSettings(isBusy);
  reportStorageStartupFailure();
  // Un réglage que l'appareil refuse de garder vaut jusqu'à la fermeture : dit une fois par lancement.
  let storageFailureShown = false;
  jsonStore.subscribeFailure(() => {
    if (storageFailureShown) return;
    storageFailureShown = true;
    reportError(t("Stockage de l'appareil plein ou bloqué : les derniers changements de réglages valent jusqu'à la fermeture de l'application, sans être gardés"));
  });
  // Écritures différées vidées dès que l'application passe en arrière-plan ; au retour, le marqueur dit si une
  // synchronisation a changé la mémoire entre-temps.
  const flushAll = () => void flushWrites();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
    else void checkSyncMarker();
  });
  // Application restée à l'écran pendant une synchronisation par le câble : le marqueur est aussi relu à rythme lent.
  stopMarkerPolling?.();
  stopMarkerPolling = pollWhileVisible(() => void checkSyncMarker(), {
    visible: () => document.visibilityState === 'visible',
    subscribe: (listener) => {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  });
  window.addEventListener('pagehide', flushAll);
};

/**
 * Juste avant que l'application se ferme (touche retour sur le Profil, croix du programme Windows) : écrit tout
 * de suite ce qui attendait son délai (fiches, réglages, cache), attend les écritures de fiche déjà en vol, puis
 * les brouillons et les clés de l'appareil. Ne lève pas : un échec est déjà dit, et la fermeture continue.
 */
export const flushBeforeExit = async (): Promise<void> => {
  await flushWrites().catch(() => undefined);
  await settleRecordWrites();
  sessionDraftStore.flush();
  await settleStoredWrites().catch(() => undefined);
};

/** Vrai si l'on peut désigner un vrai dossier comme mémoire (Chrome et Edge sur ordinateur). */
export const canChooseMemoryFolder = canChooseFolder;

/**
 * Désigne un dossier comme mémoire, depuis un clic. Les sessions de la
 * mémoire du navigateur y sont recopiées ; les changements qu'on n'avait pas
 * pu écrire dans l'ancien dossier sont reportés dans le nouveau. Dans le programme Windows, `desktop` dit
 * comment le désigner : le dossier proposé (« Utiliser ce dossier »), ou la fenêtre de Windows ouverte sur Documents
 * ou sur le dossier retenu ; la mémoire du navigateur du programme n'y est pas recopiée.
 */
export const chooseFolder = async (desktop: DesktopChoiceStart = 'window'): Promise<void> => {
  let picked: MemoryFolder | null;
  try {
    // Dossier de l'ancienne application : refusé avant d'être gardé ni écrit, la mémoire en service reste en place.
    picked = await chooseMemoryFolder(legacyFolderCheck, desktop);
  } catch (err) {
    setState({ error: err instanceof FolderRefusedError ? err.message : t('Dossier inaccessible : {detail}', { detail: nativeErrorMessage(err, t('erreur inconnue')) }) });
    return;
  }
  if (!picked) return;
  const previous = lib.folder;
  // Les saisies en attente partent dans l'ancienne mémoire avant qu'on la quitte.
  await flushWrites();
  const carried = takeUnwritten();
  const previousSessions = previous?.kind === 'browser' ? [...lib.all] : [];
  let settingsChanged: boolean;
  try {
    settingsChanged = await attach(picked);
  } catch (err) {
    detach('unavailable', picked.label, t('Dossier inutilisable : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }));
    await carryUnwritten(carried);
    return;
  }

  // Dossier en lecture seule, ou remplacé pendant son ouverture : rien n'y entre, les sessions restent dans la mémoire du navigateur.
  const target = writableFolder();
  if (previous && previousSessions.length > 0 && target && folderId(target) === folderId(picked)) {
    let copied = 0;
    for (const session of previousSessions) {
      try {
        const text = await previous.readText(sessionPath(session.file));
        if (text === null) continue;
        const motion = await previous.readBytes(sessionPath(imuFileName(session.file)));
        const result = await addGpx(text, session.record.source, { ...await recordToCopy(previous, session), motion: motion ?? undefined });
        if (result.status === 'added') copied += 1;
      } catch (err) {
        reportError(t('{file} non recopiée dans le dossier : {detail}', { file: session.file, detail: errorMessage(err, t('erreur inconnue')) }));
      }
    }
    if (copied > 0) {
      setState({ message: tn(copied, '{n} session de la mémoire du navigateur recopiée dans le dossier.', '{n} sessions de la mémoire du navigateur recopiées dans le dossier.') });
    }
  }
  // Après la recopie : une session de la mémoire du navigateur que le dossier n'avait pas y est maintenant.
  await carryUnwritten(carried);
  await applySettingsChange(settingsChanged);
};

/** Redonne l'autorisation au dossier choisi, depuis un clic. */
export const reconnectFolder = async (): Promise<void> => {
  let f: MemoryFolder | null;
  try {
    // Sur le téléphone, désigner de nouveau, c'est choisir : le dossier de l'ancienne application y est refusé de même.
    f = await reconnectMemoryFolder(legacyFolderCheck);
  } catch (err) {
    if (err instanceof FolderRefusedError) {
      // Dossier écarté (sous-dossier d'une mémoire, dossier de l'ancienne application) : la mémoire gardée est rouverte.
      // Dans le navigateur, le dossier retenu écarté a été oublié : c'est celle du navigateur. Sur le téléphone, le
      // dossier désigné n'a pas été gardé : c'est celui d'avant, qui attend encore sa permission, ou aucun.
      const carried = takeUnwritten();
      await openLibrary();
      setState({ error: err.message });
      await carryUnwritten(carried);
      return;
    }
    if (isDesktopApp()) {
      // Programme Windows : la carte suit l'état relu du dossier retenu (toujours introuvable, illisible, ou oublié).
      const carried = takeUnwritten();
      await openLibrary();
      await carryUnwritten(carried);
    }
    setState({ error: t('Dossier inaccessible : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }) });
    return;
  }
  if (!f) {
    setState({ error: t('Autorisation refusée : le dossier reste inaccessible.') });
    return;
  }
  // Sur le téléphone, le dossier est désigné de nouveau : les changements pas encore écrits y sont reportés,
  // même mis de côté quand l'accès a été perdu (`detach` en « needs-permission »).
  const carried = takeUnwritten();
  let settingsChanged = false;
  try {
    settingsChanged = await attach(f);
  } catch (err) {
    detach('unavailable', f.label, t('Dossier inutilisable : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }));
  }
  await carryUnwritten(carried);
  await applySettingsChange(settingsChanged);
};

/** Oublie le dossier choisi et revient à la mémoire du navigateur, où sont reportés les changements pas encore écrits. */
export const switchToBrowserMemory = async (): Promise<void> => {
  await flushWrites();
  const carried = takeUnwritten();
  await forgetChosenFolder();
  await openLibrary();
  await carryUnwritten(carried);
};

/**
 * Relit le dossier mémoire sans le refermer (« Mettre à jour ») : sessions et
 * itinéraires copiés depuis un autre appareil, réglages plus récents (qui
 * rechargent la page, comme au lancement). La liste reste affichée pendant la
 * relecture ; les écritures en attente partent d'abord, celles qui avaient
 * échoué comprises, pour qu'une fiche modifiée ne soit pas remplacée par
 * celle du disque (une fiche toujours pas écrite garde sa version en mémoire,
 * et son erreur reste dite). Le compte rendu dit combien de sessions sont
 * apparues.
 */
export const refreshLibrary = (): Promise<void> => {
  if (lib.refreshing) return lib.refreshing;
  const scanned = (async () => {
    await lib.opening;
    const f = lib.folder;
    if (!f || libraryState().status !== 'ready') return null;
    setState({ refreshing: true, message: null, error: null });
    // Balayage en cours : ce qu'il n'a pas encore publié compte parmi les sessions d'avant.
    if (lib.publishPending) publish();
    const before = new Set(libraryState().sessions.map((s) => s.record.summary.startMs));
    // Une saisie faite à partir d'ici garde sa version en mémoire (`keptInMemory`).
    const editsBefore = lib.editCount;
    await flushWrites();
    lib.generation += 1;
    cancelCacheUpdate();
    const gen = lib.generation;
    // Relecture voulue : les résumés qu'on n'avait pas su refaire sont retentés.
    refreshFailed.clear();
    // Ce que dit le marqueur avant la relecture : une synchronisation que la relecture couvre ne la relance pas.
    const marker = await f.readText(MARKER_FILE).catch(() => undefined);
    if (marker !== undefined) syncWatch.note(folderId(f), marker);
    const settingsChanged = await syncSettingsSafely(f);
    noteSettingsGestures(settingsChanged);
    const jobs = await scan(f, gen, editsBefore);
    if (gen !== lib.generation) return null;
    setState({ revision: libraryState().revision + 1 });
    void reloadTrash();
    // Le balayage avant les sessions en attente, comme à l'ouverture (`attach`) ; son échec est dit plus bas.
    const completion = completeScan(f, gen, jobs);
    completion.catch(() => undefined);
    await flushPending();
    return { gen, completion, before, settingsChanged };
  })();
  // Les écritures (enregistrement, import) attendent la lecture du dossier, pas le calcul des fiches.
  lib.opening = scanned.then(() => undefined, () => undefined);
  lib.refreshing = scanned
    .then(async (read) => {
      if (!read) return;
      await read.completion;
      if (read.gen !== lib.generation) return;
      const after = new Set(libraryState().sessions.map((s) => s.record.summary.startMs));
      setState({ message: describeRefresh(read.before, after) });
      await applySettingsChange(read.settingsChanged);
    })
    .catch((err: unknown) => {
      setState({ scanning: null, toUpdate: 0, error: t('Relecture du dossier impossible : {detail}', { detail: errorMessage(err, t('erreur inconnue')) }) });
    })
    .finally(() => {
      lib.refreshing = null;
      setState({ refreshing: false });
    });
  return lib.refreshing;
};

/**
 * Dossier mémoire en service, une fois l'ouverture en cours terminée ; `null`
 * s'il n'y en a aucun d'accessible. Pour ce qui se range à côté des sessions :
 * les itinéraires (`useRouteLibrary`).
 */
export const currentMemoryFolder = async (): Promise<MemoryFolder | null> => {
  await lib.opening;
  return lib.folder;
};
