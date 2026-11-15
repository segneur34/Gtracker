import { describe, expect, it } from 'vitest';
import { CONTEXT_MARK } from './core/i18n';

/**
 * Garde des traductions (`outils/i18n.mjs`) : chaque clé de `t(`, `tn(` et `tRich(` est un littéral, et les
 * dictionnaires anglais et espagnol n'ont ni traduction orpheline, ni variable ou balise fausse, ni mot refusé par la
 * garde du nom. Les clés sans traduction ne font échouer qu'une fois le chantier déclaré clos (`TRADUCTION_CLOSE`).
 */

interface Jeton {
  type: string;
  valeur: string | null;
}
interface Fiche {
  noms: Set<string>;
  ou: string[];
}
interface Controle {
  traduites: string[];
  manquantes: string[];
  orphelines: string[];
  variables: string[];
  interdits: string[];
  forme: string[];
}
interface Outil {
  TRADUCTION_CLOSE: boolean;
  MARQUE_CONTEXTE: string;
  LANGUES: string[];
  MOT_INTERDIT: RegExp;
  lireJetons(texte: string, jsx: boolean): Jeton[];
  extraireCles(texte: string, jsx: boolean): { cles: { cle: string; nom: string; ligne: number }[]; refus: { ligne: number; raison: string }[] };
  fichiersSources(): string[];
  controlerDictionnaire(cles: Map<string, Pick<Fiche, 'noms'>>, dico: unknown): Controle;
  bilan(): { cles: Map<string, Fiche>; refus: string[]; langues: Record<string, Controle>; erreurs: string[] };
}
interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
const outil = (await import(/* @vite-ignore */ new URL('../outils/i18n.mjs', import.meta.url).href as string)) as Outil;

const cles = (texte: string, jsx = true) => outil.extraireCles(texte, jsx).cles.map((c) => c.cle);
const refus = (texte: string, jsx = true) => outil.extraireCles(texte, jsx).refus.map((r) => r.raison);
const fiches = (...noms: [string, string][]) => new Map(noms.map(([cle, nom]) => [cle, { noms: new Set([nom]) }] as const));

describe('garde des traductions : lecture des clés', () => {
  it('la marque du contexte est celle du module de la langue', () => {
    expect(outil.MARQUE_CONTEXTE).toBe(CONTEXT_MARK);
  });

  it('trois fonctions, trois formes de chaînes, contexte littéral', () => {
    const source = [
      "const a = t('Enregistrer la session');",
      'const b = t("L\'activité", { n: 2 });',
      'const c = t(`Sans ${"variable"}`.length ? `Gabarit` : "x");',
      "const d = tn(n, '{n} session', '{n} sessions', { n: x }, n !== 1);",
      "const e = tRich('Texte <b>{x}</b>', { x, ctx: 'aide' });",
      "const f = t('vol', { ctx: 'foil' });",
    ].join('\n');
    expect(cles(source)).toEqual(['Enregistrer la session', "L'activité", '{n} session', '{n} sessions', 'Texte <b>{x}</b>' + CONTEXT_MARK + 'aide', 'vol' + CONTEXT_MARK + 'foil']);
    expect(refus(source)).toEqual(['t( : premier argument non littéral']);
  });

  it('tnRich : les deux phrases (arguments 2 et 3), contexte lu à l’argument 4, balises dans la clé', () => {
    const source = [
      "const a = tnRich(n, '<b>{n}</b> point', '<b>{n}</b> points', { nom }, {}, true);",
      "const b = tnRich(n, 'un <i>vol</i>', '{n} <i>vols</i>', { ctx: 'foil' });",
    ].join('\n');
    expect(cles(source)).toEqual(['<b>{n}</b> point', '<b>{n}</b> points', 'un <i>vol</i>' + CONTEXT_MARK + 'foil', '{n} <i>vols</i>' + CONTEXT_MARK + 'foil']);
    expect(refus(source)).toEqual([]);
    expect(outil.extraireCles(source, true).cles.map((c) => c.nom)).toEqual(['tnRich', 'tnRich', 'tnRich', 'tnRich']);
  });

  it('tnRich : refuse une phrase non littérale et un contexte non littéral', () => {
    expect(refus("tnRich(n, un, 'b'); tnRich(n, 'a', 'b', { ctx }); tnRich(n, 'a', `b${x}`);")).toEqual([
      'tnRich( : phrase non littéral',
      'tnRich( : contexte non littéral',
      'tnRich( : phrase non littéral',
    ]);
  });

  it('refuse une clé variable, concaténée ou à gabarit, et un contexte non littéral', () => {
    expect(refus("t(label); t('a' + b); t(`x${y}`); tn(n, one, 'b'); t('x', { ctx }); t('y', { ctx: c }); t();")).toEqual([
      't( : premier argument non littéral',
      't( : premier argument non littéral',
      't( : premier argument non littéral',
      'tn( : phrase non littéral',
      't( : contexte non littéral',
      't( : contexte non littéral',
      't( : premier argument non littéral',
    ]);
  });

  it('ignore méthodes, déclarations, commentaires, chaînes et expressions régulières', () => {
    const source = [
      "// t('dans un commentaire')",
      "/* tn(1, 'a', 'b') */",
      "const s = \"t('dans une chaîne')\";",
      "const r = /t\\('x'\\)/g; const q = a / t('divisé');",
      "obj.t('méthode'); function t(key: string) { return key; }",
      "const m = `${t('dans un gabarit')}`;",
    ].join('\n');
    expect(cles(source, false)).toEqual(['divisé', 'dans un gabarit']);
    expect(refus(source, false)).toEqual([]);
  });

  it('une division après une valeur terminée par ! ou ++ ne passe pas pour une expression régulière', () => {
    const source = [
      "const a = x! / 1000; const b = t('Après le point d’exclamation'); const c = y / 2;",
      "const d = i++ / 2; const e = t('Après le plus plus'); const f = j-- / 2;",
      "const g = !/t\\('x'\\)/.test(s) && t('Après la négation');",
    ].join('\n');
    expect(cles(source, false)).toEqual(['Après le point d’exclamation', 'Après le plus plus', 'Après la négation']);
    expect(refus(source, false)).toEqual([]);
  });

  it('JSX : apostrophes du texte, commentaires et génériques ne dérèglent pas la lecture', () => {
    const source = [
      "const A = <F,>(x: F) => x;",
      "const B = () => (",
      "  <div title={t('Titre')} data-x=\"l'attribut\"",
      "    // commentaire d'attribut",
      "    className='c'>",
      "    L'activité n'est pas là {t('Dedans')} <Liste<'a' | 'b'> value={t(\"Valeur\")} />",
      "    {/* t('commenté') */}",
      "    <>Aujourd'hui {cond ? <b>{t('Gras')}</b> : null}</>",
      "  </div>",
      ");",
      "const C = x < y ? t('Après') : 0;",
    ].join('\n');
    expect(cles(source)).toEqual(['Titre', 'Dedans', 'Valeur', 'Gras', 'Après']);
    expect(refus(source)).toEqual([]);
  });
});

