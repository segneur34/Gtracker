# 429 · Analyses › flèche qui replie les onglets sous la carte : bouton plus visible

## Tel que dit par l'utilisateur (note du 17/11)

« Mieux faire le cercle, rendre le bouton moins transparent. »

## Voulu

Le bouton rond à flèche qui replie et déplie les onglets sous la carte des analyses (voile et surf, pièce commune de `AnalysisShell`) devient un rond net et plein, qu'on repère tout de suite sur la carte, de jour comme de nuit : bord franc, fond opaque ou presque, flèche à l'encre.

## Planche d'abord

Dessin retenu : voir « Variante retenue » plus bas, écrite par l'orchestrateur après la planche (`D:\gong tracker\atelier\planche-429-430\`). L'utilisateur peut en changer après coup : garder le dessin dans une ou deux variables, facile à retoucher.

## Variante retenue (planche du 17/11, ouverte chez l'utilisateur, qui peut en changer)

Relevé de la planche : le bouton est `.an-tabs-hide` (`src/pages/analysisMobile.css`, vers l. 88), dans la rangée d'onglets sous la carte, entre « Avancé » et « Tout fermer » ; sa classe n'est partagée avec aucun autre bouton. Aujourd'hui : une pastille de 34 × 32 px, fond transparent (les traits du fond de page passent derrière), bord `1px solid var(--line)` presque invisible, flèche en `var(--muted)`.

Variante A, retenue : un vrai rond de 32 px, fond `var(--bg)` opaque, bord `1.5px solid var(--ink)`, flèche `var(--ink)` (`min-width:32px; width:32px; height:32px; padding:0; border-radius:50%`). Écartées : B (rond plein à l'encre, flèche inversée : se lirait comme un onglet ouvert) et C (A avec bord de 2 px et ombre `var(--shadow-chip)`). Les 2 px de largeur perdus sont acceptés ; la place dans la rangée ne change pas.

## Contraintes

- `docs/MISE_EN_PAGE.md` : le bouton ne se déplace pas, ne change pas de taille de zone tactile à la baisse, ne change pas de comportement.
- Charte (`docs/DECISIONS.md` §12) : variables de `src/theme/tokens.css` ; ce qui est allumé l'est à l'encre, noire le jour, blanche la nuit ; le vert vif jamais en texte ; aucune valeur en dur, aucun style en ligne neuf.
- Les autres boutons posés sur la carte ne changent pas, sauf s'ils partagent exactement la même classe : le dire alors dans le rapport.

## Banc

Texte des pages identique avant et après.

## Essai au téléphone

Un essai de rendu : sur une analyse, dehors, le bouton de repli se voit d'un coup d'œil sur la carte, de jour et de nuit.
