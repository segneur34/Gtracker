# 306 · Plan d'exécution de la coupure des relectures d'anciennes données (agent Plan, Opus, 11/11/2026)

Le brief reste la section « Lot 306 (réécrit) · Coupure des relectures d'anciennes données » de `docs/backlog/319-revue-apres-fork.md` (blocs B1 à B16) ; ce fichier le complète. Les lignes ont été relevées le 11/11 sur l'arbre qui porte les lots 321 et 325 (f, a, d, i), commités depuis (`f0ed780`) : les revérifier en cherchant le texte.

## Questions tranchées

Par l'utilisateur le 11/11 : coupure complète des anciennes données, réglages et itinéraires de l'ancienne application non repris ; la seule version installée (0.00.05) est jetable : **aucune migration à garder ni à écrire** (réglages, fiches, adresses de pages).

Par l'orchestrateur le 11/11 (mineures, réponses de l'architecte retenues) :
- (a) La phrase de `CLAUDE.md` sur `PRESET_RESETS` est déjà retirée par l'orchestrateur : ne pas toucher à `CLAUDE.md`.
- (b) `SettingsFile.device: null` : gardé (`readDevice` le rend aussi pour un appareil abîmé).
- (c) `restingHrStore` : un résultat sans `version` devient « mal formé » (`null`), plutôt que d'être lu en version 1.
- (d) Garde G5 : quelques lignes dans `src/architecture.test.ts`, qui vérifient qu'`App.tsx` n'a plus de route course, vélo ou fractionné et a une route `*`. Pas de nouveau fichier.
- (e) Défaut O3 (`summaryOptions.ts:112-114`) : rien à coder, il tombe avec la porte.
- (f) `perte.test.ts:749` (`reglages.json` dans un dossier en lecture seule) : retirer la ligne, devenue inerte.
- B16 (ceinture active) : dans son étape à part, E6 ; la ceinture sera à choisir de nouveau, ce qui ne touche que la version jetable et le navigateur de développement.
- Ce que l'utilisateur verra : une adresse inconnue mène à l'accueil au lieu d'une page vide ; la phrase « à classer » ne cite plus que la voile et le surf.

## 1. Fichiers, dans l'ordre de passage

