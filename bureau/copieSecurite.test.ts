import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COPIE_ORDINATEUR, COPIE_TELEPHONE, FICHIER_COPIES, choixCopiesDepuisEnvironnement, copieSecurite, nomCopie, reglageCopies } from './copieSecurite'
import { dossierLocal } from './telephone'

let tmp: string
let memoire: string
let stockage: string
let copies: string

const MAINTENANT = new Date(2026, 10, 21, 14, 3, 7)

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'gtk-copie-'))
  memoire = path.join(tmp, 'Documents', 'Gtracker')
  copies = path.join(tmp, 'Documents', 'Gtracker-copies')
  stockage = path.join(tmp, 'telephone')
  const gtracker = path.join(stockage, 'Documents', 'Gtracker')
  await mkdir(path.join(memoire, 'sessions'), { recursive: true })
  await mkdir(path.join(memoire, 'corbeille', 'a'), { recursive: true })
  await mkdir(path.join(gtracker, 'sessions'), { recursive: true })
  await writeFile(path.join(memoire, 'gtracker.json'), '{"id":"pc"}')
  await writeFile(path.join(memoire, 'sessions', 'a.gpx'), 'trace du PC')
  await writeFile(path.join(memoire, 'sessions', 'b.gpx.gtracker-tmp'), 'provisoire')
  await writeFile(path.join(memoire, 'corbeille', 'a', 'c.gpx'), 'dans la corbeille')
  await writeFile(path.join(gtracker, 'gtracker.json'), '{"id":"tel"}')
  await writeFile(path.join(gtracker, 'sessions', 'd e.gpx'), 'trace du téléphone')
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('copie de sécurité', () => {
  it('nomme le dossier par la date et l’heure locales', () => {
    expect(nomCopie(MAINTENANT)).toBe('2026-11-21 14-03-07')
  })

  it('copie la mémoire entière (sans les provisoires) et ce que liste le téléphone, côte à côte', async () => {
    const dossier = await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT })
    expect(dossier).toBe(path.join(copies, '2026-11-21 14-03-07'))
    expect(await readFile(path.join(dossier, COPIE_ORDINATEUR, 'sessions', 'a.gpx'), 'utf8')).toBe('trace du PC')
    expect(await readFile(path.join(dossier, COPIE_ORDINATEUR, 'corbeille', 'a', 'c.gpx'), 'utf8')).toBe('dans la corbeille')
    expect(await readdir(path.join(dossier, COPIE_ORDINATEUR, 'sessions'))).toEqual(['a.gpx'])
    expect(await readFile(path.join(dossier, COPIE_TELEPHONE, 'sessions', 'd e.gpx'), 'utf8')).toBe('trace du téléphone')
    expect(await readFile(path.join(dossier, COPIE_TELEPHONE, 'gtracker.json'), 'utf8')).toBe('{"id":"tel"}')
    // La mémoire n'a pas bougé.
    expect(await readdir(path.join(memoire, 'sessions'))).toEqual(['a.gpx', 'b.gpx.gtracker-tmp'])
  })

  it('deux copies dans la même seconde : la seconde prend un autre nom, la première reste entière', async () => {
    const premiere = await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT })
    const seconde = await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT })
    expect(seconde).toBe(`${premiere} (2)`)
    expect(await readdir(copies)).toEqual(['2026-11-21 14-03-07', '2026-11-21 14-03-07 (2)'])
  })

  it('refuse des copies rangées dans la mémoire, sans rien écrire', async () => {
    await expect(copieSecurite({ memoire, telephone: dossierLocal(stockage), copies: path.join(memoire, 'copies'), maintenant: MAINTENANT })).rejects.toThrow(/mémoire/)
    expect(await readdir(memoire)).toEqual(['corbeille', 'gtracker.json', 'sessions'])
  })

  it('téléphone parti en route : l’erreur remonte, ce qui est copié reste sous un nom qui dit « incomplète »', async () => {
    const telephone = dossierLocal(stockage, { coupureApres: 1 })
    await expect(copieSecurite({ memoire, telephone, copies, maintenant: MAINTENANT })).rejects.toThrow()
    expect(await readdir(copies)).toEqual(['2026-11-21 14-03-07 incomplète'])
  })

  it('annonce son avancement : départ, mémoire de l’ordinateur d’un bloc, puis chaque fichier du téléphone', async () => {
    const avis: { fait: number; total: number }[] = []
    await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT, avancement: (a) => avis.push(a) })
    // Mémoire : trois fichiers (le provisoire ne compte pas) ; téléphone : deux.
    expect(avis).toEqual([{ fait: 0, total: 5 }, { fait: 3, total: 5 }, { fait: 4, total: 5 }, { fait: 5, total: 5 }])
  })

  it('un rappel d’avancement qui lève n’arrête pas la copie', async () => {
    const dossier = await copieSecurite({
      memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT,
      avancement: () => {
        throw new Error('page fermée')
      },
    })
    expect(await readFile(path.join(dossier, COPIE_TELEPHONE, 'gtracker.json'), 'utf8')).toBe('{"id":"tel"}')
  })
})

