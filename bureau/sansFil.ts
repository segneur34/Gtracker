// Le serveur sans fil du PC : le téléphone se connecte au programme Windows par le Wi-Fi, en TLS, et le PC lit son
// dossier mémoire comme il lit celui du câble (`DossierDistant` de `telephone.ts`). Sans Electron : le chiffrement du
// système, le dossier du profil et le réseau sont passés en paramètre, pour être essayés sur une vraie socket.
//
// Déroulé :
// - éteint par défaut ; l'utilisateur l'active (choix retenu dans le profil, repris au lancement suivant) ;
// - activé, le PC écoute en TLS sur le port 48217 (ou l'un des neuf suivants s'il est pris), sur chacune de ses
//   adresses IPv4 privées seulement (jamais une adresse publique ni toutes les cartes à la fois), relues toutes les
//   30 secondes ; il répond aux questions de découverte du port UDP 48218 venues de ses réseaux privés ;
// - un téléphone qui se connecte n'a droit qu'aux petites trames de l'accueil (`LIMITES_ACCUEIL`) et à 10 secondes
//   pour se présenter : par le code d'une fenêtre d'appairage ouverte (`FenetreAppairage`), ou par son jeton
//   (`RegistreTelephones`) ; refusé, il reçoit `refus` et la liaison se ferme ;
// - reconnu, la liaison passe aux limites larges et s'inverse : c'est le PC qui commande (`lister`, `lire` par
//   blocs de 1 Mio, `ping` toutes les 15 secondes), le téléphone qui répond ; une commande sans réponse ferme la
//   liaison. Le dernier téléphone arrivé est celui que lit `dossierSansFil()`.
//
// Secrets, dans le dossier `sansfil` du profil (`%APPDATA%\Gtracker`), jamais dans le dossier mémoire :
//   reglages.json     { "version": 1, "actif": true, "identifiantPc": "<16 octets en hexadécimal>" }
//   telephones.json   le registre des téléphones appairés (hachage du jeton, jamais le jeton : `appairage.ts`)
//   certificat.pem    le certificat auto-signé du serveur (`certificat.ts`), public
//   cle.bin           sa clé, chiffrée par le système (DPAPI sous Windows) ; si le chiffrement manque, rien n'est
//                     écrit et le certificat ne dure que le temps du lancement (les téléphones se réappaireront)
//
// Mode d'essai (`GTRACKER_BANC=1`) seulement, `essaiSansFilDepuisEnvironnement` lit (le serveur n'écoute alors que
// sur 127.0.0.1, jamais sur le vrai réseau) :
//   GTRACKER_BANC_SANSFIL_ACTIF      « 1 » : sans-fil activé dès le lancement, sans passer par la page
//   GTRACKER_BANC_SANSFIL_PORT       port TCP du serveur ; 0 ou absent : un port libre choisi par le système
//   GTRACKER_BANC_SANSFIL_SONDE      port UDP de la découverte ; absent : pas de découverte
//   GTRACKER_BANC_SANSFIL_FENETRE_MS durée d'une fenêtre d'appairage, en millisecondes
//   GTRACKER_BANC_SANSFIL_PROFIL     dossier des secrets du sans-fil, au lieu du dossier `sansfil` du profil

