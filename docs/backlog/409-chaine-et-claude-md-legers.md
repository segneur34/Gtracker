# 409 · La commande `/chaine` et `CLAUDE.md` allégés, la fiche 319 sortie du dépôt

Modèle | Réflexion : Opus | high

## Origine

Relevé le 15/11 au soir, en notant le paquet de la revue (lots 394 et 395, fiches `394-chaine-sure-et-menage-atelier.md` et `395-claude-md-allege.md` : leur méthode vaut ici). Outil de l'atelier : aucun fichier de `src/`, d'`android/` ni d'`outils/`, aucun essai au téléphone.

Relevé du 15/11 : `.claude/skills/chaine/SKILL.md` 15 400 caractères (13 800 avant le lot 394, qui devait la condenser) ; `CLAUDE.md` 20 200 caractères pour une cible de 17 000 ; `docs/backlog/319-revue-apres-fork.md` 424 000 caractères, encore citée par les fiches 318 et 331, par la ligne 409 et par un titre de « Ça attend une occasion » de `docs/BACKLOG.md`.

## Méthode imposée (celle du lot 395)

Aucune règle ne disparaît : une phrase ne sort d'un fichier que si sa règle est écrite, mot pour mot ou plus précisément, à l'endroit où le fichier renvoie. Le rapport donne un tableau « retiré de … → où la règle vit maintenant », que la relecture contrôle ligne à ligne. Mesure : caractères avant et après, par fichier.

## A. `/chaine` (cible : 11 000 caractères au plus pour `SKILL.md`)

1. Le fichier principal ne garde que le chemin ordinaire : argument, modèle, limite, relevé de départ, garde-fous (maquette, plan), lancement, rapport FAIT (vérification, relecture, banc, fin de lot), ce qui se demande à l'utilisateur, arrêt.
2. Les cas rares partent dans un fichier voisin lu seulement quand ils arrivent, comme `parallele.md` l'est déjà : BLOQUÉ et ÉCHEC en entier (`incidents.md`), la construction de l'APK à l'arrêt si elle pèse. Le principal garde pour chacun une ligne qui dit quand lire le fichier, et la règle de sûreté qui ne doit jamais attendre une lecture : ne défaire, ranger et commiter que les fichiers du lot, jamais `git clean`, jamais un dossier entier, jamais le stash d'un fichier d'une autre session.
3. Les justifications (mesures, « vu le… », explication du cache) sortent quand la consigne tient sans elles ; ce qui est une raison utile à qui doit trancher un cas limite reste, en une proposition.
4. Ajouts demandés par l'usage, en une ligne chacun (à écrire, ils manquent) :
   - un lot de documentation ou d'outil que le crochet de `lot` refuse (`docs/` hors `docs/backlog/`, `.claude/`) : `docs/` s'ouvre par `.claude/lot-fichiers.json` (le crochet laisse passer un fichier de `docs/` qui est dans la liste) ; `.claude/` ne s'ouvre jamais à `lot` et part sur un agent général au modèle de la fiche ;
   - la version en `0.MM.NN` : après `.99`, le nombre du milieu augmente (tant que `fin-de-lot.mjs` ne le fait pas seul, élément 413 : poser la version à la main à ce passage) ;
   - la limite de trois lots avec essais ne retient pas un lot validé sur lecture : c'est déjà dit, vérifier que le tableau de bord (`outils/backlog.mjs`, phrase « Rien avant validation ») ne contredit pas la commande, et sinon le signaler dans le rapport sans toucher au script (hors lot).
5. `docs/MODELES.md` et les autres commandes (`reprise`, `clore`, `todo`) : seulement accordés si un renvoi change ; pas de réécriture.

## B. `CLAUDE.md` (cible : 17 000 caractères au plus)

1. Piste principale, à peser entrée par entrée : « Où ajouter quoi ». Reste dans `CLAUDE.md` ce qu'un agent enfreindrait sans le savoir à presque chaque lot (texte visible par `t`, couleurs et styles en ligne, calcul pur et son test, donnée propre à une session, famille et capacités plutôt qu'un nom de calcul en dur). Les recettes rares (calcul de support neuf, section de module, métrique de manœuvre, réglage utilisateur, calcul de glisse neuf, page d'analyse) vont dans `docs/DEVELOPPER.md`, section « Où ajouter quoi », mot pour mot, et `CLAUDE.md` garde une ligne par recette : son déclencheur et le renvoi. `docs/DEVELOPPER.md` part chez l'acheteur : y écrire sans renvoi à `CLAUDE.md` ni à l'atelier.
2. `.claude/agents/lot.md` et `Plan.md` : dire de lire l'entrée de `docs/DEVELOPPER.md` quand le lot ajoute une de ces choses (une ligne), puisqu'ils ne l'auront plus sous les yeux.
3. Autres doublons trouvés en relisant (table « Avant de toucher à », décisions transverses déjà dans `docs/DECISIONS.md`, en-tête) : même méthode. La numérotation des règles 1 à 14 ne bouge pas (`src/` les cite par leur numéro), leur énoncé non plus.
4. Si 17 000 ne s'atteint pas sans perdre une règle ou sans rendre un renvoi obligatoire à chaque lot, s'arrêter au-dessus et le dire, avec ce qui pèse encore.

## C. Fiche 319

1. Relever ce que les fiches 318 et 331 et `docs/BACKLOG.md` (titre de condition en gras de « Ça attend une occasion », élément 308) tirent encore de la 319 ; recopier dans chacune ce qui lui sert encore (réponses de l'utilisateur du 11/11 comprises), comme le lot 394 l'a fait pour la 326.
2. Copier la 319 dans `D:\gong tracker\atelier\backlog-clos\` (le dossier existe depuis le lot 394), vérifier la copie (taille identique), puis la retirer du dépôt (`git rm`), et corriger les citations (fiches 318, 331, 394 si elle la cite comme un fichier présent, et tout document ou outil : Grep `319-revue` dans `docs/`, `CLAUDE.md`, `.claude/`, `outils/`). Un script d'`outils/banc/` qui la cite : le signaler, ne pas y toucher (hors lot).
3. Le titre de condition de `docs/BACKLOG.md` qui cite « la fiche 319 » et les deux titres voisins restés sans élément : ne pas les modifier, les signaler à l'orchestrateur, qui tient ce fichier.

## Limites

- Fichiers : `.claude/skills/**`, `.claude/agents/*.md`, `CLAUDE.md`, `docs/DEVELOPPER.md`, `docs/MODELES.md`, `docs/backlog/318-*.md`, `331-*.md`, `394-*.md`, `409-*.md`, la fiche 319 (retirée). Rien d'autre, et jamais `docs/BACKLOG.md`, `.claude/settings*.json`, `.claude/hooks/`.
- Pas de commit (hors `git rm` de la 319, qui ne fait que préparer), pas de `git stash`, `checkout`, `restore`, `clean`.

## Vérification

`node outils/docs-cites.mjs` et `node outils/docs-inventaire.mjs` passent ; les tests qui citent `CLAUDE.md` passent (`src/architecture.test.ts`, lancé seul) ; `node outils/backlog.mjs` sans alerte. Rapport, 40 lignes au plus : caractères avant et après par fichier, les deux tableaux « retiré → où la règle vit », ce qui n'a pas pu maigrir et pourquoi.
