import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lireBacklog } from './backlog.mjs'
import {
  ErreurFinDeLot,
  appliquerFinDeLot,
  codeAChange,
  etatFinal,
  lireArguments,
  lireEssais,
  poserVersionLock,
  poserVersionPackage,
  principal,
  versionDuPackage,
  versionSuivante,
} from './fin-de-lot.mjs'

const AUJOURDHUI = new Date(2026, 10, 14) // 14/11/2026

/** Reste à faire fabriqué : un lot en cours (12), un lot déjà à valider avec un essai (10), des zones voisines. */
function fichier({ lot = '- 12 · [outil] Ce lot : titre · noté 13/11 · petit · Sonnet/high · en cours · détail : docs/backlog/12-ce-lot.md' } = {}) {
  return [
    '# Reste à faire',
    '',
    'Prochains numéros : élément 30, essai 20, question Q5.',
    '- Une ligne par élément : `- N · [type] Titre · …` (règle, ignorée par le lecteur).',
    '',
    '## Maintenant',
    '',
    'APK 1.2.3 installée le 13/11.',
    '',
    '- 10 · [idée] Icône · noté 12/11 · petit · Sonnet/medium · à valider (abc, 1.2.3)',
    '  - essai 19 : bouton rond → disque blanc.',
    lot,
    '',
    '## Ensuite',
    '',
    '1. 13 · [dette] Dépendances · noté 11/11 · petit · Opus/medium · à briefer',
    '',
    '## Ça attend une occasion',
    '',
    '**Une sortie**',
    '- essai 6 : une session → vagues.',
    '',
    '## Plus tard',
    '',
    '- 16 · [idée] Mode daltonien · noté 08/11 · gros',
    '',
    '## Questions',
    '',
    '- Q3 · lot 15 · Lequel ? · par défaut : le premier · posée le 10/11',
    '',
  ].join('\n')
}

describe('version', () => {
  it('augmente le troisième nombre, sur deux chiffres', () => {
    expect(versionSuivante('0.00.66')).toBe('0.00.67')
    expect(versionSuivante('0.00.09')).toBe('0.00.10')
    expect(versionSuivante('0.00.99')).toBe('0.00.100')
    expect(() => versionSuivante('1.2')).toThrow(ErreurFinDeLot)
  })

  it('ne bouge que pour un changement sous src/ ou android/', () => {
    expect(codeAChange(' M src/core/units.ts\n?? docs/backlog/12.md')).toBe(true)
    expect(codeAChange('?? android/app/src/Foo.java')).toBe(true)
    expect(codeAChange('R  docs/a.md -> src/b.ts')).toBe(true)
    expect(codeAChange(' M docs/BACKLOG.md\n M outils/verif.mjs\n M package.json')).toBe(false)
    expect(codeAChange(' M source/x.ts')).toBe(false)
    expect(codeAChange('')).toBe(false)
  })

  it('pose la version dans package.json et dans le verrou (tête et paquet racine), le reste au caractère près', () => {
    const paquet = '{\n  "name": "gtracker",\n  "private": true,\n  "version": "0.00.66",\n  "type": "module"\n}\n'
    expect(versionDuPackage(paquet)).toBe('0.00.66')
    expect(poserVersionPackage(paquet, '0.00.66', '0.00.67')).toBe(paquet.replace('0.00.66', '0.00.67'))
    const lock = '{\n  "name": "gtracker",\n  "version": "0.00.66",\n  "packages": {\n    "": {\n      "name": "gtracker",\n      "version": "0.00.66",\n      "dependencies": {}\n    },\n    "node_modules/x": {\n      "version": "0.00.66"\n    }\n  }\n}\n'
    const pose = poserVersionLock(lock, '0.00.66', '0.00.67')
    expect(pose.change).toBe(true)
    expect(pose.texte.match(/0\.00\.67/g)).toHaveLength(2)
    expect(pose.texte).toContain('"node_modules/x": {\n      "version": "0.00.66"')
    const autre = poserVersionLock(lock.replaceAll('"gtracker",\n  "version": "0.00.66"', '"gtracker",\n  "version": "0.00.50"'), '0.00.66', '0.00.67')
    expect(autre.change).toBe(false)
  })
})

