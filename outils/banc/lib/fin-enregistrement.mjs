// Banc de test : fin d'un enregistrement (lot 313). À l'arrêt, la session se range seule et son analyse s'ouvre ;
// « Jeter » est la dernière entrée du menu « … » de l'analyse, tenue une seconde puis confirmée, et ramène à la
// bibliothèque de la famille. Ces aides prennent l'`evaluate` d'une connexion (`connect`, lib/cdp.mjs) et rendent
// 'ok' ou ce qui a manqué, sans lever : le `check` ou le `console.log` du script le dit.
import { vwait, wait } from './cdp.mjs';

/** Durée tenue sur « Jeter », en temps de la page : la seconde de l'application, et une marge. */
const TENUE_MS = 1100;

/** Attend que `expr` (expression de la page) soit vraie, jusqu'à `timeout` ms de vrai temps ; rend sa dernière valeur. */
const attendre = async (evaluate, expr, timeout) => {
  const t0 = Date.now();
  for (;;) {
    const value = await evaluate(expr);
    if (value || Date.now() - t0 >= timeout) return value;
    await wait(100);
  }
};

/** Vrai sur l'analyse d'une session (`/voile/analyse?session=…`, `/surf/analyse?session=…`). */
const SUR_ANALYSE = `/^\\/(voile|surf)\\/analyse$/.test(location.pathname) && new URLSearchParams(location.search).has('session')`;

/**
 * Après l'arrêt tenu : attend l'analyse ouverte seule, et que la session y soit lue (son menu « … » est là).
 * 'ok', ou la page où l'on est resté.
 */
export const attendreAnalyse = async (evaluate, { timeout = 20000 } = {}) => {
  const ok = await attendre(evaluate, `${SUR_ANALYSE} && !document.body.innerText.includes('Lecture de la session') && Boolean(document.querySelector('button[aria-label="Plus d\\'actions sur la session"]'))`, timeout);
  return ok ? 'ok' : `restée sur ${await evaluate('location.pathname + location.search')}`;
};

/**
 * Sur l'analyse ouverte : « … », puis « Jeter » tenu (appui, 1,1 s de page, relâcher), la confirmation acceptée
 * d'office (`window.confirm` remplacé ; ses questions dans `window.__questionsJeter`). 'ok' quand la page a quitté
 * l'analyse pour la bibliothèque.
 */
export const jeterDepuisAnalyse = async (evaluate, { timeout = 8000 } = {}) => {
  const menu = await evaluate(`(() => {
    const b = document.querySelector('button[aria-label="Plus d\\'actions sur la session"]');
    if (!b) return 'menu absent';
    if (b.getAttribute('aria-expanded') !== 'true') b.click();
    return 'ok';
  })()`);
  if (menu !== 'ok') return menu;
  await wait(100);
  const down = await evaluate(`(() => {
    window.__questionsJeter = [];
    window.confirm = (m) => { window.__questionsJeter.push(String(m)); return true; };
    const b = [...document.querySelectorAll('.ui-more__panel button')].find((x) => x.textContent.trim() === 'Jeter');
    if (!b) return 'Jeter absent';
    window.__jeter = b;
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    return 'ok';
  })()`);
  if (down !== 'ok') return down;
  await vwait(TENUE_MS);
  await evaluate(`(() => {
    const b = window.__jeter;
    if (b?.isConnected) { b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); b.click(); }
    return 'ok';
  })()`);
  const left = await attendre(evaluate, `!/\\/analyse$/.test(location.pathname)`, timeout);
  return left ? 'ok' : 'restée sur l\'analyse';
};

/** Les deux à la suite : l'analyse s'ouvre seule, puis la session est jetée. 'ok', ou la première étape manquée. */
export const analyseOuvertePuisJetee = async (evaluate, options = {}) => {
  const opened = await attendreAnalyse(evaluate, options);
  if (opened !== 'ok') return `analyse : ${opened}`;
  const thrown = await jeterDepuisAnalyse(evaluate, options);
  return thrown === 'ok' ? 'ok' : `jeter : ${thrown}`;
};
