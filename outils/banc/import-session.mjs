// Banc de la porte d'import (lot 330, brief 319 point 9) : les sessions de voile et de surf de l'ancienne application
// entrent par des fichiers, et seulement par eux.
// Usage : node import-session.mjs <port> [<dossier des captures>]
// Les octets viennent du jeu d'essai figé `src/test/legacyImport.fixture.ts` (ce que l'ancienne application écrit pour une
// session de wingfoil et une de surf : GPX, fiche, capteurs, GPX complet), lu par le crochet `charge-ts.mjs` : rien n'est
// recopié ici, et les noms de l'ancienne application ne sont jamais écrits dans `outils/`. Les noms d'aujourd'hui
// (formats, espace de noms) et le marqueur de l'ancien dossier viennent de `src/core/appIdentity.ts` et de
// `src/library/legacyImport.ts`. Profil Chrome neuf, sans réseau. Le script éprouve :
//  a. le paquet de voile et le paquet de surf (GPX complet portant fiche, capteurs et retouches), importés ensemble :
//     chaque session entre au bon calcul, avec nom, notes, repères, sauts et capteurs, fiche et capteurs au format d'aujourd'hui ;
//  b. les trois autres formes d'entrée, chacune sur une mémoire vide : GPX + fiche .json + capteurs .imu côte à côte
//     (« Ajouter les sessions d'un dossier »), puis GPX seul à `<type>` reconnu (calcul reconnu, ni nom ni notes) ;
//  c. un autre sport (fiche, GPX seul) : refusé, la phrase le dit, rien n'est rangé ;
//  d. une fiche de l'ancien format posée directement dans sessions/ : relue en lecture seule, jamais réécrite ;
//  e. une fiche de l'ancienne application d'une version plus récente (trace seule rangée), un paquet d'aujourd'hui à fiche
//     plus récente (fiche rangée au caractère près, lecture seule), un paquet d'un autre espace de noms (GPX seul) ;
//  f. le dossier mémoire de l'ancienne application choisi comme mémoire : refusé, la mémoire en service reste en place
//     (dans le navigateur par `showDirectoryPicker`, dans le programme Windows par la fenêtre du système, qui répond par
//     `GTRACKER_BANC_DOSSIER`).
import './charge-ts.mjs';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { lignes } from './lib/sessions.mjs';

const { APP_NAME, FILE_FORMATS, XML } = await import('../../src/core/appIdentity.ts');
const { LEGACY_BUNDLE, LEGACY_MARKER_FILE } = await import('../../src/library/legacyImport.ts');
const {
  LEGACY_SURF_BUNDLE, LEGACY_SURF_GPX, LEGACY_SURF_RECORD, LEGACY_WING_BUNDLE, LEGACY_WING_GPX, LEGACY_WING_IMU, LEGACY_WING_RECORD,
} = await import('../../src/test/legacyImport.fixture.ts');

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node import-session.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Le jeu d'essai, tel que le code d'origine l'a écrit ---
const SESSIONS = {
  wing: { sport: 'wingfoil', famille: 'voile', gpx: LEGACY_WING_GPX, record: LEGACY_WING_RECORD, bundle: LEGACY_WING_BUNDLE, imuBase64: LEGACY_WING_IMU, ligne: 'Wingfoil' },
  surf: { sport: 'surf', famille: 'surf', gpx: LEGACY_SURF_GPX, record: LEGACY_SURF_RECORD, bundle: LEGACY_SURF_BUNDLE, imuBase64: null, ligne: 'Surf' },
};
for (const s of Object.values(SESSIONS)) {
  const fiche = JSON.parse(s.record);
  s.fiche = fiche;
  s.startMs = fiche.summary.startMs;
}
/** Texte XML d'un texte brut (la fiche d'un paquet vit dans un élément). */
const xmlText = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Un sport que l'application ne range pas (donnée de l'ancienne application). */
const AUTRE_SPORT = 'running';

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, records, shoot, check, finish, logs, clickText } = await connect({ port, width: 1400, height: 1000, shotDir });
// Rangée « avancé » des analyses ouverte d'office (`lib/onglets.mjs`).
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();
// Le choix d'un dossier : la fenêtre du système n'existe pas ici, la fonction rend le dossier `dossier-autre` de la mémoire du navigateur.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('dossier-autre', { create: true });`,
});
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const opfs = (corps) => evaluate(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}', { create: true }); ${corps} })()`);
/** Noms des fichiers de sessions/ avec leur taille. */
const sessionsDir = async () => JSON.parse(await opfs(`
  const out = {};
  try { const d = await root.getDirectoryHandle('sessions'); for await (const [n, h] of d.entries()) out[n] = (await h.getFile()).size; } catch { /* dossier pas encore créé */ }
  return JSON.stringify(out);`));
