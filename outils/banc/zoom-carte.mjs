// Banc de test : graphe zoomé vu sur la carte, lecture au-dessus des graphes, double-clic qui zoome
// (voile et surf).
// Usage : node zoom-carte.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 2 min. Le script :
//  1. importe une session de wingfoil et une de surf (`lib/traces.mjs`), toutes deux avec la FC ;
//  2. voile, sur ordinateur : survol sans bulle Recharts, la valeur lue au-dessus du graphe, sans le faire bouger ;
//     double-clic à 25 % de la largeur : les graduations changent (la plage est divisée par deux autour du point visé),
//     un second les change encore ; « Afficher » et « Tout voir » paraissent ; « Afficher » allume le tronçon en
//     violet et cadre la carte dessus, ramenée à l'écran ; un nouveau zoom met le violet à jour sans recadrer ;
//     « Tout voir » l'efface, et il ne revient pas au zoom suivant ; fermer l'onglet l'efface aussi ;
//  3. voile : « Afficher » de l'onglet cardio ;
//  4. voile (vent) et surf : lecture, double-clic, « Afficher » ;
//  5. à 390×844, au doigt : double toucher qui zoome ; carte hors de vue : « +carte » ouvre le plein écran
//     carte + graphes, × le ferme ; carte entière à l'écran (« général » replié) : « +carte » ouvre quand même le plein écran, tronçon allumé ;
//  6. à 390×844 (25/10) : « +carte » seul sur un graphe non zoomé ; il ouvre carte + graphes de l'onglet, sans violet ;
//     le retour d'Android (`window.gtrackerBack`, en développement) referme le plein écran et rend la page au même
//     défilement, zoom compris ; de même zoomé, et pour la carte seule ouverte d'un toucher ;
//  7. (25/10) « Afficher » sur chaque graphe, zoomé ou non, sur ordinateur et dans le plein écran (non zoomé :
//     toute la trace) ; « +carte » dans la page du téléphone ; un second clic à la même plage retire le violet,
//     zoom et plein écran gardés ; la plage changée entre-temps, il recadre ;
//  8. (05/11) flèches de sens en voile et en surf : moins au zoom −2, les mêmes au retour, plus au zoom +2.
// Les graduations ne sont pas écrites en dur : l'axe est le temps, elles dépendent de la durée de la trace ; on compare
// leur suite avant et après chaque zoom.
import { connect, POIGNEE_RETOUR } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { CHART, SCOPE, graphGestures } from './lib/graphes.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node zoom-carte.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });

