# Construire Gtracker

Une page pour qui reprend le dépôt : de quoi on a besoin, comment on vérifie, comment on sort une application web, un APK ou le programme Windows, où ajouter un calcul, un réglage ou un onglet. L'architecture se lit dans `docs/ETAT_DU_PROJET.md` (couches, pipeline, persistance), la carte des fichiers dans `docs/INVENTAIRE.md` et la disposition des pages d'analyse dans `docs/MISE_EN_PAGE.md`.

## Outils

- **Node 22.18 ou plus** (22.18+, 24 ou 26+) : Vitest 5 demande 22.12, et Capacitor lit `capacitor.config.ts` par le Node lui-même depuis TypeScript 7, ce que Node fait à partir de 22.18 (sous 22.12, `npx cap sync android` échoue) ; Node 23 et 25 sont refusés. `.nvmrc` donne la version de départ (26, celle du poste), `engines` de `package.json` la plage permise. Puis `npm ci`.
- **JDK 21** pour Android, et pas un autre : Gradle 8.14.3 (`android/gradle/wrapper/gradle-wrapper.properties`) ne tourne pas sous le Java 25 des Android Studio récents. `android/gradle/gradle-daemon-jvm.properties` (`toolchainVersion=21`) le demande au démon Gradle ; `JAVA_HOME` doit tout de même pointer vers un JDK 21 pour lancer `gradlew`.
- **SDK Android 36** (`compileSdkVersion` et `targetSdkVersion` dans `android/variables.gradle`), application installable dès Android 7 (`minSdkVersion` 24, WebView 111 au moins : `android.minWebViewVersion` de `capacitor.config.ts`, la cible de construction de Vite). Dire où est le SDK : `ANDROID_HOME`, ou `sdk.dir=…` dans `android/local.properties` (fichier de la machine, ignoré par git).

## Vérifier

```
npm run verif                     lint (sans avertissement toléré), tous les tests dans un ordre mélangé, typecheck de bureau/, build, renvois des documents
node outils/verif.mjs --rapide    typecheck, lint, tests des fichiers modifiés
npm run dev                       serveur de développement
npx tsc -b                        typecheck incrémental (strict, noUnusedLocals, verbatimModuleSyntax) ; --force pour tout revérifier
npm run lint                      oxlint, bloquant (--deny-warnings : un avertissement fait échouer)
npx vitest run --changed          tests qui importent, même de loin, un fichier modifié non commité
npx vitest run                    tous les tests de src/, bureau/ et outils/, en node, sans navigateur
npx vitest run src/sailing/wind.test.ts -t "nom"   un fichier, un test
npm run build                     tsc -b && vite build
```

Les tests (un peu plus de 300 fichiers, plus de 5 000 tests, une trentaine de secondes ; le compte du jour à la fin de `npx vitest run`) portent sur l'application (`src/`), le programme Windows (`bureau/`) et les outils de construction (`outils/`) ; ce qui est couvert et ce qui ne l'est pas : `docs/ETAT_DU_PROJET.md`, §8. Le typecheck de `bureau/` n'est fait que si ses dépendances sont installées (section « Windows ») ; sinon la sortie le dit. `npm run verif` vérifie aussi les renvois des documents (`outils/docs-cites.mjs`, `outils/docs-inventaire.mjs`) : un fichier cité qui n'existe plus fait échouer.

Les tests Java d'Android (JUnit, `android/app/src/test/java/`) ne font pas partie de `npm run verif` : après `npm run build` et `npx cap sync android`, depuis `android/`, sous JDK 21, `./gradlew testDebugUnitTest`, ou `--tests "*ComputerLinkCommandsTest"` pour une seule classe ; Robolectric télécharge une fois l'image d'Android 35 (environ 200 Mo).

À chaque envoi vers `main`, la vérification en ligne (`.github/workflows/verif.yml`) installe les dépendances de la racine et de `bureau/`, lance `npm run verif`, ouvre le projet Android (`./gradlew --version`), puis `npx cap sync android` et tous les tests JUnit.

## Web

