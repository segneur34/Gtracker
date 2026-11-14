import { describe, expect, it } from 'vitest';

/**
 * Palettes de `tokens.css` (claire, sombre, économe) : le texte se lit sur
 * chaque fond (contraste WCAG de 4,5 au moins pour le texte courant), les
 * accents valent l'encre, et le vert d'Enregistrer ne porte que du noir.
 */

interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
const css = fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Variables posées dans le bloc qui suit `selector`, valeurs brutes. */
const block = (selector: string): Record<string, string> => {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Bloc introuvable : ${selector}`);
  const body = css.slice(start, css.indexOf('}', start)).replace(/\/\*[\s\S]*?\*\//g, '');
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};

const light = { ...block(':root,\n.theme-light,\n.leaflet-container {'), ...block('html:root {') };
const dark = { ...light, ...block(":root[data-theme='dark'] {") };
const eco = { ...dark, ...block(':root[data-eco] {') };
const PALETTES = { clair: light, sombre: dark, économe: eco };

/** Valeur d'une variable, `var(--x)` suivi jusqu'à une couleur. */
const resolve = (palette: Record<string, string>, name: string): string => {
  let value = palette[name];
  for (let depth = 0; value?.startsWith('var('); depth++) {
    if (depth > 5) throw new Error(`Renvoi circulaire : ${name}`);
    value = palette[value.slice(4, -1).trim()];
  }
  if (!value) throw new Error(`Variable absente : ${name}`);
  return value.toLowerCase();
};

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Paires texte / fond à 4,5 au moins, dans chaque palette. */
const READABLE: [text: string, background: string][] = [
  ['--ink', '--bg'],
  ['--ink', '--surface'],
  ['--ink', '--surface-sunken'],
  ['--ink', '--surface-hover'],
  ['--ink-2', '--bg'],
  ['--muted', '--bg'],
  ['--muted', '--surface'],
  ['--muted', '--surface-sunken'],
  ['--on-ink', '--ink'],
  ['--on-record', '--record'],
  ['--tabbar-ink', '--tabbar-bg'],
  ['--tabbar-on', '--tabbar-bg'],
  ['--on-accent', '--stop'],
  /* Texte blanc de l'en-tête du Profil sur l'aplat qui tient la place de sa photo. */
  ['--on-accent', '--photo-bg'],
  ['--danger', '--bg'],
  ['--danger-ink', '--danger-soft'],
];

describe('palettes du thème', () => {
  for (const [name, palette] of Object.entries(PALETTES)) {
    it(`${name} : texte lisible sur chaque fond`, () => {
      for (const [text, background] of READABLE) {
        const ratio = contrast(resolve(palette, text), resolve(palette, background));
        expect(ratio, `${text} sur ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name} : les accents valent l'encre`, () => {
      const ink = resolve(palette, '--ink');
      for (const accent of ['--voile', '--surf', '--neutral-accent', '--home-action', '--home-action-edge']) {
        expect(resolve(palette, accent), accent).toBe(ink);
      }
    });

    it(`${name} : texte faible encore visible (près de 3 sur le fond)`, () => {
      expect(contrast(resolve(palette, '--faint'), resolve(palette, '--bg'))).toBeGreaterThanOrEqual(2.95);
    });
  }

  it('vert et rouge d\'Enregistrer, barre du bas : les mêmes dans tous les thèmes', () => {
    for (const name of ['--record', '--recording', '--stop', '--on-record', '--tabbar-bg', '--tabbar-ink', '--tabbar-on']) {
      expect(resolve(dark, name), name).toBe(resolve(light, name));
      expect(resolve(eco, name), name).toBe(resolve(light, name));
    }
  });
});
