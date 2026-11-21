// Banc de test : planification d'un itinéraire de voile (page /itineraires ; remis sur la page réduite au lot 330).
// Usage : node planning.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Le bloc « Tracé et balises (n) » réunit la bande de chiffres, les actions et la liste des balises.
// La page ne calcule plus rien : les balises se relient en ligne droite, plus de mode, de type de voie ni de revêtement.
// Le script vérifie, sur un profil neuf, en Wingfoil, tous les onglets ouverts (le dossier de travail ne sert plus :
// aucun GPX n'est chargé dans Planifier) :
//  1. trois balises posées, « Précédent », « Boucler » (le bord 3 → 1), « Tout effacer » ;
//  2. le bandeau d'une balise : « Retirer », puis « Boucler ici » sur la balise 1 ;
//  2b. le bloc « Tracé et balises » (quatre balises) : ordre des blocs et des pastilles (« Balises sonores » en dernier),
//     bande de chiffres et lignes de balises (bord et cap), une seule ligne dépliée à la fois, Monter et Descendre (la
//     ligne dépliée suit la balise), Retirer, « Inverser », « Précédent » (icône du bloc) et « Boucler » qui replient, « Tout effacer » ;
//  3. « Charger un GPX » n'existe plus dans Planifier (ni bouton, ni champ de fichier, ni phrase d'aide) ;
//  4. deux balises posées, une balise insérée sur le tracé (distance inchangée), l'arrivée déplacée, « Précédent »,
//     « Inverser » ;
//  5. activité Kite choisie, « Enregistrer » (fiche et GPX rangés), rechargement, réouverture depuis la liste : verrouillé,
//     mêmes balises ;
//  5b. le retour : le lien « ← » et la touche retour d'Android (`gtrackerBack`) ramènent de Planifier, itinéraire ouvert,
//     à la liste des itinéraires, puis à Sessions ; la pastille « Planification » de Sessions et « Planifier » de la liste
//     (classe `ui-tab--action`, pleine à l'encre) ont la même hauteur que « Tris » ; de la liste, « Planifier » ouvre
//     Planifier, d'où le retour revient à la liste ;
//  6. le menu « … » de l'itinéraire rouvert, dans l'en-tête de la page à droite du titre (et plus dans le bloc du nom) :
//     ses entrées, le bloc sans « Exporter le GPX » ni « Supprimer l'itinéraire », « Partager le GPX » (partage du navigateur simulé, puis sans partage), nom modifié (partages grisés
//     et leur ligne), « Supprimer » d'un clic court, tenu une seconde, « Garder », menu fermé puis rouvert, « Supprimer
//     définitivement » (mémoire vidée, le bloc redevient « Enregistrer l'itinéraire »).
//  7. le nom composé d'un itinéraire sans nom saisi : sans réseau « Aller du JJ/MM » et « Boucle du JJ/MM » (grisé du champ,
//     liste, nom du fichier) ; avec le service de lieux simulé « Aller de A à B le JJ/MM » et « Boucle à A le JJ/MM »
//     (à l'ouverture dans Planifier et après le rangement) ; un nom saisi reste.
// Verdicts par `check` ; fin par « Tout passe. » ou le nombre d'échecs, code 0 ou 1.
import { writeFileSync } from 'node:fs';
import { CLES, connect, DOSSIER_MEMOIRE, POIGNEE_RETOUR } from './lib/cdp.mjs';
import { autour, fakePlaces } from './lib/lieux.mjs';
import { ONGLETS } from './lib/onglets.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node planning.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const b = await connect({ port, shotDir });
const { send, evaluate, go: goRaw, settle, waitFor, wait, mouse, onMessage, logs, check, finish, shoot } = b;
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
const clickAt = async (x, y) => { await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await wait(300); };
/** Toucher de la carte, à la fraction (fx, fy) de son cadre. */
const tapMap = async (fx, fy) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.plan-map .leaflet-container').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  await clickAt(r[0] + r[2] * fx, r[1] + r[3] * fy);
};
// Le bloc « Tracé et balises » : bande de chiffres (distance, nombre de balises, bord max), puis une ligne par balise
// (pastille, nom, distance et cap du bord qui y mène). Les bords « 1 → 2 » se reconstruisent des pastilles des lignes.
const state = async () => JSON.parse(await evaluate(`(() => {
  const title = [...document.querySelectorAll('button, h2, h3, span, strong')].map((x) => x.textContent.trim()).find((t) => /^Tracé et balises \\(\\d+\\)$/.test(t)) ?? null;
  const items = [...document.querySelectorAll('.plan-trace .plan-figures__item')];
  const rows = [...document.querySelectorAll('.plan-trace ol.plan-points > li.plan-point')];
  const dots = rows.map((r) => r.querySelector('.plan-point__dot')?.textContent ?? '');
  return JSON.stringify({
    title,
    distance: document.querySelector('.plan-trace .plan-figures__distance')?.textContent ?? null,
    balises: items[0]?.textContent.match(/^\\d+/)?.[0] ?? null,
    bordMax: items[1]?.querySelector('strong')?.textContent ?? null,
    bords: dots.slice(1).map((d, i) => dots[i] + ' → ' + d),
    détail: rows.slice(1).map((r) => (r.querySelector('.plan-point__leg')?.textContent ?? '') + ' ' + (r.querySelector('.plan-point__bearing')?.textContent ?? '')),
    repères: dots,
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
  localStorage.setItem('${CLES.sections}', JSON.stringify({ planning: { balises: true, ranger: true, liste: true, parcours: true } })); 'ok'`);
await go('/itineraires', 3000);

// 1. Trois balises, « Précédent », « Boucler », « Tout effacer ».
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
const trois = await state();
await log('trois balises');
check('trois balises : bloc « Tracé et balises (3) », chiffre 3, repères 1, 2, 3, bords 1 → 2 et 2 → 3',
  trois.title === 'Tracé et balises (3)' && trois.balises === '3' && trois.repères.join(',') === '1,2,3' && trois.bords.join(' ; ') === '1 → 2 ; 2 → 3', JSON.stringify(trois));
check('le nom proposé est celui du jour, activité Wingfoil', trois.activity?.includes('Wingfoil') === true, trois.activity);
console.log('Précédent (carte) :', await clickText('Précédent', '.plan-map-tools button'));
const deux = await state();
check('« Précédent » retire la dernière balise : « Tracé et balises (2) », un seul bord', deux.title === 'Tracé et balises (2)' && deux.bords.length === 1, JSON.stringify(deux));
await tapMap(0.55, 0.7);
console.log('Boucler :', await clickText('Boucler'));
const boucle = await state();
await log('boucle');
check('« Boucler » : « Tracé et balises (4) », chiffre 3, bord 3 → 1', boucle.title === 'Tracé et balises (4)' && boucle.balises === '3' && boucle.bords.at(-1) === '3 → 1', JSON.stringify(boucle));
check('« Boucler » est ensuite grisé', (await clickText('Boucler')) === 'absent');
console.log('Tout effacer :', await clickText('Tout effacer'));
const vide = await state();
check('« Tout effacer » : « Tracé et balises (0) », distance nulle', vide.title === 'Tracé et balises (0)' && vide.bords.length === 0 && /^0[,.]00 km$/.test(vide.distance ?? ''), JSON.stringify(vide));

// 2. Le bandeau d'une balise : « Retirer », puis « Boucler ici » sur la 1.
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
console.log('bandeau de la balise 2 :', await tapMarker(1), await overlayText());
// Les boutons sont en capitales à l'écran (`innerText` suit la casse affichée).
check('le bandeau de la balise 2 propose « Retirer » seul', /^Balise 2 · retirer/i.test(String(await overlayText())) && !/boucler ici/i.test(String(await overlayText())), String(await overlayText()));
console.log('Retirer :', await clickText('Retirer', '.plan-overlay button'));
const retire = await state();
check('« Retirer » : « Tracé et balises (2) », bandeau fermé', retire.title === 'Tracé et balises (2)' && (await overlayText()) === null, JSON.stringify(retire));
console.log('bandeau de la balise 1 :', await tapMarker(0), await overlayText());
check('le bandeau de la balise 1 propose « Boucler ici »', /boucler ici/i.test(String(await overlayText())), String(await overlayText()));
console.log('Boucler ici :', await clickText('Boucler ici', '.plan-overlay button'));
const boucleIci = await state();
check('« Boucler ici » : « Tracé et balises (3) », bord 2 → 1', boucleIci.title === 'Tracé et balises (3)' && boucleIci.bords.at(-1) === '2 → 1', JSON.stringify(boucleIci));
console.log('Tout effacer :', await clickText('Tout effacer'));

// 2b. Le bloc « Tracé et balises » : ordre des blocs, bande de chiffres, une ligne dépliée à la fois, Monter, Descendre,
// Retirer, replis. Quatre balises ; les marqueurs de la carte disent où chaque balise est allée.
const lignes = async () => JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.plan-trace ol.plan-points > li.plan-point')].map((li) => ({
  repere: li.querySelector('.plan-point__dot')?.textContent ?? '',
  nom: li.querySelector('.plan-point__name')?.textContent ?? '',
  bord: li.querySelector('.plan-point__leg')?.textContent ?? '',
  cap: li.querySelector('.plan-point__bearing')?.textContent ?? '',
  deplie: li.classList.contains('plan-point--selected'),
  expanded: li.querySelector('.plan-point__main')?.getAttribute('aria-expanded') ?? null,
  actions: [...li.querySelectorAll('.plan-point__actions button')].map((b) => ({ nom: b.getAttribute('aria-label'), grise: b.disabled })),
})))`));
const depliees = (ls) => ls.flatMap((l, i) => (l.deplie ? [i] : []));
const toucherLigne = async (i) => {
  const r = await evaluate(`(() => { const b = document.querySelectorAll('.plan-trace ol.plan-points > li.plan-point')[${i}]?.querySelector('.plan-point__main'); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
  await wait(250);
  return r;
};
const actionLigne = async (nom) => {
  const r = await evaluate(`(() => { const b = [...document.querySelectorAll('.plan-trace .plan-point__actions button')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(nom)}); if (!b) return 'absent'; if (b.disabled) return 'grisé'; b.click(); return 'ok'; })()`);
  await wait(250);
  return r;
};
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
await tapMap(0.3, 0.75);
const quatre = await state();
const l0 = await lignes();
console.log('quatre balises, lignes :', JSON.stringify(l0));
const blocs = JSON.parse(await evaluate(`JSON.stringify({
  titres: [...document.querySelectorAll('.plan-panel .plan-block__head')].map((x) => x.textContent.trim()),
  pastilles: [...document.querySelectorAll('.plan-panel .ui-tab')].map((x) => x.getAttribute('data-tab')),
  anciens: [...document.querySelectorAll('.plan-panel .plan-block__head')].filter((x) => /^(Parcours|Tracé|Balises \\(\\d+\\))$/.test(x.textContent.trim())).length,
  classesDisparues: document.querySelectorAll('.plan-stats, .plan-stat, .plan-course, .plan-course__leg, .plan-point__text, .plan-point__move').length,
})`));
console.log('blocs :', JSON.stringify(blocs));
check('quatre blocs dans l\'ordre : « Tracé et balises (4) », enregistrer, mes itinéraires, « Balises sonores » en dernier',
  blocs.titres.length === 4 && blocs.titres[0] === 'Tracé et balises (4)' && blocs.titres[1] === 'Enregistrer l\'itinéraire' && /^Mes itinéraires \(\d+\)$/.test(blocs.titres[2]) && blocs.titres[3] === 'Balises sonores', JSON.stringify(blocs.titres));
check('les pastilles suivent : balises, ranger, liste, parcours (balises sonores)', blocs.pastilles.join(',') === 'balises,ranger,liste,parcours', blocs.pastilles.join(','));
check('plus de bloc « Parcours », « Tracé » ni « Balises (n) », plus de classe de l\'ancienne liste', blocs.anciens === 0 && blocs.classesDisparues === 0, JSON.stringify(blocs));
check('quatre lignes de balises, pastilles 1 à 4, aucune dépliée, aria-expanded faux',
  l0.length === 4 && l0.map((l) => l.repere).join(',') === '1,2,3,4' && depliees(l0).length === 0 && l0.every((l) => l.expanded === 'false' && l.actions.length === 0), JSON.stringify(l0));
check('le départ n\'a ni bord ni cap (« — »), les trois autres lignes ont distance et cap en degrés',
  l0[0].bord === '—' && l0[0].cap === '' && l0.slice(1).every((l) => /^\d+[,.]\d+ km$|^\d+ m$/.test(l.bord) && /^\d+°$/.test(l.cap)), JSON.stringify(l0.map((l) => [l.bord, l.cap])));
const nombre = (s) => Number.parseFloat(String(s).replace(',', '.'));
check('la bande de chiffres : 4 balises, « bord max » égal au plus long bord des lignes, distance non nulle',
  quatre.balises === '4' && nombre(quatre.bordMax) === Math.max(...l0.slice(1).map((l) => nombre(l.bord))) && nombre(quatre.distance) > 0 && nombre(quatre.distance) >= nombre(quatre.bordMax), JSON.stringify(quatre));
// Précédent du bloc : icône seule, mêmes nom et infobulle que celui de la carte.
const precedents = JSON.parse(await evaluate(`JSON.stringify({
  carte: [...document.querySelectorAll('.plan-map-tools button')].filter((b) => b.textContent.trim() === 'Précédent').map((b) => b.getAttribute('aria-label')),
  bloc: [...document.querySelectorAll('.plan-trace .plan-actions button')].filter((b) => b.getAttribute('aria-label')?.startsWith('Précédent')).map((b) => ({ texte: b.textContent.trim(), nom: b.getAttribute('aria-label'), title: b.getAttribute('title') })),
})`));
console.log('Précédent :', JSON.stringify(precedents));
check('« Précédent » du bloc : une icône sans texte, mêmes aria-label et title que celui de la carte',
  precedents.carte.length === 1 && precedents.bloc.length === 1 && precedents.bloc[0].texte === '' && precedents.bloc[0].nom === precedents.carte[0] && precedents.bloc[0].title === precedents.carte[0], JSON.stringify(precedents));

// La carte se recadre après un changement de balises : les positions ne se lisent qu'une fois immobiles (deux lectures égales).
const markersStables = async () => {
  let a = JSON.stringify(await markers());
  for (let k = 0; k < 20; k++) {
    await wait(200);
    const b = JSON.stringify(await markers());
    if (a === b) return JSON.parse(b);
    a = b;
  }
  return JSON.parse(a);
};
const P = await markersStables();
// Toucher une ligne recentre la carte sur la balise : les positions se comparent par rapport au premier repère présent
// sur la carte (le glissement est le même pour tous), à 4 px près.
const relatifs = (m, base) => m.map((p) => [p[0] - base[0], p[1] - base[1]]);
const proches = (a, b) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= 4 && Math.abs(p[1] - b[i][1]) <= 4);
const memeOrdre = async (ordre) => {
  const m = await markersStables();
  return proches(relatifs(m, m[0]), relatifs(ordre.map((k) => P[k]), P[ordre[0]]));
};
console.log('toucher la ligne 2 :', await toucherLigne(1));
let ls = await lignes();
check('toucher une ligne la déplie : seule la ligne 2, aria-expanded vrai, Monter, Descendre et Retirer de la balise 2',
  depliees(ls).join() === '1' && ls[1].expanded === 'true' && ls[1].actions.map((a) => a.nom).join(' ; ') === 'Monter : Balise 2 ; Descendre : Balise 2 ; Retirer : Balise 2', JSON.stringify(ls[1]));
