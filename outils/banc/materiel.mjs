// Banc de test : onglet du matériel et des notes dans les deux analyses (lot 2 des demandes du 14/10, seconde série ;
// remis sur la voile et le surf au lot 330).
// Usage : node materiel.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 1 min. Le script :
//  1. ouvre dans Réglages les cartes Wingfoil et Surf, partie Matériel : la ligne « Matériel » (deux intitulés) n'est
//     pas en voile ; intitulés « Planche » et « Combinaison » rangés, rognés, pour le Surf ;
//  2. importe une session de wingfoil : onglet « matos et conditions » juste avant « réglages », champs Foil, Mât et
//     Aile / voile, boutons Vent et Plan d'eau, appréciation, partie « notes » dans la barre, « Enregistrer la
//     session », fiche relue, rechargement ;
//  3. la même chose pour une session de surf : onglet « matériel et notes », champs sous les intitulés du Surf,
//     conditions en texte libre ;
//  4. à 390×844 : pas de débordement ;
//  5. Statistiques, matériel croisé (lot 146) : une liste de matériel à trois groupes pour Wingfoil, trois sessions
//     équipées par l'onglet « matos et conditions » ; une ligne par groupe porté (pas celle du groupe jamais porté),
//     croisement en ET (Aile 5 m : 2 sessions, Aile 5 m et Foil 900 : 1), adresse `materiel=groupe:piece,…`, résumé de
//     « Sélection », retour arrière d'un cran, ancienne adresse à une pièce relue dans son groupe ; sans liste (Surf),
//     « Matériel » grisé.
import { CLES, DOSSIER_MEMOIRE, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node materiel.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, clickText, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Saisit un texte dans un champ ou une zone de texte, puis le quitte (`focusout`, l'`onBlur` de React). */
const setText = (input, value) => evaluate(`(() => {
  const i = ${input};
  if (!i) return 'absent';
  const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  return i.value;
})()`);
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
const openTab = (label) => evaluate(`(() => { const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!t) return 'absent'; if (t.getAttribute('aria-pressed') !== 'true' && t.getAttribute('aria-selected') !== 'true') t.click(); return 'ok'; })()`);
const tabLabels = () => evaluate(`[...document.querySelectorAll('.an-carte-col .ui-tab')].map((t) => t.textContent.trim()).join(' | ')`);
const saveBar = () => evaluate(`document.body.innerText.match(/Non enregistr[^\\n]*/)?.[0] ?? '(aucune)'`);
/** Champ du matériel de l'onglet, par son intitulé. */
const gearInput = (label) => `[...document.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent.trim() === ${JSON.stringify(label)})?.querySelector('input[type=text]')`;
const gearLabels = () => evaluate(`[...document.querySelectorAll('label')].filter((l) => l.querySelector('input[type=text]') && l.querySelector('span')).map((l) => l.querySelector('span').textContent.trim()).join(', ')`);
const conditionsArea = `document.querySelector('textarea[aria-label="Conditions"]')`;
// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['*://*.openstreetmap.org/*']);

/** Une session de wingfoil (bords et virages du banc) commençant à `start` (ms). */
const voileGpx = (start) => traceVoile({ debutMs: start, nom: 'Ligne', bords: 1, virageMin: 3 });
/** Une session de surf : rame, vague, retour. */
const surfGpx = (start) => traceSurf({ debutMs: start, nom: 'Ligne', phases: [[60, 1.2], [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1]] });

// --- 1. Réglages ---
await go('/parametres', 4000);
await evaluate(`(() => {
  localStorage.setItem('${CLES.sections}', JSON.stringify({
    settings: { activites: true },
    'settings-activities': { wingfoil: true, surf: true },
    'settings-families': { voile: true, surf: true },
    'settings-activity-parts': { analyse: true, materiel: true },
  }));
  return 'ok';
})()`);
await go('/parametres', 3000);
const nameSelector = '.settings-activity__name';
const rows = await evaluate(`[...document.querySelectorAll('.settings-activity')].filter((c) => [...c.querySelectorAll('.settings-row__label')].some((l) => l.textContent.trim() === 'Matériel')).map((c) => c.querySelector(${JSON.stringify(nameSelector)})?.textContent).join(', ')`);
console.log('cartes ouvertes :', await evaluate(`[...document.querySelectorAll('.settings-activity__toggle[aria-expanded="true"] .settings-activity__name')].map((i) => i.textContent).join(', ')`));
console.log('cartes avec « Matériel » :', rows);
check('pas de ligne « Matériel » en Wingfoil, une en Surf', !rows.split(', ').includes('Wingfoil') && rows.split(', ').includes('Surf'), rows);
const surfCard = `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector(${JSON.stringify(nameSelector)})?.textContent === 'Surf')`;
console.log('intitulé 1 :', await setText(`${surfCard}?.querySelector('input[aria-label="Intitulé du matériel 1"]')`, ' Planche '));
await wait(300);
console.log('intitulé 2 :', await setText(`${surfCard}?.querySelector('input[aria-label="Intitulé du matériel 2"]')`, 'Combinaison'));
await wait(500);
const stored = await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}').gearLabels)`);
console.log('rangés :', stored);
check('intitulés du Surf rangés, rognés', stored === JSON.stringify({ surf: ['Planche', 'Combinaison'] }), stored);
await shoot('materiel-reglages');

/** La barre d'onglets de l'analyse n'est montée qu'une fois la session relue (OPFS), ce que `settle` ne voit pas. */
const tabsReady = async () => { await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 10000, label: 'onglets' }); await settle({ max: 1000, label: 'onglets' }); };

