// Découverte du PC sur le réseau local : la question que le téléphone diffuse en UDP, la réponse du PC, et le tri
// des adresses IPv4 privées du PC. Calcul pur, octets seulement : les sockets sont ailleurs.
//
// Le téléphone essaie d'abord la dernière adresse connue du PC ; sinon il diffuse une question (adresse de
// diffusion de son réseau, ou 255.255.255.255) vers le port UDP 48218 ; chaque PC Gtracker à l'écoute répond à
// l'adresse et au port d'où vient la question. L'adresse du PC est l'adresse source de la réponse (elle n'est pas
// dans le paquet). Le téléphone garde la réponse dont le nonce est celui de sa question et, s'il est déjà appairé,
// dont l'identifiant est celui de son PC. Une réponse n'est pas une preuve : l'empreinte du certificat, vérifiée à
// la liaison TLS, l'est.
//
// Deux versions du format, même disposition, que le PC sert toutes les deux, chacune dans sa version :
//   1  l'identifiant du PC en clair ; gardée pour les applications du téléphone d'avant la version 2, déjà reliées ;
//   2  l'identifiant du PC remplacé par l'identifiant de sonde, qui ne vaut que pour le nonce de la question :
//      les 16 premiers octets de HMAC-SHA256(clé = les 16 octets de l'identifiant du PC, « gtracker-sonde » en ASCII
//      ‖ les 16 octets du nonce) (`identifiantDeSonde`). Un hôte du réseau ne peut ni suivre un PC d'une question à
//      l'autre, ni répondre à sa place sous l'identifiant attendu par un téléphone appairé, qui seul connaît la clé.
// Le nom du PC part vide dans toute réponse : le téléphone ne s'en sert pas, et il n'a pas à partir chez tout hôte
// qui le demande.
//
// ---------- Question (téléphone vers PC), 22 octets exactement ----------
//
//   octets 0 à 3     « GTRK » en ASCII : 0x47 0x54 0x52 0x4B
//   octet 4          version du format : 1 ou 2
//   octet 5          sorte de paquet : 0x01 (question)
//   octets 6 à 21    nonce de la question, 16 octets tirés au hasard
//
// ---------- Réponse (PC vers téléphone), 41 + L octets exactement ----------
//
//   octets 0 à 3     « GTRK »
//   octet 4          version du format : celle de la question
//   octet 5          sorte de paquet : 0x02 (réponse)
//   octets 6 à 21    nonce de la question, recopié
//   octets 22 et 23  port TCP du serveur TLS du PC, entier non signé sur 16 bits, gros-boutiste, de 1 à 65 535
//   octets 24 à 39   version 1 : identifiant du PC, 16 octets (celui que le téléphone reçoit à l'appairage) ;
//                    version 2 : identifiant de sonde, 16 octets
//   octet 40         L, longueur du nom du PC en octets, de 0 à 64 (toujours 0 en version 2)
//   L octets         nom du PC en UTF-8 valide, sans caractère de contrôle
//
// Tout autre paquet (autre signature, autre version, autre sorte, autre longueur, port nul, nom illisible) est
// étranger et ignoré sans réponse.

import { createHmac } from 'node:crypto'
import { nomAdmis } from './trames'

/** Port UDP où le PC attend les questions. */
export const PORT_SONDE = 48218

/** Signature qui ouvre chaque paquet. */
export const SIGNATURE_SONDE = Uint8Array.from([0x47, 0x54, 0x52, 0x4b])

/** Version 1 du format : l'identifiant du PC en clair dans la réponse. */
export const VERSION_SONDE = 1
/** Version 2 du format : l'identifiant de sonde à la place de l'identifiant du PC. */
export const VERSION_SONDE_V2 = 2
export const VERSIONS_SONDE = [VERSION_SONDE, VERSION_SONDE_V2] as const
export type VersionSonde = (typeof VERSIONS_SONDE)[number]

export const SORTE_QUESTION = 0x01
export const SORTE_REPONSE = 0x02

/** Étiquette de l'identifiant de sonde de la version 2. */
export const ETIQUETTE_SONDE = 'gtracker-sonde'

/** Taille du nonce d'une question et de l'identifiant du PC, en octets. */
export const TAILLE_NONCE_SONDE = 16
export const TAILLE_IDENTIFIANT_PC = 16

/** Plus long nom du PC dans une réponse, en octets UTF-8. */
export const NOM_PC_MAX_OCTETS = 64

const TAILLE_QUESTION = 6 + TAILLE_NONCE_SONDE
const TAILLE_REPONSE_FIXE = 6 + TAILLE_NONCE_SONDE + 2 + TAILLE_IDENTIFIANT_PC + 1

/**
 * Réponse du PC, dans la version de la question ; `identifiant` est celui du PC en version 1, l'identifiant de sonde
 * en version 2.
 */
export type ReponseSonde = { version: VersionSonde; nonce: Uint8Array; port: number; identifiant: Uint8Array; nom: string }

