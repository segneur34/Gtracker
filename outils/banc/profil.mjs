// Banc de test : la page « Profil » (demandes du 18/10, du 19/10 et du 20/10), une période en un coup d'œil.
// Usage : node profil.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique six sessions de 20 min en ligne droite (`traceSurf`, une seule
// phase), datées en jours avant aujourd'hui (deux de wingfoil, une de surf et une de kite cette année, une de wingfoil
// et une de surf l'an passé), les importe par la page Sessions, et vérifie :
//  1. l'ouverture : « / » mène au Profil, sans fond dessiné, allumé dans la barre du haut ; « Profil » dans la barre du
//     haut, depuis Sessions, ouvre la page ;
//  2. l'en-tête (« Live for it. », « Bienvenue » seul sans pseudo, aucun lien du test de FC repos) ; la période en tête
//     (bouton glissant), « Année » au départ : les trois activités favorites en ligne (Wingfoil, Surf, Kite : logos
//     de plus en plus petits, sessions et distance de chacune, à 5 % près pour la distance, somme des vitesses ×
//     durées ; chaque logo est un lien vers Sessions filtrée), la case « Total » à droite, nombre de sessions du graphe ; l'anneau et sa légende (une
//     part par activité, Wingfoil à 50 %) ; le graphe d'activités en bas, sans barre de période à lui ; sur ordinateur,
//     la colonne « Vos activités » (rangée de logos qui filtre sur place, cinq lignes sans « … », « Toutes les sessions ») ;
//  3. l'autre période règle toute la page : « Tout » (les six sessions, une barre par mois), choix retenu au
//     rechargement, puis retour à « Année <n> » ;
//  4. une ligne de la légende ouvre la page Sessions filtrée sur son activité ;
//  5. à 390×844 : rien ne déborde, le nom sans son G sous le logo GONG sur la photo, pas de colonne « Vos activités », les activités favorites et le total sur une seule rangée, détail par activité retenu déplié ; la case « Profil » de la barre du bas (Profil, Sessions, Statistiques, Réglages) ouvre la page, allumée ;
//     à 320 px, aucune case de la rangée ne sort de l'écran ni ne déborde de son texte ; le bouton de période sous la
//     photo ronde, à 390 et 320 px ; un ancien profil qui porte encore les champs du poisson dans son bocal (retiré)
//     ouvre le Profil sans erreur, sans bocal ;
//  6. deux sessions d'activités cachées (planche à voile et bateau, cachées au départ) : absentes du Profil, rien ne
//     change (quatre sessions, trois parts, ni « Autres ») ; une session de surf passée en Pumping dans son analyse :
//     une quatrième part, la ligne de la légende ouvre ses sessions ;
//  7. la photo : au départ l'avatar vide (disque à silhouette, même avec des sessions) ; la toucher ouvre la fenêtre
//     « Réglages du Profil » (photo, nom, poisson du banc, sessions du banc à l'essai), que ferment Échap et le retour ;
//     un logo choisi (dans son cadre), puis une image importée (réduite à 256 px, en JPEG), fenêtre restée ouverte,
//     tous deux retenus au rechargement ; « Retirer » rend l'avatar vide ; le nom tapé passe en titre ;
//  8. le banc de poissons (compte, eau, textes, places, dessin) ; dans Réglages › Pratiquant les mêmes quatre réglages ;
//     « Aucun » cache le banc et l'eau, un poisson les remontre, depuis Réglages puis depuis la fenêtre du Profil.
import { CLES, connect } from './lib/cdp.mjs';
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
/** Cases des activités favorites, puis du total : nom, sessions, distance, logo et côté du dessin, bords de la case. */
const favs = () => evaluate(`[...document.querySelectorAll('.profile-favs__cell')].map((c) => {
  const r = c.getBoundingClientRect();
  const svg = c.querySelector('svg');
  const uses = [...c.querySelectorAll('svg use')];
  return {
    name: c.querySelector('.profile-favs__name').textContent.trim(),
    sessions: c.querySelector('.profile-favs__sessions').textContent.trim(),
    distance: c.querySelector('.profile-favs__distance').textContent.trim(),
    logo: uses.length ? uses[uses.length - 1].getAttribute('href') : null,
    size: svg ? svg.getBoundingClientRect().width : 0,
    left: r.left, right: r.right, top: r.top,
    interactive: c.querySelector('a, button') !== null,
    // Ni un texte ni un logo ne sort de sa case : texte coupé (largeur du contenu) et rectangles des éléments contenus.
    fits: [...c.querySelectorAll('.profile-favs__name, .profile-favs__sessions, .profile-favs__distance')].every((t) => t.scrollWidth <= t.clientWidth + 1)
      && [...c.querySelectorAll('svg, .profile-favs__name, .profile-favs__sessions, .profile-favs__distance')].every((e) => {
        const b = e.getBoundingClientRect();
        return b.left >= r.left - 1 && b.right <= r.right + 1;
      }),
  };
})`);
const legend = () => evaluate(`[...document.querySelectorAll('.profile-legend li')].map((li) => li.textContent)`);
const search = () => evaluate('location.pathname + location.search');
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
const ANNEE = `Année ${new Date().getFullYear()}`; // nom lu par un lecteur d'écran
const ANNEE_AFFICHEE = String(new Date().getFullYear()); // libellé du bouton
/** Un seul bouton bascule entre « Année <n> » et « Tout » : on le touche seulement s'il ne montre pas déjà la période voulue. */
const pick = (label) => evaluate(`(() => {
  const b = document.querySelector('.profile-periods');
  if (!b) return false;
  if (b.textContent.trim() !== ${JSON.stringify(label)}) b.click();
  return true;
})()`);
const pressed = () => evaluate(`document.querySelector('.profile-periods')?.textContent.trim() ?? null`);
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
check('aucun lien du test de FC repos dans l\'en-tête', await evaluate(`!document.querySelector('.profile-head__link') && !document.querySelector('.profile-head').innerText.includes('Test de FC repos')`));
check('période en tête : un seul bouton, « Année <n> » au départ, son libellé dit ce que fait le toucher',
  (await evaluate(`document.querySelectorAll('.profile-periods').length`)) === 1 && (await pressed()) === ANNEE_AFFICHEE
  && (await evaluate(`document.querySelector('.profile-periods').getAttribute('aria-label')`)) === `Période : ${ANNEE}. Toucher pour afficher : Tout.`, await pressed());
