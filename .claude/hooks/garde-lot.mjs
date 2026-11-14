// Garde de l'agent `lot` : un crochet déterministe, là où une consigne se contourne.
//
// Refuse, avec un message d'une ligne qui dit quoi faire à la place :
//   1. les commandes git qui défont ou déplacent un travail (stash, checkout, restore, clean, reset, switch, rebase,
//      merge, worktree, tag, branch -D, et toujours commit et push) ;
//   2. l'édition d'un fichier par un script dans Bash (sed -i, perl -i, redirection, tee, node -e et python -c qui écrivent) ;
//   3. l'écriture par Edit ou Write hors du dépôt, dans docs/ hors de docs/backlog/, dans .claude/, et celle de package.json ;
//   4. l'écriture hors de la liste du lot, quand `.claude/lot-fichiers.json` existe (écrit par l'orchestrateur seul).
//
// `juger` est pure : elle rend `null` (permis) ou le message du refus. Le bas du fichier lit l'entrée standard du
// crochet, sort en 2 avec le message sur la sortie d'erreur, ou en 0 (entrée illisible comprise).

import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------- chemins ----------

/** Chemin à barres droites, lettre de lecteur en minuscule : `D:\x`, `d:/x` et `/d/x` donnent `d:/x`. */
export function norm(p) {
  let s = String(p).replace(/\\/g, '/')
  s = s.replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:')
  s = s.replace(/^[a-zA-Z]:/, (l) => l.toLowerCase())
  s = posix.normalize(s)
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s
}

const estAbsolu = (n) => /^[a-z]:(\/|$)/.test(n) || n.startsWith('/')

/** Clé de comparaison d'un chemin : normalisé, sans casse, relatif résolu depuis `base`. */
function cle(p, base) {
  if (String(p).startsWith('~')) return String(p).toLowerCase()
  const n = norm(p)
  return (estAbsolu(n) ? n : norm(`${base}/${n}`)).toLowerCase()
}

const dans = (chemin, dossier) => chemin === dossier || chemin.startsWith(dossier + '/')

/** Partie d'un chemin sous la racine (sans barre initiale), ou null s'il est dehors. */
function sousRacine(chemin, racineCle) {
  if (chemin === racineCle) return ''
  return chemin.startsWith(racineCle + '/') ? chemin.slice(racineCle.length + 1) : null
}

