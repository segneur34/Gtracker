// Un faux téléphone, en Node, qui joue celui de la liaison sans fil : découverte UDP, TLS à empreinte fixée,
// appairage par le code, jeton, puis réponses aux commandes du PC (`lister`, `lire`, `ping`) depuis un dossier du
// disque qui joue le dossier mémoire du téléphone (`Documents/Gtracker`). Pour les tests et le banc ; il fait ce que
// le greffon du téléphone fait, dans le même ordre, et rien n'y écrit.

import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
import { open, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import tls from 'node:tls'
import type { Alea } from './appairage'
import { TAILLE_NONCE, depuisHex, egalATempsConstant, enHex, preuvePc, preuveTelephone } from './appairage'
import { empreinteCertificat } from './certificat'
import { codeDe, estTemporaire } from './disque'
import { Liaison } from './sansFil'
import { TAILLE_NONCE_SONDE, decoderReponse, encoderQuestion } from './sonde'
import type { FichierTelephone } from './telephone'
import { DOSSIER_SESSIONS, cheminAdmis, fichiersAdmis } from './telephone'
import type { Commande, Message, RaisonRefus } from './trames'
import { MESSAGE_MAX, PROTOCOLE_SANS_FIL } from './trames'

/** Ce que le téléphone garde après l'appairage (le vrai : dans ses préférences privées). */
export type MemoireFaux = {
  /** Jeton reçu, en hexadécimal. */
  jeton: string
  /** Empreinte du certificat du PC fixée à l'appairage, en hexadécimal. */
  empreinte: string
  identifiantPc: string
  nomPc: string
  /** Dernière adresse et dernier port connus du PC. */
  adresse: string
  port: number
}

/** Le PC a refusé la liaison. */
export class RefusPc extends Error {
  raison: RaisonRefus
  constructor(raison: RaisonRefus) {
    super(`Refus du PC : ${raison}.`)
    this.name = 'RefusPc'
    this.raison = raison
  }
}

export type OptionsFauxTelephone = {
  /** Dossier qui joue `Documents/Gtracker` du téléphone ; jamais modifié. */
  dossier: string
  nom?: string
  /** Appairage déjà fait. */
  memoire?: MemoireFaux | null
  /** Coupe la liaison au lieu d'envoyer le bloc qui suit ce nombre de blocs envoyés. */
  coupureApresBlocs?: number | null
  /** Délai d'attente de chaque réponse du PC, en millisecondes. */
  delaiMs?: number
  alea?: Alea
  /**
   * Téléphone bogué ou hostile : réponse envoyée à la place de la vraie quand elle rend un message (`undefined` : la
   * vraie réponse part).
   */
  falsifier?: (commande: Commande) => Message | undefined
}

/** Une liaison du faux téléphone, qui répond aux commandes du PC jusqu'à sa fermeture. */
export type LiaisonFaux = {
  liaison: Liaison
  /** Raison de la fermeture, quand elle arrive. */
  fermee: Promise<string>
  fermer(): void
}

/** Un PC trouvé par la découverte : l'adresse est celle d'où vient la réponse. */
export type PcTrouve = { adresse: string; port: number; identifiantPc: string; nom: string }

/**
 * Diffuse une question de découverte vers `hote:port` (adresse de diffusion, ou celle du PC) et rend la première
 * réponse à son nonce, `null` après `delaiMs`.
 */
export function sonder(hote: string, port: number, delaiMs = 3_000, alea: Alea = randomBytes): Promise<PcTrouve | null> {
  return new Promise((resoudre) => {
    const nonce = alea(TAILLE_NONCE_SONDE)
    const socket = dgram.createSocket('udp4')
    let fini = false
    const finir = (pc: PcTrouve | null) => {
      if (fini) return
      fini = true
      clearTimeout(minuteur)
      socket.close()
      resoudre(pc)
    }
    const minuteur = setTimeout(() => finir(null), delaiMs)
    socket.on('error', () => finir(null))
    socket.on('message', (paquet, source) => {
      const r = decoderReponse(paquet)
      if (!r || !egalATempsConstant(r.nonce, nonce)) return
      finir({ adresse: source.address, port: r.port, identifiantPc: enHex(r.identifiant), nom: r.nom })
    })
    socket.bind(0, () => {
      socket.setBroadcast(true)
      socket.send(encoderQuestion(nonce), port, hote)
    })
  })
}

function ouvrirTls(hote: string, port: number, delaiMs: number): Promise<tls.TLSSocket> {
  return new Promise((resoudre, rejeter) => {
    // Pas de chaîne de confiance : l'empreinte du certificat est vérifiée ensuite, à l'appairage puis à chaque liaison.
    const socket = tls.connect({ host: hote, port, rejectUnauthorized: false, minVersion: 'TLSv1.2' })
    const minuteur = setTimeout(() => {
      socket.destroy()
      rejeter(new Error('Le PC ne répond pas (délai dépassé).'))
    }, delaiMs)
    const echec = (e: Error) => {
      clearTimeout(minuteur)
      rejeter(e)
    }
    socket.once('error', echec)
    socket.once('secureConnect', () => {
      clearTimeout(minuteur)
      socket.off('error', echec)
      resoudre(socket)
    })
  })
}

/** Le faux téléphone. */
export class FauxTelephone {
  /** Appairage gardé, `null` tant qu'il n'est pas fait. */
  memoire: MemoireFaux | null
  /** Blocs envoyés depuis sa création. */
  blocsEnvoyes = 0
  /** Commandes reçues depuis sa création. */
  commandesRecues = 0
  private readonly dossier: string
  private readonly nom: string
  private readonly coupureApresBlocs: number | null
  private readonly delaiMs: number
  private readonly alea: Alea
  private readonly falsifier: ((commande: Commande) => Message | undefined) | undefined

  constructor(options: OptionsFauxTelephone) {
    this.falsifier = options.falsifier
    this.dossier = path.resolve(options.dossier)
    this.nom = options.nom ?? "Téléphone d'essai"
    this.memoire = options.memoire ?? null
    this.coupureApresBlocs = options.coupureApresBlocs ?? null
    this.delaiMs = options.delaiMs ?? 10_000
    this.alea = options.alea ?? randomBytes
  }

  /** Appaire le téléphone au PC par le code affiché, puis répond à ses commandes. Lève `RefusPc` sur un refus. */
  async appairer(hote: string, port: number, code: string): Promise<LiaisonFaux> {
    const liaison = new Liaison(await ouvrirTls(hote, port, this.delaiMs))
    try {
      const der = liaison.certificatDistant()
      if (!der) throw new Error('Le PC ne présente aucun certificat.')
      const empreinte = empreinteCertificat(der)
      const nonceTelephone = this.alea(TAILLE_NONCE)
      liaison.envoyer({ type: 'appairer', version: PROTOCOLE_SANS_FIL, nom: this.nom, nonceTelephone: enHex(nonceTelephone) })
      const defi = this.attendu(await liaison.prochain(this.delaiMs), 'defi')
      const noncePc = depuisHex(defi.noncePc, TAILLE_NONCE) as Uint8Array
      liaison.envoyer({ type: 'preuve', preuve: enHex(preuveTelephone(code, empreinte, nonceTelephone, noncePc)) })
      const appaire = this.attendu(await liaison.prochain(this.delaiMs), 'appaire')
      // Le jeton n'est gardé qu'une fois la preuve du PC vérifiée : sans elle, ce PC ne connaît pas le code.
      if (!egalATempsConstant(depuisHex(appaire.preuve, 32) ?? new Uint8Array(0), preuvePc(code, empreinte, nonceTelephone, noncePc))) {
        throw new Error('Preuve du PC fausse : appairage abandonné.')
      }
      this.memoire = { jeton: appaire.jeton, empreinte: enHex(empreinte), identifiantPc: appaire.identifiantPc, nomPc: appaire.nomPc, adresse: hote, port }
      return this.servir(liaison)
    } catch (e) {
      liaison.fermer((e as Error).message)
      throw e
    }
  }

  /** Se présente au PC appairé par son jeton, puis répond à ses commandes. Lève `RefusPc` sur un refus. */
  async connecter(hote?: string, port?: number): Promise<LiaisonFaux> {
    const memoire = this.memoire
    if (!memoire) throw new Error("Téléphone pas encore appairé.")
    const liaison = new Liaison(await ouvrirTls(hote ?? memoire.adresse, port ?? memoire.port, this.delaiMs))
    try {
      const der = liaison.certificatDistant()
      if (!der || enHex(empreinteCertificat(der)) !== memoire.empreinte) throw new Error('Certificat du PC inconnu : liaison refusée.')
      liaison.envoyer({ type: 'bonjour', version: PROTOCOLE_SANS_FIL, nom: this.nom, jeton: memoire.jeton })
      const bienvenue = this.attendu(await liaison.prochain(this.delaiMs), 'bienvenue')
      if (bienvenue.identifiantPc !== memoire.identifiantPc) throw new Error('Ce n’est pas le PC appairé.')
      memoire.adresse = hote ?? memoire.adresse
      memoire.port = port ?? memoire.port
      return this.servir(liaison)
    } catch (e) {
      liaison.fermer((e as Error).message)
      throw e
    }
  }

  private attendu<T extends Message['type']>(m: Message, type: T): Extract<Message, { type: T }> {
    if (m.type === 'refus') throw new RefusPc(m.raison)
    if (m.type !== type) throw new Error(`Message inattendu du PC : « ${m.type} » au lieu de « ${type} ».`)
    return m as Extract<Message, { type: T }>
  }

  private servir(liaison: Liaison): LiaisonFaux {
    let suite: Promise<void> = Promise.resolve()
    // Les réponses partent dans l'ordre des commandes, comme celles du vrai téléphone.
    liaison.servir((m) => {
      suite = suite.then(() => this.repondre(liaison, m)).catch((e) => liaison.fermer((e as Error).message))
    })
    return { liaison, fermee: new Promise((fin) => liaison.surFermeture(fin)), fermer: () => liaison.fermer('fermée par le téléphone.') }
  }

  private async repondre(liaison: Liaison, m: Message): Promise<void> {
    if (liaison.fermee) return
    if (m.type !== 'lister' && m.type !== 'lire' && m.type !== 'ping') {
      liaison.fermer(`message inattendu du PC (« ${m.type} »).`)
      return
    }
    this.commandesRecues++
    const fausse = this.falsifier?.(m)
    if (fausse) return liaison.envoyer(fausse)
    if (m.type === 'ping') return liaison.envoyer({ type: 'pong', id: m.id })
    try {
      if (m.type === 'lister') return liaison.envoyer({ type: 'liste', id: m.id, fichiers: await this.lister() })
      if (this.coupureApresBlocs !== null && this.blocsEnvoyes >= this.coupureApresBlocs) {
        liaison.fermer("coupure d'essai.")
        return
      }
      const octets = await this.lireBloc(m.chemin, m.debut, m.longueur)
      if (liaison.fermee) return
      liaison.envoyer({ type: 'bloc', id: m.id, debut: m.debut, octets })
      this.blocsEnvoyes++
    } catch (e) {
      if (liaison.fermee) return
      liaison.envoyer({ type: 'erreur', id: m.id, code: codeDe(e), message: ((e as Error).message ?? '').slice(0, MESSAGE_MAX) })
    }
  }

  private async fichiersDe(dossier: string, prefixe: string): Promise<FichierTelephone[]> {
    const fichiers: FichierTelephone[] = []
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      // Les fichiers d'une écriture en cours, côté téléphone, ne se montrent pas.
      if (!entree.isFile() || estTemporaire(entree.name)) continue
      const s = await stat(path.join(dossier, entree.name))
      fichiers.push({ chemin: prefixe + entree.name, taille: s.size, dateMs: Math.floor(s.mtimeMs) })
    }
    return fichiers
  }

  private async lister(): Promise<FichierTelephone[]> {
    const fichiers = await this.fichiersDe(this.dossier, '')
    try {
      fichiers.push(...(await this.fichiersDe(path.join(this.dossier, DOSSIER_SESSIONS), `${DOSSIER_SESSIONS}/`)))
    } catch (e) {
      if (codeDe(e) !== 'NOT_FOUND') throw e
    }
    return fichiersAdmis(fichiers)
  }

  private async lireBloc(chemin: string, debut: number, longueur: number): Promise<Uint8Array> {
    if (!cheminAdmis(chemin)) throw new Error('Chemin refusé.')
    const poignee = await open(path.join(this.dossier, ...chemin.split('/')), 'r')
    try {
      const tampon = Buffer.alloc(longueur)
      const { bytesRead } = await poignee.read(tampon, 0, longueur, debut)
      return tampon.subarray(0, bytesRead)
    } finally {
      await poignee.close()
    }
  }
}
