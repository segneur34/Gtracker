import { finiteOr, inRange } from '../core/basics';
import { storedLogo, type LogoId } from '../core/activityLogos';
import { heartRateZones, isValidThresholds, type HeartRateZones } from '../core/heartRate';
import type { HeartRateProfile } from '../core/sportProfiles';
import {
  DEFAULT_FISH_PATH, DEFAULT_FISH_STYLE, isFishLevel, isFishPath, isFishStyle, type FishPath, type FishStyle,
} from './fishGrowth';

/**
 * Profil du pratiquant, pur : sa forme, ses champs relus avec
 * contrôle (fichier de réglages importé, ancien profil), son âge et ses zones
 * cardiaques. Le magasin et ses écritures restent dans `hooks/useAthleteProfile.ts`,
 * les règles du pop-up et de la racine dans `library/profile.ts`.
 */

/**
 * Photo du Profil : un logo d'activité (une ancienne icône se relit en son logo), ou une image importée, recadrée au
 * carré et réduite (data URL JPEG, `readPickedImage`). Elle voyage avec le
 * profil dans le fichier de réglages.
 */
export type AthleteAvatar = { kind: 'dessin'; icon: LogoId } | { kind: 'photo'; dataUrl: string };

/** Taille d'une photo importée, en pixels de côté. */
export const AVATAR_PHOTO_PX = 256;
/** Au-delà, une photo n'est pas reprise : elle n'a pas été réduite par l'application. */
const AVATAR_PHOTO_MAX_CHARS = 200_000;

/** D'où vient une FC max ou de repos : un test guidé, une séance (« La retenir » du cardio), ou la saisie ; `atMs` : le jour du test ou de la séance. */
export interface HrSource {
  kind: 'test' | 'seance' | 'saisie';
  atMs: number | null;
}

/**
 * Profil du pratiquant, persistant dans le navigateur. Ces caractéristiques
 * serviront aux estimations de coût énergétique et aux zones d'effort : la
 * dépense d'une montée dépend d'abord de la masse déplacée, les zones
 * cardiaques des fréquences de repos et maximale.
 */
export interface AthleteProfile {
  /** Nom ou pseudo, affiché en titre du Profil et au pied de l'image partagée. */
  name: string | null;
  /** Photo du Profil ; `null` : l'avatar vide. */
  avatar: AthleteAvatar | null;
  /** Masse en kilogrammes. */
  weightKg: number | null;
  /** Taille en centimètres. */
  heightCm: number | null;
  /** Année de naissance. */
  birthYear: number | null;
  sex: 'f' | 'm' | null;
  /** Fréquence cardiaque maximale, en battements par minute. */
  hrMax: number | null;
  /** Son origine ; absente sur un profil ancien : saisie. */
  hrMaxSource: HrSource | null;
  /** Fréquence cardiaque de repos, en battements par minute. */
  hrRest: number | null;
  hrRestSource: HrSource | null;
  /** Seuils S1 et S2 saisis à la main (test en laboratoire), en bpm ; `null` : calculés. */
  hrThresholds: number[] | null;
  /** Racine du Profil (`library/rootGrowth.ts`) : objectif par semaine, en minutes ; `null` : `ROOT_GOAL.defaultMin`. */
  rootWeeklyGoalMin: number | null;
  /** Poisson du Profil (`library/fishGrowth.ts`) : style de dessin ; `null` : `DEFAULT_FISH_STYLE`. */
  fishStyle: FishStyle | null;
  /** Sa voie ; `null` : `DEFAULT_FISH_PATH`. */
  fishPath: FishPath | null;
  /** Niveau d'essai, de 1 à `FISH_LEVELS`, réglage provisoire qui impose le niveau montré ; `null` : celui des semaines tenues. */
  fishTrialLevel: number | null;
}

export const EMPTY_ATHLETE_PROFILE: AthleteProfile = {
  name: null,
  avatar: null,
  weightKg: null,
  heightCm: null,
  birthYear: null,
  sex: null,
  hrMax: null,
  hrMaxSource: null,
  hrRest: null,
  hrRestSource: null,
  hrThresholds: null,
  rootWeeklyGoalMin: null,
  fishStyle: null,
  fishPath: null,
  fishTrialLevel: null,
};

