import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ReleveWindows, RegleRelevee, SortiePowershell } from './pareFeu'
import {
  ARG_PAREFEU_POSER,
  ARG_PAREFEU_RETIRER,
  DELAI_RELEVE_MS,
  REGLE_TCP,
  REGLE_UDP,
  VARIABLE_EXE,
  actionElevee,
  argumentsDeRelance,
  cheminPowershell,
  executerActionElevee,
  issueAutorisation,
  jugerPareFeu,
  lectureDeSortie,
  lireReleve,
  normaliserChemin,
  releveRate,
  scriptAutorisation,
  scriptRegles,
  scriptReleve,
  scriptRetrait,
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
  blocagesPersonnels: 0,
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

  it('un blocage du programme posé par l’utilisateur n’est jamais retiré : non réparable', () => {
    const r = releve({ regles: [...reglesWindows(), regle({ action: 0, profils: 4 })], blocagesPersonnels: 1 })
    expect(juger(r)).toEqual({ pareFeu: 'bloque', reparable: false })
    expect(juger(r, [MAISON]).pareFeu).toBe('ouvert')
    // Sans blocage du programme sur le flux, le compte ne change rien.
    expect(juger(releve({ blocagesPersonnels: 2 }))).toEqual({ pareFeu: 'bloque', reparable: true })
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
    expect(r?.blocagesPersonnels).toBe(0)
  })

  it('blocages personnels : lus quand ils sont donn\u00E9s, 0 absents ou illisibles', () => {
    const base = { profils: [1, 2, 4].map((profil) => ({ profil, actif: true, toutBloque: false, entreeParDefaut: 0 })), strategie: 0 }
    expect(lireReleve(JSON.stringify({ ...base, blocagesPersonnels: 2 }))?.blocagesPersonnels).toBe(2)
    expect(lireReleve(JSON.stringify({ ...base, blocagesPersonnels: 'deux' }))?.blocagesPersonnels).toBe(0)
    expect(lireReleve(JSON.stringify({ ...base, blocagesPersonnels: -1 }))?.blocagesPersonnels).toBe(0)
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

  it('lecture : les blocages personnels comptés seulement après un blocage du programme, hors « Query User »', () => {
    const script = decoder(scriptReleve())
    expect(script).toContain('$_.action -eq 0 -and $_.activee')
    expect(script).toContain("-not ($_.Name -like 'TCP Query User{*' -or $_.Name -like 'UDP Query User{*')")
    expect(script).toContain('Get-NetFirewallApplicationFilter')
    expect(script).toContain('} catch { $blocagesPersonnels = 0 }')
    expect(script).toContain('blocagesPersonnels = [int]$blocagesPersonnels')
  })

  it('autorisation : Gtracker relancé élevé avec son drapeau, jamais Windows PowerShell ; refus en code 3', () => {
    const exe = "D:\\Programmes d'Éloïse\\Gtracker\\Gtracker.exe"
    const externe = decoder(scriptAutorisation(exe))
    expect(externe).toContain(`Start-Process -FilePath 'D:\\Programmes d''Éloïse\\Gtracker\\Gtracker.exe' -ArgumentList '${ARG_PAREFEU_POSER}' -Verb RunAs -PassThru`)
    expect(externe).toContain('$p.WaitForExit()')
    expect(externe).not.toContain('-Wait ')
    expect(externe).not.toMatch(/powershell\.exe|EncodedCommand/i)
    expect(externe).toContain('NativeErrorCode -eq 1223) { exit 3 }')
    // Essai depuis le dépôt : le dossier de la coquille passe avant le drapeau, entre guillemets s'il a une espace.
    expect(decoder(scriptAutorisation('C:\\e\\electron.exe', ['D:\\mes essais\\bureau\\dist']))).toContain(
      `-ArgumentList '"D:\\mes essais\\bureau\\dist" ${ARG_PAREFEU_POSER}'`,
    )
  })

  it('relance : aucun argument pour le programme emballé, le dossier de la coquille sous Electron', () => {
    expect(argumentsDeRelance({ argv: [EXE] })).toEqual([])
    expect(argumentsDeRelance({ defaultApp: true, argv: ['electron.exe', path.resolve('dist')] })).toEqual([path.resolve('dist')])
  })

  it('règles : noms stables, sous-réseau local, privé et public ; seuls les blocages créés par Windows sont retirés', () => {
    const exe = "D:\\Programmes d'Éloïse\\Gtracker\\Gtracker.exe"
    const regles = scriptRegles(exe)
    expect(regles).toContain("$exe = 'D:\\Programmes d''Éloïse\\Gtracker\\Gtracker.exe'")
    expect(regles).toContain(`Remove-NetFirewallRule -Name '${REGLE_TCP}', '${REGLE_UDP}'`)
    expect(regles).toContain("-Protocol TCP -LocalPort '48217-48226' -RemoteAddress LocalSubnet -Profile Private, Public")
    expect(regles).toContain("-Protocol UDP -LocalPort '48218' -RemoteAddress LocalSubnet -Profile Private, Public")
    expect(regles).toContain("Get-NetFirewallRule -PolicyStore PersistentStore -Direction Inbound -Action Block | Where-Object { ($_.Name -like 'TCP Query User{*' -or $_.Name -like 'UDP Query User{*') -and (Vise $_) }")
    expect(regles).toContain('Remove-NetFirewallRule -InputObject $r')
    expect(regles).toContain('-Enabled True | Where-Object { Vise $_ })')
    expect(regles).toContain('{ exit 7 }')
    expect(regles).not.toContain('$fw.Rules.Remove')
    expect(regles).not.toContain('HNetCfg')
  })

  it('retrait : les deux règles de Gtracker seulement, 4 si l’une reste', () => {
    const retrait = scriptRetrait()
    expect(retrait).toContain(`Remove-NetFirewallRule -Name '${REGLE_TCP}', '${REGLE_UDP}' -PolicyStore PersistentStore`)
    expect(retrait).toContain('.Count -gt 0) { exit 4 }')
    expect(retrait).not.toMatch(/Block|Query User/)
  })

  it('apostrophes typographiques du chemin doublées dans les deux scripts', () => {
    const exe = 'C:\\Users\\D\u2019Artagnan\\Gtracker.exe'
    expect(decoder(scriptAutorisation(exe))).toContain("-FilePath 'C:\\Users\\D\u2019\u2019Artagnan\\Gtracker.exe'")
  })

  it('autorisation : les apostrophes typographiques du chemin sont doublées aussi', () => {
    const interne = scriptRegles('C:\\Users\\D\u2019Artagnan\\\u2018a\u201Ab\u201B\\Gtracker.exe')
    expect(interne).toContain("$exe = 'C:\\Users\\D\u2019\u2019Artagnan\\\u2018\u2018a\u201A\u201Ab\u201B\u201B\\Gtracker.exe'")
  })
})

describe('Gtracker relancé élevé', () => {
  const sortie = (patch: Partial<SortiePowershell> = {}): SortiePowershell => ({ code: 0, stdout: '', delaiDepasse: false, message: '', erreur: '', ...patch })

  it('l’action se lit au drapeau ; un lancement ordinaire n’en a aucune', () => {
    expect(actionElevee([EXE, ARG_PAREFEU_POSER])).toBe('poser')
    expect(actionElevee(['electron.exe', 'D:\\dist', ARG_PAREFEU_RETIRER])).toBe('retirer')
    expect(actionElevee([EXE])).toBeNull()
    expect(actionElevee([EXE, '--gtracker-pare-feu=autre', '--gtracker-pare-feu'])).toBeNull()
  })

  it('pose les règles de son propre chemin, ou les retire, et rend le code du script', async () => {
    const lances: { script: string; delaiMs: number }[] = []
    const lanceur = (code: number) => async (encode: string, delaiMs: number) => {
      lances.push({ script: decoder(encode), delaiMs })
      return sortie({ code })
    }
    expect(await executerActionElevee('poser', EXE, lanceur(0))).toBe(0)
    expect(lances[0].script).toBe(scriptRegles(EXE))
    expect(lances[0].delaiMs).toBeGreaterThanOrEqual(30_000)
    expect(await executerActionElevee('retirer', EXE, lanceur(7))).toBe(7)
    expect(lances[1].script).toBe(scriptRetrait())
    // Pas de code (lancement impossible, délai) : 4, l'échec des règles.
    expect(await executerActionElevee('poser', EXE, lanceur(-1))).toBe(4)
  })

  it('issue : accordée, refusée, blocage resté en place (code 7) en échec avec sa raison', () => {
    expect(issueAutorisation(sortie())).toEqual({ issue: 'accordee' })
    expect(issueAutorisation(sortie({ code: 3 }))).toEqual({ issue: 'refusee' })
    expect(issueAutorisation(sortie({ code: 4 }))).toEqual({ issue: 'echec', detail: "Windows n'a pas accepté la règle du pare-feu" })
    expect(issueAutorisation(sortie({ code: 7 }))).toEqual({ issue: 'echec', detail: 'un blocage de Gtracker posé dans le pare-feu de Windows reste en place' })
    expect(issueAutorisation(sortie({ code: -1, delaiDepasse: true }))).toEqual({ issue: 'echec', detail: "Windows n'a pas répondu à temps" })
    expect(issueAutorisation(sortie({ code: 9 }))).toEqual({ issue: 'echec', detail: 'Windows PowerShell a rendu le code 9' })
  })
})

describe.runIf(process.platform === 'win32')('syntaxe des scripts, lue par Windows PowerShell sans jamais les exécuter', () => {
  it('aucune erreur d’analyse', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'gtracker-parefeu-'))
    try {
      const scripts: Record<string, string> = {
        releve: decoder(scriptReleve()),
        regles: scriptRegles("D:\\Programmes d'Éloïse\\Gtracker.exe"),
        retrait: scriptRetrait(),
        autorisation: decoder(scriptAutorisation('C:\\e\\electron.exe', ['D:\\mes essais\\dist'])),
      }
      for (const [nom, script] of Object.entries(scripts)) writeFileSync(path.join(dossier, `${nom}.ps1`), `\uFEFF${script}`, 'utf8')
      const analyse = [
        "$ProgressPreference = 'SilentlyContinue'",
        `$res = @{}`,
        `foreach ($f in Get-ChildItem -LiteralPath '${dossier}' -Filter *.ps1) {`,
        '  $t = $null; $e = $null',
        '  [void][Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)',
        '  $res[$f.BaseName] = @($e | ForEach-Object { $_.Message })',
        '}',
        '[Console]::Out.Write((ConvertTo-Json -InputObject $res -Compress))',
      ].join('\n')
      const sortieJson = execFileSync(cheminPowershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(analyse, 'utf16le').toString('base64')], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
      })
      const erreurs = JSON.parse(sortieJson) as Record<string, string[] | string | null>
      expect(Object.keys(erreurs).sort()).toEqual(Object.keys(scripts).sort())
      for (const liste of Object.values(erreurs)) expect([liste ?? []].flat()).toEqual([])
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  }, 40_000)
})
