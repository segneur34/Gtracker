# 400 · Ouverture d'une analyse et page Sessions plus légères, sans changer un chiffre

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11 (auditeurs « affichage » et « calculs », d'accord entre eux ; constats 1 à 3 relus dans le code par l'orchestrateur). Mesures de l'auditeur, sur PC, trace de 4 h à 5 Hz (72 000 points) : lecture et cinématique en arrière-plan 517 ms ; clonage du résultat 310 ms (152 ms sans les points bruts) ; puis, sur le fil de l'affichage, `prepareSailingTrack` 272 ms, `analyzeSailingAtThreshold` 376 ms, `analyzeSailingWind` 86 ms, couleurs 79 ms. Au téléphone, compter quatre à six fois plus (estimation).

Deux étapes, chacune vérifiée et commitée à part. Aucun chiffre d'analyse ne change : `library/summaryFrozen.test.ts` reste tel quel, `SUMMARY_CALC_VERSION` ne bouge pas.

## Étape 1 (petite)

1. **Points bruts renvoyés pour rien.** `src/core/prepareTrack.ts:36-47,82` renvoie `rawPoints` ; le fil de l'affichage n'en lit que la longueur (`src/hooks/useGpxSession.ts:58,148`, `src/hooks/useSailingSession.ts:194`). Attendu : le calcul renvoie le nombre de points. Vérifier aussi si `TrackPoint.time` (chaîne ISO, `core/kinematics.ts:489`) est relu quelque part en aval ; sinon, le sortir du résultat.
2. **Vignettes de Sessions sur le fil de l'affichage.** `src/components/SessionPreviewMap.tsx:135` appelle `sessionColorTrack` (`src/library/sessionTrack.ts:33-53` : lecture du GPX, cinématique, bornes) sans passer par le calcul en arrière-plan ; `src/components/SavedSessionShare.tsx:55` de même. Mesuré : 488 ms par vignette pour 4 h à 5 Hz. Attendu : une tâche de plus dans `src/library/trackWorkerProtocol.ts`, sur le modèle de `prepare`, avec le même repli en ligne.
3. **Cache de la bibliothèque réécrit à chaque lancement.** `src/hooks/sessionLibrary/cache.ts:32-41` finit toujours par `jsonStore.write` ; `src/platform/storage.ts:120-133` écrit sans comparer. Attendu : aucune écriture quand le texte n'a pas changé.
4. `loadSessionGpx` (`src/hooks/sessionLibrary/sessionRecords.ts:54-57`) lit la fiche puis le GPX l'un après l'autre : les lancer ensemble.

## Étape 2 (moyenne à grosse) : l'analyse « avec vent » et « sans vent » hors du fil de l'affichage

`src/hooks/useSailingSession.ts:93-132` enchaîne dans des `useMemo` `prepareSailingTrack`, `analyzeSailingAtThreshold`, `analyzeSailingWind` et la polaire ; `src/pages/SailingModule.tsx` (vers 333) y ajoute `trackColorSegments` ; `src/pages/SurfModule.tsx:219-240` est dans le même cas. `useDeferredValue` ne retarde que le seuil, pas le premier calcul.

Attendu : une tâche d'analyse dans le calcul en arrière-plan, qui garde sur place l'objet préparé de la session ouverte (sa détection de manœuvres contient des fonctions et ne traverse pas un message) et recalcule sur demande pour un seuil ou un vent saisi ; mêmes fonctions, donc mêmes chiffres, avec le repli en ligne de `runTrackJob`. Côté page : pendant le calcul, les derniers chiffres restent affichés avec l'indication habituelle de chargement, une réponse périmée est écartée (drapeaux `alive`, comme pour `prepare`), quitter l'analyse abandonne le calcul. Un plan (agent `Plan`) avant de coder cette étape.

## Étape 1, faite le 15/11 : ce qui en ressort

