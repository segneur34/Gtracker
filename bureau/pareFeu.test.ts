import { describe, expect, it } from 'vitest'
import type { ReleveWindows, RegleRelevee, SortiePowershell } from './pareFeu'
import {
  DELAI_RELEVE_MS,
  REGLE_TCP,
  REGLE_UDP,
  VARIABLE_EXE,
  jugerPareFeu,
  lectureDeSortie,
  lireReleve,
  normaliserChemin,
  releveRate,
  scriptAutorisation,
  scriptRegles,
  scriptReleve,
} from './pareFeu'

const EXE = 'C:\\Users\\Ana\\AppData\\Local\\Programs\\Gtracker\\Gtracker.exe'
const ENV = { LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local' }
const PARTAGE = '192.168.137.1'
const MAISON = '192.168.1.20'

/** Une règle entrante du programme, autorisée, sur tous les profils, tous les ports d'un protocole. */
const regle = (patch: Partial<RegleRelevee> = {}): RegleRelevee => ({
  programme: EXE.toLowerCase(),
  action: 1,
  activee: true,
  profils: 2147483647,
  protocole: 6,
  ports: '*',
  distantes: '*',
  interfaces: 'All',
  ...patch,
})

/** Les deux règles que Windows pose quand on accepte sa question : TCP et UDP. */
const reglesWindows = (patch: Partial<RegleRelevee> = {}) => [regle(patch), regle({ ...patch, protocole: 17 })]

/** Le partage de connexion (interface 7, sans profil) et la box (interface 12, privée) ; pare-feu actif, entrant bloqué par défaut. */
const releve = (patch: Partial<ReleveWindows> = {}): ReleveWindows => ({
  adresses: [
    { adresse: PARTAGE, interface: 7 },
    { adresse: MAISON, interface: 12 },
    { adresse: '127.0.0.1', interface: 1 },
  ],
  categories: [{ interface: 12, categorie: 1 }],
  profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: false, entreeParDefaut: 0 })),
  strategie: 0,
  regles: [],
  ...patch,
})

const juger = (r: ReleveWindows | null, adresses: string[] = [PARTAGE], port = 48217, portSonde: number | null = 48218) =>
  jugerPareFeu(r, { adresses, port, portSonde, exe: EXE, env: ENV })

const decoder = (base64: string) => Buffer.from(base64, 'base64').toString('utf16le')

