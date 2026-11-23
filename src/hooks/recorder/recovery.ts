import { errorMessage } from '../../core/basics';
import type { Activity } from '../../core/activities';
import { t } from '../../core/i18n';
import { DEFAULT_RECORDING, getSportProfile } from '../../core/sportProfiles';
import { formatTimeOfDay } from '../../core/units';
import type { SportType } from '../../core/types';
import { disarmBeltWatch, disarmGpsWatch, getBeeper } from '../../platform/beeper';
import { recordingJournal } from '../../platform/files';
import { RECORDING_BELT_HOLDER, adoptBelt, releaseOrphanedBelt } from '../../platform/heartRate';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import {
  attachDeviceLocation, clearLoggedFixes, deviceLocationSource, readLoggedFixes, stopOrphanedDeviceLocation, type LocationFix,
  type LocationSource,
} from '../../platform/location';
import {
  continueMotionCapture, findMotionCapture, motionCapturePath, pauseMotionCapture, resumeMotionCapture, runningMotionCapture,
  stopMotionCapture, type MotionSetup,
} from '../../platform/motion';
import { readRecoveryServices, type RecoveryServices } from '../../platform/recovery';
import { START_GPS_WATCH, beltWatchSettings, gpsWatchOnFix, gpsWatchOnPause } from '../../recording/gpsWatch';
import { journalSessionActivity, parseJournal, type ParsedJournal } from '../../recording/journal';
import {
  catchUpFromNativeLog, parseNativeLog, withCaughtUpLines, type CatchUpSettings, type NativeCatchUp, type NativeLog,
} from '../../recording/nativeLog';
import { NO_RECOVERY_SERVICES, journalMarks, rebuildRecordingStats, recoveryDecision, type RecoveryJournal } from '../../recording/resume';
import { JOURNALS_DIR } from '../../library/folderLayout';
import { EMPTY_RECORDING_STATS, isNewerFix, roundFix, splitIntoSegments, type RecordingStats } from '../../recording/session';
import { effectiveRecordingProfile, readStoredActivities } from '../useSportSettings';
import { dropJournalLines, flushJournal, queueJournalLines } from './journalBuffer';
import { buildPendingSession, onSourceError, onSourceLocationOn, receiveFix, resetSession, tellSourcePaused } from './live';
import {
  CAPTURE_NOT_RESUMED, SENSORS_PAUSE_ERROR, SENSORS_RESUME_ERROR, isBusy, isCommandRunning, joinMessages, runCommand, session, setState,
  state, type RecorderState,
} from './store';
import {
  applyBeltWatch, applyGpsWatch, releaseRecordingBelt, rememberRecordingBelt, stopGpsWatch, takeBeltOrWarn, watch, wireBelt,
} from './watches';

/**
 * Récupération d'un enregistrement que l'application n'a pas vu se conclure : relecture du journal, complété de ce
 * que le service de position a reçu sans la page (`catchUpJournal`), reprise silencieuse quand ce service a survécu,
 * sinon session remise en attente, ou journal mis de côté.
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
 * nouvel enregistrement peut démarrer sans l'écraser. Il est retenté au
 * lancement suivant (`hooks/setAsideJournals.ts`), ou copié dans le dossier
 * mémoire s'il reste illisible. `why` : ce qui n'a pas marché, en clair.
 */
