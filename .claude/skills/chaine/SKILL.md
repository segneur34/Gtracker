---
name: chaine
description: Mode chaîne sur Gtracker : enchaîne les éléments d'Ensuite de docs/BACKLOG.md (agent lot, `npm run verif`, agents relecture et banc), commite chaque lot vérifié « à valider », ne s'adresse à l'utilisateur que pour une vraie décision, s'arrête quand un paquet est prêt.
argument-hint: "[lot N | ok partout | ok sauf N : … | ok sauf lot L : … | consignes]"
disable-model-invocation: true
---

# /chaine : on reprend la liste

Tu es l'orchestrateur du mode chaîne de Gtracker (le dépôt courant) ; ce fichier décrit la boucle, `docs/MODELES.md` y renvoie. `docs/BACKLOG.md` fait foi : son en-tête donne la forme des lignes (dont « dépend de » et l'état), les zones (l'ordre d'Ensuite est la priorité) et les règles. Tu organises et délègues : tu écris le moins de code possible et ne lis que les rapports des agents, jamais leur travail en détail.

**Une autre session peut travailler dans le même arbre** : tu ne défais, ne ranges et ne commites que les fichiers du lot, jamais ceux que tu n'as pas vus apparaître pendant ce lot ; jamais `git clean`, jamais un dossier entier, jamais un fichier d'une autre session dans un stash.

Argument reçu : `$ARGUMENTS`
- Vide : prendre le premier élément d'Ensuite dont « dépend de » est levé.
- `lot N` : commencer par l'élément N, s'il est prêt ; sinon dire ce qui le bloque.
- `ok partout` (tous les lots de Maintenant validés, essais et lecture compris), `ok sauf N : …` (essai N raté, tout le reste validé, lecture comprise) ou `ok sauf lot L : …` (lot L sans essai retenu, avec la remarque) : résultats à traiter d'abord (étape 1).
- Toute autre consigne (réponse à une question, élément à écarter, ordre à changer) : l'appliquer et la noter dans `docs/BACKLOG.md`.

## 0. Modèle de la conversation

Fable 5.2, effort `medium` ; `high` seulement si le paquet contient un lot du noyau ou une question de produit encore ouverte dans « Questions ». Sur un autre modèle ou un autre effort, dis-le en deux phrases et attends (« mauvais modèle », `docs/MODELES.md`) : changer de modèle est une conversation neuve.

## 1. Résultats d'essais, s'il y en a dans l'argument

Exactement l'étape 3 de `/clore` (`.claude/skills/clore/SKILL.md`), qui fait foi (essais, bogues, passe `doc` des lots validés, commit de la doc).

## 2. La boucle

Le code des lots peut s'écrire en parallèle ; tout le reste (vérification, relecture, banc, version, commit) se fait un lot à la fois, dans le dépôt principal et dans cet ordre, sinon version et HISTORIQUE se croiseraient.

**Lots en parallèle** : quand Ensuite a 2 ou 3 lots prêts, lis `.claude/skills/chaine/parallele.md` avant de les lancer (conditions, worktrees, rapatriement, nettoyage).