import type { AddressInfo, Socket } from 'node:net'
import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
import { mkdir, open, readFile, unlink, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import type { Alea, Horloge, TelephoneVisible } from './appairage'
import { FenetreAppairage, RegistreTelephones, TAILLE_IDENTIFIANT, depuisHex, egalATempsConstant, enHex, tirerIdentifiant } from './appairage'
import { certificatUtilisable, empreinteCertificat, fabriquerCertificat } from './certificat'
import { ErreurDisque, codeDe, ecrireAtomique } from './disque'
import type { Gestionnaire } from './pont'
import { enReponse } from './pont'
import { decoderQuestion, encoderReponse, adressesPrivees, memeReseau, nomPcPourSonde, PORT_SONDE } from './sonde'
import type { DossierDistant, EtatTelephone, FichierTelephone } from './telephone'
import { enSerie, pasPret } from './telephone'
import type { Commande, CommandeLire, CommandeLister, CommandePing, Limites, Message, MessageBonjour, MessageAppairer, RaisonRefus, ReponseTelephone } from './trames'
import { DecodeurTrames, ID_MAX, LIMITES, LIMITES_ACCUEIL, PROTOCOLE_SANS_FIL, PORT_SANS_FIL, blocsDeLecture, encoderMessage, lireMessage } from './trames'

/** Dossier des secrets du sans-fil, dans le profil du programme. */
export const DOSSIER_SANS_FIL = 'sansfil'

export const FICHIER_REGLAGES = 'reglages.json'
export const FICHIER_TELEPHONES = 'telephones.json'
export const FICHIER_CERTIFICAT = 'certificat.pem'
export const FICHIER_CLE = 'cle.bin'

/** Ports essayés à partir du premier quand il est pris. */
export const ESSAIS_PORT = 10

/** Délais de la liaison, en millisecondes. */
export type Delais = {
  /** Pour la poignée de main TLS. */
  poignee: number
  /** Pour chaque message de l'accueil (présentation, preuve). */
  accueil: number
  /** Pour la réponse à `lister` ou à un `lire` d'un bloc. */
  commande: number
  /** Entre deux `ping` d'une liaison reconnue. */
  intervallePing: number
  /** Pour la réponse à un `ping`. */
  ping: number
  /** Entre deux relevés des adresses du PC. */
  intervalleAdresses: number
  /** Pour l'essai d'auto-connexion. */
  pareFeu: number
}

export const DELAIS: Readonly<Delais> = Object.freeze({
  poignee: 10_000,
  accueil: 10_000,
  commande: 30_000,
  intervallePing: 15_000,
  ping: 20_000,
  intervalleAdresses: 30_000,
  pareFeu: 2_000,
})

/** Liaisons pas encore reconnues gardées ensemble ; au-delà, une connexion de plus est coupée aussitôt. */
const INCONNUES_MAX = 8

/** Connexions ouvertes ensemble sur un serveur, reconnues ou non. */
const CONNEXIONS_MAX = 32

/** Réponses de découverte envoyées par seconde, au plus : un hôte bavard du réseau n'en obtient pas davantage. */
const REPONSES_SONDE_PAR_SECONDE = 20

/** Attente de la fin propre d'une liaison refusée avant de la couper. */
const ATTENTE_FIN_MS = 2_000

// ---------- secrets du profil ----------

/** Chiffrement du système (`safeStorage` d'Electron hors des tests). */
export type Chiffreur = {
  disponible(): Promise<boolean>
  chiffrer(texte: string): Promise<Uint8Array>
  dechiffrer(octets: Uint8Array): Promise<string>
}

/** Fichiers du dossier des secrets. */
export type StockageSansFil = {
  /** Octets d'un fichier, `null` s'il n'existe pas. */
  lire(nom: string): Promise<Uint8Array | null>
  /** Écrit un fichier sans jamais le laisser à moitié écrit. */
  ecrire(nom: string, octets: Uint8Array): Promise<void>
}

/** Le dossier des secrets sur le disque, créé à la première écriture. */
export function stockageDossier(dossier: string): StockageSansFil {
  const racine = path.resolve(dossier)
  return {
    async lire(nom) {
      try {
        return await readFile(path.join(racine, nom))
      } catch (e) {
        if (codeDe(e) === 'NOT_FOUND') return null
        throw e
      }
    },
    async ecrire(nom, octets) {
      await mkdir(racine, { recursive: true })
      await ecrireAtomique(path.join(racine, nom), octets)
    },
  }
}

type Reglages = { actif: boolean; identifiantPc: string }

function reglagesLus(octets: Uint8Array | null): { actif: boolean; identifiantPc: string | null } {
  if (octets === null) return { actif: false, identifiantPc: null }
  try {
    const v = JSON.parse(Buffer.from(octets).toString('utf8')) as Record<string, unknown>
    const id = typeof v.identifiantPc === 'string' && depuisHex(v.identifiantPc, TAILLE_IDENTIFIANT) !== null ? v.identifiantPc : null
    return { actif: v.actif === true, identifiantPc: id }
  } catch {
    return { actif: false, identifiantPc: null }
  }
}

// ---------- la liaison : des messages sur une socket ----------

/** Une commande du PC avant que la liaison lui donne son `id`. */
export type CommandeSansId = Omit<CommandeLister, 'id'> | Omit<CommandeLire, 'id'> | Omit<CommandePing, 'id'>

/** Ce que la liaison demande de sa socket (`tls.TLSSocket`). */
type SocketLiaison = tls.TLSSocket

function coupure(raison: string): ErreurDisque {
  return new ErreurDisque('UNKNOWN', `Liaison avec le téléphone coupée : ${raison}`)
}

/**
 * Des messages sur une socket, dans les deux sens. D'abord en file (`prochain`, pour l'accueil, où chaque message
 * est attendu à son tour), puis, après `servir`, chaque message reçu passe aussitôt au gestionnaire donné. Toute
 * trame hors limites ou mal formée ferme la liaison. Sert au serveur comme au faux téléphone.
 */
export class Liaison {
  private readonly socket: SocketLiaison
  private readonly decodeur: DecodeurTrames
  private file: Message[] = []
  private attente: { resoudre: (m: Message) => void; rejeter: (e: Error) => void; minuteur: NodeJS.Timeout } | null = null
  private gestionnaire: ((m: Message) => void) | null = null
  private finie = false
  private raison = ''
  private readonly rappelsFermeture: ((raison: string) => void)[] = []

  constructor(socket: SocketLiaison, limites: Limites = LIMITES_ACCUEIL) {
    this.socket = socket
    this.decodeur = new DecodeurTrames(limites)
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 10_000)
    socket.on('data', (morceau: Buffer) => this.recevoir(morceau))
    socket.on('end', () => {
      try {
        this.decodeur.fin()
        this.fermer("l'autre bout a fermé la liaison.")
      } catch (e) {
        this.fermer((e as Error).message)
      }
    })
    socket.on('error', (e) => this.fermer(e.message))
    socket.on('close', () => this.fermer('liaison fermée.'))
  }

  /** Vrai une fois la liaison fermée, d'un côté ou de l'autre. */
  get fermee(): boolean {
    return this.finie
  }

  /** Pourquoi la liaison s'est fermée. */
  get raisonFermeture(): string {
    return this.raison
  }

  /** Le certificat présenté par l'autre bout, en DER (côté téléphone : celui du PC). */
  certificatDistant(): Uint8Array | null {
    return this.socket.getPeerX509Certificate()?.raw ?? null
  }

  /** Passe aux limites larges : l'autre bout est reconnu. */
  elargir(): void {
    this.decodeur.limites = LIMITES
  }

  envoyer(message: Message): void {
    if (this.finie) throw coupure(this.raison)
    this.socket.write(encoderMessage(message))
  }

  /** Le prochain message reçu, en file ; échoue après `delaiMs` ou à la fermeture. */
  prochain(delaiMs: number): Promise<Message> {
    const deja = this.file.shift()
    if (deja) return Promise.resolve(deja)
    if (this.finie) return Promise.reject(coupure(this.raison))
    return new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => {
        this.attente = null
        rejeter(coupure('délai dépassé.'))
        this.fermer('délai dépassé.')
      }, delaiMs)
      this.attente = { resoudre, rejeter, minuteur }
    })
  }

  /** Chaque message, ceux déjà en file d'abord, passe désormais à `gestionnaire`. */
  servir(gestionnaire: (m: Message) => void): void {
    this.gestionnaire = gestionnaire
    const file = this.file
    this.file = []
    for (const m of file) if (!this.finie) gestionnaire(m)
  }

  /** Rappel à la fermeture, une fois ; aussitôt si elle est déjà fermée. */
  surFermeture(rappel: (raison: string) => void): void {
    if (this.finie) rappel(this.raison)
    else this.rappelsFermeture.push(rappel)
  }

  /** Envoie un refus, puis ferme proprement : l'autre bout le lit avant la fin. */
  refuser(raison: RaisonRefus): void {
    if (this.finie) return
    this.socket.write(encoderMessage({ type: 'refus', raison }))
    this.terminer(`refus (${raison}).`)
    this.socket.end()
    setTimeout(() => this.socket.destroy(), ATTENTE_FIN_MS).unref()
  }

  /** Ferme la liaison aussitôt. */
  fermer(raison = 'fermée par le PC.'): void {
    if (this.finie) return
    this.terminer(raison)
    this.socket.destroy()
  }

  private terminer(raison: string): void {
    this.finie = true
    this.raison = raison
    // La file est gardée : un `refus` reçu juste avant la fin se lit encore par `prochain`.
    if (this.attente) {
      clearTimeout(this.attente.minuteur)
      this.attente.rejeter(coupure(raison))
      this.attente = null
    }
    for (const rappel of this.rappelsFermeture.splice(0)) rappel(raison)
  }

  private recevoir(morceau: Buffer): void {
    if (this.finie) return
    let messages: Message[]
    try {
      messages = this.decodeur.pousser(morceau).map(lireMessage)
    } catch (e) {
      this.fermer((e as Error).message)
      return
    }
    for (const m of messages) {
      if (this.finie) return
      if (this.gestionnaire) this.gestionnaire(m)
      else if (this.attente) {
        const { resoudre, minuteur } = this.attente
        this.attente = null
        clearTimeout(minuteur)
        resoudre(m)
      } else this.file.push(m)
    }
  }
}

