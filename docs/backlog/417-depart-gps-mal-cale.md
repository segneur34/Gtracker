# 417 · Départ d'un enregistrement : les premières positions mal calées

## Demande (16/11)

« Il y a encore eu dernièrement des gros écarts de position et du coup des pics de vitesse au lancement du GPS. Je ne sais pas si c'est le cas avec le nouveau greffon. » Piste de l'utilisateur : « faire comme ce que fait Google, une espèce de grosse zone dans laquelle le GPS est, la réduire, et du coup donner une position précise qu'à partir du troisième ou du quatrième ping. Ça fait trois ou quatre secondes, mais en attendant on voit que le GPS est en train de se caler, et ça éviterait des pics de vitesse dommageables. »

## Ce qu'on sait

- Les pics ont été vus sur une vieille version de l'autre application de l'utilisateur, d'avant le service de position à nous, pas ici. Pas de fichier sous la main.
- Forme du défaut : la vitesse part de 44 km/h et redescend en trois ou quatre positions (trois ou quatre secondes) jusqu'à l'allure réelle, 9 ou 10 km/h. La vitesse maximale et les statistiques en sortent faussées.
- Dans ce dépôt, chaque position arrive avec son incertitude en mètres, écrite dans le journal et dans la fiche ; rien ne s'en sert pour retenir ou écarter les premières positions.

## Premier geste, avant toute correction

Dire si le défaut peut arriver ici, par une trace synthétique : premières positions qui convergent de quelques dizaines de mètres vers la vraie, incertitude large qui se resserre, puis déplacement régulier à 2,7 m/s. Regarder ce que deviennent la vitesse (lue du GPS ou calculée des positions ?), la vitesse maximale, la distance et le trait sur la carte, à l'enregistrement comme à l'analyse de la session rangée. Le rapport le dit en clair, chiffres à l'appui.

## Si le défaut apparaît

1. Tant que le GPS se cale, la trace ne commence pas : les positions reçues ne comptent ni dans la trace, ni dans la distance, ni dans la vitesse.
2. Pendant ce temps, la page Enregistrer montre que le GPS se cale : un cercle d'incertitude qui rétrécit sur la carte, et un mot qui le dit.
3. La trace démarre à la première position jugée calée. Le critère est en secondes et en mètres, jamais en nombre de positions (règles 2 et 10 de `CLAUDE.md` : la cadence varie).
4. La trace synthétique du premier geste devient le test : plus de pic, vitesse maximale et distance justes.

## Tranché par l'orchestrateur (questions mineures)

- Le critère de calage est une constante d'algorithme nommée et commentée, commune à tous les supports (règle 3), pas un réglage de l'utilisateur.
- Un GPS qui ne se cale jamais ne bloque pas l'enregistrement indéfiniment : passé un délai, la trace démarre quand même, avec ce qu'on a.
- Le calage ne vaut qu'au départ : après une première position retenue, rien ne change (la relance du GPS muet et la reprise après « GPS perdu » ne sont pas touchées).

## À dire dans le plan

