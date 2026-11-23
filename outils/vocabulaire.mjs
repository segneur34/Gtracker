// Vocabulaire d'atelier : les renvois qui ne mènent nulle part hors du dépôt de travail. Un numéro de lot, de point,
// d'élément ou d'essai renvoie au suivi du projet ; le nom d'un document de l'atelier renvoie à un fichier qui ne part
// pas avec le dépôt remis. Lu par `docs-cites.mjs` (documents remis, hors blocs d'atelier) et par la garde des
// commentaires d'`outils/` et de `bureau/` (`vocabulaire.test.mjs`). Sans dépendance.
//
// Les noms des documents de l'atelier ne s'écrivent pas ici, ils partiraient avec le dépôt remis : ils viennent du
// fichier `docs-atelier.json`, à côté de celui-ci, qui reste dans l'atelier. Sans lui (dépôt remis), seuls les renvois
// numérotés sont cherchés.

import fs from 'node:fs'
import path from 'node:path'

/** Fichier de l'atelier qui nomme ses documents, relatif à la racine du dépôt. */
export const FICHIER_ATELIER = 'outils/docs-atelier.json'

/** Renvois numérotés refusés. Un renvoi à un point a deux ou trois chiffres : avec un seul, c'est un point d'une trace. */
export const RENVOIS = [
  { nom: 'lot N', re: /(?<![\p{L}\d])[Ll]ots? \d+/u },
  { nom: 'point N', re: /(?<![\p{L}\d])[Pp]oints? \d{2,3}(?!\d)/u },
  { nom: 'élément N', re: /(?<![\p{L}\d])[ÉéEe]l[ée]ments? \d+/u },
  { nom: 'essai N', re: /(?<![\p{L}\d])[Ee]ssais? \d+/u },
]

/**
 * Faux amis des documents : un morceau de texte retiré de sa ligne avant la recherche, avec sa raison. La liste reste
 * courte ; une entrée qui ne sert plus se retire.
 */
export const FAUX_AMIS = []

/**
 * Configuration de l'atelier (`FICHIER_ATELIER`), ou null quand le fichier manque. `documents` : documents de l'atelier ;
 * `journal` : le journal, dont les points cités doivent exister ; `sansNoms` : documents dont seuls les chemins cités
 * sont vérifiés ; `assistant` : le nom de l'assistant de code.
 */
export function lireAtelier(racine) {
  const chemin = path.join(racine, FICHIER_ATELIER)
  if (!fs.existsSync(chemin)) return null
  const c = JSON.parse(fs.readFileSync(chemin, 'utf8'))
  return { documents: c.documents ?? [], journal: c.journal ?? null, sansNoms: c.sansNoms ?? [], assistant: c.assistant ?? null }
}

/** Mots refusés tirés de la configuration : le nom de chaque document (sans dossier ni extension) et l'assistant. */
export function motsAtelier(atelier) {
  if (!atelier) return []
  const noms = [...atelier.documents, ...(atelier.journal ? [atelier.journal] : [])].map((d) => path.basename(d).replace(/\.\w+$/, ''))
  return [...new Set([...noms, ...(atelier.assistant ? [atelier.assistant] : [])])]
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Les motifs à chercher : les renvois numérotés, puis un motif par mot de l'atelier (casse exacte, mot entier). */
export function motifs(mots = []) {
  return [...RENVOIS, ...mots.map((m) => ({ nom: m, re: new RegExp(`(?<![\\p{L}\\d_])${echapper(m)}(?![\\p{L}\\d_])`, 'u') }))]
}

/**
 * Lignes d'un document hors de ses blocs d'atelier (une ligne `<!-- atelier -->` seule, jusqu'à une ligne
 * `<!-- /atelier -->` seule, marques comprises) : `[{ ligne, texte }]`, lignes numérotées depuis 1.
 */
export function lignesHorsAtelier(texte) {
  const sortie = []
  let dedans = false
  texte.split('\n').forEach((t, i) => {
    if (/^\s*<!-- atelier -->\s*$/.test(t)) dedans = true
    else if (/^\s*<!-- \/atelier -->\s*$/.test(t)) dedans = false
    else if (!dedans) sortie.push({ ligne: i + 1, texte: t })
  })
  return sortie
}

/**
 * Commentaires d'un fichier de code (`//`, `/* … *\/`) : `[{ ligne, texte }]`, le seul commentaire de chaque ligne. Lecture
 * par lignes, sans analyse du code : un commentaire commence une ligne, ou suit le code après « // » entouré d'espaces.
 */
export function commentaires(texte) {
  const sortie = []
  let bloc = false
  texte.split('\n').forEach((t, i) => {
    const d = t.trimStart()
    if (bloc) {
      sortie.push({ ligne: i + 1, texte: t })
      if (t.includes('*/')) bloc = false
    } else if (d.startsWith('/*')) {
      sortie.push({ ligne: i + 1, texte: t })
      if (!d.slice(2).includes('*/')) bloc = true
    } else if (d.startsWith('//')) {
      sortie.push({ ligne: i + 1, texte: t })
    } else {
      const k = t.indexOf(' // ')
      if (k >= 0) sortie.push({ ligne: i + 1, texte: t.slice(k + 1) })
    }
  })
  return sortie
}

/**
 * Renvois trouvés dans des lignes (`[{ ligne, texte }]`) : `[{ ligne, nom, trouve }]`. `fauxAmis` : morceaux retirés de
 * chaque ligne avant la recherche (`[{ texte, raison }]`).
 */
export function renvois(lignes, { mots = [], fauxAmis = FAUX_AMIS } = {}) {
  const liste = motifs(mots)
  const trouves = []
  for (const { ligne, texte } of lignes) {
    let reste = texte
    for (const f of fauxAmis) reste = reste.split(f.texte).join('')
    for (const m of liste) {
      const r = m.re.exec(reste)
      if (r) trouves.push({ ligne, nom: m.nom, trouve: r[0] })
    }
  }
  return trouves
}
