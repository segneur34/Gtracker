// Appairage d'un téléphone au programme Windows par un code tapé, et registre des téléphones appairés. Calcul pur :
// l'horloge et l'aléa sont passés en paramètre, rien ne touche au réseau ni au disque.
//
// ---------- Déroulé (messages décrits dans `trames.ts`) ----------
//
// 1. Sur le PC, l'utilisateur ouvre une fenêtre d'appairage : 2 minutes, un code de 6 chiffres affiché (tiré
//    uniformément de 000000 à 999999). Trois preuves fausses ferment la fenêtre ; un appairage réussi aussi, et une
//    onzième tentative commencée (au plus dix par fenêtre).
// 2. Le téléphone se connecte en TLS et lit l'empreinte du certificat du PC : SHA-256 des octets DER du certificat,
//    32 octets. Il envoie `appairer` avec `nonceTelephone`, 32 octets tirés au hasard.
// 3. Le PC répond `defi` avec `noncePc`, 32 octets tirés au hasard pour cette seule tentative.
// 4. Le téléphone envoie `preuve` : sa preuve, calculée avec le code tapé par l'utilisateur.
// 5. Le PC compare (à temps constant) à la preuve qu'il attend. Fausse : `refus` (raison `code`), un échec de plus.
//    Juste : `appaire`, avec la preuve du PC et un jeton de 32 octets tiré au hasard ; la fenêtre se ferme.
// 6. Le téléphone vérifie la preuve du PC avant de rien garder ; juste, il garde le jeton, l'empreinte du certificat
//    (fixée : toute liaison suivante dont le certificat a une autre empreinte est refusée), l'identifiant du PC.
// Le code ne circule jamais. Le téléphone prouve en premier : le PC ne dit rien qui dépende du code tant que le
//    téléphone n'a pas prouvé le connaître. Une preuve rejouée échoue : elle porte le `noncePc` d'une autre tentative.
//
// ---------- Preuves ----------
//
//   preuve du téléphone = HMAC-SHA256(clé, « gtracker-appairage-telephone » ‖ 0x00 ‖ empreinte ‖ nonceTelephone ‖ noncePc)
//   preuve du PC        = HMAC-SHA256(clé, « gtracker-appairage-pc »        ‖ 0x00 ‖ empreinte ‖ nonceTelephone ‖ noncePc)
// où `clé` est le code en 6 caractères ASCII (zéros en tête compris : « 042917 »), les étiquettes sont en ASCII, 0x00
// est un octet nul, `‖` met bout à bout, et empreinte, nonceTelephone et noncePc sont leurs 32 octets bruts (pas
// leur écriture hexadécimale). Une preuve fait 32 octets, écrite en hexadécimal minuscule dans les messages.
//
// ---------- Jeton ----------
//
// Au retour, le téléphone envoie `bonjour` avec son jeton (hexadécimal minuscule, 64 chiffres), par la liaison TLS
// dont il a vérifié l'empreinte. Le PC ne garde que le hachage du jeton : SHA-256 de ses 32 octets bruts, en
// hexadécimal minuscule. Un jeton de 256 bits tiré au hasard n'a pas besoin d'un hachage lent.
//
// ---------- Registre (profil du PC, jamais le dossier mémoire) ----------
//
//   { "version": 1, "telephones": [ { "id": "<16 octets en hexadécimal>", "nom": "Pixel 8",
//     "hachage": "<SHA-256 du jeton en hexadécimal>", "ajouteLe": <ms>, "vuLe": <ms ou null> } ] }
//
// Un PC accepte plusieurs téléphones ; retirer un téléphone révoque son jeton.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ErreurDisque } from './disque'
import type { RaisonRefus } from './trames'
import { nomAdmis } from './trames'

/** Source d'octets aléatoires ; `randomBytes` de Node hors des tests. */
export type Alea = (taille: number) => Uint8Array

/** Heure courante en millisecondes ; `Date.now` hors des tests. */
export type Horloge = () => number