- `TrackPoint.time` est gardé : deux tests le relisent (`surfing/surfAnalysis.test.ts`, copie gelée de `core/prepareTrack.test.ts`), aucun lecteur dans l'application ; le retirer demande de récrire ces tests, hors de ce lot.
- La comparaison « pas d'écriture à texte identique » est dans `platform/storage.ts` : elle vaut pour tous les magasins.
- Relecture : une analyse ouverte depuis Sessions attendait derrière les vignettes déjà demandées, le calcul en arrière-plan étant unique et servi dans l'ordre. Remède, repris du plan de l'étape 2 : deux files, donc deux calculs en arrière-plan, « analyse » (`prepare`, puis les tâches de l'étape 2) et « fond » (`summarize`, `colorTrack`).
- Constat voisin laissé : `summarizeGpxText` (image de partage d'une session pas encore rangée) tourne encore sur le fil de l'affichage.

## Plan de l'étape 2 (agent Plan, 15/11) et questions tranchées par l'orchestrateur

Constats : `useSailingSession.ts` (93-132) enchaîne `prepareSailingTrack`, `analyzeSailingAtThreshold`, `analyzeSailingWind` et `sailingPolarGraph` sur le fil de l'affichage, seul le seuil étant différé (`useDeferredValue`, `thresholdPending`) ; `SailingModule.tsx` (vers 334) y ajoute `trackColorSegments` ; `SurfModule.tsx` (219-243) fait `runSurfSession` puis les couleurs sans aucun différé. Ne traversent pas un message : `PreparedSailingTrack.detection` (fonctions `turnAt`, `rotationOf`) et `WindStats.windAt` (fermeture, `sailingAnalytics.ts` vers 163).

Architecture :
1. Dans le calcul en arrière-plan, une mémoire d'une seule session (`src/library/analysisStore.ts`, pur) : clé donnée par la page, trace préparée, préparation voile gardée tant que calcul, allure et profil ne changent pas, dernier résultat au seuil gardé tant que le seuil ne change pas (un vent seul changé ne refait pas le calcul au seuil), dernières couleurs. Tâches `analyzeSailing`, `analyzeSurf`, `release` ; si la clé n'est pas en mémoire (calcul recréé, repli en ligne), la tâche refait `prepareTrack` elle-même : mêmes fonctions, mêmes arguments, mêmes chiffres.
2. Reviennent à la page : statistiques, vols, vent estimé et retenu, manœuvres et leur résumé, VMG et sa série, statistiques de vent sans `windAt`, polaire, bornes de couleur suggérées, seuils de manœuvre, segments colorés. Restent dans le calcul : masque d'activité, détection, étape de la polaire. Clonage simple, pas de tableaux typés.
3. Côté page : `trackData` refait par `trackToPointData` ; `windAt` rebâti par un `withWindAt` exporté de `sailingAnalytics.ts` (`calculateWindStats` garde ses échantillons et bâtit sa fermeture par la même fonction).
4. La dernière demande gagne (`src/library/latestRunner.ts`, pur) : une demande en vol, la suivante remplace celle en attente, abandon en quittant, `release` vide la mémoire du calcul.
5. Un hook `useTrackAnalysis(family, source, inputs)` rend la trace et son analyse ensemble, jamais l'analyse d'une session sur la trace d'une autre ; tant qu'une trace neuve n'a pas sa première analyse, « Lecture de la session… » reste affiché ; ensuite les anciens chiffres restent pendant un recalcul. Règle 4 : les seuils sont résolus dans le hook, le calcul reçoit un seuil déjà résolu.

Tranché par l'orchestrateur :
- deux calculs en arrière-plan (files « analyse » et « fond ») plutôt qu'une priorité dans un seul : plus simple, et l'ouverture d'une analyse n'attend plus ni les vignettes ni les résumés ;
- pendant un recalcul, l'indication est celle que `thresholdPending` donne déjà aujourd'hui au changement de seuil, étendue au vent saisi et à la trace (`analysisPending`) ; aucune marque neuve, aucun texte neuf (le texte relevé par le banc reste identique) ; une marque plus visible serait une décision de l'utilisateur, signalée à l'arrêt du paquet ;
- les écritures dans la fiche qui partent d'un résultat (`SailingModule.tsx`, vers 196 et 267) attendent la fin du recalcul : jamais un résultat périmé dans une fiche ;
- les couleurs de la trace passent dans le calcul avec le reste ; si le branchement dépasse la taille d'un agent, version réduite sûre : la voile d'abord, puis le surf, puis les couleurs, l'arbre vert et commitable à chaque pas.

Deux agents successifs : A, sans brancher la page (mémoire, tâches, coureur, `withWindAt`, tests de stricte égalité entre l'appel direct, le faux calcul en arrière-plan et le repli en ligne, à 1 Hz et 5 Hz ; clonage de chaque profil de `SPORT_PROFILES`) ; B, le branchement (`useGpxSession`, `useTrackAnalysis`, voile, surf, couleurs), puis banc et mesure.

Risques à surveiller : un script du banc qui relève le texte juste après un changement de seuil ou de vent, avant la réponse ; le texte du GPX recopié à chaque demande (à n'envoyer que si la clé manque, si la mesure le montre coûteux) ; mémoire de la trace doublée tant que l'analyse est ouverte.

## Hors du lot

Tuiles de carte qui traversent le pont natif en texte, chiffres du direct incrémentaux (lot 402), démarrage (721 ko avant le premier affichage, attente de la mémoire jusqu'à 1,5 s) : rangés à part.

## Vérification

`node outils/verif.mjs --rapide` pendant, `npm run verif` à chaque étape. Banc contre HEAD : `library`, `general`, `graphes`, `virages`, `manoeuvres-diagnostic`, `allure-session`, `brouillon-voile` (texte identique, aucun chiffre ne bouge). `fluidite-compile` avant et après chaque étape sur l'ouverture d'une session longue, durée dite avant de lancer ; les deux mesures vont dans le rapport, et la phrase périmée d'ETAT §11 (« le reste est le dessin », « 10 à 18 s », `DOMParser`) sera corrigée d'après elles au lot 401.
