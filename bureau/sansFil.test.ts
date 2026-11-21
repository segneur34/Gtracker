import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enHex } from './appairage'
import { fabriquerCertificat } from './certificat'
import { estTemporaire } from './disque'
import { FauxTelephone, RefusPc, sonder } from './fauxTelephone'
import type { Reponse } from './pont'
import type { AvisArrivee, Chiffreur, OptionsSansFil } from './sansFil'
import {
  CANAUX_SANS_FIL,
  FICHIER_CLE,
  FICHIER_REGLAGES,
  FICHIER_TELEPHONES,
  Liaison,
  ServeurSansFil,
  dossierSansFilPuisCable,
  essaiSansFilDepuisEnvironnement,
  gestionnairesSansFil,
  stockageDossier,
} from './sansFil'
import { dossierLocal, gestionnairesTelephone } from './telephone'
import type { Commande, Message } from './trames'
import { TAILLE_BLOC, encoderMessage, encoderTrame } from './trames'

let tmp: string
/** Secrets du sans-fil, dans le profil du PC d'essai. */
let secrets: string
/** Dossier qui joue `Documents/Gtracker` du téléphone. */
let telephone: string
/** Dossier temporaire des lectures, côté PC. */
let lectures: string
const serveurs: ServeurSansFil[] = []

/** Chiffrement d'essai : réversible, mais la clé n'apparaît pas en clair dans le fichier. */
const chiffreur: Chiffreur = {
  disponible: async () => true,
  chiffrer: async (texte) => Buffer.from(`essai:${Buffer.from(texte, 'utf8').toString('base64')}`, 'utf8'),
  dechiffrer: async (octets) => Buffer.from(Buffer.from(octets).toString('utf8').replace(/^essai:/, ''), 'base64').toString('utf8'),
}

function serveur(options: Partial<OptionsSansFil> = {}): ServeurSansFil {
  const s = new ServeurSansFil({
    stockage: stockageDossier(secrets),
    chiffreur,
    adresses: () => [{ adresse: '127.0.0.1', masque: '255.0.0.0' }],
    port: 0,
    portSonde: null,
    nomPc: 'PC de test',
    ...options,
  })
  serveurs.push(s)
  return s
}

const faux = (options: Partial<ConstructorParameters<typeof FauxTelephone>[0]> = {}) => new FauxTelephone({ dossier: telephone, delaiMs: 5_000, ...options })

const attendre = (ms: number) => new Promise((fin) => setTimeout(fin, ms))

/** Attend qu'une condition devienne vraie, dix secondes au plus (le poste peut être chargé ; rien n'est perdu si elle vient vite). */
async function quand(condition: () => boolean | Promise<boolean>): Promise<void> {
  const fin = Date.now() + 10_000
  while (Date.now() < fin) {
    if (await condition()) return
    await attendre(10)
  }
  throw new Error('condition jamais remplie')
}

/** Une connexion TLS qui n'a rien d'un téléphone, poignée faite. */
function connexionBrute(port: number): Promise<tls.TLSSocket> {
  return new Promise((resoudre, rejeter) => {
    const socket = tls.connect({ host: '127.0.0.1', port, rejectUnauthorized: false })
    socket.once('error', rejeter)
    socket.once('secureConnect', () => resoudre(socket))
  })
}

/** Vrai si la socket est fermée par l'autre bout dans les `ms` données. */
function fermeeDans(socket: net.Socket, ms: number): Promise<boolean> {
  if (socket.closed) return Promise.resolve(true)
  return new Promise((resoudre) => {
    const minuteur = setTimeout(() => resoudre(false), ms)
    socket.on('error', () => undefined)
    socket.once('close', () => {
      clearTimeout(minuteur)
      resoudre(true)
    })
    socket.resume()
  })
}

/** Appaire un faux téléphone au serveur, qui doit être activé. */
async function appairer(s: ServeurSansFil, f = faux()) {
  const { adresse, port, code } = await s.ouvrirAppairage()
  const liaison = await f.appairer(adresse, port, code)
  return { f, liaison }
}

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'gtk-sansfil-'))
  secrets = path.join(tmp, 'profil', 'sansfil')
  telephone = path.join(tmp, 'telephone', 'Documents', 'Gtracker')
  lectures = path.join(tmp, 'profil', 'telephone-lecture')
  await mkdir(path.join(telephone, 'sessions'), { recursive: true })
  await writeFile(path.join(telephone, 'index.json'), '{"sessions":[]}')
  await writeFile(path.join(telephone, 'sessions', 'a.gpx'), '<gpx/>')
  await writeFile(path.join(telephone, 'sessions', 'b.gpx.gtracker-new'), 'en cours')
})

afterEach(async () => {
  await Promise.all(serveurs.splice(0).map((s) => s.arreter()))
  await rm(tmp, { recursive: true, force: true })
})

