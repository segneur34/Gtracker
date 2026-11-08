import {
  ACTIVITIES_VERSION, FAMILY_BASE, SURF_FOIL_ACTIVITY, activitiesOfFamily, activityFamily, activityTreatment, baseActivity, findActivity,
  readActivities, visibleFamilies, type Activity,
} from '../core/activities';
import { PRESET_BASES, presetOf } from './activityPresets';
import {
  SPORT_FAMILIES, defaultActiveThresholdOf, getSportProfile, hasActiveThreshold,
  type RecordingProfile, type SportFamily, type Treatment,
} from '../core/sportProfiles';
import { analysisTabs, isTabShown, sanitizeTabChoices, toggleTabChoice, type TabChoices } from '../core/analysisTabs';
import { isValidSpeedRange, type SpeedRangeMs } from '../core/speedGradient';
import type { SportType } from '../core/types';
import { DISTANCE_UNIT_LABEL, SPEED_UNIT_LABEL, type DistanceUnit, type SpeedUnit } from '../core/units';
import { inRange } from '../core/basics';
import type { BeepSound } from '../recording/beepSound';
import {
  MAX_NOTIFICATION_FIELDS, defaultLiveFieldsOf, defaultNotificationFieldsOf, sanitizeLiveFields, type LiveFieldKey,
} from '../recording/liveFields';
import { MARK_GUIDE_DEFAULTS, sanitizeMarkGuide, type MarkGuideSettings } from '../recording/markGuide';
import { defaultJumpSettings, sanitizeJumpSettings, type JumpSettings } from '../recording/jumpSettings';
import type { GearGroup } from '../library/notes';
import { sanitizeGearGroups, sanitizeGearLabels } from './gear';

/**
 * Réglages d'une activité, purs (lot 72) : défauts tirés du pré-réglage et du
 * calcul, valeurs effectives (`resolve*`) lues sur un `StoredSettings` passé en
 * argument, vue de Réglages, « Par défaut », mise à jour des pré-réglages.
 * Le magasin (`tracker.sportSettings`), sa lecture et ses écritures restent
 * dans `hooks/useSportSettings.ts`.
 */

/** Unités d'affichage proposées selon le traitement du calcul. */
export const SAILING_UNITS: SpeedUnit[] = ['kn', 'kmh', 'ms'];
export const SURF_UNITS: SpeedUnit[] = ['kmh', 'kn', 'ms'];

export const TREATMENT_UNITS: Record<Treatment, SpeedUnit[]> = { voile: SAILING_UNITS, surf: SURF_UNITS };

/**
 * Bornes de couleur d'une activité à défaut de réglage : celles de son pré-réglage
 * (`settings/activityPresets.ts`), sinon celles de son calcul (`SportProfile.speedRange`).
 */
export const defaultSpeedRangeOf = (activity: Activity): SpeedRangeMs =>
  presetOf(activity).speedRangeMs ?? getSportProfile(activity.base).speedRange;

/**
 * Voile : les couleurs suivent l'allure de chaque session tant que ni le
 * pré-réglage ni le calcul (bateau, `speedRangeFollowsPace`) n'en fixent ; le seuil de même.
 */
export const rangeFollowsPace = (activity: Activity): boolean =>
  getSportProfile(activity.base).speedRangeFollowsPace && presetOf(activity).speedRangeMs === undefined;

export const thresholdFollowsPace = (activity: Activity): boolean =>
  activityTreatment(activity) === 'voile' && presetOf(activity).threshold === undefined;


/** Seuil d'activité à défaut de réglage, dans l'unité du profil : celui du pré-réglage (0 : aucun), sinon celui du calcul. */
export const defaultThresholdOf = (activity: Activity, foil: boolean): number =>
  presetOf(activity).threshold ?? defaultActiveThresholdOf(getSportProfile(activity.base), foil);

/** Unité de vitesse à défaut de réglage. */
export const defaultSpeedUnitOf = (activity: Activity): SpeedUnit =>
  presetOf(activity).speedUnit ?? getSportProfile(activity.base).speedUnit;

/** Pause automatique à défaut de réglage (m/s, secondes). */
export const defaultAutoPauseOf = (activity: Activity): { speedMs: number; delayS: number } => {
  const { recording } = getSportProfile(activity.base);
  return presetOf(activity).autoPause ?? { speedMs: recording.autoPauseSpeedMs, delayS: recording.autoPauseDelayS };
};

/** Chiffres du direct à défaut de réglage. */
export const defaultLiveFieldsFor = (activity: Activity): LiveFieldKey[] =>
  presetOf(activity).liveFields ?? defaultLiveFieldsOf(activity.base);

/** Chiffres de la notification à défaut de réglage. */
export const defaultNotificationFieldsFor = (activity: Activity): LiveFieldKey[] =>
  presetOf(activity).notificationFields ?? defaultNotificationFieldsOf(activity.base);

/** Bips d'approche des balises à défaut de réglage. */
export const defaultMarkGuideOf = (activity: Activity): MarkGuideSettings => presetOf(activity).markGuide ?? MARK_GUIDE_DEFAULTS;

/** Virages du surf mesurés par le gyroscope à défaut de réglage (lot 40) : cochés pour Surf et Surf foil. */
export const defaultTurnsOf = (activity: Activity): boolean => presetOf(activity).turns ?? false;

/** Ceinture cardio à défaut de réglage. */
export const defaultHeartRateOf = (activity: Activity): boolean => presetOf(activity).heartRate ?? false;


