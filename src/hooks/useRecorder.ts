import { errorMessage } from '../core/basics';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Activity } from '../core/activities';
import { marksWithin, type SessionMark } from '../core/sessionMarks';
import { DEFAULT_RECORDING, getSportProfile, type RecordingProfile } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import { effectiveFoil, effectiveHeartRate, effectiveRecordingProfile, readStoredActivities, rememberRecordActivity } from './useSportSettings';
import { recordingJournal } from '../platform/files';
import { armBeltWatch, armGpsWatch, disarmBeltWatch, disarmGpsWatch, getBeeper, onBeltLost, onGpsLost } from '../platform/beeper';
import { readPermissions } from '../platform/permissions';
import {
  findMotionCapture, motionCapturePath, pauseMotionCapture, readMotionCapture, removeMotionCapture, resumeMotionCapture, runningMotionCapture,
  startMotionCapture, stopMotionCapture, type MotionCapture, type MotionSetup,
} from '../platform/motion';
import {
  RECORDING_BELT_HOLDER, adoptBelt, beltState, holdBelt, latestHeartRate, releaseOrphanedBelt, savedBelt, subscribeBeltState, subscribeHeartRate,
  type BeltState, type HeartRateBelt,
} from '../platform/heartRate';
import {
  adoptRunningService, deviceLocationSource, stopOrphanedDeviceLocation, type LocationFix, type LocationSource, type LocationWatchOptions, type StopLocation,
} from '../platform/location';
import { readRecoveryServices, type RecoveryServices } from '../platform/recovery';
import { buildGpx } from '../recording/gpxWriter';
import {
  START_GPS_WATCH, beltWatchSettings, gpsWatchOnExpired, gpsWatchOnFix, gpsWatchOnPause, gpsWatchOnResume, watchesGps, type GpsWatchState, type GpsWatchStep,
} from '../recording/gpsWatch';
import { heartRateAt, readableBpm } from '../recording/heartRate';
import { headingFixes, shownLiveFix } from '../recording/livePosition';
import {
  journalActivity, journalActivityLine, journalBreakLine, journalFixLine, journalHeaderLine, journalNoteLine,
  journalPauseLine, journalResumeLine, journalStopLine, parseJournal, type ParsedJournal,
} from '../recording/journal';
import {
  NO_RECOVERY_SERVICES, continuedPause, rebuildRecordingStats, recoveryDecision, resumedPhase, type RecoveryJournal,
} from '../recording/resume';
import {
  isAutoPause, isManualPause, receivedFixRole,
  EMPTY_RECORDING_STATS,
  addFixAfterManualPause,
  addFixToStats,
  displayedDurationMs,
  evaluateAutoPause,
  isNewerFix,
  nothingToKeep,
  roundFix,
  sessionFileName,
  sessionTitle,
  shouldFlushJournal,
  segmentCount,
  splitIntoSegments,
  type PauseClock,
  type RecordingStats,
} from '../recording/session';
import { saveRecordedSession } from './useSessionLibrary';
import { createListeners } from './createStore';

/**
 * Enregistreur de session. Il vit hors des composants, dans ce module : on
 * peut changer de page pendant un enregistrement sans l'interrompre. Les
 * pages le lisent par `useRecorderSelector` et le pilotent par `startRecording`,
 * `stopRecording`, `pauseRecording`/`resumeRecording` (pause manuelle),
 * `changeRecordingActivity`, `analyzePendingSession`/`discardPendingSession`
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
 * attend une décision (`pending`) : « Analyser » la range dans la
 * bibliothèque (`saveRecordedSession`), « Jeter » l'abandonne. Rien n'entre
 * dans la mémoire sans cette décision, pour ne pas l'encombrer d'essais.
 * Tant qu'elle attend, le journal est gardé : après un arrêt brutal ou une
 * fermeture, la session est reconstruite depuis lui au démarrage suivant, et
 * attend de nouveau. Le journal n'est effacé qu'une fois le GPX écrit, ou la
 * session jetée.
 *
 * Deux pauses : manuelle (rien n'est gardé, la source GPS reste allumée pour
 * la carte du direct, reprise explicite, lot 104) et automatique (immobilité
 * prolongée, détectée par `evaluateAutoPause` — la source reste active pour
 * détecter la reprise du mouvement). Les deux ouvrent un nouveau segment à la
 * reprise.
 *
 * Veille du GPS (lot 115) : passé `gpsLostDelayS` sans position, hors pause
 * manuelle, le GPS est dit perdu (`gpsLost`, alerte `GPS_LOST_ERROR`, son et
 * notification), une fois par perte ; tout s'efface à la position suivante.
 * La machine est `recording/gpsWatch.ts`, le minuteur natif (`armGpsWatch`).
 *
 * Veille de la ceinture (lot 177) : la même machine, passé `beltLostDelayS` sans
 * mesure lisible d'une ceinture qui en donnait, hors pause manuelle (`beltLost`,
 * alerte `BELT_LOST_ERROR`, son et notification), une fois par perte.
 *
 * Reprise (lot 156, `recording/resume.ts`) : si le moteur de la page tombe, seule la page repart (`MainActivity.java`).
 * Le service GPS encore vivant, la session reprend seule (`resumeSilently`) : mémoire refaite depuis le journal, jamais
 * d'en-tête de plus, service jamais relancé, un segment neuf à la position suivante. Application tuée et rouverte peu
 * après : « Continuer l'enregistrement » dans la carte de la session en attente (`continuePendingSession`).
 *
 * Toute session a des positions. Un journal sans position est mis de côté (`setJournalAside`) ; ses lignes de FC
 * seule sont ignorées.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';

/** Session terminée, pas encore rangée : l'utilisateur doit l'analyser ou la jeter. */
interface PendingSession {
  fileName: string;
  /** Le GPX lui-même, pour le ranger ou le télécharger sans le reconstruire. */
  content: string;
  /** Calcul de la session ; `null` pour un journal relu sans en-tête lisible : rangée « à classer ». */
  sport: SportType | null;
  /** Activité de la session ; `null` avec `sport` nul. */
  activity: Activity | null;
  /** Positions gardées. */
  pointCount: number;
  /** Vrai si elle a été reconstruite depuis le journal d'un enregistrement interrompu. */
  recovered: boolean;
  /** Reprise possible : journal frais à la réouverture, sans « Arrêter » (`recoveryDecision`). */
  canContinue: boolean;
  /** Repères du bouton « Note », dans l'ordre du temps. */
  marks: SessionMark[];
  /** Capture des capteurs (sauts), dans le dossier privé, rangée avec la session ; `null` sans mesure. */
  motion: MotionCapture | null;
}

/** Session rangée par « Analyser ». */
interface SavedSession {
  fileName: string;
  /** Nom dans la mémoire, `null` si la session n'a pas pu y entrer (en attente, ou aucune mémoire). */
  libraryFile: string | null;
  /** Où la trouver, en clair. */
  location: string;
  /** Le GPX lui-même, pour l'analyser ou le télécharger sans le relire. */
  content: string;
  /** `null` : session à classer (`PendingSession.sport`). */
  sport: SportType | null;
  activity: Activity | null;
  pointCount: number;
  /** Vrai si elle a été reconstruite depuis le journal d'un enregistrement interrompu. */
  recovered: boolean;
}

