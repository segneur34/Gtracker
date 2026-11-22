// Le pare-feu de Windows, vu et autorisé par le programme, pour le sans-fil (`sansFil.ts`). Un essai de connexion du
// PC vers lui-même ne voit pas un blocage (Windows ne filtre pas le trafic du PC vers lui-même) : la coquille lit
// donc la configuration du pare-feu, sans droits d'administrateur, et la juge ici, en TypeScript pur.
//
// Lecture (`scriptReleve`, environ deux secondes) : un seul Windows PowerShell, sortie JSON en UTF-8, aucun texte
// traduit, des nombres seulement. Le chemin de l'exécutable passe par la variable d'environnement
// `GTRACKER_PAREFEU_EXE` du processus lancé, jamais par la ligne de commande. Le relevé donne :
// - les adresses IPv4 et leur interface, et la catégorie du réseau de chaque interface (0 public, 1 privé, 2 domaine) ;
//   une interface sans profil, comme celle du partage de connexion, est publique pour le pare-feu ;
// - par profil (1 domaine, 2 privé, 4 public) : pare-feu actif, tout entrant bloqué, action entrante par défaut ; et
//   `LocalPolicyModifyState` (différent de 0 : une stratégie de groupe passe avant les règles locales) ;
// - les règles entrantes du programme (même nom de fichier ; le chemin entier est comparé ici, variables développées
//   et sans casse) et les règles actives sans programme, ni service, ni propriétaire, ni paquet : celles des
//   applications du Store, sans programme mais réservées à leur paquet (`LocalUserOwner`), ne valent pas pour Gtracker.
// Ne se voient pas : un pare-feu tiers, une stratégie de groupe au-delà de `LocalPolicyModifyState`.
//
// Autorisation (`scriptAutorisation`) : un PowerShell ordinaire en lance un second, élevé (une seule demande de
// Windows, qui affiche « Windows PowerShell »), qui remplace les règles `Gtracker-SansFil-TCP` et `Gtracker-SansFil-UDP`
// (entrantes, autorisées, pour l'exécutable, ports du serveur et de la sonde, sous-réseau local, profils privé et
// public : le partage de connexion est un réseau public pour Windows) et retire les règles de blocage entrantes du
// même exécutable (un blocage l'emporte toujours sur une autorisation). Le refus de l'utilisateur se lit au code
// d'erreur 1223 de Windows, rendu en code de sortie 3. La règle reste après une désinstallation, sans effet puisque
// le chemin qu'elle vise a disparu.

import { execFile } from 'node:child_process'
import path from 'node:path'
import { PORT_SONDE } from './sonde'
import { PORT_SANS_FIL } from './trames'

/** Ce que le pare-feu laisse passer : `bloque` s'affirme ; `inconnu` quand rien n'a pu être lu. */
export type PareFeu = 'ouvert' | 'bloque' | 'inconnu'

/** Jugement du relevé ; `reparable` : l'autorisation de Gtracker suffirait à ouvrir. */
export type JugementPareFeu = { pareFeu: PareFeu; reparable: boolean }

/**
 * Relevé qui n'a pas pu être lu, et pourquoi, en français : délai dépassé, code de sortie, sortie illisible. Rien de
 * personnel (ni chemin, ni contenu de la sortie) : la raison va au journal.
 */
export type ReleveRate = { raison: string }

/** Ce que rend une lecture du pare-feu : le jugement, ou la raison de l'échec. */
export type LecturePareFeu = JugementPareFeu | ReleveRate

/** Vrai si la lecture a échoué. */
export const releveRate = (lecture: LecturePareFeu): lecture is ReleveRate => 'raison' in lecture

export type IssueAutorisation = 'accordee' | 'refusee' | 'echec'

/** Issue de la demande d'autorisation ; `detail` dit pourquoi elle a échoué, en français. */
export type ResultatAutorisation = { issue: IssueAutorisation; detail?: string }

/** Ports TCP essayés par le serveur à partir du premier quand il est pris : l'autorisation les couvre tous. */
export const ESSAIS_PORT = 10

/** Noms stables des règles posées par l'autorisation : une nouvelle demande les remplace, rien ne s'empile. */
export const REGLE_TCP = 'Gtracker-SansFil-TCP'
export const REGLE_UDP = 'Gtracker-SansFil-UDP'

/** Variable d'environnement qui porte le chemin de l'exécutable au script de lecture. */
export const VARIABLE_EXE = 'GTRACKER_PAREFEU_EXE'