/** Onglets à défaut de réglage : ceux du pré-réglage, `null` : ceux du module. */
export const defaultTabsOf = (activity: Activity): TabChoices | null => sanitizeTabChoices(presetOf(activity).tabs);

/**
 * Onglets à écrire avec les réglages des sauts `next` : cocher la case
 * (décochée vers cochée seulement) montre l'onglet « sauts » s'il ne l'était
 * pas. `undefined` : rien à écrire ; décocher, ou changer l'emplacement et la
 * hauteur, ne touche pas au choix d'onglets, qui se décoche aussi seul ensuite.
 */
export const tabsAfterJumpsChange = (
  view: Pick<SportSettingsView, 'activity' | 'jumps' | 'tabs'>, next: JumpSettings
): TabChoices | null | undefined => {
  if (view.jumps === null || view.jumps.enabled || !next.enabled) return undefined;
  const tab = analysisTabs(getSportProfile(view.activity.base)).find((t) => t.key === 'sauts');
  if (!tab || isTabShown(tab, view.tabs)) return undefined;
  return toggleTabChoice(view.tabs, tab, defaultTabsOf(view.activity));
};

/**
 * Réglages par activité (`core/activities.ts`) : unité, seuil d'activité,
 * couleurs de trace, pause automatique, rangés sous
 * l'identifiant de l'activité. Le calcul de base ne fournit que les défauts ;
 * la surcharge de l'utilisateur prime et survit au rechargement.
 *
 * Le seuil est volontairement modifiable : 8 nœuds ne vaut qu'en wingfoil, et
 * le réglage fin dépend du matériel et du pratiquant.
 */


/** Réglage rangé par identifiant d'activité. */
export type ByActivity<T> = Partial<Record<string, T>>;

export interface StoredSettings {
  /** Ancienne clé : le support choisi dans le module voile, lu faute de `moduleActivity.voile`. */
  sport?: string;
  /** Activité retenue par chaque module tant qu'aucune session ne l'impose. */
  moduleActivity?: Partial<Record<SportFamily, string>>;
  /** Dernière activité enregistrée, proposée au prochain enregistrement. */
  recordActivity?: string;
  /** Activités de l'utilisateur ; absentes : celles du premier lancement. */
  activities?: Activity[];
  /** Version de la liste des activités (`ACTIVITIES_VERSION`) ; absente : 1. */
  activitiesVersion?: number;
  /** Version des pré-réglages (`PRESETS_VERSION`) des réglages écrits ; absente : 0. */
  presetsVersion?: number;
  /**
   * Familles cachées dans Réglages (§10, point 100) : ni proposées, ni listées ; rien n'est effacé. Chaînes brutes :
   * celles de l'application complète (`FULL_APP_FAMILY_IDS`) sont gardées telles quelles (`readHiddenFamilies`).
   */
  hiddenFamilies?: string[];
  /** Surcharges du seuil d'activité, dans l'unité du profil du calcul ; 0 : aucun seuil réglé, arrêts complets ôtés d'office. */
  thresholds?: ByActivity<number>;
  /** Unité d'affichage des vitesses. */
  speedUnits?: ByActivity<SpeedUnit>;
  /** Unité d'affichage des distances ; absente : kilomètres. */
  distanceUnits?: ByActivity<DistanceUnit>;
  /** Bornes du dégradé de couleur de la trace, en m/s. */
  speedRanges?: ByActivity<{ minMs: number; maxMs: number }>;

  /** Surcharge de la pause automatique à l'enregistrement. */
  autoPause?: ByActivity<{ speedMs: number; delayS: number }>;
  /** Chiffres en grand de l'enregistrement, carte réduite ; absents : ceux du calcul (`defaultLiveFieldsOf`). */
  liveFields?: ByActivity<LiveFieldKey[]>;
  /** Chiffres de la notification de l'enregistrement, écran verrouillé ; absents : ceux du calcul (`defaultNotificationFieldsOf`). */
  notificationFields?: ByActivity<LiveFieldKey[]>;
  /** Bips d'approche des balises (voile) : courbe et vibration ; absent : `MARK_GUIDE_DEFAULTS`. */
  markGuide?: ByActivity<MarkGuideSettings>;
  /** Support sur foil (voile, surf) ; absent : `foilDefault` du calcul, coché pour « Surf foil ». */
  foils?: ByActivity<boolean>;
  /** Pumping foil (surf, point 104 ; voile sur foil, lot 22) : capteurs proposés à l'enregistrement, pumping des vols dans l'analyse ; absent : non. */
  pumping?: ByActivity<boolean>;
  /** Virages du surf mesurés par le gyroscope (lot 40) : capteurs proposés à l'enregistrement ; absent : le pré-réglage (seul l'écart est rangé). */
  turns?: ByActivity<boolean>;
  /** Sauts mesurés par les capteurs du téléphone (voile sauf bateau) ; absents : non mesurés. */
  jumps?: ByActivity<JumpSettings>;
  /** Ceinture cardio proposée à l'enregistrement ; absente : non. */
  heartRate?: ByActivity<boolean>;
  /**
   * Relique de l'application complète (type de vélo), lue brute : plus rien ne l'interprète, elle reste dans le
   * fichier et se réécrit telle quelle. De même, sans champ ici, `terrainSteps`, `gradeRanges`, `cadence`,
   * `bikeWeights`, `carriedLoads`, `energyModels`, `paceLevels`, `customFlatSpeeds`, `wayTypes` et
   * `loopReturnRatios` (course et vélo, retirés aux lots 303 et 305) : `readStoredSettings` ne filtre rien.
   */
  bikeTypes?: ByActivity<unknown>;
  /** Décalage des seuils cardio S1 et S2 par rapport à la référence, en bpm ; absent : `defaultHrOffsetOf`. */
  hrOffsets?: ByActivity<number>;
  /** Limites des zones Z1 à Z5 tracées sur la courbe de FC des analyses (case « Zones » de l'onglet cardio, 05/11) ; absent : non. */
  hrZoneLines?: ByActivity<boolean>;
  /** Intitulés des deux champs de matériel des notes (hors voile) ; un texte vide : celui par défaut. */
  gearLabels?: ByActivity<[string, string]>;
  /**
   * Matériel enregistré de l'activité (fiche 18, lot 20) : groupes et pièces créés par l'utilisateur, choisis
   * dans l'onglet du matériel de l'analyse ; absent : option coupée ; liste vide : option cochée, rien de créé.
   */
  gearGroups?: ByActivity<GearGroup[]>;
  /**
   * Onglets des analyses montrés ou cachés à l'écart de leur défaut, par clé
   * d'onglet (`core/analysisTabs.ts`) ; absents : ceux du module, sans les génériques.
   */
  tabs?: ByActivity<Record<string, boolean>>;
  /** Durée de l'appui long sur le bouton rond qui met en pause, en millisecondes. */
  longPressMs?: number;
  /** Durée de l'appui long sur « Arrêter » qui termine l'enregistrement, en millisecondes ; 0 : un simple appui. */
  stopHoldMs?: number;
  /** Son de tous les bips, plus ou moins grave (24/10) ; absent : `DEFAULT_BEEP_SOUND`. */
  beepSound?: BeepSound;
  // Séances du compteur et du Timer, dernières séances lancées, bornes de la course à bornes et réglages des tests
  // guidés (`intervalPresets`, `lastIntervalWorkout`, `timerPresets`, `lastTimerWorkout`, `heartBands`, `fitnessTests`) :
  // partis avec l'Entraînement (lot 302). Déjà rangés, ils restent dans le fichier et ne sont plus lus.
}

