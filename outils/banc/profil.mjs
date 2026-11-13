// Banc de test : la page « Profil » (demandes du 18/10, du 19/10 et du 20/10), une période en un coup d'œil.
// Usage : node profil.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique six sessions de 20 min en ligne droite (`traceSurf`, une seule
// phase), datées en jours avant aujourd'hui (deux de wingfoil, une de surf et une de kite cette année, une de wingfoil
// et une de surf l'an passé), les importe par la page Sessions, et vérifie :
//  1. l'ouverture : « / » mène au Profil, sans fond dessiné, allumé dans la barre du haut ; « Profil » dans la barre du
//     haut, depuis Sessions, ouvre la page ;
//  2. l'en-tête (« Live for it. », « Bienvenue » seul sans pseudo, lien du test de FC repos) ; la période en tête
//     (bouton glissant), « Année » au départ : distance (somme des vitesses × durées, à 5 % près), sport préféré
//     (Wingfoil, avec son dessin, qui ouvre ses sessions), nombre de sessions du graphe ; l'anneau et sa légende (une
//     part par activité, Wingfoil à 50 %) ; le graphe d'activités en bas, sans barre de période à lui ; sur ordinateur,
//     la colonne « Vos activités » (rangée de logos qui filtre sur place, cinq lignes sans « … », « Toutes les sessions ») ;
//  3. les autres périodes règlent toute la page : « 30 jours » (trois sessions), « Depuis le début » (les six, une
//     barre par mois), choix retenu au rechargement ;
//  4. une ligne de la légende ouvre la page Sessions filtrée sur son activité ;
//  5. à 390×844 : rien ne déborde, « Gtracker » sur la photo, pas de colonne « Vos activités », chiffres en une bande de deux sur deux, détail par activité retenu déplié ; la case « Profil » de la barre du bas (Profil, Sessions, Statistiques, Réglages) ouvre la page, allumée ;
//     à 320 px, aucune case de la bande ne sort de l'écran (la bande « qui dépasse » de la maquette du 22/10) ;
//  6. deux sessions d'activités cachées (planche à voile et bateau, cachées au départ) : absentes du Profil, rien ne
//     change (quatre sessions, trois parts, ni « Autres ») ; une session de surf passée en Pumping dans son analyse :
//     une quatrième part, la ligne de la légende ouvre ses sessions ;
//  7. la photo : au départ l'avatar vide (disque à silhouette, même avec des sessions), nommé « Choisir une photo de
//     profil » ; toucher la photo ouvre le choix des onze logos ; un logo choisi (dans son cadre), puis une image
//     importée (réduite à 256 px, en JPEG), tous deux retenus au rechargement ; « Retirer » rend l'avatar vide.
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node profil.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, records, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

// --- Sessions synthétiques : 20 min en ligne droite vers l'est, à 1 Hz, à 10 h du jour voulu ---
const day = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
};
const gpxOf = (type, daysAgo, speedMs) => traceSurf({ debutMs: day(daysAgo), phases: [[1200, speedMs, 90]], type, nom: `${type} ${daysAgo}` });
// Les quatre premières dans l'année en cours, les deux dernières l'an passé : le script n'a de sens qu'après le
// 30 mars (une sortie à 92 jours) et avant que 345 jours ne repassent dans l'année (toujours vrai).
const SESSIONS = [
  ['wingfoil', 2, 3.4], ['wingfoil', 16, 3.0], ['surf', 9, 6], ['kite', 92, 9],
  ['wingfoil', 400, 3.0], ['surf', 430, 6],
];
const yearOf = (daysAgo) => new Date(day(daysAgo)).getFullYear();
const thisYear = new Date().getFullYear();
const current = SESSIONS.filter(([, d]) => yearOf(d) === thisYear);
const previous = SESSIONS.filter(([, d]) => yearOf(d) === thisYear - 1);
if (current.length !== 4 || previous.length !== 2) {
  console.error(`Dates hors du cadre du script (${current.length} sessions cette année, ${previous.length} l'an passé).`);
  process.exit(1);
}
const kmOf = (list) => list.reduce((n, [, , v]) => n + v * 1200, 0) / 1000;

