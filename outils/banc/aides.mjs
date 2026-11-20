// Banc de test : aides « ? » partout et barre du haut sans « Accueil » (lot 3 des demandes du 24/10).
// Usage : node aides.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau (tuiles bloquées). Dure environ 1 min. Le script :
//  1. importe une session de wingfoil et une de surf (`lib/traces.mjs`) ;
//  2. surf : aucune explication à l'ouverture des graphiques ; le « ? » du titre l'ouvre juste sous le titre,
//     sans replier le panneau ; celui des réglages referme le premier (une seule aide à la fois) ; un second appui
//     referme ;
//  3. voile : le « ? » des manœuvres, puis celui du vent, qui referme le premier ;
//  4. Statistiques : rien d'ouvert, la note du graphique sous son « ? » ; passer par Profil et revenir, par la barre,
//     referme l'aide (une aide ne survit pas à un changement de page) ;
//  5. barre du haut à 1400 et 1000 px (800 px relevé pour information) : Profil, Sessions, Planifier (vers la
//     liste des itinéraires, allumé aussi sur Planifier), Statistiques, Réglages, le logo qui mène au Profil, chaque lien sur une ligne ; l'application
//     s'ouvre sur le Profil ; au téléphone, barre du bas Profil, Sessions, Statistiques, Réglages, et pas de pop-up
//     du profil.
import { connect } from './lib/cdp.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node aides.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, close, logs } = await connect({ port, width: 1400, height: 1000, shotDir });

const clickTab = (label) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return false;
  t.click();
  return true;
})()`);
const advancedOpen = () => evaluate(`document.querySelector('.an-tabs-advanced-toggle')?.getAttribute('aria-expanded') === 'true'`);
const setAdvanced = async (wanted) => {
  if ((await advancedOpen()) !== wanted) await clickTab('avancé');
  await wait(400);
};
const setTab = (label, wanted) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  if ((t.getAttribute('aria-pressed') === 'true') !== ${wanted}) t.click();
  return 'ok';
})()`);
const panelOf = (title) => `[...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}))?.closest('.an-carte-panels > *')`;
const panel = async (title) => (await evaluate(`${panelOf(title)}?.innerText.replace(/\\n+/g, ' / ') ?? '(absent)'`));
let failures = 0;
const check = (what, ok, detail) => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${what}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) failures++; };

await blockNetwork();


// --- Sessions synthétiques : la voile du banc et une matinée de surf (`lib/traces.mjs`) ---
const T_VOILE = Date.UTC(2026, 9, 5, 13, 0, 0);
const T_SURF = Date.UTC(2026, 9, 6, 8, 0, 0);
const SURF_PHASES = [[60, 0], [120, 1.2], [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1], [5, 1.5, 180], [6, 6, 160], [40, 1], [30, 0.1]];
const SESSIONS = [
  { key: 'voile', page: 'voile', start: T_VOILE, gpx: traceVoile({ debutMs: T_VOILE, virageMin: 3 }) },
  { key: 'surf', page: 'surf', start: T_SURF, gpx: traceSurf({ debutMs: T_SURF, phases: SURF_PHASES, nom: 'Matinée' }) },
];

