import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ErreurDisque, codeDe } from './disque'
import type { EnTete, Message, RaisonTrame, Trame } from './trames'
import {
  DecodeurTrames,
  ErreurTrame,
  LIMITES,
  LIMITES_ACCUEIL,
  TAILLE_BLOC,
  blocsDeLecture,
  encoderMessage,
  encoderTrame,
  lireMessage,
} from './trames'

type Vecteurs = {
  trames: { nom: string; enTete: EnTete; corpsHex: string; octetsHex: string }[]
  tramesInvalides: { nom: string; octetsHex: string; erreur: RaisonTrame }[]
}
const vecteurs = JSON.parse(readFileSync(path.join(__dirname, 'sansFil.vecteurs.json'), 'utf8')) as Vecteurs

const hex = (o: Uint8Array) => Buffer.from(o).toString('hex')
const deHex = (t: string) => Uint8Array.from(Buffer.from(t, 'hex'))
const nonce = 'ab'.repeat(32)

/** Raison de l'erreur levée par `action`, ou `null` si rien n'est levé. */
function raison(action: () => unknown): RaisonTrame | null {
  try {
    action()
    return null
  } catch (e) {
    if (e instanceof ErreurTrame) return e.raison
    throw e
  }
}

const exemples: Message[] = [
  { type: 'appairer', version: 1, nom: 'Pixel 8', nonceTelephone: nonce },
  { type: 'bonjour', version: 1, nom: 'Téléphone de Léa', jeton: 'cd'.repeat(32) },
  { type: 'defi', noncePc: nonce },
  { type: 'preuve', preuve: '01'.repeat(32) },
  { type: 'appaire', preuve: '02'.repeat(32), jeton: '03'.repeat(32), identifiantPc: '04'.repeat(16), nomPc: 'BUREAU' },
  { type: 'bienvenue', identifiantPc: '04'.repeat(16), nomPc: 'BUREAU' },
  { type: 'refus', raison: 'fenetre' },
  { type: 'lister', id: 0 },
  { type: 'lire', id: 2_147_483_647, chemin: 'sessions/2026-11-20 wing.gpx', debut: 3 * TAILLE_BLOC, longueur: TAILLE_BLOC },
  { type: 'ping', id: 5 },
  { type: 'liste', id: 1, fichiers: [{ chemin: 'index.json', taille: 10, dateMs: 1_700_000_000_000 }, { chemin: 'sessions/a.gpx', taille: 0, dateMs: 0 }] },
  { type: 'bloc', id: 3, debut: TAILLE_BLOC, octets: Uint8Array.from([1, 2, 3, 0, 255]) },
  { type: 'pong', id: 5 },
  { type: 'erreur', id: 4, code: 'NOT_FOUND', message: 'Fichier disparu.' },
]

function decoderTout(octets: Uint8Array, taillesMorceaux: (i: number) => number): Trame[] {
  const d = new DecodeurTrames(LIMITES)
  const trames: Trame[] = []
  for (let debut = 0, i = 0; debut < octets.length; i++) {
    const fin = Math.min(octets.length, debut + Math.max(1, taillesMorceaux(i)))
    trames.push(...d.pousser(octets.subarray(debut, fin)))
    debut = fin
  }
  d.fin()
  return trames
}