export interface RecorderState {
  status: RecorderStatus;
  /** Calcul de l'activité en cours, `null` au repos. */
  sport: SportType | null;
  activity: Activity | null;
  sourceLabel: string | null;
  /** Raison de la pause en cours, `null` sinon. */
  pausedReason: 'manual' | 'auto' | null;
  /** Horloge de la pause en cours, pour la durée affichée (`displayedDurationMs`) ; `null` hors pause. */
  pauseClock: PauseClock | null;
  /** Vrai tant que les capteurs du téléphone mesurent (sauts, pumping). */
  measuringMotion: boolean;
  /** Ce que la capture en cours mesure, `null` sans capture. */
  motionSetup: MotionSetup | null;
  /** Ceinture cardio de l'enregistrement : état de la connexion et dernière fréquence ; `null` sans ceinture. */
  heartRate: { state: BeltState; bpm: number | null } | null;
  /** Repères du bouton « Note » de l'enregistrement en cours, pour la carte du direct ; vide au repos. */
  marks: SessionMark[];
  stats: RecordingStats;
  /** Session arrêtée qui attend « Analyser » ou « Jeter » ; aucun nouvel enregistrement d'ici là. */
  pending: PendingSession | null;
  /** La capture de cette session existe mais n'a pas pu être lue à « Analyser » : `analyzePendingSession(true)` la laisse de côté. */
  motionUnreadable: boolean;
  /** Vrai pendant le rangement de la session en attente (`analyzePendingSession`) : « Rangement… », boutons de sa carte inactifs. */
  analyzing: boolean;
  saved: SavedSession | null;
  error: string | null;
  /** GPS perdu : plus de position depuis le délai du profil (lot 115) ; effacé à la position suivante. */
  gpsLost: boolean;
  /** FC perdue : plus de mesure lisible d'une ceinture qui en donnait (lot 177) ; effacé à la mesure suivante. */
  beltLost: boolean;
  /**
   * Vrai pendant le `starting` d'une session relue du journal, positions déjà en mémoire : les guidages se rejouent
   * alors au lieu de repartir de zéro.
   */
  resuming: boolean;
  /** Reprise silencieuse tout juste faite : l'application revient sur Enregistrer (`acknowledgeRecordingLanding`). */
  landOnRecording: boolean;
}

const INITIAL_STATE: RecorderState = {
  status: 'idle',
  sport: null,
  activity: null,
  sourceLabel: null,
  pausedReason: null,
  pauseClock: null,
  measuringMotion: false,
  motionSetup: null,
  heartRate: null,
  marks: [],
  stats: EMPTY_RECORDING_STATS,
  pending: null,
  motionUnreadable: false,
  analyzing: false,
  saved: null,
  error: null,
  gpsLost: false,
  beltLost: false,
  resuming: false,
  landOnRecording: false,
};

let state = INITIAL_STATE;
const listeners = createListeners();

const setState = (patch: Partial<RecorderState>): void => {
  state = { ...state, ...patch };
  listeners.notify();
};

const subscribe = listeners.subscribe;

/** État de l'enregistreur, hors React. */
export const getRecorderState = (): RecorderState => state;

/** Changements d'état de l'enregistreur, hors React ; rend le désabonnement. */
export const subscribeToRecorder = (listener: () => void): (() => void) => subscribe(listener);

/** Abonnés aux positions reçues ; un abonné en échec n'arrête pas l'enregistrement. */
const fixListeners = createListeners<[LocationFix]>({ safe: true });

/**
 * Chaque position nouvelle reçue pendant l'enregistrement, pause
 * automatique comprise (la source tourne encore) : la seule boucle sûre
 * écran éteint. Rend le désabonnement.
 */
export const subscribeToFixes = (listener: (fix: LocationFix) => void): (() => void) => fixListeners.subscribe(listener);


// --- Enregistrement en cours ---

let fixes: LocationFix[] = [];
/** Indices, dans `fixes`, où reprend un nouveau segment (une pause à chacun). */
let segmentBreaks: number[] = [];
let pendingLines = '';
let lastFlushMs: number | null = null;
let stopSource: StopLocation | null = null;
/** Source active, gardée pour relancer une pause manuelle sans la redemander à la page. */
let currentSource: LocationSource | null = null;
/** Réglage effectif de la session en cours : celui de son activité, relu quand elle change. */
let currentProfile: RecordingProfile | null = null;
/**
 * Dernière position reçue, redélivrances comprises : distinct de
 * `stats.lastMs`, qui gèle pendant une pause alors que la source continue
 * d'envoyer des positions (pause automatique).
 */
let lastReceivedMs: number | null = null;
/** Position de `lastReceivedMs` : celle d'un repère posé en pause automatique, où rien n'est gardé dans `fixes`. */
let lastReceivedFix: LocationFix | null = null;
/** Instant de réception de `lastReceivedFix`, à l'horloge : l'heure d'un repère en suit l'écart. */
let lastReceivedAtMs: number | null = null;
/** Depuis quand la vitesse est sous le seuil d'auto-pause, ou `null`. */
let belowSinceMs: number | null = null;
/** Une pause vient de se terminer : le prochain point gardé ouvre un nouveau segment. */
let pendingBreak = false;
/**
 * Le saut vient d'une pause manuelle (lot 158) : la part de l'écart passée en pause automatique avant
 * l'appui sur Pause (qui reste comptée), `null` sinon. Le premier point gardé retranche le reste de la durée.
 */
let manualBreakAutoPartMs: number | null = null;
/** La session vient d'un journal relu : à l'arrêt, une capture d'avant la coupure se retrouve par son fichier. */
let resumedSession = false;

/** Reprise d'une pause manuelle : le prochain point gardé ouvre un segment et ne compte pas la pause dans la durée. */
const markManualResume = (): void => {
  pendingBreak = true;
  const clock = state.pauseClock;
  manualBreakAutoPartMs = clock?.frozenAtMs != null ? Math.max(0, clock.frozenAtMs - clock.sinceMs) : 0;
  // Écrit tout de suite : une reprise après une chute doit savoir la pause levée, même sans point gardé depuis.
  pendingLines += journalResumeLine(Date.now());
  void flushJournal();
};
/** Positions reçues pendant la pause manuelle en cours, pour la carte seule : jamais gardées. */
let pauseFixes: LocationFix[] = [];
/** Abonnés aux positions de la pause manuelle (la carte du direct, `useLivePosition`). */
const pausePositionListeners = createListeners({ safe: true });
/** Écritures du journal, enchaînées pour qu'elles arrivent dans l'ordre. */
let writes: Promise<void> = Promise.resolve();
/** Instant du démarrage, à l'horloge : le nom de la capture des capteurs et le début des repères d'une session reprise. */
let startedAtMs = 0;
/** Repères posés pendant l'enregistrement, dans l'ordre. */
let marks: SessionMark[] = [];
/** Écart toléré entre une mesure de la ceinture et une position, en secondes ; `null` sans ceinture. */
let heartRateMaxAgeS: number | null = null;
/** Rend la ceinture et se désabonne de ses mesures ; `null` sans ceinture. */
let dropBelt: (() => void) | null = null;
/** Dernière erreur signalée par la source (localisation coupée…), effacée de l'état à la position suivante. */
let sourceError: string | null = null;

