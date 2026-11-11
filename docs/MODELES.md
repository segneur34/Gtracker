# Quel modèle pour quelle tâche

Tout l'atelier (`.claude/`, ce fichier) part à la livraison.

Claude Code propose quatre modèles, du plus lourd au plus léger : Fable 5.2 (alias `fable`, Claude Code 2.1.321 ou plus), Opus 5.5, Sonnet 5.5, Haiku 5.5. Le poids de chacun dans le quota de l'abonnement n'est pas documenté : à mesurer par `/usage` après un paquet. Le choix se fait **par conversation** : changer de modèle en cours de lot vide le cache et perd le raisonnement en cours. Ce fichier dit quel modèle et quel effort pour quelle tâche, et quels sous-agents s'en chargent.

Vérifié le 10/11/2026 sur `code.claude.com/docs` et la page de Fable.

## Tableau

| Tâche | Modèle | Effort | Où |
|---|---|---|---|
| Lint, typecheck, tests, build : lancer et lire les échecs | aucun agent | - | conversation (commandes dans `CLAUDE.md`) |
| Recherche dans le code (où est X, qui appelle Y) | Haiku | medium | sous-agent `Explore` |
| Relire un `adb logcat`, un dump du banc, un journal | Haiku | low | sous-agent (`Explore` ou agent ponctuel) |
| Banc : lancer un passage, relever le texte avant/après, les erreurs de console | Sonnet | low | conversation (`passe.mjs`, commandes dans `CLAUDE.md`) ; sous-agent `banc` pour lire un long diff |
| Passe de doc après un lot validé (ETAT, HISTORIQUE, INVENTAIRE) | Sonnet | medium | sous-agent `doc` ou conversation Sonnet |
| Lot « medium » : retouches, libellés, réglages, CSS, petit bug localisé, mémoire, commit (l'APK est construite par l'orchestrateur à l'arrêt d'un paquet, voir `/chaine`) | Sonnet | medium | conversation `claude --model sonnet` |
| Lot « medium » où la vérification compte (bug avec repro, banc à compléter) | Sonnet | high | conversation Sonnet |
| Relire le diff d'un lot Opus ou Fable avant son commit « à valider » : défauts confirmés seulement, 20 lignes | Sonnet | high | sous-agent `relecture` |
| Classer des demandes en lots, écrire les briefs | Opus | medium | conversation Opus |
| Plan d'un lot Opus high ou Fable (fichiers touchés, pièces à réutiliser, étapes, questions), avant que `lot` ne code ; rien pour un lot Sonnet medium, le brief suffit | Opus | high | sous-agent `Plan`, lancé par `/chaine` ; hors chaîne, `claude --model opusplan` (plan sur Opus, exécution sur Sonnet) |
| Lot « high » : page ou fonctionnalité neuve sur plusieurs fichiers, bug multi-fichiers, relecture (`/code-review`) | Opus | high | conversation `claude --model opus` |
| Algorithmique du noyau (vent, manœuvres, cadence, sauts, pumping, résumé), bug sans cause connue (ex. pauses `trkseg` comptées dans la distance), refonte transverse (famille/traitement), audit général, décision d'architecture | Fable | high, xhigh si la première passe ne tranche pas | conversation `claude --model fable` |
| Orchestrer un paquet du mode chaîne : lancer `lot`, `npm run verif`, `relecture`, le banc, poser la version, commiter, tenir `docs/BACKLOG.md`, trancher les questions mineures | Fable | medium, high si le paquet a un lot du noyau ou une question de produit ouverte | conversation `/chaine` |

Effort (`/effort`) : `low` pour un échange court qu'on relit à chaque pas (renommage), `medium` pour un travail cadré (défaut de Fable 5.2 et de Sonnet 5.5), `high` quand la vérification compte (bug), `xhigh` pour un raisonnement plus profond, `max` pour un problème dur, en session seulement. Une session de Sonnet démarre à `medium`, Fable 5.2 aussi par défaut (5.1 était à `high`) ; les réglages de l'utilisateur forcent `high` sur Fable 5.2 et Opus 5.5 : pour tenir `/chaine` à `medium`, taper `/effort medium` à l'ouverture.