const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
const figures = () => evaluate(`[...document.querySelectorAll('.profile-figure')].map((f) => f.querySelector('.profile-figure__value')?.textContent ?? '')`);
const legend = () => evaluate(`[...document.querySelectorAll('.profile-legend li')].map((li) => li.textContent)`);
const search = () => evaluate('location.pathname + location.search');
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
const pick = (label) => evaluate(`(() => {
  const b = [...document.querySelectorAll('.profile-periods [role=radio]')].find((el) => el.textContent.replace(/\\u00a0/g, ' ').trim() === ${JSON.stringify(label)});
  if (!b) return false;
  b.click();
  return true;
})()`);
const pressed = () => evaluate(`document.querySelector('.profile-periods [role=radio][aria-checked=true]')?.textContent.replace(/\\u00a0/g, ' ').trim() ?? null`);
const favorite = () => text('.profile-figure__name');
const chartCount = () => text('.actchart__head span');
/** Nombre lu à la française : espaces fines de milliers, virgule décimale. */
const parseFr = (s) => Number((s ?? '').replace(/[^\d,]/g, '').replace(',', '.'));

// --- Mise en place ---
await go('/sessions', 5000);
await waitFor(`Boolean(document.querySelector('input[type=file][accept*=".gpx"]'))`, { timeout: 3000, every: 50 });
console.log('import :', await evaluate(`(() => {
  const input = document.querySelector('input[type=file][accept*=".gpx"]');
  if (!input) return 'absent';
  const dt = new DataTransfer();
  for (const [name, text] of ${JSON.stringify(SESSIONS.map(([type, d, v]) => [`${type}-${d}.gpx`, gpxOf(type, d, v)]))}) {
    dt.items.add(new File([text], name, { type: 'application/gpx+xml' }));
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`));
await waitFor(async () => (await records())?.length === SESSIONS.length, { timeout: 12000, label: 'fiches' });
await settle({ max: 2000, label: 'import' });

// 1. L'ouverture : « / » mène au Profil, d'où la liste des sessions se prend par la barre du haut.
await go('/');
check("ouverture : « / » mène à /profil", (await search()) === '/profil', await search());
const backdrop = () => evaluate(`document.querySelector('.page-backdrop')?.getAttribute('class') ?? null`);
check('Profil : pas de fond dessiné derrière la page', (await backdrop()) === null, await backdrop());
check('barre du haut : Profil allumé à l\'ouverture', await evaluate(`[...document.querySelectorAll('.shell-toplink')].some((a) => a.textContent.trim() === 'Profil' && a.classList.contains('active'))`));
await go('/sessions');
const opened = await evaluate(`(() => {
  const a = [...document.querySelectorAll('.shell-toplink')].find((el) => el.textContent.trim() === 'Profil');
  if (!a) return false;
  a.click();
  return true;
})()`);
check('barre du haut : lien « Profil »', opened);
await settle({ max: 1500 });
check('le lien ouvre la page', (await search()) === '/profil', await search());
check('barre du haut : Profil, allumé', await evaluate(`[...document.querySelectorAll('.shell-toplink')].some((a) => a.textContent.trim() === 'Profil' && a.classList.contains('active'))`));

// 2. L'année en cours.
check('en-tête : « Live for it. » sur la photo', (await text('.profile-hero__motto')) === 'Live for it.', await text('.profile-hero__motto'));
check('titre : « Bienvenue » seul, sans pseudo', (await text('.profile-head__title')) === 'Bienvenue' && (await evaluate(`document.querySelector('.profile-head__hello') === null`)), await text('.profile-head__title'));
check('lien du test de FC repos sous le titre', (await text('.profile-head__link')) === 'Test de FC repos', await text('.profile-head__link'));
check('périodes en tête, « Année » au départ', (await evaluate(`[...document.querySelectorAll('.profile-periods [role=radio]')].map((b) => b.textContent.replace(/\\u00a0/g, ' ').trim()).join(' | ')`))
  === 'Semaine | 30 jours | 6 mois | Année | Depuis le début' && (await pressed()) === 'Année', await pressed());
