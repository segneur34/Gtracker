import { describe, expect, it } from 'vitest';
import { BASE_COLOR, FAMILY_SHADES, FAMILY_SHADES_DARK, activityFamily, baseActivity, shadeForTheme } from './activities';
import { SPORT_FAMILIES, SPORT_PROFILES } from './sportProfiles';
import type { SportType } from './types';

/**
 * Nuances des activités : lisibles sur fond blanc et sur les cadres sombres,
 * distinctes. Le thème n'a plus de couleur de famille (ses accents valent
 * l'encre, `theme/tokens.test.ts`) : les nuances ne sont plus liées à
 * `tokens.css`.
 */

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const linear = (hex: string) => [0, 1, 2].map((i) => channel(hex, i));
const luminance = (hex: string) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Contraste WCAG d'une couleur sur blanc. */
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);
/** Contraste WCAG de deux couleurs. */
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
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

/**
 * Surface des cadres de l'ancien thème sombre, contre laquelle les nuances
 * sombres ont été choisies ; figée ici tant que les nuances restent celles-là.
 */
const DARK_SHADES_SURFACE = '#1c2229';

describe('nuances des familles', () => {
  it('six nuances par famille, en minuscules', () => {
    for (const family of SPORT_FAMILIES) {
      expect(FAMILY_SHADES[family]).toHaveLength(6);
      for (const shade of FAMILY_SHADES[family]) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('contraste sur blanc : 4,5 pour la première nuance (texte blanc), 3 pour les autres', () => {
    for (const family of SPORT_FAMILIES) {
      const [first, ...others] = FAMILY_SHADES[family];
      expect(contrastOnWhite(first), first).toBeGreaterThanOrEqual(4.5);
      for (const shade of others) expect(contrastOnWhite(shade), shade).toBeGreaterThanOrEqual(3);
    }
  });

  it('distinctes dans une famille et d\'une famille à l\'autre', () => {
    const all = SPORT_FAMILIES.flatMap((family) => FAMILY_SHADES[family].map((shade) => ({ family, shade })));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const floor = all[i].family === all[j].family ? 6 : 8;
        expect(distance(all[i].shade, all[j].shade), `${all[i].shade} / ${all[j].shade}`).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('chaque calcul a une couleur de base parmi les nuances de sa famille', () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
      expect(FAMILY_SHADES[activityFamily(baseActivity(sport))]).toContain(BASE_COLOR[sport]);
    }
  });
});

describe('nuances des familles en sombre', () => {
  it('six nuances par famille, en minuscules', () => {
    for (const family of SPORT_FAMILIES) {
      expect(FAMILY_SHADES_DARK[family]).toHaveLength(6);
      for (const shade of FAMILY_SHADES_DARK[family]) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('la première nuance sombre porte du texte blanc', () => {
    for (const family of SPORT_FAMILIES) {
      expect(contrastOnWhite(FAMILY_SHADES_DARK[family][0]), family).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lisibles sur les cartes sombres (contraste de 3) ; une nuance déjà lisible reste celle du clair', () => {
    const surface = DARK_SHADES_SURFACE;
    for (const family of SPORT_FAMILIES) {
      FAMILY_SHADES_DARK[family].forEach((shade, i) => {
        expect(contrast(shade, surface), shade).toBeGreaterThanOrEqual(3);
        const light = FAMILY_SHADES[family][i];
        if (i > 0 && contrast(light, surface) >= 3) expect(shade, light).toBe(light);
      });
    }
  });

  it('distinctes dans une famille et d\'une famille à l\'autre', () => {
    const all = SPORT_FAMILIES.flatMap((family) => FAMILY_SHADES_DARK[family].map((shade) => ({ family, shade })));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const floor = all[i].family === all[j].family ? 6 : 8;
        expect(distance(all[i].shade, all[j].shade), `${all[i].shade} / ${all[j].shade}`).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('shadeForTheme : la nuance de même rang en sombre, la couleur telle quelle en clair ou hors palette', () => {
    expect(shadeForTheme(FAMILY_SHADES.surf[5], true)).toBe(FAMILY_SHADES_DARK.surf[5]);
    expect(shadeForTheme(FAMILY_SHADES.voile[0].toUpperCase(), true)).toBe(FAMILY_SHADES_DARK.voile[0]);
    expect(shadeForTheme(FAMILY_SHADES.surf[5], false)).toBe(FAMILY_SHADES.surf[5]);
    expect(shadeForTheme('#123456', true)).toBe('#123456');
  });
});
