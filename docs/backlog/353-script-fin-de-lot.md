# 353 · Script de fin de lot

Sonnet | high. Outil de l'atelier : rien dans `src/`, aucun essai au téléphone, pas de version à augmenter.

## Pourquoi

À chaque lot, l'orchestrateur fait à la main six à huit gestes mécaniques : poser la version, écrire le commit, passer la ligne du lot de « en cours » à « à valider », numéroter les essais, mettre à jour « Prochains numéros », relancer le tableau de bord. Chaque geste relit tout son contexte, et un numéro posé à la main se trompe parfois. Source : recommandations 3 et 6 de `D:\gong tracker\atelier\analyse-agents-1311\analyse-organisation-agents.md` (lignes 126 à 151 seulement).

## Ce qui est demandé

### A. `outils/fin-de-lot.mjs`

Une commande, lancée depuis la racine du dépôt :

```
node outils/fin-de-lot.mjs <N> --message <fichier> [--essais <fichier>] [--lecture] [--en-cours] [--a-blanc]
```

- `<N>` : le numéro de l'élément, dont la ligne doit être dans Maintenant, état « en cours » (sinon erreur claire, rien n'est touché).
- `--message <fichier>` : le message du commit, en UTF-8, écrit par l'orchestrateur ; commité tel quel par `git commit -F` (le script n'y ajoute rien, ne le reformule pas).
- `--essais <fichier>` : une ligne par essai, sous la forme `quoi → attendu` ; le script les numérote à partir du « essai N » de « Prochains numéros » et les pose en sous-lignes de la ligne du lot (`  - essai N : quoi → attendu`), puis met l'en-tête à jour.
- Version : si `git status --porcelain` montre un changement sous `src/` ou `android/`, le troisième nombre de la version de `package.json` augmente de un, sur deux chiffres (`0.00.66` devient `0.00.67`) ; `package-lock.json` suit s'il porte la même version en tête ; sinon la version ne bouge pas. Regarder comment les commits récents ont posé la version (`git log -3 -p -- package.json android/app/build.gradle`) et reproduire exactement les mêmes fichiers.
- État de la ligne : « en cours » devient « à valider (commit en cours, version X) », ou « à valider sur lecture (…) » avec `--lecture` (obligatoire sans `--essais`, interdit avec : l'un ou l'autre) ; avec `--en-cours` (lot coupé en parties), l'état reste « en cours » et rien d'autre de la ligne ne change. Le commit étant fait après l'écriture de la ligne, l'état ne peut pas citer son propre identifiant : il cite la version quand elle a changé, sinon la date du jour (`jj/mm`).
- Contrôle de forme : après l'écriture, le script appelle la vérification de `outils/backlog.mjs` (ses fonctions exportées, pas un sous-processus) ; une erreur de forme annule tout (fichiers remis dans leur état d'avant, pas de commit).
- Commit : `git add -A` puis `git commit -F <fichier>`, sur tout l'arbre. L'identité git est celle du dépôt, ne pas la changer.
- `--a-blanc` : dit ce qui serait fait (version, nouvelle ligne, essais numérotés, fichiers qui partiraient au commit) sans rien écrire.
- Sortie : cinq lignes au plus (version, commit court, essais numérotés, état de la ligne).

Le calcul (nouvelle version, nouvelle ligne, sous-lignes, en-tête) est dans des fonctions pures exportées, testées dans `outils/fin-de-lot.test.mjs` sur un texte de reste à faire fabriqué, sur le modèle de `outils/backlog.test.mjs` (voir comment celui-ci est lancé par `npm run verif` et brancher le nouveau test de la même façon).

### B. Tableau de bord par zone ou par ligne

`node outils/backlog.mjs --zone <Maintenant|Ensuite|occasion|Plus tard|Questions>` imprime les lignes de cette zone, telles qu'elles sont dans le fichier ; `node outils/backlog.mjs --ligne <N>` imprime la ligne de l'élément N et ses sous-lignes d'essais. Sans option, rien ne change (le tableau de bord d'aujourd'hui, même sortie au caractère près). Le chemin du fichier reste un argument possible. Tests ajoutés à `outils/backlog.test.mjs`.

### C. Mode d'emploi

- `outils/LISEZMOI.md` : une entrée pour le nouveau script et les deux options.
- `.claude/skills/chaine/SKILL.md`, étape 4, paragraphe « Puis : version augmentée… » : le remplacer par l'appel du script (l'orchestrateur écrit le message et la liste d'essais dans deux fichiers du brouillon, puis lance la commande), sans rien changer d'autre à ce fichier.
- `docs/INVENTAIRE.md` si sa carte liste les fichiers de `outils/` (`npm run verif` le contrôle : ligne « documents »).

## Ce qui n'est pas demandé

- Rien dans `src/`, `android/`, `.claude/hooks/` ni `.claude/agents/` : un autre lot (354) y travaille.
- Pas de commit, pas de version, pas de modification de `docs/BACKLOG.md` (les essais du script se font sur une copie dans le brouillon ou sur un texte fabriqué).
- Le script ne construit pas l'APK, ne pose pas de tag, ne lance ni vérification ni banc.

## Vérification

`node outils/verif.mjs --rapide` puis les tests du nouvel outil ; un essai `--a-blanc` sur le vrai `docs/BACKLOG.md` avec l'élément 353 lui-même, dont la sortie est recopiée dans le rapport.