const onSourceError = (message: string): void => {
  sourceError = message;
  setState({ error: message });
};

/** Alerte de la page Enregistrer quand le GPS se tait (lot 115). */
export const GPS_LOST_ERROR = "GPS perdu : plus aucune position. L'enregistrement continue, la trace reprendra au retour du GPS.";
/** Échec de la pause de la capture des capteurs. */
const SENSORS_PAUSE_ERROR = 'Capteurs : pause impossible, la mesure continue pendant la pause';
/** Échec de la reprise de la capture des capteurs. */
const SENSORS_RESUME_ERROR = 'Capteurs : reprise impossible, sauts arrêtés';
/** « Continuer » après une capture des capteurs : elle ne reprend pas, ce qu'elle a mesuré reste. */
const CAPTURE_NOT_RESUMED = 'Capteurs : la mesure ne reprend pas ; ce qu\'ils ont mesuré avant la coupure est gardé.';
/** Notifications refusées au départ d'un enregistrement : ajouté une fois à l'alerte. */
const NOTIFICATIONS_OFF_WARNING = "Notifications refusées : rien ne s'affichera sur l'écran verrouillé pendant l'enregistrement (Réglages › Autorisations).";

/** Veille du GPS de l'enregistrement en cours. */
let gpsWatch: GpsWatchState = START_GPS_WATCH;
/** Vrai si l'enregistrement en cours veille sur son GPS (`watchesGps`), fixé au départ comme les options de la source. */
let gpsWatchOn = false;
/** Désabonnement de l'échéance du minuteur ; `null` tant que personne n'y est abonné. */
let offGpsLost: (() => void) | null = null;

/** L'alerte avec « GPS perdu » ajouté à la suite de ce qu'elle disait déjà. */
const withGpsLost = (error: string | null): string => (error ? `${withoutGpsLost(error)} ${GPS_LOST_ERROR}` : GPS_LOST_ERROR);

/** L'alerte sans « GPS perdu » : ce qu'elle disait avant, ou après (un message ajouté entre-temps), est gardé ; `null` s'il ne reste rien. */
const withoutGpsLost = (error: string | null): string | null => {
  if (error === null) return null;
  const rest = error.replace(` ${GPS_LOST_ERROR}`, '').replace(GPS_LOST_ERROR, '').trim();
  return rest === '' ? null : rest;
};

/**
 * Applique un pas de la veille : minuteur, et « GPS perdu » ajouté à l'alerte
 * ou retiré seul, sans effacer ce qu'elle disait déjà (notifications
 * refusées, capteurs, erreur de la source).
 */
const applyGpsWatch = (step: GpsWatchStep): void => {
  gpsWatch = step.state;
  if (step.disarm) void disarmGpsWatch().catch(() => {});
  if (step.armMs !== null) void armGpsWatch(step.armMs).catch(() => {});
  if (step.lost) setState({ gpsLost: true, error: withGpsLost(state.error) });
  else if (step.cleared && state.gpsLost) setState({ gpsLost: false, error: withoutGpsLost(state.error) });
};

/** Échéance du minuteur : revérifiée par la veille (une position a pu la repousser entre-temps). */
const onGpsWatchExpired = (): void => {
  if (!gpsWatchOn || (state.status !== 'starting' && state.status !== 'recording' && state.status !== 'paused')) return;
  applyGpsWatch(gpsWatchOnExpired(gpsWatch, Date.now()));
};

/** Arrête la veille de l'enregistrement : minuteur désarmé, machine remise au départ. */
const stopGpsWatch = (): void => {
  if (gpsWatchOn) void disarmGpsWatch().catch(() => {});
  gpsWatchOn = false;
  gpsWatch = START_GPS_WATCH;
};

/** Message de la perte de la fréquence cardiaque, ajouté à l'alerte comme « GPS perdu ». */
export const BELT_LOST_ERROR = "Fréquence cardiaque perdue : plus aucune mesure de la ceinture. L'enregistrement continue, elle reprendra à son retour.";

/** Veille de la ceinture de l'enregistrement en cours. */
let beltWatch: GpsWatchState = START_GPS_WATCH;
/** Vrai dès qu'une ceinture est tenue par l'enregistrement. */
let beltWatchOn = false;
/** Désabonnement de l'échéance du minuteur ; `null` tant que personne n'y est abonné. */
let offBeltLost: (() => void) | null = null;

/** L'alerte sans la perte de la FC : ce qu'elle disait par ailleurs est gardé ; `null` s'il ne reste rien. */
const withoutBeltLost = (error: string | null): string | null => {
  if (error === null) return null;
  const rest = error.replace(` ${BELT_LOST_ERROR}`, '').replace(BELT_LOST_ERROR, '').trim();
  return rest === '' ? null : rest;
};

/** Applique un pas de la veille de la ceinture : minuteur, et message ajouté à l'alerte ou retiré seul. */
const applyBeltWatch = (step: GpsWatchStep): void => {
  beltWatch = step.state;
  if (step.disarm) void disarmBeltWatch().catch(() => {});
  if (step.armMs !== null) void armBeltWatch(step.armMs).catch(() => {});
  if (step.lost) {
    const rest = withoutBeltLost(state.error);
    setState({ beltLost: true, error: rest ? `${rest} ${BELT_LOST_ERROR}` : BELT_LOST_ERROR });
  } else if (step.cleared && state.beltLost) {
    setState({ beltLost: false, error: withoutBeltLost(state.error) });
  }
};

/** Échéance du minuteur de la ceinture : revérifiée par la veille (une mesure a pu la repousser entre-temps). */
const onBeltWatchExpired = (): void => {
  if (!beltWatchOn || (state.status !== 'starting' && state.status !== 'recording' && state.status !== 'paused')) return;
  applyBeltWatch(gpsWatchOnExpired(beltWatch, Date.now()));
};

/**
 * Arrête la veille de la ceinture : minuteur désarmé, machine remise au départ. Désarmé même sans veille en
 * cours : le minuteur natif survit à une chute de la page, et la ceinture peut n'avoir pas été reprise.
 */
const stopBeltWatch = (): void => {
  void disarmBeltWatch().catch(() => {});
  beltWatchOn = false;
  beltWatch = START_GPS_WATCH;
};

/** Au départ : des notifications refusées sont dites une fois, dans l'alerte de la page (lot 115). */
const warnIfNotificationsOff = async (): Promise<void> => {
  const permissions = await readPermissions().catch(() => null);
  const refused = permissions?.notifications === 'denied' || permissions?.notifications === 'prompt';
  if (!refused || state.status === 'idle' || state.status === 'stopping') return;
  setState({ error: state.error ? `${state.error} ${NOTIFICATIONS_OFF_WARNING}` : NOTIFICATIONS_OFF_WARNING });
};

const enqueueWrite = (write: () => Promise<void>): Promise<void> => {
  writes = writes.then(write).catch((err) => {
    setState({ error: `Écriture du journal impossible : ${errorMessage(err, 'erreur inconnue')}` });
  });
  return writes;
};

