// Banc de test : barre d'onglets repliable des analyses, régularité depuis la plus vieille session, et dernier
// affichage des statistiques retenu (lot 1 des demandes du 16/10).
// Usage : node barre.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau, environ 1 min. Le script :
//  1. importe une session de surf (10 jours avant aujourd'hui) et une de wingfoil (`lib/traces.mjs`, 20 jours avant) ;
//  2. dans l'analyse de surf : la flèche en fin de barre, qui cache la barre seule (panneaux ouverts gardés) et
//     laisse le bouton fin « onglets » ; caché après rechargement et dans l'analyse de voile ; le bouton fin rend la
//     barre et disparaît ; à 390×844, sans débordement ;
//  3. statistiques : Surf sur « Année », « Semaines actives » comptées depuis la session de surf, pas sur 52 semaines ;
//  4. le dernier affichage repris à l'ouverture sans paramètre, une adresse avec paramètres qui l'emporte, « Tout »
//     retenu aussi.
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node barre.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, logs, close } = await connect({ port, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
// Sortie propre à ce script (le détail est toujours montré) : gardée telle quelle pour que le relevé reste comparable.
let failures = 0;
const check = (what, ok, detail = '') => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failures++; };

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['*://*.openstreetmap.org/*']);
const desktop = () => send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await desktop();

// --- 1. Sessions : une matinée de surf (10 jours avant aujourd'hui) et la voile du banc (20 jours avant) ---
const DAY = 86_400_000;
const today = new Date();
const T_SURF = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8).getTime() - 10 * DAY;
const T_VOILE = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14).getTime() - 20 * DAY;
const SURF_PHASES = [[60, 0], [120, 1.2], [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1], [5, 1.5, 180], [6, 6, 160], [40, 1], [30, 0.1]];

const paths = {};
for (const [page, start, gpx] of [['surf', T_SURF, traceSurf({ debutMs: T_SURF, phases: SURF_PHASES, nom: 'Matinée' })], ['voile', T_VOILE, traceVoile({ debutMs: T_VOILE, virageMin: 3 })]]) {
  await go(`/${page}`, 3000);
  await importGpx(gpx, `${page}.gpx`);
  await waitFor(async () => (await records())?.some((r) => Math.abs((r.summary?.startMs ?? 0) - start) < 2000), { timeout: 8000, label: `fiche ${page}` });
  await settle({ max: 2000, label: `import ${page}` });
  const rec = (await records()).find((r) => Math.abs((r.summary?.startMs ?? 0) - start) < 2000);
  paths[page] = `/${page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${page} rangée`, Boolean(rec));
}

// --- 2. Barre repliable ---
const bar = () => evaluate(`(() => {
  const col = document.querySelector('.an-carte-col');
  return {
    tabs: col ? col.querySelectorAll('.ui-tab').length : -1,
    arrow: Boolean(col?.querySelector('.an-tabs-hide')),
    reveal: Boolean(col?.querySelector('.an-tabs-reveal')),
    revealHeight: col?.querySelector('.an-tabs-reveal')?.getBoundingClientRect().height ?? 0,
    panels: document.querySelectorAll('.an-carte-panels > *').length,
    // La flèche est en fin de rangée, suivie seulement du bouton « tout ouvrir » ou « tout fermer » (05/11).
    arrowLast: (() => { const a = col?.querySelector('.an-tabs-hide'); return Boolean(a) && (a.nextElementSibling?.classList.contains('an-tabs-close-all') || a.nextElementSibling?.classList.contains('an-tabs-open-all')) && a.nextElementSibling.nextElementSibling === null; })(),
  };
})()`);
const click = (selector) => evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);

