// Banc de test : onglet « cardio » et FC dans toutes les analyses (lot 7 des demandes du 10-13/10, étape analyse).
// Usage : node cardio.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Dure environ 2 min. Le script :
//  1. importe une wing en ligne droite avec une FC qui monte, une session de voile (`make-gpx.mjs`) et une session de
//     surf, toutes avec la FC (`gpxtpx:hr`), et une wing sans FC (la course de ces étapes est retirée au lot 303) ;
//  2. sans FC max ni âge : l'onglet « cardio » juste après celui des graphes, FC moyenne et max, pas de zones,
//     « La retenir » qui range la FC max de la sortie ; la wing sans FC n'a pas l'onglet ;
//  3. FC max et FC de repos saisies : le tableau des zones calées sur S1 et S2 (réserve cardiaque), « Voir » qui trace les passages
//     d'une zone sur la carte, effacés à la fermeture de l'onglet ;
//     un profil repris d'ailleurs, FC de repos écrite en texte (lot 150) : écartée, des zones plausibles ;
//     énergie estimée par la FC (lot 96) : sans poids ni âge, l'invite ; avec poids, année de naissance et sexe, la
//     tuile « Énergie estimée » (« env. … kcal », « dont env. … kcal au repos ») et son « ? » en voile et en surf ;
//     (dérive, nuage FC / vitesse et case « Zones », propres à la course, retirés au lot 303) ;
//  4. la courbe de FC dans l'onglet des graphes des trois modules ;
//  5. Réglages : « Seuils cardio » (S1 et S2, zones, Personnaliser, Revenir au calcul), la ligne « Seuils cardio »
//     de la carte d'une activité (−8 en voile), la case « Ceinture cardio » en voile et en surf, les chiffres
//     « FC moyenne » et « Zone cardiaque » proposés en voile ;
//  6. (retirée au lot 302 avec l'Entraînement : la FC par répétition de l'onglet « fractionné ») ;
//  7. la FC dans le résumé des fiches, et l'onglet « cardio » des statistiques ;
//  8. à 390×844 : l'analyse de la wing en ligne, onglet cardio ouvert, sans débordement.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node cardio.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, importGpx, records, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Navigation, puis attente du premier rendu de l'application : sous charge, `settle` seul peut rendre la main avant. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const overflow = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
const tabLabels = () => evaluate(`[...document.querySelectorAll('.an-carte-col .ui-tab')].map((t) => t.textContent.trim()).join(' | ')`);
const clickTab = (label, close = false) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  const isOpen = t.getAttribute('aria-pressed') === 'true';
  if (isOpen !== ${close}) return isOpen ? 'déjà ouvert' : 'déjà fermé';
  t.click(); return 'ok';
})()`);
const panel = (title) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}));
  return t ? t.closest('.an-carte-panels > *').innerText.replace(/\\n+/g, ' / ') : '(absent)';
})()`);
/** Graphes Recharts dans le panneau dont le titre commence ainsi. */
const chartsIn = (title) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(title)}));
  return t ? t.closest('.an-carte-panels > *').querySelectorAll('.recharts-surface').length : -1;
})()`);
/** Traits violets de surbrillance sur la carte. */
const violetPaths = () => evaluate(`document.querySelectorAll('.an-map-row path[stroke="#7b1fa2"]').length`);
const clickButton = (scopeTitle, label, nth = 0) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-panels [role=button]')].find((h) => h.textContent.trim().startsWith(${JSON.stringify(scopeTitle)}));
  const scope = t ? t.closest('.an-carte-panels > *') : null;
  const b = scope ? [...scope.querySelectorAll('button')].filter((x) => x.textContent.trim() === ${JSON.stringify(label)})[${nth}] : null;
  if (!b) return 'absent'; b.click(); return 'ok';
})()`);
const setRunner = (profile) => evaluate(`(() => { localStorage.setItem('tracker.runnerProfile', ${JSON.stringify(JSON.stringify({ me: profile }))}); return 'ok'; })()`);
const runner = () => evaluate(`JSON.parse(localStorage.getItem('tracker.runnerProfile') ?? '{}').me ?? null`);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `tracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork(['*://data.geopf.fr/*', '*://overpass-api.de/*', '*://*.openstreetmap.org/*', '*://brouter.de/*']);

// --- Sessions synthétiques ---
const lineGpx = (type, seconds, speedAt, t0) => {
  const lat = 43.7;
  const mPerDegLon = (Math.PI / 180) * 6371e3 * Math.cos((lat * Math.PI) / 180);
  const pts = [];
  let m = 0;
  for (let k = 0; k <= seconds; k++) {
    const v = speedAt(k);
    if (k > 0) m += v;
    pts.push(`<trkpt lat="${lat}" lon="${(3.85 + m / mPerDegLon).toFixed(7)}"><ele>${(50 + 0.02 * m).toFixed(1)}</ele><time>${new Date(t0 + k * 1000).toISOString()}</time><extensions><speed>${v}</speed></extensions></trkpt>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="banc" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Ligne</name><type>${type}</type><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>\n`;
};
const M_PER_DEG_LAT = 111_195;
const surfGpx = (startMs, phases) => {
  let lat = 43.4;
  let lon = 3.6;
  let t = 0;
  const pts = [];
  const push = (speed, heading) => pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${new Date(startMs + t * 1000).toISOString()}</time>`
    + `<extensions><speed>${speed}</speed>${speed > 0 ? `<course>${heading}</course>` : ''}</extensions></trkpt>`);
  push(0, 0);
  for (const [s, speed, heading = 0] of phases) {
    for (let k = 0; k < s; k++) {
      lat += (speed * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
      lon += (speed * Math.sin((heading * Math.PI) / 180)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
      t += 1;
      push(speed, heading);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="banc" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Matinée</name><type>surf</type><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>\n`;
};
const MORNING = [
  [60, 0], [60, 1.2], [50, 1], [4, 0.1], [40, 1], [4, 0.1], [26, 1], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1],
  [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1],
  [5, 1.6, 180], [8, 4.5, 190], [80, 1], [30, 0.1],
];
/** La FC `hrAt(k)` ajoutée au k-ième point, comme l'écrit l'enregistreur (`gpxtpx:hr`). */
const withHr = (gpx, hrAt) => {
  let k = 0;
  return gpx
    .replace('xmlns="http://www.topografix.com/GPX/1/1"', 'xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"')
    .replace(/<\/extensions><\/trkpt>/g, () => `<gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hrAt(k++))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
};
const voilePath = join(tmpdir(), 'cardio-voile.gpx');
execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'make-gpx.mjs'), voilePath]);