describe('serveur sans fil', () => {
  it('reste éteint, sans rien écrire ni écouter, tant que le sans-fil n’est pas activé', async () => {
    const s = serveur({ portSonde: 0, hoteSonde: '127.0.0.1' })
    await s.demarrer()
    expect(await s.etat()).toMatchObject({ actif: false, ecoute: false, port: null, appairage: null, relies: [] })
    expect(s.portDecouverte()).toBeNull()
    await expect(s.ouvrirAppairage()).rejects.toThrow(/éteint/)
    await expect(readdir(secrets)).rejects.toThrow()
  })

  it('activé, écoute, retient le choix, et reprend au lancement suivant avec le même certificat', async () => {
    const s = serveur()
    const etat = await s.activer(true)
    expect(etat).toMatchObject({ actif: true, ecoute: true, adresses: ['127.0.0.1'], pareFeu: 'ouvert', erreur: null })
    expect(etat.port).toBeGreaterThan(0)
    const { f } = await appairer(s)
    await s.arreter()
    // La clé n'est jamais en clair dans le profil.
    expect((await readFile(path.join(secrets, FICHIER_CLE), 'utf8')).includes('PRIVATE KEY')).toBe(false)
    expect(JSON.parse(await readFile(path.join(secrets, FICHIER_REGLAGES), 'utf8'))).toMatchObject({ version: 1, actif: true })

    const relance = serveur()
    await relance.demarrer()
    const port = (await relance.etat()).port as number
    expect(port).toBeGreaterThan(0)
    const liaison = await f.connecter('127.0.0.1', port)
    await quand(async () => (await relance.etat()).relies.length === 1)
    liaison.fermer()

    await relance.activer(false)
    expect(await relance.etat()).toMatchObject({ actif: false, ecoute: false })
    expect(JSON.parse(await readFile(path.join(secrets, FICHIER_REGLAGES), 'utf8'))).toMatchObject({ actif: false })
    await expect(f.connecter('127.0.0.1', port)).rejects.toThrow()
  })

  it('appaire un téléphone par le code, l’inscrit, l’annonce, puis le lit comme le câble', async () => {
    const avis: AvisArrivee[] = []
    const s = serveur({ surArrivee: (a) => avis.push(a) })
    await s.activer(true)
    const ouvert = await s.ouvrirAppairage()
    expect(ouvert).toMatchObject({ adresse: '127.0.0.1', port: (await s.etat()).port })
    expect(ouvert.code).toMatch(/^\d{6}$/)
    expect(ouvert.restantMs).toBeGreaterThan(100_000)
    expect((await s.etat()).appairage).toMatchObject({ code: ouvert.code })
    const f = faux()
    await f.appairer(ouvert.adresse, ouvert.port, ouvert.code)
    expect(f.memoire).toMatchObject({ nomPc: 'PC de test', adresse: '127.0.0.1' })
    await quand(() => avis.length === 1)
    const telephones = await s.telephones()
    expect(telephones).toEqual([expect.objectContaining({ nom: "Téléphone d'essai", relie: true, vuLe: null })])
    expect(avis).toEqual([{ id: telephones[0].id, nom: "Téléphone d'essai", nouveau: true }])
    // La fenêtre se ferme après un appairage réussi ; le registre ne garde que le hachage du jeton.
    expect((await s.etat()).appairage).toBeNull()
    const registre = await readFile(path.join(secrets, FICHIER_TELEPHONES), 'utf8')
    expect(registre).not.toContain(f.memoire!.jeton)

    const dossier = s.dossierSansFil()
    expect(await dossier.etat()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false })
    const canaux = gestionnairesTelephone(dossier, lectures)
    const liste = (await canaux['telephone:lister'](undefined)) as Reponse<{ chemin: string; taille: number }[]>
    expect(liste.ok && liste.valeur.map((x) => [x.chemin, x.taille])).toEqual([['index.json', 15], ['sessions/a.gpx', 6]])
    const octets = (await canaux['telephone:lireOctets']({ chemin: 'sessions/a.gpx' })) as Reponse<Uint8Array>
    expect(octets.ok && Buffer.from(octets.valeur).toString()).toBe('<gpx/>')

    // Au retour, le téléphone se présente par son jeton.
    await quand(async () => (await s.telephones()).length === 1)
    const retour = await f.connecter()
    await quand(() => avis.length === 2)
    expect(avis[1]).toMatchObject({ nouveau: false })
    expect((await s.telephones())[0].vuLe).not.toBeNull()
    retour.fermer()
    await quand(async () => (await dossier.etat()).etat === 'absent')
  })

  it('refuse un appairage hors fenêtre, après expiration, et sur un mauvais code', async () => {
    let decalage = 0
    const s = serveur({ horloge: () => Date.now() + decalage })
    await s.activer(true)
    const port = (await s.etat()).port as number
    await expect(faux().appairer('127.0.0.1', port, '123456')).rejects.toMatchObject({ raison: 'fenetre' })

    const { code } = await s.ouvrirAppairage()
    decalage = 121_000
    await expect(faux().appairer('127.0.0.1', port, code)).rejects.toMatchObject({ raison: 'fenetre' })
    expect((await s.etat()).appairage).toBeNull()

    decalage = 0
    const ouvert = await s.ouvrirAppairage()
    const faux1 = ouvert.code === '000000' ? '000001' : '000000'
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toBeInstanceOf(RefusPc)
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toMatchObject({ raison: 'code' })
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toMatchObject({ raison: 'code' })
    // Trois échecs ferment la fenêtre : même le bon code ne passe plus.
    await expect(faux().appairer('127.0.0.1', port, ouvert.code)).rejects.toMatchObject({ raison: 'fenetre' })
    expect(await s.telephones()).toEqual([])
  })

  it('refuse un jeton révoqué et coupe la liaison du téléphone retiré', async () => {
    const s = serveur()
    await s.activer(true)
    const { f, liaison } = await appairer(s)
    const [{ id }] = await s.telephones()
    expect(await s.retirer(id)).toBe(true)
    expect(await liaison.fermee).toBeTruthy()
    expect(await s.retirer(id)).toBe(false)
    await expect(f.connecter()).rejects.toMatchObject({ raison: 'jeton' })
    expect((await s.etat()).relies).toEqual([])
  })

  it('lit un gros fichier par blocs, à l’octet près', async () => {
    const gros = randomBytes(2 * TAILLE_BLOC + 12_345)
    await writeFile(path.join(telephone, 'sessions', 'capteurs.bin'), gros)
    const s = serveur()
    await s.activer(true)
    const { f } = await appairer(s)
    const canaux = gestionnairesTelephone(s.dossierSansFil(), lectures)
    await canaux['telephone:lister'](undefined)
    const lu = (await canaux['telephone:lireOctets']({ chemin: 'sessions/capteurs.bin' })) as Reponse<Uint8Array>
    expect(lu.ok).toBe(true)
    expect(lu.ok && Buffer.from(lu.valeur).equals(gros)).toBe(true)
    expect(f.blocsEnvoyes).toBe(3)
    expect(await readdir(lectures)).toEqual([])
  })

  it('une coupure en pleine lecture échoue sans rien laisser dans le dossier temporaire', async () => {
    await writeFile(path.join(telephone, 'sessions', 'capteurs.bin'), randomBytes(3 * TAILLE_BLOC))
    const s = serveur()
    await s.activer(true)
    await appairer(s, faux({ coupureApresBlocs: 1 }))
    const dossier = s.dossierSansFil()
    const canaux = gestionnairesTelephone(dossier, lectures)
    await canaux['telephone:lister'](undefined)
    const lu = await canaux['telephone:lireOctets']({ chemin: 'sessions/capteurs.bin' })
    expect(lu).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await readdir(lectures)).toEqual([])
    await quand(async () => (await dossier.etat()).etat === 'absent')
  })

  it('un téléphone muet est lâché après le délai d’une commande', async () => {
    const s = serveur({ delais: { commande: 200 } })
    await s.activer(true)
    const { liaison } = await appairer(s)
    // Le faux téléphone ne répond plus : il n'écoute plus ses messages.
    liaison.liaison.servir(() => undefined)
    await expect(s.dossierSansFil().lister()).rejects.toThrow(/délai/)
    await quand(async () => (await s.etat()).relies.length === 0)
  })

  it('prend le port suivant quand le premier est pris', async () => {
    const occupant = net.createServer()
    await new Promise<void>((fin) => occupant.listen({ host: '127.0.0.1', port: 0 }, () => fin()))
    const pris = (occupant.address() as net.AddressInfo).port
    try {
      const s = serveur({ port: pris })
      const etat = await s.activer(true)
      expect(etat.port).toBeGreaterThan(pris)
      expect(etat.port).toBeLessThan(pris + 10)
    } finally {
      await new Promise((fin) => occupant.close(fin))
    }
  })

  it('n’écoute nulle part sans adresse privée, et le dit', async () => {
    const s = serveur({ adresses: () => [] })
    expect(await s.activer(true)).toMatchObject({ actif: true, ecoute: false, port: null, erreur: expect.stringMatching(/réseau local/) })
    await expect(s.ouvrirAppairage()).rejects.toThrow(/réseau local/)
  })

  it('répond à la découverte par son port et son identifiant', async () => {
    const s = serveur({ portSonde: 0, hoteSonde: '127.0.0.1' })
    await s.activer(true)
    const portSonde = s.portDecouverte() as number
    expect(portSonde).toBeGreaterThan(0)
    const trouve = await sonder('127.0.0.1', portSonde, 2_000)
    expect(trouve).toMatchObject({ adresse: '127.0.0.1', port: (await s.etat()).port, nom: 'PC de test' })
    const { f } = await appairer(s)
    expect(trouve?.identifiantPc).toBe(f.memoire?.identifiantPc)
  })
})

