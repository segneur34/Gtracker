// Banc de test : « Partager » du menu « … » des analyses, image de la trace et des chiffres choisis (18/10).
// Usage : node partage.mjs <port> <dossier de travail> [<dossier des captures>]
// Sur un profil neuf. Réseau : les tuiles d'OpenStreetMap seulement (fond de l'image) ; le reste bloqué. Dure environ 1 min 30. Le script :
//  1. importe la voile de `lib/traces.mjs` (wingfoil) ;
//  2. pour la session : « Partager » en tête du menu « … », la fenêtre, l'aperçu (1080 × 1920, en hauteur), les pastilles
//     égales aux chiffres de l'onglet « général » (sans les « — »), les six premières enfoncées ; l'image est
//     gardée dans le dossier des captures (`partage-<page>.png`) ;
//  3. en voile : deux pastilles seulement (image toujours en 1080 × 1920), fond de carte décoché, choix rangés sous
//     l'activité de la session (`gtracker.partage`) et retrouvés à la réouverture ; « Partager » par le partage du
//     navigateur (simulé : fichier PNG nommé d'après la session), puis sans partage (téléchargement et message) ;
//     Échap ferme ;
//     lignes ajoutées le 05/11 : « Manœuvres réussies » et « Vent » en voile, rien de
//     « — » (pas d'appréciation donnée) ;
//  4. à 390×844 : la fenêtre tient dans l'écran, sans débordement de la page ;
//  5. fin d'enregistrement, à 390×844 : rejeu ×600 d'une trace de voile, Arrêter ; l'analyse s'ouvre seule, puis « … » ›
//     « Partager l'image » de l'analyse : aperçu en 1080 × 1920, chiffres du résumé, choix de la voile repris (clé de
//     l'activité enregistrée, la même que celle de la session importée : Wingfoil) ;
//  6. itinéraire : un parcours de trois balises posé et enregistré dans Planifier (écran d'ordinateur) ; « Partager l'image »
//     depuis le « … » du nom : 1080 × 1920, aucune case de chiffres (« Fond de carte » seule), `alt` relevé en entier
//     (nom, activité, trois chiffres, bords), partage simulé d'un PNG nommé d'après l'itinéraire, fond décoché ; puis la même
//     chose depuis le « … » d'une ligne de la liste des itinéraires ; aucune erreur de console. Images gardées dans le dossier
//     des captures : `partage-itineraire.png`, `partage-itineraire-sans-fond.png`.
// La taille du PNG transmis au partage n'est pas relevée : le fond de l'image est fait des tuiles d'OpenStreetMap, lues
// en direct, et sa taille change d'un passage à l'autre (tuiles plus ou moins nettes ou toutes arrivées) ; le script ne
// contrôle que « plus de 10 000 octets ».
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED_URLS, CLES, connect } from './lib/cdp.mjs';
import { attendreAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { DEBUT_PAR_DEFAUT, traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node partage.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importGpx, importFiles, records, clickText, shoot, close, logs, mouse } = await connect({ port, width: 1400, height: 1000, shotDir });

let failures = 0;
const check = (what, ok, detail = '') => { console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failures++; };

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
// Tout est bloqué sauf les tuiles d'OpenStreetMap, fond de l'image.
await blockNetwork(BLOCKED_URLS.filter((u) => !u.includes('openstreetmap')));

// --- Sessions ---
const T_VOILE = DEBUT_PAR_DEFAUT;
const SESSIONS = [
  // `share` : chiffres de l'image (22/10 : la liste entière d'avant, l'onglet « général » n'en montrant plus que l'essentiel).
  { page: 'voile', start: T_VOILE, gpx: traceVoile({ nom: 'Synthétique', virageMin: 3 }), share: ['Distance', 'Distance active', 'Temps total', /^Temps en vol/, 'Ratio de vol', 'Vitesse moyenne', /^Moyenne active/, 'Manœuvres réussies', 'Vent'] },
];

const paths = {};
/** Activité de chaque session rangée : clé de son choix dans `gtracker.partage`. */
const activityIds = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.page} :`, await importGpx(s.gpx, `${s.page}.gpx`));
  const rec = await waitFor(async () => (await records())?.find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 6000, label: `fiche ${s.page}` });
  await settle({ max: 2000, label: `import ${s.page}` });
  paths[s.page] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  activityIds[s.page] = rec?.activityId ?? rec?.sport ?? s.page; // la voile est rangée sous « voile »
  check(`${s.page} rangée`, Boolean(rec));
}

// --- Outils de la fenêtre ---
const menuItems = () => evaluate(`(() => {
  const b = document.querySelector('.an-sheet__head .ui-more__button');
  if (!b) return null;
  b.click();
  return [...document.querySelectorAll('.an-sheet__head .ui-more__panel button')].map((x) => x.textContent.trim());
})()`);
/** Première entrée du menu « … » hors « Lieu » (le champ du lieu ouvre le menu, « Partager l'image » vient juste après). */
const premiereAction = (items) => items?.find((x) => x !== 'Lieu');
const openShare = async () => {
  const items = await menuItems();
  await evaluate(`[...document.querySelectorAll('.an-sheet__head .ui-more__panel button')].find((x) => x.textContent.trim() === "Partager l'image")?.click()`);
  return items;
};
/** Attend l'image à jour : bouton « Partager » de la fenêtre actif. */
const waitImage = async (ms = 20000) => {
  for (let t = 0; t < ms; t += 250) {
    const ready = await evaluate(`(() => {
      const img = document.querySelector('.share-dialog__preview img');
      const btn = [...document.querySelectorAll('.share-dialog__actions button')].find((b) => b.textContent.trim() === 'Partager');
      return Boolean(img && img.complete && img.naturalWidth > 0 && btn && !btn.disabled);
    })()`);
    if (ready) return true;
    await wait(250);
  }
  return false;
};
const imageSize = () => evaluate(`(() => { const i = document.querySelector('.share-dialog__preview img'); return i ? [i.naturalWidth, i.naturalHeight] : null; })()`);
const chips = () => evaluate(`[...document.querySelectorAll('.share-dialog .ui-tab')].map((b) => ({ label: b.textContent.trim(), on: b.getAttribute('aria-pressed') === 'true' }))`);
const pressChip = (label) => evaluate(`[...document.querySelectorAll('.share-dialog .ui-tab')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})?.click() ?? 'absent'`);
const saveImage = async (name) => {
  const data = await evaluate(`(async () => {
    const i = document.querySelector('.share-dialog__preview img');
    const blob = await (await fetch(i.src)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
    return btoa(s);
  })()`);
  if (shotDir && data) writeFileSync(`${shotDir}/${name}.png`, Buffer.from(data, 'base64'));
};
const generalStats = () => evaluate(`[...document.querySelectorAll('.an-sheet__stats--always .an-sheet__stat')]
  .map((s) => ({ label: s.querySelector('.an-sheet__stat-label').textContent.trim(), value: s.querySelector('.an-sheet__stat-value').textContent.trim() }))`);
/** L'image est en hauteur, 1080 × 1920, quel que soit le nombre de chiffres (`SHARE_IMAGE.widthPx`, `heightPx`). */
const isPortrait = (size) => size?.[0] === 1080 && size?.[1] === 1920;

// --- 2. Chaque analyse ---
for (const s of SESSIONS) {
  await go(paths[s.page], 7000);
  const items = await openShare();
  check(`${s.page} : « Partager » en tête du menu « … » (après « Lieu »)`, premiereAction(items) === "Partager l'image", JSON.stringify(items));
  check(`${s.page} : fenêtre ouverte`, Boolean(await evaluate(`document.querySelector('.share-dialog[role=dialog]') !== null`)));
  check(`${s.page} : aperçu dessiné`, await waitImage());
  // Relu une fois l'image prête.
  const general = await generalStats();
  const c = await chips();
  const sameLabels = c.length === s.share.length && s.share.every((l, k) => (typeof l === 'string' ? c[k].label === l : l.test(c[k].label)));
  check(`${s.page} : pastilles = chiffres de l'image`, sameLabels, c.map((x) => x.label).join(' | '));
  // L'essentiel de « général » se retrouve dans l'image (distance, temps, moyenne).
  const shared = general.filter((g) => g.value !== '—' && c.some((x) => x.label === g.label));
  check(`${s.page} : chiffres communs avec « général »`, shared.length >= 3, shared.map((g) => g.label).join(' | '));
  // Lignes ajoutées le 05/11 (lot 145) : sans appréciation donnée, pas de pastille « Appréciation » (« — » écarté).
  check(`${s.page} : pas d'« Appréciation » sans appréciation`, !c.some((x) => x.label === 'Appréciation'));
  check(`${s.page} : les six premières enfoncées`, c.filter((x) => x.on).length === Math.min(6, c.length) && c.slice(0, 6).every((x) => x.on));
  const size = await imageSize();
  check(`${s.page} : image en hauteur de 1080 × 1920`, isPortrait(size), JSON.stringify(size));
  await saveImage(`partage-${s.page}`);
  await shoot(`partage-fenetre-${s.page}`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await wait(300);
  check(`${s.page} : Échap ferme la fenêtre`, await evaluate(`document.querySelector('.share-dialog') === null`));
}

// --- 3. Choix en voile ---
await go(paths.voile, 7000);
await openShare();
await waitImage();
let c = await chips();
for (const label of c.filter((x) => x.on).slice(2).map((x) => x.label)) await pressChip(label);
await waitImage();
c = await chips();
check('voile : deux pastilles enfoncées', c.filter((x) => x.on).length === 2, c.filter((x) => x.on).map((x) => x.label).join(' | '));
check('voile : deux chiffres, image toujours en 1080 × 1920', isPortrait(await imageSize()), JSON.stringify(await imageSize()));
await evaluate(`document.querySelector('.share-dialog__check input').click()`);
await waitImage();
await saveImage('partage-voile-sans-carte');
const stored = await evaluate(`localStorage.getItem('${CLES.partage}')`);
console.log(`${CLES.partage} :`, stored);
const choix = JSON.parse(stored ?? '{}')[activityIds.voile] ?? {};
check(`voile : choix rangés sous l'activité (${activityIds.voile})`, choix.stats?.length === 2 && choix.map === false);

// Partage du navigateur, simulé : le fichier transmis.
await evaluate(`(() => {
  window.__partage = null;
  navigator.canShare = () => true;
  navigator.share = async (data) => { window.__partage = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size, title: data.title }; };
})()`);
await evaluate(`[...document.querySelectorAll('.share-dialog__actions button')].find((b) => b.textContent.trim() === 'Partager').click()`);
await wait(500);
const shared = await evaluate('window.__partage');
console.log('partagé :', JSON.stringify({ name: shared?.name, type: shared?.type, title: shared?.title }));
check('voile : PNG transmis au partage, nommé d\'après la session', shared?.type === 'image/png' && /^2026-09-20 .+\.png$/.test(shared?.name ?? '') && shared.size > 10_000);

// Sans partage : téléchargement et message.
await evaluate(`navigator.canShare = () => false`);
await evaluate(`[...document.querySelectorAll('.share-dialog__actions button')].find((b) => b.textContent.trim() === 'Partager').click()`);
await wait(500);
const note = await evaluate(`document.querySelector('.share-dialog [role=status]')?.textContent ?? ''`);
check('voile : sans partage, l\'image est téléchargée', note.includes('téléchargée'), note);

// Réouverture : choix retrouvés.
await go(paths.voile, 7000);
await openShare();
await waitImage();
c = await chips();
check('voile : choix retrouvés à la réouverture', c.filter((x) => x.on).length === 2
  && !(await evaluate(`document.querySelector('.share-dialog__check input').checked`)));

// --- 4. Téléphone ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(paths.voile, 7000);
await openShare();
check('390×844 : aperçu dessiné', await waitImage());
const fit = await evaluate(`(() => {
  const r = document.querySelector('.share-dialog').getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`);
check('390×844 : la fenêtre tient dans l\'écran', fit.left >= 0 && fit.right <= fit.w && fit.top >= 0 && fit.bottom <= fit.h && fit.over === 0, JSON.stringify(fit));
await shoot('partage-telephone');
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

// --- 5. Fin d'enregistrement ---
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await wait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
const replayPath = join(workDir, 'partage-rejeu.gpx');
writeFileSync(replayPath, traceVoile({ debutMs: Date.now() - 1800 * 1000, nom: 'Rejeu', bords: 1 }));
// Le choix de la voile posé à l'étape 3 est rangé sous « wingfoil », activité de la session importée et de l'enregistrement.
await go('/enregistrer', 4000);
console.log('famille :', await clickText('Avec vent', '[aria-label=Famille] button'));
await wait(300);
await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click()`);
await waitFor(`[...document.querySelectorAll('input[type=file]')].length > 0`, { timeout: 3000 });
await importFiles(replayPath, 'input[type=file][accept*=".gpx"]');
await waitFor(`[...document.querySelectorAll('select')].some((x) => [...x.options].some((o) => o.value === '600'))`, { timeout: 8000, label: 'menu de la vitesse' });
await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '600'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
console.log('Démarrer :', await clickText('Démarrer'));
await wait(6000);
console.log('Arrêter :', await holdStop());
// La fin de l'enregistrement range la session et ouvre son analyse ; « Partager l'image » est dans le « … » de l'analyse.
const opened = await attendreAnalyse(evaluate);
check("fin d'enregistrement : l'analyse s'ouvre seule", opened === 'ok', opened);
await settle({ max: 3000, label: 'analyse' });
const endMenu = await openShare();
check("fin d'enregistrement : « Partager l'image » en tête du « … » de l'analyse", premiereAction(endMenu) === "Partager l'image", JSON.stringify(endMenu));
check("fin d'enregistrement : aperçu dessiné", await waitImage());
check("fin d'enregistrement : image en hauteur de 1080 × 1920", isPortrait(await imageSize()), JSON.stringify(await imageSize()));
c = await chips();
console.log('pastilles :', c.map((x) => `${x.label}${x.on ? ' *' : ''}`).join(' | '));
check("fin d'enregistrement : chiffres du résumé", c.some((x) => x.label === 'Distance') && c.length >= 6, String(c.length));
check("fin d'enregistrement : choix de la voile repris (même activité)", c.filter((x) => x.on).length === choix.stats?.length
  && !(await evaluate(`document.querySelector('.share-dialog__check input').checked`)));
await saveImage('partage-enregistrement');
await shoot('partage-enregistrement-fenetre');
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await wait(300);

// --- 6. Itinéraire : l'image d'un parcours de trois balises, depuis Planifier puis depuis la liste ---
// Même fenêtre que la session, sans choix de chiffres : le fond de carte seul se règle. Écran d'ordinateur.
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
const logsAvantItineraire = logs.length;
const NOM_ITINERAIRE = 'Parcours banc';
const clickExact = (text, scope = 'button') => evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const tapMap = async (fx, fy) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.plan-map .leaflet-container').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  await mouse('mousePressed', r[0] + r[2] * fx, r[1] + r[3] * fy);
  await mouse('mouseReleased', r[0] + r[2] * fx, r[1] + r[3] * fy);
  await wait(300);
};
const planStat = (nom) => evaluate(`[...document.querySelectorAll('.plan-stat')].find((s) => s.querySelector('span')?.textContent === ${JSON.stringify(nom)})?.querySelector('strong')?.textContent ?? null`);
/** « Partager l'image » : le partage du navigateur est simulé, le fichier transmis est relevé. */
const simulerPartage = () => evaluate(`(() => {
  window.__partage = null;
  navigator.canShare = () => true;
  navigator.share = async (data) => { window.__partage = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size }; };
  return 'ok';
})()`);
const partagerImage = async () => {
  await simulerPartage();
  await evaluate(`[...document.querySelectorAll('.share-dialog__actions button')].find((b) => b.textContent.trim() === 'Partager').click()`);
  await wait(500);
  return evaluate('window.__partage');
};
const imageAlt = () => evaluate(`document.querySelector('.share-dialog__preview img')?.getAttribute('alt') ?? null`);
const echap = async () => {
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await wait(300);
};
const dialogueItineraire = async (etiquette) => {
  check(`itinéraire, ${etiquette} : fenêtre ouverte, aperçu dessiné`, Boolean(await evaluate(`document.querySelector('.share-dialog[role=dialog]') !== null`)) && await waitImage());
  check(`itinéraire, ${etiquette} : image en hauteur de 1080 × 1920`, isPortrait(await imageSize()), JSON.stringify(await imageSize()));
  const cases = await evaluate(`JSON.stringify({ pastilles: document.querySelectorAll('.share-dialog .ui-tab').length, cases: [...document.querySelectorAll('.share-dialog__check')].map((x) => x.textContent.trim()), choix: document.querySelectorAll('.share-dialog__label').length })`);
  check(`itinéraire, ${etiquette} : pas de cases de chiffres, la seule case « Fond de carte »`, JSON.parse(cases).pastilles === 0 && JSON.parse(cases).choix === 0 && JSON.stringify(JSON.parse(cases).cases) === '["Fond de carte"]', cases);
};

await go('/itineraires', 3000);
await evaluate(`localStorage.setItem('${CLES.planning}', JSON.stringify({ activityId: 'wingfoil' }));
  localStorage.setItem('${CLES.sections}', JSON.stringify({ planning: { parcours: true, trace: true, points: true, ranger: true, liste: true } })); 'ok'`);
await go('/itineraires', 3000);
await waitFor(`Boolean(document.querySelector('.plan-map .leaflet-container'))`, { timeout: 5000, every: 100, label: 'carte de Planifier' });
await tapMap(0.3, 0.3);
await tapMap(0.6, 0.35);
await tapMap(0.55, 0.7);
console.log('balises posées :', await planStat('Balises'), '| distance :', await planStat('Distance'));
await evaluate(`(() => { const i = document.querySelector('.plan-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(NOM_ITINERAIRE)}); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
console.log('Enregistrer :', await clickExact('Enregistrer'));
const rangeMsg = await waitFor(`[...document.querySelectorAll('.plan-note')].map((x) => x.textContent).find((t) => t.startsWith('Enregistré')) ?? null`, { timeout: 6000, every: 150, label: 'itinéraire enregistré' });
check('itinéraire de trois balises enregistré', typeof rangeMsg === 'string' && rangeMsg.startsWith('Enregistré'), String(rangeMsg));
const distancePage = await planStat('Distance');
check('trois balises posées, sans boucle', (await planStat('Balises')) === '3', String(await planStat('Balises')));

// Depuis le « … » du nom, dans Planifier.
await evaluate(`(() => { const b = document.querySelector('.plan-form .ui-more__button'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return 'ok'; })()`);
await wait(300);
const entreesPlan = await evaluate(`JSON.stringify([...document.querySelectorAll('.plan-form .ui-more__panel button')].map((x) => x.textContent.trim()))`);
console.log('« … » de l\'itinéraire :', entreesPlan);
check('itinéraire : « Partager l\'image » est la première entrée du « … » du nom', JSON.parse(entreesPlan)[0] === "Partager l'image", entreesPlan);
console.log('Partager l\'image :', await evaluate(`(() => { const b = [...document.querySelectorAll('.plan-form .ui-more__panel button')].find((x) => x.textContent.trim() === "Partager l'image"); if (!b || b.disabled) return 'absent'; b.click(); return 'ok'; })()`));
await dialogueItineraire('depuis Planifier');
const altPlan = await imageAlt();
console.log('alt :', altPlan);
// L'image décrit le parcours : trois balises, distances et caps de ses deux bords, le total de la page.
const altRe = new RegExp(`^Image de l'itinéraire « ${NOM_ITINERAIRE} », Wingfoil · itinéraire : Distance ([\\d,]+ km), Balises 3, Plus long bord ([\\d,]+ km)\\. Bords : 1 → 2 : ([\\d,]+ km) · (\\d+)° ; 2 → 3 : ([\\d,]+ km) · (\\d+)°\\.$`);
const altM = altRe.exec(altPlan ?? '');
check('itinéraire : l\'alt décrit le nom, l\'activité, les trois chiffres et les deux bords', Boolean(altM), String(altPlan));
check('itinéraire : la distance de l\'alt est celle de Planifier', altM?.[1] === distancePage, `${altM?.[1]} / ${distancePage}`);
check('itinéraire : le plus long bord est l\'un des deux bords', altM !== null && (altM[2] === altM[3] || altM[2] === altM[5]), String(altPlan));
await saveImage('partage-itineraire');
await shoot('partage-itineraire-fenetre');
const png = await partagerImage();
console.log('partagé :', JSON.stringify({ name: png?.name, type: png?.type }));
check('itinéraire : un PNG nommé d\'après l\'itinéraire est transmis au partage', png?.type === 'image/png' && png?.name === `${NOM_ITINERAIRE}.png` && png.size > 10_000, JSON.stringify({ name: png?.name, type: png?.type }));
// Sans fond de carte (la case se décoche), l'image change.
await evaluate(`document.querySelector('.share-dialog__check input').click()`);
await waitImage();
check('itinéraire : case « Fond de carte » décochée, image toujours en 1080 × 1920', isPortrait(await imageSize()) && !(await evaluate(`document.querySelector('.share-dialog__check input').checked`)), JSON.stringify(await imageSize()));
await saveImage('partage-itineraire-sans-fond');
await evaluate(`document.querySelector('.share-dialog__check input').click()`);
await waitImage();
await echap();
check('itinéraire : Échap ferme la fenêtre', await evaluate(`document.querySelector('.share-dialog') === null`));

// Depuis le « … » d'une ligne de la liste des itinéraires.
await go('/itineraires/liste', 3000);
await waitFor(`document.querySelectorAll('.route-list__item .ui-more__button').length > 0`, { timeout: 6000, every: 150, label: 'liste des itinéraires' });
console.log('« … » de la ligne :', await evaluate(`(() => { const b = document.querySelector('.route-list__item .ui-more__button'); b.click(); return 'ok'; })()`));
await wait(300);
const entreesListe = await evaluate(`JSON.stringify([...document.querySelectorAll('.route-list__item .ui-more__panel button')].map((x) => ({ texte: x.textContent.trim(), nom: x.getAttribute('aria-label') })))`);
console.log('entrées de la ligne :', entreesListe);
check('liste : la première entrée du « … » est « Partager l\'image », de nom « Partager l\'image de Parcours banc »',
  JSON.parse(entreesListe)[0]?.texte === "Partager l'image" && JSON.parse(entreesListe)[0]?.nom === `Partager l'image de ${NOM_ITINERAIRE}`, entreesListe);
await evaluate(`(() => { const b = [...document.querySelectorAll('.route-list__item .ui-more__panel button')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(`Partager l'image de ${NOM_ITINERAIRE}`)}); if (b) b.click(); return 'ok'; })()`);
await dialogueItineraire('depuis la liste');
const altListe = await imageAlt();
check('liste : l\'alt est le même que depuis Planifier', altListe === altPlan, String(altListe));
const pngListe = await partagerImage();
check('liste : un PNG nommé d\'après l\'itinéraire est transmis au partage', pngListe?.type === 'image/png' && pngListe?.name === `${NOM_ITINERAIRE}.png` && pngListe.size > 10_000, JSON.stringify({ name: pngListe?.name, type: pngListe?.type }));
await echap();
check('itinéraire : aucune erreur de console', logs.length === logsAvantItineraire, logs.slice(logsAvantItineraire).slice(0, 3).join(' | '));

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
console.log(failures === 0 ? '\nTout passe.' : `\n${failures} échec(s).`);
await close();
process.exit(failures === 0 ? 0 : 1);
