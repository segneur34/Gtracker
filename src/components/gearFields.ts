import { t } from '../core/i18n';

/** Champ texte du matériel : clé dans les notes, intitulé, exemple. */
export interface GearField {
  field: 'foil' | 'mast' | 'wing' | 'gear1' | 'gear2';
  label: string;
  placeholder: string;
}

/**
 * Champs du matériel hors voile : `gear1` et `gear2`, sous les deux intitulés
 * de l'activité (Réglages), avec l'exemple de chacun (le même par défaut).
 */
export const gearFieldsFor = (
  labels: readonly [string, string],
  placeholders: readonly [string, string] = [t('ex. modèle, taille'), t('ex. modèle, taille')]
): GearField[] => [
  { field: 'gear1', label: labels[0], placeholder: placeholders[0] },
  { field: 'gear2', label: labels[1], placeholder: placeholders[1] },
];