describe('trames', () => {
  it('chaque message fait l’aller-retour', () => {
    for (const m of exemples) {
      const trames = new DecodeurTrames(LIMITES).pousser(encoderMessage(m))
      expect(trames).toHaveLength(1)
      const lu = lireMessage(trames[0])
      if (m.type === 'bloc' && lu.type === 'bloc') {
        expect({ ...lu, octets: hex(lu.octets) }).toEqual({ ...m, octets: hex(m.octets) })
      } else {
        expect(lu).toEqual(m)
      }
    }
  })

  it('rend les mêmes trames quel que soit le morcellement du flux', () => {
    const flux = Buffer.concat(exemples.map((m) => encoderMessage(m)))
    const attendu = decoderTout(flux, () => flux.length).map((t) => [t.enTete, hex(t.corps)])
    expect(attendu).toHaveLength(exemples.length)
    expect(decoderTout(flux, () => 1).map((t) => [t.enTete, hex(t.corps)])).toEqual(attendu)
    let graine = 7
    const pseudoAlea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) % 23
    expect(decoderTout(flux, pseudoAlea).map((t) => [t.enTete, hex(t.corps)])).toEqual(attendu)
  })

  it('reçoit un bloc de 1 Mio en morceaux de 16 Kio, sans garder de vue sur les morceaux reçus', () => {
    const octets = Uint8Array.from({ length: TAILLE_BLOC }, (_, i) => (i * 31) & 0xff)
    const flux = Buffer.from(encoderMessage({ type: 'bloc', id: 9, debut: 0, octets }))
    const d = new DecodeurTrames(LIMITES)
    const trames: Trame[] = []
    for (let i = 0; i < flux.length; i += 16_384) {
      const morceau = Buffer.from(flux.subarray(i, i + 16_384))
      trames.push(...d.pousser(morceau))
      morceau.fill(0)
    }
    expect(trames).toHaveLength(1)
    const lu = lireMessage(trames[0])
    expect(lu.type === 'bloc' && Buffer.from(lu.octets).equals(Buffer.from(octets))).toBe(true)
    expect(d.enAttente).toBe(0)
  })

  it('refuse à l’encodage une trame trop longue', () => {
    expect(raison(() => encoderMessage({ type: 'bloc', id: 1, debut: 0, octets: new Uint8Array(TAILLE_BLOC + 1) }))).toBe('CORPS_TROP_LONG')
    expect(raison(() => encoderTrame({ type: 'x', remplissage: 'a'.repeat(LIMITES_ACCUEIL.enTete) }, undefined, LIMITES_ACCUEIL))).toBe('EN_TETE_TROP_LONG')
    expect(raison(() => encoderMessage({ type: 'bloc', id: 1, debut: 0, octets: new Uint8Array(1) }, LIMITES_ACCUEIL))).toBe('CORPS_TROP_LONG')
  })

  it('juge les longueurs dès les huit premiers octets, sans attendre la suite', () => {
    const d = new DecodeurTrames(LIMITES_ACCUEIL)
    const trop = encoderTrame({ type: 'x', remplissage: 'a'.repeat(20_000) })
    expect(raison(() => d.pousser(trop.subarray(0, 8)))).toBe('EN_TETE_TROP_LONG')
    expect(raison(() => d.pousser(new Uint8Array(0)))).toBe('EN_TETE_TROP_LONG')
    expect(raison(() => d.fin())).toBe('EN_TETE_TROP_LONG')
  })

  it('prend par défaut les limites de l’accueil : un inconnu ne fait rien réserver de gros', () => {
    expect(new DecodeurTrames().limites).toEqual(LIMITES_ACCUEIL)
    expect(raison(() => new DecodeurTrames().pousser(encoderMessage({ type: 'bloc', id: 1, debut: 0, octets: new Uint8Array(1) })))).toBe('CORPS_TROP_LONG')
    expect(raison(() => new DecodeurTrames().pousser(encoderTrame({ type: 'x', remplissage: 'a'.repeat(20_000) }).subarray(0, 8)))).toBe('EN_TETE_TROP_LONG')
  })

  it('refuse un en-tête précédé d’une marque d’ordre d’octets', () => {
    const json = Buffer.from(JSON.stringify({ type: 'ping', id: 1 }), 'utf8')
    const prefixe = Buffer.alloc(8)
    prefixe.writeUInt32BE(json.length + 3, 0)
    const trame = Buffer.concat([prefixe, Buffer.from([0xef, 0xbb, 0xbf]), json])
    expect(raison(() => new DecodeurTrames().pousser(trame))).toBe('EN_TETE_ILLISIBLE')
  })

  it('élargit ses limites une fois le téléphone présenté', () => {
    const d = new DecodeurTrames(LIMITES_ACCUEIL)
    expect(d.pousser(encoderMessage({ type: 'ping', id: 1 }))).toHaveLength(1)
    d.limites = LIMITES
    expect(d.pousser(encoderMessage({ type: 'bloc', id: 2, debut: 0, octets: new Uint8Array(1000) }))).toHaveLength(1)
  })

  it('signale une trame tronquée à la fin du flux, et rien quand le flux s’arrête entre deux trames', () => {
    const octets = encoderMessage({ type: 'ping', id: 1 })
    const d = new DecodeurTrames()
    expect(d.pousser(octets.subarray(0, 5))).toEqual([])
    expect(d.enAttente).toBe(5)
    expect(raison(() => d.fin())).toBe('TRONQUEE')
    const entier = new DecodeurTrames()
    entier.pousser(octets)
    expect(raison(() => entier.fin())).toBeNull()
  })

  it('lève une erreur du disque de code UNKNOWN, qui passe telle quelle par le pont', () => {
    const e = new ErreurTrame('TRONQUEE', 'coupé')
    expect(e).toBeInstanceOf(ErreurDisque)
    expect(codeDe(e)).toBe('UNKNOWN')
  })
})

