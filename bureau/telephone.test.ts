import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Reponse } from './pont'
import type { DossierDistant, FichierTelephone } from './telephone'
import {
  CANAUX_TELEPHONE,
  NOM_TELEPHONE_ESSAI,
  cheminAdmis,
  dossierLocal,
  essaiTelephoneDepuisEnvironnement,
  fichiersAdmis,
  gestionnairesTelephone,
  viderLectures,
} from './telephone'

let tmp: string
/** Mémoire partagée du téléphone d'essai (son `/sdcard`). */
let stockage: string
/** Son dossier `Documents/Gtracker`. */
let gtracker: string
/** Dossier temporaire des lectures, côté PC. */
let lectures: string

/** Date fixe des fichiers du téléphone d'essai, à la seconde. */
const DATE = new Date('2026-11-18T19:47:33Z')

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'gtk-telephone-'))
  stockage = path.join(tmp, 'telephone')
  gtracker = path.join(stockage, 'Documents', 'Gtracker')
  lectures = path.join(tmp, 'profil', 'telephone-lecture')
  await mkdir(path.join(gtracker, 'sessions'), { recursive: true })
  await mkdir(path.join(gtracker, 'itineraires'), { recursive: true })
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

async function poser(relatif: string, contenu: string): Promise<void> {
  const fichier = path.join(gtracker, ...relatif.split('/'))
  await writeFile(fichier, contenu, 'utf8')
  await utimes(fichier, DATE, DATE)
}

function valeur<T>(r: Reponse<T>): T {
  if (!r.ok) throw new Error(`réponse en échec : ${r.code} ${r.message}`)
  return r.valeur
}

/** Taille, date et contenu de chaque fichier du téléphone d'essai, pour vérifier qu'il n'a pas bougé. */
async function empreinte(dossier: string): Promise<string[]> {
  const lignes: string[] = []
  for (const entree of await readdir(dossier, { withFileTypes: true, recursive: true })) {
    const complet = path.join(entree.parentPath, entree.name)
    const s = await stat(complet)
    lignes.push(`${path.relative(dossier, complet)} ${entree.isFile() ? `${s.size} ${s.mtimeMs} ${await readFile(complet, 'utf8')}` : 'dossier'}`)
  }
  return lignes.sort()
}

describe('chemins admis', () => {
  it('garde les fichiers de la racine et de sessions/, écarte le reste', () => {
    expect(cheminAdmis('gtracker.json')).toBe(true)
    expect(cheminAdmis('sessions/sortie du 18 novembre é.gpx')).toBe(true)
    expect(cheminAdmis('itineraires/a.gpx')).toBe(false)
    expect(cheminAdmis('sessions/sous/a.gpx')).toBe(false)
    expect(cheminAdmis('sessions/..')).toBe(false)
    expect(cheminAdmis('../a.gpx')).toBe(false)
    expect(cheminAdmis('')).toBe(false)
    expect(cheminAdmis('sessions/')).toBe(false)
    expect(cheminAdmis('sessions/a:b.gpx')).toBe(false)
    expect(cheminAdmis('sessions/a.gpx.gtracker-tmp')).toBe(false)
  })

  it('écarte un chemin vu deux fois et trie le reste', () => {
    const f = (chemin: string, taille = 1): FichierTelephone => ({ chemin, taille, dateMs: 0 })
    expect(fichiersAdmis([f('sessions/b.gpx'), f('a.json'), f('sessions/x.gpx', 1), f('sessions/x.gpx', 2)])).toEqual([f('a.json'), f('sessions/b.gpx')])
  })
})

