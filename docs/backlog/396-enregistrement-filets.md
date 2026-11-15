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

## Plan du 15/11 (agent Plan) et questions tranchées par l'orchestrateur

Les sept constats tiennent dans le code. Le 3 demande un garde-fou à part : `retryLostIn` ne sert à rien avant la jonction (`retryLost()` sort aussitôt hors du mode perte) ; il faut un `openGuard` distinct, armé dans `open()` tant que la ceinture n'a jamais été jointe, retiré à la connexion, à la fermeture et au désarmement.

Coupe en deux agents successifs, chacun avec son commit : partie A = corrections 4, 5, 6, 7 et 3 (locales, plus la compilation du Java) ; partie B = corrections 2 et 1 (cœur de l'enregistreur et module neuf). Le lot 397, codé en même temps, n'ajoute ni ne retire aucune clé des dictionnaires (son plan le dit) : `src/locales/` revient donc au 396.

Tranché par l'orchestrateur (implémentation, aucune donnée perdue dans aucun cas) :
- sous-dossier du dossier mémoire : `journaux/`, ajouté à la disposition (`library/folderLayout.ts`, `MEMORY_SUBFOLDERS`) ; c'est un nom de rangement, le brief demandait « un sous-dossier dédié » ;
- un journal mis de côté qui se relit enfin est rangé comme une session, sans l'écran « Continuer / Analyser / Jeter » (« Continuer » n'a plus de sens après coup), et l'utilisateur en est prévenu par le message de démarrage ;
- sans dossier mémoire, ou dossier en lecture seule : le journal reste dans le dossier privé, rien n'est effacé, et c'est dit une fois par lancement ;
- capteurs d'un journal reconstruit : repris si la reprise normale offre déjà la fonction à appeler telle quelle ; sinon la session est rangée sans eux et le fichier des capteurs n'est pas effacé ;
- repères : un seul par instant ; une coupure identique n'est pas poussée deux fois ;
- un seul message pour le journal mis de côté, celui du démarrage ;
- le `.tmp` invalide gardé est retenté et signalé à chaque ouverture, comme son équivalent sous son vrai nom (c'est l'attendu du point 5).

## Vérification

`node outils/verif.mjs --rapide` pendant le travail, `npm run verif` à la fin ; compilation du Java (procédure du §12 d'ETAT, sans construire d'APK). Banc : `gps-perdu` et `notification` contre HEAD, relevés identiques.
