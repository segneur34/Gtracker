// Le « dossier distant » : le dossier `Documents/Gtracker` d'un téléphone, vu du processus principal, en lecture
// seule. Une interface commune à tous les canaux (le débogage USB dans `adb.ts`, d'autres viendront), sa mise en œuvre
// « dossier local » pour les tests et le banc, et les gestionnaires des canaux `telephone:*` du pont. Sans Electron.
//
// Lecture seule : l'interface n'a rien pour écrire, renommer ni retirer sur le téléphone. Seul le dossier temporaire
// des lectures, côté PC, reçoit des fichiers, et il les perd aussitôt lus.
//
// Sécurité :
// - la page ne désigne un fichier que par un chemin rendu par le dernier listage : `lireOctets` refuse tout autre
//   chemin, si bien qu'elle ne peut pas atteindre un fichier quelconque du téléphone ;
// - les chemins sont relatifs à `Documents/Gtracker`, séparés par `/`, sans `.` ni `..`, et se limitent aux fichiers de
//   la racine et de `sessions/` (`cheminAdmis`) ;
// - une lecture dont la taille diffère de celle du listage échoue, et son fichier temporaire est effacé ;
// - le dossier temporaire n'est jamais dans la mémoire du programme (vérifié à chaque listage).
//
// Mode d'essai (`GTRACKER_BANC=1`) seulement, `essaiTelephoneDepuisEnvironnement` lit :
//   GTRACKER_BANC_TELEPHONE          dossier local qui joue la mémoire partagée du téléphone (son `/sdcard`) ;
//                                    son sous-dossier `Documents/Gtracker` est celui qui est lu
//   GTRACKER_BANC_TELEPHONE_ETAT     état imposé : pret, absent, autorisation, horsLigne, adbIntrouvable ou occupe
//   GTRACKER_BANC_TELEPHONE_COUPURE  téléphone débranché après ce nombre de lectures réussies

import { copyFile, mkdir, readFile, readdir, stat, unlink, utimes } from 'node:fs/promises'
import path from 'node:path'
import { ErreurDisque, SUFFIXE_REMPLACEMENT, avecEssais, codeDe, segmentAdmis } from './disque'
import type { Gestionnaire } from './pont'
import { enReponse } from './pont'

/** État du téléphone, tel que la page le lit. */
export type EtatTelephone =
  /** Un téléphone prêt à être lu ; `nom` est son modèle, pour le message. */
  | { etat: 'pret'; nom: string }
  /** Rien de branché, ou rien de vu. */
  | { etat: 'absent' }
  /** Le téléphone attend que l'utilisateur accepte cet ordinateur. */
  | { etat: 'autorisation' }
  /** Le téléphone est vu mais ne répond pas. */
  | { etat: 'horsLigne' }
  /** L'outil du débogage USB n'est pas sur le poste ; `dossier` est l'endroit où le poser. */
  | { etat: 'adbIntrouvable'; dossier: string }
  /** Un autre programme tient la liaison avec le téléphone : on n'y touche pas. */
  | { etat: 'occupe' }

/** Valeurs de `etat`, dans l'ordre du type. */
export const ETATS_TELEPHONE = ['pret', 'absent', 'autorisation', 'horsLigne', 'adbIntrouvable', 'occupe'] as const satisfies readonly EtatTelephone['etat'][]

/** Un fichier du téléphone : chemin relatif à `Documents/Gtracker`, taille en octets, date de modification à la seconde. */
export type FichierTelephone = { chemin: string; taille: number; dateMs: number }

/** Le dossier `Documents/Gtracker` d'un téléphone, en lecture seule. */
export interface DossierDistant {
  /** État du téléphone ; lève seulement sur une panne imprévue de l'outil. */
  etat(): Promise<EtatTelephone>
  /**
   * Fichiers de la racine et de `sessions/`, triés par chemin. `NOT_FOUND` si le dossier n'existe pas sur le
   * téléphone ; une erreur si le téléphone n'est pas prêt.
   */
  lister(): Promise<FichierTelephone[]>
  /**
   * Copie un fichier rendu par `lister` vers `fichierLocal` (chemin absolu sur le PC), en gardant sa date de
   * modification. Le fichier entier est passé, pour que le canal règle son délai sur la taille.
   */
  lire(fichier: FichierTelephone, fichierLocal: string): Promise<void>
}