/** Appui long par défaut : 2 s, assez pour ne pas partir d'un geste involontaire. */
export const DEFAULT_LONG_PRESS_MS = 2000;
/** Appui long qui arrête l'enregistrement : 2 s, pour qu'un geste involontaire ne coupe pas la session. */
export const DEFAULT_STOP_HOLD_MS = 2000;

export const isValidLongPress = (value: unknown): value is number =>
  inRange(value, 300, 10_000);

/** Appui long pour arrêter : 0 (simple appui), ou de 0,5 à 10 s. */
export const isValidStopHold = (value: unknown): value is number =>
  value === 0 || inRange(value, 500, 10_000);

/** Seuil d'activité admis : un nombre fini, nul ou positif (même règle à l'écriture, `SETTING_FIELDS`, et à la lecture). */
export const isValidThreshold = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value >= 0;

/** Pause automatique admise : vitesse et délai finis, nuls ou positifs (même règle à l'écriture et à la lecture). */
export const isValidAutoPause = (value: unknown): value is { speedMs: number; delayS: number } => {
  if (typeof value !== 'object' || value === null) return false;
  const { speedMs, delayS } = value as { speedMs?: unknown; delayS?: unknown };
  return isValidThreshold(speedMs) && isValidThreshold(delayS);
};


/** Seuil fixé pour une activité, réglé ou pré-réglé ; `null` : le défaut du calcul (en voile, la suggestion selon l'allure). */
export const resolveThresholdOverride = (stored: StoredSettings, activity: Activity): number | null => {
  const own = stored.thresholds?.[activity.id];
  return isValidThreshold(own) ? own : presetOf(activity).threshold ?? null;
};

/**
 * Bornes de couleur fixes d'une activité : celles réglées, sinon celles de son
 * pré-réglage ; `null` sans l'un ni l'autre (le défaut du module, en voile la
 * suggestion selon l'allure).
 */
export const resolveSpeedRange = (stored: StoredSettings, activity: Activity): SpeedRangeMs | null => {
  const range = stored.speedRanges?.[activity.id];
  return range && isValidSpeedRange(range) ? range : presetOf(activity).speedRangeMs ?? null;
};

/** Unité de vitesse d'une activité : celle réglée, sinon son défaut. */
export const resolveSpeedUnit = (stored: StoredSettings, activity: Activity): SpeedUnit => {
  const unit = stored.speedUnits?.[activity.id];
  return isKnownSpeedUnit(unit) ? unit : defaultSpeedUnitOf(activity);
};

/**
 * Valeur rangée d'une paire de bornes de Réglages (couleurs, pause
 * automatique) après la saisie de l'une d'elles. `current` : la paire rangée,
 * `null` sans réglage. `value` : la borne saisie, `null` pour le champ vidé, qui
 * ne reprend que son propre défaut (`fallback`) : l'autre borne reste. Vider ne
 * fige jamais une paire qui n'était pas réglée, et une paire vidée revenue
 * entière au défaut n'est plus un réglage (`null`). Une paire invalide (`isValid`)
 * n'est pas rangée : `current` tel quel, le champ revient à sa valeur en le quittant.
 */
export const nextBoundPair = <K extends string, T extends Record<K, number>>(
  current: T | null, key: K, value: number | null, fallback: T, isValid: (pair: T) => boolean
): T | null => {
  if (value === null && current === null) return null;
  const next = { ...(current ?? fallback), [key]: value ?? fallback[key] } as T;
  if (!isValid(next)) return current;
  const isDefault = (Object.keys(fallback) as (keyof T)[]).every((k) => next[k] === fallback[k]);
  return value === null && isDefault ? null : next;
};

