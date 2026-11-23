# 523 · Vocabulaire d'atelier dans ce qui est remis

Modèle | Réflexion : Opus | medium

Relevé de l'outil de livraison du 23/11 (`node outils/livraison.mjs`, avertissements non bloquants) : « lot N » 248 fois dans 70 fichiers, « point N » 286 fois dans 22, « nom de l'assistant » 7 fois dans 3 fichiers, « MODELES » 27 fois dans 3, « HISTORIQUE » 6, « DECISIONS » 4, « sous-agent » 1. Le journal (`docs/HISTORIQUE.md`) et les décisions n'étant pas remis, ces renvois ne mènent nulle part pour l'acheteur. Ce lot referme aussi le lot 331, dont il ne reste que cela et la date de dernière passe d'ETAT.

## Où (compté le 23/11)

- `docs/ETAT_DU_PROJET.md` : 51 « lot N », 236 « point N ». `docs/INVENTAIRE.md` : 76 et 192. `docs/MISE_EN_PAGE.md` : 8 « point N ». `outils/banc/SCRIPTS.md` : 4 « lot N ».
- Une soixantaine de scripts du banc (`outils/banc/*.mjs`), dans leurs commentaires ; `android/app/src/main/res/values/styles.xml`.
- Relevés à la main par l'agent qui a écrit CONTRIBUER.md, hors blocs d'atelier : ETAT lignes 377 (lot, « reste à faire n° 107 », deux points), 401 (renvoi au journal), 534 (« Dans le shell de Claude »), 542 (lot 501, élément 515), 543 (lots 151 et 189) ; `outils/banc/LISEZMOI.md:45` (« session de Claude ») ; `src/theme/inlineStyles.test.ts:4` et `:10` (« élément 160 », « au lot », que la garde de la règle 14 n'attrape pas) ; `src/architecture.test.ts:296-298` et `:334` (reste à faire, journal, DECISIONS, `heritage.test.ts`) ; `outils/i18n.mjs:11` (cite `src/heritage.test.ts`, non remis) ; `docs/MISE_EN_PAGE.md:3` (« rien ne s'y change sans lui » : « l'utilisateur » ne veut rien dire pour l'acheteur).

## Méthode proposée à l'utilisateur le 23/11 (à confirmer avant de traiter)

- Renvoi retiré quand la phrase tient seule (environ neuf cas sur dix) : « (`ratioMask` …, point 185) » perd « , point 185 » ; « (lot 151) » disparaît.
- Phrase réécrite quand elle dépend du renvoi : « comme avant le point 92 » devient la raison en clair, lue dans le journal ou sa copie figée (`D:\gong tracker\atelier\historique-avant-1111\`).
- Scripts du banc : la règle 14 (un commentaire tient seul), et sa garde étendue à `outils/`.
- Question posée : retirer dans le dépôt de travail lui-même (recommandé, avec une garde sur les documents remis, et l'agent `doc` qui n'écrit plus ces renvois), ou seulement à la fabrication du dépôt remis.

## Résultat attendu

Les avertissements « lot N » et « point N » de l'outil de livraison à zéro (hors faux amis à exempter un par un), une garde qui les y tient, le lot 331 refermé.
