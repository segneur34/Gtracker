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

Majeures, posées à l'utilisateur le 21/11 (réponses à écrire ici) :
1. Catalogue du matériel et activités : chaque appareil garde les siens, rapprochés par nom, « Reprendre » pour tout aligner (recommandé par le plan : plus simple, sans APK) ; ou la synchronisation les fond d'office par nom, en ajout seulement (renommages et suppressions non suivis, APK, exception au « jamais pris de lui-même »).
2. Arrivée du téléphone par le sans-fil : le plan recommande de ne plus rien copier d'office (« Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour. »). Variante de l'orchestrateur : l'arrivée continue de copier seule les sessions que le PC n'a jamais vues (la base le sait), sans jamais ramener une session supprimée sur le PC ; suppressions et écritures vers le téléphone attendent « Synchroniser ». Troisième choix : « Synchroniser » se lance seul à l'arrivée, garde-fou compris.
3. Copie de sécurité : le programme copie les deux dossiers d'office à la première synchronisation d'un téléphone, dans `Documents\Gtracker-copies\<date>\`, une seule fois par téléphone (recommandé) ; ou rien dans le produit, la copie d'avant le premier essai étant faite à la main par Claude.
