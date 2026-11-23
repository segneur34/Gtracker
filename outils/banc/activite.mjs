// Banc de test : activité de la trace suivie, changement d'activité pendant l'enregistrement, carte réduite, changement
// d'activité depuis l'analyse, d'une famille à l'autre comprise (voile et surf).
// Usage : node activite.mjs <port> <dossier de travail, chemin Windows> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script :
//  1. range un itinéraire de Kite (page Itinéraires), puis vérifie que le suivre sur Enregistrer propose son activité ;
//  2. enregistre en rejeu ×10 (trace de `lib/traces.mjs`) : Wingfoil, changé en Kite pendant la saisie, carte réduite puis
//     montée ; à l'arrêt, l'analyse s'ouvre seule sur la session, rangée en Kite ;
//  3. depuis l'analyse, de Kite à Wingfoil (même famille : même module, fiche mise à jour), puis de Wingfoil à Surf avec un
//     brouillon (seuil saisi) : la confirmation est posée, la session change de module (`/surf/analyse`) et le brouillon
//     est abandonné ;
//  4. la page Sessions : la session y est rangée sous Surf (le rond Surf la montre, ceux de Wingfoil et de Kite non).
// Verdicts par `check` ; fin par « Tout passe. » ou le nombre d'échecs, code 0 ou 1.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLES, connect } from './lib/cdp.mjs';
import { attendreAnalyse } from './lib/fin-enregistrement.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { choisirActivite, lignes } from './lib/sessions.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, workDir, shotDir] = process.argv.slice(2);
if (!port || !workDir) {
  console.error('Usage : node activite.mjs <port> <dossier de travail> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, vwait, importFiles, mouse, records, shoot, clickText, check, finish, logs, onMessage } = await connect({ port, shotDir });
const dialogs = [];
onMessage((msg) => { if (msg.method === 'Page.javascriptDialogOpening') dialogs.push(msg.params.message); });

// « Arrêter » se tient (appui long réglable, 2 s par défaut) : appui, attente, puis relâcher.
const holdStop = async () => {
  const down = await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-btn--danger')].find((x) => x.textContent.includes('Arrêter') && !x.disabled && !x.closest('.ivl')); if (!b) return 'absent'; window.__stopButton = b; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return 'ok'; })()`);
  if (down !== 'ok') return down;
  await vwait(2300);
  return evaluate(`(() => { const b = window.__stopButton; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); return 'ok'; })()`);
};
/** Choisit une activité : le bouton glissant d'Enregistrer au repos, sinon la liste d'activités (le premier bouton qui la propose). */
const chooseActivity = (text) => evaluate(`(async () => {
  const radio = [...document.querySelectorAll('[aria-label=Activité] button[role=radio]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)});
  if (radio) { radio.click(); return 'ok'; }
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
const lines = (pattern) => evaluate(`document.body.innerText.split('\\n').filter((l) => ${pattern}.test(l)).join(' | ')`);
/** Famille et activité choisies sur la page Enregistrer, au repos. */
const recordChoice = async () => JSON.parse(await evaluate(`JSON.stringify({
  famille: document.querySelector('[aria-label=Famille] [aria-checked=true]')?.textContent ?? null,
  activite: document.querySelector('[aria-label=Activité] [aria-checked=true]')?.textContent ?? null,
})`));
const here = () => evaluate(`location.pathname`);
/** Activité montrée par la liste de la saisie en cours. */
const liveActivity = () => evaluate(`document.querySelector('.rec-status__activity .activity-select')?.textContent.trim() ?? null`);
const typeInto = (selector, value) => evaluate(`(() => {
  const el = ${selector};
  if (!el) return 'absent';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`);
const fichesDe = async () => (await records()).map((r) => r.record ?? r);

// Rangée « avancé » des analyses ouverte d'office, onglets posés dans `gtracker.sections` rejoués à chaque analyse (`lib/onglets.mjs`, 05/11) ; `general.mjs` éprouve la rangée fermée.
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await go('/itineraires', 3000);
await evaluate(`localStorage.setItem('${CLES.planning}', JSON.stringify({ activityId: 'kite' }));
  localStorage.setItem('${CLES.sections}', JSON.stringify({ planning: { balises: true, ranger: true, liste: true, parcours: true }, 'sailing-onglets': { reglages: true }, surf: { reglages: true } })); 'ok'`);

// 1. Un itinéraire de Kite, rangé ; le suivre propose son activité.
await go('/itineraires', 3000);
const tap = async (fx, fy) => {
  const r = await evaluate(`(() => { const b = document.querySelector('.plan-map .leaflet-container').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`);
  await mouse('mousePressed', r[0] + r[2] * fx, r[1] + r[3] * fy);
  await mouse('mouseReleased', r[0] + r[2] * fx, r[1] + r[3] * fy);
  await wait(300);
};
await tap(0.3, 0.3);
await tap(0.6, 0.4);
await tap(0.5, 0.7);
await evaluate(`(() => { const i = document.querySelector('.plan-form input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Parcours kite'); i.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
console.log('Enregistrer l\'itinéraire :', await clickText('Enregistrer'));
await settle({ max: 1500 });
await go('/enregistrer', 2500);
await waitFor(`Boolean(document.querySelector('[aria-label=Famille] [aria-checked=true]'))`, { timeout: 5000, label: 'page Enregistrer' });
const depart = await recordChoice();
console.log('au départ :', JSON.stringify(depart));
check('au départ : Voile, Wingfoil (la première activité de la voile)', depart.famille === 'Avec vent' && depart.activite === 'Wingfoil', JSON.stringify(depart));
console.log('Suivre une trace :', await clickText('Suivre une trace'));
await wait(800);
const proposes = await evaluate(`document.querySelectorAll('ul li button').length`);
console.log('itinéraires proposés :', proposes);
check('l\'itinéraire rangé est proposé', proposes >= 1, String(proposes));
await evaluate(`document.querySelector('ul li button')?.click()`);
await settle({ max: 800, label: 'itinéraire suivi' });
const suivi = await recordChoice();
console.log('suivi :', JSON.stringify(suivi), await lines('/Trace suivie/'));
check('suivre l\'itinéraire propose son activité : Kite', suivi.activite === 'Kite' && (await lines('/Trace suivie/')).includes('Parcours kite'), JSON.stringify(suivi));
console.log('Retirer :', await clickText('Retirer'));
await wait(300);
check('la trace suivie est retirée', (await lines('/Trace suivie/')) === '');

// 2. Enregistrement en rejeu à ×10 : Wingfoil, puis Kite en route ; carte réduite.
const debutMs = (await evaluate('Date.now()')) + 60000;
const gpxPath = join(workDir, 'activite-rejeu.gpx');
writeFileSync(gpxPath, traceVoile({ debutMs, nom: 'Rejeu', bords: 1, virageMin: 3 }));
console.log('activité Wingfoil :', await chooseActivity('Wingfoil'));
await evaluate(`[...document.querySelectorAll('input[type=radio]')][1].click(); 'ok'`);
await wait(300);
await importFiles(gpxPath, 'input[type=file]');
await waitFor(`[...document.querySelectorAll('select')].some((x) => [...x.options].some((o) => o.value === '600'))`, { timeout: 8000, label: 'menu de la vitesse' });
await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '600')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '10'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
console.log('Démarrer :', await clickText('Démarrer'));
await vwait(12000);
const enWingfoil = await lines('/^(Top|Bord|Distance|Vitesse)/');
console.log('en Wingfoil :', enWingfoil);
check('le direct montre ses chiffres en Wingfoil', enWingfoil !== '', enWingfoil);
console.log('vers Kite :', await chooseActivity('Kite'));
await vwait(4000);
const enKite = await liveActivity();
console.log('en Kite :', enKite, await lines('/^(Top|Bord|Distance|Vitesse)/'));
check("l'activité se change pendant l'enregistrement : Kite", enKite === 'Kite', String(enKite));
await shoot('enregistrement-kite');
console.log('Réduire la carte :', await clickText('Réduire la carte'));
await vwait(2500);
const carteReduite = await evaluate(`document.querySelectorAll('.leaflet-container').length`);
console.log('carte montée :', carteReduite);
check('carte réduite : plus de carte sur la page', carteReduite === 0, String(carteReduite));
check('carte réduite : le bouton « Afficher la carte » est là', (await evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Afficher la carte')`)) === true);
console.log('mémorisé :', await evaluate(`localStorage.getItem('${CLES.sections}')`));
await shoot('carte-reduite');
if (shotDir) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(2500);
  await shoot('carte-reduite-telephone');
  await send('Emulation.clearDeviceMetricsOverride');
}
console.log('retour en Wingfoil :', await chooseActivity('Wingfoil'));
await vwait(3000);
check('retour en Wingfoil : la carte reste réduite', (await evaluate(`document.querySelectorAll('.leaflet-container').length`)) === 0);
console.log('vers Kite :', await chooseActivity('Kite'));
await vwait(1000);
console.log('Afficher la carte :', await clickText('Afficher la carte'));
await vwait(1500);
const carteMontee = await evaluate(`document.querySelectorAll('.leaflet-container').length`);
console.log('carte montée :', carteMontee);
check('« Afficher la carte » : la carte revient', carteMontee >= 1, String(carteMontee));
console.log('Arrêter :', await holdStop());
const ouverte = await attendreAnalyse(evaluate);
console.log('analyse ouverte seule :', ouverte);
check('à l\'arrêt, l\'analyse de la session s\'ouvre seule', ouverte === 'ok', ouverte);
await settle({ max: 5000 });
const adresse = await evaluate(`location.pathname + location.search`);
console.log('ouverte :', adresse, await evaluate(`document.querySelector('h1')?.textContent`));
check('analyse de voile', adresse.startsWith('/voile/analyse?session='), adresse);
const fiches = await fichesDe();
console.log('fiches :', JSON.stringify(fiches.map((r) => [r.sport, r.activityId])));
check('la session est rangée en Kite', fiches.length === 1 && fiches[0].activityId === 'kite', JSON.stringify(fiches.map((r) => [r.sport, r.activityId])));
const aiguilles = fiches[0]?.gpx ?? '';

// 3. Depuis l'analyse : vers Wingfoil (même module), puis vers Surf avec un brouillon (la session change de module).
console.log('vers Wingfoil :', await chooseActivity('Wingfoil'));
await settle({ max: 4000 });
const sousVoile = await fichesDe();
console.log('ouverte :', await here(), JSON.stringify(sousVoile.map((r) => [r.sport, r.activityId])));
check('de Kite à Wingfoil : même module, fiche mise à jour', (await here()) === '/voile/analyse' && sousVoile.some((r) => r.activityId === 'wingfoil'), JSON.stringify(sousVoile.map((r) => [r.sport, r.activityId])));
const brouillon = await typeInto(`document.querySelector('input[aria-label="Seuil d\\'activité"]')`, '4');
await settle({ max: 1500 });
const barre = await lines('/Non enregistr/');
console.log('brouillon :', brouillon, barre);
check('un seuil saisi laisse un brouillon « Non enregistré »', brouillon === 'ok' && barre !== '', barre);
const questions = dialogs.length;
console.log('vers Surf :', await chooseActivity('Surf'));
await settle({ max: 4000 });
console.log('ouverte :', await here(), await evaluate(`document.querySelector('h1')?.textContent`));
console.log('confirmations :', dialogs.slice(questions).join(' | ') || '(aucune)');
check('un brouillon : la bascule demande confirmation', dialogs.length > questions, dialogs.at(-1) ?? 'aucune');
check('de Wingfoil à Surf : la session passe dans le module du surf', (await here()) === '/surf/analyse', await here());
const brouillonSurf = (await lines('/Non enregistr/')) || 'aucun';
console.log('brouillon en surf :', brouillonSurf);
check('le brouillon est abandonné avec le changement de famille', brouillonSurf === 'aucun', brouillonSurf);
const sousSurf = (await fichesDe()).find((r) => r.gpx === aiguilles);
check('la fiche est en surf', sousSurf?.sport === 'surf' && sousSurf?.activityId === 'surf', JSON.stringify([sousSurf?.sport, sousSurf?.activityId]));

// 4. Page Sessions : la session est rangée sous Surf, plus sous les activités de la voile.
await go('/sessions', 2500);
await waitFor(`Boolean(document.querySelector('.activity-bubbles'))`, { timeout: 4000, label: 'page Sessions' });
const toutes = await lignes(evaluate);
console.log('liste des sessions :', JSON.stringify(toutes));
check('page Sessions, « Toutes » : une seule ligne, en Surf', toutes.length === 1 && toutes[0].startsWith('Surf'), JSON.stringify(toutes));
check('rond Surf : la session est là', (await choisirActivite(evaluate, 'Surf')) === 'ok' && (await wait(300), (await lignes(evaluate)).length) === 1);
const surfSeul = await evaluate(`document.querySelector('.shell-main').innerText`);
check('rond Surf : le total dit « 1 session »', /1 session/.test(surfSeul), surfSeul.slice(0, 200));
for (const nom of ['Wingfoil', 'Kite']) {
  await choisirActivite(evaluate, nom);
  await wait(300);
  check(`rond ${nom} : plus de session`, (await lignes(evaluate)).length === 0 && /Aucune session/.test(await evaluate(`document.querySelector('.shell-main').innerText`)), (await lignes(evaluate)).join(' | '));
}

console.log('--- confirmations ---');
dialogs.forEach((d) => console.log(d));
check('aucune erreur de console', logs.length === 0, [...new Set(logs)].slice(0, 5).join(' | '));
await finish();
