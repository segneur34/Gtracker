// Banc de test : la liaison sans câble du programme Windows, face à un faux téléphone (`bureau/fauxTelephone.ts`).
// Usage : node exe-sansfil.mjs <Gtracker.exe> [<port de débogage>]
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille
// (`GTRACKER_BANC=1`), sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le
// profil du vrai programme, jamais un vrai téléphone. En mode d'essai le serveur du sans-fil n'écoute que sur 127.0.0.1,
// sur un port libre que la page affiche avec le code (`GTRACKER_BANC_SANSFIL_*`, `bureau/sansFil.ts`). Le faux téléphone
// est celui de `bureau/dist/fauxTelephone.js` (la coquille compilée avec le programme : à refaire avec lui, `npm run exe`) ;
// il lit un dossier du disque qui joue `Documents/Gtracker` du téléphone et n'y écrit jamais. Le code d'appairage se lit
// sur la page du programme, comme le ferait l'utilisateur ; le disque se lit par Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG du bloc « Téléphone sans câble » de Réglages › Mémoire.
// Cas (un programme par cas, sauf mention) :
//  1. principal : sans-fil éteint (phrase d'avertissement de Windows, pas de « Relier »), allumé par la case (état,
//     aide, dossier de secrets du profil) ; fenêtre de liaison (adresse, code de 6 chiffres, décompte qui baisse) ;
//     trois mauvais codes : la fenêtre se ferme (la page le dit) et le bon code est refusé ; nouvelle fenêtre, un mauvais
//     code puis le bon : téléphone relié, « 3 sessions ajoutées » (dont une de plus de 2 Mio, en plusieurs blocs,
//     octet pour octet), toutes entières, aucun temporaire, téléphone factice intact ; le même téléphone se représente
//     par son jeton : « toutes ses sessions sont déjà là », disque inchangé ; « Récupérer » par le Wi-Fi avec une
//     quatrième session ; aucun secret (jeton, clé, certificat) dans le dossier mémoire, ni dans la page ; « Retirer » :
//     la liaison se ferme et le jeton est refusé ;
//     (depuis que plus rien n'arrive seul : l'arrivée du téléphone ne dit que « Téléphone relié : touchez « Synchroniser »
//     pour mettre les deux appareils à jour. » et ne range rien ; « Synchroniser » par le Wi-Fi copie les sessions vers
//     l'ordinateur et laisse le téléphone intact : ni copie de sécurité, ni identifiant posé, rien à la corbeille ; la
//     quatrième session passe par « Synchroniser » aussi) ;
//  2. fenêtre expirée (`GTRACKER_BANC_SANSFIL_FENETRE_MS` court) : le décompte arrive à 0:00, la page le dit, le bon code
//     est refusé, rien n'est rangé ; dans la fenêtre neuve, l'arrivée ne range rien, « Synchroniser » copie les deux sessions ;
//  3. coupure en plein transfert (le faux téléphone coupe au milieu du gros fichier) : « Synchroniser » le dit (liaison
//     coupée pendant la synchronisation, « Réessayer »), rien n'est écrit à moitié (chaque session rangée est entière,
//     aucun temporaire), le téléphone se représente par son jeton et « Réessayer » range ce qui manquait.
// Dans chaque compte rendu de « Synchroniser » (`attendreIssue`), relevé phrase par phrase pendant la copie et à la fin : la
// première phrase est « Sans câble, le téléphone n'est pas modifié : seules ses sessions sont copiées vers l'ordinateur. »
// (après la ligne de reprise d'une synchronisation coupée, s'il y en a une) et aucune phrase « Première synchronisation… ».
// Les sessions du faux téléphone (GPX et fiche) sont écrites d'abord par le programme lui-même, dans une mémoire de
// préparation, puis copiées : une session sans fiche est « laissée pour la prochaine fois ».
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, FORMATS } from './lib/cdp.mjs';
import { traceDroite } from './lib/traces.mjs';

