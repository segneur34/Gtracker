import { roundBearingDeg } from '../core/angles';
import { bandIndex } from '../core/basics';
import { sportTreatment, type Treatment } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import {
  formatClock, formatDistance, formatShortDistance, formatSpeed, formatTimeOfDay, type DistanceUnit, type SpeedUnit,
} from '../core/units';
import { LIVE_STATS_DEFAULTS, type LiveStats, type LiveStatsOptions } from './liveStats';

/**
 * Chiffres en grand de l'enregistrement quand la carte est réduite, choisis
 * par activité dans Réglages : jusqu'à `MAX_LIVE_FIELDS`, parmi ceux qui ont
 * un sens pour son traitement. Un chiffre inconnu de ce catalogue est écarté
 * à la lecture.
 * Ceux de la notification de l'enregistrement viennent du même catalogue,
 * choisis à part, `MAX_NOTIFICATION_FIELDS` au plus, avec en plus ceux qui
 * ne vont qu'à elle (`NOTIFICATION_ONLY_FIELDS`). Libellés et valeurs sont
 * formatés ici, dans les unités de l'activité.
 */

export type LiveFieldKey =
  | 'speed' | 'average' | 'max' | 'recentDistanceSpeed' | 'lastDistance' | 'distance' | 'duration' | 'clock'
  | 'remaining' | 'remainingTime'
  | 'recentTopShort' | 'recentTopLong' | 'heading' | 'legAverage' | 'markDistance' | 'markBearing'
  | 'heartRate' | 'averageHeartRate' | 'heartRateZone';

const ALL: Treatment[] = ['voile', 'surf'];

/** Traitements où chaque chiffre a un sens ; l'ordre est celui des menus de Réglages. */
const LIVE_FIELD_TREATMENTS: Record<LiveFieldKey, readonly Treatment[]> = {
  speed: ALL,
  average: ALL,
  max: ALL,
  recentDistanceSpeed: ALL,
  lastDistance: ALL,
  recentTopShort: ['voile'],
  recentTopLong: ['voile'],
  legAverage: ['voile'],
  heading: ['voile'],
  markDistance: ['voile', 'surf'],
  markBearing: ['voile', 'surf'],
  heartRate: ALL,
  averageHeartRate: ALL,
  heartRateZone: ALL,
  distance: ALL,
  duration: ALL,
  clock: ALL,
  remaining: ALL,
  remainingTime: ALL,
};

/**
 * Chiffres de la notification seulement, pas de la carte réduite ; aucun
 * depuis le retrait de l'étape du compteur et des tests (lot 302).
 */
const NOTIFICATION_ONLY_FIELDS: readonly LiveFieldKey[] = [];

/** Où un chiffre se lit : la carte réduite de l'enregistrement, ou la notification. */
export type LiveFieldTarget = 'live' | 'notification';

const allowedFor = (key: LiveFieldKey, treatment: Treatment, target: LiveFieldTarget): boolean =>
  LIVE_FIELD_TREATMENTS[key].includes(treatment) && (target === 'notification' || !NOTIFICATION_ONLY_FIELDS.includes(key));

const LIVE_FIELD_KEYS = Object.keys(LIVE_FIELD_TREATMENTS) as LiveFieldKey[];

/** Chiffres proposés pour un traitement, dans l'ordre des menus. */
export const liveFieldsOfTreatment = (treatment: Treatment, target: LiveFieldTarget = 'live'): LiveFieldKey[] =>
  LIVE_FIELD_KEYS.filter((key) => allowedFor(key, treatment, target));

/** Nombre de lignes au plus. */
export const MAX_LIVE_FIELDS = 4;

/** Lignes à défaut de choix. */
export const DEFAULT_LIVE_FIELDS: Record<Treatment, LiveFieldKey[]> = {
  voile: ['speed', 'average', 'max'],
  surf: ['speed', 'max', 'duration'],
};

/**
 * Lignes propres à un calcul, avant celles de son traitement : en bateau
 * (21/10), vitesse, moyenne, distance et cap.
 */
const SPORT_LIVE_FIELDS: Partial<Record<SportType, LiveFieldKey[]>> = {
  bateau: ['speed', 'average', 'distance', 'heading'],
};

/** Lignes d'un calcul à défaut de choix : les siennes, sinon celles de son traitement. */
export const defaultLiveFieldsOf = (sport: SportType): LiveFieldKey[] =>
  SPORT_LIVE_FIELDS[sport] ?? DEFAULT_LIVE_FIELDS[sportTreatment(sport)];

/** Chiffres de la notification de l'enregistrement au plus : écran verrouillé, Android coupe la ligne au-delà de deux. */
export const MAX_NOTIFICATION_FIELDS = 2;

