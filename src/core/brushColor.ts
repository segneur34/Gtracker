import { THEME_BACKGROUND, contrastRatio, isLostOnBackground, shadeForTheme } from './activities';

/**
 * Couleur du coup de pinceau qui entoure les cadres du Profil : celle de l'activité favorite, vue du thème.
 * Le jour, la couleur de la fiche ; la nuit, sa version de nuit (le noir devient blanc, le blanc noir), puis éclaircie
 * si elle se lit mal sur le fond sombre. Une couleur qui se confondrait avec le fond (le blanc le jour, le noir la
 * nuit) prend l'encre, comme les dessins d'activité.
 */

/** Contraste minimal d'un trait de couleur sur le fond de nuit (seuil WCAG du texte courant). */
const NIGHT_CONTRAST = 4.5;
/** Saturation maximale d'une couleur éclaircie : monter la luminosité d'une couleur vive la rendrait criarde. */
const NIGHT_MAX_SATURATION = 0.6;
/** Pas de luminosité, en fraction de l'échelle (un point sur cent). */
const LIGHTNESS_STEP = 0.01;

interface Hsl { h: number; s: number; l: number }

const toHsl = (hex: string): Hsl => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
};

const toHex = ({ h, s, l }: Hsl): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector] as [number, number, number];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Couleur éclaircie pour le fond de nuit : même teinte ; tant que le contraste avec le fond est sous 4,5:1, la
 * luminosité monte d'un point, la saturation plafonnée à 60 % dès la première hausse. Une couleur déjà assez
 * contrastée, ou hors de l'écriture `#rrggbb`, ne bouge pas.
 */
export const lightenForNight = (color: string): string => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const lowerCase = color.toLowerCase();
  if ((contrastRatio(lowerCase, THEME_BACKGROUND.dark) ?? Infinity) >= NIGHT_CONTRAST) return lowerCase;
  const { h, s, l } = toHsl(lowerCase);
  const capped = Math.min(s, NIGHT_MAX_SATURATION);
  for (let lightness = l + LIGHTNESS_STEP; lightness < 1 + LIGHTNESS_STEP; lightness += LIGHTNESS_STEP) {
    const candidate = toHex({ h, s: capped, l: Math.min(1, lightness) });
    if ((contrastRatio(candidate, THEME_BACKGROUND.dark) ?? Infinity) >= NIGHT_CONTRAST) return candidate;
  }
  return '#ffffff';
};

/** Couleur du pinceau pour la couleur de fiche d'une activité : `#rrggbb`, ou `var(--ink)` si elle se perdrait sur le fond. */
export const brushColorFor = (color: string, dark: boolean): string => {
  const shade = shadeForTheme(color, dark);
  if (isLostOnBackground(shade, dark)) return 'var(--ink)';
  return dark ? lightenForNight(shade) : shade;
};
