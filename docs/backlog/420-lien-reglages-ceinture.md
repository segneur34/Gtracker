# 420 · Enregistrer › ceinture cardio : le lien « Réglages » arrive sur le bloc « Capteurs »

## Tel que dit par l'utilisateur (note du 13/11)

« Quand je veux utiliser la ceinture cardio mais qu'aucune est enregistrée et que je clique sur le bouton réglage depuis enregistrer ça doit m'amener directement au bouton ajouter un capteur, ce n'est pas le cas actuellement, ça m'amène pour le moment directement à paramètres. »

## Constat (vérifié dans le code le 16/11, à revérifier)

Sur la page Enregistrer (`src/pages/RecordingPage.tsx`), sans ceinture enregistrée, la phrase « Aucune ceinture choisie : Réglages, bloc « Capteurs ». » porte un lien qui ouvre la page Réglages tout en haut, sans rien désigner. Le bouton « Ajouter » est dans le bloc « Capteurs », partie « Ceintures et montres » (`HeartRateBeltSettings`), replié au départ.

## Voulu

- Le lien arrive sur la page Réglages avec le bloc « Capteurs » ouvert et amené à l'écran, le bouton « Ajouter » de « Ceintures et montres » visible sans avoir à chercher.
- Le retour d'Android (et le retour du navigateur) ramène à la page Enregistrer, comme aujourd'hui.
- Rien d'autre ne change dans Réglages : ouvert par un autre chemin, ses blocs gardent leur état de départ.

## Contraintes

- Chercher d'abord si Réglages sait déjà s'ouvrir sur un bloc désigné (un autre lien de l'application le fait peut-être : le reprendre) ; sinon le plus simple, par l'adresse (ancre ou paramètre), sans état global neuf. Navigation : `docs/DECISIONS.md` §11, `core/navigation.ts`.
- Aucun texte visible neuf attendu ; s'il en faut un, par `t` et dans les trois langues.
- Un test là où la logique est pure (lecture de la cible dans l'adresse).

## Banc

Texte des pages identique avant et après (Réglages ouvert par la barre de navigation ne change pas). Scripts qui ouvrent Réglages et Enregistrer.

## Essai au téléphone

Aucun de critique : le banc voit le bloc ouvert. Un coup d'œil suffit, à joindre à un autre essai de la page Enregistrer.
