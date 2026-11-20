// Banc de test : lot 1 des demandes du 20/10 (retouches et défauts).
// Usage : node vides.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau (tuiles bloquées). Dure environ 1 min. Le script :
//  1. importe une session de wingfoil en aller simple (vent impossible à estimer) et une session de surf ;
//  2. voile : « manœuvres », « vmg » et « vent » ouverts disent « Vent inconnu », avec « Régler le vent », qui ouvre
//     la boussole sur la carte (22/10 ; « Ouvrir l'onglet général » avant) ;
//  3. surf : la légende de la répartition ne redit pas le pourcentage « sur la vague » ; la rame garde le sien ;
//  4. à 360×800 : « / » mène au Profil ; la page Sessions sans lien Profil ni Statistiques, avec « Planification » à côté de
//     « Tris » (pastille pleine à l'encre, de la même hauteur ; plus rien en bas de la liste) ; barre du bas Profil · Sessions · rond · Statistiques · Réglages, sans débordement ;
//     Réglages, carte Wingfoil ouverte : le nom en texte, qui replie la carte, « Renommer » à droite, sur la
//     ligne du nom ; Échap n'enregistre rien, Entrée renomme, le nom est relu ; rien ne déborde.
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceDroite, traceSurf } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node vides.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, close, logs } = await connect({ port, width: 1400, height: 1000, shotDir });

const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
/** Met un onglet de l'analyse dans l'état voulu (ouvert ou fermé). */
const setTab = (label, wanted) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  if ((t.getAttribute('aria-pressed') === 'true') !== ${wanted}) t.click();
  return 'ok';
})()`);
/** Texte du panneau d'analyse dont le titre commence ainsi. */
const panelOf = (title) => `[...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}))?.closest('.an-carte-panels > *')`;
const panel = async (title) => (await evaluate(`${panelOf(title)}?.innerText.replace(/\\n+/g, ' / ') ?? '(absent)'`));
const clickIn = (title, text) => evaluate(`(() => {
  const b = [...(${panelOf(title)})?.querySelectorAll('button') ?? []].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return false;
  b.click();
  return true;
})()`);
let failures = 0;
const check = (what, ok, detail) => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${what}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) failures++; };

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

// --- Sessions synthétiques (`lib/traces.mjs`) ---
const MORNING = [
  [60, 0], [60, 1.2], [50, 1], [4, 0.1], [40, 1], [4, 0.1], [26, 1], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1],
  [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1],
  [5, 1.6, 180], [8, 4.5, 190], [80, 1], [30, 0.1],
];
const T_VOILE = Date.UTC(2026, 9, 5, 13, 0, 0);
const T_SURF = Date.UTC(2026, 9, 7, 7, 0, 0);
const SESSIONS = [
  // Voile : 20 min droit devant à 8 m/s, aucune manœuvre, vent impossible à estimer.
  { page: 'voile', start: T_VOILE, gpx: traceDroite({ debutMs: T_VOILE, secondes: 1200, vitesse: 8, nom: 'Ligne', alt: (t) => 50 + 0.16 * t }) },
  { page: 'surf', start: T_SURF, gpx: traceSurf({ debutMs: T_SURF, phases: MORNING, nom: 'Matinée' }) },
];

const paths = {};
for (const s of SESSIONS) {
  await go('/sessions', 3000);
  console.log(`import ${s.page} :`, await importGpx(s.gpx, `${s.page}.gpx`));
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 6000, label: `fiche ${s.page}` });
  await settle({ max: 2000, label: `import ${s.page}` });
  paths[s.page] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.page} rangée`, Boolean(rec));
}

