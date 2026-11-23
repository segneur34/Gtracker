import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
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
import type { ContexteEcoute, JugementPareFeu, ResultatAutorisation } from './pareFeu'
import type { Reponse } from './pont'
import type { AvisArrivee, AvisDepart, Chiffreur, OptionsSansFil } from './sansFil'
import {
  CANAUX_SANS_FIL,
  DELAIS,
  classerDepart,
  FICHIER_CLE,
  FICHIER_REGLAGES,
  FICHIER_TELEPHONES,
  Liaison,
  ServeurSansFil,
  dossierSansFilPuisCable,
  essaiSansFilDepuisEnvironnement,
  gestionnairesSansFil,
  pareFeuFactice,
  stockageDossier,
} from './sansFil'
import type { ReponseSonde } from './sonde'
import { TAILLE_NONCE_SONDE, decoderReponse, encoderQuestion } from './sonde'
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

/** Une connexion TLS qui n'a rien d'un téléphone, poignée faite, depuis l'adresse de boucle locale donnée. */
function connexionBrute(port: number, adresseLocale = '127.0.0.1'): Promise<tls.TLSSocket> {
  return new Promise((resoudre, rejeter) => {
    const socket = tls.connect({ host: '127.0.0.1', port, localAddress: adresseLocale, rejectUnauthorized: false })
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

/** Vrai si une connexion TLS ouverte depuis `adresseLocale` est fermée par le serveur dans les `ms` données, poignée faite ou non. */
function coupeeDans(port: number, adresseLocale: string, ms: number): Promise<boolean> {
  const socket = tls.connect({ host: '127.0.0.1', port, localAddress: adresseLocale, rejectUnauthorized: false })
  return fermeeDans(socket, ms).finally(() => socket.destroy())
}

/** Envoie `n` questions de découverte depuis `adresseLocale`, et rend les réponses reçues dans la demi-seconde qui suit. */
async function questionner(portSonde: number, adresseLocale: string, n: number): Promise<ReponseSonde[]> {
  const socket = dgram.createSocket('udp4')
  const recues: ReponseSonde[] = []
  socket.on('message', (paquet) => {
    const reponse = decoderReponse(paquet)
    if (reponse) recues.push(reponse)
  })
  await new Promise<void>((fin) => socket.bind(0, adresseLocale, () => fin()))
  for (let k = 0; k < n; k++) socket.send(encoderQuestion(randomBytes(TAILLE_NONCE_SONDE)), portSonde, '127.0.0.1')
  await attendre(500)
  socket.close()
  return recues
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
    // Sans relevé du pare-feu, l'auto-connexion réussie ne dit rien : « inconnu ».
    expect(etat).toMatchObject({ actif: true, ecoute: true, adresses: ['127.0.0.1'], pareFeu: 'inconnu', pareFeuReparable: false, erreur: null })
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
    // L'appairage compte comme une liaison : l'heure est écrite dans le registre du profil.
    expect(telephones).toEqual([expect.objectContaining({ nom: "Téléphone d'essai", relie: true, vuLe: telephones[0].ajouteLe })])
    expect(JSON.parse(await readFile(path.join(secrets, FICHIER_TELEPHONES), 'utf8')).telephones[0].vuLe).toBe(telephones[0].ajouteLe)
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
    expect(await s.etat()).toMatchObject({ appairage: null, codesFaux: null })

    decalage = 0
    const ouvert = await s.ouvrirAppairage()
    const faux1 = ouvert.code === '000000' ? '000001' : '000000'
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toBeInstanceOf(RefusPc)
    // Le PC dit d'où vient chaque code faux, pour que l'utilisateur voie s'il vient d'un autre appareil que le sien.
    expect((await s.etat()).codesFaux).toEqual({ nombre: 1, adresse: '127.0.0.1' })
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toMatchObject({ raison: 'code' })
    await expect(faux().appairer('127.0.0.1', port, faux1)).rejects.toMatchObject({ raison: 'code' })
    // Trois échecs ferment la fenêtre : même le bon code ne passe plus, et l'origine reste dite.
    await expect(faux().appairer('127.0.0.1', port, ouvert.code)).rejects.toMatchObject({ raison: 'fenetre' })
    expect(await s.etat()).toMatchObject({ appairage: null, codesFaux: { nombre: 3, adresse: '127.0.0.1' } })
    expect(await s.telephones()).toEqual([])
    // Une fenêtre neuve repart sans code faux.
    await s.ouvrirAppairage()
    expect((await s.etat()).codesFaux).toBeNull()
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

  it('annonce le départ d’un téléphone avec sa raison et son heure, le garde pour la liste, l’oublie à son retour', async () => {
    const departs: AvisDepart[] = []
    const s = serveur({ surDepart: (a) => departs.push(a), delais: { commande: 200 } })
    await s.activer(true)
    const { f, liaison } = await appairer(s)
    const [{ id }] = await s.telephones()
    expect((await s.telephones())[0]).toMatchObject({ relie: true, partiLe: null, raisonDepart: null })

    // Gtracker quitte l'écran du téléphone : le téléphone ferme la liaison.
    const avant = Date.now()
    liaison.fermer()
    await quand(() => departs.length === 1)
    expect(departs[0]).toMatchObject({ id, nom: "Téléphone d'essai", raison: 'ferme' })
    expect(departs[0].heure).toBeGreaterThanOrEqual(avant)
    expect((await s.telephones())[0]).toMatchObject({ relie: false, partiLe: departs[0].heure, raisonDepart: 'ferme' })

    // De retour, puis remplacé par une liaison plus récente du même téléphone : ce n'est pas un départ.
    const retour = await f.connecter()
    await quand(async () => (await s.telephones())[0].relie)
    expect((await s.telephones())[0]).toMatchObject({ partiLe: null, raisonDepart: null })
    const plusRecente = await f.connecter()
    await quand(async () => retour.liaison.fermee)
    expect(departs).toHaveLength(1)
    expect((await s.etat()).relies).toHaveLength(1)

    // Muet : lâché après le délai d'une commande.
    plusRecente.liaison.servir(() => undefined)
    await expect(s.dossierSansFil().lister()).rejects.toThrow(/délai/)
    await quand(() => departs.length === 2)
    expect(departs[1]).toMatchObject({ id, raison: 'silence' })
    expect((await s.telephones())[0]).toMatchObject({ relie: false, raisonDepart: 'silence' })

    // Sans-fil éteint, puis téléphone retiré.
    await s.activer(false)
    await s.activer(true)
    const encore = await f.connecter('127.0.0.1', (await s.etat()).port as number)
    await quand(async () => (await s.telephones())[0].relie)
    await s.activer(false)
    await quand(() => departs.length === 3)
    expect(departs[2]).toMatchObject({ raison: 'eteint' })
    await quand(() => encore.liaison.fermee)
    await s.activer(true)
    await f.connecter('127.0.0.1', (await s.etat()).port as number)
    await quand(async () => (await s.telephones())[0].relie)
    expect(await s.retirer(id)).toBe(true)
    await quand(() => departs.length === 4)
    expect(departs[3]).toMatchObject({ raison: 'retire' })
    expect(await s.telephones()).toEqual([])
  })

  it('classe la raison d’une fermeture', () => {
    expect(classerDepart("l'autre bout a fermé la liaison.")).toBe('ferme')
    expect(classerDepart('le téléphone ne répond plus.')).toBe('silence')
    expect(classerDepart('délai dépassé.')).toBe('silence')
    expect(classerDepart('téléphone retiré.')).toBe('retire')
    expect(classerDepart('sans-fil éteint.')).toBe('eteint')
    expect(classerDepart('remplacée par une liaison plus récente du même téléphone.')).toBe('remplace')
    expect(classerDepart('read ECONNRESET')).toBe('coupure')
    expect(classerDepart('liaison fermée.')).toBe('coupure')
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

  it('répond à la découverte par son port et son identifiant, sans donner son nom', async () => {
    const s = serveur({ portSonde: 0, hoteSonde: '127.0.0.1' })
    await s.activer(true)
    const portSonde = s.portDecouverte() as number
    expect(portSonde).toBeGreaterThan(0)
    const trouve = await sonder('127.0.0.1', portSonde, 2_000)
    expect(trouve).toMatchObject({ adresse: '127.0.0.1', port: (await s.etat()).port, nom: '' })
    const { f } = await appairer(s)
    expect(trouve?.identifiantPc).toBe(f.memoire?.identifiantPc)
    // Le nom du PC ne part qu'au téléphone reconnu.
    expect(f.memoire?.nomPc).toBe('PC de test')
  })

  it('répond trois fois par seconde au plus à une même adresse, sans priver les autres', async () => {
    const fige = Date.now()
    const s = serveur({ portSonde: 0, hoteSonde: '127.0.0.1', horloge: () => fige })
    await s.activer(true)
    const portSonde = s.portDecouverte() as number
    expect(await questionner(portSonde, '127.0.0.1', 6)).toHaveLength(3)
    expect(await questionner(portSonde, '127.0.0.2', 2)).toHaveLength(2)
    expect(await questionner(portSonde, '127.0.0.1', 1)).toHaveLength(0)
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

  it('lâche un inconnu muet après le délai de présentation, plus court que celui de l’accueil', async () => {
    expect(DELAIS.presentation).toBe(3_000)
    expect(DELAIS.presentation).toBeLessThan(DELAIS.accueil)
    const s = serveur({ delais: { presentation: 300 } })
    const port = (await s.activer(true)).port as number
    const muet = await connexionBrute(port)
    expect(await fermeeDans(muet, 3_000)).toBe(true)
  })

  it('coupe aussitôt la troisième connexion inconnue d’une même adresse, pas celle d’une autre adresse', async () => {
    // Sans l'essai d'auto-connexion, qui part de la même adresse de boucle locale et y prendrait une place.
    const s = serveur({ delais: { presentation: 10_000 }, essaiPareFeu: false })
    const port = (await s.activer(true)).port as number
    const deux = await Promise.all([connexionBrute(port), connexionBrute(port)])
    try {
      await attendre(200)
      expect(await coupeeDans(port, '127.0.0.1', 3_000)).toBe(true)
      const autre = await connexionBrute(port, '127.0.0.2')
      expect(await fermeeDans(autre, 500)).toBe(false)
      autre.destroy()
      expect(deux.every((socket) => !socket.closed)).toBe(true)
    } finally {
      for (const socket of deux) socket.destroy()
    }
  })

  it('garde seize connexions inconnues en tout, et coupe aussitôt la suivante', async () => {
    const s = serveur({ delais: { presentation: 10_000 } })
    const port = (await s.activer(true)).port as number
    const adresses = Array.from({ length: 8 }, (_, k) => `127.0.0.${k + 2}`)
    const seize = await Promise.all(adresses.flatMap((a) => [connexionBrute(port, a), connexionBrute(port, a)]))
    try {
      await attendre(200)
      expect(await coupeeDans(port, '127.0.0.10', 3_000)).toBe(true)
      expect(seize.every((socket) => !socket.closed)).toBe(true)
    } finally {
      for (const socket of seize) socket.destroy()
    }
  })

  it('une connexion reconnue ne compte plus parmi les inconnues de son adresse', async () => {
    const s = serveur({ delais: { presentation: 10_000 }, essaiPareFeu: false })
    await s.activer(true)
    const { liaison } = await appairer(s)
    const port = (await s.etat()).port as number
    const deux = await Promise.all([connexionBrute(port), connexionBrute(port)])
    try {
      await attendre(200)
      expect(deux.every((socket) => !socket.closed)).toBe(true)
      expect((await s.etat()).relies).toHaveLength(1)
    } finally {
      for (const socket of deux) socket.destroy()
      liaison.fermer()
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
    // Sans demande d'autorisation branchée : un échec dit, jamais une exception.
    expect(await canaux['sansfil:autoriser'](undefined)).toMatchObject({ ok: true, valeur: { issue: 'echec', etat: { actif: true } } })
  })

  it('le mode d’essai a un pare-feu factice, réglé par ses deux variables', async () => {
    const journal: string[] = []
    const essai = essaiSansFilDepuisEnvironnement(
      { GTRACKER_BANC: '1', GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque', GTRACKER_BANC_SANSFIL_AUTORISATION: 'zut' },
      (m) => journal.push(m),
    )
    expect(journal.some((m) => m.includes('GTRACKER_BANC_SANSFIL_AUTORISATION illisible'))).toBe(true)
    const ecoute = { adresses: ['127.0.0.1'], port: 1, portSonde: null }
    expect(await essai?.lirePareFeu(ecoute)).toEqual({ pareFeu: 'bloque', reparable: true })
    expect(await essai?.autoriserPareFeu()).toEqual({ issue: 'accordee' })
    expect(journal).toContain("autorisation d'essai : accordee")
    expect(await essai?.lirePareFeu(ecoute)).toEqual({ pareFeu: 'ouvert', reparable: false })
    const defaut = essaiSansFilDepuisEnvironnement({ GTRACKER_BANC: '1' })
    expect(await defaut?.lirePareFeu(ecoute)).toEqual({ pareFeu: 'ouvert', reparable: false })
    const irreparable = pareFeuFactice('irreparable', 'accordee')
    await irreparable.autoriserPareFeu()
    expect(await irreparable.lirePareFeu(ecoute)).toEqual({ pareFeu: 'bloque', reparable: false })
    expect(await pareFeuFactice('bloque', 'echec').autoriserPareFeu()).toMatchObject({ issue: 'echec', detail: expect.any(String) })
  })
})

describe('pare-feu de Windows', () => {
  /** Un pare-feu réglable, qui compte ses relevés et ses demandes. */
  function pareFeuReglable(depart: JugementPareFeu, issue: ResultatAutorisation = { issue: 'accordee' }) {
    const suivi = { jugement: depart, releves: [] as ContexteEcoute[], demandes: 0, ordre: [] as string[] }
    const options: Partial<OptionsSansFil> = {
      lirePareFeu: async (ecoute) => {
        suivi.releves.push(ecoute)
        suivi.ordre.push('releve')
        return suivi.jugement
      },
      autoriserPareFeu: async () => {
        suivi.demandes++
        suivi.ordre.push('demande')
        if (issue.issue === 'accordee') suivi.jugement = { pareFeu: 'ouvert', reparable: false }
        return issue
      },
    }
    return { suivi, options }
  }
  const BLOQUE: JugementPareFeu = { pareFeu: 'bloque', reparable: true }

  it('relevé lu après la mise à l’écoute, au port pris, puis relu toutes les 30 s tant qu’il bloque', async () => {
    const { suivi, options } = pareFeuReglable(BLOQUE)
    const s = serveur({ ...options, delais: { intervalleAdresses: 50 } })
    const etat = await s.activer(true, false)
    expect(suivi.demandes).toBe(0)
    expect(etat).toMatchObject({ pareFeu: 'bloque', pareFeuReparable: true })
    expect(suivi.releves[0]).toEqual({ adresses: ['127.0.0.1'], port: etat.port, portSonde: null })
    await quand(() => suivi.releves.length >= 3)
    // Ouvert (règle posée à la main dans Windows) : vu au relevé suivant, puis plus relu.
    suivi.jugement = { pareFeu: 'ouvert', reparable: false }
    await quand(async () => (await s.etat()).pareFeu === 'ouvert')
    const vus = suivi.releves.length
    await attendre(200)
    expect(suivi.releves.length).toBe(vus)
    expect((await s.etat()).pareFeuReparable).toBe(false)
  })

  it('à l’allumage, bloqué et réparable : l’autorisation est demandée avant l’écoute', async () => {
    const { suivi, options } = pareFeuReglable(BLOQUE)
    const s = serveur(options)
    const etat = await s.activer(true)
    expect(suivi.demandes).toBe(1)
    expect(suivi.ordre).toEqual(['releve', 'demande', 'releve'])
    expect(etat).toMatchObject({ ecoute: true, pareFeu: 'ouvert', pareFeuReparable: false })
  })

  it('à l’allumage, refus : le sans-fil s’allume quand même, bloqué et réparable ; rien n’est demandé s’il est ouvert ou irréparable', async () => {
    const refus = pareFeuReglable(BLOQUE, { issue: 'refusee' })
    expect(await serveur(refus.options).activer(true)).toMatchObject({ ecoute: true, pareFeu: 'bloque', pareFeuReparable: true })
    expect(refus.suivi.demandes).toBe(1)
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    const ouvert = pareFeuReglable({ pareFeu: 'ouvert', reparable: false })
    await serveur(ouvert.options).activer(true)
    expect(ouvert.suivi.demandes).toBe(0)
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    const irreparable = pareFeuReglable({ pareFeu: 'bloque', reparable: false })
    expect(await serveur(irreparable.options).activer(true)).toMatchObject({ pareFeu: 'bloque', pareFeuReparable: false })
    expect(irreparable.suivi.demandes).toBe(0)
  })

  it('autorisation par le canal : accordée puis ouvert ; refus, reste bloqué ; échec, avec sa raison', async () => {
    const accord = pareFeuReglable(BLOQUE)
    const s = serveur(accord.options)
    await s.activer(true, false)
    const canaux = gestionnairesSansFil(s)
    const reponse = (await canaux['sansfil:autoriser']('ignoré')) as Reponse
    expect(reponse).toMatchObject({ ok: true, valeur: { issue: 'accordee', etat: { pareFeu: 'ouvert', pareFeuReparable: false } } })
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    const refus = pareFeuReglable(BLOQUE, { issue: 'refusee' })
    const r = serveur(refus.options)
    await r.activer(true, false)
    expect(await r.autoriserPareFeu()).toMatchObject({ issue: 'refusee', etat: { pareFeu: 'bloque', pareFeuReparable: true } })
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    const echec = pareFeuReglable(BLOQUE, { issue: 'echec', detail: 'règle refusée' })
    const e = serveur(echec.options)
    await e.activer(true, false)
    expect(await e.autoriserPareFeu()).toMatchObject({ issue: 'echec', detail: 'règle refusée', etat: { pareFeu: 'bloque' } })
    // Une demande en échec dont le relevé suivant dit ouvert est accordée.
    echec.suivi.jugement = { pareFeu: 'ouvert', reparable: false }
    expect(await e.autoriserPareFeu()).toMatchObject({ issue: 'accordee', etat: { pareFeu: 'ouvert' } })
  })

  it('sans-fil éteint : l’autorisation est refusée par le canal, sans rien demander', async () => {
    const { suivi, options } = pareFeuReglable(BLOQUE)
    const s = serveur(options)
    await s.demarrer()
    expect(await gestionnairesSansFil(s)['sansfil:autoriser'](undefined)).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(suivi.demandes).toBe(0)
  })

  it('relevé illisible : l’auto-connexion en repli, « ouvert » devient « inconnu »', async () => {
    const s = serveur({ lirePareFeu: async () => null, autoriserPareFeu: async () => ({ issue: 'accordee' }) })
    expect(await s.activer(true)).toMatchObject({ ecoute: true, pareFeu: 'inconnu', pareFeuReparable: false })
    const panne = serveur({ lirePareFeu: async () => Promise.reject(new Error('powershell absent')) })
    await expect(panne.activer(true)).resolves.toMatchObject({ pareFeu: 'inconnu' })
  })

  it('relevé raté : sa raison au journal, refait après le délai court, puis lu et montré', async () => {
    const journal: string[] = []
    let lectures = 0
    let rate = true
    const s = serveur({
      journal: (m) => journal.push(m),
      lirePareFeu: async () => {
        lectures++
        return rate ? { raison: 'délai de 30 s dépassé' } : BLOQUE
      },
      autoriserPareFeu: async () => ({ issue: 'accordee' }),
      delais: { nouveauRelevePareFeu: 50, intervalleAdresses: 60_000 },
    })
    expect(await s.activer(true, false)).toMatchObject({ ecoute: true, pareFeu: 'inconnu', pareFeuReparable: false })
    expect(journal.filter((m) => m.startsWith('relevé du pare-feu'))).toEqual(['relevé du pare-feu raté : délai de 30 s dépassé'])
    rate = false
    // Sans attendre le relevé des adresses (une minute ici) : la carte n'est pas laissée muette.
    await quand(async () => (await s.etat()).pareFeu === 'bloque')
    expect(lectures).toBe(2)
    expect((await s.etat()).pareFeuReparable).toBe(true)
    expect(journal).toContain('relevé du pare-feu lu après un échec')
  })

  it('relevé qui ne rend jamais la main : l’état, l’appairage, les téléphones et l’arrêt répondent, sans relevés empilés', async () => {
    let lectures = 0
    const s = serveur({
      lirePareFeu: () => {
        lectures++
        return new Promise<never>(() => undefined)
      },
      delais: { intervalleAdresses: 10, nouveauRelevePareFeu: 10 },
    })
    void s.activer(true, false)
    await quand(async () => (await s.etat()).ecoute)
    expect((await s.etat()).pareFeu).toBe('inconnu')
    expect((await s.ouvrirAppairage()).code).toMatch(/^\d{6}$/)
    expect(await s.telephones()).toEqual([])
    await attendre(200)
    expect(lectures).toBe(1)
    await expect(s.arreter()).resolves.toBeUndefined()

    // Au lancement suivant, le sans-fil déjà allumé : le démarrage n'attend pas le relevé.
    const relance = serveur({ lirePareFeu: () => new Promise<never>(() => undefined) })
    await relance.demarrer()
    expect(await relance.etat()).toMatchObject({ actif: true, ecoute: true, pareFeu: 'inconnu' })
  })

  it('rallumé avec un relevé lent : rien n’écoute pendant la préparation, puis l’allumage est complet', async () => {
    const attentes: ((j: JugementPareFeu) => void)[] = []
    let lent = false
    const OUVERT: JugementPareFeu = { pareFeu: 'ouvert', reparable: false }
    const s = serveur({
      portSonde: 0,
      hoteSonde: '127.0.0.1',
      lirePareFeu: () => (lent ? new Promise<JugementPareFeu>((r) => attentes.push(r)) : Promise.resolve(OUVERT)),
      autoriserPareFeu: async () => ({ issue: 'accordee' }),
      delais: { intervalleAdresses: 10 },
    })
    await s.activer(true)
    await s.activer(false)
    lent = true
    const rallume = s.activer(true)
    await quand(() => attentes.length === 1)
    // La page relit l'état pendant la préparation : elle ne met pas le serveur à l'écoute.
    for (let i = 0; i < 5; i++) {
      expect(await s.etat()).toMatchObject({ actif: true, ecoute: false, port: null })
      await attendre(15)
    }
    lent = false
    attentes[0](OUVERT)
    expect(await rallume).toMatchObject({ actif: true, ecoute: true, pareFeu: 'ouvert' })
    const portSonde = s.portDecouverte() as number
    expect(await sonder('127.0.0.1', portSonde, 2_000)).toMatchObject({ port: (await s.etat()).port })
    // En service : un téléphone est accueilli et appairé.
    const { liaison } = await appairer(s)
    await quand(async () => (await s.etat()).relies.length === 1)
    liaison.fermer()
  })

  it('éteint pendant la préparation : l’extinction l’emporte, rien n’écoute ni n’est demandé', async () => {
    const attentes: ((j: JugementPareFeu) => void)[] = []
    let demandes = 0
    const s = serveur({
      lirePareFeu: () => new Promise<JugementPareFeu>((r) => attentes.push(r)),
      autoriserPareFeu: async () => {
        demandes++
        return { issue: 'accordee' }
      },
    })
    const allume = s.activer(true)
    await quand(() => attentes.length === 1)
    expect(await s.activer(false)).toMatchObject({ actif: false, ecoute: false })
    attentes[0](BLOQUE)
    expect(await allume).toMatchObject({ actif: false, ecoute: false })
    expect(demandes).toBe(0)
  })

  it('relevé raté fini après une extinction : ni raison, ni journal, et rien ne s’en souvient au rallumage', async () => {
    const journal: string[] = []
    const attentes: ((l: { raison: string }) => void)[] = []
    let lent = true
    const s = serveur({
      journal: (m) => journal.push(m),
      lirePareFeu: () => (lent ? new Promise<{ raison: string }>((r) => attentes.push(r)) : Promise.resolve(BLOQUE)),
    })
    void s.activer(true, false)
    await quand(() => attentes.length === 1)
    await s.arreter()
    attentes[0]({ raison: 'délai de 30 s dépassé' })
    await attendre(20)
    expect(journal.filter((m) => m.startsWith('relevé du pare-feu') || m.startsWith('pare-feu'))).toEqual([])
    lent = false
    expect(await s.activer(true, false)).toMatchObject({ ecoute: true, pareFeu: 'bloque' })
    expect(journal.filter((m) => m.startsWith('relevé du pare-feu'))).toEqual([])
  })

  it('relevés des adresses pendant un relevé lent : jamais deux relevés à la fois', async () => {
    let lectures = 0
    let enCours = 0
    let auPlus = 0
    const s = serveur({
      lirePareFeu: async () => {
        lectures++
        auPlus = Math.max(auPlus, ++enCours)
        await attendre(60)
        enCours--
        return BLOQUE
      },
      delais: { intervalleAdresses: 5 },
    })
    await s.activer(true, false)
    await quand(() => lectures >= 4)
    expect(auPlus).toBe(1)
  })

  it('relevé fini après une extinction : jeté, et le relevé de la nouvelle écoute part à sa suite', async () => {
    const reponses: ((j: JugementPareFeu) => void)[] = []
    const s = serveur({ lirePareFeu: () => new Promise<JugementPareFeu>((r) => reponses.push(r)) })
    void s.activer(true, false)
    await quand(() => reponses.length === 1)
    await s.arreter()
    const rallume = s.activer(true, false)
    // Le relevé de l'écoute éteinte est encore en cours : pas de second relevé à côté.
    await attendre(100)
    expect(reponses).toHaveLength(1)
    reponses[0](BLOQUE)
    await quand(() => reponses.length === 2)
    expect((await s.etat()).pareFeu).toBe('inconnu')
    reponses[1]({ pareFeu: 'ouvert', reparable: false })
    expect(await rallume).toMatchObject({ pareFeu: 'ouvert' })
  })

  it('à l’allumage, un seul relevé quand celui d’avant l’écoute visait le même port et que rien n’a été demandé', async () => {
    const libre = await new Promise<number>((fin) => {
      const essai = net.createServer().listen(0, '127.0.0.1', () => {
        const port = (essai.address() as net.AddressInfo).port
        essai.close(() => fin(port))
      })
    })
    const ouvert = pareFeuReglable({ pareFeu: 'ouvert', reparable: false })
    expect(await serveur({ ...ouvert.options, port: libre }).activer(true)).toMatchObject({ ecoute: true, port: libre, pareFeu: 'ouvert' })
    expect(ouvert.suivi.ordre).toEqual(['releve'])
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    const bloque = pareFeuReglable(BLOQUE)
    expect(await serveur({ ...bloque.options, port: libre }).activer(true)).toMatchObject({ pareFeu: 'ouvert' })
    expect(bloque.suivi.ordre).toEqual(['releve', 'demande', 'releve'])
  })

  it('relevé toujours raté : refait une seule fois au délai court, puis à chaque relevé des adresses, raison dite une fois', async () => {
    const journal: string[] = []
    let lectures = 0
    const lent = serveur({
      journal: (m) => journal.push(m),
      lirePareFeu: async () => {
        lectures++
        return null
      },
      delais: { nouveauRelevePareFeu: 20, intervalleAdresses: 60_000 },
    })
    await lent.activer(true, false)
    await quand(() => lectures === 2)
    await attendre(150)
    expect(lectures).toBe(2)
    expect(journal.filter((m) => m.startsWith('relevé du pare-feu'))).toEqual(['relevé du pare-feu raté : relevé illisible'])
    await Promise.all(serveurs.splice(0).map((x) => x.arreter()))

    let suivantes = 0
    const raisons = ['Windows PowerShell a rendu le code 1', 'Windows PowerShell a rendu le code 1', 'sortie illisible (3 caractères)']
    journal.length = 0
    const s = serveur({
      journal: (m) => journal.push(m),
      lirePareFeu: async () => ({ raison: raisons[Math.min(suivantes++, raisons.length - 1)] }),
      delais: { nouveauRelevePareFeu: 60_000, intervalleAdresses: 30 },
    })
    await s.activer(true, false)
    await quand(() => suivantes >= 5)
    expect(journal.filter((m) => m.startsWith('relevé du pare-feu'))).toEqual([
      'relevé du pare-feu raté : Windows PowerShell a rendu le code 1',
      'relevé du pare-feu raté : sortie illisible (3 caractères)',
    ])
    expect((await s.etat()).pareFeu).toBe('inconnu')
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
