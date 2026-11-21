// Le « dossier distant » : le dossier `Documents/Gtracker` d'un téléphone, vu du processus principal. Une interface
// commune à tous les canaux (le débogage USB dans `adb.ts`, le Wi-Fi dans `sansFil.ts`), sa mise en œuvre « dossier
// local » pour les tests et le banc, et les gestionnaires des canaux `telephone:*` du pont. Sans Electron.
//
// Lecture, et écriture pour les canaux qui la savent (le câble) : un fichier écrit l'est sous un nom provisoire, puis
// renommé, comme le fait l'application du téléphone (`nomProvisoire`) ; un fichier effacé l'est seul, jamais un
// dossier, un motif ou une liste.
//
// Sécurité :
// - la page ne lit un fichier que par un chemin rendu par le dernier listage : `lireOctets` refuse tout autre chemin,
//   si bien qu'elle ne peut pas atteindre un fichier quelconque du téléphone ;
// - elle n'écrit ou n'efface que dans la liste blanche (`cheminEcrivable`), vérifiée ici avant toute commande : les
//   fichiers posés directement dans `sessions/`, `itineraires/` et `reglages/`, et trois fichiers de la racine ;
//   elle n'efface qu'un fichier du dernier listage (ou écrit depuis) ;
// - les chemins sont relatifs à `Documents/Gtracker`, séparés par `/`, sans `.` ni `..` ;
// - une lecture dont la taille diffère de celle du listage échoue, et son fichier temporaire est effacé ;
// - le dossier temporaire n'est jamais dans la mémoire du programme (vérifié à chaque listage et à chaque écriture).
//
// Mode d'essai (`GTRACKER_BANC=1`) seulement, `essaiTelephoneDepuisEnvironnement` lit :
//   GTRACKER_BANC_TELEPHONE          dossier local qui joue la mémoire partagée du téléphone (son `/sdcard`) ;
//                                    son sous-dossier `Documents/Gtracker` est celui qui est lu et écrit
//   GTRACKER_BANC_TELEPHONE_ETAT     état imposé : pret, absent, autorisation, horsLigne, adbIntrouvable ou occupe
//   GTRACKER_BANC_TELEPHONE_COUPURE  téléphone débranché après ce nombre d'opérations réussies (lectures, écritures,
//                                    effacements) ; une écriture coupée laisse son fichier provisoire à moitié écrit

