// Banc de test : planification d'un itinéraire de voile (page /itineraires ; remis sur la page réduite au lot 330).
// Usage : node planning.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// La page ne calcule plus rien : les balises se relient en ligne droite, plus de mode, de type de voie ni de revêtement.
// Le script fabrique lui-même ses quatre GPX dans le dossier de travail (une trace sans heure, avec altitude et
// `<type>kite</type>` ; une route `<rte>` ; une boucle ; un fichier qui n'est pas un GPX), et vérifie, sur un profil neuf,
// en Wingfoil, tous les onglets ouverts :
//  1. trois balises posées, « Précédent », « Boucler » (le bord 3 → 1), « Tout effacer » ;
//  2. le bandeau d'une balise : « Retirer », puis « Boucler ici » sur la balise 1 ;
//  3. « Charger un GPX » : refus du fichier qui n'en est pas un, route `<rte>` (départ et arrivée), boucle, trace sans
//     heure (activité devinée de son `<type>`, nom repris du fichier) ;
//  4. une balise insérée sur la trace importée (distance inchangée), l'arrivée déplacée, « Précédent », « Inverser » ;
//  5. « Enregistrer » (fiche et GPX rangés), rechargement, réouverture depuis la liste : verrouillé, mêmes balises ;
//  6. le menu « … » du nom sur l'itinéraire rouvert : ses entrées, le bloc sans « Exporter le GPX » ni « Supprimer
//     l'itinéraire », « Partager le GPX » (partage du navigateur simulé, puis sans partage), nom modifié (partages grisés
//     et leur ligne), « Supprimer » d'un clic court, tenu une seconde, « Garder », menu fermé puis rouvert, « Supprimer
//     définitivement » (mémoire vidée, le bloc redevient « Enregistrer l'itinéraire »).
// Verdicts par `check` ; fin par « Tout passe. » ou le nombre d'échecs, code 0 ou 1.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node planning.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Les quatre GPX, autour de Sète : mètres vers l'est et vers le nord à partir d'une origine ---
const R = 6371000;
const O = { lat: 43.4, lon: 3.7 };
const at = (east, north) => ({
  lat: O.lat + (north / R) * (180 / Math.PI),
  lon: O.lon + (east / (R * Math.cos((O.lat * Math.PI) / 180))) * (180 / Math.PI),
});
const gpxDe = (corps) => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="banc" xmlns="http://www.topografix.com/GPX/1/1">${corps}</gpx>\n`;
const trkpt = (e, n, ele) => `<trkpt lat="${at(e, n).lat.toFixed(7)}" lon="${at(e, n).lon.toFixed(7)}"><ele>${ele}</ele></trkpt>`;
const dossier = (nom) => join(workDir, nom);
// Trace sans heure : 800 m vers l'est puis 400 m vers le nord, avec altitude et un type de calcul.
writeFileSync(dossier('sans-heure.gpx'), gpxDe(`<trk><name>Trace sans heure</name><type>kite</type><trkseg>${
  [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [800, 200], [800, 400]].map(([e, n], i) => trkpt(e, n, 5 + i)).join('')}</trkseg></trk>`));
// Route : des `<rtept>` seulement.
writeFileSync(dossier('route-rte.gpx'), gpxDe(`<rte><name>Route des balises</name>${
  [[0, 0], [300, 300], [700, 300]].map(([e, n]) => `<rtept lat="${at(e, n).lat.toFixed(7)}" lon="${at(e, n).lon.toFixed(7)}"/>`).join('')}</rte>`));
// Boucle : un carré de 400 m qui revient à 10 m de son départ.
writeFileSync(dossier('boucle.gpx'), gpxDe(`<trk><name>Boucle carrée</name><type>wingfoil</type><trkseg>${
  [[0, 0], [400, 0], [400, 400], [0, 400], [0, 10]].map(([e, n]) => trkpt(e, n, 3)).join('')}</trkseg></trk>`));
// Un fichier qui n'a ni point de trace ni point de route.
writeFileSync(dossier('pas-un-gpx.gpx'), gpxDe('<metadata><name>Rien</name></metadata>'));

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, importFiles, mouse, onMessage, logs, check, finish, shoot } = await connect({ port, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const dialogs = [];
// Les confirmations (itinéraire non rangé) sont acceptées par la bibliothèque, et notées ici.
onMessage((msg) => { if (msg.method === 'Page.javascriptDialogOpening') dialogs.push(msg.params.message); });
/** Bouton dont le texte est exactement `text` (hors désactivés) ; « absent » sinon. */
const clickText = (text, scope = 'button') => evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const setFile = (selector, path) => importFiles(path, selector);
const clickAt = async (x, y) => { await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await wait(300); };
/** Toucher de la carte, à la fraction (fx, fy) de son cadre. */
const tapMap = async (fx, fy) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.plan-map .leaflet-container').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  await clickAt(r[0] + r[2] * fx, r[1] + r[3] * fy);
};
const state = async () => JSON.parse(await evaluate(`(() => {
  const title = [...document.querySelectorAll('button, h2, h3, span, strong')].map((x) => x.textContent.trim()).find((t) => /^Balises \\(\\d+\\)$/.test(t)) ?? null;
  const stat = (nom) => [...document.querySelectorAll('.plan-stat')].find((s) => s.querySelector('span')?.textContent === nom)?.querySelector('strong')?.textContent ?? null;
  return JSON.stringify({
    title,
    distance: stat('Distance'),
    balises: stat('Balises'),
    bords: [...document.querySelectorAll('.plan-course__leg')].map((x) => x.querySelector('span')?.textContent ?? ''),
    repères: [...document.querySelectorAll('.plan-point__dot')].map((x) => x.textContent),
    name: document.querySelector('.plan-form input')?.value ?? null,
    activity: document.querySelector('.plan-toolbar .activity-select')?.textContent ?? null,
    alert: [...document.querySelectorAll('.ui-alert')].map((x) => x.textContent).join(' | '),
  });
})()`));
const log = async (label) => console.log(label.padEnd(30), JSON.stringify(await state()));
const markers = async () => JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.plan-marker')].map((m) => { const r = m.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }))`));
const tapMarker = async (i) => {
  const m = (await markers())[i];
  if (m) await clickAt(m[0], m[1]);
  return m ? 'ok' : 'absent';
};
const overlayText = () => evaluate(`document.querySelector('.plan-overlay')?.innerText.replace(/\\n/g, ' · ') ?? null`);
const lockLabel = () => evaluate(`document.querySelector('.plan-map-tools button[aria-label$="l\\'itinéraire"]')?.getAttribute('aria-label') ?? 'absent'`);