const setJournalAside = async (why: string): Promise<JournalRecovery> => {
  try {
    const name = await recordingJournal.setAside();
    setState({
      error: t(
        "{why} : son journal est mis de côté ({name}), un nouvel enregistrement peut démarrer. Il sera repris au prochain lancement de l'application, ou rendu dans le dossier mémoire (sous-dossier {dir}) s'il reste illisible.",
        { why, name, dir: JOURNALS_DIR },
      ),
    });
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

/** Calcul et activité d'un journal relu (`journalSessionActivity`) ; `null` sans calcul lisible. */
const journalSession = (parsed: ParsedJournal): { sport: SportType; activity: Activity } | null => {
  const activity = journalSessionActivity(parsed, readStoredActivities());
  return activity && { sport: activity.base, activity };
};

/** Ce que `recoveryDecision` lit d'un journal, et le délai de l'offre de « Continuer ». */
const recoveryFactsOf = (parsed: ParsedJournal): { journal: RecoveryJournal; offerMaxAgeS: number } => {
  const session = journalSession(parsed);
  return {
    journal: {
      hasHeader: parsed.header !== null,
      startedAtMs: parsed.header?.startedAtMs ?? null,
      stopped: parsed.stoppedAtMs !== null,
      lastLineMs: parsed.lastLineMs,
    },
    offerMaxAgeS: (session ? effectiveRecordingProfile(session.activity) : DEFAULT_RECORDING).resumeOfferMaxAgeS,
  };
};

/** Journal de la page complété de ce que le service a reçu sans elle. */
interface CaughtUpJournal {
  /** Texte du journal tel qu'il est maintenant sur le disque, lignes rattrapées comprises. */
  text: string;
  parsed: ParsedJournal;
  catchUp: NativeCatchUp;
}

/** Réglages du rattrapage : la pause automatique de l'activité, et le trou de trace de son calcul. */
const catchUpSettingsOf = (activity: Activity): CatchUpSettings => {
  const { autoPauseSpeedMs, autoPauseDelayS } = effectiveRecordingProfile(activity);
  return { autoPauseSpeedMs, autoPauseDelayS, maxGapS: getSportProfile(activity.base).maxGapS };
};

/** Sans activité lisible, rien n'est rattrapé : ces réglages ne sont alors lus par personne. */
const NO_CATCH_UP: CatchUpSettings = { autoPauseSpeedMs: 0, autoPauseDelayS: 0, maxGapS: 0 };

const lastFixMsOf = (fixes: ReadonlyArray<LocationFix>): number | null => (fixes.length > 0 ? fixes[fixes.length - 1].timeMs : null);

/**
 * Complète le journal de la page des positions que le service du téléphone a écrites et qu'elle n'a pas : celles
 * reçues application fermée, moteur de rendu tombé, ou messages calés écran éteint. Les lignes sont ajoutées au
 * fichier, puis le journal est relu tel qu'il sera relu plus tard. Sans journal du service (navigateur, autre
 * session, fichier illisible), rien n'est ajouté et la coupure reste une frontière de segment. Rejoué, il n'ajoute
 * plus rien. Une écriture en échec n'est que consignée : la session en mémoire est complète, et le journal du
 * service reste là pour une prochaine fois.
 */
export const catchUpJournal = async (text: string, parsed: ParsedJournal, activity: Activity | null): Promise<CaughtUpJournal> => {
  let log: NativeLog | null = null;
  if (activity !== null && parsed.header !== null) {
    try {
      log = parseNativeLog(await readLoggedFixes(lastFixMsOf(parsed.fixes)));
    } catch (err) {
      console.warn(`[reprise] journal du service illisible : ${errorMessage(err, 'erreur inconnue')}`);
    }
  }
  const catchUp = catchUpFromNativeLog(parsed, log, activity ? catchUpSettingsOf(activity) : NO_CATCH_UP);
  if (catchUp.lines.length === 0) return { text, parsed, catchUp };
  const completed = withCaughtUpLines(text, catchUp.lines);
  try {
    await recordingJournal.append(completed.slice(text.length));
  } catch (err) {
    console.warn(`[reprise] positions rattrapées non écrites au journal : ${errorMessage(err, 'erreur inconnue')}`);
  }
  console.info(`[reprise] ${catchUp.keptCount} positions rattrapées du journal du service`);
  return { text: completed, parsed: parseJournal(completed), catchUp };
};

/**
 * À l'arrêt, service arrêté et son journal fermé : si le service a écrit des positions que la page n'a jamais
 * reçues (messages calés écran éteint), le journal en est complété et la trace entière est rendue, en segments.
 * `null` quand la page a tout reçu, ou que rien ne se rattrape : la trace en mémoire fait alors foi, comme toujours.
 */
export const segmentsCaughtUpAtStop = async (activity: Activity): Promise<LocationFix[][] | null> => {
  try {
    const log = parseNativeLog(await readLoggedFixes(lastFixMsOf(session.fixes)));
    if (log === null || log.session !== session.startedAtMs) return null;
    const receivedMs = session.lastReceivedMs;
    if (!log.entries.some((entry) => entry.kind === 'fix' && isNewerFix(receivedMs, roundFix(entry.fix)))) return null;
    const text = await recordingJournal.read();
    if (text === null) return null;
    const { parsed, catchUp } = await catchUpJournal(text, parseJournal(text), activity);
    // Jamais moins que la mémoire : un journal en retard d'une écriture ne lui fait rien perdre.
    if (catchUp.lines.length === 0 || parsed.fixes.length < session.fixes.length) return null;
    return splitIntoSegments(parsed.fixes, parsed.breaks);
  } catch (err) {
    console.warn(`[arrêt] rattrapage impossible, la trace reçue est gardée : ${errorMessage(err, 'erreur inconnue')}`);
    return null;
  }
};

/**
 * Retient l'heure sous laquelle une position reçue est une redélivrance : la plus tardive de ce que le rattrapage a
 * lu du journal du service, gardé ou non, et de la dernière position gardée. Les positions d'une pause manuelle,
 * que le service a écrites sans que rien n'en soit gardé, ne reviennent ainsi ni par l'écoute ni à l'arrêt.
 */
export const markCaughtUp = (catchUp: NativeCatchUp): void => {
  const known = [catchUp.phase.lastReceivedMs, catchUp.caughtUpToMs, lastFixMsOf(session.fixes)].filter((ms): ms is number => ms !== null);
  session.lastReceivedMs = known.length > 0 ? Math.max(...known) : null;
};

/**
 * Pose dans la session ce que le rattrapage dit de sa suite : frontière de segment à venir, ancre de la pause
 * automatique, heure de la dernière position connue (`markCaughtUp`). Rend la pause en cours, manuelle ou
 * automatique, pour l'état.
 */
const applyCatchUpPhase = (catchUp: NativeCatchUp): Pick<RecorderState, 'pausedReason' | 'pauseClock'> => {
  const { phase } = catchUp;
  session.pendingBreak = phase.pendingBreak;
  session.manualBreakAutoPartMs = phase.manualBreakAutoPartMs;
  session.belowSinceMs = phase.belowSinceMs;
  // Calage du GPS en cours pendant la fermeture : la réception en direct le poursuit depuis la même première position.
  session.settleFirstMs = phase.settleFirstMs;
  markCaughtUp(catchUp);
  if (phase.manualPause) {
    return { pausedReason: 'manual', pauseClock: { sinceMs: phase.manualPause.atMs - phase.manualPause.autoPartMs, frozenAtMs: phase.manualPause.atMs } };
  }
  if (phase.autoPausedSinceMs !== null) return { pausedReason: 'auto', pauseClock: { sinceMs: phase.autoPausedSinceMs, frozenAtMs: null } };
  return { pausedReason: null, pauseClock: null };
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
    beltAside: null, beltRetrying: false, awaitingFix: false, locationOff: false, settlingAccuracyM: null, gpsRetrying: false,
  });
};

