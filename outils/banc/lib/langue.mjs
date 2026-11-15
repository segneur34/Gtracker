// Langue du passage, pour les scripts qui marchent dans les trois langues (`tailles.mjs`, `langues.mjs`).
// La langue est celle que l'application a posée sur le document (`document.documentElement.lang`, écrit par `main.tsx`
// à l'amorçage) : celle du Chrome lancé par `passe.mjs --langue`, sauf réglage contraire. Un script clique alors par
// sélecteur, ou par le texte traduit lu dans `src/locales/<langue>.json`, jamais par un texte français écrit en dur.
import { readFileSync } from 'node:fs';

/** Marque entre un texte et son contexte dans un dictionnaire (`CONTEXT_MARK` de `src/core/i18n.ts`). */
export const MARQUE_CONTEXTE = '||';

/** Dictionnaire d'une langue (texte français → traduction) ; vide en français. */
export const dictionnaire = (langue) => langue === 'fr' || !langue
  ? {}
  : JSON.parse(readFileSync(new URL(`../../../src/locales/${langue}.json`, import.meta.url), 'utf8'));

/** Langue de l'application dans la page ouverte ('fr', 'en' ou 'es'), à lire après le premier rendu. */
export const langueDeLaPage = async (evaluate) => {
  const lang = await evaluate(`document.documentElement.lang`);
  return ['fr', 'en', 'es'].includes(lang) ? lang : 'fr';
};

/** Traduction d'un texte comme `t()` : l'entrée du contexte, sinon celle du texte seul, sinon le texte. */
export const traducteur = (dict) => (cle, ctx) =>
  (ctx !== undefined ? dict[cle + MARQUE_CONTEXTE + ctx] : undefined) ?? dict[cle] ?? cle;

/** Échappe un texte pour l'insérer dans une expression régulière. */
export const echappe = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
