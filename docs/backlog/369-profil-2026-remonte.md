# 369 · Profil : le bouton « 2026 » remonte à la hauteur de « Test de FC repos »

Modèle | Réflexion : Sonnet | medium. Avant d'y toucher : `docs/DECISIONS.md` §9 (Profil), à accorder dans le même travail.

## Demande de l'utilisateur (13/11 au soir)

En voyant la capture du Profil : « monter le 2026 au niveau du test FC repos et du coup tout remonter ».

## À faire

1. Sur le Profil, le bouton de période (« 2026 » / « Tout ») quitte sa ligne à lui : il se pose à droite, à la hauteur de la ligne « Test de FC repos » de l'en-tête.
2. La ligne qu'il occupait disparaît : le cadre des activités favorites et tout ce qui suit remontent d'autant.
3. Le bouton garde sa taille, son aspect et sa zone de toucher ; il ne recouvre ni le nom, ni « Test de FC repos », même avec un nom long (le nom se coupe avant lui) et à 320 px de large.
4. Téléphone tourné et ordinateur : même règle si l'en-tête y a la même forme ; sinon, le plus proche qui ne laisse pas de ligne vide (à dire dans le rapport).
5. `docs/DECISIONS.md` §9 accordée d'une phrase.

## Ce qui ne change pas

Ce que fait le bouton, les chiffres, les cadres, le fond de page.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, le script `profil` du banc accordé si son contrôle d'ordre change, et des captures à 390 et 320 px qu'il regarde. Par l'orchestrateur : `npm run verif`, puis le banc sur `profil` et `cacher`.
