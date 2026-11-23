// Banc de test : la fenêtre « Avant de partir » de la toute première ouverture et la phrase de navigation sous « Démarrer ».
// Usage : node mise-en-garde.mjs <port> [<dossier des captures>]
// Sur un profil vraiment neuf (`connect` sans `miseEnGardeVue` : la clé de la fenêtre n'est pas posée), sans réseau,
// environ 20 s. Il vérifie :
//  1. à `/profil` : la fenêtre, son titre, ses deux phrases, un seul bouton « J'ai compris », ni croix ni voile cliquable,
//     le focus sur le bouton ;
//  2. Échap, un clic sur le fond et le retour d'Android (`gtrackerBack`, serveur de développement seulement) ne la ferment pas ;
//  3. en arrivant directement sur `/enregistrer`, elle paraît aussi ;
//  4. « J'ai compris » la ferme et pose la clé ; au rechargement elle ne revient pas ;
//  5. la clé effacée à la main puis un rechargement : elle revient ;
//  6. fenêtre fermée, `/enregistrer` au repos : la phrase est entre « Démarrer » et « Suivre une trace » à 390 px, sous les deux
//     boutons côte à côte à 1280 px, lisible (voile du fond, contraste), sans débordement ;
//  7. captures : la fenêtre à 390 px, la page Enregistrer à 390 et à 1280 px.
// Il finit par « Tout passe. » ou le nombre d'échecs.
import { CLES, MISE_EN_GARDE_VUE, connect } from './lib/cdp.mjs';

const [port, shotDir] = process.argv.slice(2);
if (!port) {
  console.error('Usage : node mise-en-garde.mjs <port> [<dossier des captures>]');
  process.exit(1);
}

const { send, evaluate, go, settle, waitFor, wait, blockNetwork, shoot, check, finish, logs } = await connect({ port, width: 1280, height: 900, shotDir, miseEnGardeVue: false });
await blockNetwork();

const PHRASE_NAVIGATION = "L'application n'est ni un instrument de navigation ni un équipement de sécurité : gardez le matériel et les précautions qu'exige votre sortie.";
const PHRASE_MEDICALE = "L'application n'est pas un dispositif médical : la fréquence cardiaque et le test au repos donnent des repères pour votre pratique, pas un avis médical.";

const fenetre = () => evaluate(`document.querySelector('.ui-dialog.safety-notice') !== null`);
const cleLue = () => evaluate(`localStorage.getItem('${CLES.miseEnGarde}')`);
const overflow = () => evaluate('document.documentElement.scrollWidth > window.innerWidth');
const touche = (key, code) => send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : 0 })
  .then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }));
const developpement = async () => (await evaluate(`typeof window.gtrackerBack === 'function'`)) === true;

// --- 1. Profil neuf : la fenêtre ---
await go('/profil', 5000);
await waitFor(`document.querySelector('.ui-dialog.safety-notice') !== null`, { timeout: 5000, label: 'fenêtre' });
check('la clé n\'est pas posée au départ', (await cleLue()) === null, await cleLue());
check('la fenêtre « Avant de partir » paraît à /profil', await fenetre());
const dialogue = await evaluate(`(() => {
  const d = document.querySelector('.ui-dialog.safety-notice');
  if (!d) return null;
  const boutons = [...d.querySelectorAll('button')].map((b) => b.textContent.trim().toLowerCase());
  return { role: d.getAttribute('role'), label: d.getAttribute('aria-label'), texte: d.textContent, croix: d.querySelector('.ui-dialog__close') !== null, boutons, paragraphes: [...d.querySelectorAll('p')].map((p) => p.textContent.trim()) };
})()`);
check('rôle dialogue, titre « Avant de partir »', dialogue?.role === 'dialog' && dialogue?.label === 'Avant de partir' && dialogue.texte.includes('Avant de partir'), JSON.stringify(dialogue?.label));
check('les deux phrases, dans l\'ordre', dialogue?.paragraphes.join(' | ') === `${PHRASE_NAVIGATION} | ${PHRASE_MEDICALE}`, dialogue?.paragraphes.join(' | '));
check('ni croix', dialogue?.croix === false);
check('un seul bouton : « J\'ai compris »', dialogue?.boutons.length === 1 && dialogue.boutons[0] === "j'ai compris", dialogue?.boutons.join(', '));
check('le focus est sur le bouton', (await evaluate(`document.activeElement?.closest('.safety-notice__actions') !== null && document.activeElement?.tagName === 'BUTTON'`)) === true);
await shoot('mise-en-garde-profil-1280');

// --- 2. Ce qui ne la ferme pas ---
await touche('Escape', 'Escape');
await settle({ max: 500 });
check('Échap ne la ferme pas', await fenetre());
// Clic au bord de l'écran, sur le fond : il ne doit rien fermer.
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 4, y: 4, button: 'left', buttons: 1, clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 4, y: 4, button: 'left', buttons: 0, clickCount: 1 });
await settle({ max: 500 });
check('un clic sur le fond ne la ferme pas', await fenetre());
if (await developpement()) {
  const retour = await evaluate(`window.gtrackerBack()`);
  await settle({ max: 500 });
  check('le retour d\'Android est absorbé (« layer ») et la fenêtre reste', retour === 'layer' && (await fenetre()), retour);
} else {
  console.log('retour d\'Android : poignée absente (version construite), essai passé');
}
check('la clé n\'est toujours pas posée', (await cleLue()) === null, await cleLue());

