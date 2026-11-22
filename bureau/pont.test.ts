import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANAUX_MEMOIRE } from './memoire'
import { ORIGINE } from './origine'
import type { EvenementPont, Gestionnaire } from './pont'
import { TEXTES_FERMETURE, brancherCanaux, enReponse, expediteurAdmis, lireTextesFermeture, reussite, uneALaFois } from './pont'
import { ErreurDisque } from './disque'
import { AVIS_ARRIVEE, AVIS_DEPART, CANAUX_SANS_FIL } from './sansFil'
import type { DossierDistant } from './telephone'
import { CANAUX_TELEPHONE, dossierLocal, enSerie, gestionnairesTelephone } from './telephone'
import { CANAUX_APPLICATION, gestionnairesApplication } from './applicationTelephone'

const page = { nom: 'contenu de la fenêtre principale' }
const tete = { url: `${ORIGINE}/sessions`, parent: null }

describe('expediteurAdmis', () => {
  it('admet le cadre de tête de la page de l’application dans la fenêtre principale', () => {
    expect(expediteurAdmis({ sender: page, senderFrame: tete }, page)).toBe(true)
  })

  it('refuse un autre contenu, une autre adresse, un cadre intégré, un cadre disparu, une fenêtre fermée', () => {
    expect(expediteurAdmis({ sender: { nom: 'autre' }, senderFrame: tete }, page)).toBe(false)
    expect(expediteurAdmis({ sender: page, senderFrame: { url: 'https://exemple.org/', parent: null } }, page)).toBe(false)
    expect(expediteurAdmis({ sender: page, senderFrame: { url: 'https://gtracker.localhost.exemple.org/', parent: null } }, page)).toBe(false)
    expect(expediteurAdmis({ sender: page, senderFrame: { url: `${ORIGINE}/`, parent: tete } }, page)).toBe(false)
    expect(expediteurAdmis({ sender: page, senderFrame: null }, page)).toBe(false)
    expect(expediteurAdmis({ sender: page, senderFrame: tete }, null)).toBe(false)
  })
})

describe('brancherCanaux', () => {
  function brancher(gestionnaires: Record<string, Gestionnaire>, admis: boolean) {
    const servis = new Map<string, (e: EvenementPont, ...args: unknown[]) => Promise<unknown>>()
    const journal: string[] = []
    brancherCanaux({ handle: (canal, rappel) => servis.set(canal, rappel) }, () => admis, gestionnaires, (m) => journal.push(m))
    return { servis, journal }
  }
  const evenement: EvenementPont = { sender: page, senderFrame: tete }

  it('passe le premier argument au gestionnaire et rend sa réponse', async () => {
    const recus: unknown[] = []
    const { servis } = brancher({ 'memoire:lister': async (a) => (recus.push(a), reussite([])) }, true)
    expect(await servis.get('memoire:lister')!(evenement, { racine: 'memoire', chemin: '' }, 'de trop')).toEqual({ ok: true, valeur: [] })
    expect(recus).toEqual([{ racine: 'memoire', chemin: '' }])
  })

  it('refuse un expéditeur inconnu sans appeler le gestionnaire', async () => {
    let appele = false
    const { servis, journal } = brancher({ 'memoire:ouvrir': async () => ((appele = true), reussite(null)) }, false)
    expect(await servis.get('memoire:ouvrir')!(evenement)).toMatchObject({ ok: false, code: 'PERMISSION' })
    expect(appele).toBe(false)
    expect(journal).toHaveLength(1)
  })

  it('ne laisse passer aucune exception', async () => {
    const { servis } = brancher({ 'memoire:stat': async () => Promise.reject(new Error('imprévu')) }, true)
    expect(await servis.get('memoire:stat')!(evenement, {})).toEqual({ ok: false, code: 'UNKNOWN', message: 'imprévu' })
  })
})

describe('enReponse', () => {
  it('met une erreur du disque en code et phrase', async () => {
    expect(await enReponse(async () => Promise.reject(new ErreurDisque('NO_SPACE', 'plus de place')))).toEqual({ ok: false, code: 'NO_SPACE', message: 'plus de place' })
    expect(await enReponse(async () => 3)).toEqual({ ok: true, valeur: 3 })
  })
})