const lireTexte = (nom) => opfs(`const d = await root.getDirectoryHandle('sessions'); return await (await (await d.getFileHandle(${JSON.stringify(nom)})).getFile()).text();`);
const lireDebut = (nom, n) => opfs(`const d = await root.getDirectoryHandle('sessions'); const buf = await (await (await d.getFileHandle(${JSON.stringify(nom)})).getFile()).slice(0, ${n}).arrayBuffer(); return [...new Uint8Array(buf)].map((b) => String.fromCharCode(b)).join('');`);
const poserSessions = (fichiers) => opfs(`
  const d = await root.getDirectoryHandle('sessions', { create: true });
  for (const [nom, texte] of ${JSON.stringify(Object.entries(fichiers))}) { const w = await (await d.getFileHandle(nom, { create: true })).createWritable(); await w.write(texte); await w.close(); }
  return 'ok';`);
/** Vide sessions/ et le cache de la liste, puis recharge la page Sessions : une mémoire vide. */
const viderMemoire = async () => {
  await opfs(`try { const d = await root.getDirectoryHandle('sessions'); for await (const [n] of d.entries()) await d.removeEntry(n); } catch { /* rien à vider */ } return 'ok';`);
  await evaluate(`localStorage.removeItem('${CLES.libraryCache}')`);
  await go('/sessions', 4000);
  await waitFor(async () => (await records()).length === 0, { timeout: 4000, label: 'mémoire vide' });
};
/**
 * Pose des fichiers dans le champ de fichiers `selector` : `texte` (GPX, fiche) ou `base64` (capteurs). Le champ n'est
 * monté qu une fois la mémoire relue (OPFS), ce que `settle` ne voit pas.
 */
const importer = async (fichiers, selector = 'input[type=file][accept*=".gpx"]') => {
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, { timeout: 4000, every: 50, label: 'champ de fichier' });
  return evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return 'absent';
    const dt = new DataTransfer();
    for (const f of ${JSON.stringify(fichiers)}) {
      const contenu = f.base64 ? Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)) : f.texte;
      dt.items.add(new File([contenu], f.nom, { type: f.nom.endsWith('.gpx') ? 'application/gpx+xml' : 'application/octet-stream' }));
    }
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  })()`);
};
/** Phrase du compte rendu de l'import, une fois affichée. */
const phrase = async () => {
  await waitFor(`/ajoutée|déjà présente|laissée de côté|illisible/.test(document.body.innerText)`, { timeout: 8000, label: 'compte rendu' });
  await settle({ max: 2000, label: 'import' });
  const ligne = await evaluate(`document.body.innerText.split('\\n').find((l) => /ajoutée|déjà présente|laissée de côté|illisible/.test(l)) ?? '(aucune phrase)'`);
  return ligne.replace(/ FERMER$/, '');
};
/** Attend `n` fiches (ou plus) dans la mémoire, puis leur réécriture différée. */
const fiches = async (n) => {
  await waitFor(async () => (await records()).length >= n, { timeout: 6000, label: `${n} fiche(s)` });
  await settle({ max: 1500, label: 'fiches' });
  return records();
};
const rows = () => lignes(evaluate);
/** Avertissements des lignes de la page Sessions (une session en lecture seule dit pourquoi). */
const warnings = () => evaluate(`[...document.querySelectorAll('.lib-row__warning')].map((w) => w.textContent.trim()).join(' | ') || '(aucun)'`);
const editable = () => evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Renommer')`);
const ficheDe = async (sport) => (await records()).find((r) => r.sport === sport) ?? null;

