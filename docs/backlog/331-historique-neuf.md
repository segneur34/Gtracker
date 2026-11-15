# 331 · Documents remis à jour : ce qui reste

Brief d'origine : la fiche 319 (revue d'après fork du 11/11), section « Lot 331 · Documents remis à jour » ; elle est sortie du dépôt le 15/11 (copie dans `D:\gong tracker\atelier\backlog-clos\319-revue-apres-fork.md`), ce qui sert encore est recopié plus bas. Cette fiche garde ce que les passes du 11/11 ont laissé.

## Fait le 11/11

- Premier passage : CLAUDE.md, DECISIONS, MISE_EN_PAGE, README, DEVELOPPER, INSTALLATION.
- Second passage : `docs/ETAT_DU_PROJET.md` (§1 à §4, §6 à §9, §11, §12) et `docs/INVENTAIRE.md` ne décrivent plus la course, le vélo, le fractionné ni l'ancienne application ; ils disent le planificateur réduit, les onze activités de départ, la fin d'enregistrement qui ouvre l'analyse, « Partager la trace », les gardes du lot 327.
- Historique (décision de l'utilisateur du 11/11, qui remplace le plan en dix étapes d'une réécriture point par point) : le journal de Gtracker commence au point 323 ; les points 1 à 322 ne sont pas réécrits, ils sortent du dépôt et se lisent dans l'historique de Tracker d'avant le 11/11/2026 (copie figée dans le dossier d'atelier, `historique-avant-1111/HISTORIQUE.md`, et `git show 012f55a:docs/HISTORIQUE.md`). `outils/docs-cites.mjs` refuse un « point N » cité qui n'existe pas dès que N atteint le premier point du journal.

## Ce que la décision sur l'historique entraîne

- `src/` cite 77 fois un ancien point (26 numéros). Le journal n'étant pas livré, le lot 307 remplace chaque renvoi par la raison en clair (elle se lit dans la copie figée) ; son test refuse « lot N », « Qnn » et « point N ».
- `docs/ETAT_DU_PROJET.md` (≈ 217 renvois) et `docs/INVENTAIRE.md` (≈ 206) gardent leurs renvois aux anciens points jusqu'à la livraison (lot 308), où ils sont refaits.

## Relecture d'ETAT et d'INVENTAIRE (faite le 11/11 au soir)

- Corrigé : plus de « Tracker » seul (notification du §12), cadence de pas retirée partout où elle n'est plus lue ni écrite, planification remise d'accord avec le lot 304 (entrée de `PlanningPage.tsx`, fiches d'itinéraire en version 4), noms `gtrackerBack` et `<gtracker:itineraire>`, chemin du poste retiré, deux clés de stockage ajoutées au tableau du §6 ; clés, marqueur, alias et identifiant vérifiés contre le code.
- Laissé, faux amis : « cadence » du GPS et du pumping, « course » au sens du parcours de balises ou du cap, `landWords.test.ts`, `segneur` dans l'identifiant.
- Non relu : les très longues lignes des §4 et §6 d'ETAT hors recherches ciblées ; la limite « Distance » n'est pas reposée.

## Reste

- Second temps prévu par le brief, après les lots 326 et 339 : lignes « famille et traitement » de CLAUDE.md et d'ETAT.

## Recopié de la fiche 319 (15/11)

- Règle du lot : la documentation ne devance pas le code ; une phrase qui décrit ce que change un lot de code ne s'écrit qu'après ce lot.
- Ligne du lot 326 dans le tableau « Temps 2 : après les lots de code » : `CLAUDE.md:78` (texte O1), `ETAT:42, :75` (numéros du 11/11). Le texte d'O1 est dans `D:\gong tracker\atelier\revue-1111\O1-familles-architecture.md`, section 3. Depuis le lot 409 (15/11), « famille et traitement » se lit à trois endroits : l'entrée « Famille et traitement » d'« Où ajouter quoi » dans `CLAUDE.md`, les lignes `sportFamily` et `sportTreatment` de `docs/GLOSSAIRE.md`, la puce « Famille et traitement » d'ETAT.
- Question liée, tranchée par défaut le 11/11 (« défaut partout ») : fusion de `SportFamily` et de `Treatment`, par défaut fusionner (O1) ; elle change ces mêmes lignes. Réponse de l'utilisateur du 11/11 à la question 13 : le lot 326 ne part pas avant que l'idée 332 (activités « décompactées » sur l'accueil) soit décidée.
- Ligne du lot 327 du même tableau (règle 13 de `CLAUDE.md`) : faite, la règle dit « deux familles seulement » et ses gardes.
