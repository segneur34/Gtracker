// Livraison : fabrique le dépôt remis à l'acheteur, fait à neuf depuis l'arbre commité (HEAD), sans l'atelier ni
// l'ancien historique. Le dépôt de travail n'est jamais modifié.
//
//   node outils/livraison.mjs [--sortie <dossier>] [--a-blanc] [--verifier]
//
//   --sortie <dossier>  dossier du dépôt remis (sinon la rubrique `sortie` de la configuration) : hors du dépôt, sans
//                       `node_modules` dans un dossier parent, vide ou déjà fabriqué par cet outil (marque
//                       `.git/livraison-gtracker`) ; rien n'est effacé sans cette marque
//   --a-blanc           dit ce qui part, ce qui reste et ce qui est transformé, puis s'arrête
//   --verifier          après les contrôles : `npm ci`, `npm ci --ignore-scripts` dans `bureau/`, puis
//                       `node outils/verif.mjs`, lancés dans le dépôt remis (plusieurs minutes)
//
// Configuration hors dépôt, obligatoire : `../atelier/livraison/livraison.json` à côté du dépôt, ou le fichier que
// désigne la variable `GTRACKER_LIVRAISON`. Elle porte les données du vendeur à rechercher dans le dépôt remis
// (rubriques de `RUBRIQUES_VENDEUR`, listes de textes) et l'identité neutre de l'auteur du commit unique
// (`auteur.nom`, `auteur.email`), plus `sortie` et `message`, facultatifs. Aucune de ces données n'est écrite dans le
// dépôt ni imprimée : une trouvaille se dit par sa rubrique et son rang.
//
// Déroulé : plan par `git ls-tree` ; export par `git archive` du seul arbre de HEAD, décompressé par `tar` lancé dans le
// dossier de sortie (jamais de chemin donné à `tar`, qui lirait « D: » comme un nom de machine) ; retrait de
// l'atelier (`ATELIER`), des scripts de `SCRIPTS_RETIRES` dans `package.json` et des blocs d'atelier des documents
// (une ligne `<!-- atelier -->` seule, jusqu'à une ligne `<!-- /atelier -->` seule) ; `git init`, bit exécutable reposé,
// un seul commit à l'auteur neutre ; contrôles (un commit, ni étiquette ni dépôt distant, auteur neutre, chaque fichier
// non transformé identique à la source au blob et au mode près, recherches bloquantes à zéro, identité de
// l'application, fichiers attendus). Les avertissements (vocabulaire d'atelier) ne bloquent pas.
//
// Sortie : « Livrable », code 0 ; « Non livrable » et les contrôles en échec, code 1 (le dossier reste, pour qu'on
// l'examine) ; refus avant tout geste (usage, configuration, dossier de sortie, document mal balisé) ou commande
// interrompue, code 2. Sans dépendance.

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Ce qui part du dépôt remis : un chemin exact, ou un dossier entier quand il finit par `/`. */
export const ATELIER = [
  '.claude/',
  'CLAUDE.md',
  'docs/BACKLOG.md',
  'docs/backlog/',
  'docs/MODELES.md',
  'docs/HISTORIQUE.md',
  'docs/DECISIONS.md',
  'outils/backlog.mjs',
  'outils/backlog.test.mjs',
  'outils/fin-de-lot.mjs',
  'outils/fin-de-lot.test.mjs',
  'outils/lancer-gtracker.bat',
  'outils/livraison.mjs',
  'outils/livraison.test.mjs',
  'outils/heritage.mjs',
  'outils/heritage.json',
  'src/heritage.test.ts',
  'src/landWords.test.ts',
]

/** Scripts de `package.json` qui ne servent qu'à l'atelier. */
export const SCRIPTS_RETIRES = ['backlog']

/** Fichiers sans lesquels le dépôt remis n'est pas livrable. */
export const ATTENDUS = ['ARCHITECTURE.md', 'CONTRIBUER.md', 'README.md', '.gitattributes', 'package-lock.json', 'bureau/package-lock.json']

/** Rubriques des données du vendeur dans la configuration, chacune une liste de textes. */
export const RUBRIQUES_VENDEUR = ['noms', 'pseudos', 'github', 'emails', 'comptesWindows', 'chemins']

/** Marque posée dans le `.git` du dépôt remis : seul un dossier qui la porte peut être vidé puis refait. */
export const MARQUE = 'livraison-gtracker'

const DEBUT_BLOC = '<!-- atelier -->'
const FIN_BLOC = '<!-- /atelier -->'
const RE_DEBUT_BLOC = /^\s*<!-- atelier -->\s*$/
const RE_FIN_BLOC = /^\s*<!-- \/atelier -->\s*$/

// Le nom de l'ancienne application s'écrit en deux morceaux : la garde du nom (`src/heritage.test.ts`) lit aussi
// `outils/`. Même motif que cette garde : le mot sans « g » devant, sous toutes ses casses, et l'expression qui
// désignait l'ancienne application.
const MOT_ANCIEN = 'track' + 'er'
const RE_ANCIEN_NOM = new RegExp(`(?<![gG])${MOT_ANCIEN}|application compl` + 'ète', 'i')

