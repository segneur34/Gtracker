# 395 · CLAUDE.md allégé d'un tiers, sans perdre une règle

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11. L'utilisateur : « il faut aussi modifier le claude.md s'il faut. Si c'est trop lourd, c'est dommage, ça ne sert à rien ». `CLAUDE.md` pèse 25 700 caractères (environ 7 300 jetons), rechargés à chaque appel de la conversation et de chaque agent (`lot`, `Plan`, `relecture`, `doc`) : mille caractères de moins, c'est de l'ordre de 26 000 jetons de moins par lot. Cible : environ 17 000 caractères. Documentation seule : aucun fichier de code.

## Méthode imposée

Aucune norme ne disparaît : une phrase ne sort de `CLAUDE.md` que si sa règle est écrite, mot pour mot ou plus précisément, à l'endroit où elle renvoie. Le rapport donne un tableau « retiré de CLAUDE.md → où la règle vit maintenant » ; la relecture le contrôle ligne à ligne.

## Allègements

1. Doublons de `docs/MISE_EN_PAGE.md`, à réduire à un renvoi d'une ligne : « Général et avancé » ; la légende dans « Couleur de trace » ; « Graphe relié à la carte » et « Surbrillance » de « Où ajouter quoi » ; « Page d'analyse ».
2. Doublons de `docs/DECISIONS.md` §11 : « Navigation » (1 300 caractères, à ramener vers 300), « Activités » (950, vers 250), « Matériel et notes » (§2).
3. La ligne « DA » (2 000 caractères) : la règle suivie d'exceptions datées devient une section « Charte graphique » de `DECISIONS.md`, écrite comme l'état d'aujourd'hui (cadres au pinceau en trois épaisseurs du lot 393, ovales des boutons, vert en aplat, encre) ; `CLAUDE.md` garde environ 400 caractères : tout passe par les variables, vert vif en aplat sous du noir jamais en texte, couleur d'activité jamais en grande surface ni en texte, allumé à l'encre.
4. Les noms « Avec vent » et « Sans vent » ne sont tenus qu'à un endroit (§11).
5. Règles déjà gardées par un test, ramenées à leur énoncé et au nom du test : 12 (la liste des modules de `platform/` est dans INVENTAIRE), 13, 14.
6. Doublons de `docs/MODELES.md` et de la procédure : agents `banc` et `doc`, « mauvais modèle », bloc de commandes (garder les trois commandes de travail, le reste est dans DEVELOPPER).
7. Dates et récits (« essayées puis gardées le 13/11 », « (Q32, 30/10) », « validée le 12/11 ») : ce sont des faits d'HISTORIQUE.

## Corrections et ajouts (peu de lignes)

1. **Règle 3, fausse à la lettre** : `sailing/` porte des dizaines de constantes d'algorithme en dur (`sailingConfig.ts`, `maneuvers.ts` : `CLASSIFICATION_TOLERANCE_DEG = 60`, `MANEUVER_MIN_ENTRY_SPEED_KN`…), `core/` aussi. La réécrire comme elle est suivie : un seuil qui dépend du support ou que l'utilisateur règle vient de `SPORT_PROFILES`, passé en paramètre, surchargeable et persisté ; une constante d'algorithme, commune à tous les supports, est une constante nommée et commentée du module, passée en option avec son défaut quand un test doit la faire varier.
2. **Traduction** (lot 382, écrite nulle part) : tout texte visible passe par `t`/`tn`, la clé est le texte français, dictionnaires `src/locales/en.json` et `es.json`, garde `outils/i18n.mjs` et `i18nGuard.test.ts`. Relever les noms exacts dans le code.
3. **Styles en ligne** : le relevé `outils/styles-en-ligne.json` ne fait que baisser (`inlineStyles.test.ts`) ; un fichier neuf n'a pas de `style={{`.
4. **Deux décisions du 15/11** : la trace colorée se dessine en 64 nuances du dégradé (« ça ne me pose aucun problème d'avoir 64 nuances pour la trace, c'est largement suffisant ») : la phrase « dégradé continu […] ni échelle relative ni paliers » devient « dégradé sur une échelle absolue, en 64 nuances, sans paliers visibles » (le code suit au lot 399) ; la plante du Profil est retirée du code (« la racine, on peut l'enlever totalement », lot 398) : retirer `library/rootGrowth` et `ProfileRoot` de la table « Avant de toucher à ».

## Hors du lot

Le déplacement des règles 1 à 14 vers un `ARCHITECTURE.md` livré (découpage proposé par la revue) se fera avec la livraison (308) : `src/` cite « règle N » 89 fois, la numérotation ne bouge pas ici.

## Vérification

`npm run verif` (ligne « documents » : fichiers cités) ; compte de caractères avant et après dans le rapport ; `src/architecture.test.ts` et les tests qui citent `CLAUDE.md` passent (ils citent des règles par leur numéro).
