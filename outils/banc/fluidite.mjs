// Banc de test : fluidité au téléphone, mesurée. Une mesure, pas une preuve de neutralité : les durées changent à
// chaque passage (`sansCache` du registre), elles sont en secondes (le masque commun `N ms` les effacerait) et se
// lisent à l'œil, à vitesse normale puis processeur ralenti six fois (`Emulation.setCPUThrottlingRate`, comme un
// Android moyen) ; chaque mesure est prise plusieurs fois, médiane retenue. Les `check` disent seulement que la
// mesure a eu lieu (la session s'ouvre, chaque chiffre est fini et positif), jamais qu'un temps est tenu.
// Usage : node fluidite.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Variables : `FLUIDITE_MESURES=ouverture,quitter,seuil,zoom,resumes,demarrage`
// (sous-ensemble ; `analyser` s'y ajoute à la demande), `FLUIDITE_REPS=2` (prises par mesure, la plus haute des deux
// retenue), `FLUIDITE_REPS_LONGUES=1` (prises du zoom et du démarrage, longs sous ralenti), `FLUIDITE_PROFIL=1` (une prise de plus sous le
// profileur à chaque mesure, qui dit où le temps part), `FLUIDITE_HEURES=1` (durée de la longue
// session, à 5 Hz), `FLUIDITE_RESUMES=12` (sessions d'une heure de la mesure des résumés), `FLUIDITE_RALENTI=1,6`
// (facteurs du processeur), `FLUIDITE_ZOOM=voile-tel,surf-tel` (variantes du zoom ; `voile-pc` à la demande). Le script :
//  1. écrit (`traceLongue` et `traceVoile` de `lib/traces.mjs`) une longue session de wingfoil à 5 Hz, une courte, et
//     `FLUIDITE_RESUMES` sessions d'une heure à 1 Hz, et les importe par la page ; pour le zoom, une longue session
//     de wingfoil avec FC et un surf de 2 h avec FC ;
//  2. ouverture de la longue session depuis la bibliothèque (navigation dans la page, comme au téléphone : les modules
//     sont déjà chargés) : temps jusqu'au titre, jusqu'à la trace sur la carte, jusqu'aux chiffres de « général » ;
//     plus longue tâche bloquante et total bloqué (tâches de plus de 50 ms, `PerformanceObserver` longtask) ; durée
//     de `DOMParser.parseFromString` (lecture du GPX) ; une prise de plus sous le profileur (`Profiler.start`) pour dire
//     où le temps part, par fonction ;
//  2 bis. quitter : la longue session ouverte depuis la bibliothèque, retour à la bibliothèque 100 ms plus tard, avant
//     que sa lecture ne finisse ; tâches longues de la page suivante, nombre et durée des `DOMParser` (attendu : aucun,
//     la lecture abandonnée), et si « Lecture de la session… » a paru entre-temps ;
//  3. seuil d'activité changé dans l'onglet réglages de cette analyse : temps jusqu'aux chiffres refaits, jusqu'au calme
//     du DOM, tâches longues ;
//  4. zoom d'un graphe, par variante : `voile-pc`, la longue voile avec FC à 1400 px, au double-clic de
//     `lib/graphes.mjs` ; à 390×844 et au vrai pincement à deux doigts (`pinch`) : `voile-tel`, cette voile (onglets
//     graphiques, vent et vmg) ; `surf-tel`, un surf de 2 h avec FC. Script par geste (`Performance.getMetrics`), images
//     par seconde, image la plus longue, tâches longues, et par graphe les segments des courbes et les `<stop>` du
//     dégradé, avant et après le geste. Avec un dossier de captures : le panneau « Graphiques » entier, puis zoomé ×2
//     (`zoom-<variante>-entier`, `-zoome`) ;
//  5. mise à jour des résumés : les fiches des sessions d'une heure sont marquées d'une version de calcul antérieure
//     (cache des fiches effacé), la page est relancée sur l'ouverture de l'application, le Profil ; temps jusqu'aux résumés refaits, tâches longues,
//     et la latence d'un mouvement de souris envoyé toutes les 300 ms pendant ce temps (la page répond-elle ?) ; une
//     prise de plus sous le profileur ;
//  6. démarrage : du chargement de `/` au Profil rendu (en-tête `.profile-head__title`), puis au premier répit d'une seconde sans tâche longue
//     (« interactif »), tâches longues et modules chargés sur 8 s ; avec le préchargement des pages
//     (`preloadPages` d'`App.tsx`), puis sans (`requestIdleCallback` neutralisé depuis le script, rien dans `src/`) ;
//  7. fin d'enregistrement (« analyser », hors de la liste par défaut, `FLUIDITE_MESURES=analyser`) : enregistrement
//     rejoué à ×600 (voile et surf d'une heure à 1 Hz), ralenti posé juste avant l'arrêt. L'arrêt range la session et
//     ouvre l'analyse seul : le temps part de l'arrêt (fin des 2 s tenues sur « Arrêter ») et comprend la construction
//     du GPX ; « Rangement… » peint, calcul au worker, première écriture, écritures, navigation, titre, trace,
//     chiffres, tâches longues par phase.
// Fin : un tableau des médianes (PC ×1 et ×6), à recopier dans le relevé.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, CLES, connect, DOSSIER_MEMOIRE } from './lib/cdp.mjs';
import { CHART, SCOPE, graphGestures } from './lib/graphes.mjs';
import { bruitDeGraine, traceLongue, traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node fluidite.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}
const MESURES = (process.env.FLUIDITE_MESURES ?? 'ouverture,quitter,seuil,zoom,resumes,demarrage').split(',').map((m) => m.trim());
const REPS = Math.max(1, Number(process.env.FLUIDITE_REPS ?? 2) || 2);
/** Prises du zoom (un pincement dure 25 s sous ralenti sur une longue voile) et du démarrage (fenêtre de 8 s par prise) : une seule par défaut. */
const REPS_LONGUES = Math.max(1, Number(process.env.FLUIDITE_REPS_LONGUES ?? 1) || 1);
/** Fenêtre du démarrage, en secondes. */
const FENETRE_S = 8;
const RATES = (process.env.FLUIDITE_RALENTI ?? '1,6').split(',').map((r) => Number(r)).filter((r) => r >= 1);
/** Une prise de plus sous le profileur à chaque mesure, qui dit où le temps part par fonction : longue, donc à la demande. */
const PROFIL = process.env.FLUIDITE_PROFIL === '1';
const DEPART = Date.now();
/** Minutes écoulées depuis le début de la mesure, en tête de chaque section. */
const minutes = () => `${((Date.now() - DEPART) / 60000).toFixed(1).replace('.', ',')} min`;

const b = await connect({ port, width: 1400, height: 1000 });
const { send, evaluate, go, settle, waitFor, wait, blockNetwork, importFiles, records, logs, check, finish } = b;
const { doubleClick, doubleTap, pinch } = graphGestures(b);
await blockNetwork();
await send('Performance.enable');
await send('Profiler.enable');
await send('Profiler.setSamplingInterval', { interval: 500 });

