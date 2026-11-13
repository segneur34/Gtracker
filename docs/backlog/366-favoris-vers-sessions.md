# 366 · Profil : les logos des activités favorites mènent à Sessions, filtrée

Modèle | Réflexion : Sonnet | medium. Avant d'y toucher : `docs/DECISIONS.md` §9 (Profil) et §11 (rangée de logos de la page Sessions).

## Demande de l'utilisateur (13/11 au soir, essai 242 du lot 357)

« ok mais il faudrait que les icônes soient un lien vers les sessions avec l'icône cliquée comme sélection ».

## À faire

1. Dans le bloc des trois activités favorites du Profil (`src/components/ProfileFavorites.tsx`), chaque logo devient un lien : le toucher ouvre `/sessions` avec cette activité choisie dans la rangée de logos (`ActivityBubbles`), la liste filtrée dessus.
2. Reprendre le moyen par lequel la page Sessions tient déjà son filtre (le chercher avant d'en écrire un autre) ; s'il n'en existe pas qui se passe d'une page à l'autre, le plus simple qui tienne au retour d'Android et au rechargement.
3. La case « Total » ne devient pas un lien.
4. Une activité favorite cachée par l'œil de Réglages : le lien mène à Sessions sans filtre plutôt qu'à une liste vide (tranché par l'orchestrateur ; à dire dans le rapport si le code fait déjà mieux).
5. Le logo reste un vrai lien ou bouton (clavier, nom lisible par un lecteur d'écran : « Sessions de Wingfoil »), sans changer son aspect ; zone de toucher d'au moins 44 px.
6. `docs/DECISIONS.md` §9 dit le lien en une phrase.

## Ce qui ne change pas

Les chiffres, l'ordre et la taille des logos, les cadres au pinceau, la page Sessions elle-même.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, et le script `profil` du banc accordé si son relevé change (un contrôle neuf : toucher le premier logo mène à Sessions, ce logo allumé). Par l'orchestrateur : `npm run verif`, puis le banc sur `profil`.