/** Sous-dossier du dossier du téléphone dont les fichiers sont listés, en plus de ceux de la racine. */
export const DOSSIER_SESSIONS = 'sessions'

/**
 * Vrai pour un chemin relatif listable : un fichier de la racine ou de `sessions/`, chaque segment admis sur le disque
 * du PC (`segmentAdmis` : ni vide, ni `.` ou `..`, ni caractère interdit par Windows), puisque c'est là qu'il sera rangé.
 */
export function cheminAdmis(chemin: string): boolean {
  const segments = chemin.split('/')
  if (segments.length === 2 && segments[0] !== DOSSIER_SESSIONS) return false
  if (segments.length !== 1 && segments.length !== 2) return false
  return segments.every(segmentAdmis)
}

/** Fichiers admis, triés par chemin ; un chemin vu deux fois (nom coupé par un retour à la ligne) est écarté. */
export function fichiersAdmis(fichiers: FichierTelephone[]): FichierTelephone[] {
  const vus = new Map<string, number>()
  for (const f of fichiers) vus.set(f.chemin, (vus.get(f.chemin) ?? 0) + 1)
  return fichiers
    .filter((f) => cheminAdmis(f.chemin) && vus.get(f.chemin) === 1 && Number.isSafeInteger(f.taille) && f.taille >= 0 && Number.isFinite(f.dateMs))
    .sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))
}

/** Erreur rendue quand le téléphone n'est pas prêt pour un listage ou une lecture. */
export function pasPret(etat: EtatTelephone['etat']): ErreurDisque {
  return new ErreurDisque('UNKNOWN', `Le téléphone n'est pas prêt (${etat}).`)
}

// ---------- le dossier local, pour les tests et le banc ----------

/** Nom du téléphone d'essai. */
export const NOM_TELEPHONE_ESSAI = "Téléphone d'essai"

export type OptionsDossierLocal = {
  /** État imposé, à la place de celui que donne le dossier. */
  etatImpose?: EtatTelephone | null
  /** Téléphone débranché après ce nombre de lectures réussies. */
  coupureApres?: number | null
}

/**
 * Un dossier local qui joue la mémoire partagée du téléphone (`stockage`, son `/sdcard`) : le dossier lu est
 * `stockage/Documents/Gtracker`. Il n'est jamais modifié. Stockage absent : téléphone absent.
 */
export function dossierLocal(stockage: string | null, options: OptionsDossierLocal = {}): DossierDistant {
  const racine = stockage === null ? null : path.join(path.resolve(stockage), 'Documents', 'Gtracker')
  const coupure = options.coupureApres ?? null
  let lectures = 0
  let debranche = false

  async function etat(): Promise<EtatTelephone> {
    if (debranche) return { etat: 'absent' }
    if (options.etatImpose) return options.etatImpose
    if (stockage === null) return { etat: 'absent' }
    try {
      return (await stat(stockage)).isDirectory() ? { etat: 'pret', nom: NOM_TELEPHONE_ESSAI } : { etat: 'absent' }
    } catch {
      return { etat: 'absent' }
    }
  }

  async function exigerPret(): Promise<string> {
    const e = await etat()
    if (e.etat !== 'pret' || racine === null) throw pasPret(e.etat)
    return racine
  }

  /** Fichiers d'un dossier du téléphone d'essai, à la seconde près comme ceux du débogage USB. */
  async function fichiersDe(dossier: string, prefixe: string): Promise<FichierTelephone[]> {
    const fichiers: FichierTelephone[] = []
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      if (!entree.isFile()) continue
      const s = await stat(path.join(dossier, entree.name))
      fichiers.push({ chemin: prefixe + entree.name, taille: s.size, dateMs: Math.floor(s.mtimeMs / 1000) * 1000 })
    }
    return fichiers
  }

  return {
    etat,

    async lister() {
      const r = await exigerPret()
      let fichiers: FichierTelephone[]
      try {
        if (!(await stat(r)).isDirectory()) throw new ErreurDisque('NOT_FOUND', 'Le dossier Documents/Gtracker est absent du téléphone.')
        fichiers = await fichiersDe(r, '')
      } catch (e) {
        if (codeDe(e) === 'NOT_FOUND') throw new ErreurDisque('NOT_FOUND', 'Le dossier Documents/Gtracker est absent du téléphone.')
        throw e
      }
      try {
        fichiers.push(...(await fichiersDe(path.join(r, DOSSIER_SESSIONS), `${DOSSIER_SESSIONS}/`)))
      } catch (e) {
        if (codeDe(e) !== 'NOT_FOUND') throw e
      }
      return fichiersAdmis(fichiers)
    },

    async lire(fichier, fichierLocal) {
      const r = await exigerPret()
      if (coupure !== null && lectures >= coupure) {
        debranche = true
        throw new ErreurDisque('UNKNOWN', 'Le téléphone a été débranché pendant la lecture.')
      }
      if (!cheminAdmis(fichier.chemin)) throw new ErreurDisque('UNKNOWN', 'Chemin refusé.')
      const source = path.join(r, ...fichier.chemin.split('/'))
      await copyFile(source, fichierLocal)
      const date = new Date(fichier.dateMs)
      await utimes(fichierLocal, date, date)
      lectures++
    },
  }
}