// Script de page : tâches longues (API Long Tasks), durée de chaque `DOMParser.parseFromString`, latence des entrées
// (heure du traitement moins heure de l'événement), instant du premier rendu du Profil.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const f = { longtasks: [], domparser: [], inputs: [], homeAt: null };
  Object.defineProperty(window, '__fluidite', { value: f, enumerable: false });
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) f.longtasks.push({ start: e.startTime, duration: e.duration }); })
      .observe({ type: 'longtask', buffered: true });
  } catch {}
  const parse = DOMParser.prototype.parseFromString;
  DOMParser.prototype.parseFromString = function (text, type) {
    const t = performance.now();
    const doc = parse.call(this, text, type);
    f.domparser.push({ start: t, duration: performance.now() - t, size: typeof text === 'string' ? text.length : 0 });
    return doc;
  };
  for (const type of ['mousemove', 'click']) document.addEventListener(type, (e) => { f.inputs.push({ type, at: performance.now(), delay: performance.now() - e.timeStamp }); }, true);
  const mo = new MutationObserver(() => {
    if (f.homeAt === null && document.querySelector('.profile-head__title')) { f.homeAt = performance.now(); mo.disconnect(); }
  });
  mo.observe(document, { subtree: true, childList: true });
})();` });

// --- Outils ---
const sec = (ms) => (ms == null || Number.isNaN(ms) ? '—' : `${(ms / 1000).toFixed(ms < 10000 ? 3 : 1).replace('.', ',')} s`);
const median = (list) => {
  const v = list.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((m) => [m.name, m.value]));
const throttle = (rate) => send('Emulation.setCPUThrottlingRate', { rate });
/** Tâches longues de la page entre `t0` et `t1` (heure de la page), bornées à la fenêtre : max, total, nombre, fin de la dernière. */
const longTasks = async (t0, t1) => {
  const list = (await evaluate(`JSON.stringify(window.__fluidite.longtasks.filter((t) => t.start + t.duration > ${t0} && t.start < ${t1}))`)) ?? '[]';
  const tasks = JSON.parse(list).map((t) => ({ start: Math.max(t.start, t0), end: Math.min(t.start + t.duration, t1) }));
  const durations = tasks.map((t) => t.end - t.start);
  return {
    max: durations.length ? Math.max(...durations) : 0,
    total: durations.reduce((a, x) => a + x, 0),
    count: tasks.length,
    lastEnd: tasks.length ? Math.max(...tasks.map((t) => t.end)) : null,
    tasks,
  };
};
const ltText = (lt) => `tâche max ${sec(lt.max)}, bloqué ${sec(lt.total)} (${lt.count})`;
/** Durée totale des `parseFromString` entre deux instants. */
const domParser = async (t0, t1) => evaluate(`window.__fluidite.domparser.filter((d) => d.start >= ${t0} && d.start < ${t1}).reduce((a, d) => a + d.duration, 0)`);
/** Nombre de `parseFromString` entre deux instants. */
const domParserCount = async (t0, t1) => evaluate(`window.__fluidite.domparser.filter((d) => d.start >= ${t0} && d.start < ${t1}).length`);
/** Navigation dans la page (pushState + popstate, ce que fait un lien de React Router), sans recharger les modules. */
const SPA_GO = (path) => `history.pushState({}, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate', { state: {} }));`;
/** Rangée « avancé » ouverte et onglets donnés ouverts (un onglet repris d'une session neuve se ferme : on le rouvre). */
const openTabs = async (labels) => {
  await evaluate(`document.querySelector('.an-tabs-advanced-toggle[aria-expanded="false"]')?.click(); 'ok'`);
  await settle({ max: 1500 });
  for (const label of labels) {
    await evaluate(`(() => { const t = [...document.querySelectorAll('.an-tabs .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (t && t.getAttribute('aria-pressed') !== 'true') t.click(); })()`);
    await settle({ max: 2000 });
  }
  return evaluate(`[...document.querySelectorAll('.an-tabs .ui-tab[aria-pressed="true"]')].map((t) => t.textContent.trim()).join(', ')`);
};
const listOpfs = (path) => evaluate(`(async () => {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}');
  for (const p of ${JSON.stringify(path)}.split('/')) dir = await dir.getDirectoryHandle(p);
  const names = []; for await (const [name] of dir.entries()) names.push(name); return names.sort();
})()`);

/** Résumé d'un profil du processeur : temps propre par fonction (les plus coûteuses), temps inclus de fonctions suivies. */
const WATCHED = ['parseGpx', 'loadGpxContent', 'computeKinematics', 'buildCumulativeTrack', 'computeActivityMask', 'analyzeGpx', 'summarizeSession', 'withSummary',
  'detectManeuvers', 'estimateWind', 'calculateWindStats', 'pickTopWindows', 'summarizeManeuvers', 'runCompleteScan', 'hydrateSession', 'parseFromString'];
const profileSummary = (profile, top = 12) => {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + profile.timeDeltas[i]));
  const inclusive = new Map();
  const incl = (id) => {
    if (inclusive.has(id)) return inclusive.get(id);
    const n = nodes.get(id);
    let total = self.get(id) ?? 0;
    for (const c of n.children ?? []) total += incl(c);
    inclusive.set(id, total);
    return total;
  };
  for (const n of profile.nodes) incl(n.id);
  const short = (url) => {
    if (!url) return '';
    const m = url.match(/\/src\/(.*)$/);
    if (m) return `src/${m[1]}`;
    const nm = url.match(/node_modules\/(?:\.vite\/deps\/)?([^/?]+)/);
    if (nm) return `node_modules/${nm[1]}`;
    return url.split('/').pop().split('?')[0];
  };
  const name = (n) => n.callFrame.functionName || '(anonyme)';
  const idle = profile.nodes.filter((n) => name(n) === '(idle)').reduce((a, n) => a + (self.get(n.id) ?? 0), 0);
  const total = profile.timeDeltas.reduce((a, x) => a + x, 0) - idle;
  const bySelf = new Map();
  for (const n of profile.nodes) {
    if (name(n) === '(idle)') continue;
    const key = `${name(n)} ${short(n.callFrame.url)}${n.callFrame.url ? `:${n.callFrame.lineNumber + 1}` : ''}`;
    bySelf.set(key, (bySelf.get(key) ?? 0) + (self.get(n.id) ?? 0));
  }
  const pct = (us) => `${(100 * us / Math.max(1, total)).toFixed(0).padStart(3)} %`;
  const lines = [`  temps mesuré ${sec(total / 1000)} hors repos ; temps propre des fonctions les plus coûteuses :`];
  for (const [key, us] of [...bySelf].sort((a, b) => b[1] - a[1]).slice(0, top)) lines.push(`    ${pct(us)}  ${sec(us / 1000).padStart(9)}  ${key}`);
  // Temps inclus : une fonction suivie peut apparaître en plusieurs nœuds (appelants différents) ; on somme, sans compter un
  // nœud sous un autre nœud de même nom (récursion ou re-rendu).
  const watched = new Map();
  const under = new Set();
  const walk = (id, ancestors) => {
    const n = nodes.get(id);
    const nm = name(n);
    const isWatched = WATCHED.includes(nm);
    if (isWatched && !ancestors.has(nm)) watched.set(nm, (watched.get(nm) ?? 0) + inclusive.get(id));
    else if (isWatched) under.add(nm);
    const next = isWatched ? new Set([...ancestors, nm]) : ancestors;
    for (const c of n.children ?? []) walk(c, next);
  };
  const childIds = new Set(profile.nodes.flatMap((n) => n.children ?? []));
  const roots = profile.nodes.filter((n) => !childIds.has(n.id));
  for (const r of roots) walk(r.id, new Set());
  if (watched.size) {
    lines.push('  temps inclus (la fonction et ce qu\'elle appelle) :');
    for (const [nm, us] of [...watched].sort((a, b) => b[1] - a[1])) lines.push(`    ${pct(us)}  ${sec(us / 1000).padStart(9)}  ${nm}`);
  }
  return lines.join('\n');
};
const profileStart = () => send('Profiler.start');
const profileStop = async () => (await send('Profiler.stop')).result?.profile;
/** Un chiffre de mesure tenu : un nombre fini et strictement positif (les temps changent d'un passage à l'autre, jamais leur présence). */
const fini = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;

// --- 1. Traces (lib/traces.mjs) ---
/** Pics de FC de `PEAK_S` s, plus hauts que le bruit, qu'un pas régulier sauterait : les captures doivent les garder. */
const PEAK_S = 6;
const hrPeak = (t, every, height) => (t % every < PEAK_S ? height : 0);
const HEURES = Math.max(0.25, Number(process.env.FLUIDITE_HEURES ?? 1) || 1);
const nbPoints = (gpx) => (gpx.match(/<trkpt /g) ?? []).length;
const T_LONG = Date.UTC(2026, 7, 1, 9, 0, 0);
const longSail = traceLongue(HEURES, 5, 'wingfoil', { debutMs: T_LONG, nom: 'Voile longue 5 Hz' });
const longPath = join(workDir, 'fluidite-voile-longue.gpx');
writeFileSync(longPath, longSail);
console.log('trace voile longue    :', `${nbPoints(longSail)} points à 5 Hz, ${HEURES} h, ${(longSail.length / 1e6).toFixed(1).replace('.', ',')} Mo`);
// Une seconde session, pour que la bibliothèque compte plusieurs lignes.
const shortPath = join(workDir, 'fluidite-voile-courte.gpx');
writeFileSync(shortPath, traceVoile({ debutMs: Date.UTC(2026, 7, 2, 9, 0, 0), nom: 'Voile courte' }));
const COUNT = Math.max(1, Number(process.env.FLUIDITE_RESUMES ?? 12) || 12);
const manyPaths = [];
for (let i = 0; i < COUNT; i++) {
  const p = join(workDir, `fluidite-voile-${String(i).padStart(2, '0')}.gpx`);
  writeFileSync(p, traceVoile({ hz: 1, secondes: 3600, debutMs: Date.UTC(2026, 6, 1, 10, 0, 0) - i * 86_400_000, nom: `Voile ${i}`, lat0: 43.5 + (i % 5) * 0.02, lon0: 3.9 + Math.floor(i / 5) * 0.02 }));
  manyPaths.push(p);
}