const T_WING = Date.UTC(2026, 9, 1, 8, 0, 0);
const T_PLAIN = Date.UTC(2026, 9, 4, 8, 0, 0);
const T_SURF = Date.UTC(2026, 9, 3, 7, 0, 0);
const T_VOILE = Date.UTC(2026, 8, 20, 13, 0, 0);
// Wing de 40 min en ligne droite à 6 m/s, FC de 130 à 172 : montée jusqu'en Z4 et Z5 (réserve 50-190).
const wingHr = (k) => 130 + (k / 2400) * 42;
const SESSIONS = [
  { key: 'wing', page: 'voile', start: T_WING, gpx: withHr(lineGpx('wingfoil', 2400, () => 6, T_WING), wingHr) },
  { key: 'sansfc', page: 'voile', start: T_PLAIN, gpx: lineGpx('wingfoil', 1200, () => 6, T_PLAIN) },
  { key: 'surf', page: 'surf', start: T_SURF, gpx: withHr(surfGpx(T_SURF, MORNING), (k) => 110 + 20 * Math.sin(k / 120)) },
  { key: 'voile', page: 'voile', start: T_VOILE, gpx: withHr(readFileSync(voilePath, 'utf8'), (k) => 120 + 25 * Math.sin(k / 300)) },
];

