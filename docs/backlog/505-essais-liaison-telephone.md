# 505 · Essais automatiques du côté téléphone de la liaison

Constat F-04 de la relecture avant vente (`docs/backlog/493-relecture-avant-vente.md`, section « ## 505 »). Plan du 23/11, relu par l'orchestrateur.

## Constat

Le code du téléphone qui reçoit les ordres de l'ordinateur est en Java : `ComputerLinkPlugin.java` les répartit (`serve()`) et les traite (`listFiles`, `readBlock`, `writeBlock`, `commitWrite`, `eraseFile`, `abandonWrite`), en écrivant par `MemoryWriter.java` (`open`, `commit`, `abandon`, `erase`, `settle`). Le format des trames et le contrôle des chemins sont déjà essayés (`ComputerLinkProtocolTest.java`) ; la répartition, l'effacement des fichiers provisoires et `MemoryWriter` ne le sont pas. Vitest ne voit pas le Java, et `bureau/fauxTelephone.ts` n'en est qu'une copie en TypeScript : ce côté ne s'essaie qu'en JUnit (`gradlew testDebugUnitTest`).

## Fichiers (sous `android/app/`)

- À créer : `src/main/java/…/gtracker/ComputerLinkCommands.java`, la répartition sortie telle quelle du greffon : `byte[] answer(Incoming m, MemoryRoot root)` pour ping, lister, lire, ecrire, valider et effacer (un ordre inconnu lève `FrameException` `UNKNOWN_MESSAGE`), et `void abandon()`. La classe garde l'écriture en cours (`WriteSession`, `Provisional`, `MemoryWriter`), qui sort de `Connection`. Elle reçoit `ContentResolver`, `BooleanSupplier recording` et deux `Runnable`, `exchanged` et `fileSent`. Du code déplacé, pas réécrit.
- À créer : `src/test/java/…/gtracker/ComputerLinkCommandsTest.java` et `FakeDocuments.java`, un faux fournisseur de documents adossé à un dossier temporaire (`TemporaryFolder`), avec un réglage « sans renommage ».
- À modifier : `ComputerLinkPlugin.java` (`serve()` appelle `c.commands.answer(…)`, puis `c.commands.abandon()` en sortie ; `MemoryRoot` visible dans le paquet ; `recording()` en lambda sur `RecordingService.snapshot().running`).
- À modifier : `build.gradle` (une ligne `testImplementation` pour Robolectric, et `testOptions.unitTests.includeAndroidResources = true` s'il le demande) et `../variables.gradle` (sa version).
- `MemoryWriter.java` et `MemoryTree.java` ne changent pas.

À réutiliser : `ComputerLinkProtocol` (`encodeFrame`, `FrameDecoder`, `readMessage`, `COMMAND_LIMITS`, `provisionalName`, `WriteSession`, `ERROR_*`), les aides à fabriquer des trames de `ComputerLinkProtocolTest`, `MemoryTree.fate` et `originalOf`, le registre statique `MemoryTree.startWriting` et `stopWriting` (à vider entre deux essais) ; comme modèle des attentes, `bureau/sansFil.test.ts` et `bureau/disque.test.ts`.

## Cas à essayer, les plus utiles d'abord

1. Écriture d'un fichier neuf en deux blocs puis valider : le fichier est là, de bonne taille, sans `.gtracker-new` ; la réponse « ecrit » porte taille et date.
2. Remplacement : l'original reste intact jusqu'à valider, puis il est remplacé ; aucun `.gtracker-tmp` ne reste.
3. Coupure au milieu : un bloc sur deux, puis `abandon()` : l'original est intact et le provisoire effacé, pour une création comme pour un remplacement. Un provisoire laissé par un arrêt brutal (nouvelle instance, sans abandon) est remis en ordre par `lister` (`settle`).
4. Effacement : le fichier et son `.gtracker-tmp` voisin partent ; un fichier absent répond « fait » ; une écriture en cours sur le même chemin est abandonnée.
5. Refus d'un chemin hors des dossiers permis, de bout en bout (trame, `readMessage`, rien d'écrit) : `../x`, `sessions/../gtracker.json`, `corbeille/x` en écriture, `a/b/c`, `CON.gpx`, sous-dossier de base refusé.
6. Ordre inconnu : `UNKNOWN_MESSAGE`.
7. Garde-fous : pendant un enregistrement, ecrire, valider et effacer sont refusés (`PERMISSION`) et le provisoire est abandonné ; bloc hors d'ordre ; valider avec une mauvaise taille ; aucun dossier désigné (`NOT_FOUND`).
8. Stockage sans renommage : passage par la copie, sans fichier tronqué.
9. Lecture par blocs, bloc plus court en fin de fichier ; `fileSent` n'est appelé qu'au dernier octet.

## Étapes

1. Essai préalable, court : ajouter Robolectric et faire tourner `FakeDocuments` (sous-classe de `DocumentsProvider`, ou à défaut un `ContentProvider` qui répond à `call`, `query` et `openFile`) avec un simple `MemoryWriter.open` puis `commit`.
2. Extraire `ComputerLinkCommands` du greffon, sans rien changer d'autre ; les gardes `src/nativeConstants.test.ts` et `src/androidManifest.test.ts` restent vertes.
3. Écrire les cas 1 à 9 ; `gradlew.bat testDebugUnitTest` dans `android/` ; `node outils/verif.mjs --rapide`.

## Tranché par l'orchestrateur (23/11)

- Robolectric avec un faux fournisseur, plutôt qu'une interface entre `MemoryWriter` et Android (qui toucherait beaucoup de code de production, `MemoryFolderPlugin` compris). Si Robolectric ne passe pas après l'essai préalable : rapport BLOQUÉ, sans prendre l'autre voie.
- Les essais Java ne rejoignent pas `npm run verif` (Gradle y ajouterait de 30 s à plusieurs minutes et demande le JDK) : ils restent à la vérification en ligne, qui les joue déjà, et à une commande à citer dans `docs/DEVELOPPER.md` à la passe de documentation.
- Pas de jeu de scénarios partagé avec `bureau/fauxTelephone.ts` dans ce lot (idée à noter au reste à faire).

## Règles

Commentaires sans numéro de lot, la raison en clair. Ne rien perdre (`docs/DECISIONS.md` §8) : original intact jusqu'à valider, provisoire effacé à la coupure, jamais d'écriture pendant un enregistrement. Essais synthétiques seulement. Rien à essayer au téléphone, pas de banc (la page ne change pas).

## Réalisé (23/11)

- Robolectric 4.16, Android simulé 35 (`@Config(sdk = 35)`, image déjà présente dans `~/.m2` sur le poste), sans `includeAndroidResources`.
- `FakeDocuments` est un `ContentProvider` qui parle DocumentsContract (`call`, `query`, `openFile`), pas une sous-classe de `DocumentsProvider` : le ContentResolver de Robolectric appelle l'ancienne forme de `query`, que `DocumentsProvider` refuse et rend finale.
- Les neuf cas en 21 essais (`ComputerLinkCommandsTest`), chacun vérifiant en fin d'essai qu'aucun provisoire ne reste tenu (`MemoryTree`, registre lu par réflexion). L'arrêt brutal est simulé par les provisoires qu'il laisse, posés sur le disque : sous Windows, un flux resté ouvert empêche d'effacer son fichier.
- Aucun défaut du code de production trouvé.

## À la passe de documentation

ETAT §8 (« les greffons Java » parmi les non testés : phrase périmée), INVENTAIRE (la classe neuve et son essai), DEVELOPPER (la commande Gradle), un point d'HISTORIQUE.
