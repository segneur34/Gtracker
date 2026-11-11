import { clearRecordingNotification, updateRecordingNotification } from '../platform/notification';
import { travelHeading } from '../recording/heading';
import type { LiveFieldContext } from '../recording/liveFields';
import { liveNotification, liveNotificationKey, notificationStateKey } from '../recording/liveNotification';
import { displayedDurationMs } from '../recording/session';
import { getLiveRecording, liveStatsOptionsFor, subscribeToLiveRecording } from './useLiveRecording';
import { getMarkGuideView } from './useMarkGuide';
import { getLiveFixes, getRecorderState, subscribeToFixes, subscribeToRecorder } from './useRecorder';
import { readHeartRateZoneBounds } from './useAthleteProfile';
import { effectiveDistanceUnit, effectiveNotificationFields, effectiveSpeedUnit } from './useSportSettings';

/**
 * Notification de l'enregistrement, tenue hors des composants : elle vit
 * écran éteint, page fermée. Les chiffres choisis pour l'activité dans
 * Réglages (`effectiveNotificationFields`) y sont repris du direct
 * (`useLiveRecording`), sans calcul en double ; le texte est composé par
 * `liveNotification` et posé par `platform/notification.ts`.
 *
 * Rythme : à l'arrivée des positions et des recalculs du direct, au plus
 * toutes les `MIN_UPDATE_MS`, et seulement si le texte change ; tout de suite
 * à un changement d'état (pause, reprise, pause automatique, GPS perdu ou revenu, FC perdue ou revenue, activité),
 * et au premier calcul du direct. Le chronomètre d'Android fait tourner la durée entre deux envois.
 *
 * Le service GPS pose sa propre notification à son démarrage, au départ : la
 * première position qui suit la fait récrire. En pause manuelle, le service tourne encore (la carte du
 * direct suit le coureur, lot 104) mais ses positions ne viennent pas ici : la
 * notification « en pause » est posée seule, figée ; elle est effacée à
 * l'arrêt de l'enregistrement.
 */

/** Intervalle minimal entre deux envois sans changement d'état, en millisecondes. */
const MIN_UPDATE_MS = 5000;

/** Dernier envoi : sa clé et son instant. */
let sentKey: string | null = null;
let sentAtMs = 0;
/** État du dernier envoi (pause, activité) : un changement part tout de suite. */
let sentStateKey: string | null = null;
/** Une notification de l'application est peut-être affichée. */
let shown = false;
/** Le service GPS vient de (re)démarrer : sa notification est à récrire à la prochaine position. */
let rewriteOnFix = false;
/** État de l'enregistreur au changement précédent. */
let previous = { status: getRecorderState().status, pausedReason: getRecorderState().pausedReason, pointCount: getRecorderState().stats.pointCount };

const clear = () => {
  sentKey = null;
  sentStateKey = null;
  if (!shown) return;
  shown = false;
  void clearRecordingNotification().catch(() => {});
};

const update = (force: boolean) => {
  const recorder = getRecorderState();
  const { status, activity } = recorder;
  if ((status !== 'recording' && status !== 'paused') || activity === null) {
    clear();
    return;
  }
  const nowMs = Date.now();
  const live = getLiveRecording();
  // État qui commande un envoi immédiat ; les premiers chiffres du direct aussi.
  const stateKey = notificationStateKey({
    status, pausedReason: recorder.pausedReason, gpsLost: recorder.gpsLost, beltLost: recorder.beltLost, activityId: activity.id, computed: live.updatedMs !== null,
  });
  if (!force && stateKey === sentStateKey && nowMs - sentAtMs < MIN_UPDATE_MS) return;

  const fields = effectiveNotificationFields(activity);
  const mark = getMarkGuideView();
  const context: LiveFieldContext = {
    speedUnit: effectiveSpeedUnit(activity),
    distanceUnit: effectiveDistanceUnit(activity),
    // Libellés sur les options du calcul du direct de l'activité.
    options: liveStatsOptionsFor(activity),
    stats: live.stats,
    durationMs: displayedDurationMs(recorder.stats, recorder.pauseClock, nowMs),
    nowMs,
    remainingM: mark.active ? mark.remainingM : live.progress?.remainingM ?? null,
    // Le cap parcourt la trace : calculé seulement s'il est demandé.
    headingDeg: fields.includes('heading') ? travelHeading(getLiveFixes()).headingDeg : null,
    markDistanceM: mark.active ? mark.distanceM : null,
    markBearingDeg: mark.active ? mark.bearingDeg : null,
    heartRateBpm: recorder.heartRate?.bpm ?? null,
    heartRateZoneBounds: fields.includes('heartRateZone') ? readHeartRateZoneBounds(activity) : null,
  };
  const paused = status === 'paused' ? recorder.pausedReason ?? 'auto' : null;
  const content = liveNotification({
    activityName: activity.name,
    fields,
    context,
    paused,
    gpsLost: recorder.gpsLost,
    beltLost: recorder.beltLost,
    startedAtMs: recorder.stats.firstMs,
  });
  const standalone = paused === 'manual';
  const key = liveNotificationKey(content, standalone);
  if (!force && key === sentKey) return;
  sentKey = key;
  sentStateKey = stateKey;
  sentAtMs = nowMs;
  shown = true;
  void updateRecordingNotification(content, { standalone }).catch(() => {});
};

const onRecorder = () => {
  const { status, pausedReason, stats } = getRecorderState();
  // Départ : le service GPS va poser sa notification (il reste allumé pendant une pause manuelle, lot 104).
  if (status === 'recording' && previous.status === 'starting') rewriteOnFix = true;
  previous = { status, pausedReason, pointCount: stats.pointCount };
  update(false);
};

const onFix = () => {
  const force = rewriteOnFix;
  rewriteOnFix = false;
  update(force);
};

let started = false;

/**
 * Branche la notification sur l'enregistreur ; à appeler une fois au
 * démarrage de l'application. Sans enregistrement, une notification de pause
 * restée après un arrêt brutal est effacée.
 */
export const startRecordingNotification = (): void => {
  if (started) return;
  started = true;
  subscribeToRecorder(onRecorder);
  subscribeToFixes(onFix);
  subscribeToLiveRecording(() => update(false));
  if (getRecorderState().status === 'idle') {
    shown = true;
    clear();
  }
};