/** Fichiers qui nomment l'ancienne application par métier : la porte d'import et ses essais (`NAMED_FILES` de la garde). */
export const FICHIERS_NOMMES = ['src/library/legacyImport.ts', 'src/library/legacyImport.test.ts', 'src/test/legacyImport.fixture.ts']

/** Le nom sans son G sous le logo du Profil, et la ligne du banc qui le relit (`SHOWN_NAME` de la garde). */
export const NOM_MONTRE = [
  { fichier: 'src/pages/ProfilePage.tsx', motif: new RegExp(`<span className="profile-hero__name">${MOT_ANCIEN}</span>`) },
  { fichier: 'outils/banc/profil.mjs', motif: new RegExp(`=== '${MOT_ANCIEN}'`) },
]

/** Recherches bloquantes hors données du vendeur. Un motif n'a jamais le drapeau `g` (`test` garderait sa position). */
export const MOTIFS_BLOQUANTS = [
  { nom: 'nom de l\'ancienne application', re: RE_ANCIEN_NOM, exemptes: FICHIERS_NOMMES, lignesPermises: NOM_MONTRE },
  { nom: 'plans de l\'assistant (.claude/plans)', re: /\.claude[\\/]+plans/i },
  { nom: 'lien claude.ai', re: /\bclaude\.ai\b/i },
  // Motifs refusés en dur dans src/ par le cliquet du vocabulaire (`DURS` d'`outils/heritage.mjs`), qui part avec l'atelier.
  { nom: 'Gravel, VTT (src/)', re: /Gravel|VTT/, dossier: 'src/' },
  { nom: 'runner (src/)', re: /runner|Runner|RUNNER/, dossier: 'src/' },
  { nom: 'allure min/km (src/)', re: /min\/km/, dossier: 'src/' },
]

/** Vocabulaire d'atelier : signalé, jamais bloquant (une mention au milieu d'une phrase se réécrit à la main). */
export const AVERTISSEMENTS = [
  { nom: 'nom de l\'assistant', re: /\bClaude\b|CLAUDE\.md/ },
  { nom: 'BACKLOG', re: /\bBACKLOG\b/ },
  { nom: 'MODELES', re: /\bMODELES\b/ },
  { nom: 'HISTORIQUE', re: /\bHISTORIQUE\b/ },
  { nom: 'DECISIONS', re: /\bDECISIONS\b/ },
  { nom: 'fin-de-lot', re: /fin-de-lot/ },
  { nom: '/chaine', re: /\/chaine\b/ },
  { nom: 'sous-agent', re: /sous-agents?\b/i },
  { nom: 'lot N', re: /\b[Ll]ots? \d+/ },
  { nom: 'point N', re: /\b[Pp]oints? \d+/ },
  { nom: '.claude/worktrees', re: /\.claude[\\/]+worktrees/ },
]

/** Refus avant tout geste (usage, configuration, dossier de sortie, document mal balisé) : message imprimé tel quel. */
export class ErreurLivraison extends Error {}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- configuration ----------

/**
 * Motifs des données du vendeur : un par texte, sans casse ; dans un chemin, `\` et `/` (doublés ou non) se valent, et
 * une espace vaut aussi `%20` ; dans un nom, plusieurs espaces valent une. Le nom d'un motif dit sa rubrique et son
 * rang, jamais sa valeur.
 */
export function motifsVendeur(vendeur) {
  const motifs = []
  for (const rubrique of RUBRIQUES_VENDEUR) {
    const textes = vendeur?.[rubrique] ?? []
    if (!Array.isArray(textes)) throw new ErreurLivraison(`configuration : vendeur.${rubrique} doit être une liste`)
    textes.forEach((brut, i) => {
      const texte = typeof brut === 'string' ? brut.trim() : ''
      if (texte.length < 4) throw new ErreurLivraison(`configuration : vendeur.${rubrique} n°${i + 1} vide ou trop court (4 caractères au moins)`)
      const espace = (s) => s.split(/\s+/).map(echapper).join('(?:\\s+|%20)')
      const source =
        rubrique === 'chemins'
          ? texte.split(/[\\/]+/).filter(Boolean).map(espace).join('[\\\\/]+')
          : espace(texte)
      motifs.push({ nom: `vendeur : ${rubrique} n°${i + 1}`, re: new RegExp(source, 'i') })
    })
  }
  return motifs
}

