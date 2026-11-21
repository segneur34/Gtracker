// Banc de test : le bouton « Récupérer » du programme Windows, face à un faux téléphone (un dossier local).
// Usage : node exe-recuperer.mjs <Gtracker.exe> [<port de débogage>]
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille (`GTRACKER_BANC=1`),
// sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le profil du vrai
// programme, jamais un vrai téléphone (en mode d'essai le vrai adb n'est jamais lancé). Le téléphone factice est un dossier
// qui joue le `/sdcard` (`GTRACKER_BANC_TELEPHONE`) ; l'état imposé (`GTRACKER_BANC_TELEPHONE_ETAT`) et la coupure après n
// lectures (`GTRACKER_BANC_TELEPHONE_COUPURE`) se règlent par l'environnement. Les GPX sont synthétiques (`lib/traces.mjs`),
// la fiche d'une session est celle que le programme écrit lui-même ; le disque se lit par Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose deux captures JPEG de la fenêtre : le compte rendu et l'état « absent ».
// Cas :
//  a. chaque état imposé (absent, autorisation, horsLigne, adbIntrouvable, occupe) : texte du message en entier (pour
//     « absent », sans-fil éteint : la phrase « Sans câble : allumez le sans-fil… » ferme le message),
//     « Réessayer » offert, dossier donné pour adbIntrouvable, rien de rangé dans la mémoire ;
//  b. téléphone sans dossier Documents/Gtracker : le message du dossier absent ;
//  c. trois sessions (dont une avec sa fiche et un nom à espace et accent) et des fichiers hors sessions/ : « 3 sessions
//     ajoutées », GPX et fiches rangés sans temporaire, rien de reglages/, itineraires/ ni lieux.json, trois lignes dans
//     la liste de la page Sessions ;
//  d. second clic : « 0 session ajoutée, 3 déjà présentes », le disque inchangé (noms, tailles, dates) ;
//  e. une quatrième session sur le téléphone : seule celle-là est ajoutée ;
//  f. coupure en route, deux fois (entre un GPX et sa fiche, puis plus loin) : message de débranchement, sessions rangées
//     entières, aucune moitié ni temporaire ; relancé sans coupure, ce qui manquait est rangé ;
//  g. dans tous les cas, le téléphone factice est intact (mêmes fichiers, tailles et dates qu'au départ) et la console
//     de la page sans erreur ;
//  h. corbeille : une session récupérée puis supprimée depuis sa ligne de Sessions (elle part à la corbeille du PC,
//     index à une entrée), toujours sur le téléphone : « Récupérer » la ramène (« 1 session ajoutée, 2 déjà présentes. »)
//     et elle quitte la corbeille (index sans son entrée, aucun sous-dossier).
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from './lib/cdp.mjs';
import { actionLigne } from './lib/sessions.mjs';
import { traceDroite } from './lib/traces.mjs';