/** Un motif de la liste du lot (`*` dans un nom, `**` à travers les dossiers) en expression régulière. */
function motif(g, racineCle) {
  let s = norm(g).toLowerCase()
  const rel = sousRacine(s, racineCle)
  if (rel !== null) s = rel
  let re = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '*') {
      if (s[i + 1] === '*') {
        if (s[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

/** Dossiers où l'écriture reste permise : le dossier temporaire du système et les brouillons. */
function dossiersLibres(ctx, racineCle) {
  const temp = ctx.temp ?? [tmpdir(), '/tmp']
  const brouillons = ctx.brouillons ?? [join(ctx.racine, '..', 'atelier')]
  return [...temp, ...brouillons].map((d) => cle(d, racineCle)).filter((d) => d && d !== '/')
}

// ---------- messages ----------

const MSG_COMMIT = "L'agent lot ne committe pas et ne pousse pas : c'est l'orchestrateur, dis-le dans ton rapport."
const MSG_PACKAGE = "L'agent lot ne touche pas à package.json : la version est posée par l'orchestrateur, dis-le dans ton rapport."
const MSG_SCRIPT = "Édition d'un fichier par un script refusée : utilise Edit ou Write, ou dis-le dans ton rapport."
const MSG_HORS_DEPOT = "Écriture hors du dépôt refusée (seuls le dossier temporaire et ton brouillon sont permis) : dis-le dans ton rapport."
const MSG_DOCS = "docs/ est réservé à la passe de doc (sauf docs/backlog/) : dis-le dans ton rapport au lieu de le modifier."
const MSG_CLAUDE = "Le dossier .claude/ n'est pas à l'agent lot (liste du lot comprise) : dis-le dans ton rapport."
const MSG_LISTE = "Ce fichier n'est pas dans la liste du lot (.claude/lot-fichiers.json) : dis-le dans ton rapport au lieu de le modifier."
const msgGit = (sous) => `git ${sous} est refusé à l'agent lot (il défait ou déplace du travail) : dis-le dans ton rapport.`

// ---------- Edit et Write ----------

function jugerEcriture(chemin, ctx) {
  if (/(^|[\\/])package\.json$/.test(chemin)) return MSG_PACKAGE
  const racineCle = cle(ctx.racine, ctx.racine)
  const base = ctx.cwd ?? ctx.racine
  let rel = sousRacine(cle(chemin, base), racineCle)
  if (rel === null) return dansLibres(cle(chemin, base), ctx, racineCle) ? null : MSG_HORS_DEPOT
  // Copie de travail d'un lot parallèle : son dossier tient lieu de racine.
  const copie = /^\.claude\/worktrees\/[^/]+\/(.+)$/.exec(rel)
  if (copie) rel = copie[1]
  if (rel === '.claude' || rel.startsWith('.claude/')) return MSG_CLAUDE
  const liste = ctx.liste ?? null
  const dansListe = liste !== null && liste.some((g) => motif(g, racineCle).test(rel))
  if (rel.startsWith('docs/') && !rel.startsWith('docs/backlog/') && !dansListe) return MSG_DOCS
  if (liste !== null && !dansListe) return MSG_LISTE
  return null
}

function dansLibres(chemin, ctx, racineCle) {
  return dossiersLibres(ctx, racineCle).some((d) => dans(chemin, d))
}

// ---------- Bash : lecture de la ligne de commande ----------

/**
 * Découpe une ligne en segments (`;`, `&&`, `||`, `|`, `&`, saut de ligne, parenthèses, accents graves), en
 * respectant les guillemets. Chaque segment : ses mots sans guillemets, les cibles de ses redirections (`>`, `>>`,
 * `2>`, `&>`) et le corps de son document en ligne (`<<EOF`). Les copies de descripteur (`2>&1`) ne sont pas des cibles.
 */
function lire(cmd) {
  const n = cmd.length
  const segments = []
  const enAttente = []
  let seg = { mots: [], cibles: [], corps: '' }
  let mot = null
  let mode = null // 'cible' ou 'entree' : à quoi sert le prochain mot

  const fermerMot = () => {
    if (mot === null) return
    if (mode === 'cible') seg.cibles.push(mot)
    else if (mode !== 'entree') seg.mots.push(mot)
    mode = null
    mot = null
  }
  const fermerSegment = () => {
    fermerMot()
    mode = null
    if (seg.mots.length || seg.cibles.length) segments.push(seg)
    seg = { mots: [], cibles: [], corps: '' }
  }
  const sauterCorps = (depart) => {
    let pos = depart
    while (enAttente.length) {
      const h = enAttente.shift()
      while (pos < n) {
        let fin = cmd.indexOf('\n', pos)
        if (fin < 0) fin = n
        const ligne = cmd.slice(pos, fin).replace(/\r$/, '')
        pos = fin + 1
        if ((h.tab ? ligne.replace(/^\t+/, '') : ligne) === h.delim) break
        h.seg.corps += ligne + '\n'
      }
    }
    return pos
  }

  let i = 0
  while (i < n) {
    const c = cmd[i]
    if (c === "'") {
      mot ??= ''
      const j = cmd.indexOf("'", i + 1)
      const fin = j < 0 ? n : j
      mot += cmd.slice(i + 1, fin)
      i = fin + 1
    } else if (c === '"') {
      mot ??= ''
      i++
      while (i < n && cmd[i] !== '"') {
        if (cmd[i] === '\\' && i + 1 < n && '"\\$`'.includes(cmd[i + 1])) i++
        mot += cmd[i]
        i++
      }
      i++
    } else if (c === '\\') {
      if (cmd[i + 1] === '\n') i += 2
      else if (cmd[i + 1] === '\r' && cmd[i + 2] === '\n') i += 3
      else {
        mot = (mot ?? '') + (cmd[i + 1] ?? '')
        i += 2
      }
    } else if (c === ' ' || c === '\t' || c === '\r') {
      fermerMot()
      i++
    } else if (c === '\n') {
      fermerSegment()
      i = sauterCorps(i + 1)
    } else if (c === '#' && mot === null) {
      while (i < n && cmd[i] !== '\n') i++
    } else if (c === ';' || c === '(' || c === ')' || c === '`') {
      fermerSegment()
      i++
    } else if (c === '|') {
      fermerSegment()
      i++
      if (cmd[i] === '|' || cmd[i] === '&') i++
    } else if (c === '&') {
      fermerMot()
      if (cmd[i + 1] === '>') {
        i++ // « &> » : la boucle lit ensuite le « > »
      } else {
        fermerSegment()
        i++
        if (cmd[i] === '&') i++
      }
    } else if (c === '>') {
      if (mot !== null && /^\d+$/.test(mot)) mot = null // « 2> »
      else fermerMot()
      i++
      if (cmd[i] === '>' || cmd[i] === '|') i++
      if (cmd[i] === '&') {
        const copie = /^&(\d+|-)/.exec(cmd.slice(i, i + 12))
        if (copie) {
          i += copie[0].length
          continue
        }
        i++
      }
      mode = 'cible'
    } else if (c === '<') {
      fermerMot()
      if (cmd.startsWith('<<<', i)) {
        i += 3
      } else if (cmd.startsWith('<<', i)) {
        i += 2
        let tab = false
        if (cmd[i] === '-') {
          tab = true
          i++
        }
        while (cmd[i] === ' ' || cmd[i] === '\t') i++
        let delim = ''
        while (i < n && !/[\s;|&()<>]/.test(cmd[i])) {
          if (cmd[i] !== "'" && cmd[i] !== '"' && cmd[i] !== '\\') delim += cmd[i]
          i++
        }
        enAttente.push({ delim, tab, seg })
      } else {
        i++
        mode = 'entree'
      }
    } else {
      mot = (mot ?? '') + c
      i++
    }
  }
  fermerSegment()
  return segments
}

// ---------- Bash : jugement ----------

const nomCommande = (m) => m.replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '')

/** Mots qui précèdent la vraie commande : affectations (`X=1`), `env`, `command`, `time`, `{`, `then`… */
const ENVELOPPES = new Set(['command', 'builtin', 'exec', 'nohup', 'time', 'nice', 'env', 'sudo', '{', '!', 'if', 'then', 'do', 'else', 'elif', 'while', 'until'])

function sansEnveloppe(mots) {
  const m = [...mots]
  while (m.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(m[0])) {
      m.shift()
      continue
    }
    const nom = nomCommande(m[0])
    if (!ENVELOPPES.has(nom)) break
    m.shift()
    while (m.length && (m[0].startsWith('-') || (nom === 'env' && m[0].includes('=')))) m.shift()
  }
  return m
}

const GIT_REFUSES = new Set(['stash', 'checkout', 'restore', 'clean', 'reset', 'switch', 'rebase', 'merge', 'worktree', 'tag'])
const GIT_OPTION_AVEC_VALEUR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source'])

/** Sous-commande git : premier mot après `git` et ses options globales. */
function sousCommandeGit(args) {
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('-')) return { sous: args[i], reste: args.slice(i + 1) }
    if (GIT_OPTION_AVEC_VALEUR.has(args[i])) i++
  }
  return null
}