/** Configuration lue et contrôlée. Rend `{ sortie, auteur: { nom, email }, message, motifs }`. */
export function validerConfig(objet) {
  if (!objet || typeof objet !== 'object') throw new ErreurLivraison('configuration : objet JSON attendu')
  const nom = typeof objet.auteur?.nom === 'string' ? objet.auteur.nom.trim() : ''
  const email = typeof objet.auteur?.email === 'string' ? objet.auteur.email.trim() : ''
  if (!nom || !email) throw new ErreurLivraison('configuration : auteur.nom et auteur.email sont obligatoires (identité neutre du commit unique)')
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new ErreurLivraison('configuration : auteur.email illisible')
  // Une adresse de ce domaine désigne un compte GitHub existant : elle n'est pas neutre.
  if (/@users\.noreply\.github\.com$/i.test(email)) throw new ErreurLivraison('configuration : auteur.email désigne un compte GitHub, choisir une adresse sans compte derrière')
  const motifs = motifsVendeur(objet.vendeur ?? {})
  if (!motifs.length) throw new ErreurLivraison('configuration : aucune donnée du vendeur, la recherche ne prouverait rien')
  const message = typeof objet.message === 'string' && objet.message.trim() ? objet.message.trim() : null
  const porte = motifs.filter((m) => m.re.test(nom) || m.re.test(email) || (message !== null && m.re.test(message)))
  if (porte.length) throw new ErreurLivraison(`configuration : l'auteur neutre ou le message du commit porte une donnée du vendeur (${porte.map((m) => m.nom).join(', ')})`)
  const sortie = typeof objet.sortie === 'string' && objet.sortie.trim() ? objet.sortie.trim() : null
  return { sortie, auteur: { nom, email }, message, motifs }
}

/** Chemin de la configuration : la variable `GTRACKER_LIVRAISON`, sinon `../atelier/livraison/livraison.json`. */
export function cheminConfig(racine, env = process.env) {
  return env.GTRACKER_LIVRAISON ? path.resolve(env.GTRACKER_LIVRAISON) : path.resolve(racine, '..', 'atelier', 'livraison', 'livraison.json')
}

export function lireConfig(chemin) {
  let texte
  try {
    texte = fs.readFileSync(chemin, 'utf8')
  } catch {
    throw new ErreurLivraison(`configuration hors dépôt introuvable (${chemin}) : l'outil ne tourne pas sans elle`)
  }
  try {
    return validerConfig(JSON.parse(texte.replace(/^﻿/, '')))
  } catch (e) {
    if (e instanceof ErreurLivraison) throw e
    // Le message de JSON.parse peut citer un extrait du fichier, donc une donnée du vendeur : seule la position est dite.
    const position = /position (\d+)/.exec(String(e.message))?.[1]
    throw new ErreurLivraison(`configuration illisible (${chemin}) : JSON invalide${position ? ` à la position ${position}` : ''}`)
  }
}

// ---------- plan ----------

/** Entrées d'une sortie de `git ls-tree -r -z` : `[{ mode, type, blob, chemin }]`. */
export function lireArbre(sortie) {
  return sortie
    .split('\0')
    .filter(Boolean)
    .map((enregistrement) => {
      const tab = enregistrement.indexOf('\t')
      const [mode, type, blob] = enregistrement.slice(0, tab).split(' ')
      return { mode, type, blob, chemin: enregistrement.slice(tab + 1) }
    })
}

/** Vrai si le chemin part avec l'atelier : égal à une entrée, ou sous une entrée qui finit par `/`. */
export function estAtelier(chemin, atelier = ATELIER) {
  return atelier.some((a) => (a.endsWith('/') ? chemin.startsWith(a) : chemin === a))
}

/**
 * Ce qui part, ce qui reste, et parmi ce qui reste ce qui est transformé (`transformes`, chemins). `nonTrouves` : les
 * entrées de l'atelier qui ne désignent rien dans l'arbre. Refuse un lien symbolique ou un sous-module.
 */
export function planifier(entrees, { atelier = ATELIER, transformes = new Set() } = {}) {
  const part = []
  const reste = []
  const transforme = []
  for (const e of entrees) {
    if (estAtelier(e.chemin, atelier)) {
      part.push(e)
      continue
    }
    if (e.type !== 'blob' || (e.mode !== '100644' && e.mode !== '100755')) {
      throw new ErreurLivraison(`entrée non prise en charge (lien ou sous-module, mode ${e.mode}) : ${e.chemin}`)
    }
    reste.push(e)
    if (transformes.has(e.chemin)) transforme.push(e)
  }
  const nonTrouves = atelier.filter((a) => !part.some((e) => estAtelier(e.chemin, [a])))
  return { part, reste, transforme, nonTrouves }
}

// ---------- transformations ----------

/**
 * `package.json` sans les scripts nommés : ordre des clés, indentation de 2, fins de ligne et saut de ligne final
 * gardés. Refuse un fichier qui n'a pas la mise en forme de npm : le récrire changerait autre chose que ces scripts.
 */
export function retirerScripts(texte, noms = SCRIPTS_RETIRES) {
  const eol = texte.includes('\r\n') ? '\r\n' : '\n'
  const lf = texte.replace(/\r\n/g, '\n')
  let objet
  try {
    objet = JSON.parse(lf)
  } catch (e) {
    throw new ErreurLivraison(`package.json illisible : ${e.message}`)
  }
  if (JSON.stringify(objet, null, 2) + '\n' !== lf) {
    throw new ErreurLivraison('package.json : mise en forme autre que celle de npm (indentation de 2, saut de ligne final), retrait des scripts refusé')
  }
  const retires = noms.filter((n) => objet.scripts && Object.hasOwn(objet.scripts, n))
  for (const n of retires) delete objet.scripts[n]
  const sortie = JSON.stringify(objet, null, 2) + '\n'
  return { texte: eol === '\n' ? sortie : sortie.replace(/\n/g, '\r\n'), retires }
}

