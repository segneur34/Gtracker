import type { ThemeChoice } from './themeSettings';
/**
 * Thème de l'interface : Clair, Sombre ou Auto,
 * qui suit le réglage du téléphone ou du navigateur (`prefers-color-scheme`),
 * plus la case « Économe » (noir pur, moins d'effets), qui impose le sombre.
 * Réglé par appareil, dans Réglages › Affichage (clé `THEME_STORAGE_KEY`),
 * jamais repris d'un autre appareil. Économe n'agit que sur l'aspect : ni le
 * GPS ni l'écran allumé pendant l'enregistrement ne changent.
 *
 * Le réglage et sa résolution, sans texte, sont dans `theme/themeSettings.ts`
 * (lu dès l'amorçage), repris ici ; ce fichier y ajoute les libellés du
 * réglage. La lecture du système est dans `platform/screen.ts` (greffon sur le
 * téléphone, `matchMedia` dans le navigateur), la pose sur `<html>` dans
 * `hooks/useTheme.ts`, seul endroit qui décide (aucun bloc
 * `prefers-color-scheme` dans les feuilles de style).
 */

export {
  THEME_DEFAULT, THEME_STORAGE_KEY, parseThemeSettings, resolveTheme, sameAppliedTheme,
  type AppliedTheme, type ThemeChoice, type ThemeSettings,
} from './themeSettings';

/** Choix du bouton glissant de Réglages, dans l'ordre. */
export const THEME_CHOICES: ReadonlyArray<{ key: ThemeChoice; label: string }> = [
  { key: 'clair', label: 'Clair' },
  { key: 'sombre', label: 'Sombre' },
  { key: 'auto', label: 'Auto' },
];