/** Nombre de chiffres du code. */
export const CHIFFRES_CODE = 6

/** Durée d'une fenêtre d'appairage. */
export const DUREE_FENETRE_MS = 120_000

/** Preuves fausses qui ferment la fenêtre. */
export const ECHECS_MAX = 3

/**
 * Tentatives commencées par fenêtre. Un vrai téléphone en fait une, quelques-unes s'il perd la liaison ; au-delà,
 * c'est un hôte du réseau qui enchaîne les `appairer` sans prouver : la tentative de trop est refusée et ferme la
 * fenêtre, si bien que la mémoire gardée par fenêtre reste bornée (l'utilisateur en rouvre une).
 */
export const TENTATIVES_MAX = 10

/** Taille d'un nonce, du jeton, d'une empreinte de certificat et d'une preuve, en octets. */
export const TAILLE_NONCE = 32
export const TAILLE_JETON = 32
export const TAILLE_EMPREINTE = 32
export const TAILLE_PREUVE = 32

/** Taille de l'identifiant d'un PC ou d'un téléphone appairé, en octets. */
export const TAILLE_IDENTIFIANT = 16

/** Étiquettes qui séparent la preuve du téléphone de celle du PC : l'une ne peut pas servir pour l'autre. */
export const ETIQUETTE_TELEPHONE = 'gtracker-appairage-telephone'
export const ETIQUETTE_PC = 'gtracker-appairage-pc'

/** Version du registre écrit dans le profil. */
export const VERSION_REGISTRE = 1

// ---------- outils ----------

/** Octets en hexadécimal minuscule. */
export function enHex(octets: Uint8Array): string {
  return Buffer.from(octets).toString('hex')
}

/** Octets d'un texte hexadécimal minuscule de `taille` octets, `null` s'il n'en est pas un. */
export function depuisHex(texte: string, taille: number): Uint8Array | null {
  if (texte.length !== taille * 2 || !/^[0-9a-f]*$/.test(texte)) return null
  return Buffer.from(texte, 'hex')
}

