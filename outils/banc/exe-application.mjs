// Banc de test : l'application du téléphone que le programme Windows emporte (carte « Application du téléphone » de
// Réglages › Mémoire, fenêtre de première ouverture du Profil), face à un faux téléphone (un dossier local qui s'écrit).
// Usage : node exe-application.mjs <Gtracker.exe> [<port de débogage>]
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille
// (`GTRACKER_BANC=1`), sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le
// profil du vrai programme, jamais un vrai téléphone (en mode d'essai le vrai adb n'est jamais lancé). Variables d'essai de
// l'application (`bureau/applicationTelephone.ts`) : `GTRACKER_APK` (l'APK proposée ; fichier absent : pas d'application),
// `GTRACKER_BANC_APK_DESTINATION` (chemin écrit par « Enregistrer l'APK… » à la place de la fenêtre de Windows ; vide :
// l'utilisateur renonce), `GTRACKER_BANC_APPLICATION_REFUS` (raison de refus imposée au téléphone d'essai : versionPlusRecente,
// signature, usbCoupee, memoirePleine, autre) ; l'état du téléphone vient de `GTRACKER_BANC_TELEPHONE_ETAT`. Une installation
// réussie copie l'APK dans `<GTRACKER_BANC_TELEPHONE>/applications-installees/`. Le faux fichier s'appelle
// `Gtracker-<version de package.json>.apk`, comme celui que le programme emporte ; le disque se lit par Node : c'est lui qui
// prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG : la carte, la fenêtre de première ouverture.
// Cas (un programme par cas) :
//  a. sans APK (fichier d'essai absent) : la carte dit « Ce programme n'a pas l'application du téléphone. », sans aide ni
//     bouton, et la fenêtre de première ouverture ne s'ouvre pas ;
//  b. la carte avec l'APK : titre, « Gtracker {version} pour Android, la même version que ce programme. » (version de
//     package.json), aide, deux boutons ; « Enregistrer l'APK… » dit « APK enregistrée : » et le chemin, le fichier écrit est
//     l'APK octet pour octet, sans temporaire ; un fichier déjà là est remplacé ; renoncement (destination vide) : rien
//     n'est écrit, rien n'est dit ;
//  c. « Installer par le câble » : « Application installée sur Téléphone d'essai. », l'APK copiée sur le téléphone factice
//     (octets identiques), rien d'autre n'y change ;
//  d. chaque refus imposé (cinq raisons) : « Le téléphone a refusé l'installation : … », rien copié ;
//  e. chaque état du téléphone (absent, autorisation, horsLigne, adbIntrouvable, occupe) : la phrase, rien copié ;
//  f. fenêtre de première ouverture sur le Profil : textes et boutons ; « Plus tard » la ferme et la retient (fichier du
//     profil), elle ne revient ni dans la même instance ni après relance du programme sur le même profil ; la croix, et
//     chacun des deux boutons de la fenêtre, la retiennent de même ; « Fermer » remplace « Plus tard » après un geste
//     réussi ; une version retenue plus ancienne : la fenêtre revient ;
//  g. dans tous les cas, la console de la page sans erreur.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, FORMATS } from './lib/cdp.mjs';

