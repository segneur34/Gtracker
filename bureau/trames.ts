// Trames de la liaison sans fil entre le programme Windows et le téléphone : découpage d'un flux d'octets en
// messages, et forme de chaque message. Calcul pur, sans réseau : la socket TLS qui porte ces trames est ailleurs.
//
// Le PC écoute, le téléphone se connecte par TLS et se présente (appairage par code, ou jeton déjà reçu) ; ensuite
// le PC envoie les commandes (`lister`, `lire`, `ping`) et le téléphone y répond. Rien n'écrit sur le téléphone.
//
// ---------- Format d'une trame (à reproduire tel quel côté téléphone) ----------
//
//   octets 0 à 3   longueur N de l'en-tête, entier non signé sur 32 bits, gros-boutiste (octet de poids fort d'abord)
//   octets 4 à 7   longueur M du corps, même codage
//   N octets       l'en-tête : un objet JSON encodé en UTF-8, sans marque d'ordre d'octets ; il porte toujours un
//                  champ `type` (texte non vide) ; des champs inconnus sont ignorés, l'ordre des champs est libre
//   M octets       le corps, octets bruts ; vide (M = 0) pour tous les messages sauf `bloc`
//
// Limites, vérifiées dès les 8 premiers octets, avant de rien attendre de plus :
//   1 ≤ N ≤ 8 388 608 (8 Mio, de quoi lister des milliers de sessions) ; 16 384 tant que le téléphone ne s'est pas
//   présenté (`LIMITES_ACCUEIL`) ;
//   0 ≤ M ≤ 1 048 576 (1 Mio, la taille d'un bloc de lecture) ; 0 tant que le téléphone ne s'est pas présenté.
// Une trame hors limites, un en-tête qui n'est pas de l'UTF-8 valide ou pas un objet JSON à `type` texte, ou un flux
// qui s'arrête au milieu d'une trame, sont des erreurs de la liaison : on la ferme.
//
// ---------- Messages (champ `type` de l'en-tête) ----------
//
// Conventions : `nonce…`, `preuve`, `jeton` et `identifiantPc` sont des octets écrits en hexadécimal minuscule
// (64 chiffres pour 32 octets, 32 chiffres pour 16 octets) ; `id`, `debut`, `longueur`, `taille`, `version` sont des
// entiers JSON positifs ou nuls ; `dateMs` est une date en millisecondes depuis le 1er janvier 1970 (UTC) ; `nom`
// est un texte de 1 à 100 caractères sans caractère de contrôle.
//
// Accueil, téléphone vers PC (premier message de la liaison) :
//   appairer   { version, nom, nonceTelephone }         demande d'appairage par le code affiché sur le PC
//   bonjour    { version, nom, jeton }                  téléphone déjà appairé, il présente son jeton
// Appairage (description des preuves : `appairage.ts`) :
//   defi       { noncePc }                              PC vers téléphone, réponse à `appairer`
//   preuve     { preuve }                               téléphone vers PC : preuve du téléphone
//   appaire    { preuve, jeton, identifiantPc, nomPc }  PC vers téléphone : preuve du PC et jeton de 32 octets
//   bienvenue  { identifiantPc, nomPc }                 PC vers téléphone, réponse à un `bonjour` au jeton connu
//   refus      { raison }                               PC vers téléphone, puis le PC ferme la liaison ;
//                                                       raison : code, fenetre, nonce, jeton ou version
// Commandes, PC vers téléphone, chacune avec un `id` (entier de 0 à 2 147 483 647) que la réponse reprend :
//   lister     { id }                                   fichiers de la racine et de `sessions/` du dossier mémoire
//   lire       { id, chemin, debut, longueur }          octets [debut, debut + longueur) d'un fichier listé ;
//                                                       1 ≤ longueur ≤ 1 048 576
//   ping       { id }                                   la liaison vit-elle encore
// Réponses, téléphone vers PC :
//   liste      { id, fichiers: [{ chemin, taille, dateMs }] }   chemin relatif, `/` comme séparateur, un fichier de
//                                                       la racine ou de `sessions/` (règles de `cheminAdmis`)
//   bloc       { id, debut, longueur } + corps          les octets lus ; `longueur` égale la taille du corps, plus
//                                                       courte que demandée seulement à la fin du fichier
//   pong       { id }
//   erreur     { id, code, message }                    code : NOT_FOUND, PERMISSION, NO_SPACE ou UNKNOWN ;
//                                                       message : phrase en clair, 500 caractères au plus