// --- 2. Voile sans vent ---
await go(paths.voile, 6000);
for (const tab of ['manœuvres', 'vmg', 'vent']) await setTab(tab, true);
await setTab('général', false);
await settle({ max: 1000 });
for (const [title, word] of [['Manœuvres', 'virements et empannages'], ['Analyse VMG', 'la VMG'], ['Variations du Vent', 'ses variations']]) {
  const text = await panel(title);
  check(`voile, « ${title} » : « Vent inconnu », ${word}`, text.includes('Vent inconnu') && text.includes(word) && text.toLowerCase().includes('régler le vent'), text);
}
await shoot('vides-voile');
check('« Régler le vent » ouvre la boussole sur la carte', (await clickIn('Manœuvres', 'Régler le vent')) && (await settle({ max: 800 }), await evaluate(`Boolean(document.querySelector('.an-map-panel .an-wind__dial'))`)));
check('boussole ouverte : plus de bouton', !(await panel('Manœuvres')).toLowerCase().includes('régler le vent'));

// --- 3. Surf : légende de la répartition ---
await go(paths.surf, 6000);
await setTab('général', true);
await settle({ max: 800 });
const legend = await evaluate(`document.querySelector('[title="Répartition du temps de la session"]')?.nextElementSibling?.innerText.replace(/\\n+/g, ' | ') ?? '(absente)'`);
const general = await panel('Général');
console.log('légende :', legend);
check('surf : « Sur la vague (x %) » dans les chiffres', /Sur la vague \(\d+[.,]\d %\)/.test(general), general.slice(0, 300));
check('surf : « sur la vague » sans pourcentage dans la légende', /sur la vague/.test(legend) && !/sur la vague\s*\d/.test(legend), legend);
check('surf : la rame garde le sien', /rame \d+ %/.test(legend), legend);

// --- 4. Téléphone : ouverture, Sessions, barre, Renommer ---
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: true });
await go('/', 3000);
check('ouverture : « / » mène au Profil', (await evaluate('location.pathname')) === '/profil', await evaluate('location.pathname'));
await go('/sessions', 3000);
const sessionActions = await evaluate(`[...document.querySelectorAll('.sessions-head__pills a')].map((a) => a.textContent.trim() + ' > ' + a.getAttribute('href')).join(' | ')`);
const sessionsBottom = await evaluate(`document.querySelectorAll('.sessions-actions').length`);
check('Sessions : ni lien Profil ni lien Statistiques dans la page', !(await evaluate(`[...document.querySelectorAll('.shell-main a')].some((a) => /^(Profil|Statistiques)$/.test(a.textContent.trim()))`)), sessionActions);
check('Sessions : « Planification » à côté de « Tris », plus rien en bas de la liste', sessionActions === 'Planification > /itineraires/liste' && sessionsBottom === 0, sessionActions + ' / bas : ' + sessionsBottom);
// « Planification » : pastille d'action pleine à l'encre (`ui-tab--action`), de la hauteur de « Tris » (même rangée).
const pastilles = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.sessions-head__pill')].map((p) => ({
  texte: p.textContent.trim(), action: p.classList.contains('ui-tab--action'), h: Math.round(p.getBoundingClientRect().height * 10) / 10,
  fond: getComputedStyle(p).backgroundColor, texteCouleur: getComputedStyle(p).color,
})))`));
console.log('pastilles de Sessions :', JSON.stringify(pastilles));
const planification = pastilles.find((p) => p.texte === 'Planification');
const tris = pastilles.find((p) => p.texte === 'Tris');
check('Sessions : « Planification » prend la classe d\'action, pleine à l\'encre, « Tris » reste une pastille ordinaire',
  planification?.action === true && tris?.action === false && planification.fond !== tris.fond && planification.fond !== 'rgba(0, 0, 0, 0)', JSON.stringify(pastilles));
check('Sessions : « Planification » et « Tris » ont la même hauteur', planification !== undefined && tris !== undefined && planification.h === tris.h, JSON.stringify(pastilles.map((p) => [p.texte, p.h])));
const bar = await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((t) => t.textContent.trim()).join(' | ')`);
check('barre du bas : Profil, Sessions, Statistiques, Réglages', bar === 'Profil | Sessions | Statistiques | Réglages', bar);
check('360 px : Sessions sans débordement', (await overflow()) <= 0);