/**
 * Le document sans ses blocs d'atelier : de la ligne `<!-- atelier -->` seule à la ligne `<!-- /atelier -->` seule,
 * marqueurs compris. Une ligne vide qui suivrait une autre ligne vide (ou le début du fichier) après un bloc retiré
 * part aussi. Une mention des marqueurs au milieu d'une ligne n'est pas un marqueur. Refuse un bloc jamais refermé,
 * une fin sans début et un bloc ouvert dans un autre. Rend `{ texte, blocs }`.
 */
export function retirerBlocsAtelier(texte, nom = 'document') {
  const eol = texte.includes('\r\n') ? '\r\n' : '\n'
  const lignes = texte.split(/\r?\n/)
  const gardees = []
  let ouvert = 0
  let blocs = 0
  let apresBloc = false
  lignes.forEach((ligne, i) => {
    if (RE_DEBUT_BLOC.test(ligne)) {
      if (ouvert) throw new ErreurLivraison(`${nom}:${i + 1} : bloc d'atelier ouvert dans un autre (ouvert ligne ${ouvert})`)
      ouvert = i + 1
      return
    }
    if (RE_FIN_BLOC.test(ligne)) {
      if (!ouvert) throw new ErreurLivraison(`${nom}:${i + 1} : fin de bloc d'atelier sans début`)
      ouvert = 0
      blocs++
      apresBloc = true
      return
    }
    if (ouvert) return
    if (apresBloc && ligne.trim() === '' && (gardees.length === 0 || gardees[gardees.length - 1].trim() === '')) {
      apresBloc = false
      return
    }
    apresBloc = false
    gardees.push(ligne)
  })
  if (ouvert) throw new ErreurLivraison(`${nom}:${ouvert} : bloc d'atelier jamais refermé`)
  return { texte: gardees.join(eol), blocs }
}

// ---------- contrôles ----------

/**
 * Contrôle du dossier de sortie, sans rien toucher. `acces` : `existe(chemin)`, `lister(dossier)`, `estDossier(chemin)`,
 * `reel(chemin)` (chemin résolu, liens et jonctions suivis) ; par défaut, le disque. Rend `'neuf'` (absent), `'vide'` ou
 * `'marque'` ; refuse sinon.
 */
export function controlerSortie(sortie, racine, { verifierParents = true, acces = null } = {}) {
  const a = {
    existe: (p) => fs.existsSync(p),
    lister: (p) => fs.readdirSync(p),
    estDossier: (p) => fs.statSync(p).isDirectory(),
    reel: (p) => fs.realpathSync.native(p),
    ...acces,
  }
  if (!path.isAbsolute(sortie)) throw new ErreurLivraison(`dossier de sortie : chemin absolu attendu (${sortie})`)
  // Comparaison sur les chemins réels : une sortie qui passe par une jonction vers le dépôt est dans le dépôt. Le plus
  // proche ancêtre existant est résolu, la suite (pas encore créée) lui est ajoutée telle quelle.
  const resoudre = (p) => {
    let d = p
    const suite = []
    while (!a.existe(d) && path.dirname(d) !== d) {
      suite.unshift(path.basename(d))
      d = path.dirname(d)
    }
    return path.join(a.existe(d) ? a.reel(d) : d, ...suite)
  }
  const dedans = (enfant, parent) => {
    const r = path.relative(parent, enfant)
    return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r))
  }
  const sortieReelle = resoudre(sortie)
  const racineReelle = resoudre(racine)
  if (dedans(sortieReelle, racineReelle)) throw new ErreurLivraison('dossier de sortie dans le dépôt de travail : refusé')
  if (dedans(racineReelle, sortieReelle)) throw new ErreurLivraison('dossier de sortie qui contient le dépôt de travail : refusé')
  if (verifierParents) {
    for (let d = path.dirname(sortie); ; d = path.dirname(d)) {
      if (a.existe(path.join(d, 'node_modules'))) {
        throw new ErreurLivraison(`un dossier parent de la sortie porte un node_modules (${d}) : la vérification du dépôt remis s'en servirait, refusé`)
      }
      if (path.dirname(d) === d) break
    }
  }
  if (!a.existe(sortie)) return 'neuf'
  if (!a.estDossier(sortie)) throw new ErreurLivraison(`dossier de sortie : ${sortie} est un fichier`)
  if (a.lister(sortie).length === 0) return 'vide'
  if (a.existe(path.join(sortie, '.git', MARQUE))) return 'marque'
  throw new ErreurLivraison(`dossier de sortie non vide et sans la marque de l'outil (${sortie}) : rien n'est effacé, choisir un dossier vide`)
}

