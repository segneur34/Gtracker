import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ATELIER,
  AVERTISSEMENTS,
  EXCEPTIONS_VOCABULAIRE,
  ErreurLivraison,
  FICHIERS_NOMMES,
  MOTIFS_BLOQUANTS,
  NOM_MONTRE,
  controlerSortie,
  estAtelier,
  estBinaire,
  identiteApplication,
  lireArbre,
  lecturesBinaire,
  lireArguments,
  lireConfig,
  motifsVendeur,
  planifier,
  principal,
  rechercher,
  releveVocabulaire,
  resumerTrouvailles,
  retirerBlocsAtelier,
  retirerScripts,
  validerConfig,
} from './livraison.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
// Le nom de l'ancienne application, en deux morceaux : la garde du nom lit aussi `outils/`.
const ANCIEN = 'Track' + 'er'

describe('plan : ce qui part et ce qui reste', () => {
  it('un dossier de l\'atelier part en entier, un nom voisin reste', () => {
    expect(estAtelier('.claude/agents/lot.md')).toBe(true)
    expect(estAtelier('docs/backlog/12-essai.md')).toBe(true)
    expect(estAtelier('CLAUDE.md')).toBe(true)
    expect(estAtelier('docs/backlogs.md')).toBe(false)
    expect(estAtelier('src/CLAUDE.md')).toBe(false)
    expect(estAtelier('docs/ETAT_DU_PROJET.md')).toBe(false)
    expect(estAtelier('outils/banc/profil.mjs')).toBe(false)
  })

  it('lit une sortie de ls-tree -z (espace dans le nom, mode exécutable)', () => {
    const sortie = '100644 blob aaa\tdossier avec espace/a.md\u0000100755 blob bbb\tandroid/gradlew\u0000'
    expect(lireArbre(sortie)).toEqual([
      { mode: '100644', type: 'blob', blob: 'aaa', chemin: 'dossier avec espace/a.md' },
      { mode: '100755', type: 'blob', blob: 'bbb', chemin: 'android/gradlew' },
    ])
  })

  it('range chaque entrée, marque les transformées et dit les entrées d\'atelier sans fichier', () => {
    const entrees = ['CLAUDE.md', 'README.md', 'docs/backlog/1.md', 'package.json', 'src/a.ts'].map((chemin) => ({ mode: '100644', type: 'blob', blob: 'x', chemin }))
    const plan = planifier(entrees, { atelier: ['CLAUDE.md', 'docs/backlog/', 'outils/absent.mjs'], transformes: new Set(['README.md', 'package.json']) })
    expect(plan.part.map((e) => e.chemin)).toEqual(['CLAUDE.md', 'docs/backlog/1.md'])
    expect(plan.reste.map((e) => e.chemin)).toEqual(['README.md', 'package.json', 'src/a.ts'])
    expect(plan.transforme.map((e) => e.chemin)).toEqual(['README.md', 'package.json'])
    expect(plan.nonTrouves).toEqual(['outils/absent.mjs'])
  })

  it('refuse un lien symbolique ou un sous-module qui resterait', () => {
    expect(() => planifier([{ mode: '120000', type: 'blob', blob: 'x', chemin: 'lien' }])).toThrow(ErreurLivraison)
    expect(() => planifier([{ mode: '160000', type: 'commit', blob: 'x', chemin: 'module' }])).toThrow(/sous-module/)
  })

  it('l\'atelier couvre ses fichiers propres, et l\'outil lui-même', () => {
    for (const c of ['CLAUDE.md', 'docs/BACKLOG.md', 'docs/MODELES.md', 'docs/HISTORIQUE.md', 'docs/DECISIONS.md', 'outils/livraison.mjs', 'outils/livraison.test.mjs', 'src/heritage.test.ts', 'src/landWords.test.ts', 'outils/heritage.json', 'outils/docs-atelier.json']) {
      expect(ATELIER, c).toContain(c)
    }
  })
})

