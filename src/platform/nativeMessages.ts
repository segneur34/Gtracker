import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';

/**
 * Messages de refus des greffons Android (`call.reject` des classes Java) : écrits en français côté téléphone, quelle
 * que soit la langue de l'interface, ils reviennent à la page comme message d'erreur. Rendus ici dans la langue de
 * l'interface, par une table indexée par le texte reçu, au caractère près ; le Java ne change pas. Seuls ceux qui
 * peuvent arriver à l'écran y figurent : une phrase changée côté Java se change ici aussi.
 *
 * Le dossier mémoire rejette « phrase : détail d'Android » (`rejectCoded`) : la phrase se traduit, le détail reste tel
 * quel (`plainError` le remplace par la phrase seule quand il est technique).
 */

/** Séparateur entre la phrase d'un greffon et le détail d'Android. */
const DETAIL_SEPARATOR = ' : ';

const NATIVE_MESSAGES: Readonly<Record<string, string>> = {
  // Dossier mémoire, phrases suivies du détail d'Android.
  "Android a refusé de garder l'accès au dossier": t("Android a refusé de garder l'accès au dossier"),
  'Lecture du dossier impossible': t('Lecture du dossier impossible'),
  'Lecture impossible': t('Lecture impossible'),
  'Lecture du fichier impossible': t('Lecture du fichier impossible'),
  'Données illisibles': t('Données illisibles'),
  'Écriture impossible': t('Écriture impossible'),
  'Suppression impossible': t('Suppression impossible'),
  'Adresse du dossier manquante.': t('Adresse du dossier manquante.'),
  // Téléchargements et partage.
  'Nom ou contenu manquant.': t('Nom ou contenu manquant.'),
  'Le téléchargement demande Android 10 ou plus récent.': t('Le téléchargement demande Android 10 ou plus récent.'),
  'Écriture impossible.': t('Écriture impossible.'),
  'Partage impossible.': t('Partage impossible.'),
  // Ceinture cardio.
  'permission Bluetooth refusée': t('permission Bluetooth refusée'),
  'Bluetooth éteint': t('Bluetooth éteint'),
  'recherche Bluetooth impossible': t('recherche Bluetooth impossible'),
  'recherche impossible': t('recherche impossible'),
  'adresse de ceinture invalide': t('adresse de ceinture invalide'),
  // Capteurs de mouvement.
  'instant de départ manquant': t('instant de départ manquant'),
  "ce téléphone n'a pas d'accéléromètre ou de gyroscope": t("ce téléphone n'a pas d'accéléromètre ou de gyroscope"),
  'fichier de mesures illisible, la mesure ne reprend pas': t('fichier de mesures illisible, la mesure ne reprend pas'),
  'fichier de mesures impossible à créer': t('fichier de mesures impossible à créer'),
  // Fichiers reçus d'une autre application.
  'Fichier reçu illisible': t('Fichier reçu illisible'),
};

const isNativePhrase = (text: string): boolean => Object.hasOwn(NATIVE_MESSAGES, text);

/** Phrase avant le détail d'Android ; le texte entier s'il n'en porte pas. */
const phraseOf = (text: string): string => {
  const at = text.indexOf(DETAIL_SEPARATOR);
  return at < 0 ? text : text.slice(0, at);
};

/** Vrai pour un message d'un greffon : sa phrase seule, ou sa phrase suivie du détail d'Android. */
export const isNativeMessage = (text: string): boolean => isNativePhrase(text) || isNativePhrase(phraseOf(text));

/** Phrase d'un greffon dans la langue de l'interface ; tout autre texte, tel quel. */
export const nativePhrase = (text: string): string => (isNativePhrase(text) ? NATIVE_MESSAGES[text] : text);

/** Message d'un greffon dans la langue de l'interface, le détail d'Android gardé tel quel ; tout autre texte, tel quel. */
export const nativeText = (text: string): string => {
  if (isNativePhrase(text)) return NATIVE_MESSAGES[text];
  const phrase = phraseOf(text);
  if (phrase === text || !isNativePhrase(phrase)) return text;
  return t('{phrase} : {detail}', { phrase: NATIVE_MESSAGES[phrase], detail: text.slice(phrase.length + DETAIL_SEPARATOR.length) });
};

/** Message d'une erreur attrapée (`errorMessage`), celui d'un greffon rendu dans la langue de l'interface. */
export const nativeErrorMessage = (err: unknown, fallback?: string): string => nativeText(errorMessage(err, fallback));
