# 489 · « Synchroniser » : remise à plat de la logique et des messages

Demande de l'utilisateur du 22/11, après les essais 337, 338, 341 et 334 sur le programme Windows 0.01.91 et l'APK 0.01.91. Tout fonctionne (sessions et itinéraires passent dans les deux sens, par le câble comme par le Wi-Fi), mais l'ensemble est jugé confus : trop de messages, des phrases fausses ou obscures, des attentes inexpliquées. Lot Fable : revoir le parcours entier avant de corriger au cas par cas ; plan et maquette des messages montrés à l'utilisateur avant tout code.

## Tel que noté

- 22/11 : « Mais il y a quand même beaucoup de messages. Voulez-vous confirmer ? Réessayer ? Ensuite, par exemple, quand je réinstalle une session depuis la corbeille et que je fais synchroniser, il me dit que ça supprime une session. Alors oui, peut-être que ça en supprime une de la corbeille pour la mettre ailleurs, mais du coup, le message n'est pas clair. Donc là, je pense qu'il y a un gros coup de logique à remettre là-dedans. Note tout ça proprement et peut-être qu'un agent fable serait plus pertinent pour tout revoir la logique générale là-dessus. Même si tout fonctionne. Il faut quand même mettre un gros coup d'amélioration. »
- 22/11, essai 337 : « Actuellement, il impose un endroit où […] les copies de sauvegarde sont faites, il faut pouvoir choisir. » (ancien élément 484)
- 22/11, essai 337 : « il m'a proposé sur le téléphone de reprendre le setup du PC. Je pense qu'il faut pouvoir choisir à ce moment-là, est-ce que vous voulez garder la configuration téléphone ou PC. » (ancien élément 485)
- 22/11, essai 341 : message « 1 itinéraire laissé pour la prochaine fois : il a changé pendant la synchronisation » : « ce message n'est pas très clair, je ne comprends pas exactement ce qu'il veut dire ». (La cause, une suppression bloquée à tort, est corrigée au lot 487, qui a aussi reformulé la phrase ; la phrase reste à revoir avec les autres.)
- 22/11, essai 334 (Wi-Fi) : « il s'est instantanément connecté au téléphone, mais il a fallu attendre quasiment 1 minute avant qu'il accepte que je puisse cliquer sur le bouton synchroniser ».
- 22/11, essai 334 : après une synchronisation réussie, un second message « Aucun téléphone ne se présente. […] À défaut, branchez votre téléphone […] La première fois, il faut aussi activer le « Débogage USB » […] » ; téléphone allumé, Gtracker ouvert (écran déverrouillé et application au premier plan : pas certain).

- 22/11, à l'ouverture du lot : « il y a trop de messages "vous supprimez 4 sessions" alors qu'en fait j'en ai supprimé qu'une, donc où sont les 3 autres, ou plutôt j'en ai supprimé que 2 […] il y a une espèce d'organisation logique à optimiser, même si actuellement le système fonctionne, et ça c'est important de le dire, il ne faut pas le remettre en cause, il faut juste homogénéiser et rendre plus logique les messages et peut-être plus fluide le fonctionnement. »

## Points à reprendre