check("plus de flèches d'année", (await evaluate(`!!document.querySelector('.profile-year')`)) === false);
check("le graphe n'a plus sa propre barre de période", (await evaluate(`!!document.querySelector('.actchart__periods')`)) === false);
const kmOfActivity = (list, type) => kmOf(list.filter(([t]) => t === type));
const near = (text, km) => text?.endsWith('km') && Math.abs(parseFr(text) - km) / km < 0.05;
let cells = await favs();
check('activités favorites : Wingfoil, Surf, Kite, puis la case « Total »', cells.map((c) => c.name).join(' | ') === 'Wingfoil | Surf | Kite | Total', cells.map((c) => c.name).join(' | '));
check('sessions de chacune : « 2 sessions », « 1 session », « 1 session »', cells.slice(0, 3).map((c) => c.sessions).join(' | ') === '2 sessions | 1 session | 1 session', cells.map((c) => c.sessions).join(' | '));
check('distance de chacune, en km, et du total', near(cells[0].distance, kmOfActivity(current, 'wingfoil')) && near(cells[1].distance, kmOfActivity(current, 'surf'))
  && near(cells[2].distance, kmOfActivity(current, 'kite')) && near(cells[3].distance, kmOf(current)), cells.map((c) => c.distance).join(' | '));
check('logos de plus en plus petits, du premier au troisième (celui de Wingfoil, de Kite)', cells[0].logo === '#gt-logo-wingfoil' && cells[2].logo === '#gt-logo-kite'
  && cells[0].size > cells[1].size && cells[1].size > cells[2].size && cells[2].size >= 40 && cells[3].logo === null, cells.map((c) => `${c.logo} ${c.size}`).join(' ; '));
check('en ligne, de gauche à droite, le total à droite', cells.every((c, i) => i === 0 || (c.left >= cells[i - 1].right - 1 && Math.abs(c.top - cells[0].top) < 1)), JSON.stringify(cells.map((c) => [c.left, c.top])));
check('chaque logo favori est un lien « Sessions de … », la case « Total » n\'en est pas un',
  (await evaluate(`[...document.querySelectorAll('.profile-favs__cell a')].map((a) => a.getAttribute('aria-label')).join(' | ')`)) === 'Sessions de Wingfoil | Sessions de Surf | Sessions de Kite'
  && cells.slice(0, 3).every((c) => c.interactive) && !cells[3].interactive);
