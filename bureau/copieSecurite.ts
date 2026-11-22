// Copie de sécurité faite avant la première synchronisation d'un téléphone : le dossier mémoire de l'ordinateur et
// ce que le téléphone liste de son dossier `Documents/Gtracker`, copiés côte à côte sous
// `<dossier des copies>\<AAAA-MM-JJ HH-MM-SS>\` (`ordinateur\` et `telephone\`). Rien n'est effacé ni écrasé :
// un dossier du même nom (deux copies dans la même seconde) en fait un autre, suivi de « (2) ». Une copie qui échoue
// en route garde ce qu'elle a déjà copié, sous un nom qui le dit (« incomplète »), et l'erreur remonte. Sans Electron.
//
// Le dossier des copies est `<Documents>\Gtracker-copies` tant que l'utilisateur n'en a pas choisi un autre ; son choix
// est retenu dans le profil du programme (`copies.json`), jamais dans la mémoire, et il ne vient que de la fenêtre de
// choix d'un dossier de Windows, ouverte par le processus principal : la page ne donne jamais de chemin à retenir. Un
// dossier dans la mémoire, ou qui la contient, est refusé au choix comme à la copie.

import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ErreurDisque, codeDe, estTemporaire, segmentAdmis } from './disque'
import type { Gestionnaire } from './pont'
import { enReponse } from './pont'
import type { DossierDistant } from './telephone'

/** Dossier des copies par défaut, sous Documents. */
export const DOSSIER_COPIES = 'Gtracker-copies'

/** Fichier du profil qui retient le dossier des copies choisi. */
export const FICHIER_COPIES = 'copies.json'

/** Sous-dossier de la copie du dossier mémoire de l'ordinateur. */
export const COPIE_ORDINATEUR = 'ordinateur'

/** Sous-dossier de la copie du dossier du téléphone. */
export const COPIE_TELEPHONE = 'telephone'

/** Longueur maximale d'un chemin retenu ou reçu de la page, en caractères. */
const CHEMIN_MAX = 1000

const deux = (n: number): string => String(n).padStart(2, '0')

/** Nom du dossier d'une copie : date et heure locales, « 2026-11-21 14-03-12 ». */
export function nomCopie(date: Date): string {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())} ${deux(date.getHours())}-${deux(date.getMinutes())}-${deux(date.getSeconds())}`
}

/**
 * Vrai si `dedans` est `dossier` ou l'un de ses sous-dossiers (casse ignorée, comme sur le disque de Windows). Un
 * sous-dossier dont le nom commence par deux points (`..x`) reste dedans ; seul `..` en tête de chemin en sort.
 */
function estSous(dedans: string, dossier: string): boolean {
  const relatif = path.relative(path.resolve(dossier).toLowerCase(), path.resolve(dedans).toLowerCase())
  if (relatif === '') return true
  const sort = relatif === '..' || relatif.startsWith(`..${path.sep}`) || relatif.startsWith('../')
  return !sort && !path.isAbsolute(relatif)
}

/** Vrai si l'un des deux dossiers est dans l'autre (ou si c'est le même). */
function seRecouvrent(a: string, b: string): boolean {
  return estSous(a, b) || estSous(b, a)
}

/** Crée un dossier neuf de ce nom, ou suivi de « (2) », « (3) »… s'il existe déjà ; rend son chemin. */
async function dossierNeuf(parent: string, nom: string): Promise<string> {
  await mkdir(parent, { recursive: true })
  for (let rang = 1; rang < 100; rang++) {
    const chemin = path.join(parent, rang === 1 ? nom : `${nom} (${rang})`)
    try {
      await mkdir(chemin)
      return chemin
    } catch (e) {
      if ((e as { code?: string }).code !== 'EEXIST') throw e
    }
  }
  throw new ErreurDisque('UNKNOWN', `Trop de copies de sécurité du même nom dans « ${parent} ».`)
}

/** Nombre de fichiers d'un dossier et de ses sous-dossiers, sans ce que la copie laisse (les provisoires). */
async function compterFichiers(dossier: string): Promise<number> {
  let nombre = 0
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (estTemporaire(entree.name)) continue
    nombre += entree.isDirectory() ? await compterFichiers(path.join(dossier, entree.name)) : 1
  }
  return nombre
}

/** Avancement d'une copie : fichiers copiés sur le total (mémoire de l'ordinateur et téléphone réunis). */
export type AvancementCopie = { fait: number; total: number }

export type OptionsCopie = {
  /** Dossier mémoire de l'ordinateur, chemin absolu. */
  memoire: string
  /** Le téléphone, lu par son canal. */
  telephone: DossierDistant
  /** Dossier qui reçoit les copies. */
  copies: string
  /**
   * Appelé au départ (0 fait), après la mémoire de l'ordinateur, copiée d'un bloc, puis après chaque fichier du
   * téléphone ; une erreur du rappel n'arrête pas la copie.
   */
  avancement?: (avis: AvancementCopie) => void
  maintenant?: Date
}

/** Fait la copie de sécurité des deux dossiers et rend le chemin de son dossier ; lève si elle n'a pas pu être faite en entier. */
export async function copieSecurite({ memoire, telephone, copies, avancement, maintenant = new Date() }: OptionsCopie): Promise<string> {
  if (seRecouvrent(copies, memoire)) {
    throw new ErreurDisque('UNKNOWN', 'Les copies de sécurité seraient rangées dans la mémoire : refusé.')
  }
  await stat(memoire)
  const dossier = await dossierNeuf(copies, nomCopie(maintenant))
  try {
    const fichiers = (await telephone.lister()).filter((fichier) => fichier.chemin.split('/').every(segmentAdmis))
    const enMemoire = avancement ? await compterFichiers(memoire) : 0
    const total = enMemoire + fichiers.length
    const signaler = (fait: number): void => {
      try {
        avancement?.({ fait, total })
      } catch {
        // L'avancement n'est qu'un affichage : la copie continue.
      }
    }
    signaler(0)
    await cp(memoire, path.join(dossier, COPIE_ORDINATEUR), {
      recursive: true,
      preserveTimestamps: true,
      errorOnExist: true,
      force: false,
      filter: (source) => !estTemporaire(path.basename(source)),
    })
    let fait = enMemoire
    signaler(fait)
    for (const fichier of fichiers) {
      const local = path.join(dossier, COPIE_TELEPHONE, ...fichier.chemin.split('/'))
      await mkdir(path.dirname(local), { recursive: true })
      await telephone.lire(fichier, local)
      const taille = (await stat(local)).size
      if (taille !== fichier.taille) {
        throw new ErreurDisque('UNKNOWN', `Copie incomplète de « ${fichier.chemin} » : ${taille} octets reçus sur ${fichier.taille}.`)
      }
      signaler(++fait)
    }
    await mkdir(path.join(dossier, COPIE_TELEPHONE), { recursive: true })
    return dossier
  } catch (e) {
    await rename(dossier, `${dossier} incomplète`).catch(() => undefined)
    if (e instanceof ErreurDisque) throw e
    throw new ErreurDisque(codeDe(e), `Copie de sécurité impossible : ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ---------- le dossier des copies, retenu dans le profil ----------