// --- 1. Import ---
const paths = {};
for (const s of SESSIONS) {
  await go(`/${s.page}`, 3000);
  console.log(`import ${s.key} :`, await importGpx(s.gpx, `${s.key}.gpx`));
  await waitFor(async () => (await records())?.some((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000), { timeout: 8000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  const rec = (await records()).find((r) => Math.abs((r.summary?.startMs ?? 0) - s.start) < 2000);
  paths[s.key] = `/${s.page}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
  check(`${s.key} rangée`, Boolean(rec));
}

// --- 2. Sans FC max ni âge ---
const GRAPH_TAB = { wing: 'graphiques', surf: 'graphiques', voile: 'graphiques' };
for (const key of ['wing', 'surf', 'voile']) {
  await go(paths[key], 6000);
  const labels = (await tabLabels()).split(' | ');
  const at = labels.indexOf('cardio');
  check(`${key} : « cardio » juste après « ${GRAPH_TAB[key]} » (${labels.join(', ')})`, at > 0 && labels[at - 1] === GRAPH_TAB[key]);
  console.log('  ouvre cardio :', await clickTab('cardio'));
  await settle({ max: 1500 });
  const text = await panel('Cardio');
  check(`${key} : FC moyenne et max`, /FC moyenne \/ \d+ bpm/.test(text) && /FC max \/ \d+ bpm/.test(text));
  check(`${key} : pas de zones, et la raison`, text.includes('Pour les zones d\'effort'));
  // Énergie estimée par la FC (lot 96) : profil vide, l'invite à la place de la tuile.
  check(`${key} : invite au poids et à l'année de naissance`,
    text.includes('renseignez votre poids et votre année de naissance') && !text.includes('Énergie estimée'), text.slice(0, 400));
  check(`${key} : courbe de FC`, (await chartsIn('Cardio')) >= 1);
}
await go(paths.wing, 6000);
const before = await panel('Cardio');
check('wing : FC max de la sortie proposée', before.includes('Aucune FC max') && before.toLowerCase().includes('la retenir'));
console.log('  La retenir :', await clickButton('Cardio', 'La retenir'));
await settle({ max: 800 });
const kept = await runner();
console.log('  pratiquant :', JSON.stringify(kept));
check('FC max rangée dans le profil (170 environ)', kept?.hrMax >= 165 && kept?.hrMax <= 175);
await go(paths.wing, 6000);
check('wing : la proposition disparaît', !(await panel('Cardio')).includes('La retenir'));
await go(paths.sansfc, 6000);
check(`wing sans FC : pas d'onglet cardio (${await tabLabels()})`, !(await tabLabels()).split(' | ').includes('cardio'));

// --- 3. Zones ---
await setRunner({ hrMax: 190, hrRest: 50 });
await go(paths.wing, 6000);
const zones = await panel('Cardio');
console.log('  cardio :', zones.slice(0, 1200));
// Seuils de la voile décalés de −8 (Réglages) : les chiffres viennent de la phrase, la source est vérifiée.
check('wing : tableau des zones, calées sur S1 et S2', ['sous Z1', 'Z1', 'Z2', 'Z3', 'Z4', 'Z5'].every((z) => zones.includes(z))
  && /Zones calées sur S1 \d+ et S2 \d+ bpm(?: \([^)]*pour cette activité\))?, tirés de la FC repos 50 \(saisie\) et de la FC max 190 \(saisie\)/.test(zones));
check('wing : charge', /Charge\s*\/ \d+/.test(zones));
await evaluate(`document.querySelector('button.ui-help--xs')?.click()`);
await wait(300);
const loadHelp = await panel('Cardio');
check('wing : « ? » de la charge, sous Z1 compté', loadHelp.includes("méthode d'Edwards") && /sous Z1 \(moins de \d+ bpm\) × 0,5/.test(loadHelp));
await evaluate(`document.querySelector('button.ui-help--xs')?.click()`);
const violetBefore = await violetPaths();
console.log('  Voir Z3 :', await clickButton('Cardio', 'Voir', 3));
await settle({ max: 1000 });
const violetShown = await violetPaths();
check(`wing : passages de Z3 sur la carte (${violetBefore} → ${violetShown})`, violetShown > violetBefore);
await shoot('cardio-wing');
console.log('  ferme cardio :', await clickTab('cardio', true));
await settle({ max: 800 });
check('wing : surbrillance effacée à la fermeture', (await violetPaths()) === violetBefore);
console.log('  rouvre cardio :', await clickTab('cardio'));
await settle({ max: 800 });
check('wing : surbrillance pas ramenée', (await violetPaths()) === violetBefore);

// --- 3 ter. Énergie estimée par la FC (lot 96) : poids, année de naissance et sexe saisis ---
const beforeEnergy = await runner();
await setRunner({ ...beforeEnergy, weightKg: 75, birthYear: 1986, sex: 'm' });
const ENERGY_TILE = /Énergie estimée\s*\/ env\. \d+ kcal dont env\. \d+ kcal au repos/;
const ENERGY_HELP = 'button.ui-help[aria-label="Aide : Énergie estimée"]';
for (const key of ['voile', 'surf']) {
  await go(paths[key], 8000);
  await clickTab('cardio');
  await settle({ max: 1500 });
  const text = await panel('Cardio');
  const tile = text.match(/Énergie estimée[^/]*\/ [^/]*/)?.[0] ?? '(sans tuile)';
  console.log(`  ${key}, énergie :`, tile);
  check(`${key} : tuile « Énergie estimée » (${tile})`, ENERGY_TILE.test(text) && !text.includes('renseignez votre poids'), text.slice(0, 400));
  if (key === 'voile') {
    // 1 h 02 de FC autour de 120 bpm, homme de 75 kg, 40 ans : env. 650 kcal (diagnostic du lot 96).
    const value = Number(tile.match(/env\. (\d+) kcal/)?.[1]);
    check(`voile : ordre de grandeur de Keytel (${value} kcal, 600 à 700 attendus)`, value >= 600 && value <= 700);
    console.log('  ? énergie :', await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(ENERGY_HELP)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
    await wait(300);
    check("voile : « ? » de l'énergie estimée", (await panel('Cardio')).includes("C'est un ordre de grandeur, pas une mesure : comptez 25 % d'écart"));
    await evaluate(`document.querySelector(${JSON.stringify(ENERGY_HELP)})?.click()`);
  }
}
await setRunner(beforeEnergy);

// --- 4. Courbe dans les graphes ---
await go(paths.wing, 6000);
console.log('  graphiques :', await clickTab('graphiques'));
await settle({ max: 1500 });
check('wing : « Fréquence cardiaque » dans graphiques', (await panel('Graphiques')).toLowerCase().includes('fréquence cardiaque'));
await go(paths.sansfc, 6000);
await clickTab('graphiques');
await settle({ max: 1500 });
check('wing sans FC : pas de « Fréquence cardiaque » dans graphiques', !(await panel('Graphiques')).toLowerCase().includes('fréquence cardiaque'));
await go(paths.surf, 6000);
await clickTab('graphiques');
await settle({ max: 1500 });
check(`surf : vitesse et FC (${await chartsIn('Vitesse')})`, (await chartsIn('Vitesse')) === 2);
await go(paths.voile, 8000);
await clickTab('graphiques');
await settle({ max: 1500 });
check('voile : « Fréquence cardiaque » dans graphiques', (await panel('Graphiques')).toLowerCase().includes('fréquence cardiaque'));
await shoot('cardio-voile');

// --- Profil repris d'un autre appareil, FC de repos écrite en texte : écartée, jamais concaténée (lot 150) ---
const cleanRunner = await runner();
await setRunner({ ...cleanRunner, hrRest: '50' });
await go(paths.wing, 6000);
await clickTab('cardio');
await settle({ max: 1500 });
const textRest = await panel('Cardio');
const [, textS1, textS2] = textRest.match(/S1 (\d+) et S2 (\d+) bpm/) ?? [];
check(`FC de repos en texte : zones plausibles (S1 ${textS1}, S2 ${textS2})`, Number(textS1) > 60 && Number(textS2) <= 190 && Number(textS1) < Number(textS2), textRest.slice(0, 300));
check('FC de repos en texte : écartée de la phrase des zones', !textRest.includes('FC repos 50'), textRest.slice(0, 300));
await setRunner(cleanRunner);

// --- 5. Réglages ---
const openSettings = async () => {
  await go('/parametres', 3000);
  await evaluate(`(() => {
    const sections = JSON.parse(localStorage.getItem('tracker.sections') ?? '{}');
    sections.settings = { ...sections.settings, activites: true, coureur: true };
    sections['settings-activities'] = { wingfoil: true, surf: true };
    sections['settings-families'] = { voile: true, surf: true };
    sections['settings-activity-parts'] = { enregistrement: true, analyse: true };
    localStorage.setItem('tracker.sections', JSON.stringify(sections));
    return 'ok';
  })()`);
  await go('/parametres', 3000);
};
await openSettings();
// La méthode de calcul est dans l'aide des zones, sous son « ? » (lot 3 des demandes du 19/10).
await evaluate(`[...document.querySelectorAll('button.ui-help[aria-label="Aide : Seuils cardio"]')].find((b) => !b.closest('.settings-activity'))?.click()`);
await wait(200);
const zonesRow = () => evaluate(`(() => {
  const l = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Seuils cardio' && !s.closest('.settings-activity'));
  return l ? l.parentElement.parentElement.innerText.replace(/\\n+/g, ' / ') : '(absent)';
})()`);
const row = await zonesRow();
console.log('  zones :', row);
check('Réglages : seuils et zones calculés en réserve cardiaque', row.includes('S1 148 · S2 169 bpm') && row.includes('Z1 ≥ 114') && row.includes('Z5 ≥ 174')
  && row.includes('réserve cardiaque'));
console.log('  Personnaliser :', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Personnaliser'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(500);
check('Réglages : deux champs, seuils rangés', (await evaluate(`[...document.querySelectorAll('label span')].filter((s) => /^S[12], seuil/.test(s.textContent)).length`)) === 2
  && JSON.stringify((await runner())?.hrThresholds) === JSON.stringify([148, 169]));
console.log('  Revenir au calcul :', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Revenir au calcul'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
await wait(500);
check('Réglages : seuils de nouveau calculés', (await runner())?.hrThresholds === null);
const nameSelector = '.settings-activity__name';
const card = (name) => `[...document.querySelectorAll('.settings-activity')].find((c) => c.querySelector(${JSON.stringify(nameSelector)})?.textContent === ${JSON.stringify(name)})`;
const offsetPlaceholder = (name) => evaluate(`(() => {
  const l = [...(${card(name)}?.querySelectorAll('.settings-row__label') ?? [])].find((x) => x.textContent.trim() === 'Seuils cardio');
  return l ? l.closest('.settings-row')?.querySelector('input')?.placeholder ?? '(sans champ)' : '(absent)';
})()`);
for (const [name, expected] of [['Voile', '-8'], ['Surf', '-10']]) {
  const got = await offsetPlaceholder(name);
  check(`Réglages, ${name} : « Seuils cardio » décalés de ${expected} par défaut (${got})`, got === expected);
}
for (const name of ['Voile', 'Surf']) {
  check(`Réglages, ${name} : case « Ceinture cardio »`, Boolean(await evaluate(`[...(${card(name)}?.querySelectorAll('.settings-row__label') ?? [])].some((l) => l.textContent.trim() === 'Ceinture cardio')`)));
}
const voileOptions = await evaluate(`[...(${card('Voile')}?.querySelectorAll('select[aria-label="Ligne 1"] option') ?? [])].map((o) => o.textContent.trim())`);
check('Réglages, Voile : « Fréquence cardiaque », « FC moyenne » et « Zone cardiaque » proposés', ['Fréquence cardiaque', 'FC moyenne', 'Zone cardiaque'].every((o) => voileOptions?.includes(o)));

// --- 7. Résumé et statistiques ---
const recs = await records();
const wingRec = recs.find((r) => Math.abs((r.summary?.startMs ?? 0) - T_WING) < 2000);
const plainRec = recs.find((r) => Math.abs((r.summary?.startMs ?? 0) - T_PLAIN) < 2000);
console.log('  résumé de la wing :', JSON.stringify({ ...wingRec?.summary?.heartRate, histogram: undefined }));
check('résumé : FC de la wing (calcVersion 4 ou plus)', wingRec?.summary?.calcVersion >= 4 && wingRec?.summary?.heartRate?.avgBpm > 140);
check('résumé : rien pour la wing sans FC', plainRec && plainRec.summary.heartRate === undefined);
await go('/statistiques', 5000);
console.log('  statistiques, onglets :', await evaluate(`[...document.querySelectorAll('.stats-col .ui-tab')].map((t) => t.textContent.trim()).join(' | ')`));
console.log('  ouvre cardio :', await evaluate(`(() => { const t = [...document.querySelectorAll('.stats-col .ui-tab')].find((x) => x.textContent.trim() === 'cardio'); if (!t) return 'absent'; if (t.getAttribute('aria-pressed') !== 'true') t.click(); return 'ok'; })()`));
await settle({ max: 1500 });
const statsText = await evaluate(`(() => {
  const t = [...document.querySelectorAll('.stats-panels [role=button]')].find((h) => h.textContent.trim().startsWith('Cardio'));
  return t ? t.closest('.stats-panels > *').innerText.replace(/\\n+/g, ' / ') : '(absent)';
})()`);
console.log('  cardio :', statsText.slice(0, 400));
// La voile de `make-gpx.mjs` n'a pas de `<type>` : à classer, elle n'entre pas dans les statistiques.
check('statistiques : 2 sessions avec FC sur 3 (la voile est à classer)', statsText.includes('Sessions avec FC / 2 / 3'));
check('statistiques : charge, temps par zone, charge par semaine, FC par session',
  statsText.includes('Charge') && statsText.includes('Temps par zone') && statsText.includes('Charge par') && statsText.includes('FC moyenne par session'));
check('statistiques : deux graphes', (await evaluate(`(() => {
  const t = [...document.querySelectorAll('.stats-panels [role=button]')].find((h) => h.textContent.trim().startsWith('Cardio'));
  return t ? t.closest('.stats-panels > *').querySelectorAll('.recharts-surface').length : -1;
})()`)) === 2);
await shoot('cardio-statistiques');

// --- 8. Téléphone ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await go(paths.wing, 6000);
await clickTab('cardio');
await settle({ max: 1500 });
check(`à 390 px, wing onglet cardio : débordement ${await overflow()}`, (await overflow()) === 0);
await shoot('cardio-telephone');

console.log('\n--- console (erreurs, avertissements) ---');
logs.forEach((l) => console.log(l));
await finish('\nTout passe.', { ko: (n) => `\n${n} échec(s).` });
