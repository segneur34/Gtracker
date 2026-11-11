// Banc de test : icônes des activités (demande du 17/10, remis sur la voile et le surf au lot 330).
// Usage : node icones.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 1 min. Le script importe cinq sessions synthétiques (`lib/traces.mjs`) par
// la page Voile (deux de wingfoil, une de kite, une de surf, une sans type, à classer), puis vérifie :
//  1. l'accueil : boutons de famille (Voile, Surf) sans petites icônes d'activité (retirées le 17/10) ;
//  2. la bibliothèque Voile : le bandeau nomme les activités visibles (Wingfoil, Kite), le titre lui-même inchangé ;
//     une icône devant chaque ligne et dans chaque onglet d'activité ; l'onglet « Kite » ne laisse que sa ligne ;
//     « tous » les rend ;
//  3. la bibliothèque Surf : le bandeau nomme ses deux activités visibles (Surf, Pumping) ;
//  4. la liste de choix d'activité (session à classer) : une icône par activité, à sa couleur ;
//  5. Réglages : neuf icônes au choix, celle devinée cochée (Wingfoil), « Planche à voile » choisie, rangée dans la
//     liste des activités, gardée après rechargement, reprise par l'onglet de la bibliothèque ;
//     une activité « Kayak » ajoutée en surf, son icône devinée cochée pendant la saisie, rangée sans choix ;
//  6. à 390×844 : bibliothèque et accueil sans débordement.
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSansType, traceSurf, traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node icones.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, records, shoot, close, logs: allLogs } = await connect({ port, width: 1400, height: 1000, shotDir });
// Ce script ne relevait que les erreurs de console, pas les avertissements.
const logs = { get length() { return allLogs.filter((l) => !l.startsWith('warning:')).length; }, join: (sep) => allLogs.filter((l) => !l.startsWith('warning:')).join(sep) };
// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${detail ? ` : ${detail}` : ''}`);
};
const finish = async () => {
  console.log(logs.length ? `--- console ---\n${logs.join('\n')}` : 'console : rien');
  console.log(failures ? `${failures} échec(s)` : 'tout est passé');
  await close();
};

// --- Sessions synthétiques : à 10 h du jour voulu ---
const dixHeures = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
};
const SESSIONS = [
  ['wingfoil-5.gpx', traceVoile({ debutMs: dixHeures(5), nom: 'wingfoil 5', bords: 1, virageMin: 3 })],
  ['wingfoil-3.gpx', traceVoile({ debutMs: dixHeures(3), nom: 'wingfoil 3', bords: 1, virageMin: 3 })],
  ['kite-1.gpx', traceVoile({ debutMs: dixHeures(1), type: 'kite', nom: 'kite 1', bords: 1, virageMin: 3 })],
  ['surf-2.gpx', traceSurf({ debutMs: dixHeures(2), nom: 'surf 2', phases: [[60, 1.2], [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1]] })],
  ['sans-type-6.gpx', traceSansType({ debutMs: dixHeures(6), nom: 'sans type 6', bords: 1, virageMin: 3 })],
];

/** Lignes à icône de la bibliothèque Voile : deux wingfoil et un kite (la session sans type, à classer, n'en a pas). */
const ROWS_VOILE = 3;

const bannerActivities = () => evaluate(`document.querySelector('.lib-banner__activities')?.textContent ?? ''`);
const rowIcons = () => evaluate(`document.querySelectorAll('.lib-row .lib-row__icon').length`);
/** Dessin de l'icône de l'onglet d'une activité de la bibliothèque. */
const tabIcon = (label) => evaluate(`[...document.querySelectorAll('.ui-tab')].find((t) => t.textContent.trim().startsWith(${JSON.stringify(label + ' (')}))?.querySelector('.ui-tab__icon')?.innerHTML ?? ''`);
const h1 = () => evaluate(`document.querySelector('h1')?.textContent ?? null`);
const tab = (label) => `[...document.querySelectorAll('.ui-tab')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}))`;
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
const stored = () => evaluate(`JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}').activities ?? null`);

/** La page se monte après le chargement (modules à la demande, bibliothèque relue) : on attend son premier élément, 3 s au plus comme l'ancien sommeil. */
const ready = (selector) => waitFor(`document.querySelector(${JSON.stringify(selector)}) !== null`, { timeout: 3000, label: selector });

// --- Mise en place ---
await go('/voile', 5000);
console.log('import :', await evaluate(`(() => {
  const input = document.querySelector('input[type=file][accept*=".gpx"]');
  if (!input) return 'absent';
  const dt = new DataTransfer();
  for (const [name, text] of ${JSON.stringify(SESSIONS)}) {
    dt.items.add(new File([text], name, { type: 'application/gpx+xml' }));
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`));
await waitFor(async () => ((await records()) ?? []).length >= SESSIONS.length, { timeout: 10000, label: 'cinq fiches' });
await settle({ max: 2500, label: 'import' });

// 1. Accueil.
await go('/');
await ready('.home-family__name');
const homeLabels = await evaluate(`[...document.querySelectorAll('.home-family__name')].map((s) => s.textContent)`);
check('accueil : noms des familles', JSON.stringify(homeLabels) === JSON.stringify(['Voile', 'Surf']), JSON.stringify(homeLabels));
check('accueil : pas de petites icônes', (await evaluate(`document.querySelectorAll('.home-family__acts').length`)) === 0);
await shoot('icones-accueil');

