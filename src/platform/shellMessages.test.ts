import { describe, expect, it, vi } from 'vitest';
import { isNativeMessage } from './nativeMessages';
import { shellMessageKeys, shellPhrase } from './shellMessages';

/**
 * Les messages que la coquille du programme Windows rend à la page (`bureau/*.ts`, écrits en français) ont chacun leur
 * phrase dans `shellMessages.ts`, et ses deux traductions dans les dictionnaires. Les sources de la coquille sont
 * relues ici : un message ajouté ou changé là-bas sans sa phrase ici fait échouer le test.
 */

interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
  readdirSync(dir: URL): string[];
}
// Les types de Node ne sont pas ceux de l'app (voir `mainImports.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const BUREAU = new URL('../../bureau/', import.meta.url);

/**
 * Fichiers de la coquille dont les messages ne vont jamais à la page, avec la raison : `fauxTelephone.ts` est le faux
 * téléphone des essais, que l'utilisateur ne voit pas ; `trames.ts` (format des trames), `sonde.ts` (découverte du PC
 * sur le réseau) et `spake2.ts` (calcul de l'échange) ne lèvent que des pannes de programmation, journalisées côté
 * coquille, sans message rendu à la page.
 */
const SANS_MESSAGE_VISIBLE = new Set(['fauxTelephone.ts', 'trames.ts', 'sonde.ts', 'spake2.ts']);

/** Valeur mise à la place de ce qu'une variable (chemin, nombre) portera à l'exécution. */
const SAMPLE = 'x';

interface Found {
  file: string;
  text: string;
}

/** Fin d'une expression `${…}` dont l'accolade ouvrante est en `from - 1` : saute chaînes et gabarits imbriqués. */
const skipExpression = (src: string, from: number): number => {
  let depth = 1;
  let i = from;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === "'" || c === '"') i = readString(src, i, c).end - 1;
    else if (c === '`') i = readTemplate(src, i, {}).end - 1;
    i++;
  }
  return i;
};

const unescape = (raw: string): string => raw.replace(/\\(.)/g, '$1');

const readString = (src: string, at: number, quote: string): { value: string; end: number } => {
  let i = at + 1;
  while (i < src.length && src[i] !== quote) i += src[i] === '\\' ? 2 : 1;
  return { value: unescape(src.slice(at + 1, i)), end: i + 1 };
};

/** Gabarit entre accents graves ; une expression qui est une constante du fichier prend sa valeur, les autres `SAMPLE`. */
const readTemplate = (src: string, at: number, constants: Record<string, string>): { value: string; end: number } => {
  let value = '';
  let i = at + 1;
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') {
      value += src[i + 1];
      i += 2;
    } else if (src[i] === '$' && src[i + 1] === '{') {
      const end = skipExpression(src, i + 2);
      const name = src.slice(i + 2, end - 1).trim();
      value += Object.hasOwn(constants, name) ? constants[name] : SAMPLE;
      i = end;
    } else {
      value += src[i];
      i++;
    }
  }
  return { value, end: i + 1 };
};

/** Texte du littéral qui commence en `at` (chaîne ou gabarit) ; `null` si ce n'en est pas un. */
const readLiteral = (src: string, at: number, constants: Record<string, string>): string | null => {
  const c = src[at];
  if (c === "'" || c === '"') return readString(src, at, c).value;
  if (c === '`') return readTemplate(src, at, constants).value;
  return null;
};

