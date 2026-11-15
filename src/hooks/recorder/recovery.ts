import { errorMessage } from '../../core/basics';
import type { Activity } from '../../core/activities';
import { t } from '../../core/i18n';
import { marksWithin } from '../../core/sessionMarks';
import { DEFAULT_RECORDING, getSportProfile } from '../../core/sportProfiles';
import type { SportType } from '../../core/types';
import { disarmBeltWatch, disarmGpsWatch, getBeeper } from '../../platform/beeper';
import { recordingJournal } from '../../platform/files';
import { RECORDING_BELT_HOLDER, adoptBelt, releaseOrphanedBelt } from '../../platform/heartRate';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { adoptRunningService, deviceLocationSource, stopOrphanedDeviceLocation, type LocationSource } from '../../platform/location';
import {
  continueMotionCapture, findMotionCapture, motionCapturePath, pauseMotionCapture, resumeMotionCapture, runningMotionCapture,
  stopMotionCapture, type MotionSetup,
} from '../../platform/motion';
import { readRecoveryServices, type RecoveryServices } from '../../platform/recovery';
import { START_GPS_WATCH, beltWatchSettings, gpsWatchOnFix, gpsWatchOnPause } from '../../recording/gpsWatch';
import { journalActivity, parseJournal, type ParsedJournal } from '../../recording/journal';
import {
  NO_RECOVERY_SERVICES, rebuildRecordingStats, recoveryDecision, resumedPhase, type RecoveryJournal,
} from '../../recording/resume';
import { EMPTY_RECORDING_STATS, splitIntoSegments } from '../../recording/session';
import { effectiveRecordingProfile, readStoredActivities } from '../useSportSettings';
import { dropJournalLines, queueJournalLines } from './journalBuffer';
import { buildPendingSession, onSourceError, receiveFix, resetSession } from './live';
import {
  CAPTURE_NOT_RESUMED, SENSORS_PAUSE_ERROR, SENSORS_RESUME_ERROR, isBusy, isCommandRunning, joinMessages, runCommand, session, setState,
  state,
} from './store';
import {
  applyBeltWatch, applyGpsWatch, releaseRecordingBelt, rememberRecordingBelt, stopGpsWatch, takeBeltOrWarn, watch, wireBelt,
} from './watches';

/**
 * Récupération d'un enregistrement que l'application n'a pas vu se conclure : relecture du journal, reprise
 * silencieuse quand le service GPS a survécu, sinon session remise en attente, ou journal mis de côté.
 */

/**
 * Ce qu'est devenu le journal laissé par une session interrompue :
 * `free` : rien à reprendre, ou session remise en attente ; `setAside` :
 * journal illisible (ou session impossible à reconstruire) mis de côté, et
 * dit ; `blocked` : journal illisible resté en place, qu'aucun départ ne doit
 * écraser.
 */
type JournalRecovery = 'free' | 'setAside' | 'blocked';

/**
 * Met de côté le journal d'une session interrompue qui ne se reprend pas,
 * sous un autre nom dans le dossier privé de l'application, et le dit : un
 * nouvel enregistrement peut démarrer sans l'écraser. `why` : ce qui n'a pas
 * marché, en clair.
 */
const setJournalAside = async (why: string): Promise<JournalRecovery> => {
  try {
    const name = await recordingJournal.setAside();
    setState({ error: t('{why} : son journal est gardé de côté sur le téléphone ({name}), un nouvel enregistrement peut démarrer.', { why, name }) });
    return 'setAside';
  } catch (err) {
    setState({
      error: t(
        "{why}, et son journal n'a pas pu être mis de côté ({detail}) : aucun enregistrement ne démarre, pour ne pas l'écraser. Relancez l'application.",
        { why, detail: errorMessage(err, t('erreur inconnue')) },
      ),
    });
    return 'blocked';
  }
};