console.log('toucher la ligne 3 :', await toucherLigne(2));
ls = await lignes();
check('toucher une autre ligne : une seule ligne dépliée à la fois (la 3, plus la 2)', depliees(ls).join() === '2' && ls[1].actions.length === 0 && ls[2].actions.length === 3, JSON.stringify(depliees(ls)));
console.log('retoucher la ligne 3 :', await toucherLigne(2));
ls = await lignes();
check('retoucher la ligne dépliée la replie : plus aucune ligne dépliée', depliees(ls).length === 0 && ls.every((l) => l.expanded === 'false'), JSON.stringify(depliees(ls)));
await toucherLigne(0);
ls = await lignes();
check('le départ : « Monter » grisé, « Descendre » actif', ls[0].actions[0].grise === true && ls[0].actions[1].grise === false, JSON.stringify(ls[0].actions));
await toucherLigne(3);
ls = await lignes();
check('l\'arrivée : « Descendre » grisé, « Monter » actif', ls[3].actions[1].grise === true && ls[3].actions[0].grise === false, JSON.stringify(ls[3].actions));
await toucherLigne(2);
console.log('Monter : Balise 3 :', await actionLigne('Monter : Balise 3'));
ls = await lignes();
check('Monter : la balise 3 passe en 2 sur la carte, la ligne dépliée la suit (la 2)', (await memeOrdre([0, 2, 1, 3])) && depliees(ls).join() === '1', `${depliees(ls)} ${JSON.stringify(await markers())}`);
console.log('Descendre : Balise 2 :', await actionLigne('Descendre : Balise 2'));
ls = await lignes();
check('Descendre : la balise revient en 3 sur la carte, la ligne dépliée la suit (la 3)', (await memeOrdre([0, 1, 2, 3])) && depliees(ls).join() === '2', `${depliees(ls)} ${JSON.stringify(await markers())}`);
await toucherLigne(2);
await toucherLigne(1);
console.log('Retirer : Balise 2 :', await actionLigne('Retirer : Balise 2'));
ls = await lignes();
const apresRetrait = await state();
// La carte se recadre sur les balises restantes : la bonne balise est retirée si le bord C → D (la dernière ligne) est resté
// le même, et si les bords sont devenus A → C puis C → D (le bord A → B a disparu).
check('Retirer : la balise 2 est retirée (le bord de la dernière ligne ne change pas, le bord de la ligne 2 est neuf), trois lignes, aucune dépliée',
  ls.length === 3 && depliees(ls).length === 0 && apresRetrait.title === 'Tracé et balises (3)' && apresRetrait.balises === '3'
  && ls[2].bord === l0[3].bord && ls[2].cap === l0[3].cap && ls[1].cap !== l0[1].cap && (await markersStables()).length === 3, `${JSON.stringify(ls.map((l) => [l.bord, l.cap]))} contre ${JSON.stringify(l0.map((l) => [l.bord, l.cap]))}`);
