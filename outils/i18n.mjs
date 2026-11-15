// Garde des traductions : les clés de `t(`, `tn(`, `tRich(` et `tnRich(` dans `src/`, contre les dictionnaires anglais et espagnol.
//
//   node outils/i18n.mjs                  bilan : clés, et par langue traduites, manquantes, erreurs
//   node outils/i18n.mjs --manquantes en  liste les clés sans traduction anglaise (ou es)
//
// Le texte français est la clé (`src/core/i18n.ts`). Une clé est toujours un littéral : un premier argument de `t(` ou
// de `tRich(`, une des deux phrases de `tn(` ou de `tnRich(`, qui n'est pas une chaîne seule est refusé, comme un contexte (`ctx`) non
// littéral. Une entrée de dictionnaire avec contexte s'écrit « texte||contexte » (`MARQUE_CONTEXTE`).
//
// Contrôles des dictionnaires (`src/locales/en.json`, `es.json`) : traduction orpheline (clé absente du code), variable
// `{nom}` ou balise `<b>` absente ou en trop, mot refusé par la garde du nom (`src/heritage.test.ts`). Les clés sans
// traduction sont listées et comptées ; elles ne font échouer que quand le chantier est déclaré clos (`TRADUCTION_CLOSE`).
//
// Lecteur de jetons maison (TypeScript 7 n'expose pas d'analyseur en JavaScript) : chaînes des trois formes, gabarits
// et leurs `${}`, commentaires, expressions régulières, et JSX dans les .tsx (texte, attributs, `{}`). Sans dépendance.
// Code de sortie 1 si une erreur est trouvée. Le test `src/i18nGuard.test.ts` lit ce module.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Passe à `true` quand toutes les clés sont traduites : une clé sans traduction devient alors une erreur. */
export const TRADUCTION_CLOSE = false

/** Marque entre texte et contexte, la même que `CONTEXT_MARK` de `src/core/i18n.ts`. */
export const MARQUE_CONTEXTE = '||'

/** Langues traduites, et leur dictionnaire. */
export const LANGUES = ['en', 'es']
export const DOSSIER_DICTIONNAIRES = 'src/locales'
export const cheminDictionnaire = (langue) => path.join(racine, DOSSIER_DICTIONNAIRES, `${langue}.json`)

/** Fonctions dont l'argument est une clé. */
const NOMS = new Set(['t', 'tn', 'tRich', 'tnRich'])

/** Celles qui accordent au nombre : le nombre, puis deux phrases (arguments 2 et 3), puis les variables (argument 4). */
const ACCORDEES = new Set(['tn', 'tnRich'])

/** Fichiers qui définissent ces fonctions : leurs appels internes portent une clé variable. */
const DEFINITIONS = ['src/core/i18n.ts', 'src/components/tRich.ts']

/** Mot refusé par `src/heritage.test.ts`, écrit en morceaux : cette garde lit aussi `outils/`. */
export const MOT_INTERDIT = new RegExp('(?<![gG])' + 'track' + 'er|application compl' + 'ète', 'i')

// ---------- lecteur de jetons ----------

const DEBUT_ID = /[A-Za-z_$À-￿]/
const SUITE_ID = /[\w$À-￿]/
const BLANC = /\s/
/** Mots après lesquels une expression commence (un « / » y ouvre une expression régulière, un « < » du JSX). */
const MOTS_AVANT_EXPRESSION = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await', 'default'])

/** Valeur d'une chaîne entre guillemets, échappements lus. */
const decoder = (corps) =>
  corps.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (_, e) => {
    if (e.startsWith('u{')) return String.fromCodePoint(parseInt(e.slice(2, -1), 16))
    if (e.length > 1 && (e[0] === 'u' || e[0] === 'x')) return String.fromCharCode(parseInt(e.slice(1), 16))
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '', '\r\n': '' }[e] ?? e
  })

