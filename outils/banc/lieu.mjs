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
//  6. case de Réglages › Mémoire décochée : une seconde session importée n'envoie rien et garde l'activité seule.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { fakePlaces } from './lib/lieux.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { actionLigne, lignes } from './lib/sessions.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node lieu.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// Deux sorties de wingfoil parties de la plage du Petit Travers, à un jour d'écart.
const DEPART = { lat0: 43.5468, lon0: 3.9738 };
const premier = join(workDir, 'lieu-1.gpx');
const second = join(workDir, 'lieu-2.gpx');
writeFileSync(premier, traceVoile({ ...DEPART, debutMs: Date.UTC(2026, 9, 2, 8, 0, 0), bords: 2, secondes: 600 }));
writeFileSync(second, traceVoile({ ...DEPART, debutMs: Date.UTC(2026, 9, 3, 8, 0, 0), bords: 2, secondes: 600 }));

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

console.log('\n== Console :', logs.some((l) => !l.startsWith('warning')) ? logs.filter((l) => !l.startsWith('warning')).join('\n') : 'rien');
await finish('Tout passe.');