/**
 * Écrit les lignes en attente, prises au moment de l'écriture (pas de
 * l'appel) : des écritures enchaînées gardent l'ordre. Une écriture qui échoue
 * remet ses lignes en tête du tampon, pour l'écriture suivante ; un saut de
 * ligne les précède, au cas où une ligne aurait été écrite à moitié.
 */
const flushJournal = (): Promise<void> => {
  if (pendingLines === '') return writes;
  return enqueueWrite(async () => {
    const lines = pendingLines;
    if (lines === '') return;
    pendingLines = '';
    try {
      await recordingJournal.append(lines);
    } catch (err) {
      pendingLines = '\n' + lines + pendingLines;
      throw err;
    }
  });
};

/**
 * Garde une position : un nouveau segment s'ouvre après une pause, la
 * position va au journal, les statistiques suivent, et le journal s'écrit par
 * paquets.
 */
const keepPoint = (fix: LocationFix, journalFlushS: number): void => {
  if (pendingBreak) {
    segmentBreaks.push(fixes.length);
    pendingLines += journalBreakLine(fix.timeMs);
    pendingBreak = false;
    // Premier point gardé après une pause manuelle : la carte reprend la trace, ses positions de pause ne servent plus.
    pauseFixes = [];
  }
  fixes.push(fix);
  pendingLines += journalFixLine(fix);
  const afterManualPause = manualBreakAutoPartMs !== null;
  setState({ stats: afterManualPause ? addFixAfterManualPause(state.stats, fix, manualBreakAutoPartMs ?? 0) : addFixToStats(state.stats, fix) });
  manualBreakAutoPartMs = null;
  if (shouldFlushJournal(lastFlushMs, fix.timeMs, journalFlushS)) {
    lastFlushMs = fix.timeMs;
    void flushJournal();
  }
};

/** Reçoit une position de la source. Le réglage est relu à chaque fois : l'activité peut changer en route. */
const receiveFix = (received: LocationFix): void => {
  const role = receivedFixRole(state);
  const recording = currentProfile;
  if (role === 'ignore' || recording === null) return;
  if (!isNewerFix(lastReceivedMs, received)) return;
  // Veille du GPS, hors pause manuelle : le minuteur est repoussé, ou l'alerte de perte s'efface (avant les abonnés :
  // le guidage des balises reprend son rythme à cette position).
  if (role === 'evaluate' && gpsWatchOn) applyGpsWatch(gpsWatchOnFix(gpsWatch, Date.now(), recording));
  // La source envoie de nouveau : son erreur, encore affichée, n'a plus lieu d'être.
  if (sourceError !== null) {
    if (state.error === sourceError) setState({ error: null });
    sourceError = null;
  }
  // Comparée à l'heure de réception, pas à celle de la position : la même horloge que la ceinture, et un rejeu marche aussi.
  const heartRateBpm = heartRateMaxAgeS === null ? undefined : heartRateAt(latestHeartRate(), Date.now(), heartRateMaxAgeS);
  const fix = roundFix(heartRateBpm === undefined ? received : { ...received, heartRateBpm });
  lastReceivedMs = fix.timeMs;
  lastReceivedFix = fix;
  lastReceivedAtMs = Date.now();
  if (role === 'show') {
    // Pause manuelle : le GPS reste allumé pour la carte du direct seule ; rien n'est gardé, compté ni évalué (la
    // reprise reste manuelle), et les abonnés aux positions (notification, guidage, test) n'en voient rien.
    pauseFixes.push(fix);
    pausePositionListeners.notify();
    return;
  }
  fixListeners.notify(fix);

  const auto = evaluateAutoPause(state.status === 'paused', belowSinceMs, fix, {
    speedMs: recording.autoPauseSpeedMs,
    delayS: recording.autoPauseDelayS,
  });
  belowSinceMs = auto.belowSinceMs;
  if (auto.event === 'pause') {
    setState({ status: 'paused', pausedReason: 'auto', pauseClock: { sinceMs: Date.now(), frozenAtMs: null } });
    void flushJournal();
    return;
  }
  if (auto.event === 'resume') {
    pendingBreak = true;
    setState({ status: 'recording', pausedReason: null, pauseClock: null });
  }
  if (state.status === 'paused') return;
  keepPoint(fix, recording.journalFlushS);
};

/**
 * Construit le GPX de segments, sans le ranger : le journal reste jusqu'à la
 * décision de l'utilisateur. Rend `null`, journal effacé, s'il y a moins de
 * deux positions au total : aucune trace ne s'en tire, il n'y a rien à garder.
 */
const buildPendingSession = async (
  activity: Activity | null,
  segments: LocationFix[][],
  recovered: boolean,
  marks: SessionMark[],
  motion: MotionCapture | null
): Promise<PendingSession | null> => {
  const sport = activity?.base ?? null;
  const titleName = activity?.name ?? 'Session';
  const pointCount = segments.reduce((n, s) => n + s.length, 0);
  if (pointCount < 2) {
    await recordingJournal.remove();
    if (motion) await removeMotionCapture(motion.path);
    return null;
  }
  const startMs = segments.find((s) => s.length > 0)![0].timeMs;
  const fileName = sessionFileName(startMs, sport);
  const content = buildGpx(segments, { name: sessionTitle(startMs, titleName), sport });
  return { fileName, content, sport, activity, pointCount, recovered, canContinue: false, marks, motion };
};

/**
 * Capture là mais illisible : rien n'est effacé, la session reste en attente, et ceci le dit. Une capture
 * qui ne se lirait jamais bloquerait la session : d'où « Analyser sans les capteurs ».
 */
const MOTION_UNREADABLE_MESSAGE = 'Les mesures des capteurs de cette session n\'ont pas pu être lues. La session reste en attente et rien n\'est effacé : '
  + 'réessayez « Analyser », ou « Analyser sans les capteurs » pour la ranger sans sauts ni pumping, le fichier des mesures restant sur l\'appareil.';

/**
 * « Analyser » : range la session en attente dans la bibliothèque, puis
 * efface le journal et la capture. Rend la session rangée, ou `null` si
 * l'écriture échoue : la session reste alors en attente, journal compris.
 * Une capture absente : la session est rangée sans elle. Une capture qui
 * existe mais ne se lit pas : la session reste en attente, rien n'est effacé
 * (`motionUnreadable`). `withoutMotion` (« Analyser sans les capteurs », après
 * cet échec) : la session est rangée sans la capture, qui reste sur l'appareil.
 */
const rangePendingSession = async (pending: PendingSession, withoutMotion: boolean): Promise<SavedSession | null> => {
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
  try {
    // Le foil de l'activité au moment de l'enregistrement : le matériel du jour, pas une supposition.
    const foil = pending.activity ? effectiveFoil(pending.activity) : null;
    const { file, location } = await saveRecordedSession(pending.content, pending.sport, pending.activity?.id ?? null, motion, pending.marks, foil);
    await recordingJournal.remove();
    if (pending.motion && !withoutMotion) await removeMotionCapture(pending.motion.path);
    const saved: SavedSession = { ...pending, fileName: file ?? pending.fileName, libraryFile: file, location };
    setState({ pending: null, motionUnreadable: false, saved, error: null });
    return saved;
  } catch (err) {
    setState({ error: `Enregistrement du GPX impossible : ${errorMessage(err, 'erreur inconnue')}. La session reste en attente.` });
    return null;
  }
};

