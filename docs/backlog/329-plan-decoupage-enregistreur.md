# 329 · Étape 3 : `useRecorder.ts` découpé en couches, sans changement de comportement

Brief : `docs/backlog/319-revue-apres-fork.md`, section « ## Lot 329 », lignes 1635 à 1683 (seule l'étape 3 reste). Ce plan, fait le 11/11 par l'agent `Plan` contre le code d'aujourd'hui, prime sur le brief.

## Modèle à recopier

Le découpage de `src/hooks/sessionLibrary/` : des couches, un état « en un objet unique » (`memory.ts`), et un garde-fou, `src/hooks/sessionLibrary/couches.test.ts`.

## Carte du fichier (1 422 lignes)

- l. 1-109 : imports, commentaire d'en-tête. l. 111-248 : types (`RecorderStatus`, `PendingSession`, `SavedSession`, `RecorderState`), `INITIAL_STATE`, `state` / `setState`, abonnés.
- l. 253-309 : état de session, dix-sept `let` de module (`fixes`, `segmentBreaks`, `stopSource`, `currentSource`, `currentProfile`, `lastReceived*`, `belowSinceMs`, `pendingBreak`, `manualBreakAutoPartMs`, `resumedSession`, `pauseFixes`, `startedAtMs`, `marks`, `heartRateMaxAgeS`, `dropBelt`, `sourceError`).
- l. 256-257, 299, 424-450 : tampon du journal (`pendingLines`, `lastFlushMs`, `writes`), écrit par onze fonctions.
- l. 317-414 : veilles du GPS et de la ceinture. l. 457-547 : réception des positions, `buildPendingSession`. l. 553-669 : rangement de la session en attente. l. 672-719 : sérialisation des commandes. l. 728-949 : récupération après coupure. l. 952-1001 : ceinture. l. 1004-1025 : `resetSession`. l. 1033-1344 : commandes publiques. l. 1347-1422 : lectures hors React et hooks.

## Découpage retenu : dossier `src/hooks/recorder/`

Chaque pièce n'importe que celles qui la précèdent ; `useRecorder.ts` reste le seul point d'entrée, aucun appelant ne change d'import.

1. `recorder/store.ts` : types, `INITIAL_STATE`, `state`, `setState`, `subscribe`, `fixListeners`, `pausePositionListeners`, `isBusy`, `SENSORS_PAUSE_ERROR`, `SENSORS_RESUME_ERROR`, `runCommand` / `exclusive` / `afterCurrent` / `running` (exposé par `isCommandRunning()`), et l'objet unique `session` (interface `LiveSession`) qui remplace les dix-sept `let`.
2. `recorder/journalBuffer.ts` : `pendingLines`, `lastFlushMs`, `writes`, `enqueueWrite`, `flushJournal`, et de petits accès (`queueJournalLines`, `resetJournalBuffer`, `dropJournalLines`, `journalFlushDue`).
3. `recorder/watches.ts` : `GPS_LOST_ERROR`, `BELT_LOST_ERROR`, veilles du GPS et de la ceinture, un objet `watch`, `startGpsWatchFor(profile)`, et la ceinture (`takeBelt`, `wireBelt`, `releaseRecordingBelt`, `stopRecordingBeltSearch`).
4. `recorder/live.ts` : `onSourceError`, `markManualResume`, `keepPoint`, `receiveFix`, `resetSession`, `sourceOptions`, `buildPendingSession`.
5. `recorder/recovery.ts` : `setJournalAside`, `journalSession`, `recoveryFactsOf`, `stopOrphans`, `abandonResume`, `restoreFromJournal`, `resumeSilently`, `resumeHoldingCommands`, `recovering`, `recoverOnce`, `recoverInterruptedRecording`.

`useRecorder.ts` garde (≈ 600 lignes) : l'en-tête, le rangement (`rangePendingSession` à `discardPendingSession`), toutes les commandes publiques, `continuePendingSession` compris, les avertissements, les lectures `getLive*` et les hooks, et les réexports (`RecorderState`, `RecorderStatus`, `getRecorderState`, `subscribeToRecorder`, `subscribeToFixes`, `GPS_LOST_ERROR`, `BELT_LOST_ERROR`, `recoverInterruptedRecording`, `stopRecordingBeltSearch`).

## Tranché par l'orchestrateur

