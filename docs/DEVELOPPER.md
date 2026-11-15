# Construire Gtracker

Une page pour qui reprend le dépôt : de quoi on a besoin, comment on vérifie, comment on sort une application web ou un APK, où ajouter un calcul, un réglage ou un onglet. L'architecture se lit dans `docs/ETAT_DU_PROJET.md` (couches, pipeline, persistance), la carte des fichiers dans `docs/INVENTAIRE.md` et la disposition des pages d'analyse dans `docs/MISE_EN_PAGE.md`.

## Outils

- **Node 22.18 ou plus** (22.18+, 24 ou 26+) : Vitest 5 demande 22.12, et Capacitor lit `capacitor.config.ts` par le Node lui-même depuis TypeScript 7, ce que Node fait à partir de 22.18 (sous 22.12, `npx cap sync android` échoue) ; Node 23 et 25 sont refusés. `.nvmrc` donne la version de départ (26, celle du poste), `engines` de `package.json` la plage permise. Puis `npm ci`.
- **JDK 21** pour Android, et pas un autre : Gradle 8.14.3 (`android/gradle/wrapper/gradle-wrapper.properties`) ne tourne pas sous le Java 25 des Android Studio récents. `android/gradle/gradle-daemon-jvm.properties` (`toolchainVersion=21`) le demande au démon Gradle ; `JAVA_HOME` doit tout de même pointer vers un JDK 21 pour lancer `gradlew`.
- **SDK Android 36** (`compileSdkVersion` et `targetSdkVersion` dans `android/variables.gradle`), application installable dès Android 7 (`minSdkVersion` 24, WebView 111 au moins : `android.minWebViewVersion` de `capacitor.config.ts`, la cible de construction de Vite). Dire où est le SDK : `ANDROID_HOME`, ou `sdk.dir=…` dans `android/local.properties` (fichier de la machine, ignoré par git).

## Vérifier

```
npm run verif                     lint (sans avertissement toléré), tous les tests dans un ordre mélangé, build
node outils/verif.mjs --rapide    typecheck, lint, tests des fichiers modifiés
npm run dev                       serveur de développement
npx tsc -b                        typecheck incrémental (strict, noUnusedLocals, verbatimModuleSyntax) ; --force pour tout revérifier
npm run lint                      oxlint, bloquant (--deny-warnings : un avertissement fait échouer)
npx vitest run --changed          tests qui importent, même de loin, un fichier modifié non commité
npx vitest run                    tous les tests, fonctions pures uniquement, environnement node
npx vitest run src/sailing/wind.test.ts -t "nom"   un fichier, un test
npm run build                     tsc -b && vite build
```

`npm run verif` vérifie aussi les renvois des documents (`outils/docs-cites.mjs`, `outils/docs-inventaire.mjs`) : un fichier cité qui n'existe plus fait échouer. La même commande tourne à chaque envoi vers `main` (`.github/workflows/verif.yml`), suivie de `npx cap sync android` puis du test JUnit du format `.imu` (`./gradlew testDebugUnitTest`). Ce test ne fait pas partie de `npm run verif` en local.

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

## Ce qu'un changement casse

- **`appId`** (`io.github.segneur.gtracker`, dans `capacitor.config.ts` et `android/app/build.gradle`) : Android y voit une autre application, installée à côté de la première, sans ses données.
- **La clé de signature** : Android refuse la mise à jour d'une application signée par une autre clé ; il faut la désinstaller, ce qui efface les données de l'application (réglages de l'appareil ; les sessions, dans le dossier mémoire hors de l'application, restent mais il faut le désigner de nouveau). Garder le `.jks` et ses mots de passe.
- **`versionCode`** : il doit croître à chaque APK, sinon Android refuse la mise à jour. Il vaut majeure × 1 000 000 + mineure × 1 000 + correctif + 1 (0.00.00 → 1), le + 1 parce qu'Android exige un code d'au moins 1.

## Où ajouter quoi

Les recettes des ajouts les plus rares ; chemins relatifs à `src/`.

- Nouveau calcul de support : son identifiant dans `SportType` (`core/types.ts`), une entrée de `SPORT_PROFILES` avec sa famille et tous ses seuils (`core/sportProfiles.ts`), sa couleur (`BASE_COLOR`, `core/activities.ts`) et son logo (`BASE_LOGO`, `core/activityLogos.ts`) ; le module, les onglets et les chiffres du direct viennent de sa famille, sauts, pumping et vagues des capacités de son profil. `core/sportProfiles.test.ts` vérifie qu'il est complet. Une activité (moth, paddle, SUP foil…) n'est jamais en dur : l'utilisateur la crée dans Réglages sur un calcul (`core/activities.ts`).
- Réglage utilisateur : un champ de `StoredSettings` (`settings/activitySettings.ts`), rangé par identifiant d'activité (`PER_ACTIVITY_KEYS`), écrit par une règle de `SETTING_FIELDS`, lu par son `resolve*` et `settingsView`, montré dans `pages/SettingsPage.tsx` ; son défaut par `default*Of`, qui lit le pré-réglage (`settings/activityPresets.ts`, `presetOf`) puis le profil du calcul. Le magasin et `useAllSportSettings` sont dans `hooks/useSportSettings.ts`.
- Page d'analyse : une seule par famille (`/voile/analyse`, `/surf/analyse`) ; un calcul neuf n'en crée pas. Suivre `docs/MISE_EN_PAGE.md` ; ce qui devient commun aux deux modules va dans une pièce partagée (`components/`), pas dans une copie.
- Section de module : une entrée dans `SAILING_TABS` ou `SURF_TABS` (`core/analysisTabs.ts`, défauts déduits par `tabDefaults`) ; si elle dépend d'une capacité du calcul, son filtre dans `analysisTabs`/`activityTabs` ; puis un bloc `{open.cle && ...}` dans un `ResizablePanel` d'`id` unique (l'`id` est la clé de la taille mémorisée : ne pas le renommer). Un onglet repris d'un autre module porte `generic` et sa pièce est partagée (`TopsPanel`). En voile : une seule barre d'onglets, dans la colonne de la carte.
- Métrique de manœuvre : `ManeuverLocation` (`sailing/maneuvers.ts`), puis `MANEUVER_METRICS` et `summarizeManeuvers` (`sailing/sailingAnalytics.ts`).
- Calcul de glisse neuf (vol, vague, run de downwind…) : pur, dans le dossier de sa famille (`sailing/` ou `surfing/`), seuils dans le profil (`SPORT_PROFILES`, passés en paramètre, surchargeables) ou son sous-profil (`surf`), en unités SI hors de `sailing/` (qui travaille en nœuds sur `PointData`), testé sur trace synthétique à 1 Hz et 5 Hz (fenêtres en secondes : même résultat aux deux cadences) ; s'il change un chiffre du résumé, `SUMMARY_CALC_VERSION` augmente et `library/summaryFrozen.test.ts` est refigé en le disant.
