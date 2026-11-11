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
//  5. « Enregistrer » (fiche et GPX rangés), rechargement, réouverture depuis la liste : verrouillé, mêmes balises.
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
if (process.env.DUMP) writeFileSync(process.env.DUMP, await evaluate('document.body.innerText'));

console.log('--- confirmations ---');
dialogs.forEach((d) => console.log(d));
check('aucune erreur de console', logs.length === 0, [...new Set(logs)].slice(0, 5).join(' | '));
await finish();
