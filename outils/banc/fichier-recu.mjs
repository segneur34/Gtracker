// Banc de test : bandeau d'un fichier reçu d'une autre application (lot 35, partie B). À verdict.
// Usage : node fichier-recu.mjs <port> [<dossier des captures>]
// Sur un profil neuf, sans réseau, serveur de développement (le script importe `/src/...` dans la page). Dure environ 30 s.
// L'intention d'Android, le greffon et sa copie ne se prouvent qu'au téléphone : ici, une fausse file privée remplace le
// greffon (`startIncomingFiles`, troisième argument), et le reste est le vrai chemin, de `importEntries` au bandeau :
//  1. page sans fichier reçu : aucun bandeau, comme une ouverture normale ;
//  2. un GPX reçu, sur la page Sessions : session rangée, copie retirée, bandeau, « Voir la session » ouvre son analyse ;
//  3. le même de nouveau, depuis l'analyse de cette session : « déjà présente », le bandeau se ferme ;
//  4. un brouillon ouvert sur l'analyse : aucune navigation seule ; « Voir la session » demande confirmation, refus : on reste ;
//  5. un fichier refusé par le téléphone, et un FIT illisible : dits, copies retirées ;
//  6. une session à classer : « Voir la session » demande son activité, puis ouvre l'analyse ;
//  7. un enregistrement en cours : rien n'est rangé avant l'arrêt ;
//  8. second essai : la fausse file tient le compte des lectures comme le greffon (`mark(id, true)` l'augmente, `list`
//     rend `tries`) ; un fichier au compte de 1 (arrêt pendant sa première lecture) est relu et rangé ; au compte de 2
//     (`MAX_INCOMING_TRIES`) il est refusé sans être relu, avec sa phrase, sa copie retirée.
import { connect } from './lib/cdp.mjs';
import { ONGLETS } from './lib/onglets.mjs';
import { traceVoile } from './lib/traces.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node fichier-recu.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

const { send, evaluate, go, settle, waitFor, wait, blockNetwork, records, shoot, clickText, check, finish, logs } = await connect({ port, width: 390, height: 844, shotDir });

