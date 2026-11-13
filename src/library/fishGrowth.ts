/**
 * Poisson du Profil : un alevin dans son bocal, qui grandit de niveau en niveau
 * avec les semaines tenues sur l'objectif par semaine du pratiquant (le même
 * compte que la racine, `library/rootGrowth.ts`).
 *
 * Six niveaux, le premier commun aux trois voies (beau, agressif, les deux) ;
 * la voie et le style de dessin sont des choix du pratiquant, rangés dans son
 * profil, et ne changent rien au niveau. Les niveaux atteints restent acquis :
 * une semaine manquée ne fait rien perdre. Une semaine compte dès qu'elle est
 * tenue, sans attendre sa fin.
 *
 * Logique pure ; les dessins sont dans `assets/poisson/`, chargés par
 * `components/fishDrawings.ts`.
 */

import { rootGrowth, type RootSession } from './rootGrowth';

/** Nombre de niveaux, de l'alevin (1) au poisson accompli. */
export const FISH_LEVELS = 6;

/** Règle du poisson, fixée par le produit. */
export interface FishRules {
  /** Semaines tenues pour atteindre les niveaux 2, 3, 4…, en ordre croissant. */
  thresholds: readonly number[];
}

/** Niveaux 2 à 6 à 2, 5, 9, 14 et 20 semaines tenues : de plus en plus espacés. */
export const FISH_RULES: FishRules = { thresholds: [2, 5, 9, 14, 20] };

/** Style de dessin : trait fin, pinceau, estampe, pictogramme. */
export type FishStyle = 'A' | 'B' | 'F' | 'G';
/** Voie de croissance : le même alevin, puis un poisson beau, agressif, ou les deux. */
export type FishPath = 'beau' | 'agressif' | 'lesDeux';

export const FISH_STYLES: readonly { id: FishStyle; name: string }[] = [
  { id: 'A', name: 'Trait fin' },
  { id: 'B', name: 'Pinceau' },
  { id: 'F', name: 'Estampe' },
  { id: 'G', name: 'Pictogramme' },
];

export const FISH_PATHS: readonly { id: FishPath; name: string }[] = [
  { id: 'beau', name: 'Beau' },
  { id: 'agressif', name: 'Agressif' },
  { id: 'lesDeux', name: 'Les deux' },
];

/** Choix de départ, tant que le pratiquant n'en a pas fait. */
export const DEFAULT_FISH_STYLE: FishStyle = 'A';
export const DEFAULT_FISH_PATH: FishPath = 'beau';

export const isFishStyle = (raw: unknown): raw is FishStyle => FISH_STYLES.some((s) => s.id === raw);
export const isFishPath = (raw: unknown): raw is FishPath => FISH_PATHS.some((p) => p.id === raw);
/** Un niveau entier de 1 à `FISH_LEVELS`. */
export const isFishLevel = (raw: unknown): raw is number =>
  typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= FISH_LEVELS;

export interface FishGrowth {
  /** Niveau atteint, de 1 à `FISH_LEVELS`. */
  level: number;
  /** Semaines tenues, celle en cours comprise si elle l'est déjà. */
  heldWeeks: number;
  /** Semaines tenues qu'il faut pour le niveau suivant ; `null` au dernier niveau. */
  nextAtWeeks: number | null;
}

/** Niveau atteint après `heldWeeks` semaines tenues. */
export const fishLevelOf = (heldWeeks: number, rules: FishRules = FISH_RULES): number =>
  Math.min(FISH_LEVELS, 1 + rules.thresholds.filter((t) => heldWeeks >= t).length);

/**
 * Niveau du poisson à `nowMs` : les semaines tenues sur l'objectif `goalMin`
 * (en minutes), rejouées depuis la plus vieille session ; celles d'après
 * `nowMs` sont ignorées.
 */
export const fishGrowth = (sessions: readonly RootSession[], goalMin: number, nowMs: number, rules: FishRules = FISH_RULES): FishGrowth => {
  const weeks = rootGrowth(sessions, goalMin, nowMs);
  const heldWeeks = weeks.heldTotal + (weeks.held ? 1 : 0);
  const level = fishLevelOf(heldWeeks, rules);
  const next = level < FISH_LEVELS ? rules.thresholds.find((t) => t > heldWeeks) : undefined;
  return { level, heldWeeks, nextAtWeeks: next ?? null };
};

/**
 * Niveau montré et niveaux débloqués (de 1 à `unlocked`) ; un niveau d'essai
 * (réglage provisoire de Pratiquant) impose les deux.
 */
export const fishShown = (growth: Pick<FishGrowth, 'level'>, trialLevel: number | null): { level: number; unlocked: number } => {
  const level = isFishLevel(trialLevel) ? trialLevel : growth.level;
  return { level, unlocked: level };
};
