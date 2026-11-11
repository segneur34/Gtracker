# 321 · Plan d'exécution de la porte d'import (agent Plan, Opus, 11/11/2026)

Le brief reste la section « Lot 321 · Porte d'import bornée, formats de session neufs » de `docs/backlog/319-revue-apres-fork.md` ; ce fichier le complète (ordre, pièges vus dans le code, questions tranchées). Les `chemin:ligne` ont été revérifiés sur le commit `4ca17a6` (code identique à `ddc7b57`). Le lot ne démarre qu'une fois le 320 commité.

## Questions tranchées

Par l'utilisateur le 11/11 (« défaut partout ») : porte par fichiers seulement ; session de course, de vélo ou d'entraînement refusée avec un message ; capteurs repris ; itinéraires et réglages de l'ancienne application coupés ; préfixe `gtracker`.

Par l'orchestrateur le 11/11, dans l'esprit de ces réponses (dites à l'utilisateur dans le compte rendu) :
- **Fiche de l'ancienne application d'une version plus récente, ou illisible** : on ne range que le GPX ; le rapport d'import le dit en une ligne ; nom, notes et repères de cette session ne sont pas repris. Réservé aux fiches à l'ancien format (`legacy`). Pourquoi : ranger la fiche telle quelle ferait entrer l'ancien nom dans la mémoire et la mettrait en lecture seule, ce que la coupure refuse.
- **`.imu` à l'ancien format qu'on ne sait pas convertir** (version supérieure à 1, en-tête cassé) : session rangée sans capteurs, comptée dans `motionFailed`. Pourquoi : des capteurs rangés illisibles ne servent à rien.
- Mineures : une seule liste des sports retirés, dans `naming.ts`, exposée par `isOtherSportType` et utilisée par `legacyImport` ; FIT : un `kind: 'other-sport'` neuf, compté dans `otherSports`, plutôt que `'refused'` ; phrase du rapport : « N sessions de course, de vélo ou d'entraînement laissées de côté : Gtracker ne range que la voile et le surf. », prise en compte dans `nothingElse` ; test du refus du dossier dans `useSessionLibrary.perte.test.ts`.

## 1. Fichiers, dans l'ordre

1. `src/core/appIdentity.ts` (neuf) et `appIdentity.test.ts` : la table du brief §1. Les gabarits s'écrivent `` `${APP_SLUG}-session` as const `` (P5).
2. `src/core/imuFile.ts` : `:36-37` `IMU_FORMAT` ← `FILE_FORMATS.capteurs`. La découpe faite deux fois (`:186-192` et `:274-277`) devient une seule fonction exportée, `splitImu(bytes): { headerText: string; body: Uint8Array } | null`. `setup.cadence` est retiré (`:69-71`, `:179`).
3. `src/library/record.ts` : `:45` `RECORD_FORMAT` ← `FILE_FORMATS.session`. On exporte un lecteur qui prend un objet déjà lu : `parseRecordValue(raw: unknown, formats: readonly string[] = [RECORD_FORMAT]): ParsedRecord | null` (`:761-765`, `:770-771`). `parseRecordWithRaw` l'appelle et ne change pas.
4. `src/library/legacyImport.ts` (neuf) : brief §2, avec `parseImportedRecord(text): { parsed: ParsedRecord | null; legacy: boolean; otherSport: string | null }` et `upgradeImportedImu(bytes): Uint8Array`, qui ne touche pas un fichier qui n'est pas à l'ancien format.
5. `src/library/sessionBundle.ts:15`, `:20-22`, `:132-136`, `:148-150`, `:163-181` (brief §4). `UnbundledGpx` (`:26-46`) gagne `otherSport`.
6. `src/library/importEntry.ts:25-43` : `parseImportedRecord`. `ImportRecordChoice` gagne `otherSport`.
7. `src/library/importReport.ts:8-41` (`otherSports`, phrase du rapport), puis `src/hooks/sessionLibrary/importer.ts` : `:138` littéral du rapport, après `:171` le refus, `:178` passage des capteurs par `upgradeImportedImu`, `:100-111` statut `other-sport`, `:204-206` FIT. Enfin `src/hooks/sessionLibrary/incoming.ts:45-54` (P8).
8. Refus d'un sport retiré (brief §7) : `src/library/naming.ts:46-92`, `src/library/summaryOptions.ts:156-189`, `src/hooks/sessionLibrary/addSession.ts:54`, `:119-133`, `src/library/fitToGpx.ts:76-82`, `:107-110`.
9. Marqueur et refus du dossier (brief §6) : `src/library/folderLayout.ts:7`, `:24`, `:32`, `:74` ; `src/platform/memoryFolder.ts:245`, `:257`, `:260`, qui importe `MARKER_FILE` depuis **`core/appIdentity`** (`platform` n'a pas le droit d'importer `library`, `src/architecture.test.ts:49`) ; `src/hooks/sessionLibrary/lifecycle.ts:36-57`, `:209-217`.
10. Java : `MotionPlugin.java:373` et `ImuReference.java:28`, `:31`, puis `node outils/imu-reference.mjs`, qui refait `src/core/imuFile.reference.imu` (JDK 21 par `JAVA_HOME`).
11. Tests du brief §9 et §7, puis `outils/banc/imports.mjs:70`, `:180`, `outils/banc/miseajour.mjs:145` et `outils/docs-cites.mjs:34` (P9).

## 2. À réutiliser

- `createFakeFolder` (`src/test/memoryFolder.fixture.ts`) : son `writeBytes` ne fait rien ; pour voir le `.imu` écrit, passer un remplaçant par `overrides`.
- Le patron de `useSessionLibrary.perte.test.ts:119-131` (`chosen`, `chooseMemoryFolder`, `forgetChosenFolder` simulés) pour le refus du dossier.
- Côté produit : `FolderRefusedError` et le chemin déjà en place `reconnectFolder` `:262-268` pour revenir à la mémoire du navigateur ; `recordToKeep` ; `isWritableRecord` ; `guessSport` ; `encodeImu` et `decodeImu` pour les tests du `.imu`.

## 3. Étapes (chacune finit sur `node outils/verif.mjs --rapide` vert)

- **E1** : fichiers 1 à 4. Les formats ne changent pas encore (l'ancien et le neuf sont égaux). Tests unitaires de `legacyImport` : champs retirés, sport d'une autre famille repéré, en-tête `.imu` récrit avec le même corps. Preuve : `appIdentity.test`, `imuFile.test`, test du 320 vert.
- **E2** : bascule des formats, fichiers 5 et 6, `importer.ts:178`, puis Java et la référence refaite. `OLD_BUNDLE` (`sessionBundle.test.ts:103-105`) et la fiche de septembre (`compat.fiche.test.ts:83-101`) déménagent dans `legacyImport.test.ts`. Preuve : `legacyImport` (a), (b) complété, (d) ; `sessionBundle`, `compat.*`, `imuFile.reference` ; `gradlew.bat testDebugUnitTest`.
- **E3** : marqueur et refus du dossier (fichier 9). Preuve : `memoryFolder.test`, `perte.test`, `reconcile.test`, et un test neuf : dossier `picked` portant `tracker.json` sans `gtracker.json` → refusé, rien d'écrit dedans.
- **E4** : refus d'un sport retiré (fichiers 7 et 8). Preuve : (c), `addSession.test:162-168`, `naming.test:31-35`, `fitToGpx.test:69`, `:145-170`, `importReport.test`, `incoming.test`, `balayage.test:91`.
- **E5** : banc et outils, recherche de contrôle (P1). `npm run verif` et le banc sont lancés par l'orchestrateur.

## 4. Ce qui doit rester identique

- `summaryFrozen.test.ts:63` compare à l'octet le `JSON.stringify` de toute la sortie de `summarizeGpx` : le champ neuf d'`AnalyzedGpx` ne paraît que lorsqu'il est vrai (`...(x ? { otherSport: true } : {})`), jamais comme `false`. Constat : fichier non touché (`git diff --stat`) et test vert.
- `legacyImport.test.ts` (320) ne change pas dans les cas qu'il a déjà ; on y ajoute seulement (b) complété, (c) et (d).
- `RECORD_VERSION` vaut 1 et `SUMMARY_CALC_VERSION` 18.

## 5. Pièges vus dans le code

- **P1** · La recherche de contrôle du brief ne peut pas rendre zéro : `gtracker-session` contient `tracker-session`, `gtracker:` contient `tracker:`. Écrire `rg -n "\btracker-session|\btracker-capteurs|Tracker/session|\btracker:"`. Elle trouvera encore `planning/routeGpx.ts:22-23` (`tracker:itineraire`) et `recording/gpxWriter.test.ts:29`, qui relèvent du lot 322 : les exclure nommément.
- **P2** · Même cause, effet silencieux : les remplacements faits dans les tests (`sessionBundle.test.ts:94`, `useSessionLibrary.perte.test.ts:656`, `compat.formats.test.ts:103` `xmlns:tracker=`) ne trouveront plus rien sur le bloc neuf et rendront le texte tel quel. Les construire depuis `XML.session.prefix`.
- **P3** · `readRecordParts` remet à `null` tout sport inconnu (`record.ts:783`). `parseImportedRecord` lit donc `raw.sport` **avant** cette lecture, et retire les champs de l'ancienne application sur l'objet brut, avant `unreadableFields`. `format` n'est pas un champ gardé (`:702-703`) : l'ancien nom n'est pas réécrit.
- **P4** · L'ancienne application écrit son identifiant de sport dans `<type>` (`git show 2eed9e7:src/core/types.ts`). `run-intervals`, `bike-intervals`, `run-test` et `muscu`, une fois normalisés, ne figurent pas dans `FOREIGN_TYPES` : sans ajout, ces GPX resteraient « à classer » au lieu d'être refusés.
- **P5** · `ImuHeader.format: typeof IMU_FORMAT` (`imuFile.ts:59`), `SessionRecord.format` (`record.ts:357`) et `imuFile.test.ts:143` ont besoin du type littéral : sans `as const`, un gabarit est typé `string`.
- **P6** · Ne refuser un GPX par son `<type>` que s'il **n'a pas de fiche** (`!from`, à `addSession.ts:122`) et si la source est `'import'`. `from?.sport ?? undefined` (`:125`) change `null` en `undefined` : sans cette garde, la recopie de la mémoire du navigateur (`lifecycle.ts:241`) refuserait une session « à classer ».
- **P7** · Refus du dossier : le faire **avant** `flushWrites` et `takeUnwritten` dans `chooseFolder` (`:217-221`), puis appeler `forgetChosenFolder`, car `chooseMemoryFolder` a déjà gardé le choix (`memoryFolder.ts:418`, `:524`). Ne pas refuser la mémoire du navigateur : OPFS de développement et banc (`miseajour.mjs:145`) portent `tracker.json`. Le dossier `Documents/Gtracker` de la 0.00.05 sera refusé : il doit être effacé avant la 0.00.06.
- **P8** · `incomingVerdict` (`incoming.ts:54`) rend `retry` à défaut : un GPX de course reçu d'une autre application garderait sa copie indéfiniment. Il faut une branche « refusé ».
- **P9** · `docs/ETAT_DU_PROJET.md` cite `` `tracker.json` `` : retirer ce nom de `docs-cites.mjs:34` ferait échouer `npm run verif`. Ajouter `gtracker.json` et garder l'ancien jusqu'à la passe de documentation.
- **P10** · Le fichier `.imu` rangé change d'en-tête : la longueur se compte en octets UTF-8 (accents de `device`), et le Java a écrit `\/`. Le test du 320 doit comparer le corps des mesures (via `splitImu`). S'il compare le fichier entier, le dire à l'orchestrateur ; ne pas le retoucher en silence.
- **P11** · FIT : le refus vaut pour la course **et** le vélo (`FIT_SPORT_NAMES` 2 et 21). Avec le `kind: 'refused'` existant, chaque fichier serait nommé dans `failed`, ce que le brief interdit (Pièges, montre prêtée) : d'où le `kind` neuf.

## 6. Hors lot (ne pas entamer)

- **306** : `ANALYSIS_FIELDS` (B11), commentaires de la porte (B14), `readSummaryCadence` et `readSummaryBests`, plomberie des réglages.
- **322** : `HANDLE_DB` et `:517` `'tracker-memoire'` (base IndexedDB, à ne pas confondre avec `MEMORY_FORMAT`), `DEVICE_FOLDER_KEY` `:333`, `routeGpx.ts:21-23`, « Tracker » dans les messages (`recordText.ts:8`, `:12`, titre de `LISEZMOI`), `creator="Tracker"` (`sessionBundle.test.ts:9`), `trackerEntry()`, commentaires de `incoming.ts`, `incomingFile.ts` et `IncomingFileNotice.tsx`.
- **323** : paquet Java `io.github.segneur.tracker` et identifiant Android.
- **330** : reste de `banc/imports.mjs`.