/** Rangement en cours (`RecorderState.analyzing`), rendu à qui le redemande ; `null` sinon. */
let ranging: Promise<SavedSession | null> | null = null;

/**
 * Lance le rangement de la session en attente (`rangePendingSession`). Il appartient au module, pas à la page, qu'on
 * peut quitter et rouvrir pendant le calcul (lot 161) : un second appel pendant qu'il tourne rend la même promesse,
 * sans en lancer un autre, même avec un autre `withoutMotion`. `analyzing` retombe à sa fin, réussie ou non.
 */
export const analyzePendingSession = (withoutMotion = false): Promise<SavedSession | null> => {
  if (ranging) return ranging;
  const pending = state.pending;
  if (!pending) return Promise.resolve(null);
  setState({ analyzing: true });
  const run = rangePendingSession(pending, withoutMotion).finally(() => {
    ranging = null;
    setState({ analyzing: false });
  });
  ranging = run;
  return run;
};

/** « Jeter » : abandonne la session en attente et efface son journal ; sans effet pendant son rangement. */
export const discardPendingSession = async (): Promise<void> => {
  if (!state.pending || ranging) return;
  await recordingJournal.remove();
  if (state.pending.motion) await removeMotionCapture(state.pending.motion.path);
  setState({ pending: null, motionUnreadable: false, error: null });
};

/** Options de démarrage d'une source, communes au premier démarrage et à une reprise manuelle. */
const sourceOptions = (activity: Activity, recording: RecordingProfile): LocationWatchOptions => ({
  intervalMs: recording.intervalMs,
  distanceFilterM: recording.distanceFilterM,
  notificationTitle: 'Gtracker enregistre',
  notificationText: `Session ${activity.name} en cours`,
});

const isBusy = (): boolean => state.status !== 'idle';

/** Commande en cours (démarrage, pause, reprise, arrêt), levée à sa fin ; `null` sans commande. */
let running: Promise<void> | null = null;

/** Lance la commande en prenant la place de la commande en cours, rendue à sa fin, même en échec. */
const runCommand = (command: () => Promise<void>): Promise<void> => {
  let release!: () => void;
  const run = new Promise<void>((resolve) => {
    release = resolve;
  });
  running = run;
  return (async () => {
    try {
      await command();
    } finally {
      if (running === run) running = null;
      release();
    }
  })();
};

/** Démarrage, pause ou reprise : un appel pendant une autre commande (double appui) est ignoré. */
const exclusive = <A extends unknown[]>(command: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  if (running) return;
  await runCommand(() => command(...args));
};

/**
 * Arrêt : attend la commande en cours (pause ou reprise lancée juste avant),
 * puis prend la place ; une pause ou une reprise demandée pendant l'arrêt est
 * ignorée. Sans cela, une pause finie après l'arrêt reposerait « en pause »,
 * ou une reprise relancerait le GPS d'une session déjà arrêtée.
 */
const afterCurrent = <A extends unknown[]>(command: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  while (running) await running;
  await runCommand(() => command(...args));
};

