// Banc de test : coût de la trace colorée sur la carte d'une longue sortie (la trace colorée tient en une seule couche).
// Usage : node carte-perf.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf, sans réseau ; tuiles fausses (`lib/tuiles.mjs`), servies en 400 ms : les zooms rapides
// laissent des tuiles en route, dont on compte les requêtes, les doubles et les annulées. Le script :
//  1. écrit une longue session de wingfoil de 1 h à 5 Hz (18 000 points, `traceLongue` de `lib/traces.mjs` : des bords qui se
//     recoupent ; 1 h seulement pour que le passage reste court) ;
//  2. l'importe, ouvre son analyse et relève, sur la carte de l'analyse : le nombre de couches de Leaflet
//     (`map._layers`), les canevas du volet de la trace et l'histogramme des pixels de ce canevas (couleurs,
//     parts) ;
//  3. mesure 10 zooms puis 10 déplacements de la carte (sans animation) : durées du moteur (`Performance.getMetrics`,
//     ScriptDuration et TaskDuration), durée de chaque geste jusqu'à l'image suivante, et requêtes de tuiles ;
//  4. retourne à la bibliothèque et relève la vignette de la session (couches, histogramme ; image fixe,
//     sans carte ni canevas).
// Un compteur de tracés (`stroke` du canevas de la trace, posé avant le chargement de la page) relève « tracés au premier
// dessin » et « tracés sur un geste » (moyenne des 10 zooms du plan) : ces deux nombres baissent quand la trace compte moins de couleurs.
// Les durées sont en secondes (le masque commun `N ms` les effacerait) : le relevé change d'un passage à l'autre,
// il se lit à l'œil (couches et histogramme avant et après, durées comparées) ; les `check` disent que chaque étape a eu lieu.
// Les cartes sont trouvées par un crochet posé sur `window.L` (Leaflet 1.9 s'y publie toujours) : chaque carte créée
// est gardée dans `window.__cartes`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { traceLongue } from './lib/traces.mjs';
import { BLOCKED_EXCEPT_TILES, fakeTiles, formatTileStats } from './lib/tuiles.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node carte-perf.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

const b = await connect({ port, width: 1400, height: 1000, shotDir });
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importFiles, records, shoot, logs, check, finish } = b;
const tiles = await fakeTiles(b, { delayMs: 400 });

// Crochet des cartes de Leaflet (la rangée « avancé », qu'on croyait ouverte ici, se refermait à chaque session neuve depuis le 23/10).
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  (() => {
    let stored;
    window.__cartes = [];
    Object.defineProperty(window, 'L', {
      configurable: true,
      get: () => stored,
      set: (value) => {
        stored = value;
        if (value && value.Map && !value.__crochetBanc) {
          value.__crochetBanc = true;
          value.Map.addInitHook(function () { window.__cartes.push(this); });
        }
      },
    });
    // Compteur de tracés (stroke) du canevas de la trace : un par couleur et par tranche, plus le liseré. Il ne touche pas au dessin.
    window.__traces = 0;
    const strokeOrigine = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function () {
      try {
        if (this.canvas && this.canvas.closest && this.canvas.closest('.leaflet-trace-pane')) window.__traces += 1;
      } catch (e) { /* le compteur ne doit rien casser */ }
      return strokeOrigine.apply(this, arguments);
    };
  })();
