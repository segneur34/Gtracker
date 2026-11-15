# 410 · « Tout supprimer » vide aussi le sous-dossier « journaux »

Modèle | Réflexion : Sonnet | medium

## Origine

Relevé le 15/11 à la passe de documentation du lot 396 : Réglages › Mémoire › « Tout supprimer » ne vide pas le sous-dossier « journaux » du dossier mémoire, où sont copiés les journaux d'enregistrement gardés de côté. Lire `docs/DECISIONS.md` §8 (Mémoire et fichiers) et §6 pour ce que sont ces journaux.

## Constat (à vérifier dans le code avant de corriger)

- `src/hooks/sessionLibrary/reset.ts` décide de ce que « Réglages d'usine » et « Tout supprimer » effacent et compte les fichiers ; `src/components/ResetZone.tsx` les montre.
- Le sous-dossier est nommé dans `src/library/folderLayout.ts`, écrit par `src/hooks/setAsideJournals.ts` à travers `src/platform/memoryFolder.ts`.

## Attendu

- Après « Tout supprimer », plus aucun journal gardé de côté dans le dossier mémoire, navigateur et téléphone ; le sous-dossier vide peut rester ou partir, au plus simple, sans erreur s'il n'existe pas.
- Le compte annoncé avant la confirmation et la progression (« fichiers effacés sur leur nombre ») comprennent ces fichiers, ou la phrase de confirmation reste vraie sans eux : au plus simple, mais sans chiffre faux.
- « Réglages d'usine » ne change pas : il n'efface ni sessions ni journaux (vérifier ce que dit sa phrase et s'y tenir).
- Un journal d'un enregistrement en cours n'est pas concerné s'il n'est pas dans ce sous-dossier ; regarder ce que « Tout supprimer » fait déjà quand un enregistrement tourne et ne pas le changer.
- Tests : le cas dans le test de `reset` (ou de `memoryFolder`) qui existe, sur un dossier simulé avec un journal de côté.

## Limites

Ne pas toucher au code du lot 403, pas encore validé sur le terrain : `android/**`, `src/recording/nativeLog.ts`, `src/platform/location.ts`, `src/hooks/recorder/`. Si la correction demande d'y entrer, le dire dans le rapport au lieu de le faire. Aucun texte visible neuf sauf nécessité (alors par `t`, avec ses traductions anglaise et espagnole).

## Vérification

`node outils/verif.mjs --rapide`. Pas d'essai au téléphone : le geste efface des fichiers par le module `platform/memoryFolder.ts`, déjà éprouvé pour les sessions ; dire dans le rapport si la version du téléphone passe par un autre chemin que celle du navigateur pour ce sous-dossier.