// --- Import ---
const MULTI = 'input[type=file][accept*=".gpx"][multiple]:not([disabled])';
await go('/sessions', 5000);
console.log('import voile          :', await importFiles([longPath, shortPath], MULTI));
await waitFor(async () => (await records()).length >= 2, { timeout: 60000, every: 500, label: 'fiches voile' });
await settle({ max: 5000, label: 'import voile' });
const sessionsAfterSail = await listOpfs('sessions');
const longFile = sessionsAfterSail.find((n) => n.endsWith('.gpx') && n.includes('2026-08-01'));
const longUrl = `/voile/analyse?session=${encodeURIComponent(longFile ?? '')}`;
console.log('session longue        :', longFile ?? '(absente)');
const CURRENT = (await records()).find((r) => r.gpx === longFile)?.summary?.calcVersion ?? null;
console.log('version du calcul     :', CURRENT);
check('la longue session est importée et résumée', Boolean(longFile) && typeof CURRENT === 'number', `${longFile}, version ${CURRENT}`);

// Traces des seules variantes du zoom : importées à la demande (la mesure des résumés compte les fiches).
const ZOOM_DEMANDEES = MESURES.includes('zoom') ? (process.env.FLUIDITE_ZOOM ?? 'voile-tel,surf-tel').split(',').map((v) => v.trim()) : [];
const importOne = async (page, name, text, datePart) => {
  const path = join(workDir, name);
  writeFileSync(path, text);
  const before = (await records()).length;
  await go('/sessions', 5000);
  console.log(`import ${name.padEnd(22)}:`, await importFiles(path, MULTI));
  await waitFor(async () => (await records()).length > before, { timeout: 90000, every: 500, label: name });
  await settle({ max: 5000, label: name });
  const file = (await listOpfs('sessions')).find((n) => n.endsWith('.gpx') && n.includes(datePart));
  return `/${page}/analyse?session=${encodeURIComponent(file ?? '')}`;
};
const sailHrUrl = ZOOM_DEMANDEES.some((v) => v.startsWith('voile'))
  ? await importOne('voile', 'fluidite-voile-fc.gpx', (() => {
    const rnd = bruitDeGraine(7);
    return traceLongue(HEURES, 5, 'wingfoil', { debutMs: Date.UTC(2026, 7, 3, 9, 0, 0), nom: 'Voile longue 5 Hz FC', fc: (t) => 130 + 20 * Math.sin(t / 600) + 3 * rnd() + hrPeak(Math.floor(t), 1900, 30) });
  })(), '2026-08-03') : null;
const surfUrl = ZOOM_DEMANDEES.includes('surf-tel')
  ? await importOne('surf', 'fluidite-surf.gpx', (() => {
    const rnd = bruitDeGraine(5);
    return traceLongue(2, 1, 'surf', { debutMs: Date.UTC(2026, 8, 9, 8, 0, 0), nom: 'Surf 2 h FC', fc: (t) => 110 + 20 * Math.sin(t / 120) + 2 * rnd() + (t % 300 >= 280 && t % 300 < 292 ? 25 : 0) });
  })(), '2026-09-09') : null;
const zoomImported = (sailHrUrl ? 1 : 0) + (surfUrl ? 1 : 0);

const results = {}; // nom de la mesure → { 1: {...médianes}, 6: {...} }

// --- 2. Ouverture d'une session voile ---
const openLong = async ({ profile = false } = {}) => {
  if (profile) await profileStart();
  const before = await metrics();
  const out = await evaluate(`new Promise((resolve) => {
    const t0 = performance.now();
    ${SPA_GO(longUrl)}
    const out = { t0, titre: null, trace: null, chiffres: null };
    const tick = () => {
      const now = performance.now();
      if (out.titre === null && document.querySelector('.an-page h1')?.textContent.trim()) out.titre = now - t0;
      if (out.trace === null && document.querySelector('.an-map-frame .leaflet-trace-pane canvas')) out.trace = now - t0;
      if (out.chiffres === null) {
        const v = [...document.querySelectorAll('.an-sheet__stats .an-sheet__stat-value')];
        if (v.length >= 3 && v.every((x) => /\\d/.test(x.textContent))) out.chiffres = now - t0;
      }
      if ((out.titre !== null && out.trace !== null && out.chiffres !== null) || now - t0 > 120000) { out.t1 = now; resolve(out); }
      else setTimeout(tick, 16);
    };
    tick();
  })`);
  // La page finit son travail (manœuvres, vent, carte) : on attend le calme, puis une seconde, avant de relever les tâches.
  await settle({ max: 8000, quiet: 300, label: 'ouverture' });
  await wait(1000);
  const tEnd = await evaluate('performance.now()');
  const after = await metrics();
  const lt = await longTasks(out.t0, tEnd);
  const dom = await domParser(out.t0, tEnd);
  const prof = profile ? await profileStop() : null;
  const r = { titre: out.titre, trace: out.trace, chiffres: out.chiffres, max: lt.max, total: lt.total, count: lt.count,
    libre: lt.lastEnd === null ? 0 : lt.lastEnd - out.t0, dom, script: (after.ScriptDuration - before.ScriptDuration) * 1000, prof };
  // Retour à la bibliothèque (navigation dans la page) : l'analyse démontée, la liste rendue (sous ralenti, React peut
  // n'avoir rien rendu quand `settle` voit un DOM immobile).
  await evaluate(`${SPA_GO('/sessions')} 'ok'`);
  await waitFor(`!document.querySelector('.an-page') && document.querySelectorAll('.lib-row').length >= 2`, { timeout: 30000, every: 50, label: 'bibliothèque rendue' });
  await settle({ max: 10000, label: 'retour bibliothèque' });
  return r;
};
const openText = (r) => `titre ${sec(r.titre)} | trace ${sec(r.trace)} | chiffres ${sec(r.chiffres)} | fil libre à ${sec(r.libre)} | ${ltText(r)} | DOMParser ${sec(r.dom)} | script ${sec(r.script)}`;

if (MESURES.includes('ouverture')) {
  console.log(`\n== Ouverture de la session de voile (${HEURES} h à 5 Hz) depuis la bibliothèque, onglets par défaut [${minutes()}] ==`);
  await go('/sessions', 5000);
  await waitFor(`document.querySelectorAll('.lib-row').length >= 2`, { timeout: 10000, label: 'bibliothèque' });
  await throttle(1);
  await openLong(); // chauffe : modules de l'analyse chargés
  results.ouverture = {};
  for (const rate of RATES) {
    await throttle(rate);
    const runs = [];
    for (let k = 0; k < REPS; k++) {
      const r = await openLong();
      runs.push(r);
      console.log(`×${rate} essai ${k + 1} : ${openText(r)}`);
    }
    const med = Object.fromEntries(['titre', 'trace', 'chiffres', 'libre', 'max', 'total', 'dom', 'script'].map((k) => [k, median(runs.map((r) => r[k]))]));
    med.count = median(runs.map((r) => r.count));
    results.ouverture[rate] = med;
    console.log(`×${rate} médiane : ${openText(med)}`);
    check(`ouverture ×${rate} : titre, trace et chiffres rendus, tous mesurés`, [med.titre, med.trace, med.chiffres].every(fini) && runs.every((r) => [r.titre, r.trace, r.chiffres].every(fini)),
      `${sec(med.titre)} / ${sec(med.trace)} / ${sec(med.chiffres)}`);
    if (PROFIL) {
      const p = await openLong({ profile: true });
      console.log(`×${rate} sous le profileur : chiffres ${sec(p.chiffres)}, ${ltText(p)}`);
      if (p.prof) console.log(profileSummary(p.prof));
    }
  }
  await throttle(1);
}