// ---------- les canaux de la page ----------

/** Canaux servis ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_TELEPHONE = ['etat', 'lister', 'lireOctets'] as const

/** Nom du dossier temporaire des lectures, dans le profil du programme. */
export const DOSSIER_LECTURES = 'telephone-lecture'

/** Efface un fichier, repris si un autre programme le tient un instant ; sans effet s'il n'existe pas. */
async function effacer(absolu: string): Promise<void> {
  try {
    await avecEssais(async () => {
      try {
        await unlink(absolu)
      } catch (e) {
        if (codeDe(e) !== 'NOT_FOUND') throw e
      }
    })
  } catch {
    // Laissé tel quel : le prochain listage ou le prochain démarrage videra le dossier.
  }
}

/**
 * Vide le dossier temporaire des lectures : seuls les fichiers qu'il a reçus (suffixe `.gtracker-tmp`) sont effacés,
 * rien d'autre, même si le dossier venait à en porter. Sans effet s'il n'existe pas.
 */
export async function viderLectures(dossierTemp: string): Promise<void> {
  let noms: string[]
  try {
    noms = await readdir(dossierTemp)
  } catch {
    return
  }
  for (const nom of noms) if (nom.toLowerCase().endsWith(SUFFIXE_REMPLACEMENT)) await effacer(path.join(dossierTemp, nom))
}

/** Vrai si `dedans` est `dossier` ou l'un de ses sous-dossiers (casse ignorée, comme sur le disque de Windows). */
function estSous(dedans: string, dossier: string): boolean {
  const relatif = path.relative(path.resolve(dossier).toLowerCase(), path.resolve(dedans).toLowerCase())
  return relatif === '' || (!relatif.startsWith('..') && !path.isAbsolute(relatif))
}

export type OptionsGestionnaires = {
  /** Dossier mémoire retenu, `null` s'il n'y en a pas : le dossier temporaire ne doit jamais s'y trouver. */
  memoire?: () => Promise<string | null>
}

/** Une action à la fois, dans l'ordre des appels : le téléphone ne reçoit jamais deux commandes ensemble. */
function enSerie(): <T>(action: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve()
  return <T>(action: () => Promise<T>) => {
    const suite = queue.then(action, action)
    queue = suite.catch(() => undefined)
    return suite
  }
}

/**
 * Gestionnaires des canaux `telephone:*`, à brancher par `brancherCanaux` :
 * - `telephone:etat` rend un `EtatTelephone` ;
 * - `telephone:lister` rend les `FichierTelephone` (`NOT_FOUND` si `Documents/Gtracker` est absent), et vide le
 *   dossier temporaire ;
 * - `telephone:lireOctets({ chemin })` rend les octets d'un fichier du dernier listage ; le fichier temporaire est
 *   effacé, réussite ou échec.
 */
