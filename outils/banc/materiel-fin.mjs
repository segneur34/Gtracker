// Banc de test : matériel d'une session qu'on vient d'enregistrer, choisi dans l'onglet « matos et conditions » de son
// analyse (la fin d'un enregistrement ouvre l'analyse : la carte « Session terminée » n'est plus qu'un filet, et la
// rangée « Matériel » qu'elle portait n'est plus atteinte par un enregistrement qui se range seul).
// Usage : node materiel-fin.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf, sans réseau, environ 1 min, 40 s avec `TEMPS=10`. Une liste de matériel de Wingfoil est écrite dans
// les réglages, puis des sessions sont enregistrées en rejeu. Le script vérifie :
//  1. Wingfoil, liste présente : l'analyse s'ouvre seule ; la rangée de matériel est vide d'office ; la pièce choisie
//     reste en brouillon (« Non enregistré : notes »), entre dans la fiche à « Enregistrer la session » et se retrouve
//     après rechargement ;
//  2. Wingfoil de nouveau : rangée vide, rien de repris de la session d'avant ; sans choix, pas de matériel dans la fiche ;
//  3. Wingfoil, liste présente, sessions suivantes : le rappel du matériel (« Voulez-vous ajouter le matériel ? ») s'ouvre à
//     chaque analyse d'une session sans matériel ; « Oui » ouvre l'onglet et ne compte pas ; « Non » puis la croix comptent
//     chacun une fermeture ; après deux, plus rien ; il n'a pas non plus lieu à la réouverture d'une ancienne session ;
//  4. Surf, sans liste : pas de rangée de pièces, et pas de rappel.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect } from './lib/cdp.mjs';
import { attendreAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node materiel-fin.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

const { send, evaluate, go, settle, waitFor, wait, vwait, blockNetwork, importFiles, records, shoot, clickText, check, finish } = await connect({ port, width: 1400, height: 1000, shotDir });
await blockNetwork();
// Rangée « avancé » ouverte d'office : « matos et conditions » reste dans la barre des onglets.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

// « Arrêter » se tient (appui long, 2 s par défaut) : appui, attente, puis relâcher.
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await vwait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
const openTab = (label) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  if (t.getAttribute('aria-pressed') !== 'true') t.click();
  return 'ok';
})()`);

/**
 * Enregistre une session en rejeu jusqu'à l'ouverture de son analyse. `offsetMin` : deux sessions ne partagent pas le
 * même nom de fichier. Rend 'ok', ou ce qui a manqué.
 */
const recordUntilAnalysis = async (family, tag, offsetMin) => {
  const debutMs = (await evaluate('Date.now()')) + offsetMin * 60000;
  const gpx = family === 'Surf'
    ? traceSurf({ debutMs, nom: 'Rejeu', phases: [[10, 1], [10, 5.5, 180], [40, 1]] })
    : traceVoile({ debutMs, nom: 'Rejeu', bords: 1 });
  const path = join(workDir, `materiel-fin-${tag}.gpx`);
  writeFileSync(path, gpx);
  await go('/enregistrer');
  console.log(`[${tag}] famille :`, await clickText(family, '[aria-label=Famille] button'));
  await wait(300);
  await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
  await waitFor(`[...document.querySelectorAll('input[type=file]')].length > 0`, { timeout: 3000 });
  console.log(`[${tag}] fichier :`, await importFiles(path, 'input[type=file][accept*=".gpx"]'));
  await waitFor(`[...document.querySelectorAll('select')].some((x) => [...x.options].some((o) => o.value === '600'))`, { timeout: 8000, label: 'menu de la vitesse' });
  await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '10'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  console.log(`[${tag}] Démarrer :`, await clickText('Démarrer'));
  await vwait(6000);
  console.log(`[${tag}] Arrêter :`, await holdStop());
  const opened = await attendreAnalyse(evaluate);
  await settle({ max: 3000, label: 'analyse' });
  return opened;
};
/** Ouvre l'onglet « matos et conditions » de l'analyse ouverte. */
const openGear = async (tag) => {
  await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'matos et conditions')`, { timeout: 10000, label: 'onglets avancés' });
  console.log(`[${tag}] onglet :`, await openTab('matos et conditions'));
  await settle({ max: 1500, label: 'onglet matos' });
};
const gearButton = () => evaluate(`document.querySelector('[data-testid="gear-picker-g1"]')?.innerText.trim() ?? '(absent)'`);
const bar = () => evaluate(`document.querySelector('.ui-savebar')?.innerText.replace(/\\n/g, ' ') ?? 'pas de barre'`);
const allRecords = async () => (await records()).map((r) => r.record ?? r);
/** Texte de la fenêtre du rappel, `null` si elle n'est pas ouverte. */
const reminder = () => evaluate(`document.querySelector('[role="dialog"]')?.innerText.replace(/\\s+/g, ' ').trim() ?? null`);
/** Attend la fenêtre du rappel ; rend son texte, ou `null` passé le délai (vrai temps). */
const waitReminder = async (timeout) => {
  await waitFor(`Boolean(document.querySelector('[role="dialog"]'))`, { timeout, label: 'fenêtre du rappel' });
  return reminder();
};
/** Fermetures sans ajout comptées pour Wingfoil dans les réglages de l'appareil. */
const closes = () => evaluate(`JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}').gearReminderCloses?.wingfoil ?? 0`);
const REMINDER_TITLE = 'Voulez-vous ajouter le matériel ?';