1. **Trop de fenêtres et de questions** : confirmation des suppressions (garde-fou), « Réessayer », compte rendu, puis « touchez Mettre à jour » sur le téléphone. Viser un parcours d'un seul geste quand tout va bien, une question seulement quand une perte est possible.
2. **Restaurer depuis la corbeille, puis « Synchroniser »** : le compte rendu parle d'une session supprimée. Retrouver ce qui est dit et pourquoi (une entrée de corbeille retirée ? la session comptée comme supprimée d'un côté ?) ; le compte rendu ne doit dire que ce que l'utilisateur reconnaît : « 1 session restaurée, recopiée vers le téléphone ».
3. **Copie de sécurité de la première synchronisation** : l'utilisateur choisit son dossier ; le compte rendu dit où elle est.
4. **Réglages des deux appareils** : le bandeau « Nouveau fichier de réglages » du téléphone (`SettingsOfferBanner`, `src/components/SettingsFiles.tsx`, « Reprendre » / « Fermer ») devient un choix nommé : garder ceux du téléphone ou prendre ceux du PC ; aucun réglage remplacé sans ce choix dit en clair. À penser avec la fenêtre « Matériel des deux appareils » (lot 478), qui traite déjà le matériel.
5. **« Laissé pour la prochaine fois »** et les autres phrases du compte rendu (`src/library/syncReport.ts`) : relues une à une avec l'utilisateur ; aucune phrase de mécanique interne.
6. **Attente d'environ une minute** avant que « Synchroniser » soit permis, téléphone déjà relié par le Wi-Fi : trouver ce qu'on attend (présentation du téléphone, listage, délais du sans-fil dans `bureau/sansFil.ts`) et le raccourcir, ou au moins dire ce qui se passe.
7. **« Aucun téléphone ne se présente »** : ne plus conseiller le débogage USB (Q138 : il ne convient pas aux acheteurs, le sans-fil est le moyen de base) ; dire la vraie condition : écran du téléphone allumé et déverrouillé, Gtracker affiché, même réseau ; et le pare-feu (élément 488).
8. **« Sur le téléphone, touchez Mettre à jour »** : le téléphone ne pourrait-il pas se remettre à jour seul quand l'ordinateur l'a modifié ?

## État des lieux du 22/11 (causes trouvées, rien de codé)

Planche montrée à l'utilisateur, hors dépôt : `D:\gong tracker\atelier\planche-489\planche.html` (constats, parcours avant et après, maquettes des fenêtres, tableau de tous les messages, questions A à F). Banc sur le programme 0.01.92 avant tout changement : `exe-synchroniser.mjs` 796 contrôles, `exe-sansfil.mjs` 361, tout passe.

- **Nombres gonflés** (rejoué sur le faux dossier) : une suppression non confirmée garde sa ligne de base (`restrictSyncPlan`, `src/library/syncPlan.ts`, fin du fichier) et revient à chaque passe, ajoutée aux nouvelles ; « Annuler », « Synchroniser sans rien supprimer » et « Les laisser » ne font que fermer (`answerPhoneSyncQuestion`, `src/hooks/sessionLibrary/phoneSync.ts`). Deux supprimées, puis une, puis une sur le téléphone : « retirerait 2 », « 3 », « 4 sessions ». S'y ajoutent : sessions et itinéraires additionnés (`syncQuestionListLabel`, `syncQuestionConfirmLabel` et la ligne « N suppressions laissées » de `src/library/syncReport.ts`) ; des restes sans GPX comptés dans `withheldDeletions` alors que le garde-fou ne les compte pas (`executeSync`, `src/hooks/sessionLibrary/sync.ts`, calcul de `outcome.withheldDeletions`) ; `base.held` jamais réduit (`src/library/syncBase.ts`), d'où une question qui revient corbeille vidée avec la phrase fausse « restent 30 jours dans la corbeille ».
- **Garde-fou trop sensible** : `SYNC_GUARD_MAX_SHARE` (0,25) s'applique dès une suppression ; sur 3 sessions ou 3 itinéraires, une seule suffit (`guardOf`, `routeGuardOf`).
- **Restauration dite « suppression »** : la restauration seule n'est jamais dite suppression (sept histoires rejouées : « 1 session copiée vers le téléphone. ») ; le mot vient des suppressions en attente, que la restauration fait repasser sous le seuil du garde-fou et qui partent alors sans question. Aucune phrase ne dit « restaurée » : `SyncItem` n'a pas l'équivalent du `revived` des itinéraires, alors que le plan le sait (cas `newOnComputer` dont l'identité est dans `base.removed`). Une restauration laisse dans la corbeille l'entrée de l'autre origine (`src/hooks/sessionLibrary/trashRestore.ts`).
- **Minute d'attente** : `synchronizePhone` attend sans limite `lib.scanCompletion` puis `lib.scanPass` (recalcul des résumés, `src/hooks/sessionLibrary/summaryQueue.ts`) pendant que la fenêtre dit « Comparaison des deux appareils… » ; `SUMMARY_CALC_VERSION` avait changé en 0.01.90, tout était à recalculer au premier lancement du programme 0.01.91. Piste **non confirmée** : mesurée au banc sur le programme 0.01.92 (30 sessions de 1 h 30 à 1 Hz, fiches rendues périmées), le recalcul finit en moins de 5 s (environ 150 ms par session) et « Synchroniser » répond en moins de 0,5 s, fiches périmées ou non. Autres pistes, non éprouvées : un `ping` (20 s) ou un `lister` (30 s) sans réponse d'un téléphone affiché relié, une copie de sécurité par le Wi-Fi. Cause non établie : question F posée à l'utilisateur, et le programme installé ne tient aucun journal (à ajouter).
- **« Aucun téléphone » après une synchronisation réussie** : le téléphone ferme la liaison dès que l'application quitte l'écran (`handleOnStop`, `ComputerLinkPlugin.java`) et ne la reprend qu'à l'ouverture, au retour au premier plan ou au changement du dossier (`src/hooks/useComputerLink.ts`), jamais à rythme régulier ; l'ordinateur ferme sur un `ping` sans réponse en 20 s (`bureau/sansFil.ts`) et ne retient ni l'heure ni la raison d'un départ, la page n'étant avertie que des arrivées ; chaque réponse à une question relance tout depuis l'état du téléphone. Sans téléphone relié, l'état vient du câble (`dossierSansFilPuisCable`) : sur un poste sans adb, la fenêtre dit « outil gratuit de Google » (`adbIntrouvable`).
- **« Touchez Mettre à jour »** : reste d'avant ; le téléphone relit seul (`src/library/syncWatch.ts`, retour au premier plan et toutes les 25 s).
- **Copie de sécurité** : dossier fixé dans `bureau/main.ts` (`DOSSIER_COPIES` sous Documents).
- **Bandeau des réglages** : proposé pour tout fichier jamais vu, identique ou non (`offerNewSettings`, `src/hooks/sessionLibrary/deviceSettings.ts`), puis `window.confirm`.