export function gestionnairesTelephone(dossier: DossierDistant, dossierTemp: string, options: OptionsGestionnaires = {}): Record<string, Gestionnaire> {
  const serie = enSerie()
  /** Fichiers du dernier listage réussi, par chemin ; vide après un listage en échec. */
  let dernier = new Map<string, FichierTelephone>()
  let numero = 0

  return {
    'telephone:etat': () => enReponse(() => serie(() => dossier.etat())),

    'telephone:lister': () =>
      enReponse(() =>
        serie(async () => {
          dernier = new Map()
          const memoire = options.memoire ? await options.memoire() : null
          if (memoire !== null && (estSous(dossierTemp, memoire) || estSous(memoire, dossierTemp))) {
            throw new ErreurDisque('UNKNOWN', 'Le dossier temporaire des lectures du téléphone est dans la mémoire : lecture refusée.')
          }
          await viderLectures(dossierTemp)
          const fichiers = await dossier.lister()
          dernier = new Map(fichiers.map((f) => [f.chemin, f]))
          return fichiers
        }),
      ),

    'telephone:lireOctets': (argument) =>
      enReponse(() =>
        serie(async (): Promise<Uint8Array> => {
          const chemin = typeof argument === 'object' && argument !== null && !Array.isArray(argument) ? (argument as Record<string, unknown>).chemin : undefined
          if (typeof chemin !== 'string') throw new ErreurDisque('UNKNOWN', 'Message mal formé : « chemin » doit être un texte.')
          const fichier = dernier.get(chemin)
          if (!fichier) throw new ErreurDisque('UNKNOWN', `Fichier absent du dernier listage du téléphone : « ${chemin.slice(0, 200)} ».`)
          await mkdir(dossierTemp, { recursive: true })
          const local = path.join(dossierTemp, `${++numero}${SUFFIXE_REMPLACEMENT}`)
          try {
            await dossier.lire(fichier, local)
            const taille = (await stat(local)).size
            if (taille !== fichier.taille) {
              throw new ErreurDisque('UNKNOWN', `Lecture incomplète de « ${chemin} » : ${taille} octets reçus sur ${fichier.taille}.`)
            }
            return await readFile(local)
          } finally {
            await effacer(local)
          }
        }),
      ),
  }
}

// ---------- mode d'essai ----------

export type EssaiTelephone = {
  /** Dossier qui joue la mémoire partagée du téléphone ; `null` : téléphone absent. */
  stockage: string | null
  etatImpose: EtatTelephone | null
  coupureApres: number | null
}

/**
 * Réglages du téléphone d'essai d'après l'environnement, `null` hors du mode d'essai (`GTRACKER_BANC=1`), où les
 * variables ne sont pas lues et le vrai canal sert. En mode d'essai, jamais le vrai téléphone : sans dossier, il est
 * absent. `dossierAdb` est l'endroit donné par l'état `adbIntrouvable` imposé.
 */
export function essaiTelephoneDepuisEnvironnement(
  env: Record<string, string | undefined>,
  dossierAdb: string,
  journal: (message: string) => void = () => undefined,
): EssaiTelephone | null {
  if (env.GTRACKER_BANC !== '1') return null
  const stockage = env.GTRACKER_BANC_TELEPHONE?.trim() ? path.resolve(env.GTRACKER_BANC_TELEPHONE) : null
  const nom = env.GTRACKER_BANC_TELEPHONE_ETAT?.trim() ?? ''
  let etatImpose: EtatTelephone | null = null
  if (nom === 'pret') etatImpose = { etat: 'pret', nom: NOM_TELEPHONE_ESSAI }
  else if (nom === 'adbIntrouvable') etatImpose = { etat: 'adbIntrouvable', dossier: dossierAdb }
  else if (nom === 'absent' || nom === 'autorisation' || nom === 'horsLigne' || nom === 'occupe') etatImpose = { etat: nom }
  else if (nom !== '') journal(`état du téléphone d'essai inconnu, ignoré : ${nom}`)
  const brut = env.GTRACKER_BANC_TELEPHONE_COUPURE?.trim() ?? ''
  const coupureApres = /^\d+$/.test(brut) ? Number(brut) : null
  if (brut !== '' && coupureApres === null) journal(`coupure du téléphone d'essai illisible, ignorée : ${brut}`)
  journal(`téléphone d'essai : ${stockage ?? 'aucun'}${etatImpose ? `, état ${etatImpose.etat}` : ''}${coupureApres !== null ? `, coupure après ${coupureApres}` : ''}`)
  return { stockage, etatImpose, coupureApres }
}
