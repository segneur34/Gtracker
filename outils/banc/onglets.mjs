// Banc de test : onglets choisis par activité, et « tops » (lot 3 des demandes du 14/10, seconde série ; remis sur la voile
// et le surf au lot 330).
// Usage : node onglets.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 2 min. Le script :
//  1. importe une session de wingfoil, une de kite et une de surf (`lib/traces.mjs`), ouvre tous les onglets de chaque
//     analyse et, avec `DUMP=x`, relève leur texte dans `x-wingfoil.txt`, `x-kite.txt` et `x-surf.txt` ; avec
//     `RELEVE_SEUL=1`, il s'arrête là (pour la version d'avant un lot) ;
//  2. dans Réglages, partie Onglet analyse : la ligne « Onglets » du Wingfoil, du Kite, du Surf et du Surf foil, ses
//     défauts (« tops » montré en voile, pas en surf ; « vols » et « pumping » sur foil seulement) ;
//  3. « tops » et « vagues » changés en surf, « tops » caché en kite, « vmg » caché en wingfoil, rangés par activité ;
//  4. le surf : « tops » entre « rame » et « graphiques », « vagues » absent même laissé ouvert, le tableau, « Voir »
//     puis « Masquer », surbrillance effacée quand l'onglet se ferme ; le wingfoil : « tops » et ses distances, « tout
//     fermer » après la flèche (tout fermé, « avancé » tel quel), puis la même session rouverte sans `lib/onglets.mjs` :
//     « général » seul, « avancé » fermé (05/11) ; le kite sans « tops » ; ni onglet ni panneau VMG en wingfoil ;
//  5. à 390×844 : Réglages et l'analyse de surf sans débordement ;
//  6. « Par défaut » (menu « … ») de la carte Surf : choix effacés, « tops » de nouveau caché, les autres gardés.
import { writeFileSync } from 'node:fs';
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node onglets.mjs <port> [<dossier des captures>]');
  process.exit(1);
}
const DUMP = process.env.DUMP;
const RELEVE_SEUL = process.env.RELEVE_SEUL === '1';

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, check, finish, logs, close } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
const tabLabels = () => evaluate(`[...document.querySelectorAll('.an-carte-col .ui-tab')].map((t) => t.textContent.trim()).join(' | ')`);
/** Ouvre un onglet s'il est fermé, le ferme s'il est ouvert et que `close` le demande. */
const clickTab = (label, close = false) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  const isOpen = t.getAttribute('aria-pressed') === 'true';
  if (isOpen !== ${close}) return isOpen ? 'déjà ouvert' : 'déjà fermé';
  t.click(); return 'ok';
})()`);
const openAllTabs = () => evaluate(`(() => {
  const tabs = [...document.querySelectorAll('.an-carte-col .ui-tab')].filter((t) => t.getAttribute('aria-pressed') !== 'true');
  tabs.forEach((t) => t.click());
  return tabs.length;
})()`);
/** Texte du panneau d'analyse dont le titre commence ainsi. */
const panel = (title) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}));
  return t ? t.closest('.an-carte-panels > *').innerText.replace(/\\n+/g, ' / ') : '(absent)';
})()`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
let ongletsId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS })).result.identifier;
await blockNetwork(['*://*.openstreetmap.org/*']);

// --- Sessions synthétiques : la matinée de surf [durée en s, vitesse en m/s, cap], un wingfoil et un kite ---
const MORNING = [
  [60, 0], [60, 1.2], [50, 1], [4, 0.1], [40, 1], [4, 0.1], [26, 1], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1],
  [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1],
  [5, 1.6, 180], [8, 4.5, 190], [80, 1], [30, 0.1],
];
const T_WING = Date.UTC(2026, 8, 20, 13, 0, 0);
const T_KITE = Date.UTC(2026, 9, 2, 8, 0, 0);
const T_SURF = Date.UTC(2026, 9, 3, 7, 0, 0);
const SESSIONS = [
  { cle: 'wingfoil', page: 'voile', start: T_WING, gpx: traceVoile({ debutMs: T_WING, type: 'wingfoil', bords: 2, virageMin: 3 }) },
  { cle: 'kite', page: 'voile', start: T_KITE, gpx: traceVoile({ debutMs: T_KITE, type: 'kite', bords: 2, virageMin: 3, nom: 'Kite' }) },
  { cle: 'surf', page: 'surf', start: T_SURF, gpx: traceSurf({ debutMs: T_SURF, phases: MORNING, nom: 'Matinée' }) },
];

