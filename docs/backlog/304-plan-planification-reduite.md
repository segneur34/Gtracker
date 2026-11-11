# 304 · Planification réduite : plan d'exécution (agent Plan, 11/11) et choix de l'orchestrateur

**Modèle | Réflexion** : Opus | high.

Briefs d'origine, à lire avant ce plan : `docs/backlog/319-revue-apres-fork.md`, section « Lot 304 (compléments) · Planificateur routier : ce que la liste oublie » (tableau des fichiers, pièges, vérification) ; `docs/backlog/154-vente-extraction-voile-surf.md`, partie E5 ; `docs/DECISIONS.md` §7. En cas d'écart, ce plan et les réponses ci-dessous l'emportent.

**But** : le planificateur routier disparaît (calcul d'itinéraire BRouter, revêtement, types de voie, altitude IGN, pente et dénivelé, boucle de retour calculée). Restent le parcours de balises en ligne droite et les itinéraires importés (GPX). `RouteMode` vaut `'straight' | 'imported'`.

## Réponses et choix déjà pris (ne pas reposer)

- Fiches d'itinéraire de l'autre application (Tracker) : plus relues ; un GPX simple se charge (le tracé seul).
- Dénivelé et pente d'un GPX importé : retirés.
- Recherche de lieu (Photon, `planning/geocoding.ts`) : **gardée**. Fonds de carte inchangés.
- `ROUTE_VERSION` : d'abord remis à 1 sans relecture des fiches de version 2 ou 3, puis **passé à 4 le 11/11** après la relecture (à 1, les itinéraires d'essai des 0.00.12 et 0.00.13 s'ouvraient en lecture seule sous le message « vient d'une version plus récente ») : le lecteur tolère déjà ces fiches, elles se relisent modifiables, en lignes droites, et se réécrivent en version 4. La remise à 1 se fera à la livraison (lot 308), quand plus aucune installation n'est à ménager.
- Une page sans activité planifiable s'affiche en parcours de balises ; la clé `gtracker.brouterProfile` reste orpheline sur les appareils (pas de purge) ; le champ `loop` des préférences de la page est ignoré ; `fetchJson.ts` reste dans `planning/`.
- `PLANNING_FAMILIES`, les `usesMarkCourse` hors de `PlanningPage` et `ELEVATION_PRESETS` restent pour le lot 326.

## Contexte vérifié le 11/11

Le lot 325 a déjà retiré `overpass`, `wayMatch`, `duration`, `FollowedElevation.tsx` et la durée de `RouteList.tsx`. Les champs de planification de `StoredSettings`, `SETTING_FIELDS` et `SettingsPage` sont déjà partis : Réglages ne garde que « Planification : balise sonore », qui reste. `usesMarkCourse` vaut vrai pour la voile et le surf : la page passe déjà par la branche des balises, sauf sans activité planifiable. Le chemin de la voile est donc neutre, et le banc peut le prouver.

## Sort des fichiers (`src/`)