/** Égalité de deux suites d'octets dont la durée ne dépend pas du contenu (seulement des longueurs). */
export function egalATempsConstant(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function exigerTaille(octets: Uint8Array, taille: number, quoi: string): void {
  if (octets.length !== taille) throw new ErreurDisque('UNKNOWN', `${quoi} : ${taille} octets attendus, ${octets.length} reçus.`)
}

/** Code de 6 chiffres, tiré sans biais : un entier de 32 bits est retiré tant qu'il tombe dans la dernière tranche incomplète. */
export function tirerCode(alea: Alea = randomBytes): string {
  const tranches = 10 ** CHIFFRES_CODE
  const plafond = Math.floor(2 ** 32 / tranches) * tranches
  for (;;) {
    const octets = alea(4)
    const v = Buffer.from(octets).readUInt32BE(0)
    if (v < plafond) return String(v % tranches).padStart(CHIFFRES_CODE, '0')
  }
}

/** Vrai pour un code : exactement 6 chiffres ASCII. */
export function codeAdmis(code: string): boolean {
  return new RegExp(`^[0-9]{${CHIFFRES_CODE}}$`).test(code)
}

function preuve(etiquette: string, code: string, empreinte: Uint8Array, nonceTelephone: Uint8Array, noncePc: Uint8Array): Uint8Array {
  if (!codeAdmis(code)) throw new ErreurDisque('UNKNOWN', `Code d'appairage mal formé : ${CHIFFRES_CODE} chiffres attendus.`)
  exigerTaille(empreinte, TAILLE_EMPREINTE, 'Empreinte du certificat')
  exigerTaille(nonceTelephone, TAILLE_NONCE, 'Nonce du téléphone')
  exigerTaille(noncePc, TAILLE_NONCE, 'Nonce du PC')
  const hmac = createHmac('sha256', Buffer.from(code, 'ascii'))
  hmac.update(Buffer.from(etiquette, 'ascii'))
  hmac.update(Buffer.from([0]))
  hmac.update(empreinte)
  hmac.update(nonceTelephone)
  hmac.update(noncePc)
  return hmac.digest()
}

/** Preuve que le téléphone connaît le code. */
export function preuveTelephone(code: string, empreinte: Uint8Array, nonceTelephone: Uint8Array, noncePc: Uint8Array): Uint8Array {
  return preuve(ETIQUETTE_TELEPHONE, code, empreinte, nonceTelephone, noncePc)
}

/** Preuve que le PC connaît le code. */
export function preuvePc(code: string, empreinte: Uint8Array, nonceTelephone: Uint8Array, noncePc: Uint8Array): Uint8Array {
  return preuve(ETIQUETTE_PC, code, empreinte, nonceTelephone, noncePc)
}

/** Jeton de 32 octets. */
export function tirerJeton(alea: Alea = randomBytes): Uint8Array {
  const jeton = alea(TAILLE_JETON)
  exigerTaille(jeton, TAILLE_JETON, 'Jeton')
  return jeton
}

/** Hachage d'un jeton tel que le PC le garde : SHA-256 de ses octets bruts, en hexadécimal minuscule. */
export function hacherJeton(jeton: Uint8Array): string {
  exigerTaille(jeton, TAILLE_JETON, 'Jeton')
  return createHash('sha256').update(jeton).digest('hex')
}

/** Identifiant de 16 octets en hexadécimal minuscule : celui du PC (tiré une fois, gardé dans le profil) ou d'un téléphone appairé. */
export function tirerIdentifiant(alea: Alea = randomBytes): string {
  const octets = alea(TAILLE_IDENTIFIANT)
  exigerTaille(octets, TAILLE_IDENTIFIANT, 'Identifiant')
  return enHex(octets)
}

// ---------- la fenêtre d'appairage ----------

/** Issue d'une tentative : le jeton à donner au téléphone avec la preuve du PC, ou la raison du refus. */
export type ConclusionAppairage =
  | { ok: true; preuvePc: Uint8Array; jeton: Uint8Array }
  | { ok: false; raison: RaisonRefus; fenetreFermee: boolean }

/** Une tentative commencée : le `noncePc` à envoyer dans `defi`, et la vérification de la preuve, une seule fois. */
export type TentativeAppairage = { ok: true; noncePc: Uint8Array; conclure(preuve: Uint8Array): ConclusionAppairage }

export type OptionsFenetre = {
  /** Empreinte SHA-256 du certificat que le PC présente, 32 octets. */
  empreinte: Uint8Array
  horloge?: Horloge
  alea?: Alea
  dureeMs?: number
  echecsMax?: number
  tentativesMax?: number
}

/**
 * Une fenêtre d'appairage : son code, sa fin, ses échecs. Plusieurs tentatives peuvent courir ensemble ; la première
 * qui réussit ferme la fenêtre. Un même `nonceTelephone` ne sert qu'une fois, une tentative ne se conclut qu'une fois,
 * et une fenêtre n'en commence pas plus de `TENTATIVES_MAX` : la suivante la ferme.
 */
export class FenetreAppairage {
  /** Le code à afficher. */
  readonly code: string
  /** Heure où la fenêtre se ferme d'elle-même, en millisecondes. */
  readonly expireA: number
  private readonly empreinte: Uint8Array
  private readonly horloge: Horloge
  private readonly alea: Alea
  private readonly echecsMax: number
  private readonly tentativesMax: number
  private echecsVus = 0
  private fermee = false
  private readonly noncesVus = new Set<string>()

  constructor(options: OptionsFenetre) {
    exigerTaille(options.empreinte, TAILLE_EMPREINTE, 'Empreinte du certificat')
    this.empreinte = Uint8Array.from(options.empreinte)
    this.horloge = options.horloge ?? Date.now
    this.alea = options.alea ?? randomBytes
    this.echecsMax = options.echecsMax ?? ECHECS_MAX
    this.tentativesMax = options.tentativesMax ?? TENTATIVES_MAX
    this.code = tirerCode(this.alea)
    this.expireA = this.horloge() + (options.dureeMs ?? DUREE_FENETRE_MS)
  }

  /** Preuves fausses reçues. */
  get echecs(): number {
    return this.echecsVus
  }

  /** Vrai tant que la fenêtre admet une tentative : ni expirée, ni fermée par un succès, trois échecs ou `fermer`. */
  ouverte(): boolean {
    return !this.fermee && this.echecsVus < this.echecsMax && this.horloge() < this.expireA
  }

  /** Millisecondes avant la fermeture, 0 si elle est fermée. */
  restantMs(): number {
    return this.ouverte() ? this.expireA - this.horloge() : 0
  }

  /** Ferme la fenêtre : plus aucune tentative ne réussit, même commencée. */
  fermer(): void {
    this.fermee = true
  }

  /** Tentatives commencées. */
  get tentatives(): number {
    return this.noncesVus.size
  }

  /**
   * Commence une tentative sur le `nonceTelephone` reçu dans `appairer`. Refus `fenetre` si elle est fermée, ou si
   * `TENTATIVES_MAX` tentatives sont déjà commencées (la fenêtre se ferme alors) ; refus `nonce` sur un nonce déjà vu.
   */
  commencer(nonceTelephone: Uint8Array): TentativeAppairage | { ok: false; raison: RaisonRefus } {
    exigerTaille(nonceTelephone, TAILLE_NONCE, 'Nonce du téléphone')
    if (!this.ouverte()) return { ok: false, raison: 'fenetre' }
    const cle = enHex(nonceTelephone)
    if (this.noncesVus.has(cle)) return { ok: false, raison: 'nonce' }
    if (this.noncesVus.size >= this.tentativesMax) {
      this.fermee = true
      return { ok: false, raison: 'fenetre' }
    }
    this.noncesVus.add(cle)
    const nonceT = Uint8Array.from(nonceTelephone)
    const noncePc = Uint8Array.from(this.alea(TAILLE_NONCE))
    exigerTaille(noncePc, TAILLE_NONCE, 'Nonce du PC')
    let conclue = false
    return {
      ok: true,
      noncePc,
      conclure: (preuveRecue: Uint8Array): ConclusionAppairage => {
        if (conclue) return { ok: false, raison: 'nonce', fenetreFermee: !this.ouverte() }
        conclue = true
        if (!this.ouverte()) return { ok: false, raison: 'fenetre', fenetreFermee: true }
        const attendue = preuveTelephone(this.code, this.empreinte, nonceT, noncePc)
        if (!egalATempsConstant(preuveRecue, attendue)) {
          this.echecsVus++
          return { ok: false, raison: 'code', fenetreFermee: !this.ouverte() }
        }
        this.fermee = true
        return { ok: true, preuvePc: preuvePc(this.code, this.empreinte, nonceT, noncePc), jeton: tirerJeton(this.alea) }
      },
    }
  }
}

// ---------- registre des téléphones appairés ----------

/** Un téléphone appairé, tel que le profil le garde. */
export type TelephoneAppaire = { id: string; nom: string; hachage: string; ajouteLe: number; vuLe: number | null }

/** Ce que la page peut voir d'un téléphone appairé : rien du jeton. */
export type TelephoneVisible = Omit<TelephoneAppaire, 'hachage'>

function telephoneLu(v: unknown): TelephoneAppaire | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const { id, nom, hachage, ajouteLe, vuLe } = v as Record<string, unknown>
  if (typeof id !== 'string' || depuisHex(id, TAILLE_IDENTIFIANT) === null) return null
  if (typeof nom !== 'string' || !nomAdmis(nom)) return null
  if (typeof hachage !== 'string' || depuisHex(hachage, 32) === null) return null
  if (typeof ajouteLe !== 'number' || !Number.isFinite(ajouteLe)) return null
  if (vuLe !== null && (typeof vuLe !== 'number' || !Number.isFinite(vuLe))) return null
  return { id, nom, hachage, ajouteLe, vuLe }
}

