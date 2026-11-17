# 429 · Analyses › flèche qui replie les onglets sous la carte : bouton plus visible

## Tel que dit par l'utilisateur (note du 17/11)

« Mieux faire le cercle, rendre le bouton moins transparent. »

## Voulu

Le bouton rond à flèche qui replie et déplie les onglets sous la carte des analyses (voile et surf, pièce commune de `AnalysisShell`) devient un rond net et plein, qu'on repère tout de suite sur la carte, de jour comme de nuit : bord franc, fond opaque ou presque, flèche à l'encre.

## Planche d'abord

Dessin retenu : voir « Variante retenue » plus bas, écrite par l'orchestrateur après la planche (`D:\gong tracker\atelier\planche-429-430\`). L'utilisateur peut en changer après coup : garder le dessin dans une ou deux variables, facile à retoucher.

## Contraintes

- `docs/MISE_EN_PAGE.md` : le bouton ne se déplace pas, ne change pas de taille de zone tactile à la baisse, ne change pas de comportement.
- Charte (`docs/DECISIONS.md` §12) : variables de `src/theme/tokens.css` ; ce qui est allumé l'est à l'encre, noire le jour, blanche la nuit ; le vert vif jamais en texte ; aucune valeur en dur, aucun style en ligne neuf.
- Les autres boutons posés sur la carte ne changent pas, sauf s'ils partagent exactement la même classe : le dire alors dans le rapport.

## Banc

Texte des pages identique avant et après.

## Essai au téléphone

Un essai de rendu : sur une analyse, dehors, le bouton de repli se voit d'un coup d'œil sur la carte, de jour et de nuit.