## En pratique

- **Au brief** : remplir la colonne « Modèle | Réflexion » du LISEZMOI du lot avec les valeurs du tableau.
- **À la reprise** : ouvrir la conversation avec `claude --model <alias>` (`sonnet`, `opus`, `fable`, `opusplan`), puis `/effort <niveau>` si le brief en demande un autre que le défaut. `/model` en session : `s` change pour la session, `Entrée` écrit le défaut dans les réglages.
- **Un lot, un modèle** : un lot commence et finit sur le même modèle. Hors mode chaîne, si Sonnet cale (« il ne savait pas assez »), relancer le lot sur Opus dans une conversation neuve avec le brief ; ne pas changer de modèle en route. En mode chaîne, `/chaine` relance par le paramètre `model` de l'agent `lot`.
- **Effort avant modèle** : quand le problème est « il n'a pas assez essayé », remonter l'effort d'un cran avant de changer de modèle.
- **Fable** : décrire le résultat attendu et lui laisser la main ; ne pas lui redire de vérifier, il le fait seul ; un tour peut durer plusieurs minutes.
- **`/clear` entre deux lots, hors mode chaîne** (qui en enchaîne plusieurs dans une conversation) ; `/context` quand une session devient lourde ; `/usage` pour lire la part de chaque sous-agent et les recommandations (touche `w` pour la semaine).
- **Mauvais modèle, à dire tout de suite** : quand la demande arrive sur un modèle nettement inadapté d'après le tableau (une retouche de libellé sur Fable, un bug du noyau ou une page neuve sur Sonnet), Claude le signale dans son premier message, avant tout travail : le modèle recommandé et pourquoi, en deux phrases, puis il attend la réponse. Il faut un gros décalage, dans un sens comme dans l'autre (trop lourd : quota gaspillé ; trop léger : risque de caler), pas un simple cran d'écart. Changer de modèle, c'est une conversation neuve (`/clear`, puis `claude --model <alias>` ou `/model` et `s`, et recoller la demande) : d'où l'intérêt de le dire avant d'avoir commencé, jamais en cours de lot.

## Sous-agents (`.claude/agents/`)

Tous repartent à froid, donc ils valent pour une étape autonome à sortie volumineuse, pas pour une retouche de deux lignes. Ils rechargent `CLAUDE.md`, sauf `banc` et `Explore` qui s'en passent (`omitClaudeMd`) ; aucun ne voit la conversation ni la mémoire automatique (d'où les pièges du banc dans `outils/banc/LISEZMOI.md`, pas dans une mémoire) ; aucun ne peut appeler un autre agent (`Agent` absent de leurs outils) : seule la conversation qui tient `/chaine` ou `/clore` les enchaîne. Leur modèle et leur effort sont fixés dans leur en-tête et priment sur celui de la session ; les gros fichiers (INVENTAIRE, ETAT, HISTORIQUE, LISEZMOI du banc) se lisent par Grep puis `offset`, jamais en entier.

