import { useCallback, useSyncExternalStore } from 'react';
import { shadeForTheme } from '../core/activities';
import { systemPrefersDark, subscribeSystemDark } from '../platform/screen';
import { jsonStore } from '../platform/storage';
import {
  THEME_STORAGE_KEY, parseThemeSettings, resolveTheme, sameAppliedTheme, type AppliedTheme, type ThemeSettings,
} from '../theme/themeSettings';
import { createListeners } from './createStore';
import { paintTheme } from './themePaint';

/**
 * Thème de l'interface, réglé par appareil dans Réglages › Affichage
 * (`theme/theme.ts`) : seul endroit qui le pose sur `<html>` (`data-theme`,
 * `data-eco`, lus par `theme/tokens.css`), règle la couleur de la barre du
 * navigateur et les icônes des barres du téléphone, et suit le réglage du
 * système pour « Auto » (`platform/screen.ts` : greffon sur le téléphone,
 * `matchMedia` dans le navigateur). `startTheme` le pose avant le premier
 * rendu (`boot.tsx`, après le premier thème de l'amorçage, `themePaint.ts`), puis le suit : réglage changé, thème du téléphone
 * changé, application ouverte ou reprise de l'arrière-plan.
 */

/** Dernière lecture : le même objet tant que la valeur stockée ne change pas (`useSyncExternalStore`). */
let lastRead: { raw: unknown; settings: ThemeSettings } | null = null;

const readSettings = (): ThemeSettings => {
  const raw = jsonStore.read<unknown>(THEME_STORAGE_KEY);
  if (lastRead && lastRead.raw === raw) return lastRead.settings;
  lastRead = { raw, settings: parseThemeSettings(raw) };
  return lastRead.settings;
};

let applied: AppliedTheme = { theme: 'light', eco: false };
const listeners = createListeners();
let started = false;

/** Pose le thème du réglage et du système sur `<html>` ; prévient les abonnés s'il change. */
const apply = (force = false): void => {
  if (typeof document === 'undefined') return;
  const next = resolveTheme(readSettings(), systemPrefersDark());
  if (!force && sameAppliedTheme(next, applied)) return;
  applied = next;
  paintTheme(next, systemPrefersDark());
  listeners.notify();
};

/**
 * Pose le thème tout de suite, de façon synchrone, puis le suit. À appeler
 * une fois le stockage du téléphone chargé (`initStorage`), avant le premier
 * rendu ; l'amorçage a déjà posé un premier thème (`paintEarlyTheme`), qui
 * peut différer si le stockage porte un autre réglage. Un second appel ne
 * fait que reposer le thème (barres du téléphone comprises).
 */
export const startTheme = (): void => {
  apply(true);
  if (started) return;
  started = true;
  subscribeSystemDark(() => apply());
  jsonStore.subscribe((key) => {
    if (key === THEME_STORAGE_KEY) apply();
  });
};

/** Thème posé (clair ou sombre, économe ou non), suivi en direct : pour ce qui se dessine en JavaScript (racine du Profil). */
export const useAppliedTheme = (): AppliedTheme => useSyncExternalStore(listeners.subscribe, () => applied);

/** Couleur d'activité à afficher selon le thème posé (`shadeForTheme`) ; la fiche garde la couleur claire. */
export const useThemedShade = (): ((color: string) => string) => {
  const dark = useAppliedTheme().theme === 'dark';
  return useCallback((color: string) => shadeForTheme(color, dark), [dark]);
};

/** Réglage de l'appareil (Réglages › Affichage) et son changement, champ par champ. */
export const useThemeSettings = (): [ThemeSettings, (patch: Partial<ThemeSettings>) => void] => {
  const settings = useSyncExternalStore(jsonStore.subscribe, readSettings);
  const update = useCallback((patch: Partial<ThemeSettings>) => {
    jsonStore.write(THEME_STORAGE_KEY, { ...readSettings(), ...patch } satisfies ThemeSettings);
  }, []);
  return [settings, update];
};