/** Chiffres de la notification à défaut de choix, les mêmes pour tous les traitements. */
export const DEFAULT_NOTIFICATION_FIELDS: Record<Treatment, LiveFieldKey[]> = {
  voile: ['speed', 'distance'],
  surf: ['speed', 'distance'],
};

/** Chiffres de la notification propres à un calcul, avant ceux de son traitement ; aucun pour l'instant. */
const SPORT_NOTIFICATION_FIELDS: Partial<Record<SportType, LiveFieldKey[]>> = {};

/** Chiffres de la notification d'un calcul à défaut de choix : les siens, sinon ceux de son traitement. */
export const defaultNotificationFieldsOf = (sport: SportType): LiveFieldKey[] =>
  SPORT_NOTIFICATION_FIELDS[sport] ?? DEFAULT_NOTIFICATION_FIELDS[sportTreatment(sport)];

const isLiveFieldKey = (value: unknown): value is LiveFieldKey =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(LIVE_FIELD_TREATMENTS, value);

/**
 * Choix rangé, nettoyé : clés connues et permises pour le traitement et la
 * cible, sans doublon, `max` au plus ; `null` s'il n'en reste aucune (le
 * défaut s'applique).
 */
export const sanitizeLiveFields = (
  value: unknown, treatment: Treatment, max = MAX_LIVE_FIELDS, target: LiveFieldTarget = 'live',
): LiveFieldKey[] | null => {
  if (!Array.isArray(value)) return null;
  const kept: LiveFieldKey[] = [];
  for (const key of value) {
    if (kept.length === max) break;
    if (isLiveFieldKey(key) && allowedFor(key, treatment, target) && !kept.includes(key)) kept.push(key);
  }
  return kept.length > 0 ? kept : null;
};

export interface LiveFieldUnits {
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  /**
   * Options du calcul du direct dont les chiffres viennent (fenêtres, durées
   * des tops, distances) : les libellés les disent. Absentes : celles par
   * défaut (`LIVE_STATS_DEFAULTS`), comme dans Réglages.
   */
  options?: LiveStatsOptions;
}

/** « 5 min » : la fenêtre des chiffres récents du direct. */
export const recentWindowLabel = (options: LiveStatsOptions = LIVE_STATS_DEFAULTS): string =>
  `${Math.round(options.recentWindowS / 60)} min`;

/** Libellé d'un chiffre. */
export const liveFieldLabel = (key: LiveFieldKey, { distanceUnit, options = LIVE_STATS_DEFAULTS }: LiveFieldUnits): string => {
  const [topShortS, topLongS] = options.topDurationsS;
  switch (key) {
    case 'speed': return 'Vitesse';
    case 'average': return options.activeAverage ? 'Moyenne active' : 'Moyenne';
    case 'max': return `Max (${options.maxDurationS} s)`;
    case 'recentDistanceSpeed': return `${options.recentDistanceM} derniers m`;
    case 'lastDistance': return distanceUnit === 'nm' ? 'Dernier mille' : 'Dernier km';
    case 'distance': return 'Distance';
    case 'duration': return 'Durée';
    case 'clock': return 'Heure';
    case 'remaining': return 'Restant';
    case 'remainingTime': return 'Temps restant';
    case 'recentTopShort': return `Top ${topShortS} s (${recentWindowLabel(options)})`;
    case 'recentTopLong': return `Top ${topLongS} s (${recentWindowLabel(options)})`;
    case 'heading': return 'Cap';
    case 'legAverage': return 'Moyenne du bord';
    case 'markDistance': return 'Balise';
    case 'markBearing': return 'Cap balise';
    case 'heartRate': return 'Fréquence cardiaque';
    case 'averageHeartRate': return 'FC moyenne';
    case 'heartRateZone': return 'Zone cardiaque';
  }
};

/** Libellé court d'un chiffre, devant sa valeur sur la ligne repliée de la notification. */
export const liveFieldShortLabel = (key: LiveFieldKey, { distanceUnit, options = LIVE_STATS_DEFAULTS }: LiveFieldUnits): string => {
  const [topShortS, topLongS] = options.topDurationsS;
  switch (key) {
    case 'speed': return 'Vit.';
    case 'average': return options.activeAverage ? 'Moy. act.' : 'Moy.';
    case 'max': return 'Max';
    case 'recentDistanceSpeed': return `${options.recentDistanceM} m`;
    case 'lastDistance': return distanceUnit === 'nm' ? 'Dern. mille' : 'Dern. km';
    case 'distance': return 'Dist.';
    case 'duration': return 'Durée';
    case 'clock': return 'Heure';
    case 'remaining': return 'Reste';
    case 'remainingTime': return 'Temps rest.';
    case 'recentTopShort': return `Top ${topShortS} s`;
    case 'recentTopLong': return `Top ${topLongS} s`;
    case 'heading': return 'Cap';
    case 'legAverage': return 'Bord';
    case 'markDistance': return 'Balise';
    case 'markBearing': return 'Cap bal.';
    case 'heartRate': return 'FC';
    case 'averageHeartRate': return 'FC moy.';
    case 'heartRateZone': return 'Zone';
  }
};

