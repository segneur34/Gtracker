// Essai de l'installeur Windows sur ce poste, sans personne devant l'écran : il installe pour de bon, par utilisateur,
// puis remet le poste dans son état de départ.
//
//   node outils/installeur-essai.mjs [<installeur.exe>] [--sans-apk] [--releve]
//
// Par défaut, l'installeur de la version de `package.json` dans `bureau/sortie/` (`npm run installeur`), qui doit
// contenir l'APK ; `--sans-apk` pour un installeur construit sans elle (son absence est alors vérifiée) ; `--releve`
// affiche seulement l'état du poste (raccourcis, installation, profil, Documents), sans rien installer.
//
// Étapes :
//  0. état de départ : un programme déjà installé (dossier `%LOCALAPPDATA%\Programs\Gtracker` ou entrée « Gtracker »
//     dans la liste des programmes de l'utilisateur) arrête l'essai sans rien installer (code 2) ; un raccourci
//     « Gtracker » déjà présent sur le Bureau ou dans le menu Démarrer est copié à part ; relevé du vrai profil
//     (`%APPDATA%\Gtracker`), de `Documents\Gtracker` et d'un dossier mémoire témoin, lus sans y écrire ;
//  1. installation silencieuse (`/S`) dans un dossier temporaire (`/D=`) : programme, application, APK, raccourcis,
//     entrée de désinstallation ;
//  2. lancement du programme installé en mode d'essai de la coquille, sur un profil temporaire : la page répond ;
//  3. réinstallation par-dessus, sans `/D=` (comme une mise à jour) : même dossier, fichiers remplacés, une seule entrée ;
//     puis une autre par-dessus le programme ouvert (fenêtre montrée transparente) : l'installeur le ferme lui-même par
//     sa fenêtre, sans question ni arrêt forcé, et remplace les fichiers ;
//  4. désinstallation silencieuse : programme, raccourcis et entrées disparus ;
//  5. raccourcis d'origine remis, profil, mémoire et Documents comparés au relevé de départ.
// Les processus lancés reçoivent `GTRACKER_BANC` et un `GTRACKER_PROFIL` temporaire : même si l'installeur ouvrait
// le programme, le vrai profil ne serait pas touché.

import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { environnementPropre, nomApk, nomInstalleur, versionBureau } from './bureau.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 9471
const CLE_DESINSTALLATION = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
const DOSSIERS_DU_SHELL = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders'

