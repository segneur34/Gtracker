import type { SchoolStyle } from '../../core/schoolBasics';

/** Longueur de dessin des formes de poisson (`fishShapes.ts`), en px. */
const FISH_SHAPE_SIZE = 14;

/** Identifiant du symbole d'une forme de poisson dans un style (`FishSprite`). */
export const fishSymbolId = (style: SchoolStyle, shape: number): string => `fz-${style}-${shape}`;

/** Mise à l'échelle d'un dessin pour un poisson long de `size` px. */
export const fishScale = (size: number): number => size / FISH_SHAPE_SIZE;