`npm run build` écrit `dist/`, à servir tel quel par n'importe quel hébergeur statique. `public/_redirects` (`/*  /index.html  200`) renvoie toute adresse vers l'application, sans quoi un rechargement sur `/voile/analyse` donne une erreur 404 ; un hébergeur qui ignore ce fichier (tout sauf Netlify et Cloudflare Pages) demande la même règle dans sa propre configuration. L'application n'a pas de serveur à elle (voir le README pour ce qu'elle appelle).

## Android

1. Clé de signature, une fois, **hors du dépôt** et sauvegardée ailleurs :
   `keytool -genkeypair -v -keystore gtracker-release.jks -alias gtracker -keyalg RSA -keysize 2048 -validity 10000`
2. Copier `android/keystore.properties.exemple` en `android/keystore.properties` (ignoré par git) et remplir `storeFile` (chemin du `.jks`, relatif à `android/app/` ou absolu), `storePassword`, `keyAlias`, `keyPassword`. Sans ce fichier, `assembleRelease` et `bundleRelease` refusent de sortir, et `assembleDebug` retombe sur la clé de debug du PC.
3. Construire :
   ```
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleRelease      (Windows : gradlew.bat)   APK : app/build/outputs/apk/release/Gtracker-<version>.apk
   ./gradlew bundleRelease        AAB pour Google Play
   ```
   La version de l'APK vient de `package.json` (`versionName`) et en tire `versionCode` ; elle se monte avant chaque APK diffusé.

## Windows

Le programme Windows est une coquille Electron (`bureau/`, hors de `src/`) : elle sert l'application compilée (`dist/`) sous l'adresse `https://gtracker.localhost` et fait elle-même ce que la page ne peut pas faire : lire et écrire le dossier des sessions sur le disque, lire et écrire celui du téléphone (par le Wi-Fi ou par le câble), régler le pare-feu de Windows. Il se construit sur un poste Windows, pour Windows 64 bits. Le détail des commandes et des options est en tête de `outils/bureau.mjs`.

1. Dépendances, une fois, dans `bureau/` :
   ```
   cd bureau
   npm ci
   node node_modules/electron/install.js
   ```
   `npm ci` installe Electron, l'outil d'emballage, celui des fusibles et electron-builder, aux versions de `bureau/package-lock.json` ; la seconde commande télécharge le programme Electron lui-même, que le paquet ne télécharge pas seul. `@noble/hashes` doit y être à la même version qu'à la racine (le calcul de l'appairage est le même des deux côtés) : la construction s'arrête sinon.
2. Essayer, depuis la racine :
   ```
   npm run bureau        compile l'application et la coquille, puis lance la coquille sur un profil d'essai
   npm run exe           fabrique un programme d'essai, jamais diffusé : bureau/sortie/Gtracker-win32-x64/
   ```
   Le profil d'essai (dossier `profil-essai` de `bureau/sortie`, où tout ce qui est fabriqué est rangé, hors de git) n'est jamais celui du programme installé. Seuls ces programmes d'essai lisent les variables `GTRACKER_*` (mode d'essai, profil, dossier servi) ; le programme de l'installeur les ignore toutes.
