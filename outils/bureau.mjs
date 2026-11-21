// Programme Windows de Gtracker (coquille Electron du dossier `bureau/`).
//
//   node outils/bureau.mjs           compile l'application et la coquille, puis lance la coquille sur `dist/` pour essayer
//   node outils/bureau.mjs --exe     compile, puis fabrique le dossier du programme : bureau/sortie/Gtracker-win32-x64/
//   node outils/bureau.mjs --installeur   (npm run installeur) compile, emballe avec l'APK de la même version, puis
//                                    fabrique l'installeur : bureau/sortie/Gtracker-Setup-<version>.exe
//
// Options :
//   --sans-vite      ne refait pas `dist/` (déjà construit)
//   --compiler       compile seulement, sans lancer ni emballer (pour un lanceur, le banc par exemple)
//   --sans-apk       avec --installeur, pour les essais seulement : installeur sans l'application du téléphone
//   -- <arguments>   passés tels quels à la coquille lancée pour essayer (après `--`)
//
// L'essai tourne sur le profil `bureau/sortie/profil-essai/` (jamais la mémoire du programme installé), sauf si
// `GTRACKER_PROFIL` est donné. Les autres variables de la coquille (`GTRACKER_BANC`…) passent telles quelles.
//
// Installeur : NSIS par electron-builder, sur le dossier emballé (`--prepackaged`), en un clic, par utilisateur
// (`%LOCALAPPDATA%\Programs\Gtracker`, sans droits d'administrateur), raccourcis « Gtracker » sur le Bureau et dans le
// menu Démarrer ; la désinstallation garde le profil (`%APPDATA%\Gtracker`), et le dossier mémoire n'est jamais connu
// de l'installeur. Une version plus récente s'installe par-dessus. Tout se fabrique dans `bureau/sortie/installeur/`
// (coquille compilée à part : `bureau/dist` de l'essai n'est pas touché), puis l'installeur est rangé dans
// `bureau/sortie/`. L'APK est celle de Gradle en version de publication (`cheminApk`), jamais une APK de débogage ;
// absente ou d'une autre version, la construction s'arrête et dit comment la fabriquer.
//   GTRACKER_APK_ESSAI   chemin d'une APK prise à la place de celle de Gradle (essais de l'installeur) ; son nom doit
//                        rester `Gtracker-<version>.apk`
//
// Prérequis : `npm install` dans `bureau/` (Electron, l'outil d'emballage, celui des fusibles et electron-builder, qui
// télécharge NSIS dans son cache à la première construction). La version vient de `package.json` à la racine, la
// seule du projet ; l'outil d'emballage veut trois nombres sans zéro en tête.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUREAU = join(RACINE, 'bureau')
const COMPILE = join(BUREAU, 'dist')
const SORTIE = join(BUREAU, 'sortie')
/** Atelier de l'installeur : coquille compilée, dossier emballé et fichiers d'electron-builder. */
const ATELIER_INSTALLEUR = join(SORTIE, 'installeur')
const DIST = join(RACINE, 'dist')
const ICONE = join(RACINE, 'outils', 'icone-gtracker.ico')
/** Programme Electron téléchargé à l'installation de `bureau/` (sauté si les scripts d'installation sont coupés). */
const ELECTRON = join(BUREAU, 'node_modules', 'electron', 'dist', 'electron.exe')
/** Dossier des APK de publication fabriquées par Gradle (`assembleRelease`). */
const DOSSIER_APK = ['android', 'app', 'build', 'outputs', 'apk', 'release']
/**
 * Identifiant du programme Windows : l'installeur en tire la clé de désinstallation et celle de l'emplacement installé.
 * Le changer ferait installer une version suivante à côté de la précédente au lieu de la remplacer.
 */
export const ID_PROGRAMME = 'io.github.segneur.gtracker.bureau'
/** Commandes qui fabriquent l'APK de publication de la version de `package.json`. */
const COMMANDE_APK = 'npm run build, puis npx cap sync android, puis gradlew.bat assembleRelease dans le dossier android'