` });
await blockNetwork(BLOCKED_EXCEPT_TILES);
await send('Performance.enable');

// 1. Longue session de wingfoil de 1 h à 5 Hz, à des bords qui se recoupent.
const HZ = 5;
const HEURES = 1;
const POINTS = HEURES * 3600 * HZ;
const runPath = join(workDir, 'carte-perf-longue.gpx');
writeFileSync(runPath, traceLongue(HEURES, HZ, 'wingfoil', { debutMs: Date.UTC(2026, 9, 1, 7, 0, 0), nom: 'Longue session 5 Hz' }));
console.log('trace              :', `${POINTS + 1} points à ${HZ} Hz`);

const listOpfs = (path) => evaluate(`(async () => {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
  for (const p of ${JSON.stringify(path)}.split('/')) dir = await dir.getDirectoryHandle(p);
  const names = []; for await (const [name] of dir.entries()) names.push(name); return names.sort();
})()`);

/** Carte Leaflet vivante dont le conteneur est sous `scope` (sélecteur CSS). */
const MAP = (scope) => `(window.__cartes ?? []).filter((m) => m._container?.isConnected && m._container.closest(${JSON.stringify(scope)})).at(-1)`;
const ANALYSE = '.an-map-frame';
const VIGNETTE = '.lib-row__preview';
/** Vignette dessinée : sa carte (ancienne vignette) ou son image fixe. */
const VIGNETTE_READY = `${VIGNETTE} .leaflet-trace-pane canvas, ${VIGNETTE} img.lib-row__preview-image`;

/** Couches de la carte et canevas de son volet de trace. */
const layers = (scope) => evaluate(`(() => {
  const map = ${MAP(scope)};
  if (!map) return '(carte absente)';
  const traceCanvas = map.getContainer().querySelectorAll('.leaflet-trace-pane canvas').length;
  return \`\${Object.keys(map._layers).length} couches, \${traceCanvas} canevas de trace\`;
})()`);

/**
 * Pixels bruts du canevas de la trace (RGBA, largeur et hauteur en tête, deux entiers de 32 bits), écrits dans le
 * dossier de travail : avec `--garder`, ceux d'avant et d'après se comparent pixel à pixel.
 */
const dumpPixels = async (scope, name) => {
  const b64 = await evaluate(`(() => {
    const canvas = ${MAP(scope)}?.getContainer().querySelector('.leaflet-trace-pane canvas');
    if (!canvas || canvas.width === 0) return null;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const out = new Uint8Array(8 + data.length);
    new DataView(out.buffer).setUint32(0, canvas.width, true);
    new DataView(out.buffer).setUint32(4, canvas.height, true);
    out.set(data, 8);
    let s = '';
    for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
    return btoa(s);
  })()`);
  if (b64) writeFileSync(join(workDir, `carte-perf-${name}.rgba`), Buffer.from(b64, 'base64'));
};

/**
 * Histogramme des pixels du canevas de la trace : pixels peints, couleurs (rgba) d'au moins 0,1 % des pixels peints,
 * et les dix plus fréquentes avec leur part.
 */
const histogram = (scope) => evaluate(`(() => {
  const map = ${MAP(scope)};
  const canvas = map?.getContainer().querySelector('.leaflet-trace-pane canvas');
  if (!canvas || canvas.width === 0) return '(canevas absent)';
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const counts = new Map();
  let painted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    painted++;
    const key = (data[i] << 24 | data[i + 1] << 16 | data[i + 2] << 8 | data[i + 3]) >>> 0;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const hex = (k) => '#' + k.toString(16).padStart(8, '0');
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const share = (n) => (100 * n / painted).toFixed(1).replace('.', ',') + ' %';
  const frequent = sorted.filter(([, n]) => n / painted >= 0.001).length;
  return [
    \`  canevas \${canvas.width}×\${canvas.height}, \${painted} pixels peints, \${counts.size} couleurs dont \${frequent} à 0,1 % ou plus\`,
    ...sorted.slice(0, 10).map(([k, n]) => \`  \${hex(k)} \${share(n)}\`),
  ].join('\\n');
})()`);

const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((m) => [m.name, m.value]));
const seconds = (v) => `${v.toFixed(3).replace('.', ',')} s`;
const NEXT_FRAME = 'new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)))';

/** Dix gestes sur la carte (`zoom` : trois avant, trois arrière, deux avant, deux arrière ; `pan` : va-et-vient), puis leurs durées. */
const gestures = async (scope, kind) => {
  const before = await metrics();
  const times = await evaluate(`(async () => {
    const map = ${MAP(scope)};
    if (!map) return null;
    const zooms = [1, 1, 1, -1, -1, -1, 1, 1, -1, -1];
    const pans = [[200, 120], [-200, -120], [-150, 180], [150, -180], [250, 0], [-250, 0], [0, 200], [0, -200], [180, 180], [-180, -180]];
    const times = [];
    for (let k = 0; k < 10; k++) {
      const t = performance.now();
      // Geste lancé d'une tâche de la page : le JavaScript d'un \`Runtime.evaluate\` n'entre pas dans ScriptDuration.
      await new Promise((res) => setTimeout(() => {
        if (${JSON.stringify(kind)} === 'zoom') map.setZoom(map.getZoom() + zooms[k], { animate: false });
        else map.panBy(pans[k], { animate: false });
        res();
      }, 0));
      await ${NEXT_FRAME};
      times.push(performance.now() - t);
    }
    return times;
  })()`);
  const after = await metrics();
  if (!times) return '(carte absente)';
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] / 1000;
  const max = sorted[sorted.length - 1] / 1000;
  return `script ${seconds(after.ScriptDuration - before.ScriptDuration)}, tâches ${seconds(after.TaskDuration - before.TaskDuration)}, geste médian ${seconds(median)}, max ${seconds(max)}`;
};

/** Nombre de tracés (stroke) faits depuis le chargement de la page sur le canevas de la trace (-1 : compteur absent). */
const traces = () => evaluate('window.__traces ?? -1');

