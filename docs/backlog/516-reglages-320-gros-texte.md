# 516 · Réglages à 320 px et texte × 1,3 : des listes sortent de l'écran

Modèle | Réflexion : Sonnet | medium

## Constat (banc du 23/11 au soir, lot 512 partie B)

Script `tailles` du banc, Réglages à 320 px de large et texte × 1,3, tous les blocs ouverts : six listes déroulantes et l'unité « bpm » du bloc « Pratiquant » sortent de l'écran, et la page déborde de 19 px. Soupçon : défaut ancien, seulement révélé, parce que les titres repliables portent maintenant `aria-expanded` et que le script ouvre donc des blocs qu'il laissait fermés.

## Premier temps : prouver si c'est ancien ou neuf (aucun code de l'application)

- Rejouer le script `tailles` d'aujourd'hui sur une application construite depuis le commit `8ec03fd` (avant le lot 512, partie A comprise si elle est plus ancienne : prendre le dernier commit d'avant le bloc « Connexion », le dire), en forçant l'ouverture des mêmes blocs (si l'ancien code n'a pas `aria-expanded`, ouvrir « Pratiquant » par un clic sur son titre), et relever les mêmes mesures : éléments qui dépassent, débordement de la page en pixels.
- Remonter plus loin si besoin (une version d'il y a deux semaines, par exemple le tag de l'APK précédente) pour dater le défaut.
- Rendre un tableau : commit, blocs ouverts, éléments qui sortent, débordement.

## Second temps : corriger, que le défaut soit ancien ou neuf

Si la correction est petite (du CSS dans le bloc « Pratiquant » : une liste déroulante qui ne peut pas rétrécir, une ligne qui ne passe pas à la ligne), la faire : rien ne sort de l'écran dans Réglages à 320 px et texte × 1,3, tout ouvert, et la page ne déborde plus. Sans changer la disposition aux largeurs courantes (390 px et ordinateur : relevés du banc identiques). Si la correction demande de redessiner le bloc, s'arrêter au constat et le dire (rapport BLOQUÉ, avec ce qu'il faudrait changer).

## Banc

`tailles` (avant et après), `reglages` ; texte identique attendu.

Décisions : `docs/DECISIONS.md` §11 (Réglages), §9 (Profil et « Pratiquant ») ; charte : variables de `src/theme/tokens.css`.
