import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Activity } from '../core/activities';
import type { SessionMark } from '../core/sessionMarks';
import { getSportProfile } from '../core/sportProfiles';
import { effectiveFoil, effectiveHeartRate, effectiveRecordingProfile, rememberRecordActivity } from './useSportSettings';
import { recordingJournal } from '../platform/files';
import { nativeErrorMessage } from '../platform/nativeMessages';
import { readPermissions } from '../platform/permissions';
import {
  findMotionCapture, pauseMotionCapture, readMotionCapture, removeMotionCapture, resumeMotionCapture, startMotionCapture, stopMotionCapture,
  type MotionCapture, type MotionSetup,
} from '../platform/motion';
import { savedBelt, type HeartRateBelt } from '../platform/heartRate';
import type { LocationFix, LocationSource } from '../platform/location';
import { beltWatchSettings, gpsWatchOnPause, gpsWatchOnResume } from '../recording/gpsWatch';
import { headingFixes, shownLiveFix } from '../recording/livePosition';
import {
  journalActivityLine, journalBeltLine, journalHeaderLine, journalNoteLine, journalPauseLine, journalResumeLine, journalStopLine, parseJournal,
  type ParsedJournal,
} from '../recording/journal';
import { continuedPause } from '../recording/resume';
import {
  isAutoPause, isManualPause, EMPTY_RECORDING_STATS, displayedDurationMs, nothingToKeep, segmentCount, splitIntoSegments, type PauseClock,
} from '../recording/session';
import { saveRecordedSession } from './useSessionLibrary';
import {
  CAPTURE_NOT_RESUMED, SENSORS_PAUSE_ERROR, SENSORS_RESUME_ERROR, afterCurrent, exclusive, isBusy, joinMessages, pausePositionListeners, session,
  setState, state, subscribe, type PendingSession, type RecorderState, type RecorderStatus, type SavedSession,
} from './recorder/store';
import { flushJournal, queueJournalLines } from './recorder/journalBuffer';
import {
  applyBeltWatch, applyGpsWatch, releaseRecordingBelt, stopBeltWatch, stopGpsWatch, takeBeltOrWarn, watch, withoutBeltLost, withoutGpsLost,
} from './recorder/watches';
import { buildPendingSession, markManualResume, onSourceError, receiveFix, resetSession, sourceOptions } from './recorder/live';
import { abandonResume, continueCapture, recoverInterruptedRecording, restoreFromJournal, watchResumedBelt } from './recorder/recovery';

export type { RecorderState, RecorderStatus } from './recorder/store';
export { getRecorderState, subscribeToFixes, subscribeToRecorder } from './recorder/store';
export {
  BELT_LOST_ERROR, GPS_LOST_ERROR, openRecordingLocationSettings, retakeRecordingBelt, retryRecordingBelt, retryRecordingGps, stopRecordingBeltSearch,
} from './recorder/watches';
export { recoverInterruptedRecording };

