# 303 · E4, retirer course et vélo (`running/`, `cycling/`, `land/`, `LandModule`)

Noté le 08/11. Modèle | Réflexion : Opus | high, plan `Plan` devant. Source : `docs/backlog/154-vente-extraction-voile-surf.md` ligne E4 ; `D:\gong tracker\atelier\audit-vente-0111\angle-X1.md` tables `components/`, `hooks/`, `library/`, `pages/`, `recording/`, `settings/`, `platform/` et § « Couplages ». Dépend du 302. Lire `docs/DECISIONS.md` § 2 (Course et vélo), § 3 (Sauts : `platform/motion.ts` reste pour les sauts), § 7 (Planification : gardée jusqu'au 304), § 10 (Statistiques), § 11 (Réglages et accueil). Résultat exigé : `src/running/`, `src/cycling/`, `src/land/` supprimés ; `LAND_FILES` et `SEAM` de `src/architecture.test.ts` **vides** (le test l'impose) ; `npm run build` vert.

## Ce qui part

- Pages et routes : `pages/LandModule.tsx`, `pages/landModules.tsx`, `App.tsx` chargeurs ~21-22 et routes `/course`, `/course/analyse`, `/velo`, `/velo/analyse` (~130-133) ; `components/AppShell.tsx` `COURSE`, `VELO` ; entrées d'accueil (`pages/Home.tsx`) et de bibliothèque de ces familles.
- Composants : `CadencePanel`, `cadenceColors`, `KilometerSplitsTable`, `StatsLevelPanel`, `GradeGradientLegend`, `GradeLegendRow`, `gradeGradientDefs` (vérifier `TrackChart`, `ElevationProfileMini` : `GradientStop` est déjà dans `core/speedGradient.ts` ; ce que la voile et le surf utilisent reste), `SurfaceBar(.css)`, `SurfaceHighlight`, `SurfaceLayer`, `WayTypeTabs` **si** seuls course et vélo les lisent (si la planification les lit, ils attendent le 304) ; `HeartRatePanel` : dérive cardiaque et nuage allure/FC (course) retirés, le reste gardé ; `activityArt.tsx`, `familyIcons.ts`, `icons.tsx` : motifs et icônes des familles À pied et Vélo (les **types** de famille restent, 305).
- Hooks et bibliothèque : `useTerrainElevation`, `useSessionSurfaces` ; `library/statsLevel.ts` (+ test) ; `platform/motion.ts` : la branche cadence (pas) part, les sauts restent ; `MotionPlugin.java` : idem (cadence retirée, mouvement pour les sauts gardé ; si tout le greffon ne sert qu'à la cadence, le supprimer et le retirer de `MainActivity.java`).
- Images : `assets/accueil/vignette-velo.webp`, `vignette-fractionne.webp`, `assets/bandeaux/course.webp`, `velo.webp`, `fractionne.webp` et leurs imports.
- Couture (`SEAM` actuelle) à découdre, fichier par fichier : `hooks/useLiveRecording.ts`, `useRecorder.ts` (cadence), `useSportSettings.ts`, `library/record.ts`, `summary.ts`, `summaryOptions.ts`, `stats.ts`, `pages/SessionLibrary.tsx`, `SettingsPage.tsx` (sections pente, énergie, poids, charge, cadence), `StatisticsPage.tsx` (énergie, cadence, pente), `PlanningPage.tsx`, `planning/route.ts`, `planning/importedElevation.ts`, `recording/gpxWriter.ts` (extension cadence), `recording/liveStats.ts` (chiffres du direct terre), `settings/activityPresets.ts`, `activitySettings.ts` : les branches terre sont retirées, **les unions ne bougent pas** (`SportType`, `Treatment`, `SportFamily`, `StoredSettings` gardent leurs membres terre : 305) ; là où une valeur terre est encore attendue par le type, une constante ou un `null` documenté « retiré, lot 305 » suffit.
- Planification (gardée jusqu'au 304) : `planning/duration.ts` perd `cycling/energy` (estimation de durée à vitesse plate, ou retrait de l'estimation vélo : le plan tranche la plus petite option) ; la pente lue par `planning/route.ts`, `PlanningPage.tsx`, `planning/importedElevation.ts` vient d'une copie minimale posée dans `planning/` (`planning/grade.ts`, seules les fonctions utilisées), pas d'un import de `land/`.
- Tests : les tests ancrés sur la course (fiche 154, « Plan du 07/11 » point 7) sont supprimés avec leur fichier ou basculés sur les fixtures voile et surf (`src/test/record.fixture.ts`, `surf.fixture.ts`, `sailing.fixture.ts`) ; `core/trackPaths.test.ts` → fixtures voile. Les gardes du 187 (`summaryFrozen`, `useSportSettings.guard`, `settingsImport.guard`) restent vertes telles quelles.
- Banc : registre allégé de `altitude`, `cadence`, `cadence-diagnostic`, `charge`, `depense`, `pentes`, `roulement`, `library3`, `marche`, `allure-session` ; `distance-diagnostic`, `energie-fc-diagnostic`, `graphes`, `carte-direct`, `trace-suivie` : lire la tête de chaque script et garder ceux qui éprouvent la voile, le surf ou le transverse.

## Ce que tu ne fais pas

Pas de changement d'union ni de pré-réglage (305), pas de retrait du planificateur routier (304), pas de commit, pas de version, pas de `docs/`. Question de produit non couverte → rapport, avec recommandation.

## Vérification, banc, essais

`node outils/verif.mjs --rapide` à chaque étape ; `grep -rn "running/\|cycling/\|land/" src --include=*.ts --include=*.tsx` vide à la fin. Banc (orchestrateur) : `general surf balises partage profil cardio sauts` identiques avant/après hors accueil, bibliothèque, Réglages et Statistiques (familles terre disparues). Essais au téléphone : accueil et bibliothèque sans course ni vélo ; une session voile et une surf s'ouvrent comme avant ; Statistiques ; Réglages (familles Voile et Surf).

## Décisions de l'orchestrateur (08/11, sur les questions du plan)

1. Planification : après ce lot, Planifier ne propose que Voile et Surf (balises) ; routage, altitude IGN, durée, boucle et voies restent dans le code sans être montrés, jusqu'au 304. Accepté.
2. Sessions de course, vélo et fractionné déjà rangées : plus d'analyse (adresse → accueil ou `/fractionne`), fiches jamais réécrites, comptées dans « Tout » des Statistiques ; le sport préféré du Profil et le fond des pages ne comptent que la voile et le surf.
3. Images : `assets/bandeaux/fractionne.webp` reste jusqu'au 305 (bibliothèque `/fractionne` gardée au 302) ; `assets/accueil/vignette-a-pied.webp`, `vignette-velo.webp`, `bandeaux/course.webp`, `bandeaux/velo.webp` partent ; `vignette-fractionne.webp` part si plus rien ne l'importe.
4. Icônes et silhouettes (`icons.tsx`, `familyIcons.ts`, `activityArt.tsx`, `IconPicker`) : rien au 303, tout au 305 avec les unions.
5. Banc : `allure-session` reste au registre (il éprouve l'allure imposée de la voile) ; `energie-fc-diagnostic` aussi.
6. Documents : même exception limitée qu'au 302 (retirer les citations de fichiers supprimés que `npm run verif` refuserait : CLAUDE.md, INVENTAIRE (y ajouter `core/retiredLand.ts` et `planning/grade.ts`), ETAT, DECISIONS § 2, 3, 7, 10, 11). Règle 13 de `CLAUDE.md` : la reformuler en « 13. Le code commun n'importe rien de la terre (course, vélo, Entraînement), retirée aux lots 302 et 303 ; `src/architecture.test.ts` garde `LAND_FILES` et `SEAM` vides, et aucun dossier `running/`, `cycling/` ou `land/` ne revient. » (à faire valider par l'utilisateur au compte rendu ; la passe `doc` reprendra le reste).
7. Import d'un GPX de course ou de vélo : rangé dans une famille cachée, sans message ; question laissée au 305 (devinette de `naming.ts`).
8. `core/retiredLand.ts` (restes gardés par les types) et `planning/grade.ts` : acceptés comme modules de transition, en-tête « retiré au lot 305 » ou « jusqu'au 304 ».

## Plan du 08/11 (agent Plan, Opus ; à suivre par l'agent lot)

Chemins relatifs à `src/`, sauf mention contraire. À la fin de chaque étape, trois contrôles : `npx tsc -b`, `node outils/verif.mjs --rapide` et `npx vitest run src/architecture.test.ts` (ce test lit le disque, `--changed` ne le prend pas). Chaque fil coupé sort de `SEAM` ou de `LAND_FILES` dans la même étape, sinon le test échoue. Avant chaque suppression, chercher les appelants par Grep.
Ne changent pas (lot 305) : `SportType`, `Treatment`, `SportFamily`, `StoredSettings` (clés et types), les champs de `SessionRecord` et `SessionSummary`, `ActivityIconId`, `LiveFieldKey` et `liveFields.ts`, `core/analysisTabs.ts`, `core/sportProfiles.ts`, les valeurs d'`activityPresets.ts`, `shareStats.ts`, `naming.ts`, `units.ts`, `SUMMARY_CALC_VERSION`.

**1. Rendre les familles inertes (aucune suppression)**
- `core/activities.ts` : `RETIRED_FAMILIES = ['course', 'velo', 'fractionne']`, avec son test. Accueil, barre, Enregistrer, Réglages, `ActivitySheet` et Statistiques suivent seuls. La planification aussi : `plannable` passe par `isShown`.
- Le fond des pages et la photo du Profil ne comptent plus les familles retirées : filtrer les sessions avant `favoriteFamily` dans `hooks/useFavoriteBackdrop.ts` et chez les autres appelants de `favoriteFamily` et `favoriteActivity`.
- `tutorials/lessons.ts` : la leçon `capteurs` passe à `families: ['voile', 'surf']` et « en wing, en kite » ; la leçon `activites` prend l'exemple « (wingfoil, kite, surf…) ».

**2. Déplacements, avant toute coupe (copies ; les originaux partent à l'étape 8)**
- `planning/grade.ts` reprend de `land/grade.ts` : `computeGrades`, `GradeRange`, `DEFAULT_GRADE_RANGE`, `isValidGradeRange`, `steepnessShare`, `gradeGradientColor`, `gradeStepColor`, `GRADE_COLOR_STEPS`, `ColoredPath`, `gradeColorPaths`, `gradeGradientStops`, plus `DEFAULT_CYCLING_GRADE_RANGE` (de `cycling/cyclingConfig.ts`). Ni zones ni `classifyGrade`. Le lisent : `planning/route.ts` (et son `export type { GradeRange }`), `pages/PlanningPage.tsx`, `settings/activitySettings.ts`, `settings/activityPresets.ts`, `hooks/useSportSettings.ts`.
- Nouveau `core/retiredLand.ts`, en-tête « restes de la terre gardés par les types, retirés au lot 305 » : `EnergyModel`, `isEnergyModel`, `isValidCarriedLoad`, `isBikeType`, `isValidBikeWeight` et `BIKE_DEFAULT_KG: Record<BikeType, number>` (les `bikeKg` de `BIKE_TYPES`, recopiés) ; lecteurs : `library/record.ts`, `library/summaryOptions.ts`, `settings/*`, `hooks/useSportSettings.ts` ; `BikeType` reste dans `core/domainTypes.ts`.
- `heartRatePreviewPath` va dans `core/heartRateSession.ts` (vignette FC de `pages/SessionLibrary.tsx`). `terrainSamplePoints` et son type deviennent locaux à `planning/importedElevation.ts`. Leurs tests suivent (`land/heartRateSession.test.ts` l. 73, `land/terrainElevation.test.ts` l. 42).
- `SEAM` perd les fils de `library/record`, `library/summaryOptions`, `pages/SessionLibrary`, `pages/PlanningPage`, `planning/route`, `planning/importedElevation`, `settings/activityPresets` (2), et ceux d'`activitySettings` et de `useSportSettings` vers `land/grade`.

**3. Pages, routes et composants d'analyse**
- Supprimés : `pages/LandModule.tsx`, `pages/landModules.tsx`, `components/CadencePanel.tsx`, `cadenceColors.ts`, `KilometerSplitsTable.tsx`, `GradeGradientLegend.tsx`, `SessionWeightField.tsx`, `hooks/useTerrainElevation.ts`, `hooks/useSessionSurfaces.ts`, et dans `pages/analysisMobile.css` `.an-land-hint` et `.an-land-opts`.
- `App.tsx` : chargeur, `lazy` et préchargement de `LandModule` partent ; les quatre routes course et vélo deviennent `/course/*` et `/velo/*` → `<Navigate to="/" replace />` ; `TrainingAnalysis` part et `/fractionne/analyse` mène à `/fractionne`.
- `components/AppShell.tsx` : `COURSE` et `VELO` partent ; `FAMILY_TABS` devient `Partial<Record<SportFamily, Destination>>`.
- `pages/Home.tsx` : imports de `vignette-velo`, `vignette-a-pied`, `vignette-fractionne` partent ; `FAMILY_PHOTO` devient `Partial`.
- `pages/SessionLibrary.tsx` : imports de `bandeaux/course` et `bandeaux/velo` partent ; `banner` facultatif dans `FAMILY` ; fichiers `.webp` supprimés selon la décision 3.
- `components/HeartRatePanel.tsx` : partent `efficiency` (`HeartRateEfficiency`, dérive, nuage, `Scatter*`, `scatterTooltipStyle`, phrases d'aide), `zoneLines` et `mapless` (seul `LandModule` les passait) ; en conséquence `heartRateDrift` et `efficiencyBlocks` de `core/heartRate.ts` partent avec leurs tests.
- `core/backdropPattern.ts` : `courseTile`, `veloTile`, `trailX`, `veloHeight` partent ; `BACKDROPS.course` et `.velo` reprennent l'entrée `contours` (les clés restent) ; test ajusté. `fractionneTile` reste.
- `LAND_FILES` perd les 4 composants, `useTerrainElevation`, `LandModule`, `landModules`.

**4. Statistiques**
- Supprimés : `components/StatsLevelPanel.tsx`, `library/statsLevel.ts` (avec son test), `.stats-level__*` dans `pages/StatisticsPage.css`.
- `pages/StatisticsPage.tsx` : l'onglet « niveau » (`StatsSection`, sa liste, `STATS_SECTION_DEFAULTS`, son panneau), `isWalking`, `levelFamily`, `levelSessions`, `isLandFamily` et sa tuile D+, les cas `'cadence'` et `'denivele'` des formats. `zonesFor` reste.
- `library/stats.ts` : `cadenceSpm` et `bests` sortent de `StatSession` ; `LAND_FAMILIES`, les métriques `denivele` et `cadence` et `'denivele'` de `recordKindsOf` et des deux unions locales partent. Une donnée retenue devenue inconnue retombe sur le défaut par `isStatsMetricKey`.
- `LAND_FILES` perd `StatsLevelPanel` et `statsLevel`.

**5. Direct et enregistrement**
- `hooks/useLiveRecording.ts` : `liveEnergySetup` et l'option `energy` partent.
- `recording/liveStats.ts` : partent `LiveEnergySetup`, `energy`, `powerWindowS`, `segmentEnergy`, `trailingMeanPower`, `gradesUpToNow` et le calcul des pentes ; `currentGrade`, `recentPowerW`, `effortJ` restent à `null`, `energyPerKg` à `false`, commentaire « retiré, lot 305 » (`liveFields.ts` les lit encore) ; D+, D− et vitesse ascensionnelle restent.
- `hooks/useRecorder.ts` : `withMeasuredCadence` et `PendingSession.motionBytes` partent (« Analyser » relit la capture) ; « sauts et cadence » devient « sauts ».
- `recording/gpxWriter.ts` : l'extension `gpxtpx:cad` part ; `LocationFix.cadenceSpm` aussi si plus rien ne l'écrit.
- `pages/RecordingPage.tsx` : `cadenceSetting`, `cadencePicked`, `measureCadence`, la case « Mesurer la cadence », le mot « cadence » du résumé des capteurs, la branche « cadence seule » (l. ~811) partent.
- `platform/motion.ts` : `cadence` sort de `MotionSetup`, de `start`, de `status` et de sa lecture ; la capture des sauts, du pumping et des virages reste (`jumps`, `placement`, `foil`). Lectures gardées pour les vieux fichiers : `setup.cadence` dans `core/imuFile.ts`, branche « cadence seule » de `hooks/useSessionJumps.ts`.
- `MotionPlugin.java` : champ `cadence`, paramètre (l. 138), argument et `setup.put("cadence")` de `header`, `ret.put("cadence")` partent. Le greffon reste ; `MainActivity.java` intact.

**6. Résumé et fiche**
- `library/summary.ts` : la substitution de l'altitude du terrain (l. 191-192) part, ainsi que `summaryBests` et `summaryTops` entiers (seuls lecteurs partis). `SummaryOptions.terrainElevation` et `.cyclingPower` restent dans le type, ignorés.
- `library/summaryOptions.ts` garde sa branche vélo et `summaryOptionsKey` tels quels (empreinte des fiches vélo inchangée : aucune refaite). Seule la ligne `powerRiderKg` d'`isSummaryOutdated` part (sinon une fiche vélo serait recalculée sans fin).

**7. Réglages et planification**
- `planning/duration.ts` : l'estimation vélo part (`CyclingDurationSettings`, `cyclingSpeedOnGradeMs`, `cyclingRideSpeedMs`, `cyclingDurationS`, `LEVEL_CLIMB_POWER_WKG`, `climbPowerWkgForFlatSpeed`) ; `DurationSettings` ne couvre plus que la course ; `LEVEL_FLAT_SPEED_MS`, `CUSTOM_FLAT_SPEED_BOUNDS_MS`, `PlanningFamily` restent. `LAND_FILES` perd `planning/duration`.
- `settings/activitySettings.ts` : `durationSettingsOf` rend `null` à vélo ; partent `REFERENCE_RIDER_KG`, `cyclingEnergyParams`, `BIKE_TYPES` (remplacé par `BIKE_DEFAULT_KG`), `resolveEnergyModel`, `defaultEnergyModelOf`, `resolveCadence` ; sortent de `SportSettingsView`, `SETTING_FIELDS`, `isActivityOverridden` : `energyModel`, `isEnergyModelOverridden`, `carriedLoad`, `bikeWeight`, `cadence`, `gradeRange`, `terrainStepM` ; restent `resolveBikeType`, `resolveBikeKg`, `defaultBikeKg`, `resolveGradeRange`, `resolveTerrainStepM`, niveau, voies, boucle, `bikeType` dans la vue, listes de clés de `resetOverrides`.
- `hooks/useSportSettings.ts` : `effectiveEnergyModel`, `effectiveCadence` partent ; le retour du module perd `terrainStepM`, `gradeRange`, `bikeType`, `bikeWeightKg`, `carriedLoadKg`, `energyModel`, `hrZoneLines`, `setHrZoneLines` ; restent `effectiveGradeRange` (lu par `FollowedElevation` et la planification), `effectiveBikeSetup` (lu par `hooks/sessionLibrary/summarySettings.ts`), `effectiveDurationSettings`.
- `pages/SettingsPage.tsx` : partent les bornes de pente (l. ~423-428, ~530-546), « Dépense » (595-603), la charge portée (605-613), le pas de l'altitude IGN (624-634), la case cadence (703-712), `BikeSettings` (1212-1245) et son appel, « cadence » et le nom du vélo dans le résumé de carte (451-452), « Économie de course » (969 ; le champ reste dans `RunnerProfile`), le W/kg de `PaceSettings` ; « Vélo et planification » devient « Planification » ; voies, niveau et boucle restent jusqu'au 304.

**8. Fin de la couture**
- Supprimer `running/`, `cycling/`, `land/` entiers, tests compris.
- `architecture.test.ts` : `LAND_FILES = []`, `SEAM = []` ; le garde-fou `toContain('library/summary → land/grade')` devient `expect(names).toEqual([])` ; `land`, `running`, `cycling` sortent de `DOMAINS` et d'`ALLOWED` ; les trois `EXCEPTIONS` `*energy* → planning/surface` partent.
- `node outils/styles-en-ligne.mjs --figer`. Le grep du brief revient vide, commentaires compris. Puis `npm run verif`.
- Gardés (voile, surf, planification, enregistrement les lisent) : `TrackChart`, `gradeGradientDefs`, `ElevationProfileMini`, `routeProfileChart`, `FollowedElevation`, `GradeLegendRow`, `SurfaceBar(.css)`, `SurfaceHighlight`, `SurfaceLayer`, `WayTypeTabs`, `HeartRatePanel`, `HeartRateChart`, `ZoomableChart`, `SpeedRangeEditor`, `TopsPanel`, `JumpsPanel`, `useExclusiveToggles`. Sans changement : `icons.tsx`, `familyIcons.ts`, `activityArt.tsx`, `IconPicker` (décision 4).

**Tests**
- Partent avec leur code : tout `running/`, `cycling/`, `land/` (`energyFrozen` compris) ; `library/statsLevel.test.ts`, `library/summaryBests.test.ts` ; dans `recording/liveStats.test.ts` le bloc « puissance et énergie » et les cas de pente ; les cas vélo de `planning/duration.test.ts` et les cas cadence de `gpxWriter.test.ts` ; les cas énergie, charge, vélo et pente de `settings/activitySettings.test.ts` (imports vers `core/retiredLand` et `planning/grade`) ; bests et tops de `library/summary.test.ts` ; `heartRateDrift`/`efficiencyBlocks` de `core/heartRate.test.ts`.
- `library/record.test.ts` : imports vers `core/retiredLand`, `SessionTerrainElevation` devient un objet littéral.
- `core/trackPaths.test.ts`, second cas : comparer `pathsWhere` à une copie gelée, sur `sailTrack(...)` de `test/sailing.fixture.ts`, prédicat sur la vitesse.
- Tests de pente → `planning/grade.test.ts`, repris de `running/runningAnalytics.test.ts`, sans les zones.
- Un test qui prend « running » pour un calcul gardé reste tel quel (fiche 154, point 7). Les gardes du 187 (`summaryFrozen`, `useSportSettings.guard`, `settingsImport.guard`) ne sont pas touchées.

**9. Banc (`outils/banc/`)**
- Retirer du registre et supprimer : `altitude`, `cadence`, `charge`, `depense`, `pentes`, `roulement`, `library3`, `marche`, `trace-suivie` ; hors registre, supprimer `cadence-diagnostic`, `distance-diagnostic`. Garder `allure-session`, `energie-fc-diagnostic`.
- Adapter `graphes` (parties surf et voile) et `carte-direct` (activité de voile à la place de la course).
- Jeu comparé : `general`, `cardio`, `sauts` (partie 6 « à pied et VTT »), `profil` (import par `/voile`, sport préféré) perdent leurs étapes course et vélo ; écarts attendus : ces étapes, plus `profil`.
- Autres scripts étiquetés course ou vélo (`activite`, `aides`, `barre`, `cacher`, `carte-perf`, `carte-reveil`, `classer`, `coquille`, `donnees`, `fluidite`, `import-fit`, `fichier-recu`, `imports`, `materiel`, `materiel-fin`, `notes`, `onglets`, `prereglages`, `recherche-sans-reponse`, `satellite`, `surface`, `survol`, `vignettes`, `vides`, `zoom-carte`) : ceux que le passage met en échec prennent `manuel: 'course et vélo retirés (303), à revoir'` et une ligne dans `SCRIPTS.md`.
- Essai au téléphone à ajouter (greffon natif changé) : une capture des sauts en wing.
