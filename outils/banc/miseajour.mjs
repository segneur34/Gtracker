// Banc de test : « Mettre à jour », relecture du dossier mémoire sans relancer.
// Usage : node miseajour.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf (mémoire du navigateur), sans réseau. Le script fabrique ses GPX (`lib/traces.mjs`, wingfoil). Il :
//  1. importe une sortie, garde son GPX et sa fiche, les retire du dossier pendant que la page est ouverte : la liste ne
//     change pas ; « Mettre à jour » la retire ;
//  2. pose ce GPX et sa fiche (renommée, activité Kite) à la racine du dossier, et un second GPX sans fiche dans
//     sessions/ : « Mettre à jour » fait apparaître les deux, range la fiche avec son GPX, garde son nom et son activité,
//     et crée la fiche du second ;
//  3. relit une fois de plus : « rien de nouveau » ; enfin, le bouton est là dans Réglages › Mémoire, carte repliée comprise ;
//  3 bis. fiche changée en OPFS sous l'application ouverte : le nom saisi dans l'analyse et les notes de l'autre
//     appareil sont gardés tous les deux, le résumé aussi, sans message ;
//  4. marqueur d'une version plus récente : à l'ouverture et à « Mettre à jour », aucun fichier ne change (noms,
//     tailles, dates), un GPX à la racine et un GPX sans fiche restent tels quels, l'import est grisé et la carte de la
//     mémoire le dit.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, DOSSIER_MEMOIRE, FICHIER_MARQUEUR, FORMATS } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node miseajour.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Traces ---
/** Sortie de wingfoil de 15 min (`traceVoile`) à partir de l'instant donné. */
const sortieGpx = (name, t0) => traceVoile({ debutMs: t0, nom: name, bords: 1, secondes: 900, virageMin: 3 });
const firstPath = join(workDir, 'sortie-copiee.gpx');
writeFileSync(firstPath, sortieGpx('Sortie copiée', Date.UTC(2026, 9, 5, 8, 0, 0)));
const secondGpx = sortieGpx('Seconde sortie', Date.UTC(2026, 9, 6, 8, 0, 0));
const SECOND_NAME = '2026-10-06_10-00-00_wingfoil.gpx';

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importFiles, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
await blockNetwork();
/** Dossier `Gtracker` de la mémoire du navigateur, ou un de ses sous-dossiers. */
const dirJs = (path) => `(async () => {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
  for (const p of ${JSON.stringify(path)}.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(p);
  return dir;
})()`;
const listOpfs = (path) => evaluate(`(async () => { try { const dir = await ${dirJs(path)}; const names = []; for await (const [n] of dir.entries()) names.push(n); return names.sort(); } catch { return []; } })()`);
const readOpfs = (path, name) => evaluate(`(async () => (await (await (await ${dirJs(path)}).getFileHandle(${JSON.stringify(name)})).getFile()).text())()`);
const writeOpfs = (path, name, text) => evaluate(`(async () => {
  const w = await (await (await ${dirJs(path)}).getFileHandle(${JSON.stringify(name)}, { create: true })).createWritable();
  await w.write(${JSON.stringify(text)}); await w.close(); return 'ok';
})()`);
const removeOpfs = (path, name) => evaluate(`(async () => { await (await ${dirJs(path)}).removeEntry(${JSON.stringify(name)}); return 'ok'; })()`);
/** Ligne d'état de la mémoire, son bouton, et le compte rendu. */
const memory = () => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^(Mettre à jour|Mise à jour…)$/.test(x.textContent.trim()));
  const line = [...document.querySelectorAll('p')].map((p) => p.textContent).find((t) => /^\\d+ sessions? · /.test(t)) ?? '(pas de ligne)';
  const alert = document.querySelector('.ui-alert--success, .ui-alert--danger')?.textContent.replace(/Fermer$/, '').trim() ?? '';
  return \`\${line} | bouton : \${b ? (b.disabled ? b.textContent.trim() + ' (grisé)' : b.textContent.trim()) : 'absent'}\${alert ? ' | ' + alert : ''}\`;
})()`);
/** Appuie sur « Mettre à jour » et attend la fin de la relecture. */
const refresh = async () => {
  const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Mettre à jour' && !x.disabled); if (!b) return false; b.click(); return true; })()`);
  if (!clicked) return 'bouton absent ou grisé';
  await wait(200);
  const during = await memory();
  await waitFor(`[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Mettre à jour' && !x.disabled)`, { timeout: 30000, every: 100, label: 'relecture finie' });
  await settle({ max: 500, label: 'relecture' });
  return `pendant : ${during}`;
};
const sessionNames = () => evaluate(`[...document.querySelectorAll('.lib-row__name')].map((x) => x.textContent.trim()).join(' | ') || '(aucune nommée)'`);
const count = () => evaluate(`document.querySelectorAll('.lib-row').length`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });

