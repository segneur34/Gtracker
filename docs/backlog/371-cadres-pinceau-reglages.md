# 371 · Réglages : les cadres en un coup de pinceau très fin

Modèle | Réflexion : Sonnet | high. Suite des lots 364 et 365 (même trait, même pièce : `src/components/brushFrame.ts`, `BrushFrame.css`, `src/core/brushColor.ts`, variables `--brush-*` de `src/theme/tokens.css`). Avant d'y toucher : `docs/DECISIONS.md` §11 (Réglages), à accorder dans le même travail.

## Demande de l'utilisateur (13/11 au soir)

« Dans les réglages, chaque petit cadre, quand tout est réduit, vu que les cadres sont petits, on ne voit pas trop la différence avec le tracé autour du champ de vitesse, de vent. Donc il faudrait faire avec une ligne très fine, un coup de pinceau très fin, qui fait le même effet que dans l'accueil, donc trois quarts de tour en gros, un peu plus, sauf un angle, angle qui tourne, et un coup de pinceau vraiment fin, pas mal plus fin que les cadres dans les statistiques. »

Lecture de l'orchestrateur : depuis le fond de page en champ de traînées, le trait fin des cadres de Réglages se confond avec les traînées ; « l'accueil » est le Profil.

## À faire

1. Sur la page Réglages, chaque cadre (les sections, repliées comme dépliées) perd son trait fin et reçoit le coup de pinceau des lots 364 et 365, par la pièce déjà écrite, sans copie : un seul trait qui fait presque le tour, ouvert à un angle qui tourne d'un cadre au suivant.
2. Le trait est nettement plus fin que celui des analyses (6 px) : une variable neuve dans les tokens, vers 3 px, que la pièce accepte ; à régler à l'œil pour qu'il reste un coup de pinceau et pas un filet. Les marges intérieures qu'il demande restent petites : un cadre replié ne grossit presque pas.
3. Couleur : celle de l'activité favorite, par la même règle que le Profil (tranché par l'orchestrateur, l'utilisateur ne l'a pas dite) ; si elle n'est pas à portée simple depuis Réglages, l'encre, et le dire dans le rapport.
4. Les cadres dans les cadres (rangées d'activités, champs, boutons) gardent leur trait ; le voile du fond de page (`--field-veil`) reste dans les cadres.
5. Sans prise en charge du masque en bordure, le cadre garde son trait fin, comme ailleurs.
6. Aucun texte ni bouton sous le trait, rien de coupé, aucun défilement horizontal, à 390 et 320 px, téléphone tourné et ordinateur.
7. `docs/DECISIONS.md` §11 le dit en une phrase.

## Ce qui ne change pas

Le contenu des réglages, leur ordre, l'ouverture et la fermeture des sections, les autres pages.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, des captures de Réglages tout replié et une section dépliée, à 390 px, en clair et en sombre, qu'il regarde. Par l'orchestrateur : `npm run verif`, puis le banc sur `reglages` et `tailles` (Réglages).
