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
//  5. à 390×844 : rien ne déborde, « Gtracker » sur la photo, pas de colonne « Vos activités », les activités favorites et le total sur une seule rangée, détail par activité retenu déplié ; la case « Profil » de la barre du bas (Profil, Sessions, Statistiques, Réglages) ouvre la page, allumée ;
//     à 320 px, aucune case de la rangée ne sort de l'écran ni ne déborde de son texte ; le bouton de période sous la
//     photo ronde ; le poisson dans son bocal, nommé (« Poisson, niveau 1 sur 6 » sans semaine tenue), puis à chaque
//     niveau d'essai de 1 à 6 (profil du pratiquant) à 390 et 320 px : dessiné, à droite du texte, dans l'écran, sous
//     la photo, de plus en plus grand (captures aux niveaux 1, 3 et 6, et au niveau 6 en sombre) ; sa zone de toucher
//     d'au moins 44 px au niveau 1 à 320 px ; le toucher ouvre la fenêtre « Poisson » : douze choix nommés (« Pinceau,
//     agressif »), un seul enfoncé, dessinés au niveau d'essai, la frise des niveaux débloqués égale au niveau, « k
//     niveaux à découvrir » (rien au niveau 6), la ligne de l'alevin commun au niveau 1 ; un choix change le bocal tout
//     de suite et se garde au rechargement ; Échap, le retour d'Android et × ferment la fenêtre ; le filtre du pinceau
//     ôté en Économe ; rien ne sort de l'écran à 390, 320, téléphone tourné et ordinateur (captures de la fenêtre aux
//     niveaux 1, 3 et 6 à 390 et 320 px, au niveau 3 en sombre, tourné et sur ordinateur) ;
//  6. deux sessions d'activités cachées (planche à voile et bateau, cachées au départ) : absentes du Profil, rien ne
//     change (quatre sessions, trois parts, ni « Autres ») ; une session de surf passée en Pumping dans son analyse :
//     une quatrième part, la ligne de la légende ouvre ses sessions ;
//  7. la photo : au départ l'avatar vide (disque à silhouette, même avec des sessions), nommé « Choisir une photo de
//     profil » ; toucher la photo ouvre le choix des onze logos ; un logo choisi (dans son cadre), puis une image
//     importée (réduite à 256 px, en JPEG), tous deux retenus au rechargement ; « Retirer » rend l'avatar vide.
import { CLES, connect, POIGNEE_RETOUR } from './lib/cdp.mjs';
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
check('le bocal du poisson, nommé, au niveau 1 sans semaine tenue', (await evaluate(`document.querySelector('.profile-head .profile-fish')?.getAttribute('aria-label') ?? null`)) === 'Poisson, niveau 1 sur 6',
  await evaluate(`document.querySelector('.profile-fish')?.getAttribute('aria-label') ?? null`));
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
check('390 px : « Gtracker » sur la photo, pas de colonne « Vos activités »', (await text('.profile-hero__name')) === 'Gtracker' && (await activites()) === null, await text('.profile-hero__name'));
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

