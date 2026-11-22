// Banc de test : le bouton « Synchroniser » du programme Windows, face à un faux téléphone (un dossier local qui s'écrit).
// Usage : node exe-synchroniser.mjs <Gtracker.exe> [<port de débogage>] [--sansfil]
// `--sansfil` rejoue les cas c (qui couvre c, d, e, f), r et rg avec les mêmes contrôles, mais le téléphone est le faux
// téléphone de la liaison sans câble (`bureau/fauxTelephone.ts`, à jour : il écrit et efface), relié au programme par le
// Wi-Fi (127.0.0.1, port fixe, code lu sur la page) au lieu du dossier-téléphone du câble : le même moteur de synchronisation
// sert les deux canaux. Les cas a, b, g, h, m, k et i parlent du câble (états de adb, coupure par opérations) et ne se rejouent pas.
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille (`GTRACKER_BANC=1`),
// sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le profil du vrai
// programme, jamais un vrai téléphone (en mode d'essai le vrai adb n'est jamais lancé). Le téléphone factice est un dossier
// qui joue le `/sdcard` (`GTRACKER_BANC_TELEPHONE`), lu et écrit comme par le câble ; l'état imposé
// (`GTRACKER_BANC_TELEPHONE_ETAT`) et la coupure après n opérations (`GTRACKER_BANC_TELEPHONE_COUPURE`) se règlent par
// l'environnement. Les copies de sécurité vont sous `GTRACKER_DOCUMENTS` (un dossier du profil d'essai). Les sessions sont
// synthétiques (`lib/traces.mjs`) et passent d'abord par le programme, qui écrit leurs vraies fiches ; le disque se lit par
// Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG de la fenêtre : compte rendu, garde-fou, question.
// Cas :
//  a. chaque état imposé (absent, autorisation, horsLigne, adbIntrouvable, occupe) : texte du message en entier,
//     « Réessayer » offert, dossier donné pour adbIntrouvable, rien de rangé, rien de copié, téléphone intact ;
//  b. téléphone sans dossier Documents/Gtracker : le message du dossier absent ;
//  c. première synchronisation : le téléphone a quatre sessions, l'ordinateur cinq dont une commune ; chaque appareil reçoit
//     ce qui lui manque, rien n'est supprimé, la copie de sécurité des deux appareils (dossier `Gtracker-copies` de
//     Documents) porte l'état d'avant ; identifiants posés, base écrite ; le sans-fil et les fichiers de réglages, de lieux
//     et d'itinéraires du téléphone ne sont ni copiés ni changés ;
//  d. second clic : « Les deux appareils sont à jour. », rien ne change, pas de seconde copie de sécurité ;
//  e. une session supprimée sur le téléphone : à la corbeille de l'ordinateur (version 2 de l'index, origine « telephone »),
//     ses fichiers dans le sous-dossier de l'entrée ;
//  f. une session supprimée sur l'ordinateur : retirée du téléphone, restée à la corbeille de l'ordinateur ; puis restaurée
//     par Réglages › Mémoire, elle revient sur le téléphone à la synchronisation suivante ;
//     (c : le marqueur du téléphone porte aussi un champ `synchro`, un instant, les autres champs gardés ; d : inchangé quand
//     rien n'a changé sur le téléphone ; f : plus récent après un retrait) ;
//  g. sessions déjà à la corbeille de l'ordinateur et encore sur le téléphone à la première synchronisation : la question
//     de la corbeille, « Les laisser » (rien ne bouge, la question revient) puis « Retirer du téléphone » ; une seule session :
//     « La laisser » au singulier ; la corbeille ne tient qu'une entrée (origine « ordinateur ») par session retirée quand
//     ses fichiers sont identiques sur le téléphone (« Corbeille : 2 sessions » pour 2 retirées), deux entrées quand la fiche
//     a changé sur le téléphone (g4) ;
//  h. garde-fou : onze sessions supprimées sur le téléphone, la question et ses trois boutons (« Annuler »,
//     « Synchroniser sans rien supprimer », « Supprimer ces 11 sessions »), chacun joué ;
//  m. une confirmation ne vaut que pour les sessions montrées : question sur 10 sessions, puis une onzième supprimée sur le
//     téléphone, soit fenêtre fermée par la croix et rouverte (m1 : elle redit la question en attente, sur 10), soit fenêtre
//     laissée ouverte (m2) ; la confirmation cliquée sur la liste périmée ramène la question sur 11, rien n'est supprimé sur
//     la foi de l'ancienne liste, puis « Supprimer ces 11 sessions » met onze entrées à la corbeille ;
//  i. coupure : dans la copie de sécurité (rien n'est synchronisé ; la reprise en fait une nouvelle, l'incomplète est
//     gardée), juste après elle (12 : coupure précoce, la reprise ne refait pas de copie, un seul dossier daté, et le compte
//     rendu le redonne), puis en pleine synchronisation, deux fois ; relancé sans coupure, le tout est fini, rien n'est rangé
//     à moitié, aucun temporaire des deux côtés ;
//  r. itinéraires (fiches de `planning/routeRecord.ts` dans `itineraires/`, des deux côtés) : première synchronisation (trois
//     copiés vers le téléphone, deux vers l'ordinateur, un commun, rien de supprimé, la copie de sécurité garde l'état d'avant),
//     second clic, modifié sur le téléphone puis sur l'ordinateur (« 1 itinéraire modifié recopié. », octets identiques),
//     supprimé sur le téléphone (corbeille de l'ordinateur), supprimé sur l'ordinateur par la page Itinéraires (retiré du
//     téléphone) puis par Node sans corbeille (copie du téléphone rangée à part, origine « telephone »), modifié des deux côtés
//     (le plus récent gagne, l'autre à la corbeille) ; le GPX seul du téléphone (sans fiche) et ses lieux ne bougent jamais ;
//  rg. garde-fou commun : une session et quatre itinéraires supprimés sur le téléphone, une seule fenêtre (« … retirerait
//     1 session et 4 itinéraires. »), ses trois boutons, chacun joué ;
//  j. dans tous les cas, la console de la page sans erreur.
// `BANC_CAS=c,g,m,i` (facultatif) ne joue que ces cas (a, b, c pour c à f, g, h, m, k, r, rg, i) ; sans lui, tous.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, FORMATS } from './lib/cdp.mjs';
import { actionLigne } from './lib/sessions.mjs';
import { traceDroite } from './lib/traces.mjs';

const [exe, portArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!exe) {
  console.error('Usage : node exe-synchroniser.mjs <Gtracker.exe> [<port>] [--sansfil]');
  process.exit(1);
}
const PORT = Number(portArg ?? 9497);
/** `--sansfil` : le téléphone des cas c, r et rg est le faux téléphone de la liaison sans câble, au lieu du dossier-téléphone du câble. */
const SANSFIL = process.argv.includes('--sansfil');
/** Port TCP fixe du serveur sans-fil du programme en mode `--sansfil` : le même téléphone se représente par son jeton à chaque lancement. */
const PORT_SANSFIL = PORT + 200;
const require = createRequire(import.meta.url);
const { FauxTelephone } = SANSFIL ? require(fileURLToPath(new URL('../../bureau/dist/fauxTelephone.js', import.meta.url))) : { FauxTelephone: null };
const ORIGINE = 'https://gtracker.localhost';
const CAPTURES = process.env.BANC_CAPTURES || null;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
/** `BANC_CAS=g,i` (facultatif) : ne joue que ces cas (a, b, c pour c à f, g, h, k, i) ; sans lui, tous. */
const CAS = process.env.BANC_CAS ? process.env.BANC_CAS.split(',').map((c) => c.trim()) : SANSFIL ? ['c', 'r', 'rg'] : null;
const veut = (cas) => CAS === null || CAS.includes(cas);
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `);
const disparu = async (pid, ms) => { for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200); } return !vivant(pid); };

let echecs = 0;
const check = (quoi, ok, detail) => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) echecs++; };

const RACINE = mkdtempSync(join(tmpdir(), 'gtk-syn-'));
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
/** Arbre avec la taille et l'heure de chaque fichier : change si quoi que ce soit est écrit ; `garder` filtre les chemins. */
const empreinte = (racine, garder = () => true) => (arbre(racine) ?? []).filter(garder).map((c) => (c.endsWith('/') ? c : `${c}:${statSync(join(racine, c)).size}:${statSync(join(racine, c)).mtimeMs}`)).join('|');
const temporaires = (racine) => (arbre(racine) ?? []).filter((c) => /\.gtracker-(tmp|new)$/.test(c));
const sessionsDe = (memoire) => (existsSync(join(memoire, 'sessions')) ? readdirSync(join(memoire, 'sessions')).sort() : []);
const gpxsDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.gpx'));
const fichesDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.json'));
/** Tous les fichiers d'une mémoire, contenu compris (pour chercher une marque). */
const contient = (racine, marque) => (arbre(racine) ?? []).filter((c) => !c.endsWith('/')).filter((c) => readFileSync(join(racine, c)).includes(marque));
const lireJson = (chemin) => { try { return JSON.parse(readFileSync(chemin, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const memes = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  // Les variables du téléphone et du sans-fil d'essai ne viennent jamais de l'environnement du poste.
  for (const cle of Object.keys(complet)) if (/^GTRACKER_BANC_(SANSFIL|TELEPHONE)/.test(cle) && !(cle in env)) delete complet[cle];
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
/** Le faux téléphone de chaque profil (jeton gardé d'un lancement à l'autre) et sa liaison en cours, en mode `--sansfil`. */
const fauxParProfil = new Map();
/**
 * Relie le faux téléphone à l'instance : première fois, par le code lu sur la page (Réglages › Mémoire, « Relier un
 * téléphone ») ; ensuite, par son jeton, sur le port fixe du serveur. `stockage` : le dossier qui joue le `/sdcard` du câble ;
 * le faux téléphone joue son `Documents/Gtracker`.
 */
async function relierFaux(b, profil, stockage) {
  const connu = fauxParProfil.get(profil);
  if (connu) {
    for (let k = 0; ; k++) {
      try { connu.liaison = await connu.faux.connecter('127.0.0.1', PORT_SANSFIL); break; } catch (e) { if (k >= 20) throw e; await pause(500); }
    }
    return;
  }
  const faux = new FauxTelephone({ dossier: racineTel(stockage), delaiMs: 20000 });
  await b.go('/parametres', 5000);
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 8000, label: 'carte Mémoire' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.wireless-card'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire')`);
  }
  await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 10000, label: 'écoute du sans-fil' });
  check('sans-fil : « Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
  await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code' });
  const code = await b.evaluate(`document.querySelector('.wireless-card__code').textContent.trim()`);
  const liaison = await faux.appairer('127.0.0.1', PORT_SANSFIL, code);
  await b.waitFor(`/relié en ce moment/.test(document.querySelector('.wireless-card')?.innerText ?? '')`, { timeout: 8000, label: 'téléphone relié' });
  fauxParProfil.set(profil, { faux, liaison });
}
/**
 * Lance, joue `essai`, ferme toujours (même sur erreur). Vérifie la console de la page à la fin. En mode `--sansfil`, un
 * lancement qui reçoit `GTRACKER_BANC_TELEPHONE` (sans état ni coupure imposés) joue ce dossier par le faux téléphone du
 * Wi-Fi, que l'on relie d'abord, au lieu de par le câble.
 */
async function avecProgramme(profil, memoire, env, quoi, essai) {
  let p = null;
  const sansFil = SANSFIL && Boolean(env.GTRACKER_BANC_TELEPHONE) && !env.GTRACKER_BANC_TELEPHONE_ETAT && !env.GTRACKER_BANC_TELEPHONE_COUPURE;
  try {
    let pour = env;
    if (sansFil) {
      const { GTRACKER_BANC_TELEPHONE: _cable, ...reste } = env;
      pour = { ...reste, GTRACKER_BANC_SANSFIL_ACTIF: '1', GTRACKER_BANC_SANSFIL_PORT: String(PORT_SANSFIL) };
    }
    p = await lancer(profil, memoire, pour);
    if (sansFil) await relierFaux(p.b, profil, env.GTRACKER_BANC_TELEPHONE);
    const r = await essai(p.b, p);
    check(`${quoi} : console de la page sans erreur`, p.b.logs.length === 0, p.b.logs.join(' | '));
    return r;
  } catch (e) {
    check(`${quoi} : essai interrompu : ${e.stack ?? e.message}`, false);
    return null;
  } finally {
    if (sansFil) fauxParProfil.get(profil)?.liaison?.fermer?.();
    if (p) await fermer(p);
  }
}

