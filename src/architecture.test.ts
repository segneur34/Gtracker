import { describe, expect, it } from 'vitest';
import { SPORT_FAMILIES } from './core/sportProfiles';

/**
 * Sens des dépendances entre dossiers de `src/`. Le test lit les
 * `import` et `export … from` de chaque fichier et vérifie qu'ils vont dans le
 * sens permis :
 *
 *   core  →  domaines  →  settings  →  hooks  →  components  →  pages
 *   platform → core seulement ; theme → core seulement
 *
 * Les domaines se lisent du bas vers le haut : sailing et surfing (feuilles),
 * planning, recording, library. Un domaine importe `core/` et les
 * domaines plus bas que lui, jamais l'inverse ; seuls `recording/` et
 * `library/` lisent `platform/` (position, capteurs, dossier mémoire).
 *
 * Les fichiers de test, les fixtures et `src/test/` ne sont pas contrôlés ;
 * les feuilles de style non plus (seuls les modules `.ts` et `.tsx` comptent).
 *
 * `EXCEPTIONS` est une dette nommée : chaque ligne est un import qui va à
 * rebours, avec la raison. La liste ne doit que diminuer ; une ligne qui n'a
 * plus d'objet fait échouer le test, il faut alors la retirer.
 */

interface Fs {
  readdirSync(dir: URL, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const SRC = new URL('./', import.meta.url);

/** Les cinq domaines, du plus bas au plus haut. */
const DOMAINS = ['sailing', 'surfing', 'planning', 'recording', 'library'] as const;

/** Dossiers que chaque dossier a le droit d'importer, en plus de lui-même. */
const ALLOWED: Record<string, readonly string[]> = {
  core: [],
  sailing: ['core'],
  surfing: ['core'],
  planning: ['core'],
  recording: ['core', 'platform', 'sailing', 'surfing', 'planning'],
  library: ['core', 'platform', ...DOMAINS],
  settings: ['core', ...DOMAINS],
  // Programme des tutoriels, calcul pur : le noyau seul ; lu par les hooks, les composants et les pages.
  tutorials: ['core'],
  platform: ['core'],
  theme: ['core'],
  hooks: ['core', 'platform', 'theme', ...DOMAINS, 'settings', 'tutorials'],
  components: ['core', 'platform', 'theme', ...DOMAINS, 'settings', 'tutorials', 'hooks'],
  pages: ['core', 'platform', 'theme', ...DOMAINS, 'settings', 'tutorials', 'hooks', 'components', 'assets'],
};

/** Fichiers à la racine de `src/` (`main.tsx`, `App.tsx`) : ils assemblent tout, sans règle. */
const ROOT = '(racine)';

/** `de → vers` (fichiers sans extension) : imports à rebours, avec leur raison. À ne faire que diminuer. */
const EXCEPTIONS: Record<string, string> = {
  'planning/routeRecord → recording/markGuide': 'réglages de balise rangés avec l\'itinéraire',
  // Le hook de l'axe du temps lit les échelles et le survol des composants de graphe.
  'hooks/useTimeChartAxis → components/chartAxes': 'échelles du graphe',
  'hooks/useTimeChartAxis → components/chartHover': 'survol du graphe',
};

const sourceFiles = (dir: URL, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === 'test' && prefix === '' ? [] : sourceFiles(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`);
    const isSource = /\.(ts|tsx)$/.test(e.name) && !/\.(test|fixture)\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts');
    return isSource ? [`${prefix}${e.name}`] : [];
  });

/** Spécificateurs relatifs d'un fichier : `import … from`, `import '…'`, `export … from`, `import('…')`. */
const specifiersOf = (text: string): string[] => {
  const found: string[] = [];
  const patterns = [
    /^import\s[^'";]*?from\s*['"]([^'"]+)['"]/gm,
    /^import\s*['"]([^'"]+)['"]/gm,
    /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s*from\s*['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) found.push(m[1]);
  return found.filter((s) => s.startsWith('.'));
};

/** Chemin de la cible depuis `src/`, sans extension (`../core/geo` depuis `sailing/wind.ts` → `core/geo`). */
const resolveTarget = (fromFile: string, spec: string): string => {
  const parts = fromFile.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/').replace(/\.(ts|tsx)$/, '');
};

const groupOf = (path: string): string => (path.includes('/') ? path.split('/')[0] : ROOT);

interface Edge {
  from: string;
  to: string;
}

const edges = (): Edge[] =>
  sourceFiles(SRC).flatMap((file) =>
    specifiersOf(fs.readFileSync(new URL(file, SRC), 'utf8'))
      // Une feuille de style ou une image : ni module, ni sens à garder.
      .filter((spec) => !/\.(css|svg|png|jpg|webp|json)$/.test(spec))
      .map((spec) => ({ from: file.replace(/\.(ts|tsx)$/, ''), to: resolveTarget(file, spec) })));

const isForbidden = ({ from, to }: Edge): boolean => {
  const source = groupOf(from);
  const target = groupOf(to);
  if (source === ROOT || target === source) return false;
  const allowed = ALLOWED[source];
  return !allowed || !allowed.includes(target);
};

const edgeName = ({ from, to }: Edge): string => `${from} → ${to}`;

describe("sens des dépendances entre dossiers de src/", () => {
  const all = edges();
  const forbidden = all.filter(isForbidden);

  it('lit bien les imports de src/ (garde-fou du test lui-même)', () => {
    expect(all.length).toBeGreaterThan(1000);
    expect(all.some((e) => e.from === 'sailing/wind' && e.to === 'core/angles')).toBe(true);
    expect(all.some((e) => e.from === 'hooks/useRecorder' && e.to === 'recording/session')).toBe(true);
  });

  it('chaque dossier de src/ a une règle', () => {
    const groups = new Set(sourceFiles(SRC).map(groupOf));
    groups.delete(ROOT);
    // `assets` n'a pas de module ; les autres dossiers ont tous leur ligne dans ALLOWED.
    for (const group of groups) expect(Object.keys(ALLOWED), `dossier « ${group} » sans règle`).toContain(group);
  });

  it('aucun import à rebours hors des exceptions nommées', () => {
    const unexpected = forbidden.map(edgeName).filter((name) => !(name in EXCEPTIONS));
    expect(unexpected).toEqual([]);
  });

  it("chaque exception nommée est encore un import à rebours (la liste ne fait que diminuer)", () => {
    const present = new Set(forbidden.map(edgeName));
    const stale = Object.keys(EXCEPTIONS).filter((name) => !present.has(name));
    expect(stale).toEqual([]);
  });

  it("le noyau, la plateforme et le thème n'importent aucun domaine", () => {
    const bad = all.filter((e) => ['core', 'platform', 'theme'].includes(groupOf(e.from)) && DOMAINS.includes(groupOf(e.to) as never));
    expect(bad.map(edgeName)).toEqual([]);
  });
});

/**
 * Règle 9 de `CLAUDE.md` : chaque famille a sa bibliothèque et son module d'analyse, à une adresse ; il n'y a que deux
 * familles. Un dossier de la terre recréé (`running`, `cycling`, `land`) n'aurait pas de ligne dans `ALLOWED` et ferait
 * déjà échouer « chaque dossier de src/ a une règle » ; son vocabulaire est gardé par le cliquet de `outils/heritage.mjs`.
 */
describe('familles et adresses (règle 9)', () => {
  it('chaque famille a sa bibliothèque et son module', () => {
    const app = fs.readFileSync(new URL('App.tsx', SRC), 'utf8');
    for (const f of SPORT_FAMILIES) {
      expect(app).toContain(`path="/${f}"`);
      expect(app).toContain(`path="/${f}/analyse"`);
    }
    expect([...SPORT_FAMILIES]).toEqual(['voile', 'surf']);
  });

  it("App.tsx n'a plus de route de la course, du vélo ni du fractionné, et mène toute autre adresse à l'accueil", () => {
    const app = withoutComments(fs.readFileSync(new URL('App.tsx', SRC), 'utf8'));
    const paths = [...app.matchAll(/<Route\s[^>]*?path=["{]['"]?([^'"}]+)/g)].map((m) => m[1]);
    expect(paths.filter((p) => /^\/(?:course|velo|fractionne)\b/.test(p))).toEqual([]);
    expect(paths).toContain('*');
  });
});

/**
 * Règle 12 de `CLAUDE.md` : stockage, fichiers, position, son, vibreur, capteurs, ceinture, notification, écran allumé
 * et orientation passent par `src/platform/`. Hors de ce dossier, aucune de ces API du navigateur ni aucun paquet
 * natif (`@capacitor/*`, `@capgo/*`, importé de façon statique ou dynamique, ou en type seul) : chacun a sa version
 * navigateur et téléphone dans `platform/`, choisie par `isNativeApp()`. Les commentaires ne comptent pas.
 */
const PLATFORM_ONLY: readonly [string, RegExp][] = [
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['navigator.geolocation, vibrate, wakeLock, bluetooth ou storage', /\bnavigator\s*\.\s*(?:geolocation|vibrate|wakeLock|bluetooth|storage)\b/],
  ['screen.orientation', /\bscreen\s*\.\s*orientation\b/],
  ['DeviceMotionEvent ou DeviceOrientationEvent', /\bDevice(?:Motion|Orientation)Event\b/],
  ['AudioContext (Web Audio)', /\b(?:webkit)?AudioContext\b/],
  ['showDirectoryPicker', /\bshowDirectoryPicker\b/],
  ['new Notification', /\bnew\s+Notification\b/],
  ['paquet @capacitor ou @capgo', /['"`]@(?:capacitor|capgo)\//],
];

/** Texte d'un fichier sans ses commentaires : lignes de commentaire et de bloc retirées, fin de ligne « // … » coupée. */
const withoutComments = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/\s.*$/, '')))
    .join('\n');

/** Usages d'une API réservée à `platform/` dans les fichiers de `files`, en « fichier:ligne  nom ». */
const platformUses = (files: string[]): string[] =>
  files.flatMap((file) => {
    const lines = withoutComments(fs.readFileSync(new URL(file, SRC), 'utf8')).split('\n');
    return lines.flatMap((line, i) => PLATFORM_ONLY.filter(([, re]) => re.test(line)).map(([name]) => `${file}:${i + 1}  ${name}`));
  });

describe('règle 12 : les API de l’appareil seulement dans platform/', () => {
  const files = sourceFiles(SRC);
  const inPlatform = files.filter((file) => file.startsWith('platform/'));
  const outside = files.filter((file) => !file.startsWith('platform/'));

  it('lit bien platform/ (garde-fou du test lui-même)', () => {
    const uses = platformUses(inPlatform);
    expect(uses.some((u) => u.startsWith('platform/location.ts:') && u.includes('navigator.geolocation'))).toBe(true);
    expect(uses.some((u) => u.startsWith('platform/storage.ts:') && u.endsWith('localStorage'))).toBe(true);
    expect(uses.some((u) => u.includes('@capacitor'))).toBe(true);
    expect(outside.length).toBeGreaterThan(200);
  });

  it('les commentaires ne comptent pas, le code si', () => {
    const probe = '/** localStorage */\n// navigator.vibrate(1)\nconst a = 1; // new Notification\nconst b = window.localStorage;';
    const lines = withoutComments(probe).split('\n');
    expect(lines.map((line) => PLATFORM_ONLY.some(([, re]) => re.test(line)))).toEqual([false, false, false, true]);
    expect(PLATFORM_ONLY.some(([, re]) => re.test("await import('@capgo/background-geolocation')"))).toBe(true);
  });

  it('aucun usage hors de platform/', () => {
    expect(platformUses(outside)).toEqual([]);
  });
});

/** Tous les fichiers de `src/` lus par les gardes qui suivent (tests, fixtures et feuilles de style compris), chemins depuis `src/`. */
const everyFile = (dir: URL = SRC, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return everyFile(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`);
    return /\.(ts|tsx|css)$/.test(e.name) ? [`${prefix}${e.name}`] : [];
  });

/** Lignes d'un fichier qui portent le motif, en « fichier:ligne  texte trouvé » (et la clé « fichier  texte » des exceptions). */
const matchesIn = (files: string[], re: RegExp, code = false): { where: string; key: string }[] =>
  files.flatMap((file) => {
    const raw = fs.readFileSync(new URL(file, SRC), 'utf8');
    const lines = (code ? withoutComments(raw) : raw).split('\n');
    return lines.flatMap((line, i) => [...line.matchAll(new RegExp(re.source, 'g'))].map((m) => ({ where: `${file}:${i + 1}  ${m[0]}`, key: `${file}  ${m[0]}` })));
  });

/**
 * Aucun nom de calcul en dur : seuls ces fichiers nomment un calcul, ils le décrivent (identifiants, profils, couleurs,
 * icônes, noms, lignes du direct, dessins). Ailleurs, un comportement se lit dans les capacités du profil, jamais par
 * `=== 'kite'`. `'surf'` est aussi une famille : sa comparaison n'est pas un nom de calcul. Sans exception aujourd'hui.
 */
const SPORT_TABLES = [
  'core/types.ts', 'core/sportProfiles.ts', 'core/activities.ts', 'core/activityIcons.ts', 'settings/activityPresets.ts',
  'library/naming.ts', 'recording/liveFields.ts', 'components/familyIcons.ts', 'components/activityArt.tsx', 'components/ProfileAvatar.tsx',
];
const SPORT_NAME_EXCEPTIONS: readonly string[] = [];
const SPORT_NAME = /[=!]==\s*'(?:wingfoil|windsurf|kite|bateau)'|'(?:wingfoil|windsurf|kite|bateau)'\s*[,)\]]/;

describe('aucun nom de calcul en dur hors de ses tables (capacités du profil)', () => {
  const files = sourceFiles(SRC);

  it('les tables nommées existent', () => {
    for (const table of SPORT_TABLES) expect(files, table).toContain(table);
  });

  it('le motif attrape une comparaison et une liste de noms, pas une famille', () => {
    expect(SPORT_NAME.test("if (sport === 'kite') return;")).toBe(true);
    expect(SPORT_NAME.test("['wingfoil', 'bateau'].includes(x)")).toBe(true);
    expect(SPORT_NAME.test("if (family === 'surf') return;")).toBe(false);
  });

  it('aucune comparaison à un nom de calcul, hors des tables', () => {
    const found = matchesIn(files.filter((f) => !SPORT_TABLES.includes(f)), SPORT_NAME, true);
    expect(found.filter((m) => !SPORT_NAME_EXCEPTIONS.includes(m.key)).map((m) => m.where)).toEqual([]);
  });
});

/**
 * Aucun renvoi d'atelier dans `src/`, tests compris : un lecteur de `src/` n'a ni le reste à faire, ni l'historique. Refusés :
 * un numéro de lot, une question « Qnn », un « n° N » du reste à faire, une section du journal et son nom. Une règle de
 * `CLAUDE.md` (« règle n°2 ») et une section de `DECISIONS` (« DECISIONS §10 ») restent permises. Les dates ne sont pas gardées
 * (formats et exemples du métier). Les exceptions sont des faux amis, en « fichier  texte trouvé » : la liste ne fait que diminuer.
 */
const WORKSHOP_REFS = /\blots? [0-9]+|\bQ[0-9]{1,3}\b|(?<!règle )n° ?[0-9]+|\bpoints? [0-9]+|(?<!DECISIONS )§ ?10\b|HISTORIQ[U]E/;
const WORKSHOP_EXCEPTIONS: readonly string[] = (
  [
    // L'indice d'un point d'une trace, pas un renvoi : fichier, mot, numéro.
    ['core/kinematics.test.ts', 'point', 10],
    ['core/sessionStats.test.ts', 'point', 65],
    ['core/topSegments.ts', 'points', 1],
    ['sailing/sailingAnalytics.ts', 'points', 0],
    ['test/gpx/corpus.ts', 'points', 0],
  ] as const
).map(([file, word, n]) => `${file}  ${word} ${n}`);

describe("aucun renvoi d'atelier dans src/", () => {
  const found = matchesIn(everyFile(), WORKSHOP_REFS);

  it('le motif attrape les renvois, pas les règles ni les sections de décisions', () => {
    for (const text of ['lot ' + '12', 'lots ' + '12 et 13', 'Q' + '32', 'n° ' + '27', '§' + '10', 'HISTORI' + 'QUE', 'point ' + '104']) expect(WORKSHOP_REFS.test(text), text).toBe(true);
    for (const text of ['règle n°2', 'DECISIONS §10', 'un lot de points', 'le point A']) expect(WORKSHOP_REFS.test(text), text).toBe(false);
  });

  it('aucun renvoi, hors des faux amis nommés', () => {
    expect(found.filter((m) => !WORKSHOP_EXCEPTIONS.includes(m.key)).map((m) => m.where)).toEqual([]);
  });

  it('chaque exception existe encore (la liste ne fait que diminuer)', () => {
    const present = new Set(found.map((m) => m.key));
    expect(WORKSHOP_EXCEPTIONS.filter((key) => !present.has(key))).toEqual([]);
  });
});

/**
 * Règle 13 de `CLAUDE.md`, seconde phrase : aucune donnée d'une autre application n'est relue, sauf par la porte d'import
 * (`library/legacyImport`). Seuls ces fichiers de `src/` l'importent (code, tests compris) : la liste ne fait que diminuer.
 * Le nom de l'ancienne application, lui, est gardé par `heritage.test.ts`.
 */
const IMPORT_DOOR_USERS: readonly string[] = [
  'hooks/sessionLibrary/importer.ts',
  'hooks/sessionLibrary/lifecycle.ts',
  'hooks/useSessionLibrary.perte.test.ts',
  'library/importEntry.ts',
  'library/legacyImport.test.ts',
  'library/sessionBundle.ts',
];

describe("porte d'import de l'ancienne application", () => {
  const users = everyFile()
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => specifiersOf(fs.readFileSync(new URL(file, SRC), 'utf8')).some((spec) => resolveTarget(file, spec) === 'library/legacyImport'));

  it('seuls les fichiers nommés importent library/legacyImport', () => {
    expect(users.filter((file) => !IMPORT_DOOR_USERS.includes(file))).toEqual([]);
  });

  it('chaque fichier nommé l’importe encore (la liste ne fait que diminuer)', () => {
    expect(IMPORT_DOOR_USERS.filter((file) => !users.includes(file))).toEqual([]);
  });
});