Pour chaque lot :
1. **Pas de limite de lots en attente** : les essais au téléphone ne bloquent plus le lancement d'un lot (décision de l'utilisateur du 23/11) ; `node outils/backlog.mjs` les liste toujours sous « Vous ».
2. Prendre le premier élément d'Ensuite dont « dépend de » est levé. **Relevé de départ** : `git status --short` avant de lancer le lot, gardé pour toute sa durée. Hors `docs/BACKLOG.md` et `docs/backlog/` (qui partent avec le commit suivant, du lot ou de la doc), les fichiers déjà modifiés ne sont pas du lot : restes d'un lot précédent de cette chaîne mal clos (étape 5 ou 6), le dire et s'arrêter ; sinon d'une autre session : les noter, le dire dans le compte rendu, ne jamais les nettoyer. Déplacer la ligne du lot en Maintenant, état « en cours ».
3. Deux garde-fous avant de coder, puis le lancement :
   - **Maquette d'abord** pour un lot qui change ce que l'utilisateur voit (page neuve, disposition, image de partage, thème) : si la ligne ou le brief ne cite pas une maquette validée, ne lance pas le lot ; traite-le comme BLOQUÉ par une question majeure (étape 5) et propose la maquette.
   - **Plan par l'agent `Plan`** pour un lot Opus high ou Fable (page ou fonctionnalité neuve, bug multi-fichiers, noyau) : lance-le avec le brief (plan d'un coup, 60 lignes au plus) ; confronte-le à `docs/DECISIONS.md` et aux règles de `CLAUDE.md`, tranche les questions mineures (notées dans le détail de l'élément), pose une majeure à l'utilisateur avant tout code (comme un BLOQUÉ), puis joins le plan au brief de `lot`. Rien de cela pour un lot Sonnet medium.
   - Le brief est le détail de l'élément (`docs/backlog/N-titre.md`) ; « à briefer » : écris-le d'abord dans ce fichier. Lance l'agent `lot` avec ce brief, le plan s'il y en a un, le modèle et l'effort de la ligne (paramètres `model` et `effort`), et les réponses déjà données aux questions dont il dépend. Dis-lui ce qu'il ne fait pas : pas de commit, pas de version, aucune décision de l'utilisateur ; ne toucher qu'aux fichiers du lot. La consigne cite le chemin de la fiche et ce qui n'y est pas, sans en recopier le contenu.
   - **Lot que le crochet de `lot` refuse** : un fichier de `docs/` hors `docs/backlog/` s'ouvre en l'écrivant dans `.claude/lot-fichiers.json` (format dans `parallele.md`) ; la liste contient alors aussi la fiche du lot, et tu la retires après le dernier rapport. `.claude/` ne s'ouvre jamais à `lot` : un lot qui y écrit part sur un agent général, au modèle et à l'effort de la fiche.
   - **Un lot gros se coupe d'avance** : un brief à plus de six points, ou un lot qui écrit aussi des scripts du banc, part en deux agents `lot` successifs, chacun avec son commit (partie A, puis partie B sur un agent neuf qui part du commit de la A) ; l'écriture ou l'adaptation de scripts du banc est une partie à part, sur Sonnet. Chaque consigne porte un budget : « vers 90 appels d'outils, si plus d'un tiers reste à faire, finis l'étape en cours et rends un rapport FAIT partiel qui dit ce qui reste » ; la suite part alors sur un agent neuf, de `git diff`.
   - **Lot long** qui n'a pas pu se couper d'avance : vers 45 minutes, demande à l'agent par `SendMessage` un point d'étape de dix lignes (fait, en cours, reste). Jamais de réveil à vide pour garder le cache chaud : il coûte un tour entier.
4. Rapport **FAIT** : vérification et relecture se lancent ensemble, dès le rapport (la relecture ne fait que lire : lui dire de ne lancer ni test ni build), pour que leurs retours partent à l'agent `lot` en un seul message. Le banc vient ensuite, seul : son serveur fait échouer `vitest` ; tant qu'un agent fait tourner le banc, aucune vérification ne se lance et aucun agent n'édite `src/`.
   - `npm run verif` depuis la conversation ; un échec revient à l'agent `lot` par `SendMessage` avec la sortie, une fois, puis c'est un ÉCHEC ;
   - `relecture` sur le diff non commité, pour les lots Opus et Fable seulement (sujet du lot, brief, décisions) ; un défaut confirmé revient à l'agent `lot` par `SendMessage`, une fois, puis `node outils/verif.mjs --rapide`. **Jamais sautée en silence** : si elle ne peut pas se faire (quota épuisé, agent en échec), commit quand même, état « à valider, relecture due » (`outils/backlog.mjs` l'affiche dans les alertes), dit dans le compte rendu d'arrêt ; elle se fait avant la validation, et l'état est retiré une fois faite ;
   - `node outils/banc/passe.mjs` depuis la conversation sur les scripts que le brief cite (texte de la page avant et après, identique pour un changement neutre) ; l'agent `banc` seulement pour lire un diff long.

   Puis écris dans le brouillon le message du commit (« à valider », style des commits récents) et, s'il y a des essais critiques ou douteux (quelques-uns par paquet), un fichier d'essais (une ligne `quoi → attendu` chacun), et lance `node outils/fin-de-lot.mjs <N> --message <fichier> [--essais <fichier>] [--fichiers <fichier>]` (`--lecture` sans essai au téléphone, `--en-cours` pour un lot coupé en parties, `--a-blanc` pour voir sans écrire) : il pose la version si `src/` ou `android/` a changé, l'état et les essais de la ligne, et commite (le détail est dans son en-tête). **Sans `--fichiers`, il commite tout l'arbre** : ne l'omets que si le relevé de départ n'avait rien d'autre que `docs/BACKLOG.md` et `docs/backlog/` ; sinon (relevé de départ ou autre session apparue depuis), passe-lui la liste des fichiers du lot, un chemin par ligne, fiche comprise. La version est en `0.MM.NN`, deux chiffres par nombre : après `.99` le nombre du milieu augmente, et le script le fait seul. `node outils/backlog.mjs --zone Maintenant` ou `--ligne <N>` lit une zone ou une ligne sans ouvrir tout le fichier.
