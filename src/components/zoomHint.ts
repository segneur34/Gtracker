import { t } from '../core/i18n';

/**
 * Aide du zoom sous les graphes, sur téléphone (`narrow`) et sur ordinateur.
 * `noun` désigne ce qu'on zoome au téléphone (« un graphe », « la courbe »).
 */
export const zoomHint = (narrow: boolean, noun?: string): string => (narrow
  ? t('Écartez deux doigts ou touchez deux fois {noun} pour zoomer.', { noun: noun ?? t('un graphe') })
  : t('Tirez une zone à la souris ou double-cliquez pour zoomer ; « Afficher » montre sur la carte la partie vue du graphe, un second clic la retire ; « Tout voir » revient.'));
