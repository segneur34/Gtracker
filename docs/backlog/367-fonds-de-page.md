# 367 · Fonds de page : des propositions, puis le fond retenu

Modèle | Réflexion : Sonnet | high. Maquette d'abord : aucun code de l'application avant le choix de l'utilisateur.

## Demande de l'utilisateur (13/11 au soir)

« Il faut rajouter des fonds à l'écran, le blanc c'est pas fou. Fais-moi des propositions : avec les anciens ; avec des champs de pointillés, un peu comme champ de vent, comme sur Windy (fais une recherche d'images si besoin) ; propose des variations aussi. »

Cela revient sur `docs/DECISIONS.md` §11, « Fonds de page (planche A, 12/11) : unis, sans motif dessiné ni courbes de niveau, sans image », et répond à la partie « fonds » de la question Q112.

## Temps 1 : la planche

Dans `D:\gong tracker\atelier\maquette-fonds-1311\`, une planche (`planche-fonds.html` et `planche-fonds.png`) qui montre chaque proposition sur un écran de téléphone, en clair et en sombre, derrière une vraie page (le Profil, et la page Sessions pour au moins deux propositions) :

- les anciens fonds, tels qu'ils étaient avant la planche A du 12/11 (courbes de niveau, à retrouver dans l'historique git) ;
- un champ de petits traits orientés par un écoulement, comme un champ de vent ;
- des variations : points plutôt que traits, traînées qui s'estompent, densité, à l'encre ou à la couleur de l'activité favorite, plus dense vers le bas de la page.

Les cadres au pinceau restent lisibles, aucun texte ne perd son contraste.

## Temps 2 : le lot

À écrire après le choix : le fond retenu, par les variables de `src/theme/tokens.css`, sur les pages que l'utilisateur dira ; le mode économe le retire ; DECISIONS §11 réécrite.
