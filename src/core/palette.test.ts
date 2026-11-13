import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_PALETTE, BASE_COLOR, DEFAULT_ACTIVITIES, THEME_BACKGROUND, contrastRatio, drawnShadeForTheme, isLostOnBackground,
  readableInk, shadeForTheme,
} from './activities';
import { SPORT_PROFILES } from './sportProfiles';
import type { SportType } from './types';

/**
 * Palette des activités : douze couleurs distinctes, en clair comme en nuit,
 * loin du vert et du rouge d'Enregistrer ; le texte posé sur l'une d'elles
 * prend le noir ou le blanc. Les seuils sont posés sur les valeurs mesurées
 * de la palette, qui est figée : on ne retouche aucune couleur pour passer un
 * test.
 */

interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
const css = fs.readFileSync(new URL('../theme/tokens.css', import.meta.url), 'utf8');

/** Valeur brute de `--bg` dans le bloc qui suit `selector` de `tokens.css`. */
const background = (selector: string): string => {
  const start = css.indexOf(selector);
  const body = css.slice(start, css.indexOf('}', start)).replace(/\/\*[\s\S]*?\*\//g, '');
  return /--bg:\s*([^;]+);/.exec(body)![1].trim().toLowerCase();
};

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const linear = (hex: string) => [0, 1, 2].map((i) => channel(hex, i));
/** Écart perçu, distance dans OKLab (× 100). */
const oklab = (hex: string) => {
  const [r, g, b] = linear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const distance = (a: string, b: string) => {
  const [p, q] = [oklab(a), oklab(b)];
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/** Vert vif d'Enregistrer, rouge d'enregistrement et rouge d'« Arrêter » (`--record`, `--recording`, `--stop`). */
const RECORD_COLORS = { vert: '#aaff00', rouge: '#e53935', arret: '#c62828' };

const LIGHT = ACTIVITY_PALETTE.map((c) => c.light);
const DARK = ACTIVITY_PALETTE.map((c) => c.dark);

describe('palette des activités', () => {
  it('douze couleurs, en minuscules, aux noms distincts, le blanc en tête', () => {
    expect(ACTIVITY_PALETTE).toHaveLength(12);
    for (const c of ACTIVITY_PALETTE) {
      expect(c.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.dark).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(ACTIVITY_PALETTE.map((c) => c.name)).size).toBe(12);
    expect(ACTIVITY_PALETTE[0]).toMatchObject({ light: '#ffffff', name: 'Blanc' });
  });

  it('en nuit, le noir devient blanc et le blanc noir ; les dix autres ne changent pas', () => {
    const changed = ACTIVITY_PALETTE.filter((c) => c.dark !== c.light);
    expect(changed.map((c) => [c.light, c.dark])).toEqual([['#ffffff', '#000000'], ['#000000', '#ffffff']]);
    for (const c of changed) expect(c.darkName).toBeDefined();
  });

  for (const [theme, set] of [['clair', LIGHT], ['nuit', DARK]] as const) {
    it(`${theme} : distinctes deux à deux (écart mesuré : 15,7 au plus près)`, () => {
      for (let i = 0; i < set.length; i++) {
        for (let j = i + 1; j < set.length; j++) {
          expect(distance(set[i], set[j]), `${set[i]} / ${set[j]}`).toBeGreaterThanOrEqual(15);
        }
      }
    });

    it(`${theme} : loin du vert vif (17,2 mesuré) et des rouges d'enregistrement (12,4 mesuré)`, () => {
      for (const c of set) {
        expect(distance(c, RECORD_COLORS.vert), c).toBeGreaterThanOrEqual(17);
        expect(distance(c, RECORD_COLORS.rouge), c).toBeGreaterThanOrEqual(12);
        expect(distance(c, RECORD_COLORS.arret), c).toBeGreaterThanOrEqual(12);
      }
    });
  }

  it('chaque calcul a sa couleur de base dans la palette', () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) expect(LIGHT).toContain(BASE_COLOR[sport]);
  });

  it('les onze activités de départ ont chacune la leur, le blanc reste libre', () => {
    const colors = DEFAULT_ACTIVITIES.map((a) => a.color);
    for (const c of colors) expect(LIGHT).toContain(c);
    expect(new Set(colors).size).toBe(DEFAULT_ACTIVITIES.length);
    expect(colors).not.toContain('#ffffff');
  });

  it('shadeForTheme : la version de nuit en sombre, la couleur telle quelle en clair ou hors palette', () => {
    expect(shadeForTheme('#000000', true)).toBe('#ffffff');
    expect(shadeForTheme('#FFFFFF', true)).toBe('#000000');
    expect(shadeForTheme('#003e52', true)).toBe('#003e52');
    expect(shadeForTheme('#000000', false)).toBe('#000000');
    expect(shadeForTheme('#123456', true)).toBe('#123456');
  });
});

describe('lisibilité sur le fond du thème', () => {
  it('les fonds connus du calcul sont ceux de tokens.css', () => {
    expect(background(':root,\n.theme-light,\n.leaflet-container {')).toBe(THEME_BACKGROUND.light);
    expect(background(":root[data-theme='dark'] {")).toBe(THEME_BACKGROUND.dark);
  });

  it('contrastRatio : de 1 à 21, null hors de #rrggbb', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#646464', '#646464')).toBeCloseTo(1, 5);
    expect(contrastRatio('var(--ink)', '#ffffff')).toBeNull();
  });

  it('readableInk : le noir sur une couleur claire, le blanc sur une sombre, toujours lisible', () => {
    expect(readableInk('#ffffff')).toBe('#000000');
    expect(readableInk('#e6c229')).toBe('#000000');
    expect(readableInk('#72b0bd')).toBe('#000000');
    expect(readableInk('#000000')).toBe('#ffffff');
    expect(readableInk('#003e52')).toBe('#ffffff');
    expect(readableInk('#8e1b2e')).toBe('#ffffff');
    // Le moins contrasté de la palette mesure 4,75 (le magenta, sous du noir).
    for (const c of [...LIGHT, ...DARK]) expect(contrastRatio(c, readableInk(c)), c).toBeGreaterThanOrEqual(4.5);
  });

  it("drawnShadeForTheme : l'encre quand la couleur se confond avec le fond, sa couleur du thème sinon", () => {
    expect(drawnShadeForTheme('#ffffff', false)).toBe('var(--ink)');
    expect(drawnShadeForTheme('#ffffff', true)).toBe('var(--ink)');
    expect(drawnShadeForTheme('#000000', false)).toBe('#000000');
    expect(drawnShadeForTheme('#000000', true)).toBe('#ffffff');
    // Le bleu océan reste lui-même la nuit, même peu contrasté (1,7 sur le fond noir).
    expect(drawnShadeForTheme('#003e52', true)).toBe('#003e52');
    expect(drawnShadeForTheme('#e6c229', false)).toBe('#e6c229');
    // Hors palette, et toute autre écriture : telle quelle.
    expect(drawnShadeForTheme('#123456', true)).toBe('#123456');
    expect(drawnShadeForTheme('#888', false)).toBe('#888');
    // Seuls le blanc de jour et le noir de nuit passent à l'encre.
    expect(LIGHT.filter((c) => drawnShadeForTheme(c, false) === 'var(--ink)')).toEqual(['#ffffff']);
    expect(LIGHT.filter((c) => drawnShadeForTheme(c, true) === 'var(--ink)')).toEqual(['#ffffff']);
  });

  it('isLostOnBackground : le cadre qui se confond avec le fond reçoit un cerne (couleur déjà celle du thème)', () => {
    expect(isLostOnBackground('#ffffff', false)).toBe(true);
    expect(isLostOnBackground(shadeForTheme('#ffffff', true), true)).toBe(true);
    expect(isLostOnBackground('#000000', false)).toBe(false);
    expect(isLostOnBackground(shadeForTheme('#000000', true), true)).toBe(false);
    expect(isLostOnBackground('#003e52', true)).toBe(false);
    expect(isLostOnBackground('var(--ink)', false)).toBe(false);
    expect(LIGHT.filter((c) => isLostOnBackground(c, false))).toEqual(['#ffffff']);
    expect(LIGHT.filter((c) => isLostOnBackground(shadeForTheme(c, true), true))).toEqual(['#ffffff']);
  });
});