check('ancienne bande des trois chiffres disparue', !(await evaluate(`!!document.querySelector('.profile-figures, .profile-figure')`)));
check('nombre de sessions (graphe)', (await chartCount()) === '4 sessions', await chartCount());
const ordre = await evaluate(`[...document.querySelectorAll('.profile > :not(.profile-openers), .profile > .profile-openers > *')].map((el) => (el.getAttribute('class') ?? '').split(' ')[0] || el.tagName).join(' > ')`);
check('ordre : en-tête, activités favorites, répartition, graphe (sans ligne de période)', /^profile-head > (?!ui-btn).*profile-favs.*profile-split.*actchart/.test(ordre ?? '') && !/ui-btn/.test(ordre ?? ''), ordre);
/** Le bouton de période est-il sous la photo ronde, de sa largeur à peu près ? */
const periodsUnderAvatar = () => evaluate(`(() => { const b = document.querySelector('.profile-head .profile-periods')?.getBoundingClientRect(); const a = document.querySelector('.profile-head__avatar')?.getBoundingClientRect(); return !!b && !!a && b.top >= a.bottom - 1 && b.top - a.bottom < 16 && b.left >= a.left - 1 && b.right <= a.right + 1 && b.width >= a.width * 0.8; })()`);
check('le bouton de période est dans l\'en-tête, sous la photo ronde', await periodsUnderAvatar());
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
check('« Tout »', await pick('Tout'));
await wait(500);
cells = await favs();
check('depuis le début : Wingfoil (3 sessions), Surf (2), Kite (1)', cells.map((c) => `${c.name} ${c.sessions}`).slice(0, 3).join(' | ') === 'Wingfoil 3 sessions | Surf 2 sessions | Kite 1 session', JSON.stringify(cells.map((c) => [c.name, c.sessions])));
check('depuis le début : les six sessions', near(cells[3].distance, kmOf(SESSIONS)) && (await text('.profile-donut__center')) === 'Total2 h 00'
  && (await chartCount()) === '6 sessions', `${cells[3].distance} ; ${await text('.profile-donut__center')} ; ${await chartCount()}`);
check('depuis le début : un mois par barre', (await text('.actchart__head h2')) === 'Depuis le début, par mois'
  && (await evaluate(`document.querySelectorAll('.actchart__bar').length`)) >= 14, await text('.actchart__head h2'));
await go('/profil');
check('choix retenu au rechargement', (await pressed()) === 'Tout', await pressed());
check('« Année » de nouveau', await pick(ANNEE_AFFICHEE));
await wait(500);
check("retour à l'année", (await chartCount()) === '4 sessions', await chartCount());

// 4. Une ligne de la légende ouvre la bibliothèque de son activité ; toucher un logo favori ouvre Sessions filtrée sur lui.
await evaluate(`document.querySelector('.profile-favs__cell a').click()`);
await settle({ max: 1500 });
check('toucher le premier logo favori ouvre Sessions filtrée, ce logo allumé dans la rangée',
  (await search())?.startsWith('/sessions?activite=')
  && (await evaluate(`document.querySelector('.activity-bubble[aria-pressed="true"] .activity-bubble__name')?.textContent`)) === 'Wingfoil', await search());
await go('/profil');
await evaluate(`document.querySelector('.profile-legend__row').click()`);
await settle({ max: 1500 });
check('la ligne ouvre la page Sessions filtrée', (await search())?.startsWith('/sessions?activite='), await search());

// 5. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/profil');
check('390 px : rien ne déborde', !(await overflow()));
check('390 px : le nom sans son G sous le logo GONG sur la photo, pas de colonne « Vos activités »', (await text('.profile-hero__name')) === 'tracker' && (await activites()) === null, await text('.profile-hero__name'));
/** Rangée des activités favorites : quatre cases sur une seule ligne, dans l'écran, sans texte qui déborde de sa case. */
const viewportWidth = () => evaluate('window.innerWidth');
const rowFits = async () => {
  const [c, w] = [await favs(), await viewportWidth()];
  return c.length === 4 && c.every((x, i) => Math.abs(x.top - c[0].top) < 1 && x.left >= 0 && x.right <= w && x.fits && (i === 0 || x.left >= c[i - 1].right - 1));
};
check('390 px : activités favorites et total sur une rangée, dans l\'écran', await rowFits(), JSON.stringify(await favs()));
const periodsFit = () => evaluate(`(() => { const r = document.querySelector('.profile-periods').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })()`);
check('390 px : le bouton de période tient dans l\'écran', await periodsFit());
check('390 px : détail par activité toujours déplié (état retenu)', (await legend()).length === 3);
await shoot('profil-telephone');
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await go('/profil');
check('320 px : rien ne déborde, la rangée des activités favorites non plus', !(await overflow()) && (await rowFits()), JSON.stringify(await favs()));
check('320 px : le bouton de période tient dans l\'écran', await periodsFit());
await shoot('profil-320');