/** Vrai pour un contenu binaire : un octet nul dans les 8 000 premiers. */
export function estBinaire(octets) {
  return octets.subarray(0, 8000).includes(0)
}

/**
 * Lectures d'un binaire où chercher du texte caché (métadonnées d'une image, archive `.jar`, fichier en UTF-16) : en
 * latin1, octet par octet, et en UTF-16 petit-boutiste, à partir du premier et du deuxième octet.
 */
export function lecturesBinaire(octets) {
  // Toujours un nombre pair d'octets en UTF-16 : un octet seul en fin de tampon a fait tomber Node 26 sans message.
  const pair = (debut) => octets.subarray(debut, debut + ((octets.length - debut) & ~1)).toString('utf16le')
  return [octets.toString('latin1'), pair(0), pair(1)]
}

/**
 * Recherche des motifs dans les fichiers (`[{ chemin, lignes, binaire? }]`, `lignes` nul pour un binaire, `binaire`
 * ses lectures en texte, de `lecturesBinaire`). Un motif : `{ nom, re, dossier?, exemptes?, lignesPermises? }` ;
 * `lignesPermises` retire ses morceaux d'une ligne de son fichier avant la recherche. `binaires` faux : un binaire
 * n'est cherché que par son nom. Rend `[{ nom, trouvailles: [{ chemin, ligne }] }]`, ligne 0 pour un nom de fichier,
 * ligne nulle pour le contenu d'un binaire (sans numéro de ligne).
 */
export function rechercher(fichiers, motifs, { binaires = true } = {}) {
  return motifs.map((m) => {
    const trouvailles = []
    for (const f of fichiers) {
      if (m.dossier && !f.chemin.startsWith(m.dossier)) continue
      if (m.exemptes?.includes(f.chemin)) continue
      if (m.re.test(f.chemin)) trouvailles.push({ chemin: f.chemin, ligne: 0 })
      if (!f.lignes) {
        if (binaires && f.binaire?.some((texte) => m.re.test(texte))) trouvailles.push({ chemin: f.chemin, ligne: null })
        continue
      }
      const permis = (m.lignesPermises ?? []).filter((p) => p.fichier === f.chemin).map((p) => p.motif)
      f.lignes.forEach((ligne, i) => {
        let reste = ligne
        for (const p of permis) reste = reste.replace(p, '')
        if (m.re.test(reste)) trouvailles.push({ chemin: f.chemin, ligne: i + 1 })
      })
    }
    return { nom: m.nom, trouvailles }
  })
}

/**
 * Les trouvailles d'un motif, groupées par fichier : `chemin (n : lignes…)`, `nom de fichier` pour la ligne 0,
 * `contenu binaire` pour une ligne nulle.
 */
export function resumerTrouvailles(trouvailles, max = 12) {
  const parFichier = new Map()
  for (const t of trouvailles) {
    if (!parFichier.has(t.chemin)) parFichier.set(t.chemin, [])
    parFichier.get(t.chemin).push(t.ligne)
  }
  const morceaux = [...parFichier].map(([chemin, lignes]) => {
    const dites = lignes.map((l) => (l === 0 ? 'nom de fichier' : l === null ? 'contenu binaire' : String(l)))
    return `${chemin} (${lignes.length} : ${dites.slice(0, 6).join(', ')}${dites.length > 6 ? ', …' : ''})`
  })
  return morceaux.length > max ? [...morceaux.slice(0, max), `et ${morceaux.length - max} autres fichiers`] : morceaux
}

/** Identité de l'application lue dans `android/app/build.gradle` et `capacitor.config.ts` (null si introuvable). */
export function identiteApplication(gradle, capacitor) {
  return {
    applicationId: /applicationId\s*=?\s*["']([^"']+)["']/.exec(gradle ?? '')?.[1] ?? null,
    namespace: /namespace\s*=?\s*["']([^"']+)["']/.exec(gradle ?? '')?.[1] ?? null,
    appId: /appId\s*:\s*["']([^"']+)["']/.exec(capacitor ?? '')?.[1] ?? null,
  }
}

// ---------- ligne de commande ----------

/** Les options. Rend `{ sortie, aBlanc, verifier }`. */
export function lireArguments(argv) {
  const o = { sortie: null, aBlanc: false, verifier: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--sortie') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new ErreurLivraison('--sortie demande un dossier')
      o.sortie = v
    } else if (a === '--a-blanc') o.aBlanc = true
    else if (a === '--verifier') o.verifier = true
    else throw new ErreurLivraison(`argument inconnu « ${a} » (usage : node outils/livraison.mjs [--sortie <dossier>] [--a-blanc] [--verifier])`)
  }
  if (o.aBlanc && o.verifier) throw new ErreurLivraison('--a-blanc et --verifier s\'excluent')
  return o
}