const [exe, portArg] = process.argv.slice(2);
if (!exe) {
  console.error('Usage : node exe-recuperer.mjs <Gtracker.exe> [<port>]');
  process.exit(1);
}
const PORT = Number(portArg ?? 9497);
const ORIGINE = 'https://gtracker.localhost';
const CAPTURES = process.env.BANC_CAPTURES || null;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `);
const disparu = async (pid, ms) => { for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200); } return !vivant(pid); };

let echecs = 0;
const check = (quoi, ok, detail) => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) echecs++; };

const RACINE = mkdtempSync(join(tmpdir(), 'gtk-rec-'));
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
const temporaires = (racine) => (arbre(racine) ?? []).filter((c) => /\.gtracker-(tmp|new)$/.test(c));
const sessionsDe = (memoire) => (existsSync(join(memoire, 'sessions')) ? readdirSync(join(memoire, 'sessions')).sort() : []);
const gpxsDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.gpx'));
const fichesDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.json'));
/** Tous les fichiers d'une mémoire, contenu compris (pour chercher une marque). */
const contient = (racine, marque) => (arbre(racine) ?? []).filter((c) => !c.endsWith('/')).filter((c) => readFileSync(join(racine, c)).includes(marque));

const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  // Les variables du téléphone d'essai ne viennent jamais de l'environnement du poste.
  for (const cle of ['GTRACKER_BANC_TELEPHONE', 'GTRACKER_BANC_TELEPHONE_ETAT', 'GTRACKER_BANC_TELEPHONE_COUPURE']) if (!(cle in env)) delete complet[cle];
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
    check(`${quoi} : essai interrompu : ${e.message}`, false);
    return null;
  } finally {
    if (p) await fermer(p);
  }
}

const texte = (b) => b.evaluate('document.body.innerText');
const SELECTEUR_BOUTON = '.shell-topactions .phone-recover';
const DIALOGUE = '[role=dialog].phone-recover__dialog';
/** Ce que la fenêtre dit : phrases, dossier, progression, boutons (texte brut, la casse d'écran ne compte pas). */
const releve = (b) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(DIALOGUE)});
  if (!d) return null;
  const texte = (x) => x.textContent.trim();
  return {
    titre: d.getAttribute('aria-label'),
    paragraphes: [...d.querySelectorAll('.phone-recover__body p')].map(texte),
    dossier: [...d.querySelectorAll('code.phone-recover__folder')].map(texte)[0] ?? null,
    boutons: [...d.querySelectorAll('.phone-recover__actions button')].map(texte),
  };
})()`);
/** Clique « Récupérer » (barre du haut) et attend que la fenêtre ait fini de chercher et de lire. */
async function recuperer(b, quoi) {
  check(`${quoi} : le bouton « Récupérer » est dans la barre du haut`, (await b.evaluate(`document.querySelector(${JSON.stringify(SELECTEUR_BOUTON)})?.textContent.trim() ?? null`)) === 'Récupérer');
  check(`${quoi} : clic « Récupérer »`, (await b.click(SELECTEUR_BOUTON)) === 'ok');
  await b.waitFor(`(() => { const p = document.querySelector('${DIALOGUE} .phone-recover__body'); return Boolean(p) && p.textContent.trim() !== '' && !/Recherche du téléphone|Lecture du téléphone/.test(p.textContent); })()`, { timeout: 20000, label: 'issue de la récupération' });
  await b.wait(300);
  const r = await releve(b);
  console.log(`  fenêtre « ${r?.titre} » :`);
  for (const l of r?.paragraphes ?? []) console.log(`    | ${l}`);
  if (r?.dossier) console.log(`    dossier : ${r.dossier}`);
  console.log(`    boutons : ${(r?.boutons ?? []).join(' / ')}`);
  return r;
}
const fermerFenetre = async (b) => { await b.evaluate(`[...document.querySelectorAll('.phone-recover__actions button')].find((x) => x.textContent.trim() === 'Fermer')?.click()`); await b.wait(300); };
/** Capture JPEG de la page, 900 px de large au plus. */
async function capturer(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1400, height: 1000, scale: 0.64 } });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(r.result.data, 'base64'));
}
/** Lignes de la page Sessions : nombre de sessions annoncé dans le texte (un chiffre sur la ligne des sessions). */
async function pageSessions(b) {
  await b.go('/sessions', 5000);
  await b.waitFor(`/session/i.test(document.body.innerText)`, { timeout: 5000 });
  await b.settle({ max: 2000 });
  return texte(b);
}