const texte = (b) => b.evaluate('document.body.innerText');
const SELECTEUR_BOUTON = '.shell-topactions .phone-sync';
const DIALOGUE = '[role=dialog].phone-sync__dialog';
/** Ce que la fenêtre dit : phrases, dossier, résumé et liste dépliable, boutons (texte brut, la casse d'écran ne compte pas). */
const releve = (b) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(DIALOGUE)});
  if (!d) return null;
  const texte = (x) => x.textContent.trim();
  return {
    titre: d.getAttribute('aria-label'),
    paragraphes: [...d.querySelectorAll('.phone-sync__body p')].map(texte),
    dossier: [...d.querySelectorAll('code.phone-sync__folder')].map(texte)[0] ?? null,
    resume: [...d.querySelectorAll('.phone-sync__details summary')].map(texte)[0] ?? null,
    liste: [...d.querySelectorAll('.phone-sync__sessions li')].map(texte),
    boutons: [...d.querySelectorAll('.phone-sync__actions button')].map(texte),
  };
})()`);
/** Phrases d'une synchronisation qui n'est pas finie. */
const EN_COURS = /Recherche du téléphone…|Comparaison des deux appareils…|Copie de sécurité des deux appareils…|Synchronisation avec le téléphone .* par le (câble|Wi-Fi)…|\d+ fichiers? sur \d+/;
/** Attend l'issue de la synchronisation (compte rendu ou question), relève la fenêtre et note les étapes vues en route. */
async function suivre(b, quoi) {
  const vus = [];
  const fin = Date.now() + 40000;
  let r = null;
  while (Date.now() < fin) {
    r = await releve(b);
    for (const l of r?.paragraphes ?? []) if (EN_COURS.test(l) && !vus.includes(l)) vus.push(l);
    if (r && r.paragraphes.length > 0 && !r.paragraphes.some((l) => EN_COURS.test(l))) break;
    await b.wait(25);
  }
  await b.wait(300);
  r = await releve(b);
  console.log(`  étapes vues : ${vus.join(' | ') || '(aucune)'}`);
  console.log(`  fenêtre « ${r?.titre} » :`);
  for (const l of r?.paragraphes ?? []) console.log(`    | ${l}`);
  if (r?.resume) console.log(`    résumé : ${r.resume} ; liste : ${(r.liste ?? []).length} ligne(s)`);
  if (r?.dossier) console.log(`    dossier : ${r.dossier}`);
  console.log(`    boutons : ${(r?.boutons ?? []).join(' / ')}`);
  check(`${quoi} : la fenêtre s'appelle « Synchroniser avec le téléphone »`, r?.titre === 'Synchroniser avec le téléphone', r?.titre);
  check(`${quoi} : l'issue est arrivée (plus d'étape en cours)`, Boolean(r) && !(r.paragraphes ?? []).some((l) => EN_COURS.test(l)), JSON.stringify(r?.paragraphes));
  return { ...r, vus };
}
/** Clique « Synchroniser » (barre du haut) et attend l'issue. */
async function synchroniser(b, quoi) {
  check(`${quoi} : le bouton « Synchroniser » est dans la barre du haut`, (await b.evaluate(`document.querySelector(${JSON.stringify(SELECTEUR_BOUTON)})?.textContent.trim() ?? null`)) === 'Synchroniser');
  check(`${quoi} : clic « Synchroniser »`, (await b.click(SELECTEUR_BOUTON)) === 'ok');
  await b.wait(200);
  return suivre(b, quoi);
}
/** Clique un bouton de la fenêtre et attend l'issue qui suit. */
async function repondre(b, quoi, bouton) {
  check(`${quoi} : clic « ${bouton} »`, (await b.clickText(bouton, '.phone-sync__actions button')) === 'ok');
  await b.wait(200);
  return suivre(b, quoi);
}
const fermerFenetre = async (b) => { await b.evaluate(`[...document.querySelectorAll('.phone-sync__actions button')].find((x) => x.textContent.trim() === 'Fermer')?.click()`); await b.wait(300); };
/** Capture JPEG de la page, 900 px de large au plus. */
async function capturer(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1400, height: 1000, scale: 0.64 } });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(r.result.data, 'base64'));
}
/** Lignes de la page Sessions. */
async function pageSessions(b) {
  await b.go('/sessions', 5000);
  await b.waitFor(`/session/i.test(document.body.innerText)`, { timeout: 5000 });
  await b.settle({ max: 2000 });
  return texte(b);
}
/** Une ligne par session : sa date et son heure (« sam. 3 oct. 2026 · 11:00 »). */
const lignesSessions = (t) => (t.match(/\d{4} · \d{2}:\d{2}/g) ?? []).length;
const contientLigne = (r, ligne) => (r?.paragraphes ?? []).includes(ligne);

// ---------- les sessions : fabriquées par le programme, copiées d'un dossier à l'autre ----------
const NOMBRE = 12;
const jourDe = (k) => k + 1;
const heureDe = (k) => 7 + k;
const gpxSynthetique = (k) => traceDroite({ debutMs: Date.UTC(2026, 9, jourDe(k), heureDe(k), 0, 0), secondes: 300, vitesse: 4, type: 'wingfoil', nom: 'wingfoil' });
const MARQUE = 'TELEPHONE-MARQUE-A-NE-PAS-COPIER';
/** Date de modification connue d'un fichier du téléphone : octobre 2026, à la seconde. */
const dater = (fichier, jour) => { const d = new Date(Date.UTC(2026, 9, jour, 12, 0, 0)); utimesSync(fichier, d, d); };
const MARQUEUR = `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`;

/** Le programme importe NOMBRE traces dans une mémoire neuve : GPX et fiches rangés sont ceux d'une vraie session. */
async function fabriquerModeles() {
  const profil = dossier('prep-profil');
  const memoire = dossier('prep-memoire');
  await avecProgramme(profil, memoire, {}, 'préparation', async (b) => {
    await b.go('/sessions', 5000);
    for (let k = 0; k < NOMBRE; k++) {
      check(`préparation : import de la session ${k + 1}`, (await b.importGpx(gpxSynthetique(k), `modele-${k + 1}.gpx`)) === 'ok');
      await b.waitFor(() => gpxsDe(memoire).length >= k + 1 && fichesDe(memoire).length >= k + 1, { timeout: 15000, label: `GPX et fiche ${k + 1}` });
      await b.settle({ max: 1500 });
    }
    await b.wait(1500);
  });
  const gpx = gpxsDe(memoire);
  const fiches = fichesDe(memoire);
  check(`préparation : ${NOMBRE} sessions entières sortent du programme`, gpx.length === NOMBRE && fiches.length === NOMBRE, `${gpx.length} GPX, ${fiches.length} fiches`);
  return gpx.map((nom, k) => ({ k, jour: jourDe(k), nom: nom.replace(/\.gpx$/, ''), gpx: join(memoire, 'sessions', nom), fiche: join(memoire, 'sessions', nom.replace(/\.gpx$/, '.json')) }));
}
let MODELES = [];
/** Pose les sessions `ks` (indices des modèles) dans `racine/sessions` : GPX et fiche, dates connues. */
function poser(racine, ks) {
  mkdirSync(join(racine, 'sessions'), { recursive: true });
  for (const k of ks) {
    const m = MODELES[k];
    for (const [source, ext] of [[m.gpx, 'gpx'], [m.fiche, 'json']]) {
      const cible = join(racine, 'sessions', `${m.nom}.${ext}`);
      copyFileSync(source, cible);
      dater(cible, m.jour);
    }
  }
}
const nomsDe = (ks) => ks.map((k) => MODELES[k].nom);
/** Le dossier du téléphone factice : `<stockage>/Documents/Gtracker`, ses sessions, son marqueur et trois fichiers qui n'y bougent pas. */
const racineTel = (stockage) => join(stockage, 'Documents', 'Gtracker');
function fabriquerTelephone(nom, ks) {
  const stockage = dossier(nom);
  const racine = racineTel(stockage);
  mkdirSync(join(racine, 'reglages'), { recursive: true });
  mkdirSync(join(racine, 'itineraires'), { recursive: true });
  writeFileSync(join(racine, 'gtracker.json'), MARQUEUR);
  // Des lieux appris valides et vides (rien à fondre) ; un itinéraire marqué : la synchronisation des sessions n'y touche pas.
  writeFileSync(join(racine, 'lieux.json'), `${JSON.stringify({ format: FORMATS.memoire.replace(/-memoire$/, '-lieux'), version: 1, places: [] })}\n`);
  writeFileSync(join(racine, 'itineraires', 'parcours-telephone.gpx'), `<gpx><!-- ${MARQUE} --></gpx>`);
  for (const f of ['lieux.json', 'itineraires/parcours-telephone.gpx']) dater(join(racine, ...f.split('/')), 9);
  poser(racine, ks);
  return stockage;
}
/** Une mémoire du PC prête d'avance : marqueur, sessions `ks`. */
function fabriquerMemoire(nom, ks) {
  const memoire = dossier(`${nom}-memoire`);
  writeFileSync(join(memoire, 'gtracker.json'), MARQUEUR);
  poser(memoire, ks);
  return memoire;
}
/** Retire du téléphone factice (ou de la mémoire) les fichiers d'une session, comme le fait l'application qui supprime. */
function retirer(racine, ks) {
  for (const k of ks) for (const ext of ['gpx', 'json']) { const f = join(racine, 'sessions', `${MODELES[k].nom}.${ext}`); if (existsSync(f)) unlinkSync(f); }
}
/**
 * Ce que le téléphone porte hors des sessions, du marqueur et du fichier de réglages de l'ordinateur (`reglages/pc.json`,
 * recopié sur le téléphone par la synchronisation, jamais adopté) : lieux et itinéraires ne changent pas.
 */
const horsSessions = (racine) => empreinte(racine, (c) => !c.startsWith('sessions/') && c !== 'gtracker.json' && c !== 'gtracker.json.gtracker-tmp' && c !== 'reglages/pc.json' && c !== 'reglages/');
const gardeHorsSessions = (quoi, racine, avant) => check(`${quoi} : le téléphone garde, intacts, ses lieux et ses itinéraires (fichiers, tailles et dates)`, horsSessions(racine) === avant, `\n--- avant ---\n${avant}\n--- après ---\n${horsSessions(racine)}`);

// ---------- les itinéraires : fiches écrites au format de `planning/routeRecord.ts` ----------
const FORMAT_ITINERAIRE = FORMATS.memoire.replace(/-memoire$/, '-itineraire');
const ITINERAIRES = Object.fromEntries(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'].map((cle, k) => [cle, { cle, nom: `Itin ${cle}`, creation: `2026-09-0${k + 1}T08:00:00.000Z`, decalage: k * 0.01 }]));
/** Fiche d'un itinéraire comme `serializeRouteRecord` l'écrit : une ligne de JSON, sans indentation, fin de ligne. `note` : champ inconnu, gardé à la réécriture, qui fait varier le contenu. */
const ficheItineraire = (def, note, maj) => `${JSON.stringify({
  format: FORMAT_ITINERAIRE, version: 4, name: def.nom, activityId: null, createdAt: def.creation, updatedAt: maj,
  waypoints: [{ lat: 43.5 + def.decalage, lon: 3.9 }, { lat: 43.51 + def.decalage, lon: 3.92 }],
  legs: [{ mode: 'straight', points: [[43.5 + def.decalage, 3.9], [43.51 + def.decalage, 3.92]] }],
  noteBanc: note,
})}\n`;
const gpxItineraire = (def, note) => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="banc"><metadata><name>${def.nom}</name><desc>${note}</desc></metadata><rte><name>${def.nom}</name><rtept lat="${43.5 + def.decalage}" lon="3.9"/><rtept lat="${43.51 + def.decalage}" lon="3.92"/></rte></gpx>\n`;
/** Pose (ou remplace) la fiche et le GPX d'un itinéraire dans `racine/itineraires`, à une date de modification connue. */
function poserItineraire(racine, cle, { note = 'v1', maj = null, jour = 5 } = {}) {
  const def = ITINERAIRES[cle];
  mkdirSync(join(racine, 'itineraires'), { recursive: true });
  const json = join(racine, 'itineraires', `${def.nom}.json`);
  const gpx = join(racine, 'itineraires', `${def.nom}.gpx`);
  writeFileSync(json, ficheItineraire(def, note, maj ?? def.creation));
  writeFileSync(gpx, gpxItineraire(def, note));
  dater(json, jour);
  dater(gpx, jour);
}
/** Retire la fiche puis le GPX d'un itinéraire, comme le fait l'application qui supprime. */
function retirerItineraire(racine, cle) {
  for (const ext of ['json', 'gpx']) { const f = join(racine, 'itineraires', `${ITINERAIRES[cle].nom}.${ext}`); if (existsSync(f)) unlinkSync(f); }
}
const fichiersItineraire = (cles) => cles.flatMap((cle) => [`${ITINERAIRES[cle].nom}.json`, `${ITINERAIRES[cle].nom}.gpx`]);
/** Noms des fichiers de `racine/itineraires`. */
const itinerairesDe = (racine) => (existsSync(join(racine, 'itineraires')) ? readdirSync(join(racine, 'itineraires')).sort() : []);
const ITI_PC_AVANT = fichiersItineraire(['alpha', 'bravo', 'charlie', 'delta']);
const ITI_TEL_AVANT = [...fichiersItineraire(['echo', 'foxtrot', 'charlie']), 'parcours-telephone.gpx'];
const ORPHELIN = 'parcours-telephone.gpx';
/** L'ordinateur porte exactement les itinéraires `cles`, le téléphone les mêmes et son GPX seul ; fiches et GPX identiques à l'octet ; aucun temporaire. */
function memesItineraires(quoi, memoire, tel, cles) {
  const attendus = fichiersItineraire(cles);
  check(`${quoi} : l'ordinateur porte ${cles.length} itinéraires, fiche et GPX chacun`, memes(itinerairesDe(memoire), attendus), itinerairesDe(memoire).join(' | '));
  check(`${quoi} : le téléphone porte les mêmes (et son GPX seul)`, memes(itinerairesDe(racineTel(tel)), [...attendus, ORPHELIN]), itinerairesDe(racineTel(tel)).join(' | '));
  const differents = attendus.filter((n) => existsSync(join(memoire, 'itineraires', n)) && existsSync(join(racineTel(tel), 'itineraires', n)) && !readFileSync(join(memoire, 'itineraires', n)).equals(readFileSync(join(racineTel(tel), 'itineraires', n))));
  check(`${quoi} : fiches et GPX identiques des deux côtés, octet pour octet`, differents.length === 0, differents.join(','));
  check(`${quoi} : aucun temporaire dans itineraires/ (ordinateur, téléphone)`, temporaires(memoire).length === 0 && temporaires(racineTel(tel)).length === 0, `${temporaires(memoire)} ${temporaires(racineTel(tel))}`);
}
/** Supprime un itinéraire depuis la page Itinéraires (« … » de sa ligne, « Supprimer », « Mettre à la corbeille (30 jours) »). */
async function supprimerItineraireDeLaListe(b, nom, quoi) {
  await b.go('/itineraires/liste', 5000);
  await b.waitFor(`document.body.innerText.includes(${JSON.stringify(nom)})`, { timeout: 8000, label: 'ligne de l\'itinéraire' });
  await b.settle({ max: 1500 });
  const menu = await b.evaluate(`(() => {
    const sel = ${JSON.stringify('button[aria-label="Plus d\'actions sur l\'itinéraire"]')};
    // La ligne : le plus petit élément qui porte le nom et un seul « … ».
    const lignes = [...document.body.querySelectorAll('*')].filter((e) => e.querySelectorAll(sel).length === 1 && e.textContent.includes(${JSON.stringify(nom)}));
    const ligne = lignes.at(-1);
    if (!ligne) return 'menu absent : ' + document.body.innerText.slice(0, 500);
    ligne.querySelector(sel).click();
    return 'ok';
  })()`);
  check(`${quoi} : « … » de la ligne « ${nom} »`, menu === 'ok', menu);
  await b.wait(150);
  // Seul le menu ouvert compte : le panneau de chaque ligne est dans la page, fermé ou non.
  const sup = await b.evaluate(`(() => { const x = [...document.querySelectorAll('.ui-more__panel button')].filter((y) => y.getBoundingClientRect().width > 0).find((y) => y.textContent.trim().startsWith('Supprimer')); if (!x) return 'absent'; x.click(); return 'ok'; })()`);
  check(`${quoi} : « Supprimer » du menu`, sup === 'ok', sup);
  await b.waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Garder')`, { timeout: 4000, label: 'confirmation' });
  check(`${quoi} : « Mettre à la corbeille (30 jours) »`, (await b.clickText('Mettre à la corbeille (30 jours)')) === 'ok');
}

