// Banc de test : graphes repliables un par un (demandes du 16/10), en surf et en voile ; la course (ordre des onglets,
// replis vitesse-altitude-FC, mode superposé, zones de pente, sortie à sprints) est retirée au lot 303.
// Usage : node graphes.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 1 min. Le script :
//  1. importe une session de surf avec la FC et une session de voile (`make-gpx.mjs`) avec la FC ;
//  2. voile (lot 60) : le graphe de vitesse zoomé par un double-clic, graduations relevées, capture `graphes-zoom`,
//     puis « Tout voir » ; lot 93 : un clic sur une graduation ne ramène pas le repère de la carte au premier point ;
//  5. surf : replis Vitesse et FC ; voile : replis des trois graphes, titre gardé, état retenu ;
//     lot 61 : noms des graphes de la voile (texte sans tenir compte de la casse, couleur et taille relevées), nom du
//     vent ; survol de la vitesse en voile et en surf, curseur sur la FC ; lot 167 : courbe de la VMG ;
//  6. à 390×844 : la voile sans débordement.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node graphes.mjs <port> [<dossier des captures>]');
  process.exit(1);
}
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);

const clickTab = (label, close = false) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  const isOpen = t.getAttribute('aria-pressed') === 'true';
  if (isOpen !== ${close}) return isOpen ? 'déjà ouvert' : 'déjà fermé';
  t.click(); return 'ok';
})()`);
/** Le panneau dont le titre commence ainsi. */
const SCOPE = (title) => `([...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}))?.closest('.an-carte-panels > *') ?? null)`;
const chartsIn = (title) => evaluate(`(() => { const s = ${SCOPE(title)}; return s ? s.querySelectorAll('.recharts-surface').length : -1; })()`);
/** Texte du panneau tel qu'écrit : `innerText` rendrait les capitales de la refonte (boutons, noms des graphes). */
const textIn = (title) => evaluate(`(() => { const s = ${SCOPE(title)}; return s ? s.textContent : ''; })()`);
/** Boutons de repli du panneau : nom et état. */
const folds = (title) => evaluate(`(() => { const s = ${SCOPE(title)}; return s ? [...s.querySelectorAll('[data-chart-fold]')].map((b) => b.textContent.trim() + (b.getAttribute('aria-expanded') === 'true' ? '+' : '-')).join(' ') : '(absent)'; })()`);
const fold = (title, label) => evaluate(`(() => {
  const s = ${SCOPE(title)};
  const b = s ? [...s.querySelectorAll('[data-chart-fold]')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}) : null;
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const hoverMarkers = () => evaluate(`document.querySelectorAll('.an-map-row path[stroke="#1b1f24"]').length`);
const hoverChart = (title, nth) => evaluate(`(async () => {
  const s = ${SCOPE(title)};
  const el = s ? s.querySelectorAll('.recharts-wrapper')[${nth}] : null;
  if (!el) return 'absent';
  el.scrollIntoView({ block: 'center' });
  await new Promise((r) => requestAnimationFrame(() => r()));
  const r = el.getBoundingClientRect();
  for (let k = 0; k < 5; k++) {
    el.querySelector('.recharts-surface').dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 80 + k * 20, clientY: r.top + r.height / 2, bubbles: true }));
    await new Promise((res) => requestAnimationFrame(() => res()));
  }
  return 'ok';
})()`);
/** Le n-ième graphe zoomable du panneau. */
const CHART = (title, nth) => `(${SCOPE(title)}?.querySelectorAll('.zoom-chart')[${nth}] ?? null)`;
/** Graduations d'un axe (`xAxis` ou `yAxis`) du n-ième graphe. */
const ticks = (title, nth, axis = 'xAxis') => evaluate(`(() => { const c = ${CHART(title, nth)}; return c ? [...c.querySelectorAll('.recharts-${axis}-tick-labels .recharts-cartesian-axis-tick-value')].map((t) => t.textContent.trim()).join(' | ') : '(absent)'; })()`);
const zoomButtons = (title, nth) => evaluate(`(() => { const c = ${CHART(title, nth)}; return c ? [...c.querySelectorAll('.zoom-chart__map, .zoom-chart__actions button')].map((b) => b.textContent.trim()).join(' | ') : '(absent)'; })()`);
const clickZoomButton = (title, nth, label) => evaluate(`(() => {
  const c = ${CHART(title, nth)};
  const b = c ? [...c.querySelectorAll('.zoom-chart__map, .zoom-chart__actions button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}) : null;
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
/** Double-clic au milieu de la zone de tracé du n-ième graphe, graphe ramené au milieu de l'écran (comme `zoom-carte.mjs`). */
const doubleClick = async (title, nth, fx) => {
  const p = await evaluate(`(async () => {
    const c = ${CHART(title, nth)};
    if (!c) return null;
    c.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 300));
    const r = (c.querySelector('.recharts-cartesian-grid') ?? c).getBoundingClientRect();
    return { x: r.left + r.width * ${fx}, y: r.top + r.height / 2 };
  })()`);
  if (!p) return 'absent';
  const mouse = (type, clickCount = 1) => send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount });
  await mouse('mouseMoved');
  await mouse('mousePressed', 1);
  await mouse('mouseReleased', 1);
  await mouse('mousePressed', 2);
  await mouse('mouseReleased', 2);
  await settle({ max: 800 });
  return 'ok';
};
// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

// --- Sessions synthétiques ---
const M_PER_DEG_LAT = 111_195;
const surfGpx = (startMs, phases, hrAt) => {
  let lat = 43.4;
  let lon = 3.6;
  let t = 0;
  const pts = [];
  const push = (speed, heading) => pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${new Date(startMs + t * 1000).toISOString()}</time>`
    + `<extensions><speed>${speed}</speed>${speed > 0 ? `<course>${heading}</course>` : ''}<gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hrAt(t))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
  push(0, 0);
  for (const [s, speed, heading = 0] of phases) {
    for (let k = 0; k < s; k++) {
      lat += (speed * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
      lon += (speed * Math.sin((heading * Math.PI) / 180)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
      t += 1;
      push(speed, heading);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="banc" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Matinée</name><type>surf</type><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>\n`;
};
const MORNING = [
  [60, 0], [60, 1.2], [50, 1], [4, 0.1], [40, 1], [4, 0.1], [26, 1], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1],
  [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1],
];
const withHr = (gpx, hrAt) => {
  let k = 0;
  return gpx
    .replace('xmlns="http://www.topografix.com/GPX/1/1"', 'xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"')
    .replace(/<\/extensions><\/trkpt>/g, () => `<gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hrAt(k++))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
};
const voilePath = join(tmpdir(), 'graphes-voile.gpx');
execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'make-gpx.mjs'), voilePath]);

const T_SURF = Date.UTC(2026, 9, 3, 7, 0, 0);
const T_VOILE = Date.UTC(2026, 8, 20, 13, 0, 0);
const SESSIONS = [
  { key: 'surf', page: 'surf', start: T_SURF, gpx: surfGpx(T_SURF, MORNING, (k) => 110 + 20 * Math.sin(k / 120)) },
  { key: 'voile', page: 'voile', start: T_VOILE, gpx: withHr(readFileSync(voilePath, 'utf8'), (k) => 120 + 25 * Math.sin(k / 300)) },
];

// --- 1. Import ---
const paths = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.key} :`, await importGpx(s.gpx, `${s.key}.gpx`));
  // L'écriture en mémoire ne touche ni au DOM ni au réseau : la fiche est attendue, puis sa réécriture différée.
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 6000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  paths[s.key] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.key} rangée`, Boolean(rec));
}

// --- 2. Voile : zoom de la vitesse (lot 60) et repère de la carte (lot 93) ; 3 et 4 (course) retirés au lot 303 ---
await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 2000 });
// Graphe de vitesse zoomé (lot 60) : graduations relevées, à comparer avant et après un changement des graphes.
const ticksBefore = await ticks('Graphiques', 0);
console.log(`  graduations avant le zoom : ${ticksBefore}`);
console.log('  double-clic sur la vitesse :', await doubleClick('Graphiques', 0, 0.5));
for (const k of [0, 1]) console.log(`  graphe ${k + 1} zoomé : abscisse ${await ticks('Graphiques', k)} ; ordonnée ${await ticks('Graphiques', k, 'yAxis')}`);
check(`zoomé : graduations changées, « Tout voir » paru (${await zoomButtons('Graphiques', 0)})`,
  (await ticks('Graphiques', 0)) !== ticksBefore && (await zoomButtons('Graphiques', 0)).includes('Tout voir'));
await shoot('graphes-zoom');
console.log('  Tout voir :', await clickZoomButton('Graphiques', 0, 'Tout voir'));
await settle({ max: 800 });
check(`« Tout voir » : graduations rendues (${await ticks('Graphiques', 0)})`, (await ticks('Graphiques', 0)) === ticksBefore);

// Lot 93 : un clic sur un graphe lui donne le focus, et la couche clavier de Recharts (accessibilityLayer) active alors
// le premier point (curseur et point actif posés dessus) ; si la souris est hors du tracé (graduations, marges), le
// moindre mouvement ramène le repère de la carte au premier point affiché. Le repère doit rester où le survol l'a
// laissé, et le graphe ne doit ni prendre le focus ni afficher de curseur à l'insu de la souris.
{
  // Page rechargée : le double-clic du zoom, plus haut, a déjà donné le focus au graphe.
  await go(paths.voile, 8000);
  await clickTab('graphiques');
  await settle({ max: 1500 });
  const p = await evaluate(`(async () => {
    const c = ${CHART('Graphiques', 0)};
    if (!c) return null;
    c.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 300));
    const r = (c.querySelector('.recharts-cartesian-grid') ?? c).getBoundingClientRect();
    return { trace: { x: r.left + r.width * 0.6, y: r.top + r.height / 2 }, graduations: { x: r.left - 12, y: r.top + r.height / 2 } };
  })()`);
  const mouse = (type, pt, clickCount = 0) => send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount });
  /** Le repère de la carte tel que dessiné (sa position suit le point survolé). */
  const marker = () => evaluate(`[...document.querySelectorAll('.an-map-row path[stroke="#1b1f24"]')].map((m) => m.getAttribute('d') + '|' + JSON.stringify(m.getBoundingClientRect())).join(';')`);
  /** Curseurs de survol et points actifs dessinés dans les graphes de la page. */
  const cursors = () => evaluate(`document.querySelectorAll('.recharts-tooltip-cursor').length + document.querySelectorAll('.recharts-active-dot').length`);
  check('premier point : graphe de vitesse trouvé', Boolean(p));
  if (p) {
    // Le survol pose le repère, puis la souris passe sur les graduations, où le repère reste.
    for (const dx of [-30, -10, 0]) await mouse('mouseMoved', { x: p.trace.x + dx, y: p.trace.y });
    await wait(300);
    check(`premier point : le survol pose le repère sur la carte (${await hoverMarkers()})`, (await hoverMarkers()) === 1);
    for (const dx of [0, 3]) await mouse('mouseMoved', { x: p.graduations.x + dx, y: p.graduations.y });
    await wait(300);
    const laisse = await marker();
    // Clic sur une graduation, puis quelques mouvements de la souris sur elles.
    await mouse('mousePressed', p.graduations, 1);
    await mouse('mouseReleased', p.graduations, 1);
    for (const dy of [0, 3, 6]) await mouse('mouseMoved', { x: p.graduations.x, y: p.graduations.y + dy });
    await wait(500);
    const focus = await evaluate(`(() => { const a = document.activeElement; return a ? a.tagName + ' tabindex=' + a.getAttribute('tabindex') : ''; })()`);
    const apres = await marker();
    console.log(`  après le clic sur une graduation : focus ${focus}, ${await cursors()} curseur(s) et point(s) actif(s), repère ${apres === laisse ? 'resté où il était' : 'déplacé'}`);
    check('premier point : un clic sur une graduation ne ramène pas le repère au premier point', apres === laisse);
    check(`premier point : le graphe ne prend pas le focus au clavier (${focus})`, !focus.includes('tabindex=0'));
    check(`premier point : aucun curseur ni point actif hors du tracé (${await cursors()})`, (await cursors()) === 0);
    await mouse('mouseMoved', { x: 5, y: 5 });
  }
}

// --- 5. Surf et voile ---
await go(paths.surf, 6000);
await clickTab('graphiques');
await settle({ max: 1500 });
check(`surf : replis Vitesse et FC (${await folds('Vitesse')})`, (await folds('Vitesse')) === 'Vitesse+ FC+');
await fold('Vitesse', 'FC');
await settle({ max: 800 });
check(`surf : FC repliée, un graphe (${await chartsIn('Vitesse')})`, (await chartsIn('Vitesse')) === 1);
await go(paths.surf, 6000);
check(`surf : repli retenu (${await folds('Vitesse')})`, (await folds('Vitesse')) === 'Vitesse+ FC-');
await fold('Vitesse', 'Vitesse');
await settle({ max: 800 });
check(`surf : tout replié, plus de graphe (${await chartsIn('Vitesse')})`, (await chartsIn('Vitesse')) === 0);
await fold('Vitesse', 'Vitesse');
await fold('Vitesse', 'FC');

await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 2000 });
check(`voile : trois replis (${await folds('Graphiques')})`, (await folds('Graphiques')) === 'Historique de Vitesse+ Fréquence cardiaque+ Polaire de Vitesse (TWA)+');
const voileCharts = await chartsIn('Graphiques');
await fold('Graphiques', 'Historique de Vitesse');
await settle({ max: 800 });
check(`voile : vitesse repliée, un graphe de moins (${voileCharts} → ${await chartsIn('Graphiques')}), titre gardé`,
  (await chartsIn('Graphiques')) === voileCharts - 1 && (await textIn('Graphiques')).includes('Historique de Vitesse'));
await go(paths.voile, 8000);
check(`voile : repli retenu (${await folds('Graphiques')})`, (await folds('Graphiques')) === 'Historique de Vitesse- Fréquence cardiaque+ Polaire de Vitesse (TWA)+');
await fold('Graphiques', 'Historique de Vitesse');
await settle({ max: 800 });
check(`voile : rouvert (${await chartsIn('Graphiques')})`, (await chartsIn('Graphiques')) === voileCharts);

// --- 5 bis. Lot 61 : noms de la voile, curseur commun, pics gardés ---
/** Boutons de repli du panneau tels qu'affichés, en minuscules (les noms suivent la règle commune : capitales), avec leur couleur et leur taille. */
const foldLooks = (title) => evaluate(`(() => { const s = ${SCOPE(title)}; return s ? [...s.querySelectorAll('[data-chart-fold]')].map((b) => { const c = getComputedStyle(b); return b.innerText.trim().toLowerCase() + ' (' + c.color + ', ' + c.fontSize + ')'; }).join(' ; ') : '(absent)'; })()`);
/** Curseurs de survol dessinés dans le n-ième graphe du panneau. */
const cursorsIn = (title, nth) => evaluate(`(() => { const s = ${SCOPE(title)}; const w = s ? s.querySelectorAll('.recharts-wrapper')[${nth}] : null; return w ? w.querySelectorAll('.recharts-tooltip-cursor').length : -1; })()`);

await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 2000 });
const voileTitles = await foldLooks('Graphiques');
console.log(`  voile, noms des graphes : ${voileTitles}`);
check('voile : noms des graphes, casse non comptée', ['historique de vitesse', 'fréquence cardiaque', 'polaire de vitesse (twa)'].every((t) => voileTitles.includes(`${t} (`)));
console.log('  survol de la vitesse :', await hoverChart('Graphiques', 0));
await wait(500);
check(`voile : survol de la vitesse, curseur sur la FC (${await cursorsIn('Graphiques', 1)})`, (await cursorsIn('Graphiques', 1)) >= 1);
console.log('  vent :', await clickTab('vent'));
await settle({ max: 1500 });
const windTitle = await evaluate(`(() => { const e = [...document.querySelectorAll('.an-carte-panels *')].find((x) => x.children.length === 0 && x.textContent.trim() === 'Évolution du Vent'); return e ? e.innerText.trim().toLowerCase() + ' (' + getComputedStyle(e).color + ', ' + getComputedStyle(e).fontSize + ')' : '(absent)'; })()`);
console.log(`  voile, nom du vent : ${windTitle}`);
check('voile : nom du vent, casse non comptée', windTitle.startsWith('évolution du vent ('));
await clickTab('vent', true);
// Lot 167 : courbe de la VMG dans son onglet, sous le tableau et les podiums, tracée, avec zéro dans son axe.
console.log('  vmg :', await clickTab('vmg'));
await settle({ max: 1500 });
const vmgDrawn = await evaluate(`(() => { const s = ${SCOPE('Analyse VMG')}; const d = s?.querySelector('.recharts-line-curve')?.getAttribute('d') ?? ''; return { lines: s ? s.querySelectorAll('.recharts-line').length : -1, drawn: d.length > 0 }; })()`);
check(`voile : courbe de la VMG tracée (${vmgDrawn.lines} ligne, tracé ${vmgDrawn.drawn})`, vmgDrawn.lines === 1 && vmgDrawn.drawn);
const vmgOrder = await evaluate(`(() => { const s = ${SCOPE('Analyse VMG')}; const t = s?.querySelector('table'); const c = s?.querySelector('.zoom-chart'); return !!t && !!c && t.getBoundingClientRect().bottom <= c.getBoundingClientRect().top; })()`);
check('voile : la courbe de la VMG vient sous le tableau', vmgOrder === true);
const vmgTicks = await ticks('Analyse VMG', 0, 'yAxis');
check(`voile : zéro dans l'axe de la VMG (${vmgTicks})`, vmgTicks.split(' | ').includes('0'));
const vmgShot = async (name) => {
  await evaluate(`${SCOPE('Analyse VMG')}?.scrollIntoView({ block: 'start' })`);
  await settle({ max: 800 });
  await shoot(name);
};
await vmgShot('vmg');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await settle({ max: 1500 });
await vmgShot('vmg-tel');
await send('Emulation.clearDeviceMetricsOverride');
await settle({ max: 800 });
await clickTab('vmg', true);

await go(paths.surf, 6000);
await clickTab('graphiques');
await settle({ max: 1500 });
console.log('  surf, survol de la vitesse :', await hoverChart('Vitesse', 0));
await wait(500);
check(`surf : survol de la vitesse, curseur sur la FC (${await cursorsIn('Vitesse', 1)})`, (await cursorsIn('Vitesse', 1)) >= 1);

// --- 6. Téléphone ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(paths.voile, 8000);
check(`390 px : voile sans débordement (${await overflow()} px)`, (await overflow()) <= 0);
await shoot('graphes-390');

console.log('\n--- console (erreurs, avertissements) ---');
for (const l of logs) console.log(l);
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
