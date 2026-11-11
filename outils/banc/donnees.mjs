// Banc de test : données sûres (lot A, §10, point 92, remis sur la voile au lot 330).
// Usage : node donnees.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf (mémoire du navigateur), avec le serveur de développement (le script importe `/src/...`).
// Aucun réseau (les tuiles de la carte sont bloquées, les demandes à l'IGN, à Overpass et à BRouter relevées : aucune). Le script fabrique ses GPX (`lib/traces.mjs`, wingfoil). Il vérifie :
//  1. le cache allégé : une session de wingfoil dont la fiche porte ses sauts (champ lourd, pris dans le jeu d'essai de la
//     porte d'import) et un champ inconnu ; après deux lancements, `gtracker.libraryCache` ne les contient plus ; un
//     renommage depuis la bibliothèque les laisse intacts dans la fiche ; l'analyse s'ouvre ;
//  2. le recalcul de fond : 30 fiches au résumé périmé (`calcVersion` 1) ; la dernière, renommée pendant le balayage,
//     garde son nom et reçoit son nouveau résumé ;
//  3. « Mettre à jour » : une session renommée pendant la relecture garde son nom, dans la liste et la fiche ;
//  4. l'import : trois GPX, dont un illisible et un dont la fiche ne peut s'écrire ; le troisième est rangé,
//     l'échec est nommé, et le GPX à moitié rangé est retiré ; importé de nouveau avec des capteurs, il les reçoit ;
//  5. le stockage plein : un réglage refusé reste en place pour la session, et le bandeau le dit.
import './charge-ts.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

// Les sauts d'une fiche (le champ lourd du cache) : ceux du jeu d'essai de la porte d'import, figé, sans rien inventer.
const { LEGACY_WING_RECORD } = await import('../../src/test/legacyImport.fixture.ts');
const SAUTS = JSON.parse(LEGACY_WING_RECORD).jumps;

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node donnees.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Traces ---
/** Sortie de wingfoil en ligne droite vers l'est à 7 m/s, 1 Hz, `count` s à partir de l'instant donné (`traceSurf`, une seule phase). */
const sortieGpx = (name, t0, count = 900) => traceSurf({ debutMs: t0, phases: [[count, 7, 90]], type: 'wingfoil', nom: name });
const T0 = Date.UTC(2026, 9, 5, 8, 0, 0);
const firstPath = join(workDir, 'sortie-sauts.gpx');
writeFileSync(firstPath, traceVoile({ debutMs: T0, nom: 'Sortie avec sauts', bords: 1, secondes: 900, virageMin: 3 }));

// --- Protocole (lib/cdp.mjs) ---
const { send, go, settle, waitFor, wait, blockNetwork, importFiles, shoot, check, finish, logs, onMessage } = await connect({ port, width: 1400, height: 1000, shotDir });
await blockNetwork();
const requests = [];
onMessage((msg) => {
  if (msg.method === 'Network.requestWillBeSent' && /geopf|overpass|brouter/i.test(msg.params.request.url) && !msg.params.request.url.startsWith(BASE)) requests.push(msg.params.request.url.slice(0, 80));
});
/** Évalue dans la page ; une exception rend « ERREUR : … » (et non `undefined`) pour que le relevé la montre. */
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) return `ERREUR : ${res.result.exceptionDetails.exception?.description?.split(String.fromCharCode(10))[0] ?? res.result.exceptionDetails.text}`;
  return res.result?.result?.value;
};
/** Dossier `Gtracker` de la mémoire du navigateur, ou un de ses sous-dossiers. */
const dirJs = (path) => `(async () => {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
  for (const p of ${JSON.stringify(path)}.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(p);
  return dir;
})()`;
const listOpfs = (path) => evaluate(`(async () => { const dir = await ${dirJs(path)}; const names = []; for await (const [n, h] of dir.entries()) names.push(h.kind === 'directory' ? n + '/' : n); return names.sort(); })()`);
const readOpfs = (path, name) => evaluate(`(async () => (await (await (await ${dirJs(path)}).getFileHandle(${JSON.stringify(name)})).getFile()).text())()`);
const writeOpfs = (path, name, text) => evaluate(`(async () => {
  const w = await (await (await ${dirJs(path)}).getFileHandle(${JSON.stringify(name)}, { create: true })).createWritable();
  await w.write(${JSON.stringify(text)}); await w.close(); return 'ok';
})()`);
const alerts = () => evaluate(`[...document.querySelectorAll('.ui-alert')].map((a) => a.textContent.replace(/Fermer$/, '').trim()).join(' || ') || '(aucun bandeau)'`);
const LIB = `await import('/src/hooks/useSessionLibrary.ts')`;
/** Attend la fin du balayage de fond (plus de « Lecture des traces sans fiche »). */
const waitScan = async (maxS = 60) => {
  for (let k = 0; k < maxS * 4; k++) {
    if (!(await evaluate(`/Lecture des traces sans fiche/.test(document.body.innerText)`))) return;
    await wait(250);
  }
};
const fiche = async (gpx) => JSON.parse(await readOpfs('sessions', gpx.replace(/\.gpx$/, '.json')));

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