/** Environnement des commandes git : sans variable qui les détournerait vers un autre dépôt. */
function envGit(plus = {}) {
  const env = { ...process.env, ...plus }
  for (const v of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CEILING_DIRECTORIES']) delete env[v]
  return env
}

// `--no-optional-locks` : un `git status` du dépôt de travail ne réécrit pas son index pendant qu'une autre session
// s'en sert.
function git(cwd, args, { env = {}, buffer = false } = {}) {
  return execFileSync('git', ['--no-optional-locks', '-c', 'core.quotepath=false', ...args], {
    cwd,
    env: envGit(env),
    encoding: buffer ? 'buffer' : 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** Chemins des documents (`.md`) de HEAD qui portent une ligne de marqueur d'atelier. */
function documentsBalises(racine) {
  try {
    const sortie = git(racine, ['grep', '-l', '-z', '-E', '-e', '^[[:space:]]*<!-- /?atelier -->[[:space:]]*$', 'HEAD', '--', '*.md'])
    return sortie.split('\0').filter(Boolean).map((s) => s.replace(/^HEAD:/, ''))
  } catch (e) {
    if (e.status === 1) return [] // aucune trouvaille
    throw e
  }
}

const groupe = (liste, n = 8) => (liste.length > n ? `${liste.slice(0, n).join(', ')}, et ${liste.length - n} autres` : liste.join(', '))

/**
 * Vide un dossier marqué : tout ce qu'il contient, `.git` compris, sauf la marque elle-même, pour qu'un passage
 * interrompu laisse un dossier que le suivant accepte de refaire.
 */
function vider(dossier) {
  const rm = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 })
  for (const nom of fs.readdirSync(dossier)) if (nom !== '.git') rm(path.join(dossier, nom))
  const depot = path.join(dossier, '.git')
  if (fs.existsSync(depot)) for (const nom of fs.readdirSync(depot)) if (nom !== MARQUE) rm(path.join(depot, nom))
}

/** Pose la marque de l'outil dans le `.git` du dossier de sortie, avant tout autre geste d'écriture. */
function marquer(dossier) {
  fs.mkdirSync(path.join(dossier, '.git'), { recursive: true })
  fs.writeFileSync(path.join(dossier, '.git', MARQUE), 'Dépôt fabriqué par l\'outil de livraison.\n')
}

/** Lance une commande npm (un `.cmd` sous Windows) ; rend `{ ok, fin }`, les dernières lignes de sa sortie. */
function npm(commande, cwd) {
  const r = spawnSync(commande, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const fin = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).slice(-12)
  return { ok: r.status === 0, fin }
}

/**
 * Fabrique le dépôt remis depuis `racine`. Rend le code de sortie ; `ecrire` reçoit chaque ligne. `verifierParents`
 * faux saute le contrôle des `node_modules` parents (dépôts d'essai du dossier temporaire) ; `listes` remplace
 * `atelier`, `attendus` ou `scripts` (essais).
 */
export function principal(argv, { racine = process.cwd(), ecrire = console.log, env = process.env, verifierParents = true, listes = {} } = {}) {
  const atelier = listes.atelier ?? ATELIER
  const attendus = listes.attendus ?? ATTENDUS
  const scripts = listes.scripts ?? SCRIPTS_RETIRES
  let vide = null
  try {
    const o = lireArguments(argv)
    const config = lireConfig(cheminConfig(racine, env))
    const brute = o.sortie ?? config.sortie
    if (!brute) throw new ErreurLivraison('aucun dossier de sortie : --sortie <dossier>, ou la rubrique « sortie » de la configuration')
    const sortie = path.resolve(brute)
    const etatSortie = controlerSortie(sortie, path.resolve(racine), { verifierParents })

    const statut = git(racine, ['status', '--porcelain', '-uall']).trim()
    if (statut) ecrire(`Avertissement : arbre de travail modifié (${statut.split('\n').length} chemins) ; seul HEAD est livré.`)

    // Plan.
    const entrees = lireArbre(git(racine, ['ls-tree', '-r', '-z', 'HEAD']))
    const paquetSource = git(racine, ['show', 'HEAD:package.json'])
    const scriptsPresents = retirerScripts(paquetSource, scripts).retires
    const transformes = new Set(documentsBalises(racine).filter((c) => !estAtelier(c, atelier)))
    if (scriptsPresents.length) transformes.add('package.json')
    const plan = planifier(entrees, { atelier, transformes })
    const absentsAttendus = attendus.filter((a) => !plan.reste.some((e) => e.chemin === a))

    ecrire(`Plan : ${entrees.length} fichiers dans HEAD ; ${plan.part.length} partent, ${plan.reste.length} restent, dont ${plan.transforme.length} transformés.`)
    const parEntree = atelier
      .map((a) => [a, plan.part.filter((e) => estAtelier(e.chemin, [a])).length])
      .filter(([, n]) => n > 0)
      .map(([a, n]) => (a.endsWith('/') ? `${a} (${n})` : a))
    ecrire(`  partent : ${parEntree.join(', ')}`)
    if (plan.nonTrouves.length) ecrire(`  atelier absent de HEAD : ${plan.nonTrouves.join(', ')}`)
    ecrire(`  transformés : ${plan.transforme.length ? plan.transforme.map((e) => e.chemin).join(', ') : 'aucun'}${scriptsPresents.length ? ` (scripts retirés : ${scriptsPresents.join(', ')})` : ''}`)
    ecrire(`  attendus absents : ${absentsAttendus.length ? absentsAttendus.join(', ') : 'aucun'}`)
    ecrire(`  sortie : ${sortie} (${{ neuf: 'à créer', vide: 'vide', marque: 'fabriquée par l\'outil, refaite' }[etatSortie]})`)
    if (o.aBlanc) {
      ecrire('À blanc : rien n\'est écrit.')
      return 0
    }

    // Les documents balisés sont relus avant tout geste : un marqueur non refermé refuse la livraison sans rien écrire.
    for (const e of plan.transforme) if (e.chemin !== 'package.json') retirerBlocsAtelier(git(racine, ['show', `HEAD:${e.chemin}`]), e.chemin)

    // Export de l'arbre seul (pas de numéro de commit de la source dans l'archive), fins de ligne selon `.gitattributes`.
    if (etatSortie === 'marque') vider(sortie)
    fs.mkdirSync(sortie, { recursive: true })
    marquer(sortie)
    const archive = git(racine, ['-c', 'core.autocrlf=false', 'archive', '--format=tar', 'HEAD^{tree}'], { buffer: true })
    execFileSync('tar', ['-xf', '-'], { cwd: sortie, input: archive, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
    for (const a of atelier) {
      fs.rmSync(path.join(sortie, a), { recursive: true, force: true, maxRetries: 3 })
      // Les dossiers que ce retrait laisse vides partent aussi (`docs/` quand il ne gardait que l'atelier).
      for (let d = path.dirname(path.join(sortie, a)); d.length > sortie.length && fs.existsSync(d) && fs.readdirSync(d).length === 0; d = path.dirname(d)) fs.rmdirSync(d)
    }

    // Transformations.
    for (const e of plan.transforme) {
      const chemin = path.join(sortie, e.chemin)
      const texte = fs.readFileSync(chemin, 'utf8')
      const neuf = e.chemin === 'package.json' ? retirerScripts(texte, scripts).texte : retirerBlocsAtelier(texte, e.chemin).texte
      fs.writeFileSync(chemin, neuf)
    }

    // Dépôt neuf, un seul commit à l'auteur neutre.
    const { nom, email } = config.auteur
    const identite = { GIT_AUTHOR_NAME: nom, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: nom, GIT_COMMITTER_EMAIL: email }
    // Ni hook ni modèle d'`init` du poste (configuration globale) : un dossier vide tient lieu des deux, pour que rien
    // ne s'exécute ni n'entre dans le `.git` remis.
    vide = fs.mkdtempSync(path.join(os.tmpdir(), 'livraison-vide-'))
    const neutre = ['-c', 'core.autocrlf=false', '-c', `core.hooksPath=${vide}`, '-c', `user.name=${nom}`, '-c', `user.email=${email}`, '-c', 'commit.gpgsign=false']
    git(sortie, [...neutre, 'init', '-q', `--template=${vide}`, '-b', 'main'])
    git(sortie, [...neutre, 'add', '-A'])
    for (const e of plan.reste) if (e.mode === '100755') git(sortie, [...neutre, 'update-index', '--chmod=+x', '--', e.chemin])
    const version = (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(sortie, 'package.json'), 'utf8')).version ?? ''
      } catch {
        return ''
      }
    })()
    const message = config.message ?? `Gtracker${version ? ` ${version}` : ''}`
    git(sortie, [...neutre, 'commit', '-q', '--no-verify', '-m', message], { env: identite })

    // Contrôles.
    const controles = []
    const controle = (nomControle, ok, details = []) => controles.push({ nom: nomControle, ok, details })

    const commits = git(sortie, ['rev-list', '--all', '--count']).trim()
    controle('un seul commit', commits === '1', commits === '1' ? [] : [`${commits} commits`])
    const tags = git(sortie, ['tag']).trim()
    controle('aucune étiquette', tags === '', tags ? [`${tags.split('\n').length} étiquettes`] : [])
    const distants = git(sortie, ['remote']).trim()
    controle('aucun dépôt distant', distants === '', distants ? [`${distants.split('\n').length} dépôts distants`] : [])
    const auteurs = [...new Set(git(sortie, ['log', '--all', '--format=%an%x09%ae%x09%cn%x09%ce']).trim().split('\n'))]
    const attendu = `${nom}\t${email}\t${nom}\t${email}`
    controle('auteur neutre', auteurs.length === 1 && auteurs[0] === attendu, auteurs.length === 1 && auteurs[0] === attendu ? [] : [`${auteurs.length} identités, autres que celle de la configuration`])

    // Arbre : chaque fichier non transformé identique à la source (blob : contenu et fins de ligne ; mode : bit exécutable).
    const livre = new Map(lireArbre(git(sortie, ['ls-tree', '-r', '-z', 'HEAD'])).map((e) => [e.chemin, e]))
    const ecarts = []
    for (const e of plan.reste) {
      const l = livre.get(e.chemin)
      if (!l) ecarts.push(`manquant : ${e.chemin}`)
      else if (l.mode !== e.mode) ecarts.push(`mode ${l.mode} au lieu de ${e.mode} : ${e.chemin}`)
      else if (!transformes.has(e.chemin) && l.blob !== e.blob) ecarts.push(`contenu changé : ${e.chemin}`)
    }
    const gardes = new Set(plan.reste.map((e) => e.chemin))
    for (const c of livre.keys()) if (!gardes.has(c)) ecarts.push(`${estAtelier(c, atelier) ? 'atelier resté' : 'en trop'} : ${c}`)
    controle('arbre identique à la source, atelier retiré', ecarts.length === 0, ecarts.length > 12 ? [...ecarts.slice(0, 12), `et ${ecarts.length - 12} autres`] : ecarts)

    // Recherches, sur le contenu et les noms des fichiers remis.
    const fichiers = git(sortie, ['ls-files', '-z'])
      .split('\0')
      .filter(Boolean)
      .map((chemin) => {
        const octets = fs.readFileSync(path.join(sortie, chemin))
        return estBinaire(octets) ? { chemin, lignes: null, binaire: lecturesBinaire(octets) } : { chemin, lignes: octets.toString('utf8').split('\n') }
      })
    for (const r of rechercher(fichiers, [...config.motifs, ...MOTIFS_BLOQUANTS])) {
      controle(`recherche « ${r.nom} »`, r.trouvailles.length === 0, r.trouvailles.length ? [`${r.trouvailles.length} trouvailles : ${resumerTrouvailles(r.trouvailles).join(' ; ')}`] : [])
    }
    const marqueurs = fichiers.filter((f) => f.chemin.endsWith('.md') && f.lignes?.some((l) => l.trim() === DEBUT_BLOC || l.trim() === FIN_BLOC))
    controle('aucun bloc d\'atelier restant', marqueurs.length === 0, marqueurs.map((f) => f.chemin))

    // Identité de l'application : celle de l'acheteur, jamais une donnée du vendeur.
    const lire = (c) => (fs.existsSync(path.join(sortie, c)) ? fs.readFileSync(path.join(sortie, c), 'utf8') : null)
    const id = identiteApplication(lire('android/app/build.gradle'), lire('capacitor.config.ts'))
    const fautes = Object.entries(id)
      .filter(([, v]) => v === null || config.motifs.some((m) => m.re.test(v)))
      .map(([cle, v]) => (v === null ? `${cle} introuvable` : `${cle} porte une donnée du vendeur`))
    controle('identité de l\'application', fautes.length === 0, fautes)

    const manquants = attendus.filter((a) => !fs.existsSync(path.join(sortie, a)))
    controle('fichiers attendus présents', manquants.length === 0, manquants.map((m) => `absent : ${m}`))

    if (o.verifier) {
      const etapes = [['npm ci', sortie], ['npm ci --ignore-scripts', path.join(sortie, 'bureau')]]
      let ok = true
      const details = []
      for (const [commande, cwd] of etapes) {
        if (!fs.existsSync(path.join(cwd, 'package.json'))) continue
        const r = npm(commande, cwd)
        if (!r.ok) {
          ok = false
          details.push(`${commande} (${path.relative(sortie, cwd) || '.'}) en échec :`, ...r.fin.map((l) => `  ${l}`))
          break
        }
      }
      if (ok) {
        const r = spawnSync(process.execPath, [path.join('outils', 'verif.mjs')], { cwd: sortie, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        ok = r.status === 0
        details.push(...`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/))
      }
      controle('vérification dans le dépôt remis', ok, details)
    }

    // Rapport.
    for (const c of controles) {
      ecrire(`${c.ok ? 'passé' : 'ÉCHEC'} : ${c.nom}`)
      for (const d of c.ok && c.nom.startsWith('vérification') ? c.details : c.ok ? [] : c.details) ecrire(`  ${d}`)
    }
    for (const r of rechercher(fichiers, AVERTISSEMENTS, { binaires: false })) {
      if (r.trouvailles.length) ecrire(`avertissement « ${r.nom} » : ${r.trouvailles.length} dans ${new Set(r.trouvailles.map((t) => t.chemin)).size} fichiers : ${groupe([...new Set(r.trouvailles.map((t) => t.chemin))])}`)
    }
    const echecs = controles.filter((c) => !c.ok)
    if (echecs.length) {
      ecrire(`Non livrable : ${echecs.length} contrôle${echecs.length > 1 ? 's' : ''} en échec ; le dossier reste pour examen (${sortie}).`)
      return 1
    }
    ecrire(`Livrable : ${sortie}`)
    return 0
  } catch (e) {
    if (e instanceof ErreurLivraison) {
      ecrire(`Livraison refusée : ${e.message}`)
      return 2
    }
    const detail = e.stderr ? String(e.stderr).trim() : e.message
    ecrire(`Livraison interrompue : ${detail.slice(0, 600)}`)
    return 2
  } finally {
    if (vide) fs.rmSync(vide, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = principal(process.argv.slice(2), { racine: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') })
}