// --- 3. Arrivée directe sur /enregistrer ---
await go('/enregistrer', 5000);
await waitFor(`document.querySelector('.ui-dialog.safety-notice') !== null`, { timeout: 5000, label: 'fenêtre sur Enregistrer' });
check('elle paraît aussi en arrivant sur /enregistrer', await fenetre());

// --- 4. « J'ai compris » ---
const clic = await evaluate(`(() => { const b = document.querySelector('.safety-notice__actions button'); if (!b) return 'absent'; b.click(); return 'ok'; })()`);
await settle({ max: 800 });
check('« J\'ai compris » la ferme', clic === 'ok' && !(await fenetre()), clic);
check('la clé vaut la valeur attendue', (await cleLue()) === MISE_EN_GARDE_VUE, await cleLue());
await go('/profil', 5000);
await wait(500);
check('elle ne revient pas au rechargement', !(await fenetre()));
await go('/enregistrer', 5000);
await wait(500);
check('… ni sur /enregistrer', !(await fenetre()));

// --- 5. Clé effacée à la main ---
await evaluate(`localStorage.removeItem('${CLES.miseEnGarde}')`);
await go('/profil', 5000);
await waitFor(`document.querySelector('.ui-dialog.safety-notice') !== null`, { timeout: 5000, label: 'retour de la fenêtre' });
check('clé effacée puis rechargement : elle revient', await fenetre());
await evaluate(`document.querySelector('.safety-notice__actions button')?.click()`);
await settle({ max: 800 });
check('fermée de nouveau, clé reposée', !(await fenetre()) && (await cleLue()) === MISE_EN_GARDE_VUE);

// --- 6. La phrase sous « Démarrer » ---
/** Positions des deux boutons et de la phrase sur la page Enregistrer au repos. */
const mesures = () => evaluate(`(() => {
  const zone = document.querySelector('.rec-actions');
  if (!zone) return null;
  const boite = (el) => { const r = el.getBoundingClientRect(); return { haut: Math.round(r.top), bas: Math.round(r.bottom), gauche: Math.round(r.left), droite: Math.round(r.right) }; };
  const bouton = (texte) => [...zone.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().startsWith(texte));
  const demarrer = bouton('démarrer'), suivre = bouton('suivre une trace');
  const phrase = zone.querySelector(':scope > .rec-notice');
  const style = phrase ? getComputedStyle(phrase) : null;
  return {
    demarrer: demarrer ? boite(demarrer) : null, suivre: suivre ? boite(suivre) : null, phrase: phrase ? boite(phrase) : null,
    texte: phrase?.textContent.trim() ?? null, couleur: style?.color ?? null, fond: style?.backgroundColor ?? null,
    largeurVue: window.innerWidth,
  };
})()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/enregistrer', 5000);
await wait(500);
const mobile = await mesures();
check('390 px : la phrase de navigation est là, texte exact', mobile?.texte === PHRASE_NAVIGATION, mobile?.texte);
check('390 px : « Démarrer » au-dessus de la phrase', mobile?.demarrer && mobile.phrase && mobile.demarrer.bas <= mobile.phrase.haut, JSON.stringify(mobile));
check('390 px : « Suivre une trace » en dessous', mobile?.suivre && mobile.phrase && mobile.suivre.haut >= mobile.phrase.bas, JSON.stringify(mobile));
check('390 px : la phrase tient dans la largeur', mobile?.phrase && mobile.phrase.gauche >= 0 && mobile.phrase.droite <= 390, JSON.stringify(mobile?.phrase));
check('390 px : rien ne déborde', (await overflow()) === false);
check('390 px : la phrase a un fond (voile)', mobile?.fond && mobile.fond !== 'rgba(0, 0, 0, 0)', mobile?.fond);
await shoot('mise-en-garde-enregistrer-390');

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await go('/enregistrer', 5000);
await wait(500);
const bureau = await mesures();
check('1280 px : « Démarrer » et « Suivre une trace » côte à côte', bureau?.demarrer && bureau.suivre && Math.abs(bureau.demarrer.haut - bureau.suivre.haut) <= 2 && bureau.demarrer.droite <= bureau.suivre.gauche, JSON.stringify(bureau));
check('1280 px : la phrase sous les deux boutons', bureau?.phrase && bureau.phrase.haut >= Math.max(bureau.demarrer.bas, bureau.suivre.bas), JSON.stringify(bureau));
check('1280 px : rien ne déborde', (await overflow()) === false);
await shoot('mise-en-garde-enregistrer-1280');

// --- Fenêtre à 390 px (profil neuf, clé retirée) ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await evaluate(`localStorage.removeItem('${CLES.miseEnGarde}')`);
await go('/profil', 5000);
await waitFor(`document.querySelector('.ui-dialog.safety-notice') !== null`, { timeout: 5000, label: 'fenêtre à 390 px' });
await settle({ max: 500 });
const etroit = await evaluate(`(() => { const r = document.querySelector('.ui-dialog.safety-notice').getBoundingClientRect(); return { gauche: Math.round(r.left), droite: Math.round(r.right), haut: Math.round(r.top), bas: Math.round(r.bottom) }; })()`);
check('390 px : la fenêtre tient dans l\'écran', etroit.gauche >= 0 && etroit.droite <= 390 && etroit.haut >= 0 && etroit.bas <= 844, JSON.stringify(etroit));
check('390 px : rien ne déborde, fenêtre ouverte', (await overflow()) === false);
await shoot('mise-en-garde-fenetre-390');

const errors = logs.filter((l) => !l.startsWith('warning'));
console.log(errors.length ? `Console :\n${errors.join('\n')}` : 'Console : rien');
check('aucune erreur de console', errors.length === 0);
await finish();