// 1. Cache allégé.
console.log('— 1. cache allégé');
await go('/voile');
await importFiles([firstPath], 'input[type=file][accept*=".gpx"][multiple]');
// Le dossier n'existe qu'à la première écriture, après le calcul dans le worker (lot 161) : `listOpfs` ne rend pas de liste avant.
await waitFor(async () => { const names = await listOpfs('sessions'); return Array.isArray(names) && names.some((n) => n.endsWith('.json')); }, { timeout: 10000, label: 'fiche' });
await settle({ max: 3000, label: 'import' });
const gpx = (await listOpfs('sessions')).find((n) => n.endsWith('.gpx'));
const base = await fiche(gpx);
const lourde = { ...base, jumps: SAUTS, nouveau: { forme: [1, 2, 3] } };
await writeOpfs('sessions', gpx.replace(/\.gpx$/, '.json'), JSON.stringify(lourde, null, 2));
const ficheSize = JSON.stringify(lourde).length;
await go('/voile');
await waitScan();
await go('/voile');
await waitScan();
const cache = await evaluate(`localStorage.getItem('${CLES.libraryCache}') ?? ''`);
console.log(`fiche : ${ficheSize} car. | cache : ${cache.length} car., allégé : ${cache.includes('"light":true')}, sauts dedans : ${cache.includes('"jumps"')}, champ inconnu dedans : ${cache.includes('"nouveau"')}`);
check('le cache est allégé : ni les sauts ni le champ inconnu', cache.includes('"light":true') && !cache.includes('"jumps"') && !cache.includes('"nouveau"') && cache.length < ficheSize, `${cache.length} car.`);
const partielle = await evaluate(`(async () => (${LIB}).librarySession(${JSON.stringify(gpx)})?.partial === true)()`);
console.log('session partielle :', partielle);
check('la session est tenue en mémoire sans ses champs lourds (partielle)', partielle === true);
console.log('Renommer :', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Renommer'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(300);
await evaluate(`(() => { const i = document.querySelector('.lib-row__rename'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Renommée depuis la liste'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'ok'; })()`);
await waitFor(async () => (await fiche(gpx)).name === 'Renommée depuis la liste', { timeout: 2000, label: 'fiche renommée' });
const renamed = await fiche(gpx);
console.log(`fiche après renommage : nom « ${renamed.name} », sauts ${renamed.jumps?.jumps?.length ?? 'ABSENTS'}, champ inconnu ${renamed.nouveau ? 'gardé' : 'ABSENT'}`);
check('un renommage depuis la bibliothèque laisse les sauts et le champ inconnu intacts dans la fiche',
  renamed.name === 'Renommée depuis la liste' && renamed.jumps?.jumps?.length === SAUTS.jumps.length && JSON.stringify(renamed.nouveau) === JSON.stringify(lourde.nouveau), JSON.stringify([renamed.name, renamed.jumps?.jumps?.length]));
await go('/voile');
await waitScan();
requests.length = 0;
await go(`/voile/analyse?session=${encodeURIComponent(gpx)}`, 5000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 10000, label: 'onglets' });
console.log(`analyse : ouverte | demandes à l'IGN, Overpass ou BRouter : ${requests.length}${requests.length ? ' (' + requests.join(', ') + ')' : ''}`);
check("l'analyse s'ouvre (onglets), sans demande à l'IGN, à Overpass ni à BRouter", requests.length === 0 && (await evaluate(`document.querySelectorAll('.an-carte-col .ui-tab').length`)) > 0, requests.join(', '));
await shoot('donnees-analyse');

