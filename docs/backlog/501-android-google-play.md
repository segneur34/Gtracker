# 501 · Android prêt pour Google Play

Constats C-12, C-13, C-30, B-12, B-13 et B-14 de la relecture avant vente (`docs/backlog/493-relecture-avant-vente.md`, section « ## 501 »). Plan du 23/11, relu par l'orchestrateur.

## Où on en est

Le format demandé par Google (AAB) est déjà presque acquis : `android/app/build.gradle` refuse `bundleRelease` sans clé, comme `assembleRelease`, et `docs/DEVELOPPER.md` le documente ; rien à changer dans le gradle. Le travail porte sur la permission de batterie, deux traces de la ceinture, les filtres d'ouverture de fichiers et le dossier partagé.

L'exemption de batterie avait été ajoutée parce que, sur HyperOS, sans « démarrage automatique » et sans batterie « Aucune restriction », les positions s'arrêtaient en arrière-plan (ETAT §12). La permission du manifeste ne sert qu'à afficher la fenêtre d'Android « Autoriser ? » en un geste : l'état se lit sans elle (`isIgnoringBatteryOptimizations`), et « Aucune restriction » se règle toujours à la main depuis la page de Gtracker dans Android. L'enregistrement écran éteint est porté par le service de premier plan de type position et son verrou de veille (`RecordingService.java`).

## Fichiers

- `android/app/src/main/AndroidManifest.xml` : retirer `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (voir « Décision 1 ») et `ACCESS_LOCAL_NETWORK` ; réduire les filtres d'ouverture ; commentaires à jour.
- `…/gtracker/PermissionsPlugin.java` : `requestUnrestrictedBattery` ouvre la page de Gtracker dans Android (`appSettings()`, déjà dans la classe), sinon la liste `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` ; retirer `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `@SuppressLint("BatteryLife")` et la phrase « hors boutique ». Le nom de la méthode ne change pas : `src/platform/permissions.ts` reste tel quel, hors son commentaire.
- `…/gtracker/HeartRatePlugin.java` : les deux traces qui écrivent l'adresse, le nom ou la cible de la ceinture ne les écrivent plus ; le type d'adresse (`addressTypeText`), les états, les délais et l'étiquette `GtrackerHR` restent.
- `…/gtracker/ComputerLinkPlugin.java` : la demande de la permission « réseau local » ne part que si la cible de l'application (`targetSdkVersion`) atteint `LOCAL_NETWORK_SDK` ; commentaire adapté. **À faire en dernier, après le commit du lot 505**, qui remanie ce fichier.
- `android/app/src/main/res/xml/file_paths.xml` : `<cache-path name="partage" path="partage/" />`, comme `SHARE_DIR` de `ShareFilePlugin.java`.
- `src/platform/androidManifest.test.ts` : reprendre les tests de la permission de batterie, des six types, des motifs d'extension et du réseau local ; quatre gardes neuves : aucune exemption de batterie ; `ACCESS_LOCAL_NETWORK` absent tant que la cible (`android/variables.gradle`) reste sous 37 ; aucun `Log.` de `HeartRatePlugin.java` avec `getString("address"|"name")`, `getAddress()` ou `getName()` ; `file_paths.xml` cohérent avec `SHARE_DIR`.
- `src/components/PermissionsStatus.tsx` : la phrase « … : « Autoriser », ou « Aucune restriction ». » devient « … : Batterie, puis « Aucune restriction ». » ; les boutons « Autoriser » ne changent pas. `src/locales/en.json` et `es.json` : cette clé.

Filtres d'ouverture retenus (tranché par l'orchestrateur) : « Ouvrir avec » garde `application/gpx+xml`, `application/gpx`, `application/vnd.ant.fit` et `application/fit`, et le filtre par extension reconnaît `.fit` et `.FIT` en plus de `.gpx` et `.GPX` ; « Partager vers » garde ces quatre types et `application/octet-stream` (seule forme sous laquelle un fichier de montre arrive par un partage) ; `text/xml` et `application/xml` partent partout.

## Tranché par l'orchestrateur (23/11)

- Code réduit et obscurci (outil R8) : hors de ce lot. Google ne l'exige pas, et l'activer peut casser les greffons, appelés par réflexion ; à noter pour la livraison (308) ou pour l'acheteur.
- Les traces restent actives en version diffusée (le diagnostic par adb s'en sert) ; seules les données qui identifient la ceinture partent. L'adresse de l'ordinateur sur le réseau local reste dans les traces de la liaison.
- Changement d'identifiant de l'application, compte développeur et signature par Google Play : hors lot (308, acheteur).

## Décision 1, à l'utilisateur

Retirer l'exemption de batterie de toutes les versions (recommandé : une seule construction, un seul manifeste testé ; « Autoriser » ouvre la page de Gtracker dans Android, deux touches de plus, une fois), ou la garder sous une variante « hors boutique » (deux constructions, deux fois plus de tests, risque d'envoyer la mauvaise).

## Vérification

- `npm run verif` : tests du manifeste, des traces et du dossier partagé, dictionnaires, lint ; il ne compile pas le Java.
- Construction Android par l'orchestrateur : `assembleRelease` et `bundleRelease` ; les deux fichiers sortent, l'AAB signé ; le manifeste fusionné ne contient ni `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` ni `ACCESS_LOCAL_NETWORK` (un greffon pourrait les y remettre) ; `adb logcat -s GtrackerHR` pendant une connexion de la ceinture : ni adresse ni nom.

## Essais au téléphone

1. Batterie de Gtracker sur « Optimisée » dans Android, puis Réglages › Autorisations › « Autoriser » → la page de Gtracker dans Android s'ouvre ; Batterie → « Aucune restriction », retour : la ligne est accordée ; puis 20 min d'enregistrement écran éteint → trace sans trou.
2. Depuis l'application Fichiers, « Ouvrir avec Gtracker » un GPX, puis un fichier de montre (.fit), puis « Partager vers Gtracker » le .fit → les trois sont rangés (reprend et remplace l'essai 355 du lot 495).

## À la passe de documentation

ETAT §12 (ligne de `bundleRelease`, réglages du téléphone), `docs/INSTALLATION.md` (étape 3), un point d'HISTORIQUE ; DECISIONS §6 ne change pas.
