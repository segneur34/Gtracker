// Banc de test : le bouton « Synchroniser » du programme Windows, face à un faux téléphone (un dossier local qui s'écrit).
// Usage : node exe-synchroniser.mjs <Gtracker.exe> [<port de débogage>] [--sansfil]
// `--sansfil` rejoue les cas c (qui couvre c, d, e, f), g, h, m, n, r et rg avec les mêmes contrôles, mais le téléphone est le
// faux téléphone de la liaison sans câble (`bureau/fauxTelephone.ts`, à jour : il écrit et efface), relié au programme par le
// Wi-Fi (127.0.0.1, port fixe, code lu sur la page) au lieu du dossier-téléphone du câble : le même moteur de synchronisation
// sert les deux canaux. Les cas a, b, k, p, w et i parlent du câble (états de adb, téléphone qui apparaît, coupure par
// opérations, copies de sécurité d'une paire neuve par le dossier-téléphone) et ne se rejouent pas ; les attentes du Wi-Fi
// (téléphone connu mais pas là, liaison coupée puis reprise) sont rejouées par `exe-sansfil.mjs`.
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille (`GTRACKER_BANC=1`),
// sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le profil du vrai
// programme, jamais un vrai téléphone (en mode d'essai le vrai adb n'est jamais lancé). Le téléphone factice est un dossier
// qui joue le `/sdcard` (`GTRACKER_BANC_TELEPHONE`), lu et écrit comme par le câble ; l'état imposé
// (`GTRACKER_BANC_TELEPHONE_ETAT`) et la coupure après n opérations (`GTRACKER_BANC_TELEPHONE_COUPURE`) se règlent par
// l'environnement. Les copies de sécurité vont sous `GTRACKER_DOCUMENTS` (un dossier du profil d'essai). Les sessions sont
// synthétiques (`lib/traces.mjs`) et passent d'abord par le programme, qui écrit leurs vraies fiches ; le disque se lit par
// Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG de la fenêtre : écran de départ (`synchroniser-depart`,
// `synchroniser-depart-dossier-choisi`), compte rendu (`-compte-rendu`, `-compte-rendu-deplie`), question (garde-fou, corbeille,
// nombres par appareil), attente (`synchroniser-attente`, `synchroniser-aucun-telephone`).
// La fenêtre se lit par ses pièces (titre, sous-titre, phrases, lignes dépliables, encadrés, boutons : `releve`) ; `suivre`
// attend une fenêtre à boutons qui n'attend pas, et clique « Commencer » devant l'écran de départ d'une première synchronisation
// (il en garde le relevé). Aucun mot d'avant la remise à plat ne doit plus s'afficher (`MOTS_ANCIENS`), contrôlé à chaque issue.
// Cas :
//  a. chaque état imposé : absent et adbIntrouvable (l'outil du câble est traité comme absent : jamais une chose à faire) disent
//     « Aucun téléphone relié » (« Fermer », « Relier mon téléphone » qui mène à Réglages › Connexion, fenêtre du code) ;
//     autorisation, horsLigne et occupe mettent la fenêtre en attente (« Annuler » seul, ni « Réessayer », ni câble expliqué,
//     ni dossier à recopier) ; rien de rangé, rien de copié, téléphone intact ;
//  b. téléphone sans dossier Documents/Gtracker : « Gtracker n'a pas encore de mémoire sur ce téléphone… », « Recommencer » ;
//  c. première synchronisation : l'écran de départ (téléphone et moyen, dossier de la copie, « Choisir un autre dossier » et
//     « Commencer »), l'avancement en fichiers, puis le compte rendu rangé par geste (« Reçu du téléphone : 3 sessions »,
//     « Envoyé au téléphone : 4 sessions », chaque ligne se dépliant en noms), « Première synchronisation : rien n'a été
//     supprimé. », « Copie de sécurité : » et son dossier avec « Ouvrir le dossier » (en essai, seulement journalisé) ;
//     chaque appareil reçoit ce qui lui manque, la copie de sécurité des deux appareils (dossier `Gtracker-copies` de
//     Documents) porte l'état d'avant ; identifiants posés, base écrite ; le sans-fil et les fichiers de lieux et
//     d'itinéraires du téléphone ne sont ni copiés ni changés ;
//  d. second clic : « Tout est à jour », « Rien à échanger… », rien ne change, ni écran de départ, ni seconde copie ;
//  e. une session supprimée sur le téléphone : « Supprimé : 1 session supprimée sur le téléphone : elle est dans la corbeille de
//     l'ordinateur pour 30 jours », sans question (version 2 de l'index, origine « ordinateur ») ;
//  f. une session supprimée sur l'ordinateur : « Supprimé : … retirée du téléphone : elle reste 30 jours dans la corbeille » ;
//     puis restaurée par Réglages › Mémoire : « Restauré : 1 session sortie de la corbeille : renvoyée au téléphone » ;
//     (c : le marqueur du téléphone porte aussi un champ `synchro`, un instant, et un compteur `passage` (1), les autres champs
//     gardés ; d : `synchro` inchangé quand rien n'a changé sur le téléphone, `passage` augmenté d'un à chaque synchronisation ;
//     f : `synchro` plus récent après un retrait) ;
//  o. une copie ancienne du dossier du téléphone remise (marqueur à un passage en retard sur celui de l'ordinateur) alors qu'une
//     session a été supprimée sur l'ordinateur depuis : traitée comme un nouveau téléphone (écran de départ, identifiant neuf,
//     « Le dossier du téléphone est une copie plus ancienne… rien n'a été supprimé… »), la session revient sur l'ordinateur, la
//     corbeille reste vide ;
//  v. le nom de deux sessions changé des deux côtés (la fiche porte `editedAt.name`) : le dernier saisi l'emporte des deux côtés
//     (téléphone pour l'une, ordinateur pour l'autre), l'encadré dit qu'une version plus ancienne a été remplacée, rien à la corbeille ;
//  g. sessions déjà à la corbeille de l'ordinateur et encore sur le téléphone à la première synchronisation : la question de la
//     corbeille (titre, phrase, noms, « Les garder » / « Les retirer du téléphone », au singulier « La garder » / « La retirer »),
//     fermée par la croix (le compte rendu la rappelle, « Répondre » la rouvre) puis « Les retirer » (g1 à g4 ; g3 : trois
//     sessions, le retrait dépasse le quart et rouvre la question du garde-fou) ou « Les garder » (g5 : « Gardé », la corbeille se
//     réduit à rien, la question ne revient pas) ; la corbeille ne tient qu'une entrée (origine « ordinateur ») par session
//     retirée quand ses fichiers sont identiques (« Corbeille : 2 sessions »), deux entrées quand la fiche a changé (g4) ;
//  h. garde-fou : onze sessions supprimées sur le téléphone, la question rangée par appareil (« Sur le téléphone : 11 sessions
//     supprimées », noms dépliés), deux réponses seulement : croix puis « Répondre », « Tout garder » (« Gardé », les onze
//     reviennent sur le téléphone, la question ne revient pas), « Supprimer des deux côtés » (« Supprimé », onze à la corbeille) ;
//  m. une confirmation ne vaut que pour les sessions montrées : question sur 10, puis une onzième supprimée sur le téléphone ;
//     m1 : croix puis « Répondre » (la question d'avant), m2 : fenêtre laissée ouverte, m3 : fenêtre fermée puis rouverte (question
//     neuve) ; la confirmation d'une liste périmée ramène la question sur 11, rien n'est supprimé sur la foi de l'ancienne liste ;
//  n. nombres par appareil : deux supprimées sur l'ordinateur, une de plus (trois, pas cinq), une sur le téléphone (deux lignes
//     « Sur le téléphone : 1 », « Sur l'ordinateur : 3 », jamais 4), « Tout garder », puis deux sur le téléphone et « Supprimer
//     des deux côtés » ; ensuite « Tout est à jour » ;
//  w. téléphone absent : « Aucun téléphone relié », sans mot de câble ; le téléphone apparaît (le dossier-téléphone est posé
//     pendant l'attente) : la synchronisation part seule, écran de départ, compte rendu ; le journal dit l'attente et sa fin ;
//     (le changement d'état imposé pendant l'attente n'existe pas : l'état est fixé au lancement ; l'arrivée passe par le dossier) ;
//  p. écran de départ : un dossier choisi dans la mémoire est refusé (phrase en clair), fermer l'écran arrête tout (rien de
//     copié, rien d'écrit), « Synchroniser » le ramène ; un dossier hors de la mémoire est montré, retenu par le programme
//     (copies.json du profil, jamais la mémoire), reçoit la copie ; « Ouvrir le dossier » (journalisé seulement) ;
//  i. coupure : le téléphone s'en va pour de bon (dans la copie de sécurité, juste après elle, puis en pleine synchronisation,
//     deux fois) : la fenêtre attend son retour (« Annuler » seul), « Annuler » dit ce qui est fait (« Synchronisation arrêtée »,
//     « Recommencer ») ou ferme sans compte rendu quand rien n'était fait ; relancé sans coupure, le tout est fini, rien n'est
//     rangé à moitié, aucun temporaire des deux côtés ; la coupure précoce (12) ne refait pas de copie ;
//  r. itinéraires (fiches de `planning/routeRecord.ts` dans `itineraires/`, des deux côtés) : première synchronisation (« Reçu :
//     2 itinéraires », « Envoyé : 3 itinéraires », rien de supprimé, la copie de sécurité garde l'état d'avant), second clic,
//     modifié sur le téléphone puis sur l'ordinateur (« Modifié : 1 itinéraire, recopié sur l'autre appareil », octets
//     identiques), supprimé sur le téléphone (corbeille de l'ordinateur), supprimé sur l'ordinateur par la page Itinéraires
//     (retiré du téléphone) puis par Node sans corbeille (copie du téléphone rangée à part, origine « telephone »), modifié des
//     deux côtés (encadré : le plus récent gagne, l'autre à la corbeille) ; le GPX seul du téléphone et ses lieux ne bougent jamais ;
//  rg. garde-fou commun : une session et quatre itinéraires supprimés sur le téléphone, une seule ligne « 1 session, 4 itinéraires
//     supprimés » (jamais additionnés), les deux réponses jouées ;
//  j. dans tous les cas, la console de la page sans erreur.
// `BANC_CAS=c,g,m,i` (facultatif) ne joue que ces cas (a, b, c pour c à f, g, h, m, n, w, p, k, r, rg, i) ; sans lui, tous.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
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
/** `BANC_CAS=g,i` (facultatif) : ne joue que ces cas (a, b, c pour c à f, g, h, m, n, o, v, w, p, k, r, rg, i) ; sans lui, tous (en `--sansfil`, c, g, h, m, n, o, r, rg, v). */
const CAS = process.env.BANC_CAS ? process.env.BANC_CAS.split(',').map((c) => c.trim()) : SANSFIL ? ['c', 'g', 'h', 'm', 'n', 'o', 'r', 'rg', 'v'] : null;
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

/** Marqueur de l'ordinateur sans son identifiant d'appareil (`appareil`, que le programme y écrit au lancement). */
const sansAppareil = (texte) => { const m = JSON.parse(texte); delete m.appareil; return JSON.stringify(m); };
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
 * Relie le faux téléphone à l'instance : première fois, par le code lu sur la page (Réglages › Connexion, « Relier un
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
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Connexion')`, { timeout: 8000, label: 'bloc Connexion' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.wireless-card'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Connexion')`);
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
/**
 * Ce que la fenêtre dit : titre et sous-titre, phrases du corps (hors encadrés, détails et conseils), encadrés, détails
 * repliés, conseils, dossier, lignes dépliables (geste, texte, noms, ouverte ou non), liste simple de noms, étapes
 * « Sur le téléphone », boutons de la rangée du bas et du corps, et tout le texte (pliés compris) pour les mots interdits.
 */