const args = process.argv.slice(2)
const sansApk = args.includes('--sans-apk')
const releveSeul = args.includes('--releve')
const donne = args.find((a) => !a.startsWith('--'))
// Version : celle du nom de l'installeur donné, sinon celle de `package.json`.
const version = (donne && /Gtracker-Setup-(.+)\.exe$/i.exec(donne)?.[1]) || JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).version
const installeur = resolve(donne ?? join(RACINE, 'bureau', 'sortie', nomInstalleur(version)))

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let echecs = 0
const check = (quoi, ok, detail) => {
  console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${detail !== undefined ? ` (${detail})` : ''}`)
  if (!ok) echecs++
  return ok
}
const secondes = (debut) => `${((Date.now() - debut) / 1000).toFixed(1).replace('.', ',')} s`

// ---------- registre ----------
function reg(argv) {
  const r = spawnSync('reg', argv, { encoding: 'latin1', windowsHide: true })
  return { code: r.status, sortie: r.stdout ?? '' }
}
function valeurDuShell(nom) {
  const { sortie } = reg(['query', DOSSIERS_DU_SHELL, '/v', nom])
  const m = new RegExp(`^\\s*${nom}\\s+REG_\\w+\\s+(.+)$`, 'm').exec(sortie)
  if (!m) throw new Error(`dossier « ${nom} » introuvable dans le registre`)
  return m[1].trim()
}
/** Clés de la liste des programmes de l'utilisateur dont une valeur vaut exactement « Gtracker ». */
function entreesGtracker() {
  const { sortie } = reg(['query', CLE_DESINSTALLATION, '/s', '/f', 'Gtracker', '/d', '/e'])
  return sortie.split(/\r?\n/).filter((l) => /^HKEY_/i.test(l.trim())).map((l) => l.trim())
}
function valeurs(cle) {
  const { code, sortie } = reg(['query', cle])
  if (code !== 0) return null
  const v = {}
  for (const l of sortie.split(/\r?\n/)) {
    const m = /^\s{2,}(.+?)\s+REG_\w+\s*(.*)$/.exec(l)
    if (m) v[m[1]] = m[2].trim()
  }
  return v
}
const cleExiste = (cle) => reg(['query', cle]).code === 0

// ---------- relevés de dossiers ----------
/** Liste de chaque fichier d'un dossier : chemin relatif, taille, date de modification ; lue sans rien écrire. */
function releve(dossier) {
  if (!existsSync(dossier)) return 'absent'
  const lignes = []
  const parcourir = (d, rel) => {
    let entrees
    try { entrees = readdirSync(d, { withFileTypes: true }) } catch (e) { lignes.push(`${rel}/ illisible ${e.code}`); return }
    for (const e of entrees) {
      const p = join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) parcourir(p, r)
      else {
        try { const s = statSync(p); lignes.push(`${r} ${s.size} ${s.mtimeMs}`) } catch (er) { lignes.push(`${r} illisible ${er.code}`) }
      }
    }
  }
  parcourir(dossier, '')
  return lignes.sort().join('\n')
}
const resume = (r) => (r === 'absent' ? 'absent' : `${r.split('\n').filter(Boolean).length} fichiers`)

// ---------- processus ----------
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `)
async function disparu(pid, ms) {
  for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200) }
  return !vivant(pid)
}
function environnementEssai(profil) {
  return { ...environnementPropre(process.env), GTRACKER_BANC: '1', GTRACKER_PROFIL: profil }
}
/** Lance l'installeur ou le désinstalleur et attend sa fin. */
function executer(exe, argv, profil) {
  const debut = Date.now()
  const r = spawnSync(exe, argv, { env: environnementEssai(profil), windowsHide: true, timeout: 5 * 60_000 })
  return { code: r.status, duree: secondes(debut), erreur: r.error?.message }
}
async function attendre(condition, ms) {
  for (let t = 0; t < ms; t += 300) { if (condition()) return true; await pause(300) }
  return condition()
}
async function evaluer(ws, expression) {
  const socket = new WebSocket(ws)
  await new Promise((ok, ko) => { socket.onopen = ok; socket.onerror = () => ko(new Error('liaison de débogage refusée')) })
  const reponse = new Promise((ok) => { socket.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) ok(d.result?.result?.value) } })
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
  const valeur = await Promise.race([reponse, pause(5000).then(() => undefined)])
  socket.close()
  return valeur
}

/** Lance le programme installé en mode d'essai ; rend vrai si la page de l'application répond. */
async function lancerInstalle(exe, profil, dossier) {
  const journal = []
  const enfant = spawn(exe, [`--remote-debugging-port=${PORT}`, '--lang=fr-FR'], { env: environnementEssai(profil), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const lire = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) journal.push(l.trim()) }
  enfant.stdout.on('data', lire)
  enfant.stderr.on('data', lire)
  try {
    const debut = Date.now()
    await attendre(() => journal.some((l) => l.includes('prêt :')), 30_000)
    const pret = journal.find((l) => l.includes('prêt :')) ?? ''
    check('le programme installé démarre (journal de la coquille)', pret !== '', pret || journal.slice(-3).join(' | '))
    check("il sert l'application installée", pret.toLowerCase().includes(join(dossier, 'resources', 'dist').toLowerCase()))
    check('sur le profil temporaire, pas le vrai', pret.toLowerCase().includes(profil.toLowerCase()))
    let page = null
    for (let k = 0; k < 60 && !page; k++) {
      try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((p) => p.type === 'page' && p.url.startsWith('https://gtracker.localhost')) ?? null } catch { /* pas prêt */ }
      if (!page) await pause(500)
    }
    check('la fenêtre ouvre https://gtracker.localhost', page !== null, page?.url)
    if (page) {
      let texte = ''
      for (let k = 0; k < 30 && texte.length < 20; k++) {
        texte = String((await evaluer(page.webSocketDebuggerUrl, 'document.body ? document.body.innerText : ""')) ?? '')
        if (texte.length < 20) await pause(500)
      }
      check("la page de l'application s'affiche", texte.length >= 20, `${texte.replace(/\s+/g, ' ').slice(0, 60)}…, ${secondes(debut)}`)
    }
  } finally {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(enfant.pid)], { stdio: 'ignore', windowsHide: true })
    check('programme arrêté', await disparu(enfant.pid, 10_000))
  }
}

