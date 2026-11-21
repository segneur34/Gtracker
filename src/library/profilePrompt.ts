import { inRange } from '../core/basics';
import { ATHLETE_BOUNDS, athleteName, SCHOOL_TRIAL_BOUNDS, type AthleteNumberField, type AthleteProfile } from './athleteProfile';

/**
 * Règles du Profil liées à la mémoire et aux cartes d'ouverture, pures :
 * champs que le pop-up demande, et quand il s'ouvre.
 */

/** Plages plausibles de chaque champ numérique du Profil, réglage d'essai du banc de poissons compris. */
const PROFILE_BOUNDS: Record<AthleteNumberField, [number, number]> = {
  ...ATHLETE_BOUNDS,
  schoolTrialSessions: SCHOOL_TRIAL_BOUNDS,
};

/** Champs numériques qui ne prennent qu'un entier. */
const INTEGER_FIELDS: ReadonlySet<AthleteNumberField> = new Set(['schoolTrialSessions']);

/** Une valeur numérique saisie et dans sa plage (relue avec contrôle : fichier de réglages importé). */
export const validProfileNumber = (field: AthleteNumberField, raw: unknown): boolean => {
  const [lo, hi] = PROFILE_BOUNDS[field];
  return inRange(raw, lo, hi) && (!INTEGER_FIELDS.has(field) || Number.isInteger(raw));
};

/**
 * Champs que le pop-up du Profil demande tant qu'ils manquent : le pseudo et l'année de naissance ;
 * sexe, poids et taille ne sont plus demandés, ils se règlent dans Réglages › Pratiquant ; la FC max et la FC repos
 * viennent des tests.
 */
export const PROFILE_PROMPT_FIELDS = ['name', 'birthYear'] as const;
export type ProfilePromptField = (typeof PROFILE_PROMPT_FIELDS)[number];

/** Champs du pop-up qui manquent au profil, dans leur ordre ; vide : le profil est rempli. */
export const missingProfileFields = (profile: Partial<AthleteProfile>): ProfilePromptField[] =>
  PROFILE_PROMPT_FIELDS.filter((field) => {
    switch (field) {
      case 'name': return athleteName({ name: profile.name ?? null }) === null;
      default: return !validProfileNumber(field, profile[field]);
    }
  });

/**
 * Le pop-up du profil s'ouvre-t-il sur le Profil ? Dans l'application seulement,
 * une fois par lancement, tant qu'un champ manque, et jamais par-dessus la carte
 * de la mémoire ou celle des autorisations (il attend alors le lancement suivant).
 */
export const shouldPromptProfile = ({ native, missing, askedThisLaunch, otherCardShown }: {
  native: boolean;
  missing: readonly ProfilePromptField[];
  askedThisLaunch: boolean;
  otherCardShown: boolean;
}): boolean => native && missing.length > 0 && !askedThisLaunch && !otherCardShown;

/**
 * Ordre des cartes d'ouverture du Profil : la mémoire, puis les autorisations, puis le profil. Le pop-up
 * n'est posé qu'une fois les deux décidées (`permissionsShown` : `null` tant que les
 * autorisations ne sont pas lues) ; `otherCardShown` : l'une d'elles est à l'écran.
 */
/**
 * La fenêtre de l'application du téléphone (programme Windows) passe après toutes les autres cartes d'ouverture :
 * posée seulement quand la mémoire est prête et que les autorisations et le pop-up du profil ont décidé de ne pas
 * paraître (`false`, ni `null` en attente ni `true`). Si l'un d'eux s'est ouvert, elle attend le lancement suivant :
 * jamais deux fenêtres ouvertes d'elles-mêmes l'une sur l'autre.
 */
export const phoneAppOfferGate = ({ memoryNeedsAction, memoryReady, permissionsShown, profileShown }: {
  memoryNeedsAction: boolean;
  memoryReady: boolean;
  permissionsShown: boolean | null;
  profileShown: boolean | null;
}): boolean => !memoryNeedsAction && memoryReady && permissionsShown === false && profileShown === false;

export const profilePromptGate = ({ memoryNeedsAction, memoryReady, permissionsShown }: {
  memoryNeedsAction: boolean;
  memoryReady: boolean;
  permissionsShown: boolean | null;
}): { mount: boolean; otherCardShown: boolean } => ({
  mount: memoryNeedsAction || (memoryReady && permissionsShown !== null),
  otherCardShown: memoryNeedsAction || permissionsShown === true,
});
