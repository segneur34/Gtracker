// Banc de test : textes restés en français et largeurs, dans la langue du passage (anglais ou espagnol).
// Usage : node langues.mjs <port> <dossier de travail> ; par le lanceur : `node outils/banc/passe.mjs langues --langue en -j 1`.
// La langue est celle de l'application dans la page (`lib/langue.mjs`) : en français, seul le contrôle des largeurs est fait.
//  1. importe une session de voile et une de surf par la page ;
//  2. parcourt les pages (Profil, Sessions, les deux analyses en « général » puis « avancé » tous onglets ouverts et
//     aides « ? » ouvertes, Enregistrer à l'arrêt, en cours puis terminé, Planifier, Itinéraires, Statistiques onglet par
//     onglet, Réglages tout ouvert, test de FC repos, tutoriels un à un) et relève tout texte visible (nœuds de texte,
//     `aria-label`, `title`, `placeholder`, `alt`) resté en français : texte égal à une clé du dictionnaire dont la
//     traduction diffère (variables comprises, balises ôtées), ou signes sûrs de français (lettres accentuées absentes de
//     la langue visée, mots-outils français, élision « l' », « d' ») ;
//  3. contrôle les largeurs à 1400 et 1000 px (barre du haut sur une ligne, barre d'onglets des analyses) et à 390 et
//     320 px (barre du bas à cinq cases, en-tête d'analyse sur une ligne, libellé plus large que son bouton) ;
//  4. écrit `rapport.md` dans le dossier de travail. Le script relève, il ne juge pas : seuls des `check` de complétude.
// Les clics passent par des sélecteurs ou par le texte traduit lu dans `src/locales/<langue>.json`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect } from './lib/cdp.mjs';
import { dictionnaire, langueDeLaPage, MARQUE_CONTEXTE, traducteur } from './lib/langue.mjs';
import { traceSurf, traceVoile } from './lib/traces.mjs';

const [port, workDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node langues.mjs <port> <dossier de travail>');
  process.exit(1);
}
mkdirSync(workDir, { recursive: true });

const { send, evaluate, go: goRaw, settle, waitFor, wait, blockNetwork, importGpx, importFiles, records, logs, check, finish } = await connect({ port });
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};
const setSize = async (s) => {
  await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: s.mobile, maxTouchPoints: 5 });
};
const PC = { w: 1400, h: 1000, mobile: false };
const LARGEURS = [PC, { w: 1000, h: 800, mobile: false }, { w: 390, h: 844, mobile: true }, { w: 320, h: 640, mobile: true }];
const sizeLabel = (s) => `${s.w}x${s.h}`;

// --- Sessions synthétiques, aux noms sans accent (un nom de session est une donnée, jamais traduite) ---
const T = { voile: Date.UTC(2026, 9, 5, 13), surf: Date.UTC(2026, 9, 7, 7) };
const MORNING = [
  [60, 0], [60, 1.2], [50, 1], [4, 0.1], [40, 1], [4, 0.1], [26, 1], [90, 0.1],
  [6, 1.6, 180], [12, 5, 200], [100, 1], [60, 0.1], [5, 1.5, 180], [6, 6, 160], [2, 6, 250], [2, 6, 120], [10, 6, 160], [40, 1],
];
const SESSIONS = [
  { key: 'voile', gpx: traceVoile({ debutMs: T.voile, virageMin: 3, nom: 'Banc' }) },
  { key: 'surf', gpx: traceSurf({ debutMs: T.surf, phases: MORNING, nom: 'Banc' }) },
];

await blockNetwork();
await setSize(PC);
const paths = {};
let langue = 'fr';
let tr = (cle) => cle;
let dict = {};
for (const s of SESSIONS) {
  await go(`/${s.key}`, 3000);
  if (s === SESSIONS[0]) { langue = await langueDeLaPage(evaluate); dict = dictionnaire(langue); tr = traducteur(dict); }
  const imported = await importGpx(s.gpx, `${s.key}.gpx`);
  await waitFor(async () => (await records())?.some((r) => Math.abs((r.summary?.startMs ?? 0) - T[s.key]) < 2000), { timeout: 9000, label: `fiche ${s.key}` });
  await settle({ max: 2000, label: `import ${s.key}` });
  const rec = (await records()).find((r) => Math.abs((r.summary?.startMs ?? 0) - T[s.key]) < 2000);
  console.log(`import ${s.key} : ${imported}, fiche : ${Boolean(rec)}`);
  paths[s.key] = `/${s.key}/analyse?session=${encodeURIComponent(rec?.gpx ?? '')}`;
}
console.log(`langue de la page : ${langue}`);
const relever = langue !== 'fr';

