# 396 · Enregistrement : les filets qui manquent

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11 (auditeurs « robustesse » et « Android », constats 1 à 3 relus dans le code par l'orchestrateur). L'utilisateur : « toutes les petites corrections, on peut les faire, il faut les faire d'ailleurs ». Lire `docs/DECISIONS.md` §6 avant de commencer. Aucun essai au téléphone : tout se prouve par des tests purs ; le Java doit compiler.

## Corrections

1. **Journal mis de côté jamais relu** (`src/hooks/recorder/recovery.ts:54-58`, vers 276 et 306 ; `src/platform/files.ts:126-131,156-174`). Quand le journal ne se lit pas ou que la session ne se reconstruit pas, il est renommé `recording-journal-<date>.jsonl` dans le dossier privé et la page dit « son journal est gardé de côté sur le téléphone » ; aucun code ne le relit ni ne l'exporte, l'utilisateur ne peut pas ouvrir ce dossier. Attendu : à chaque lancement, une nouvelle tentative de reconstruction sur chaque journal mis de côté (une lecture qui avait échoué une fois peut réussir) ; s'il reste illisible, il est copié tel quel dans le dossier mémoire (un sous-dossier dédié, par `platform/memoryFolder.ts`), où l'utilisateur peut le prendre, et le message dit où il est. Rien n'est supprimé du dossier privé tant que la copie n'est pas faite.
2. **Abonnés de l'enregistreur sans filet** (`src/hooks/recorder/store.ts:149-154`, `src/hooks/createStore.ts:26-45`). `createListeners()` y est créé sans `safe` : un abonné qui lève pendant un `setState` interrompt l'appelant. Dans `stopRecording` (`src/hooks/useRecorder.ts:507-516`), le premier `setState` passe à « stopping » ; s'il lève, le GPS reste allumé, « Arrêter » est ignoré, plus aucun départ possible. Dans `keepPoint` (`hooks/recorder/live.ts:57`), l'écriture du journal est sautée. Attendu : abonnés protégés (`safe: true`), et le calcul du direct (`computeLiveStats`, `hooks/useLiveRecording.ts:153-164`) entouré de façon qu'une erreur garde les derniers chiffres au lieu de remonter. Test : un abonné qui lève n'empêche ni l'arrêt complet ni l'écriture du journal.
3. **Ceinture cardio, première connexion sans réponse** (`HeartRatePlugin.java`, vers 737 ; non relu par l'orchestrateur : vérifier d'abord). Le garde-fou de 35 s (`retryLostIn(OPEN_GUARD_MS)`) ne serait armé qu'en mode perte ; avant la première jonction, un `connectGatt` sans rappel laisserait l'état sur « connexion » jusqu'à « Réessayer ». Attendu : le même garde-fou à la première connexion.
4. **Caractères de contrôle dans un nom** (`src/core/xml.ts:9-12`, `src/recording/gpxWriter.ts:56`, lecteur `src/core/gpxParser.ts:50,163`). L'écriture n'échappe que `& < > "` ; le lecteur refuse tout fichier portant un caractère interdit en XML. Un nom d'activité ou de session collé avec un caractère invisible rend le GPX illisible par l'application elle-même. Attendu : ces caractères retirés à l'écriture (test : écrire puis relire un nom qui en porte).
5. **Session en attente en `.tmp`** (`src/hooks/sessionLibrary/pending.ts:139-140` contre `:190-191`) : jugée illisible, elle est effacée, alors que la même sous son vrai nom est gardée en attente. Attendu : le même traitement, gardée.
6. **Repères en double** après une écriture du journal refaite (`hooks/recorder/journalBuffer.ts:65`, `recording/journal.ts:344-347`) : dédoublonner à la relecture.
7. **Manifeste** (`android/app/src/main/AndroidManifest.xml:18`) : `fontScale` (et `fontWeightAdjustment` si le niveau d'API de compilation le permet) ajoutés à `configChanges` : changer la taille du texte du téléphone pendant un enregistrement ne recrée plus l'activité. `androidManifest.test.ts` suit.

## Laissé de côté, à dire dans le rapport si le code le dément

- Repères écartés quand l'horloge du téléphone avance sur l'heure GPS (`recovery.ts:297-298`) : très rare, à corriger seulement si c'est une ligne.
- La survie du GPS à la fermeture de l'application : c'est le lot 403.

## Vérification

`node outils/verif.mjs --rapide` pendant le travail, `npm run verif` à la fin ; compilation du Java (procédure du §12 d'ETAT, sans construire d'APK). Banc : `gps-perdu` et `notification` contre HEAD, relevés identiques.
