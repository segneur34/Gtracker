// Fin de lot : les gestes mécaniques que l'orchestrateur faisait à la main, en une commande, depuis la racine du dépôt.
//
//   node outils/fin-de-lot.mjs <N> --message <fichier> [--essais <fichier>] [--lecture] [--en-cours] [--a-blanc]
//
//   <N>                 numéro de l'élément, dont la ligne est dans Maintenant, état « en cours »
//   --message <fichier> message du commit (UTF-8), commité tel quel par `git commit -F`
//   --essais <fichier>  un essai par ligne, « quoi → attendu » : numérotés à partir de « Prochains numéros »,
//                       posés en sous-lignes de la ligne du lot ; l'en-tête est mis à jour
//   --lecture           rien à essayer au téléphone : état « à valider sur lecture » (obligatoire sans --essais,
//                       interdit avec)
//   --en-cours          lot coupé en parties : l'état reste « en cours »
//   --a-blanc           dit ce qui serait fait, n'écrit rien
//
// Version : si `git status` montre un changement sous `src/` ou `android/`, le troisième nombre de la version de
// `package.json` (et de `package-lock.json`, s'il la porte) augmente de un, sur deux chiffres. Puis `git add -A` et
// `git commit -F` sur tout l'arbre. La forme du reste à faire est contrôlée par `outils/backlog.mjs` avant toute
// écriture : une erreur de forme arrête tout, rien n'est touché. Sans dépendance.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { lireBacklog } from './backlog.mjs'

const SEP = ' · '
const RE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/
const RE_PROCHAINS = /Prochains numéros : élément (\d+), essai (\d+), question Q(\d+)/

/** Erreur d'usage ou de contenu : son message s'imprime tel quel, rien n'a été touché. */
export class ErreurFinDeLot extends Error {}

function jjmm(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** `0.00.66` devient `0.00.67` : le troisième nombre augmente de un, sur deux chiffres au moins. */
export function versionSuivante(version) {
  const m = RE_VERSION.exec(version.trim())
  if (!m) throw new ErreurFinDeLot(`version illisible « ${version} » (trois nombres séparés par des points)`)
  return `${m[1]}.${m[2]}.${String(Number(m[3]) + 1).padStart(2, '0')}`
}

/** Chemins d'une sortie de `git status --porcelain` (les deux côtés d'un renommage, guillemets retirés). */
export function cheminsDuStatut(porcelain) {
  const chemins = []
  for (const ligne of porcelain.split(/\r?\n/)) {
    if (ligne.length < 4) continue
    for (const morceau of ligne.slice(3).split(' -> ')) chemins.push(morceau.replace(/^"|"$/g, ''))
  }
  return chemins
}

/** Vrai si un fichier de l'application ou de l'APK a changé (`src/` ou `android/`) : la version doit augmenter. */
export function codeAChange(porcelain) {
  return cheminsDuStatut(porcelain).some((c) => c.startsWith('src/') || c.startsWith('android/'))
}

/** Version lue en tête de `package.json` (le premier `"version"`). */
export function versionDuPackage(texte) {
  const m = /"version":\s*"([^"]+)"/.exec(texte)
  if (!m) throw new ErreurFinDeLot('package.json : pas de champ « version »')
  return m[1]
}

/** `package.json` avec la version remplacée, le reste au caractère près. */
export function poserVersionPackage(texte, ancienne, nouvelle) {
  const re = new RegExp(`("version":\\s*")${ancienne.replace(/\./g, '\\.')}(")`)
  if (!re.test(texte)) throw new ErreurFinDeLot(`package.json : version ${ancienne} introuvable`)
  return texte.replace(re, `$1${nouvelle}$2`)
}

/**
 * `package-lock.json` avec la version de tête et celle du paquet racine remplacées, si elles valent `ancienne` ;
 * sinon le texte est rendu tel quel (`change` faux).
 */
