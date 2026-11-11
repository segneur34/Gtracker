// Banc de test : notification de l'enregistrement (§10, point 101).
// Usage : node notification.mjs <port> <dossier de travail, chemin Windows>
// Sur un profil neuf, sans réseau. Dure environ 1 min 30. L'activité de voile par défaut est « Wingfoil » (famille « Voile »). La version navigateur de `platform/notification.ts`
// consigne chaque envoi en `console.debug` (« [notification] titre | texte [chronomètre] (seule) »). Le script vérifie :
//  1. Réglages : la notification, dans la partie Enregistrement de la carte Wingfoil, deux menus, « défaut » ; la seconde ligne passée à
//     « Max (2 s) », rangée dans les réglages ;
//  2. un rejeu ×10 de voile : titre « Wingfoil », chiffres choisis, chronomètre de durée, et au moins 5 s entre deux
//     envois sans changement d'état ;
//  3. pause manuelle : envoi immédiat, « en pause », durée figée, posé seul ; reprise : envoi immédiat sans « en pause » ;
//  4. arrêt : notification effacée ; l'analyse s'ouvre seule, la session est jetée depuis son menu « … » ;
//  5. la moyenne en voile (lot 150) : « Moyenne active » dans les menus de Réglages, « Moy. act. » dans un rejeu.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect } from './lib/cdp.mjs';
import { analyseOuvertePuisJetee } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node notification.mjs <port> <dossier de travail>');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, wait, waitFor, blockNetwork, importFiles, close, logs, onMessage } = await connect({ port, width: 1400, height: 1000 });
/** Envois de la notification, avec l'instant de réception. */
const sent = [];
onMessage((msg) => {
  if (msg.method !== 'Runtime.consoleAPICalled') return;
  const text = msg.params.args.map((a) => a.value ?? a.description).join(' ');
  if (msg.params.type === 'debug' && text.startsWith('[notification]')) sent.push({ atMs: Date.now(), text: text.slice('[notification] '.length) });
});
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await wait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
const clickText = (text, selector = 'button') => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)} || x.textContent.includes(${JSON.stringify(text)}));
  if (!b) return 'absent'; if (b.disabled) return 'désactivé'; b.click(); return 'ok';
})()`);
const setFile = (selector, file) => importFiles(file, selector);
/** Rejeu d'un GPX à la vitesse donnée, depuis la page Enregistrer, la famille choisie. */
const startReplay = async (family, file, speed) => {
  await go('/enregistrer');
  await clickText(family, '[aria-label=Famille] button');
  await wait(300);
  await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
  await wait(300);
  await setFile('input[type=file][accept*=".gpx"]', file);
  check('rejeu : fichier lu, menu de la vitesse présent', Boolean(await waitFor(`[...document.querySelectorAll('select')].some((x) => [...x.options].some((o) => o.value === '600'))`, { timeout: 8000 })));
  await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(String(speed))}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  const demarre = await clickText('Démarrer');
  check('enregistrement en cours (bouton Arrêter)', Boolean(await waitFor(`[...document.querySelectorAll('button.ui-btn--danger')].some((x) => x.textContent.includes('Arrêter'))`, { timeout: 10000 })));
  return demarre;
};
/** Trace de voile à 1 Hz datée de maintenant (un bord de près et un de portant, environ 630 points), vitesses qui changent pour que les chiffres changent. */
const nowTrace = (path, type) => writeFileSync(path, traceVoile({ debutMs: Date.now(), type, nom: 'Rejeu', bords: 1 }));

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['*://*.openstreetmap.org/*']);

// 1. Réglages : notification, dans la partie Enregistrement de la carte Wingfoil.
await go('/parametres', 4000);
await evaluate(`(() => { const b = [...document.querySelectorAll('[role=button]')].find((el) => el.textContent.trim() === 'Activités'); if (b && !document.querySelector('.settings-activities')) b.click(); return 'ok'; })()`);
await wait(300);
// Familles repliées depuis le lot 2 des demandes du 15/10 : toutes ouvertes.
await evaluate(`document.querySelectorAll('.settings-activities__family-toggle[aria-expanded="false"]').forEach((b) => b.click()); 'ok'`);
await wait(300);
await evaluate(`(() => { const b = [...document.querySelectorAll('.settings-activity__toggle')].find((x) => x.textContent.trim().startsWith('Wingfoil')); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return 'ok'; })()`);
// La carte ouverte monte ses parties : 300 ms ne suffisent pas toujours.
await wait(800);
// Depuis le 19/10, la notification est une sous-partie d'Enregistrement.
console.log('partie Enregistrement :', await clickText('Enregistrement', '.settings-part__toggle'));
await wait(300);
const notifRow = () => evaluate(`(() => {
  const part = [...document.querySelectorAll('.settings-part__sub')].find((p) => p.querySelector('.settings-part__subtitle')?.textContent.trim() === 'Notification');
  if (!part) return null;
  const selects = [...part.querySelectorAll('select')];
  return { menus: selects.length, values: selects.map((s) => s.options[s.selectedIndex]?.textContent ?? ''), text: part.innerText.replace(/\\n+/g, ' / ') };
})()`);
const before = await notifRow();
// Deux chiffres au plus depuis le 15/10 (Android coupe la ligne au-delà) : vitesse et distance par défaut.
check('deux menus, défaut vitesse, distance', before?.menus === 2 && before.values.join(',') === 'Vitesse,Distance' && before.text.includes('défaut'),
  JSON.stringify(before?.values));
const menuChoices = await evaluate(`[...[...document.querySelectorAll('.settings-part__sub')].find((p) => p.querySelector('.settings-part__subtitle')?.textContent.trim() === 'Notification').querySelector('select').options].map((o) => o.textContent)`);
check('Wingfoil : le menu propose « Moyenne active », plus « Moyenne »', menuChoices.includes('Moyenne active') && !menuChoices.includes('Moyenne'), menuChoices.join(', '));
// Depuis le 27/10, « Par défaut » est une entrée du menu « … » de la carte : grisée, non absente, quand rien n'est modifié.
const parDefaut = (card) => `(${card})?.querySelector('.settings-activity__head > .ui-more .ui-more__panel')?.querySelectorAll('button')`;
const parDefautState = (card) => evaluate(`(() => { const b = [...(${parDefaut(card)} ?? [])].find((x) => x.textContent.trim() === 'Par défaut'); return b ? (b.disabled ? 'grisé' : 'actif') : 'absent'; })()`);
const voileCardSel = `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector('.settings-activity__toggle')?.textContent.trim().startsWith('Wingfoil'))`;
check('rien de changé : « Par défaut » grisé dans la carte Wingfoil', (await parDefautState(voileCardSel)) === 'grisé');
await evaluate(`(() => {
  const part = [...document.querySelectorAll('.settings-part__sub')].find((p) => p.querySelector('.settings-part__subtitle')?.textContent.trim() === 'Notification');
  const s = part.querySelectorAll('select')[1];
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'max');
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return s.value;
})()`);
await wait(300);
const after = await notifRow();
const stored = await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${CLES.sportSettings}'))?.notificationFields)`);
check('seconde ligne « Max », rangée, plus « défaut »', after?.values[1]?.startsWith('Max') && !after.text.includes('défaut') && /"max"/.test(stored ?? ''), stored);
// Seuls les chiffres de la notification changés : la carte a son « Défaut », et repliée, « · modifié » (demande du 19/10).
const voileCard = `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector('.settings-activity__toggle')?.textContent.trim().startsWith('Wingfoil'))`;
check('« Par défaut » de la carte Wingfoil actif', (await parDefautState(voileCard)) === 'actif');
await evaluate(`${voileCard}.querySelector('.settings-activity__toggle').click(); 'ok'`);
await wait(300);
const voileSummary = await evaluate(`${voileCard}?.querySelector('.settings-activity__summary')?.textContent ?? ''`);
check('carte repliée : « · modifié »', voileSummary.includes('· modifié'), voileSummary);

