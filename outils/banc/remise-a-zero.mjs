// Banc de la remise à zéro de Réglages › Mémoire : « Réglages d'usine » et « Tout supprimer », tenus une seconde puis
// confirmés, sur la mémoire du navigateur (OPFS) d'un profil neuf, sans réseau.
// Usage : node remise-a-zero.mjs <port> <dossier de travail> [<dossier des captures>]
// Préparation : deux sessions de wingfoil importées ; une activité créée (Moth) et une unité changée (km/h en
// Wingfoil), posées dans les réglages de l'appareil ; un pseudo ; posés à la main dans le dossier : `reglages/autre.json`
// (fichier de réglages d'un autre appareil), `a-moi.txt` à la racine et `sessions/notes.txt` ; une tuile dans le cache
// des cartes gardées. Contrôles :
//  1. la zone « Remise à zéro » est repliée au bas de la carte Mémoire, ses deux boutons et son aide ;
//  2. « Réglages d'usine » : la question dit ce qui reste, la page se recharge sur le Profil ; l'activité et l'unité
//     reviennent au défaut, l'instant des réglages est posé (jamais retiré), les deux sessions et le pseudo restent,
//     `reglages/autre.json` aussi, et le fichier de l'appareil est réécrit sans l'activité créée ;
//  3. « Tout supprimer » : la question dit les deux sessions, la page se recharge ; plus de fiche ni de GPX, Profil
//     sans pseudo, activités de départ, cache des tuiles effacé, fichier de l'autre appareil effacé ; restent les
//     fichiers étrangers et ce que l'ouverture réécrit (marqueur, LISEZMOI, fichier de réglages de l'appareil), et le
//     dossier reste désigné.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHES, CLES, connect, DOSSIER_MEMOIRE, FORMATS, vwait } from './lib/cdp.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node remise-a-zero.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

const premier = join(workDir, 'remise-1.gpx');
const second = join(workDir, 'remise-2.gpx');
writeFileSync(premier, traceVoile({ debutMs: Date.UTC(2026, 9, 2, 8, 0, 0), bords: 2, secondes: 300 }));
writeFileSync(second, traceVoile({ debutMs: Date.UTC(2026, 9, 3, 8, 0, 0), bords: 2, secondes: 300 }));

const b = await connect({ port, width: 1400, height: 1000, shotDir });
const { evaluate, go, settle, waitFor, wait, importFiles, records, shoot, check, finish, logs, blockNetwork, onMessage } = b;
await blockNetwork();

/** Questions posées par la page (`window.confirm`), acceptées d'office par `lib/cdp.mjs`. */
const questions = [];
onMessage((msg) => { if (msg.method === 'Page.javascriptDialogOpening') questions.push(msg.params.message); });

const opfs = (body) => evaluate(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}', { create: true }); ${body} })()`);
/** Tous les fichiers du dossier mémoire, chemins triés. */
const allFiles = async () => (await opfs(`const out = []; const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else out.push(p + n); } }; await walk(root, ''); return out.sort();`)) ?? [];
const writeFile = (path, text) => opfs(`let d = root; const parts = ${JSON.stringify(path)}.split('/'); const name = parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p, { create: true }); const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(${JSON.stringify(text)}); await w.close(); return 'ok';`);
const readFile = (path) => opfs(`try { let d = root; const parts = ${JSON.stringify(path)}.split('/'); const name = parts.pop(); for (const p of parts) d = await d.getDirectoryHandle(p); return await (await (await d.getFileHandle(name)).getFile()).text(); } catch { return null; }`);
const key = (k) => evaluate(`localStorage.getItem(${JSON.stringify(k)})`);
const step = (title) => console.log(`\n== ${title}`);

/** Lance `action` qui recharge la page, attend le nouveau document puis une page prête. */
const reloaded = async (action, max = 8000) => {
  const before = await evaluate(`window.__banc?.doc ?? null`);
  const res = await action();
  await waitFor(`window.__banc?.doc !== ${JSON.stringify(before)}`, { timeout: max, label: 'rechargement' });
  await settle({ max, label: 'après rechargement' });
  return res;
};

/** Ouvre la carte Mémoire de Réglages puis la zone « Remise à zéro ». */
const openZone = async () => {
  await go('/parametres');
  await waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 4000, label: 'carte Mémoire' });
  const memory = await evaluate(`(() => { const b = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire'); b.click(); return 'ok'; })()`);
  await waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Remise à zéro')`, { timeout: 3000, label: 'zone' });
  const zone = await evaluate(`(() => { const b = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Remise à zéro'); if (!b) return 'absente'; b.click(); return 'ok'; })()`);
  await settle({ max: 1500, label: 'zone ouverte' });
  return `${memory}, ${zone}`;
};