export function poserVersionLock(texte, ancienne, nouvelle) {
  const ancien = ancienne.replace(/\./g, '\\.')
  const tete = new RegExp(`^(\\s*\\{\\s*"name":\\s*"[^"]*",\\s*"version":\\s*")${ancien}(")`)
  const racine = new RegExp(`("packages":\\s*\\{\\s*"":\\s*\\{\\s*"name":\\s*"[^"]*",\\s*"version":\\s*")${ancien}(")`)
  if (!tete.test(texte) || !racine.test(texte)) return { texte, change: false }
  return { texte: texte.replace(tete, `$1${nouvelle}$2`).replace(racine, `$1${nouvelle}$2`), change: true }
}

/** Les essais d'un fichier : une ligne « quoi → attendu » chacune, lignes vides ignorées. */
export function lireEssais(texte) {
  const essais = []
  texte.split(/\r?\n/).forEach((brut, i) => {
    const ligne = brut.trim()
    if (!ligne) return
    const sans = ligne.replace(/^-\s+/, '') // une puce de liste éventuelle
    const cut = sans.indexOf(' → ')
    const quoi = cut < 0 ? '' : sans.slice(0, cut).trim()
    const attendu = cut < 0 ? '' : sans.slice(cut + 3).trim()
    if (!quoi || !attendu) throw new ErreurFinDeLot(`fichier d'essais, ligne ${i + 1} : « quoi → attendu » attendu (« ${ligne} »)`)
    essais.push({ quoi, attendu })
  })
  return essais
}

/** Nouvel état de la ligne du lot. Il cite la version si elle a changé, sinon la date du jour (`jj/mm`). */
export function etatFinal({ version, aujourdhui, lecture, enCours }) {
  if (enCours) return null // l'état ne change pas
  const repere = version ?? jjmm(aujourdhui)
  const precision = version ? `version ${version}` : repere
  return `${lecture ? 'à valider sur lecture' : 'à valider'} (commit en cours, ${precision})`
}

/**
 * Applique la fin de lot au texte du reste à faire : état de la ligne, essais en sous-lignes, en-tête « Prochains
 * numéros ». Pur. `opts` : `numero`, `version` (la nouvelle, ou null si inchangée), `aujourdhui`, `lecture`,
 * `enCours`, `essais` (`[{ quoi, attendu }]`). Rend `{ texte, etat, ligne, essais: [{ numero, quoi, attendu }] }`.
 */
export function appliquerFinDeLot(texte, opts) {
  const { numero, version = null, aujourdhui, lecture = false, enCours = false, essais = [] } = opts
  if (lecture && enCours) throw new ErreurFinDeLot('--lecture et --en-cours s\'excluent : un lot coupé en parties reste « en cours »')
  if (lecture && essais.length) throw new ErreurFinDeLot('--lecture et --essais s\'excluent : sur lecture, il n\'y a rien à essayer au téléphone')
  if (!lecture && !enCours && !essais.length) throw new ErreurFinDeLot('sans --essais, il faut --lecture (rien à essayer) ou --en-cours (lot coupé en parties)')

  const r = lireBacklog(texte, aujourdhui)
  const element = r.maintenant.find((e) => e.numero === numero)
  if (!element) {
    const ailleurs = [...r.ensuite, ...r.occasion.flatMap((c) => c.elements), ...r.plusTard].find((e) => e.numero === numero)
    throw new ErreurFinDeLot(ailleurs
      ? `l'élément ${numero} n'est pas dans Maintenant (il est en ${ailleurs.zone === 'ensuite' ? 'Ensuite' : ailleurs.zone === 'plusTard' ? 'Plus tard' : 'attente d\'une occasion'})`
      : `l'élément ${numero} est introuvable dans le reste à faire`)
  }
  if (!/^en cours/.test(element.etat ?? '')) {
    throw new ErreurFinDeLot(`l'élément ${numero} n'est pas « en cours » (état : ${element.etat ?? 'aucun'})`)
  }
  if (!r.prochains) throw new ErreurFinDeLot('« Prochains numéros » est introuvable dans l\'en-tête du reste à faire')

  const eol = texte.includes('\r\n') ? '\r\n' : '\n'
  const lignes = texte.split(/\r?\n/)

  // État : le morceau de la ligne qui est l'état, remplacé ; le reste de la ligne ne bouge pas.
  const etat = etatFinal({ version, aujourdhui, lecture, enCours })
  let ligneLot = lignes[element.ligne - 1]
  if (etat) {
    const morceaux = ligneLot.split(SEP)
    const rang = morceaux.findIndex((m, i) => i >= 2 && m.trim() === element.etat)
    if (rang < 0) throw new ErreurFinDeLot(`la ligne du lot ${numero} : état introuvable pour le remplacer`)
    morceaux[rang] = etat
    ligneLot = morceaux.join(SEP)
  }

  // Essais : numérotés à la suite, posés après la ligne du lot et ses essais déjà là.
  const numerotes = essais.map((e, i) => ({ numero: r.prochains.essai + i, quoi: e.quoi, attendu: e.attendu }))
  const dernier = Math.max(element.ligne, ...element.essais.map((e) => e.ligne))
  const sousLignes = numerotes.map((e) => `  - essai ${e.numero} : ${e.quoi} → ${e.attendu}`)

  const sortie = [...lignes.slice(0, element.ligne - 1), ligneLot, ...lignes.slice(element.ligne, dernier), ...sousLignes, ...lignes.slice(dernier)]
  let nouveau = sortie.join(eol)
  if (numerotes.length) {
    nouveau = nouveau.replace(RE_PROCHAINS, `Prochains numéros : élément ${r.prochains.element}, essai ${r.prochains.essai + numerotes.length}, question Q${r.prochains.question}`)
  }
  return { texte: nouveau, etat: etat ?? element.etat, ligne: ligneLot, essais: numerotes }
}