// 2. Rejeu ×10 de voile.
const sailPath = join(workDir, 'notification-voile.gpx');
nowTrace(sailPath, 'wingfoil');
const s0 = sent.length;
console.log('Démarrer :', await startReplay('Voile', sailPath, 10));
await wait(16000);
// Le chargement de la page efface une notification restée d'un arrêt brutal : hors du compte.
const run = sent.slice(s0).filter((s) => s.text !== 'effacée');
console.log('envois :', run.map((s) => s.text).slice(0, 4).join('\n        '));
check('titre et chiffres choisis', run.length > 0 && run.every((s) => s.text.startsWith('Wingfoil | Vit. ') && s.text.includes(' · Max ')),
  run[run.length - 1]?.text);
check('chronomètre de durée', run.length > 0 && run.every((s) => s.text.includes('[durée ')));
// Les premiers envois partent tout de suite : départ, récriture à la première position (le service GPS vient de
// poser la sienne), premiers chiffres du direct. Ensuite, le rythme.
const steady = run.filter((s) => / Vit\. \d/.test(s.text));
const gaps = steady.slice(1).map((s, i) => s.atMs - steady[i].atMs);
check('5 s au moins entre deux envois', gaps.length >= 1 && gaps.every((g) => g >= 4900), `${run.length} envois, écarts ${gaps.join(', ')} ms`);

