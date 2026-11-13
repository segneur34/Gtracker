// Banc de test : logos des activités (demande du 17/10, remis sur la voile et le surf au lot 330, onze logos au lot 349).
// Usage : node icones.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 1 min. Le script importe cinq sessions synthétiques (`lib/traces.mjs`) par
// la page Sessions (deux de wingfoil, une de kite, une de surf, une sans type, à classer), puis vérifie :
//  1. l'ouverture : « / » mène au Profil ; la feuille des logos posée une seule fois (onze dessins et le cadre) ;
//  2. la page Sessions : le titre, la rangée de logos (Toutes, Wingfoil, Kite, Surf, Pumping : les activités visibles),
//     un logo dans son cadre par rond ; une pastille de couleur devant chaque ligne rangée ; le rond « Kite » ne laisse
//     que sa ligne ; « Toutes » les rend ;
//  3. la liste de choix d'activité (session à classer) : un dessin et une pastille colorée par activité ;
//  4. Réglages : onze dessins au choix, celui deviné coché (Wingfoil), « Windsurf » choisi, rangé dans la liste des
//     activités (`windsurf`), gardé après rechargement, repris par le rond de la page Sessions ;
//     une activité « Kayak » ajoutée en surf, son dessin deviné (« Paddle ») coché pendant la saisie, rangée sans choix ;
//  5. le Profil : la photo est vide au départ, un logo choisi y paraît dans son cadre, « Retirer » la vide ; le
//     première activité favorite est un logo dans son cadre ;
//  6. à 390×844 : Sessions et Profil sans débordement.
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { choisirActivite, ouvrirLigne, ronds } from './lib/sessions.mjs';
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

/** Lignes à pastille de la page Sessions : deux wingfoil, un kite et un surf (la session sans type, à classer, n'en a pas). */
const ROWS = 4;
/** Ronds de la rangée de logos, « Toutes » compris : un logo dans son cadre par activité visible. */
const RONDS = 'Toutes*, Wingfoil, Kite, Surf, Pumping';

const rowIcons = () => evaluate(`document.querySelectorAll('.lib-row .lib-row__icon').length`);
/** Dessin du logo du rond d'une activité de la rangée. */
const bubbleLogo = (label) => evaluate(`[...document.querySelectorAll('.activity-bubbles .activity-bubble')].find((b) => b.querySelector('.activity-bubble__name')?.textContent.trim() === ${JSON.stringify(label)})?.querySelector('.activity-bubble__logo')?.innerHTML ?? ''`);
const h1 = () => evaluate(`document.querySelector('h1')?.textContent ?? null`);
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
const stored = () => evaluate(`JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}').activities ?? null`);

/** La page se monte après le chargement (modules à la demande, bibliothèque relue) : on attend son premier élément, 3 s au plus comme l'ancien sommeil. */
const ready = (selector) => waitFor(`document.querySelector(${JSON.stringify(selector)}) !== null`, { timeout: 3000, label: selector });

// --- Mise en place ---
await go('/sessions', 5000);
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

// 1. Ouverture : le Profil.
await go('/');
await ready('.profile-head__title');
check("ouverture : « / » mène au Profil", (await evaluate('location.pathname')) === '/profil', await evaluate('location.pathname'));
// La feuille des logos se lit à part : on attend qu'elle soit posée.
await waitFor(`document.querySelector('svg.logo-sprite') !== null`, { timeout: 3000, label: 'feuille des logos' });
const sprite = await evaluate(`({ sheets: document.querySelectorAll('svg.logo-sprite').length, symbols: [...document.querySelectorAll('svg.logo-sprite symbol')].map((s) => s.id) })`);
check('feuille des logos : une seule, onze dessins et le cadre', sprite.sheets === 1 && sprite.symbols.length === 12
  && sprite.symbols.includes('gt-logo-frame') && sprite.symbols.includes('gt-logo-surf-foil'), JSON.stringify(sprite));
await shoot('icones-profil-ouverture');

// 2. Page Sessions.
await go('/sessions');
await ready('.lib-row');
check('Sessions : titre', (await h1()) === 'Sessions', await h1());
check('Sessions : rangée de logos des activités visibles', (await ronds(evaluate)) === RONDS, await ronds(evaluate));
const bubbleMarks = await evaluate(`[...document.querySelectorAll('.activity-bubbles .activity-bubble__logo')].filter((l) =>
  l.querySelectorAll('use').length === 2 && l.querySelector('use')?.getAttribute('href') === '#gt-logo-frame'
  && l.querySelector('use:nth-of-type(2)')?.getAttribute('href')?.startsWith('#gt-logo-')).length`);
check('Sessions : un logo dans son cadre par activité de la rangée', bubbleMarks === 4, bubbleMarks);
check('Sessions : une pastille par ligne rangée', (await rowIcons()) === ROWS, await rowIcons());
const rowMarks = await evaluate(`[...document.querySelectorAll('.lib-row .lib-row__icon')].filter((i) => i.classList.contains('ui-swatch') && i.style.background).length`);
check('Sessions : pastille de couleur sur chaque ligne', rowMarks === ROWS, rowMarks);
const wingIcon = await bubbleLogo('Wingfoil');
check('Sessions : logo du rond Wingfoil', wingIcon.includes('#gt-logo-wingfoil'), wingIcon);
await shoot('icones-sessions-toutes');
check('rond Kite', (await choisirActivite(evaluate, 'Kite')) === 'ok');
await wait(400);
check('rond Kite : sa seule ligne', (await rowIcons()) === 1, await rowIcons());
await shoot('icones-sessions-kite');
check('rond Toutes', (await choisirActivite(evaluate, 'Toutes')) === 'ok');
await wait(400);
check('« Toutes » rend toutes les lignes', (await rowIcons()) === ROWS, await rowIcons());