/**
 * Jetons du code d'un fichier : `{ type: 'id' | 'str' | 'tpl' | 'num' | 'regex' | 'punc' | 'jsx', valeur, pos }`.
 * Une chaîne simple et un gabarit sans `${}` donnent `str` (valeur décodée) ; un gabarit à `${}` donne `tpl`, suivi des
 * jetons de chaque expression entre `{` et `}`. Le texte du JSX ne donne rien, ses `{}` donnent leurs jetons.
 */
export function lireJetons(texte, jsx) {
  const jetons = []
  const n = texte.length
  const dernier = () => jetons[jetons.length - 1]
  const expressionPermise = () => {
    const p = dernier()
    if (!p) return true
    // Un `!` ou un `++`/`--` posé après une valeur (`x! / 2`, `i++ / 2`) la termine : le `/` qui suit divise.
    const finDeValeur = (j) =>
      !!j && (j.type === 'num' || j.type === 'str' || (j.type === 'id' && !MOTS_AVANT_EXPRESSION.has(j.valeur)) ||
        (j.type === 'punc' && (j.valeur === ')' || j.valeur === ']')))
    if (p.type === 'punc' && p.valeur === '!' && finDeValeur(jetons[jetons.length - 2])) return false
    const avant = jetons[jetons.length - 2]
    if (p.type === 'punc' && (p.valeur === '+' || p.valeur === '-') && avant?.type === 'punc' && avant.valeur === p.valeur &&
      avant.pos === p.pos - 1 && finDeValeur(jetons[jetons.length - 3])) return false
    if (p.type === 'punc') return !(p.valeur === ')' || p.valeur === ']')
    if (p.type === 'id') return MOTS_AVANT_EXPRESSION.has(p.valeur)
    return false
  }
  const erreur = (pos, raison) => {
    throw new Error(`${raison} (caractère ${pos})`)
  }

  const lireChaine = (pos) => {
    const q = texte[pos]
    let i = pos + 1
    while (i < n && texte[i] !== q) {
      if (texte[i] === '\\') i++
      else if (texte[i] === '\n') erreur(pos, 'chaîne non fermée')
      i++
    }
    if (i >= n) erreur(pos, 'chaîne non fermée')
    jetons.push({ type: 'str', valeur: decoder(texte.slice(pos + 1, i)), pos })
    return i + 1
  }

  const lireGabarit = (pos) => {
    let i = pos + 1
    let morceaux = ''
    let avecExpression = false
    while (i < n && texte[i] !== '`') {
      if (texte[i] === '\\') {
        morceaux += texte.slice(i, i + 2)
        i += 2
      } else if (texte[i] === '$' && texte[i + 1] === '{') {
        if (!avecExpression) jetons.push({ type: 'tpl', valeur: null, pos })
        avecExpression = true
        jetons.push({ type: 'punc', valeur: '{', pos: i })
        i = lireCode(i + 2, true)
        jetons.push({ type: 'punc', valeur: '}', pos: i - 1 })
      } else morceaux += texte[i++]
    }
    if (i >= n) erreur(pos, 'gabarit non fermé')
    if (!avecExpression) jetons.push({ type: 'str', valeur: decoder(morceaux), pos })
    return i + 1
  }

  const lireRegex = (pos) => {
    let i = pos + 1
    let classe = false
    while (i < n) {
      const c = texte[i]
      if (c === '\\') i += 2
      else if (c === '\n') erreur(pos, 'expression régulière non fermée')
      else if (classe) {
        if (c === ']') classe = false
        i++
      } else if (c === '[') {
        classe = true
        i++
      } else if (c === '/') break
      else i++
    }
    i++
    while (i < n && /[a-z]/.test(texte[i])) i++
    jetons.push({ type: 'regex', valeur: texte.slice(pos, i), pos })
    return i
  }

  const sauterBlancs = (i) => {
    while (i < n && BLANC.test(texte[i])) i++
    return i
  }

  /** Un « < » en position d'expression ouvre-t-il un élément ? Non pour un générique de fonction fléchée (`<T,>`, `<T extends …>`). */
  const ouvreJsx = (pos) => {
    let i = sauterBlancs(pos + 1)
    if (texte[i] === '>') return true
    if (!DEBUT_ID.test(texte[i] ?? '')) return false
    while (i < n && /[\w$.:-]/.test(texte[i])) i++
    i = sauterBlancs(i)
    return !(texte[i] === ',' || texte.startsWith('extends', i))
  }

  /** Arguments de type d'un composant (`<Liste<Tri> …>`) : rend la position qui suit leur « > », ou `i` s'il n'y en a pas. */
  const sauterArgumentsDeType = (i) => {
    if (texte[i] !== '<') return i
    let profondeur = 0
    while (i < n) {
      const c = texte[i]
      if (c === "'" || c === '"') {
        const fin = texte.indexOf(c, i + 1)
        if (fin < 0) erreur(i, 'argument de type non fermé')
        i = fin + 1
        continue
      }
      if (c === '=' && texte[i + 1] === '>') i += 2
      else if (c === '<') {
        profondeur++
        i++
      } else if (c === '>') {
        profondeur--
        i++
        if (profondeur === 0) return i
      } else i++
    }
    return erreur(i, 'argument de type non fermé')
  }

  /** Élément JSX à partir de son « < » ; rend la position qui suit sa fin. */
  const lireElement = (pos) => {
    let i = sauterBlancs(pos + 1)
    if (texte[i] === '>') i++
    else {
      while (i < n && /[\w$.:-]/.test(texte[i])) i++
      i = sauterArgumentsDeType(sauterBlancs(i))
      for (;;) {
        i = sauterBlancs(i)
        // Un commentaire entre deux attributs.
        if (texte[i] === '/' && (texte[i + 1] === '/' || texte[i + 1] === '*')) {
          const ligne = texte[i + 1] === '/'
          const fin = texte.indexOf(ligne ? '\n' : '*/', i + 2)
          if (fin < 0) erreur(i, 'commentaire non fermé')
          i = ligne ? fin : fin + 2
          continue
        }
        if (i >= n) erreur(pos, 'balise JSX non fermée')
        if (texte[i] === '/' && texte[i + 1] === '>') return i + 2
        if (texte[i] === '>') {
          i++
          break
        }
        if (texte[i] === '{') {
          jetons.push({ type: 'punc', valeur: '{', pos: i })
          i = lireCode(i + 1, true)
          jetons.push({ type: 'punc', valeur: '}', pos: i - 1 })
          continue
        }
        const debut = i
        while (i < n && /[\w$.:-]/.test(texte[i])) i++
        if (i === debut) erreur(i, 'attribut JSX illisible')
        i = sauterBlancs(i)
        if (texte[i] !== '=') continue
        i = sauterBlancs(i + 1)
        const q = texte[i]
        if (q === '"' || q === "'") {
          const fin = texte.indexOf(q, i + 1)
          if (fin < 0) erreur(i, 'attribut JSX non fermé')
          i = fin + 1
        } else if (q === '{') {
          jetons.push({ type: 'punc', valeur: '{', pos: i })
          i = lireCode(i + 1, true)
          jetons.push({ type: 'punc', valeur: '}', pos: i - 1 })
        } else if (q === '<') i = lireElement(i)
        else erreur(i, 'valeur d’attribut JSX illisible')
      }
    }
    // Contenu : texte, `{expression}`, éléments, jusqu'à la balise fermante.
    for (;;) {
      if (i >= n) erreur(pos, 'élément JSX non fermé')
      const c = texte[i]
      if (c === '{') {
        jetons.push({ type: 'punc', valeur: '{', pos: i })
        i = lireCode(i + 1, true)
        jetons.push({ type: 'punc', valeur: '}', pos: i - 1 })
      } else if (c === '<') {
        if (texte[sauterBlancs(i + 1)] === '/') {
          const fin = texte.indexOf('>', i)
          if (fin < 0) erreur(i, 'balise fermante non fermée')
          return fin + 1
        }
        i = lireElement(i)
      } else i++
    }
  }

  /** Code jusqu'à la fin, ou jusqu'à l'accolade fermante de même niveau (`dansAccolades`) ; rend la position qui la suit. */
  function lireCode(pos, dansAccolades) {
    let i = pos
    let profondeur = 0
    while (i < n) {
      const c = texte[i]
      if (BLANC.test(c)) i++
      else if (c === '/' && texte[i + 1] === '/') {
        const fin = texte.indexOf('\n', i)
        i = fin < 0 ? n : fin
      } else if (c === '/' && texte[i + 1] === '*') {
        const fin = texte.indexOf('*/', i + 2)
        if (fin < 0) erreur(i, 'commentaire non fermé')
        i = fin + 2
      } else if (c === "'" || c === '"') i = lireChaine(i)
      else if (c === '`') i = lireGabarit(i)
      else if (DEBUT_ID.test(c)) {
        const debut = i
        while (i < n && SUITE_ID.test(texte[i])) i++
        jetons.push({ type: 'id', valeur: texte.slice(debut, i), pos: debut })
      } else if (/\d/.test(c)) {
        const debut = i
        while (i < n && /[\w.]/.test(texte[i])) i++
        jetons.push({ type: 'num', valeur: texte.slice(debut, i), pos: debut })
      } else if (c === '/' && expressionPermise()) i = lireRegex(i)
      else if (c === '<' && jsx && expressionPermise() && ouvreJsx(i)) {
        i = lireElement(i)
        jetons.push({ type: 'jsx', valeur: null, pos: i })
      } else {
        if (c === '{') profondeur++
        else if (c === '}') {
          if (profondeur === 0 && dansAccolades) return i + 1
          profondeur--
        }
        jetons.push({ type: 'punc', valeur: c, pos: i })
        i++
      }
    }
    if (dansAccolades) erreur(pos, 'accolade non fermée')
    return i
  }

  lireCode(0, false)
  return jetons
}