/** Les commandes du PC sur une liaison reconnue : chacune son `id`, sa réponse, son délai. */
class Commandes {
  private readonly liaison: Liaison
  private readonly enCours = new Map<number, { resoudre: (r: ReponseTelephone) => void; rejeter: (e: Error) => void; minuteur: NodeJS.Timeout }>()
  private suivant = 1

  constructor(liaison: Liaison) {
    this.liaison = liaison
    liaison.servir((m) => this.recevoir(m))
    liaison.surFermeture((raison) => {
      for (const attente of this.enCours.values()) {
        clearTimeout(attente.minuteur)
        attente.rejeter(coupure(raison))
      }
      this.enCours.clear()
    })
  }

  /** Envoie une commande et rend la réponse du téléphone ; sans réponse après `delaiMs`, la liaison est fermée. */
  envoyer(commande: CommandeSansId, delaiMs: number): Promise<ReponseTelephone> {
    if (this.liaison.fermee) return Promise.reject(coupure(this.liaison.raisonFermeture))
    const id = this.suivant
    this.suivant = id >= ID_MAX ? 1 : id + 1
    return new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => {
        this.enCours.delete(id)
        rejeter(new ErreurDisque('UNKNOWN', 'Le téléphone ne répond pas (délai dépassé).'))
        this.liaison.fermer('le téléphone ne répond plus.')
      }, delaiMs)
      this.enCours.set(id, { resoudre, rejeter, minuteur })
      try {
        this.liaison.envoyer({ ...commande, id } as Commande)
      } catch (e) {
        clearTimeout(minuteur)
        this.enCours.delete(id)
        rejeter(e as Error)
      }
    })
  }

  private recevoir(m: Message): void {
    if (m.type !== 'liste' && m.type !== 'bloc' && m.type !== 'pong' && m.type !== 'erreur') {
      this.liaison.fermer(`message inattendu du téléphone (« ${m.type} »).`)
      return
    }
    const attente = this.enCours.get(m.id)
    // Réponse à une commande déjà abandonnée : ignorée.
    if (!attente) return
    this.enCours.delete(m.id)
    clearTimeout(attente.minuteur)
    attente.resoudre(m)
  }
}

/** Erreur du téléphone en erreur du disque ; toute autre réponse que `attendu` est une faute de protocole. */
function reponseAttendue<T extends ReponseTelephone['type']>(r: ReponseTelephone, attendu: T): Extract<ReponseTelephone, { type: T }> {
  if (r.type === 'erreur') throw new ErreurDisque(r.code, r.message || 'Erreur du téléphone.')
  if (r.type !== attendu) throw new ErreurDisque('UNKNOWN', `Réponse inattendue du téléphone : « ${r.type} » au lieu de « ${attendu} ».`)
  return r as Extract<ReponseTelephone, { type: T }>
}

/**
 * Plus gros fichier lu sur le téléphone : 1 Gio. Un fichier de capteurs d'une longue session pèse quelques dizaines
 * de Mio ; au-delà, c'est un téléphone bogué ou hostile qui annonce une taille démesurée, et la lecture est refusée
 * avant d'envoyer la moindre commande (le fichier entier passe ensuite en mémoire, vers la page).
 */
export const TAILLE_FICHIER_MAX = 1_073_741_824

/**
 * Copie un fichier du téléphone vers `fichierLocal`, bloc après bloc ; chaque bloc doit avoir la longueur demandée
 * (un fichier qui a changé de taille depuis le listage fait échouer la lecture). En échec, le fichier local est effacé.
 */
async function lireParBlocs(commandes: Commandes, fichier: FichierTelephone, fichierLocal: string, delaiMs: number): Promise<void> {
  if (fichier.taille > TAILLE_FICHIER_MAX) {
    throw new ErreurDisque('UNKNOWN', `Fichier « ${fichier.chemin} » trop gros pour être lu : ${fichier.taille} octets annoncés, ${TAILLE_FICHIER_MAX} au plus.`)
  }
  const poignee = await open(fichierLocal, 'w')
  let complet = false
  try {
    for (const bloc of blocsDeLecture(fichier.taille)) {
      const r = reponseAttendue(await commandes.envoyer({ type: 'lire', chemin: fichier.chemin, ...bloc }, delaiMs), 'bloc')
      if (r.debut !== bloc.debut) throw new ErreurDisque('UNKNOWN', `Bloc inattendu de « ${fichier.chemin} » : début ${r.debut} au lieu de ${bloc.debut}.`)
      if (r.octets.length !== bloc.longueur) {
        throw new ErreurDisque('UNKNOWN', `Lecture incomplète de « ${fichier.chemin} » : le fichier a changé de taille sur le téléphone.`)
      }
      await poignee.write(r.octets, 0, r.octets.length, bloc.debut)
    }
    complet = true
  } finally {
    await poignee.close()
    if (!complet) await unlink(fichierLocal).catch(() => undefined)
  }
  const date = new Date(fichier.dateMs)
  await utimes(fichierLocal, date, date)
}

// ---------- le serveur ----------

/** Une adresse où le serveur écoute, avec le masque de son réseau (les questions de découverte en viennent). */
export type AdresseEcoute = { adresse: string; masque: string }

/** Résultat de l'essai d'auto-connexion : `bloque` quand le PC ne se joint pas lui-même sur son adresse. */
export type PareFeu = 'ouvert' | 'bloque' | 'inconnu'

/** Une fenêtre d'appairage ouverte, telle que la page l'affiche. */
export type AppairageOuvert = {
  /** Adresse à taper sur le téléphone si la découverte échoue : la première adresse privée du PC. */
  adresse: string
  port: number
  /** Code de 6 chiffres. */
  code: string
  /** Heure de fermeture, en millisecondes depuis 1970 (horloge du PC). */
  expireA: number
  /** Millisecondes avant la fermeture. */
  restantMs: number
}

/** Un téléphone relié en ce moment. */
export type TelephoneRelie = { id: string; nom: string }

/** État du sans-fil, tel que la page le lit. */
export type EtatSansFil = {
  /** Choisi par l'utilisateur, retenu dans le profil. */
  actif: boolean
  /** Vrai si le serveur écoute sur au moins une adresse. */
  ecoute: boolean
  port: number | null
  /** Adresses privées où le serveur écoute, la première étant celle à afficher. */
  adresses: string[]
  pareFeu: PareFeu
  /** Pourquoi le serveur n'écoute pas alors qu'il est activé, `null` sinon. */
  erreur: string | null
  /** Fenêtre d'appairage ouverte, `null` s'il n'y en a pas. */
  appairage: AppairageOuvert | null
  /** Téléphones reliés, le dernier arrivé en dernier. */
  relies: TelephoneRelie[]
}

/** Un téléphone appairé, et s'il est relié en ce moment. */
export type TelephoneListe = TelephoneVisible & { relie: boolean }

/** Avis envoyé quand un téléphone se présente ; `nouveau` s'il vient d'être appairé. */
export type AvisArrivee = { id: string; nom: string; nouveau: boolean }

