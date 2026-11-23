import { activityDisplayName, type Activity } from '../../core/activities';
import { t } from '../../core/i18n';
import type { SessionMark } from '../../core/sessionMarks';
import { getSportProfile, guardMovingSpeedMs, type RecordingProfile } from '../../core/sportProfiles';
import { recordingJournal } from '../../platform/files';
import { latestHeartRate } from '../../platform/heartRate';
import { clearLoggedFixes, type LocationErrorCause, type LocationFix, type LocationSource, type LocationWatchOptions } from '../../platform/location';
import { removeMotionCapture, type MotionCapture } from '../../platform/motion';
import { gpsWatchOnFix, watchesGps } from '../../recording/gpsWatch';
import { judgeSettle } from '../../recording/gpsSettle';
import { heartRateAt } from '../../recording/heartRate';
import { journalBreakLine, journalFixLine, journalResumeLine } from '../../recording/journal';
import { sessionGpx } from '../../recording/resume';
import {
  addFixAfterManualPause, addFixToStats, evaluateAutoPause, isNewerFix, receivedFixRole, roundFix,
} from '../../recording/session';
import { flushJournal, journalFlushDue, queueJournalLines, resetJournalBuffer } from './journalBuffer';
import { fixListeners, pausePositionListeners, session, setState, state, type PendingSession } from './store';
import { applyGpsWatch, GPS_LOST_ERROR, startGpsWatchFor, watch, withoutGpsLost } from './watches';

/**
 * Session en cours : sa remise au départ, la réception des positions de la source (veille du GPS, pause
 * automatique, positions gardées et journal) et la construction du GPX à l'arrêt.
 */

/** Échec dit par la source : son message remplace l'alerte, et la localisation coupée est retenue pour la page. */
export const onSourceError = (message: string, cause?: LocationErrorCause): void => {
  session.sourceError = message;
  setState({ error: message, locationOff: cause === 'locationOff' });
};

/**
 * Localisation du téléphone rendue, dite par la source : l'alerte rouge et son message s'effacent. Avant toute
 * position, la page revient à l'attente ordinaire de la première (`awaitingFix`, gardé depuis le départ) ; après,
 * la veille du GPS reprend son cours. Sans effet si la localisation n'était pas dite coupée.
 */
export const onSourceLocationOn = (): void => {
  if (!state.locationOff) return;
  // « GPS perdu », ajouté entre-temps par la veille, reste affiché : seule la position suivante le lève. Une autre
  // alerte, venue après celle de la source, n'est pas touchée.
  if (session.sourceError !== null && withoutGpsLost(state.error) === session.sourceError) {
    setState({ error: state.gpsLost ? GPS_LOST_ERROR : null });
  }
  session.sourceError = null;
  setState({ locationOff: false });
};

/**
 * Reprise d'une pause manuelle : le prochain point gardé ouvre un segment et ne compte pas la pause dans la durée.
 * Rend l'heure de la ligne écrite au journal : c'est elle que le service du téléphone doit recevoir avec l'ordre.
 */
export const markManualResume = (): number => {
  session.pendingBreak = true;
  const clock = state.pauseClock;
  session.manualBreakAutoPartMs = clock?.frozenAtMs != null ? Math.max(0, clock.frozenAtMs - clock.sinceMs) : 0;
  // Écrit tout de suite : une reprise après une chute doit savoir la pause levée, même sans point gardé depuis.
  const atMs = Date.now();
  queueJournalLines(journalResumeLine(atMs));
  void flushJournal();
  return atMs;
};

/**
 * Dit au service du téléphone la pause manuelle ouverte ou levée, à l'heure de la ligne du journal. Sans objet pour
 * une source qui n'est pas ce service. Un ordre perdu ne coûte que la veille du GPS, application fermée : les
 * positions restent gardées par le journal de la page, qui fait foi.
 */
