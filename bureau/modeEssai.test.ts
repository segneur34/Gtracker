import { describe, expect, it } from 'vitest'
import { environnementDeLaCoquille, essaiPermis } from './modeEssai'

describe('essaiPermis', () => {
  it('permet le mode d’essai hors emballage, marqueur ou non', () => {
    expect(essaiPermis({ emballe: false, paquet: null })).toBe(true)
    expect(essaiPermis({ emballe: false, paquet: { gtrackerVersion: '0.01.40' } })).toBe(true)
  })

  it('le refuse au programme emballé sans le marqueur d’essai', () => {
    expect(essaiPermis({ emballe: true, paquet: null })).toBe(false)
    expect(essaiPermis({ emballe: true, paquet: { gtrackerVersion: '0.01.40' } })).toBe(false)
    expect(essaiPermis({ emballe: true, paquet: { gtrackerEssai: 'true' } })).toBe(false)
    expect(essaiPermis({ emballe: true, paquet: { gtrackerEssai: 1 } })).toBe(false)
  })

  it('le permet au programme emballé qui porte le marqueur d’essai', () => {
    expect(essaiPermis({ emballe: true, paquet: { gtrackerVersion: '0.01.40', gtrackerEssai: true } })).toBe(true)
  })
})

describe('environnementDeLaCoquille', () => {
  const env = {
    GTRACKER_BANC: '1',
    GTRACKER_PROFIL: 'C:\\essai',
    gtracker_dist: 'C:\\dist',
    Gtracker_Banc_Telephone: 'C:\\tel',
    PATH: 'C:\\Windows',
    OneDrive: 'C:\\OneDrive',
    MON_GTRACKER_A_MOI: 'garde',
  }

  it('rend l’environnement tel quel si le mode d’essai est permis', () => {
    expect(environnementDeLaCoquille(env, true)).toBe(env)
  })

  it('retire toute variable GTRACKER_*, quelle que soit la casse, sans toucher au reste ni à l’original', () => {
    const lu = environnementDeLaCoquille(env, false)
    expect(lu).toEqual({ PATH: 'C:\\Windows', OneDrive: 'C:\\OneDrive', MON_GTRACKER_A_MOI: 'garde' })
    expect(Object.keys(lu).some((nom) => /^gtracker_/i.test(nom))).toBe(false)
    expect(env.GTRACKER_BANC).toBe('1')
  })
})
