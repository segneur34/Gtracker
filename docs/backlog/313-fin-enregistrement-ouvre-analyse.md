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

## Plan (agent Plan, 11/11) et choix de l'orchestrateur

Le plan ci-dessous complète le brief ; en cas d'écart, il l'emporte sur les sections « À faire » et « Vérification » plus haut.

### Tranché par l'orchestrateur (ne pas reposer)

- **Matériel de fin de session** (décision du §2 de DECISIONS, carte « Session terminée ») : la carte disparaît du parcours normal ; le matériel se choisit dans l'onglet « matos et conditions » de l'analyse, et la rangée ne reste que sur l'écran filet. L'analyse s'ouvre sur « général » seul, comme toujours. À faire confirmer par l'utilisateur à l'arrêt du paquet : garder ce point isolé et facile à changer.
- **Session reprise après une coupure, encore continuable** (`canContinue`) : pour ce seul cas, la carte « Continuer / Analyser / Jeter » reste ; on ne range pas seul, pour ne pas perdre « Continuer l'enregistrement ». À faire confirmer aussi.
- Confirmation par `window.confirm` (le banc sait la remplacer) ; durée de l'appui en constante d'interface (1 s) ; avertissements de l'enregistreur montrés dans l'analyse, jamais par `alert` ; navigation en `replace` depuis `/enregistrer` ; le « Jeter » de l'écran filet reste un simple bouton avec confirmation.

### Fichiers à modifier

- `src/hooks/useRecorder.ts` : `rangePendingSession` en deux `try` (329 étape 1) ; `catch` dans `discardPendingSession` (329 étape 2) ; fonction neuve `finishPendingSession()` qui range seule la session en attente, une seule fois par session (marquée, pour ne pas boucler sur un échec), ne fait rien pendant un rangement en cours, ignore une session `canContinue` ; commentaires du foil, du journal sans position, de l'en-tête et de `PendingSession`. Les lignes `:106-108` relèvent d'un autre lot : ne pas y toucher.
- `src/App.tsx` : pièce `FinishRecording`, à côté de `LandOnRecording`, toujours montée ; elle appelle `finishPendingSession` puis ouvre `analysisPath(...)`.
- `src/pages/RecordingPage.tsx` : la carte d'attente devient le filet (rangement échoué ou qui ne s'applique pas ; pendant le rangement, une ligne « Rangement… ») ; `handleDiscard` reçoit un `catch` ; la carte « Session rangée » ne reste que si la session n'a pas pu entrer dans la mémoire ou reste à classer ; retirer le texte « Analyser la range… l'abandonne ».
- `src/components/SessionNameEditor.tsx` : entrée « Jeter » en dernier ; prop `back`, passée par `src/components/AnalysisShell.tsx`.
- `src/components/AnalysisShell.tsx` : un avertissement de l'enregistreur s'affiche dans l'analyse quand `saved.libraryFile === file` ; sa fermeture appelle `dismissRecorderResult`.
- `src/components/ui/HoldButton.tsx` : prop `hint` (défaut : le texte actuel « Maintenir X s pour arrêter »), `icon`, `aria-label`.
- `src/components/ui/MoreMenu.tsx` : une entrée marquée `data-keep-open` ne referme pas le menu au clic.
- `src/components/icons.tsx` : `IconTrash` (n'existe pas). `src/components/ui/ui.css` : couleur danger d'un bouton dans `.ui-more__panel`, par les variables du thème.
- `src/hooks/leaveGuard.ts` : `dropLeaveWarning()`, qui abandonne le brouillon sans redemander.
- `src/tutorials/lessons.ts` : lignes `:37`, `:45` et `:203` seulement (les lignes `:142-153`, leçon de planification, sont au lot 304).
- Tests : `src/hooks/useRecorder.test.ts` (ajouter `removeFails` au faux journal), `src/hooks/useRecorder.resume.test.ts`.

Pièces existantes à réutiliser : `analyzePendingSession` (promesse partagée `ranging`), `useOpenSession`, `analysisPath` et `libraryPath` (`core/parentPage.ts`), `removeSession`, `useLongPress`, `HoldButton`, `HoldDial`, `confirmLeave` et `useLeaveWarning`, `dismissRecorderResult`.

### Parcours de fin

- **Arrêt normal** : `FinishRecording` voit la session en attente, la range une fois, puis `dismissRecorderResult` et ouverture de l'analyse en `replace`. Le retour d'Android mène à la bibliothèque.
- **Arrêt depuis la notification** : n'existe pas (la notification n'a pas de bouton). Le rangement appartient au module : il aboutit même si la page est quittée pendant le calcul.
- **Application coupée puis rouverte** : `recoverOnce` remet la session en attente ; `FinishRecording` la range et ouvre l'analyse depuis l'accueil, seulement si `confirmLeave()` l'accepte ; exception `canContinue` (voir plus haut).
- **Rangement qui échoue** : la session reste en attente avec son message actuel, à l'octet ; pas de relance automatique ; le filet garde Analyser (pour réessayer), Analyser sans les capteurs, Continuer, Télécharger le GPX, le matériel de fin, le partage et Jeter.
- **Session rangée sans fichier dans la mémoire** (aucun dossier mémoire, ou session à classer) : pas d'ouverture, la carte « Session rangée » reste.
- **Avertissements posés à l'arrêt** (« Capteurs : … ») et message de l'étape 1 du 329 : ils restent dans `state.error` et l'analyse ouverte les affiche.