describe('dossier des copies retenu', () => {
  const profil = () => path.join(tmp, 'profil')

  it('sans choix, le dossier par défaut ; un dossier choisi est retenu dans le profil et relu par un autre lancement', async () => {
    const reglage = reglageCopies({ profil: profil(), defaut: copies, memoire: async () => memoire })
    expect(await reglage.dossier()).toBe(copies)
    const choisi = path.join(tmp, 'D', 'Sauvegardes')
    expect(await reglage.retenir(choisi)).toEqual({ issue: 'choisi', dossier: choisi })
    expect(JSON.parse(await readFile(path.join(profil(), FICHIER_COPIES), 'utf8'))).toEqual({ dossier: choisi })
    expect(await readdir(profil())).toEqual([FICHIER_COPIES])
    expect(await reglageCopies({ profil: profil(), defaut: copies }).dossier()).toBe(choisi)
    // La copie suivante va dans le dossier choisi.
    const dossier = await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies: await reglage.dossier(), maintenant: MAINTENANT })
    expect(path.dirname(dossier)).toBe(choisi)
  })

  it('refuse un dossier dans la mémoire, ou qui la contient, sans rien retenir', async () => {
    const reglage = reglageCopies({ profil: profil(), defaut: copies, memoire: async () => memoire })
    for (const chemin of [memoire, path.join(memoire, 'copies'), path.join(memoire, '..x'), path.join(memoire, '..'), path.join(memoire.toUpperCase(), 'x')]) {
      expect(await reglage.retenir(chemin), chemin).toEqual({ issue: 'memoire', dossier: copies })
    }
    await expect(readdir(profil())).rejects.toThrow()
    expect(await reglage.dossier()).toBe(copies)
  })

  it('un réglage illisible ou un chemin relatif laissent le dossier par défaut', async () => {
    await mkdir(profil(), { recursive: true })
    for (const texte of ['pas du json', '{"dossier":"relatif\\\\copies"}', '{"dossier":3}', '{}']) {
      await writeFile(path.join(profil(), FICHIER_COPIES), texte)
      expect(await reglageCopies({ profil: profil(), defaut: copies }).dossier(), texte).toBe(copies)
    }
  })

  it('n’ouvre qu’un dossier existant sous un dossier des copies de ce lancement', async () => {
    const reglage = reglageCopies({ profil: profil(), defaut: copies, memoire: async () => memoire })
    const premiere = await copieSecurite({ memoire, telephone: dossierLocal(stockage), copies, maintenant: MAINTENANT })
    const choisi = path.join(tmp, 'Sauvegardes')
    await reglage.retenir(choisi)
    // Une copie faite avant le changement de dossier s'ouvre encore.
    expect(await reglage.ouvrable(premiere)).toBe(true)
    expect(await reglage.ouvrable(copies)).toBe(true)
    expect(await reglage.ouvrable(path.join(premiere, COPIE_ORDINATEUR))).toBe(true)
    // Dossier choisi pas encore créé, mémoire, parent, chemin relatif ou mal formé : refusés.
    for (const chemin of [choisi, memoire, tmp, path.join(copies, '..', 'Gtracker'), 'Gtracker-copies', 3, null]) {
      expect(await reglage.ouvrable(chemin), String(chemin)).toBe(false)
    }
  })

  it('mode d’essai : jamais de fenêtre, la réponse vient de GTRACKER_BANC_COPIES', async () => {
    const fenetre = async () => 'fenêtre'
    expect(choixCopiesDepuisEnvironnement({}, fenetre)).toBe(fenetre)
    const journal: string[] = []
    const essai = choixCopiesDepuisEnvironnement({ GTRACKER_BANC: '1', GTRACKER_BANC_COPIES: path.join(tmp, 'essai') }, fenetre, (m) => journal.push(m))
    expect(await essai({ titre: 'x', depart: copies })).toBe(path.join(tmp, 'essai'))
    expect(await choixCopiesDepuisEnvironnement({ GTRACKER_BANC: '1' }, fenetre)({ titre: 'x', depart: copies })).toBeNull()
    expect(journal).toHaveLength(1)
  })
})
