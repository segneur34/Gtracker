import type { Activity } from '../../core/activities';
import { t } from '../../core/i18n';
import type { SessionMark } from '../../core/sessionMarks';
import type { RecordingProfile } from '../../core/sportProfiles';
import type { SportType } from '../../core/types';
import type { BeltState, HeartRateBelt } from '../../platform/heartRate';
import type { BeltAside } from '../../recording/recordingRetry';
import type { LocationFix, LocationSource, StopLocation } from '../../platform/location';
import type { MotionCapture, MotionSetup } from '../../platform/motion';
import { EMPTY_RECORDING_STATS, type PauseClock, type RecordingStats } from '../../recording/session';
import { createListeners } from '../createStore';

/**
 * État de l'enregistreur, partagé par toutes les parties de `hooks/recorder/` et par le point d'entrée
 * `hooks/useRecorder.ts` : l'état publié et ses abonnés, et la file des commandes (démarrage, pause, reprise, arrêt),
 * qu'une reprise après coupure doit pouvoir tenir comme un départ.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';

/**
 * Session terminée, pas encore rangée : elle se range seule (`finishPendingSession`), sauf une session reprise
 * qui peut continuer ; après un rangement en échec, l'utilisateur l'analyse (nouvel essai) ou la supprime.
 */
export interface PendingSession {
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

/** Session rangée, seule à l'arrêt ou par « Analyser ». */
export interface SavedSession {
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
  /** Session arrêtée, pas encore rangée (`PendingSession`) ; aucun nouvel enregistrement d'ici là. */
  pending: PendingSession | null;
  /** La capture de cette session existe mais n'a pas pu être lue au rangement : `analyzePendingSession(true)` la laisse de côté. */
  motionUnreadable: boolean;
  /** Vrai pendant le rangement de la session en attente (`finishPendingSession`, `analyzePendingSession`) : « Rangement… ». */
  analyzing: boolean;
  saved: SavedSession | null;
  /**
   * L'analyse de `saved` a été ouverte (`markRecorderResultOpened`) : son message y est dit, pas sur Enregistrer.
   * Faux tant qu'elle ne l'est pas (ouverture refusée pour un brouillon, session hors mémoire ou à classer) : la carte
   * « Session rangée » d'Enregistrer l'annonce alors, avec son message.
   */
  resultOpened: boolean;
  error: string | null;
  /** GPS perdu : plus de position depuis le délai du profil ; effacé à la position suivante. */
  gpsLost: boolean;
  /** Aucune position reçue depuis le départ, ou depuis la reprise d'un journal ; effacé à la première. */
  awaitingFix: boolean;
  /** Localisation du téléphone coupée, dite par la source ; effacé à son retour, dit par la source, ou à la position suivante. */
  locationOff: boolean;
  /**
   * Le GPS se cale (`recording/gpsSettle.ts`) : incertitude, en mètres, de la dernière position reçue, que la trace ne
   * garde pas encore ; `null` hors calage (avant toute position, une fois la trace commencée, au repos).
   */
  settlingAccuracyM: number | null;
  /** Vrai quelques secondes après « Réessayer » du GPS : « nouvelle tentative… » (`GPS_RETRY_FEEDBACK_MS`). */
  gpsRetrying: boolean;
  /** FC perdue : plus de mesure lisible d'une ceinture qui en donnait ; effacé à la mesure suivante. */
  beltLost: boolean;
  /** Ceinture de la session laissée de côté : injoignable (`failed`) ou plus cherchée (`stopped`) ; `null` sinon. */
  beltAside: BeltAside;
  /** Vrai pendant un nouvel essai ou une reprise de la ceinture demandés par la page : « nouvelle tentative… ». */
  beltRetrying: boolean;
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
  resultOpened: false,
  error: null,
  gpsLost: false,
  awaitingFix: false,
  locationOff: false,
  settlingAccuracyM: null,
  gpsRetrying: false,
  beltLost: false,
  beltAside: null,
  beltRetrying: false,
  resuming: false,
  landOnRecording: false,
};

/** Liaison vivante : les parties la lisent à jour, seul `setState` la remplace. */
export let state = INITIAL_STATE;
/**
 * Un abonné qui lève n'interrompt pas l'appelant : sans quoi l'arrêt resterait sur « stopping », GPS allumé, ou la
 * position gardée sauterait l'écriture du journal.
 */
const listeners = createListeners({ safe: true });

export const setState = (patch: Partial<RecorderState>): void => {
  state = { ...state, ...patch };
  listeners.notify();
};

export const subscribe = listeners.subscribe;

/** État de l'enregistreur, hors React. */
export const getRecorderState = (): RecorderState => state;

/** Changements d'état de l'enregistreur, hors React ; rend le désabonnement. */
export const subscribeToRecorder = (listener: () => void): (() => void) => subscribe(listener);

/** Abonnés aux positions reçues ; un abonné en échec n'arrête pas l'enregistrement. */
export const fixListeners = createListeners<[LocationFix]>({ safe: true });

/**
 * Chaque position nouvelle reçue pendant l'enregistrement, pause
 * automatique comprise (la source tourne encore) : la seule boucle sûre
 * écran éteint. Rend le désabonnement.
 */
export const subscribeToFixes = (listener: (fix: LocationFix) => void): (() => void) => fixListeners.subscribe(listener);

/** Abonnés aux positions de la pause manuelle (la carte du direct, `useLivePosition`). */
export const pausePositionListeners = createListeners({ safe: true });

/**
 * Enregistrement en cours, partagé par toutes les parties de l'enregistreur : un seul objet, modifié en place,
 * car une variable importée ne se réaffecte pas.
 */
interface LiveSession {
  fixes: LocationFix[];
  /** Indices, dans `fixes`, où reprend un nouveau segment (une pause à chacun). */
  segmentBreaks: number[];
  stopSource: StopLocation | null;
  /** Source active, gardée pour relancer une pause manuelle sans la redemander à la page. */
  currentSource: LocationSource | null;
  /** Réglage effectif de la session en cours : celui de son activité, relu quand elle change. */
  currentProfile: RecordingProfile | null;
  /**
   * Dernière position reçue, redélivrances comprises : distinct de
   * `stats.lastMs`, qui gèle pendant une pause alors que la source continue
   * d'envoyer des positions (pause automatique).
   */
  lastReceivedMs: number | null;
  /** Position de `lastReceivedMs` : celle d'un repère posé en pause automatique, où rien n'est gardé dans `fixes`. */
  lastReceivedFix: LocationFix | null;
  /** Instant de réception de `lastReceivedFix`, à l'horloge : l'heure d'un repère en suit l'écart. */
  lastReceivedAtMs: number | null;
  /** Depuis quand la vitesse est sous le seuil d'auto-pause, ou `null`. */
  belowSinceMs: number | null;
  /** Une pause vient de se terminer : le prochain point gardé ouvre un nouveau segment. */
  pendingBreak: boolean;
  /**
   * Le saut vient d'une pause manuelle : la part de l'écart passée en pause automatique avant
   * l'appui sur Pause (qui reste comptée), `null` sinon. Le premier point gardé retranche le reste de la durée.
   */
  manualBreakAutoPartMs: number | null;
  /** La session vient d'un journal relu : à l'arrêt, une capture d'avant la coupure se retrouve par son fichier. */
  resumedSession: boolean;
  /** Positions reçues pendant la pause manuelle en cours, pour la carte seule : jamais gardées. */
  pauseFixes: LocationFix[];
  /** Le GPS s'est calé : une position a été jugée calée, le calage ne joue plus (`judgeSettle`). */
  settled: boolean;
  /** Pendant le calage, heure de la première position vue, `null` avant elle ou hors calage. */
  settleFirstMs: number | null;
  /** Dernière position reçue pendant le calage, pour la carte seule : jamais gardée ; `null` hors calage. */
  settlingFix: LocationFix | null;
  /** Instant du démarrage, à l'horloge : le nom de la capture des capteurs et le début des repères d'une session reprise. */
  startedAtMs: number;
  /** Repères posés pendant l'enregistrement, dans l'ordre. */
  marks: SessionMark[];
  /** Écart toléré entre une mesure de la ceinture et une position, en secondes ; `null` sans ceinture. */
  heartRateMaxAgeS: number | null;
  /** Rend la ceinture et se désabonne de ses mesures ; `null` sans ceinture. */
  dropBelt: (() => void) | null;
  /**
   * Ceinture demandée par la session et son écart toléré, gardés même quand elle est rendue (injoignable, plus
   * cherchée) : « Réessayer » et « Reprendre la ceinture » la redemandent. `null` si la session n'en a pas.
   */
  recordingBelt: { belt: HeartRateBelt; maxAgeS: number } | null;
  /** Message de la ceinture injoignable affiché dans l'alerte, retiré seul à la reprise ou à l'abandon ; `null` sinon. */
  beltError: string | null;
  /** Dernière erreur signalée par la source (localisation coupée…), effacée de l'état à la position suivante. */
  sourceError: string | null;
}

export const session: LiveSession = {
  fixes: [],
  segmentBreaks: [],
  stopSource: null,
  currentSource: null,
  currentProfile: null,
  lastReceivedMs: null,
  lastReceivedFix: null,
  lastReceivedAtMs: null,
  belowSinceMs: null,
  pendingBreak: false,
  manualBreakAutoPartMs: null,
  resumedSession: false,
  pauseFixes: [],
  settled: false,
  settleFirstMs: null,
  settlingFix: null,
  startedAtMs: 0,
  marks: [],
  heartRateMaxAgeS: null,
  dropBelt: null,
  recordingBelt: null,
  beltError: null,
  sourceError: null,
};

/** Échec de la pause de la capture des capteurs. */
export const SENSORS_PAUSE_ERROR = t('Capteurs : pause impossible, la mesure continue pendant la pause');
/** Échec de la reprise de la capture des capteurs. */
export const SENSORS_RESUME_ERROR = t('Capteurs : reprise impossible, sauts arrêtés');
/** Session reprise après une coupure, capture qui ne repart pas : ce qu'elle a mesuré avant reste dans son fichier. */
export const CAPTURE_NOT_RESUMED = t("Capteurs : la mesure ne reprend pas ; ce qu'ils ont mesuré avant la coupure est gardé.");

/** Deux messages à la suite, l'un ou l'autre absent. */
export const joinMessages = (first: string | null, second: string | null): string | null =>
  first && second ? `${first} ${second}` : first ?? second;

export const isBusy = (): boolean => state.status !== 'idle';

/** Commande en cours (démarrage, pause, reprise, arrêt), levée à sa fin ; `null` sans commande. */
let running: Promise<void> | null = null;

/** Vrai pendant une commande : une reprise lancée depuis un départ ne reprend pas la place qu'il tient déjà. */
export const isCommandRunning = (): boolean => running !== null;

/** Lance la commande en prenant la place de la commande en cours, rendue à sa fin, même en échec. */
export const runCommand = (command: () => Promise<void>): Promise<void> => {
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
export const exclusive = <A extends unknown[]>(command: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  if (running) return;
  await runCommand(() => command(...args));
};

/**
 * Arrêt : attend la commande en cours (pause ou reprise lancée juste avant),
 * puis prend la place ; une pause ou une reprise demandée pendant l'arrêt est
 * ignorée. Sans cela, une pause finie après l'arrêt reposerait « en pause »,
 * ou une reprise relancerait le GPS d'une session déjà arrêtée.
 */
export const afterCurrent = <A extends unknown[]>(command: (...args: A) => Promise<void>) => async (...args: A): Promise<void> => {
  while (running) await running;
  await runCommand(() => command(...args));
};
