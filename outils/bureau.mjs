// Programme Windows de Gtracker (coquille Electron du dossier `bureau/`).
//
//   node outils/bureau.mjs           compile l'application et la coquille, puis lance la coquille sur `dist/` pour essayer
//   node outils/bureau.mjs --exe     compile, puis fabrique le programme d'essai, celui du banc, jamais diffusé :
//                                    bureau/sortie/Gtracker-win32-x64/
//   node outils/bureau.mjs --installeur   (npm run installeur) compile, emballe avec l'APK de la même version, puis
//                                    fabrique l'installeur : bureau/sortie/Gtracker-Setup-<version>.exe
//
// Options :
//   --sans-vite      ne refait pas `dist/` (déjà construit)
//   --compiler       compile seulement, sans lancer ni emballer (pour un lanceur, le banc par exemple)
//   --sans-apk       avec --installeur, pour les essais seulement : installeur sans l'application du téléphone
//   --essai          avec --installeur : installeur d'essai, jamais diffusé, `Gtracker-Setup-essai-<version>.exe`, dont
//                    le programme porte le marqueur d'essai ; le seul que lance `outils/installeur-essai.mjs`
//   -- <arguments>   passés tels quels à la coquille lancée pour essayer (après `--`)
//
// L'essai tourne sur le profil `bureau/sortie/profil-essai/` (jamais la mémoire du programme installé), sauf si
// `GTRACKER_PROFIL` est donné. Les autres variables de la coquille (`GTRACKER_BANC`…) passent telles quelles.
//
// Mode d'essai : la coquille lancée sur `bureau/dist` et le programme de `--exe` portent le marqueur `gtrackerEssai` dans
// leur package.json, et lisent donc les variables `GTRACKER_*` ; l'installeur compile sa coquille sans ce marqueur, et
// le programme livré les ignore toutes, port de débogage refusé compris (`bureau/modeEssai.ts`). Seul l'installeur
// d'essai (`--installeur --essai`), à son nom propre, installe un programme qui porte le marqueur.
//
// Contenu emballé : la coquille compilée réduite aux modules que `main.js` et `preload.js` chargent (le faux téléphone
// du banc reste dehors), et le moteur web en cinq langues (`LANGUES_GARDEES`). Chaque programme emballé, d'essai ou
// de l'installeur, est relu après coup (`controlerProgramme`, l'installeur sans `elevate.exe`) : un écart arrête tout.
//
// Installeur : NSIS par electron-builder, sur le dossier emballé (`--prepackaged`), en un clic, par utilisateur
// (`%LOCALAPPDATA%\Programs\Gtracker`, sans droits d'administrateur), raccourcis « Gtracker » sur le Bureau et dans le
// menu Démarrer ; la désinstallation garde le profil (`%APPDATA%\Gtracker`), et le dossier mémoire n'est jamais connu
// de l'installeur. Une version plus récente s'installe par-dessus, sans question quand Gtracker est ouvert :
// l'installeur le ferme lui-même (`inclusNsis`), et ne s'arrête sur un message, « Réessayer » ou « Annuler », que s'il
// n'y parvient pas. La désinstallation retire les deux règles du pare-feu posées par « Autoriser Gtracker » : si elles
// existent, Windows demande de confirmer, au nom de Gtracker ; un refus ne l'arrête pas ; une mise à jour n'y touche
// pas. Tout se fabrique dans `bureau/sortie/installeur/`
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
// Rangé dans `resources\` du programme : où trouver le code source de FFmpeg (LGPL 2.1).
const MENTIONS_FFMPEG = join(RACINE, 'outils', 'MENTIONS-FFMPEG.txt')
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

/**
 * Contenu du package.json de la coquille compilée : son nom, sa version, son point d'entrée ; avec `essai`, le marqueur
 * du programme d'essai (`gtrackerEssai`), sans lequel le programme emballé ignore toute variable `GTRACKER_*`.
 */