// --- Ce qui trahit le français ---
const norme = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** Textes de la langue visée : un texte qui en est un n'est jamais relevé (« Sessions », « Surf », « Total »…). */
const cibles = new Set(Object.values(dict).map(norme));
const exactes = new Map(); // texte français → traduction
const motifs = []; // { re, cle } pour les clés à variables
for (const [cleBrute, valeur] of Object.entries(dict)) {
  const cle = norme(cleBrute.split(MARQUE_CONTEXTE)[0]);
  if (!cle || cle === norme(valeur) || cibles.has(cle)) continue;
  if (!cle.includes('{')) { exactes.set(cle, valeur); continue; }
  const fixe = cle.replace(/\{[^}]+\}/g, '');
  if (fixe.replace(/[^\p{L}]/gu, '').length < 8) continue;
  const re = new RegExp(`^${cle.split(/\{[^}]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?')}$`, 'u');
  motifs.push({ re, cle });
}
const ACCENTS = langue === 'es' ? /[èêëàâçœùûîïô]/ : /[éèêëàâçœùûîïô]/;
const MOTS_FR = langue === 'es'
  ? ['des', 'du', 'est', 'pour', 'avec', 'sans', 'dans', 'aucun', 'aucune', 'vous', 'votre', 'vos', 'cette', 'être', 'pas', 'aux', 'au', 'et', 'ou', 'une', 'puis', 'ici', 'leur', 'sont', 'ce']
  : ['de', 'la', 'le', 'les', 'des', 'du', 'est', 'pour', 'avec', 'sans', 'dans', 'aucun', 'aucune', 'vous', 'votre', 'vos', 'cette', 'être', 'pas', 'aux', 'au', 'et', 'ou', 'une', 'un', 'sur', 'puis', 'ici', 'leur', 'sont', 'ce'];
