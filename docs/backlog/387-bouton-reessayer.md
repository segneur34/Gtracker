# 387 · Enregistrer : un bouton « Réessayer » pour la ceinture cardio et pour le GPS

Modèle | Réflexion : Opus | high (plan par l'agent Plan avant le code)

## Demande (15/11)

« crée un bouton retry quand le gps capte pas ou qu'il était pas mis avant le début de l'enregistrement, ce qui pourrait accélérer la reconnexion si l'utilisateur est actif, pareil sur le gps ».

Lecture de l'orchestrateur, dite à l'utilisateur : la première moitié parle de la ceinture cardio (« pas mise avant le début de l'enregistrement »), la seconde du GPS ; les deux sont donc à couvrir.

## Réponses de l'utilisateur (15/11, après lecture de la fiche)

- Lecture confirmée : « c'était pour le GPS et pour le Bluetooth ».
- Le doute sur le GPS est levé par lui : « même s'il n'y a pas d'effet concret, faire en sorte que pour l'utilisateur, il ait l'impression d'accélérer la chose. Ça serait déjà un truc de gagné. » Le bouton « Réessayer » du GPS se fait donc dans tous les cas où l'application attend une position, avec un retour visible à l'appui (« nouvelle tentative… »). Tranché par l'orchestrateur : l'appui fait une vraie relance quand elle est sûre (redemander les positions sans arrêter le service ni l'enregistrement), jamais un geste qui risque la trace ou la notification ; là où aucune relance sûre n'existe, il ne reste que le retour visible.
- Ajout : « mettre un petit bouton annuler la recherche pour le Bluetooth, si ça ne marche pas et on abandonne. Plutôt que d'avoir un cadre rouge qui dure toute la trace et qui est un peu moche, s'il n'y a pas moyen de reconnecter. » À côté de « Réessayer », un bouton qui abandonne la ceinture pour cet enregistrement : la recherche s'arrête, le cadre rouge disparaît, l'enregistrement continue sans cardio. `RecordingPage.tsx` dit déjà qu'on peut renoncer à la ceinture (avant le départ et pendant) : partir de ce qui existe, le rendre visible et clair dans l'état d'alerte, et vérifier que renoncer retire bien le cadre rouge et fait taire l'alerte sonore de fréquence cardiaque perdue. À dire dans le plan : peut-on revenir en arrière (reprendre la ceinture plus tard dans le même enregistrement) ; sinon le libellé doit le dire.

## Plan retenu (agent Plan, 15/11) et choix de l'orchestrateur

Constats du plan (HRP = `android/app/src/main/java/io/github/segneur/gtracker/HeartRatePlugin.java`) :
- Ceinture jamais jointe : recherche de 5 s, ouverture directe qu'Android abandonne vers 30 s, puis nouvel essai 10 s plus tard pendant les 5 premières minutes, 30 s ensuite (HRP:713-716). Ceinture perdue : nouvelle recherche aussitôt, puis pauses de 10 s, de 30 s passé 5 min (HRP:497-500, 617-620). Un appui ne devance donc l'essai automatique que pendant ces pauses (10 à 30 s), jusqu'à 40 à 60 s pour une ceinture à adresse aléatoire au type pas encore appris.
- Ceinture injoignable au départ (Bluetooth éteint, permission refusée) : en cours d'enregistrement, `takeBeltOrWarn` (`src/hooks/recorder/watches.ts:150-156`) rend la ceinture et laisse le cadre « Ceinture cardio injoignable » ; plus aucun essai ensuite (HRP:741). Là, le bouton est le seul recours.
- Android refuse plus de 5 recherches par 30 s (HRP:686) : au moins 6 s entre deux recherches.
- « Arrêter de chercher » existe avec confirmation (`RecordingPage.tsx:480-489`, `stopRecordingBeltSearch`, `watches.ts:199-206`) : il rend la ceinture, désarme le minuteur natif (l'alerte sonore se tait), note l'abandon au journal et retire le message. Il manque : (a) dans l'état « connected » sans contact, où l'alerte de FC perdue part sans bouton ; (b) près du cadre rouge (`RecordingPage.tsx:974`), il n'est que dans la carte « En cours » ; (c) dans le cas injoignable, où la tuile est absente et le message rouge jamais retiré.
- GPS : le greffon n'offre que `start` et `stop`, et `stop` coupe le service et sa notification : aucun arrêt-relance n'est sûr. Le service redemande déjà seul les positions après 60 s sans position. Seule relance sûre : demander au téléphone de recharger ses données d'aide au GPS (`LocationManager.sendExtraCommand` : `force_time_injection`, puis `force_psds_injection`, ou `force_xtra_injection` sur les anciens Android), permission normale `ACCESS_LOCATION_EXTRA_COMMANDS` au manifeste, sans fenêtre de demande. Aucun moyen aujourd'hui d'ouvrir le réglage de localisation d'Android.

Choix de l'orchestrateur (15/11) :
- Renoncer à la ceinture devient réversible : après « Arrêter de chercher », une ligne « Reprendre la ceinture » reste dans la carte « En cours », et la confirmation disparaît (même code que la reprise du cas injoignable ; l'utilisateur veut un geste simple pour faire partir le cadre rouge, pas un geste définitif). Dit à l'utilisateur.
- Libellé du GPS : « Réessayer », puis « nouvelle tentative… » (il a demandé « un bouton retry », effet ressenti assumé).
- Jamais de commande qui efface les données d'aide du GPS (`delete_aiding_data`) : elle ferait repartir le téléphone de zéro.
- La permission ajoutée au manifeste est à citer dans la revue du manifeste de la livraison (lot 308).

Deux parties, chacune commitée seule :

### Partie A : ceinture
1. Java, `HeartRatePlugin.java` : méthode `retryNow`. Refus si la ceinture n'est pas demandée ou si le Bluetooth est éteint ; liée : rien ; recherche en cours : l'appel attend sa fin ; sinon fermer une ouverture sans réponse, retirer les relances armées, revenir au rythme rapide, respecter 6 s depuis la dernière recherche, puis chercher. L'appel rend `{seen}` à la fin de la recherche, `{seen:false}` au désarmement. Une ligne au journal.
2. `src/platform/heartRate.ts` : `retryBelt()`, une seule tentative à la fois (la même promesse tant qu'elle court) ; ceinture d'exemple : rendu immédiat.
3. Logique pure, `src/recording/recordingRetry.ts` : ce que la page propose selon l'état (réessayer, arrêter de chercher, reprendre). L'abandon est aussi proposé quand l'alerte de FC perdue est là (cas a) et dans le cas injoignable (cas c).
4. Enregistreur (`src/hooks/recorder/watches.ts`, `store.ts`) : garder la ceinture de la session et le dernier message d'échec ; `retakeRecordingBelt()` (reprise après un échec ou un abandon, message retiré) ; `stopRecordingBeltSearch` retire aussi le message du cas injoignable ; réexports dans `useRecorder.ts` et la liste de `couches.test.ts`.
5. Page, `src/pages/RecordingPage.tsx`, boutons `Button size="s"` : avant le départ, « Réessayer » aussi pendant la recherche ; pendant l'enregistrement, « Réessayer » et « Arrêter de chercher » juste sous le cadre rouge quand il porte la ceinture, et dans la carte « En cours » ; « Reprendre la ceinture » après un abandon ; pendant une tentative, bouton désactivé et « nouvelle tentative… ».
6. Traductions (`src/locales/en.json`, `es.json`) : « Réessayer » existe ; neufs : « nouvelle tentative… », « Reprendre la ceinture ».

### Partie B : GPS
1. Java, `GnssPlugin.java` : `refreshAssistance` ; permission au manifeste.
2. Java, `PermissionsPlugin.java` : `openLocationSettings` (réglage de localisation d'Android).
3. `src/platform/location.ts` et `permissions.ts` : les deux fonctions, sans effet dans le navigateur ; un indicateur « localisation coupée » dans l'état, au lieu de comparer le texte du message.
4. Logique pure, même module que la partie A : « Réessayer » quand aucune position n'est venue depuis le départ ou que l'alerte « GPS perdu » est là, hors pause manuelle ; « Activer la localisation » quand elle est coupée ; retour « nouvelle tentative… » pendant 5 s.
5. Page : les boutons sous le cadre rouge ou la ligne d'état.
6. Traductions : « Activer la localisation », « en attente de la première position ».

Tests purs : `recordingRetry.test.ts` (chaque état) ; `src/platform/heartRate.test.ts` (une seule tentative à la fois, greffon simulé) ; `src/hooks/useRecorder.test.ts` (l'abandon après FC perdue vide l'alerte et le message et désarme le minuteur ; la reprise après un échec retire le message). Banc : il ne simule ni le Bluetooth ni le GPS natif ; `cardio.mjs` et `notification.mjs` identiques ; `gps-perdu.mjs` (partie B) : « Réessayer » en plus dans l'état « GPS perdu ».

Relevés hors lot, à ne pas corriger ici : le message `SERVICE_BUSY` de `location.ts` conseille « mettez en pause, puis reprenez », ce qui ne relance le service que s'il est arrêté ; un commentaire de `RecordingNotificationPlugin.java` dit le service arrêté en pause manuelle, contre DECISIONS §6.

## Attendu

### Ceinture cardio

- Quand la ceinture choisie n'est pas connectée (cherchée, perdue, jamais trouvée parce qu'elle n'était pas portée au départ), avant le départ comme pendant l'enregistrement, un bouton « Réessayer » relance tout de suite une tentative de connexion, sans attendre le prochain essai automatique.
- L'enregistrement continue, rien n'est perdu ni coupé (trace, fichier de capteurs, notification) ; les essais automatiques continuent après.
- Un appui répété ne lance pas plusieurs tentatives à la fois ; l'état affiché dit qu'une tentative est en cours.
- À trouver d'abord : comment la connexion et la reconnexion marchent aujourd'hui (`src/platform/heartRate.ts`, le plugin Android sous `android/`, `src/hooks/recorder/`, `src/hooks/useBeltWarmup.ts`), à quel rythme les essais automatiques se suivent, et où `src/pages/RecordingPage.tsx` montre l'état de la ceinture (« on peut y renoncer »). Le bouton n'a de sens que si un essai manuel peut arriver plus tôt que l'essai automatique : le dire avec les délais relevés.

### GPS

- Doute de l'orchestrateur, à lever par le plan : relancer la demande de position n'accélère pas une première position quand le téléphone cherche encore ses satellites, et arrêter puis relancer le service d'arrière-plan pendant un enregistrement risque un trou ou la perte de la notification. Relever dans le code (`src/platform/location.ts`, service Android, `src/hooks/recorder/`) les cas où une relance aide vraiment : service en erreur ou arrêté, autorisation ou localisation coupée puis remise, aucune position depuis longtemps alors que le service tourne.
- Version attendue si ces cas existent : « Réessayer » visible seulement dans ces cas (« en attente du GPS » qui dure, erreur de position), qui redemande les positions sans arrêter l'enregistrement ; si la localisation du téléphone est coupée, le bouton mène au réglage du téléphone.
- Si le plan conclut qu'aucune relance n'est utile ou sûre pour le GPS, le dire : la question revient à l'utilisateur, la ceinture se fait sans attendre.

### Commun

- Tout passe par `src/platform/` (règle 12) ; libellés par `t()` avec leurs traductions anglaise et espagnole dans `src/locales/` (une clé sans traduction fait échouer la vérification) ; bouton d'action de l'application (`components/ui`), pas d'emoji ; DECISIONS §6 à lire.
- Logique pure testée (`*.test.ts`) ; banc : `gps-perdu.mjs`, `cardio.mjs`, `notification.mjs` à rejouer, texte attendu : le bouton en plus dans les états concernés.
- Essais au téléphone, peu : ceinture mise après le départ puis « Réessayer » ; GPS selon la version retenue.
