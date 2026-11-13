import type { CSSProperties } from 'react';
import './BrushFrame.css';

/**
 * Cadre peint (`BrushFrame.css`) : la classe et la couleur à poser sur un cadre. L'angle ouvert tourne d'un cadre au
 * suivant dans le sens des aiguilles d'une montre, en partant d'en bas à droite : bas droite, bas gauche, haut gauche,
 * haut droite, puis de nouveau bas droite.
 */
export const BRUSH_OPENINGS = ['bd', 'bg', 'hg', 'hd'] as const;

export interface BrushFrameProps {
  className: string;
  style: CSSProperties;
}

/** Classe et couleur du cadre de rang `index` (à partir de 0) ; `color` est une couleur CSS, déjà celle du thème. */
export const brushFrame = (index: number, color: string): BrushFrameProps => ({
  className: `brush-frame brush-frame--${BRUSH_OPENINGS[((index % BRUSH_OPENINGS.length) + BRUSH_OPENINGS.length) % BRUSH_OPENINGS.length]}`,
  style: { '--brush': color } as CSSProperties,
});
