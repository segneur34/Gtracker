import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ATTENTE_FERMETURE_S,
  ATTENTE_FORCE_S,
  FICHIER_INCLUS_NSIS,
  ID_PROGRAMME,
  LONGUEUR_MAX_NSIS,
  MESSAGE_NON_FERME,
  cheminApk,
  LANGUES_GARDEES,
  configNsis,
  controlerProgramme,
  environnementPropre,
  estInstalleurEssai,
  ignorerHorsModules,
  inclusNsis,
  languesAOter,
  messageApkAbsente,
  modulesUtiles,
  nomApk,
  octetsInclusNsis,
  nomInstalleur,
  paquetDeLaCoquille,
  scriptFermeture,
  scriptRetraitDesinstallation,
  versionBureau,
  REGLES_PAREFEU,
  ARG_RETRAIT_PAREFEU,
} from './bureau.mjs'
import { ARG_PAREFEU_RETIRER, REGLE_TCP, REGLE_UDP, cheminPowershell } from '../bureau/pareFeu.ts'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

describe('cheminApk', () => {
  it('prend l’APK de publication de Gradle, au nom de la version de package.json', () => {
    const racine = resolve('racine-essai')
    expect(cheminApk('0.01.77', { racine, env: {} })).toBe(join(racine, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'Gtracker-0.01.77.apk'))
    expect(nomApk('0.10.05')).toBe('Gtracker-0.10.05.apk')
  })

  it('ne prend jamais une APK de débogage', () => {
    expect(cheminApk('0.01.77', { racine: resolve('r'), env: {} })).not.toMatch(/debug/i)
  })

  it('prend l’APK d’essai si elle porte le nom de la version, la refuse sinon', () => {
    const essai = resolve('ailleurs', 'Gtracker-0.01.77.apk')
    expect(cheminApk('0.01.77', { env: { GTRACKER_APK_ESSAI: essai } })).toBe(essai)
    expect(() => cheminApk('0.01.77', { env: { GTRACKER_APK_ESSAI: resolve('ailleurs', 'Gtracker-0.01.71.apk') } })).toThrow(/0\.01\.77/)
    expect(() => cheminApk('0.01.77', { env: { GTRACKER_APK_ESSAI: resolve('ailleurs', 'app-debug.apk') } })).toThrow(/n'est pas/)
  })

  it('dit l’APK d’une autre version présente et la commande qui fabrique la bonne', () => {
    const m = messageApkAbsente('0.01.77', 'x', ['Gtracker-0.01.71.apk', 'output-metadata.json'])
    expect(m).toMatch(/0\.01\.77 absente/)
    expect(m).toMatch(/Gtracker-0\.01\.71\.apk, d'une autre version/)
    expect(m).toMatch(/assembleRelease/)
    expect(messageApkAbsente('0.01.77', 'x', [])).not.toMatch(/présente/)
  })
})

describe('configNsis', () => {
  const config = configNsis({ version: '0.01.77', electronVersion: '45.3.4', sortie: 'atelier', icone: 'icone.ico' })

  it('installe par utilisateur, en un clic, sans droits d’administrateur', () => {
    expect(config.nsis.oneClick).toBe(true)
    expect(config.nsis.perMachine).toBe(false)
    expect(config.nsis.packElevateHelper).toBe(false)
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    expect(config.win.signAndEditExecutable).toBe(false)
  })

  it('garde le profil à la désinstallation', () => {
    expect(config.nsis.deleteAppDataOnUninstall).toBe(false)
  })

  it('nomme le fichier d’après la version affichée et le programme d’après la version de la coquille', () => {
    expect(config.nsis.artifactName).toBe('Gtracker-Setup-0.01.77.exe')
    expect(nomInstalleur('0.01.77')).toBe(config.nsis.artifactName)
    expect(config.extraMetadata.version).toBe('0.1.77')
  })

  it('donne à l’installeur d’essai un nom qui ne se confond pas avec celui de l’installeur livré', () => {
    const essai = configNsis({ version: '0.01.77', electronVersion: '45.3.4', sortie: 'atelier', icone: 'icone.ico', essai: true })
    expect(essai.nsis.artifactName).toBe('Gtracker-Setup-essai-0.01.77.exe')
    expect(nomInstalleur('0.01.77', { essai: true })).toBe(essai.nsis.artifactName)
    expect(estInstalleurEssai(join('bureau', 'sortie', 'Gtracker-Setup-essai-0.01.77.exe'))).toBe(true)
    expect(estInstalleurEssai('C:\\x\\gtracker-setup-essai-0.01.77.exe')).toBe(true)
    expect(estInstalleurEssai(join('bureau', 'sortie', nomInstalleur('0.01.77')))).toBe(false)
    expect(estInstalleurEssai('Gtracker-Setup-0.01.77-essai.exe')).toBe(false)
  })

  it('pose les raccourcis « Gtracker », l’icône, le français et un identifiant stable', () => {
    expect(config.nsis.createDesktopShortcut).toBe(true)
    expect(config.nsis.createStartMenuShortcut).toBe(true)
    expect(config.nsis.shortcutName).toBe('Gtracker')
    expect(config.productName).toBe('Gtracker')
    expect(config.win.icon).toBe('icone.ico')
    expect(config.nsis.installerLanguages).toEqual(['fr_FR'])
    expect(config.appId).toBe(ID_PROGRAMME)
    expect(config.publish).toBeNull()
  })

  it('porte le fichier inclus, écrit dans l’atelier', () => {
    expect(config.nsis.include).toBe(join('atelier', FICHIER_INCLUS_NSIS))
    expect(configNsis({ version: '0.01.77', electronVersion: '45.3.4', include: 'ailleurs.nsh' }).nsis.include).toBe('ailleurs.nsh')
  })
})

describe('fermeture de Gtracker par l’installeur', () => {
  const inclus = inclusNsis()
  const lignes = inclus.split('\r\n')
  const commande = lignes.find((l) => l.includes('-EncodedCommand')) ?? ''
  const decoder = (texte) => Buffer.from(/-EncodedCommand ([A-Za-z0-9+/=]+)'/.exec(texte)?.[1] ?? '', 'base64').toString('utf16le')

  it('remplace la question d’electron-builder à l’installation seulement : la désinstallation garde la sienne', () => {
    expect(lignes.indexOf('!ifndef BUILD_UNINSTALLER')).toBeLessThan(lignes.indexOf('!macro customCheckAppRunning'))
    expect(lignes.indexOf('!macroend')).toBeLessThan(lignes.indexOf('!endif'))
    expect(inclus).not.toMatch(/MB_OKCANCEL|appRunning/)
  })

  it('passe le dossier du programme par l’environnement, et le script de fermeture tient dans une chaîne de NSIS', () => {
    expect(inclus).toContain(`SetEnvironmentVariable(t "GTRACKER_DOSSIER_PROGRAMME", t "$INSTDIR")`)
    expect(decoder(commande)).toBe(scriptFermeture())
    expect(commande.length).toBeLessThan(LONGUEUR_MAX_NSIS - 512)
    expect(commande).toContain('-NoProfile -NonInteractive -ExecutionPolicy Bypass')
  })

  it('demande la fermeture, attend, puis force avec les processus fils ; ne vise que le dossier du programme', () => {
    const script = scriptFermeture()
    expect([ATTENTE_FERMETURE_S, ATTENTE_FORCE_S]).toEqual([5, 5])
    expect(script).toContain('$env:GTRACKER_DOSSIER_PROGRAMME')
    expect(script).toContain('ExecutablePath.StartsWith($dossier, [StringComparison]::OrdinalIgnoreCase)')
    const demande = script.indexOf('CloseMainWindow()')
    const premiereAttente = script.indexOf('if (Attendre 5000) { exit 0 }')
    const force = script.indexOf('Stop-Process -Id $id -Force')
    expect(demande).toBeGreaterThan(0)
    expect(premiereAttente).toBeGreaterThan(demande)
    expect(force).toBeGreaterThan(premiereAttente)
    expect(script.lastIndexOf('if (Attendre 5000) { exit 0 }')).toBeGreaterThan(force)
    expect(script).toContain('ParentProcessId')
    expect(script).toMatch(/exit 1\n\} catch \{ exit 2 \}$/)
    const reglee = scriptFermeture({ fermetureS: 8, forceS: 3 })
    expect(reglee).toContain('if (Attendre 8000) { exit 0 }')
    expect(reglee).toContain('if (Attendre 3000) { exit 0 }')
    expect(inclusNsis({ fermetureS: 8, forceS: 3 })).toMatch(/Sleep 8000\r\n[\s\S]*Sleep 3000\r\n/)
  })

  it('fichier écrit en UTF-8 précédé de sa marque : les accents du message restent justes', () => {
    const octets = octetsInclusNsis()
    expect([...octets.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(octets.subarray(3).toString('utf8')).toBe(inclus)
    expect(octets.includes(Buffer.from('Réessayer. Annuler garde la version déjà installée.', 'utf8'))).toBe(true)
  })

  it('codes de nsExec comparés en chaînes : « error » ou « timeout » ne passent jamais pour « 0 »', () => {
    const tests = lignes.filter((l) => l.includes('${If} $0'))
    expect(tests.map((l) => l.trim())).toEqual(['${If} $0 S== "0"', '${If} $0 S!= "1"', '${If} $0 S== "1"'])
  })

  it('sans Windows PowerShell, repli sur taskkill pour l’utilisateur courant : demande, puis force', () => {
    const douce = lignes.findIndex((l) => l.includes('taskkill /IM'))
    const forcee = lignes.findIndex((l) => l.includes('taskkill /F /IM'))
    expect(douce).toBeGreaterThan(lignes.findIndex((l) => l.includes('${If} $0 S!= "1"')))
    expect(forcee).toBeGreaterThan(douce)
    expect(lignes[douce]).toContain('/FI "USERNAME eq %USERNAME%"')
    expect(lignes[forcee]).toContain('"${APP_EXECUTABLE_FILENAME}"')
  })

  it('pas fermé : message « Réessayer » au premier plan, Annuler quitte en échec sans installer', () => {
    const message = lignes.find((l) => l.includes('MessageBox')) ?? ''
    expect(message).toContain('MB_RETRYCANCEL')
    expect(message).toContain('MB_TOPMOST|MB_SETFOREGROUND')
    expect(message).toContain('/SD IDCANCEL IDRETRY gtracker_fermer')
    expect(message).toContain(MESSAGE_NON_FERME)
    expect(MESSAGE_NON_FERME).toContain('cliquez sur Réessayer')
    const suite = lignes.slice(lignes.indexOf(message) + 1, lignes.indexOf(message) + 3).map((l) => l.trim())
    expect(suite).toEqual(['SetErrorLevel 2', 'Quit'])
  })
})

describe('retrait des règles du pare-feu par le désinstalleur', () => {
  const inclus = inclusNsis()
  const lignes = inclus.split('\r\n')
  const debut = lignes.indexOf('!macro customUnInstall')
  const fin = lignes.indexOf('!macroend', debut)
  const macro = lignes.slice(debut, fin)
  const commande = macro.find((l) => l.includes('-EncodedCommand')) ?? ''
  const decoder = (texte) => Buffer.from(/-EncodedCommand ([A-Za-z0-9+/=]+)'/.exec(texte)?.[1] ?? '', 'base64').toString('utf16le')

  it('dans la passe du désinstalleur seulement, jamais lors d’une mise à jour', () => {
    expect(debut).toBeGreaterThan(lignes.indexOf('!else'))
    expect(lignes.indexOf('!else')).toBeGreaterThan(lignes.indexOf('!macro customCheckAppRunning'))
    expect(lignes.indexOf('!endif')).toBeGreaterThan(fin)
    expect(macro[1].trim()).toBe('${ifNot} ${isUpdated}')
    expect(macro[macro.length - 1].trim()).toBe('${endIf}')
    expect(macro.findIndex((l) => l.includes('-EncodedCommand'))).toBeGreaterThan(1)
  })

  it('passe Gtracker.exe par l’environnement, ignore l’issue, n’affiche rien', () => {
    expect(macro.join('\n')).toContain('SetEnvironmentVariable(t "GTRACKER_EXE_DESINSTALLATION", t "$INSTDIR\\${APP_EXECUTABLE_FILENAME}")')
    expect(decoder(commande)).toBe(scriptRetraitDesinstallation())
    expect(commande.length).toBeLessThan(LONGUEUR_MAX_NSIS - 512)
    expect(macro.join('\n')).not.toMatch(/MessageBox|Abort|Quit|SetErrorLevel/)
    expect(macro.filter((l) => l.includes('Pop $0'))).toHaveLength(1)
  })

  it('aucune règle : rien n’est demandé ; sinon Gtracker relancé élevé avec le drapeau de retrait', () => {
    const script = scriptRetraitDesinstallation()
    expect(REGLES_PAREFEU).toEqual([REGLE_TCP, REGLE_UDP])
    expect(ARG_RETRAIT_PAREFEU).toBe(ARG_PAREFEU_RETIRER)
    const lecture = script.indexOf(`Get-NetFirewallRule -Name '${REGLE_TCP}', '${REGLE_UDP}'`)
    const sansRegle = script.indexOf('.Count -eq 0) { exit 0 }')
    const demande = script.indexOf(`Start-Process -FilePath $exe -ArgumentList '${ARG_PAREFEU_RETIRER}' -Verb RunAs -PassThru`)
    expect(lecture).toBeGreaterThan(0)
    expect(sansRegle).toBeGreaterThan(lecture)
    expect(demande).toBeGreaterThan(sansRegle)
    expect(script).toContain('$env:GTRACKER_EXE_DESINSTALLATION')
    expect(script).toContain('$p.WaitForExit()')
    expect(script).toMatch(/\} catch \{ exit 1 \}$/)
  })

  it.runIf(process.platform === 'win32')('scripts lus par Windows PowerShell sans erreur d’analyse, jamais exécutés', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtracker-nsis-'))
    try {
      writeFileSync(join(dossier, 'retrait.ps1'), `﻿${scriptRetraitDesinstallation()}`, 'utf8')
      writeFileSync(join(dossier, 'fermeture.ps1'), `﻿${scriptFermeture()}`, 'utf8')
      const analyse = [
        "$ProgressPreference = 'SilentlyContinue'",
        '$n = 0',
        `foreach ($f in Get-ChildItem -LiteralPath '${dossier}' -Filter *.ps1) {`,
        '  $t = $null; $e = $null',
        '  [void][Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)',
        '  $n += 10 * @($e).Count + 1',
        '}',
        '[Console]::Out.Write($n)',
      ].join('\n')
      const sortie = execFileSync(cheminPowershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(analyse, 'utf16le').toString('base64')], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
      })
      // Deux fichiers lus, aucune erreur.
      expect(sortie.trim()).toBe('2')
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  }, 40_000)
})

describe('versionBureau', () => {
  it('retire les zéros en tête de chaque nombre', () => {
    expect(versionBureau('0.01.40')).toBe('0.1.40')
    expect(versionBureau('0.10.05')).toBe('0.10.5')
    expect(versionBureau('0.01.00')).toBe('0.1.0')
    expect(versionBureau('1.02.03')).toBe('1.2.3')
  })

  it('laisse une version déjà propre telle quelle', () => {
    expect(versionBureau('0.10.40')).toBe('0.10.40')
    expect(versionBureau(' 2.0.0 ')).toBe('2.0.0')
  })

  it('refuse une version qui n’a pas trois nombres', () => {
    expect(() => versionBureau('0.01')).toThrow(/illisible/)
    expect(() => versionBureau('0.01.40-essai')).toThrow(/illisible/)
    expect(() => versionBureau('')).toThrow(/illisible/)
  })
})

describe('paquetDeLaCoquille', () => {
  it('porte la version convertie et la version affichée', () => {
    const p = paquetDeLaCoquille('0.01.40')
    expect(p.version).toBe('0.1.40')
    expect(p.gtrackerVersion).toBe('0.01.40')
    expect(p.productName).toBe('Gtracker')
    expect(p.main).toBe('main.js')
  })

  it('ne porte le marqueur du programme d’essai que si on le demande', () => {
    expect(paquetDeLaCoquille('0.01.40')).not.toHaveProperty('gtrackerEssai')
    expect(paquetDeLaCoquille('0.01.40', { essai: false })).not.toHaveProperty('gtrackerEssai')
    expect(paquetDeLaCoquille('0.01.40', { essai: true }).gtrackerEssai).toBe(true)
  })
})

describe('environnementPropre', () => {
  it('retire ELECTRON_RUN_AS_NODE, quelle que soit sa casse, sans toucher au reste', () => {
    const env = { ELECTRON_RUN_AS_NODE: '1', Electron_Run_As_Node: '1', GTRACKER_BANC: '1' }
    expect(environnementPropre(env)).toEqual({ GTRACKER_BANC: '1' })
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  })
})

/** Lecteur d'un faux dossier compilé ; un fichier absent lève comme `readFileSync`. */
function lecteur(fichiers) {
  return (nom) => {
    if (!(nom in fichiers)) throw new Error(`ENOENT: ${nom}`)
    return fichiers[nom]
  }
}

describe('modulesUtiles', () => {
  const compile = {
    'main.js': '"use strict";\nconst electron_1 = require("electron");\nconst adb_1 = require("./adb");\nconst p = require(\'./pont.js\');\n',
    'preload.js': 'const electron_1 = require("electron");\n',
    'adb.js': 'const fs = require("node:fs");\nconst appairage_1 = require("./appairage");\n',
    'appairage.js': 'const spake2 = require("./spake2");\nconst adb_1 = require("./adb");\n',
    'spake2.js': 'module.exports = {};\n',
    'pont.js': '',
    'fauxTelephone.js': 'const trames_1 = require("./trames");\n',
    'trames.js': '',
  }

  it('suit les require relatifs depuis main.js et preload.js, sans liste figée, et laisse le reste', () => {
    expect(modulesUtiles(lecteur(compile))).toEqual(['adb.js', 'appairage.js', 'main.js', 'pont.js', 'preload.js', 'spake2.js'])
  })

  it('arrête sur un module requis absent, en disant qui le requiert', () => {
    const { 'spake2.js': _absent, ...sans } = compile
    expect(() => modulesUtiles(lecteur(sans))).toThrow(/spake2\.js.*appairage\.js/)
  })

  it('arrête sur un require vers un sous-dossier ou hors du dossier', () => {
    expect(() => modulesUtiles(lecteur({ 'main.js': 'require("./essai/faux")', 'preload.js': '' }))).toThrow(/essai\/faux/)
    expect(() => modulesUtiles(lecteur({ 'main.js': 'require("../outils/x")', 'preload.js': '' }))).toThrow(/\.\.\/outils\/x/)
  })
})

describe('ignorerHorsModules', () => {
  const ignorer = ignorerHorsModules(['main.js', 'preload.js', 'adb.js'])

  it('garde le dossier, package.json et les modules utiles, sous les noms que passe l’outil d’emballage', () => {
    for (const nom of ['', '/package.json', '/main.js', '/preload.js', '/adb.js']) expect(ignorer(nom)).toBe(false)
  })

  it('laisse dehors tout le reste, faux téléphone compris', () => {
    for (const nom of ['/fauxTelephone.js', '/main.js.map', '/essai', '/essai/x.js', '/package-lock.json', 'main.js']) expect(ignorer(nom)).toBe(true)
  })
})

describe('langues du moteur web', () => {
  const electron = ['af', 'ar', 'de', 'en-GB', 'en-US', 'es-419', 'es', 'fr', 'pt-BR', 'zh-TW'].map((l) => `${l}.pak`)

  it('ne garde que fr, en-US (repli de Chromium), en-GB, es et es-419', () => {
    expect(LANGUES_GARDEES).toEqual(['fr', 'en-US', 'en-GB', 'es', 'es-419'])
    expect(languesAOter(electron)).toEqual(['af.pak', 'ar.pak', 'de.pak', 'pt-BR.pak', 'zh-TW.pak'])
  })

  it('ne touche à aucun autre fichier du dossier', () => {
    expect(languesAOter(['LISEZMOI.txt', 'fr.pak', 'it.pak'])).toEqual(['it.pak'])
  })
})

describe('controlerProgramme', () => {
  const utiles = ['adb.js', 'main.js', 'preload.js']
  const propre = {
    ressources: ['app.asar', 'dist', 'Gtracker-0.01.77.apk'],
    langues: ['en-GB.pak', 'en-US.pak', 'es-419.pak', 'es.pak', 'fr.pak'],
    asar: ['\\adb.js', '\\main.js', '\\package.json', '\\preload.js'],
    paquet: { name: 'gtracker', main: 'main.js' },
  }

  it('ne dit rien d’un programme conforme, séparateurs de Windows ou non', () => {
    expect(controlerProgramme(propre, { utiles })).toEqual([])
    expect(controlerProgramme({ ...propre, asar: ['/adb.js', '/main.js', '/package.json', '/preload.js'] }, { utiles })).toEqual([])
    expect(controlerProgramme({ ...propre, paquet: { gtrackerEssai: true } }, { utiles, essai: true })).toEqual([])
  })

  it('relève elevate.exe', () => {
    expect(controlerProgramme({ ...propre, ressources: [...propre.ressources, 'elevate.exe'] }, { utiles })).toEqual([expect.stringMatching(/elevate\.exe/)])
  })

  it('relève une langue de trop ou en moins', () => {
    expect(controlerProgramme({ ...propre, langues: [...propre.langues, 'de.pak'] }, { utiles })).toEqual([expect.stringMatching(/de\.pak/)])
    expect(controlerProgramme({ ...propre, langues: propre.langues.slice(1) }, { utiles })).toEqual([expect.stringMatching(/langues/)])
  })

  it('relève un fichier de trop ou manquant dans l’archive', () => {
    expect(controlerProgramme({ ...propre, asar: [...propre.asar, '\\fauxTelephone.js'] }, { utiles })).toEqual([expect.stringMatching(/en trop : fauxTelephone\.js/)])
    expect(controlerProgramme({ ...propre, asar: propre.asar.slice(1) }, { utiles })).toEqual([expect.stringMatching(/manquants : adb\.js/)])
  })

  it('exige le marqueur d’essai pour le programme d’essai, son absence pour l’installeur', () => {
    expect(controlerProgramme({ ...propre, paquet: { gtrackerEssai: true } }, { utiles })).toEqual([expect.stringMatching(/marqueur d'essai présent/)])
    expect(controlerProgramme({ ...propre, paquet: { gtrackerEssai: false } }, { utiles })).toEqual([expect.stringMatching(/marqueur d'essai présent/)])
    expect(controlerProgramme(propre, { utiles, essai: true })).toEqual([expect.stringMatching(/marqueur d'essai absent/)])
  })
})

describe('sources de la coquille', () => {
  const bureau = join(dirname(fileURLToPath(import.meta.url)), '..', 'bureau')
  /** Imports de valeur (ni `import type`) d'un fichier source, rendus comme les `require` que tsc écrirait. */
  const IMPORT_VALEUR = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]\.\/([^'"]+)['"]/gm
  const lireSource = (nom) => {
    const texte = readFileSync(join(bureau, nom.replace(/\.js$/, '.ts')), 'utf8')
    // Un module produit par la compilation, sans source dans bureau/, n'est pas suivi ici : le contrôle de
    // l'emballage le couvre.
    return [...texte.matchAll(IMPORT_VALEUR)]
      .filter((m) => existsSync(join(bureau, `${m[1]}.ts`)))
      .map((m) => `require("./${m[1]}")`)
      .join('\n')
  }

  it('main.ts et preload.ts chargent tous les fichiers de la coquille, sauf exactement le faux téléphone du banc', () => {
    const utiles = new Set(modulesUtiles(lireSource).map((nom) => nom.replace(/\.js$/, '.ts')))
    const sources = readdirSync(bureau).filter((nom) => nom.endsWith('.ts') && !nom.endsWith('.test.ts') && !nom.endsWith('.d.ts'))
    expect(sources.filter((nom) => !utiles.has(nom))).toEqual(['fauxTelephone.ts'])
  })
})
