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

## Hors du lot

Tuiles de carte qui traversent le pont natif en texte, chiffres du direct incrémentaux (lot 402), démarrage (721 ko avant le premier affichage, attente de la mémoire jusqu'à 1,5 s) : rangés à part.

## Vérification

`node outils/verif.mjs --rapide` pendant, `npm run verif` à chaque étape. Banc contre HEAD : `library`, `general`, `graphes`, `virages`, `manoeuvres-diagnostic`, `allure-session`, `brouillon-voile` (texte identique, aucun chiffre ne bouge). `fluidite-compile` avant et après chaque étape sur l'ouverture d'une session longue, durée dite avant de lancer ; les deux mesures vont dans le rapport, et la phrase périmée d'ETAT §11 (« le reste est le dessin », « 10 à 18 s », `DOMParser`) sera corrigée d'après elles au lot 401.
