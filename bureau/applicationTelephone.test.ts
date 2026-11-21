import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DOSSIER_APK_GRADLE,
  FICHIER_PROPOSEE,
  TITRE_ENREGISTRER,
  cheminApk,
  enregistrerApk,
  essaiApplicationDepuisEnvironnement,
  gestionnairesApplication,
  lireProposee,
  marquerProposee,
  nomApk,
} from './applicationTelephone'
import type { OptionsApplication } from './applicationTelephone'
import type { Reponse } from './pont'
import type { DossierDistant, ResultatInstallation } from './telephone'
import { DOSSIER_INSTALLATIONS_ESSAI, NOM_TELEPHONE_ESSAI, dossierLocal, enSerie } from './telephone'

let tmp = ''
beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'gtk-application-'))
})
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

const VERSION = '0.01.40'
const OCTETS = 'PK\u0003\u0004 une fausse APK'

async function poserApk(): Promise<string> {
  const apk = path.join(tmp, 'resources', nomApk(VERSION))
  await mkdir(path.dirname(apk), { recursive: true })
  await writeFile(apk, OCTETS)
  return apk
}

describe('chemin de l’APK', () => {
  it('prend celle des ressources une fois emballé, celle de Gradle depuis le dépôt, celle d’essai avant tout', () => {
    const base = { version: VERSION, ressources: 'C:\\Programme\\resources', depot: 'D:\\depot' }
    expect(nomApk(VERSION)).toBe('Gtracker-0.01.40.apk')
    expect(cheminApk({ ...base, emballe: true })).toBe(path.join('C:\\Programme\\resources', 'Gtracker-0.01.40.apk'))
    expect(cheminApk({ ...base, emballe: false })).toBe(path.join('D:\\depot', ...DOSSIER_APK_GRADLE, 'Gtracker-0.01.40.apk'))
    expect(DOSSIER_APK_GRADLE.join('/')).toBe('android/app/build/outputs/apk/release')
    expect(cheminApk({ ...base, emballe: true, essai: 'E:\\essai\\autre.apk' })).toBe(path.resolve('E:\\essai\\autre.apk'))
    expect(cheminApk({ ...base, emballe: true, essai: null })).toBe(cheminApk({ ...base, emballe: true }))
  })
})

describe('drapeau « déjà proposée »', () => {
  it('est retenu par version dans le profil', async () => {
    const profil = path.join(tmp, 'profil')
    expect(await lireProposee(profil, VERSION)).toBe(false)
    await marquerProposee(profil, VERSION)
    expect(await lireProposee(profil, VERSION)).toBe(true)
    expect(await lireProposee(profil, '0.01.41')).toBe(false)
    await marquerProposee(profil, '0.01.41')
    expect(await lireProposee(profil, VERSION)).toBe(false)
    expect(JSON.parse(await readFile(path.join(profil, FICHIER_PROPOSEE), 'utf8'))).toEqual({ version: '0.01.41' })
    expect(await readdir(profil)).toEqual([FICHIER_PROPOSEE])
  })

  it('vaut « non » pour un fichier illisible', async () => {
    await writeFile(path.join(tmp, FICHIER_PROPOSEE), '{ pas du json')
    expect(await lireProposee(tmp, VERSION)).toBe(false)
  })
})

