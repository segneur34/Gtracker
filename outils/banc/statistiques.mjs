// Banc de test : la page des statistiques (lot 5 des demandes du 10-13/10, remise sur la voile et le surf, lot 330).
// Usage : node statistiques.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique neuf sessions (`lib/traces.mjs`) : cinq de wingfoil, deux de kite
// (sans activité créée pour lui) et deux de surf, datées en jours avant aujourd'hui, les importe par la page Voile, puis
// vérifie :
//  1. l'accès : « Statistiques » dans la barre du haut, qui ouvre la page ; plus de lien sur l'accueil ;
//  1 bis. les boutons glissants, repliés sous « Sélection » : replié au départ, le choix en cours affiché, ouvert et retenu
//     après rechargement ; pas de rangée d'activités sur « Tout » ; la flèche droite du clavier passe à la famille suivante ;
//  2. la vue d'ensemble : 9 sessions, une ligne par famille, pas de records, le graphique de la durée seule ;
//  3. la descente : Voile (7 sessions, graphique et records), 30 jours (2 sessions), le retour arrière qui remonte à la vue
//     d'ensemble ; les boutons d'activité de chaque famille (Voile : Wingfoil, Kite ; Surf) ;
//  4. le graphique : un point cliqué donne sa session, « Ouvrir » mène à son analyse ; les données proposées par famille
//     (voile : % de vol du wingfoil seul ; surf : vagues), chacune tracée ; le choix retenu après rechargement ; les fiches
//     au résumé à jour (distance en action) ;
//  5. une famille cachée (Surf) : absente des pastilles et des totaux, sa page ouverte par l'adresse le dit ;
//  5b. une session de wingfoil ouverte dans son analyse : la réussite de ses manœuvres rangée dans sa fiche, et « % de
//     manœuvres réussies » tracé en deux séries, avec sa légende (empannage en rond, virement en triangle), les autres
//     sessions de voile restant « à rouvrir » ;
//  6. à 390×844 et 320×640 : rien ne déborde ; la case « Statistiques » de la barre du bas ouvre la page, allumée.
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node statistiques.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, records: sessionRecords, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

// --- Sessions synthétiques : 21 min de voile (deux bords de chaque sorte de `traceVoile`) ou un matin de surf, à 10 h du jour voulu ---
const day = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
};
// [durée en s, vitesse en m/s, cap] : une rame, deux vagues, une attente.
const SURF = [[60, 1.2], [200, 1], [6, 1.6, 180], [12, 5, 200], [100, 1], [6, 1.5, 180], [10, 4.5, 190], [60, 0.1]];
const SESSIONS = [
  ['wingfoil', 345], ['wingfoil', 226], ['wingfoil', 219], ['wingfoil', 16], ['wingfoil', 2],
  ['kite', 92], ['kite', 40],
  ['surf', 55], ['surf', 9],
];
const gpxOf = (type, daysAgo) => (type === 'surf'
  ? traceSurf({ debutMs: day(daysAgo), phases: SURF, nom: `${type} ${daysAgo}` })
  : traceVoile({ debutMs: day(daysAgo), type, nom: `${type} ${daysAgo}`, bords: 2, virageMin: 3 }));