export function paquetDeLaCoquille(version, { essai = false } = {}) {
  return {
    name: 'gtracker',
    productName: 'Gtracker',
    description: 'Gtracker',
    version: versionBureau(version),
    gtrackerVersion: version,
    ...(essai ? { gtrackerEssai: true } : {}),
    private: true,
    main: 'main.js',
  }
}

/** Nom de l'APK d'une version, tel que Gradle l'écrit et tel qu'il est rangé dans les ressources du programme. */
export function nomApk(version) {
  return `Gtracker-${version}.apk`
}

/**
 * Nom du fichier de l'installeur : la version affichée, comme celle de l'APK. L'installeur d'essai (`essai`), qui
 * installe un programme en mode d'essai, porte `essai` dans son nom pour ne jamais passer pour l'installeur livré.
 */
export function nomInstalleur(version, { essai = false } = {}) {
  return essai ? `Gtracker-Setup-essai-${version}.exe` : `Gtracker-Setup-${version}.exe`
}

/** Vrai si le nom de fichier est celui d'un installeur d'essai (`nomInstalleur(version, { essai: true })`). */
export function estInstalleurEssai(nom) {
  return /^Gtracker-Setup-essai-.+\.exe$/i.test(String(nom).split(/[\\/]/).pop())
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

/** Fichier inclus dans le script NSIS, écrit dans l'atelier à chaque construction (jamais suivi par git). */
export const FICHIER_INCLUS_NSIS = 'installeur.nsh'

/**
 * Attente de la fermeture demandée à Gtracker (sa fenêtre fermée comme par sa croix), en secondes ; au-delà, ses
 * processus sont arrêtés de force. Courte : avec un brouillon non enregistré, Gtracker pose sa question et l'installeur
 * ne l'attend pas, comme le faisait la réponse OK à la question d'electron-builder.
 */
export const ATTENTE_FERMETURE_S = 5

/** Attente de la fin des processus arrêtés de force, en secondes ; au-delà, l'installeur demande de fermer Gtracker. */
export const ATTENTE_FORCE_S = 5

/** Variable d'environnement qui porte le dossier du programme au script de fermeture. */
const VARIABLE_DOSSIER = 'GTRACKER_DOSSIER_PROGRAMME'

/** Longueur maximale d'une chaîne de NSIS (`NSIS_MAX_STRLEN` du NSIS d'electron-builder). */
export const LONGUEUR_MAX_NSIS = 8192

/** Message de l'installeur quand Gtracker n'a pas pu être fermé ; ses boutons sont « Réessayer » et « Annuler ». */
export const MESSAGE_NON_FERME =
  "Gtracker est ouvert et l'installation n'arrive pas à le fermer.$\\r$\\n$\\r$\\nFermez Gtracker, puis cliquez sur Réessayer. Annuler garde la version déjà installée."

/**
 * Script Windows PowerShell de fermeture, avant une installation par-dessus. Il vise les processus dont l'exécutable
 * est dans le dossier du programme (variable `GTRACKER_DOSSIER_PROGRAMME`), pas un Gtracker lancé d'ailleurs ; il
 * demande d'abord la fermeture de leur fenêtre, attend, puis les arrête de force avec leurs processus fils. Codes de
 * sortie : 0 plus rien d'ouvert, 1 encore ouvert (lancé par un autre compte, ou en administrateur), 2 en échec.
 */
export function scriptFermeture({ fermetureS = ATTENTE_FERMETURE_S, forceS = ATTENTE_FORCE_S } = {}) {
  return [
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  $dossier = ([string]$env:${VARIABLE_DOSSIER}).TrimEnd('\\') + '\\'`,
    '  if ($dossier.Length -lt 4) { exit 2 }',
    // L'installeur qui a lancé ce script n'est jamais visé, même lancé depuis le dossier du programme.
    '  $installeur = [int](Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $PID").ParentProcessId',
    '  function Restants { @(Get-CimInstance -ClassName Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dossier, [StringComparison]::OrdinalIgnoreCase) -and [int]$_.ProcessId -ne $installeur }) }',
    '  function Attendre([int]$ms) {',
    '    $fin = [DateTime]::UtcNow.AddMilliseconds($ms)',
    '    do { if ((Restants).Count -eq 0) { return $true }; Start-Sleep -Milliseconds 250 } while ([DateTime]::UtcNow -lt $fin)',
    '    return ((Restants).Count -eq 0)',
    '  }',
    '  $ouverts = Restants',
    '  if ($ouverts.Count -eq 0) { exit 0 }',
    '  foreach ($p in $ouverts) { $g = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue; if ($g -and $g.MainWindowHandle -ne [IntPtr]::Zero) { [void]$g.CloseMainWindow() } }',
    `  if (Attendre ${fermetureS * 1000}) { exit 0 }`,
    '  $ids = @(Restants | ForEach-Object { [int]$_.ProcessId })',
    '  $fils = @(Get-CimInstance -ClassName Win32_Process | Where-Object { $ids -contains [int]$_.ParentProcessId -and [int]$_.ProcessId -ne $PID } | ForEach-Object { [int]$_.ProcessId })',
    '  foreach ($id in ($fils + $ids)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }',
    `  if (Attendre ${forceS * 1000}) { exit 0 }`,
    '  exit 1',
    '} catch { exit 2 }',
  ].join('\n')
}

/** Variable d'environnement qui porte le chemin de Gtracker.exe au script de la désinstallation. */
const VARIABLE_EXE_DESINSTALLATION = 'GTRACKER_EXE_DESINSTALLATION'

/** Noms des règles du pare-feu posées par « Autoriser Gtracker » (`REGLE_TCP` et `REGLE_UDP` de `bureau/pareFeu.ts`). */
export const REGLES_PAREFEU = ['Gtracker-SansFil-TCP', 'Gtracker-SansFil-UDP']

/** Drapeau qui fait retirer ses règles au Gtracker relancé élevé (`ARG_PAREFEU_RETIRER` de `bureau/pareFeu.ts`). */
export const ARG_RETRAIT_PAREFEU = '--gtracker-pare-feu=retirer'

/**
 * Script Windows PowerShell de la désinstallation : il lit les règles du pare-feu de Gtracker, sans droits ; aucune,
 * il rend 0 sans rien demander ; sinon il relance Gtracker.exe (variable `GTRACKER_EXE_DESINSTALLATION`) élevé avec
 * `--gtracker-pare-feu=retirer`, ce qui fait demander à Windows de confirmer au nom de Gtracker, et attend sa fin.
 * Codes de sortie : 0 rien à retirer ou retiré, 1 refus ou panne, 2 exécutable absent, sinon celui de Gtracker ; la
 * désinstallation n'en fait rien.
 */
export function scriptRetraitDesinstallation() {
  const noms = REGLES_PAREFEU.map((n) => `'${n}'`).join(', ')
  return [
    "$ErrorActionPreference = 'Stop'",
    'try {',
    `  if (@(Get-NetFirewallRule -Name ${noms} -PolicyStore PersistentStore -ErrorAction SilentlyContinue).Count -eq 0) { exit 0 }`,
    `  $exe = [string]$env:${VARIABLE_EXE_DESINSTALLATION}`,
    '  if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { exit 2 }',
    `  $p = Start-Process -FilePath $exe -ArgumentList '${ARG_RETRAIT_PAREFEU}' -Verb RunAs -PassThru`,
    '  $null = $p.Handle',
    '  $p.WaitForExit()',
    '  if ($null -eq $p.ExitCode) { exit 6 }',
    '  exit $p.ExitCode',
    '} catch { exit 1 }',
  ].join('\n')
}

/**
 * Fichier inclus dans le script NSIS d'electron-builder (option `nsis.include`). Sa macro `customCheckAppRunning`
 * remplace, à l'installation seulement, la question « Gtracker est en cours d'utilisation. Cliquez sur OK pour fermer
 * ce programme. », qui attendait sans limite : l'installeur ferme Gtracker comme le faisait la réponse OK
 * (`scriptFermeture`), puis installe et relance comme avant. Sans Windows PowerShell, repli sur `taskkill` par le nom
 * du programme, pour l'utilisateur courant. Gtracker encore ouvert : message « Réessayer » ou « Annuler », toujours au
 * premier plan ; Annuler laisse l'ancienne version et rend le code 2. Dans la passe du désinstalleur
 * (`BUILD_UNINSTALLER`), sa macro `customUnInstall`, lancée avant l'effacement des fichiers, retire les règles du
 * pare-feu (`scriptRetraitDesinstallation`), sauf quand une mise à jour relance l'ancien désinstalleur (`isUpdated`) ;
 * son issue est ignorée, et rien ne s'affiche.
 */
export function inclusNsis(options = {}) {
  const fermetureMs = (options.fermetureS ?? ATTENTE_FERMETURE_S) * 1000
  const forceMs = (options.forceS ?? ATTENTE_FORCE_S) * 1000
  const encode = Buffer.from(scriptFermeture(options), 'utf16le').toString('base64')
  const encodeRetrait = Buffer.from(scriptRetraitDesinstallation(), 'utf16le').toString('base64')
  const filtre = '/FI "USERNAME eq %USERNAME%"'
  return [
    "; Fermeture de Gtracker avant une installation par-dessus, sans question, et retrait de ses règles du pare-feu à la désinstallation (écrit par outils/bureau.mjs).",
    '!ifndef BUILD_UNINSTALLER',
    '!macro customCheckAppRunning',
    `  System::Call 'kernel32::SetEnvironmentVariable(t "${VARIABLE_DOSSIER}", t "$INSTDIR")'`,
    '  gtracker_fermer:',
    `  nsExec::Exec '"$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encode}'`,
    // nsExec rend le code de sortie, ou « error » (lancement impossible) ou « timeout » : comparaisons en chaînes, à
    // la casse près, pour que seuls « 0 » et « 1 » comptent comme des codes du script.
    '  Pop $0',
    '  ${If} $0 S== "0"',
    '    Goto gtracker_ferme',
    '  ${EndIf}',
    '  ${If} $0 S!= "1"',
    `    nsExec::Exec '"$SYSDIR\\cmd.exe" /C taskkill /IM "\${APP_EXECUTABLE_FILENAME}" ${filtre}'`,
    '    Pop $0',
    `    Sleep ${fermetureMs}`,
    // Sans `/T` : avec un filtre, taskkill met une vingtaine de secondes à parcourir les arbres de processus ; les
    // processus de Gtracker portent tous son nom.
    `    nsExec::Exec '"$SYSDIR\\cmd.exe" /C taskkill /F /IM "\${APP_EXECUTABLE_FILENAME}" ${filtre}'`,
    '    Pop $0',
    `    Sleep ${forceMs}`,
    `    nsExec::Exec \`"$SYSDIR\\cmd.exe" /C tasklist ${filtre} /FI "IMAGENAME eq \${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\\findstr.exe" /B /I /C:"\\"\${APP_EXECUTABLE_FILENAME}\\""\``,
    '    Pop $0',
    // findstr : « 1 », rien trouvé, Gtracker est fermé ; « 0 » trouvé, « error », inconnu : le message.
    '    ${If} $0 S== "1"',
    '      Goto gtracker_ferme',
    '    ${EndIf}',
    '  ${EndIf}',
    `  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION|MB_TOPMOST|MB_SETFOREGROUND "${MESSAGE_NON_FERME}" /SD IDCANCEL IDRETRY gtracker_fermer`,
    '  SetErrorLevel 2',
    '  Quit',
    '  gtracker_ferme:',
    '!macroend',
    '!else',
    '!macro customUnInstall',
    '  ${ifNot} ${isUpdated}',
    `    System::Call 'kernel32::SetEnvironmentVariable(t "${VARIABLE_EXE_DESINSTALLATION}", t "$INSTDIR\\\${APP_EXECUTABLE_FILENAME}")'`,
    `    nsExec::Exec '"$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodeRetrait}'`,
    '    Pop $0',
    '  ${endIf}',
    '!macroend',
    '!endif',
    '',
  ].join('\r\n')
}

/**
 * Octets du fichier inclus : UTF-8 précédé de sa marque (BOM), que makensis reconnaît quelle que soit l'option
 * `-INPUTCHARSET` ; sans elle, un makensis lancé sans cette option lirait les accents du message dans la page de code
 * de Windows.
 */
export function octetsInclusNsis(options = {}) {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(inclusNsis(options), 'utf8')])
}

