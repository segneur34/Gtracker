# 368 · Analyses, sur téléphone : la carte d'un bord à l'autre de l'écran

Modèle | Réflexion : Sonnet | medium. Avant d'y toucher : `docs/MISE_EN_PAGE.md` (de même autorité que `CLAUDE.md`), à accorder dans le même travail pour ce seul point.

## Demande de l'utilisateur (13/11 au soir)

En voyant la capture d'une analyse sur téléphone : « on peut faire que la carte prenne toute la largeur de l'écran ? 100 %, à faire dans un prochain lot rapidement ».

## À faire

1. Dans les deux analyses (`/voile/analyse`, `/surf/analyse`), téléphone droit : la carte va d'un bord à l'autre de l'écran, sans marge à gauche ni à droite, sans cadre ni coins sur les côtés.
2. Ses boutons (zoom, calques, plein écran), sa légende de couleurs et la mention OSM restent entiers et à portée, hors des encoches (marges sûres du téléphone).
3. L'en-tête au-dessus, la barre d'onglets et les panneaux dessous gardent leurs marges.
4. Téléphone tourné et ordinateur : rien ne change (tranché par l'orchestrateur : la demande porte sur l'écran du téléphone droit).
5. Aucun défilement horizontal de la page ; la hauteur de la carte ne change pas.
6. `docs/MISE_EN_PAGE.md` le dit en une phrase.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, et une capture du banc à 390 px de large qu'il regarde. Par l'orchestrateur : `npm run verif`, puis le banc sur `general` et `surf` (texte identique avant et après).
