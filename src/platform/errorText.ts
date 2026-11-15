import { errorMessage } from '../core/basics';
import { currentLang, t } from '../core/i18n';
import { isNativeMessage, nativePhrase, nativeText } from './nativeMessages';

/**
 * Traducteur des erreurs de la plateforme : codes des greffons
 * (`NOT_AUTHORIZED`, `NOT_FOUND`, `PERMISSION`, `NO_SPACE`, `TOO_LARGE`),
 * `DOMException.name` (`QuotaExceededError`, `NotAllowedError`…) et messages
 * techniques en anglais d'Android ou du navigateur. Jamais de texte brut
 * d'exception à l'écran : une erreur inconnue donne une phrase en clair, le
 * détail va en console. Un message déjà écrit par l'application, dans la langue
 * de l'interface, passe tel quel ; celui d'un greffon, écrit en français côté
 * téléphone, est rendu dans la langue de l'interface (`nativeMessages.ts`).
 *
 * Les mots anglais d'un message ne disent qu'il est technique qu'en français,
 * où aucune phrase de l'application n'en porte, et pour le message d'un
 * greffon, dont le détail vient d'Android. Dans une autre langue, une phrase de
 * l'application en porte : seules jouent alors les marques qu'aucune phrase ne
 * contient (classe Java, chemin, code d'erreur, tournure propre au système).
 */

/** Ce que dit une erreur de fichier, sans la traduire : le code du greffon, ou celle du navigateur. */
export type FileErrorCode = 'NOT_FOUND' | 'PERMISSION' | 'NO_SPACE' | 'TOO_LARGE' | 'UNKNOWN';

const FILE_ERROR_CODES: readonly string[] = ['NOT_FOUND', 'PERMISSION', 'NO_SPACE', 'TOO_LARGE', 'UNKNOWN'];

/** Erreurs du navigateur (poignées de dossier), par leur nom. */
const BROWSER_ERROR_CODES: Readonly<Record<string, FileErrorCode>> = {
  NotFoundError: 'NOT_FOUND',
  TypeMismatchError: 'NOT_FOUND',
  NotAllowedError: 'PERMISSION',
  SecurityError: 'PERMISSION',
  QuotaExceededError: 'NO_SPACE',
};

/**
 * Code d'une erreur levée par un dossier mémoire : `code` posé par le greffon
 * (`rejectCoded`), sinon le nom de l'erreur du navigateur. Seul lecteur de code
 * (ré-exporté par `memoryFolder.ts`).
 */
export const fileErrorCode = (err: unknown): FileErrorCode => {
  if (typeof err !== 'object' || err === null) return 'UNKNOWN';
  const { code, name } = err as { code?: unknown; name?: unknown };
  if (typeof code === 'string' && FILE_ERROR_CODES.includes(code)) return code as FileErrorCode;
  return (typeof name === 'string' && Object.hasOwn(BROWSER_ERROR_CODES, name) ? BROWSER_ERROR_CODES[name] : undefined) ?? 'UNKNOWN';
};

export const DENIED_TEXT = t('Autorisation refusée : Réglages › Autorisations.');
export const LOCATION_DENIED_TEXT = t('Localisation refusée : Réglages › Autorisations.');
const NOT_FOUND_TEXT = t('Fichier ou dossier introuvable.');
const NO_SPACE_TEXT = t('Plus de place sur le téléphone ou dans le navigateur.');
const TOO_LARGE_TEXT = t('Fichier trop volumineux.');
const NETWORK_TEXT = t('Réseau indisponible.');
const TIMEOUT_TEXT = t('Délai dépassé.');
const ABORT_TEXT = t('Opération interrompue.');
export const UNKNOWN_ERROR_TEXT = t("Une erreur est survenue. Réessayez ; si elle revient, redémarrez l'application.");

const BY_FILE_CODE: Partial<Record<FileErrorCode, string>> = {
  PERMISSION: DENIED_TEXT,
  NOT_FOUND: NOT_FOUND_TEXT,
  NO_SPACE: NO_SPACE_TEXT,
  TOO_LARGE: TOO_LARGE_TEXT,
};

/** Autres codes ou noms connus (position, réseau, annulation). */
const BY_OTHER_CODE: Record<string, string> = {
  NOT_AUTHORIZED: DENIED_TEXT,
  AbortError: ABORT_TEXT,
  TimeoutError: TIMEOUT_TEXT,
  NetworkError: NETWORK_TEXT,
};