## Décisions de l'utilisateur, le 22/11 (sur la planche)

Cadre redit par lui : le moteur fonctionne et n'est pas remis en cause ; on homogénéise, on rend les messages logiques et le fonctionnement plus fluide.

- **A2** : le garde-fou garde ses seuils (plus de 10 suppressions, ou plus du quart d'un appareil, même pour une seule). La question continue donc de venir sur un petit nombre.
- **B1** : dire non règle la question. « Tout garder » remet chaque session ou itinéraire refusé là où il manque (sorti de la corbeille de l'ordinateur, ou renvoyé au téléphone) ; de même « Les garder » pour ce que tient la corbeille de l'ordinateur et qui est encore sur le téléphone (il sort de la corbeille). Fermer la fenêtre ne décide rien, la question revient. « Annuler », « Synchroniser sans rien supprimer » et « Les laisser » disparaissent.
- **C1** : la fenêtre reste (avancement puis compte rendu, un seul bouton « Fermer »).
- **D1** : dossier de la copie de sécurité choisi sur un écran de départ de la première synchronisation (« Choisir un autre dossier », « Commencer »), retenu, et changeable dans Réglages › Mémoire ; le compte rendu redit où elle est, avec « Ouvrir le dossier ».
- **E1** : l'élément 488 (pare-feu) dans le même paquet, en première partie.
- Question F (ce que disait l'ordinateur pendant la minute d'attente) : sans réponse, non bloquante.

Tranché par l'orchestrateur, dit à l'utilisateur sur la planche, sans objection :
- le mode d'emploi du câble (débogage USB, outil de Google) quitte la fenêtre pour un paragraphe replié « Par câble (avancé) » de Réglages › Mémoire ; le câble marche toujours, sans message, et l'état `adbIntrouvable` n'est plus jamais montré dans la fenêtre comme une chose à faire ;
- le bandeau des réglages ne se montre que si les réglages diffèrent, et ne revient que si ceux de l'autre appareil ont changé depuis la réponse ;
- la corbeille ne montre qu'une ligne par session ;
- le programme installé tient un journal daté des liaisons et des étapes.

## Parcours retenu

1. Le bouton montre « <téléphone> relié » tant qu'un téléphone l'est (à la place de la ligne de 12 secondes) ; il faut pour cela un avis de départ, la page n'étant avertie que des arrivées.
2. Téléphone pas là : la fenêtre attend et démarre seule à son arrivée (connu et non relié : quoi faire sur le téléphone ; pare-feu qui bloque : bouton du lot 488 ; aucun téléphone jamais relié : bouton « Relier mon téléphone » vers Réglages › Mémoire). Même écran quand la liaison tombe en route : ce qui est fait est gardé, reprise seule au retour. « Réessayer » ne reste, sous le nom « Recommencer », que pour une écriture en échec sur l'ordinateur ou une panne.
3. Première synchronisation : écran de départ (D1).
4. Avancement : une phrase et une barre ; une attente de l'ordinateur (import, enregistrement, calcul des résumés) est dite, et la synchronisation part seule ensuite.
5. Une seule fenêtre de question, de même forme pour le garde-fou et pour la corbeille : nombres rangés par appareil, sessions et itinéraires jamais additionnés, noms visibles, deux réponses définitives (B1). Une réponse ne relance pas visiblement tout le parcours.
6. Compte rendu rangé par geste : reçu du téléphone, envoyé au téléphone, modifié, supprimé (par appareil), restauré ; chaque ligne se déplie en noms ; les exceptions dans un encadré, chacune avec sa suite ; une session ou un fichier changé pendant l'opération est repris une fois, seul, avant d'être dit.
7. Le téléphone affiche les changements seul (déjà le cas) : la phrase « touchez Mettre à jour » part.
8. Téléphone : relance de la liaison à rythme régulier tant que l'application est affichée, écran gardé allumé pendant un échange, bandeau des réglages à deux réponses (« Garder les miens », « Prendre ceux de « X » », puis la confirmation, gardée), textes du bloc « Ordinateur » (« synchroniser » au lieu d'« envoyer »).

Toutes les phrases, avant et après, sont dans le tableau de la partie 4 de la planche : il fait foi pour les textes ; un texte que le tableau ne donne pas s'écrit dans le même style (ce que l'utilisateur a fait, puis ce qui en découle ; aucun mot de mécanique : ni « marqueur », ni « base », ni « fiche », ni « fichier de réglages »).

