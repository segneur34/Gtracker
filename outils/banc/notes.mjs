// Banc de test : bouton « Note » de l'enregistrement et repères dans l'analyse (lot 3 des demandes du 10-14/10).
// Usage : node notes.mjs <port> <dossier de travail> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 2 min, 20 s avec `TEMPS=10` (horloge de la page accélérée). Pour chaque
// famille (Voile, Surf), le script :
//  1. à 390×844, lance un rejeu ×1 d'une trace datée de maintenant, pose deux notes (« Note N posée », vibreur
//     relevé dans la console), vérifie que la page ne déborde pas, arrête et analyse ;
//  2. dans l'analyse : deux fanions sur la carte, la liste de « Général », « Voir » (fanion violet), un trait
//     par repère sur les graphes, deux repères dans la fiche ;
//  3. en Voile seulement : nomme la note 1, supprime la note 2, « Enregistrer la session », relit la fiche,
//     recharge la page (la liste garde « Saut »), puis à 1400×1000.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, diag, DOSSIER_MEMOIRE, TEMPS } from './lib/cdp.mjs';
import { attendreAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceDroite } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node notes.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, vwait, blockNetwork, importFiles, shoot, check, finish, logs, onMessage } = await connect({ port, shotDir });
/** Heure de la page (accélérée par `TEMPS`, lib/horloge.mjs), en ms. */
const pageNow = () => evaluate('Date.now()');
/** Attend que l'heure de la page atteigne `t` : les allers-retours du script, `TEMPS` fois plus longs pour la page, ne s'ajoutent pas. */
const jusqua = async (t) => { const now = await pageNow(); if (t > now) await vwait(t - now); };
const sounds = [];
onMessage((msg) => {
  if (msg.method !== 'Runtime.consoleAPICalled') return;
  const text = msg.params.args.map((a) => a.value ?? a.description).join(' ');
  if (msg.params.type === 'debug' && /^\[bips\]/.test(text)) sounds.push(text);
});
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await vwait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
const clickText = (text, selector = 'button') => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return 'absent'; if (b.disabled) return 'désactivé'; b.click(); return 'ok';
})()`);
const clickLabel = (label) => evaluate(`(() => { const b = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const typeInto = (label, value) => evaluate(`(() => {
  const i = document.querySelector('input[aria-label=${JSON.stringify(label)}]');
  if (!i) return 'absent';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return i.value;
})()`);
const setFile = (selector, file) => importFiles(file, selector);
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
const noteButton = () => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Note|^Pas encore/.test(x.textContent.trim())); return b ? b.textContent.trim() : '(absent)'; })()`);
const flags = () => evaluate(`[...document.querySelectorAll('.an-map-panel .leaflet-marker-icon')].filter((m) => /^\\d+$/.test(m.textContent.trim())).map((m) => m.textContent.trim() + (m.innerHTML.includes('#7b1fa2') ? ' (violet)' : '')).join(', ') || '(aucun)'`);
const marksList = () => evaluate(`(() => { const l = document.querySelector('.an-marks'); return l ? [...l.querySelectorAll('input')].map((i) => i.closest('div').innerText.replace(/\\n+/g, ' ') + ' [' + (i.value || i.placeholder) + ']').join(' | ') : '(pas de liste)'; })()`);
const refLines = () => evaluate(`document.querySelectorAll('.recharts-reference-line').length`);
/**
 * Bulle d'un fanion (lot 189, cartes sans react-leaflet) : clic sur le fanion `n` de la carte, arrêté à la carte pour
 * que son cadre ne l'agrandisse pas (téléphone) ; texte de la bulle, heure masquée (elle suit l'heure du passage).
 */
const flagPopup = async (n) => {
  const clic = await evaluate(`(() => {
    const flag = [...document.querySelectorAll('.an-map-panel .leaflet-marker-icon')].find((m) => m.textContent.trim() === ${JSON.stringify(String(n))});
    if (!flag) return 'absent';
    flag.closest('.leaflet-container').addEventListener('click', (e) => e.stopPropagation(), { once: true });
    const r = flag.getBoundingClientRect();
    flag.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    return 'ok';
  })()`);
  await settle({ max: 1000, label: 'bulle' });
  const text = await evaluate(`document.querySelector('.an-map-panel .leaflet-popup-content')?.textContent ?? '(aucune bulle)'`);
  return `${clic} → ${text.replace(/ · .*$/, ' · (heure)')}`;
};
const records = () => evaluate(`(async () => {
  const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions');
  const list = [];
  for await (const [name, h] of dir.entries()) if (name.endsWith('.json')) list.push({ name, record: JSON.parse(await (await h.getFile()).text()) });
  return list;
})()`);
const openTab = (label) => evaluate(`(() => { const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!t) return 'absent'; if (t.getAttribute('aria-pressed') !== 'true' && t.getAttribute('aria-selected') !== 'true') t.click(); return 'ok'; })()`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['*://*.openstreetmap.org/*']);

/** Trace de 30 s datée de `t0` (l'heure de la page), à `speedMs`, pour un rejeu ×1 (`traceDroite`, `lib/traces.mjs`). */
const replayGpx = (family, speedMs, t0) => {
  const path = join(workDir, `notes-${family}.gpx`);
  writeFileSync(path, traceDroite({ debutMs: t0, secondes: 30, vitesse: speedMs, type: family === 'Sans vent' ? 'surf' : 'wingfoil', nom: 'Rejeu', lat0: 43.55, lon0: 3.9 }));
  return path;
};

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await go('/enregistrer', 4000);

for (const [family, speedMs, graphTab] of [['Avec vent', 8, 'graphiques'], ['Sans vent', 4, 'graphiques']]) {
  console.log(`\n=== ${family} ===`);
  await go('/enregistrer');
  console.log('famille :', await clickText(family, '[aria-label=Famille] button'));
  await wait(300);
  await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
  await wait(300);
  await setFile('input[type=file][accept*=".gpx"]', replayGpx(family, speedMs, await pageNow()));
  await wait(500);
  await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '1'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  const repos = await noteButton();
  console.log('bouton Note au repos :', repos);
  check(`${family} : pas de bouton « Note » avant le départ`, repos === '(absent)', repos);
  // Les notes tombent à heure fixe du rejeu, 5,25 s et 16,5 s après le premier point, au milieu des plages où les anciens
  // sommeils les posaient (la distance affichée change à 5 s, 5,6 s, 16,25 s et 16,9 s selon la vitesse ; relevé du
  // 29/10). Le rejeu part environ 30 ms de vrai temps après l'heure lue avant « Démarrer », `TEMPS` fois plus pour la page.
  const demarre = (await pageNow()) + 30 * TEMPS;
  console.log('Démarrer :', await clickText('Démarrer'));
  await jusqua(demarre + 5250);
  const before = sounds.length;
  const note1 = await pageNow();
  console.log('Note :', await clickText('Note'), '→', await noteButton());
  const posee1 = await noteButton();
  console.log('vibreur :', sounds.slice(before).join(' | ') || '(rien)');
  check(`${family} : « Note 1 posée » et un coup de vibreur`, posee1 === 'Note 1 posée' && sounds.slice(before).some((t) => t.includes('vibreur')), `${posee1} ; ${sounds.slice(before).join(' | ')}`);
  await shoot(`notes-${family}-enregistrer`);
  const debordement = await overflow();
  console.log('débordement à 390 px :', debordement);
  check(`${family} : Enregistrer ne déborde pas à 390 px`, debordement <= 0, String(debordement));
  await jusqua(note1 + 3500);
  const revenu = await noteButton();
  console.log('retour revenu à :', revenu);
  check(`${family} : le bouton revient à « Note »`, revenu === 'Note', revenu);
  await jusqua(demarre + 16_520);
  const note2 = await pageNow();
  console.log('Note :', await clickText('Note'), '→', await noteButton());
  const posee2 = await noteButton();
  check(`${family} : « Note 2 posée »`, posee2 === 'Note 2 posée', posee2);
  await jusqua(demarre + 20_520);
  console.log('Arrêter :', await holdStop());
  await vwait(2500);
  const ouverte = await attendreAnalyse(evaluate);
  console.log('analyse ouverte seule (lot 313) :', ouverte);
  check(`${family} : à l'arrêt, l'analyse s'ouvre seule`, ouverte === 'ok', ouverte);
  // L'analyse se calcule en vrai temps : l'adresse de l'analyse, puis une page immobile.
  await waitFor(`location.pathname.endsWith('/analyse')`, { timeout: 6000, label: 'analyse' });
  await settle({ max: 6000, label: 'analyse' });
  console.log('page :', await evaluate('location.pathname + location.search'));
  const fanions = await flags();
  const liste = await marksList();
  console.log('fanions :', fanions);
  console.log('liste :', liste);
  check(`${family} : deux fanions numérotés 1 et 2 sur la carte`, fanions === '1, 2' && !fanions.includes('(violet)'), fanions);
  check(`${family} : la liste de « Général » porte deux repères`, liste.split(' | ').filter(Boolean).length === 2, liste);
  console.log('Voir :', await clickText('Voir', '.an-marks button'), '| fanions :', await flags());
  check(`${family} : « Voir » : le fanion est violet`, (await flags()).includes('(violet)'), await flags());
  console.log(`onglet ${graphTab} :`, await openTab(graphTab));
  await settle({ max: 1500, label: graphTab });
  const traits = await refLines();
  console.log('traits des graphes :', traits);
  check(`${family} : un trait par repère sur les graphes`, traits >= 2, String(traits));
  await shoot(`notes-${family}-analyse`);
  const recs = await records();
  const rec = recs.map((r) => r.record).sort((a, b) => b.summary.startMs - a.summary.startMs)[0];
  diag(`notes ${family} : repères à ${rec?.marks?.map((m) => m.timeMs - rec.summary.startMs).join(', ')} ms du premier point ; Note cliquée à Démarrer + ${note1 - demarre} et + ${note2 - demarre} (page)`);
  check(`${family} : deux repères dans la fiche, de la bonne famille`, rec?.marks?.length === 2 && rec?.sport === (family === 'Sans vent' ? 'surf' : 'wingfoil'), `${rec?.sport} ${rec?.marks?.length}`);
  console.log('fiche :', rec ? `${rec.sport}, ${rec.marks?.length ?? 0} repères (${rec.marks?.map((m) => `${new Date(m.timeMs).toISOString().slice(11, 19)} ${m.label}`).join(', ')})` : '(aucune)');
  const bulle = await flagPopup(1);
  console.log('bulle du fanion 1 :', bulle);
  check(`${family} : la bulle du fanion 1 s'ouvre`, bulle.startsWith('ok') && !bulle.includes('(aucune bulle)'), bulle);

  if (family !== 'Avec vent') continue;
  // Nommer, supprimer, enregistrer.
  const analysis = await evaluate('location.pathname + location.search');
  console.log('nom :', await typeInto('Nom de la note 1', 'Saut'));
  console.log('supprimer la note 2 :', await clickLabel('Supprimer la note 2'));
  await wait(300);
  console.log('barre :', await evaluate(`document.querySelector('.an-save-bar, .session-save-bar')?.innerText.replace(/\\n+/g, ' ') ?? [...document.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer la session')?.closest('div')?.innerText.replace(/\\n+/g, ' ') ?? '(absente)'`));
  console.log('Enregistrer la session :', await clickText('Enregistrer la session'));
  await wait(1500);
  const saved = (await records()).find((r) => r.record.marks?.some((m) => m.label === 'Saut'))?.record;
  console.log('fiche après :', saved ? saved.marks.map((m) => m.label).join(', ') : '(nom absent)');
  check('Voile : nom gardé et note 2 supprimée dans la fiche', saved?.marks?.length === 1 && saved.marks[0].label === 'Saut', saved ? saved.marks.map((m) => m.label).join(', ') : '(nom absent)');
  await go(analysis, 4000);
  const rechargee = await marksList();
  console.log('après rechargement, liste :', rechargee, '| fanions :', await flags());
  check('Voile : après rechargement, la liste garde « Saut »', rechargee.includes('Saut') && rechargee.split(' | ').filter(Boolean).length === 1, rechargee);
    await go(analysis, 4000);
  console.log('à 1400 px, liste :', await marksList(), '| débordement :', await overflow());
  await shoot('notes-voile-ordinateur');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
}

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
await finish();
