# 387 · Enregistrer : un bouton « Réessayer » pour la ceinture cardio et pour le GPS

Modèle | Réflexion : Opus | high (plan par l'agent Plan avant le code)

## Demande (15/11)

« crée un bouton retry quand le gps capte pas ou qu'il était pas mis avant le début de l'enregistrement, ce qui pourrait accélérer la reconnexion si l'utilisateur est actif, pareil sur le gps ».

Lecture de l'orchestrateur, dite à l'utilisateur : la première moitié parle de la ceinture cardio (« pas mise avant le début de l'enregistrement »), la seconde du GPS ; les deux sont donc à couvrir.

## Réponses de l'utilisateur (15/11, après lecture de la fiche)

- Lecture confirmée : « c'était pour le GPS et pour le Bluetooth ».
- Le doute sur le GPS est levé par lui : « même s'il n'y a pas d'effet concret, faire en sorte que pour l'utilisateur, il ait l'impression d'accélérer la chose. Ça serait déjà un truc de gagné. » Le bouton « Réessayer » du GPS se fait donc dans tous les cas où l'application attend une position, avec un retour visible à l'appui (« nouvelle tentative… »). Tranché par l'orchestrateur : l'appui fait une vraie relance quand elle est sûre (redemander les positions sans arrêter le service ni l'enregistrement), jamais un geste qui risque la trace ou la notification ; là où aucune relance sûre n'existe, il ne reste que le retour visible.
- Ajout : « mettre un petit bouton annuler la recherche pour le Bluetooth, si ça ne marche pas et on abandonne. Plutôt que d'avoir un cadre rouge qui dure toute la trace et qui est un peu moche, s'il n'y a pas moyen de reconnecter. » À côté de « Réessayer », un bouton qui abandonne la ceinture pour cet enregistrement : la recherche s'arrête, le cadre rouge disparaît, l'enregistrement continue sans cardio. `RecordingPage.tsx` dit déjà qu'on peut renoncer à la ceinture (avant le départ et pendant) : partir de ce qui existe, le rendre visible et clair dans l'état d'alerte, et vérifier que renoncer retire bien le cadre rouge et fait taire l'alerte sonore de fréquence cardiaque perdue. À dire dans le plan : peut-on revenir en arrière (reprendre la ceinture plus tard dans le même enregistrement) ; sinon le libellé doit le dire.

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