export const tellSourcePaused = async (paused: boolean, atMs: number): Promise<void> => {
  try {
    await session.currentSource?.setPaused?.(paused, atMs);
  } catch (err) {
    console.warn(`Pause non transmise au service de position : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
  }
};

/**
 * Garde une position : un nouveau segment s'ouvre après une pause, la
 * position va au journal, les statistiques suivent, et le journal s'écrit par
 * paquets.
 */
const keepPoint = (fix: LocationFix, journalFlushS: number): void => {
  if (session.pendingBreak) {
    session.segmentBreaks.push(session.fixes.length);
    queueJournalLines(journalBreakLine(fix.timeMs));
    session.pendingBreak = false;
    // Premier point gardé après une pause manuelle : la carte reprend la trace, ses positions de pause ne servent plus.
    session.pauseFixes = [];
  }
  session.fixes.push(fix);
  queueJournalLines(journalFixLine(fix));
  const afterManualPause = session.manualBreakAutoPartMs !== null;
  setState({ stats: afterManualPause ? addFixAfterManualPause(state.stats, fix, session.manualBreakAutoPartMs ?? 0) : addFixToStats(state.stats, fix) });
  session.manualBreakAutoPartMs = null;
  if (journalFlushDue(fix.timeMs, journalFlushS)) {
    void flushJournal();
  }
};

/**
 * Calage du GPS au départ (`judgeSettle`), tant qu'aucune position n'est gardée : vrai si la position n'est pas encore
 * calée. Elle ne sert alors qu'à la carte du direct (`settlingFix`), comme une position de pause manuelle : ni journal
 * de la page, ni statistiques, ni pause automatique. La première jugée calée clôt le calage pour la session.
 */
const stillSettling = (fix: LocationFix): boolean => {
  if (session.settled) return false;
  if (session.fixes.length > 0) {
    session.settled = true;
    return false;
  }
  const verdict = judgeSettle(session.settleFirstMs, fix);
  if (!verdict.settled) {
    session.settleFirstMs = verdict.firstSeenMs;
    session.settlingFix = fix;
    setState({ settlingAccuracyM: fix.accuracyM ?? null });
    return true;
  }
  session.settled = true;
  session.settleFirstMs = null;
  session.settlingFix = null;
  if (state.settlingAccuracyM !== null) setState({ settlingAccuracyM: null });
  return false;
};

/** Reçoit une position de la source. Le réglage est relu à chaque fois : l'activité peut changer en route. */
export const receiveFix = (received: LocationFix): void => {
  const role = receivedFixRole(state);
  const recording = session.currentProfile;
  if (role === 'ignore' || recording === null) return;
  if (!isNewerFix(session.lastReceivedMs, received)) return;
  // Une position est venue, pause manuelle comprise : plus d'attente, et la localisation est rallumée.
  if (state.awaitingFix || state.locationOff) setState({ awaitingFix: false, locationOff: false });
  // Veille du GPS, hors pause manuelle : le minuteur est repoussé, ou l'alerte de perte s'efface (avant les abonnés :
  // le guidage des balises reprend son rythme à cette position).
  if (role === 'evaluate' && watch.gpsOn) applyGpsWatch(gpsWatchOnFix(watch.gps, Date.now(), recording));
  // La source envoie de nouveau : son erreur, encore affichée, n'a plus lieu d'être.
  if (session.sourceError !== null) {
    if (state.error === session.sourceError) setState({ error: null });
    session.sourceError = null;
  }
  // Comparée à l'heure de réception, pas à celle de la position : la même horloge que la ceinture, et un rejeu marche aussi.
  const heartRateBpm = session.heartRateMaxAgeS === null ? undefined : heartRateAt(latestHeartRate(), Date.now(), session.heartRateMaxAgeS);
  const fix = roundFix(heartRateBpm === undefined ? received : { ...received, heartRateBpm });
  session.lastReceivedMs = fix.timeMs;
  session.lastReceivedFix = fix;
  session.lastReceivedAtMs = Date.now();
  if (role === 'show') {
    // Pause manuelle : le GPS reste allumé pour la carte du direct seule ; rien n'est gardé, compté ni évalué (la
    // reprise reste manuelle), et les abonnés aux positions (notification, guidage, test) n'en voient rien.
    session.pauseFixes.push(fix);
    pausePositionListeners.notify();
    return;
  }
  fixListeners.notify(fix);
  if (stillSettling(fix)) return;

  const auto = evaluateAutoPause(state.status === 'paused', session.belowSinceMs, fix, {
    speedMs: recording.autoPauseSpeedMs,
    delayS: recording.autoPauseDelayS,
  });
  session.belowSinceMs = auto.belowSinceMs;
  if (auto.event === 'pause') {
    setState({ status: 'paused', pausedReason: 'auto', pauseClock: { sinceMs: Date.now(), frozenAtMs: null } });
    void flushJournal();
    return;
  }
  if (auto.event === 'resume') {
    session.pendingBreak = true;
    setState({ status: 'recording', pausedReason: null, pauseClock: null });
  }
  if (state.status === 'paused') return;
  keepPoint(fix, recording.journalFlushS);
};

/**
 * Construit le GPX de segments, sans le ranger : le journal reste jusqu'au
 * rangement de la session, ou à son rejet. Rend `null`, journal effacé, s'il y a moins de
 * deux positions au total : aucune trace ne s'en tire, il n'y a rien à garder.
 */
export const buildPendingSession = async (
  activity: Activity | null,
  segments: LocationFix[][],
  recovered: boolean,
  marks: SessionMark[],
  motion: MotionCapture | null
): Promise<PendingSession | null> => {
  const gpx = sessionGpx(segments, activity);
  if (gpx === null) {
    await recordingJournal.remove();
    await clearLoggedFixes();
    if (motion) await removeMotionCapture(motion.path);
    return null;
  }
  return { ...gpx, sport: activity?.base ?? null, activity, recovered, canContinue: false, marks, motion };
};

/**
 * Options de démarrage d'une source, communes au premier démarrage, à « Continuer » et à une reprise manuelle. Pour
 * le service du téléphone : la session en cours (`session.startedAtMs`, celui de l'en-tête du journal), ses textes
 * quand l'application est fermée, et les délais de sa veille du GPS et de sa garde, ceux du profil. La veille n'y
 * tourne que si la page veille aussi (`watchesGps`). La vraie vitesse de la garde est celle du calcul de l'activité
 * (`guardMovingSpeedMs`), sans mise à l'échelle par l'allure : rien ne la connaît encore au départ.
 */
export const sourceOptions = (activity: Activity, recording: RecordingProfile): LocationWatchOptions => ({
  intervalMs: recording.intervalMs,
  distanceFilterM: recording.distanceFilterM,
  notificationTitle: t('Gtracker enregistre'),
  notificationText: t('Session {name} en cours', { name: activityDisplayName(activity) }),
  service: {
    session: session.startedAtMs,
    closedText: t("Application fermée : l'enregistrement continue"),
    gpsLostTitle: t('GPS perdu'),
    stoppedTitle: t('Enregistrement arrêté'),
    stoppedText: t('Touchez pour le ranger'),
    gpsLostDelayS: watchesGps(recording, true) ? recording.gpsLostDelayS : 0,
    gpsLostRearmS: recording.gpsLostRearmS,
    guardStillRadiusM: recording.guardStillRadiusM,
    guardStillDelayS: recording.guardStillDelayS,
    guardMaxClosedS: recording.guardMaxClosedS,
    guardMovingSpeedMs: guardMovingSpeedMs(getSportProfile(activity.base)),
    guardMovingHoldS: recording.guardMovingHoldS,
  },
});

/** Variables de la session qui démarre, ou qui reprend d'un journal relu, remises au départ. */
export const resetSession = (init: { source: LocationSource | null; profile: RecordingProfile; startedAtMs: number }): void => {
  session.fixes = [];
  session.segmentBreaks = [];
  resetJournalBuffer();
  session.currentSource = init.source;
  session.currentProfile = init.profile;
  session.lastReceivedMs = null;
  session.lastReceivedFix = null;
  session.lastReceivedAtMs = null;
  session.belowSinceMs = null;
  session.pendingBreak = false;
  session.manualBreakAutoPartMs = null;
  session.resumedSession = false;
  session.pauseFixes = [];
  session.settled = false;
  session.settleFirstMs = null;
  session.settlingFix = null;
  session.startedAtMs = init.startedAtMs;
  session.marks = [];
  session.sourceError = null;
  session.recordingBelt = null;
  session.beltError = null;
  startGpsWatchFor(init.profile);
};