// 5 bis. Le bouton de période sous la photo ronde, à 390 et 320 px ; un ancien profil qui porte encore les champs du
// poisson dans son bocal (retiré) ouvre le Profil sans erreur, sans bocal.
/** Pose des champs du profil du pratiquant. */
const setAthlete = (fields) => evaluate(`(() => {
  const all = JSON.parse(localStorage.getItem('${CLES.athleteProfile}') ?? '{}');
  all.me = { ...(all.me ?? {}), ...${JSON.stringify(fields)} };
  localStorage.setItem('${CLES.athleteProfile}', JSON.stringify(all));
  return 'ok';
})()`);
for (const width of [390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 640, deviceScaleFactor: 2, mobile: true });
  await go('/profil');
  check(`${width} px : le bouton de période sous la photo ronde`, await periodsUnderAvatar());
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await setAthlete({ fishStyle: 'B', fishPath: 'agressif', fishTrialLevel: 3 });
await go('/profil');
check('un ancien profil avec les champs du bocal ouvre le Profil, sans bocal ni fenêtre du poisson',
  (await evaluate(`!!document.querySelector('.profile-head') && !document.querySelector('.profile-fish, .fish-picker')`)) && !(await overflow()));
await setAthlete({ fishStyle: null, fishPath: null, fishTrialLevel: null });
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
check('activités cachées : toujours quatre sessions, trois parts, sans « Autres », ni Planche à voile ni Bateau parmi les favorites', (await chartCount()) === '4 sessions'
  && (await evaluate(`document.querySelectorAll('.profile-donut g circle').length`)) === 3 && !(await legend())?.some((row) => row.startsWith('Autres'))
  && (await favs()).map((c) => c.name).join(' | ') === 'Wingfoil | Surf | Kite | Total',
  `${await chartCount()} ; ${JSON.stringify(await legend())} ; ${(await favs()).map((c) => c.name).join(' | ')}`);
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
check('activités favorites : à durée égale la plus récente prend la place (Wingfoil, Pumping, Surf)', (await favs()).map((c) => c.name).join(' | ') === 'Wingfoil | Pumping | Surf | Total',
  (await favs()).map((c) => c.name).join(' | '));
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
check('la photo dit ce qu\'elle ouvre', (await evaluate(`document.querySelector('.profile-head__avatar')?.getAttribute('aria-label')`)) === 'Photo de profil : ouvrir les réglages du Profil');
await shoot('profil-avatar-vide');
/** Ouvre la fenêtre des réglages du Profil en touchant la photo ; elle se charge à la demande. */
const openWindow = async () => {
  await evaluate(`document.querySelector('.profile-head__avatar').click()`);
  await waitFor(`!!document.querySelector('.profile-settings-window .avatar-picker__current')`, { timeout: 8000, every: 100, label: 'fenêtre des réglages du Profil' });
};
/** Relevé du choix de la photo sous `root` : bouton, état, petit rond, logos proposés, import et « Retirer ». */
const pickerState2 = (root) => evaluate(`(() => {
  const r = document.querySelector('${root}');
  const b = r?.querySelector('.avatar-picker__current button');
  if (!b) return 'bouton absent';
  const rect = b.getBoundingClientRect();
  return [
    b.textContent.trim(),
    'déplié=' + b.getAttribute('aria-expanded'),
    'liée=' + (b.getAttribute('aria-controls') ? (r.querySelector('#' + CSS.escape(b.getAttribute('aria-controls'))) ? 'oui' : 'non') : 'sans'),
    'rond=' + (r.querySelector('.avatar-picker__preview .profile-avatar__photo, .avatar-picker__preview .profile-avatar__disc') ? 'oui' : 'non'),
    r.querySelectorAll('.avatar-picker__choice').length + ' logos',
    'import=' + (r.querySelector('.avatar-picker input[type=file]') ? 'oui' : 'non'),
    'retirer=' + ([...r.querySelectorAll('.avatar-picker__actions button')].some((x) => x.textContent.trim() === 'Retirer') ? 'oui' : 'non'),
    'haut=' + (rect.height >= 44 ? 'ok' : Math.round(rect.height)),
  ].join(' ; ');
})()`);
/** Touche « Changer l'image » sous `root` pour en changer l'état, puis attend le nombre de logos attendu (0 ou 11). */
const toggleChange = async (root, logos) => {
  await evaluate(`document.querySelector('${root} .avatar-picker__current button').click()`);
  await waitFor(`document.querySelectorAll('${root} .avatar-picker__choice').length === ${logos}`, { timeout: 4000, every: 100, label: 'propositions de photo' });
};
const PICKER_REST = 'Changer l\'image ; déplié=false ; liée=non ; rond=oui ; 0 logos ; import=non ; retirer=non ; haut=ok';
const PICKER_OPEN = 'Changer l\'image ; déplié=true ; liée=oui ; rond=oui ; 11 logos ; import=oui ; retirer=non ; haut=ok';
/** Les quatre réglages de l'écran Profil sous `root` : photo, nom, poisson (huit choix), sessions du banc. */
const screenSettings = (root) => evaluate(`(() => {
  const r = document.querySelector('${root}');
  if (!r) return 'absent';
  const labels = [...r.querySelectorAll('.settings-row__label, .ui-field-row__label')].map((e) => e.firstChild?.textContent?.trim() ?? '');
  return [
    r.querySelectorAll('.avatar-picker__choice').length + ' logos',
    r.querySelector('input[autocomplete=nickname]') ? 'nom' : 'sans nom',
    r.querySelectorAll('.fish-style-picker [data-style]').length + ' poissons',
    r.querySelector('input[type=number][placeholder=Auto]') ? 'essai' : 'sans essai',
    labels.join(' | '),
  ].join(' ; ');
})()`);
const SCREEN_SETTINGS = '0 logos ; nom ; 8 poissons ; essai ; Photo de profil | Nom ou pseudo | Poisson du banc | Nombre de sessions du banc (essai, provisoire)';
await openWindow();
await waitFor(`document.querySelectorAll('.profile-settings-window .fish-style-picker [data-style]').length === 8`, { timeout: 8000, every: 100, label: 'choix du poisson' });
check('toucher la photo ouvre « Réglages du Profil » et ses quatre réglages', (await text('.profile-settings-window__title')) === 'Réglages du Profil'
  && (await screenSettings('.profile-settings-window')) === SCREEN_SETTINGS, await screenSettings('.profile-settings-window'));