1. `src/main.tsx` (B1 + B8) : retirer `:1` `plainError` (inutilisé ensuite), `:16` `reportStartupError` et `settingsUpgraded` de l'import, `:19` les deux `upgradeStored*`, `:20`, le bloc `:46-65` et le message `:74-77`.
2. `src/hooks/useOpenSections.ts:31-45` (B8).
3. `src/hooks/useSportSettings.ts` (B2) : imports `:3-4` et `:24-25` ; `:84-98` ; `:123-129` ; `:142-175` ; doc `:235` ; `readHiddenFamilies` aux lignes `:254`, `:398`, `:417`, `:471` ; `activitiesVersion` aux lignes `:351`, `:364`, `:384` ; `legacySport` `:503-506` ; commentaire `:324-325`.
4. `src/settings/activitySettings.ts` (B3) : `:2` et `:5` ; `:121-122` ; `:129-137` ; `:165-171` ; `:194-196` ; `:293-305` ; `:311` ; `:313-369` ; `:738`. Plus `activityPresets.ts:68-69` et le commentaire `core/sportProfiles.ts:686-690` (il cite `FULL_APP_FAMILY_IDS`).
5. `src/core/activities.ts` (B4) : `:98-118`, `:131-137`, `:238-291`. `foldName` (`:234-236`) devient inutile et part aussi.
6. `hooks/sessionLibrary/deviceSettings.ts` (B5) : `:1`, `:3`, `:189-201`, `:246-260`, `:265`, `:273`, `:280-283`, `:291`. Puis `useSessionLibrary.ts:47` (réexport) et `:16` (commentaire sur `reglages.json`).
7. `library/settingsFile.ts` : `:20-22`, `:265-275` (B5) et `:216-223` (B6). `library/folderLayout.ts:13-14`, `:28-29`. `library/reconcile.ts:2`, `:108-111`.
8. B7 : `hooks/sessionLibrary/summarySettings.ts:134-140` ; `library/newRecord.ts:19-20`, `:52` (devient `notes: null`), commentaire `:59` ; `library/record.ts:980-997`.
9. B9 : `src/App.tsx` `:2` (`useLocation`), `:80-84`, `:110-119` ; route `*` en dernier dans `AppShell`, après `:133`. Commentaires `core/parentPage.ts:6`, `:12-13`. `outils/banc/passe.mjs:33`.
10. B13 : `library/athleteProfile.ts:58-59`, `:78`, `:84`, `:163-165`, `:181`. `core/heartRate.ts:108-109`, `:161-163`, `:169-178` (le paramètre `model` d'`enteredThresholds` devient inutile : le retirer, appel compris). `hooks/useRunnerProfile.ts:86`. `library/restingHrStore.ts:35`.
11. B10 + B11 : `library/record.ts` :
    - `:15-28`, `:66`, `:76-81`, `:106-111` (`SUMMARY_CALC_VERSION` reste à 18) ;
    - `:158-171`, `:208-219`, `:241`, `:243-249` ;
    - `:298-303`, `:320-331`, `:388-393` (commentaire), `:401-406`, `:414-418`, `:422-451`, `:492-501`, `:566`, `:595`, `:599-614` ;
    - `:700-706`, `:782`, `:895-899`, `:910`, `:912`, `:941`, `:1005-1008`, `:1017-1026` (passe à 1), `:1106-1107`, `:1188`.
    Ensuite `library/libraryCache.ts:14-25`, `:43` ; `library/sessionEdits.ts:19-21`, `:82`, `:86`, `:113` ; `hooks/useSessionDraft.ts:24` (commentaire) ; `hooks/useVisibleStatSessions.ts:16-17`.
12. B14 :
    - `core/types.ts:12-15`, `library/fitToGpx.ts:46` (la ligne `:16` est juste), `hooks/sessionLibrary/importer.ts:248`, `components/ImportButtons.tsx:10`, `platform/memoryFolder.ts:486` (`:459` dit déjà Gtracker) ;
    - phrase visible `pages/SessionLibrary.tsx:690` ;
    - hors brief, mais la recherche de contrôle les trouve : `recording/liveFields.ts:14` et `core/activityIcons.ts:8` (« application complète ») : on garde le code, on réécrit le commentaire.
13. Banc :
    - `reglages.mjs:31-32`, `:89`, `:108`, `:130`, `:170-178` ; `prereglages.mjs:5`, `:60`, `:79`, `:279-303` ; `allure-session.mjs:76-81`, `:112-115` ;
    - hors brief : `onglets.mjs:261-269`. La vérification « anciens onglets retenus effacés au démarrage » échouerait : la retirer, garder « général seul / avancé fermé ».
    - Les trois lignes de `SCRIPTS.md` (`:19`, `:68`, `:229`), que la recherche de contrôle sur `outils/banc` trouve.
14. B16, à part, en dernier : `platform/heartRate.ts:145-196`, `platform/beltList.ts:6`, `:25-41`, et leurs tests.
15. Documents, **obligatoires dans chaque étape** (même `--rapide` lance `docs-cites` et `docs-inventaire`) : retouches minimales des renvois cassés, pas la passe de documentation, sans récit du lot.
    - `docs/ETAT_DU_PROJET.md:201`, `:212`, `:237-241`, `:246`, `:279`, `:282`, `:287`, `:289`, `:298` ;
    - `docs/INVENTAIRE.md:33`, `:116`, `:130-131`, `:166`, `:198`, `:204`, `:234-235`, `:317` ;
    - `docs/BACKLOG.md:18`, `:34` : **à l'orchestrateur**, lui rendre le texte à changer.

## 2. Étapes (chacune finit verte sur `node outils/verif.mjs --rapide`)

- **E1, réglages et démarrage** (fichiers 1 à 5, B6 en plus, banc réglages, documents). Preuves : `useSportSettings.test`, `useSportSettings.store.test`, `activitySettings.test` réécrit, `activities.test`, `activityPresets.test`, `settingsFile.test`, `couches.test`.
- **E2, ancien `reglages.json`** (fichiers 6 et 7). Preuves : `settingsFile.test`, `reconcile.test`, `useSessionLibrary.memoire.test` et `perte.test`.
- **E3, notes, onglets, adresses, profil** (fichiers 8 à 10, `passe.mjs`, `onglets.mjs`). Preuves : `newRecord.test`, `parentPage.test:43-44`, `heartRate.test`, `athleteProfile.test`, `restingHrStore.test`.
- **E4, fiche et cache** (fichier 11). Preuves : `record.test`, `sessionEdits.test`, `libraryCache.test`, `perte.test`, `compat.fiche.test`, `summaryFrozen.test` et `legacyImport.test` verts.
- **E5, B14, nettoyage et contrôle** : recherche de contrôle à zéro.
- **E6, B16, ceinture.** Preuves : `beltList.test`, `heartRate.test`.

Le lot se coupe en trois commits : **A** = E1 à E3 (réglages, démarrage, adresses, profil), **B** = E4 et E5 (fiche, cache, porte), **C** = E6. Chaque étape reste verte seule.

## 3. Ce qui doit rester identique

- **`summaryFrozen.test.ts`** : ni lui ni `summary.ts`/`summarizeGpx.ts` ne sont touchés (`git diff --stat`). Le type `SessionSummary` change, la sortie du calcul non.
- **`SUMMARY_CALC_VERSION`** reste 18 ; `RECORD_VERSION` reste 1 ; `RECORD_READER_VERSION` passe à 1.
- **`legacyImport.test.ts`** (étape E4) : `readAnalysis` ne réécrit plus les trois champs à `null` ; `withoutOriginFields` continue de les retirer à l'entrée ; le jeu `test/legacyImport.fixture.ts` n'est pas touché. Changent :
  1. `:139-148` : la réécriture redevient égale **à l'octet** au jeu, format changé et sans les trois lignes `"effortThresholdMs"`, `"bikeWeightKg"`, `"loadKg": null`. L'ordre des clés est gardé : le commentaire « reviennent nuls en fin d'objet » tombe. Si l'octet n'est pas obtenu, le dire à l'orchestrateur sans retoucher le jeu.
  2. `:153-156` : l'objet attendu perd les trois champs.
  3. `:373-374` : devient `not.toHaveProperty` pour les trois, comme `:372`.
  4. Ajout, dans (b) `:514-529`, du cas renvoyé par le brief du 320 : l'analyse de `diskRecord(...)` n'a aucun des trois champs, que la session vienne du paquet ou des fichiers posés à côté.
  Le reste ne change pas, (c), (d) et la fiche de septembre compris.

## 4. Tests et jeux d'essai

**Partent :**
- fichiers entiers : `hooks/useSportSettings.guard.test.ts`, `test/settings0461.fixture.ts`, `library/settingsImport.guard.test.ts`, `library/compat.reglages.test.ts` ;
- `compat.fiche.test.ts:109-143` (bloc f) ;
- `activities.test.ts:56-89`, `:178-209`, `:236-239` ; `activitySettings.test.ts:36-133`, `:304-308` ; `settingsFile.test.ts:81-98` ;
- `resumes.test.ts:280-305` (tout le cas) ; `perte.test.ts:729-739` ; `libraryCache.test.ts:23-26` ;
- `heartRate.test.ts:108-111` (branche `hrZones`) ;
- les cas `legacyNotes` de `newRecord.test` ; `record.test.ts:475-485` ; `couches.test.ts:31` (`'settingsUpgraded'`) ;
- `familyRecords()` `course`, `velo`, `fractionne` (`record.fixture.ts:111-141`) ;
- les blocs de la terre de `record.test` (titres aux lignes `:83`, `:116`, `:195`, `:220`, `:292`, `:408`, `:601`, `:643`, `:1058`, `:1073` ; objets `SessionAnalysis` à `:191`, `:250-254`, `:538`, `:828`, `:1005`).

**À réécrire, car le comportement est vivant :**
- dans `compat.reglages`, les cas (a), (b), (c) et BOM/CRLF passent dans `settingsFile.test.ts`, « deux écritures de suite » passe dans `useSportSettings.store.test.ts` ;
- `activitySettings.test.ts:136-149` : familles cachées filtrées à voile et surf ;
- `useVisibleStatSessions.test.ts:59-70` : devient « session à classer » (`sport: null`, activité `moth`) ;
- `reconcile.test.ts:77-85` : sans `reglages.*` ; une `reglages.json` à la racine n'est plus écartée ;
- `settingsFile.test.ts:51-55` (nouveau titre), `:109-116`, `:230-252` ;
- `summary.test.ts:31-33` : passe en `not.toHaveProperty`, sinon `tsc` échoue ;
- `storage.test.ts:108-109` : clé neutre à la place de `sailingNotes` ;
- `athleteProfile.test.ts:67-72`, `oldReadAnalysis` et `old*` de `sessionEdits.test` sans les trois champs ;
- `record.test.ts` `:969-1010` sur voile et surf ; `sessionBundle.test.ts:194` sur `.voile`.

**Gardés :** `gpxParser.legacy.ts`, `parentPage.test`, le cas générique `sport: 'moth'`.

## 5. Risques et pièges vus dans le code

- **Premier lancement** : `readStoredSettings` doit garder son cache (`storedCache`, `:91-100`) et rendre une constante quand rien n'est rangé. Avec un `?? {}` neuf à chaque appel, `useSyncExternalStore` boucle sur une installation neuve. Le reste du premier lancement ne change pas : `activities` absent donnait déjà les activités de départ.
- **`hiddenFamilies` en `SportFamily[]`** : il faut encore un filtre à la lecture (valeur brute). Le nommer `hiddenFamiliesOf(stored): SportFamily[]`, puisque `readHiddenFamilies` est dans la recherche de contrôle.
- **Données de Gtracker qui changent de lecture** : les fiches au format neuf portent les trois champs à `null` dans `analysis` : ils deviennent des clés inconnues, gardées telles quelles, sans perte ni champ illisible ; les caches sont ignorés une fois et refaits (l'empreinte `RECORD_LIGHT_FIELDS_KEY` change, le lecteur passe de 2 à 1) ; aucune session « à classer » n'est touchée (version de calcul 18) ; seul B16 change le rangement d'une clé que Gtracker écrit lui-même (`tracker.heartRateBelt`).
- **Navigateur de développement** : il garde `activitiesVersion: 9`, `presetsVersion: 5`, `sport`, `referenceSpeeds`, d'anciens onglets et `tracker.sailingNotes`, désormais gardés tels quels. Une future « version » relue avec `?? 0` serait sautée : cela tombe au lot 322, qui renomme les clés sans relire les anciennes.
- **Banc** : il part de profils neufs, aucun risque hors des scripts du fichier 13.
- **Recherche de contrôle** : elle ne peut pas rendre zéro telle qu'écrite. Exclure les trois fichiers `legacyImport*` (`ORIGIN_ANALYSIS_FIELDS` doit rester) et les `hrZones` des zones calculées.
- **Compilateur** : `noUnusedParameters` est actif (`model` d'`enteredThresholds`, `foldName`, `readActivities` dans `activitySettings`).

## 6. Hors lot (ne pas entamer)

- **322** : `tracker.*`, `SETTINGS_FORMAT`, `TRAVELLING_KEYS`, `memoryFolder.ts:17`, `LISEZMOI`, libellés « Tracker », `activitySettings.ts:28`.
- **323** : Android.
- **304** (B12) : `surfaces`, `terrainElevation`, `elevationSource`, `route.ts` et `routeRecord.ts`, `useSportSettings.ts:305-315`, blocs `surfaces` et `terrain` de `record.test`.
- **325 restant** : `walkProfile.fixture`, `minkm`, « voile, course, vélo » de `record.ts:336`, `:407`, `summary.ts:105`.
- **326** : drapeaux. **330** : banc `/course`, reste de `SCRIPTS.md`, ajouts à `PRECHAUFFE`. **331** : passe de documentation (`CLAUDE.md`, `DECISIONS.md`).