3. Installeur, à diffuser :
   - d'abord l'APK de publication de la même version (section « Android » : `npm run build`, `npx cap sync android`, puis `gradlew.bat assembleRelease` dans `android/`) : l'installeur l'emporte, et le programme la propose au téléphone. Absente ou d'une autre version, la construction s'arrête avant de commencer et dit comment la fabriquer ;
   - puis, depuis la racine : `npm run installeur`.

   Sortie : `bureau/sortie/Gtracker-Setup-<version>.exe`. La première construction télécharge NSIS dans le cache d'electron-builder. La version est celle de `package.json`, la seule du projet ; Windows reçoit trois nombres sans zéro en tête (`0.02.24` donne `0.2.24`), l'application affiche toujours celle de `package.json`. Chaque programme emballé est relu après coup (modules de la coquille, langues du moteur web, absence du marqueur d'essai) : un écart arrête la construction.

   L'installeur s'installe en un clic, pour l'utilisateur courant, sans droits d'administrateur (`%LOCALAPPDATA%\Programs\Gtracker`, raccourcis sur le Bureau et dans le menu Démarrer) ; une version plus récente s'installe par-dessus et ferme d'abord un Gtracker ouvert. La désinstallation garde le profil (`%APPDATA%\Gtracker` : dossier retenu, téléphones reliés, réglages de l'appareil) et ne connaît pas le dossier des sessions ; elle retire les deux règles du pare-feu posées par le programme.

   **Non signé** : ni l'exécutable ni l'installeur ne portent de signature de code (`signAndEditExecutable: false`, `outils/bureau.mjs`), d'où l'avertissement de SmartScreen à la première ouverture de l'installeur (`docs/INSTALLATION.md`). Le faire disparaître demande un certificat de signature de code au nom de l'éditeur.

## Ce qu'un changement casse

- **`appId`** (`io.github.segneur.gtracker`, dans `capacitor.config.ts` et `android/app/build.gradle`) : Android y voit une autre application, installée à côté de la première, sans ses données.
- **La clé de signature** : Android refuse la mise à jour d'une application signée par une autre clé ; il faut la désinstaller, ce qui efface les données de l'application (réglages de l'appareil ; les sessions, dans le dossier mémoire hors de l'application, restent mais il faut le désigner de nouveau). Garder le `.jks` et ses mots de passe.
- **L'identité du programme Windows** se change librement avant sa première diffusion : identifiant de l'installeur, nom affiché, éditeur, copyright, métadonnées de l'exécutable (`ID_PROGRAMME`, `productName`, `author`, `copyright`, `win32metadata` dans `outils/bureau.mjs`). Après, trois noms ne se changent plus sans migration :
  - `ID_PROGRAMME` (`outils/bureau.mjs`, l'identifiant de l'application Android suivi de `.bureau`) : l'installeur en tire sa clé de désinstallation et l'emplacement installé ; changé, la version suivante s'installe à côté de la précédente au lieu de la remplacer ;
  - le nom du profil, posé par `app.setName('Gtracker')` (`bureau/main.ts`), qui donne `%APPDATA%\Gtracker` : changé, le programme repart d'un profil vide (dossier des sessions à désigner de nouveau, téléphones à relier de nouveau, réglages de l'appareil, cartes et vignettes gardées perdus ; les sessions restent dans leur dossier) ;
  - l'adresse `gtracker.localhost` (`HOTE`, `bureau/origine.ts`) : la mémoire du moteur web (réglages de l'appareil, cartes et vignettes gardées) est rangée par adresse ; changée, elle repart vide.

  Les noms des deux règles du pare-feu (`REGLE_TCP` et `REGLE_UDP` de `bureau/pareFeu.ts`, repris par `REGLES_PAREFEU` d'`outils/bureau.mjs`) sont à garder aussi : changés, les règles posées par une version précédente ne seraient plus remplacées, ni retirées à la désinstallation.
- **`versionCode`** : il doit croître à chaque APK, sinon Android refuse la mise à jour. Il vaut majeure × 1 000 000 + mineure × 1 000 + correctif + 1 (0.00.00 → 1), le + 1 parce qu'Android exige un code d'au moins 1.

## Où ajouter quoi

Les recettes des ajouts les plus rares ; chemins relatifs à `src/`.

- Nouveau calcul de support : son identifiant dans `SportType` (`core/types.ts`), une entrée de `SPORT_PROFILES` avec sa famille et tous ses seuils (`core/sportProfiles.ts`), sa couleur (`BASE_COLOR`, `core/activities.ts`) et son logo (`BASE_LOGO`, `core/activityLogos.ts`) ; le module, les onglets et les chiffres du direct viennent de sa famille, sauts, pumping et vagues des capacités de son profil. `core/sportProfiles.test.ts` vérifie qu'il est complet. Une activité (moth, paddle, SUP foil…) n'est jamais en dur : l'utilisateur la crée dans Réglages sur un calcul (`core/activities.ts`).
- Réglage utilisateur : un champ de `StoredSettings` (`settings/activitySettings.ts`), rangé par identifiant d'activité (`PER_ACTIVITY_KEYS`), écrit par une règle de `SETTING_FIELDS`, lu par son `resolve*` et `settingsView`, montré dans `pages/SettingsPage.tsx` ; son défaut par `default*Of`, qui lit le pré-réglage (`settings/activityPresets.ts`, `presetOf`) puis le profil du calcul. Le magasin et `useAllSportSettings` sont dans `hooks/useSportSettings.ts`.
- Page d'analyse : une seule par famille (`/voile/analyse`, `/surf/analyse`) ; un calcul neuf n'en crée pas. Suivre `docs/MISE_EN_PAGE.md` ; ce qui devient commun aux deux modules va dans une pièce partagée (`components/`), pas dans une copie.
- Section de module : une entrée dans `SAILING_TABS` ou `SURF_TABS` (`core/analysisTabs.ts`, défauts déduits par `tabDefaults`) ; si elle dépend d'une capacité du calcul, son filtre dans `analysisTabs`/`activityTabs` ; puis un bloc `{open.cle && ...}` dans un `ResizablePanel` d'`id` unique (l'`id` est la clé de la taille mémorisée : ne pas le renommer). Un onglet repris d'un autre module porte `generic` et sa pièce est partagée (`TopsPanel`). En voile : une seule barre d'onglets, dans la colonne de la carte.
- Métrique de manœuvre : `ManeuverLocation` (`sailing/maneuvers.ts`), puis `MANEUVER_METRICS` et `summarizeManeuvers` (`sailing/sailingAnalytics.ts`).
- Calcul de glisse neuf (vol, vague, run de downwind…) : pur, dans le dossier de sa famille (`sailing/` ou `surfing/`), seuils dans le profil (`SPORT_PROFILES`, passés en paramètre, surchargeables) ou son sous-profil (`surf`), en unités SI hors de `sailing/` (qui travaille en nœuds sur `PointData`), testé sur trace synthétique à 1 Hz et 5 Hz (fenêtres en secondes : même résultat aux deux cadences) ; s'il change un chiffre du résumé, `SUMMARY_CALC_VERSION` augmente et `library/summaryFrozen.test.ts` est refigé en le disant.
