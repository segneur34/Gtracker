// Banc de test : coût du survol des graphes et des clics « Voir » sur une longue trace (lot B de l'audit, §10, point 93 ;
// remis sur la voile au lot 330).
// Usage : node survol.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf. La recherche de lieux est bloquée, pour un résultat sans réseau et toujours le même ;
// seules les tuiles OSM passent, pour les captures. Le script :
//  1. écrit une longue session de wingfoil de 3 h à 1 Hz (10 800 points, `traceLongue`) et la session de voile du banc
//     (`traceVoile`) ;
//  2. importe la longue session, ouvre son analyse (onglets général et « graphiques ») ;
//     compte les traits SVG de la carte et les canevas de la trace, puis mesure 50 survols du graphe de vitesse ;
//  3. importe la session courte, ouvre son analyse (tous les onglets) et mesure 10 clics « Voir (Carte) » d'un top ;
//  4. avec `DUMP=x`, relève le texte des deux pages dans `x-longue.txt` et `x-voile.txt`, avant tout survol ;
//  5. avec un dossier de captures : les deux cartes à 1400×1000, puis la longue session à 390×844 et sa carte en plein écran.
// Comparer deux versions : le lancer sur chacune, chaque fois sur un profil neuf, et `diff` les relevés.
// Les durées sont des mesures (masquées au relevé) ; les `check` disent que chaque étape a bien eu lieu.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceLongue, traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node survol.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}
const DUMP = process.env.DUMP;

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, blockNetwork, importGpx, shoot, logs, wait, check, finish } = await connect({ port, width: 1400, height: 1000, shotDir });

const listOpfs = (path) => evaluate(`(async () => {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
  for (const p of ${JSON.stringify(path)}.split('/')) dir = await dir.getDirectoryHandle(p);
  const names = []; for await (const [name] of dir.entries()) names.push(name); return names.sort();
})()`);
/** Carte de la page : traits SVG, canevas de la trace colorée, légende. */
const mapInfo = () => evaluate(`JSON.stringify({
  traitsSvg: document.querySelectorAll('.an-map-frame .leaflet-overlay-pane path').length,
  canevasTrace: document.querySelectorAll('.an-map-frame .leaflet-trace-pane canvas').length,
  legende: document.querySelector('.an-map-frame .an-map-legend')?.textContent.trim() ?? '(aucune)',
})`);
/** Médiane et maximum d'une liste de durées, en ms. */
const timing = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return `médiane ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms, max ${sorted[sorted.length - 1].toFixed(1)} ms (${list.length} mesures)`;
};
/** Attend l'image suivante : le rendu de React et le travail de Leaflet sont faits. */
const NEXT_FRAME = 'new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)))';

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['https://photon.komoot.io/*']);

// 1. Traces. Longue session : 3 h de wingfoil à 1 Hz (le motif de la voile répété) ; courte : la session de voile du banc.
const longPath = join(workDir, 'survol-longue.gpx');
writeFileSync(longPath, traceLongue(3, 1, 'wingfoil', { debutMs: Date.UTC(2026, 9, 1, 7, 0, 0), nom: 'Longue session' }));
const sailPath = join(workDir, 'survol-voile.gpx');
writeFileSync(sailPath, traceVoile({ virageMin: 3 }));

// 2. Longue session.
await go('/voile');
await evaluate(`localStorage.setItem('${CLES.sections}', JSON.stringify({
  'sailing-onglets': { general: true, tops: false, manoeuvres: false, graphiques: true, vmg: false, vent: false, matos: false, reglages: false },
})); 'ok'`);
console.log('import longue      :', await importGpx(readFileSync(longPath, 'utf8'), 'survol-longue.gpx', 'input[type=file][accept*=".gpx"][multiple]:not([disabled])'));
const runName = await waitFor(async () => (await listOpfs('sessions'))?.find((n) => n.endsWith('.gpx')), { timeout: 6000, label: 'fiche longue' });
await settle({ max: 1500, label: 'import longue' });
await go(`/voile/analyse?session=${encodeURIComponent(runName)}`, 8000);
await waitFor("document.querySelectorAll('.an-map-frame .leaflet-trace-pane canvas').length > 0 && Boolean(document.querySelector('h1'))", { timeout: 8000, label: 'analyse prête' });
await settle({ max: 1000, label: 'analyse' });
console.log('longue ouverte    :', runName, '|', await evaluate(`document.querySelector('h1')?.textContent`));
const longMap = JSON.parse(await mapInfo());
console.log('carte              :', JSON.stringify(longMap));
check('longue session : analyse ouverte, trace colorée sur la carte, légende', longMap.canevasTrace > 0 && longMap.legende !== '(aucune)', JSON.stringify(longMap));
if (DUMP) writeFileSync(`${DUMP}-longue.txt`, await evaluate('document.body.innerText'));
await shoot('survol-longue');