/** Profils du pare-feu, en bits. */
const PROFIL_DOMAINE = 1
const PROFIL_PRIVE = 2
const PROFIL_PUBLIC = 4
/** Profils couverts par l'autorisation. */
const PROFILS_AUTORISES = PROFIL_PRIVE | PROFIL_PUBLIC

/** Protocoles du pare-feu. */
const TCP = 6
const UDP = 17
const TOUS_PROTOCOLES = 256

/** Action d'une règle ou action entrante par défaut. */
const BLOQUER = 0
const AUTORISER = 1

/** Codes de sortie du script d'autorisation : refus de l'utilisateur, échec dans la session élevée. */
const SORTIE_REFUS = 3
const SORTIE_ECHEC_REGLES = 4

/**
 * Délai de la lecture : mesurée à 7 s au lancement du programme sur un vrai poste (1 s lancée à la main), quand
 * Windows charge encore ce que le programme vient de démarrer ; large pour qu'un poste lent ne la fasse pas échouer.
 */
export const DELAI_RELEVE_MS = 30_000
/**
 * Délai de l'autorisation : elle attend la réponse de l'utilisateur à la demande de Windows, qui peut prendre plus
 * longtemps que la lecture.
 */
const DELAI_AUTORISATION_MS = 120_000

/** Une règle entrante relevée. */
export type RegleRelevee = {
  /** Programme tel que Windows le garde (variables comprises), vide pour une règle sans programme. */
  programme: string
  action: number
  activee: boolean
  /** Profils, en bits. */
  profils: number
  protocole: number
  /** Ports locaux : « * », vide, ou une liste de ports et de plages. */
  ports: string
  /** Adresses distantes : « * », « LocalSubnet »… */
  distantes: string
  /** Types d'interface : « All », « Wireless »… */
  interfaces: string
}

/** Ce que Windows dit de son pare-feu et de ses réseaux. */
export type ReleveWindows = {
  adresses: { adresse: string; interface: number }[]
  categories: { interface: number; categorie: number }[]
  profils: { profil: number; actif: boolean; toutBloque: boolean; entreeParDefaut: number }[]
  /** `LocalPolicyModifyState` : 0 quand les règles locales s'appliquent. */
  strategie: number
  regles: RegleRelevee[]
}

/** Ce que le serveur écoute, et l'exécutable qui écoute. */
export type ContexteEcoute = {
  adresses: readonly string[]
  port: number
  /** Port UDP de la découverte, `null` sans découverte. */
  portSonde: number | null
}

export type ContexteJugement = ContexteEcoute & {
  exe: string
  /** Variables d'environnement des chemins de règles ; celles du processus par défaut. */
  env?: Record<string, string | undefined>
}

// ---------- scripts ----------

/**
 * Une chaîne entre apostrophes de PowerShell : chaque apostrophe doublée, la droite comme les quatre typographiques
 * (U+2018 à U+201B), que PowerShell prend aussi pour des apostrophes.
 */
const litteral = (texte: string) => `'${texte.replace(/['‘’‚‛]/g, '$&$&')}'`

/** Un script en argument de `-EncodedCommand` : UTF-16LE en base64. */
export const encoderCommande = (script: string): string => Buffer.from(script, 'utf16le').toString('base64')

