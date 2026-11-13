// Banc de test : les tutoriels (lot 147, idée 142). La leçon du jour (carte « Aujourd'hui : … ») est en pause : les
// leçons, leur liste et le bloc de Réglages restent.
// Usage : node tutoriels.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau ni session, environ 30 s. L'heure de la page est décalée par un script posé avant
// son chargement (`Date` remplacé, comme `racine.mjs`) pour passer d'un jour au suivant. Il vérifie :
//  1. la pause : aux jours 1, 2 et 3, ni le Profil (l'ouverture) ni la page Sessions ne montrent de carte
//     « Aujourd'hui : … », et les jours d'ouverture ne sont plus comptés sur l'appareil (`gtracker.tutoriels`) ;
//  2. Réglages : le bloc « Tutoriels » replié au départ, ouvert : « Voir tous les tutoriels », qui ouvre la liste
//     `/tutoriels` : treize leçons dans l'ordre, aucune cochée, « 0 lue sur 13 » ;
//  3. la première leçon ouverte depuis la liste (`/tutoriels/enregistrer`) : titre, « Leçon 1 sur 13 », paragraphes,
//     « Essayer » vers Enregistrer, « Leçon suivante » sans « précédente » ; la leçon marquée lue ; le retour d'Android
//     (`gtrackerBack`) mène à la liste, puis à Réglages ;
//  4. la liste : la première cochée seule, « 1 lue sur 13 » ; le bloc de Réglages « 1 leçon lue sur 13 » ;
//  5. la pause tient encore au jour suivant, leçon lue ou non, sur le Profil ;
//  6. la voile cachée par son œil (Réglages › Activités) : la liste passe à douze leçons, sans « La voile » ;
//  7. à 390×844 : le Profil sans carte, et une leçon d'une famille cachée (son adresse s'ouvre toujours), sans
//     débordement.
// Il finit par « Tout passe. » ou le nombre d'échecs.
import { CLES, connect, POIGNEE_RETOUR } from './lib/cdp.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node tutoriels.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

const { send, evaluate, go: goRaw, waitFor, wait, shoot, check, finish, logs } = await connect({ port, width: 1400, height: 1000, shotDir });
/** Navigation, puis attente du premier rendu de l'application. */
const go = async (path, max) => {
  const ms = await goRaw(path, max);
  await waitFor(`Boolean(document.querySelector('.shell-main'))`, { timeout: 5000, every: 50, label: 'premier rendu' });
  return ms;
};

// --- Heure de la page ---
let clockScript = null;
/** Les pages suivantes croient être à `fakeMs`. */
const setClock = async (fakeMs) => {
  if (clockScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clockScript });
  const source = `(() => {
    const off = ${fakeMs - Date.now()};
    const R = Date;
    class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } }
    window.Date = D;
  })();`;
  clockScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source })).result.identifier;
};
const now = new Date();
/** Midi du jour `n` (1 : aujourd'hui). */
const dayAt = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n - 1, 12).getTime();

const stored = () => evaluate(`JSON.parse(localStorage.getItem('${CLES.tutoriels}') ?? '{}').etat ?? null`);
const path = () => evaluate('location.pathname');
/** Une carte « Aujourd'hui : … » à l'écran : titre, ou `null` quand il n'y en a pas (la leçon du jour est en pause). */
const card = () => evaluate(`document.querySelector('.tutorial-card')?.querySelector('h2')?.textContent ?? null`);
/** Le Profil posé (l'ouverture de l'application) au jour donné : la mémoire lue, puis le temps que la garde déciderait. */
const profileAt = async (dayMs) => {
  await setClock(dayMs);
  await go('/', 4000);
  await waitFor(`Boolean(document.querySelector('.profile-head__title'))`, { timeout: 4000, label: 'Profil' });
  await waitFor(`Boolean(document.querySelector('.profile-figures'))`, { timeout: 4000, label: 'chiffres du Profil' });
  await wait(600);
};
/** La page Sessions au jour donné, la liste lue. */
const sessionsAt = async (dayMs) => {
  await setClock(dayMs);
  await go('/sessions', 4000);
  await waitFor(`Boolean(document.querySelector('.activity-bubbles'))`, { timeout: 4000, label: 'Sessions' });
  await wait(600);
};
const days = async () => ((await stored())?.days ?? []).length;
const rows = () => evaluate(`[...document.querySelectorAll('.tutorial-row')].map((r) => ({ title: r.querySelector('.tutorial-row__title')?.textContent, read: !!r.querySelector('.tutorial-row__read') }))`);
const subtitle = () => evaluate(`document.querySelector('.ui-page-header__subtitle')?.textContent ?? null`);
const back = () => evaluate(`window.${POIGNEE_RETOUR} ? window.${POIGNEE_RETOUR}() : 'absent'`);
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');

