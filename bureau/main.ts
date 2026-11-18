// Coquille Windows de Gtracker : l'application de `dist/` dans une fenêtre, servie sous `https://gtracker.localhost`
// (voir `origine.ts`), avec la mémoire du navigateur intégré dans le profil de la coquille.
//
// Mode d'essai, pour le banc seulement (`GTRACKER_BANC=1`) : fenêtre cachée de 1400 × 1000, rendu jamais ralenti,
// port de débogage accepté, autorisations et fermetures journalisées sur la sortie, question de fermeture répondue
// seule (`GTRACKER_BANC_QUITTER=non` pour rester sur la page). Hors de ce mode, un port de débogage fait quitter.
//
// Variables lues :
//   GTRACKER_PROFIL         dossier du profil (mémoire, réglages de la fenêtre) au lieu de `%APPDATA%\Gtracker`
//   GTRACKER_DIST           dossier de l'application à servir au lieu de celui du programme
//   GTRACKER_BANC           mode d'essai (« 1 »)
//   GTRACKER_BANC_QUITTER   réponse du mode d'essai à la question de fermeture : « oui » (défaut) ou « non »

import { BrowserWindow, Menu, app, dialog, net, protocol, screen, session, shell } from 'electron'
import type { Rectangle, WebContents } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ADRESSE_ACCUEIL, HOTE, estDeLApplication } from './origine'
import { CSP, reponseA } from './protocole'

const BANC = process.env.GTRACKER_BANC === '1'
const QUITTER_EN_ESSAI = (process.env.GTRACKER_BANC_QUITTER ?? 'oui') !== 'non'

/** Fond de la fenêtre avant le premier dessin de la page : celui du thème clair, pour éviter un éclair d'une autre couleur. */
const FOND = '#ffffff'

/** Taille de la fenêtre au premier lancement, et toujours en mode d'essai (celle des relevés du banc). */
const TAILLE_DEFAUT = { width: 1400, height: 1000 }

/** Autorisations accordées à la page ; toute autre demande est refusée. */
const AUTORISATIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'fileSystem', 'persistent-storage'])

/** Fichier du profil qui retient taille et position de la fenêtre. */
const FICHIER_FENETRE = 'fenetre.json'

function journal(message: string): void {
  if (BANC) console.log(`[Gtracker] ${message}`)
}

// ---------- garde du port de débogage ----------
// Un port de débogage donne la main sur la page et sa mémoire : seul le mode d'essai l'accepte.
const DEBOGAGE = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk']
const DEBOGAGE_REFUSE = !BANC && DEBOGAGE.some((s) => app.commandLine.hasSwitch(s))

// ---------- version et profil ----------
/** Version de l'application telle qu'elle s'affiche (`0.01.40`), écrite par l'emballage dans le package.json de la coquille. */
function versionAffichee(): string {
  try {
    const paquet = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as { gtrackerVersion?: string }
    return paquet.gtrackerVersion ?? app.getVersion()
  } catch {
    return app.getVersion()
  }
}
const VERSION = versionAffichee()

app.setName('Gtracker')
if (process.env.GTRACKER_PROFIL) app.setPath('userData', path.resolve(process.env.GTRACKER_PROFIL))

/** Dossier de l'application à servir : à côté du programme une fois emballé, `dist/` du dépôt sinon. */
const DIST = path.resolve(
  process.env.GTRACKER_DIST ?? (app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', '..', 'dist')),
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
    // Tout autre hôte (tuiles, recherche de lieux) repart sur le réseau, sans repasser par ce gestionnaire.
    return net.fetch(requete, { bypassCustomProtocolHandlers: true })
  })
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
  const defaut: Fenetre = { ...TAILLE_DEFAUT, agrandie: false }
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
  journal(`lien externe : ${url.href}`)
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
// Le menu de Windows est retiré ; on garde le plein écran (F11) et le zoom au clavier, que le menu portait.
function raccourcis(fenetre: BrowserWindow): void {
  fenetre.webContents.on('before-input-event', (evenement, entree) => {
    if (entree.type !== 'keyDown') return
    const contenu = fenetre.webContents
    if (entree.key === 'F11') fenetre.setFullScreen(!fenetre.isFullScreen())
    else if (entree.control && (entree.key === '+' || entree.key === '=')) contenu.setZoomLevel(Math.min(contenu.getZoomLevel() + 0.5, 4))
    else if (entree.control && entree.key === '-') contenu.setZoomLevel(Math.max(contenu.getZoomLevel() - 0.5, -3))
    else if (entree.control && entree.key === '0') contenu.setZoomLevel(0)
    else return
    evenement.preventDefault()
  })
}

// ---------- fermeture avec un brouillon ----------
// La page retient la fermeture (`beforeunload`) quand un brouillon n'est pas enregistré ; sans cette question,
// la croix de la fenêtre semblerait ne rien faire.
function questionDeFermeture(fenetre: BrowserWindow): void {
  fenetre.webContents.on('will-prevent-unload', (evenement) => {
    const quitter = BANC
      ? QUITTER_EN_ESSAI
      : dialog.showMessageBoxSync(fenetre, {
          type: 'question',
          buttons: ['Quitter', 'Rester'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          title: 'Gtracker',
          message: 'Quitter sans enregistrer ?',
          detail: 'Les modifications de la session ouverte ne sont pas enregistrées.',
        }) === 0
    journal(`fermeture retenue par la page : ${quitter ? 'quitter' : 'rester'}`)
    if (quitter) evenement.preventDefault()
  })
}

// ---------- fenêtre ----------
let fenetrePrincipale: BrowserWindow | null = null

function ouvrirFenetre(): void {
  const retenue = lireFenetre()
  const fenetre = new BrowserWindow({
    ...(retenue.x !== undefined ? { x: retenue.x, y: retenue.y } : {}),
    width: retenue.width,
    height: retenue.height,
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
  fenetre.webContents.on('render-process-gone', (_e, details) => journal(`page arrêtée : ${details.reason}`))
  fenetre.on('closed', () => {
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
    const s = session.defaultSession
    s.setUserAgent(`${s.getUserAgent()} Gtracker/${VERSION} (+https://github.com/segneur34)`)
    gererAutorisations()
    brancherProtocole()
    journal(`prêt : ${ADRESSE_ACCUEIL}, application ${DIST}, profil ${app.getPath('userData')}`)
    ouvrirFenetre()
  })
}

if (DEBOGAGE_REFUSE) {
  // Port de débogage sans le mode d'essai : on quitte avant d'ouvrir quoi que ce soit.
  app.exit(1)
} else if (!app.requestSingleInstanceLock()) {
  // Le verrou est pris dans le dossier du profil : deux profils d'essai peuvent tourner ensemble. Un second
  // lancement sur le même profil réveille la première fenêtre (`second-instance`) et s'arrête.
  app.quit()
} else {
  demarrer()
}