const [exe, portArg] = process.argv.slice(2);
if (!exe) {
  console.error('Usage : node exe-application.mjs <Gtracker.exe> [<port>]');
  process.exit(1);
}
const PORT = Number(portArg ?? 9498);
const ORIGINE = 'https://gtracker.localhost';
const CAPTURES = process.env.BANC_CAPTURES || null;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `);
const disparu = async (pid, ms) => { for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200); } return !vivant(pid); };

let echecs = 0;
let controles = 0;
const check = (quoi, ok, detail) => { controles++; console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) echecs++; };

const DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSION = JSON.parse(readFileSync(join(DEPOT, 'package.json'), 'utf8')).version;
const NOM_APK = `Gtracker-${VERSION}.apk`;
const NOM_TEL = "Téléphone d'essai";

const RACINE = mkdtempSync(join(tmpdir(), 'gtk-app-'));
const dossier = (nom) => { const d = join(RACINE, nom); mkdirSync(d, { recursive: true }); return d; };
/** Tous les fichiers sous `racine`, chemins relatifs en `/` (triés). */
const arbre = (racine) => {
  if (!existsSync(racine)) return null;
  const sortie = [];
  const voir = (d, prefixe) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { sortie.push(`${prefixe}${e.name}/`); voir(join(d, e.name), `${prefixe}${e.name}/`); } else sortie.push(`${prefixe}${e.name}`);
    }
  };
  voir(racine, '');
  return sortie.sort();
};
/** Arbre avec la taille et l'heure de chaque fichier : change si quoi que ce soit est écrit. */
const empreinte = (racine) => (arbre(racine) ?? []).map((c) => (c.endsWith('/') ? c : `${c}:${statSync(join(racine, c)).size}:${statSync(join(racine, c)).mtimeMs}`)).join('|');

// Le faux APK : des octets quelconques (300 Kio), nommé comme celui du programme.
const DOSSIER_APK = dossier('apk');
const APK = join(DOSSIER_APK, NOM_APK);
const OCTETS = randomBytes(300 * 1024);
writeFileSync(APK, OCTETS);
const APK_ABSENTE = join(DOSSIER_APK, 'absente', NOM_APK);
const memeOctets = (fichier) => existsSync(fichier) && readFileSync(fichier).equals(OCTETS);

const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  // Les variables d'essai du téléphone, du sans-fil et de l'application ne viennent jamais de l'environnement du poste.
  for (const cle of Object.keys(complet)) if ((/^GTRACKER_BANC_(SANSFIL|TELEPHONE|APK|APPLICATION)/.test(cle) || cle === 'GTRACKER_APK') && !(cle in env)) delete complet[cle];
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, '--lang=fr-FR', '--force-device-scale-factor=1', '--hide-scrollbars'], { env: complet, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  lances.add(child.pid);
  const journal = [];
  const lire = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) journal.push(l.trim()); };
  child.stdout.on('data', lire);
  child.stderr.on('data', lire);
  let ws = null;
  for (let k = 0; k < 100 && !ws; k++) {
    await pause(300);
    try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? null; } catch { /* pas prêt */ }
  }
  if (!ws) { spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true }); throw new Error('le programme ne répond pas'); }
  process.env.BANC_WS = ws;
  const b = await connect({ port: PORT, base: ORIGINE, width: 1400, height: 1000 });
  await b.blockNetwork();
  return { child, journal, b };
}
/** Ferme le programme comme la croix (sans brouillon), sinon de force ; attend sa disparition. */
async function fermer(p) {
  try { await p.b.close(); } catch { /* page déjà fermée */ }
  spawnSync('taskkill', ['/PID', String(p.child.pid)], { stdio: 'ignore', windowsHide: true });
  if (!(await disparu(p.child.pid, 6000))) {
    console.log('(fermeture demandée sans effet : processus tué)');
    spawnSync('taskkill', ['/T', '/F', '/PID', String(p.child.pid)], { stdio: 'ignore', windowsHide: true });
    await disparu(p.child.pid, 5000);
  }
  await pause(500);
}
/** Lance, joue `essai`, ferme toujours (même sur erreur). Vérifie la console de la page à la fin. */
async function avecProgramme(profil, memoire, env, quoi, essai) {
  let p = null;
  try {
    p = await lancer(profil, memoire, env);
    const r = await essai(p.b, p);
    check(`${quoi} : console de la page sans erreur`, p.b.logs.length === 0, p.b.logs.join(' | '));
    return r;
  } catch (e) {
    check(`${quoi} : essai interrompu : ${e.stack ?? e.message}`, false);
    return null;
  } finally {
    if (p) await fermer(p);
  }
}
/** Mémoire du PC prête d'avance (marqueur seul) : la page n'a pas à la choisir. */
const MARQUEUR = `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`;
const fabriquerMemoire = (nom) => { const m = dossier(`${nom}-memoire`); writeFileSync(join(m, 'gtracker.json'), MARQUEUR); return m; };
/** Le téléphone factice : un stockage vide qui joue le `/sdcard`. */
const fabriquerTelephone = (nom) => { const s = dossier(`${nom}-tel`); mkdirSync(join(s, 'Documents', 'Gtracker'), { recursive: true }); writeFileSync(join(s, 'Documents', 'Gtracker', 'gtracker.json'), MARQUEUR); return s; };
const installees = (tel) => arbre(join(tel, 'applications-installees')) ?? [];

/** Capture JPEG de la page, 900 px de large au plus. */
async function capturer(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1400, height: 1000, scale: 0.64 } });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(r.result.data, 'base64'));
}

// ---------- la carte de Réglages › Mémoire ----------
/** Réglages › Mémoire ouverte, carte de l'application présente et son état lu (une phrase sous le titre). */
async function ouvrirCarte(b) {
  await b.go('/parametres', 5000);
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 8000, label: 'carte Mémoire' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.phone-app'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire')`);
  }
  await b.waitFor(`Boolean(document.querySelector('.phone-app p'))`, { timeout: 8000, label: 'carte « Application du téléphone » lue' });
  await b.settle({ max: 1500 });
}
/** Ce que la carte dit : titre, phrases, aide, boutons, dernier résultat. */
const carte = (b) => b.evaluate(`(() => {
  const c = document.querySelector('.phone-app');
  if (!c) return null;
  return {
    titre: c.querySelector('.phone-app__title')?.textContent.trim() ?? null,
    phrases: [...c.querySelectorAll('p')].map((p) => p.textContent.trim()),
    boutons: [...c.querySelectorAll('button:not([aria-expanded])')].map((x) => x.textContent.trim()),
    resultat: c.querySelector('.phone-app__outcome')?.textContent.trim() ?? null,
    texte: c.innerText,
  };
})()`);
const PHRASE_VERSION = `Gtracker ${VERSION} pour Android, la même version que ce programme.`;
const PHRASE_SANS = "Ce programme n'a pas l'application du téléphone.";
const PHRASE_AIDE = "Copiez le fichier sur le téléphone et ouvrez-le ; Android demandera d'autoriser cette source. Par le câble, le débogage USB doit être activé.";
/** Clique un bouton de la carte et attend le résultat (nouveau ou changé), rendu ; `null` si rien ne vient (renoncement). */
async function cliquerCarte(b, bouton, { attendre = true } = {}) {
  const avant = (await carte(b))?.resultat ?? null;
  check(`clic « ${bouton} »`, (await b.clickText(bouton, '.phone-app button')) === 'ok');
  if (!attendre) { await b.wait(1500); return (await carte(b))?.resultat ?? null; }
  await b.waitFor(`(() => { const o = document.querySelector('.phone-app__outcome')?.textContent.trim() ?? null; return o !== null && o !== ${JSON.stringify(avant)}; })()`, { timeout: 15000, label: `résultat de « ${bouton} »` });
  return (await carte(b)).resultat;
}