const hover = await evaluate(`(async () => {
  const el = document.querySelector('.recharts-wrapper');
  if (!el) return 'graphe absent';
  el.scrollIntoView({ block: 'center' });
  await ${NEXT_FRAME};
  const r = el.getBoundingClientRect();
  const times = [];
  for (let k = 0; k < 50; k++) {
    const x = r.left + 60 + ((r.width - 120) * k) / 49;
    const t = performance.now();
    el.querySelector('.recharts-surface').dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: r.top + r.height / 2, bubbles: true }));
    await ${NEXT_FRAME};
    times.push(performance.now() - t);
  }
  const marker = document.querySelectorAll('.an-map-frame .leaflet-overlay-pane path').length;
  return JSON.stringify({ times, marker });
})()`);
if (hover.startsWith('{')) {
  const { times, marker } = JSON.parse(hover);
  console.log('survol (50)        :', timing(times.slice(1)), '| traits SVG après survol :', marker);
  check('survol : 50 survols mesurés sur le graphe de vitesse', times.length === 50);
} else {
  console.log('survol             :', hover);
  check('survol : 50 survols mesurés sur le graphe de vitesse', false, hover);
}

// 3. Session courte.
await evaluate(`localStorage.setItem('${CLES.sections}', JSON.stringify({
  'sailing-onglets': { general: true, tops: true, manoeuvres: true, graphiques: true, vmg: true, vent: true, matos: true, reglages: true },
})); 'ok'`);
const before = new Set(await listOpfs('sessions'));
await go('/voile');
console.log('import voile       :', await importGpx(readFileSync(sailPath, 'utf8'), 'survol-voile.gpx', 'input[type=file][accept*=".gpx"][multiple]:not([disabled])'));
const sailName = await waitFor(async () => (await listOpfs('sessions'))?.find((n) => n.endsWith('.gpx') && !before.has(n)), { timeout: 6000, label: 'fiche voile' });
await settle({ max: 1500, label: 'import voile' });
await go(`/voile/analyse?session=${encodeURIComponent(sailName)}`, 8000);
await waitFor("document.querySelectorAll('.an-map-frame .leaflet-trace-pane canvas').length > 0 && Boolean(document.querySelector('h1'))", { timeout: 8000, label: 'analyse prête' });
await settle({ max: 1000, label: 'analyse' });
console.log('voile ouverte      :', sailName, '|', await evaluate(`document.querySelector('h1')?.textContent`));
const sailMap = JSON.parse(await mapInfo());
console.log('carte              :', JSON.stringify(sailMap));
check('voile : analyse ouverte, trace colorée sur la carte', sailMap.canevasTrace > 0, JSON.stringify(sailMap));
if (DUMP) writeFileSync(`${DUMP}-voile.txt`, await evaluate('document.body.innerText'));

const tops = await evaluate(`(async () => {
  const times = [];
  for (let k = 0; k < 10; k++) {
    const b = [...document.querySelectorAll('button')].find((x) => /(Voir|Masquer) \\(Carte\\)/.test(x.textContent));
    if (!b) return 'bouton absent';
    const t = performance.now();
    b.click();
    await ${NEXT_FRAME};
    times.push(performance.now() - t);
  }
  return JSON.stringify(times);
})()`);
console.log('clic « Voir » (10) :', tops.startsWith('[') ? timing(JSON.parse(tops)) : tops);
check('voile : dix clics « Voir (Carte) » faits', tops.startsWith('[') && JSON.parse(tops).length === 10, tops.slice(0, 40));
await evaluate(`[...document.querySelectorAll('button')].find((x) => /Voir \\(Carte\\)/.test(x.textContent))?.click(); 'ok'`);
await wait(500);
const topMap = JSON.parse(await mapInfo());
console.log('carte, top montré  :', JSON.stringify(topMap));
check('voile : un top montré, tracé de plus sur la carte', topMap.traitsSvg > sailMap.traitsSvg, `${sailMap.traitsSvg} → ${topMap.traitsSvg}`);
await evaluate(`document.querySelector('.an-map-frame').scrollIntoView({ block: 'start' }); 'ok'`);
await wait(500);
await shoot('survol-voile-top');

// 4. Téléphone : la longue session, puis sa carte en plein écran.
if (shotDir) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await go(`/voile/analyse?session=${encodeURIComponent(runName)}`, 8000);
  await waitFor("document.querySelectorAll('.an-map-frame .leaflet-trace-pane canvas').length > 0 && Boolean(document.querySelector('h1'))", { timeout: 8000, label: 'analyse prête' });
  await settle({ max: 1000, label: 'analyse' });
  await shoot('survol-longue-390');
  await evaluate(`document.querySelector('.an-map-frame .leaflet-container').click(); 'ok'`);
  await settle({ max: 3000 });
  const full = JSON.parse(await evaluate(`JSON.stringify({
    traitsSvg: document.querySelectorAll('.an-map-overlay .leaflet-overlay-pane path').length,
    canevasTrace: document.querySelectorAll('.an-map-overlay .leaflet-trace-pane canvas').length,
  })`));
  console.log('plein écran        :', JSON.stringify(full));
  check('390 : la carte en plein écran porte la trace colorée', full.canevasTrace > 0, JSON.stringify(full));
  await shoot('survol-longue-390-plein-ecran');
}

console.log('--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 10).forEach((l) => console.log(l));
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
