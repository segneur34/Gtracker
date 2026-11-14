// Banc du nom d'une session par l'activité et le lieu : le lieu est cherché par la recherche inverse (service de lieux
// simulé, `lib/lieux.mjs` : jamais le vrai) d'après le point de départ, gardé dans la fiche, et compose le nom tant que
// l'utilisateur n'en a pas donné.
// Usage : node lieu.mjs <port> <dossier de travail> [<dossier des captures>]
// Profil Chrome neuf. Contrôles :
//  1. import sans réseau : la ligne porte l'activité seule, la fiche n'a pas de lieu ;
//  2. réponse simulée : à la réouverture de la liste, une seule requête (position arrondie à trois décimales, langue,
//     nombre et rayon, rien d'autre), le lieu dans la fiche, la ligne nommée « Wingfoil · Plage du Petit Travers » ;
//  3. l'analyse porte le même nom, sans nouvelle requête ;
//  4. renommer puis effacer le nom : le nom donné prime, l'effacer rend le nom calculé ;
//  5. changer d'activité (Kite) : le nom suit, le lieu reste, sans requête ;
//  6. case de Réglages › Mémoire décochée : une seconde session importée n'envoie rien et garde l'activité seule ;
//  7. « Lieu » du « … » de la ligne : le lieu corrigé (`utilisateur`) prime, il est appris (clé de l'appareil et
//     `lieux.json` du dossier), et la seconde session, partie du même endroit, le prend (`appris`) sans requête ;
//  8. « Lieu » du « … » de l'en-tête de l'analyse : corriger de nouveau au même endroit remplace le lieu appris (un seul
//     lieu appris, qui retient l'ancien nom), la seconde session, de même nom, suit ;
//  9. recherche rallumée, une troisième session partie du même endroit et finie à près de 3 km : départ appris, une
//     seule requête, pour l'arrivée, et la ligne « Wingfoil · Départ → Arrivée » ;
// 10. loin de là, deux sessions trouvées par la carte sous le même nom, une troisième d'un nom proche (accent
//     différent) à 330 m, une quatrième nommée à la main : corriger le lieu de la première renomme la deuxième
//     (fiche, ligne, analyse) et le lieu de la quatrième (son nom saisi reste), pas la troisième ; tout est gardé après
//     rechargement ; vider le lieu de l'une ne vide pas les autres.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { autour, fakePlaces } from './lib/lieux.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { actionLigne, lignes, ouvrirLigne } from './lib/sessions.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node lieu.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// Trois sorties de wingfoil parties de la plage du Petit Travers, à un jour d'écart : les deux premières de 5 min
// finissent à 1,5 km du départ (sans lieu d'arrivée), la troisième, de 10 min, à près de 3 km (plus de 2 km : ailleurs).
const DEPART = { lat0: 43.5468, lon0: 3.9738 };
const premier = join(workDir, 'lieu-1.gpx');
const second = join(workDir, 'lieu-2.gpx');
const troisieme = join(workDir, 'lieu-3.gpx');
writeFileSync(premier, traceVoile({ ...DEPART, debutMs: Date.UTC(2026, 9, 2, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(second, traceVoile({ ...DEPART, debutMs: Date.UTC(2026, 9, 3, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(troisieme, traceVoile({ ...DEPART, debutMs: Date.UTC(2026, 9, 4, 8, 0, 0), bords: 2, secondes: 600 }));
// Étape 10, loin du premier endroit (17 km) : deux wingfoil au même point, un troisième à 330 m, un kite au même point.
const LOIN = { lat0: 43.70, lon0: 3.85 };
const jumelle1 = join(workDir, 'lieu-4.gpx');
const jumelle2 = join(workDir, 'lieu-5.gpx');
const voisine = join(workDir, 'lieu-6.gpx');
const kiteLoin = join(workDir, 'lieu-7.gpx');
writeFileSync(jumelle1, traceVoile({ ...LOIN, debutMs: Date.UTC(2026, 9, 10, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(jumelle2, traceVoile({ ...LOIN, debutMs: Date.UTC(2026, 9, 11, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(voisine, traceVoile({ ...LOIN, lat0: LOIN.lat0 + 0.003, debutMs: Date.UTC(2026, 9, 12, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(kiteLoin, traceVoile({ ...LOIN, type: 'kite', debutMs: Date.UTC(2026, 9, 13, 8, 0, 0), bords: 2, secondes: 300 }));

const b = await connect({ port, width: 1400, height: 1000, shotDir });
const { send, evaluate, go, settle, waitFor, wait, importFiles, shoot, check, finish, logs } = b;
const lieux = await fakePlaces(b);

/** Fiches de la mémoire, de la plus ancienne à la plus récente : nom, activité, lieu. */
const fiches = async () => JSON.parse(await evaluate(`(async () => {
  let d;
  try { d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions'); } catch { return '[]'; }
  const out = [];
  for await (const [n, h] of d.entries()) if (n.endsWith('.json')) {
    try { const r = JSON.parse(await (await h.getFile()).text()); out.push({ gpx: r.gpx, name: r.name, activityId: r.activityId, place: r.place ?? null }); } catch {}
  }
  return JSON.stringify(out.sort((x, y) => (x.gpx < y.gpx ? -1 : 1)));
})()`));
const rows = async () => (await lignes(evaluate)).join(' || ');
const subtitle = () => evaluate(`document.querySelector('.ui-page-header__subtitle')?.innerText.split('\\n')[0] ?? 'aucun'`);
const listReady = async () => {
  await waitFor(async () => (await lignes(evaluate)).length > 0, { timeout: 4000, label: 'liste' });
  await settle({ max: 1500, label: 'liste' });
};
const typeName = async (value, key) => {
  await evaluate(`(() => { const i = document.querySelector('.lib-row__rename'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
  await wait(200);
  if (key) await evaluate(`document.querySelector('.lib-row__rename').dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })), 'ok'`);
};
/** Choisit une activité dans l'onglet réglages de l'analyse (la liste de l'application). */
const chooseActivity = (text) => evaluate(`(async () => {
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
const step = (title) => console.log(`\n== ${title}`);
const NOM = 'Wingfoil · Plage du Petit Travers';

// Onglets rejoués à chaque analyse (`lib/onglets.mjs`) : l'onglet réglages de la voile, pour changer d'activité.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await go('/sessions');
await evaluate(`localStorage.setItem('${CLES.sections}', JSON.stringify({ 'sailing-onglets': { reglages: true } })), 'ok'`);

step('1. Import sans réseau');
lieux.setMode('panne');
await go('/sessions');
await importFiles([premier]);
await waitFor(async () => (await fiches()).length === 1 && (await lignes(evaluate)).length === 1, { timeout: 4000, label: 'fiche et ligne' });
await wait(1500);
await settle({ max: 2000, label: 'import' });
console.log('lignes :', await rows());
console.log('fiche :', JSON.stringify((await fiches())[0]));
console.log('requêtes :', lieux.count());
check('sans réseau : la ligne porte l\'activité seule', (await rows()).startsWith('Wingfoil / ') && !(await rows()).includes('Plage'), await rows());
check('sans réseau : la fiche n\'a pas de lieu, rien n\'est écrit', (await fiches())[0].place === null, JSON.stringify((await fiches())[0]));

step('2. Réponse simulée, liste rouverte');
lieux.setMode('reponse');
lieux.reset();
await go('/sessions');
await listReady();
await waitFor(async () => (await fiches())[0].place !== null, { timeout: 5000, label: 'lieu écrit' });
await waitFor(async () => (await rows()).includes(NOM), { timeout: 3000, label: 'ligne nommée' });
const place = (await fiches())[0].place;
const asked = lieux.list();
console.log('lignes :', await rows());
console.log('lieu :', JSON.stringify(place));
console.log('requêtes :', asked.join(' ; '));
const params = asked.length > 0 ? [...new URL(asked[0]).searchParams.keys()].sort().join(',') : '';
check('une seule requête', asked.length === 1, asked.length);
check('la requête ne porte que la position arrondie, la langue, le nombre et le rayon',
  params === 'lang,lat,limit,lon,radius' && /lat=43\.\d{3}&lon=3\.\d{3}&/.test(asked[0] ?? ''), asked[0]);
check('le lieu est dans la fiche, trouvé par la carte', place?.name === 'Plage du Petit Travers' && place?.source === 'carte', JSON.stringify(place));
check('la ligne porte « Activité · Lieu »', (await rows()).startsWith(`${NOM} / `), await rows());

step('3. Analyse');
await evaluate(`document.querySelector('.lib-row__main').click(), 'ok'`);
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
console.log('en-tête :', await subtitle());
check('l\'en-tête de l\'analyse porte le nom calculé', (await subtitle()) === NOM, await subtitle());
if (shotDir) await shoot('lieu-analyse');

step('4. Renommer, puis effacer le nom');
await go('/sessions');
await listReady();
console.log('Renommer :', await actionLigne(evaluate, wait, NOM, 'Renommer'));
await typeName('Sortie du soir', 'Enter');
await waitFor(async () => (await fiches())[0].name === 'Sortie du soir', { timeout: 2000, label: 'nom écrit' });
console.log('lignes :', await rows());
check('le nom donné prime', (await rows()).includes('Sortie du soir') && !(await rows()).includes(NOM), await rows());
console.log('Renommer :', await actionLigne(evaluate, wait, 'Wingfoil', 'Renommer'));
await typeName('', 'Enter');
await waitFor(async () => (await fiches())[0].name === null, { timeout: 2000, label: 'nom effacé' });
await settle({ max: 1500, label: 'nom effacé' });
console.log('lignes :', await rows());
check('le nom effacé rend le nom calculé', (await rows()).startsWith(`${NOM} / `), await rows());

step('5. Changer d\'activité');
lieux.reset();
await evaluate(`document.querySelector('.lib-row__main').click(), 'ok'`);
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
console.log('vers Kite :', await chooseActivity('Kite'));
await waitFor(async () => (await fiches())[0].activityId === 'kite', { timeout: 3000, label: 'activité écrite' });
await settle({ max: 3000, label: 'activité' });
console.log('en-tête :', await subtitle());
console.log('fiche :', JSON.stringify((await fiches())[0]));
check('le nom suit l\'activité', (await subtitle()) === 'Kite · Plage du Petit Travers', await subtitle());
check('le lieu reste, sans nouvelle requête', (await fiches())[0].place?.name === 'Plage du Petit Travers' && lieux.count() === 0, lieux.count());

step('6. Case décochée dans Réglages › Mémoire');
await go('/parametres');
await settle({ max: 2000, label: 'réglages' });
const caseLieu = `[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Chercher le lieu des sessions')?.querySelector('input')`;
if (!(await evaluate(`Boolean(${caseLieu})`))) {
  await evaluate(`[...document.querySelectorAll('.ui-panel-title')].find((x) => x.textContent.trim().startsWith('Mémoire'))?.click(), 'ok'`);
  await wait(300);
}
console.log('case cochée d\'office :', await evaluate(`${caseLieu}?.checked ?? 'absente'`));
check('la recherche est active d\'office', (await evaluate(`${caseLieu}?.checked ?? 'absente'`)) === true);
await evaluate(`${caseLieu}.click(), 'ok'`);
await wait(200);
console.log('clé de l\'appareil :', await evaluate(`localStorage.getItem('${CLES.rechercheLieu}')`));
check('décochée, elle est retenue sur l\'appareil', (await evaluate(`localStorage.getItem('${CLES.rechercheLieu}')`)) === 'false');
lieux.reset();
await go('/sessions');
await listReady();
await importFiles([second]);
await waitFor(async () => (await fiches()).length === 2 && (await lignes(evaluate)).length === 2, { timeout: 4000, label: 'seconde fiche' });
await wait(2500);
await settle({ max: 2000, label: 'import' });
console.log('lignes :', await rows());
console.log('fiche :', JSON.stringify((await fiches())[1]));
check('aucune requête, case décochée', lieux.count() === 0, lieux.count());
check('la seconde session garde l\'activité seule, sans lieu', (await fiches())[1].place === null && (await rows()).startsWith('Wingfoil / '), await rows());

/** Lieux appris de l'appareil (clé `lieuxAppris`), `[]` sans clé. */
const appris = async () => JSON.parse((await evaluate(`localStorage.getItem('${CLES.lieuxAppris}')`)) ?? '[]');
/** Lieux de `lieux.json` à la racine du dossier mémoire, `null` sans fichier. */
const fichierLieux = async () => JSON.parse(await evaluate(`(async () => {
  try {
    const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
    return JSON.stringify(JSON.parse(await (await (await d.getFileHandle('lieux.json')).getFile()).text()).places);
  } catch { return 'null'; }
})()`));
/** Saisit `value` dans le champ `selector`, puis la touche `key`. */
const typeIn = async (selector, value, key) => {
  await evaluate(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
  await wait(200);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })), 'ok'`);
};

step('7. « Lieu » depuis la liste, puis la seconde session au même départ');
lieux.reset();
await go('/sessions');
await listReady();
console.log('Lieu :', await actionLigne(evaluate, wait, 'Kite', 'Lieu'));
console.log('champ :', await evaluate(`document.querySelector('.lib-row__place')?.value ?? 'absent'`));
check('le champ du lieu part du lieu de la fiche', (await evaluate(`document.querySelector('.lib-row__place')?.value ?? 'absent'`)) === 'Plage du Petit Travers');
await typeIn('.lib-row__place', 'Les Roquilles', 'Enter');
await waitFor(async () => (await fiches())[0].place?.name === 'Les Roquilles', { timeout: 2000, label: 'lieu corrigé' });
await waitFor(async () => (await fiches())[1].place !== null, { timeout: 4000, label: 'lieu appris pris' });
await settle({ max: 1500, label: 'lieu' });
console.log('lignes :', await rows());
console.log('fiches :', JSON.stringify((await fiches()).map((f) => f.place)));
console.log('appris :', JSON.stringify(await appris()));
console.log('lieux.json :', JSON.stringify(await fichierLieux()));
check('le lieu corrigé est celui de l\'utilisateur, le nom suit', (await fiches())[0].place?.source === 'utilisateur'
  && (await rows()).includes('Kite · Les Roquilles'), await rows());
check('il est appris sur l\'appareil et dans lieux.json', (await appris()).length === 1 && (await appris())[0].name === 'Les Roquilles'
  && (await fichierLieux())?.[0]?.name === 'Les Roquilles', JSON.stringify(await fichierLieux()));
check('le lieu appris retient l\'ancien nom, sur l\'appareil et dans lieux.json', (await appris())[0].replaces?.includes('Plage du Petit Travers')
  && (await fichierLieux())?.[0]?.replaces?.includes('Plage du Petit Travers'), JSON.stringify(await appris()));
check('la seconde session prend le lieu appris, sans requête (recherche coupée)', (await fiches())[1].place?.source === 'appris'
  && (await rows()).includes('Wingfoil · Les Roquilles') && lieux.count() === 0, `${await rows()} ; ${lieux.count()} requête(s)`);

step('8. « Lieu » depuis l\'analyse : corriger de nouveau au même endroit');
await ouvrirLigne(evaluate, 'Kite');
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
console.log('« … » :', await evaluate(`(() => { const m = document.querySelector('button[aria-label="Plus d\\'actions sur la session"]'); if (!m) return 'absent'; m.click(); return 'ok'; })()`));
await wait(150);
console.log('Lieu :', await evaluate(`(() => { const b = [...document.querySelectorAll('.ui-more__panel button')].find((x) => x.textContent.trim() === 'Lieu'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(150);
const champ = 'input[aria-label="Lieu de la session"]';
check('le champ du lieu s\'ouvre dans l\'en-tête', (await evaluate(`document.querySelector('${champ}')?.value ?? 'absent'`)) === 'Les Roquilles');
await typeIn(champ, 'Plage des Roquilles', 'Enter');
await waitFor(async () => (await fiches())[0].place?.name === 'Plage des Roquilles', { timeout: 2000, label: 'lieu corrigé' });
await settle({ max: 1500, label: 'lieu' });
console.log('en-tête :', await subtitle());
console.log('appris :', JSON.stringify(await appris()));
console.log('lieux.json :', JSON.stringify(await fichierLieux()));
check('l\'en-tête porte le lieu corrigé', (await subtitle()) === 'Kite · Plage des Roquilles', await subtitle());
check('le lieu appris est remplacé, sans doublon', (await appris()).length === 1 && (await appris())[0].name === 'Plage des Roquilles'
  && (await fichierLieux())?.length === 1 && (await fichierLieux())[0].name === 'Plage des Roquilles', JSON.stringify(await appris()));
const remplaces8 = (await appris())[0]?.replaces ?? [];
check('le lieu appris retient les deux anciens noms', ['Les Roquilles', 'Plage du Petit Travers'].every((n) => remplaces8.includes(n))
  && (await fichierLieux())?.[0]?.replaces?.length === 2, JSON.stringify(await appris()));
check('la seconde session, de même nom, suit : lieu appris, sans requête', (await fiches())[1].place?.name === 'Plage des Roquilles'
  && (await fiches())[1].place?.source === 'appris' && lieux.count() === 0, JSON.stringify((await fiches())[1].place));

step('9. Arrivée loin du départ : « Départ → Arrivée »');
await evaluate(`localStorage.setItem('${CLES.rechercheLieu}', 'true'), 'ok'`);
lieux.setAnswer(autour('Plage du Grand Travers'));
lieux.reset();
await go('/sessions');
await listReady();
await importFiles([troisieme]);
await waitFor(async () => (await fiches()).length === 3 && (await fiches())[2].place?.arrival, { timeout: 6000, label: 'arrivée écrite' });
await settle({ max: 2000, label: 'import' });
const asked3 = lieux.list();
console.log('lignes :', await rows());
console.log('lieu :', JSON.stringify((await fiches())[2].place));
console.log('requêtes :', asked3.join(' ; '));
const latArrivee = asked3.length === 1 ? Number(new URL(asked3[0]).searchParams.get('lat')) : NaN;
check('départ appris, une seule requête, pour l\'arrivée', asked3.length === 1 && latArrivee > 43.565, asked3.join(' ; '));
check('la fiche porte le départ appris et l\'arrivée trouvée', (await fiches())[2].place?.source === 'appris'
  && (await fiches())[2].place?.arrival?.name === 'Plage du Grand Travers', JSON.stringify((await fiches())[2].place));
check('la ligne porte « Activité · Départ → Arrivée »', (await rows()).includes('Wingfoil · Plage des Roquilles → Plage du Grand Travers'), await rows());
check('les deux premières finissent près du départ : sans arrivée', (await fiches())[0].place?.arrival === null && (await fiches())[1].place?.arrival === null,
  JSON.stringify((await fiches()).map((f) => f.place?.arrival)));

step('10. Un lieu corrigé renomme les sessions voisines du même nom');
const connues10 = new Set((await fiches()).map((f) => f.gpx));
const neuves = async () => (await fiches()).filter((f) => !connues10.has(f.gpx));
/** Importe `fichier` dont la carte (simulée) rend `nom`, et attend que la fiche neuve le porte (`attendues` : fiches neuves en tout). */
const importerTrouve = async (fichier, nom, attendues) => {
  lieux.setAnswer(autour(nom));
  lieux.reset();
  await importFiles([fichier]);
  await waitFor(async () => { const n = await neuves(); return n.length === attendues && n.filter((f) => f.place?.name).length === attendues; }, { timeout: 8000, label: `lieu trouvé : ${nom}` });
  await settle({ max: 2000, label: 'import' });
};
await go('/sessions');
await listReady();
await importerTrouve(jumelle1, 'Plage de Test', 1);
await importerTrouve(jumelle2, 'Plage de Test', 2);
await importerTrouve(voisine, 'Plage de Tést', 3);
await importerTrouve(kiteLoin, 'Plage de Test', 4);
console.log('Renommer :', await actionLigne(evaluate, wait, 'Kite · Plage de Test', 'Renommer'));
await typeName('Ma sortie', 'Enter');
await waitFor(async () => (await neuves()).some((f) => f.name === 'Ma sortie'), { timeout: 2000, label: 'nom saisi écrit' });
await settle({ max: 1500, label: 'nom saisi' });
const resume = async () => (await neuves()).map((f) => `${f.activityId}:${f.name ?? '-'}:${f.place?.name ?? '-'}:${f.place?.source ?? '-'}`).join(' | ');
console.log('avant correction :', await resume());
console.log('lignes :', await rows());
check('quatre sessions neuves, trouvées par la carte', (await neuves()).length === 4 && (await neuves()).every((f) => f.place?.source === 'carte'), await resume());
check('deux wingfoil sous « Plage de Test », une voisine « Plage de Tést », un kite nommé à la main',
  (await neuves()).filter((f) => !f.name && f.place?.name === 'Plage de Test').length === 2
  && (await neuves()).filter((f) => f.place?.name === 'Plage de Tést').length === 1
  && (await neuves()).filter((f) => f.name === 'Ma sortie' && f.place?.name === 'Plage de Test').length === 1, await resume());

lieux.reset();
console.log('Lieu :', await actionLigne(evaluate, wait, 'Wingfoil · Plage de Test', 'Lieu'));
await typeIn('.lib-row__place', 'Plage Corrigée', 'Enter');
await waitFor(async () => (await neuves()).filter((f) => f.place?.name === 'Plage Corrigée').length === 3, { timeout: 4000, label: 'voisines renommées' });
await settle({ max: 1500, label: 'lieu' });
console.log('après correction :', await resume());
console.log('lignes :', await rows());
const wing = async () => (await neuves()).filter((f) => !f.name && f.place?.name === 'Plage Corrigée');
check('la corrigée est « utilisateur », sa jumelle suit en « appris »',
  (await wing()).length === 2 && (await wing()).map((f) => f.place?.source).sort().join(',') === 'appris,utilisateur', await resume());
check('la voisine d\'un autre nom (accent) ne bouge pas', (await neuves()).filter((f) => f.place?.name === 'Plage de Tést' && f.place?.source === 'carte').length === 1, await resume());
check('le kite nommé à la main : lieu changé, nom saisi gardé',
  (await neuves()).some((f) => f.name === 'Ma sortie' && f.place?.name === 'Plage Corrigée'), await resume());
check('les lignes : deux « Wingfoil · Plage Corrigée », une « Wingfoil · Plage de Tést », « Ma sortie » nommée, plus aucune « Plage de Test »',
  (await lignes(evaluate)).filter((l) => l.startsWith('Wingfoil · Plage Corrigée / ')).length === 2
  && (await lignes(evaluate)).filter((l) => l.startsWith('Wingfoil · Plage de Tést / ')).length === 1
  && (await rows()).includes('Ma sortie') && !(await rows()).includes('Plage de Test'), await rows());
check('aucune requête pour renommer', lieux.count() === 0, lieux.count());
const appris10 = (await appris()).find((p) => p.name === 'Plage Corrigée');
check('le lieu corrigé est appris et retient l\'ancien nom', appris10?.replaces?.includes('Plage de Test') === true, JSON.stringify(await appris()));

// Une des deux jumelles : son analyse porte le nouveau nom.
console.log('Ouvrir :', await ouvrirLigne(evaluate, 'Wingfoil · Plage Corrigée'));
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
console.log('en-tête :', await subtitle());
check('l\'analyse d\'une des deux porte le nouveau nom', (await subtitle()) === 'Wingfoil · Plage Corrigée', await subtitle());

// Rechargement : tout est gardé, sans requête.
lieux.reset();
await go('/sessions');
await listReady();
await settle({ max: 2000, label: 'rechargement' });
console.log('après rechargement :', await resume());
check('après rechargement, fiches et lignes gardées, sans requête', (await neuves()).filter((f) => f.place?.name === 'Plage Corrigée').length === 3
  && (await neuves()).filter((f) => f.place?.name === 'Plage de Tést').length === 1
  && (await lignes(evaluate)).filter((l) => l.startsWith('Wingfoil · Plage Corrigée / ')).length === 2 && lieux.count() === 0, `${await resume()} ; ${lieux.count()} requête(s)`);
check('le nom saisi est gardé après rechargement', (await rows()).includes('Ma sortie')
  && (await neuves()).some((f) => f.name === 'Ma sortie'), await rows());

// Vider un lieu ne vide pas les autres.
console.log('Lieu :', await actionLigne(evaluate, wait, 'Wingfoil · Plage Corrigée', 'Lieu'));
await typeIn('.lib-row__place', '', 'Enter');
await waitFor(async () => (await neuves()).filter((f) => f.place?.name === 'Plage Corrigée').length < 3, { timeout: 3000, label: 'lieu vidé' });
await settle({ max: 1500, label: 'lieu vidé' });
console.log('après lieu vidé :', await resume());
check('un lieu vidé ne vide pas les autres : une seule session de moins sous « Plage Corrigée »',
  (await neuves()).filter((f) => f.place?.name === 'Plage Corrigée').length === 2
  && (await neuves()).filter((f) => f.place?.name === 'Plage de Tést').length === 1
  && (await neuves()).filter((f) => !f.place?.name).length === 1, await resume());

console.log('\n== Console :', logs.some((l) => !l.startsWith('warning')) ? logs.filter((l) => !l.startsWith('warning')).join('\n') : 'rien');
await finish('Tout passe.');