/** Bornes de couleur après la saisie de l'une d'elles (`nextBoundPair`) ; `fallback` : celles de l'activité (`defaultSpeedRangeOf`). */
export const nextSpeedRange = (
  current: SpeedRangeMs | null, bound: keyof SpeedRangeMs, value: number | null, fallback: SpeedRangeMs
): SpeedRangeMs | null => nextBoundPair<keyof SpeedRangeMs, SpeedRangeMs>(current, bound, value, fallback, isValidSpeedRange);


/** Décalage des seuils cardio admis, en bpm entiers. */
export const HR_OFFSET_RANGE = { min: -30, max: 30 };

export const isValidHrOffset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= HR_OFFSET_RANGE.min && value <= HR_OFFSET_RANGE.max;

/** Décalage des seuils cardio à défaut de réglage : le pré-réglage, sinon celui du calcul. */
export const defaultHrOffsetOf = (activity: Activity): number =>
  presetOf(activity).hrThresholdOffsetBpm ?? getSportProfile(activity.base).heartRate.thresholdOffsetBpm;

export const resolveHrOffset = (stored: StoredSettings, activity: Activity): number => {
  const offset = stored.hrOffsets?.[activity.id];
  return isValidHrOffset(offset) ? offset : defaultHrOffsetOf(activity);
};


export const isKnownSpeedUnit = (value: unknown): value is SpeedUnit =>
  typeof value === 'string' && value in SPEED_UNIT_LABEL;

export const isKnownDistanceUnit = (value: unknown): value is DistanceUnit =>
  typeof value === 'string' && value in DISTANCE_UNIT_LABEL;


/**
 * Familles de l'application complète (à pied, vélo, Entraînement), absentes de cette version : cachées dans un
 * fichier de réglages repris, elles sont gardées telles quelles par `readHiddenFamilies` (rien ne les affiche) et
 * réécrites ainsi par `withVisibility`, pour que ce fichier, relu par l'application complète, les garde cachées.
 */
export const FULL_APP_FAMILY_IDS: readonly string[] = ['course', 'velo', 'fractionne'];

const isKnownFamily = (value: unknown): value is string =>
  typeof value === 'string' && ((SPORT_FAMILIES as readonly string[]).includes(value) || FULL_APP_FAMILY_IDS.includes(value));

/** Familles cachées : celles de cette version et de l'application complète, les autres valeurs écartées. */
export const readHiddenFamilies = (stored: StoredSettings): string[] =>
  Array.isArray(stored.hiddenFamilies) ? stored.hiddenFamilies.filter(isKnownFamily) : [];

/** Réglages avec ces activités et ces familles cachées ; `null` s'il ne resterait aucune famille visible. */
export const withVisibility = (stored: StoredSettings, activities: Activity[], hiddenFamilies: string[]): StoredSettings | null =>
  visibleFamilies(activities, hiddenFamilies).length === 0
    ? null
    : { ...stored, activities, activitiesVersion: Math.max(stored.activitiesVersion ?? 0, ACTIVITIES_VERSION), hiddenFamilies };

/**
 * Version des pré-réglages. 1 (21/10) : bateau (couleurs de 1 à 15 nœuds,
 * sans seuil d'activité, pause sous 0,2 km/h, chiffres du direct). 2 (21/10) :
 * wing, planche, à pied, vélo et fractionné (`settings/activityPresets.ts`).
 * 3 (28/10) : la Marche sans seuil d'activité. 4 (05/11) : sauts mesurés
 * d'office au kite et au VTT. 5 (06/11) : onglet « sauts » décoché à terre.
 * Les versions 3 et 5 ne visaient que la terre, retirée au lot 305 : elles
 * restent comptées, sans effet ici ; le numéro ne recule jamais.
 */
export const PRESETS_VERSION = 5;

/**
 * Réglages effacés une fois, à la mise à jour, pour que les pré-réglages
 * repris s'appliquent (choix de l'utilisateur, 21/10) : ces clés, pour toute
 * activité dont le calcul est listé, activité de base comprise, et pour les
 * activités de `ids`. Les réglages écrits ensuite portent `PRESETS_VERSION`
 * et restent.
 */
const PRESET_RESETS: { version: number; bases: SportType[]; ids?: string[]; keys: PerActivityKey[] }[] = [
  { version: 1, bases: ['bateau'], keys: ['speedRanges', 'autoPause', 'liveFields', 'notificationFields', 'thresholds'] },
  {
    version: 2,
    // Calculs pré-réglés au 21/10 : le kite, pré-réglé au 05/11 pour ses sauts seulement, n'y entre pas. Les calculs
    // et les clés de la terre (pente, vélo, voies, terrain, niveau), retirés au lot 305, n'y sont plus.
    bases: PRESET_BASES.filter((base) => base !== 'kite'),
    keys: ['thresholds', 'speedUnits', 'speedRanges', 'autoPause', 'liveFields', 'notificationFields', 'markGuide', 'jumps', 'heartRate', 'tabs'],
  },
  // Le seuil de la Marche (28/10), retirée au lot 305 : sans effet.
  { version: 3, bases: [], keys: [] },
  // Sauts d'office au kite (le VTT, retiré au lot 305, n'y est plus) : leur ancienne case (décochée par défaut) s'efface une fois.
  { version: 4, bases: ['kite'], keys: ['jumps'] },
  // Version 5 (onglet « sauts » décoché à terre, 06/11) : la terre retirée au lot 305, sans effet ; rien ne s'y efface.
];