/** Vrai tant qu'un enregistrement est en cours : la touche retour ne doit pas fermer l'application. */
export const isRecordingActive = (): boolean => isBusy();

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
    setState({ error: `${why} : son journal est gardé de côté sur le téléphone (${name}), un nouvel enregistrement peut démarrer.` });
    return 'setAside';
  } catch (err) {
    setState({
      error: `${why}, et son journal n'a pas pu être mis de côté (${errorMessage(err, 'erreur inconnue')}) : `
        + "aucun enregistrement ne démarre, pour ne pas l'écraser. Relancez l'application.",
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

/** Remet l'enregistreur au repos, sans rien écrire : une reprise qui n'a pas abouti laisse son journal intact. */
const abandonResume = async (): Promise<void> => {
  const stop = stopSource;
  stopSource = null;
  await stop?.().catch(() => undefined);
  releaseRecordingBelt();
  stopGpsWatch();
  currentSource = null;
  currentProfile = null;
  resumedSession = false;
  fixes = [];
  segmentBreaks = [];
  pauseFixes = [];
  pendingLines = '';
  marks = [];
  setState({
    status: 'idle', resuming: false, sport: null, activity: null, sourceLabel: null, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks: [], stats: EMPTY_RECORDING_STATS, gpsLost: false, beltLost: false,
  });
};

/**
 * Remet en mémoire la session d'un journal relu et passe en `starting`, `resuming` : les abonnés rejouent leurs
 * guidages sur ces positions. Le journal n'est jamais récrit, seulement complété, et le saut de ligne d'abord écrit
 * le protège d'une dernière ligne tronquée par la coupure ; la dernière position fait écarter ses redélivrances.
 */
const restoreFromJournal = (parsed: ParsedJournal, activity: Activity, source: LocationSource | null): void => {
  resetSession({ source, profile: effectiveRecordingProfile(activity), startedAtMs: parsed.header?.startedAtMs ?? Date.now() });
  fixes = parsed.fixes;
  segmentBreaks = parsed.breaks;
  pendingLines = '\n';
  lastReceivedFix = fixes[fixes.length - 1] ?? null;
  lastReceivedMs = lastReceivedFix?.timeMs ?? null;
  // Un repère posé avant la position suivante suit le temps écoulé depuis la dernière, trou compris.
  lastReceivedAtMs = lastReceivedFix?.timeMs ?? null;
  marks = parsed.marks;
  resumedSession = true;
  const stats = rebuildRecordingStats(fixes, parsed.manualBreaks.map((b) => ({ index: b.fixIndex, autoPartMs: b.autoPartMs })));
  setState({
    status: 'starting', resuming: true, sport: activity.base, activity, sourceLabel: source?.label ?? null, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks, stats, pending: null, motionUnreadable: false, saved: null, error: null, gpsLost: false, beltLost: false,
  });
};

/**
 * Reprise silencieuse : le service a survécu à la chute du moteur de la page. Rien n'est relancé ni récrit : capture,
 * ceinture et GPS sont rebranchés tels qu'ils tournent, la session reprend où le journal l'a laissée (pause manuelle
 * comprise), et le point suivant ouvre un segment. Faux, enregistreur au repos et journal intact, si un maillon manque.
 */
const resumeSilently = async (parsed: ParsedJournal, activity: Activity): Promise<boolean> => {
  const sport = activity.base;
  try {
    restoreFromJournal(parsed, activity, deviceLocationSource());
    const phase = resumedPhase(parsed);
    pendingBreak = phase.pendingBreak;
    manualBreakAutoPartMs = phase.manualBreakAutoPartMs;
    // Capteurs et ceinture ne valent pas la trace : leur lecture en échec ne fait pas renoncer à la reprise.
    const capture = await runningMotionCapture().catch(() => null);
    // Celle d'une autre session n'a rien à faire là.
    if (capture && capture.path !== motionCapturePath(startedAtMs)) await stopMotionCapture().catch(() => null);
    else if (capture) {
      setState({ measuringMotion: true, motionSetup: capture.setup });
      // Un ordre de pause ou de reprise perdu avec la page : la capture suit la session.
      if (phase.pauseClock !== null && capture.listening) await pauseMotionCapture().catch(() => setState({ error: SENSORS_PAUSE_ERROR }));
      if (phase.pauseClock === null && !capture.listening) await resumeMotionCapture().catch(() => setState({ error: SENSORS_RESUME_ERROR }));
    }
    const release = await adoptBelt(RECORDING_BELT_HOLDER).catch(() => null);
    if (release) wireBelt(release, getSportProfile(sport).heartRate.maxAgeS);
    // Sans attente jusqu'au passage en enregistrement : aucune position ne peut arriver d'ici là, ni être mal jugée.
    stopSource = adoptRunningService(receiveFix, onSourceError);
    setState({
      status: phase.pauseClock ? 'paused' : 'recording', resuming: false, landOnRecording: true,
      pausedReason: phase.pauseClock ? 'manual' : null, pauseClock: phase.pauseClock,
    });
    if (gpsWatchOn && currentProfile) {
      // Rien n'est dû avant une position, mais le service peut se taire dès maintenant : le minuteur repart d'ici.
      const armedStep = gpsWatchOnFix(START_GPS_WATCH, Date.now(), currentProfile);
      applyGpsWatch(phase.pauseClock ? gpsWatchOnPause(armedStep.state) : armedStep);
    }
    if (beltWatchOn && currentProfile) {
      // Comme le GPS : le minuteur de la page tombée est repris par une veille qui saura lire son échéance.
      const armedBelt = gpsWatchOnFix(START_GPS_WATCH, Date.now(), beltWatchSettings(currentProfile));
      applyBeltWatch(phase.pauseClock ? gpsWatchOnPause(armedBelt.state) : armedBelt);
    }
    console.info(`[reprise] enregistrement repris seul après une chute du moteur : ${fixes.length} points relus`);
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
  if (running) return resumeSilently(parsed, activity);
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
    return setJournalAside(`Session interrompue illisible (${errorMessage(err, 'erreur inconnue')})`);
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
    return setJournalAside(`Session interrompue non récupérée (${errorMessage(err, 'erreur inconnue')})`);
  }
};

/**
 * Reprend un enregistrement que l'application n'a pas vu se conclure : relit le journal et, selon les services
 * encore vivants et son âge (`recoveryDecision`), reprend la session seule, ou la remet en attente, avec ou sans
 * « Continuer ». À appeler au démarrage de l'application. Un journal présent mais illisible, ou dont la session ne
 * se reconstruit pas, n'est jamais pris pour absent : il est mis de côté (`setJournalAside`), jamais écrasé par le
 * départ suivant. Idempotent : un second appel pendant le premier le rejoint.
 */
export const recoverInterruptedRecording = (): Promise<JournalRecovery> => {
  recovering ??= recoverOnce().finally(() => {
    recovering = null;
  });
  return recovering;
};

/** L'application est revenue sur Enregistrer après une reprise silencieuse. */
export const acknowledgeRecordingLanding = (): void => {
  if (state.landOnRecording) setState({ landOnRecording: false });
};

/** Prend la ceinture pour l'enregistrement et suit ses mesures dans l'état. */
const takeBelt = async (belt: HeartRateBelt, maxAgeS: number): Promise<void> => {
  wireBelt(await holdBelt(RECORDING_BELT_HOLDER, belt), maxAgeS);
};

/** Suit dans l'état les mesures d'une ceinture tenue ; `release` la rend. */
const wireBelt = (release: () => void, maxAgeS: number): void => {
  heartRateMaxAgeS = maxAgeS;
  beltWatch = START_GPS_WATCH;
  beltWatchOn = true;
  offBeltLost ??= onBeltLost(onBeltWatchExpired);
  setState({ heartRate: { state: beltState(), bpm: null } });
  const offSample = subscribeHeartRate((sample) => {
    const bpm = readableBpm(sample);
    // Une ceinture décollée qui émet encore ne mesure plus : seule une mesure lisible repousse le minuteur.
    if (beltWatchOn && bpm !== null && currentProfile) applyBeltWatch(gpsWatchOnFix(beltWatch, Date.now(), beltWatchSettings(currentProfile)));
    if (state.heartRate && (state.heartRate.bpm !== bpm || state.heartRate.state !== beltState())) {
      setState({ heartRate: { state: beltState(), bpm } });
    }
  });
  const offState = subscribeBeltState((beltNow) => {
    if (state.heartRate) setState({ heartRate: { state: beltNow, bpm: beltNow === 'connected' ? state.heartRate.bpm : null } });
  });
  dropBelt = () => {
    offSample();
    offState();
    release();
  };
};

/** Rend la ceinture, s'il y en a une. */
const releaseRecordingBelt = (): void => {
  dropBelt?.();
  dropBelt = null;
  heartRateMaxAgeS = null;
  stopBeltWatch();
};

/**
 * « Arrêter de chercher » (lot 198), ceinture perdue ou jamais trouvée en route : l'enregistrement la rend et continue
 * sans cardio, tuile BPM et alerte de FC perdue retirées. Plus rien ne la recherche jusqu'à la fin de la sortie : le
 * greffon n'est plus demandé (fin de sa reprise seule), la pause ne la reprend pas, et une reprise après une chute de
 * la page la trouve lâchée (`adoptBelt` rend `null`). Seul « Continuer l'enregistrement », après une application
 * tuée, la redemande, comme au départ.
 */
export const stopRecordingBeltSearch = (): void => {
  if (dropBelt === null) return;
  if (state.status === 'idle' || state.status === 'stopping') return;
  releaseRecordingBelt();
  setState({ heartRate: null, beltLost: false, error: withoutBeltLost(state.error) });
};

/** Variables de la session qui démarre, ou qui reprend d'un journal relu, remises au départ. */
const resetSession = (init: { source: LocationSource | null; profile: RecordingProfile; startedAtMs: number }): void => {
  fixes = [];
  segmentBreaks = [];
  pendingLines = '';
  lastFlushMs = null;
  currentSource = init.source;
  currentProfile = init.profile;
  lastReceivedMs = null;
  lastReceivedFix = null;
  lastReceivedAtMs = null;
  belowSinceMs = null;
  pendingBreak = false;
  manualBreakAutoPartMs = null;
  resumedSession = false;
  pauseFixes = [];
  startedAtMs = init.startedAtMs;
  marks = [];
  sourceError = null;
  stopGpsWatch();
  gpsWatchOn = watchesGps(init.profile, true);
  offGpsLost ??= onGpsLost(onGpsWatchExpired);
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
  // Le journal d'une session en attente serait écrasé : elle doit être analysée ou jetée d'abord.
  if (state.pending) return;
  // Journal illisible resté en place : pas de départ, qui l'écraserait ; le message est déjà posé.
  if (recovery === 'blocked') return;
  // Journal mis de côté à l'instant : son message reste affiché au départ.
  const recoveryNotice = recovery === 'setAside' ? state.error : null;

  const profile = effectiveRecordingProfile(activity);
  resetSession({ source, profile, startedAtMs: Date.now() });
  setState({
    status: 'starting', sport, activity, sourceLabel: source.label, pausedReason: null, pauseClock: null,
    measuringMotion: false, motionSetup: null, heartRate: null, marks, stats: EMPTY_RECORDING_STATS,
    saved: null, error: recoveryNotice, gpsLost: false, beltLost: false,
  });

  try {
    await recordingJournal.write(journalHeaderLine(sport, startedAtMs, activity));
    stopSource = await source.start(sourceOptions(activity, profile), receiveFix, onSourceError);
    setState({ status: 'recording' });
  } catch (err) {
    stopSource = null;
    stopGpsWatch();
    await recordingJournal.remove();
    setState({ status: 'idle', error: `Démarrage impossible : ${errorMessage(err, 'erreur inconnue')}` });
    return;
  }
  if (options.motion) {
    try {
      await startMotionCapture(startedAtMs, options.motion);
      setState({ measuringMotion: true, motionSetup: options.motion });
    } catch (err) {
      setState({ error: `Mesure des capteurs impossible : ${errorMessage(err, 'erreur inconnue')}. L'enregistrement continue sans elle.` });
    }
  }
  if (options.heartRate) {
    try {
      await takeBelt(options.heartRate, getSportProfile(sport).heartRate.maxAgeS);
    } catch (err) {
      releaseRecordingBelt();
      setState({ heartRate: null, error: `Ceinture cardio injoignable : ${errorMessage(err, 'erreur inconnue')}. L'enregistrement continue sans elle.` });
    }
  }
  // Après les messages du départ (capteurs, ceinture), pour s'y ajouter sans être effacé par eux.
  void warnIfNotificationsOff();
});

/**
 * « Continuer l'enregistrement » : la session en attente reprend sur son journal, dans un segment neuf, service
 * relancé par ce geste (l'application est au premier plan). Le temps hors de l'application ne compte pas (`continuedPause`).
 * La capture ne reprend pas, son fichier est retrouvé à l'arrêt. En échec, la session reste en attente et le journal est gardé.
 */
export const continuePendingSession = exclusive(async (source: LocationSource | null): Promise<void> => {
  const before = state.pending;
  if (isBusy() || !before?.canContinue || before.activity === null) return;
  const activity = before.activity;
  if (source === null) return;
  const backToPending = async (why: unknown): Promise<void> => {
    await abandonResume();
    setState({ pending: before, error: `Reprise impossible : ${errorMessage(why, 'erreur inconnue')}. La session reste en attente.` });
  };
  let parsed: ParsedJournal;
  try {
    const text = await recordingJournal.read();
    if (text === null) throw new Error('journal introuvable');
    parsed = parseJournal(text);
  } catch (err) {
    setState({ error: `Reprise impossible : ${errorMessage(err, 'erreur inconnue')}. La session reste en attente.` });
    return;
  }
  try {
    const nowMs = Date.now();
    restoreFromJournal(parsed, activity, source);
    const lifted = continuedPause(parsed, nowMs);
    if (lifted.pause) pendingLines += journalPauseLine(lifted.pause.atMs, lifted.pause.autoPartMs);
    if (lifted.resumeLine) pendingLines += journalResumeLine(nowMs);
    pendingBreak = true;
    manualBreakAutoPartMs = lifted.autoPartMs;
    await flushJournal();
    const heartRate = getSportProfile(activity.base).heartRate;
    stopSource = await source.start(sourceOptions(activity, effectiveRecordingProfile(activity)), receiveFix, onSourceError);
    const belt = effectiveHeartRate(activity) ? savedBelt() : null;
    if (belt) {
      await takeBelt(belt, heartRate.maxAgeS).catch((err: unknown) => {
        releaseRecordingBelt();
        setState({ heartRate: null, error: `Ceinture cardio injoignable : ${errorMessage(err, 'erreur inconnue')}. L'enregistrement continue sans elle.` });
      });
    }
    const captured = await findMotionCapture(startedAtMs).catch(() => null);
    setState({
      status: 'recording', resuming: false,
      ...(captured ? { error: joinMessages(state.error, CAPTURE_NOT_RESUMED) } : {}),
    });
  } catch (err) {
    await backToPending(err);
    return;
  }
  void warnIfNotificationsOff();
});

/**
 * Pause manuelle : plus rien n'est gardé ni compté, durée figée. Le GPS reste
 * allumé (lot 104, décision du 31/10) : la carte du direct suit le coureur
 * qui continue d'avancer, et la reprise ne relance rien (pas de première
 * position périmée). Depuis une pause automatique, la reprise devient manuelle.
 */
export const pauseRecording = exclusive(async (): Promise<void> => {
  const autoPaused = isAutoPause(state);
  if (state.status !== 'recording' && !autoPaused) return;
  // La durée se fige à cet instant ; depuis une pause automatique, celle-ci y reste comptée.
  const frozenAtMs = Date.now();
  const pauseClock: PauseClock = { sinceMs: autoPaused && state.pauseClock ? state.pauseClock.sinceMs : frozenAtMs, frozenAtMs };
  belowSinceMs = null;
  // En pause dès l'appui : le GPS restant allumé, une position arrivée pendant l'écriture du journal ne serait pas gardée.
  setState({ status: 'paused', pausedReason: 'manual', pauseClock });
  if (gpsWatchOn) applyGpsWatch(gpsWatchOnPause(gpsWatch));
  if (beltWatchOn) applyBeltWatch(gpsWatchOnPause(beltWatch));
  pendingLines += journalPauseLine(frozenAtMs, frozenAtMs - pauseClock.sinceMs);
  await flushJournal();
  if (state.measuringMotion) await pauseMotionCapture().catch(() => setState({ error: SENSORS_PAUSE_ERROR }));
});

/** Reprend après une pause manuelle : le prochain point gardé ouvre un nouveau segment. La source n'est relancée que si elle s'est arrêtée. */
export const resumeRecording = exclusive(async (): Promise<void> => {
  if (!isManualPause(state) || state.activity === null || currentProfile === null) {
    return;
  }
  belowSinceMs = null;
  if (stopSource !== null) {
    // Le GPS est resté allumé pendant la pause : la position suivante ouvre le segment. Jusque-là, la carte reste sur
    // la dernière position reçue en pause (`pauseFixes`, vidé au premier point gardé), pas sur le point de la pause.
    markManualResume();
    const sensorsFailed = state.measuringMotion && await resumeMotionCapture().then(() => false, () => true);
    setState({ status: 'recording', pausedReason: null, pauseClock: null, ...(sensorsFailed ? { error: SENSORS_RESUME_ERROR } : {}) });
    if (gpsWatchOn) applyGpsWatch(gpsWatchOnResume(gpsWatch, Date.now(), currentProfile));
    if (beltWatchOn) applyBeltWatch(gpsWatchOnResume(beltWatch, Date.now(), beltWatchSettings(currentProfile)));
    return;
  }
  if (currentSource === null) return;
  pauseFixes = [];
  const activity = state.activity;
  const source = currentSource;
  const profile = currentProfile;
  try {
    markManualResume();
    sourceError = null;
    stopSource = await source.start(sourceOptions(activity, profile), receiveFix, onSourceError);
    const sensorsFailed = state.measuringMotion && await resumeMotionCapture().then(() => false, () => true);
    // L'erreur de la source peut arriver avant la fin du démarrage (localisation coupée) : elle reste affichée.
    setState({ status: 'recording', pausedReason: null, pauseClock: null, error: sourceError ?? (sensorsFailed ? SENSORS_RESUME_ERROR : null) });
    if (gpsWatchOn) applyGpsWatch(gpsWatchOnResume(gpsWatch, Date.now(), profile));
    if (beltWatchOn) applyBeltWatch(gpsWatchOnResume(beltWatch, Date.now(), beltWatchSettings(profile)));
  } catch (err) {
    pendingBreak = false;
    manualBreakAutoPartMs = null;
    // Toujours en pause : la levée déjà écrite au journal est démentie.
    const clock = state.pauseClock;
    if (clock?.frozenAtMs != null) pendingLines += journalPauseLine(clock.frozenAtMs, clock.frozenAtMs - clock.sinceMs);
    void flushJournal();
    setState({ error: `Reprise impossible : ${errorMessage(err, 'erreur inconnue')}` });
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
  currentProfile = profile;
  belowSinceMs = null;
  pendingLines += journalActivityLine(activity.base, activity);
  const patch: Partial<RecorderState> = { sport: activity.base, activity };
  // En pause automatique, une activité qui n'en a pas ne la lèverait jamais : l'enregistrement reprend.
  if (isAutoPause(state) && profile.autoPauseSpeedMs <= 0) {
    pendingBreak = true;
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
  const fix = lastReceivedFix ?? getLastFix();
  if (!fix) return null;
  // À l'heure des positions, pas à celle de l'horloge (qui en diffère pendant un rejeu) : celle de la dernière
  // position, plus le temps écoulé depuis sa réception (pause manuelle).
  const sinceFixMs = fix === lastReceivedFix && lastReceivedAtMs !== null ? Math.max(0, Date.now() - lastReceivedAtMs) : 0;
  const mark: SessionMark = { timeMs: fix.timeMs + sinceFixMs, lat: fix.lat, lon: fix.lon, label: null };
  marks = [...marks, mark];
  setState({ marks });
  pendingLines += journalNoteLine(mark);
  void flushJournal();
  return { mark, n: marks.length };
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
  const lost = 'la session sera rangée sans les mesures des capteurs (sauts ou pumping).';
  if (failure !== null) return `Capteurs : arrêt impossible (${failure}), ${lost}`;
  if (capture === null) return `Capteurs : la mesure s'était arrêtée, ${lost}`;
  if (capture.error !== null) {
    return `Capteurs : écriture interrompue (${capture.error}), leurs mesures sont incomplètes : sauts ou pumping peuvent manquer.`;
  }
  if (capture.samples === 0) return `Capteurs : aucune mesure reçue, ${lost}`;
  return null;
};

/** Deux messages à la suite, l'un ou l'autre absent. */
const joinMessages = (first: string | null, second: string | null): string | null =>
  first && second ? `${first} ${second}` : first ?? second;

/** Arrête l'enregistrement, après la pause ou la reprise en cours s'il y en a une (`afterCurrent`). */
export const stopRecording = afterCurrent(async (): Promise<void> => {
  if ((state.status !== 'recording' && state.status !== 'paused') || state.activity === null) return;
  const activity = state.activity;
  const stoppedAtMs = Date.now();
  stopGpsWatch();
  stopBeltWatch();
  // Les alertes de perte du GPS et de la FC ne survivent pas à l'enregistrement.
  setState({ status: 'stopping', gpsLost: false, beltLost: false, error: withoutBeltLost(withoutGpsLost(state.error)) });
  // Écrit avant de couper le GPS : une chute d'ici la fin ne propose ni reprise ni « Continuer ».
  pendingLines += journalStopLine(stoppedAtMs);
  await flushJournal();
  try {
    await stopSource?.();
  } catch {
    // La source est peut-être déjà arrêtée (arrêt normal, ou pause manuelle) : on termine quand même.
  }
  stopSource = null;
  currentSource = null;
  currentProfile = null;
  const measuringMotion = state.measuringMotion;
  let motionFailure: string | null = null;
  const motion = measuringMotion
    ? await stopMotionCapture().catch((err: unknown) => {
      motionFailure = errorMessage(err, 'erreur inconnue');
      return null;
    })
    : null;
  const motionWarning = measuringMotion ? motionCaptureWarning(motion, motionFailure) : null;
  // Session reprise sans capture qui tourne : celle d'avant la coupure, s'il y en a une, reste dans son fichier.
  const keptMotion = measuringMotion ? motion : resumedSession ? await findMotionCapture(startedAtMs).catch(() => null) : null;
  resumedSession = false;
  releaseRecordingBelt();

  try {
    const pending = await buildPendingSession(activity, splitIntoSegments(fixes, segmentBreaks), false, [...marks], keptMotion);
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
      error: `Construction du GPX impossible : ${errorMessage(err, 'erreur inconnue')}. Le journal est gardé et sera repris au prochain démarrage.`,
    });
  }
  fixes = [];
  segmentBreaks = [];
  pauseFixes = [];
  marks = [];
  sourceError = null;
});

/** Trace de l'enregistrement en cours, un tableau par segment continu : la carte et les statistiques en direct. */
export const getLiveSegments = (): LocationFix[][] => (isBusy() ? splitIntoSegments(fixes, segmentBreaks) : []);

/** Positions de l'enregistrement en cours, toutes pauses confondues, sans recopie : à ne pas modifier. */
export const getLiveFixes = (): ReadonlyArray<LocationFix> => (isBusy() ? fixes : []);

/** Dernière position gardée de l'enregistrement en cours. */
export const getLastFix = (): LocationFix | null => (isBusy() && fixes.length > 0 ? fixes[fixes.length - 1] : null);

/** Position de la carte du direct : la dernière gardée, ou en pause manuelle la dernière reçue (`shownLiveFix`). */
export const getLivePosition = (): LocationFix | null => (isBusy() ? shownLiveFix(fixes[fixes.length - 1] ?? null, pauseFixes) : null);

const subscribeToLivePosition = (listener: () => void): (() => void) => {
  const fromState = subscribe(listener);
  const fromPause = pausePositionListeners.subscribe(listener);
  return () => {
    fromState();
    fromPause();
  };
};

/**
 * Position de la carte du direct, pour la carte seule (point 210) : redessine à chaque position gardée, et en pause
 * manuelle à chaque position reçue ; `null` au repos.
 */
export const useLivePosition = (): LocationFix | null => useSyncExternalStore(subscribeToLivePosition, getLivePosition);

/** Positions d'où la carte tire le cap de sa flèche : en pause manuelle, celles reçues depuis le point de la pause. */
export const getLiveHeadingFixes = (): ReadonlyArray<LocationFix> => (isBusy() ? headingFixes(fixes, pauseFixes) : []);

/** Nombre de segments de l'enregistrement en cours : la dernière position gardée est dans le dernier. */
export const getLiveSegmentCount = (): number => (isBusy() ? segmentCount(fixes.length, segmentBreaks) : 0);

/** Efface le compte rendu de la dernière session et le dernier message d'erreur. */
export const dismissRecorderResult = (): void => setState({ saved: null, error: null });

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