- Dossier `hooks/recorder/` plutôt que des fichiers à plat.
- `continuePendingSession`, les lectures et hooks, et le rangement restent dans `useRecorder.ts` ; les commandes ne sont ni découpées ni réécrites : les lignes se déplacent telles quelles, seules les références changent (`session.x`, `watch.gpsOn`).
- `state` : liaison vivante (`export let`) ; si un outil ou un test s'en plaint, passer à un accesseur et le dire.
- Un test propre à `journalBuffer` est ajouté (une écriture en échec remet ses lignes en tête du tampon, précédées de `'\n'`), sans modifier un test existant.
- `outils/heritage.json` : `landOnRecording` (faux ami du motif `land[A-Z]`) se répartit entre les nouvelles pièces, total inchangé ; c'est l'orchestrateur qui refige, pas l'agent : `src/landWords.test.ts` échouera jusque-là, et c'est le seul échec admis.
- `docs/INVENTAIRE.md` : l'agent y ajoute les lignes des fichiers neufs (vers les lignes 207-210), sans quoi la vérification des documents échoue ; rien d'autre dans `docs/`.

## Ordre des pas

Après chacun : `npx tsc -b`, `npm run lint`, `npx vitest run src/hooks src/recording src/architecture.test.ts`.

1. `store.ts` ; `useRecorder` l'importe et réexporte.
2. Dans le fichier encore entier, l'objet `session` remplace les `let` (le typecheck désigne chaque usage). Pièges : les raccourcis `{ marks }` de `restoreFromJournal`, `startRecording` et `addRecordingMark` deviennent `marks: session.marks` ; ne pas toucher les variables locales homonymes (paramètre `marks` de `buildPendingSession`, `fixes: list` dans `recoverOnce`, `parsed.header?.startedAtMs`).
3. `journalBuffer.ts` : garder l'ordre exact de `keepPoint` (`lastFlushMs` posé, puis `flushJournal`).
4. `watches.ts` : `Date.now()` appelé au même endroit et le même nombre de fois.
5. `live.ts`. 6. `recovery.ts`.
7. `src/hooks/recorder/couches.test.ts`, recopié de celui de `sessionLibrary` (couches, accès par le point d'entrée seul, liste des valeurs et types exportés par `useRecorder.ts`, inchangée) ; lignes d'INVENTAIRE.

## Décisions d'exécution (agent, 11/11)

- `state` est resté une liaison vivante (`export let`) : ni tsc, ni oxlint, ni vitest ne s'en plaignent.
- `running` reste privé à `store.ts` ; `resumeHoldingCommands` lit `isCommandRunning()` (même test : une promesse est toujours vraie).
- Tampon du journal : `queueJournalLines(x)` remplace les dix `pendingLines += x` ; `dropJournalLines()` le `pendingLines = ''` d'`abandonResume` ; `resetJournalBuffer()` les deux lignes de `resetSession` ; dans `restoreFromJournal`, `pendingLines = '\n'` devient `queueJournalLines('\n')`, équivalent puisque `resetSession` vient de vider le tampon, sans attente entre les deux. `journalFlushDue(timeMs, flushS)` pose `lastFlushMs` quand le paquet est dû et rend vrai, puis `keepPoint` lance `flushJournal` : même ordre qu'avant.
- `watches.ts` : objet `watch` (`gps`, `gpsOn`, `offGpsLost`, `belt`, `beltOn`, `offBeltLost`) ; `startGpsWatchFor(profile)` reprend les trois dernières lignes de `resetSession`, appelé à la même place.
- `LiveSession` compte dix-huit champs (le plan en disait dix-sept) : `pendingLines`, `lastFlushMs` et `writes` sont dans `journalBuffer.ts`, pas dans l'objet.
- Le local `const session = journalSession(parsed)` de `recoveryFactsOf` et `recoverOnce` masque l'objet importé, comme il masquait déjà la variable du fichier entier ; laissé tel quel (aucun des deux ne lit la session en cours).
- `JournalRecovery` n'est pas exporté (type de retour de `recoverInterruptedRecording`, sans émission de déclarations).
- Retirés de `useRecorder.ts` : le repère « --- Enregistrement en cours --- », qui n'introduisait plus rien.
- Preuve des messages : TypeScript 7 n'a plus d'API JS ; l'extraction passe par `parseAst` de rolldown (ESTree), chaînes et morceaux de gabarits, hors chemins d'import et d'export : 185 chaînes (73 distinctes) avant et après, multiensembles triés identiques ; `Date.now()` ×23 et `console.*` ×3 de part et d'autre.

## Preuves

- Messages à l'octet : les chaînes littérales de `git show HEAD:src/hooks/useRecorder.ts` et celles de l'union des nouveaux fichiers, extraites et triées, sont identiques.
- Tests existants non modifiés (`useRecorder.test.ts`, `useRecorder.resume.test.ts`, `useLiveRecording.test.ts`, `useMarkGuide.test.ts`).
- Règle 12 : les pièces n'appellent que `src/platform/*`.
- Par l'orchestrateur : `npm run verif`, puis `node outils/banc/passe.mjs session-save session-save-resume gps-perdu notification --avant HEAD -j 1 --sans-cache`, relevés identiques.
