import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Reponse } from './pont'
import type { DossierDistant, FichierTelephone } from './telephone'
import { phoneVisibleNames, tempNameFor } from '../src/library/remoteTemps'
import {
  CANAUX_TELEPHONE,
  NOM_TELEPHONE_ESSAI,
  cheminAdmis,
  cheminDuCable,
  cheminEcrivable,
  commeLeTelephone,
  dossierLocal,
  essaiTelephoneDepuisEnvironnement,
  fichiersAdmis,
  gestionnairesTelephone,
  nomProvisoire,
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

describe('liste blanche des écritures', () => {
  it('admet les fichiers posés dans sessions/, itineraires/ et reglages/, et trois fichiers de la racine', () => {
    for (const chemin of ['sessions/sortie du 18 novembre é.gpx', "sessions/l'eau $x `id`; y.json", 'sessions/a.imu', 'itineraires/tour.gpx', 'reglages/pc-1.json', 'gtracker.json', 'fc-repos.json', 'lieux.json']) {
      expect(cheminEcrivable(chemin), chemin).toBe(true)
    }
  })

  it('refuse tout le reste', () => {
    for (const chemin of [
      '', 'LISEZMOI.txt', 'autre.json', 'Gtracker.json', 'gtracker.json/', '/gtracker.json', '../gtracker.json', 'sessions', 'sessions/', 'sessions/.', 'sessions/..',
      'sessions//a', 'sessions/a/b.gpx', 'journaux/a.json', 'en-attente/a.gpx', 'Sessions/a.gpx', 'sessions/a\nb', 'sessions/a\u0001b', 'sessions/a.gpx.gtracker-tmp',
      'sessions/a.gpx.gtracker-new', 'sessions/a\\b', 'sessions/C:a', 'sessions/a.', 'sessions/con.json', `sessions/${'x'.repeat(520)}`,
    ]) {
      expect(cheminEcrivable(chemin), JSON.stringify(chemin)).toBe(false)
    }
    for (const autre of [3, null, undefined, ['sessions/a.gpx'], { chemin: 'sessions/a.gpx' }]) expect(cheminEcrivable(autre)).toBe(false)
  })

  it('le câble liste aussi reglages/, le sans-fil non', () => {
    expect(cheminDuCable('reglages/pc.json')).toBe(true)
    expect(cheminAdmis('reglages/pc.json')).toBe(false)
    expect(cheminDuCable('itineraires/a.gpx')).toBe(false)
    expect(cheminDuCable('sessions/a.gpx')).toBe(true)
  })
})

describe('provisoires vus comme le téléphone', () => {
  const f = (chemin: string, taille = 1): FichierTelephone => ({ chemin, taille, dateMs: 0 })

  it('cache les créations et remplacements interrompus, montre sous son nom un remplacement seul', () => {
    expect(commeLeTelephone([f('sessions/a.gpx'), f('sessions/a.gpx.gtracker-tmp', 2), f('sessions/b.json.gtracker-tmp', 3), f('sessions/c.gpx.gtracker-new'), f('x.json.gtracker-tmp', 4)])).toEqual([
      { chemin: 'sessions/a.gpx', taille: 1, dateMs: 0, reel: 'sessions/a.gpx' },
      { chemin: 'sessions/b.json', taille: 3, dateMs: 0, reel: 'sessions/b.json.gtracker-tmp' },
      { chemin: 'x.json', taille: 4, dateMs: 0, reel: 'x.json.gtracker-tmp' },
    ])
  })

  it('suit la règle de l’application, dossier par dossier (src/library/remoteTemps.ts)', () => {
    const cas = [
      ['a', 'a.gtracker-tmp'], ['a.gtracker-tmp'], ['a.gtracker-new'], ['a.gtracker-new', 'a.gtracker-tmp'], ['A.GTRACKER-TMP', 'A'],
      ['.gtracker-tmp', '.gtracker-new', 'b'], ['a.gtracker-tmp.gtracker-tmp', 'a.gtracker-tmp'], ['x.json', 'y.gpx.gtracker-tmp', 'y.gpx.gtracker-new'],
    ]
    for (const noms of cas) {
      for (const dossier of ['', 'sessions/']) {
        const vus = commeLeTelephone(noms.map((n) => f(dossier + n))).map((v) => ({ name: v.chemin.slice(dossier.length), actual: v.reel.slice(dossier.length) }))
        expect(vus, noms.join(',')).toEqual(phoneVisibleNames(noms))
      }
    }
    for (const existe of [false, true]) expect(nomProvisoire('sessions/a.gpx', existe)).toBe(tempNameFor('sessions/a.gpx', existe))
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

/** Un fichier local à écrire sur le téléphone d'essai. */
async function aEcrire(contenu: string): Promise<string> {
  const local = path.join(tmp, `envoi-${Math.random().toString(36).slice(2)}`)
  await writeFile(local, contenu, 'utf8')
  return local
}

/** Noms du dossier `sessions/` du téléphone d'essai. */
const sessionsDuTelephone = async () => (await readdir(path.join(gtracker, 'sessions'))).sort()

describe('dossier local qui écrit et efface', () => {
  it('écrit un fichier neuf, puis le remplace, sans provisoire restant', async () => {
    const t = dossierLocal(stockage)
    await t.lister()
    const ecrit = await t.ecrire!("sessions/sortie d'été.gpx", await aEcrire('<gpx/>'), 6)
    expect(ecrit).toMatchObject({ chemin: "sessions/sortie d'été.gpx", taille: 6 })
    expect(ecrit.dateMs % 1000).toBe(0)
    await t.ecrire!("sessions/sortie d'été.gpx", await aEcrire('<gpx>2</gpx>'), 12)
    expect(await readFile(path.join(gtracker, 'sessions', "sortie d'été.gpx"), 'utf8')).toBe('<gpx>2</gpx>')
    expect(await sessionsDuTelephone()).toEqual(["sortie d'été.gpx"])
    await t.ecrire!('reglages/pc.json', await aEcrire('{}'), 2)
    expect((await t.lister()).map((x) => x.chemin)).toEqual(['reglages/pc.json', "sessions/sortie d'été.gpx"])
  })

  it('taille fausse : le provisoire est retiré, l’original intact', async () => {
    await poser('sessions/a.json', 'ancien')
    const t = dossierLocal(stockage)
    await expect(t.ecrire!('sessions/a.json', await aEcrire('nouveau'), 99)).rejects.toThrow('7 octets sur 99')
    expect(await readFile(path.join(gtracker, 'sessions', 'a.json'), 'utf8')).toBe('ancien')
    expect(await sessionsDuTelephone()).toEqual(['a.json'])
  })

  it('efface un seul fichier, sans effet s’il n’existe pas, jamais un dossier', async () => {
    await poser('sessions/a.gpx', 'a')
    await poser('sessions/b.gpx', 'b')
    const t = dossierLocal(stockage)
    await t.effacer!('sessions/a.gpx')
    await t.effacer!('sessions/a.gpx')
    expect(await sessionsDuTelephone()).toEqual(['b.gpx'])
    await mkdir(path.join(gtracker, 'reglages', 'sous.json'), { recursive: true })
    await expect(t.effacer!('reglages/sous.json')).rejects.toThrow("n'est pas un fichier")
  })

  it('lit et efface sous son vrai nom un remplacement interrompu que le téléphone montre', async () => {
    await poser('sessions/a.json.gtracker-tmp', 'complet')
    await poser('sessions/b.gpx.gtracker-new', 'moi')
    const t = dossierLocal(stockage)
    expect(await t.lister()).toEqual([{ chemin: 'sessions/a.json', taille: 7, dateMs: DATE.getTime() }])
    const local = path.join(tmp, 'lu')
    await t.lire({ chemin: 'sessions/a.json', taille: 7, dateMs: DATE.getTime() }, local)
    expect(await readFile(local, 'utf8')).toBe('complet')
    await t.effacer!('sessions/a.json')
    expect(await sessionsDuTelephone()).toEqual(['b.gpx.gtracker-new'])
  })

  it('efface l’original et son remplacement interrompu caché : rien ne revient au listage suivant', async () => {
    await poser('sessions/x.gpx', 'original')
    await poser('sessions/x.gpx.gtracker-tmp', 'reprendrait sa place')
    await poser('sessions/y.gpx', 'y')
    const t = dossierLocal(stockage)
    expect((await t.lister()).map((x) => x.chemin)).toEqual(['sessions/x.gpx', 'sessions/y.gpx'])
    await t.effacer!('sessions/x.gpx')
    expect(await sessionsDuTelephone()).toEqual(['y.gpx'])
    expect((await dossierLocal(stockage).lister()).map((x) => x.chemin)).toEqual(['sessions/y.gpx'])
  })

  it('un remplacement seul renommé depuis le listage est bien effacé, sans faux succès', async () => {
    await poser('sessions/a.json.gtracker-tmp', 'complet')
    const t = dossierLocal(stockage)
    expect((await t.lister()).map((x) => x.chemin)).toEqual(['sessions/a.json'])
    // L'application du téléphone achève le remplacement entre le listage et l'effacement.
    await rename(path.join(gtracker, 'sessions', 'a.json.gtracker-tmp'), path.join(gtracker, 'sessions', 'a.json'))
    await t.effacer!('sessions/a.json')
    expect(await sessionsDuTelephone()).toEqual([])
  })

  it('refuse un chemin hors de la liste blanche, sans rien toucher', async () => {
    await poser('sessions/a.gpx', 'a')
    const avant = await empreinte(stockage)
    const t = dossierLocal(stockage)
    for (const chemin of ['../../secret.txt', 'LISEZMOI.txt', 'sessions/sous/a.gpx', 'journaux/a.json', 'sessions/a.gpx.gtracker-tmp']) {
      await expect(t.ecrire!(chemin, await aEcrire('x'), 1)).rejects.toMatchObject({ code: 'PERMISSION' })
      await expect(t.effacer!(chemin)).rejects.toMatchObject({ code: 'PERMISSION' })
    }
    expect(await empreinte(stockage)).toEqual(avant)
  })

  it('coupé pendant une écriture : provisoire à moitié écrit, que le téléphone ne montre pas', async () => {
    await poser('sessions/a.json', 'ancien')
    const t = dossierLocal(stockage, { coupureApres: 1 })
    await t.ecrire!('sessions/b.gpx', await aEcrire('bbbb'), 4)
    await expect(t.ecrire!('sessions/a.json', await aEcrire('nouveau!'), 8)).rejects.toThrow('débranché')
    expect(await t.etat()).toEqual({ etat: 'absent' })
    expect(await sessionsDuTelephone()).toEqual(['a.json', 'a.json.gtracker-tmp', 'b.gpx'])
    expect(await readFile(path.join(gtracker, 'sessions', 'a.json.gtracker-tmp'), 'utf8')).toBe('nouv')
    const revu = dossierLocal(stockage)
    expect((await revu.lister()).map((x) => [x.chemin, x.taille])).toEqual([['sessions/a.json', 6], ['sessions/b.gpx', 4]])
  })
})

describe('canaux du téléphone', () => {
  function canaux(t: DossierDistant, memoire: string | null = null) {
    const g = gestionnairesTelephone(t, lectures, { memoire: async () => memoire })
    return {
      etat: () => g['telephone:etat'](undefined),
      lister: () => g['telephone:lister'](undefined) as Promise<Reponse<FichierTelephone[]>>,
      lire: (argument: unknown) => g['telephone:lireOctets'](argument) as Promise<Reponse<Uint8Array>>,
      ecrire: (argument: unknown) => g['telephone:ecrireOctets'](argument) as Promise<Reponse<FichierTelephone>>,
      effacer: (argument: unknown) => g['telephone:effacer'](argument) as Promise<Reponse<null>>,
    }
  }

  const octets = (texte: string) => new TextEncoder().encode(texte)

  it('écrivent après un listage, rendent le fichier écrit, le relisent, et ne laissent aucun temporaire', async () => {
    const c = canaux(dossierLocal(stockage))
    expect(await c.ecrire({ chemin: 'sessions/a.gpx', octets: octets('<gpx/>') })).toMatchObject({ ok: false, message: "Le téléphone n'a pas été listé." })
    valeur(await c.lister())
    const ecrit = valeur(await c.ecrire({ chemin: 'sessions/a.gpx', octets: octets('<gpx/>') }))
    expect(ecrit).toMatchObject({ chemin: 'sessions/a.gpx', taille: 6 })
    expect(Buffer.from(valeur(await c.lire({ chemin: 'sessions/a.gpx' }))).toString('utf8')).toBe('<gpx/>')
    expect(await readdir(lectures)).toEqual([])
    expect(await sessionsDuTelephone()).toEqual(['a.gpx'])
  })

  it('refusent tout chemin hors de la liste blanche, avant de toucher au téléphone', async () => {
    await poser('sessions/a.gpx', 'a')
    await poser('LISEZMOI.txt', 'lire')
    const avant = await empreinte(stockage)
    const appels: string[] = []
    const espion: DossierDistant = {
      ...dossierLocal(stockage),
      ecrire: async (chemin) => (appels.push(`ecrire ${chemin}`), { chemin, taille: 0, dateMs: 0 }),
      effacer: async (chemin) => void appels.push(`effacer ${chemin}`),
    }
    const c = canaux(espion)
    valeur(await c.lister())
    for (const chemin of ['LISEZMOI.txt', '../../secret.txt', '/sdcard/Documents/Gtracker/sessions/a.gpx', 'sessions/sous/a.gpx', 'journaux/x.json', 'sessions/a.gpx.gtracker-new', 'sessions/a\nb.gpx', '']) {
      expect(await c.ecrire({ chemin, octets: octets('x') }), chemin).toMatchObject({ ok: false, code: 'PERMISSION' })
      expect(await c.effacer({ chemin }), chemin).toMatchObject({ ok: false, code: 'PERMISSION' })
    }
    expect(await c.ecrire({ chemin: 'sessions/b.gpx', octets: 'texte' })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await c.ecrire({ chemin: 3, octets: octets('x') })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(await c.effacer('sessions/a.gpx')).toMatchObject({ ok: false, code: 'UNKNOWN' })
    expect(appels).toEqual([])
    expect(await empreinte(stockage)).toEqual(avant)
  })

  it('n’effacent qu’un fichier du dernier listage ou écrit depuis', async () => {
    await poser('sessions/a.gpx', 'a')
    const c = canaux(dossierLocal(stockage))
    valeur(await c.lister())
    await poser('sessions/b.gpx', 'b')
    expect(await c.effacer({ chemin: 'sessions/b.gpx' })).toMatchObject({ ok: false, code: 'UNKNOWN' })
    valeur(await c.ecrire({ chemin: 'sessions/c.gpx', octets: octets('c') }))
    valeur(await c.effacer({ chemin: 'sessions/a.gpx' }))
    valeur(await c.effacer({ chemin: 'sessions/c.gpx' }))
    expect(await sessionsDuTelephone()).toEqual(['b.gpx'])
    expect(await c.lire({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false })
  })

  it('oublient le listage quand le téléphone n’est plus prêt : ni écriture ni effacement sans nouveau listage', async () => {
    await poser('sessions/a.gpx', 'a')
    let present = true
    const appels: string[] = []
    const local = dossierLocal(stockage)
    const changeant: DossierDistant = {
      ...local,
      etat: async () => (present ? local.etat() : { etat: 'absent' }),
      ecrire: async (chemin, f, taille) => (appels.push(`ecrire ${chemin}`), local.ecrire!(chemin, f, taille)),
      effacer: async (chemin) => (appels.push(`effacer ${chemin}`), local.effacer!(chemin)),
    }
    const c = canaux(changeant)
    valeur(await c.lister())
    present = false
    expect(valeur(await c.etat())).toEqual({ etat: 'absent' })
    present = true
    expect(await c.effacer({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, message: "Le téléphone n'a pas été listé." })
    expect(await c.ecrire({ chemin: 'sessions/b.gpx', octets: octets('b') })).toMatchObject({ ok: false, message: "Le téléphone n'a pas été listé." })
    expect(appels).toEqual([])
    expect(await sessionsDuTelephone()).toEqual(['a.gpx'])
  })

  it('refusent d’écrire par un canal qui ne le sait pas', async () => {
    const lecteur: DossierDistant = { etat: async () => ({ etat: 'pret', nom: 'x' }), lister: async () => [{ chemin: 'sessions/a.gpx', taille: 1, dateMs: 0 }], lire: async () => undefined }
    const c = canaux(lecteur)
    valeur(await c.lister())
    expect(await c.ecrire({ chemin: 'sessions/a.gpx', octets: octets('x') })).toMatchObject({ ok: false, message: 'Ce canal ne sait pas écrire sur le téléphone.' })
    expect(await c.effacer({ chemin: 'sessions/a.gpx' })).toMatchObject({ ok: false, message: 'Ce canal ne sait pas effacer sur le téléphone.' })
  })

  it('refusent d’écrire si le dossier temporaire est dans la mémoire', async () => {
    const c = canaux(dossierLocal(stockage), path.join(tmp, 'memoire'))
    valeur(await c.lister())
    const dans = canaux(dossierLocal(stockage), lectures)
    expect(await dans.ecrire({ chemin: 'sessions/a.gpx', octets: octets('x') })).toMatchObject({ ok: false })
    expect(valeur(await c.ecrire({ chemin: 'sessions/a.gpx', octets: octets('x') })).taille).toBe(1)
  })

  it('servent exactement les cinq canaux', () => {
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
