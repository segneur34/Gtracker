import type { SpeedRangeMs } from '../core/speedGradient';
import type { SportType } from '../core/types';
import { kmhToMs, knotsToMs, type SpeedUnit } from '../core/units';
import type { JumpSettings } from '../recording/jumpSettings';
import type { LiveFieldKey } from '../recording/liveFields';
import type { MarkGuideSettings } from '../recording/markGuide';

/**
 * Pré-réglages des activités (21/10) : ce que Réglages montre comme « défaut »
 * tant que l'utilisateur n'a rien changé, repris du téléphone de l'utilisateur
 * (sa référence en cas de doute). Un champ absent garde le défaut du calcul
 * (`sportProfiles.ts`) ; une surcharge de Réglages prime toujours.
 */
export interface ActivityPreset {
  /** Seuil d'activité, dans l'unité du profil du calcul (nœuds en voile, km/h en surf) ; 0 : aucun seuil réglé, arrêts complets ôtés d'office (`stillThreshold`). */
  threshold?: number;
  speedUnit?: SpeedUnit;
  /** Bornes de couleur de la trace, fixes : en voile, elles remplacent la suggestion tirée de l'allure. */
  speedRangeMs?: SpeedRangeMs;
  autoPause?: { speedMs: number; delayS: number };
  liveFields?: LiveFieldKey[];
  notificationFields?: LiveFieldKey[];
  markGuide?: MarkGuideSettings;
  jumps?: JumpSettings;
  /** Virages du surf mesurés par le gyroscope (case « Mesurer les virages »). */
  turns?: boolean;
  heartRate?: boolean;
  /** Onglets des analyses montrés ou cachés à l'écart de ceux du module. */
  tabs?: Record<string, boolean>;
  /** Décalage des seuils cardio par rapport à la référence, en bpm. */
  hrThresholdOffsetBpm?: number;
}

/** Wingfoil, que la planche reprend : 8 nœuds partout (seuil et bas de la couleur), sans suggestion selon l'allure. */
const WING: ActivityPreset = {
  threshold: 8,
  speedRangeMs: { minMs: knotsToMs(8), maxMs: knotsToMs(24) },
  autoPause: { speedMs: kmhToMs(1.5), delayS: 60 },
  liveFields: ['speed', 'average', 'recentTopShort', 'distance'],
  markGuide: {
    curve: [{ distanceM: 5, intervalMs: 100 }, { distanceM: 25, intervalMs: 530 }, { distanceM: 34, intervalMs: 950 }],
    vibrate: true,
  },
  jumps: { enabled: true, placement: 'poitrine', minHeightM: 0.5 },
};

/** Par calcul : toute activité faite sur lui, créée par l'utilisateur comprise. */
const BASE_PRESETS: Partial<Record<SportType, ActivityPreset>> = {
  wingfoil: WING,
  windsurf: WING,
  // Sauts mesurés d'office en voile (05/11), à la hauteur du calcul ; le reste du kite suit son calcul.
  kite: { jumps: { enabled: true, placement: 'poitrine', minHeightM: 1 } },
};

/** Par activité de départ (`core/activities.ts`) : remplace en entier celui de son calcul. */
const ACTIVITY_PRESETS: Partial<Record<string, ActivityPreset>> = {
  // Virages mesurés d'office en surf (lot 40) ; le paddle, le kayak, le downwind, créés sur le même calcul, non.
  surf: { turns: true },
  'a-surf-foil': { turns: true },
};

const NO_PRESET: ActivityPreset = {};

/** Pré-réglage d'une activité : le sien si c'est une activité de départ qui en a un, sinon celui de son calcul. */
export const presetOf = (activity: { id: string; base: SportType }): ActivityPreset =>
  ACTIVITY_PRESETS[activity.id] ?? BASE_PRESETS[activity.base] ?? NO_PRESET;