const measure = async (label, compterTraces = false) => {
  console.log(`${label} : carte       :`, await layers(ANALYSE));
  console.log(`${label} : histogramme :\n${await histogram(ANALYSE)}`);
  await dumpPixels(ANALYSE, label.trim());
  // Tuiles du cadrage de départ arrivées : seules comptent celles des gestes.
  await wait(1000);
  tiles.reset();
  const tracesAvant = await traces();
  console.log(`${label} : 10 zooms    :`, await gestures(ANALYSE, 'zoom'));
  if (compterTraces) {
    const moyenne = (((await traces()) - tracesAvant) / 10).toFixed(1).replace('.', ',');
    console.log(`tracés sur un geste : ${moyenne} (moyenne des 10 zooms)`);
  }
  await wait(1000);
  console.log(`${label} : tuiles      :`, formatTileStats(tiles.stats()));
  tiles.reset();
  console.log(`${label} : 10 déplac.  :`, await gestures(ANALYSE, 'pan'));
  await wait(1000);
  console.log(`${label} : tuiles      :`, formatTileStats(tiles.stats()));
};

// 2. Import et analyse.
await go('/voile');
console.log('import             :', await importFiles(runPath, 'input[type=file][accept*=".gpx"][multiple]:not([disabled])'));
const runName = await waitFor(async () => (await listOpfs('sessions'))?.find((n) => n.endsWith('.gpx')), { timeout: 20000, label: 'fiche longue' });
// La fiche écrite et la vignette dessinée : la session se relit en entier (sous charge, l'écriture suit l'import de loin).
await waitFor(async () => (await records()).length > 0, { timeout: 30000, label: 'fiche JSON' });
await waitFor(`document.querySelectorAll('${VIGNETTE_READY}').length > 0`, { timeout: 30000, label: 'vignette après import' });
await settle({ max: 3000, label: 'import longue' });
const tOpen = Date.now();
await go(`/voile/analyse?session=${encodeURIComponent(runName)}`, 20000);
const analysisReady = `document.querySelectorAll('${ANALYSE} .leaflet-trace-pane canvas').length > 0 && Boolean(document.querySelector('h1'))`;
if (!(await waitFor(analysisReady, { timeout: 20000, label: 'analyse prête' }))) {
  // Une seconde chance : la page rechargée relit la session.
  await go(`/voile/analyse?session=${encodeURIComponent(runName)}`, 20000);
  await waitFor(analysisReady, { timeout: 30000, label: 'analyse prête (2e)' });
}
await settle({ max: 3000, label: 'analyse' });
console.log('analyse ouverte    :', await evaluate(`document.querySelector('h1')?.textContent`), `(${seconds((Date.now() - tOpen) / 1000)} jusqu'à la carte)`);
check('analyse ouverte : la carte porte la trace en un canevas', (await layers(ANALYSE)).includes('1 canevas de trace'), await layers(ANALYSE));
check('analyse ouverte : trace colorée (pixels peints)', !(await histogram(ANALYSE)).startsWith('(') && /[1-9]\d* pixels peints/.test(await histogram(ANALYSE)));
await evaluate(`document.querySelector('${ANALYSE}').scrollIntoView({ block: 'start' }); 'ok'`);
await wait(300);
await shoot('carte-perf-plan');
// Tracés du canevas depuis le chargement de l'analyse : le premier dessin de la trace et ses éventuels redessins de cadrage.
const tracesPremierDessin = await traces();
console.log(`tracés au premier dessin : ${tracesPremierDessin}`);
check('compteur de tracés actif (la trace a été tracée)', tracesPremierDessin > 0);
await measure('plan     ', true);

// 4. Vignette de la bibliothèque.
await go('/voile', 8000);
await waitFor(`document.querySelectorAll('${VIGNETTE_READY}').length > 0`, { timeout: 20000, label: 'vignette' });
await settle({ max: 3000, label: 'bibliothèque' });
const fixedImage = await evaluate(`Boolean(document.querySelector('${VIGNETTE} img.lib-row__preview-image'))`);
console.log('vignette : image fixe  :', fixedImage ? 'oui' : 'non');
check('vignette : image fixe, sans carte ni canevas', fixedImage && (await layers(VIGNETTE)) === '(carte absente)', await layers(VIGNETTE));
console.log('vignette : carte       :', await layers(VIGNETTE));
console.log(`vignette : histogramme :\n${await histogram(VIGNETTE)}`);
await dumpPixels(VIGNETTE, 'vignette');
await shoot('carte-perf-vignette');

console.log('--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 10).forEach((l) => console.log(l));
await finish('Tout passe.');