/**
 * Enregistreur de session. Il vit hors des composants, dans ce module : on
 * peut changer de page pendant un enregistrement sans l'interrompre. Les
 * pages le lisent par `useRecorderSelector` et le pilotent par `startRecording`,
 * `stopRecording`, `pauseRecording`/`resumeRecording` (pause manuelle),
 * `changeRecordingActivity`, `finishPendingSession`, `analyzePendingSession`/`discardPendingSession`
 * et `recoverInterruptedRecording`. Le guidage vers les balises
 * (`useMarkGuide`), hors React lui aussi, s'abonne aux positions reçues
 * (`subscribeToFixes`) et à l'état (`subscribeToRecorder`). Les repères du
 * bouton « Note » (`addRecordingMark`) sont écrits dans le journal et rangés
 * avec la session. La mesure des sauts,
 * demandée au départ, fait capter accéléromètre et gyroscope par le
 * téléphone (`platform/motion.ts`) ; la capture suit la pause manuelle et se
 * range à côté du GPX (`.imu`). La ceinture cardio, demandée au départ, est
 * tenue jusqu'à l'arrêt (`platform/heartRate.ts`) : sa dernière mesure est
 * jointe à chaque position reçue, donc au journal et au GPX (`gpxtpx:hr`).
 *
 * Chaîne : chaque position reçue est arrondie (`roundFix`), gardée en mémoire
 * et ajoutée au journal, écrit par paquets à l'arrivée des positions
 * (`shouldFlushJournal`). À l'arrêt, le GPX est construit depuis la mémoire,
 * un `<trkseg>` par segment continu (`splitIntoSegments`), et la session
 * passe en attente (`pending`), puis se range seule dans la bibliothèque
 * (`finishPendingSession`, appelé par l'application, qui ouvre ensuite son
 * analyse) ; on la jette depuis l'analyse. Si le rangement échoue,
 * elle reste en attente : « Analyser » réessaie, « Jeter » l'abandonne. Tant
 * qu'elle attend, le journal est gardé : après un arrêt brutal ou une
 * fermeture, la session est reconstruite depuis lui au démarrage suivant, et
 * attend de nouveau. Le journal n'est effacé qu'une fois le GPX écrit, ou la
 * session jetée.
 *
 * Deux pauses : manuelle (rien n'est gardé, la source GPS reste allumée pour
 * la carte du direct, reprise explicite) et automatique (immobilité
 * prolongée, détectée par `evaluateAutoPause` — la source reste active pour
 * détecter la reprise du mouvement). Les deux ouvrent un nouveau segment à la
 * reprise.
 *
 * Veille du GPS : passé `gpsLostDelayS` sans position, hors pause
 * manuelle, le GPS est dit perdu (`gpsLost`, alerte `GPS_LOST_ERROR`, son et
 * notification), une fois par perte ; tout s'efface à la position suivante.
 * La machine est `recording/gpsWatch.ts`, le minuteur natif (`armGpsWatch`).
 *
 * Veille de la ceinture : la même machine, passé `beltLostDelayS` sans
 * mesure lisible d'une ceinture qui en donnait, hors pause manuelle (`beltLost`,
 * alerte `BELT_LOST_ERROR`, son et notification), une fois par perte. Une
 * ceinture redemandée après une coupure, qui mesurait avant, est veillée dès
 * la reprise (`watchResumedBelt`), sans attendre sa première mesure.
 *
 * Reprise : si le moteur de la page tombe, seule la page repart (`MainActivity.java`).
 * Le service GPS encore vivant, la session reprend seule (`resumeSilently`) : mémoire refaite depuis le journal, jamais
 * d'en-tête de plus, service jamais relancé, un segment neuf à la position suivante. Application tuée et rouverte peu
 * après : « Continuer l'enregistrement » dans la carte de la session en attente (`continuePendingSession`).
 *
 * Toute session a des positions. Un journal sans position est mis de côté (`setJournalAside`) ; ses lignes de FC
 * seule sont ignorées.
 */

/** Notifications refusées au départ d'un enregistrement : ajouté une fois à l'alerte. */
const NOTIFICATIONS_OFF_WARNING = t("Notifications refusées : rien ne s'affichera sur l'écran verrouillé pendant l'enregistrement (Réglages › Autorisations).");

/** Au départ : des notifications refusées sont dites une fois, dans l'alerte de la page. */
const warnIfNotificationsOff = async (): Promise<void> => {
  const permissions = await readPermissions().catch(() => null);
  const refused = permissions?.notifications === 'denied' || permissions?.notifications === 'prompt';
  if (!refused || state.status === 'idle' || state.status === 'stopping') return;
  setState({ error: state.error ? `${state.error} ${NOTIFICATIONS_OFF_WARNING}` : NOTIFICATIONS_OFF_WARNING });
};


/**
 * Capture là mais illisible : rien n'est effacé, la session reste en attente, et ceci le dit. Une capture
 * qui ne se lirait jamais bloquerait la session : d'où « Analyser sans les capteurs ».
 */
const MOTION_UNREADABLE_MESSAGE = t(
  "Les mesures des capteurs de cette session n'ont pas pu être lues. La session reste en attente et rien n'est effacé : réessayez « Analyser », ou « Analyser sans les capteurs » pour la ranger sans sauts ni pumping, le fichier des mesures restant sur l'appareil.",
);

/**
 * Range la session en attente dans la bibliothèque, puis efface le journal et
 * la capture. Rend la session rangée, ou `null` si l'écriture du GPX échoue :
 * la session reste alors en attente, journal compris. Le GPX écrit, la session
 * est rangée même si le ménage qui suit échoue (journal ou capture restés sur
 * l'appareil) : c'est dit, sans la remettre en attente. Une capture
 * absente : la session est rangée sans elle. Une capture qui existe mais ne se
 * lit pas : la session reste en attente, rien n'est effacé (`motionUnreadable`).
 * `withoutMotion` (« Analyser sans les capteurs », après cet échec) : la
 * session est rangée sans la capture, qui reste sur l'appareil. `kept` : le
 * message à laisser affiché une fois la session rangée (avertissements de
 * l'arrêt, montrés par l'analyse ouverte), `null` pour l'effacer.
 */