### Étapes

1. 329 étape 1 : GPX dans un premier `try` (message actuel) ; ménage (journal puis `.imu`) dans un second qui, en cas d'échec, pose quand même `saved` avec « Session rangée ; le journal d'enregistrement n'a pas pu être effacé ».
2. 329 étape 2 : `discardPendingSession` en `try/catch`, la session reste en attente, message « La session n'a pas pu être jetée : … ».
3. `finishPendingSession` et ses tests.
4. `FinishRecording` et l'affichage des avertissements dans l'analyse.
5. Carte de `RecordingPage` réduite au filet.
6. `HoldButton`, `MoreMenu`, `IconTrash`, couleur danger, `dropLeaveWarning`.
7. « Jeter » dans `SessionNameEditor` : tenu 1 s, puis `window.confirm` (le texte ajoute que les modifications non enregistrées seront perdues s'il y a un brouillon) ; ensuite `dropLeaveWarning()`, navigation vers `back` en `replace`, puis `removeSession(file)` dont l'échec s'affiche sur la bibliothèque ; caché pour une fiche en lecture seule, comme « Supprimer » dans la bibliothèque.
8. `lessons.ts`.
9. Banc.

L'entrée tenue dans un menu : un appui court affiche en place « Maintenir 1 s pour jeter » (`data-keep-open`) ; `aria-label` du type « Jeter la session : maintenir une seconde » ; au clavier, Espace ou Entrée tenus 1 s ; Échap ferme le menu ; vérifier que le cadran `HoldDial` se voit (le panneau du menu est en position absolue).

### Tests

- `useRecorder.test.ts` : journal qui refuse de s'effacer → `saved` posé, `pending` vide, message exact ; GPX qui refuse de s'écrire → message inchangé ; « Jeter » dont le `remove` échoue → session en attente, message, aucune promesse rejetée ; `finishPendingSession` (une fois par session, pas de relance après un échec, rien pendant un rangement en cours, ignore `canContinue`).
- `useRecorder.resume.test.ts` : session reprise sans `canContinue` → rangée ; avec → laissée en attente.

### Banc

- Aide commune dans `outils/banc/lib/` : attendre `/analyse`, ouvrir « … », `pointerdown` sur Jeter, attendre 1,1 s, confirmation remplacée.
- À mettre au nouveau parcours dans ce lot : `carte-direct`, `balises`, `notification`, `fluidite`, `gps-perdu`, `rendus`, `session-save`, `session-save-resume` (ajouter à la fin « Jeter » avec un brouillon ouvert → bibliothèque, session absente) ; noter le changement dans `outils/banc/SCRIPTS.md`.
- Cassent aussi (ils cliquent « Analyser » après l'arrêt) et partent au lot 330, à lister dans le rapport : `activite`, `allure-session`, `bench`, `library`, `notes`, `partage`, `materiel-fin`, `tutoriels`. Si l'aide commune les répare en une ligne chacun, le faire et le dire.

### Phrases de DECISIONS à changer à la passe de doc

§6 ligne 64 (« À l'arrêt, rien n'est rangé… ») ; §2 ligne 37 (matériel proposé sur la carte « Session terminée ») ; §3 ligne 42 (« élaguée à « Analyser » »).