// `lib/cdp.mjs` accepte toute question native : pour éprouver le refus, `confirm` de la page répond ce que le script a décidé.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `${ONGLETS}
window.__questions = [];
window.__reponse = false;
window.confirm = (message) => { window.__questions.push(message); return window.__reponse; };
` });
await blockNetwork();

const questions = () => evaluate('window.__questions');
const bodyHas = (text) => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
const notices = () => evaluate(`[...document.querySelectorAll('.shell-notice__text')].map((el) => el.textContent)`);
const seeSession = () => clickText('Voir la session', '.shell-notice button');
const closeNotice = () => evaluate(`document.querySelector('.shell-notice button[aria-label="Fermer"]')?.click()`);

/** Session de voile de 300 s (`traceVoile`) à la minute `minute` du 2 octobre 2026 ; `type` : ce que le GPX dit de son calcul (null : à classer). */
const gpxText = (minute, type) => traceVoile({ debutMs: Date.UTC(2026, 9, 2, 8, minute, 0), type, nom: `Reçue ${minute}`, secondes: 300 });

/**
 * Pose dans la page la fausse file (`window.__fauxRecus`), la branche à la vraie file, et rend la main. À refaire après un
 * chargement. `enregistrement` : l'état que la file lit (`window.__fauxEnregistrement`).
 */
const plugQueue = () => evaluate(`(async () => {
  const library = await import('/src/hooks/useSessionLibrary.ts');
  const queue = new Map();
  const listeners = [];
  const recorderListeners = [];
  window.__fauxRecus = {
    queue,
    removed: [],
    marks: [],
    receive: (name, text, refusal = null, tries = 0) => {
      queue.set(String(Date.now()) + '-' + queue.size + '__' + (refusal ?? 'ok') + '__' + name, { name, text, refusal, tries });
      listeners.forEach((listener) => listener());
    },
    recorderChanged: () => recorderListeners.forEach((listener) => listener()),
  };
  window.__fauxEnregistrement = false;
  const port = {
    list: async () => [...queue.entries()].map(([id, f]) => ({ id, name: f.name, size: f.text.length, refusal: f.refusal, tries: f.tries })),
    read: async (id) => (queue.has(id) ? new TextEncoder().encode(queue.get(id).text) : null),
    remove: async (id) => { queue.delete(id); window.__fauxRecus.removed.push(id); },
    // Comme le greffon : une lecture commencée augmente le compte, le témoin retiré le remet à 0 (copie gardée pour un autre essai).
    mark: async (id, trying) => {
      const f = queue.get(id);
      if (!f) return;
      f.tries = trying ? f.tries + 1 : 0;
      window.__fauxRecus.marks.push({ id, trying, tries: f.tries });
    },
    subscribe: (listener) => { listeners.push(listener); },
  };
  await library.startIncomingFiles(() => window.__fauxEnregistrement, (listener) => recorderListeners.push(listener), port);
  return true;
})()`);
const receive = (name, text, refusal = null, tries = 0) => evaluate(`window.__fauxRecus.receive(${JSON.stringify(name)}, ${JSON.stringify(text)}, ${JSON.stringify(refusal)}, ${tries})`);
const marks = () => evaluate('window.__fauxRecus.marks');
const queueSize = () => evaluate('window.__fauxRecus.queue.size');
const noticeWith = (text, label) => waitFor(async () => (await notices()).some((n) => n.includes(text)), { timeout: 8000, label });

// --- 1. Sans fichier reçu ---
await go('/sessions', 3000);
check('ouverture normale : aucun bandeau', (await notices()).length === 0);
await plugQueue();
await wait(300);
check('file vide : toujours aucun bandeau', (await notices()).length === 0);

// --- 2. Un GPX reçu, sur la page Sessions ---
const WING = gpxText(0, 'wingfoil');
await receive('ma sortie.gpx', WING);
await noticeWith('rangé dans la mémoire', 'bandeau rangée');
check('rangée : bandeau, nom du fichier en français', (await notices())[0] === '« ma sortie.gpx » est rangé dans la mémoire.', (await notices())[0]);
check('rangée : copie retirée', (await queueSize()) === 0);
check('rangée : une fiche', (await records()).length === 1);
check('rangée : on reste sur la page', await evaluate(`location.pathname === '/sessions'`));
await shoot('fichier-recu-range');
console.log('Voir la session :', await seeSession());
await waitFor(`location.pathname === '/voile/analyse'`, { timeout: 5000, label: 'analyse ouverte' });
await waitFor(`document.querySelectorAll('.an-carte-col .ui-tab').length > 0`, { timeout: 10000, label: 'onglets' });
check('Voir la session : l\'analyse de la session', await evaluate(`new URLSearchParams(location.search).get('session') === ${JSON.stringify((await records())[0].gpx)}`));
check('Voir la session : bandeau fermé', (await notices()).length === 0);

// --- 3. Le même, depuis son analyse ---
await receive('ma sortie.gpx', WING);
await noticeWith('déjà présente', 'bandeau déjà présente');
check('déjà présente : dit', (await notices())[0] === '« ma sortie.gpx » : cette session est déjà présente.');
check('déjà présente : rien de plus', (await records()).length === 1);
check('déjà présente : copie retirée', (await queueSize()) === 0);
await closeNotice();
await waitFor(async () => (await notices()).length === 0, { timeout: 3000, label: 'bandeau fermé' });
check('le bandeau se ferme', true);

// --- 4. Un brouillon ouvert ---
await waitFor(`[...document.querySelectorAll('.an-carte-col .ui-tab')].some((t) => t.textContent.trim() === 'matos et conditions')`, { timeout: 10000, label: 'onglets avancés' });
console.log('onglet matos :', await clickText('matos et conditions', '.an-carte-col .ui-tab'));
await waitFor(`Boolean(document.querySelector('textarea[placeholder="Commentaire libre"]'))`, { timeout: 5000, label: 'commentaire' });
await evaluate(`(() => {
  const area = document.querySelector('textarea[placeholder="Commentaire libre"]');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, 'brouillon non enregistré');
  area.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await waitFor(() => bodyHas('Enregistrer la session'), { timeout: 3000, label: 'brouillon ouvert' });
check('un brouillon est ouvert (barre « Enregistrer la session »)', await bodyHas('Enregistrer la session'));
const addressBefore = await evaluate('location.href');
await receive('autre.gpx', gpxText(10, 'kite'));
await noticeWith('autre.gpx', 'bandeau autre');
check('brouillon ouvert : aucune navigation seule', (await evaluate('location.href')) === addressBefore);
check('brouillon ouvert : la session reçue est rangée', (await records()).length === 2);
check('brouillon ouvert : aucune question tant qu\'on ne demande rien', (await questions()).length === 0);
console.log('Voir la session, refus :', await seeSession());
await wait(200);
check('Voir la session : le brouillon demande confirmation', (await questions()).length === 1);
check('refus : on reste, le bandeau reste, le brouillon aussi', (await evaluate('location.href')) === addressBefore && (await notices()).length === 1
  && await evaluate(`document.querySelector('textarea[placeholder="Commentaire libre"]')?.value === 'brouillon non enregistré'`));
await evaluate('window.__reponse = true');
console.log('Voir la session, accepté :', await seeSession());
await waitFor(async () => (await evaluate('location.href')) !== addressBefore, { timeout: 5000, label: 'autre session' });
await settle({ max: 2000, label: 'autre analyse' });
const otherFile = (await records()).map((r) => r.gpx).find((gpx) => gpx !== new URL(addressBefore).searchParams.get('session'));
check('accepté : l\'analyse de l\'autre session', await evaluate(`new URLSearchParams(location.search).get('session') === ${JSON.stringify(otherFile)}`));
check('d\'une analyse à une autre : la trace est lue', !(await bodyHas("n'est pas dans la mémoire")) && !(await bodyHas('Lecture de la session')));
check('d\'une analyse à une autre : le brouillon abandonné ne suit pas', !(await bodyHas('Enregistrer la session')));
check('d\'une analyse à une autre : une seule question de plus', (await questions()).length === 2);

// --- 5. Refusés ---
await go('/sessions', 3000);
await plugQueue();
await receive('photo.jpg', '', 'format');
await noticeWith('ni un GPX ni un FIT', 'refus du téléphone');
await receive('abime.fit', 'pas un FIT');
await noticeWith('abime.fit', 'FIT illisible');
const refused = await notices();
check('refus du téléphone : dit', refused[0] === '« photo.jpg » n\'a pas été rangé : ce n\'est ni un GPX ni un FIT.', refused[0]);
check('FIT illisible : dit, avec la raison', /^« abime\.fit » n'a pas été rangé : .+/.test(refused[1] ?? ''), refused[1]);
check('refusés : deux bandeaux, sans « Voir la session »', refused.length === 2 && !(await evaluate(`[...document.querySelectorAll('.shell-notice button')].some((b) => b.textContent.includes('Voir la session'))`)));
check('refusés : copies retirées, rien de rangé', (await queueSize()) === 0 && (await records()).length === 2);
await shoot('fichier-recu-refus');
await closeNotice();
await closeNotice();
await waitFor(async () => (await notices()).length === 0, { timeout: 3000, label: 'bandeaux fermés' });

// --- 6. À classer ---
await receive('sans type.gpx', gpxText(20, null));
await noticeWith('sans type.gpx', 'bandeau à classer');
console.log('Voir la session :', await seeSession());
await waitFor(() => bodyHas('Quelle activité ?'), { timeout: 3000, label: 'question de l\'activité' });
check('à classer : l\'activité est demandée avant l\'analyse', await evaluate(`location.pathname === '/sessions'`));
await shoot('fichier-recu-classer');
console.log('choisit Kite :', await clickText('Kite', 'button'));
await waitFor(`location.pathname === '/voile/analyse'`, { timeout: 5000, label: 'analyse après choix' });
// La fiche s'écrit un peu plus tard (écriture différée).
await waitFor(async () => (await records()).some((r) => r.sport === 'kite'), { timeout: 5000, label: 'calcul dans la fiche' });
check('à classer : analyse ouverte, activité gardée dans la fiche', true);

// --- 7. Enregistrement en cours ---
await go('/sessions', 3000);
await plugQueue();
await evaluate('window.__fauxEnregistrement = true');
await receive('pendant.gpx', gpxText(30, 'wingfoil'));
await wait(500);
check('pendant un enregistrement : rien de rangé, copie gardée, aucun bandeau', (await queueSize()) === 1 && (await notices()).length === 0 && (await records()).length === 3);
await evaluate('window.__fauxEnregistrement = false; window.__fauxRecus.recorderChanged()');
await noticeWith('pendant.gpx', 'rangée après l\'arrêt');
check('après l\'arrêt : rangée, copie retirée', (await queueSize()) === 0 && (await records()).length === 4);

// --- 8. Second essai ---
await go('/sessions', 3000);
await plugQueue();
const recordsBefore = (await records()).length;
// Un fichier jamais lu : la lecture commencée passe son compte à 1, puis il part avec sa copie.
await receive('neuf.gpx', gpxText(40, 'wingfoil'));
await noticeWith('neuf.gpx', 'bandeau neuf');
const firstMarks = await marks();
check('compte : une lecture commencée passe le compte à 1', firstMarks.length > 0 && firstMarks[0].trying === true && firstMarks[0].tries === 1, JSON.stringify(firstMarks));
check('compte : rangé, copie retirée', (await queueSize()) === 0 && (await records()).length === recordsBefore + 1);
// Un fichier dont le compte vaut déjà 1 : Gtracker s'est arrêté pendant sa première lecture ; il est relu et rangé.
await receive('second.gpx', gpxText(50, 'wingfoil'), null, 1);
await noticeWith('second.gpx', 'bandeau second essai');
const secondNotice = (await notices()).find((n) => n.includes('second.gpx'));
check('compte de 1 : relu et rangé, dit comme un rangement', secondNotice === '« second.gpx » est rangé dans la mémoire.', secondNotice);
const secondMarks = (await marks()).filter((m) => m.trying);
check('compte de 1 : la relecture porte le compte à 2', secondMarks.length === 2 && secondMarks[1].tries === 2, JSON.stringify(secondMarks));
check('compte de 1 : une fiche de plus, copie retirée', (await queueSize()) === 0 && (await records()).length === recordsBefore + 2);
// Un fichier dont le compte vaut 2 : refusé sans être relu, avec sa phrase, copie retirée.
await receive('fige.gpx', gpxText(55, 'wingfoil'), null, 2);
await noticeWith('fige.gpx', 'bandeau refusé au plafond');
const capNotice = (await notices()).find((n) => n.includes('fige.gpx'));
check('compte de 2 : refusé, avec la phrase', capNotice === "« fige.gpx » n'a pas été rangé : Gtracker s'est arrêté pendant sa lecture. S'il est bon, ouvrez-le de nouveau.", capNotice);
check('compte de 2 : copie retirée, rien de rangé, jamais relu', (await queueSize()) === 0 && (await records()).length === recordsBefore + 2 && (await marks()).filter((m) => m.trying).length === 2);
check('compte de 2 : pas de « Voir la session »', !(await evaluate(`[...document.querySelectorAll('.shell-notice')].some((n) => n.textContent.includes('fige.gpx') && n.textContent.includes('Voir la session'))`)));
await shoot('fichier-recu-plafond');

check('aucune question inattendue', (await questions()).length === 0);
console.log(logs.length ? `console :\n${[...new Set(logs)].join('\n')}` : 'console : aucune erreur');
await finish();