// --- 2 bis. Quitter l'analyse pendant la lecture ---
/** Ouvre la longue session, revient à la bibliothèque 100 ms plus tard (minuterie de la page), puis relève la suite. */
const quitLong = async () => {
  const out = await evaluate(`new Promise((resolve) => {
    const t0 = performance.now();
    ${SPA_GO(longUrl)}
    const out = { t0, lecture: null, quitte: null };
    const tick = () => {
      const now = performance.now();
      if (out.lecture === null && [...document.querySelectorAll('.an-page p')].some((p) => p.textContent.includes('Lecture de la session'))) out.lecture = now - t0;
      if (now - t0 >= 100) {
        ${SPA_GO('/sessions')}
        out.quitte = now - t0;
        resolve(out);
      } else setTimeout(tick, 5);
    };
    tick();
  })`);
  await waitFor(`!document.querySelector('.an-page') && document.querySelectorAll('.lib-row').length >= 2`, { timeout: 30000, every: 50, label: 'bibliothèque rendue' });
  // Une lecture non abandonnée finit après le retour : on lui laisse le temps (fichier relu, puis texte lu).
  await settle({ max: 10000, quiet: 300, label: 'après le retour' });
  await wait(4000);
  const tEnd = await evaluate('performance.now()');
  const lt = await longTasks(out.t0, tEnd);
  return { lecture: out.lecture, quitte: out.quitte, max: lt.max, total: lt.total, count: lt.count,
    dom: await domParser(out.t0, tEnd), parses: await domParserCount(out.t0, tEnd) };
};
const quitText = (r) => `retour à ${sec(r.quitte)} | « Lecture de la session… » ${r.lecture === null ? 'non vue' : `à ${sec(r.lecture)}`} | DOMParser ${r.parses} (${sec(r.dom)}) | ${ltText(r)}`;

if (MESURES.includes('quitter')) {
  console.log(`\n== Quitter la session de voile (${HEURES} h à 5 Hz) 100 ms après l'avoir ouverte, retour à la bibliothèque [${minutes()}] ==`);
  await go('/sessions', 5000);
  await waitFor(`document.querySelectorAll('.lib-row').length >= 2`, { timeout: 10000, label: 'bibliothèque' });
  await throttle(1);
  await quitLong(); // chauffe : modules de l'analyse chargés
  results.quitter = {};
  for (const rate of RATES) {
    await throttle(rate);
    const runs = [];
    for (let k = 0; k < REPS; k++) {
      const r = await quitLong();
      runs.push(r);
      console.log(`×${rate} essai ${k + 1} : ${quitText(r)}`);
    }
    const med = Object.fromEntries(['quitte', 'max', 'total', 'count', 'dom', 'parses'].map((k) => [k, median(runs.map((r) => r[k]))]));
    med.lecture = median(runs.map((r) => r.lecture));
    results.quitter[rate] = med;
    console.log(`×${rate} médiane : ${quitText(med)}`);
    check(`quitter ×${rate} : le retour à 100 ms est mesuré, tâches et DOMParser comptés`, fini(med.quitte) && [med.count, med.parses, med.dom, med.total].every((x) => typeof x === 'number' && Number.isFinite(x)),
      `retour ${sec(med.quitte)}, ${med.count} tâches, ${med.parses} DOMParser`);
  }
  await throttle(1);
}

// --- 3. Seuil d'activité changé en voile ---
if (MESURES.includes('seuil')) {
  console.log(`\n== Seuil d'activité changé dans l'onglet réglages de la session de voile (${HEURES} h à 5 Hz) [${minutes()}] ==`);
  await throttle(1);
  await go(longUrl, 30000);
  await waitFor(`document.querySelectorAll('.an-sheet__stats .an-sheet__stat-value').length >= 3`, { timeout: 60000, label: 'analyse' });
  // Tous les onglets qui dépendent du seuil (manœuvres, vent, VMG, tops, graphiques) : le pire cas, celui du point 197.
  console.log('onglets ouverts       :', await openTabs(['général', 'tops', 'manœuvres', 'graphiques', 'vent', 'vmg', 'réglages']));
  const INPUT = `document.querySelector('input[aria-label="Seuil d\\'activité"]')`;
  const seuilDepart = await evaluate(`${INPUT}?.value ?? '(champ absent)'`);
  console.log('seuil de départ       :', seuilDepart);
  check('seuil : le champ du seuil d\'activité est dans l\'onglet réglages', seuilDepart !== '(champ absent)', seuilDepart);
  const changeThreshold = async (value) => {
    // La saisie part d'une tâche de la page (`setTimeout`), pas du `Runtime.evaluate` : React rend la saisie d'un coup,
    // dans la même tâche, et celle-ci n'est comptée parmi les tâches longues que si c'est une tâche ordinaire de la page.
    const out = await evaluate(`new Promise((resolve) => {
      const el = ${INPUT};
      if (!el) return resolve(null);
      let last = performance.now();
      const mo = new MutationObserver(() => { last = performance.now(); });
      mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      const out = { t0: null, chiffres: null };
      const re = new RegExp('≥\\\\s*${value}(?:[,.]0)?\\\\s');
      const tick = () => {
        const now = performance.now();
        if (out.chiffres === null && [...document.querySelectorAll('.an-sheet__stat-label')].some((l) => re.test(l.textContent))) out.chiffres = now - out.t0;
        if ((out.chiffres !== null && now - last > 600) || now - out.t0 > 60000) { mo.disconnect(); out.calme = last - out.t0; out.t1 = now; resolve(out); }
        else setTimeout(tick, 16);
      };
      setTimeout(() => {
        out.t0 = performance.now();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(tick, 0);
      }, 0);
    })`);
    if (!out) return null;
    const lt = await longTasks(out.t0, out.t1);
    return { chiffres: out.chiffres, calme: out.calme, max: lt.max, total: lt.total, count: lt.count };
  };
  const thText = (r) => (r ? `chiffres ${sec(r.chiffres)} | DOM calme à ${sec(r.calme)} | ${ltText(r)}` : '(champ absent)');
  await changeThreshold(12); // chauffe
  await wait(1500);
  results.seuil = {};
  let turn = 0; // 15 et 12 en alternance d'une prise à l'autre, quel que soit le ralenti
  for (const rate of RATES) {
    await throttle(rate);
    const runs = [];
    for (let k = 0; k < REPS; k++) {
      const r = await changeThreshold(turn++ % 2 === 0 ? 15 : 12);
      if (r) runs.push(r);
      console.log(`×${rate} essai ${k + 1} : ${thText(r)}`);
      await wait(1500);
    }
    const med = Object.fromEntries(['chiffres', 'calme', 'max', 'total', 'count'].map((k) => [k, median(runs.map((r) => r[k]))]));
    results.seuil[rate] = med;
    console.log(`×${rate} médiane : ${thText(med)}`);
    check(`seuil ×${rate} : les chiffres sont refaits à chaque prise (${runs.length}/${REPS})`, runs.length === REPS && runs.every((r) => fini(r.chiffres) && fini(r.calme)), `${sec(med.chiffres)} / ${sec(med.calme)}`);
  }
  await throttle(1);
  // Brouillon abandonné : la page suivante est chargée à neuf, le `confirm` est accepté d'office par la bibliothèque.
}

