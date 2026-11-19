# 458 · Planifier › itinéraire ouvert : menu « … » (Partager l'image, Partager le GPX, Supprimer)

Modèle | Réflexion : Opus | high

## Tel que dit par l'utilisateur (note du 19/11)

« Actuellement le seul moyen qu'il y a pour partager un itinéraire planifié c'est depuis la liste des itinéraires. Il faut que quand on a cliqué sur un itinéraire il [ait] également le bouton "…", qui récupère à cet endroit-là le bouton partager en image, partager l'itinéraire GPX donc partager GPX, supprimer avec le même fonctionnement de supprimer que ce qu'on avait [décidé] précédemment, et je pense qu'on n'oublie pas d'option mais [s'il en manque] une il faut la rajouter à cet endroit-là. »

## Constat (lu dans le code le 19/11, à revérifier)

- `src/pages/PlanningPage.tsx`, bloc « Itinéraire enregistré » (`planning.ranger`) : Enregistrer les modifications, Partir, Exporter le GPX (absent sur téléphone, `canDownloadFiles`), Nouvel itinéraire, Supprimer l'itinéraire (confirmé par « Supprimer définitivement / Garder ») ; aucun partage.
- `src/pages/RoutesPage.tsx` (liste) : « Partager » (le GPX, fiche comprise, `shareFile`) et « Supprimer » par ligne.
- Une session a un menu « … » (`src/components/SessionNameEditor.tsx` : « Partager l'image », « Partager la trace », « Jeter ») et une image de partage (`src/components/ShareDialog.tsx`). Un itinéraire n'a pas d'image de partage : elle est à créer.

## Maquette : choisie par l'utilisateur le 19/11

Réponse à la question Q136 : pour le menu, « B » de la planche, le « … » à droite du champ du nom (M2 ci-dessous, `iti-M2.jpg`) ; pour l'image de partage, « B » de la planche, les bords annotés (S2 ci-dessous, `partage-S2.jpg`). Il n'a rien dit du reste : les défauts annoncés valent, « Nouvel itinéraire » reste un bouton du bloc, le liseré de l'image est à la couleur de l'activité de l'itinéraire, le nom du pratiquant figure en bas comme pour une session. Les autres variantes restent décrites pour mémoire.

Planche : `D:\gong tracker\atelier\planche-458-460\planche.html` (images `iti-0.jpg`, `iti-M1.jpg`, `iti-M2.jpg`, `partage-S1.jpg` à `partage-S3.jpg`).
- Place du « … » : M1, à droite du titre du bloc « Itinéraire enregistré » ; M2, à droite du champ du nom. Dans les deux, « Exporter le GPX » et « Supprimer l'itinéraire » quittent le bloc pour le menu.
- Image de partage (9:16, fond de carte, tracé bleu, départ vert, arrivée rouge, balises numérotées, nom, distance, nombre de balises, plus long bord, logo) : S1, la composition de l'image d'une session ; S2, chaque bord annoté d'une pastille distance et cap, flèche du nord ; S3, une affiche à fond blanc cassé avec la liste des bords.
- À dire aussi : « Nouvel itinéraire » reste un bouton du bloc ou entre dans le menu ; le liseré du titre de l'image à l'encre ou à la couleur de l'activité de l'itinéraire ; le nom du pratiquant en bas de l'image comme pour une session, ou non.

## Voulu (une fois la maquette choisie)

1. Sur l'itinéraire ouvert, un menu « … » : « Partager l'image », « Partager le GPX », « Supprimer ». Même pièce de menu que celui d'une analyse.
2. « Partager l'image » ouvre l'aperçu de l'image de l'itinéraire, au dessin choisi, puis le partage du système ; la même entrée s'ajoute au menu de chaque ligne de la liste des itinéraires.
3. « Partager le GPX » fait ce que fait « Partager » de la liste (le GPX, fiche comprise), y compris sur téléphone, où « Exporter le GPX » n'existe pas.
4. « Supprimer » : le geste de « Jeter » des analyses (tenu une seconde, puis confirmé), en attendant le geste unique de l'élément 418 ; si le 418 est fait d'ici là, sa pièce commune.
5. Un itinéraire modifié et pas encore enregistré : « Partager » porte la version enregistrée, et le dit, ou demande d'enregistrer d'abord ; à trancher au plan et à dire dans le rapport.

## Contraintes

- `docs/DECISIONS.md` §7 (liste des itinéraires, « Supprimer définitivement / Garder ») et §8 (partage, image toujours claire) ; charte §12.
- Le calcul de l'image est pur là où il peut l'être (cadrage du tracé, place des pastilles), avec son test ; partage par `src/platform/` seulement (règle 12).
- Lot à couper d'avance en deux parties : A, le menu et le partage du GPX ; B, l'image de partage.

## Banc

`planning`, `partage` : le bloc « Itinéraire enregistré » perd deux boutons et gagne le menu ; l'image se relève par sa description, pas par ses pixels.

## Essai au téléphone

Ouvrir un itinéraire, « … », « Partager l'image » puis « Partager le GPX » vers une autre application ; « Supprimer » sur un itinéraire d'essai.