/**
 * Réglages d'une version de pré-réglages d'avant mis à jour (`PRESET_RESETS`) :
 * les réglages des calculs repris depuis sont effacés. Rend `stored` lui-même
 * s'il n'y a rien à changer.
 */
export const resetStoredPresets = (stored: StoredSettings): StoredSettings => {
  const from = stored.presetsVersion ?? 0;
  if (from >= PRESETS_VERSION) return stored;
  const activities = readActivities(stored.activities);
  let next = stored;
  for (const { version, bases, ids: own = [], keys } of PRESET_RESETS) {
    if (version <= from) continue;
    const ids = new Set<string>([...bases, ...own, ...activities.filter((a) => bases.includes(a.base)).map((a) => a.id)]);
    for (const key of keys) {
      const map = next[key];
      if (!map || !Object.keys(map).some((id) => ids.has(id))) continue;
      const copy: Record<string, unknown> = { ...map };
      for (const id of ids) delete copy[id];
      next = { ...next, [key]: copy };
    }
  }
  return next;
};

/** Unité de distance d'une activité : celle choisie, sinon le kilomètre. */
export const resolveDistanceUnit = (stored: StoredSettings, activity: Activity): DistanceUnit => {
  const unit = stored.distanceUnits?.[activity.id];
  return isKnownDistanceUnit(unit) ? unit : 'km';
};


export const sanitizeNotificationFields = (value: unknown, activity: Activity): LiveFieldKey[] | null =>
  sanitizeLiveFields(value, activityTreatment(activity), MAX_NOTIFICATION_FIELDS, 'notification');

/** Foil d'une activité sans réglage : coché pour « Surf foil » (point 97), sinon le défaut du calcul. */
export const defaultFoil = (activity: Activity): boolean =>
  activity.id === SURF_FOIL_ACTIVITY.id || getSportProfile(activity.base).foilDefault;

/** Foil d'une activité : celui réglé, sinon son défaut ; `null` hors voile et surf. */
export const resolveFoil = (stored: StoredSettings, activity: Activity): boolean | null => {
  const treatment = activityTreatment(activity);
  if (treatment !== 'voile' && treatment !== 'surf') return null;
  const foil = stored.foils?.[activity.id];
  return typeof foil === 'boolean' ? foil : defaultFoil(activity);
};

/** Pumping foil d'une activité : celui réglé, sinon non ; `null` si son calcul ne le mesure pas (bateau, à pied, à vélo). */
export const resolvePumping = (stored: StoredSettings, activity: Activity): boolean | null => {
  if (getSportProfile(activity.base).pump === null) return null;
  return stored.pumping?.[activity.id] === true;
};

/** Virages mesurés par le gyroscope : ceux réglés, sinon le défaut de l'activité ; `null` hors surf. */
export const resolveTurns = (stored: StoredSettings, activity: Activity): boolean | null => {
  if (getSportProfile(activity.base).surf === null) return null;
  const own = stored.turns?.[activity.id];
  return typeof own === 'boolean' ? own : defaultTurnsOf(activity);
};

/** Ceinture cardio d'une activité : celle réglée, sinon son défaut ; proposée dans tous les sports. */
export const resolveHeartRate = (stored: StoredSettings, activity: Activity): boolean => {
  const own = stored.heartRate?.[activity.id];
  return typeof own === 'boolean' ? own : defaultHeartRateOf(activity);
};

/** Sauts d'une activité : ceux réglés, sinon le défaut ; `null` si son calcul ne les mesure pas. */
export const resolveJumps = (stored: StoredSettings, activity: Activity): JumpSettings | null => {
  const profile = getSportProfile(activity.base).jumps;
  if (!profile) return null;
  return sanitizeJumpSettings(stored.jumps?.[activity.id], profile) ?? sanitizeJumpSettings(presetOf(activity).jumps, profile) ?? defaultJumpSettings(profile);
};

/** Réglage d'enregistrement d'une activité : le profil de son calcul, sauf surcharge de la pause automatique. */
export const resolveRecordingProfile = (stored: StoredSettings, activity: Activity): RecordingProfile => {
  const profile = getSportProfile(activity.base);
  const own = stored.autoPause?.[activity.id];
  const pause = isValidAutoPause(own) ? own : defaultAutoPauseOf(activity);
  return { ...profile.recording, autoPauseSpeedMs: pause.speedMs, autoPauseDelayS: pause.delayS };
};

/** Chiffres en grand de l'enregistrement, carte réduite : ceux choisis, sinon ceux du calcul. */
export const resolveLiveFields = (stored: StoredSettings, activity: Activity): LiveFieldKey[] =>
  sanitizeLiveFields(stored.liveFields?.[activity.id], activityTreatment(activity)) ?? defaultLiveFieldsFor(activity);

/** Chiffres de la notification de l'enregistrement : ceux choisis, sinon ceux du calcul. */
export const resolveNotificationFields = (stored: StoredSettings, activity: Activity): LiveFieldKey[] =>
  sanitizeNotificationFields(stored.notificationFields?.[activity.id], activity) ?? defaultNotificationFieldsFor(activity);

/** Bips d'approche des balises : ceux réglés pour l'activité, sinon le défaut. */
export const resolveMarkGuide = (stored: StoredSettings, activity: Activity): MarkGuideSettings =>
  sanitizeMarkGuide(stored.markGuide?.[activity.id]) ?? defaultMarkGuideOf(activity);

/** Onglets choisis pour les analyses d'une activité, ceux du pré-réglage sinon ; `null` sans l'un ni l'autre. */
export const resolveTabChoices = (stored: StoredSettings, activity: Activity): TabChoices | null =>
  sanitizeTabChoices(stored.tabs?.[activity.id]) ?? defaultTabsOf(activity);

