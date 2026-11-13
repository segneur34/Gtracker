# 348 · Banc : des largeurs de texte différentes entre « avant » et « après » sur un arbre intact

Modèle | Réflexion : Sonnet | high

## Tel que noté

Vu le 12/11 au lot 347 : les scripts `tailles` et `aides` du banc mesurent des textes environ 7 % plus étroits du côté « avant » que dans l'arbre de travail, sur des pages que le lot ne touche pas (« Statistiques » 76 px avant, 87 px après, à la même taille d'écran). Cause supposée par Claude, non vérifiée : la police ne se charge pas du côté servi depuis le dossier temporaire.

## Aujourd'hui

`outils/banc/passe.mjs` compare un côté « avant » (un commit extrait dans un dossier temporaire, option `--avant`) et un côté « après » (l'arbre de travail). Le mode d'emploi est `outils/banc/LISEZMOI.md`, le journal des scripts `outils/banc/SCRIPTS.md`. La police de l'application est Inter (`src/theme/`), posée par le lot 344.

## Voulu

1. La cause, démontrée et non supposée : reproduire l'écart sur un arbre intact (`node outils/banc/passe.mjs tailles --avant HEAD -j 1`, qui doit rendre « identique » et ne le rend pas), puis chercher pourquoi les deux côtés ne rendent pas le même texte : police absente ou chargée plus tard d'un côté (fichier non extrait, chemin, cache, attente du chargement avant la mesure), taille de fenêtre, facteur d'échelle, ou autre. Relever la police réellement employée de chaque côté (`document.fonts`, police calculée d'un élément) plutôt que de la déduire.
2. La correction dans les outils du banc, pour que les deux côtés soient servis et mesurés de la même façon, et que la mesure attende que les polices soient prêtes.
3. La preuve : sur un arbre intact, `tailles` puis `aides` rendent un relevé identique avant et après, deux fois de suite.
4. `outils/banc/LISEZMOI.md` (le piège et sa parade) et `SCRIPTS.md` à jour.

## Ne pas faire

- Ne toucher qu'à `outils/banc/` : ni `src/`, ni `android/`, ni `docs/` hors des deux documents du banc, ni `package.json` ; ni commit ni version.
- Si la cause est dans l'application elle-même (une police qui ne se charge pas toujours, ce que l'utilisateur verrait aussi), ne pas la corriger : le dire dans le rapport, avec la preuve.
- Jamais deux passages du banc ensemble ; pas de vitest pendant un passage.
- Éditer avec Write et Edit seulement.

## Rapport attendu

Le rapport habituel (FAIT / BLOQUÉ / ÉCHEC), en 25 lignes au plus : la cause démontrée, ce qui a été changé, les deux passages identiques, et si l'application est en cause.