// Onglets posés dans `gtracker.sections` (`lib/onglets.mjs`) et activité de la planification : Wingfoil.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await go('/itineraires', 3000);
await evaluate(`localStorage.setItem('${CLES.planning}', JSON.stringify({ activityId: 'wingfoil' }));
  localStorage.setItem('${CLES.sections}', JSON.stringify({ planning: { parcours: true, trace: true, points: true, ranger: true, liste: true } })); 'ok'`);
await go('/itineraires', 3000);

// 1. Trois balises, « Précédent », « Boucler », « Tout effacer ».
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
const trois = await state();
await log('trois balises');
check('trois balises : liste « Balises (3) », chiffre 3, repères 1, 2, 3, bords 1 → 2 et 2 → 3',
  trois.title === 'Balises (3)' && trois.balises === '3' && trois.repères.join(',') === '1,2,3' && trois.bords.join(' ; ') === '1 → 2 ; 2 → 3', JSON.stringify(trois));
check('le nom proposé est celui du jour, activité Wingfoil', trois.activity?.includes('Wingfoil') === true, trois.activity);
console.log('Précédent (carte) :', await clickText('Précédent', '.plan-map-tools button'));
const deux = await state();
check('« Précédent » retire la dernière balise : « Balises (2) », un seul bord', deux.title === 'Balises (2)' && deux.bords.length === 1, JSON.stringify(deux));
await tapMap(0.55, 0.7);
console.log('Boucler :', await clickText('Boucler'));
const boucle = await state();
await log('boucle');
check('« Boucler » : « Balises (4) », chiffre 3, bord 3 → 1', boucle.title === 'Balises (4)' && boucle.balises === '3' && boucle.bords.at(-1) === '3 → 1', JSON.stringify(boucle));
check('« Boucler » est ensuite grisé', (await clickText('Boucler')) === 'absent');
console.log('Tout effacer :', await clickText('Tout effacer'));
const vide = await state();
check('« Tout effacer » : « Balises (0) », distance nulle', vide.title === 'Balises (0)' && vide.bords.length === 0 && /^0[,.]00 km$/.test(vide.distance ?? ''), JSON.stringify(vide));