const [exe, portArg] = process.argv.slice(2);
if (!exe) {
  console.error('Usage : node exe-sansfil.mjs <Gtracker.exe> [<port>]');
  process.exit(1);
}
const PORT = Number(portArg ?? 9496);
const ORIGINE = 'https://gtracker.localhost';
const CAPTURES = process.env.BANC_CAPTURES || null;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `);
const disparu = async (pid, ms) => { for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200); } return !vivant(pid); };

let echecs = 0;
const check = (quoi, ok, detail) => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) echecs++; };

// Le faux téléphone : la coquille compilée (CommonJS) du dépôt.
const require = createRequire(import.meta.url);
const { FauxTelephone } = require(fileURLToPath(new URL('../../bureau/dist/fauxTelephone.js', import.meta.url)));

const RACINE = mkdtempSync(join(tmpdir(), 'gtk-sf-'));
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
/** Fichiers sous `racine` dont le contenu porte l'une des `marques` (chaînes ou tampons). */
const contenant = (racine, marques) => (arbre(racine) ?? []).filter((c) => !c.endsWith('/')).filter((c) => { const o = readFileSync(join(racine, c)); return marques.some((m) => o.includes(m)); });

const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const temp = dossier(`${profil.split(/[\\/]/).pop()}-temp`);
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', TEMP: temp, TMP: temp, ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  // Les variables du sans-fil et du téléphone d'essai ne viennent jamais de l'environnement du poste.
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
  return { child, journal, b, temp };
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
    await essai(p.b, p);
    check(`${quoi} : console de la page sans erreur`, p.b.logs.length === 0, p.b.logs.join(' | '));
    const sansFil = p.journal.filter((l) => /sans-fil|téléphone|appairage|fenêtre/i.test(l));
    console.log(`  journal de la coquille (sans-fil) : ${sansFil.join(' | ') || '(rien)'}`);
  } catch (e) {
    check(`${quoi} : essai interrompu : ${e.stack ?? e.message}`, false);
  } finally {
    if (p) await fermer(p);
  }
}

// ---------- le faux téléphone ----------
/** Début de nom d'un fichier de session : l'heure locale du départ, comme l'application la range (`AAAA-MM-JJ_HH-MM-SS`). */
const debutNom = (jour, heure) => {
  const d = new Date(Date.UTC(2026, 9, jour, heure, 0, 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};
const MARQUE = 'TELEPHONE-MARQUE-A-NE-PAS-COPIER';
const SESSIONS = [
  { jour: 1, heure: 7, secondes: 300 },
  { jour: 2, heure: 8, secondes: 300 },
  // Plus de 2 Mio de GPX : trois blocs de 1 Mio sur la liaison.
  { jour: 3, heure: 9, secondes: 20000 },
];
const QUATRIEME = { jour: 4, heure: 10, secondes: 300 };
const nomFichier = (s) => `${debutNom(s.jour, s.heure)}_wingfoil.gpx`;
/** GPX et fiche de chaque session, écrits par le programme dans une mémoire neuve (nom du GPX → chemins) : ce sont ceux d'une vraie session. */
let MODELES = new Map();
async function fabriquerModeles() {
  const profil = dossier('prep-profil');
  const memoire = dossier('prep-memoire');
  const toutes = [...SESSIONS, QUATRIEME];
  await avecProgramme(profil, memoire, {}, 'préparation', async (b) => {
    await b.go('/sessions', 5000);
    for (const [k, s] of toutes.entries()) {
      const gpx = traceDroite({ debutMs: Date.UTC(2026, 9, s.jour, s.heure, 0, 0), secondes: s.secondes, vitesse: 4, type: 'wingfoil', nom: 'wingfoil' });
      check(`préparation : import de la session ${k + 1}`, (await b.importGpx(gpx, `modele-${k + 1}.gpx`)) === 'ok');
      await b.waitFor(() => gpxsDe(memoire).length >= k + 1 && fichesDe(memoire).length >= k + 1, { timeout: 30000, label: `GPX et fiche ${k + 1}` });
      await b.settle({ max: 1500 });
    }
    await b.wait(1500);
  });
  check(`préparation : ${toutes.length} sessions entières sortent du programme`, gpxsDe(memoire).length === toutes.length && fichesDe(memoire).length === toutes.length, `${gpxsDe(memoire).length} GPX, ${fichesDe(memoire).length} fiches`);
  MODELES = new Map(gpxsDe(memoire).map((nom) => [nom, { gpx: join(memoire, 'sessions', nom), fiche: join(memoire, 'sessions', nom.replace(/\.gpx$/, '.json')) }]));
}
/** Pose une session sur le faux téléphone : le GPX et sa fiche, comme l'application du téléphone les range. */
function poserSession(telephone, s) {
  const sessions = join(telephone, 'sessions');
  mkdirSync(sessions, { recursive: true });
  const modele = MODELES.get(nomFichier(s));
  const d = new Date(Date.UTC(2026, 9, s.jour, 12, 0, 0));
  for (const [source, ext] of [[modele.gpx, '.gpx'], [modele.fiche, '.json']]) {
    const f = join(sessions, nomFichier(s).replace(/\.gpx$/, ext));
    copyFileSync(source, f);
    utimesSync(f, d, d);
  }
}
/** Dossier qui joue `Documents/Gtracker` du téléphone : son marqueur, trois sessions et un fichier de la racine à ne pas copier. */
function fabriquerTelephone(nom, sessions = SESSIONS) {
  const racine = dossier(nom);
  writeFileSync(join(racine, 'gtracker.json'), `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`);
  writeFileSync(join(racine, 'lieux.json'), `{"marque":"${MARQUE}"}`);
  for (const s of sessions) poserSession(racine, s);
  return racine;
}
/** Une session du téléphone, rangée entière sur le PC : même nom, mêmes octets. */
const octetsDe = (racine, nom) => readFileSync(join(racine, 'sessions', nom));
function verifierRangees(quoi, memoire, telephone, attendues) {
  const gpx = gpxsDe(memoire);
  check(`${quoi} : ${attendues.length} GPX dans sessions/ de la mémoire du PC`, gpx.length === attendues.length, gpx.join(' | '));
  for (const s of attendues) {
    const nom = nomFichier(s);
    const ici = join(memoire, 'sessions', nom);
    const memes = existsSync(ici) && octetsDe(memoire, nom).equals(octetsDe(telephone, nom));
    check(`${quoi} : « ${nom} » rangée octet pour octet (${existsSync(ici) ? statSync(ici).size : 0} octets)`, memes, existsSync(ici) ? `${statSync(ici).size} contre ${statSync(join(telephone, 'sessions', nom)).size}` : 'absente');
  }
  check(`${quoi} : chaque GPX a sa fiche (aucune moitié de session)`, gpx.every((g) => fichesDe(memoire).includes(g.replace(/\.gpx$/, '.json'))) && fichesDe(memoire).length === gpx.length, sessionsDe(memoire).join(' | '));
  check(`${quoi} : aucun temporaire (.gtracker-tmp, .gtracker-new) dans la mémoire`, temporaires(memoire).length === 0, temporaires(memoire).join(','));
  check(`${quoi} : rien du téléphone hors sessions/ n'est copié (lieux.json)`, contenant(memoire, [MARQUE]).length === 0, contenant(memoire, [MARQUE]).join(','));
}
const telephoneIntact = (quoi, telephone, avant) => check(`${quoi} : téléphone factice intact (fichiers, tailles et dates)`, empreinte(telephone) === avant, `\n--- avant ---\n${avant}\n--- après ---\n${empreinte(telephone)}`);

