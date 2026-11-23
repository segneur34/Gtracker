import { describe, expect, it } from 'vitest';

/**
 * Cliquet des styles en ligne : le nombre de `style={{` par fichier `.tsx` de `src/`
 * ne remonte pas. Un style qui se répète ou qui ne dépend d'aucune valeur calculée va dans une classe
 * (`components/ui/ui.css` pour un utilitaire commun, la feuille de la page sinon) ; seuls restent en ligne ceux qui
 * portent une valeur calculée (couleur d'une activité, largeur en %, rotation d'un chevron).
 *
 * Le relevé est `outils/styles-en-ligne.json`, écrit par `node outils/styles-en-ligne.mjs --figer`. Une baisse ne fait
 * rien échouer ; la figer garde le gain. Une hausse voulue se fige de la même façon, en le disant dans le message du commit.
 */

interface Fs {
  readdirSync(dir: URL, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const SRC = new URL('../', import.meta.url);
const RELEVE = new URL('../../outils/styles-en-ligne.json', import.meta.url);
const COMMANDE = 'node outils/styles-en-ligne.mjs --figer';

/** Nombre de `style={{` par fichier `.tsx` (chemin relatif à `src/`), seuls les fichiers qui en ont. */
function countInlineStyles(dir: URL = SRC, prefix = ''): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      Object.assign(counts, countInlineStyles(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith('.tsx')) {
      const n = (fs.readFileSync(new URL(entry.name, dir), 'utf8').match(/style=\{\{/g) ?? []).length;
      if (n > 0) counts[`src/${prefix}${entry.name}`] = n;
    }
  }
  return counts;
}

describe('styles en ligne', () => {
  const frozen = JSON.parse(fs.readFileSync(RELEVE, 'utf8')) as Record<string, number>;
  const found = countInlineStyles();

  it('aucun fichier ne dépasse son nombre figé', () => {
    const rises = Object.entries(found)
      .filter(([file, n]) => file in frozen && n > frozen[file])
      .map(([file, n]) => `${file} : figé ${frozen[file]}, trouvé ${n}`);
    expect(rises, `Trop de style={{ en ligne : mettez-les en classe CSS, ou lancez \`${COMMANDE}\` si la hausse est voulue.`).toEqual([]);
  });

  it('un fichier absent du relevé n\'a aucun style en ligne', () => {
    const added = Object.entries(found)
      .filter(([file]) => !(file in frozen))
      .map(([file, n]) => `${file} : figé 0, trouvé ${n}`);
    expect(added, `Style en ligne dans un fichier sans relevé : mettez-le en classe CSS, ou lancez \`${COMMANDE}\` si c'est voulu.`).toEqual([]);
  });
});

/**
 * Cliquet des `!important` des feuilles de style : leur nombre par fichier `.css` de `src/` (commentaires exclus) ne
 * remonte pas, et un fichier absent du relevé n'en a aucun. Chacun est une règle qui en force une autre (téléphone
 * contre ordinateur, ou contre un style posé en ligne) : plus il y en a, plus l'ordre des règles devient fragile.
 * Le relevé est `outils/important.json`, à tenir à la main : abaisser un nombre quand un `!important` disparaît.
 */
const RELEVE_IMPORTANT = new URL('../../outils/important.json', import.meta.url);

/** Nombre de `!important` par fichier `.css` (chemin relatif à la racine, avec `src/`), seuls les fichiers qui en ont. */
function countImportant(dir: URL = SRC, prefix = ''): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      Object.assign(counts, countImportant(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith('.css')) {
      const code = fs.readFileSync(new URL(entry.name, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (code.match(/!important/g) ?? []).length;
      if (n > 0) counts[`src/${prefix}${entry.name}`] = n;
    }
  }
  return counts;
}

describe('!important des feuilles de style', () => {
  const frozen = JSON.parse(fs.readFileSync(RELEVE_IMPORTANT, 'utf8')) as Record<string, number>;
  const found = countImportant();

  it('aucune feuille ne dépasse son nombre figé', () => {
    const rises = Object.entries(found)
      .filter(([file, n]) => file in frozen && n > frozen[file])
      .map(([file, n]) => `${file} : figé ${frozen[file]}, trouvé ${n}`);
    expect(rises, 'Trop de !important : règlez la priorité par la précision du sélecteur, ou relevez outils/important.json si la hausse est voulue.').toEqual([]);
  });

  it("une feuille absente du relevé n'a aucun !important", () => {
    const added = Object.entries(found)
      .filter(([file]) => !(file in frozen))
      .map(([file, n]) => `${file} : figé 0, trouvé ${n}`);
    expect(added, "!important dans une feuille sans relevé : règlez la priorité par la précision du sélecteur, ou ajoutez-la à outils/important.json si c'est voulu.").toEqual([]);
  });
});