function entete(version: VersionSonde, sorte: number): Buffer {
  return Buffer.from([...SIGNATURE_SONDE, version, sorte])
}

/** La version d'un paquet de cette sorte, `null` s'il n'a pas l'en-tête d'un paquet de cette sorte. */
function versionDe(paquet: Uint8Array, sorte: number): VersionSonde | null {
  if (!SIGNATURE_SONDE.every((o, i) => paquet[i] === o) || paquet[5] !== sorte) return null
  return (VERSIONS_SONDE as readonly number[]).includes(paquet[4]) ? (paquet[4] as VersionSonde) : null
}

function exigerTaille(octets: Uint8Array, taille: number, quoi: string): void {
  if (octets.length !== taille) throw new RangeError(`${quoi} : ${taille} octets attendus, ${octets.length} reçus.`)
}

/**
 * Identifiant de sonde (version 2) : les 16 premiers octets de HMAC-SHA256(clé = identifiant du PC, « gtracker-sonde »
 * ‖ nonce de la question).
 */
export function identifiantDeSonde(identifiantPc: Uint8Array, nonce: Uint8Array): Uint8Array {
  exigerTaille(identifiantPc, TAILLE_IDENTIFIANT_PC, 'Identifiant du PC')
  exigerTaille(nonce, TAILLE_NONCE_SONDE, 'Nonce de la question')
  const hmac = createHmac('sha256', identifiantPc)
  hmac.update(Buffer.from(ETIQUETTE_SONDE, 'ascii'))
  hmac.update(nonce)
  return Uint8Array.from(hmac.digest().subarray(0, TAILLE_IDENTIFIANT_PC))
}

/** Octets d'une question, en version 1 par défaut. */
export function encoderQuestion(nonce: Uint8Array, version: VersionSonde = VERSION_SONDE): Uint8Array {
  exigerTaille(nonce, TAILLE_NONCE_SONDE, 'Nonce de la question')
  return Buffer.concat([entete(version, SORTE_QUESTION), nonce])
}

/** La version et le nonce d'une question, `null` pour un paquet étranger. */
export function decoderQuestion(paquet: Uint8Array): { version: VersionSonde; nonce: Uint8Array } | null {
  const version = paquet.length === TAILLE_QUESTION ? versionDe(paquet, SORTE_QUESTION) : null
  if (version === null) return null
  return { version, nonce: Uint8Array.from(paquet.subarray(6)) }
}

/**
 * Nom du PC tel qu'il part dans une réponse : caractères de contrôle retirés, coupé à 64 octets UTF-8 sans couper
 * un caractère. Le nom de l'ordinateur sous Windows peut dépasser.
 */
export function nomPcPourSonde(nom: string): string {
  let sortie = ''
  for (const c of nom) {
    const code = c.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue
    if (Buffer.byteLength(sortie + c, 'utf8') > NOM_PC_MAX_OCTETS) break
    sortie += c
  }
  return sortie
}

/** Octets d'une réponse. Le nom doit déjà tenir (`nomPcPourSonde`), et être vide en version 2. */
export function encoderReponse(reponse: ReponseSonde): Uint8Array {
  if (!(VERSIONS_SONDE as readonly number[]).includes(reponse.version)) throw new RangeError(`Version de sonde inconnue : ${reponse.version}.`)
  exigerTaille(reponse.nonce, TAILLE_NONCE_SONDE, 'Nonce de la question')
  exigerTaille(reponse.identifiant, TAILLE_IDENTIFIANT_PC, 'Identifiant du PC')
  if (!Number.isInteger(reponse.port) || reponse.port < 1 || reponse.port > 65535) throw new RangeError(`Port hors bornes : ${reponse.port}.`)
  const nom = Buffer.from(reponse.nom, 'utf8')
  if (nom.length > NOM_PC_MAX_OCTETS || (nom.length > 0 && !nomAdmis(reponse.nom))) throw new RangeError('Nom du PC refusé dans une réponse.')
  if (reponse.version === VERSION_SONDE_V2 && nom.length > 0) throw new RangeError('Nom du PC refusé dans une réponse de version 2.')
  const port = Buffer.alloc(2)
  port.writeUInt16BE(reponse.port, 0)
  return Buffer.concat([entete(reponse.version, SORTE_REPONSE), reponse.nonce, port, reponse.identifiant, Buffer.from([nom.length]), nom])
}

const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** La réponse d'un PC, `null` pour un paquet étranger. */
export function decoderReponse(paquet: Uint8Array): ReponseSonde | null {
  const version = paquet.length >= TAILLE_REPONSE_FIXE ? versionDe(paquet, SORTE_REPONSE) : null
  if (version === null) return null
  const octets = Buffer.from(paquet)
  const longueurNom = octets[TAILLE_REPONSE_FIXE - 1]
  if (longueurNom > NOM_PC_MAX_OCTETS || paquet.length !== TAILLE_REPONSE_FIXE + longueurNom) return null
  const port = octets.readUInt16BE(6 + TAILLE_NONCE_SONDE)
  if (port === 0) return null
  let nom: string
  try {
    nom = UTF8_STRICT.decode(octets.subarray(TAILLE_REPONSE_FIXE))
  } catch {
    return null
  }
  if (nom.length > 0 && !nomAdmis(nom)) return null
  return {
    version,
    nonce: Uint8Array.from(octets.subarray(6, 6 + TAILLE_NONCE_SONDE)),
    port,
    identifiant: Uint8Array.from(octets.subarray(8 + TAILLE_NONCE_SONDE, 8 + TAILLE_NONCE_SONDE + TAILLE_IDENTIFIANT_PC)),
    nom,
  }
}