// Inverser et Précédent replient la ligne dépliée.
const avantReplis = ls.map((l) => [l.bord, l.cap]);
await toucherLigne(1);
console.log('Inverser :', await clickText('Inverser'));
ls = await lignes();
check('« Inverser » replie la ligne dépliée et renverse les bords (distances dans l\'ordre inverse)',
  depliees(ls).length === 0 && ls.slice(1).map((l) => l.bord).join() === avantReplis.slice(1).map((b) => b[0]).reverse().join(), `${depliees(ls)} ${JSON.stringify(ls.map((l) => l.bord))} contre ${JSON.stringify(avantReplis)}`);
await toucherLigne(1);
console.log('Précédent (bloc) :', await evaluate(`(() => { const b = [...document.querySelectorAll('.plan-trace .plan-actions button')].find((x) => x.getAttribute('aria-label')?.startsWith('Précédent')); if (!b || b.disabled) return 'absent'; b.click(); return 'ok'; })()`));
ls = await lignes();
check('« Précédent » du bloc défait « Inverser » et replie la ligne dépliée', depliees(ls).length === 0 && JSON.stringify(ls.map((l) => [l.bord, l.cap])) === JSON.stringify(avantReplis), `${depliees(ls)} ${JSON.stringify(ls.map((l) => [l.bord, l.cap]))} contre ${JSON.stringify(avantReplis)}`);
await toucherLigne(1);
console.log('Boucler :', await clickText('Boucler'));
await wait(250);
ls = await lignes();
check('« Boucler » replie la ligne dépliée', depliees(ls).length === 0 && ls.length === 4, `${depliees(ls)} ${ls.length}`);
await toucherLigne(1);
console.log('Tout effacer :', await clickText('Tout effacer'));
await wait(250);
ls = await lignes();
const videListe = await evaluate(`document.querySelector('.plan-trace .plan-note')?.textContent ?? null`);
check('« Tout effacer » : plus de ligne, la note « Aucun point » reprend la place', ls.length === 0 && /^Aucun point/.test(String(videListe)), String(videListe));

