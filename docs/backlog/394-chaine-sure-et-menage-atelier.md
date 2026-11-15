# 394 · Chaîne sûre à plusieurs sessions, fiche du 326 extraite, ménage de l'atelier

Modèle | Réflexion : Sonnet | high

## Origine

Revue globale du 15/11 (sept auditeurs, constats relus par l'orchestrateur). L'utilisateur : « le problème de slash chaîne est un problème ». Outil de l'atelier seulement : aucun fichier de `src/` ni d'`android/`, aucun essai au téléphone.

## Constats

1. `.claude/skills/chaine/SKILL.md`, étape 6 (rapport ÉCHEC) : `git checkout -- src android outils` puis `git clean -fd -- src android outils`. Étape 5 (BLOQUÉ) : `git stash push -u`. Avec une autre session ouverte dans le même arbre (cas courant ici), ces commandes défont aussi son travail non commité.
2. `docs/BACKLOG.md`, élément 326 : son détail est `docs/backlog/319-revue-apres-fork.md` (424 000 caractères, environ 120 000 jetons), et `.claude/agents/lot.md` dit de lire le brief en entier. La partie « Lot 326 » tient en une centaine de lignes (vers les lignes 1314 à 1426, à relever).
3. `.claude/agents/Plan.md` et `doc.md` disent « lis CLAUDE.md » alors qu'il est déjà chargé (`lot.md` et `relecture.md` le disent bien).
4. `docs/MODELES.md` : ligne 33, « colonne du LISEZMOI du lot » alors que les briefs sont dans `docs/backlog/N-*.md` ; ligne 73, la liste de ce que refuse le crochet `garde-lot.mjs` est incomplète (il refuse aussi stash, checkout, restore, clean, reset : lot 354).
5. `docs/BACKLOG.md`, premier paragraphe de Maintenant : environ 5 000 caractères de chronique des APK 0.00.66 à 0.00.86, que git et les tags gardent. Relu à chaque `/reprise`, `/chaine`, `/clore`.
6. `docs/backlog/` : 77 fiches, dont une soixantaine sur des lots finis que plus aucune ligne du reste à faire ne cite.
7. `.claude/skills/chaine/SKILL.md` (13 800 caractères) : environ 30 % de justifications datées (« mesure du 13/11 », « seuil relevé le 11/11 »…).

## Attendu

1. **Chaîne** : la remise au propre après un ÉCHEC ne touche que les fichiers du lot. L'orchestrateur relève `git status --short` avant de lancer `lot` ; après un échec, il ne défait que ce qui est apparu ou a changé depuis ce relevé (`git checkout -- <fichiers>` un par un, suppression des seuls fichiers neufs du lot), jamais un dossier entier, jamais `git clean`. Pour un BLOQUÉ, le stash ne prend que les fichiers du lot (`git stash push -- <fichiers>`), sans `-u` global. Si l'arbre portait déjà des modifications qui ne sont pas du lot au lancement, la chaîne le dit et ne nettoie rien d'elles. Écrire la règle en une phrase en tête de la commande : « une autre session peut travailler dans le même arbre ».
2. **Fiche 326** : `docs/backlog/326-familles-aplaties.md`, extraite de la fiche 319 avec les réponses de l'utilisateur qui la concernent ; la ligne 326 du reste à faire pointe vers elle.
3. **Agents** : « lis CLAUDE.md » retiré de `Plan.md` et de `doc.md` (formule de `lot.md`).
4. **MODELES** : les deux phrases corrigées.
5. **BACKLOG** : le paragraphe de Maintenant ne garde que l'APK installée (version, date, ce qu'elle ajoute, essais qui se font sur elle), en trois ou quatre lignes.
6. **Fiches closes** : déplacées dans `D:\gong tracker\atelier\backlog-clos\` (dossier à créer) : toute fiche qu'aucune ligne de `docs/BACKLOG.md` ni aucun document de `docs/` ne cite encore, et la fiche 319 une fois la 326 extraite si plus rien d'autre ne la cite (sinon la laisser et le dire). Avant de déplacer : relever les citations par Grep dans `docs/`, `CLAUDE.md`, `.claude/`, `outils/` ; une fiche citée reste. `npm run verif` (ligne « documents ») doit passer après.
7. **chaine/SKILL.md** : justifications datées retirées quand la consigne tient sans elles ; aucune consigne perdue (relecture ligne à ligne, lister dans le rapport ce qui a été retiré).

## Vérification

`node outils/backlog.mjs` sans alerte ; `npm run verif` (documents) ; les tests du crochet et de `fin-de-lot` passent toujours. Rapport : liste des fiches déplacées, fiches gardées et pourquoi.
