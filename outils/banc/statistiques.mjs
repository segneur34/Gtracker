// Banc de test : la page des statistiques (lot 5 des demandes du 10-13/10, remise sur la voile et le surf, lot 330).
// Usage : node statistiques.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique neuf sessions (`lib/traces.mjs`) : cinq de wingfoil, deux de kite
// (sans activité créée pour lui) et deux de surf, datées en jours avant aujourd'hui, les importe par la page Sessions, puis
// vérifie :
//  1. l'accès : « / » mène au Profil ; « Statistiques » dans la barre du haut (Profil, Sessions, Planifier, Statistiques,
//     Réglages), qui ouvre la page ; pas de lien dans le Profil ;
//  1 bis. la fenêtre « Sélection » : fermée au départ, le choix en cours affiché, gros boutons par groupe ; pas de rangée
//     d'activités sur « Tout » ; annuler et la croix ne changent rien ; valider d'un coup famille, activité et période ne
//     fait qu'un pas d'historique ; une pièce de matériel choisie sur la page s'applique sans la fenêtre (5c) ;
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
//  6. à 390×844 et 320×640 : rien ne déborde ; la barre du bas (Profil, Sessions, Statistiques, Réglages) ; sa case
//     « Statistiques » ouvre la page, allumée.
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
/** Choix d'une rangée : pastilles de la donnée du graphique ; groupes de gros boutons de la fenêtre « Sélection » (vides fenêtre fermée). */
const rowButtons = (label) => label === 'Donnée'
  ? `.stats-chips[aria-label=${JSON.stringify(label)}] .ui-tab`
  : `.stats-selection-dialog [role=radiogroup][aria-label=${JSON.stringify(label)}] button[role=radio]`;