const paths = {};
for (const s of SESSIONS) {
  await go('/sessions', 3000);
  console.log(`import ${s.key} :`, await importGpx(s.gpx, `${s.key}.gpx`));
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 7000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  paths[s.key] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.key} rangée`, Boolean(rec));
}

const helpLabels = () => evaluate(`[...document.querySelectorAll('button.ui-help')].map((b) => b.getAttribute('aria-label'))`);
const openNotes = () => evaluate(`[...document.querySelectorAll('.help-note, .settings-help')].map((n) => n.textContent.replace(/\\s+/g, ' ').trim())`);
const clickHelp = async (label) => {
  const done = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button.ui-help')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(`Aide : ${label}`)});
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await wait(300);
  return done;
};
const text = () => evaluate(`document.body.innerText`);

// --- 2. Surf ---
await go(paths.surf, 7000);
await setAdvanced(true);
console.log('graphiques :', await setTab('graphiques', true));
await settle({ max: 1500 });
check("surf : pas d'explication à l'ouverture des graphiques", !(await text()).includes('Le survol déplace le repère') && (await openNotes()).length === 0, (await openNotes()).join(' | '));
check('surf : « ? » du titre des graphiques (« Vitesse »)', (await helpLabels()).includes('Aide : Vitesse'), (await helpLabels()).join(', '));
check("surf : le « ? » ouvre l'explication", (await clickHelp('Vitesse')) && (await openNotes()).length === 1 && (await openNotes())[0].startsWith('Le survol déplace le repère'), (await openNotes()).join(' | '));
check('surf : le panneau reste ouvert', (await panel('Vitesse')) !== '(absent)');
const placed = await evaluate(`(() => {
  const p = ${panelOf('Vitesse')};
  const note = p?.querySelector('.help-note');
  const chart = p?.querySelector('svg.recharts-surface');
  const title = p?.querySelector('[role=button]');
  if (!note || !chart || !title) return 'absent';
  const n = note.getBoundingClientRect(), c = chart.getBoundingClientRect(), t = title.getBoundingClientRect();
  return n.top >= t.bottom - 1 && n.bottom <= c.top + 1 ? 'ok' : JSON.stringify({ title: t.bottom, note: [n.top, n.bottom], chart: c.top });
})()`);
check("surf : l'explication sous le titre, avant les graphes", placed === 'ok', placed);
await shoot('aides-surf');
console.log('réglages :', await setTab('réglages', true));
await settle({ max: 800 });
check('surf : « ? » des réglages, qui referme le premier', (await clickHelp('Réglages de la session')) && (await openNotes()).length === 1 && (await openNotes())[0].startsWith('Vitesse :'), (await openNotes()).join(' | '));
check('surf : un second appui referme', (await clickHelp('Réglages de la session')) && (await openNotes()).length === 0, (await openNotes()).join(' | '));

// --- 3. Voile ---
await go(paths.voile, 7000);
await setAdvanced(true);
console.log('manœuvres :', await setTab('manœuvres', true));
console.log('vent :', await setTab('vent', true));
await settle({ max: 1500 });
check("voile : rien d'ouvert au départ", !(await text()).includes('Enregistrement :') && !(await text()).includes('Chaque virement et chaque empannage'), '');
check('voile : « ? » des manœuvres', (await clickHelp('Manœuvres')) && (await text()).includes('Enregistrement :'), (await helpLabels()).join(', '));
check('voile : « ? » du vent, qui referme celui des manœuvres', (await clickHelp('Variations du Vent')) && (await text()).includes('Chaque virement et chaque empannage') && !(await text()).includes('Enregistrement :'), '');
await shoot('aides-voile');

// --- 4. Statistiques, et changement de page ---
await go('/statistiques', 4000);
check("statistiques : rien d'ouvert", (await openNotes()).length === 0, (await openNotes()).join(' | '));
console.log('onglet graphique :', await evaluate(`(() => { const t = [...document.querySelectorAll('.ui-tab')].find((x) => x.textContent.trim() === 'graphique'); if (!t) return 'absent'; if (t.getAttribute('aria-pressed') !== 'true') t.click(); return 'ok'; })()`));
await settle({ max: 1200 });
check('statistiques : la note du graphique cachée', !(await text()).includes('Un point par session'), '');
check("statistiques : le « ? » du graphique l'ouvre", (await clickHelp('Graphique')) && (await text()).includes('Un point par session'), (await helpLabels()).join(', '));
const nav = (href) => evaluate(`(() => { const a = document.querySelector('.shell-toplinks a[href="${href}"]'); if (!a) return false; a.click(); return true; })()`);
console.log('vers Profil :', await nav('/profil'));
await settle({ max: 1200 });
console.log('retour aux Statistiques :', await nav('/statistiques'));
await settle({ max: 1500 });
check("changer de page referme l'aide", (await evaluate('location.pathname')) === '/statistiques' && !(await text()).includes('Un point par session') && (await openNotes()).length === 0, await evaluate('location.pathname'));

// --- 5. Barre du haut ---
const topLinks = () => evaluate(`[...document.querySelectorAll('.shell-toplinks a')].map((a) => a.textContent.trim())`);
check('ordinateur : plus de lien « Accueil » en haut', !(await topLinks()).includes('Accueil'), (await topLinks()).join(', '));
check('ordinateur : barre du haut Profil, Sessions, Planifier, Statistiques, Réglages', (await topLinks()).join(', ') === 'Profil, Sessions, Planifier, Statistiques, Réglages', (await topLinks()).join(', '));
check('ordinateur : « Planifier » mène à la liste des itinéraires, plus de bouton « Itinéraires » à part', (await evaluate(`[...document.querySelectorAll('.shell-toplinks a')].find((a) => a.textContent.trim() === 'Planifier')?.getAttribute('href')`)) === '/itineraires/liste' && (await evaluate(`document.querySelector('.shell-topplan') === null`)));
// « Planifier » est allumé sur la liste des itinéraires (sa page) et sur Planifier lui-même (qui s'ouvre depuis la liste).
const allume = () => evaluate(`[...document.querySelectorAll('.shell-toplinks a.active')].map((a) => a.textContent.trim()).join(', ')`);
console.log('vers la liste des itinéraires :', await nav('/itineraires/liste'));
await settle({ max: 1500 });
check('ordinateur : « Planifier » de la barre ouvre /itineraires/liste, seul allumé', (await evaluate('location.pathname')) === '/itineraires/liste' && (await allume()) === 'Planifier', `${await evaluate('location.pathname')} | ${await allume()}`);
await evaluate(`document.querySelector('a.ui-tab--action[href="/itineraires"]')?.click()`);
await settle({ max: 1500 });
check('ordinateur : sur Planifier (/itineraires), « Planifier » de la barre reste seul allumé', (await evaluate('location.pathname')) === '/itineraires' && (await allume()) === 'Planifier', `${await evaluate('location.pathname')} | ${await allume()}`);
console.log('retour aux Statistiques :', await nav('/statistiques'));
await settle({ max: 1500 });
check('ordinateur : le logo mène au Profil', (await evaluate(`document.querySelector('.shell-brand')?.getAttribute('href')`)) === '/profil', await evaluate(`document.querySelector('.shell-brand')?.getAttribute('href')`));
for (const width of [1400, 1000, 800]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
  await wait(600);
  const bar = await evaluate(`(() => {
    // Une ligne : chaque lien garde la hauteur d'une seule ligne de texte ; rien ne sort de l'écran.
    const links = [...document.querySelectorAll('.shell-toplinks a')];
    const heights = links.map((a) => a.getBoundingClientRect().height);
    const all = [...links, ...document.querySelectorAll('.shell-toprecord')];
    const cut = all.filter((a) => a.scrollWidth > a.clientWidth + 1 || a.getBoundingClientRect().right > document.documentElement.clientWidth).map((a) => a.textContent.trim());
    return { spread: Math.max(...heights) - Math.min(...heights), cut, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  // 800 px : relevé seulement ; la barre n'y tient pas forcément (cinq liens et le bouton « Enregistrer »).
  if (width < 1000) console.log(`${width} px, pour information :`, JSON.stringify(bar));
  else check(`${width} px : liens de la barre du haut sur une ligne, aucun coupé`, bar.spread <= 1 && bar.cut.length === 0 && bar.overflow === 0, JSON.stringify(bar));
  await shoot(`aides-barre-${width}`);
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/', 2500);
check("ouverture : « / » mène au Profil", (await evaluate('location.pathname')) === '/profil', await evaluate('location.pathname'));
const tabs = await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((a) => a.textContent.trim())`);
check('téléphone : barre du bas Profil, Sessions, Statistiques, Réglages (le bouton rond au milieu)', tabs.join(', ') === 'Profil, Sessions, Statistiques, Réglages', tabs.join(', '));
check('navigateur : pas de pop-up du profil (téléphone seulement)', await evaluate(`document.querySelector('.profile-prompt') === null`));

console.log('\n--- console (erreurs, avertissements) ---');
for (const l of logs) console.log(l);
console.log(failures === 0 ? '\nTout passe.' : `\n${failures} échec(s).`);
await close();
process.exit(failures === 0 ? 0 : 1);