/** Processus dont l'exécutable est dans `dossier` (programme installé, ses processus fils d'Electron compris). */
function processusDans(dossier) {
  const filtre = `$d = '${dossier.replace(/\\?$/, '\\').replace(/'/g, "''")}'; @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($d, [StringComparison]::OrdinalIgnoreCase) }).Count`
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', filtre], { encoding: 'utf8', windowsHide: true })
  return Number.parseInt(r.stdout.trim(), 10)
}

/**
 * Réinstallation par-dessus le programme ouvert : l'installeur le ferme par sa fenêtre (« fermeture demandée » au
 * journal de la coquille), sans question, puis remplace les fichiers. En `/S`, une question serait répondue seule :
 * l'absence de question se voit au lancement à la main de l'installeur, pas ici.
 */
async function reinstallerParDessusOuvert(exe, profil, dossier) {
  const journal = []
  const env = { ...environnementEssai(profil), GTRACKER_BANC_MONTRER: 'transparente' }
  const enfant = spawn(exe, ['--lang=fr-FR'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const lire = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) journal.push(l.trim()) }
  enfant.stdout.on('data', lire)
  enfant.stderr.on('data', lire)
  try {
    const pret = await attendre(() => journal.some((l) => l.includes('prêt :')), 30_000)
    await pause(2000)
    check('programme ouvert avant la réinstallation', pret && vivant(enfant.pid), `${processusDans(dossier)} processus`)
    const temoin = join(dossier, 'resources', 'temoin-programme-ouvert.txt')
    writeFileSync(temoin, 'ancien\n')
    const mtimeAvant = statSync(exe).mtimeMs
    const r = executer(installeur, ['/S'], profil)
    check('réinstallation par-dessus le programme ouvert', r.code === 0, `code ${r.code}, ${r.duree}`)
    check('le programme ouvert a été fermé', await disparu(enfant.pid, 10_000))
    check('fermé par sa fenêtre, sans arrêt forcé', journal.some((l) => l.includes('fermeture demandée')), journal.slice(-2).join(' | '))
    check('aucun processus du programme encore ouvert', processusDans(dossier) === 0)
    check('programme remplacé', existsSync(exe) && statSync(exe).mtimeMs >= mtimeAvant)
    check("fichiers de l'installation ouverte retirés", !existsSync(temoin))
  } finally {
    if (vivant(enfant.pid)) spawnSync('taskkill', ['/T', '/F', '/PID', String(enfant.pid)], { stdio: 'ignore', windowsHide: true })
  }
}