describe('inconnus et téléphones hostiles', () => {
  it('ferme une liaison dont le premier message n’est pas une présentation, ou dont l’en-tête dépasse 16 Kio', async () => {
    const s = serveur()
    const port = (await s.activer(true)).port as number
    const essais = [
      encoderMessage({ type: 'lister', id: 1 }),
      encoderMessage({ type: 'bienvenue', identifiantPc: '0'.repeat(32), nomPc: 'PC' }),
      encoderTrame({ type: 'bonjour', bourrage: 'a'.repeat(20_000) }),
    ]
    for (const octets of essais) {
      const socket = await connexionBrute(port)
      socket.write(octets)
      expect(await fermeeDans(socket, 5_000)).toBe(true)
    }
    expect((await s.etat()).relies).toEqual([])
  })

  it('coupe aussitôt la neuvième connexion inconnue', async () => {
    const s = serveur()
    const port = (await s.activer(true)).port as number
    const huit = await Promise.all(Array.from({ length: 8 }, () => connexionBrute(port)))
    try {
      await attendre(200)
      const neuvieme = await connexionBrute(port)
      expect(await fermeeDans(neuvieme, 3_000)).toBe(true)
      expect(huit.every((socket) => !socket.closed)).toBe(true)
    } finally {
      for (const socket of huit) socket.destroy()
    }
  })

  it('refuse une réponse fausse à une lecture, sans rien laisser dans le dossier temporaire', async () => {
    const cas: { nom: string; falsifier: (c: Commande) => Message | undefined; chemin: string; motif: RegExp }[] = [
      { nom: 'liste au lieu de bloc', falsifier: (c) => (c.type === 'lire' ? { type: 'liste', id: c.id, fichiers: [] } : undefined), chemin: 'sessions/a.gpx', motif: /inattendue/ },
      {
        nom: 'bloc au mauvais début',
        falsifier: (c) => (c.type === 'lire' ? { type: 'bloc', id: c.id, debut: c.debut + 1, octets: Buffer.from('<gpx/>') } : undefined),
        chemin: 'sessions/a.gpx',
        motif: /début/,
      },
      {
        nom: 'bloc trop long',
        falsifier: (c) => (c.type === 'lire' ? { type: 'bloc', id: c.id, debut: c.debut, octets: Buffer.from('<gpx/>!') } : undefined),
        chemin: 'sessions/a.gpx',
        motif: /taille/,
      },
      {
        nom: 'taille démesurée',
        falsifier: (c) => (c.type === 'lister' ? { type: 'liste', id: c.id, fichiers: [{ chemin: 'sessions/x.gpx', taille: 9e15, dateMs: 0 }] } : undefined),
        chemin: 'sessions/x.gpx',
        motif: /trop gros/,
      },
    ]
    const s = serveur()
    await s.activer(true)
    for (const { nom, falsifier, chemin, motif } of cas) {
      const { f, liaison } = await appairer(s, faux({ falsifier }))
      const canaux = gestionnairesTelephone(s.dossierSansFil(), lectures)
      expect((await canaux['telephone:lister'](undefined)).ok, nom).toBe(true)
      const lu = await canaux['telephone:lireOctets']({ chemin })
      expect(lu, nom).toMatchObject({ ok: false, message: expect.stringMatching(motif) })
      expect(await readdir(lectures), nom).toEqual([])
      // La taille démesurée est refusée avant toute commande de lecture.
      if (nom === 'taille démesurée') expect(f.commandesRecues).toBe(1)
      liaison.fermer()
    }
  })

  it('refuse un téléphone retiré pendant qu’il se présente, et ne le remet pas dans le registre', async () => {
    const base = stockageDossier(secrets)
    let retenir: Promise<void> | null = null
    let retenue = false
    const s = serveur({
      stockage: {
        lire: base.lire,
        ecrire: async (nom, octets) => {
          const r = retenir
          if (nom === FICHIER_TELEPHONES && r) {
            retenir = null
            retenue = true
            await r
          }
          return base.ecrire(nom, octets)
        },
      },
    })
    await s.activer(true)
    const { f, liaison } = await appairer(s)
    liaison.fermer()
    const [{ id }] = await s.telephones()
    let liberer: () => void = () => undefined
    retenir = new Promise<void>((fin) => (liberer = fin))
    // L'issue est captée tout de suite : le refus peut arriver avant qu'on l'attende.
    const connexion = f.connecter().then(
      () => null,
      (e: unknown) => e,
    )
    await quand(() => retenue)
    const retrait = s.retirer(id)
    await attendre(50)
    liberer()
    expect(await retrait).toBe(true)
    expect(await connexion).toMatchObject({ raison: 'jeton' })
    expect((await s.etat()).relies).toEqual([])
    expect(await s.dossierSansFil().etat()).toEqual({ etat: 'absent' })
    expect(JSON.parse(await readFile(path.join(secrets, FICHIER_TELEPHONES), 'utf8')).telephones).toEqual([])
  })

  it('l’extinction coupe aussitôt une poignée TLS en cours', async () => {
    const s = serveur()
    const port = (await s.activer(true)).port as number
    const socket = net.connect({ host: '127.0.0.1', port })
    await new Promise((fin) => socket.once('connect', fin))
    const debut = Date.now()
    await s.activer(false)
    expect(Date.now() - debut).toBeLessThan(3_000)
    expect(await fermeeDans(socket, 3_000)).toBe(true)
  })

  it('une adresse disparue coupe la liaison qui y passait sans bloquer le serveur', async () => {
    let adresses = [{ adresse: '127.0.0.1', masque: '255.0.0.0' }]
    const s = serveur({ adresses: () => adresses })
    await s.activer(true)
    const { liaison } = await appairer(s)
    adresses = []
    const debut = Date.now()
    expect(await s.etat()).toMatchObject({ actif: true, ecoute: false })
    expect(Date.now() - debut).toBeLessThan(3_000)
    expect(await liaison.fermee).toBeTruthy()
    await quand(async () => (await s.etat()).relies.length === 0)
  })
})