// --- 4. Zoom d'un graphe ---
const SCREEN_PC = { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false };
const SCREEN_TEL = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const ZOOM_VARIANTES = {
  'voile-pc': { url: () => sailHrUrl, titre: `voile de ${HEURES} h à 5 Hz avec FC, 1400 px, double-clic`, tel: false, onglets: ['général', 'graphiques', 'cardio'] },
  'voile-tel': { url: () => sailHrUrl, titre: `voile de ${HEURES} h à 5 Hz avec FC, 390 px, pincement`, tel: true, onglets: ['graphiques', 'vent', 'vmg'] },
  'surf-tel': { url: () => surfUrl, titre: 'surf de 2 h avec FC, 390 px, pincement', tel: true, onglets: ['graphiques'], panneau: 'Vitesse' },
};
/** Par graphe des panneaux : segments de sa plus longue courbe (`d` tracé) et `<stop>` de son dégradé. */
const chartLines = async () => {
  const list = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.an-carte-panels .zoom-chart')].map((c) => ({
    seg: Math.max(0, ...[...c.querySelectorAll('.recharts-line-curve, .recharts-area-curve')].map((p) => (p.getAttribute('d') ?? '').match(/[CLHV]/g)?.length ?? 0)),
    stops: c.querySelectorAll('stop').length,
  })))`));
  return `${list.map((g) => g.seg).join(' + ')} lignes (${list.reduce((a, g) => a + g.seg, 0)}), ${list.reduce((a, g) => a + g.stops, 0)} stops`;
};
/** Capture du panneau « Graphiques » entier, même plus haut que l'écran. Rien sans dossier de captures. */
const shootPanel = async (name, panel) => {
  if (!shotDir) return;
  const clip = await evaluate(`(() => { const s = ${SCOPE(panel)}; if (!s) return null; const r = s.getBoundingClientRect(); return JSON.stringify({ x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, scale: 1 }); })()`);
  if (!clip) return;
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: JSON.parse(clip) });
  writeFileSync(join(shotDir, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
};
const resetZoom = async (panel) => {
  await evaluate(`(() => { const c = ${CHART(panel, 0)}; const b = c ? [...c.querySelectorAll('.zoom-chart__actions button')].find((x) => x.textContent.trim() === 'Tout voir') : null; b?.click(); return Boolean(b); })()`);
  await settle({ max: 8000, label: 'tout voir' });
};
const zoomText = (r) => `script ${sec(r.script)} | ${(r.fps ?? 0).toFixed(0)} images/s, image la plus longue ${sec(r.gap)} | ${ltText(r)}`;
const FRAMES_MS = 1500;
let screenTel = false;
let firstVariant = true;
/** Une variante du zoom : la page ouverte, une prise de chauffe, `REPS` prises à ×1 et à ×6, médianes dans `results`. */
const mesureZoom = async (nom) => {
  const v = ZOOM_VARIANTES[nom];
  const panel = v?.panneau ?? 'Graphiques';
  if (!v || !v.url()) {
    check(`zoom ${nom} : variante connue, trace importée`, false, v ? 'trace absente' : 'variante inconnue');
    return;
  }
  console.log(`\n== Zoom d'un graphe : ${v.titre}, onglets ${v.onglets.join(', ')} [${minutes()}] ==`);
  await throttle(1);
  // Document neuf au changement d'écran seulement : passé un second chargement, le toucher émulé n'arrive plus à la
  // page (aucun `touchstart`, vu à la mise au point de cette mesure). Entre deux variantes au toucher, navigation dans la page.
  if (screenTel !== v.tel) {
    screenTel = v.tel;
    await send('Emulation.setDeviceMetricsOverride', v.tel ? SCREEN_TEL : SCREEN_PC);
    await send('Emulation.setTouchEmulationEnabled', v.tel ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await go(v.url(), 30000);
  } else if (firstVariant) await go(v.url(), 30000);
  else {
    await evaluate(`${SPA_GO(v.url())} 'ok'`);
    await wait(500);
  }
  firstVariant = false;
  await waitFor(`document.querySelectorAll('.an-tabs .ui-tab').length >= 2`, { timeout: 90000, label: 'analyse' });
  await settle({ max: 20000, label: 'analyse' });
  console.log('onglets ouverts       :', await openTabs(v.onglets));
  await waitFor(`${CHART(panel, 0)} !== null`, { timeout: 30000, label: 'graphes' });
  await settle({ max: 10000, label: 'graphes' });
  const nbGraphes = await evaluate(`document.querySelectorAll('.an-carte-panels .zoom-chart').length`);
  console.log('graphes zoomables     :', nbGraphes);
  check(`zoom ${nom} : l'analyse s'ouvre et ses graphes zoomables sont là`, nbGraphes >= 1, nbGraphes);
  const lignes = { entier: await chartLines(), zoome: null };
  await shootPanel(`zoom-${nom}-entier`, panel);
  const zoomOnce = async () => {
    const before = await metrics();
    // Compteur d'images lancé dans la page, sans l'attendre : il court pendant le geste. Double-clic : 1,5 s comme à
    // l'origine ; pincement : jusqu'à la fin du geste (`until`, repoussé après lui), le geste s'allonge sous ralenti.
    await send('Runtime.evaluate', { expression: `(() => {
      const f = window.__fluidite;
      f.frames = { t0: performance.now(), n: 0, maxGap: 0, done: false, until: ${v.tel ? 'Infinity' : FRAMES_MS} };
      let prev = f.frames.t0;
      const loop = () => requestAnimationFrame((t) => { f.frames.n++; f.frames.maxGap = Math.max(f.frames.maxGap, t - prev); prev = t; if (t - f.frames.t0 < f.frames.until) loop(); else { f.frames.t1 = t; f.frames.done = true; } });
      loop();
    })()`, returnByValue: true });
    const t0 = await evaluate('window.__fluidite.frames.t0');
    const r = v.tel ? await pinch(panel, 0) : await doubleClick(panel, 0, 0.25, { settleMax: 8000 });
    if (v.tel) {
      await settle({ max: 8000, label: 'après le pincement' });
      await evaluate(`(() => { const f = window.__fluidite.frames; f.until = performance.now() - f.t0; })()`);
    }
    await waitFor('window.__fluidite.frames.done', { timeout: 30000, every: 50 });
    const after = await metrics();
    const f = JSON.parse(await evaluate('JSON.stringify(window.__fluidite.frames)'));
    const lt = await longTasks(t0, f.t1);
    // Zoom rendu : « Tout voir » paraît ; ses lignes relevées, puis on le clique pour la prise suivante.
    const buttons = await evaluate(`(() => { const c = ${CHART(panel, 0)}; return c ? [...c.querySelectorAll('.zoom-chart__actions button')].map((b) => b.textContent.trim()).join(' | ') : '(absent)'; })()`);
    lignes.zoome = await chartLines();
    await resetZoom(panel);
    return { geste: r, fps: (f.n * 1000) / (f.t1 - f.t0), gap: f.maxGap, script: (after.ScriptDuration - before.ScriptDuration) * 1000, max: lt.max, total: lt.total, count: lt.count, buttons };
  };
  await zoomOnce(); // chauffe
  const out = {};
  for (const rate of RATES) {
    await throttle(rate);
    const runs = [];
    for (let k = 0; k < REPS_LONGUES; k++) {
      const r = await zoomOnce();
      runs.push(r);
      console.log(`×${rate} essai ${k + 1} : ${zoomText(r)}${r.geste !== 'ok' ? ` (geste : ${r.geste})` : ''}${/Tout voir/.test(r.buttons) ? '' : ` (boutons : ${r.buttons})`}`);
    }
    const med = Object.fromEntries(['script', 'fps', 'gap', 'max', 'total', 'count'].map((k) => [k, median(runs.map((r) => r[k]))]));
    out[rate] = med;
    console.log(`×${rate} médiane : ${zoomText(med)}`);
    check(`zoom ${nom} ×${rate} : chaque geste zoome (« Tout voir » paraît) et rend images par seconde et script`,
      runs.every((r) => r.geste === 'ok' && /Tout voir/.test(r.buttons) && fini(r.fps) && fini(r.script)), runs.map((r) => `${r.geste} ${r.buttons}`).join(' ; '));
  }
  // Une prise de plus sous le profileur, au ralenti : où le temps part.
  if (PROFIL) {
    await profileStart();
    const profiled = await zoomOnce();
    const profile = await profileStop();
    console.log(`×${RATES.at(-1)} sous le profileur : ${zoomText(profiled)}`);
    if (profile) console.log(profileSummary(profile));
  }
  await throttle(1);
  console.log(`lignes par graphe     : entier ${lignes.entier} ; après le geste ${lignes.zoome}`);
  results[`zoom ${nom}`] = { ...out, lignes };
  if (shotDir) {
    await (v.tel ? doubleTap(panel, 0, 0.25) : doubleClick(panel, 0, 0.25, { settleMax: 8000 }));
    await settle({ max: 8000, label: 'zoom pour la capture' });
    await shootPanel(`zoom-${nom}-zoome`, panel);
    await resetZoom(panel);
  }
};
if (MESURES.includes('zoom')) {
  for (const nom of ZOOM_DEMANDEES) await mesureZoom(nom);
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await send('Emulation.setDeviceMetricsOverride', SCREEN_PC);
}