import { copyFile, mkdir, open, readFile, readdir, rename, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { copieSecurite } from './copieSecurite'
import { ErreurDisque, SUFFIXE_NEUF, SUFFIXE_REMPLACEMENT, avecEssais, codeDe, segmentAdmis } from './disque'
import { estOctets } from './memoire'
import type { Gestionnaire } from './pont'
import { enReponse } from './pont'

/** Canal par lequel un téléphone prêt est lu : le Wi-Fi (`sansFil.ts`) ou le câble. */
export type CanalTelephone = 'sansFil' | 'cable'

/** État du téléphone, tel que la page le lit. */
export type EtatTelephone =
  /**
   * Un téléphone prêt à être lu ; `nom` est son modèle, pour le message ; `canal`, quand plusieurs canaux servent ;
   * `ecriture`, quand on sait si ce canal écrit sur le téléphone.
   */
  | { etat: 'pret'; nom: string; canal?: CanalTelephone; ecriture?: boolean }
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

/** Le dossier `Documents/Gtracker` d'un téléphone. */
export interface DossierDistant {
  /** État du téléphone ; lève seulement sur une panne imprévue de l'outil. */
  etat(): Promise<EtatTelephone>
  /**
   * Fichiers de la racine et des sous-dossiers que le canal liste, triés par chemin, tels que l'application du
   * téléphone les voit. `NOT_FOUND` si le dossier n'existe pas sur le téléphone ; une erreur si le téléphone n'est pas
   * prêt.
   */
  lister(): Promise<FichierTelephone[]>
  /**
   * Copie un fichier rendu par `lister` vers `fichierLocal` (chemin absolu sur le PC), en gardant sa date de
   * modification. Le fichier entier est passé, pour que le canal règle son délai sur la taille.
   */
  lire(fichier: FichierTelephone, fichierLocal: string): Promise<void>
  /**
   * Écrit `fichierLocal` (chemin absolu sur le PC, de `taille` octets) sous `chemin`, admis par `cheminEcrivable` :
   * d'abord sous son nom provisoire (`nomProvisoire`), taille relue, puis renommé. En cas d'échec, le provisoire est
   * retiré et le fichier d'arrivée n'a pas été touché. Rend le fichier tel qu'il est sur le téléphone. Absent d'un
   * canal qui ne sait pas écrire.
   */
  ecrire?(chemin: string, fichierLocal: string, taille: number): Promise<FichierTelephone>
  /** Efface le seul fichier `chemin`, admis par `cheminEcrivable` ; sans effet s'il n'existe pas. Absent d'un canal qui ne sait pas écrire. */
  effacer?(chemin: string): Promise<void>
}

/** Sous-dossier des sessions, listé par tous les canaux. */
export const DOSSIER_SESSIONS = 'sessions'

/** Sous-dossier des itinéraires. */
export const DOSSIER_ITINERAIRES = 'itineraires'

/** Sous-dossier des réglages de chaque appareil. */
export const DOSSIER_REGLAGES = 'reglages'

/**
 * Vrai pour un chemin relatif que le sans-fil liste et lit (même règle que le greffon du téléphone) : un fichier de la
 * racine ou de `sessions/`, chaque segment admis sur le disque du PC (`segmentAdmis` : ni vide, ni `.` ou `..`, ni
 * caractère interdit par Windows, ni nom provisoire), puisque c'est là qu'il sera rangé.
 */
export function cheminAdmis(chemin: string): boolean {
  const segments = chemin.split('/')
  if (segments.length === 2 && segments[0] !== DOSSIER_SESSIONS) return false
  if (segments.length !== 1 && segments.length !== 2) return false
  return segments.every(segmentAdmis)
}

/** Sous-dossiers dont le câble liste les fichiers, en plus de la racine. */
export const DOSSIERS_DU_CABLE: readonly string[] = [DOSSIER_SESSIONS, DOSSIER_REGLAGES]

/** Vrai pour un chemin relatif que le câble liste et lit : ceux du sans-fil, plus les fichiers de `reglages/`. */
export function cheminDuCable(chemin: string): boolean {
  const segments = chemin.split('/')
  if (segments.length === 2 && !DOSSIERS_DU_CABLE.includes(segments[0])) return false
  if (segments.length !== 1 && segments.length !== 2) return false
  return segments.every(segmentAdmis)
}

// ---------- liste blanche des écritures ----------

/** Sous-dossiers où la page peut écrire et effacer des fichiers, posés directement dedans. */
export const DOSSIERS_ECRIVABLES: readonly string[] = [DOSSIER_SESSIONS, DOSSIER_ITINERAIRES, DOSSIER_REGLAGES]

/** Fichiers de la racine que la page peut écrire et effacer : le marqueur, les tests de FC repos, les lieux appris. */
export const FICHIERS_RACINE_ECRIVABLES: readonly string[] = ['gtracker.json', 'fc-repos.json', 'lieux.json']

/** Longueur au-delà de laquelle un chemin à écrire est refusé sans examen. */
const LONGUEUR_ECRITURE_MAX = 512

/**
 * Seule liste blanche des écritures et effacements sur le téléphone, appliquée dans la coquille avant toute commande :
 * un fichier posé directement dans `sessions/`, `itineraires/` ou `reglages/` (nom admis par `segmentAdmis` : ni
 * vide, ni `.` ou `..`, ni caractère de contrôle ou interdit par Windows, ni nom provisoire), ou l'un des fichiers de
 * `FICHIERS_RACINE_ECRIVABLES`. Tout le reste est refusé : chemin absolu, sous-dossier, autre dossier, barre finale.
 */
export function cheminEcrivable(chemin: unknown): chemin is string {
  if (typeof chemin !== 'string' || chemin.length === 0 || chemin.length > LONGUEUR_ECRITURE_MAX) return false
  const segments = chemin.split('/')
  if (segments.length === 1) return FICHIERS_RACINE_ECRIVABLES.includes(chemin)
  return segments.length === 2 && DOSSIERS_ECRIVABLES.includes(segments[0]) && segmentAdmis(segments[1])
}

/** Erreur rendue pour un chemin hors de la liste blanche. */
export function cheminRefuse(chemin: unknown): ErreurDisque {
  const texte = typeof chemin === 'string' ? chemin.slice(0, 200) : typeof chemin
  return new ErreurDisque('PERMISSION', `Chemin refusé sur le téléphone : « ${texte} ».`)
}

/** Erreur rendue quand un fichier est encore là après son effacement : le téléphone a changé depuis le listage. */
export function resteApresEffacement(chemin: string): ErreurDisque {
  return new ErreurDisque('UNKNOWN', `« ${chemin} » est encore sur le téléphone après son effacement : il a changé depuis le listage, listez-le de nouveau.`)
}

// ---------- noms provisoires, comme l'application du téléphone ----------

/**
 * Nom provisoire d'une écriture, celui que l'application du téléphone emploie : `nom.gtracker-tmp` pour remplacer un
 * fichier qui existe, `nom.gtracker-new` pour en créer un. Jamais `.gtracker-tmp` pour un fichier neuf : resté seul
 * après une coupure, le téléphone le prendrait pour un remplacement achevé et lui rendrait son nom. Même règle que
 * `tempNameFor` de `src/library/remoteTemps.ts` (la coquille ne lit pas les sources de la page ; un test les compare).
 */
export function nomProvisoire(chemin: string, existe: boolean): string {
  return chemin + (existe ? SUFFIXE_REMPLACEMENT : SUFFIXE_NEUF)
}

/** Un fichier tel que le téléphone le montre (`chemin`), et le nom qu'il porte vraiment sur le téléphone (`reel`). */
export type FichierVu = FichierTelephone & { reel: string }

/**
 * Fichiers tels que l'application du téléphone les voit, dossier par dossier, d'après son listage (la règle de
 * `finishInterruptedReplace` du greffon, reprise dans `phoneVisibleNames` de `src/library/remoteTemps.ts`) :
 * `nom.gtracker-new` (création interrompue) est caché ; `nom.gtracker-tmp` à côté de `nom` (remplacement interrompu,
 * l'original intact) est caché ; `nom.gtracker-tmp` seul (l'original déjà retiré) est montré sous `nom`. Suffixes en
 * casse exacte, comme sur le téléphone.
 */
export function commeLeTelephone(bruts: readonly FichierTelephone[]): FichierVu[] {
  const parDossier = new Map<string, FichierTelephone[]>()
  for (const f of bruts) {
    const i = f.chemin.lastIndexOf('/')
    const dossier = i < 0 ? '' : f.chemin.slice(0, i + 1)
    parDossier.set(dossier, [...(parDossier.get(dossier) ?? []), f])
  }
  const vus: FichierVu[] = []
  for (const [dossier, fichiers] of parDossier) {
    const noms = new Set(fichiers.map((f) => f.chemin.slice(dossier.length)))
    for (const f of fichiers) {
      const nom = f.chemin.slice(dossier.length)
      if (nom.endsWith(SUFFIXE_NEUF) && nom.length > SUFFIXE_NEUF.length) continue
      if (nom.endsWith(SUFFIXE_REMPLACEMENT) && nom.length > SUFFIXE_REMPLACEMENT.length) {
        const original = nom.slice(0, -SUFFIXE_REMPLACEMENT.length)
        if (noms.has(original)) continue
        noms.add(original)
        vus.push({ ...f, chemin: dossier + original, reel: f.chemin })
        continue
      }
      vus.push({ ...f, reel: f.chemin })
    }
  }
  return vus
}

/**
 * Fichiers admis par `admis` (la règle du canal), triés par chemin ; un chemin vu deux fois (nom coupé par un retour à
 * la ligne) est écarté.
 */
export function fichiersAdmis<F extends FichierTelephone>(fichiers: F[], admis: (chemin: string) => boolean = cheminAdmis): F[] {
  const vus = new Map<string, number>()
  for (const f of fichiers) vus.set(f.chemin, (vus.get(f.chemin) ?? 0) + 1)
  return fichiers
    .filter((f) => admis(f.chemin) && vus.get(f.chemin) === 1 && Number.isSafeInteger(f.taille) && f.taille >= 0 && Number.isFinite(f.dateMs))
    .sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))
}

