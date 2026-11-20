import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { InfoAdresse } from './sonde'
import {
  NOM_PC_MAX_OCTETS,
  adresseDeDiffusion,
  adressePrivee,
  adressesPrivees,
  decoderQuestion,
  decoderReponse,
  encoderQuestion,
  encoderReponse,
  lireIPv4,
  memeReseau,
  nomPcPourSonde,
} from './sonde'

type Vecteurs = {
  sondes: {
    questions: { nonceHex: string; octetsHex: string }[]
    reponses: { nonceHex: string; port: number; identifiantHex: string; nom: string; octetsHex: string }[]
    etrangers: { nom: string; octetsHex: string }[]
  }
}
const { sondes } = (JSON.parse(readFileSync(path.join(__dirname, 'sansFil.vecteurs.json'), 'utf8')) as Vecteurs)

const hex = (o: Uint8Array) => Buffer.from(o).toString('hex')
const deHex = (t: string) => Uint8Array.from(Buffer.from(t, 'hex'))

describe('question et réponse de découverte', () => {
  it('reproduisent les jeux d’essai partagés avec le téléphone', () => {
    for (const v of sondes.questions) {
      expect(hex(encoderQuestion(deHex(v.nonceHex)))).toBe(v.octetsHex)
      expect(hex(decoderQuestion(deHex(v.octetsHex))!.nonce)).toBe(v.nonceHex)
      expect(decoderReponse(deHex(v.octetsHex))).toBeNull()
    }
    for (const v of sondes.reponses) {
      const reponse = { nonce: deHex(v.nonceHex), port: v.port, identifiant: deHex(v.identifiantHex), nom: v.nom }
      expect(hex(encoderReponse(reponse))).toBe(v.octetsHex)
      const lue = decoderReponse(deHex(v.octetsHex))!
      expect({ ...lue, nonce: hex(lue.nonce), identifiant: hex(lue.identifiant) }).toEqual({ ...reponse, nonce: v.nonceHex, identifiant: v.identifiantHex })
      expect(decoderQuestion(deHex(v.octetsHex))).toBeNull()
    }
  })

  it('ignorent un paquet étranger', () => {
    expect(sondes.etrangers.length).toBeGreaterThan(0)
    for (const v of sondes.etrangers) {
      expect(decoderQuestion(deHex(v.octetsHex)), v.nom).toBeNull()
      expect(decoderReponse(deHex(v.octetsHex)), v.nom).toBeNull()
    }
    expect(decoderQuestion(new Uint8Array(0))).toBeNull()
    expect(decoderReponse(Buffer.from('\x00\x00\x01\x00\x00\x01', 'latin1'))).toBeNull()
  })

  it('refusent d’encoder un champ hors bornes', () => {
    const base = { nonce: new Uint8Array(16), port: 48217, identifiant: new Uint8Array(16), nom: 'PC' }
    expect(() => encoderQuestion(new Uint8Array(15))).toThrow()
    expect(() => encoderReponse({ ...base, port: 0 })).toThrow()
    expect(() => encoderReponse({ ...base, port: 65536 })).toThrow()
    expect(() => encoderReponse({ ...base, identifiant: new Uint8Array(8) })).toThrow()
    expect(() => encoderReponse({ ...base, nom: 'é'.repeat(33) })).toThrow()
    expect(() => encoderReponse({ ...base, nom: 'a\tb' })).toThrow()
  })

  it('ramènent le nom du PC à 64 octets sans couper un caractère', () => {
    expect(nomPcPourSonde('BUREAU\u0007-1')).toBe('BUREAU-1')
    const long = nomPcPourSonde('é'.repeat(40))
    expect(long).toBe('é'.repeat(32))
    expect(Buffer.byteLength(nomPcPourSonde('a' + '€'.repeat(30)), 'utf8')).toBeLessThanOrEqual(NOM_PC_MAX_OCTETS)
    expect(nomPcPourSonde('a' + '😀'.repeat(20)).endsWith('😀')).toBe(true)
  })
})

describe('adresses IPv4 privées', () => {
  it('reconnaît les trois plages privées, et elles seules', () => {
    for (const a of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254', '192.168.1.23']) expect(adressePrivee(a), a).toBe(true)
    for (const a of ['172.15.0.1', '172.32.0.1', '192.169.0.1', '169.254.1.1', '100.64.0.1', '127.0.0.1', '8.8.8.8', '11.0.0.1', '192.168.1', '192.168.1.256', 'fe80::1', '']) {
      expect(adressePrivee(a), a).toBe(false)
    }
    expect(lireIPv4('255.255.255.255')).toBe(0xffffffff)
  })

  it('calcule l’adresse de diffusion et le même réseau', () => {
    expect(adresseDeDiffusion('192.168.1.23', '255.255.255.0')).toBe('192.168.1.255')
    expect(adresseDeDiffusion('10.1.2.3', '255.0.0.0')).toBe('10.255.255.255')
    expect(adresseDeDiffusion('172.20.5.9', '255.255.240.0')).toBe('172.20.15.255')
    expect(adresseDeDiffusion('x', '255.0.0.0')).toBeNull()
    expect(memeReseau('192.168.1.23', '192.168.1.200', '255.255.255.0')).toBe(true)
    expect(memeReseau('192.168.1.23', '192.168.2.23', '255.255.255.0')).toBe(false)
  })

  it('trie les adresses du PC : vraies cartes d’abord, 192.168 puis 10 puis 172.16, sans boucle locale ni publique', () => {
    const v4 = (address: string, netmask = '255.255.255.0', internal = false): InfoAdresse => ({ address, netmask, family: 'IPv4', internal })
    const cartes: Record<string, InfoAdresse[] | undefined> = {
      'vEthernet (WSL)': [v4('172.28.0.1', '255.255.240.0')],
      'Wi-Fi': [v4('192.168.1.23'), { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false }],
      Ethernet: [v4('10.0.0.5', '255.0.0.0'), { address: '172.16.4.2', netmask: '255.255.0.0', family: 4, internal: false }],
      'VirtualBox Host-Only Network': [v4('192.168.56.1')],
      'Loopback Pseudo-Interface 1': [v4('127.0.0.1', '255.0.0.0', true)],
      Public: [v4('81.2.3.4')],
      Rien: undefined,
      Double: [v4('192.168.1.23')],
    }
    expect(adressesPrivees(cartes).map((a) => `${a.carte} ${a.adresse} ${a.diffusion}`)).toEqual([
      'Wi-Fi 192.168.1.23 192.168.1.255',
      'Ethernet 10.0.0.5 10.255.255.255',
      'Ethernet 172.16.4.2 172.16.255.255',
      'VirtualBox Host-Only Network 192.168.56.1 192.168.56.255',
      'vEthernet (WSL) 172.28.0.1 172.28.15.255',
    ])
  })
})