/** Plages plausibles de chaque champ numérique. */
export type AthleteNumberField = Exclude<keyof AthleteProfile,
  'name' | 'avatar' | 'sex' | 'hrThresholds' | 'hrMaxSource' | 'hrRestSource' | 'fishStyle' | 'fishPath'>;

/** Champs numériques du Profil dont la plage n'est pas dans `ATHLETE_BOUNDS` (`library/profilePrompt.ts`). */
type ProfileOnlyNumberField = 'rootWeeklyGoalMin' | 'fishTrialLevel';

/** Longueur maximale du nom ou pseudo. */
export const ATHLETE_NAME_MAX = 40;

/** Nom ou pseudo à afficher, `null` s'il n'est pas saisi ; relu avec contrôle de type (fichier de réglages importé). */
export const athleteName = (profile: Pick<AthleteProfile, 'name'>): string | null => {
  const raw: unknown = profile.name;
  if (typeof raw !== 'string') return null;
  const name = raw.trim().slice(0, ATHLETE_NAME_MAX).trim();
  return name === '' ? null : name;
};

/** Photo du Profil, `null` sans choix ; relue avec contrôle de type (fichier de réglages importé, ancien profil). */
export const athleteAvatar = (profile: Partial<Pick<AthleteProfile, 'avatar'>>): AthleteAvatar | null => {
  const raw: unknown = profile.avatar;
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, icon, dataUrl } = raw as Record<string, unknown>;
  const logo = kind === 'dessin' ? storedLogo(icon) : undefined;
  if (logo) return { kind: 'dessin', icon: logo };
  if (kind === 'photo' && typeof dataUrl === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)
    && dataUrl.length <= AVATAR_PHOTO_MAX_CHARS) return { kind, dataUrl };
  return null;
};

/** Style de dessin du poisson du Profil, celui de départ sans choix ou pour une valeur inconnue (fichier de réglages importé). */
export const athleteFishStyle = (profile: Partial<Pick<AthleteProfile, 'fishStyle'>>): FishStyle =>
  isFishStyle(profile.fishStyle) ? profile.fishStyle : DEFAULT_FISH_STYLE;

/** Voie du poisson du Profil, celle de départ sans choix ou pour une valeur inconnue. */
export const athleteFishPath = (profile: Partial<Pick<AthleteProfile, 'fishPath'>>): FishPath =>
  isFishPath(profile.fishPath) ? profile.fishPath : DEFAULT_FISH_PATH;

/** Niveau d'essai du poisson, `null` sans essai (automatique) ou pour une valeur hors de 1 à 6. */
export const athleteFishTrialLevel = (profile: Partial<Pick<AthleteProfile, 'fishTrialLevel'>>): number | null =>
  isFishLevel(profile.fishTrialLevel) ? profile.fishTrialLevel : null;

/** Plages plausibles des champs numériques du pratiquant (celles de l'objectif de la racine et du niveau d'essai du poisson : `library/profilePrompt.ts`). */
export const ATHLETE_BOUNDS: Record<Exclude<AthleteNumberField, ProfileOnlyNumberField>, [number, number]> = {
  weightKg: [20, 300],
  heightCm: [100, 250],
  birthYear: [1900, 2100],
  hrMax: [100, 250],
  hrRest: [25, 120],
};

/** Une FC saisie et dans sa plage (relue avec contrôle : fichier de réglages importé). */
const validHr = (field: 'hrMax' | 'hrRest', raw: unknown): boolean => {
  const [lo, hi] = ATHLETE_BOUNDS[field];
  return inRange(raw, lo, hi);
};

/** Âge à la date du jour, si l'année de naissance est connue. */
export const athleteAge = (profile: AthleteProfile, nowMs = Date.now()): number | null =>
  profile.birthYear === null ? null : new Date(nowMs).getFullYear() - profile.birthYear;

