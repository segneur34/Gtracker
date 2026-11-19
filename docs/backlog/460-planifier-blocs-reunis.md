# 460 · Planifier : « tracé » et « balises » réunis, « parcours » devient « balises sonores »

Modèle | Réflexion : Opus | high

## Tel que dit par l'utilisateur (note du 19/11)

« Il faut fusionner l'onglet tracé et balise qui peuvent être mis ensemble avec quelques modifications pour que ça soit un peu plus restreint dans l'espace. L'onglet parcours doit être renommé en balise sonore et doit être mis à la fin juste avant réglage. »

Tranché le 19/11 (la page n'a pas de bloc « réglages ») : « balises sonores » tout à la fin. Ordre final des blocs : tracé et balises, enregistrer, mes itinéraires, balises sonores.

## Constat (lu dans le code le 19/11, à revérifier)

`src/pages/PlanningPage.tsx` (tableau `sections` et blocs `PlanBlock`, vers les lignes 588 à 900), `src/pages/PlanningPage.css`. Cinq blocs, dans cet ordre : « parcours » (distance, nombre de balises, plus long bord, liste des bords avec distance et cap, puis « Régler pour ce parcours » des bips), « tracé » (Précédent, Inverser, Boucler, Charger un GPX, Tout effacer), « balises (n) » (liste des points, monter, descendre), « enregistrer », « mes itinéraires (n) ».

## Maquette : choisie par l'utilisateur le 19/11, variante C

Réponse à la question Q135 : « la C ». Il n'a rien dit des icônes : le défaut annoncé vaut, « Charger un GPX » et « Tout effacer » gardent leur texte. Les trois variantes restent décrites ci-dessous pour mémoire ; seule la C est à coder, d'après `plan-C.jpg`.

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

## Plan (agent Plan, 19/11, relu par l'orchestrateur)

Deux parties, deux agents, deux commits : A, la page ; B, les scripts du banc (Sonnet).

### Partie A : la page

Fichiers : `src/pages/PlanningPage.tsx`, `src/pages/PlanningPage.css`, `src/locales/en.json`, `src/locales/es.json`, `src/tutorials/lessons.ts` (une phrase), `outils/styles-en-ligne.json` (à figer).

Identifiants et état retenu :
- le bloc réuni garde la clé `trace`, l'id `planning.trace` et l'aide `plan:trace` ; « balises sonores » garde la clé `parcours`, l'id `planning.parcours` et l'aide `plan:parcours` ;
- la clé `points` sort de `PlanningSection` et des défauts ; son état retenu reste inerte dans la mémoire, sans migration ; la taille `planning.points` devient orpheline, sans effet ;
- défauts : `trace: true`, `parcours: true`.

Pièces à réutiliser : `PlanBlock`, `SectionTabs`, `HelpText`, `useHelp('plan:trace')`, `courseLegs` (la ligne `i` montre `legs[i-1]`, distance et `roundBearingDeg`, « — » pour le départ), `routeTotals`, `formatDistance`, `pointLabel`, `pointName`, `pointFill`, `selectPoint`, `planner.reorder` / `remove` / `undo` / `reverse` / `closeLoop` / `clear`, `tn(n, '{n} balise', '{n} balises')`, icônes `IconUndo`, `IconFile`, `IconChevronUp`, `IconChevronDown`, `IconClose` (les chevrons remplacent `IconChevronRight` tourné en style en ligne), `Button size="s"`, classes `plan-actions` et `plan-note`, `BeepCurveEditor`.

Étapes :
1. `PlanningSection = 'trace' | 'ranger' | 'liste' | 'parcours'` ; `sections` dans l'ordre tracé et balises ({n}), enregistrer, mes itinéraires ({n}), balises sonores ; `n` reste `route.waypoints.length` ; la pastille « balises sonores » n'est montrée que si le bloc a un contenu (`guide && activity`).
2. Bloc réuni, titre « Tracé et balises ({n}) », aide `plan:trace` : la liste d'aide actuelle, où la phrase sur l'ordre des balises devient « touchez une balise de la liste pour la monter, la descendre ou la retirer » ; la bande de chiffres (distance, nombre de balises sans le retour d'une boucle, « bord max ») ; la rangée d'actions (Précédent en icône seule avec son aria-label existant et le même texte en `title`, Inverser, Boucler, « Charger un GPX » icône et texte, « Tout effacer » en texte) ; la liste `ol.plan-points`, une ligne par balise (pastille, nom, bord et cap à droite) ; la ligne touchée se déplie (Monter, Descendre, Retirer avec aria-label « Retirer : {name} »), la retoucher la replie ; après Monter ou Descendre, la sélection suit la balise déplacée ; liste vide : la note existante.
3. Bloc « Balises sonores », dernier, rendu seulement si `guide && activity` : l'aide `plan:parcours` et les bips, rien d'autre. Les anciens blocs « Tracé » et « Balises (n) » disparaissent.
4. Le bloc `planning.ranger` n'est pas touché.
5. CSS par les variables de `tokens.css` ; règles mortes retirées (`.plan-stats`, `.plan-stat`, `.plan-course`, l'ancien `.plan-point__text`) ; seul style en ligne restant : le fond de la pastille.
6. Textes, trois langues : clés neuves pour les titres, « bord max », « Monter », « Descendre », « Retirer : {name} » si absentes, la ligne d'aide ; clés orphelines retirées après recherche dans tout `src/` ; la leçon dit « Tracé et balises » au lieu de « Le parcours ».
7. `node outils/styles-en-ligne.mjs --figer`, `node outils/i18n.mjs`, `node outils/verif.mjs --rapide`.

Le verrou de la carte ne change pas (DECISIONS §7) : liste, « Précédent » et actions restent actives carte verrouillée. Aucun test unitaire neuf : pas de calcul neuf ; la preuve vient du banc.

### Partie B : les scripts du banc

- `outils/banc/planning.mjs` : titre du bloc `/^Tracé et balises \(\d+\)$/`, chiffres lus dans la nouvelle bande, bords reconstruits depuis les lignes de balises, objet `sections` sans `points`.
- `outils/banc/balises.mjs` : bloc « Tracé et balises (4) », chiffres, bords et liste aux nouvelles classes, `sections` sans `points`.
- `outils/banc/reglages-aide.mjs` : « Aide : Parcours » devient « Aide : Balises sonores ».
- `outils/banc/planification-verrou.mjs`, `outils/banc/activite.mjs` : `points` retiré de `sections`.
- `outils/banc/SCRIPTS.md` : la ligne de `balises.mjs`.
- `langues.mjs`, `tailles.mjs`, `satellite.mjs` : rien à changer, leurs relevés de la page changent, ce qui est attendu.

Vérification : `planning`, `balises`, `planification-verrou`, `activite`, `reglages-aide`, puis `tailles` à 390 px (colonne de 1 484 px aujourd'hui, gain attendu d'environ 550 px).
