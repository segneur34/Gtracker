# 422 · Analyse surf › onglet vagues : le tableau tient dans l'écran du téléphone

## Tel que dit par l'utilisateur (note du 16/11)

« Il faut revoir le cadre des vagues qui sont prises en surf et cetera, paddle foil et tout, parce que le cadre dépasse grandement de l'écran, à revoir en termes de mise en forme. »

## Constat (vérifié dans le code le 16/11, à revérifier)

Dans `src/pages/SurfModule.tsx`, le tableau des vagues prises a huit ou neuf colonnes (N°, Heure, Durée, Distance, Max, Moy., Virages, Vol sur foil, Carte) et ne fait que défiler de côté sur téléphone. La règle des analyses (`docs/MISE_EN_PAGE.md`, partie téléphone) veut qu'un tableau se resserre ou passe ses lignes en grille, comme le panneau Manœuvres de la voile.

## Voulu

- Sur téléphone (droit), chaque vague tient dans la largeur de l'écran, sans défilement de côté, au même dessin que les manœuvres de la voile : reprendre ses pièces et ses classes (chercher comment le panneau Manœuvres passe ses lignes en grille), ne pas inventer un second dessin.
- Toutes les valeurs d'aujourd'hui restent lisibles (aucune colonne perdue), l'astérisque des virages et le bouton vers la carte compris ; la surbrillance d'une vague sur la carte marche comme avant.
- Rien ne change sur ordinateur, ni dans les chiffres.

## Contraintes

- `docs/MISE_EN_PAGE.md` (téléphone, tableaux) et `docs/DECISIONS.md` §4 avant de toucher.
- Variables de `src/theme/tokens.css`, aucune valeur en dur, aucun style en ligne neuf (`outils/styles-en-ligne.json` ne fait que baisser).
- Textes par `t` ; si un intitulé court est nécessaire, dans les trois langues.

## Banc

Texte de la page d'analyse surf identique avant et après sur ordinateur ; sur la largeur téléphone, mêmes valeurs, et plus de débordement horizontal du tableau (mesure de largeur si un script du banc la fait déjà pour les manœuvres).

## Essai au téléphone

Un essai pour le rendu : ouvrir une session de surf ou de paddle foil, onglet vagues → chaque vague tient dans l'écran, sans glisser de côté, et un appui montre la vague sur la carte.