/** Origine de la FC max ou de repos, `null` sans valeur ; relue avec contrôle (fichier de réglages importé, ancien profil : saisie). */
export const athleteHrSource = (profile: Partial<AthleteProfile>, field: 'hrMax' | 'hrRest'): HrSource | null => {
  if (!validHr(field, profile[field])) return null;
  const raw: unknown = profile[field === 'hrMax' ? 'hrMaxSource' : 'hrRestSource'];
  if (typeof raw === 'object' && raw !== null) {
    const { kind, atMs } = raw as Record<string, unknown>;
    if (kind === 'test' || kind === 'seance' || kind === 'saisie') {
      return { kind, atMs: finiteOr(atMs, null) };
    }
  }
  return { kind: 'saisie', atMs: null };
};

/**
 * Seuils et zones cardiaques du pratiquant pour un calcul (`heartRate` : son
 * profil cardio) décalés de `offsetBpm` (`hrOffsetBpm` de l'activité) ; `null`
 * sans seuils saisis, FC max ni âge.
 */
export const athleteHeartRateZones = (profile: AthleteProfile, heartRate: HeartRateProfile, offsetBpm: number): HeartRateZones | null =>
  heartRateZones(profile, athleteAge(profile), heartRate.zoneModel, offsetBpm);

/**
 * Profil relu champ par champ (fichier de réglages d'un autre appareil, lot
 * 143) : un champ d'une forme inattendue ou hors de sa plage (`ATHLETE_BOUNDS`,
 * `rootGoal` pour l'objectif de la racine, `ROOT_GOAL` de `library/rootGrowth.ts`
 * passé par l'appelant) est remis à vide, jamais repris tel quel ; un champ
 * inconnu est écarté.
 */
export const sanitizeAthleteProfile = (raw: unknown, rootGoal: { min: number; max: number }): AthleteProfile => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...EMPTY_ATHLETE_PROFILE };
  const p = raw as Partial<Record<keyof AthleteProfile, unknown>>;
  const bounded = (field: Exclude<AthleteNumberField, ProfileOnlyNumberField>): number | null => {
    const [lo, hi] = ATHLETE_BOUNDS[field];
    return inRange(p[field], lo, hi) ? p[field] : null;
  };
  const numbers = (value: unknown): number[] | null => (Array.isArray(value) ? value.slice() as number[] : null);
  const thresholds = numbers(p.hrThresholds);
  const hrMax = bounded('hrMax');
  const hrRest = bounded('hrRest');
  const forSource = { hrMax, hrRest, hrMaxSource: p.hrMaxSource, hrRestSource: p.hrRestSource } as Partial<AthleteProfile>;
  return {
    name: athleteName({ name: p.name as string | null }),
    avatar: athleteAvatar({ avatar: p.avatar as AthleteAvatar | null }),
    weightKg: bounded('weightKg'),
    heightCm: bounded('heightCm'),
    birthYear: bounded('birthYear'),
    sex: p.sex === 'f' || p.sex === 'm' ? p.sex : null,
    hrMax,
    hrMaxSource: athleteHrSource(forSource, 'hrMax'),
    hrRest,
    hrRestSource: athleteHrSource(forSource, 'hrRest'),
    hrThresholds: isValidThresholds(thresholds) ? thresholds : null,
    rootWeeklyGoalMin: inRange(p.rootWeeklyGoalMin, rootGoal.min, rootGoal.max) ? p.rootWeeklyGoalMin : null,
    fishStyle: isFishStyle(p.fishStyle) ? p.fishStyle : null,
    fishPath: isFishPath(p.fishPath) ? p.fishPath : null,
    fishTrialLevel: isFishLevel(p.fishTrialLevel) ? p.fishTrialLevel : null,
  };
};

/**
 * Profil tel que rangé sur l'appareil, relu avec le contrôle de `sanitizeAthleteProfile`
 * (il peut venir du fichier de réglages d'un autre appareil) : seul le nom reste
 * tel que tapé, espaces de fin compris, pour la frappe en cours dans son champ.
 */
export const storedAthleteProfile = (raw: unknown, rootGoal: { min: number; max: number }): AthleteProfile => {
  const profile = sanitizeAthleteProfile(raw, rootGoal);
  const name = (raw as { name?: unknown } | null)?.name;
  return typeof name === 'string' && profile.name !== null ? { ...profile, name: name.slice(0, ATHLETE_NAME_MAX) } : profile;
};
