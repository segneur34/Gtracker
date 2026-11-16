# 415 · La position revient quand la localisation est rallumée

## Ce qui ne va pas

Un enregistrement lancé localisation coupée ne trouve jamais sa position une fois la localisation rallumée (essai 273 du 16/11, APK 0.01.07, Xiaomi). « Réessayer » n'y change rien ; arrêter puis relancer l'enregistrement trouve la position aussitôt.

## Cause, lue dans le journal du téléphone le 16/11

- 08:43:59 : `LocationManagerService` inscrit la demande GPS de Gtracker avec `permitted: false` (localisation coupée).
- 08:44:14 : la localisation revient (`onProviderEnabledChanged gps true`) ; les inscriptions de Google et du système passent `onActive`, celle de Gtracker jamais.
- `RecordingService.requestUpdates` suppose que « les positions reviennent seules quand elle est rendue » (commentaire de `onProviderDisabled`) : faux sur ce téléphone.
- « Réessayer » du GPS ne fait que demander les données d'aide (`GnssPlugin`) sans refaire l'inscription.

## À faire

1. Au retour de la localisation, le service retire puis refait son inscription GPS (`stopUpdates` puis `requestUpdates`, sur son fil). Il guette lui-même ce retour par un récepteur de `LocationManager.MODE_CHANGED_ACTION` (inscrit et retiré avec le service), et non par le seul `onProviderEnabled` d'une inscription inactive.
2. « Réessayer » du GPS refait aussi l'inscription tant qu'aucune position n'est arrivée et que la localisation est allumée.
3. Corriger le commentaire de `onProviderDisabled`, qui dit le contraire.
4. Consigner la réinscription sous l'étiquette `GtrackerRecording`, pour que l'essai se lise au câble.

## À ne pas toucher

- La relance du GPS muet (`GpsRestart`) : elle ne vaut qu'après une première position.
- Les décisions du §6 de `docs/DECISIONS.md` (enregistrement), à lire avant.
- Rien côté page au-delà de ce que le point 2 demande ; aucun texte visible neuf sauf nécessité (alors par `t`, trois langues).

## Vérification

Java, non vu par le banc. Un test unitaire si la logique de décision (« faut-il réinscrire ? ») peut se sortir en fonction pure, à la manière de `ClosedGuard` ; sinon le dire dans le rapport. `node outils/verif.mjs --rapide` si du TypeScript change, et la compilation Java (`gradlew.bat` par son chemin complet entre guillemets depuis `android/`, voir `docs/DEVELOPPER.md`).

## Essai au téléphone

Rejouer le 273, téléphone branché : localisation coupée, démarrer un enregistrement, « Activer la localisation », revenir → la trace démarre dans les secondes qui suivent, sans relancer l'enregistrement.

## Résultat attendu

La trace démarre dans les secondes qui suivent la localisation rallumée, sans relancer l'enregistrement.