/**
 * Issue d'un choix du dossier des copies : retenu (`choisi`), fenêtre fermée sans choix (`annule`), ou refusé parce
 * qu'il est dans la mémoire ou la contient (`memoire`) ; `dossier` est le dossier des copies après le choix.
 */
export type ChoixCopies = { issue: 'choisi' | 'annule' | 'memoire'; dossier: string }

export type ReglageCopies = {
  /** Le dossier des copies : celui retenu, sinon celui par défaut. */
  dossier(): Promise<string>
  /** Retient `chemin` (absolu) s'il n'est ni dans la mémoire retenue ni ne la contient. */
  retenir(chemin: string): Promise<ChoixCopies>
  /**
   * Vrai si `chemin` est un dossier existant sous l'un des dossiers des copies de ce lancement (celui par défaut,
   * ceux lus ou retenus depuis), ou l'un d'eux.
   */
  ouvrable(chemin: unknown): Promise<boolean>
}

/** Chemin lu dans `copies.json`, `null` s'il manque ou ne convient pas. */
function cheminRetenu(texte: string): string | null {
  try {
    const lu = (JSON.parse(texte) as { dossier?: unknown }).dossier
    return typeof lu === 'string' && lu.length <= CHEMIN_MAX && path.isAbsolute(lu) ? path.resolve(lu) : null
  } catch {
    return null
  }
}

/**
 * Le dossier des copies de ce programme : `copies.json` du profil, sinon `defaut`. `memoire` rend le dossier mémoire
 * retenu (`null` s'il n'y en a pas), qu'un dossier choisi ne doit pas recouvrir.
 */
export function reglageCopies({ profil, defaut, memoire }: { profil: string; defaut: string; memoire?: () => Promise<string | null> }): ReglageCopies {
  const fichier = path.join(profil, FICHIER_COPIES)
  const connus = new Set<string>([path.resolve(defaut)])

  async function dossier(): Promise<string> {
    let retenu: string | null = null
    try {
      retenu = cheminRetenu(await readFile(fichier, 'utf8'))
    } catch {
      // Rien de retenu : le dossier par défaut.
    }
    const choisi = retenu ?? path.resolve(defaut)
    connus.add(choisi)
    return choisi
  }

  return {
    dossier,

    async retenir(chemin) {
      const absolu = path.resolve(chemin)
      const enMemoire = memoire ? await memoire() : null
      if (enMemoire !== null && seRecouvrent(absolu, enMemoire)) return { issue: 'memoire', dossier: await dossier() }
      await mkdir(profil, { recursive: true })
      const provisoire = `${fichier}.gtracker-tmp`
      await writeFile(provisoire, JSON.stringify({ dossier: absolu }), 'utf8')
      await rename(provisoire, fichier)
      connus.add(absolu)
      return { issue: 'choisi', dossier: absolu }
    },

    async ouvrable(chemin) {
      if (typeof chemin !== 'string' || chemin.length > CHEMIN_MAX || !path.isAbsolute(chemin)) return false
      await dossier()
      if (![...connus].some((connu) => estSous(chemin, connu))) return false
      try {
        return (await stat(chemin)).isDirectory()
      } catch {
        return false
      }
    },
  }
}