check("plus de flèches d'année", (await evaluate(`!!document.querySelector('.profile-year')`)) === false);
check("le graphe n'a plus sa propre barre de période", (await evaluate(`!!document.querySelector('.actchart__periods')`)) === false);
let [count, distance] = await figures();
check('nombre d\'activités de l\'année, en tête de la bande', count === '4', count);
const km = parseFr(distance);
check('distance de l\'année, en km', distance?.endsWith('km') && Math.abs(km - kmOf(current)) / kmOf(current) < 0.05, `${distance} pour ${kmOf(current).toFixed(1)} attendus`);
check('plus de case « Temps »', !(await evaluate(`[...document.querySelectorAll('.profile-figure .ui-eyebrow')].some((e) => e.textContent === 'Temps')`)));
check('sport préféré : Wingfoil, avec son dessin', (await favorite()) === 'Wingfoil'
  && (await evaluate(`!!document.querySelector('.profile-figure--link svg.profile-figure__art use[href="#gt-logo-wingfoil"]')`)), await favorite());
check('plus de case « Dénivelé »', !(await evaluate(`[...document.querySelectorAll('.profile-figure .ui-eyebrow')].some((e) => e.textContent === 'Dénivelé')`)));
check('nombre de sessions (graphe)', (await chartCount()) === '4 sessions', await chartCount());
const ordre = await evaluate(`[...document.querySelectorAll('.profile > *')].map((el) => (el.getAttribute('class') ?? '').split(' ')[0] || el.tagName).join(' > ')`);
check('ordre : en-tête, période, chiffres, répartition, graphe', /^profile-head > ui-segmented.*profile-figures.*profile-split.*actchart/.test(ordre ?? ''), ordre);
// Colonne de droite, sur ordinateur (à partir de 1000 px) : « Vos activités », la rangée de logos et les cinq dernières sessions.
const activites = () => evaluate(`(() => {
  const s = document.querySelector('.profile-activities');
  if (!s) return null;
  return { titre: s.querySelector('h2')?.textContent ?? '', lien: s.querySelector('a.ui-btn')?.textContent.trim() ?? '', href: s.querySelector('a.ui-btn')?.getAttribute('href') ?? '',
    lignes: s.querySelectorAll('.lib-row').length, menus: s.querySelectorAll('button[aria-label="Plus d\\'actions sur la session"]').length };
})()`);
const roundsHere = () => evaluate(`[...document.querySelectorAll('.profile-activities .activity-bubble')].map((x) => x.querySelector('.activity-bubble__name')?.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(', ')`);
const act = await activites();
check('ordinateur : colonne « Vos activités », « Toutes les sessions », cinq lignes sans « … »', act?.titre === 'Vos activités' && act.lien === 'Toutes les sessions'
  && act.href === '/sessions' && act.lignes === 5 && act.menus === 0, JSON.stringify(act));
check('ordinateur : rangée de logos de la colonne', (await roundsHere()) === 'Toutes*, Wingfoil, Kite, Surf, Pumping', await roundsHere());
await evaluate(`[...document.querySelectorAll('.profile-activities .activity-bubble')].find((x) => x.textContent.includes('Kite'))?.click()`);
await wait(300);
const actKite = await activites();
check('un logo filtre les lignes sur place, le lien garde le filtre', actKite?.lignes === 1 && actKite.href.startsWith('/sessions?activite=') && (await search()) === '/profil', JSON.stringify(actKite));
await evaluate(`[...document.querySelectorAll('.profile-activities .activity-bubble')].find((x) => x.textContent.includes('Toutes'))?.click()`);
await wait(300);
check('« Toutes » rend les cinq lignes', (await activites())?.lignes === 5 && (await activites())?.href === '/sessions');
check('détail par activité replié au départ', (await evaluate(`document.querySelector('.profile-fold')?.getAttribute('aria-expanded')`)) === 'false'
  && (await legend()).length === 0);
await evaluate(`document.querySelector('.profile-fold').click()`);
await wait(300);
let rows = await legend();
check('légende : une ligne par activité, Wingfoil en tête à 50 %', rows?.length === 3 && rows[0].endsWith('50 %') && rows[0].includes('40 min')
  && rows.slice(1).every((r) => r.endsWith('25 %')), JSON.stringify(rows));
