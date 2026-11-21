# 449 · « Synchroniser » dans les deux sens (programme Windows) : plan

Modèle | Réflexion : Fable | high pour la partie 1, Opus | high pour les autres (décision du 16/11 : une partie d'un lot Fable prend Opus quand le plan la juge à sa portée). Relecture obligatoire pour chaque partie.

Demande : `node outils/backlog.mjs --ligne 449`. Étude du moteur : `docs/backlog/445-exe-etude-synchronisation.md` (§2.3 à §6), qui reste la référence là où ce plan ne dit rien. Plan rendu par l'agent `Plan` le 21/11 ; **aucun code avant la réponse de l'utilisateur aux questions de la fin et à l'essai 330**.

## Règle validée le 21/11 (ne se rediscute pas)

- Le téléphone supprime pour de bon (ni corbeille ni session cachée sur le téléphone).
- À la synchronisation suivante, l'ordinateur met sa propre copie dans sa corbeille de 30 jours.
- Une session supprimée sur l'ordinateur va dans sa corbeille, puis part du téléphone à la synchronisation suivante.
- Une session restaurée depuis la corbeille revient sur les deux.
- Seule une session supprimée sur le téléphone avant d'avoir jamais atteint l'ordinateur est perdue, comme aujourd'hui.
- L'ordinateur garde l'état des deux dossiers à la fin de la dernière synchronisation réussie (la « base ») et en déduit ajouts, modifications et suppressions. Aucune note de suppression sur le téléphone.
- Garde-fous : la première synchronisation ne supprime rien ; arrêt avant de retirer plus de 10 sessions ou plus du quart d'un côté ; un appareil vidé par « Tout supprimer » ne vide jamais l'autre ; tout ce qui disparaît de l'ordinateur passe par la corbeille.

## L'existant

- « Récupérer » (câble, lot 447) et l'arrivée par le sans-fil (lot 450) ne font qu'ajouter au PC les sessions du téléphone.
- Le câble est en lecture seule : `bureau/telephone.ts` (`DossierDistant` : `etat`, `lister`, `lire`) et `bureau/adb.ts`.
- Le greffon Java du sans-fil ne connaît que `lister`, `lire` et `ping` (`ComputerLinkProtocol.java`).
- La corbeille du PC existe (lot 448 : `library/trash.ts`, `trashFolder.ts`, `hooks/sessionLibrary/trash.ts`).

## 1. Catalogue du matériel et activités

Ce qui existe :
- Les identifiants des activités de départ sont fixes (`wingfoil`, `kite`…, `DEFAULT_ACTIVITIES`). Ceux d'une activité créée sont tirés du nom (`newActivityId` : `a-<nom>`, `-2` en cas de collision) : deux appareils qui créent « Moth » ont le même identifiant, sauf collision.
- Le catalogue (`gearGroups[idActivité]`) et la liste des activités ne voyagent que dans `reglages/<appareil>.json`, et ne sont repris que par « Reprendre » (`adoptedValues`, qui remplace tout). C'est ainsi que le PC et le téléphone de l'utilisateur ont aujourd'hui les mêmes identifiants.
- La fiche garde une copie des noms : `notes.gear[] = { groupId, groupName, itemId, itemName }`.

Règle proposée par le plan (question majeure 1) : **le nom fait foi, l'identifiant ne vaut que sur son appareil.**
- La synchronisation ne touche jamais au catalogue ni aux activités d'un appareil. Elle recopie seulement les fichiers `reglages/*.json` d'un dossier à l'autre (partie 5) ; le bandeau « Nouveau fichier de réglages » existant les propose une fois, et « Reprendre » reste le seul moyen de les adopter (DECISIONS §8 : rien n'est pris de lui-même).
- Une fiche venue de l'autre appareil n'est jamais réécrite. Son choix se rattache par nom de ligne puis d'article, par la pièce du lot 477 (`src/library/gearMatch.ts` : `matchGearChoice`, `effectiveGear`), à l'analyse comme aux Statistiques.
- Un article renommé ou supprimé de l'autre côté reste montré sous le nom gardé dans la fiche, sur la ligne du même nom, « (hors liste) » dans les Statistiques. Le rechoisir écrit l'identifiant local.
- Une session dont l'activité est inconnue de l'appareil qui la reçoit est demandée avant l'analyse (déjà le cas) ; le compte rendu le dit et renvoie à « Reprendre ».
- Le 449 dépend donc du 477 commité.

