# 354 · Gardes des agents par crochet plutôt que par consigne

Sonnet | high. Outil de l'atelier : rien dans `src/`, aucun essai au téléphone, pas de version à augmenter.

## Pourquoi

Un agent qui code s'est écarté deux fois, le 13/11, d'une consigne d'édition. Le crochet `.claude/hooks/garde-lot.mjs`, branché dans l'en-tête de `.claude/agents/lot.md`, ne refuse aujourd'hui que `git commit`, `git push` et la modification de `package.json`. Un crochet est déterministe, une consigne ne l'est pas. Source : recommandation 7 de `D:\gong tracker\atelier\analyse-agents-1311\analyse-organisation-agents.md` (lignes 153 à 157 seulement).

## Ce qui est demandé

Le crochet de l'agent `lot` refuse aussi, avec un message d'une ligne qui dit quoi faire à la place (« dis-le dans ton rapport ») :

1. **Les commandes git qui défont un travail** : `git stash`, `git checkout`, `git restore`, `git clean`, `git reset`, `git switch`, `git rebase`, `git merge`, `git worktree`, `git branch -D`, `git tag`. Restent permises les lectures (`status`, `diff`, `log`, `show`, `blame`, `ls-files`, `grep`). Attention aux faux refus : `git diff -- src/checkout.ts`, `git log --grep reset` ou `echo "git stash"` ne sont pas des commandes à refuser ; ne juger que le sous-commande, premier mot après `git` et ses options globales (`-C <dossier>`, `-c clé=valeur`), dans chaque morceau de la ligne (`;`, `&&`, `||`, `|`).
2. **L'édition d'un fichier par un script** : dans Bash, `sed -i`, `perl -i`, une redirection `>` ou `>>` vers un fichier du dépôt, `tee` vers un fichier du dépôt, `node -e`/`python -c` qui écrit. Une redirection vers `/dev/null`, vers le dossier temporaire du système ou vers un dossier de brouillon reste permise. Viser les formes courantes et sûres à reconnaître ; dire dans le rapport ce qui n'est pas couvert, sans chercher l'exhaustif.
3. **L'écriture hors du dépôt** par Edit ou Write (hors dossier temporaire du système et brouillon), et **dans `docs/` hors de `docs/backlog/`**.
4. **L'écriture hors de la liste du lot**, quand cette liste existe : si le fichier `.claude/lot-fichiers.json` existe, Edit et Write ne passent que sur les chemins qu'il autorise. Forme : `{ "autorises": ["src/pages/StatisticsPage.tsx", "src/pages/**", "docs/INVENTAIRE.md"] }`, chemins relatifs à la racine du dépôt, `**` et `*` compris. La liste sert aussi d'exception aux points 3 (un fichier de `docs/` cité dedans devient permis) ; elle ne lève jamais le refus de `package.json`, ni ceux des points 1 et 2. Sans ce fichier, les points 1 à 3 valent seuls. Ce fichier est écrit par l'orchestrateur, jamais par l'agent : le crochet refuse que l'agent l'écrive ou le supprime, comme il refuse toute écriture dans `.claude/`.

Les chemins se comparent sans tenir compte de la casse de la lettre de lecteur ni du sens des barres (`d:\gong tracker\Gtracker\…`, `D:/gong tracker/Gtracker/…`, `/d/gong tracker/Gtracker/…`).

## Comment

- **Écrire le nouveau crochet dans un fichier neuf** (« garde-lot-2 », à côté de l'ancien ; bascule faite par l'orchestrateur le 14/11, le fichier neuf a pris le nom de l'ancien), et ne pas toucher à `garde-lot.mjs` ni à `.claude/agents/lot.md` : un autre agent `lot` tourne en ce moment sous l'ancien crochet, qu'un fichier à moitié écrit bloquerait. L'orchestrateur fera lui-même la bascule (renommage et en-tête de l'agent) une fois le lot vérifié. Le nouveau fichier reprend les trois refus de l'ancien.
- La décision est une fonction pure exportée, `juger({ tool_name, tool_input }, { racine, liste })`, qui rend `null` ou le message du refus ; le bas du fichier lit l'entrée standard, appelle la fonction et sort en 2 avec le message sur la sortie d'erreur, ou en 0. Une entrée illisible sort en 0, comme aujourd'hui.
- Tests dans `.claude/hooks/garde-lot.test.mjs` (`node --test`), une trentaine de cas : chaque refus, et pour chacun les commandes voisines qui doivent passer. Les brancher dans `npm run verif` de la même façon que `outils/backlog.test.mjs` l'est.
- `.claude/skills/chaine/parallele.md` : une ligne qui dit que, pour des lots lancés dans le même dossier, l'orchestrateur écrit `.claude/lot-fichiers.json` avant le lancement et le retire après le dernier rapport ; préciser que la liste vaut alors pour tous les agents en cours (elle est l'union de leurs fichiers).
- `.gitignore` : `.claude/lot-fichiers.json`.

## Ce qui n'est pas demandé

- Rien dans `src/`, `android/` ni `outils/` hors du branchement du test dans la vérification : un autre lot (353) travaille dans `outils/` (`fin-de-lot.mjs`, `backlog.mjs`, `backlog.test.mjs`, `LISEZMOI.md`) et dans `.claude/skills/chaine/SKILL.md`. Si le branchement du test demande de toucher `outils/verif.mjs`, ne changer que la ligne nécessaire et le dire.
- Pas de commit, pas de version, pas de modification de `docs/BACKLOG.md`.
- Les autres agents (`doc`, `banc`, `relecture`, `Plan`) gardent leurs en-têtes.

## Vérification

`node --test .claude/hooks/garde-lot.test.mjs`, puis `node outils/verif.mjs --rapide`. Dans le rapport : la liste des refus, ce qui n'est pas couvert au point 2, et le geste exact de bascule que l'orchestrateur doit faire.
