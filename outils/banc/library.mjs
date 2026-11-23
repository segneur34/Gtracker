// Banc de la bibliothèque : mémoire du navigateur (OPFS),
// enregistrement rangé, notes dans la fiche, import, doublon, à classer, suppression, relance, fichier de réglages de
// l'appareil, puis (ancien `library2`) paire GPX + fiche réimportée et fichier de réglages d'un autre appareil.
// Profil Chrome neuf : OPFS vide au départ.
// Usage : node library.mjs <port> <dossier de travail> [<dossier des captures>]
// Le script fabrique lui-même ses trois traces dans le dossier de travail (`lib/traces.mjs`) : `voile.gpx` (wingfoil),
// `surf.gpx` (surf) et `sans-type.gpx` (voile sans `<type>`, à classer), et les donne à la page par le champ de fichier
// (chemins du disque, comme un fichier choisi dans la fenêtre du système).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { attendreAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { actionLigne, choisirActivite, ligneExiste, lignes, ouvrirLigne, ronds } from './lib/sessions.mjs';
import { traceSansType, traceSurf, traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node library.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}
const win = (name) => join(workDir, name);
const DEBUT_VOILE = Date.UTC(2026, 8, 20, 13, 0, 0);
writeFileSync(win('voile.gpx'), traceVoile({ debutMs: DEBUT_VOILE, nom: 'Banc voile', virageMin: 3 }));
writeFileSync(win('surf.gpx'), traceSurf({ debutMs: Date.UTC(2026, 8, 21, 7, 0, 0), nom: 'Banc surf',
  phases: [[60, 1.2], [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1]] }));
