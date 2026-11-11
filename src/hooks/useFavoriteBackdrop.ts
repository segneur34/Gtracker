import { useMemo } from 'react';
import type { BackdropVariant } from '../core/backdropPattern';
import { favoriteFamily } from '../library/profile';
import { useVisibility } from './useSportSettings';
import { useVisibleStatSessions } from './useVisibleStatSessions';

/**
 * Fond des pages hors sport (accueil, Profil, Réglages, Statistiques dans
 * « Tout ») : le motif de la famille du sport préféré de toutes les sessions
 * classées et visibles des familles proposées (voile et surf), comme la photo par défaut du Profil ; les courbes de
 * niveau tant qu'il n'y en a pas (choix du produit). Les fiches
 * sont déjà en mémoire : rien n'est lu en plus.
 */
export function useFavoriteBackdrop(): BackdropVariant {
  const { all } = useVisibleStatSessions();
  const { activities } = useVisibility();
  return useMemo(() => favoriteFamily(all, activities.map((a) => a.id)) ?? 'contours', [all, activities]);
}