/** Les téléphones appairés à ce PC. */
export class RegistreTelephones {
  private telephones: TelephoneAppaire[]

  constructor(telephones: TelephoneAppaire[] = []) {
    this.telephones = telephones.map((t) => ({ ...t }))
  }

  /**
   * Registre relu du profil. Un texte absent ou illisible donne un registre vide (les téléphones se réappaireront) ;
   * une entrée mal formée ou en double (même identifiant) est écartée, les autres restent.
   */
  static depuisJson(texte: string | null): RegistreTelephones {
    if (texte === null) return new RegistreTelephones()
    let valeur: unknown
    try {
      valeur = JSON.parse(texte)
    } catch {
      return new RegistreTelephones()
    }
    const liste = typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>).telephones : undefined
    if (!Array.isArray(liste)) return new RegistreTelephones()
    const ids = new Set<string>()
    const telephones: TelephoneAppaire[] = []
    for (const brut of liste) {
      const t = telephoneLu(brut)
      if (t === null || ids.has(t.id)) continue
      ids.add(t.id)
      telephones.push(t)
    }
    return new RegistreTelephones(telephones)
  }

  /** Texte à écrire dans le profil. */
  enJson(): string {
    return JSON.stringify({ version: VERSION_REGISTRE, telephones: this.telephones }, null, 2) + '\n'
  }

  /** Téléphones appairés, dans l'ordre d'appairage, sans leur hachage. */
  liste(): TelephoneVisible[] {
    return this.telephones.map(({ hachage: _hachage, ...visible }) => visible)
  }

  /** Inscrit un téléphone qui vient de recevoir `jeton`, et rend sa fiche visible. */
  ajouter(nom: string, jeton: Uint8Array, maintenant: number, alea: Alea = randomBytes): TelephoneVisible {
    if (!nomAdmis(nom)) throw new ErreurDisque('UNKNOWN', "Nom de téléphone refusé.")
    let id = tirerIdentifiant(alea)
    while (this.telephones.some((t) => t.id === id)) id = tirerIdentifiant(alea)
    const telephone: TelephoneAppaire = { id, nom, hachage: hacherJeton(jeton), ajouteLe: maintenant, vuLe: null }
    this.telephones.push(telephone)
    const { hachage: _hachage, ...visible } = telephone
    return visible
  }

  /** Retire un téléphone : son jeton ne vaut plus rien. Faux s'il n'était pas inscrit. */
  retirer(id: string): boolean {
    const avant = this.telephones.length
    this.telephones = this.telephones.filter((t) => t.id !== id)
    return this.telephones.length !== avant
  }

  /**
   * Le téléphone dont `jetonHex` est le jeton, `null` si aucun (jeton mal formé, inconnu ou révoqué). Tous les
   * hachages sont comparés, à temps constant, sans s'arrêter au premier trouvé.
   */
  verifier(jetonHex: string): TelephoneVisible | null {
    const jeton = depuisHex(jetonHex, TAILLE_JETON)
    if (jeton === null) return null
    const recu = Buffer.from(hacherJeton(jeton), 'hex')
    let trouve: TelephoneAppaire | null = null
    for (const t of this.telephones) {
      if (egalATempsConstant(recu, Buffer.from(t.hachage, 'hex')) && trouve === null) trouve = t
    }
    if (trouve === null) return null
    const { hachage: _hachage, ...visible } = trouve
    return visible
  }

  /** Note l'heure de la dernière liaison d'un téléphone ; sans effet s'il n'est pas inscrit. */
  marquerVu(id: string, maintenant: number): void {
    const t = this.telephones.find((x) => x.id === id)
    if (t) t.vuLe = maintenant
  }
}