describe('lireEssais', () => {
  it('lit « quoi → attendu », une puce éventuelle, ignore les lignes vides', () => {
    expect(lireEssais('ouvrir X → Y s\'affiche\n\n- fermer → rien\n')).toEqual([
      { quoi: 'ouvrir X', attendu: 'Y s\'affiche' },
      { quoi: 'fermer', attendu: 'rien' },
    ])
  })
  it('refuse une ligne sans flèche, avec la ligne en cause', () => {
    expect(() => lireEssais('ok → bien\nsans flèche')).toThrow(/ligne 2/)
    expect(() => lireEssais('→ vide')).toThrow(ErreurFinDeLot)
  })
})

describe('etatFinal', () => {
  it('cite la version si elle a changé, sinon la date, et ne change rien pour un lot coupé', () => {
    expect(etatFinal({ version: '0.00.67', aujourdhui: AUJOURDHUI })).toBe('à valider (commit en cours, version 0.00.67)')
    expect(etatFinal({ version: null, aujourdhui: AUJOURDHUI })).toBe('à valider (commit en cours, 14/11)')
    expect(etatFinal({ version: '0.00.67', aujourdhui: AUJOURDHUI, lecture: true })).toBe('à valider sur lecture (commit en cours, version 0.00.67)')
    expect(etatFinal({ version: null, aujourdhui: AUJOURDHUI, enCours: true })).toBeNull()
  })
})

describe('appliquerFinDeLot', () => {
  const essais = [
    { quoi: 'ouvrir Réglages', attendu: 'le cadre est replié' },
    { quoi: 'toucher le titre', attendu: 'il se déplie' },
  ]

  it('passe la ligne à « à valider », numérote les essais, met l\'en-tête à jour, et la forme reste bonne', () => {
    const res = appliquerFinDeLot(fichier(), { numero: 12, version: '0.00.67', aujourdhui: AUJOURDHUI, essais })
    expect(res.essais.map((e) => e.numero)).toEqual([20, 21])
    const lignes = res.texte.split('\n')
    const i = lignes.findIndex((l) => l.startsWith('- 12 · '))
    expect(lignes[i]).toBe('- 12 · [outil] Ce lot : titre · noté 13/11 · petit · Sonnet/high · à valider (commit en cours, version 0.00.67) · détail : docs/backlog/12-ce-lot.md')
    expect(lignes[i + 1]).toBe('  - essai 20 : ouvrir Réglages → le cadre est replié')
    expect(lignes[i + 2]).toBe('  - essai 21 : toucher le titre → il se déplie')
    expect(lignes).toContain('Prochains numéros : élément 30, essai 22, question Q5.')
    const r = lireBacklog(res.texte, AUJOURDHUI)
    expect(r.erreurs).toEqual([])
    const lot = r.maintenant.find((e) => e.numero === 12)
    expect(lot.essais.map((e) => e.numero)).toEqual([20, 21])
    // Le reste du fichier ne bouge pas.
    expect(res.texte.split('\n')).toHaveLength(fichier().split('\n').length + 2)
  })

  it('ajoute les essais après ceux déjà posés sous le lot', () => {
    const avant = fichier({ lot: '- 12 · [outil] Ce lot · noté 13/11 · en cours (partie A)\n  - essai 19 : déjà là → oui' })
      .replace('  - essai 19 : bouton rond → disque blanc.', '  - essai 17 : bouton rond → disque blanc.')
    const res = appliquerFinDeLot(avant, { numero: 12, version: null, aujourdhui: AUJOURDHUI, essais: [essais[0]] })
    const lignes = res.texte.split('\n')
    const i = lignes.findIndex((l) => l.startsWith('- 12 · '))
    expect(lignes[i]).toBe('- 12 · [outil] Ce lot · noté 13/11 · à valider (commit en cours, 14/11)')
    expect(lignes[i + 1]).toBe('  - essai 19 : déjà là → oui')
    expect(lignes[i + 2]).toBe('  - essai 20 : ouvrir Réglages → le cadre est replié')
    expect(lireBacklog(res.texte, AUJOURDHUI).erreurs).toEqual([])
  })

  it('sur lecture : état « à valider sur lecture », aucun essai, en-tête inchangé', () => {
    const res = appliquerFinDeLot(fichier(), { numero: 12, version: null, aujourdhui: AUJOURDHUI, lecture: true })
    expect(res.ligne).toContain(' · à valider sur lecture (commit en cours, 14/11) · détail :')
    expect(res.texte).toContain('Prochains numéros : élément 30, essai 20, question Q5.')
    expect(res.essais).toEqual([])
  })

  it('lot coupé : l\'état reste « en cours », la ligne ne change pas, les essais s\'ajoutent si donnés', () => {
    const sans = appliquerFinDeLot(fichier(), { numero: 12, version: '0.00.67', aujourdhui: AUJOURDHUI, enCours: true })
    expect(sans.texte).toBe(fichier())
    const avec = appliquerFinDeLot(fichier(), { numero: 12, version: null, aujourdhui: AUJOURDHUI, enCours: true, essais: [essais[0]] })
    expect(avec.ligne).toBe(fichier().split('\n').find((l) => l.startsWith('- 12 · ')))
    expect(avec.texte).toContain('  - essai 20 : ouvrir Réglages → le cadre est replié')
    expect(avec.texte).toContain('essai 21, question Q5')
  })

  it('garde les fins de ligne CRLF', () => {
    const res = appliquerFinDeLot(fichier().replaceAll('\n', '\r\n'), { numero: 12, version: null, aujourdhui: AUJOURDHUI, essais })
    expect(res.texte.replaceAll('\r\n', '')).not.toContain('\n')
    expect(lireBacklog(res.texte, AUJOURDHUI).erreurs).toEqual([])
  })

  it('refuse, sans rien produire : lot absent, hors de Maintenant, pas « en cours », options contraires', () => {
    const base = { aujourdhui: AUJOURDHUI, version: null, essais }
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 99 })).toThrow(/introuvable/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 13 })).toThrow(/pas dans Maintenant \(il est en Ensuite\)/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 16 })).toThrow(/Plus tard/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 10 })).toThrow(/pas « en cours » \(état : à valider/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 12, lecture: true })).toThrow(/--lecture et --essais/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 12, essais: [] })).toThrow(/sans --essais/)
    expect(() => appliquerFinDeLot(fichier(), { ...base, numero: 12, essais: [], lecture: true, enCours: true })).toThrow(/s'excluent/)
  })
})

