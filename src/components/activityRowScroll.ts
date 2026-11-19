/**
 * Défilement de la rangée des activités à la souris : quelles flèches montrer, où mène un appui,
 * à partir de quand un appui devient un glissement. Calcul pur, en pixels.
 */

/** Écart, en pixels, sous lequel la position compte comme au bord (arrondis du navigateur). */
const EDGE_TOLERANCE_PX = 1;

/** Déplacement, en pixels, à partir duquel un appui de la souris devient un glissement et ne choisit plus d'activité. */
export const DRAG_THRESHOLD_PX = 5;

/** Part de la largeur visible dont un appui sur une flèche fait glisser la rangée. */
const PAGE_FRACTION = 0.75;

export type RowArrows = { left: boolean; right: boolean };

/** Flèches à montrer : une par côté où il reste des activités cachées, aucune quand tout tient. */
export function rowArrows(scrollLeft: number, clientWidth: number, scrollWidth: number): RowArrows {
  const hidden = scrollWidth - clientWidth;
  if (hidden <= EDGE_TOLERANCE_PX) return { left: false, right: false };
  return {
    left: scrollLeft > EDGE_TOLERANCE_PX,
    right: scrollLeft < hidden - EDGE_TOLERANCE_PX,
  };
}

/** Position visée par un appui sur une flèche (`direction` 1 vers la droite, -1 vers la gauche), bornée à la rangée. */
export function pageScrollTarget(direction: 1 | -1, scrollLeft: number, clientWidth: number, scrollWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  return Math.min(max, Math.max(0, scrollLeft + direction * clientWidth * PAGE_FRACTION));
}

/** Vrai quand le déplacement de la souris depuis l'appui est un glissement et non un clic. */
export const isDrag = (dx: number): boolean => Math.abs(dx) > DRAG_THRESHOLD_PX;
