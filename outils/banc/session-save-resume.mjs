// Suite de session-save.mjs (24/09/2026, reprise sur la page Sessions le 29/10, n° 84), mais
// autonome : le lanceur donne un profil Chrome neuf à chaque script. Il importe lui-même la session de voile de
// `lib/traces.mjs` (wingfoil), y enregistre un seuil de 15 nœuds, puis change l'activité de la session dans l'onglet
// réglages (Wingfoil vers Kite : recalcul complet) ; ensuite son seuil est enregistré à 4 et 12 nœuds, et le résumé de
// la fiche doit suivre. Pour finir (lot 313), un brouillon ouvert, la session est jetée depuis le menu « … » de son
// analyse (« Jeter » tenu une seconde, confirmé) : retour à la page Sessions, session absente de la mémoire.
// Usage : node session-save-resume.mjs <port>
import { connect } from './lib/cdp.mjs';
import { jeterDepuisAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node session-save-resume.mjs <port>');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, blockNetwork, importGpx, clickText, records, check, finish, logs } = await connect({ port, width: 1400, height: 1000 });

const step = (title) => console.log(`\n== ${title}`);
const typeInto = (selector, value) => evaluate(`(() => {
  const el = ${selector};
  if (!el) return 'absent';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
const THRESHOLD_INPUT = `document.querySelector('input[aria-label="Seuil d\\'activité"]')`;
const openTab = (label) => evaluate(`(() => {
  const t = [...document.querySelectorAll('.an-carte-col .ui-tab')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!t) return 'absent';
  if (t.getAttribute('aria-pressed') !== 'true') t.click();
  return 'ok';
})()`);
/** Choisit une activité dans le choix d'activité de l'analyse : 'ok' ou 'absent'. */
const chooseActivity = (text) => evaluate(`(async () => {
  for (const button of document.querySelectorAll('button.activity-select:not(:disabled)')) {
    button.click();
    await new Promise((r) => setTimeout(r, 150));
    const item = [...document.querySelectorAll('.activity-select__option')].find((o) => o.textContent.trim() === ${JSON.stringify(text)});
    if (item) { item.click(); return 'ok'; }
    document.querySelector('.activity-select__backdrop')?.click();
    await new Promise((r) => setTimeout(r, 150));
  }
  return 'absent';
})()`);
const fiche = async (file) => {
  const r = (await records())?.find((x) => x.gpx === file);
  return r ? JSON.stringify({ sport: r.sport, analysis: r.analysis, movingTimeS: Math.round(r.summary?.movingTimeS ?? 0) }) : 'fiche absente';
};
const activeTime = () => evaluate(`document.body.innerText.match(/Temps (actif|en vol)[^\\n]*\\n[^\\n]*/)?.[0].replace(/\\n/g, ' ') ?? '(absent)'`);

// Rangée « avancé » des analyses ouverte d'office (`lib/onglets.mjs`) : tous les onglets restent dans la barre.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();

step('Import de la session de voile (wingfoil), ouverture de son analyse');
await go('/sessions', 3000);
console.log('import :', await importGpx(traceVoile({ nom: 'Synthétique', virageMin: 3 }), 'synthetique.gpx'));
await waitFor(async () => (await records())?.some((r) => r.summary?.movingTimeS !== undefined), { timeout: 8000, label: 'fiche' });
await settle({ max: 2000, label: 'import' });
const file = (await records())?.[0]?.gpx ?? '';
check('une fiche rangée, en wingfoil', file !== '' && (await records())[0].sport === 'wingfoil', file);
const url = `/voile/analyse?session=${encodeURIComponent(file)}`;
await go(url, 6000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 1000, label: 'analyse' });

step('Seuil de 15 nœuds enregistré sur la session');
console.log('onglet réglages :', await openTab('réglages'));
await settle({ max: 800, label: 'onglet réglages' });
const movingFree = JSON.parse(await fiche(file)).movingTimeS;
console.log('saisie :', await typeInto(THRESHOLD_INPUT, '15'));
await settle({ max: 1500, label: 'seuil saisi' });
console.log('clic :', await clickText('Enregistrer la session'));
await waitFor(async () => JSON.parse(await fiche(file)).analysis?.activeThreshold === 15, { timeout: 4000, label: 'fiche écrite' });
await settle({ max: 3000, label: 'enregistrement' });
const withThreshold = JSON.parse(await fiche(file));
check('seuil de la session dans la fiche, résumé recalculé', withThreshold.analysis?.activeThreshold === 15 && withThreshold.movingTimeS !== movingFree, `${movingFree} → ${withThreshold.movingTimeS}`);

step('Activité Kite : le seuil de la session est effacé, résumé recalculé');
console.log('onglet réglages :', await openTab('réglages'));
await settle({ max: 800, label: 'onglet réglages' });
console.log('Kite :', await chooseActivity('Kite'));
await settle({ max: 4000, label: 'changement d’activité' });
const kite = JSON.parse(await fiche(file));
console.log('fiche :', JSON.stringify(kite), '| seuil affiché :', await evaluate(`${THRESHOLD_INPUT}?.value`));
check('la session est passée en kite', kite.sport === 'kite', String(kite.sport));
check('le seuil de la session est effacé', (kite.analysis?.activeThreshold ?? null) === null, JSON.stringify(kite.analysis));

for (const seuil of ['4', '12']) {
  step(`Seuil ${seuil} nds enregistré`);
  await openTab('réglages');
  await settle({ max: 800, label: 'onglet réglages' });
  console.log('saisie :', await typeInto(THRESHOLD_INPUT, seuil));
  await settle({ max: 3000, label: 'seuil saisi' });
  const before = (await fiche(file));
  console.log('clic :', await clickText('Enregistrer la session'));
  await waitFor(async () => (await fiche(file)) !== before, { timeout: 4000, label: 'fiche écrite' });
  await settle({ max: 4000, label: 'enregistrement' });
  await openTab('général');
  await settle({ max: 800, label: 'onglet général' });
  const page = await activeTime();
  const now = JSON.parse(await fiche(file));
  console.log('page :', page, '| fiche :', JSON.stringify(now));
  check(`seuil de ${seuil} nds dans la fiche`, Math.abs((now.analysis?.activeThreshold ?? -1) - Number(seuil)) < 1e-6, JSON.stringify(now.analysis?.activeThreshold));
  check(`la page dit « ≥${seuil} nds »`, page.includes(`≥${seuil} nds`), page);
  check(`le résumé de la fiche suit le seuil de ${seuil} nds`, now.movingTimeS !== JSON.parse(before).movingTimeS, `${JSON.parse(before).movingTimeS} → ${now.movingTimeS}`);
}

step('« Jeter » depuis l\'analyse, un brouillon ouvert (lot 313) : page Sessions, session absente');
// L'analyse est rouverte.
// La page Sessions, puis l'analyse : l'entrée sous l'analyse est la page Sessions, comme sur le téléphone.
await go('/sessions', 3000);
await go(url, 6000);
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'matos et conditions')`, { timeout: 30000, every: 200, label: 'onglets avancés' });
await openTab('matos et conditions');
await settle({ max: 800, label: 'onglet matos' });
console.log('saisie du brouillon :', await evaluate(`(() => {
  const el = document.querySelector('textarea[placeholder="Commentaire libre"]');
  if (!el) return 'absent';
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'Brouillon à jeter avec la session');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`));
await settle({ max: 2000, label: 'brouillon' });
check('un brouillon est ouvert', await evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Enregistrer la session')`));
// L'analyse ne doit jamais dire sa session introuvable entre la suppression et le départ.
await evaluate(`(() => {
  window.__introuvable = false;
  const mo = new MutationObserver(() => { if (document.body.innerText.includes('pas dans la mémoire')) window.__introuvable = true; });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  return 'ok';
})()`);
const thrown = await jeterDepuisAnalyse(evaluate);
check('« Jeter » tenu puis confirmé', thrown === 'ok', thrown);
const questions = await evaluate('window.__questionsJeter ?? []');
check('une seule question, qui dit le brouillon perdu', questions.length === 1 && questions[0].includes('modifications non enregistrées'), JSON.stringify(questions));
check('retour à la page Sessions', (await evaluate('location.pathname')) === '/sessions', await evaluate('location.pathname + location.search'));
const gone = await waitFor(async () => !(await records()).some((r) => r.gpx === file), { timeout: 5000, label: 'fiche effacée' });
check('la session n\'est plus dans la mémoire', Boolean(gone), file);
check('jamais « pas dans la mémoire » affiché en partant', (await evaluate('window.__introuvable')) === false);
await evaluate('history.back()');
await settle({ max: 1500, label: 'retour arrière' });
const afterBack = await evaluate('location.pathname + location.search');
check('le retour arrière ne ramène pas à l\'analyse jetée', !afterBack.includes('/analyse'), afterBack);

step('Console');
console.log(logs.length ? logs.join('\n') : 'aucune erreur');
await finish('Tout passe.');