describe('le Wi-Fi d’abord, sinon le câble', () => {
  it('lit le câble tant qu’aucun téléphone n’est relié, puis le Wi-Fi', async () => {
    const s = serveur()
    await s.activer(true)
    // Le câble : un autre dossier, qui joue le téléphone branché.
    const stockageCable = path.join(tmp, 'cable')
    await mkdir(path.join(stockageCable, 'Documents', 'Gtracker'), { recursive: true })
    await writeFile(path.join(stockageCable, 'Documents', 'Gtracker', 'cable.json'), '{}')
    const dossier = dossierSansFilPuisCable(s.dossierSansFil(), dossierLocal(stockageCable))
    expect(await dossier.etat()).toMatchObject({ etat: 'pret', canal: 'cable', ecriture: true })
    expect((await dossier.lister()).map((x) => x.chemin)).toEqual(['cable.json'])
    const local = path.join(tmp, 'envoi')
    await writeFile(local, 'x')
    expect(await dossier.ecrire!('sessions/b.gpx', local, 1)).toMatchObject({ chemin: 'sessions/b.gpx', taille: 1 })

    // Un téléphone ancien relié par le Wi-Fi : lu, jamais écrit, et jamais de repli sur le câble.
    const ancien = await appairer(s, faux({ ancien: true }))
    expect(await dossier.etat()).toMatchObject({ etat: 'pret', canal: 'sansFil', ecriture: false, itineraires: false })
    expect((await dossier.lister()).map((x) => x.chemin)).toEqual(['index.json', 'sessions/a.gpx'])
    await expect(dossier.ecrire!('sessions/c.gpx', local, 1)).rejects.toThrow('ne sait pas écrire')
    await expect(dossier.effacer!('sessions/b.gpx')).rejects.toThrow('ne sait pas écrire')
    expect(existsSync(path.join(stockageCable, 'Documents', 'Gtracker', 'sessions', 'b.gpx'))).toBe(true)
    expect(existsSync(path.join(stockageCable, 'Documents', 'Gtracker', 'sessions', 'c.gpx'))).toBe(false)
    ancien.liaison.fermer()
    await quand(async () => (await dossier.etat()).canal === 'cable')

    // Un téléphone à jour : écritures et effacements vont à lui, le câble n'est pas touché.
    const { liaison } = await appairer(s)
    expect(await dossier.etat()).toMatchObject({ etat: 'pret', canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false })
    expect((await dossier.lister()).map((x) => x.chemin)).toEqual(['index.json', 'sessions/a.gpx'])
    expect(await dossier.ecrire!('sessions/c.gpx', local, 1)).toMatchObject({ chemin: 'sessions/c.gpx', taille: 1 })
    await dossier.effacer!('sessions/a.gpx')
    expect(existsSync(path.join(telephone, 'sessions', 'c.gpx'))).toBe(true)
    expect(existsSync(path.join(telephone, 'sessions', 'a.gpx'))).toBe(false)
    expect(existsSync(path.join(stockageCable, 'Documents', 'Gtracker', 'sessions', 'c.gpx'))).toBe(false)

    liaison.fermer()
    await quand(async () => (await dossier.etat()).canal === 'cable')
    expect(await dossierSansFilPuisCable(s.dossierSansFil(), dossierLocal(null)).etat()).toEqual({ etat: 'absent' })
  })
})

