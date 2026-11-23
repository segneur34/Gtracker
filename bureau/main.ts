// Coquille Windows de Gtracker : l'application de `dist/` dans une fenêtre, servie sous `https://gtracker.localhost`
// (voir `origine.ts`), avec la mémoire du navigateur intégré dans le profil de la coquille.
//
// Mode d'essai, pour le banc seulement (`GTRACKER_BANC=1`) : fenêtre cachée dont la page fait 1382 × 904 (celle de
// Chrome sans fenêtre), rendu jamais ralenti, port de débogage accepté, aucun accès au réseau réel (les autres hôtes
// sont refusés et journalisés), autorisations et fermetures journalisées sur la sortie, question de fermeture
// répondue seule (`GTRACKER_BANC_QUITTER=non` pour rester sur la page). Hors de ce mode, un port de débogage fait quitter.
// Le mode d'essai et toutes les variables ci-dessous ne sont lus qu'hors emballage ou dans le programme d'essai du banc
// (marqueur `gtrackerEssai` du package.json, `modeEssai.ts`) : le programme livré par l'installeur les ignore toutes.
//
// Fenêtre cachée et demande de fermeture de Windows : après un rechargement de la page, Chromium ajoute au processus
// une seconde fenêtre cachée sans titre, et la demande de fermeture (`taskkill` sans `/F`) part vers elle et non vers
// celle de l'application, qui reste ouverte. Une fenêtre montrée la reçoit toujours : le banc qui essaie la fermeture
// après un rechargement montre la sienne (`GTRACKER_BANC_MONTRER`), transparente pour ne rien afficher sur l'écran.
//
// Variables lues :
//   GTRACKER_PROFIL         dossier du profil (mémoire, réglages de la fenêtre) au lieu de `%APPDATA%\Gtracker`
//   GTRACKER_DIST           dossier de l'application à servir au lieu de celui du programme
//   GTRACKER_BANC           mode d'essai (« 1 »)
//   GTRACKER_BANC_QUITTER   réponse du mode d'essai à la question de fermeture : « oui » (défaut) ou « non »
//   GTRACKER_BANC_MONTRER   fenêtre du mode d'essai montrée sans prendre la main : « 1 », ou « transparente »
//   GTRACKER_MEMOIRE, GTRACKER_DOCUMENTS, GTRACKER_BANC_DOSSIER : en mode d'essai seulement, voir `memoire.ts`
//   GTRACKER_BANC_TELEPHONE, GTRACKER_BANC_TELEPHONE_ETAT, GTRACKER_BANC_TELEPHONE_COUPURE : en mode d'essai
//                           seulement, voir `telephone.ts` ; le mode d'essai ne lance jamais le vrai adb
//   GTRACKER_BANC_SANSFIL_ACTIF, _PORT, _SONDE, _FENETRE_MS, _PROFIL, _PAREFEU, _AUTORISATION : en mode d'essai
//                           seulement, voir `sansFil.ts` ; le serveur sans fil d'essai n'écoute que sur 127.0.0.1, et
//                           son pare-feu est factice (jamais Windows PowerShell)
//
// Hors du mode d'essai, le pare-feu de Windows est lu et l'autorisation demandée pour l'exécutable en cours
// (`process.execPath`), par `pareFeu.ts`. Relancé élevé avec `--gtracker-pare-feu=poser` ou `=retirer` (par cette
// autorisation, ou par le désinstalleur), le programme pose ou retire les règles de son propre chemin, puis quitte,
// avant le verrou d'instance unique et sans rien ouvrir, sur un profil jetable.
//   GTRACKER_BANC_COPIES    en mode d'essai seulement : le dossier des copies de sécurité « choisi » (aucune fenêtre),
//                           voir `copieSecurite.ts` ; l'ouverture d'une copie y est seulement journalisée
//   GTRACKER_APK, GTRACKER_BANC_APK_DESTINATION, GTRACKER_BANC_APPLICATION_REFUS : en mode d'essai seulement, voir
//                           `applicationTelephone.ts` ; le mode d'essai n'ouvre jamais la fenêtre « Enregistrer sous »
//
// L'application du téléphone embarquée (`resources\Gtracker-<version>.apk`) s'enregistre sur le disque ou s'installe
// par le câble par les canaux `application:*` (`applicationTelephone.ts`), l'installation passant dans la même file
// que les autres commandes au téléphone.
//
// Le dossier mémoire (un vrai dossier du disque) est lu et écrit ici, la page y passant par les canaux `memoire:*`
// du pont (`preload.ts`, `memoire.ts`) ; seule la page de la fenêtre principale y a accès (`expediteurAdmis`).
// Le dossier `Documents/Gtracker` du téléphone est lu ici aussi par les canaux `telephone:*` (`telephone.ts`) : par
// le Wi-Fi si un téléphone y est relié (`sansFil.ts`, réglé par les canaux `sansfil:*`, en lecture seule), sinon par
// le câble (`adb.ts`, le débogage USB), qui sait aussi écrire et effacer un fichier de la liste blanche
// (`cheminEcrivable`, vérifiée par les gestionnaires avant toute commande).
//
// Le journal daté (`journal.ts`) : `journal.txt` dans le profil, toujours écrit, mode d'essai ou non ; il reçoit tout ce
// que la coquille journalise (liaisons du téléphone, états lus qui changent, refus) et les étapes que la page y note par
// le canal `coquille:noter`, jamais un nom, un chemin ni une adresse web. En mode d'essai, les lignes de la coquille vont
// aussi sur la sortie, avec leurs détails (`Journaliser`).