describe('lireArguments', () => {
  it('lit le numéro et les options', () => {
    expect(lireArguments(['353', '--message', 'm.txt', '--essais', 'e.txt', '--a-blanc'])).toEqual({
      numero: 353, message: 'm.txt', essais: 'e.txt', lecture: false, enCours: false, aBlanc: true,
    })
    expect(lireArguments(['--lecture', '7', '--message', 'm.txt']).lecture).toBe(true)
  })
  it('refuse l\'oubli du numéro ou du message, et une option inconnue', () => {
    expect(() => lireArguments(['--message', 'm.txt'])).toThrow(/usage/)
    expect(() => lireArguments(['7'])).toThrow(/--message/)
    expect(() => lireArguments(['7', '--message'])).toThrow(/demande un fichier/)
    expect(() => lireArguments(['7', '--vite', '--message', 'm'])).toThrow(/inconnu/)
  })
})

describe('de bout en bout, dans un dépôt jetable', () => {
  const git = (racine, ...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

  function depot() {
    const racine = mkdtempSync(join(tmpdir(), 'fin-de-lot-'))
    git(racine, 'init', '-q')
    git(racine, 'config', 'user.name', 'Essai')
    git(racine, 'config', 'user.email', 'essai@example.invalid')
    git(racine, 'config', 'commit.gpgsign', 'false')
    mkdirSync(join(racine, 'docs'))
    mkdirSync(join(racine, 'src'))
    writeFileSync(join(racine, 'docs', 'BACKLOG.md'), fichier())
    writeFileSync(join(racine, 'package.json'), '{\n  "name": "gtracker",\n  "version": "0.00.66"\n}\n')
    writeFileSync(join(racine, 'package-lock.json'), '{\n  "name": "gtracker",\n  "version": "0.00.66",\n  "packages": {\n    "": {\n      "name": "gtracker",\n      "version": "0.00.66"\n    }\n  }\n}\n')
    writeFileSync(join(racine, 'src', 'a.ts'), 'export const a = 1\n')
    git(racine, 'add', '-A')
    git(racine, 'commit', '-q', '-m', 'départ')
    writeFileSync(join(racine, 'message.txt'), 'Lot 12, à valider : un titre.\n\nCorps du message, accentué : é è œ.\n')
    writeFileSync(join(racine, 'essais.txt'), 'ouvrir → ça marche\n')
    return racine
  }
  const lancer = (racine, argv) => {
    const sortie = []
    const code = principal(argv, { racine, aujourdhui: AUJOURDHUI, ecrire: (s) => sortie.push(s) })
    return { code, sortie }
  }

  it('pose version, ligne, essais, puis commite le message tel quel ; à blanc n\'écrit rien', () => {
    const racine = depot()
    writeFileSync(join(racine, 'src', 'a.ts'), 'export const a = 2\n')
    const avant = readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')

    const blanc = lancer(racine, ['12', '--message', join(racine, 'message.txt'), '--essais', join(racine, 'essais.txt'), '--a-blanc'])
    expect(blanc.code).toBe(0)
    expect(blanc.sortie.length).toBeLessThanOrEqual(5)
    expect(blanc.sortie[0]).toBe('Version : 0.00.66 → 0.00.67')
    expect(readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')).toBe(avant)
    expect(git(racine, 'log', '--format=%s')).not.toContain('Lot 12')

    const vrai = lancer(racine, ['12', '--message', join(racine, 'message.txt'), '--essais', join(racine, 'essais.txt')])
    expect(vrai.code).toBe(0)
    expect(vrai.sortie.length).toBeLessThanOrEqual(5)
    expect(vrai.sortie[0]).toBe('Version : 0.00.66 → 0.00.67')
    expect(vrai.sortie).toContain('Essais : 20')
    expect(git(racine, 'log', '-1', '--format=%B').trim()).toBe(readFileSync(join(racine, 'message.txt'), 'utf8').trim())
    expect(git(racine, 'status', '--porcelain')).not.toContain('docs/BACKLOG.md')
    expect(readFileSync(join(racine, 'package.json'), 'utf8')).toContain('"version": "0.00.67"')
    expect(readFileSync(join(racine, 'package-lock.json'), 'utf8').match(/0\.00\.67/g)).toHaveLength(2)
    const texte = readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')
    expect(texte).toContain('à valider (commit en cours, version 0.00.67)')
    expect(texte).toContain('  - essai 20 : ouvrir → ça marche')
    expect(lireBacklog(texte, AUJOURDHUI).erreurs).toEqual([])
  })

  it('laisse la version quand seul docs/ a changé, et refuse un lot qui n\'est plus en cours sans rien toucher', () => {
    const racine = depot()
    writeFileSync(join(racine, 'docs', 'notes.md'), 'x\n')
    const premier = lancer(racine, ['12', '--message', join(racine, 'message.txt'), '--lecture'])
    expect(premier.code).toBe(0)
    expect(premier.sortie[0]).toBe('Version : inchangée (0.00.66)')
    expect(readFileSync(join(racine, 'package.json'), 'utf8')).toContain('0.00.66')
    expect(readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')).toContain('à valider sur lecture (commit en cours, 14/11)')

    const avant = git(racine, 'rev-parse', 'HEAD')
    const second = lancer(racine, ['12', '--message', join(racine, 'message.txt'), '--lecture'])
    expect(second.code).toBe(1)
    expect(second.sortie[0]).toMatch(/pas « en cours »/)
    expect(git(racine, 'rev-parse', 'HEAD')).toBe(avant)
    expect(existsSync(join(racine, 'message.txt'))).toBe(true)
  })

  it('un reste à faire qui sortirait mal formé arrête tout : fichiers intacts, pas de commit', () => {
    const racine = depot()
    // Le lot 12 est écrit avec une date illisible : la ligne d'origine est déjà mal formée.
    writeFileSync(join(racine, 'docs', 'BACKLOG.md'), fichier({ lot: '- 12 · [outil] Ce lot · noté 99/99 · en cours' }))
    writeFileSync(join(racine, 'src', 'a.ts'), 'export const a = 3\n')
    const avant = readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')
    const tete = git(racine, 'rev-parse', 'HEAD')
    const { code, sortie } = lancer(racine, ['12', '--message', join(racine, 'message.txt'), '--lecture'])
    expect(code).toBe(1)
    expect(sortie[0]).toMatch(/mal formé, rien n'est touché/)
    expect(readFileSync(join(racine, 'docs', 'BACKLOG.md'), 'utf8')).toBe(avant)
    expect(readFileSync(join(racine, 'package.json'), 'utf8')).toContain('0.00.66')
    expect(git(racine, 'rev-parse', 'HEAD')).toBe(tete)
  })
})