// ---------- la fenêtre de première ouverture ----------
const FENETRE = '[role=dialog].phone-app-offer';
const fenetre = (b) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(FENETRE)});
  if (!d) return null;
  return {
    titre: d.getAttribute('aria-label'),
    phrases: [...d.querySelectorAll('p')].map((p) => p.textContent.trim()),
    boutons: [...d.querySelectorAll('button')].map((x) => x.textContent.trim()),
    resultat: d.querySelector('.phone-app__outcome')?.textContent.trim() ?? null,
  };
})()`);
/** Ouvre le Profil et attend la fenêtre (rendue, ou `null` si elle ne vient pas dans le délai). */
async function ouvrirProfil(b, { attendue }) {
  await b.go('/profil', 5000);
  if (attendue) await b.waitFor(`Boolean(document.querySelector(${JSON.stringify(FENETRE)}))`, { timeout: 12000, label: 'fenêtre de première ouverture' });
  else { await b.wait(2500); await b.settle({ max: 1500 }); }
  return fenetre(b);
}
const PHRASE_OFFRE = "Ce programme contient l'application Android de la même version.";
/** Version retenue par la coquille (fichier du profil), `null` sans fichier. */
const retenue = (profil) => { try { return JSON.parse(readFileSync(join(profil, 'application-proposee.json'), 'utf8')).version ?? null; } catch { return null; } };
const attendreRetenue = async (b, profil) => { await b.waitFor(() => retenue(profil) !== null, { timeout: 6000, label: 'proposition retenue' }); return retenue(profil); };

try {
  // ---------- a. sans APK ----------
  console.log('\n== a. Sans APK : la carte le dit, aucun bouton, pas de fenêtre de première ouverture');
  {
    const profil = dossier('a-profil');
    const memoire = fabriquerMemoire('a');
    const tel = fabriquerTelephone('a');
    await avecProgramme(profil, memoire, { GTRACKER_APK: APK_ABSENTE, GTRACKER_BANC_TELEPHONE: tel }, 'a', async (b) => {
      await ouvrirCarte(b);
      const c = await carte(b);
      console.log(`  carte : ${JSON.stringify(c.texte)}`);
      check('a. le titre est « Application du téléphone »', c.titre === 'Application du téléphone', c.titre);
      check(`a. la carte dit « ${PHRASE_SANS} »`, c.phrases.length === 1 && c.phrases[0] === PHRASE_SANS, JSON.stringify(c.phrases));
      check('a. aucun bouton (ni « Enregistrer l\'APK… », ni « Installer par le câble ») et pas d\'aide', c.boutons.length === 0 && !c.phrases.includes(PHRASE_AIDE), JSON.stringify(c.boutons));
      check('a. aucun « ? » d\'aide sur la carte', await b.evaluate(`!document.querySelector('.phone-app [aria-label="Aide"], .phone-app .help-toggle, .phone-app [aria-expanded]')`));
      await capturer(b, 'application-sans-apk');
      const f = await ouvrirProfil(b, { attendue: false });
      check('a. le Profil ne propose pas l\'application (pas de fenêtre)', f === null, JSON.stringify(f));
    });
    check('a. rien n\'est retenu dans le profil (rien n\'a été proposé)', retenue(profil) === null, String(retenue(profil)));
    check('a. rien n\'est copié sur le téléphone factice', installees(tel).length === 0, installees(tel).join(','));
  }

  // ---------- b, c. la carte avec l'APK : enregistrer, renoncer, installer ----------
  console.log('\n== b, c. La carte avec l\'APK : enregistrer, remplacer, renoncer, installer par le câble');
  {
    const profil = dossier('b-profil');
    const memoire = fabriquerMemoire('b');
    const tel = fabriquerTelephone('b');
    const sortie = dossier('b-sortie');
    const destination = join(sortie, 'Mon-application.apk');
    const avantDocs = empreinte(join(tel, 'Documents'));
    await avecProgramme(profil, memoire, { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_APK_DESTINATION: destination }, 'b', async (b, p) => {
      await ouvrirCarte(b);
      let c = await carte(b);
      console.log(`  carte : ${JSON.stringify(c.texte)}`);
      check('b. le titre est « Application du téléphone »', c.titre === 'Application du téléphone', c.titre);
      check(`b. la carte dit « ${PHRASE_VERSION} » (version de package.json : ${VERSION})`, c.phrases.includes(PHRASE_VERSION), JSON.stringify(c.phrases));
      check('b. les deux boutons : « Enregistrer l\'APK… » et « Installer par le câble »', JSON.stringify(c.boutons) === JSON.stringify(["Enregistrer l'APK…", 'Installer par le câble']), JSON.stringify(c.boutons));
      check('b. aucun résultat affiché avant un geste', c.resultat === null, c.resultat);
      // L'aide « ? » : dépliée, elle dit comment copier le fichier.
      const aide = await b.evaluate(`(() => { const t = document.querySelector('.phone-app [aria-expanded]'); if (!t) return 'absent'; t.click(); return 'ok'; })()`);
      await b.wait(400);
      c = await carte(b);
      console.log(`  aide : ${aide} ; phrases : ${JSON.stringify(c.phrases)}`);
      check('b. l\'aide « ? » est là et, dépliée, dit de copier le fichier et d\'activer le débogage USB', aide === 'ok' && c.phrases.includes(PHRASE_AIDE), JSON.stringify([aide, c.phrases]));
      await capturer(b, 'application-carte');

      // Enregistrer : le fichier est écrit, octet pour octet.
      let r = await cliquerCarte(b, "Enregistrer l'APK…");
      console.log(`  enregistrement : ${r}`);
      check(`b. « APK enregistrée : » suivie du chemin choisi (${destination})`, r === `APK enregistrée : ${destination}`, r);
      check('b. le fichier écrit est l\'APK, octet pour octet', memeOctets(destination), existsSync(destination) ? String(statSync(destination).size) : 'absent');
      check('b. rien d\'autre dans le dossier de destination (aucun temporaire)', JSON.stringify(arbre(sortie)) === JSON.stringify(['Mon-application.apk']), JSON.stringify(arbre(sortie)));
      check('b. l\'APK du programme n\'a pas bougé', memeOctets(APK));
      check('b. le journal de la coquille note l\'enregistrement', p.journal.some((l) => /APK enregistrée/.test(l) || /enregistrement de .*apk/i.test(l)), p.journal.slice(-4).join(' | '));
      // Un fichier déjà là, autre, est remplacé.
      writeFileSync(destination, 'ancien contenu');
      r = await cliquerCarte(b, "Enregistrer l'APK…");
      check('b. un fichier déjà là est remplacé par l\'APK (octets identiques)', r === `APK enregistrée : ${destination}` && memeOctets(destination), r);
      check('b. toujours aucun temporaire à côté', JSON.stringify(arbre(sortie)) === JSON.stringify(['Mon-application.apk']), JSON.stringify(arbre(sortie)));

      // Installer par le câble : copie sur le téléphone factice.
      check('c. avant l\'installation, rien dans applications-installees', installees(tel).length === 0);
      r = await cliquerCarte(b, 'Installer par le câble');
      console.log(`  installation : ${r}`);
      check(`c. « Application installée sur ${NOM_TEL}. »`, r === `Application installée sur ${NOM_TEL}.`, r);
      check(`c. l'APK est copiée dans applications-installees/ du téléphone, sous son nom (${NOM_APK}), octets identiques`, JSON.stringify(installees(tel)) === JSON.stringify([NOM_APK]) && memeOctets(join(tel, 'applications-installees', NOM_APK)), JSON.stringify(installees(tel)));
      check('c. rien d\'autre n\'a changé sur le téléphone factice (Documents/Gtracker : fichiers, tailles et dates)', empreinte(join(tel, 'Documents')) === avantDocs, `${avantDocs} / ${empreinte(join(tel, 'Documents'))}`);
      check('c. rien n\'est retenu dans le profil par les gestes de la carte (la proposition ne vient que de la fenêtre du Profil)', retenue(profil) === null, String(retenue(profil)));
    });
    check('b. le faux APK de départ reste intact après le programme', memeOctets(APK));

    // Renoncement : destination vide.
    const sortie2 = dossier('b-sortie-vide');
    await avecProgramme(dossier('b2-profil'), memoire, { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_APK_DESTINATION: '' }, 'b, renoncement', async (b, p) => {
      await ouvrirCarte(b);
      const avant = [empreinte(tel), empreinte(DOSSIER_APK), empreinte(sortie), empreinte(sortie2)].join('#');
      const r = await cliquerCarte(b, "Enregistrer l'APK…", { attendre: false });
      check('b. renoncement (destination vide) : aucun résultat affiché', r === null, r);
      check('b. renoncement : rien n\'est écrit (téléphone factice, dossier de l\'APK et dossiers de sortie inchangés)', [empreinte(tel), empreinte(DOSSIER_APK), empreinte(sortie), empreinte(sortie2)].join('#') === avant, '');
      check('b. renoncement : le bouton est de nouveau disponible', (await carte(b)).boutons.length === 2 && await b.evaluate(`[...document.querySelectorAll('.phone-app button')].every((x) => !x.disabled)`));
      check('b. renoncement : le journal de la coquille dit « renoncé »', p.journal.some((l) => /renoncé/.test(l)), p.journal.slice(-3).join(' | '));
      check('b. renoncement : le dossier de sortie est vide', (arbre(sortie2) ?? []).length === 0);
    });
  }

  // ---------- d. les refus de l'installation ----------
  console.log('\n== d. Installation refusée par le téléphone : chaque raison');
  const REFUS = [
    ['versionPlusRecente', 'une version plus récente y est déjà'],
    ['signature', "l'application installée n'a pas la même signature"],
    ['usbCoupee', "l'installation par USB est coupée dans les options pour les développeurs"],
    ['memoirePleine', 'mémoire pleine'],
    ['autre', "Refus d'essai : autre"],
  ];
  for (const [raison, fin] of REFUS) {
    const tel = fabriquerTelephone(`d-${raison}`);
    await avecProgramme(dossier(`d-${raison}-profil`), fabriquerMemoire(`d-${raison}`), { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_APPLICATION_REFUS: raison }, `d. ${raison}`, async (b) => {
      await ouvrirCarte(b);
      const r = await cliquerCarte(b, 'Installer par le câble');
      console.log(`  ${raison} : ${r}`);
      check(`d. ${raison} : « Le téléphone a refusé l'installation : ${fin}. »`, r === `Le téléphone a refusé l'installation : ${fin}.`, r);
      check(`d. ${raison} : le résultat est en alerte (pas en succès)`, await b.evaluate(`document.querySelector('.phone-app__outcome')?.classList.contains('ui-danger-text') === true`));
      check(`d. ${raison} : rien n'est copié sur le téléphone`, installees(tel).length === 0, installees(tel).join(','));
      if (raison === 'versionPlusRecente') await capturer(b, 'application-refus');
    });
  }

  // ---------- e. les états du téléphone ----------
  console.log('\n== e. État du téléphone imposé : la phrase de chacun');
  const ETATS = [
    ['absent', 'Aucun téléphone branché.'],
    ['autorisation', "Acceptez cet ordinateur sur l'écran du téléphone, puis réessayez."],
    ['horsLigne', 'Le téléphone ne répond pas : débranchez-le et rebranchez-le.'],
    ['adbIntrouvable', "L'outil du débogage USB n'est pas sur ce PC : enregistrez l'APK et copiez-la sur le téléphone."],
    ['occupe', 'Un autre programme tient la liaison avec le téléphone : fermez-le et réessayez.'],
  ];
  for (const [etat, phrase] of ETATS) {
    const tel = fabriquerTelephone(`e-${etat}`);
    await avecProgramme(dossier(`e-${etat}-profil`), fabriquerMemoire(`e-${etat}`), { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_ETAT: etat }, `e. ${etat}`, async (b) => {
      await ouvrirCarte(b);
      const r = await cliquerCarte(b, 'Installer par le câble');
      console.log(`  ${etat} : ${r}`);
      check(`e. ${etat} : « ${phrase} »`, r === phrase, r);
      check(`e. ${etat} : rien n'est copié sur le téléphone`, installees(tel).length === 0, installees(tel).join(','));
      check(`e. ${etat} : « Enregistrer l'APK… » reste offert`, (await carte(b)).boutons.includes("Enregistrer l'APK…"));
    });
  }

  // ---------- f. la fenêtre de première ouverture ----------
  console.log('\n== f. Fenêtre de première ouverture sur le Profil : vue une fois par version');
  // f1 : « Plus tard », puis la même instance, puis une relance du programme sur le même profil.
  {
    const profil = dossier('f1-profil');
    const memoire = fabriquerMemoire('f1');
    const tel = fabriquerTelephone('f1');
    const env = { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel };
    await avecProgramme(profil, memoire, env, 'f1', async (b) => {
      let f = await ouvrirProfil(b, { attendue: true });
      console.log(`  fenêtre : ${JSON.stringify(f)}`);
      check('f1. la fenêtre s\'appelle « Application du téléphone »', f?.titre === 'Application du téléphone', f?.titre);
      check(`f1. elle dit « ${PHRASE_OFFRE} »`, f?.phrases.includes(PHRASE_OFFRE), JSON.stringify(f?.phrases));
      check('f1. ses boutons : « Plus tard », « Installer par le câble », « Enregistrer l\'APK… » (et la croix)', JSON.stringify((f?.boutons ?? []).filter((x) => x !== '×')) === JSON.stringify(['Plus tard', 'Installer par le câble', "Enregistrer l'APK…"]), JSON.stringify(f?.boutons));
      check('f1. aucun résultat affiché avant un geste', f?.resultat === null, f?.resultat);
      await capturer(b, 'application-premiere-ouverture');
      check('f1. clic « Plus tard »', (await b.clickText('Plus tard', `${FENETRE} button`)) === 'ok');
      await b.wait(500);
      check('f1. la fenêtre est fermée', (await fenetre(b)) === null);
      check(`f1. la coquille retient la version proposée (${VERSION}) dans le profil`, (await attendreRetenue(b, profil)) === VERSION, String(retenue(profil)));
      // La même instance : ni en revenant sur le Profil, ni après un tour par une autre page.
      f = await ouvrirProfil(b, { attendue: false });
      check('f1. revenir sur le Profil dans la même instance : pas de fenêtre', f === null, JSON.stringify(f));
      await b.go('/sessions', 4000);
      f = await ouvrirProfil(b, { attendue: false });
      check('f1. après un tour par Sessions : toujours pas de fenêtre', f === null, JSON.stringify(f));
    });
    await avecProgramme(profil, memoire, env, 'f1, relance', async (b) => {
      const f = await ouvrirProfil(b, { attendue: false });
      check('f1. relance du programme sur le même profil : pas de fenêtre', f === null, JSON.stringify(f));
      await ouvrirCarte(b);
      check('f1. la carte de Réglages › Mémoire reste là, avec ses deux boutons', JSON.stringify((await carte(b)).boutons) === JSON.stringify(["Enregistrer l'APK…", 'Installer par le câble']));
    });
    // Une version retenue plus ancienne : la fenêtre revient pour la nouvelle.
    writeFileSync(join(profil, 'application-proposee.json'), JSON.stringify({ version: '0.00.01' }));
    await avecProgramme(profil, memoire, env, 'f1, version plus récente', async (b) => {
      const f = await ouvrirProfil(b, { attendue: true });
      check('f1. la version retenue est plus ancienne : la fenêtre revient', f !== null && f.phrases.includes(PHRASE_OFFRE), JSON.stringify(f));
      await b.clickText('Plus tard', `${FENETRE} button`);
      await b.waitFor(() => retenue(profil) === VERSION, { timeout: 6000, label: 'nouvelle version retenue' });
      check('f1. « Plus tard » remplace l\'ancienne version retenue par la nouvelle', retenue(profil) === VERSION, String(retenue(profil)));
    });
  }
  // f2 : « Enregistrer l'APK… » dans la fenêtre.
  {
    const profil = dossier('f2-profil');
    const memoire = fabriquerMemoire('f2');
    const tel = fabriquerTelephone('f2');
    const sortie = dossier('f2-sortie');
    const destination = join(sortie, 'depuis-la-fenetre.apk');
    const env = { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_APK_DESTINATION: destination };
    await avecProgramme(profil, memoire, env, 'f2', async (b) => {
      await ouvrirProfil(b, { attendue: true });
      check('f2. clic « Enregistrer l\'APK… » dans la fenêtre', (await b.clickText("Enregistrer l'APK…", `${FENETRE} button`)) === 'ok');
      await b.waitFor(`/APK enregistrée/.test(document.querySelector(${JSON.stringify(FENETRE)})?.innerText ?? '')`, { timeout: 15000, label: 'résultat dans la fenêtre' });
      const f = await fenetre(b);
      console.log(`  fenêtre : ${JSON.stringify(f)}`);
      check('f2. la fenêtre dit « APK enregistrée : » et le chemin', f?.resultat === `APK enregistrée : ${destination}`, f?.resultat);
      check('f2. le fichier écrit est l\'APK, octet pour octet', memeOctets(destination));
      check('f2. « Plus tard » est devenu « Fermer »', (f?.boutons ?? []).includes('Fermer') && !(f?.boutons ?? []).includes('Plus tard'), JSON.stringify(f?.boutons));
      check('f2. la proposition est retenue dès le geste', (await attendreRetenue(b, profil)) === VERSION, String(retenue(profil)));
      check('f2. clic « Fermer »', (await b.clickText('Fermer', `${FENETRE} button`)) === 'ok');
      await b.wait(400);
      check('f2. la fenêtre est fermée', (await fenetre(b)) === null);
    });
    await avecProgramme(profil, memoire, env, 'f2, relance', async (b) => {
      check('f2. relance : pas de fenêtre', (await ouvrirProfil(b, { attendue: false })) === null);
    });
  }
  // f3 : « Installer par le câble » dans la fenêtre.
  {
    const profil = dossier('f3-profil');
    const memoire = fabriquerMemoire('f3');
    const tel = fabriquerTelephone('f3');
    const env = { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel };
    await avecProgramme(profil, memoire, env, 'f3', async (b) => {
      await ouvrirProfil(b, { attendue: true });
      check('f3. clic « Installer par le câble » dans la fenêtre', (await b.clickText('Installer par le câble', `${FENETRE} button`)) === 'ok');
      await b.waitFor(`/Application installée/.test(document.querySelector(${JSON.stringify(FENETRE)})?.innerText ?? '')`, { timeout: 15000, label: 'résultat dans la fenêtre' });
      const f = await fenetre(b);
      check(`f3. la fenêtre dit « Application installée sur ${NOM_TEL}. »`, f?.resultat === `Application installée sur ${NOM_TEL}.`, f?.resultat);
      check('f3. l\'APK est sur le téléphone factice, octets identiques', JSON.stringify(installees(tel)) === JSON.stringify([NOM_APK]) && memeOctets(join(tel, 'applications-installees', NOM_APK)), JSON.stringify(installees(tel)));
      check('f3. la proposition est retenue', (await attendreRetenue(b, profil)) === VERSION);
      check('f3. « Fermer » remplace « Plus tard »', (f?.boutons ?? []).includes('Fermer') && !(f?.boutons ?? []).includes('Plus tard'), JSON.stringify(f?.boutons));
    });
    await avecProgramme(profil, memoire, env, 'f3, relance', async (b) => {
      check('f3. relance : pas de fenêtre', (await ouvrirProfil(b, { attendue: false })) === null);
    });
  }
  // f4 : la croix ; f5 : « Enregistrer l'APK… » auquel l'utilisateur renonce (la fenêtre reste, la proposition est retenue).
  for (const [cas, geste] of [['f4', 'croix'], ['f5', 'renoncement']]) {
    const profil = dossier(`${cas}-profil`);
    const memoire = fabriquerMemoire(cas);
    const tel = fabriquerTelephone(cas);
    const env = { GTRACKER_APK: APK, GTRACKER_BANC_TELEPHONE: tel };
    await avecProgramme(profil, memoire, env, cas, async (b) => {
      await ouvrirProfil(b, { attendue: true });
      if (geste === 'croix') {
        check(`${cas}. clic sur la croix`, (await b.click(`document.querySelector(${JSON.stringify(`${FENETRE} .ui-dialog__close`)})`)) === 'ok');
        await b.wait(400);
        check(`${cas}. la fenêtre est fermée`, (await fenetre(b)) === null);
      } else {
        check(`${cas}. clic « Enregistrer l'APK… » (destination vide : l'utilisateur renonce)`, (await b.clickText("Enregistrer l'APK…", `${FENETRE} button`)) === 'ok');
        await b.wait(1500);
        const f = await fenetre(b);
        check(`${cas}. la fenêtre reste ouverte, sans résultat, avec « Plus tard »`, f !== null && f.resultat === null && f.boutons.includes('Plus tard'), JSON.stringify(f));
      }
      check(`${cas}. la proposition est retenue`, (await attendreRetenue(b, profil)) === VERSION, String(retenue(profil)));
    });
    await avecProgramme(profil, memoire, env, `${cas}, relance`, async (b) => {
      check(`${cas}. relance : pas de fenêtre`, (await ouvrirProfil(b, { attendue: false })) === null);
    });
  }
} catch (e) {
  check(`script interrompu : ${e.stack ?? e.message}`, false);
} finally {
  // Un programme resté ouvert par une erreur : seuls ceux que ce script a lancés sont tués.
  for (const pid of lances) if (vivant(pid)) spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  await pause(800);
  rmSync(RACINE, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
}

console.log(echecs === 0 ? `\nTout passe (${controles} contrôles).` : `\n${echecs} échec(s) sur ${controles} contrôles.`);
process.exit(echecs === 0 ? 0 : 1);