check('fenêtre au repos : photo en petit rond et « Changer l\'image », ni grille ni « Importer une image »', (await pickerState2('.profile-settings-window')) === PICKER_REST, await pickerState2('.profile-settings-window'));
await toggleChange('.profile-settings-window', 11);
check('« Changer l\'image » déplie les onze logos et « Importer une image » (pas « Retirer » sans photo)', (await pickerState2('.profile-settings-window')) === PICKER_OPEN, await pickerState2('.profile-settings-window'));
/** Flèche du bouton « Changer l'image » : déplié lu, et le dessin de son trait (vers le bas ou vers le haut). */
const chevronState = (root) => evaluate(`(() => {
  const b = document.querySelector('${root} .avatar-picker__current button');
  const s = b?.querySelector('svg.avatar-picker__chevron');
  return s ? 'déplié=' + b.getAttribute('aria-expanded') + ' ; masquée=' + s.getAttribute('aria-hidden') + ' ; ' + [...s.querySelectorAll('path, polyline')].map((p) => p.getAttribute('d') ?? p.getAttribute('points')).join('|') : 'sans flèche';
})()`);
const chevronOpen = await chevronState('.profile-settings-window');
await shoot('profil-fenetre-photo-ouverte');
await toggleChange('.profile-settings-window', 0);
const chevronClosed = await chevronState('.profile-settings-window');
check('« Changer l\'image » porte une flèche décorative qui change de sens avec le déploiement', chevronOpen.startsWith('déplié=true ; masquée=true') && chevronClosed.startsWith('déplié=false ; masquée=true')
  && chevronOpen.split(' ; ')[2] !== chevronClosed.split(' ; ')[2], chevronOpen + ' // ' + chevronClosed);