/** Le fichier montré, sans le nom réel (ce que la page reçoit). */
export function sansReel({ chemin, taille, dateMs }: FichierVu): FichierTelephone {
  return { chemin, taille, dateMs }
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
  /** Téléphone débranché après ce nombre d'opérations réussies (lectures, écritures, effacements). */
  coupureApres?: number | null
}

/**
 * Un dossier local qui joue la mémoire partagée du téléphone (`stockage`, son `/sdcard`) : le dossier lu est
 * `stockage/Documents/Gtracker`. Il liste comme le câble (racine, `sessions/`, `reglages/`, provisoires vus comme le
 * téléphone les voit), et écrit et efface comme lui : nom provisoire, taille relue, renommage. Stockage absent :
 * téléphone absent.
 */
export function dossierLocal(stockage: string | null, options: OptionsDossierLocal = {}): DossierDistant {
  const racine = stockage === null ? null : path.join(path.resolve(stockage), 'Documents', 'Gtracker')
  const coupure = options.coupureApres ?? null
  let operations = 0
  let debranche = false
  /** Nom réel de chaque fichier du dernier listage, par chemin montré. */
  let reels = new Map<string, string>()

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

  /** Vrai si la coupure d'essai tombe sur cette opération : le téléphone est alors débranché. */
  function coupe(): boolean {
    if (coupure === null || operations < coupure) return false
    debranche = true
    return true
  }

  const debrancheErreur = () => new ErreurDisque('UNKNOWN', 'Le téléphone a été débranché pendant l’opération.')

  /** Fichiers d'un dossier du téléphone d'essai, provisoires compris, à la seconde près comme ceux du débogage USB. */
  async function fichiersDe(dossier: string, prefixe: string): Promise<FichierTelephone[]> {
    const fichiers: FichierTelephone[] = []
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      if (!entree.isFile()) continue
      const s = await stat(path.join(dossier, entree.name))
      fichiers.push({ chemin: prefixe + entree.name, taille: s.size, dateMs: Math.floor(s.mtimeMs / 1000) * 1000 })
    }
    return fichiers
  }

  /** Le fichier du téléphone d'essai d'un chemin admis. */
  const absolu = (r: string, relatif: string) => path.join(r, ...relatif.split('/'))

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
      for (const sous of DOSSIERS_DU_CABLE) {
        try {
          fichiers.push(...(await fichiersDe(path.join(r, sous), `${sous}/`)))
        } catch (e) {
          if (codeDe(e) !== 'NOT_FOUND') throw e
        }
      }
      const vus = fichiersAdmis(commeLeTelephone(fichiers), cheminDuCable)
      reels = new Map(vus.map((f) => [f.chemin, f.reel]))
      return vus.map(sansReel)
    },

    async lire(fichier, fichierLocal) {
      const r = await exigerPret()
      if (coupe()) throw debrancheErreur()
      if (!cheminDuCable(fichier.chemin)) throw new ErreurDisque('UNKNOWN', 'Chemin refusé.')
      await copyFile(absolu(r, reels.get(fichier.chemin) ?? fichier.chemin), fichierLocal)
      const date = new Date(fichier.dateMs)
      await utimes(fichierLocal, date, date)
      operations++
    },

    async ecrire(chemin, fichierLocal, taille) {
      if (!cheminEcrivable(chemin)) throw cheminRefuse(chemin)
      const r = await exigerPret()
      const cible = absolu(r, chemin)
      let existe = false
      try {
        if (!(await stat(cible)).isFile()) throw new ErreurDisque('UNKNOWN', `« ${chemin} » n'est pas un fichier sur le téléphone.`)
        existe = true
      } catch (e) {
        if (codeDe(e) !== 'NOT_FOUND') throw e
      }
      const provisoire = nomProvisoire(cible, existe)
      await mkdir(path.dirname(cible), { recursive: true })
      if (coupe()) {
        // Comme un envoi coupé en route : la moitié du fichier sous son nom provisoire, que le téléphone écartera.
        const octets = await readFile(fichierLocal)
        await writeFile(provisoire, octets.subarray(0, Math.floor(octets.length / 2)))
        throw debrancheErreur()
      }
      try {
        await copyFile(fichierLocal, provisoire)
        const s = await stat(provisoire)
        if (s.size !== taille) throw new ErreurDisque('UNKNOWN', `Écriture incomplète de « ${chemin} » : ${s.size} octets sur ${taille}.`)
        await rename(provisoire, cible)
        reels.set(chemin, chemin)
        operations++
        return { chemin, taille: s.size, dateMs: Math.floor(s.mtimeMs / 1000) * 1000 }
      } catch (e) {
        await unlink(provisoire).catch(() => undefined)
        throw e
      }
    },

    async effacer(chemin) {
      if (!cheminEcrivable(chemin)) throw cheminRefuse(chemin)
      const r = await exigerPret()
      if (coupe()) throw debrancheErreur()
      // Comme le câble : le remplacement interrompu d'abord, l'original ensuite, un fichier à la fois, puis relu.
      const original = absolu(r, chemin)
      const provisoire = nomProvisoire(original, true)
      for (const fichier of [provisoire, original]) {
        try {
          // Un dossier ne s'efface jamais par ici, même vide.
          if ((await stat(fichier)).isDirectory()) throw new ErreurDisque('UNKNOWN', `« ${chemin} » n'est pas un fichier sur le téléphone.`)
          await unlink(fichier)
        } catch (e) {
          if (codeDe(e) !== 'NOT_FOUND') throw e
        }
      }
      reels.delete(chemin)
      operations++
      for (const fichier of [original, provisoire]) {
        if (await stat(fichier).then(() => true, () => false)) throw resteApresEffacement(chemin)
      }
    },
  }
}

