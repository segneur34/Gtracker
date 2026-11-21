// L'application du téléphone que le programme embarque : l'APK de la même version, rangée dans ses ressources
// (`resources\Gtracker-<version>.apk`, posée par l'emballage de `outils/bureau.mjs`), que la page propose d'enregistrer
// sur le disque ou d'installer par le câble. Sans Electron : la fenêtre « Enregistrer sous » et le câble sont passés en
// paramètres.
//
// Canaux `application:*` du pont :
// - `application:etat()` rend `{ version, disponible, proposee }` : la version du programme, la présence de l'APK, et
//   si l'application a déjà été proposée pour cette version ;
// - `application:enregistrer({ titre })` ouvre la fenêtre « Enregistrer sous » (titre facultatif, passé par la page dans
//   sa langue), puis y copie l'APK ; rend le chemin du fichier écrit, `null` si l'utilisateur a renoncé ;
// - `application:installer()` installe l'APK par le câble, dans la file des autres commandes au téléphone, et rend un
//   `ResultatInstallation` (`telephone.ts`) ;
// - `application:marquerProposee()` retient que l'application a été proposée pour cette version.
//
// Le drapeau « déjà proposée » est tenu par version dans le profil de la coquille (`application-proposee.json`) : la
// proposition revient à chaque nouvelle version.
//
// Mode d'essai (`GTRACKER_BANC=1`) seulement, `essaiApplicationDepuisEnvironnement` lit :
//   GTRACKER_APK                     l'APK proposée au lieu de celle du programme (fichier absent : pas d'application)
//   GTRACKER_BANC_APK_DESTINATION    réponse de la fenêtre « Enregistrer sous », chemin du fichier à écrire (absente ou
//                                    vide : l'utilisateur renonce)
//   GTRACKER_BANC_APPLICATION_REFUS  refus imposé à l'installation par le téléphone d'essai : versionPlusRecente,
//                                    signature, usbCoupee, memoirePleine ou autre

