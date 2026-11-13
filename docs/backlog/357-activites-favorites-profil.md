# 357 · Profil : les trois activités favorites, à la place de la bande des trois chiffres

Modèle | Réflexion : Sonnet | high. Décisions du domaine : `docs/DECISIONS.md` §9 (Profil), à accorder dans le même travail. Mise en forme : variables de `src/theme/tokens.css` seulement.

## Demande de l'utilisateur

- Note du 13/11 : les trois activités les plus pratiquées, de tailles différentes selon la première, la deuxième et la troisième place, « à la place de "activités" ».
- Réponses du 13/11 au soir, sur croquis :
  1. forme : en ligne, de gauche à droite, du premier au troisième, du plus grand au plus petit, sans effet de podium (le premier n'est pas au centre) ;
  2. contenu : « les 3 activités avec les logos par taille et en dessous : chacune leur nombre de fois et distance » ;
  3. place : le bloc prend la place de la bande des trois chiffres d'aujourd'hui (nombre d'activités, distance, sport préféré), « et on ajoute une case total km ».

Croquis retenu (téléphone) :

```
  [ 2026 ]
┌────────────────────────────────────────┐
│ ┌──────┐                               │
│ │ WING │  ┌─────┐                      │
│ │      │  │KITE │  ┌────┐              │
│ └──────┘  └─────┘  └SURF┘     Total    │
│ Wingfoil    Kite     Surf              │
│ 27 sessions 9 sessions 4 sessions      │
│  310 km     85 km    17 km    412 km   │
└────────────────────────────────────────┘
┌── anneau du temps ─────────────────────┐
```

## À faire

1. Sur la page Profil, la bande des trois chiffres disparaît ; à sa place, un cadre « activités favorites » : les trois activités qui ont le plus de temps sur la période affichée (la règle du « sport préféré » d'aujourd'hui, à réutiliser, pas à réécrire), de gauche à droite, chacune par son logo dans son cadre au pinceau (la pièce qui sert déjà à l'avatar et à la page Sessions), en trois tailles décroissantes.
2. Sous chaque logo : le nom de l'activité, son nombre de sessions sur la période (« 1 session », « 27 sessions ») et sa distance sur la période, dans l'unité de distance de cette activité et au format de l'application (`core/units.ts`, virgule décimale).
3. Une quatrième case, à droite des trois, sans logo : « Total » et la distance totale de la période, c'est-à-dire le chiffre « distance » de l'ancienne bande, calculé comme lui.
4. Moins de trois activités sur la période : on montre celles qui existent, sans case vide ; aucune : le cadre garde la case « Total » et dit en une ligne qu'aucune session n'est rangée sur la période (reprendre la formule de la page s'il y en a déjà une).
5. Le bloc suit le bouton de période (année ou « Tout »), comme la bande d'avant.
6. Téléphone droit (390 px), téléphone tourné et ordinateur : le bloc tient sur une rangée sans défilement horizontal ; les noms longs (« Wingfoil », « Surf foil », une activité créée au nom long) se coupent proprement ou passent à la ligne sans chevaucher leur voisin.
7. Sur ordinateur, le bloc est dans la colonne du Profil, comme la bande qu'il remplace ; la colonne de droite « Vos activités » ne change pas.
8. `docs/DECISIONS.md` §9 accordé : la bande de trois chiffres laisse la place aux trois activités favorites (logos par taille, sessions et distance de chacune, case du total), décision du 13/11.
9. Les textes d'aide ou de tutoriel qui décrivent la bande des trois chiffres (`src/tutorials/lessons.ts`, s'ils en parlent) sont accordés.
10. Le script `profil` du banc est adapté à ce qu'il lit de l'ancienne bande, et son journal (`outils/banc/SCRIPTS.md`) le dit.

## Ce qui ne change pas

Le bouton de période, l'anneau du temps par activité, le graphe d'activités, la photo et l'avatar, la colonne « Vos activités » de l'ordinateur, les Statistiques.

## Règles

- La couleur d'une activité ne porte pas de texte et ne remplit pas une grande surface : elle reste celle du cadre au pinceau de son logo.
- Un calcul neuf (classement des trois, sessions et distance par activité) est une fonction pure avec son test, à côté de celle qui calcule déjà le sport préféré ; aucune activité en dur.
- Commentaires de `src/` sans numéro de lot.

## Tranché par l'orchestrateur

- Classement par temps passé sur la période, comme le « sport préféré » (dit à l'utilisateur dans la question, sans objection) ; à égalité, le plus de sessions.
- Le mot est « sessions », celui de l'application, pour « nombre de fois ».
- La case du total est la quatrième de la rangée, à droite, et ne porte que la distance.
- Sur ordinateur, « Vos activités » reste : la réponse du 13/11 (défaut de Q113, « le podium remplace la rangée Vos activités ») est remplacée par celles du soir, cette rangée n'existant pas sur téléphone.
- Toucher une activité favorite ne fait rien.

## Vérification

`node outils/verif.mjs --rapide` par l'agent ; `npm run verif` puis `node outils/banc/passe.mjs profil` par l'orchestrateur.

## Essai au téléphone

Ouvrir le Profil sur « 2026 » puis « Tout », téléphone droit puis tourné : les trois activités favorites du plus grand au plus petit, leurs sessions et leur distance, et le total à droite ; dire si la disposition convient.
