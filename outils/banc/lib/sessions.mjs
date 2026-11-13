// Banc de test : la page « Sessions » (lot 346), une seule liste pour la voile et le surf à `/sessions`.
// Ces aides prennent l'`evaluate` d'une connexion (`connect`, lib/cdp.mjs) et rendent 'ok' ou ce qui a manqué, sans
// lever : le `check` ou le `console.log` du script le dit.
//
// Une ligne (`.lib-row`) : la pastille et le nom de l'activité avec la date, le nom de la session en gras (le nom
// calculé quand elle n'en a pas : l'activité, suivie du lieu s'il est connu, « Wingfoil · Plage du Petit Travers »), ses chiffres. Sans nom de session, le nom de l'activité vient après la date : le
// texte d'une ligne que les scripts comparent commence donc toujours par l'activité (« Wingfoil / … », « À classer / … »).
// Classer, Renommer et Supprimer sont derrière le « … » de la ligne (« Plus d'actions sur la session »).

/** Texte d'une ligne en expression de la page : l'activité d'abord, puis le texte de la ligne, les sauts de ligne en « / ». */
export const TEXTE_LIGNE = `((r) => {
  const main = r.querySelector('.lib-row__main');
  if (!main) return '';
  const activite = main.querySelector('.lib-row__sport')?.textContent ?? '';
  return activite + ' / ' + main.innerText.replace(/\\n/g, ' / ');
})`;

/** Les lignes de la page, dans l'ordre du DOM (la carte « À classer » d'abord), en textes à comparer. */
export const lignes = async (evaluate) =>
  JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.lib-row')].map(${TEXTE_LIGNE}))`));

/** Expression de la page : vraie quand une ligne commence par `debut`. */
export const ligneExiste = (debut) =>
  `[...document.querySelectorAll('.lib-row')].some((r) => ${TEXTE_LIGNE}(r).startsWith(${JSON.stringify(debut)}))`;

/** Ouvre la ligne qui commence par `debut` (un clic sur son texte : l'analyse, ou la question « Quelle activité ? »). */
export const ouvrirLigne = (evaluate, debut) => evaluate(`(() => {
  const r = [...document.querySelectorAll('.lib-row')].find((x) => ${TEXTE_LIGNE}(x).startsWith(${JSON.stringify(debut)}));
  const b = r?.querySelector('.lib-row__main');
  if (!b) return 'ligne absente';
  b.click();
  return 'ok';
})()`);

/**
 * Joue une action du « … » d'une ligne : ouvre le menu de la ligne qui commence par `debut`, puis clique l'entrée dont
 * le texte commence par `action` (« Supprimer », « Renommer », « Classer »).
 */
export const actionLigne = async (evaluate, wait, debut, action) => {
  const ouvert = await evaluate(`(() => {
    const r = [...document.querySelectorAll('.lib-row')].find((x) => ${TEXTE_LIGNE}(x).startsWith(${JSON.stringify(debut)}));
    if (!r) return 'ligne absente';
    const m = r.querySelector('button[aria-label="Plus d\\'actions sur la session"]');
    if (!m) return 'menu absent';
    if (m.getAttribute('aria-expanded') !== 'true') m.click();
    return 'ok';
  })()`);
  if (ouvert !== 'ok') return ouvert;
  await wait(100);
  return evaluate(`(() => {
    const r = [...document.querySelectorAll('.lib-row')].find((x) => ${TEXTE_LIGNE}(x).startsWith(${JSON.stringify(debut)}));
    const b = [...(r?.querySelectorAll('.ui-more__panel button') ?? [])].find((x) => x.textContent.trim().startsWith(${JSON.stringify(action)}));
    if (!b) return 'action absente';
    b.click();
    return 'ok';
  })()`);
};

/** Appuie sur le rond d'une activité de la rangée (`name` : « Toutes », « Wingfoil »…). 'ok' ou 'rond absent'. */
export const choisirActivite = (evaluate, name) => evaluate(`(() => {
  const b = [...document.querySelectorAll('.activity-bubbles .activity-bubble')].find((x) => x.querySelector('.activity-bubble__name')?.textContent.trim() === ${JSON.stringify(name)});
  if (!b) return 'rond absent';
  b.click();
  return 'ok';
})()`);

/** Noms des ronds de la rangée, dans l'ordre, avec celui qui est enfoncé : « Toutes*, Wingfoil, Kite… ». */
export const ronds = async (evaluate) => evaluate(`[...document.querySelectorAll('.activity-bubbles .activity-bubble')].map((x) => x.querySelector('.activity-bubble__name')?.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(', ')`);