const clickTab = (label, close = false) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  const isOpen = t.getAttribute('aria-pressed') === 'true';
  if (isOpen !== ${close}) return isOpen ? 'déjà ouvert' : 'déjà fermé';
  t.click(); return 'ok';
})()`);
// Sélecteurs des panneaux et des graphes, et gestes (double-clic, survol, double toucher) : `lib/graphes.mjs`.
const { doubleClick, hover, doubleTap } = graphGestures({ send, evaluate, settle, wait });
/** Lectures du panneau, au-dessus de ses graphes. */
const readouts = (title) => evaluate(`(() => { const s = ${SCOPE(title)}; return s ? [...s.querySelectorAll('[data-chart-readout]')].map((r) => r.textContent.trim()).join(' | ') : '(absent)'; })()`);
/** Texte des infobulles de Recharts, dans toute la page : il doit rester vide. */
const tooltipText = () => evaluate(`[...document.querySelectorAll('.recharts-tooltip-wrapper')].map((w) => w.textContent.trim()).join('')`);
/** Graduations de l'axe des abscisses du n-ième graphe. */
const ticks = (title, nth) => evaluate(`(() => { const c = ${CHART(title, nth)}; return c ? [...c.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((t) => t.textContent.trim()).join(' | ') : '(absent)'; })()`);
/** Boutons du zoom posés sur le n-ième graphe. */
const zoomButtons = (title, nth) => evaluate(`(() => { const c = ${CHART(title, nth)}; return c ? [...c.querySelectorAll('.zoom-chart__map, .zoom-chart__actions button')].map((b) => b.textContent.trim()).join(' | ') : '(absent)'; })()`);
const clickZoomButton = (title, nth, label) => evaluate(`(() => {
  const c = ${CHART(title, nth)};
  const b = c ? [...c.querySelectorAll('.zoom-chart__map, .zoom-chart__actions button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}) : null;
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
/** Tronçon violet dans la carte de la page (`.an-map-row`) ou du plein écran : part de la carte qu'il couvre (largeur ou hauteur). */
const violet = (where = '.an-map-row') => evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify(where)});
  const map = root?.querySelector('.leaflet-container');
  const paths = root ? [...root.querySelectorAll('path[stroke="#7b1fa2"]')] : [];
  if (!map || paths.length === 0) return { count: 0, cover: 0 };
  const m = map.getBoundingClientRect();
  const boxes = paths.map((p) => p.getBoundingClientRect());
  const left = Math.min(...boxes.map((b) => b.left)), right = Math.max(...boxes.map((b) => b.right));
  const top = Math.min(...boxes.map((b) => b.top)), bottom = Math.max(...boxes.map((b) => b.bottom));
  return { count: paths.length, cover: Math.round(100 * Math.max((right - left) / m.width, (bottom - top) / m.height)) / 100 };
})()`);
/** La carte de la page est-elle entière à l'écran, sous la barre du haut (sa marge de défilement) ? */
const mapOnScreen = () => evaluate(`(() => { const el = document.getElementById('map-view'); if (!el) return null; const r = el.getBoundingClientRect(); const top = parseFloat(getComputedStyle(el).scrollMarginTop) || 0; return r.top >= top - 1 && r.bottom <= window.innerHeight + 1; })()`);
const chartTop = (title, nth) => evaluate(`(() => { const c = ${CHART(title, nth)}; return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : null; })()`);
// Rangée « avancé » des analyses ouverte d'office, rouverte à chaque session neuve avec « général » (comme `graphes.mjs`).
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

// --- Sessions synthétiques ---
const MORNING = [
  [60, 0], [60, 1.2, 90], [50, 1, 0], [4, 0.1], [40, 1, 270], [4, 0.1], [26, 1, 0], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1, 20], [60, 0.1],
  [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1, 90],
];
const T_SURF = Date.UTC(2026, 9, 3, 7, 0, 0);
const T_VOILE = Date.UTC(2026, 8, 20, 13, 0, 0);
const SESSIONS = [
  { key: 'voile', page: 'voile', start: T_VOILE, gpx: traceVoile({ debutMs: T_VOILE, nom: 'Ligne', virageMin: 3, fc: (t) => 120 + 25 * Math.sin(t / 300) }) },
  { key: 'surf', page: 'surf', start: T_SURF, gpx: traceSurf({ debutMs: T_SURF, nom: 'Matinée', phases: MORNING, fc: (t) => 110 + 20 * Math.sin(t / 120) }) },
];

// --- 1. Import ---
const paths = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.key} :`, await importGpx(s.gpx, `${s.key}.gpx`));
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 6000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  paths[s.key] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.key} rangée`, Boolean(rec));
}

// --- 2. Voile, sur ordinateur ---
await go(paths.voile, 8000);
console.log('  graphiques :', await clickTab('graphiques'));
await settle({ max: 1500 });
const T0 = await ticks('Graphiques', 0);
check(`voile : graduations de départ (${T0})`, T0 !== '(absent)' && T0 !== '');
check(`voile : « Afficher » seul avant le zoom (${await zoomButtons('Graphiques', 0)})`, (await zoomButtons('Graphiques', 0)) === 'Afficher');
const deskPerChart = await evaluate(`(() => { const p = ${SCOPE('Graphiques')}; return p ? [...p.querySelectorAll('.zoom-chart')].map((c) => c.querySelectorAll(':scope > .zoom-chart__map').length).join('') : '(absent)'; })()`);
check(`voile : « Afficher » sur chaque graphe de temps, FC comprise (${deskPerChart})`, /^1{2,}/.test(deskPerChart));
// Sans zoom : toute la trace en violet ; un second clic la retire.
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 1500 });
const wholeV = await violet();
check(`voile : sans zoom, « Afficher » allume toute la trace (${wholeV.count}, ${wholeV.cover})`, wholeV.count >= 1 && wholeV.cover > 0.45);
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 800 });
check(`voile : second clic, violet retiré (${(await violet()).count})`, (await violet()).count === 0);
await evaluate(`window.scrollTo(0, 0)`);
await wait(500);
const topBefore = await chartTop('Graphiques', 1);
console.log('  survol :', await hover('Graphiques', 0, 0.5));
const read = await readouts('Graphiques');
check(`voile : lecture au-dessus des graphes (${read})`, /nds? · \d\d:\d\d:\d\d/.test(read) && read.includes('bpm'));
check(`voile : aucune bulle Recharts (« ${await tooltipText()} »)`, (await tooltipText()) === '');
check(`voile : le graphe suivant ne bouge pas au survol (${topBefore} → ${await chartTop('Graphiques', 1)})`, topBefore === (await chartTop('Graphiques', 1)));
await shoot('zoom-lecture');
const titleSize = await evaluate(`(() => { const t = ${SCOPE('Graphiques')}?.querySelector('[role=button]'); return t ? getComputedStyle(t).fontSize : null; })()`);
check(`analyses : titres des panneaux à 13 px (${titleSize})`, titleSize === '13px');
console.log('  double-clic à 25 % :', await doubleClick('Graphiques', 0, 0.25));
const Z1 = await ticks('Graphiques', 0);
check(`voile : zoom ×2 autour du point visé, graduations changées (${T0} → ${Z1})`, Z1 !== T0 && Z1 !== '(absent)' && Z1 !== '');
check(`voile : les autres graphes suivent (${await ticks('Graphiques', 1)})`, (await ticks('Graphiques', 1)) === Z1);
check(`voile : « Afficher » et « Tout voir » (${await zoomButtons('Graphiques', 0)})`, (await zoomButtons('Graphiques', 0)) === 'Afficher | Tout voir');
const buttonBox = await evaluate(`(() => { const b = ${CHART('Graphiques', 0)}?.querySelector('.zoom-chart__actions button'); if (!b) return null; const s = getComputedStyle(b); return { h: Math.round(b.getBoundingClientRect().height), font: s.fontSize }; })()`);
check(`boutons du zoom 20 % plus petits (${JSON.stringify(buttonBox)})`, buttonBox?.h === 24 && buttonBox?.font === '10.4px');
console.log('  second double-clic :', await doubleClick('Graphiques', 0, 0.25));
const Z2 = await ticks('Graphiques', 0);
check(`voile : zoom ×2 encore, sur le même point (${Z1} → ${Z2})`, Z2 !== Z1 && Z2 !== T0 && Z2 !== '(absent)');
check(`voile : pas de violet avant le bouton (${(await violet()).count})`, (await violet()).count === 0);
console.log('  Sur la carte :', await clickZoomButton('Graphiques', 0, 'Afficher'));
await settle({ max: 1800 });
const framed = await violet();
// Leaflet cadre au cran de zoom entier : le tronçon remplit entre la moitié et toute la carte.
check(`voile : tronçon violet cadré, qui remplit la carte à un cran près (${framed.count} tracé, ${framed.cover})`, framed.count >= 1 && framed.cover > 0.45);
check(`voile : carte ramenée à l'écran (${await mapOnScreen()})`, (await mapOnScreen()) === true);
await shoot('zoom-sur-la-carte');
console.log('  double-clic à 50 % :', await doubleClick('Graphiques', 0, 0.5));
const narrower = await violet();
check(`voile : le violet suit le zoom, sans recadrer (${framed.cover} → ${narrower.cover})`, narrower.count >= 1 && narrower.cover < framed.cover * 0.7 && narrower.cover > 0.2);
console.log('  Tout voir :', await clickZoomButton('Graphiques', 0, 'Tout voir'));
await settle({ max: 800 });
check(`voile : « Tout voir » efface le violet, « Afficher » reste (${(await violet()).count}, « ${await zoomButtons('Graphiques', 0)} »)`, (await violet()).count === 0 && (await zoomButtons('Graphiques', 0)) === 'Afficher');
check(`voile : « Tout voir » rend les graduations de départ (${await ticks('Graphiques', 0)})`, (await ticks('Graphiques', 0)) === T0);
await doubleClick('Graphiques', 0, 0.5);
check(`voile : le violet ne revient pas au zoom suivant (${(await violet()).count})`, (await violet()).count === 0);
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 1500 });
check('voile : rallumé par le bouton', (await violet()).count >= 1);
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 800 });
check(`voile : second clic sur la même plage, violet retiré, zoom gardé (${(await violet()).count}, « ${await zoomButtons('Graphiques', 0)} »)`, (await violet()).count === 0 && (await zoomButtons('Graphiques', 0)) === 'Afficher | Tout voir');
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 1200 });
check('voile : troisième clic, rallumé', (await violet()).count >= 1);
console.log('  graphiques fermé :', await clickTab('graphiques', true));
await settle({ max: 800 });
check(`voile : onglet fermé, violet effacé (${(await violet()).count})`, (await violet()).count === 0);
await clickTab('graphiques');
await settle({ max: 1200 });
check(`voile : rouvert, zoom gardé mais pas le violet (${(await violet()).count}, « ${await zoomButtons('Graphiques', 0)} »)`, (await violet()).count === 0 && (await zoomButtons('Graphiques', 0)) === 'Afficher | Tout voir');
await clickZoomButton('Graphiques', 0, 'Tout voir');

