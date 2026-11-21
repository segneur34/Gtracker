/**
 * Ce que le profil du pratiquant et Réglages lisent du banc de poissons du Profil sans le dessiner : les styles de
 * dessin, le plafond du réglage d'essai, et le nombre de poissons d'un compte de sessions. Sans dépendance, pour ne
 * pas tirer la géométrie du banc (`core/fishSchool.ts`, chargée à la demande) dans le paquet de l'ouverture.
 */

/** Plafond du nombre de sessions imposé par le réglage d'essai de Réglages › Pratiquant. */
export const SCHOOL_TRIAL_MAX = 300;

/** Styles de dessin des poissons, dans l'ordre du choix. */
export const SCHOOL_STYLES = [
  { id: 'P1', name: 'Alevin au trait' },
  { id: 'P2', name: 'Silhouette' },
  { id: 'P3', name: 'Pictogramme' },
  { id: 'P4', name: 'Deux arcs' },
  { id: 'P5', name: 'Couleur d’activité' },
  { id: 'P6', name: 'Pinceau' },
  { id: 'P7', name: 'Ajouré' },
] as const;
export type SchoolStyle = (typeof SCHOOL_STYLES)[number]['id'];
export const DEFAULT_SCHOOL_STYLE: SchoolStyle = 'P4';
export const isSchoolStyle = (value: unknown): value is SchoolStyle => SCHOOL_STYLES.some((s) => s.id === value);

/** Poissons d'une session au plus. */
export const SCHOOL_FISH_MAX = 3;

/** Durée d'une heure, en secondes : un poisson de plus par heure pleine. */
const SCHOOL_HOUR_S = 3600;

/**
 * Poissons que donne une session d'après sa durée totale, en secondes : un dès la première minute (une session plus
 * courte, ou sans durée connue, en donne un aussi), puis un de plus par heure pleine, `SCHOOL_FISH_MAX` au plus.
 */
export const fishForDuration = (durationS: number | null): number => {
  if (durationS === null || !Number.isFinite(durationS) || durationS <= 0) return 1;
  return Math.min(SCHOOL_FISH_MAX, 1 + Math.floor(durationS / SCHOOL_HOUR_S));
};

/** Nombre de poissons du banc : la somme des poissons de chaque session. */
export const fishCount = (perSession: readonly number[]): number => perSession.reduce((sum, n) => sum + n, 0);

/** Session (0 : la première) que porte le poisson de rang `index`. Au-delà du dernier poisson : la session qui suit. */
export const sessionOfFish = (index: number, perSession: readonly number[]): number => {
  let before = 0;
  for (let s = 0; s < perSession.length; s++) {
    before += perSession[s];
    if (index < before) return s;
  }
  return perSession.length + Math.max(0, index - before);
};