/** Les options de la ligne de commande. Rend `{ numero, message, essais, lecture, enCours, aBlanc }`. */
export function lireArguments(argv) {
  const o = { numero: null, message: null, essais: null, lecture: false, enCours: false, aBlanc: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--message' || a === '--essais') {
      const valeur = argv[++i]
      if (!valeur || valeur.startsWith('--')) throw new ErreurFinDeLot(`${a} demande un fichier`)
      o[a.slice(2)] = valeur
    } else if (a === '--lecture') o.lecture = true
    else if (a === '--en-cours') o.enCours = true
    else if (a === '--a-blanc') o.aBlanc = true
    else if (/^\d+$/.test(a) && o.numero === null) o.numero = Number(a)
    else throw new ErreurFinDeLot(`argument inconnu « ${a} »`)
  }
  if (o.numero === null) throw new ErreurFinDeLot('usage : node outils/fin-de-lot.mjs <N> --message <fichier> [--essais <fichier>] [--lecture] [--en-cours] [--a-blanc]')
  if (!o.message) throw new ErreurFinDeLot('--message <fichier> est obligatoire')
  return o
}

function git(racine, args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function coupe(texte, n) {
  return texte.length > n ? `${texte.slice(0, n - 1)}…` : texte
}

/**
 * Lance la fin de lot depuis `racine`. Rend le code de sortie ; `ecrire` reçoit chaque ligne de sortie (cinq au plus).
 * Une erreur d'usage ou de forme s'imprime en une ligne, sans rien toucher.
 */
export function principal(argv, { racine = process.cwd(), aujourdhui = new Date(), ecrire = console.log } = {}) {
  const fichiers = []
  try {
    const o = lireArguments(argv)
    const cheminBacklog = join(racine, 'docs', 'BACKLOG.md')
    const cheminPackage = join(racine, 'package.json')
    const cheminLock = join(racine, 'package-lock.json')
    const lire = (chemin, quoi) => {
      try {
        return readFileSync(chemin, 'utf8')
      } catch (e) {
        throw new ErreurFinDeLot(`${quoi} illisible (${chemin}) : ${e.message}`)
      }
    }
    const message = lire(resolve(o.message), 'fichier de message')
    if (!message.trim()) throw new ErreurFinDeLot('le fichier de message est vide')
    const essais = o.essais ? lireEssais(lire(resolve(o.essais), 'fichier d\'essais')) : []
    if (o.essais && !essais.length) throw new ErreurFinDeLot('le fichier d\'essais est vide')

    const backlog = lire(cheminBacklog, 'reste à faire')
    const paquet = lire(cheminPackage, 'package.json')
    let lock = null
    try {
      lock = readFileSync(cheminLock, 'utf8')
    } catch {
      lock = null // pas de verrou : rien à suivre
    }

    const statut = git(racine, ['status', '--porcelain', '-uall'])
    const ancienne = versionDuPackage(paquet)
    const bouge = codeAChange(statut)
    const nouvelle = bouge ? versionSuivante(ancienne) : null

    const res = appliquerFinDeLot(backlog, { numero: o.numero, version: nouvelle, aujourdhui, lecture: o.lecture, enCours: o.enCours, essais })

    // Contrôle de forme avant toute écriture : une erreur arrête tout.
    const erreurs = lireBacklog(res.texte, aujourdhui).erreurs
    if (erreurs.length) {
      const dites = erreurs.slice(0, 3).map((e) => `${e.ligne ? `ligne ${e.ligne} : ` : ''}${e.message}`)
      throw new ErreurFinDeLot(`le reste à faire sortirait mal formé, rien n'est touché : ${dites.join(' ; ')}`)
    }

    const nouveauPaquet = nouvelle ? poserVersionPackage(paquet, ancienne, nouvelle) : paquet
    const verrou = nouvelle && lock ? poserVersionLock(lock, ancienne, nouvelle) : { texte: lock, change: false }

    const lignes = [
      nouvelle ? `Version : ${ancienne} → ${nouvelle}${verrou.change ? '' : ' (package-lock.json non suivi : autre version en tête)'}` : `Version : inchangée (${ancienne})`,
    ]
    const sortieEssais = res.essais.length ? `Essais : ${res.essais.map((e) => e.numero).join(', ')}` : 'Essais : aucun'

    if (o.aBlanc) {
      const posés = new Set(cheminsDuStatut(statut))
      posés.add('docs/BACKLOG.md')
      if (nouvelle) posés.add('package.json')
      if (verrou.change) posés.add('package-lock.json')
      const liste = [...posés]
      lignes.push(`État : lot ${o.numero} → ${res.etat}`)
      lignes.push(sortieEssais + (res.essais.length ? ` (prochain : ${res.essais.at(-1).numero + 1})` : ''))
      lignes.push(`Au commit (${liste.length} fichiers) : ${liste.slice(0, 6).join(', ')}${liste.length > 6 ? ', …' : ''}`)
      lignes.push('À blanc : rien n\'est écrit ni commité.')
      for (const l of lignes) ecrire(l)
      return 0
    }

    // Écriture, puis commit ; si le commit échoue, les fichiers retrouvent leur état d'avant.
    const avant = [[cheminBacklog, backlog]]
    writeFileSync(cheminBacklog, res.texte)
    fichiers.push(...avant)
    if (nouvelle) {
      fichiers.push([cheminPackage, paquet])
      writeFileSync(cheminPackage, nouveauPaquet)
      if (verrou.change) {
        fichiers.push([cheminLock, lock])
        writeFileSync(cheminLock, verrou.texte)
      }
    }
    git(racine, ['add', '-A'])
    git(racine, ['commit', '-F', resolve(o.message)])
    const court = git(racine, ['rev-parse', '--short', 'HEAD']).trim()
    lignes.push(`Commit : ${court}`, sortieEssais, `État : lot ${o.numero} → ${res.etat}`)
    for (const l of lignes) ecrire(l)
    return 0
  } catch (e) {
    for (const [chemin, contenu] of fichiers) writeFileSync(chemin, contenu) // retour à l'état d'avant
    if (e instanceof ErreurFinDeLot) {
      ecrire(`Fin de lot refusée : ${e.message}`)
    } else {
      const detail = e.stderr ? String(e.stderr).trim() : e.message
      ecrire(`Fin de lot interrompue${fichiers.length ? ' (fichiers remis dans leur état d\'avant)' : ''} : ${coupe(detail, 400)}`)
    }
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = principal(process.argv.slice(2))
}