import { copyFile, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { ErreurDisque, SUFFIXE_REMPLACEMENT, avecEssais, ecrireAtomique } from './disque'
import type { Gestionnaire } from './pont'
import { enReponse, uneALaFois } from './pont'
import type { DossierDistant, FileTelephone, RaisonRefus, ResultatInstallation } from './telephone'
import { RAISONS_REFUS } from './telephone'

/** Canaux servis ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_APPLICATION = ['etat', 'enregistrer', 'installer', 'marquerProposee'] as const

/** Fichier du profil qui retient la version pour laquelle l'application a été proposée. */
export const FICHIER_PROPOSEE = 'application-proposee.json'

/** Dossier où Gradle écrit l'APK de publication, depuis la racine du dépôt. */
export const DOSSIER_APK_GRADLE: readonly string[] = ['android', 'app', 'build', 'outputs', 'apk', 'release']

/** Titre de la fenêtre « Enregistrer sous » tant que la page n'en passe pas un dans sa langue. */
export const TITRE_ENREGISTRER = "Enregistrer l'application du téléphone"

/** Longueur maximale du titre passé par la page. */
const TITRE_MAX = 200

/** Nom de l'APK d'une version, tel que Gradle l'écrit et tel qu'il est rangé dans les ressources du programme. */
export function nomApk(version: string): string {
  return `Gtracker-${version}.apk`
}

/**
 * Chemin de l'APK du programme : celle du mode d'essai (`essai`) si elle est donnée, sinon celle des ressources une fois
 * emballé, sinon, lancé depuis le dépôt, celle que Gradle a écrite.
 */
export function cheminApk(o: { version: string; emballe: boolean; ressources: string; depot: string; essai?: string | null }): string {
  if (o.essai) return path.resolve(o.essai)
  if (o.emballe) return path.join(o.ressources, nomApk(o.version))
  return path.join(o.depot, ...DOSSIER_APK_GRADLE, nomApk(o.version))
}

/** Vrai si l'APK est là, en fichier. */
export async function apkDisponible(apk: string): Promise<boolean> {
  try {
    return (await stat(apk)).isFile()
  } catch {
    return false
  }
}

/** Vrai si l'application a déjà été proposée pour cette version ; un fichier absent ou illisible vaut « non ». */
export async function lireProposee(profil: string, version: string): Promise<boolean> {
  try {
    const lu = JSON.parse(await readFile(path.join(profil, FICHIER_PROPOSEE), 'utf8')) as { version?: unknown }
    return lu.version === version
  } catch {
    return false
  }
}

/** Retient que l'application a été proposée pour cette version (la précédente est oubliée). */
export async function marquerProposee(profil: string, version: string): Promise<void> {
  await mkdir(profil, { recursive: true })
  await ecrireAtomique(path.join(profil, FICHIER_PROPOSEE), new TextEncoder().encode(JSON.stringify({ version })))
}

/**
 * Copie l'APK vers `destination` (chemin absolu choisi par l'utilisateur) sans jamais y laisser un fichier à moitié
 * écrit : sous un nom provisoire, taille relue, puis renommé ; le provisoire est effacé si l'une des étapes échoue.
 */
export async function enregistrerApk(apk: string, destination: string): Promise<void> {
  const source = path.resolve(apk)
  const cible = path.resolve(destination)
  if (source.toLowerCase() === cible.toLowerCase()) throw new ErreurDisque('UNKNOWN', "L'APK serait copiée sur elle-même : refusé.")
  const taille = (await stat(source)).size
  const provisoire = cible + SUFFIXE_REMPLACEMENT
  try {
    await copyFile(source, provisoire)
    const ecrit = (await stat(provisoire)).size
    if (ecrit !== taille) throw new ErreurDisque('UNKNOWN', `Copie incomplète de l'APK : ${ecrit} octets sur ${taille}.`)
    await avecEssais(() => rename(provisoire, cible))
  } catch (e) {
    await unlink(provisoire).catch(() => undefined)
    throw e
  }
}

/** Titre passé par la page (`{ titre }`), s'il est un texte non vide et pas trop long ; celui par défaut sinon. */
function lireTitre(argument: unknown): string {
  const titre = typeof argument === 'object' && argument !== null ? (argument as Record<string, unknown>).titre : undefined
  return typeof titre === 'string' && titre.trim() !== '' && titre.length <= TITRE_MAX ? titre : TITRE_ENREGISTRER
}

const sansApk = () => new ErreurDisque('NOT_FOUND', "Ce programme n'a pas l'application du téléphone.")

export type OptionsApplication = {
  /** Version du programme, telle qu'elle s'affiche (`0.01.40`). */
  version: string
  /** Chemin absolu de l'APK (`cheminApk`), présente ou non. */
  apk: string
  /** Dossier du profil de la coquille. */
  profil: string
  /** Fenêtre « Enregistrer sous » : rend le chemin absolu choisi, `null` si l'utilisateur renonce. */
  choisirDestination: (demande: { titre: string; nom: string }) => Promise<string | null>
  /** Le téléphone par le câble (le débogage USB, ou le téléphone d'essai). */
  cable: DossierDistant
  /** File des commandes au téléphone, celle des canaux `telephone:*`. */
  serie: FileTelephone
  journal?: (message: string) => void
}

/** Gestionnaires des canaux `application:*`, à brancher par `brancherCanaux` (voir l'en-tête). */
export function gestionnairesApplication(options: OptionsApplication): Record<string, Gestionnaire> {
  const { version, apk, profil, cable, serie } = options
  const journal = options.journal ?? (() => undefined)

  // Une seule fenêtre et une seule copie à la fois : un second clic reçoit la réponse du premier.
  const enregistrer = uneALaFois(async (titre: string): Promise<string | null> => {
    if (!(await apkDisponible(apk))) throw sansApk()
    const destination = await options.choisirDestination({ titre, nom: nomApk(version) })
    if (destination === null || destination === '') return null
    if (!path.isAbsolute(destination)) throw new ErreurDisque('UNKNOWN', 'Destination de l’APK refusée : chemin relatif.')
    await enregistrerApk(apk, destination)
    journal(`APK enregistrée : ${path.resolve(destination)}`)
    return path.resolve(destination)
  })

  return {
    'application:etat': () =>
      enReponse(async () => ({ version, disponible: await apkDisponible(apk), proposee: await lireProposee(profil, version) })),

    'application:enregistrer': (argument) => enReponse(() => enregistrer(lireTitre(argument))),

    'application:installer': () =>
      enReponse(() =>
        serie(async (): Promise<ResultatInstallation> => {
          if (!(await apkDisponible(apk))) throw sansApk()
          if (!cable.installer) throw new ErreurDisque('UNKNOWN', 'Ce canal ne sait pas installer l’application sur le téléphone.')
          return cable.installer(apk)
        }),
      ),

    'application:marquerProposee': () =>
      enReponse(async (): Promise<null> => {
        await marquerProposee(profil, version)
        return null
      }),
  }
}

// ---------- mode d'essai ----------

export type EssaiApplication = {
  /** APK proposée à la place de celle du programme ; `null` : celle du programme. */
  apk: string | null
  /** Réponse de la fenêtre « Enregistrer sous ». */
  choisirDestination: OptionsApplication['choisirDestination']
  /** Refus imposé à l'installation par le téléphone d'essai ; `null` : installation copiée. */
  refus: RaisonRefus | null
}

/**
 * Réglages d'essai de l'application d'après l'environnement, `null` hors du mode d'essai (`GTRACKER_BANC=1`), où les
 * variables ne sont pas lues et la vraie fenêtre « Enregistrer sous » s'ouvre. En mode d'essai, jamais de fenêtre.
 */
export function essaiApplicationDepuisEnvironnement(
  env: Record<string, string | undefined>,
  journal: (message: string) => void = () => undefined,
): EssaiApplication | null {
  if (env.GTRACKER_BANC !== '1') return null
  const apk = env.GTRACKER_APK?.trim() ? path.resolve(env.GTRACKER_APK.trim()) : null
  const brut = env.GTRACKER_BANC_APPLICATION_REFUS?.trim() ?? ''
  const refus = (RAISONS_REFUS as readonly string[]).includes(brut) ? (brut as RaisonRefus) : null
  if (brut !== '' && refus === null) journal(`refus d'installation d'essai inconnu, ignoré : ${brut}`)
  return {
    apk,
    refus,
    choisirDestination: async ({ nom }) => {
      const reponse = env.GTRACKER_BANC_APK_DESTINATION?.trim() ? path.resolve(env.GTRACKER_BANC_APK_DESTINATION.trim()) : null
      journal(`enregistrement de ${nom} : ${reponse ?? 'renoncé'}`)
      return reponse
    },
  }
}
