// Un faux téléphone, en Node, qui joue celui de la liaison sans fil : découverte UDP, TLS à empreinte fixée,
// appairage par le code, jeton, puis réponses aux commandes du PC depuis un dossier du disque qui joue le dossier
// mémoire du téléphone (`Documents/Gtracker`). Pour les tests et le banc ; il fait ce que le greffon du téléphone
// fait, dans le même ordre :
// - à jour (par défaut), il annonce la capacité « ecriture », liste la racine, `sessions/`, `itineraires/` et
//   `reglages/` en terminant d'abord les échanges interrompus (un `.gtracker-new` resté seul est effacé, un
//   `.gtracker-tmp` à côté de son original est effacé, seul il reprend le nom de l'original), et écrit comme le
//   greffon : provisoire choisi par lui (`nomProvisoire`), blocs dans l'ordre, `valider` qui relit la taille puis
//   retire l'original et renomme, provisoire effacé sur toute erreur et à la fermeture de la liaison, refus
//   (`PERMISSION`) d'écrire et d'effacer quand il enregistre une session ;
// - `ancien`, il fait ce que fait une application d'avant l'écriture sans fil : ni capacité ni `enregistre`, racine
//   et `sessions/` seulement, rien de modifié dans le dossier, et toute commande d'écriture ferme la liaison ; il
//   s'appaire pourtant par l'échange SPAKE2, pour que le banc puisse relier un téléphone qui ne reçoit pas d'écriture.
// - `ancienEchange`, il se présente comme une application d'avant l'échange SPAKE2 : `appairer` sans `partA`, que le
//   PC doit refuser (raison `version`) ; s'il répondait `defi`, l'appairage s'arrête en erreur, sans rien prouver.
// Comme le téléphone à jour, il s'arrête (`RefusPc`, raison `version`) sur un `defi` sans `partB`, et ne garde le
// jeton qu'une fois la confirmation du PC vérifiée.

