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

/** Poissons par session, par tranche : jusqu'à la session `upTo`, `fish` poissons chacune ; au-delà, `fishAfter`. */
export interface SchoolCount {
  perSession: readonly { upTo: number; fish: number }[];
  fishAfter: number;
}

/** Trois par session pour les 30 premières, deux jusqu'à la 40ᵉ, puis un. */
export const SCHOOL_COUNT: SchoolCount = {
  perSession: [{ upTo: 30, fish: 3 }, { upTo: 40, fish: 2 }],
  fishAfter: 1,
};

/** Nombre de poissons pour `sessions` sessions. */
export const fishCount = (sessions: number, count: SchoolCount = SCHOOL_COUNT): number => {
  const n = Math.max(0, Math.floor(sessions));
  let total = 0;
  let prev = 0;
  for (const { upTo, fish } of count.perSession) {
    total += Math.max(0, Math.min(n, upTo) - prev) * fish;
    prev = Math.max(prev, upTo);
  }
  return total + Math.max(0, n - prev) * count.fishAfter;
};

/** Session (0 : la première) que porte le poisson de rang `index`. */
export const sessionOfFish = (index: number, count: SchoolCount = SCHOOL_COUNT): number => {
  let prev = 0;
  let before = 0;
  for (const { upTo, fish } of count.perSession) {
    const span = Math.max(0, upTo - prev) * fish;
    if (index < before + span) return prev + Math.floor((index - before) / fish);
    before += span;
    prev = Math.max(prev, upTo);
  }
  return prev + Math.floor((index - before) / count.fishAfter);
};