// ---------- clés ----------

/** Arguments d'un appel dont `(` est au jeton `ouvrante` : listes de jetons, et l'indice qui suit `)`. */
const argumentsDe = (jetons, ouvrante) => {
  const args = [[]]
  let profondeur = 0
  for (let k = ouvrante + 1; k < jetons.length; k++) {
    const j = jetons[k]
    if (j.type === 'punc') {
      if ('([{'.includes(j.valeur)) profondeur++
      else if (')]}'.includes(j.valeur)) {
        if (profondeur === 0) return { args: args.filter((a, i) => a.length > 0 || i < args.length - 1), fin: k + 1 }
        profondeur--
      } else if (j.valeur === ',' && profondeur === 0) {
        args.push([])
        continue
      }
    }
    args[args.length - 1].push(j)
  }
  return { args, fin: jetons.length }
}

const estLitteral = (arg) => arg !== undefined && arg.length === 1 && arg[0].type === 'str'

/** Contexte donné dans un objet de variables : `{ ctx: 'foil' }` → « foil » ; `null` sans contexte ; `false` s'il n'est pas littéral. */
const contexteDe = (arg) => {
  if (arg === undefined) return null
  for (let k = 0; k < arg.length; k++) {
    const j = arg[k]
    if (j.type !== 'id' || j.valeur !== 'ctx') continue
    const avant = arg[k - 1]
    if (!avant || avant.type !== 'punc' || (avant.valeur !== '{' && avant.valeur !== ',')) continue
    const deux = arg[k + 1]
    const valeur = arg[k + 2]
    const apres = arg[k + 3]
    if (deux?.valeur === ':' && valeur?.type === 'str' && apres?.type === 'punc' && (apres.valeur === ',' || apres.valeur === '}')) return valeur.valeur
    return false
  }
  return null
}

