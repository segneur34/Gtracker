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
//   liaison. Le dernier téléphone arrivé est celui que lit `dossierSansFil()` ; son arrivée et son départ, avec la
//   raison (`classerDepart`), sont annoncés (`surArrivee`, `surDepart`), et l'heure du départ est gardée pour la liste ;
// - un téléphone qui annonce la capacité « ecriture » (`CAPACITE_ECRITURE`) est listé en entier (racine, `sessions/`,
//   `itineraires/`, `reglages/`) et reçoit aussi `ecrire` par blocs de 1 Mio, `valider` et `effacer` ; un téléphone
//   plus ancien n'en reçoit jamais, son état prêt dit `ecriture: false` et `itineraires: false`. Un téléphone qui
//   enregistre une session (champ `enregistre` de `pong`) refuse d'écrire : l'état prêt dit alors `ecriture: false`
//   et `enregistrement: true`.
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
//   GTRACKER_BANC_SANSFIL_PAREFEU    pare-feu d'essai : « ouvert » (défaut), « bloque » (réparable) ou « irreparable »
//   GTRACKER_BANC_SANSFIL_AUTORISATION issue de la demande d'autorisation d'essai : « accordee » (défaut, le pare-feu
//                                    « bloque » s'ouvre), « refusee » ou « echec »
// En mode d'essai, le pare-feu est toujours factice : jamais Windows PowerShell.
//
// Pare-feu de Windows (`pareFeu.ts`) : relevé et jugé après chaque mise à l'écoute, et relu toutes les 30 secondes tant
// qu'il n'est pas ouvert ; si le relevé ne se lit pas, l'essai d'auto-connexion (`essayerAutoConnexion`) sert de repli
// et ne peut qu'affirmer un blocage (son « ouvert » devient « inconnu »). Un relevé raté est noté au journal avec sa
// raison (une fois par raison), refait une fois une quinzaine de secondes plus tard, puis à chaque relevé des adresses
// jusqu'à ce qu'il se lise : un échec au lancement ne laisse pas la page sans nouvelles du pare-feu. Le relevé ne passe
// pas par la file du serveur (l'état, l'appairage et l'arrêt répondent pendant qu'il traîne), jamais plus d'un à la
// fois, et son résultat est jeté si l'écoute a changé entre-temps. Quand l'utilisateur allume le sans-fil et que
// le relevé dit bloqué et réparable, l'autorisation de Gtracker est demandée avant la mise à l'écoute : Windows ne pose
// plus sa propre question (réseaux privés ou publics). Refusée ou en échec, le sans-fil s'allume quand même, et la
// page propose de la redemander (`sansfil:autoriser`). Au lancement, avec le sans-fil déjà allumé, rien n'est demandé.

