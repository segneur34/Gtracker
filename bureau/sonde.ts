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
// ---------- Question (téléphone vers PC), 22 octets exactement ----------
//
//   octets 0 à 3     « GTRK » en ASCII : 0x47 0x54 0x52 0x4B
//   octet 4          version du format : 1
//   octet 5          sorte de paquet : 0x01 (question)
//   octets 6 à 21    nonce de la question, 16 octets tirés au hasard
//
// ---------- Réponse (PC vers téléphone), 41 + L octets exactement ----------
//
//   octets 0 à 3     « GTRK »
//   octet 4          version du format : 1
//   octet 5          sorte de paquet : 0x02 (réponse)
//   octets 6 à 21    nonce de la question, recopié
//   octets 22 et 23  port TCP du serveur TLS du PC, entier non signé sur 16 bits, gros-boutiste, de 1 à 65 535
//   octets 24 à 39   identifiant du PC, 16 octets (celui que le téléphone reçoit à l'appairage)
//   octet 40         L, longueur du nom du PC en octets, de 0 à 64
//   L octets         nom du PC en UTF-8 valide, sans caractère de contrôle
//
// Tout autre paquet (autre signature, autre version, autre sorte, autre longueur, port nul, nom illisible) est
// étranger et ignoré sans réponse.

import { nomAdmis } from './trames'

/** Port UDP où le PC attend les questions. */
export const PORT_SONDE = 48218

/** Signature qui ouvre chaque paquet. */
export const SIGNATURE_SONDE = Uint8Array.from([0x47, 0x54, 0x52, 0x4b])

export const VERSION_SONDE = 1
export const SORTE_QUESTION = 0x01
export const SORTE_REPONSE = 0x02

/** Taille du nonce d'une question et de l'identifiant du PC, en octets. */
export const TAILLE_NONCE_SONDE = 16
export const TAILLE_IDENTIFIANT_PC = 16

/** Plus long nom du PC dans une réponse, en octets UTF-8. */
export const NOM_PC_MAX_OCTETS = 64

const TAILLE_QUESTION = 6 + TAILLE_NONCE_SONDE
const TAILLE_REPONSE_FIXE = 6 + TAILLE_NONCE_SONDE + 2 + TAILLE_IDENTIFIANT_PC + 1

/** Réponse du PC. */
export type ReponseSonde = { nonce: Uint8Array; port: number; identifiant: Uint8Array; nom: string }

function entete(sorte: number): Buffer {
  return Buffer.from([...SIGNATURE_SONDE, VERSION_SONDE, sorte])
}

function aEntete(paquet: Uint8Array, sorte: number): boolean {
  return SIGNATURE_SONDE.every((o, i) => paquet[i] === o) && paquet[4] === VERSION_SONDE && paquet[5] === sorte
}

function exigerTaille(octets: Uint8Array, taille: number, quoi: string): void {
  if (octets.length !== taille) throw new RangeError(`${quoi} : ${taille} octets attendus, ${octets.length} reçus.`)
}

/** Octets d'une question. */
export function encoderQuestion(nonce: Uint8Array): Uint8Array {
  exigerTaille(nonce, TAILLE_NONCE_SONDE, 'Nonce de la question')
  return Buffer.concat([entete(SORTE_QUESTION), nonce])
}

/** Le nonce d'une question, `null` pour un paquet étranger. */
export function decoderQuestion(paquet: Uint8Array): { nonce: Uint8Array } | null {
  if (paquet.length !== TAILLE_QUESTION || !aEntete(paquet, SORTE_QUESTION)) return null
  return { nonce: Uint8Array.from(paquet.subarray(6)) }
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

/** Octets d'une réponse. Le nom doit déjà tenir (`nomPcPourSonde`). */
export function encoderReponse(reponse: ReponseSonde): Uint8Array {
  exigerTaille(reponse.nonce, TAILLE_NONCE_SONDE, 'Nonce de la question')
  exigerTaille(reponse.identifiant, TAILLE_IDENTIFIANT_PC, 'Identifiant du PC')
  if (!Number.isInteger(reponse.port) || reponse.port < 1 || reponse.port > 65535) throw new RangeError(`Port hors bornes : ${reponse.port}.`)
  const nom = Buffer.from(reponse.nom, 'utf8')
  if (nom.length > NOM_PC_MAX_OCTETS || (nom.length > 0 && !nomAdmis(reponse.nom))) throw new RangeError('Nom du PC refusé dans une réponse.')
  const port = Buffer.alloc(2)
  port.writeUInt16BE(reponse.port, 0)
  return Buffer.concat([entete(SORTE_REPONSE), reponse.nonce, port, reponse.identifiant, Buffer.from([nom.length]), nom])
}

const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** La réponse d'un PC, `null` pour un paquet étranger. */
export function decoderReponse(paquet: Uint8Array): ReponseSonde | null {
  if (paquet.length < TAILLE_REPONSE_FIXE || !aEntete(paquet, SORTE_REPONSE)) return null
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
