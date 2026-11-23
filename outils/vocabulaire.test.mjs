import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { commentaires, lignesHorsAtelier, lireAtelier, motsAtelier, renvois } from './vocabulaire.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
// Les textes d'essai s'écrivent en deux morceaux : écrits d'un seul tenant, ils seraient eux-mêmes des renvois.
const LOT = 'lot ' + '123'
const POINT = 'point ' + '185'

const trouves = (texte, options) => renvois(lignesHorsAtelier(texte), options).map((r) => `${r.ligne} ${r.nom} ${r.trouve}`)

describe('documents remis : renvois d\'atelier', () => {
  it('refuse un numéro de lot, de point, d\'élément ou d\'essai, avec sa ligne', () => {
    const texte = ['Titre', `Voir le ${LOT}.`, `Comme au ${POINT}, et aux ${'points ' + '12 et 13'}.`, 'L\'' + 'élément ' + '7 et l\'' + 'essai ' + '4.', 'Lots ' + '8 et 9']
    expect(trouves(texte.join('\n'))).toEqual([
      `2 lot N ${LOT}`,
      `3 point N ${POINT}`,
      '4 élément N élément 7',
      '4 essai N essai 4',
      '5 lot N Lots ' + '8',
    ])
  })

  it('laisse les faux amis : un lot sans numéro, un point d\'une trace, un nombre devant', () => {
    for (const texte of ['par lots de 32 paquets', '5 points par seconde', 'le point ' + '5 de la trace', 'un pilot 12', 'les points A et B', 'diplôme 2025']) {
      expect(trouves(texte), texte).toEqual([])
    }
  })

  it('ignore les blocs d\'atelier, marques comprises', () => {
    const texte = ['avant', '<!-- atelier -->', `dedans, ${LOT}`, '<!-- /atelier -->', `après, ${LOT}`].join('\n')
    expect(lignesHorsAtelier(texte).map((l) => l.ligne)).toEqual([1, 5])
    expect(trouves(texte)).toEqual([`5 lot N ${LOT}`])
  })

  it('refuse les mots de l\'atelier, en mot entier et à la casse exacte', () => {
    const mots = ['JOURNAL', 'Assistant']
    expect(trouves('lire JOURNAL.md\nl\'Assistant écrit\nun journal, des assistants, JOURNAUX', { mots })).toEqual(['1 JOURNAL JOURNAL', '2 Assistant Assistant'])
  })

  it('un faux ami nommé est retiré de sa ligne avant la recherche', () => {
    const fauxAmis = [{ texte: 'norme ' + LOT, raison: 'essai' }]
    expect(trouves(`la norme ${LOT}`, { fauxAmis })).toEqual([])
    expect(trouves(`le ${LOT}`, { fauxAmis })).toEqual([`1 lot N ${LOT}`])
  })
})

describe('configuration de l\'atelier', () => {
  it('absente (dépôt remis) : aucun document ni mot de plus', () => {
    const vide = fs.mkdtempSync(path.join(os.tmpdir(), 'vocabulaire-'))
    try {
      expect(lireAtelier(vide)).toBeNull()
      expect(motsAtelier(null)).toEqual([])
    } finally {
      fs.rmSync(vide, { recursive: true, force: true })
    }
  })

  it('présente : le nom de chaque document et du journal, sans dossier ni extension, et l\'assistant', () => {
    expect(motsAtelier({ documents: ['A.md', 'docs/B.md'], journal: 'docs/C.md', sansNoms: [], assistant: 'D' })).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('commentaires d\'un fichier de code', () => {
  it('lit les commentaires de ligne, de bloc et de fin de ligne, pas les chaînes', () => {
    const texte = [
      '// tête',
      'const a = 1 // fin de ligne',
      "const b = 'http://x'",
      '/**',
      ' * dedans',
      ' */',
      '/* seul */ const c = 2',
      'const d = 3',
    ].join('\n')
    expect(commentaires(texte)).toEqual([
      { ligne: 1, texte: '// tête' },
      { ligne: 2, texte: '// fin de ligne' },
      { ligne: 4, texte: '/**' },
      { ligne: 5, texte: ' * dedans' },
      { ligne: 6, texte: ' */' },
      { ligne: 7, texte: '/* seul */ const c = 2' },
    ])
  })

  it('un renvoi dans un commentaire est trouvé, pas dans le code', () => {
    const texte = [`// corrigé au ${LOT}`, `const s = '${LOT}'`, `x() // ${POINT}`].join('\n')
    expect(renvois(commentaires(texte)).map((r) => `${r.ligne} ${r.nom}`)).toEqual(['1 lot N', '3 point N'])
  })
})

// Les fichiers d'atelier, qui ne partent pas avec le dépôt remis, parlent de lots à bon droit : la liste vient de l'outil
// de livraison, qui est lui-même de l'atelier (absent du dépôt remis, où ces fichiers manquent aussi).
const LIVRAISON = path.join(RACINE, 'outils', 'livraison.mjs')
const { ATELIER, estAtelier } = fs.existsSync(LIVRAISON) ? await import('./livraison.mjs') : { ATELIER: [], estAtelier: () => false }
const IGNORES = new Set(['node_modules', '.git', 'build', 'dist', 'sortie'])
const codeDe = (dossier) => {
  const sortie = []
  const parcourir = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (IGNORES.has(e.name)) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) parcourir(p)
      else if (/\.(mjs|cjs|js|ts|tsx)$/.test(e.name)) sortie.push(path.relative(RACINE, p).split(path.sep).join('/'))
    }
  }
  parcourir(path.join(RACINE, dossier))
  return sortie
}

describe('aucun renvoi d\'atelier dans les commentaires d\'outils/ et de bureau/', () => {
  it('hors des fichiers de l\'atelier ; les dates seules restent permises', () => {
    const mots = motsAtelier(lireAtelier(RACINE))
    const fichiers = [...codeDe('outils'), ...codeDe('bureau')].filter((f) => !estAtelier(f, ATELIER))
    expect(fichiers.length).toBeGreaterThan(20)
    const trouves = fichiers.flatMap((f) =>
      renvois(commentaires(fs.readFileSync(path.join(RACINE, f), 'utf8')), { mots }).map((r) => `${f}:${r.ligne}  ${r.trouve}`),
    )
    expect(trouves).toEqual([])
  })
})