/** Corbeille de l'ordinateur sur le disque : index, sous-dossiers, entrées. */
const corbeilleDe = (memoire) => {
  const d = join(memoire, 'corbeille');
  const index = lireJson(join(d, 'corbeille.json'));
  const dirs = existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  return { dir: d, index, dirs, entries: index?.entries ?? [] };
};

/** Mémoire du PC et téléphone portent les mêmes sessions, entières, sans temporaire ni fichier venu d'ailleurs. */
function memesSessions(quoi, memoire, tel, ks) {
  const attendus = nomsDe(ks);
  const gpxPc = gpxsDe(memoire).map((n) => n.replace(/\.gpx$/, ''));
  const gpxTel = gpxsDe(racineTel(tel)).map((n) => n.replace(/\.gpx$/, ''));
  check(`${quoi} : ${ks.length} sessions sur l'ordinateur`, memes(gpxPc, attendus), `${gpxPc.join(' | ')}`);
  check(`${quoi} : ${ks.length} sessions sur le téléphone`, memes(gpxTel, attendus), `${gpxTel.join(' | ')}`);
  for (const [cote, racine, liste] of [['ordinateur', memoire, gpxPc], ['téléphone', racineTel(tel), gpxTel]]) {
    check(`${quoi} : sur ${cote === 'ordinateur' ? "l'ordinateur" : 'le téléphone'}, chaque GPX a sa fiche, et inversement (aucune moitié de session)`, memes(fichesDe(racine).map((n) => n.replace(/\.json$/, '')), liste), `${fichesDe(racine).join(' | ')}`);
  }
  for (const nom of attendus) {
    const a = join(memoire, 'sessions', `${nom}.gpx`);
    const b = join(racineTel(tel), 'sessions', `${nom}.gpx`);
    if (existsSync(a) && existsSync(b) && !readFileSync(a).equals(readFileSync(b))) check(`${quoi} : « ${nom} » : GPX identique des deux côtés`, false);
  }
  check(`${quoi} : aucun temporaire (.gtracker-tmp, .gtracker-new) sur l'ordinateur`, temporaires(memoire).length === 0, temporaires(memoire).join(','));
  check(`${quoi} : aucun temporaire sur le téléphone`, temporaires(racineTel(tel)).length === 0, temporaires(racineTel(tel)).join(','));
  check(`${quoi} : rien du téléphone n'est dans la mémoire (ni lieux, ni réglages, ni itinéraires)`, contient(memoire, MARQUE).length === 0, contient(memoire, MARQUE).join(','));
}
/** Les copies de sécurité sous Documents du profil d'essai : leurs dossiers. */
const copiesDe = (profil) => { const d = join(profil, 'Documents-essai', 'Gtracker-copies'); return existsSync(d) ? readdirSync(d).sort() : []; };

const ETATS = {
  absent: {
    paragraphes: [
      "Aucun téléphone n'est vu. Branchez votre téléphone à l'ordinateur par un câble USB, puis cliquez sur « Réessayer ».",
      'La première fois, il faut aussi activer le « Débogage USB » du téléphone : ouvrez Paramètres, puis À propos du téléphone, et touchez sept fois « Version » pour afficher les options pour développeurs. Ouvrez-les, activez « Débogage USB », puis revenez ici.',
      // Sans-fil éteint (il l'est tant que rien ne l'allume) : la phrase qui invite à l'allumer vient en dernier.
      'Sans câble : allumez le sans-fil dans Réglages, Mémoire, puis reliez votre téléphone.',
    ],
  },
  autorisation: {
    paragraphes: [
      "Regardez l'écran du téléphone : une fenêtre demande « Autoriser le débogage USB ? ». Cochez « Toujours autoriser cet ordinateur », touchez « Autoriser », puis cliquez ici sur « Réessayer ».",
      "Si le téléphone le redemande au bout d'une semaine : dans les options pour développeurs, cochez « Désactiver le délai d'expiration des autorisations adb » pour ne plus le voir.",
    ],
  },
  horsLigne: { paragraphes: ['Le téléphone est branché mais ne répond pas. Déverrouillez son écran, débranchez puis rebranchez le câble, et cliquez sur « Réessayer ».'] },
  adbIntrouvable: {
    paragraphes: [
      "Pour lire le téléphone, Gtracker a besoin d'un outil gratuit de Google, « SDK Platform-Tools », absent de cet ordinateur.",
      "Téléchargez-le pour Windows sur developer.android.com/tools/releases/platform-tools, ouvrez le fichier .zip, copiez le dossier « platform-tools » qu'il contient dans le dossier ci-dessous, puis cliquez sur « Réessayer ».",
    ],
  },
  occupe: { paragraphes: ['Un autre programme utilise la liaison avec le téléphone (Android Studio, scrcpy…). Fermez-le, puis cliquez sur « Réessayer ».'] },
};

/** Supprime la première ligne de la page Sessions (« … », « Supprimer », « Confirmer ») : elle part à la corbeille de l'ordinateur. */
async function supprimerPremiereLigne(b, quoi) {
  await pageSessions(b);
  check(`${quoi} : « … » puis « Supprimer » de la première ligne`, (await actionLigne(b.evaluate, b.wait, 'Wingfoil', 'Supprimer')) === 'ok');
  await b.waitFor(`Boolean(document.querySelector('.lib-row__confirm'))`, { timeout: 4000, label: 'confirmation' });
  check(`${quoi} : « Confirmer »`, (await b.clickText('Confirmer')) === 'ok');
}