- Où filtrer : dans le service Java, côté page, ou les deux (application fermée, la page n'est pas là).
- Si l'analyse d'une session déjà enregistrée, ou venue d'un fichier, doit écarter de même un départ mal calé : question à poser à l'utilisateur si la réponse change des chiffres de sessions existantes (`SUMMARY_CALC_VERSION`).

## Diagnostic (agent Plan, 16/11, lecture du code)

Le défaut peut arriver ici, mais seulement sur des positions sans vitesse du GPS.
- Direct et analyse suivent la même chaîne : `computeLiveStats` (`src/recording/liveStats.ts`) appelle `resumeKinematics` ; distance = vitesse retenue × dt (`src/core/sessionStats.ts`). Ni le service (`RecordingService.onLocation`) ni la page (`receiveFix`, `src/hooks/recorder/live.ts`) ne filtrent autre chose que les redélivrances.
- Avec la vitesse du GPS sur chaque position (cas normal du service) : vitesse, vitesse maximale et distance ne voient pas le saut de position. Restent un trait droit de quelques dizaines de mètres au départ de la carte et un cap faux sur les premiers pas.
- Sans vitesse du GPS sur les premières positions (`hasSpeed` faux au premier calage, navigateur, fichier sans vitesse) : la vitesse est calculée des positions, et l'écrêtage en place (`speedFilter.ts`, amorce sur la médiane des 10 premières secondes, écart toléré de 10 m/s) laisse passer un pic de 12 m/s qui redescend à 3 m/s² : vitesse maximale vers 10 m/s au lieu de 2,7, une vingtaine de mètres en trop.

Trace synthétique : déplacement régulier à 2,7 m/s ; positions des secondes 0 à 4 décalées vers l'arrière de 22, 12,5, 6, 2 et 0 m ; incertitudes 30, 20, 12, 6 et 4 m ; à 1 Hz et à 5 Hz ; avec et sans vitesse du GPS.

## Plan de la correction

Le filtre est côté TypeScript, pas dans le service : le journal du service reste brut, ni le Java ni le format du journal ne changent. Le même juge pur sert à la réception et au rattrapage, ce qui couvre l'application fermée pendant le calage.

Partie A (le calcul) :
1. Créer `src/recording/gpsSettle.ts` : constantes nommées et commentées `SETTLED_ACCURACY_M = 10` (première position dont l'incertitude est de 10 m au plus) et `SETTLE_MAX_WAIT_S = 10` (délai depuis la première position reçue, au bout duquel la trace démarre quand même), et le juge `judgeSettle(firstSeenMs, fix)`, qui ne regarde que l'heure et l'incertitude, jamais un nombre de positions. Une position sans incertitude est jugée calée (rejeu du banc et fichiers restent neutres). Il ne joue que tant qu'aucune position n'est gardée. `gpsSettle.test.ts` : 1 Hz et 5 Hz, sans incertitude, délai atteint, rien ne change après la première position gardée.
2. `src/hooks/recorder/store.ts` : `session.settleFirstMs`, `session.settlingFix` ; dans l'état, `settlingAccuracyM: number | null`.
3. `src/hooks/recorder/live.ts`, `receiveFix` : le juge passe juste après `fixListeners.notify` (notification, guidage et boussole voient toujours la position), avant `evaluateAutoPause` et `keepPoint`. Une position pas encore calée ne sert qu'à la carte, comme `pauseFixes` : pas de journal de la page, pas de statistiques, pas de pause automatique, pas de fréquence cardiaque. `resetSession` remet tout à zéro. `useRecorder.ts` : `getLivePosition` montre la position en cours de calage (`shownLiveFix`, `src/recording/livePosition.ts`).
4. `src/recording/nativeLog.ts`, `catchUpFromNativeLog` : le même juge quand `lastMs === null`, ancré sur la première position du journal du service.
Tests de la partie A : la trace synthétique ci-dessus, d'abord en « avant » (elle montre le pic sans vitesse du GPS), puis en « après » (plus de pic, vitesse maximale et distance justes, trace qui part de la position calée) ; `useRecorder.test.ts`, `useRecorder.resume.test.ts` (application fermée pendant le calage), `nativeLog.test.ts`. Commentaire de tête de `src/recording/session.ts` (« rien n'est filtré ») mis à jour.

Partie B (ce qu'on voit) :
5. `src/components/LiveMap.tsx` : prop `accuracyM`, dessinée par le `Circle` existant (`src/components/map/paths.tsx`, rayon en mètres, déjà employé pour la balise visée) ; style en constante stable, comme `TARGET_CIRCLE_STYLE` (règle 11).
6. `src/pages/RecordingPage.tsx` : `RecordingMap` passe l'incertitude ; `GpsRescue` remplace son texte d'attente par « le GPS se cale (± {m} m) », à la même place, sans rien déplacer. `src/recording/recordingRetry.ts`, `gpsRetryOffer` : entrée `settling`, attente écrite, sans « Réessayer » puisqu'une position est venue ; `recordingRetry.test.ts`.
7. Textes par `t`, `en.json` et `es.json`.

Tranché par l'orchestrateur sur les questions du plan :
- seuil de 10 m sans exiger qu'il tienne dans le temps ; délai ramené à 10 s (le plan proposait 20 s) : l'utilisateur parle de trois ou quatre secondes d'attente, et une trace amputée de 20 s serait pire que le mal ;
- la durée affichée part de la première position calée ;
- un repère « Note » posé pendant le calage prend la dernière position reçue ;
- l'analyse des sessions déjà rangées ou venues d'un fichier n'est pas touchée par ce lot, et l'incertitude n'est pas écrite dans le GPX : ce serait changer les chiffres de sessions existantes, à décider par l'utilisateur dans un lot à part.

À la passe de documentation, après validation : `docs/DECISIONS.md` §6 dit « sans autre filtre que les redélivrances et la pause » ; le calage en ajoute un, à la demande de l'utilisateur. Le lot n'y touche pas.

## Contraintes

- `docs/DECISIONS.md` §6 (enregistrement) à lire avant ; unités SI dans `src/core/` et `src/recording/`.
- Texte visible par `t`, trois langues ; aucun style en ligne neuf.
- La page Enregistrer sera redessinée par un lot à venir : ne rien y déplacer, ajouter au plus près de l'existant.

## Résultat attendu

Plus aucun pic de vitesse au départ d'un enregistrement, vitesse maximale et distance justes, et l'attente du calage se voit à l'écran.

## Tel que noté, 16/11 à 18 h 19 (même sujet)

« Quand on allume le GPS après un long moment sans pause, même si on bouge pas, le GPS met un temps à se caler, à vue de nez cinq secondes. Normalement on est censé avoir la zone qui se restreint progressivement et qui nous pose. Je ne vois pas la zone, mais le GPS se déplace alors qu'il n'y a pas de raison qu'il se déplace. » À regarder à l'essai 284 : la position bouge-t-elle immobile pendant le calage, et le cercle est-il visible ?