/** Texte de la zone « Remise à zéro », de son titre à la fin de la carte. */
const zoneText = () => evaluate(`(() => { const t = [...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Remise à zéro'); return t ? t.parentElement.innerText.replace(/\\n+/g, ' / ') : '(absente)'; })()`);

/** Tient le bouton `label` une seconde (appui, 1,1 s de page, relâcher, clic), comme « Supprimer ». */
const hold = async (label) => {
  const down = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (!b) return 'absent'; if (b.disabled) return 'désactivé';
    window.__tenu = b;
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    return 'ok';
  })()`);
  if (down !== 'ok') return down;
  await vwait(1100);
  await evaluate(`(() => { const b = window.__tenu; if (b?.isConnected) { b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); } return 'ok'; })()`);
  return 'ok';
};

const DEVICE_FILE = 'reglages/pc.json';
const activitiesOf = (text) => {
  try { return JSON.parse(text).values[CLES.sportSettings]?.activities?.map((a) => a.id) ?? null; } catch { return 'illisible'; }
};

// --- Préparation ---
step('Préparation');
await go('/sessions');
console.log('import :', await importFiles([premier]));
await waitFor(async () => (await records()).length === 1, { timeout: 8000, label: 'première fiche' });
console.log('import :', await importFiles([second]));
await waitFor(async () => (await records()).length === 2, { timeout: 8000, label: 'deux fiches' });
await settle({ max: 3000, label: 'import' });
await evaluate(`(() => {
  localStorage.setItem('${CLES.sportSettings}', JSON.stringify({
    activities: [
      { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#1565c0' },
      { id: 'a-moth', name: 'Moth', base: 'wingfoil', color: '#2e7d32' },
      { id: 'surf', name: 'Surf', base: 'surf', color: '#5b6670' },
    ],
    speedUnits: { wingfoil: 'kmh' },
  }));
  localStorage.setItem('${CLES.athleteProfile}', JSON.stringify({ me: { name: 'Banc' } }));
  localStorage.setItem('${CLES.settingsSavedAt}', String(Date.now()));
  return 'ok';
})()`);
const other = { format: FORMATS.reglages, version: 2, savedAt: Date.now() - 3_600_000, device: { id: 'autre-appareil', name: 'Autre' }, values: {} };
console.log('fichiers posés :', await writeFile('reglages/autre.json', JSON.stringify(other)), await writeFile('a-moi.txt', 'à moi'), await writeFile('sessions/notes.txt', 'à moi aussi'));
console.log('tuile posée :', await evaluate(`(async () => { const c = await caches.open('${CACHES.tuiles}'); await c.put('/tuiles-gardees/banc.png', new Response('x')); return 'ok'; })()`));
await go('/sessions');
await waitFor(async () => (activitiesOf(await readFile(DEVICE_FILE)) ?? []).includes?.('a-moth'), { timeout: 5000, label: 'fichier de l\'appareil' });
console.log('dossier :', (await allFiles()).join(', '));
check('le fichier de l\'appareil porte l\'activité créée', (activitiesOf(await readFile(DEVICE_FILE)) ?? []).includes?.('a-moth'), await readFile(DEVICE_FILE));

// --- 1. La zone ---
step('1. Zone « Remise à zéro »');
console.log('ouverture :', await openZone());
console.log('zone :', await zoneText());
check('deux boutons tenus, permis au repos', await evaluate(`['Réglages d\\'usine', 'Tout supprimer'].every((t) => [...document.querySelectorAll('button.ui-btn--hold')].some((b) => b.textContent.trim() === t && !b.disabled))`));
await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Aide : Remise à zéro'); b?.click(); return 'ok'; })()`);
await settle({ max: 1000, label: 'aide' });
const aide = await evaluate(`[...document.querySelectorAll('.settings-help')].map((p) => p.innerText).find((t) => t.includes('Tout supprimer')) ?? ''`);
console.log('aide :', aide.replace(/\n+/g, ' / '));
check('l\'aide dit « définitif », le GPX déposé à la main et ce que les réglages d\'usine ne touchent pas',
  /définitif/.test(aide) && /GPX que vous y\s+auriez déposé vous-même/.test(aide) && /ni aux sessions, ni aux itinéraires, ni au profil/.test(aide) && /lieux corrigés/.test(aide), aide);
if (shotDir) await shoot('remise-zone');

// --- 2. Réglages d'usine ---
step('2. Réglages d\'usine');
const savedBefore = Number(await key(CLES.settingsSavedAt));
questions.length = 0;
await reloaded(async () => console.log('appui tenu :', await hold('Réglages d\'usine')));
console.log('question :', questions.join(' | '));
console.log('adresse :', await evaluate('location.pathname'));
check('question : ce qui reste', questions.length === 1 && /Les sessions, les itinéraires, le profil et les lieux corrigés restent/.test(questions[0]), questions.join(' | '));
check('rechargée sur le Profil', (await evaluate('location.pathname')) === '/profil');
const sport = JSON.parse((await key(CLES.sportSettings)) ?? 'null');
console.log('réglages des activités :', JSON.stringify(sport));
check('activité créée et unité changée revenues au défaut', sport === null || (sport.activities === undefined && sport.speedUnits === undefined), JSON.stringify(sport));
check('instant des réglages posé, jamais retiré', Number(await key(CLES.settingsSavedAt)) >= savedBefore);
check('pseudo gardé', JSON.parse((await key(CLES.athleteProfile)) ?? '{}').me?.name === 'Banc', await key(CLES.athleteProfile));
await waitFor(async () => (await records()).length === 2, { timeout: 4000, label: 'fiches' });
check('les deux sessions restent', (await records()).length === 2);
check('le fichier de l\'autre appareil reste', (await readFile('reglages/autre.json')) !== null);
await waitFor(async () => (await readFile(DEVICE_FILE)) !== null, { timeout: 4000, label: 'fichier réécrit' });
const ownAfter = await readFile(DEVICE_FILE);
console.log('fichier de l\'appareil :', JSON.stringify(activitiesOf(ownAfter)));
check('fichier de l\'appareil réécrit, sans l\'activité créée', ownAfter !== null && !ownAfter.includes('a-moth'), ownAfter);
await go('/parametres');
const settingsText = await evaluate('document.body.innerText');
check('Réglages : plus de Moth', !/\bMoth\b/.test(settingsText));
check('les fichiers étrangers restent', (await readFile('a-moi.txt')) === 'à moi' && (await readFile('sessions/notes.txt')) === 'à moi aussi');

// --- 3. Tout supprimer ---
step('3. Tout supprimer');
console.log('ouverture :', await openZone());
questions.length = 0;
await reloaded(async () => console.log('appui tenu :', await hold('Tout supprimer')), 15000);
console.log('question :', questions.join(' | '));
check('question : les deux sessions, définitivement', questions.length === 1 && /^Tout supprimer \? Seront effacés définitivement : 2 sessions et leurs fiches, le profil/.test(questions[0]), questions.join(' | '));
await settle({ max: 3000, label: 'ouverture' });
console.log('adresse :', await evaluate('location.pathname'));
const left = await allFiles();
console.log('dossier :', left.join(', '));
check('plus de session ni de fiche', (await records()).length === 0 && !left.some((p) => /^sessions\/.*\.(gpx|json)$/.test(p)), left.join(', '));
check('fichier de l\'autre appareil effacé', !left.includes('reglages/autre.json'));
check('fichiers étrangers gardés', left.includes('a-moi.txt') && left.includes('sessions/notes.txt'));
check('rien d\'autre que les étrangers et ce que l\'ouverture réécrit',
  left.filter((p) => !['a-moi.txt', 'sessions/notes.txt', 'gtracker.json', 'LISEZMOI.txt', DEVICE_FILE].includes(p)).length === 0, left.join(', '));
check('profil effacé', (await key(CLES.athleteProfile)) === null || JSON.parse(await key(CLES.athleteProfile)).me?.name === undefined, await key(CLES.athleteProfile));
const sportAfter = JSON.parse((await key(CLES.sportSettings)) ?? 'null');
check('activités de départ', sportAfter === null || sportAfter.activities === undefined, JSON.stringify(sportAfter));
check('cache des tuiles effacé', !(await evaluate(`caches.has('${CACHES.tuiles}')`)));
await go('/profil');
const title = await evaluate(`document.querySelector('.profile-head__title')?.textContent.trim() ?? '(absent)'`);
console.log('Profil :', title);
check('le Profil dit « Bienvenue » seul', title === 'Bienvenue', title);
if (shotDir) await shoot('remise-apres');

console.log(logs.length ? `console :\n${[...new Set(logs)].join('\n')}` : 'console : aucune erreur');
await wait(100);
await finish('Tout passe.');