describe('lireMessage', () => {
  const lire = (enTete: EnTete, corps = new Uint8Array(0)) => raison(() => lireMessage({ enTete, corps }))

  it('refuse un type inconnu et un message mal formé', () => {
    expect(lire({ type: 'ecrire', id: 1 })).toBe('MESSAGE_INCONNU')
    expect(lire({ type: 'ping' })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'ping', id: -1 })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'ping', id: 1.5 })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'ping', id: 2_147_483_648 })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'ping', id: 1 }, new Uint8Array(1))).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'defi', noncePc: nonce.toUpperCase() })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'defi', noncePc: nonce.slice(2) })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'appairer', version: 1, nom: 'Pixel\n8', nonceTelephone: nonce })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'appairer', version: 1, nom: '', nonceTelephone: nonce })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'appairer', version: 1, nom: 'x'.repeat(101), nonceTelephone: nonce })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'refus', raison: 'autre' })).toBe('MESSAGE_INVALIDE')
  })

  it('ne lit qu’un fichier admis, par bloc de 1 Mio au plus', () => {
    const base = { type: 'lire', id: 1, debut: 0, longueur: 10 }
    expect(lire({ ...base, chemin: 'sessions/a.gpx' })).toBeNull()
    for (const chemin of ['../a.gpx', 'sessions/../a.gpx', 'autre/a.gpx', '/a.gpx', 'sessions/a/b.gpx', 'a.gtracker-tmp', 'sessions\\a.gpx', '']) {
      expect(lire({ ...base, chemin })).toBe('MESSAGE_INVALIDE')
    }
    expect(lire({ ...base, chemin: 'a.gpx', longueur: 0 })).toBe('MESSAGE_INVALIDE')
    expect(lire({ ...base, chemin: 'a.gpx', longueur: TAILLE_BLOC + 1 })).toBe('MESSAGE_INVALIDE')
    expect(lire({ ...base, chemin: 'a.gpx', debut: -1 })).toBe('MESSAGE_INVALIDE')
  })

  it('veut un bloc dont la longueur annoncée est celle du corps', () => {
    expect(lire({ type: 'bloc', id: 1, debut: 0, longueur: 3 }, new Uint8Array(3))).toBeNull()
    expect(lire({ type: 'bloc', id: 1, debut: 0, longueur: 4 }, new Uint8Array(3))).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'bloc', id: 1, debut: 0, longueur: 0 })).toBeNull()
  })

  it('écarte d’une liste les fichiers refusés, comme le câble, et la trie', () => {
    const lu = lireMessage({
      enTete: {
        type: 'liste',
        id: 1,
        fichiers: [
          { chemin: 'sessions/b.gpx', taille: 2, dateMs: 0 },
          { chemin: '../vol.gpx', taille: 1, dateMs: 0 },
          { chemin: 'a.json', taille: -1, dateMs: 0 },
          { chemin: 'a.gpx', taille: 1, dateMs: 0, autre: true },
        ],
      },
      corps: new Uint8Array(0),
    })
    expect(lu).toEqual({ type: 'liste', id: 1, fichiers: [{ chemin: 'a.gpx', taille: 1, dateMs: 0 }, { chemin: 'sessions/b.gpx', taille: 2, dateMs: 0 }] })
    expect(lire({ type: 'liste', id: 1, fichiers: [{ chemin: 'a.gpx', taille: '1', dateMs: 0 }] })).toBe('MESSAGE_INVALIDE')
    expect(lire({ type: 'liste', id: 1, fichiers: {} })).toBe('MESSAGE_INVALIDE')
  })

  it('ramène un code d’erreur inconnu à UNKNOWN et coupe un message trop long', () => {
    expect(lireMessage({ enTete: { type: 'erreur', id: 1, code: 'EIO', message: 'x'.repeat(600) }, corps: new Uint8Array(0) })).toEqual({
      type: 'erreur',
      id: 1,
      code: 'UNKNOWN',
      message: 'x'.repeat(500),
    })
  })
})

describe('blocsDeLecture', () => {
  it('découpe un fichier en blocs de 1 Mio, le dernier plus court', () => {
    expect(blocsDeLecture(0)).toEqual([])
    expect(blocsDeLecture(TAILLE_BLOC)).toEqual([{ debut: 0, longueur: TAILLE_BLOC }])
    expect(blocsDeLecture(2 * TAILLE_BLOC + 5)).toEqual([
      { debut: 0, longueur: TAILLE_BLOC },
      { debut: TAILLE_BLOC, longueur: TAILLE_BLOC },
      { debut: 2 * TAILLE_BLOC, longueur: 5 },
    ])
  })
})

describe('jeux d’essai partagés avec le téléphone', () => {
  it('décode et réencode chaque trame', () => {
    expect(vecteurs.trames.length).toBeGreaterThan(0)
    for (const v of vecteurs.trames) {
      const trames = new DecodeurTrames(LIMITES).pousser(deHex(v.octetsHex))
      expect(trames, v.nom).toHaveLength(1)
      expect(trames[0].enTete, v.nom).toEqual(v.enTete)
      expect(hex(trames[0].corps), v.nom).toBe(v.corpsHex)
      expect(() => lireMessage(trames[0]), v.nom).not.toThrow()
      expect(hex(encoderTrame(v.enTete, deHex(v.corpsHex))), v.nom).toBe(v.octetsHex)
    }
  })

  it('refuse chaque trame invalide avec l’erreur attendue', () => {
    expect(vecteurs.tramesInvalides.map((v) => v.nom)).toContain("en-tête précédé d'une marque d'ordre d'octets")
    for (const v of vecteurs.tramesInvalides) {
      const d = new DecodeurTrames(LIMITES)
      expect(raison(() => (d.pousser(deHex(v.octetsHex)), d.fin())), v.nom).toBe(v.erreur)
    }
  })
})