describe('garde des traductions : dictionnaires', () => {
  it('orpheline, variable ou balise fausse, mot interdit, manquante', () => {
    const code = fiches(
      ['{n} session', 'tn'],
      ['une session', 'tn'],
      ['Texte <b>{x}</b>', 'tRich'],
      ['Bonjour {nom}', 't'],
      ['Manquante', 't'],
      ['un <b>vol</b>', 'tnRich'],
      ['<b>{n}</b> vols', 'tnRich'],
      ['un <i>saut</i>', 'tnRich']
    );
    const r = outil.controlerDictionnaire(code, {
      '{n} session': '{n} session',
      'une session': '{n} session',
      'Texte <b>{x}</b>': 'Text {x}',
      'Bonjour {nom}': 'Hello {name}',
      Orpheline: 'Orphan',
      'un <b>vol</b>': '<b>{n}</b> flight',
      '<b>{n}</b> vols': '<b>{n}</b> flights',
      'un <i>saut</i>': 'a jump',
    });
    expect(r.orphelines).toEqual(['Orpheline']);
    // `{n}` est permis dans la traduction d'une phrase de `tnRich` comme de `tn` ; la balise de `saut` manque.
    expect(r.variables.map((v) => v.split(' : ')[0])).toEqual(['Texte <b>{x}</b>', 'Bonjour {nom}', 'un <i>saut</i>']);
    expect(r.manquantes).toEqual(['Manquante']);
    expect(r.traduites).toEqual(['{n} session', 'une session', 'Texte <b>{x}</b>', 'Bonjour {nom}', 'un <b>vol</b>', '<b>{n}</b> vols', 'un <i>saut</i>']);
    const mot = 'GPS ' + 'track' + 'er';
    expect(outil.controlerDictionnaire(fiches(['Traceur', 't']), { Traceur: mot }).interdits).toEqual([`Traceur : ${mot}`]);
    expect(outil.controlerDictionnaire(fiches(), []).forme.length).toBe(1);
  });
});

describe('garde des traductions : le code et les dictionnaires du dépôt', () => {
  const resultat = outil.bilan();

  it('lit bien src/ (garde-fou du test lui-même) : la lecture suit le code, appel par appel', () => {
    const fichiers = outil.fichiersSources();
    expect(fichiers.length).toBeGreaterThan(300);
    expect(fichiers).toContain('src/core/units.ts');
    expect(fichiers).not.toContain('src/core/i18n.ts');
    // Un lecteur déréglé (chaîne, gabarit ou JSX mal fermé) perdrait des appels : on les compte des deux façons.
    const ecarts = fichiers.flatMap((f) => {
      const texte = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      const jetons = outil.lireJetons(texte, f.endsWith('.tsx'));
      const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      return ['useState', 'formatDecimal', 'useMemo'].flatMap((nom) => {
        const parJetons = jetons.filter((j, k) => j.type === 'id' && j.valeur === nom && jetons[k + 1]?.valeur === '(').length;
        const parTexte = [...sansCommentaires.matchAll(new RegExp(`(?<![\\w.$])${nom}\\(`, 'g'))].length;
        return parJetons === parTexte ? [] : [`${f} ${nom} : ${parJetons} lus, ${parTexte} écrits`];
      });
    });
    expect(ecarts).toEqual([]);
  });

  it('aucune clé refusée (littéral, contexte), aucun fichier illisible', () => {
    expect(resultat.refus).toEqual([]);
  });

  for (const langue of outil.LANGUES) {
    it(`${langue} : ni traduction orpheline, ni variable ou balise fausse, ni mot interdit`, () => {
      const r = resultat.langues[langue];
      expect([...r.forme, ...r.orphelines, ...r.variables, ...r.interdits]).toEqual([]);
    });

    it(`${langue} : toutes les clés traduites une fois le chantier clos`, () => {
      if (outil.TRADUCTION_CLOSE) expect(resultat.langues[langue].manquantes).toEqual([]);
      expect(resultat.erreurs).toEqual([]);
    });
  }
});