// 1. Une session importée, puis retirée du dossier derrière le dos de l'application.
await go('/sessions');
// La liste n'est montée qu'une fois la mémoire (OPFS) ouverte, ce que `settle` ne voit pas.
await waitFor(`/Aucune session pour l'instant/.test(document.body.innerText)`, { timeout: 5000, label: 'page Sessions vide' });
console.log('au départ :', String(await count()));
check('au départ : 0 session', (await count()) === 0, String(await count()));
await importFiles(firstPath, 'input[type=file][accept*=".gpx"][multiple]');
await waitFor(async () => (await listOpfs('sessions')).some((n) => n.endsWith('.json')), { timeout: 3000, label: 'fiche' });
await settle({ max: 3000, label: 'import' });
const gpx = (await listOpfs('sessions')).find((n) => n.endsWith('.gpx'));
const recordName = gpx.replace(/\.gpx$/, '.json');
const gpxText = await readOpfs('sessions', gpx);
const record = JSON.parse(await readOpfs('sessions', recordName));
console.log('importée :', gpx, '|', String(await count()));
check('importée : 1 session', (await count()) === 1, String(await count()));
await removeOpfs('sessions', gpx);
await removeOpfs('sessions', recordName);
console.log('fichiers retirés, sans relire :', String(await count()));
check('fichiers retirés sans relire : la liste ne change pas (1 session)', (await count()) === 1, String(await count()));
console.log('Mettre à jour :', await refresh());
console.log('après :', String(await count()));
check('« Mettre à jour » retire la session : 0 session', (await count()) === 0, String(await count()));

// 2. Fiche et GPX posés à la racine, second GPX sans fiche dans sessions/.
await writeOpfs('', gpx, gpxText);
await writeOpfs('', recordName, JSON.stringify({ ...record, name: 'Sortie copiée du téléphone', sport: 'kite', activityId: 'kite' }, null, 2));
await writeOpfs('sessions', SECOND_NAME, secondGpx);
console.log('racine avant :', (await listOpfs('')).join(', '));
console.log('Mettre à jour :', await refresh());
console.log('après :', String(await count()));
console.log('racine après :', (await listOpfs('')).join(', '));
console.log('sessions/ :', (await listOpfs('sessions')).join(', '));
check('deux sessions apparaissent', (await count()) === 2, String(await count()));
check('la fiche et son GPX quittent la racine', !(await listOpfs('')).some((n) => n === gpx || n === recordName), (await listOpfs('')).join(', '));
check('… et sont rangés dans sessions/, avec la fiche créée du second', ['sessions'].every(() => true) && (await listOpfs('sessions')).join(',') === [gpx, recordName, SECOND_NAME, SECOND_NAME.replace(/\.gpx$/, '.json')].sort().join(','), (await listOpfs('sessions')).join(', '));
const moved = JSON.parse(await readOpfs('sessions', recordName));
console.log('fiche rangée :', `nom « ${moved.name} », activité ${moved.activityId}`);
check('la fiche rangée garde son nom et son activité', moved.name === 'Sortie copiée du téléphone' && moved.activityId === 'kite' && moved.sport === 'kite', JSON.stringify([moved.name, moved.sport, moved.activityId]));
const created = JSON.parse(await readOpfs('sessions', SECOND_NAME.replace(/\.gpx$/, '.json')));
console.log('fiche créée :', `${created.sport}, activité ${created.activityId}, ${Math.round(created.summary.distanceM)} m`);
check('la fiche créée du second : wingfoil, une distance', created.sport === 'wingfoil' && created.summary.distanceM > 1000, `${created.sport} ${created.summary?.distanceM}`);
const liste = await sessionNames();
console.log('liste :', liste);
check('la liste porte le nom de la fiche rangée', liste.includes('Sortie copiée du téléphone'), liste);
await shoot('miseajour-sessions');

// 3. Rien de nouveau ; le bouton dans Réglages › Mémoire.
console.log('Mettre à jour :', await refresh());
console.log('après :', String(await count()));
check('relue une fois de plus : toujours 2 sessions', (await count()) === 2, String(await count()));
await go('/parametres');
// Replié, le cadre Mémoire se réduit à son titre quand tout va bien : on le déplie pour lire la ligne et les boutons.
const foldedMemory = await evaluate(`(() => {
  const b = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire');
  if (!b) return 'absent';
  const card = b.closest('section');
  const lines = [...card.querySelectorAll('p, button')].length;
  const folded = lines === 0;
  if (folded) b.click();
  return folded ? 'replié, 0 ligne(s) ou bouton(s)' : 'déjà ouvert, ' + lines + ' ligne(s) ou bouton(s)';
})()`);
console.log('cadre Mémoire :', foldedMemory);
check('Réglages › Mémoire replié : le titre seul, sans ligne d\'état', foldedMemory === 'replié, 0 ligne(s) ou bouton(s)', foldedMemory);
await wait(300);
const reglages = await memory();
const importDossier = await evaluate(`[...document.querySelectorAll('label, button')].some((x) => x.textContent.trim() === "Ajouter les sessions d'un dossier")`);
console.log('Réglages :', reglages, '| import d\'un dossier :', importDossier);
check('Réglages › Mémoire : le bouton « Mettre à jour » et l\'import d\'un dossier', /bouton : Mettre à jour/.test(reglages) && importDossier === true, reglages);