Modèle et effort de chacun se lisent dans son en-tête (`lot` les reçoit à chaque appel d'après la colonne « Modèle | Réflexion » du brief).

- `Explore` : recherche en lecture seule, rend des `chemin:ligne`.
- `Plan` : plan d'exécution d'un lot, lecture seule.
- `banc` : lance le banc et lit son diff avant/après quand la sortie est longue.
- `relecture` : relit le diff non commité d'un lot Opus ou Fable ; défauts confirmés seulement ; ne corrige rien.
- `doc` : la passe de documentation d'un lot validé ; ne touche pas au code, ne committe pas.
- `lot` : exécute un lot d'après son brief et rend un rapport FAIT / BLOQUÉ / ÉCHEC ; ne committe pas, ne pose pas la version, ne tranche aucune décision de l'utilisateur.

Tout autre sous-agent sans modèle dans son en-tête (fork, agent général) tourne sur Sonnet (`CLAUDE_CODE_SUBAGENT_MODEL` dans les réglages de l'utilisateur), jamais sur le modèle de la session. Pour appeler un agent : « avec l'agent banc, lis ce diff », ou `@banc`. Cache : une heure pour la conversation principale, cinq minutes pour les sous-agents ; un `SendMessage` à `lot` après la vérification et la relecture lui fait relire tout son contexte, ce qui reste préférable à un agent neuf.

## Commandes (`.claude/skills/`)

Invocation manuelle seulement, tapées au début ou à la fin d'une session.

- `/reprise [ce qu'on veut faire]` : début de session ; relit mémoire, `docs/BACKLOG.md` et son tableau de bord (`node outils/backlog.mjs`), git, dit où on en est, vérifie le modèle.
- `/chaine [lot N | ok partout | ok sauf N : … | consignes]` : mode chaîne ; enchaîne les éléments d'Ensuite de `docs/BACKLOG.md` jusqu'à un paquet à valider.
- `/todo [notes en vrac | réponse N : … | Q n : …]` : met au propre les notes en vrac dans `docs/BACKLOG.md`, rangées par trois questions posées en clair ; sans argument, la revue de la semaine (tableau de bord, puis une seule salve de questions).
- `/clore [ok partout | ok sauf N : … | ok sauf lot L : … ] [avec envoi]` : fin de session ; commit, résultats d'essais et passe doc, `docs/BACKLOG.md`, point de reprise, compte rendu et prompt de reprise. Rien n'est envoyé sur GitHub sans « avec envoi » (accord redemandé à chaque fois).

## Mode chaîne

La boucle entière (démarrage, FAIT, BLOQUÉ, ÉCHEC, arrêt, APK) est dans la commande `/chaine` (`.claude/skills/chaine/SKILL.md`), seule description qui fait foi, et la clôture dans `/clore`. Démarrage : `claude --model fable`, `/effort medium`, `/reprise`, puis `/chaine`.

Fable 5.2 conduit le paquet, à `medium` ; `high` seulement si le paquet a un lot du noyau ou une question de produit ouverte. Il est retenu comme chef d'orchestre pour son jugement sur les questions (il tranche les mineures, ne pose que les majeures), pas pour du volume. Il ne lit que des rapports bornés (40 lignes pour `lot`, 20 pour `relecture`). Sa part du quota se mesure par `/usage` après le premier paquet.

## Réglages de l'utilisateur (hors dépôt)

Dans ses réglages personnels : `model` vaut `fable` ; `CLAUDE_CODE_SUBAGENT_MODEL` vaut `sonnet` ; `modelSettings` force `high` sur Fable 5.2 et Opus 5.5, `medium` sur Sonnet 5.5. Ils ne se changent que sur demande. Le hook `.claude/hooks/garde-lot.mjs`, branché dans l'en-tête de l'agent `lot`, refuse `git commit`, `git push` et toute modification de `package.json`.

## Ajuster le tableau

Après trois ou quatre lots, noter ici les tâches qui ont dû remonter d'un modèle (Sonnet → Opus, Opus → Fable) et celles qui ont tenu un cran plus bas que prévu, et corriger le tableau.

## Phrase à coller dans une demande

En tête ou en fin de message, pour déclencher la vérification du modèle :

> Avant de commencer : d'après docs/MODELES.md, dis-moi si le modèle de cette session (et son effort) convient à cette demande. S'il y a un gros décalage dans un sens ou dans l'autre, propose le modèle et l'effort adaptés en deux phrases et attends ma réponse ; sinon, dis « modèle ok » et enchaîne.

Version courte : « Modèle ok pour ça ? (docs/MODELES.md) Sinon propose avant de commencer. »