/** Calcul et activité d'un journal relu : une activité choisie en cours de route prime sur celle du départ ; `null` sans calcul lisible. */
const journalSession = (parsed: ParsedJournal): { sport: SportType; activity: Activity } | null => {
  const sport = parsed.activityChange?.sport ?? parsed.header?.sport ?? null;
  if (sport === null) return null;
  return { sport, activity: journalActivity(sport, parsed.activityChange?.activity ?? parsed.header?.activity, readStoredActivities()) };
};

/** Ce que `recoveryDecision` lit d'un journal, et le délai de l'offre de « Continuer ». */
const recoveryFactsOf = (parsed: ParsedJournal): { journal: RecoveryJournal; offerMaxAgeS: number } => {
  const session = journalSession(parsed);
  return {
    journal: {
      hasHeader: parsed.header !== null,
      stopped: parsed.stoppedAtMs !== null,
      lastLineMs: parsed.lastLineMs,
    },
    offerMaxAgeS: (session ? effectiveRecordingProfile(session.activity) : DEFAULT_RECORDING).resumeOfferMaxAgeS,
  };
};

/** Arrête ce qui peut tourner encore sans personne pour l'écouter : GPS, ceinture, minuteurs des veilles et bips d'approche. */
const stopOrphans = async (): Promise<void> => {
  await stopOrphanedDeviceLocation();
  await releaseOrphanedBelt();
  await disarmGpsWatch().catch(() => {});
  await disarmBeltWatch().catch(() => {});
  await getBeeper().stop().catch(() => {});
};

/**
 * Relance la capture d'une session reprise après une coupure, quand elle ne tourne plus : son fichier est complété
 * (`continueMotionCapture`). `paused` : la session est en pause manuelle, la capture aussi. Un échec est ajouté aux
 * messages déjà là, et la reprise continue sans elle.
 */
export const continueCapture = async (setup: MotionSetup, paused: boolean): Promise<void> => {
  try {
    await continueMotionCapture(session.startedAtMs, setup);
  } catch (err) {
    // Ce qui a été mesuré avant la coupure reste dans son fichier, retrouvé à l'arrêt ; sans fichier, rien ne l'a été.
    const kept = await findMotionCapture(session.startedAtMs).catch(() => null);
    const why = kept ? CAPTURE_NOT_RESUMED
      : t("Mesure des capteurs impossible : {detail}. L'enregistrement continue sans elle.", { detail: nativeErrorMessage(err, t('erreur inconnue')) });
    setState({ error: joinMessages(state.error, why) });
    return;
  }
  setState({ measuringMotion: true, motionSetup: setup });
  if (paused) await pauseMotionCapture().catch(() => setState({ error: joinMessages(state.error, SENSORS_PAUSE_ERROR) }));
};

/**
 * Vrai si la ceinture mesurait avant la coupure : des positions du journal portent sa FC, et l'utilisateur n'a
 * pas cessé de la chercher en route.
 */
const beltMeasuredBeforeCut = (parsed: ParsedJournal): boolean =>
  !parsed.beltStopped && parsed.fixes.some((fix) => fix.heartRateBpm !== undefined);

/**
 * Veille d'une ceinture redemandée après une coupure, à appeler juste après `takeBeltOrWarn`. Si elle mesurait
 * avant la coupure, elle est veillée comme déjà jointe : sans mesure pendant `beltLostDelayS`, l'alerte de FC perdue
 * part, son compris, et l'enregistrement continue. Sinon, la règle d'un départ : rien avant sa première mesure.
 * `paused` : la session est en pause manuelle, la veille attend la reprise manuelle.
 */
export const watchResumedBelt = (parsed: ParsedJournal, paused: boolean): void => {
  if (!watch.beltOn || session.currentProfile === null) return;
  if (beltMeasuredBeforeCut(parsed)) {
    const armed = gpsWatchOnFix(watch.belt, Date.now(), beltWatchSettings(session.currentProfile));
    applyBeltWatch(paused ? gpsWatchOnPause(armed.state) : armed);
  } else if (paused) {
    applyBeltWatch(gpsWatchOnPause(watch.belt));
  }
};