/** Le dossier sans fil d'un serveur activé, relié à un faux téléphone, listé par les canaux de la page. */
async function relieEtListe(options: Partial<ConstructorParameters<typeof FauxTelephone>[0]> = {}) {
  const s = serveur()
  await s.activer(true)
  const { f, liaison } = await appairer(s, faux(options))
  const dossier = s.dossierSansFil()
  const canaux = gestionnairesTelephone(dossier, lectures)
  const liste = (await canaux['telephone:lister'](undefined)) as Reponse<{ chemin: string }[]>
  if (!liste.ok) throw new Error('listage manqué')
  return { s, f, liaison, dossier, canaux, chemins: liste.valeur.map((x) => x.chemin) }
}

/** Provisoires présents dans `sessions/` du téléphone. */
const provisoires = async () => (await readdir(path.join(telephone, 'sessions'))).filter(estTemporaire)

const texte = (s: string) => new TextEncoder().encode(s)

/** Un fichier local à envoyer. */
async function aEnvoyer(contenu: string): Promise<string> {
  const local = path.join(tmp, 'envoi')
  await writeFile(local, contenu)
  return local
}

describe('écriture sans fil', () => {
  it('écrit un fichier neuf, en remplace un, en efface un, sans laisser de provisoire', async () => {
    const { dossier, canaux } = await relieEtListe()
    expect(await dossier.etat()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false })
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'sessions/neuf.gpx', octets: texte('<gpx>neuf</gpx>') })).toMatchObject({
      ok: true,
      valeur: { chemin: 'sessions/neuf.gpx', taille: 15 },
    })
    expect(await readFile(path.join(telephone, 'sessions', 'neuf.gpx'), 'utf8')).toBe('<gpx>neuf</gpx>')
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'sessions/a.gpx', octets: texte('<gpx>remplacé</gpx>') })).toMatchObject({ ok: true })
    expect(await readFile(path.join(telephone, 'sessions', 'a.gpx'), 'utf8')).toBe('<gpx>remplacé</gpx>')
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'itineraires/r.json', octets: texte('{}') })).toMatchObject({ ok: true })
    expect(await canaux['telephone:effacer']({ chemin: 'sessions/neuf.gpx' })).toEqual({ ok: true, valeur: null })
    expect(existsSync(path.join(telephone, 'sessions', 'neuf.gpx'))).toBe(false)
    expect(await provisoires()).toEqual([])
    expect(await readdir(lectures)).toEqual([])
    const relu = (await canaux['telephone:lister'](undefined)) as Reponse<{ chemin: string; taille: number }[]>
    expect(relu.ok && relu.valeur.map((x) => [x.chemin, x.taille])).toEqual([
      ['index.json', 15],
      ['itineraires/r.json', 2],
      ['sessions/a.gpx', 20],
    ])
  })

  it('termine au listage les échanges interrompus, comme le téléphone', async () => {
    await writeFile(path.join(telephone, 'sessions', 'c.gpx.gtracker-tmp'), 'complet')
    await writeFile(path.join(telephone, 'sessions', 'a.gpx.gtracker-tmp'), 'à moitié')
    await mkdir(path.join(telephone, 'reglages'))
    await writeFile(path.join(telephone, 'reglages', 'pc.json'), '{}')
    const { chemins } = await relieEtListe()
    expect(chemins).toEqual(['index.json', 'reglages/pc.json', 'sessions/a.gpx', 'sessions/c.gpx'])
    expect(await readFile(path.join(telephone, 'sessions', 'a.gpx'), 'utf8')).toBe('<gpx/>')
    expect(await readFile(path.join(telephone, 'sessions', 'c.gpx'), 'utf8')).toBe('complet')
    expect(await provisoires()).toEqual([])
  })

  it('écrit un gros fichier par blocs, à l’octet près, et un fichier vide', async () => {
    const gros = randomBytes(2 * TAILLE_BLOC + 12_345)
    const { f, canaux } = await relieEtListe()
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'sessions/capteurs.bin', octets: gros })).toMatchObject({ ok: true, valeur: { taille: gros.length } })
    expect((await readFile(path.join(telephone, 'sessions', 'capteurs.bin'))).equals(gros)).toBe(true)
    expect(f.blocsEcrits).toBe(3)
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'reglages/vide.json', octets: new Uint8Array(0) })).toMatchObject({ ok: true, valeur: { taille: 0 } })
    expect(await readFile(path.join(telephone, 'reglages', 'vide.json'), 'utf8')).toBe('')
    expect(f.blocsEcrits).toBe(4)
    expect(await provisoires()).toEqual([])
  })

  it('refuse un chemin hors de la liste blanche et une taille fausse sans rien envoyer', async () => {
    const { f, dossier } = await relieEtListe()
    const local = await aEnvoyer('x')
    const avant = f.commandesRecues
    await expect(dossier.ecrire!('index.json', local, 1)).rejects.toMatchObject({ code: 'PERMISSION' })
    await expect(dossier.ecrire!('sessions/../x.gpx', local, 1)).rejects.toMatchObject({ code: 'PERMISSION' })
    await expect(dossier.effacer!('autre/x.gpx')).rejects.toMatchObject({ code: 'PERMISSION' })
    await expect(dossier.ecrire!('sessions/x.gpx', local, 5)).rejects.toThrow(/annoncés/)
    expect(f.commandesRecues).toBe(avant)
    expect(existsSync(path.join(telephone, 'sessions', 'x.gpx'))).toBe(false)
  })

  it('une coupure en pleine écriture laisse l’original intact et aucun provisoire', async () => {
    const { canaux, liaison, dossier } = await relieEtListe({ coupureApresEcritures: 1 })
    const ecrit = await canaux['telephone:ecrireOctets']({ chemin: 'sessions/a.gpx', octets: randomBytes(3 * TAILLE_BLOC) })
    expect(ecrit).toMatchObject({ ok: false, code: 'UNKNOWN' })
    await liaison.fermee
    expect(await readFile(path.join(telephone, 'sessions', 'a.gpx'), 'utf8')).toBe('<gpx/>')
    expect(await provisoires()).toEqual([])
    expect(await readdir(lectures)).toEqual([])
    await quand(async () => (await dossier.etat()).etat === 'absent')
  })

  it('un téléphone ancien est lu sans rien recevoir d’autre que des lectures', async () => {
    await mkdir(path.join(telephone, 'itineraires'))
    await writeFile(path.join(telephone, 'itineraires', 'r.json'), '{}')
    const { f, liaison, dossier, chemins } = await relieEtListe({ ancien: true })
    expect(chemins).toEqual(['index.json', 'sessions/a.gpx'])
    expect(await dossier.etat()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", canal: 'sansFil', ecriture: false, itineraires: false })
    const local = await aEnvoyer('x')
    const avant = f.commandesRecues
    await expect(dossier.ecrire!('sessions/c.gpx', local, 1)).rejects.toThrow('ne sait pas écrire')
    await expect(dossier.effacer!('sessions/a.gpx')).rejects.toThrow('ne sait pas écrire')
    expect(f.commandesRecues).toBe(avant)
    expect(liaison.liaison.fermee).toBe(false)
    // Rien n'a été touché dans son dossier, pas même le provisoire resté là.
    expect(await provisoires()).toEqual(['b.gpx.gtracker-new'])
  })

  it('un téléphone qui enregistre refuse d’être modifié, et le PC ne lui envoie rien', async () => {
    const { s, f, dossier, canaux } = await relieEtListe({ enregistre: true })
    expect(await dossier.etat()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", canal: 'sansFil', ecriture: false, itineraires: true, enregistrement: true })
    // Même commandé, le téléphone refuse.
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'sessions/c.gpx', octets: texte('x') })).toMatchObject({ ok: false, code: 'PERMISSION' })
    expect(await canaux['telephone:effacer']({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, code: 'PERMISSION' })
    expect(existsSync(path.join(telephone, 'sessions', 'a.gpx'))).toBe(true)
    expect(existsSync(path.join(telephone, 'sessions', 'c.gpx'))).toBe(false)
    expect(await provisoires()).toEqual([])
    // Par le dossier de la page, le refus vient de l'état relu au listage, sans commande d'écriture.
    const mixte = dossierSansFilPuisCable(s.dossierSansFil(), dossierLocal(null))
    await mixte.lister()
    const avant = f.commandesRecues
    await expect(mixte.ecrire!('sessions/c.gpx', await aEnvoyer('x'), 1)).rejects.toMatchObject({ code: 'PERMISSION', message: expect.stringMatching(/enregistre/) })
    await expect(mixte.effacer!('sessions/a.gpx')).rejects.toMatchObject({ code: 'PERMISSION' })
    expect(f.commandesRecues).toBe(avant)
    f.enregistre = false
    expect(await dossier.etat()).toMatchObject({ ecriture: true, enregistrement: false })
  })

  it('refuse une confirmation fausse du téléphone', async () => {
    const falsifier = (c: Commande): Message | undefined => (c.type === 'valider' ? { type: 'ecrit', id: c.id, chemin: c.chemin, taille: c.taille + 1, dateMs: 0 } : undefined)
    const { canaux } = await relieEtListe({ falsifier })
    expect(await canaux['telephone:ecrireOctets']({ chemin: 'sessions/c.gpx', octets: texte('x') })).toMatchObject({ ok: false, message: expect.stringMatching(/mal confirmée/) })
  })
})

