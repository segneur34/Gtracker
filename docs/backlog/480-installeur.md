# 480 · Installeur Windows, avec l'application du téléphone de la même version : plan

Plan de l'agent Plan du 21/11, relu par l'orchestrateur. Demande et réponses de l'utilisateur : ligne 480 du reste à faire.

## L'existant

- `outils/bureau.mjs --exe` fabrique le dossier `bureau/sortie/Gtracker-win32-x64/` : `@electron/packager`, puis les fusibles, puis `dist/` posé en ressource. Pas d'installeur.
- Profil du programme : `%APPDATA%\Gtracker`. La mémoire de l'utilisateur est ailleurs (`Documents\Gtracker` ou le dossier choisi).
- `adb` n'est pas embarqué : `bureau/adb.ts` cherche celui du poste (PATH, `ANDROID_HOME`, `%LOCALAPPDATA%\Android\Sdk`, puis `platform-tools` dans le profil et à côté de `Gtracker.exe`). Sur un PC neuf sans cet outil, « Installer par le câble » répondra qu'il manque et seul « Enregistrer l'APK » marchera.

## Décisions

- Outil : electron-builder (version épinglée), cible NSIS, en mode `--prepackaged` sur le dossier que fait déjà `emballer()` : la chaîne actuelle reste telle quelle, rien à installer sur le poste, pas de droits d'administrateur.
- NSIS : `oneClick: true`, `perMachine: false` (installation dans `%LOCALAPPDATA%\Programs\Gtracker`), raccourcis du Bureau et du menu Démarrer nommés « Gtracker », icône `outils/icone-gtracker.ico`, `deleteAppDataOnUninstall: false` (profil gardé ; le dossier mémoire n'est jamais connu de l'installeur), `artifactName: 'Gtracker-Setup-${version}.exe'`, langue française, `win.signAndEditExecutable: false`. Version par `versionBureau()`.
- Mise à jour : relancer un installeur plus récent par-dessus (à prouver à l'étape A).
- APK : `android/app/build/outputs/apk/release/Gtracker-<version>.apk`, version lue dans `package.json`, jamais une APK de débogage ; rangée en ressource (`resources\Gtracker-<version>.apk`). Absente ou d'une autre version : la construction s'arrête et dit la commande à lancer. `--sans-apk` pour les essais seulement : la carte dit alors que l'application est absente.
- Pas de signature (élément 452) : l'avertissement « éditeur inconnu » de Windows est accepté pour l'instant.
- `adb` n'est pas embarqué tant que le juriste n'a pas parlé (élément 452) : tranché par l'orchestrateur le 21/11 au plus prudent, question posée à l'utilisateur (Q143) ; réponse du 21/11 : sans avis, et pas de juriste sous la main : `adb` reste hors de l'installeur, le sujet suit l'élément 452.
- Mineures tranchées : installation en un clic sans choix du dossier ; la fenêtre de première ouverture revient à chaque nouvelle version, « Plus tard » la cache jusqu'à la suivante ; pas d'association de fichiers .gpx dans ce lot ; le message « signature différente » ne conseille pas de désinstaller l'application.

## Parties (un commit chacune)

**A · Construction (Opus high).**
- `bureau/package.json` et son verrou (electron-builder en dépendance de développement), `outils/bureau.mjs` (`--installeur`, `cheminApk()`, `configNsis()` exportées), `outils/bureau.test.mjs` (chemin et version de l'APK, configuration : par utilisateur, profil gardé, nom du fichier), script `installeur` dans le `package.json` de la racine.
- Commande unique : `npm run installeur` (vite build, compilation de la coquille, packager avec l'APK et les fusibles, electron-builder). Fichier final : `bureau/sortie/Gtracker-Setup-<version>.exe`, hors dépôt.
- Preuve sans l'utilisateur, `outils/installeur-essai.mjs` : relever l'état de `%APPDATA%\Gtracker` (le vrai profil) et d'un dossier mémoire témoin ; installer en silence (`/S`, dans un dossier temporaire par `/D=` si NSIS l'accepte) ; contrôler `Gtracker.exe`, `resources\dist\index.html`, l'APK, les deux raccourcis, la clé de désinstallation (HKCU) ; lancer le programme installé avec `GTRACKER_PROFIL` sur un dossier temporaire et `GTRACKER_BANC` ; réinstaller par-dessus ; désinstaller en silence et vérifier que le programme a disparu, que le profil et la mémoire témoin sont intacts. Un raccourci « Gtracker » déjà présent sur le Bureau ou dans le menu Démarrer avant l'essai est copié à part puis remis. Mesures : poids, durée.

**B · Coquille (Opus high).**
- `bureau/applicationTelephone.ts` (sans Electron) et son test. Canaux `application:etat` (`{ version, disponible, proposee }`), `application:enregistrer` (fenêtre « Enregistrer sous », puis copie), `application:installer`. Branchement dans `brancherPont()` de `main.ts` et objet `application` dans `preload.ts` ; le test vérifie que les noms des canaux du preload sont ceux de la coquille.
- Fichier pris dans `process.resourcesPath` ; sous le banc, `GTRACKER_APK` puis le dossier de Gradle.
- `bureau/adb.ts` : `installerApk()` (`adb -s <série> install -r <apk>`, jamais `-d`, par `parLeServeur`, délai de 2 min, dans la même file que les autres commandes), `lireInstallation(sortie)` (version plus récente déjà là, signature différente, installation par USB coupée, mémoire pleine, autre), `install` ajouté aux commandes autorisées ; en mode d'essai l'APK est copiée dans le dossier local qui joue le téléphone. Tests sur des sorties recopiées.
- Le drapeau « déjà proposée » (par version) est tenu dans le profil de la coquille.

**C · Page (Opus high ; le script du banc à part, sur Sonnet).**
- `src/platform/phoneApp.ts` et son test (`phoneAppAvailable`, `phoneAppInfo`, `savePhoneApp`, `installPhoneApp`, `markPhoneAppProposed`), champ facultatif `application?` dans `DesktopBridge`.
- `src/components/PhoneAppCard.tsx` et son `.css` (aucun `style={{`), montée dans `MemoryStatus` (rendu détaillé, près de `WirelessPhoneCard`) ; à la première ouverture, une fenêtre (`components/ui/Dialog`) sur `ProfilePage`, une fois la mémoire choisie.
- Textes :
  - carte : « Application du téléphone » ; « Gtracker {version} pour Android, la même version que ce programme. » ; boutons « Enregistrer l'APK… » et « Installer par le câble » ;
  - aide : « Copiez le fichier sur le téléphone et ouvrez-le ; Android demandera d'autoriser cette source. Par le câble, le débogage USB doit être activé. » ;
  - première ouverture : « Ce programme contient l'application Android de la même version. », boutons de la carte et « Plus tard » ;
  - « Application installée sur {nom}. » ; « Aucun téléphone branché. » ; « Acceptez cet ordinateur sur l'écran du téléphone, puis réessayez. » ; « Le téléphone ne répond pas : débranchez-le et rebranchez-le. » ; « L'outil du débogage USB n'est pas sur ce PC : enregistrez l'APK et copiez-la sur le téléphone. » ; « Un autre programme tient la liaison avec le téléphone : fermez-le et réessayez. » ;
  - refus : « Le téléphone a refusé l'installation : {raison} » (« une version plus récente y est déjà », « l'application installée n'a pas la même signature », « l'installation par USB est coupée dans les options pour les développeurs », « mémoire pleine ») ;
  - sans APK : « Ce programme n'a pas l'application du téléphone. »
- Dictionnaires `en.json` et `es.json` ; INVENTAIRE.
- Banc : `outils/banc/exe-application.mjs` (carte, enregistrement par une variable d'essai qui remplace la fenêtre, installation sur le faux téléphone, fenêtre de première ouverture vue une seule fois).

Règles : 12 (le pont n'est lu que dans `src/platform/`), 14 (commentaires, aussi dans `bureau/`), version unique dans `package.json`, textes par `t`, variables du thème. Documents après validation seulement : ETAT, DECISIONS §8 (dit encore « sans installeur »).

## À essayer par l'utilisateur

- Sur un PC neuf : l'avertissement de Windows pour un programme non signé, les raccourcis, puis « Enregistrer l'APK » vers le téléphone.
- Sur son PC : « Installer par le câble ».