/**
 * Clés d'un texte source : `{ cles: [{ cle, nom, ligne }], refus: [{ ligne, raison }] }`. `cle` porte son contexte
 * (« vol||foil ») ; `nom` dit la fonction (`t`, `tn`, `tRich`).
 */
export function extraireCles(texte, jsx) {
  const cles = []
  const refus = []
  let jetons
  try {
    jetons = lireJetons(texte, jsx)
  } catch (e) {
    return { cles, refus: [{ ligne: 0, raison: `lecture impossible : ${e.message}` }] }
  }
  const ligneDe = (pos) => texte.slice(0, pos).split('\n').length
  for (let k = 0; k < jetons.length; k++) {
    const j = jetons[k]
    if (j.type !== 'id' || !NOMS.has(j.valeur) || jetons[k + 1]?.valeur !== '(' || jetons[k + 1]?.type !== 'punc') continue
    const avant = jetons[k - 1]
    if (avant && ((avant.type === 'punc' && avant.valeur === '.') || (avant.type === 'id' && avant.valeur === 'function'))) continue
    const ligne = ligneDe(j.pos)
    const { args } = argumentsDe(jetons, k + 1)
    const accorde = ACCORDEES.has(j.valeur)
    const phrases = accorde ? [args[1], args[2]] : [args[0]]
    const variables = accorde ? args[3] : args[1]
    if (!phrases.every(estLitteral)) {
      refus.push({ ligne, raison: `${j.valeur}( : ${accorde ? 'phrase' : 'premier argument'} non littéral` })
      continue
    }
    const ctx = contexteDe(variables)
    if (ctx === false) {
      refus.push({ ligne, raison: `${j.valeur}( : contexte non littéral` })
      continue
    }
    for (const p of phrases) cles.push({ cle: ctx === null ? p[0].valeur : p[0].valeur + MARQUE_CONTEXTE + ctx, nom: j.valeur, ligne })
  }
  return { cles, refus }
}