/**
 * Configuration d'electron-builder pour l'installeur NSIS : en un clic, par utilisateur, raccourcis « Gtracker » sur
 * le Bureau et dans le menu Démarrer, profil gardé à la désinstallation, en français, sans signature ni retouche de
 * l'exécutable (déjà fait par l'emballage et les fusibles). `include` : le fichier de `inclusNsis`, écrit avant.
 */
export function configNsis({ version, electronVersion, sortie = ATELIER_INSTALLEUR, icone = ICONE, include = join(sortie, FICHIER_INCLUS_NSIS), essai = false }) {
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
      // Sans l'outil tiers `resources\elevate.exe`, inutile par utilisateur et sans mise à jour automatique.
      packElevateHelper: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Gtracker',
      installerIcon: icone,
      uninstallerIcon: icone,
      uninstallDisplayName: 'Gtracker',
      deleteAppDataOnUninstall: false,
      artifactName: nomInstalleur(version, { essai }),
      installerLanguages: ['fr_FR'],
      language: '1036',
      differentialPackage: false,
      include,
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

/** Appel `require` d'un chemin relatif dans le JavaScript compilé par tsc (`require("./adb")`). */
const REQUIRE_RELATIF = /\brequire\(\s*["'](\.{1,2}\/[^"']*)["']\s*\)/g

/** Nom du fichier d'un `require` relatif : `./adb` donne `adb.js` ; un nom qui porte déjà son extension la garde. */
function fichierRequis(chemin, depuis) {
  if (!/^\.\/[^/\\]+$/.test(chemin)) {
    throw new Error(`${depuis} : require("${chemin}") sort de la racine de la coquille compilée, que l'emballage seul prend`)
  }
  const nom = chemin.slice(2)
  return /\.(c?js|json|node)$/i.test(nom) ? nom : `${nom}.js`
}

/**
 * Fichiers utiles de la coquille compilée : la fermeture des `require` relatifs du JavaScript compilé, depuis les
 * points d'entrée, sans liste figée (un module qu'un fichier utile charge est pris, même produit à part par la
 * compilation). `lire(nom)` rend le texte d'un fichier du dossier compilé. Rend les noms triés (`main.js`…). Un module
 * requis absent, ou un `require` vers un sous-dossier ou hors du dossier, arrête la construction.
 */
export function modulesUtiles(lire, departs = ['main.js', 'preload.js']) {
  const utiles = new Set()
  const aLire = departs.map((nom) => ({ nom, depuis: 'point d’entrée' }))
  while (aLire.length > 0) {
    const { nom, depuis } = aLire.pop()
    if (utiles.has(nom)) continue
    let texte
    try {
      texte = lire(nom)
    } catch (e) {
      throw new Error(`module ${nom} introuvable dans la coquille compilée (requis par ${depuis}) : ${e.message}`)
    }
    utiles.add(nom)
    for (const m of texte.matchAll(REQUIRE_RELATIF)) aLire.push({ nom: fichierRequis(m[1], nom), depuis: nom })
  }
  return [...utiles].sort()
}

/** Fichiers utiles du dossier compilé `source`. */
function utilesDe(source) {
  return modulesUtiles((nom) => readFileSync(join(source, nom), 'utf8'))
}

/**
 * Filtre `ignore` de l'outil d'emballage : vrai pour tout ce qui reste dehors. L'outil passe le chemin relatif au
 * dossier de la coquille, à barres droites (`/main.js`), et `''` pour le dossier lui-même ; une fonction remplace ses
 * exclusions par défaut. Seuls entrent `package.json` et les fichiers `utiles` : le faux téléphone des essais, chargé
 * par le banc depuis le dossier compilé, n'est jamais emballé.
 */
export function ignorerHorsModules(utiles) {
  const gardes = new Set(['', '/package.json', ...utiles.map((nom) => `/${nom}`)])
  return (nom) => !gardes.has(nom)
}

/** Langues du moteur web gardées dans le programme : celles de l'application, et en-US, repli de Chromium. */
export const LANGUES_GARDEES = ['fr', 'en-US', 'en-GB', 'es', 'es-419']

/** Fichiers de langue du moteur web (`locales/*.pak`) à retirer : tous sauf ceux de `LANGUES_GARDEES`. */
export function languesAOter(noms) {
  const gardes = new Set(LANGUES_GARDEES.map((langue) => `${langue}.pak`))
  return noms.filter((nom) => nom.endsWith('.pak') && !gardes.has(nom))
}

/**
 * Crochet `afterExtract` de l'outil d'emballage : les fichiers de langue sont dans le moteur web extrait (`buildPath`),
 * pas dans la copie de la coquille ; un moteur sans dossier `locales` arrête l'emballage.
 */
function retirerLangues({ buildPath }) {
  const dossier = join(buildPath, 'locales')
  for (const nom of languesAOter(readdirSync(dossier))) rmSync(join(dossier, nom))
}

/** Chemin d'une entrée de l'archive, tel que `@electron/asar` le liste (`\main.js` sous Windows), en `main.js`. */
function entreeArchive(chemin) {
  return chemin.replace(/\\/g, '/').replace(/^\/+/, '')
}

/**
 * Écarts du programme emballé, sur ce qui en a été lu (`lireProgramme`) : `ressources`, noms de `resources\` ;
 * `langues`, noms de `locales\` ; `asar`, entrées de l'archive de la coquille ; `paquet`, son package.json. Attendus :
 * pas d'`elevate.exe`, exactement les langues gardées, exactement les fichiers `utiles` et `package.json` dans
 * l'archive, et le marqueur d'essai présent pour le programme d'essai (`essai`), absent sinon. Rend la liste des écarts.
 */
export function controlerProgramme({ ressources, langues, asar, paquet }, { utiles, essai = false }) {
  const ecarts = []
  if (ressources.includes('elevate.exe')) ecarts.push('resources\\elevate.exe présent (outil tiers inutile)')
  const languesAttendues = LANGUES_GARDEES.map((langue) => `${langue}.pak`).sort()
  const languesVues = [...langues].sort()
  if (languesVues.join('|') !== languesAttendues.join('|')) {
    ecarts.push(`langues du moteur web : ${languesVues.join(', ') || 'aucune'} au lieu de ${languesAttendues.join(', ')}`)
  }
  const attendus = new Set(['package.json', ...utiles])
  const vus = new Set(asar.map(entreeArchive))
  const enTrop = [...vus].filter((nom) => !attendus.has(nom)).sort()
  const manquants = [...attendus].filter((nom) => !vus.has(nom)).sort()
  if (enTrop.length > 0) ecarts.push(`archive de la coquille, en trop : ${enTrop.join(', ')}`)
  if (manquants.length > 0) ecarts.push(`archive de la coquille, manquants : ${manquants.join(', ')}`)
  const marque = paquet?.gtrackerEssai !== undefined
  if (essai && paquet?.gtrackerEssai !== true) ecarts.push("marqueur d'essai absent du package.json de l'archive")
  if (!essai && marque) ecarts.push("marqueur d'essai présent dans le package.json de l'archive")
  return ecarts
}

/** Lit dans le dossier emballé ce que `controlerProgramme` contrôle. */
export async function lireProgramme(dossier) {
  const asar = await importerDuBureau('@electron/asar')
  const archive = join(dossier, 'resources', 'app.asar')
  return {
    ressources: readdirSync(join(dossier, 'resources')),
    langues: readdirSync(join(dossier, 'locales')),
    asar: asar.listPackage(archive, { isPack: false }),
    paquet: JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8')),
  }
}

/** Contrôle à la construction : un écart du programme emballé dans `dossier` arrête tout. */
async function verifierProgramme(dossier, { source, essai }) {
  const ecarts = controlerProgramme(await lireProgramme(dossier), { utiles: utilesDe(source), essai })
  if (ecarts.length > 0) throw new Error(`programme non conforme (${dossier}) : ${ecarts.join(' ; ')}`)
  console.log('· contrôle du programme : conforme')
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

/** Compile l'application et la coquille dans `sortie` ; `essai` pose le marqueur du programme d'essai (défaut : oui). */
function compiler({ vite, sortie = COMPILE, essai = true }) {
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
  writeFileSync(join(sortie, 'package.json'), JSON.stringify(paquetDeLaCoquille(version, { essai }), null, 2) + '\n', 'utf8')
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
    ignore: ignorerHorsModules(utilesDe(source)),
    afterExtract: [retirerLangues],
    prune: false,
    overwrite: true,
    quiet: true,
    extraResource: [DIST, MENTIONS_FFMPEG, ...ressources],
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

/**
 * Construit l'installeur dans l'atelier, puis le range dans `bureau/sortie/` ; rend son chemin. `essai` : l'installeur
 * d'essai, à son nom propre, dont le programme porte le marqueur d'essai (`outils/installeur-essai.mjs` seulement).
 */
async function construireInstalleur({ vite, avecApk, essai = false }) {
  const debut = Date.now()
  const version = lireVersion()
  // L'APK se vérifie avant tout : une construction de plusieurs minutes ne doit pas échouer à la fin.
  const apk = avecApk ? verifierApk(version) : null
  console.log(apk ? `· application du téléphone : ${apk} (${poids(apk)})` : "· sans l'application du téléphone (essai)")
  rmSync(ATELIER_INSTALLEUR, { recursive: true, force: true })
  const coquille = join(ATELIER_INSTALLEUR, 'coquille')
  // Coquille du programme livré sans le marqueur d'essai ; celle de l'installeur d'essai le porte.
  if (essai) console.log("· installeur d'essai : programme en mode d'essai, jamais diffusé")
  compiler({ vite, sortie: coquille, essai })
  const exe = await emballer(version, { source: coquille, sortie: ATELIER_INSTALLEUR, ressources: apk ? [apk] : [] })
  const eb = await importerDuBureau('electron-builder')
  const { build, Platform, Arch } = eb.default ?? eb
  console.log('· installeur (electron-builder, NSIS)')
  writeFileSync(join(ATELIER_INSTALLEUR, FICHIER_INCLUS_NSIS), octetsInclusNsis(), { flag: 'w' })
  await build({
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    prepackaged: dirname(exe),
    projectDir: coquille,
    publish: 'never',
    config: configNsis({ version, electronVersion: versionElectron(), essai }),
  })
  // electron-builder copie `elevate.exe` dans le dossier emballé à la fin de `build` : le contrôle vient après.
  await verifierProgramme(dirname(exe), { source: coquille, essai })
  const fabrique = join(ATELIER_INSTALLEUR, nomInstalleur(version, { essai }))
  if (!existsSync(fabrique)) throw new Error(`installeur introuvable après electron-builder : ${fabrique}`)
  const range = join(SORTIE, nomInstalleur(version, { essai }))
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
    await construireInstalleur({ vite: !options.includes('--sans-vite'), avecApk: !options.includes('--sans-apk'), essai: options.includes('--essai') })
    return
  }
  const version = compiler({ vite: !options.includes('--sans-vite') })
  if (options.includes('--exe')) await verifierProgramme(dirname(await emballer(version)), { source: COMPILE, essai: true })
  else if (!options.includes('--compiler')) essayer(passes)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  delete process.env.ELECTRON_RUN_AS_NODE
  principal(process.argv.slice(2)).catch((e) => {
    console.error(`Gtracker (programme Windows) : ${e.message}`)
    process.exitCode = 1
  })
}