/** Familles proposées en planification : toutes celles de cette version. */
export const PLANNING_FAMILIES: readonly SportFamily[] = SPORT_FAMILIES;

/** Réglages d'une activité tels que la page Réglages les présente. */
export interface SportSettingsView {
  activity: Activity;
  speedUnit: SpeedUnit;
  isSpeedUnitOverridden: boolean;
  distanceUnit: DistanceUnit;
  isDistanceUnitOverridden: boolean;
  /** Seuil d'activité dans l'unité du profil ; 0 : aucun seuil réglé, arrêts complets ôtés d'office. */
  activeThreshold: number;
  isThresholdOverridden: boolean;
  speedRange: { minMs: number; maxMs: number } | null;
  /** Pause automatique effective à l'enregistrement (m/s, secondes). */
  autoPause: { speedMs: number; delayS: number };
  isAutoPauseOverridden: boolean;
  /** Chiffres en grand de l'enregistrement, carte réduite. */
  liveFields: LiveFieldKey[];
  isLiveFieldsOverridden: boolean;
  /** Chiffres de la notification de l'enregistrement. */
  notificationFields: LiveFieldKey[];
  isNotificationFieldsOverridden: boolean;
  /** Bips d'approche des balises (voile). */
  markGuide: MarkGuideSettings;
  isMarkGuideOverridden: boolean;
  /** Support sur foil ; `null` hors voile et surf. */
  foil: boolean | null;
  isFoilOverridden: boolean;
  /** Pumping foil ; `null` si le calcul ne le mesure pas (bateau, à pied, à vélo). */
  pumping: boolean | null;
  /** Virages mesurés par le gyroscope ; `null` hors surf. */
  turns: boolean | null;
  /** Virages réglés à l'écart de leur défaut. */
  isTurnsOverridden: boolean;
  /** Sauts mesurés par les capteurs ; `null` si le calcul ne les mesure pas (bateau, fractionné). */
  jumps: JumpSettings | null;
  /** Ceinture cardio proposée à l'enregistrement ; `null` en voile et en surf. */
  heartRate: boolean;
  isJumpsOverridden: boolean;
  /** Décalage des seuils cardio, en bpm. */
  hrOffset: number;
  isHrOffsetOverridden: boolean;
  /** Limites des zones tracées sur la courbe de FC ; non par défaut. */
  hrZoneLines: boolean;
  /** Intitulés de matériel réglés (hors voile), un texte vide pour celui par défaut ; `null` sans réglage. */
  gearLabels: [string, string] | null;
  /** Matériel enregistré ; `null` : option coupée ; liste vide : option cochée, rien de créé. */
  gearGroups: GearGroup[] | null;
  /** Onglets des analyses montrés ou cachés à l'écart de ceux du module ; `null` sans choix ni pré-réglage. */
  tabs: TabChoices | null;
  isTabsOverridden: boolean;
  /** Ceinture cardio réglée à l'écart de son défaut. */
  isHeartRateOverridden: boolean;
}

/** Tables de réglages rangées par activité. */
export type PerActivityKey = (typeof PER_ACTIVITY_KEYS)[number];
export const PER_ACTIVITY_KEYS = [
  'thresholds', 'speedUnits', 'distanceUnits', 'speedRanges', 'autoPause', 'hrOffsets', 'gearLabels', 'gearGroups',
  'tabs', 'liveFields', 'notificationFields', 'markGuide', 'foils', 'pumping', 'turns', 'jumps',
  'heartRate', 'hrZoneLines',
] as const;

/**
 * Ce que « Par défaut » garde : le matériel enregistré, une liste de
 * l'utilisateur et non une surcharge d'un défaut ; la suppression de
 * l'activité l'efface.
 */
const KEPT_BY_RESET: readonly PerActivityKey[] = ['gearGroups'];

/** Réglages sans aucune surcharge rangée sous `id`, hors des clés de `keep`. */
export const withoutOverrides = (stored: StoredSettings, id: string, keep: readonly PerActivityKey[] = []): StoredSettings => {
  const next: StoredSettings = { ...stored };
  for (const key of PER_ACTIVITY_KEYS) {
    if (keep.includes(key)) continue;
    const map = stored[key];
    if (map && id in map) {
      const copy: Record<string, unknown> = { ...map };
      delete copy[id];
      (next as Record<string, unknown>)[key] = copy;
    }
  }
  return next;
};

/** « Par défaut » d'une activité : ses surcharges effacées, son matériel enregistré gardé. */
export const resetOverrides = (stored: StoredSettings, id: string): StoredSettings => withoutOverrides(stored, id, KEPT_BY_RESET);

/** Limites des zones cardio tracées sur la courbe de FC des analyses de l'activité : seul « oui » est rangé, non par défaut. */
export const effectiveHrZoneLines = (stored: StoredSettings, activity: Activity): boolean => stored.hrZoneLines?.[activity.id] === true;