export type OptionsSansFil = {
  stockage: StockageSansFil
  chiffreur: Chiffreur
  /** Adresses où écouter ; par défaut les adresses IPv4 privées du PC (`adressesPrivees`). */
  adresses?: () => AdresseEcoute[]
  /** Premier port essayé ; 0 : un port libre choisi par le système. */
  port?: number
  /** Port UDP de la découverte ; `null` : pas de découverte. */
  portSonde?: number | null
  /** Adresse où la découverte écoute : toutes, pour recevoir les diffusions. */
  hoteSonde?: string
  /** Nom du PC donné au téléphone. */
  nomPc?: string
  dureeFenetreMs?: number
  /** Essai d'auto-connexion après chaque mise à l'écoute. */
  essaiPareFeu?: boolean
  delais?: Partial<Delais>
  horloge?: Horloge
  alea?: Alea
  journal?: (message: string) => void
  /** Appelé quand un téléphone se présente et est reconnu. */
  surArrivee?: (avis: AvisArrivee) => void
}

/** Les adresses privées du PC, d'après ses cartes réseau. */
export function adressesDuPc(): AdresseEcoute[] {
  return adressesPrivees(os.networkInterfaces()).map(({ adresse, masque }) => ({ adresse, masque }))
}

/** Nom du PC pour le téléphone : celui de Windows, nettoyé (`nomPcPourSonde`), ou « PC » s'il n'en reste rien. */
export function nomDuPc(): string {
  return nomPcPourSonde(os.hostname()) || 'PC'
}

type Certificat = { cert: string; cle: string; empreinte: Uint8Array }
type Relie = TelephoneRelie & { liaison: Liaison; commandes: Commandes }

/**
 * Essai d'auto-connexion : le PC se joint lui-même sur son adresse et vérifie que c'est bien son certificat qui
 * répond. Une connexion refusée ou sans réponse dit qu'un pare-feu bloque.
 */
export function essayerAutoConnexion(adresse: string, port: number, empreinte: Uint8Array, delaiMs: number): Promise<PareFeu> {
  return new Promise((resoudre) => {
    let fini = false
    const socket = tls.connect({ host: adresse, port, rejectUnauthorized: false, minVersion: 'TLSv1.2' })
    const finir = (resultat: PareFeu) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      socket.destroy()
      resoudre(resultat)
    }
    const minuteur = setTimeout(() => finir('bloque'), delaiMs)
    socket.once('secureConnect', () => {
      const der = socket.getPeerX509Certificate()?.raw
      finir(der && egalATempsConstant(empreinteCertificat(der), empreinte) ? 'ouvert' : 'inconnu')
    })
    socket.once('error', (e: NodeJS.ErrnoException) => finir(e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'EHOSTUNREACH' ? 'bloque' : 'inconnu'))
  })
}

/** Le serveur sans fil du PC. Rien n'écoute avant `demarrer` (et seulement si le sans-fil a été activé). */
export class ServeurSansFil {
  private readonly stockage: StockageSansFil
  private readonly chiffreur: Chiffreur
  private readonly lireAdresses: () => AdresseEcoute[]
  private readonly portBase: number
  private readonly portSonde: number | null
  private readonly hoteSonde: string
  private readonly nomPc: string
  private readonly dureeFenetreMs: number | undefined
  private readonly essaiPareFeu: boolean
  private readonly delais: Delais
  private readonly horloge: Horloge
  private readonly alea: Alea
  private readonly journal: (message: string) => void
  private readonly surArrivee: (avis: AvisArrivee) => void
  /** Démarrages, arrêts et relevés d'adresses l'un après l'autre. */
  private readonly serie = enSerie()

  private charge: Promise<void> | null = null
  private actif = false
  /** Vrai entre la mise à l'écoute et l'extinction : hors de là, aucune connexion n'est accueillie. */
  private enService = false
  /** Écritures du registre, l'une après l'autre. */
  private fileRegistre: Promise<void> = Promise.resolve()
  private identifiantPc = ''
  private registre = new RegistreTelephones()
  private certificat: Certificat | null = null
  private serveurs = new Map<string, tls.Server>()
  private adresses: AdresseEcoute[] = []
  private port: number | null = null
  private erreur: string | null = null
  private pareFeu: PareFeu = 'inconnu'
  private sonde: dgram.Socket | null = null
  private reponsesSonde = { seconde: 0, nombre: 0 }
  private releve: NodeJS.Timeout | null = null
  private fenetre: FenetreAppairage | null = null
  private readonly inconnues = new Set<Liaison>()
  /** Téléphones reliés, dans l'ordre d'arrivée. */
  private readonly relies = new Map<string, Relie>()

  constructor(options: OptionsSansFil) {
    this.stockage = options.stockage
    this.chiffreur = options.chiffreur
    this.lireAdresses = options.adresses ?? adressesDuPc
    this.portBase = options.port ?? PORT_SANS_FIL
    this.portSonde = options.portSonde === undefined ? PORT_SONDE : options.portSonde
    this.hoteSonde = options.hoteSonde ?? '0.0.0.0'
    this.nomPc = options.nomPc ?? nomDuPc()
    this.dureeFenetreMs = options.dureeFenetreMs
    this.essaiPareFeu = options.essaiPareFeu ?? true
    this.delais = { ...DELAIS, ...options.delais }
    this.horloge = options.horloge ?? Date.now
    this.alea = options.alea ?? randomBytes
    this.journal = options.journal ?? (() => undefined)
    this.surArrivee = options.surArrivee ?? (() => undefined)
  }

  /** Relit les réglages et le registre du profil, et met le serveur à l'écoute si le sans-fil a été activé. */
  demarrer(): Promise<void> {
    return this.serie(async () => {
      await this.charger()
      if (this.actif && this.serveurs.size === 0) await this.allumer()
    })
  }

  /** Arrête tout (serveur, découverte, liaisons, fenêtre) sans changer le choix retenu. */
  arreter(): Promise<void> {
    return this.serie(() => this.eteindre())
  }

  async etat(): Promise<EtatSansFil> {
    return this.serie(async () => {
      await this.charger()
      if (this.actif) await this.actualiserAdresses(this.pareFeu !== 'ouvert')
      return this.etatCourant()
    })
  }

  /** Active ou éteint le sans-fil ; le choix est retenu dans le profil. Éteindre garde les téléphones appairés. */
  async activer(actif: boolean): Promise<EtatSansFil> {
    return this.serie(async () => {
      await this.charger()
      this.actif = actif
      await this.sauverReglages()
      if (actif) {
        if (this.serveurs.size === 0) await this.allumer()
      } else await this.eteindre()
      return this.etatCourant()
    })
  }