// --- 5. Mise à jour des résumés ---
if (MESURES.includes('resumes') || MESURES.includes('demarrage')) {
  await throttle(1);
  await go('/sessions', 5000);
  console.log(`\nimport de ${COUNT} sessions :`, await importFiles(manyPaths, MULTI));
  const attendues = 2 + zoomImported + COUNT;
  const got = await waitFor(async () => (await records()).length >= attendues, { timeout: 240000, every: 1000, label: `fiches des ${COUNT} sessions` });
  const nbFiches = (await records()).length;
  console.log('fiches                :', nbFiches);
  check(`import : les ${COUNT} sessions d'une heure sont rangées (${attendues} fiches)`, Boolean(got) && nbFiches >= attendues, nbFiches);
  await settle({ max: 10000, label: `import des ${COUNT}` });
  await wait(3000); // cache des fiches écrit (1 s après le dernier import)
}
/** Les fiches des sessions d'une heure marquées d'une version de calcul antérieure, cache des fiches effacé. */
const outdateRecords = () => evaluate(`(async () => {
  const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions');
  let n = 0;
  for await (const [name, h] of dir.entries()) {
    if (!name.endsWith('.json') || !/2026-0[67]-\\d\\d/.test(name)) continue;
    const text = await (await h.getFile()).text();
    const record = JSON.parse(text);
    if (!record.summary) continue;
    record.summary.calcVersion = 1;
    const w = await h.createWritable();
    await w.write(JSON.stringify(record));
    await w.close();
    n++;
  }
  localStorage.removeItem('${CLES.libraryCache}');
  return n;
})()`);
const upToDate = () => evaluate(`(async () => {
  const dir = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('${DOSSIER_MEMOIRE}')).getDirectoryHandle('sessions');
  let n = 0;
  for await (const [name, h] of dir.entries()) {
    if (!name.endsWith('.json') || !/2026-0[67]-\\d\\d/.test(name)) continue;
    try { if (JSON.parse(await (await h.getFile()).text()).summary?.calcVersion === ${CURRENT}) n++; } catch {}
  }
  return n;
})()`);
/** Relance la page sur `path` (document neuf) et rend la fonction qui dit si le document a changé. */
const reload = async (path) => {
  const before = await evaluate(`window.__banc?.doc ?? null`);
  await send('Page.navigate', { url: `${BASE}${path}` });
  await waitFor(async () => { const doc = await evaluate(`window.__banc?.doc ?? null`); return doc && doc !== before; }, { timeout: 30000, every: 20, label: 'nouveau document' });
};

if (MESURES.includes('resumes')) {
  console.log(`\n== Mise à jour des résumés de ${COUNT} sessions de voile (1 h à 1 Hz) au lancement, sur le Profil [${minutes()}] ==`);
  const refreshOnce = async ({ profile = false } = {}) => {
    const n = await outdateRecords();
    await reload('/');
    if (profile) await profileStart();
    const tNav = await evaluate('performance.now()');
    // Sonde : un mouvement de souris toutes les 300 ms, sa latence relevée dans la page et l'aller-retour vu d'ici.
    let probing = true;
    const roundTrips = [];
    const probe = (async () => {
      let k = 0;
      while (probing) {
        const t = Date.now();
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1200 + (k++ % 7), y: 60, button: 'none' });
        roundTrips.push(Date.now() - t);
        await wait(300);
      }
    })();
    // Fin : les fiches toutes à la version courante (relues toutes les 500 ms, de petits fichiers).
    const t0 = Date.now();
    let done = false;
    while (Date.now() - t0 < 300000) {
      if ((await upToDate()) >= n) { done = true; break; }
      await wait(500);
    }
    const tEnd = await evaluate('performance.now()');
    probing = false;
    await probe;
    const prof = profile ? await profileStop() : null;
    const lt = await longTasks(0, tEnd);
    const inputs = JSON.parse((await evaluate(`JSON.stringify(window.__fluidite.inputs.filter((i) => i.type === 'mousemove').map((i) => i.delay))`)) ?? '[]');
    const dom = await domParser(0, tEnd);
    await settle({ max: 10000, label: 'après la mise à jour' });
    return { n, done, total: tEnd - tNav, max: lt.max, bloque: lt.total, count: lt.count, dom, latence: median(inputs), latenceMax: inputs.length ? Math.max(...inputs) : null,
      sondes: inputs.length, allerRetourMax: roundTrips.length ? Math.max(...roundTrips) : null, prof };
  };
  const refreshText = (r) => `${r.done ? '' : '(inachevée après 5 min) '}${r.n} résumés en ${sec(r.total)} | tâche max ${sec(r.max)}, bloqué ${sec(r.bloque)} (${r.count}) | DOMParser ${sec(r.dom)} | souris : latence médiane ${sec(r.latence)}, max ${sec(r.latenceMax)} (${r.sondes} sondes), aller-retour max ${sec(r.allerRetourMax)}`;
  await throttle(1);
  results.resumes = {};
  for (const rate of RATES) {
    await throttle(rate);
    const runs = [];
    for (let k = 0; k < REPS; k++) {
      const r = await refreshOnce();
      runs.push(r);
      console.log(`×${rate} essai ${k + 1} : ${refreshText(r)}`);
    }
    const med = Object.fromEntries(['total', 'max', 'bloque', 'count', 'dom', 'latence', 'latenceMax', 'sondes', 'allerRetourMax'].map((k) => [k, median(runs.map((r) => r[k]))]));
    med.n = runs[0].n;
    med.done = runs.every((r) => r.done);
    results.resumes[rate] = med;
    console.log(`×${rate} médiane : ${refreshText(med)}`);
    check(`résumés ×${rate} : les ${COUNT} fiches sont refaites à chaque prise, durée mesurée`, runs.every((r) => r.done && r.n === COUNT && fini(r.total) && fini(r.sondes)),
      runs.map((r) => `${r.n} fiches, ${r.done ? 'faites' : 'inachevée'}, ${r.sondes} sondes`).join(' ; '));
    if (PROFIL && rate === RATES[0]) {
      const p = await refreshOnce({ profile: true });
      console.log(`×${rate} sous le profileur : ${p.n} résumés en ${sec(p.total)}, tâche max ${sec(p.max)}, bloqué ${sec(p.bloque)}`);
      if (p.prof) console.log(profileSummary(p.prof));
    }
  }
  await throttle(1);
}