import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
import type { FileHandle } from 'node:fs/promises'
import { mkdir, open, readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import tls from 'node:tls'
import type { Alea } from './appairage'
import { TAILLE_NONCE, depuisHex, egalATempsConstant, enHex } from './appairage'
import { empreinteCertificat } from './certificat'
import { ErreurDisque, SUFFIXE_NEUF, SUFFIXE_REMPLACEMENT, codeDe, estTemporaire } from './disque'
import { Liaison } from './sansFil'
import type { VersionSonde } from './sonde'
import { TAILLE_NONCE_SONDE, VERSION_SONDE, VERSION_SONDE_V2, decoderReponse, encoderQuestion, identifiantDeSonde } from './sonde'
import { commencerAppairage, confirmationValide, conclure } from './spake2'
import type { FichierTelephone } from './telephone'
import { DOSSIERS_DU_CABLE, DOSSIER_SESSIONS, cheminAdmis, cheminDuCable, cheminEcrivable, cheminRefuse, fichiersAdmis, nomProvisoire } from './telephone'
import type { Capacite, Commande, CommandeEcrire, CommandeValider, Message, RaisonRefus } from './trames'
import { CAPACITE_ECRITURE, CAPACITE_SPAKE2, MESSAGE_MAX, PROTOCOLE_SANS_FIL, TAILLE_PART_SPAKE2, TAILLE_PREUVE } from './trames'

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
  /**
   * Dossier qui joue `Documents/Gtracker` du téléphone ; modifié seulement par les commandes d'écriture du PC et par
   * le listage qui termine les échanges interrompus, jamais pour un téléphone `ancien`.
   */
  dossier: string
  nom?: string
  /** Appairage déjà fait. */
  memoire?: MemoireFaux | null
  /** Coupe la liaison au lieu d'envoyer le bloc qui suit ce nombre de blocs envoyés. */
  coupureApresBlocs?: number | null
  /**
   * Coupe la liaison au lieu d'écrire le bloc `ecrire` qui suit ce nombre de blocs écrits (depuis la création) ; le
   * provisoire est alors effacé, l'original intact, comme sur le téléphone.
   */
  coupureApresEcritures?: number | null
  /** Application d'avant l'écriture sans fil : lecture seule, racine et `sessions/` seulement. */
  ancien?: boolean
  /** Application d'avant l'échange SPAKE2 : `appairer` sans `partA`, pour vérifier que le PC le refuse. */
  ancienEchange?: boolean
  /** Le téléphone enregistre une session dès le départ (`enregistre` le change ensuite). */
  enregistre?: boolean
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

/**
 * Un PC trouvé par la découverte : l'adresse est celle d'où vient la réponse. `identifiantPc` est l'identifiant lu
 * dans la réponse : celui du PC en version 1, l'identifiant de sonde en version 2 (`identifiantDeSonde`).
 */
export type PcTrouve = { adresse: string; port: number; identifiantPc: string; nom: string; version: VersionSonde }

/**
 * Diffuse une question de découverte vers `hote:port` (adresse de diffusion, ou celle du PC), dans la version donnée
 * (1 par défaut), et rend la première réponse à son nonce dans cette version, `null` après `delaiMs`. En version 2,
 * `pcAttendu` (identifiant du PC appairé, en hexadécimal) écarte toute réponse dont l'identifiant de sonde n'est pas
 * le sien, comme le fait le téléphone appairé.
 */
export function sonder(
  hote: string,
  port: number,
  delaiMs = 3_000,
  alea: Alea = randomBytes,
  version: VersionSonde = VERSION_SONDE,
  pcAttendu?: string,
): Promise<PcTrouve | null> {
  return new Promise((resoudre) => {
    const nonce = alea(TAILLE_NONCE_SONDE)
    const attendu = version === VERSION_SONDE_V2 && pcAttendu !== undefined ? identifiantDeSonde(Buffer.from(pcAttendu, 'hex'), nonce) : null
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
      if (!r || r.version !== version || !egalATempsConstant(r.nonce, nonce)) return
      if (attendu !== null && !egalATempsConstant(r.identifiant, attendu)) return
      finir({ adresse: source.address, port: r.port, identifiantPc: enHex(r.identifiant), nom: r.nom, version: r.version })
    })
    socket.bind(0, () => {
      socket.setBroadcast(true)
      socket.send(encoderQuestion(nonce, version), port, hote)
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

/** Une écriture en cours sur une liaison : le fichier `chemin`, posé sous `provisoire` jusqu'à `valider`. */
type Ecriture = { chemin: string; taille: number; cible: string; provisoire: string; remplace: boolean; poignee: FileHandle; ecrits: number }

/** Ce qu'une liaison garde entre deux commandes : son écriture en cours, une seule à la fois. */
type EtatLiaison = { ecriture: Ecriture | null }

/** Vrai si `absolu` est un fichier, faux s'il n'existe pas ; lève si c'est un dossier. */
async function estFichier(absolu: string, chemin: string): Promise<boolean> {
  try {
    if (!(await stat(absolu)).isFile()) throw new ErreurDisque('UNKNOWN', `« ${chemin} » n'est pas un fichier sur le téléphone.`)
    return true
  } catch (e) {
    if (codeDe(e) === 'NOT_FOUND') return false
    throw e
  }
}

/** Efface un fichier ; sans effet s'il n'existe pas. */
async function effacerSiPresent(absolu: string): Promise<void> {
  try {
    await unlink(absolu)
  } catch (e) {
    if (codeDe(e) !== 'NOT_FOUND') throw e
  }
}

/** Le faux téléphone. */
export class FauxTelephone {
  /** Appairage gardé, `null` tant qu'il n'est pas fait. */
  memoire: MemoireFaux | null
  /** Vrai quand le téléphone enregistre une session : il refuse alors d'écrire et d'effacer. */
  enregistre: boolean
  /** Blocs envoyés depuis sa création. */
  blocsEnvoyes = 0
  /** Blocs `ecrire` écrits depuis sa création. */
  blocsEcrits = 0
  /** Commandes reçues depuis sa création. */
  commandesRecues = 0
  private readonly dossier: string
  private readonly nom: string
  private readonly coupureApresBlocs: number | null
  private readonly coupureApresEcritures: number | null
  private readonly ancien: boolean
  private readonly ancienEchange: boolean
  private readonly delaiMs: number
  private readonly alea: Alea
  private readonly falsifier: ((commande: Commande) => Message | undefined) | undefined
  /** Provisoires des écritures en cours, toutes liaisons comprises : le listage n'y touche pas. */
  private readonly enCours = new Set<string>()

  constructor(options: OptionsFauxTelephone) {
    this.falsifier = options.falsifier
    this.dossier = path.resolve(options.dossier)
    this.nom = options.nom ?? "Téléphone d'essai"
    this.memoire = options.memoire ?? null
    this.coupureApresBlocs = options.coupureApresBlocs ?? null
    this.coupureApresEcritures = options.coupureApresEcritures ?? null
    this.ancien = options.ancien ?? false
    this.ancienEchange = options.ancienEchange ?? false
    this.enregistre = options.enregistre ?? false
    this.delaiMs = options.delaiMs ?? 10_000
    this.alea = options.alea ?? randomBytes
  }

  /** Les capacités annoncées en se présentant ; aucune pour un téléphone ancien, qui n'envoie pas le champ. */
  private capacites(): { capacites?: Capacite[] } {
    return this.ancien ? {} : { capacites: [CAPACITE_ECRITURE] }
  }

  /** Les capacités annoncées dans `appairer` : celles de `bonjour`, plus l'échange SPAKE2 pour un téléphone à jour. */
  private capacitesAppairage(): { capacites?: Capacite[] } {
    return this.ancien ? {} : { capacites: [CAPACITE_ECRITURE, CAPACITE_SPAKE2] }
  }

  /**
   * Appaire le téléphone au PC par le code affiché (échange SPAKE2, `spake2.ts`), puis répond à ses commandes. Lève
   * `RefusPc` sur un refus, et sur un `defi` sans `partB` (raison `version`).
   */
  async appairer(hote: string, port: number, code: string): Promise<LiaisonFaux> {
    const liaison = new Liaison(await ouvrirTls(hote, port, this.delaiMs))
    try {
      const der = liaison.certificatDistant()
      if (!der) throw new Error('Le PC ne présente aucun certificat.')
      // L'empreinte vue est l'identité du PC dans l'échange : un relais, qui présente un autre certificat, échoue.
      const empreinte = empreinteCertificat(der)
      const nonceTelephone = enHex(this.alea(TAILLE_NONCE))
      if (this.ancienEchange) {
        liaison.envoyer({ type: 'appairer', version: PROTOCOLE_SANS_FIL, nom: this.nom, nonceTelephone, ...this.capacites() })
        this.attendu(await liaison.prochain(this.delaiMs), 'defi')
        throw new Error("Le PC a accepté l'ancien échange : appairage abandonné.")
      }
      // x neuf à chaque appairage : un état SPAKE2 ne sert qu'une fois.
      const etat = commencerAppairage('A', code, empreinte, this.alea)
      liaison.envoyer({ type: 'appairer', version: PROTOCOLE_SANS_FIL, nom: this.nom, nonceTelephone, partA: enHex(etat.part), ...this.capacitesAppairage() })
      const defi = this.attendu(await liaison.prochain(this.delaiMs), 'defi')
      // Un PC d'avant l'échange SPAKE2 : rien n'est prouvé, jamais de retour à l'ancien échange.
      if (defi.partB === undefined) throw new RefusPc('version')
      const cles = conclure(etat, depuisHex(defi.partB, TAILLE_PART_SPAKE2) as Uint8Array)
      liaison.envoyer({ type: 'preuve', preuve: enHex(cles.confirmationEnvoyee) })
      const appaire = this.attendu(await liaison.prochain(this.delaiMs), 'appaire')
      // Le jeton n'est gardé qu'une fois cB vérifiée : sans elle, ce PC ne connaît pas le code.
      if (!confirmationValide(cles, depuisHex(appaire.preuve, TAILLE_PREUVE) ?? new Uint8Array(0))) {
        throw new Error('Confirmation du PC fausse : appairage abandonné.')
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
      liaison.envoyer({ type: 'bonjour', version: PROTOCOLE_SANS_FIL, nom: this.nom, jeton: memoire.jeton, ...this.capacites() })
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
    const etat: EtatLiaison = { ecriture: null }
    // Le PC reconnu peut envoyer des trames à corps (`ecrire`) : limites larges.
    liaison.elargir()
    // Les réponses partent dans l'ordre des commandes, comme celles du vrai téléphone.
    liaison.servir((m) => {
      suite = suite.then(() => this.repondre(liaison, etat, m)).catch((e) => liaison.fermer((e as Error).message))
    })
    // La liaison coupée efface le provisoire de l'écriture en cours, après la commande en train d'être traitée ;
    // `fermee` ne se résout qu'ensuite.
    const fermee = new Promise<string>((fin) =>
      liaison.surFermeture((raison) => {
        suite = suite.then(() => this.abandonner(etat)).then(() => fin(raison))
      }),
    )
    return { liaison, fermee, fermer: () => liaison.fermer('fermée par le téléphone.') }
  }

  private async repondre(liaison: Liaison, etat: EtatLiaison, m: Message): Promise<void> {
    if (liaison.fermee) return
    const ecriture = m.type === 'ecrire' || m.type === 'valider' || m.type === 'effacer'
    // Un téléphone ancien ne connaît pas les commandes d'écriture : il ferme la liaison, comme sur un type inconnu.
    if (m.type !== 'lister' && m.type !== 'lire' && m.type !== 'ping' && !(ecriture && !this.ancien)) {
      liaison.fermer(`message inattendu du PC (« ${m.type} »).`)
      return
    }
    this.commandesRecues++
    const fausse = this.falsifier?.(m)
    if (fausse) return liaison.envoyer(fausse)
    if (m.type === 'ping') return liaison.envoyer(this.ancien ? { type: 'pong', id: m.id } : { type: 'pong', id: m.id, enregistre: this.enregistre })
    try {
      switch (m.type) {
        case 'lister':
          return liaison.envoyer({ type: 'liste', id: m.id, fichiers: await this.lister() })
        case 'lire': {
          if (this.coupureApresBlocs !== null && this.blocsEnvoyes >= this.coupureApresBlocs) {
            liaison.fermer("coupure d'essai.")
            return
          }
          const octets = await this.lireBloc(m.chemin, m.debut, m.longueur)
          if (liaison.fermee) return
          liaison.envoyer({ type: 'bloc', id: m.id, debut: m.debut, octets })
          this.blocsEnvoyes++
          return
        }
        case 'ecrire':
          if (this.coupureApresEcritures !== null && this.blocsEcrits >= this.coupureApresEcritures) {
            liaison.fermer("coupure d'essai.")
            return
          }
          await this.ecrireBloc(etat, m)
          if (liaison.fermee) return
          return liaison.envoyer({ type: 'fait', id: m.id })
        case 'valider': {
          const fichier = await this.valider(etat, m)
          if (liaison.fermee) return
          return liaison.envoyer({ type: 'ecrit', id: m.id, ...fichier })
        }
        case 'effacer':
          await this.effacer(etat, m.chemin)
          if (liaison.fermee) return
          return liaison.envoyer({ type: 'fait', id: m.id })
      }
    } catch (e) {
      if (liaison.fermee) return
      liaison.envoyer({ type: 'erreur', id: m.id, code: codeDe(e), message: ((e as Error).message ?? '').slice(0, MESSAGE_MAX) })
    }
  }

  // ---------- écriture, comme le greffon ----------

  /** Le fichier du dossier d'un chemin relatif déjà admis. */
  private absolu(chemin: string): string {
    return path.join(this.dossier, ...chemin.split('/'))
  }

  /** Abandonne l'écriture en cours de la liaison : provisoire fermé et effacé, l'original intact. */
  private async abandonner(etat: EtatLiaison): Promise<void> {
    const w = etat.ecriture
    if (!w) return
    etat.ecriture = null
    await w.poignee.close().catch(() => undefined)
    await unlink(w.provisoire).catch(() => undefined)
    this.enCours.delete(w.provisoire)
  }

  private refusEnregistrement(): ErreurDisque {
    return new ErreurDisque('PERMISSION', 'Le téléphone enregistre une session : il refuse d’être modifié.')
  }

  /**
   * Un bloc `ecrire` : le premier (début 0) abandonne l'écriture en cours et ouvre le provisoire, chacun des suivants
   * commence où le précédent finit, pour le même chemin et la même taille. Toute erreur efface le provisoire.
   */
  private async ecrireBloc(etat: EtatLiaison, m: CommandeEcrire): Promise<void> {
    if (this.enregistre) {
      await this.abandonner(etat)
      throw this.refusEnregistrement()
    }
    if (!cheminEcrivable(m.chemin)) throw cheminRefuse(m.chemin)
    if (m.debut === 0) {
      await this.abandonner(etat)
      const cible = this.absolu(m.chemin)
      const remplace = await estFichier(cible, m.chemin)
      const provisoire = nomProvisoire(cible, remplace)
      await mkdir(path.dirname(cible), { recursive: true })
      this.enCours.add(provisoire)
      let poignee: FileHandle
      try {
        poignee = await open(provisoire, 'w')
      } catch (e) {
        this.enCours.delete(provisoire)
        throw e
      }
      etat.ecriture = { chemin: m.chemin, taille: m.taille, cible, provisoire, remplace, poignee, ecrits: 0 }
    }
    const w = etat.ecriture
    if (!w || w.chemin !== m.chemin || w.taille !== m.taille || w.ecrits !== m.debut) {
      await this.abandonner(etat)
      throw new ErreurDisque('UNKNOWN', `Bloc hors d'ordre pour « ${m.chemin} » : début ${m.debut}.`)
    }
    try {
      await w.poignee.write(m.octets, 0, m.octets.length, m.debut)
    } catch (e) {
      await this.abandonner(etat)
      throw e
    }
    w.ecrits += m.octets.length
    this.blocsEcrits++
  }

  /**
   * Fin d'une écriture : taille du provisoire relue, puis, dans l'ordre de `replace` du téléphone, l'original retiré et
   * le provisoire renommé. Une taille fausse efface le provisoire ; un renommage manqué après le retrait de l'original
   * le laisse, complet, au listage suivant qui lui rendra son nom.
   */
  private async valider(etat: EtatLiaison, m: CommandeValider): Promise<FichierTelephone> {
    const w = etat.ecriture
    if (!w || w.chemin !== m.chemin) {
      await this.abandonner(etat)
      throw new ErreurDisque('UNKNOWN', `Aucune écriture en cours de « ${m.chemin} ».`)
    }
    etat.ecriture = null
    let originalRetire = false
    try {
      await w.poignee.close()
      const taille = (await stat(w.provisoire)).size
      if (taille !== m.taille || taille !== w.taille) throw new ErreurDisque('UNKNOWN', `Écriture incomplète de « ${m.chemin} » : ${taille} octets sur ${m.taille}.`)
      if (w.remplace) {
        await effacerSiPresent(w.cible)
        originalRetire = true
      }
      await rename(w.provisoire, w.cible)
    } catch (e) {
      if (!originalRetire) await unlink(w.provisoire).catch(() => undefined)
      throw e
    } finally {
      this.enCours.delete(w.provisoire)
    }
    const s = await stat(w.cible)
    return { chemin: m.chemin, taille: s.size, dateMs: Math.floor(s.mtimeMs) }
  }

  /**
   * Efface le seul fichier `chemin` ; sans effet s'il n'existe pas. Un remplacement interrompu à côté est effacé
   * d'abord : resté seul, le listage suivant lui rendrait le nom du fichier effacé.
   */
  private async effacer(etat: EtatLiaison, chemin: string): Promise<void> {
    if (this.enregistre) throw this.refusEnregistrement()
    if (!cheminEcrivable(chemin)) throw cheminRefuse(chemin)
    if (etat.ecriture?.chemin === chemin) await this.abandonner(etat)
    const original = this.absolu(chemin)
    for (const fichier of [nomProvisoire(original, true), original]) {
      if (this.enCours.has(fichier)) continue
      if (await estFichier(fichier, chemin)) await effacerSiPresent(fichier)
    }
  }

  // ---------- listage et lecture ----------

  /** Fichiers d'un dossier, pour un téléphone ancien : les provisoires ne se montrent pas, rien n'est modifié. */
  private async fichiersDe(dossier: string, prefixe: string): Promise<FichierTelephone[]> {
    const fichiers: FichierTelephone[] = []
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      if (!entree.isFile() || estTemporaire(entree.name)) continue
      const s = await stat(path.join(dossier, entree.name))
      fichiers.push({ chemin: prefixe + entree.name, taille: s.size, dateMs: Math.floor(s.mtimeMs) })
    }
    return fichiers
  }

  /**
   * Fichiers d'un dossier, pour un téléphone à jour, échanges interrompus terminés d'abord (règle de `list` du
   * greffon) ; les provisoires des écritures en cours sont épargnés et ne se montrent pas.
   */
  private async fichiersTermines(dossier: string, prefixe: string): Promise<FichierTelephone[]> {
    const entrees = (await readdir(dossier, { withFileTypes: true })).filter((e) => e.isFile())
    const noms = new Set(entrees.map((e) => e.name))
    const fichiers: FichierTelephone[] = []
    for (const entree of entrees) {
      const absolu = path.join(dossier, entree.name)
      if (this.enCours.has(absolu)) continue
      let nom = entree.name
      if (nom.endsWith(SUFFIXE_NEUF) && nom.length > SUFFIXE_NEUF.length) {
        await unlink(absolu).catch(() => undefined)
        continue
      }
      if (nom.endsWith(SUFFIXE_REMPLACEMENT) && nom.length > SUFFIXE_REMPLACEMENT.length) {
        const original = nom.slice(0, -SUFFIXE_REMPLACEMENT.length)
        if (noms.has(original)) {
          await unlink(absolu).catch(() => undefined)
          continue
        }
        try {
          await rename(absolu, path.join(dossier, original))
        } catch {
          continue
        }
        noms.add(original)
        nom = original
      }
      const s = await stat(path.join(dossier, nom))
      fichiers.push({ chemin: prefixe + nom, taille: s.size, dateMs: Math.floor(s.mtimeMs) })
    }
    return fichiers
  }

  private async lister(): Promise<FichierTelephone[]> {
    const fichiersDe = (dossier: string, prefixe: string) => (this.ancien ? this.fichiersDe(dossier, prefixe) : this.fichiersTermines(dossier, prefixe))
    const fichiers = await fichiersDe(this.dossier, '')
    for (const sous of this.ancien ? [DOSSIER_SESSIONS] : DOSSIERS_DU_CABLE) {
      try {
        fichiers.push(...(await fichiersDe(path.join(this.dossier, sous), `${sous}/`)))
      } catch (e) {
        if (codeDe(e) !== 'NOT_FOUND') throw e
      }
    }
    return fichiersAdmis(fichiers, this.ancien ? cheminAdmis : cheminDuCable)
  }

  private async lireBloc(chemin: string, debut: number, longueur: number): Promise<Uint8Array> {
    if (!(this.ancien ? cheminAdmis : cheminDuCable)(chemin)) throw new Error('Chemin refusé.')
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