// --- 3. Voile : cardio ---
await clickTab('graphiques', true);
console.log('  cardio :', await clickTab('cardio'));
await settle({ max: 1500 });
await hover('Cardio', 0, 0.4);
check(`cardio : lecture (${await readouts('Cardio')})`, (await readouts('Cardio')).includes(' · '));
await doubleClick('Cardio', 0, 0.5);
check(`cardio : zoomé (${await zoomButtons('Cardio', 0)})`, (await zoomButtons('Cardio', 0)) === 'Afficher | Tout voir');
await clickZoomButton('Cardio', 0, 'Afficher');
await settle({ max: 1500 });
const cardioV = await violet();
check(`cardio : tronçon violet cadré (${cardioV.count}, ${cardioV.cover})`, cardioV.count >= 1 && cardioV.cover > 0.45);
await clickZoomButton('Cardio', 0, 'Tout voir');
await wait(600);
check('cardio : effacé par « Tout voir »', (await violet()).count === 0);
await clickTab('cardio', true);
await wait(600);

// --- 4. Voile et surf ---
await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 2000 });
await doubleClick('Graphiques', 0, 0.5);
await clickZoomButton('Graphiques', 0, 'Afficher');
await settle({ max: 1800 });
await clickTab('vent');
await settle({ max: 1500 });
await hover('Variations du Vent', 0, 0.5);
check(`vent : lecture en degrés (${await readouts('Variations du Vent')})`, /\d+° · \d\d:/.test(await readouts('Variations du Vent')));
check(`vent : même zoom (${await zoomButtons('Variations du Vent', 0)})`, (await zoomButtons('Variations du Vent', 0)) === 'Afficher | Tout voir');
await clickZoomButton('Variations du Vent', 0, 'Afficher');
await settle({ max: 1500 });
check('vent : le tronçon passe à l\'onglet vent', (await violet()).count >= 1);
await clickTab('vent', true);
await wait(600);
check('vent fermé : violet effacé', (await violet()).count === 0);
await clickZoomButton('Graphiques', 0, 'Tout voir');

