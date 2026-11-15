# 403 · L'enregistrement survit à la fermeture de l'application

Modèle | Réflexion : Fable | high

## Origine

Revue globale du 15/11 (auditeur « Android », relu par l'orchestrateur dans le code du greffon). Confirmé par l'utilisateur le même jour : « si je ferme complètement l'application, la notification disparaît ». Lire `docs/DECISIONS.md` §6 et le §12 d'ETAT avant de commencer.

## Constat

Balayer l'application hors des « récentes » pendant un enregistrement détruit l'activité ; le greffon de position coupe alors lui-même son service (`node_modules/@capgo/background-geolocation/.../BackgroundGeolocation.java`, `handleOnDestroy` : arrêt sauf en « livraison native », mode qui exige une adresse d'envoi ; `BackgroundGeolocationService.java` : `onTaskRemoved`, `START_NOT_STICKY` hors de ce mode, avec le commentaire « the service does not outlive the app »). La ceinture, les capteurs et la veille « GPS perdu » sont lâchés par la même chaîne (`HeartRatePlugin.java:548-563`, `MotionPlugin.java:306-313`, `BeeperPlugin.java:263-274`). Le journal garde ce qui précède et propose « Continuer » à la réouverture ; toute la suite de la sortie est perdue, sans alerte.

Plus largement : toute la trace passe par la page (les positions arrivent à la WebView, c'est elle qui écrit le journal). Une chute du moteur de rendu perd les positions reçues pendant la recharge (`MainActivity.java:86-105`, `src/platform/location.ts:311-346`), et le choix impose l'ancien pont (`useLegacyBridge`) et trois couplages aux détails internes du greffon (constantes de notification, nom de classe du service : `RecoveryPlugin.java:25`).

## Plan (agent `Plan`, 15/11, relu par l'orchestrateur)

Trois questions à l'utilisateur restent ouvertes en fin de plan : ne pas commencer le Java avant ses réponses.

### Décision : un service de position à nous

Le journal natif du greffon existe (`locationLog: true`, une ligne par position dans `noBackupFilesDir`, relu par `getLocationLog(afterId)`), mais il s'arrête avec le service au balayage. Le greffon ne survit à l'activité qu'en « livraison native », qui exige une adresse d'envoi (`LocationStore.java:97-99`, `BackgroundGeolocation.java:1029-1034`, `BackgroundGeolocationService.java:118-123, 141`) : une adresse factice voudrait dire un envoi HTTP refusé à chaque position pendant des heures, et un service relancé seul sans destinataire, ce qui fausse la preuve de la reprise silencieuse (« service vivant, donc la page reçoit »).

| | Service à nous | Journal du greffon, sans adresse | Journal du greffon, adresse factice |
|---|---|---|---|
| Survit au balayage (attendu 1) | oui | non | oui, par contournement |
| Chute du moteur de rendu (attendu 3) | oui | oui | oui |
| Java | 750 à 950 lignes neuves | 0 | 0 à 30 |
| TypeScript | 450 à 600, plus 400 de tests | 120 | 300 |
| Durée, essais compris | 5 à 7 jours | 1 à 2 jours | 3 jours |
| Dépendance | aucune : retire le greffon, `play-services-location`, `work-runtime` | greffon tiers | comportement non documenté d'un tiers |
| Couplages aux détails internes du greffon | supprimés | gardés | gardés |

Retenu : le service à nous, seule voie qui tient l'attendu 1 sans contournement. Il n'écrit pas tout le journal : il tient un journal natif brut, une ligne par position reçue, et le journal de la page reste le registre des décisions (pauses, segments, activité, notes). Au retour, la page refait les positions manquantes par une fonction TypeScript pure et testée ; la logique de pause n'est pas portée en Java.

### Ce que devient chaque capacité quand l'application est balayée

- Ceinture cardio : coupée (le `BluetoothGatt` appartient à l'instance du greffon, `HeartRatePlugin.java`), donc trou de FC pendant la fermeture, conforme à « trou plutôt que valeur figée ». Elle revient seule à la réouverture par le code existant (`adoptBelt`, sinon `takeBeltOrWarn`, puis la veille « FC perdue », `hooks/recorder/recovery.ts`). La migrer dans le service est hors lot : 300 à 500 lignes de refonte, et un second type de service à déclarer.
- Capteurs (sauts, pumping) : capture fermée, trou pendant la fermeture ; `continueCapture` complète le même `.imu` à la réouverture. Migration hors lot : 150 à 250 lignes.
- « GPS perdu » : une veille native dans le service, active seulement quand la page est absente, mêmes délais que la page (1 min, réarmée après 2 min de positions, rien en pause manuelle), son `TonePlayer.playGpsLost()` et « GPS perdu » au titre de la notification. Environ 80 lignes.
- Bips de balise et alerte « FC perdue » : tus pendant la fermeture.

### Garde contre un enregistrement jamais repris

Dans le service, seulement quand la page est absente : arrêt si le téléphone s'est éloigné de moins de 200 m pendant 1 h, ou 12 h après la fermeture. Constantes communes à tous les supports, dans `RecordingProfile` (`core/sportProfiles.ts`), passées au départ. À l'arrêt par la garde : une ligne d'arrêt dans le journal natif, GPS et notification permanente coupés, une notification simple « Enregistrement arrêté : touchez pour le ranger ». À la réouverture, la session passe en attente et se range, trace entière jusqu'à l'arrêt. Pas de bouton « Arrêter » dans la notification : il contournerait l'appui tenu de DECISIONS §6.

### Android et Google Play

- Manifeste : `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE_LOCATION` et le service de type `location` ne viennent aujourd'hui que du manifeste du greffon ; les déclarer dans le nôtre avec `<service android:name=".RecordingService" android:exported="false" android:foregroundServiceType="location"/>`. Aucune `ACCESS_BACKGROUND_LOCATION` : le service démarre toujours depuis la page visible (Démarrer, Continuer).
- Pas de relance automatique : depuis Android 14, créer un service de type position depuis l'arrière-plan lève une `SecurityException` sans la position « toujours autoriser » (documentation Android, « Foreground service types »). Le service rend donc `START_NOT_STICKY` ; s'il meurt avec le processus, le journal natif garde tout ce qui précède et la réouverture propose « Continuer ». Chaque ligne est écrite aussitôt (elle survit à la mort du processus), le `fsync` toutes les 10 s ne couvrant que l'extinction.
- Play Console (lot 308) : déclaration du type de service au premier plan « position » dans « Contenu de l'application », avec description, effet d'une interruption et lien vers une vidéo de démonstration. Pas de formulaire de position en arrière-plan.

### Reprise à la réouverture

Le service tient son état (en cours, identifiant de session = `startedAtMs` de l'en-tête du journal, pause manuelle) et le rend par `state()`, qui remplace la liste des services de `RecoveryPlugin`. Service vivant et identifiant accordé : `restoreFromJournal`, puis dans cet ordre brancher l'écoute en tampon, lire le journal natif après la dernière position du journal, refaire ces positions par la fonction pure (rien gardé en pause manuelle ouverte, pause automatique sur l'heure des positions, aucune coupure de segment si le journal natif est continu), les ajouter au journal, vider le tampon par `isNewerFix`. Service mort : même rattrapage avant « Continuer » et avant la session en attente. Arrêt normal : même rattrapage avant le GPX, la trace reste entière même si les messages vers la page ont calé écran éteint.

### Fichiers

À créer, dans `android/app/src/main/java/io/github/segneur/gtracker/` : `RecordingService.java` (service, `LocationManager`, verrou de veille, notification, veille GPS, garde), `FixLog.java` (journal natif `recording-fixes.jsonl`, en-tête de session, lignes brutes), `RecordingPlugin.java` (`start`, `stop`, `state`, `setPaused`, `readLog`, `clearLog`, `currentPosition`, permissions, événements `fix` et `error`), veille GPS et garde en classes pures testées en JUnit. Côté TypeScript : `src/recording/nativeLog.ts` et son test.

À modifier : `src/platform/location.ts` (source native par notre greffon, retrait de `adoptRunningService`, `readLoggedFixes(afterMs)`), `src/platform/permissions.ts`, `src/platform/recovery.ts`, `src/platform/notification.ts`, `src/hooks/recorder/recovery.ts` (`resumeSilently`, `recoverOnce`), `src/hooks/useRecorder.ts` (rattrapage à `stopRecording`, `setPaused`, `continuePendingSession`), `src/hooks/recorder/live.ts` (rejouer une position sans `Date.now()`), `src/core/sportProfiles.ts` (constantes de la garde), `RecordingNotificationPlugin.java` (même numéro et même canal, pour garder les réglages d'écran verrouillé ; son commentaire « pause manuelle (service arrêté) » est faux depuis le 31/10), `MainActivity.java`, `RecoveryPlugin.java` (retiré ou réduit), `AndroidManifest.xml`, `res/values/strings.xml`, locales `en.json` et `es.json`. Retrait du greffon : `package.json`, `public/licences-hors-js.json`, `outils/licences-hors-js.mjs`, `outils/banc/apropos.mjs`, `src/core/licenses.test.ts`. L'ancien pont est gardé pour l'instant.

À réutiliser : `parseJournal`, `journalFixLine`, `journalBreakLine`, `roundFix`, `evaluateAutoPause`, `isNewerFix`, `rebuildRecordingStats`, `resumedPhase`, `continuedPause`, `recoveryDecision`, `takeBeltOrWarn`, `watchResumedBelt`, `continueCapture`, `TonePlayer.playGpsLost`, et le modèle JUnit `ImuFormatTest.java`.

### Étapes, chacune vérifiable seule

1. `nativeLog.ts` et la fusion pure, avec leurs tests (vitest seul).
2. Java : service, journal natif, greffon, manifeste (build Gradle, JUnit, `androidManifest.test` et `nativeConstants.test` réécrits sur nos classes).
3. `platform/` branché sur le greffon, retrait du contournement par `fromNative` (`location.test.ts` adapté, banc navigateur neutre).
4. Enregistreur : reprise, « Continuer », arrêt, `setPaused` (`useRecorder.resume.test.ts`, `useRecorder.test.ts`).
5. Veille GPS détachée, garde, textes de notification (JUnit des machines d'état).
6. Retrait de `@capgo/background-geolocation` et de ses licences (`npm run verif`).
7. Banc avant/après (`session-save-resume`, `gps-perdu`, `notification`, `carte-direct`) : texte identique. Puis APK et essais 277 à 279.

### Tests

Sur trace synthétique à 1 Hz et 5 Hz : une trace reçue d'un bout à l'autre donne les mêmes positions, segments et statistiques qu'un préfixe du journal plus le rattrapage ; coupure en pause manuelle ouverte ; pause automatique à cheval sur la coupure ; une seule position couvrant 40 s ; journal natif absent ou d'une autre session (coupure de segment comme aujourd'hui) ; dernière ligne tronquée ; doublons ; rattrapage joué deux fois égal à une fois ; arrêt par la garde ; position arrivée pendant la lecture du journal natif ni perdue ni doublée ; rattrapage à l'arrêt avant le GPX. Hors de portée des tests : cycle de vie du service, balayage, mort du processus chez le fabricant, Bluetooth.

### Décisions de l'utilisateur (15/11 : « ok pour 3 décisions »)

1. Le service maison remplace `@capgo/background-geolocation` ; la ligne de DECISIONS §6 (« Positions par… ; repli sur Capawesome ») sera réécrite à la passe de documentation du lot.
2. Pendant la fermeture, pas de FC, ni sauts, ni pumping, ni bips de balise, ni alerte « FC perdue » : accepté dans ce lot ; tout revient seul à la réouverture, « GPS perdu » reste prévenu, la notification dit « application fermée ».
3. Garde : arrêt seul, application fermée, après 1 h sans s'éloigner de 200 m, ou 12 h après la fermeture ; session rangée à la réouverture ; pas de bouton « Arrêter » dans la notification.

Essais 277 à 279 remis à plus tard (pluie, 15/11) : les parties suivantes se codent en les tenant pour bons.

### Découpage en parties (un agent `lot` neuf et un commit par partie)

- Partie A : étape 1, plus les constantes de la garde dans `core/sportProfiles.ts`. Elle fixe le format du journal natif, que la partie B écrit.
- Partie B : étapes 2 et 5, tout le Java (service, journal natif, greffon, manifeste, veille GPS, garde, JUnit), le greffon tiers restant en service.
- Partie C : étapes 3, 4 et 6 (`platform/`, enregistreur, retrait du greffon tiers).
- Puis le banc, l'APK et les essais.

### Non vérifié

Le comportement de HyperOS au balayage avec un service au premier plan (essai 277, démarrage automatique et batterie « Aucune restriction » réglés) ; si l'ancien pont reste nécessaire sans le greffon ; le formulaire exact de la Play Console.

## Attendu

1. Balayer l'application pendant un enregistrement ne l'arrête plus : la notification reste, les positions continuent d'être gardées, la réouverture reprend la sortie sans trou de plus de `maxGapS`.
2. « Arrêter » depuis l'application arrête tout, comme aujourd'hui ; aucune notification orpheline ; un enregistrement jamais repris ne tourne pas indéfiniment (garde à écrire dans le plan).
3. Une chute du moteur de rendu ne perd plus de positions.
4. Navigateur : rien ne change (`isNativeApp()`, règle 12).
5. `nativeConstants.test.ts` et `androidManifest.test.ts` suivent ; la revue du manifeste de la livraison (308) cite le service.

## Essais au téléphone (les seuls juges)

Voir les sous-lignes de l'élément dans `docs/BACKLOG.md` : balayage en cours d'enregistrement (277), écran éteint longtemps puis arrêt (278), retour de la ceinture après un balayage (279). Le plan les garde tels quels, sauf le 277, à finir par « Arrêter » pour juger la session rangée entière et l'absence de notification orpheline.
