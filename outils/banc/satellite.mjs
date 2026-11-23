// Banc de test : la photo satellite est retirée, le plan reste seul. À verdict.
// Usage : node satellite.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau (tuiles synthétiques de `lib/tuiles.mjs`). Dure environ 1 min.
// Le script :
//  1. importe une session de wingfoil et une de surf ;
//  2. dans chaque analyse, à 1400×1000 puis 390×844 : aucun bouton « Fond de carte » (`.map-base-switch`), mention
//     « OpenStreetMap », tuiles du plan affichées, rien ne déborde ; planification : aucun bouton non plus ;
//  3. un fond « satellite » rangé d'avant (fiche de la session `mapBase`, clé `fondCarte` de la famille) donne le plan,
//     sans erreur, et la fiche reste modifiable ;
//  4. aucune requête vers l'ancien serveur d'imagerie, pendant tout le script ;
//  5. effacement unique : une tuile `/tuiles-gardees/sat_14_1_2.png` posée dans le cache avec le drapeau d'effacement
//     retiré a disparu après rechargement, la tuile voisine du plan est restée, le drapeau est posé, puis une seconde
//     tuile `sat_` posée n'est plus effacée (une seule fois) ;
//  6. Réglages › Cartes hors ligne : ni « satellite » ni champ d'adresse pour lui, celui du plan reste.
import { CACHES, CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { BLOCKED_EXCEPT_TILES, fakeTiles } from './lib/tuiles.mjs';
import { enveloppeGpx, pointGpx } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node satellite.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

const b = await connect({ port, width: 1400, height: 1000, shotDir });
const { send, evaluate, go, settle, waitFor, wait, importGpx, records, shoot, check, finish, logs, onMessage, blockNetwork } = b;

await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await fakeTiles(b);
await blockNetwork(BLOCKED_EXCEPT_TILES);

// Toute requête vers l'ancien serveur d'imagerie, vue par le protocole (servie par la fausse file de tuiles, sans réseau).
const retiredRequests = [];
onMessage((msg) => {
  if (msg.method === 'Network.requestWillBeSent' && /arcgisonline|World_Imagery/i.test(msg.params.request.url)) retiredRequests.push(msg.params.request.url);
});

const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
const buttons = () => evaluate(`document.querySelectorAll('.map-base-switch, .map-base-switch__button').length`);
const attribution = () => evaluate(`document.querySelector('.leaflet-control-attribution')?.textContent ?? ''`);
const loadedTiles = () => evaluate(`[...document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile')].filter((i) => i.complete && i.naturalWidth > 0).length`);
const cachedKeys = () => evaluate(`(async () => {
  const cache = await caches.open('${CACHES.tuiles}');
  return (await cache.keys()).map((r) => new URL(r.url).pathname).filter((p) => !p.endsWith('_index.json')).sort();
})()`);
const putTile = (key) => evaluate(`(async () => {
  const cache = await caches.open('${CACHES.tuiles}');
  await cache.put('/tuiles-gardees/${key}.png', new Response('x', { headers: { 'content-type': 'image/png', '${CACHES.entete}': String(Date.now()) } }));
  return 'ok';
})()`);

// --- 1. Sessions synthétiques : un aller-retour le long de la côte ---
const loopGpx = (type, seconds, speed, t0) => {
  const lat0 = 43.515;
  const mPerDegLon = (Math.PI / 180) * 6371e3 * Math.cos((lat0 * Math.PI) / 180);
  const pts = [];
  for (let k = 0; k <= seconds; k++) {
    const half = seconds / 2;
    const m = (k <= half ? k : seconds - k) * speed;
    const lat = lat0 - (k <= half ? 0 : 0.002);
    pts.push(pointGpx({ lat, lon: 3.9 + m / mPerDegLon, ms: t0 + k * 1000, vitesse: speed, alt: 2 }));
  }
  return enveloppeGpx({ nom: 'Boucle', type }, pts);
};
const SESSIONS = [
  { key: 'voile', page: 'voile', start: Date.UTC(2026, 9, 5, 13), type: 'wingfoil', seconds: 900, speed: 7 },
  { key: 'surf', page: 'surf', start: Date.UTC(2026, 9, 8, 8), type: 'surf', seconds: 600, speed: 2 },
];
const paths = {};
const gpxs = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.key} :`, await importGpx(loopGpx(s.type, s.seconds, s.speed, s.start), `${s.key}.gpx`));
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 6000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  paths[s.key] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  gpxs[s.key] = rec?.gpx;
  check(`${s.key} rangée`, Boolean(rec));
}

// --- 2. Les analyses : plan seul, aucun bouton de fond ---
for (const s of SESSIONS) {
  await go(paths[s.key], 6000);
  await waitFor(() => loadedTiles(), { timeout: 6000, label: `tuiles ${s.key}` });
  check(`${s.key} : aucun bouton « Fond de carte »`, (await buttons()) === 0, await buttons());
  check(`${s.key} : mention OpenStreetMap`, (await attribution()).includes('OpenStreetMap'), await attribution());
  check(`${s.key} : tuiles du plan affichées`, (await loadedTiles()) > 0);
  check(`${s.key} : rien ne déborde`, (await overflow()) <= 0, await overflow());
}
await shoot('satellite-voile-plan');

// --- Planification ---
await go('/itineraires', 4000);
check('planification : la carte est là, sans bouton de fond', (await evaluate(`document.querySelector('.plan-map .leaflet-container') ? 'ok' : 'absent'`)) === 'ok' && (await buttons()) === 0, await buttons());
check('planification : mention OpenStreetMap', (await attribution()).includes('OpenStreetMap'), await attribution());

// --- 3. Un fond « satellite » rangé d'avant ---
// Fiche de la session de voile : on y écrit `mapBase: 'satellite'` ; la famille aussi dans `fondCarte`.
const patched = await evaluate(`(async () => {
  const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Gtracker')).getDirectoryHandle('sessions');
  for await (const [name, h] of dir.entries()) {
    if (!name.endsWith('.json')) continue;
    const rec = JSON.parse(await (await h.getFile()).text());
    if (rec.gpx !== ${JSON.stringify(gpxs.voile)}) continue;
    rec.mapBase = 'satellite';
    const w = await h.createWritable();
    await w.write(JSON.stringify(rec));
    await w.close();
    localStorage.setItem('${CLES.fondCarte}', JSON.stringify({ voile: 'satellite', surf: 'satellite' }));
    return name;
  }
  return null;
})()`);
check('fiche « satellite » posée', patched !== null);
await go(paths.voile, 6000);
await waitFor(() => loadedTiles(), { timeout: 6000, label: 'tuiles après fiche satellite' });
check('fiche « satellite » : le plan, sa mention, aucun bouton', (await attribution()).includes('OpenStreetMap') && !(await attribution()).includes('Esri') && (await buttons()) === 0, await attribution());
check('fiche « satellite » : la session s\'ouvre, pas en lecture seule', !(await evaluate(`document.body.innerText.includes("n'est pas dans la mémoire")`)));
await go('/itineraires', 4000);
check('fond « satellite » de la famille : le plan à la planification', (await attribution()).includes('OpenStreetMap') && (await buttons()) === 0, await attribution());

// --- À 390×844 ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(paths.voile, 6000);
await waitFor(() => loadedTiles(), { timeout: 6000, label: 'tuiles 390' });
check('390 : aucun bouton de fond, mention OpenStreetMap, rien ne déborde', (await buttons()) === 0 && (await attribution()).includes('OpenStreetMap') && (await overflow()) <= 0, `${await buttons()} / ${await overflow()}`);
await shoot('satellite-390');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

// --- 5. Effacement unique des tuiles `sat_` ---
await go('/sessions', 3000);
// Le premier lancement a noté l'effacement : on le retire, et on pose une tuile de l'ancien fond et une du plan.
const flagAfterFirstLaunch = await evaluate(`JSON.parse(localStorage.getItem('${CLES.tileCache}') ?? '{}').purged ?? null`);
console.log('drapeau après le premier lancement :', JSON.stringify(flagAfterFirstLaunch));
await evaluate(`localStorage.removeItem('${CLES.tileCache}')`);
await putTile('sat_14_1_2');
await putTile('14_1_2');
const before = await cachedKeys();
console.log('cache avant :', before.join(', '));
check('tuiles posées dans le cache', before.includes('/tuiles-gardees/sat_14_1_2.png') && before.includes('/tuiles-gardees/14_1_2.png'), before.join(', '));
await go('/sessions', 3000);
await waitFor(async () => !(await cachedKeys()).some((k) => k.includes('/sat_')), { timeout: 8000, label: 'effacement des sat_' });
const after = await cachedKeys();
console.log('cache après :', after.join(', '));
check('la tuile sat_ a disparu après rechargement', !after.some((k) => k.includes('/sat_')), after.join(', '));
check('la tuile voisine du plan est restée', after.includes('/tuiles-gardees/14_1_2.png'), after.join(', '));
const flag = await waitFor(`JSON.parse(localStorage.getItem('${CLES.tileCache}') ?? '{}').purged?.includes('sat_') === true`, { timeout: 4000, label: 'drapeau' });
check('le drapeau d\'effacement est posé', Boolean(flag), await evaluate(`localStorage.getItem('${CLES.tileCache}')`));
await putTile('sat_14_3_4');
await go('/sessions', 3000);
await wait(1500);
check('une seule fois : une tuile sat_ posée ensuite n\'est plus effacée', (await cachedKeys()).includes('/tuiles-gardees/sat_14_3_4.png'), (await cachedKeys()).join(', '));

// --- 6. Réglages › Cartes hors ligne ---
await go('/parametres', 3000);
await waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Cartes hors ligne')`, { timeout: 4000, label: 'bloc Cartes hors ligne' });
await evaluate(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Cartes hors ligne')?.click()`);
await settle({ max: 1500, label: 'bloc ouvert' });
const block = await evaluate(`(() => { const t = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Cartes hors ligne'); return t ? t.parentElement.innerText : ''; })()`);
console.log('bloc :', block.replace(/\n+/g, ' / '));
check('Cartes hors ligne : le bloc est ouvert', block.length > 30, block);
check('Cartes hors ligne : plus de « satellite »', !/satellite/i.test(block), block);
check('Cartes hors ligne : le champ d\'adresse du plan reste', /Adresse des tuiles du plan/.test(block), block);
await shoot('satellite-reglages');

// --- 4. Aucune requête vers l'ancien serveur ---
check('aucune requête vers l\'ancien serveur d\'imagerie, de tout le script', retiredRequests.length === 0, retiredRequests.slice(0, 3).join(' | '));

console.log(logs.length ? `console :\n${[...new Set(logs)].join('\n')}` : 'console : aucune erreur');
await finish('Tout passe.');
