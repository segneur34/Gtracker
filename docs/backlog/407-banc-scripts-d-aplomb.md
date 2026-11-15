# 407 · Banc : scripts à remettre d'aplomb

Modèle | Réflexion : Sonnet | medium

## Origine

Relevés pendant le paquet du 15/11 (lots 394 à 400 et 403). Outil de l'atelier : rien ne change dans `src/`, aucun essai au téléphone. Mode d'emploi et pièges du banc : `outils/banc/LISEZMOI.md` (gros fichier : Grep puis `offset`), journal des scripts : `outils/banc/SCRIPTS.md`, registre : `outils/banc/scripts.mjs`.

## Constats (vérifier chacun avant de corriger)

1. `notes` : un échec avant comme après, « Sans vent : deux repères dans la fiche », et le script lit parfois la page pendant « Lecture de la session… ». Trouver la cause de chacun : si l'application a changé (libellé, ordre), accorder le script ; si c'est une lecture trop tôt, attendre la fin de « Lecture de la session… » par une condition, pas par un délai fixe.
2. `partage` : deux échecs avant comme après ; le menu « … » commence maintenant par « Lieu ». Accorder le script à l'application d'aujourd'hui.
3. La fiche `docs/backlog/400-ouverture-analyse-legere.md` cite un script `manoeuvres-diagnostic` « qui n'existe pas sous ce nom » : dire sous quel nom il se lance (registre), et corriger la fiche ou le registre, au plus simple.
4. Un passage à quatre scripts de front (`-j 4`, le défaut) donne de faux échecs d'import, qui disparaissent un script à la fois (`-j 1`). Chercher la cause (attente trop courte sous charge, port, profil de Chrome, dossier de travail partagé) et la corriger si elle se trouve ; sinon, que le lanceur rejoue seul, une fois, un script en échec d'un seul côté avant de le déclarer en échec, et le dise dans sa sortie (« rejoué seul : réussi »). Un défaut de charge ne doit plus se lire comme une régression.
5. Le relevé d'avant est gardé en cache avec ses faux échecs : un relevé d'avant qui porte un échec ne se met pas en cache (ou se refait au passage suivant).
6. Une soixantaine de copies « avant » de vieux passages restent dans le dossier temporaire du poste (`git worktree list`). L'orchestrateur les retire lui-même (commandes `git worktree` refusées à l'agent `lot`) ; à l'agent : que le lanceur ne laisse plus s'accumuler ces copies (retirer à la fin d'un passage celles qui ne sont pas du commit comparé, ou n'en garder que les plus récentes ; `--garder` et `--nettoyer-avant` existent déjà : voir ce qu'ils font).

## Limites

- Fichiers : `outils/banc/**` et les deux fiches `docs/backlog/400-*.md` et `docs/backlog/407-*.md` seulement. Rien dans `src/`.
- Une autre tâche écrit des documents dans le même dossier pendant ce lot : ne toucher à rien d'autre, ignorer tout changement hors de ces fichiers.
- Si un échec de `notes` ou de `partage` révèle un vrai défaut de l'application, ne pas le corriger : le décrire dans le rapport (page, geste, attendu, obtenu).

## Vérification

`node outils/banc/passe.mjs notes partage --avant HEAD -j 1 --sans-cache` sans échec, puis un passage à quatre de front qui comprend un script d'import (`import-session`, `library`) sans faux échec, ou avec la mention du rejeu. Dire avant de le lancer combien de temps prend un passage, et ne pas dépasser une demi-heure de banc au total. Mettre à jour `LISEZMOI.md` et `SCRIPTS.md` du banc pour ce qui change.
