// Banc de test : la liaison sans câble du programme Windows, face à un faux téléphone (`bureau/fauxTelephone.ts`).
// Usage : node exe-sansfil.mjs <Gtracker.exe> [<port de débogage>]
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille
// (`GTRACKER_BANC=1`), sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le
// profil du vrai programme, jamais un vrai téléphone. En mode d'essai le serveur du sans-fil n'écoute que sur 127.0.0.1,
// sur un port libre que la page affiche avec le code (`GTRACKER_BANC_SANSFIL_*`, `bureau/sansFil.ts`). Le faux téléphone
// est celui de `bureau/dist/fauxTelephone.js` (la coquille compilée avec le programme : à refaire avec lui, `npm run exe`) ;
// il lit un dossier du disque qui joue `Documents/Gtracker` du téléphone. Les cas 1 à 3 le jouent en téléphone `ancien`
// (application d'avant l'écriture sans fil : lecture seule, il n'y écrit jamais) ; les cas 4 à 6 le jouent à jour (il
// annonce qu'il écrit, comme le téléphone récent). Le code d'appairage se lit sur la page du programme, comme le ferait
// l'utilisateur ; le disque se lit par Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG : le bloc « Téléphone » de Réglages › Connexion (éteint,
// fenêtre de liaison, téléphone relié, à jour, et le paragraphe « Par câble (avancé) » fermé puis ouvert) et la page entière
// aux moments qui comptent (compte rendu d'un téléphone ancien, attente après une coupure, écran de départ, compte rendu,
// question du garde-fou, « Aucun téléphone relié », « <nom> relié » dans la barre du haut, attente d'un téléphone).
// `BANC_CAS=4,8` ne joue que ces cas (1 à 9).
// La fenêtre « Synchroniser » se lit par ce qu'elle montre (`fenetre`) : titre, sous-titre, paragraphes, lignes du compte
// rendu (geste, nombres, noms), étapes, boutons du bas et du corps, barre d'avancement, dossier de la copie. Un compte rendu
// est rangé par geste (« Reçu du téléphone », « Envoyé au téléphone », « Modifié », « Supprimé », « Gardé »), sessions et
// itinéraires comptés à part ; tout à jour dit « Rien à échanger : … ». Le téléphone connu qui n'est pas là, ou dont la
// liaison tombe en route, donne une attente (« Annuler » seul) qui repart seule à son retour, trois fois au plus ; une
// première synchronisation d'un téléphone à jour s'arrête sur un écran de départ (« Commencer ») avant la copie de sécurité.
// À côté du bouton, la barre dit « <nom> relié » tant que le sans-fil tient le téléphone (plus de ligne d'arrivée).
// Cas (un programme par cas, sauf mention) :
//  1. principal (téléphone ancien) : sans-fil éteint (phrase d'avertissement de Windows, pas de « Relier ») ; bloc intitulé
//     « Téléphone », paragraphe replié « Par câble (avancé) » ; allumé par la case (« Prêt : Gtracker attend votre téléphone. »,
//     dossier de secrets du profil) ; fenêtre de liaison (adresse, code de 6 chiffres, décompte qui baisse) ; trois mauvais
//     codes : la page dit d'où ils venaient (« 3 codes faux reçus, le dernier de l'appareil … »), la fenêtre se ferme et le bon
//     code est refusé ; nouvelle fenêtre, une application d'avant l'échange SPAKE2 (`ancienEchange`, un `appairer` sans part)
//     refusée (raison « version ») sans compter comme un code faux, un mauvais code (« Code faux reçu de l'appareil … »), puis le bon :
//     « Téléphone <nom> relié. » dans le bloc, « <nom> relié » dans la barre, rien n'est rangé à l'arrivée ; « Synchroniser » par
//     le Wi-Fi : « Reçu du téléphone : 3 sessions » (dont une de plus de 2 Mio, en trois blocs, octet pour octet), l'exception
//     « trop ancien pour recevoir par le Wi-Fi », jamais de « Première synchronisation », ni copie de sécurité, ni identifiant
//     posé, rien à la corbeille, téléphone intact ; aucun secret (jeton, clé, certificat) dans le dossier mémoire, ni dans la
//     page ; la liaison fermée par le téléphone : le départ est annoncé à la barre, il se représente par son jeton, une
//     quatrième session passe par « Synchroniser » ; « Retirer » : la liaison se ferme et le jeton est refusé ;
//  2. (téléphone ancien) fenêtre expirée (`GTRACKER_BANC_SANSFIL_FENETRE_MS` court) : le décompte arrive à 0:00, la page le dit, le bon code
//     est refusé, rien n'est rangé ; dans la fenêtre neuve, l'arrivée ne range rien, « Synchroniser » reçoit les deux sessions ;
//  3. (téléphone ancien) coupure en plein transfert (le faux téléphone coupe au milieu du gros fichier) : la fenêtre
//     attend le retour du téléphone (« Annuler » seul, plus de « Réessayer »), rien n'est écrit à moitié (chaque session
//     rangée est entière, aucun temporaire) ; le téléphone se représente par son jeton et la synchronisation repart seule et
//     finit, « Reçu du téléphone : 3 sessions » ;
//  4. téléphone à jour, dans les deux sens : le bloc dit comment relier et synchroniser ; première synchronisation par le
//     Wi-Fi (écran de départ avec le dossier de la copie, rien de fait avant « Commencer » ; puis copie de sécurité,
//     identifiant et champ `synchro` posés sur le téléphone, « Reçu du téléphone » et « Envoyé au téléphone » avec leurs
//     noms, dont une session de plus de 2 Mio écrite en plusieurs blocs, aucun provisoire, « Ouvrir le dossier ») ; second
//     clic « Tout est à jour » ; itinéraires modifiés des deux côtés (« Modifié ») ; une session et un itinéraire
//     supprimés sur le téléphone (corbeille de l'ordinateur), puis supprimés sur l'ordinateur : le garde-fou pose sa
//     question (« Une suppression à confirmer », « Sur l'ordinateur : 1 session supprimée », « Tout garder » et « Supprimer des
//     deux côtés »), « Supprimer des deux côtés » retire du téléphone ; une autre suppression, « Tout garder » : la session
//     sort de la corbeille et reste sur le téléphone (« Gardé ») ;
//  5. téléphone à jour, coupure en pleine écriture vers le téléphone : l'original reste intact et aucun provisoire ne
//     reste (à la coupure d'un nombre de blocs écrits, puis à l'écriture d'un fichier qui existe déjà) ; après chaque coupure
//     la fenêtre attend (« Annuler » seul), repart seule au retour du téléphone, et la dernière reprise finit ;
//  6. téléphone à jour qui enregistre une session : rien n'est écrit sur lui, l'exception dédiée (« rien ne lui a été
//     envoyé… »), « Reçu du téléphone » quand même ; l'enregistrement fini, la synchronisation suivante passe par l'écran
//     de départ et l'écrit ;
//  7. pare-feu de Windows (pare-feu et autorisation factices du mode d'essai, jamais `powershell` : le journal le prouve ;
//     `GTRACKER_BANC_SANSFIL_PAREFEU=ouvert|bloque|irreparable`, `GTRACKER_BANC_SANSFIL_AUTORISATION=accordee|refusee|echec`),
//     un programme par sous-cas, sans-fil allumé dès le lancement sauf 7f : 7a par défaut, rien (ni message, ni bouton, ni
//     demande) ; 7b bloqué : la phrase, « Autoriser Gtracker » et sa mention, puis le clic accordé fait disparaître le
//     message (journal « autorisation d'essai : accordee ») ; 7c refusée : phrase de refus, bouton gardé ; 7d en échec :
//     la raison dite, bouton gardé ; 7e non réparable : phrase de l'administrateur, aucun bouton ; 7f sans-fil éteint puis
//     allumé par la case avec un pare-feu bloqué : phrase d'allumage, demande partie avant l'écoute, rien d'affiché ensuite.
//     Les contrôles 1a, 1b et 1e vérifient aussi que l'ancienne aide et l'ancien avertissement ont disparu. 7g : page en
//     anglais (`BANC_LANGUE_PAGE`), autorisation d'essai en échec : la phrase et la raison venue de la coquille sortent traduites.
//  8. (outil du câble imposé introuvable, `GTRACKER_BANC_TELEPHONE_ETAT=adbIntrouvable`) aucun téléphone jamais relié :
//     « Synchroniser » dit « Aucun téléphone relié » avec « Relier mon téléphone », qui ferme la fenêtre, ouvre Réglages ›
//     Connexion et la fenêtre du code d'elle-même ; paragraphe « Par câble (avancé) » replié (l'outil de Google n'est dit que
//     dedans, jamais dans la fenêtre) ; le téléphone s'appaire : « <nom> relié » dans la barre ; il ferme la liaison : la
//     barre le sait en quelques millisecondes (avis de départ du programme, journal « téléphone parti (raison) ») ;
//     « Synchroniser » attend (sous-titre « relié pour la dernière fois à … », les trois choses à faire sur le téléphone,
//     « Annuler » seul, ni câble ni débogage ni outil de Google) et ne renonce pas ; le téléphone revient : la fenêtre part
//     seule jusqu'à l'écran de départ, « Commencer », compte rendu, « Ouvrir le dossier » (la coquille le note) ; le journal
//     `journal.txt` du profil porte une ligne datée par événement (arrivées, départs, étapes de la page préfixées « page : »)
//     sans chemin, sans nom de téléphone ni de session (le relevé dit aussi quelles lignes portent une adresse réseau) ;
//  9. (téléphone ancien) liaison coupée quatre fois de suite (chaque faux téléphone coupe à son second bloc) : trois
//     reprises seules, la fenêtre attend à chaque fois, puis l'arrêt se dit (« Synchronisation arrêtée », « Ce qui est fait est
//     gardé », « Recommencer » et « Fermer ») ; « Recommencer » attend le téléphone, un téléphone qui ne coupe pas finit.
// Dans chaque compte rendu (`attendreIssue`), tout ce qui est dit en route et à la fin est relevé : aucune phrase d'avant la
// remise à plat (`ANCIENNES` : « touchez Mettre à jour », « copiées vers », « Réessayer », « Aucun téléphone ne se présente »,
// le débogage USB, l'outil de Google…) ; pour un téléphone ancien, jamais de « Première synchronisation ».
// Cas 1, itinéraires : un itinéraire sur le faux téléphone et un dans la mémoire de l'ordinateur ; ceux de l'ordinateur
// (fiches, GPX, tailles, dates) sont intacts après chaque « Synchroniser » et après « Retirer » (un téléphone ancien n'en
// reçoit ni n'en donne).
// Les sessions du faux téléphone (GPX et fiche) sont écrites d'abord par le programme lui-même, dans une mémoire de
// préparation, puis copiées : une session sans fiche est « en cours de rangement » et passe à la synchronisation suivante.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, FORMATS } from './lib/cdp.mjs';
import { actionLigne } from './lib/sessions.mjs';
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
/** `BANC_CAS=4,5` (facultatif) ne joue que ces cas (1 à 9) ; sans lui, tous. */
const CAS = process.env.BANC_CAS ? process.env.BANC_CAS.split(',').map((c) => c.trim()) : null;
const veut = (cas) => CAS === null || CAS.includes(cas);
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
/** Arbre avec la taille et l'heure de chaque fichier : change si quoi que ce soit est écrit ; `garder` filtre les chemins. */
const empreinte = (racine, garder = () => true) => (arbre(racine) ?? []).filter(garder).map((c) => (c.endsWith('/') ? c : `${c}:${statSync(join(racine, c)).size}:${statSync(join(racine, c)).mtimeMs}`)).join('|');
const temporaires = (racine) => (arbre(racine) ?? []).filter((c) => /\.gtracker-(tmp|new)$/.test(c));
const sessionsDe = (memoire) => (existsSync(join(memoire, 'sessions')) ? readdirSync(join(memoire, 'sessions')).sort() : []);
const gpxsDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.gpx'));
const fichesDe = (memoire) => sessionsDe(memoire).filter((n) => n.endsWith('.json'));
/** Fichiers sous `racine` dont le contenu porte l'une des `marques` (chaînes ou tampons). */
const contenant = (racine, marques) => (arbre(racine) ?? []).filter((c) => !c.endsWith('/')).filter((c) => { const o = readFileSync(join(racine, c)); return marques.some((m) => o.includes(m)); });