describe('package.json : retrait des scripts', () => {
  const paquet = (scripts) => JSON.stringify({ name: 'g', version: '1.0.0', scripts, dependencies: { a: '^1' } }, null, 2) + '\n'

  it('retire le script, garde l\'ordre des clés, l\'indentation et le saut de ligne final', () => {
    const r = retirerScripts(paquet({ dev: 'vite', backlog: 'node outils/backlog.mjs', test: 'vitest run' }))
    expect(r.retires).toEqual(['backlog'])
    expect(r.texte).toBe(paquet({ dev: 'vite', test: 'vitest run' }))
  })

  it('garde les fins de ligne CRLF', () => {
    const r = retirerScripts(paquet({ backlog: 'x', test: 'y' }).replace(/\n/g, '\r\n'))
    expect(r.texte).toBe(paquet({ test: 'y' }).replace(/\n/g, '\r\n'))
  })

  it('sans le script, rend le texte tel quel', () => {
    const texte = paquet({ test: 'y' })
    expect(retirerScripts(texte)).toEqual({ texte, retires: [] })
  })

  it('refuse une mise en forme qu\'il changerait', () => {
    expect(() => retirerScripts('{"name":"g","scripts":{"backlog":"x"}}\n')).toThrow(/mise en forme/)
    expect(() => retirerScripts('{ illisible')).toThrow(/illisible/)
  })

  it('le package.json du dépôt se relit sans changement hors des scripts retirés', () => {
    const texte = readFileSync(join(RACINE, 'package.json'), 'utf8')
    const r = retirerScripts(texte)
    expect(JSON.parse(r.texte).version).toBe(JSON.parse(texte).version)
    for (const n of r.retires) expect(JSON.parse(r.texte).scripts[n]).toBeUndefined()
  })
})