/**
 * Un PC hostile : un serveur TLS qui reconnaît le faux téléphone par son jeton, puis lui envoie les trames voulues
 * et lit ses réponses une à une.
 */
async function pcHostile() {
  const c = fabriquerCertificat()
  const serveurTls = tls.createServer({ cert: c.certificat, key: c.cle })
  const arrivee = new Promise<Liaison>((resoudre) => serveurTls.once('secureConnection', (socket) => resoudre(new Liaison(socket))))
  await new Promise<void>((fin) => serveurTls.listen(0, '127.0.0.1', () => fin()))
  const port = (serveurTls.address() as net.AddressInfo).port
  const identifiantPc = '0'.repeat(32)
  const f = faux({ memoire: { jeton: 'a'.repeat(64), empreinte: enHex(c.empreinte), identifiantPc, nomPc: 'PC hostile', adresse: '127.0.0.1', port } })
  const connexion = f.connecter()
  const liaison = await arrivee
  expect(await liaison.prochain(5_000)).toMatchObject({ type: 'bonjour', capacites: ['ecriture'] })
  liaison.envoyer({ type: 'bienvenue', identifiantPc, nomPc: 'PC hostile' })
  liaison.elargir()
  const cote = await connexion
  const commander = (commande: Commande) => {
    liaison.envoyer(commande)
    return liaison.prochain(5_000)
  }
  const fermer = () => {
    liaison.fermer()
    serveurTls.close()
  }
  return { f, cote, commander, fermer }
}

