// Banc de test : la page « Profil » (demandes du 18/10, du 19/10 et du 20/10), une période en un coup d'œil.
// Usage : node profil.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique six sessions de 20 min en ligne droite (`traceSurf`, une seule
// phase), datées en jours avant aujourd'hui (deux de wingfoil, une de surf et une de kite cette année, une de wingfoil
// et une de surf l'an passé), les importe par la page Voile, et vérifie :
//  1. l'accueil : plus de graphe d'activités, pas de ligne « Profil » ; « Profil » dans la barre du haut, qui ouvre la page ;
//  2. la période en tête (bouton glissant), « Année » au départ : distance (somme des vitesses × durées, à 5 % près),
//     sport préféré (Wingfoil, avec son dessin, qui ouvre sa bibliothèque), nombre de sessions du graphe ; l'anneau et
//     sa légende (une part par activité, Wingfoil à 50 %) ; le graphe d'activités en bas, sans barre de période à lui ;
//  3. les autres périodes règlent toute la page : « 30 jours » (trois sessions), « Depuis le début » (les six, une
//     barre par mois), choix retenu au rechargement ;
//  4. une ligne de la légende ouvre la bibliothèque filtrée sur son activité ;
//  5. à 390×844 : rien ne déborde, chiffres en une bande de deux sur deux, détail par activité retenu déplié ; la case « Profil » de la barre du bas ouvre la page, allumée ;
//     à 320 px, aucune case de la bande ne sort de l'écran (la bande « qui dépasse » de la maquette du 22/10) ;
//  6. deux sessions d'activités cachées (planche à voile et bateau, cachées au départ) : absentes du Profil, rien ne
//     change (quatre sessions, trois parts, ni « Autres ») ; une session de surf passée en Pumping dans son analyse :
//     une quatrième part, la ligne de la légende ouvre sa bibliothèque ;
//  7. la photo (22/10) : au départ le dessin du sport préféré ; toucher la photo ouvre le choix des neuf dessins ;
//     un dessin choisi, puis une image importée (réduite à 256 px, en JPEG), tous deux retenus au rechargement ;
//     « Retirer » rend le dessin du sport préféré.
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
await go('/voile', 5000);
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

// 1. Accueil.
await go('/');
check('accueil : plus de graphe d\'activités', (await evaluate(`!!document.querySelector('.actchart')`)) === false);
const backdrop = () => evaluate(`document.querySelector('.page-backdrop')?.getAttribute('class')`);
// Fond des pages hors sport (lot 3 du 23/10) : le motif de la famille du sport préféré de toutes les sessions, la voile.
check('accueil : fond de la famille du sport préféré', (await backdrop()) === 'page-backdrop page-backdrop--voile', await backdrop());
check('accueil : plus de ligne « Profil » (demande du 19/10)', !(await evaluate(`[...document.querySelectorAll('.home-link')].some((el) => el.textContent.trim() === 'Profil')`)));
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
check('titre', (await text('.profile-head__title')) === 'Profil', await text('.profile-head__title'));
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
  && (await evaluate(`!!document.querySelector('.profile-figure--link svg.profile-figure__art path')`)), await favorite());
check('plus de case « Dénivelé »', !(await evaluate(`[...document.querySelectorAll('.profile-figure .ui-eyebrow')].some((e) => e.textContent === 'Dénivelé')`)));
check('nombre de sessions (graphe)', (await chartCount()) === '4 sessions', await chartCount());
const ordre = await evaluate(`[...document.querySelectorAll('.profile > *')].map((el) => (el.getAttribute('class') ?? '').split(' ')[0] || el.tagName).join(' > ')`);
check('ordre : fond, en-tête, période, chiffres, répartition, graphe', /^page-backdrop > profile-head > ui-segmented.*profile-figures.*profile-split.*actchart/.test(ordre ?? ''), ordre);
check('Profil : fond de la famille du sport préféré', (await backdrop()) === 'page-backdrop page-backdrop--voile', await backdrop());
check('détail par activité replié au départ', (await evaluate(`document.querySelector('.profile-fold')?.getAttribute('aria-expanded')`)) === 'false'
  && (await legend()).length === 0);
await evaluate(`document.querySelector('.profile-fold').click()`);
await wait(300);
let rows = await legend();
check('légende : une ligne par activité, Wingfoil en tête à 50 %', rows?.length === 3 && rows[0].endsWith('50 %') && rows[0].includes('40 min')
  && rows.slice(1).every((r) => r.endsWith('25 %')), JSON.stringify(rows));