import { BrowserWindow, Menu, app, dialog, ipcMain, net, protocol, safeStorage, screen, session, shell } from 'electron'
import type { OpenDialogOptions, Rectangle, SaveDialogOptions, WebContents } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { dossierAdb, dossierAdbConseille } from './adb'
import type { EssaiApplication } from './applicationTelephone'
import { cheminApk, essaiApplicationDepuisEnvironnement, gestionnairesApplication } from './applicationTelephone'
import { AVIS_COPIE, DOSSIER_COPIES, choixCopiesDepuisEnvironnement, gestionnairesCopies, reglageCopies } from './copieSecurite'
import { ErreurDisque } from './disque'
import type { Journal, Journaliser } from './journal'
import { creerJournal, journaliseur, lireNote, suivreEtats } from './journal'
import { creerMemoire, gestionnairesMemoire, optionsDepuisEnvironnement } from './memoire'
import type { PaquetDeLaCoquille } from './modeEssai'
import { environnementDeLaCoquille, essaiPermis } from './modeEssai'
import type { ContexteEcoute } from './pareFeu'
import { actionElevee, autoriserPareFeuWindows, executerActionElevee, lirePareFeuWindows } from './pareFeu'
import type { Chiffreur } from './sansFil'
import { AVIS_ARRIVEE, AVIS_DEPART, DOSSIER_SANS_FIL, ServeurSansFil, dossierSansFilPuisCable, essaiSansFilDepuisEnvironnement, gestionnairesSansFil, stockageDossier } from './sansFil'
import type { DossierDistant } from './telephone'
import { DOSSIER_LECTURES, dossierLocal, enSerie, essaiTelephoneDepuisEnvironnement, gestionnairesTelephone, viderLectures } from './telephone'
import { ADRESSE_ACCUEIL, HOTE, estDeLApplication } from './origine'
import { TEXTES_FERMETURE, brancherCanaux, echec, expediteurAdmis, lireTextesFermeture, reussite, uneALaFois } from './pont'
import type { TextesFermeture } from './pont'
import { CSP, reponseA } from './protocole'
import { gardeRechargements } from './rechargement'
import { STATUT_REFUS, entetesSortants, estUnRefus } from './sortant'

/** Le package.json de la coquille, écrit par l'emballage : version affichée et marqueur du programme d'essai. */
function lirePaquet(): PaquetDeLaCoquille | null {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as PaquetDeLaCoquille
  } catch {
    return null
  }
}
const PAQUET = lirePaquet()

/** Variables d'environnement lues par la coquille : sans aucune `GTRACKER_*` dans le programme livré (`modeEssai.ts`). */
const ENV = environnementDeLaCoquille(process.env, essaiPermis({ emballe: app.isPackaged, paquet: PAQUET }))

const BANC = ENV.GTRACKER_BANC === '1'
const QUITTER_EN_ESSAI = (ENV.GTRACKER_BANC_QUITTER ?? 'oui') !== 'non'
const MONTRER_EN_ESSAI = ['1', 'transparente'].includes(ENV.GTRACKER_BANC_MONTRER ?? '')
const TRANSPARENTE_EN_ESSAI = ENV.GTRACKER_BANC_MONTRER === 'transparente'

/** Fond de la fenêtre avant le premier dessin de la page : celui du thème clair, pour éviter un éclair d'une autre couleur. */
const FOND = '#ffffff'

/** Taille de la fenêtre au premier lancement. */
const TAILLE_DEFAUT = { width: 1400, height: 1000 }

/**
 * Taille de la page, toujours, en mode d'essai : celle que voit Chrome sans fenêtre lancé avec `--window-size=1400,1000`
 * (cadre et barre d'outils retirés), pour que la mise en page des relevés du banc soit la même des deux côtés.
 */
const TAILLE_ESSAI = { width: 1382, height: 904 }

/** Autorisations accordées à la page ; toute autre demande est refusée. */
const AUTORISATIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'fileSystem', 'persistent-storage'])

