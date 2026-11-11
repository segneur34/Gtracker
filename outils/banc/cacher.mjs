// Banc de test : cacher une famille et une activité (§10, point 100 ; remis sur la voile et le surf au lot 330).
// Usage : node cacher.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau. Le script fabrique une session de wingfoil (`lib/traces.mjs`), l'importe par la page
// Voile (rangée sous Wingfoil, la première activité de voile), et vérifie :
//  1. le relevé de départ : barre du haut, barre du bas, accueil, bibliothèque Voile, Enregistrer ;
//  2. Surf caché puis Wingfoil caché, depuis leur œil dans Réglages : Surf absent des barres, de l'accueil et
//     d'Enregistrer, la barre du bas inchangée (sans sport) ; la session de Wingfoil retirée de la bibliothèque, une ligne
//     le dit ; Wingfoil absent d'Enregistrer ; tous deux toujours listés dans Réglages, grisés ;
//  3. la dernière famille visible ne se cache pas : son œil est désactivé (Surf caché, il reste Voile) ;
//  4. tout ré-affiché : chaque relevé redevient celui du départ, à la lettre.
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node cacher.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

// --- Protocole (lib/cdp.mjs) ---
const { send, evaluate, go, settle, waitFor, wait, importGpx, records, shoot, close, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
await send('Page.addScriptToEvaluateOnNewDocument', { source: ONGLETS });
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${detail ? ` : ${detail}` : ''}`);
};

// --- Session de wingfoil synthétique ---
const gpx = traceVoile({ debutMs: Date.UTC(2026, 9, 5, 9, 0, 0), nom: 'Sortie', bords: 1, virageMin: 3 });

/** Noms grisés quand Surf (famille) et Wingfoil (activité) sont cachés : Wingfoil, puis tout le Surf visible. */
const GRISES = ['Wingfoil', 'Surf', 'Pumping'];

/** Clique le bouton dont le texte ou l'étiquette est donné ; rend vrai s'il existe et n'est pas désactivé. */
const click = (selector, text) => evaluate(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => (el.getAttribute('aria-label') ?? el.textContent).trim().startsWith(${JSON.stringify(text)}));
  if (!b || b.disabled) return false;
  b.click();
  return true;
})()`);

/** Ouvre un bloc de Réglages par son titre (`PanelTitle`), si `probe` (un sélecteur de son contenu) n'y est pas encore. */
const openBlock = (label, probe) => evaluate(`(() => {
  if (document.querySelector(${JSON.stringify(probe)})) return true;
  const b = [...document.querySelectorAll('[role=button]')].find((el) => el.textContent.trim() === ${JSON.stringify(label)});
  b?.click();
  return !!b;
})()`);

/** Relevé de l'application : les deux barres, puis le texte de chaque page. */
const snapshot = async () => {
  const out = {};
  await go('/');
  out.barreHaut = await evaluate(`document.querySelector('.shell-toplinks')?.textContent`);
  out.barreBas = await evaluate(`[...document.querySelectorAll('.shell-tabbar .shell-tab')].map((t) => t.textContent.trim()).join(' | ')`);
  out.accueil = await evaluate('document.querySelector(".shell-main").innerText');
  await go('/voile', 4000);
  out.voile = await evaluate('document.querySelector(".shell-main").innerText');
  await go('/enregistrer');
  out.enregistrer = await evaluate('document.querySelector(".shell-main").innerText');
  await click('[aria-label=Famille] button', 'Voile');
  await wait(300);
  out.enregistrerVoile = await evaluate(`[...document.querySelectorAll('.shell-main [aria-label=Activité] button')].map((o) => o.textContent).join(', ')`);
  return out;
};

// --- Mise en place ---
await go('/voile', 5000);
console.log('import :', await importGpx(gpx, 'sortie.gpx'));
await waitFor(async () => (await records())?.length >= 1, { timeout: 5000, label: 'fiche' });
await settle({ max: 2000, label: 'import' });