/** Remet l'enregistreur au repos, sans rien écrire : une reprise qui n'a pas abouti laisse son journal intact. */
export const abandonResume = async (): Promise<void> => {
  const stop = session.stopSource;
  session.stopSource = null;
  await stop?.().catch(() => undefined);
  releaseRecordingBelt();
  stopGpsWatch();
  session.currentSource = null;
  session.currentProfile = null;
  session.resumedSession = false;
  session.fixes = [];
  session.segmentBreaks = [];
  session.pauseFixes = [];
  dropJournalLines();
  session.marks = [];
  setState({
    status: 'idle', resuming: false, sport: null, activity: null, sourceLabel: null, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks: [], stats: EMPTY_RECORDING_STATS, gpsLost: false, beltLost: false,
    beltAside: null, beltRetrying: false,
  });
};

/**
 * Remet en mémoire la session d'un journal relu et passe en `starting`, `resuming` : les abonnés rejouent leurs
 * guidages sur ces positions. Le journal n'est jamais récrit, seulement complété, et le saut de ligne d'abord écrit
 * le protège d'une dernière ligne tronquée par la coupure ; la dernière position fait écarter ses redélivrances.
 */
export const restoreFromJournal = (parsed: ParsedJournal, activity: Activity, source: LocationSource | null): void => {
  resetSession({ source, profile: effectiveRecordingProfile(activity), startedAtMs: parsed.header?.startedAtMs ?? Date.now() });
  session.fixes = parsed.fixes;
  session.segmentBreaks = parsed.breaks;
  queueJournalLines('\n');
  session.lastReceivedFix = session.fixes[session.fixes.length - 1] ?? null;
  session.lastReceivedMs = session.lastReceivedFix?.timeMs ?? null;
  // Un repère posé avant la position suivante suit le temps écoulé depuis la dernière, trou compris.
  session.lastReceivedAtMs = session.lastReceivedFix?.timeMs ?? null;
  session.marks = parsed.marks;
  session.resumedSession = true;
  const stats = rebuildRecordingStats(session.fixes, parsed.manualBreaks.map((b) => ({ index: b.fixIndex, autoPartMs: b.autoPartMs })));
  setState({
    status: 'starting', resuming: true, sport: activity.base, activity, sourceLabel: source?.label ?? null, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks: session.marks, stats, pending: null, motionUnreadable: false, saved: null, error: null, gpsLost: false, beltLost: false,
    beltAside: null, beltRetrying: false,
  });
};

/**
 * Reprise silencieuse : le service a survécu à la chute du moteur de la page. Rien n'est relancé ni récrit : capture,
 * ceinture et GPS sont rebranchés tels qu'ils tournent (une ceinture que le téléphone ne tient plus est redemandée,
 * une capture qui ne tourne plus est relancée en complétant son fichier),
 * la session reprend où le journal l'a laissée (pause manuelle comprise), et le point suivant ouvre un segment. Faux,
 * enregistreur au repos et journal intact, si un maillon manque.
 */