/** Fichier du profil qui retient taille et position de la fenêtre. */
const FICHIER_FENETRE = 'fenetre.json'

/** Le journal daté, ouvert au premier message : le profil (`GTRACKER_PROFIL`) est alors choisi. */
let journalDate: Journal | null = null

/** Le journal daté seul, sans la sortie d'essai : ce qui ne sert qu'à relire le poste après coup. */
const journalSeul: Journal = {
  noter: (message) => {
    journalDate ??= creerJournal({ dossier: app.getPath('userData'), masques: [app.getPath('home')] })
    journalDate.noter(message)
  },
}

/** Journal daté, et en mode d'essai la sortie (avec les détails que le fichier ne prend pas : `Journaliser`). */
const journal: Journaliser = journaliseur(journalSeul, BANC ? (ligne) => console.log(`[Gtracker] ${ligne}`) : null)

// ---------- garde du port de débogage ----------
// Un port de débogage donne la main sur la page et sa mémoire : seul le mode d'essai l'accepte.
const DEBOGAGE = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk']
const DEBOGAGE_REFUSE = !BANC && DEBOGAGE.some((s) => app.commandLine.hasSwitch(s))

// ---------- version et profil ----------
/** Version de l'application telle qu'elle s'affiche (`0.01.40`), écrite par l'emballage dans le package.json de la coquille. */
const VERSION = PAQUET?.gtrackerVersion ?? app.getVersion()

app.setName('Gtracker')
if (ENV.GTRACKER_PROFIL) app.setPath('userData', path.resolve(ENV.GTRACKER_PROFIL))

/** Dossier de l'application à servir : à côté du programme une fois emballé, `dist/` du dépôt sinon. */
const DIST = path.resolve(
  ENV.GTRACKER_DIST ?? (app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', '..', 'dist')),
)

// ---------- service des fichiers ----------
async function servir(requete: Request): Promise<Response> {
  const adresse = new URL(requete.url)
  const reponse = reponseA(DIST, adresse.pathname, (chemin) => {
    try {
      return statSync(chemin).isFile()
    } catch {
      return false
    }
  })
  if (reponse.statut !== 200) return new Response(null, { status: reponse.statut })
  const entetes: Record<string, string> = { 'content-type': reponse.type, 'x-content-type-options': 'nosniff' }
  if (reponse.csp) {
    entetes['content-security-policy'] = CSP
    entetes['cache-control'] = 'no-cache'
  }
  try {
    return new Response(await readFile(reponse.fichier), { status: 200, headers: entetes })
  } catch {
    return new Response(null, { status: 404 })
  }
}

function brancherProtocole(): void {
  protocol.handle('https', (requete) => {
    if (new URL(requete.url).host === HOTE) return servir(requete)
    // Mode d'essai : aucun accès au réseau réel. Les requêtes de cette page passent ici et non par le réseau du
    // navigateur : l'interception du protocole de débogage (`Fetch`) ne les voit pas, un script du banc qui compte sur
    // de fausses réponses les verrait partir pour de bon.
    if (BANC) {
      journal(`réseau refusé : ${new URL(requete.url).host}`)
      return Response.error()
    }
    return relayer(requete)
  })
}

/**
 * Tout autre hôte (tuiles, recherche de lieux) repart sur le réseau, sans repasser par le gestionnaire du protocole,
 * sous le nom du programme (`sortant.ts`). Un refus servi en statut 200 (OpenStreetMap) est rendu en échec, sans image :
 * la page ne le garde pas et ne l'affiche pas comme une tuile.
 */
async function relayer(requete: Request): Promise<Response> {
  const sansCorps = requete.method === 'GET' || requete.method === 'HEAD'
  const reponse = await net.fetch(requete.url, {
    method: requete.method,
    headers: entetesSortants(requete.headers, VERSION),
    ...(sansCorps ? {} : { body: requete.body, duplex: 'half' }),
    bypassCustomProtocolHandlers: true,
  })
  if (!estUnRefus(reponse.headers)) return reponse
  journal(`refus du serveur : ${new URL(requete.url).host}`)
  return new Response(null, { status: STATUT_REFUS })
}

// ---------- fenêtre retenue ----------
type Fenetre = { x?: number; y?: number; width: number; height: number; agrandie: boolean }

function cheminFenetre(): string {
  return path.join(app.getPath('userData'), FICHIER_FENETRE)
}

/** Vrai si une part utile de la fenêtre tombe sur un écran branché (un écran débranché ne doit pas la cacher). */
function visible(cadre: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea: e }) => {
    const largeur = Math.min(cadre.x + cadre.width, e.x + e.width) - Math.max(cadre.x, e.x)
    const hauteur = Math.min(cadre.y + cadre.height, e.y + e.height) - Math.max(cadre.y, e.y)
    return largeur >= 100 && hauteur >= 50
  })
}