describe('jugement du pare-feu de Windows', () => {
  it('partage de connexion sans profil : public, bloqué sans règle, réparable', () => {
    expect(juger(releve())).toEqual({ pareFeu: 'bloque', reparable: true })
  })

  it('autorisé sur les réseaux privés seulement : ouvert sur la box, bloqué sur le partage de connexion', () => {
    const r = releve({ regles: reglesWindows({ profils: 2 }) })
    expect(juger(r, [MAISON])).toEqual({ pareFeu: 'ouvert', reparable: false })
    expect(juger(r, [PARTAGE])).toEqual({ pareFeu: 'bloque', reparable: true })
  })

  it('privé et public autorisés : ouvert', () => {
    expect(juger(releve({ regles: reglesWindows({ profils: 2 | 4 }) }), [PARTAGE, MAISON]).pareFeu).toBe('ouvert')
  })

  it('le blocage du programme l’emporte, et l’autorisation le retire : réparable', () => {
    const r = releve({ regles: [...reglesWindows(), regle({ action: 0, profils: 4 })] })
    expect(juger(r)).toEqual({ pareFeu: 'bloque', reparable: true })
    expect(juger(r, [MAISON]).pareFeu).toBe('ouvert')
  })

  it('un blocage sans programme sur le port n’est pas retiré par l’autorisation : non réparable', () => {
    const r = releve({ regles: [...reglesWindows(), regle({ programme: '', action: 0, ports: '48000-48300' })] })
    expect(juger(r)).toEqual({ pareFeu: 'bloque', reparable: false })
  })

  it('une règle désactivée est ignorée', () => {
    expect(juger(releve({ regles: reglesWindows({ activee: false }) })).pareFeu).toBe('bloque')
    expect(juger(releve({ regles: [...reglesWindows(), regle({ action: 0, activee: false })] })).pareFeu).toBe('ouvert')
  })

  it('autre programme ignoré ; chemin comparé sans casse, variables développées', () => {
    expect(juger(releve({ regles: reglesWindows({ programme: 'C:\\Autre\\Gtracker.exe' }) })).pareFeu).toBe('bloque')
    expect(juger(releve({ regles: reglesWindows({ programme: '%LocalAppData%\\PROGRAMS\\gtracker\\GTRACKER.EXE' }) })).pareFeu).toBe('ouvert')
    expect(juger(releve({ regles: reglesWindows({ programme: `"${EXE}"` }) })).pareFeu).toBe('ouvert')
    expect(normaliserChemin('%INCONNUE%\\a/b.exe', {})).toBe('%inconnue%\\a\\b.exe')
  })

  it('une règle sans programme ouvre aussi, sur ses ports', () => {
    const r = releve({ regles: [regle({ programme: '', ports: '48217-48226' }), regle({ programme: '', protocole: 17, ports: '48218' })] })
    expect(juger(r).pareFeu).toBe('ouvert')
    expect(juger(r, [PARTAGE], 48227).pareFeu).toBe('bloque')
  })

  it('ports qui ne couvrent pas le port pris : bloqué', () => {
    const r = releve({ regles: [regle({ ports: '48217-48220' }), regle({ protocole: 17, ports: '80,48218' })] })
    expect(juger(r, [PARTAGE], 48219).pareFeu).toBe('ouvert')
    expect(juger(r, [PARTAGE], 48221)).toEqual({ pareFeu: 'bloque', reparable: true })
    expect(juger(releve({ regles: [regle({ ports: 'RPC' }), regle({ protocole: 17 })] })).pareFeu).toBe('bloque')
  })

  it('UDP manquant : bloqué ; sans découverte, TCP suffit', () => {
    const r = releve({ regles: [regle()] })
    expect(juger(r).pareFeu).toBe('bloque')
    expect(juger(r, [PARTAGE], 48217, null).pareFeu).toBe('ouvert')
    expect(juger(releve({ regles: [regle({ protocole: 256 })] })).pareFeu).toBe('ouvert')
  })

  it('adresses distantes ou interfaces trop étroites : la règle ne compte pas', () => {
    expect(juger(releve({ regles: reglesWindows({ distantes: 'LocalSubnet' }) })).pareFeu).toBe('ouvert')
    expect(juger(releve({ regles: reglesWindows({ distantes: '10.0.0.5' }) })).pareFeu).toBe('bloque')
    expect(juger(releve({ regles: reglesWindows({ interfaces: 'Wireless' }) })).pareFeu).toBe('bloque')
  })

  it('pare-feu éteint sur ce profil : ouvert ; entrant autorisé par défaut : ouvert', () => {
    const eteint = releve({ profils: [1, 2, 4].map((profil) => ({ profil, actif: profil !== 4, toutBloque: false, entreeParDefaut: 0 })) })
    expect(juger(eteint).pareFeu).toBe('ouvert')
    expect(juger(eteint, [MAISON]).pareFeu).toBe('bloque')
    const parDefaut = releve({ profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: false, entreeParDefaut: 1 })) })
    expect(juger(parDefaut).pareFeu).toBe('ouvert')
  })

  it('tout entrant bloqué : bloqué, non réparable, même avec une règle', () => {
    const r = releve({ regles: reglesWindows(), profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: true, entreeParDefaut: 0 })) })
    expect(juger(r)).toEqual({ pareFeu: 'bloque', reparable: false })
  })

  it('stratégie de groupe : bloqué non réparable ; ouvert par une règle locale, inconnu', () => {
    expect(juger(releve({ strategie: 1 }))).toEqual({ pareFeu: 'bloque', reparable: false })
    expect(juger(releve({ strategie: 1, regles: reglesWindows() }))).toEqual({ pareFeu: 'inconnu', reparable: false })
  })

  it('réseau de domaine bloqué : l’autorisation ne couvre que privé et public, non réparable', () => {
    expect(juger(releve({ categories: [{ interface: 7, categorie: 2 }] }))).toEqual({ pareFeu: 'bloque', reparable: false })
  })

  it('deux adresses dont une bloquée : bloqué', () => {
    expect(juger(releve({ regles: reglesWindows({ profils: 2 }) }), [MAISON, PARTAGE])).toEqual({ pareFeu: 'bloque', reparable: true })
  })

  it('relevé absent ou sans adresse d’écoute : inconnu', () => {
    expect(juger(null)).toEqual({ pareFeu: 'inconnu', reparable: false })
    expect(juger(releve(), [])).toEqual({ pareFeu: 'inconnu', reparable: false })
  })
})

describe('lecture du relevé', () => {
  it('un objet seul là où ConvertTo-Json a écrasé un tableau, rien pour un tableau vide', () => {
    const json = JSON.stringify({
      adresses: { adresse: PARTAGE, interface: 7 },
      categories: null,
      profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: false, entreeParDefaut: 0 })),
      strategie: 0,
      regles: { programme: EXE, action: 1, activee: true, profils: 6, protocole: 6, ports: '*', distantes: '*', interfaces: 'All' },
    })
    const r = lireReleve(`\uFEFF${json}\r\n`)
    expect(r?.adresses).toEqual([{ adresse: PARTAGE, interface: 7 }])
    expect(r?.categories).toEqual([])
    expect(r?.regles).toHaveLength(1)
  })

  it('illisible : null (pas du JSON, profil manquant, stratégie absente)', () => {
    expect(lireReleve('Get-NetIPAddress : accès refusé')).toBeNull()
    expect(lireReleve('[]')).toBeNull()
    expect(lireReleve(JSON.stringify({ strategie: 0, profils: [{ profil: 2, actif: true, toutBloque: false, entreeParDefaut: 0 }] }))).toBeNull()
    expect(lireReleve(JSON.stringify({ profils: [] }))).toBeNull()
  })

  it('une règle mal formée est laissée de côté', () => {
    const json = JSON.stringify({
      profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: false, entreeParDefaut: 0 })),
      strategie: 0,
      regles: [{ programme: EXE, action: 'autoriser' }, { action: 1, activee: true, profils: 4, protocole: 17 }],
    })
    expect(lireReleve(json)?.regles).toEqual([{ programme: '', action: 1, activee: true, profils: 4, protocole: 17, ports: '', distantes: '', interfaces: '' }])
  })
})