const rangePendingSession = async (pending: PendingSession, withoutMotion: boolean, kept: string | null): Promise<SavedSession | null> => {
  let motion: Uint8Array | null = null;
  if (pending.motion && !withoutMotion) {
    try {
      motion = await readMotionCapture(pending.motion.path);
    } catch (err) {
      console.warn(`Capture illisible : ${errorMessage(err, 'erreur inconnue')}`);
      setState({ motionUnreadable: true, error: MOTION_UNREADABLE_MESSAGE });
      return null;
    }
  }
  let stored: { file: string | null; location: string };
  try {
    // Le foil de l'activité au moment du rangement, qui suit l'arrêt : celui de la sortie, sauf pour une
    // session reprise d'un journal après une coupure, rangée à la réouverture avec le réglage de ce moment.
    const foil = pending.activity ? effectiveFoil(pending.activity) : null;
    stored = await saveRecordedSession(pending.content, pending.sport, pending.activity?.id ?? null, motion, pending.marks, foil);
  } catch (err) {
    setState({ error: t('Enregistrement du GPX impossible : {why}. La session reste en attente.', { why: errorMessage(err, t('erreur inconnue')) }) });
    return null;
  }
  // Le GPX est rangé : un ménage en échec ne remet pas la session en attente, il est dit. Un journal resté là est
  // repris au démarrage suivant et retrouve la session déjà dans la mémoire, sans la doubler.
  let cleanup: string | null = null;
  try {
    await recordingJournal.remove();
    if (pending.motion && !withoutMotion) await removeMotionCapture(pending.motion.path);
  } catch (err) {
    cleanup = t("Session rangée ; le journal d'enregistrement n'a pas pu être effacé ({why}).", { why: errorMessage(err, t('erreur inconnue')) });
  }
  const saved: SavedSession = { ...pending, fileName: stored.file ?? pending.fileName, libraryFile: stored.file, location: stored.location };
  setState({ pending: null, motionUnreadable: false, saved, resultOpened: false, error: joinMessages(kept, cleanup) });
  return saved;
};

/** Rangement en cours (`RecorderState.analyzing`), rendu à qui le redemande ; `null` sinon. */
let ranging: Promise<SavedSession | null> | null = null;

/** Lance le rangement (`rangePendingSession`), ou rend celui qui tourne ; `kept` comme pour lui. */
const startRanging = (withoutMotion: boolean, kept: string | null): Promise<SavedSession | null> => {
  if (ranging) return ranging;
  const pending = state.pending;
  if (!pending) return Promise.resolve(null);
  setState({ analyzing: true });
  const run = rangePendingSession(pending, withoutMotion, kept).finally(() => {
    ranging = null;
    setState({ analyzing: false });
  });
  ranging = run;
  return run;
};

/**
 * « Analyser » de la carte de la session en attente : lance son rangement (`rangePendingSession`). Il appartient au
 * module, pas à la page, qu'on peut quitter et rouvrir pendant le calcul : un second appel pendant qu'il
 * tourne rend la même promesse, sans en lancer un autre, même avec un autre `withoutMotion`. `analyzing` retombe à
 * sa fin, réussie ou non. Rangée, la session n'a plus de message, hors ménage en échec.
 */
export const analyzePendingSession = (withoutMotion = false): Promise<SavedSession | null> => startRanging(withoutMotion, null);

/** Dernière session en attente dont le rangement seul a été lancé (`finishPendingSession`) : jamais deux fois. */
let finishTried: PendingSession | null = null;

/**
 * Vrai si la session en attente va être rangée seule (`finishPendingSession`) ou l'est en ce moment : la page
 * Enregistrer montre « Rangement… » au lieu de sa carte. Faux pour une session qui attend un choix (« Continuer »
 * possible, ou rangement seul déjà tenté et en échec).
 */
export const finishingPendingSession = (s: RecorderState): boolean =>
  s.analyzing || (s.pending !== null && !s.pending.canContinue && finishTried !== s.pending);

/**
 * Fin d'un enregistrement : range seule la session en attente, sans attendre « Analyser », une seule fois
 * par session ; en échec, elle reste en attente avec son message, et la carte de la page Enregistrer sert de filet
 * (« Analyser » pour réessayer, « Jeter »). Rien pendant un rangement déjà lancé, ni pour une session reprise après
 * une coupure qui peut encore continuer (`canContinue` : la carte garde « Continuer l'enregistrement »). Les
 * avertissements de l'arrêt (capteurs…) restent affichés, pour l'analyse ouverte. Rend la session rangée, ou `null`.
 */
export const finishPendingSession = (): Promise<SavedSession | null> => {
  const pending = state.pending;
  if (!pending || ranging || pending.canContinue || finishTried === pending) return Promise.resolve(null);
  finishTried = pending;
  return startRanging(false, state.error);
};