check('le bouton retouché replie les propositions', (await pickerState2('.profile-settings-window')) === PICKER_REST, await pickerState2('.profile-settings-window'));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(300);
check('Échap ferme la fenêtre', !(await evaluate(`!!document.querySelector('.profile-settings-window')`)));
await openWindow();
await evaluate(`window.gtrackerBack?.()`);
await wait(300);
check('le retour ferme la fenêtre, sans quitter le Profil', !(await evaluate(`!!document.querySelector('.profile-settings-window')`)) && (await search()) === '/profil', await search());
await openWindow();
check('rouverte, la fenêtre est repliée', (await pickerState2('.profile-settings-window')) === PICKER_REST, await pickerState2('.profile-settings-window'));
await toggleChange('.profile-settings-window', 11);
await evaluate(`document.querySelector('.avatar-picker__choice[aria-label="Kite"]').click()`);
await wait(300);
check('un logo choisi : la photo suit, la fenêtre reste ouverte', (await evaluate(`!!document.querySelector('.profile-settings-window')`)) && (await avatarState()) === 'logo #gt-logo-kite encadré', await avatarState());
check('… les propositions restent ouvertes, « Retirer » apparaît, le petit rond montre le logo', (await pickerState2('.profile-settings-window')) === PICKER_OPEN.replace('retirer=non', 'retirer=oui')
  && (await evaluate(`!!document.querySelector('.profile-settings-window .avatar-picker__preview svg.activity-logo')`)), await pickerState2('.profile-settings-window'));
await go('/profil');
check('… retenu au rechargement', (await avatarState()) === 'logo #gt-logo-kite encadré', await avatarState());
await openWindow();
await toggleChange('.profile-settings-window', 11);
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
check('image importée : réduite à 256 px, en JPEG, la fenêtre ouverte', (await avatarState()) === 'photo 256 data:image/jpeg' && (await evaluate(`!!document.querySelector('.profile-settings-window')`)), await avatarState());
await go('/profil');
check('… retenue au rechargement', (await avatarState()) === 'photo 256 data:image/jpeg', await avatarState());
await shoot('profil-photo');
await openWindow();
await toggleChange('.profile-settings-window', 11);
await evaluate(`[...document.querySelectorAll('.avatar-picker button')].find((b) => b.textContent.trim() === 'Retirer').click()`);
await wait(300);
check('« Retirer » rend l\'avatar vide', (await avatarState()) === 'vide', await avatarState());
// Le nom tapé dans la fenêtre passe en titre du Profil.
await evaluate(`(() => {
  const input = document.querySelector('.profile-settings-window input[autocomplete=nickname]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(input, 'Lou');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await wait(300);
check('le nom tapé dans la fenêtre passe en titre', (await text('.profile-head__title')) === 'Lou', await text('.profile-head__title'));
await go('/profil');
check('… vide au rechargement', (await avatarState()) === 'vide', await avatarState());
await setAthlete({ name: null });

// 8. Le banc de poissons du Profil, par le réglage d'essai « Nombre de sessions du banc » (posé dans le profil du
// pratiquant, `schoolTrialSessions`) : nombre de poissons, eau, aucun poisson sur un texte, places stables, choix du dessin.
/** Poissons attendus : le réglage d'essai donne des sessions sans durée connue, un poisson chacune. */
const fishExpected = (n) => n;
const SCHOOL_COUNTS = [0, 1, 15, 30, 31, 50, 100];
const sizeOf = (width) => ({ width, height: width === 390 ? 844 : 640, deviceScaleFactor: 2, mobile: true });
/** Ouvre le Profil avec ce compte d'essai et ce dessin (`null` : le choix par défaut) ; rend le relevé de la couche. */
const openSchool = async (n, style = null) => {
  await setAthlete({ schoolTrialSessions: n, schoolStyle: style });
  await go('/profil');
  if (n === 0) {
    await wait(700);
  } else {
    await waitFor(`document.querySelector('.fish-school')?.getAttribute('data-fish') === '${fishExpected(n)}'`, { timeout: 15000, every: 100, label: `banc de ${n} sessions` });
  }
  return evaluate(`(() => {
    const svg = document.querySelector('.fish-school');
    const uses = svg ? [...svg.querySelectorAll(':scope > use')] : [];
    return {
      present: !!svg,
      fish: uses.length,
      attr: svg?.getAttribute('data-fish') ?? null,
      water: !!svg?.querySelector('.fish-school__water'),
      hrefs: uses.map((u) => u.getAttribute('href')),
      transforms: uses.map((u) => u.getAttribute('transform')),
      ms: Number(svg?.getAttribute('data-ms') ?? -1),
    };
  })()`);
};
/** Poissons dont la boîte recouvre un texte visible du Profil (hors couche et barres de navigation), à `tol` px près. */
const fishOnText = (tol) => evaluate(`(() => {
  const tol = ${tol};
  const root = document.querySelector('.profile') ?? document.body;
  const skip = '.fish-school, .shell-tabbar, nav, [class*="shell-top"]';
  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest(skip) || !node.textContent.trim()) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) texts.push({ r, t: node.textContent.trim().slice(0, 24) });
  }
  const hits = [];
  document.querySelectorAll('.fish-school > use').forEach((u, i) => {
    const b = u.getBoundingClientRect();
    for (const { r, t } of texts) {
      if (Math.min(b.right, r.right) - Math.max(b.left, r.left) > tol && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > tol) {
        hits.push(i + ' sur « ' + t + ' » poisson [' + Math.round(b.left) + ',' + Math.round(b.top) + ',' + Math.round(b.right) + ',' + Math.round(b.bottom) + '] texte [' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
        break;
      }
    }
  });
  return hits;
})()`);

for (const width of [390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', sizeOf(width));
  const byCount = {};
  for (const n of SCHOOL_COUNTS) {
    byCount[n] = await openSchool(n);
    if (n === 0) {
      check(`banc ${width} px : à 0 session, pas de couche`, !byCount[0].present, JSON.stringify({ present: byCount[0].present }));
    } else if ([1, 15, 30, 50, 100].includes(n)) {
      check(`banc ${width} px : ${n} session${n > 1 ? 's' : ''}, ${fishExpected(n)} poissons et l'eau dessinée`,
        byCount[n].fish === fishExpected(n) && byCount[n].attr === String(fishExpected(n)) && byCount[n].water, JSON.stringify({ fish: byCount[n].fish, water: byCount[n].water }));
    }
    if (n === 30 || n === 100) {
      const hits = await fishOnText(2);
      check(`banc ${width} px : ${n} sessions, aucun poisson sur un texte`, hits.length === 0, hits.join(' ; '));
      if (n === 30) await shoot(`profil-banc-${width}`);
    }
  }
  const a = byCount[30].transforms;
  const b = byCount[31].transforms;
  check(`banc ${width} px : les places de 30 sessions sont le début de celles de 31`, a.length === 30 && b.length === 31 && a.every((t, i) => t === b[i]),
    `${a.length} / ${b.length}`);
  const p5 = await openSchool(30, 'P5');
  check(`banc ${width} px : de P4 à P5, mêmes places, seuls les dessins changent`,
    p5.transforms.length === 30 && p5.transforms.every((t, i) => t === a[i]) && p5.hrefs.every((h) => h.startsWith('#fz-P5-')) && byCount[30].hrefs.every((h) => h.startsWith('#fz-P4-')),
    `${p5.hrefs[0]} / ${byCount[30].hrefs[0]}`);
}