describe('fin du Windows PowerShell du relevé', () => {
  const contexte = { adresses: [PARTAGE], port: 48217, portSonde: 48218, exe: EXE, env: ENV }
  const sortie = (patch: Partial<SortiePowershell> = {}): SortiePowershell => ({ code: 0, stdout: '', delaiDepasse: false, message: '', erreur: '', ...patch })
  const message = `Command failed: C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe ${EXE}`

  it('relevé lu : le jugement, tel que le rend jugerPareFeu', () => {
    const lecture = lectureDeSortie(sortie({ stdout: JSON.stringify(releve()) }), contexte)
    expect(lecture).toEqual({ pareFeu: 'bloque', reparable: true })
    expect(releveRate(lecture)).toBe(false)
  })

  it('délai de trente secondes, dit dans la raison', () => {
    expect(DELAI_RELEVE_MS).toBe(30_000)
    expect(lectureDeSortie(sortie({ code: -1, delaiDepasse: true, message }), contexte)).toEqual({ raison: 'délai de 30 s dépassé' })
    expect(lectureDeSortie(sortie({ code: -1, delaiDepasse: true }), contexte, 12_000)).toEqual({ raison: 'délai de 12 s dépassé' })
  })

  it('code de sortie, lancement impossible, sortie illisible : la raison, sans chemin ni contenu de la sortie', () => {
    const raisons = [
      lectureDeSortie(sortie({ code: 1, stdout: EXE, message }), contexte),
      lectureDeSortie(sortie({ code: -1, erreur: 'ENOENT', message }), contexte),
      lectureDeSortie(sortie({ code: -1, message }), contexte),
      lectureDeSortie(sortie({ stdout: `accès refusé : ${EXE}` }), contexte),
      lectureDeSortie(sortie({ stdout: '[]' }), contexte),
    ]
    expect(raisons).toEqual([
      { raison: 'Windows PowerShell a rendu le code 1' },
      { raison: 'Windows PowerShell en échec (ENOENT)' },
      { raison: 'Windows PowerShell en échec' },
      { raison: `sortie illisible (${`accès refusé : ${EXE}`.length} caractères)` },
      { raison: 'sortie illisible (2 caractères)' },
    ])
    for (const r of raisons) {
      expect(releveRate(r)).toBe(true)
      expect(JSON.stringify(r)).not.toContain('Ana')
    }
  })
})

describe('scripts de Windows PowerShell', () => {
  it('lecture : l’exécutable par la variable d’environnement, jamais dans le script', () => {
    const script = decoder(scriptReleve())
    expect(script).toContain(`$env:${VARIABLE_EXE}`)
    expect(script).toContain('HNetCfg.FwPolicy2')
    expect(script).toContain('LocalPolicyModifyState')
    expect(script).toContain('ConvertTo-Json')
  })

  it('autorisation : noms stables, apostrophe et accents du chemin, refus en code 3', () => {
    const exe = "D:\\Programmes d'Éloïse\\Gtracker\\Gtracker.exe"
    const externe = decoder(scriptAutorisation(exe, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'))
    expect(externe).toContain('-Verb RunAs')
    expect(externe).toContain('NativeErrorCode -eq 1223) { exit 3 }')
    expect(externe).not.toContain('Éloïse')
    const encode = /-EncodedCommand ([A-Za-z0-9+/=]+)'/.exec(externe)?.[1]
    expect(encode).toBeDefined()
    const interne = decoder(encode as string)
    expect(interne).toBe(scriptRegles(exe))
    expect(interne).toContain("$exe = 'D:\\Programmes d''Éloïse\\Gtracker\\Gtracker.exe'")
    expect(interne).toContain(`Remove-NetFirewallRule -Name '${REGLE_TCP}', '${REGLE_UDP}'`)
    expect(interne).toContain(`-Name '${REGLE_TCP}'`)
    expect(interne).toContain("-Protocol TCP -LocalPort '48217-48226' -RemoteAddress LocalSubnet -Profile Private, Public")
    expect(interne).toContain("-Protocol UDP -LocalPort '48218' -RemoteAddress LocalSubnet -Profile Private, Public")
    expect(interne).toContain('$_.Action -eq 0')
  })

  it('autorisation : les apostrophes typographiques du chemin sont doublées aussi', () => {
    const interne = scriptRegles('C:\\Users\\D\u2019Artagnan\\\u2018a\u201Ab\u201B\\Gtracker.exe')
    expect(interne).toContain("$exe = 'C:\\Users\\D\u2019\u2019Artagnan\\\u2018\u2018a\u201A\u201Ab\u201B\u201B\\Gtracker.exe'")
  })
})