/**
 * « Jeter » de la carte de la session en attente : l'abandonne et efface son journal et sa capture ; sans effet
 * pendant son rangement. Un effacement en échec garde la session en attente, et le dit.
 */
export const discardPendingSession = async (): Promise<void> => {
  const pending = state.pending;
  if (!pending || ranging) return;
  try {
    await recordingJournal.remove();
    if (pending.motion) await removeMotionCapture(pending.motion.path);
  } catch (err) {
    setState({ error: t("La session n'a pas pu être jetée : {why}.", { why: errorMessage(err, t('erreur inconnue')) }) });
    return;
  }
  setState({ pending: null, motionUnreadable: false, error: null });
};

/** Vrai tant qu'un enregistrement est en cours : la touche retour ne doit pas fermer l'application. */
export const isRecordingActive = (): boolean => isBusy();

/** L'application est revenue sur Enregistrer après une reprise silencieuse. */
export const acknowledgeRecordingLanding = (): void => {
  if (state.landOnRecording) setState({ landOnRecording: false });
};

/**
 * Démarre un enregistrement. `motion` : capter l'accéléromètre et le gyroscope
 * (sauts, pumping en surf), avec l'emplacement du téléphone et le foil ; si les capteurs ne démarrent pas, l'enregistrement
 * continue sans eux, et le dit. `heartRate` : la ceinture cardio à joindre ; de même, sans elle si elle ne répond pas.
 * Un calcul sans position est refusé.
 */
export const startRecording = exclusive(async (
  activity: Activity,
  source: LocationSource | null,
  options: { motion?: MotionSetup | null; heartRate?: HeartRateBelt | null } = {}
): Promise<void> => {
  if (isBusy()) return;
  const sport = activity.base;
  if (source === null) return;
  const recovery = await recoverInterruptedRecording();
  // La session d'un journal a repris seule : pas de second départ.
  if (isBusy()) return;
  // Le journal d'une session en attente serait écrasé : elle doit être rangée ou jetée d'abord.
  if (state.pending) return;
  // Journal illisible resté en place : pas de départ, qui l'écraserait ; le message est déjà posé.
  if (recovery === 'blocked') return;
  // Journal mis de côté à l'instant : son message reste affiché au départ.
  const recoveryNotice = recovery === 'setAside' ? state.error : null;

  const profile = effectiveRecordingProfile(activity);
  resetSession({ source, profile, startedAtMs: Date.now() });
  setState({
    status: 'starting', sport, activity, sourceLabel: source.label, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks: session.marks, stats: EMPTY_RECORDING_STATS,
    saved: null, error: recoveryNotice, gpsLost: false, awaitingFix: true, locationOff: false, gpsRetrying: false, beltLost: false,
    beltAside: null, beltRetrying: false,
  });

  try {
    // La ceinture et la capture du départ sont gardées dans l'en-tête : ce sont elles que « Continuer » et la reprise
    // seule redemandent.
    await recordingJournal.write(journalHeaderLine(sport, session.startedAtMs, activity, options.heartRate ?? null, options.motion ?? null));
    session.stopSource = await source.start(sourceOptions(activity, profile), receiveFix, onSourceError);
    setState({ status: 'recording' });
  } catch (err) {
    session.stopSource = null;
    stopGpsWatch();
    await recordingJournal.remove();
    setState({ status: 'idle', error: t('Démarrage impossible : {why}', { why: errorMessage(err, t('erreur inconnue')) }) });
    return;
  }
  if (options.motion) {
    try {
      await startMotionCapture(session.startedAtMs, options.motion);
      setState({ measuringMotion: true, motionSetup: options.motion });
    } catch (err) {
      setState({ error: t("Mesure des capteurs impossible : {why}. L'enregistrement continue sans elle.", { why: nativeErrorMessage(err, t('erreur inconnue')) }) });
    }
  }
  if (options.heartRate) await takeBeltOrWarn(options.heartRate, getSportProfile(sport).heartRate.maxAgeS);
  // Après les messages du départ (capteurs, ceinture), pour s'y ajouter sans être effacé par eux.
  void warnIfNotificationsOff();
});

/**
 * « Continuer l'enregistrement » : la session en attente reprend sur son journal, dans un segment neuf, service
 * relancé par ce geste (l'application est au premier plan). Le temps hors de l'application ne compte pas (`continuedPause`).
 * La capture du départ, gardée dans l'en-tête, est relancée en complétant son fichier ; un journal d'avant, qui ne la
 * porte pas, la laisse arrêtée, son fichier retrouvé à l'arrêt. La ceinture du départ est redemandée, et veillée dès ici si elle mesurait avant
 * la coupure : sans mesure pendant une minute, l'alerte de FC perdue part. Un refus de
 * l'une ou de l'autre est dit sans arrêter la reprise. En échec, la session reste en attente et le journal est gardé.
 */
