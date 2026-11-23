// Banc du renommage d'une session : nom saisi depuis le « … » d'une ligne de la page Sessions, écrit dans la
// fiche, relu après rechargement, affiché en tête de l'analyse, effacé par un nom vide, puis donné depuis l'en-tête de
// l'analyse et relu dans la liste. Sans nom donné, ligne et en-tête portent le nom calculé (l'activité seule : le
// service de lieux est bloqué au banc, `lieu.mjs` le simule). Profil Chrome neuf.
// Usage : node rename.mjs <port> <gpx de voile, produit par make-gpx.mjs>
import { connect, DOSSIER_MEMOIRE, pourMemoire } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { actionLigne, lignes } from './lib/sessions.mjs';

const [port, gpx] = process.argv.slice(2);

// --- Protocole (lib/cdp.mjs) ---
const lib = await connect({ port });
const { send, settle, waitFor, wait, importFiles, logs, check, finish } = lib;
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression: pourMemoire(expression), returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) return `ERREUR: ${res.result.exceptionDetails.exception?.description?.split('\n')[0]}`;
  return res.result?.result?.value;
};
const go = (path, ms = 2500) => lib.go(path, ms);
const clickText = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const rows = async () => JSON.stringify(await lignes(evaluate));
/** Renommer depuis le « … » de la ligne (la seule : la trace du banc n'a pas de type, elle est « À classer »). */
const renameRow = () => actionLigne(evaluate, wait, '', 'Renommer');
const record = () => evaluate(`(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions'); for await (const [n, h] of d.entries()) if (n.endsWith('.json')) { const r = JSON.parse(await (await h.getFile()).text()); return JSON.stringify({ name: r.name, title: r.title, gpx: r.gpx }); } return 'aucune fiche'; })()`);
const files = () => evaluate(`(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions'); const out = []; for await (const [n] of d.entries()) out.push(n); return out.sort().join(', '); })()`);
const typeName = async (value, key) => {
  await evaluate(`(() => { const i = document.querySelector('.lib-row__rename'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
  await wait(200);
  if (key) await evaluate(`document.querySelector('.lib-row__rename').dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })), 'ok'`);
};
/** La bibliothèque est lue depuis la mémoire (OPFS) après le chargement : on attend sa première ligne. */
const listReady = async () => { await waitFor(async () => (await rows()) !== '[]', { timeout: 4000, label: 'liste' }); await settle({ max: 1000, label: 'liste' }); };
const step = (title) => console.log(`\n== ${title}`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

step('1. Import du GPX depuis la page Sessions');
await go('/sessions');
await importFiles([gpx]);
await waitFor(async () => (await record()) !== 'aucune fiche' && (await rows()) !== '[]', { timeout: 4000, label: 'fiche et ligne' });
await settle({ max: 4000, label: 'import' });
console.log('lignes :', await rows());
console.log('fiche :', await record());
check('import : une ligne et sa fiche', (await lignes(evaluate)).length === 1 && (await record()) !== 'aucune fiche', await rows());

step('2. Renommer, Annuler (Échap) : rien ne change');
console.log('« … » de la ligne, Renommer :', await renameRow());
await typeName('Brouillon abandonné', 'Escape');
console.log('lignes :', await rows());
check('Échap : le nom saisi n\'est ni dans la ligne ni dans la fiche', !(await rows()).includes('Brouillon') && !(await record()).includes('Brouillon'), await rows());

step('3. Renommer, Entrée');
await renameRow();
await typeName('  Sortie du soir  ', 'Enter');
await waitFor(async () => (await record()).includes('Sortie du soir'), { timeout: 1500, label: 'fiche renommée' });
await settle({ max: 1500, label: 'renommage' });
console.log('lignes :', await rows());
console.log('fiche :', await record());
console.log('fichiers :', await files());
check('Entrée : le nom (rogné) est dans la ligne et dans la fiche', (await rows()).includes('Sortie du soir') && JSON.parse(await record()).name === 'Sortie du soir', await record());

step('4. Rechargement');
await go('/sessions');
await listReady();
console.log('lignes :', await rows());
check('rechargement : la ligne garde son nom', (await rows()).includes('Sortie du soir'), await rows());

step('5. Analyse : sous-titre de l\'en-tête');
// La trace du banc n'a pas de type : ouvrir sa ligne demande d'abord l'activité (la liste de l'application).
await evaluate(`document.querySelector('.lib-row__main').click(), 'ok'`);
await waitFor(`Boolean(document.querySelector('.activity-select__sheet'))`, { timeout: 3000, label: 'question' });
console.log('Wingfoil :', await evaluate(`(() => { const o = [...document.querySelectorAll('.activity-select__option')].find((x) => x.textContent.trim() === 'Wingfoil'); if (!o) return 'absent'; o.click(); return 'ok'; })()`));
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
console.log('h1 :', await evaluate(`document.querySelector('h1')?.textContent`), '| sous-titre :', await evaluate(`document.querySelector('.ui-page-header__subtitle')?.textContent ?? 'aucun'`));
check('l\'en-tête de l\'analyse porte le nom', String(await evaluate(`document.querySelector('h1')?.textContent + ' ' + (document.querySelector('.ui-page-header__subtitle')?.textContent ?? '')`)).includes('Sortie du soir'));

step('6. Nom vide, bouton Valider : plus de nom');
await go('/sessions');
await listReady();
await renameRow();
await typeName('   ');
console.log('Valider :', await clickText('Valider'));
await waitFor(async () => JSON.parse(await record()).name === null, { timeout: 1500, label: 'nom effacé' });
await settle({ max: 1500, label: 'renommage' });
console.log('lignes :', await rows());
console.log('fiche :', await record());
check('nom vide : la fiche n\'a plus de nom, la ligne non plus', JSON.parse(await record()).name === null && !(await rows()).includes('Sortie du soir'), await rows());
// Sans nom donné ni lieu (service de lieux bloqué au banc), le nom montré est l'activité seule.
check('nom vide : la ligne porte le nom calculé, l\'activité', (await rows()).startsWith('["Wingfoil / '), await rows());

step('7. Renommer depuis l\'en-tête de l\'analyse');
await evaluate(`document.querySelector('.lib-row__main').click(), 'ok'`);
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 6000, label: 'analyse ouverte' });
await settle({ max: 6000, label: 'analyse' });
const subtitle = () => evaluate(`document.querySelector('.ui-page-header__subtitle')?.innerText.split('\\n').join(' / ')`);
console.log('en-tête avant :', await subtitle());
check('en-tête sans nom donné : le nom calculé, plus « Sans nom »', String(await subtitle()).startsWith('Wingfoil') && !String(await subtitle()).includes('Sans nom'), await subtitle());
console.log('Renommer :', await clickText('Renommer'));
await wait(300);
await evaluate(`(() => { const i = document.querySelector('input[aria-label="Nom de la session"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Bord au Grand Travers'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'ok'; })()`);
await wait(1500);
console.log('en-tête après :', await subtitle());
console.log('fiche :', await record());
check('en-tête : le nom donné est dans l\'en-tête et la fiche', String(await subtitle()).includes('Bord au Grand Travers') && JSON.parse(await record()).name === 'Bord au Grand Travers', await record());
await go('/sessions');
await listReady();
console.log('lignes :', await rows());
check('la liste relit le nom donné depuis l\'analyse', (await rows()).includes('Bord au Grand Travers'), await rows());

console.log('\n== Console :', logs.some((l) => !l.startsWith('warning')) ? logs.filter((l) => !l.startsWith('warning')).join('\n') : 'rien');
await finish('Tout passe.');
