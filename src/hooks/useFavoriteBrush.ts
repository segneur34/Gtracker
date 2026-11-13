import { useMemo, type CSSProperties } from 'react';
import { brushColorFor } from '../core/brushColor';
import { favoriteActivity } from '../library/profile';
import { useVisibility } from './useSportSettings';
import { useAppliedTheme } from './useTheme';
import { useVisibleStatSessions } from './useVisibleStatSessions';

/**
 * Couleur du coup de pinceau des pages sans période (Réglages) : celle du sport préféré de toutes les sessions
 * visibles, comme le fond de page (`useFavoriteBackdrop`) ; l'encre sans session. Vue du thème (`brushColorFor`).
 * Rendue en style (`--brush`), à poser sur le conteneur des cadres peints (`BrushFrame.css`).
 */
export function useFavoriteBrush(): CSSProperties {
  const { all, activityById } = useVisibleStatSessions();
  const { activities } = useVisibility();
  const dark = useAppliedTheme().theme === 'dark';
  return useMemo(() => {
    const id = favoriteActivity(all, activities.map((a) => a.id));
    const activity = id ? activityById.get(id) : undefined;
    return { '--brush': activity ? brushColorFor(activity.color, dark) : 'var(--ink)' } as CSSProperties;
  }, [all, activities, activityById, dark]);
}