// 1. La pause de la leçon du jour : ni carte sur le Profil ni sur Sessions, aucun jour compté.
await profileAt(dayAt(1));
check("jour 1 : le Profil (ouverture) sans carte « Aujourd'hui : … »", (await card()) === null, await card());
check('… ni jour compté sur l\'appareil', (await days()) === 0, JSON.stringify(await stored()));
await shoot('tutoriels-profil');
await sessionsAt(dayAt(1));
check("jour 1 : la page Sessions sans carte « Aujourd'hui : … »", (await card()) === null, await card());

// 2. Réglages, la liste, la leçon.
await go('/parametres', 3000);
const blockTitle = `[...document.querySelectorAll('[role=button]')].find((b) => b.textContent.trim() === 'Tutoriels')`;
await waitFor(`Boolean(${blockTitle})`, { timeout: 3000, label: 'bloc' });
check('Réglages : le bloc « Tutoriels », replié', (await evaluate(`Boolean(${blockTitle}) && !document.querySelector('a[href="/tutoriels"]')`)) === true);
await evaluate(`${blockTitle}.click()`);
await wait(300);
let block = await evaluate(`(() => { const a = document.querySelector('a[href="/tutoriels"]'); return a ? { link: a.textContent, text: a.parentElement.textContent } : null; })()`);
console.log('bloc ouvert :', JSON.stringify(block));
check('… ouvert : « 0 leçon lue sur 13 » et « Voir tous les tutoriels »', block?.link === 'Voir tous les tutoriels' && block?.text.includes('0 leçon lue sur 13'), JSON.stringify(block));
await evaluate(`document.querySelector('a[href="/tutoriels"]').click()`);
check('… qui ouvre la liste', (await waitFor(`location.pathname === '/tutoriels' && document.querySelectorAll('.tutorial-row').length > 0`, { timeout: 3000 })) === true, await path());
const list0 = await rows();
check('la liste : treize leçons, « Enregistrer une session » en tête, aucune cochée', list0.length === 13 && list0[0]?.title === 'Enregistrer une session' && list0.every((r) => !r.read), `${list0.length} : ${JSON.stringify(list0.map((r) => r.read))}`);
check('… « 0 lue sur 13 »', (await subtitle()) === '0 lue sur 13', await subtitle());
await evaluate(`document.querySelector('a.tutorial-row').click()`);
await waitFor(`location.pathname === '/tutoriels/enregistrer' && Boolean(document.querySelector('.tutorial-lesson'))`, { timeout: 4000, label: 'leçon' });
const lesson = await evaluate(`(() => ({
  title: document.querySelector('.ui-page-header h1')?.textContent ?? null,
  paragraphs: document.querySelectorAll('.tutorial-lesson > p').length,
  essayer: [...document.querySelectorAll('a')].find((a) => a.textContent === 'Essayer')?.getAttribute('href') ?? null,
  links: [...document.querySelectorAll('.tutorial-nav a')].map((a) => a.textContent),
  back: document.querySelector('.ui-back')?.textContent ?? null,
}))()`);
console.log('leçon :', JSON.stringify(lesson));
check('la première ligne ouvre la leçon : son titre', lesson?.title === 'Enregistrer une session', lesson?.title);
check('… « Leçon 1 sur 13 »', (await subtitle()) === 'Leçon 1 sur 13', await subtitle());
check('… 3 à 6 paragraphes', lesson?.paragraphs >= 3 && lesson?.paragraphs <= 6, lesson?.paragraphs);
check('… « Essayer » vers Enregistrer', lesson?.essayer === '/enregistrer', lesson?.essayer);
check('… « Leçon suivante » seule', JSON.stringify(lesson?.links) === JSON.stringify(['Leçon suivante']), JSON.stringify(lesson?.links));
check('… « Toutes les leçons » en tête', lesson?.back === 'Toutes les leçons', lesson?.back);
check('la leçon est marquée lue', (await stored())?.read?.includes('enregistrer') === true, JSON.stringify(await stored()));
await shoot('tutoriels-lecon');
check('retour : de la leçon à la liste', (await back()) === 'page' && (await waitFor(`location.pathname === '/tutoriels'`, { timeout: 3000 })) === true, await path());