/** Fichiers de code de `src/` lus par la garde : ni tests, ni jeux d'essai, ni `src/test/`, ni les définitions. */
export function fichiersSources() {
  const liste = []
  const parcourir = (dossier) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const p = path.join(dossier, e.name)
      const rel = path.relative(racine, p).split(path.sep).join('/')
      if (e.isDirectory()) {
        if (rel !== 'src/test') parcourir(p)
      } else if (/\.tsx?$/.test(e.name) && !/\.(test|fixture)\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') && !DEFINITIONS.includes(rel)) liste.push(rel)
    }
  }
  parcourir(path.join(racine, 'src'))
  return liste.sort()
}

/** Toutes les clés de `src/` : `{ cles: Map<clé, { noms: Set, ou: string[] }>, refus: string[] }`. */
export function extraireTout() {
  const cles = new Map()
  const refus = []
  for (const fichier of fichiersSources()) {
    const texte = fs.readFileSync(path.join(racine, fichier), 'utf8')
    const r = extraireCles(texte, fichier.endsWith('.tsx'))
    for (const x of r.refus) refus.push(`${fichier}:${x.ligne}  ${x.raison}`)
    for (const x of r.cles) {
      const fiche = cles.get(x.cle) ?? { noms: new Set(), ou: [] }
      fiche.noms.add(x.nom)
      fiche.ou.push(`${fichier}:${x.ligne}`)
      cles.set(x.cle, fiche)
    }
  }
  return { cles, refus }
}

// ---------- dictionnaires ----------