// 3. Pause manuelle, puis reprise.
let mark = sent.length;
console.log('Pause :', await clickText('Pause'));
await wait(800);
const paused = sent.slice(mark);
check('pause : envoi immédiat, « en pause », durée figée, posé seul', paused.length === 1 && /^Wingfoil · en pause 0:\d\d:\d\d \| /.test(paused[0].text)
  && paused[0].text.endsWith('(seule)') && !paused[0].text.includes('[durée'), paused[0]?.text);
await wait(3000);
check('rien pendant la pause', sent.length === mark + 1);
mark = sent.length;
console.log('Reprendre :', await clickText('Reprendre'));
await wait(1500);
const resumed = sent.slice(mark);
check('reprise : envoi immédiat, sans « en pause »', resumed.length >= 1 && resumed[0].text.startsWith('Wingfoil | Vit. ') && !resumed[0].text.includes('(seule)'),
  resumed.map((s) => s.text).join(' // '));

// 4. Arrêt.
mark = sent.length;
console.log('Arrêter :', await holdStop());
await wait(1500);
check('arrêt : notification effacée', sent.slice(mark).some((s) => s.text === 'effacée'), sent.slice(mark).map((s) => s.text).join(' // '));
// L'analyse s'ouvre seule, la session se jette depuis son menu « … ».
{ const fin = await analyseOuvertePuisJetee(evaluate); check('arrêt tenu : analyse ouverte seule, puis session jetée', fin === 'ok', fin); }
await wait(800);

// 5, joué ici : la moyenne active dans un rejeu de voile.
const fieldsWith = (from, to) => evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}'));
  for (const id of Object.keys(s.notificationFields ?? {})) s.notificationFields[id] = s.notificationFields[id].map((f) => (f === ${JSON.stringify(from)} ? ${JSON.stringify(to)} : f));
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s));
  return JSON.stringify(s.notificationFields);
})()`);
console.log('chiffres :', await fieldsWith('max', 'average'));
const sAverage = sent.length;
console.log('Démarrer (voile, moyenne) :', await startReplay('Voile', sailPath, 10));
await wait(9000);
const averages = sent.slice(sAverage).filter((s) => s.text !== 'effacée').map((s) => s.text);
check('voile : « Moy. act. » dans la notification, jamais « Moy. » seul', averages.some((t) => t.includes(' · Moy. act. ')) && !averages.some((t) => /· Moy\. (?!act\.)/.test(t)),
  averages.slice(-3).join(' // '));
console.log('Arrêter :', await holdStop());
await wait(1500);
// L'analyse s'ouvre seule, la session se jette depuis son menu « … ».
{ const fin = await analyseOuvertePuisJetee(evaluate); check('arrêt tenu : analyse ouverte seule, puis session jetée', fin === 'ok', fin); }
await wait(800);

console.log(logs.length ? `console :\n  ${logs.join('\n  ')}` : 'console : rien');
console.log(failures ? `${failures} échec(s)` : 'tout est bon');
await close();
process.exit(failures ? 1 : 0);