// ---------- les canaux de la page ----------

/** Canaux du dossier des copies, sous le préfixe `telephone:` ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_COPIES = ['dossierCopies', 'choisirDossierCopies', 'ouvrirCopie'] as const

/** Canal de l'avis d'avancement d'une copie de sécurité, de la coquille vers la page : `{ fait, total }`. */
export const AVIS_COPIE = 'telephone:avancementCopie'

/** Titre de la fenêtre de choix quand la page n'en passe pas. */
export const TITRE_CHOIX_COPIES = 'Dossier des copies de sécurité'

export type OptionsGestionnairesCopies = {
  reglage: ReglageCopies
  /** Fenêtre de choix d'un dossier de Windows ; `null` si l'utilisateur renonce. */
  choisirDossier: (demande: { titre: string; depart: string }) => Promise<string | null>
  /** Ouvre un dossier dans l'explorateur de Windows ; lève avec la phrase de Windows s'il ne s'ouvre pas. */
  ouvrirDossier: (chemin: string) => Promise<void>
}

/** Champs d'un message reçu de la page, `{}` s'il n'est pas un objet. */
function champs(argument: unknown): Record<string, unknown> {
  return typeof argument === 'object' && argument !== null && !Array.isArray(argument) ? (argument as Record<string, unknown>) : {}
}

/**
 * Gestionnaires des canaux du dossier des copies, à brancher par `brancherCanaux` :
 * - `telephone:dossierCopies()` rend le chemin du dossier des copies ;
 * - `telephone:choisirDossierCopies({ titre? })` ouvre la fenêtre de choix d'un dossier, partie du dossier actuel, et
 *   rend un `ChoixCopies` ;
 * - `telephone:ouvrirCopie({ chemin })` ouvre dans l'explorateur un dossier des copies ou une copie (`ouvrable`) ;
 *   tout autre chemin est refusé (`PERMISSION`).
 */
export function gestionnairesCopies({ reglage, choisirDossier, ouvrirDossier }: OptionsGestionnairesCopies): Record<string, Gestionnaire> {
  return {
    'telephone:dossierCopies': () => enReponse(() => reglage.dossier()),

    'telephone:choisirDossierCopies': (argument) =>
      enReponse(async (): Promise<ChoixCopies> => {
        const titre = champs(argument).titre
        const actuel = await reglage.dossier()
        const choisi = await choisirDossier({
          titre: typeof titre === 'string' && titre.trim() !== '' ? titre.slice(0, 200) : TITRE_CHOIX_COPIES,
          depart: actuel,
        })
        return choisi === null ? { issue: 'annule', dossier: actuel } : reglage.retenir(choisi)
      }),

    'telephone:ouvrirCopie': (argument) =>
      enReponse(async (): Promise<null> => {
        const chemin = champs(argument).chemin
        if (!(await reglage.ouvrable(chemin))) {
          throw new ErreurDisque('PERMISSION', "Seuls le dossier des copies de sécurité et ses copies s'ouvrent ici.")
        }
        await ouvrirDossier(path.resolve(chemin as string))
        return null
      }),
  }
}

// ---------- mode d'essai ----------

/**
 * Le choix du dossier des copies : hors du mode d'essai (`GTRACKER_BANC=1`), `choisirParFenetre` ; en mode d'essai,
 * jamais de fenêtre : la réponse est `GTRACKER_BANC_COPIES` (renoncé s'il est vide) ; le journal dit seulement s'il y
 * en a une, jamais le chemin.
 */
export function choixCopiesDepuisEnvironnement(
  env: Record<string, string | undefined>,
  choisirParFenetre: OptionsGestionnairesCopies['choisirDossier'],
  journal: (message: string) => void = () => undefined,
): OptionsGestionnairesCopies['choisirDossier'] {
  if (env.GTRACKER_BANC !== '1') return choisirParFenetre
  return async () => {
    const reponse = env.GTRACKER_BANC_COPIES?.trim() ? path.resolve(env.GTRACKER_BANC_COPIES) : null
    journal(`choix du dossier des copies : ${reponse ? 'un dossier' : 'renoncé'}`)
    return reponse
  }
}