/**
 * Importe, ouvre l'onglet, saisit, enregistre, relit ; rend l'adresse de l'analyse. `voile` : onglet « matos et conditions »
 * (boutons Vent et Plan d'eau, champs à intitulés fixes) ; sinon « matériel et notes » (conditions en texte libre).
 */
const scenario = async ({ page, gpx, startIso, labels, values, voile }) => {
  const start = Date.parse(startIso);
  const tabName = voile ? 'matos et conditions' : 'matériel et notes';
  await go(`/${page}`, 3000);
  console.log(`\nimport ${page} :`, await importGpx(gpx(start), `${page}.gpx`));
  await waitFor(async () => (await records())?.find((r) => r.summary?.startMs === start), { timeout: 4000, label: 'fiche' });
  await settle({ max: 2000, label: 'import' });
  const rec = (await records()).find((r) => r.summary?.startMs === start);
  const path = `/${page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  await go(path, 6000);
  await tabsReady();
  const tabs = await tabLabels();
  console.log('onglets :', tabs);
  check(`« ${tabName} » juste avant « réglages »`, tabs.endsWith(` ${tabName} | réglages`), tabs);
  console.log('ouvrir :', await openTab(tabName));
  await settle({ max: 800, label: 'onglet matériel' });
  const shown = await gearLabels();
  console.log('champs :', shown);
  check(`intitulés ${labels.join(', ')}`, shown === labels.join(', '), shown);
  const hasWater = await evaluate(`document.body.innerText.includes("Plan d'eau")`);
  check(voile ? "boutons Vent et Plan d'eau" : "ni vent ni plan d'eau", hasWater === Boolean(voile), hasWater);
  for (const [k, label] of labels.entries()) console.log(`${label} :`, await setText(gearInput(label), values[k]));
  if (voile) {
    for (const bouton of ['Moyen', 'Clapot']) {
      console.log(`${bouton} :`, await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(bouton)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
    }
  } else {
    console.log('conditions :', await setText(conditionsArea, values[labels.length]));
  }
  console.log('appréciation :', await evaluate(`(() => { const b = document.querySelector('button[aria-label="Bien"]'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
  await wait(500);
  const bar = await saveBar();
  console.log('barre :', bar);
  check('partie « notes » à enregistrer', /notes/.test(bar), bar);
  console.log('Enregistrer la session :', await clickText('Enregistrer la session'));
  const notesOf = async () => (await records()).find((r) => r.summary?.startMs === start)?.notes;
  await waitFor(async () => (await notesOf())?.rating === 4, { timeout: 3000, label: 'fiche écrite' });
  await settle({ max: 1500, label: 'enregistrement' });
  const notes = await notesOf();
  const champs = voile ? [notes?.foil, notes?.mast, notes?.wing] : [notes?.gear1, notes?.gear2];
  console.log('fiche :', JSON.stringify({ champs, conditions: notes?.conditions, vent: notes?.windLevel, eau: notes?.waterState, rating: notes?.rating }));
  const conditionsOk = voile ? notes?.windLevel === 'moyen' && notes?.waterState === 'clapot' : notes?.conditions === values[labels.length];
  check('fiche écrite', champs.join(' / ') === values.slice(0, labels.length).join(' / ') && conditionsOk && notes?.rating === 4, JSON.stringify(notes));
  await go(path, 6000);
  await tabsReady();
  await openTab(tabName); await settle({ max: 800, label: 'onglet matériel' });
  const again = await evaluate(`[${labels.map((l) => `${gearInput(l)}?.value`).join(', ')}${voile ? '' : `, ${conditionsArea}?.value`}].join(' / ')`);
  console.log('après rechargement :', again);
  check('relu après rechargement', again === (voile ? values.slice(0, labels.length) : values).join(' / '), again);
  check('rien à enregistrer', (await saveBar()) === '(aucune)');
  await shoot(`materiel-${page}`);
  return path;
};

// --- 2. et 3. Wingfoil, surf ---
const voilePath = await scenario({ page: 'voile', gpx: voileGpx, startIso: '2026-10-01T08:00:00Z', voile: true,
  labels: ['Foil', 'Mât', 'Aile / voile'], values: ['Foil 900 cm²', 'Mât 85 cm', 'Aile 5 m²'] });
const surfPath = await scenario({ page: 'surf', gpx: surfGpx, startIso: '2026-10-03T08:00:00Z',
  labels: ['Planche', 'Combinaison'], values: ['Planche 6 pieds 2', 'Combinaison 4/3', 'Houle 1 m'] });

// --- 4. Téléphone ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
for (const path of [voilePath, surfPath]) {
  await go(path, 5000);
  await tabsReady();
  await openTab('matériel et notes'); await settle({ max: 800, label: 'onglet matériel' });
  const o = await overflow();
  check(`à 390 px, ${path.split('/')[1]} : débordement ${o}`, o === 0);
}
await shoot('materiel-telephone');

// --- 5. Statistiques : matériel croisé (lot 146) ---
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await go('/', 3000);
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}');
  s.gearGroups = { ...s.gearGroups, wingfoil: [
    { id: 'g-aile', name: 'Aile', items: [{ id: 'a-5', name: 'Aile 5 m' }, { id: 'a-6', name: 'Aile 6 m' }] },
    { id: 'g-foil', name: 'Foil', items: [{ id: 'f-900', name: 'Foil 900' }, { id: 'f-1200', name: 'Foil 1200' }] },
    { id: 'g-mat', name: 'Mât', items: [{ id: 'm-1', name: 'Jamais porté' }] },
  ] };
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
  return 'ok';
})()`);
/** Importe une session de wingfoil, choisit une pièce par groupe dans l'onglet « matos et conditions », enregistre. */
const equipped = async (startIso, aile, foil) => {
  const start = Date.parse(startIso);
  const day = startIso.slice(0, 10);
  await go('/voile', 3000);
  console.log(`\nimport wingfoil ${day} :`, await importGpx(voileGpx(start), `wingfoil-${day}.gpx`));
  await waitFor(async () => (await records())?.find((r) => r.summary?.startMs === start), { timeout: 4000, label: 'fiche' });
  await settle({ max: 2000, label: 'import' });
  const rec = (await records()).find((r) => r.summary?.startMs === start);
  await go(`/voile/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`, 6000);
  await tabsReady();
  await openTab('matos et conditions'); await settle({ max: 800, label: 'onglet matériel' });
  for (const [group, item] of [['g-aile', aile], ['g-foil', foil]]) {
    await evaluate(`document.querySelector('[data-testid="gear-picker-${group}"]')?.click()`);
    await wait(300);
    console.log(`  ${group} → ${item} :`, await clickText(item, '[data-testid="gear-sheet"] button'));
    await wait(300);
  }
  console.log('  Enregistrer la session :', await clickText('Enregistrer la session'));
  await waitFor(async () => (await records()).find((r) => r.summary?.startMs === start)?.notes?.gear?.length === 2, { timeout: 2000, label: 'matériel écrit' });
  await settle({ max: 1500, label: 'enregistrement' });
  const gear = (await records()).find((r) => r.summary?.startMs === start)?.notes?.gear ?? [];
  check(`session du ${day} : ${aile} et ${foil} dans la fiche`, gear.map((g) => g.itemName).join(' + ') === `${aile} + ${foil}`, JSON.stringify(gear));
};
await equipped('2026-10-05T08:00:00Z', 'Aile 5 m', 'Foil 900');
await equipped('2026-10-06T08:00:00Z', 'Aile 5 m', 'Foil 1200');
await equipped('2026-10-07T08:00:00Z', 'Aile 6 m', 'Foil 900');

const statSessions = () => evaluate(`[...document.querySelectorAll('.an-sheet__stat')].find((el) => el.querySelector('.an-sheet__stat-label')?.textContent === 'Sessions')?.querySelector('.an-sheet__stat-value')?.textContent ?? null`);
/** Lignes du filtre « Matériel » : « Groupe : Tous, pièce… », le choix entre crochets. */
// Le matériel se règle sur la page (bloc `.stats-choice__gear`, replié au départ, absent sans activité ou sans liste) et dans la fenêtre « Sélection ».
const gearRows = (root = '.stats-choice__gear') => evaluate(`[...document.querySelectorAll(${JSON.stringify(`${root} [role=radiogroup][aria-label^="Matériel : "]`)})].map((r) => r.getAttribute('aria-label').slice('Matériel : '.length) + ' : ' + [...r.querySelectorAll('[role=radio]')].map((b) => { const t = (b.querySelector('.ui-choice__label') ?? b).textContent.trim(); return b.getAttribute('aria-checked') === 'true' ? '[' + t + ']' : t; }).join(', ')).join(' | ')`);
const pickGear = (group, item, root = '.stats-choice__gear') => evaluate(`(() => {
  const g = document.querySelector(${JSON.stringify(`${root} [role=radiogroup][aria-label="Matériel : ${group}"]`)});
  const b = g && [...g.querySelectorAll('[role=radio]')].find((x) => (x.querySelector('.ui-choice__label') ?? x).textContent.trim() === ${JSON.stringify(item)});
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const choiceText = () => evaluate(`document.querySelector('button.stats-selection .stats-selection__summary')?.textContent ?? ''`);
const address = () => evaluate('location.pathname + location.search');
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
const gearFold = `document.querySelector('.stats-choice__gear button[data-chart-fold]')`;
/** Attend une condition de la page (expression) ; sert après chaque geste sur le matériel ou la fenêtre. */
const until = (expr, label) => waitFor(expr, { timeout: 4000, every: 50, label });
const folded = (v) => until(`${gearFold}?.getAttribute('aria-expanded') === '${v}'`, `matériel ${v === 'true' ? 'déplié' : 'replié'}`);
const sessionsNow = `[...document.querySelectorAll('.an-sheet__stat')].find((el) => el.querySelector('.an-sheet__stat-label')?.textContent === 'Sessions')?.querySelector('.an-sheet__stat-value')?.textContent`;
await until(`Boolean(${gearFold})`, 'bloc matériel');
check('Matériel replié au départ, bouton présent, aucune rangée', (await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) === 'false' && (await gearRows()) === '', await gearRows());
await evaluate(`${gearFold}?.click()`);
await folded('true');
console.log('\nlignes du matériel :', await gearRows());
check('Wingfoil : 4 sessions, une ligne par groupe porté (pas « Mât »)', (await statSessions()) === '4'
  && (await gearRows()) === 'Aile : [Tous], Aile 5 m, Aile 6 m | Foil : [Tous], Foil 900, Foil 1200', `${await statSessions()} ; ${await gearRows()}`);
console.log('Aile 5 m :', await pickGear('Aile', 'Aile 5 m'));
await until(`${sessionsNow} === '2' && location.search.includes('g-aile%3Aa-5')`, 'Aile 5 m appliquée');
check('Aile 5 m : 2 sessions, adresse à une pièce', (await statSessions()) === '2' && (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5',
  `${await statSessions()} ; ${await address()}`);
console.log('Foil 900 :', await pickGear('Foil', 'Foil 900'));
await until(`${sessionsNow} === '1' && location.search.includes('g-foil%3Af-900')`, 'Foil 900 appliqué');
console.log('sélection :', await choiceText());
check('Aile 5 m et Foil 900 : 1 session, croisée dans l\'adresse et le résumé', (await statSessions()) === '1'
  && (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5%2Cg-foil%3Af-900'
  && (await choiceText()).includes('Avec vent · Wingfoil · Aile 5 m · Foil 900'), `${await statSessions()} ; ${await address()} ; ${await choiceText()}`);
await shoot('materiel-statistiques');
await evaluate('history.back()');
await until(`${sessionsNow} === '2' && !location.search.includes('g-foil')`, 'retour arrière');
check('retour arrière : Aile 5 m seule, 2 sessions', (await statSessions()) === '2' && (await gearRows()) === 'Aile : Tous, [Aile 5 m], Aile 6 m | Foil : [Tous], Foil 900, Foil 1200',
  `${await statSessions()} ; ${await gearRows()}`);
await go('/statistiques?famille=voile&activite=wingfoil&materiel=f-1200', 4000);
await until(`${sessionsNow} === '1' && document.querySelectorAll('.stats-choice__gear [role=radio]').length > 0`, 'ancienne adresse lue');
check('ancienne adresse à une pièce : Foil 1200, rangée dans Foil', (await statSessions()) === '1' && (await gearRows()) === 'Aile : [Tous], Aile 5 m, Aile 6 m | Foil : Tous, Foil 900, [Foil 1200]',
  `${await statSessions()} ; ${await gearRows()}`);

// Sans liste de matériel (Surf) ou sans activité choisie, le bloc « Matériel » de la page n'existe pas.
const gearBlock = () => evaluate(`Boolean(document.querySelector('.stats-choice__gear'))`);
await go('/statistiques?famille=surf&activite=surf', 4000);
check('Surf : pas de bloc Matériel', !(await gearBlock()));
await go('/statistiques?famille=voile', 4000);
check('« Toutes » les activités : pas de bloc Matériel', !(await gearBlock()));
// Matériel : un filtre posé reste dit une fois replié ; état retenu ; rien ne déborde à 320 px.
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
await until(`Boolean(${gearFold})`, 'bloc matériel');
if ((await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) !== 'true') { await evaluate(`${gearFold}?.click()`); await folded('true'); }
await evaluate(`${gearFold}?.click()`);
await folded('false');
const foldText = () => evaluate(`${gearFold}?.textContent`);
check('Matériel replié : le choix reste dit dans le bouton', (await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) === 'false' && (await foldText()).includes('Aile 5 m'), await foldText());
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
await until(`Boolean(${gearFold})`, 'bloc matériel');
check('Matériel replié retenu après rechargement', (await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) === 'false');
// Par la fenêtre : la pièce choisie ne s'applique qu'à « Valider ».
await evaluate(`document.querySelector('button.stats-selection').click()`);
await waitFor(`Boolean(document.querySelector('[role="dialog"][aria-label="Sélection"]'))`, { timeout: 3000, every: 50, label: 'fenêtre Sélection' });
console.log('Aile 6 m (fenêtre) :', await pickGear('Aile', 'Aile 6 m', '.stats-selection-dialog'));
await until(`document.querySelector('.stats-selection-dialog [role=radiogroup][aria-label="Matériel : Aile"] [aria-checked=true]')?.textContent.trim().startsWith('Aile 6 m')`, 'Aile 6 m cochée');
check('fenêtre : pièce choisie, pas encore appliquée (adresse inchangée)', (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5'
  && (await gearRows('.stats-selection-dialog')).startsWith('Aile : Tous, Aile 5 m, [Aile 6 m]'), `${await address()} ; ${await gearRows('.stats-selection-dialog')}`);
await evaluate(`document.querySelector('.stats-selection__foot .ui-btn--primary').click()`);
await until(`!document.querySelector('[role="dialog"][aria-label="Sélection"]') && location.search.includes('g-aile%3Aa-6') && ${sessionsNow} === '1'`, 'fenêtre fermée, Aile 6 m appliquée');
check('fenêtre, Valider : Aile 6 m, 1 session, adresse à une pièce', (await statSessions()) === '1' && (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-6',
  `${await statSessions()} ; ${await address()}`);
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
await until(`Boolean(${gearFold})`, 'bloc matériel');
await evaluate(`${gearFold}?.click()`);
await until(`${gearFold}?.getAttribute('aria-expanded') !== null && document.documentElement.scrollWidth > 0`, 'bascule du repli');
check('320 px : rien ne déborde, chevrons visibles', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth && [...document.querySelectorAll('.stats-choice__gear button[data-chart-fold]')].every((b) => { const c = b.querySelector('svg')?.getBoundingClientRect(); return !!c && c.right <= window.innerWidth + 1; })`));
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

// --- 6. Ancienne ligne « Foil » et article hors liste (une fiche dont le catalogue a changé) ---
// Une fiche écrite sur une ligne « Foil » que la liste de l'appareil ne connaît plus (autre identifiant, même nom) avec un
// article qui n'y est plus : une seule ligne « Foil » dans l'onglet, l'article proposé « (hors liste) » aux Statistiques,
// puis un article de la liste choisi sur cette ligne remplace l'ancien choix. Placé après les autres : la session s'ajoute
// aux décomptes ci-dessus.
{
  const startIso = '2026-10-08T08:00:00Z';
  const start = Date.parse(startIso);
  const ancien = { groupId: 'g-foil-ancien', groupName: 'Foil', itemId: 'f-ancien', itemName: 'Glide v1 1085' };
  await go('/voile', 3000);
  console.log('\nimport wingfoil 2026-10-08 :', await importGpx(voileGpx(start), 'wingfoil-2026-10-08.gpx'));
  await waitFor(async () => (await records())?.find((r) => r.summary?.startMs === start), { timeout: 4000, label: 'fiche' });
  await settle({ max: 2000, label: 'import' });
  const rec = (await records()).find((r) => r.summary?.startMs === start);
  const jsonName = rec.gpx.replace(/\.gpx$/, '.json');
  const written = await evaluate(`(async () => {
    const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions');
    const fiche = JSON.parse(await (await (await dir.getFileHandle(${JSON.stringify(jsonName)})).getFile()).text());
    fiche.notes = { ...(fiche.notes ?? {}), gear: [${JSON.stringify(ancien)}], savedAt: Date.now() };
    const w = await (await dir.getFileHandle(${JSON.stringify(jsonName)}, { create: true })).createWritable();
    await w.write(JSON.stringify(fiche)); await w.close();
    return 'ok';
  })()`);
  console.log('fiche à l\'ancienne ligne :', written);
  const gearOf = async () => (await records()).find((r) => r.summary?.startMs === start)?.notes?.gear ?? [];
  const path = `/voile/analyse?session=${encodeURIComponent(rec.gpx)}`;
  await go(path, 6000);
  await tabsReady();
  await openTab('matos et conditions'); await settle({ max: 800, label: 'onglet matériel' });
  const lines = () => evaluate(`[...document.querySelectorAll('.gear-picker')].map((p) => p.querySelector('.gear-picker__label')?.textContent.trim() + ' : ' + p.querySelector('.gear-picker__button .activity-select__name')?.textContent.trim()).join(' | ')`);
  console.log('lignes du matériel :', await lines());
  check('ancienne ligne « Foil » : une seule ligne « Foil », l\'ancien article choisi dessus',
    (await lines()) === 'Aile : Aucun | Foil : Glide v1 1085 | Mât : Aucun', await lines());
  await shoot('materiel-hors-liste-analyse');

  // Statistiques : l'article est proposé « (hors liste) » et compte la session.
  await go('/statistiques?famille=voile&activite=wingfoil', 4000);
  await until(`Boolean(${gearFold})`, 'bloc matériel');
  if ((await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) !== 'true') { await evaluate(`${gearFold}?.click()`); await folded('true'); }
  console.log('lignes du matériel :', await gearRows());
  check('Statistiques : « Glide v1 1085 (hors liste) » proposé dans la ligne Foil',
    (await gearRows()).includes('Foil : [Tous], Foil 900, Foil 1200, Glide v1 1085 (hors liste)'), await gearRows());
  console.log('Glide v1 1085 (hors liste) :', await pickGear('Foil', 'Glide v1 1085 (hors liste)'));
  await until(`${sessionsNow} === '1' && location.search.includes('materiel=')`, 'article hors liste appliqué');
  check('l\'article hors liste choisi compte la session du 08/10 : 1 session', (await statSessions()) === '1', `${await statSessions()} ; ${await address()}`);
  await shoot('materiel-hors-liste-statistiques');

  // Un article de la liste choisi sur la ligne remplace l'ancien choix.
  await go(path, 6000);
  await tabsReady();
  await openTab('matos et conditions'); await settle({ max: 800, label: 'onglet matériel' });
  await evaluate(`document.querySelector('[data-testid="gear-picker-g-foil"]')?.click()`);
  await wait(300);
  console.log('Foil 900 :', await clickText('Foil 900', '[data-testid="gear-sheet"] button'));
  await wait(300);
  console.log('Enregistrer la session :', await clickText('Enregistrer la session'));
  await waitFor(async () => (await gearOf()).some((g) => g.itemName === 'Foil 900'), { timeout: 3000, label: 'fiche écrite' });
  await settle({ max: 1500, label: 'enregistrement' });
  const gear = await gearOf();
  console.log('fiche :', JSON.stringify(gear));
  check('fiche : un seul choix « Foil », celui de la liste', gear.length === 1 && gear[0].groupName === 'Foil' && gear[0].itemId === 'f-900', JSON.stringify(gear));
  await go('/statistiques?famille=voile&activite=wingfoil', 4000);
  await until(`Boolean(${gearFold})`, 'bloc matériel');
  if ((await evaluate(`${gearFold}?.getAttribute('aria-expanded')`)) !== 'true') { await evaluate(`${gearFold}?.click()`); await folded('true'); }
  console.log('lignes du matériel :', await gearRows());
  check('Statistiques : l\'article « (hors liste) » n\'est plus proposé',
    (await gearRows()).includes('Foil : [Tous], Foil 900, Foil 1200') && !(await gearRows()).includes('hors liste'), await gearRows());
}

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