import { ErreurDisque } from './disque'
import type { CodeErreur } from './disque'
import type { FichierTelephone } from './telephone'
import { cheminAdmis, fichiersAdmis } from './telephone'

/** Version du protocole, portée par `appairer` et `bonjour`. */
export const PROTOCOLE_SANS_FIL = 1

/** Port TCP où le PC écoute d'abord. */
export const PORT_SANS_FIL = 48217

/** Taille d'un bloc de lecture : une commande `lire` ne demande jamais plus. */
export const TAILLE_BLOC = 1_048_576

/** Taille des deux longueurs qui ouvrent chaque trame. */
export const TAILLE_PREFIXE = 8

/** Plus grand identifiant de commande, celui d'un entier signé sur 32 bits (le `int` du téléphone). */
export const ID_MAX = 2_147_483_647

/** Plus long nom d'appareil admis, en caractères. */
export const NOM_MAX = 100

/** Plus long message d'erreur gardé, en caractères ; au-delà, il est coupé. */
export const MESSAGE_MAX = 500

/** Tailles admises d'une trame, en octets. */
export type Limites = { enTete: number; corps: number }

/** Limites d'une liaison où le téléphone s'est présenté. */
export const LIMITES: Readonly<Limites> = Object.freeze({ enTete: 8_388_608, corps: TAILLE_BLOC })

/** Limites avant que le téléphone se soit présenté : un inconnu ne fait pas réserver plus que ces quelques octets. */
export const LIMITES_ACCUEIL: Readonly<Limites> = Object.freeze({ enTete: 16_384, corps: 0 })

/** Raisons d'un refus du PC. */
export const RAISONS_REFUS = ['code', 'fenetre', 'nonce', 'jeton', 'version'] as const
export type RaisonRefus = (typeof RAISONS_REFUS)[number]

const CODES_ERREUR = ['NOT_FOUND', 'PERMISSION', 'NO_SPACE', 'UNKNOWN'] as const satisfies readonly CodeErreur[]

/** Ce qui ne va pas dans le flux ou dans un message. */
export type RaisonTrame =
  /** Longueur d'en-tête nulle. */
  | 'EN_TETE_VIDE'
  /** En-tête plus long que la limite. */
  | 'EN_TETE_TROP_LONG'
  /** Corps plus long que la limite. */
  | 'CORPS_TROP_LONG'
  /** En-tête qui n'est pas de l'UTF-8 valide, pas un objet JSON, ou sans `type` texte. */
  | 'EN_TETE_ILLISIBLE'
  /** Flux arrêté au milieu d'une trame. */
  | 'TRONQUEE'
  /** `type` inconnu de ce protocole. */
  | 'MESSAGE_INCONNU'
  /** `type` connu mais champs manquants, mal typés ou hors bornes. */
  | 'MESSAGE_INVALIDE'

/** Erreur de la liaison sans fil ; un `ErreurDisque` de code `UNKNOWN`, pour passer telle quelle par le pont. */
export class ErreurTrame extends ErreurDisque {
  raison: RaisonTrame
  constructor(raison: RaisonTrame, message: string) {
    super('UNKNOWN', message)
    this.name = 'ErreurTrame'
    this.raison = raison
  }
}

/** En-tête d'une trame : un objet JSON qui porte au moins `type`. */
export type EnTete = { type: string } & Record<string, unknown>

/** Une trame reçue en entier. */
export type Trame = { enTete: EnTete; corps: Uint8Array }

// ---------- encodage et décodage des trames ----------

function verifierTailles(n: number, m: number, limites: Limites): void {
  if (n === 0) throw new ErreurTrame('EN_TETE_VIDE', 'Trame sans en-tête.')
  if (n > limites.enTete) throw new ErreurTrame('EN_TETE_TROP_LONG', `En-tête de ${n} octets, plus que les ${limites.enTete} admis.`)
  if (m > limites.corps) throw new ErreurTrame('CORPS_TROP_LONG', `Corps de ${m} octets, plus que les ${limites.corps} admis.`)
}

