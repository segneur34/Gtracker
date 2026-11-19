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

## Plan (agent Plan, 19/11, relu par l'orchestrateur)

Trois parties, trois agents : A, le menu, le GPX et la suppression ; B, l'image de partage ; C, les scripts du banc (Sonnet).

Tranché par l'orchestrateur (questions mineures) :
- Point 5, itinéraire modifié ou jamais enregistré : on demande d'enregistrer d'abord. « Partager l'image » et « Partager le GPX » sont grisés, avec la ligne « Enregistrez d'abord les modifications » dans le menu, la règle et les mots de « Partir » du même bloc. « Supprimer » reste actif.
- « Supprimer » : le 418 n'est pas fait, donc le geste de « Jeter » : `HoldButton` (`src/components/ui/HoldButton.tsx`, `keepMenuOpen`) tenu une seconde, puis la confirmation. La confirmation est celle que le bloc a déjà, « Supprimer définitivement / Garder » (DECISIONS §7), pas une fenêtre du système ; si le menu refermé la rend impossible, celle de « Jeter », dit dans le rapport.
- Liste des itinéraires : « Partager l'image » est la première entrée du « … » de chaque ligne, « Partager » y devient « Partager le GPX », « Supprimer » ne change pas. Mêmes mots, même ordre que sur l'itinéraire ouvert.

### Partie A : menu, GPX, suppression

Fichiers : `src/pages/PlanningPage.tsx`, `src/pages/PlanningPage.css`, `src/pages/RoutesPage.tsx` (le libellé « Partager le GPX » et la fonction commune), `src/components/routeShare.ts` (neuf), `src/components/ui/HoldButton.tsx`, `src/locales/en.json`, `src/locales/es.json`.

- Le champ « Nom » de `.plan-form` passe sur une rangée champ + `MoreMenu` (`src/components/ui/MoreMenu.tsx`, libellé « Plus d'actions sur l'itinéraire », clé existante), d'après `iti-M2.jpg`.
- « Exporter le GPX » et « Supprimer l'itinéraire » quittent `.plan-actions` ; « Nouvel itinéraire » reste un bouton du bloc.
- Menu, dans l'ordre : « Partager l'image » (branchée en partie B, absente d'ici là) ; « Partager le GPX » (`routeShareFile` par `useRouteLibrary().shareFileOf` de `src/hooks/routeFiles.ts`, puis `shareFile` de `src/platform/share.ts`, le code de `share` de `RoutesPage.tsx` tiré dans une fonction commune `shareRouteGpx(saved)`) ; « Exporter le GPX » seulement si `canDownloadFiles()`, `exportGpx` tel quel ; « Supprimer » en rouge avec `IconTrash`, `deleteSaved(current)` après l'appui tenu et la confirmation.
- Le « … » se montre dès que `current !== null`, ou qu'il y a au moins deux points sur ordinateur (pour « Exporter le GPX » d'un tracé pas encore enregistré).
- `HoldAction` gagne `'supprimer'`, phrase « Maintenir {holdS} s pour supprimer ».
- Les blocs tracé, balises, parcours et « Mes itinéraires » ne sont pas touchés (lot 460).

### Partie B : image de partage

À créer :
- `src/planning/routeShareImage.ts` et son test : `routeShareContent(route, unit)` (balises numérotées, départ, arrivée, la boucle reprend le 1 ; par bord, son ancre au milieu de sa longueur et son texte « distance · cap » par `courseLegs`, `roundBearingDeg`, `formatDistance` ; un tronçon importé porte la distance seule), `routeShareStats` (distance, balises, plus long bord), `placeLegPills(view, pills, tailles)` (une pastille qui chevauche une balise ou une autre pastille est poussée le long de la normale du bord ; toutes restent dans le cadre, sous le voile du titre et au-dessus du cartouche), `routeImageDescription` (texte de l'image, `alt` de l'aperçu, relevé par le banc).
- `src/planning/routeColors.ts` : `ROUTE_COLOR`, `START_COLOR`, `END_COLOR`, sortis de `PlanningPage.tsx`.
- `src/components/drawRouteOverlay.ts` : tracé bleu sur liseré blanc, balises numérotées, pastilles blanches, flèche du nord en haut à droite, d'après `partage-S2.jpg`.
- `src/components/RouteShare.tsx` : d'un `SavedRoute`, ce que montre `ShareDialog` (itinéraire par `recordToRoute`, titre le nom, sous-titre « Activité · itinéraire », activité par `routeActivity`, liseré à `shadeForTheme(activity.color, false)`, à l'encre sans activité ou si la couleur est le blanc, unité par `effectiveDistanceUnit`, nom du pratiquant en bas comme pour une session).

À modifier : `src/components/drawShareImage.ts` (`ShareImageContent` gagne `course?`, le cadrage part des points du parcours avec une marge pour les pastilles, `accent` fourni par l'appelant) ; `src/components/ShareDialog.tsx` (`course?`, `accent?`, `fixedStats` : les trois chiffres sans choix ; « Fond de carte » gardé, retenu sous `itineraire:<activité>` ; fond de la famille ; image toujours claire) ; `src/pages/PlanningPage.tsx` et `src/pages/RoutesPage.tsx` (l'entrée « Partager l'image ») ; locales.

Tests synthétiques : triangle (textes « 1,60 km · 65° », un cap de 359,6° donne 0°), boucle, tronçon importé sans cap, deux bords serrés aux pastilles séparées, pastilles toujours dans le cadre, milles nautiques, description complète.

### Partie C : scripts du banc

- `outils/banc/planning.mjs`, une étape de plus : les entrées du « … » de `.plan-form`, `.plan-actions` sans « Exporter le GPX » ni « Supprimer l'itinéraire », « Partager le GPX » avec `navigator.share` simulé comme dans `partage.mjs` (fichier « Sortie banc.gpx »), nom modifié : partages grisés et leur ligne, « Supprimer » tenu (`PointerEvent` `pointerdown`, comme `activite.mjs`) puis confirmé : fiche et GPX absents, le bloc redevient « Enregistrer l'itinéraire ».
- `outils/banc/partage.mjs`, une partie itinéraire : un parcours de trois balises enregistré, « Partager l'image » depuis le « … » du nom (aperçu de 1080 × 1920, `alt` égal à la description attendue), partage simulé (un `.png` au nom de l'itinéraire), de même depuis le « … » d'une ligne de la liste, console vide.

À dire à l'utilisateur : jusqu'au 418, deux gestes de suppression coexistent (appui tenu sur l'itinéraire ouvert, « Supprimer définitivement / Garder » dans les listes) ; sur ordinateur, « Exporter le GPX » passe dans le menu.