describe('dossier local', () => {
  it('liste la racine et sessions/ avec taille et date à la seconde, NOT_FOUND sans Documents/Gtracker', async () => {
    await poser('gtracker.json', '{}')
    await poser('sessions/sortie é.gpx', '<gpx/>')
    await poser('itineraires/tour.gpx', '<gpx/>')
    const t = dossierLocal(stockage)
    expect(await t.etat()).toEqual({ etat: 'pret', nom: NOM_TELEPHONE_ESSAI })
    expect(await t.lister()).toEqual([
      { chemin: 'gtracker.json', taille: 2, dateMs: DATE.getTime() },
      { chemin: 'sessions/sortie é.gpx', taille: 6, dateMs: DATE.getTime() },
    ])
    await rm(path.join(stockage, 'Documents'), { recursive: true })
    await expect(t.lister()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('est absent sans stockage, et suit un état imposé', async () => {
    expect(await dossierLocal(null).etat()).toEqual({ etat: 'absent' })
    expect(await dossierLocal(path.join(tmp, 'rien')).etat()).toEqual({ etat: 'absent' })
    const occupe = dossierLocal(stockage, { etatImpose: { etat: 'occupe' } })
    expect(await occupe.etat()).toEqual({ etat: 'occupe' })
    await expect(occupe.lister()).rejects.toMatchObject({ code: 'UNKNOWN' })
  })
})

describe('canaux du téléphone', () => {
  function canaux(t: DossierDistant, memoire: string | null = null) {
    const g = gestionnairesTelephone(t, lectures, { memoire: async () => memoire })
    return {
      etat: () => g['telephone:etat'](undefined),
      lister: () => g['telephone:lister'](undefined) as Promise<Reponse<FichierTelephone[]>>,
      lire: (argument: unknown) => g['telephone:lireOctets'](argument) as Promise<Reponse<Uint8Array>>,
    }
  }

  it('servent exactement les trois canaux', () => {
    expect(Object.keys(gestionnairesTelephone(dossierLocal(null), lectures))).toEqual(CANAUX_TELEPHONE.map((n) => `telephone:${n}`))
  })

  it('lisent un fichier du dernier listage, effacent le temporaire et ne touchent pas au téléphone', async () => {
    await poser('sessions/sortie du matin é.gpx', '<gpx>é</gpx>')
    await poser('gtracker.json', '{"v":1}')
    const avant = await empreinte(stockage)
    const c = canaux(dossierLocal(stockage))
    expect(valeur(await c.etat())).toEqual({ etat: 'pret', nom: NOM_TELEPHONE_ESSAI })
    const liste = valeur(await c.lister())
    expect(liste.map((f) => f.chemin)).toEqual(['gtracker.json', 'sessions/sortie du matin é.gpx'])
    const octets = valeur(await c.lire({ chemin: 'sessions/sortie du matin é.gpx' }))
    expect(Buffer.from(octets).toString('utf8')).toBe('<gpx>é</gpx>')
    expect(await readdir(lectures)).toEqual([])
    expect(await empreinte(stockage)).toEqual(avant)
  })

  it('refusent un chemin absent du dernier listage, avant tout listage comme après', async () => {
    await poser('sessions/a.gpx', 'a')
    await writeFile(path.join(stockage, 'secret.txt'), 'non')
    const c = canaux(dossierLocal(stockage))
    expect(await c.lire({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    valeur(await c.lister())
    for (const chemin of ['../../secret.txt', 'itineraires/b.gpx', 'sessions/b.gpx', '/sdcard/Documents/Gtracker/sessions/a.gpx']) {
      expect(await c.lire({ chemin })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    }
    expect(await c.lire('sessions/a.gpx')).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await c.lire({ chemin: 3 })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(valeur(await c.lire({ chemin: 'sessions/a.gpx' }))).toHaveLength(1)
  })

  it('oublient le listage quand un nouveau échoue', async () => {
    await poser('sessions/a.gpx', 'a')
    const c = canaux(dossierLocal(stockage))
    valeur(await c.lister())
    await rm(path.join(stockage, 'Documents'), { recursive: true })
    expect(await c.lister()).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await c.lire({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, code: 'UNKNOWN' })
  })

  it('font échouer une lecture dont la taille diffère du listage, et effacent son temporaire', async () => {
    const fichier: FichierTelephone = { chemin: 'sessions/a.gpx', taille: 10, dateMs: 0 }
    const recus: string[] = []
    const tronque: DossierDistant = {
      etat: async () => ({ etat: 'pret', nom: 'x' }),
      lister: async () => [fichier],
      lire: async (_f, local) => {
        recus.push(local)
        await writeFile(local, 'court')
      },
    }
    const c = canaux(tronque)
    valeur(await c.lister())
    const r = await c.lire({ chemin: 'sessions/a.gpx' })
    expect(r).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(r.ok ? '' : r.message).toContain('5 octets reçus sur 10')
    expect(path.dirname(recus[0])).toBe(lectures)
    expect(path.basename(recus[0])).toMatch(/^\d+\.gtracker-tmp$/)
    expect(await readdir(lectures)).toEqual([])
  })

  it('effacent le temporaire d’une lecture coupée en cours de route', async () => {
    const coupe: DossierDistant = {
      etat: async () => ({ etat: 'pret', nom: 'x' }),
      lister: async () => [{ chemin: 'sessions/a.gpx', taille: 10, dateMs: 0 }],
      lire: async (_f, local) => {
        await writeFile(local, 'moitié')
        throw new Error('débranché')
      },
    }
    const c = canaux(coupe)
    valeur(await c.lister())
    expect(await c.lire({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, message: 'débranché' })
    expect(await readdir(lectures)).toEqual([])
  })

  it('simulent le débranchement après n lectures, sans rien laisser', async () => {
    for (const n of ['a', 'b', 'c']) await poser(`sessions/${n}.gpx`, n)
    const c = canaux(dossierLocal(stockage, { coupureApres: 2 }))
    valeur(await c.lister())
    expect(valeur(await c.lire({ chemin: 'sessions/a.gpx' }))).toHaveLength(1)
    expect(valeur(await c.lire({ chemin: 'sessions/b.gpx' }))).toHaveLength(1)
    expect(await c.lire({ chemin: 'sessions/c.gpx' })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(valeur(await c.etat())).toEqual({ etat: 'absent' })
    expect(await readdir(lectures)).toEqual([])
  })

  it('vident les lectures restées au listage, sans toucher au reste du dossier', async () => {
    await mkdir(lectures, { recursive: true })
    await writeFile(path.join(lectures, '7.gtracker-tmp'), 'reste')
    await writeFile(path.join(lectures, 'autre.txt'), 'garde')
    valeur(await canaux(dossierLocal(stockage)).lister())
    expect(await readdir(lectures)).toEqual(['autre.txt'])
    await viderLectures(path.join(tmp, 'inexistant'))
  })

  it('refusent de lire si le dossier temporaire est dans la mémoire', async () => {
    await poser('sessions/a.gpx', 'a')
    expect(await canaux(dossierLocal(stockage), path.join(tmp, 'PROFIL')).lister()).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await canaux(dossierLocal(stockage), lectures).lister()).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(valeur(await canaux(dossierLocal(stockage), path.join(tmp, 'memoire')).lister())).toHaveLength(1)
  })

  it('passent une commande à la fois, dans l’ordre des appels', async () => {
    const journal: string[] = []
    let actives = 0
    const lent: DossierDistant = {
      etat: async () => {
        actives++
        journal.push(`début ${actives}`)
        await new Promise((fin) => setTimeout(fin, 20))
        actives--
        return { etat: 'absent' }
      },
      lister: async () => [],
      lire: async () => undefined,
    }
    const c = canaux(lent)
    await Promise.all([c.etat(), c.etat(), c.etat()])
    expect(journal).toEqual(['début 1', 'début 1', 'début 1'])
  })
})

describe('mode d’essai', () => {
  it('ne lit les variables du téléphone qu’en mode d’essai', () => {
    const env = { GTRACKER_BANC_TELEPHONE: 'C:\\telephone', GTRACKER_BANC_TELEPHONE_ETAT: 'occupe', GTRACKER_BANC_TELEPHONE_COUPURE: '2' }
    expect(essaiTelephoneDepuisEnvironnement(env, 'C:\\profil\\platform-tools')).toBeNull()
    expect(essaiTelephoneDepuisEnvironnement({ ...env, GTRACKER_BANC: '1' }, 'C:\\profil\\platform-tools')).toEqual({
      stockage: path.resolve('C:\\telephone'),
      etatImpose: { etat: 'occupe' },
      coupureApres: 2,
    })
  })

  it('est sans téléphone par défaut, et ignore une valeur inconnue en le disant', () => {
    const journal: string[] = []
    expect(essaiTelephoneDepuisEnvironnement({ GTRACKER_BANC: '1', GTRACKER_BANC_TELEPHONE_ETAT: 'branche', GTRACKER_BANC_TELEPHONE_COUPURE: 'deux' }, 'x', (m) => journal.push(m))).toEqual({
      stockage: null,
      etatImpose: null,
      coupureApres: null,
    })
    expect(journal).toHaveLength(3)
    expect(essaiTelephoneDepuisEnvironnement({ GTRACKER_BANC: '1', GTRACKER_BANC_TELEPHONE_ETAT: 'adbIntrouvable' }, 'C:\\p\\platform-tools')?.etatImpose).toEqual({
      etat: 'adbIntrouvable',
      dossier: 'C:\\p\\platform-tools',
    })
  })
})