/** Octets d'une trame. Lève `ErreurTrame` si elle dépasse les limites. */
export function encoderTrame(enTete: EnTete, corps: Uint8Array = new Uint8Array(0), limites: Limites = LIMITES): Uint8Array {
  const texte = Buffer.from(JSON.stringify(enTete), 'utf8')
  verifierTailles(texte.length, corps.length, limites)
  const sortie = Buffer.alloc(TAILLE_PREFIXE + texte.length + corps.length)
  sortie.writeUInt32BE(texte.length, 0)
  sortie.writeUInt32BE(corps.length, 4)
  texte.copy(sortie, TAILLE_PREFIXE)
  sortie.set(corps, TAILLE_PREFIXE + texte.length)
  return sortie
}

/** UTF-8 strict qui garde une marque d'ordre d'octets en tête : le JSON la refuse alors, comme le format le veut. */
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

function lireEnTete(octets: Uint8Array): EnTete {
  let valeur: unknown
  try {
    valeur = JSON.parse(UTF8_STRICT.decode(octets))
  } catch {
    throw new ErreurTrame('EN_TETE_ILLISIBLE', "En-tête illisible : ni de l'UTF-8 valide ni du JSON.")
  }
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) throw new ErreurTrame('EN_TETE_ILLISIBLE', "L'en-tête n'est pas un objet JSON.")
  const type = (valeur as Record<string, unknown>).type
  if (typeof type !== 'string' || type === '') throw new ErreurTrame('EN_TETE_ILLISIBLE', "L'en-tête n'a pas de champ « type ».")
  return valeur as EnTete
}

/**
 * Découpe un flux d'octets en trames, quels que soient les morceaux reçus (une trame en plusieurs morceaux, plusieurs
 * trames dans un seul). Après une erreur, le décodeur est hors d'usage : chaque appel relève la même erreur.
 */
export class DecodeurTrames {
  /** Limites appliquées aux trames dont les longueurs ne sont pas encore lues ; se resserre ou s'élargit en route. */
  limites: Limites
  private morceaux: Buffer[] = []
  private recus = 0
  private attendu: { n: number; m: number } | null = null
  private erreur: ErreurTrame | null = null

  /**
   * Par défaut, les limites de l'accueil : un inconnu ne fait rien réserver de plus que quelques octets. Les limites
   * larges (`LIMITES`) se posent explicitement, une fois le téléphone reconnu.
   */
  constructor(limites: Limites = LIMITES_ACCUEIL) {
    this.limites = limites
  }

  /** Octets reçus et pas encore rendus en trame. */
  get enAttente(): number {
    return this.recus + (this.attendu ? TAILLE_PREFIXE : 0)
  }

  /** Ajoute un morceau du flux et rend les trames qu'il complète, dans l'ordre. Lève `ErreurTrame`. */
  pousser(morceau: Uint8Array): Trame[] {
    if (this.erreur) throw this.erreur
    if (morceau.length > 0) {
      this.morceaux.push(Buffer.from(morceau))
      this.recus += morceau.length
    }
    const trames: Trame[] = []
    for (;;) {
      if (!this.attendu) {
        if (this.recus < TAILLE_PREFIXE) break
        const prefixe = this.prendre(TAILLE_PREFIXE)
        const n = prefixe.readUInt32BE(0)
        const m = prefixe.readUInt32BE(4)
        try {
          verifierTailles(n, m, this.limites)
        } catch (e) {
          throw this.echouer(e as ErreurTrame)
        }
        this.attendu = { n, m }
      }
      const { n, m } = this.attendu
      if (this.recus < n + m) break
      const octets = this.prendre(n + m)
      this.attendu = null
      try {
        trames.push({ enTete: lireEnTete(octets.subarray(0, n)), corps: octets.subarray(n) })
      } catch (e) {
        throw this.echouer(e as ErreurTrame)
      }
    }
    return trames
  }

  /** Fin du flux : lève `TRONQUEE` si une trame était commencée. */
  fin(): void {
    if (this.erreur) throw this.erreur
    if (this.enAttente > 0) throw this.echouer(new ErreurTrame('TRONQUEE', `Liaison coupée au milieu d'une trame (${this.enAttente} octets en attente).`))
  }

  private echouer(erreur: ErreurTrame): ErreurTrame {
    this.erreur = erreur
    this.morceaux = []
    this.recus = 0
    this.attendu = null
    return erreur
  }