export const continuePendingSession = exclusive(async (source: LocationSource | null): Promise<void> => {
  const before = state.pending;
  if (isBusy() || !before?.canContinue || before.activity === null) return;
  const activity = before.activity;
  if (source === null) return;
  const backToPending = async (why: unknown): Promise<void> => {
    await abandonResume();
    setState({ pending: before, error: t('Reprise impossible : {why}. La session reste en attente.', { why: errorMessage(why, t('erreur inconnue')) }) });
  };
  let parsed: ParsedJournal;
  try {
    const text = await recordingJournal.read();
    if (text === null) throw new Error('journal introuvable');
    parsed = parseJournal(text);
  } catch (err) {
    setState({ error: t('Reprise impossible : {why}. La session reste en attente.', { why: errorMessage(err, t('erreur inconnue')) }) });
    return;
  }
  try {
    const nowMs = Date.now();
    restoreFromJournal(parsed, activity, source);
    const lifted = continuedPause(parsed, nowMs);
    if (lifted.pause) queueJournalLines(journalPauseLine(lifted.pause.atMs, lifted.pause.autoPartMs));
    if (lifted.resumeLine) queueJournalLines(journalResumeLine(nowMs));
    session.pendingBreak = true;
    session.manualBreakAutoPartMs = lifted.autoPartMs;
    // La ceinture du départ, gardée dans l'en-tête, même cessée d'être cherchée en route ; un journal d'avant, qui ne
    // la porte pas, suit le réglage de l'activité.
    const fromHeader = parsed.header?.belt;
    const belt = fromHeader !== undefined ? fromHeader : effectiveHeartRate(activity) ? savedBelt() : null;
    // Redemandée ici : une reprise seule après une nouvelle chute la redemandera aussi.
    if (belt && parsed.beltStopped) queueJournalLines(journalBeltLine(nowMs, 'asked'));
    await flushJournal();
    const heartRate = getSportProfile(activity.base).heartRate;
    session.stopSource = await source.start(sourceOptions(activity, effectiveRecordingProfile(activity)), receiveFix, onSourceError);
    if (belt) {
      await takeBeltOrWarn(belt, heartRate.maxAgeS);
      // `continuedPause` a levé la pause manuelle : une ceinture qui mesurait avant la coupure est veillée dès ici.
      watchResumedBelt(parsed, false);
    }
    // Après la ceinture, dont le refus remplace les messages : celui des capteurs s'y ajoute. `continuedPause` a levé
    // la pause manuelle, la capture reprend donc sa mesure.
    const motion = parsed.header?.motion;
    if (motion) await continueCapture(motion, false);
    else if (motion === undefined && await findMotionCapture(session.startedAtMs).catch(() => null)) {
      setState({ error: joinMessages(state.error, CAPTURE_NOT_RESUMED) });
    }
    setState({ status: 'recording', resuming: false });
  } catch (err) {
    await backToPending(err);
    return;
  }
  void warnIfNotificationsOff();
});

/**
 * Pause manuelle : plus rien n'est gardé ni compté, durée figée. Le GPS reste
 * allumé : la carte du direct suit le coureur
 * qui continue d'avancer, et la reprise ne relance rien (pas de première
 * position périmée). Depuis une pause automatique, la reprise devient manuelle.
 */
export const pauseRecording = exclusive(async (): Promise<void> => {
  const autoPaused = isAutoPause(state);
  if (state.status !== 'recording' && !autoPaused) return;
  // La durée se fige à cet instant ; depuis une pause automatique, celle-ci y reste comptée.
  const frozenAtMs = Date.now();
  const pauseClock: PauseClock = { sinceMs: autoPaused && state.pauseClock ? state.pauseClock.sinceMs : frozenAtMs, frozenAtMs };
  session.belowSinceMs = null;
  // En pause dès l'appui : le GPS restant allumé, une position arrivée pendant l'écriture du journal ne serait pas gardée.
  setState({ status: 'paused', pausedReason: 'manual', pauseClock });
  if (watch.gpsOn) applyGpsWatch(gpsWatchOnPause(watch.gps));
  if (watch.beltOn) applyBeltWatch(gpsWatchOnPause(watch.belt));
  queueJournalLines(journalPauseLine(frozenAtMs, frozenAtMs - pauseClock.sinceMs));
  await flushJournal();
  if (state.measuringMotion) await pauseMotionCapture().catch(() => setState({ error: SENSORS_PAUSE_ERROR }));
});

