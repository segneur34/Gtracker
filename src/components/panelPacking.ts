import { useEffect, useState } from 'react';

/**
 * Tassement des panneaux d'une analyse sur ordinateur. Les panneaux vont deux
 * par ligne dans une boîte flexible qui passe à la ligne : chaque ligne est
 * aussi haute que son plus haut panneau, et un panneau court laissait un grand
 * vide sous lui jusqu'à la ligne suivante. Ici, chaque panneau remonte juste
 * sous le dernier panneau qu'il chevauche en largeur : dans chaque colonne,
 * les panneaux se suivent sans vide. Ni l'ordre ni la colonne ne changent,
 * puisque seule la hauteur bouge. Une seule colonne (téléphone, fenêtre
 * étroite) : rien ne remonte.
 */

/** Place d'un panneau dans sa boîte, en pixels, avant tassement. */
export interface PanelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Recouvrement horizontal minimal, en pixels, pour que deux panneaux soient dans la même colonne. */
const OVERLAP_PX = 1;

/** Remontée sous laquelle un panneau reste en place (arrondis des mesures). */
const MIN_LIFT_PX = 0.5;

export interface PanelPacking {
  /** Remontée de chaque panneau, en pixels (0 pour un panneau absent, `null`). */
  lifts: number[];
  /** Hauteur gagnée en bas de la boîte, à lui retirer pour ne pas laisser de vide sous le dernier panneau. */
  spare: number;
}

const overlaps = (a: PanelBox, b: PanelBox): boolean =>
  a.left < b.left + b.width - OVERLAP_PX && b.left < a.left + a.width - OVERLAP_PX;

/**
 * Remontée de chaque panneau, dans l'ordre de la page : un panneau se pose à
 * `gap` sous le bas, déjà remonté, du plus bas des panneaux précédents qu'il
 * chevauche en largeur, en haut de la boîte s'il n'en chevauche aucun ; il ne
 * descend jamais.
 */
export function packPanels(boxes: ReadonlyArray<PanelBox | null>, gap: number): PanelPacking {
  const placed: Array<{ box: PanelBox; bottom: number }> = [];
  let naturalBottom = 0;
  let packedBottom = 0;
  const lifts = boxes.map((box) => {
    if (box === null) return 0;
    let floor = 0;
    for (const prev of placed) {
      if (overlaps(prev.box, box)) floor = Math.max(floor, prev.bottom + gap);
    }
    const raw = box.top - floor;
    const lift = raw > MIN_LIFT_PX ? raw : 0;
    const bottom = box.top - lift + box.height;
    placed.push({ box, bottom });
    naturalBottom = Math.max(naturalBottom, box.top + box.height);
    packedBottom = Math.max(packedBottom, bottom);
    return lift;
  });
  const spare = naturalBottom - packedBottom;
  return { lifts, spare: spare > MIN_LIFT_PX ? spare : 0 };
}

/**
 * Tasse les enfants de la boîte qui reçoit la référence rendue (`packPanels`), à chaque changement de
 * taille de la boîte ou d'un panneau (graphe replié, poignée d'angle, onglet
 * ouvert) et à chaque panneau ajouté ou retiré. Le panneau remonte par
 * `position: relative` et un `top` négatif : sa place dans le flux ne change
 * pas, et rien de ce qu'il contient ne change de repère. Le vide gagné en bas
 * est retiré par une marge négative de la boîte.
 */
export function usePanelPacking(): (box: HTMLElement | null) => void {
  // Référence par fonction : la boîte n'apparaît qu'avec les onglets, parfois après le premier rendu.
  const [box, setBox] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
    const panels = () => Array.from(box.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
    const pack = () => {
      const items = panels();
      // Mesure de la place naturelle, sans la remontée précédente.
      for (const el of items) el.style.removeProperty('top');
      const origin = box.getBoundingClientRect();
      const boxes = items.map((el) => {
        if (el.getClientRects().length === 0) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height };
      });
      const { lifts, spare } = packPanels(boxes, parseFloat(getComputedStyle(box).rowGap) || 0);
      items.forEach((el, i) => {
        if (lifts[i] <= 0) return;
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.style.top = `${-lifts[i]}px`;
      });
      if (spare > 0) box.style.marginBottom = `${-spare}px`;
      else box.style.removeProperty('margin-bottom');
    };
    // Remonter un panneau ne change aucune taille observée : pas de boucle.
    const resize = new ResizeObserver(pack);
    const observe = () => {
      resize.disconnect();
      resize.observe(box);
      for (const el of panels()) resize.observe(el);
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(box, { childList: true });
    observe();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      for (const el of panels()) el.style.removeProperty('top');
      box.style.removeProperty('margin-bottom');
    };
  }, [box]);
  return setBox;
}
