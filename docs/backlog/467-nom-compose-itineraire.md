# 467 · Un nom composé d'office pour les itinéraires planifiés

Modèle | Réflexion : Opus | high (code) ; Sonnet | medium (scripts du banc).

Demande : `node outils/backlog.mjs --ligne 467`. Plan de l'agent `Plan` du 20/11, condensé par l'orchestrateur.

## Décidé

- Gabarits (tranchés par l'orchestrateur, l'utilisateur lui ayant laissé le lieu d'arrivée d'un aller) : « Boucle à {place} le {date} » ; « Aller de {from} à {to} le {date} » quand l'arrivée est connue et porte un autre nom ; « Aller de {from} le {date} » sinon ; lieu de départ inconnu : « Boucle du {date} », « Aller du {date} ». Date : celle de la création de l'itinéraire, jour et mois, selon la langue.
- Un nom saisi prime toujours. Un itinéraire qui porte déjà un nom (« Itinéraire du … » des anciens rangements compris) n'est jamais renommé ; un itinéraire importé garde le nom de sa trace ou de son fichier.
- Le nom se calcule à l'affichage tant qu'il n'est pas saisi (comme `sessionDisplayName`) : la fiche garde `name: ''`, `place` et `createdAt`, et le nom reste traduisible. Le nom écrit dans un GPX exporté et le nom de fichier sont figés au premier rangement (ce sont des exports).
- Défauts retenus : pas de bouton pour corriger le lieu d'un itinéraire (on renomme par le champ « Nom ») ; un lieu renommé depuis une session ne renomme pas les itinéraires ; deux itinéraires du même jour au même endroit peuvent porter le même nom affiché (fichiers distincts) ; arrivée nommée seulement à plus de 2 km du départ, même seuil que les sessions (`PLACE_RULES.elsewhereM`). Les itinéraires n'apprennent pas de lieu, ils emploient ceux que les sessions ont appris.

## Existant

- `RouteRecord.name` obligatoire (`src/planning/routeRecord.ts`) ; à la relecture un nom vide devient `t('Itinéraire')`. Défaut actuel : `defaultName` de `src/pages/PlanningPage.tsx` (« Itinéraire du <date> »), écrit en dur dans la fiche au rangement ; rien ne distingue un nom saisi d'un nom par défaut.
- Import : `importedRouteRecord` (`src/planning/routeImport.ts`). Boucle : `isLooped` (`src/planning/route.ts`).
- Le nom brut est lu à 17 endroits : `FollowTracePicker`, `RouteImageShare`, `RouteList` (2), `routeFiles` (nom dans le GPX, corbeille, nom de fichier), `sessionLibrary/incoming.ts`, `RoutesPage` (6), `planning/routeList.ts` (tri), `recording/followedTrace.ts`, `PlanningPage`.
- Lieu d'une session : file `createPlaceQueue` (`src/hooks/sessionLibrary/placeQueue.ts`), fonction `lookup` : lieu appris à moins de 500 m (`nearestLearnedPlace`, `learnedSpot`), sinon Photon si la recherche est permise (`isPlaceSearchOn`, `reversePlaces`), puis `choosePlace` et `learnedReplacing` ; arrivée cherchée seulement si `isElsewhere`.

## Étapes

1. `src/library/sessionName.ts` : extraire `distinctArrival(place)` (l'arrivée seulement si elle porte un autre nom, sans casse), employé par `placeLabel`.
2. `src/library/places.ts` : `spotFromSearch(features, point, learned, rules)`, partie pure tirée de `lookup` ; la file l'emploie, ses tests ne changent pas.
3. `src/planning/routeName.ts` (neuf, calcul pur) : `routeDisplayName(record)`, `routeKind(waypoints)`, `routePlaceTarget(place, waypoints, rules)` (les points à chercher ou `null`). Test : les cinq gabarits, arrivée de même nom, nom saisi qui prime, nom blanc, boucle, départ déplacé de plus de 500 m, boucle retirée, date.
4. `routeRecord.ts` : champ `place` relu par `readSessionPlace`, nom vide gardé ; tests.
5. `src/hooks/routePlace.ts` (neuf) : `createRoutePlaceFinder(deps)` (lieu appris, sinon recherche en ligne si permise, deux requêtes au plus espacées d'une seconde) et `saveRoutePlace(base, place, updatedAtAttendu)` dans `src/hooks/routeFiles.ts` (fiche relue, lieu écrit seulement si elle n'a pas changé et que le nom est toujours vide, `updatedAt` gardé). Test à dépendances simulées : hors ligne, lieu appris sans réseau, recherche coupée, fiche changée entre-temps.
6. `PlanningPage` : `defaultName` retiré ; au rangement `finalName = name.trim()` ; placeholder = nom calculé ; recherche lancée en tâche de fond après le rangement et à l'ouverture (`openSaved`), jamais pour toute la liste ; hors ligne : rangé sans lieu, retenté au prochain rangement ou à l'ouverture.
7. `routeDisplayName` aux 17 endroits, `routeFileBase` et `takenNames` compris.
8. Cinq clés dans `src/locales/en.json` et `es.json` ; formateur jour et mois dans `core/calendar.ts`, à côté de `shortDate`.

## Banc (partie à part, Sonnet)

`planning.mjs` complété avec le service de lieux simulé (`lib/lieux.mjs`, `allowPlaces`) : une boucle (« Boucle à <lieu> le <date> »), un aller entre deux lieux, un nom saisi qui reste, sans réseau (« Aller du … »). Textes qui changent : la partie itinéraire de `partage.mjs` et le parcours rangé de `balises.mjs` si le script ne saisit pas de nom ; itinéraires importés inchangés ; `langues.mjs` pour les clés neuves.

## Passe de doc (après validation)

DECISIONS §7 : le nom composé, ses gabarits, ses défauts.