// Le choix du dessin par Réglages › Pratiquant.
await send('Emulation.setDeviceMetricsOverride', sizeOf(390));
await setAthlete({ schoolTrialSessions: 30, schoolStyle: null });
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}');
  s.settings = { ...(s.settings ?? {}), pratiquant: true };
  localStorage.setItem('${CLES.sections}', JSON.stringify(s));
})()`);
await go('/parametres');
const pickerState = () => evaluate(`[...document.querySelectorAll('.fish-style-picker [data-style]')].map((b) => b.getAttribute('data-style') + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ')`);
await waitFor(`document.querySelectorAll('.fish-style-picker [data-style]').length === 8`, { timeout: 8000, every: 100, label: 'choix du dessin' });
check('réglages : les quatre réglages de l\'écran Profil, en tête de Pratiquant', (await screenSettings('.profile-settings')) === SCREEN_SETTINGS, await screenSettings('.profile-settings'));
check('réglages : photo au repos, « Changer l\'image » seul, ni grille ni « Importer une image »', (await pickerState2('.profile-settings')) === PICKER_REST, await pickerState2('.profile-settings'));
await toggleChange('.profile-settings', 11);
check('réglages : « Changer l\'image » déplie les logos et « Importer une image »', (await pickerState2('.profile-settings')) === PICKER_OPEN, await pickerState2('.profile-settings'));
await toggleChange('.profile-settings', 0);
check('réglages : le bouton retouché replie les propositions', (await pickerState2('.profile-settings')) === PICKER_REST, await pickerState2('.profile-settings'));
check('réglages : sept dessins et « Aucun », P4 enfoncé au départ', (await pickerState()) === 'P1 P2 P3 P4* P5 P6 P7 aucun', await pickerState());
await evaluate(`document.querySelector('.fish-style-picker [data-style="P5"]').click()`);
await wait(300);
check('réglages : un clic sur P5 l\'enfonce', (await pickerState()) === 'P1 P2 P3 P4 P5* P6 P7 aucun', await pickerState());
await go('/profil');
await waitFor(`document.querySelector('.fish-school')?.getAttribute('data-fish') === '30'`, { timeout: 15000, every: 100, label: 'banc de 30 sessions' });
check('le Profil rouvert montre les dessins P5', await evaluate(`(() => { const u = [...document.querySelectorAll('.fish-school > use')]; return u.length === 30 &&u.every((x) => x.getAttribute('href').startsWith('#fz-P5-')); })()`));
await go('/parametres');
await waitFor(`document.querySelectorAll('.fish-style-picker [data-style]').length === 8`, { timeout: 8000, every: 100, label: 'choix du dessin' });
check('le choix de P5 tient au rechargement', (await pickerState()) === 'P1 P2 P3 P4 P5* P6 P7 aucun', await pickerState());

// « Aucun » cache le banc et l'eau, un poisson les remontre : depuis Réglages, puis depuis la fenêtre du Profil.
const schoolHere = () => evaluate(`({ couche: !!document.querySelector('.fish-school'), eau: !!document.querySelector('.fish-school__water'), voile: !!document.querySelector('.profile-page--school') })`);
await evaluate(`document.querySelector('.fish-style-picker [data-style="aucun"]').click()`);
await wait(300);
check('réglages : « Aucun » s\'enfonce', (await pickerState()) === 'P1 P2 P3 P4 P5 P6 P7 aucun*', await pickerState());
await go('/profil');
await wait(1200);
check('« Aucun » depuis Réglages : ni banc, ni eau, les cadres gardent leur fond', JSON.stringify(await schoolHere()) === '{"couche":false,"eau":false,"voile":false}', JSON.stringify(await schoolHere()));
await go('/parametres');
await waitFor(`document.querySelectorAll('.fish-style-picker [data-style]').length === 8`, { timeout: 8000, every: 100, label: 'choix du dessin' });
check('« Aucun » tient au rechargement', (await pickerState()) === 'P1 P2 P3 P4 P5 P6 P7 aucun*', await pickerState());
await shoot('reglages-pratiquant-aucun');
await evaluate(`document.querySelector('.fish-style-picker [data-style="P2"]').click()`);
await wait(300);
await go('/profil');
await waitFor(`document.querySelector('.fish-school')?.getAttribute('data-fish') === '30'`, { timeout: 15000, every: 100, label: 'banc remontré' });
check('un poisson choisi dans Réglages remontre le banc, dans son dessin', await evaluate(`(() => { const u = [...document.querySelectorAll('.fish-school > use')]; return u.length === 30 &&u.every((x) => x.getAttribute('href').startsWith('#fz-P2-')) && !!document.querySelector('.fish-school__water'); })()`));
await openWindow();
await waitFor(`document.querySelectorAll('.profile-settings-window .fish-style-picker [data-style]').length === 8`, { timeout: 8000, every: 100, label: 'choix du poisson' });
await evaluate(`document.querySelector('.profile-settings-window .fish-style-picker [data-style="aucun"]').click()`);
await wait(600);
check('« Aucun » depuis la fenêtre : le banc et l\'eau partent aussitôt', JSON.stringify(await schoolHere()) === '{"couche":false,"eau":false,"voile":false}', JSON.stringify(await schoolHere()));
await shoot('profil-fenetre-aucun');
await evaluate(`document.querySelector('.profile-settings-window .fish-style-picker [data-style="P4"]').click()`);
await waitFor(`document.querySelector('.fish-school')?.getAttribute('data-fish') === '30'`, { timeout: 15000, every: 100, label: 'banc remontré depuis la fenêtre' });
check('un poisson choisi dans la fenêtre remontre le banc et l\'eau', JSON.stringify(await schoolHere()) === '{"couche":true,"eau":true,"voile":true}', JSON.stringify(await schoolHere()));
await evaluate(`document.querySelector('.profile-settings-window__close').click()`);
await setAthlete({ schoolStyle: null, schoolHidden: false });

// Temps de calcul sous processeur ralenti quatre fois, à 100 sessions : le nombre va dans la console, pas dans le relevé.
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
const slow = await openSchool(100);
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log(`temps de calcul du banc (processeur ralenti ×4, 100 sessions, 390 px) : ${slow.ms} ms`);
check('banc : calcul à 100 sessions sous processeur ralenti ×4 en moins de 600 ms', slow.fish === 100 &&slow.ms >= 0 && slow.ms < 600);
await setAthlete({ schoolTrialSessions: null, schoolStyle: null });

// Ce script ne relève que les erreurs de console, pas les avertissements.
const errors = logs.filter((l) => !l.startsWith('warning:'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : aucune erreur');

await finish('Tout passe.');