check('anneau : trois parts', (await evaluate(`document.querySelectorAll('.profile-donut g circle').length`)) === 3);
check('centre de l\'anneau : le total', (await text('.profile-donut__center')) === 'Total1 h 20', await text('.profile-donut__center'));
await evaluate(`document.querySelector('.profile-legend li').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);
await wait(200);
check('survol d\'une ligne : sa part au centre', (await text('.profile-donut__center'))?.endsWith('40 min50 %'), await text('.profile-donut__center'));
await evaluate(`document.querySelector('.profile-legend li').dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
await shoot('profil-ordinateur');

// 3. Les autres périodes règlent toute la page.
const recent = SESSIONS.filter(([, d]) => d <= 29);
check('« 30 jours »', await pick('30 jours'));
await wait(500);
[, distance] = await figures();
check('30 jours : chiffres', Math.abs(parseFr(distance) - kmOf(recent)) / kmOf(recent) < 0.05 && (await favorite()) === 'Wingfoil' && (await chartCount()) === '3 sessions',
  `${distance} ; ${await favorite()} ; ${await chartCount()}`);
rows = await legend();
check('30 jours : légende sans le kite', rows?.length === 2, JSON.stringify(rows));
check('30 jours : une barre par jour', (await evaluate(`document.querySelectorAll('.actchart__bar').length`)) === 30);
check('« Depuis le début »', await pick('Depuis le début'));
await wait(500);
[count, distance] = await figures();
check('depuis le début : six sessions', count === '6', count);
check('depuis le début : les six sessions', Math.abs(parseFr(distance) - kmOf(SESSIONS)) / kmOf(SESSIONS) < 0.05 && (await text('.profile-donut__center')) === 'Total2 h 00'
  && (await chartCount()) === '6 sessions', `${distance} ; ${await text('.profile-donut__center')} ; ${await chartCount()}`);
check('depuis le début : un mois par barre', (await text('.actchart__head h2')) === 'Depuis le début, par mois'
  && (await evaluate(`document.querySelectorAll('.actchart__bar').length`)) >= 14, await text('.actchart__head h2'));
await go('/profil');
check('choix retenu au rechargement', (await pressed()) === 'Depuis le début', await pressed());
check('« Année » de nouveau', await pick('Année'));
await wait(500);
check("retour à l'année", (await chartCount()) === '4 sessions', await chartCount());

// 4. Le sport préféré, puis une ligne de la légende, ouvrent la bibliothèque de leur activité.
await evaluate(`document.querySelector('.profile-figure--link').click()`);
await settle({ max: 1500 });
check('le sport préféré ouvre sa liste de sessions', (await search())?.startsWith('/sessions?activite=wingfoil'), await search());
await go('/profil');
await evaluate(`document.querySelector('.profile-legend__row').click()`);
await settle({ max: 1500 });
check('la ligne ouvre la page Sessions filtrée', (await search())?.startsWith('/sessions?activite='), await search());

// 5. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/profil');
check('390 px : rien ne déborde', !(await overflow()));
check('390 px : « Gtracker » sur la photo, pas de colonne « Vos activités »', (await text('.profile-hero__name')) === 'Gtracker' && (await activites()) === null, await text('.profile-hero__name'));
/** Bande des chiffres : deux cases sur deux lignes, aucune hors de l'écran. */
const twoByTwo = () => evaluate(`(() => {
  const f = [...document.querySelectorAll('.profile-figure')].map((el) => el.getBoundingClientRect());
  return f.length === 3 && Math.abs(f[1].top - f[0].top) < 1 && f[2].top > f[0].top
    && f.every((r) => r.left >= 0 && r.right <= window.innerWidth);
})()`);
check('390 px : chiffres deux puis un, dans l\'écran', await twoByTwo());
const periodsFit = () => evaluate(`(() => { const r = document.querySelector('.profile-periods'); return r.scrollWidth <= r.clientWidth; })()`);
check('390 px : les cinq périodes tiennent sans défiler', await periodsFit());
check('390 px : détail par activité toujours déplié (état retenu)', (await legend()).length === 3);
await shoot('profil-telephone');
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/profil');
check('320 px : rien ne déborde, la bande non plus', !(await overflow()) && (await twoByTwo()));
check('320 px : les cinq périodes tiennent sans défiler', await periodsFit());
check('320 px : aucun chiffre plus large que sa case', await evaluate(`[...document.querySelectorAll('.profile-figure__value')].every((v) => v.scrollWidth <= v.clientWidth + 1)`));
await shoot('profil-320');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/sessions');
const tab = `[...document.querySelectorAll('.shell-tabbar .shell-tab')].find((t) => t.textContent.trim() === 'Profil')`;
check('barre du bas : Profil, Sessions, Statistiques, Réglages',
  (await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((t) => t.textContent.trim()).join(' | ')`)) === 'Profil | Sessions | Statistiques | Réglages');
await evaluate(`${tab}.click()`);
await settle({ max: 1000 });
check('la case Profil ouvre la page, allumée', (await search()) === '/profil' && (await evaluate(`${tab}.classList.contains('active')`)), await search());
check('390 px : barre du bas sans débordement', !(await overflow()));

// 6. Deux sessions d'activités cachées (planche à voile, bateau), cette semaine : le Profil ne les compte pas, rien ne
// change (les fiches existent) ; puis une session de surf passée en Pumping : une quatrième part, sans « Autres ».
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
/** Importe des traces par le champ de fichier de la page courante (une seule fois par page : `DataTransfer`). */
const importMany = (list) => evaluate(`(() => {
  const input = document.querySelector('input[type=file][accept*=".gpx"]');
  if (!input) return 'absent';
  const dt = new DataTransfer();
  for (const [name, text] of ${JSON.stringify(list)}) dt.items.add(new File([text], name, { type: 'application/gpx+xml' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`);
const HIDDEN = [['windsurf', 3, 8], ['bateau', 4, 4]];
await go('/sessions', 4000);
await waitFor(`Boolean(document.querySelector('input[type=file][accept*=".gpx"]'))`, { timeout: 3000, every: 50 });
console.log('import des deux sessions cachées :', await importMany(HIDDEN.map(([type, d, v]) => [`${type}-${d}.gpx`, gpxOf(type, d, v)])));
await waitFor(async () => (await records())?.length === SESSIONS.length + HIDDEN.length, { timeout: 12000, label: 'fiches' });
await settle({ max: 2000, label: 'import' });
check('les deux fiches de planche à voile et de bateau sont rangées', (await records()).filter((r) => ['windsurf', 'bateau'].includes(r.sport)).length === 2,
  (await records()).map((r) => r.sport).join(' '));
await go('/profil');
await wait(300);
check('activités cachées : toujours quatre sessions, trois parts, sans « Autres »', (await figures())[0] === '4'
  && (await evaluate(`document.querySelectorAll('.profile-donut g circle').length`)) === 3 && !(await legend())?.some((row) => row.startsWith('Autres')),
  `${(await figures())[0]} ; ${JSON.stringify(await legend())}`);
// Une session de surf, importée par la page Surf, passée en Pumping dans l'onglet réglages de son analyse.
await go('/sessions', 4000);
await waitFor(`Boolean(document.querySelector('input[type=file][accept*=".gpx"]'))`, { timeout: 3000, every: 50 });
console.log('import de la session à passer en Pumping :', await importMany([['pompage-5.gpx', traceSurf({ debutMs: day(5), phases: [[1200, 4, 90]], type: 'surf', nom: 'pompage 5' })]]));
await waitFor(async () => (await records())?.some((r) => Math.abs(r.summary.startMs - day(5)) < 2000), { timeout: 12000, label: 'fiche du pumping' });
await settle({ max: 2000, label: 'import' });
const pompage = (await records()).find((r) => Math.abs(r.summary.startMs - day(5)) < 2000);
await go(`/surf/analyse?session=${encodeURIComponent(pompage?.gpx ?? '')}`, 8000);
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'réglages')`, { timeout: 30000, every: 200, label: 'onglets avancés' });
await evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === 'réglages');
  if (t && t.getAttribute('aria-pressed') !== 'true') t.click();
})()`);
await settle({ max: 800, label: 'onglet réglages' });
const pumping = await evaluate(`(async () => {
  for (const button of document.querySelectorAll('button.activity-select:not(:disabled)')) {
    button.click();
    await new Promise((r) => setTimeout(r, 150));
    const item = [...document.querySelectorAll('.activity-select__option')].find((o) => o.textContent.trim() === 'Pumping');
    if (item) { item.click(); return 'ok'; }
    document.querySelector('.activity-select__backdrop')?.click();
    await new Promise((r) => setTimeout(r, 150));
  }
  return 'absent';
})()`);
const passee = await waitFor(async () => (await records()).find((r) => r.gpx === pompage?.gpx)?.activityId !== pompage?.activityId, { timeout: 5000, label: 'activité changée' });
check('la session de surf passe en Pumping', pumping === 'ok' && Boolean(passee), `${pumping} ; ${(await records()).find((r) => r.gpx === pompage?.gpx)?.activityId}`);
await go('/profil');
await wait(300);
rows = await legend();
check('quatre parts dans l\'anneau, Pumping avec sa part, sans « Autres »', (await evaluate(`document.querySelectorAll('.profile-donut g circle').length`)) === 4
  && rows?.some((row) => row.startsWith('Pumping')) && !rows?.some((row) => row.startsWith('Autres')), JSON.stringify(rows));
await shoot('profil-quatre');
// Détail déplié, pour toucher une ligne de la légende.
if ((await evaluate(`document.querySelector('.profile-fold')?.getAttribute('aria-expanded')`)) !== 'true') await evaluate(`document.querySelector('.profile-fold')?.click()`);
await wait(300);
await evaluate(`[...document.querySelectorAll('.profile-legend__row')].find((row) => row.textContent.startsWith('Pumping'))?.click()`);
await settle({ max: 1500 });
check('la ligne Pumping ouvre sa liste de sessions', /^\/sessions\?activite=/.test((await search()) ?? ''), await search());

// 7. La photo.
await go('/profil');
const avatarState = () => evaluate(`(() => {
  const b = document.querySelector('.profile-head__avatar');
  const img = b?.querySelector('img');
  if (img) return 'photo ' + img.naturalWidth + ' ' + img.getAttribute('src').slice(0, 15);
  if (b?.querySelector('.profile-avatar__disc--empty svg')) return 'vide';
  const logo = b?.querySelector('.profile-avatar__disc svg.activity-logo');
  if (!logo) return 'rien';
  const [frame, glyph] = [...logo.querySelectorAll('use')];
  return 'logo ' + glyph?.getAttribute('href') + (frame?.getAttribute('href') === '#gt-logo-frame' && frame.getAttribute('color') ? ' encadré' : '');
})()`);
const before = await avatarState();
check('photo au départ : l\'avatar vide, malgré des sessions et un sport préféré', before === 'vide', before);
check('l\'avatar vide dit qu\'on peut le choisir', (await evaluate(`document.querySelector('.profile-head__avatar')?.getAttribute('aria-label')`)) === 'Choisir une photo de profil');
await shoot('profil-avatar-vide');
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
check('toucher la photo ouvre le choix des onze logos', (await evaluate(`document.querySelectorAll('.avatar-picker__choice').length`)) === 11);
await evaluate(`document.querySelector('.avatar-picker__choice[aria-label="Kite"]').click()`);
await wait(300);
check('un logo choisi : le choix se ferme, la photo suit', !(await evaluate(`!!document.querySelector('.avatar-picker')`)) && (await avatarState()) === 'logo #gt-logo-kite encadré', await avatarState());
await go('/profil');
check('… retenu au rechargement', (await avatarState()) === 'logo #gt-logo-kite encadré', await avatarState());
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
check('le logo choisi est cerclé', (await evaluate(`document.querySelector('.avatar-picker__choice[aria-pressed=true]')?.getAttribute('aria-label')`)) === 'Kite');
console.log('image importée :', await evaluate(`(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 500;
  const g = canvas.getContext('2d');
  g.fillStyle = '#d11a1a'; g.fillRect(0, 0, 800, 500);
  g.fillStyle = '#ffffff'; g.fillRect(300, 150, 200, 200);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const input = document.querySelector('.avatar-picker input[type=file]');
  if (!input) return 'champ absent';
  const dt = new DataTransfer();
  dt.items.add(new File([blob], 'moi.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`));
await settle({ max: 1500 });
check('image importée : réduite à 256 px, en JPEG, le choix fermé', (await avatarState()) === 'photo 256 data:image/jpeg' && !(await evaluate(`!!document.querySelector('.avatar-picker')`)), await avatarState());
await go('/profil');
check('… retenue au rechargement', (await avatarState()) === 'photo 256 data:image/jpeg', await avatarState());
await shoot('profil-photo');
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
await evaluate(`[...document.querySelectorAll('.avatar-picker button')].find((b) => b.textContent.trim() === 'Retirer').click()`);
await wait(300);
check('« Retirer » rend l\'avatar vide', (await avatarState()) === 'vide', await avatarState());
await go('/profil');
check('… vide au rechargement', (await avatarState()) === 'vide', await avatarState());

// Ce script ne relève que les erreurs de console, pas les avertissements.
const errors = logs.filter((l) => !l.startsWith('warning:'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : aucune erreur');

await finish('Tout passe.');
