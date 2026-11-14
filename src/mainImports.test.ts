import { describe, expect, it } from 'vitest';

/**
 * L'amorçage (`main.tsx`) pose la langue avant que l'application ne soit importée (`boot.tsx`) : une table de module
 * qui porte un texte (`label: t('général')`) n'est juste que si elle est lue après. `main.tsx` ne doit donc importer,
 * même de loin, aucun module qui porte un texte à traduire. Ce test fige la liste de ses imports, directs et
 * indirects (l'import dynamique de `boot.tsx` mis à part) : un ajout se relit avant d'entrer dans la liste.
 */

interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
  existsSync(file: URL): boolean;
}
// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const SRC = new URL('./', import.meta.url);

/** Imports statiques relatifs d'un fichier : `import … from '…'`, `import '…'`, `export … from '…'` (pas `import()`). */
const staticSpecifiers = (text: string): string[] => {
  const found: string[] = [];
  const patterns = [
    /^import\s[^'";]*?from\s*['"]([^'"]+)['"]/gm,
    /^import\s*['"]([^'"]+)['"]/gm,
    /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s*from\s*['"]([^'"]+)['"]/gm,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) found.push(m[1]);
  return found.filter((s) => s.startsWith('.'));
};

/** Chemin depuis `src/` d'un spécificateur relatif, avec l'extension du fichier trouvé. */
const resolve = (fromFile: string, spec: string): string => {
  const parts = fromFile.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  const base = parts.join('/');
  if (/\.(css|json|svg|png)$/.test(base)) return base;
  const found = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((path) => fs.existsSync(new URL(path, SRC)));
  if (!found) throw new Error(`import introuvable : ${spec} depuis ${fromFile}`);
  return found;
};

/** Tous les fichiers que `start` importe, directement ou non, triés. */
const closureOf = (start: string): string[] => {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const spec of staticSpecifiers(fs.readFileSync(new URL(file, SRC), 'utf8'))) {
      const target = resolve(file, spec);
      if (seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen].sort();
};

describe('amorçage : main.tsx ne charge aucun texte avant la langue', () => {
  it('imports de main.tsx, directs et indirects, figés', () => {
    expect(closureOf('main.tsx')).toEqual([
      'components/AppShell.css',
      'components/ui/ui.css',
      'core/appIdentity.ts',
      'core/i18n.ts',
      'hooks/themePaint.ts',
      'platform/darkScheme.ts',
      'platform/language.ts',
      'platform/runtime.ts',
      'platform/storage.ts',
      'platform/systemBars.ts',
      'theme/base.css',
      'theme/themeSettings.ts',
      'theme/tokens.css',
    ]);
  });

  it("l'application se charge après, par un import dynamique", () => {
    const main = fs.readFileSync(new URL('main.tsx', SRC), 'utf8');
    expect(main).toMatch(/await import\('\.\/boot'\)/);
    expect(fs.existsSync(new URL('boot.tsx', SRC))).toBe(true);
  });
});
