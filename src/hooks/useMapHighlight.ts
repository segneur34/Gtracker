import { useCallback, useMemo, useState } from 'react';

/**
 * Surbrillance de la carte d'une analyse : une seule à la fois (un top, un
 * podium de manœuvres, une série ou un vol, un saut, le tronçon
 * d'un graphe zoomé), rattachée à l'onglet qui l'a montrée. En montrer une
 * autre la remplace ; fermer son onglet l'efface, et le rouvrir ne la ramène
 * pas. Les virements et empannages de la voile, cases à cocher, n'en sont pas.
 */

export interface MapHighlight<P extends string> {
  /** Clé montrée depuis l'onglet `panel`, sinon `null` ; jamais le tronçon zoomé, qui a `zoomPanel`. */
  shownIn: (panel: P) => string | null;
  /** Montre `key` depuis `panel`, à la place de la précédente ; `null` l'efface. */
  show: (panel: P, key: string | null) => void;
  /** Onglet dont le graphe zoomé est montré sur la carte (« +carte », `useZoomOnMap`), sinon `null`. */
  zoomPanel: P | null;
  /** Montre le tronçon zoomé du graphe de `panel`, à la place de la surbrillance précédente. */
  showZoom: (panel: P) => void;
}

/** Clé réservée au tronçon d'un graphe zoomé : aucune autre surbrillance ne la prend. */
const ZOOM_KEY = 'zoom:graphe';

/** Rendue stable tant que la surbrillance ne change pas : ses rappels peuvent passer à un panneau mémoïsé. */
export const useMapHighlight = <P extends string>(open: Record<P, boolean>): MapHighlight<P> => {
  const [shown, setShown] = useState<{ panel: P; key: string } | null>(null);
  // Onglet fermé : la surbrillance s'efface pendant ce rendu même (React refait
  // aussitôt le rendu du composant), pour ne pas revenir à sa réouverture.
  if (shown !== null && !open[shown.panel]) setShown(null);
  const live = shown !== null && open[shown.panel] ? shown : null;
  const show = useCallback((panel: P, key: string | null) => setShown(key === null ? null : { panel, key }), []);
  const showZoom = useCallback((panel: P) => setShown({ panel, key: ZOOM_KEY }), []);
  return useMemo(() => {
    const shownIn = (panel: P) => (live !== null && live.panel === panel && live.key !== ZOOM_KEY ? live.key : null);
    return { shownIn, show, zoomPanel: live !== null && live.key === ZOOM_KEY ? live.panel : null, showZoom };
  }, [live, show, showZoom]);
};