/** Constantes de tête de fichier `const NOM = 'texte'`, que les gabarits citent. */
const constantsOf = (src: string): Record<string, string> => {
  const found: Record<string, string> = {};
  for (const m of src.matchAll(/^(?:export )?const (\w+) = (['"])(.*)\2\s*$/gm)) found[m[1]] = unescape(m[3]);
  return found;
};

/** Constantes de `sansFil.ts` qui disent pourquoi une liaison s'est fermée. */
const RAISONS_DE_COUPURE = ['FERMEE_PAR_LE_TELEPHONE', 'DELAI_DEPASSE', 'TELEPHONE_MUET', 'TELEPHONE_RETIRE', 'SANS_FIL_ETEINT', 'LIAISON_REMPLACEE'];

/** Messages que `src` rend : second argument des erreurs du disque et des réponses en échec, phrases de `erreurDisque`, raisons du pare-feu. */
const messagesOf = (file: string, src: string): Found[] => {
  const constants = constantsOf(src);
  const found: Found[] = [];
  const scan = (pattern: RegExp, make: (literal: string) => string) => {
    for (const m of src.matchAll(pattern)) {
      const literal = readLiteral(src, m.index + m[0].length, constants);
      if (literal !== null) found.push({ file, text: make(literal) });
    }
  };
  // Le message est parfois `autre ?? 'phrase de repli'` : le repli est lu.
  scan(/new ErreurDisque\(\s*(?:'[A-Z_]+'|[\w.]+)\s*,\s*(?:[\w.]+\s*(?:\?\?|\|\|)\s*)?/g, (s) => s);
  scan(/\bechec\(\s*'[A-Z_]+'\s*,\s*/g, (s) => s);
  if (file === 'sansFil.ts') {
    // Pourquoi une liaison s'est coupée (`Liaison avec le téléphone coupée : {raison}`) et phrases d'état de l'écoute.
    scan(/\b(?:fermer|terminer)\(\s*(?:raison = )?(?=['"`])/g, (s) => s);
    scan(/\bthis\.erreur = (?=['"`])/g, (s) => s);
    for (const name of RAISONS_DE_COUPURE) if (Object.hasOwn(constants, name)) found.push({ file, text: constants[name] });
  }
  scan(/\berreurDisque\(\s*\w+\s*,\s*/g, (s) => `${s} : ${SAMPLE}`);
  scan(/\brefus\(\s*(?=['"`])/g, (s) => `Message mal formé : ${s}.`);
  if (file === 'pareFeu.ts') scan(/\bdetail:\s*/g, (s) => s);
  return found;
};

/** Le gabarit de `refus()` dans `memoire.ts` : ses appels, relevés à part, portent le texte réel. */
const WRAPPER = `Message mal formé : ${SAMPLE}.`;

const sources = (): Found[] =>
  fs
    .readdirSync(BUREAU)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !SANS_MESSAGE_VISIBLE.has(name))
    .flatMap((name) => messagesOf(name, fs.readFileSync(new URL(name, BUREAU), 'utf8')))
    .filter(({ text }) => text !== WRAPPER);

/** Table et i18n reprises à neuf dans `lang` : les phrases se traduisent à l'import, la langue étant posée avant. */
const inLanguage = async (dict: Record<string, string>) => {
  vi.resetModules();
  const i18n = await import('../core/i18n');
  i18n.setLanguage('en', dict);
  const shell = await import('./shellMessages');
  const native = await import('./nativeMessages');
  return { shellPhrase: shell.shellPhrase, nativeText: native.nativeText };
};

const dictionary = (lang: 'en' | 'es'): Record<string, string> =>
  JSON.parse(fs.readFileSync(new URL(`../locales/${lang}.json`, import.meta.url), 'utf8')) as Record<string, string>;

describe('messages de la coquille du programme Windows', () => {
  it('relit les sources : assez de messages trouvés pour que le relevé tienne', () => {
    const found = sources();
    expect(found.length).toBeGreaterThan(70);
    expect(new Set(found.map((f) => f.file))).toContain('telephone.ts');
  });

  it('chaque message rendu à la page, ou sa phrase avant le détail, a sa phrase traduite', () => {
    const missing = sources().filter(({ text }) => !isNativeMessage(text));
    expect(missing.map((m) => `${m.file} : ${m.text}`)).toEqual([]);
  });

  it('chaque phrase de la table a ses traductions anglaise et espagnole, non vides', () => {
    const en = dictionary('en');
    const es = dictionary('es');
    const absent = shellMessageKeys().filter((key) => !(en[key]?.trim() && es[key]?.trim()));
    expect(absent).toEqual([]);
  });

  it('en français, la phrase est rendue telle quelle, variables comprises', () => {
    for (const { text } of sources()) {
      const phrase = shellPhrase(text);
      if (phrase !== null) expect(phrase).toBe(text);
    }
  });

  it('dans une autre langue, la phrase traduite reprend ce que les variables portaient', async () => {
    const key = 'Écriture incomplète de « {chemin} » : {octets} octets sur {taille}.';
    const { shellPhrase: phrase } = await inLanguage({ [key]: 'Incomplete write of “{chemin}”: {octets} bytes out of {taille}.' });
    expect(phrase('Écriture incomplète de « sessions/a.gpx » : 12 octets sur 40.')).toBe(
      'Incomplete write of “sessions/a.gpx”: 12 bytes out of 40.',
    );
    expect(phrase('Texte inconnu.')).toBeNull();
  });

  it('une phrase suivie d’un détail du système garde ce détail tel quel', async () => {
    const { nativeText: text } = await inLanguage({
      'Lecture de « {chemin} » impossible': 'Cannot read “{chemin}”',
      '{phrase} : {detail}': '{phrase}: {detail}',
    });
    expect(text('Lecture de « b.gpx » impossible : error: closed')).toBe('Cannot read “b.gpx”: error: closed');
  });

  it('le modèle le plus précis l’emporte : « un dossier » et « pas un dossier » ne se confondent pas', async () => {
    const { shellPhrase: phrase } = await inLanguage({
      'Suppression refusée : « {chemin} » est un dossier.': 'A',
      'Suppression refusée : « {chemin} » n’est pas un dossier.': 'B',
    });
    expect(phrase('Suppression refusée : « d » est un dossier.')).toBe('A');
    expect(phrase('Suppression refusée : « d » n’est pas un dossier.')).toBe('B');
  });

  it('une raison de coupure qui est elle-même une phrase de la table se traduit aussi', async () => {
    const { shellPhrase: phrase } = await inLanguage({
      'Liaison avec le téléphone coupée : {raison}': 'Connection lost: {raison}',
      'délai dépassé.': 'timed out.',
    });
    expect(phrase('Liaison avec le téléphone coupée : délai dépassé.')).toBe('Connection lost: timed out.');
    expect(phrase('Liaison avec le téléphone coupée : read ECONNRESET')).toBe('Connection lost: read ECONNRESET');
  });

  it('l’état du sans-fil rend sa phrase d’erreur, poussée par la coquille, dans la langue de l’interface', async () => {
    vi.resetModules();
    const i18n = await import('../core/i18n');
    i18n.setLanguage('en', { 'Aucun port libre de {debut} à {fin}.': 'No free port from {debut} to {fin}.' });
    const state = { actif: true, ecoute: false, port: null, adresses: [], pareFeu: 'inconnu', erreur: 'Aucun port libre de 7000 à 7009.', appairage: null, relies: [] };
    const nothing = async () => ({ ok: true, valeur: null });
    vi.stubGlobal('window', {
      gtrackerBureau: {
        version: '0.0.0',
        memoire: { ouvrir: async () => null },
        textes: async () => null,
        sansFil: { etat: async () => ({ ok: true, valeur: state }), activer: nothing, ouvrirAppairage: nothing, telephones: nothing, retirer: nothing, surArrivee: () => () => undefined },
      },
    });
    try {
      const { wirelessState } = await import('./wirelessPhone');
      expect((await wirelessState()).erreur).toBe('No free port from 7000 to 7009.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
