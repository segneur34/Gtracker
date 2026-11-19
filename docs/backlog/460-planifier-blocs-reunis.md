# 460 · Planifier : « tracé » et « balises » réunis, « parcours » devient « balises sonores »

Modèle | Réflexion : Opus | high

## Tel que dit par l'utilisateur (note du 19/11)

« Il faut fusionner l'onglet tracé et balise qui peuvent être mis ensemble avec quelques modifications pour que ça soit un peu plus restreint dans l'espace. L'onglet parcours doit être renommé en balise sonore et doit être mis à la fin juste avant réglage. »

Tranché le 19/11 (la page n'a pas de bloc « réglages ») : « balises sonores » tout à la fin. Ordre final des blocs : tracé et balises, enregistrer, mes itinéraires, balises sonores.

## Constat (lu dans le code le 19/11, à revérifier)

`src/pages/PlanningPage.tsx` (tableau `sections` et blocs `PlanBlock`, vers les lignes 588 à 900), `src/pages/PlanningPage.css`. Cinq blocs, dans cet ordre : « parcours » (distance, nombre de balises, plus long bord, liste des bords avec distance et cap, puis « Régler pour ce parcours » des bips), « tracé » (Précédent, Inverser, Boucler, Charger un GPX, Tout effacer), « balises (n) » (liste des points, monter, descendre), « enregistrer », « mes itinéraires (n) ».

## Maquette : à choisir par l'utilisateur avant tout code (question Q135)

Planche : `D:\gong tracker\atelier\planche-458-460\planche.html` (images dans `images\` : `plan-aujourdhui.jpg`, `plan-A.jpg`, `plan-B.jpg`, `plan-C.jpg`), captures de la vraie page à 390 px de large, parcours de cinq balises. Colonne sous la carte : 1 484 px aujourd'hui, tous blocs ouverts.
- A : une ligne de chiffres (« 7,75 km · 5 balises · plus long bord 2,46 km »), cinq icônes d'action en une rangée, bord et cap écrits sous chaque balise, monter, descendre et retirer en icônes. Gain : 530 px.
- B : trois petites cases de chiffres, boutons à texte, tableau balise, bord, cap, une poignée à glisser à la place des flèches. Gain : 508 px. Le glisser est un geste neuf à coder et à essayer au téléphone, et « Précédent » ne reste que sur la carte.
- C : bande de chiffres, une ligne par balise, les actions d'une balise dépliées seulement sous celle qu'on touche. Gain : 553 px.

Sous-question des variantes A et C : « Charger un GPX » et « Tout effacer » y sont des icônes sans texte ; garder un texte ou non.

## Voulu (une fois la variante choisie)

1. Un seul bloc « tracé et balises (n) » à la place de « tracé » et de « balises (n) », au dessin de la variante choisie ; il reprend les chiffres (distance, balises, plus long bord) et les bords, qui quittent l'ancien bloc « parcours ».
2. L'ancien bloc « parcours » s'appelle « balises sonores », ne garde que les bips (« Régler pour ce parcours », l'aide des bips) et passe tout à la fin.
3. Les pastilles du haut suivent : tracé et balises (n), enregistrer, mes itinéraires (n), balises sonores.
4. Rien ne change dans ce que fait chaque bouton, ni dans le verrou de la carte, ni sur ordinateur hors l'ordre et la fusion.

## Contraintes

- `docs/DECISIONS.md` §7 ; `docs/MISE_EN_PAGE.md` pour les blocs repliables.
- L'état ouvert ou fermé des blocs est retenu par identifiant (`planning.parcours`, `planning.trace`, `planning.points`…) : garder les identifiants des blocs qui restent, et dire dans le rapport ce que devient l'état retenu du bloc qui disparaît.
- Textes par `t`, trois langues ; les aides « ? » (`plan:parcours`, `plan:trace`) suivent leur bloc ; la leçon « Planifier un parcours » des tutoriels si elle cite les anciens noms.
- Pas de style en ligne neuf ; `PlanningPage.tsx` en porte déjà, leur nombre ne monte pas.

## Banc

`planning`, `planification-verrou`, `balises`, `activite` : les noms de blocs changent dans les relevés ; les scripts qui ouvrent un bloc par son nom sont à adapter (partie à part si plus de trois scripts).

## Essai au téléphone

Planifier, téléphone droit : poser cinq balises, les réordonner, en retirer une ; dire si le bloc réuni convient.