const resumeSilently = async (parsed: ParsedJournal, activity: Activity): Promise<boolean> => {
  const sport = activity.base;
  try {
    restoreFromJournal(parsed, activity, deviceLocationSource());
    const phase = resumedPhase(parsed);
    session.pendingBreak = phase.pendingBreak;
    session.manualBreakAutoPartMs = phase.manualBreakAutoPartMs;
    // Capteurs et ceinture ne valent pas la trace : leur lecture en échec ne fait pas renoncer à la reprise.
    const capture = await runningMotionCapture().catch(() => null);
    const ours = capture?.path === motionCapturePath(session.startedAtMs) ? capture : null;
    // Celle d'une autre session n'a rien à faire là.
    if (capture && !ours) await stopMotionCapture().catch(() => null);
    else if (ours) {
      setState({ measuringMotion: true, motionSetup: ours.setup });
      // Un ordre de pause ou de reprise perdu avec la page : la capture suit la session.
      if (phase.pauseClock !== null && ours.listening) await pauseMotionCapture().catch(() => setState({ error: SENSORS_PAUSE_ERROR }));
      if (phase.pauseClock === null && !ours.listening) await resumeMotionCapture().catch(() => setState({ error: SENSORS_RESUME_ERROR }));
    }
    const beltMaxAgeS = getSportProfile(sport).heartRate.maxAgeS;
    // Retenue pour « Réessayer » et « Reprendre la ceinture », même cessée d'être cherchée en route.
    if (parsed.header?.belt) rememberRecordingBelt(parsed.header.belt, beltMaxAgeS, parsed.beltStopped);
    const release = await adoptBelt(RECORDING_BELT_HOLDER).catch(() => null);
    if (release) wireBelt(release, beltMaxAgeS);
    // Le téléphone ne tient plus la liaison (greffon neuf) : la ceinture du départ est redemandée, sauf si
    // l'utilisateur a cessé de la chercher en route. Un refus est dit, et la reprise continue sans elle.
    else if (parsed.header?.belt && !parsed.beltStopped) await takeBeltOrWarn(parsed.header.belt, beltMaxAgeS);
    // La capture du départ ne tourne plus (fermée avec l'activité) : relancée en complétant son fichier, après la
    // ceinture, dont le refus remplace les messages. Un journal d'avant, qui ne la porte pas, la laisse arrêtée.
    if (!ours && parsed.header?.motion) await continueCapture(parsed.header.motion, phase.pauseClock !== null);
    // Sans attente jusqu'au passage en enregistrement : aucune position ne peut arriver d'ici là, ni être mal jugée.
    session.stopSource = adoptRunningService(receiveFix, onSourceError);
    setState({
      status: phase.pauseClock ? 'paused' : 'recording', resuming: false, landOnRecording: true,
      pausedReason: phase.pauseClock ? 'manual' : null, pauseClock: phase.pauseClock,
    });
    if (watch.gpsOn && session.currentProfile) {
      // Rien n'est dû avant une position, mais le service peut se taire dès maintenant : le minuteur repart d'ici.
      const armedStep = gpsWatchOnFix(START_GPS_WATCH, Date.now(), session.currentProfile);
      applyGpsWatch(phase.pauseClock ? gpsWatchOnPause(armedStep.state) : armedStep);
    }
    if (release && watch.beltOn && session.currentProfile) {
      // Comme le GPS : le minuteur de la page tombée est repris par une veille qui saura lire son échéance.
      const armedBelt = gpsWatchOnFix(START_GPS_WATCH, Date.now(), beltWatchSettings(session.currentProfile));
      applyBeltWatch(phase.pauseClock ? gpsWatchOnPause(armedBelt.state) : armedBelt);
    } else {
      // Une ceinture redemandée est veillée dès maintenant si elle mesurait avant la coupure, sinon dès sa première
      // mesure ; jamais pendant la pause manuelle : sa veille l'attend, et la reprise manuelle la rend.
      watchResumedBelt(parsed, phase.pauseClock !== null);
    }
    console.info(`[reprise] enregistrement repris seul après une chute du moteur : ${session.fixes.length} points relus`);
    return true;
  } catch (err) {
    console.warn(`[reprise] impossible, la session retourne en attente : ${errorMessage(err, 'erreur inconnue')}`);
    await abandonResume();
    return false;
  }
};

/**
 * La reprise tient la place des commandes, comme un départ : « Arrêter » attend sa fin (`afterCurrent`), pour trouver la
 * session reprise, journal et service rebranchés ; une pause ou un second départ sont ignorés (`exclusive`). Appelée
 * depuis un départ, qui tient déjà cette place, elle ne la reprend pas : il la rendrait trop tôt.
 */