/** Windows PowerShell du système, par son chemin complet. */
export function cheminPowershell(env: Record<string, string | undefined> = process.env): string {
  return path.win32.join(env.SystemRoot ?? env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

const ARGUMENTS_POWERSHELL = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']

/** Script de lecture, encodé pour `-EncodedCommand` ; l'exécutable vient de `GTRACKER_PAREFEU_EXE`. */
export function scriptReleve(): string {
  return encoderCommande(
    [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false',
      `$exe = [string]$env:${VARIABLE_EXE}`,
      "$fin = '\\' + $exe.Substring($exe.LastIndexOf('\\') + 1)",
      // Les adresses par .NET plutôt que `Get-NetIPAddress` : plusieurs secondes de moins.
      '$adresses = @(foreach ($n in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {',
      '  $v4 = $n.GetIPProperties().GetIPv4Properties()',
      '  if (-not $v4) { continue }',
      "  foreach ($u in $n.GetIPProperties().UnicastAddresses) { if ($u.Address.AddressFamily -eq 'InterNetwork') { @{ adresse = $u.Address.ToString(); interface = [int]$v4.Index } } }",
      '})',
      '$categories = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue | ForEach-Object { @{ interface = [int]$_.InterfaceIndex; categorie = [int]$_.NetworkCategory } })',
      '$fw = New-Object -ComObject HNetCfg.FwPolicy2',
      '$profils = @(1, 2, 4 | ForEach-Object { @{ profil = $_; actif = [bool]$fw.FirewallEnabled($_); toutBloque = [bool]$fw.BlockAllInboundTraffic($_); entreeParDefaut = [int]$fw.DefaultInboundAction($_) } })',
      '$regles = @(foreach ($r in $fw.Rules) {',
      '  if ($r.Direction -ne 1) { continue }',
      '  $programme = [string]$r.ApplicationName',
      "  if ($programme -eq '') { if (-not $r.Enabled -or $r.serviceName -or $r.LocalUserOwner -or $r.LocalAppPackageId) { continue } }",
      "  elseif (-not $programme.Trim('\"').EndsWith($fin, [StringComparison]::OrdinalIgnoreCase)) { continue }",
      '  @{ programme = $programme; action = [int]$r.Action; activee = [bool]$r.Enabled; profils = [int]$r.Profiles; protocole = [int]$r.Protocol; ports = [string]$r.LocalPorts; distantes = [string]$r.RemoteAddresses; interfaces = [string]$r.InterfaceTypes }',
      '})',
      '$releve = @{ adresses = $adresses; categories = $categories; profils = $profils; strategie = [int]$fw.LocalPolicyModifyState; regles = $regles }',
      '[Console]::Out.Write((ConvertTo-Json -InputObject $releve -Depth 6 -Compress))',
    ].join('\n'),
  )
}

/** Plage de ports que l'autorisation ouvre. */
export type PlageAutorisee = { premier: number; dernier: number; sonde: number }

const PLAGE_SANS_FIL: PlageAutorisee = { premier: PORT_SANS_FIL, dernier: PORT_SANS_FIL + ESSAIS_PORT - 1, sonde: PORT_SONDE }

/** Script lancé élevé : les deux règles de Gtracker remplacées, les blocages du même exécutable retirés. */
export function scriptRegles(exe: string, plage: PlageAutorisee = PLAGE_SANS_FIL): string {
  const regle = (nom: string, protocole: string, ports: string) =>
    `  New-NetFirewallRule -Name ${litteral(nom)} -DisplayName ${litteral(`Gtracker, sans-fil (${protocole})`)} -Direction Inbound -Action Allow -Program $exe -Protocol ${protocole} -LocalPort ${litteral(ports)} -RemoteAddress LocalSubnet -Profile Private, Public | Out-Null`
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    'try {',
    `  $exe = ${litteral(exe)}`,
    `  Remove-NetFirewallRule -Name ${litteral(REGLE_TCP)}, ${litteral(REGLE_UDP)} -ErrorAction SilentlyContinue`,
    regle(REGLE_TCP, 'TCP', `${plage.premier}-${plage.dernier}`),
    regle(REGLE_UDP, 'UDP', String(plage.sonde)),
    '  $cible = $exe.ToLowerInvariant()',
    '  $fw = New-Object -ComObject HNetCfg.FwPolicy2',
    "  $noms = @($fw.Rules | Where-Object { $_.Direction -eq 1 -and $_.Action -eq 0 -and -not [string]::IsNullOrEmpty($_.ApplicationName) -and [Environment]::ExpandEnvironmentVariables($_.ApplicationName.Trim('\"')).ToLowerInvariant() -eq $cible } | ForEach-Object { $_.Name })",
    '  foreach ($nom in $noms) { $fw.Rules.Remove($nom) }',
    '  exit 0',
    `} catch { exit ${SORTIE_ECHEC_REGLES} }`,
  ].join('\n')
}

/**
 * Script d'autorisation, encodé pour `-EncodedCommand` : il lance `scriptRegles` élevé, caché, et rend son code de
 * sortie ; 3 si l'utilisateur refuse la demande de Windows.
 */
export function scriptAutorisation(exe: string, powershell: string = cheminPowershell(), plage: PlageAutorisee = PLAGE_SANS_FIL): string {
  const arguments_ = [...ARGUMENTS_POWERSHELL, encoderCommande(scriptRegles(exe, plage))].join(' ')
  return encoderCommande(
    [
      "$ErrorActionPreference = 'Stop'",
      'try {',
      `  $p = Start-Process -FilePath ${litteral(powershell)} -ArgumentList ${litteral(arguments_)} -Verb RunAs -WindowStyle Hidden -Wait -PassThru`,
      '  if ($null -eq $p.ExitCode) { exit 6 }',
      '  exit $p.ExitCode',
      '} catch {',
      '  $e = $_.Exception',
      '  while ($null -ne $e) {',
      `    if ($e -is [ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 1223) { exit ${SORTIE_REFUS} }`,
      '    $e = $e.InnerException',
      '  }',
      '  exit 5',
      '}',
    ].join('\n'),
  )
}

// ---------- lecture du relevé ----------

/** Un tableau, même là où `ConvertTo-Json` a écrit un objet seul (tableau d'un élément) ou rien (tableau vide). */
const liste = (valeur: unknown): unknown[] => (Array.isArray(valeur) ? valeur : valeur === null || valeur === undefined ? [] : [valeur])

const objet = (valeur: unknown): Record<string, unknown> | null =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : null

const entier = (valeur: unknown): number | null => (typeof valeur === 'number' && Number.isInteger(valeur) ? valeur : null)
const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur : '')

