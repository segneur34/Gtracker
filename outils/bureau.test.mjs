import { describe, expect, it } from 'vitest'
import { join, resolve } from 'node:path'
import { ID_PROGRAMME, cheminApk, configNsis, environnementPropre, messageApkAbsente, nomApk, nomInstalleur, paquetDeLaCoquille, versionBureau } from './bureau.mjs'

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