  /** Retire `taille` octets du début du flux reçu, dans un tampon neuf (jamais une vue sur un morceau reçu). */
  private prendre(taille: number): Buffer {
    const sortie = Buffer.alloc(taille)
    let place = 0
    while (place < taille) {
      const premier = this.morceaux[0]
      const pris = Math.min(premier.length, taille - place)
      premier.copy(sortie, place, 0, pris)
      place += pris
      if (pris === premier.length) this.morceaux.shift()
      else this.morceaux[0] = premier.subarray(pris)
    }
    this.recus -= taille
    return sortie
  }
}

// ---------- messages ----------

/** Demande d'appairage du téléphone. */
export type MessageAppairer = { type: 'appairer'; version: number; nom: string; nonceTelephone: string }
/** Téléphone déjà appairé qui présente son jeton. */
export type MessageBonjour = { type: 'bonjour'; version: number; nom: string; jeton: string }
export type MessageDefi = { type: 'defi'; noncePc: string }
export type MessagePreuve = { type: 'preuve'; preuve: string }
export type MessageAppaire = { type: 'appaire'; preuve: string; jeton: string; identifiantPc: string; nomPc: string }
export type MessageBienvenue = { type: 'bienvenue'; identifiantPc: string; nomPc: string }
export type MessageRefus = { type: 'refus'; raison: RaisonRefus }

export type CommandeLister = { type: 'lister'; id: number }
export type CommandeLire = { type: 'lire'; id: number; chemin: string; debut: number; longueur: number }
export type CommandePing = { type: 'ping'; id: number }
/** Commandes du PC. */
export type Commande = CommandeLister | CommandeLire | CommandePing

export type ReponseListe = { type: 'liste'; id: number; fichiers: FichierTelephone[] }
/** Octets lus ; `longueur` de l'en-tête est la taille de `octets`, posée à l'encodage. */
export type ReponseBloc = { type: 'bloc'; id: number; debut: number; octets: Uint8Array }
export type ReponsePong = { type: 'pong'; id: number }
export type ReponseErreur = { type: 'erreur'; id: number; code: CodeErreur; message: string }
/** Réponses du téléphone. */
export type ReponseTelephone = ReponseListe | ReponseBloc | ReponsePong | ReponseErreur

/** Messages de l'accueil et de l'appairage. */
export type MessageAccueil = MessageAppairer | MessageBonjour | MessageDefi | MessagePreuve | MessageAppaire | MessageBienvenue | MessageRefus

/** Tout message de la liaison. */
export type Message = MessageAccueil | Commande | ReponseTelephone

/** Octets d'un message. Lève `ErreurTrame` s'il dépasse les limites. */
export function encoderMessage(message: Message, limites: Limites = LIMITES): Uint8Array {
  if (message.type === 'bloc') {
    const { octets, ...reste } = message
    return encoderTrame({ ...reste, longueur: octets.length }, octets, limites)
  }
  return encoderTrame(message, undefined, limites)
}

/** Vrai pour un nom d'appareil : 1 à `NOM_MAX` caractères, sans caractère de contrôle (C0, effacement, C1). */
export function nomAdmis(nom: string): boolean {
  if (nom.length === 0 || nom.length > NOM_MAX) return false
  for (let i = 0; i < nom.length; i++) {
    const c = nom.charCodeAt(i)
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return false
  }
  return true
}

function invalide(type: string, champ: string): ErreurTrame {
  return new ErreurTrame('MESSAGE_INVALIDE', `Message « ${type} » mal formé : champ « ${champ} ».`)
}

/** Lecture des champs d'un en-tête, chacune levant `MESSAGE_INVALIDE` sur un champ manquant ou hors bornes. */
function lecteur(enTete: EnTete) {
  const type = enTete.type
  const entier = (champ: string, min: number, max: number): number => {
    const v = enTete[champ]
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw invalide(type, champ)
    return v
  }
  const hex = (champ: string, octets: number): string => {
    const v = enTete[champ]
    if (typeof v !== 'string' || v.length !== octets * 2 || !/^[0-9a-f]*$/.test(v)) throw invalide(type, champ)
    return v
  }
  const nom = (champ: string): string => {
    const v = enTete[champ]
    if (typeof v !== 'string' || !nomAdmis(v)) throw invalide(type, champ)
    return v
  }
  return {
    id: () => entier('id', 0, ID_MAX),
    version: () => entier('version', 0, ID_MAX),
    entier,
    hex,
    nom,
  }
}