// 2. Recalcul de fond pendant une saisie.
console.log('— 2. recalcul de fond');
const STALE = 30;
const staleName = (k) => `banc-recalcul-${String(k).padStart(2, '0')}.gpx`;
for (let k = 0; k < STALE; k++) {
  const t0 = Date.UTC(2026, 8, 1 + k, 7, 0, 0);
  await writeOpfs('sessions', staleName(k), sortieGpx(`Recalcul ${k}`, t0, 3600));
  const { jumps: _a, nouveau: _b, ...plain } = lourde;
  await writeOpfs('sessions', staleName(k).replace(/\.gpx$/, '.json'), JSON.stringify({
    ...plain, gpx: staleName(k), title: `Recalcul ${k}`, name: null,
    summary: { ...base.summary, calcVersion: 1, startMs: t0, endMs: t0 + 3600_000 },
  }, null, 2));
}
const LAST = staleName(STALE - 1);
await send('Page.navigate', { url: `${BASE}/voile` });
let known = false;
for (let k = 0; k < 80 && !known; k++) {
  await wait(100);
  known = await evaluate(`(async () => !!(${LIB}).librarySession(${JSON.stringify(LAST)}))()`) === true;
}
const progress = await evaluate(`(document.body.innerText.match(/Lecture des traces sans fiche : \\d+ \\/ \\d+/) ?? ['(balayage non visible)'])[0]`);
await evaluate(`(async () => { (${LIB}).updateSessionRecord(${JSON.stringify(LAST)}, { name: 'Renommée pendant le balayage' }); return 'ok'; })()`);
console.log(`renommée pendant : ${progress}`);
await waitScan(120);
await waitFor(async () => (await fiche(LAST)).name === 'Renommée pendant le balayage' && (await fiche(LAST)).summary.calcVersion !== 1, { timeout: 1500, label: 'fiche recalculée' });
const last = await fiche(LAST);
const first = await fiche(staleName(0));
console.log(`fiche de la dernière : nom « ${last.name} », calcVersion ${last.summary.calcVersion} | première : calcVersion ${first.summary.calcVersion}`);
const enMemoire = await evaluate(`(async () => (${LIB}).librarySession(${JSON.stringify(LAST)})?.record.name ?? '(sans nom)')()`);
console.log('en mémoire :', enMemoire);
check('la dernière, renommée pendant le balayage, garde son nom et reçoit son nouveau résumé', last.name === 'Renommée pendant le balayage' && last.summary.calcVersion > 1, `${last.name} ; ${last.summary.calcVersion}`);
check('la première, jamais touchée, est refaite aussi', first.summary.calcVersion === last.summary.calcVersion, String(first.summary.calcVersion));
check('en mémoire, la dernière garde aussi son nom', enMemoire === 'Renommée pendant le balayage', enMemoire);

// 3. « Mettre à jour » pendant une saisie.
console.log('— 3. Mettre à jour');
const EDITED = staleName(5);
for (let k = 0; k < STALE; k++) {
  const name = staleName(k).replace(/\.gpx$/, '.json');
  await writeOpfs('sessions', name, `${await readOpfs('sessions', name)}\n`);
}
const during = await evaluate(`(async () => {
  const lib = ${LIB};
  const start = performance.now();
  const done = lib.refreshLibrary();
  await new Promise((r) => setTimeout(r, 30));
  lib.updateSessionRecord(${JSON.stringify(EDITED)}, { name: 'Renommée pendant la relecture' });
  const editedAt = Math.round(performance.now() - start);
  await done;
  return \`renommée à \${editedAt} ms, relecture finie à \${Math.round(performance.now() - start)} ms\`;
})()`);
await waitFor(async () => (await fiche(EDITED)).name === 'Renommée pendant la relecture', { timeout: 1500, label: 'fiche relue' });
const memEdited = await evaluate(`(async () => (${LIB}).librarySession(${JSON.stringify(EDITED)})?.record.name ?? '(sans nom)')()`);
console.log(`${during} | en mémoire : « ${memEdited} » | fiche : « ${(await fiche(EDITED)).name} »`);
check('une session renommée pendant la relecture garde son nom, en mémoire et dans la fiche', memEdited === 'Renommée pendant la relecture' && (await fiche(EDITED)).name === 'Renommée pendant la relecture', memEdited);