/** Clique l'élément dont le texte (ou l'étiquette) commence par `text`. */
const click = (selector, text) => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => (el.getAttribute('aria-label') ?? el.textContent).trim().startsWith(${JSON.stringify(text)}));
  if (!b || b.disabled) return false;
  b.click();
  return true;
})()`);
/** Valeur d'un chiffre du panneau Général (`an-sheet__stat`) par son libellé. */
const stat = (label) => evaluate(`(() => {
  const s = [...document.querySelectorAll('.an-sheet__stat')].find((el) => el.querySelector('.an-sheet__stat-label')?.textContent === ${JSON.stringify(label)});
  return s?.querySelector('.an-sheet__stat-value')?.textContent ?? null;
})()`);
const tabs = () => evaluate(`[...document.querySelectorAll('.stats-col > .ui-tabs .ui-tab')].map((b) => b.textContent).join(', ')`);
/** Choix d'une rangée : pastilles de la donnée du graphique, boutons glissants de la sélection. */
const rowButtons = (label) => label === 'Donnée'
  ? `.stats-chips[aria-label=${JSON.stringify(label)}] .ui-tab`
  : `.ui-segmented[aria-label=${JSON.stringify(label)}] [role=radio]`;
const chips = (label) => evaluate(`[...document.querySelectorAll(${JSON.stringify(rowButtons(label))})].map((b) => b.textContent).join(', ')`);
const search = () => evaluate('location.pathname + location.search');
const points = () => evaluate(`document.querySelectorAll('.recharts-scatter-symbol').length`);
const pressed = (label) => evaluate(`[...document.querySelectorAll(${JSON.stringify(rowButtons(label))})].find((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true')?.textContent ?? null`);
// Seul l'axe vertical a une étiquette ; Recharts la pose dans une couche à part, hors du groupe de l'axe.
const yLabel = () => evaluate(`document.querySelector('.recharts-label')?.textContent ?? null`);
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
/** Ouvre un onglet de la page s'il est fermé. */
const openTab = (label) => evaluate(`(() => {
  const b = [...document.querySelectorAll('.stats-col > .ui-tabs .ui-tab')].find((el) => el.textContent === ${JSON.stringify(label)});
  if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
  return !!b;
})()`);

// --- Mise en place ---
await go('/voile', 5000);
await waitFor(`Boolean(document.querySelector('input[type=file][accept*=".gpx"]'))`, { timeout: 3000, every: 50 });
console.log('import :', await evaluate(`(() => {
  const input = document.querySelector('input[type=file][accept*=".gpx"]');
  if (!input) return 'absent';
  const dt = new DataTransfer();
  for (const [name, text] of ${JSON.stringify(SESSIONS.map(([type, d]) => [`${type}-${d}.gpx`, gpxOf(type, d)]))}) {
    dt.items.add(new File([text], name, { type: 'application/gpx+xml' }));
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`));
await waitFor(async () => (await sessionRecords())?.length === SESSIONS.length, { timeout: 15000, label: 'fiches' });
await settle({ max: 2000, label: 'import' });

// 1. Accès.
await go('/');
check('lien dans la barre du haut', (await evaluate(`document.querySelector('.shell-toplinks')?.textContent`))?.includes('Statistiques'));
check('plus de lien sur l\'accueil (demande du 19/10)', !(await evaluate(`[...document.querySelectorAll('.shell-main a')].some((a) => a.textContent.trim().startsWith('Statistiques'))`)));
check('lien de la barre du haut', await click('.shell-toplinks a', 'Statistiques'));
await settle({ max: 1500 });
check('le lien ouvre la page', (await search()) === '/statistiques', await search());

// 1 bis. Boutons glissants, sous « Sélection ».
const selection = `document.querySelector('.stats-choice button[data-chart-fold]')`;
check('« Sélection » replié au départ, le choix en cours affiché', (await evaluate(`${selection}?.getAttribute('aria-expanded')`)) === 'false'
  && (await evaluate(`${selection}?.textContent`))?.includes('Toutes les familles · depuis le début')
  && (await chips('Famille')) === '', await evaluate(`${selection}?.textContent`));
await evaluate(`${selection}.click()`);
await wait(400);
await waitFor(`${selection}?.getAttribute('aria-expanded') === 'true'`, { timeout: 3000, every: 50, label: 'sélection ouverte' });
await go('/statistiques');
// Le choix retenu est relu de la mémoire après le premier rendu : l'attendre, sous charge il peut suivre `go`.
await waitFor(`${selection}?.getAttribute('aria-expanded') === 'true'`, { timeout: 3000, every: 50, label: 'sélection relue' });
check('« Sélection » ouvert, retenu après rechargement', (await evaluate(`${selection}?.getAttribute('aria-expanded')`)) === 'true');
check('rangée des familles : Tout, Voile, Surf', (await chips('Famille')) === 'Tout, Voile, Surf', await chips('Famille'));
check('« Tout » choisi, pas de rangée d\'activités', (await pressed('Famille')) === 'Tout' && (await chips('Activité')) === '', `${await pressed('Famille')} ; ${await chips('Activité')}`);
check('rangée des périodes, « Tout » choisi', (await chips('Période')) === 'Semaine, 30 jours, 6 mois, Année, Tout' && (await pressed('Période')) === 'Tout', await chips('Période'));
check('case blanche sous le choix', await evaluate(`(() => {
  const row = document.querySelector('.ui-segmented[aria-label="Famille"]');
  const thumb = row?.querySelector('.ui-segmented__thumb')?.getBoundingClientRect();
  const on = row?.querySelector('[aria-checked=true]')?.getBoundingClientRect();
  return !!thumb && !!on && Math.abs(thumb.left - on.left) < 1 && Math.abs(thumb.width - on.width) < 1;
})()`));
await evaluate(`document.querySelector('.ui-segmented[aria-label="Famille"] [aria-checked=true]').focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await settle({ max: 800 });
const keyed = await pressed('Famille');
check('flèche droite : famille suivante (Voile), rangée d\'activités', keyed === 'Voile' && (await chips('Activité'))?.startsWith('Toutes, ')
  && (await evaluate(`document.activeElement?.getAttribute('aria-checked')`)) === 'true', `${keyed} ; ${await chips('Activité')}`);
await evaluate('history.back()');
await settle({ max: 800 });

// 2. Vue d'ensemble.
check('9 sessions', (await stat('Sessions')) === '9', await stat('Sessions'));
const backdrop = () => evaluate(`document.querySelector('.page-backdrop')?.getAttribute('class')`);
// Fond (lot 3 du 23/10) : dans « Tout », le motif du sport préféré (sept sessions de voile sur neuf) ; dans une famille, celui de la famille choisie.
check('« Tout » : fond de la voile, la famille du sport préféré', (await backdrop()) === 'page-backdrop page-backdrop--voile', await backdrop());
check('onglets de la vue d\'ensemble', (await tabs()) === 'général, graphique, régularité', await tabs());
check('graphique de la vue d\'ensemble : la durée seule, sans pastilles', (await chips('Donnée')) === '' && (await points()) === 9 && (await yLabel()) === 'min',
  `${await chips('Donnée')} ; ${await points()} ; ${await yLabel()}`);
const familyRows = await evaluate(`[...document.querySelectorAll('.stats-rows .stats-row__name')].map((e) => e.textContent).join(', ')`);
check('une ligne par famille', familyRows === 'Voile, Surf', familyRows);
check('pas de distance mêlée', (await stat('Distance')) === null);
check('régularité', (await stat('Semaines actives')) !== null && (await evaluate(`!!document.querySelector('.recharts-bar')`)));
await shoot('stats-ensemble');

// 3. Descente.
await click('.ui-segmented[aria-label="Famille"] [role=radio]', 'Voile');
await settle({ max: 800 });
check('famille dans l\'adresse', (await search()) === '/statistiques?famille=voile', await search());
check('Voile : 7 sessions', (await stat('Sessions')) === '7', await stat('Sessions'));
check('Voile : fond de la famille', (await backdrop()) === 'page-backdrop page-backdrop--voile', await backdrop());
check('onglets d\'une famille', (await tabs()) === 'général, graphique, régularité, records', await tabs());
check('vitesse max, distance et temps en action', (await stat('Vitesse max')) !== null && (await stat('Distance')) !== null && (await stat('Temps en action')) !== null,
  `${await stat('Vitesse max')} ; ${await stat('Distance')} ; ${await stat('Temps en action')}`);
check('graphique : la vitesse max par défaut, 7 points', (await pressed('Donnée')) === 'Vitesse max' && (await points()) === 7, `${await pressed('Donnée')} ; ${await points()}`);
await openTab('records');
await wait(500);
const records = await evaluate(`[...document.querySelectorAll('.stats-records__title')].map((e) => e.textContent).join(', ')`);
check('records de la voile', records === 'Vitesse max, Distance, Durée', records);
check('trois par record', (await evaluate(`document.querySelector('.stats-records ol')?.children.length`)) === 3);
await shoot('stats-voile');

await click('.ui-segmented[aria-label="Période"] [role=radio]', '30 jours');
await settle({ max: 800 });
check('30 jours : 2 sessions', (await stat('Sessions')) === '2', await stat('Sessions'));
check('période dans l\'adresse', (await search()) === '/statistiques?famille=voile&periode=trente', await search());
check('le sous-titre porte le choix', (await evaluate(`document.querySelector('.ui-page-header')?.textContent`))?.includes('Voile · 30 jours'),
  await evaluate(`document.querySelector('.ui-page-header')?.textContent`));
await evaluate('history.back()');
await settle({ max: 1000 });
check('retour arrière : vue d\'ensemble', (await search()) === '/statistiques' && (await stat('Sessions')) === '9', `${await search()} ; ${await stat('Sessions')}`);

await go('/statistiques?famille=voile');
await settle({ max: 800 });
const voile = await chips('Activité');
check('activités de la voile : Wingfoil et Kite, sessions ou non', voile?.startsWith('Toutes, Wingfoil') && voile.includes('Kite'), voile);
await click('.ui-segmented[aria-label="Activité"] [role=radio]', 'Kite');
await settle({ max: 800 });
check('Kite : 2 sessions', (await stat('Sessions')) === '2' && (await search())?.includes('activite='), `${await stat('Sessions')} ; ${await search()}`);
await click('.ui-segmented[aria-label="Activité"] [role=radio]', 'Wingfoil');
await settle({ max: 800 });
check('Wingfoil : 5 sessions', (await stat('Sessions')) === '5', await stat('Sessions'));
await click('.ui-segmented[aria-label="Famille"] [role=radio]', 'Surf');
await settle({ max: 800 });
const surfActivites = await chips('Activité');
check('activités du surf : Surf en tête', surfActivites?.startsWith('Toutes, Surf'), surfActivites);
check('Surf : 2 sessions, fond de la famille', (await stat('Sessions')) === '2' && (await backdrop()) === 'page-backdrop page-backdrop--surf', `${await stat('Sessions')} ; ${await backdrop()}`);

// 4. Un point du graphe : en surf, pour que l'analyse ouverte ne range pas la réussite d'une session de voile (5b).
await go('/statistiques?famille=surf');
await openTab('graphique');
await wait(500);
const clicked = await evaluate(`(() => {
  const pts = document.querySelectorAll('.recharts-scatter-symbol');
  const last = pts[pts.length - 1];
  if (!last) return false;
  (last.querySelector('path') ?? last).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
})()`);
await wait(500);
const picked = await evaluate(`document.querySelector('.stats-picked .stats-row')?.textContent ?? null`);
check('point cliqué : sa session', clicked && picked?.includes('Ouvrir'), picked);
if (picked) {
  await click('.stats-picked .stats-row', '');
  await settle({ max: 2500 });
  check('« Ouvrir » mène à l\'analyse du surf', (await search())?.startsWith('/surf/analyse?session='), await search());
}

// 4b. Les données du graphique.
const fiches = await sessionRecords();
check('fiches au résumé à jour, distance en action', fiches.length === SESSIONS.length && fiches.every((r) => r.summary.calcVersion >= 5 && typeof r.summary.movingDistanceM === 'number'),
  fiches.map((r) => `${r.summary.calcVersion}/${r.summary.movingDistanceM}`).join(' '));
// Par la pastille de la famille, pour que l'affichage soit retenu (la dernière vue retenue est celle de la session ouverte).
await go('/statistiques');
await click('.ui-segmented[aria-label="Famille"] [role=radio]', 'Voile');
await settle({ max: 800 });
await openTab('graphique');
const voileChips = await chips('Donnée');
check('données de la voile', voileChips === 'Vitesse max, Moyenne en action, Durée, Distance, % de vol', voileChips);
// Vitesses en nœuds, distances en km (réglages des supports).
for (const [chip, label] of [['Moyenne en action', 'nœuds'], ['Durée', 'min'], ['Distance', 'km']]) {
  await click('.stats-chips[aria-label="Donnée"] .ui-tab', chip);
  await wait(500);
  check(`voile, ${chip} : 7 points, axe en ${label}`, (await points()) === 7 && (await yLabel()) === label, `${await points()} ; ${await yLabel()}`);
}
await go('/statistiques', 3000);
check('choix retenu après rechargement', (await search()) === '/statistiques?famille=voile' && (await pressed('Donnée')) === 'Distance',
  `${await search()} ; ${await pressed('Donnée')}`);
await click('.ui-segmented[aria-label="Famille"] [role=radio]', 'Surf');
await settle({ max: 800 });
check('surf : pas de distance de la voile, la vitesse max à sa place', (await pressed('Donnée')) === 'Distance' || (await pressed('Donnée')) === 'Vitesse max', await pressed('Donnée'));
const surfChips = await chips('Donnée');
check('données du surf (sans foil)', surfChips === 'Vitesse max, Moyenne en action, Durée, Distance, Vagues, Plus longue vague', surfChips);
await click('.stats-chips[aria-label="Donnée"] .ui-tab', 'Vagues');
await wait(500);
check('surf, Vagues : 2 points', (await points()) === 2, String(await points()));
await click('.stats-chips[aria-label="Donnée"] .ui-tab', 'Vitesse max');
await wait(300);
await click('.ui-segmented[aria-label="Famille"] [role=radio]', 'Voile');
await settle({ max: 800 });
await click('.stats-chips[aria-label="Donnée"] .ui-tab', '% de vol');
await wait(500);
check('% de vol : le wingfoil seul (kite sans foil), axe en %', (await points()) === 5 && (await yLabel()) === '%', `${await points()} ; ${await yLabel()}`);
await shoot('stats-graphique');

// 5. Famille cachée : Surf, par les réglages de l'appareil.
await go('/statistiques');
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}');
  s.hiddenFamilies = ['surf'];
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
  // Sans paramètre, la page reprend le dernier affichage : on repart de la vue d'ensemble.
  localStorage.removeItem('${CLES.statistiques}');
})()`);
await go('/statistiques');
check('Surf caché : 7 sessions', (await stat('Sessions')) === '7', await stat('Sessions'));
check('Surf absent de la rangée des familles', (await chips('Famille')) === 'Tout, Voile', await chips('Famille'));
await go('/statistiques?famille=surf');
check('Surf par l\'adresse', (await stat('Sessions')) === '2' && (await evaluate(`document.querySelector('.shell-main').innerText.includes('cachée dans Réglages')`)),
  await stat('Sessions'));
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}');
  delete s.hiddenFamilies;
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
})()`);

// 5b. Réussite des manœuvres : une session de wingfoil ouverte dans son analyse, les six autres de la voile restent à rouvrir.
const voileRec = (await sessionRecords()).find((r) => r.sport === 'wingfoil' && Math.abs(r.summary.startMs - day(2)) < 2000);
check('wingfoil du jour 2 rangée, sans réussite avant l\'analyse', Boolean(voileRec) && voileRec.summary.maneuverResults === undefined);
await go('/statistiques?famille=voile');
await openTab('graphique');
check('pas de réussite tant qu\'aucune session n\'est ouverte', !(await chips('Donnée'))?.includes('réussies'), await chips('Donnée'));
await go(`/voile/analyse?session=${encodeURIComponent(voileRec?.gpx ?? '')}`, 8000);
await waitFor(async () => (await sessionRecords()).find((r) => r.gpx === voileRec?.gpx)?.summary.maneuverResults, { timeout: 4000, label: 'réussite rangée' });
const results = (await sessionRecords()).find((r) => r.gpx === voileRec?.gpx)?.summary.maneuverResults;
check('réussite rangée dans la fiche par l\'analyse', results && results.tackSuccess + results.tackFail > 0 && results.jibeSuccess + results.jibeFail > 0, JSON.stringify(results));
await go('/statistiques?famille=voile');
await click('.stats-chips[aria-label="Donnée"] .ui-tab', '% de manœuvres réussies');
await wait(600);
const note = await evaluate(`document.querySelector('.stats-picked')?.textContent ?? ''`);
check('réussite : deux points (virements, empannages), six sessions à rouvrir', (await points()) === 2 && note.includes('6 sessions à rouvrir'), `${await points()} ; ${note}`);
const legend = await evaluate(`[...document.querySelectorAll('.stats-legend__item')].map((i) => (i.querySelector('circle') ? '●' : i.querySelector('path') ? '▲' : '?') + ' ' + i.textContent.trim()).join(' · ')`);
check('légende : ● empannage (jibe) · ▲ virement (tack)', legend === '● empannage (jibe) · ▲ virement (tack)', legend);
// Recharts dessine le rond en arc (« A ») et le triangle en lignes seules : un point de chaque.
const symbols = await evaluate(`[...document.querySelectorAll('.recharts-scatter-symbol path')].map((p) => (p.getAttribute('d') ?? '').includes('A') ? 'rond' : 'triangle').sort().join(',')`);
check('graphe : un rond, un triangle', symbols === 'rond,triangle', symbols);
await click('.stats-chips[aria-label="Donnée"] .ui-tab', 'Durée');
await wait(400);
// Lot 16 (fiche 24) : en « Durée », la ligne pleine des heures par semaine s'ajoute au pointillé, avec sa légende seule.
const legendDuree = await evaluate(`[...document.querySelectorAll('.stats-legend__item')].map((i) => i.textContent.trim()).join(' · ')`);
check('légende en Durée : heures par semaine seule', legendDuree === 'heures par semaine', legendDuree);
const lignesDuree = await evaluate(`document.querySelectorAll('.recharts-line-curve').length`);
check('Durée : deux lignes (tendance pointillée, heures par semaine)', lignesDuree === 2, String(lignesDuree));
await click('.stats-chips[aria-label="Donnée"] .ui-tab', '% de manœuvres réussies');
await wait(400);
await shoot('stats-reussite');

// 6. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=voile');
for (const t of ['graphique', 'régularité', 'records']) await openTab(t);
await settle({ max: 800 });
check('390 px : rien ne déborde (famille)', !(await overflow()));
await shoot('stats-telephone');
await go('/statistiques');
check('390 px : rien ne déborde (ensemble)', !(await overflow()));
// 320 px : la rangée des familles défile en elle-même si elle ne tient pas, sans élargir la page.
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=surf');
const fit = await evaluate(`(() => {
  const row = document.querySelector('.ui-segmented[aria-label="Famille"]');
  const on = row?.querySelector('[aria-checked=true]')?.getBoundingClientRect();
  const box = row?.getBoundingClientRect();
  return { scroll: row ? row.scrollWidth - row.clientWidth : null, visible: !!on && !!box && on.left >= box.left - 1 && on.right <= box.right + 1 };
})()`);
check('320 px : rien ne déborde, le choix en vue', !(await overflow()) && fit?.visible, JSON.stringify(fit));
await shoot('stats-320');

await go('/');
const tab = (label) => `[...document.querySelectorAll('.shell-tabbar .shell-tab')].find((t) => t.textContent.trim() === ${JSON.stringify(label)})`;
check('barre du bas : case Statistiques', await evaluate(`!!${tab('Statistiques')}`));
await evaluate(`${tab('Statistiques')}.click()`);
await settle({ max: 1500 });
// La page reprend le dernier affichage : l'adresse peut porter des paramètres.
check('la case ouvre la page, allumée', (await search())?.startsWith('/statistiques')
  && (await evaluate(`${tab('Statistiques')}.classList.contains('active')`)));

// Ce script ne relève que les erreurs de console, pas les avertissements.
const errors = logs.filter((l) => !l.startsWith('warning:'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : aucune erreur');
await finish('Tout passe.');