// --- 6. Démarrage ---
if (MESURES.includes('demarrage')) {
  console.log(`\n== Démarrage : chargement de « / » jusqu'au Profil, ${2 + zoomImported + COUNT} sessions en mémoire, cache des fiches à jour [${minutes()}] ==`);
  const WINDOW_MS = FENETRE_S * 1000;
  await throttle(1);
  await reload('/');
  await settle({ max: 20000, label: 'Profil, cache refait' });
  await wait(3000);
  let scripts = 0;
  const unlisten = b.onMessage((msg) => { if (msg.method === 'Network.requestWillBeSent' && msg.params.type === 'Script') scripts++; });
  const startOnce = async () => {
    scripts = 0;
    await reload('/');
    const m0 = await metrics();
    await wait(WINDOW_MS);
    const m1 = await metrics();
    const homeAt = await evaluate('window.__fluidite.homeAt');
    const lt = await longTasks(0, WINDOW_MS);
    // Interactif : premier instant, après le Profil rendu, suivi d'une seconde sans tâche longue.
    let interactive = null;
    if (homeAt !== null) {
      const tasks = [...lt.tasks].sort((a, c) => a.start - c.start);
      let t = homeAt;
      for (;;) {
        const blocking = tasks.find((x) => x.end > t && x.start < t + 1000);
        if (!blocking) { interactive = t; break; }
        t = blocking.end;
        if (t > WINDOW_MS) break;
      }
    }
    return { rendu: homeAt, interactif: interactive, max: lt.max, total: lt.total, count: lt.count, script: (m1.ScriptDuration - m0.ScriptDuration) * 1000, modules: scripts };
  };
  const startText = (r) => `Profil rendu ${sec(r.rendu)} | interactif ${r.interactif == null ? `> ${FENETRE_S} s` : sec(r.interactif)} | ${ltText(r)} | script ${sec(r.script)} | ${r.modules} modules chargés`;
  results.demarrage = {};
  let noPreload = null;
  for (const mode of ['avec préchargement', 'sans préchargement']) {
    if (mode === 'sans préchargement') {
      noPreload = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {};` })).result.identifier;
    }
    results.demarrage[mode] = {};
    for (const rate of RATES) {
      await throttle(rate);
      const runs = [];
      for (let k = 0; k < REPS_LONGUES; k++) {
        const r = await startOnce();
        runs.push(r);
        console.log(`${mode}, ×${rate} essai ${k + 1} : ${startText(r)}`);
      }
      const med = Object.fromEntries(['rendu', 'interactif', 'max', 'total', 'count', 'script', 'modules'].map((k) => [k, median(runs.map((r) => r[k]))]));
      if (runs.some((r) => r.interactif == null)) med.interactif = null;
      results.demarrage[mode][rate] = med;
      console.log(`${mode}, ×${rate} médiane : ${startText(med)}`);
      check(`démarrage ${mode} ×${rate} : le Profil est rendu à chaque prise, modules comptés`, runs.every((r) => fini(r.rendu) && fini(r.modules) && fini(r.script)),
        runs.map((r) => `${sec(r.rendu)}, ${r.modules} modules`).join(' ; '));
    }
  }
  if (noPreload) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noPreload });
  unlisten();
  await throttle(1);
}

// --- 7. L'arrêt d'un enregistrement : rangement et ouverture de l'analyse ---
if (MESURES.includes('analyser')) {
  console.log(`\n== L'arrêt d'un enregistrement rejoué à ×600 : rangement, ouverture de l'analyse [${minutes()}] ==`);
  // Sondes de cette mesure : calculs envoyés au worker, écritures de la mémoire (OPFS), navigation vers l'analyse.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const s = { events: [] };
    Object.defineProperty(window, '__analyser', { value: s, enumerable: false });
    const log = (what, detail) => s.events.push({ what, detail, at: performance.now() });
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(...args) { super(...args); this.addEventListener('message', () => log('workerAnswer')); }
      postMessage(m, ...rest) { log('workerPost', m?.kind); return super.postMessage(m, ...rest); }
    };
    const create = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...a) { log('write', this.name); return create.apply(this, a); };
    const end = FileSystemWritableFileStream.prototype.close;
    FileSystemWritableFileStream.prototype.close = function (...a) { return end.apply(this, a).then((v) => { log('written'); return v; }); };
    const push = history.pushState;
    history.pushState = function (...a) { log('push', String(a[2] ?? '')); return push.apply(this, a); };
    // L'analyse ouverte à la fin d'un enregistrement prend la place d'Enregistrer.
    const replace = history.replaceState;
    history.replaceState = function (...a) { log('push', String(a[2] ?? '')); return replace.apply(this, a); };
  })();` });
  await throttle(1);
  await go('/enregistrer', 5000);

  const CAS = [
    { nom: 'voile 1 h 1 Hz', famille: 'Voile', chemin: '/voile/analyse', secondes: 3600, gpx: (debutMs) => traceVoile({ hz: 1, secondes: 3600, debutMs, nom: 'Voile rejouée' }) },
    { nom: 'surf 1 h 1 Hz', famille: 'Surf', chemin: '/surf/analyse', secondes: 3600, gpx: (debutMs) => traceLongue(1, 1, 'surf', { debutMs, nom: 'Surf rejoué' }) },
  ];
  const choose = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('[role=radiogroup] button[role=radio]')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
  // Un GPX par prise, parti d'un autre jour : la même heure de départ serait un doublon.
  let prise = 0;
  /** Enregistrement rejoué jusqu'avant l'arrêt : le geste du téléphone, à ×600 (`bench.mjs`). */
  const recordReplay = async (cas) => {
    prise += 1;
    const path = join(workDir, `fluidite-analyser-${prise}.gpx`);
    writeFileSync(path, cas.gpx(Date.UTC(2026, 0, 1, 8, 0, 0) + prise * 86_400_000));
    await waitFor(`document.querySelectorAll('input[type=radio]').length >= 2`, { timeout: 10000, label: 'page Enregistrer' });
    await choose(cas.famille);
    if (cas.activite) await choose(cas.activite);
    await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
    await wait(300);
    await importFiles(path, 'input[type=file]');
    await settle({ max: 3000, label: 'trace rejouée chargée' });
    await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '600'); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    await wait(100);
    await evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('Démarrer')).click(); 'ok'`);
    await wait((cas.secondes / 600) * 1000 + 2000); // rejeu en temps réel : un vrai délai
    // L'arrêt, tenu 2 s, est le début de la mesure (`analyze`) : la session se range et s'ouvre seule.
    const points = await evaluate(`[...document.querySelectorAll('span.num')].find((v) => v.previousElementSibling?.textContent.trim() === 'Points')?.textContent.trim() ?? null`);
    console.log(`prise ${prise}, ${cas.nom} :`, points === null ? '(points non lus)' : `${points} points`);
  };
  /**
   * Arrêt tenu (« Arrêter », 2 s) jusqu'aux chiffres de l'analyse, ouverte seule : le temps part de la fin
   * des 2 s. « Rangement… » est peint à la seconde image qui le voit (une image attend que le fil soit libre). Le
   * journal, en mémoire vive sur le banc, ne se mesure pas : l'écart entre la dernière écriture et la navigation le
   * comprend sur le téléphone seulement.
   */
  const analyze = async ({ profile = false } = {}) => {
    if (profile) await profileStart();
    const out = await evaluate(`new Promise((resolve) => {
      // L'arrêt part à la fin des 2 s tenues.
      const t0 = performance.now() + 2000;
      const out = { t0, peint: null, titre: null, trace: null, chiffres: null };
      const paint = () => requestAnimationFrame(() => {
        if ([...document.querySelectorAll('[role=status]')].some((x) => x.textContent.includes('Rangement'))) requestAnimationFrame(() => { out.peint = performance.now() - t0; });
        else if (!location.search.includes('session=')) paint();
      });
      paint();
      const stop = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled);
      stop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      setTimeout(() => { stop.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); stop.click(); }, 2300);
      const tick = () => {
        const now = performance.now();
        if (out.titre === null && document.querySelector('.an-page h1')?.textContent.trim()) out.titre = now - t0;
        if (out.trace === null && document.querySelector('.an-map-frame .leaflet-trace-pane canvas')) out.trace = now - t0;
        if (out.chiffres === null && [...document.querySelectorAll('.an-sheet__stats .an-sheet__stat-value')].filter((x) => /\\d/.test(x.textContent)).length >= 3) out.chiffres = now - t0;
        if ((out.titre !== null && out.trace !== null && out.chiffres !== null) || now - t0 > 120000) resolve(out);
        else setTimeout(tick, 16);
      };
      tick();
    })`);
    await settle({ max: 8000, quiet: 300, label: 'analyse ouverte' });
    await wait(1000);
    const tEnd = await evaluate('performance.now()');
    const prof = profile ? await profileStop() : null;
    const events = JSON.parse(await evaluate(`JSON.stringify(window.__analyser.events.filter((e) => e.at >= ${out.t0}))`));
    const pushEvent = events.find((e) => e.what === 'push' && e.detail.includes('session='));
    const push = pushEvent?.at ?? tEnd;
    const firstWrite = events.find((e) => e.what === 'write')?.at ?? push;
    const lastWrite = events.filter((e) => e.what === 'written' && e.at <= push).pop()?.at ?? firstWrite;
    const post = events.find((e) => e.what === 'workerPost' && e.detail === 'summarize');
    const answer = post ? events.find((e) => e.what === 'workerAnswer' && e.at > post.at) : null;
    const [calcul, ecritures, ouverture] = await Promise.all([longTasks(out.t0, firstWrite), longTasks(firstWrite, push), longTasks(push, tEnd)]);
    return {
      adresse: pushEvent?.detail ?? '',
      peint: out.peint, worker: answer ? answer.at - post.at : null, premiereEcriture: firstWrite - out.t0, ecritures: lastWrite - firstWrite, navigation: push - out.t0,
      titre: out.titre, trace: out.trace, chiffres: out.chiffres,
      calculMax: calcul.max, calculBloque: calcul.total, ecrituresMax: ecritures.max, ecrituresBloque: ecritures.total, ouvertureMax: ouverture.max, ouvertureBloque: ouverture.total,
      prof,
    };
  };
  const analyzeText = (r) => `« Rangement… » peint ${sec(r.peint)} | worker ${sec(r.worker)} | 1re écriture ${sec(r.premiereEcriture)} | écritures ${sec(r.ecritures)} | navigation ${sec(r.navigation)} | titre ${sec(r.titre)} | trace ${sec(r.trace)} | chiffres ${sec(r.chiffres)}`
    + ` | avant écriture : tâche max ${sec(r.calculMax)}, bloqué ${sec(r.calculBloque)} | écritures : ${sec(r.ecrituresMax)}, ${sec(r.ecrituresBloque)} | ouverture : ${sec(r.ouvertureMax)}, ${sec(r.ouvertureBloque)}`;
  const backToRecording = async () => {
    await throttle(1);
    await evaluate(`${SPA_GO('/enregistrer')} 'ok'`);
    await settle({ max: 5000, label: 'retour à Enregistrer' });
  };

  const FIELDS = ['peint', 'worker', 'premiereEcriture', 'ecritures', 'navigation', 'titre', 'trace', 'chiffres', 'calculMax', 'calculBloque', 'ecrituresMax', 'ecrituresBloque', 'ouvertureMax', 'ouvertureBloque'];
  const measures = {};
  /** `REPS` prises par ralenti, plus une sous le profileur au dernier ralenti. */
  const measureCase = async (label, cas) => {
    measures[label] = {};
    for (const rate of RATES) {
      const runs = [];
      for (let k = 0; k < REPS + (PROFIL ? 1 : 0); k++) {
        const profile = k === REPS;
        if (profile && rate !== RATES.at(-1)) break;
        await recordReplay(cas);
        await throttle(rate);
        const r = await analyze({ profile });
        await backToRecording();
        console.log(`${label} ×${rate} ${profile ? 'sous le profileur' : `essai ${k + 1}`} : ${analyzeText(r)}`);
        if (profile) { if (r.prof) console.log(profileSummary(r.prof)); }
        else runs.push(r);
      }
      measures[label][rate] = Object.fromEntries(FIELDS.map((f) => [f, median(runs.map((r) => r[f]))]));
      console.log(`${label} ×${rate} médiane : ${analyzeText(measures[label][rate])}`);
      const m = measures[label][rate];
      check(`analyser ${label} ×${rate} : l'arrêt ouvre l'analyse de la famille (${cas.chemin}) de la session rangée, navigation, titre, trace et chiffres mesurés`,
        runs.length === REPS && runs.every((r) => r.adresse.startsWith(cas.chemin) && [r.navigation, r.titre, r.trace, r.chiffres].every(fini)), `${runs.map((r) => r.adresse).join(' ; ')} ${sec(m.navigation)} / ${sec(m.titre)} / ${sec(m.chiffres)}`);
    }
  };

  // Chauffe : modules de l'analyse chargés, comme au téléphone après le préchargement des pages.
  await recordReplay(CAS[0]);
  await analyze();
  await backToRecording();
  for (const cas of CAS) await measureCase(cas.nom, cas);
  results.analyser = Object.entries(measures).flatMap(([label, m]) => [
    [`Analyser ${label} : « Rangement… » peint / 1re écriture / navigation / chiffres`, (r) => `${sec(m[r].peint)} / ${sec(m[r].premiereEcriture)} / ${sec(m[r].navigation)} / ${sec(m[r].chiffres)}`],
    [`Analyser ${label} : avant écriture, tâche max / bloqué`, (r) => `${sec(m[r].calculMax)} / ${sec(m[r].calculBloque)}`],
    [`Analyser ${label} : écritures, durée / tâche max / bloqué`, (r) => `${sec(m[r].ecritures)} / ${sec(m[r].ecrituresMax)} / ${sec(m[r].ecrituresBloque)}`],
    [`Analyser ${label} : ouverture, tâche max / bloqué`, (r) => `${sec(m[r].ouvertureMax)} / ${sec(m[r].ouvertureBloque)}`],
  ]);
}