- **Supprimés, `planning/`, avec leur test** : `brouter`, `brouterProfile`, `grade`, `ignAltimetry`, `importedElevation`, `legCalculation`, `loopReturn`, `segmentGrid`, `surface`, `wayTypes` (pas de test pour `wayTypes`).
- **Supprimés, `components/` et `hooks/`** : `ElevationProfileMini.tsx`, `routeProfileChart.ts`, `GradeLegendRow.tsx`, `SurfaceBar.tsx` et `SurfaceBar.css`, `SurfaceLayer.tsx`, `SurfaceHighlight.tsx`, `WayTypeTabs.tsx`, `gradeGradientDefs.tsx`, `hooks/useExclusiveToggles.ts`.
- **Amaigris** :
  - `planning/route.ts` : garde `Waypoint`, `RoutePoint`, `RouteLeg`, `newLeg`, add, insert, move, remove, reorder, reverse, `setLegMode`, `isLooped`, `closeLoop` (**à garder absolument** : le parcours de balises boucle), `courseLegs`, `routeFromTrack` sans lissage, `routePoints`, `waypointDistances`, et `routeTotals(route)` qui ne rend plus que la distance. Partent : les anciens modes (`RouteMode = 'straight' | 'imported'`, `DEFAULT_ROUTE_MODE = 'straight'`, `LegStatus = 'ready'`), la boucle calculée (`LoopReturn`, `withLoopReturn`…`withReturnError`, `openLoop`, `outboundKey`), les calculs de tronçon (`legKey`…`snapToWaypoints`), `WAY_TYPE_*`, `toggleWayType`, `LEGACY_*`, `parseWays`, `routeVehicle`, `isFixedMode`, `rebuiltMode`, `straightenRoute`, `DEFAULT_IMPORT_SMOOTHING_M`, le profil (`routeProfileRows`, `ProfileRow`, `profileGradeStops`) et `RoutePoint.eleM`.
  - `plannedRouteReducer.ts` : état réduit à `route` et `history` ; les actions `mode`, `loop`, `apply`, `retouch` partent.
  - `legJoin.ts` : `isWaysMode` et `isComputedLeg` partent.
  - `routeRecord.ts` : `ROUTE_VERSION = 1` ; pas de `surfaces` ; points rangés en `[lat, lon]` ; un mode inconnu donne une ligne droite neuve.
  - `routeGpx.ts` : plus de `<ele>`. `routeList.ts` : l'appel à `routeTotals`.
  - `hooks/usePlannedRoute.ts` : garde `route`, `canUndo`, `undo`, `replace`, `loadImported` (devenu un simple `replace`) et les éditions avec `closeLoop`. Partent `vehicle`, `mode`, `loop`, `chooseMode`, `setLoop`, `otherReturn`, `retry`, `recomputeSurfaces`, l'IGN, les caches et `PROFILE_KEY`.
  - `pages/PlanningPage.tsx` : `markCourse` devient constant. Partent les onglets `profil` et `surface`, `WayPicker`, la boucle calculée et ses textes, l'altitude IGN, le survol du profil, l'aide « non balises » et `PlanningPrefs.loop`. Les identifiants `planning.*` restants ne changent pas (un `id` de panneau est la clé de sa taille mémorisée). `PlanningPage.css` purgé en conséquence.
  - `hooks/useSportSettings.ts` : `effectiveLoopReturnRatio`, `effectiveGradeRange`, `effectiveWayTypes` et leurs imports partent (le lot 335 vient de toucher ce fichier ou ses voisins pour le foil et le pumping : ne pas défaire).
  - `recording/followedTrace.ts` : `eleM` et `FOLLOWED_TRACE_ELEVATION_TOLERANCE_M` partent ; `thinFollowedTrace` passe à `simplifyLatLon`.
  - `core/simplify.ts` (`simplifyAlongElevation`) et `core/elevation.ts` (`smoothElevationAlong`) perdent leur fonction. `accumulateElevation` **reste** (`computeElevationStats` des analyses le lit).
  - `TrackChart.tsx` : le type `area` et la prop `gradient` partent ; `GradientStop` part de `core/speedGradient.ts`.
  - `library/record.ts` : les champs `surfaces`, `terrainElevation` et `elevationSource` partent (type, `GUARDED_FIELDS`, fusion, `RECORD_EDIT_FIELDS`, `RecordPatch`), et leur libellé dans `library/recordMerge.ts`. `legacyImport.ts`, qui les retire à l'import, reste tel quel.
  - Textes et commentaires : la phrase d'`AboutSettings.tsx` (« le calcul des itinéraires et leur altitude ») ; la prop `interactive` de `HighlightPath.tsx` ; les commentaires de `highlightColors.ts` et `ZoomView.tsx`.
  - Clés : `STORAGE_KEYS.brouterProfile` part de `core/appIdentity.ts` et de son test ; l'exception « # Profil Tracker » (lot 304) part de `src/heritage.test.ts`.
- **Intacts** : `geocoding.ts`, `fetchJson.ts` (lu par `AboutSettings` et `geocoding` ; seuls son en-tête et ses exports sans lecteur sont à revoir), `routeImport.ts`, `routeShown.ts`, `RoutesPage.tsx` (le lot 317 lui a donné un menu « … » : ne pas le défaire), `RouteList.tsx`, `FollowTracePicker.tsx`, `useFollowedTrace.ts`, `legacyImport.ts`, `activitySettings.ts`, `activityPresets.ts`. L'exception `routeRecord → markGuide` d'`architecture.test.ts` reste.

## Étapes (typecheck vert à chaque fois)