check('anneau : trois parts', (await evaluate(`document.querySelectorAll('.profile-donut circle').length`)) === 3);
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
check('le sport préféré ouvre sa bibliothèque', (await search())?.startsWith('/voile?activite=wingfoil'), await search());
await go('/profil');
await evaluate(`document.querySelector('.profile-legend__row').click()`);
await settle({ max: 1500 });
check('la ligne ouvre la bibliothèque filtrée', (await search())?.startsWith('/voile?activite='), await search());

// 5. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/profil');
check('390 px : rien ne déborde', !(await overflow()));
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
await go('/');
const tab = `[...document.querySelectorAll('.shell-tabbar .shell-tab')].find((t) => t.textContent.trim() === 'Profil')`;
check('barre du bas : Accueil, Profil, Statistiques, Réglages',
  (await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((t) => t.textContent.trim()).join(' | ')`)) === 'Accueil | Profil | Statistiques | Réglages');
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
await go('/voile', 4000);
await waitFor(`Boolean(document.querySelector('input[type=file][accept*=".gpx"]'))`, { timeout: 3000, every: 50 });
console.log('import des deux sessions cachées :', await importMany(HIDDEN.map(([type, d, v]) => [`${type}-${d}.gpx`, gpxOf(type, d, v)])));
await waitFor(async () => (await records())?.length === SESSIONS.length + HIDDEN.length, { timeout: 12000, label: 'fiches' });
await settle({ max: 2000, label: 'import' });
check('les deux fiches de planche à voile et de bateau sont rangées', (await records()).filter((r) => ['windsurf', 'bateau'].includes(r.sport)).length === 2,
  (await records()).map((r) => r.sport).join(' '));
await go('/profil');
await wait(300);
check('activités cachées : toujours quatre sessions, trois parts, sans « Autres »', (await figures())[0] === '4'
  && (await evaluate(`document.querySelectorAll('.profile-donut circle').length`)) === 3 && !(await legend())?.some((row) => row.startsWith('Autres')),
  `${(await figures())[0]} ; ${JSON.stringify(await legend())}`);
// Une session de surf, importée par la page Surf, passée en Pumping dans l'onglet réglages de son analyse.
await go('/surf', 4000);
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
check('quatre parts dans l\'anneau, Pumping avec sa part, sans « Autres »', (await evaluate(`document.querySelectorAll('.profile-donut circle').length`)) === 4
  && rows?.some((row) => row.startsWith('Pumping')) && !rows?.some((row) => row.startsWith('Autres')), JSON.stringify(rows));
await shoot('profil-quatre');
// Détail déplié, pour toucher une ligne de la légende.
if ((await evaluate(`document.querySelector('.profile-fold')?.getAttribute('aria-expanded')`)) !== 'true') await evaluate(`document.querySelector('.profile-fold')?.click()`);
await wait(300);
await evaluate(`[...document.querySelectorAll('.profile-legend__row')].find((row) => row.textContent.startsWith('Pumping'))?.click()`);
await settle({ max: 1500 });
check('la ligne Pumping ouvre sa bibliothèque', /^\/surf\?activite=/.test((await search()) ?? ''), await search());

// 7. La photo.
await go('/profil');
const avatarState = () => evaluate(`(() => {
  const b = document.querySelector('.profile-head__avatar');
  const img = b?.querySelector('img');
  if (img) return 'photo ' + img.naturalWidth + ' ' + img.getAttribute('src').slice(0, 15);
  const disc = b?.querySelector('.profile-avatar__disc');
  return disc ? 'dessin ' + disc.style.background + (disc.querySelector('svg path') ? ' tracé' : '') : 'rien';
})()`);
const before = await avatarState();
check('photo au départ : le dessin du sport préféré, à sa couleur', /^dessin .+ tracé$/.test(before ?? ''), before);
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
check('toucher la photo ouvre le choix des neuf dessins', (await evaluate(`document.querySelectorAll('.avatar-picker__choice').length`)) === 9);
await evaluate(`document.querySelector('.avatar-picker__choice[aria-label="Kitesurf"]').click()`);
await wait(300);
check('un dessin choisi : le choix se ferme, la photo suit', !(await evaluate(`!!document.querySelector('.avatar-picker')`)) && (await avatarState()) === 'dessin var(--voile) tracé', await avatarState());
await go('/profil');
check('… retenu au rechargement', (await avatarState()) === 'dessin var(--voile) tracé', await avatarState());
await evaluate(`document.querySelector('.profile-head__avatar').click()`);
await wait(300);
check('le dessin choisi est cerclé', (await evaluate(`document.querySelector('.avatar-picker__choice[aria-pressed=true]')?.getAttribute('aria-label')`)) === 'Kitesurf');
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
check('« Retirer » rend le dessin du sport préféré', (await avatarState()) === before, await avatarState());

// Ce script ne relève que les erreurs de console, pas les avertissements.
const errors = logs.filter((l) => !l.startsWith('warning:'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : aucune erreur');

await finish('Tout passe.');
