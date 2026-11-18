# 435 · Surf : le tableau des remontées tient dans l'écran du téléphone

| Modèle | Réflexion |
|---|---|
| Sonnet | medium |

## Tel que noté (17/11 à 23 h 28)

« dans l'onglet [rame] à la fin il y a un tableau, ce tableau dépasse également du téléphone et du coup il faut le déplacer avec le doigt ; il faut également trouver une solution un peu comme pour le tableau des vagues qu'on a prise »

Place confirmée par l'utilisateur le 18/11 : « 435 oui » (tête de la liste des prochains lots).

## Aujourd'hui (lu dans le code le 18/11)

`src/pages/SurfModule.tsx`, panneau « Rame et retour au pic » (`open.rame`), sous les tuiles : un `ui-table` dans `ui-overflow-x`, sept colonnes (Après, Retour, Distance, Remontée, Rame, Attente, Carte), styles en ligne `thStyle` et `tdStyle`, la vitesse affichée avec son unité dans chaque case (`formatSpeed`). Sur téléphone, il dépasse de l'écran et défile de côté.

## Voulu : le dessin du lot 434, repris sans planche

Le lot 434 (commit 7aa5f7b, validé le 18/11 par l'essai 295) a résolu la même chose pour le tableau des vagues. Le reprendre tel quel, sans nouvelle planche ni nouveau dessin :
- une remontée par ligne, l'en-tête une seule fois ;
- intitulés courts sur téléphone (classes `an-wave-long` et `an-wave-short`, ou leur équivalent généralisé si le nom « wave » gêne : à trancher par l'agent, sans dupliquer la règle CSS) : par exemple Après, Retour, Dist., Rem., Rame, Att. ; l'intitulé « Carte » disparaît sur téléphone, « Voir » reste au bout ;
- les vitesses sans unité dans les cases, une petite ligne au-dessus du tableau qui dit l'unité une fois (comme `an-wave-unit`, « Max et moy. en {unit} ») : par exemple « Remontée et rame en {unit} » ;
- texte resserré avec la largeur (13 px à 390, 12 px à 360), trait à l'encre entre deux lignes (lot 428, déjà posé par `ui-table__row` s'il l'est), sans fond ni cadre ;
- la première ligne, « départ », et le mot « enchaîné » restent.

Rien ne change sur ordinateur, ni dans les chiffres. Toute clé de traduction neuve se met dans `en.json` et `es.json`.

## Vérification

- `npm run verif` ; banc du surf identique avant et après sur ordinateur (`node outils/banc/passe.mjs`, scripts du surf).
- Rendu relevé sur une copie compilée à 390, 360 et 320 px, avec et sans foil (mémoire « Planche sur copie compilée ») : aucun défilement de côté à 390 et 360.
- Pas d'essai au téléphone nécessaire si le rendu est relevé : le lot peut se valider sur lecture (`--lecture`), sauf doute de l'orchestrateur.
