# 434 · Analyse surf › onglet vagues, téléphone : une vague par ligne

## Tel que dit par l'utilisateur

Essai 287 du 17/11 sur l'APK 0.01.19, devant le dessin du lot 422 (numéro sur sa ligne, puis deux lignes de quatre valeurs avec leur intitulé) : « ok mais en 2 lignes c'est moche, il faut trouver une solution ». Le même soir : entre deux vagues, « juste un trait noir ».

## Dessin retenu

Planche du 17/11 au soir, hors dépôt : `D:\gong tracker\atelier\planche-434-428\index.html` (quatre dessins, A à D). L'utilisateur étant absent, le lot code la variante par défaut de Claude, **A · tout sur une ligne** ; son choix, s'il diffère, fera un lot de reprise. Images de référence : `images\vagues-A-foil.jpg` et `images\vagues-A-sans.jpg` ; maquette en CSS et script injectés, à lire sans la recopier telle quelle (elle force tout par `!important` et emploie une sous-grille) : `outils\variantes\A.css` et `A.js`.

## Voulu, sur téléphone droit seulement (la requête de `src/pages/analysisMobile.css` où vit déjà `.an-man-podium--waves`)

1. L'en-tête du tableau revient, une seule fois, avec des intitulés courts : N°, Heure, Durée, Dist., Max, Moy., Vir. (ou « Vir.* » quand aucune vague n'a de capture, comme « Virages* » aujourd'hui), Vol (sur foil), et rien au-dessus du bouton.
2. Au-dessus du tableau, une petite ligne estompée dit l'unité une fois : « Max et moy. en km/h » (l'unité de l'activité).
3. Chaque vague tient sur une seule ligne : toutes ses valeurs en colonnes sous l'en-tête, le numéro en gras à gauche, le bouton qui montre la vague sur la carte au bout. Plus d'intitulé répété par vague (les `data-label` partent s'ils ne servent plus).
4. Entre deux vagues, et sous l'en-tête, un simple trait d'un pixel à l'encre (`var(--ink)` : noir le jour, blanc la nuit). Ni fond alterné, ni autre bordure de ligne, ni cadre autour du tableau.
5. Texte en `var(--text-s)`. À 390 px de large, avec foil (neuf colonnes) comme sans : aucune cellule rognée, aucun défilement de côté. À 360 px, pareil, quitte à resserrer les espaces ou à passer en `var(--text-xs)` sous une largeur donnée (jamais sous 12 px). À 320 px, le tableau peut défiler dans son panneau (`ui-overflow-x`), il ne rogne rien et n'élargit pas la page.
6. Pas de sous-grille CSS (`subgrid`) : la vue web d'un vieux téléphone ne la connaît pas. Le plus simple est de rendre aux vagues la mise en tableau native (colonnes dimensionnées par le navigateur), en annulant pour elles la grille des podiums.

## Ce qui ne change pas

- Sur ordinateur : rien, ni dessin ni texte (les intitulés longs y restent ; le texte de la page relevé par le banc doit être identique). Le trait entre vagues sur ordinateur est l'affaire du lot 428.
- Les chiffres, le tri, « Les 3 plus longues », l'astérisque des virages, la surbrillance d'une vague sur la carte.

## Contraintes

- Textes par `t`, clés en français, littérales ; les intitulés courts et la ligne d'unité dans `src/locales/en.json` et `es.json`, sans clé manquante.
- Variables de `src/theme/tokens.css` ; aucun style en ligne neuf (`outils/styles-en-ligne.json` ne fait que baisser).
- `docs/MISE_EN_PAGE.md` (téléphone, tableaux) et `docs/DECISIONS.md` §4, par recherche.

## Vérification

`node outils/verif.mjs --rapide`. Le banc (texte de l'analyse surf avant et après) et la capture du tableau à 390 px sont faits par l'orchestrateur.

## Essai au téléphone

Une session de surf ou de paddle foil, onglet vagues → une vague par ligne, toutes les valeurs lisibles sans glisser de côté, un trait noir entre deux vagues, et « Voir » montre la vague sur la carte.