## Plan retenu le 22/11 (agent `Plan`, relu par l'orchestrateur ; aucune question majeure)

Modèle | Réflexion : par partie. Relecture obligatoire pour chacune ; un commit par partie (`node outils/fin-de-lot.mjs 489 … --en-cours` jusqu'à la dernière), arbre vert et aucune clé de traduction manquante ni orpheline à la fin de chaque partie. Le lot 488 (pare-feu) passe avant : l'écran d'attente de la partie 3A reprend sa fonction `firewallNotice` et son appel d'autorisation.

Ordre : 1A, 1B, 2, 3A, 3B, puis 4 et 5, puis 6. En parallèle possible, sur des fichiers disjoints : 5 à côté de 2, 3 ou 4 ; 4 à côté de 3B sauf `bureau/main.ts`, qu'elles touchent l'une après l'autre.

Le moteur (plan, base, exécutant) reste tel quel ; ses seuls changements sont les réponses définitives, le comptage et la marque « restaurée ». Aucun changement de protocole avec le téléphone ; aucun champ neuf ni migration dans `synchro/<id>.json`.

**1A · Moteur : « Tout garder », « Les garder », restes non comptés (Fable | high, par l'agent `lot` appelé avec ce modèle).** Seule partie qui fait revenir ou déplacer des fichiers hors du plan connu : une erreur de cas peut perdre une fiche ou en doubler une.
- Fichiers : `src/library/syncPlan.ts`, `syncRoutes.ts`, `syncBase.ts`, `src/hooks/sessionLibrary/sync.ts`, `syncRouteFiles.ts`, leurs tests.
- À réutiliser : `sessionRestorePlan`, `routeRestorePlan`, `sessionTrashEntries` (`library/trash.ts`) ; `copyFromTrash`, `dropTrashEntries` (`library/trashFolder.ts`, signatures à vérifier) ; `withSyncLine`, `withoutSyncLine`, `withSyncHeld` ; `deletionKeysOf`, `sameDeletion` ; `restrictSyncPlan`.
- Étapes : (1) entrée pure `keep` du plan (identités refusées) : un `deletedOnPhone` refusé est traité comme neuf sur l'ordinateur, donc recopié sur le téléphone et sa ligne reposée ; de même pour les itinéraires. (2) Options de l'exécutant `keepRefused: { sessions, routes }` et `heldOnPhone: 'keep'` : avant le plan, `executeSync` sort de la corbeille (copie, GPX en dernier, puis retrait de l'entrée) chaque `deletedOnComputer` refusé et chaque session tenue (`held`) gardée qui y est encore, puis relit les listages. (3) Si la corbeille ne la tient plus : fonction pure `withoutSyncMemory(base, id)` qui retire la ligne, `removed` et `held` sans rien poser dans `removed` ; le plan suivant la recopie depuis le téléphone. (4) Une clé n'agit que si l'élément est encore dans le cas montré ; une suppression neuve non montrée reste soumise au garde-fou. (5) `outcome.withheldDeletions` ne compte que ce que compte `guardOf` (les restes d'une session absente des deux côtés en sortent) ; de même pour `routeGuardOf`. (6) Les seuils du garde-fou ne changent pas ; `withoutDeletions` reste dans le moteur, sans usage par l'interface.
- Tests, sur `src/test/syncFolder.fixture.ts` : tout garder (supprimée sur le téléphone : recopiée et suivie ; supprimée sur l'ordinateur : sortie de la corbeille, fiches fondues ; corbeille purgée : recopiée depuis le téléphone) ; les garder (tenue sortie de la corbeille, `held` vidé) ; réponse périmée (suppression neuve non montrée : rien supprimé, question pour elle seule) ; coupure entre la copie depuis la corbeille et le retrait de l'entrée (rien perdu, reprise sans double) ; coupure après `withoutSyncMemory` ; restes sans GPX non comptés ; deux, puis une, puis une sur le téléphone ; tout garder avec un téléphone qui ne s'écrit pas, et avec un téléphone qui enregistre (rien ne lui est envoyé, la question n'est réglée que du côté de l'ordinateur).

**1B · Moteur : « restaurée », noms, corbeille d'une ligne (Opus | high).**
- Champ `restored` sur `SyncItem` et `RouteSyncItem` : vrai pour un `newOnComputer` dont l'identité est dans `base.removed` (ou `removedRoutes`), et pour une rencontre sans ligne qui était dans `held`. Le `revived` des itinéraires, qui veut dire autre chose (changé d'un côté, supprimé de l'autre), n'est pas réutilisé.
- `SyncOutcome.names` : le nom montré de chaque session de l'issue, par `options.shownName` (déjà passé par `synchronizePhone`) ; les itinéraires prennent le nom de leurs fichiers.
- Corbeille d'une ligne par session : fonction pure `groupedTrashEntries` (`library/trash.ts`), `TrashZone.tsx` ; « Restaurer » restaure l'entrée d'origine « ordinateur », complète par l'autre (`completeFromTrash`, `trashRestore.ts`) et retire tout le groupe ; « Supprimer définitivement » retire tout le groupe.
- Tests : restaurée après une suppression synchronisée ; restauration seule, aucune suppression dite ; deux origines, une ligne, la fiche la plus complète gardée.

**2 · Compte rendu et fenêtre (Opus | high).**
- Fichiers : `src/library/syncReport.ts` refait et son test, `src/components/PhoneSyncButton.tsx` et son `.css`, `src/hooks/sessionLibrary/phoneSync.ts`, `src/locales/en.json`, `es.json`.
- `describeSync` rend une structure : `rows` (reçu du téléphone, envoyé au téléphone, modifié, supprimé par appareil, restauré ; chaque ligne avec ses noms, sessions et itinéraires comptés à part), `notes` (les exceptions, chacune avec sa suite), `action` (`close`, `restart` pour une écriture ratée sur l'ordinateur ou une panne, `answer` pour une question laissée sans réponse). « Touchez Mettre à jour » part ; les trois phrases d'une ancienne APK par le Wi-Fi n'en font plus qu'une.
- `SyncQuestion` : nombres par appareil, noms visibles ; `syncQuestionListLabel`, `syncQuestionConfirmLabel`, `syncQuestionLeaveLabel` disparaissent. `PhoneSyncAnswer` devient `keepAll | deleteBoth | keepHeld | removeHeld` ; fermer ne décide rien.
- Une réponse relance sans repasser par « Recherche… » (option `resume` de `launch`). Reprise automatique unique quand l'issue a des éléments changés pendant l'opération (`skipped`, `routes.skipped`, `extras.left` en `changed`), avant le compte rendu.
- Fenêtre : titre selon l'étape, sous-titre « téléphone · par le Wi-Fi ou par le câble », une barre, lignes dépliables (`<details>`), un seul bouton « Fermer ».
- Tests : un cas par ligne du tableau de la planche ; restauré dit « restauré » ; jamais additionnés ; question fermée (« Répondre ») ; reprise unique puis phrase ; réponses et `resume` dans `phoneSync.test.ts`.

**3A · Attentes, côté page (Opus | high).**
- Fichiers : `phoneSync.ts`, `PhoneSyncButton.tsx`, `syncReport.ts` (`describePhoneState`), `src/platform/wirelessPhone.ts`, `src/components/WirelessPhoneCard.tsx`, `src/hooks/sessionLibrary/summaryQueue.ts`.
- Étape `waiting` (`phone`, `lastSeenMs`, `firewall`, raison `absent | lost | busy`) : repart seule à l'arrivée du téléphone, à son départ, et sur un relevé de l'état toutes les 3 s pour le câble ; « Annuler » arrête l'attente. Registre des téléphones vide : écran « Aucun téléphone relié », bouton vers Réglages › Mémoire, fenêtre du code ouverte. `adbIntrouvable` traité comme `absent` ; mode d'emploi du câble déplacé dans un paragraphe replié « Par câble (avancé) » de `WirelessPhoneCard`. Liaison perdue : même écran, raison `lost`. Ordinateur occupé : attend la fin de l'import.
- Attente de l'ordinateur dite : étape `computerBusy` d'après `libraryState().scanning` (« finit de mettre à jour ses sessions : 12 sur 40 »). La synchronisation passe devant un passage qui ne fait que refaire des résumés (portillon entre deux traces dans `runCompleteScan` : la trace en cours finit, la suite attend la fin de la synchronisation) ; un passage qui crée des fiches (`scanCompletion`) s'attend, avancement affiché, sinon une écriture de fiche concurrente écraserait la fusion.
- À côté du bouton : « nom relié » tant que le sans-fil tient un téléphone ; la ligne de 12 s part.
- Tests : portillon (`summaryQueue.test.ts`) ; attente puis départ seul, liaison perdue puis reprise, jamais relié (`phoneSync.test.ts`).

**3B · Attentes, côté programme (Opus | high).**
- Fichiers : `bureau/sansFil.ts`, `main.ts`, `preload.ts`, `pont.test.ts` ; neufs : `bureau/journal.ts` et son test ; `docs/INVENTAIRE.md`.
- Rappel de départ (`id`, `nom`, raison, heure) branché sur la fermeture de la liaison, avis `sansfil:parti` vers la page, heure du départ gardée pour `telephones()`.
- Journal daté : `journal.txt` dans le profil du programme, une ligne horodatée par événement, borné à 256 Kio (bascule sur `journal.1.txt`) ; liaisons (arrivée, départ et raison), états du téléphone, et étapes envoyées par la page par un canal neuf `coquille:noter` (texte borné à 300 caractères, par un module de `src/platform/`). La fonction `journal()` de `main.ts` y écrit toujours, plus seulement en mode d'essai.
- Tests : rotation et bornes du journal ; départ annoncé avec sa raison.

**4 · Première fois et réglages (Opus | high).**
- Écran de départ : étape `firstStart` avant la copie de sécurité, quand le plan dit une première rencontre et que le téléphone s'écrit : dossier, « Choisir un autre dossier », « Commencer ».
- Dossier des copies : retenu dans le profil du programme (`copies.json`), lu par `bureau/main.ts` (l'option `copies` des gestionnaires devient une fonction) ; choisi par la boîte de dialogue du programme, jamais par un chemin venu de la page ; canaux `telephone:dossierCopies`, `choisirDossierCopies`, `ouvrirCopie` (borné aux dossiers sous les copies) ; un dossier dans la mémoire reste refusé. Réglage dans Réglages › Mémoire ; « Ouvrir le dossier » dans le compte rendu. Avancement de la copie par un rappel de `copieSecurite` et un avis vers la page (canal à créer ; repli : la phrase sans nombres).
- Bandeau des réglages : fonction pure dans `library/settingsFile.ts` (un fichier n'est proposé que si sa signature diffère de celle de l'appareil et de celle retenue à la dernière réponse) ; clé de l'appareil `answeredSettings` ; l'ancienne liste des fichiers vus reste lue ; `SettingsOfferBanner` : « Garder les miens », « Prendre ceux de « X » » avec la confirmation dans un `Dialog` au lieu de `window.confirm` ; même composant sur l'ordinateur et le téléphone ; `offerNewSettings` (`deviceSettings.ts`).
- Tests : identiques (pas de bandeau) ; gardés et inchangés (pas de bandeau) ; gardés puis changés là-bas (bandeau) ; ancienne liste relue ; dossier choisi, refus dans la mémoire (`copieSecurite.test.ts`).

**5 · Téléphone (Opus | high ; l'APK est construite par l'orchestrateur, seulement sur accord de l'utilisateur).**
- Relance de la liaison toutes les 20 s tant que l'application est au premier plan (`useComputerLink`, par `autoConnect`, qui garde ses gardes : `shouldAutoConnect`, jamais pendant un enregistrement).
- Écran allumé pendant un échange : le greffon ajoute `lastExchangeMs` à son état et le publie à chaque commande reçue, au plus une fois par seconde ; champ facultatif pour la page ; la page tient l'écran allumé tant que la liaison est ouverte et que la dernière commande a moins de 30 s ; dans `src/platform/screen.ts`, l'écran allumé devient un compte par raison (`recording`, `computerLink`) pour ne jamais relâcher celui que tient l'enregistreur.
- Textes du bloc « Ordinateur » (`ComputerLinkCard.tsx`, `describeLink`) et phrase d'un ordinateur introuvable (lot 488), d'après le tableau de la planche.
- Tests : champ facultatif ; deux raisons, l'une relâchée, l'écran reste allumé ; pas de relance pendant un enregistrement.

**6 · Banc (Sonnet | high, à part).** `outils/banc/exe-synchroniser.mjs` et `exe-sansfil.mjs` remis aux nouveaux textes ; cas neufs : nombres par appareil (deux, puis une, puis une sur le téléphone) ; « Tout garder » et « Les garder » (session de retour des deux côtés, corbeille réduite) ; restauration dite « Restauré » ; attente puis départ seul à l'arrivée du faux téléphone, coupure puis reprise seule ; `adbIntrouvable` jamais montré ; écran de départ, dossier choisi, « Ouvrir le dossier » ; journal écrit. `SCRIPTS.md`.

Mineures tranchées par l'orchestrateur : une session tenue que la corbeille n'a plus se dit « n'est plus dans la corbeille de cet ordinateur, mais encore sur le téléphone » ; avancement de la copie de sécurité par un avis de la coquille ; écran allumé tenu par la page (compte par raison), pas par un drapeau du greffon ; corbeille d'une ligne : restaurer l'origine « ordinateur » et compléter par l'autre.

Non vérifié par le plan, à lire par la partie concernée : `WirelessPhoneCard.tsx`, `ComputerLinkCard.tsx`, `syncRouteFiles.ts`, `library/trashFolder.ts`, `bureau/adb.ts`, `bureau/fauxTelephone.ts`. Après validation : la ligne « Programme Windows » de `docs/DECISIONS.md` §8 (« Réessayer » à chaque état, câble) est à mettre à jour.

Essais au vrai téléphone, quatre pour tout le lot : la fenêtre attend puis part seule quand on rallume l'écran du téléphone ; le téléphone garde son écran allumé pendant l'échange et affiche les changements sans qu'on touche à rien ; la liaison reprend seule, Gtracker affiché, après une coupure du Wi-Fi ; le bandeau des réglages à deux réponses sur le téléphone.

## Liens

- Plans d'origine : `docs/backlog/449-plan-synchroniser.md`, `450-plan-sans-fil.md`, `481-itineraires.md`, `482-sans-fil-deux-sens.md`.
- Élément 488 (pare-feu demandé par un message) : à part, plus urgent, mais ses messages se relisent ici.
- Lots 449, 450, 481, 482 et 487 : leurs essais restent à finir sur le programme 0.01.92 ; cette remise à plat ne les bloque pas.