// --- Tableau des médianes ---
console.log(`\n== Tableau des médianes (PC),${minutes()} de mesure ==`);
console.log(`| Mesure | ${RATES.map((r) => `×${r}`).join(' | ')} |`);
console.log(`|---|${RATES.map(() => '---').join('|')}|`);
const row = (label, f) => console.log(`| ${label} | ${RATES.map((r) => f(r)).join(' | ')} |`);
for (const [label, f] of results.analyser ?? []) row(label, f);
if (results.ouverture) {
  const o = results.ouverture;
  row(`Ouverture voile ${HEURES} h 5 Hz : titre / trace / chiffres`, (r) => `${sec(o[r].titre)} / ${sec(o[r].trace)} / ${sec(o[r].chiffres)}`);
  row('Ouverture : tâche max / bloqué / fil libre à', (r) => `${sec(o[r].max)} / ${sec(o[r].total)} / ${sec(o[r].libre)}`);
  row('Ouverture : DOMParser (lecture du GPX)', (r) => sec(o[r].dom));
}
if (results.quitter) {
  const q = results.quitter;
  row('Quitter à 100 ms : DOMParser (nombre, durée) / tâche max / bloqué', (r) => `${q[r].parses} (${sec(q[r].dom)}) / ${sec(q[r].max)} / ${sec(q[r].total)}`);
}
if (results.seuil) {
  const s = results.seuil;
  row('Seuil changé : chiffres / DOM calme', (r) => `${sec(s[r].chiffres)} / ${sec(s[r].calme)}`);
  row('Seuil changé : tâche max / bloqué', (r) => `${sec(s[r].max)} / ${sec(s[r].total)}`);
}
for (const nom of ZOOM_DEMANDEES) {
  const z = results[`zoom ${nom}`];
  if (!z) continue;
  row(`Zoom ${nom} : script / images par s / image max`, (r) => `${sec(z[r].script)} / ${(z[r].fps ?? 0).toFixed(0)} / ${sec(z[r].gap)}`);
  row(`Zoom ${nom} : tâche max / bloqué`, (r) => `${sec(z[r].max)} / ${sec(z[r].total)}`);
  console.log(`| Zoom ${nom} : lignes | entier ${z.lignes.entier} | après le geste ${z.lignes.zoome} |`);
}
if (results.resumes) {
  const s = results.resumes;
  row(`Résumés de ${COUNT} sessions : total / tâche max / bloqué`, (r) => `${sec(s[r].total)} / ${sec(s[r].max)} / ${sec(s[r].bloque)}`);
  row('Résumés : latence souris médiane / max', (r) => `${sec(s[r].latence)} / ${sec(s[r].latenceMax)}`);
}
if (results.demarrage) {
  for (const mode of Object.keys(results.demarrage)) {
    const d = results.demarrage[mode];
    row(`Démarrage ${mode} : Profil / interactif`, (r) => `${sec(d[r].rendu)} / ${d[r].interactif == null ? `> ${FENETRE_S} s` : sec(d[r].interactif)}`);
    row(`Démarrage ${mode} : tâche max / bloqué (${FENETRE_S} s) / modules`, (r) => `${sec(d[r].max)} / ${sec(d[r].total)} / ${d[r].modules}`);
  }
}

console.log('\n--- console (erreurs, avertissements) ---');
[...new Set(logs)].slice(0, 10).forEach((l) => console.log(l));
await finish('Tout passe.');
