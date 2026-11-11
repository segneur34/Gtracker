# 331 · Ce qui reste : l'historique neuf, et le second temps des documents

Brief d'origine : `docs/backlog/319-revue-apres-fork.md`, section « Lot 331 · Documents remis à jour ». Cette fiche garde ce que la passe du 11/11 a laissé.

## Fait le 11/11

- Premier passage : CLAUDE.md, DECISIONS, MISE_EN_PAGE, README, DEVELOPPER, INSTALLATION.
- Second passage : `docs/ETAT_DU_PROJET.md` (§1 à §4, §6 à §9, §11, §12) et `docs/INVENTAIRE.md` ne décrivent plus la course, le vélo, le fractionné ni l'ancienne application ; ils disent le planificateur réduit, les onze activités de départ, la fin d'enregistrement qui ouvre l'analyse, « Partager la trace », les gardes du lot 327.

## Reste dans ETAT et INVENTAIRE (à relire, l'agent n'a pas relu son rendu)

- ETAT : le §12 (notification, HyperOS) cite encore « Tracker » seul vers la ligne 410 ; les parties planification des §4 et §6 n'ont pas été revérifiées après le lot 304 ; le mot « cadence » n'a pas été passé au crible ; la limite « Distance » (point 300, mesurée sur des courses) a été retirée sans être réécrite pour la voile : à reposer si on veut la garder.
- INVENTAIRE : les lignes 14, 57, 195, 264 et 268 sortent encore à la recherche de contrôle (peut-être des faux amis) ; l'entrée de `PlanningPage.tsx` (vers la ligne 254) n'a pas été relue.
- Les lignes qui dépendent des lots 322 à 324 (clés, marqueur, agent envoyé aux serveurs de cartes, alias de signature) : à vérifier contre le code d'aujourd'hui.
- Second temps prévu par le brief : après les lots 326 et 327 (suite, élément 339).

## L'historique neuf (plan de l'agent `doc`, rien n'est fait)

Réponse de l'utilisateur du 11/11 : un journal neuf de Gtracker qui garde les numéros d'origine, l'ancien sortant du dépôt, non livré à l'acheteur.

1. Un journal neuf « Historique des décisions de Gtracker », numéros d'origine gardés : le code cite environ 103 « point N » dans 49 fichiers de `src/`.
2. Premier relevé par script : points qui citent l'ancienne application (36, 40, 88, 89, 99, 105, 117, 173, 195, 300, 306, 308, 309, 312), un chemin ou un dépôt (36, 38, 172, 173, 190, 309), des outils d'IA (2, 6, 47, 93, 135, 149, 157, 159, 169, 171, 172, 173).
3. Garder tous les points cités par `src/`, ETAT, INVENTAIRE, DECISIONS ou MISE_EN_PAGE, même s'ils portent sur la terre (au moins 80, 81, 89), réécrits en une phrase sans la terre.
4. Retirer environ 40 points de terre pure ; à relire avant de couper, car ils portent des pièges encore vrais : 98, 99, 115, 145, 224, 253, 257, 287, 305, 315.
5. Réécrire environ 70 points mêlés, sans l'ancien nom, chemin, outil d'IA, date ni version 0.x.yy ; par lots de 40 points avec relecture : 4 à 6 heures d'agents Sonnet.
6. Ajouter les points 323 et suivants, à la validation de leurs lots.
7. Ajouter à `outils/docs-cites.mjs` un contrôle : tout « point N » cité existe dans le journal neuf.
8. Ce qui manque : l'annexe de la revue (hors dépôt, dans le dossier d'atelier de la revue du 11/11) et plusieurs passes par lot de 40 points.
9. L'ancien journal (345 Ko) sort du dépôt vers les archives de l'atelier, déplacé par l'orchestrateur ; git le conserve de toute façon.
10. Rien n'est supprimé du dépôt avant que le journal neuf soit validé.

Taille : gros, à mener à part (un lot à lui seul), pas à la fin d'un paquet.