import type { AddressInfo, Socket } from 'node:net'
import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
import { mkdir, open, readFile, stat, unlink, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import type { Alea, Horloge, TelephoneVisible } from './appairage'
import { FenetreAppairage, RegistreTelephones, TAILLE_IDENTIFIANT, depuisHex, egalATempsConstant, enHex, tirerIdentifiant } from './appairage'
import { certificatUtilisable, empreinteCertificat, fabriquerCertificat } from './certificat'
import { ErreurDisque, codeDe, ecrireAtomique } from './disque'
import type { Journaliser } from './journal'
import type { ContexteEcoute, IssueAutorisation, JugementPareFeu, LecturePareFeu, PareFeu, ResultatAutorisation } from './pareFeu'
import { ESSAIS_PORT, releveRate } from './pareFeu'
import type { Gestionnaire } from './pont'
import { enReponse } from './pont'
import { decoderQuestion, encoderReponse, adressesPrivees, identifiantDeSonde, memeReseau, nomPcPourSonde, PORT_SONDE, questionDAutreVersion } from './sonde'
import type { DossierDistant, EtatTelephone, FichierTelephone } from './telephone'
import { cheminAdmis, cheminEcrivable, cheminRefuse, enSerie, fichiersAdmis, pasPret } from './telephone'
import type {
  Capacite,
  Commande,
  CommandeEcrire,
  CommandeEffacer,
  CommandeLire,
  CommandeLister,
  CommandePing,
  CommandeValider,
  Limites,
  Message,
  MessageBonjour,
  MessageAppairer,
  RaisonRefus,
  ReponseTelephone,
} from './trames'
import {
  CAPACITE_ECRITURE,
  DecodeurTrames,
  ID_MAX,
  LIMITES,
  LIMITES_ACCUEIL,
  PROTOCOLE_SANS_FIL,
  PORT_SANS_FIL,
  TAILLE_NONCE,
  TAILLE_PART_SPAKE2,
  TAILLE_PREUVE,
  blocsDEcriture,
  blocsDeLecture,
  capacitesDe,
  encoderMessage,
  lireMessage,
} from './trames'

/** Dossier des secrets du sans-fil, dans le profil du programme. */
export const DOSSIER_SANS_FIL = 'sansfil'

export const FICHIER_REGLAGES = 'reglages.json'
export const FICHIER_TELEPHONES = 'telephones.json'
export const FICHIER_CERTIFICAT = 'certificat.pem'
export const FICHIER_CLE = 'cle.bin'

export { ESSAIS_PORT }
export type { PareFeu }

/** Délais de la liaison, en millisecondes. */
export type Delais = {
  /** Pour la poignée de main TLS. */
  poignee: number
  /**
   * Pour le premier message d'un inconnu (`appairer` ou `bonjour`), qu'un téléphone envoie dès la poignée faite : court,
   * pour qu'une connexion muette ne garde pas longtemps une place d'inconnu.
   */
  presentation: number
  /** Pour chaque message suivant de l'accueil (preuve). */
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
  /**
   * Après un relevé du pare-feu raté, avant de le refaire une fois ; plus court que `intervalleAdresses`, pour qu'un
   * Windows encore occupé au lancement du programme ne laisse pas la page sans nouvelles pendant une demi-minute.
   */
  nouveauRelevePareFeu: number
}

export const DELAIS: Readonly<Delais> = Object.freeze({
  poignee: 10_000,
  presentation: 3_000,
  accueil: 10_000,
  commande: 30_000,
  intervallePing: 15_000,
  ping: 20_000,
  intervalleAdresses: 30_000,
  pareFeu: 2_000,
  nouveauRelevePareFeu: 15_000,
})

/** Liaisons pas encore reconnues gardées ensemble, toutes adresses confondues ; au-delà, une de plus est coupée aussitôt. */
const INCONNUES_MAX = 16

/**
 * Connexions pas encore reconnues venues d'une même adresse, poignée TLS comprise ; au-delà, une de plus est coupée
 * aussitôt : un hôte du réseau ne prend pas à lui seul les places des inconnus, et le téléphone garde la sienne.
 */
const INCONNUES_PAR_ADRESSE = 2

/** Connexions ouvertes ensemble sur un serveur, reconnues ou non. */
const CONNEXIONS_MAX = 32

/**
 * Réponses de découverte envoyées par seconde, au plus, toutes adresses confondues. En UDP, l'adresse source se
 * falsifie : au-delà de ce plafond, le téléphone joint encore le PC par sa dernière adresse connue ou par l'adresse tapée.
 */
const REPONSES_SONDE_PAR_SECONDE = 200

/** Réponses de découverte envoyées par seconde à une même adresse : un hôte bavard n'en obtient pas davantage. */
const REPONSES_SONDE_PAR_ADRESSE = 3

/**
 * Adresses dont une question de découverte d'une autre version est notée au journal, une fois chacune, au plus pour
 * un lancement : une application du téléphone qui en envoie à chaque recherche n'allonge pas le journal sans fin.
 */
const AUTRE_VERSION_ADRESSES_NOTEES = 32

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
export type CommandeSansId =
  | Omit<CommandeLister, 'id'>
  | Omit<CommandeLire, 'id'>
  | Omit<CommandePing, 'id'>
  | Omit<CommandeEcrire, 'id'>
  | Omit<CommandeValider, 'id'>
  | Omit<CommandeEffacer, 'id'>

/** Ce que la liaison demande de sa socket (`tls.TLSSocket`). */
type SocketLiaison = tls.TLSSocket

function coupure(raison: string): ErreurDisque {
  return new ErreurDisque('UNKNOWN', `Liaison avec le téléphone coupée : ${raison}`)
}

// Raisons de fermeture qu'un départ distingue (`classerDepart`) ; toute autre est une coupure.
const FERMEE_PAR_LE_TELEPHONE = "l'autre bout a fermé la liaison."
const DELAI_DEPASSE = 'délai dépassé.'
const TELEPHONE_MUET = 'le téléphone ne répond plus.'
const TELEPHONE_RETIRE = 'téléphone retiré.'
const SANS_FIL_ETEINT = 'sans-fil éteint.'
const LIAISON_REMPLACEE = 'remplacée par une liaison plus récente du même téléphone.'

/**
 * Pourquoi un téléphone relié est parti : il a fermé la liaison lui-même (`ferme` : Gtracker a quitté l'écran du
 * téléphone), il ne répondait plus (`silence` : écran éteint, Wi-Fi perdu), il a été retiré (`retire`), le sans-fil a
 * été éteint (`eteint`), ou la liaison a cassé autrement (`coupure` : erreur du réseau, trame fautive).
 */
export type RaisonDepart = 'ferme' | 'silence' | 'retire' | 'eteint' | 'coupure'

/**
 * La raison d'un départ d'après la raison de fermeture de la liaison ; `remplace` quand le même téléphone revient par
 * une liaison plus récente, qui n'est pas un départ.
 */
export function classerDepart(raison: string): RaisonDepart | 'remplace' {
  switch (raison) {
    case FERMEE_PAR_LE_TELEPHONE:
      return 'ferme'
    case DELAI_DEPASSE:
    case TELEPHONE_MUET:
      return 'silence'
    case TELEPHONE_RETIRE:
      return 'retire'
    case SANS_FIL_ETEINT:
      return 'eteint'
    case LIAISON_REMPLACEE:
      return 'remplace'
    default:
      return 'coupure'
  }
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
        this.fermer(FERMEE_PAR_LE_TELEPHONE)
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

  /** Le certificat que ce bout présente sur cette liaison, en DER (côté PC : celui que le téléphone a vu). */
  certificatLocal(): Uint8Array | null {
    return this.socket.getX509Certificate()?.raw ?? null
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
        rejeter(coupure(DELAI_DEPASSE))
        this.fermer(DELAI_DEPASSE)
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
        this.liaison.fermer(TELEPHONE_MUET)
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
    if (m.type !== 'liste' && m.type !== 'bloc' && m.type !== 'pong' && m.type !== 'ecrit' && m.type !== 'fait' && m.type !== 'erreur') {
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

/**
 * Copie `fichierLocal`, de `taille` octets, vers `chemin` du téléphone : blocs `ecrire` dans l'ordre (le téléphone les
 * pose sous un nom provisoire), puis `valider`, qui met le provisoire à la place de `chemin` et rend le fichier tel
 * qu'il est désormais sur le téléphone. Un fichier local d'une autre taille que `taille` est refusé avant toute
 * commande ; un fichier qui change pendant la lecture fait échouer l'écriture, et le téléphone n'a rien validé.
 */
async function ecrireParBlocs(commandes: Commandes, chemin: string, fichierLocal: string, taille: number, delaiMs: number): Promise<FichierTelephone> {
  if (!Number.isSafeInteger(taille) || taille < 0 || taille > TAILLE_FICHIER_MAX) {
    throw new ErreurDisque('UNKNOWN', `Fichier « ${chemin} » trop gros pour le téléphone : ${taille} octets, ${TAILLE_FICHIER_MAX} au plus.`)
  }
  const reelle = (await stat(fichierLocal)).size
  if (reelle !== taille) throw new ErreurDisque('UNKNOWN', `Écriture de « ${chemin} » refusée : ${reelle} octets à envoyer au lieu des ${taille} annoncés.`)
  const poignee = await open(fichierLocal, 'r')
  try {
    for (const bloc of blocsDEcriture(taille)) {
      const octets = Buffer.alloc(bloc.longueur)
      const { bytesRead } = await poignee.read(octets, 0, bloc.longueur, bloc.debut)
      if (bytesRead !== bloc.longueur) throw new ErreurDisque('UNKNOWN', `Écriture de « ${chemin} » interrompue : le fichier à envoyer a changé de taille.`)
      reponseAttendue(await commandes.envoyer({ type: 'ecrire', chemin, debut: bloc.debut, taille, octets }, delaiMs), 'fait')
    }
  } finally {
    await poignee.close()
  }
  const ecrit = reponseAttendue(await commandes.envoyer({ type: 'valider', chemin, taille }, delaiMs), 'ecrit')
  if (ecrit.chemin !== chemin || ecrit.taille !== taille) {
    throw new ErreurDisque('UNKNOWN', `Écriture de « ${chemin} » mal confirmée par le téléphone : « ${ecrit.chemin} », ${ecrit.taille} octets sur ${taille}.`)
  }
  return { chemin, taille, dateMs: ecrit.dateMs }
}

// ---------- le serveur ----------

/** Une adresse où le serveur écoute, avec le masque de son réseau (les questions de découverte en viennent). */
export type AdresseEcoute = { adresse: string; masque: string }

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

/** Codes faux reçus pendant la dernière fenêtre d'appairage : combien, et l'adresse d'où venait le dernier. */
export type CodesFaux = { nombre: number; adresse: string }

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
  /** Vrai si le pare-feu bloque et que l'autorisation de Gtracker (`sansfil:autoriser`) suffirait à ouvrir. */
  pareFeuReparable: boolean
  /** Pourquoi le serveur n'écoute pas alors qu'il est activé, `null` sinon. */
  erreur: string | null
  /** Fenêtre d'appairage ouverte, `null` s'il n'y en a pas. */
  appairage: AppairageOuvert | null
  /**
   * Codes faux de la dernière fenêtre ouverte, gardés après sa fermeture (trois la ferment) jusqu'à la suivante ;
   * `null` s'il n'y en a pas eu.
   */
  codesFaux: CodesFaux | null
  /** Téléphones reliés, le dernier arrivé en dernier. */
  relies: TelephoneRelie[]
}

/** Un téléphone appairé, et s'il est relié en ce moment. */
export type TelephoneListe = TelephoneVisible & {
  relie: boolean
  /**
   * Heure du dernier départ pendant ce lancement du programme, en millisecondes depuis 1970 (horloge du PC), et sa
   * raison ; `null` pour un téléphone relié en ce moment ou qui n'est pas parti depuis le lancement.
   */
  partiLe: number | null
  raisonDepart: RaisonDepart | null
}

/** Avis envoyé quand un téléphone se présente ; `nouveau` s'il vient d'être appairé. */
export type AvisArrivee = { id: string; nom: string; nouveau: boolean }

/** Avis envoyé quand un téléphone relié s'en va ; `heure` en millisecondes depuis 1970 (horloge du PC). */
export type AvisDepart = { id: string; nom: string; raison: RaisonDepart; heure: number }

/**
 * Relevé du pare-feu fait avant la première écoute, pour le port de départ ; `demande` : l'autorisation a été demandée
 * après lui, il n'est donc plus à jour.
 */
type ReleveAvantEcoute = { adresses: string; port: number; jugement: JugementPareFeu | null; demande: boolean }

/** Issue de la demande d'autorisation au pare-feu, et l'état relu aussitôt après. */
export type AutorisationSansFil = ResultatAutorisation & { etat: EtatSansFil }

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
  /** Pare-feu relevé et jugé après chaque mise à l'écoute. */
  essaiPareFeu?: boolean
  /**
   * Relevé et jugement du pare-feu (`lirePareFeuWindows`) ; un relevé raté (sa raison, ou `null`) ou une option absente :
   * l'essai d'auto-connexion sert de repli.
   */
  lirePareFeu?: (ecoute: ContexteEcoute) => Promise<LecturePareFeu | null>
  /** Demande d'autorisation au pare-feu (`autoriserPareFeuWindows`) ; absente : rien n'est demandé. */
  autoriserPareFeu?: () => Promise<ResultatAutorisation>
  delais?: Partial<Delais>
  horloge?: Horloge
  alea?: Alea
  /** Le journal reçoit les messages sans adresse réseau du poste ; la sortie d'essai les reçoit avec. */
  journal?: Journaliser
  /** Appelé quand un téléphone se présente et est reconnu. */
  surArrivee?: (avis: AvisArrivee) => void
  /** Appelé quand la liaison d'un téléphone relié se ferme, sauf s'il revient aussitôt par une liaison plus récente. */
  surDepart?: (avis: AvisDepart) => void
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
/** Un téléphone reconnu, avec les capacités qu'il a annoncées en se présentant. */
type Relie = TelephoneRelie & { liaison: Liaison; commandes: Commandes; capacites: readonly Capacite[] }

/** Vrai pour un téléphone qui liste tout et sait écrire. */
const ecrivain = (r: Relie) => r.capacites.includes(CAPACITE_ECRITURE)

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
  private readonly lirePareFeu: OptionsSansFil['lirePareFeu'] | null
  private readonly autoriserSysteme: OptionsSansFil['autoriserPareFeu'] | null
  private readonly delais: Delais
  private readonly horloge: Horloge
  private readonly alea: Alea
  private readonly journal: Journaliser
  private readonly surArrivee: (avis: AvisArrivee) => void
  private readonly surDepart: (avis: AvisDepart) => void
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
  private pareFeuReparable = false
  /** Raison du dernier relevé du pare-feu raté, `null` depuis le dernier relevé lu : le journal ne la redit pas. */
  private raisonReleveRate: string | null = null
  /** Nouveau relevé prévu après un échec ; `nouveauReleveFait` : déjà refait depuis le dernier relevé lu. */
  private nouveauReleve: NodeJS.Timeout | null = null
  private nouveauReleveFait = false
  /** Relevé du pare-feu en cours (un seul à la fois), et le relevé neuf qui partira à sa suite. */
  private releveEnCours: Promise<void> | null = null
  private releveSuivant: Promise<void> | null = null
  /** Change à chaque extinction ou changement d'écoute : le relevé d'une écoute passée est jeté. */
  private generationEcoute = 0
  /** Écoute pour laquelle le relevé en cours a été lancé. */
  private generationReleve = 0
  /** Relevé d'avant l'écoute et demande d'autorisation en cours : deux appels ensemble n'en font qu'un. */
  private preparation: Promise<ReleveAvantEcoute | null> | null = null
  private demandeEnCours: Promise<ResultatAutorisation> | null = null
  private sonde: dgram.Socket | null = null
  /** Réponses de découverte de la seconde en cours, en tout et par adresse (au plus `REPONSES_SONDE_PAR_SECONDE` adresses). */
  private reponsesSonde = { seconde: 0, nombre: 0, parAdresse: new Map<string, number>() }
  /** Adresses dont une question de découverte d'une autre version est déjà notée au journal. */
  private readonly autreVersionNotees = new Set<string>()
  private releve: NodeJS.Timeout | null = null
  private fenetre: FenetreAppairage | null = null
  private codesFaux: CodesFaux | null = null
  private readonly inconnues = new Set<Liaison>()
  /** Connexions pas encore reconnues, par adresse source : chacune sous sa clé « adresse:port ». */
  private readonly enAttente = new Map<string, Set<string>>()
  /** Téléphones reliés, dans l'ordre d'arrivée. */
  private readonly relies = new Map<string, Relie>()
  /** Dernier départ de chaque téléphone parti depuis le lancement, oublié à son retour ou à son retrait. */
  private readonly departs = new Map<string, { heure: number; raison: RaisonDepart }>()

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
    this.lirePareFeu = options.lirePareFeu ?? null
    this.autoriserSysteme = options.autoriserPareFeu ?? null
    this.delais = { ...DELAIS, ...options.delais }
    this.horloge = options.horloge ?? Date.now
    this.alea = options.alea ?? randomBytes
    this.journal = options.journal ?? (() => undefined)
    this.surArrivee = options.surArrivee ?? (() => undefined)
    this.surDepart = options.surDepart ?? (() => undefined)
  }

  /** Relit les réglages et le registre du profil, et met le serveur à l'écoute si le sans-fil a été activé. */
  demarrer(): Promise<void> {
    return this.serie(async () => {
      await this.charger()
      if (this.actif && !this.enService) await this.allumer()
    })
  }

  /** Arrête tout (serveur, découverte, liaisons, fenêtre) sans changer le choix retenu. */
  arreter(): Promise<void> {
    return this.serie(() => this.eteindre())
  }

  async etat(): Promise<EtatSansFil> {
    return this.serie(async () => {
      await this.charger()
      if (this.actif) await this.actualiserAdresses(false)
      return this.etatCourant()
    })
  }

  /**
   * Active ou éteint le sans-fil ; le choix est retenu dans le profil. Éteindre garde les téléphones appairés. Allumer
   * demande d'abord l'autorisation au pare-feu s'il bloque et que c'est réparable (`demanderAutorisation` faux : jamais,
   * comme au lancement).
   */
  async activer(actif: boolean, demanderAutorisation = true): Promise<EtatSansFil> {
    const aAllumer = await this.serie(async () => {
      await this.charger()
      this.actif = actif
      await this.sauverReglages()
      if (!actif) await this.eteindre()
      return actif && !this.enService
    })
    if (aAllumer) {
      // Hors de la file : le relevé et la demande à l'utilisateur ne retiennent ni l'état, ni l'appairage, ni l'arrêt.
      const avant = demanderAutorisation && this.essaiPareFeu ? await this.preparerEcoute() : null
      // Éteint pendant la préparation : l'extinction l'emporte ; un autre allumage déjà fait : rien à refaire.
      const allume = await this.serie(async () => (this.actif && !this.enService ? this.allumer(avant) : null))
      await allume?.releve
    }
    return this.serie(async () => this.etatCourant())
  }

  /**
   * Demande à Windows d'autoriser Gtracker sur le réseau, puis relit aussitôt le pare-feu. Une demande en échec dont le
   * relevé suivant dit ouvert est accordée. Le sans-fil doit être activé. Ni la demande ni le relevé ne retiennent la
   * file du serveur ; deux demandes ensemble n'en font qu'une.
   */
  async autoriserPareFeu(): Promise<AutorisationSansFil> {
    await this.serie(async () => {
      await this.charger()
      if (!this.actif) throw new ErreurDisque('UNKNOWN', "Le sans-fil est éteint : l'activer avant d'autoriser Gtracker.")
    })
    const demande = (this.demandeEnCours ??= this.demanderAutorisation().finally(() => (this.demandeEnCours = null)))
    const resultat = await demande
    await this.relever(true)
    const etat = await this.serie(async () => this.etatCourant())
    const accordee = resultat.issue === 'echec' && etat.pareFeu === 'ouvert'
    return { ...(accordee ? { issue: 'accordee' as const } : resultat), etat }
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
      this.codesFaux = null
      this.journal(`fenêtre d'appairage ouverte, port ${this.port}`, `fenêtre d'appairage ouverte sur ${this.adresses[0].adresse}:${this.port}`)
      return this.appairageVisible() as AppairageOuvert
    })
  }

  /** Téléphones appairés, dans l'ordre d'appairage, avec l'heure et la raison de leur dernier départ. */
  async telephones(): Promise<TelephoneListe[]> {
    await this.serie(() => this.charger())
    return this.registre.liste().map((t) => {
      const relie = this.relies.has(t.id)
      const depart = relie ? undefined : this.departs.get(t.id)
      return { ...t, relie, partiLe: depart?.heure ?? null, raisonDepart: depart?.raison ?? null }
    })
  }

  /** Retire un téléphone : son jeton ne vaut plus rien, et sa liaison en cours se ferme. Faux s'il n'était pas appairé. */
  async retirer(id: string): Promise<boolean> {
    return this.serie(async () => {
      await this.charger()
      if (!this.registre.retirer(id)) return false
      await this.sauverRegistre()
      this.relies.get(id)?.liaison.fermer(TELEPHONE_RETIRE)
      this.departs.delete(id)
      this.journal('téléphone retiré')
      return true
    })
  }

  /** Port UDP où la découverte écoute, `null` si elle n'écoute pas. */
  portDecouverte(): number | null {
    return this.sonde ? this.sonde.address().port : null
  }

  /**
   * Le dossier mémoire du dernier téléphone relié ; absent tant qu'aucun téléphone n'est relié. L'état prêt dit si ce
   * téléphone écrit en ce moment (`ecriture`) et s'il liste les itinéraires ; pour un téléphone qui sait écrire, un
   * `ping` relu à chaque demande dit s'il enregistre une session (`enregistrement`, et alors `ecriture: false`). Lire,
   * écrire et effacer ne vont qu'au téléphone du dernier listage ; écrire et effacer sont refusés sans rien lui envoyer
   * s'il n'a pas annoncé la capacité « ecriture ».
   */
  dossierSansFil(): DossierDistant {
    /** Le téléphone du dernier listage : les lectures et écritures ne vont qu'à lui. */
    let liste: Relie | null = null
    const courant = (): Relie | null => {
      let dernier: Relie | null = null
      for (const r of this.relies.values()) dernier = r
      return dernier
    }
    const etatDe = async (r: Relie): Promise<EtatTelephone> => {
      if (!ecrivain(r)) return { etat: 'pret', nom: r.nom, canal: 'sansFil', ecriture: false, itineraires: false }
      const pong = reponseAttendue(await r.commandes.envoyer({ type: 'ping' }, this.delais.ping), 'pong')
      const enregistrement = pong.enregistre === true
      return { etat: 'pret', nom: r.nom, canal: 'sansFil', ecriture: !enregistrement, itineraires: true, enregistrement }
    }
    const telephoneListe = (): Relie => {
      if (!liste || liste.liaison.fermee) throw new ErreurDisque('UNKNOWN', "Le téléphone n'est plus relié depuis le listage.")
      return liste
    }
    /** Le téléphone du dernier listage, pour une écriture ou un effacement de `chemin` ; lève sans rien lui envoyer. */
    const ecrivainListe = (chemin: string): Relie => {
      if (!cheminEcrivable(chemin)) throw cheminRefuse(chemin)
      const r = telephoneListe()
      if (!ecrivain(r)) throw new ErreurDisque('UNKNOWN', "Ce téléphone ne sait pas écrire par le Wi-Fi : son application est plus ancienne que ce programme.")
      return r
    }
    return {
      etat: async (): Promise<EtatTelephone> => {
        // Un téléphone parti pendant le `ping` laisse la place au précédent, s'il en reste un relié.
        for (;;) {
          const r = courant()
          if (!r) return { etat: 'absent' }
          try {
            return await etatDe(r)
          } catch {
            // Réponse fausse à un `ping` d'une liaison restée ouverte : prêt, mais pas pour écrire.
            if (!r.liaison.fermee) return { etat: 'pret', nom: r.nom, canal: 'sansFil', ecriture: false, itineraires: true }
          }
        }
      },
      lister: async () => {
        const r = courant()
        liste = r
        if (!r) throw pasPret('absent')
        const fichiers = reponseAttendue(await r.commandes.envoyer({ type: 'lister' }, this.delais.commande), 'liste').fichiers
        // Un téléphone sans la capacité ne liste que la racine et `sessions/` : rien d'autre n'est pris pour sien.
        return ecrivain(r) ? fichiers : fichiersAdmis(fichiers, cheminAdmis)
      },
      lire: async (fichier, fichierLocal) => {
        await lireParBlocs(telephoneListe().commandes, fichier, fichierLocal, this.delais.commande)
      },
      ecrire: async (chemin, fichierLocal, taille) => ecrireParBlocs(ecrivainListe(chemin).commandes, chemin, fichierLocal, taille, this.delais.commande),
      effacer: async (chemin) => {
        reponseAttendue(await ecrivainListe(chemin).commandes.envoyer({ type: 'effacer', chemin }, this.delais.commande), 'fait')
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

  /**
   * Met le serveur à l'écoute et lance le relevé du pare-feu, sans l'attendre : rend sa promesse (`null` sans relevé),
   * que `activer` attend hors de la file.
   * Le relevé fait avant l'écoute (`avant`) sert tel quel s'il visait les mêmes adresses et le même port et que rien
   * n'a été demandé à Windows entre-temps : un seul relevé au lieu de deux.
   */
  private async allumer(avant: ReleveAvantEcoute | null = null): Promise<{ releve: Promise<void> | null }> {
    try {
      this.certificat ??= await this.chargerCertificat()
    } catch (e) {
      this.erreur = `Certificat du sans-fil impossible à préparer : ${(e as Error).message}`
      this.journal(this.erreur)
      return { releve: null }
    }
    this.enService = true
    await this.ecouter()
    await this.ouvrirSonde()
    let releve: Promise<void> | null = null
    if (this.port !== null && this.essaiPareFeu) {
      const memeEcoute = avant !== null && avant.port === this.port && avant.adresses === this.adresses.map((a) => a.adresse).join(' ')
      if (memeEcoute && !avant.demande && avant.jugement) this.appliquerPareFeu(avant.jugement, true)
      else releve = this.relever()
    }
    this.releve ??= setInterval(
      () => void this.serie(() => this.actualiserAdresses(this.pareFeu !== 'ouvert' || this.raisonReleveRate !== null)).catch(() => undefined),
      this.delais.intervalleAdresses,
    )
    this.releve.unref()
    // Dans un objet : une promesse rendue telle quelle par une fonction async serait attendue avec elle.
    return { releve }
  }

  /** Le relevé d'avant la première écoute ; deux allumages ensemble n'en font qu'un (et une seule demande). */
  private preparerEcoute(): Promise<ReleveAvantEcoute | null> {
    return (this.preparation ??= this.autoriserAvantEcoute().finally(() => (this.preparation = null)))
  }

  /**
   * Avant la première mise à l'écoute : si le pare-feu bloque Gtracker et que l'autorisation suffirait, elle est
   * demandée maintenant, pour que Windows ne pose pas sa propre question à l'écoute. Son issue ne change rien à la
   * suite : le sans-fil s'allume quand même. Rend le relevé fait, pour qu'il serve après l'écoute.
   */
  private async autoriserAvantEcoute(): Promise<ReleveAvantEcoute | null> {
    if (!this.lirePareFeu || !this.autoriserSysteme) return null
    const adresses = this.lireAdresses().map((a) => a.adresse)
    if (adresses.length === 0) return null
    const jugement = await this.relirePareFeu(adresses, this.portBase, this.generationEcoute)
    // Éteint pendant le relevé : rien n'est demandé à l'utilisateur.
    if (jugement === undefined || !this.actif) return null
    const avant = { adresses: adresses.join(' '), port: this.portBase, jugement, demande: false }
    if (jugement?.pareFeu !== 'bloque' || !jugement.reparable) return avant
    this.journal("pare-feu bloqué : autorisation demandée avant la mise à l'écoute")
    await this.demanderAutorisation()
    return { ...avant, demande: true }
  }

  /**
   * Relève le pare-feu pour l'écoute en cours, hors de la file du serveur : jamais plus d'un relevé à la fois, et un
   * appel pendant un relevé rend celui-ci. `neuf` : il faut un relevé commencé après l'appel (autorisation accordée,
   * adresses changées) ; il part à la fin de celui en cours, un seul pour tous les appels qui l'attendent. Un relevé
   * fini après une extinction ou un changement d'écoute est jeté.
   */
  private relever(neuf = false): Promise<void> {
    const enCours = this.releveEnCours
    if (enCours) {
      // Un relevé d'une écoute passée sera jeté : il en faut un neuf à sa suite, sans en lancer deux à la fois.
      if (!neuf && this.generationReleve === this.generationEcoute) return enCours
      return (this.releveSuivant ??= enCours.then(() => {
        this.releveSuivant = null
        return this.relever()
      }))
    }
    const certificat = this.certificat
    const port = this.port
    if (port === null || this.adresses.length === 0 || !certificat || !this.essaiPareFeu) return Promise.resolve()
    const adresses = this.adresses.map((a) => a.adresse)
    const generation = this.generationEcoute
    this.generationReleve = generation
    const releve = (async () => {
      const jugement = await this.relirePareFeu(adresses, port, generation)
      if (jugement === undefined) return
      if (jugement) return this.appliquerPareFeu(jugement, true)
      // Relevé illisible : l'auto-connexion ne voit pas un blocage du réseau, elle ne peut qu'en affirmer un.
      const essai = await essayerAutoConnexion(adresses[0], port, certificat.empreinte, this.delais.pareFeu)
      if (generation !== this.generationEcoute) return
      if (this.lirePareFeu) this.prevoirNouveauReleve()
      this.appliquerPareFeu({ pareFeu: essai === 'ouvert' ? 'inconnu' : essai, reparable: essai === 'bloque' }, false)
    })()
      .catch(() => undefined)
      .finally(() => {
        if (this.releveEnCours === releve) this.releveEnCours = null
      })
    this.releveEnCours = releve
    return releve
  }

  /** Retient le jugement du pare-feu ; `lu` : par le relevé, sinon par l'essai d'auto-connexion. */
  private appliquerPareFeu(jugement: JugementPareFeu, lu: boolean): void {
    const avant = `${this.pareFeu}/${this.pareFeuReparable}`
    this.pareFeu = jugement.pareFeu
    this.pareFeuReparable = jugement.pareFeu === 'bloque' && jugement.reparable
    if (lu) this.nouveauReleveFait = false
    if (`${this.pareFeu}/${this.pareFeuReparable}` !== avant) {
      this.journal(`pare-feu : ${this.pareFeu}${this.pareFeu === 'bloque' ? (this.pareFeuReparable ? ' (réparable)' : ' (non réparable)') : ''}${lu ? '' : " (essai d'auto-connexion)"}`)
    }
  }

  /** La demande d'autorisation, qui ne rejette jamais. */
  private async demanderAutorisation(): Promise<ResultatAutorisation> {
    if (!this.autoriserSysteme) return { issue: 'echec', detail: 'ce programme ne sait pas demander cette autorisation' }
    try {
      const resultat = await this.autoriserSysteme()
      this.journal(`autorisation du pare-feu : ${resultat.issue}${resultat.detail ? ` (${resultat.detail})` : ''}`)
      return resultat
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      this.journal(`autorisation du pare-feu : echec (${detail})`)
      return { issue: 'echec', detail }
    }
  }

  /**
   * Le relevé du pare-feu jugé pour ces adresses et ce port ; `null` s'il ne se lit pas, avec sa raison au journal
   * quand elle change (un relevé refait toutes les 30 secondes ne la répète pas) ; `undefined` s'il est jeté parce que
   * l'écoute de `generation` n'est plus celle en cours.
   */
  private async relirePareFeu(adresses: string[], port: number, generation: number): Promise<JugementPareFeu | null | undefined> {
    if (!this.lirePareFeu) return null
    let lecture: LecturePareFeu | null
    try {
      lecture = await this.lirePareFeu({ adresses, port, portSonde: this.portSonde })
    } catch (e) {
      lecture = { raison: e instanceof Error ? e.message : String(e) }
    }
    // Sans-fil éteint ou écoute changée pendant le relevé : jeté, sans rien écrire (ni raison, ni journal).
    if (generation !== this.generationEcoute) return undefined
    if (lecture !== null && !releveRate(lecture)) {
      if (this.raisonReleveRate !== null) this.journal('relevé du pare-feu lu après un échec')
      this.raisonReleveRate = null
      return lecture
    }
    const raison = lecture?.raison ?? 'relevé illisible'
    if (raison !== this.raisonReleveRate) this.journal(`relevé du pare-feu raté : ${raison}`)
    this.raisonReleveRate = raison
    return null
  }

  /**
   * Après un relevé raté, le refait une fois `nouveauRelevePareFeu` plus tard ; ensuite, le relevé des adresses le refait
   * tant qu'il ne se lit pas.
   */
  private prevoirNouveauReleve(): void {
    if (this.nouveauReleve || this.nouveauReleveFait) return
    this.nouveauReleve = setTimeout(() => {
      this.nouveauReleve = null
      this.nouveauReleveFait = true
      void this.relever()
    }, this.delais.nouveauRelevePareFeu)
    this.nouveauReleve.unref()
  }

  private async eteindre(): Promise<void> {
    // D'abord : une poignée TLS qui finit pendant l'extinction n'est plus accueillie.
    this.enService = false
    this.generationEcoute++
    if (this.releve) clearInterval(this.releve)
    this.releve = null
    this.fenetre?.fermer()
    this.fenetre = null
    this.codesFaux = null
    for (const r of this.relies.values()) r.liaison.fermer(SANS_FIL_ETEINT)
    for (const l of this.inconnues) l.fermer(SANS_FIL_ETEINT)
    await Promise.all([...this.serveurs.values()].map(fermerServeur))
    this.serveurs = new Map()
    this.adresses = []
    this.port = null
    this.erreur = null
    this.pareFeu = 'inconnu'
    this.pareFeuReparable = false
    if (this.nouveauReleve) clearTimeout(this.nouveauReleve)
    this.nouveauReleve = null
    this.nouveauReleveFait = false
    this.raisonReleveRate = null
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
      serveur.on('connection', (socket: Socket) => this.compterArrivee(socket))
      // Poignée de main ratée (inconnu, client qui n'est pas en TLS) : la socket est déjà détruite par Node.
      serveur.on('tlsClientError', () => undefined)
      const echec = (e: Error) => {
        serveur.close()
        rejeter(e)
      }
      serveur.once('error', echec)
      serveur.listen({ host: hote, port, exclusive: true }, () => {
        serveur.off('error', echec)
        serveur.on('error', (e) => this.journal(`serveur sans fil : ${e.message}`, `serveur sans fil (${hote}) : ${e.message}`))
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
    this.generationEcoute++
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
          this.journal(`écoute impossible sur une adresse : ${(e as Error).message}`, `écoute impossible sur ${a.adresse} : ${(e as Error).message}`)
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
      this.journal(
        `sans-fil à l'écoute : ${this.adresses.length} adresse${this.adresses.length > 1 ? 's' : ''}, port ${port}`,
        `sans-fil à l'écoute : ${this.adresses.map((a) => a.adresse).join(', ')}, port ${port}`,
      )
      return
    }
    this.erreur = `Aucun port libre de ${this.portBase} à ${this.portBase + ESSAIS_PORT - 1}.`
    this.journal(this.erreur)
  }

  /** Suit les adresses du PC (Wi-Fi changé, adresse renouvelée) : écoute sur les nouvelles, lâche les disparues. */
  private async actualiserAdresses(retesterPareFeu: boolean): Promise<void> {
    // Seul `allumer` met à l'écoute la première fois (avec la découverte, la minuterie et le relevé) : pendant la
    // préparation d'un allumage (relevé, demande d'autorisation), rien n'écoute encore.
    if (!this.actif || !this.certificat || !this.enService) return
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
          this.journal(`écoute impossible sur une adresse : ${(e as Error).message}`, `écoute impossible sur ${a.adresse} : ${(e as Error).message}`)
        }
      }
      this.adresses = voulues.filter((a) => this.serveurs.has(a.adresse))
      if (this.serveurs.size === 0) {
        this.port = null
        await this.ecouter()
      }
      change = true
    }
    if (change) this.generationEcoute++
    // Sans l'attendre : la file du serveur ne reste pas derrière un relevé ; un relevé déjà en cours suffit, sauf
    // si l'écoute a changé (le sien serait jeté) : un neuf part alors à sa suite.
    if (this.port !== null && this.essaiPareFeu && (change || retesterPareFeu)) void this.relever(change)
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
    const duReseau = this.adresses.some((a) => memeReseau(source.address, a.adresse, a.masque))
    if (!question) {
      if (duReseau && questionDAutreVersion(paquet)) this.noterAutreVersion(source.address)
      return
    }
    if (this.port === null || !duReseau) return
    const seconde = Math.floor(this.horloge() / 1000)
    if (seconde !== this.reponsesSonde.seconde) this.reponsesSonde = { seconde, nombre: 0, parAdresse: new Map() }
    const compte = this.reponsesSonde
    const deLAdresse = (compte.parAdresse.get(source.address) ?? 0) + 1
    if (deLAdresse > REPONSES_SONDE_PAR_ADRESSE || compte.nombre >= REPONSES_SONDE_PAR_SECONDE) return
    compte.parAdresse.set(source.address, deLAdresse)
    compte.nombre++
    // L'identifiant du PC ne part que sous HMAC du nonce, que seul un téléphone appairé sait vérifier ; le nom de
    // Windows ne part pas : le téléphone ne s'en sert pas.
    const identifiant = identifiantDeSonde(Buffer.from(this.identifiantPc, 'hex'), question.nonce)
    const reponse = encoderReponse({ nonce: question.nonce, port: this.port, identifiant })
    sonde.send(reponse, source.port, source.address, () => undefined)
  }

  /**
   * Une question d'une autre version, sans réponse : une ligne au journal, une fois par adresse, rien à l'écran (une
   * application du téléphone qui en envoie le fait à chaque recherche, et se replie ensuite sur l'adresse tapée).
   */
  private noterAutreVersion(adresse: string): void {
    if (this.autreVersionNotees.has(adresse) || this.autreVersionNotees.size >= AUTRE_VERSION_ADRESSES_NOTEES) return
    this.autreVersionNotees.add(adresse)
    const texte = "découverte : question d'une autre version de l'application du téléphone, sans réponse"
    this.journal(texte, `${texte} (${adresse})`)
  }

  // ---------- accueil d'un téléphone ----------

  /**
   * Compte une connexion qui arrive, poignée TLS comprise, sous son adresse source, jusqu'à ce qu'elle soit reconnue
   * ou fermée ; une de trop pour son adresse (`INCONNUES_PAR_ADRESSE`) est coupée aussitôt.
   */
  private compterArrivee(socket: Socket): void {
    const origine = origineDe(socket)
    const deLAdresse = this.enAttente.get(origine.adresse) ?? new Set<string>()
    if (deLAdresse.size >= INCONNUES_PAR_ADRESSE) {
      socket.destroy()
      return
    }
    deLAdresse.add(origine.cle)
    this.enAttente.set(origine.adresse, deLAdresse)
    socket.once('close', () => this.oublierArrivee(origine))
  }

  /** Retire une connexion du compte de son adresse : reconnue, ou fermée. */
  private oublierArrivee(origine: Origine): void {
    const deLAdresse = this.enAttente.get(origine.adresse)
    if (!deLAdresse) return
    deLAdresse.delete(origine.cle)
    if (deLAdresse.size === 0) this.enAttente.delete(origine.adresse)
  }

  private accueillir(socket: tls.TLSSocket): void {
    if (!this.enService || this.inconnues.size >= INCONNUES_MAX) {
      socket.destroy()
      return
    }
    const origine = origineDe(socket)
    const liaison = new Liaison(socket)
    this.inconnues.add(liaison)
    liaison.surFermeture(() => this.inconnues.delete(liaison))
    void this.accueil(liaison, origine).catch((e) => liaison.fermer((e as Error).message))
  }

  private async accueil(liaison: Liaison, origine: Origine): Promise<void> {
    const premier = await liaison.prochain(this.delais.presentation)
    if (premier.type === 'appairer') await this.appairer(liaison, origine, premier)
    else if (premier.type === 'bonjour') await this.bonjour(liaison, origine, premier)
    else liaison.fermer(`message inattendu à l'accueil (« ${premier.type} »).`)
  }

  private async appairer(liaison: Liaison, origine: Origine, m: MessageAppairer): Promise<void> {
    if (m.version !== PROTOCOLE_SANS_FIL) return this.refuserAppairage(liaison, origine, 'version')
    // Sans part SPAKE2, c'est l'ancien échange, dont la preuve laissait essayer le code hors ligne : jamais accepté.
    if (m.partA === undefined) {
      this.journal("appairage refusé : application du téléphone trop ancienne", `appairage refusé (${origine.adresse}) : application du téléphone trop ancienne`)
      return liaison.refuser('version')
    }
    const fenetre = this.fenetre
    if (!fenetre) return this.refuserAppairage(liaison, origine, 'fenetre')
    // L'identité du PC dans l'échange est l'empreinte du certificat servi sur cette liaison même, jamais une valeur
    // reçue : si elle n'est pas celle de la fenêtre, l'échange ne peut que rater, et rien n'est commencé.
    const servi = liaison.certificatLocal()
    if (servi === null || !egalATempsConstant(empreinteCertificat(servi), fenetre.empreinte)) {
      this.journal("appairage refusé : certificat servi différent de celui de la fenêtre")
      return liaison.refuser('fenetre')
    }
    // Une part refusée compte comme un code faux dès `commencer`, avant toute réponse : il est montré aussitôt, et le
    // `defi` part quand même (la fenêtre refusera la preuve), pour ne rien dire de plus qu'un code deviné faux.
    const echecsAvantPart = fenetre.echecs
    const tentative = fenetre.commencer(depuisHex(m.nonceTelephone, TAILLE_NONCE) as Uint8Array, depuisHex(m.partA, TAILLE_PART_SPAKE2) as Uint8Array)
    this.noterCodeFaux(origine, fenetre, echecsAvantPart)
    if (!tentative.ok) return this.refuserAppairage(liaison, origine, tentative.raison)
    liaison.envoyer({ type: 'defi', noncePc: enHex(tentative.noncePc), partB: enHex(tentative.partB) })
    const r = await liaison.prochain(this.delais.accueil)
    if (r.type !== 'preuve') return liaison.fermer(`message inattendu pendant l'appairage (« ${r.type} »).`)
    // Compté avant l'envoi du refus, au compteur de la fenêtre, commun à toutes ses liaisons.
    const echecsAvantPreuve = fenetre.echecs
    const conclusion = tentative.conclure(depuisHex(r.preuve, TAILLE_PREUVE) as Uint8Array)
    this.noterCodeFaux(origine, fenetre, echecsAvantPreuve)
    if (!conclusion.ok) return this.refuserAppairage(liaison, origine, conclusion.raison)
    const maintenant = this.horloge()
    const telephone = this.registre.ajouter(m.nom, conclusion.jeton, maintenant, this.alea)
    // L'appairage est sa première liaison : vu comme à une présentation par le jeton.
    this.registre.marquerVu(telephone.id, maintenant)
    // Inscrit avant d'envoyer le jeton : un PC arrêté juste après ne laisse pas au téléphone un jeton inconnu.
    await this.sauverRegistre()
    if (!this.admissibleApresAttente(liaison, telephone.id)) return
    liaison.envoyer({ type: 'appaire', preuve: enHex(conclusion.confirmationB), jeton: enHex(conclusion.jeton), identifiantPc: this.identifiantPc, nomPc: this.nomPc })
    this.reconnaitre(liaison, origine, telephone, true, capacitesDe(m))
  }

  /**
   * Refuse un appairage et en laisse une ligne au journal, raison et adresse d'origine seulement ; un code faux y est
   * déjà, posé par `noterCodeFaux` au moment où la fenêtre le compte.
   */
  private refuserAppairage(liaison: Liaison, origine: Origine, raison: RaisonRefus): void {
    if (raison !== 'code') this.journal(`appairage refusé : ${raison}`, `appairage refusé (${origine.adresse}) : ${raison}`)
    liaison.refuser(raison)
  }

  /**
   * Montre sur le PC un code faux que la fenêtre vient de compter (ses échecs ont passé `echecsAvant`), avec son
   * origine : l'utilisateur voit s'il vient d'un autre appareil que le sien. Rien de l'échange n'y figure.
   */
  private noterCodeFaux(origine: Origine, fenetre: FenetreAppairage, echecsAvant: number): void {
    if (fenetre.echecs === echecsAvant) return
    if (this.fenetre === fenetre) this.codesFaux = { nombre: fenetre.echecs, adresse: origine.adresse }
    this.journal('appairage refusé : code', `appairage refusé (${origine.adresse}) : code`)
  }

  private async bonjour(liaison: Liaison, origine: Origine, m: MessageBonjour): Promise<void> {
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
    this.reconnaitre(liaison, origine, telephone, false, capacitesDe(m))
  }

  /**
   * Après l'écriture du registre, le monde a pu changer : sans-fil éteint (liaison fermée), téléphone retiré entre-temps
   * (refus `jeton`). Vrai si la liaison peut encore être reconnue.
   */
  private admissibleApresAttente(liaison: Liaison, id: string): boolean {
    if (liaison.fermee) return false
    if (!this.enService) {
      liaison.fermer(SANS_FIL_ETEINT)
      return false
    }
    if (!this.inscrit(id)) {
      this.journal('téléphone retiré pendant sa présentation : refusé')
      liaison.refuser('jeton')
      return false
    }
    return true
  }

  private reconnaitre(liaison: Liaison, origine: Origine, telephone: TelephoneVisible, nouveau: boolean, capacites: readonly Capacite[]): void {
    this.inconnues.delete(liaison)
    this.oublierArrivee(origine)
    liaison.elargir()
    const relie: Relie = { id: telephone.id, nom: telephone.nom, liaison, commandes: new Commandes(liaison), capacites }
    this.relies.get(telephone.id)?.liaison.fermer(LIAISON_REMPLACEE)
    this.relies.delete(telephone.id)
    this.relies.set(telephone.id, relie)
    this.departs.delete(telephone.id)
    const ping = setInterval(() => void relie.commandes.envoyer({ type: 'ping' }, this.delais.ping).catch(() => undefined), this.delais.intervallePing)
    ping.unref()
    liaison.surFermeture((texte) => {
      clearInterval(ping)
      if (this.relies.get(telephone.id) === relie) this.relies.delete(telephone.id)
      const raison = classerDepart(texte)
      this.journal(`téléphone parti (${raison}) : ${texte}`)
      // Le même téléphone revenu par une liaison plus récente n'est pas parti : rien n'est annoncé.
      if (raison === 'remplace') return
      const heure = this.horloge()
      if (raison !== 'retire') this.departs.set(telephone.id, { heure, raison })
      this.surDepart({ id: telephone.id, nom: telephone.nom, raison, heure })
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
      pareFeuReparable: this.port !== null && this.pareFeu === 'bloque' && this.pareFeuReparable && this.autoriserSysteme !== null,
      erreur: this.actif ? this.erreur : null,
      appairage: this.appairageVisible(),
      codesFaux: this.codesFaux,
      relies:[...this.relies.values()].map(({ id, nom }) => ({ id, nom })),
    }
  }
}

/** D'où vient une connexion : son adresse source, et sa clé « adresse:port », la même sur la socket et sur sa liaison TLS. */
type Origine = { adresse: string; cle: string }

function origineDe(socket: Socket): Origine {
  const adresse = socket.remoteAddress ?? ''
  return { adresse, cle: `${adresse}:${socket.remotePort ?? ''}` }
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
 * dit son canal et s'il écrit. Ce que dit `ecriture` dans l'état du canal fait foi (le sans-fil le dit selon le
 * téléphone, qui peut être ancien ou en train d'enregistrer) ; un canal qui ne le dit pas écrit s'il en a les méthodes.
 * Un canal qui n'écrit pas, d'après son état relu au listage, refuse l'écriture et l'effacement, sans jamais les
 * passer à l'autre canal.
 */
export function dossierSansFilPuisCable(sansFil: DossierDistant, cable: DossierDistant): DossierDistant {
  let choisi: DossierDistant = cable
  /** Ce que l'état du canal choisi disait au listage : il écrit, ou la raison de son refus. */
  let ecritureChoisie: true | ErreurDisque = new ErreurDisque('UNKNOWN', "Le téléphone n'a pas été listé.")
  const parMethodes = (d: DossierDistant) => typeof d.ecrire === 'function' && typeof d.effacer === 'function'
  const ecritureDe = (d: DossierDistant, e: EtatTelephone & { etat: 'pret' }) => e.ecriture ?? parMethodes(d)
  const refusCanal = () => new ErreurDisque('UNKNOWN', 'Ce canal ne sait pas écrire sur le téléphone.')
  const refusEnregistrement = () => new ErreurDisque('PERMISSION', 'Le téléphone enregistre une session : rien ne lui est écrit pour le moment.')
  return {
    async etat() {
      const e = await sansFil.etat()
      if (e.etat === 'pret') return { ...e, canal: 'sansFil', ecriture: ecritureDe(sansFil, e) }
      const c = await cable.etat()
      return c.etat === 'pret' ? { ...c, canal: 'cable', ecriture: ecritureDe(cable, c) } : c
    },
    async lister() {
      const e = await sansFil.etat()
      if (e.etat === 'pret') {
        choisi = sansFil
        ecritureChoisie = ecritureDe(sansFil, e) || (e.enregistrement ? refusEnregistrement() : refusCanal())
      } else {
        choisi = cable
        ecritureChoisie = parMethodes(cable) || refusCanal()
      }
      return choisi.lister()
    },
    lire(fichier, fichierLocal) {
      return choisi.lire(fichier, fichierLocal)
    },
    async ecrire(chemin, fichierLocal, taille) {
      if (ecritureChoisie !== true) throw ecritureChoisie
      if (!choisi.ecrire) throw refusCanal()
      return choisi.ecrire(chemin, fichierLocal, taille)
    },
    async effacer(chemin) {
      if (ecritureChoisie !== true) throw ecritureChoisie
      if (!choisi.effacer) throw refusCanal()
      return choisi.effacer(chemin)
    },
  }
}

// ---------- les canaux de la page ----------

/** Canaux servis ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_SANS_FIL = ['etat', 'activer', 'ouvrirAppairage', 'telephones', 'retirer', 'autoriser'] as const

/** Canal de l'avis envoyé à la page quand un téléphone se présente (`AvisArrivee`). */
export const AVIS_ARRIVEE = 'sansfil:arrive'

/** Canal de l'avis envoyé à la page quand un téléphone relié s'en va (`AvisDepart`). */
export const AVIS_DEPART = 'sansfil:parti'

function champ(argument: unknown, nom: string): unknown {
  return typeof argument === 'object' && argument !== null && !Array.isArray(argument) ? (argument as Record<string, unknown>)[nom] : undefined
}

/**
 * Gestionnaires des canaux `sansfil:*`, à brancher par `brancherCanaux` :
 * - `sansfil:etat` rend un `EtatSansFil` ;
 * - `sansfil:activer({ actif })` active ou éteint, et rend l'`EtatSansFil` qui suit ;
 * - `sansfil:ouvrirAppairage` rend un `AppairageOuvert` ;
 * - `sansfil:telephones` rend les `TelephoneListe` ;
 * - `sansfil:retirer({ id })` rend vrai si le téléphone était appairé ;
 * - `sansfil:autoriser` demande l'autorisation au pare-feu de Windows et rend `{ issue, detail?, etat }` (`issue` :
 *   `accordee`, `refusee` ou `echec`, `detail` disant pourquoi en français) ; refusé si le sans-fil est éteint.
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
    'sansfil:autoriser': () => enReponse(() => serveur.autoriserPareFeu()),
  }
}

// ---------- mode d'essai ----------

/** Réglages du serveur que le mode d'essai remplace. */
export type EssaiSansFil = Pick<OptionsSansFil, 'adresses' | 'port' | 'portSonde' | 'hoteSonde' | 'nomPc' | 'dureeFenetreMs'> &
  Required<Pick<OptionsSansFil, 'lirePareFeu' | 'autoriserPareFeu'>> & {
  /** Dossier des secrets, `null` : celui du profil d'essai. */
  dossier: string | null
  /** Sans-fil activé dès le lancement. */
  actif: boolean
}

/** Nom du PC en mode d'essai, le même sur tous les postes pour que les relevés du banc ne changent pas. */
export const NOM_PC_ESSAI = "PC d'essai"

/** Pare-feu d'essai, avant toute autorisation. */
export type PareFeuEssai = 'ouvert' | 'bloque' | 'irreparable'

/**
 * Pare-feu factice du mode d'essai, sans jamais lancer Windows PowerShell : il dit `etat` jusqu'à une autorisation
 * accordée, qui ouvre un pare-feu « bloque » (pas un « irreparable »). Chaque demande est journalisée.
 */
export function pareFeuFactice(
  etat: PareFeuEssai,
  autorisation: IssueAutorisation,
  journal: (message: string) => void = () => undefined,
): Required<Pick<OptionsSansFil, 'lirePareFeu' | 'autoriserPareFeu'>> {
  let courant = etat
  return {
    lirePareFeu: async () => (courant === 'ouvert' ? { pareFeu: 'ouvert', reparable: false } : { pareFeu: 'bloque', reparable: courant === 'bloque' }),
    autoriserPareFeu: async () => {
      journal(`autorisation d'essai : ${autorisation}`)
      if (autorisation === 'accordee' && courant === 'bloque') courant = 'ouvert'
      return autorisation === 'echec' ? { issue: 'echec', detail: "échec de l'autorisation d'essai" } : { issue: autorisation }
    },
  }
}

/**
 * Réglages du sans-fil d'essai d'après l'environnement, `null` hors du mode d'essai (`GTRACKER_BANC=1`), où les
 * variables ne sont pas lues. En mode d'essai, le serveur n'écoute que sur 127.0.0.1, et le pare-feu est factice.
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
  const choix = <T extends string>(nom: string, valeurs: readonly T[]): T => {
    const brut = env[nom]?.trim() ?? ''
    if ((valeurs as readonly string[]).includes(brut)) return brut as T
    if (brut !== '') journal(`${nom} illisible, ignorée : ${brut}`)
    return valeurs[0]
  }
  const pareFeu = choix<PareFeuEssai>('GTRACKER_BANC_SANSFIL_PAREFEU', ['ouvert', 'bloque', 'irreparable'])
  const autorisation = choix<IssueAutorisation>('GTRACKER_BANC_SANSFIL_AUTORISATION', ['accordee', 'refusee', 'echec'])
  journal(
    `sans-fil d'essai : 127.0.0.1, port ${port || 'libre'}, découverte ${portSonde ?? 'aucune'}${dureeFenetreMs ? `, fenêtre ${dureeFenetreMs} ms` : ''}${actif ? ', activé' : ''}, pare-feu ${pareFeu}, autorisation ${autorisation}`,
  )
  return {
    ...pareFeuFactice(pareFeu, autorisation, journal),
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