/** Réglages d'une activité tels que Réglages les montre : valeurs effectives et ce qui est réglé. */
export const settingsView = (stored: StoredSettings, activity: Activity): SportSettingsView => {
  const id = activity.id;
  const profile = getSportProfile(activity.base);
  const unit = stored.speedUnits?.[id];
  const distanceUnit = stored.distanceUnits?.[id];
  const threshold = isValidThreshold(stored.thresholds?.[id]) ? stored.thresholds?.[id] : undefined;
  const range = stored.speedRanges?.[id];
  const autoPauseOverride = isValidAutoPause(stored.autoPause?.[id]) ? stored.autoPause?.[id] : undefined;
  const liveFields = sanitizeLiveFields(stored.liveFields?.[id], activityTreatment(activity));
  const notificationFields = sanitizeNotificationFields(stored.notificationFields?.[id], activity);
  const markGuide = sanitizeMarkGuide(stored.markGuide?.[id]);
  return {
    activity,
    speedUnit: resolveSpeedUnit(stored, activity),
    isSpeedUnitOverridden: isKnownSpeedUnit(unit) && unit !== defaultSpeedUnitOf(activity),
    distanceUnit: resolveDistanceUnit(stored, activity),
    isDistanceUnitOverridden: isKnownDistanceUnit(distanceUnit),
    activeThreshold: threshold ?? defaultThresholdOf(activity, resolveFoil(stored, activity) ?? false),
    isThresholdOverridden: threshold !== undefined,
    speedRange: range && isValidSpeedRange(range) ? range : null,
    autoPause: autoPauseOverride ?? defaultAutoPauseOf(activity),
    isAutoPauseOverridden: autoPauseOverride !== undefined,
    liveFields: liveFields ?? defaultLiveFieldsFor(activity),
    isLiveFieldsOverridden: liveFields !== null,
    notificationFields: notificationFields ?? defaultNotificationFieldsFor(activity),
    isNotificationFieldsOverridden: notificationFields !== null,
    markGuide: markGuide ?? defaultMarkGuideOf(activity),
    isMarkGuideOverridden: markGuide !== null,
    foil: resolveFoil(stored, activity),
    isFoilOverridden: typeof stored.foils?.[id] === 'boolean',
    pumping: resolvePumping(stored, activity),
    turns: resolveTurns(stored, activity),
    isTurnsOverridden: profile.surf !== null && typeof stored.turns?.[id] === 'boolean' && stored.turns[id] !== defaultTurnsOf(activity),
    jumps: resolveJumps(stored, activity),
    heartRate: resolveHeartRate(stored, activity),
    isHeartRateOverridden: typeof stored.heartRate?.[id] === 'boolean' && stored.heartRate[id] !== defaultHeartRateOf(activity),
    isJumpsOverridden: stored.jumps?.[id] !== undefined && profile.jumps !== null,
    hrOffset: resolveHrOffset(stored, activity),
    isHrOffsetOverridden: isValidHrOffset(stored.hrOffsets?.[id]),
    hrZoneLines: effectiveHrZoneLines(stored, activity),
    gearLabels: sanitizeGearLabels(stored.gearLabels?.[id]),
    gearGroups: sanitizeGearGroups(stored.gearGroups?.[id]),
    tabs: sanitizeTabChoices(stored.tabs?.[id]) ?? defaultTabsOf(activity),
    isTabsOverridden: sanitizeTabChoices(stored.tabs?.[id]) !== null,
  };
};

/** Champ de `SportSettingsView` qui s'écrit depuis Réglages (`withSetting`). */
export type SettingField =
  | 'speedUnit' | 'distanceUnit' | 'activeThreshold' | 'speedRange' | 'autoPause' | 'liveFields'
  | 'notificationFields' | 'markGuide' | 'foil' | 'pumping' | 'turns' | 'jumps' | 'heartRate'
  | 'hrOffset' | 'gearLabels' | 'gearGroups' | 'tabs' | 'hrZoneLines';

/**
 * Règle d'écriture d'un champ : la table où il se range, et la valeur rangée
 * pour la valeur demandée (`null` : effacer la surcharge ; `undefined` :
 * refusée, rien n'est écrit). `activity` est `null` pour un identifiant inconnu.
 */
interface SettingFieldRule {
  key: PerActivityKey;
  normalize: (value: unknown, activity: Activity | null, stored: StoredSettings) => unknown;
}

/** Valeur gardée telle quelle si `valid` l'admet ; `null` efface. */
const plain = (valid: (value: unknown) => boolean): SettingFieldRule['normalize'] =>
  (value) => (value === null ? null : valid(value) ? value : undefined);

/** Valeur nettoyée par `sanitize` (son `null` : refusée) ; `null` efface. */
const sanitized = (sanitize: (value: unknown) => unknown): SettingFieldRule['normalize'] =>
  (value) => (value === null ? null : sanitize(value) ?? undefined);

const isObjectValue = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Un booléen, ou `null` ; `undefined` pour toute autre valeur. */
const booleanOrNull = (value: unknown): boolean | null | undefined =>
  value === null || typeof value === 'boolean' ? value : undefined;

/**
 * Écriture de chaque réglage d'une activité (lot 72) : valider, ranger, ou
 * n'écrire que l'écart au défaut. Une seule table, d'où `withSetting` se déduit.
 */