const variablesDe = (texte) => [...new Set([...texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
const balisesDe = (texte) => [...texte.matchAll(/<(\/?)([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[1] + m[2]).sort()
const memes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Contrôle d'un dictionnaire contre les clés du code (`Map` de `extraireTout`, ou toute `Map` clé → `{ noms }`) :
 * `{ traduites, manquantes, orphelines, variables, interdits, forme }`, chacun une liste.
 */
export function controlerDictionnaire(cles, dico) {
  const r = { traduites: [], manquantes: [], orphelines: [], variables: [], interdits: [], forme: [] }
  if (dico === null || typeof dico !== 'object' || Array.isArray(dico)) {
    r.forme.push('le dictionnaire n’est pas un objet')
    return r
  }
  for (const [cle, traduction] of Object.entries(dico)) {
    if (typeof traduction !== 'string') {
      r.forme.push(`${cle} : traduction qui n’est pas un texte`)
      continue
    }
    if (!cles.has(cle)) r.orphelines.push(cle)
    else r.traduites.push(cle)
    const francais = cle.split(MARQUE_CONTEXTE)[0]
    // `tn` passe toujours `n` : une traduction peut l'écrire même si la phrase française ne l'écrit pas (« une session »).
    const attendues = variablesDe(francais)
    const trouvees = variablesDe(traduction)
    const noms = cles.get(cle)?.noms
    const nPermis = (noms?.has('tn') || noms?.has('tnRich')) && !attendues.includes('n')
    if (!memes(attendues, nPermis ? trouvees.filter((v) => v !== 'n') : trouvees)) r.variables.push(`${cle} : variables ${attendues.join(', ') || 'aucune'}, traduction ${trouvees.join(', ') || 'aucune'}`)
    if (!memes(balisesDe(francais), balisesDe(traduction))) r.variables.push(`${cle} : balises différentes`)
    if (MOT_INTERDIT.test(traduction)) r.interdits.push(`${cle} : ${traduction}`)
  }
  for (const cle of cles.keys()) if (!Object.hasOwn(dico, cle)) r.manquantes.push(cle)
  return r
}

/** Dictionnaire d'une langue lu sur le disque ; `null` s'il est absent ou illisible. */
export function lireDictionnaire(langue) {
  try {
    return JSON.parse(fs.readFileSync(cheminDictionnaire(langue), 'utf8'))
  } catch {
    return null
  }
}

/** Bilan complet : clés, refus, et par langue le contrôle de son dictionnaire ; `erreurs` liste tout ce qui fait échouer. */
export function bilan() {
  const { cles, refus } = extraireTout()
  const langues = {}
  const erreurs = [...refus]
  for (const langue of LANGUES) {
    const dico = lireDictionnaire(langue)
    const r = dico === null ? { ...controlerDictionnaire(cles, {}), forme: [`${DOSSIER_DICTIONNAIRES}/${langue}.json absent ou illisible`] } : controlerDictionnaire(cles, dico)
    langues[langue] = r
    for (const x of r.forme) erreurs.push(`${langue} : ${x}`)
    for (const x of r.orphelines) erreurs.push(`${langue} : traduction orpheline : ${x}`)
    for (const x of r.variables) erreurs.push(`${langue} : ${x}`)
    for (const x of r.interdits) erreurs.push(`${langue} : mot interdit : ${x}`)
    if (TRADUCTION_CLOSE) for (const x of r.manquantes) erreurs.push(`${langue} : sans traduction : ${x}`)
  }
  return { cles, refus, langues, erreurs }
}

// ---------- ligne de commande ----------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const b = bilan()
  const iManquantes = process.argv.indexOf('--manquantes')
  if (iManquantes >= 0) {
    const langue = process.argv[iManquantes + 1]
    if (!LANGUES.includes(langue)) {
      console.log(`langue attendue après --manquantes : ${LANGUES.join(' ou ')}`)
      process.exit(1)
    }
    for (const cle of b.langues[langue].manquantes) console.log(`${cle}    (${b.cles.get(cle).ou[0]})`)
    process.exit(0)
  }
  console.log(`traductions : ${b.cles.size} clé(s) dans le code, ${b.refus.length} refus${TRADUCTION_CLOSE ? ', chantier clos' : ''}`)
  for (const langue of LANGUES) {
    const r = b.langues[langue]
    console.log(`  ${langue} : ${r.traduites.length} traduite(s), ${r.manquantes.length} manquante(s), ${r.orphelines.length} orpheline(s), ${r.variables.length} variable(s) ou balise(s) fausse(s), ${r.interdits.length} mot(s) interdit(s)`)
  }
  if (b.erreurs.length) {
    console.log(b.erreurs.slice(0, 40).map((e) => '  ' + e).join('\n'))
    if (b.erreurs.length > 40) console.log(`  et ${b.erreurs.length - 40} autres`)
    process.exitCode = 1
  }
}
