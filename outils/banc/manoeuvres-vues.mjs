// Banc de test : captures de l'onglet « manœuvres » et du tableau des tops de la voile, ordinateur puis téléphone.
// Usage : node manoeuvres-vues.mjs <port> <dossier des captures> ; ne contrôle rien (relevé de captures à comparer avant et après
// par `passe.mjs manoeuvres-vues --captures --avant <commit>`), sauf la présence des onglets.
// Vues : résumé, « Détails des manœuvres » (podiums), liste de tous les virements dépliée, aide « ? » ouverte, onglet « tops » ;
// à 1400 × 1000 puis à 390 × 844 (le tiret des valeurs absentes ne doit déborder d'aucun tableau).
import { CLES, connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node manoeuvres-vues.mjs <port> <dossier des captures>');
  process.exit(1);
}
const { send, evaluate, go, settle, waitFor, wait, shoot, blockNetwork, importGpx, records, check, finish } = await connect({ port, width: 1400, height: 1000, shotDir });

await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
await blockNetwork();
await go('/voile', 3000);
await evaluate(`localStorage.setItem('${CLES.sections}', JSON.stringify({ 'sailing-onglets': { tops: true, manoeuvres: true } })); 'ok'`);
console.log('import :', await importGpx(traceVoile({ nom: 'Vues', virageMin: 3 }), 'vues.gpx'));
await waitFor(async () => (await records())?.some((r) => r.summary?.movingTimeS !== undefined), { timeout: 9000, label: 'fiche importée' });
await settle({ max: 2000, label: 'import' });
const gpx = (await records())?.[0]?.gpx ?? '';
await go(`/voile/analyse?session=${encodeURIComponent(gpx)}`, 6000);
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 30000, every: 200, label: 'onglets' });
await settle({ max: 2000 });

const onglet = (cle) => evaluate(`(() => { const b = document.querySelector('.an-tabs [data-tab=${JSON.stringify(cle)}]'); if (!b) return 'absent'; if (b.getAttribute('aria-pressed') !== 'true') b.click(); return 'ok'; })()`);
const choisir = (groupe, text) => evaluate(`(() => { const g = document.querySelector('[role=radiogroup][aria-label=${JSON.stringify(groupe)}]'); const b = g && [...g.querySelectorAll('button[role=radio]')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
const debordement = () => evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
/** Défile de page en page l'onglet ouvert, une capture par écran (au plus `n`). */
const pages = async (prefixe, n = 3) => {
  for (let k = 0; k < n; k++) {
    await evaluate(`window.scrollTo(0, ${k} * window.innerHeight * 0.85); document.querySelector('.an-carte-col')?.scrollTo?.(0, ${k} * window.innerHeight * 0.85); 'ok'`);
    await wait(250);
    await shoot(`${prefixe}-${k + 1}`);
  }
};

for (const [nom, w, h, mobile] of [['pc', 1400, 1000, false], ['tel', 390, 844, true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await settle({ max: 1500 });
  console.log(`${nom} : onglet manœuvres :`, await onglet('manoeuvres'));
  await settle({ max: 1500 });
  await pages(`man-${nom}-resume`);
  console.log(`${nom} : Détails :`, await choisir('Détails des manœuvres', 'Détails'));
  await settle({ max: 1000 });
  await pages(`man-${nom}-details`);
  console.log(`${nom} : tous les virements :`, await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.startsWith('Tous les virements')); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
  await settle({ max: 1000 });
  await pages(`man-${nom}-liste`);
  console.log(`${nom} : aide « ? » :`, await evaluate(`(() => { const b = [...document.querySelectorAll('button.ui-help')].find((x) => x.getAttribute('aria-expanded') !== 'true'); if (!b) return 'absent'; b.click(); return 'ok'; })()`));
  await wait(300);
  await pages(`man-${nom}-aide`, 2);
  check(`${nom} : manœuvres, aucun débordement horizontal`, (await debordement()) <= 0, String(await debordement()));
  console.log(`${nom} : onglet tops :`, await onglet('tops'));
  await settle({ max: 1500 });
  await pages(`man-${nom}-tops`);
  check(`${nom} : tops, aucun débordement horizontal`, (await debordement()) <= 0, String(await debordement()));
  await onglet('manoeuvres');
  await settle({ max: 1000 });
}
await finish('Tout passe.');