// --- 1. Import et relevé ---
const paths = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.cle} :`, await importGpx(s.gpx, `${s.cle}.gpx`));
  await waitFor(async () => (await records())?.some((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 8000, label: `fiche ${s.cle}` });
  await settle({ max: 2000, label: `import ${s.cle}` });
  const rec = (await records()).find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000);
  paths[s.cle] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.cle} rangée`, Boolean(rec));
}
for (const s of SESSIONS) {
  await go(paths[s.cle], 6000);
  console.log(`${s.cle}, onglets :`, await tabLabels());
  console.log('  ouverts :', await openAllTabs());
  await settle({ max: 5000 });
  if (DUMP) writeFileSync(`${DUMP}-${s.cle}.txt`, await evaluate('document.body.innerText'));
}
if (RELEVE_SEUL) {
  console.log('\n--- console (erreurs, avertissements) ---');
  logs.forEach((l) => console.log(l));
  await close();
  process.exit(0);
}

// --- 2. Réglages : la ligne « Onglets » ---
const CARDS = { Wingfoil: 'wingfoil', Kite: 'kite', Surf: 'surf', 'Surf foil': 'a-surf-foil' };
const openSettings = async () => {
  await go('/parametres', 3000);
  await evaluate(`(() => {
    const sections = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}');
    sections.settings = { ...sections.settings, activites: true };
    sections['settings-activities'] = ${JSON.stringify(Object.fromEntries(Object.values(CARDS).map((k) => [k, true])))};
    sections['settings-activity-parts'] = { analyse: true };
    sections['settings-families'] = { voile: true, surf: true };
    localStorage.setItem('${CLES.sections}', JSON.stringify(sections));
    return 'ok';
  })()`);
  await go('/parametres', 3000);
};
const nameSelector = '.settings-activity__name';
const card = (name) => `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector(${JSON.stringify(nameSelector)})?.textContent === ${JSON.stringify(name)})`;
const tabsRow = (name) => `[...(${card(name)}?.querySelectorAll('.settings-row') ?? [])].find((r) => r.querySelector('.settings-row__label')?.textContent.trim() === 'Onglets')`;
/** Pastilles de la ligne « Onglets » : « libellé » enfoncé, « (libellé) » relâché. */
const pills = (name) => evaluate(`(() => {
  const row = ${tabsRow(name)};
  if (!row) return '(pas de ligne)';
  return [...row.querySelectorAll('.ui-tab')].map((b) => b.getAttribute('aria-pressed') === 'true' ? b.textContent.trim() : '(' + b.textContent.trim() + ')').join(' ');
})()`);
const pressPill = (name, label) => evaluate(`(() => {
  const b = [...(${tabsRow(name)}?.querySelectorAll('.ui-tab') ?? [])].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const rowMark = (name) => evaluate(`${tabsRow(name)}?.querySelector('.settings-sports__mark')?.textContent ?? '(aucune)'`);
/** Choix rangés, relus avec leurs clés triées : l'ordre d'écriture ne compte pas. */
const triee = (valeur) => JSON.stringify(valeur, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
const storedTabs = async () => triee(JSON.parse(await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}').tabs ?? null)`)));

await openSettings();
const shown = {};
for (const name of Object.keys(CARDS)) {
  shown[name] = await pills(name);
  console.log(`${name} :`, shown[name], '·', await rowMark(name));
}
check('Wingfoil : tous montrés, « tops », « sauts », « vols » et « pumping » compris', shown.Wingfoil === 'général tops manœuvres graphiques cardio vmg sauts vols pumping vent matos et conditions réglages', shown.Wingfoil);
check('Kite : « tops » et « sauts » montrés, ni « vols » ni « pumping »', / tops /.test(` ${shown.Kite} `) && shown.Kite.includes('sauts') && !shown.Kite.includes('vols') && !shown.Kite.includes('pumping'), shown.Kite);
check('Surf : « tops » relâché, ni « vols » ni « pumping »', shown.Surf.includes('(tops)') && !shown.Surf.includes('vols') && !shown.Surf.includes('pumping'), shown.Surf);
check('Surf foil : « vols » puis « pumping »', shown['Surf foil'].includes('vols pumping'), shown['Surf foil']);
check('« défaut » sans choix', (await rowMark('Surf')) === 'défaut');

// --- 3. Choix ---
console.log('Surf, tops :', await pressPill('Surf', 'tops')); await wait(300);
console.log('Surf, vagues :', await pressPill('Surf', 'vagues')); await wait(300);
console.log('Kite, tops :', await pressPill('Kite', 'tops')); await wait(300);
console.log('Wingfoil, vmg :', await pressPill('Wingfoil', 'vmg')); await wait(500);
const stored = await storedTabs();
console.log('rangés :', stored);
check('choix rangés par activité', stored === triee({ surf: { tops: true, vagues: false }, kite: { tops: false }, wingfoil: { vmg: false } }), stored);
check('Surf : « défaut » retiré', (await rowMark('Surf')) === '(aucune)');
console.log('Surf :', await pills('Surf'));
await shoot('onglets-reglages');