// ---------- la page ----------
/** Réglages › Mémoire ouverte, bloc du sans-fil présent. */
async function ouvrirMemoire(b) {
  await b.go('/parametres', 5000);
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 8000, label: 'carte Mémoire' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.wireless-card'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire')`);
  }
  await b.waitFor(`Boolean(document.querySelector('.wireless-card'))`, { timeout: 8000, label: 'bloc Téléphone sans câble' });
  await b.settle({ max: 1500 });
}
/** Ce que le bloc dit : cases, phrases, adresse, code, décompte, téléphones, boutons. */
const carte = (b) => b.evaluate(`(() => {
  const c = document.querySelector('.wireless-card');
  if (!c) return null;
  const tx = (s) => c.querySelector(s)?.textContent.trim() ?? null;
  return {
    titre: tx('.wireless-card__title'),
    coche: c.querySelector('.wireless-card__toggle')?.checked ?? null,
    statut: tx('.wireless-card__status'),
    avertissement: tx('.wireless-card__warning'),
    aide: tx('.wireless-card__hint'),
    erreur: tx('.wireless-card__error'),
    adresse: tx('.wireless-card__address'),
    code: tx('.wireless-card__code'),
    decompte: tx('.wireless-card__countdown'),
    resultat: tx('.wireless-card__result'),
    texte: c.innerText,
    telephones: [...c.querySelectorAll('.wireless-card__phones li')].map((li) => li.innerText.replace(/\\n+/g, ' / ')),
    boutons: [...c.querySelectorAll('button')].map((x) => x.textContent.trim()),
  };
})()`);
const secondes = (decompte) => { const m = /^(\d+):(\d\d)$/.exec(decompte ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const note = (b) => b.evaluate(`document.querySelector('.phone-sync__arrival')?.textContent.trim() ?? null`);
/** Attend la ligne d'arrivée qui répond à `motif` ; la rend (ou null). */
async function attendreNote(b, motif, quoi, timeout = 20000) {
  await b.waitFor(`/${motif.source}/.test(document.querySelector('.phone-sync__arrival')?.textContent ?? '')`, { timeout, label: quoi });
  return note(b);
}
/** La ligne que dit la page quand un téléphone relié se présente : plus rien ne se copie seul. */
const LIGNE_ARRIVEE = 'Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour.';
const MOTIF_ARRIVEE = /Téléphone relié : touchez « Synchroniser »/;
/** Capture JPEG du bloc du sans-fil (marge de 16 px). */
async function capturer(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  const r = await b.evaluate(`(() => { const c = document.querySelector('.wireless-card'); if (!c) return null; c.scrollIntoView({ block: 'center' }); const x = c.getBoundingClientRect(); return { x: x.left + scrollX, y: x.top + scrollY, w: x.width, h: x.height }; })()`);
  if (!r) return;
  await b.wait(300);
  const clip = { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: r.w + 32, height: r.h + 32, scale: 1 };
  const s = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, clip });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(s.result.data, 'base64'));
}
/** Un appairage ou une liaison du faux téléphone : `{ liaison }` ou `{ refus, erreur }`. */
const tenter = async (fn) => { try { return { liaison: await fn() }; } catch (e) { return { refus: e?.raison ?? null, erreur: e?.message ?? String(e) }; } };
/** Adresse et port lus sur la page (« 127.0.0.1:12345 »). */
const adresseDe = (c) => { const m = /^(\d+\.\d+\.\d+\.\d+):(\d+)$/.exec(c?.adresse ?? ''); return m ? { hote: m[1], port: Number(m[2]) } : null; };
/** Phrases d'une synchronisation qui n'est pas finie. */
const EN_COURS = /Recherche du téléphone…|Comparaison des deux appareils…|Copie de sécurité des deux appareils…|Synchronisation avec le téléphone .* par le (câble|Wi-Fi)…|\d+ fichiers? sur \d+/;
/** Les phrases et les boutons de la fenêtre « Synchroniser » ; `null` sans fenêtre. */
const fenetre = (b) => b.evaluate(`(() => {
  const d = document.querySelector('[role=dialog].phone-sync__dialog');
  if (!d) return null;
  return { phrases: [...d.querySelectorAll('.phone-sync__body p')].map((x) => x.textContent.trim()), boutons: [...d.querySelectorAll('.phone-sync__actions button')].map((x) => x.textContent.trim()), dossier: d.querySelector('code.phone-sync__folder')?.textContent.trim() ?? null };
})()`);
/** Attend l'issue de la synchronisation en cours (compte rendu ou question) ; rend la fenêtre. */
async function attendreIssue(b, quoi) {
  // Toutes les phrases vues en route (la copie en cours comprise) : aucune ne parle de « Première synchronisation ».
  const vues = new Set();
  const fin = Date.now() + 40000;
  while (Date.now() < fin) {
    const g = await fenetre(b);
    for (const p of g?.phrases ?? []) vues.add(p);
    if (g && g.phrases.length > 0 && !EN_COURS.test(g.phrases.join('\n'))) break;
    await b.wait(25);
  }
  await b.wait(300);
  const f = await fenetre(b);
  for (const p of f?.phrases ?? []) vues.add(p);
  console.log(`  « Synchroniser » (${quoi}) dit : ${JSON.stringify(f?.phrases)} ; boutons : ${(f?.boutons ?? []).join(' / ')}`);
  check(`« Synchroniser » (${quoi}) : l'issue est arrivée`, Boolean(f) && f.phrases.length > 0 && !EN_COURS.test(f.phrases.join('\n')), JSON.stringify(f?.phrases));
  const i = (f?.phrases ?? []).indexOf(PHRASE_SANS_CABLE);
  check(`« Synchroniser » (${quoi}) : le compte rendu commence par « ${PHRASE_SANS_CABLE} » (après la ligne de reprise, s'il y en a une)`, i === 0 || (i === 1 && /La synchronisation précédente avait été coupée/.test(f.phrases[0])), JSON.stringify(f?.phrases));
  check(`« Synchroniser » (${quoi}) : aucune phrase « Première synchronisation… », ni en route ni à la fin`, ![...vues].some((p) => /Première synchronisation/.test(p)), JSON.stringify([...vues]));
  return f;
}
/** Première phrase du compte rendu d'une synchronisation par le Wi-Fi. */
const PHRASE_SANS_CABLE = "Sans câble, le téléphone n'est pas modifié : seules ses sessions sont copiées vers l'ordinateur.";
/** « Synchroniser » (barre du haut) : attend l'issue et rend la fenêtre. */
async function synchroniser(b, quoi) {
  check(`« Synchroniser » (${quoi}) : clic`, (await b.click('.shell-topactions .phone-sync')) === 'ok');
  await b.wait(200);
  return attendreIssue(b, quoi);
}
const fermerFenetre = async (b) => { await b.evaluate(`[...document.querySelectorAll('.phone-sync__actions button')].find((x) => x.textContent.trim() === 'Fermer')?.click()`); await b.wait(300); };
/** Ce que la synchronisation par le Wi-Fi ne fait pas : pas de copie de sécurité, pas d'identifiant posé sur le téléphone, rien écrit sur lui. */
const copiesDe = (profil) => { const d = join(profil, 'Documents-essai', 'Gtracker-copies'); return existsSync(d) ? readdirSync(d) : []; };