const RE_MOTS = new RegExp(`(?<![\\p{L}'’])(${MOTS_FR.join('|')})(?![\\p{L}'’])`, 'giu');
const RE_ELISION = /(?<![\p{L}])(l|d|qu|n|j|s|c|jusqu)['’][\p{L}]/iu;
/** Noms jamais traduits, qui portent des lettres accentuées. */
const NOMS = new Set(['Français', 'English', 'Español', 'Live for it.']);
const raison = (texte) => {
  const s = norme(texte);
  if (!s || NOMS.has(s) || cibles.has(s)) return null;
  if (exactes.has(s)) return `clé « ${exactes.get(s)} »`;
  for (const m of motifs) if (m.re.test(s)) return `clé à variables « ${m.cle} »`;
  if (!/\p{L}{2}/u.test(s)) return null;
  if (ACCENTS.test(s)) return 'lettre accentuée';
  const mots = new Set([...s.matchAll(RE_MOTS)].map((x) => x[1].toLowerCase()));
  const elision = RE_ELISION.test(s);
  if (mots.size + (elision ? 1 : 0) >= 2 && s.split(' ').length >= 3) return `mots-outils (${[...mots].join(', ')}${elision ? ', élision' : ''})`;
  return null;
};

// --- Relevé des textes, exécuté dans la page ---
const COLLECT = `(() => {
  const out = [];
  const desc = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) {
      const cls = [...(e.classList ?? [])].filter((c) => !/^(ui-btn|ui-tab)$/.test(c)).slice(0, 2).map((c) => '.' + c).join('');
      parts.unshift(e.tagName.toLowerCase() + cls);
    }
    return parts.join(' > ');
  };
  const shown = (el) => el.closest('.ui-more') || el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const skip = (el) => el.closest('script, style, noscript, .leaflet-control-attribution, textarea, [contenteditable]');
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const s = n.textContent.replace(/\\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!s || !el || skip(el) || !shown(el)) continue;
    const whole = (el.textContent ?? '').replace(/\\s+/g, ' ').trim();
    out.push({ s, whole: whole !== s && whole.length <= 240 ? whole : null, where: desc(el) });
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], img[alt]')) {
    if (skip(el) || !shown(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push({ s: v.trim(), whole: null, where: desc(el) + ' [' + a + ']' });
    }
  }
  return out;
})()`;

const restes = new Map(); // page → Map(texte → { where, raison })
const vus = new Set();
const examines = new Map(); // page → plus grand nombre de textes lus en une fois
async function collect(page) {
  vus.add(page);
  if (!relever) return;
  const list = (await evaluate(COLLECT)) ?? [];
  examines.set(page, Math.max(examines.get(page) ?? 0, list.length));
  const m = restes.get(page) ?? new Map();
  for (const { s, whole, where } of list) {
    const r = raison(s) ?? (whole ? raison(whole) : null);
    if (!r) continue;
    const texte = raison(s) ? s : whole;
    if (!m.has(texte)) m.set(texte, { where, raison: r });
  }
  restes.set(page, m);
}

// --- Dépliages ---
const OPEN_ALL = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let pass = 0; pass < 6; pass++) {
    const tabs = [...document.querySelectorAll('.an-carte-col .ui-tab')].filter((b) => b.getAttribute('aria-pressed') === 'false' && !b.classList.contains('an-tabs-advanced-toggle'));
    const folds = [...document.querySelectorAll('[aria-expanded="false"]')].filter((b) => !b.classList.contains('an-tabs-advanced-toggle') && !b.classList.contains('ui-help') && !b.hasAttribute('aria-haspopup') && !b.closest('.activity-select, .ui-more') && !b.closest('.shell-tabbar, .shell-topbar'));
    // Titres de panneau repliés (\`PanelTitle\`), cartes de Réglages comprises : \`aria-expanded\` du titre (il porte aussi
    // la valeur « false » que \`folds\` relève déjà : un Set évite le double clic) ; sans cet attribut (version d'avant), le chevron sans rotation.
    const titles = [...document.querySelectorAll('.ui-panel-title')].filter((t) => {
      const a = t.getAttribute('aria-expanded');
      const replie = a !== null ? a !== 'true' : !/rotate/.test(t.querySelector('svg')?.style.transform ?? '');
      return replie && !t.dataset.bancOuvert;
    });
    titles.forEach((t) => { t.dataset.bancOuvert = '1'; });
    if (!tabs.length && !folds.length && !titles.length) break;
    for (const b of new Set([...tabs, ...folds, ...titles])) b.click();
    await wait(500);
  }
  return 'ok';
})()`;
const OPEN_HELPS = `(async () => {
  const bs = [...document.querySelectorAll('button.ui-help')].filter((b) => b.getAttribute('aria-expanded') !== 'true' && b.getAttribute('aria-pressed') !== 'true');
  for (const b of bs) b.click();
  await new Promise((r) => setTimeout(r, 400));
  return bs.length;
})()`;
const openAdvanced = () => evaluate(`(() => { const b = document.querySelector('.an-tabs-advanced-toggle'); if (!b) return 'absent'; if (b.getAttribute('aria-expanded') !== 'true') b.click(); return 'ok'; })()`);

// --- Largeurs, exécutées dans la page ---
const WIDTHS = `(() => {
  const out = [];
  const vis = (el) => el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && el.getBoundingClientRect().width > 1;
  const txt = (el) => (el.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  // Lignes : un élément commence une nouvelle ligne s'il est tout entier sous le bas de la ligne en cours.
  const lines = (els) => {
    let n = 0, bottom = -Infinity;
    for (const r of els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.top - b.top)) {
      if (r.top >= bottom - 2) { n++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom);
    }
    return n;
  };
  const top = document.querySelector('.shell-topbar');
  if (vis(top)) {
    const items = [...document.querySelectorAll('.shell-toplinks a, .shell-toprecord')].filter(vis);
    const n = lines(items);
    if (n > 1) out.push({ quoi: 'barre du haut', detail: n + ' lignes' });
    if (top.scrollWidth > top.clientWidth + 1) out.push({ quoi: 'barre du haut', detail: 'déborde : ' + top.scrollWidth + ' dans ' + top.clientWidth });
    const last = items.reduce((m, e) => Math.max(m, e.getBoundingClientRect().right), 0);
    out.push({ quoi: 'barre du haut (information)', detail: 'marge à droite ' + Math.round(top.getBoundingClientRect().right - last) + ' px', info: true });
  }
  const tabs = [...document.querySelectorAll('.an-carte-col .ui-tab')].filter(vis);
  if (tabs.length) {
    const row = tabs[0].parentElement;
    if (row.scrollWidth > row.clientWidth + 2) out.push({ quoi: "barre d'onglets", detail: 'défile : ' + row.scrollWidth + ' dans ' + row.clientWidth });
    const n = lines(tabs);
    out.push({ quoi: "barre d'onglets (information)", detail: tabs.length + ' onglets sur ' + n + ' ligne(s)', info: true });
    for (const t of tabs) if (t.getBoundingClientRect().right > row.getBoundingClientRect().right + 1) out.push({ quoi: "barre d'onglets", detail: 'onglet « ' + txt(t) + ' » sort de la rangée' });
  }
  const head = document.querySelector('.an-sheet__head');
  if (vis(head)) {
    const kids = [...head.children].filter(vis);
    const n = lines(kids);
    if (n > 1) out.push({ quoi: "en-tête d'analyse", detail: n + ' lignes (' + kids.map(txt).filter(Boolean).join(' | ').slice(0, 80) + ')' });
    if (head.scrollWidth > head.clientWidth + 1) out.push({ quoi: "en-tête d'analyse", detail: 'déborde : ' + head.scrollWidth + ' dans ' + head.clientWidth });
  }
  const bar = document.querySelector('.shell-tabbar');
  if (vis(bar)) for (const c of [...bar.children].filter(vis)) {
    const label = c.querySelector('span');
    if (!vis(label)) continue;
    const ell = getComputedStyle(label).textOverflow === 'ellipsis' && label.scrollWidth > label.clientWidth;
    if (ell || label.scrollWidth > c.getBoundingClientRect().width) out.push({ quoi: 'barre du bas', detail: '« ' + txt(c) + ' » ' + label.scrollWidth + ' dans ' + Math.round(ell ? label.clientWidth : c.getBoundingClientRect().width) + (ell ? ' (« … »)' : '') });
  }
  // Libellé plus large que son bouton, onglet ou pastille (texte qui dépasse ou se coupe).
  const vw = document.documentElement.clientWidth;
  for (const b of document.querySelectorAll('button, a.ui-btn, [role=tab], .ui-tab, .shell-tab')) {
    if (!vis(b) || b.closest('.leaflet-container') || b.getBoundingClientRect().right < 0 || b.getBoundingClientRect().left > vw) continue;
    if (!txt(b)) continue;
    const rg = document.createRange(); rg.selectNodeContents(b);
    const w = rg.getBoundingClientRect().width, bw = b.getBoundingClientRect().width;
    const cut = b.scrollWidth > b.clientWidth + 2;
    if (w > bw + 2 || cut) out.push({ quoi: 'libellé de bouton', detail: '« ' + txt(b) + ' » ' + Math.round(Math.max(w, b.scrollWidth)) + ' dans ' + Math.round(bw) });
  }
  return out;
})()`;
const largeurs = []; // { page, size, quoi, detail, info }
async function widths(page) {
  for (const s of LARGEURS) {
    await setSize(s);
    await wait(500);
    if (await evaluate(`(() => { const b = document.querySelector('.an-map-overlay__close'); if (!b) return false; b.click(); return true; })()`)) await wait(600);
    for (const d of (await evaluate(WIDTHS)) ?? []) largeurs.push({ page, size: sizeLabel(s), ...d });
    await collect(page);
  }
  await setSize(PC);
  await wait(300);
}

// --- Parcours ---
const visit = async (page, path, { ms = 2500, open = false, helps = false, width = false } = {}) => {
  await setSize(PC);
  await go(path, ms);
  if (open) { await evaluate(OPEN_ALL); await wait(600); }
  if (helps) { await evaluate(OPEN_HELPS); await wait(300); }
  await collect(page);
  if (width) await widths(page);
};

await visit('profil', '/profil', { ms: 3000, helps: true, width: true });
await visit('sessions', '/sessions', { ms: 3000, width: true });
for (const k of ['voile', 'surf']) {
  await visit(`analyse ${k} (général)`, paths[k], { ms: 7000, width: true });
  await setSize(PC);
  console.log(`analyse ${k}, avancé :`, await openAdvanced());
  await wait(600);
  await evaluate(OPEN_ALL); await wait(800);
  await collect(`analyse ${k} (avancé)`);
  await widths(`analyse ${k} (avancé)`);
  await evaluate(OPEN_HELPS); await wait(400);
  await collect(`analyse ${k} (aides)`);
}
await visit('planifier', '/itineraires', { ms: 3500, helps: true });
await visit('itinéraires', '/itineraires/liste');
await visit('statistiques', '/statistiques', { ms: 4000, helps: true, width: true });
const statTabs = (await evaluate(`[...document.querySelectorAll('.shell-main .ui-tab')].length`)) ?? 0;
for (let i = 0; i < statTabs; i++) {
  await evaluate(`(() => { const t = [...document.querySelectorAll('.shell-main .ui-tab')][${i}]; if (t && t.getAttribute('aria-pressed') !== 'true') t.click(); return 'ok'; })()`);
  await wait(700);
  await evaluate(OPEN_HELPS);
  await collect('statistiques');
}
await visit('réglages (tout ouvert)', '/parametres', { open: true, helps: true, width: true });
// Licences du complément versionné, traduites à l'affichage : la ligne Chromium (programme Windows seulement) et la
// notice du logo GONG, lue après un clic sur sa ligne (une seule ligne reste ouverte à la fois).
let licences = null;
if (relever) {
  await setSize(PC);
  await waitFor(`document.querySelectorAll('.about-license__row').length > 0`, { timeout: 6000, label: 'lignes de licences' });
  licences = await evaluate(`(async () => {
    const rows = [...document.querySelectorAll('.about-license__row')];
    const ligne = (n) => rows.find((r) => r.querySelector('.about-license__name')?.textContent.trim().startsWith(n));
    const id = (r) => r?.querySelector('.about-license__id')?.textContent.trim() ?? null;
    const logo = ligne('Logo GONG');
    if (logo && logo.getAttribute('aria-expanded') !== 'true') logo.click();
    await new Promise((r) => setTimeout(r, 500));
    return { chromium: id(ligne('Chromium')), etiquette: id(logo), notice: logo?.closest('li')?.querySelector('.about-license__text')?.textContent.trim() ?? null };
  })()`);
  console.log('licences :', JSON.stringify(licences));
  await collect('réglages (tout ouvert)');
}
await visit('test de FC repos', '/profil/fc-repos', { helps: true });
await visit('tutoriels', '/tutoriels');
const lessons = (await evaluate(`[...document.querySelectorAll('a[href^="/tutoriels/"]')].map((a) => a.getAttribute('href'))`)) ?? [];
for (const href of [...new Set(lessons)]) await visit('tutoriels', href, { ms: 2000 });
console.log(`tutoriels : ${lessons.length} leçon(s)`);

// Enregistrer à l'arrêt, en cours (rejeu ×1 d'une session de wingfoil), puis terminé.
await visit('enregistrer', '/enregistrer', { helps: true, width: true });
const replay = join(workDir, 'rejeu.gpx');
writeFileSync(replay, traceVoile({ debutMs: Date.now() - 700_000, secondes: 600, virageMin: 3, nom: 'Rejeu' }));
await setSize(PC);
await go('/enregistrer', 2500);
await evaluate(`[...document.querySelectorAll('input[type=radio]')][1]?.click(); 'ok'`);
await wait(300);
await collect('enregistrer');
await importFiles(replay, 'input[type=file]');
await settle({ max: 800 });
const started = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(tr('Démarrer'))}) ?? [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(tr('Démarrer'))})); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
console.log('rejeu :', started);
if (started === 'ok') {
  await wait(5000);
  await collect('enregistrement en cours');
  await widths('enregistrement en cours');
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes(${JSON.stringify(tr('Arrêter'))}) && !x.disabled && !x.closest('.ivl')); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down === 'ok') {
    await wait(1200);
    await collect('enregistrement en cours');
    await wait(1100);
    await evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
    await settle({ max: 1500 });
    await collect('enregistrement terminé');
  }
  console.log('arrêt :', down);
}

// --- Rapport ---
let md = `# Langues : textes restés en français et largeurs (${langue})\n\n`;
let total = 0;
if (relever) {
  md += `## Textes restés en français\n`;
  for (const [page, m] of restes) {
    total += m.size;
    md += `\n### ${page} (${m.size} sur ${examines.get(page) ?? 0} textes lus)\n`;
    for (const [texte, e] of m) md += `- « ${texte.slice(0, 160)} » — \`${e.where}\` — ${e.raison}\n`;
  }
} else md += `Langue française : pas de relevé des textes, seulement les largeurs.\n`;
md += `\n## Largeurs\n\n| page | taille | quoi | détail |\n|---|---|---|---|\n`;
for (const l of largeurs) md += `| ${l.page} | ${l.size} | ${l.quoi} | ${l.detail} |\n`;
writeFileSync(join(workDir, 'rapport.md'), md);
console.log(md);
console.log(`Textes restés en français : ${total} ; défauts de largeur : ${largeurs.filter((l) => !l.info).length}`);
console.log(`Rapport : ${join(workDir, 'rapport.md')}`);
const exceptions = [...new Set(logs.filter((l) => l.startsWith('EXCEPTION:')))];
exceptions.slice(0, 10).forEach((l) => console.log(l));
const attendues = ['profil', 'sessions', 'analyse voile (avancé)', 'analyse surf (avancé)', 'planifier', 'statistiques', 'réglages (tout ouvert)', 'test de FC repos', 'tutoriels', 'enregistrer'];
if (relever) check('le relevé reconnaît le français (clé, clé à variables, mots-outils)',
  Boolean(raison('Enregistrer la session') && raison('3 sessions ajoutées') && raison('Le vent est estimé pour cette session')), '');