// =====================================================================================================================
// a. Les deux paquets, ensemble
// =====================================================================================================================
console.log('\n== a. Paquet de voile et paquet de surf');
await go('/sessions', 5000);
console.log('import :', await importer([
  { nom: 'voile-paquet.gpx', texte: SESSIONS.wing.bundle },
  { nom: 'surf-paquet.gpx', texte: SESSIONS.surf.bundle },
]));
const phraseA = await phrase();
console.log(phraseA);
check('deux sessions ajoutées, aucune refusée', /^2 sessions ajoutées\./.test(phraseA), phraseA);
const faits = await fiches(2);
console.log('fiches :', faits.map((r) => `${r.sport}/${r.name}`).sort().join(' | '));
for (const [clef, s] of Object.entries(SESSIONS)) {
  const r = faits.find((x) => x.sport === s.sport);
  const voulue = s.fiche;
  check(`${clef} : entrée au calcul ${s.sport}, à la fiche d'aujourd'hui (${FILE_FORMATS.session})`, Boolean(r) && r.format === FILE_FORMATS.session && r.activityId === voulue.activityId,
    JSON.stringify({ format: r?.format, activityId: r?.activityId }));
  check(`${clef} : nom, commentaire et deux repères de l'ancienne fiche`, r?.name === voulue.name && r?.notes?.comment === voulue.notes?.comment
    && JSON.stringify(r?.marks) === JSON.stringify(voulue.marks) && r.marks.length === 2, JSON.stringify({ name: r?.name, comment: r?.notes?.comment, marks: r?.marks?.length }));
  // Les champs de l'analyse que l'application d'aujourd'hui lit sont repris tels quels (ceux qu'elle ne lit plus sont
  // retirés à l'entrée) ; un champ qu'elle a ajouté depuis, absent de l'ancienne fiche, entre vide.
  const analyseReprise = r?.analysis && Object.entries(r.analysis).every(([k, v]) => (k in voulue.analysis ? JSON.stringify(v) === JSON.stringify(voulue.analysis[k]) : v === null));
  check(`${clef} : réglages d'analyse et résumé repris tels quels`, Boolean(analyseReprise) && Object.keys(r.analysis).length >= 5
    && r?.summary?.startMs === s.startMs && r?.summary?.pointCount === voulue.summary.pointCount, JSON.stringify(r?.analysis));
}
const wing = await ficheDe('wingfoil');
check('voile : les sauts de la fiche sont là', wing?.jumps?.jumps?.length === SESSIONS.wing.fiche.jumps.jumps.length && wing.jumps.jumps.length > 0, JSON.stringify(wing?.jumps?.jumps?.length));
const arbre = await sessionsDir();
const imuWing = Object.keys(arbre).find((n) => n.endsWith('.imu'));
check('voile : les capteurs sont rangés (.imu), un seul fichier de capteurs pour les deux sessions', Boolean(imuWing) && Object.keys(arbre).filter((n) => n.endsWith('.imu')).length === 1, Object.keys(arbre).join(', '));
const enteteImu = imuWing ? await lireDebut(imuWing, 400) : '';
check('capteurs : l\'en-tête est celui d\'aujourd\'hui, plus celui de l\'ancienne application', enteteImu.includes(FILE_FORMATS.capteurs) && !/"format":"(?!gtracker)[a-z]+-capteurs"/.test(enteteImu), enteteImu.slice(0, 120));
const gpxRange = Object.keys(arbre).find((n) => n.endsWith('_wingfoil.gpx'));
check('voile : le GPX rangé est celui de la trace, sans le paquet', gpxRange !== undefined && (await lireTexte(gpxRange)) === SESSIONS.wing.gpx);
const lignesA = await rows();
console.log('lignes voile :', JSON.stringify(lignesA));
check('la page Sessions montre la session de wingfoil sous son nom', lignesA.length === 1 && lignesA[0].includes(SESSIONS.wing.fiche.name), JSON.stringify(lignesA));
// Le jeu d'essai du surf est sur foil : « Surf foil » est une activité cachée au départ, la liste le dit et ne la montre pas.
check('la session de surf est rangée sur une activité cachée : la liste le dit, sans la montrer', !lignesA.some((l) => l.includes(SESSIONS.surf.fiche.name))
  && /Activités cachées : 1 session en moins dans la liste/.test(await evaluate('document.body.innerText')), JSON.stringify(lignesA));