const releve = (b) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(DIALOGUE)});
  if (!d) return null;
  const texte = (x) => x.textContent.trim().replace(/\\s+/g, ' ');
  return {
    titre: d.getAttribute('aria-label'),
    sousTitre: [...d.querySelectorAll('.phone-sync__subtitle')].map(texte)[0] ?? null,
    paragraphes: [...d.querySelectorAll('.phone-sync__body p')].filter((p) => !p.closest('.phone-sync__note, .phone-sync__detail') && !p.classList.contains('phone-sync__hint')).map(texte),
    notes: [...d.querySelectorAll('.phone-sync__note > p')].map(texte),
    details: [...d.querySelectorAll('.phone-sync__detail p')].map(texte),
    conseils: [...d.querySelectorAll('.phone-sync__hint')].map(texte),
    dossier: [...d.querySelectorAll('code.phone-sync__folder')].map(texte)[0] ?? null,
    lignes: [...d.querySelectorAll('.phone-sync__row')].map((x) => ({ geste: texte(x.querySelector('.phone-sync__row-label')), texte: texte(x.querySelector('.phone-sync__row-text')), noms: [...x.querySelectorAll('.phone-sync__names li')].map(texte), ouverte: x.open })),
    noms: [...d.querySelectorAll('.phone-sync__names--list li')].map(texte),
    etapes: [...d.querySelectorAll('.phone-sync__steps li')].map(texte),
    boutons: [...d.querySelectorAll('.phone-sync__actions button')].map(texte),
    boutonsCorps: [...d.querySelectorAll('.phone-sync__body button')].map(texte),
    tout: d.textContent.replace(/\\s+/g, ' '),
  };
})()`);
/** Mots d'avant la remise à plat : aucun ne doit plus s'afficher (ni le câble expliqué, ni les anciens boutons et phrases). */
const MOTS_ANCIENS = /Mettre à jour|Les deux appareils sont à jour|copiées? vers|mise dans la corbeille|mis dans la corbeille|retirée? du téléphone\.|suppressions? laissées?|fichiers? de réglages?|attendent le câble|Débogage USB|outil gratuit|SDK Platform-Tools|platform-tools|Autoriser le débogage|Aucun téléphone n'est vu|Synchroniser sans rien supprimer|Les laisser|La laisser|Voir les \d+|retirerait|Retirer du téléphone|Annuler la synchronisation/;
const aucunMotAncien = (quoi, r) => check(`${quoi} : aucun mot d'avant la remise à plat (Mettre à jour, copiées vers, Débogage USB, retirerait…)`, !MOTS_ANCIENS.test(r?.tout ?? ''), (MOTS_ANCIENS.exec(r?.tout ?? '') ?? [])[0]);
/** La ligne du compte rendu qui porte ce geste (la `n`-ième s'il y en a plusieurs). */
const ligneDe = (r, geste, n = 0) => (r?.lignes ?? []).filter((l) => l.geste === geste)[n] ?? null;
/** Phrases d'une synchronisation qui n'est pas finie (le titre dit « Synchronisation en cours », le corps dit l'étape). */
const EN_COURS = /Recherche du téléphone…|Comparaison des deux appareils…|Copie de sécurité des deux mémoires|Échange des sessions et des itinéraires|L'ordinateur finit de mettre à jour/;
/** Titres de la fenêtre qui attend un téléphone ou l'ordinateur : elle n'est pas finie, elle repart seule. */
const TITRES_ATTENTE = ['En attente de votre téléphone', 'Synchronisation en attente'];
/**
 * Attend l'issue de la synchronisation, relève la fenêtre et note les étapes vues en route. L'issue : une fenêtre à boutons
 * qui n'attend pas (compte rendu, question, « Aucun téléphone relié »). `attente: true` : l'attente elle-même est l'issue
 * voulue. Devant l'écran de départ d'une première synchronisation, le relevé est gardé (`depart`) puis « Commencer » est
 * cliqué, sauf `depart: 'rester'` (l'écran de départ est alors l'issue).
 */
async function suivre(b, quoi, { attente = false, depart = 'commencer', delaiMs = 40000, captureDepart = null } = {}) {
  const vus = [];
  let ecranDepart = null;
  const fin = Date.now() + delaiMs;
  let r = null;
  while (Date.now() < fin) {
    r = await releve(b);
    for (const l of r?.paragraphes ?? []) if (EN_COURS.test(l) && !vus.includes(l)) vus.push(l);
    if (r && r.boutons.length > 0) {
      if (/^Première synchronisation avec /.test(r.titre ?? '')) {
        if (ecranDepart === null) { ecranDepart = r; if (captureDepart) await capturer(b, captureDepart); console.log(`  écran de départ : « ${r.titre} » ; ${r.sousTitre} ; ${r.paragraphes.join(' | ')} ; dossier ${r.dossier} ; boutons ${r.boutons.join(' / ')}`); }
        if (depart === 'rester') break;
        if (!(r.boutons.includes('Commencer'))) break;
        await b.clickText('Commencer', '.phone-sync__actions button');
        await b.wait(100);
        continue;
      }
      if (TITRES_ATTENTE.includes(r.titre) && !attente) { await b.wait(25); continue; }
      break;
    }
    await b.wait(25);
  }
  await b.wait(300);
  r = await releve(b);
  console.log(`  étapes vues : ${vus.join(' | ') || '(aucune)'}`);
  console.log(`  fenêtre « ${r?.titre} »${r?.sousTitre ? ` (${r.sousTitre})` : ''} :`);
  for (const l of r?.paragraphes ?? []) console.log(`    | ${l}`);
  for (const l of r?.lignes ?? []) console.log(`    ligne ${l.geste} : ${l.texte}${l.noms.length ? ` — ${l.noms.join(' ; ')}` : ''}`);
  for (const l of r?.noms ?? []) console.log(`    nom : ${l}`);
  for (const l of r?.etapes ?? []) console.log(`    étape : ${l}`);
  for (const l of r?.notes ?? []) console.log(`    encadré : ${l}`);
  for (const l of r?.conseils ?? []) console.log(`    conseil : ${l}`);
  if (r?.dossier) console.log(`    dossier : ${r.dossier}`);
  console.log(`    boutons : ${(r?.boutons ?? []).join(' / ')}${r?.boutonsCorps?.length ? ` ; dans le corps : ${r.boutonsCorps.join(' / ')}` : ''}`);
  check(`${quoi} : l'issue est arrivée (fenêtre à boutons, plus d'étape en cours)`, Boolean(r) && (r.boutons ?? []).length > 0 && !(r.paragraphes ?? []).some((l) => EN_COURS.test(l)), JSON.stringify([r?.titre, r?.paragraphes, r?.boutons]));
  aucunMotAncien(quoi, r);
  return { ...r, vus, depart: ecranDepart };
}
/** Clique « Synchroniser » (barre du haut) et attend l'issue. */
async function synchroniser(b, quoi, options) {
  check(`${quoi} : le bouton « Synchroniser » est dans la barre du haut`, (await b.evaluate(`document.querySelector(${JSON.stringify(SELECTEUR_BOUTON)})?.textContent.trim() ?? null`)) === 'Synchroniser');
  check(`${quoi} : clic « Synchroniser »`, (await b.click(SELECTEUR_BOUTON)) === 'ok');
  await b.wait(200);
  return suivre(b, quoi, options);
}
/** Clique un bouton de la fenêtre et attend l'issue qui suit. */
async function repondre(b, quoi, bouton, options) {
  check(`${quoi} : clic « ${bouton} »`, (await b.clickText(bouton, '.phone-sync__actions button')) === 'ok');
  await b.wait(200);
  return suivre(b, quoi, options);
}
/** La croix de la fenêtre (sur une question, elle ne décide rien et mène au compte rendu ; ailleurs, elle ferme). */
const fermerFenetreParLaCroix = async (b) => { await b.click(`document.querySelector('[role=dialog].phone-sync__dialog .ui-dialog__close')`); await b.wait(400); };
/**
 * La question du garde-fou pour `n` sessions supprimées sur `cote` : titre, phrase d'en-tête, une ligne par appareil (dépliée
 * sur les noms), la phrase qui demande, deux réponses, le conseil.
 */
const verifierQuestionGarde = (quoi, rr, n, cote = 'Sur le téléphone') => {
  const nombre = n === 1 ? '1 session supprimée' : `${n} sessions supprimées`;
  const demande = `${n === 1 ? "Faut-il la supprimer aussi de l'autre appareil ?" : "Faut-il les supprimer aussi de l'autre appareil ?"} Rien n'est perdu : tout reste 30 jours dans la corbeille de l'ordinateur.`;
  check(`${quoi} : « ${n === 1 ? 'Une suppression à confirmer' : "Beaucoup de suppressions d'un coup"} », « Depuis la dernière synchronisation : », puis « ${demande} »`, rr.titre === (n === 1 ? 'Une suppression à confirmer' : "Beaucoup de suppressions d'un coup") && JSON.stringify(rr.paragraphes) === JSON.stringify(['Depuis la dernière synchronisation :', demande]), JSON.stringify([rr.titre, rr.paragraphes]));
  check(`${quoi} : une seule ligne « ${cote} : ${nombre} », dépliée sur ses ${n} noms`, JSON.stringify(rr.lignes.map((l) => [l.geste, l.texte, l.noms.length, l.ouverte])) === JSON.stringify([[cote, nombre, n, true]]), JSON.stringify(rr.lignes));
  check(`${quoi} : deux réponses seulement, « Tout garder » et « Supprimer des deux côtés »`, (rr.boutons ?? []).join('/') === 'Tout garder/Supprimer des deux côtés', (rr.boutons ?? []).join('/'));
  check(`${quoi} : le conseil dit que « Tout garder » remet chaque session là où elle manque, et que fermer ne décide rien`, JSON.stringify(rr.conseils) === JSON.stringify(['« Tout garder » remet chaque session là où elle manque. Fermer la fenêtre ne décide rien : la question reviendra.']), JSON.stringify(rr.conseils));
  check(`${quoi} : ni « retirerait », ni liste à déplier « Voir les… », ni total additionné`, !/retirerait|Voir les/.test(rr.tout ?? ''), rr.tout);
};
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
/** Les lignes du journal daté du profil (`journal.txt`) qui viennent de la fenêtre « Synchroniser » (`page : Synchroniser : …`), sans l'heure. */
const journalDeLaFenetre = (profil) => {
  const f = join(profil, 'journal.txt');
  return existsSync(f) ? readFileSync(f, 'utf8').split(/\r?\n/).map((l) => /page : (Synchroniser : .*)$/.exec(l)?.[1]).filter(Boolean) : [];
};
/** Les copies de sécurité sous Documents du profil d'essai : leurs dossiers. */
const copiesDe = (profil) => { const d = join(profil, 'Documents-essai', 'Gtracker-copies'); return existsSync(d) ? readdirSync(d).sort() : []; };

/** Aucun téléphone jamais relié (le câble absent, l'outil du câble introuvable) : la fenêtre ne conseille pas le câble, elle mène au code. */
const AUCUN_TELEPHONE = {
  titre: 'Aucun téléphone relié',
  paragraphes: ['Cet ordinateur ne connaît encore aucun téléphone. Cela se fait une fois, en tapant un code sur le téléphone.'],
  boutons: 'Fermer/Relier mon téléphone',
};
/**
 * Ce que dit la fenêtre pour chaque état imposé du câble. Les états du câble qui attendent (autorisation, sans réponse,
 * tenu par un autre programme) mettent la fenêtre en attente, « Annuler » seul ; l'absent et l'outil introuvable (qui est
 * traité comme absent : le câble n'est pas une chose à faire) ne connaissent aucun téléphone, jamais relié.
 */