// 3. Liste de choix : la session à classer.
await go('/sessions');
await ready('.lib-row__main');
console.log('ouvrir À classer :', await ouvrirLigne(evaluate, 'À classer'));
await wait(600);
const sheet = await evaluate(`(() => {
  const opts = [...document.querySelectorAll('.activity-select__option')];
  const marked = (o) => o.querySelector('.activity-select__icon use')?.getAttribute('href')?.startsWith('#gt-logo-')
    && o.querySelector('.activity-select__icon .ui-swatch')?.style.background;
  return { options: opts.length, icons: opts.filter(marked).length };
})()`);
check('liste de choix : un dessin et une pastille colorée par activité', sheet && sheet.options > 0 && sheet.icons === sheet.options, JSON.stringify(sheet));
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
check('Réglages : « Changer » déplie onze dessins', (await choices()) === 11, await choices());
check('Réglages : Wingfoil cochée', (await evaluate(`${picker}?.querySelector('[aria-pressed=true]')?.getAttribute('aria-label')`)) === 'Wingfoil');
await shoot('icones-reglages');
await evaluate(`${picker}?.querySelector('[aria-label="Windsurf"]')?.click()`);
await wait(400);
check('Windsurf rangé', (await stored())?.find((a) => a.id === 'wingfoil')?.icon === 'windsurf');
check('un choix replie la grille', (await choices()) === 0 && (await current(picker)) === 'Windsurf');
await go('/parametres');
await ready('.settings-activity__toggle');
// La carte ouverte est retenue d'un chargement à l'autre : ne la rouvrir que si elle est fermée.
await evaluate(`[...document.querySelectorAll('.settings-activity__toggle')].find((b) => b.textContent.includes('Wingfoil') && b.getAttribute('aria-expanded') !== 'true')?.click()`);
await wait(400);
check('gardé après rechargement', (await current(picker)) === 'Windsurf');

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
check('ajout : Kayak devinée en Paddle', (await current(`document.querySelector('.icon-picker[aria-label="Icône de la nouvelle activité"]')`)) === 'Paddle');
await evaluate(`[...document.querySelectorAll('.settings-add button')].find((b) => b.textContent.trim() === 'Ajouter')?.click()`);
await wait(600);
const paddle = (await stored())?.find((a) => a.name === 'Kayak');
check('Kayak rangée, sans icône imposée', paddle !== undefined && paddle.icon === undefined, JSON.stringify(paddle));

await go('/sessions');
await ready('.lib-row');
const boardIcon = await bubbleLogo('Wingfoil');
check('Sessions : dessin du windsurf dans le rond de Wingfoil', boardIcon.includes('#gt-logo-windsurf') && boardIcon !== wingIcon, boardIcon);

// 5. Profil : la photo, sans choix, est vide (malgré les sessions) ; un logo choisi y paraît dans son cadre, « Retirer »
// la vide ; la première activité favorite montre son logo dans son cadre.
await go('/profil');
await ready('.profile-head__avatar');
const avatarState = () => evaluate(`(() => {
  const empty = document.querySelector('.profile-head__avatar .profile-avatar__disc--empty svg') !== null;
  const logo = document.querySelector('.profile-head__avatar svg.activity-logo');
  const uses = logo ? [...logo.querySelectorAll('use')].map((u) => u.getAttribute('href')) : [];
  const favorite = document.querySelector('.profile-favs__cell svg');
  return { empty, uses, favorite: favorite?.querySelector('use')?.getAttribute('href') ?? null, framed: favorite?.querySelector('use[href="#gt-logo-frame"]') !== null };
})()`);
const avatar = await avatarState();
check('Profil : avatar vide au départ, sans logo', avatar.empty && avatar.uses.length === 0, JSON.stringify(avatar));
check('Profil : première activité favorite dans son cadre au pinceau', avatar.favorite === '#gt-logo-frame' && avatar.framed, JSON.stringify(avatar));
await shoot('icones-profil');
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
await evaluate(`document.querySelector('.avatar-picker__choice[aria-label="Kite"]').click()`);
await wait(300);
const chosen = await avatarState();
check('Profil : logo choisi dans son cadre', !chosen.empty && chosen.uses.length === 2 && chosen.uses[0] === '#gt-logo-frame' && chosen.uses[1] === '#gt-logo-kite', JSON.stringify(chosen));
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
await evaluate(`[...document.querySelectorAll('.avatar-picker button')].find((b) => b.textContent.trim() === 'Retirer')?.click()`);
await wait(300);
const removed = await avatarState();
check('Profil : « Retirer » rend l\'avatar vide', removed.empty && removed.uses.length === 0, JSON.stringify(removed));

// 6. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/sessions');
await ready('.lib-row');
check('390 : Sessions sans débordement', (await overflow()) === false);
await shoot('icones-sessions-390');
await go('/');
await ready('.profile-head__title');
check('390 : Profil sans débordement', (await overflow()) === false);
await shoot('icones-profil-390');

await finish();
