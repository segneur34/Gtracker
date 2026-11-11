# 316 · « Partager la trace » dans le menu « … » des analyses

**Modèle | Réflexion** : Sonnet | medium. Petit lot.

## Demande

Analyse › menu « … » : une entrée « Partager la trace » ouvre le partage d'Android avec le GPX de la session. Réponse de l'utilisateur du 11/11 : le GPX et l'image sont deux partages distincts, il faut les deux ; le partage en image (« Partager ») reste tel quel.

Résultat attendu : envoyer le GPX d'une session en deux appuis, depuis l'analyse voile comme depuis l'analyse surf.

## Ce que le code dit (relevé le 11/11)

- Le menu « … » des deux analyses est dans `src/components/SessionNameEditor.tsx:97-108` (`MoreMenu` « Plus d'actions sur la session ») : « Partager » (ouvre `ShareDialog`, l'image) et « Télécharger la session ». `AnalysisShell.tsx:88-89` le rend ; `SailingModule.tsx:540` et `SurfModule.tsx:481` lui passent `file`.
- `src/platform/share.ts:26` : `shareFile(blob, fileName, title)` rend un `ShareOutcome`.
- Le modèle à suivre est le partage d'un itinéraire : `src/pages/RoutesPage.tsx:82-91` (lecture du fichier, `shareFile`, message selon l'issue).
- Le texte du GPX d'une session rangée : `readSessionGpx(file)` (`src/hooks/sessionLibrary/sessionRecords.ts:24-27`), qui rend `null` si le fichier manque.

## À faire

- Une entrée « Partager la trace » dans le menu de `SessionNameEditor`, placée juste après « Partager » : lit le GPX par `readSessionGpx`, le passe à `shareFile` sous le nom de fichier de la session (`.gpx`, type `application/gpx+xml`), titre = nom de la session.
- Issues traitées comme pour les itinéraires (partage ouvert, partage indisponible : même repli et mêmes mots que `RoutesPage`, GPX introuvable : un message dit en clair). Aucune erreur muette.
- Règle 12 : le partage passe par `src/platform/share.ts`, rien en direct.
- Si la session a un brouillon non enregistré, on partage le GPX rangé tel quel (le brouillon ne change pas le GPX).

## Ne pas toucher

- `src/pages/RecordingPage.tsx`, `src/hooks/useRecorder.ts` (lot 313), `src/pages/RoutesPage.tsx` (lot 317), `src/library/record.ts`, `src/pages/SettingsPage.tsx`, `src/pages/SailingModule.tsx`, `src/library/shareStats.ts`, `src/core/activityIcons.ts` (lot 314). Si l'un d'eux doit changer, le dire dans le rapport au lieu de le faire.

## Vérification

- `node outils/verif.mjs --rapide`.
- Banc : `general` et `surf` (le menu gagne une ligne, rien d'autre ne change).
- Essai au téléphone (un seul) : analyse d'une session, « … », « Partager la trace » → le partage d'Android s'ouvre avec un fichier `.gpx`.
