import { describe, expect, it } from 'vitest';
import { LOGO_IDS } from '../../core/activityLogos';
import { FRAME_PATH, LOGO_PATHS } from './logoPaths';

interface Fs {
  statSync(file: URL): { size: number };
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

/** Poids du fichier produit, en octets : 109 788 à sa production ; une hausse dit un tracé qui n'est plus allégé. */
const MAX_BYTES = 112_000;

/** Tracé allégé : commandes relatives et nombres entiers seulement. */
const COMPACT_PATH = /^m[-\d mlhvcsz]+z$/;

describe('tracés des logos', () => {
  it('chaque logo a son tracé, distinct des autres', () => {
    expect(Object.keys(LOGO_PATHS).sort()).toEqual([...LOGO_IDS].sort());
    for (const logo of LOGO_IDS) expect(LOGO_PATHS[logo], logo).toMatch(COMPACT_PATH);
    expect(new Set(Object.values(LOGO_PATHS)).size).toBe(LOGO_IDS.length);
    expect(FRAME_PATH).toMatch(COMPACT_PATH);
  });

  it('reste léger', () => {
    expect(fs.statSync(new URL('./logoPaths.ts', import.meta.url)).size).toBeLessThan(MAX_BYTES);
  });
});
