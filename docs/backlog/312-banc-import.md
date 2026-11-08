# 312 · Banc : l'import de GPX échoue depuis la copie

Noté le 08/11 (vu au lot 310). Modèle | Réflexion : Sonnet | high. Lot `[outil]` : il ne touche pas à `src/` sauf preuve que la cause est dans l'application (à dire dans le rapport, correction seulement si elle est sans effet sur l'application).

## Symptôme

`node outils/banc/passe.mjs general surf partage` : « import … : absent », fiches absentes, 21 à 29 échecs, identiques à HEAD (donc pas dus au lot 310). Constaté le 08/11 sur ce poste, dans la copie `D:\gong tracker\Gtracker`. Dans le dépôt d'origine (`C:\Users\segne\tracker`, **à ne jamais modifier**, lecture permise pour comparer) le même banc passait le 08/11 au matin.

## Ce qui a changé au fork (`D:\gong tracker\atelier\fork-0811\brief-fork.md`)

- `outils/banc/passe.mjs` : `PORT_APRES` 4195, `PORT_AVANT` 4196, Chrome 9480 ; `outils/banc/fluidite-compile.mjs` : CDP 9490 ; `vite.config.ts` : `server.port` 5174, `strictPort`.
- `src/platform/memoryFolder.ts` : `MEMORY_FOLDER_NAME = 'Gtracker'` (dossier `Documents/Gtracker`).
- `capacitor.config.ts` : `appName` Gtracker, `appId` `io.github.segneur.tracker.voile` ; `package.json` : `name` gtracker.
- Le dossier a des espaces dans son chemin (`D:\gong tracker\Gtracker`) : un chemin non protégé par des guillemets, ou coupé sur l'espace, est une cause probable.
- Copies de travail « avant » du banc dans `%TEMP%\tracker-banc\` (worktrees git) : la copie « avant » peut avoir été créée depuis le mauvais dépôt ou sans le bon port.

## À faire

1. Lire `outils/banc/LISEZMOI.md` par Grep (mots : import, GPX, `--gpx`, dossier, mémoire, avant, worktree, port), jamais en entier ; puis `outils/banc/passe.mjs` et, dans `outils/banc/lib/`, ce qui concerne l'import des GPX et le dossier mémoire simulé.
2. Rejouer `node outils/banc/passe.mjs general` seul ; lire les erreurs de console et les messages « absent ». Isoler la cause.
3. Corriger côté banc (`outils/banc/`), de la façon la plus petite. Si la cause est dans `src/` (par exemple une clé de stockage qui dépend du nom de l'application), le dire dans le rapport et proposer ; ne corriger que si c'est sans effet sur l'application.
4. Vérifier : `node outils/banc/passe.mjs general surf balises partage` sans échec, puis `node outils/banc/passe.mjs profil cardio sauts`. Puis `node outils/verif.mjs --rapide`.
5. Si un piège nouveau est trouvé, l'ajouter dans `outils/banc/LISEZMOI.md` (pas d'autre document).

## Rapport attendu

Cause en une phrase ; fichiers touchés ; dernières lignes de `passe.mjs` sur les sept scripts ; ce qui reste en échec s'il y a lieu. Pas de version à poser (aucun fichier de `src/` ni d'`android/` touché), rien à essayer au téléphone.
