import { t } from '../core/i18n';

/** Ce qu'on zoome au téléphone : un graphe quelconque, ou la courbe qu'on regarde. */
export type ZoomTarget = 'graphe' | 'courbe';

/**
 * Aide du zoom sous les graphes, sur téléphone (`narrow`) et sur ordinateur.
 * `target` désigne ce qu'on zoome au téléphone ; chaque cible a sa phrase entière.
 */
export const zoomHint = (narrow: boolean, target: ZoomTarget = 'graphe'): string => {
  if (!narrow) {
    return t('Tirez une zone à la souris ou double-cliquez pour zoomer ; « Afficher » montre sur la carte la partie vue du graphe, un second clic la retire ; « Tout voir » revient.');
  }
  return target === 'courbe'
    ? t('Écartez deux doigts ou touchez deux fois la courbe pour zoomer.')
    : t('Écartez deux doigts ou touchez deux fois un graphe pour zoomer.');
};