## 2. Écritures que le téléphone accepte

Câble, sans APK. Le compte `shell` d'adb écrit dans `/sdcard/Documents/Gtracker`. À ajouter à `bureau/adb.ts` :
- écrire : `push` (arguments en tableau) vers `nom.gtracker-new` (fichier neuf) ou `nom.gtracker-tmp` (remplacement), taille relue par `stat`, puis `shell mv`. Jamais de `.tmp` ;
- supprimer : `shell rm`.

Protections du câble :
- les noms passent dans `adb shell`, qui recolle la commande : une fonction pure `citerShell` (apostrophes échappées), testée sur espaces, accents et apostrophes, plus une liste blanche de chemins (`cheminAdmis` étendu à `reglages/`, et à `gtracker.json` pour son seul champ `id`) ;
- les canaux `telephone:ecrireOctets` et `telephone:effacer` refusent tout autre chemin ;
- le listage montre les temporaires comme le téléphone les voit (`library/remoteTemps.ts`, règle de `finishInterruptedReplace`) ;
- le câble ne sait pas si le téléphone enregistre : l'enregistrement en cours vit dans le dossier privé `en-attente/`, et le PC n'écrit que des sessions neuves ou ne retire que des sessions déjà connues de la base. Risque accepté.

Sans-fil, APK neuve, lot suivant (449-c). À ajouter à `ComputerLinkProtocol.java` :
- `ecrire(chemin, début, octets)` par blocs de 1 Mio vers `.gtracker-new` ou `.gtracker-tmp`, puis `valider(chemin, taille)` qui vérifie la taille et renomme (protocole de `MemoryFolderPlugin`) ;
- `effacer(chemin)` ; `lister` étendu à `reglages/`.