// 2. Le bandeau d'une balise : « Retirer », puis « Boucler ici » sur la 1.
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
console.log('bandeau de la balise 2 :', await tapMarker(1), await overlayText());
// Les boutons sont en capitales à l'écran (`innerText` suit la casse affichée).
check('le bandeau de la balise 2 propose « Retirer » seul', /^Balise 2 · retirer/i.test(String(await overlayText())) && !/boucler ici/i.test(String(await overlayText())), String(await overlayText()));
console.log('Retirer :', await clickText('Retirer', '.plan-overlay button'));
const retire = await state();
check('« Retirer » : « Balises (2) », bandeau fermé', retire.title === 'Balises (2)' && (await overlayText()) === null, JSON.stringify(retire));
console.log('bandeau de la balise 1 :', await tapMarker(0), await overlayText());
check('le bandeau de la balise 1 propose « Boucler ici »', /boucler ici/i.test(String(await overlayText())), String(await overlayText()));
console.log('Boucler ici :', await clickText('Boucler ici', '.plan-overlay button'));
const boucleIci = await state();
check('« Boucler ici » : « Balises (3) », bord 2 → 1', boucleIci.title === 'Balises (3)' && boucleIci.bords.at(-1) === '2 → 1', JSON.stringify(boucleIci));
console.log('Tout effacer :', await clickText('Tout effacer'));

// 3. « Charger un GPX » : un fichier qui n'en est pas un, une route, une boucle, une trace sans heure.
const charge = async (nom) => { await setFile('.plan-actions input[type=file]', dossier(nom)); await settle({ max: 800 }); };
await charge('pas-un-gpx.gpx');
await log('pas un GPX');
const refus = await state();
check('un fichier sans trace est refusé avec son motif, rien de chargé', refus.alert.includes('ne contient pas de trace') && refus.title === 'Balises (0)', JSON.stringify(refus));
await charge('route-rte.gpx');
await log('route <rte>');
const route = await state();
check('une route `<rte>` : départ et arrivée seuls, nom du fichier, plus d\'alerte', route.title === 'Balises (2)' && route.name === 'Route des balises' && route.alert === '', JSON.stringify(route));
// 300 m à l'est et 300 m au nord (424 m), puis 400 m à l'est : 824 m de route entre ses trois points.
check('une route `<rte>` : la longueur de ses trois points, 0,82 km', route.distance === '0,82 km', route.distance);
await charge('boucle.gpx');
await log('boucle');
const lue = await state();
check('une trace qui revient près de son départ : boucle de trois balises (chiffre 2), nom repris', lue.title === 'Balises (3)' && lue.balises === '2' && lue.name === 'Boucle carrée', JSON.stringify(lue));
await charge('sans-heure.gpx');
await log('trace sans heure');
const sansHeure = await state();
check('une trace sans heure : deux balises, nom repris, activité devinée de son type (Kite)',
  sansHeure.title === 'Balises (2)' && sansHeure.name === 'Trace sans heure' && sansHeure.activity?.includes('Kite') === true, JSON.stringify(sansHeure));
await shoot('planning-trace');