// 3. « Charger un GPX » a quitté Planifier : ni bouton, ni champ de fichier, ni phrase d'aide ; un GPX entre par
// « Importer un itinéraire » de la liste des itinéraires, seul chemin.
const sansCharger = JSON.parse(await evaluate(`JSON.stringify({
  champs: document.querySelectorAll('.plan-page input[type=file]').length,
  boutons: [...document.querySelectorAll('.plan-page button, .plan-page label')].filter((x) => /Charger un GPX/.test(x.textContent)).length,
  texte: /Charger un GPX/.test(document.body.textContent),
})`));
console.log('Charger un GPX :', JSON.stringify(sansCharger));
check('Planifier : plus de « Charger un GPX » (ni bouton, ni champ de fichier, ni phrase d\'aide)', sansCharger.champs === 0 && sansCharger.boutons === 0 && sansCharger.texte === false, JSON.stringify(sansCharger));

// 4. Une balise insérée sur le tracé, l'arrivée déplacée, « Précédent », « Inverser » : deux balises posées à la main.
await tapMap(0.3, 0.5);
await tapMap(0.7, 0.5);
await log('deux balises');
const deuxPosees = await state();
check('deux balises posées : « Tracé et balises (2) », un seul bord', deuxPosees.title === 'Tracé et balises (2)' && deuxPosees.bords.length === 1 && deuxPosees.alert === '', JSON.stringify(deuxPosees));
await shoot('planning-trace');
const avantInsertion = (await state()).distance;
const mid = await evaluate(`(() => {
  const path = [...document.querySelectorAll('.plan-map path.leaflet-interactive')].find((p) => p.getAttribute('stroke-width') === '24');
  if (!path) return null;
  const p = path.getPointAtLength(path.getTotalLength() * 0.5).matrixTransform(path.getScreenCTM());
  return [p.x, p.y];
})()`);
check('le tracé porte un tronçon à toucher', mid !== null, 'aucun tracé de 24 px');
if (mid) await clickAt(mid[0], mid[1]);
await log('balise insérée');
const insere = await state();
check('une balise posée sur le tracé : « Tracé et balises (3) », distance inchangée', insere.title === 'Tracé et balises (3)' && insere.distance === avantInsertion, `${avantInsertion} -> ${insere.distance}`);
const avantGlisser = await markers();
const fin = avantGlisser.at(-1);
await mouse('mousePressed', fin[0], fin[1]);
for (let k = 1; k <= 8; k++) await mouse('mouseMoved', fin[0] + 6 * k, fin[1] + 4 * k);
await mouse('mouseReleased', fin[0] + 48, fin[1] + 32);
await wait(500);
await log('arrivée déplacée');
const deplace = await state();
check('l\'arrivée glissée : toujours trois balises, distance changée', deplace.title === 'Tracé et balises (3)' && deplace.distance !== avantInsertion, `${avantInsertion} -> ${deplace.distance}`);
console.log('Précédent :', await clickText('Précédent', '.plan-map-tools button'));
const apresPrecedent = await state();
check('« Précédent » rend la distance d\'avant le glisser', apresPrecedent.distance === avantInsertion && apresPrecedent.title === 'Tracé et balises (3)', `${apresPrecedent.distance}`);
const avantInverser = await markers();
console.log('Inverser :', await clickText('Inverser'));
const inverse = await markers();
check('« Inverser » : le départ passe à l\'arrivée', JSON.stringify(inverse) === JSON.stringify([...avantInverser].reverse()), JSON.stringify(inverse));
console.log('Inverser :', await clickText('Inverser'));
check('« Inverser » deux fois : les balises reviennent', JSON.stringify(await markers()) === JSON.stringify(avantInverser), JSON.stringify(await markers()));