// ---------- les canaux de la page ----------

/** Canaux servis ; le pont de la page (`preload.ts`) porte les mêmes noms. */
export const CANAUX_TELEPHONE = ['etat', 'lister', 'lireOctets', 'ecrireOctets', 'effacer', 'copieSecurite'] as const

/** Nom du dossier temporaire des lectures et des écritures, dans le profil du programme. */
export const DOSSIER_LECTURES = 'telephone-lecture'

/** Taille maximale d'un fichier écrit sur le téléphone, en octets. */
export const TAILLE_ECRITURE_MAX = 256 * 1024 * 1024

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
  /** Dossier des copies de sécurité (`<Documents>\Gtracker-copies`) ; absent, `telephone:copieSecurite` refuse. */
  copies?: string
}

/** Une action à la fois, dans l'ordre des appels : le téléphone ne reçoit jamais deux commandes ensemble. */
export function enSerie(): <T>(action: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve()
  return <T>(action: () => Promise<T>) => {
    const suite = queue.then(action, action)
    queue = suite.catch(() => undefined)
    return suite
  }
}

/** Champs d'un message reçu de la page, `{}` s'il n'est pas un objet. */
function champs(argument: unknown): Record<string, unknown> {
  return typeof argument === 'object' && argument !== null && !Array.isArray(argument) ? (argument as Record<string, unknown>) : {}
}