// 5 bis. Le poisson dans son bocal, à droite du texte de l'en-tête : le niveau d'essai de Pratiquant l'impose ;
// le bocal grandit du niveau 1 au niveau 6, sans passer sur le texte, la photo d'en-tête ni le bord de l'écran.
/** Pose des champs du profil du pratiquant. */
const setAthlete = (fields) => evaluate(`(() => {
  const all = JSON.parse(localStorage.getItem('${CLES.athleteProfile}') ?? '{}');
  all.me = { ...(all.me ?? {}), ...${JSON.stringify(fields)} };
  localStorage.setItem('${CLES.athleteProfile}', JSON.stringify(all));
  return 'ok';
})()`);
/** Pose le niveau d'essai du poisson (`null` : automatique). */
const setTrial = (level) => setAthlete({ fishTrialLevel: level });
/** Le bocal mesuré : nom, côté, dessin chargé, et sa place à côté du texte de l'en-tête. */
const bowl = () => evaluate(`(() => {
  const f = document.querySelector('.profile-fish');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  const t = document.querySelector('.profile-head__text').getBoundingClientRect();
  const hero = document.querySelector('.profile-hero').getBoundingClientRect();
  return { nom: f.getAttribute('aria-label'), cote: Math.round(r.width), carre: Math.abs(r.width - r.height) < 1,
    dessin: f.querySelector('.fish-drawing')?.getAttribute('data-drawing') ?? null, svg: !!f.querySelector('.fish-drawing svg'),
    aCote: r.left >= t.right - 1, dansEcran: r.right <= window.innerWidth && r.left >= 0, sousPhoto: r.top >= hero.bottom - 1,
    texteEntier: t.right <= r.left + 1 && document.querySelector('.profile-head__text').scrollWidth <= document.querySelector('.profile-head__text').clientWidth + 1 };
})()`);
const fishShots = { 390: [1, 3, 6], 320: [1, 3, 6] };
for (const width of [390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 640, deviceScaleFactor: 2, mobile: true });
  const sizes = [];
  let fine = true;
  let detail = '';
  for (let level = 1; level <= 6; level++) {
    await setTrial(level);
    await go('/profil');
    await waitFor(`Boolean(document.querySelector('.profile-fish .fish-drawing svg'))`, { timeout: 3000, every: 50, label: 'dessin du poisson' });
    const b = await bowl();
    sizes.push(b?.cote ?? 0);
    const ok = !!b && b.nom === `Poisson, niveau ${level} sur 6` && b.svg && b.carre && b.aCote && b.dansEcran && b.sousPhoto && b.texteEntier
      && b.dessin === (level === 1 ? 'A/depart-1' : `A/beau-${level}`) && !(await overflow());
    if (!ok) { fine = false; detail += ` n${level} ${JSON.stringify(b)}`; }
    if (fishShots[width].includes(level)) await shoot(`poisson-${width}-n${level}`);
  }
  check(`${width} px : bocal nommé et dessiné à chaque niveau d'essai, à droite du texte, dans l'écran, sous la photo`, fine, detail);
  check(`${width} px : le bocal grandit du niveau 1 au niveau 6`, sizes.every((s, i) => i === 0 || s > sizes[i - 1]) && sizes[0] >= 20, sizes.join(' '));
  console.log(`${width} px : côté du bocal, niveaux 1 à 6 : ${sizes.join(', ')} px`);
  check(`${width} px : le bouton de période sous la photo ronde`, await periodsUnderAvatar());
}
// Le même en sombre, au niveau 6, pour l'œil.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await evaluate(`localStorage.setItem('${CLES.theme}', JSON.stringify({ choice: 'sombre', eco: false })); 'ok'`);
await go('/profil');
await waitFor(`Boolean(document.querySelector('.profile-fish .fish-drawing svg'))`, { timeout: 3000, every: 50, label: 'dessin du poisson' });
await shoot('poisson-390-n6-sombre');
await evaluate(`localStorage.removeItem('${CLES.theme}'); 'ok'`);
// Les trois autres styles (pinceau, estampe, pictogramme), au niveau 6, rangés dans le profil.
const drawnStyles = [];
for (const style of ['B', 'F', 'G']) {
  await setAthlete({ fishStyle: style });
  await go('/profil');
  await waitFor(`document.querySelector('.profile-fish .fish-drawing')?.getAttribute('data-drawing') === '${style}/beau-6'`, { timeout: 3000, every: 50, label: 'dessin du poisson' });
  drawnStyles.push(await evaluate(`document.querySelector('.profile-fish .fish-drawing')?.getAttribute('data-drawing') ?? null`));
  await shoot(`poisson-390-n6-${style}`);
}
check('390 px : le style rangé dans le profil choisit le dessin (pinceau, estampe, pictogramme)', drawnStyles.join(' ') === 'B/beau-6 F/beau-6 G/beau-6', drawnStyles.join(' '));