const surfRange = await ficheDe('surf');
// Une adresse s'ouvre toujours : le filtre de l'activité cachée montre sa session.
await go(`/sessions?activite=${encodeURIComponent(surfRange.activityId)}`, 4000);
await waitFor(async () => (await rows()).length >= 1, { timeout: 5000, label: 'ligne' });
const lignesCachee = await rows();
check('?activite= d\'une activité cachée : sa session est montrée', lignesCachee.length === 1 && lignesCachee[0].includes(SESSIONS.surf.fiche.name), JSON.stringify(lignesCachee));
await go(`/surf/analyse?session=${encodeURIComponent(surfRange.gpx)}`, 6000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 1000, label: 'analyse du surf' });
check('analyse du surf : son nom en tête, modifiable', (await evaluate('document.body.innerText')).includes(SESSIONS.surf.fiche.name) && (await editable()));
// Son analyse s'ouvre, la fiche y est lue (nom, avertissement absent), la session est modifiable.
await go(`/voile/analyse?session=${encodeURIComponent(wing.gpx)}`, 6000);
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'matos et conditions')`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 1000, label: 'analyse' });
check('analyse du wingfoil : son nom en tête, modifiable', (await evaluate('document.body.innerText')).includes(SESSIONS.wing.fiche.name) && (await editable()));
await shoot('import-session-analyse');

// =====================================================================================================================
// b. Les autres formes d'entrée, chacune sur une mémoire vide
// =====================================================================================================================
console.log('\n== b. GPX + fiche + capteurs côte à côte, puis GPX seul');
for (const [clef, s] of Object.entries(SESSIONS)) {
  await viderMemoire();
  const cote = [{ nom: `${clef}.gpx`, texte: s.gpx }, { nom: `${clef}.json`, texte: s.record }];
  if (s.imuBase64) cote.push({ nom: `${clef}.imu`, base64: s.imuBase64 });
  console.log(`${clef} côte à côte :`, await importer(cote, 'input[type=file][webkitdirectory]'));
  const p = await phrase();
  console.log(p);
  const r = (await fiches(1))[0];
  check(`${clef}, côte à côte : ajoutée, au calcul ${s.sport}, avec nom, notes et repères`, /^1 session ajoutée\./.test(p) && r.sport === s.sport && r.name === s.fiche.name
    && r.notes?.comment === s.fiche.notes?.comment && r.marks?.length === 2, `${p} | ${r.sport} | ${r.name}`);
  const dossier = await sessionsDir();
  check(`${clef}, côte à côte : ${s.imuBase64 ? 'capteurs rangés au format d\'aujourd\'hui' : 'aucun capteur inventé'}`,
    s.imuBase64 ? Object.keys(dossier).some((n) => n.endsWith('.imu')) : !Object.keys(dossier).some((n) => n.endsWith('.imu')), Object.keys(dossier).join(', '));

  await viderMemoire();
  console.log(`${clef} GPX seul :`, await importer([{ nom: `${clef}-seul.gpx`, texte: s.gpx }]));
  const q = await phrase();
  const g = (await fiches(1))[0];
  check(`${clef}, GPX seul : calcul reconnu par <type>, ni nom ni notes ni repères`, /^1 session ajoutée\./.test(q) && g.sport === s.sport && !g.name && !g.notes?.comment && !(g.marks?.length),
    `${q} | ${g.sport} | ${g.name}`);
  check(`${clef}, GPX seul : la trace entière est lue`, g.summary?.startMs === s.startMs && g.summary?.pointCount === s.fiche.summary.pointCount, `${g.summary?.startMs} ; ${g.summary?.pointCount}`);
}

// =====================================================================================================================
// c. Un autre sport est refusé
// =====================================================================================================================
console.log('\n== c. Une fiche ou un GPX d\'un autre sport');
await viderMemoire();
const autreFiche = JSON.stringify({ ...SESSIONS.wing.fiche, sport: AUTRE_SPORT });
console.log('GPX + fiche :', await importer([{ nom: 'autre.gpx', texte: SESSIONS.wing.gpx }, { nom: 'autre.json', texte: autreFiche }]));
const phraseC1 = await phrase();
console.log(phraseC1);
check('GPX + fiche d\'un autre sport : laissés de côté, la phrase dit ce que Gtracker range', phraseC1 === `1 session de course, de vélo ou d'entraînement laissée de côté : ${APP_NAME} ne range que les sessions avec ou sans vent.`, phraseC1);
await wait(500);
check('… rien n\'est rangé', (await records()).length === 0 && Object.keys(await sessionsDir()).length === 0);
await go('/sessions', 4000);
console.log('GPX seul de cet autre sport :', await importer([{ nom: 'autre-seul.gpx', texte: SESSIONS.wing.gpx.replace('<type>wingfoil</type>', `<type>${AUTRE_SPORT}</type>`) }]));
const phraseC2 = await phrase();
console.log(phraseC2);
check('GPX seul d\'un autre sport : laissé de côté de même', /laissée de côté/.test(phraseC2) && (await records()).length === 0, phraseC2);

