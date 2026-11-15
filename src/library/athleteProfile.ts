import { finiteOr, inRange } from '../core/basics';
import { storedLogo, type LogoId } from '../core/activityLogos';
import { heartRateZones, isValidThresholds, type HeartRateZones } from '../core/heartRate';
import type { HeartRateProfile } from '../core/sportProfiles';
import { SCHOOL_TRIAL_MAX, isSchoolStyle, type SchoolStyle } from '../core/schoolBasics';

/**
 * Profil du pratiquant, pur : sa forme, ses champs relus avec
 * contrôle (fichier de réglages importé, ancien profil), son âge et ses zones
 * cardiaques. Le magasin et ses écritures restent dans `hooks/useAthleteProfile.ts`,
 * les règles du pop-up dans `library/profilePrompt.ts`.
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
  /**
   * Banc de poissons du Profil (`core/fishSchool.ts`) : nombre de sessions imposé, entier de 0 à `SCHOOL_TRIAL_MAX`,
   * réglage d'essai provisoire ; `null` : le vrai compte des sessions.
   */
  schoolTrialSessions: number | null;
  /** Dessin des poissons du banc du Profil, choisi dans Réglages › Pratiquant ; `null` : `DEFAULT_SCHOOL_STYLE`. */
  schoolStyle: SchoolStyle | null;
  /** Banc de poissons et eau cachés (choix « Aucun ») ; le style choisi est gardé pour le jour où il revient. */
  schoolHidden: boolean;
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
  schoolTrialSessions: null,
  schoolStyle: null,
  schoolHidden: false,
};

/** Plages plausibles de chaque champ numérique. */
export type AthleteNumberField = Exclude<keyof AthleteProfile,
  'name' | 'avatar' | 'sex' | 'hrThresholds' | 'hrMaxSource' | 'hrRestSource' | 'schoolStyle' | 'schoolHidden'>;

/** Champs numériques du Profil dont la plage n'est pas dans `ATHLETE_BOUNDS` (`library/profilePrompt.ts`). */
type ProfileOnlyNumberField = 'schoolTrialSessions';

/** Plage du nombre de sessions imposé au banc de poissons (réglage d'essai). */
export const SCHOOL_TRIAL_BOUNDS: [number, number] = [0, SCHOOL_TRIAL_MAX];

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

/** Nombre de sessions imposé au banc de poissons, `null` sans essai (automatique) ou pour une valeur qui n'est pas un entier de sa plage. */
export const athleteSchoolTrialSessions = (profile: Partial<Pick<AthleteProfile, 'schoolTrialSessions'>>): number | null => {
  const raw: unknown = profile.schoolTrialSessions;
  return inRange(raw, ...SCHOOL_TRIAL_BOUNDS) && Number.isInteger(raw) ? raw : null;
};

/** Dessin des poissons du banc choisi, `null` sans choix ou pour un style inconnu (le style par défaut). */
export const athleteSchoolStyle = (profile: Partial<Pick<AthleteProfile, 'schoolStyle'>>): SchoolStyle | null => {
  const raw: unknown = profile.schoolStyle;
  return isSchoolStyle(raw) ? raw : null;
};

/** Banc caché par le choix « Aucun » ; tout ce qui n'est pas `true` (ancien profil sans le champ compris) le montre. */
export const athleteSchoolHidden = (profile: Partial<Pick<AthleteProfile, 'schoolHidden'>>): boolean => {
  const raw: unknown = profile.schoolHidden;
  return raw === true;
};

/** Plages plausibles des champs numériques du pratiquant (celle du réglage d'essai du banc : `library/profilePrompt.ts`). */
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
 * 143) : un champ d'une forme inattendue ou hors de sa plage (`ATHLETE_BOUNDS`)
 * est remis à vide, jamais repris tel quel ; un champ inconnu, celui d'une
 * ancienne version compris (l'objectif de l'ancienne racine du Profil, par
 * exemple), est écarté et n'est plus réécrit.
 */
export const sanitizeAthleteProfile = (raw: unknown): AthleteProfile => {
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
    schoolTrialSessions: athleteSchoolTrialSessions({ schoolTrialSessions: p.schoolTrialSessions as number | null }),
    schoolStyle: athleteSchoolStyle({ schoolStyle: p.schoolStyle as SchoolStyle | null }),
    schoolHidden: athleteSchoolHidden({ schoolHidden: p.schoolHidden as boolean }),
  };
};

/**
 * Profil tel que rangé sur l'appareil, relu avec le contrôle de `sanitizeAthleteProfile`
 * (il peut venir du fichier de réglages d'un autre appareil) : seul le nom reste
 * tel que tapé, espaces de fin compris, pour la frappe en cours dans son champ.
 */
export const storedAthleteProfile = (raw: unknown): AthleteProfile => {
  const profile = sanitizeAthleteProfile(raw);
  const name = (raw as { name?: unknown } | null)?.name;
  return typeof name === 'string' && profile.name !== null ? { ...profile, name: name.slice(0, ATHLETE_NAME_MAX) } : profile;
};