// 5 ter. La fenêtre de choix du poisson, ouverte en touchant le bocal.
await setAthlete({ fishStyle: null, fishPath: null });
const FISH_NAMES = ['Trait fin', 'Pinceau', 'Estampe', 'Pictogramme'].flatMap((s) => ['beau', 'agressif', 'les deux'].map((p) => `${s}, ${p}`));
const FISH_KEYS = ['A', 'B', 'F', 'G'].flatMap((s) => ['beau', 'agressif', 'lesDeux'].map((p) => [s, p]));
/** La fenêtre lue : choix (nom, enfoncé, dessin), frise, texte de tête et du compte à venir, place dans l'écran. */
const picker = () => evaluate(`(() => {
  const d = document.querySelector('.fish-picker');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  return {
    titre: d.getAttribute('aria-label'),
    choix: [...d.querySelectorAll('.fish-picker__choice')].map((b) => ({ nom: b.getAttribute('aria-label'),
      enfonce: b.getAttribute('aria-pressed') === 'true', dessin: b.querySelector('.fish-drawing')?.getAttribute('data-drawing') ?? null })),
    frise: [...d.querySelectorAll('.fish-picker__step')].map((s) => s.querySelector('.fish-drawing')?.getAttribute('data-drawing') ?? null),
    friseActive: d.querySelector('.fish-picker__frieze a, .fish-picker__frieze button') !== null,
    tete: d.querySelector('.fish-picker__lead')?.textContent ?? '',
    aVenir: d.querySelector('.fish-picker__to-come')?.textContent ?? null,
    dansEcran: r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5,
    contenuEntier: d.scrollWidth <= d.clientWidth + 1,  };
})()`);
/** Toutes les cases de la fenêtre ont leur dessin. */
const pickerDrawn = `(() => { const d = document.querySelector('.fish-picker'); return !!d && [...d.querySelectorAll('.fish-drawing')].every((x) => x.querySelector('svg')); })()`;
/** Ouvre la fenêtre en touchant le bocal ; rend le temps jusqu'à la fenêtre, puis jusqu'au dernier dessin. */
const openPicker = async () => {
  await waitFor(`Boolean(document.querySelector('.profile-fish .fish-drawing svg'))`, { timeout: 3000, every: 50, label: 'dessin du poisson' });
  const t0 = Date.now();
  await evaluate(`document.querySelector('.profile-fish').click(); 'ok'`);
  await waitFor(`Boolean(document.querySelector('.fish-picker'))`, { timeout: 3000, every: 20, label: 'fenêtre du poisson' });
  const ouverte = Date.now() - t0;
  await waitFor(pickerDrawn, { timeout: 5000, every: 20, label: 'dessins de la fenêtre' });
  return { ouverte, dessinee: Date.now() - t0 };
};
const pickerOpen = () => evaluate(`Boolean(document.querySelector('.fish-picker'))`);
const bowlDrawing = () => evaluate(`document.querySelector('.profile-fish .fish-drawing')?.getAttribute('data-drawing') ?? null`);
const choose = (name) => evaluate(`(() => { const b = [...document.querySelectorAll('.fish-picker__choice')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(name)}); if (!b) return false; b.click(); return true; })()`);
/** La fenêtre conforme au niveau `level` et au poisson choisi `[style, voie]`. */
const pickerFits = (p, level, [style, path]) => {
  const key = (s, v, n) => `${s}/${n === 1 ? 'depart-1' : `${v}-${n}`}`;
  return !!p && p.titre === 'Poisson' && p.choix.length === 12
    && p.choix.map((c) => c.nom).join('|') === FISH_NAMES.join('|')
    && p.choix.filter((c) => c.enfonce).length === 1
    && p.choix.every((c, i) => c.enfonce === (FISH_KEYS[i][0] === style && FISH_KEYS[i][1] === path) && c.dessin === key(FISH_KEYS[i][0], FISH_KEYS[i][1], level))
    && p.frise.length === level && p.frise.every((d, i) => d === key(style, path, i + 1)) && !p.friseActive
    && p.aVenir === (level === 6 ? null : level === 5 ? '1 niveau à découvrir' : `${6 - level} niveaux à découvrir`)
    && p.tete.includes('même alevin') === (level === 1)
    && p.dansEcran && p.contenuEntier;
};
for (const width of [390, 320]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 640, deviceScaleFactor: 2, mobile: true });
  let fine = true;
  let detail = '';
  for (const level of [1, 3, 6]) {
    await setTrial(level);
    await go('/profil');
    const t = await openPicker();
    const p = await picker();
    if (!pickerFits(p, level, ['A', 'beau'])) { fine = false; detail += ` n${level} ${JSON.stringify(p)}`; }
    if (!(await overflow())) await shoot(`poisson-fenetre-${width}-n${level}`);
    else { fine = false; detail += ` n${level} débordement`; }
    console.log(`${width} px, niveau ${level} : fenêtre en ${t.ouverte} ms, dessins en ${t.dessinee} ms`);    await evaluate(`document.querySelector('.fish-picker .ui-dialog__close').click(); 'ok'`);
    await settle({ max: 500 });
    if (await pickerOpen()) { fine = false; detail += ` n${level} × ne ferme pas`; }
  }
  check(`${width} px : fenêtre du poisson aux niveaux 1, 3 et 6 (douze choix nommés, un enfoncé, frise égale au niveau, à découvrir, alevin commun), fermée par ×`, fine, detail);
}
// Zone de toucher : au niveau 1 à 320 px, le bocal est petit, son bouton répond à 22 px de son centre.
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
await setTrial(1);
await go('/profil');
const reach = await evaluate(`(() => {
  const f = document.querySelector('.profile-fish');
  const r = f.getBoundingClientRect();
  const [cx, cy] = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
  const hit = (x, y) => document.elementFromPoint(x, y)?.closest('.profile-fish') === f;
  return { cote: Math.round(r.width), touche: [hit(cx - 21, cy), hit(cx + 21, cy), hit(cx, cy - 21), hit(cx, cy + 21)].every(Boolean) };
})()`);
check('320 px, niveau 1 : zone de toucher du bocal d\'au moins 44 px', reach.cote < 44 && reach.touche, JSON.stringify(reach));
// Un choix : le bocal change tout de suite, la frise suit, le choix est gardé au rechargement ; Échap ferme.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await setTrial(3);
await go('/profil');
await openPicker();
await choose('Pinceau, agressif');
await waitFor(`document.querySelector('.profile-fish .fish-drawing')?.getAttribute('data-drawing') === 'B/agressif-3'`, { timeout: 3000, every: 50, label: 'bocal changé' });
await waitFor(pickerDrawn, { timeout: 5000, every: 20, label: 'frise du choix' });
check('le choix « Pinceau, agressif » change le bocal tout de suite, la fenêtre et sa frise suivent', pickerFits(await picker(), 3, ['B', 'agressif']), JSON.stringify(await picker()));
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 'ok'`);
await settle({ max: 500 });
check('Échap ferme la fenêtre du poisson', !(await pickerOpen()));
await go('/profil');
await waitFor(`Boolean(document.querySelector('.profile-fish .fish-drawing svg'))`, { timeout: 3000, every: 50, label: 'dessin du poisson' });
const kept = await bowlDrawing();
await openPicker();
const keptPicker = await picker();
check('le choix est gardé au rechargement (bocal et fenêtre)', kept === 'B/agressif-3' && pickerFits(keptPicker, 3, ['B', 'agressif']), `${kept} ${JSON.stringify(keptPicker)}`);
const backed = await evaluate(`window.${POIGNEE_RETOUR} ? (window.${POIGNEE_RETOUR}(), 'ok') : 'absent'`);
await settle({ max: 500 });
check('le retour d\'Android ferme la fenêtre, sans quitter le Profil', backed === 'ok' && !(await pickerOpen()) && (await search()).startsWith('/profil'), `${backed} ${await search()}`);
// Sombre, pour l'œil.
await evaluate(`localStorage.setItem('${CLES.theme}', JSON.stringify({ choice: 'sombre', eco: false })); 'ok'`);
await go('/profil');
await openPicker();
await shoot('poisson-fenetre-390-n3-sombre');
// Économe : le pinceau sans son filtre, dans le bocal comme dans la fenêtre.
await evaluate(`localStorage.setItem('${CLES.theme}', JSON.stringify({ choice: 'clair', eco: true })); 'ok'`);
await go('/profil');
await openPicker();
const filters = await evaluate(`[...document.querySelectorAll('.fish-drawing [filter]')].map((e) => getComputedStyle(e).filter)`);
check('Économe : le filtre du pinceau ôté (bocal et fenêtre)', filters.length > 0 && filters.every((f) => f === 'none'), filters.join(' '));
await evaluate(`localStorage.removeItem('${CLES.theme}'); 'ok'`);
// Téléphone tourné et ordinateur : la fenêtre tient dans l'écran.
for (const [nom, metrics] of [['tourne', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true }], ['ordinateur', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false }]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics);
  await go('/profil');
  await openPicker();
  const p = await picker();
  check(`${nom} : la fenêtre du poisson tient dans l'écran`, pickerFits(p, 3, ['B', 'agressif']) && !(await overflow()), JSON.stringify(p));
  await shoot(`poisson-fenetre-${nom}-n3`);
}
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
