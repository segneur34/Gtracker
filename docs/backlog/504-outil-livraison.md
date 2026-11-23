# 504, partie « outil de livraison » · un dépôt remis fait à neuf, par un outil rejouable

Modèle | Réflexion : Opus | high

Constats B-05 et D-02 de la relecture avant vente (`docs/backlog/493-relecture-avant-vente.md`, section 504) et points 7 à 9 et 11 de `docs/backlog/308-e8-livraison.md`. Plan rendu par l'agent `Plan` le 23/11, condensé ici. Le dépôt de travail garde son atelier ; le dépôt remis est fabriqué dans un dossier à part, depuis l'arbre commité, sans le dossier `.git` actuel.

## L'outil : `outils/livraison.mjs` et `outils/livraison.test.mjs`, Node sans dépendance

Listes déclarées en tête : `ATELIER` (chemins qui partent), `SCRIPTS_RETIRES` (de `package.json`), `ATTENDUS` (fichiers sans lesquels le dépôt n'est pas livrable), `AVERTISSEMENTS` (vocabulaire d'atelier, non bloquant).

- **Part** : `.claude/`, `CLAUDE.md`, `docs/BACKLOG.md`, `docs/backlog/`, `docs/MODELES.md`, `outils/backlog.mjs` et son test, `outils/fin-de-lot.mjs` et son test, `outils/lancer-gtracker.bat`, `outils/livraison.mjs` et son test, le script `backlog` de `package.json` ; selon les réponses aux questions B et C : `docs/HISTORIQUE.md`, `docs/DECISIONS.md`, les cliquets de vocabulaire (`src/landWords.test.ts`, `src/heritage.test.ts`, `outils/heritage.mjs`, `outils/heritage.json`).
- **Reste** : `src/`, `android/`, `bureau/`, `public/`, `assets/`, la configuration de la racine, `.github/`, `README.md`, les documents remis de `docs/` (ETAT, MISE_EN_PAGE, INSTALLATION, DEVELOPPER, INVENTAIRE, GLOSSAIRE), le reste d'`outils/`, banc entier compris.
- **Fichiers attendus et absents** (`ARCHITECTURE.md`, `CONTRIBUER.md` tant que la fiche 308 ne les a pas écrits) : l'outil produit quand même le dossier, pour qu'on l'examine, mais conclut « non livrable », code 1. « Livrable » seulement si tous les contrôles sont à zéro et tous les attendus présents.

### Déroulé
1. Lire la configuration hors dépôt (`D:\gong tracker\atelier\livraison\livraison.json`, ou le chemin de la variable `GTRACKER_LIVRAISON`) : données du vendeur à rechercher (nom, pseudo, identifiant GitHub, e-mail, compte Windows, chemins du poste) et identité neutre de l'auteur. Refus de tourner sans elle. Aucune de ces données n'est écrite dans le dépôt.
2. Contrôler le dossier de sortie : hors du dépôt, hors de tout dossier portant un `node_modules`, vide ou déjà marqué par l'outil (`.git/livraison-gtracker`) ; ne rien effacer sans cette marque.
3. Prévenir si `git status` n'est pas propre (seul HEAD est livré).
4. Plan par `git ls-tree -r -z HEAD` (part, reste, transformé) ; `--a-blanc` l'affiche et s'arrête.
5. Export : `git archive --format=tar HEAD` envoyé dans `tar -xf -` lancé dans le dossier de sortie (`cwd`), sans jamais donner de chemin à `tar` (« D: » lu comme un nom de machine).
6. Transformations : retrait des scripts de `package.json` (ordre des clés, indentation de 2 et saut de ligne final gardés) ; retrait des blocs `<!-- atelier -->` … `<!-- /atelier -->` des documents, refus d'un marqueur non refermé.
7. `git -c core.autocrlf=false init -b main`, `add -A`, `update-index --chmod=+x` pour chaque entrée 100755 de la source (`android/gradlew`), un seul commit à l'auteur neutre (`-c user.name`, `-c user.email`, `GIT_COMMITTER_*`, `-c commit.gpgsign=false`, `--no-verify`).
8. Contrôles : `git rev-list --all --count` vaut 1 ; `git tag` et `git remote` vides ; `git log --all --format='%an %ae %cn %ce'` ne rend que l'identité neutre ; chaque fichier non transformé a le même blob et le même mode que dans la source (preuve des fins de ligne et du bit exécutable) ; recherches (ci-dessous) à zéro, sur le contenu et sur les noms de fichiers ; attendus présents.
9. Sur `--verifier` : `npm ci`, `npm ci --ignore-scripts` dans `bureau/`, puis `node outils/verif.mjs` dans le dépôt remis (après le commit : une garde liste les fichiers par `git ls-files`).