  /** Ouvre une fenêtre d'appairage (la précédente se ferme). Le sans-fil doit être activé et à l'écoute. */
  async ouvrirAppairage(): Promise<AppairageOuvert> {
    return this.serie(async () => {
      await this.charger()
      if (!this.actif) throw new ErreurDisque('UNKNOWN', "Le sans-fil est éteint : l'activer avant d'appairer un téléphone.")
      await this.actualiserAdresses(false)
      const certificat = this.certificat
      if (this.port === null || this.adresses.length === 0 || certificat === null) {
        throw new ErreurDisque('UNKNOWN', this.erreur ?? "Le PC n'écoute sur aucun réseau local.")
      }
      this.fenetre?.fermer()
      this.fenetre = new FenetreAppairage({ empreinte: certificat.empreinte, horloge: this.horloge, alea: this.alea, dureeMs: this.dureeFenetreMs })
      this.journal(`fenêtre d'appairage ouverte sur ${this.adresses[0].adresse}:${this.port}`)
      return this.appairageVisible() as AppairageOuvert
    })
  }

  /** Téléphones appairés, dans l'ordre d'appairage. */
  async telephones(): Promise<TelephoneListe[]> {
    await this.serie(() => this.charger())
    return this.registre.liste().map((t) => ({ ...t, relie: this.relies.has(t.id) }))
  }

  /** Retire un téléphone : son jeton ne vaut plus rien, et sa liaison en cours se ferme. Faux s'il n'était pas appairé. */
  async retirer(id: string): Promise<boolean> {
    return this.serie(async () => {
      await this.charger()
      if (!this.registre.retirer(id)) return false
      await this.sauverRegistre()
      this.relies.get(id)?.liaison.fermer('téléphone retiré.')
      this.journal('téléphone retiré')
      return true
    })
  }

  /** Port UDP où la découverte écoute, `null` si elle n'écoute pas. */
  portDecouverte(): number | null {
    return this.sonde ? this.sonde.address().port : null
  }

  /** Le dossier mémoire du dernier téléphone relié, en lecture seule ; absent tant qu'aucun téléphone n'est relié. */
  dossierSansFil(): DossierDistant {
    /** Le téléphone du dernier listage : les lectures ne vont qu'à lui. */
    let liste: Relie | null = null
    const courant = (): Relie | null => {
      let dernier: Relie | null = null
      for (const r of this.relies.values()) dernier = r
      return dernier
    }
    return {
      etat: async (): Promise<EtatTelephone> => {
        const r = courant()
        return r ? { etat: 'pret', nom: r.nom, canal: 'sansFil' } : { etat: 'absent' }
      },
      lister: async () => {
        const r = courant()
        liste = r
        if (!r) throw pasPret('absent')
        return reponseAttendue(await r.commandes.envoyer({ type: 'lister' }, this.delais.commande), 'liste').fichiers
      },
      lire: async (fichier, fichierLocal) => {
        if (!liste || liste.liaison.fermee) throw new ErreurDisque('UNKNOWN', "Le téléphone n'est plus relié depuis le listage.")
        await lireParBlocs(liste.commandes, fichier, fichierLocal, this.delais.commande)
      },
    }
  }

  // ---------- réglages, registre, certificat ----------

  private charger(): Promise<void> {
    this.charge ??= (async () => {
      const reglages = reglagesLus(await this.stockage.lire(FICHIER_REGLAGES))
      this.actif = reglages.actif
      this.identifiantPc = reglages.identifiantPc ?? tirerIdentifiant(this.alea)
      const registre = await this.stockage.lire(FICHIER_TELEPHONES)
      this.registre = RegistreTelephones.depuisJson(registre === null ? null : Buffer.from(registre).toString('utf8'))
    })().catch((e) => {
      this.charge = null
      throw e
    })
    return this.charge
  }

  private async sauverReglages(): Promise<void> {
    const reglages: Reglages & { version: number } = { version: 1, actif: this.actif, identifiantPc: this.identifiantPc }
    await this.stockage.ecrire(FICHIER_REGLAGES, Buffer.from(JSON.stringify(reglages, null, 2) + '\n', 'utf8'))
  }

  /**
   * Écrit le registre, à la suite des écritures précédentes ; son texte est pris au moment d'écrire, si bien qu'une
   * écriture lente ne peut pas remettre sur le disque un téléphone retiré entre-temps.
   */
  private sauverRegistre(): Promise<void> {
    const suite = this.fileRegistre.then(() => this.stockage.ecrire(FICHIER_TELEPHONES, Buffer.from(this.registre.enJson(), 'utf8')))
    this.fileRegistre = suite.catch(() => undefined)
    return suite
  }

  /** Vrai si le téléphone est encore appairé (il a pu être retiré pendant une attente). */
  private inscrit(id: string): boolean {
    return this.registre.liste().some((t) => t.id === id)
  }

  /** Le certificat du profil s'il sert encore ; sinon un neuf, gardé (clé chiffrée) si le système sait chiffrer. */
  private async chargerCertificat(): Promise<Certificat> {
    const maintenant = this.horloge()
    const chiffrement = await this.chiffreur.disponible().catch(() => false)
    if (!chiffrement) {
      this.journal("chiffrement du système indisponible : certificat gardé pour ce lancement seulement")
      const f = fabriquerCertificat({ maintenant, alea: this.alea })
      return { cert: f.certificat, cle: f.cle, empreinte: f.empreinte }
    }
    const pem = await this.stockage.lire(FICHIER_CERTIFICAT)
    const cleChiffree = await this.stockage.lire(FICHIER_CLE)
    if (pem !== null && cleChiffree !== null) {
      try {
        const cert = Buffer.from(pem).toString('utf8')
        const cle = await this.chiffreur.dechiffrer(cleChiffree)
        if (certificatUtilisable(cert, cle, maintenant)) return { cert, cle, empreinte: empreinteCertificat(cert) }
      } catch {
        // Clé illisible (profil copié d'un autre compte) : un certificat neuf, les téléphones se réappaireront.
      }
      this.journal('certificat du profil inutilisable : un neuf est fabriqué')
    }
    const f = fabriquerCertificat({ maintenant, alea: this.alea })
    // La clé d'abord : un certificat sans sa clé serait refait au prochain lancement, jamais l'inverse.
    await this.stockage.ecrire(FICHIER_CLE, await this.chiffreur.chiffrer(f.cle))
    await this.stockage.ecrire(FICHIER_CERTIFICAT, Buffer.from(f.certificat, 'utf8'))
    return { cert: f.certificat, cle: f.cle, empreinte: f.empreinte }
  }

  // ---------- écoute ----------

  private async allumer(): Promise<void> {
    try {
      this.certificat ??= await this.chargerCertificat()
    } catch (e) {
      this.erreur = `Certificat du sans-fil impossible à préparer : ${(e as Error).message}`
      this.journal(this.erreur)
      return
    }
    this.enService = true
    await this.ecouter()
    await this.ouvrirSonde()
    if (this.port !== null && this.essaiPareFeu) await this.essayerPareFeu()
    this.releve ??= setInterval(() => void this.serie(() => this.actualiserAdresses(false)).catch(() => undefined), this.delais.intervalleAdresses)
    this.releve.unref()
  }