// 5. Activité Kite, enregistrer, recharger, rouvrir.
const chooseActivity = (text) => evaluate(`(async () => {
  const radio = [...document.querySelectorAll('[aria-label=Activité] button[role=radio]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
  if (radio) { radio.click(); return 'ok'; }
  for (const button of document.querySelectorAll('button.activity-select:not(:disabled)')) {
    button.click();
    await new Promise((r) => setTimeout(r, 150));
    const item = [...document.querySelectorAll('.activity-select__option')].find((o) => o.textContent.trim() === ${JSON.stringify(text)});
    if (item) { item.click(); return 'ok'; }
    document.querySelector('.activity-select__backdrop')?.click();
    await new Promise((r) => setTimeout(r, 150));
  }
  return 'absent';
})()`);
console.log('activité Kite :', await chooseActivity('Kite'));
await wait(300);
check('activité Kite choisie, les balises restent', (await state()).activity?.includes('Kite') === true && (await state()).title === 'Tracé et balises (3)', JSON.stringify(await state()));
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
await waitFor(async () => /^Tracé et balises \((?!0\))\d+\)$/.test((await state()).title ?? ''), { timeout: 5000, label: 'balises rouvertes' });
await settle({ max: 800 });
await log('rouvert');
const rouvert = await state();
check('rouvert : trois balises, même distance, même nom, activité Kite', rouvert.title === 'Tracé et balises (3)' && rouvert.distance === distanceRangee && rouvert.name === 'Sortie banc' && rouvert.activity?.includes('Kite') === true, JSON.stringify(rouvert));
check('rouvert : verrouillé (bouton « Modifier l\'itinéraire »)', (await lockLabel()) === "Modifier l'itinéraire", await lockLabel());

// 5b. Le retour. Itinéraire ouvert, le « ← » de l'en-tête et la touche retour d'Android ramènent à la liste des itinéraires,
// la liste à Sessions ; « Planification » de Sessions et « Planifier » de la liste sont des pastilles d'action de la
// hauteur de « Tris ».
const back = () => evaluate(`window.${POIGNEE_RETOUR} ? window.${POIGNEE_RETOUR}() : 'absent'`);
const chemin = () => evaluate('location.pathname');
const cheminEst = (p) => waitFor(`location.pathname === ${JSON.stringify(p)}`, { timeout: 5000, every: 100, label: p });
const pastille = (selecteur) => evaluate(`(() => { const a = document.querySelector(${JSON.stringify(selecteur)}); if (!a) return null; const s = getComputedStyle(a); return { texte: a.textContent.trim(), classes: a.className, h: Math.round(a.getBoundingClientRect().height * 10) / 10, fond: s.backgroundColor, couleur: s.color }; })()`);
const lienRetour = await evaluate(`(() => { const a = document.querySelector('.ui-page-header .ui-back'); return a ? { href: a.getAttribute('href'), texte: a.textContent.trim() } : null; })()`);
console.log('lien retour :', JSON.stringify(lienRetour));
check('Planifier : le lien « ← » mène à la liste des itinéraires (« Itinéraires planifiés »)', lienRetour?.href === '/itineraires/liste' && lienRetour.texte === 'Itinéraires planifiés', JSON.stringify(lienRetour));
check('Planifier, itinéraire ouvert : le « … » est dans l\'en-tête (à droite du titre), plus dans le bloc du nom',
  (await evaluate(`document.querySelector('.ui-page-header__row .ui-more__button') !== null && document.querySelector('.plan-form .ui-more__button') === null`)) === true);
console.log('retour (Planifier, itinéraire ouvert) :', await back());
check('retour depuis Planifier, itinéraire ouvert : la liste des itinéraires', (await cheminEst('/itineraires/liste')) === true, await chemin());
await waitFor(`Boolean(document.querySelector('a.ui-tab--action[href="/itineraires"]'))`, { timeout: 5000, label: 'pastille Planifier' });
const planifierListe = await pastille('a.ui-tab--action[href="/itineraires"]');
console.log('« Planifier » de la liste :', JSON.stringify(planifierListe));
check('la liste : « Planifier » est une pastille d\'action (`ui-tab ui-tab--action`), pleine à l\'encre', planifierListe?.texte === 'Planifier' && /\bui-tab\b/.test(planifierListe.classes) && /\bui-tab--action\b/.test(planifierListe.classes) && planifierListe.fond !== 'rgba(0, 0, 0, 0)', JSON.stringify(planifierListe));
console.log('retour (liste) :', await back());
check('retour depuis la liste des itinéraires : Sessions', (await cheminEst('/sessions')) === true, await chemin());
await waitFor(`Boolean(document.querySelector('.sessions-head__pills a'))`, { timeout: 5000, label: 'pastilles de Sessions' });
const planification = await pastille('.sessions-head__pills a');
const tris = await pastille('.sessions-head__pills button');
console.log('« Planification » :', JSON.stringify(planification), '| « Tris » :', JSON.stringify(tris));
check('Sessions : « Planification » est une pastille d\'action (`ui-tab--action`), « Tris » non', planification?.texte === 'Planification' && /\bui-tab--action\b/.test(planification.classes) && tris?.texte === 'Tris' && !/\bui-tab--action\b/.test(tris.classes) && planification.fond !== tris.fond, JSON.stringify([planification, tris]));
check('« Planification » (Sessions), « Planifier » (liste) et « Tris » ont la même hauteur, même couleur de fond et de texte pour les deux pastilles d\'action',
  planification?.h === tris?.h && planification?.h === planifierListe?.h && planification?.fond === planifierListe?.fond && planification?.couleur === planifierListe?.couleur, JSON.stringify([planification?.h, tris?.h, planifierListe?.h]));