### Recherches du contrôle final
- Bloquantes : les données du vendeur de la configuration ; les motifs de l'ancien projet (ceux des gardes existantes, avec leurs exceptions `NAMED_FILES` et `SHOWN_NAME` de `src/heritage.test.ts` ; l'ancien nom ne s'écrit pas en clair dans le script, une garde lit `outils/` : l'écrire en deux morceaux comme `outils/heritage.mjs`) ; `.claude/plans` ; liens claude.ai.
- Identité du dépôt remis : `applicationId` et `namespace` de `android/app/build.gradle`, `appId` de `capacitor.config.ts` : le contrôle échoue tant que l'identifiant de l'acheteur n'est pas posé (fiche 308, point 6), et c'est voulu.
- Avertissements seulement : vocabulaire d'atelier (nom de l'assistant, BACKLOG, MODELES, HISTORIQUE, DECISIONS, `fin-de-lot`, `/chaine`, sous-agent, « lot N », « point N »), `.claude/worktrees` cité dans la configuration de build.

## À faire dans le dépôt de travail, pour que rien de remis ne dépende de l'atelier
- `outils/docs-cites.mjs` : liste coupée en `DOCUMENTS` (remis, obligatoires) et `DOCUMENTS_ATELIER` (vérifiés seulement s'ils existent) ; l'outil ne réécrit alors aucun code.
- Renvois des documents remis vers des fichiers d'atelier (README 1 à 2, ETAT une dizaine, MISE_EN_PAGE environ 8, INVENTAIRE 9 dont la carte des fichiers d'atelier, `outils/LISEZMOI.md` 3, `outils/banc/LISEZMOI.md` 1) : lignes d'atelier encadrées par `<!-- atelier -->` et `<!-- /atelier -->` ; une mention au milieu d'une phrase relève de la réécriture de la fiche 308, point 7.
- L'entrée de l'outil dans INVENTAIRE et `outils/LISEZMOI.md`, dans un bloc d'atelier.
- Renvois morts du code vers `CLAUDE.md` (« règle N » : `src/architecture.test.ts`, `src/components/heartRateColors.ts`, `src/theme/tokens.css`) : selon la question A.

## Tests
- Fonctions pures : plan de ce qui part et reste, transformation de `package.json`, retrait des blocs (marqueur non refermé compris), recherche avec exceptions et noms de fichiers, lecture des sorties de git, refus d'une sortie dans le dépôt.
- Intégration sur un dépôt temporaire (comme `outils/fin-de-lot.test.mjs`) : un fichier 100755, un `.bat` en CRLF, un dossier dont le nom porte une espace, une étiquette et deux commits dans la source ; attendu : un commit, aucune étiquette, mode et CRLF gardés, dépôt source inchangé (HEAD, `git status`, index).

## Pièges de Windows
Commandes lancées avec une liste d'arguments, jamais une chaîne passée à un shell ; `npm` est un `.cmd` (`shell: true` avec seulement `cwd`) ; extraire sous Windows perd le bit exécutable (d'où `--chmod=+x`) ; `core.autocrlf=true` sur le poste, à neutraliser dans le dépôt neuf (`.gitattributes` décide).

## Vérification
`npm run verif` ; `node outils/livraison.mjs --a-blanc` ; un passage réel avec `--verifier` vers `D:\gong tracker\livraison-essai\`. Échecs attendus aujourd'hui, qui sont la liste de ce qui reste à la fiche 308 : identifiant du vendeur dans le paquet Java, `ARCHITECTURE.md` et `CONTRIBUER.md` absents. Ni banc ni essai au téléphone : aucun écran ne change.

## Tranché par l'orchestrateur
Le banc reste en entier ; `lancer-gtracker.bat` part ; nom et e-mail de l'auteur neutre dans la configuration hors dépôt (pas `gtracker@users.noreply.github.com`, qui désigne un compte existant) ; `.claude/worktrees` en simple avertissement.

## Questions posées à l'utilisateur le 23/11
- A. `ARCHITECTURE.md` créé dès maintenant (règles d'architecture et « Toujours »), livré, importé par `CLAUDE.md`, les renvois du code et des documents pointant vers lui ?
- B. `docs/HISTORIQUE.md` et `docs/DECISIONS.md` : livrés ou non ?
- C. Cliquets de vocabulaire : partent-ils du dépôt remis ?
