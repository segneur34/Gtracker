# 328 · Voile : une seule voie de calcul, seuils sans défaut caché : plan des étapes a et b

Brief : `docs/backlog/319-revue-apres-fork.md`, section « ## Lot 328 » (lignes 1559 à 1632 ; ne pas lire le fichier en entier). Ce plan, fait le 11/11 par l'agent `Plan` contre le code du commit `32ec391`, prime sur les numéros de ligne du brief. Aucun chiffre ne change : résumés figés et banc identiques.

## Tranché par l'orchestrateur

- `analyzeSailingSession` et `sailingSessionThresholds` vont dans l'aide de test `src/test/sailing.fixture.ts` ; `src/sailing/sailingSession.test.ts` garde ses tests et change son import. Les types `SailingSessionSettings` et `SailingSessionAnalysis`, qui ne servent qu'à elles, les suivent.
- `stableSegment` garde son `export` : son test à 1 Hz et 5 Hz avec ±1° de bruit est plus précis que ce qui passerait par le classement.
- `maneuvers.test.ts` n'est pas découpé dans ce lot.
- Les seuils nommés en tête des fichiers (dont `WIND_ESTIMATION_MIN_SPEED_KN` et `MANEUVER_MIN_ENTRY_SPEED_KN`) restent tolérés tels quels.
- Les surcharges de `ManeuverOptions` restent ; `PointData.speedKn?` et `stepDistanceM?` restent optionnels ; règles 2, 3, 5, 7 et 10 de `CLAUDE.md` intouchées (ni polaire glissante ni corde entrée → sortie, même dans un test).
- Avant de retirer un `export` de `src/` : Grep dans `outils/` (le banc charge le TypeScript, tsc et knip ne le voient pas).

## État du brief dans le code

- `src/sailing/wind.ts` : `estimateWindPolar` (:719), `WindEstimateOptions` (:703), `estimateWindFromPolar` (:401), `polarWindCandidates` (:357 ; commentaires :25, :363, :773-777, :808 à reprendre), `describeWindCandidate` (:386) : à supprimer ; `scoreWindCandidate` (:246) : retirer `export` seulement.
- `src/sailing/maneuvers.ts` : `DetectedTurn` (:967), `measureManeuver` (:1101 ; commentaire :1290), `analyzeManeuvers` (:1932-1942) : à supprimer.
- `src/sailing/sailingSession.ts` :276-291 et types :253, :267 : vers la fixture ; commentaire :56-58 à reprendre.
- `outils/banc/manoeuvres-diagnostic.mjs` :42, :147, :153 appelle `analyzeManeuvers` : passer à `classifyManeuvers(prepareManeuverDetection(...))`. `outils/banc/SCRIPTS.md` ne cite pas la fonction : rien à y changer.
- Exports à retirer (liste du brief) : tous confirmés, aucun appelé dans `outils/`. `tackOf` (:92) et `maneuverAgreement` (:356) perdent leur `export` une fois leurs tests réorientés.
- Étape b : `sailingConfig.ts` :16-25 ; `sailingStats.ts` import :8, replis :66 et :68 ; `maneuvers.ts` :22-23, :1386, :1694 ; `sailingAnalytics.ts` :6, :585, :685 ; `sailingConfig.test.ts` :99-102 ; `wind.ts` :411, :413 (lus :603, :619) ; coefficient 0,9 en `maneuvers.ts:627` ; `PolarManeuver.type` en `wind.ts:62` ; `calculateVmgStats` (:581) et `vmgSeries` (:681), appelés en `sailingSession.ts:231-232` ; `calculateWindStats` (`sailingAnalytics.ts:125`, appelé en `sailingSession.ts:217`) ; alias :79 et :226 ; `gpsTurns.ts:10`.
- Profil passé à `sailingActivityMask`, `sailingRatioMask`, `sailingFlights` (`sailingStats.ts:36`, `:45`, `:100`) ; adapter aussi `outils/banc/pumping-diagnostic.mjs:124` (`SPORT_PROFILES[support]`), que le brief oublie.
- Déjà fait : le commentaire « DECISIONS §2 » de `sailingStats.ts`.
- À créer : `src/surfing/surfSession.test.ts` pour `effectiveWaveThreshold` (`surfSession.ts:30`).