await go(paths.surf, 6000);
await clickTab('graphiques');
await settle({ max: 1500 });
await hover('Vitesse', 0, 0.5);
check(`surf : lecture (${await readouts('Vitesse')})`, /km\/h · \d\d:/.test(await readouts('Vitesse')) && (await readouts('Vitesse')).includes('bpm'));
await doubleClick('Vitesse', 0, 0.6);
await clickZoomButton('Vitesse', 0, 'Afficher');
await settle({ max: 1500 });
const surfV = await violet();
check(`surf : tronçon violet (${surfV.count}, ${surfV.cover})`, surfV.count >= 1 && surfV.cover > 0.45);

// --- 5. Téléphone, au doigt ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 1500 });
const P0 = await ticks('Graphiques', 0);
check(`390 px : « +carte » seul avant le zoom (${await zoomButtons('Graphiques', 0)})`, (await zoomButtons('Graphiques', 0)) === '+carte');
const perChart = await evaluate(`(() => { const p = ${SCOPE('Graphiques')}; return p ? [...p.querySelectorAll('.zoom-chart')].map((c) => c.querySelectorAll(':scope > .zoom-chart__map').length).join('') : '(absent)'; })()`);
check(`390 px : « +carte » sur chaque graphe de temps, FC comprise (${perChart})`, /^1{2,}/.test(perChart));
console.log('  double toucher :', await doubleTap('Graphiques', 0, 0.25));
const P1 = await ticks('Graphiques', 0);
check(`390 px : le double toucher zoome ×2 (${P0} → ${P1})`, P1 !== P0 && P1 !== '(absent)');
check(`390 px : aucune bulle (« ${await tooltipText()} »)`, (await tooltipText()) === '');
check(`390 px : carte hors de vue (${await mapOnScreen()})`, (await mapOnScreen()) === false);
await clickZoomButton('Graphiques', 0, '+carte');
await settle({ max: 1800 });
const overlay = await evaluate(`(() => { const o = document.querySelector('.an-map-overlay'); return o ? { charts: o.querySelectorAll('.an-map-overlay__charts .zoom-chart').length, map: Boolean(o.querySelector('.leaflet-container')) } : null; })()`);
check(`390 px : plein écran carte + graphes (${JSON.stringify(overlay)})`, overlay !== null && overlay.map && overlay.charts >= 2);
const overV = await violet('.an-map-overlay');
check(`390 px : tronçon violet cadré dans le plein écran (${overV.count}, ${overV.cover})`, overV.count >= 1 && overV.cover > 0.45);
await shoot('zoom-plein-ecran');
console.log('  double toucher dans le plein écran :', await doubleTap(null, 0, 0.5));
const P2 = await ticks(null, 0);
check(`390 px : on zoome encore sous la carte (${P1} → ${P2})`, P2 !== P1 && P2 !== '(absent)');
const overV2 = await violet('.an-map-overlay');
check(`390 px : le violet suit (${overV.cover} → ${overV2.cover})`, overV2.count >= 1 && overV2.cover < overV.cover * 0.7);
// Plage changée depuis le clic : « Afficher » recadre ; un second clic retire le violet, le plein écran reste.
check(`390 px : « Afficher » dans le plein écran (${await zoomButtons(null, 0)})`, (await zoomButtons(null, 0)) === 'Afficher | Tout voir');
await clickZoomButton(null, 0, 'Afficher');
await settle({ max: 1200 });
const reframed = await violet('.an-map-overlay');
check(`390 px : plage changée, « Afficher » recadre sans annuler (${reframed.count}, ${reframed.cover})`, (await evaluate(`Boolean(document.querySelector('.an-map-overlay'))`)) === true && reframed.count >= 1 && reframed.cover > 0.45);
await clickZoomButton(null, 0, 'Afficher');
await settle({ max: 1200 });
check(`390 px : second clic, violet retiré, plein écran ouvert (${(await violet('.an-map-overlay')).count})`, (await evaluate(`Boolean(document.querySelector('.an-map-overlay'))`)) === true && (await violet('.an-map-overlay')).count === 0);
await evaluate(`document.querySelector('.an-map-overlay__close')?.click()`);
await settle({ max: 800 });
check('390 px : × ferme le plein écran', (await evaluate(`Boolean(document.querySelector('.an-map-overlay'))`)) === false);
// Tout replié sauf « graphiques », en haut de page : la carte est à l'écran, « +carte » ouvre quand même le plein
// écran carte + graphes, tronçon allumé (05/11, à la place du cadrage sur place du 25/10).
await clickTab('général', true);
await evaluate(`window.scrollTo(0, 0)`);
await settle({ max: 800 });
const onScreen = await mapOnScreen();
const buttonsVisible = await evaluate(`(() => { const b = document.querySelector('.zoom-chart__map'); if (!b) return false; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })()`);
console.log(`  carte à l'écran : ${onScreen}, bouton à l'écran : ${buttonsVisible}`);
await evaluate(`document.querySelector('.zoom-chart__map')?.click()`);
await settle({ max: 1500 });
check(`390 px : carte à l'écran, « +carte » ouvre le plein écran carte + graphes, tronçon allumé (${onScreen})`, onScreen === true && (await evaluate(`Boolean(document.querySelector('.an-map-overlay--charts'))`)) === true && (await violet('.an-map-overlay')).count >= 1);
await shoot('zoom-carte-a-l-ecran');
await evaluate(`document.querySelector('.an-map-overlay__close')?.click()`);
await settle({ max: 800 });