await go('/parametres', 2000);
await evaluate(`(() => {
  const sections = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}');
  sections.settings = { ...sections.settings, activites: true };
  sections['settings-activities'] = { wingfoil: true };
  sections['settings-families'] = { voile: true };
  localStorage.setItem('${CLES.sections}', JSON.stringify(sections));
  return 'ok';
})()`);
await go('/parametres', 3000);
const card = `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector('.settings-activity__name')?.textContent === NAME)`;
const voile = (name) => card.replace('NAME', JSON.stringify(name));
const head = (name) => evaluate(`(() => {
  const c = ${voile(name)};
  if (!c) return null;
  const toggle = c.querySelector('.settings-activity__toggle');
  const nameEl = c.querySelector('.settings-activity__name');
  // Depuis le 27/10, « Renommer » est une entrée du menu « … » de l'en-tête.
  const rename = c.querySelector('.settings-activity__head > .ui-more .ui-more__button');
  const box = (el) => el?.getBoundingClientRect();
  return {
    open: toggle?.getAttribute('aria-expanded') === 'true',
    nameInToggle: Boolean(nameEl && toggle?.contains(nameEl)),
    input: Boolean(c.querySelector('input[aria-label="Nom de l\\'activité"]')),
    rename: Boolean(rename),
    sameLine: rename && nameEl ? Math.abs(box(rename).top + box(rename).height / 2 - (box(nameEl).top + box(nameEl).height / 2)) < 12 : false,
    eyeSameLine: nameEl && c.querySelector('.settings-eye') ? Math.abs(box(c.querySelector('.settings-eye')).top + box(c.querySelector('.settings-eye')).height / 2 - (box(nameEl).top + box(nameEl).height / 2)) < 12 : false,
  };
})()`);
let h = await head('Wingfoil');
check('carte Wingfoil ouverte : nom en texte dans le bouton, pas de champ', h?.open && h.nameInToggle && !h.input, JSON.stringify(h));
check('menu « … » à droite, sur la ligne du nom', h?.rename && h.sameLine, JSON.stringify(h));
check('l\'œil au bout de la même ligne', h?.eyeSameLine, JSON.stringify(h));
check('360 px : rien ne déborde', (await overflow()) <= 0);
await shoot('vides-renommer');
await evaluate(`${voile('Wingfoil')}.querySelector('.settings-activity__name').click(); 'ok'`);
await wait(300);
check('un toucher sur le nom replie la carte', (await head('Wingfoil'))?.open === false);
await evaluate(`${voile('Wingfoil')}.querySelector('.settings-activity__toggle').click(); 'ok'`);
await wait(300);

const startRename = () => evaluate(`(async () => {
  const c = ${voile('Wingfoil')};
  const more = c?.querySelector('.settings-activity__head > .ui-more .ui-more__button');
  if (!more) return false;
  more.click();
  await new Promise((r) => setTimeout(r, 150));
  const b = [...c.querySelectorAll('.ui-more__panel button')].find((x) => x.textContent.trim() === 'Renommer');
  if (!b) return false;
  b.click();
  return true;
})()`);
const typeName = (value, key) => evaluate(`(() => {
  const i = document.querySelector('input[aria-label="Nom de l\\'activité"]');
  if (!i) return 'pas de champ';
  const focused = document.activeElement === i;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }));
  return focused ? 'focus' : 'sans focus';
})()`);
check('« Renommer » du menu ouvre le champ, curseur dedans', (await startRename()) && (await wait(300), (await typeName('Voile bis', 'Escape')) === 'focus'));
await wait(300);
h = await head('Wingfoil');
check('Échap : nom inchangé, champ refermé', h !== null && !h.input && h.rename, JSON.stringify(h));
await startRename();
await wait(300);
await typeName('Wing', 'Enter');
await wait(500);
h = await head('Wing');
check('Entrée : nouveau nom, champ refermé, carte ouverte', h !== null && !h.input && h.open, JSON.stringify(h));
await go('/parametres', 3000);
check('nom relu après rechargement', (await head('Wing')) !== null);

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
console.log(failures === 0 ? 'Tout est bon.' : `${failures} échec(s).`);
await close();
process.exit(failures === 0 ? 0 : 1);