// Liste de matériel de Wingfoil, écrite dans les réglages.
await go('/');
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}');
  s.gearGroups = { ...s.gearGroups, wingfoil: [{ id: 'g1', name: 'Ailes', items: [{ id: 'i1', name: 'Aile 5 m' }, { id: 'i2', name: 'Aile 6 m' }] }] };
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
  return 'ok';
})()`);

// 1. Wingfoil, liste présente.
check('Wingfoil : la fin de l\'enregistrement ouvre l\'analyse', (await recordUntilAnalysis('Avec vent', 'choix', -30)) === 'ok');
const firstAsk = await waitReminder(8000);
check('Wingfoil : le rappel du matériel s\'ouvre à l\'analyse', firstAsk?.includes(REMINDER_TITLE) === true, firstAsk ?? '(absent)');
check('Wingfoil : le rappel propose Oui et Non', /oui/i.test(firstAsk ?? '') && /non/i.test(firstAsk ?? ''), firstAsk ?? '(absent)');
console.log('[choix] Oui :', await clickText('Oui', '[role="dialog"] button'));
await settle({ max: 1500, label: 'onglet ouvert par Oui' });
const pressedByYes = await evaluate(`[...document.querySelectorAll('.an-carte-col .ui-tab')].find((t) => t.textContent.trim() === 'matos et conditions')?.getAttribute('aria-pressed') ?? 'absent'`);
check('Wingfoil : « Oui » ferme la fenêtre et ouvre l\'onglet du matériel', (await reminder()) === null && pressedByYes === 'true' && (await gearButton()) === 'Aucun', `${pressedByYes}, ${await gearButton()}`);
check('Wingfoil : « Oui » ne compte pas comme une fermeture', (await closes()) === 0, String(await closes()));
await openGear('choix');
const empty = await gearButton();
check('Wingfoil : rangée de matériel, vide d\'office', empty === 'Aucun', empty);
await evaluate(`document.querySelector('[data-testid="gear-picker-g1"]').click(); 'ok'`);
await wait(300);
console.log('[choix] pièce :', await clickText('Aile 5 m', '[data-testid="gear-sheet"] button'));
await settle({ max: 800, label: 'pièce choisie' });
const chosen = await gearButton();
check('Wingfoil : la pièce choisie s\'affiche', chosen === 'Aile 5 m', chosen);
check('Wingfoil : brouillon « Non enregistré : notes »', /Non enregistré/.test(await bar()) && /notes/.test(await bar()), await bar());
await shoot('materiel-fin');
console.log('[choix] clic :', await clickText('Enregistrer la session'));
await waitFor(async () => (await allRecords()).some((r) => r.notes?.gear), { timeout: 4000, label: 'fiche écrite' });
const first = (await allRecords()).find((r) => r.notes?.gear);
check('Wingfoil : le choix est dans la fiche', first?.notes?.gear?.[0]?.itemName === 'Aile 5 m' && first?.notes?.gear?.[0]?.groupName === 'Ailes', JSON.stringify(first?.notes?.gear ?? null));
const url = await evaluate('location.pathname + location.search');
await go(url, 7000);
await openGear('relu');
const shown = await gearButton();
check('Wingfoil : retrouvé après rechargement', shown === 'Aile 5 m', shown);
check('Wingfoil : pas de rappel à la réouverture de la session', (await reminder()) === null, (await reminder()) ?? '');

// 2. Wingfoil de nouveau : rien de repris. Le rappel revient (aucune fermeture comptée), « Non » en compte une.
check('Wingfoil, session suivante : l\'analyse s\'ouvre', (await recordUntilAnalysis('Avec vent', 'vide', -10)) === 'ok');
const secondAsk = await waitReminder(8000);
check('Wingfoil, session suivante : le rappel s\'ouvre de nouveau', secondAsk?.includes(REMINDER_TITLE) === true, secondAsk ?? '(absent)');
console.log('[vide] Non :', await clickText('Non', '[role="dialog"] button'));
await settle({ max: 800, label: 'rappel fermé' });
check('Wingfoil, « Non » : la fenêtre se ferme et une fermeture est comptée', (await reminder()) === null && (await closes()) === 1, `${await reminder()} · ${await closes()}`);
await openGear('vide');
const again = await gearButton();
check('Wingfoil, session suivante : rangée vide, rien de repris', again === 'Aucun', again);
await settle({ max: 800, label: 'rien de choisi' });
const all = await allRecords();
check('Wingfoil, session suivante : pas de matériel dans sa fiche', all.length === 2 && all.filter((r) => r.notes?.gear?.length).length === 1, JSON.stringify(all.map((r) => r.notes?.gear ?? null)));

// 3. Wingfoil, troisième session : la croix compte la deuxième fermeture ; à la quatrième, plus de rappel.
check('Wingfoil, troisième session : l\'analyse s\'ouvre', (await recordUntilAnalysis('Avec vent', 'croix', -70)) === 'ok');
const thirdAsk = await waitReminder(8000);
check('Wingfoil, troisième session : le rappel s\'ouvre encore (une seule fermeture)', thirdAsk?.includes(REMINDER_TITLE) === true, thirdAsk ?? '(absent)');
await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Fermer"]')?.click(); 'ok'`);
await settle({ max: 800, label: 'rappel fermé par la croix' });
check('Wingfoil, la croix : la fenêtre se ferme et une deuxième fermeture est comptée', (await reminder()) === null && (await closes()) === 2, `${await reminder()} · ${await closes()}`);
check('Wingfoil, quatrième session : l\'analyse s\'ouvre', (await recordUntilAnalysis('Avec vent', 'fin', -90)) === 'ok');
await wait(3000);
check('Wingfoil, après deux fermetures : plus de rappel', (await reminder()) === null, (await reminder()) ?? '');

// 4. Surf, sans liste.
check('Surf : l\'analyse s\'ouvre', (await recordUntilAnalysis('Sans vent', 'surf', -110)) === 'ok');
await wait(2000);
check('Surf, sans liste : pas de rappel', (await reminder()) === null, (await reminder()) ?? '');
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => /^mat/.test(t.textContent.trim()))`, { timeout: 10000, label: 'onglets avancés' });
const surfTab = await evaluate(`(() => { const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => /^mat/.test(x.textContent.trim())); if (!t) return 'absent'; if (t.getAttribute('aria-pressed') !== 'true') t.click(); return t.textContent.trim(); })()`);
console.log('[surf] onglet :', surfTab);
await settle({ max: 1500, label: 'onglet matériel' });
const rows = await evaluate(`document.querySelectorAll('[data-testid^="gear-picker-"]').length`);
check("Surf, sans liste : l'onglet est là, sans rangée de pièces", surfTab !== 'absent' && rows === 0, `${surfTab}, ${rows} rangée(s)`);

await finish('Tout passe.');