/**
 * Version de la coquille d'après celle de l'application : `0.01.40` donne `0.1.40`, `0.10.05` donne `0.10.5`.
 * La version affichée par l'application reste celle de `package.json`.
 */
export function versionBureau(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim())
  if (!m) throw new Error(`version illisible : « ${version} » (trois nombres séparés par des points attendus)`)
  return m.slice(1, 4).map((n) => String(Number.parseInt(n, 10))).join('.')
}

/** Contenu du package.json de la coquille compilée : son nom, sa version, son point d'entrée. */
export function paquetDeLaCoquille(version) {
  return {
    name: 'gtracker',
    productName: 'Gtracker',
    description: 'Gtracker',
    version: versionBureau(version),
    gtrackerVersion: version,
    private: true,
    main: 'main.js',
  }
}

/** Nom de l'APK d'une version, tel que Gradle l'écrit et tel qu'il est rangé dans les ressources du programme. */
export function nomApk(version) {
  return `Gtracker-${version}.apk`
}

/** Nom du fichier de l'installeur : la version affichée, comme celle de l'APK. */
export function nomInstalleur(version) {
  return `Gtracker-Setup-${version}.exe`
}

/**
 * Chemin de l'APK à ranger dans le programme : celle de Gradle en version de publication, ou celle de
 * `GTRACKER_APK_ESSAI` pour les essais, dont le nom doit être celui de la version.
 */
export function cheminApk(version, { racine = RACINE, env = process.env } = {}) {
  const essai = env.GTRACKER_APK_ESSAI
  if (essai) {
    if (basename(essai) !== nomApk(version)) {
      throw new Error(`GTRACKER_APK_ESSAI : « ${basename(essai)} » n'est pas l'APK de la version ${version} (${nomApk(version)} attendu)`)
    }
    return resolve(essai)
  }
  return join(racine, ...DOSSIER_APK, nomApk(version))
}

/**
 * Message quand l'APK de la version manque : ce qui est présent à côté (une autre version), et la commande à lancer.
 * `presentes` : noms des fichiers du dossier de l'APK attendue.
 */
export function messageApkAbsente(version, chemin, presentes) {
  const autres = presentes.filter((n) => /^Gtracker-.+\.apk$/i.test(n) && n !== nomApk(version))
  const vu = autres.length > 0 ? ` ; présente : ${autres.join(', ')}, d'une autre version` : ''
  return `APK de la version ${version} absente (${chemin})${vu}. La fabriquer : ${COMMANDE_APK} ; ou --sans-apk pour un essai`
}

/** Vérifie que l'APK de la version est là, avant toute construction ; rend son chemin. */
function verifierApk(version) {
  const chemin = cheminApk(version)
  if (existsSync(chemin) && statSync(chemin).isFile()) return chemin
  const dossier = dirname(chemin)
  throw new Error(messageApkAbsente(version, chemin, existsSync(dossier) ? readdirSync(dossier) : []))
}

/**
 * Configuration d'electron-builder pour l'installeur NSIS : en un clic, par utilisateur, raccourcis « Gtracker » sur
 * le Bureau et dans le menu Démarrer, profil gardé à la désinstallation, en français, sans signature ni retouche de
 * l'exécutable (déjà fait par l'emballage et les fusibles).
 */
export function configNsis({ version, electronVersion, sortie = ATELIER_INSTALLEUR, icone = ICONE }) {
  return {
    appId: ID_PROGRAMME,
    productName: 'Gtracker',
    copyright: 'Gtracker',
    electronVersion,
    npmRebuild: false,
    directories: { output: sortie },
    // L'éditeur affiché dans la liste des programmes de Windows vient de l'auteur.
    extraMetadata: { version: versionBureau(version), author: { name: 'Gtracker' } },
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: icone,
      signAndEditExecutable: false,
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Gtracker',
      installerIcon: icone,
      uninstallerIcon: icone,
      uninstallDisplayName: 'Gtracker',
      deleteAppDataOnUninstall: false,
      artifactName: nomInstalleur(version),
      installerLanguages: ['fr_FR'],
      language: '1036',
      differentialPackage: false,
    },
    publish: null,
  }
}