/** Le relevé écrit par `scriptReleve`, ou `null` s'il est illisible (les trois profils doivent y être). */
export function lireReleve(json: string): ReleveWindows | null {
  let brut: unknown
  try {
    brut = JSON.parse(json.replace(/^\uFEFF/, '').trim())
  } catch {
    return null
  }
  const racine = objet(brut)
  const strategie = entier(racine?.strategie)
  if (!racine || strategie === null) return null
  const adresses: ReleveWindows['adresses'] = []
  for (const a of liste(racine.adresses).map(objet)) {
    const interface_ = entier(a?.interface)
    if (a && typeof a.adresse === 'string' && interface_ !== null) adresses.push({ adresse: a.adresse, interface: interface_ })
  }
  const categories: ReleveWindows['categories'] = []
  for (const c of liste(racine.categories).map(objet)) {
    const interface_ = entier(c?.interface)
    const categorie = entier(c?.categorie)
    if (interface_ !== null && categorie !== null) categories.push({ interface: interface_, categorie })
  }
  const profils: ReleveWindows['profils'] = []
  for (const p of liste(racine.profils).map(objet)) {
    const profil = entier(p?.profil)
    const entreeParDefaut = entier(p?.entreeParDefaut)
    if (!p || profil === null || entreeParDefaut === null || typeof p.actif !== 'boolean' || typeof p.toutBloque !== 'boolean') return null
    profils.push({ profil, actif: p.actif, toutBloque: p.toutBloque, entreeParDefaut })
  }
  if (![PROFIL_DOMAINE, PROFIL_PRIVE, PROFIL_PUBLIC].every((bit) => profils.some((p) => p.profil === bit))) return null
  const regles: RegleRelevee[] = []
  for (const r of liste(racine.regles).map(objet)) {
    const action = entier(r?.action)
    const profilsRegle = entier(r?.profils)
    const protocole = entier(r?.protocole)
    if (!r || action === null || profilsRegle === null || protocole === null || typeof r.activee !== 'boolean') continue
    regles.push({
      programme: texte(r.programme),
      action,
      activee: r.activee,
      profils: profilsRegle,
      protocole,
      ports: texte(r.ports),
      distantes: texte(r.distantes),
      interfaces: texte(r.interfaces),
    })
  }
  return { adresses, categories, profils, strategie, regles }
}

// ---------- jugement ----------

/** Chemin comparable : guillemets ôtés, variables `%NOM%` développées, barres de Windows, sans casse. */
export function normaliserChemin(chemin: string, env: Record<string, string | undefined> = process.env): string {
  const variables = new Map(Object.entries(env).map(([nom, valeur]) => [nom.toLowerCase(), valeur]))
  return chemin
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/%([^%]+)%/g, (tout, nom: string) => variables.get(nom.toLowerCase()) ?? tout)
    .replace(/\//g, '\\')
    .toLowerCase()
}

/** Vrai si la liste de ports locaux d'une règle couvre `port` (« * » ou vide : tous). */
function portsCouvrent(ports: string, port: number): boolean {
  const jetons = ports.split(',').map((j) => j.trim())
  if (jetons.every((j) => j === '')) return true
  return jetons.some((j) => {
    if (j === '*') return true
    if (/^\d+$/.test(j)) return Number(j) === port
    const plage = /^(\d+)-(\d+)$/.exec(j)
    return plage !== null && Number(plage[1]) <= port && port <= Number(plage[2])
  })
}

