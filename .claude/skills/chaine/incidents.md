# Rapports BLOQUÉ et ÉCHEC (lu par `/chaine`, étapes 5 et 6, quand l'un d'eux arrive)

Rappel de sûreté : une autre session peut travailler dans le même arbre. Tu ne défais, ne ranges et ne mets dans un stash que les fichiers du lot (ce qui est apparu ou a changé depuis le relevé de départ, hors `docs/BACKLOG.md` et `docs/backlog/`), un par un ; jamais un dossier entier, jamais `git clean`, jamais `git checkout -- .`, jamais un fichier d'une autre session dans un stash.

## 5. Rapport BLOQUÉ (une question « Décision n » sans réponse), trois cas

- Question mineure (nommage, ordre, choix d'implémentation, seuil que `DECISIONS.md` encadre déjà) : tranche-la toi-même, note-la dans le détail de l'élément avec « tranchée par l'orchestrateur » et pourquoi, et renvoie la réponse au même agent par `SendMessage`.
- Question majeure (produit, donnée perdue, seuil ou pré-réglage nouveau) et aucun fichier du lot modifié (`git status --short` identique au relevé de départ, hors `docs/BACKLOG.md` et `docs/backlog/`) : pose-la à l'utilisateur (`AskUserQuestion`, et `PushNotification` vers le téléphone si l'outil est là) ; à la réponse, `SendMessage` au même agent.
- Question majeure et fichiers du lot modifiés : `git stash push -u -m "lot N bloqué (Q n)" -- <fichiers du lot>` (la liste de ce qui est apparu ou a changé depuis le relevé de départ, hors `docs/BACKLOG.md` et `docs/backlog/` ; le `-u` ne porte que sur ces chemins, jamais sur tout l'arbre), ligne en Maintenant avec l'état « bloqué (Q n), stash », et la question dans « Questions » avec ta réponse par défaut et la date ; puis élément suivant qui n'en dépend pas ; les questions en attente se posent toutes ensemble à l'arrêt (`/chaine`, § 4). Reprise dans la même conversation : `git stash pop`, puis `SendMessage` au même agent avec la réponse ; dans une autre conversation : `git stash pop`, puis un agent `lot` neuf avec le brief, les réponses, et la mention que l'arbre porte déjà le travail commencé.

## 6. Rapport ÉCHEC

Lis sa section « Échec » et compare `git status --short` au relevé de départ. Remets au propre **seulement ce qui est apparu ou a changé depuis ce relevé** : `git checkout -- <fichier>` un par un pour les fichiers suivis du lot, suppression (`rm <fichier>`) des seuls fichiers neufs du lot ; `docs/BACKLOG.md` n'est jamais touché. Un fichier que l'arbre portait déjà modifié au relevé (d'une autre session) n'est pas défait, même si le lot y a aussi touché : dis-le dans l'état de la ligne. Si l'arbre portait au départ des modifications qui ne sont pas du lot, dis-le et ne nettoie rien d'elles.

Puis relance une fois sur le modèle du dessus (Sonnet → Opus → Fable, paramètre `model`) avec le brief et cette section « Échec » jointe ; au second échec, note-le dans l'état de la ligne, renvoie-la en Ensuite, et passe au suivant.