await go(paths.surf, 6000);
let b = await bar();
check('surf : barre visible, flèche en fin de rangée (avant « tout fermer »), pas de bouton fin', b.tabs > 0 && b.arrow && b.arrowLast && !b.reveal, JSON.stringify(b));
const panelsBefore = b.panels;
await click('.an-tabs-hide');
await wait(500);
b = await bar();
check('flèche : barre cachée, bouton fin seul, panneaux gardés', b.tabs === 0 && !b.arrow && b.reveal && b.panels === panelsBefore, JSON.stringify(b));
await shoot('barre-cachee-ordinateur');
await go(paths.surf, 6000);
b = await bar();
check('cachée après rechargement', b.tabs === 0 && b.reveal, JSON.stringify(b));
await go(paths.voile, 8000);
b = await bar();
check('cachée aussi dans la voile', b.tabs === 0 && b.reveal, JSON.stringify(b));
await click('.an-tabs-reveal');
await wait(500);
b = await bar();
check('bouton fin : barre rendue, bouton disparu', b.tabs > 0 && b.arrow && !b.reveal, JSON.stringify(b));
await go(paths.surf, 6000);
b = await bar();
check('rendue aussi dans le surf', b.tabs > 0 && !b.reveal, JSON.stringify(b));

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(paths.surf, 6000);
check('390 px, barre visible : pas de débordement', (await overflow()) <= 0);
await shoot('barre-visible-390');
await click('.an-tabs-hide');
await wait(500);
b = await bar();
check('390 px, barre cachée : bouton fin, sans débordement', b.reveal && b.revealHeight > 0 && b.revealHeight <= 26 && (await overflow()) <= 0, `hauteur ${b.revealHeight}`);
await shoot('barre-cachee-390');
await click('.an-tabs-reveal');
await wait(300);
await desktop();

// --- 3. Régularité ---
// Le choix se fait dans la fenêtre « Sélection » : l'ouvrir, cliquer le gros bouton, « Valider ».
const chip = async (group, label) => {
  await evaluate(`document.querySelector('button.stats-selection')?.click()`);
  await waitFor(`Boolean(document.querySelector('[role="dialog"][aria-label="Sélection"]'))`, { timeout: 3000, every: 50, label: 'fenêtre Sélection' });
  const r = await evaluate(`(() => {
  const g = document.querySelector('.stats-selection-dialog [role=radiogroup][aria-label=${JSON.stringify(group)}]');
  const b = g && [...g.querySelectorAll('button')].find((x) => (x.querySelector('.ui-choice__label') ?? x).textContent.trim() === ${JSON.stringify(label)});
  if (!b) return 'absent'; b.click();
  return 'ok';
})()`);
  // Le brouillon de la fenêtre doit avoir rendu le choix avant « Valider ».
  await waitFor(`[...document.querySelectorAll('.stats-selection-dialog [role=radiogroup][aria-label=${JSON.stringify(group)}] [aria-checked=true]')].some((x) => (x.querySelector('.ui-choice__label') ?? x).textContent.trim() === ${JSON.stringify(label)})`, { timeout: 3000, every: 50, label: 'choix coché' });
  await evaluate(`document.querySelector('.stats-selection__foot .ui-btn--primary').click()`);
  await waitFor(`!document.querySelector('[role="dialog"][aria-label="Sélection"]')`, { timeout: 3000, every: 50, label: 'fenêtre fermée' });
  return r;
};
const stat =(label) => evaluate(`(() => {
  const s = [...document.querySelectorAll('.an-sheet__stat')].find((x) => x.querySelector('.an-sheet__stat-label')?.textContent.trim() === ${JSON.stringify(label)});
  return s?.querySelector('.an-sheet__stat-value')?.textContent.trim() ?? '(absent)';
})()`);
const search = () => evaluate('location.search');
await go('/statistiques', 4000);
await chip('Famille', 'Sans vent');
await waitFor(async () => (await search()).includes('famille=surf') && (await evaluate(`document.querySelector('.stats-selection__summary')?.textContent.includes('Sans vent')`)), { timeout: 3000, every: 50, label: 'famille Surf dans l\'adresse et le résumé' });
await chip('Période', 'Année');
await waitFor(async () => (await search()).includes('periode=annee'), { timeout: 3000, every: 50, label: 'période Année dans l\'adresse' });
await settle({ max: 800 });
const active = await stat('Semaines actives');
const weeks = Number(active.split('/')[1]);
check('Surf sur « Année » : semaines comptées depuis la session de surf', weeks >= 1 && weeks <= 3, active);

// --- 4. Dernier affichage ---
await go('/', 3000);
await go('/statistiques', 4000);
check('reprise sans paramètre : Surf, Année', (await search()) === '?famille=surf&periode=annee', await search());
check('titre de Surf', (await evaluate(`document.querySelector('.ui-page-header')?.innerText ?? ''`)).includes('Sans vent'));
await go('/statistiques?famille=voile', 4000);
check('une adresse avec paramètres l’emporte', (await search()) === '?famille=voile', await search());
await chip('Famille', 'Tout');
await wait(500);
await chip('Période', 'Tout');
await wait(500);
await go('/', 3000);
await go('/statistiques', 4000);
check('« Tout » retenu : pas de paramètre', (await search()) === '', await search());

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
console.log(failures === 0 ? '\nTout passe.' : `\n${failures} échec(s).`);
await close();
process.exit(failures === 0 ? 0 : 1);