1. `PlanningPage.tsx` et `usePlannedRoute.ts` ensemble (l'API du hook change) ; `route.ts` pas encore touché.
2. `route.ts`, le réducteur, `legJoin`, `routeRecord`, `routeGpx`, `routeList`, avec leurs tests.
3. Suppression des fichiers sans importeur ; dans le même pas : `useSportSettings`, `appIdentity`, `heritage`, et la clé `brouterProfile` de `outils/banc/lib/cdp.mjs`.
4. Altitude : `followedTrace`, `simplify`, `elevation`, `TrackChart`, `speedGradient`.
5. Fiche de session (`record.ts`, `recordMerge.ts` et leurs tests).
6. Textes.
7. **Pas dans ce passage** : `src/tutorials/lessons.ts:142-153` (leçon « Planifier un parcours », à réécrire pour des balises en ligne droite). Le lot 313 modifie ce fichier en même temps : l'orchestrateur te renverra cette étape après le commit du 313. Ne touche pas à `lessons.ts` avant.

## Tests

- À supprimer : ceux des dix modules supprimés, les blocs de `route.test.ts` devenus sans objet (dont `routeVehicle`), le profil et le lissage, `simplifyAlongElevation` dans `simplify.test.ts`, le relief et le D+ de `followedTrace.test.ts`.
- À adapter : `settings/activitySettings.test.ts` (un validateur local à la place de `isValidGradeRange`) ; `library/record.test.ts` (retirer l'import de `planning/surface` et les champs) ; `compat.formats.test.ts` (fiche de version 1, version future = 2) ; `core/appIdentity.test.ts` ; `sessionBundle.test.ts` et `useSessionLibrary.memoire.test.ts` (un champ inconnu neutre au lieu de `surfaces`) ; `plannedRouteReducer.test.ts` et `routeRecord.test.ts`.
- À écrire : un mode inconnu (`sentier`, `foot`) se relit en ligne droite neuve ; un point `[lat, lon, ele]` se relit sans altitude ; `routeFromTrack` rend des points sans `eleM` ; l'export GPX ne contient pas `<ele>` ; `thinFollowedTrace` sur une trace ancienne avec `eleM`.
- `src/library/summaryFrozen.test.ts` reste vert **sans refigeage**.

## Banc

- Tombent : `boucle.mjs`, `surface.mjs`, `recherche-sans-reponse.mjs`, avec leur entrée dans `outils/banc/scripts.mjs` et `SCRIPTS.md`, et la note Overpass de `LISEZMOI.md`. `BLOCKED_URLS` reste.
- À rejouer par l'orchestrateur, relevé identique attendu : `node outils/banc/passe.mjs balises planification-verrou --avant HEAD -j 1 --sans-cache`.
- `planning.mjs` se met en Course et ouvre l'onglet `surface` : son relevé changera par construction ; sa réécriture va au lot 330 (le dire dans le rapport).

## Recherche de contrôle finale (zéro attendu)

`rg -n "brouter|ignAltimetry|importedElevation|legCalculation|loopReturn|segmentGrid|wayTypes|WayType|SurfaceBar|SurfaceLayer|SurfaceHighlight|GradeLegendRow|gradeGradientDefs|ElevationProfileMini|routeProfileChart|useExclusiveToggles|routeVehicle|RouteVehicle|isWaysMode|effectiveWayTypes|effectiveGradeRange|effectiveLoopReturnRatio|DEFAULT_IMPORT_SMOOTHING_M|simplifyAlongElevation|smoothElevationAlong|terrainElevation|elevationSource|data\.geopf|PLANNING_TERRAIN" src outils/banc`

Exception attendue : `elevationSource` et `terrainElevation` dans `legacyImport.ts` et son test (la porte d'import, qui les retire).

## Règles de `CLAUDE.md` qui s'appliquent

9 et 13 (`architecture.test.ts` échoue si une exception devient inutile), 11 (`pathOptions` stables sur la carte de planification), 3, et « Où ajouter quoi » pour l'onglet et le panneau.

## Essai au téléphone (un seul)

Itinéraires en voile : poser 3 balises, « Boucler », enregistrer, rouvrir, puis charger un GPX simple ; la carte s'affiche, aucun calcul n'est attendu, « Partir » ouvre Enregistrer. Depuis la liste des itinéraires : « … », « Supprimer », « Garder » puis « Supprimer définitivement » (lot 317).

## Passe de doc après validation

DECISIONS §7 (types de voie, boucle calculée, IGN, temps estimé) à réécrire ; ligne du lot dans `docs/BACKLOG.md` ; fiche 154 (E5).
