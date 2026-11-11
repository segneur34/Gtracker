# 313 · La fin d'un enregistrement ouvre l'analyse ; « Jeter » passe dans l'analyse (avec le 329, étapes 1 et 2)

**Modèle | Réflexion** : Opus | high. Plan par l'agent `Plan` d'abord.

## Demande (utilisateur, 09/11 et 10/11)

Changement de philosophie : la fin d'un enregistrement ouvre directement l'analyse, sans écran « Analyser / Jeter ». « Jeter » devient une action de la page d'analyse, en appui long d'une seconde puis confirmation (l'appui long remplace l'ancien bouton de l'écran d'enregistrement).

Résultat attendu : plus de choix à faire en fin de sortie ; rien d'enregistré n'est perdu par un appui malheureux.

## Décisions déjà prises (ne pas les reposer)

- **Où est « Jeter »** (réponse du 11/11) : dans le menu « … » de **toute** analyse, à côté de « Partager », « Partager la trace » (lot 316) et « Télécharger la session ». Il sert aussi à supprimer une ancienne session depuis son analyse. Appui long d'une seconde, puis confirmation.
- Le foil d'une session enregistrée (question 1 du lot 329) : sans objet si l'analyse s'ouvre dès la fin ; corriger le commentaire seulement.
- Un journal illisible et sans position (question 2 du lot 329) : on l'efface comme aujourd'hui, et le commentaire le dit.

## Ce que le code dit (relevé le 11/11)

- `src/pages/RecordingPage.tsx:960-991` : bloc « session en attente », avec « Analyser » (`:970`, `handleAnalyze`), « Analyser sans les capteurs » (`:974`), « Télécharger le GPX » (`:983-986`) et « Jeter » (`:988`, `handleDiscard`).
- `RecordingPage.tsx:687-699` : `handleAnalyze` appelle `analyzePendingSession` puis `openSession` (`:696`) ; `:701-705` : `handleDiscard` (`window.confirm`, puis `discardPendingSession`).
- `src/hooks/useRecorder.ts` : `buildPendingSession` (`:517`), `rangePendingSession` (`:554`, range la session), `analyzePendingSession` (`:588-599`), `discardPendingSession` (`:602-606`, efface le journal et le fichier `.imu`, sans `catch`).
- `src/hooks/useLibraryNavigation.ts:20-24` : `useOpenSession` ; `src/core/parentPage.ts:52-55` : `analysisPath`.
- Suppression d'une session rangée : `removeSession` (`src/hooks/sessionLibrary/sessionRecords.ts:108`, ré-exportée par `useSessionLibrary.ts:52`) ; la bibliothèque l'appelle avec sa confirmation (`src/pages/SessionLibrary.tsx:443-450`).
- Appui long : `src/components/ui/HoldButton.tsx:15` (employé pour l'arrêt, `RecordingPage.tsx:272`) et `src/hooks/useLongPress.ts:20`.
- Menu « … » des analyses : `src/components/SessionNameEditor.tsx:97-108` (`MoreMenu`).
- Mentions à mettre à jour : `src/tutorials/lessons.ts:37` et `:45` ; scripts du banc qui cliquent « Jeter » : `carte-direct.mjs` (3), `balises.mjs` (2), `notification.mjs` (2), `fluidite.mjs`, `gps-perdu.mjs`, `rendus.mjs`.

## À faire

1. **Fin d'enregistrement** : à l'arrêt, la session est rangée (`rangePendingSession`) puis son analyse s'ouvre (`openSession`), sans écran intermédiaire. Si le rangement échoue (GPX non écrit), l'écran « session en attente » reste comme filet, avec son message : rien n'est perdu. Même chemin pour une session reprise du journal après une coupure de l'application. Ce que deviennent « Analyser sans les capteurs » et « Télécharger le GPX » de l'écran d'attente : les garder sur l'écran filet ; le plan dit s'ils doivent aussi exister ailleurs (question à signaler si le choix n'est pas évident).
2. **« Jeter » dans l'analyse** : entrée du menu « … » de `SessionNameEditor`, en dernier, tenue une seconde (`HoldButton` ou `useLongPress`), puis confirmation ; elle supprime la session (`removeSession`) et ramène à la page au-dessus (bibliothèque de la famille). Un brouillon non enregistré ne doit pas bloquer la suppression confirmée. Vaut pour la voile et le surf (pièce partagée, pas de copie).
3. **Lot 329, étape 1** (`docs/backlog/319-revue-apres-fork.md`, section « Lot 329 ») : dans `rangePendingSession`, séparer l'écriture du GPX et le ménage du journal ; si le GPX est rangé mais que le journal ne s'efface pas, la session est tenue pour rangée et le message est « Session rangée ; le journal d'enregistrement n'a pas pu être effacé ». Test dans `src/hooks/useRecorder.test.ts`. Commentaire du journal sans position aligné sur le code.
4. **Lot 329, étape 2** : plus aucun échec muet au moment de jeter (ancien `discardPendingSession` s'il subsiste pour l'écran filet : `catch` et message « La session n'a pas pu être jetée : … » ; idem pour la suppression depuis l'analyse). Commentaire du foil (`useRecorder.ts`, autour de `:567`) corrigé.
5. `src/tutorials/lessons.ts` et les six scripts du banc mis au nouveau parcours.
6. `docs/DECISIONS.md` §6 : ne pas y toucher (passe de doc après validation) ; lister dans le rapport les phrases qu'il faudra changer.

L'étape 3 du lot 329 (découpage de `useRecorder.ts` en quatre pièces) n'est **pas** dans ce lot.

## Pièges

- Garder chaque message d'erreur existant à l'octet (le banc les lit).
- Règle 12 : aucun accès direct au stockage, aux fichiers ni aux capteurs hors de `src/platform/`.
- Le retour d'Android depuis l'analyse ouverte en fin d'enregistrement mène à la page au-dessus (bibliothèque), pas à l'écran d'enregistrement (décision « Navigation » de `CLAUDE.md`).
- Le lot 304 code en même temps dans `src/planning/`, `src/pages/PlanningPage.tsx`, `src/hooks/usePlannedRoute.ts`, `src/hooks/useSportSettings.ts` et les composants de revêtement : ne pas y toucher.

## Vérification

- `npx vitest run src/hooks/useRecorder.test.ts src/hooks/useRecorder.resume.test.ts src/recording`, puis `node outils/verif.mjs --rapide`.
- Banc : `session-save`, `session-save-resume`, `gps-perdu`, `notification`, `carte-direct`, `balises` (parcours de fin changé : le dire, le reste identique).
- Essai au téléphone (un seul) : enregistrer deux minutes, finir → l'analyse s'ouvre seule ; « … », tenir « Jeter » une seconde, confirmer → la session disparaît ; puis enregistrer, couper l'application, la rouvrir → la session reprise se range et s'ouvre.
