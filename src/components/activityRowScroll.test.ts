import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD_PX, isDrag, pageScrollTarget, rowArrows } from './activityRowScroll';

describe('rowArrows', () => {
  it('aucune flèche quand tout tient', () => {
    expect(rowArrows(0, 500, 500)).toEqual({ left: false, right: false });
    expect(rowArrows(0, 500, 500.5)).toEqual({ left: false, right: false });
  });
  it('flèche droite seule au début', () => {
    expect(rowArrows(0, 500, 900)).toEqual({ left: false, right: true });
  });
  it('les deux au milieu', () => {
    expect(rowArrows(200, 500, 900)).toEqual({ left: true, right: true });
  });
  it('flèche gauche seule au bout, même avec un arrondi', () => {
    expect(rowArrows(400, 500, 900)).toEqual({ left: true, right: false });
    expect(rowArrows(399.4, 500, 900)).toEqual({ left: true, right: false });
  });
});

describe('pageScrollTarget', () => {
  it('avance des trois quarts de la largeur visible', () => {
    expect(pageScrollTarget(1, 0, 400, 2000)).toBe(300);
    expect(pageScrollTarget(-1, 600, 400, 2000)).toBe(300);
  });
  it('reste dans la rangée', () => {
    expect(pageScrollTarget(1, 1500, 400, 2000)).toBe(1600);
    expect(pageScrollTarget(-1, 100, 400, 2000)).toBe(0);
    expect(pageScrollTarget(1, 0, 400, 300)).toBe(0);
  });
});

describe('isDrag', () => {
  it('un appui presque immobile reste un clic', () => {
    expect(isDrag(0)).toBe(false);
    expect(isDrag(DRAG_THRESHOLD_PX)).toBe(false);
    expect(isDrag(-DRAG_THRESHOLD_PX)).toBe(false);
  });
  it('au-delà du seuil, dans les deux sens, c\'est un glissement', () => {
    expect(isDrag(DRAG_THRESHOLD_PX + 1)).toBe(true);
    expect(isDrag(-DRAG_THRESHOLD_PX - 1)).toBe(true);
  });
});