// ---------- le faux téléphone ----------
const gpxSynthetique = (jour, heure, nom) => traceDroite({ debutMs: Date.UTC(2026, 9, jour, heure, 0, 0), secondes: 300, vitesse: 4, type: 'wingfoil', nom });
/** Début de nom d'un fichier de session : l'heure locale du départ, comme l'application la range (`AAAA-MM-JJ_HH-MM-SS`). */
const debutNom = (jour, heure) => {
  const d = new Date(Date.UTC(2026, 9, jour, heure, 0, 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};
/** Nom du téléphone : celui de l'application (`…_wingfoil`) sauf pour la session au nom à espace et accent. */
const nomSession = (s) => `${debutNom(s.jour, s.heure)}_${s.nom}`;
/** Nom que le PC range : toujours `<heure locale>_<activité>`, quel que soit le nom du GPX du téléphone. */
const nomPc = (s) => `${debutNom(s.jour, s.heure)}_wingfoil`;
const MARQUE = 'TELEPHONE-MARQUE-A-NE-PAS-COPIER';
/** Date de modification connue d'un fichier du téléphone : le premier octobre 2026 plus `jour` jours, à la seconde. */
const dater = (fichier, jour) => { const d = new Date(Date.UTC(2026, 9, jour, 12, 0, 0)); utimesSync(fichier, d, d); };
const DEPART = [
  { jour: 1, heure: 7, nom: 'Séance du matin', fiche: true },
  { jour: 2, heure: 8, nom: 'wingfoil', fiche: false },
  { jour: 3, heure: 9, nom: 'wingfoil', fiche: false },
];
const QUATRIEME = { jour: 4, heure: 10, nom: 'wingfoil', fiche: false };

/** Le programme importe `gpx` dans une mémoire neuve : la fiche rangée à côté est celle d'une vraie session. */
async function fabriquerFiche(gpx) {
  const profil = dossier('prep-profil');
  const memoire = dossier('prep-memoire');
  await avecProgramme(profil, memoire, {}, 'préparation de la fiche', async (b) => {
    await b.go('/sessions', 5000);
    check('préparation : import du GPX de la session à fiche', (await b.importGpx(gpx, 'fiche.gpx')) === 'ok');
    await b.waitFor(() => gpxsDe(memoire).length >= 1 && fichesDe(memoire).length >= 1, { timeout: 10000, label: 'GPX et fiche' });
    await b.wait(1500);
    await b.settle({ max: 2000 });
  });
  const g = gpxsDe(memoire)[0];
  const f = fichesDe(memoire)[0];
  check('préparation : une fiche vraie est sortie du programme', Boolean(g) && Boolean(f), `${g} ${f}`);
  return { gpx: join(memoire, 'sessions', g), fiche: join(memoire, 'sessions', f) };
}
/** Pose une session sur le téléphone factice ; `fiche` : chemin d'une fiche à copier à côté du GPX. */
function poserSession(telephone, s, modeleFiche) {
  const sessions = join(telephone, 'Documents', 'Gtracker', 'sessions');
  mkdirSync(sessions, { recursive: true });
  const base = nomSession(s);
  writeFileSync(join(sessions, `${base}.gpx`), gpxSynthetique(s.jour, s.heure, s.nom));
  dater(join(sessions, `${base}.gpx`), s.jour);
  if (s.fiche) { copyFileSync(modeleFiche, join(sessions, `${base}.json`)); dater(join(sessions, `${base}.json`), s.jour); }
}
/** Un téléphone avec les sessions données, et des fichiers hors de sessions/ que la récupération ne doit pas prendre. */
function fabriquerTelephone(nom, sessions, modeleFiche) {
  const tel = dossier(nom);
  const racine = join(tel, 'Documents', 'Gtracker');
  mkdirSync(join(racine, 'reglages'), { recursive: true });
  mkdirSync(join(racine, 'itineraires'), { recursive: true });
  writeFileSync(join(racine, 'lieux.json'), `{"marque":"${MARQUE}"}`);
  writeFileSync(join(racine, 'reglages', 'telephone-xiaomi.json'), `{"marque":"${MARQUE}"}`);
  writeFileSync(join(racine, 'itineraires', 'parcours-telephone.gpx'), `<gpx><!-- ${MARQUE} --></gpx>`);
  for (const f of ['lieux.json', 'reglages/telephone-xiaomi.json', 'itineraires/parcours-telephone.gpx']) dater(join(racine, ...f.split('/')), 9);
  for (const s of sessions) poserSession(tel, s, modeleFiche);
  return tel;
}
const memoireNeuve = (nom) => ({ profil: dossier(`${nom}-profil`), memoire: dossier(`${nom}-memoire`) });
/** Vérifie que le téléphone factice n'a pas bougé depuis `avant` (empreinte). */
const telephoneIntact = (quoi, telephone, avant) => check(`${quoi} : téléphone factice intact (fichiers, tailles et dates)`, empreinte(telephone) === avant, `\n--- avant ---\n${avant}\n--- après ---\n${empreinte(telephone)}`);
/** Les trois sessions du départ sont rangées entières, rien d'autre, aucun temporaire, rien de hors sessions/. */
function verifierMemoire(quoi, memoire, attendues) {
  const gpx = gpxsDe(memoire);
  check(`${quoi} : ${attendues.length} GPX dans sessions/ de la mémoire du PC`, gpx.length === attendues.length, gpx.join(' | '));
  for (const s of attendues) {
    const base = nomPc(s);
    check(`${quoi} : « ${base} » entière (GPX et fiche)`, gpx.includes(`${base}.gpx`) && fichesDe(memoire).includes(`${base}.json`), sessionsDe(memoire).join(' | '));
  }
  check(`${quoi} : aucun temporaire (.gtracker-tmp, .gtracker-new) dans la mémoire`, temporaires(memoire).length === 0, temporaires(memoire).join(','));
  check(`${quoi} : aucun fichier de la mémoire ne porte la marque du téléphone (ni lieux.json, ni reglages/, ni itineraires/)`, contient(memoire, MARQUE).length === 0, contient(memoire, MARQUE).join(','));
  const noms = (arbre(memoire) ?? []);
  check(`${quoi} : ni telephone-xiaomi.json ni parcours-telephone.gpx dans la mémoire`, !noms.some((c) => /telephone-xiaomi|parcours-telephone/.test(c)), noms.join(','));
}
/** Une ligne par session : sa date et son heure (« sam. 3 oct. 2026 · 11:00 »). */
const lignesSessions = (t) => (t.match(/\d{4} · \d{2}:\d{2}/g) ?? []).length;

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

try {
  const gpxFiche = gpxSynthetique(DEPART[0].jour, DEPART[0].heure, DEPART[0].nom);
  console.log('\n== Préparation : une fiche vraie, écrite par le programme');
  const modele = await fabriquerFiche(gpxFiche);
  console.log(`fiche modèle : ${modele.fiche.split('\\').pop()}`);

  // ---------- a. états imposés ----------
  console.log('\n== a. Chaque état imposé : message, « Réessayer », rien de rangé');
  for (const [etat, attendu] of Object.entries(ETATS)) {
    const M = memoireNeuve(`a-${etat}`);
    const tel = fabriquerTelephone(`a-${etat}-tel`, DEPART, modele.fiche);
    const avant = empreinte(tel);
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_ETAT: etat }, `a. ${etat}`, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await recuperer(b, `a. ${etat}`);
      check(`a. ${etat} : le texte du message, en entier`, JSON.stringify(r?.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify(r?.paragraphes));
      check(`a. ${etat} : « Réessayer » est offert (puis « Fermer »)`, (r?.boutons ?? []).join('/').toLowerCase() === 'réessayer/fermer', (r?.boutons ?? []).join('/'));
      if (etat === 'adbIntrouvable') {
        check('a. adbIntrouvable : le dossier où poser l\'outil est affiché (platform-tools du profil)', Boolean(r?.dossier) && r.dossier.toLowerCase().startsWith(M.profil.toLowerCase()) && /platform-tools$/.test(r.dossier), r?.dossier);
      } else check(`a. ${etat} : pas de dossier à recopier`, r?.dossier === null, r?.dossier);
      if (etat === 'absent') await capturer(b, 'recuperer-absent');
      // « Réessayer » rejoue le même état : même texte.
      check(`a. ${etat} : « Réessayer »`, (await b.clickText('Réessayer', '.phone-recover__actions button')) === 'ok');
      await b.wait(1500);
      const r2 = await releve(b);
      check(`a. ${etat} : « Réessayer » redit le même message`, JSON.stringify(r2?.paragraphes) === JSON.stringify(attendu.paragraphes), JSON.stringify(r2?.paragraphes));
    });
    check(`a. ${etat} : rien de rangé dans la mémoire (sessions/ vide)`, sessionsDe(M.memoire).length === 0, sessionsDe(M.memoire).join(' | '));
    telephoneIntact(`a. ${etat}`, tel, avant);
  }

  // ---------- b. dossier absent ----------
  console.log('\n== b. Téléphone sans dossier Documents/Gtracker');
  {
    const M = memoireNeuve('b');
    const tel = dossier('b-tel');
    mkdirSync(join(tel, 'Download'), { recursive: true });
    writeFileSync(join(tel, 'Download', 'autre.txt'), 'sans rapport');
    const avant = empreinte(tel);
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'b', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await recuperer(b, 'b');
      const attendu = ["Le téléphone Téléphone d'essai n'a pas de dossier « Documents/Gtracker ». Gtracker ne récupère que les sessions rangées dans ce dossier : sur le téléphone, ouvrez Gtracker, Réglages, Mémoire, pour voir où il les range."];
      check('b. le message du dossier absent, en entier', JSON.stringify(r?.paragraphes) === JSON.stringify(attendu), JSON.stringify(r?.paragraphes));
      check('b. « Réessayer » offert', (r?.boutons ?? []).join('/').toLowerCase() === 'réessayer/fermer', (r?.boutons ?? []).join('/'));
    });
    check('b. rien de rangé dans la mémoire', sessionsDe(M.memoire).length === 0);
    telephoneIntact('b', tel, avant);
  }

  // ---------- c, d, e. trois sessions, second clic, quatrième ----------
  console.log('\n== c, d, e. Trois sessions, second clic, quatrième session');
  {
    const M = memoireNeuve('c');
    const tel = fabriquerTelephone('c-tel', DEPART, modele.fiche);
    const avant = empreinte(tel);
    console.log(`téléphone factice :\n  ${(arbre(tel) ?? []).join('\n  ')}`);
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'c, d, e', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const avantListe = await pageSessions(b);
      check('c. avant : la page Sessions est vide', lignesSessions(avantListe) === 0, avantListe.slice(0, 200));

      // c
      let r = await recuperer(b, 'c');
      check('c. le compte rendu dit « 3 sessions ajoutées. »', JSON.stringify(r?.paragraphes) === JSON.stringify(['3 sessions ajoutées.']), JSON.stringify(r?.paragraphes));
      check('c. seul « Fermer » est offert', (r?.boutons ?? []).join('/').toLowerCase() === 'fermer', (r?.boutons ?? []).join('/'));
      await capturer(b, 'recuperer-compte-rendu');
      await b.wait(2000); // réécritures différées des fiches
      verifierMemoire('c', M.memoire, DEPART);
      telephoneIntact('c', tel, avant);
      await fermerFenetre(b);
      const liste = await pageSessions(b);
      check('c. la page Sessions montre trois lignes', lignesSessions(liste) === 3, `${lignesSessions(liste)} « Wingfoil » dans ${liste.slice(0, 300)}`);
      await b.wait(2000);
      const empreinteC = empreinte(join(M.memoire, 'sessions'));
      console.log(`mémoire du PC, sessions/ :\n  ${sessionsDe(M.memoire).join('\n  ')}`);

      // d
      r = await recuperer(b, 'd');
      check('d. le compte rendu dit « 0 session ajoutée, 3 déjà présentes. »', JSON.stringify(r?.paragraphes) === JSON.stringify(['0 session ajoutée, 3 déjà présentes.']), JSON.stringify(r?.paragraphes));
      await b.wait(1500);
      check('d. le disque n\'a pas changé (noms, tailles, dates de sessions/)', empreinte(join(M.memoire, 'sessions')) === empreinteC, `\n${empreinteC}\n--\n${empreinte(join(M.memoire, 'sessions'))}`);
      telephoneIntact('d', tel, avant);
      await fermerFenetre(b);

      // e
      poserSession(tel, QUATRIEME, modele.fiche);
      const avantE = empreinte(tel);
      r = await recuperer(b, 'e');
      check('e. le compte rendu dit « 1 session ajoutée, 3 déjà présentes. »', JSON.stringify(r?.paragraphes) === JSON.stringify(['1 session ajoutée, 3 déjà présentes.']), JSON.stringify(r?.paragraphes));
      await b.wait(2000);
      verifierMemoire('e', M.memoire, [...DEPART, QUATRIEME]);
      const garde = empreinteC.split('|');
      const apres = empreinte(join(M.memoire, 'sessions')).split('|');
      check('e. les trois premières sessions n\'ont pas bougé (noms, tailles, dates)', garde.every((l) => apres.includes(l)), apres.join('\n'));
      telephoneIntact('e', tel, avantE);
      await fermerFenetre(b);
      const listeE = await pageSessions(b);
      check('e. la page Sessions montre quatre lignes', lignesSessions(listeE) === 4, `${lignesSessions(listeE)}`);
    });
  }

  // ---------- f. coupure ----------
  console.log('\n== f. Téléphone débranché en route');
  for (const coupure of [1, 3]) {
    const quoi = `f (coupure après ${coupure} lecture${coupure > 1 ? 's' : ''})`;
    const M = memoireNeuve(`f${coupure}`);
    const tel = fabriquerTelephone(`f${coupure}-tel`, DEPART, modele.fiche);
    const avant = empreinte(tel);
    let rangees = [];
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel, GTRACKER_BANC_TELEPHONE_COUPURE: String(coupure) }, quoi, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await recuperer(b, quoi);
      check(`${quoi} : le message de débranchement est dit`, /Le téléphone a été débranché pendant la récupération\. Les sessions déjà rangées restent sur le PC, entières : aucune n'est rangée à moitié\./.test(r?.paragraphes?.[0] ?? ''), JSON.stringify(r?.paragraphes));
      check(`${quoi} : « Rebranchez-le, puis cliquez sur « Réessayer » »`, /Rebranchez-le, puis cliquez sur « Réessayer »/.test(r?.paragraphes?.join(' ') ?? ''));
      check(`${quoi} : « Réessayer » offert`, (r?.boutons ?? []).join('/').toLowerCase() === 'réessayer/fermer', (r?.boutons ?? []).join('/'));
      await b.wait(2000);
    });
    rangees = gpxsDe(M.memoire);
    console.log(`  rangées au débranchement : ${rangees.join(' ; ') || '(aucune)'}`);
    for (const g of rangees) {
      const base = g.replace(/\.gpx$/, '');
      check(`${quoi} : « ${base} » est entière (GPX et fiche présents)`, fichesDe(M.memoire).includes(`${base}.json`), sessionsDe(M.memoire).join(' | '));
    }
    check(`${quoi} : pas plus de fiches que de GPX (aucune moitié de session)`, fichesDe(M.memoire).length === rangees.length, `${fichesDe(M.memoire).length} fiches, ${rangees.length} GPX`);
    check(`${quoi} : moins de trois sessions rangées`, rangees.length < 3, String(rangees.length));
    check(`${quoi} : aucun temporaire dans la mémoire`, temporaires(M.memoire).length === 0, temporaires(M.memoire).join(','));
    check(`${quoi} : rien du téléphone hors sessions/ n'est copié`, contient(M.memoire, MARQUE).length === 0, contient(M.memoire, MARQUE).join(','));
    telephoneIntact(quoi, tel, avant);

    // Relance sans coupure : ce qui manquait est rangé.
    const manquantes = 3 - rangees.length;
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel }, `${quoi}, reprise`, async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      const r = await recuperer(b, `${quoi}, reprise`);
      const attendu = [`${manquantes} ${manquantes > 1 ? 'sessions ajoutées' : 'session ajoutée'}${rangees.length > 0 ? `, ${rangees.length} ${rangees.length > 1 ? 'déjà présentes' : 'déjà présente'}` : ''}.`];
      check(`${quoi}, reprise : le compte rendu dit « ${attendu[0]} »`, JSON.stringify(r?.paragraphes) === JSON.stringify(attendu), JSON.stringify(r?.paragraphes));
      await b.wait(2000);
    });
    verifierMemoire(`${quoi}, reprise`, M.memoire, DEPART);
    telephoneIntact(`${quoi}, reprise`, tel, avant);
  }

  // ---------- h. corbeille puis « Récupérer » ----------
  console.log('\n== h. Une session mise à la corbeille sur le PC, présente sur le téléphone : « Récupérer » la ramène et elle quitte la corbeille');
  {
    const M = memoireNeuve('h');
    const tel = fabriquerTelephone('h-tel', DEPART, modele.fiche);
    const avant = empreinte(tel);
    const corbeille = join(M.memoire, 'corbeille');
    const indexH = () => { try { return JSON.parse(readFileSync(join(corbeille, 'corbeille.json'), 'utf8').replace(/^﻿/, '')); } catch { return null; } };
    const dossiersH = () => (existsSync(corbeille) ? readdirSync(corbeille, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
    await avecProgramme(M.profil, M.memoire, { GTRACKER_BANC_TELEPHONE: tel }, 'h', async (b) => {
      await b.go('/sessions', 5000);
      await b.settle({ max: 2000 });
      let r = await recuperer(b, 'h1');
      check('h1. le compte rendu dit « 3 sessions ajoutées. »', JSON.stringify(r?.paragraphes) === JSON.stringify(['3 sessions ajoutées.']), JSON.stringify(r?.paragraphes));
      await b.wait(2000);
      verifierMemoire('h1', M.memoire, DEPART);
      check('h1. aucune corbeille sur le disque avant la suppression', !existsSync(corbeille), (arbre(corbeille) ?? []).join(','));
      await fermerFenetre(b);

      // Suppression de la première ligne de la page Sessions : elle part à la corbeille de l'ordinateur.
      await pageSessions(b);
      const avantGpx = gpxsDe(M.memoire);
      check('h2. « … » puis « Supprimer » de la première ligne', (await actionLigne(b.evaluate, b.wait, 'Wingfoil', 'Supprimer')) === 'ok');
      await b.waitFor(`Boolean(document.querySelector('.lib-row__confirm'))`, { timeout: 4000, label: 'confirmation' });
      const phrase = await b.evaluate(`document.querySelector('.lib-row__confirm').textContent.trim()`);
      console.log(`  confirmation : « ${phrase} »`);
      check('h2. la confirmation dit la corbeille et 30 jours', /corbeille/i.test(phrase) && /30 jours/.test(phrase), phrase);
      check('h2. « Confirmer »', (await b.clickText('Confirmer')) === 'ok');
      await b.waitFor(() => gpxsDe(M.memoire).length === 2 && indexH()?.entries?.length === 1, { timeout: 10000, label: 'session mise à la corbeille' });
      await b.wait(800);
      const partie = avantGpx.find((n) => !gpxsDe(M.memoire).includes(n));
      const e = indexH()?.entries?.[0];
      console.log(`  corbeille : ${(arbre(corbeille) ?? []).join(' ; ')}`);
      check('h2. le GPX et la fiche ont quitté sessions/ pour la corbeille (une entrée, un sous-dossier)', Boolean(partie) && !fichesDe(M.memoire).includes(partie.replace(/\.gpx$/, '.json')) && e?.main === partie && dossiersH().length === 1 && dossiersH()[0] === e?.dir, `${partie} ${JSON.stringify(e)}`);
      await pageSessions(b);
      check('h2. la page Sessions montre deux lignes', lignesSessions(await texte(b)) === 2);

      // « Récupérer » : le téléphone a toujours la session.
      r = await recuperer(b, 'h3');
      check('h3. le compte rendu dit « 1 session ajoutée, 2 déjà présentes. »', JSON.stringify(r?.paragraphes) === JSON.stringify(['1 session ajoutée, 2 déjà présentes.']), JSON.stringify(r?.paragraphes));
      await b.wait(2000);
      verifierMemoire('h3', M.memoire, DEPART);
      check('h3. la session récupérée est revenue sous son nom (GPX et fiche)', gpxsDe(M.memoire).includes(partie) && fichesDe(M.memoire).includes(partie.replace(/\.gpx$/, '.json')), sessionsDe(M.memoire).join(' | '));
      await b.waitFor(() => indexH()?.entries?.length === 0, { timeout: 8000, label: 'corbeille sans l\'entrée' });
      console.log(`  corbeille après « Récupérer » : ${(arbre(corbeille) ?? []).join(' ; ') || '(vide)'}`);
      check('h3. la corbeille ne porte plus son entrée (index sans entrée, aucun sous-dossier)', indexH()?.entries?.length === 0 && dossiersH().length === 0, `${JSON.stringify(indexH())} ${dossiersH().join(',')}`);
      telephoneIntact('h3', tel, avant);
      await fermerFenetre(b);
      const listeH = await pageSessions(b);
      check('h3. la page Sessions montre trois lignes', lignesSessions(listeH) === 3, `${lignesSessions(listeH)}`);
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

console.log(echecs === 0 ? '\nTout passe.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
