import { browserPrefersDark } from '../platform/darkScheme';
import { jsonStore } from '../platform/storage';
import { setSystemBarsDark } from '../platform/systemBars';
import { THEME_STORAGE_KEY, parseThemeSettings, resolveTheme, type AppliedTheme } from '../theme/themeSettings';

/**
 * Pose du thème sur `<html>`, sans aucun texte affiché ni table de l'application : lue par `hooks/useTheme.ts`, qui
 * décide du thème et le suit, et dès l'amorçage (`main.tsx`), avant que la langue ne soit posée et que l'application
 * ne soit chargée.
 */

/** Couleur de la barre du navigateur (`<meta name="theme-color">`) : le fond de la page du thème posé. */
const updateThemeColor = (): void => {
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
};

/** Pose `data-theme` et `data-eco`, la couleur de la barre du navigateur et les icônes des barres du téléphone. */
export const paintTheme = (next: AppliedTheme, systemDark: boolean): void => {
  const root = document.documentElement;
  root.dataset.theme = next.theme;
  if (next.eco) root.dataset.eco = '';
  else delete root.dataset.eco;
  updateThemeColor();
  // Les barres montrent le fond du téléphone, pas celui de l'appli : leurs icônes suivent le mode du téléphone.
  setSystemBarsDark(systemDark);
};

/**
 * Premier thème, posé tout de suite sans attendre le stockage : dans le navigateur, le réglage est déjà lisible ; sur
 * le téléphone, « Auto » (le défaut) suit le thème du système, que la WebView connaît au lancement. `startTheme`
 * (`hooks/useTheme.ts`) le repose une fois le stockage chargé, puis le suit.
 */
export const paintEarlyTheme = (): void => {
  if (typeof document === 'undefined') return;
  const systemDark = browserPrefersDark();
  paintTheme(resolveTheme(parseThemeSettings(jsonStore.read<unknown>(THEME_STORAGE_KEY)), systemDark), systemDark);
};