/**
 * Messages techniques reconnus (Android, navigateur), dans l'ordre d'essai. Le troisième terme dit si le motif vaut
 * dans toutes les langues (code d'erreur, classe Java, tournure propre au système) ; sinon il ne joue que là où les mots
 * anglais disent le technique (`readsEnglishWords`).
 */
const BY_MESSAGE: readonly [RegExp, string, boolean][] = [
  [/missing file for|filenotfoundexception|enoent|no such file/i, NOT_FOUND_TEXT, true],
  [/not found/i, NOT_FOUND_TEXT, false],
  [/enospc|no space left|quota ?exceeded/i, NO_SPACE_TEXT, true],
  [/disk full/i, NO_SPACE_TEXT, false],
  [/eacces|securityexception/i, DENIED_TEXT, true],
  [/permission denied|denied|not authorized/i, DENIED_TEXT, false],
  [/failed to fetch|networkerror|network request failed|unknownhost|unable to resolve host/i, NETWORK_TEXT, true],
  [/load failed/i, NETWORK_TEXT, false],
  [/timed? ?out|timeout/i, TIMEOUT_TEXT, false],
];

/** Marques d'un texte technique dans toutes les langues : classe Java, chemin, code en capitales ou mot seul. */
const TECHNICAL_MARKS = /[A-Za-z]+(Exception|Error)\b|\bjava\.|\bandroid\.|\bat \/|\/storage\/|\bprimary:|^[A-Z][A-Z_]{2,}$/i;

/** Mots anglais d'un texte technique. */
const TECHNICAL_WORDS =
  /\b(failed|denied|cannot|can't|unable|invalid|undefined|null|missing|not found|no such|unexpected|refused|illegal|permission|error|exception|file|read|write|open)\b/i;

/** Vrai quand les mots anglais de `text` disent s'il est technique : en français, ou pour le message d'un greffon. */
const readsEnglishWords = (text: string): boolean => currentLang() === 'fr' || isNativeMessage(text);

/** Vrai quand le texte est technique (anglais d'Android ou du navigateur, classe Java, chemin) et non une phrase de l'application. */
const isTechnical = (text: string): boolean => TECHNICAL_MARKS.test(text) || (readsEnglishWords(text) && TECHNICAL_WORDS.test(text));

/**
 * Début d'un message du type « Lecture impossible : détail technique ». Hors du français, la ponctuation de la langue
 * (« Cannot read: détail ») vaut aussi, quand le message ne porte pas celle d'un greffon.
 */
const headOf = (detail: string): string | undefined => {
  const parts = detail.split(' : ');
  if (parts.length > 1 || currentLang() === 'fr') return parts[0]?.trim();
  return detail.split(': ')[0]?.trim();
};

/**
 * Phrase en clair pour `err`. Ordre : code ou nom connu, message technique
 * reconnu, message de l'application ou d'un greffon (gardé tel quel, celui du
 * greffon dans la langue de l'interface), puis le préfixe d'un message du type
 * « Lecture impossible : détail technique », sinon `fallback`.
 */
export const plainError = (err: unknown, fallback: string = UNKNOWN_ERROR_TEXT): string => {
  const fileCode = fileErrorCode(err);
  const other = typeof err === 'object' && err !== null ? (err as { code?: unknown; name?: unknown }) : {};
  const rawCode = typeof other.code === 'string' ? other.code : typeof other.name === 'string' ? other.name : null;
  const detail = errorMessage(err, '');
  // Un code explicite prime sur le texte.
  const byCode = BY_FILE_CODE[fileCode] ?? (rawCode !== null ? BY_OTHER_CODE[rawCode] : undefined);
  if (byCode) return byCode;
  const englishWords = readsEnglishWords(detail);
  for (const [pattern, text, anyLanguage] of BY_MESSAGE) if ((anyLanguage || englishWords) && pattern.test(detail)) return text;
  if (!detail) return fallback;
  if (!isTechnical(detail)) return nativeText(detail);
  console.warn(`Erreur technique : ${rawCode ? `${rawCode} ` : ''}${detail}`);
  const head = headOf(detail);
  return head && head !== detail && !isTechnical(head) ? `${nativePhrase(head)}.` : fallback;
};