describe('uneALaFois', () => {
  it('rend la même promesse tant que l’action tourne, puis relance', async () => {
    let lancements = 0
    let finir: (v: string) => void = () => undefined
    const action = uneALaFois((_a: number) => {
      lancements++
      return new Promise<string>((fin) => (finir = fin))
    })
    const a = action(1)
    const b = action(2)
    expect(b).toBe(a)
    finir('un')
    expect(await b).toBe('un')
    const c = action(3)
    expect(c).not.toBe(a)
    finir('deux')
    expect(await c).toBe('deux')
    expect(lancements).toBe(2)
  })

  it('relance aussi après un échec', async () => {
    let lancements = 0
    const action = uneALaFois(async () => {
      lancements++
      throw new Error('raté')
    })
    await expect(action(undefined)).rejects.toThrow('raté')
    await expect(action(undefined)).rejects.toThrow('raté')
    expect(lancements).toBe(2)
  })
})

describe('textes de la question de fermeture', () => {
  it('sont pris seulement s’ils sont tous là', () => {
    const anglais = { question: 'Quit without saving?', detail: 'Changes are not saved.', quitter: 'Quit', rester: 'Stay' }
    expect(lireTextesFermeture(anglais)).toEqual(anglais)
    expect(lireTextesFermeture({ ...anglais, rester: '' })).toBeNull()
    expect(lireTextesFermeture({ ...anglais, quitter: 3 })).toBeNull()
    expect(lireTextesFermeture({ ...anglais, detail: 'x'.repeat(600) })).toBeNull()
    expect(lireTextesFermeture('Quit')).toBeNull()
    expect(TEXTES_FERMETURE.question).toBe('Quitter sans enregistrer ?')
  })
})

describe('écriture sur le téléphone par le pont', () => {
  it('refuse dans la coquille tout chemin hors de la liste blanche, sans atteindre le téléphone', async () => {
    const recus: string[] = []
    const telephone: DossierDistant = {
      etat: async () => ({ etat: 'pret', nom: 'x' }),
      lister: async () => [{ chemin: 'sessions/a.gpx', taille: 1, dateMs: 0 }],
      lire: async () => undefined,
      ecrire: async (chemin) => (recus.push(`ecrire ${chemin}`), { chemin, taille: 1, dateMs: 0 }),
      effacer: async (chemin) => void recus.push(`effacer ${chemin}`),
    }
    const servis = new Map<string, (e: EvenementPont, ...args: unknown[]) => Promise<unknown>>()
    brancherCanaux({ handle: (canal, rappel) => servis.set(canal, rappel) }, () => true, gestionnairesTelephone(telephone, path.join(__dirname, 'sortie', 'essai-pont')))
    const evenement: EvenementPont = { sender: page, senderFrame: tete }
    const appeler = (canal: string, argument: unknown) => servis.get(`telephone:${canal}`)!(evenement, argument)
    expect(await appeler('lister', undefined)).toMatchObject({ ok: true })
    for (const chemin of ['../gtracker.json', '/sdcard/Documents/Gtracker/lieux.json', 'sessions/sous/a.gpx', 'journaux/a.json', 'LISEZMOI.txt', 'sessions/a.gpx.gtracker-tmp', 'sessions/a\nb']) {
      expect(await appeler('ecrireOctets', { chemin, octets: new Uint8Array([1]) }), chemin).toMatchObject({ ok: false, code: 'PERMISSION' })
      expect(await appeler('effacer', { chemin }), chemin).toMatchObject({ ok: false, code: 'PERMISSION' })
    }
    expect(recus).toEqual([])
    expect(await appeler('effacer', { chemin: 'sessions/a.gpx' })).toEqual({ ok: true, valeur: null })
    expect(recus).toEqual(['effacer sessions/a.gpx'])
  })
})

