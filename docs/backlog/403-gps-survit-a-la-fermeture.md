# 403 · L'enregistrement survit à la fermeture de l'application

Modèle | Réflexion : Fable | high

## Origine

Revue globale du 15/11 (auditeur « Android », relu par l'orchestrateur dans le code du greffon). Confirmé par l'utilisateur le même jour : « si je ferme complètement l'application, la notification disparaît ». Lire `docs/DECISIONS.md` §6 et le §12 d'ETAT avant de commencer.

## Constat

Balayer l'application hors des « récentes » pendant un enregistrement détruit l'activité ; le greffon de position coupe alors lui-même son service (`node_modules/@capgo/background-geolocation/.../BackgroundGeolocation.java`, `handleOnDestroy` : arrêt sauf en « livraison native », mode qui exige une adresse d'envoi ; `BackgroundGeolocationService.java` : `onTaskRemoved`, `START_NOT_STICKY` hors de ce mode, avec le commentaire « the service does not outlive the app »). La ceinture, les capteurs et la veille « GPS perdu » sont lâchés par la même chaîne (`HeartRatePlugin.java:548-563`, `MotionPlugin.java:306-313`, `BeeperPlugin.java:263-274`). Le journal garde ce qui précède et propose « Continuer » à la réouverture ; toute la suite de la sortie est perdue, sans alerte.

Plus largement : toute la trace passe par la page (les positions arrivent à la WebView, c'est elle qui écrit le journal). Une chute du moteur de rendu perd les positions reçues pendant la recharge (`MainActivity.java:86-105`, `src/platform/location.ts:311-346`), et le choix impose l'ancien pont (`useLegacyBridge`) et trois couplages aux détails internes du greffon (constantes de notification, nom de classe du service : `RecoveryPlugin.java:25`).

## Décision à confirmer par le plan

Recommandation de l'orchestrateur : un service de position à nous (Java, service au premier plan de type position, `LocationManager`, notification fondue avec celle de `RecordingNotificationPlugin`), qui écrit lui-même les positions dans un journal natif et ne s'arrête pas avec l'activité tant qu'un enregistrement tourne ; à la réouverture, la page relit ce journal et reprend la sortie sans trou. Estimation de l'auditeur : 600 à 900 lignes, de l'ordre d'une semaine avec les essais. Il retire le greffon tiers (et `play-services-location`, `work-runtime` qu'il tire) et peut-être l'ancien pont.

Variante plus légère, à chiffrer dans le plan : garder le greffon et activer son journal natif (`locationLog`, `getLocationLog(afterId)`), ce qui comble le trou d'une recharge de la page mais ne fait pas survivre le service au balayage.

Le plan (agent `Plan`) tranche entre les deux avec leurs coûts, et pose une question majeure à l'utilisateur s'il trouve un obstacle (ceinture cardio et capteurs, qui vivent aussi dans des greffons liés à l'activité ; bips « GPS perdu » ; règles de Google Play sur le service au premier plan). Ce que devient la ceinture cardio quand l'application est balayée fait partie du plan : au minimum, la trace GPS continue et la ceinture revient à la réouverture.

## Attendu

1. Balayer l'application pendant un enregistrement ne l'arrête plus : la notification reste, les positions continuent d'être gardées, la réouverture reprend la sortie sans trou de plus de `maxGapS`.
2. « Arrêter » depuis l'application arrête tout, comme aujourd'hui ; aucune notification orpheline ; un enregistrement jamais repris ne tourne pas indéfiniment (garde à écrire dans le plan).
3. Une chute du moteur de rendu ne perd plus de positions.
4. Navigateur : rien ne change (`isNativeApp()`, règle 12).
5. `nativeConstants.test.ts` et `androidManifest.test.ts` suivent ; la revue du manifeste de la livraison (308) cite le service.

## Essais au téléphone (les seuls juges)

Voir les sous-lignes de l'élément dans `docs/BACKLOG.md` : balayage en cours d'enregistrement, écran éteint longtemps puis réouverture, arrêt normal.