function lireFenetre(): Fenetre {
  const defaut: Fenetre = { ...(BANC ? TAILLE_ESSAI : TAILLE_DEFAUT), agrandie: false }
  if (BANC || !existsSync(cheminFenetre())) return defaut
  try {
    const lu = JSON.parse(readFileSync(cheminFenetre(), 'utf8')) as Partial<Fenetre>
    const { x, y, width, height } = lu
    if (![width, height].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 400)) return defaut
    const fenetre: Fenetre = { width: width as number, height: height as number, agrandie: lu.agrandie === true }
    if (typeof x === 'number' && typeof y === 'number' && visible({ x, y, width: fenetre.width, height: fenetre.height })) {
      fenetre.x = x
      fenetre.y = y
    }
    return fenetre
  } catch {
    return defaut
  }
}

function retenirFenetre(fenetre: BrowserWindow): void {
  if (BANC) return
  const cadre = fenetre.getNormalBounds()
  const retenue: Fenetre = { ...cadre, agrandie: fenetre.isMaximized() }
  try {
    writeFileSync(cheminFenetre(), JSON.stringify(retenue), 'utf8')
  } catch {
    // Profil en lecture seule : la fenêtre reprendra sa taille par défaut, rien de plus.
  }
}

// ---------- sécurité de la page ----------
function verrouiller(contenu: WebContents): void {
  // Aucune navigation hors de l'application : un lien externe part vers le navigateur de Windows.
  contenu.on('will-navigate', (evenement, adresse) => {
    if (estDeLApplication(adresse)) return
    evenement.preventDefault()
    ouvrirAuDehors(adresse)
  })
  contenu.on('will-redirect', (evenement, adresse) => {
    if (!estDeLApplication(adresse)) evenement.preventDefault()
  })
  contenu.setWindowOpenHandler(({ url }) => {
    ouvrirAuDehors(url)
    return { action: 'deny' }
  })
  contenu.on('will-attach-webview', (evenement) => evenement.preventDefault())
}

/** Seule une adresse `https:` hors de l'application est confiée au navigateur de Windows. */
function ouvrirAuDehors(adresse: string): void {
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return
  }
  if (url.protocol !== 'https:' || estDeLApplication(adresse)) return
  journal('lien externe ouvert', `lien externe : ${url.href}`)
  if (!BANC) void shell.openExternal(url.href)
}

function gererAutorisations(): void {
  const s = session.defaultSession
  s.setPermissionRequestHandler((_contenu, autorisation, reponse, details) => {
    const accordee = AUTORISATIONS.has(autorisation) && estDeLApplication(details.requestingUrl)
    journal(`autorisation ${autorisation} : ${accordee ? 'accordée' : 'refusée'}`)
    reponse(accordee)
  })
  s.setPermissionCheckHandler((_contenu, autorisation, origine) => AUTORISATIONS.has(autorisation) && estDeLApplication(origine))
  s.setDevicePermissionHandler(() => false)
}

// ---------- raccourcis ----------
// Le menu de Windows est retiré ; on garde le plein écran (F11), le zoom et le rechargement (F5, Ctrl+R) au clavier,
// que le menu portait.
function raccourcis(fenetre: BrowserWindow): void {
  fenetre.webContents.on('before-input-event', (evenement, entree) => {
    if (entree.type !== 'keyDown') return
    const contenu = fenetre.webContents
    if (entree.key === 'F11') fenetre.setFullScreen(!fenetre.isFullScreen())
    else if (entree.key === 'F5' || (entree.control && !entree.alt && entree.key.toLowerCase() === 'r')) rechargerLaPage(fenetre)
    else if (entree.control && (entree.key === '+' || entree.key === '=')) contenu.setZoomLevel(Math.min(contenu.getZoomLevel() + 0.5, 4))
    else if (entree.control && entree.key === '-') contenu.setZoomLevel(Math.max(contenu.getZoomLevel() - 0.5, -3))
    else if (entree.control && entree.key === '0') contenu.setZoomLevel(0)
    else return
    evenement.preventDefault()
  })
}

// ---------- fermeture avec un brouillon ----------
// La page retient la fermeture (`beforeunload`) quand un brouillon n'est pas enregistré ; sans cette question,
// la croix de la fenêtre semblerait ne rien faire. Ses textes sont ceux que la page a passés dans sa langue
// (`coquille:textes`), en français tant qu'elle n'a rien passé.
let textesFermeture: TextesFermeture = TEXTES_FERMETURE