const resumeHoldingCommands = async (parsed: ParsedJournal, activity: Activity): Promise<boolean> => {
  if (isCommandRunning()) return resumeSilently(parsed, activity);
  let resumed = false;
  await runCommand(async () => {
    resumed = await resumeSilently(parsed, activity);
  });
  return resumed;
};

/** Reprise en cours : un départ qui arrive pendant celle du lancement l'attend, au lieu de la doubler. */
let recovering: Promise<JournalRecovery> | null = null;

const recoverOnce = async (): Promise<JournalRecovery> => {
  if (isBusy() || state.pending) return 'free';
  const services: RecoveryServices = await readRecoveryServices();
  let text: string | null;
  try {
    text = await recordingJournal.read();
  } catch (err) {
    await stopOrphans();
    return setJournalAside(t('Session interrompue illisible ({detail})', { detail: errorMessage(err, t('erreur inconnue')) }));
  }
  const nowMs = Date.now();
  if (text === null) {
    // Un service sans journal : rien à reprendre (recherche de position coupée par une chute, par exemple).
    if (recoveryDecision({ journal: null, services, nowMs, offerMaxAgeS: 0 }) === 'stopServices') await stopOrphans();
    return 'free';
  }
  const parsed = parseJournal(text);
  const session = journalSession(parsed);
  const facts = recoveryFactsOf(parsed);
  if (recoveryDecision({ ...facts, services, nowMs }) === 'resume' && session && await resumeHoldingCommands(parsed, session.activity)) return 'free';
  await stopOrphans();
  // Capture restée ouverte après un rechargement de la page : fermée, elle attend avec la session.
  const orphan = await stopMotionCapture().catch(() => null);
  const { header, fixes: list, breaks } = parsed;
  try {
    // Ni en-tête ni changement lisibles : aucun calcul deviné, la session sera rangée « à classer ».
    // Repères : du démarrage à la fin ; une note posée en pause manuelle, après la dernière position, est gardée.
    const fromMs = header?.startedAtMs ?? list[0]?.timeMs ?? 0;
    const recoveredMarks = marksWithin(parsed.marks, fromMs, Infinity);
    const motion = header ? (orphan?.path.endsWith(`/${header.startedAtMs}.imu`) ? orphan : await findMotionCapture(header.startedAtMs)) : null;
    const pending = await buildPendingSession(session?.activity ?? null, splitIntoSegments(list, breaks), true, recoveredMarks, motion);
    // Services arrêtés à présent : seul l'âge du journal décide, reprise échouée comprise.
    const canContinue = recoveryDecision({ ...facts, services: NO_RECOVERY_SERVICES, nowMs }) === 'offer';
    // « Continuer l'enregistrement » est sur la page Enregistrer : y mener, sinon l'offre reste invisible depuis l'accueil.
    if (pending) setState({ pending: { ...pending, canContinue }, saved: null, error: null, landOnRecording: canContinue });
    return 'free';
  } catch (err) {
    return setJournalAside(t('Session interrompue non récupérée ({detail})', { detail: errorMessage(err, t('erreur inconnue')) }));
  }
};

/**
 * Reprend un enregistrement que l'application n'a pas vu se conclure : relit le journal et, selon les services
 * encore vivants et son âge (`recoveryDecision`), reprend la session seule, ou la remet en attente, avec ou sans
 * « Continuer ». À appeler au démarrage de l'application. Un journal présent mais illisible, ou dont la session ne
 * se reconstruit pas, n'est jamais pris pour absent : il est mis de côté (`setJournalAside`), jamais écrasé par le
 * départ suivant. Seule exception, un journal lu qui a moins de deux positions (en-tête lisible ou non) : aucune
 * trace ne s'en tire, il est effacé sans rien dire (`buildPendingSession`), comme à l'arrêt. Idempotent : un second
 * appel pendant le premier le rejoint.
 */
export const recoverInterruptedRecording = (): Promise<JournalRecovery> => {
  recovering ??= recoverOnce().finally(() => {
    recovering = null;
  });
  return recovering;
};