  private async eteindre(): Promise<void> {
    // D'abord : une poignée TLS qui finit pendant l'extinction n'est plus accueillie.
    this.enService = false
    if (this.releve) clearInterval(this.releve)
    this.releve = null
    this.fenetre?.fermer()
    this.fenetre = null
    for (const r of this.relies.values()) r.liaison.fermer('sans-fil éteint.')
    for (const l of this.inconnues) l.fermer('sans-fil éteint.')
    await Promise.all([...this.serveurs.values()].map(fermerServeur))
    this.serveurs = new Map()
    this.adresses = []
    this.port = null
    this.erreur = null
    this.pareFeu = 'inconnu'
    const sonde = this.sonde
    this.sonde = null
    if (sonde) await new Promise<void>((fin) => sonde.close(() => fin()))
  }

  private ouvrirServeur(hote: string, port: number, certificat: Certificat): Promise<tls.Server> {
    return new Promise((resoudre, rejeter) => {
      const serveur = tls.createServer(
        { cert: certificat.cert, key: certificat.cle, minVersion: 'TLSv1.2', handshakeTimeout: this.delais.poignee },
        (socket) => this.accueillir(socket),
      )
      serveur.maxConnections = CONNEXIONS_MAX
      suivreConnexions(serveur)
      // Poignée de main ratée (inconnu, client qui n'est pas en TLS) : la socket est déjà détruite par Node.
      serveur.on('tlsClientError', () => undefined)
      const echec = (e: Error) => {
        serveur.close()
        rejeter(e)
      }
      serveur.once('error', echec)
      serveur.listen({ host: hote, port, exclusive: true }, () => {
        serveur.off('error', echec)
        serveur.on('error', (e) => this.journal(`serveur sans fil (${hote}) : ${e.message}`))
        resoudre(serveur)
      })
    })
  }

  /**
   * Met le serveur à l'écoute sur chaque adresse, au même port : le premier, ou le suivant s'il est pris sur l'une
   * d'elles. Une adresse qui refuse pour une autre raison (carte qui vient de disparaître) est laissée de côté.
   */
  private async ecouter(): Promise<void> {
    const certificat = this.certificat
    if (!certificat) return
    const voulues = this.lireAdresses()
    this.adresses = []
    this.port = null
    if (voulues.length === 0) {
      this.erreur = 'Aucun réseau local privé : brancher le PC sur le Wi-Fi ou le réseau de la maison.'
      this.journal(this.erreur)
      return
    }
    for (let essai = 0; essai < (this.portBase === 0 ? 3 : ESSAIS_PORT); essai++) {
      const ouverts = new Map<string, tls.Server>()
      let port = this.portBase === 0 ? 0 : this.portBase + essai
      let pris = false
      for (const a of voulues) {
        try {
          const serveur = await this.ouvrirServeur(a.adresse, port, certificat)
          ouverts.set(a.adresse, serveur)
          port = (serveur.address() as AddressInfo).port
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code
          if (code === 'EADDRINUSE' || code === 'EACCES') {
            pris = true
            break
          }
          this.journal(`écoute impossible sur ${a.adresse} : ${(e as Error).message}`)
        }
      }
      if (pris) {
        await Promise.all([...ouverts.values()].map(fermerServeur))
        continue
      }
      if (ouverts.size === 0) {
        this.erreur = "Le PC n'arrive à écouter sur aucune de ses adresses."
        return
      }
      this.serveurs = ouverts
      this.adresses = voulues.filter((a) => ouverts.has(a.adresse))
      this.port = port
      this.erreur = null
      this.journal(`sans-fil à l'écoute : ${this.adresses.map((a) => a.adresse).join(', ')}, port ${port}`)
      return
    }
    this.erreur = `Aucun port libre de ${this.portBase} à ${this.portBase + ESSAIS_PORT - 1}.`
    this.journal(this.erreur)
  }

  /** Suit les adresses du PC (Wi-Fi changé, adresse renouvelée) : écoute sur les nouvelles, lâche les disparues. */
  private async actualiserAdresses(retesterPareFeu: boolean): Promise<void> {
    if (!this.actif || !this.certificat) return
    const voulues = this.lireAdresses()
    const cles = (liste: AdresseEcoute[]) => liste.map((a) => `${a.adresse}/${a.masque}`).join(' ')
    let change = cles(voulues) !== cles(this.adresses)
    if (change && this.port === null) await this.ecouter()
    else if (change && this.port !== null) {
      const port = this.port
      const gardees = new Set(voulues.map((a) => a.adresse))
      for (const [adresse, serveur] of this.serveurs) {
        if (gardees.has(adresse)) continue
        this.serveurs.delete(adresse)
        await fermerServeur(serveur)
      }
      for (const a of voulues) {
        if (this.serveurs.has(a.adresse)) continue
        try {
          this.serveurs.set(a.adresse, await this.ouvrirServeur(a.adresse, port, this.certificat))
        } catch (e) {
          this.journal(`écoute impossible sur ${a.adresse} : ${(e as Error).message}`)
        }
      }
      this.adresses = voulues.filter((a) => this.serveurs.has(a.adresse))
      if (this.serveurs.size === 0) {
        this.port = null
        await this.ecouter()
      }
      change = true
    }
    if (this.port !== null && this.essaiPareFeu && (change || retesterPareFeu)) await this.essayerPareFeu()
  }

  private async essayerPareFeu(): Promise<void> {
    const certificat = this.certificat
    if (this.port === null || this.adresses.length === 0 || !certificat) return
    this.pareFeu = await essayerAutoConnexion(this.adresses[0].adresse, this.port, certificat.empreinte, this.delais.pareFeu)
    if (this.pareFeu !== 'ouvert') this.journal(`essai d'auto-connexion : ${this.pareFeu}`)
  }

  // ---------- découverte ----------

  private async ouvrirSonde(): Promise<void> {
    if (this.portSonde === null || this.sonde) return
    const sonde = dgram.createSocket({ type: 'udp4', reuseAddr: false })
    sonde.on('message', (paquet, source) => this.repondreSonde(sonde, paquet, source))
    try {
      await new Promise<void>((fin, echec) => {
        sonde.once('error', echec)
        sonde.bind({ port: this.portSonde as number, address: this.hoteSonde, exclusive: true }, () => {
          sonde.off('error', echec)
          fin()
        })
      })
      sonde.on('error', (e) => this.journal(`découverte : ${e.message}`))
      this.sonde = sonde
    } catch (e) {
      // Port pris (un autre Gtracker) : le téléphone tapera l'adresse affichée.
      this.journal(`découverte impossible : ${(e as Error).message}`)
      sonde.close()
    }
  }