function questionDeFermeture(fenetre: BrowserWindow): void {
  fenetre.webContents.on('will-prevent-unload', (evenement) => {
    const quitter = BANC
      ? QUITTER_EN_ESSAI
      : dialog.showMessageBoxSync(fenetre, {
          type: 'question',
          buttons: [textesFermeture.quitter, textesFermeture.rester],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          title: 'Gtracker',
          message: textesFermeture.question,
          detail: textesFermeture.detail,
        }) === 0
    journal(`fermeture retenue par la page : ${quitter ? 'quitter' : 'rester'}`)
    if (quitter) evenement.preventDefault()
    // La page reste : une prochaine fermeture videra de nouveau ses écritures.
    else vidageFait = false
  })
}

// ---------- écritures vidées avant de quitter la page ----------
// La page diffère ses écritures (fiche d'une session, réglages, brouillons) de quelques centaines de millisecondes :
// avant de fermer la fenêtre ou de recharger la page, la coquille lui demande de les vider (`coquille:fermeture`) et
// attend sa réponse (`coquille:fermeturePrete`), jamais plus de `DELAI_VIDAGE_MS` : une page figée ne retient pas la
// fermeture. La question du brouillon (`questionDeFermeture`) vient ensuite, comme avant.

/** Attente la plus longue de la réponse de la page, en millisecondes. */
const DELAI_VIDAGE_MS = 5000

/** Vrai une fois les écritures vidées pour une fermeture : la demande de fermeture suivante passe. */
let vidageFait = false

/** Vrai d'une fermeture retenue jusqu'à la fin du vidage : une seconde demande pendant ce temps est sans effet. */
let fermetureDemandee = false

/** Attente de la page en cours (fermeture ou rechargement), `null` sinon. */
let vidageCourant: Promise<void> | null = null

/** Réponse attendue de la page, `null` quand rien n'est demandé. */
let vidageAttendu: (() => void) | null = null

/** Vrai quand la page peut répondre : fenêtre ouverte et processus de la page en vie. */
function pageVivante(fenetre: BrowserWindow): boolean {
  return !fenetre.isDestroyed() && !fenetre.webContents.isCrashed()
}

/** Demande à la page de vider ses écritures ; rend quand elle a répondu, au plus tard après `DELAI_VIDAGE_MS`. */
function viderLesEcritures(fenetre: BrowserWindow): Promise<void> {
  journal('vidage des écritures demandé à la page')
  vidageCourant = new Promise((fin) => {
    const finir = (ligne: string) => {
      clearTimeout(plafond)
      vidageAttendu = null
      vidageCourant = null
      journal(ligne)
      fin()
    }
    const plafond = setTimeout(() => finir(`écritures non confirmées après ${DELAI_VIDAGE_MS / 1000} s`), DELAI_VIDAGE_MS)
    vidageAttendu = () => finir('écritures vidées')
    fenetre.webContents.send('coquille:fermeture')
  })
  return vidageCourant
}

/**
 * Retient la première demande de fermeture le temps de vider les écritures de la page (ou d'attendre le vidage déjà
 * demandé par un rechargement), puis ferme ; la réponse n'est prise que de la page de cette fenêtre (`expediteurAdmis`).
 */
function viderAvantFermeture(fenetre: BrowserWindow): void {
  fenetre.webContents.ipc.on('coquille:fermeturePrete', (evenement) => {
    if (expediteurAdmis(evenement, fenetre.webContents)) vidageAttendu?.()
  })
  fenetre.on('close', (evenement) => {
    if (vidageFait) return
    if (fermetureDemandee) {
      evenement.preventDefault()
      return
    }
    journal('fermeture demandée')
    if (!vidageCourant && !pageVivante(fenetre)) return
    evenement.preventDefault()
    fermetureDemandee = true
    void (vidageCourant ?? viderLesEcritures(fenetre)).then(() => {
      fermetureDemandee = false
      vidageFait = true
      if (!fenetre.isDestroyed()) fenetre.close()
    })
  })
}

/**
 * Rechargement demandé au clavier : les écritures sont vidées d'abord, la question du brouillon joue ensuite ; une
 * fermeture demandée pendant le vidage l'emporte.
 */
function rechargerLaPage(fenetre: BrowserWindow): void {
  if (vidageCourant || fermetureDemandee || vidageFait) return
  journal('rechargement demandé au clavier')
  if (!pageVivante(fenetre)) {
    fenetre.webContents.reload()
    return
  }
  void viderLesEcritures(fenetre).then(() => {
    if (!fermetureDemandee && !fenetre.isDestroyed()) fenetre.webContents.reload()
  })
}

// ---------- chute de la page ----------
// Si le processus de la page tombe (mémoire épuisée, pilote graphique, plantage de Chromium), la fenêtre resterait
// blanche : la page est rechargée sur l'accueil, au plus `RECHARGES_MAX` fois sur `FENETRE_RECHARGES_MS`
// (`rechargement.ts`) ; au-delà, l'utilisateur choisit de relancer le programme ou de le fermer. Rien n'est rechargé
// pendant une fermeture, ni pendant un vidage (un rechargement au clavier suit déjà).
const rechargements = gardeRechargements()

