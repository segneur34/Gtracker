// Banc de test : session à classer, activité demandée avant l'analyse.
// Usage : node classer.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique un GPX dont la balise <type> ne dit rien (« other », comme certaines
// applications), l'importe depuis la page Sessions, et vérifie :
//  1. la session est « À classer » (fiche sans calcul ni activité) ;
//  2. l'ouvrir montre la question « Quelle activité ? » au lieu d'ouvrir l'analyse ; Échap la ferme sans rien changer ;
//     « Classer… » du « … » de la ligne pose « Classer la session », Échap la ferme ;
//  3. choisir Surf range l'activité dans la fiche et ouvre l'analyse du surf, pas celle de la voile (une session à classer
//     s'ouvre sur l'analyse de la famille de l'activité choisie).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { actionLigne, ouvrirLigne } from './lib/sessions.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node classer.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// Une sortie de 15 min dont le type, « other », n'est celui d'aucun calcul (le type sans balise est celui de `traceSansType`).
const gpxPath = join(workDir, 'sans-activite.gpx');
writeFileSync(gpxPath, traceVoile({ debutMs: Date.UTC(2026, 9, 2, 8, 0, 0), type: 'other', nom: 'Sortie', bords: 1, secondes: 900, virageMin: 3 }));

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importFiles, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
await blockNetwork();
const readRecord = () => evaluate(`(async () => {
  const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions');
  for await (const [name, h] of dir.entries()) if (name.endsWith('.json')) return JSON.parse(await (await h.getFile()).text());
  return null;
})()`);
const sheet = () => evaluate(`(() => {
  const s = document.querySelector('.activity-select__sheet');
  return s ? s.querySelector('.activity-select__heading')?.innerText.replace(/\\n/g, ' / ') ?? '(liste sans question)' : '(pas de liste)';
})()`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

// 1. Import depuis la page Sessions.
await go('/sessions');
await importFiles(gpxPath, 'input[type=file][accept*=".gpx"][multiple]');
await waitFor(async () => (await readRecord()) !== null, { timeout: 3000, label: 'fiche' });
await settle({ max: 3000, label: 'import' });
const carte = await evaluate(`[...document.querySelectorAll('h2, h3, .ui-card__heading, .lib-row')].some((h) => /À classer/.test(h.textContent))`);
console.log('« À classer » :', carte);
check('la session est « À classer »', carte === true);
const before = await readRecord();
console.log('fiche :', `support ${before?.sport}, activité ${before?.activityId}`);
check('sa fiche n\'a ni calcul ni activité', (before?.sport ?? null) === null && (before?.activityId ?? null) === null, `${before?.sport} ; ${before?.activityId}`);

// 2. L'ouvrir pose la question ; Échap la ferme.
const openRow = () => ouvrirLigne(evaluate, 'À classer');
console.log('ouvrir :', await openRow());
await wait(500);
const question = await sheet();
console.log('question :', question, '| page :', await evaluate('location.pathname'));
check('l\'ouvrir pose la question « Quelle activité ? », on reste sur la page Sessions', /Quelle activité/.test(question) && (await evaluate('location.pathname')) === '/sessions', question);
await shoot('classer-question');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(300);
console.log('Échap :', await sheet(), '| page :', await evaluate('location.pathname'), '| support', (await readRecord())?.sport);
check('Échap ferme la question, rien n\'est changé', (await sheet()) === '(pas de liste)' && (await evaluate('location.pathname')) === '/sessions' && ((await readRecord())?.sport ?? null) === null);

// 2 bis. « Classer… » du « … » de la ligne pose la question « Classer la session » ; Échap la ferme.
console.log('« … » de la ligne, Classer :', await actionLigne(evaluate, wait, 'À classer', 'Classer'));
await wait(500);
const questionMenu = await sheet();
console.log('question :', questionMenu, '| page :', await evaluate('location.pathname'));
check('« Classer… » du menu de la ligne pose la question « Classer la session »', /Classer la session/.test(questionMenu) && (await evaluate('location.pathname')) === '/sessions', questionMenu);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(300);
check('Échap la ferme, rien n\'est changé', (await sheet()) === '(pas de liste)' && ((await readRecord())?.sport ?? null) === null);

// 3. Surf choisi : fiche rangée, analyse du surf ouverte (la session s'ouvre sur la famille de l'activité choisie).
console.log('ouvrir :', await openRow());
await wait(500);
console.log('Surf :', await evaluate(`(() => { const b = [...document.querySelectorAll('.activity-select__option')].find((x) => x.textContent.trim() === 'Surf'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await waitFor(`location.pathname.includes('/analyse')`, { timeout: 3000, label: 'analyse ouverte' });
await settle({ max: 3000, label: 'analyse' });
console.log('page :', await evaluate('location.pathname + location.search'), '| titre :', await evaluate(`document.querySelector('h1')?.textContent ?? ''`));
await waitFor(async () => ((await readRecord())?.sport ?? null) !== null, { timeout: 1500, label: 'fiche classée' });
const after = await readRecord();
console.log('fiche :', `support ${after?.sport}, activité ${after?.activityId}`);
check('Surf choisi : la fiche porte le calcul « surf »', after?.sport === 'surf', `${after?.sport} ; ${after?.activityId}`);
check('l\'analyse du surf s\'ouvre, pas celle de la voile', (await evaluate('location.pathname')) === '/surf/analyse', await evaluate('location.pathname'));

console.log(logs.length ? `console :\n${logs.join('\n')}` : 'console : aucune erreur');
await finish('Tout passe.');