  private repondreSonde(sonde: dgram.Socket, paquet: Buffer, source: dgram.RemoteInfo): void {
    const question = decoderQuestion(paquet)
    if (!question || this.port === null) return
    if (!this.adresses.some((a) => memeReseau(source.address, a.adresse, a.masque))) return
    const seconde = Math.floor(this.horloge() / 1000)
    if (seconde !== this.reponsesSonde.seconde) this.reponsesSonde = { seconde, nombre: 0 }
    if (++this.reponsesSonde.nombre > REPONSES_SONDE_PAR_SECONDE) return
    const reponse = encoderReponse({ nonce: question.nonce, port: this.port, identifiant: Buffer.from(this.identifiantPc, 'hex'), nom: nomPcPourSonde(this.nomPc) })
    sonde.send(reponse, source.port, source.address, () => undefined)
  }

  // ---------- accueil d'un téléphone ----------

  private accueillir(socket: tls.TLSSocket): void {
    if (!this.enService || this.inconnues.size >= INCONNUES_MAX) {
      socket.destroy()
      return
    }
    const liaison = new Liaison(socket)
    this.inconnues.add(liaison)
    liaison.surFermeture(() => this.inconnues.delete(liaison))
    void this.accueil(liaison).catch((e) => liaison.fermer((e as Error).message))
  }

  private async accueil(liaison: Liaison): Promise<void> {
    const premier = await liaison.prochain(this.delais.accueil)
    if (premier.type === 'appairer') await this.appairer(liaison, premier)
    else if (premier.type === 'bonjour') await this.bonjour(liaison, premier)
    else liaison.fermer(`message inattendu à l'accueil (« ${premier.type} »).`)
  }

  private async appairer(liaison: Liaison, m: MessageAppairer): Promise<void> {
    if (m.version !== PROTOCOLE_SANS_FIL) return liaison.refuser('version')
    const fenetre = this.fenetre
    if (!fenetre) return liaison.refuser('fenetre')
    const tentative = fenetre.commencer(depuisHex(m.nonceTelephone, 32) as Uint8Array)
    if (!tentative.ok) return liaison.refuser(tentative.raison)
    liaison.envoyer({ type: 'defi', noncePc: enHex(tentative.noncePc) })
    const r = await liaison.prochain(this.delais.accueil)
    if (r.type !== 'preuve') return liaison.fermer(`message inattendu pendant l'appairage (« ${r.type} »).`)
    const conclusion = tentative.conclure(depuisHex(r.preuve, 32) as Uint8Array)
    if (!conclusion.ok) {
      this.journal(`appairage refusé : ${conclusion.raison}`)
      return liaison.refuser(conclusion.raison)
    }
    const telephone = this.registre.ajouter(m.nom, conclusion.jeton, this.horloge(), this.alea)
    // Inscrit avant d'envoyer le jeton : un PC arrêté juste après ne laisse pas au téléphone un jeton inconnu.
    await this.sauverRegistre()
    if (!this.admissibleApresAttente(liaison, telephone.id)) return
    liaison.envoyer({ type: 'appaire', preuve: enHex(conclusion.preuvePc), jeton: enHex(conclusion.jeton), identifiantPc: this.identifiantPc, nomPc: this.nomPc })
    this.reconnaitre(liaison, telephone, true)
  }

  private async bonjour(liaison: Liaison, m: MessageBonjour): Promise<void> {
    if (m.version !== PROTOCOLE_SANS_FIL) return liaison.refuser('version')
    const telephone = this.registre.verifier(m.jeton)
    if (!telephone) {
      this.journal('jeton inconnu ou révoqué : refusé')
      return liaison.refuser('jeton')
    }
    this.registre.marquerVu(telephone.id, this.horloge())
    await this.sauverRegistre()
    if (!this.admissibleApresAttente(liaison, telephone.id)) return
    liaison.envoyer({ type: 'bienvenue', identifiantPc: this.identifiantPc, nomPc: this.nomPc })
    this.reconnaitre(liaison, telephone, false)
  }

  /**
   * Après l'écriture du registre, le monde a pu changer : sans-fil éteint (liaison fermée), téléphone retiré entre-temps
   * (refus `jeton`). Vrai si la liaison peut encore être reconnue.
   */
  private admissibleApresAttente(liaison: Liaison, id: string): boolean {
    if (liaison.fermee) return false
    if (!this.enService) {
      liaison.fermer('sans-fil éteint.')
      return false
    }
    if (!this.inscrit(id)) {
      this.journal('téléphone retiré pendant sa présentation : refusé')
      liaison.refuser('jeton')
      return false
    }
    return true
  }

  private reconnaitre(liaison: Liaison, telephone: TelephoneVisible, nouveau: boolean): void {
    this.inconnues.delete(liaison)
    liaison.elargir()
    const relie: Relie = { id: telephone.id, nom: telephone.nom, liaison, commandes: new Commandes(liaison) }
    this.relies.get(telephone.id)?.liaison.fermer('remplacée par une liaison plus récente du même téléphone.')
    this.relies.delete(telephone.id)
    this.relies.set(telephone.id, relie)
    const ping = setInterval(() => void relie.commandes.envoyer({ type: 'ping' }, this.delais.ping).catch(() => undefined), this.delais.intervallePing)
    ping.unref()
    liaison.surFermeture((raison) => {
      clearInterval(ping)
      if (this.relies.get(telephone.id) === relie) this.relies.delete(telephone.id)
      this.journal(`téléphone parti : ${raison}`)
    })
    this.journal(`téléphone arrivé${nouveau ? ', appairé' : ''}`)
    this.surArrivee({ id: telephone.id, nom: telephone.nom, nouveau })
  }

  // ---------- état ----------

  private appairageVisible(): AppairageOuvert | null {
    const f = this.fenetre
    if (!f || !f.ouverte() || this.port === null || this.adresses.length === 0) return null
    return { adresse: this.adresses[0].adresse, port: this.port, code: f.code, expireA: f.expireA, restantMs: f.restantMs() }
  }

  private etatCourant(): EtatSansFil {
    return {
      actif: this.actif,
      ecoute: this.port !== null,
      port: this.port,
      adresses: this.adresses.map((a) => a.adresse),
      pareFeu: this.port === null ? 'inconnu' : this.pareFeu,
      erreur: this.actif ? this.erreur : null,
      appairage: this.appairageVisible(),
      relies: [...this.relies.values()].map(({ id, nom }) => ({ id, nom })),
    }
  }
}

/** Sockets ouvertes de chaque serveur, poignées TLS en cours comprises. */
const connexions = new WeakMap<tls.Server, Set<Socket>>()

function suivreConnexions(serveur: tls.Server): void {
  const ouvertes = new Set<Socket>()
  connexions.set(serveur, ouvertes)
  serveur.on('connection', (socket: Socket) => {
    ouvertes.add(socket)
    socket.once('close', () => ouvertes.delete(socket))
  })
}

