# 494 · Synchronisation et « Tout supprimer » : plan retenu

Plan de l'agent Plan du 23/11, confronté par l'orchestrateur. Brief : section 494 de `493-relecture-avant-vente.md`. Lignes citées : celles du commit `d13131e`.

Toute la synchronisation tourne dans le code web du programme Windows (`src/`) ; le téléphone ne fait que servir ses fichiers. Le lot ne touche ni `bureau/` ni `android/` et ne change pas le protocole. Programme neuf face à une APK ancienne : A-02, A-04 et A-08 marchent, et pour les champs sans date l'ordinateur gagne, comme aujourd'hui. Programme ancien face à une APK neuve : rien ne change, les champs inconnus sont gardés tels quels. A-01 n'est corrigé sur chaque appareil qu'une fois son application mise à jour.

## Partie AB (un agent) : A-01, A-04, A-02, A-08

A-01 :
- `src/library/resetPlan.ts` : sortir de `eraseAppFiles` la réécriture du marqueur (l. 304-305) et en faire `forgetSyncId(folder)`, exportée (même règle : `markerTextWithoutId` ; si l'écriture échoue, rien n'est effacé). `eraseAppFiles` n'efface plus que des fichiers.
- `src/hooks/sessionLibrary/reset.ts:eraseEverything` : flushWrites, stopSettingsWrites, `stopForReset()`, copie, puis `forgetSyncId` sur chaque dossier ; en cas d'échec : resumeSettingsWrites, openLibrary, `resetInterruptedText`, et on s'arrête. Ensuite seulement `suspendWrites()`, puis la boucle `eraseAppFiles`.

A-04 : `src/hooks/sessionLibrary/sync.ts:execute`, pour `writeRecord` avec `op.on === 'phone'` et pour `copyRecord` avec `op.to === 'phone'` : `await phone.list(SESSIONS_DIR)` une fois par session avant `expect` (même façon que `syncRouteFiles.ts` l. 303). Une fiche changée entre-temps lève `StaleError` : la session est sautée, dite « à refaire », fondue à la fois suivante. Les copies neuves (`writeNew`) ne relisent rien.

A-02 :
- `src/library/syncBase.ts` : `readMarkerPass` et `markerTextWithPass`, sur le modèle de `readMarkerSync` et `markerTextWithSync`, pour un champ neuf du marqueur (`passage`, un compteur, pas un instant : aucune dépendance aux horloges). Ne pas reprendre `synchro`, que `src/library/syncWatch.ts` surveille côté téléphone.
- La base gagne `phonePass: number | null`, vide dans `emptySyncBase` et `parseSyncBase`. Une base ancienne ne l'a pas : le contrôle ne joue pas pour elle (pas de fausse première rencontre après la mise à jour).
- `src/library/syncPlan.ts:syncPair` prend en plus le passage lu dans le marqueur du téléphone : si `base.phonePass !== null` et que ce passage est absent ou plus petit, la paire devient `first('olderCopy', true)` (identifiant neuf pour le téléphone, l'ancienne base gardée pour l'autre téléphone, aucune suppression, copie de sécurité). `'olderCopy'` s'ajoute à `SyncFirstReason`.
- `executeSync` (sync.ts), juste après les identifiants neufs (l. 402-410) et si `scope.phone` : écrire `passage = max(marqueur, base) + 1` dans le marqueur du téléphone, puis poser `base.phonePass`, que le prochain `saveBase` enregistre. Au début et non à la fin : sinon une ligne posée par un passage coupé échapperait au contrôle.
- Un passage où le téléphone est en lecture seule (enregistrement en cours) n'enregistre plus de lignes dans la base (`restrictSyncPlan`, l. 684).
- Même appel de `syncPair` dans `src/test/syncFolder.fixture.ts:runFixtureSync`. `phonePath` reste tel quel.
- `src/library/syncReport.ts` : une phrase pour `olderCopy`, près de la l. 540 ; elle dit qu'une copie plus ancienne du dossier a été reconnue, que rien n'a été supprimé et que des sessions supprimées depuis peuvent revenir.

A-08 : `src/library/syncExtras.ts` l. 155 : si `device === own`, l'ordinateur gagne ; sinon la copie au plus grand `savedAt` gagne (les deux datent de l'horloge du même appareil) ; à égalité, le téléphone, comme aujourd'hui. Aucun code côté APK.

Fichiers de AB : src/hooks/sessionLibrary/reset.ts, sync.ts, sync.test.ts ; src/library/resetPlan.ts, resetPlan.test.ts, syncBase.ts, syncBase.test.ts, syncPlan.ts, syncPlan.test.ts, syncReport.ts, syncReport.test.ts, syncExtras.ts, syncExtras.test.ts ; src/hooks/useSessionLibrary.reset.test.ts ; src/test/syncFolder.fixture.ts ; src/locales/en.json, es.json.

Tests de AB : `useSessionLibrary.reset.test.ts` (le faux dossier refuse les écritures suspendues : `writeText` et `writeBytes` lèvent si `writesSuspended()`, par les surcharges de `createFakeFolder` ; marqueur avec identifiant : plus rien de l'application, rechargement sur « / » ; « forgetSyncId échoue : rien n'est effacé ») ; `sync.test.ts` A-04 (`syncMemoryFolder({ phone: true, cable: true })`, fiche du téléphone changée dans `onPlanned` : session sautée, note gardée, fondue au passage suivant) ; `sync.test.ts` A-02 (copie ancienne remise, session neuve venue de cette copie, deux téléphones sur une même copie en alternance : `first === 'olderCopy'`, rien à la corbeille, la session revient, identifiant neuf ; base ancienne sans `phonePass` : suivie normalement) ; `syncExtras.test.ts` (le cas des deux téléphones rend `computer`) ; `syncReport.test.ts` (la phrase).

