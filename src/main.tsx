import './theme/tokens.css';
import './theme/base.css';
import './components/ui/ui.css';
import './components/AppShell.css';
import { setLanguage, type Dictionary, type Lang } from './core/i18n';
import { paintEarlyTheme } from './hooks/themePaint';
import { startupLanguage } from './platform/language';
import { initStorage } from './platform/storage';

/**
 * Amorçage : stockage, langue et dictionnaire, avant que l'application ne soit importée (`boot.tsx`). Une table de
 * module qui porte un texte (`label: t('général')`) est ainsi lue dans la bonne langue. Ce fichier n'importe, même de
 * loin, aucun module qui porte un texte à traduire : `src/mainImports.test.ts` fige la liste de ses imports.
 */

/** Dictionnaires, chargés à la demande : seul celui de la langue choisie est lu. */
const DICTIONARIES = import.meta.glob<Dictionary>('./locales/*.json', { import: 'default' });

/** Dictionnaire d'une langue ; vide en français, ou s'il ne se charge pas (l'interface reste alors en français). */
const loadDictionary = async (lang: Lang): Promise<Dictionary> => {
  if (lang === 'fr') return {};
  try {
    return (await DICTIONARIES[`./locales/${lang}.json`]?.()) ?? {};
  } catch {
    return {};
  }
};

// Thème posé tout de suite, sans attendre le stockage : dans le navigateur, le réglage est déjà lisible ; sur le
// téléphone, « Auto » (le défaut) suit déjà le système. Reposé une fois le stockage natif chargé (`boot.tsx`).
paintEarlyTheme();

// Le stockage natif doit être en mémoire avant le premier rendu : les hooks le lisent pendant le rendu
// (`platform/storage.ts`). La langue s'y lit, puis l'application se charge.
void initStorage().then(async () => {
  const lang = startupLanguage();
  setLanguage(lang, await loadDictionary(lang));
  document.documentElement.lang = lang;
  const { startApp } = await import('./boot');
  await startApp();
});