// 4. Une balise insérée sur la trace, l'arrivée déplacée, « Précédent », « Inverser ».
const avantInsertion = (await state()).distance;
const mid = await evaluate(`(() => {
  const path = [...document.querySelectorAll('.plan-map path.leaflet-interactive')].find((p) => p.getAttribute('stroke-width') === '24');
  if (!path) return null;
  const p = path.getPointAtLength(path.getTotalLength() * 0.5).matrixTransform(path.getScreenCTM());
  return [p.x, p.y];
})()`);
check('la trace importée porte un tronçon à toucher', mid !== null, 'aucun tracé de 24 px');
if (mid) await clickAt(mid[0], mid[1]);
await log('balise insérée');
const insere = await state();
check('une balise posée sur la trace : « Balises (3) », distance inchangée', insere.title === 'Balises (3)' && insere.distance === avantInsertion, `${avantInsertion} -> ${insere.distance}`);
const avantGlisser = await markers();
const fin = avantGlisser.at(-1);
await mouse('mousePressed', fin[0], fin[1]);
for (let k = 1; k <= 8; k++) await mouse('mouseMoved', fin[0] + 6 * k, fin[1] + 4 * k);
await mouse('mouseReleased', fin[0] + 48, fin[1] + 32);
await wait(500);
await log('arrivée déplacée');
const deplace = await state();
check('l\'arrivée glissée : toujours trois balises, distance changée', deplace.title === 'Balises (3)' && deplace.distance !== avantInsertion, `${avantInsertion} -> ${deplace.distance}`);
console.log('Précédent :', await clickText('Précédent', '.plan-map-tools button'));
const apresPrecedent = await state();
check('« Précédent » rend la distance d\'avant le glisser', apresPrecedent.distance === avantInsertion && apresPrecedent.title === 'Balises (3)', `${apresPrecedent.distance}`);
const avantInverser = await markers();
console.log('Inverser :', await clickText('Inverser'));
const inverse = await markers();
check('« Inverser » : le départ passe à l\'arrivée', JSON.stringify(inverse) === JSON.stringify([...avantInverser].reverse()), JSON.stringify(inverse));
console.log('Inverser :', await clickText('Inverser'));
check('« Inverser » deux fois : les balises reviennent', JSON.stringify(await markers()) === JSON.stringify(avantInverser), JSON.stringify(await markers()));

// 5. Enregistrer, recharger, rouvrir.
const distanceRangee = (await state()).distance;
await evaluate(`(() => { const i = document.querySelector('.plan-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Sortie banc'); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
console.log('Enregistrer :', await clickText('Enregistrer'));
await settle({ max: 1500 });
const message = await evaluate(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).find((t) => t.startsWith('Enregistré')) ?? null`);
console.log('message :', message);
check('« Enregistrer » : message de rangement dans le dossier des itinéraires', message?.startsWith('Enregistré dans') === true, String(message));
const rangement = await evaluate(`(async () => {
  const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('itineraires');
  const noms = [];
  for await (const [nom] of d.entries()) noms.push(nom);
  const fiche = JSON.parse(await (await (await d.getFileHandle('Sortie banc.json')).getFile()).text());
  const gpx = await (await (await d.getFileHandle('Sortie banc.gpx')).getFile()).text();
  return JSON.stringify({ noms: noms.sort(), activite: fiche.activityId ?? null, balises: (gpx.match(/<wpt /g) ?? []).length });
})()`);
console.log('rangé :', rangement);
check('la fiche et le GPX sont rangés, activité Kite, trois balises dans le GPX',
  JSON.parse(rangement).noms.join(',') === 'Sortie banc.gpx,Sortie banc.json' && JSON.parse(rangement).activite === 'kite' && JSON.parse(rangement).balises === 3, rangement);