// =====================================================================================================================
// d. Une fiche de l'ancien format posée directement dans sessions/
// =====================================================================================================================
console.log('\n== d. Fiche de l\'ancien format dans sessions/ : lecture seule, jamais réécrite');
await viderMemoire();
const NOM_D = '2026-06-01_12-00-00_wingfoil';
console.log('posée :', await poserSessions({ [`${NOM_D}.gpx`]: SESSIONS.wing.gpx, [`${NOM_D}.json`]: SESSIONS.wing.record }));
await go('/parametres', 4000);
await waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('Mettre à jour'))`, { timeout: 5000, label: 'carte Mémoire' });
console.log('Mettre à jour :', await clickText('Mettre à jour'));
await waitFor(`/Dossier relu/.test(document.body.innerText)`, { timeout: 6000, label: 'dossier relu' });
await settle({ max: 2000, label: 'relecture' });
console.log(await evaluate(`document.body.innerText.split('\\n').find((l) => /Dossier relu/.test(l)) ?? '(aucune phrase)'`));
await go('/sessions', 4000);
await waitFor(async () => (await rows()).length >= 1, { timeout: 5000, label: 'ligne' });
const avertissementD = await warnings();
console.log('ligne :', JSON.stringify(await rows()), '| avertissement :', avertissementD);
check('la ligne de la page Sessions dit la fiche illisible, laissée telle quelle', /illisible/.test(avertissementD), avertissementD);
await go(`/voile/analyse?session=${encodeURIComponent(`${NOM_D}.gpx`)}`, 6000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 1500, label: 'analyse' });
check('analyse de la session : lue sans rien à renommer (lecture seule)', !(await editable()));
check('la fiche de l\'ancien format est laissée telle quelle sur le disque, à l\'octet', (await lireTexte(`${NOM_D}.json`)) === SESSIONS.wing.record);
await wait(1200);
check('… même après un temps (aucune réécriture différée)', (await lireTexte(`${NOM_D}.json`)) === SESSIONS.wing.record);

// =====================================================================================================================
// e. Version plus récente, paquet d'un autre espace de noms
// =====================================================================================================================
console.log('\n== e. Fiche plus récente, autre espace de noms');
await viderMemoire();
// L'ancienne application, d'une version que le code ne sait pas lire : trace seule rangée.
const plusRecente = JSON.stringify({ ...SESSIONS.wing.fiche, version: 99 });
console.log('GPX + fiche v99 :', await importer([{ nom: 'futur.gpx', texte: SESSIONS.wing.gpx }, { nom: 'futur.json', texte: plusRecente }]));
const phraseE1 = await phrase();
console.log(phraseE1);
const e1 = (await fiches(1))[0];
check('fiche de l\'ancienne application plus récente : la trace seule est rangée, sans nom ni notes, et la phrase le dit',
  /fiche de l'autre application d'une version plus récente ou illisible pour 1 session/.test(phraseE1) && e1.sport === 'wingfoil' && !e1.name && !e1.notes?.comment, `${phraseE1} | ${e1.name}`);

await viderMemoire();
// Un GPX complet d'aujourd'hui dont la fiche est d'une version plus récente : fiche rangée au caractère près, lecture seule.
const futurTexte = `${JSON.stringify({ ...SESSIONS.wing.fiche, format: FILE_FORMATS.session, version: 99, nouveau: { forme: [1, 2] } }, null, 1)}\n`;
const { prefix, ns } = XML.session;
const paquetFutur = SESSIONS.wing.gpx.replace('</gpx>', `<extensions><${prefix}:session xmlns:${prefix}="${ns}" version="1"><${prefix}:record>${xmlText(futurTexte)}</${prefix}:record></${prefix}:session></extensions></gpx>`);
console.log('paquet à fiche v99 :', await importer([{ nom: 'futur-paquet.gpx', texte: paquetFutur }]));
const phraseE2 = await phrase();
console.log(phraseE2);
await fiches(1);
const dossierE = await sessionsDir();
const jsonE = Object.keys(dossierE).find((n) => n.endsWith('.json'));
const gpxE = Object.keys(dossierE).find((n) => n.endsWith('.gpx'));
check('paquet à fiche plus récente : la fiche est rangée au caractère près', jsonE !== undefined && (await lireTexte(jsonE)) === futurTexte, jsonE);
check('… le GPX rangé est celui de la trace, sans le paquet', gpxE !== undefined && (await lireTexte(gpxE)) === SESSIONS.wing.gpx);
await go('/sessions', 4000);
await waitFor(async () => (await rows()).length >= 1, { timeout: 5000, label: 'ligne' });
check('… la ligne de la page Sessions dit la fiche d\'une version plus récente, lue sans être modifiée', /version plus récente/.test(await warnings()), await warnings());
await go(`/voile/analyse?session=${encodeURIComponent(gpxE ?? '')}`, 6000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 1500, label: 'analyse' });
check('… l\'analyse la montre en lecture seule (rien à renommer)', !(await editable()));
await viderMemoire();
// Un paquet dont le bloc est d'un autre espace de noms : le bloc n'est pas à nous (il se reconnaît à son préfixe et à
// son adresse), la trace entre comme un GPX seul, sans la fiche. Le préfixe est déclaré en tête du GPX pour que le
// fichier reste du XML valide.
const autrePrefixe = SESSIONS.wing.bundle.replaceAll(`${LEGACY_BUNDLE.prefix}:`, 'autre:').replace(/xmlns:autre="[^"]+"/, 'xmlns:autre="urn:autre:session"');
check('le jeu d\'essai d\'un autre espace de noms diffère bien du paquet d\'origine', autrePrefixe !== SESSIONS.wing.bundle);
const autreEspace = autrePrefixe.replace('<gpx ', '<gpx xmlns:autre="urn:autre:session" ').replace(/(<autre:session) xmlns:autre="[^"]+"/, '$1');
console.log('paquet d\'un autre espace de noms :', await importer([{ nom: 'autre-espace.gpx', texte: autreEspace }]));
const phraseE3 = await phrase();
console.log(phraseE3);
const e3 = (await fiches(1))[0];
check('autre espace de noms : la trace entre comme un GPX seul, sans la fiche (ni nom ni notes)', /^1 session ajoutée\./.test(phraseE3) && e3.sport === 'wingfoil' && !e3.name && !e3.notes?.comment && !(e3.marks?.length),
  `${phraseE3} | ${e3.name}`);
await viderMemoire();
// Le même, avec un préfixe jamais déclaré (les retouches du paquet sont posées dans la trace sans l'être) : XML mal formé, illisible.
console.log('préfixe non déclaré :', await importer([{ nom: 'autre-prefixe.gpx', texte: autrePrefixe }]));
const phraseE4 = await phrase();
console.log(phraseE4);
check('préfixe non déclaré : fichier illisible, rien n\'est rangé', /^0 session ajoutée, 1 illisible \(autre-prefixe\.gpx\)\.$/.test(phraseE4) && (await records()).length === 0, phraseE4);

// =====================================================================================================================
// f. Le dossier mémoire de l'ancienne application, choisi comme mémoire
// =====================================================================================================================
console.log('\n== f. Dossier de l\'ancienne application choisi comme mémoire');
await viderMemoire();
// Le dossier « choisi » porte le marqueur de l'ancienne application et pas le nôtre. Dans le programme Windows, la fenêtre
// du système répond par `GTRACKER_BANC_DOSSIER` (un dossier du disque retenu d'avance par le lanceur, créé ici) ; dans un
// navigateur, la fonction `showDirectoryPicker` posée plus haut rend `dossier-autre` de sa mémoire.
const programme = (await evaluate('Boolean(window.gtrackerBureau)')) === true;
const dossierChoisi = process.env.GTRACKER_BANC_DOSSIER;
if (programme) {
  if (!dossierChoisi) throw new Error('programme Windows sans GTRACKER_BANC_DOSSIER : la fenêtre de choix ne répondrait pas');
  mkdirSync(dossierChoisi, { recursive: true });
  writeFileSync(join(dossierChoisi, LEGACY_MARKER_FILE), '{}');
  console.log('dossier posé : ok');
} else {
  console.log('dossier posé :', await evaluate(`(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('dossier-autre', { create: true });
    const w = await (await d.getFileHandle(${JSON.stringify(LEGACY_MARKER_FILE)}, { create: true })).createWritable();
    await w.write('{}');
    await w.close();
    return 'ok';
  })()`));
}
// Le bouton est dans la carte Mémoire de Réglages : « Choisir un dossier » sur la mémoire du navigateur, « Changer de
// dossier » sur celle du programme Windows.
await go('/parametres', 4000);
// La carte Mémoire est repliée tant qu'on ne l'ouvre pas.
await waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 6000, label: 'carte Mémoire' });
await evaluate(`(() => { if (![...document.querySelectorAll('button')].some((b) => /^(Choisir un dossier|Changer de dossier)$/.test(b.textContent.trim()))) [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire')?.click(); return 'ok'; })()`);
await waitFor(`[...document.querySelectorAll('button')].some((b) => /^(Choisir un dossier|Changer de dossier)$/.test(b.textContent.trim()))`, { timeout: 6000, label: 'bouton du dossier' });
console.log('choisir :', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Choisir un dossier|Changer de dossier)$/.test(x.textContent.trim())); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await waitFor(`/celui de l'autre application/.test(document.body.innerText)`, { timeout: 5000, label: 'refus' });
const refus = (await evaluate(`document.body.innerText.split('\\n').find((l) => /celui de l'autre application/.test(l)) ?? '(aucune phrase)'`)).replace(/ FERMER$/, '');
console.log(refus);
check('le dossier de l\'ancienne application est refusé, avec la phrase qui renvoie à l\'import d\'un dossier',
  refus === `Ce dossier est celui de l'autre application : ajoutez ses sessions par « Ajouter les sessions d'un dossier ».`, refus);
const contenuRefuse = programme
  ? readdirSync(dossierChoisi).join(',')
  : await evaluate(`(async () => {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('dossier-autre');
    const noms = []; for await (const [n] of d.entries()) noms.push(n);
    return noms.join(',');
  })()`);
check('la mémoire en service reste la même (rien n\'est écrit dans le dossier refusé)', contenuRefuse === LEGACY_MARKER_FILE, contenuRefuse);

console.log('\n--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 15).forEach((l) => console.log(l));
await finish('Tout passe.');