Protections du sans-fil : appairage et jeton déjà en place ; chemins bornés à la base (`pathAllowed`, `inBase`) et à la même liste blanche que le câble ; refus `BUSY` pendant un enregistrement (le greffon n'en connaît pas l'état aujourd'hui : drapeau posé par la page ou par `RecordingService`, à vérifier) ; événement « fichiers changés » à la fin de la liaison. Le canal annonce s'il sait écrire. Sans écriture (APK 0.01.71), « Synchroniser » ne fait que la moitié du PC, garde les lignes de la base en attente et dit « 2 changements attendent le câble ou la mise à jour du téléphone ».

## 3. Comment l'application du téléphone l'apprend

- Aujourd'hui, rien : `visibilitychange` ne fait que vider les écritures (`lifecycle.ts`).
- Sans APK : au lancement suivant ou à « Mettre à jour » (`refreshLibrary`), une session disparue quitte la liste et une neuve est lue. `refreshLibrary` garde ce qui a été saisi pendant la relecture (`lastEdit`) ; l'image d'une vignette retirée est seulement inutile.
- Session ouverte et retirée sous elle : une saisie laisse une fiche orpheline, ignorée (`planReconcile`), que la synchronisation suivante retire (son nom est dans la base). Une fiche réécrite par le PC pendant une saisie est fondue champ par champ (`recordMerge.ts`).
- Avec APK (partie 6) : le PC pose `synchro: <instant>` dans `gtracker.json` du téléphone à la fin d'une synchronisation qui l'a changé ; l'application relit ce marqueur au retour au premier plan et lance `refreshLibrary` s'il a changé. Par le sans-fil, l'événement du greffon fera de même.

## 4. Ce que voit l'utilisateur

- Le bouton « Synchroniser » prend la place de « Récupérer » (en haut, avant « Enregistrer », programme Windows seulement, même style). `PhoneRecoverButton` devient `PhoneSyncButton`, dans la même fenêtre.
- Étapes : « Recherche du téléphone… », « Comparaison des deux appareils… », « 12 fichiers sur 50 ».
- Compte rendu, une ligne par cas non nul :
  - « Les deux appareils sont à jour. »
  - « 3 sessions copiées vers le téléphone, 5 vers l'ordinateur. »
  - « 2 sessions modifiées recopiées. »
  - « 1 session supprimée sur le téléphone : mise dans la corbeille de l'ordinateur (30 jours). »
  - « 2 sessions supprimées sur l'ordinateur : retirées du téléphone. »
  - « 1 session laissée pour la prochaine fois : elle n'est pas finie sur le téléphone. »
  - « 1 session d'une activité que l'ordinateur ne connaît pas : reprenez les réglages du téléphone (Réglages, Mémoire). »
  - jusqu'à la partie 6 : « Sur le téléphone, touchez « Mettre à jour » pour voir les changements. »
- Première synchronisation, ou dossier sans `id` (vidé par « Tout supprimer ») : avant le départ, « Première synchronisation avec ce téléphone : rien ne sera supprimé, chaque appareil reçoit ce qui lui manque. »
- Garde-fou : « Cette synchronisation retirerait 14 sessions. Rien n'est encore supprimé. », liste dépliable, boutons « Synchroniser sans rien supprimer » (principal), « Supprimer ces 14 sessions » (danger), « Annuler ».
- « Récupérer » disparaît. « Ajouter les sessions d'un dossier » ne change pas.
- Arrivée par le sans-fil : telle qu'elle est aujourd'hui, elle ramènerait une session supprimée sur le PC et encore sur le téléphone, et la sortirait de la corbeille (`forgetReturnedSession`), contre la règle du 21/11. Question majeure 2.

## 5. Parties (un commit chacune)

**P1 · Moteur pur des sessions (Fable high).**
- Fichiers neufs, chacun avec son test : `src/library/syncBase.ts` (format de la base `synchro/<id>.json` et des ancêtres de fiches, `id` du marqueur), `syncPlan.ts` (table O/T/B de l'étude §2.3, première rencontre sans suppression, garde-fou, deux traces de même instant, doublons, fiche future jamais réécrite), `syncRecordMerge.ts` (fusion à trois sans `summary`).
- Faux dossier fidèle : `src/test/syncFolder.fixture.ts` (octets, dates qui avancent, temporaires du téléphone, coupure à la n-ième opération, listage en retard).
- À réutiliser : `addRecordEdits`, `mergeChangedRecord`, `conflictLabels`, `sameStamp` (`recordMerge.ts`), `dedupeSessions`, `isWritableRecord`, `parseRecordWithRaw` (`record.ts`), `readMarkerVersion`.
- Tests : cas 1 à 6 et 10 à 14 de l'étude §6.1.

**P2 · Écriture par câble dans la coquille (Opus high).**
- `bureau/telephone.ts` : `ecrire` et `effacer`, `dossierLocal` qui écrit (pour le banc et les tests).
- `bureau/adb.ts` : push, mv, rm, `citerShell`, listage de `reglages/`, plus `remoteTemps`.
- `main.ts`, `preload.ts`, `pont.test.ts`.
- `src/platform/desktopBridge.ts` et `phoneCable.ts` : un `MemoryFolder` de sorte `phone` (règle 12).
- Tests : faux lanceur (ordre push, stat, mv ; taille fausse, temporaire retiré ; jamais `kill-server` ni `.tmp`), chemins refusés.

**P3 · Exécutant (Opus high).**
- `src/hooks/sessionLibrary/sync.ts`. Verrou : `flushWrites`, imports grisés, `refreshLibrary` à la fin. Ordre d'écriture `.imu`, fiche, GPX en dernier. Suppression GPX d'abord, `stat` avant chaque suppression. Base réécrite après chaque session, `synchro/en-cours.json`.
- Corbeille : origine « téléphone » dans `library/trash.ts` (aujourd'hui `TrashOrigin = 'ordinateur'`, que le lecteur exige : `TRASH_VERSION` augmente).
- `resetPlan.ts` : `synchro/`. Les copies venues du téléphone passent par `addGpx` sans `forgetReturnedSession` quand la base dit « supprimée ici ».
- Tests : coupure après chaque opération (cas 9), restauration (cas 8), réimport (cas 7), second téléphone (cas 18).

**P4 · Bouton, compte rendu, banc (Opus high ; le script du banc à part, sur Sonnet).**
- `src/library/syncReport.ts` (pur, testé), `PhoneSyncButton.tsx` et son `.css` (aucun `style={{`), retrait de `phoneRecovery`.
- Arrivée par le sans-fil selon la question majeure 2. Dictionnaires `en` et `es`.
- Copie de sécurité à la première synchronisation d'une paire, selon la question majeure 3.
- Banc : `outils/banc/exe-recuperer.mjs` devient `exe-synchroniser.mjs` (`GTRACKER_BANC_TELEPHONE` en écriture) : première synchronisation, suppression de chaque côté, corbeille, garde-fou à 11, coupure. `SCRIPTS.md` à jour.

**P5 · Réglages proposés, FC repos, lieux (Opus high).**
- Fichiers `reglages/*.json` recopiés et jamais adoptés : même nom et `device.id` différent, pas d'écrasement, et c'est dit ; le fichier propre de chaque appareil n'est jamais supprimé.
- `fc-repos.json` et `lieux.json` fondus des deux côtés (`mergeRestingResults`, `mergeLearnedPlaces`) ; un fichier illisible ou d'une version future n'est jamais réécrit.
- Ligne « activité inconnue ». Tests du cas 16.

**P6 · Téléphone (Opus high, APK).**
- Relecture de `gtracker.json` au retour au premier plan, puis `refreshLibrary` (`lifecycle.ts`), et son test.

Lots suivants, à noter au reste à faire quand le plan sera accepté :
- 449-b, itinéraires : suppressions par la base, corbeille d'itinéraires (`stashRoute`), conflit résolu par le plus récent `updatedAt`.
- 449-c, sans-fil en écriture : greffon Java, protections, `lister` étendu ; après l'essai 330.
- 449-d, « Tout supprimer » retire d'abord l'`id` du marqueur (étude S6, APK).

Règles qui s'appliquent : 12 (rien hors de `src/platform/` vers le pont), 14 (commentaires), textes par `t` et `tn` sans clé manquante, variables du thème et aucun style en ligne dans un fichier neuf, DECISIONS §8 (rien adopté d'office, fiche future jamais réécrite, identité par `startMs`) ; le résumé ne voyage pas pour une session déjà présente des deux côtés.

## 6. Essais au vrai téléphone

1. Première synchronisation de la vraie mémoire par le câble : même nombre de sessions des deux côtés, corbeille vide, durée pour environ 25 sessions.
2. Session supprimée au téléphone : elle est dans la corbeille du PC. Supprimée au PC : elle est partie du téléphone, puis elle revient à la restauration.
3. **Critique, à faire avant le code de P2** (ajout de l'orchestrateur) : un fichier poussé par adb dans `Documents/Gtracker` peut-il être renommé puis supprimé par l'application du téléphone ? Si le dossier désigné ne peut ni réécrire ni effacer un fichier créé par le compte `shell`, toute l'écriture par câble est à revoir.

## Risques

- Fichier écrit par adb puis modifié par le téléphone (essai 3).
- Noms passés au shell du téléphone (`citerShell`).
- Première synchronisation lente : chaque fiche du téléphone est lue une fois par `pull`.
- Le sans-fil reste en réception seule tant que 449-c n'est pas fait.

## Questions

Mineures, tranchées par l'orchestrateur le 21/11 :
- Les réglages proposés passent avant les itinéraires (P5 dans ce lot, itinéraires en 449-b), à l'inverse de l'ordre de la ligne, parce que la règle du catalogue en dépend.
- `TRASH_VERSION` augmente pour la nouvelle origine.
- Le drapeau « enregistrement en cours » du greffon se décide au 449-c.

Réponses de l'utilisateur, le 21/11 :
- Question 1 (matériel) : ni l'un ni l'autre tels quels. Il veut une fenêtre sur le PC qui met côte à côte le matériel du téléphone et celui de l'ordinateur, pour valider lui-même qu'il n'y a pas de doublon (« une virgule, un espace ou une majuscule ») et y supprimer ou synchroniser : c'est l'élément 478, avec sa maquette. D'ici là, chaque appareil garde sa liste, rapprochée par nom (lot 477, noms comparés sans majuscules, espaces doublés ni virgule décimale), et le 449 recopie les fichiers de réglages (P5).
- Question 2 (arrivée par le sans-fil) : « on attend le bouton synchroniser », à faire préciser ; et « une sauvegarde de 30 jours sur le téléphone », qui contredit la règle validée (corbeille sur l'ordinateur, le téléphone supprime pour de bon) : redemandé le 21/11.
- Question 3 (copie de sécurité) : oui, d'office (« ça vaut le coup de faire des sauvegardes »).
- Essai 330 : Windows a posé sa question de pare-feu ; après le code tapé, aucun message ; l'utilisateur suppose les deux reliés et attend une session neuve pour le voir.
- Essai critique d'avant P2 : fait le 21/11, téléphone branché, réussi. Une session synthétique poussée par adb (`push` vers `nom.gpx.gtracker-new`, taille relue par `stat`, `shell mv`) a été lue par l'application à « Mettre à jour », qui a créé sa fiche ; la fiche, réécrite par adb (`push` vers `nom.json.gtracker-tmp`, `stat`, `mv`), a ensuite été réécrite par l'application, puis l'utilisateur a supprimé la session dans l'application (« c bon ») : les deux fichiers ont disparu, aucun temporaire ne reste, le dossier a retrouvé ses 55 fichiers. Le téléphone lit, modifie et efface donc un fichier écrit par le compte `shell` : l'écriture par câble de P2 tient telle que le plan la décrit.

Réponses de l'utilisateur, le 21/11 après-midi (elles closent Q141 et Q142) :
- Q141 : la corbeille de 30 jours reste sur l'ordinateur seulement ; le téléphone supprime pour de bon.
- Q142 : « tout par le bouton, pas d'arrivée automatique ». Quand le téléphone se présente par le sans-fil, plus rien ne se copie seul : une ligne « Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour. ». L'essai 331 du lot 450 (la session neuve arrive seule) ne tient donc plus tel quel.
- Session déjà dans la corbeille de l'ordinateur et encore sur le téléphone à la première synchronisation : « oui on retire du tel avec un message à valider ». La synchronisation la retire du téléphone, mais seulement après que l'utilisateur l'a confirmé dans la fenêtre (liste des sessions concernées, « Retirer du téléphone », « Les laisser ») ; elle reste 30 jours dans la corbeille de l'ordinateur.

Majeures, posées à l'utilisateur le 21/11 :
1. Catalogue du matériel et activités : chaque appareil garde les siens, rapprochés par nom, « Reprendre » pour tout aligner (recommandé par le plan : plus simple, sans APK) ; ou la synchronisation les fond d'office par nom, en ajout seulement (renommages et suppressions non suivis, APK, exception au « jamais pris de lui-même »).
2. Arrivée du téléphone par le sans-fil : le plan recommande de ne plus rien copier d'office (« Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour. »). Variante de l'orchestrateur : l'arrivée continue de copier seule les sessions que le PC n'a jamais vues (la base le sait), sans jamais ramener une session supprimée sur le PC ; suppressions et écritures vers le téléphone attendent « Synchroniser ». Troisième choix : « Synchroniser » se lance seul à l'arrivée, garde-fou compris.
3. Copie de sécurité : le programme copie les deux dossiers d'office à la première synchronisation d'un téléphone, dans `Documents\Gtracker-copies\<date>\`, une seule fois par téléphone (recommandé) ; ou rien dans le produit, la copie d'avant le premier essai étant faite à la main par Claude.

## P1 rendue : ce sur quoi les parties suivantes s'appuient

Fichiers : `src/library/syncBase.ts`, `syncPlan.ts`, `syncRecordMerge.ts`, leurs tests, et `src/test/syncFolder.fixture.ts` (faux dossiers, et `runFixtureSync`, un exécutant minimal qui sert de modèle à P3).

Enchaînement que suit l'exécutant (P3), tout en fonctions pures sauf ses lectures et écritures :
1. `syncRefusal(marqueur ordinateur, marqueur téléphone)` ; `readMarkerId` des deux ; base lue par `parseSyncBase(texte de synchro/<id du téléphone>.json)` (`newer` : refuser, ne pas réécrire ; `unreadable` : comme absente).
2. `syncPair(idOrdinateur, idTéléphone, cheminTéléphone, base)` : dit si c'est une première rencontre (`first`, sa raison), la base qui vaut (`base`, nulle à une première rencontre) et quels marqueurs reçoivent un identifiant neuf (`newId`, écrit par `markerTextWithId`, avant tout).
3. `syncListing(listage de sessions/)` de chaque côté ; `syncRecordsToRead(listage, pair.base, côté, aUnAncêtre)` donne les fiches à lire, `aUnAncêtre(startMs, côté)` disant si la fiche gardée de ce côté existe encore (une seule qui manque : la fiche est lue et fondue sans ancêtre, `item.withoutAncestor`, puis reposée) ; `syncSide(listage, textes lus)`. Pour un GPX inconnu de la base, poser `gpxComplete` (`isCompleteGpxText`).
4. `planSync({ pair, computer, phone, ancestors, trash })` : `ancestors`, les deux fiches gardées par ligne de base (`syncAncestorPath`) ; `trash`, une entrée par session de la corbeille, avec le nom et la taille de ses fichiers (`TrashEntry.startMs` et `files`).
5. `restrictSyncPlan(plan, { computer, phone, deletions })` selon ce qui est permis : garde-fou non confirmé (`plan.guard.tripped`) ou « sans rien supprimer » : `deletions: false` ; téléphone qu'on ne peut pas écrire, ou arrivée par le sans-fil : `phone: false`.
6. Pour chaque `item`, ses `ops` dans l'ordre, puis son `base` : `set` (relire les tampons par `stat`, écrire les ancêtres non nuls, `withSyncLine`), `forget` (`withoutSyncLine`), `hold` (`withSyncHeld`), `keep` (ne rien toucher). La base est réécrite après chaque session. En fin de synchronisation entière seulement : `withSyncDone`.

Règle de la base après une exécution partielle (coupure, restriction, opération abandonnée) : la ligne d'une session n'est réécrite que si toutes ses opérations ont été faites ; sinon elle reste telle quelle, ou absente. Le plan suivant retrouve ce qui manque et ne refait pas ce qui est fait (éprouvé : coupure après chaque pas, de chaque côté). `restrictSyncPlan` pose lui-même `keep` sur une session dont une opération est retirée, et `saveBase: false` quand le téléphone, sans identifiant, ne peut pas en recevoir.

Ce que l'exécutant doit vérifier lui-même, que le plan ne peut pas voir : `stat` du fichier nommé par `absent` avant toute suppression (listage en retard) ; tampon inchangé (`file`) avant d'écraser une fiche ; GPX fini avant de le recopier ; pour `removeFromPhone`, `keep: 'all'` (ranger d'abord ces fichiers du téléphone dans la corbeille, à part de la copie de l'ordinateur : deux traces du même instant peuvent porter le même nom) et `keep: 'record'` (fondre sa fiche dans celle de la corbeille par `mergeSyncRecords`).

Une suppression couvre toutes les copies de la session du côté où elle s'applique (doublons compris) : une opération `trash` ou `removeFromPhone` par copie, dans le même `item`, plus une pour les restes d'une suppression coupée (fiche ou capteurs sans GPX que la base nomme). `trash.files` et `removeFromPhone.files` sont des listes de fichiers, GPX d'abord quand il y en a un. Rien ne quitte le téléphone avec `keep: 'none'` sans que la corbeille tienne un GPX et des capteurs de la même taille et que sa fiche soit celle de la base. Une session n'est jamais tenue pour supprimée d'un côté tant qu'un fichier y porte le nom que la base donnait à son GPX : elle est laissée, raison `changedGpx`.

Écarts à l'étude, à relire :
- deux fiches gardées par session (une par côté) au lieu d'une : la fiche d'un appareil porte son résumé, le nom de son GPX et sa date d'entrée ;
- une fiche changée d'un seul côté n'est pas recopiée à l'octet : l'autre côté reçoit les champs changés et garde son résumé et le nom de son GPX (les noms diffèrent d'un fuseau à l'autre) ; seule une fiche d'une version plus récente est recopiée à l'octet, et seulement si les deux GPX portent le même nom ; changée des deux côtés, elle est laissée et dite, rien ne va à la corbeille ;
- même champ changé des deux côtés, notes et réglages compris : conflit dit, l'ordinateur l'emporte, à la première rencontre comme ensuite. Aucune date ne départage deux appareils (horloges différentes) et aucune ne passe de l'un à l'autre : chaque bloc de notes ou de réglages garde le `savedAt` de son appareil (`mergeChangedRecord`, option `datedByClock: false` ; ses appelants d'avant ne changent pas). Un bloc qui n'existait pas du tout de l'autre côté y arrive sans date (`savedAt: 0`) ;
- une fiche dont la date d'entrée a changé (perdue puis recréée vide), ou dont une des deux copies gardées manque, est fondue comme à une première rencontre : rien n'est effacé, le côté resté suivi l'emporte ;
- le format de la base est `FILE_FORMATS.synchro` (`gtracker-synchro`).

Règles ajoutées pour ne rien perdre ni ressusciter :
- le téléphone n'a pas de corbeille : ce qui doit en être retiré et que la corbeille de l'ordinateur ne tient pas à l'identique (GPX effacé à la main, corbeille vidée ou purgée, « Tout supprimer » interrompu sur l'ordinateur, autre trace du même instant, capteurs que seul le téléphone avait, doublon) y est d'abord rangé ;
- un GPX que la base connaît (même nom, même taille) garde son identité même si le résumé de sa fiche date autrement son premier point.

Session dans la corbeille de l'ordinateur et encore sur le téléphone, sans ligne de base (supprimée sur l'ordinateur avant la première synchronisation, ou arrivée hors synchronisation) : **à trancher par l'utilisateur**. Aujourd'hui elle n'est ni ramenée ni retirée : laissée, raison `inTrash`, à dire. Ce que la base garde pour cela : `SyncBase.held`, la liste des identités (`startMs`) de ces sessions, posée par l'étape `hold` du plan (`withSyncHeld`). Tant qu'une identité y est, la session du téléphone reste laissée et dite, même après que la corbeille l'a purgée : elle ne revient pas en silence. Elle en sort quand la session retrouve une ligne (restaurée sur l'ordinateur : `withSyncLine`) ou n'est plus sur le téléphone (`withoutSyncLine`). Pour la retirer du téléphone à la synchronisation suivante, une ligne à changer : `SYNC_HELD_ON_PHONE = 'remove'` dans `syncPlan.ts` (ou `heldOnPhone: 'remove'` passé à `planSync`) ; elle est alors retirée comme une session supprimée sur l'ordinateur, sa copie rangée d'abord à la corbeille, et comptée par le garde-fou (éprouvé par un test). À part, `SyncBase.removed` retient les suppressions que la synchronisation a menées au bout : une telle session revue sur le téléphone y a été remise exprès, et revient.

## P3 rendue : l'exécutant

`src/hooks/sessionLibrary/sync.ts`, couche au-dessus de `trashRestore`, pas encore exportée par `useSessionLibrary` (P4 le fera) :
- `executeSync(ordinateur, téléphone, options)` sans état de l'application (testé sur le faux dossier) ; `synchronizePhone(téléphone, options)` y ajoute le verrou (`importing`, `flushWrites`, attente des passages de fond, `refreshLibrary` et `reloadTrash` à la fin). Options : `phoneWritable`, `withoutDeletions`, `confirmDeletions`, `phonePath`, `heldOnPhone`, `onProgress(fait, total)`.
- Rend un `SyncOutcome` (ne lève pas) : `refusal` (`SyncRefusal`, `newerBase`, `noTrash`, `trashLocked`, `memory`, `busy`), `interrupted` (témoin `synchro/en-cours.json` trouvé), `first`, `plan`, `held` (garde-fou), `done`, `skipped` (fichier changé depuis le listage), `failed` (erreur sur l'ordinateur, par session), `keptFromPhone`, `linkLost`, `error`, `complete`.
- Copies vers l'ordinateur écrites par l'exécutant (capteurs, fiche, GPX en dernier, fiche à l'octet), pas par `addGpx`, qui écrit le GPX d'abord et refait la fiche ; jamais `forgetReturnedSession`.
- Corbeille version 2 : origine `telephone`, une entrée à part ; reprise d'une entrée seulement si tous ses fichiers ont la même taille ; restauration et `forgetReturnedSession` ne retirent plus les entrées de l'autre origine.
- `resetPlan.ts` : « Tout supprimer » efface d'abord les bases de `synchro/`, puis le témoin et les fiches gardées.
- Le câble répond à `stat` d'après son dernier listage : avant chaque retrait du téléphone, l'exécutant relit le listage (`list('sessions')`), puis compare taille et date.
- Après relecture : la corbeille est relue juste avant tout retrait `keep: 'none'` ou `'record'` (sinon la copie du téléphone y est rangée d'abord) ; elle est tenue pendant la synchronisation (`holdTrashDuring` : restaurer, supprimer définitivement, vider, purger attendent) ; des restes sans GPX vont avec l'entrée de leur session, sinon dans une entrée `kind: 'restes'`, ni montrée (`shownTrashEntries`), ni restaurée, ni comptée. `SyncOutcome.held` est remplacé par `deletions` (`made`, `excluded`, `awaitingConfirmation`), `withheldDeletions` et `phoneWritable`. `synchronizePhone` reçoit `recording` (l'enregistreur dépend de la bibliothèque).

## P5 rendue : réglages, FC repos, lieux

`src/library/syncExtras.ts` (plan pur `planSyncExtras`, `unknownSyncActivity`) et son test ; `executeSync` le joue après les sessions (`syncExtraFiles`), sans base : le plan est refait en entier à chaque fois, une reprise ne fait que ce qui manque. Rien n'est supprimé ni adopté ; hors garde-fou.
- `reglages/*.json` (noms comparés sans majuscules) : absent de l'autre côté, recopié, sauf illisible, portant l'identifiant de l'ordinateur (`computerDeviceId`, il écrit seul le sien), ou déjà là sous un autre nom en version du même appareil au moins aussi récente (appareil renommé ; à même date, aucun des deux noms ne voyage avant son changement suivant). Même nom : autre appareil, laissé (`otherDevice`) ; même appareil, le fichier propre de l'ordinateur fait foi, sinon le plus grand `savedAt` remplace l'autre (les deux dates viennent de l'horloge de l'appareil qui a écrit le fichier, pas des deux appareils ; ainsi le fichier propre du téléphone, dont l'ordinateur ne connaît pas l'identifiant, n'est jamais remplacé par une copie plus ancienne) ; même date, laissé (`sameDate`) ; destination d'une version plus récente, jamais écrasée.
- `fc-repos.json`, `lieux.json` : fondus (ordinateur d'abord), écrits du côté où le résultat diffère ; illisible ou plus récent d'un côté (`isNewerRestingHrFile`, neuf), rien d'écrit d'aucun côté.
- Chaque écriture n'a lieu que si le fichier est encore tel que lu (sinon `changed`) ; vers un téléphone qu'on ne peut pas écrire : `extras.withheld`.
- `SyncOutcome.extras` (`done`, `left` avec raison, `withheld`) et `unknownActivities` (côté, `startMs`, identifiant), relevé sur toute fiche écrite d'un côté dont `knownActivities` est donné. `synchronizePhone` passe la liste de l'ordinateur (`readStoredActivities`) et `deviceId()` (exporté) ; le téléphone n'est pas vérifié. `complete` est faux si un de ces fichiers a échoué ou changé.
