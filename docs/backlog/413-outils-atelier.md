# 413 · Outils de l'atelier : fin de lot et relecture

Modèle | Réflexion : Sonnet | high

## Origine

Relevé pendant le lot 403 (15/11). Outil de l'atelier, aucun fichier de `src/` ni d'`android/`, aucun essai au téléphone.

## Constats (à vérifier avant de corriger)

1. `outils/fin-de-lot.mjs`, `versionSuivante` : après `0.01.99` elle écrirait `0.01.100`. La série est en `0.MM.NN`, deux chiffres par nombre (choix de l'utilisateur du 15/11 : après `0.00.99` vient `0.01.00`) : après `.99`, le nombre du milieu augmente et le dernier revient à `00` ; après `0.99.99`, erreur claire plutôt qu'une version inventée. Garder l'écriture sur deux chiffres (`0.01.09` → `0.01.10`). Regarder aussi ce qui dérive de la version côté Android (`versionCode`, calculé dans `android/app/build.gradle` : lecture seule, ne pas y toucher) et dire dans le rapport si le passage de `.99` y pose un problème.
2. `outils/fin-de-lot.mjs` : un lot dont les essais sont déjà numérotés en sous-lignes (lot repris après un premier commit, ou essais écrits à la main) ne passe pas « à valider » : sans `--essais` le script exige `--lecture` ou `--en-cours`. Attendu : si la ligne du lot porte déjà des sous-lignes d'essais, « à valider » se pose sans `--essais` ni `--lecture`, les essais existants restant tels quels ; avec `--essais`, les nouveaux s'ajoutent après eux (c'est déjà le cas, le vérifier). `--lecture` sur un lot qui porte des essais reste une erreur.
3. Tests dans `outils/fin-de-lot.test.mjs` pour ces deux points (regarder comment ils se lancent : `node --test`, ou par `npm run verif`).

Le troisième point de l'élément (l'agent de relecture qui s'arrête à trente tours sans rapport sur un gros diff) se règle dans `.claude/agents/relecture.md`, fermé à l'agent `lot` : l'orchestrateur le fait lui-même. La règle « un lot Fable coupé en parties prend Opus pour celles que le plan juge à sa portée » attend la réponse de l'utilisateur.

## Limites

Fichiers : `outils/fin-de-lot.mjs`, `outils/fin-de-lot.test.mjs`, cette fiche. Ne pas lancer le script pour de vrai (il commite) : seulement `--a-blanc` et les tests. Mettre à jour l'en-tête de commentaires du script pour ce qui change.

## Vérification

Les tests du script passent ; `node outils/verif.mjs --rapide`.
