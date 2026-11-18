import { describe, expect, it } from 'vitest';

/**
 * Garde permanente du nom : plus aucun fichier du dépôt ne dit « tracker » (nom de l'ancienne application),
 * hors la porte d'import et ses essais (`NAMED_FILES`). Les noms techniques viennent de
 * `core/appIdentity.ts`, les libellés disent « Gtracker ».
 *
 * Lit les fichiers texte de `src/`, `android/app/src/`, `outils/`, `public/` et `bureau/` (sans ses dépendances ni ses
 * sorties), plus quelques fichiers de la racine,
 * parmi ceux que git suit ou s'apprête à suivre (les dossiers de construction, ignorés, n'en font pas partie). Refuse
 * le mot sous toutes ses casses sauf quand il suit un « g » (Gtracker, gtracker), et l'expression « application
 * complète ». Les fichiers de `src/` qui importent la porte d'import sont gardés par `architecture.test.ts`.
 */

interface ChildProcess {
  execFileSync(command: string, args: string[], options: { cwd: URL; encoding: 'utf8'; maxBuffer: number }): string;
}
interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
const childProcess = (await import(/* @vite-ignore */ 'node:child_process' as string)) as ChildProcess;

const ROOT = new URL('../', import.meta.url);

/** Dossiers lus en entier, et fichiers isolés. */
const FOLDERS = ['src/', 'android/app/src/', 'outils/', 'public/', 'bureau/'];
/** Sous-dossiers jamais lus : dépendances, compilation et programme fabriqué du programme Windows. */
const SKIPPED_FOLDERS = ['bureau/node_modules/', 'bureau/dist/', 'bureau/sortie/'];
const FILES = ['capacitor.config.ts', 'index.html', 'android/app/build.gradle', 'android/.gitignore'];
const TEXT_EXTENSIONS = /\.(ts|tsx|css|mjs|cjs|js|java|xml|json|md|bat|html|svg|gradle)$/;

/** Le mot interdit : « tracker » sans « g » devant, et l'expression qui désignait l'ancienne application. */
const FORBIDDEN = /(?<![gG])tracker|application complète/i;

/** Fichiers qui nomment l'ancienne application par métier : la porte d'import, ses essais, et cette garde elle-même. */
const NAMED_FILES = [
  'src/library/legacyImport.ts',
  'src/library/legacyImport.test.ts',
  'src/test/legacyImport.fixture.ts',
  'src/heritage.test.ts',
];

/** Exceptions temporaires : motifs retirés de chaque ligne avant la recherche, avec le lot qui les retire. */
const TEMPORARY: { lot: number; motif: RegExp; fichier?: string }[] = [];

/**
 * Le nom montré sur la photo du Profil : le logo GONG, et dessous le nom de l'application sans son G, choix de
 * l'utilisateur. Seules ces deux lignes le portent : celle qui l'affiche et celle du banc qui le relit.
 */
const SHOWN_NAME: { fichier: string; motif: RegExp }[] = [
  { fichier: 'src/pages/ProfilePage.tsx', motif: /<span className="profile-hero__name">tracker<\/span>/ },
  { fichier: 'outils/banc/profil.mjs', motif: /=== 'tracker'/ },
];

const trackedFiles = (): string[] => {
  const listed = childProcess.execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return listed
    .split('\0')
    .filter((file) => file !== '')
    .filter((file) => !SKIPPED_FOLDERS.some((folder) => file.startsWith(folder)))
    .filter((file) => FILES.includes(file) || (FOLDERS.some((folder) => file.startsWith(folder)) && TEXT_EXTENSIONS.test(file)));
};

/** Lignes d'un fichier qui portent le mot, une fois les exceptions temporaires retirées. */
const offendingLines = (file: string): string[] => {
  let text: string;
  try {
    text = fs.readFileSync(new URL(file, ROOT), 'utf8');
  } catch {
    return []; // listé par git mais supprimé du disque, pas encore retiré de l'index
  }
  const found: string[] = [];
  text.split('\n').forEach((line, index) => {
    let rest = line;
    for (const exception of TEMPORARY) if (exception.fichier === undefined || exception.fichier === file) rest = rest.replace(exception.motif, '');
    for (const shown of SHOWN_NAME) if (shown.fichier === file) rest = rest.replace(shown.motif, '');
    if (FORBIDDEN.test(rest)) found.push(`${file}:${index + 1}: ${line.trim().slice(0, 140)}`);
  });
  return found;
};

describe('garde du nom : plus de « tracker » hors de la porte d\'import', () => {
  const files = trackedFiles();

  it('lit bien les dossiers visés', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const folder of FOLDERS) expect(files.some((f) => f.startsWith(folder)), folder).toBe(true);
    expect(files.filter((f) => SKIPPED_FOLDERS.some((folder) => f.startsWith(folder)))).toEqual([]);
    for (const file of FILES) expect(files, file).toContain(file);
  });

  it('les fichiers nommés existent', () => {
    for (const file of NAMED_FILES) expect(files, file).toContain(file);
  });

  it('aucune ligne ne dit « tracker » ni « application complète » (nom de fichier compris), hors exceptions', () => {
    const scanned = files.filter((file) => !NAMED_FILES.includes(file));
    const lines = scanned.flatMap(offendingLines);
    const names = scanned.filter((file) => FORBIDDEN.test(file));
    expect([...names.map((file) => `nom de fichier : ${file}`), ...lines]).toEqual([]);
  });
});
