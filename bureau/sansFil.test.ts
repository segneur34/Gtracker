import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FauxTelephone, RefusPc, sonder } from './fauxTelephone'
import type { Reponse } from './pont'
import type { AvisArrivee, Chiffreur, OptionsSansFil } from './sansFil'
import {
  CANAUX_SANS_FIL,
  FICHIER_CLE,
  FICHIER_REGLAGES,
  FICHIER_TELEPHONES,
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
  await writeFile(path.join(telephone, 'sessions', 'b.gpx.gtracker-tmp'), 'en cours')
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
    expect(await dossier.etat()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", canal: 'sansFil' })
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
    expect(await dossier.etat()).toMatchObject({ etat: 'pret', canal: 'cable' })
    expect((await dossier.lister()).map((x) => x.chemin)).toEqual(['cable.json'])

    const { liaison } = await appairer(s)
    expect(await dossier.etat()).toMatchObject({ etat: 'pret', canal: 'sansFil' })
    expect((await dossier.lister()).map((x) => x.chemin)).toEqual(['index.json', 'sessions/a.gpx'])

    liaison.fermer()
    await quand(async () => (await dossier.etat()).canal === 'cable')
    expect(await dossierSansFilPuisCable(s.dossierSansFil(), dossierLocal(null)).etat()).toEqual({ etat: 'absent' })
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