describe('enregistrement de l’APK', () => {
  it('copie l’APK et ne laisse aucun provisoire, en remplaçant un fichier du même nom', async () => {
    const apk = await poserApk()
    const destination = path.join(tmp, 'Téléchargements', 'Gtracker-0.01.40.apk')
    await mkdir(path.dirname(destination))
    await writeFile(destination, 'ancienne')
    await enregistrerApk(apk, destination)
    expect(await readFile(destination, 'utf8')).toBe(OCTETS)
    expect(await readdir(path.dirname(destination))).toEqual(['Gtracker-0.01.40.apk'])
  })

  it('refuse de copier l’APK sur elle-même, et échoue sans provisoire vers un dossier absent', async () => {
    const apk = await poserApk()
    await expect(enregistrerApk(apk, apk.toUpperCase())).rejects.toThrow('sur elle-même')
    await expect(enregistrerApk(apk, path.join(tmp, 'absent', 'a.apk'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(path.join(tmp, 'resources'))).toEqual([nomApk(VERSION)])
  })
})

describe('canaux de l’application', () => {
  function servir(options: Partial<OptionsApplication> & Pick<OptionsApplication, 'apk'>) {
    const demandes: { titre: string; nom: string }[] = []
    const cable: DossierDistant = options.cable ?? dossierLocal(path.join(tmp, 'telephone'))
    const g = gestionnairesApplication({
      version: VERSION,
      profil: path.join(tmp, 'profil'),
      choisirDestination: async (d) => (demandes.push(d), null),
      cable,
      serie: enSerie(),
      ...options,
    })
    const appeler = <T>(canal: string, argument?: unknown) => g[`application:${canal}`](argument) as Promise<Reponse<T>>
    return { appeler, demandes }
  }

  it('donne l’état, puis retient la proposition pour cette version', async () => {
    const { appeler } = servir({ apk: await poserApk() })
    expect(await appeler('etat')).toEqual({ ok: true, valeur: { version: VERSION, disponible: true, proposee: false } })
    expect(await appeler('marquerProposee')).toEqual({ ok: true, valeur: null })
    expect(await appeler('etat')).toEqual({ ok: true, valeur: { version: VERSION, disponible: true, proposee: true } })
  })

  it('sans APK : indisponible, et ni fenêtre ni installation', async () => {
    const apk = path.join(tmp, 'resources', nomApk(VERSION))
    const { appeler, demandes } = servir({ apk })
    expect(await appeler('etat')).toMatchObject({ ok: true, valeur: { disponible: false } })
    expect(await appeler('enregistrer')).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(await appeler('installer')).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(demandes).toEqual([])
  })

  it('enregistre là où la fenêtre l’a demandé, rend null si l’utilisateur renonce, titre de la page ou par défaut', async () => {
    const apk = await poserApk()
    const renonce = servir({ apk })
    expect(await renonce.appeler('enregistrer', { titre: 'Save the phone app' })).toEqual({ ok: true, valeur: null })
    expect(await renonce.appeler('enregistrer', { titre: '' })).toEqual({ ok: true, valeur: null })
    expect(await renonce.appeler('enregistrer')).toEqual({ ok: true, valeur: null })
    expect(renonce.demandes).toEqual([
      { titre: 'Save the phone app', nom: 'Gtracker-0.01.40.apk' },
      { titre: TITRE_ENREGISTRER, nom: 'Gtracker-0.01.40.apk' },
      { titre: TITRE_ENREGISTRER, nom: 'Gtracker-0.01.40.apk' },
    ])
    const destination = path.join(tmp, 'copie.apk')
    const choisi = servir({ apk, choisirDestination: async () => destination })
    expect(await choisi.appeler('enregistrer')).toEqual({ ok: true, valeur: destination })
    expect(await readFile(destination, 'utf8')).toBe(OCTETS)
    const relatif = servir({ apk, choisirDestination: async () => 'copie.apk' })
    expect(await relatif.appeler('enregistrer')).toMatchObject({ ok: false })
  })

  it('n’ouvre qu’une fenêtre pour deux clics', async () => {
    const apk = await poserApk()
    let ouvertures = 0
    let repondre: (chemin: string | null) => void = () => undefined
    const { appeler } = servir({ apk, choisirDestination: () => (ouvertures++, new Promise((fin) => (repondre = fin))) })
    const a = appeler('enregistrer')
    const b = appeler('enregistrer')
    await new Promise((fin) => setTimeout(fin, 10))
    repondre(path.join(tmp, 'une.apk'))
    expect(await a).toEqual(await b)
    expect(ouvertures).toBe(1)
  })

  it('installe sur le téléphone d’essai, dans la file des autres commandes', async () => {
    const apk = await poserApk()
    await mkdir(path.join(tmp, 'telephone'))
    const serie = enSerie()
    const ordre: string[] = []
    let liberer: () => void = () => undefined
    void serie(() => new Promise<void>((fin) => (liberer = () => (ordre.push('autre commande'), fin()))))
    const { appeler } = servir({ apk, serie })
    const installation = appeler<ResultatInstallation>('installer').then((r) => (ordre.push('installation'), r))
    await new Promise((fin) => setTimeout(fin, 10))
    expect(ordre).toEqual([])
    liberer()
    expect(await installation).toEqual({ ok: true, valeur: { etat: 'installee', nom: NOM_TELEPHONE_ESSAI } })
    expect(ordre).toEqual(['autre commande', 'installation'])
    expect(await readFile(path.join(tmp, 'telephone', DOSSIER_INSTALLATIONS_ESSAI, nomApk(VERSION)), 'utf8')).toBe(OCTETS)
  })

  it('rend l’état d’un téléphone pas prêt, le refus imposé, et refuse un canal qui ne sait pas installer', async () => {
    const apk = await poserApk()
    expect(await servir({ apk }).appeler('installer')).toEqual({ ok: true, valeur: { etat: 'absent' } })
    await mkdir(path.join(tmp, 'telephone'))
    const occupe = dossierLocal(path.join(tmp, 'telephone'), { etatImpose: { etat: 'occupe' } })
    expect(await servir({ apk, cable: occupe }).appeler('installer')).toEqual({ ok: true, valeur: { etat: 'occupe' } })
    const refuse = dossierLocal(path.join(tmp, 'telephone'), { refusInstallation: 'signature' })
    expect(await servir({ apk, cable: refuse }).appeler('installer')).toMatchObject({ ok: true, valeur: { etat: 'refusee', raison: 'signature' } })
    const lecteur: DossierDistant = { etat: async () => ({ etat: 'pret', nom: 'x' }), lister: async () => [], lire: async () => undefined }
    expect(await servir({ apk, cable: lecteur }).appeler('installer')).toMatchObject({ ok: false })
  })
})

describe('mode d’essai', () => {
  it('ne lit ses variables qu’en mode d’essai, sans jamais ouvrir de fenêtre', async () => {
    const env = { GTRACKER_APK: 'E:\\essai\\Gtracker-0.01.40.apk', GTRACKER_BANC_APK_DESTINATION: 'E:\\sortie\\a.apk', GTRACKER_BANC_APPLICATION_REFUS: 'usbCoupee' }
    expect(essaiApplicationDepuisEnvironnement(env)).toBeNull()
    const essai = essaiApplicationDepuisEnvironnement({ ...env, GTRACKER_BANC: '1' })!
    expect(essai.apk).toBe(path.resolve('E:\\essai\\Gtracker-0.01.40.apk'))
    expect(essai.refus).toBe('usbCoupee')
    expect(await essai.choisirDestination({ titre: 't', nom: 'n' })).toBe(path.resolve('E:\\sortie\\a.apk'))
  })

  it('renonce sans destination, et ignore un refus inconnu en le disant', async () => {
    const journal: string[] = []
    const essai = essaiApplicationDepuisEnvironnement({ GTRACKER_BANC: '1', GTRACKER_BANC_APPLICATION_REFUS: 'casse' }, (m) => journal.push(m))!
    expect(essai.apk).toBeNull()
    expect(essai.refus).toBeNull()
    expect(await essai.choisirDestination({ titre: 't', nom: 'n' })).toBeNull()
    expect(journal).toHaveLength(2)
  })
})
