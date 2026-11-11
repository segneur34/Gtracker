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
import { CLES, connect } from './lib/cdp.mjs';
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
const gearRows = () => evaluate(`[...document.querySelectorAll('.stats-gear')].map((r) => r.querySelector('.stats-gear__label')?.textContent + ' : ' + [...r.querySelectorAll('[role=radio]')].map((b) => (b.getAttribute('aria-checked') === 'true' ? '[' + b.textContent + ']' : b.textContent)).join(', ')).join(' | ')`);
const pickGear = (group, item) => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(`.ui-segmented[aria-label="Matériel : ${group}"] [role=radio]`)})].find((x) => x.textContent.trim() === ${JSON.stringify(item)});
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const choiceText = () => evaluate(`document.querySelector('.stats-choice button[data-chart-fold]')?.textContent ?? ''`);
const address = () => evaluate('location.pathname + location.search');
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
if ((await evaluate(`document.querySelector('.stats-choice button[data-chart-fold]')?.getAttribute('aria-expanded')`)) !== 'true') {
  await evaluate(`document.querySelector('.stats-choice button[data-chart-fold]')?.click()`);
  await settle({ max: 800, label: 'sélection' });
}
// Lot 178 : « Matériel » est un bouton de « Sélection », replié au départ, grisé sans liste de matériel.
const partFold = (name) => `[...document.querySelectorAll('.stats-choice__part button[data-chart-fold]')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(name)}))`;
check('Matériel replié au départ, bouton actif, aucune rangée', (await evaluate(`${partFold('Matériel')}?.getAttribute('aria-expanded')`)) === 'false'
  && (await evaluate(`${partFold('Matériel')}?.disabled`)) === false && (await gearRows()) === '', await gearRows());
await evaluate(`${partFold('Matériel')}?.click()`);
await settle({ max: 800, label: 'matériel déplié' });
console.log('\nlignes du matériel :', await gearRows());
check('Wingfoil : 4 sessions, une ligne par groupe porté (pas « Mât »)', (await statSessions()) === '4'
  && (await gearRows()) === 'Aile : [Tous], Aile 5 m, Aile 6 m | Foil : [Tous], Foil 900, Foil 1200', `${await statSessions()} ; ${await gearRows()}`);
console.log('Aile 5 m :', await pickGear('Aile', 'Aile 5 m'));
await settle({ max: 800, label: 'Aile 5 m' });
check('Aile 5 m : 2 sessions, adresse à une pièce', (await statSessions()) === '2' && (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5',
  `${await statSessions()} ; ${await address()}`);
console.log('Foil 900 :', await pickGear('Foil', 'Foil 900'));
await settle({ max: 800, label: 'Foil 900' });
console.log('sélection :', await choiceText());
check('Aile 5 m et Foil 900 : 1 session, croisée dans l\'adresse et le résumé', (await statSessions()) === '1'
  && (await address()) === '/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5%2Cg-foil%3Af-900'
  && (await choiceText()).includes('Voile · Wingfoil · Aile 5 m · Foil 900'), `${await statSessions()} ; ${await address()} ; ${await choiceText()}`);
await shoot('materiel-statistiques');
await evaluate('history.back()');
await settle({ max: 1000, label: 'retour' });
check('retour arrière : Aile 5 m seule, 2 sessions', (await statSessions()) === '2' && (await gearRows()) === 'Aile : Tous, [Aile 5 m], Aile 6 m | Foil : [Tous], Foil 900, Foil 1200',
  `${await statSessions()} ; ${await gearRows()}`);
await go('/statistiques?famille=voile&activite=wingfoil&materiel=f-1200', 4000);
check('ancienne adresse à une pièce : Foil 1200, rangée dans Foil', (await statSessions()) === '1' && (await gearRows()) === 'Aile : [Tous], Aile 5 m, Aile 6 m | Foil : Tous, Foil 900, [Foil 1200]',
  `${await statSessions()} ; ${await gearRows()}`);

// Lot 178 : sans liste de matériel (Surf), « Matériel » reste grisé, non cliquable et replié ; avec « Toutes », de même.
const mat = (expr) => evaluate(`${partFold('Matériel')}${expr}`);
await go('/statistiques?famille=surf&activite=surf', 4000);
check('Surf : Matériel grisé et replié', (await mat('?.disabled')) === true && (await mat("?.getAttribute('aria-expanded')")) === 'false');
await mat('?.click()');
await wait(300);
check('Surf : un clic sur Matériel ne déplie rien', (await mat("?.getAttribute('aria-expanded')")) === 'false' && (await gearRows()) === '');
await go('/statistiques?famille=voile', 4000);
check('« Toutes » les activités : Matériel grisé', (await mat('?.disabled')) === true);
// Activité : repliée puis rouverte.
const act = (expr) => evaluate(`${partFold('Activité')}${expr}`);
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
check('Activité ouverte au départ, libellé du choix en cours', (await act("?.getAttribute('aria-expanded')")) === 'true' && (await act('?.textContent')).includes('Wingfoil'));
await act('?.click()');
await wait(300);
check('Activité repliée : rangée partie, choix gardé dans le bouton', (await act("?.getAttribute('aria-expanded')")) === 'false'
  && (await evaluate(`document.querySelector('.ui-segmented[aria-label="Activité"]')`)) === null && (await act('?.textContent')).includes('Wingfoil'));
await go('/statistiques?famille=voile&activite=wingfoil', 4000);
check('Activité repliée retenue après rechargement', (await act("?.getAttribute('aria-expanded')")) === 'false');
await act('?.click()');
await wait(300);
check('Activité rouverte', (await act("?.getAttribute('aria-expanded')")) === 'true' && (await evaluate(`!!document.querySelector('.ui-segmented[aria-label="Activité"]')`)));
// Matériel : un filtre posé reste dit une fois replié ; état retenu ; rien ne déborde à 320 px.
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
if ((await mat("?.getAttribute('aria-expanded')")) !== 'true') { await mat('?.click()'); await wait(300); }
await mat('?.click()');
await wait(300);
check('Matériel replié : le choix reste dit dans le bouton', (await mat("?.getAttribute('aria-expanded')")) === 'false' && (await mat('?.textContent')).includes('Aile 5 m'), await mat('?.textContent'));
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
check('Matériel replié retenu après rechargement', (await mat("?.getAttribute('aria-expanded')")) === 'false');
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/statistiques?famille=voile&activite=wingfoil&materiel=g-aile%3Aa-5', 4000);
await mat('?.click()');
await wait(300);
check('320 px : rien ne déborde, chevrons visibles', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth && [...document.querySelectorAll('.stats-choice button[data-chart-fold]')].every((b) => { const c = b.querySelector('svg')?.getBoundingClientRect(); return !!c && c.right <= window.innerWidth + 1; })`));
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