// --- 6. Sans zoom, et retour d'Android (25/10) ---
const back = () => evaluate(`window.${POIGNEE_RETOUR} ? window.${POIGNEE_RETOUR}() : 'absent'`);
const overlayOpen = () => evaluate(`Boolean(document.querySelector('.an-map-overlay'))`);
await clickZoomButton('Graphiques', 0, 'Tout voir');
await wait(600);
await evaluate(`(() => { const c = ${CHART('Graphiques', 0)}; c?.scrollIntoView({ block: 'center' }); })()`);
await wait(600);
const scrollBefore = await evaluate(`Math.round(window.scrollY)`);
await clickZoomButton('Graphiques', 0, '+carte');
await settle({ max: 1800 });
const wholeOverlay = await evaluate(`(() => { const o = document.querySelector('.an-map-overlay'); return o ? { charts: o.querySelectorAll('.an-map-overlay__charts .zoom-chart').length, mapButtons: [...o.querySelectorAll('.an-map-overlay__charts .zoom-chart__map')].filter((b) => getComputedStyle(b).display !== 'none').length } : null; })()`);
check(`390 px : sans zoom, plein écran carte + graphes, « Afficher » sur chacun (${JSON.stringify(wholeOverlay)})`, wholeOverlay !== null && wholeOverlay.charts >= 2 && wholeOverlay.mapButtons === wholeOverlay.charts);
check('390 px : sans zoom, pas de tronçon violet', (await violet('.an-map-overlay')).count === 0);
check(`390 px : « Afficher » seul, sans zoom (${await zoomButtons(null, 0)})`, (await zoomButtons(null, 0)) === 'Afficher');
await shoot('sans-zoom-plein-ecran');
await clickZoomButton(null, 0, 'Afficher');
await settle({ max: 1200 });
const overWhole = await violet('.an-map-overlay');
check(`390 px : « Afficher » sans zoom allume toute la trace (${overWhole.count}, ${overWhole.cover})`, overWhole.count >= 1 && overWhole.cover > 0.45);
await clickZoomButton(null, 0, 'Afficher');
await settle({ max: 800 });
check('390 px : second clic, violet retiré, plein écran ouvert', (await violet('.an-map-overlay')).count === 0 && (await overlayOpen()) === true);
const backed = await back();
await settle({ max: 800 });
const scrollAfter = await evaluate(`Math.round(window.scrollY)`);
check(`390 px : le retour ferme carte + graphes (${backed})`, backed === 'layer' && (await overlayOpen()) === false);
check(`390 px : même défilement après le retour (${scrollBefore} → ${scrollAfter})`, Math.abs(scrollAfter - scrollBefore) <= 2);
check(`390 px : toujours sur l'analyse (${await evaluate('location.pathname')})`, (await evaluate('location.pathname')) === paths.voile.split('?')[0]);
// Zoomé, carte hors de vue : plein écran, retour, zoom gardé.
console.log('  double toucher :', await doubleTap('Graphiques', 0, 0.25));
await clickZoomButton('Graphiques', 0, '+carte');
await settle({ max: 1800 });
check('390 px : zoomé, plein écran ouvert', (await overlayOpen()) === true);
await back();
await settle({ max: 800 });
check(`390 px : zoomé, le retour ferme et garde le zoom (${await ticks('Graphiques', 0)})`, (await overlayOpen()) === false && (await ticks('Graphiques', 0)) !== P0);
check(`390 px : zoomé, le retour retire aussi le tronçon violet (${(await violet()).count})`, (await violet()).count === 0);
// Carte seule, d'un toucher.
await evaluate(`window.scrollTo(0, 0)`);
await wait(500);
await evaluate(`document.querySelector('.an-map-row .an-map-frame')?.click()`);
await settle({ max: 1200 });
check('390 px : un toucher ouvre la carte seule', (await overlayOpen()) === true && (await evaluate(`Boolean(document.querySelector('.an-map-overlay--charts'))`)) === false);
const backedMap = await back();
await wait(600);
check(`390 px : le retour ferme la carte seule (${backedMap})`, backedMap === 'layer' && (await overlayOpen()) === false);