/** Les champs d'un fichier de `liste`, sans encore juger son chemin ; `null` si un champ est mal typé. */
function fichierBrut(v: unknown): FichierTelephone | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const { chemin, taille, dateMs } = v as Record<string, unknown>
  if (typeof chemin !== 'string' || typeof taille !== 'number' || typeof dateMs !== 'number') return null
  return { chemin, taille, dateMs }
}

/**
 * Le message porté par une trame, champs vérifiés. Lève `MESSAGE_INCONNU` sur un `type` inconnu, `MESSAGE_INVALIDE`
 * sur un champ manquant, mal typé ou hors bornes. Dans une `liste`, les fichiers dont le chemin, la taille ou la date
 * ne sont pas admis sont écartés, comme ceux du câble (`fichiersAdmis`) ; la liste rendue est triée par chemin.
 */
export function lireMessage(trame: Trame): Message {
  const { enTete, corps } = trame
  const l = lecteur(enTete)
  const type = enTete.type
  if (type !== 'bloc' && corps.length > 0) throw invalide(type, 'corps')
  switch (type) {
    case 'appairer':
      return { type, version: l.version(), nom: l.nom('nom'), nonceTelephone: l.hex('nonceTelephone', 32) }
    case 'bonjour':
      return { type, version: l.version(), nom: l.nom('nom'), jeton: l.hex('jeton', 32) }
    case 'defi':
      return { type, noncePc: l.hex('noncePc', 32) }
    case 'preuve':
      return { type, preuve: l.hex('preuve', 32) }
    case 'appaire':
      return { type, preuve: l.hex('preuve', 32), jeton: l.hex('jeton', 32), identifiantPc: l.hex('identifiantPc', 16), nomPc: l.nom('nomPc') }
    case 'bienvenue':
      return { type, identifiantPc: l.hex('identifiantPc', 16), nomPc: l.nom('nomPc') }
    case 'refus': {
      const raison = enTete.raison
      if (!(RAISONS_REFUS as readonly unknown[]).includes(raison)) throw invalide(type, 'raison')
      return { type, raison: raison as RaisonRefus }
    }
    case 'lister':
    case 'ping':
      return { type, id: l.id() }
    case 'lire': {
      const chemin = enTete.chemin
      if (typeof chemin !== 'string' || !cheminAdmis(chemin)) throw invalide(type, 'chemin')
      return { type, id: l.id(), chemin, debut: l.entier('debut', 0, Number.MAX_SAFE_INTEGER), longueur: l.entier('longueur', 1, TAILLE_BLOC) }
    }
    case 'liste': {
      const fichiers = enTete.fichiers
      if (!Array.isArray(fichiers)) throw invalide(type, 'fichiers')
      const bruts = fichiers.map(fichierBrut)
      if (bruts.some((f) => f === null)) throw invalide(type, 'fichiers')
      return { type, id: l.id(), fichiers: fichiersAdmis(bruts as FichierTelephone[]) }
    }
    case 'bloc': {
      const id = l.id()
      const debut = l.entier('debut', 0, Number.MAX_SAFE_INTEGER)
      if (l.entier('longueur', 0, TAILLE_BLOC) !== corps.length) throw invalide(type, 'longueur')
      return { type, id, debut, octets: corps }
    }
    case 'pong':
      return { type, id: l.id() }
    case 'erreur': {
      const code = (CODES_ERREUR as readonly unknown[]).includes(enTete.code) ? (enTete.code as CodeErreur) : 'UNKNOWN'
      const message = typeof enTete.message === 'string' ? enTete.message.slice(0, MESSAGE_MAX) : ''
      return { type, id: l.id(), code, message }
    }
    default:
      throw new ErreurTrame('MESSAGE_INCONNU', `Message inconnu : « ${type.slice(0, 40)} ».`)
  }
}

/** Les commandes `lire` d'un fichier entier, sans `id` : blocs de `TAILLE_BLOC` octets, le dernier plus court ; aucun pour un fichier vide. */
export function blocsDeLecture(taille: number): { debut: number; longueur: number }[] {
  const blocs: { debut: number; longueur: number }[] = []
  for (let debut = 0; debut < taille; debut += TAILLE_BLOC) blocs.push({ debut, longueur: Math.min(TAILLE_BLOC, taille - debut) })
  return blocs
}