console.log('Planification :', await evaluate(`(() => { const a = document.querySelector('.sessions-head__pills a'); if (!a) return 'absent'; a.click(); return 'ok'; })()`));
check('« Planification » ouvre la liste des itinéraires', (await cheminEst('/itineraires/liste')) === true, await chemin());
await waitFor(`Boolean(document.querySelector('a.ui-tab--action[href="/itineraires"]'))`, { timeout: 5000, label: 'pastille Planifier' });
console.log('Planifier (liste) :', await evaluate(`document.querySelector('a.ui-tab--action[href="/itineraires"]').click() ?? 'ok'`));
check('« Planifier » de la liste ouvre Planifier', (await cheminEst('/itineraires')) === true, await chemin());
await waitFor(`Boolean(document.querySelector('.plan-map .leaflet-container'))`, { timeout: 5000, label: 'carte de Planifier' });
console.log('retour (Planifier, parcours neuf) :', await back());
check('retour depuis Planifier : la liste des itinéraires, non Sessions', (await cheminEst('/itineraires/liste')) === true, await chemin());
// Un itinéraire ouvert depuis la liste : le retour ramène à la liste, puis on le rouvre pour le menu « … ».
const ouvrirDeLaListe = async () => {
  await waitFor(`[...document.querySelectorAll('.route-list__open')].some((x) => x.textContent.includes('Sortie banc'))`, { timeout: 5000, label: 'itinéraire dans la liste' });
  await evaluate(`[...document.querySelectorAll('.route-list__open')].find((x) => x.textContent.includes('Sortie banc')).click()`);
  await waitFor(async () => /^Tracé et balises \((?!0\))\d+\)$/.test((await state()).title ?? ''), { timeout: 5000, label: 'balises rouvertes' });
  await settle({ max: 800 });
};
await ouvrirDeLaListe();
// Planifier retire `?itineraire=` de l'adresse une fois l'itinéraire chargé (remplacement, sans entrée d'historique).
check('un itinéraire ouvert depuis la liste : Planifier, adresse nettoyée', (await chemin()) === '/itineraires' && (await evaluate('location.search')) === '',`${await chemin()} ${await evaluate('location.search')}`);
console.log('retour (itinéraire ouvert depuis la liste) :', await back());
check('retour depuis l\'itinéraire ouvert depuis la liste : la liste', (await cheminEst('/itineraires/liste')) === true, await chemin());
await ouvrirDeLaListe();
check('itinéraire rouvert depuis la liste : trois balises, même nom, verrouillé', (await state()).title === 'Tracé et balises (3)' && (await state()).name === 'Sortie banc' && (await lockLabel()) === "Modifier l'itinéraire", JSON.stringify(await state()));