// --- 4. Analyses ---
await go(paths.surf, 6000);
const surfTabs = await tabLabels();
console.log('\nsurf, onglets :', surfTabs);
check('surf : « tops » entre « rame » et « graphiques », sans « vagues »', /rame \| tops \| graphiques/.test(surfTabs) && !/vagues/.test(surfTabs), surfTabs);
// Ouvert au relevé du point 1 : l'application ne le retient plus (05/11), le banc le rejoue (`lib/onglets.mjs`).
const memorized = await evaluate(`JSON.parse(localStorage.getItem('banc.onglets') ?? '{}').surf?.vagues`);
check(`« vagues » laissé ouvert (${memorized}), son panneau absent`, memorized === true && (await panel('Vagues')) === '(absent)');
console.log('tops :', await clickTab('tops'));
await settle({ max: 1500 });
const surfTops = await panel('Meilleurs segments');
console.log('panneau :', surfTops.slice(0, 400));
check('surf : tableau des tops, 2 s à 10 km', /Sur\s+1er \(km\/h\)/.test(surfTops) && /2 s/.test(surfTops) && /10 km/.test(surfTops), surfTops.slice(0, 200));
const voir = () => evaluate(`(() => {
  const p = [...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith('Meilleurs segments'))?.closest('.an-carte-panels > *');
  const b = [...(p?.querySelectorAll('button') ?? [])].find((x) => !x.disabled && /Voir|Masquer/.test(x.textContent));
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const shownButtons = () => evaluate(`[...document.querySelectorAll('.an-carte-panels button')].filter((b) => b.textContent.trim() === 'Masquer').length`);
const highlightPaths = () => evaluate(`document.querySelectorAll('.leaflet-overlay-pane path[stroke-width="10"]').length`);
const before = await highlightPaths();
console.log('Voir :', await voir()); await settle({ max: 800 });
const during = await highlightPaths();
console.log(`traits épais sur la carte : ${before} → ${during}`);
check('« Voir » : « Masquer », podium tracé', (await shownButtons()) === 1 && during > before, `${await shownButtons()} ; ${before} → ${during}`);
await shoot('onglets-surf-tops');
console.log('fermer tops :', await clickTab('tops', true)); await wait(500);
check('onglet fermé : surbrillance effacée', (await highlightPaths()) === before);
console.log('rouvrir tops :', await clickTab('tops')); await settle({ max: 800 });
check('rouvert : rien de ramené', (await shownButtons()) === 0);

await go(paths.wingfoil, 6000);
const wingTabs = await tabLabels();
console.log('\nwingfoil, onglets :', wingTabs);
// « avancé » entre « général » et les autres onglets (22/10).
check('wingfoil : « tops » juste après « général · avancé »', /^général \| avancé \| tops \|/.test(wingTabs), wingTabs);
check('wingfoil : ni onglet ni panneau VMG', !/vmg/.test(wingTabs) && (await panel('Analyse VMG')) === '(absent)', wingTabs);
console.log('tops :', await clickTab('tops'));
await settle({ max: 1500 });
const wingTops = await panel('Meilleurs segments');
console.log('panneau :', wingTops.slice(0, 500));
check('wingfoil : tableau des tops, des 2 s aux distances', /Sur\s+1er/.test(wingTops) && /2 s/.test(wingTops) && /\d\s?(m|km|NM)\b/.test(wingTops), wingTops.slice(0, 300));

// « tout fermer » (05/11) : après la flèche qui cache la barre ; ferme chaque onglet, « général » compris, « avancé » tel quel.
const firstRow = () => evaluate(`[...(document.querySelector('.an-tabs > .ui-tabs')?.children ?? [])].map((b) => b.classList.contains('an-tabs-hide') ? '(flèche)' : b.textContent.trim()).join(' | ')`);
const pressedTabs = () => evaluate(`[...document.querySelectorAll('.an-tabs [aria-pressed="true"]')].map((t) => t.textContent.trim()).join(', ')`);
const advancedState = () => evaluate(`document.querySelector('.an-tabs-advanced-toggle')?.getAttribute('aria-expanded') ?? '(absent)'`);
const row1 = await firstRow();
console.log('première rangée :', row1, '· ouverts :', await pressedTabs());
check('« tout fermer » juste après la flèche', /^général \| avancé \| \(flèche\) \| tout fermer$/.test(row1), row1);
const advancedBefore = await advancedState();
console.log('tout fermer :', await evaluate(`(() => { const b = document.querySelector('.an-tabs-close-all'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await settle({ max: 1000 });
check('« tout fermer » : plus aucun onglet ouvert', (await pressedTabs()) === '', await pressedTabs());
check('« tout fermer » : aucun panneau', (await evaluate(`document.querySelectorAll('.an-carte-panels > *').length`)) === 0);
check(`« tout fermer » : « avancé » inchangé (${advancedBefore})`, (await advancedState()) === advancedBefore);
// « tout ouvrir » : sans onglet ouvert, le bouton le propose ; il ouvre tous les onglets montrés, déplie « avancé », puis redevient « tout fermer ».
const bulkLabel = () => evaluate(`document.querySelector('.an-tabs-open-all, .an-tabs-close-all')?.textContent.trim() ?? '(absent)'`);
check('« tout ouvrir » proposé quand rien n\'est ouvert', (await bulkLabel()) === 'tout ouvrir', await bulkLabel());
console.log('tout ouvrir :', await evaluate(`(() => { const b = document.querySelector('.an-tabs-open-all'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await settle({ max: 1000 });
check('« tout ouvrir » : « avancé » déplié', (await advancedState()) === 'true', await advancedState());
check('« tout ouvrir » : tous les onglets montrés ouverts', (await evaluate(`(() => { const b = [...document.querySelectorAll('.an-tabs [aria-pressed]')]; return b.length > 0 && b.every((x) => x.getAttribute('aria-pressed') === 'true'); })()`)) === true, await pressedTabs());
check('« tout ouvrir » : le bouton redit « tout fermer »', (await bulkLabel()) === 'tout fermer', await bulkLabel());
// Réouverture de la même session sans le banc qui rejoue les onglets : « général » seul, « avancé » fermé (05/11).
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: ongletsId });
await go(paths.wingfoil, 6000);
check('réouverture : « général » seul', (await pressedTabs()) === 'général', await pressedTabs());
check('réouverture : « avancé » fermé', (await advancedState()) === 'false', await advancedState());
await evaluate(`(() => { document.querySelector('.an-tabs-advanced-toggle')?.click(); return 'ok'; })()`);
await settle({ max: 500 });
console.log('tops (avancé ouvert) :', await clickTab('tops'));
await settle({ max: 800 });
await go(paths.wingfoil, 6000);
check('même session rouverte après « tops » : « général » seul', (await pressedTabs()) === 'général', await pressedTabs());
ongletsId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS })).result.identifier;

await go(paths.kite, 7000);
const kiteTabs = await tabLabels();
console.log('\nkite, onglets :', kiteTabs);
check('kite : « tops » caché par le choix de l\'activité, « vmg » toujours là', !/tops/.test(kiteTabs) && /vmg/.test(kiteTabs), kiteTabs);

// --- 5. Téléphone ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await openSettings();
check(`à 390 px, Réglages : débordement ${await overflow()}`, (await overflow()) === 0);
await shoot('onglets-reglages-telephone');
await go(paths.surf, 6000);
await clickTab('tops'); await settle({ max: 1000 });
check(`à 390 px, surf avec « tops » : débordement ${await overflow()}`, (await overflow()) === 0);
await shoot('onglets-surf-telephone');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

// --- 6. « Par défaut » ---
await openSettings();
// Depuis le 27/10, « Par défaut » est une entrée du menu « … » de l'en-tête de la carte.
console.log('\nPar défaut :', await evaluate(`(async () => { const c = ${card('Surf')}; c?.querySelector('.settings-activity__head > .ui-more .ui-more__button')?.click(); await new Promise((r) => setTimeout(r, 200)); const b = [...(c?.querySelectorAll('.ui-more__panel button') ?? [])].find((x) => x.textContent.trim() === 'Par défaut'); if (!b) return 'absent'; if (b.disabled) return 'grisé'; b.click(); return 'ok'; })()`));
await wait(500);
const afterReset = await storedTabs();
console.log('rangés :', afterReset);
check('Surf effacé, les autres gardés', afterReset === triee({ kite: { tops: false }, wingfoil: { vmg: false } }), afterReset);
check('Surf : « défaut », « tops » relâché', (await rowMark('Surf')) === 'défaut' && (await pills('Surf')).includes('(tops)'));
await go(paths.surf, 6000);
const resetTabs = await tabLabels();
console.log('surf, onglets :', resetTabs);
check('surf : « vagues » revenu, « tops » parti', /vagues/.test(resetTabs) && !/tops/.test(resetTabs), resetTabs);

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