/** Reprend après une pause manuelle : le prochain point gardé ouvre un nouveau segment. La source n'est relancée que si elle s'est arrêtée. */
export const resumeRecording = exclusive(async (): Promise<void> => {
  if (!isManualPause(state) || state.activity === null || session.currentProfile === null) {
    return;
  }
  session.belowSinceMs = null;
  if (session.stopSource !== null) {
    // Le GPS est resté allumé pendant la pause : la position suivante ouvre le segment. Jusque-là, la carte reste sur
    // la dernière position reçue en pause (`pauseFixes`, vidé au premier point gardé), pas sur le point de la pause.
    markManualResume();
    const sensorsFailed = state.measuringMotion && await resumeMotionCapture().then(() => false, () => true);
    setState({ status: 'recording', pausedReason: null, pauseClock: null, ...(sensorsFailed ? { error: SENSORS_RESUME_ERROR } : {}) });
    if (watch.gpsOn) applyGpsWatch(gpsWatchOnResume(watch.gps, Date.now(), session.currentProfile));
    if (watch.beltOn) applyBeltWatch(gpsWatchOnResume(watch.belt, Date.now(), beltWatchSettings(session.currentProfile)));
    return;
  }
  if (session.currentSource === null) return;
  session.pauseFixes = [];
  const activity = state.activity;
  const source = session.currentSource;
  const profile = session.currentProfile;
  try {
    markManualResume();
    session.sourceError = null;
    session.stopSource = await source.start(sourceOptions(activity, profile), receiveFix, onSourceError);
    const sensorsFailed = state.measuringMotion && await resumeMotionCapture().then(() => false, () => true);
    // L'erreur de la source peut arriver avant la fin du démarrage (localisation coupée) : elle reste affichée.
    setState({ status: 'recording', pausedReason: null, pauseClock: null, error: session.sourceError ?? (sensorsFailed ? SENSORS_RESUME_ERROR : null) });
    if (watch.gpsOn) applyGpsWatch(gpsWatchOnResume(watch.gps, Date.now(), profile));
    if (watch.beltOn) applyBeltWatch(gpsWatchOnResume(watch.belt, Date.now(), beltWatchSettings(profile)));
  } catch (err) {
    session.pendingBreak = false;
    session.manualBreakAutoPartMs = null;
    // Toujours en pause : la levée déjà écrite au journal est démentie.
    const clock = state.pauseClock;
    if (clock?.frozenAtMs != null) queueJournalLines(journalPauseLine(clock.frozenAtMs, clock.frozenAtMs - clock.sinceMs));
    void flushJournal();
    setState({ error: t('Reprise impossible : {why}', { why: errorMessage(err, t('erreur inconnue')) }) });
  }
});

/**
 * Change l'activité de l'enregistrement en cours, d'une famille à l'autre
 * comprise : la session sera rangée sous elle et sous son calcul (nom du
 * fichier, `<type>` du GPX, module qui l'analyse), et la pause automatique
 * suit ses réglages dès la position suivante. Le changement est écrit dans le
 * journal : une session récupérée après un plantage garde l'activité choisie.
 * La source GPS n'est pas relancée (elle garde les réglages du départ),
 * pour ne pas risquer un trou dans la trace. Jamais vers un calcul sans
 * position : la session perdrait sa trace.
 */
export const changeRecordingActivity = (activity: Activity): void => {
  // Pas pendant le démarrage : l'en-tête du journal n'est peut-être pas encore écrit.
  if ((state.status !== 'recording' && state.status !== 'paused') || state.activity?.id === activity.id) return;
  const profile = effectiveRecordingProfile(activity);
  session.currentProfile = profile;
  session.belowSinceMs = null;
  queueJournalLines(journalActivityLine(activity.base, activity));
  const patch: Partial<RecorderState> = { sport: activity.base, activity };
  // En pause automatique, une activité qui n'en a pas ne la lèverait jamais : l'enregistrement reprend.
  if (isAutoPause(state) && profile.autoPauseSpeedMs <= 0) {
    session.pendingBreak = true;
    patch.status = 'recording';
    patch.pausedReason = null;
    patch.pauseClock = null;
  }
  setState(patch);
  rememberRecordActivity(activity.id);
  void flushJournal();
};

/**
 * Bouton « Note » : pose un repère à cet instant, à la dernière position
 * reçue (pause comprise), écrit tout de suite dans le journal. Rend le repère
 * et son numéro, ou `null` hors d'un enregistrement ou sans position encore.
 */
