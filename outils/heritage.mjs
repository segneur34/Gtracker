// Cliquet du vocabulaire de la terre (course, vélo, Entraînement) dans src/, et motifs refusés en dur (lot 327).
//
//   node outils/heritage.mjs            tableau motif → fichiers → nombre, et motifs durs trouvés
//   node outils/heritage.mjs --figer    réécrit outils/heritage.json avec les nombres d'aujourd'hui
//
// Le test `src/landWords.test.ts` lit ce module : il refuse qu'un fichier dépasse son nombre figé et qu'un fichier
// absent du relevé ait une occurrence, et il refuse en dur les motifs DURS. Tous les .ts, .tsx et .css de `src/` sont lus,
// commentaires et tests compris, sauf `src/landWords.test.ts` (il nomme ces motifs). Un faux ami se traite par une
// exception nommée ici (EXCLUS), jamais en élargissant un motif en silence. Sans dépendance.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const FICHIER_RELEVE = path.join(racine, 'outils', 'heritage.json')

/** Fichiers hors compte (chemins depuis la racine). */
export const EXCLUS = ['src/landWords.test.ts']

/** Motifs à cliquet : le nombre d'occurrences par fichier ne remonte pas ; un motif à zéro passe en DURS. */
export const CLIQUET = {
  "'running'": /'running'/g,
  "'cycling'": /'cycling'/g,
  'land[A-Z]…': /\b[lL]and[A-Z]\w+/g,
  'fractionné, musculation, Entraînement': /[Ff]ractionn|[Mm]uscu|Entraînement/g,
  'à pied': /à pied|À pied/g,
  'vélo': /[Vv]élo/g,
  'Gravel, VTT': /Gravel|VTT/g,
  'runner': /runner|Runner|RUNNER/g,
  'segneur34': /segneur34/g,
}

/** Motifs refusés en dur : aucune occurrence tolérée dans src/. */
export const DURS = {
  'chemin du poste (C:\\Users)': /C:\\Users/g,
  'plans de Claude': /\.claude\/plans/g,
  'dossier du poste (D:\\gong)': /D:\\gong/g,
  // Écrit en deux morceaux : la garde du nom de l'ancien projet (heritage.test.ts) lit aussi ce fichier.
  'chemin du poste (segne, plans)': new RegExp('/Users[\\\\/]+segne[\\\\/]+' + 'track' + 'er|~/\\.claude/plans', 'gi'),
  'allure (min/km)': /min\/km/g,
}

function fichiers(dossier) {
  const rendu = []
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, entree.name)
    if (entree.isDirectory()) rendu.push(...fichiers(chemin))
    else if (/\.(ts|tsx|css)$/.test(entree.name)) rendu.push(chemin)
  }
  return rendu
}

/** Pour chaque motif de `motifs` : { fichier (depuis la racine, avec des `/`) → nombre d'occurrences }, fichiers à zéro omis. */
export function compter(motifs) {
  const rendu = Object.fromEntries(Object.keys(motifs).map((nom) => [nom, {}]))
  for (const chemin of fichiers(path.join(racine, 'src'))) {
    const relatif = path.relative(racine, chemin).split(path.sep).join('/')
    if (EXCLUS.includes(relatif)) continue
    const texte = fs.readFileSync(chemin, 'utf8')
    for (const [nom, re] of Object.entries(motifs)) {
      const n = (texte.match(re) ?? []).length
      if (n > 0) rendu[nom][relatif] = n
    }
  }
  for (const nom of Object.keys(rendu)) rendu[nom] = Object.fromEntries(Object.entries(rendu[nom]).sort(([a], [b]) => a.localeCompare(b)))
  return rendu
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const releve = compter(CLIQUET)
  const total = (m) => Object.values(m).reduce((a, b) => a + b, 0)
  if (process.argv.includes('--figer')) {
    fs.writeFileSync(FICHIER_RELEVE, JSON.stringify(releve, null, 2) + '\n')
    for (const [nom, m] of Object.entries(releve)) console.log(`${String(total(m)).padStart(4)} dans ${String(Object.keys(m).length).padStart(2)} fichiers  ${nom}`)
    console.log('Relevé figé (outils/heritage.json).')
  } else {
    for (const [nom, m] of Object.entries(releve)) {
      console.log(`${String(total(m)).padStart(4)} dans ${String(Object.keys(m).length).padStart(2)} fichiers  ${nom}`)
    }
    for (const [nom, m] of Object.entries(compter(DURS))) if (total(m) > 0) console.log(`DUR ${nom} : ${Object.keys(m).join(', ')}`)
  }
}