/**
 * Positions, segments et repères d'un journal relu, posés dans la session ; rend ses statistiques. Une position
 * rattrapée du journal du service y entre comme les autres : sans fréquence cardiaque, sans bip ni veille.
 */
const loadFromJournal = (parsed: ParsedJournal): RecordingStats => {
  session.fixes = parsed.fixes;
  session.segmentBreaks = parsed.breaks;
  session.lastReceivedFix = session.fixes[session.fixes.length - 1] ?? null;
  session.lastReceivedMs = session.lastReceivedFix?.timeMs ?? null;
  // Un repère posé avant la position suivante suit le temps écoulé depuis la dernière, trou compris.
  session.lastReceivedAtMs = session.lastReceivedFix?.timeMs ?? null;
  session.marks = parsed.marks;
  return rebuildRecordingStats(session.fixes, parsed.manualBreaks.map((b) => ({ index: b.fixIndex, autoPartMs: b.autoPartMs })));
};

/**
 * Remet en mémoire la session d'un journal relu et passe en `starting`, `resuming` : les abonnés rejouent leurs
 * guidages sur ces positions. Le journal n'est jamais récrit, seulement complété, et le saut de ligne d'abord écrit
 * le protège d'une dernière ligne tronquée par la coupure ; la dernière position fait écarter ses redélivrances.
 */
export const restoreFromJournal = (parsed: ParsedJournal, activity: Activity, source: LocationSource | null): void => {
  resetSession({ source, profile: effectiveRecordingProfile(activity), startedAtMs: parsed.header?.startedAtMs ?? Date.now() });
  queueJournalLines('\n');
  const stats = loadFromJournal(parsed);
  session.resumedSession = true;
  setState({
    status: 'starting', resuming: true, sport: activity.base, activity, sourceLabel: source?.label ?? null, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks: session.marks, stats, pending: null, motionUnreadable: false, saved: null, error: null, gpsLost: false, beltLost: false,
    beltAside: null, beltRetrying: false, awaitingFix: true, locationOff: false, settlingAccuracyM: null, gpsRetrying: false,
  });
};

/**
 * Reprise silencieuse : le service de position a survécu à la page (moteur de rendu tombé, application balayée puis
 * rouverte). Il n'est jamais relancé. Le journal est d'abord complété de ce que le service a reçu sans la page : la
 * session revient entière, sans frontière de segment tant que son journal est continu, pauses manuelle et
 * automatique comprises. Capture et ceinture sont rebranchées telles qu'elles tournent (une ceinture que le
 * téléphone ne tient plus est redemandée, une capture qui ne tourne plus est relancée en complétant son fichier).
 * Puis la page écoute de nouveau, en tampon, relit la fin du journal du service, et vide son tampon : une position
 * arrivée pendant cette relecture n'est ni perdue ni doublée. Faux, enregistreur au repos, si un maillon manque : la
 * session passe alors en attente, où le rattrapage est refait.
 */