const labelOf = (b) => (b.querySelector('.ui-choice__label') ?? b).textContent;
const chips = (label) => evaluate(`[...document.querySelectorAll(${JSON.stringify(rowButtons(label))})].map(${labelOf.toString()}).join(', ')`);
const search = () => evaluate('location.pathname + location.search');
const points = () => evaluate(`document.querySelectorAll('.recharts-scatter-symbol').length`);
const pressed = (label) => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(rowButtons(label))})].find((x) => x.getAttribute('aria-pressed') === 'true' || x.getAttribute('aria-checked') === 'true');
  return b ? (${labelOf.toString()})(b) : null;
})()`);
const dialogOpen = () => evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Sélection"]'))`);
/** Ouvre la fenêtre « Sélection » si elle est fermée. */
const openSelection = async () => {
  if (await dialogOpen()) return;
  await evaluate(`document.querySelector('button.stats-selection').click()`);
  await waitFor(`Boolean(document.querySelector('[role="dialog"][aria-label="Sélection"]'))`, { timeout: 3000, every: 50, label: 'fenêtre Sélection' });
};
/** Clique, dans la fenêtre ouverte, le bouton d'un groupe dont le libellé est exactement `text` (sans valider). */
const pick = async (group, text) => {
  const done = await evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(rowButtons(group))})].find((el) => (${labelOf.toString()})(el).trim() === ${JSON.stringify(text)});
  if (!b || b.disabled) return false;
  b.click();
  return true;
})()`);
  // Le brouillon de la fenêtre doit avoir rendu le choix coché avant la suite.
  if (done) await waitFor(`[...document.querySelectorAll(${JSON.stringify(rowButtons(group))})].some((x) => x.getAttribute('aria-checked') === 'true' && (${labelOf.toString()})(x).trim() === ${JSON.stringify(text)})`, { timeout: 3000, every: 50, label: `${group} : ${text} coché` });
  return done;
};
const footButton = (kind) => `document.querySelector('.stats-selection__foot .ui-btn--${kind}')`;
const validate = async () => {
  await evaluate(`${footButton('primary')}.click()`);
  await waitFor(`!document.querySelector('[role="dialog"][aria-label="Sélection"]')`, { timeout: 3000, every: 50, label: 'fenêtre fermée' });
  await settle({ max: 800 });
};
/** Ouvre la fenêtre, choisit un ou plusieurs boutons [groupe, libellé], valide d'un coup. */
const choose = async (...picks) => {
  await openSelection();
  for (const [group, text] of picks) if (!(await pick(group, text))) return false;
  await validate();
  return true;
};
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
await go('/sessions', 5000);
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
check("ouverture : « / » mène au Profil", (await search()) === '/profil', await search());
check('lien dans la barre du haut, entre Planifier et Réglages', (await evaluate(`document.querySelector('.shell-toplinks')?.textContent`)) === 'ProfilSessionsPlanifierStatistiquesRéglages');
check('plus de lien « Statistiques » dans le Profil (demande du 19/10)', !(await evaluate(`[...document.querySelectorAll('.shell-main a')].some((a) => a.textContent.trim().startsWith('Statistiques'))`)));
check('lien de la barre du haut', await click('.shell-toplinks a', 'Statistiques'));
await settle({ max: 1500 });
check('le lien ouvre la page', (await search()) === '/statistiques', await search());

// 1 bis. La fenêtre « Sélection » : fermée au départ, le choix en cours affiché, ses groupes de gros boutons, annuler.
const summary = () => evaluate(`document.querySelector('button.stats-selection .stats-selection__summary')?.textContent ?? null`);
check('« Sélection » : fenêtre fermée au départ, le choix en cours affiché', !(await dialogOpen())
  && (await summary())?.includes('Toutes les familles · depuis le début')
  && (await evaluate(`document.querySelector('button.stats-selection')?.getAttribute('aria-haspopup')`)) === 'dialog', await summary());
check('plus de boutons glissants ni de repli « Sélection » sur la page', (await evaluate(`document.querySelectorAll('.stats-choice .ui-segmented, .stats-choice > button[data-chart-fold]').length`)) === 0);
await openSelection();
check('rangée des familles : Tout, Voile, Surf', (await chips('Famille')) === 'Tout, Voile, Surf', await chips('Famille'));
check('« Tout » choisi, pas de rangée d\'activités', (await pressed('Famille')) === 'Tout' && (await chips('Activité')) === '', `${await pressed('Famille')} ; ${await chips('Activité')}`);
check('rangée des périodes, « Tout » choisi', (await chips('Période')) === 'Semaine, 30 jours, 6 mois, Année, Tout' && (await pressed('Période')) === 'Tout', await chips('Période'));
// Annuler : rien ne change, ni l'adresse ni les chiffres.
await pick('Famille', 'Voile');
await pick('Période', '30 jours');
check('brouillon : Voile choisi, rangée d\'activités, adresse inchangée', (await pressed('Famille')) === 'Voile' && (await chips('Activité'))?.startsWith('Toutes, ')
  && (await search()) === '/statistiques', `${await pressed('Famille')} ; ${await chips('Activité')} ; ${await search()}`);
await evaluate(`${footButton('secondary')}.click()`);
await waitFor(`!document.querySelector('[role="dialog"][aria-label="Sélection"]')`, { timeout: 3000, every: 50, label: 'fenêtre fermée (annuler)' });
await settle({ max: 800 });
check('annuler : adresse et chiffres inchangés (9 sessions)', (await search()) === '/statistiques' && (await stat('Sessions')) === '9' && !(await dialogOpen()),
  `${await search()} ; ${await stat('Sessions')}`);
await openSelection();
check('rouverte après annuler : « Tout » et « Tout » toujours choisis', (await pressed('Famille')) === 'Tout' && (await pressed('Période')) === 'Tout', `${await pressed('Famille')} ; ${await pressed('Période')}`);
await evaluate(`document.querySelector('.ui-dialog__close').click()`);
await waitFor(`!document.querySelector('[role="dialog"][aria-label="Sélection"]')`, { timeout: 3000, every: 50, label: 'fenêtre fermée (croix)' });
check('la croix ferme sans rien changer', (await search()) === '/statistiques');

// 2. Vue d'ensemble.
check('9 sessions', (await stat('Sessions')) === '9', await stat('Sessions'));
check('onglets de la vue d\'ensemble', (await tabs()) === 'général, graphique, régularité', await tabs());
check('graphique de la vue d\'ensemble : la durée seule, sans pastilles', (await chips('Donnée')) === '' && (await points()) === 9 && (await yLabel()) === 'min',
  `${await chips('Donnée')} ; ${await points()} ; ${await yLabel()}`);
const familyRows = await evaluate(`[...document.querySelectorAll('.stats-rows .stats-row__name')].map((e) => e.textContent).join(', ')`);
check('une ligne par famille', familyRows === 'Voile, Surf', familyRows);
check('pas de distance mêlée', (await stat('Distance')) === null);
check('régularité', (await stat('Semaines actives')) !== null && (await evaluate(`!!document.querySelector('.recharts-bar')`)));
await shoot('stats-ensemble');

// 3. Descente.
check('« Voile » choisi dans la fenêtre', await choose(['Famille', 'Voile']));
check('famille dans l\'adresse', (await search()) === '/statistiques?famille=voile', await search());
check('Voile : 7 sessions', (await stat('Sessions')) === '7', await stat('Sessions'));
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

check('« 30 jours » choisi dans la fenêtre', await choose(['Période', '30 jours']));
check('30 jours : 2 sessions', (await stat('Sessions')) === '2', await stat('Sessions'));
check('période dans l\'adresse', (await search()) === '/statistiques?famille=voile&periode=trente', await search());
check('le sous-titre porte le choix', (await evaluate(`document.querySelector('.ui-page-header')?.textContent`))?.includes('Voile · 30 jours'),
  await evaluate(`document.querySelector('.ui-page-header')?.textContent`));
await evaluate('history.back()');
await settle({ max: 1000 });
check('retour arrière : vue d\'ensemble', (await search()) === '/statistiques' && (await stat('Sessions')) === '9', `${await search()} ; ${await stat('Sessions')}`);

// Valider d'un coup famille, activité et période : un seul pas dans l'historique.
await go('/statistiques');
const histBefore = await evaluate('history.length');
await openSelection();
await pick('Famille', 'Voile');
await pick('Activité', 'Wingfoil');
await pick('Période', '6 mois');
await validate();
const histAfter = await evaluate('history.length');
check('valider d\'un coup : famille, activité et période dans l\'adresse', (await search()) === '/statistiques?famille=voile&activite=' + (await evaluate(`new URLSearchParams(location.search).get('activite')`)) + '&periode=sixmois'
  && (await evaluate(`new URLSearchParams(location.search).get('activite')`)) !== null, await search());
// `history.length` plafonne ou se tronque : la preuve d'un seul pas est qu'un seul retour ramène l'adresse d'avant.
await evaluate('history.back()');
await settle({ max: 1000 });
check("valider d'un coup : un seul retour ramène l'adresse d'avant", (await search()) === '/statistiques' && (await stat('Sessions')) === '9', `${await search()} ; ${await stat('Sessions')} ; historique ${histBefore} -> ${histAfter}`);

await go('/statistiques?famille=voile');
await settle({ max: 800 });
await openSelection();
const voile = await chips('Activité');
check('activités de la voile : Wingfoil et Kite, sessions ou non', voile?.startsWith('Toutes, Wingfoil') && voile.includes('Kite'), voile);
await pick('Activité', 'Kite');
await validate();
check('Kite : 2 sessions', (await stat('Sessions')) === '2' && (await search())?.includes('activite='), `${await stat('Sessions')} ; ${await search()}`);
await choose(['Activité', 'Wingfoil']);
check('Wingfoil : 5 sessions', (await stat('Sessions')) === '5', await stat('Sessions'));
await openSelection();
await pick('Famille', 'Surf');
const surfActivites = await chips('Activité');
await validate();
check('activités du surf : Surf en tête', surfActivites?.startsWith('Toutes, Surf'), surfActivites);
check('Surf : 2 sessions', (await stat('Sessions')) === '2', await stat('Sessions'));

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
await choose(['Famille', 'Voile']);
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
await choose(['Famille', 'Surf']);
check('surf : pas de distance de la voile, la vitesse max à sa place', (await pressed('Donnée')) === 'Distance' || (await pressed('Donnée')) === 'Vitesse max', await pressed('Donnée'));
const surfChips = await chips('Donnée');
check('données du surf (sans foil)', surfChips === 'Vitesse max, Moyenne en action, Durée, Distance, Vagues, Plus longue vague', surfChips);
await click('.stats-chips[aria-label="Donnée"] .ui-tab', 'Vagues');
await wait(500);
check('surf, Vagues : 2 points', (await points()) === 2, String(await points()));
await click('.stats-chips[aria-label="Donnée"] .ui-tab', 'Vitesse max');
await wait(300);
await choose(['Famille', 'Voile']);
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
await openSelection();
check('Surf absent de la rangée des familles', (await chips('Famille')) === 'Tout, Voile', await chips('Famille'));
await evaluate(`${footButton('secondary')}.click()`);
await waitFor(`!document.querySelector('[role="dialog"][aria-label="Sélection"]')`, { timeout: 3000, every: 50, label: 'fenêtre fermée' });
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

// 5c. Matériel sur la page : une pièce choisie s'applique tout de suite, sans ouvrir la fenêtre.
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}');
  s.gearGroups = { ...s.gearGroups, wingfoil: [{ id: 'g-aile', name: 'Aile', items: [{ id: 'a-5', name: 'Aile 5 m' }, { id: 'a-6', name: 'Aile 6 m' }] }] };
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
})()`);
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
await waitFor(`Boolean(document.querySelector('.stats-choice__gear'))`, { timeout: 4000, every: 50, label: 'bloc matériel' });
check('wingfoil sans matériel porté : bloc « Matériel » replié, aucune pièce', await evaluate(`(() => {
  const g = document.querySelector('.stats-choice__gear');
  return !!g && g.querySelector('button[data-chart-fold]')?.getAttribute('aria-expanded') === 'false' && !g.querySelector('[role="radio"]');
})()`));
await go('/statistiques?famille=voile');
check('sans activité choisie : pas de bloc « Matériel »', !(await evaluate(`Boolean(document.querySelector('.stats-choice__gear'))`)));
await go(`/voile/analyse?session=${encodeURIComponent(voileRec?.gpx ?? '')}`, 8000);
await evaluate(`[...document.querySelectorAll('.ui-tab')].find((b) => b.textContent.trim() === 'matos et conditions')?.click()`);
await waitFor(`Boolean(document.querySelector('[data-testid="gear-picker-g-aile"]'))`, { timeout: 5000, every: 50, label: 'sélecteur de l\'aile' });
await evaluate(`document.querySelector('[data-testid="gear-picker-g-aile"]')?.click()`);
await waitFor(`Boolean(document.querySelector('[data-testid="gear-sheet"]'))`, { timeout: 3000, every: 50, label: 'feuille du matériel' });
await click('[data-testid="gear-sheet"] button', 'Aile 5 m');
await waitFor(`!document.querySelector('[data-testid="gear-sheet"]')`, { timeout: 3000, every: 50, label: 'feuille refermée' });
await click('button', 'Enregistrer la session');
await waitFor(async () => (await sessionRecords()).find((r) => r.gpx === voileRec?.gpx)?.notes?.gear?.length === 1, { timeout: 3000, label: 'matériel écrit' });
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
await waitFor(`Boolean(document.querySelector('.stats-choice__gear button[data-chart-fold]'))`, { timeout: 4000, every: 50, label: 'bloc matériel' });
await evaluate(`document.querySelector('.stats-choice__gear button[data-chart-fold]').click()`);
await waitFor(`document.querySelectorAll('.stats-choice__gear .ui-choices--s [role="radio"]').length > 0`, { timeout: 4000, every: 50, label: 'pièces affichées' });
const gearPieces = await evaluate(`[...document.querySelectorAll('.stats-choice__gear .ui-choices--s [role="radio"]')].map((b) => b.textContent.trim()).join(', ')`);
check('matériel déplié : pièces de l\'aile', gearPieces === 'Tous, Aile 5 m, Aile 6 m', gearPieces);
await evaluate(`[...document.querySelectorAll('.stats-choice__gear .ui-choices--s [role="radio"]')].find((b) => b.textContent.trim() === 'Aile 5 m').click()`);
await waitFor(`location.search.includes('materiel=g-aile%3Aa-5')`, { timeout: 4000, every: 50, label: 'pièce dans l\'adresse' });
await settle({ max: 800 });
check('pièce choisie sur la page : appliquée sans fenêtre (1 session, adresse à une pièce)', !(await dialogOpen()) && (await stat('Sessions')) === '1'
  && (await search()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', `${await stat('Sessions')} ; ${await search()}`);

// 6. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=voile');
for (const t of ['graphique', 'régularité', 'records']) await openTab(t);
await settle({ max: 800 });
check('390 px : rien ne déborde (famille)', !(await overflow()));
await shoot('stats-telephone');
await go('/statistiques');
check('390 px : rien ne déborde (ensemble)', !(await overflow()));
// 320 px : la fenêtre « Sélection » tient dans l'écran, ses boutons passent à la ligne, sans élargir la page.
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=surf');
await openSelection();
const fit = await evaluate(`(() => {
  const d = document.querySelector('.stats-selection-dialog')?.getBoundingClientRect();
  const on = document.querySelector('.stats-selection-dialog [role="radiogroup"][aria-label="Famille"] [aria-checked=true]')?.getBoundingClientRect();
  const foot = document.querySelector('.stats-selection__foot')?.getBoundingClientRect();
  return { dialog: !!d && d.left >= -1 && d.right <= window.innerWidth + 1 && d.bottom <= window.innerHeight + 1, choice: !!on && on.left >= 0 && on.right <= window.innerWidth, foot: !!foot && foot.bottom <= window.innerHeight + 1 };
})()`);
check('320 px : rien ne déborde, fenêtre et choix en vue', !(await overflow()) && fit?.dialog && fit?.choice && fit?.foot, JSON.stringify(fit));
await shoot('stats-320');
await evaluate(`${footButton('secondary')}.click()`);

await go('/');
const tab = (label) => `[...document.querySelectorAll('.shell-tabbar .shell-tab')].find((t) => t.textContent.trim() === ${JSON.stringify(label)})`;
check('barre du bas : Profil, Sessions, Statistiques, Réglages', (await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((t) => t.textContent.trim()).join(' | ')`)) === 'Profil | Sessions | Statistiques | Réglages');
await evaluate(`${tab('Statistiques')}.click()`);
await settle({ max: 1500 });
// La page reprend le dernier affichage : l'adresse peut porter des paramètres.
check('la case ouvre la page, allumée', (await search())?.startsWith('/statistiques')
  && (await evaluate(`${tab('Statistiques')}.classList.contains('active')`)));

// Ce script ne relève que les erreurs de console, pas les avertissements.
const errors = logs.filter((l) => !l.startsWith('warning:'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : aucune erreur');
await finish('Tout passe.');
