import { describe, expect, it } from 'vitest'
import { environnementPropre, paquetDeLaCoquille, versionBureau } from './bureau.mjs'

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