// 3 bis. La fiche change sous l'application : sa prochaine écriture la fond au lieu de l'écraser.
await go(`/voile/analyse?session=${encodeURIComponent(gpx)}`);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 10000, label: 'onglets' });
await settle({ max: 3000, label: 'analyse' });
const onDisk = JSON.parse(await readOpfs('sessions', recordName));
await writeOpfs('sessions', recordName, JSON.stringify({ ...onDisk, notes: { ...(onDisk.notes ?? {}), comment: "Saisi sur l'autre appareil", savedAt: Date.now() } }, null, 2));
const opened = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Renommer'); if (!b) return false; b.click(); return true; })()`);
await wait(200);
await evaluate(`(() => { const i = document.querySelector('input[aria-label="Nom de la session"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Renommée ici'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'ok'; })()`);
// Une lecture peut tomber sur l'écriture en cours de l'application : retentée.
await waitFor(async () => { const text = await readOpfs('sessions', recordName); return Boolean(text) && JSON.parse(text).name === 'Renommée ici'; }, { timeout: 4000, label: 'fiche fondue' });
const fondue = JSON.parse(await readOpfs('sessions', recordName));
console.log('fiche changée sous l\'application : Renommer', opened, '| nom', fondue.name, '| commentaire', fondue.notes?.comment, '| résumé gardé', Math.round(fondue.summary.distanceM) === Math.round(onDisk.summary.distanceM));
check('fiche changée sous l\'application : le nom saisi ici et le commentaire de l\'autre appareil sont gardés tous les deux',
  opened === true && fondue.name === 'Renommée ici' && fondue.notes?.comment === "Saisi sur l'autre appareil", JSON.stringify([fondue.name, fondue.notes?.comment]));
check('… le résumé aussi', Math.round(fondue.summary.distanceM) === Math.round(onDisk.summary.distanceM));
const message = await evaluate(`document.querySelector('.ui-alert--danger')?.textContent.trim() ?? '(aucun)'`);
console.log('message :', message);
check('… sans message', message === '(aucun)', message);
await go('/parametres');

// 4. Marqueur d'une version plus récente : le dossier se lit, rien n'y est écrit.
/** Tous les fichiers du dossier, avec taille et date : la moindre écriture s'y voit, même d'un contenu identique. */
const snapshot = () => evaluate(`(async () => {
  const out = [];
  const walk = async (dir, prefix) => {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') await walk(h, prefix + name + '/');
      else { const file = await h.getFile(); out.push(prefix + name + ' ' + file.size + ' ' + file.lastModified); }
    }
  };
  await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}'), '');
  return JSON.stringify(out.sort());
})()`);
const importGreyed = () => evaluate(`(() => { const i = document.querySelector('input[type=file][accept*=".gpx"]'); return i ? i.disabled : '(absent)'; })()`);
await writeOpfs('', FICHIER_MARQUEUR, JSON.stringify({ format: FORMATS.memoire, version: 2 }));
await writeOpfs('', '2026-10-07_10-00-00_wingfoil.gpx', sortieGpx('Racine', Date.UTC(2026, 9, 7, 8, 0, 0)));
await writeOpfs('sessions', '2026-10-08_10-00-00_wingfoil.gpx', sortieGpx('Sans fiche', Date.UTC(2026, 9, 8, 8, 0, 0)));
const beforeOpening = await snapshot();
await go('/sessions');
await settle({ max: 3000, label: 'ouverture en lecture seule' });
console.log('marqueur v2, à l\'ouverture :', String(await count()));
const carte = await evaluate(`document.body.innerText.match(/[^\\n]*version plus récente de Gtracker[^\\n]*/)?.[0] ?? '(absente)'`);
console.log('carte de la mémoire :', carte);
check('marqueur d\'une version plus récente : la carte de la mémoire le dit', carte !== '(absente)', carte);
const grise = await importGreyed();
console.log('marqueur v2, aucun fichier changé :', (await snapshot()) === beforeOpening, '| import grisé :', grise);
check('marqueur v2, à l\'ouverture : aucun fichier changé, l\'import grisé', (await snapshot()) === beforeOpening && grise === true);
console.log('Mettre à jour :', await refresh());
console.log('après :', String(await count()));
check('marqueur v2, « Mettre à jour » : aucun fichier changé', (await snapshot()) === beforeOpening);
await go(`/voile/analyse?session=${encodeURIComponent(gpx)}`);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 10000, label: 'onglets' });
await settle({ max: 3000, label: 'analyse en lecture seule' });
const modifiable = await evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Renommer')`);
console.log('analyse : modifiable (« Renommer ») :', modifiable);
check('marqueur v2 : l\'analyse n\'est pas modifiable', modifiable === false);
check('marqueur v2, après l\'analyse : aucun fichier changé', (await snapshot()) === beforeOpening);

console.log(logs.length ? `console :\n${logs.join('\n')}` : 'console : aucune erreur');
await finish('Tout passe.');
