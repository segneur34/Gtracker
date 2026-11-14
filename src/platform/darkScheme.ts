/**
 * Thème sombre demandé par le navigateur (`prefers-color-scheme`), sans greffon : lu par `platform/screen.ts`, et dès
 * l'amorçage (`hooks/themePaint.ts`), avant que le greffon du téléphone n'ait répondu. Sur le téléphone, la WebView
 * suit alors le thème du système au lancement ; `screen.ts` prend ensuite le relais par son greffon.
 */

/** Requête du thème sombre du système, lue par « Auto » (`theme/themeSettings.ts`). */
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Requête du thème sombre du navigateur ; `null` hors navigateur (tests). */
export const browserDarkQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_SCHEME_QUERY) : null;

/** Vrai si le navigateur demande le sombre ; faux hors navigateur. */
export const browserPrefersDark = (): boolean => browserDarkQuery()?.matches ?? false;