// 2. Bibliothèque Voile.
await go('/voile');
await ready('.lib-row');
check('Voile : titre inchangé', (await h1()) === 'Voile', await h1());
check('Voile : bandeau des activités visibles', (await bannerActivities()) === 'Wingfoil, Kite', await bannerActivities());
check('Voile : une icône par ligne', (await rowIcons()) === ROWS_VOILE, await rowIcons());
const wingIcon = await tabIcon('Wingfoil');
check('Voile : icônes des onglets', (await evaluate(`document.querySelectorAll('.ui-tab .ui-tab__icon').length`)) === 2);
await shoot('icones-voile-tous');
await evaluate(`${tab('Kite')}?.click()`);
await wait(400);
check('onglet Kite : sa seule ligne', (await rowIcons()) === 1);
await shoot('icones-voile-kite');
await evaluate(`${tab('tous')}?.click()`);
await wait(400);
check('« tous » rend toutes les lignes', (await rowIcons()) === ROWS_VOILE, await rowIcons());

// 3. Bibliothèque Surf.
await go('/surf');
await ready('.lib-banner__activities');
check('Surf : bandeau des deux activités visibles', (await bannerActivities()) === 'Surf, Pumping', await bannerActivities());

// 4. Liste de choix : la session à classer.
await go('/voile');
await ready('.lib-row__main');
await evaluate(`[...document.querySelectorAll('.lib-row__main')].find((b) => b.textContent.includes('À classer'))?.click()`);
await wait(600);
const sheet = await evaluate(`(() => {
  const opts = [...document.querySelectorAll('.activity-select__option')];
  return { options: opts.length, icons: opts.filter((o) => o.querySelector('svg.activity-select__icon')?.style.color).length };
})()`);
check('liste de choix : une icône colorée par activité', sheet && sheet.options > 0 && sheet.icons === sheet.options, JSON.stringify(sheet));
await shoot('icones-liste');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(300);

// 5. Réglages.
await evaluate(`(() => {
  const sections = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}');
  sections.settings = { ...sections.settings, activites: true };
  sections['settings-families'] = { voile: true };
  localStorage.setItem('${CLES.sections}', JSON.stringify(sections));
  return 'ok';
})()`);
await go('/parametres');
await ready('.settings-activity__toggle');
await evaluate(`[...document.querySelectorAll('.settings-activity__toggle')].find((b) => b.textContent.includes('Wingfoil'))?.click()`);
await wait(400);
const picker = `document.querySelector('.icon-picker[aria-label="Icône de Wingfoil"]')`;
// Depuis le 19/10, la grille est repliée sous « Changer » : seule l'icône en cours se voit.
const current = (p) => evaluate(`${p}?.querySelector('.icon-picker__current')?.getAttribute('title')`);
const choices = () => evaluate(`${picker}?.querySelectorAll('.icon-picker__choice').length`);
check('Réglages : grille repliée, Wingfoil d\'office', (await choices()) === 0 && (await current(picker)) === 'Wingfoil');
await evaluate(`[...${picker}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Changer')?.click()`);
await wait(300);
check('Réglages : « Changer » déplie neuf icônes', (await choices()) === 9, await choices());
check('Réglages : Wingfoil cochée', (await evaluate(`${picker}?.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')`)) === 'Wingfoil');
await shoot('icones-reglages');
await evaluate(`${picker}?.querySelector('[aria-label="Planche à voile"]')?.click()`);
await wait(400);
check('Planche à voile rangée', (await stored())?.find((a) => a.id === 'wingfoil')?.icon === 'planche');
check('un choix replie la grille', (await choices()) === 0 && (await current(picker)) === 'Planche à voile');
await go('/parametres');
await ready('.settings-activity__toggle');
// La carte ouverte est retenue d'un chargement à l'autre : ne la rouvrir que si elle est fermée.
await evaluate(`[...document.querySelectorAll('.settings-activity__toggle')].find((b) => b.textContent.includes('Wingfoil') && b.getAttribute('aria-expanded') !== 'true')?.click()`);
await wait(400);
check('gardée après rechargement', (await current(picker)) === 'Planche à voile');

// Activité ajoutée en surf : l'icône devinée suit le nom.
await evaluate(`(() => {
  const family = document.querySelector('.settings-add select[aria-label="Famille"]');
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(family, 'surf');
  family.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`);
await wait(200);
await evaluate(`(() => {
  const name = document.querySelector('input[aria-label="Nom de la nouvelle activité"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Kayak');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await wait(200);
check('ajout : Kayak devinée', (await current(`document.querySelector('.icon-picker[aria-label="Icône de la nouvelle activité"]')`)) === 'Kayak');
await evaluate(`[...document.querySelectorAll('.settings-add button')].find((b) => b.textContent.trim() === 'Ajouter')?.click()`);
await wait(600);
const paddle = (await stored())?.find((a) => a.name === 'Kayak');
check('Kayak rangée, sans icône imposée', paddle !== undefined && paddle.icon === undefined, JSON.stringify(paddle));

await go('/voile');
await ready('.lib-row');
const boardIcon = await tabIcon('Wingfoil');
check('bibliothèque : dessin de la planche dans son onglet', boardIcon !== '' && boardIcon !== wingIcon);

// 6. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/voile');
await ready('.lib-row');
check('390 : bibliothèque sans débordement', (await overflow()) === false);
await shoot('icones-voile-390');
await go('/');
await ready('.home-family__name');
check('390 : accueil sans débordement', (await overflow()) === false);
await shoot('icones-accueil-390');

await finish();
