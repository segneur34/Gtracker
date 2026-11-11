# 317 · Supprimer un itinéraire depuis la liste des itinéraires

**Modèle | Réflexion** : Sonnet | medium. Petit lot.

## Demande

Bibliothèque › Itinéraires (`src/pages/RoutesPage.tsx`) : un bouton « … » par ligne avec « Supprimer » et la même confirmation que dans Planifier (« Supprimer définitivement » / « Garder »).

Résultat attendu : supprimer un itinéraire rangé sans passer par Planifier.

## Ce que le code dit (relevé le 11/11)

- `src/pages/RoutesPage.tsx:136-144` : `RouteList` reçoit pour `actions` le seul bouton « Partager » (`:140-142`). La page ne prend pas `remove` de `useRouteLibrary` (`:44`).
- `src/components/RouteList.tsx:26-40` : props `actions` (`:33`) et `go` (`:35`).
- `src/components/ui/MoreMenu.tsx:22` : `MoreMenu({ label, children })`, le menu « … » commun (styles `components/ui/ui.css:511`).
- La confirmation à reprendre : `src/pages/PlanningPage.tsx:1269-1276` (« Supprimer définitivement » / « Garder »). La suppression : `library.remove` (`src/hooks/useRouteLibrary.ts:40`, puis `removeRoute`, `src/hooks/routeFiles.ts:101-103`).

## À faire

- Dans `RoutesPage.tsx`, les actions d'une ligne passent dans un `MoreMenu` (« Plus d'actions sur l'itinéraire ») : « Partager » (l'existant, inchangé dans son effet) puis « Supprimer ».
- « Supprimer » demande confirmation à sa place, avec les deux mêmes mots que Planifier : « Supprimer définitivement » et « Garder ». La suppression appelle `remove` de `useRouteLibrary` ; un échec est dit, jamais muet.
- Ne pas modifier `PlanningPage.tsx` (le lot 304 le réécrit en parallèle) : si la confirmation mérite une pièce commune, la poser dans `components/` et l'employer dans `RoutesPage` seulement, en le signalant dans le rapport.
- Styles par les variables de `src/theme/tokens.css`, pas de valeur en dur.

## Ne pas toucher

- `src/pages/PlanningPage.tsx`, `src/hooks/usePlannedRoute.ts`, `src/planning/*` (lot 304) ; `src/components/SessionNameEditor.tsx` (lot 316) ; les fichiers du lot 314 (`src/library/record.ts`, `src/pages/SettingsPage.tsx`, `src/pages/SailingModule.tsx`, `src/library/shareStats.ts`, `src/core/activityIcons.ts`).

## Vérification

- `node outils/verif.mjs --rapide`.
- Banc : le script qui ouvre `/itineraires/liste` s'il en existe un (le dire dans le rapport) ; sinon dire qu'aucun script ne couvre la page.
- Pas d'essai au téléphone propre : il se joint à celui du lot 304 (Itinéraires).