const resumeSilently = async (text: string, read: ParsedJournal, activity: Activity, services: RecoveryServices): Promise<boolean> => {
  const sport = activity.base;
  try {
    const first = await catchUpJournal(text, read, activity);
    // Arrêté par sa garde entre-temps : plus rien à rejoindre, la session se range.
    if (first.catchUp.guardStop) throw new Error('enregistrement arrêté par la garde du service');
    const parsed = first.parsed;
    restoreFromJournal(parsed, activity, deviceLocationSource());
    // Une pause manuelle ne s'ouvre ni ne se lève sans la page : celle-ci vaut jusqu'au bout de la reprise.
    const manualPaused = applyCatchUpPhase(first.catchUp).pausedReason === 'manual';
    // Capteurs et ceinture ne valent pas la trace : leur lecture en échec ne fait pas renoncer à la reprise.
    const capture = await runningMotionCapture().catch(() => null);
    const ours = capture?.path === motionCapturePath(session.startedAtMs) ? capture : null;
    // Celle d'une autre session n'a rien à faire là.
    if (capture && !ours) await stopMotionCapture().catch(() => null);
    else if (ours) {
      setState({ measuringMotion: true, motionSetup: ours.setup });
      // Un ordre de pause ou de reprise perdu avec la page : la capture suit la session.
      if (manualPaused && ours.listening) await pauseMotionCapture().catch(() => setState({ error: SENSORS_PAUSE_ERROR }));
      if (!manualPaused && !ours.listening) await resumeMotionCapture().catch(() => setState({ error: SENSORS_RESUME_ERROR }));
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
    if (!ours && parsed.header?.motion) await continueCapture(parsed.header.motion, manualPaused);
    // La page écoute de nouveau : le service la sait revenue. Ses positions attendent dans un tampon, le temps de
    // relire ce qu'il a écrit pendant que capteurs et ceinture se rebranchaient.
    const buffered: LocationFix[] = [];
    let live = false;
    session.stopSource = await attachDeviceLocation((fix) => {
      if (live) receiveFix(fix);
      else buffered.push(fix);
    }, onSourceError, onSourceLocationOn);
    // Le journal est relu tel qu'il est sur le disque, lignes de la ceinture comprises.
    await flushJournal();
    const textNow = (await recordingJournal.read()) ?? first.text;
    const second = await catchUpJournal(textNow, parseJournal(textNow), activity);
    if (second.catchUp.guardStop) throw new Error('enregistrement arrêté par la garde du service');
    if (second.catchUp.lines.length > 0) setState({ stats: loadFromJournal(second.parsed) });
    const pause = applyCatchUpPhase(second.catchUp);
    setState({ status: pause.pauseClock ? 'paused' : 'recording', resuming: false, landOnRecording: true, ...pause });
    if (watch.gpsOn && session.currentProfile) {
      // Rien n'est dû avant une position, mais le service peut se taire dès maintenant : le minuteur repart d'ici.
      const armedStep = gpsWatchOnFix(START_GPS_WATCH, Date.now(), session.currentProfile);
      applyGpsWatch(manualPaused ? gpsWatchOnPause(armedStep.state) : armedStep);
    }
    if (release && watch.beltOn && session.currentProfile) {
      // Comme le GPS : le minuteur de la page tombée est repris par une veille qui saura lire son échéance.
      const armedBelt = gpsWatchOnFix(START_GPS_WATCH, Date.now(), beltWatchSettings(session.currentProfile));
      applyBeltWatch(manualPaused ? gpsWatchOnPause(armedBelt.state) : armedBelt);
    } else {
      // Une ceinture redemandée est veillée dès maintenant si elle mesurait avant la coupure, sinon dès sa première
      // mesure ; jamais pendant la pause manuelle : sa veille l'attend, et la reprise manuelle la rend.
      watchResumedBelt(parsed, manualPaused);
    }
    // Tampon vidé d'un trait, puis l'écoute passe en direct : ce que la relecture a déjà pris est écarté par son heure.
    live = true;
    for (const fix of buffered) receiveFix(fix);
    // Un ordre de pause perdu avec la page : le service suit la session, à l'heure que porte le journal.
    if (services.paused !== manualPaused) {
      await tellSourcePaused(manualPaused, (manualPaused ? second.catchUp.phase.manualPause?.atMs : second.parsed.lastLineMs) ?? Date.now());
    }
    console.info(`[reprise] enregistrement repris seul, service de position resté en route : ${session.fixes.length} points relus`);
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
const resumeHoldingCommands = async (text: string, parsed: ParsedJournal, activity: Activity, services: RecoveryServices): Promise<boolean> => {
  if (isCommandRunning()) return resumeSilently(text, parsed, activity, services);
  let resumed = false;
  await runCommand(async () => {
    resumed = await resumeSilently(text, parsed, activity, services);
  });
  return resumed;
};

/**
 * Ce que dit l'analyse d'une session reprise qui ne continue plus, rangée seule : l'heure et la raison de son arrêt.
 * Arrêtée par la garde du service, application fermée : sa raison, à l'heure de la garde. Arrêtée par « Arrêter »
 * (ligne `stop` sans garde) : rien, l'utilisateur l'a vue finir. Sinon, le téléphone ou l'application l'a coupée :
 * la trace s'arrête à sa dernière position.
 */
const stopNotice = (parsed: ParsedJournal, guardStop: NativeCatchUp['guardStop']): string | null => {
  if (guardStop?.reason === 'still') {
    return t("Enregistrement arrêté seul à {heure} : application fermée, le téléphone n'avait pas bougé depuis une heure.", { heure: formatTimeOfDay(guardStop.atMs) });
  }
  if (guardStop?.reason === 'timeout') {
    return t("Enregistrement arrêté seul à {heure}, 12 h après la fermeture de l'application.", { heure: formatTimeOfDay(guardStop.atMs) });
  }
  if (!guardStop && parsed.stoppedAtMs !== null) return null;
  const atMs = guardStop?.atMs ?? lastFixMsOf(parsed.fixes) ?? parsed.lastLineMs;
  if (atMs === null) return null;
  return t("Enregistrement interrompu à {heure} : le téléphone ou l'application s'est arrêté, la trace s'arrête là.", { heure: formatTimeOfDay(atMs) });
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
    // Un service sans journal : rien à reprendre, et son propre journal n'a plus de session à compléter.
    if (recoveryDecision({ journal: null, services, nowMs, offerMaxAgeS: 0 }) === 'stopServices') await stopOrphans();
    await clearLoggedFixes();
    return 'free';
  }
  const read = parseJournal(text);
  const session = journalSession(read);
  if (recoveryDecision({ ...recoveryFactsOf(read), services, nowMs }) === 'resume' && session) {
    if (await resumeHoldingCommands(text, read, session.activity, services)) return 'free';
    // La reprise manquée a pu compléter le journal : il est relu tel qu'il est.
    text = (await recordingJournal.read().catch(() => null)) ?? text;
  }
  // Le service est arrêté d'abord : son journal, fermé, se relit en entier.
  await stopOrphans();
  // Capture restée ouverte après un rechargement de la page : fermée, elle attend avec la session.
  const orphan = await stopMotionCapture().catch(() => null);
  try {
    // Ce que le service a reçu sans la page, jusqu'à sa mort ou son arrêt par la garde, entre dans la session.
    const { parsed, catchUp } = await catchUpJournal(text, parseJournal(text), session?.activity ?? null);
    const { header, fixes: list, breaks } = parsed;
    // Ni en-tête ni changement lisibles : aucun calcul deviné, la session sera rangée « à classer ».
    const recoveredMarks = journalMarks(parsed);
    const motion = header ? (orphan?.path.endsWith(`/${header.startedAtMs}.imu`) ? orphan : await findMotionCapture(header.startedAtMs)) : null;
    const pending = await buildPendingSession(session?.activity ?? null, splitIntoSegments(list, breaks), true, recoveredMarks, motion);
    // Service arrêté à présent : seul l'âge du journal complété décide, reprise échouée comprise. Arrêtée par la
    // garde, la session porte une ligne `stop` : elle se range sans « Continuer ».
    const canContinue = recoveryDecision({ ...recoveryFactsOf(parsed), services: NO_RECOVERY_SERVICES, nowMs }) === 'offer';
    // « Continuer l'enregistrement » est sur la page Enregistrer : y mener, sinon l'offre reste invisible depuis l'accueil.
    // Sans offre, la session se range seule : son analyse s'ouvre avec l'heure et la raison de l'arrêt.
    const error = canContinue ? null : stopNotice(parsed, catchUp.guardStop);
    if (pending) setState({ pending: { ...pending, canContinue }, saved: null, error, landOnRecording: canContinue });
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
