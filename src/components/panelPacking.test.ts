import { describe, expect, it } from 'vitest';
import { packPanels, type PanelBox } from './panelPacking';

const GAP = 10;
const box = (left: number, top: number, width: number, height: number): PanelBox => ({ left, top, width, height });

describe('packPanels', () => {
  it('remonte un panneau sous son voisin de colonne court, sans changer de colonne', () => {
    // Ligne 1 : gauche court (100), droite haut (500). Ligne 2 : deux panneaux à 510.
    const { lifts, spare } = packPanels([
      box(0, 0, 495, 100),
      box(505, 0, 495, 500),
      box(0, 510, 495, 200),
      box(505, 510, 495, 100),
    ], GAP);
    expect(lifts).toEqual([0, 0, 400, 0]);
    // Bas naturel 710, bas tassé max(110 + 200, 610) = 610.
    expect(spare).toBe(100);
  });

  it('pose un panneau pleine largeur sous le plus bas des deux colonnes', () => {
    const { lifts } = packPanels([
      box(0, 0, 495, 100),
      box(505, 0, 495, 300),
      box(0, 310, 1000, 50),
      box(0, 370, 495, 50),
      box(505, 370, 495, 200),
      box(0, 580, 495, 80),
    ], GAP);
    // Le pleine largeur reste à 310 ; sous lui, le panneau de gauche de la dernière ligne remonte sous son voisin de colonne.
    expect(lifts).toEqual([0, 0, 0, 0, 0, 580 - (370 + 50 + GAP)]);
  });

  it('ne touche à rien sur une seule colonne', () => {
    const { lifts, spare } = packPanels([
      box(0, 0, 400, 100),
      box(0, 110, 400, 300),
      box(0, 420, 400, 50),
    ], GAP);
    expect(lifts).toEqual([0, 0, 0]);
    expect(spare).toBe(0);
  });

  it('ignore un panneau caché et un écart dû aux arrondis', () => {
    const { lifts } = packPanels([
      box(0, 0, 495, 100),
      null,
      box(0, 110.3, 495, 50),
    ], GAP);
    expect(lifts).toEqual([0, 0, 0]);
  });

  it('remonte en haut de la boîte un panneau sans prédécesseur dans sa colonne', () => {
    const { lifts } = packPanels([
      box(0, 0, 300, 400),
      box(0, 410, 300, 50),
      box(600, 410, 300, 50),
    ], GAP);
    expect(lifts).toEqual([0, 0, 410]);
  });
});
