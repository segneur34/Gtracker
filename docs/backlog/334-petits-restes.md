# 334 · Petits restes signalés par les agents des lots 325 et 333

**Modèle | Réflexion** : Sonnet | medium. Petit lot, rien de visible.

## Constats (vérifiés le 11/11)

1. `lastIndexAtOrBeforeTime` (`src/core/search.ts:35`) n'a aucun appelant hors de son test (`src/core/search.test.ts:8`, `:43-47`). La retirer avec son test ; vérifier `docs/INVENTAIRE.md` (le signaler dans le rapport, la doc ne se touche pas ici).
2. `usePerActivityChoice` (`src/hooks/usePerActivityChoice.ts:19`) garde un paramètre de type `<T = boolean,>` alors que ses quatre usages (`src/pages/RecordingPage.tsx:601`, `:605`, `:610`, `:627`) ne portent plus que des cases cochées : le ramener à un booléen si tous les usages le confirment (et `choiceFor`, lu par le test, avec lui).
3. `android/variables.gradle:13-14` : `androidxJunitVersion` et `androidxEspressoCoreVersion` ne sont lus nulle part sous `android/` (seul `junitVersion`, `:12`, sert à `android/app/build.gradle:92`). Les retirer ; les tests Java doivent rester verts.
4. La taille du titre de l'accueil réglée pour « Entraînement » (`src/pages/Home.css`) : **déjà parti**, le mot n'y est plus. Rien à faire ; le dire dans le rapport.

## Ordre

À lancer après le lot 313, qui modifie `RecordingPage.tsx`.

## Vérification

- `node outils/verif.mjs --rapide` ; tests Java (`gradlew.bat` par son chemin complet entre guillemets depuis `android/`, tâche de test unitaire) si l'agent peut les lancer, sinon le dire.
- Banc : neutre (`general`).