## Partie C (un agent neuf, après AB, dans la même copie) : la version écrite en dernier gagne

- La date. Seuls `notes.savedAt` et `analysis.savedAt` existent aujourd'hui (un par bloc). Nom, activité, lieu, repères n'ont aucune date ; l'heure du fichier ne convient pas (résumés refaits, lieu cherché et écritures de la synchronisation la changent).
- La fiche gagne `editedAt: Record<chemin, ms>` (`src/library/record.ts` : type, lecture, écriture), posé par une fonction pure de `src/library/recordMerge.ts`, appelée dans `src/hooks/sessionLibrary/sessionRecords.ts:patchSessionRecord` sur les chemins saisis changés (ceux de `SAISIE_LABEL` ; le lieu seulement quand sa source est `utilisateur`).
- `recordMerge.ts:addRecordEdits` ignore `editedAt` ; `mergeChangedRecord` y garde, chemin par chemin, la plus grande des deux valeurs.
- `src/library/syncRecordMerge.ts:mergeSyncRecords` prend l'option `nowMs`. Pour chaque chemin changé des deux côtés, la date d'un côté vaut `editedAt[chemin]` s'il diffère de celui de l'ancêtre ; sinon, pour `notes.*` et `analysis.*`, le `savedAt` du bloc s'il diffère de l'ancêtre ; sinon pas de date. Une date au-delà de `nowMs + FUTURE_SKEW_MS` (constante nommée, 5 min) ne compte pas. Deux dates qui existent et diffèrent : la plus récente gagne (retirer le chemin de `winnerEdits` avant la première fusion : la valeur du téléphone passe alors aux deux fiches). Dates absentes ou égales, ou pas d'ancêtre (première rencontre) : l'ordinateur gagne. Une APK ancienne ne pose pas `editedAt` : repli sur l'ordinateur. Le résultat dit, par chemin, qui a gagné ; l'en-tête du module (« Aucune date ne départage ») est réécrit.
- `syncPlan.ts` : `SyncInput.nowMs` (facultatif), passé l. 558 ; `SyncItem` porte qui a gagné. `sync.ts` passe `now()` aux deux `planSync` (l. 458, 462).
- `syncReport.ts` l. 411-414 : « la version écrite en dernier est gardée (celle de l'ordinateur quand on ne peut pas dater) ; une version plus ancienne a été remplacée ».
- La version perdante ne va pas à la corbeille : une session s'y reconnaît à son `startMs`, elle s'y afficherait à côté de la session vivante, « Restaurer » ne rendrait pas l'ancienne valeur (`trashRestore.ts:completeFromTrash`), et `trashedOf` et `withSyncDone` la compteraient parmi les suppressions. C'est le cas prévu par l'utilisateur (« si oui on garde pas »). Les itinéraires gardent leur règle actuelle.

Fichiers de C : src/library/record.ts, record.test.ts, recordMerge.ts, recordMerge.test.ts, syncRecordMerge.ts, syncRecordMerge.test.ts, syncPlan.ts, syncReport.ts, syncReport.test.ts ; src/hooks/sessionLibrary/sessionRecords.ts, sync.ts ; src/locales/en.json, es.json.

Tests de C : `syncRecordMerge.test.ts` (téléphone plus récent ; ordinateur plus récent ; date absente, égale ou dans le futur : l'ordinateur gagne ; APK ancienne ; notes datées par `savedAt` seul) ; `recordMerge.test.ts` (pose de `editedAt`, fonte au plus grand) ; `syncReport.test.ts`.

## Banc (un autre agent, après les commits)

`remise-a-zero.mjs` : poser un `id` dans le marqueur avant « Tout supprimer ». `exe-synchroniser.mjs` : contrôle du marqueur du cas c adapté (champ `passage`, qui change à chaque clic) ; deux cas neufs (copie ancienne remise : phrase dite, corbeille vide ; nom changé des deux côtés : le plus récent l'emporte), aussi en `--sansfil`.

## Questions tranchées par l'orchestrateur le 23/11

- Une copie ancienne remise devient une première rencontre : les sessions supprimées sur l'ordinateur depuis la copie reviennent, aucune n'est perdue, et le compte rendu le dit. C'est le résultat attendu de la fiche (« ne fait plus rien supprimer »).
- Compteur `passage` plutôt qu'un instant ; identifiant neuf pour le téléphone sur une copie ancienne ; pas de lignes de base enregistrées quand le téléphone est en lecture seule ; pas de dates à une première rencontre ; `FUTURE_SKEW_MS` de 5 min ; deux appareils sur un même dossier (Syncthing) comme aujourd'hui.

## Essais au téléphone

1. Synchroniser une fois, puis « Tout supprimer » sur le téléphone → tout part.
2. Renommer une même session sur le téléphone, puis quelques minutes plus tard sur l'ordinateur (et l'inverse sur une autre), puis Synchroniser → le nom saisi en dernier est gardé des deux côtés, et le compte rendu dit qu'une version plus ancienne a été remplacée.