try {
  console.log('\n== Préparation : douze sessions écrites par le programme');
  MODELES = await fabriquerModeles();
  console.log(`modèles : ${MODELES.map((m) => m.nom).join(' ; ')}`);

  // ---------- a. états imposés ----------
  console.log('\n== a. Chaque état imposé : message, « Réessayer », rien de rangé ni de copié');
  for (const [etat, attendu] of Object.entries(ETATS)) {
    if (!veut('a')) break;
    const profil = dossier(`a-${etat}-profil`);
    const memoire = fabriquerMemoire(`a-${etat}`, [4, 5]);
    const tel = fabriquerTelephone(`a-${etat}-tel`, [0, 1]);
    const avantTel = empreinte(tel);
    const avantPc = empreinte(memoire, (c) => c.startsWith('sessions/'));
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_ETAT: etat }, `a. ${etat}`, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, `a. ${etat}`);
      check(`a. ${etat} : le texte du message, en entier`, JSON.stringify(r.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify(r.paragraphes));
      check(`a. ${etat} : « Réessayer » est offert (puis « Fermer »)`, (r.boutons ?? []).join('/') === 'Réessayer/Fermer', (r.boutons ?? []).join('/'));
      if (etat === 'adbIntrouvable') {
        check('a. adbIntrouvable : le dossier où poser l\'outil est affiché (platform-tools du profil)', Boolean(r.dossier) && r.dossier.toLowerCase().startsWith(profil.toLowerCase()) && /platform-tools$/.test(r.dossier), r.dossier);
      } else check(`a. ${etat} : pas de dossier à recopier`, r.dossier === null, r.dossier);
      if (etat === 'absent') await capturer(b, 'synchroniser-absent');
      check(`a. ${etat} : « Réessayer »`, (await b.clickText('Réessayer', '.phone-sync__actions button')) === 'ok');
      await b.wait(1500);
      const r2 = await releve(b);
      check(`a. ${etat} : « Réessayer » redit le même message`, JSON.stringify(r2?.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify(r2?.paragraphes));
    });
    check(`a. ${etat} : la mémoire de l'ordinateur n'a pas changé (mêmes sessions, ni synchro/ ni corbeille/)`, empreinte(memoire, (c) => c.startsWith('sessions/')) === avantPc && !existsSync(join(memoire, 'synchro')) && !existsSync(join(memoire, 'corbeille')), (arbre(memoire) ?? []).join(','));
    check(`a. ${etat} : aucune copie de sécurité`, copiesDe(profil).length === 0, copiesDe(profil).join(','));
    check(`a. ${etat} : téléphone factice intact (fichiers, tailles et dates)`, empreinte(tel) === avantTel, `\n--- avant ---\n${avantTel}\n--- après ---\n${empreinte(tel)}`);
  }

  // ---------- b. dossier absent ----------
  console.log('\n== b. Téléphone sans dossier Documents/Gtracker');
  if (veut('b')) {
    const profil = dossier('b-profil');
    const memoire = fabriquerMemoire('b', [4]);
    const tel = dossier('b-tel');
    mkdirSync(join(tel, 'Download'), { recursive: true });
    writeFileSync(join(tel, 'Download', 'autre.txt'), 'sans rapport');
    const avant = empreinte(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'b', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, 'b');
      const attendu = ["Le téléphone Téléphone d'essai n'a pas de dossier « Documents/Gtracker ». Gtracker ne synchronise que les sessions rangées dans ce dossier : sur le téléphone, ouvrez Gtracker, Réglages, Mémoire, pour voir où il les range."];
      check('b. le message du dossier absent, en entier', JSON.stringify(r.paragraphes) === JSON.stringify(attendu), JSON.stringify(r.paragraphes));
      check('b. « Réessayer » offert', (r.boutons ?? []).join('/') === 'Réessayer/Fermer', (r.boutons ?? []).join('/'));
    });
    check('b. aucune copie de sécurité, téléphone intact', copiesDe(profil).length === 0 && empreinte(tel) === avant);
  }

  // ---------- c, d, e, f. première synchronisation puis suppressions ----------
  console.log('\n== c, d, e, f. Première synchronisation, second clic, suppression sur le téléphone, suppression sur l\'ordinateur, restauration');
  if (veut('c')) {
    const PHONE = [0, 1, 2, 3];
    const PC = [3, 4, 5, 6, 7];
    const TOUT = [0, 1, 2, 3, 4, 5, 6, 7];
    const profil = dossier('c-profil');
    const memoire = fabriquerMemoire('c', PC);
    const tel = fabriquerTelephone('c-tel', PHONE);
    const racine = racineTel(tel);
    const avantHors = horsSessions(racine);
    const avantMarqueur = readFileSync(join(racine, 'gtracker.json'), 'utf8');
    const avantMarqueurPc = readFileSync(join(memoire, 'gtracker.json'), 'utf8');
    const avantTelSessions = sessionsDe(racine);
    const avantPcSessions = sessionsDe(memoire);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'c à f', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const avantListe = await pageSessions(b);
      check('c. avant : la page Sessions montre cinq lignes (celles de l\'ordinateur)', lignesSessions(avantListe) === 5, String(lignesSessions(avantListe)));

      // c
      let r = await synchroniser(b, 'c');
      await capturer(b, 'synchroniser-compte-rendu');
      check('c. la phrase « Première synchronisation… : rien n\'a été supprimé. » est dite', contientLigne(r, "Première synchronisation avec ce téléphone : rien n'a été supprimé."), JSON.stringify(r.paragraphes));
      check('c. « 4 sessions copiées vers le téléphone, 3 vers l\'ordinateur. »', contientLigne(r, "4 sessions copiées vers le téléphone, 3 vers l'ordinateur."), JSON.stringify(r.paragraphes));
      check('c. « Sur le téléphone, touchez « Mettre à jour » pour voir les changements. »', contientLigne(r, 'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.'), JSON.stringify(r.paragraphes));
      check('c. « 1 fichier de réglages recopié. » (celui de l\'ordinateur, vers le téléphone)', contientLigne(r, '1 fichier de réglages recopié.'), JSON.stringify(r.paragraphes));
      check('c. le fichier de réglages de l\'ordinateur est sur le téléphone, octet pour octet, et le téléphone n\'a rien reçu d\'autre dans reglages/', existsSync(join(memoire, 'reglages', 'pc.json')) && existsSync(join(racine, 'reglages', 'pc.json')) && readFileSync(join(memoire, 'reglages', 'pc.json')).equals(readFileSync(join(racine, 'reglages', 'pc.json'))) && readdirSync(join(racine, 'reglages')).join(',') === 'pc.json', existsSync(join(racine, 'reglages')) ? readdirSync(join(racine, 'reglages')).join(',') : 'absent');
      check('c. « Copie de sécurité des deux appareils, faite avant la première synchronisation : » et son dossier', contientLigne(r, 'Copie de sécurité des deux appareils, faite avant la première synchronisation :') && Boolean(r.dossier), JSON.stringify([r.paragraphes, r.dossier]));
      check('c. aucune ligne de suppression (ni corbeille, ni retrait)', !(r.paragraphes ?? []).some((l) => /supprim|corbeille/i.test(l) && !/rien n'a été supprimé/.test(l)), JSON.stringify(r.paragraphes));
      check('c. seul « Fermer » est offert (rien à réessayer)', (r.boutons ?? []).join('/') === 'Fermer', (r.boutons ?? []).join('/'));
      await b.wait(2000); // réécritures différées des fiches
      memesSessions('c', memoire, tel, TOUT);
      gardeHorsSessions('c', racine, avantHors);
      // La copie de sécurité : sous Documents\Gtracker-copies\<date>\, avec l'état d'avant des deux appareils.
      const copies = copiesDe(profil);
      check('c. une seule copie de sécurité sous Documents/Gtracker-copies', copies.length === 1 && /^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}$/.test(copies[0]), copies.join(','));
      const copie = copies.length === 1 ? join(profil, 'Documents-essai', 'Gtracker-copies', copies[0]) : null;
      check('c. le dossier montré par la fenêtre est celui de la copie', copie !== null && r.dossier?.toLowerCase() === copie.toLowerCase(), `${r.dossier} / ${copie}`);
      if (copie) {
        console.log(`  copie de sécurité : ${(arbre(copie) ?? []).join(' ; ')}`);
        check('c. la copie de l\'ordinateur porte ses cinq sessions d\'avant (GPX et fiches), pas celles du téléphone', memes(sessionsDe(join(copie, 'ordinateur')), avantPcSessions), sessionsDe(join(copie, 'ordinateur')).join(' | '));
        check('c. la copie du téléphone porte ses quatre sessions d\'avant, pas celles de l\'ordinateur', memes(sessionsDe(join(copie, 'telephone')), avantTelSessions), sessionsDe(join(copie, 'telephone')).join(' | '));
        check('c. les marqueurs copiés sont ceux d\'avant (sans identifiant)', readFileSync(join(copie, 'telephone', 'gtracker.json'), 'utf8') === avantMarqueur && readFileSync(join(copie, 'ordinateur', 'gtracker.json'), 'utf8') === avantMarqueurPc);
        // Le câble liste maintenant `itineraires/` : la copie du téléphone en garde l'état d'avant, le GPX seul compris.
        check('c. la copie du téléphone porte aussi ses lieux et son dossier d\'itinéraires (ce que le téléphone liste), octet pour octet', existsSync(join(copie, 'telephone', 'lieux.json')) && existsSync(join(copie, 'telephone', 'itineraires', 'parcours-telephone.gpx')) && readFileSync(join(copie, 'telephone', 'itineraires', 'parcours-telephone.gpx')).equals(readFileSync(join(racine, 'itineraires', 'parcours-telephone.gpx'))), (arbre(join(copie, 'telephone')) ?? []).filter((c) => !c.startsWith('telephone/sessions')).join(','));
        check('c. la copie ne porte aucun temporaire', temporaires(copie).length === 0, temporaires(copie).join(','));
      }
      // Identifiants, base.
      const idTel = lireJson(join(racine, 'gtracker.json'))?.id;
      const idPc = lireJson(join(memoire, 'gtracker.json'))?.id;
      check('c. les deux marqueurs portent un identifiant, différent', typeof idTel === 'string' && typeof idPc === 'string' && idTel !== idPc, `${idTel} / ${idPc}`);
      check('c. le marqueur du téléphone garde son format et sa version', lireJson(join(racine, 'gtracker.json'))?.format === FORMATS.memoire && lireJson(join(racine, 'gtracker.json'))?.version === 1);
      const marqueurTel = lireJson(join(racine, 'gtracker.json'));
      check('c. le marqueur du téléphone porte un champ « synchro » (un instant, celui de la fin de la synchronisation), format, version et identifiant gardés', typeof marqueurTel?.synchro === 'number' && Math.abs(Date.now() - marqueurTel.synchro) < 5 * 60000 && Object.keys(marqueurTel).sort().join(',') === 'format,id,synchro,version', JSON.stringify(marqueurTel));
      const synchroC = marqueurTel?.synchro;
      const synchro = existsSync(join(memoire, 'synchro')) ? readdirSync(join(memoire, 'synchro')) : [];
      console.log(`  synchro/ : ${synchro.join(', ')}`);
      check('c. la base de la paire est écrite (synchro/<identifiant du téléphone>.json), sans témoin d\'interruption', synchro.includes(`${idTel}.json`) && !synchro.includes('en-cours.json'), synchro.join(','));
      check('c. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);
      const liste = await pageSessions(b);
      check('c. la page Sessions montre huit lignes', lignesSessions(liste) === 8, String(lignesSessions(liste)));
      await b.wait(1500);
      const empreintePc = empreinte(join(memoire, 'sessions'));
      const empreinteTel = empreinte(join(racine, 'sessions'));

      // d
      r = await synchroniser(b, 'd');
      check('d. « Les deux appareils sont à jour. » (et rien d\'autre)', JSON.stringify(r.paragraphes) === JSON.stringify(['Les deux appareils sont à jour.']), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      check('d. les sessions de l\'ordinateur n\'ont pas changé (noms, tailles, dates)', empreinte(join(memoire, 'sessions')) === empreintePc);
      check('d. les sessions du téléphone n\'ont pas changé (noms, tailles, dates)', empreinte(join(racine, 'sessions')) === empreinteTel);
      gardeHorsSessions('d', racine, avantHors);
      check('d. pas de seconde copie de sécurité', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      check('d. rien n\'a changé sur le téléphone : son champ « synchro » est celui du cas c', lireJson(join(racine, 'gtracker.json'))?.synchro === synchroC, `${synchroC} / ${lireJson(join(racine, 'gtracker.json'))?.synchro}`);
      await fermerFenetre(b);

      // e : supprimée sur le téléphone
      const SUPPRIMEE_TEL = 1;
      retirer(racine, [SUPPRIMEE_TEL]);
      const avantE = horsSessions(racine);
      r = await synchroniser(b, 'e');
      check('e. « 1 session supprimée sur le téléphone : mise dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "1 session supprimée sur le téléphone : mise dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      check('e. pas de « Mettre à jour » : rien n\'a été écrit sur le téléphone', !contientLigne(r, 'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.'), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      const TOUT_E = TOUT.filter((k) => k !== SUPPRIMEE_TEL);
      memesSessions('e', memoire, tel, TOUT_E);
      let cb = corbeilleDe(memoire);
      console.log(`  corbeille : ${(arbre(cb.dir) ?? []).join(' ; ')}`);
      const eE = cb.entries[0];
      check('e. l\'index de la corbeille est en version 2, à une entrée', cb.index?.version === 2 && cb.entries.length === 1 && cb.dirs.length === 1, JSON.stringify(cb.index));
      // La copie de l'ordinateur est mise à la corbeille : son origine est « ordinateur ». L'origine « telephone » est
      // réservée à la copie du téléphone rangée à part avant un retrait du téléphone (cas k).
      check('e. l\'entrée est la copie de l\'ordinateur (origine « ordinateur »), supprimée à l\'instant', eE?.kind === 'session' && eE?.origin === 'ordinateur' && eE?.reason === 'supprimee' && Math.abs(Date.now() - eE.deletedAtMs) < 120000, JSON.stringify(eE));
      check('e. l\'entrée nomme le GPX de la session et son sous-dossier', eE?.main === `${MODELES[SUPPRIMEE_TEL].nom}.gpx` && eE?.dir === cb.dirs[0], JSON.stringify(eE));
      const dedansE = existsSync(join(cb.dir, eE?.dir ?? '-')) ? readdirSync(join(cb.dir, eE.dir)).sort() : [];
      check('e. le sous-dossier porte le GPX et la fiche de la session, aux tailles de l\'index', memes(dedansE, [`${MODELES[SUPPRIMEE_TEL].nom}.gpx`, `${MODELES[SUPPRIMEE_TEL].nom}.json`]) && (eE?.files ?? []).every((f) => statSync(join(cb.dir, eE.dir, f.name)).size === f.size), dedansE.join(','));
      check('e. le GPX de la corbeille est celui de la session d\'origine, octet pour octet', existsSync(join(cb.dir, eE?.dir ?? '-', eE?.main ?? '-')) && readFileSync(join(cb.dir, eE.dir, eE.main)).equals(readFileSync(MODELES[SUPPRIMEE_TEL].gpx)));
      gardeHorsSessions('e', racine, avantE);
      await fermerFenetre(b);
      check('e. la page Sessions montre sept lignes', lignesSessions(await pageSessions(b)) === 7);

      // f : supprimée sur l'ordinateur
      const avantGpx = gpxsDe(memoire);
      await supprimerPremiereLigne(b, 'f');
      await b.waitFor(() => gpxsDe(memoire).length === avantGpx.length - 1 && corbeilleDe(memoire).entries.length === 2, { timeout: 10000, label: 'session mise à la corbeille' });
      await b.wait(800);
      const partie = avantGpx.find((n) => !gpxsDe(memoire).includes(n));
      const SUPPRIMEE_PC = MODELES.findIndex((m) => `${m.nom}.gpx` === partie);
      console.log(`  supprimée sur l'ordinateur : ${partie}`);
      check('f. la session supprimée sur l\'ordinateur est bien une des sept', SUPPRIMEE_PC >= 0 && TOUT_E.includes(SUPPRIMEE_PC), partie);
      const avantF = horsSessions(racine);
      check('f. avant la synchronisation, le téléphone la porte encore', existsSync(join(racine, 'sessions', partie)));
      r = await synchroniser(b, 'f');
      check('f. « 1 session supprimée sur l\'ordinateur : retirée du téléphone. »', contientLigne(r, "1 session supprimée sur l'ordinateur : retirée du téléphone."), JSON.stringify(r.paragraphes));
      check('f. « Mettre à jour » : le téléphone a été écrit', contientLigne(r, 'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.'), JSON.stringify(r.paragraphes));
      const marqueurF = lireJson(join(racine, 'gtracker.json'));
      check('f. le téléphone a changé : son champ « synchro » est plus récent que celui du cas c, ses autres champs sont gardés', typeof marqueurF?.synchro === 'number' && marqueurF.synchro > synchroC && marqueurF.format === FORMATS.memoire && marqueurF.version === 1 && typeof marqueurF.id === 'string', JSON.stringify(marqueurF));
      await b.wait(1500);
      const TOUT_F = TOUT_E.filter((k) => k !== SUPPRIMEE_PC);
      memesSessions('f', memoire, tel, TOUT_F);
      check('f. le téléphone n\'a plus ni le GPX ni la fiche de la session', !existsSync(join(racine, 'sessions', partie)) && !existsSync(join(racine, 'sessions', partie.replace(/\.gpx$/, '.json'))));
      cb = corbeilleDe(memoire);
      const eF = cb.entries.find((e) => e.main === partie);
      check('f. la corbeille de l\'ordinateur garde les deux entrées (la session du cas e et celle-ci), celle-ci avec son GPX et sa fiche, et aucune copie « telephone » (la corbeille tenait déjà la session)', cb.entries.length === 2 && cb.entries.every((e) => e.origin === 'ordinateur') && Boolean(eF) && existsSync(join(cb.dir, eF.dir, partie)) && existsSync(join(cb.dir, eF.dir, partie.replace(/\.gpx$/, '.json'))), JSON.stringify(cb.entries.map((e) => [e.origin, e.main])));
      gardeHorsSessions('f', racine, avantF);
      await fermerFenetre(b);

      // f, suite : restaurée depuis Réglages › Mémoire, elle revient sur les deux appareils.
      await b.go('/parametres?bloc=corbeille', 5000);
      await b.waitFor(`Boolean(document.getElementById('zone-corbeille'))`, { timeout: 8000, label: 'zone de la corbeille' });
      await b.wait(600);
      const restauree = await b.evaluate(`(() => {
        const zone = document.getElementById('zone-corbeille');
        const ligne = [...zone.querySelectorAll('li')].find((li) => li.textContent.includes('Restaurer') && li.textContent.includes(${JSON.stringify(heureTexte(SUPPRIMEE_PC))}));
        const bouton = [...(ligne ?? zone).querySelectorAll('button')].find((x) => x.textContent.trim() === 'Restaurer');
        if (!bouton) return 'absent';
        bouton.click();
        return 'ok';
      })()`);
      if (restauree === 'absent') {
        // La liste de la corbeille est repliée : on la déplie, puis on cherche de nouveau.
        await b.evaluate(`[...document.getElementById('zone-corbeille').querySelectorAll('button, summary, [role=button]')].find((x) => /Corbeille/.test(x.textContent))?.click()`);
        await b.wait(500);
      }
      const clic = restauree === 'ok' ? 'ok' : await b.evaluate(`(() => {
        const zone = document.getElementById('zone-corbeille');
        const ligne = [...zone.querySelectorAll('li')].find((li) => li.textContent.includes(${JSON.stringify(heureTexte(SUPPRIMEE_PC))}));
        const bouton = [...(ligne ?? zone).querySelectorAll('button')].find((x) => x.textContent.trim() === 'Restaurer');
        if (!bouton) return 'absent';
        bouton.click();
        return 'ok';
      })()`);
      check('f. « Restaurer » sur la session supprimée de l\'ordinateur', clic === 'ok', clic);
      await b.waitFor(() => gpxsDe(memoire).includes(partie), { timeout: 10000, label: 'session restaurée' });
      await b.wait(1000);
      cb = corbeilleDe(memoire);
      check('f. restaurée : la corbeille ne garde que la session du cas e', cb.entries.length === 1 && cb.entries[0].main === `${MODELES[SUPPRIMEE_TEL].nom}.gpx`, JSON.stringify(cb.entries.map((e) => [e.origin, e.main])));
      check('f. restaurée : la session est de retour sur l\'ordinateur, pas sur le téléphone', gpxsDe(memoire).includes(partie) && !existsSync(join(racine, 'sessions', partie)));
      r = await synchroniser(b, 'f, restauration');
      check('f. restaurée puis synchronisée : « 1 session copiée vers le téléphone. »', contientLigne(r, '1 session copiée vers le téléphone.'), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesSessions('f, restauration', memoire, tel, TOUT_E);
      check('f. restaurée : la corbeille garde toujours la session du cas e (supprimée sur le téléphone, pas restaurée), qui ne revient pas sur le téléphone', corbeilleDe(memoire).entries.length === 1 && corbeilleDe(memoire).entries[0].main === `${MODELES[SUPPRIMEE_TEL].nom}.gpx` && !existsSync(join(racine, 'sessions', `${MODELES[SUPPRIMEE_TEL].nom}.gpx`)));
      await fermerFenetre(b);
    });
  }

  // ---------- g. sessions déjà à la corbeille de l'ordinateur et encore sur le téléphone ----------
  console.log('\n== g. Sessions de la corbeille de l\'ordinateur encore sur le téléphone, à la première synchronisation');
  // Douze sessions des deux côtés : retirer une ou deux d'entre elles ne dépasse pas le garde-fou. Avec trois sessions
  // seulement (g3), retirer la seule supprimée en dépasse le quart : la fenêtre du garde-fou s'ouvre en plus.
  const TOUTES_G = Array.from({ length: NOMBRE }, (_, k) => k);
  // g4 : la fiche de la session supprimée a changé sur le téléphone : la corbeille garde aussi sa copie (deux entrées).
for (const [nom, nbCorbeille, ks0, fichesChangees = false] of [['g1', 2, TOUTES_G], ['g2', 1, TOUTES_G], ['g3', 1, [0, 1, 2]], ['g4', 1, TOUTES_G, true]]) {
    if (!veut('g')) break;
    const profil = dossier(`${nom}-profil`);
    const memoire = fabriquerMemoire(nom, ks0);
    const tel = fabriquerTelephone(`${nom}-tel`, ks0);
    const racine = racineTel(tel);
    const avecGardeFou = ks0.length < 8;
    const avantHors = horsSessions(racine);
    const plusieurs = nbCorbeille > 1;
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, nom, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      // Les sessions de l'ordinateur supprimées avant toute synchronisation.
      const avantGpx = gpxsDe(memoire);
      for (let i = 0; i < nbCorbeille; i++) {
        await supprimerPremiereLigne(b, `${nom}, suppression ${i + 1}`);
        await b.waitFor(() => gpxsDe(memoire).length === avantGpx.length - i - 1 && corbeilleDe(memoire).entries.length === i + 1, { timeout: 10000, label: 'session mise à la corbeille' });
        await b.wait(1100);
      }
      const retirees = avantGpx.filter((n) => !gpxsDe(memoire).includes(n));
      const ks = retirees.map((n) => MODELES.findIndex((m) => `${m.nom}.gpx` === n));
      const restantes = ks0.filter((k) => !ks.includes(k));
      if (fichesChangees) {
        // La fiche de la session retirée change sur le téléphone après la suppression sur l'ordinateur.
        for (const n of retirees) {
          const fiche = join(racine, 'sessions', n.replace(/\.gpx$/, '.json'));
          writeFileSync(fiche, `${JSON.stringify({ ...lireJson(fiche), noteBanc: 'changée sur le téléphone' }, null, 2)}\n`);
          dater(fiche, 20);
        }
      }
      check(`${nom} : ${nbCorbeille} session(s) à la corbeille de l'ordinateur, origine « ordinateur », encore sur le téléphone`, corbeilleDe(memoire).entries.length === nbCorbeille && corbeilleDe(memoire).entries.every((e) => e.origin === 'ordinateur') && retirees.every((n) => existsSync(join(racine, 'sessions', n))), retirees.join(','));

      // première passe : la question
      let r = await synchroniser(b, `${nom}, première passe`);
      const question = plusieurs
        ? `${nbCorbeille} sessions supprimées sur l'ordinateur sont encore sur le téléphone. Les retirer du téléphone ? Elles restent 30 jours dans la corbeille de l'ordinateur.`
        : "1 session supprimée sur l'ordinateur est encore sur le téléphone. La retirer du téléphone ? Elle reste 30 jours dans la corbeille de l'ordinateur.";
      check(`${nom} : la question de la corbeille est posée, en entier`, JSON.stringify(r.paragraphes) === JSON.stringify([question]), JSON.stringify(r.paragraphes));
      check(`${nom} : les sessions concernées sont listées (${nbCorbeille} lignes)`, (r.liste ?? []).length === nbCorbeille, JSON.stringify(r.liste));
      check(`${nom} : les boutons sont « ${plusieurs ? 'Les laisser' : 'La laisser'} » et « Retirer du téléphone »`, memes(r.boutons ?? [], [plusieurs ? 'Les laisser' : 'La laisser', 'Retirer du téléphone']), (r.boutons ?? []).join('/'));
      await capturer(b, `synchroniser-question-corbeille-${nom}`);
      await b.wait(1000);
      memesSessionsPartielles(`${nom} (après la première passe)`, memoire, racine, restantes, ks0);
      check(`${nom} : la copie de sécurité est faite dès la première passe (une seule)`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
      check(`${nom} : le téléphone porte encore toutes ses sessions`, memes(gpxsDe(racine).map((n) => n.replace(/\.gpx$/, '')), nomsDe(ks0)), gpxsDe(racine).join(','));

      // « Les laisser » : rien ne bouge, le compte rendu le dit, et la question revient à la synchronisation suivante.
      const laisser = plusieurs ? 'Les laisser' : 'La laisser';
      r = await repondre(b, `${nom}, « ${laisser} »`, laisser);
      check(`${nom} : « ${laisser} » : le compte rendu dit que ${plusieurs ? 'les sessions restent' : 'la session reste'} sur le téléphone`, (r.paragraphes ?? []).some((l) => (plusieurs
        ? /^2 sessions de la corbeille de l'ordinateur sont encore sur le téléphone : laissées sur le téléphone\.$/
        : /^1 session de la corbeille de l'ordinateur est encore sur le téléphone : laissée sur le téléphone\.$/).test(l)), JSON.stringify(r.paragraphes));
      await b.wait(800);
      check(`${nom} : « ${laisser} » : le téléphone porte toujours toutes ses sessions`, gpxsDe(racine).length === ks0.length);
      await fermerFenetre(b);
      r = await synchroniser(b, `${nom}, seconde synchronisation`);
      check(`${nom} : la question revient à la synchronisation suivante`, JSON.stringify(r.paragraphes) === JSON.stringify([question]), JSON.stringify(r.paragraphes));
      check(`${nom} : toujours une seule copie de sécurité`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
      // « Retirer du téléphone »
      r = await repondre(b, `${nom}, « Retirer du téléphone »`, 'Retirer du téléphone');
      if (avecGardeFou) {
        const phrase = "Cette synchronisation retirerait 1 session. Rien n'est encore supprimé.";
        check(`${nom} : le retrait dépasse le quart du téléphone : la fenêtre du garde-fou s'ouvre en plus (« ${phrase} »)`, JSON.stringify(r.paragraphes) === JSON.stringify([phrase]) && memes(r.boutons ?? [], ['Annuler', 'Supprimer cette session', 'Synchroniser sans rien supprimer']), JSON.stringify([r.paragraphes, r.boutons]));
        check(`${nom} : rien n'est encore retiré du téléphone`, gpxsDe(racine).length === ks0.length);
        r = await repondre(b, `${nom}, « Supprimer cette session »`, 'Supprimer cette session');
      }
      check(`${nom} : « ${nbCorbeille} session${plusieurs ? 's supprimées' : ' supprimée'} sur l'ordinateur : ${plusieurs ? 'retirées' : 'retirée'} du téléphone. »`, contientLigne(r, plusieurs ? "2 sessions supprimées sur l'ordinateur : retirées du téléphone." : "1 session supprimée sur l'ordinateur : retirée du téléphone."), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesSessions(`${nom} (retirées)`, memoire, tel, restantes);
      const cb = corbeilleDe(memoire);
      // Sans ligne de base (supprimée sur l'ordinateur avant toute synchronisation), la copie du téléphone n'est rangée à
      // part que si elle diffère de celle que la corbeille tient déjà (fiche changée sur le téléphone) : sinon une seule
      // entrée, d'origine « ordinateur », par session retirée.
      const attendues = fichesChangees ? 2 * nbCorbeille : nbCorbeille;
      check(`${nom} : la corbeille garde ${fichesChangees ? `${nbCorbeille} entrée(s) de l'ordinateur et ajoute ${nbCorbeille} copie(s) du téléphone (fiche changée sur le téléphone)` : `${nbCorbeille} seule(s) entrée(s), d'origine « ordinateur » (fichiers identiques : pas de doublon)`}, chacune avec GPX et fiche`, cb.entries.length === attendues
        && cb.entries.filter((e) => e.origin === 'ordinateur').length === nbCorbeille && cb.entries.filter((e) => e.origin === 'telephone').length === (fichesChangees ? nbCorbeille : 0)
        && cb.entries.every((e) => existsSync(join(cb.dir, e.dir, e.main)) && existsSync(join(cb.dir, e.dir, e.main.replace(/\.gpx$/, '.json'))) && retirees.includes(e.main)), JSON.stringify(cb.entries.map((e) => [e.origin, e.main])));      await b.go('/parametres?bloc=corbeille', 5000);
      await b.waitFor(`Boolean(document.getElementById('zone-corbeille'))`, { timeout: 8000, label: 'zone de la corbeille' });
      await b.wait(600);
      const zone = await b.evaluate(`document.getElementById('zone-corbeille').innerText.replace(/\\n+/g, ' / ')`);
      console.log(`  ${nom} : zone de la corbeille de Réglages › Mémoire : ${JSON.stringify(zone)}`);
      // La liste compte une ligne par session retirée, même quand la copie du téléphone a été rangée à part (deux entrées).
      const compte = nbCorbeille > 1 ? `${nbCorbeille} sessions` : `${nbCorbeille} session`;
      check(`${nom} : la corbeille de Réglages › Mémoire dit « Corbeille : ${compte} » (une ligne par session retirée${fichesChangees ? ', ses deux entrées réunies : fiche changée' : ''})`, new RegExp(`Corbeille : ${compte}(?! \\d)`).test(zone), zone);
      gardeHorsSessions(nom, racine, avantHors);
      check(`${nom} : une seule copie de sécurité en tout`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
      await fermerFenetre(b);
    });
  }

  // ---------- h. garde-fou ----------
  console.log('\n== h. Garde-fou : onze sessions supprimées sur le téléphone');
  if (veut('h')) {
    const TOUTES = Array.from({ length: NOMBRE }, (_, k) => k);
    const profil = dossier('h-profil');
    const memoire = fabriquerMemoire('h', []);
    const tel = fabriquerTelephone('h-tel', TOUTES);
    const racine = racineTel(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'h', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'h1, première synchronisation');
      check('h1. « 12 sessions copiées vers l\'ordinateur. »', contientLigne(r, "12 sessions copiées vers l'ordinateur."), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      memesSessions('h1', memoire, tel, TOUTES);
      await fermerFenetre(b);

      // Onze sessions supprimées sur le téléphone, une reste.
      const SUPPRIMEES = TOUTES.slice(0, 11);
      retirer(racine, SUPPRIMEES);
      const avantPc = empreinte(join(memoire, 'sessions'));
      const avantTel = empreinte(join(racine, 'sessions'));
      const TEXTE = "Cette synchronisation retirerait 11 sessions. Rien n'est encore supprimé.";
      const verifierQuestion = (quoi, rr) => {
        check(`${quoi} : « ${TEXTE} »`, JSON.stringify(rr.paragraphes) === JSON.stringify([TEXTE]), JSON.stringify(rr.paragraphes));
        check(`${quoi} : « Voir les 11 sessions » et onze lignes dans la liste`, rr.resume === 'Voir les 11 sessions' && (rr.liste ?? []).length === 11, `${rr.resume} / ${(rr.liste ?? []).length}`);
        check(`${quoi} : chaque ligne dit « mise dans la corbeille de l'ordinateur »`, (rr.liste ?? []).every((l) => /mise dans la corbeille de l'ordinateur/.test(l)), JSON.stringify(rr.liste));
        check(`${quoi} : les trois boutons « Annuler », « Supprimer ces 11 sessions », « Synchroniser sans rien supprimer »`, memes(rr.boutons ?? [], ['Annuler', 'Supprimer ces 11 sessions', 'Synchroniser sans rien supprimer']), (rr.boutons ?? []).join('/'));
      };
      const rienNaBouge = (quoi) => {
        check(`${quoi} : rien n'est supprimé (ordinateur : douze sessions, corbeille vide)`, gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0 && empreinte(join(memoire, 'sessions')) === avantPc, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
        check(`${quoi} : le téléphone n'a pas changé`, empreinte(join(racine, 'sessions')) === avantTel);
      };

      // Annuler
      r = await synchroniser(b, 'h2, première question');
      verifierQuestion('h2', r);
      await capturer(b, 'synchroniser-garde-fou');
      r = await repondre(b, 'h2, « Annuler »', 'Annuler');
      console.log(`  après « Annuler » : ${JSON.stringify(r.paragraphes)}`);
      await b.wait(800);
      rienNaBouge('h2, après « Annuler »');
      await fermerFenetre(b);

      // Synchroniser sans rien supprimer
      r = await synchroniser(b, 'h3, seconde question');
      verifierQuestion('h3', r);
      r = await repondre(b, 'h3, « Synchroniser sans rien supprimer »', 'Synchroniser sans rien supprimer');
      console.log(`  après « Synchroniser sans rien supprimer » : ${JSON.stringify(r.paragraphes)}`);
      check('h3. le compte rendu dit les suppressions laissées pour la prochaine fois', (r.paragraphes ?? []).includes('11 suppressions laissées pour une prochaine synchronisation.'), JSON.stringify(r.paragraphes));
      await b.wait(800);
      rienNaBouge('h3, après « Synchroniser sans rien supprimer »');
      await fermerFenetre(b);

      // Supprimer ces 11 sessions
      r = await synchroniser(b, 'h4, troisième question');
      verifierQuestion('h4', r);
      r = await repondre(b, 'h4, « Supprimer ces 11 sessions »', 'Supprimer ces 11 sessions');
      check('h4. « 11 sessions supprimées sur le téléphone : mises dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "11 sessions supprimées sur le téléphone : mises dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      memesSessions('h4', memoire, tel, [11]);
      const cb = corbeilleDe(memoire);
      check('h4. la corbeille porte onze entrées (copies de l\'ordinateur), chacune avec son GPX et sa fiche, l\'index en version 2', cb.entries.length === 11 && cb.index?.version === 2 && cb.entries.every((e) => e.origin === 'ordinateur' && existsSync(join(cb.dir, e.dir, e.main)) && existsSync(join(cb.dir, e.dir, e.main.replace(/\.gpx$/, '.json')))), `${cb.entries.length} ${JSON.stringify(cb.entries.map((e) => e.origin))}`);
      check('h4. une seule copie de sécurité en tout', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      await fermerFenetre(b);
      check('h4. la page Sessions montre une ligne', lignesSessions(await pageSessions(b)) === 1);
    });
  }

  // ---------- m. une confirmation ne vaut que pour les sessions montrées ----------
  console.log('\n== m. Garde-fou : la liste change entre la question et le clic (fenêtre fermée puis rouverte, ou laissée ouverte)');
  for (const variante of ['m1', 'm2']) {
    if (!veut('m')) break;
    const TOUTES = Array.from({ length: NOMBRE }, (_, k) => k);
    const profil = dossier(`${variante}-profil`);
    const memoire = fabriquerMemoire(variante, []);
    const tel = fabriquerTelephone(`${variante}-tel`, TOUTES);
    const racine = racineTel(tel);
    const question = (n) => `Cette synchronisation retirerait ${n} sessions. Rien n'est encore supprimé.`;
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, variante, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, `${variante}, première synchronisation`);
      check(`${variante}. « 12 sessions copiées vers l'ordinateur. »`, contientLigne(r, "12 sessions copiées vers l'ordinateur."), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      await fermerFenetre(b);
      // Dix sessions supprimées sur le téléphone : la question du garde-fou porte sur dix.
      retirer(racine, TOUTES.slice(0, 10));
      r = await synchroniser(b, `${variante}, question sur dix`);
      check(`${variante}. la question porte sur 10 sessions`, JSON.stringify(r.paragraphes) === JSON.stringify([question(10)]) && (r.liste ?? []).length === 10 && (r.boutons ?? []).includes('Supprimer ces 10 sessions'), JSON.stringify([r.paragraphes, r.liste?.length, r.boutons]));
      if (variante === 'm1') {
        // Fenêtre fermée par la croix, une session de plus supprimée, fenêtre rouverte : la question est à jour.
        check('m1. la croix de la fenêtre', (await b.click(`document.querySelector('[role=dialog].phone-sync__dialog .ui-dialog__close')`)) === 'ok');
        await b.wait(400);
        check('m1. la fenêtre est fermée', (await releve(b)) === null);
        check('m1. rien n\'est supprimé (corbeille vide, douze sessions sur l\'ordinateur)', gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
        retirer(racine, [10]);
        r = await synchroniser(b, 'm1, rouverte');
        // La fenêtre rouverte montre la question restée en attente (10 sessions) sans refaire la comparaison : noté tel quel.
        const rouverte = /retirerait (\d+) sessions/.exec(r.paragraphes?.[0] ?? '')?.[1] ?? null;
        console.log(`  fenêtre rouverte : la question porte sur ${rouverte} sessions (le téléphone en a retiré 11)`);
        check('m1. rouverte, la question est celle de 10 ou de 11 sessions (jamais autre chose)', rouverte === '10' || rouverte === '11', JSON.stringify(r.paragraphes));
        if (rouverte === '10') {
          // Confirmation d'une liste périmée : la question revient avec la liste à jour, rien n'est supprimé.
          check('m1. clic « Supprimer ces 10 sessions » (liste périmée)', (await b.clickText('Supprimer ces 10 sessions', '.phone-sync__actions button')) === 'ok');
          await b.waitFor(`/retirerait 11 sessions/.test(document.querySelector('[role=dialog].phone-sync__dialog .phone-sync__body')?.textContent ?? '')`, { timeout: 40000, label: 'question à jour' });
          await b.wait(300);
          r = await releve(b);
          check('m1. la question revient sur 11 sessions (la liste à jour), avec « Supprimer ces 11 sessions »', JSON.stringify(r.paragraphes) === JSON.stringify([question(11)]) && (r.liste ?? []).length === 11 && (r.boutons ?? []).includes('Supprimer ces 11 sessions'), JSON.stringify([r.paragraphes, r.liste?.length, r.boutons]));
          await b.wait(800);
          check('m1. aucune session n\'a été supprimée sur la foi de l\'ancienne liste (corbeille vide, douze sessions sur l\'ordinateur)', gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
        }
        r = await repondre(b, 'm1, « Supprimer ces 11 sessions »', 'Supprimer ces 11 sessions');
        check('m1. « 11 sessions supprimées sur le téléphone : mises dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "11 sessions supprimées sur le téléphone : mises dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      } else {
        // Fenêtre laissée ouverte, une session de plus supprimée, clic sur la confirmation de dix : la question revient.
        retirer(racine, [10]);
        check('m2. clic « Supprimer ces 10 sessions » alors que la liste a changé', (await b.clickText('Supprimer ces 10 sessions', '.phone-sync__actions button')) === 'ok');
        await b.waitFor(`/retirerait 11 sessions/.test(document.querySelector('[role=dialog].phone-sync__dialog .phone-sync__body')?.textContent ?? '')`, { timeout: 40000, label: 'question à jour' });
        await b.wait(300);
        r = await releve(b);
        console.log(`  après le clic : ${JSON.stringify(r.paragraphes)} ; boutons : ${(r.boutons ?? []).join(' / ')}`);
        check('m2. la question revient, sur 11 sessions (la liste à jour), avec « Supprimer ces 11 sessions »', JSON.stringify(r.paragraphes) === JSON.stringify([question(11)]) && (r.liste ?? []).length === 11 && (r.boutons ?? []).includes('Supprimer ces 11 sessions'), JSON.stringify([r.paragraphes, r.liste?.length, r.boutons]));
        await b.wait(800);
        check('m2. aucune session n\'a été supprimée sur la foi de l\'ancienne liste (corbeille vide, douze sessions sur l\'ordinateur)', gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
        r = await repondre(b, 'm2, « Supprimer ces 11 sessions »', 'Supprimer ces 11 sessions');
        check('m2. « 11 sessions supprimées sur le téléphone : mises dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "11 sessions supprimées sur le téléphone : mises dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      }
      await b.wait(2000);
      check(`${variante}. la corbeille porte onze entrées, une session reste des deux côtés`, corbeilleDe(memoire).entries.length === 11 && gpxsDe(memoire).length === 1 && gpxsDe(racine).length === 1, `${corbeilleDe(memoire).entries.length} ${gpxsDe(memoire).length} ${gpxsDe(racine).length}`);
      await fermerFenetre(b);
    });
  }

  // ---------- k. copie du téléphone rangée à part ----------
  console.log('\n== k. Session supprimée sur l\'ordinateur dont la corbeille ne tient plus la copie : celle du téléphone est rangée à part (origine « telephone »)');
  if (veut('k')) {
    const TOUTES = Array.from({ length: NOMBRE }, (_, k) => k);
    const profil = dossier('k-profil');
    const memoire = fabriquerMemoire('k', TOUTES);
    const tel = fabriquerTelephone('k-tel', TOUTES);
    const racine = racineTel(tel);
    let partie = null;
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'k1', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, 'k1, première synchronisation');
      check('k1. première synchronisation : rien à copier, rien à supprimer', !(r.paragraphes ?? []).some((l) => /copiée|supprim.*(corbeille|retir)/.test(l.replace(/rien n'a été supprimé/, ''))), JSON.stringify(r.paragraphes));
      await fermerFenetre(b);
      const avantGpx = gpxsDe(memoire);
      await supprimerPremiereLigne(b, 'k1');
      await b.waitFor(() => gpxsDe(memoire).length === 11 && corbeilleDe(memoire).entries.length === 1, { timeout: 10000, label: 'session mise à la corbeille' });
      await b.wait(1000);
      partie = avantGpx.find((n) => !gpxsDe(memoire).includes(n));
    });
    // Programme fermé : la corbeille est vidée à la main (comme « Vider la corbeille »), l'ordinateur ne tient plus la copie.
    const cb0 = corbeilleDe(memoire);
    check('k. la session supprimée est à la corbeille avant qu\'on la vide', Boolean(partie) && cb0.entries.length === 1 && cb0.entries[0].main === partie, JSON.stringify(cb0.entries.map((e) => e.main)));
    for (const d of cb0.dirs) rmSync(join(cb0.dir, d), { recursive: true, force: true });
    writeFileSync(join(cb0.dir, 'corbeille.json'), `${JSON.stringify({ ...cb0.index, entries: [] }, null, 2)}\n`);
    check('k. la corbeille est vide sur le disque', corbeilleDe(memoire).entries.length === 0 && corbeilleDe(memoire).dirs.length === 0);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'k2', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, 'k2');
      check('k2. « 1 session supprimée sur l\'ordinateur : retirée du téléphone. »', contientLigne(r, "1 session supprimée sur l'ordinateur : retirée du téléphone."), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      const cb = corbeilleDe(memoire);
      const e = cb.entries[0];
      console.log(`  corbeille : ${(arbre(cb.dir) ?? []).join(' ; ')}`);
      check('k2. le téléphone n\'a plus la session', !existsSync(join(racine, 'sessions', partie)) && !existsSync(join(racine, 'sessions', partie.replace(/\.gpx$/, '.json'))));
      check('k2. la corbeille porte une seule entrée, d\'origine « telephone » (la copie du téléphone, rangée avant le retrait), index en version 2', cb.entries.length === 1 && cb.index?.version === 2 && e?.origin === 'telephone' && e?.kind === 'session' && e?.main === partie, JSON.stringify(cb.index));
      const m = MODELES.find((x) => `${x.nom}.gpx` === partie);
      check('k2. l\'entrée porte le GPX et la fiche du téléphone, le GPX octet pour octet', Boolean(e) && existsSync(join(cb.dir, e.dir, partie)) && existsSync(join(cb.dir, e.dir, partie.replace(/\.gpx$/, '.json'))) && readFileSync(join(cb.dir, e.dir, partie)).equals(readFileSync(m.gpx)), JSON.stringify(e?.files));
      memesSessions('k2', memoire, tel, TOUTES.filter((k) => `${MODELES[k].nom}.gpx` !== partie));
      // La ligne de la liste de la corbeille (Réglages › Mémoire) montre-t-elle cette session ? Elle est tenue pour restaurable.
      await b.go('/parametres?bloc=corbeille', 5000);
      await b.waitFor(`Boolean(document.getElementById('zone-corbeille'))`, { timeout: 8000, label: 'zone de la corbeille' });
      await b.wait(600);
      console.log(`  zone de la corbeille : ${JSON.stringify(await b.evaluate(`document.getElementById('zone-corbeille').innerText.replace(/\\n+/g, ' / ')`))}`);
    });
  }

  // ---------- r. itinéraires ----------
  console.log('\n== r. Itinéraires : première synchronisation, modifié d\'un côté, supprimé de chaque côté, modifié des deux côtés');
  if (veut('r')) {
    const SESSIONS_R = [0, 1, 2];
    const profil = dossier('r-profil');
    const memoire = fabriquerMemoire('r', SESSIONS_R);
    const tel = fabriquerTelephone('r-tel', SESSIONS_R);
    const racine = racineTel(tel);
    // Départ : trois itinéraires de l'ordinateur seul (alpha, bravo, delta), deux du téléphone seul (echo, foxtrot), un commun (charlie).
    for (const cle of ['alpha', 'bravo', 'delta', 'charlie']) poserItineraire(memoire, cle);
    for (const cle of ['echo', 'foxtrot', 'charlie']) poserItineraire(racine, cle);
    const orphelinAvant = empreinte(racine, (c) => c === 'itineraires/parcours-telephone.gpx');
    const lieuxAvant = empreinte(racine, (c) => c === 'lieux.json');
    /** Le GPX seul du téléphone et ses lieux n'ont pas bougé ; rien du téléphone ne vient dans la mémoire. */
    const horsItineraires = (quoi) => {
      check(`${quoi} : le GPX seul du téléphone (sans fiche) et ses lieux sont intacts, et il n'est pas copié sur l'ordinateur`, empreinte(racine, (c) => c === 'itineraires/parcours-telephone.gpx') === orphelinAvant && empreinte(racine, (c) => c === 'lieux.json') === lieuxAvant && !existsSync(join(memoire, 'itineraires', 'parcours-telephone.gpx')) && contient(memoire, MARQUE).length === 0, contient(memoire, MARQUE).join(','));
    };
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'r', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });

      // r1 : première synchronisation, chacun reçoit ce qui lui manque, rien n'est supprimé
      let r = await synchroniser(b, 'r1');
      await capturer(b, 'synchroniser-itineraires');
      check('r1. « Première synchronisation… rien n\'a été supprimé. »', contientLigne(r, "Première synchronisation avec ce téléphone : rien n'a été supprimé."), JSON.stringify(r.paragraphes));
      check('r1. « 3 itinéraires copiés vers le téléphone, 2 vers l\'ordinateur. »', contientLigne(r, "3 itinéraires copiés vers le téléphone, 2 vers l'ordinateur."), JSON.stringify(r.paragraphes));
      check('r1. aucune ligne de suppression ni de corbeille', !(r.paragraphes ?? []).some((l) => /supprim|corbeille/i.test(l) && !/rien n'a été supprimé/.test(l)), JSON.stringify(r.paragraphes));
      check('r1. aucune ligne « attendent le câble » ni « laissé tel quel »', !(r.paragraphes ?? []).some((l) => /attendent le câble|laissés? tels? quels?/.test(l)), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      memesItineraires('r1', memoire, tel, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
      memesSessions('r1', memoire, tel, SESSIONS_R);
      horsItineraires('r1');
      const copies1 = copiesDe(profil);
      check('r1. une seule copie de sécurité', copies1.length === 1, copies1.join(','));
      if (copies1.length === 1) {
        const copie = join(profil, 'Documents-essai', 'Gtracker-copies', copies1[0]);
        console.log(`  copie de sécurité (hors sessions) : ${(arbre(copie) ?? []).filter((c) => !/\/sessions\//.test(c)).join(' ; ')}`);
        check('r1. la copie de sécurité garde l\'état d\'avant des itinéraires des deux appareils (fiche et GPX)', memes(itinerairesDe(join(copie, 'ordinateur')), ITI_PC_AVANT) && memes(itinerairesDe(join(copie, 'telephone')), ITI_TEL_AVANT), `${itinerairesDe(join(copie, 'ordinateur')).join(',')} / ${itinerairesDe(join(copie, 'telephone')).join(',')}`);
      }
      check('r1. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);

      // r2 : second clic
      const empreintePc = empreinte(memoire, (c) => c.startsWith('itineraires/'));
      const empreinteTel = empreinte(racine, (c) => c.startsWith('itineraires/'));
      r = await synchroniser(b, 'r2');
      check('r2. « Les deux appareils sont à jour. » (et rien d\'autre)', JSON.stringify(r.paragraphes) === JSON.stringify(['Les deux appareils sont à jour.']), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      check('r2. les itinéraires des deux appareils n\'ont pas changé (noms, tailles, dates)', empreinte(memoire, (c) => c.startsWith('itineraires/')) === empreintePc && empreinte(racine, (c) => c.startsWith('itineraires/')) === empreinteTel);
      await fermerFenetre(b);

      // r3 : alpha modifié sur le téléphone
      poserItineraire(racine, 'alpha', { note: 'v2-telephone', maj: '2026-09-10T10:00:00.000Z', jour: 20 });
      r = await synchroniser(b, 'r3');
      check('r3. « 1 itinéraire modifié recopié. »', contientLigne(r, '1 itinéraire modifié recopié.'), JSON.stringify(r.paragraphes));
      check('r3. aucune copie, aucune suppression, aucune corbeille', !(r.paragraphes ?? []).some((l) => /copié vers|supprim|corbeille/.test(l)), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r3', memoire, tel, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
      check('r3. la fiche de l\'ordinateur est celle du téléphone (nouvelle date, note v2-telephone)', lireJson(join(memoire, 'itineraires', 'Itin alpha.json'))?.noteBanc === 'v2-telephone' && lireJson(join(memoire, 'itineraires', 'Itin alpha.json'))?.updatedAt === '2026-09-10T10:00:00.000Z');
      check('r3. rien à la corbeille', corbeilleDe(memoire).entries.length === 0);
      await fermerFenetre(b);

      // r4 : bravo modifié sur l'ordinateur
      poserItineraire(memoire, 'bravo', { note: 'v2-ordinateur', maj: '2026-09-11T10:00:00.000Z', jour: 21 });
      r = await synchroniser(b, 'r4');
      check('r4. « 1 itinéraire modifié recopié. »', contientLigne(r, '1 itinéraire modifié recopié.'), JSON.stringify(r.paragraphes));
      check('r4. « Mettre à jour » : le téléphone a été écrit', contientLigne(r, 'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.'), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r4', memoire, tel, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
      check('r4. la fiche du téléphone est celle de l\'ordinateur (note v2-ordinateur)', lireJson(join(racine, 'itineraires', 'Itin bravo.json'))?.noteBanc === 'v2-ordinateur');
      await fermerFenetre(b);

      // r5 : delta supprimé sur le téléphone
      retirerItineraire(racine, 'delta');
      r = await synchroniser(b, 'r5');
      check('r5. « 1 itinéraire supprimé sur le téléphone : mis dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "1 itinéraire supprimé sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r5', memoire, tel, ['alpha', 'bravo', 'charlie', 'echo', 'foxtrot']);
      let cb = corbeilleDe(memoire);
      let e = cb.entries.find((x) => x.kind === 'itineraire' && x.routeBase === 'Itin delta');
      console.log(`  corbeille : ${(arbre(cb.dir) ?? []).join(' ; ')}`);
      check('r5. la corbeille tient delta : entrée « itineraire », origine « ordinateur », sa création, fiche et GPX octet pour octet', cb.index?.version === 2 && cb.entries.length === 1 && Boolean(e) && e.origin === 'ordinateur' && e.createdAt === ITINERAIRES.delta.creation && memes(readdirSync(join(cb.dir, e.dir)), ['Itin delta.json', 'Itin delta.gpx']), JSON.stringify(cb.entries));
      check('r5. l\'index dit sa raison : supprimé', e?.reason === 'supprimee', JSON.stringify(e));
      await fermerFenetre(b);

      // r6 : echo supprimé sur l'ordinateur, depuis la page Itinéraires (la corbeille tient la copie)
      await supprimerItineraireDeLaListe(b, 'Itin echo', 'r6');
      await b.waitFor(() => !itinerairesDe(memoire).some((n) => n.startsWith('Itin echo')) && corbeilleDe(memoire).entries.length === 2, { timeout: 10000, label: 'itinéraire mis à la corbeille' });
      await b.wait(800);
      r = await synchroniser(b, 'r6');
      check('r6. « 1 itinéraire supprimé sur l\'ordinateur : retiré du téléphone. »', contientLigne(r, "1 itinéraire supprimé sur l'ordinateur : retiré du téléphone."), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r6', memoire, tel, ['alpha', 'bravo', 'charlie', 'foxtrot']);
      cb = corbeilleDe(memoire);
      check('r6. la corbeille garde echo une fois (origine « ordinateur », fichiers identiques sur le téléphone : pas de doublon), delta aussi', cb.entries.length === 2 && cb.entries.every((x) => x.origin === 'ordinateur' && x.kind === 'itineraire') && cb.entries.some((x) => x.routeBase === 'Itin echo'), JSON.stringify(cb.entries.map((x) => [x.origin, x.routeBase])));
      await fermerFenetre(b);
    });
    // foxtrot retiré de l'ordinateur par Node, sans corbeille (comme une corbeille vidée à la main) : la copie du téléphone est rangée à part.
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'r7', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      retirerItineraire(memoire, 'foxtrot');
      const octetsTel = readFileSync(join(racine, 'itineraires', 'Itin foxtrot.gpx'));
      let r = await synchroniser(b, 'r7');
      check('r7. « 1 itinéraire supprimé sur l\'ordinateur : retiré du téléphone. »', contientLigne(r, "1 itinéraire supprimé sur l'ordinateur : retiré du téléphone."), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r7', memoire, tel, ['alpha', 'bravo', 'charlie']);
      const cb = corbeilleDe(memoire);
      const e = cb.entries.find((x) => x.routeBase === 'Itin foxtrot');
      console.log(`  corbeille : ${(arbre(cb.dir) ?? []).join(' ; ')}`);
      check('r7. la corbeille porte foxtrot, copie du téléphone rangée avant le retrait (origine « telephone »), son GPX octet pour octet', cb.entries.length === 3 && e?.origin === 'telephone' && e?.kind === 'itineraire' && existsSync(join(cb.dir, e.dir, 'Itin foxtrot.gpx')) && readFileSync(join(cb.dir, e.dir, 'Itin foxtrot.gpx')).equals(octetsTel), JSON.stringify(cb.entries.map((x) => [x.origin, x.routeBase])));
      await fermerFenetre(b);

      // r8 : charlie modifié des deux côtés, la version du téléphone est la plus récente
      poserItineraire(memoire, 'charlie', { note: 'v2-ordinateur', maj: '2026-09-12T09:00:00.000Z', jour: 22 });
      poserItineraire(racine, 'charlie', { note: 'v2-telephone', maj: '2026-09-12T11:00:00.000Z', jour: 23 });
      const perdante = readFileSync(join(memoire, 'itineraires', 'Itin charlie.json'));
      r = await synchroniser(b, 'r8');
      check('r8. « 1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l\'autre est dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      check('r8. pas de ligne « modifié recopié » en plus', !contientLigne(r, '1 itinéraire modifié recopié.'), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('r8', memoire, tel, ['alpha', 'bravo', 'charlie']);
      check('r8. la plus récente (téléphone, v2-telephone) est des deux côtés', lireJson(join(memoire, 'itineraires', 'Itin charlie.json'))?.noteBanc === 'v2-telephone' && lireJson(join(racine, 'itineraires', 'Itin charlie.json'))?.noteBanc === 'v2-telephone');
      const cb2 = corbeilleDe(memoire);
      const perdue = cb2.entries.find((x) => x.routeBase === 'Itin charlie');
      check('r8. la version perdante (celle de l\'ordinateur, v2-ordinateur) est à la corbeille, origine « ordinateur », octet pour octet', cb2.entries.length === 4 && perdue?.origin === 'ordinateur' && perdue?.kind === 'itineraire' && existsSync(join(cb2.dir, perdue.dir, 'Itin charlie.json')) && readFileSync(join(cb2.dir, perdue.dir, 'Itin charlie.json')).equals(perdante), JSON.stringify(cb2.entries.map((x) => [x.origin, x.routeBase])));
      await fermerFenetre(b);

      // r9 : tout est à jour, les sessions n'ont jamais bougé
      r = await synchroniser(b, 'r9');
      check('r9. « Les deux appareils sont à jour. » (et rien d\'autre)', JSON.stringify(r.paragraphes) === JSON.stringify(['Les deux appareils sont à jour.']), JSON.stringify(r.paragraphes));
      memesSessions('r9', memoire, tel, SESSIONS_R);
      horsItineraires('r9');
      check('r9. toujours une seule copie de sécurité', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      await fermerFenetre(b);
    });
  }

  // ---------- rg. garde-fou commun aux sessions et aux itinéraires ----------
  console.log('\n== rg. Garde-fou : des sessions et des itinéraires supprimés sur le téléphone, une seule fenêtre');
  if (veut('rg')) {
    const SESSIONS_G = [0, 1, 2];
    const CLES = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
    const profil = dossier('rg-profil');
    const memoire = fabriquerMemoire('rg', SESSIONS_G);
    const tel = fabriquerTelephone('rg-tel', SESSIONS_G);
    const racine = racineTel(tel);
    for (const cle of CLES) { poserItineraire(memoire, cle); poserItineraire(racine, cle); }
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'rg', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'rg1, première synchronisation');
      check('rg1. rien à copier : les deux appareils portaient les mêmes itinéraires et les mêmes sessions', !(r.paragraphes ?? []).some((l) => /copiés? vers/.test(l)), JSON.stringify(r.paragraphes));
      await b.wait(1500);
      memesItineraires('rg1', memoire, tel, CLES);
      await fermerFenetre(b);

      // Une session et quatre itinéraires supprimés sur le téléphone : plus du quart des deux.
      retirer(racine, [0]);
      for (const cle of ['alpha', 'bravo', 'charlie', 'delta']) retirerItineraire(racine, cle);
      const avantPcItineraires = empreinte(memoire, (c) => c.startsWith('itineraires/'));
      const avantPcSessions = empreinte(join(memoire, 'sessions'));
      const avantTel = empreinte(racine, (c) => c.startsWith('itineraires/') || c.startsWith('sessions/'));
      const TEXTE = "Cette synchronisation retirerait 1 session et 4 itinéraires. Rien n'est encore supprimé.";
      const verifierQuestion = (quoi, rr) => {
        check(`${quoi} : « ${TEXTE} »`, JSON.stringify(rr.paragraphes) === JSON.stringify([TEXTE]), JSON.stringify(rr.paragraphes));
        check(`${quoi} : « Voir les 5 sessions et itinéraires » et cinq lignes dans la liste`, rr.resume === 'Voir les 5 sessions et itinéraires' && (rr.liste ?? []).length === 5, `${rr.resume} / ${(rr.liste ?? []).length}`);
        check(`${quoi} : chaque ligne dit « mise dans la corbeille de l'ordinateur » ou « mis dans… »`, (rr.liste ?? []).every((l) => /mis(e)? dans la corbeille de l'ordinateur/.test(l)), JSON.stringify(rr.liste));
        check(`${quoi} : les trois boutons « Annuler », « Supprimer ces 5 sessions et itinéraires », « Synchroniser sans rien supprimer »`, memes(rr.boutons ?? [], ['Annuler', 'Supprimer ces 5 sessions et itinéraires', 'Synchroniser sans rien supprimer']), (rr.boutons ?? []).join('/'));
      };
      const rienNaBouge = (quoi) => {
        check(`${quoi} : rien n'est supprimé (ordinateur : 3 sessions et 8 itinéraires, corbeille vide)`, empreinte(memoire, (c) => c.startsWith('itineraires/')) === avantPcItineraires && empreinte(join(memoire, 'sessions')) === avantPcSessions && corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
        check(`${quoi} : le téléphone n'a pas changé`, empreinte(racine, (c) => c.startsWith('itineraires/') || c.startsWith('sessions/')) === avantTel);
      };
      r = await synchroniser(b, 'rg2, première question');
      verifierQuestion('rg2', r);
      console.log(`  liste : ${JSON.stringify(r.liste)}`);
      await capturer(b, 'synchroniser-garde-fou-itineraires');
      r = await repondre(b, 'rg2, « Annuler »', 'Annuler');
      console.log(`  après « Annuler » : ${JSON.stringify(r.paragraphes)}`);
      await b.wait(800);
      rienNaBouge('rg2, après « Annuler »');
      await fermerFenetre(b);

      r = await synchroniser(b, 'rg3, seconde question');
      verifierQuestion('rg3', r);
      r = await repondre(b, 'rg3, « Synchroniser sans rien supprimer »', 'Synchroniser sans rien supprimer');
      console.log(`  après « Synchroniser sans rien supprimer » : ${JSON.stringify(r.paragraphes)}`);
      check('rg3. le compte rendu dit les cinq suppressions laissées pour la prochaine fois', (r.paragraphes ?? []).includes('5 suppressions laissées pour une prochaine synchronisation.'), JSON.stringify(r.paragraphes));
      await b.wait(800);
      rienNaBouge('rg3, après « Synchroniser sans rien supprimer »');
      await fermerFenetre(b);

      r = await synchroniser(b, 'rg4, troisième question');
      verifierQuestion('rg4', r);
      r = await repondre(b, 'rg4, « Supprimer ces 5 sessions et itinéraires »', 'Supprimer ces 5 sessions et itinéraires');
      check('rg4. « 1 session supprimée sur le téléphone : mise dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "1 session supprimée sur le téléphone : mise dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      check('rg4. « 4 itinéraires supprimés sur le téléphone : mis dans la corbeille de l\'ordinateur (30 jours). »', contientLigne(r, "4 itinéraires supprimés sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      memesItineraires('rg4', memoire, tel, ['echo', 'foxtrot', 'golf', 'hotel']);
      memesSessions('rg4', memoire, tel, [1, 2]);
      const cb = corbeilleDe(memoire);
      check('rg4. la corbeille porte une session et quatre itinéraires, tous d\'origine « ordinateur », chacun avec sa fiche et son GPX', cb.entries.length === 5 && cb.entries.filter((x) => x.kind === 'itineraire').length === 4 && cb.entries.filter((x) => x.kind === 'session').length === 1 && cb.entries.every((x) => x.origin === 'ordinateur' && existsSync(join(cb.dir, x.dir, x.main)) && (x.files ?? []).length === 2), JSON.stringify(cb.entries.map((x) => [x.kind, x.origin, x.main])));
      check('rg4. une seule copie de sécurité en tout', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      await fermerFenetre(b);
    });
  }

  // ---------- i. coupure ----------
  console.log('\n== i. Téléphone débranché en route, puis reprise');
  const PHONE_I = [0, 1, 2, 3];
  const PC_I = [3, 4, 5, 6, 7];
  const TOUT_I = [0, 1, 2, 3, 4, 5, 6, 7];
  // 4 tombe dans la copie de sécurité (le téléphone liste dix fichiers) ; 24 dans les copies vers l'ordinateur ; 30 dans les
  // écritures vers le téléphone (une fiche reste sous son nom provisoire, que le téléphone écarte) ; au-delà de 35 la synchronisation finit.
  /** Dossier de la copie de sécurité que dit le compte rendu de la reprise, par coupure. */
  const reprises = new Map();
  // 12 tombe juste après la copie de sécurité, avant que rien soit copié : la coupure la plus précoce de la synchronisation.
  // Le câble liste `itineraires/` : le GPX seul du téléphone ajoute une opération à la copie de sécurité, qui finit après 11
  // opérations ; la coupure précoce (12) tombe donc sur l'écriture du marqueur, dont le provisoire reste sur le téléphone
  // (il l'écarte, `horsSessions` ne le compte pas) et que la reprise efface.
  const PRECOCE = Number(process.env.BANC_COUPURE_PRECOCE ?? 12);
  for (const coupure of [4, PRECOCE, 24, 30]) {
    if (!veut('i')) break;
    const dansCopie = coupure < 10;
    const quoi = `i (coupure après ${coupure} opérations${dansCopie ? ', dans la copie de sécurité' : ''})`;
    const profil = dossier(`i${coupure}-profil`);
    const memoire = fabriquerMemoire(`i${coupure}`, PC_I);
    const tel = fabriquerTelephone(`i${coupure}-tel`, PHONE_I);
    const racine = racineTel(tel);
    const avantHors = horsSessions(racine);
    const avantTelEntier = empreinte(tel);
    const avantPc = empreinte(memoire, (c) => c.startsWith('sessions/'));
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_COUPURE: String(coupure) }, quoi, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, quoi);
      if (dansCopie) {
        check(`${quoi} : « La copie de sécurité des deux appareils n'a pas pu être faite (…) : rien n'a été synchronisé. »`, (r.paragraphes ?? []).length === 1 && /^La copie de sécurité des deux appareils n'a pas pu être faite \(.+\) : rien n'a été synchronisé\.$/.test(r.paragraphes[0]), JSON.stringify(r.paragraphes));
      } else {
        check(`${quoi} : « Le téléphone a été débranché pendant la synchronisation. Ce qui est fait est gardé : rebranchez-le… »`, (r.paragraphes ?? []).includes('Le téléphone a été débranché pendant la synchronisation. Ce qui est fait est gardé : rebranchez-le, puis cliquez sur « Réessayer » pour finir.'), JSON.stringify(r.paragraphes));
      }
      check(`${quoi} : « Réessayer » offert`, (r.boutons ?? []).join('/') === 'Réessayer/Fermer', (r.boutons ?? []).join('/'));
      await b.wait(1500);
    });
    const copies = copiesDe(profil);
    console.log(`  copies de sécurité : ${copies.join(' ; ') || '(aucune)'}`);
    if (dansCopie) {
      check(`${quoi} : la copie interrompue est gardée sous un nom qui le dit (« incomplète »)`, copies.length === 1 && /incomplète$/.test(copies[0]), copies.join(','));
      check(`${quoi} : rien n'a été synchronisé : sessions de l'ordinateur et téléphone inchangés (marqueurs sans identifiant, ni base, ni corbeille)`, empreinte(memoire, (c) => c.startsWith('sessions/')) === avantPc && empreinte(tel) === avantTelEntier && !existsSync(join(memoire, 'synchro')) && !existsSync(join(memoire, 'corbeille')) && !('id' in (lireJson(join(racine, 'gtracker.json')) ?? {})) && !('id' in (lireJson(join(memoire, 'gtracker.json')) ?? {})), (arbre(memoire) ?? []).join(','));
    } else {
      console.log(`  sur l'ordinateur : ${gpxsDe(memoire).length} GPX, ${fichesDe(memoire).length} fiches ; sur le téléphone : ${gpxsDe(racine).length} GPX, ${fichesDe(racine).length} fiches ; téléphone, fichiers provisoires : ${temporaires(racine).join(',') || '(aucun)'}`);
      check(`${quoi} : aucune moitié de session sur l'ordinateur (autant de fiches que de GPX, aucun temporaire)`, fichesDe(memoire).length === gpxsDe(memoire).length && temporaires(memoire).length === 0, `${fichesDe(memoire).length}/${gpxsDe(memoire).length} ${temporaires(memoire).join(',')}`);
      for (const g of gpxsDe(racine)) check(`${quoi} : sur le téléphone, « ${g} » est entier (GPX et fiche présents, GPX d'une session connue)`, fichesDe(racine).includes(g.replace(/\.gpx$/, '.json')) && MODELES.some((m) => `${m.nom}.gpx` === g && readFileSync(join(racine, 'sessions', g)).equals(readFileSync(m.gpx))), g);
      check(`${quoi} : rien du téléphone n'est copié dans la mémoire`, contient(memoire, MARQUE).length === 0, contient(memoire, MARQUE).join(','));
      gardeHorsSessions(quoi, racine, avantHors);
    }
    // Relance sans coupure : le tout est fini.
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, `${quoi}, reprise`, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, `${quoi}, reprise`);
      check(`${quoi}, reprise : le compte rendu ne parle d'aucun arrêt (pas de « Réessayer »)`, (r.boutons ?? []).join('/') === 'Fermer', (r.boutons ?? []).join('/'));
      check(`${quoi}, reprise : aucune suppression, aucune question`, !(r.paragraphes ?? []).some((l) => /supprim.*(corbeille|retir)/.test(l)) && (r.paragraphes ?? []).length > 0, JSON.stringify(r.paragraphes));
      reprises.set(coupure, r.dossier ?? null);
      const reprise = (r.paragraphes ?? []).includes("La synchronisation précédente avait été coupée : elle a repris là où elle s'était arrêtée.");
      console.log(`  la fenêtre dit-elle que la synchronisation précédente avait été coupée ? ${reprise ? 'oui' : 'non'}`);
      await b.wait(2000);
    });
    memesSessions(`${quoi}, reprise`, memoire, tel, TOUT_I);
    check(`${quoi}, reprise : rien n'est allé à la corbeille`, corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
    check(`${quoi}, reprise : la base de la paire est là, sans témoin d'interruption`, existsSync(join(memoire, 'synchro')) && !existsSync(join(memoire, 'synchro', 'en-cours.json')), (arbre(join(memoire, 'synchro')) ?? []).join(','));
    console.log(`  copies de sécurité après la reprise : ${copiesDe(profil).join(' ; ')}`);
    const datees = copiesDe(profil).filter((c) => !/incomplète$/.test(c));
    if (dansCopie) {
      check(`${quoi}, reprise : une copie de sécurité entière est faite (la précédente restant « incomplète »)`, datees.length === 1 && copiesDe(profil).length === 2, copiesDe(profil).join(' ; '));
    } else {
      check(`${quoi}, reprise : la reprise ne refait pas de copie de sécurité (un seul dossier daté)`, datees.length === 1 && copiesDe(profil).length === 1, copiesDe(profil).join(' ; '));
    }
    const dossierReprise = reprises.get(coupure) ?? null;
    const dossierCopie = datees.length === 1 ? join(profil, 'Documents-essai', 'Gtracker-copies', datees[0]) : null;
    if (coupure === PRECOCE) {
      // Coupure précoce : rien n'est encore copié, la reprise refait toute la synchronisation sans nouvelle copie et la dit.
      check(`${quoi}, reprise : le compte rendu redonne le dossier de la copie de sécurité déjà faite`, dossierCopie !== null && dossierReprise?.toLowerCase() === dossierCopie.toLowerCase(), `${dossierReprise} / ${datees.join(',')}`);
    } else if (!dansCopie) {
      // Plus tard dans la synchronisation (copies déjà commencées), la reprise ne redonne pas le dossier : noté, sans verdict.
      console.log(`  la reprise redonne-t-elle le dossier de la copie de sécurité ? ${dossierReprise === null ? 'non' : 'oui'}`);
    }
    gardeHorsSessions(`${quoi}, reprise`, racine, avantHors);
  }
} catch (e) {
  check(`script interrompu : ${e.stack ?? e.message}`, false);
} finally {
  // Un programme resté ouvert par une erreur : seuls ceux que ce script a lancés sont tués.
  for (const pid of lances) if (vivant(pid)) spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  await pause(800);
  rmSync(RACINE, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
}

console.log(echecs === 0 ? '\nTout passe.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);

/** L'heure de départ d'un modèle, telle que la liste de la corbeille la montre (« 10:00 »), pour retrouver sa ligne. */
function heureTexte(k) {
  const d = new Date(Date.UTC(2026, 9, jourDe(k), heureDe(k), 0, 0));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** L'ordinateur porte `restantes` ; le téléphone porte encore `surTel`. */
function memesSessionsPartielles(quoi, memoire, racineTelephone, restantes, surTel) {
  const pc = gpxsDe(memoire).map((n) => n.replace(/\.gpx$/, ''));
  check(`${quoi} : l'ordinateur ne porte que les sessions non supprimées`, memes(pc, nomsDe(restantes)), pc.join(' | '));
  const tel = gpxsDe(racineTelephone).map((n) => n.replace(/\.gpx$/, ''));
  check(`${quoi} : le téléphone n'a pas changé`, memes(tel, nomsDe(surTel)), tel.join(' | '));
}