/**
 * Vrai si une liste (adresses distantes, types d'interface) vaut pour tout ce qui vient du réseau local. Une liste plus
 * étroite (quelques adresses, le seul Wi-Fi) n'est pas comptée, ni pour autoriser ni pour bloquer.
 */
const touteSource = (valeur: string, larges: readonly string[]) => {
  const jetons = valeur.split(',').map((j) => j.trim().toLowerCase())
  return jetons.every((j) => j === '') || jetons.some((j) => j === '*' || larges.includes(j))
}

type Flux = { protocole: number; port: number }

/** Ce que décide le pare-feu pour un flux entrant sur un profil. */
type Verdict = 'autoriseParRegle' | 'autoriseParDefaut' | 'bloqueParProgramme' | 'bloqueParRegleGenerale' | 'bloqueParDefaut'

function verdictFlux(regles: readonly RegleRelevee[], profil: number, flux: Flux, entreeParDefaut: number): Verdict {
  const applicables = regles.filter(
    (r) =>
      (r.profils & profil) !== 0 &&
      (r.protocole === TOUS_PROTOCOLES || r.protocole === flux.protocole) &&
      portsCouvrent(r.ports, flux.port) &&
      touteSource(r.distantes, ['localsubnet']) &&
      touteSource(r.interfaces, ['all']),
  )
  const blocages = applicables.filter((r) => r.action === BLOQUER)
  // Un blocage l'emporte toujours ; celui d'une règle sans programme n'est pas retiré par l'autorisation.
  if (blocages.some((r) => r.programme.trim() === '')) return 'bloqueParRegleGenerale'
  if (blocages.length > 0) return 'bloqueParProgramme'
  if (applicables.some((r) => r.action === AUTORISER)) return 'autoriseParRegle'
  return entreeParDefaut === AUTORISER ? 'autoriseParDefaut' : 'bloqueParDefaut'
}

/** Profil du pare-feu d'une adresse : celui de la catégorie de son interface, public sans profil. */
function profilDe(releve: ReleveWindows, adresse: string): number {
  const interface_ = releve.adresses.find((a) => a.adresse === adresse)?.interface
  const categorie = releve.categories.find((c) => c.interface === interface_)?.categorie
  return categorie === 1 ? PROFIL_PRIVE : categorie === 2 ? PROFIL_DOMAINE : PROFIL_PUBLIC
}

const INCONNU: JugementPareFeu = Object.freeze({ pareFeu: 'inconnu', reparable: false })

/**
 * Juge le relevé pour chaque adresse où le serveur écoute : le port TCP du serveur et le port UDP de la sonde doivent
 * passer, sinon c'est bloqué (dès qu'une adresse l'est). Réparable si l'autorisation de Gtracker suffirait : profil
 * privé ou public, ni tout entrant bloqué, ni blocage d'une règle sans programme, ni stratégie de groupe. Sous une
 * stratégie de groupe, une ouverture qui ne tient qu'à une règle locale n'est pas sûre : `inconnu`.
 */
export function jugerPareFeu(releve: ReleveWindows | null, contexte: ContexteJugement): JugementPareFeu {
  if (!releve || contexte.adresses.length === 0) return INCONNU
  const env = contexte.env ?? process.env
  const exe = normaliserChemin(contexte.exe, env)
  const regles = releve.regles.filter((r) => r.activee && (r.programme.trim() === '' || normaliserChemin(r.programme, env) === exe))
  const flux: Flux[] = [{ protocole: TCP, port: contexte.port }]
  if (contexte.portSonde !== null) flux.push({ protocole: UDP, port: contexte.portSonde })
  const strategie = releve.strategie !== 0
  let bloque = false
  let reparable = true
  let parRegleLocale = false
  for (const adresse of contexte.adresses) {
    const profil = profilDe(releve, adresse)
    const etat = releve.profils.find((p) => p.profil === profil)
    if (!etat) return INCONNU
    if (!etat.actif) continue
    if (etat.toutBloque) {
      bloque = true
      reparable = false
      continue
    }
    for (const f of flux) {
      const verdict = verdictFlux(regles, profil, f, etat.entreeParDefaut)
      if (verdict === 'autoriseParRegle') parRegleLocale = true
      if (verdict.startsWith('bloque')) {
        bloque = true
        if (verdict === 'bloqueParRegleGenerale' || (profil & PROFILS_AUTORISES) === 0) reparable = false
      }
    }
  }
  if (bloque) return { pareFeu: 'bloque', reparable: reparable && !strategie }
  if (strategie && parRegleLocale) return INCONNU
  return { pareFeu: 'ouvert', reparable: false }
}