// ---------- adresses IPv4 privées ----------

/** Une adresse IPv4 privée du PC, son masque, l'adresse de diffusion de son réseau et le nom de sa carte. */
export type AdressePrivee = { adresse: string; masque: string; diffusion: string; carte: string }

/** Ce que `os.networkInterfaces()` donne de chaque adresse (la famille est un nombre sur d'anciennes versions de Node). */
export type InfoAdresse = { address: string; netmask: string; family: string | number; internal: boolean }

/** Une adresse IPv4 écrite « a.b.c.d » en entier non signé de 32 bits, `null` si elle est mal écrite. */
export function lireIPv4(texte: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(texte)
  if (!m) return null
  const octets = m.slice(1).map(Number)
  if (octets.some((o) => o > 255)) return null
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

/** Un entier non signé de 32 bits écrit « a.b.c.d ». */
export function ecrireIPv4(n: number): string {
  return [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

/** Rang d'une adresse privée (RFC 1918) : 0 pour 192.168/16, 1 pour 10/8, 2 pour 172.16/12 ; `null` si elle n'est pas privée. */
function rangPrive(n: number): number | null {
  if (n >>> 16 === 0xc0a8) return 0
  if (n >>> 24 === 10) return 1
  if (n >>> 20 === 0xac1) return 2
  return null
}

/**
 * Vrai pour une adresse IPv4 privée (RFC 1918 : 10/8, 172.16/12, 192.168/16) : le serveur n'écoute que sur
 * celles-là. Ni lien local (169.254/16), ni partage d'opérateur (100.64/10), ni boucle locale.
 */
export function adressePrivee(adresse: string): boolean {
  const n = lireIPv4(adresse)
  return n !== null && rangPrive(n) !== null
}

/** Adresse de diffusion du réseau d'une adresse et de son masque, `null` si l'une est mal écrite. */
export function adresseDeDiffusion(adresse: string, masque: string): string | null {
  const a = lireIPv4(adresse)
  const m = lireIPv4(masque)
  if (a === null || m === null) return null
  return ecrireIPv4((a | ~m) >>> 0)
}

/** Vrai si deux adresses sont dans le même réseau pour ce masque. */
export function memeReseau(a: string, b: string, masque: string): boolean {
  const x = lireIPv4(a)
  const y = lireIPv4(b)
  const m = lireIPv4(masque)
  return x !== null && y !== null && m !== null && ((x & m) >>> 0) === ((y & m) >>> 0)
}

/** Cartes réseau d'une machine virtuelle ou d'un conteneur, d'après leur nom : rangées après les vraies. */
const CARTE_VIRTUELLE = /virtual|vmware|vethernet|hyper-v|wsl|docker|vbox/i

/**
 * Adresses IPv4 privées du PC, d'après `os.networkInterfaces()` : ni boucle locale, ni adresse publique, chacune une
 * fois. Ordre : les cartes qui ne semblent pas virtuelles d'abord, puis 192.168/16, 10/8, 172.16/12, puis par nom
 * de carte et par adresse. Le serveur écoute sur toutes ; l'ordre sert à choisir celle qu'on affiche.
 */
export function adressesPrivees(cartes: Record<string, readonly InfoAdresse[] | undefined>): AdressePrivee[] {
  const vues = new Map<string, AdressePrivee & { rang: number; virtuelle: boolean; valeur: number }>()
  for (const [carte, infos] of Object.entries(cartes)) {
    for (const info of infos ?? []) {
      if (info.internal || (info.family !== 'IPv4' && info.family !== 4)) continue
      const valeur = lireIPv4(info.address)
      const rang = valeur === null ? null : rangPrive(valeur)
      const diffusion = adresseDeDiffusion(info.address, info.netmask)
      if (valeur === null || rang === null || diffusion === null || vues.has(info.address)) continue
      vues.set(info.address, { adresse: info.address, masque: info.netmask, diffusion, carte, rang, virtuelle: CARTE_VIRTUELLE.test(carte), valeur })
    }
  }
  return [...vues.values()]
    .sort((a, b) => Number(a.virtuelle) - Number(b.virtuelle) || a.rang - b.rang || (a.carte < b.carte ? -1 : a.carte > b.carte ? 1 : 0) || a.valeur - b.valeur)
    .map(({ adresse, masque, diffusion, carte }) => ({ adresse, masque, diffusion, carte }))
}