describe('le faux téléphone, comme le greffon', () => {
  it('refuse une taille fausse et un bloc hors d’ordre, et efface le provisoire à la coupure', async () => {
    const { cote, commander, fermer } = await pcHostile()
    try {
      const fait = (id: number) => ({ type: 'fait', id })
      // Trois octets écrits sur cinq annoncés : `valider` échoue, le provisoire est effacé.
      expect(await commander({ type: 'ecrire', id: 1, chemin: 'sessions/a.gpx', debut: 0, taille: 5, octets: texte('abc') })).toEqual(fait(1))
      expect(await provisoires()).toEqual(['a.gpx.gtracker-tmp', 'b.gpx.gtracker-new'])
      expect(await commander({ type: 'valider', id: 2, chemin: 'sessions/a.gpx', taille: 5 })).toMatchObject({ type: 'erreur', id: 2 })
      // Un bloc qui ne commence pas où le précédent finit.
      expect(await commander({ type: 'ecrire', id: 3, chemin: 'sessions/a.gpx', debut: 0, taille: 6, octets: texte('abc') })).toEqual(fait(3))
      expect(await commander({ type: 'ecrire', id: 4, chemin: 'sessions/a.gpx', debut: 4, taille: 6, octets: texte('ef') })).toMatchObject({ type: 'erreur', id: 4 })
      expect(await commander({ type: 'valider', id: 5, chemin: 'sessions/a.gpx', taille: 6 })).toMatchObject({ type: 'erreur', id: 5 })
      expect(await readFile(path.join(telephone, 'sessions', 'a.gpx'), 'utf8')).toBe('<gpx/>')
      // Une écriture en cours : le listage l'épargne et ne la montre pas, la coupure l'efface.
      expect(await commander({ type: 'ecrire', id: 6, chemin: 'sessions/neuf.gpx', debut: 0, taille: 6, octets: texte('abc') })).toEqual(fait(6))
      const liste = await commander({ type: 'lister', id: 7 })
      expect(liste.type === 'liste' && liste.fichiers.map((x) => x.chemin)).toEqual(['index.json', 'sessions/a.gpx'])
      expect(await provisoires()).toEqual(['neuf.gpx.gtracker-new'])
    } finally {
      fermer()
    }
    await cote.fermee
    expect(await provisoires()).toEqual([])
    expect(existsSync(path.join(telephone, 'sessions', 'neuf.gpx'))).toBe(false)
  })
})

