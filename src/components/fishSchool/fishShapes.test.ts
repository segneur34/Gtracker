import { describe, expect, it } from 'vitest';
import { SCHOOL_STYLES } from '../../core/schoolBasics';
import { FISH_SHAPE_SIZE, FISH_SHAPES } from './fishShapes';
import { fishScale } from './fishSymbols';

interface Fs {
  statSync(file: URL): { size: number };
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

/** Poids du fichier produit, en octets : 31 114 à sa production ; une hausse dit un dessin plus lourd qu'il ne faut. */
const MAX_BYTES = 60_000;

/** Classes de couleur permises, reliées au thème par `FishSchool.css`. */
const CLASSES = new Set(['fz-i', 'fz-p', 'fz-a', 'fz-g', 'fz-is', 'fz-ps']);

/** Tracé en commandes déplacement, ligne, arc et fermeture, nombres seulement. */
const PATH = /^M[-\d. mlaz]+$/;

describe('dessins des poissons du banc', () => {
  it('sept styles de huit formes, chacune dessinée', () => {
    expect(Object.keys(FISH_SHAPES).sort()).toEqual(SCHOOL_STYLES.map((s) => s.id).sort());
    for (const style of SCHOOL_STYLES) {
      expect(FISH_SHAPES[style.id], style.id).toHaveLength(8);
      for (const shape of FISH_SHAPES[style.id]) expect(shape.length, style.id).toBeGreaterThan(0);
    }
    expect(Object.values(FISH_SHAPES).flat()).toHaveLength(56);
  });

  it('couleurs en classes seulement, tracés sans renvoi', () => {
    for (const [style, shapes] of Object.entries(FISH_SHAPES)) {
      for (const shape of shapes) {
        for (const [className, d, strokeWidth] of shape) {
          const classes = className.split(' ');
          expect(classes.every((c) => CLASSES.has(c)), `${style} ${className}`).toBe(true);
          expect(classes.some((c) => c.endsWith('s')), `${style} trait`).toBe(strokeWidth !== undefined);
          expect(d, style).toMatch(PATH);
        }
      }
    }
    const text = fs.readFileSync(new URL('./fishShapes.ts', import.meta.url), 'utf8');
    expect(text).not.toMatch(/#[0-9a-f]{3,6}\b|url\(|\bid=/i);
  });

  it('la mise à l’échelle part de la longueur des dessins', () => {
    expect(fishScale(FISH_SHAPE_SIZE)).toBe(1);
  });

  it('reste léger', () => {
    expect(fs.statSync(new URL('./fishShapes.ts', import.meta.url)).size).toBeLessThan(MAX_BYTES);
  });
});