export const addRecordingMark = (): { mark: SessionMark; n: number } | null => {
  if (state.status !== 'recording' && state.status !== 'paused') return null;
  const fix = session.lastReceivedFix ?? getLastFix();
  if (!fix) return null;
  // À l'heure des positions, pas à celle de l'horloge (qui en diffère pendant un rejeu) : celle de la dernière
  // position, plus le temps écoulé depuis sa réception (pause manuelle).
  const sinceFixMs = fix === session.lastReceivedFix && session.lastReceivedAtMs !== null ? Math.max(0, Date.now() - session.lastReceivedAtMs) : 0;
  const mark: SessionMark = { timeMs: fix.timeMs + sinceFixMs, lat: fix.lat, lon: fix.lon, label: null };
  session.marks = [...session.marks, mark];
  setState({ marks: session.marks });
  queueJournalLines(journalNoteLine(mark));
  void flushJournal();
  return { mark, n: session.marks.length };
};

/** Appui long sur le bouton rond : pause manuelle, ou reprise si elle l'est déjà. */
export const togglePauseRecording = (): Promise<void> =>
  isManualPause(state) ? resumeRecording() : pauseRecording();

/**
 * Ce qu'il faut dire à l'arrêt d'une capture des capteurs qui n'a pas tout
 * gardé, en une phrase ; `null` si elle s'est bien passée. `failure` : l'arrêt
 * même a échoué ; `capture` à `null` sans échec : plus rien ne tournait.
 */
export const motionCaptureWarning = (capture: MotionCapture | null, failure: string | null): string | null => {
  if (failure !== null) {
    return t('Capteurs : arrêt impossible ({why}), la session sera rangée sans les mesures des capteurs (sauts ou pumping).', { why: failure });
  }
  if (capture === null) {
    return t("Capteurs : la mesure s'était arrêtée, la session sera rangée sans les mesures des capteurs (sauts ou pumping).");
  }
  if (capture.error !== null) {
    return t('Capteurs : écriture interrompue ({why}), leurs mesures sont incomplètes : sauts ou pumping peuvent manquer.', { why: capture.error });
  }
  // Capture reprise sans mesure depuis sa relance (session en pause, arrêt aussitôt) : celles d'avant la coupure restent.
  if (capture.samples === 0 && capture.earlierMeasures !== true) {
    return t('Capteurs : aucune mesure reçue, la session sera rangée sans les mesures des capteurs (sauts ou pumping).');
  }
  return null;
};

/** Arrête l'enregistrement, après la pause ou la reprise en cours s'il y en a une (`afterCurrent`). */
export const stopRecording = afterCurrent(async (): Promise<void> => {
  if ((state.status !== 'recording' && state.status !== 'paused') || state.activity === null) return;
  const activity = state.activity;
  const stoppedAtMs = Date.now();
  stopGpsWatch();
  stopBeltWatch();
  // Les alertes de perte du GPS et de la FC ne survivent pas à l'enregistrement.
  setState({
    status: 'stopping', gpsLost: false, awaitingFix: false, locationOff: false, gpsRetrying: false, beltLost: false, beltAside: null,
    beltRetrying: false, error: withoutBeltLost(withoutGpsLost(state.error)),
  });
  // Écrit avant de couper le GPS : une chute d'ici la fin ne propose ni reprise ni « Continuer ».
  queueJournalLines(journalStopLine(stoppedAtMs));
  await flushJournal();
  try {
    await session.stopSource?.();
  } catch {
    // La source est peut-être déjà arrêtée (arrêt normal, ou pause manuelle) : on termine quand même.
  }
  session.stopSource = null;
  session.currentSource = null;
  session.currentProfile = null;
  const measuringMotion = state.measuringMotion;
  let motionFailure: string | null = null;
  const motion = measuringMotion
    ? await stopMotionCapture().catch((err: unknown) => {
      motionFailure = errorMessage(err, t('erreur inconnue'));
      return null;
    })
    : null;
  const motionWarning = measuringMotion ? motionCaptureWarning(motion, motionFailure) : null;
  // Session reprise sans capture qui tourne : celle d'avant la coupure, s'il y en a une, reste dans son fichier.
  const keptMotion = measuringMotion ? motion : session.resumedSession ? await findMotionCapture(session.startedAtMs).catch(() => null) : null;
  session.resumedSession = false;
  releaseRecordingBelt();

  try {
    const pending = await buildPendingSession(activity, splitIntoSegments(session.fixes, session.segmentBreaks), false, [...session.marks], keptMotion);
    setState({
      status: 'idle',
      pausedReason: null,
      pauseClock: null,
      measuringMotion: false,
      motionSetup: null,
      heartRate: null,
      marks: [],
      pending,
      error: pending ? joinMessages(state.error, motionWarning) : nothingToKeep(),
    });
  } catch (err) {
    setState({
      status: 'idle',
      pausedReason: null,
      pauseClock: null,
      measuringMotion: false,
      motionSetup: null,
      heartRate: null,
      marks: [],
      error: t('Construction du GPX impossible : {why}. Le journal est gardé et sera repris au prochain démarrage.', { why: errorMessage(err, t('erreur inconnue')) }),
    });
  }
  session.fixes = [];
  session.segmentBreaks = [];
  session.pauseFixes = [];
  session.marks = [];
  session.sourceError = null;
});

