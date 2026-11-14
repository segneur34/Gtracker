/**
 * Langue de l'interface : le texte français est la clé, les dictionnaires anglais et espagnol en donnent la
 * traduction ; un texte sans traduction retombe sur le français. Pur et sans import : lu partout, calculs compris.
 *
 * Emploi :
 *   t('Enregistrer la session')                         texte entier, toujours un littéral (jamais `t(variable)`)
 *   t('{n} sessions ajoutées', { n: formatDecimal(x) })  variables `{nom}`, un nombre passé déjà formaté
 *   t('vol', { ctx: 'foil' })                           contexte quand un même mot français a deux traductions
 *   tn(n, '{n} session', '{n} sessions')                deux phrases entières ; `{n}` vaut `n` sauf s'il est donné
 *   tn(n, '1 fichier lu', '{n} fichiers lus', {}, n !== 1)   règle française du site quand elle n'est pas `n > 1`
 *   tRich (components/tRich.ts) pour une phrase qui porte des balises (<b>, <em>).
 *
 * La langue est posée une fois, à l'amorçage, avant que l'application ne soit importée : une table de module
 * (`label: t('général')`) est donc juste. Sans amorçage (tests, banc) : français, et `t` rend sa clé telle quelle.
 * Une donnée enregistrée se traduit à l'affichage, jamais à l'écriture. Formats : `decimalSeparator()`, `dateLocale()`.
 */

/** Langues de l'interface. */
export type Lang = 'fr' | 'en' | 'es';

/** Les langues, dans l'ordre où le réglage les propose. */
export const LANGUAGES: readonly Lang[] = ['fr', 'en', 'es'];

/** Nom de chaque langue dans sa propre langue : jamais traduit. */
export const LANGUAGE_NAME: Readonly<Record<Lang, string>> = { fr: 'Français', en: 'English', es: 'Español' };

/** Dictionnaire d'une langue : texte français (avec son contexte, voir `CONTEXT_MARK`) → traduction. */
export type Dictionary = Readonly<Record<string, string>>;

/**
 * Marque entre le texte français et son contexte dans une entrée de dictionnaire : `t('vol', { ctx: 'foil' })` se
 * cherche sous « vol||foil ». L'outil de garde des traductions (`outils/i18n.mjs`) la connaît.
 */
export const CONTEXT_MARK = '||';

/** Variables d'un texte : `{nom}` est remplacé par `nom` ; `ctx` choisit l'entrée du dictionnaire, jamais remplacé. */
export type TVars = { readonly ctx?: string } & { readonly [name: string]: string | number | undefined };

let lang: Lang = 'fr';
let dictionary: Dictionary = {};

/** Vrai pour un identifiant de langue connu. */
export const isLang = (value: unknown): value is Lang => typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Pose la langue et son dictionnaire (ignoré en français). À l'amorçage seulement : l'interface lue avant ne changerait pas. */
export const setLanguage = (next: Lang, dict: Dictionary = {}): void => {
  lang = next;
  dictionary = next === 'fr' ? {} : dict;
};

/** Langue de l'interface ; français sans amorçage. */
export const currentLang = (): Lang => lang;

/** Traduction brute d'une clé : l'entrée du contexte, sinon celle de la clé seule, sinon la clé. */
const lookup = (key: string, ctx: string | undefined): string => {
  if (ctx !== undefined) {
    const withContext = dictionary[key + CONTEXT_MARK + ctx];
    if (withContext !== undefined) return withContext;
  }
  return dictionary[key] ?? key;
};

/** Remplace chaque `{nom}` dont la variable est donnée ; une accolade sans variable reste telle quelle. */
const fill = (text: string, vars: TVars | undefined): string => {
  if (vars === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (name === 'ctx') return whole;
    const value = vars[name];
    return value === undefined ? whole : String(value);
  });
};

/** Texte de l'interface dans la langue choisie. En français, sans variable, rend exactement `key`. */
export const t = (key: string, vars?: TVars): string => fill(lookup(key, vars?.ctx), vars);

/**
 * Texte accordé au nombre `n`, en deux phrases entières (chacune une clé). En français, pluriel selon `frenchPlural`
 * (par défaut `n > 1`, la règle de `plural()`) ; en anglais et en espagnol, pluriel si `n !== 1`. `{n}` vaut `n`, sauf
 * si `vars.n` est donné (nombre déjà formaté).
 */
export const tn = (n: number, singular: string, pluralText: string, vars?: TVars, frenchPlural: boolean = n > 1): string => {
  const isPlural = lang === 'fr' ? frenchPlural : n !== 1;
  return t(isPlural ? pluralText : singular, { n, ...vars });
};

/** Séparateur décimal de l'affichage : point en anglais, virgule en français et en espagnol. */
export const decimalSeparator = (): string => (lang === 'en' ? '.' : ',');

/** Locale des dates et des nombres écrits par `Intl` et `toLocale*` (« fr-FR », « en-GB », « es-ES »). */
export const dateLocale = (): string => (lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'fr-FR');
