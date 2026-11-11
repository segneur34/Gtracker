# 331 · Documents remis à jour : ce qui reste

Brief d'origine : `docs/backlog/319-revue-apres-fork.md`, section « Lot 331 · Documents remis à jour ». Cette fiche garde ce que les passes du 11/11 ont laissé.

## Fait le 11/11

- Premier passage : CLAUDE.md, DECISIONS, MISE_EN_PAGE, README, DEVELOPPER, INSTALLATION.
- Second passage : `docs/ETAT_DU_PROJET.md` (§1 à §4, §6 à §9, §11, §12) et `docs/INVENTAIRE.md` ne décrivent plus la course, le vélo, le fractionné ni l'ancienne application ; ils disent le planificateur réduit, les onze activités de départ, la fin d'enregistrement qui ouvre l'analyse, « Partager la trace », les gardes du lot 327.
- Historique (décision de l'utilisateur du 11/11, qui remplace le plan en dix étapes d'une réécriture point par point) : le journal de Gtracker commence au point 323 ; les points 1 à 322 ne sont pas réécrits, ils sortent du dépôt et se lisent dans l'historique de Tracker d'avant le 11/11/2026 (copie figée dans le dossier d'atelier, `historique-avant-1111/HISTORIQUE.md`, et `git show 012f55a:docs/HISTORIQUE.md`). `outils/docs-cites.mjs` refuse un « point N » cité qui n'existe pas dès que N atteint le premier point du journal.

## Ce que la décision sur l'historique entraîne

- `src/` cite 77 fois un ancien point (26 numéros). Le journal n'étant pas livré, le lot 307 remplace chaque renvoi par la raison en clair (elle se lit dans la copie figée) ; son test refuse « lot N », « Qnn » et « point N ».
- `docs/ETAT_DU_PROJET.md` (≈ 217 renvois) et `docs/INVENTAIRE.md` (≈ 206) gardent leurs renvois aux anciens points jusqu'à la livraison (lot 308), où ils sont refaits.

## Reste dans ETAT et INVENTAIRE

- ETAT : le §12 (notification, HyperOS) cite encore « Tracker » seul vers la ligne 410 ; les parties planification des §4 et §6 n'ont pas été revérifiées après le lot 304 ; le mot « cadence » n'a pas été passé au crible ; la limite « Distance » (point 300, mesurée sur des courses) a été retirée sans être réécrite pour la voile : à reposer si on veut la garder.
- INVENTAIRE : les lignes 14, 57, 195, 264 et 268 sortent encore à la recherche de contrôle (peut-être des faux amis) ; l'entrée de `PlanningPage.tsx` (vers la ligne 254) n'a pas été relue.
- Les lignes qui dépendent des lots 322 à 324 (clés, marqueur, agent envoyé aux serveurs de cartes, alias de signature) : à vérifier contre le code d'aujourd'hui.
- Second temps prévu par le brief : après les lots 326 et 339 (lignes « famille et traitement » de CLAUDE.md et d'ETAT).
