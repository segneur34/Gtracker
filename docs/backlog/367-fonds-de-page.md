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

## Choix de l'utilisateur (13/11 au soir, après trois planches)

- « J'aime beaucoup la D » : le champ en traînées qui s'estompent.
- Dans les cadres, le champ doit être « beaucoup plus transparent […] comme si c'était caché derrière […] les cadres » ; puis « 80 % de transparence dans les cadres ».
- « Il faudrait que le fond soit pas blanc mais plutôt blanc un petit peu cassé. »
- Les traînées ne sont pas à la couleur de l'activité : leur couleur varie, rouge près des tourbillons, verte puis bleue au large, « très doux », « un peu comme sur Windy » ; palette retenue : celle de la case C5 (dégradé de Windy).
- Dernier mot : « K7, avec les analyses où le derrière est transparent comme sur le profil » : couleur moyenne, un tiers de traînées en moins, et les panneaux des analyses voilés comme les cadres du Profil.

Référence à suivre à l'œil : la case K7 et les cases F1 à F3 de `D:\gong tracker\atelier\maquette-fonds-1311\planche-fonds-v3-2.png` et `-3.png` ; le champ et ses réglages sont dans `champ.mjs` et `planche3.mjs` du même dossier (réglage « FINAL »), les SVG dans `pieces\`.

## Temps 2 : le lot

Avant d'y toucher : `docs/DECISIONS.md` §11 (fonds de page, thème, économe), `docs/MISE_EN_PAGE.md`, et le bullet « DA » de `CLAUDE.md`.

1. Le fond clair des pages passe du blanc à un blanc cassé chaud (#f7f5f0 sur la planche), par la variable de fond de page de `src/theme/tokens.css` ; le sombre garde le sien. Vérifier ce qui se servait du blanc de page comme d'un blanc pur (cartes, champs, image de partage, vignettes) : l'image de partage et la carte ne changent pas.
2. Le champ K7, en clair et en sombre, devient une image de l'application (dans `src/assets/`), produite une fois par le script de l'atelier et copiée, sans générateur dans le code. Si le SVG est lourd (au-delà d'environ 300 Ko) ou lent à peindre, une image matricielle (WebP, deux densités) le remplace.
3. Il est posé derrière toutes les pages, fixe à l'écran (une couche en `position: fixed` derrière le contenu, pas `background-attachment: fixed`, capricieux dans la WebView), couvrant l'écran droit comme tourné et la fenêtre d'ordinateur, sans prendre les touchers ni être lu par un lecteur d'écran. Les barres de navigation, les cartes, les vues en plein écran et l'écran d'enregistrement en cours gardent un fond plein.
4. Dans les cadres et les panneaux (cadres au pinceau du Profil, panneaux des analyses de voile et de surf, cartes et rangées des autres pages), un voile à la couleur de la page laisse voir le champ à 20 % (`color-mix` ou une variable d'opacité, une seule variable dans les tokens).
5. Aucun texte ne passe directement sur le champ nu sans garder son contraste : là où une page n'a pas de cadre (liste de Sessions, Réglages, Statistiques), le bloc de texte reçoit le même voile (tranché par l'orchestrateur, la planche montrant que les petites dates grises y perdent du contraste).
6. Le mode « Économe » de Réglages retire le champ (fond uni), comme il retirait les anciens fonds.
7. `docs/DECISIONS.md` §11 est réécrite pour ce point (fond blanc cassé, champ de traînées colorées fixe, voile des cadres, économe), le bullet « DA » de `CLAUDE.md` accordé d'un mot (« fond blanc » devient blanc cassé, champ de vent en fond), `docs/INVENTAIRE.md` reçoit les fichiers neufs.

## Ce qui ne change pas

Les chiffres, la disposition, les cadres au pinceau, la carte et ses légendes, l'image de partage, la barre du bas noire.

## Vérification

`node outils/verif.mjs --rapide` par l'agent. Par l'orchestrateur : `npm run verif`, puis le passage courant du banc (texte identique avant et après) et des captures du Profil, de Sessions et d'une analyse, en clair et en sombre.

## Essai au téléphone

Sur l'APK : Profil, Sessions, une analyse, Réglages, en clair puis en sombre → le champ se voit entre les cadres, se devine à peine dedans, rien ne saccade au défilement, tout se lit ; cocher « Économe » → le fond redevient uni.