// 4. Import : un illisible, un dont la fiche ne peut s'écrire.
console.log('— 4. import');
const okPath = join(workDir, 'import-ok.gpx');
const brokenPath = join(workDir, 'import-illisible.gpx');
const blockedPath = join(workDir, 'import-bloque.gpx');
const T_BLOCKED = Date.UTC(2026, 9, 8, 8, 0, 0);
writeFileSync(okPath, sortieGpx('Import rangé', Date.UTC(2026, 9, 7, 8, 0, 0)));
writeFileSync(brokenPath, '<gpx><trk><trkseg><trkpt lat="43"');
writeFileSync(blockedPath, sortieGpx('Import bloqué', T_BLOCKED));
const blockedGpx = await evaluate(`(async () => (await import('/src/recording/session.ts')).sessionFileName(${T_BLOCKED}, 'wingfoil'))()`);
const blockedJson = blockedGpx.replace(/\.gpx$/, '.json');
await go('/voile');
await waitScan();
// Un dossier au nom de la fiche, posé après la lecture du dossier : l'application ne le connaît pas, et l'écriture de la fiche échoue.
await evaluate(`(async () => { await (await ${dirJs('sessions')}).getDirectoryHandle(${JSON.stringify(blockedJson)}, { create: true }); return 'ok'; })()`);
await importFiles([okPath, brokenPath, blockedPath], 'input[type=file][accept*=".gpx"][multiple]');
await waitFor(async () => (await alerts()) !== '(aucun bandeau)', { timeout: 4000, label: 'bandeau de l’import' });
await settle({ max: 4000, label: 'import' });
const bandeaux = await alerts();
console.log('bandeaux :', bandeaux);
const after = await listOpfs('sessions');
console.log(`sessions/ : ${blockedGpx} ${after.includes(blockedGpx) ? 'RESTÉ' : 'retiré'}, autre nom du bloqué : ${after.filter((n) => n.startsWith(blockedGpx.slice(0, 19)) && n !== blockedGpx && n !== blockedJson + '/').join(', ') || 'aucun'}, rangé : ${after.some((n) => n.startsWith('2026-10-07')) ? 'oui' : 'NON'}`);
check('l\'import : le bandeau nomme l\'illisible et le fichier dont la fiche ne s\'écrit pas', bandeaux.includes('import-illisible.gpx') && bandeaux.includes('import-bloque.gpx'), bandeaux);
check('le troisième est rangé, le GPX à moitié rangé est retiré', after.some((n) => n.startsWith('2026-10-07') && n.endsWith('.gpx')) && !after.includes(blockedGpx), after.join(', '));
await evaluate(`(async () => { await (await ${dirJs('sessions')}).removeEntry(${JSON.stringify(blockedJson)}); return 'ok'; })()`);
// La session rangée, importée de nouveau avec des capteurs : ils la rejoignent.
const okImu = join(workDir, 'import-ok.imu');
writeFileSync(okImu, Buffer.from('capteurs du banc'));
await evaluate(`(async () => { (${LIB}).dismissLibraryMessage(); return 'ok'; })()`);
await importFiles([okPath, okImu], 'input[type=file][accept*=".gpx"][multiple]');
await waitFor(async () => (await listOpfs('sessions')).some((n) => n.startsWith('2026-10-07') && n.endsWith('.imu')), { timeout: 3000, label: 'capteurs rangés' });
await settle({ max: 3000, label: 'réimport' });
const okGpx = (await listOpfs('sessions')).find((n) => n.startsWith('2026-10-07') && n.endsWith('.gpx'));
const imuRange = (await listOpfs('sessions')).includes(okGpx.replace(/\.gpx$/, '.imu'));
console.log(`réimport avec capteurs : ${await alerts()} | .imu rangé : ${imuRange}`);
check('importée de nouveau avec des capteurs, la session les reçoit', imuRange === true);

// 5. Stockage plein.
console.log('— 5. stockage plein');
// Le graphe d'activités et ses totaux repliables sont dans le profil depuis le 19/10.
await go('/profil');
const filled = await evaluate(`(() => {
  let n = 0;
  for (let size = 1 << 20; size >= 1; size = Math.floor(size / 2)) {
    for (;;) { try { localStorage.setItem('banc.remplissage.' + n, 'x'.repeat(size)); n += 1; } catch { break; } }
  }
  return n;
})()`);
const before = await evaluate(`localStorage.getItem('${CLES.sections}') ?? '(rien)'`);
const toggled = await evaluate(`(() => { const b = document.querySelector('.actchart__fold'); if (!b) return 'bouton absent'; b.click(); return 'totaux du graphe ' + (b.getAttribute('aria-expanded') === 'true' ? 'repliés' : 'dépliés'); })()`);
await wait(500);
const stored = await evaluate(`localStorage.getItem('${CLES.sections}') ?? '(rien)'`);
const inMemory = await evaluate(`(async () => JSON.stringify((await import('/src/platform/storage.ts')).jsonStore.read('${CLES.sections}')))()`);
const nouvelleValeur = inMemory !== (stored === '(rien)' ? 'null' : stored);
console.log(`${filled} clés de remplissage | ${toggled} | stockage inchangé : ${stored === before} | valeur relue nouvelle : ${nouvelleValeur}`);
const bandeauxPlein = await alerts();
console.log('bandeaux :', bandeauxPlein);
check('stockage plein : le réglage refusé reste en place pour la session, le stockage est inchangé', filled > 0 && toggled !== 'bouton absent' && stored === before && nouvelleValeur === true, `${filled} ; ${toggled}`);
check('stockage plein : le bandeau le dit', bandeauxPlein !== '(aucun bandeau)', bandeauxPlein);
await shoot('donnees-stockage-plein');
await evaluate(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('banc.remplissage.')) localStorage.removeItem(k); return 'ok'; })()`);

console.log(logs.length ? `console :\n${logs.join('\n')}` : 'console : aucune erreur');
await finish('Tout passe.');