if (relever) {
  const noticeAttendue = tr("Le logo GONG (symbole et mot) est une marque de son titulaire, montrée dans Gtracker pour une présentation à GONG. Ce n'est pas une licence libre : il ne se réutilise pas ailleurs sans l'accord du titulaire de la marque.");
  check('licences : la notice du logo GONG est dans la langue choisie', Boolean(licences?.notice) && licences.notice === noticeAttendue && !licences.notice.startsWith('Le logo GONG'),licences?.notice ?? '(absente)');
  check('licences : l\'étiquette « Marque de son titulaire » est traduite', licences?.etiquette === tr('Marque de son titulaire') && licences.etiquette !== 'Marque de son titulaire', licences?.etiquette ?? '(absente)');
  // Ligne Chromium : sous le programme Windows seulement (absente dans le navigateur, sans contrôle).
  if (licences?.chromium !== null && licences?.chromium !== undefined) {
    check('licences : la ligne Chromium est traduite (« BSD-3-Clause and the licences… » / « …y las licencias… »)', licences.chromium === tr('BSD-3-Clause et licences de ses composants') && licences.chromium !== 'BSD-3-Clause et licences de ses composants', licences.chromium);
  } else console.log('licences : pas de ligne Chromium (navigateur) : aucun contrôle');
}
check('chaque page est parcourue', attendues.every((p) => vus.has(p)), attendues.filter((p) => !vus.has(p)).join(', '));
check('le rejeu démarre et s’arrête', started === 'ok' && vus.has('enregistrement terminé'), String(started));
check('aucune exception de la page', exceptions.length === 0, exceptions.join(' | '));
await finish();