// ---------- essai ----------
async function principal() {
  if (!existsSync(installeur)) throw new Error(`installeur absent : ${installeur} (npm run installeur)`)
  const temp = tmpdir()
  if (/\s/.test(temp)) throw new Error(`dossier temporaire avec une espace (${temp}) : /D= ne l'accepte pas`)
  const atelier = mkdtempSync(join(temp, 'gtracker-installeur-'))
  const dossier = join(atelier, 'Programs', 'Gtracker')
  const profilEssai = join(atelier, 'profil')
  const sauvegarde = join(atelier, 'raccourcis')
  const memoireTemoin = join(atelier, 'memoire-temoin')
  const semver = versionBureau(version)
  console.log(`Installeur : ${installeur} (${(statSync(installeur).size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo)`)

  // 0. état de départ
  const bureau = valeurDuShell('Desktop')
  const menu = valeurDuShell('Programs')
  const documents = valeurDuShell('Personal')
  const raccourcis = [join(bureau, 'Gtracker.lnk'), join(menu, 'Gtracker.lnk')]
  const installationParDefaut = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Gtracker')
  const profilReel = join(process.env.APPDATA ?? '', 'Gtracker')
  const documentsGtracker = join(documents, 'Gtracker')
  const entreesAvant = entreesGtracker()
  console.log(`· départ : raccourcis ${raccourcis.map((r) => `${r} ${existsSync(r) ? 'présent' : 'absent'}`).join(', ')}`)
  console.log(`· départ : ${installationParDefaut} ${existsSync(installationParDefaut) ? 'présent' : 'absent'}, entrées « Gtracker » : ${entreesAvant.length}`)
  if (releveSeul) {
    console.log(`· départ : profil ${profilReel} ${resume(releve(profilReel))}, ${documentsGtracker} ${resume(releve(documentsGtracker))}`)
    const processus = spawnSync('tasklist', ['/FI', 'IMAGENAME eq Gtracker.exe', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout
    console.log(`· Gtracker.exe en cours : ${(processus.match(/Gtracker\.exe/gi) ?? []).length}`)
    rmSync(atelier, { recursive: true, force: true })
    return
  }
  if (existsSync(installationParDefaut) || entreesAvant.length > 0) {
    rmSync(atelier, { recursive: true, force: true })
    console.log(`BLOQUÉ : un programme Gtracker est déjà installé (${[existsSync(installationParDefaut) ? installationParDefaut : '', ...entreesAvant].filter(Boolean).join(', ')}) ; rien n'a été installé.`)
    process.exitCode = 2
    return
  }
  mkdirSync(sauvegarde, { recursive: true })
  const origines = raccourcis.map((r, i) => {
    if (!existsSync(r)) return null
    const copie = join(sauvegarde, `${i}.lnk`)
    copyFileSync(r, copie)
    const s = statSync(r)
    return { chemin: r, copie, atime: s.atime, mtime: s.mtime }
  })
  mkdirSync(memoireTemoin, { recursive: true })
  writeFileSync(join(memoireTemoin, 'temoin.gpx'), '<gpx/>\n')
  const avant = { profil: releve(profilReel), documents: releve(documentsGtracker), memoire: releve(memoireTemoin) }
  console.log(`· départ : profil ${profilReel} ${resume(avant.profil)}, ${documentsGtracker} ${resume(avant.documents)}`)

  let installe = false
  try {
    // 1. installation
    const debutInstall = Date.now()
    const r1 = executer(installeur, ['/S', `/D=${dossier}`], profilEssai)
    installe = true
    check('installation silencieuse', r1.code === 0, `code ${r1.code}, ${r1.duree}${r1.erreur ? `, ${r1.erreur}` : ''}`)
    const exe = join(dossier, 'Gtracker.exe')
    check('Gtracker.exe dans le dossier choisi', existsSync(exe), dossier)
    check('resources\\dist\\index.html', existsSync(join(dossier, 'resources', 'dist', 'index.html')))
    check('resources\\app.asar (la coquille)', existsSync(join(dossier, 'resources', 'app.asar')))
    const apk = join(dossier, 'resources', nomApk(version))
    if (sansApk) check(`pas d'APK (installeur d'essai) : ${nomApk(version)}`, !existsSync(apk))
    else check(`APK rangée : resources\\${nomApk(version)}`, existsSync(apk), existsSync(apk) ? `${statSync(apk).size} octets` : undefined)
    for (const r of raccourcis) check(`raccourci ${r}`, existsSync(r) && statSync(r).mtimeMs >= debutInstall - 2000)
    const entrees = entreesGtracker()
    check('une entrée « Gtracker » dans la liste des programmes (HKCU)', entrees.length === 1, entrees.join(', '))
    const cle = entrees[0]
    const v = cle ? valeurs(cle) ?? {} : {}
    check(`version ${semver} déclarée`, v.DisplayVersion === semver, v.DisplayVersion)
    check('éditeur déclaré', v.Publisher === 'Gtracker', v.Publisher)
    const guid = cle ? cle.split('\\').pop() : ''
    const cleEmplacement = `HKCU\\Software\\${guid}`
    // L'emplacement que relira une mise à jour est dans la clé propre au programme, pas dans l'entrée de la liste.
    const emplacement = valeurs(cleEmplacement)?.InstallLocation ?? ''
    check(`emplacement déclaré dans ${cleEmplacement} : le dossier choisi`, emplacement.toLowerCase() === dossier.toLowerCase(), emplacement)
    check("l'installeur n'a pas lancé le programme", !existsSync(profilEssai))
    check('installation par défaut non touchée', !existsSync(installationParDefaut))

    // 2. lancement
    await lancerInstalle(exe, profilEssai, dossier)

    // 3. réinstallation par-dessus, sans /D= : l'emplacement vient du registre, comme pour une mise à jour
    const temoinAncien = join(dossier, 'resources', 'temoin-ancienne-installation.txt')
    writeFileSync(temoinAncien, 'ancien\n')
    const mtimeAvant = statSync(exe).mtimeMs
    const r3 = executer(installeur, ['/S'], profilEssai)
    check('réinstallation par-dessus', r3.code === 0, `code ${r3.code}, ${r3.duree}`)
    check('même dossier, programme remplacé', existsSync(exe) && statSync(exe).mtimeMs >= mtimeAvant)
    check("fichiers de l'ancienne installation retirés", !existsSync(temoinAncien))
    check('toujours une seule entrée', entreesGtracker().length === 1)
    check('installation par défaut toujours non touchée', !existsSync(installationParDefaut))
    for (const r of raccourcis) check(`raccourci ${r} après réinstallation`, existsSync(r))
    await reinstallerParDessusOuvert(exe, profilEssai, dossier)
    check('toujours une seule entrée après la réinstallation par-dessus le programme ouvert', entreesGtracker().length === 1)

    // 4. désinstallation
    const desinstalleur = join(dossier, 'Uninstall Gtracker.exe')
    check('désinstalleur présent', existsSync(desinstalleur))
    const r4 = executer(desinstalleur, ['/S'], profilEssai)
    // Le désinstalleur de NSIS se recopie dans le dossier temporaire et rend la main aussitôt : on attend son effet.
    const parti = await attendre(() => !existsSync(exe) && entreesGtracker().length === 0, 90_000)
    installe = !parti
    check('désinstallation silencieuse', r4.code === 0 && parti, `code ${r4.code}`)
    await attendre(() => !existsSync(dossier), 15_000)
    check('dossier du programme effacé', !existsSync(dossier))
    check('entrée de désinstallation effacée', entreesGtracker().length === 0)
    check(`clé d'emplacement effacée`, !cleExiste(cleEmplacement))
    for (const r of raccourcis) check(`raccourci ${r} effacé`, !existsSync(r))
  } finally {
    if (installe) {
      // Une étape a cassé : on désinstalle quand même, pour rendre le poste comme on l'a trouvé.
      const desinstalleur = join(dossier, 'Uninstall Gtracker.exe')
      if (existsSync(desinstalleur)) executer(desinstalleur, ['/S'], profilEssai)
      await attendre(() => !existsSync(join(dossier, 'Gtracker.exe')) && entreesGtracker().length === 0, 90_000)
    }
    // 5. raccourcis d'origine remis, état comparé
    for (const o of origines) {
      if (!o) continue
      copyFileSync(o.copie, o.chemin)
      utimesSync(o.chemin, o.atime, o.mtime)
    }
    for (const [i, r] of raccourcis.entries()) {
      const o = origines[i]
      if (o) check(`raccourci d'origine remis : ${r}`, existsSync(r) && readFileSync(r).equals(readFileSync(o.copie)))
      else check(`pas de raccourci ${r}, comme au départ`, !existsSync(r))
    }
    check('vrai profil inchangé', releve(profilReel) === avant.profil, resume(avant.profil))
    check('Documents\\Gtracker inchangé', releve(documentsGtracker) === avant.documents, resume(avant.documents))
    check('mémoire témoin intacte', releve(memoireTemoin) === avant.memoire)
    check('aucune entrée « Gtracker » ni installation par défaut', entreesGtracker().length === 0 && !existsSync(installationParDefaut))
    rmSync(atelier, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
    check('dossier temporaire de l\'essai effacé', !existsSync(atelier), atelier)
  }
  console.log(echecs === 0 ? 'Essai réussi.' : `${echecs} échec(s).`)
  if (echecs > 0) process.exitCode = 1
}

principal().catch((e) => {
  console.error(`Essai de l'installeur : ${e.message}`)
  process.exitCode = 1
})
