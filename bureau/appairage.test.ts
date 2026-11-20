import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Alea } from './appairage'
import {
  DUREE_FENETRE_MS,
  FenetreAppairage,
  RegistreTelephones,
  TENTATIVES_MAX,
  depuisHex,
  egalATempsConstant,
  enHex,
  hacherJeton,
  preuvePc,
  preuveTelephone,
  tirerCode,
  tirerJeton,
} from './appairage'

type Vecteurs = {
  appairage: { code: string; empreinteHex: string; nonceTelephoneHex: string; noncePcHex: string; preuveTelephoneHex: string; preuvePcHex: string }[]
  jetons: { jetonHex: string; hachageHex: string }[]
}
const vecteurs = JSON.parse(readFileSync(path.join(__dirname, 'sansFil.vecteurs.json'), 'utf8')) as Vecteurs

const deHex = (t: string) => Uint8Array.from(Buffer.from(t, 'hex'))

/** Aléa d'essai : des octets qui se suivent, d'une graine donnée. */
function aleaSuite(graine = 0): Alea {
  let n = graine
  return (taille) => Uint8Array.from({ length: taille }, () => n++ & 0xff)
}

/** Horloge d'essai qu'on avance à la main. */
function horlogeManuelle(depart = 1_000_000) {
  const h = { t: depart, lire: () => h.t }
  return h
}

const empreinte = Uint8Array.from({ length: 32 }, (_, i) => 0xa0 + i)

/** Le téléphone : son nonce, et sa preuve pour un code et un défi donnés. */
function telephone(graine: number) {
  const nonceTelephone = Uint8Array.from({ length: 32 }, (_, i) => (graine + i) & 0xff)
  return { nonceTelephone, prouver: (code: string, noncePc: Uint8Array, emp = empreinte) => preuveTelephone(code, emp, nonceTelephone, noncePc) }
}

function nouvelleFenetre(horloge = horlogeManuelle()) {
  return { horloge, fenetre: new FenetreAppairage({ empreinte, horloge: horloge.lire, alea: aleaSuite(1) }) }
}

/** Un code différent de `code`. */
const autreCode = (code: string) => (code === '000000' ? '000001' : '000000')

describe('code', () => {
  it('tire 6 chiffres sans biais : un tirage de la tranche incomplète est refait', () => {
    const tirages = [Uint8Array.from([0xff, 0xff, 0xff, 0xff]), Uint8Array.from([0, 0, 0, 42])]
    expect(tirerCode(() => tirages.shift()!)).toBe('000042')
    // 4 293 999 999, plus grand tirage admis ; 4 294 000 000 ouvre la tranche incomplète.
    expect(tirerCode(() => Uint8Array.from([0xff, 0xf1, 0x3d, 0x7f]))).toBe('999999')
    const bord = [Uint8Array.from([0xff, 0xf1, 0x3d, 0x80]), Uint8Array.from([0, 0, 0, 7])]
    expect(tirerCode(() => bord.shift()!)).toBe('000007')
    expect(tirerCode()).toMatch(/^\d{6}$/)
  })
})