describe('blocs d\'atelier des documents', () => {
  it('retire le bloc et ses marqueurs, sans laisser deux lignes vides', () => {
    const texte = 'Titre\n\n<!-- atelier -->\nVoir le reste à faire.\n<!-- /atelier -->\n\nSuite.\n'
    expect(retirerBlocsAtelier(texte)).toEqual({ texte: 'Titre\n\nSuite.\n', blocs: 1 })
  })

  it('un bloc dans une liste, en début et en fin de fichier', () => {
    expect(retirerBlocsAtelier('- a\n<!-- atelier -->\n- b\n<!-- /atelier -->\n- c\n').texte).toBe('- a\n- c\n')
    expect(retirerBlocsAtelier('<!-- atelier -->\nx\n<!-- /atelier -->\n\nTitre\n').texte).toBe('Titre\n')
    expect(retirerBlocsAtelier('Titre\n\n<!-- atelier -->\nx\n<!-- /atelier -->\n').texte).toBe('Titre\n')
  })

  it('garde les fins de ligne CRLF et l\'indentation des marqueurs', () => {
    expect(retirerBlocsAtelier('a\r\n  <!-- atelier -->\r\nx\r\n  <!-- /atelier -->\r\nb\r\n').texte).toBe('a\r\nb\r\n')
  })

  it('une mention au milieu d\'une ligne n\'est pas un marqueur', () => {
    const texte = 'Les blocs `<!-- atelier -->` partent.\n'
    expect(retirerBlocsAtelier(texte)).toEqual({ texte, blocs: 0 })
  })

  it('refuse un bloc jamais refermé, une fin sans début, un bloc dans un autre', () => {
    expect(() => retirerBlocsAtelier('a\n<!-- atelier -->\nb\n', 'README.md')).toThrow(/README\.md:2 : bloc d'atelier jamais refermé/)
    expect(() => retirerBlocsAtelier('a\n<!-- /atelier -->\n')).toThrow(/fin de bloc d'atelier sans début/)
    expect(() => retirerBlocsAtelier('<!-- atelier -->\n<!-- atelier -->\n<!-- /atelier -->\n')).toThrow(/ouvert dans un autre/)
  })
})

describe('recherches', () => {
  const fichier = (chemin, texte) => ({ chemin, lignes: texte === null ? null : texte.split('\n') })

  it('trouve dans le contenu et dans les noms, avec ligne', () => {
    const r = rechercher([fichier('a.md', 'rien\nun mot\n'), fichier('mot/b.png', null)], [{ nom: 'mot', re: /mot/ }])
    expect(r).toEqual([{ nom: 'mot', trouvailles: [{ chemin: 'a.md', ligne: 2 }, { chemin: 'mot/b.png', ligne: 0 }] }])
  })

  it('applique fichiers exemptés, morceaux de ligne permis et dossier', () => {
    const motif = { nom: 'm', re: /mot/, exemptes: ['porte.ts'], lignesPermises: [{ fichier: 'page.tsx', motif: /<b>mot<\/b>/ }], dossier: 'src/' }
    const r = rechercher(
      [fichier('src/porte.ts', 'mot'), fichier('porte.ts', 'mot'), fichier('src/page.tsx', '<b>mot</b>'), fichier('page.tsx', '<b>mot</b>\n<b>mot</b> mot'), fichier('src/c.ts', 'mot')],
      [{ ...motif, dossier: undefined }, motif],
    )
    expect(r[0].trouvailles).toEqual([{ chemin: 'src/porte.ts', ligne: 1 }, { chemin: 'src/page.tsx', ligne: 1 }, { chemin: 'page.tsx', ligne: 2 }, { chemin: 'src/c.ts', ligne: 1 }])
    expect(r[1].trouvailles.map((t) => t.chemin)).toEqual(['src/porte.ts', 'src/page.tsx', 'src/c.ts'])
  })

  it('le nom de l\'ancienne application : refusé sans « g » devant, permis dans la porte d\'import et sous le logo du Profil', () => {
    const [ancien] = MOTIFS_BLOQUANTS
    const r = rechercher(
      [
        fichier('README.md', `Gtracker\nancien ${ANCIEN}`),
        fichier('src/library/legacyImport.ts', ANCIEN),
        fichier('src/pages/ProfilePage.tsx', `<span className="profile-hero__name">${ANCIEN.toLowerCase()}</span>`),
        fichier(`outils/${ANCIEN.toLowerCase()}.md`, ''),
      ],
      [ancien],
    )
    expect(r[0].trouvailles).toEqual([{ chemin: 'README.md', ligne: 2 }, { chemin: `outils/${ANCIEN.toLowerCase()}.md`, ligne: 0 }])
  })

  it('les exceptions recopient celles de la garde du nom (src/heritage.test.ts)', () => {
    const garde = readFileSync(join(RACINE, 'src', 'heritage.test.ts'), 'utf8')
    const nommes = /const NAMED_FILES = \[([\s\S]*?)\];/.exec(garde)[1].match(/'[^']+'/g).map((s) => s.slice(1, -1))
    expect([...FICHIERS_NOMMES, 'src/heritage.test.ts'].sort()).toEqual(nommes.sort())
    const montres = /const SHOWN_NAME[\s\S]*?\];/.exec(garde)[0].match(/fichier: '[^']+'/g).map((s) => s.slice(10, -1))
    expect(NOM_MONTRE.map((n) => n.fichier).sort()).toEqual(montres.sort())
  })

  it('vocabulaire d\'atelier : les exceptions connues sont comptées à part, le reste est un avertissement', () => {
    const fichiers = [
      fichier('outils/banc/exe-sansfil.mjs', 'let MODELES = []'),
      fichier('outils/banc/autre.mjs', 'let MODELES = []'),
      fichier('.gitignore', '.claude/worktrees/'),
      fichier('README.md', 'voir le lot ' + '123'),
    ]
    const r = releveVocabulaire(fichiers)
    expect(r.exceptions).toBe(2)
    const trouves = Object.fromEntries(r.avertissements.filter((a) => a.trouvailles.length).map((a) => [a.nom, a.trouvailles.map((t) => t.chemin)]))
    expect(trouves).toEqual({ MODELES: ['outils/banc/autre.mjs'], 'lot N': ['README.md'] })
    expect(releveVocabulaire([fichier('vite.config.ts', 'ignorer .claude/worktrees/**')])).toEqual({ avertissements: AVERTISSEMENTS.map((m) => ({ nom: m.nom, trouvailles: [] })), exceptions: 1 })
  })

  it('chaque exception du vocabulaire nomme un avertissement, des fichiers et sa raison', () => {
    const noms = new Set(AVERTISSEMENTS.map((m) => m.nom))
    for (const e of EXCEPTIONS_VOCABULAIRE) {
      expect(noms.has(e.nom), e.nom).toBe(true)
      expect(e.fichiers.length, e.nom).toBeGreaterThan(0)
      expect(e.raison.length, e.nom).toBeGreaterThan(10)
    }
  })

  it('aucun motif n\'a le drapeau g (test garderait sa position)', () => {
    for (const m of [...MOTIFS_BLOQUANTS, ...AVERTISSEMENTS, ...motifsVendeur({ noms: ['Jean Dupont'] })]) expect(m.re.flags, m.nom).not.toContain('g')
  })

  it('résume les trouvailles par fichier', () => {
    expect(resumerTrouvailles([{ chemin: 'a', ligne: 2 }, { chemin: 'a', ligne: 5 }, { chemin: 'b', ligne: 0 }])).toEqual(['a (2 : 2, 5)', 'b (1 : nom de fichier)'])
    expect(resumerTrouvailles([1, 2, 3].map((n) => ({ chemin: `f${n}`, ligne: 1 })), 2)).toEqual(['f1 (1 : 1)', 'f2 (1 : 1)', 'et 1 autres fichiers'])
  })

  it('le contenu d\'un binaire est cherché en latin1 et en UTF-16, sans numéro de ligne ; pas pour les avertissements', () => {
    const motif = { nom: 'v', re: /jdupont/i }
    const image = Buffer.concat([Buffer.from([0x89, 0x50, 0, 1]), Buffer.from('Artist: JDupont', 'latin1')])
    const utf16 = Buffer.concat([Buffer.from([0]), Buffer.from('auteur jdupont', 'utf16le')]) // décalé d'un octet
    const propre = Buffer.from([0, 1, 2, 3])
    const fichiers = [image, utf16, propre].map((octets, i) => ({ chemin: `f${i}.bin`, lignes: null, binaire: lecturesBinaire(octets) }))
    expect(rechercher(fichiers, [motif])[0].trouvailles).toEqual([{ chemin: 'f0.bin', ligne: null }, { chemin: 'f1.bin', ligne: null }])
    expect(rechercher(fichiers, [motif], { binaires: false })[0].trouvailles).toEqual([])
    expect(resumerTrouvailles([{ chemin: 'f0.bin', ligne: null }])).toEqual(['f0.bin (1 : contenu binaire)'])
  })

  it('les lectures d\'un binaire de longueur impaire ne décodent que des paires d\'octets', () => {
    const octets = Buffer.from([0x61, 0, 0x62, 0, 0x63])
    expect(lecturesBinaire(octets)).toEqual(['a\u0000b\u0000c', 'ab', '戀挀'])
  })

  it('un binaire se reconnaît à un octet nul', () => {
    expect(estBinaire(Buffer.from([0x89, 0x50, 0, 1]))).toBe(true)
    expect(estBinaire(Buffer.from('texte é', 'utf8'))).toBe(false)
  })
})

describe('configuration et données du vendeur', () => {
  const config = (plus = {}) => ({ auteur: { nom: 'Neutre', email: 'neutre@exemple.invalid' }, vendeur: { noms: ['Jean Dupont'], chemins: ['C:\\Users\\jdupont'] }, ...plus })

  it('les motifs du vendeur : sans casse, séparateurs de chemin et espaces souples, nommés sans leur valeur', () => {
    const motifs = motifsVendeur({ noms: ['Jean Dupont'], chemins: ['C:\\Users\\jdupont', 'D:\\mes essais'] })
    expect(motifs.map((m) => m.nom)).toEqual(['vendeur : noms n°1', 'vendeur : chemins n°1', 'vendeur : chemins n°2'])
    expect(motifs[0].re.test('par JEAN   dupont')).toBe(true)
    for (const s of ['c:/users/JDupont/x', 'C:\\\\Users\\\\jdupont', 'C:\\Users\\jdupont']) expect(motifs[1].re.test(s), s).toBe(true)
    expect(motifs[2].re.test('file:///D:/mes%20essais/a')).toBe(true)
    expect(motifs[1].re.test('C:\\Users\\autre')).toBe(false)
  })

  it('refuse un texte trop court ou une rubrique qui n\'est pas une liste', () => {
    expect(() => motifsVendeur({ noms: ['abc'] })).toThrow(/trop court/)
    expect(() => motifsVendeur({ emails: 'a@b.c' })).toThrow(/liste/)
  })

  it('valide l\'auteur neutre', () => {
    expect(validerConfig(config()).auteur).toEqual({ nom: 'Neutre', email: 'neutre@exemple.invalid' })
    expect(() => validerConfig(config({ auteur: { nom: 'Neutre' } }))).toThrow(/obligatoires/)
    expect(() => validerConfig(config({ auteur: { nom: 'Neutre', email: 'neutre@users.noreply.github.com' } }))).toThrow(/compte GitHub/)
    expect(() => validerConfig(config({ auteur: { nom: 'Jean Dupont', email: 'x@exemple.invalid' } }))).toThrow(/vendeur : noms n°1/)
    expect(() => validerConfig(config({ vendeur: {} }))).toThrow(/aucune donnée du vendeur/)
    expect(() => validerConfig(config({ message: 'Version de Jean Dupont' }))).toThrow(/message du commit porte une donnée du vendeur \(vendeur : noms n°1\)/)
    expect(validerConfig(config({ message: 'Gtracker 1.0' })).message).toBe('Gtracker 1.0')
  })

  it('une configuration illisible est refusée sans en citer d\'extrait', () => {
    const chemin = join(mkdtempSync(join(tmpdir(), 'livraison-config-')), 'livraison.json')
    writeFileSync(chemin, '{ "vendeur": { "noms": ["Jean Dupont"] } oups }')
    let message = ''
    try {
      lireConfig(chemin)
    } catch (e) {
      message = e.message
    }
    expect(message).toMatch(/^configuration illisible .* : JSON invalide/)
    expect(message).not.toMatch(/Dupont|oups/)
  })

  it('lit l\'identité de l\'application', () => {
    const gradle = 'android {\n    namespace = "org.exemple.app"\n    defaultConfig {\n        applicationId "org.exemple.app"\n'
    expect(identiteApplication(gradle, "  appId: 'org.exemple.app',")).toEqual({ applicationId: 'org.exemple.app', namespace: 'org.exemple.app', appId: 'org.exemple.app' })
    expect(identiteApplication('', null)).toEqual({ applicationId: null, namespace: null, appId: null })
  })

  it('lit les arguments', () => {
    expect(lireArguments(['--sortie', 'x', '--verifier'])).toEqual({ sortie: 'x', aBlanc: false, verifier: true })
    expect(() => lireArguments(['--sortie'])).toThrow(/demande un dossier/)
    expect(() => lireArguments(['--vite'])).toThrow(/inconnu/)
    expect(() => lireArguments(['--a-blanc', '--verifier'])).toThrow(/s'excluent/)
  })
})

describe('dossier de sortie', () => {
  const R = resolve('/essai/depot')
  const acces = (existants, contenus = {}) => ({
    existe: (p) => existants.includes(p),
    lister: (p) => contenus[p] ?? [],
    estDossier: () => true,
    reel: (p) => p,
  })

  it('compare les chemins réels : une sortie qui passe par une jonction vers le dépôt est dans le dépôt', () => {
    const lien = resolve('/autre/lien')
    const a = { ...acces([lien]), reel: (p) => (p === lien ? join(R, 'sous') : p) }
    expect(() => controlerSortie(join(lien, 'remis'), R, { acces: a })).toThrow(/dans le dépôt/)
  })

  it('un dossier du dépôt dont le nom commence par deux points reste dans le dépôt', () => {
    expect(() => controlerSortie(join(R, '..remis'), R, { acces: acces([]) })).toThrow(/dans le dépôt/)
    expect(controlerSortie(resolve('/essai/depot-remis'), R, { acces: acces([]) })).toBe('neuf')
  })

  it('refuse une sortie dans le dépôt ou qui le contient', () => {
    expect(() => controlerSortie(join(R, 'remis'), R, { acces: acces([]) })).toThrow(/dans le dépôt/)
    expect(() => controlerSortie(R, R, { acces: acces([]) })).toThrow(/dans le dépôt/)
    expect(() => controlerSortie(resolve('/essai'), R, { acces: acces([]) })).toThrow(/contient le dépôt/)
    expect(() => controlerSortie('relatif', R, { acces: acces([]) })).toThrow(/absolu/)
  })

  it('refuse un node_modules dans un dossier parent, sauf si le contrôle est levé', () => {
    const sortie = resolve('/autre/remis')
    const a = acces([join(resolve('/autre'), 'node_modules')])
    expect(() => controlerSortie(sortie, R, { acces: a })).toThrow(/node_modules/)
    expect(controlerSortie(sortie, R, { acces: a, verifierParents: false })).toBe('neuf')
  })

  it('absente, vide, marquée ; refuse un dossier non vide sans marque', () => {
    const s = resolve('/autre/remis')
    expect(controlerSortie(s, R, { acces: acces([]) })).toBe('neuf')
    expect(controlerSortie(s, R, { acces: acces([s]) })).toBe('vide')
    expect(controlerSortie(s, R, { acces: acces([s, join(s, '.git', 'livraison-gtracker')], { [s]: ['.git'] }) })).toBe('marque')
    expect(() => controlerSortie(s, R, { acces: acces([s], { [s]: ['photos'] }) })).toThrow(/sans la marque/)
  })
})

describe('de bout en bout, dans un dépôt jetable', () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const VENDEUR = 'Vendeur Essai'
  const COURRIEL = 'vendeur.essai@exemple.invalid'

  function source({ readme = 'Titre\n\n<!-- atelier -->\nVoir le reste à faire.\n<!-- /atelier -->\n\nFin.\n' } = {}) {
    const base = mkdtempSync(join(tmpdir(), 'livraison-'))
    const racine = join(base, 'depot')
    mkdirSync(racine)
    git(racine, 'init', '-q', '-b', 'main')
    git(racine, 'config', 'user.name', VENDEUR)
    git(racine, 'config', 'user.email', COURRIEL)
    git(racine, 'config', 'commit.gpgsign', 'false')
    const ecrire = (chemin, texte) => {
      mkdirSync(join(racine, chemin, '..'), { recursive: true })
      writeFileSync(join(racine, chemin), texte)
    }
    ecrire('.gitattributes', '* text=auto eol=lf\n*.bat text eol=crlf\n')
    ecrire('README.md', readme)
    ecrire('ARCHITECTURE.md', 'Règles.\n')
    ecrire('CLAUDE.md', 'Consignes.\n')
    ecrire('docs/backlog/1-essai.md', 'Fiche.\n')
    ecrire('package.json', JSON.stringify({ name: 'essai', version: '1.0.0', scripts: { test: 'vitest run', backlog: 'node outils/backlog.mjs' } }, null, 2) + '\n')
    ecrire('outils/lancer.bat', 'echo un\r\necho deux\r\n')
    ecrire('outils/gradlew', '#!/bin/sh\necho ok\n')
    // Hors de Windows, git lit le bit exécutable sur le disque : sans lui, le second commit (`commit -a`) le retirerait.
    chmodSync(join(racine, 'outils/gradlew'), 0o755)
    ecrire('dossier avec espace/note.md', 'Note.\n')
    ecrire('android/app/build.gradle', 'android {\n    namespace = "org.exemple.essai"\n    defaultConfig {\n        applicationId "org.exemple.essai"\n    }\n}\n')
    ecrire('capacitor.config.ts', "export default {\n  appId: 'org.exemple.essai',\n}\n")
    git(racine, 'add', '-A')
    git(racine, 'update-index', '--chmod=+x', 'outils/gradlew')
    git(racine, 'commit', '-q', '-m', 'premier')
    git(racine, 'tag', 'v1')
    ecrire('ARCHITECTURE.md', 'Règles, version deux.\n')
    git(racine, 'commit', '-q', '-am', 'second')
    const config = join(base, 'livraison.json')
    writeFileSync(config, JSON.stringify({ auteur: { nom: 'Neutre', email: 'neutre@exemple.invalid' }, vendeur: { noms: [VENDEUR], emails: [COURRIEL] } }))
    return { base, racine, config, ecrire }
  }

  const lancer = (racine, config, argv, attendus = ['ARCHITECTURE.md', 'README.md']) => {
    const sortie = []
    const code = principal(argv, { racine, ecrire: (s) => sortie.push(s), env: { GTRACKER_LIVRAISON: config }, verifierParents: false, listes: { attendus } })
    return { code, sortie, texte: sortie.join('\n') }
  }
  const etat = (racine) => [git(racine, 'rev-parse', 'HEAD'), git(racine, 'status', '--porcelain', '-uall'), git(racine, 'ls-files', '-s')]

  it('un commit neutre, sans étiquette ni atelier, mode et CRLF gardés ; la source ne bouge pas', () => {
    const { base, racine, config } = source()
    const avant = etat(racine)
    const remis = join(base, 'remis')

    const blanc = lancer(racine, config, ['--sortie', remis, '--a-blanc'])
    expect(blanc.code).toBe(0)
    expect(blanc.texte).toContain('2 partent, 9 restent, dont 2 transformés')
    expect(blanc.texte).toContain('partent : CLAUDE.md, docs/backlog/ (1)')
    expect(blanc.texte).toContain('transformés : README.md, package.json (scripts retirés : backlog)')
    expect(existsSync(remis)).toBe(false)

    const vrai = lancer(racine, config, ['--sortie', remis])
    expect(vrai.texte).not.toContain('ÉCHEC')
    expect(vrai.code).toBe(0)
    expect(vrai.sortie.at(-1)).toBe(`Livrable : ${remis}`)
    expect(vrai.texte).not.toContain(VENDEUR)
    expect(vrai.texte).not.toContain(COURRIEL)

    expect(git(remis, 'rev-list', '--all', '--count').trim()).toBe('1')
    expect(git(remis, 'tag').trim()).toBe('')
    expect(git(remis, 'log', '--all', '--format=%an %ae %cn %ce').trim()).toBe('Neutre neutre@exemple.invalid Neutre neutre@exemple.invalid')
    expect(git(remis, 'ls-tree', 'HEAD', 'outils/gradlew').split(' ')[0]).toBe('100755')
    expect(readFileSync(join(remis, 'outils', 'lancer.bat'), 'utf8')).toBe('echo un\r\necho deux\r\n')
    expect(git(remis, 'rev-parse', 'HEAD:outils/lancer.bat')).toBe(git(racine, 'rev-parse', 'HEAD:outils/lancer.bat'))
    expect(existsSync(join(remis, 'CLAUDE.md'))).toBe(false)
    expect(existsSync(join(remis, 'docs'))).toBe(false)
    expect(existsSync(join(remis, 'dossier avec espace', 'note.md'))).toBe(true)
    expect(readFileSync(join(remis, 'README.md'), 'utf8')).toBe('Titre\n\nFin.\n')
    expect(JSON.parse(readFileSync(join(remis, 'package.json'), 'utf8')).scripts).toEqual({ test: 'vitest run' })
    expect(git(remis, 'status', '--porcelain')).toBe('')
    expect(etat(racine)).toEqual(avant)

    // Le dossier porte la marque : un second passage le refait.
    const encore = lancer(racine, config, ['--sortie', remis])
    expect(encore.code).toBe(0)
    expect(git(remis, 'rev-list', '--all', '--count').trim()).toBe('1')
  })

  it('un passage interrompu reste rejouable ; ni hook ni modèle d\'init de la configuration globale du poste', () => {
    const { base, racine, config } = source()
    const remis = join(base, 'remis')
    mkdirSync(join(remis, '.git'), { recursive: true })
    writeFileSync(join(remis, '.git', 'livraison-gtracker'), 'marque\n')
    writeFileSync(join(remis, 'reste-du-passage.txt'), 'x\n')
    const barres = (p) => p.replace(/\\/g, '/')
    const modele = join(base, 'modele')
    mkdirSync(modele)
    writeFileSync(join(modele, 'mouchard.txt'), 'x\n')
    const crochets = join(base, 'crochets')
    mkdirSync(crochets)
    const temoin = join(base, 'crochet-lance.txt')
    writeFileSync(join(crochets, 'post-commit'), `#!/bin/sh\necho oui > "${barres(temoin)}"\n`)
    const globale = join(base, 'gitconfig')
    writeFileSync(globale, `[init]\n\ttemplateDir = ${barres(modele)}\n[core]\n\thooksPath = ${barres(crochets)}\n`)
    const avant = process.env.GIT_CONFIG_GLOBAL
    process.env.GIT_CONFIG_GLOBAL = globale
    let r
    try {
      r = lancer(racine, config, ['--sortie', remis])
    } finally {
      if (avant === undefined) delete process.env.GIT_CONFIG_GLOBAL
      else process.env.GIT_CONFIG_GLOBAL = avant
    }
    expect(r.code).toBe(0)
    expect(existsSync(join(remis, 'reste-du-passage.txt'))).toBe(false)
    expect(existsSync(join(remis, '.git', 'livraison-gtracker'))).toBe(true)
    expect(existsSync(join(remis, '.git', 'mouchard.txt'))).toBe(false)
    expect(existsSync(temoin)).toBe(false)
    expect(git(remis, 'rev-list', '--all', '--count').trim()).toBe('1')
  })

  it('non livrable : donnée du vendeur, nom ancien, fichier attendu absent ; le dossier reste', () => {
    const { base, racine, config, ecrire } = source()
    ecrire('notes.txt', `écrit par ${VENDEUR}\nrien\n${ANCIEN}\n`)
    git(racine, 'add', '-A')
    git(racine, 'commit', '-q', '-m', 'notes')
    const remis = join(base, 'remis')
    const r = lancer(racine, config, ['--sortie', remis], ['ARCHITECTURE.md', 'CONTRIBUER.md'])
    expect(r.code).toBe(1)
    expect(r.texte).toContain('ÉCHEC : recherche « vendeur : noms n°1 »\n  1 trouvailles : notes.txt (1 : 1)')
    expect(r.texte).toContain('ÉCHEC : recherche « nom de l\'ancienne application »\n  1 trouvailles : notes.txt (1 : 3)')
    expect(r.texte).toContain('absent : CONTRIBUER.md')
    expect(r.texte).toContain('passé : un seul commit')
    expect(r.texte).not.toContain(VENDEUR)
    expect(r.sortie.at(-1)).toMatch(/^Non livrable : 3 contrôles en échec/)
    expect(existsSync(join(remis, 'notes.txt'))).toBe(true)
  })

  it('refus sans rien toucher : dossier non vide sans marque, sortie dans le dépôt, configuration absente, bloc non refermé', () => {
    const { base, racine, config } = source()
    const occupe = join(base, 'occupe')
    mkdirSync(occupe)
    writeFileSync(join(occupe, 'photo.txt'), 'à garder\n')
    const r1 = lancer(racine, config, ['--sortie', occupe])
    expect(r1.code).toBe(2)
    expect(r1.texte).toMatch(/sans la marque/)
    expect(readFileSync(join(occupe, 'photo.txt'), 'utf8')).toBe('à garder\n')

    expect(lancer(racine, config, ['--sortie', join(racine, 'remis')]).texte).toMatch(/dans le dépôt de travail/)
    expect(lancer(racine, join(base, 'absente.json'), ['--sortie', join(base, 'remis')]).texte).toMatch(/configuration hors dépôt introuvable/)

    const autre = source({ readme: 'Titre\n<!-- atelier -->\nnon refermé\n' })
    const remis = join(autre.base, 'remis')
    const r2 = lancer(autre.racine, autre.config, ['--sortie', remis])
    expect(r2.code).toBe(2)
    expect(r2.texte).toContain('README.md:2 : bloc d\'atelier jamais refermé')
    expect(existsSync(remis)).toBe(false)
  })
})