await go('/itineraires', 3000);
await waitFor(`[...document.querySelectorAll('.route-list__open')].some((x) => x.textContent.includes('Sortie banc'))`, { timeout: 5000, label: 'liste des itinéraires' });
console.log('rouvrir :', await evaluate(`(() => { const b = [...document.querySelectorAll('.route-list__open')].find((x) => x.textContent.includes('Sortie banc')); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await waitFor(async () => /^Balises \((?!0\))\d+\)$/.test((await state()).title ?? ''), { timeout: 5000, label: 'balises rouvertes' });
await settle({ max: 800 });
await log('rouvert');
const rouvert = await state();
check('rouvert : trois balises, même distance, même nom, activité Kite', rouvert.title === 'Balises (3)' && rouvert.distance === distanceRangee && rouvert.name === 'Sortie banc' && rouvert.activity?.includes('Kite') === true, JSON.stringify(rouvert));
check('rouvert : verrouillé (bouton « Modifier l\'itinéraire »)', (await lockLabel()) === "Modifier l'itinéraire", await lockLabel());

// 6. Le menu « … » du nom, sur l'itinéraire rangé et rouvert : entrées, partage du GPX, itinéraire modifié, suppression tenue.
const setName = (valeur) => evaluate(`(() => { const i = document.querySelector('.plan-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(valeur)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
/** Ouvre (`ouvert` vrai) ou ferme le « … » du nom, par son bouton. */
const planMenu = async (ouvert) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.plan-form .ui-more__button'); if (!b) return 'absent'; if ((b.getAttribute('aria-expanded') === 'true') !== ${ouvert}) b.click(); return 'ok'; })()`);
  await wait(300);
  return r;
};
/** Ce que le « … » du nom montre : ouvert ou non, entrées (texte, grisée, entrée tenue), ligne de note. */
const planMenuEtat = async () => JSON.parse(await evaluate(`(() => {
  const p = document.querySelector('.plan-form .ui-more__panel');
  if (!p) return JSON.stringify(null);
  return JSON.stringify({
    ouvert: !p.hidden,
    entrees: [...p.querySelectorAll('button')].map((b) => ({ texte: b.textContent.trim(), grise: b.disabled, tenue: b.classList.contains('ui-btn--hold'), nom: b.getAttribute('aria-label') })),
    note: p.querySelector('.ui-more__note')?.textContent.trim() ?? null,
  });
})()`));
const textes = (m) => (m?.entrees ?? []).map((e) => e.texte);
const tenu = (m) => (m?.entrees ?? []).find((e) => e.tenue);
const fichiersItineraires = () => evaluate(`(async () => {
  try {
    const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('itineraires');
    const noms = [];
    for await (const [nom] of d.entries()) noms.push(nom);
    return noms.sort().join(',');
  } catch (e) { return 'dossier absent'; }
})()`);
/** Appui tenu une seconde sur le bouton « Supprimer » du « … » (le délai est de 1 s), sans clic ensuite. */
const tenirSupprimer = async () => {
  const bas = await evaluate(`(() => { const b = document.querySelector('.plan-form .ui-more__panel .ui-btn--hold'); if (!b) return 'absent'; window.__tenu = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (bas !== 'ok') return bas;
  await wait(1300);
  await evaluate(`(() => { const b = window.__tenu; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  await wait(300);
  return 'ok';
};

console.log('--- menu « … » du nom ---');
console.log('menu ouvert :', await planMenu(true));
const m1 = await planMenuEtat();
console.log('entrées :', JSON.stringify(textes(m1)), '| note :', m1?.note);
check('« … » de l\'itinéraire rangé : « Partager l\'image », « Partager le GPX », « Exporter le GPX », « Supprimer » dans cet ordre',
  textes(m1).join(' ; ') === 'Partager l\'image ; Partager le GPX ; Exporter le GPX ; Supprimer', JSON.stringify(textes(m1)));
check('itinéraire rangé et inchangé : aucune entrée grisée, aucune ligne de note',
  m1.entrees.every((e) => !e.grise) && m1.note === null, JSON.stringify(m1));
check('« Supprimer » est l\'entrée à tenir, de nom « Supprimer l\'itinéraire : maintenir une seconde »',
  tenu(m1)?.texte === 'Supprimer' && tenu(m1)?.nom === 'Supprimer l\'itinéraire : maintenir une seconde', JSON.stringify(tenu(m1)));
const boutonsBloc = await evaluate(`JSON.stringify([...document.querySelectorAll('.plan-actions button, .plan-actions label')].map((b) => b.textContent.trim()))`);
console.log('boutons des blocs :', boutonsBloc);
check('le bloc n\'a plus « Exporter le GPX » ni « Supprimer l\'itinéraire », « Nouvel itinéraire » y reste',
  !/Exporter le GPX|Supprimer l'itinéraire/.test(boutonsBloc) && JSON.parse(boutonsBloc).includes('Nouvel itinéraire') && boutonsBloc.includes('Enregistrer les modifications'), boutonsBloc);
console.log('menu fermé :', await planMenu(false));

// « Partager le GPX » : partage du navigateur simulé, fichier relevé ; puis sans partage, téléchargement et message.
await evaluate(`(() => {
  window.__partage = null;
  navigator.canShare = () => true;
  navigator.share = async (data) => { window.__partage = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size, title: data.title }; };
  return 'ok';
})()`);
await planMenu(true);
console.log('Partager le GPX :', await evaluate(`(() => { const b = [...document.querySelectorAll('.plan-form .ui-more__panel button')].find((x) => x.textContent.trim() === 'Partager le GPX'); if (!b || b.disabled) return 'absent'; b.click(); return 'ok'; })()`));
await wait(600);
const gpxPartage = await evaluate('window.__partage');
console.log('partagé :', JSON.stringify({ name: gpxPartage?.name, type: gpxPartage?.type, title: gpxPartage?.title }));
check('« Partager le GPX » : le fichier « Sortie banc.gpx » est transmis au partage', gpxPartage?.name === 'Sortie banc.gpx' && gpxPartage?.type === 'application/gpx+xml' && gpxPartage.size > 100, JSON.stringify(gpxPartage));
check('un partage abouti ne dit rien, et le menu se referme', (await evaluate(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).filter((t) => /GPX|Partage/.test(t)).length`)) === 0 && !(await planMenuEtat()).ouvert);
await evaluate(`navigator.canShare = () => false`);
await planMenu(true);
await evaluate(`[...document.querySelectorAll('.plan-form .ui-more__panel button')].find((x) => x.textContent.trim() === 'Partager le GPX')?.click()`);
await wait(600);
const noteSansPartage = await evaluate(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).find((t) => t.includes('GPX')) ?? null`);
console.log('sans partage :', noteSansPartage);
check('sans partage du navigateur, le GPX est téléchargé et le message le dit', noteSansPartage === 'Ce navigateur ne partage pas de fichier : le GPX est téléchargé.', String(noteSansPartage));

// Nom modifié : l'itinéraire n'est plus celui qui est rangé, les deux partages sont grisés.
console.log('nom modifié :', await setName('Sortie banc modifiée'));
await wait(300);
await planMenu(true);
const m2 = await planMenuEtat();
console.log('modifié, entrées :', JSON.stringify(m2.entrees.map((e) => `${e.texte}${e.grise ? ' (grisée)' : ''}`)), '| note :', m2.note);
const grises = m2.entrees.filter((e) => e.grise).map((e) => e.texte);
check('itinéraire modifié : « Partager l\'image » et « Partager le GPX » grisés, « Exporter le GPX » et « Supprimer » restent actifs',
  grises.join(' ; ') === 'Partager l\'image ; Partager le GPX', JSON.stringify(grises));
check('itinéraire modifié : la ligne « Enregistrez d\'abord les modifications »', m2.note === 'Enregistrez d\'abord les modifications', String(m2.note));
await planMenu(false);
console.log('nom rétabli :', await setName('Sortie banc'));
await wait(300);
await planMenu(true);
const m3 = await planMenuEtat();
check('nom rétabli : partages dégrisés, plus de ligne de note', m3.entrees.every((e) => !e.grise) && m3.note === null, JSON.stringify(m3));

// « Supprimer » : un clic court ne fait rien d'autre que rappeler le geste.
console.log('clic court :', await evaluate(`(() => { const b = document.querySelector('.plan-form .ui-more__panel .ui-btn--hold'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(300);
const m4 = await planMenuEtat();
console.log('après le clic court :', JSON.stringify(textes(m4)));
check('« Supprimer » d\'un clic court : le menu reste ouvert, le geste est rappelé, rien n\'est supprimé',
  m4.ouvert && tenu(m4)?.texte === 'Maintenir 1 s pour supprimer' && !textes(m4).includes('Supprimer définitivement') && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json',
  `${JSON.stringify(textes(m4))} ${await fichiersItineraires()}`);
// Le rappel tombe au bout de 3 s ; le bouton est retrouvé tel qu'avant avant d'être tenu.
await waitFor(`document.querySelector('.plan-form .ui-more__panel .ui-btn--hold')?.textContent.trim() === 'Supprimer'`, { timeout: 5000, every: 200, label: 'rappel effacé' });

// Tenu une seconde : la confirmation prend la place du bouton, dans le menu resté ouvert.
console.log('appui tenu :', await tenirSupprimer());
const m5 = await planMenuEtat();
console.log('après l\'appui tenu :', JSON.stringify(textes(m5)));
check('« Supprimer » tenu une seconde : « Supprimer définitivement » et « Garder » dans le menu resté ouvert, rien de supprimé encore',
  m5.ouvert && textes(m5).slice(-2).join(' ; ') === 'Supprimer définitivement ; Garder' && !tenu(m5) && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json', JSON.stringify(textes(m5)));
/** Clique l'entrée du « … » du nom dont le texte est `texte` ; « absent » sinon. */
const cliquerEntree = (texte) => evaluate(`(() => { const b = [...document.querySelectorAll('.plan-form .ui-more__panel button')].find((x) => x.textContent.trim() === ${JSON.stringify(texte)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
console.log('Garder :', await cliquerEntree('Garder'));
await wait(400);
const apresGarder = await state();
check('« Garder » : l\'itinéraire est toujours là (ouvert, verrouillé, rangé), le menu est fermé',
  apresGarder.name === 'Sortie banc' && apresGarder.title === 'Balises (3)' && !(await planMenuEtat()).ouvert && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json', JSON.stringify(apresGarder));
await planMenu(true);
const m6 = await planMenuEtat();
check('menu rouvert après « Garder » : le bouton à tenir est revenu', tenu(m6)?.texte === 'Supprimer' && !textes(m6).includes('Supprimer définitivement'), JSON.stringify(textes(m6)));

// La confirmation tombe si le menu se ferme.
console.log('appui tenu :', await tenirSupprimer());
check('confirmation de nouveau demandée', textes(await planMenuEtat()).includes('Supprimer définitivement'));
console.log('menu fermé :', await planMenu(false));
await planMenu(true);
const m7 = await planMenuEtat();
check('menu fermé puis rouvert : la confirmation est tombée, le bouton à tenir est revenu', tenu(m7)?.texte === 'Supprimer' && !textes(m7).includes('Supprimer définitivement') && !textes(m7).includes('Garder'), JSON.stringify(textes(m7)));

// Tenu puis « Supprimer définitivement » : fiche et GPX effacés de la mémoire, le bloc redevient « Enregistrer l'itinéraire ».
console.log('appui tenu :', await tenirSupprimer());
console.log('Supprimer définitivement :', await cliquerEntree('Supprimer définitivement'));
await waitFor(async () => (await fichiersItineraires()) === '', { timeout: 5000, every: 200, label: 'itinéraire supprimé' });
await settle({ max: 1500 });
const apresSuppression = await fichiersItineraires();
console.log('mémoire des itinéraires :', JSON.stringify(apresSuppression));
check('« Supprimer définitivement » : la fiche et le GPX ne sont plus dans la mémoire', apresSuppression === '', apresSuppression);
const titreBloc = await evaluate(`[...document.querySelectorAll('.plan-block__head *')].map((x) => x.children.length === 0 ? x.textContent.trim() : '').filter((x) => x === 'Enregistrer l\\'itinéraire' || x === 'Itinéraire enregistré').join(' | ')`);
console.log('bloc :', titreBloc);
check('le bloc redevient « Enregistrer l\'itinéraire »', titreBloc === 'Enregistrer l\'itinéraire', titreBloc);
const listeApres = await evaluate(`[...document.querySelectorAll('.route-list__open')].map((x) => x.textContent.trim()).join(' | ')`);
check('l\'itinéraire a quitté la liste « Mes itinéraires »', !listeApres.includes('Sortie banc'), listeApres);
if (process.env.DUMP) writeFileSync(process.env.DUMP, await evaluate('document.body.innerText'));

console.log('--- confirmations ---');
dialogs.forEach((d) => console.log(d));
check('aucune erreur de console', logs.length === 0, [...new Set(logs)].slice(0, 5).join(' | '));
await finish();