export const SETTING_FIELDS: Record<SettingField, SettingFieldRule> = {
  speedUnit: { key: 'speedUnits', normalize: plain(isKnownSpeedUnit) },
  distanceUnit: { key: 'distanceUnits', normalize: plain(isKnownDistanceUnit) },
  activeThreshold: { key: 'thresholds', normalize: plain(isValidThreshold) },
  speedRange: { key: 'speedRanges', normalize: plain((v) => isObjectValue(v) && isValidSpeedRange(v)) },
  autoPause: {
    key: 'autoPause',
    normalize: plain(isValidAutoPause),
  },
  liveFields: {
    key: 'liveFields',
    normalize: (v, activity) => (!activity ? undefined : v === null ? null : sanitizeLiveFields(v, activityTreatment(activity)) ?? undefined),
  },
  notificationFields: {
    key: 'notificationFields',
    normalize: (v, activity) => (!activity ? undefined : v === null ? null : sanitizeNotificationFields(v, activity) ?? undefined),
  },
  markGuide: { key: 'markGuide', normalize: sanitized(sanitizeMarkGuide) },
  foil: {
    key: 'foils',
    normalize: (v, activity, stored) => (!activity || resolveFoil(stored, activity) === null ? undefined : booleanOrNull(v)),
  },
  pumping: {
    key: 'pumping',
    // Seul « oui » est rangé.
    normalize: (v, activity, stored) => {
      if (!activity || resolvePumping(stored, activity) === null) return undefined;
      const on = booleanOrNull(v);
      return on === undefined ? undefined : on === true ? true : null;
    },
  },
  turns: {
    key: 'turns',
    // Seul l'écart à son défaut est rangé : décocher les virages pré-réglés range « non ».
    normalize: (v, activity, stored) => {
      if (!activity || resolveTurns(stored, activity) === null) return undefined;
      const on = booleanOrNull(v);
      return on === undefined ? undefined : on === null || on === defaultTurnsOf(activity) ? null : on;
    },
  },
  heartRate: {
    key: 'heartRate',
    // Seul l'écart à son défaut est rangé : décocher une ceinture pré-réglée range « non ».
    normalize: (v, activity) => {
      if (!activity) return undefined;
      const on = booleanOrNull(v);
      return on === undefined ? undefined : on === null || on === defaultHeartRateOf(activity) ? null : on;
    },
  },
  jumps: {
    key: 'jumps',
    normalize: (v, activity) => {
      const profile = activity ? getSportProfile(activity.base).jumps : null;
      if (!profile) return undefined;
      return v === null ? null : sanitizeJumpSettings(v, profile) ?? undefined;
    },
  },
  hrOffset: { key: 'hrOffsets', normalize: plain(isValidHrOffset) },
  // Deux intitulés vides : ceux par défaut, la surcharge est effacée.
  gearLabels: { key: 'gearLabels', normalize: (v) => (v === null ? null : Array.isArray(v) ? sanitizeGearLabels(v) : undefined) },
  gearGroups: { key: 'gearGroups', normalize: sanitized(sanitizeGearGroups) },
  tabs: {
    key: 'tabs',
    normalize: (v) => {
      if (v === null) return null;
      const choices = sanitizeTabChoices(v);
      return choices === null ? undefined : { ...choices };
    },
  },
  hrZoneLines: {
    key: 'hrZoneLines',
    // Seul « oui » est rangé.
    normalize: (v, activity) => {
      if (!activity) return undefined;
      const on = booleanOrNull(v);
      return on === undefined ? undefined : on === true ? true : null;
    },
  },
};

/**
 * Réglages avec ce champ de l'activité `id` écrit (ou effacé, `null`) ;
 * `null` si la valeur est refusée (`SETTING_FIELDS`) : rien à écrire.
 */
export const withSetting = <F extends SettingField>(
  stored: StoredSettings, id: string, field: F, value: SportSettingsView[F] | null
): StoredSettings | null => {
  const { key, normalize } = SETTING_FIELDS[field];
  const kept = normalize(value, findActivity(readActivities(stored.activities), id), stored);
  if (kept === undefined) return null;
  const map: Record<string, unknown> = { ...stored[key] };
  if (kept === null) delete map[id];
  else map[id] = kept;
  return { ...stored, [key]: map };
};

/**
 * Vrai si l'activité a un réglage que « Par défaut » effacerait : marque
 * « · modifié » de sa carte et menu « Par défaut » actif. Le matériel
 * enregistré (`gearGroups`) n'y compte pas : « Par défaut » le garde
 * (`KEPT_BY_RESET`), le bouton n'aurait rien à remettre.
 */
export const isActivityOverridden = (s: SportSettingsView): boolean => {
  const { activity } = s;
  const p = getSportProfile(activity.base);
  /** Seuil d'activité réglable : pas en bateau. */
  const withThreshold = hasActiveThreshold(p);
  return (
    s.isSpeedUnitOverridden || s.isDistanceUnitOverridden || (withThreshold && s.isThresholdOverridden) || s.isAutoPauseOverridden || s.speedRange !== null ||
    s.isLiveFieldsOverridden || s.isNotificationFieldsOverridden || s.isMarkGuideOverridden || s.isHrOffsetOverridden || s.gearLabels !== null || s.isTabsOverridden ||
    s.isFoilOverridden || s.pumping === true || s.isTurnsOverridden || s.isJumpsOverridden || s.isHeartRateOverridden || s.hrZoneLines
  );
};

/**
 * Activité retenue par un module : celle mémorisée si elle est de sa famille
 * (une de la liste, ou l'activité de base d'un calcul, pour une session sans
 * activité), sinon la première de la famille, sinon l'activité de base du
 * calcul par défaut de la famille.
 */
export const moduleActivity = (stored: StoredSettings, activities: Activity[], family: SportFamily): Activity => {
  const remembered = stored.moduleActivity?.[family] ?? (family === 'voile' ? stored.sport : undefined);
  const found = findActivity(activities, remembered);
  if (found && activityFamily(found) === family && !found.hidden) return found;
  // Cachée : la première visible de la famille, sinon celle retenue tout de même (§10, point 100).
  const own = activitiesOfFamily(activities, family);
  return own.find((a) => !a.hidden) ?? (found && activityFamily(found) === family ? found : own[0]) ?? baseActivity(FAMILY_BASE[family]);
};
