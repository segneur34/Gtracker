import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COPIE_ORDINATEUR, COPIE_TELEPHONE, copieSecurite, nomCopie } from './copieSecurite'
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
})
