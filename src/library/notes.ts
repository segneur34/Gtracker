/**
 * Notes de session : matériel utilisé, conditions rencontrées, appréciation.
 * Saisies par l'utilisateur, jamais déduites de la trace. En voile : foil, mât,
 * aile, vent et plan d'eau ; ailleurs : deux champs de matériel nommés par
 * activité dans Réglages, et des conditions en texte libre. L'appréciation et
 * le commentaire sont communs à toutes les activités.
 */

import { t } from '../core/i18n';

export type WindLevel = 'tres-faible' | 'faible' | 'moyen' | 'fort' | 'tres-fort';
export type WaterState = 'plat' | 'clapot' | 'vagues';
export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * Pièce ou groupe réuni à un autre : l'identifiant et le nom qu'il portait. Les
 * fiches qui les ont recopiés ne sont pas réécrites ; le rapprochement
 * (`library/gearMatch.ts`) les range sous celui qui les a reçus.
 */
export interface GearMergedRef {
  id: string;
  name: string;
}

/** Pièce du matériel enregistré d'une activité (Réglages, `gearGroups`). */
export interface GearItem {
  id: string;
  name: string;
  /** Pièces réunies à celle-ci ; absent s'il n'y en a aucune. */
  merged?: GearMergedRef[];
}

/** Groupe du matériel enregistré (« Voile », « Aile avant », « Mât »…), avec ses pièces ; une liste par activité. */
export interface GearGroup {
  id: string;
  name: string;
  items: GearItem[];
  /** Groupes réunis à celui-ci ; absent s'il n'y en a aucun. */
  merged?: GearMergedRef[];
}

/**
 * Pièce choisie dans un groupe du matériel enregistré de l'activité (Réglages),
 * ou ajoutée pour la session seule (identifiant hors de la liste). Le nom et
 * le groupe sont recopiés : la pièce se retrouve renommée (par l'identifiant)
 * ou retirée de la liste (par le nom).
 */
export interface GearChoice {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
}

export interface SailingSessionNotes {
  foil: string;
  mast: string;
  wing: string;
  /** Matériel hors voile, sous les intitulés de l'activité (`gearLabels` des Réglages). */
  gear1: string;
  gear2: string;
  /** Conditions hors voile, en texte libre. */
  conditions: string;
  /** Matériel enregistré choisi, une pièce par groupe au plus ; `null` : rien de choisi. */
  gear: GearChoice[] | null;
  windLevel: WindLevel | null;
  waterState: WaterState | null;
  rating: Rating | null;
  comment: string;
}

export const EMPTY_NOTES: SailingSessionNotes = {
  foil: '',
  mast: '',
  wing: '',
  gear1: '',
  gear2: '',
  conditions: '',
  gear: null,
  windLevel: null,
  waterState: null,
  rating: null,
  comment: '',
};

export const WIND_LEVELS: { value: WindLevel; label: string }[] = [
  { value: 'tres-faible', label: t('Très faible') },
  { value: 'faible', label: t('Faible') },
  { value: 'moyen', label: t('Moyen', { ctx: 'vent' }) },
  { value: 'fort', label: t('Fort') },
  { value: 'tres-fort', label: t('Très fort') },
];

export const WATER_STATES: { value: WaterState; label: string }[] = [
  { value: 'plat', label: t('Plat') },
  { value: 'clapot', label: t('Clapot') },
  { value: 'vagues', label: t('Vagues') },
];

/** Appréciation, du plus triste au plus content : son visage (`IconFace` de `components/icons.tsx`), sans emoji. */
export const RATINGS: { value: Rating; label: string; face: 'triste' | 'decu' | 'neutre' | 'content' | 'ravi' }[] = [
  { value: 1, label: t('Nul'), face: 'triste' },
  { value: 2, label: t('Bof'), face: 'decu' },
  { value: 3, label: t('Moyen', { ctx: 'appréciation' }), face: 'neutre' },
  { value: 4, label: t('Bien'), face: 'content' },
  { value: 5, label: t('Très bien'), face: 'ravi' },
];