describe('canaux et mode d’essai', () => {
  it('servent chaque canal et vérifient leurs arguments', async () => {
    const s = serveur()
    const canaux = gestionnairesSansFil(s)
    expect(Object.keys(canaux)).toEqual(CANAUX_SANS_FIL.map((nom) => `sansfil:${nom}`))
    expect(await canaux['sansfil:activer']('oui')).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await canaux['sansfil:activer']({ actif: true })).toMatchObject({ ok: true, valeur: { actif: true, ecoute: true } })
    expect(await canaux['sansfil:ouvrirAppairage'](undefined)).toMatchObject({ ok: true, valeur: { adresse: '127.0.0.1' } })
    expect(await canaux['sansfil:telephones'](undefined)).toEqual({ ok: true, valeur: [] })
    expect(await canaux['sansfil:retirer']({ id: '../x' })).toMatchObject({ ok: false })
    expect(await canaux['sansfil:retirer']({ id: '0'.repeat(32) })).toEqual({ ok: true, valeur: false })
    expect(await canaux['sansfil:etat'](undefined)).toMatchObject({ ok: true, valeur: { actif: true } })
  })

  it('ne lit les variables d’essai qu’en mode d’essai, et n’écoute alors que sur la boucle locale', () => {
    expect(essaiSansFilDepuisEnvironnement({ GTRACKER_BANC_SANSFIL_PORT: '5000' })).toBeNull()
    const journal: string[] = []
    const essai = essaiSansFilDepuisEnvironnement(
      { GTRACKER_BANC: '1', GTRACKER_BANC_SANSFIL_PORT: '5000', GTRACKER_BANC_SANSFIL_FENETRE_MS: '3000', GTRACKER_BANC_SANSFIL_SONDE: 'x', GTRACKER_BANC_SANSFIL_ACTIF: '1' },
      (m) => journal.push(m),
    )
    expect(essai).toMatchObject({ port: 5000, dureeFenetreMs: 3000, portSonde: null, hoteSonde: '127.0.0.1', actif: true, dossier: null, nomPc: "PC d'essai" })
    expect(essai?.adresses?.()).toEqual([{ adresse: '127.0.0.1', masque: '255.0.0.0' }])
    expect(journal.some((m) => m.includes('GTRACKER_BANC_SANSFIL_SONDE'))).toBe(true)
    expect(essaiSansFilDepuisEnvironnement({ GTRACKER_BANC: '1' })).toMatchObject({ port: 0, portSonde: null, actif: false })
  })
})