## Tests de la voie retirée

- Une aide `detectAndClassify(points, wind, options)` dans `src/test/sailing.fixture.ts` (`classifyManeuvers(prepareManeuverDetection(points, o), wind, o)`) remplace les quelque 70 appels à `analyzeManeuvers`, sans toucher une attente. À l'étape b, elle seule ajoute en tête des options les seuils du wingfoil lus dans `SPORT_PROFILES.wingfoil`.
- `maneuvers.test.ts` :1910-1925 gardé (référence : une détection neuve à chaque vent).
- `wind.test.ts` : tests de `scoreWindCandidate` (:116) par `prepareWindPolar(buildPoints(...)).describe(0).best` ; de `estimateWindFromPolar` (:161) par `.candidates[0]` ; de `describeWindCandidate` (:191) par `.describe(dir)` ; le test d'équivalence (:220) garde ses entrées, ses comparaisons à l'ancienne API deviennent : au plus trois candidats, triés par score, écartés d'au moins 45° ; `describe(c0.direction)` égal à `c0` ; une direction de `polar` égale à `c0` ou `c0 + 180`.
- `windSessions.test.ts:80` par `prepareWindPolar(a.points, a.polarMinSpeedKn, a.minEntrySpeedKn).candidates[0]`.
- `maneuvers.test.ts` : :1205 et :1209 par `prepareWindPolar(track, n).candidates[0]` ; :1239, :1285, :1309 par `.polar` ; :1294 par `.describe(dir)`.
- :754 (`measureManeuver` à plusieurs points de déclenchement) : réorienter en variant la surcharge `windowSeconds` (10, 12, 14) sur `scriptedTack(0)`, bornes de rotation identiques ; si cela ne tient pas, le retirer (couvert par :735 et :1671) et le dire.
- `tackOf` (:1831) retiré, couvert par :1838, auquel s'ajoute une session à vent 90. `maneuverAgreement` (:484) : ligne retirée, couverte par :473.
- Étape b : :1265 (« sans options, reproduit le wingfoil ») retiré, couvert par :1255 ; la quarantaine d'appels sans seuil prend les seuils du wingfoil depuis la fixture.
- Pour chaque test retiré, le rapport nomme le test de la voie livrée qui couvre le même cas.

## Ordre

- a1 : déplacer `analyzeSailingSession` dans la fixture. a2 : créer l'aide, réorienter les tests, adapter `manoeuvres-diagnostic.mjs`. a3 : supprimer le code mort, puis retirer les `export`.
- b1 : seuils obligatoires, support passé ; `stillSpeedKn: profile.stillThreshold` ajouté dans `manoeuvres-diagnostic.mjs`. b2 : constantes d'orientation partagées, constante 0,9 nommée (`MANEUVER_CONFIDENCE_DISCOUNT`), type `ManeuverKind`, objet d'options de la VMG, `calculateWindStats` sans la trace, alias retirés, profil passé, commentaire de `gpsTurns`, test de `surfSession`.
- Pendant : `npx vitest run src/sailing src/surfing src/core/trackColor.test.ts src/library/summary.test.ts`, puis `node outils/verif.mjs --rapide`.
- Recherches de contrôle à 0 dans `src` et `outils` (l'aide de test exceptée) : celles de la section « Vérification » du brief.
- Non vérifié par le plan : le contenu entier de `sailingSession.test.ts`, de `windSessions.test.ts` et des tests :1317-1340 ; si `windowSeconds` déplace vraiment le déclenchement.

## Étape a, décisions d'exécution (11/11)

- :754 réorienté : `windowSeconds` 10, 12 et 14 déplacent bien le déclenchement (trois premiers points de virage distincts, lus par `detection.windowAt`) et les bornes `entryIndex`-`rotationEndIndex` restent les mêmes. La variation de la borne de fin passée à la mesure (43, 44, 45 s) n'a plus d'équivalent : la fin vient de la détection elle-même.
- `stableSegment` garde son `export` (tranché plus haut) ; les autres exports de la liste du brief sont retirés.

## Après validation, passe de doc

ETAT lignes 108, 119, 130, 314, 335 ; INVENTAIRE lignes 63, 64, 66, 300.