/** Environnement des outils lancés : sans `ELECTRON_RUN_AS_NODE`, qui ferait démarrer Electron comme un simple Node. */
export function environnementPropre(env) {
  const propre = { ...env }
  for (const cle of Object.keys(propre)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete propre[cle]
  return propre
}

function etape(titre, commande, argv) {
  console.log(`· ${titre}`)
  const r = spawnSync(process.execPath, [commande, ...argv], { cwd: RACINE, stdio: 'inherit', env: environnementPropre(process.env) })
  if (r.status !== 0) throw new Error(`${titre} : échec (code ${r.status})`)
}

function modulesDe(depart) {
  for (let dossier = depart; ; dossier = dirname(dossier)) {
    if (existsSync(join(dossier, 'node_modules', 'typescript', 'bin', 'tsc'))) return join(dossier, 'node_modules')
    if (dirname(dossier) === dossier) return join(depart, 'node_modules')
  }
}

function compiler({ vite, sortie = COMPILE }) {
  if (!existsSync(join(BUREAU, 'node_modules', 'electron'))) {
    throw new Error('Electron absent : lancer « npm install » dans le dossier bureau/')
  }
  if (!existsSync(ELECTRON)) {
    throw new Error('programme Electron non téléchargé : lancer « node node_modules/electron/install.js » dans le dossier bureau/')
  }
  const modules = modulesDe(RACINE)
  if (vite) etape("construction de l'application (vite build)", join(modules, 'vite', 'bin', 'vite.js'), ['build', '--logLevel', 'warn'])
  if (!existsSync(join(DIST, 'index.html'))) throw new Error("dist/index.html absent : construire l'application d'abord")
  rmSync(sortie, { recursive: true, force: true })
  etape('compilation de la coquille (tsc -p bureau)', join(modules, 'typescript', 'bin', 'tsc'), ['-p', BUREAU, '--outDir', sortie])
  const version = lireVersion()
  writeFileSync(join(sortie, 'package.json'), JSON.stringify(paquetDeLaCoquille(version), null, 2) + '\n', 'utf8')
  return version
}

function lireVersion() {
  return JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).version
}

/** Importe un paquet installé dans `bureau/node_modules`. */
async function importerDuBureau(nom) {
  const require = createRequire(join(BUREAU, 'index.js'))
  return import(pathToFileURL(require.resolve(nom)).href)
}

function versionElectron() {
  return JSON.parse(readFileSync(join(BUREAU, 'node_modules', 'electron', 'package.json'), 'utf8')).version
}

/**
 * Emballe la coquille compilée `source` dans `sortie/Gtracker-win32-x64/`, avec `dist/` et les `ressources` de plus
 * (rangées dans `resources\` sous leur nom), puis pose les fusibles. Rend le chemin de `Gtracker.exe`.
 */
async function emballer(version, { source = COMPILE, sortie = SORTIE, ressources = [] } = {}) {
  const { packager } = await importerDuBureau('@electron/packager')
  const { flipFuses, FuseVersion, FuseV1Options } = await importerDuBureau('@electron/fuses')
  const electronVersion = versionElectron()
  const semver = versionBureau(version)
  console.log(`· emballage : Gtracker ${version} (${semver}), Electron ${electronVersion}`)
  const [dossier] = await packager({
    dir: source,
    out: sortie,
    name: 'Gtracker',
    executableName: 'Gtracker',
    platform: 'win32',
    arch: 'x64',
    electronVersion,
    appVersion: semver,
    buildVersion: semver,
    appCopyright: 'Gtracker',
    icon: ICONE,
    asar: true,
    prune: false,
    overwrite: true,
    quiet: true,
    extraResource: [DIST, ...ressources],
    win32metadata: { CompanyName: 'Gtracker', FileDescription: 'Gtracker', ProductName: 'Gtracker', InternalName: 'Gtracker', OriginalFilename: 'Gtracker.exe' },
  })
  const exe = join(dossier, 'Gtracker.exe')
  // Fusibles : ni démarrage en simple Node (`ELECTRON_RUN_AS_NODE`), ni options de Node par l'environnement, ni
  // débogueur de Node en ligne de commande ; la coquille ne se charge que depuis son archive, et `file://` n'a aucun
  // droit de plus (l'application est servie par la coquille, jamais par `file://`).
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  })
  console.log(`· programme : ${exe}`)
  return exe
}

