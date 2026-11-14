import { STORAGE_KEYS } from '../core/appIdentity';
import { isLang, type Lang } from '../core/i18n';
import { jsonStore } from './storage';

/**
 * Langue de l'interface choisie pour cet appareil : seul accès à la langue de l'appareil et au réglage « Langue »
 * (Réglages › Affichage). Le réglage est propre à l'appareil : il ne voyage pas avec le dossier mémoire
 * (`TRAVELLING_KEYS`, `library/settingsFile.ts`). Lu une fois, à l'amorçage (`main.tsx`), avant que l'application ne
 * soit chargée : changer de langue recharge la page.
 *
 * Ordre : le réglage de l'appareil s'il existe, sinon la langue de l'appareil si l'interface la parle (français,
 * anglais, espagnol), sinon l'anglais.
 */

/** Clé du réglage, propre à l'appareil. */
export const LANGUAGE_STORAGE_KEY = STORAGE_KEYS.langue;

/** Langue d'un appareil dont l'interface ne parle pas la langue. */
const FALLBACK_LANGUAGE: Lang = 'en';

/** Langue de l'interface d'après une étiquette de langue (« fr-FR », « es », « en_GB ») ; `null` pour une autre langue. */
export const langOfTag = (tag: string | undefined): Lang | null => {
  const base = tag?.trim().toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : null;
};

/** Langue au démarrage d'après le réglage lu (`stored`, tel qu'il est rangé) et la langue principale de l'appareil. */
export const resolveLanguage = (stored: unknown, deviceTag: string | undefined): Lang =>
  isLang(stored) ? stored : (langOfTag(deviceTag) ?? FALLBACK_LANGUAGE);

/** Langue principale de l'appareil : celle du navigateur, que la WebView du téléphone reprend du système. */
const deviceLanguageTag = (): string | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator.languages?.[0] ?? navigator.language);

/** Langue de l'interface au démarrage. À lire une fois le stockage chargé (`initStorage`). */
export const startupLanguage = (): Lang => resolveLanguage(jsonStore.read<unknown>(LANGUAGE_STORAGE_KEY), deviceLanguageTag());

/** Écrit le choix de l'appareil ; il ne vaut qu'au prochain démarrage (la page se recharge, `reloadAfterWrites`). */
export const storeLanguage = (lang: Lang): void => {
  jsonStore.write(LANGUAGE_STORAGE_KEY, lang);
};
