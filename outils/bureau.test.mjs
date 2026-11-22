import { describe, expect, it } from 'vitest'
import { join, resolve } from 'node:path'
import {
  ATTENTE_FERMETURE_S,
  ATTENTE_FORCE_S,
  FICHIER_INCLUS_NSIS,
  ID_PROGRAMME,
  LONGUEUR_MAX_NSIS,
  MESSAGE_NON_FERME,
  cheminApk,
  configNsis,
  environnementPropre,
  inclusNsis,
  messageApkAbsente,
  nomApk,
  octetsInclusNsis,
  nomInstalleur,
  paquetDeLaCoquille,
  scriptFermeture,
  versionBureau,
} from './bureau.mjs'

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
})

describe('environnementPropre', () => {
  it('retire ELECTRON_RUN_AS_NODE, quelle que soit sa casse, sans toucher au reste', () => {
    const env = { ELECTRON_RUN_AS_NODE: '1', Electron_Run_As_Node: '1', GTRACKER_BANC: '1' }
    expect(environnementPropre(env)).toEqual({ GTRACKER_BANC: '1' })
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  })
})