/** Marqueur de l'ordinateur sans son identifiant d'appareil (`appareil`, que le programme y écrit au lancement). */
const sansAppareil = (texte) => { const m = JSON.parse(texte); delete m.appareil; return JSON.stringify(m); };
const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const temp = dossier(`${profil.split(/[\\/]/).pop()}-temp`);
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', TEMP: temp, TMP: temp, ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  // Les variables du sans-fil et du téléphone d'essai ne viennent jamais de l'environnement du poste.
  for (const cle of Object.keys(complet)) if (/^GTRACKER_BANC_(SANSFIL|TELEPHONE)/.test(cle) && !(cle in env)) delete complet[cle];
  // Langue de la page : français sauf `BANC_LANGUE_PAGE` (cas 7g, page en anglais) ; la variable ne passe pas au programme.
  const langue = env.BANC_LANGUE_PAGE ?? 'fr-FR';
  delete complet.BANC_LANGUE_PAGE;
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, `--lang=${langue}`, '--force-device-scale-factor=1', '--hide-scrollbars'], { env: complet, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
/** Réglages › Connexion ouvert, bloc du sans-fil présent (le nom de la fonction date du temps où le bloc était dans Mémoire). */
async function ouvrirMemoire(b) {
  await b.go('/parametres', 5000);
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Connexion')`, { timeout: 8000, label: 'bloc Connexion' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.wireless-card'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Connexion')`);
  }
  await b.waitFor(`Boolean(document.querySelector('.wireless-card'))`, { timeout: 8000, label: 'bloc Téléphone' });
  await b.settle({ max: 1500 });
}
/** Ce que le bloc dit : cases, phrases, adresse, code, décompte, téléphones, boutons. */
const carte = (b) => b.evaluate(`(() => {
  const c = document.querySelector('.wireless-card');
  if (!c) return null;
  const tx = (s) => c.querySelector(s)?.textContent.trim() ?? null;
  return {
    titre: tx('.settings-section__title'),
    coche: c.querySelector('.wireless-card__toggle')?.checked ?? null,
    statut: tx('.wireless-card__status'),
    avertissement: tx('.wireless-card__warning'),
    aide: tx('.wireless-card__hint'),
    pareFeu: tx('.wireless-card__firewall'),
    pareFeuPhrases: [...c.querySelectorAll('.wireless-card__firewall p')].map((x) => x.textContent.trim()),
    autoriser: c.querySelector('.wireless-card__authorize')?.textContent.trim() ?? null,
    erreur: tx('.wireless-card__error'),
    adresse: tx('.wireless-card__address'),
    code: tx('.wireless-card__code'),
    decompte: tx('.wireless-card__countdown'),
    resultat: tx('.wireless-card__result'),
    codesFaux: tx('.wireless-card__wrong-codes'),
    texte: c.innerText,
    telephones: [...c.querySelectorAll('.wireless-card__phones li')].map((li) => li.innerText.replace(/\\n+/g, ' / ')),
    boutons: [...c.querySelectorAll('button')].map((x) => x.textContent.trim()),
    cable: c.querySelector('details.wireless-card__cable') ? { resume: c.querySelector('details.wireless-card__cable > summary').textContent.trim(), ouvert: c.querySelector('details.wireless-card__cable').open, texte: c.querySelector('details.wireless-card__cable').textContent.replace(/\\s+/g, ' ').trim() } : null,
  };
})()`);
const secondes = (decompte) => { const m = /^(\d+):(\d\d)$/.exec(decompte ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
/** Ce que la barre du haut dit à côté du bouton « Synchroniser » (« Téléphone d'essai relié ») ; `null` quand aucun téléphone n'est relié. */
const relie = (b) => b.evaluate(`document.querySelector('.phone-sync__linked')?.textContent.trim() ?? null`);
/** Nom que porte le faux téléphone par défaut. */
const NOM_FAUX = "Téléphone d'essai";
const LIGNE_RELIE = `${NOM_FAUX} relié`;
/** Attend que la barre dise « <nom> relié » ; rend ce qu'elle dit. Rien ne se lance à l'arrivée du téléphone. */
async function attendreRelie(b, quoi, timeout = 20000) {
  await b.waitFor(`document.querySelector('.phone-sync__linked')?.textContent.trim() === ${JSON.stringify(LIGNE_RELIE)}`, { timeout, label: quoi });
  return relie(b);
}
/** Attend que la barre ne dise plus « relié » : le départ du téléphone a été annoncé à la page. */
const attendreNonRelie = (b, quoi, timeout = 10000) => b.waitFor(`document.querySelector('.phone-sync__linked') === null`, { timeout, label: quoi });
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
/**
 * Ce que dit la fenêtre « Synchroniser » ; `null` sans fenêtre. `phrases` : les paragraphes du corps (les exceptions du compte
 * rendu et les raisons repliées comprises), `lignes` : une par geste du compte rendu avec ses noms, `aides` : les petites
 * phrases sous les boutons, `barre` : vrai tant qu'une barre d'avancement est montrée, `tout` : tout le texte, noms compris.
 */
const fenetre = (b) => b.evaluate(`(() => {
  const d = document.querySelector('[role=dialog].phone-sync__dialog');
  if (!d) return null;
  const tx = (x) => (x ? x.textContent.trim() : null);
  return {
    titre: tx(d.querySelector('.ui-dialog__head strong')),
    sousTitre: tx(d.querySelector('.phone-sync__subtitle')),
    phrases: [...d.querySelectorAll('.phone-sync__body p')].map(tx),
    aides: [...d.querySelectorAll('p.phone-sync__hint')].map(tx),
    etapes: [...d.querySelectorAll('.phone-sync__steps li')].map(tx),
    lignes: [...d.querySelectorAll('.phone-sync__row')].map((r) => ({ label: tx(r.querySelector('.phone-sync__row-label')), texte: tx(r.querySelector('.phone-sync__row-text')), noms: [...r.querySelectorAll('.phone-sync__names li')].map(tx) })),
    boutons: [...d.querySelectorAll('.phone-sync__actions button')].map(tx),
    boutonsCorps: [...d.querySelectorAll('.phone-sync__body button')].map(tx),
    barre: Boolean(d.querySelector('progress.phone-sync__bar')),
    dossier: tx(d.querySelector('code.phone-sync__folder')),
    tout: d.textContent.replace(/\\s+/g, ' ').trim(),
  };
})()`);
/** Deux chemins du disque pour le même dossier (casse, sens des barres et barre finale mis à part). */
const memeDossier = (a, b) => { const n = (x) => String(x ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(); return n(a) !== '' && n(a) === n(b); };
/** Ce que le compte rendu ne dit plus (phrases d'avant la remise à plat, ou mots de mécanique). */
const ANCIENNES = /touchez « Mettre à jour »|copiées? vers|attend(ent)? le câble|Les deux appareils sont à jour|Sans câble, le téléphone|Supprimer cette|retirerait|mise dans la corbeille|laissée? pour|Aucun téléphone ne se présente|Aucun téléphone ne répond|ne répond pas|Réessayer|Débogage USB|outil gratuit de Google|Platform-Tools|adbIntrouvable/;
/** Les boutons qui montrent qu'une synchronisation est arrivée à une issue : compte rendu ou question. */
const BOUTONS_ISSUE = ['Fermer', 'Tout garder', 'Les garder', 'La garder', 'Le garder'];
/** Tout ce que la fenêtre dit, d'un relevé : titre, phrases, lignes et étapes (pour relever ce qui a été vu en route). */
const dits = (f) => [f?.titre, f?.sousTitre, ...(f?.phrases ?? []), ...(f?.aides ?? []), ...(f?.etapes ?? []), ...(f?.lignes ?? []).map((l) => `${l.label} : ${l.texte}`)].filter(Boolean);
/**
 * Attend l'issue de la synchronisation en cours (compte rendu ou question) ; rend la fenêtre, avec `vues` : tout ce qui a été
 * dit en route. `ancien` : téléphone d'avant l'écriture sans fil, qui n'a jamais d'écran de départ ni de « Première
 * synchronisation ».
 */
async function attendreIssue(b, quoi, { ancien = false, timeout = 40000 } = {}) {
  const vues = new Set();
  const fin = Date.now() + timeout;
  while (Date.now() < fin) {
    const g = await fenetre(b);
    for (const p of dits(g)) vues.add(p);
    if (g && !g.barre && g.boutons.some((x) => BOUTONS_ISSUE.includes(x))) break;
    await b.wait(25);
  }
  await b.wait(300);
  const f = await fenetre(b);
  for (const p of dits(f)) vues.add(p);
  console.log(`  « Synchroniser » (${quoi}) dit : ${JSON.stringify(f?.titre)} ${JSON.stringify(f?.phrases)} ; lignes : ${JSON.stringify((f?.lignes ?? []).map((l) => `${l.label} : ${l.texte}`))} ; boutons : ${(f?.boutons ?? []).join(' / ')}`);
  check(`« Synchroniser » (${quoi}) : l'issue est arrivée`, Boolean(f) && !f.barre && f.boutons.some((x) => BOUTONS_ISSUE.includes(x)), JSON.stringify(f));
  check(`« Synchroniser » (${quoi}) : aucune ancienne phrase (« touchez Mettre à jour », « copiées vers », « Réessayer »…), ni en route ni à la fin`, ![...vues, f?.tout ?? ''].some((p) => ANCIENNES.test(p)), JSON.stringify([...vues].filter((p) => ANCIENNES.test(p))));
  if (ancien) check(`« Synchroniser » (${quoi}) : jamais de « Première synchronisation… » (téléphone ancien, il n'est pas écrit)`, ![...vues].some((p) => /Première synchronisation/.test(p)), JSON.stringify([...vues]));
  return f ? { ...f, vues: [...vues] } : f;
}
/** Un itinéraire (fiche au format de `planning/routeRecord.ts`, et son GPX) dans `racine/itineraires`, à une date connue. */
function posterItineraire(racine, nom, creation, { note = null, maj = null, jour = 5 } = {}) {
  mkdirSync(join(racine, 'itineraires'), { recursive: true });
  // `noteBanc` : champ inconnu, gardé à la réécriture, qui fait varier le contenu d'une version à l'autre.
  const fiche = { format: FORMATS.memoire.replace(/-memoire$/, '-itineraire'), version: 4, name: nom, activityId: null, createdAt: creation, updatedAt: maj ?? creation, waypoints: [{ lat: 43.5, lon: 3.9 }, { lat: 43.51, lon: 3.92 }], legs: [{ mode: 'straight', points: [[43.5, 3.9], [43.51, 3.92]] }], ...(note ? { noteBanc: note } : {}) };
  const date = new Date(Date.UTC(2026, 8, jour, 12, 0, 0));
  for (const [ext, contenu] of [['json', `${JSON.stringify(fiche)}\n`], ['gpx', `<gpx version="1.1" creator="banc"><rte><name>${nom}</name>${note ? `<desc>${note}</desc>` : ''}</rte></gpx>\n`]]) {
    const f = join(racine, 'itineraires', `${nom}.${ext}`);
    writeFileSync(f, contenu);
    utimesSync(f, date, date);
  }
}
/** Le téléphone d'avant l'écriture sans fil, lu seulement : ce que le compte rendu dit de lui. */
/** Phrase dite avant la demande d'autorisation de Windows (`authorizationNoticeText`, `src/library/wirelessPhone.ts`). */
const ALLUMAGE = "Windows va demander de confirmer. L'autorisation vaut aussi sur les réseaux publics : le partage de connexion du téléphone en est un.";
const PHRASE_ANCIEN ='Le Gtracker du téléphone est trop ancien pour recevoir par le Wi-Fi : mettez-le à jour (Réglages › Application du téléphone).';
/** « Synchroniser » (barre du haut) : attend l'issue et rend la fenêtre ; `{ ancien: true }` pour un téléphone d'avant l'écriture. */
async function synchroniser(b, quoi, options) {
  check(`« Synchroniser » (${quoi}) : clic`, (await b.click('.shell-topactions .phone-sync')) === 'ok');
  await b.wait(200);
  return attendreIssue(b, quoi, options);
}
/** Attend dans la fenêtre un relevé qui répond à `ok` ; rend ce relevé (ou le dernier, `null` compris, à l'échéance). */
async function attendreFenetre(b, ok, quoi, timeout = 20000) {
  const fin = Date.now() + timeout;
  let f = null;
  while (Date.now() < fin) {
    f = await fenetre(b);
    if (f && ok(f)) return f;
    await b.wait(50);
  }
  check(`${quoi} : la fenêtre est arrivée là`, false, JSON.stringify(f));
  return f;
}
/**
 * « Synchroniser » d'une première synchronisation d'un téléphone à jour : l'écran de départ s'arrête, « Commencer » le fait
 * partir. Rend l'écran de départ (relevé avant le clic) et le compte rendu ; `depart` reçoit l'écran de départ pour ses contrôles.
 */
async function synchroniserPremiere(b, quoi, options = {}) {
  check(`« Synchroniser » (${quoi}) : clic`, (await b.click('.shell-topactions .phone-sync')) === 'ok');
  const depart = await attendreFenetre(b, (f) => f.boutons.includes('Commencer'), `${quoi} : écran de départ`);
  console.log(`  écran de départ (${quoi}) : ${JSON.stringify(depart?.titre)} ${JSON.stringify(depart?.phrases)} ; dossier ${depart?.dossier} ; boutons ${(depart?.boutons ?? []).join(' / ')}`);
  options.depart?.(depart);
  if (options.captureDepart) await capturerPage(b, options.captureDepart);
  check(`« Synchroniser » (${quoi}) : « Commencer »`, (await b.clickText('Commencer', '.phone-sync__actions button')) === 'ok');
  await b.wait(200);
  const compte = await attendreIssue(b, quoi, options);
  return { depart, compte };
}
const fermerFenetre = async (b) => { await b.evaluate(`[...document.querySelectorAll('.phone-sync__actions button')].find((x) => x.textContent.trim() === 'Fermer')?.click()`); await b.wait(300); };
/** Capture JPEG de la page entière (fenêtre ou barre du haut comprises), en haut de page. */
async function capturerPage(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await b.wait(300);
  const s = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(s.result.data, 'base64'));
}
/** Une ligne du compte rendu ; `undefined` si le geste n'a pas de ligne. */
const ligneDe = (f, label) => (f?.lignes ?? []).find((l) => l.label === label);
/** Vrai si une ligne de ce geste dit ce texte (le texte comme le téléphone le lirait, sans les noms). */
const ditLigne = (f, label, texte) => (f?.lignes ?? []).some((l) => l.label === label && l.texte === texte);
/** Ce que la synchronisation par le Wi-Fi ne fait pas : pas de copie de sécurité, pas d'identifiant posé sur le téléphone, rien écrit sur lui. */
const copiesDe = (profil) => { const d = join(profil, 'Documents-essai', 'Gtracker-copies'); return existsSync(d) ? readdirSync(d) : []; };

// ---------- le téléphone à jour : deux sens ----------
/** Mémoire de l'ordinateur prête d'avance : son marqueur et les sessions `sessions`. */
function fabriquerMemoirePc(nom, sessions) {
  const racine = dossier(nom);
  writeFileSync(join(racine, 'gtracker.json'), `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`);
  for (const s of sessions) poserSession(racine, s);
  return racine;
}
/**
 * Téléphone qui écrit : marqueur, sessions, des lieux appris valides et vides (rien à fondre) et un GPX d'itinéraire sans
 * fiche qui porte la marque, que la synchronisation ne copie ni ne change.
 */
function fabriquerTelephoneAJour(nom, sessions) {
  const racine = dossier(nom);
  writeFileSync(join(racine, 'gtracker.json'), `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`);
  writeFileSync(join(racine, 'lieux.json'), `${JSON.stringify({ format: FORMATS.memoire.replace(/-memoire$/, '-lieux'), version: 1, places: [] })}\n`);
  mkdirSync(join(racine, 'itineraires'), { recursive: true });
  writeFileSync(join(racine, 'itineraires', ORPHELIN), `<gpx><!-- ${MARQUE} --></gpx>`);
  const date = new Date(Date.UTC(2026, 8, 9, 12, 0, 0));
  for (const f of ['lieux.json', `itineraires/${ORPHELIN}`]) utimesSync(join(racine, ...f.split('/')), date, date);
  for (const s of sessions) poserSession(racine, s);
  return racine;
}
const ORPHELIN = 'parcours-telephone.gpx';
const horsSessionsTel = (tel) => empreinte(tel, (c) => c === 'lieux.json' || c === `itineraires/${ORPHELIN}`);
const retirerSession = (racine, s) => { for (const ext of ['gpx', 'json']) { const f = join(racine, 'sessions', nomFichier(s).replace(/\.gpx$/, `.${ext}`)); if (existsSync(f)) rmSync(f); } };
const retirerItineraire = (racine, nom) => { for (const ext of ['json', 'gpx']) { const f = join(racine, 'itineraires', `${nom}.${ext}`); if (existsSync(f)) rmSync(f); } };
const itinerairesDe = (racine) => (existsSync(join(racine, 'itineraires')) ? readdirSync(join(racine, 'itineraires')).sort() : []);
const fichiersItineraires = (noms) => noms.flatMap((n) => [`${n}.json`, `${n}.gpx`]).sort();
/** Date de création (identité) d'un itinéraire d'essai : distincte pour chacun. */
const CREATIONS = new Map();
const creationDe = (nom) => { if (!CREATIONS.has(nom)) CREATIONS.set(nom, `2026-09-${String(CREATIONS.size + 1).padStart(2, '0')}T08:00:00.000Z`); return CREATIONS.get(nom); };
const poserIti = (racine, nom, options) => posterItineraire(racine, nom, creationDe(nom), options);
/** Les deux côtés portent les mêmes sessions `attendues`, entières, octet pour octet, sans provisoire ; rien de la marque du téléphone sur l'ordinateur. */
function memesSessions(quoi, memoire, tel, attendues) {
  const noms = attendues.map(nomFichier).sort();
  check(`${quoi} : le téléphone porte ${attendues.length} sessions`, JSON.stringify(gpxsDe(tel)) === JSON.stringify(noms), gpxsDe(tel).join(' | '));
  check(`${quoi} : sur le téléphone, chaque GPX a sa fiche (aucune moitié de session)`, fichesDe(tel).join('|') === noms.map((n) => n.replace(/\.gpx$/, '.json')).join('|'), sessionsDe(tel).join(' | '));
  check(`${quoi} : aucun temporaire sur le téléphone`, temporaires(tel).length === 0, temporaires(tel).join(','));
  if (JSON.stringify(gpxsDe(tel)) === JSON.stringify(noms)) verifierRangees(quoi, memoire, tel, attendues);
}
/** Les deux côtés portent les itinéraires `noms` (fiche et GPX), identiques à l'octet ; le téléphone garde en plus son GPX seul. */
function memesItineraires(quoi, memoire, tel, noms) {
  const attendus = fichiersItineraires(noms);
  check(`${quoi} : l'ordinateur porte ${noms.length} itinéraires (fiche et GPX)`, JSON.stringify(itinerairesDe(memoire)) === JSON.stringify(attendus), itinerairesDe(memoire).join(' | '));
  check(`${quoi} : le téléphone porte les mêmes (et son GPX seul)`, JSON.stringify(itinerairesDe(tel)) === JSON.stringify([...attendus, ORPHELIN].sort()), itinerairesDe(tel).join(' | '));
  const differents = attendus.filter((n) => existsSync(join(memoire, 'itineraires', n)) && existsSync(join(tel, 'itineraires', n)) && !readFileSync(join(memoire, 'itineraires', n)).equals(readFileSync(join(tel, 'itineraires', n))));
  check(`${quoi} : fiches et GPX identiques des deux côtés, octet pour octet`, differents.length === 0, differents.join(','));
  check(`${quoi} : aucun temporaire dans itineraires/ (ordinateur, téléphone)`, temporaires(memoire).length === 0 && temporaires(tel).length === 0, `${temporaires(memoire)} ${temporaires(tel)}`);
}
/** Corbeille de l'ordinateur sur le disque. */
const corbeilleDe = (memoire) => {
  const d = join(memoire, 'corbeille');
  let index = null;
  try { index = JSON.parse(readFileSync(join(d, 'corbeille.json'), 'utf8')); } catch { /* pas de corbeille */ }
  return { dir: d, index, entries: index?.entries ?? [] };
};
const lireJson = (chemin) => { try { return JSON.parse(readFileSync(chemin, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
/** Le bloc « Téléphone sans câble » ouvert, le sans-fil écoute ; « Relier un téléphone », code lu sur la page, le faux téléphone s'appaire. */
async function relier(b, faux) {
  await ouvrirMemoire(b);
  await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
  check('« Relier un téléphone »', (await b.clickText('Relier un téléphone', '.wireless-card button')) === 'ok');
  await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 8000, label: 'code' });
  const c = await carte(b);
  const ad = adresseDe(c);
  const r = await tenter(() => faux.appairer(ad.hote, ad.port, c.code));
  check('le téléphone à jour s\'appaire', Boolean(r.liaison), JSON.stringify(r));
  await b.waitFor(`/relié en ce moment/.test(document.querySelector('.wireless-card')?.innerText ?? '')`, { timeout: 8000, label: 'téléphone relié' });
  return { ad, liaison: r.liaison };
}
/** La liaison `liaison` est finie (fermée par le téléphone ou coupée) : attend que la page ne la dise plus en cours. */
const attendreLiaisonFinie = (b) => b.waitFor(`/relié en ce moment/.test(document.querySelector('.wireless-card')?.innerText ?? '') === false`, { timeout: 10000, label: 'liaison finie côté PC' });
/** Un téléphone (qui garde son jeton) se présente de nouveau ; la page le dit relié. */
async function reconnecter(b, faux, ad) {
  const r = await tenter(() => faux.connecter(ad.hote, ad.port));
  check('le téléphone se représente par son jeton', Boolean(r.liaison), JSON.stringify(r));
  await b.waitFor(`/relié en ce moment/.test(document.querySelector('.wireless-card')?.innerText ?? '')`, { timeout: 8000, label: 'téléphone relié de nouveau' });
  return r.liaison;
}
/** Supprime la première ligne de la page Sessions (« … », « Supprimer », « Confirmer ») : elle part à la corbeille de l'ordinateur. */
async function supprimerPremiereLigne(b, quoi) {
  await b.go('/sessions', 5000);
  await b.waitFor(`/session/i.test(document.body.innerText)`, { timeout: 5000 });
  await b.settle({ max: 2000 });
  check(`${quoi} : « … » puis « Supprimer » de la première ligne`, (await actionLigne(b.evaluate, b.wait, 'Wingfoil', 'Supprimer')) === 'ok');
  await b.waitFor(`Boolean(document.querySelector('.lib-row__confirm'))`, { timeout: 4000, label: 'confirmation' });
  check(`${quoi} : « Confirmer »`, (await b.clickText('Confirmer')) === 'ok');
}
const contientPhrase = (f, phrase) => (f?.phrases ?? []).includes(phrase);
/** Le marqueur du téléphone, lu sur le disque. */
const marqueurDe = (tel) => lireJson(join(tel, 'gtracker.json'));

try {
  console.log('\n== Préparation : quatre sessions (dont une de plus de 2 Mio) écrites par le programme');
  await fabriquerModeles();

  // ---------- 1. principal ----------
  console.log('\n== 1. Principal : activation, fenêtre, mauvais codes, appairage, arrivée sans copie, Synchroniser, déjà là, secrets, Retirer');
  if (veut('1')) {
    const profil = dossier('p1-profil');
    const memoire = dossier('p1-memoire');
    const tel = fabriquerTelephone('p1-tel');
    // Un itinéraire de chaque côté : par le Wi-Fi, la synchronisation les laisse tels quels (ils attendent le câble).
    posterItineraire(tel, 'Itin telephone', '2026-09-02T08:00:00.000Z');
    posterItineraire(memoire, 'Itin ordinateur', '2026-09-01T08:00:00.000Z');
    const avantTel = empreinte(tel);
    const itinerairesPc = () => empreinte(join(memoire, 'itineraires'));
    const avantItinerairesPc = itinerairesPc();
    const gros =join(tel, 'sessions', nomFichier(SESSIONS[2]));
    console.log(`  téléphone factice : ${(arbre(tel) ?? []).join(', ')} ; plus gros fichier : ${statSync(gros).size} octets`);
    check('le gros fichier de session dépasse 2 Mio (au moins trois blocs)', statSync(gros).size > 2 * 1024 * 1024, String(statSync(gros).size));
    const secretsProfil = () => arbre(join(profil, 'sansfil')) ?? [];
    let faux = null;
    let jetonHex = null;
    await avecProgramme(profil, memoire, {}, '1', async (b, p) => {
      await ouvrirMemoire(b);
      let c = await carte(b);
      console.log(`  bloc, éteint : ${JSON.stringify(c.texte)}`);
      check('1a. le bloc « Téléphone » est là (plus « Téléphone sans câble »), case décochée', c.titre === 'Téléphone' && c.coche === false, JSON.stringify({ titre: c.titre, coche: c.coche }));
      const contenuConnexion = await b.evaluate(`[...document.querySelectorAll('.settings-block__body .settings-section__title')].map((x) => x.textContent.trim()).join(' > ')`);
      check('1a. le bloc Connexion : Téléphone, Application du téléphone, puis la ligne des ceintures (« Sur l\'application Android seulement. »), dans cet ordre', contenuConnexion === 'Téléphone > Application du téléphone > Ceintures et montres' && /Sur l'application Android seulement\./.test(await b.evaluate(`[...document.querySelectorAll('.settings-section__title')].find((x) => x.textContent.trim() === 'Ceintures et montres')?.closest('.settings-section')?.innerText ?? ''`)), contenuConnexion);
      check('1a. le paragraphe replié « Par câble (avancé) » est là, fermé, et dit le débogage USB comme une possibilité', c.cable !== null && c.cable.resume === 'Par câble (avancé)' && c.cable.ouvert === false && /Débogage USB/.test(c.cable.texte) && !/Débogage USB/.test(c.texte), JSON.stringify(c.cable));
      check('1a. la phrase d\'état dit que le sans-fil est éteint', c.statut === 'Le sans-fil est éteint : le téléphone ne peut pas se présenter à cet ordinateur.', c.statut);
      check('1a. la phrase prévient que Windows va demander de confirmer (et que l\'autorisation vaut sur les réseaux publics)', c.texte.includes(ALLUMAGE), c.texte);
      check('1a. ni message de pare-feu, ni bouton « Autoriser Gtracker », ni ancien avertissement (pare-feu d\'essai ouvert)', c.pareFeu === null && c.autoriser === null && c.avertissement === null && !c.boutons.includes('Autoriser Gtracker'), JSON.stringify({ pareFeu: c.pareFeu, avertissement: c.avertissement }));
      check('1a. pas de « Relier un téléphone » ni de liste tant que le sans-fil est éteint', !c.boutons.includes('Relier un téléphone') && c.telephones.length === 0 && !/Téléphones reliés/.test(c.texte), c.boutons.join('/'));
      check('1a. aucun secret dans le profil tant que rien n\'est allumé', secretsProfil().length === 0, secretsProfil().join(','));
      await capturer(b, 'sansfil-1-eteint');

      // -- allumer
      check('1b. clic sur la case « Recevoir les sessions du téléphone sans câble »', (await b.click('.wireless-card__toggle')) === 'ok');
      await b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
      c = await carte(b);
      console.log(`  bloc, allumé : ${JSON.stringify(c.texte)}`);
      check('1b. la case est cochée', c.coche === true);
      check('1b. « Prêt : Gtracker attend votre téléphone. » (plus d\'adresse dans la phrase d\'état)', c.statut === 'Prêt : Gtracker attend votre téléphone.', c.statut);
      check('1b. plus d\'aide « Aucun téléphone ne se présente ? » (ni conseil de câble ou de débogage USB)', c.aide === null && !/Aucun téléphone ne se présente|câble USB|débogage USB/.test(c.texte), c.aide ?? c.texte);
      check('1b. pare-feu d\'essai ouvert : aucun message de Windows ni bouton « Autoriser Gtracker »', c.pareFeu === null && c.autoriser === null && c.avertissement === null, JSON.stringify({ pareFeu: c.pareFeu, avertissement: c.avertissement }));
      check('1b. « Téléphones reliés » : « Aucun téléphone relié pour l\'instant. »', /Téléphones reliés/.test(c.texte) && /Aucun téléphone relié pour l'instant\./.test(c.texte), c.texte);
      check('1b. « Relier un téléphone » est offert', c.boutons.includes('Relier un téléphone'), c.boutons.join('/'));
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
      check('1c. la phrase dit d\'ouvrir Gtracker sur le téléphone, Réglages, Connexion', /Sur le téléphone, ouvrez Gtracker, puis Réglages, Connexion/.test(c.texte), c.texte);
      const avantDecompte = secondes(c.decompte);
      await capturer(b, 'sansfil-2-fenetre-de-liaison');
      await b.wait(2500);
      c = await carte(b);
      check('1c. le décompte baisse', secondes(c.decompte) !== null && secondes(c.decompte) < avantDecompte, `${avantDecompte} puis ${c.decompte}`);
      const mauvais = c.code === '000000' ? '000001' : '000000';
      const essais = [];
      for (let k = 1; k <= 3; k++) {
        const t = new FauxTelephone({ ancien: true, dossier: tel, nom: `Intrus ${k}`, delaiMs: 5000 });
        essais.push(await tenter(() => t.appairer(ad.hote, ad.port, mauvais)));
      }
      console.log(`  trois mauvais codes : ${JSON.stringify(essais.map((e) => e.refus ?? e.erreur))}`);
      check('1d. chacun des trois mauvais codes est refusé (raison « code »)', essais.every((e) => e.refus === 'code'), JSON.stringify(essais.map((e) => e.refus ?? e.erreur)));
      await b.waitFor(`/La fenêtre s'est fermée sans téléphone relié/.test(document.querySelector('.wireless-card__result')?.textContent ?? '')`, { timeout: 8000, label: 'fenêtre fermée' });
      c = await carte(b);
      console.log(`  après trois échecs : ${JSON.stringify(c.resultat)}`);
      await b.waitFor(`/3 codes faux reçus/.test(document.querySelector('.wireless-card__wrong-codes')?.textContent ?? '')`, { timeout: 8000, label: 'origine des codes faux' });
      c = await carte(b);
      check('1d. la page dit d\'où venaient les codes faux : « 3 codes faux reçus, le dernier de l\'appareil 127.0.0.1. »', c.codesFaux === "3 codes faux reçus, le dernier de l'appareil 127.0.0.1.", c.codesFaux);
      check('1d. la page dit que la fenêtre s\'est fermée sans téléphone relié',/Cliquez de nouveau sur « Relier un téléphone » et vérifiez le code tapé/.test(c.resultat ?? ''), c.resultat);
      check('1d. le code n\'est plus affiché', c.code === null, c.code);
      // Le bon code, une fois la fenêtre fermée : refusé.
      const tardif = new FauxTelephone({ ancien: true, dossier: tel, nom: 'Trop tard', delaiMs: 5000 });
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
      faux = new FauxTelephone({ ancien: true, dossier: tel, delaiMs: 8000 });
      // Une application d'avant l'échange SPAKE2 (un `appairer` sans part) : refusée (raison « version »), sans compter comme un code faux.
      const vieux = await tenter(() => new FauxTelephone({ ancienEchange: true, dossier: tel, nom: 'Application ancienne', delaiMs: 5000 }).appairer(ad.hote, ad.port, code));
      check('1e. une application d\'avant l\'échange SPAKE2 est refusée (raison « version »), même avec le bon code', vieux.refus === 'version', JSON.stringify(vieux));
      c = await carte(b);
      check('1e. ce refus ne ferme pas la fenêtre et n\'est pas compté comme un code faux', c.code === code && c.codesFaux === null && c.telephones.length === 0, JSON.stringify({ code: c.code, codesFaux: c.codesFaux, telephones: c.telephones }));
      check('1e. le journal de la coquille dit « application du téléphone trop ancienne »', p.journal.some((l) => /appairage refusé( \([^)]*\))? : application du téléphone trop ancienne/.test(l)), p.journal.filter((l) => /appairage/.test(l)).join(' | '));
      const un = await tenter(() => new FauxTelephone({ ancien: true, dossier: tel, nom: 'Intrus 4', delaiMs: 5000 }).appairer(ad.hote, ad.port, code === '000000' ? '000001' : '000000'));
      check('1e. un mauvais code est refusé (raison « code »), la fenêtre reste ouverte', un.refus === 'code' && (await carte(b)).code === code, JSON.stringify(un));
      await b.waitFor(`/Code faux reçu de l'appareil/.test(document.querySelector('.wireless-card__wrong-codes')?.textContent ?? '')`, { timeout: 8000, label: 'origine du code faux' });
      c = await carte(b);
      check('1e. la page dit d\'où venait le code faux : « Code faux reçu de l\'appareil 127.0.0.1. »', c.codesFaux === "Code faux reçu de l'appareil 127.0.0.1.", c.codesFaux);
      const bon = await tenter(() => faux.appairer(ad.hote, ad.port, code));
      check('1e. le bon code appaire le téléphone d\'essai', Boolean(bon.liaison), JSON.stringify(bon));
      jetonHex = faux.memoire?.jeton ?? null;
      check('1e. le téléphone garde un jeton de 256 bits (64 caractères hexadécimaux)', /^[0-9a-f]{64}$/.test(jetonHex ?? ''), jetonHex ?? '(aucun)');
      await b.waitFor(`/Téléphone .* relié\\./.test(document.querySelector('.wireless-card__result')?.textContent ?? '')`, { timeout: 8000, label: 'téléphone relié' });
      c = await carte(b);
      console.log(`  après l'appairage : résultat ${JSON.stringify(c.resultat)} ; téléphones ${JSON.stringify(c.telephones)}`);
      check('1e. la page dit « Téléphone Téléphone d\'essai relié. »', c.resultat === "Téléphone Téléphone d'essai relié.", c.resultat);
      check('1e. la liste porte « Téléphone d\'essai » relié en ce moment', c.telephones.length === 1 && /Téléphone d'essai/.test(c.telephones[0]) && /relié en ce moment/.test(c.telephones[0]), JSON.stringify(c.telephones));
      check('1e. toujours aucune aide « Aucun téléphone ne se présente ? » ni message de pare-feu', c.aide === null && !/Aucun téléphone ne se présente/.test(c.texte) && c.pareFeu === null, `${c.aide} / ${c.pareFeu}`);

      // -- arrivée : la barre dit « nom relié », plus rien ne se copie seul
      const n1 = await attendreRelie(b, 'téléphone relié dans la barre');
      console.log(`  à côté du bouton : « ${n1} »`);
      check(`1f. à côté du bouton « Synchroniser », la barre dit « ${LIGNE_RELIE} » (plus « Téléphone relié : touchez… », plus de ligne de 12 s)`, n1 === LIGNE_RELIE && (await b.evaluate(`document.querySelector('.phone-sync__arrival') === null`)), n1);
      await b.wait(3000);
      check('1f. l\'arrivée ne range rien : sessions/ vide, ni base de synchronisation, ni corbeille, ni copie de sécurité', sessionsDe(memoire).length === 0 && !existsSync(join(memoire, 'synchro')) && !existsSync(join(memoire, 'corbeille')) && copiesDe(profil).length === 0, (arbre(memoire) ?? []).join(','));
      telephoneIntact('1f, avant « Synchroniser »', tel, avantTel);
      await capturer(b, 'sansfil-3-telephone-relie');

      // -- « Synchroniser » par le Wi-Fi : les sessions du téléphone viennent sur l'ordinateur, le téléphone reste intact
      const f1 = await synchroniser(b, '1f', { ancien: true });
      await capturerPage(b, 'sansfil-1-compte-rendu-telephone-ancien');
      check('1f. titre « Synchronisation terminée », sous-titre « Téléphone d\'essai · par le Wi-Fi »', f1?.titre === 'Synchronisation terminée' && f1?.sousTitre === `${NOM_FAUX} · par le Wi-Fi`, JSON.stringify([f1?.titre, f1?.sousTitre]));
      check('1f. ligne « Reçu du téléphone : 3 sessions », avec leurs trois noms', ditLigne(f1, 'Reçu du téléphone', '3 sessions') && ligneDe(f1, 'Reçu du téléphone')?.noms.length === 3, JSON.stringify(f1?.lignes));
      check('1f. aucune autre ligne (rien envoyé au téléphone, rien supprimé, rien modifié)', (f1?.lignes ?? []).length === 1, JSON.stringify(f1?.lignes));
      check('1f. l\'exception dit que le Gtracker du téléphone est trop ancien pour recevoir par le Wi-Fi (rien n\'attend le téléphone : ni session ni itinéraire de l\'ordinateur n\'est compté), sans plus', contientPhrase(f1, PHRASE_ANCIEN), JSON.stringify(f1?.phrases));
      check('1f. l\'autre exception est le « lieux.json » du faux téléphone, de format inconnu : « 1 fichier illisible n\'a pas été touché : « lieux.json ». »', contientPhrase(f1, "1 fichier illisible n'a pas été touché : « lieux.json »."), JSON.stringify(f1?.phrases));
      check('1f. aucune phrase ne dit que le téléphone a été écrit (« Mettre à jour »), ni « Première synchronisation »', !(f1?.vues ?? []).some((l) => /Mettre à jour|Première synchronisation/.test(l)), JSON.stringify(f1?.vues));
      check('1f. seul bouton : « Fermer »', JSON.stringify(f1?.boutons) === JSON.stringify(['Fermer']), JSON.stringify(f1?.boutons));
      check('1f. les itinéraires de l\'ordinateur sont intacts (fiche, GPX, tailles, dates) et celui du téléphone n\'y est pas venu', itinerairesPc() === avantItinerairesPc && (arbre(join(memoire, 'itineraires')) ?? []).every((c) => /^Itin ordinateur\./.test(c)), `${avantItinerairesPc} / ${itinerairesPc()}`);
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
      await attendreNonRelie(b, 'départ annoncé à la barre');
      check('1h. le départ est annoncé : la barre ne dit plus « relié »', (await relie(b)) === null);
      faux = new FauxTelephone({ ancien: true, dossier: tel, memoire: cote, delaiMs: 8000 });
      const retour = await tenter(() => faux.connecter(ad.hote, ad.port));
      check('1h. le téléphone se présente par son jeton, sans code', Boolean(retour.liaison), JSON.stringify(retour));
      const n2 = await attendreRelie(b, 'seconde arrivée');
      console.log(`  à côté du bouton : « ${n2} »`);
      check(`1h. la barre redit « ${LIGNE_RELIE} » (rien ne se copie seul)`, n2 === LIGNE_RELIE, n2);
      await b.wait(1500);
      check('1h. le disque n\'a pas changé (noms, tailles, dates de sessions/)', empreinte(join(memoire, 'sessions')) === apresPremier, `\n${apresPremier}\n--\n${empreinte(join(memoire, 'sessions'))}`);
      telephoneIntact('1h', tel, avantTel);
      c = await carte(b);
      check('1h. la liste redit « relié en ce moment »', c.telephones.length === 1 && /relié en ce moment/.test(c.telephones[0]), JSON.stringify(c.telephones));
      check('1h. toujours un seul téléphone dans la liste (pas de doublon)', c.telephones.length === 1);

      // -- « Récupérer » par le Wi-Fi, avec une quatrième session sur le téléphone
      poserSession(tel, QUATRIEME);
      const avantTel2 = empreinte(tel);
      const f2 = await synchroniser(b, '1i', { ancien: true });
      check('1i. ligne « Reçu du téléphone : 1 session », un seul nom', ditLigne(f2, 'Reçu du téléphone', '1 session') && ligneDe(f2, 'Reçu du téléphone')?.noms.length === 1, JSON.stringify(f2?.lignes));
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
      const refuse = await tenter(() => new FauxTelephone({ ancien: true, dossier: tel, memoire: cote, delaiMs: 5000 }).connecter(ad.hote, ad.port));
      console.log(`  téléphone retiré qui se représente : ${JSON.stringify(refuse.refus ?? refuse.erreur)}`);
      check('1j. le téléphone retiré est refusé (raison « jeton »)', refuse.refus === 'jeton', JSON.stringify(refuse));
      await b.wait(1500);
      check('1j. le disque n\'a pas changé après le retrait', empreinte(join(memoire, 'sessions')) === rangeesAvantRetrait);
      check('1j. les itinéraires de l\'ordinateur sont toujours intacts, après toutes les synchronisations', itinerairesPc() === avantItinerairesPc, `${avantItinerairesPc} / ${itinerairesPc()}`);
      // Le registre du profil ne garde plus le téléphone.
      const registre = readFileSync(join(profil, 'sansfil', 'telephones.json'), 'utf8');
      check('1j. le registre du profil ne garde plus le hachage du jeton', !registre.includes(condense.toString('hex')) && !registre.includes(condense.toString('base64')), registre.slice(0, 200));
      telephoneIntact('1j', tel, avantTel2);
    });
  }

  // ---------- 2. fenêtre expirée ----------
  console.log('\n== 2. Fenêtre d\'appairage expirée (4 s)');
  if (veut('2')) {
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
      const t = new FauxTelephone({ ancien: true, dossier: tel, delaiMs: 5000 });
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
      const t2 = new FauxTelephone({ ancien: true, dossier: tel, delaiMs: 8000 });
      const r2 = await tenter(() => t2.appairer(ad2.hote, ad2.port, c2.code));
      check('2d. dans la fenêtre neuve, le bon code appaire', Boolean(r2.liaison), JSON.stringify(r2));
      const n2d = await attendreRelie(b, 'arrivée');
      check(`2d. à l'arrivée la barre dit « ${LIGNE_RELIE} » et rien n'est rangé`, n2d === LIGNE_RELIE && (await b.wait(2000), sessionsDe(memoire).length === 0), `${n2d} / ${sessionsDe(memoire).join(',')}`);
      const f2d = await synchroniser(b, '2d', { ancien: true });
      check('2d. « Synchroniser » : ligne « Reçu du téléphone : 2 sessions »', ditLigne(f2d, 'Reçu du téléphone', '2 sessions'), JSON.stringify(f2d?.lignes));
      await b.wait(2500);
      verifierRangees('2d', memoire, tel, SESSIONS.slice(0, 2));
      await fermerFenetre(b);
      telephoneIntact('2d', tel, avantTel);
      r2.liaison?.fermer?.();
    });
  }

  // ---------- 3. coupure en plein transfert ----------
  console.log('\n== 3. Liaison coupée en plein transfert (au milieu du gros fichier)');
  if (veut('3')) {
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
      const coupeur = new FauxTelephone({ ancien: true, dossier: tel, coupureApresBlocs: 3, delaiMs: 8000 });
      const r = await tenter(() => coupeur.appairer(ad.hote, ad.port, c.code));
      check('3a. le téléphone qui coupe s\'appaire', Boolean(r.liaison), JSON.stringify(r));
      const n = await attendreRelie(b, 'arrivée');
      check(`3a. à l'arrivée la barre dit « ${LIGNE_RELIE} »`, n === LIGNE_RELIE, n);
      await b.wait(1500);
      check('3a. rien n\'est rangé avant « Synchroniser »', sessionsDe(memoire).length === 0 && coupeur.blocsEnvoyes === 0, `${sessionsDe(memoire).join(',')} / ${coupeur.blocsEnvoyes} blocs`);
      check('3b. « Synchroniser » : clic', (await b.click('.shell-topactions .phone-sync')) === 'ok');
      // La liaison coupée en route : la fenêtre attend le retour du téléphone, sans « Réessayer ».
      const fc = await attendreFenetre(b, (f) => f.titre === 'En attente de votre téléphone' && f.barre === false, '3b, attente après la coupure', 40000);
      console.log(`  attente après la coupure : ${JSON.stringify(fc?.phrases)} ; boutons ${(fc?.boutons ?? []).join(' / ')}`);
      check('3b. la fenêtre attend : « Le téléphone n\'est plus relié : la synchronisation s\'est arrêtée en route. Ce qui est fait est gardé. Elle reprend toute seule dès qu\'il revient… »', (fc?.phrases ?? []).some((l) => /^Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route\. Ce qui est fait est gardé\. Elle reprend toute seule dès qu'il revient/.test(l)), JSON.stringify(fc?.phrases));
      check('3b. seul bouton « Annuler » (ni « Réessayer », ni « Recommencer »), et aucune ancienne phrase', JSON.stringify(fc?.boutons) === JSON.stringify(['Annuler']) && !ANCIENNES.test(fc?.tout ?? ''), JSON.stringify(fc?.boutons));
      await capturerPage(b, 'sansfil-3-attente-apres-coupure');
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
      const complet = new FauxTelephone({ ancien: true, dossier: tel, memoire: coupeur.memoire, delaiMs: 8000 });
      const retour = await tenter(() => complet.connecter(ad.hote, ad.port));
      check('3d. le téléphone se représente par son jeton', Boolean(retour.liaison), JSON.stringify(retour));
      // Rien à cliquer : la fenêtre repart seule à son retour et finit.
      const fr = await attendreIssue(b, '3d, reprise seule', { ancien: true });
      check('3d. la reprise s\'est faite seule : titre « Synchronisation terminée », la liaison coupée n\'est plus dite comme un arrêt', fr?.titre === 'Synchronisation terminée' && !/n'est plus relié|Synchronisation arrêtée/.test(fr?.tout ?? ''), JSON.stringify([fr?.titre, fr?.phrases]));
      check('3d. la première phrase redit que la synchronisation d\'avant s\'était arrêtée en route et vient d\'être terminée', (fr?.phrases ?? [])[0] === "La synchronisation précédente s'était arrêtée en route : elle vient d'être terminée.", JSON.stringify(fr?.phrases));
      check('3d. le compte rendu garde ce que la première passe avait fait : « Reçu du téléphone : 3 sessions »', ditLigne(fr, 'Reçu du téléphone', '3 sessions'), JSON.stringify(fr?.lignes));
      check('3d. seul bouton : « Fermer »', JSON.stringify(fr?.boutons) === JSON.stringify(['Fermer']), JSON.stringify(fr?.boutons));
      await b.wait(2500);
      verifierRangees('3d', memoire, tel, SESSIONS);
      telephoneIntact('3d', tel, avantTel);
      retour.liaison?.fermer?.();
    });
    console.log(`  dossier temporaire du programme : ${temps.join(', ') || '(vide)'}`);
  }

  // ---------- 4. téléphone à jour : deux sens ----------
  console.log('\n== 4. Téléphone à jour : première synchronisation, second clic, itinéraires, suppressions de chaque côté');
  if (veut('4')) {
    const profil = dossier('p4-profil');
    // Le gros fichier est sur l'ordinateur : il part vers le téléphone en trois blocs.
    const memoire = fabriquerMemoirePc('p4-memoire', [SESSIONS[2], QUATRIEME]);
    const tel = fabriquerTelephoneAJour('p4-tel', [SESSIONS[0], SESSIONS[1]]);
    const COMMUNS = ['Itin commun 1', 'Itin commun 2', 'Itin commun 3', 'Itin commun 4'];
    for (const n of COMMUNS) { poserIti(tel, n); poserIti(memoire, n); }
    poserIti(tel, 'Itin telephone');
    poserIti(memoire, 'Itin ordinateur');
    const TOUTES = [...SESSIONS, QUATRIEME];
    const avantPc = sessionsDe(memoire);
    const avantTelSessions = sessionsDe(tel);
    const avantMarqueur = readFileSync(join(tel, 'gtracker.json'), 'utf8');
    const avantMarqueurPc = readFileSync(join(memoire, 'gtracker.json'), 'utf8');
    const avantHors = horsSessionsTel(tel);
    const orphelinAvant = empreinte(tel, (c) => c === `itineraires/${ORPHELIN}`);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1' }, '4', async (b) => {
      const faux = new FauxTelephone({ dossier: tel, delaiMs: 15000 });
      const { liaison } = await relier(b, faux);
      const bloc = (await carte(b)).texte.replace(/\s+/g, ' ');
      console.log(`  bloc, téléphone relié : ${JSON.stringify(bloc)}`);
      check('4a. le bloc du programme dit comment relier et synchroniser (« Reliez votre téléphone une fois, par un code… cliquez sur « Synchroniser », en haut. »), sans conseil de câble ni de débogage', bloc.includes("Reliez votre téléphone une fois, par un code. Ensuite, ouvrez Gtracker sur le téléphone, sur le même réseau que cet ordinateur (la même box Wi-Fi, ou un partage de connexion), puis cliquez sur « Synchroniser », en haut.") && !/se copient dans les deux sens|attend le câble/.test(bloc), bloc);
      const arrivee = await attendreRelie(b, 'téléphone relié dans la barre');
      console.log(`  à côté du bouton : « ${arrivee} »`);
      await b.wait(1500);
      check('4a. l\'arrivée ne range rien : ni identifiant sur le téléphone, ni copie de sécurité, ni écriture', !('id' in (marqueurDe(tel) ?? {})) && copiesDe(profil).length === 0 && horsSessionsTel(tel) === avantHors && sessionsDe(tel).join() === avantTelSessions.join(), JSON.stringify(marqueurDe(tel)));

      // -- première synchronisation : chaque côté reçoit ce qui lui manque
      const dossierCopies = join(profil, 'Documents-essai', 'Gtracker-copies');
      const premiere = await synchroniserPremiere(b, '4b, première synchronisation', {
        captureDepart: 'sansfil-4-ecran-de-depart',
        depart: (d) => {
          check('4b. l\'écran de départ : titre « Première synchronisation avec « Téléphone d\'essai » », « Chaque appareil va recevoir ce qui lui manque. Rien ne sera supprimé. » et le dossier de la copie de sécurité', d?.titre === `Première synchronisation avec « ${NOM_FAUX} »` && (d?.phrases ?? []).includes('Chaque appareil va recevoir ce qui lui manque. Rien ne sera supprimé.') && (d?.phrases ?? []).includes('Avant de commencer, Gtracker copie les deux mémoires par sécurité dans :') && memeDossier(d?.dossier, dossierCopies), JSON.stringify([d?.titre, d?.phrases, d?.dossier, dossierCopies]));
          check('4b. l\'écran de départ offre « Choisir un autre dossier » et « Commencer », rien d\'autre', JSON.stringify(d?.boutons) === JSON.stringify(['Choisir un autre dossier', 'Commencer']), JSON.stringify(d?.boutons));
          check('4b. rien n\'est encore fait avant « Commencer » : ni copie de sécurité, ni identifiant sur le téléphone, ni session échangée', copiesDe(profil).length === 0 && !('id' in (marqueurDe(tel) ?? {})) && sessionsDe(memoire).join() === avantPc.join() && sessionsDe(tel).join() === avantTelSessions.join());
        },
      });
      let f = premiere.compte;
      await capturer(b, 'sansfil-4-a-jour');
      await capturerPage(b, 'sansfil-4-compte-rendu');
      check('4b. titre « Synchronisation terminée », sous-titre « Téléphone d\'essai · par le Wi-Fi »', f?.titre === 'Synchronisation terminée' && f?.sousTitre === `${NOM_FAUX} · par le Wi-Fi`, JSON.stringify([f?.titre, f?.sousTitre]));
      check('4b. « Première synchronisation : rien n\'a été supprimé. » et « Copie de sécurité : » suivie du dossier', contientPhrase(f, "Première synchronisation : rien n'a été supprimé.") && contientPhrase(f, 'Copie de sécurité :') && f?.dossier !== null && memeDossier(String(f.dossier).split(/[\\/]/).slice(0, -1).join('/'), dossierCopies), JSON.stringify([f?.phrases, f?.dossier]));
      check('4b. « Reçu du téléphone : 2 sessions, 1 itinéraire » (leurs trois noms) et « Envoyé au téléphone : 2 sessions, 1 itinéraire » (trois noms)', ditLigne(f, 'Reçu du téléphone', '2 sessions, 1 itinéraire') && ligneDe(f, 'Reçu du téléphone')?.noms.length === 3 && ligneDe(f, 'Reçu du téléphone')?.noms.includes('Itin telephone') && ditLigne(f, 'Envoyé au téléphone', '2 sessions, 1 itinéraire') && ligneDe(f, 'Envoyé au téléphone')?.noms.length === 3 && ligneDe(f, 'Envoyé au téléphone')?.noms.includes('Itin ordinateur'), JSON.stringify(f?.lignes));
      check('4b. aucune ligne de suppression, de restauration ni de modification, aucune exception', (f?.lignes ?? []).length === 2 && (f?.phrases ?? []).every((l) => /^(Première synchronisation|Copie de sécurité)/.test(l)), JSON.stringify([f?.lignes, f?.phrases]));
      check('4b. « Ouvrir le dossier » sous le dossier, et « Fermer » seul en bas (pas de « Réessayer », pas de « Recommencer »)', JSON.stringify(f?.boutonsCorps) === JSON.stringify(['Ouvrir le dossier']) && JSON.stringify(f?.boutons) === JSON.stringify(['Fermer']), JSON.stringify([f?.boutonsCorps, f?.boutons]));
      await b.wait(2500); // réécritures différées des fiches
      memesSessions('4b', memoire, tel, TOUTES);
      memesItineraires('4b', memoire, tel, [...COMMUNS, 'Itin telephone', 'Itin ordinateur']);
      check('4b. la session de plus de 2 Mio est sur le téléphone, octet pour octet', existsSync(join(tel, 'sessions', nomFichier(SESSIONS[2]))) && octetsDe(tel, nomFichier(SESSIONS[2])).equals(octetsDe(memoire, nomFichier(SESSIONS[2]))) && statSync(join(tel, 'sessions', nomFichier(SESSIONS[2]))).size > 2 * 1024 * 1024);
      check('4b. les lieux et le GPX seul du téléphone sont intacts, et la marque n\'est pas venue sur l\'ordinateur', horsSessionsTel(tel) === avantHors && contenant(memoire, [MARQUE]).length === 0, `${contenant(memoire, [MARQUE]).join(',')} \n--- avant ---\n${avantHors}\n--- après ---\n${horsSessionsTel(tel)}`);
      check('4b. le fichier de réglages de l\'ordinateur est sur le téléphone, octet pour octet, et le téléphone n\'a rien reçu d\'autre dans reglages/', existsSync(join(memoire, 'reglages', 'pc.json')) && existsSync(join(tel, 'reglages', 'pc.json')) && readFileSync(join(memoire, 'reglages', 'pc.json')).equals(readFileSync(join(tel, 'reglages', 'pc.json'))) && readdirSync(join(tel, 'reglages')).join(',') === 'pc.json', existsSync(join(tel, 'reglages')) ? readdirSync(join(tel, 'reglages')).join(',') : 'absent');
      const copies = copiesDe(profil);
      check('4b. une seule copie de sécurité sous Documents/Gtracker-copies', copies.length === 1, copies.join(','));
      if (copies.length === 1) {
        const copie = join(profil, 'Documents-essai', 'Gtracker-copies', copies[0]);
        console.log(`  copie de sécurité : ${(arbre(copie) ?? []).filter((c) => !/\/sessions\//.test(c)).join(' ; ')}`);
        check('4b. la copie de l\'ordinateur porte ses sessions d\'avant, celle du téléphone les siennes', JSON.stringify(sessionsDe(join(copie, 'ordinateur'))) === JSON.stringify(avantPc) && JSON.stringify(sessionsDe(join(copie, 'telephone'))) === JSON.stringify(avantTelSessions), `${sessionsDe(join(copie, 'ordinateur')).join(' | ')} / ${sessionsDe(join(copie, 'telephone')).join(' | ')}`);
        check('4b. les marqueurs copiés sont ceux d\'avant (sans identifiant)', readFileSync(join(copie, 'telephone', 'gtracker.json'), 'utf8') === avantMarqueur && sansAppareil(readFileSync(join(copie, 'ordinateur', 'gtracker.json'), 'utf8')) === sansAppareil(avantMarqueurPc), JSON.stringify([avantMarqueur, readFileSync(join(copie, 'telephone', 'gtracker.json'), 'utf8'), avantMarqueurPc, readFileSync(join(copie, 'ordinateur', 'gtracker.json'), 'utf8')]));
        check('4b. la copie du téléphone garde aussi ses lieux et son GPX d\'itinéraire seul', existsSync(join(copie, 'telephone', 'lieux.json')) && existsSync(join(copie, 'telephone', 'itineraires', ORPHELIN)));
        check('4b. la copie ne porte aucun temporaire', temporaires(copie).length === 0, temporaires(copie).join(','));
      }
      const m = marqueurDe(tel);
      check('4b. identifiant et champs « synchro » et « passage » posés dans gtracker.json du téléphone, format et version gardés', typeof m?.id === 'string' && typeof m?.synchro === 'number' && m?.passage === 1 && Object.keys(m).sort().join(',') === 'format,id,passage,synchro,version' && m.format === FORMATS.memoire && m.version === 1, JSON.stringify(m));
      const idPc = marqueurDe(memoire)?.id;
      check('4b. l\'ordinateur porte son identifiant, différent de celui du téléphone', typeof idPc === 'string' && idPc !== m?.id, `${idPc} / ${m?.id}`);
      check('4b. la base de la paire est écrite sur l\'ordinateur, sans témoin d\'interruption', existsSync(join(memoire, 'synchro', `${m?.id}.json`)) && !existsSync(join(memoire, 'synchro', 'en-cours.json')), (arbre(join(memoire, 'synchro')) ?? []).join(','));
      check('4b. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0, JSON.stringify(corbeilleDe(memoire).index));
      check('4b. aucun provisoire (.gtracker-new, .gtracker-tmp) nulle part, ni sur le téléphone ni sur l\'ordinateur', temporaires(tel).length === 0 && temporaires(memoire).length === 0);
      await fermerFenetre(b);
      const synchroB = marqueurDe(tel)?.synchro;

      // -- second clic : rien à faire
      const avantPcSessions = empreinte(join(memoire, 'sessions'));
      const avantTelSess = empreinte(join(tel, 'sessions'));
      f = await synchroniser(b, '4c, second clic');
      check('4c. titre « Tout est à jour » et « Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires. » (ni ligne, ni exception, ni écran de départ)', f?.titre === 'Tout est à jour' && JSON.stringify(f?.phrases) === JSON.stringify(['Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.']) && (f?.lignes ?? []).length === 0 && JSON.stringify(f?.boutons) === JSON.stringify(['Fermer']), JSON.stringify([f?.titre, f?.phrases, f?.lignes, f?.boutons]));
      await b.wait(1500);
      check('4c. rien n\'a changé : sessions des deux côtés, champ « synchro », pas de seconde copie de sécurité', empreinte(join(memoire, 'sessions')) === avantPcSessions && empreinte(join(tel, 'sessions')) === avantTelSess && marqueurDe(tel)?.synchro === synchroB && copiesDe(profil).length === 1, `${marqueurDe(tel)?.synchro} / ${synchroB}`);
      await fermerFenetre(b);

      // -- itinéraires modifiés : un de l'ordinateur vers le téléphone, un du téléphone vers l'ordinateur
      poserIti(memoire, COMMUNS[0], { note: 'v2-ordinateur', maj: '2026-09-10T10:00:00.000Z', jour: 20 });
      poserIti(tel, 'Itin telephone', { note: 'v2-telephone', maj: '2026-09-11T10:00:00.000Z', jour: 21 });
      f = await synchroniser(b, '4d, itinéraires modifiés');
      check('4d. ligne « Modifié : 2 itinéraires, recopiés sur l\'autre appareil » (leurs deux noms)', ditLigne(f, 'Modifié', "2 itinéraires, recopiés sur l'autre appareil") && JSON.stringify([...(ligneDe(f, 'Modifié')?.noms ?? [])].sort()) === JSON.stringify([COMMUNS[0], 'Itin telephone'].sort()), JSON.stringify(f?.lignes));
      await b.wait(1500);
      memesItineraires('4d', memoire, tel, [...COMMUNS, 'Itin telephone', 'Itin ordinateur']);
      check('4d. la fiche du téléphone est celle de l\'ordinateur (v2-ordinateur) et inversement (v2-telephone)', lireJson(join(tel, 'itineraires', `${COMMUNS[0]}.json`))?.noteBanc === 'v2-ordinateur' && lireJson(join(memoire, 'itineraires', 'Itin telephone.json'))?.noteBanc === 'v2-telephone');
      check('4d. rien à la corbeille', corbeilleDe(memoire).entries.length === 0);
      await fermerFenetre(b);

      // -- supprimé sur le téléphone : une session, puis un itinéraire (corbeille de l'ordinateur)
      retirerSession(tel, SESSIONS[0]);
      f = await synchroniser(b, '4e, session supprimée sur le téléphone');
      check('4e. ligne « Supprimé : 1 session supprimée sur le téléphone : elle est dans la corbeille de l\'ordinateur pour 30 jours »', ditLigne(f, 'Supprimé', "1 session supprimée sur le téléphone : elle est dans la corbeille de l'ordinateur pour 30 jours"), JSON.stringify(f?.lignes));
      await b.wait(1500);
      memesSessions('4e', memoire, tel, TOUTES.filter((s) => s !== SESSIONS[0]));
      let cb = corbeilleDe(memoire);
      check('4e. la corbeille tient la session (une entrée « session », origine « ordinateur », GPX octet pour octet)', cb.entries.length === 1 && cb.entries[0].kind === 'session' && cb.entries[0].origin === 'ordinateur' && cb.entries[0].main === nomFichier(SESSIONS[0]) && readFileSync(join(cb.dir, cb.entries[0].dir, cb.entries[0].main)).equals(readFileSync(MODELES.get(nomFichier(SESSIONS[0])).gpx)), JSON.stringify(cb.entries));
      await fermerFenetre(b);
      retirerItineraire(tel, COMMUNS[1]);
      f = await synchroniser(b, '4f, itinéraire supprimé sur le téléphone');
      check('4f. ligne « Supprimé : 1 itinéraire supprimé sur le téléphone : il est dans la corbeille de l\'ordinateur pour 30 jours » (son nom)', ditLigne(f, 'Supprimé', "1 itinéraire supprimé sur le téléphone : il est dans la corbeille de l'ordinateur pour 30 jours") && ligneDe(f, 'Supprimé')?.noms.join() === COMMUNS[1], JSON.stringify(f?.lignes));
      await b.wait(1500);
      memesItineraires('4f', memoire, tel, [COMMUNS[0], COMMUNS[2], COMMUNS[3], 'Itin telephone', 'Itin ordinateur']);
      cb = corbeilleDe(memoire);
      check('4f. la corbeille tient aussi l\'itinéraire (deux entrées en tout, l\'autre d\'origine « ordinateur »)', cb.entries.length === 2 && cb.entries.some((e) => e.kind === 'itineraire' && e.origin === 'ordinateur' && e.routeBase === COMMUNS[1]), JSON.stringify(cb.entries.map((e) => [e.kind, e.origin, e.routeBase ?? e.main])));
      await fermerFenetre(b);

      // -- supprimé sur l'ordinateur : une session par la page Sessions, puis un itinéraire retiré par Node
      const avantSuppression = gpxsDe(memoire);
      await supprimerPremiereLigne(b, '4g');
      await b.waitFor(() => gpxsDe(memoire).length === avantSuppression.length - 1 && corbeilleDe(memoire).entries.length === 3, { timeout: 10000, label: 'session mise à la corbeille' });
      await b.wait(800);
      const partie = avantSuppression.find((n) => !gpxsDe(memoire).includes(n));
      console.log(`  supprimée sur l'ordinateur : ${partie}`);
      check('4g. avant la synchronisation, le téléphone porte encore la session supprimée sur l\'ordinateur', existsSync(join(tel, 'sessions', partie)));
      // Une seule suppression sur trois sessions dépasse le quart : le garde-fou demande avant de retirer du téléphone.
      f = await synchroniser(b, '4g, session supprimée sur l\'ordinateur');
      await capturerPage(b, 'sansfil-4-question');
      check('4g. le garde-fou pose sa question : « Une suppression à confirmer », « Depuis la dernière synchronisation : », ligne « Sur l\'ordinateur : 1 session supprimée » (son nom), rien n\'est retiré du téléphone', f?.titre === 'Une suppression à confirmer' && (f?.phrases ?? []).includes('Depuis la dernière synchronisation :') && ditLigne(f, "Sur l'ordinateur", '1 session supprimée') && ligneDe(f, "Sur l'ordinateur")?.noms.length === 1 && existsSync(join(tel, 'sessions', partie)), JSON.stringify([f?.titre, f?.phrases, f?.lignes]));
      check('4g. la question : « Faut-il la supprimer aussi de l\'autre appareil ? Rien n\'est perdu : tout reste 30 jours dans la corbeille de l\'ordinateur. », deux réponses « Tout garder » et « Supprimer des deux côtés » (ni « Annuler », ni « Les laisser », ni « sans rien supprimer »)', (f?.phrases ?? []).includes("Faut-il la supprimer aussi de l'autre appareil ? Rien n'est perdu : tout reste 30 jours dans la corbeille de l'ordinateur.") && JSON.stringify(f?.boutons) === JSON.stringify(['Tout garder', 'Supprimer des deux côtés']), JSON.stringify([f?.phrases, f?.boutons]));
      check('4g. sous les réponses : « Tout garder » remet chaque session là où elle manque, fermer ne décide rien', (f?.aides ?? []).some((l) => /^« Tout garder » remet chaque session là où elle manque\./.test(l) && /Fermer la fenêtre ne décide rien/.test(l)), JSON.stringify(f?.aides));
      check('4g. clic « Supprimer des deux côtés »', (await b.clickText('Supprimer des deux côtés', '.phone-sync__actions button')) === 'ok');
      await b.wait(200);
      f = await attendreIssue(b, '4g, après « Supprimer des deux côtés »');
      check('4g. ligne « Supprimé : 1 session supprimée sur l\'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l\'ordinateur »', ditLigne(f, 'Supprimé', "1 session supprimée sur l'ordinateur, retirée du téléphone : elle reste 30 jours dans la corbeille de l'ordinateur"), JSON.stringify(f?.lignes));
      await b.wait(1500);
      check('4g. le téléphone n\'a plus ni le GPX ni la fiche de la session', !existsSync(join(tel, 'sessions', partie)) && !existsSync(join(tel, 'sessions', partie.replace(/\.gpx$/, '.json'))));
      memesSessions('4g', memoire, tel, TOUTES.filter((s) => s !== SESSIONS[0] && nomFichier(s) !== partie));
      check('4g. la corbeille garde ses trois entrées, toutes d\'origine « ordinateur » (elle tenait déjà la session : pas de copie « telephone »)', corbeilleDe(memoire).entries.length === 3 && corbeilleDe(memoire).entries.every((e) => e.origin === 'ordinateur'), JSON.stringify(corbeilleDe(memoire).entries.map((e) => [e.kind, e.origin])));
      await fermerFenetre(b);
      retirerItineraire(memoire, 'Itin ordinateur');
      const octetsTel = readFileSync(join(tel, 'itineraires', 'Itin ordinateur.gpx'));
      f = await synchroniser(b, '4h, itinéraire supprimé sur l\'ordinateur');
      check('4h. ligne « Supprimé : 1 itinéraire supprimé sur l\'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l\'ordinateur »', ditLigne(f, 'Supprimé', "1 itinéraire supprimé sur l'ordinateur, retiré du téléphone : il reste 30 jours dans la corbeille de l'ordinateur"), JSON.stringify(f?.lignes));
      await b.wait(1500);
      memesItineraires('4h', memoire, tel, [COMMUNS[0], COMMUNS[2], COMMUNS[3], 'Itin telephone']);
      cb = corbeilleDe(memoire);
      const e4h = cb.entries.find((e) => e.routeBase === 'Itin ordinateur');
      check('4h. l\'ordinateur l\'avait retiré sans corbeille : la copie du téléphone est rangée à part avant son retrait (origine « telephone », GPX octet pour octet)', cb.entries.length === 4 && e4h?.origin === 'telephone' && existsSync(join(cb.dir, e4h.dir, 'Itin ordinateur.gpx')) && readFileSync(join(cb.dir, e4h.dir, 'Itin ordinateur.gpx')).equals(octetsTel), JSON.stringify(cb.entries.map((e) => [e.kind, e.origin, e.routeBase ?? e.main])));
      check('4h. les lieux et le GPX seul du téléphone sont toujours intacts', empreinte(tel, (c) => c === `itineraires/${ORPHELIN}`) === orphelinAvant);
      check('4h. toujours une seule copie de sécurité, aucun provisoire', copiesDe(profil).length === 1 && temporaires(tel).length === 0 && temporaires(memoire).length === 0);
      await fermerFenetre(b);

      // -- « Tout garder » : la session supprimée sur l'ordinateur revient de la corbeille et reste sur le téléphone
      const avantGarder = gpxsDe(memoire);
      await supprimerPremiereLigne(b, '4i');
      await b.waitFor(() => gpxsDe(memoire).length === avantGarder.length - 1, { timeout: 10000, label: 'session mise à la corbeille' });
      await b.wait(800);
      const gardee = avantGarder.find((n) => !gpxsDe(memoire).includes(n));
      check('4i. avant la synchronisation, le téléphone porte encore la session supprimée sur l\'ordinateur', existsSync(join(tel, 'sessions', gardee)));
      f = await synchroniser(b, '4i, session supprimée sur l\'ordinateur');
      check('4i. le garde-fou pose sa question (« Une suppression à confirmer », « Sur l\'ordinateur : 1 session supprimée »)', f?.titre === 'Une suppression à confirmer' && ditLigne(f, "Sur l'ordinateur", '1 session supprimée'), JSON.stringify([f?.titre, f?.lignes]));
      check('4i. clic « Tout garder »', (await b.clickText('Tout garder', '.phone-sync__actions button')) === 'ok');
      await b.wait(200);
      f = await attendreIssue(b, '4i, après « Tout garder »');
      check('4i. la réponse règle la question : « Gardé : 1 session gardée : remise là où elle manquait », sans « Supprimé »', ditLigne(f, 'Gardé', '1 session gardée : remise là où elle manquait') && ligneDe(f, 'Supprimé') === undefined && f?.titre === 'Synchronisation terminée', JSON.stringify([f?.titre, f?.lignes]));
      await b.wait(1500);
      check('4i. la session est revenue sur l\'ordinateur (sortie de la corbeille) et reste sur le téléphone', gpxsDe(memoire).includes(gardee) && existsSync(join(tel, 'sessions', gardee)), gpxsDe(memoire).join(','));
      memesSessions('4i', memoire, tel, TOUTES.filter((s) => s !== SESSIONS[0] && nomFichier(s) !== partie));
      await fermerFenetre(b);
      liaison.fermer();
    });
  }

  // ---------- 5. téléphone à jour : coupure en pleine écriture ----------
  console.log('\n== 5. Téléphone à jour : liaison coupée en pleine écriture vers le téléphone, puis « Réessayer »');
  if (veut('5')) {
    const profil = dossier('p5-profil');
    const memoire = fabriquerMemoirePc('p5-memoire', [QUATRIEME]);
    const tel = fabriquerTelephoneAJour('p5-tel', [SESSIONS[0], SESSIONS[1]]);
    for (const n of ['Itin alpha', 'Itin bravo']) { poserIti(tel, n); poserIti(memoire, n); }
    const TOUTES = [SESSIONS[0], SESSIONS[1], SESSIONS[2], QUATRIEME];
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1' }, '5', async (b) => {
      const faux = new FauxTelephone({ dossier: tel, delaiMs: 15000 });
      const { ad, liaison } = await relier(b, faux);
      // Une première synchronisation sans coupure : les deux côtés se rejoignent.
      let { compte: f } = await synchroniserPremiere(b, '5a, première synchronisation');
      check('5a. « Première synchronisation : rien n\'a été supprimé. », « Reçu du téléphone : 2 sessions » et « Envoyé au téléphone : 1 session »', contientPhrase(f, "Première synchronisation : rien n'a été supprimé.") && ditLigne(f, 'Reçu du téléphone', '2 sessions') && ditLigne(f, 'Envoyé au téléphone', '1 session'), JSON.stringify([f?.phrases, f?.lignes]));
      await b.wait(2000);
      memesSessions('5a', memoire, tel, [SESSIONS[0], SESSIONS[1], QUATRIEME]);
      await fermerFenetre(b);
      liaison.fermer();
      await attendreLiaisonFinie(b);

      // L'ordinateur reçoit la grosse session et une nouvelle version d'un itinéraire : deux écritures vers le téléphone, dont un remplacement.
      poserSession(memoire, SESSIONS[2]);
      poserIti(memoire, 'Itin alpha', { note: 'v2-ordinateur', maj: '2026-09-10T10:00:00.000Z', jour: 20 });
      const avant = new Map();
      for (const c of arbre(tel) ?? []) if (!c.endsWith('/')) avant.set(c, readFileSync(join(tel, c)));
      /** Chaque fichier du téléphone est entier : son état d'avant, ou ce que l'ordinateur y envoie ; jamais un morceau. */
      const entiers = (quoi) => {
        const mauvais = [];
        for (const c of arbre(tel) ?? []) {
          if (c.endsWith('/')) continue;
          const octets = readFileSync(join(tel, c));
          const pc = existsSync(join(memoire, c)) ? readFileSync(join(memoire, c)) : null;
          const ancien = avant.get(c) ?? null;
          // Le marqueur du téléphone prend un passage neuf à chaque synchronisation : entier, il se lit comme un marqueur.
          if (c === 'gtracker.json') { try { if (JSON.parse(octets.toString('utf8').replace(/^﻿/, '')).format === FORMATS.memoire) continue; } catch { /* pas un marqueur entier */ } mauvais.push(c); continue; }
          if (!((ancien && octets.equals(ancien)) || (pc && octets.equals(pc)))) mauvais.push(c);
        }
        check(`${quoi} : chaque fichier du téléphone est entier (son état d'avant ou la version de l'ordinateur)`, mauvais.length === 0, mauvais.join(','));
        check(`${quoi} : aucun provisoire (.gtracker-new, .gtracker-tmp) sur le téléphone ni sur l'ordinateur`, temporaires(tel).length === 0 && temporaires(memoire).length === 0, `${temporaires(tel)} ${temporaires(memoire)}`);
        // La fiche part avant le GPX : une session n'est montrée que quand son GPX est là, donc avec sa fiche.
        check(`${quoi} : tout GPX de session du téléphone a sa fiche (une session visible est entière)`, gpxsDe(tel).every((g) => fichesDe(tel).includes(g.replace(/\.gpx$/, '.json'))), sessionsDe(tel).join(' | '));
      };

      // -- première coupure : après trois blocs écrits (le marqueur et son passage, la fiche de la grosse session, puis le premier mégaoctet de son GPX)
      const ordre1 = [];
      const coupeur1 = new FauxTelephone({ dossier: tel, memoire: faux.memoire, coupureApresEcritures: 3, delaiMs: 15000, falsifier: (cmd) => { if (cmd.type === 'ecrire') ordre1.push(`${cmd.chemin}@${cmd.debut}`); return undefined; } });
      let lien = await reconnecter(b, coupeur1, ad);
      check('5b. « Synchroniser » : clic', (await b.click('.shell-topactions .phone-sync')) === 'ok');
      // La liaison coupée en route : la fenêtre attend le retour du téléphone (« Annuler » seul), sans « Réessayer ».
      const COUPEE = /^Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route\. Ce qui est fait est gardé\. Elle reprend toute seule dès qu'il revient/;
      const attenteCoupee = (f) => f.titre === 'En attente de votre téléphone' && !f.barre && f.phrases.some((l) => COUPEE.test(l));
      f = await attendreFenetre(b, attenteCoupee, '5b, attente après la coupure', 40000);
      console.log(`  blocs reçus par le téléphone : ${ordre1.join(' ; ')}`);
      check('5b. la fenêtre attend le retour du téléphone : « Le téléphone n\'est plus relié : la synchronisation s\'est arrêtée en route… » avec « Annuler » seul', attenteCoupee(f ?? { titre: '', barre: true, phrases: [] }) && JSON.stringify(f?.boutons) === JSON.stringify(['Annuler']) && !ANCIENNES.test(f?.tout ?? ''), JSON.stringify(f));
      check('5b. la coupure est tombée au milieu de la grosse session (trois blocs écrits : marqueur, fiche, premier bloc du GPX ; le quatrième refusé)', coupeur1.blocsEcrits === 3 && ordre1.length === 4 && ordre1[0] === 'gtracker.json@0' && ordre1[3] === `sessions/${nomFichier(SESSIONS[2])}@${1024 * 1024}`, `${coupeur1.blocsEcrits} bloc(s) écrit(s) ; ${ordre1.join(' ; ')}`);
      check('5b. la grosse session n\'est pas sur le téléphone (ni entière, ni à moitié) : seul son provisoire a existé, il est effacé', !existsSync(join(tel, 'sessions', nomFichier(SESSIONS[2]))), sessionsDe(tel).join(' | '));
      await b.wait(2000);
      entiers('5b');
      await attendreLiaisonFinie(b);

      // -- seconde coupure : à l'écriture d'un itinéraire qui existe déjà sur le téléphone (son original doit rester)
      const ordre2 = [];
      let coupe = null;
      let lien2 = null;
      const coupeur2 = new FauxTelephone({ dossier: tel, memoire: faux.memoire, delaiMs: 15000, falsifier: (cmd) => {
        if (cmd.type === 'ecrire') ordre2.push(`${cmd.chemin}@${cmd.debut}`);
        if (cmd.type === 'ecrire' && cmd.debut === 0 && coupe === null && cmd.chemin.startsWith('itineraires/') && existsSync(join(tel, ...cmd.chemin.split('/')))) { coupe = cmd.chemin; lien2?.fermer(); }
        return undefined;
      } });
      const avantCoupe2 = new Map();
      for (const c of arbre(tel) ?? []) if (!c.endsWith('/')) avantCoupe2.set(c, readFileSync(join(tel, c)));
      // Le téléphone revient : la fenêtre, qui attendait, repart seule (rien à cliquer) et la coupure retombe.
      const retour2 = await tenter(() => coupeur2.connecter(ad.hote, ad.port));
      lien2 = retour2.liaison;
      check('5c. le téléphone se représente par son jeton', Boolean(lien2), JSON.stringify(retour2));
      await b.waitFor(() => coupe !== null, { timeout: 40000, label: 'la reprise écrit jusqu\'à l\'itinéraire existant' });
      f = await attendreFenetre(b, attenteCoupee, '5c, de nouveau en attente après la coupure', 40000);
      console.log(`  blocs reçus : ${ordre2.join(' ; ')} ; coupée sur : ${coupe}`);
      check('5c. la coupure est tombée à l\'écriture d\'un itinéraire qui existait sur le téléphone', coupe !== null, ordre2.join(' ; '));
      check('5c. la fenêtre attend de nouveau, « Annuler » seul, sans que rien n\'ait été cliqué', attenteCoupee(f ?? { titre: '', barre: true, phrases: [] }) && JSON.stringify(f?.boutons) === JSON.stringify(['Annuler']), JSON.stringify(f));
      await b.wait(2000);
      entiers('5c');
      if (coupe !== null) check(`5c. l'original de « ${coupe} » est intact (mêmes octets qu'avant la coupure)`, existsSync(join(tel, ...coupe.split('/'))) && readFileSync(join(tel, ...coupe.split('/'))).equals(avantCoupe2.get(coupe)), coupe);
      await attendreLiaisonFinie(b);

      // -- reprise sans coupure : « Réessayer » finit
      const fin = new FauxTelephone({ dossier: tel, memoire: faux.memoire, delaiMs: 15000 });
      const retourFin = await tenter(() => fin.connecter(ad.hote, ad.port));
      const lienFin = retourFin.liaison;
      check('5d. le téléphone se représente par son jeton', Boolean(lienFin), JSON.stringify(retourFin));
      f = await attendreIssue(b, '5d, reprise seule');
      check('5d. la reprise finit seule : titre « Synchronisation terminée », la coupure n\'est plus dite, « Fermer » seul', f?.titre === 'Synchronisation terminée' && !(f?.phrases ?? []).some((l) => COUPEE.test(l)) && !/n'est plus relié|Synchronisation arrêtée/.test(f?.tout ?? '') && JSON.stringify(f?.boutons) === JSON.stringify(['Fermer']), JSON.stringify(f));
      check('5d. le compte rendu garde tout ce qui s\'est fait en trois passes : « Envoyé au téléphone : 1 session » (la grosse session) et « Modifié : 1 itinéraire, recopié sur l\'autre appareil » (la nouvelle version)', ditLigne(f, 'Envoyé au téléphone', '1 session') && ditLigne(f, 'Modifié', "1 itinéraire, recopié sur l'autre appareil"), JSON.stringify(f?.lignes));
      await b.wait(2500);
      memesSessions('5d', memoire, tel, TOUTES);
      memesItineraires('5d', memoire, tel, ['Itin alpha', 'Itin bravo']);
      check('5d. la nouvelle version de l\'itinéraire est sur le téléphone (v2-ordinateur) et la grosse session aussi, entière', lireJson(join(tel, 'itineraires', 'Itin alpha.json'))?.noteBanc === 'v2-ordinateur' && statSync(join(tel, 'sessions', nomFichier(SESSIONS[2]))).size > 2 * 1024 * 1024);
      check('5d. rien à la corbeille, une seule copie de sécurité', corbeilleDe(memoire).entries.length === 0 && copiesDe(profil).length === 1, `${corbeilleDe(memoire).entries.length} / ${copiesDe(profil).join(',')}`);
      await fermerFenetre(b);
      lienFin?.fermer();
      lien?.fermer();
    });
  }

  // ---------- 6. téléphone à jour qui enregistre ----------
  console.log('\n== 6. Téléphone à jour qui enregistre une session : rien n\'est écrit sur lui');
  if (veut('6')) {
    const profil = dossier('p6-profil');
    const memoire = fabriquerMemoirePc('p6-memoire', [QUATRIEME]);
    const tel = fabriquerTelephoneAJour('p6-tel', [SESSIONS[0], SESSIONS[1]]);
    poserIti(tel, 'Itin telephone');
    poserIti(memoire, 'Itin ordinateur');
    const avantTel = empreinte(tel);
    const PHRASE_ENREGISTRE = 'Le téléphone enregistre une session : rien ne lui a été envoyé. Ce qui lui manque partira à la prochaine synchronisation.';
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1' }, '6', async (b) => {
      const faux = new FauxTelephone({ dossier: tel, enregistre: true, delaiMs: 15000 });
      const { liaison } = await relier(b, faux);
      let f = await synchroniser(b, '6a, le téléphone enregistre');
      check(`6a. l'exception dit : « ${PHRASE_ENREGISTRE} »`, contientPhrase(f, PHRASE_ENREGISTRE), JSON.stringify(f?.phrases));
      check('6a. ce que l\'ordinateur reçoit est dit : « Reçu du téléphone : 2 sessions, 1 itinéraire », sans écran de départ ni « Première synchronisation »', ditLigne(f, 'Reçu du téléphone', '2 sessions, 1 itinéraire') && !(f?.vues ?? []).some((l) => /Première synchronisation|Commencer/.test(l)), JSON.stringify([f?.lignes, f?.phrases]));
      check('6a. aucune ligne « Envoyé au téléphone » (rien ne lui a été envoyé)', ligneDe(f, 'Envoyé au téléphone') === undefined, JSON.stringify(f?.lignes));
      await b.wait(2000);
      check('6a. le téléphone n\'a pas été modifié (fichiers, tailles et dates), ni identifiant, ni écriture, aucun provisoire', empreinte(tel) === avantTel && !('id' in (marqueurDe(tel) ?? {})) && temporaires(tel).length === 0, `\n--- avant ---\n${avantTel}\n--- après ---\n${empreinte(tel)}`);
      check('6a. aucune écriture n\'est arrivée au téléphone (aucun bloc écrit)', faux.blocsEcrits === 0, String(faux.blocsEcrits));
      check('6a. rien n\'est allé à la corbeille', corbeilleDe(memoire).entries.length === 0);
      console.log(`  côté ordinateur : sessions ${gpxsDe(memoire).length}, itinéraires ${itinerairesDe(memoire).join(', ')}, copies de sécurité ${copiesDe(profil).length}`);
      await fermerFenetre(b);

      // -- l'enregistrement fini : la synchronisation suivante écrit
      faux.enregistre = false;
      ({ compte: f } = await synchroniserPremiere(b, '6b, l\'enregistrement est fini'));
      check('6b. plus de phrase d\'enregistrement', !contientPhrase(f, PHRASE_ENREGISTRE), JSON.stringify(f?.phrases));
      check('6b. le téléphone a été écrit : « Première synchronisation : rien n\'a été supprimé. » et « Envoyé au téléphone : 1 session, 1 itinéraire »', contientPhrase(f, "Première synchronisation : rien n'a été supprimé.") && ditLigne(f, 'Envoyé au téléphone', '1 session, 1 itinéraire'), JSON.stringify([f?.phrases, f?.lignes]));
      await b.wait(2500);
      memesSessions('6b', memoire, tel, [SESSIONS[0], SESSIONS[1], QUATRIEME]);
      memesItineraires('6b', memoire, tel, ['Itin telephone', 'Itin ordinateur']);
      check('6b. identifiant posé sur le téléphone', typeof marqueurDe(tel)?.id === 'string', JSON.stringify(marqueurDe(tel)));
      await fermerFenetre(b);
      liaison.fermer();
    });
  }

  // ---------- 7. pare-feu de Windows ----------
  console.log('\n== 7. Pare-feu de Windows vu et autorisé par le programme (pare-feu et autorisation factices, jamais powershell)');
  if (veut('7')) {
    const BLOQUE = 'Windows ne laisse pas passer votre téléphone sur ce réseau.';
    const ADMIN = "Un réglage de l'administrateur de cet ordinateur empêche de l'autoriser ici.";
    const REFUS = "Windows n'a pas donné l'autorisation : le téléphone ne pourra pas se présenter sur ce réseau.";
    const sansPowershell = (quoi, p) => check(`${quoi} : aucun powershell lancé (journal de la coquille)`, !p.journal.some((l) => /powershell/i.test(l)), p.journal.join(' | '));
    const autorisations = (p) => p.journal.filter((l) => /autorisation d'essai/.test(l));
    const ecoute = (b) => b.waitFor(`/Gtracker attend votre téléphone/.test(document.querySelector('.wireless-card__status')?.textContent ?? '')`, { timeout: 8000, label: 'écoute' });
    const messageVu = (b) => b.waitFor(`Boolean(document.querySelector('.wireless-card__firewall'))`, { timeout: 8000, label: 'message du pare-feu' });
    const messageParti = (b) => b.waitFor(`!document.querySelector('.wireless-card__firewall')`, { timeout: 8000, label: 'message du pare-feu disparu' });
    /** Un programme, sans-fil allumé dès le lancement, bloc ouvert et en écoute. */
    const cas = async (nom, env, quoi, essai) => avecProgramme(dossier(`${nom}-profil`), dossier(`${nom}-memoire`), { GTRACKER_BANC_SANSFIL_ACTIF: '1', ...env }, quoi, async (b, p) => { await ouvrirMemoire(b); await ecoute(b); await essai(b, p); });

    // 7a. par défaut : rien, et jamais de demande
    await cas('p7a', {}, '7a', async (b, p) => {
      await b.settle({ max: 1500 });
      const c = await carte(b);
      check('7a. par défaut (pare-feu d\'essai ouvert) : ni message, ni bouton « Autoriser Gtracker »', c.pareFeu === null && c.autoriser === null, JSON.stringify(c.pareFeu));
      check('7a. la coquille dit « pare-feu ouvert, autorisation accordee » dans son journal d\'essai', p.journal.some((l) => /sans-fil d'essai : .*, pare-feu ouvert, autorisation accordee$/.test(l)), p.journal.join(' | '));
      check('7a. aucune demande d\'autorisation', autorisations(p).length === 0, autorisations(p).join(' | '));
      sansPowershell('7a', p);
    });

    // 7b. bloqué, autorisation accordée : message et bouton ; le clic les fait disparaître
    await cas('p7b', { GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque' }, '7b', async (b, p) => {
      await messageVu(b);
      let c = await carte(b);
      console.log(`  bloc, pare-feu bloqué : ${JSON.stringify(c.texte)}`);
      check('7b. la phrase dit que Windows ne laisse pas passer le téléphone', c.pareFeuPhrases[0] === BLOQUE, JSON.stringify(c.pareFeuPhrases));
      check('7b. le bouton « Autoriser Gtracker » est offert, avec la phrase « Windows va demander de confirmer. L\'autorisation vaut aussi sur les réseaux publics… »', c.autoriser === 'Autoriser Gtracker' && c.pareFeu.includes(ALLUMAGE), JSON.stringify(c.pareFeu));
      check('7b. le bloc écoute toujours (état « attend votre téléphone »)', /Gtracker attend votre téléphone/.test(c.statut ?? ''), c.statut);
      check('7b. aucune demande avant le clic', autorisations(p).length === 0, autorisations(p).join(' | '));
      await capturer(b, 'sansfil-7-pare-feu-bloque');
      check('7b. clic « Autoriser Gtracker »', (await b.click('.wireless-card__authorize')) === 'ok');
      await messageParti(b);
      await b.waitFor(() => autorisations(p).length > 0, { timeout: 5000, label: 'journal de l\'autorisation' });
      c = await carte(b);
      check('7b. accordée : le message et le bouton ont disparu, rien d\'autre ne s\'affiche', c.pareFeu === null && c.autoriser === null && c.erreur === null, JSON.stringify({ pareFeu: c.pareFeu, erreur: c.erreur }));
      check('7b. le journal dit « autorisation d\'essai : accordee » (une seule demande)', autorisations(p).length === 1 && autorisations(p)[0].includes("autorisation d'essai : accordee"), autorisations(p).join(' | '));
      check('7b. « Relier un téléphone » reste offert', c.boutons.includes('Relier un téléphone'), c.boutons.join('/'));
      await b.wait(1500);
      check('7b. après une relecture, toujours rien (le pare-feu relu est ouvert)', (await carte(b)).pareFeu === null);
      sansPowershell('7b', p);
    });

    // 7c. bloqué, autorisation refusée : phrase de refus, bouton gardé
    await cas('p7c', { GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque', GTRACKER_BANC_SANSFIL_AUTORISATION: 'refusee' }, '7c', async (b, p) => {
      await messageVu(b);
      check('7c. clic « Autoriser Gtracker »', (await b.click('.wireless-card__authorize')) === 'ok');
      await b.waitFor(`/Windows n'a pas donné l'autorisation/.test(document.querySelector('.wireless-card__firewall')?.textContent ?? '')`, { timeout: 8000, label: 'phrase de refus' });
      const c = await carte(b);
      console.log(`  après refus : ${JSON.stringify(c.pareFeuPhrases)} ; boutons ${c.boutons.join(' / ')}`);
      check('7c. la phrase du blocage est toujours là, suivie de la phrase de refus', c.pareFeuPhrases[0] === BLOQUE && c.pareFeuPhrases.includes(REFUS), JSON.stringify(c.pareFeuPhrases));
      check('7c. le bouton « Autoriser Gtracker » est gardé', c.autoriser === 'Autoriser Gtracker', String(c.autoriser));
      check('7c. le journal dit « autorisation d\'essai : refusee »', autorisations(p).length === 1 && autorisations(p)[0].includes("autorisation d'essai : refusee"), autorisations(p).join(' | '));
      await capturer(b, 'sansfil-7-pare-feu-refuse');
      sansPowershell('7c', p);
    });

    // 7d. bloqué, autorisation en échec : la raison est dite, bouton gardé
    await cas('p7d', { GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque', GTRACKER_BANC_SANSFIL_AUTORISATION: 'echec' }, '7d', async (b, p) => {
      await messageVu(b);
      check('7d. clic « Autoriser Gtracker »', (await b.click('.wireless-card__authorize')) === 'ok');
      await b.waitFor(`/L'autorisation n'a pas pu être ajoutée/.test(document.querySelector('.wireless-card__firewall')?.textContent ?? '')`, { timeout: 8000, label: 'phrase d\'échec' });
      const c = await carte(b);
      console.log(`  après échec : ${JSON.stringify(c.pareFeuPhrases)}`);
      check('7d. la phrase d\'échec porte la raison', c.pareFeuPhrases.includes("L'autorisation n'a pas pu être ajoutée : échec de l'autorisation d'essai."), JSON.stringify(c.pareFeuPhrases));
      check('7d. le bouton « Autoriser Gtracker » est gardé', c.autoriser === 'Autoriser Gtracker', String(c.autoriser));
      sansPowershell('7d', p);
    });

    // 7e. non réparable : la phrase et celle de l'administrateur, sans bouton
    await cas('p7e', { GTRACKER_BANC_SANSFIL_PAREFEU: 'irreparable' }, '7e', async (b, p) => {
      await messageVu(b);
      const c = await carte(b);
      console.log(`  pare-feu non réparable : ${JSON.stringify(c.pareFeuPhrases)} ; boutons ${c.boutons.join(' / ')}`);
      check('7e. la phrase du blocage est suivie de celle de l\'administrateur', c.pareFeuPhrases[0] === `${BLOQUE} ${ADMIN}`, JSON.stringify(c.pareFeuPhrases));
      check('7e. aucun bouton « Autoriser Gtracker » ni mention de confirmation', c.autoriser === null && !c.boutons.includes('Autoriser Gtracker') && !/Windows va demander de confirmer/.test(c.texte), c.boutons.join('/'));
      check('7e. aucune demande d\'autorisation', autorisations(p).length === 0, autorisations(p).join(' | '));
      await capturer(b, 'sansfil-7-pare-feu-irreparable');
      sansPowershell('7e', p);
    });

    // 7f. allumé depuis la page, sans règle : la phrase d'allumage, la demande part, puis rien ne s'affiche
    await avecProgramme(dossier('p7f-profil'), dossier('p7f-memoire'), { GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque' }, '7f', async (b, p) => {
      await ouvrirMemoire(b);
      let c = await carte(b);
      check('7f. éteint : la phrase d\'allumage est « Windows va demander de confirmer. L\'autorisation vaut aussi sur les réseaux publics… »', c.texte.includes(ALLUMAGE) && c.coche === false, c.texte);
      check('7f. éteint : ni message de pare-feu, ni demande', c.pareFeu === null && autorisations(p).length === 0, autorisations(p).join(' | '));
      check('7f. clic sur la case « Recevoir les sessions du téléphone sans câble »', (await b.click('.wireless-card__toggle')) === 'ok');
      await ecoute(b);
      await b.waitFor(() => autorisations(p).length > 0, { timeout: 5000, label: 'journal de l\'autorisation' });
      await b.settle({ max: 1500 });
      c = await carte(b);
      check('7f. la demande est partie à l\'allumage (journal « autorisation d\'essai : accordee »)', autorisations(p).length === 1 && autorisations(p)[0].includes("autorisation d'essai : accordee"), autorisations(p).join(' | '));
      const iDemande = p.journal.findIndex((l) => /autorisation d'essai/.test(l));
      const iEcoute = p.journal.findIndex((l) => /sans-fil à l'écoute/.test(l));
      check('7f. la demande part avant la mise à l\'écoute (ordre du journal de la coquille)', iDemande >= 0 && iEcoute > iDemande, `${iDemande} / ${iEcoute} : ${p.journal.join(' | ')}`);
      check('7f. accordée : allumé et à l\'écoute, sans message de pare-feu ni bouton', c.coche === true && c.pareFeu === null && c.autoriser === null && c.erreur === null, JSON.stringify({ coche: c.coche, pareFeu: c.pareFeu, erreur: c.erreur }));
      check('7f. allumé : la phrase d\'allumage a disparu', !c.texte.includes(ALLUMAGE), c.texte);
      sansPowershell('7f', p);
    });

    // 7g. page en anglais : l'erreur de la coquille (écrite en français, détail de l'autorisation d'essai en échec) sort traduite
    await avecProgramme(dossier('p7g-profil'), dossier('p7g-memoire'), { GTRACKER_BANC_SANSFIL_ACTIF: '1', GTRACKER_BANC_SANSFIL_PAREFEU: 'bloque', GTRACKER_BANC_SANSFIL_AUTORISATION: 'echec', BANC_LANGUE_PAGE: 'en-GB' }, '7g', async (b, p) => {
      await b.go('/parametres', 5000);
      await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Connection')`, { timeout: 8000, label: 'bloc Connection' });
      if (!(await b.evaluate(`Boolean(document.querySelector('.wireless-card'))`))) await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Connection')`);
      await messageVu(b);
      let c = await carte(b);
      check('7g. page en anglais : la phrase du blocage est traduite', c.pareFeuPhrases[0] === 'Windows is not letting your phone through on this network.', JSON.stringify(c.pareFeuPhrases));
      check('7g. le bouton s\'appelle « Allow Gtracker »', c.autoriser === 'Allow Gtracker', String(c.autoriser));
      check('7g. clic « Allow Gtracker » (autorisation d\'essai, jamais celle de Windows)', (await b.click('.wireless-card__authorize')) === 'ok');
      await b.waitFor(`/could not be added/.test(document.querySelector('.wireless-card__firewall')?.textContent ?? '')`, { timeout: 8000, label: 'phrase d\'échec en anglais' });
      c = await carte(b);
      console.log(`  après échec, en anglais : ${JSON.stringify(c.pareFeuPhrases)}`);
      check('7g. l\'erreur de la coquille sort traduite, sans le français d\'origine', c.pareFeuPhrases.includes('The permission could not be added: trial authorization failed.') && !/échec/.test(c.pareFeu ?? ''), JSON.stringify(c.pareFeuPhrases));
      sansPowershell('7g', p);
    });
  }

  // ---------- 8. aucun téléphone relié, départ annoncé, attente, départ seul, journal ----------
  console.log('\n== 8. Aucun téléphone relié, « Relier mon téléphone », nom relié, départ annoncé, attente puis départ seul à l\'arrivée, journal du programme');
  if (veut('8')) {
    const profil = dossier('p8-profil');
    const memoire = fabriquerMemoirePc('p8-memoire', [QUATRIEME]);
    const tel = fabriquerTelephoneAJour('p8-tel', [SESSIONS[0]]);
    // L'outil du câble est imposé « introuvable » : la fenêtre ne doit jamais en parler comme d'une chose à faire.
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1', GTRACKER_BANC_TELEPHONE_ETAT: 'adbIntrouvable' }, '8', async (b, p) => {
      const VERBOTEN = /câble|[dD]ébogage|Google|Platform-Tools|adb\b|adbIntrouvable|Aucun téléphone ne se présente|ne répond pas/;
      await b.go('/sessions', 5000);
      await b.settle({ max: 1500 });
      check('8a. avant tout : aucun téléphone relié, la barre ne dit rien à côté du bouton « Synchroniser »', (await relie(b)) === null);
      check('8a. « Synchroniser » : clic', (await b.click('.shell-topactions .phone-sync')) === 'ok');
      let f = await attendreFenetre(b, (x) => x.titre === 'Aucun téléphone relié', '8a, aucun téléphone relié', 20000);
      console.log(`  aucun téléphone relié : ${JSON.stringify(f?.phrases)} ; boutons ${(f?.boutons ?? []).join(' / ')}`);
      check('8a. « Aucun téléphone relié » : « Cet ordinateur ne connaît encore aucun téléphone. Cela se fait une fois, en tapant un code sur le téléphone. »', (f?.phrases ?? []).includes('Cet ordinateur ne connaît encore aucun téléphone. Cela se fait une fois, en tapant un code sur le téléphone.'), JSON.stringify(f?.phrases));
      check('8a. boutons « Fermer » et « Relier mon téléphone » (pas de « Réessayer »)', JSON.stringify(f?.boutons) === JSON.stringify(['Fermer', 'Relier mon téléphone']), JSON.stringify(f?.boutons));
      check('8a. ni câble, ni débogage USB, ni outil de Google, ni « adbIntrouvable » (l\'outil du câble est pourtant imposé introuvable), ni ancienne phrase', !VERBOTEN.test(f?.tout ?? '') && !ANCIENNES.test(f?.tout ?? ''), f?.tout);
      await capturerPage(b, 'sansfil-8-aucun-telephone-relie');
      check('8a. clic « Relier mon téléphone »', (await b.clickText('Relier mon téléphone', '.phone-sync__actions button')) === 'ok');
      await b.waitFor(`/^\\d{6}$/.test(document.querySelector('.wireless-card__code')?.textContent.trim() ?? '')`, { timeout: 15000, label: 'fenêtre du code ouverte d\'elle-même' });
      const href = await b.evaluate('location.pathname + location.search + location.hash');
      check('8a. la fenêtre se ferme, Réglages › Connexion s\'ouvre et la fenêtre du code est ouverte d\'elle-même (adresse et code)', (await fenetre(b)) === null && /parametres/.test(href) && /relier/.test(href), href);
      let c = await carte(b);
      console.log(`  Réglages › Connexion : adresse ${c.adresse}, code ${c.code}, câble : ${JSON.stringify(c.cable?.resume)}`);
      check('8a. le paragraphe « Par câble (avancé) » est là, replié ; l\'outil de Google n\'est dit que dedans (l\'outil est imposé introuvable)', c.cable !== null && c.cable.resume === 'Par câble (avancé)' && c.cable.ouvert === false && /Platform-Tools/.test(c.cable.texte) && !/Platform-Tools|Débogage USB/.test(c.texte), JSON.stringify(c.cable));
      await capturer(b, 'sansfil-8-carte-par-cable-avance');
      await b.evaluate(`document.querySelector('details.wireless-card__cable').open = true`);
      await capturer(b, 'sansfil-8-carte-par-cable-avance-ouvert');
      await b.evaluate(`document.querySelector('details.wireless-card__cable').open = false`);

      // -- relier : la barre dit « nom relié »
      const ad = adresseDe(c);
      const faux = new FauxTelephone({ dossier: tel, delaiMs: 15000 });
      const r = await tenter(() => faux.appairer(ad.hote, ad.port, c.code));
      check('8b. le téléphone à jour s\'appaire avec le code lu sur la page', Boolean(r.liaison), JSON.stringify(r));
      const lie = await attendreRelie(b, 'nom relié dans la barre');
      check(`8b. la barre du haut dit « ${LIGNE_RELIE} », rien d'autre (aucune ligne d'arrivée, rien ne se lance)`, lie === LIGNE_RELIE && (await b.evaluate(`document.querySelector('.phone-sync__arrival') === null && document.querySelector('[role=dialog].phone-sync__dialog') === null`)), lie);
      await b.evaluate(`window.scrollTo(0, 0)`);
      await capturerPage(b, 'sansfil-8-nom-relie');

      // -- le téléphone s'en va : la page le sait sans relevé
      const t0 = Date.now();
      r.liaison.fermer();
      await attendreNonRelie(b, 'départ annoncé à la barre');
      const delai = Date.now() - t0;
      console.log(`  départ annoncé à la barre en ${delai} ms`);
      check('8c. le départ est annoncé : la barre ne dit plus « relié », en moins de 4 s (un avis du programme, pas un relevé)', delai < 4000, `${delai} ms`);
      check('8c. le journal de la coquille dit « téléphone parti (raison) »', p.journal.some((l) => /téléphone parti \((ferme|coupure|silence|retire|eteint)\)/.test(l)), p.journal.filter((l) => /parti/.test(l)).join(' | '));

      // -- « Synchroniser » sans téléphone là : la fenêtre attend, avec ce qu'il faut faire sur le téléphone
      check('8d. « Synchroniser » : clic', (await b.click('.shell-topactions .phone-sync')) === 'ok');
      f = await attendreFenetre(b, (x) => x.titre === 'En attente de votre téléphone' && !x.barre && x.sousTitre !== null, '8d, attente du téléphone', 20000);
      console.log(`  attente : ${JSON.stringify(f?.sousTitre)} ${JSON.stringify(f?.phrases)} ; étapes ${JSON.stringify(f?.etapes)} ; boutons ${(f?.boutons ?? []).join(' / ')}`);
      check('8d. sous-titre : « Téléphone d\'essai · relié pour la dernière fois à <heure> »', new RegExp(`^${NOM_FAUX} · relié pour la dernière fois (à \\d+ h \\d\\d|hier|le )`).test(f?.sousTitre ?? ''), f?.sousTitre);
      check('8d. « Sur le téléphone : », les trois choses à faire (écran allumé et déverrouillé, Gtracker affiché, même réseau), puis « La synchronisation démarre toute seule dès qu\'il est là. »', (f?.phrases ?? []).includes('Sur le téléphone :') && JSON.stringify(f?.etapes) === JSON.stringify(["allumez l'écran et déverrouillez-le ;", 'affichez Gtracker ;', 'restez sur le même réseau que cet ordinateur (la même box Wi-Fi, ou un partage de connexion entre les deux).']) && (f?.phrases ?? []).includes("La synchronisation démarre toute seule dès qu'il est là."), JSON.stringify([f?.phrases, f?.etapes]));
      check('8d. seul bouton « Annuler » ; ni câble, ni débogage USB, ni outil de Google, ni « adbIntrouvable », ni « Aucun téléphone ne se présente », ni « ne répond pas »', JSON.stringify(f?.boutons) === JSON.stringify(['Annuler']) && !VERBOTEN.test(f?.tout ?? '') && !ANCIENNES.test(f?.tout ?? ''), f?.tout);
      check('8d. à côté du bouton, aucun « relié » tant que le téléphone n\'est pas là', (await relie(b)) === null);
      await capturerPage(b, 'sansfil-8-attente');
      await b.wait(4500);
      const f2 = await fenetre(b);
      check('8d. plus d\'un relevé plus tard, la fenêtre attend toujours, le même titre et le même bouton (elle n\'abandonne pas)', f2?.titre === 'En attente de votre téléphone' && JSON.stringify(f2?.boutons) === JSON.stringify(['Annuler']) && !VERBOTEN.test(f2?.tout ?? ''), JSON.stringify([f2?.titre, f2?.boutons]));

      // -- le téléphone revient : la synchronisation part seule, jusqu'à l'écran de départ de la première fois
      const faux2 = new FauxTelephone({ dossier: tel, memoire: faux.memoire, delaiMs: 15000 });
      const retour = await tenter(() => faux2.connecter(ad.hote, ad.port));
      check('8e. le téléphone revient par son jeton', Boolean(retour.liaison), JSON.stringify(retour));
      const depart = await attendreFenetre(b, (x) => x.boutons.includes('Commencer'), '8e, la fenêtre part seule jusqu\'à l\'écran de départ', 30000);
      check(`8e. sans rien cliquer, la fenêtre est passée à « Première synchronisation avec « ${NOM_FAUX} » » (« Choisir un autre dossier », « Commencer »)`, depart?.titre === `Première synchronisation avec « ${NOM_FAUX} »` && JSON.stringify(depart?.boutons) === JSON.stringify(['Choisir un autre dossier', 'Commencer']), JSON.stringify([depart?.titre, depart?.boutons]));
      check(`8e. la barre redit « ${LIGNE_RELIE} »`, (await relie(b)) === LIGNE_RELIE);
      check('8e. « Commencer »', (await b.clickText('Commencer', '.phone-sync__actions button')) === 'ok');
      await b.wait(200);
      f = await attendreIssue(b, '8e, après « Commencer »');
      check('8e. compte rendu : « Reçu du téléphone : 1 session » et « Envoyé au téléphone : 1 session »', f?.titre === 'Synchronisation terminée' && ditLigne(f, 'Reçu du téléphone', '1 session') && ditLigne(f, 'Envoyé au téléphone', '1 session'), JSON.stringify([f?.titre, f?.lignes]));
      await b.wait(2500);
      memesSessions('8e', memoire, tel, [SESSIONS[0], QUATRIEME]);
      check('8e. « Ouvrir le dossier » : la coquille en prend note (rien ne s\'ouvre en essai)', (await b.clickText('Ouvrir le dossier', '.phone-sync__body button')) === 'ok');
      await b.waitFor(() => p.journal.some((l) => /ouverture d'un dossier des copies de sécurité/.test(l)), { timeout: 5000, label: 'ouverture du dossier des copies' });
      await fermerFenetre(b);

      // -- le journal du programme
      const chemin = join(profil, 'journal.txt');
      check('8f. « journal.txt » est écrit dans le profil du programme', existsSync(chemin), chemin);
      const lignes = existsSync(chemin) ? readFileSync(chemin, 'utf8').split(/\r?\n/).filter((l) => l !== '') : [];
      console.log(`  journal.txt : ${lignes.length} lignes ; la première : ${lignes[0]} ; la dernière : ${lignes[lignes.length - 1]}`);
      check('8f. une ligne par événement, datée « AAAA-MM-JJ HH:MM:SS.mmm … »', lignes.length >= 15 && lignes.every((l) => /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3} \S/.test(l)), `${lignes.length} lignes : ${lignes.filter((l) => !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3} \S/.test(l)).slice(0, 3).join(' | ')}`);
      const dans = (motif) => lignes.some((l) => motif.test(l));
      check('8f. l\'arrivée du téléphone appairé, son départ, puis son retour par jeton sont au journal', dans(/ téléphone arrivé, appairé$/) && dans(/ téléphone parti \((ferme|coupure|silence|retire|eteint)\)/) && dans(/ téléphone arrivé$/), lignes.filter((l) => /téléphone (arrivé|parti)/.test(l)).join(' | '));
      check('8f. les étapes de la page y sont, préfixées « page : » (attente, reprise, écran de départ, copie de sécurité, compte rendu)', dans(/ page : Synchroniser : attente \(téléphone absent\)$/) && dans(/ page : Synchroniser : fin de l'attente, reprise$/) && dans(/ page : Synchroniser : écran de départ de la première synchronisation$/) && dans(/ page : Synchroniser : copie de sécurité$/) && dans(/ page : Synchroniser : compte rendu$/), lignes.filter((l) => /page :/.test(l)).join(' | '));
      // « téléphone d'essai : aucun… » est une ligne du mode d'essai (en minuscule) : seul le nom du téléphone, avec sa majuscule, est un nom.
      const perso = lignes.filter((l) => /[A-Za-z]:[\\/]|\\\\|gtk-sf-|https?:|file:/i.test(l) || l.includes(NOM_FAUX) || l.toLowerCase().includes(tmpdir().toLowerCase()) || l.toLowerCase().includes(RACINE.toLowerCase()));
      check('8f. aucun nom (le téléphone d\'essai), aucun chemin du disque, aucune adresse web dans le journal', perso.length === 0, perso.join(' | '));
      const adresses = lignes.filter((l) => /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(l));
      console.log(`  (relevé) lignes du journal qui portent une adresse réseau : ${adresses.length}${adresses.length ? ` : ${adresses.slice(0, 2).join(' | ')}` : ''}`);
      check('8f. la page ne note au journal aucun nom de session ni de téléphone (étapes seulement)', !lignes.some((l) => / page : .*(Wingfoil|wingfoil|\.gpx|Itin )/.test(l)), lignes.filter((l) => /page :/.test(l)).join(' | '));
      retour.liaison?.fermer?.();
    });
  }

  // ---------- 9. liaison coupée quatre fois de suite ----------
  console.log('\n== 9. Liaison coupée quatre fois de suite : trois reprises seules, puis l\'arrêt dit, avec « Recommencer »');
  if (veut('9')) {
    const profil = dossier('p9-profil');
    const memoire = dossier('p9-memoire');
    const tel = fabriquerTelephone('p9-tel');
    const avantTel = empreinte(tel);
    await avecProgramme(profil, memoire, { GTRACKER_BANC_SANSFIL_ACTIF: '1' }, '9', async (b) => {
      // Chaque téléphone coupe dès son second bloc envoyé : aucune session n'arrive jamais entière.
      const coupeur = (memoireFaux) => new FauxTelephone({ ancien: true, dossier: tel, coupureApresBlocs: 1, delaiMs: 15000, ...(memoireFaux ? { memoire: memoireFaux } : {}) });
      const premier = coupeur(null);
      const { ad } = await relier(b, premier);
      check('9a. « Synchroniser » : clic', (await b.click('.shell-topactions .phone-sync')) === 'ok');
      const attente = (x) => x.titre === 'En attente de votre téléphone' && !x.barre && x.phrases.some((l) => /^Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route/.test(l));
      let f = await attendreFenetre(b, attente, '9a, première coupure', 40000);
      check('9a. première coupure : la fenêtre attend (« Annuler » seul)', Boolean(f) && attente(f) && JSON.stringify(f.boutons) === JSON.stringify(['Annuler']), JSON.stringify(f));
      for (let k = 2; k <= 3; k++) {
        const suivant = coupeur(premier.memoire);
        const lien = await tenter(() => suivant.connecter(ad.hote, ad.port));
        check(`9b. coupure ${k - 1} : le téléphone revient par son jeton`, Boolean(lien.liaison), JSON.stringify(lien));
        await Promise.race([lien.liaison?.fermee, pause(30000)]);
        f = await attendreFenetre(b, attente, `9b, coupure ${k}`, 40000);
        check(`9b. coupure ${k} : la reprise s'est faite seule puis la fenêtre attend de nouveau (« Annuler » seul)`, Boolean(f) && attente(f) && JSON.stringify(f.boutons) === JSON.stringify(['Annuler']), JSON.stringify(f));
      }
      // La quatrième coupure dépasse les trois reprises seules : l'arrêt se dit, avec « Recommencer ».
      const dernier = coupeur(premier.memoire);
      const lien4 = await tenter(() => dernier.connecter(ad.hote, ad.port));
      check('9c. quatrième liaison : le téléphone revient par son jeton', Boolean(lien4.liaison), JSON.stringify(lien4));
      f = await attendreIssue(b, '9c, après la quatrième coupure', { ancien: true });
      console.log(`  arrêt : ${JSON.stringify(f?.titre)} ${JSON.stringify(f?.phrases)} ; boutons ${(f?.boutons ?? []).join(' / ')}`);
      if ((f?.phrases ?? []).includes("La synchronisation précédente s'était arrêtée en route : elle vient d'être terminée.")) console.log('  (relevé) le compte rendu « Synchronisation arrêtée » commence par « La synchronisation précédente s\'était arrêtée en route : elle vient d\'être terminée. », phrase de la reprise, qui dit « terminée » alors que cette reprise est elle-même arrêtée');
      check('9c. titre « Synchronisation arrêtée » et « Le téléphone n\'est plus relié : la synchronisation s\'est arrêtée en route. Ce qui est fait est gardé. »', f?.titre === 'Synchronisation arrêtée' && (f?.phrases ?? []).includes("Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé."), JSON.stringify([f?.titre, f?.phrases]));
      check('9c. boutons « Recommencer » puis « Fermer » (jamais « Réessayer »)', JSON.stringify(f?.boutons) === JSON.stringify(['Recommencer', 'Fermer']), JSON.stringify(f?.boutons));
      check('9c. rien n\'est rangé à moitié : aucun temporaire, autant de fiches que de GPX, le téléphone intact', temporaires(memoire).length === 0 && fichesDe(memoire).length === gpxsDe(memoire).length && empreinte(tel) === avantTel, `${gpxsDe(memoire).length} GPX, ${fichesDe(memoire).length} fiches`);

      // -- « Recommencer » : le téléphone est parti, la fenêtre attend ; un téléphone qui ne coupe pas finit le travail
      check('9d. « Recommencer »', (await b.clickText('Recommencer', '.phone-sync__actions button')) === 'ok');
      f = await attendreFenetre(b, (x) => x.titre === 'En attente de votre téléphone' && !x.barre, '9d, attente après « Recommencer »', 30000);
      check('9d. la fenêtre attend le téléphone (« Annuler » seul)', Boolean(f) && JSON.stringify(f.boutons) === JSON.stringify(['Annuler']), JSON.stringify(f));
      const complet = new FauxTelephone({ ancien: true, dossier: tel, memoire: premier.memoire, delaiMs: 15000 });
      const fin = await tenter(() => complet.connecter(ad.hote, ad.port));
      check('9d. un téléphone qui ne coupe pas revient par son jeton', Boolean(fin.liaison), JSON.stringify(fin));
      f = await attendreIssue(b, '9d, reprise complète', { ancien: true });
      check('9d. le compte rendu est « Synchronisation terminée », « Reçu du téléphone : 3 sessions », « Fermer » seul', f?.titre === 'Synchronisation terminée' && ditLigne(f, 'Reçu du téléphone', '3 sessions') && JSON.stringify(f?.boutons) === JSON.stringify(['Fermer']), JSON.stringify([f?.titre, f?.lignes, f?.boutons]));
      await b.wait(2500);
      verifierRangees('9d', memoire, tel, SESSIONS);
      telephoneIntact('9d', tel, avantTel);
      fin.liaison?.fermer?.();
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