// --- 8. Flèches de sens selon le zoom (05/11) ---
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
const arrows = () => evaluate(`document.querySelectorAll('.an-map-row .custom-arrow').length`);
/** Clique `n` fois sur le bouton + ou − de la carte de la page ; « butée » si le bouton est grisé. */
const zoomMap = async (sign, n) => {
  for (let k = 0; k < n; k++) {
    const r = await evaluate(`(() => { const b = document.querySelector('.an-map-row .leaflet-control-zoom-${sign === '+' ? 'in' : 'out'}'); if (!b) return 'absent'; if (b.classList.contains('leaflet-disabled')) return 'butée'; b.click(); return 'ok'; })()`);
    if (r !== 'ok') return r;
    await wait(700);
  }
  return 'ok';
};
for (const page of ['voile', 'surf']) {
  await go(paths[page], 7000);
  await settle({ max: 1500 });
  const base = await arrows();
  await zoomMap('-', 2);
  const out = await arrows();
  await zoomMap('+', 2);
  const back2 = await arrows();
  const inResult = await zoomMap('+', 2);
  const closer = await arrows();
  console.log(`${page}, flèches : zoom −2 ${out} · cadrage ${base} (${back2} au retour) · zoom +2 ${closer} (${inResult})`);
  check(`${page} : des flèches sur la trace (${base})`, base > 0);
  check(`${page} : moins de flèches au zoom −2 (${out} < ${base})`, out < base);
  check(`${page} : les mêmes au retour (${back2})`, back2 === base);
  check(`${page} : plus de flèches au zoom +2 (${closer} > ${base}), ou butée du zoom`, closer > base || inResult === 'butée');
}

console.log('\n--- console (erreurs, avertissements) ---');
for (const l of logs) console.log(l);
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
