// Banc de test : rendus de React pendant un enregistrement (lot 67, « ne redessiner que les chiffres »).
// Usage : node rendus.mjs <port> <dossier de travail, chemin Windows>
// Sur un profil neuf, sans réseau, environ 3 min 30 en temps réel (`TEMPS=10` : 25 s, mêmes ordres de grandeur).
// Une mesure, pas une preuve de neutralité (les comptes varient de quelques unités d'un passage à l'autre) : le script
// ne compare pas deux relevés, il contrôle des plafonds (`check`, voir PLAFONDS). Un faux crochet des outils de React (`__REACT_DEVTOOLS_GLOBAL_HOOK__`), posé avant tout script de la page,
// reçoit chaque commit ; l'arbre des fibres y est parcouru, et une fibre de composant compte un rendu quand elle est
// neuve dans l'arbre (clonée pour ce rendu, ou montée) et porte le drapeau « travail fait » (`PerformedWork`, 1).
// Rejeu ×1 d'une session de voile (wingfoil) de 400 s à 1 Hz : 60 s carte ouverte, 60 s carte réduite, 60 s sur l'accueil ; une ligne
// par phase et par composant suivi, puis les autres composants les plus rendus.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect } from './lib/cdp.mjs';
import { analyseOuvertePuisJetee } from './lib/fin-enregistrement.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node rendus.mjs <port> <dossier de travail>');
  process.exit(1);
}

/** Composants suivis, dans l'ordre du relevé ; ceux qui n'existent pas d'un côté comptent 0. */
const TRACKED = [
  'AppShell', 'RecordingClock', 'RecordButton', 'RecordingPage', 'RecordingScreen', 'RecordingMap', 'LiveMap',
  'RecordingFigures', 'RecordingGpsCard', 'MarkGuideSlot',
];
const PHASE_MS = 60000;

const HOOK = `(() => {
  const counts = new Map();
  let previous = new Set();
  let commits = 0;
  const nameOf = (type) => {
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (type && typeof type === 'object' && typeof type.type === 'function') return type.type.displayName || type.type.name || null;
    return null;
  };
  const onCommit = (root) => {
    commits++;
    const seen = new Set();
    const stack = [root.current];
    while (stack.length > 0) {
      const fiber = stack.pop();
      const name = nameOf(fiber.type);
      if (name) {
        seen.add(fiber);
        if (!previous.has(fiber) && (fiber.flags & 1) === 1) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    previous = seen;
  };
  let nextId = 1;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) { const id = nextId++; this.renderers.set(id, renderer); return id; },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) { try { onCommit(root); } catch (err) { console.debug('[rendus] ' + err); } },
    onPostCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    checkDCE() {},
  };
  window.__rendus = {
    reset() { counts.clear(); commits = 0; },
    read() { return { commits, counts: Object.fromEntries(counts) }; },
  };
})()`;

const { send, evaluate, go, settle, waitFor, wait, vwait, blockNetwork, importFiles, click, clickText, check, finish, logs } =
  await connect({ port, width: 1400, height: 1000 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
await blockNetwork();

// Voile de 401 points à 1 Hz (t = 0 à 400 s).
const path = join(workDir, 'rendus-voile.gpx');
writeFileSync(path, traceVoile({ debutMs: Date.parse('2026-01-15T09:00:00Z'), nom: 'Rejeu', bords: 1, secondes: 401 }));

await go('/enregistrer', 6000);
console.log('famille Voile :', await clickText('Voile', '[aria-label=Famille] button'));
await wait(300);
console.log('activité :', await evaluate(`[...document.querySelectorAll('[aria-pressed="true"], [aria-checked="true"], [aria-selected="true"]')].map((b) => b.textContent.trim()).filter(Boolean).join(' | ')`));
await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
await wait(300);
console.log('GPX :', await importFiles(path));
await waitFor(`document.body.innerText.includes('401 points')`, { timeout: 5000, label: 'rejeu chargé' });
console.log('vitesse ×1 :', await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '1'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`));
console.log('Démarrer :', await clickText('Démarrer'));
await vwait(3000);

const phase = async (label) => {
  await evaluate('window.__rendus.reset()');
  await vwait(PHASE_MS);
  const { commits, counts } = await evaluate('window.__rendus.read()');
  console.log(`--- ${label} (${PHASE_MS / 1000} s) : ${commits} commits ---`);
  for (const name of TRACKED) console.log(`${name.padEnd(22)} ${counts[name] ?? 0}`);
  const others = Object.entries(counts).filter(([n]) => !TRACKED.includes(n)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`autres : ${others.map(([n, c]) => `${n} ${c}`).join(', ')}`);
  return { commits, counts };
};

const ouverte = await phase('carte ouverte');
console.log('Réduire la carte :', await clickText('Réduire la carte'));
await vwait(1000);
const reduite = await phase('carte réduite');
console.log('Accueil :', await click('.shell-brand'));
await vwait(1000);
const accueil = await phase('accueil');

// Retour à Enregistrer par le lien du haut (sans recharger), arrêt tenu, session jetée.
console.log('Enregistrer :', await click('.shell-toprecord'));
await vwait(1000);
const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
if (down === 'ok') {
  await vwait(2300);
  await evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
}
console.log('Arrêter :', down);
// L'analyse s'ouvre seule, la session se jette depuis son menu « … ».
{ const fin = await analyseOuvertePuisJetee(evaluate); check('arrêt tenu : analyse ouverte seule, puis session jetée', fin === 'ok', fin); }
await settle({ max: 2000 });

// Plafonds, larges (les comptes varient de quelques unités d'un passage à l'autre) : avant le lot 67, la page entière
// (`RecordingScreen` 90, `AppShell` 60 par minute) se redessinait à chaque position ; aujourd'hui seuls les chiffres,
// la carte et l'horloge le font.
const n = (phase, name) => phase.counts[name] ?? 0;
/** Le détail (les comptes) n'est écrit qu'en cas d'échec : le relevé d'un passage reste comparable à l'autre. */
const plafond = (label, ok, detail = '') => check(label, ok, ok ? '' : detail);
for (const [label, phase] of [['carte ouverte', ouverte], ['carte réduite', reduite], ['accueil', accueil]]) {
  const page = n(phase, 'AppShell') + n(phase, 'RecordingPage') + n(phase, 'RecordingScreen');
  plafond(`${label} : la page entière ne se redessine pas (AppShell, RecordingPage, RecordingScreen)`, page <= 10, `${page} rendus en 60 s`);
  plafond(`${label} : pas plus de 2 commits par seconde`, phase.commits <= 120, `${phase.commits} commits`);
  plafond(`${label} : l'horloge de l'enregistrement avance (au moins 40 rendus en 60 s)`, n(phase, 'RecordingClock') >= 40, String(n(phase, 'RecordingClock')));
}
plafond('carte ouverte : la carte du direct se redessine à chaque position, au plus 2 fois par seconde', n(ouverte, 'LiveMap') >= 30 && n(ouverte, 'LiveMap') <= 120, String(n(ouverte, 'LiveMap')));
plafond("carte réduite : la carte du direct n'est plus dessinée", n(reduite, 'RecordingMap') === 0 && n(reduite, 'LiveMap') === 0, `${n(reduite, 'RecordingMap')} / ${n(reduite, 'LiveMap')}`);
plafond('accueil : ni chiffres ni carte du direct redessinés', n(accueil, 'RecordingFigures') === 0 && n(accueil, 'RecordingMap') === 0 && n(accueil, 'LiveMap') === 0);

console.log('--- console ---');
for (const l of logs) console.log(l);
await finish('Tout passe.');
