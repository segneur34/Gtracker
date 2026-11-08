import { kmhToMs as kmh } from '../core/units';
import type { RouteTotals } from './route';

/**
 * Temps de parcours estimé d'un itinéraire à pied, à partir d'une vitesse
 * sur le plat : celle du niveau choisi dans Réglages, ou une vitesse saisie
 * (« Personnalisé »). Règle du km-effort, répandue en trail : chaque mètre de
 * D+ compte comme `climbFactor` mètres de plat (10 : 100 m de D+ font 1 km de
 * plus) ; la descente ne compte pas.
 *
 * L'estimation à vélo (modèle physique) est partie avec le calcul du vélo
 * (lot 303) ; les niveaux du vélo restent, lus par Réglages, jusqu'au retrait
 * du planificateur routier (lot 304).
 */

export type PaceLevel = 'debutant' | 'moyen' | 'bon' | 'expert' | 'perso';
export type PresetPaceLevel = Exclude<PaceLevel, 'perso'>;

export const PACE_LEVELS: PaceLevel[] = ['debutant', 'moyen', 'bon', 'expert', 'perso'];
export const PRESET_PACE_LEVELS: PresetPaceLevel[] = ['debutant', 'moyen', 'bon', 'expert'];

export const PACE_LEVEL_LABEL: Record<PaceLevel, string> = {
  debutant: 'Débutant',
  moyen: 'Moyen',
  bon: 'Bon',
  expert: 'Expert',
  perso: 'Personnalisé',
};

/** Niveau retenu sans réglage, et à la place d'un « Personnalisé » sans vitesse saisie. */
export const DEFAULT_PACE_LEVEL: PresetPaceLevel = 'moyen';

export const isPaceLevel = (value: unknown): value is PaceLevel =>
  typeof value === 'string' && (PACE_LEVELS as string[]).includes(value);

/** Familles qui ont un temps estimé. */
export type PlanningFamily = 'course' | 'velo';

/** Vitesse sur le plat de chaque niveau, en m/s. */
export const LEVEL_FLAT_SPEED_MS: Record<PlanningFamily, Record<PresetPaceLevel, number>> = {
  course: { debutant: kmh(8), moyen: kmh(10), bon: kmh(12), expert: kmh(14) },
  velo: { debutant: kmh(18), moyen: kmh(22), bon: kmh(26), expert: kmh(30) },
};

/** Plage plausible d'une vitesse saisie, en m/s. */
export const CUSTOM_FLAT_SPEED_BOUNDS_MS: Record<PlanningFamily, [number, number]> = {
  course: [kmh(3), kmh(25)],
  velo: [kmh(5), kmh(60)],
};

export const isValidFlatSpeed = (family: PlanningFamily, value: unknown): value is number => {
  const [lo, hi] = CUSTOM_FLAT_SPEED_BOUNDS_MS[family];
  return typeof value === 'number' && isFinite(value) && value >= lo && value <= hi;
};

/** Mètres de plat comptés pour un mètre de D+ en course : 100 m de D+ font 1 km. */
export const KM_EFFORT_CLIMB_FACTOR = 10;

export interface RunningDurationSettings {
  family: 'course';
  flatSpeedMs: number;
  climbFactor: number;
}

/** Réglages du temps estimé : la course seule depuis le lot 303. */
export type DurationSettings = RunningDurationSettings;

/** Temps de course en km-effort, en secondes ; un D+ inconnu compte pour zéro. */
export const runningDurationS = (
  totals: { distanceM: number; gainM: number | null },
  settings: { flatSpeedMs: number; climbFactor: number }
): number => (totals.distanceM + (totals.gainM ?? 0) * settings.climbFactor) / settings.flatSpeedMs;

/**
 * Temps estimé d'après ce que la page a déjà calculé : les totaux
 * (`routeTotals`) ; le profil à pas régulier (`routeProfileRows`) ne sert plus
 * qu'à dire qu'il y a un tracé. `null` sans réglage (voile, vélo) ou sans tracé.
 */
export const estimateDurationFromProfile = (
  totals: RouteTotals,
  profile: ReadonlyArray<{ distM: number; grade: number | null }>,
  settings: DurationSettings | null
): number | null => {
  if (!settings || profile.length < 2) return null;
  const seconds = runningDurationS(totals, settings);
  return seconds > 0 && isFinite(seconds) ? seconds : null;
};