5. Rapport **BLOQUÉ** (une question « Décision n » sans réponse) : lis `.claude/skills/chaine/incidents.md`, § 5 (question mineure tranchée par toi, majeure posée à l'utilisateur ou mise de côté par un stash des seuls fichiers du lot).
6. Rapport **ÉCHEC** : lis `.claude/skills/chaine/incidents.md`, § 6 (remise au propre des seuls fichiers du lot, une relance sur le modèle du dessus).

## 3. Ce que tu demandes à l'utilisateur

Seulement une vraie décision : choix de produit, donnée perdue, seuil à retenir, envoi. Pour le reste, tranche seul et dis-le en une ligne dans le compte rendu. Les questions se posent par `AskUserQuestion`, quatre au plus, une recommandation en tête. Une donnée qu'il détient (un GPX, un chiffre à l'écran) se demande en clair, pas par questionnaire.

## 4. Arrêt

Arrête la boucle, mets `docs/BACKLOG.md` à jour, lance `node outils/backlog.mjs` (sans erreur de forme), et propose `/clore` quand :
- un paquet de 2 ou 3 lots est « à valider » : construis alors l'APK (procédure au §12 d'ETAT, version déjà augmentée), pose son tag annoté `v<version>`, installe-la, et note-la dans la première ligne de Maintenant (« APK <version> installée le jj/mm (versionCode …). ») ; jamais `lot` ni `/clore` ne la construisent ;
- une compaction a eu lieu, ou `/context` dépasse environ 350 000 jetons : c'est le plafond, et il ne coupe jamais un paquet commencé, qui se finit toujours ;
- un paquet vient de finir, un autre est demandé et `/context` dépasse environ 200 000 jetons (décision prise là, jamais au milieu d'un paquet) : proposer `/clore` puis une conversation neuve (plutôt qu'un `/compact`) avant de le lancer ; si l'utilisateur préfère continuer, continuer sans redemander pendant le paquet ;
- tout ce qui reste est bloqué par des réponses de l'utilisateur : pose alors toutes les questions en attente en une fois (§ 3).

Compte rendu d'arrêt, en français courant : lots faits (commit, version), lots bloqués avec leurs questions et le stash qui les porte, lots dont la relecture est due, essais à faire par numéro, APK installée ou non, fichiers d'une autre session trouvés dans l'arbre et laissés tels quels s'il y en avait, et la phrase « `/clore` quand vous voulez ». Pas de journal : le compte rendu, git et HISTORIQUE suffisent. Rien n'est envoyé sur GitHub ici : c'est `/clore avec envoi`.