/**
 * Ferme un serveur et coupe toutes ses sockets, liaisons reconnues et poignées en cours : sans cela, la fermeture
 * attendrait que chacune finisse d'elle-même (jusqu'à l'échec d'un ping), et tout ce qui la suit avec elle.
 */
function fermerServeur(serveur: tls.Server): Promise<void> {
  return new Promise((fin) => {
    serveur.close(() => fin())
    for (const socket of connexions.get(serveur) ?? []) socket.destroy()
  })
}

// ---------- le Wi-Fi d'abord, sinon le câble ----------

/**
 * Un seul dossier distant pour la page : le téléphone relié par le Wi-Fi s'il y en a un, sinon celui du câble. Le
 * canal est choisi au listage, et les lectures, écritures et effacements qui suivent passent par le même ; l'état prêt
 * dit son canal et s'il sait écrire. Un canal qui ne sait pas écrire (le sans-fil, aujourd'hui) refuse l'écriture et
 * l'effacement, sans jamais les passer à l'autre canal.
 */
export function dossierSansFilPuisCable(sansFil: DossierDistant, cable: DossierDistant): DossierDistant {
  let choisi: DossierDistant = cable
  const ecrit = (d: DossierDistant) => typeof d.ecrire === 'function' && typeof d.effacer === 'function'
  const refus = () => new ErreurDisque('UNKNOWN', 'Ce canal ne sait pas écrire sur le téléphone.')
  return {
    async etat() {
      const e = await sansFil.etat()
      if (e.etat === 'pret') return { ...e, ecriture: ecrit(sansFil) }
      const c = await cable.etat()
      return c.etat === 'pret' ? { ...c, canal: 'cable', ecriture: ecrit(cable) } : c
    },
    async lister() {
      choisi = (await sansFil.etat()).etat === 'pret' ? sansFil : cable
      return choisi.lister()
    },
    lire(fichier, fichierLocal) {
      return choisi.lire(fichier, fichierLocal)
    },
    async ecrire(chemin, fichierLocal, taille) {
      if (!choisi.ecrire) throw refus()
      return choisi.ecrire(chemin, fichierLocal, taille)
    },
    async effacer(chemin) {
      if (!choisi.effacer) throw refus()
      return choisi.effacer(chemin)
    },
  }
}

// ---------- les canaux de la page ----------

/** Canaux servis ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_SANS_FIL = ['etat', 'activer', 'ouvrirAppairage', 'telephones', 'retirer'] as const

/** Canal de l'avis envoyé à la page quand un téléphone se présente (`AvisArrivee`). */
export const AVIS_ARRIVEE = 'sansfil:arrive'

function champ(argument: unknown, nom: string): unknown {
  return typeof argument === 'object' && argument !== null && !Array.isArray(argument) ? (argument as Record<string, unknown>)[nom] : undefined
}

/**
 * Gestionnaires des canaux `sansfil:*`, à brancher par `brancherCanaux` :
 * - `sansfil:etat` rend un `EtatSansFil` ;
 * - `sansfil:activer({ actif })` active ou éteint, et rend l'`EtatSansFil` qui suit ;
 * - `sansfil:ouvrirAppairage` rend un `AppairageOuvert` ;
 * - `sansfil:telephones` rend les `TelephoneListe` ;
 * - `sansfil:retirer({ id })` rend vrai si le téléphone était appairé.
 */
export function gestionnairesSansFil(serveur: ServeurSansFil): Record<string, Gestionnaire> {
  return {
    'sansfil:etat': () => enReponse(() => serveur.etat()),
    'sansfil:activer': (argument) =>
      enReponse(async () => {
        const actif = champ(argument, 'actif')
        if (typeof actif !== 'boolean') throw new ErreurDisque('UNKNOWN', 'Message mal formé : « actif » doit être vrai ou faux.')
        return serveur.activer(actif)
      }),
    'sansfil:ouvrirAppairage': () => enReponse(() => serveur.ouvrirAppairage()),
    'sansfil:telephones': () => enReponse(() => serveur.telephones()),
    'sansfil:retirer': (argument) =>
      enReponse(async () => {
        const id = champ(argument, 'id')
        if (typeof id !== 'string' || depuisHex(id, TAILLE_IDENTIFIANT) === null) throw new ErreurDisque('UNKNOWN', 'Message mal formé : « id » doit être un identifiant de téléphone.')
        return serveur.retirer(id)
      }),
  }
}

// ---------- mode d'essai ----------

/** Réglages du serveur que le mode d'essai remplace. */
export type EssaiSansFil = Pick<OptionsSansFil, 'adresses' | 'port' | 'portSonde' | 'hoteSonde' | 'nomPc' | 'dureeFenetreMs'> & {
  /** Dossier des secrets, `null` : celui du profil d'essai. */
  dossier: string | null
  /** Sans-fil activé dès le lancement. */
  actif: boolean
}

/** Nom du PC en mode d'essai, le même sur tous les postes pour que les relevés du banc ne changent pas. */
export const NOM_PC_ESSAI = "PC d'essai"

/**
 * Réglages du sans-fil d'essai d'après l'environnement, `null` hors du mode d'essai (`GTRACKER_BANC=1`), où les
 * variables ne sont pas lues. En mode d'essai, le serveur n'écoute que sur 127.0.0.1.
 */
export function essaiSansFilDepuisEnvironnement(env: Record<string, string | undefined>, journal: (message: string) => void = () => undefined): EssaiSansFil | null {
  if (env.GTRACKER_BANC !== '1') return null
  const entier = (nom: string, max: number): number | null => {
    const brut = env[nom]?.trim() ?? ''
    if (brut === '') return null
    if (/^\d+$/.test(brut) && Number(brut) <= max) return Number(brut)
    journal(`${nom} illisible, ignorée : ${brut}`)
    return null
  }
  const port = entier('GTRACKER_BANC_SANSFIL_PORT', 65535) ?? 0
  const portSonde = entier('GTRACKER_BANC_SANSFIL_SONDE', 65535)
  const dureeFenetreMs = entier('GTRACKER_BANC_SANSFIL_FENETRE_MS', 3_600_000) ?? undefined
  const dossier = env.GTRACKER_BANC_SANSFIL_PROFIL?.trim() ? path.resolve(env.GTRACKER_BANC_SANSFIL_PROFIL) : null
  const actif = env.GTRACKER_BANC_SANSFIL_ACTIF === '1'
  journal(`sans-fil d'essai : 127.0.0.1, port ${port || 'libre'}, découverte ${portSonde ?? 'aucune'}${dureeFenetreMs ? `, fenêtre ${dureeFenetreMs} ms` : ''}${actif ? ', activé' : ''}`)
  return {
    adresses: () => [{ adresse: '127.0.0.1', masque: '255.0.0.0' }],
    port,
    portSonde,
    hoteSonde: '127.0.0.1',
    nomPc: NOM_PC_ESSAI,
    dureeFenetreMs,
    dossier,
    actif,
  }
}