await go('/parametres');
await openBlock('Activités', '.settings-activities');
await wait(300);
// Familles repliées depuis le lot 2 des demandes du 15/10 : toutes ouvertes.
await evaluate(`document.querySelectorAll('.settings-activities__family-toggle[aria-expanded="false"]').forEach((b) => b.click()); 'ok'`);
await wait(300);
// --- 1. Départ ---
const before = await snapshot();
console.log('\n--- départ ---');
for (const [k, v] of Object.entries(before)) console.log(`${k} : ${String(v).replace(/\s+/g, ' ').slice(0, 220)}`);
check('la session est sous Wingfoil', before.voile.includes('Wingfoil'), before.voile.replace(/\s+/g, ' ').slice(0, 160));
check('barre du bas : Accueil, Profil, Statistiques, Réglages', before.barreBas === 'Accueil | Profil | Statistiques | Réglages', before.barreBas);

// --- 2. Surf, puis Route, cachés ---
await go('/parametres');
check('œil « Cacher Surf »', await click('.settings-eye', 'Cacher Surf'));
await wait(300);
check('œil « Cacher Wingfoil »', await click('.settings-eye', 'Cacher Wingfoil'));
await wait(300);
const settingsText = await evaluate('document.querySelector(".shell-main").innerText');
const greyed = await evaluate(`[...document.querySelectorAll('.settings-activity--hidden .settings-activity__name')].map((n) => n.textContent).join(', ')`);
check('Surf et Wingfoil toujours listés dans Réglages', settingsText.includes('Pumping') && settingsText.includes('Wingfoil'));
check('grisés : Wingfoil et les activités du Surf', GRISES.every((n) => greyed.split(', ').includes(n)), greyed);
await shoot('cacher-reglages');

const hidden = await snapshot();
console.log('\n--- caché ---');
for (const [k, v] of Object.entries(hidden)) console.log(`${k} : ${String(v).replace(/\s+/g, ' ').slice(0, 220)}`);
check('barre du haut sans Surf', !hidden.barreHaut.includes('Surf'), hidden.barreHaut);
check('barre du bas inchangée', hidden.barreBas === before.barreBas, hidden.barreBas);
check('accueil sans la carte Surf (et avec, au départ)', !hidden.accueil.includes('Surf, Pumping') && before.accueil.includes('Surf, Pumping'));
check('bibliothèque Voile : session retirée et signalée', hidden.voile.includes('Activités cachées : 1 session') && hidden.voile.includes('0 session'), hidden.voile.replace(/\s+/g, ' ').slice(0, 200));
check("Enregistrer sans l'onglet Surf", !/\bSurf\b/.test(hidden.enregistrer));
check('Enregistrer › Voile sans Wingfoil', hidden.enregistrerVoile === 'Kite', hidden.enregistrerVoile);
await go('/surf', 4000);
check('/surf s’ouvre toujours, et dit qu’il est caché', (await evaluate('document.querySelector(".shell-main").innerText')).includes('est caché dans'));

// --- 3. Dernière famille ---
await go('/parametres');
const lastDisabled = await evaluate(`[...document.querySelectorAll('.settings-eye')].find((b) => b.getAttribute('aria-label').startsWith('Voile'))?.disabled`);
check('la Voile, dernière famille visible, ne se cache pas', lastDisabled === true);
await shoot('cacher-derniere');

// --- 4. Tout ré-affiché ---
check('œil « Afficher Surf »', await click('.settings-eye', 'Afficher Surf'));
await wait(300);
check('œil « Afficher Wingfoil »', await click('.settings-eye', 'Afficher Wingfoil'));
await wait(300);
const after = await snapshot();
for (const k of Object.keys(before)) check(`ré-affiché, ${k} identique au départ`, before[k] === after[k], before[k] === after[k] ? '' : String(after[k]).replace(/\s+/g, ' ').slice(0, 220));

console.log(`\n${failures === 0 ? 'Tout passe' : `${failures} échec(s)`}`);
{
  const errors = logs.filter((l) => !l.startsWith('warning'));
  if (errors.length) console.log('Console :\n' + errors.join('\n'));
}
await close();
process.exit(failures === 0 ? 0 : 1);
