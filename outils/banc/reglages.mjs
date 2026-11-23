// Banc de test : un fichier de réglages par appareil (§10, point 90).
// Usage : node reglages.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau, dans la mémoire du navigateur (« PC »). Le script vérifie :
//  1. au premier lancement, l'appareil écrit reglages/pc.json ;
//  2. l'ordre des blocs (« Connexion » entre « Mémoire » et « Autorisations », pas de « Capteurs »), le bloc « Connexion »
//     du navigateur (la seule ligne des ceintures) et « Mémoire » ouvert sans carte de liaison ;
//  3. le fichier d'un autre appareil (« Léa ») déposé dans reglages/ : absent de la liste avant « Mettre à jour »,
//     présent après, et pas repris de lui-même ; le bandeau « Les réglages de « Léa » sont différents… » paraît ;
//  4. « Prendre ceux de « Léa » » du bandeau : « Remplacer » dans la confirmation, rechargement, activités de Léa
//     reprises telles quelles, seuil repris, choix retenus de l'appareil gardés, pc.json récrit ; plus de bandeau ;
//  5. renommage de l'appareil : le fichier suit son nom ; un nom déjà porté par un autre fichier est refusé ;
//  6. un fichier d'un autre appareil posé sous le nom de celui-ci, au seuil différent : l'appareil prend un nom libre
//     et le dit ; le bandeau le propose au lancement, « Garder les miens » le retire sans rien changer, et il ne
//     revient pas au rechargement ;
//  8. « Importer un fichier de réglages » : un JSON quelconque et le fichier de l'appareil refusés ; celui d'une
//     tablette rangé sous son nom, « Annuler » dans la confirmation, puis repris depuis la liste ; pas de bandeau ensuite ;
//  9. bornes de couleur du Wingfoil (lot 150) : 12-30, on efface 30, on retape 35 : 12-35 ; une borne vidée puis quittée
//     reprend son défaut et garde l'autre ; les deux vidées : plus de réglage, « défaut » ;
// 10. le seuil suit la session (lot 148, Q57) : seuil du Wingfoil changé, la fiche de sa session recalculée ; seconde
//     ouverture, fiche intacte (lastModified) ; réglages d'un autre appareil (seuil différent, sans geste) : fiche intacte.
// Les activités de Léa sont de voile et de surf (lot 330) ; la session du pas 10 est la trace de voile de `lib/traces.mjs`.
import { CLES, connect, DOSSIER_MEMOIRE, FORMATS } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node reglages.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, shoot, onMessage, check, logs, close, importGpx, records, blockNetwork } =await connect({ port, width: 1400, height: 1000, shotDir });
/** Premières lignes des confirmations : celles du navigateur, et les titres des fenêtres de la page (`answerAdoptDialog`). */
const dialogs = [];
onMessage((msg) => { if (msg.method === 'Page.javascriptDialogOpening') dialogs.push(msg.params.message.split(String.fromCharCode(10))[0]); });
/** Lance `action` qui recharge la page, attend le nouveau document puis une page prête (`max` ms au plus). */
const reloaded = async (action, max) => {
  const before = await evaluate(`window.__banc?.doc ?? null`);
  const res = await action();
  await waitFor(`window.__banc?.doc !== ${JSON.stringify(before)}`, { timeout: max, label: 'rechargement' });
  await settle({ max });
  return res;
};
const opfs = (body) => evaluate(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}'); ${body} })()`);
const listSettings = () => opfs(`try { const d = await root.getDirectoryHandle('reglages'); const names = []; for await (const [n] of d.entries()) names.push(n); return names.sort().join(', '); } catch { return '(pas de dossier)'; }`);
const readSettings = (name) => opfs(`const d = await root.getDirectoryHandle('reglages'); return JSON.parse(await (await (await d.getFileHandle(${JSON.stringify(name)})).getFile()).text());`);
const writeFile = (path, value) => opfs(`let d = root; const parts = ${JSON.stringify(path)}.split('/'); const name = parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p, { create: true }); const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(${JSON.stringify(JSON.stringify(value, null, 2))}); await w.close(); return 'ok';`);
const stored = () => evaluate(`JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? 'null')`);
/** Ouvre la carte Mémoire de Réglages, si elle est repliée. */
const openMemory = () => evaluate(`(() => { if (document.querySelector('input[maxlength="40"].ui-field')) return 'déjà ouverte'; const b = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire'); if (!b) return 'absente'; b.click(); return 'ouverte'; })()`);
const fileList = () => evaluate(`(() => { const ul = [...document.querySelectorAll('ul')].find((u) => /cet appareil/.test(u.innerText)); return ul ? [...ul.children].map((li) => li.innerText.replace(/\\n/g, ' / ')).join(' || ') : '(pas de liste)'; })()`);
const clickButton = (text, near) => evaluate(`(() => { const li = ${near ? `[...document.querySelectorAll('li')].find((x) => x.innerText.startsWith(${JSON.stringify(near)}))` : 'document'}; if (!li) return 'ligne absente'; const b = [...li.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'bouton absent'; b.click(); return 'ok'; })()`);
const rename = async (name, until) => {
  await evaluate(`(() => { const i = document.querySelector('input[maxlength="40"].ui-field'); i.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(name)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); return 'ok'; })()`);
  if (until) await waitFor(until, { timeout: 1200, label: 'renommage' });
  await settle({ max: 1200, label: 'renommage' });
};
/** Texte du bandeau des réglages d'un autre appareil (« Les réglages de « X » sont différents… »), ou « (aucun) ». */
const banner = () => evaluate(`(() => { const a = [...document.querySelectorAll('.ui-alert')].find((x) => /sont différents de ceux de/.test(x.innerText)); return a ? a.innerText.replace(/\\n/g, ' / ') : '(aucun)'; })()`);
const clickInBanner = (text) => evaluate(`(() => { const a = [...document.querySelectorAll('.ui-alert')].find((x) => /sont différents de ceux de/.test(x.innerText)); if (!a) return 'bandeau absent'; const b = [...a.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'bouton absent'; b.click(); return 'ok'; })()`);
/** Fenêtre de confirmation « Prendre les réglages de … ? » : son titre est noté dans `dialogs`, puis `answer` y est cliqué. */
const answerAdoptDialog = async (answer) => {
  await waitFor(`Boolean(document.querySelector('.ui-dialog'))`, { timeout: 1500, label: 'confirmation' });
  dialogs.push(await evaluate(`document.querySelector('.ui-dialog__head strong')?.textContent ?? ''`));
  return evaluate(`(() => { const b = [...document.querySelectorAll('.ui-dialog button')].find((x) => x.textContent.trim() === ${JSON.stringify(answer)}); if (!b) return 'bouton absent'; b.click(); return 'ok'; })()`);
};
const dialogOpen = () => evaluate(`Boolean(document.querySelector('.ui-dialog'))`);
const pageLines = (re) =>evaluate(`document.body.innerText.split('\\n').filter((l) => ${re}.test(l)).join(' | ')`);
const step = (title) => console.log(`\n== ${title}`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

step('1. Premier lancement');
await go('/parametres', 4000);
console.log('reglages/ :', await listSettings());
const first = await readSettings('pc.json');
console.log('pc.json : version', first.version, '| appareil', JSON.stringify(first.device), '| activités', first.values[CLES.sportSettings]?.activities?.length ?? '(défaut)');

step('2. Blocs : « Connexion » entre « Mémoire » et « Autorisations », plus de « Capteurs »');
const BLOCS = ['Pratiquant', 'Activités', 'Enregistrement', 'Affichage', 'Cartes hors ligne', 'Mémoire', 'Connexion', 'Autorisations', 'Tutoriels', 'À propos'];
const titreBloc = (nom) => `[...document.querySelectorAll('.ui-panel-title')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(nom)}))`;
const ordre = await evaluate(`(() => { const names = ${JSON.stringify(BLOCS)}; const titles = [...document.querySelectorAll('.ui-panel-title')].map((x) => x.textContent.trim()); return names.filter((n) => titles.some((t) => t.startsWith(n))).join(' > '); })()`);
check('blocs : Connexion entre Mémoire et Autorisations, dans l\'ordre de la fiche', ordre === BLOCS.join(' > '), ordre);
check('blocs : plus de bloc « Capteurs »', (await evaluate(`![...document.querySelectorAll('.ui-panel-title')].some((x) => x.textContent.trim().startsWith('Capteurs'))`)) === true);
const corps = (nom) => `${titreBloc(nom)}?.parentElement.querySelector('.settings-block__body')`;
await evaluate(`${titreBloc('Connexion')}?.click(), 'ok'`);
await waitFor(`Boolean(${corps('Connexion')})`, { timeout: 2000, label: 'bloc Connexion' });
const connexion = await evaluate(`(() => { const c = ${corps('Connexion')}; return { texte: c.innerText.replace(/\\n+/g, ' | '), titre: c.querySelector('.connection-settings__title')?.textContent.trim() ?? null, cartes: c.querySelectorAll('.wireless-card, .phone-app, .computer-link__title').length }; })()`);
// Sous le programme Windows, le bloc porte aussi le Téléphone et l'Application du téléphone, dans cet ordre ; dans le navigateur, la seule ligne des ceintures.
const ordinateur = await evaluate(`Boolean(document.querySelector('.wireless-card'))`);
console.log(ordinateur ? 'Connexion (programme Windows) :' : 'Connexion (navigateur) :', ordinateur ? await evaluate(`[...document.querySelectorAll('.wireless-card__title, .phone-app__title, .connection-settings__title')].map((x) => x.textContent.trim()).join(' > ')`) : connexion.texte);
if (ordinateur) {
  const titres = await evaluate(`[...document.querySelectorAll('.wireless-card__title, .phone-app__title, .connection-settings__title')].map((x) => x.textContent.trim()).join(' > ')`);
  check('Connexion, programme Windows : Téléphone, Application du téléphone, puis la ligne des ceintures', titres === 'Téléphone > Application du téléphone > Ceintures et montres' && connexion.texte.includes("Sur l'application Android seulement."), titres);
} else {
  check('Connexion, navigateur : la seule ligne des ceintures (titre et phrase)', connexion.titre === 'Ceintures et montres' && connexion.texte.includes("Sur l'application Android seulement.") && connexion.cartes === 0, connexion.texte);
}
await evaluate(`${titreBloc('Connexion')}?.click(), 'ok'`);
console.log('carte Mémoire :', await openMemory());
await wait(300);
// Connexion est refermé : aucune carte de liaison ne doit rester sur la page, Mémoire ouvert.
const liaison = await evaluate(`document.querySelectorAll('.wireless-card, .phone-app, .computer-link__title').length`);
check('Mémoire ouvert : plus aucune carte de liaison', liaison === 0, liaison);
await evaluate(`${titreBloc('Mémoire')}?.click(), 'ok'`);
await wait(300);

step('3. Le fichier de Léa, déposé dans reglages/');
const leaActivities = [
  { id: 'wingfoil', name: 'Wing', base: 'wingfoil', color: '#1565c0' },
  { id: 'a-moth', name: 'Moth', base: 'wingfoil', color: '#2e7d32' },
  { id: 'surf', name: 'Surf', base: 'surf', color: '#5b6670' },
  { id: 'a-pad', name: 'Pad', base: 'surf', color: '#37474f' },
  { id: 'bateau', name: 'Bateau', base: 'bateau', color: '#00695c' },
];
const lea = {
  format: FORMATS.reglages, version: 2, savedAt: Date.now() - 3_600_000, device: { id: 'appareil-de-lea', name: 'Léa' },
  values: {
    [CLES.sportSettings]: { activities: leaActivities, thresholds: { wingfoil: 13 }, speedUnits: { wingfoil: 'kmh' }, recordActivity: 'a-pad' },
    [CLES.athleteProfile]: { me: { weightKg: 58 } },
  },
};
// L'appareil retient une activité à l'enregistrement : elle doit survivre à la reprise.
await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}'); s.recordActivity = 'surf'; localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s)); return 'ok'; })()`);
console.log('écrit :', await writeFile('reglages/lea.json', lea));
console.log('carte Mémoire :', await openMemory());
await wait(500);
console.log('liste avant « Mettre à jour » :', await fileList());
console.log('Mettre à jour :', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Mettre à jour'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await waitFor(async () => /Léa/.test(await fileList()), { timeout: 2500, label: 'liste après la mise à jour' });
await settle({ max: 2500 });
console.log('liste après :', await fileList());
console.log('seuil de l\'appareil, inchangé :', (await stored())?.thresholds?.wingfoil);
console.log('bandeau :', await banner());
await shoot('reglages-liste');

step('4. Reprendre les réglages de Léa, depuis le bandeau');
console.log('Prendre ceux de Léa :', await reloaded(async () => {
  const clicked = await clickInBanner('Prendre ceux de « Léa »');
  return clicked === 'ok' ? answerAdoptDialog('Remplacer') : clicked;
}, 4500));
console.log('confirmation :', dialogs.at(-1) ?? '(aucune)');
const after = await stored();
console.log('activités :', after?.activities?.map((a) => `${a.name} ${a.color}`).join(', '));
console.log('seuil wingfoil :', after?.thresholds?.wingfoil, '(13 attendu) | activité retenue à l\'enregistrement :', after?.recordActivity, '(surf attendu)');
console.log('poids du pratiquant :', await evaluate(`JSON.parse(localStorage.getItem('${CLES.athleteProfile}') ?? 'null')?.me?.weightKg`));
const pc = await readSettings('pc.json');
console.log('pc.json : seuil', pc.values[CLES.sportSettings]?.thresholds?.wingfoil, '| appareil', pc.device?.name);
console.log('carte Mémoire :', await openMemory());
await wait(500);
console.log('liste :', await fileList());
console.log('bandeau après la reprise (aucun attendu) :', await banner());

step('5. Renommer l\'appareil');
await rename('PC du bureau', async () => /pc-du-bureau/.test(await listSettings()));
console.log('reglages/ :', await listSettings(), '| nom gardé :', await evaluate(`localStorage.getItem('${CLES.deviceName}')`));
await rename('Léa', async () => Boolean(await pageLines('/choisissez un autre nom/')));
console.log('refus :', await pageLines('/choisissez un autre nom/'), '| reglages/ :', await listSettings());
await evaluate(`(() => { const i = document.querySelector('input[maxlength="40"].ui-field'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'ok'; })()`);
await shoot('reglages-renomme');

step('6. Un autre appareil sous le nom de celui-ci');
// Seuil différent de celui de l'appareil : des réglages identiques ne seraient pas proposés.
const intrus = {
  ...lea, device: { id: 'intrus', name: 'PC du bureau' }, savedAt: Date.now(),
  values: { ...lea.values, [CLES.sportSettings]: { ...lea.values[CLES.sportSettings], thresholds: { wingfoil: 17 } } },
};
console.log('écrit par-dessus :', await writeFile('reglages/pc-du-bureau.json', intrus));
await go('/parametres', 4000);
console.log('message :', await pageLines('/s\'appelle désormais/'));
console.log('reglages/ :', await listSettings(), '| nom :', await evaluate(`localStorage.getItem('${CLES.deviceName}')`));
console.log('pc-du-bureau.json reste à l\'intrus :', (await readSettings('pc-du-bureau.json')).device?.id);
console.log('bandeau au lancement :', await banner());
console.log('Garder les miens :', await clickInBanner('Garder les miens'));
await wait(300);
console.log('bandeau après « Garder les miens » (aucun attendu) :', await banner(), '| seuil de l\'appareil, inchangé :', (await stored())?.thresholds?.wingfoil);
await go('/parametres', 4000);
console.log('bandeau après rechargement (aucun attendu) :', await banner());

const ownName = (await listSettings()).split(', ').find((n) => n.startsWith('pc-du-bureau-'));

step('8. Importer un fichier de réglages');
/** Choisit un fichier JSON dans « Importer un fichier de réglages », fabriqué dans la page. */
const importJson = async (name, value) => {
  const noteBefore = await importNote();
  const res = await evaluate(`(() => { const input = document.querySelector('input[type=file][accept*="json"]'); if (!input) return 'champ absent'; const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}], ${JSON.stringify(name)}, { type: 'application/json' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
  await waitFor(async () => (await importNote()) !== noteBefore || (await dialogOpen()), { timeout: 1500, label: 'message de l’import' });
  // Fichier rangé : la confirmation s'ouvre ; « Annuler » le laisse dans la liste, et la phrase le dit.
  if (await dialogOpen()) {
    await answerAdoptDialog('Annuler');
    await waitFor(async () => /est dans la liste/.test(await importNote()), { timeout: 1500, label: 'fichier laissé dans la liste' });
  }
  await settle({ max: 1500 });
  return res;
};
function importNote() { return pageLines('/n\'est pas un fichier|fichier de réglages de cet appareil|est dans la liste/'); }
console.log('carte Mémoire :', await openMemory());
await wait(500);
console.log('un JSON quelconque :', await importJson('notes.json', { bonjour: 1 }), '|', await importNote());
console.log('le fichier de cet appareil :', await importJson(ownName, await readSettings(ownName)), '|', await importNote());
const tablet = {
  format: FORMATS.reglages, version: 2, savedAt: Date.now() - 600_000, device: { id: 'tablette-de-lea', name: 'Tablette' },
  values: { [CLES.sportSettings]: { ...(await stored()), thresholds: { wingfoil: 15 } } },
};
console.log('la Tablette, reprise refusée :', await importJson('reglages-tablette.json', tablet), '|', await importNote());
console.log('confirmation posée :', dialogs.at(-1));
console.log('reglages/ :', await listSettings(), '| seuil de l\'appareil, inchangé :', (await stored())?.thresholds?.wingfoil);
console.log('liste :', await fileList(), '| bandeau (aucun attendu) :', await banner());
console.log('Reprendre dans la liste :', await reloaded(async () => {
  const clicked = await clickButton('Reprendre', 'Tablette');
  return clicked === 'ok' ? answerAdoptDialog('Remplacer') : clicked;
}, 4500));
console.log('seuil wingfoil :', (await stored())?.thresholds?.wingfoil, '(15 attendu)');
console.log('carte Mémoire :', await openMemory());
await wait(500);
console.log('bandeau après rechargement (aucun attendu) :', await banner());
await shoot('reglages-import');

// 9. Bornes de couleur : un champ vidé n'efface que sa borne. Wingfoil (appelé « Wing » dans la liste reprise), en km/h.
await evaluate(`(() => {
  const sections = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}');
  sections.settings = { ...sections.settings, activites: true };
  sections['settings-families'] = { ...sections['settings-families'], voile: true };
  sections['settings-activities'] = { ...sections['settings-activities'], wingfoil: true };
  sections['settings-activity-parts'] = { ...sections['settings-activity-parts'], affichage: true };
  localStorage.setItem('${CLES.sections}', JSON.stringify(sections));
  return 'ok';
})()`);
await go('/parametres', 3000);
const rangeRow = `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector('.settings-activity__name')?.textContent === 'Wing')?.querySelector('.settings-sports__pair')`;
await waitFor(`Boolean(${rangeRow}?.querySelector('input'))`, { timeout: 4000, label: 'bornes du Wingfoil' });
/** Saisie dans un des deux champs : 0 la borne basse, 1 la haute ; le champ garde le focus jusqu'à `leaveBound`. */
const typeBound = async (k, text) => {
  await evaluate(`(() => {
    const i = ${rangeRow}.querySelectorAll('input')[${k}];
    i.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(text)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await wait(150);
};
const leaveBound = async (k) => {
  await evaluate(`${rangeRow}.querySelectorAll('input')[${k}].blur(); 'ok'`);
  await wait(150);
};
const storedBounds = async () => {
  const r = (await stored())?.speedRanges?.wingfoil;
  return r ? `${Math.round(r.minMs * 36) / 10}-${Math.round(r.maxMs * 36) / 10}` : 'aucune';
};
const shownBounds = () => evaluate(`[...${rangeRow}.querySelectorAll('input')].map((i) => i.value).join('-')`);
const [defaultMin, defaultMax] = await evaluate(`[...${rangeRow}.querySelectorAll('input')].map((i) => i.placeholder)`);
console.log('bornes du Wingfoil par défaut :', `${defaultMin}-${defaultMax}`);
await typeBound(0, '12');
await leaveBound(0);
await typeBound(1, '30');
await leaveBound(1);
check('bornes : 12-30 rangées', (await storedBounds()) === '12-30', await storedBounds());
await typeBound(1, '');
check('bornes : 30 effacé, le 12 reste', (await storedBounds()).startsWith('12-'), await storedBounds());
await typeBound(1, '3');
check('bornes : première frappe, « 3 », sous le 12 : le 12 reste', (await storedBounds()).startsWith('12-'), await storedBounds());
await typeBound(1, '35');
await leaveBound(1);
check('bornes : 35 retapé : 12-35', (await storedBounds()) === '12-35' && (await shownBounds()) === '12-35', `${await storedBounds()} / ${await shownBounds()}`);
await typeBound(1, '');
await leaveBound(1);
check('bornes : borne haute vidée puis quittée : son défaut, le 12 reste', (await storedBounds()) === `12-${defaultMax}` && (await shownBounds()) === `12-${defaultMax}`, `${await storedBounds()} / ${await shownBounds()}`);
await typeBound(0, '');
await leaveBound(0);
check("bornes : les deux vidées : plus de réglage, « défaut »", (await storedBounds()) === 'aucune' && /défaut/.test(await evaluate(`${rangeRow}.innerText`)), `${await storedBounds()} / ${JSON.stringify(await evaluate(`${rangeRow}.innerText`))}`);

step('10. Le seuil suit la session');
const setThreshold = (value) => evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${CLES.sportSettings}') ?? '{}'); s.thresholds = { ...s.thresholds, wingfoil: ${value} }; localStorage.setItem('${CLES.sportSettings}', JSON.stringify(s)); return 'ok'; })()`);
// La session : la trace de voile du banc, importée par la page (sans réseau), rangée en wingfoil.
await blockNetwork();
await go('/voile', 3000);
console.log('import :', await importGpx(traceVoile({ nom: 'Session du seuil', virageMin: 3 }), 'seuil.gpx'));
await waitFor(async () => (await records())?.some((r) => r.summary?.movingTimeS !== undefined), { timeout: 8000, label: 'fiche importée' });
await settle({ max: 2000, label: 'import' });
const SESSION_GPX = (await records())?.[0]?.gpx ?? '';
const SESSION_URL = `/voile/analyse?session=${encodeURIComponent(SESSION_GPX)}`;
check('seuil : une session de voile rangée, en wingfoil', SESSION_GPX !== '' && (await records())[0].sport === 'wingfoil', SESSION_GPX);
/** Fiche de la session : le seuil porté et la date de son fichier ; `null` tant qu'elle n'existe pas. */
const sessionRecord = async () => {
  const r = (await records())?.find((x) => x.gpx === SESSION_GPX);
  if (!r) return null;
  const date = await opfs(`try { const d = await root.getDirectoryHandle('sessions'); return (await (await d.getFileHandle(${JSON.stringify(SESSION_GPX.replace(/\.gpx$/, '.json'))})).getFile()).lastModified; } catch { return null; }`);
  return { porte: r.summary?.activitySettings?.threshold, date };
};
/** Ouvre l'analyse de la session : la fiche se réécrit à l'ouverture si un geste l'attend. */
const openAnalysis = async () => {
  await go(SESSION_URL, 6000);
  await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
  await settle({ max: 2000 });
};
await setThreshold(1);
await openAnalysis();
await waitFor(async () => (await sessionRecord())?.porte === 1, { timeout: 5000, label: 'fiche au seuil' });
const created = await sessionRecord();
check("seuil : fiche portée au seuil de l'activité", created.porte === 1, JSON.stringify(created));
await setThreshold(2);
await openAnalysis();
await waitFor(async () => (await sessionRecord())?.porte === 2, { timeout: 5000, label: 'recalcul du geste' });
await settle({ max: 2000 });
const redone = await sessionRecord();
check('seuil : geste, fiche recalculée', redone.porte === 2 && redone.date > created.date, JSON.stringify(redone));
await openAnalysis();
check('seuil : seconde ouverture, fiche intacte', (await sessionRecord()).date === redone.date, JSON.stringify(await sessionRecord()));
// Autre appareil : un autre seuil dans ses réglages, sans geste de sa part.
await setThreshold(3);
await evaluate(`(() => { const g = JSON.parse(localStorage.getItem('${CLES.summaryGestures}')); g.baseline.wingfoil = { threshold: 3 }; localStorage.setItem('${CLES.summaryGestures}', JSON.stringify(g)); return 'ok'; })()`);
await openAnalysis();
check('seuil : autres réglages sans geste, fiche intacte', (await sessionRecord()).date === redone.date && (await sessionRecord()).porte === 2, JSON.stringify(await sessionRecord()));

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/parametres', 3000);
await openMemory();
await wait(500);
await evaluate(`[...document.querySelectorAll('ul')].find((u) => /cet appareil/.test(u.innerText))?.scrollIntoView({ block: 'center' }); 'ok'`);
await wait(300);
console.log('débordement à 390 px :', await evaluate('document.documentElement.scrollWidth > window.innerWidth'));
await shoot('reglages-390');

console.log('\n--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 15).forEach((l) => console.log(l));
await close();
process.exit(0);