export interface LiveFieldContext extends LiveFieldUnits {
  stats: LiveStats;
  /** Durée de l'enregistrement, en millisecondes. */
  durationMs: number;
  /** Instant du dernier calcul, pour l'heure ; `null` avant le premier. */
  nowMs: number | null;
  /** Distance restante sur la trace suivie, en mètres ; `null` sans trace ou avant de l'avoir rejointe. */
  remainingM: number | null;
  /** Cap de la marche, en degrés ; `null` s'il n'est pas connu. */
  headingDeg: number | null;
  /** Distance et cap vers la balise visée d'un parcours de voile ; `null` sans guidage. */
  markDistanceM: number | null;
  markBearingDeg: number | null;
  /** Fréquence de la ceinture cardio, en battements par minute ; `null` sans ceinture ou sans mesure. */
  heartRateBpm: number | null;
  /** Bornes basses des zones cardiaques 1 à 5 du pratiquant, en bpm ; `null` s'il n'en a pas. */
  heartRateZoneBounds: readonly number[] | null;
}

const NONE = '—';

/** Valeur d'un chiffre, formatée dans les unités de l'activité ; « — » quand elle manque. */
export const liveFieldValue = (key: LiveFieldKey, ctx: LiveFieldContext): string => {
  const { stats, speedUnit, distanceUnit } = ctx;
  switch (key) {
    case 'speed': return formatSpeed(stats.currentSpeedMs, speedUnit);
    case 'average': return formatSpeed(ctx.options?.activeAverage ? stats.activeAverageSpeedMs : stats.averageSpeedMs, speedUnit);
    case 'max': return formatSpeed(stats.maxSpeedMs, speedUnit);
    case 'recentDistanceSpeed': return formatSpeed(stats.recentDistanceSpeedMs, speedUnit);
    case 'lastDistance': return formatSpeed(stats.lastDistanceSpeedMs, speedUnit);
    case 'distance': return formatDistance(stats.distanceM, distanceUnit);
    case 'duration': return formatClock(ctx.durationMs);
    case 'clock': return ctx.nowMs === null ? NONE : formatTimeOfDay(ctx.nowMs).slice(0, 5);
    case 'remaining': return ctx.remainingM === null ? NONE : formatDistance(ctx.remainingM, distanceUnit);
    case 'remainingTime': {
      // Hors pauses, jamais la moyenne active : elle rendrait l'heure d'arrivée trop optimiste.
      const speed = stats.averageSpeedMs;
      return ctx.remainingM === null || speed === null || speed <= 0 ? NONE : formatClock((ctx.remainingM / speed) * 1000);
    }
    case 'recentTopShort': return formatSpeed(stats.recentTopsMs[0] ?? null, speedUnit);
    case 'recentTopLong': return formatSpeed(stats.recentTopsMs[1] ?? null, speedUnit);
    case 'heading': return ctx.headingDeg === null ? NONE : `${roundBearingDeg(ctx.headingDeg)}°`;
    case 'legAverage': return stats.legs.current ? formatSpeed(stats.legs.current.averageSpeedMs, speedUnit) : NONE;
    case 'markDistance': return ctx.markDistanceM === null ? NONE : formatShortDistance(ctx.markDistanceM, distanceUnit);
    case 'markBearing': return ctx.markBearingDeg === null ? NONE : `${roundBearingDeg(ctx.markBearingDeg)}°`;
    case 'heartRate': return ctx.heartRateBpm === null ? NONE : `${Math.round(ctx.heartRateBpm)} bpm`;
    case 'averageHeartRate': return stats.averageHeartRateBpm === null ? NONE : `${Math.round(stats.averageHeartRateBpm)} bpm`;
    case 'heartRateZone': {
      if (ctx.heartRateBpm === null || ctx.heartRateZoneBounds === null) return NONE;
      const bpm = Math.round(ctx.heartRateBpm);
      const zone = bandIndex(bpm, ctx.heartRateZoneBounds);
      return `${zone === 0 ? 'sous Z1' : `Z${zone}`} · ${bpm}`;
    }
  }
};
