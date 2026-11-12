import { describe, expect, it } from 'vitest';

/**
 * Onglets, pastilles et bouton glissant prennent l'accent du thème (l'encre),
 * sous un texte `--on-ink` : une couleur de donnée (celle d'une activité) n'y
 * est jamais passée en accent, son texte ne se lirait pas en sombre. Relevé
 * dans le texte des `.tsx` : la valeur de `accent` est une variable du thème,
 * `FAMILY_ACCENT` ou un nom qui en vient, jamais une couleur.
 */

interface Fs {
  readdirSync(dir: URL, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const SRC = new URL('../', import.meta.url);

/** Pièces qui remplissent une surface de leur accent, sous du texte `--on-ink`. */
const FILLED = ['SectionTabs', 'ActivityFilterTabs', 'SegmentedControl', 'Chips'];

/** Valeurs admises : une variable du thème, `FAMILY_ACCENT`, ou les noms locaux qui en viennent. */
const ALLOWED = /^(?:FAMILY_ACCENT(?:\.\w+|\[[^\]]+\])|ACCENT|accent|tabAccent|tabs\.accent|'var\(--[\w-]+\)'|"var\(--[\w-]+\)")$/;

function tsxFiles(dir: URL = SRC, prefix = ''): { path: string; text: string }[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return tsxFiles(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
    if (!entry.name.endsWith('.tsx')) return [];
    return [{ path: `src/${prefix}${entry.name}`, text: fs.readFileSync(new URL(entry.name, dir), 'utf8') }];
  });
}

describe('accents des onglets, pastilles et bouton glissant', () => {
  it('aucune couleur de donnée passée en accent', () => {
    const faults: string[] = [];
    for (const { path, text } of tsxFiles()) {
      for (const match of text.matchAll(/\baccent=(?:\{([^}]*)\}|("[^"]*"))/g)) {
        // Balise ouvrante la plus proche, type générique compris (`<SegmentedControl<'a' | 'b'>`).
        const tag = /<([A-Z]\w*)(?:<[^>]*>)?[^<]*$/.exec(text.slice(0, match.index))?.[1];
        if (!tag || !FILLED.includes(tag)) continue;
        const value = (match[1] ?? match[2]).trim();
        if (!ALLOWED.test(value)) faults.push(`${path} : <${tag} accent=${value}>`);
      }
    }
    expect(faults).toEqual([]);
  });
});