describe('copie de sécurité par le pont', () => {
  it('refuse sans dossier mémoire retenu ou sans dossier des copies, puis copie les deux dossiers et rend son chemin', async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'gtk-pont-copie-'))
    try {
      const memoire = path.join(tmp, 'Gtracker')
      await mkdir(path.join(memoire, 'sessions'), { recursive: true })
      await writeFile(path.join(memoire, 'sessions', 'a.gpx'), 'trace')
      await mkdir(path.join(tmp, 'telephone', 'Documents', 'Gtracker'), { recursive: true })
      const servir = (options: Parameters<typeof gestionnairesTelephone>[2]) => {
        const servis = new Map<string, (e: EvenementPont, ...args: unknown[]) => Promise<unknown>>()
        brancherCanaux({ handle: (canal, rappel) => servis.set(canal, rappel) }, () => true, gestionnairesTelephone(dossierLocal(path.join(tmp, 'telephone')), path.join(tmp, 'lectures'), options))
        return servis.get('telephone:copieSecurite')!({ sender: page, senderFrame: tete })
      }
      expect(await servir({ memoire: async () => null, copies: path.join(tmp, 'copies') })).toMatchObject({ ok: false })
      expect(await servir({ memoire: async () => memoire })).toMatchObject({ ok: false })
      const reponse = (await servir({ memoire: async () => memoire, copies: path.join(tmp, 'copies') })) as { ok: true; valeur: string }
      expect(reponse.ok).toBe(true)
      expect(await readFile(path.join(reponse.valeur, 'ordinateur', 'sessions', 'a.gpx'), 'utf8')).toBe('trace')
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })
})

describe('preload', () => {
  it('nomme les canaux du téléphone comme ses gestionnaires', () => {
    const servis = Object.keys(gestionnairesTelephone({ etat: async () => ({ etat: 'absent' }), lister: async () => [], lire: async () => undefined }, '.'))
    expect(servis).toEqual(CANAUX_TELEPHONE.map((nom) => `telephone:${nom}`))
  })

  it('nomme les canaux de l’application comme ses gestionnaires', () => {
    const cable: DossierDistant = { etat: async () => ({ etat: 'absent' }), lister: async () => [], lire: async () => undefined }
    const servis = Object.keys(gestionnairesApplication({ version: '0.01.40', apk: 'x.apk', profil: '.', choisirDestination: async () => null, cable, serie: enSerie() }))
    expect(servis).toEqual(CANAUX_APPLICATION.map((nom) => `application:${nom}`))
  })

  it('expose exactement les canaux servis par la mémoire et le téléphone, une fonction chacun, sans ipcRenderer tel quel', () => {
    const source = readFileSync(path.join(__dirname, 'preload.ts'), 'utf8')
    const canaux = [...source.matchAll(/'memoire:([A-Za-z]+)'/g)].map((m) => m[1])
    expect(canaux).toEqual([...CANAUX_MEMOIRE])
    for (const nom of CANAUX_MEMOIRE) expect(source).toMatch(new RegExp(`\\b${nom}: (sans|avec)\\('memoire:${nom}'\\)`))
    const telephone = [...source.matchAll(/'telephone:([A-Za-z]+)'/g)].map((m) => m[1])
    expect(telephone).toEqual([...CANAUX_TELEPHONE])
    for (const nom of CANAUX_TELEPHONE) expect(source).toMatch(new RegExp(`\\b${nom}: (sans|avec)\\('telephone:${nom}'\\)`))
    expect(source).toMatch(/^\s+telephone,$/m)
    const avis = [AVIS_ARRIVEE, AVIS_DEPART]
    const sansFil = [...source.matchAll(/'sansfil:([A-Za-z]+)'/g)].map((m) => m[1]).filter((nom) => !avis.includes(`sansfil:${nom}`))
    expect(sansFil).toEqual([...CANAUX_SANS_FIL])
    for (const nom of CANAUX_SANS_FIL) expect(source).toMatch(new RegExp(`\\b${nom}: (sans|avec)\\('sansfil:${nom}'\\)`))
    expect(source).toMatch(/^\s+sansFil,$/m)
    for (const canal of avis) {
      expect(source).toContain(`ipcRenderer.on('${canal}', ecouteur)`)
      expect(source).toContain(`ipcRenderer.removeListener('${canal}', ecouteur)`)
    }
    expect(source).toMatch(/surArrivee: \(rappel/)
    expect(source).toMatch(/surDepart: \(rappel/)
    const application = [...source.matchAll(/'application:([A-Za-z]+)'/g)].map((m) => m[1])
    expect(application).toEqual([...CANAUX_APPLICATION])
    for (const nom of CANAUX_APPLICATION) expect(source).toMatch(new RegExp(`\\b${nom}: (sans|avec)\\('application:${nom}'\\)`))
    expect(source).toMatch(/^\s+application,$/m)
    expect(source).toContain("textes: avec('coquille:textes')")
    expect(source).toContain("noter: avec('coquille:noter')")
    expect(source).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/)
    expect(source).not.toMatch(/from '\.\//)
  })
})