function jugerGit(args) {
  const g = sousCommandeGit(args)
  if (!g) return null
  if (g.sous === 'commit' || g.sous === 'push') return MSG_COMMIT
  if (GIT_REFUSES.has(g.sous)) return msgGit(g.sous)
  if (g.sous === 'branch' && g.reste.some((a) => /^--(delete|move)$/.test(a) || /^-[a-zA-Z]*[DdMm]/.test(a))) return msgGit('branch -D')
  return null
}

/** Une option courte `lettre` se trouve-t-elle dans un paquet d'options (`-ni`, `-Ei`, `-i.bak`) ? Les options qui prennent un argument arrêtent la lecture. */
function paquetContient(arg, lettre, avecArgument) {
  if (!/^-[a-zA-Z]/.test(arg)) return false
  for (const c of arg.slice(1)) {
    if (c === lettre) return true
    if (avecArgument.includes(c) || !/[a-zA-Z0-9]/.test(c)) return false
  }
  return false
}

const ECRITURE_JS = /(write|append)\w*File|createWriteStream|copyFile|cpSync|\brm(Sync)?\b|rmdir|unlink|rename|truncate|mkdir|child_process|Bun\.write/
const ECRITURE_PY =
  /open\s*\([^)]*,\s*(mode\s*=\s*)?['"][rbt]*[wax+][rbt+]*['"]|\.write(_text|_bytes)?\s*\(|\bshutil\b|\bos\.(remove|rename|replace|unlink|rmdir|makedirs|mkdir|system|popen)|subprocess|\.(unlink|mkdir|touch)\s*\(/

const SUPPRIMEURS = new Set(['rm', 'mv', 'cp', 'unlink', 'truncate', 'rmdir', 'del', 'erase', 'shred', 'ln', 'install'])

/** Cible d'une redirection ou de `tee` : permise seulement vers /dev/null, le dossier temporaire et les brouillons. */
function cibleLibre(cible, ctx, racineCle) {
  if (/^\/dev\/(null|stdout|stderr|tty|fd\/\d+)$/.test(cible)) return true
  const variable = /^\$\{?(TMPDIR|TEMP|TMP)\}?\//.test(cible)
  if (variable) return true
  if (/[$`]/.test(cible)) return false
  const chemin = cle(cible, ctx.cwd ?? ctx.racine)
  if (sousRacine(chemin, racineCle) !== null) return false
  return dansLibres(chemin, ctx, racineCle)
}

function jugerBash(cmd, ctx, profondeur = 0) {
  const racineCle = cle(ctx.racine, ctx.racine)
  for (const seg of lire(cmd)) {
    if (seg.cibles.some((c) => !cibleLibre(c, ctx, racineCle))) return MSG_SCRIPT
    const mots = sansEnveloppe(seg.mots)
    if (!mots.length) continue
    const nom = nomCommande(mots[0])
    const args = mots.slice(1)
    if (nom === 'git') {
      const m = jugerGit(args)
      if (m) return m
    } else if (nom === 'sed') {
      if (args.some((a) => a.startsWith('--in-place') || paquetContient(a, 'i', 'efl'))) return MSG_SCRIPT
    } else if (nom === 'perl') {
      if (args.some((a) => paquetContient(a, 'i', 'eEMmIxCdDVu'))) return MSG_SCRIPT
    } else if (nom === 'tee') {
      if (args.some((a) => !a.startsWith('-') && !cibleLibre(a, ctx, racineCle))) return MSG_SCRIPT
    } else if (['node', 'nodejs', 'bun', 'deno'].includes(nom)) {
      const k = args.findIndex((a) => /^(-e|-p|-pe|-ep|--eval|--print)$/.test(a) || /^--(eval|print)=/.test(a))
      if (k >= 0 || seg.corps) {
        const code = k >= 0 ? (/^--(eval|print)=/.test(args[k]) ? args[k].replace(/^[^=]*=/, '') : (args[k + 1] ?? '')) : ''
        if (ECRITURE_JS.test(`${code}\n${seg.corps}`)) return MSG_SCRIPT
      }
    } else if (/^(python[0-9.]*|py)$/.test(nom)) {
      const k = args.findIndex((a) => /^-[A-Za-z]*c$/.test(a))
      if (k >= 0 || seg.corps) {
        if (ECRITURE_PY.test(`${k >= 0 ? (args[k + 1] ?? '') : ''}\n${seg.corps}`)) return MSG_SCRIPT
      }
    } else if (['bash', 'sh', 'zsh', 'dash'].includes(nom) && profondeur < 3) {
      const k = args.findIndex((a) => /^-[a-z]*c$/.test(a))
      const texte = k >= 0 ? (args[k + 1] ?? '') : args.length === 0 || args.includes('-s') || args.includes('-') ? seg.corps : ''
      if (texte) {
        const m = jugerBash(texte, ctx, profondeur + 1)
        if (m) return m
      }
    } else if (SUPPRIMEURS.has(nom)) {
      if (args.some((a) => /(^|[\\/])\.claude([\\/]|$)/.test(a))) return MSG_CLAUDE
    }
  }
  return null
}

// ---------- point d'entrée testable ----------

/**
 * Décide d'un appel d'outil. `ctx` : `racine` (dépôt), `liste` (tableau des chemins autorisés de
 * `.claude/lot-fichiers.json`, ou null s'il n'y en a pas), et facultativement `cwd`, `temp` et `brouillons`
 * (dossiers où l'écriture reste permise ; par défaut le dossier temporaire du système et `../atelier`).
 * Rend null (permis) ou le message du refus.
 */
export function juger(entree, ctx) {
  const outil = entree?.tool_name
  const e = entree?.tool_input ?? {}
  if (outil === 'Bash') return typeof e.command === 'string' ? jugerBash(e.command, ctx) : null
  if (outil === 'Edit' || outil === 'Write' || outil === 'MultiEdit' || outil === 'NotebookEdit') {
    const chemin = e.file_path ?? e.notebook_path
    return typeof chemin === 'string' && chemin ? jugerEcriture(chemin, ctx) : null
  }
  return null
}

/** Liste du lot : null sans fichier ; un fichier illisible ou sans `autorises` ne laisse rien passer (liste vide). */
function lireListe(racine) {
  const f = join(racine, '.claude', 'lot-fichiers.json')
  if (!existsSync(f)) return null
  try {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    return Array.isArray(j.autorises) ? j.autorises.filter((s) => typeof s === 'string') : []
  } catch {
    return []
  }
}

// ---------- crochet ----------

const direct = process.argv[1] && cle(process.argv[1], '/') === cle(fileURLToPath(import.meta.url), '/')
if (direct) {
  let brut = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (d) => (brut += d))
  process.stdin.on('end', () => {
    let e
    try {
      e = JSON.parse(brut)
    } catch {
      process.exit(0)
    }
    const racine = fileURLToPath(new URL('../../', import.meta.url))
    let message = null
    try {
      message = juger(e, { racine, liste: lireListe(racine), cwd: typeof e.cwd === 'string' ? e.cwd : undefined })
    } catch {
      process.exit(0)
    }
    if (message) {
      process.stderr.write(message + '\n')
      process.exit(2)
    }
    process.exit(0)
  })
}