writeFileSync(win('sans-type.gpx'), traceSansType({ debutMs: Date.UTC(2026, 8, 19, 9, 0, 0), nom: 'Banc sans type', bords: 2, virageMin: 3 }));

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, importFiles, records, shoot, check, finish, logs } = await connect({ port, shotDir });
await blockNetwork();
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
// « Arrêter » se tient (appui long réglable, 2 s par défaut) : appui, attente, puis relâcher.
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled && !x.closest('.ivl')); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await wait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
const clickText = (text, selector = 'button') => evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const setFiles = (selector, paths) => importFiles(paths, selector);
const lines = (re) => evaluate(`document.body.innerText.split('\\n').filter((l) => ${re}.test(l)).join(' | ')`);
const rowsNow = () => lignes(evaluate);
const rows = async () => JSON.stringify(await rowsNow());
const opfsTree = () => evaluate(`(async () => { const t = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}'); const out = {}; const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else out[p + n] = (await h.getFile()).size; } }; await walk(t, ''); return JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))); })()`);
const readOpfs = (path) => evaluate(`(async () => { let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}'); const parts = ${JSON.stringify(path)}.split('/'); const name = parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p); return await (await (await d.getFileHandle(name)).getFile()).text(); })()`);
const writeOpfs = (path, text) => evaluate(`(async () => { let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}'); const parts = ${JSON.stringify(path)}.split('/'); const name = parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p); const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(${JSON.stringify(text)}); await w.close(); return 'ok'; })()`);
const shot = async (name, width, height, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await settle({ max: 800 });
  await shoot(name);
  await send('Emulation.clearDeviceMetricsOverride');
};
const step = (title) => console.log(`\n== ${title}`);
const openTab = (label) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  if (t.getAttribute('aria-pressed') !== 'true') t.click();
  return 'ok';
})()`);
const typeInto = (selector, value) => evaluate(`(() => {
  const el = ${selector};
  if (!el) return 'absent';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

step('1. Page Sessions vide');
await go('/sessions');
console.log(await lines(/session|mémoire|Aucune/));
check('page Sessions vide : « Aucune session pour l\'instant »', /Aucune session pour l'instant/.test(await evaluate('document.body.innerText')), await lines(/Aucune/));
await go('/sessions?activite=wingfoil');
check('filtrée sur Wingfoil, vide : « Aucune session de wingfoil »', /Aucune session de wingfoil pour l'instant/.test(await evaluate('document.body.innerText')), await lines(/Aucune/));
await shot('sessions-vide-mobile', 390, 844, true);

step('2. Rejeu ×600, Arrêter, analyse ouverte seule');
await go('/enregistrer');
console.log('famille Voile :', await clickText('Avec vent', '[aria-label=Famille] button'));
await wait(300);
await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
await wait(300);
console.log('fichier rejeu :', await setFiles('input[type=file]', [win('voile.gpx')]));
await waitFor(`/\\d+ points/.test(document.body.innerText)`, { timeout: 5000, label: 'rejeu chargé' });
await evaluate(`(() => { const s = [...document.querySelectorAll('select')].pop(); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, '600'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
console.log('Démarrer :', await clickText('Démarrer'));
await wait(9000);
console.log('Arrêter :', await holdStop());
// La session est rangée en mémoire (OPFS) : ni DOM ni réseau, d'où l'attente de la fiche avant `settle`.
await waitFor(async () => (await records())?.length >= 1, { timeout: 6000, label: 'fiche rangée' });
await settle({ max: 3000 });
check('arrêt tenu : analyse ouverte seule', (await attendreAnalyse(evaluate)) === 'ok', await evaluate('location.pathname + location.search'));
await settle({ max: 6000 });
console.log('url :', await evaluate('location.pathname + location.search'));
console.log('h1 :', await evaluate(`document.querySelector('h1')?.textContent`), '| segments :', await evaluate(`document.querySelectorAll('path.leaflet-interactive').length`));
const tree1 = JSON.parse(await opfsTree());
console.log('dossier :', JSON.stringify(tree1));
const fiche1 = (await records())[0];
check('une fiche de wingfoil rangée, ses manœuvres comptées', (await records()).length === 1 && fiche1.sport === 'wingfoil' && fiche1.summary.maneuverCount > 0,
  `${(await records()).length} fiche(s) ; ${fiche1?.sport} ; ${fiche1?.summary?.maneuverCount} manœuvres`);
check('la trace est dans sessions/ avec sa fiche', Object.keys(tree1).some((k) => k.startsWith('sessions/') && k.endsWith('.gpx')) && Object.keys(tree1).some((k) => k.startsWith('sessions/') && k.endsWith('.json')));

step('3. Notes : saisie, enregistrer la session, rechargement');
console.log('onglet matos :', await openTab('matos et conditions'));
await settle({ max: 800, label: 'onglet matos' });
console.log('foil :', await typeInto(`document.querySelector('input[placeholder^="ex. 1100"]')`, 'Axis 900 banc'));
await settle({ max: 800, label: 'foil saisi' });
console.log('enregistrer :', await clickText('Enregistrer la session'));
await waitFor(async () => (await records())?.[0]?.notes?.foil === 'Axis 900 banc', { timeout: 4000, label: 'fiche écrite' });
await settle({ max: 2000, label: 'enregistrement' });
check('le foil est dans la fiche', (await records())[0]?.notes?.foil === 'Axis 900 banc', JSON.stringify((await records())[0]?.notes));
await go(await evaluate('location.pathname + location.search'), 6000); // rechargement
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'matos et conditions')`, { timeout: 30000, every: 200, label: 'onglets' });
await openTab('matos et conditions');
await settle({ max: 800, label: 'onglet matos' });
const foilRelu = await evaluate(`document.querySelector('input[placeholder^="ex. 1100"]')?.value`);
console.log('foil après rechargement :', foilRelu);
check('le foil revient après rechargement', foilRelu === 'Axis 900 banc', String(foilRelu));
const fiche = Object.keys(JSON.parse(await opfsTree())).find((k) => k.startsWith('sessions/') && k.endsWith('.json'));
const record = JSON.parse(await readOpfs(fiche));
console.log('fiche :', fiche, '| sport', record.sport, '| source', record.source, '| manœuvres', record.summary.maneuverCount, '| notes.foil', record.notes?.foil, '| distance', Math.round(record.summary.distanceM), 'm');

step('4. Import : doublon, surf typé, trace sans type');
await go('/sessions');
console.log('import :', await setFiles('input[type=file][accept*=".gpx"][multiple]', [win('voile.gpx'), win('surf.gpx'), win('sans-type.gpx')]));
await waitFor(`/ajoutée|déjà|illisible/.test(document.body.innerText)`, { timeout: 8000, label: 'messages d import' });
await settle({ max: 1500 });
const messages = await lines(/ajoutée|déjà|illisible/);
console.log(messages);
const toutesRows = await rowsNow();
console.log('lignes :', JSON.stringify(toutesRows));
check('messages : deux sessions ajoutées sur trois, la rejouée déjà en mémoire', /déjà/.test(messages) && /ajoutée/.test(messages), messages);
check('une seule liste : la rejouée (Wingfoil), la session de surf et la trace à classer, trois lignes', toutesRows.length === 3 && toutesRows.some((r) => r.startsWith('Wingfoil')) && toutesRows.some((r) => r.startsWith('Surf')) && toutesRows.some((r) => r.startsWith('À classer')), JSON.stringify(toutesRows));
check('la fiche de la trace sans type n\'a pas de calcul', (await records()).some((r) => r.sport === null || r.sport === undefined || r.unclassified === true));
console.log('rangée :', await ronds(evaluate));
check('la rangée des activités : « Toutes » enfoncé, Wingfoil et Surf présents', /^Toutes\*,.*Wingfoil/.test(await ronds(evaluate)) && /Surf/.test(await ronds(evaluate)), await ronds(evaluate));
// Un appui sur le rond Surf ne garde que cette activité (la carte « À classer » reste, proposée quelle que soit l'activité) ; le filtre est dans l'adresse.
console.log('rond Surf :', await choisirActivite(evaluate, 'Surf'));
await settle({ max: 1500 });
const surfRows = await rowsNow();
console.log('lignes de Surf :', JSON.stringify(surfRows), '|', await evaluate('location.search'));
check('filtre Surf : la session de surf et la trace à classer, sans Wingfoil ; ?activite=surf dans l\'adresse', surfRows.length === 2 && surfRows.some((r) => r.startsWith('Surf')) && surfRows.some((r) => r.startsWith('À classer')) && (await evaluate('location.search')) === '?activite=surf', JSON.stringify(surfRows));
check('la ligne de totaux dit « session de surf »', /1 session de surf/.test(await evaluate('document.body.innerText')), await lines(/session de surf/));
console.log('rond Toutes :', await choisirActivite(evaluate, 'Toutes'));
await settle({ max: 1500 });
check('« Toutes » rend les trois lignes et vide l\'adresse', (await rowsNow()).length === 3 && (await evaluate('location.search')) === '', await evaluate('location.search'));

step('5. Classer la trace sans type en kite');
await go('/sessions');
// Ouvrir la ligne « À classer » pose la question « Quelle activité ? » (la liste de l'application), pas l'analyse.
console.log('ouvrir :', await ouvrirLigne(evaluate, 'À classer'));
await waitFor(`Boolean(document.querySelector('.activity-select__sheet'))`, { timeout: 3000, label: 'question' });
check("la question « Quelle activité ? » au lieu de l'analyse", (await evaluate(`Boolean(document.querySelector('.activity-select__sheet'))`)) === true && (await evaluate('location.pathname')) === '/sessions');
console.log('Kite :', await evaluate(`(() => { const o = [...document.querySelectorAll('.activity-select__option')].find((x) => x.textContent.trim() === 'Kite'); if (!o) return 'absent'; o.click(); return 'ok'; })()`));
await waitFor(async () => (await records()).some((r) => r.sport === 'kite'), { timeout: 4000, label: 'fiche classée' });
await settle({ max: 2000 });
check("Kite choisi : l'analyse de la voile s'ouvre, la fiche est en kite", (await records()).some((r) => r.sport === 'kite') && (await evaluate('location.pathname')) === '/voile/analyse', await evaluate('location.pathname'));
await go('/sessions');
const apres = await rowsNow();
console.log('lignes :', JSON.stringify(apres));
check('classée en kite : trois lignes, Wingfoil, Kite et Surf, plus de « À classer »', apres.length === 3 && apres.some((r) => r.startsWith('Kite')) && apres.some((r) => r.startsWith('Wingfoil')) && apres.some((r) => r.startsWith('Surf')) && !apres.some((r) => r.startsWith('À classer')), JSON.stringify(apres));

step('6. Supprimer la session de surf');
console.log('« … » de la ligne, Supprimer :', await actionLigne(evaluate, wait, 'Surf', 'Supprimer'));
// Dans le programme Windows la mémoire est un dossier du disque, qui a une corbeille de 30 jours : la question le dit et la
// session n'est plus dans `sessions/` mais dans `corbeille/`. Dans un navigateur, elle est effacée.
const versCorbeille = (await evaluate('Boolean(window.gtrackerBureau)')) === true;
const question = versCorbeille ? 'Mettre cette session à la corbeille ?' : 'Supprimer cette session de la mémoire ?';
await waitFor(`document.body.innerText.includes(${JSON.stringify(question)})`, { timeout: 3000, label: 'confirmation' });
check('la confirmation de la suppression sous la ligne, rien d\'effacé avant', (await evaluate('document.body.innerText')).includes(question) && (await records()).some((r) => r.sport === 'surf'));
console.log('Confirmer :', await clickText('Confirmer'));
await settle({ max: 1500 });
await waitFor(async () => !(await records()).some((r) => r.sport === 'surf'), { timeout: 4000, label: 'fiche effacée' });
console.log('lignes :', await rows());
check('plus de ligne de Surf', !(await rowsNow()).some((r) => r.startsWith('Surf')) && (await rowsNow()).length === 2, await rows());
console.log('rond Surf :', await choisirActivite(evaluate, 'Surf'));
await settle({ max: 1500 });
console.log(await lines(/Aucune session/));
check('filtrée sur Surf : « Aucune session de surf »', /Aucune session de surf pour l'instant/.test(await evaluate('document.body.innerText')) && (await rowsNow()).length === 0, await lines(/Aucune/));
check('la fiche et la trace de surf ne sont plus parmi les sessions de la mémoire', !(await records()).some((r) => r.sport === 'surf') && !Object.keys(JSON.parse(await opfsTree())).some((k) => k.startsWith('sessions/') && k.includes('_surf.')));

step('7. Réglages : une unité changée, fichier de l\'appareil (reglages/<appareil>.json)');
await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}'); s.settings = { ...s.settings, activites: true }; s['settings-families'] = { ...s['settings-families'], voile: true }; localStorage.setItem('${CLES.sections}', JSON.stringify(s)); return 'ok'; })()`);
await go('/parametres');
await waitFor(`document.querySelectorAll('.settings-activity').length > 0`, { timeout: 5000, label: 'cartes montées' });
await evaluate(`(() => { const c = document.querySelector('.settings-activity'); c.querySelector('.settings-activity__toggle[aria-expanded="false"]')?.click(); return 'ok'; })()`);
await wait(300);
await evaluate(`[...document.querySelector('.settings-activity').querySelectorAll('.settings-part__toggle')].find((b) => b.textContent.trim() === 'Affichage' && b.getAttribute('aria-expanded') === 'false')?.click()`);
await wait(300);
const setUnit = await evaluate(`(() => {
  const sel = document.querySelector('.settings-activity .settings-activity__body select');
  if (!sel) return 'absent';
  const other = [...sel.options].find((o) => o.value !== sel.value);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, other.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return other.value;
})()`);
console.log('unité changée :', setUnit);
// L'écriture du fichier de l'appareil est différée : attendre que sa taille change.
const tailleAvant = JSON.parse(await opfsTree())['reglages/pc.json'];
await waitFor(async () => JSON.parse(await opfsTree())['reglages/pc.json'] !== tailleAvant, { timeout: 8000, every: 250, label: 'fichier de réglages réécrit' });
await settle({ max: 1000 });
const reglagesDir = Object.keys(JSON.parse(await opfsTree())).filter((k) => k.startsWith('reglages/'));
console.log('dossier reglages :', reglagesDir.join(', '));
const fichierAppareil = reglagesDir[0];
const settings = JSON.parse(fichierAppareil ? await readOpfs(fichierAppareil) : '{}');
console.log(`${fichierAppareil} :`, JSON.stringify(settings.values?.[CLES.sportSettings] ? Object.keys(settings.values[CLES.sportSettings]) : null), '| appareil', settings.device?.name, '| savedAt', settings.savedAt ? new Date(settings.savedAt).toISOString() : null);
console.log(await lines(/cet appareil|Nom de cet appareil/));
check('un fichier de réglages de l\'appareil est écrit', reglagesDir.length === 1, reglagesDir.join(', '));
check('il porte les réglages d\'activité et le nom de l\'appareil', Boolean(settings.values?.[CLES.sportSettings]) && typeof settings.device?.name === 'string' && settings.savedAt > 0, JSON.stringify(settings.device));
await shot('reglages-desktop', 1400, 1000, false);
await shot('reglages-mobile', 390, 844, true);

step('8. Relance : liste relue du cache');
await go('/sessions', 3500);
const relance = await rowsNow();
console.log('lignes :', JSON.stringify(relance));
console.log('dossier :', await opfsTree());
const lisezmoi = (await readOpfs('LISEZMOI.txt')).split('\r\n')[0];
console.log('LISEZMOI :', lisezmoi);
check('relance : les deux mêmes lignes', relance.length === 2 && relance.some((r) => r.startsWith('Kite')) && relance.some((r) => r.startsWith('Wingfoil')), JSON.stringify(relance));
check('le LISEZMOI du dossier est là', lisezmoi.length > 0);
await shot('sessions-mobile', 390, 844, true);
await shot('sessions-desktop', 1400, 1000, false);

step('9. Une paire GPX + fiche exportée, la session supprimée, puis réimportée : les notes reviennent');
const NOM = fiche.replace(/^sessions\//, '').replace(/\.json$/, '');
await go('/sessions');
writeFileSync(win(`${NOM}.gpx`), await readOpfs(`sessions/${NOM}.gpx`));
writeFileSync(win(`${NOM}.json`), await readOpfs(`sessions/${NOM}.json`));
console.log('avant :', await rows());
console.log('Supprimer :', await actionLigne(evaluate, wait, 'Wingfoil', 'Supprimer'));
await wait(300);
console.log('Confirmer :', await clickText('Confirmer'));
await settle({ max: 1500 });
await waitFor(async () => !(await records()).some((r) => r.sport === 'wingfoil'), { timeout: 4000, label: 'fiche effacée' });
check('après suppression : plus de Wingfoil', !(await rowsNow()).some((r) => r.startsWith('Wingfoil')), await rows());
console.log('import de la paire :', await setFiles('input[type=file][accept*=".gpx"][multiple]', [win(`${NOM}.gpx`), win(`${NOM}.json`)]));
// L'écriture en mémoire (OPFS) ne touche ni au DOM ni au réseau : on attend la ligne de la liste, puis sa réécriture différée.
await waitFor(ligneExiste('Wingfoil'), { timeout: 6000, label: 'session réimportée' });
await settle({ max: 2000 });
const reimport = JSON.parse(await readOpfs(`sessions/${NOM}.json`));
console.log('fiche réimportée : notes.foil =', reimport.notes?.foil, '| manœuvres =', reimport.summary.maneuverCount, '| source =', reimport.source);
check('la paire réimportée : le foil et les manœuvres reviennent', reimport.notes?.foil === 'Axis 900 banc' && reimport.summary.maneuverCount === record.summary.maneuverCount,
  `${reimport.notes?.foil} ; ${reimport.summary.maneuverCount}`);

step('10. Le fichier de réglages d\'un autre appareil, plus récent : visible, jamais repris de lui-même');
const avant = await evaluate(`localStorage.getItem('${CLES.sportSettings}')`);
const autres = JSON.parse(JSON.stringify(settings));
autres.savedAt = Date.now() + 60_000;
autres.device = { id: 'autre-appareil', name: 'Téléphone' };
autres.values[CLES.sportSettings] = { ...autres.values[CLES.sportSettings], thresholds: { wingfoil: 11 } };
console.log('écriture :', await writeOpfs('reglages/telephone.json', JSON.stringify(autres)));
await go('/parametres', 3500);
// Les réglages de l'autre appareil, différents, sont proposés dans la carte Mémoire (« Garder les miens », « Prendre ceux de « Téléphone » »).
const ANNONCE = /Les réglages de « Téléphone » sont différents de ceux de cet ordinateur/;
await waitFor(`${ANNONCE}.test(document.body.innerText)`, { timeout: 4000, label: "réglages de l'autre appareil proposés" });
const apresAutre = await evaluate(`localStorage.getItem('${CLES.sportSettings}')`);
console.log('stockage de l\'appareil inchangé :', apresAutre === avant);
console.log(await lines(/sont différents de ceux de/));
check('les réglages de l\'appareil ne sont pas remplacés par ceux de l\'autre', apresAutre === avant && !String(apresAutre).includes('"wingfoil":11'));
check('les réglages de l\'autre appareil sont proposés, avec les deux réponses', ANNONCE.test(await evaluate('document.body.innerText'))
  && (await evaluate(`['Garder les miens', 'Prendre ceux de « Téléphone »'].every((t) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === t))`)));

console.log('\n--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 15).forEach((l) => console.log(l));
await finish('Tout passe.');
