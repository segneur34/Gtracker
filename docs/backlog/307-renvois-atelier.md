# 307 · Renvois d'atelier retirés de `src/`

Origine : `docs/backlog/160-dette-audit-vente.md` (« Renvois de l'atelier dans le code », « Vocabulaire »). Ce brief la remplace pour l'exécution.

## But

Un acheteur lit `src/` sans l'atelier : ni le reste à faire, ni l'historique, ni les questions ne lui sont livrés. Un commentaire doit donc tenir seul. Rien de visible ne change : **seuls des commentaires et des titres de test sont modifiés**, jamais une ligne de code, jamais une chaîne affichée.

## Ce qui part, et par quoi on le remplace

1. **« lot N »** (« lot 187 », « (lot 304, 11/11) », « depuis le lot 322 ») : la parenthèse se supprime ; si la phrase s'appuie dessus (« depuis le lot N, X »), on la réécrit pour dire le fait (« X »), sans date ni numéro.
2. **« Qnn »** (« Q32 », « Q66 ») : supprimé de la même façon.
3. **Dates sans année** de l'atelier (« 30/10 », « décision du 27/10 », « maquette du 31/10 »), accolées à un renvoi ou non : la date se supprime, la décision reste dite (« décision du 27/10 : X » devient « X », ou « choix du produit : X »). Une date qui fait partie du métier (un format de date, un exemple) reste. G1 et G2 n'ont retiré que les dates accolées : G4 finit par un passage sur tout `src/` pour les autres.
4. **« point N »** (« §10, point 142 », « HISTORIQUE, point 220 », « point 104 ») : remplacé par **la raison en clair**, en une proposition courte, si le commentaire ne la dit pas déjà ; s'il la dit, le renvoi se supprime simplement. La raison se lit dans la copie figée de l'historique, hors dépôt : `D:\gong tracker\atelier\historique-avant-1111\HISTORIQUE.md` (points 1 à 339 ; Grep sur `^N\. ` puis Read des quelques lignes ; ne jamais lire ce fichier en entier). Attention : plusieurs fichiers citent « point 104 » pour le pumping alors que c'est le point 110.
5. **« l'utilisateur »** quand le mot désigne celui qui a décidé du produit (« l'utilisateur a voulu », « décision de l'utilisateur ») : tournure impersonnelle (« choix du produit : … », « décidé : … »). Quand il désigne la personne qui se sert de l'application, il reste.
6. **Versions d'atelier** accolées à un renvoi (« version 0.4.61 », « 0.00.12 ») : supprimées avec lui, sauf si le code en dépend (numéro de format, de migration).

Ne se touchent pas dans ce lot : « DECISIONS §N », « CLAUDE.md », « règle N », « MISE_EN_PAGE » (leur sort se décide à la livraison, lot 308) ; les compter dans le rapport.

## Règles

- Un commentaire réécrit dit **pourquoi** le code est ainsi, en français, dans le style du fichier ; il ne raconte pas l'histoire (« avant », « a été remplacé ») sauf si c'est le piège à connaître.
- Ne jamais introduire le vocabulaire de la course à pied, du vélo ou de l'Entraînement, ni le nom « Tracker » : `src/landWords.test.ts` compte ces mots et son relevé ne peut que baisser. Si la raison d'un ancien point ne se dit qu'avec eux, la dire autrement ou supprimer le renvoi.
- Faux amis à laisser : « lot » au sens courant (« un lot de points »), « point 0 » ou « point 1 » d'une trace, un identifiant ou une chaîne qui contient « Q1 ». Les signaler dans le rapport.
- Fichiers de test (`*.test.ts`, `src/test/`) : même nettoyage, titres de test compris (`it('… (lot 187)')` devient `it('…')`) ; le nom d'un test ne doit pas devenir identique à celui d'un autre du même fichier.
- Édition par Edit ou Write seulement, jamais par PowerShell ni par `sed` sur des fichiers accentués.

## Groupes de dossiers

| Groupe | Dossiers | Quand |
|---|---|---|
| G1 | `src/core`, `src/settings`, `src/planning`, `src/recording` | en parallèle du lot 328 |
| G2 | `src/library`, `src/platform`, `src/components`, `src/assets`, `src/theme`, `src/tutorials`, fichiers à la racine de `src/` | en parallèle du lot 328 |
| G3 | `src/hooks`, `src/pages` | après les lots 328 et 329 |
| G4 | `src/sailing`, `src/surfing`, `src/test`, `android/app/src/main/java` ; puis le test de garde et `docs/GLOSSAIRE.md` | après les lots 328 et 329 |

Chaque agent ne touche que ses dossiers : d'autres agents travaillent en même temps dans le même arbre (jamais de `git stash`, `checkout`, `restore` ni `clean` ; un échec de typecheck ou de test hors de ses fichiers s'ignore et se signale).

## Vérification de chaque groupe

- `grep -rnE "\blot [0-9]+|\bQ[0-9]{1,3}\b|\bpoints? [0-9]+" <ses dossiers>` : ne rend plus que les faux amis listés dans le rapport.
- `npx tsc -b` et `npm run lint` verts ; `npx vitest run src/landWords.test.ts src/architecture.test.ts` vert ; `git diff --stat` ne montre que ses dossiers ; `git diff` ne montre aucune ligne de code modifiée hors commentaires et titres de test.

## G4, en plus

- Test de garde dans `src/architecture.test.ts` (qui lit le disque) : refuse dans `src/`, tests compris, les renvois « lot N », « Qnn » et les renvois à l'historique (« §10 », « HISTORIQUE », « point N » au sens du journal), avec une liste nommée d'exceptions pour les faux amis, qui ne fait que diminuer ; contre-épreuve faite (un renvoi ajouté fait échouer le test).
- `docs/GLOSSAIRE.md`, une page : « course » (cap du GPX `courseDeg`, parcours de balises `markCourse` / `CourseMark` / `courseLegs`), « mark » (`SessionMark` repère, `CourseMark` balise), les noms du calcul d'une session (`SportType`, `sport`, `base`, support, calcul, activité), les noms de la fréquence cardiaque (`heartRateBpm`, `bpm`, `hr`). Aucun renommage dans ce lot. L'ajouter à `DOCUMENTS` de `outils/docs-cites.mjs` et à la liste de `CLAUDE.md` est fait par l'orchestrateur.