/** Poids lisible d'un fichier, en Mo. */
function poids(chemin) {
  return `${(statSync(chemin).size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/** Construit l'installeur dans l'atelier, puis le range dans `bureau/sortie/` ; rend son chemin. */
async function construireInstalleur({ vite, avecApk }) {
  const debut = Date.now()
  const version = lireVersion()
  // L'APK se vérifie avant tout : une construction de plusieurs minutes ne doit pas échouer à la fin.
  const apk = avecApk ? verifierApk(version) : null
  console.log(apk ? `· application du téléphone : ${apk} (${poids(apk)})` : "· sans l'application du téléphone (essai)")
  rmSync(ATELIER_INSTALLEUR, { recursive: true, force: true })
  const coquille = join(ATELIER_INSTALLEUR, 'coquille')
  compiler({ vite, sortie: coquille })
  const exe = await emballer(version, { source: coquille, sortie: ATELIER_INSTALLEUR, ressources: apk ? [apk] : [] })
  const eb = await importerDuBureau('electron-builder')
  const { build, Platform, Arch } = eb.default ?? eb
  console.log('· installeur (electron-builder, NSIS)')
  await build({
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    prepackaged: dirname(exe),
    projectDir: coquille,
    publish: 'never',
    config: configNsis({ version, electronVersion: versionElectron() }),
  })
  const fabrique = join(ATELIER_INSTALLEUR, nomInstalleur(version))
  if (!existsSync(fabrique)) throw new Error(`installeur introuvable après electron-builder : ${fabrique}`)
  const range = join(SORTIE, nomInstalleur(version))
  rmSync(range, { force: true })
  renameSync(fabrique, range)
  console.log(`· installeur : ${range} (${poids(range)}, ${Math.round((Date.now() - debut) / 1000)} s)`)
  return range
}

function essayer(argv) {
  const env = environnementPropre(process.env)
  if (!env.GTRACKER_PROFIL) env.GTRACKER_PROFIL = join(SORTIE, 'profil-essai')
  console.log(`· essai : profil ${env.GTRACKER_PROFIL}`)
  const enfant = spawn(ELECTRON, [COMPILE, ...argv], { cwd: RACINE, stdio: 'inherit', env })
  enfant.on('error', (e) => {
    console.error(`Gtracker (programme Windows) : la coquille ne démarre pas (${e.message})`)
    process.exitCode = 1
  })
  enfant.on('close', (code) => {
    if (!process.exitCode) process.exitCode = code ?? 0
  })
}

export async function principal(args) {
  const separation = args.indexOf('--')
  const options = separation < 0 ? args : args.slice(0, separation)
  const passes = separation < 0 ? [] : args.slice(separation + 1)
  if (options.includes('--installeur')) {
    await construireInstalleur({ vite: !options.includes('--sans-vite'), avecApk: !options.includes('--sans-apk') })
    return
  }
  const version = compiler({ vite: !options.includes('--sans-vite') })
  if (options.includes('--exe')) await emballer(version)
  else if (!options.includes('--compiler')) essayer(passes)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  delete process.env.ELECTRON_RUN_AS_NODE
  principal(process.argv.slice(2)).catch((e) => {
    console.error(`Gtracker (programme Windows) : ${e.message}`)
    process.exitCode = 1
  })
}