// 3. La liste.
await waitFor(`document.querySelectorAll('.tutorial-row').length > 0`, { timeout: 3000, label: 'liste' });
const list = await rows();
check('la liste : treize leçons, « Enregistrer une session » en tête', list.length === 13 && list[0]?.title === 'Enregistrer une session', `${list.length} : ${list.map((r) => r.title).join(', ')}`);
check('… seule la première cochée', list[0]?.read === true && list.slice(1).every((r) => !r.read), JSON.stringify(list.map((r) => r.read)));
check('… « 1 lue sur 13 »', (await subtitle()) === '1 lue sur 13', await subtitle());
await shoot('tutoriels-liste');
check('retour : de la liste à Réglages', (await back()) === 'page' && (await waitFor(`location.pathname === '/parametres'`, { timeout: 3000 })) === true, await path());

// 4. Le bloc de Réglages compte la leçon lue.
await go('/parametres', 3000);
await waitFor(`Boolean(${blockTitle})`, { timeout: 3000, label: 'bloc' });
await evaluate(`(() => { if (!document.querySelector('a[href="/tutoriels"]')) ${blockTitle}.click(); })()`);
await wait(300);
block = await evaluate(`(() => { const a = document.querySelector('a[href="/tutoriels"]'); return a ? { link: a.textContent, text: a.parentElement.textContent } : null; })()`);
check('Réglages : « 1 leçon lue sur 13 » et « Voir tous les tutoriels »', block?.link === 'Voir tous les tutoriels' && block?.text.includes('1 leçon lue sur 13'), JSON.stringify(block));
await shoot('tutoriels-reglages');
await evaluate(`document.querySelector('a[href="/tutoriels"]').click()`);
check('… qui ouvre la liste', (await waitFor(`location.pathname === '/tutoriels' && document.querySelectorAll('.tutorial-row').length > 0`, { timeout: 3000 })) === true, await path());

// 5. La pause tient aux jours suivants, leçon lue ou non.
await profileAt(dayAt(2));
check("jour 2 : toujours pas de carte « Aujourd'hui : … » sur le Profil", (await card()) === null, await card());
await profileAt(dayAt(3));
check("jour 3 : toujours pas de carte, aucun jour compté", (await card()) === null && (await days()) === 0, `${await card()} ; ${JSON.stringify(await stored())}`);

// 6. La voile cachée par son œil dans Réglages › Activités : sa leçon retirée de la liste.
await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${CLES.sections}') ?? '{}'); s.settings = { ...s.settings, activites: true }; localStorage.setItem('${CLES.sections}', JSON.stringify(s)); })()`);
await go('/parametres', 3000);
const eye = `[...document.querySelectorAll('.settings-eye')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Cacher Voile'))`;
await waitFor(`Boolean(${eye})`, { timeout: 3000, label: 'œil' });
check('Réglages : l\'œil « Cacher Voile »', (await evaluate(`(() => { const b = ${eye}; if (!b) return false; b.click(); return true; })()`)) === true);
await wait(300);
await go('/tutoriels', 3000);
await waitFor(`document.querySelectorAll('.tutorial-row').length > 0`, { timeout: 3000, label: 'liste' });
const hidden = await rows();
check('la voile cachée : douze leçons, sans « La voile »', hidden.length === 12 && !hidden.some((r) => r.title === 'La voile'), `${hidden.length} : ${hidden.map((r) => r.title).join(', ')}`);
check('… « 1 lue sur 12 »', (await subtitle()) === '1 lue sur 12', await subtitle());

// 7. Téléphone.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await profileAt(dayAt(3));
check('390 px : le Profil sans carte du jour', (await card()) === null, await card());
check('390 px : rien ne déborde sur le Profil', (await overflow()) === false);
await shoot('tutoriels-profil-390');
await go('/tutoriels/voile', 3000);
await waitFor(`Boolean(document.querySelector('.tutorial-lesson'))`, { timeout: 3000, label: 'leçon' });
check('390 px : une leçon, sans débordement', (await overflow()) === false);
await shoot('tutoriels-lecon-390');

const errors = logs.filter((l) => !l.startsWith('warning'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : rien');
check('aucune erreur de console', errors.length === 0);
await finish();
