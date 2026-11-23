# 495 · Fichiers reçus, plafonds et points aberrants : plan retenu

Plan de l'agent Plan du 23/11, confronté par l'orchestrateur. Brief : section 495 de `493-relecture-avant-vente.md`. Lignes citées : celles du commit `d13131e`. Parties A et B codées en parallèle (seuls fichiers communs : les dictionnaires), C après B.

Cause : le lecteur GPX devient lent jusqu'au gel sur deux formes de fichier (attribut en double cherché par une boucle, `gpxParser.ts:266` ; points `trkpt` imbriqués, `:435`) ; le lecteur FIT n'a aucun plafond ; tous deux tournent sur le fil de l'affichage (`importer.ts:236`, `incoming.ts:135`), et un fichier reçu est rejoué à chaque lancement (la copie n'est retirée qu'après le verdict, `handled` ne vit que le temps d'un lancement). Un point à (0, 0) est gardé (`gpxParser.ts:559`, `places.ts:391`). Le plafond de 30 Mo n'est pas vérifié à l'import.

## Partie A : lecteurs, plafonds, point zéro

- A1. `src/core/geo.ts` : `isTrackPosition(lat, lon)` (nombres finis, |lat| ≤ 90, |lon| ≤ 180, couple exact (0, 0) écarté : défaut d'enregistreur avant les satellites, dit en commentaire). Employée dans `parseGpx` (remplace la l. 559), `parseGpxPath` (:616) et `src/core/fitParser.ts:readRecord` (:264).
- A2. `src/core/gpxParser.ts` : trois constantes nommées et commentées : 64 attributs par balise, 4 points ouverts à la fois, 64 déclarations d'espace de noms en portée. Contrôles dans `scanXml` (boucle des attributs, empilement de `nsPrefixes`) et dans `readGpxDocument` (`openPoints.push`). Au-delà : `malformed()`, message `MALFORMED` déjà traduit par `JOB_MESSAGES`. La boucle du doublon d'attribut reste, bornée par le plafond.
- A3. `src/core/fitParser.ts` : `MAX_FIT_RECORDS = 120 000`, option de `parseFit` avec ce défaut ; au plafond, le visiteur de `walkFit` rend `true` (arrêt) et `ParsedFit` porte `tooManyRecords`. Marge : 4 h à 5 points par seconde font 72 000 points, 24 h à 1 point par seconde 86 400.
- A4. `src/library/fitToGpx.ts` : si `tooManyRecords`, `{kind:'refused', reason: t('trop de points pour une seule session : fichier refusé')}` (littéral fixé : la partie B le traduit côté page).
- A5. `src/library/places.ts` : `pointOfAttributes` (qui sert `firstTrackPoint` et `lastTrackPoint`) passe par `isTrackPosition` ; `readPlaceSpot` : un lieu de source `carte` posé exactement en (0, 0) est lu comme absent, donc cherché de nouveau ; un lieu `utilisateur` n'est jamais touché.
- A6. `src/library/record.ts` : `SUMMARY_CALC_VERSION` passe à 23, avec sa ligne datée.

Fichiers de A : src/core/geo.ts, gpxParser.ts, fitParser.ts, gpxParser.test.ts, fitParser.test.ts ; src/library/fitToGpx.ts, fitToGpx.test.ts, places.ts, places.test.ts, record.ts, et les tests qui figent la version 22 ; src/locales/en.json, es.json.

Tests de A (fichiers piégés fabriqués dans le test) : une balise à 65 attributs, des points imbriqués sur cinq niveaux, 65 déclarations d'espace de noms imbriquées : refus `MALFORMED`, chacun en moins de 2 s ; 64 attributs passent ; un GPX honnête de 4 h à 5 points par seconde (72 000 points, Doppler, FC, cap, 12 `xmlns` à la racine, une déclaration `gpxtpx` par point) passe, durée notée sans la contrôler ; points à (0, 0), lat 200, lon 181 écartés ; `gpxParser.corpus.test.ts` vert sans changement ; un FIT au-delà de `maxRecords` refusé avec sa raison ; un FIT de 120 000 points avec tous les champs donne un GPX de 30 Mo au plus (sinon baisser le plafond et le dire) ; `firstTrackPoint` et `lastTrackPoint` sautent (0, 0) ; lieu `carte` en (0, 0) relu absent, lieu `utilisateur` gardé.

## Partie B : calcul en arrière-plan, délai de la file de fond, plafond à l'import

- B1. `src/library/trackWorkerProtocol.ts` : tâche `convertFit` (texte vide, octets dans `options.bytes`, rend `fitToGpx(bytes)`), file `'fond'` de `TRACK_QUEUE`. Le calcul en arrière-plan n'a pas de dictionnaire : `JOB_MESSAGES` gagne « fichier vide » et « ce n'est pas un fichier FIT » ; une table de littéraux dans `trackWorkerClient.ts` traduit les raisons d'un refus rendu (les deux de `fitToGpx.ts:109-110` et « trop de points pour une seule session : fichier refusé », écrite par la partie A).
- B2. `src/library/trackWorkerClient.ts` : `FOND_JOB_TIMEOUT_MS = 60 000`, file `'fond'` seulement. Le délai compte pour la demande la plus ancienne et se réarme à chaque réponse. À l'échéance : `terminate`, sans `inlineOnly` ; la demande en tête est rejetée avec `t('lecture trop longue : fichier refusé')` ; les suivantes repartent dans l'ordre sur un calcul neuf, jamais sur le fil de l'affichage. Sans `Worker`, pas de délai. Pour un enregistrement, `addGpx` rend alors `invalid` et la session reste en attente (`useRecorder.ts:164-165`) : rien n'est perdu. L'agent mesure `summarizeGpx` sur 4 h à 5 points par seconde : au-delà de 3 s sur ce poste, le délai passe à 120 s.
- B3. `src/library/reconcile.ts` : `exceedsListedSize(text)` à côté de `MAX_LISTED_FILE_BYTES` (longueur UTF-8 comptée par une boucle, sans encoder 30 Mo).
- B4. `src/hooks/sessionLibrary/addSession.ts:addGpx` : pour `source === 'import'` seulement, refus `invalid` avec `t('il dépasse {size} Mo')`, sur le GPX rangé (couvre les GPX tirés d'un FIT). Ni le paquet entier ni un enregistrement ne sont visés.
- B5. `src/platform/memoryFolder.ts` : `ImportEntry.size?`, rempli par `importer.ts:pickedEntry` (`file.size`), par `incoming.ts:entryOf` (une ligne) et par les entrées de dossier qui le connaissent.
- B6. `src/hooks/sessionLibrary/importer.ts` : un FIT de plus de 30 Mo est refusé avant lecture ; `fitToGpx(bytes)` devient `runInWorker('convertFit', '', { bytes })` ; une erreur du calcul reste un refus, jamais un nouvel essai.
- B7. À vérifier : `unbundleSessionGpx` et `embeddedRouteRecord` (expressions régulières paresseuses, fil de l'affichage) face à 100 000 balises ouvrantes sans fermeture ; au-delà d'une seconde, le dire, sans corriger.

Fichiers de B : src/library/trackWorkerProtocol.ts, trackWorkerClient.ts, trackWorkerClient.test.ts, reconcile.ts ; src/hooks/sessionLibrary/addSession.ts, addSession.test.ts, importer.ts, importer.fit.test.ts, incoming.ts (la seule ligne de `entryOf`) ; src/platform/memoryFolder.ts ; src/locales/en.json, es.json.

Tests de B : `trackWorkerClient.test.ts` (faux calcul muet, minuterie factice : la tête rejetée à l'échéance, la suivante servie par un calcul neuf, rien refait sur le fil de l'affichage, pas de délai pour la file `analyse`) ; un GPX importé de plus de 30 Mo refusé, non rejoué ; un FIT de plus de 30 Mo refusé avant lecture ; un enregistrement de même taille non refusé ; `trackWorker.architecture.test.ts` vert avec fitToGpx ajouté au calcul en arrière-plan.

## Partie C : réception et verrou contre le rejeu (un agent neuf, après B, dans la copie de B)

- C1. `android/app/src/main/java/io/github/segneur/gtracker/IncomingFilePlugin.java` : méthode `mark({id, trying})` qui crée ou efface un fichier témoin `<id>.essai` dans `recus/`, sur le même fil `WORKER` ; `list` ignore les `.essai` et ajoute `trying` à chaque entrée ; `remove` efface aussi le témoin ; `deleteLeftovers` ne les efface pas.
- C2. `src/platform/incomingFile.ts` : `IncomingFile.trying: boolean`, `IncomingFilesPort.mark(id, trying)`, sans effet dans le navigateur.
- C3. `src/hooks/sessionLibrary/incoming.ts:handle` : si `file.trying` : `t("{quoted} n'a pas été rangé : Gtracker s'est arrêté pendant sa lecture. S'il est bon, ouvrez-le de nouveau.")`, puis `forget`, sans lire le fichier ; sinon `await port.mark(id, true)` avant `routeArrival` (un échec de pose est noté dans la console, on continue) ; verdict `retry` ou échec du rangement d'un itinéraire : `mark(id, false)` ; le témoin part avec `forget`. `routeArrival` : `isRouteGpx` passe par `runInWorker('routeCheck', text, {})`, tâche neuve de la file `'fond'` (protocole et client).

Fichiers de C : IncomingFilePlugin.java ; src/platform/incomingFile.ts, nativeConstants.test.ts, appReset.test.ts (si son faux port doit gagner `mark`) ; src/hooks/sessionLibrary/incoming.ts, incoming.test.ts ; src/library/trackWorkerProtocol.ts, trackWorkerClient.ts ; src/locales/en.json, es.json.

Tests de C : `incoming.test.ts` (un fichier `trying` refusé avec son message, copie retirée, sans lecture ; `mark(true)` avant la lecture ; `mark(false)` sur `retry` et sur l'échec d'un itinéraire) ; `nativeConstants.test.ts` (le Java déclare `mark` et met `trying` dans `list`).

## Banc (un autre agent, après les commits)

`fichier-recu.mjs` : le faux port reçoit `mark`, et un cas 8 (fichier `trying` refusé et dit, copie retirée). Neutralité : `import-fit fichier-recu import-session library lieu planning vignettes-relance`, relevé identique hors cas 8 et hors la ligne « n sessions à mettre à jour » (version 23).

## Questions mineures, tranchées par l'orchestrateur le 23/11

- Verrou par fichier témoin côté Java (sûr même si le processus est tué), pas par une clé de stockage.
- Délai de 60 s par demande sur la file de fond (120 s si la mesure le demande).
- `SUMMARY_CALC_VERSION` à 23 : résumés et vignettes recalculés une fois.
- L'emprise de la carte sans les points jugés sautés n'est pas faite dans ce lot (idée notée au reste à faire) : les points (0, 0) et hors bornes couvrent le cas signalé.
- Un fichier qui dépasse un plafond du lecteur reçoit le message « mal formé » existant.
- Le plafond de 30 Mo porte sur le GPX rangé à l'import, ni sur le paquet entier ni sur un enregistrement.
- Le titre d'un GPX tiré d'un FIT, calculé hors du fil de l'affichage, reste en français (traduit à l'affichage).

## Essai au téléphone

« Ouvrir avec Gtracker » un GPX ordinaire puis un fichier de montre → tous deux rangés, bandeau, aucune phrase « s'est arrêté pendant sa lecture ».