function relancerApresChute(fenetre: BrowserWindow): void {
  fenetre.webContents.on('render-process-gone', (_e, details) => {
    journal(`page arrêtée : ${details.reason}`)
    if (details.reason === 'clean-exit' || vidageCourant || fermetureDemandee || vidageFait || fenetre.isDestroyed()) return
    if (rechargements.autoriser(performance.now())) {
      journal('page rechargée après sa chute')
      fenetre.loadURL(ADRESSE_ACCUEIL).catch(() => journal('rechargement de la page impossible'))
      return
    }
    journal('chutes trop rapprochées : relance proposée')
    if (BANC) return
    void dialog
      .showMessageBox(fenetre, {
        type: 'error',
        buttons: ['Relancer', 'Fermer'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'Gtracker',
        message: "La page s'est arrêtée : relancer ?",
        detail: "Elle s'est arrêtée plusieurs fois en quelques minutes. Relancer redémarre le programme.",
      })
      .then(({ response }) => {
        journal(`relance après les chutes : ${response === 0 ? 'relancer' : 'fermer'}`)
        if (fenetre.isDestroyed()) return
        if (response !== 0) {
          fenetre.close()
          return
        }
        retenirFenetre(fenetre)
        app.relaunch()
        app.exit(0)
      })
  })
}

// ---------- le pont : dossier mémoire et textes ----------
/** Dossier de Windows, ou son repli sous le dossier de l'utilisateur s'il n'est pas défini. */
function dossierWindows(nom: 'documents' | 'home'): string {
  try {
    return app.getPath(nom)
  } catch {
    return nom === 'documents' ? path.join(app.getPath('home'), 'Documents') : app.getPath('home')
  }
}

/**
 * Fenêtre de choix d'un dossier de Windows, ouverte par le processus principal : la page ne voit jamais que la
 * réponse. Une seule à la fois : un appel pendant qu'elle est ouverte reçoit la même réponse.
 */
const choisirParFenetre = uneALaFois(async ({ titre, depart }: { titre: string; depart: string }): Promise<string | null> => {
  const options: OpenDialogOptions = {
    title: titre,
    defaultPath: depart,
    properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
  }
  const fenetre = fenetrePrincipale
  const { canceled, filePaths } = fenetre ? await dialog.showOpenDialog(fenetre, options) : await dialog.showOpenDialog(options)
  return canceled || filePaths.length === 0 ? null : filePaths[0]
})

/**
 * Ouvre un dossier des copies de sécurité dans l'explorateur de Windows ; en mode d'essai, le journalise seulement.
 * Le chemin a été vérifié par `gestionnairesCopies`.
 */
async function ouvrirDossier(chemin: string): Promise<void> {
  // Sans le chemin : le journal ne garde rien de personnel.
  journal("ouverture d'un dossier des copies de sécurité")
  if (BANC) return
  const erreur = await shell.openPath(chemin)
  if (erreur) throw new ErreurDisque('UNKNOWN', erreur)
}

/** Chiffrement du système (DPAPI sous Windows) pour la clé du certificat du sans-fil. */
const chiffreurSysteme: Chiffreur = {
  disponible: () => safeStorage.isAsyncEncryptionAvailable(),
  chiffrer: (texte) => safeStorage.encryptStringAsync(texte),
  dechiffrer: async (octets) => (await safeStorage.decryptStringAsync(Buffer.from(octets))).result,
}

/** Envoie un avis à la page de la fenêtre principale, si elle est ouverte. */
function avertirPage(canal: string, avis: unknown): void {
  const fenetre = fenetrePrincipale
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send(canal, avis)
}

/**
 * Le serveur sans fil, secrets dans le profil (ou le dossier d'essai), jamais dans la mémoire. Il ne se met à l'écoute
 * que si l'utilisateur l'a activé ; l'arrivée et le départ d'un téléphone sont annoncés à la page (`AVIS_ARRIVEE`,
 * `AVIS_DEPART`).
 */
function creerSansFil(profil: string): ServeurSansFil {
  const essai = essaiSansFilDepuisEnvironnement(ENV, journal)
  const { dossier, actif, ...reglagesEssai } = essai ?? { dossier: null, actif: false }
  // Le vrai pare-feu hors du mode d'essai seulement ; en essai, celui de `reglagesEssai` (factice).
  const pareFeuWindows = essai
    ? {}
    : {
        lirePareFeu: (ecoute: ContexteEcoute) => lirePareFeuWindows({ ...ecoute, exe: process.execPath }),
        autoriserPareFeu: () => autoriserPareFeuWindows(process.execPath),
      }
  const serveur = new ServeurSansFil({
    stockage: stockageDossier(dossier ?? path.join(profil, DOSSIER_SANS_FIL)),
    chiffreur: chiffreurSysteme,
    journal,
    ...pareFeuWindows,
    surArrivee: (avis) => avertirPage(AVIS_ARRIVEE, avis),
    surDepart: (avis) => avertirPage(AVIS_DEPART, avis),
    ...reglagesEssai,
  })
  // Activé dès le lancement (mode d'essai) : comme un sans-fil déjà allumé, sans demande d'autorisation.
  void (actif ? serveur.activer(true, false) : serveur.demarrer()).catch((e: unknown) => journal(`sans-fil : ${e instanceof Error ? e.message : String(e)}`))
  app.on('will-quit', () => void serveur.arreter())
  return serveur
}

/**
 * Le téléphone : par le Wi-Fi s'il y est relié, sinon par le câble ; en mode d'essai, le câble est le dossier local des
 * variables d'essai (jamais le vrai téléphone), sinon le débogage USB, par l'adb trouvé sur le poste. Le câble seul est
 * rendu à part : l'application ne s'installe que par lui.
 */
function creerTelephone(profil: string, sansFil: ServeurSansFil, essaiApplication: EssaiApplication | null): { telephone: DossierDistant; cable: DossierDistant } {
  const essai = essaiTelephoneDepuisEnvironnement(ENV, dossierAdbConseille(profil), journal)
  const cable = essai
    ? dossierLocal(essai.stockage, { ...essai, refusInstallation: essaiApplication?.refus ?? null })
    : dossierAdb({ env: ENV, profil, programme: path.dirname(process.execPath), journal })
  // Chaque changement de l'état lu par la page va au journal daté (pas à la sortie d'essai, que le banc relève).
  return { telephone: suivreEtats(dossierSansFilPuisCable(sansFil.dossierSansFil(), cable), journalSeul.noter), cable }
}

/** Dossier proposé par la fenêtre « Enregistrer sous » : Téléchargements, sinon Documents. */
function dossierTelechargements(): string {
  try {
    return app.getPath('downloads')
  } catch {
    return dossierWindows('documents')
  }
}

/** Fenêtre « Enregistrer sous » de Windows pour l'APK, ouverte par le processus principal : la page ne voit que la réponse. */
async function choisirDestinationApk({ titre, nom }: { titre: string; nom: string }): Promise<string | null> {
  const options: SaveDialogOptions = {
    title: titre,
    defaultPath: path.join(dossierTelechargements(), nom),
    filters: [{ name: 'APK', extensions: ['apk'] }],
    properties: ['showOverwriteConfirmation', 'dontAddToRecent'],
  }
  const fenetre = fenetrePrincipale
  const { canceled, filePath } = fenetre ? await dialog.showSaveDialog(fenetre, options) : await dialog.showSaveDialog(options)
  return canceled || !filePath ? null : filePath
}

function brancherPont(): void {
  const profil = app.getPath('userData')
  const optionsMemoire = optionsDepuisEnvironnement(ENV, { profil, documents: dossierWindows('documents'), maison: dossierWindows('home') }, choisirParFenetre, journal)
  const memoire = creerMemoire(optionsMemoire)
  // Les lectures et écritures du téléphone passent par un dossier du profil, vidé au démarrage de ce qu'une coupure y
  // aurait laissé.
  const lectures = path.join(profil, DOSSIER_LECTURES)
  void viderLectures(lectures)
  const memoireRetenue = async (): Promise<string | null> => {
    const ouverture = await memoire.ouvrir()
    return ouverture.ok && ouverture.valeur.etat !== 'aucun' ? ouverture.valeur.chemin : null
  }
  // Les copies de sécurité d'avant une première synchronisation : le dossier choisi par l'utilisateur, retenu dans le
  // profil, sinon sous Documents (celui d'essai sous le banc).
  const copies = reglageCopies({ profil, defaut: path.join(optionsMemoire.documents, DOSSIER_COPIES), memoire: memoireRetenue })
  const sansFil = creerSansFil(profil)
  const essaiApplication = essaiApplicationDepuisEnvironnement(ENV, journal)
  const { telephone, cable } = creerTelephone(profil, sansFil, essaiApplication)
  // Une seule file pour tout ce qui parle au téléphone : listages, lectures, écritures et installation de l'application.
  const serie = enSerie()
  const apk = cheminApk({
    version: VERSION,
    emballe: app.isPackaged,
    ressources: process.resourcesPath,
    depot: path.join(__dirname, '..', '..'),
    essai: essaiApplication?.apk ?? null,
  })
  brancherCanaux(
    ipcMain,
    (evenement) => expediteurAdmis(evenement, fenetrePrincipale?.webContents ?? null),
    {
      ...gestionnairesMemoire(memoire),
      ...gestionnairesTelephone(telephone, lectures, {
        memoire: memoireRetenue,
        copies: copies.dossier,
        avancementCopie: (avis) => avertirPage(AVIS_COPIE, avis),
        serie,
      }),
      ...gestionnairesCopies({
        reglage: copies,
        choisirDossier: choixCopiesDepuisEnvironnement(ENV, choisirParFenetre, journal),
        ouvrirDossier,
      }),
      ...gestionnairesApplication({
        version: VERSION,
        apk,
        profil,
        choisirDestination: essaiApplication?.choisirDestination ?? choisirDestinationApk,
        cable,
        serie,
        journal,
      }),
      ...gestionnairesSansFil(sansFil),
      'coquille:textes': async (argument) => {
        const textes = lireTextesFermeture(argument)
        if (!textes) return echec('UNKNOWN', 'Textes de la question de fermeture incomplets.')
        textesFermeture = textes
        return reussite(null)
      },
      'coquille:noter': async (argument) => {
        const note = lireNote(argument)
        if (note === null) return echec('UNKNOWN', 'Message mal formé : « texte » doit être un texte non vide.')
        journalSeul.noter(`page : ${note}`)
        return reussite(null)
      },
    },
    journal,
  )
}

// ---------- fenêtre ----------
let fenetrePrincipale: BrowserWindow | null = null

function ouvrirFenetre(): void {
  const retenue = lireFenetre()
  const fenetre = new BrowserWindow({
    ...(retenue.x !== undefined ? { x: retenue.x, y: retenue.y } : {}),
    width: retenue.width,
    height: retenue.height,
    useContentSize: BANC,
    minWidth: 360,
    minHeight: 480,
    show: false,
    title: 'Gtracker',
    backgroundColor: FOND,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
      backgroundThrottling: !BANC,
      additionalArguments: [`--gtracker-version=${VERSION}`],
    },
  })
  fenetrePrincipale = fenetre
  raccourcis(fenetre)
  questionDeFermeture(fenetre)
  if (!BANC) {
    fenetre.once('ready-to-show', () => {
      if (retenue.agrandie) fenetre.maximize()
      fenetre.show()
    })
    fenetre.on('close', () => retenirFenetre(fenetre))
  }
  if (BANC && MONTRER_EN_ESSAI) {
    fenetre.once('ready-to-show', () => {
      if (TRANSPARENTE_EN_ESSAI) fenetre.setOpacity(0)
      fenetre.showInactive()
    })
  }
  relancerApresChute(fenetre)
  viderAvantFermeture(fenetre)
  fenetre.on('closed', () => {
    journal('fenêtre fermée')
    fenetrePrincipale = null
  })
  void fenetre.loadURL(ADRESSE_ACCUEIL)
}