const ETATS = {
  absent: AUCUN_TELEPHONE,
  adbIntrouvable: AUCUN_TELEPHONE,
  autorisation: {
    titre: 'En attente de votre téléphone',
    paragraphes: ['Le téléphone branché demande une autorisation : sur son écran, cochez « Toujours autoriser cet ordinateur » et touchez « Autoriser ». La synchronisation démarre ensuite toute seule.'],
    boutons: 'Annuler',
  },
  horsLigne: {
    titre: 'En attente de votre téléphone',
    paragraphes: ['Le téléphone est branché mais ne répond pas. Déverrouillez son écran, puis débranchez et rebranchez le câble.', "La synchronisation démarre toute seule dès qu'il est là."],
    boutons: 'Annuler',
  },
  occupe: {
    titre: 'En attente de votre téléphone',
    paragraphes: ['Un autre programme tient le câble du téléphone. Fermez-le, ou débranchez le câble pour passer par le Wi-Fi.', "La synchronisation démarre toute seule dès qu'il est là."],
    boutons: 'Annuler',
  },
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
  console.log('\n== a. Chaque état imposé : la fenêtre attend ou dit qu\'aucun téléphone n\'est relié, sans « Réessayer » ni câble expliqué, rien de rangé ni de copié');
  for (const [etat, attendu] of Object.entries(ETATS)) {
    if (!veut('a')) break;
    const profil = dossier(`a-${etat}-profil`);
    const memoire = fabriquerMemoire(`a-${etat}`, [4, 5]);
    const tel = fabriquerTelephone(`a-${etat}-tel`, [0, 1]);
    const avantTel = empreinte(tel);
    const avantPc = empreinte(memoire, (c) => c.startsWith('sessions/'));
    const attend = attendu.boutons === 'Annuler';
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_ETAT: etat }, `a. ${etat}`, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await synchroniser(b, `a. ${etat}`, { attente: attend });
      check(`a. ${etat} : le titre « ${attendu.titre} »`, r.titre === attendu.titre, r.titre);
      check(`a. ${etat} : le texte, en entier`, JSON.stringify(r.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify(r.paragraphes));
      check(`a. ${etat} : les boutons « ${attendu.boutons} » (jamais « Réessayer »)`, (r.boutons ?? []).join('/') === attendu.boutons && !/Réessayer/.test(r.tout), (r.boutons ?? []).join('/'));
      check(`a. ${etat} : pas de dossier à recopier, pas de « Sur le téléphone : » (le câble ni le Wi-Fi ne sont expliqués ici)`, r.dossier === null && r.etapes.length === 0 && !/Sur le téléphone/.test(r.tout) && !/câble USB|Débogage/.test(r.tout), JSON.stringify([r.dossier, r.etapes]));
      if (etat === 'absent') await capturer(b, 'synchroniser-aucun-telephone');
      if (etat === 'autorisation') await capturer(b, 'synchroniser-attente');
      // La fenêtre attend sans rien dire de plus : relevé trois secondes plus tard (un relevé de l'attente), elle dit la même chose.
      await b.wait(3500);
      const r2 = await releve(b);
      check(`a. ${etat} : trois secondes plus tard, la même fenêtre (attente ou rien relié), sans erreur`, r2?.titre === attendu.titre && JSON.stringify(r2.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify([r2?.titre, r2?.paragraphes]));
      if (attend) {
        check(`a. ${etat} : « Annuler » ferme la fenêtre`, (await b.clickText('Annuler', '.phone-sync__actions button')) === 'ok');
        await b.wait(500);
        check(`a. ${etat} : la fenêtre est fermée`, (await releve(b)) === null);
      } else if (etat === 'absent') {
        // « Relier mon téléphone » mène à Réglages › Connexion, fenêtre du code ouverte (adresse ?bloc=relier).
        check('a. absent : « Relier mon téléphone »', (await b.clickText('Relier mon téléphone', '.phone-sync__actions button')) === 'ok');
        await b.wait(1200);
        const adresse = await b.evaluate('location.pathname + location.search');
        check('a. absent : la page est Réglages › Connexion, fenêtre du code (…/parametres?bloc=relier) et la fenêtre de synchronisation est fermée', /\/parametres\?bloc=relier/.test(adresse) && (await releve(b)) === null, adresse);
      } else {
        check(`a. ${etat} : « Fermer » ferme la fenêtre`, (await b.clickText('Fermer', '.phone-sync__actions button')) === 'ok');
        await b.wait(400);
        check(`a. ${etat} : la fenêtre est fermée`, (await releve(b)) === null);
      }
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
      const attendu = ["Gtracker n'a pas encore de mémoire sur ce téléphone. Ouvrez-le une fois sur le téléphone et choisissez son dossier, puis revenez ici."];
      check('b. « Synchronisation impossible »', r.titre === 'Synchronisation impossible', r.titre);
      check('b. le message du dossier absent, en entier (dit quoi faire, sans « marqueur »)', JSON.stringify(r.paragraphes) === JSON.stringify(attendu), JSON.stringify(r.paragraphes));
      check('b. « Recommencer » puis « Fermer » (plus de « Réessayer »)', (r.boutons ?? []).join('/') === 'Recommencer/Fermer' && !/Réessayer/.test(r.tout), (r.boutons ?? []).join('/'));
      check('b. « Recommencer »', (await b.clickText('Recommencer', '.phone-sync__actions button')) === 'ok');
      await b.wait(1500);
      const r2 = await releve(b);
      check('b. « Recommencer » redit le même message', JSON.stringify(r2?.paragraphes) === JSON.stringify(attendu), JSON.stringify(r2?.paragraphes));
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
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'c à f', async (b, p) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const avantListe = await pageSessions(b);
      check('c. avant : la page Sessions montre cinq lignes (celles de l\'ordinateur)', lignesSessions(avantListe) === 5, String(lignesSessions(avantListe)));

      // c : l'écran de départ, puis « Commencer » (cliqué par `suivre`), la copie de sécurité, l'échange, le compte rendu rangé par geste
      let r = await synchroniser(b, 'c', { captureDepart: 'synchroniser-depart' });
      await capturer(b, 'synchroniser-compte-rendu');
      const dep = r.depart;
      check('c. l\'écran de départ s\'est montré, avant toute écriture, intitulé « Première synchronisation avec « … » »', dep !== null && /^Première synchronisation avec « .+ »$/.test(dep.titre), dep?.titre);
      check('c. écran de départ : le téléphone et le moyen en sous-titre', /· par le (câble|Wi-Fi)$/.test(dep?.sousTitre ?? '') && (SANSFIL || dep?.sousTitre === "Téléphone d'essai · par le câble"), dep?.sousTitre);
      check('c. écran de départ : « Chaque appareil va recevoir ce qui lui manque. Rien ne sera supprimé. » puis la phrase de la copie de sécurité', JSON.stringify(dep?.paragraphes) === JSON.stringify(['Chaque appareil va recevoir ce qui lui manque. Rien ne sera supprimé.', 'Avant de commencer, Gtracker copie les deux mémoires par sécurité dans :']), JSON.stringify(dep?.paragraphes));
      check('c. écran de départ : le dossier par défaut (Documents/Gtracker-copies du profil d\'essai) et les boutons « Choisir un autre dossier » et « Commencer »', dep?.dossier?.toLowerCase() === join(profil, 'Documents-essai', 'Gtracker-copies').toLowerCase() && (dep?.boutons ?? []).join('/') === 'Choisir un autre dossier/Commencer', JSON.stringify([dep?.dossier, dep?.boutons]));
      check('c. le titre du compte rendu : « Synchronisation terminée »', r.titre === 'Synchronisation terminée', r.titre);
      check('c. « Première synchronisation : rien n\'a été supprimé. » puis « Copie de sécurité : » (dossier dessous)', JSON.stringify(r.paragraphes) === JSON.stringify(["Première synchronisation : rien n'a été supprimé.", 'Copie de sécurité :']) && Boolean(r.dossier), JSON.stringify([r.paragraphes, r.dossier]));
      check('c. « Reçu du téléphone : 3 sessions » (3 noms) puis « Envoyé au téléphone : 4 sessions » (4 noms), et rien d\'autre', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Reçu du téléphone', '3 sessions', 3], ['Envoyé au téléphone', '4 sessions', 4]]), JSON.stringify(r.lignes));
      check('c. les lignes sont repliées, ni encadré ni « Détail »', r.lignes.every((l) => !l.ouverte) && r.notes.length === 0 && r.details.length === 0, JSON.stringify([r.notes, r.details]));
      check('c. aucune ligne « Supprimé » (rien n\'est supprimé à la première fois)', !ligneDe(r, 'Supprimé'), JSON.stringify(r.lignes));
      check('c. le fichier de réglages de l\'ordinateur est sur le téléphone, octet pour octet, et le téléphone n\'a rien reçu d\'autre dans reglages/', existsSync(join(memoire, 'reglages', 'pc.json')) && existsSync(join(racine, 'reglages', 'pc.json')) && readFileSync(join(memoire, 'reglages', 'pc.json')).equals(readFileSync(join(racine, 'reglages', 'pc.json'))) && readdirSync(join(racine, 'reglages')).join(',') === 'pc.json', existsSync(join(racine, 'reglages')) ? readdirSync(join(racine, 'reglages')).join(',') : 'absent');
      check('c. seul « Fermer » est offert en bas (rien à recommencer), « Ouvrir le dossier » dans le corps', (r.boutons ?? []).join('/') === 'Fermer' && (r.boutonsCorps ?? []).join('/') === 'Ouvrir le dossier', JSON.stringify([r.boutons, r.boutonsCorps]));
      console.log(`  avancement de la copie de sécurité vu : ${r.vus.filter((v) => /^Copie de sécurité/.test(v)).join(' | ') || '(non attrapé : trop rapide)'}`);
      check('c. l\'échange dit son avancement en fichiers (« Échange des sessions et des itinéraires : N fichiers sur M. »)', r.vus.some((v) => /^Échange des sessions et des itinéraires : \d+ fichiers? sur \d+\.$/.test(v)), JSON.stringify(r.vus));
      // « Ouvrir le dossier » : en essai, l'ouverture est seulement journalisée (jamais d'explorateur).
      const avantJournal = p.journal.length;
      check('c. « Ouvrir le dossier »', (await b.clickText('Ouvrir le dossier', '.phone-sync__body button')) === 'ok');
      await b.wait(700);
      check('c. « Ouvrir le dossier » : l\'ouverture est journalisée (sans chemin), aucune erreur à l\'écran', p.journal.slice(avantJournal).some((l) => /ouverture d'un dossier des copies de sécurité/.test(l)) && (await b.evaluate(`document.querySelectorAll(${JSON.stringify(DIALOGUE + ' .ui-danger-text')}).length`)) === 0, p.journal.slice(avantJournal).join(' | '));
      // Une ligne se déplie en noms.
      await b.evaluate(`document.querySelector('.phone-sync__row summary')?.click()`);
      await b.wait(250);
      const deplie = await releve(b);
      check('c. une ligne se déplie en noms (la première, « Reçu du téléphone », montre ses 3 noms)', deplie?.lignes[0]?.ouverte === true && deplie.lignes[0].noms.length === 3 && deplie.lignes.slice(1).every((l) => !l.ouverte), JSON.stringify(deplie?.lignes));
      await capturer(b, 'synchroniser-compte-rendu-deplie');
      await b.evaluate(`document.querySelector('.phone-sync__row summary')?.click()`);
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
        check('c. les marqueurs copiés sont ceux d\'avant (sans identifiant)', readFileSync(join(copie, 'telephone', 'gtracker.json'), 'utf8') === avantMarqueur && sansAppareil(readFileSync(join(copie, 'ordinateur', 'gtracker.json'), 'utf8')) === sansAppareil(avantMarqueurPc));
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
      check('c. le marqueur du téléphone porte un champ « synchro » (un instant, celui de la fin de la synchronisation), format, version et identifiant gardés', typeof marqueurTel?.synchro === 'number' && Math.abs(Date.now() - marqueurTel.synchro) < 5 * 60000 && Object.keys(marqueurTel).sort().join(',') === 'format,id,passage,synchro,version', JSON.stringify(marqueurTel));
      check('c. le marqueur du téléphone porte un compteur « passage » (entier, 1 à la première synchronisation)', marqueurTel?.passage === 1, JSON.stringify(marqueurTel?.passage));
      const synchroC = marqueurTel?.synchro;
      const passageC = marqueurTel?.passage;
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
      check('d. « Tout est à jour » : « Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires. » (et rien d\'autre : ni ligne, ni encadré, ni écran de départ)', r.titre === 'Tout est à jour' && JSON.stringify(r.paragraphes) === JSON.stringify(['Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.']) && r.lignes.length === 0 && r.notes.length === 0 && r.depart === null && !r.dossier, JSON.stringify([r.titre, r.paragraphes, r.lignes, r.depart?.titre]));
      await b.wait(1500);
      check('d. les sessions de l\'ordinateur n\'ont pas changé (noms, tailles, dates)', empreinte(join(memoire, 'sessions')) === empreintePc);
      check('d. les sessions du téléphone n\'ont pas changé (noms, tailles, dates)', empreinte(join(racine, 'sessions')) === empreinteTel);
      gardeHorsSessions('d', racine, avantHors);
      check('d. pas de seconde copie de sécurité', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      check('d. rien n\'a changé sur le téléphone : son champ « synchro » est celui du cas c', lireJson(join(racine, 'gtracker.json'))?.synchro === synchroC, `${synchroC} / ${lireJson(join(racine, 'gtracker.json'))?.synchro}`);
      check('d. le compteur « passage » du marqueur a augmenté d\'un (une synchronisation de plus)', lireJson(join(racine, 'gtracker.json'))?.passage === passageC + 1, `${passageC} / ${lireJson(join(racine, 'gtracker.json'))?.passage}`);
      await fermerFenetre(b);

      // e : supprimée sur le téléphone
      const SUPPRIMEE_TEL = 1;
      retirer(racine, [SUPPRIMEE_TEL]);
      const avantE = horsSessions(racine);
      r = await synchroniser(b, 'e');
      check('e. une seule ligne : « Supprimé : 1 session supprimée sur le téléphone : elle est dans la corbeille de l\'ordinateur pour 30 jours » (1 nom), sans question (une suppression ordinaire passe)', r.titre === 'Synchronisation terminée' && JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 session supprimée sur le téléphone : elle est dans la corbeille de l'ordinateur pour 30 jours", 1]]) && r.depart === null, JSON.stringify([r.titre, r.lignes]));
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
      check('f. une seule ligne : « Supprimé : 1 session supprimée sur l\'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l\'ordinateur » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 session supprimée sur l'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l'ordinateur", 1]]), JSON.stringify(r.lignes));
      const marqueurF = lireJson(join(racine, 'gtracker.json'));
      check('f. le téléphone a changé : son champ « synchro » est plus récent que celui du cas c, ses autres champs sont gardés', typeof marqueurF?.synchro === 'number' && marqueurF.synchro > synchroC && marqueurF.format === FORMATS.memoire && marqueurF.version === 1 && typeof marqueurF.id === 'string' && Number.isSafeInteger(marqueurF.passage) && marqueurF.passage > passageC + 1, JSON.stringify(marqueurF));
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
      check('f. restaurée puis synchronisée : une seule ligne « Restauré : 1 session sortie de la corbeille : renvoyée au téléphone » (1 nom), ni « Envoyé », ni « Supprimé »', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Restauré', '1 session sortie de la corbeille : renvoyée au téléphone', 1]]), JSON.stringify(r.lignes));
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
  // g5 : « Les garder » au lieu de « Les retirer du téléphone » (deux sessions : la corbeille se réduit à rien).
  for (const [nom, nbCorbeille, ks0, fichesChangees = false, garder = false] of [['g1', 2, TOUTES_G], ['g2', 1, TOUTES_G], ['g3', 1, [0, 1, 2]], ['g4', 1, TOUTES_G, true], ['g5', 2, TOUTES_G, false, true]]) {
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
      const garde = plusieurs ? 'Les garder' : 'La garder';
      const retire = plusieurs ? 'Les retirer du téléphone' : 'La retirer du téléphone';
      const intro = plusieurs ? `${nbCorbeille} sessions sont dans la corbeille de cet ordinateur, mais encore sur le téléphone :` : '1 session est dans la corbeille de cet ordinateur, mais encore sur le téléphone :';
      const conseil = plusieurs ? '« Les garder » les sort de la corbeille : elles sont de nouveau sur les deux appareils.' : '« La garder » la sort de la corbeille : elle est de nouveau sur les deux appareils.';
      /** La question de la corbeille, telle que la planche la dit : titre, phrase, noms en liste, deux réponses, conseil. */
      const verifierQuestion = (quoi, rr) => {
        check(`${quoi} : la question de la corbeille : « Supprimée ici, encore sur le téléphone » et « ${intro} »`, rr.titre === 'Supprimée ici, encore sur le téléphone' && JSON.stringify(rr.paragraphes) === JSON.stringify([intro]), JSON.stringify([rr.titre, rr.paragraphes]));
        check(`${quoi} : les sessions concernées sont nommées en liste (${nbCorbeille} noms)`, rr.noms.length === nbCorbeille, JSON.stringify(rr.noms));
        check(`${quoi} : deux réponses seulement, « ${garde} » et « ${retire} » (aucun « Annuler », « Les laisser »)`, (rr.boutons ?? []).join('/') === `${garde}/${retire}`, (rr.boutons ?? []).join('/'));
        check(`${quoi} : le conseil dit ce que fait « ${garde} », sans promettre de revenir`, JSON.stringify(rr.conseils) === JSON.stringify([conseil]), JSON.stringify(rr.conseils));
      };
      check(`${nom} : l'écran de départ de la première synchronisation s'est montré avant la question`, r.depart !== null && /^Première synchronisation avec /.test(r.depart.titre), r.depart?.titre);
      verifierQuestion(nom, r);
      await capturer(b, `synchroniser-question-corbeille-${nom}`);
      await b.wait(1000);
      memesSessionsPartielles(`${nom} (après la première passe)`, memoire, racine, restantes, ks0);
      check(`${nom} : la copie de sécurité est faite dès la première passe (une seule)`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
      check(`${nom} : le téléphone porte encore toutes ses sessions`, memes(gpxsDe(racine).map((n) => n.replace(/\.gpx$/, '')), nomsDe(ks0)), gpxsDe(racine).join(','));

      // Fermer la question (×) ne décide rien : le compte rendu de ce qui est fait la rappelle, avec « Répondre » ; « Répondre » la rouvre telle quelle.
      check(`${nom} : la croix de la fenêtre`, (await b.click(`document.querySelector('[role=dialog].phone-sync__dialog .ui-dialog__close')`)) === 'ok');
      await b.wait(500);
      r = await releve(b);
      const attend = plusieurs ? `${nbCorbeille} sessions de la corbeille de cet ordinateur, encore sur le téléphone, attendent votre réponse.` : '1 session de la corbeille de cet ordinateur, encore sur le téléphone, attend votre réponse.';
      check(`${nom} : fermée par la croix, la question ne décide rien : le compte rendu dit « ${attend} », avec « Répondre » et « Fermer »`, r !== null && r.notes.includes(attend) && (r.boutons ?? []).join('/') === 'Répondre/Fermer', JSON.stringify([r?.notes, r?.boutons]));
      check(`${nom} : rien n'a bougé : le téléphone porte toujours toutes ses sessions, la corbeille ses ${nbCorbeille} entrée(s)`, gpxsDe(racine).length === ks0.length && corbeilleDe(memoire).entries.length === nbCorbeille);
      check(`${nom} : « Répondre » rouvre la question`, (await b.clickText('Répondre', '.phone-sync__actions button')) === 'ok');
      await b.wait(500);
      verifierQuestion(`${nom}, rouverte`, await releve(b));
      check(`${nom} : toujours une seule copie de sécurité`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
      let cb;
      if (garder) {
        // « Les garder » : elles sortent de la corbeille, de nouveau sur les deux appareils ; la question ne revient pas.
        r = await repondre(b, `${nom}, « ${garde} »`, garde);
        check(`${nom} : « ${garde} » : une seule ligne « Gardé : ${nbCorbeille} sessions gardées : remises là où elles manquaient » (${nbCorbeille} noms)`, JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Gardé', `${nbCorbeille} sessions gardées : remises là où elles manquaient`, nbCorbeille]]), JSON.stringify(r.lignes));
        await b.wait(1500);
        memesSessions(`${nom} (gardées)`, memoire, tel, ks0);
        cb = corbeilleDe(memoire);
        check(`${nom} : « ${garde} » : la corbeille est réduite à rien (les ${nbCorbeille} sessions en sont sorties), sans dossier orphelin`, cb.entries.length === 0 && cb.dirs.length === 0, JSON.stringify(cb.index));
        await fermerFenetre(b);
        r = await synchroniser(b, `${nom}, synchronisation suivante`);
        check(`${nom} : la question ne revient pas : « Tout est à jour »`, r.titre === 'Tout est à jour' && r.lignes.length === 0 && r.depart === null, JSON.stringify([r.titre, r.paragraphes]));
        check(`${nom} : toujours une seule copie de sécurité en tout`, copiesDe(profil).length === 1, copiesDe(profil).join(','));
        gardeHorsSessions(nom, racine, avantHors);
        await fermerFenetre(b);
        return;
      }
      // « Les retirer du téléphone »
      r = await repondre(b, `${nom}, « ${retire} »`, retire);
      if (avecGardeFou) {
        // Le retrait dépasse le quart du téléphone : la question du garde-fou s'ouvre en plus, par appareil, avec deux réponses.
        check(`${nom} : le retrait dépasse le quart du téléphone : la question « Une suppression à confirmer » s'ouvre en plus`, r.titre === 'Une suppression à confirmer' && r.paragraphes[0] === 'Depuis la dernière synchronisation :', JSON.stringify([r.titre, r.paragraphes]));
        check(`${nom} : elle range par appareil : « Sur l'ordinateur : 1 session supprimée » (1 nom, dépliée), la phrase « Faut-il la supprimer aussi de l'autre appareil ? Rien n'est perdu… »`, JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length, l.ouverte])) === JSON.stringify([["Sur l'ordinateur", '1 session supprimée', 1, true]]) && r.paragraphes[1] === "Faut-il la supprimer aussi de l'autre appareil ? Rien n'est perdu : tout reste 30 jours dans la corbeille de l'ordinateur.", JSON.stringify([r.lignes, r.paragraphes]));
        check(`${nom} : deux réponses, « Tout garder » et « Supprimer des deux côtés » (ni « Annuler » ni « Synchroniser sans rien supprimer »)`, (r.boutons ?? []).join('/') === 'Tout garder/Supprimer des deux côtés', (r.boutons ?? []).join('/'));
        check(`${nom} : rien n'est encore retiré du téléphone`, gpxsDe(racine).length === ks0.length);
        r = await repondre(b, `${nom}, « Supprimer des deux côtés »`, 'Supprimer des deux côtés');
      }
      check(`${nom} : « Supprimé : ${plusieurs ? '2 sessions supprimées sur l\'ordinateur, retirées du téléphone : elles restent' : '1 session supprimée sur l\'ordinateur, retirée du téléphone : elle reste'} 30 jours dans la corbeille de l'ordinateur » (${nbCorbeille} noms)`, JSON.stringify(r.lignes.filter((l) => l.geste === 'Supprimé').map((l) => [l.texte, l.noms.length])) === JSON.stringify([[plusieurs ? "2 sessions supprimées sur l'ordinateur, retirées du téléphone : elles restent 30 jours dans la corbeille de l'ordinateur" : "1 session supprimée sur l'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l'ordinateur", nbCorbeille]]), JSON.stringify(r.lignes));
      await b.wait(1500);
      memesSessions(`${nom} (retirées)`, memoire, tel, restantes);
      cb = corbeilleDe(memoire);
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
      check('h1. l\'écran de départ s\'est montré, puis « Reçu du téléphone : 12 sessions » (12 noms), seule ligne', r.depart !== null && JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Reçu du téléphone', '12 sessions', 12]]), JSON.stringify([r.depart?.titre, r.lignes]));
      await b.wait(2000);
      memesSessions('h1', memoire, tel, TOUTES);
      await fermerFenetre(b);

      // Onze sessions supprimées sur le téléphone, une reste.
      const SUPPRIMEES = TOUTES.slice(0, 11);
      retirer(racine, SUPPRIMEES);
      const avantPc = empreinte(join(memoire, 'sessions'));
      const avantTel = empreinte(join(racine, 'sessions'));
      const verifierQuestion = (quoi, rr) => verifierQuestionGarde(quoi, rr, 11);
      const rienNaBouge = (quoi) => {
        check(`${quoi} : rien n'est supprimé (ordinateur : douze sessions, corbeille vide)`, gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0 && empreinte(join(memoire, 'sessions')) === avantPc, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
        check(`${quoi} : le téléphone n'a pas changé`, empreinte(join(racine, 'sessions')) === avantTel);
      };

      // h2 : la question, nombres par appareil ; la fermer par la croix ne décide rien, « Répondre » la rouvre
      r = await synchroniser(b, 'h2, première question');
      verifierQuestion('h2', r);
      await capturer(b, 'synchroniser-garde-fou');
      check('h2. la croix de la fenêtre', (await b.click(`document.querySelector('[role=dialog].phone-sync__dialog .ui-dialog__close')`)) === 'ok');
      await b.wait(500);
      r = await releve(b);
      check('h2. fermée par la croix : le compte rendu dit « Des suppressions attendent votre réponse : 11 sessions sur le téléphone. », avec « Répondre » et « Fermer »', r !== null && r.notes.includes('Des suppressions attendent votre réponse : 11 sessions sur le téléphone.') && (r.boutons ?? []).join('/') === 'Répondre/Fermer', JSON.stringify([r?.notes, r?.boutons]));
      aucunMotAncien('h2, après la croix', r);
      await b.wait(500);
      rienNaBouge('h2, après la croix');
      check('h2. « Répondre » rouvre la question', (await b.clickText('Répondre', '.phone-sync__actions button')) === 'ok');
      await b.wait(500);
      verifierQuestion('h2, rouverte', await releve(b));
      await fermerFenetreParLaCroix(b);
      await fermerFenetreParLaCroix(b);
      check('h2. la fenêtre est fermée', (await releve(b)) === null);

      // h3 : « Tout garder » : chaque session revient là où elle manque, la question ne revient plus
      r = await synchroniser(b, 'h3, seconde question');
      verifierQuestion('h3', r);
      r = await repondre(b, 'h3, « Tout garder »', 'Tout garder');
      check('h3. une seule ligne « Gardé : 11 sessions gardées : remises là où elles manquaient » (11 noms)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Gardé', '11 sessions gardées : remises là où elles manquaient', 11]]), JSON.stringify(r.lignes));
      check('h3. aucune phrase « Première synchronisation » (ce n\'est pas la première)', !(r.paragraphes ?? []).some((l) => /Première synchronisation/.test(l)), JSON.stringify(r.paragraphes));
      await b.wait(2000);
      memesSessions('h3, après « Tout garder » (les onze sont revenues sur le téléphone)', memoire, tel, TOUTES);
      check('h3. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);
      r = await synchroniser(b, 'h3, synchronisation suivante');
      check('h3. la question ne revient pas : « Tout est à jour »', r.titre === 'Tout est à jour' && r.lignes.length === 0, JSON.stringify([r.titre, r.paragraphes]));
      await fermerFenetre(b);

      // h4 : onze supprimées de nouveau sur le téléphone, « Supprimer des deux côtés »
      retirer(racine, SUPPRIMEES);
      r = await synchroniser(b, 'h4, troisième question');
      verifierQuestion('h4', r);
      r = await repondre(b, 'h4, « Supprimer des deux côtés »', 'Supprimer des deux côtés');
      check('h4. une seule ligne « Supprimé : 11 sessions supprimées sur le téléphone : elles sont dans la corbeille de l\'ordinateur pour 30 jours » (11 noms)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "11 sessions supprimées sur le téléphone : elles sont dans la corbeille de l'ordinateur pour 30 jours", 11]]), JSON.stringify(r.lignes));
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
  console.log('\n== m. Garde-fou : la liste change entre la question et le clic (question fermée puis « Répondre », question laissée ouverte, ou fenêtre refermée puis rouverte)');
  for (const variante of ['m1', 'm2', 'm3']) {
    if (!veut('m')) break;
    const TOUTES = Array.from({ length: NOMBRE }, (_, k) => k);
    const profil = dossier(`${variante}-profil`);
    const memoire = fabriquerMemoire(variante, []);
    const tel = fabriquerTelephone(`${variante}-tel`, TOUTES);
    const racine = racineTel(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, variante, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, `${variante}, première synchronisation`);
      check(`${variante}. « Reçu du téléphone : 12 sessions »`, ligneDe(r, 'Reçu du téléphone')?.texte === '12 sessions', JSON.stringify(r.lignes));
      await b.wait(2000);
      await fermerFenetre(b);
      // Dix sessions supprimées sur le téléphone : la question du garde-fou porte sur dix.
      retirer(racine, TOUTES.slice(0, 10));
      r = await synchroniser(b, `${variante}, question sur dix`);
      verifierQuestionGarde(`${variante}, sur dix`, r, 10);
      const rienSupprime = (quoi) => check(`${quoi} : aucune session n'a été supprimée sur la foi de l'ancienne liste (corbeille vide, douze sessions sur l'ordinateur)`, gpxsDe(memoire).length === 12 && corbeilleDe(memoire).entries.length === 0, `${gpxsDe(memoire).length} ${JSON.stringify(corbeilleDe(memoire).index)}`);
      if (variante === 'm1') {
        // Question fermée par la croix (le compte rendu la rappelle), une session de plus supprimée, « Répondre » : la question rouverte est celle d'avant (10),
        // et la confirmer ne vaut que pour ces dix : la question revient sur onze, rien n'est supprimé.
        check('m1. la croix de la fenêtre', (await b.click(`document.querySelector('[role=dialog].phone-sync__dialog .ui-dialog__close')`)) === 'ok');
        await b.wait(500);
        r = await releve(b);
        check('m1. le compte rendu rappelle « Des suppressions attendent votre réponse : 10 sessions sur le téléphone. » avec « Répondre »', r !== null && r.notes.includes('Des suppressions attendent votre réponse : 10 sessions sur le téléphone.') && (r.boutons ?? []).join('/') === 'Répondre/Fermer', JSON.stringify([r?.notes, r?.boutons]));
        rienSupprime('m1, question fermée');
        retirer(racine, [10]);
        check('m1. « Répondre »', (await b.clickText('Répondre', '.phone-sync__actions button')) === 'ok');
        await b.wait(500);
        verifierQuestionGarde('m1, rouverte (liste d\'avant)', await releve(b), 10);
        r = await repondre(b, 'm1, « Supprimer des deux côtés » sur la liste périmée', 'Supprimer des deux côtés');
        verifierQuestionGarde('m1, la question revient sur la liste à jour', r, 11);
        await b.wait(800);
        rienSupprime('m1, après la confirmation périmée');
      } else if (variante === 'm2') {
        // Question laissée ouverte, une session de plus supprimée, confirmation de la liste de dix : la question revient sur onze.
        retirer(racine, [10]);
        r = await repondre(b, 'm2, « Supprimer des deux côtés » alors que la liste a changé', 'Supprimer des deux côtés');
        verifierQuestionGarde('m2, la question revient sur la liste à jour', r, 11);
        await b.wait(800);
        rienSupprime('m2, après la confirmation périmée');
      } else {
        // Question fermée, compte rendu fermé, une session de plus supprimée : « Synchroniser » repose la question sur onze, sans rien garder de l'ancienne.
        await fermerFenetreParLaCroix(b);
        await fermerFenetreParLaCroix(b);
        check('m3. la fenêtre est fermée', (await releve(b)) === null);
        rienSupprime('m3, fenêtre fermée');
        retirer(racine, [10]);
        r = await synchroniser(b, 'm3, fenêtre rouverte');
        verifierQuestionGarde('m3, la question est posée de nouveau, sur onze', r, 11);
      }
      r = await repondre(b, `${variante}, « Supprimer des deux côtés »`, 'Supprimer des deux côtés');
      check(`${variante}. une seule ligne « Supprimé : 11 sessions supprimées sur le téléphone : elles sont dans la corbeille de l'ordinateur pour 30 jours » (11 noms)`, JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "11 sessions supprimées sur le téléphone : elles sont dans la corbeille de l'ordinateur pour 30 jours", 11]]), JSON.stringify(r.lignes));
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
      check('k1. première synchronisation de deux mémoires identiques : aucune ligne (rien à recevoir ni à envoyer, rien à supprimer), « Rien à échanger… »', r.lignes.length === 0 && r.paragraphes.includes('Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.') && r.paragraphes.includes("Première synchronisation : rien n'a été supprimé."), JSON.stringify([r.lignes, r.paragraphes]));
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
      check('k2. « Supprimé : 1 session supprimée sur l\'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l\'ordinateur »', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 session supprimée sur l'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l'ordinateur", 1]]), JSON.stringify(r.lignes));
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
      check('r1. « Première synchronisation : rien n\'a été supprimé. » après l\'écran de départ', r.depart !== null && (r.paragraphes ?? []).includes("Première synchronisation : rien n'a été supprimé."), JSON.stringify(r.paragraphes));
      check('r1. « Reçu du téléphone : 2 itinéraires » (2 noms) puis « Envoyé au téléphone : 3 itinéraires » (3 noms), sessions et itinéraires comptés à part (les sessions étaient déjà communes : aucune ligne pour elles)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Reçu du téléphone', '2 itinéraires', 2], ['Envoyé au téléphone', '3 itinéraires', 3]]), JSON.stringify(r.lignes));
      check('r1. aucune ligne de suppression ni de corbeille', !ligneDe(r, 'Supprimé') && !(r.paragraphes ?? []).some((l) => /supprim|corbeille/i.test(l) && !/rien n'a été supprimé/.test(l)), JSON.stringify(r.paragraphes));
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
      check('r2. « Tout est à jour » : « Rien à échanger… » (et rien d\'autre)', r.titre === 'Tout est à jour' && JSON.stringify(r.paragraphes) === JSON.stringify(['Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.']) && r.lignes.length === 0, JSON.stringify([r.titre, r.paragraphes]));
      await b.wait(1500);
      check('r2. les itinéraires des deux appareils n\'ont pas changé (noms, tailles, dates)', empreinte(memoire, (c) => c.startsWith('itineraires/')) === empreintePc && empreinte(racine, (c) => c.startsWith('itineraires/')) === empreinteTel);
      await fermerFenetre(b);

      // r3 : alpha modifié sur le téléphone
      poserItineraire(racine, 'alpha', { note: 'v2-telephone', maj: '2026-09-10T10:00:00.000Z', jour: 20 });
      r = await synchroniser(b, 'r3');
      check('r3. une seule ligne « Modifié : 1 itinéraire, recopié sur l\'autre appareil » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Modifié', "1 itinéraire, recopié sur l'autre appareil", 1]]), JSON.stringify(r.lignes));
      await b.wait(1500);
      memesItineraires('r3', memoire, tel, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
      check('r3. la fiche de l\'ordinateur est celle du téléphone (nouvelle date, note v2-telephone)', lireJson(join(memoire, 'itineraires', 'Itin alpha.json'))?.noteBanc === 'v2-telephone' && lireJson(join(memoire, 'itineraires', 'Itin alpha.json'))?.updatedAt === '2026-09-10T10:00:00.000Z');
      check('r3. rien à la corbeille', corbeilleDe(memoire).entries.length === 0);
      await fermerFenetre(b);

      // r4 : bravo modifié sur l'ordinateur
      poserItineraire(memoire, 'bravo', { note: 'v2-ordinateur', maj: '2026-09-11T10:00:00.000Z', jour: 21 });
      r = await synchroniser(b, 'r4');
      check('r4. une seule ligne « Modifié : 1 itinéraire, recopié sur l\'autre appareil » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Modifié', "1 itinéraire, recopié sur l'autre appareil", 1]]), JSON.stringify(r.lignes));
      await b.wait(1500);
      memesItineraires('r4', memoire, tel, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
      check('r4. la fiche du téléphone est celle de l\'ordinateur (note v2-ordinateur)', lireJson(join(racine, 'itineraires', 'Itin bravo.json'))?.noteBanc === 'v2-ordinateur');
      await fermerFenetre(b);

      // r5 : delta supprimé sur le téléphone
      retirerItineraire(racine, 'delta');
      r = await synchroniser(b, 'r5');
      check('r5. « Supprimé : 1 itinéraire supprimé sur le téléphone : il est dans la corbeille de l\'ordinateur pour 30 jours » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 itinéraire supprimé sur le téléphone : il est dans la corbeille de l'ordinateur pour 30 jours", 1]]), JSON.stringify(r.lignes));
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
      check('r6. « Supprimé : 1 itinéraire supprimé sur l\'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l\'ordinateur » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 itinéraire supprimé sur l'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l'ordinateur", 1]]), JSON.stringify(r.lignes));
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
      check('r7. « Supprimé : 1 itinéraire supprimé sur l\'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l\'ordinateur » (1 nom)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 itinéraire supprimé sur l'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l'ordinateur", 1]]), JSON.stringify(r.lignes));
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
      check('r8. un encadré « 1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l\'autre est dans la corbeille de l\'ordinateur (30 jours). »', r.notes.includes("1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours)."), JSON.stringify(r.notes));
      check('r8. pas de ligne « Modifié » en plus', !ligneDe(r, 'Modifié'), JSON.stringify(r.lignes));
      await b.wait(1500);
      memesItineraires('r8', memoire, tel, ['alpha', 'bravo', 'charlie']);
      check('r8. la plus récente (téléphone, v2-telephone) est des deux côtés', lireJson(join(memoire, 'itineraires', 'Itin charlie.json'))?.noteBanc === 'v2-telephone' && lireJson(join(racine, 'itineraires', 'Itin charlie.json'))?.noteBanc === 'v2-telephone');
      const cb2 = corbeilleDe(memoire);
      const perdue = cb2.entries.find((x) => x.routeBase === 'Itin charlie');
      check('r8. la version perdante (celle de l\'ordinateur, v2-ordinateur) est à la corbeille, origine « ordinateur », octet pour octet', cb2.entries.length === 4 && perdue?.origin === 'ordinateur' && perdue?.kind === 'itineraire' && existsSync(join(cb2.dir, perdue.dir, 'Itin charlie.json')) && readFileSync(join(cb2.dir, perdue.dir, 'Itin charlie.json')).equals(perdante), JSON.stringify(cb2.entries.map((x) => [x.origin, x.routeBase])));
      await fermerFenetre(b);

      // r9 : tout est à jour, les sessions n'ont jamais bougé
      r = await synchroniser(b, 'r9');
      check('r9. « Tout est à jour » : « Rien à échanger… » (et rien d\'autre)', r.titre === 'Tout est à jour' && JSON.stringify(r.paragraphes) === JSON.stringify(['Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.']) && r.lignes.length === 0, JSON.stringify([r.titre, r.paragraphes]));
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
      check('rg1. rien à recevoir ni à envoyer : les deux appareils portaient les mêmes itinéraires et les mêmes sessions', r.lignes.length === 0, JSON.stringify(r.lignes));
      await b.wait(1500);
      memesItineraires('rg1', memoire, tel, CLES);
      await fermerFenetre(b);

      // Une session et quatre itinéraires supprimés sur le téléphone : plus du quart des deux.
      retirer(racine, [0]);
      for (const cle of ['alpha', 'bravo', 'charlie', 'delta']) retirerItineraire(racine, cle);
      const avantPcItineraires = empreinte(memoire, (c) => c.startsWith('itineraires/'));
      const avantPcSessions = empreinte(join(memoire, 'sessions'));
      const avantTel = empreinte(racine, (c) => c.startsWith('itineraires/') || c.startsWith('sessions/'));
      /** Une session et quatre itinéraires : une seule ligne par appareil, chacun compté à part, jamais « 5 suppressions ». */
      const verifierQuestion = (quoi, rr) => {
        check(`${quoi} : « Beaucoup de suppressions d'un coup », « Depuis la dernière synchronisation : », puis « Faut-il les supprimer aussi de l'autre appareil ? Rien n'est perdu… »`, rr.titre === "Beaucoup de suppressions d'un coup" && JSON.stringify(rr.paragraphes) === JSON.stringify(['Depuis la dernière synchronisation :', "Faut-il les supprimer aussi de l'autre appareil ? Rien n'est perdu : tout reste 30 jours dans la corbeille de l'ordinateur."]), JSON.stringify([rr.titre, rr.paragraphes]));
        check(`${quoi} : une seule ligne « Sur le téléphone : 1 session, 4 itinéraires supprimés », dépliée sur ses 5 noms (la session et les itinéraires comptés à part)`, JSON.stringify(rr.lignes.map((l) => [l.geste, l.texte, l.noms.length, l.ouverte])) === JSON.stringify([['Sur le téléphone', '1 session, 4 itinéraires supprimés', 5, true]]), JSON.stringify(rr.lignes));
        check(`${quoi} : deux réponses, « Tout garder » et « Supprimer des deux côtés »`, (rr.boutons ?? []).join('/') === 'Tout garder/Supprimer des deux côtés', (rr.boutons ?? []).join('/'));
        check(`${quoi} : le conseil dit « chaque session et chaque itinéraire »`, JSON.stringify(rr.conseils) === JSON.stringify(['« Tout garder » remet chaque session et chaque itinéraire là où ils manquent. Fermer la fenêtre ne décide rien : la question reviendra.']), JSON.stringify(rr.conseils));
      };
      const rienNaBouge = (quoi) => {
        check(`${quoi} : rien n'est supprimé (ordinateur : 3 sessions et 8 itinéraires, corbeille vide)`, empreinte(memoire, (c) => c.startsWith('itineraires/')) === avantPcItineraires && empreinte(join(memoire, 'sessions')) === avantPcSessions && corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
        check(`${quoi} : le téléphone n'a pas changé`, empreinte(racine, (c) => c.startsWith('itineraires/') || c.startsWith('sessions/')) === avantTel);
      };
      r = await synchroniser(b, 'rg2, première question');
      verifierQuestion('rg2', r);
      await capturer(b, 'synchroniser-garde-fou-itineraires');
      // La croix ne décide rien : le compte rendu rappelle ce qui attend (par appareil), « Répondre » rouvre la question.
      await fermerFenetreParLaCroix(b);
      r = await releve(b);
      check('rg2. fermée par la croix : « Des suppressions attendent votre réponse : 1 session, 4 itinéraires sur le téléphone. », avec « Répondre » et « Fermer »', r !== null && r.notes.includes('Des suppressions attendent votre réponse : 1 session, 4 itinéraires sur le téléphone.') && (r.boutons ?? []).join('/') === 'Répondre/Fermer', JSON.stringify([r?.notes, r?.boutons]));
      await b.wait(800);
      rienNaBouge('rg2, après la croix');
      check('rg2. « Répondre » rouvre la question', (await b.clickText('Répondre', '.phone-sync__actions button')) === 'ok');
      await b.wait(500);
      verifierQuestion('rg2, rouverte', await releve(b));
      await fermerFenetreParLaCroix(b);
      await fermerFenetreParLaCroix(b);

      // « Tout garder » : la session et les quatre itinéraires reviennent sur le téléphone, la question ne revient plus.
      r = await synchroniser(b, 'rg3, seconde question');
      verifierQuestion('rg3', r);
      r = await repondre(b, 'rg3, « Tout garder »', 'Tout garder');
      check('rg3. une seule ligne « Gardé : 1 session, 4 itinéraires gardés : remis là où ils manquaient » (5 noms)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Gardé', '1 session, 4 itinéraires gardés : remis là où ils manquaient', 5]]), JSON.stringify(r.lignes));
      await b.wait(2000);
      memesItineraires('rg3', memoire, tel, CLES);
      memesSessions('rg3', memoire, tel, SESSIONS_G);
      check('rg3. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);

      // « Supprimer des deux côtés » : la même suppression, refaite, est appliquée aux deux appareils.
      retirer(racine, [0]);
      for (const cle of ['alpha', 'bravo', 'charlie', 'delta']) retirerItineraire(racine, cle);
      r = await synchroniser(b, 'rg4, troisième question');
      verifierQuestion('rg4', r);
      r = await repondre(b, 'rg4, « Supprimer des deux côtés »', 'Supprimer des deux côtés');
      check('rg4. « Supprimé : 1 session, 4 itinéraires supprimés sur le téléphone : ils sont dans la corbeille de l\'ordinateur pour 30 jours » (5 noms)', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "1 session, 4 itinéraires supprimés sur le téléphone : ils sont dans la corbeille de l'ordinateur pour 30 jours", 5]]), JSON.stringify(r.lignes));
      await b.wait(2000);
      memesItineraires('rg4', memoire, tel, ['echo', 'foxtrot', 'golf', 'hotel']);
      memesSessions('rg4', memoire, tel, [1, 2]);
      const cb = corbeilleDe(memoire);
      check('rg4. la corbeille porte une session et quatre itinéraires, tous d\'origine « ordinateur », chacun avec sa fiche et son GPX', cb.entries.length === 5 && cb.entries.filter((x) => x.kind === 'itineraire').length === 4 && cb.entries.filter((x) => x.kind === 'session').length === 1 && cb.entries.every((x) => x.origin === 'ordinateur' && existsSync(join(cb.dir, x.dir, x.main)) && (x.files ?? []).length === 2), JSON.stringify(cb.entries.map((x) => [x.kind, x.origin, x.main])));
      check('rg4. une seule copie de sécurité en tout', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      await fermerFenetre(b);
    });
  }

  // ---------- o. copie ancienne du dossier du téléphone remise ----------
  console.log('\n== o. Copie ancienne du dossier du téléphone remise : traitée comme un nouveau téléphone, rien de supprimé');
  if (veut('o')) {
    const TROIS = [0, 1, 2];
    const SUPPRIMEE = 2;
    const profil = dossier('o-profil');
    const memoire = fabriquerMemoire('o', TROIS);
    const tel = fabriquerTelephone('o-tel', TROIS);
    const racine = racineTel(tel);
    const sauvegarde = join(dossier('o-sauvegarde'), 'Gtracker');
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'o', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'o1, première synchronisation');
      check('o1. première synchronisation faite (marqueur du téléphone : identifiant et passage 1)', r.depart !== null && lireJson(join(racine, 'gtracker.json'))?.passage === 1, JSON.stringify([r.titre, lireJson(join(racine, 'gtracker.json'))]));
      await fermerFenetre(b);
      // La sauvegarde : le dossier du téléphone tel qu'il est au passage 1.
      cpSync(racine, sauvegarde, { recursive: true, preserveTimestamps: true });
      const idSauvegarde = lireJson(join(sauvegarde, 'gtracker.json'))?.id;
      r = await synchroniser(b, 'o2, seconde synchronisation');
      check('o2. « Tout est à jour », et le passage du téléphone est monté à 2 (la sauvegarde porte 1)', r.titre === 'Tout est à jour' && lireJson(join(racine, 'gtracker.json'))?.passage === 2 && lireJson(join(sauvegarde, 'gtracker.json'))?.passage === 1, JSON.stringify([r.titre, lireJson(join(racine, 'gtracker.json'))?.passage]));
      await fermerFenetre(b);
      // Une session supprimée sur l'ordinateur depuis la sauvegarde, puis la sauvegarde remise sur le téléphone.
      retirer(memoire, [SUPPRIMEE]);
      await b.wait(1500);
      for (const e of readdirSync(racine)) rmSync(join(racine, e), { recursive: true, force: true });
      cpSync(sauvegarde, racine, { recursive: true, preserveTimestamps: true });
      check('o3. la copie ancienne est remise : le téléphone porte de nouveau passage 1 et sa session supprimée', lireJson(join(racine, 'gtracker.json'))?.passage === 1 && existsSync(join(racine, 'sessions', `${MODELES[SUPPRIMEE].nom}.gpx`)) && !existsSync(join(memoire, 'sessions', `${MODELES[SUPPRIMEE].nom}.gpx`)));
      const copiesAvant = copiesDe(profil).length;
      r = await synchroniser(b, 'o3, copie ancienne remise', { captureDepart: 'synchroniser-depart-copie-ancienne' });
      check('o3. c\'est une première rencontre : l\'écran de départ s\'est montré', r.depart !== null && /^Première synchronisation avec /.test(r.depart.titre ?? ''), r.depart?.titre);
      check('o3. le compte rendu dit « Le dossier du téléphone est une copie plus ancienne… rien n\'a été supprimé… »', /^Le dossier du téléphone est une copie plus ancienne .*rien n'a été supprimé\./.test(r.paragraphes[0] ?? ''), JSON.stringify(r.paragraphes));
      check('o3. la phrase prévient que des sessions supprimées depuis cette copie peuvent revenir', /Des sessions supprimées depuis cette copie peuvent revenir/.test(r.paragraphes[0] ?? ''), r.paragraphes[0]);
      check('o3. aucune ligne « Supprimé » ; « Reçu du téléphone : 1 session » (celle que l\'ordinateur avait supprimée)', !ligneDe(r, 'Supprimé') && JSON.stringify(r.lignes.filter((l) => l.geste === 'Reçu du téléphone').map((l) => [l.texte, l.noms.length])) === JSON.stringify([['1 session', 1]]), JSON.stringify(r.lignes));
      await b.wait(1500);
      check('o3. la corbeille de l\'ordinateur reste vide', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      memesSessions('o3', memoire, tel, TROIS);
      const marqueur = lireJson(join(racine, 'gtracker.json'));
      check('o3. le téléphone a reçu un identifiant neuf (plus celui de la sauvegarde) et un passage', typeof marqueur?.id === 'string' && marqueur.id !== idSauvegarde && Number.isSafeInteger(marqueur.passage), JSON.stringify(marqueur));
      check('o3. une copie de sécurité de plus a été faite (première rencontre)', copiesDe(profil).length === copiesAvant + 1, `${copiesAvant} puis ${copiesDe(profil).length}`);
      await fermerFenetre(b);
      r = await synchroniser(b, 'o4, synchronisation suivante');
      check('o4. la synchronisation suivante est ordinaire : « Tout est à jour », sans la phrase de la copie ancienne', r.titre === 'Tout est à jour' && !/copie plus ancienne/.test(r.tout ?? ''), JSON.stringify([r.titre, r.paragraphes]));
      await fermerFenetre(b);
    });
  }

  // ---------- v. nom d'une session changé des deux côtés ----------
  console.log('\n== v. Nom de session changé des deux côtés : le dernier saisi l\'emporte, sur les deux appareils');
  if (veut('v')) {
    const DEUX = [0, 1];
    const profil = dossier('v-profil');
    const memoire = fabriquerMemoire('v', DEUX);
    const tel = fabriquerTelephone('v-tel', DEUX);
    const racine = racineTel(tel);
    /** Pose un nom et son instant de saisie dans la fiche de la session `k` du dossier `dir`, comme la saisie du nom le fait. */
    const nommer = (dir, k, nom, instantMs) => {
      const f = join(dir, 'sessions', `${MODELES[k].nom}.json`);
      const fiche = lireJson(f);
      writeFileSync(f, `${JSON.stringify({ ...fiche, name: nom, editedAt: { ...(fiche.editedAt ?? {}), name: instantMs } })}\n`);
    };
    const nomDe = (dir, k) => lireJson(join(dir, 'sessions', `${MODELES[k].nom}.json`))?.name ?? null;
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'v', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'v1, première synchronisation');
      check('v1. première synchronisation faite (écran de départ passé, deux sessions sur chaque appareil)', r.depart !== null && gpxsDe(memoire).length === 2 && gpxsDe(racine).length === 2, r.titre);
      await fermerFenetre(b);
      await b.wait(1500);
      // Deux sessions, chacune renommée des deux côtés : le téléphone saisit le dernier pour la première, l'ordinateur pour la seconde.
      const maintenant = Date.now();
      nommer(memoire, 0, 'Nom ordinateur A', maintenant - 120000);
      nommer(racine, 0, 'Nom téléphone A', maintenant - 5000);
      nommer(memoire, 1, 'Nom ordinateur B', maintenant - 5000);
      nommer(racine, 1, 'Nom téléphone B', maintenant - 120000);
      await b.wait(500);
      r = await synchroniser(b, 'v2, noms changés des deux côtés');
      check('v2. un encadré dit que 2 sessions ont été modifiées sur les deux appareils et que la plus ancienne version a été remplacée', /2 sessions modifiées sur les deux appareils : .*c'est la version écrite en dernier qui est gardée .*et la plus ancienne a été remplacée\./.test(r.tout ?? ''), JSON.stringify([r.notes, r.tout]));
      await b.wait(1500);
      check('v2. première session : « Nom téléphone A » (saisi en dernier) des deux côtés', nomDe(memoire, 0) === 'Nom téléphone A' && nomDe(racine, 0) === 'Nom téléphone A', `${nomDe(memoire, 0)} / ${nomDe(racine, 0)}`);
      check('v2. seconde session : « Nom ordinateur B » (saisi en dernier) des deux côtés', nomDe(memoire, 1) === 'Nom ordinateur B' && nomDe(racine, 1) === 'Nom ordinateur B', `${nomDe(memoire, 1)} / ${nomDe(racine, 1)}`);
      check('v2. la date de saisie suit le nom gardé, des deux côtés', lireJson(join(memoire, 'sessions', `${MODELES[0].nom}.json`))?.editedAt?.name === maintenant - 5000 && lireJson(join(racine, 'sessions', `${MODELES[0].nom}.json`))?.editedAt?.name === maintenant - 5000, JSON.stringify([lireJson(join(memoire, 'sessions', `${MODELES[0].nom}.json`))?.editedAt, lireJson(join(racine, 'sessions', `${MODELES[0].nom}.json`))?.editedAt]));
      check('v2. rien à la corbeille (la version perdante ne fait pas de doublon), les deux sessions sont toujours là', corbeilleDe(memoire).entries.length === 0 && gpxsDe(memoire).length === 2 && gpxsDe(racine).length === 2, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);
      r = await synchroniser(b, 'v3, synchronisation suivante');
      check('v3. la suivante est ordinaire : « Tout est à jour », les noms ne bougent plus', r.titre === 'Tout est à jour' && nomDe(memoire, 0) === 'Nom téléphone A' && nomDe(racine, 1) === 'Nom ordinateur B', JSON.stringify([r.titre, nomDe(memoire, 0), nomDe(racine, 1)]));
      await fermerFenetre(b);
    });
  }

  // ---------- n. nombres par appareil ----------
  console.log('\n== n. Nombres par appareil : deux supprimées sur l\'ordinateur, une de plus, puis une sur le téléphone : chaque appareil compte ses suppressions, rien ne s\'additionne');
  if (veut('n')) {
    const SIX = [0, 1, 2, 3, 4, 5];
    const profil = dossier('n-profil');
    const memoire = fabriquerMemoire('n', SIX);
    const tel = fabriquerTelephone('n-tel', SIX);
    const racine = racineTel(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'n', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'n1, première synchronisation');
      check('n1. deux mémoires identiques : aucune ligne', r.lignes.length === 0, JSON.stringify(r.lignes));
      await b.wait(1500);
      await fermerFenetre(b);

      // Deux supprimées sur l'ordinateur (plus du quart de six) : la question, sur l'ordinateur ; fermée sans réponse.
      retirer(memoire, [0, 1]);
      r = await synchroniser(b, 'n2, deux supprimées sur l\'ordinateur');
      verifierQuestionGarde('n2', r, 2, "Sur l'ordinateur");
      await fermerFenetreParLaCroix(b);
      await fermerFenetreParLaCroix(b);
      // Une de plus sur l'ordinateur : trois, pas cinq (la question fermée n'a rien additionné).
      retirer(memoire, [2]);
      r = await synchroniser(b, 'n3, une de plus sur l\'ordinateur');
      verifierQuestionGarde('n3', r, 3, "Sur l'ordinateur");
      await fermerFenetreParLaCroix(b);
      await fermerFenetreParLaCroix(b);
      // Une sur le téléphone : une ligne par appareil, « Sur le téléphone » d'abord, chacune son nombre (1 et 3, jamais 4).
      retirer(racine, [3]);
      r = await synchroniser(b, 'n4, une sur le téléphone');
      check('n4. deux lignes, une par appareil : « Sur le téléphone : 1 session supprimée » (1 nom) puis « Sur l\'ordinateur : 3 sessions supprimées » (3 noms), dépliées', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length, l.ouverte])) === JSON.stringify([['Sur le téléphone', '1 session supprimée', 1, true], ["Sur l'ordinateur", '3 sessions supprimées', 3, true]]), JSON.stringify(r.lignes));
      check('n4. « Beaucoup de suppressions d\'un coup » : jamais le total « 4 »', r.titre === "Beaucoup de suppressions d'un coup" && !/\b4 sessions/.test(r.tout), JSON.stringify([r.titre, r.tout]));
      await capturer(b, 'synchroniser-nombres-par-appareil');
      r = await repondre(b, 'n4, « Tout garder »', 'Tout garder');
      check('n4. « Gardé : 4 sessions gardées : remises là où elles manquaient » (4 noms), seule ligne', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Gardé', '4 sessions gardées : remises là où elles manquaient', 4]]), JSON.stringify(r.lignes));
      await b.wait(2000);
      memesSessions('n4, après « Tout garder » (six sessions des deux côtés)', memoire, tel, SIX);
      check('n4. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);

      // Deux sessions supprimées sur le téléphone, « Supprimer des deux côtés » : deux, et pas davantage.
      retirer(racine, [4, 5]);
      r = await synchroniser(b, 'n5, deux supprimées sur le téléphone');
      verifierQuestionGarde('n5', r, 2);
      r = await repondre(b, 'n5, « Supprimer des deux côtés »', 'Supprimer des deux côtés');
      check('n5. « Supprimé : 2 sessions supprimées sur le téléphone : elles sont dans la corbeille de l\'ordinateur pour 30 jours » (2 noms), seule ligne', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Supprimé', "2 sessions supprimées sur le téléphone : elles sont dans la corbeille de l'ordinateur pour 30 jours", 2]]), JSON.stringify(r.lignes));
      await b.wait(2000);
      memesSessions('n5', memoire, tel, [0, 1, 2, 3]);
      check('n5. la corbeille porte deux entrées', corbeilleDe(memoire).entries.length === 2, JSON.stringify(corbeilleDe(memoire).index));
      await fermerFenetre(b);
      r = await synchroniser(b, 'n6, synchronisation suivante');
      check('n6. « Tout est à jour » : plus rien ne reste en attente', r.titre === 'Tout est à jour' && r.lignes.length === 0 && r.notes.length === 0, JSON.stringify([r.titre, r.lignes, r.notes]));
      await fermerFenetre(b);
    });
  }

  // ---------- w. attente, puis départ seul à l'arrivée du téléphone ----------
  console.log('\n== w. Téléphone absent : la fenêtre attend, sans conseil de câble, et part seule à l\'arrivée du téléphone');
  if (veut('w')) {
    const profil = dossier('w-profil');
    const memoire = fabriquerMemoire('w', [3, 4, 5]);
    // Le téléphone est prêt dans un dossier à part ; le stockage que le programme lit n'existe pas encore : téléphone absent.
    const pret = fabriquerTelephone('w-tel-pret', [0, 1, 2, 3]);
    const stockage = join(RACINE, 'w-tel-arrive');
    await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: stockage }, 'w', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await synchroniser(b, 'w1, téléphone absent');
      check('w1. rien de relié ni de branché : « Aucun téléphone relié », la fenêtre ne dit pas un mot de câble, de débogage ni d\'outil', r.titre === 'Aucun téléphone relié' && !/câble|USB|Débogage|outil|platform-tools/i.test(r.tout), JSON.stringify([r.titre, r.tout]));
      await b.wait(3500);
      check('w1. trois secondes plus tard, elle est toujours là, rien n\'est parti', (await releve(b))?.titre === 'Aucun téléphone relié' && copiesDe(profil).length === 0 && !existsSync(join(memoire, 'synchro')));
      // Le téléphone arrive : aucun clic de plus, la synchronisation part seule (écran de départ, puis « Commencer » par le script comme par l'utilisateur).
      renameSync(pret, stockage);
      await b.waitFor(`!/Aucun téléphone relié/.test(document.querySelector('[role=dialog].phone-sync__dialog')?.getAttribute('aria-label') ?? 'x')`, { timeout: 20000, label: 'départ à l\'arrivée du téléphone' });
      r = await suivre(b, 'w2, à l\'arrivée du téléphone');
      check('w2. la synchronisation est partie seule : écran de départ de la première synchronisation, puis compte rendu', r.depart !== null && r.titre === 'Synchronisation terminée', JSON.stringify([r.depart?.titre, r.titre]));
      check('w2. « Reçu du téléphone : 3 sessions » puis « Envoyé au téléphone : 2 sessions »', JSON.stringify(r.lignes.map((l) => [l.geste, l.texte, l.noms.length])) === JSON.stringify([['Reçu du téléphone', '3 sessions', 3], ['Envoyé au téléphone', '2 sessions', 2]]), JSON.stringify(r.lignes));
      await b.wait(2000);
      memesSessions('w2', memoire, stockage, [0, 1, 2, 3, 4, 5]);
      check('w2. une copie de sécurité, faite avant', copiesDe(profil).length === 1, copiesDe(profil).join(','));
      const attente = journalDeLaFenetre(profil);
      console.log(`  journal de la fenêtre (journal.txt du profil) : ${attente.join(' | ')}`);
      check('w2. le journal du profil dit l\'attente (téléphone absent), sa fin et la reprise, sans nom ni chemin', attente.some((l) => /attente \(téléphone absent\)/.test(l)) && attente.some((l) => /fin de l'attente, reprise/.test(l)) && !attente.some((l) => /gtk-syn|Téléphone d'essai|Users/.test(l)), attente.join(' | '));
      await fermerFenetre(b);
    });
  }

  // ---------- p. écran de départ : dossier refusé, dossier choisi, fermer arrête tout ----------
  console.log('\n== p. Écran de départ : un dossier refusé (dans la mémoire), fermer l\'écran arrête tout, un dossier choisi reçoit la copie, « Ouvrir le dossier »');
  if (veut('p')) {
    const PHONE_P = [0, 1, 2, 3];
    const PC_P = [3, 4, 5];
    // p1 : le « choix » d'essai est un dossier de la mémoire de l'ordinateur : refusé.
    {
      const profil = dossier('p1-profil');
      const memoire = fabriquerMemoire('p1', PC_P);
      const tel = fabriquerTelephone('p1-tel', PHONE_P);
      const avantPc = empreinte(memoire, (c) => c.startsWith('sessions/'));
      const avantTel = empreinte(tel);
      await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_COPIES: join(memoire, 'mes-copies') }, 'p1', async (b, p) => {
        await b.go('/sessions', 5000);
        await b.settle({ max: 2000 });
        let r = await synchroniser(b, 'p1, écran de départ', { depart: 'rester' });
        check('p1. l\'écran de départ attend : « Choisir un autre dossier » et « Commencer », rien n\'est encore fait', /^Première synchronisation avec /.test(r.titre) && (r.boutons ?? []).join('/') === 'Choisir un autre dossier/Commencer' && copiesDe(profil).length === 0 && empreinte(tel) === avantTel, JSON.stringify([r.titre, r.boutons]));
        const defaut = r.dossier;
        check('p1. « Choisir un autre dossier »', (await b.clickText('Choisir un autre dossier', '.phone-sync__actions button')) === 'ok');
        await b.wait(1200);
        r = await releve(b);
        check('p1. un dossier dans la mémoire est refusé, dit en clair : « Les copies ne peuvent pas aller dans la mémoire de cet ordinateur : choisissez un autre dossier. », et le dossier montré ne change pas', r.paragraphes.includes('Les copies ne peuvent pas aller dans la mémoire de cet ordinateur : choisissez un autre dossier.') && r.dossier === defaut, JSON.stringify([r.paragraphes, r.dossier, defaut]));
        check('p1. le journal dit qu\'un dossier a été choisi (sans chemin)', p.journal.some((l) => /choix du dossier des copies : un dossier/.test(l)), p.journal.slice(-5).join(' | '));
        // Fermer l'écran de départ : tout s'arrête, rien n'est fait.
        await fermerFenetreParLaCroix(b);
        await b.wait(600);
        check('p1. fermer l\'écran de départ arrête tout : la fenêtre se ferme, aucune copie, ni base, ni écriture sur le téléphone ou sur l\'ordinateur', (await releve(b)) === null && copiesDe(profil).length === 0 && !existsSync(join(memoire, 'synchro')) && empreinte(tel) === avantTel && empreinte(memoire, (c) => c.startsWith('sessions/')) === avantPc && !existsSync(join(memoire, 'corbeille')), `${copiesDe(profil)} ${(arbre(memoire) ?? []).join(',')}`);
        check('p1. le journal du profil dit l\'écran de départ puis sa fermeture, rien de fait', journalDeLaFenetre(profil).some((l) => /écran de départ de la première synchronisation/.test(l)) && journalDeLaFenetre(profil).some((l) => /écran de départ fermé, rien de fait/.test(l)), journalDeLaFenetre(profil).join(' | '));
        // « Synchroniser » repart de zéro : l'écran de départ revient, « Commencer » (dossier par défaut) mène au bout.
        r = await synchroniser(b, 'p1, de nouveau');
        check('p1. l\'écran de départ est revenu, puis la copie est faite dans le dossier par défaut', r.depart !== null && r.titre === 'Synchronisation terminée' && copiesDe(profil).length === 1 && r.dossier?.toLowerCase().startsWith(join(profil, 'Documents-essai', 'Gtracker-copies').toLowerCase()), JSON.stringify([r.depart?.titre, r.titre, r.dossier]));
        await b.wait(1500);
        memesSessions('p1', memoire, tel, [0, 1, 2, 3, 4, 5]);
      });
      check('p1. rien du dossier refusé n\'a été créé dans la mémoire', !existsSync(join(memoire, 'mes-copies')) && !lireJson(join(profil, 'copies.json')), (arbre(profil) ?? []).filter((c) => /copies/.test(c)).join(','));
    }
    // p2 : un dossier hors de la mémoire : choisi, montré, retenu par le programme (dans son profil, jamais dans la mémoire), reçoit la copie.
    {
      const profil = dossier('p2-profil');
      const memoire = fabriquerMemoire('p2', PC_P);
      const tel = fabriquerTelephone('p2-tel', PHONE_P);
      const choisi = dossier('p2-copies-choisies');
      await avecProgramme(profil, memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_COPIES: choisi }, 'p2', async (b, p) => {
        await b.go('/sessions', 5000);
        await b.settle({ max: 2000 });
        let r = await synchroniser(b, 'p2, écran de départ', { depart: 'rester' });
        check('p2. avant le choix, l\'écran montre le dossier par défaut', r.dossier?.toLowerCase() === join(profil, 'Documents-essai', 'Gtracker-copies').toLowerCase(), r.dossier);
        check('p2. « Choisir un autre dossier »', (await b.clickText('Choisir un autre dossier', '.phone-sync__actions button')) === 'ok');
        await b.waitFor(`document.querySelector('[role=dialog].phone-sync__dialog code.phone-sync__folder')?.textContent.trim().toLowerCase() === ${JSON.stringify(choisi.toLowerCase())}`, { timeout: 6000, label: 'dossier choisi montré' });
        r = await releve(b);
        check('p2. l\'écran montre le dossier choisi, sans phrase d\'erreur', r.dossier?.toLowerCase() === choisi.toLowerCase() && !r.paragraphes.some((l) => /ne peuvent pas aller/.test(l)), JSON.stringify([r.dossier, r.paragraphes]));
        await capturer(b, 'synchroniser-depart-dossier-choisi');
        check('p2. le choix est retenu par le programme, dans son profil (copies.json), jamais dans la mémoire', lireJson(join(profil, 'copies.json'))?.dossier?.toLowerCase() === choisi.toLowerCase() && contient(memoire, choisi).length === 0, JSON.stringify(lireJson(join(profil, 'copies.json'))));
        r = await suivre(b, 'p2, après « Commencer »');
        const dossiersCopie = existsSync(choisi) ? readdirSync(choisi) : [];
        check('p2. la copie de sécurité est dans le dossier choisi (un seul dossier daté), pas dans le dossier par défaut', dossiersCopie.length === 1 && /^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}$/.test(dossiersCopie[0]) && copiesDe(profil).length === 0, `${dossiersCopie} / défaut : ${copiesDe(profil)}`);
        check('p2. le compte rendu redit ce dossier daté, avec « Ouvrir le dossier »', dossiersCopie.length === 1 && r.dossier?.toLowerCase() === join(choisi, dossiersCopie[0]).toLowerCase() && (r.boutonsCorps ?? []).join('/') === 'Ouvrir le dossier', JSON.stringify([r.dossier, r.boutonsCorps]));
        if (dossiersCopie.length === 1) check('p2. la copie porte l\'état d\'avant des deux appareils', memes(sessionsDe(join(choisi, dossiersCopie[0], 'ordinateur')), sessionsDe(memoire).filter((n) => PC_P.some((k) => n.startsWith(MODELES[k].nom)))) && sessionsDe(join(choisi, dossiersCopie[0], 'telephone')).length === 8, `${sessionsDe(join(choisi, dossiersCopie[0], 'ordinateur')).length} / ${sessionsDe(join(choisi, dossiersCopie[0], 'telephone')).length}`);
        const avantJournal = p.journal.length;
        check('p2. « Ouvrir le dossier »', (await b.clickText('Ouvrir le dossier', '.phone-sync__body button')) === 'ok');
        await b.wait(700);
        check('p2. en essai, l\'ouverture est seulement journalisée (sans chemin), aucune erreur à l\'écran', p.journal.slice(avantJournal).some((l) => /ouverture d'un dossier des copies de sécurité/.test(l)) && !p.journal.slice(avantJournal).some((l) => l.includes(choisi)), p.journal.slice(avantJournal).join(' | '));
        await fermerFenetre(b);
      });
    }
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
      // Le téléphone s'en va (débranché pour de bon : le câble d'essai ne revient pas) : la fenêtre attend son retour, sans « Réessayer ».
      const r = await synchroniser(b, quoi, { attente: true });
      check(`${quoi} : la fenêtre attend le téléphone : « En attente de votre téléphone », « Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé. Elle reprend toute seule… »`, r.titre === 'En attente de votre téléphone' && r.paragraphes.length === 1 && r.paragraphes[0] === "Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé. Elle reprend toute seule dès qu'il revient : écran allumé, Gtracker affiché (ou câble rebranché).", JSON.stringify([r.titre, r.paragraphes]));
      check(`${quoi} : « Annuler » seul (jamais « Réessayer »)`, (r.boutons ?? []).join('/') === 'Annuler' && !/Réessayer/.test(r.tout), (r.boutons ?? []).join('/'));
      await b.wait(3500);
      const encore = await releve(b);
      check(`${quoi} : trois secondes plus tard, la fenêtre attend toujours (pas de boucle, pas de fausse reprise)`, encore?.titre === 'En attente de votre téléphone', encore?.titre);
      check(`${quoi} : « Annuler »`, (await b.clickText('Annuler', '.phone-sync__actions button')) === 'ok');
      await b.wait(800);
      const apres = await releve(b);
      if (dansCopie) {
        // Rien n'était fait : l'attente annulée ne laisse aucun compte rendu.
        check(`${quoi} : rien n'était fait (copie de sécurité interrompue) : la fenêtre se ferme, sans compte rendu`, apres === null, JSON.stringify(apres?.titre));
      } else {
        check(`${quoi} : ce qui est fait est dit : « Synchronisation arrêtée », « Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé. » (avec un « Détail » replié), « Recommencer » et « Fermer »`, apres?.titre === 'Synchronisation arrêtée' && apres.notes.includes("Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé.") && apres.details.length === 1 && (apres.boutons ?? []).join('/') === 'Recommencer/Fermer', JSON.stringify([apres?.titre, apres?.notes, apres?.details, apres?.boutons]));
        if (apres) aucunMotAncien(`${quoi}, compte rendu de l'arrêt`, apres);
        console.log(`  compte rendu de l'arrêt : ${JSON.stringify([apres?.paragraphes, apres?.lignes?.map((l) => `${l.geste} : ${l.texte}`), apres?.notes, apres?.details])}`);
      }
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
      check(`${quoi}, reprise : le compte rendu ne parle d'aucun arrêt (ni « Recommencer » ni « Réessayer »)`, (r.boutons ?? []).join('/') === 'Fermer' && r.notes.length === 0, JSON.stringify([r.boutons, r.notes]));
      check(`${quoi}, reprise : aucune suppression, aucune question`, !ligneDe(r, 'Supprimé') && r.titre !== 'Beaucoup de suppressions d\'un coup' && (r.lignes.length > 0 || r.paragraphes.length > 0), JSON.stringify([r.titre, r.lignes, r.paragraphes]));
      reprises.set(coupure, r.dossier ?? null);
      const reprise = (r.paragraphes ?? []).includes("La synchronisation précédente s'était arrêtée en route : elle vient d'être terminée.");
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