// 6. Le menu « … » de l'en-tête, sur l'itinéraire rangé et rouvert : entrées, partage du GPX, itinéraire modifié, suppression tenue.
const setName = (valeur) => evaluate(`(() => { const i = document.querySelector('.plan-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(valeur)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
/** Ouvre (`ouvert` vrai) ou ferme le « … » de l'en-tête, par son bouton. */
const planMenu = async (ouvert) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.ui-page-header .ui-more__button'); if (!b) return 'absent'; if ((b.getAttribute('aria-expanded') === 'true') !== ${ouvert}) b.click(); return 'ok'; })()`);
  await wait(300);
  return r;
};
/** Ce que le « … » de l'en-tête montre : ouvert ou non, entrées (texte, grisée, entrée tenue), ligne de note. */
const planMenuEtat = async () => JSON.parse(await evaluate(`(() => {
  const p = document.querySelector('.ui-page-header .ui-more__panel');
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
  const bas = await evaluate(`(() => { const b = document.querySelector('.ui-page-header .ui-more__panel .ui-btn--hold'); if (!b) return 'absent'; window.__tenu = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (bas !== 'ok') return bas;
  await wait(1300);
  await evaluate(`(() => { const b = window.__tenu; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  await wait(300);
  return 'ok';
};

console.log('--- menu « … » de l\'en-tête ---');
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
console.log('Partager le GPX :', await evaluate(`(() => { const b = [...document.querySelectorAll('.ui-page-header .ui-more__panel button')].find((x) => x.textContent.trim() === 'Partager le GPX'); if (!b || b.disabled) return 'absent'; b.click(); return 'ok'; })()`));
await wait(600);
const gpxPartage = await evaluate('window.__partage');
console.log('partagé :', JSON.stringify({ name: gpxPartage?.name, type: gpxPartage?.type, title: gpxPartage?.title }));
check('« Partager le GPX » : le fichier « Sortie banc.gpx » est transmis au partage', gpxPartage?.name === 'Sortie banc.gpx' && gpxPartage?.type === 'application/gpx+xml' && gpxPartage.size > 100, JSON.stringify(gpxPartage));
check('un partage abouti ne dit rien, et le menu se referme', (await evaluate(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).filter((t) => /GPX|Partage/.test(t)).length`)) === 0 && !(await planMenuEtat()).ouvert);
await evaluate(`navigator.canShare = () => false`);
await planMenu(true);
await evaluate(`[...document.querySelectorAll('.ui-page-header .ui-more__panel button')].find((x) => x.textContent.trim() === 'Partager le GPX')?.click()`);
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
console.log('clic court :', await evaluate(`(() => { const b = document.querySelector('.ui-page-header .ui-more__panel .ui-btn--hold'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(300);
const m4 = await planMenuEtat();
console.log('après le clic court :', JSON.stringify(textes(m4)));
check('« Supprimer » d\'un clic court : le menu reste ouvert, le geste est rappelé, rien n\'est supprimé',
  m4.ouvert && tenu(m4)?.texte === 'Maintenir 1 s pour supprimer' && !textes(m4).includes('Supprimer définitivement') && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json',
  `${JSON.stringify(textes(m4))} ${await fichiersItineraires()}`);
// Le rappel tombe au bout de 3 s ; le bouton est retrouvé tel qu'avant avant d'être tenu.
await waitFor(`document.querySelector('.ui-page-header .ui-more__panel .ui-btn--hold')?.textContent.trim() === 'Supprimer'`, { timeout: 5000, every: 200, label: 'rappel effacé' });

// Tenu une seconde : la confirmation prend la place du bouton, dans le menu resté ouvert.
console.log('appui tenu :', await tenirSupprimer());
const m5 = await planMenuEtat();
console.log('après l\'appui tenu :', JSON.stringify(textes(m5)));
check('« Supprimer » tenu une seconde : « Supprimer définitivement » et « Garder » dans le menu resté ouvert, rien de supprimé encore',
  m5.ouvert && textes(m5).slice(-2).join(' ; ') === 'Supprimer définitivement ; Garder' && !tenu(m5) && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json', JSON.stringify(textes(m5)));
/** Clique l'entrée du « … » de l'en-tête dont le texte est `texte` ; « absent » sinon. */
const cliquerEntree = (texte) => evaluate(`(() => { const b = [...document.querySelectorAll('.ui-page-header .ui-more__panel button')].find((x) => x.textContent.trim() === ${JSON.stringify(texte)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
console.log('Garder :', await cliquerEntree('Garder'));
await wait(400);
const apresGarder = await state();
check('« Garder » : l\'itinéraire est toujours là (ouvert, verrouillé, rangé), le menu est fermé',
  apresGarder.name === 'Sortie banc' && apresGarder.title === 'Tracé et balises (3)' && !(await planMenuEtat()).ouvert && (await fichiersItineraires()) === 'Sortie banc.gpx,Sortie banc.json', JSON.stringify(apresGarder));
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

// 7. Le nom composé d'un itinéraire sans nom saisi. D'abord sans réseau (le service de lieux est bloqué d'office) :
// « Aller du JJ/MM », « Boucle du JJ/MM », en grisé dans le champ, dans la liste et dans le nom du fichier (la barre de
// la date y devient une espace) ; puis avec le service de lieux simulé : le lieu est cherché à l'ouverture dans Planifier
// et après le rangement, « Aller de A à B le JJ/MM », « Boucle à A le JJ/MM » ; un nom saisi ne change pas.
console.log('--- nom composé ---');
const jour = await evaluate(`new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })`);
const jourFichier = jour.replace('/', ' ');
const fiches = async () => JSON.parse(await evaluate(`(async () => {
  let d;
  try { d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('itineraires'); } catch { return '[]'; }
  const out = [];
  for await (const [n, h] of d.entries()) if (n.endsWith('.json')) {
    const r = JSON.parse(await (await h.getFile()).text());
    out.push({ base: n.replace(/\\.json$/, ''), name: r.name, place: r.place ?? null, waypoints: r.waypoints ?? [] });
  }
  return JSON.stringify(out.sort((x, y) => (x.base < y.base ? -1 : 1)));
})()`));
const listeNoms = async () => JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.route-list__open')].map((x) => x.textContent.trim()))`));
const placeholder = () => evaluate(`document.querySelector('.plan-form input')?.placeholder ?? null`);
const messageRangement = () => evaluate(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).find((t) => t.startsWith('Enregistré')) ?? null`);
const repartir = async () => {
  await go('/itineraires', 3000);
  await clickText('Tout effacer');
  await wait(300);
};
const ouvrirNom = async (extrait) => {
  await go('/itineraires/liste', 3000);
  await waitFor(`[...document.querySelectorAll('.route-list__open')].some((x) => x.textContent.includes(${JSON.stringify(extrait)}))`, { timeout: 5000, label: `liste : ${extrait}` });
  await evaluate(`[...document.querySelectorAll('.route-list__open')].find((x) => x.textContent.includes(${JSON.stringify(extrait)})).click()`);
  await waitFor(async () => /^Tracé et balises \((?!0\))\d+\)$/.test((await state()).title ?? ''), { timeout: 5000, label: 'balises rouvertes' });
  await settle({ max: 800 });
};

// 7a. Sans réseau : un aller, puis une boucle, sans nom saisi.
await repartir();
await tapMap(0.2, 0.2);
await tapMap(0.8, 0.7);
const allerNeuf = await state();
check('un aller sans nom : le champ Nom est vide, son grisé est « Aller du JJ/MM »',
  allerNeuf.name === '' && (await placeholder()) === `Aller du ${jour}`, `${allerNeuf.name} | ${await placeholder()}`);
const distanceAller = Number.parseFloat(String(allerNeuf.distance).replace(',', '.'));
check('l\'aller des essais fait plus de 2 km (l\'arrivée compte comme un autre lieu)', distanceAller > 2, String(allerNeuf.distance));
console.log('Enregistrer (aller sans nom) :', await clickText('Enregistrer'));
await settle({ max: 1500 });
const msgAller = await messageRangement();
console.log('message :', msgAller);
check('aller rangé sans nom : le message cite « Aller du JJ MM » (la barre devient une espace)', msgAller?.startsWith(`Enregistré dans itineraires/Aller du ${jourFichier}`) === true, String(msgAller));
const apresAller = await fiches();
check('la fiche garde un nom vide et le fichier s\'appelle « Aller du JJ MM »', apresAller.length === 1 && apresAller[0].name === '' && apresAller[0].base === `Aller du ${jourFichier}`, JSON.stringify(apresAller.map((f) => [f.base, f.name])));
check('le champ Nom reste vide après le rangement', (await state()).name === '', String((await state()).name));
check('la liste « Mes itinéraires » montre « Aller du JJ/MM » (sans lieu, hors ligne)', (await listeNoms()).some((n) => n.includes(`Aller du ${jour}`)), JSON.stringify(await listeNoms()));
console.log('Nouvel itinéraire :', await clickText('Nouvel itinéraire'));
await wait(400);
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
console.log('Boucler :', await clickText('Boucler'));
check('une boucle sans nom : le grisé est « Boucle du JJ/MM »', (await state()).name === '' && (await placeholder()) === `Boucle du ${jour}`, `${(await state()).name} | ${await placeholder()}`);
console.log('Enregistrer (boucle sans nom) :', await clickText('Enregistrer'));
await settle({ max: 1500 });
const apresBoucle = await fiches();
check('boucle rangée sans nom : fichier « Boucle du JJ MM », nom vide', apresBoucle.some((f) => f.base === `Boucle du ${jourFichier}` && f.name === ''), JSON.stringify(apresBoucle.map((f) => [f.base, f.name])));
check('la liste montre « Boucle du JJ/MM » et « Aller du JJ/MM »', (await listeNoms()).some((n) => n.includes(`Boucle du ${jour}`)) && (await listeNoms()).some((n) => n.includes(`Aller du ${jour}`)), JSON.stringify(await listeNoms()));

// 7b. Avec le service de lieux simulé : à l'ouverture dans Planifier, le lieu du départ et celui de l'arrivée sont cherchés.
const lieux = await fakePlaces(b);
const fichesAvant = await fiches();
const aller = fichesAvant.find((f) => f.base === `Aller du ${jourFichier}`);
const seuil = (aller.waypoints[0].lat + aller.waypoints[aller.waypoints.length - 1].lat) / 2;
const lieuDe = (lat) => (lat >= seuil ? 'Port Nord' : 'Port Sud');
lieux.setAnswer((url) => autour(lieuDe(Number(new URL(url).searchParams.get('lat'))))(url));
lieux.reset();
await ouvrirNom(`Aller du ${jour}`);
const departAller = lieuDe(aller.waypoints[0].lat);
const arriveeAller = lieuDe(aller.waypoints[aller.waypoints.length - 1].lat);
await waitFor(async () => (await fiches()).find((f) => f.base === `Aller du ${jourFichier}`)?.place?.arrival != null, { timeout: 8000, every: 200, label: 'lieu de l\'aller rangé' });
console.log('requêtes de lieux (aller) :', lieux.count());
check('les deux lieux sont différents dans l\'essai (départ au nord, arrivée au sud)', departAller !== arriveeAller, `${departAller} / ${arriveeAller}`);
const nomAller = `Aller de ${departAller} à ${arriveeAller} le ${jour}`;
await go('/itineraires/liste', 3000);
await waitFor(`[...document.querySelectorAll('.route-list__open')].some((x) => x.textContent.includes(${JSON.stringify(nomAller)}))`, { timeout: 5000, label: 'nom composé de l\'aller' });
check('l\'aller ouvert dans Planifier : la liste le nomme « Aller de A à B le JJ/MM »', (await listeNoms()).some((n) => n.includes(nomAller)), JSON.stringify(await listeNoms()));
check('le fichier garde son nom du premier rangement, la fiche un nom vide', (await fiches()).some((f) => f.base === `Aller du ${jourFichier}` && f.name === ''), JSON.stringify((await fiches()).map((f) => [f.base, f.name])));
await ouvrirNom(nomAller);
check('l\'aller rouvert : le grisé du champ Nom est le nom composé, le champ reste vide', (await state()).name === '' && (await placeholder()) === nomAller, `${(await state()).name} | ${await placeholder()}`);
// La boucle : un seul lieu, celui du départ.
const boucleFiche = (await fiches()).find((f) => f.base === `Boucle du ${jourFichier}`);
const nomBoucle = `Boucle à ${lieuDe(boucleFiche.waypoints[0].lat)} le ${jour}`;
await ouvrirNom(`Boucle du ${jour}`);
await go('/itineraires/liste', 3000);
await waitFor(`[...document.querySelectorAll('.route-list__open')].some((x) => x.textContent.includes(${JSON.stringify(nomBoucle)}))`, { timeout: 8000, label: 'nom composé de la boucle' });
check('la boucle ouverte dans Planifier : « Boucle à A le JJ/MM », sans arrivée', (await listeNoms()).some((n) => n.includes(nomBoucle)), JSON.stringify(await listeNoms()));
// Un itinéraire neuf, rangé avec le service de lieux : le lieu est cherché après le rangement.
await repartir();
await tapMap(0.25, 0.25);
await tapMap(0.55, 0.3);
await tapMap(0.5, 0.65);
console.log('Boucler :', await clickText('Boucler'));
lieux.reset();
console.log('Enregistrer (boucle, lieux simulés) :', await clickText('Enregistrer'));
await settle({ max: 1500 });
const neuve = (await fiches()).filter((f) => !fichesAvant.some((g) => g.base === f.base));
const nomNeuve = `Boucle à ${neuve[0] ? lieuDe(neuve[0].waypoints[0].lat) : '?'} le ${jour}`;
await waitFor(async () => (await fiches()).some((f) => !fichesAvant.some((g) => g.base === f.base) && f.place), { timeout: 8000, every: 200, label: 'lieu rangé après le rangement' });
check('une boucle neuve sans nom : le lieu est cherché après le rangement, la liste la nomme « Boucle à A le JJ/MM »',
  (await listeNoms()).filter((n) => n.includes(nomNeuve)).length >= 1 && lieux.count() >= 1, `${nomNeuve} | ${JSON.stringify(await listeNoms())} | ${lieux.count()} requête(s)`);
// Un nom saisi prime, même avec le service de lieux.
await repartir();
await tapMap(0.2, 0.25);
await tapMap(0.75, 0.7);
await setName('Sortie nommée');
await clickText('Enregistrer');
await settle({ max: 1500 });
await wait(1500);
const nommee = (await fiches()).find((f) => f.base === 'Sortie nommée');
check('un nom saisi reste : fichier et fiche « Sortie nommée », aucun lieu rangé', nommee?.name === 'Sortie nommée' && nommee.place === null, JSON.stringify(nommee));
check('la liste montre « Sortie nommée », jamais un nom composé pour elle', (await listeNoms()).some((n) => n.includes('Sortie nommée')) && !(await listeNoms()).some((n) => n.includes('Sortie nommée') && /Aller (de|du)/.test(n)), JSON.stringify(await listeNoms()));

console.log('--- confirmations ---');
dialogs.forEach((d) => console.log(d));
check('aucune erreur de console', logs.length === 0, [...new Set(logs)].slice(0, 5).join(' | '));
await finish();