/**
 * Gestionnaires des canaux `telephone:*`, à brancher par `brancherCanaux` :
 * - `telephone:etat` rend un `EtatTelephone` ;
 * - `telephone:lister` rend les `FichierTelephone` (`NOT_FOUND` si `Documents/Gtracker` est absent), et vide le
 *   dossier temporaire ;
 * - `telephone:lireOctets({ chemin })` rend les octets d'un fichier du dernier listage ; le fichier temporaire est
 *   effacé, réussite ou échec ;
 * - `telephone:ecrireOctets({ chemin, octets })` écrit un fichier de la liste blanche (`cheminEcrivable`) après un
 *   listage réussi, et rend le `FichierTelephone` écrit ; le fichier temporaire est effacé, réussite ou échec ;
 * - `telephone:effacer({ chemin })` efface un fichier de la liste blanche, vu au dernier listage ou écrit depuis ;
 * - `telephone:copieSecurite()` copie le dossier mémoire retenu et ce que liste le téléphone dans un dossier neuf des
 *   copies de sécurité (`copieSecurite.ts`), et rend son chemin absolu ; le dernier listage n'en change pas.
 * Un chemin hors de la liste blanche est refusé (`PERMISSION`) avant toute commande au téléphone.
 */
export function gestionnairesTelephone(dossier: DossierDistant, dossierTemp: string, options: OptionsGestionnaires = {}): Record<string, Gestionnaire> {
  const serie = enSerie()
  /** Fichiers du dernier listage réussi, par chemin, suivis des écritures et effacements ; vide après un listage en échec. */
  let dernier = new Map<string, FichierTelephone>()
  /** Vrai après un listage réussi : le canal est choisi, le téléphone est connu. */
  let liste = false
  let numero = 0

  function oublier(): void {
    dernier = new Map()
    liste = false
  }

  /** Refuse un dossier temporaire placé dans la mémoire (ou qui la contient). */
  async function verifierTemp(): Promise<void> {
    const memoire = options.memoire ? await options.memoire() : null
    if (memoire !== null && (estSous(dossierTemp, memoire) || estSous(memoire, dossierTemp))) {
      throw new ErreurDisque('UNKNOWN', 'Le dossier temporaire des échanges avec le téléphone est dans la mémoire : refusé.')
    }
  }

  /** Le chemin d'un message d'écriture ou d'effacement, admis par la liste blanche ; lève sinon. */
  function cheminAEcrire(a: Record<string, unknown>): string {
    const chemin = a.chemin
    if (typeof chemin !== 'string') throw new ErreurDisque('UNKNOWN', 'Message mal formé : « chemin » doit être un texte.')
    if (!cheminEcrivable(chemin)) throw cheminRefuse(chemin)
    if (!liste) throw new ErreurDisque('UNKNOWN', "Le téléphone n'a pas été listé.")
    return chemin
  }

  return {
    // Un téléphone qui n'est plus prêt (débranché, autre appareil en attente, panne) fait oublier le listage : écrire
    // et effacer demandent un nouveau listage. Le câble compare en plus le numéro de série (`adb.ts`).
    'telephone:etat': () =>
      enReponse(() =>
        serie(async () => {
          try {
            const e = await dossier.etat()
            if (e.etat !== 'pret') oublier()
            return e
          } catch (erreur) {
            oublier()
            throw erreur
          }
        }),
      ),

    'telephone:lister': () =>
      enReponse(() =>
        serie(async () => {
          dernier = new Map()
          liste = false
          await verifierTemp()
          await viderLectures(dossierTemp)
          const fichiers = await dossier.lister()
          dernier = new Map(fichiers.map((f) => [f.chemin, f]))
          liste = true
          return fichiers
        }),
      ),

    'telephone:lireOctets': (argument) =>
      enReponse(() =>
        serie(async (): Promise<Uint8Array> => {
          const chemin = champs(argument).chemin
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

    'telephone:ecrireOctets': (argument) =>
      enReponse(() =>
        serie(async (): Promise<FichierTelephone> => {
          const a = champs(argument)
          const chemin = cheminAEcrire(a)
          const octets = a.octets
          if (!estOctets(octets)) throw new ErreurDisque('UNKNOWN', 'Message mal formé : « octets » doit être un Uint8Array.')
          if (octets.byteLength > TAILLE_ECRITURE_MAX) throw new ErreurDisque('UNKNOWN', `Fichier trop gros pour le téléphone : « ${chemin} ».`)
          if (!dossier.ecrire) throw new ErreurDisque('UNKNOWN', 'Ce canal ne sait pas écrire sur le téléphone.')
          await verifierTemp()
          await mkdir(dossierTemp, { recursive: true })
          const local = path.join(dossierTemp, `${++numero}${SUFFIXE_REMPLACEMENT}`)
          try {
            const poignee = await open(local, 'w')
            try {
              await poignee.writeFile(octets)
              await poignee.sync()
            } finally {
              await poignee.close()
            }
            const ecrit = await dossier.ecrire(chemin, local, octets.byteLength)
            dernier.set(chemin, ecrit)
            return ecrit
          } finally {
            await effacer(local)
          }
        }),
      ),

    'telephone:effacer': (argument) =>
      enReponse(() =>
        serie(async (): Promise<null> => {
          const chemin = cheminAEcrire(champs(argument))
          if (!dernier.has(chemin)) throw new ErreurDisque('UNKNOWN', `Fichier absent du dernier listage du téléphone : « ${chemin} ».`)
          if (!dossier.effacer) throw new ErreurDisque('UNKNOWN', 'Ce canal ne sait pas effacer sur le téléphone.')
          await dossier.effacer(chemin)
          dernier.delete(chemin)
          return null
        }),
      ),

    'telephone:copieSecurite': () =>
      enReponse(() =>
        serie(async (): Promise<string> => {
          const memoire = options.memoire ? await options.memoire() : null
          if (memoire === null) throw new ErreurDisque('UNKNOWN', 'Aucun dossier mémoire retenu : pas de copie de sécurité.')
          if (!options.copies) throw new ErreurDisque('UNKNOWN', 'Ce programme ne sait pas où ranger les copies de sécurité.')
          return copieSecurite({ memoire, telephone: dossier, copies: options.copies })
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
