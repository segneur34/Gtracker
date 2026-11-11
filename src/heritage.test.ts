import { describe, expect, it } from 'vitest';

/**
 * Garde permanente du nom (lot 322) : plus aucun fichier du dépôt ne dit « tracker » (nom de l'ancienne application),
 * hors la porte d'import et quelques lignes qui attendent le lot 323. Les noms techniques viennent de
 * `core/appIdentity.ts`, les libellés disent « Gtracker ».
 *
 * Lit les fichiers texte de `src/`, `android/app/src/`, `outils/` et `public/`, plus quelques fichiers de la racine,
 * parmi ceux que git suit ou s'apprête à suivre (les dossiers de construction, ignorés, n'en font pas partie). Refuse
 * le mot sous toutes ses casses sauf quand il suit un « g » (Gtracker, gtracker).
 *
 * Le lot 327 y ajoutera les mots de la terre.
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
const FOLDERS = ['src/', 'android/app/src/', 'outils/', 'public/'];
const FILES = ['capacitor.config.ts', 'index.html', 'android/app/build.gradle', 'android/.gitignore'];
const TEXT_EXTENSIONS = /\.(ts|tsx|css|mjs|cjs|js|java|xml|json|md|bat|html|svg|gradle)$/;

/** Le mot interdit : « tracker » sans « g » devant. */
const FORBIDDEN = /(?<![gG])tracker/i;

/** Fichiers qui nomment l'ancienne application par métier : la porte d'import, ses essais, et cette garde elle-même. */
const NAMED_FILES = [
  'src/library/legacyImport.ts',
  'src/library/legacyImport.test.ts',
  'src/test/legacyImport.fixture.ts',
  'src/heritage.test.ts',
];

/** Exceptions temporaires : motifs retirés de chaque ligne avant la recherche, avec le lot qui les retire. */
const TEMPORARY: { lot: number; motif: RegExp; fichier?: string }[] = [
  // Paquet Java et ses citations, identifiant d'application (lot 323).
  { lot: 323, motif: /io\.github\.segneur\.tracker/g },
  { lot: 323, motif: /io\/github\/segneur\/tracker/g },
  // Étiquettes du journal Android (`adb logcat`), lot 323.
  { lot: 323, motif: /Tracker[A-Z]\w+/g },
  // Configuration de signature et sa mention dans `.gitignore`, lot 323.
  { lot: 323, motif: /signingConfigs\.tracker/g },
  { lot: 323, motif: /^\s*tracker \{/g, fichier: 'android/app/build.gradle' },
  { lot: 323, motif: /Clé de signature et mot de passe de Tracker/g, fichier: 'android/.gitignore' },
  // Profil envoyé à BRouter, retiré avec le fichier au lot 304.
  { lot: 304, motif: /# Profil Tracker/g, fichier: 'src/planning/brouterProfile.ts' },
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
    if (FORBIDDEN.test(rest)) found.push(`${file}:${index + 1}: ${line.trim().slice(0, 140)}`);
  });
  return found;
};

describe('garde du nom : plus de « tracker » hors de la porte d\'import', () => {
  const files = trackedFiles();

  it('lit bien les dossiers visés', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const folder of ['src/', 'android/app/src/', 'outils/', 'public/']) expect(files.some((f) => f.startsWith(folder)), folder).toBe(true);
    for (const file of FILES) expect(files, file).toContain(file);
  });

  it('les fichiers nommés existent', () => {
    for (const file of NAMED_FILES) expect(files, file).toContain(file);
  });

  it('aucune ligne ne dit « tracker » (nom de fichier compris), hors exceptions', () => {
    const scanned = files.filter((file) => !NAMED_FILES.includes(file));
    const lines = scanned.flatMap(offendingLines);
    const names = scanned.filter((file) => FORBIDDEN.test(file.replace(/io\/github\/segneur\/tracker\//g, '')));
    expect([...names.map((file) => `nom de fichier : ${file}`), ...lines]).toEqual([]);
  });
});