// ---------- sur le vrai Windows ----------

/**
 * Fin d'un Windows PowerShell : `code` -1 quand il n'a pas rendu de code (lancement impossible, délai, sortie trop
 * longue), `erreur` le code d'erreur de Node dans ce cas (`ENOENT`…), vide sinon.
 */
export type SortiePowershell = { code: number; stdout: string; delaiDepasse: boolean; message: string; erreur: string }

/** Windows PowerShell sur un script encodé, sans shell, fenêtre cachée, délai borné ; ne rejette jamais. */
function lancerPowershell(encode: string, delaiMs: number, env: Record<string, string | undefined> = process.env): Promise<SortiePowershell> {
  return new Promise((fin) => {
    execFile(
      cheminPowershell(env),
      [...ARGUMENTS_POWERSHELL, encode],
      { windowsHide: true, timeout: delaiMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', shell: false, env },
      (erreur, stdout) => {
        if (!erreur) return fin({ code: 0, stdout, delaiDepasse: false, message: '', erreur: '' })
        const e = erreur as NodeJS.ErrnoException & { killed?: boolean; signal?: string | null }
        const code = typeof e.code === 'number' ? e.code : -1
        fin({
          code,
          stdout: stdout ?? '',
          delaiDepasse: typeof e.code !== 'string' && e.killed === true && e.signal != null,
          message: e.message,
          erreur: typeof e.code === 'string' ? e.code : '',
        })
      },
    )
  })
}

/**
 * Le jugement d'un relevé d'après la fin de son Windows PowerShell, ou la raison de l'échec : jamais le message de
 * Node ni la sortie, qui peuvent porter le chemin du programme (et le nom de l'utilisateur).
 */
export function lectureDeSortie(sortie: SortiePowershell, contexte: ContexteJugement, delaiMs: number = DELAI_RELEVE_MS): LecturePareFeu {
  if (sortie.delaiDepasse) return { raison: `délai de ${Math.round(delaiMs / 1000)} s dépassé` }
  if (sortie.code === -1) return { raison: `Windows PowerShell en échec${sortie.erreur ? ` (${sortie.erreur})` : ''}` }
  if (sortie.code !== 0) return { raison: `Windows PowerShell a rendu le code ${sortie.code}` }
  const releve = lireReleve(sortie.stdout)
  if (!releve) return { raison: `sortie illisible (${sortie.stdout.length} caractères)` }
  return jugerPareFeu(releve, contexte)
}

/** Lit et juge le pare-feu de Windows ; ne rejette jamais, rend la raison d'un relevé raté (hors de Windows compris). */
export async function lirePareFeuWindows(contexte: ContexteJugement, { delaiMs = DELAI_RELEVE_MS }: { delaiMs?: number } = {}): Promise<LecturePareFeu> {
  if (process.platform !== 'win32') return { raison: 'hors de Windows' }
  const sortie = await lancerPowershell(scriptReleve(), delaiMs, { ...process.env, [VARIABLE_EXE]: contexte.exe })
  return lectureDeSortie(sortie, contexte, delaiMs)
}

/** Demande à Windows d'autoriser Gtracker (une demande de confirmation à l'utilisateur) ; ne rejette jamais. */
export async function autoriserPareFeuWindows(exe: string): Promise<ResultatAutorisation> {
  if (process.platform !== 'win32') return { issue: 'echec', detail: "le pare-feu de Windows n'existe que sous Windows" }
  const sortie = await lancerPowershell(scriptAutorisation(exe), DELAI_AUTORISATION_MS)
  if (sortie.code === 0) return { issue: 'accordee' }
  if (sortie.code === SORTIE_REFUS) return { issue: 'refusee' }
  if (sortie.delaiDepasse) return { issue: 'echec', detail: "Windows n'a pas répondu à temps" }
  if (sortie.code === SORTIE_ECHEC_REGLES) return { issue: 'echec', detail: "Windows n'a pas accepté la règle du pare-feu" }
  return { issue: 'echec', detail: sortie.code === -1 ? sortie.message : `Windows PowerShell a rendu le code ${sortie.code}` }
}
