// Copie de sécurité faite avant la première synchronisation d'un téléphone : le dossier mémoire de l'ordinateur et
// ce que le téléphone liste de son dossier `Documents/Gtracker`, copiés côte à côte sous
// `<Documents>\Gtracker-copies\<AAAA-MM-JJ HH-MM-SS>\` (`ordinateur\` et `telephone\`). Rien n'est effacé ni écrasé :
// un dossier du même nom (deux copies dans la même seconde) en fait un autre, suivi de « (2) ». Une copie qui échoue
// en route garde ce qu'elle a déjà copié, sous un nom qui le dit (« incomplète »), et l'erreur remonte. Sans Electron.

import { cp, mkdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import { ErreurDisque, codeDe, estTemporaire, segmentAdmis } from './disque'
import type { DossierDistant } from './telephone'

/** Dossier des copies, sous Documents. */
export const DOSSIER_COPIES = 'Gtracker-copies'

/** Sous-dossier de la copie du dossier mémoire de l'ordinateur. */
export const COPIE_ORDINATEUR = 'ordinateur'

/** Sous-dossier de la copie du dossier du téléphone. */
export const COPIE_TELEPHONE = 'telephone'

const deux = (n: number): string => String(n).padStart(2, '0')

/** Nom du dossier d'une copie : date et heure locales, « 2026-11-21 14-03-12 ». */
export function nomCopie(date: Date): string {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())} ${deux(date.getHours())}-${deux(date.getMinutes())}-${deux(date.getSeconds())}`
}

/** Vrai si `dedans` est `dossier` ou l'un de ses sous-dossiers (casse ignorée, comme sur le disque de Windows). */
function estSous(dedans: string, dossier: string): boolean {
  const relatif = path.relative(path.resolve(dossier).toLowerCase(), path.resolve(dedans).toLowerCase())
  return relatif === '' || (!relatif.startsWith('..') && !path.isAbsolute(relatif))
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

export type OptionsCopie = {
  /** Dossier mémoire de l'ordinateur, chemin absolu. */
  memoire: string
  /** Le téléphone, lu par son canal. */
  telephone: DossierDistant
  /** Dossier qui reçoit les copies (`<Documents>\Gtracker-copies`). */
  copies: string
  maintenant?: Date
}

/** Fait la copie de sécurité des deux dossiers et rend le chemin de son dossier ; lève si elle n'a pas pu être faite en entier. */
export async function copieSecurite({ memoire, telephone, copies, maintenant = new Date() }: OptionsCopie): Promise<string> {
  if (estSous(copies, memoire) || estSous(memoire, copies)) {
    throw new ErreurDisque('UNKNOWN', 'Les copies de sécurité seraient rangées dans la mémoire : refusé.')
  }
  await stat(memoire)
  const dossier = await dossierNeuf(copies, nomCopie(maintenant))
  try {
    await cp(memoire, path.join(dossier, COPIE_ORDINATEUR), {
      recursive: true,
      preserveTimestamps: true,
      errorOnExist: true,
      force: false,
      filter: (source) => !estTemporaire(path.basename(source)),
    })
    const fichiers = await telephone.lister()
    for (const fichier of fichiers) {
      const segments = fichier.chemin.split('/')
      if (!segments.every(segmentAdmis)) continue
      const local = path.join(dossier, COPIE_TELEPHONE, ...segments)
      await mkdir(path.dirname(local), { recursive: true })
      await telephone.lire(fichier, local)
      const taille = (await stat(local)).size
      if (taille !== fichier.taille) {
        throw new ErreurDisque('UNKNOWN', `Copie incomplète de « ${fichier.chemin} » : ${taille} octets reçus sur ${fichier.taille}.`)
      }
    }
    await mkdir(path.join(dossier, COPIE_TELEPHONE), { recursive: true })
    return dossier
  } catch (e) {
    await rename(dossier, `${dossier} incomplète`).catch(() => undefined)
    if (e instanceof ErreurDisque) throw e
    throw new ErreurDisque(codeDe(e), `Copie de sécurité impossible : ${e instanceof Error ? e.message : String(e)}`)
  }
}