describe('preuves et jeton', () => {
  it('reproduisent les jeux d’essai partagés avec le téléphone', () => {
    for (const v of vecteurs.appairage) {
      const args = [v.code, deHex(v.empreinteHex), deHex(v.nonceTelephoneHex), deHex(v.noncePcHex)] as const
      expect(enHex(preuveTelephone(...args))).toBe(v.preuveTelephoneHex)
      expect(enHex(preuvePc(...args))).toBe(v.preuvePcHex)
    }
    for (const v of vecteurs.jetons) expect(hacherJeton(deHex(v.jetonHex))).toBe(v.hachageHex)
  })

  it('ne confondent pas la preuve du téléphone et celle du PC, et refusent une entrée mal formée', () => {
    const n = new Uint8Array(32)
    expect(egalATempsConstant(preuveTelephone('123456', empreinte, n, n), preuvePc('123456', empreinte, n, n))).toBe(false)
    expect(() => preuveTelephone('12345', empreinte, n, n)).toThrow()
    expect(() => preuveTelephone('12345a', empreinte, n, n)).toThrow()
    expect(() => preuveTelephone('123456', empreinte.subarray(1), n, n)).toThrow()
    expect(() => hacherJeton(new Uint8Array(31))).toThrow()
  })

  it('compare à temps constant, longueurs différentes comprises', () => {
    expect(egalATempsConstant(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true)
    expect(egalATempsConstant(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false)
    expect(egalATempsConstant(Uint8Array.from([1, 2]), Uint8Array.from([1, 2, 3]))).toBe(false)
    expect(depuisHex('0A', 1)).toBeNull()
    expect([...(depuisHex('0a', 1) ?? [])]).toEqual([10])
  })
})

describe('FenetreAppairage', () => {
  it('appaire au bon code : le téléphone vérifie la preuve du PC et reçoit un jeton, la fenêtre se ferme', () => {
    const { fenetre } = nouvelleFenetre()
    const tel = telephone(0x10)
    const t = fenetre.commencer(tel.nonceTelephone)
    if (!t.ok) throw new Error('tentative refusée')
    const c = t.conclure(tel.prouver(fenetre.code, t.noncePc))
    if (!c.ok) throw new Error('appairage refusé')
    expect(egalATempsConstant(c.preuvePc, preuvePc(fenetre.code, empreinte, tel.nonceTelephone, t.noncePc))).toBe(true)
    expect(c.jeton).toHaveLength(32)
    expect(fenetre.ouverte()).toBe(false)
    expect(fenetre.commencer(telephone(0x30).nonceTelephone)).toEqual({ ok: false, raison: 'fenetre' })
  })

  it('refuse un mauvais code et compte l’échec ; trois échecs ferment la fenêtre', () => {
    const { fenetre } = nouvelleFenetre()
    const faux = autreCode(fenetre.code)
    for (let i = 1; i <= 3; i++) {
      const tel = telephone(i * 40)
      const t = fenetre.commencer(tel.nonceTelephone)
      if (!t.ok) throw new Error('tentative refusée')
      expect(t.conclure(tel.prouver(faux, t.noncePc))).toEqual({ ok: false, raison: 'code', fenetreFermee: i === 3 })
      expect(fenetre.echecs).toBe(i)
    }
    expect(fenetre.ouverte()).toBe(false)
    expect(fenetre.restantMs()).toBe(0)
    expect(fenetre.commencer(telephone(200).nonceTelephone)).toEqual({ ok: false, raison: 'fenetre' })
  })

  it('après trois échecs, même une tentative commencée avant et au bon code échoue', () => {
    const { fenetre } = nouvelleFenetre()
    const bon = telephone(1)
    const enCours = fenetre.commencer(bon.nonceTelephone)
    if (!enCours.ok) throw new Error('tentative refusée')
    for (let i = 0; i < 3; i++) {
      const tel = telephone(50 + i * 40)
      const t = fenetre.commencer(tel.nonceTelephone)
      if (t.ok) t.conclure(tel.prouver(autreCode(fenetre.code), t.noncePc))
    }
    expect(enCours.conclure(bon.prouver(fenetre.code, enCours.noncePc))).toEqual({ ok: false, raison: 'fenetre', fenetreFermee: true })
  })

  it('refuse un nonce rejoué, une preuve rejouée sur un autre défi et une tentative conclue deux fois', () => {
    const { fenetre } = nouvelleFenetre()
    const tel = telephone(7)
    const premiere = fenetre.commencer(tel.nonceTelephone)
    if (!premiere.ok) throw new Error('tentative refusée')
    expect(fenetre.commencer(tel.nonceTelephone)).toEqual({ ok: false, raison: 'nonce' })
    const preuve = tel.prouver(fenetre.code, premiere.noncePc)

    const espion = telephone(99)
    const seconde = fenetre.commencer(espion.nonceTelephone)
    if (!seconde.ok) throw new Error('tentative refusée')
    expect(enHex(seconde.noncePc)).not.toBe(enHex(premiere.noncePc))
    expect(seconde.conclure(preuve)).toMatchObject({ ok: false, raison: 'code' })

    expect(premiere.conclure(tel.prouver(autreCode(fenetre.code), premiere.noncePc))).toMatchObject({ ok: false, raison: 'code' })
    expect(premiere.conclure(preuve)).toMatchObject({ ok: false, raison: 'nonce' })
    expect(fenetre.echecs).toBe(2)
  })

  it('refuse une preuve faite sur le certificat d’un autre (intermédiaire qui relaie)', () => {
    const { fenetre } = nouvelleFenetre()
    const tel = telephone(3)
    const t = fenetre.commencer(tel.nonceTelephone)
    if (!t.ok) throw new Error('tentative refusée')
    const autreEmpreinte = Uint8Array.from({ length: 32 }, () => 0x11)
    expect(t.conclure(tel.prouver(fenetre.code, t.noncePc, autreEmpreinte))).toMatchObject({ ok: false, raison: 'code' })
  })

  it('se ferme d’elle-même au bout de 2 minutes, tentative commencée comprise', () => {
    const { fenetre, horloge } = nouvelleFenetre()
    expect(fenetre.restantMs()).toBe(DUREE_FENETRE_MS)
    const tel = telephone(5)
    const t = fenetre.commencer(tel.nonceTelephone)
    if (!t.ok) throw new Error('tentative refusée')
    horloge.t += DUREE_FENETRE_MS - 1
    expect(fenetre.ouverte()).toBe(true)
    expect(fenetre.restantMs()).toBe(1)
    horloge.t += 1
    expect(fenetre.ouverte()).toBe(false)
    expect(t.conclure(tel.prouver(fenetre.code, t.noncePc))).toEqual({ ok: false, raison: 'fenetre', fenetreFermee: true })
    expect(fenetre.commencer(telephone(80).nonceTelephone)).toEqual({ ok: false, raison: 'fenetre' })
    expect(fenetre.echecs).toBe(0)
  })

  it('commence au plus dix tentatives : la onzième est refusée et ferme la fenêtre', () => {
    const { fenetre } = nouvelleFenetre()
    const enCours: { tel: ReturnType<typeof telephone>; noncePc: Uint8Array; conclure: (p: Uint8Array) => unknown }[] = []
    for (let i = 0; i < TENTATIVES_MAX; i++) {
      const tel = telephone(i * 3)
      const t = fenetre.commencer(tel.nonceTelephone)
      if (!t.ok) throw new Error(`tentative ${i + 1} refusée`)
      enCours.push({ tel, noncePc: t.noncePc, conclure: t.conclure })
    }
    expect(fenetre.tentatives).toBe(TENTATIVES_MAX)
    expect(fenetre.ouverte()).toBe(true)
    expect(fenetre.commencer(telephone(200).nonceTelephone)).toEqual({ ok: false, raison: 'fenetre' })
    expect(fenetre.ouverte()).toBe(false)
    expect(fenetre.tentatives).toBe(TENTATIVES_MAX)
    const premiere = enCours[0]
    expect(premiere.conclure(premiere.tel.prouver(fenetre.code, premiere.noncePc))).toMatchObject({ ok: false, raison: 'fenetre' })
  })

  it('ne compte pas un nonce rejoué comme une tentative', () => {
    const { fenetre } = nouvelleFenetre()
    const tel = telephone(1)
    fenetre.commencer(tel.nonceTelephone)
    for (let i = 0; i < 20; i++) expect(fenetre.commencer(tel.nonceTelephone)).toEqual({ ok: false, raison: 'nonce' })
    expect(fenetre.tentatives).toBe(1)
    expect(fenetre.ouverte()).toBe(true)
  })

  it('se ferme à la demande', () => {
    const { fenetre } = nouvelleFenetre()
    const tel = telephone(9)
    const t = fenetre.commencer(tel.nonceTelephone)
    fenetre.fermer()
    if (!t.ok) throw new Error('tentative refusée')
    expect(t.conclure(tel.prouver(fenetre.code, t.noncePc))).toMatchObject({ ok: false, raison: 'fenetre' })
  })
})

describe('RegistreTelephones', () => {
  const alea = aleaSuite(100)
  const jetonA = tirerJeton(aleaSuite(0))
  const jetonB = tirerJeton(aleaSuite(50))

  it('reconnaît chaque téléphone à son jeton, et plus du tout une fois retiré', () => {
    const r = new RegistreTelephones()
    const a = r.ajouter('Pixel 8', jetonA, 10, alea)
    const b = r.ajouter('Galaxy', jetonB, 20, alea)
    expect(a.id).not.toBe(b.id)
    expect(r.verifier(enHex(jetonA))).toEqual(a)
    expect(r.verifier(enHex(jetonB))).toEqual(b)
    expect(r.verifier(enHex(tirerJeton(aleaSuite(7))))).toBeNull()
    expect(r.verifier('pas un jeton')).toBeNull()
    expect(r.verifier(enHex(jetonA).toUpperCase())).toBeNull()
    expect(r.retirer(a.id)).toBe(true)
    expect(r.retirer(a.id)).toBe(false)
    expect(r.verifier(enHex(jetonA))).toBeNull()
    expect(r.verifier(enHex(jetonB))).toEqual(b)
  })

  it('se relit de son JSON, qui ne garde que le hachage du jeton', () => {
    const r = new RegistreTelephones()
    const a = r.ajouter('Pixel 8', jetonA, 10, alea)
    r.marquerVu(a.id, 99)
    const texte = r.enJson()
    expect(texte).not.toContain(enHex(jetonA))
    expect(texte).toContain(hacherJeton(jetonA))
    const relu = RegistreTelephones.depuisJson(texte)
    expect(relu.liste()).toEqual([{ ...a, vuLe: 99 }])
    expect(relu.liste()[0]).not.toHaveProperty('hachage')
    expect(relu.verifier(enHex(jetonA))?.id).toBe(a.id)
  })

  it('relit un profil abîmé sans tomber : texte illisible vide, entrée mal formée ou en double écartée', () => {
    expect(RegistreTelephones.depuisJson(null).liste()).toEqual([])
    expect(RegistreTelephones.depuisJson('{').liste()).toEqual([])
    expect(RegistreTelephones.depuisJson('[]').liste()).toEqual([])
    const bon = { id: '00'.repeat(16), nom: 'Pixel', hachage: hacherJeton(jetonA), ajouteLe: 1, vuLe: null }
    const texte = JSON.stringify({
      version: 1,
      telephones: [bon, { ...bon, nom: 'Double' }, { ...bon, id: '11'.repeat(16), hachage: 'court' }, { ...bon, id: '22'.repeat(16), nom: '' }, 'texte'],
    })
    expect(RegistreTelephones.depuisJson(texte).liste()).toEqual([{ id: bon.id, nom: 'Pixel', ajouteLe: 1, vuLe: null }])
  })

  it('refuse un nom de téléphone mal formé', () => {
    expect(() => new RegistreTelephones().ajouter('a\u0000b', jetonA, 1, alea)).toThrow()
  })
})