function demarrer(): void {
  app.on('second-instance', () => {
    const fenetre = fenetrePrincipale
    if (!fenetre) return
    if (fenetre.isMinimized()) fenetre.restore()
    fenetre.focus()
  })

  // Chaque contenu est verrouillé dès sa création, la fenêtre principale comme tout autre ouvert par une voie imprévue.
  app.on('web-contents-created', (_e, contenu) => verrouiller(contenu))

  app.on('window-all-closed', () => app.quit())

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    // Au journal daté seulement : la version, qui change à chaque livraison, n'entre pas dans les relevés du banc.
    journalSeul.noter(`lancement de Gtracker ${VERSION}`)
    gererAutorisations()
    brancherProtocole()
    brancherPont()
    journal('prêt', `prêt : ${ADRESSE_ACCUEIL}, application ${DIST}, profil ${app.getPath('userData')}`)
    ouvrirFenetre()
  })
}

const ACTION_ELEVEE = actionElevee(process.argv)

if (DEBOGAGE_REFUSE) {
  // Port de débogage sans le mode d'essai : on quitte avant d'ouvrir quoi que ce soit.
  app.exit(1)
} else if (ACTION_ELEVEE !== null) {
  // Relancé élevé pour le pare-feu : les règles de cet exécutable seulement, puis on quitte avec le code du script.
  // Profil jetable : un programme élevé n'écrit rien dans celui de l'utilisateur.
  app.setPath('userData', path.join(app.getPath('temp'), 'Gtracker-pare-feu'))
  void executerActionElevee(ACTION_ELEVEE, process.execPath).then((code) => app.exit(code))
} else if (!app.requestSingleInstanceLock()) {
  // Le verrou est pris dans le dossier du profil : deux profils d'essai peuvent tourner ensemble. Un second
  // lancement sur le même profil réveille la première fenêtre (`second-instance`) et s'arrête.
  app.quit()
} else {
  demarrer()
}