/** Trace de l'enregistrement en cours, un tableau par segment continu : la carte et les statistiques en direct. */
export const getLiveSegments = (): LocationFix[][] => (isBusy() ? splitIntoSegments(session.fixes, session.segmentBreaks) : []);

/** Positions de l'enregistrement en cours, toutes pauses confondues, sans recopie : à ne pas modifier. */
export const getLiveFixes = (): ReadonlyArray<LocationFix> => (isBusy() ? session.fixes : []);

/** Dernière position gardée de l'enregistrement en cours. */
export const getLastFix = (): LocationFix | null => (isBusy() && session.fixes.length > 0 ? session.fixes[session.fixes.length - 1] : null);

/** Position de la carte du direct : la dernière gardée, ou en pause manuelle la dernière reçue (`shownLiveFix`). */
export const getLivePosition = (): LocationFix | null => (isBusy() ? shownLiveFix(session.fixes[session.fixes.length - 1] ?? null, session.pauseFixes) : null);

const subscribeToLivePosition = (listener: () => void): (() => void) => {
  const fromState = subscribe(listener);
  const fromPause = pausePositionListeners.subscribe(listener);
  return () => {
    fromState();
    fromPause();
  };
};

/**
 * Position de la carte du direct, pour la carte seule : redessine à chaque position gardée, et en pause
 * manuelle à chaque position reçue ; `null` au repos.
 */
export const useLivePosition = (): LocationFix | null => useSyncExternalStore(subscribeToLivePosition, getLivePosition);

/** Positions d'où la carte tire le cap de sa flèche : en pause manuelle, celles reçues depuis le point de la pause. */
export const getLiveHeadingFixes = (): ReadonlyArray<LocationFix> => (isBusy() ? headingFixes(session.fixes, session.pauseFixes) : []);

/** Nombre de segments de l'enregistrement en cours : la dernière position gardée est dans le dernier. */
export const getLiveSegmentCount = (): number => (isBusy() ? segmentCount(session.fixes.length, session.segmentBreaks) : 0);

/** Efface le compte rendu de la dernière session et le dernier message d'erreur. */
export const dismissRecorderResult = (): void => setState({ saved: null, resultOpened: false, error: null });

/** L'analyse de la session rangée vient d'être ouverte : son message (s'il y en a un) y reste, Enregistrer ne le redit pas. */
export const markRecorderResultOpened = (): void => {
  if (state.saved && !state.resultOpened) setState({ resultOpened: true });
};

/**
 * Une partie de l'état de l'enregistreur : le composant n'est redessiné que si
 * elle change (la page ne suit pas chaque position, seuls ses chiffres).
 * `select` doit rendre une valeur stable pour un même état : une primitive,
 * ou un objet déjà rangé dans l'état, jamais un objet neuf.
 */
export const useRecorderSelector = <T>(select: (s: RecorderState) => T): T => useSyncExternalStore(subscribe, () => select(state));

/** Statut seul de l'enregistreur : ne redessine qu'à son changement, pas à chaque position ni mesure de la ceinture. */
export const useRecorderStatus = (): RecorderStatus => useRecorderSelector((s) => s.status);

/**
 * Horloge de l'enregistrement, pour un composant : l'instant présent et la
 * durée affichée (`displayedDurationMs`). Elle bat chaque seconde seulement
 * quand c'est utile : en pause automatique, où la durée tourne sans position,
 * et quand `clockShown` (chiffre « Heure » affiché) ; sinon le composant est
 * redessiné quand la durée change, à chaque position gardée.
 */
export const useRecordingClock = (clockShown: boolean): { nowMs: number; durationMs: number } => {
  const ticking = useRecorderSelector((s) =>
    s.status !== 'idle' && ((s.pauseClock !== null && s.pauseClock.frozenAtMs === null) || clockShown));
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    const tick = () => setNowMs(Date.now());
    // Tout de suite, puis chaque seconde : l'instant gardé peut dater.
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [ticking]);
  const durationMs = useRecorderSelector((s) => displayedDurationMs(s.stats, s.pauseClock, nowMs));
  return { nowMs, durationMs };
};