try {
  console.log('\n== Préparation : quatre sessions (dont une de plus de 2 Mio) écrites par le programme');
  await fabriquerModeles();

  // ---------- 1. principal ----------
  console.log('\n== 1. Principal : activation, fenêtre, mauvais codes, appairage, arrivée sans copie, Synchroniser, déjà là, secrets, Retirer');
  {
    const profil = dossier('p1-profil');
    const memoire = dossier('p1-memoire');
    const tel = fabriquerTelephone('p1-tel');
    const avantTel = empreinte(tel);
    const gros = join(tel, 'sessions', nomFichier(SESSIONS[2]));
    console.log(`  téléphone factice : ${(arbre(tel) ?? []).join(', ')} ; plus gros fichier : ${statSync(gros).size} octets`);
    check('le gros fichier de session dépasse 2 Mio (au moins trois blocs)', statSync(gros).size > 2 * 1024 * 1024, String(statSync(gros).size));
    const secretsProfil = () => arbre(join(profil, 'sansfil')) ?? [];
    let faux = null;
    let jetonHex = null;
    await avecProgramme(profil, memoire, {}, '1', async (b) => {
      await ouvrirMemoire(b);
      let c = await carte(b);
      console.log(`  bloc, éteint : ${JSON.stringify(c.texte)}`);
      check('1a. le bloc « Téléphone sans câble » est là, case décochée', c.titre === 'Téléphone sans câble' && c.coche === false, JSON.stringify(c.coche));
      check('1a. la phrase d\'état dit que le sans-fil est éteint', c.statut === 'Le sans-fil est éteint : le téléphone ne peut pas se présenter à cet ordinateur.', c.statut);
      check('1a. la phrase prévient que Windows va demander l\'autorisation', /Windows va demander d'autoriser Gtracker sur le réseau/.test(c.texte), c.texte);
      check('1a. pas de « Relier un téléphone » ni de liste tant que le sans-fil est éteint', !c.boutons.includes('Relier un téléphone') && c.telephones.length === 0 && !/Téléphones reliés/.test(c.texte), c.boutons.join('/'));
      check('1a. aucun secret dans le profil tant que rien n\'est allumé', secretsProfil().length === 0, secretsProfil().join(','));
      await capturer(b, 'sansfil-1-eteint');

      // -- allumer
      check('1b. clic sur la case « Recevoir les sessions du téléphone sans câble »', (await b.click('.wireless-card__toggle')) === 'ok');
      await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
      c = await carte(b);
      console.log(`  bloc, allumé : ${JSON.stringify(c.texte)}`);
      check('1b. la case est cochée', c.coche === true);
      check('1b. « Gtracker attend votre téléphone sur le réseau (adresse 127.0.0.1). »', c.statut === 'Gtracker attend votre téléphone sur le réseau (adresse 127.0.0.1).', c.statut);
      check('1b. l\'aide dit d\'ouvrir Gtracker sur le téléphone (aucun téléphone relié)', /Aucun téléphone ne se présente \? Ouvrez Gtracker sur le téléphone/.test(c.aide ?? ''), c.aide);
      check('1b. « Téléphones reliés » : « Aucun téléphone relié pour l\'instant. »', /Téléphones reliés/.test(c.texte) && /Aucun téléphone relié pour l'instant\./.test(c.texte), c.texte);
      check('1b. « Relier un téléphone » est offert', c.boutons.includes('Relier un téléphone'), c.boutons.join('/'));
      console.log(`  pare-feu : avertissement ${JSON.stringify(c.avertissement)}`);
      await b.waitFor(() => secretsProfil().includes('certificat.pem'), { timeout: 8000, label: 'certificat' });
      check('1b. le profil porte le dossier de secrets du sans-fil (certificat.pem, cle.bin, reglages.json)', ['certificat.pem', 'cle.bin', 'reglages.json'].every((f) => secretsProfil().includes(f)), secretsProfil().join(','));

      // -- première fenêtre : trois mauvais codes
      check('1c. clic « Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code' });
      c = await carte(b);
      console.log(`  fenêtre : adresse ${c.adresse}, code ${c.code}, temps restant ${c.decompte}`);
      let ad = adresseDe(c);
      check('1c. l\'adresse est celle du PC et le port, « 127.0.0.1:<port> »', ad !== null && ad.hote === '127.0.0.1' && ad.port > 1023, c.adresse);
      check('1c. le code est de 6 chiffres', /^\d{6}$/.test(c.code ?? ''), c.code);
      check('1c. le temps restant est de 2 minutes au plus et plus d\'1 min 30', secondes(c.decompte) !== null && secondes(c.decompte) <= 120 && secondes(c.decompte) >= 90, c.decompte);
      check('1c. la phrase dit d\'ouvrir Gtracker sur le téléphone, Réglages, Mémoire', /Sur le téléphone, ouvrez Gtracker, puis Réglages, Mémoire/.test(c.texte), c.texte);
      const avantDecompte = secondes(c.decompte);
      await capturer(b, 'sansfil-2-fenetre-de-liaison');
      await b.wait(2500);
      c = await carte(b);
      check('1c. le décompte baisse', secondes(c.decompte) !== null && secondes(c.decompte) < avantDecompte, `${avantDecompte} puis ${c.decompte}`);
      const mauvais = c.code === '000000' ? '000001' : '000000';
      const essais = [];
      for (let k = 1; k <= 3; k++) {
        const t = new FauxTelephone({ dossier: tel, nom: `Intrus ${k}`, delaiMs: 5000 });
        essais.push(await tenter(() => t.appairer(ad.hote, ad.port, mauvais)));
      }
      console.log(`  trois mauvais codes : ${JSON.stringify(essais.map((e) => e.refus ?? e.erreur))}`);
      check('1d. chacun des trois mauvais codes est refusé (raison « code »)', essais.every((e) => e.refus === 'code'), JSON.stringify(essais.map((e) => e.refus ?? e.erreur)));
      await b.waitFor(`/La fenêtre s'est fermée sans téléphone relié/.test(document.querySelector('.wireless-card__result')?.textContent ?? '')`, { timeout: 8000, label: 'fenêtre fermée' });
      c = await carte(b);
      console.log(`  après trois échecs : ${JSON.stringify(c.resultat)}`);
      check('1d. la page dit que la fenêtre s\'est fermée sans téléphone relié', /Cliquez de nouveau sur « Relier un téléphone » et vérifiez le code tapé/.test(c.resultat ?? ''), c.resultat);
      check('1d. le code n\'est plus affiché', c.code === null, c.code);
      // Le bon code, une fois la fenêtre fermée : refusé.
      const tardif = new FauxTelephone({ dossier: tel, nom: 'Trop tard', delaiMs: 5000 });
      const rtard = await tenter(() => tardif.appairer(ad.hote, ad.port, '123456'));
      check('1d. un téléphone qui se présente après la fermeture est refusé (raison « fenetre »)', rtard.refus === 'fenetre', JSON.stringify(rtard));
      check('1d. aucun téléphone relié, rien rangé', (await carte(b)).telephones.length === 0 && gpxsDe(memoire).length === 0);

      // -- seconde fenêtre : un mauvais code, puis le bon
      check('1e. nouvelle fenêtre : « Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code neuf' });
      c = await carte(b);
      ad = adresseDe(c);
      const code = c.code;
      console.log(`  seconde fenêtre : adresse ${c.adresse}, code ${code}`);
      faux = new FauxTelephone({ dossier: tel, delaiMs: 8000 });
      const un = await tenter(() => new FauxTelephone({ dossier: tel, nom: 'Intrus 4', delaiMs: 5000 }).appairer(ad.hote, ad.port, code === '000000' ? '000001' : '000000'));
      check('1e. un mauvais code est refusé (raison « code »), la fenêtre reste ouverte', un.refus === 'code' && (await carte(b)).code === code, JSON.stringify(un));
      const bon = await tenter(() => faux.appairer(ad.hote, ad.port, code));
      check('1e. le bon code appaire le téléphone d\'essai', Boolean(bon.liaison), JSON.stringify(bon));
      jetonHex = faux.memoire?.jeton ?? null;
      check('1e. le téléphone garde un jeton de 256 bits (64 caractères hexadécimaux)', /^[0-9a-f]{64}$/.test(jetonHex ?? ''), jetonHex ?? '(aucun)');
      await b.waitFor(`/Téléphone .* relié\\./.test(document.querySelector('.wireless-card__result')?.textContent ?? '')`, { timeout: 8000, label: 'téléphone relié' });
      c = await carte(b);
      console.log(`  après l'appairage : résultat ${JSON.stringify(c.resultat)} ; téléphones ${JSON.stringify(c.telephones)}`);
      check('1e. la page dit « Téléphone Téléphone d\'essai relié. »', c.resultat === "Téléphone Téléphone d'essai relié.", c.resultat);
      check('1e. la liste porte « Téléphone d\'essai » relié en ce moment', c.telephones.length === 1 && /Téléphone d'essai/.test(c.telephones[0]) && /relié en ce moment/.test(c.telephones[0]), JSON.stringify(c.telephones));
      check('1e. l\'aide « Aucun téléphone ne se présente ? » a disparu', c.aide === null, c.aide);

      // -- arrivée : une ligne, plus rien ne se copie seul
      const n1 = await attendreNote(b, MOTIF_ARRIVEE, 'ligne d\'arrivée');
      console.log(`  ligne d'arrivée : « ${n1} »`);
      check(`1f. la ligne d'arrivée dit « ${LIGNE_ARRIVEE} »`, n1 === LIGNE_ARRIVEE, n1);
      await b.wait(3000);
      check('1f. l\'arrivée ne range rien : sessions/ vide, ni base de synchronisation, ni corbeille, ni copie de sécurité', sessionsDe(memoire).length === 0 && !existsSync(join(memoire, 'synchro')) && !existsSync(join(memoire, 'corbeille')) && copiesDe(profil).length === 0, (arbre(memoire) ?? []).join(','));
      telephoneIntact('1f, avant « Synchroniser »', tel, avantTel);
      await capturer(b, 'sansfil-3-telephone-relie');

      // -- « Synchroniser » par le Wi-Fi : les sessions du téléphone viennent sur l'ordinateur, le téléphone reste intact
      const f1 = await synchroniser(b, '1f');
      check('1f. « 3 sessions copiées vers l\'ordinateur. »', (f1?.phrases ?? []).includes("3 sessions copiées vers l'ordinateur."), JSON.stringify(f1?.phrases));
      check('1f. aucune phrase ne dit que le téléphone a été écrit (« Mettre à jour »)', !(f1?.phrases ?? []).some((l) => /Mettre à jour/.test(l)), JSON.stringify(f1?.phrases));
      check('1f. ce qui attend le câble est dit', (f1?.phrases ?? []).some((l) => /attend(ent)? le câble ou la mise à jour du téléphone/.test(l)), JSON.stringify(f1?.phrases));
      await b.wait(2500); // réécritures différées des fiches
      verifierRangees('1f', memoire, tel, SESSIONS);
      telephoneIntact('1f', tel, avantTel);
      check('1f. pas de copie de sécurité (le téléphone n\'est pas écrit), pas d\'identifiant posé sur le téléphone', copiesDe(profil).length === 0 && !('id' in (JSON.parse(readFileSync(join(tel, 'gtracker.json'), 'utf8')) ?? {})), copiesDe(profil).join(','));
      check('1f. rien n\'est allé à la corbeille', !existsSync(join(memoire, 'corbeille')) || !(arbre(join(memoire, 'corbeille')) ?? []).some((c) => c !== 'corbeille.json'));
      await fermerFenetre(b);
      const apresPremier = empreinte(join(memoire, 'sessions'));

      // -- secrets : le jeton n'est ni dans la mémoire, ni dans la page, ni en clair dans le profil
      const jetonOctets = Buffer.from(jetonHex, 'hex');
      const condense = createHash('sha256').update(jetonOctets).digest();
      console.log(`  secrets du profil : ${secretsProfil().join(', ')}`);
      check('1g. aucun fichier de la mémoire ne porte le jeton (ni en hexadécimal, ni en octets)', contenant(memoire, [jetonHex, jetonOctets]).length === 0, contenant(memoire, [jetonHex, jetonOctets]).join(','));
      check('1g. la mémoire ne porte ni dossier « sansfil », ni certificat, ni clé, ni registre de téléphones', !(arbre(memoire) ?? []).some((f) => /sansfil|certificat\.pem|cle\.bin|telephones\.json/i.test(f)), (arbre(memoire) ?? []).join(','));
      check('1g. ni clé ni certificat PEM dans un fichier de la mémoire', contenant(memoire, ['-----BEGIN']).length === 0, contenant(memoire, ['-----BEGIN']).join(','));
      check('1g. le profil garde le registre des téléphones', secretsProfil().includes('telephones.json'), secretsProfil().join(','));
      const dansProfil = contenant(join(profil, 'sansfil'), [jetonHex, jetonOctets]);
      check('1g. le jeton n\'est en clair dans aucun fichier du profil (le PC n\'en garde que le hachage)', dansProfil.length === 0, dansProfil.join(','));
      const hachage = contenant(join(profil, 'sansfil'), [condense.toString('hex'), condense.toString('base64'), condense]);
      check('1g. le hachage SHA-256 du jeton est dans le registre du profil', hachage.some((f) => f === 'telephones.json'), hachage.join(','));
      const dansPage = await b.evaluate(`JSON.stringify([document.documentElement.innerHTML, JSON.stringify(localStorage)]).includes(${JSON.stringify(jetonHex)})`);
      check('1g. le jeton n\'est jamais dans la page (HTML, stockage de la page)', dansPage === false);

      // -- le même téléphone se représente par son jeton
      const cote = faux.memoire;
      bon.liaison.fermer();
      const ferme = await Promise.race([bon.liaison.fermee, pause(5000).then(() => null)]);
      console.log(`  liaison fermée par le téléphone : ${JSON.stringify(ferme)}`);
      await b.waitFor(`/relié en ce moment/.test(document.querySelector('.wireless-card')?.innerText ?? '') === false`, { timeout: 10000, label: 'liaison perdue côté PC' });
      c = await carte(b);
      check('1h. la liste ne dit plus « relié en ce moment » : « vu pour la dernière fois le … »', c.telephones.length === 1 && /vu pour la dernière fois le/.test(c.telephones[0]), JSON.stringify(c.telephones));
      faux = new FauxTelephone({ dossier: tel, memoire: cote, delaiMs: 8000 });
      const retour = await tenter(() => faux.connecter(ad.hote, ad.port));
      check('1h. le téléphone se présente par son jeton, sans code', Boolean(retour.liaison), JSON.stringify(retour));
      const n2 = await attendreNote(b, MOTIF_ARRIVEE, 'seconde arrivée');
      console.log(`  ligne d'arrivée : « ${n2} »`);
      check(`1h. la ligne d'arrivée redit « ${LIGNE_ARRIVEE} »`, n2 === LIGNE_ARRIVEE, n2);
      await b.wait(1500);
      check('1h. le disque n\'a pas changé (noms, tailles, dates de sessions/)', empreinte(join(memoire, 'sessions')) === apresPremier, `\n${apresPremier}\n--\n${empreinte(join(memoire, 'sessions'))}`);
      telephoneIntact('1h', tel, avantTel);
      c = await carte(b);
      check('1h. la liste redit « relié en ce moment »', c.telephones.length === 1 && /relié en ce moment/.test(c.telephones[0]), JSON.stringify(c.telephones));
      check('1h. toujours un seul téléphone dans la liste (pas de doublon)', c.telephones.length === 1);

      // -- « Récupérer » par le Wi-Fi, avec une quatrième session sur le téléphone
      poserSession(tel, QUATRIEME);
      const avantTel2 = empreinte(tel);
      const f2 = await synchroniser(b, '1i');
      check('1i. « Synchroniser » par le Wi-Fi dit « 1 session copiée vers l\'ordinateur. »', (f2?.phrases ?? []).includes("1 session copiée vers l'ordinateur."), JSON.stringify(f2?.phrases));
      await b.wait(2500);
      verifierRangees('1i', memoire, tel, [...SESSIONS, QUATRIEME]);
      telephoneIntact('1i', tel, avantTel2);
      await fermerFenetre(b);

      // -- retirer le téléphone
      const rangeesAvantRetrait = empreinte(join(memoire, 'sessions'));
      c = await carte(b);
      const retirer = `.wireless-card__phones button[aria-label="Retirer le téléphone Téléphone d'essai"]`;
      check('1j. un bouton « Retirer le téléphone Téléphone d\'essai » est offert', (await b.evaluate(`Boolean(document.querySelector(${JSON.stringify(retirer)}))`)) === true);
      check('1j. clic « Retirer »', (await b.click(retirer)) === 'ok');
      await b.waitFor(`/Aucun téléphone relié pour l'instant\\./.test(document.querySelector('.wireless-card')?.innerText ?? '')`, { timeout: 8000, label: 'liste vide' });
      const fermeeRetrait = await Promise.race([retour.liaison.fermee, pause(8000).then(() => null)]);
      console.log(`  liaison après « Retirer » : ${JSON.stringify(fermeeRetrait)}`);
      check('1j. la liaison en cours est fermée par le PC', typeof fermeeRetrait === 'string', String(fermeeRetrait));
      const refuse = await tenter(() => new FauxTelephone({ dossier: tel, memoire: cote, delaiMs: 5000 }).connecter(ad.hote, ad.port));
      console.log(`  téléphone retiré qui se représente : ${JSON.stringify(refuse.refus ?? refuse.erreur)}`);
      check('1j. le téléphone retiré est refusé (raison « jeton »)', refuse.refus === 'jeton', JSON.stringify(refuse));
      await b.wait(1500);
      check('1j. le disque n\'a pas changé après le retrait', empreinte(join(memoire, 'sessions')) === rangeesAvantRetrait);
      // Le registre du profil ne garde plus le téléphone.
      const registre = readFileSync(join(profil, 'sansfil', 'telephones.json'), 'utf8');
      check('1j. le registre du profil ne garde plus le hachage du jeton', !registre.includes(condense.toString('hex')) && !registre.includes(condense.toString('base64')), registre.slice(0, 200));
      telephoneIntact('1j', tel, avantTel2);
    });
  }

  // ---------- 2. fenêtre expirée ----------
  console.log('\n== 2. Fenêtre d\'appairage expirée (4 s)');
  {
    const profil = dossier('p2-profil');
    const memoire = dossier('p2-memoire');
    const tel = fabriquerTelephone('p2-tel', SESSIONS.slice(0, 2));
    const avantTel = empreinte(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1', GTRACKER_BANC_SANSFIL_FENETRE_MS: '4000' }, '2', async (b) => {
      await ouvrirMemoire(b);
      await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
      let c = await carte(b);
      check('2a. sans-fil allumé dès le lancement (case cochée)', c.coche === true);
      check('2a. « Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code' });
      c = await carte(b);
      const ad = adresseDe(c);
      const code = c.code;
      console.log(`  fenêtre : adresse ${c.adresse}, code ${code}, temps restant ${c.decompte}`);
      check('2a. le temps restant est de 4 s au plus', secondes(c.decompte) !== null && secondes(c.decompte) <= 4, c.decompte);
      await b.waitFor(`/La fenêtre s'est fermée sans téléphone relié/.test(document.querySelector('.wireless-card__result')?.textContent ?? '')`, { timeout: 10000, label: 'échéance' });
      c = await carte(b);
      console.log(`  à l'échéance : ${JSON.stringify(c.resultat)}`);
      check('2b. la page dit que la fenêtre s\'est fermée sans téléphone relié', /Cliquez de nouveau sur « Relier un téléphone »/.test(c.resultat ?? ''), c.resultat);
      check('2b. le code a disparu de la page', c.code === null);
      const t = new FauxTelephone({ dossier: tel, delaiMs: 5000 });
      const r = await tenter(() => t.appairer(ad.hote, ad.port, code));
      console.log(`  le bon code, trop tard : ${JSON.stringify(r.refus ?? r.erreur)}`);
      check('2c. le bon code, après l\'échéance, est refusé (raison « fenetre »)', r.refus === 'fenetre', JSON.stringify(r));
      await b.wait(1500);
      c = await carte(b);
      check('2c. aucun téléphone relié', c.telephones.length === 0 && /Aucun téléphone relié pour l'instant\./.test(c.texte), JSON.stringify(c.telephones));
      check('2c. rien n\'est rangé sur le PC', sessionsDe(memoire).length === 0, sessionsDe(memoire).join(','));
      check('2c. le registre du profil ne porte aucun téléphone', !existsSync(join(profil, 'sansfil', 'telephones.json')) || !/"id"/.test(readFileSync(join(profil, 'sansfil', 'telephones.json'), 'utf8')), existsSync(join(profil, 'sansfil', 'telephones.json')) ? readFileSync(join(profil, 'sansfil', 'telephones.json'), 'utf8') : '');
      // Une fenêtre neuve accepte de nouveau (l'échéance ne bloque rien).
      check('2d. « Relier un téléphone » rouvre une fenêtre', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code neuf' });
      const c2 = await carte(b);
      const ad2 = adresseDe(c2);
      const t2 = new FauxTelephone({ dossier: tel, delaiMs: 8000 });
      const r2 = await tenter(() => t2.appairer(ad2.hote, ad2.port, c2.code));
      check('2d. dans la fenêtre neuve, le bon code appaire', Boolean(r2.liaison), JSON.stringify(r2));
      const n2d = await attendreNote(b, MOTIF_ARRIVEE, 'arrivée');
      check(`2d. l'arrivée ne dit que « ${LIGNE_ARRIVEE} » et ne range rien`, n2d === LIGNE_ARRIVEE && (await b.wait(2000), sessionsDe(memoire).length === 0), `${n2d} / ${sessionsDe(memoire).join(',')}`);
      const f2d = await synchroniser(b, '2d');
      check('2d. « Synchroniser » : « 2 sessions copiées vers l\'ordinateur. »', (f2d?.phrases ?? []).includes("2 sessions copiées vers l'ordinateur."), JSON.stringify(f2d?.phrases));
      await b.wait(2500);
      verifierRangees('2d', memoire, tel, SESSIONS.slice(0, 2));
      await fermerFenetre(b);
      telephoneIntact('2d', tel, avantTel);
      r2.liaison?.fermer?.();
    });
  }

  // ---------- 3. coupure en plein transfert ----------
  console.log('\n== 3. Liaison coupée en plein transfert (au milieu du gros fichier)');
  {
    const profil = dossier('p3-profil');
    const memoire = dossier('p3-memoire');
    const tel = fabriquerTelephone('p3-tel');
    const avantTel = empreinte(tel);
    const temps = [];
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1' }, '3', async (b, p) => {
      await ouvrirMemoire(b);
      await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
      check('3a. « Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code' });
      const c = await carte(b);
      const ad = adresseDe(c);
      // Trois blocs envoyés : les deux petites sessions, puis le premier bloc du gros fichier ; le suivant n'arrive pas.
      const coupeur = new FauxTelephone({ dossier: tel, coupureApresBlocs: 3, delaiMs: 8000 });
      const r = await tenter(() => coupeur.appairer(ad.hote, ad.port, c.code));
      check('3a. le téléphone qui coupe s\'appaire', Boolean(r.liaison), JSON.stringify(r));
      const n = await attendreNote(b, MOTIF_ARRIVEE, 'arrivée');
      check(`3a. l'arrivée ne dit que « ${LIGNE_ARRIVEE} »`, n === LIGNE_ARRIVEE, n);
      await b.wait(1500);
      check('3a. rien n\'est rangé avant « Synchroniser »', sessionsDe(memoire).length === 0 && coupeur.blocsEnvoyes === 0, `${sessionsDe(memoire).join(',')} / ${coupeur.blocsEnvoyes} blocs`);
      const fc = await synchroniser(b, '3b');
      check('3b. la fenêtre dit que la liaison a été coupée pendant la synchronisation et offre « Réessayer »', (fc?.phrases ?? []).some((l) => /^La liaison avec le téléphone a été coupée pendant la synchronisation\. Ce qui est fait est gardé : rouvrez Gtracker sur le téléphone, puis cliquez sur « Réessayer » pour finir\.$/.test(l)) && (fc?.boutons ?? []).join('/') === 'Réessayer/Fermer', JSON.stringify(fc));
      console.log(`  blocs envoyés avant la coupure : ${coupeur.blocsEnvoyes} (commandes reçues : ${coupeur.commandesRecues})`);
      check('3b. la coupure est tombée au milieu du gros fichier (trois blocs envoyés)', coupeur.blocsEnvoyes === 3, String(coupeur.blocsEnvoyes));
      await b.wait(2500);
      const rangees = gpxsDe(memoire);
      console.log(`  rangées au moment de la coupure : ${rangees.join(' ; ') || '(aucune)'}`);
      check('3c. le gros fichier n\'est pas rangé (ni entier, ni à moitié)', !rangees.includes(nomFichier(SESSIONS[2])), rangees.join(','));
      check('3c. moins de trois sessions rangées', rangees.length < 3, String(rangees.length));
      for (const g of rangees) {
        check(`3c. « ${g} » est entière (mêmes octets que sur le téléphone)`, octetsDe(memoire, g).equals(octetsDe(tel, g)));
        check(`3c. « ${g} » a sa fiche`, fichesDe(memoire).includes(g.replace(/\.gpx$/, '.json')), sessionsDe(memoire).join(' | '));
      }
      check('3c. pas plus de fiches que de GPX (aucune moitié de session)', fichesDe(memoire).length === rangees.length, `${fichesDe(memoire).length} fiches, ${rangees.length} GPX`);
      check('3c. aucun temporaire dans la mémoire', temporaires(memoire).length === 0, temporaires(memoire).join(','));
      check('3c. aucun temporaire dans le profil', temporaires(profil).length === 0, temporaires(profil).join(','));
      const dansTemp = (arbre(p.temp) ?? []).filter((f) => !f.endsWith('/'));
      temps.push(...dansTemp);
      check('3c. aucun fichier de sessions ni temporaire dans le dossier temporaire du programme', !dansTemp.some((f) => /\.gtracker-|\.gpx$|\.imu$|\.fit$/i.test(f)), dansTemp.join(','));
      check('3c. rien du téléphone hors sessions/ n\'est copié', contenant(memoire, [MARQUE]).length === 0);
      telephoneIntact('3c', tel, avantTel);
      await b.waitFor(`/vu pour la dernière fois/.test(document.querySelector('.wireless-card')?.innerText ?? '')`, { timeout: 10000, label: 'liaison perdue' });
      check('3c. la liste dit que le téléphone n\'est plus relié (liaison coupée)', /vu pour la dernière fois/.test((await carte(b)).texte));

      // -- la liaison suivante, sans coupure, range ce qui manquait
      const complet = new FauxTelephone({ dossier: tel, memoire: coupeur.memoire, delaiMs: 8000 });
      const retour = await tenter(() => complet.connecter(ad.hote, ad.port));
      check('3d. le téléphone se représente par son jeton', Boolean(retour.liaison), JSON.stringify(retour));
      const manquantes = 3 - rangees.length;
      const n2 = await attendreNote(b, MOTIF_ARRIVEE, 'reprise', 40000);
      console.log(`  ligne d'arrivée : « ${n2} »`);
      check(`3d. la ligne d'arrivée redit « ${LIGNE_ARRIVEE} » (rien ne se copie seul)`, n2 === LIGNE_ARRIVEE, n2);
      check('3d. « Réessayer » dans la fenêtre toujours ouverte', (await b.clickText('Réessayer', '.phone-sync__actions button')) === 'ok');
      await b.wait(200);
      const fr = await attendreIssue(b, '3d');
      const dit = manquantes > 1 ? `${manquantes} sessions copiées vers l'ordinateur.` : `${manquantes} session copiée vers l'ordinateur.`;
      check(`3d. le compte rendu dit « ${dit} »`, (fr?.phrases ?? []).includes(dit), JSON.stringify(fr?.phrases));
      await b.wait(2500);
      verifierRangees('3d', memoire, tel, SESSIONS);
      telephoneIntact('3d', tel, avantTel);
      retour.liaison?.fermer?.();
    });
    console.log(`  dossier temporaire du programme : ${temps.join(', ') || '(vide)'}`);
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
