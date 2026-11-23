import { describe, expect, it } from 'vitest'
import { FENETRE_RECHARGES_MS, RECHARGES_MAX, gardeRechargements } from './rechargement'

const MINUTE = 60 * 1000

describe('gardeRechargements', () => {
  it('permet 3 rechargements sur 10 minutes, puis refuse', () => {
    const garde = gardeRechargements()
    expect(RECHARGES_MAX).toBe(3)
    expect(FENETRE_RECHARGES_MS).toBe(10 * MINUTE)
    expect([0, 1, 2, 3].map((m) => garde.autoriser(m * MINUTE))).toEqual([true, true, true, false])
  })

  it('un refus ne compte pas : la place se libère 10 minutes après le premier rechargement', () => {
    const garde = gardeRechargements()
    for (const m of [0, 1, 2]) garde.autoriser(m * MINUTE)
    expect(garde.autoriser(9 * MINUTE)).toBe(false)
    expect(garde.autoriser(10 * MINUTE - 1)).toBe(false)
    expect(garde.autoriser(10 * MINUTE)).toBe(true)
    expect(garde.autoriser(10 * MINUTE + 1)).toBe(false)
    expect(garde.autoriser(11 * MINUTE)).toBe(true)
  })

  it('des chutes espacées se rechargent toujours', () => {
    const garde = gardeRechargements()
    for (let m = 0; m < 60; m += 4) expect(garde.autoriser(m * MINUTE), `${m} min`).toBe(true)
  })

  it('suit le plafond et la fenêtre passés', () => {
    const garde = gardeRechargements(1, 1000)
    expect(garde.autoriser(0)).toBe(true)
    expect(garde.autoriser(999)).toBe(false)
    expect(garde.autoriser(1000)).toBe(true)
  })
})
