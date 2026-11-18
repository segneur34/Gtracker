# 445 · Synchronisation du dossier mémoire entre l'ordinateur et le téléphone, et corbeille de l'ordinateur

Étude de conception du 18/11/2026. Rien n'est codé. Dans ce rapport, **lu** désigne ce qui existe aujourd'hui dans le code (chemin et fonction cités), **proposé** ce qui reste à faire. L'étude sœur `docs/backlog/445-exe-etude-coquille.md` traite de la coquille Windows et du dossier du disque ; celle-ci suppose ce lot fait (un `MemoryFolder` de sorte « disque » sur l'ordinateur).

Sources : `CLAUDE.md`, `docs/DECISIONS.md` §8, `docs/ETAT_DU_PROJET.md` §6.1 et §6.2, l'étude du 12/11 (`D:\gong tracker\atelier\backlog-clos\exe-ordinateur-etude-tracker.md`, §3) et la fiche 217 de l'autre application, lue sans y écrire.

Décisions de l'utilisateur du 18/11 prises pour données : une session supprimée d'un côté disparaît de l'autre à la synchronisation suivante ; sur l'ordinateur, une session supprimée est gardée au moins 30 jours ; deux canaux (câble d'abord, sans fil ensuite), donc une synchronisation écrite sur un « dossier distant » abstrait ; par câble, seul l'ordinateur lit et écrit les deux dossiers.

## 0. Résumé

- **Principe retenu (proposé)** : l'ordinateur garde, pour chaque téléphone, l'état des deux dossiers à la fin de la dernière synchronisation réussie (la « base » : identité de chaque session, noms de fichiers des deux côtés, taille et date de chaque fichier, texte de la fiche). À la synchronisation suivante, il compare chaque côté à la base : ce qui a changé d'un seul côté est recopié, ce qui a changé des deux côtés est fondu champ par champ (fusion à trois, avec la base pour ancêtre commun), ce qui a disparu d'un côté et reste inchangé de l'autre est supprimé de l'autre. Le téléphone n'a rien à noter : **aucune APK n'est nécessaire** pour synchroniser.
- La base est de toute façon indispensable pour fondre une fiche changée des deux côtés : la même pièce sert aux suppressions.
- **La corbeille de l'ordinateur est le filet des deux côtés** : tout ce que la synchronisation retire de l'ordinateur y passe, et tout ce qu'elle retire du téléphone y est déjà, ou y est mis avant d'être retiré. Rien ne disparaît sans avoir passé au moins 30 jours dans la corbeille de l'ordinateur.
- **Première synchronisation d'une paire, ou dossier méconnu : rien n'est supprimé, tout est réuni.** Une suppression ne se déduit que d'une base que l'on reconnaît sans doute possible (identifiant du dossier dans son marqueur).
- **Écritures sur le téléphone selon le protocole du téléphone lui-même** (suffixes `.gtracker-tmp` et `.gtracker-new` de `MemoryFolderPlugin.java`) : une coupure du câble laisse un état que l'application du téléphone et la synchronisation suivante savent achever.
- Six lots, dont deux utiles seuls avant toute synchronisation : « Récupérer » et la corbeille.

## 1. L'existant réutilisable, et ce qui manque

### 1.1 Lu dans le code

| Pièce | Où | Ce qu'elle apporte à la synchronisation |
|---|---|---|
| `MemoryFolder` (`list`, `readText`, `readBytes`, `writeText`, `writeBytes`, `stat`, `remove`), `FolderEntry` (`size`, `mtimeMs`) | `src/platform/memoryFolder.ts` | Exactement le « dossier distant » demandé (lister, lire, écrire, supprimer, date et taille). Le dossier de l'ordinateur et le téléphone par câble en seront deux sortes de plus. Pas de renommage dans l'interface. |
| `ImportEntry`, `folderImportPaths`, `pickFolderToImport` | `src/platform/memoryFolder.ts` | Une liste de fichiers à lire au dernier moment, tirée de la racine et de `sessions/` ; `pickFolderToImport` en est le modèle pour un dossier du téléphone. |
| `importEntries` | `src/hooks/sessionLibrary/importer.ts` | « Ajouter les sessions d'un dossier » : GPX, fiche posée à côté ou portée par le paquet, `.imu`, une session à la fois ; compte rendu détaillé (`ImportOutcome`, `describeImport` de `src/library/importReport.ts`). C'est « Récupérer » presque tel quel. |
| `addGpx` | `src/hooks/sessionLibrary/addSession.ts` | Identité par `summary.startMs` (`findSessionAt`), session déjà là complétée sans rien écraser (`completeRecord`), `.imu` ajouté s'il manque, nom unique (`uniqueSessionFileName`), retrait de ce qui a été écrit en cas d'échec. Limite : chaque GPX est résumé (`runInWorker('summarize')`) **avant** de savoir s'il est déjà là. |
| `importRecordChoice` | `src/library/importEntry.ts` | Fiche posée à côté ou fiche du paquet ; fiche d'une version future ou illisible gardée au caractère près (`keepRecordText`). |
| `completeRecord`, `carryRecordEdits`, `RECORD_EDIT_FIELDS` | `src/library/record.ts` | Compléter une fiche sans rien écraser ; reporter les saisies d'une copie sur une autre. |
| `addRecordEdits`, `mergeChangedRecord`, `conflictLabels`, `sameStamp` | `src/library/recordMerge.ts` | Le cœur de la fusion à trois : `addRecordEdits(base, côtéA)` donne les chemins changés de A depuis la base ; `mergeChangedRecord(côtéB, côtéA, ces changements)` garde tout B sauf ces chemins, blocs datés (`notes`, `analysis`) tranchés par `savedAt`, lieu par rang (`mergedPlace`), conflits rendus pour être dits. `sameStamp` compare taille et date sans se fier à une date nulle. |
| `parseRecordWithRaw`, `serializeRecord`, `isWritableRecord`, `RECORD_VERSION` | `src/library/record.ts` | Champs inconnus et champs illisibles conservés à la réécriture ; fiche d'une version future jamais réécrite. |
| `dedupeSessions` | `src/library/record.ts` | Une seule session par `startMs` ; les doublons d'un même dossier sont rendus pour être signalés. |
| `removeSession` | `src/hooks/sessionLibrary/sessionRecords.ts` | Suppression dans le bon ordre : GPX d'abord, puis fiche et `.imu` ; toutes les copies de la même trace. |
| `bundleSessionGpx`, `unbundleSessionGpx` | `src/library/sessionBundle.ts` | Session en un seul fichier (fiche et capteurs dans une extension). Utile à la corbeille et au canal sans fil, pas au câble. |
| `parseSettingsFile`, `SettingsFile.savedAt`, `device.id`, `unseenSettingsEntries`, `adoptedValues` | `src/library/settingsFile.ts` | Un fichier par appareil, reconnu à son identifiant ; jamais adopté de lui-même ; bandeau « Nouveau fichier de réglages » pour un fichier jamais vu. La synchronisation n'a qu'à recopier des fichiers. |
| `mergeRestingResults`, `parseRestingHrFile` | `src/library/restingHrStore.ts` | Union par instant de départ ; fichier illisible jamais écrasé (`null`). Limite écrite : sans mémoire des retraits. |
| `mergeLearnedPlaces`, `parseLearnedPlacesFile` | `src/library/learnedPlaces.ts` | Union, le plus récent l'emporte dans un rayon ; fichier d'une version future lu, jamais réécrit (`writable`). Même limite. |
| `RouteRecord` (`createdAt`, `updatedAt`), `saveRoute`, `removeRoute`, `routeFileBase` | `src/planning/routeRecord.ts`, `src/hooks/routeFiles.ts` | Itinéraire = `itineraires/<base>.json` (fait foi) et `<base>.gpx` ; la base du nom ne change pas quand on le range de nouveau ; suppression fiche puis GPX. Pas d'identifiant propre. |
| `readMarkerVersion`, `MEMORY_VERSION`, `ensureLayout`, `guardedFolder` | `src/library/folderLayout.ts`, `src/hooks/sessionLibrary/lifecycle.ts` | Le marqueur `gtracker.json` n'est écrit que s'il manque, et seuls `format` et `version` y sont lus : un champ de plus y est sans effet pour l'application. Mémoire plus récente que l'application : lecture seule. |
| `memoryResetTargets`, `eraseAppFiles`, `isAppMemoryFile`, `factoryKeyPlan`, `eraseKeyPlan` | `src/library/resetPlan.ts` | « Tout supprimer » efface les GPX d'abord et **le marqueur en dernier** ; il n'efface que les fichiers que l'application reconnaît ; il efface aussi l'identifiant de l'appareil (`eraseKeyPlan`). |
| `planReconcile` (`orphanRecords`) | `src/library/reconcile.ts` | Une fiche sans GPX est ignorée et laissée en place ; un GPX sans fiche reçoit une fiche neuve au lancement suivant (les saisies seraient alors perdues : d'où l'ordre d'écriture du §2.4). |
| `isCompleteGpxText`, `planPendingTemps` | `src/library/pendingTemps.ts` | Reconnaître un GPX complet (fini par `</gpx>`) ; plan des temporaires de l'attente. |
| `replace`, `createNew`, `finishInterruptedReplace` | `android/.../MemoryFolderPlugin.java` | Protocole d'écriture du téléphone : remplacement par `nom.gtracker-tmp` puis échange, création par `nom.gtracker-new` puis renommage ; au listage, un `.gtracker-tmp` seul reprend son nom, un `.gtracker-new` seul est effacé. |
| `createFakeFolder` | `src/test/memoryFolder.fixture.ts` | Faux dossier en mémoire vive pour les tests ; il n'écrit pas les octets et donne la même date à tout (`mtimeMs: 1`). |

### 1.2 Ce qui manque (proposé)

- Un `MemoryFolder` du téléphone par câble (débogage USB d'abord), écrit côté coquille, qui suit le protocole d'écriture du téléphone (§2.4) et interprète ses temporaires comme lui.
- Un identifiant de dossier, posé dans le marqueur `gtracker.json` (champ `id`), pour reconnaître une paire et repérer un dossier remis à zéro.
- La base de chaque paire et son format, rangés sur l'ordinateur.
- Un planificateur pur (deux listages, la base, des fiches lues à la demande, rend une liste d'opérations), un exécutant, et le compte rendu.
- Une fusion à trois des fiches qui ne fait pas voyager le résumé (§2.3), écrite autour de `addRecordEdits` et `mergeChangedRecord`.
- Une préfiltration de « Récupérer » par l'identité lue dans la fiche du téléphone, pour ne pas lire ni résumer de nouveau 300 GPX déjà présents.
- La corbeille de l'ordinateur : rangement, index, purge, restauration, écran.
- Un faux dossier plus fidèle pour les tests : octets, dates qui avancent, coupure injectée après la n-ième opération, listage en retard.

## 2. « Récupérer » puis « Synchroniser »

### 2.1 Le dossier distant (proposé)

Le dossier du téléphone est un `MemoryFolder` comme les autres (nouvelle sorte, par exemple `phone`), sans rien savoir du canal au-dessus de lui. Le contrat ajoute trois règles écrites dans le code :

1. `writeText` et `writeBytes` sont « entiers ou rien » du point de vue du téléphone : l'adaptateur écrit selon le protocole du téléphone (§2.4).
2. `list` rend les fichiers tels que l'application du téléphone les verrait : un `.gtracker-tmp` seul est montré sous son nom d'origine, un `.gtracker-tmp` à côté de son original et un `.gtracker-new` sont cachés, un `.tmp` aussi. Cette lecture est une fonction pure partagée, testée (`library/remoteTemps.ts`), qui reprend la règle de `finishInterruptedReplace`.
3. `stat` sur un chemin précis fait foi : une suppression déduite d'un listage est revérifiée par `stat` avant d'agir (le canal « Transfert de fichiers » peut lister en retard).

Le chemin du dossier sur le téléphone (`Documents/Gtracker` par défaut) est cherché par l'ordinateur ; l'utilisateur peut en désigner un autre. Il est retenu avec la paire.

### 2.2 « Récupérer » (téléphone vers ordinateur, proposé)

C'est l'import d'un dossier pointé sur le téléphone, avec ce qui existe déjà.

1. Refus si la mémoire de l'ordinateur n'est pas prête (`canImportSessions`), si le dossier du téléphone n'a pas de marqueur, ou si son marqueur dit une version plus récente que `MEMORY_VERSION`.
2. Listage de la racine et de `sessions/` du téléphone ; entrées par `folderImportPaths`, comme `pickFolderToImport`.
3. **Préfiltre (neuf)** : pour chaque GPX du téléphone dont la fiche se lit, `summary.startMs` est lu dans la fiche (quelques Ko) ; si une session de l'ordinateur a déjà cet instant et ses capteurs, son GPX n'est ni lu ni résumé : la fiche seule passe par `completeRecord`. Sans fiche lisible, le GPX est lu comme aujourd'hui.
4. `importEntries(entrées, { fromFolder: true })` fait le reste : sessions neuves rangées, fiches complétées sans rien écraser, `.imu` ajoutés.
5. Puis, sans rien écrire sur le téléphone : son fichier de réglages est recopié dans `reglages/` de l'ordinateur s'il est plus récent que la copie déjà là (le bandeau existant le propose une fois, jamais adopté d'office) ; `fc-repos.json` et `lieux.json` du téléphone sont fondus dans ceux de l'ordinateur (`mergeRestingResults`, `mergeLearnedPlaces`) ; les itinéraires absents de l'ordinateur sont recopiés (fiche, puis GPX).

Limite assumée, à écrire dans l'aide : « Récupérer » ne reporte pas sur l'ordinateur une modification faite au téléphone sur une session déjà récupérée (`completeRecord` ne remplace rien) ; c'est le rôle de « Synchroniser ». « Récupérer » ne supprime jamais rien et ne crée pas de base : la première synchronisation qui suivra sera une réunion.

### 2.3 « Synchroniser » (deux sens, proposé)

**Lecture.** Les deux dossiers sont listés (`sessions/`, `itineraires/`, `reglages/`, racine). Une fiche n'est lue que si sa taille ou sa date diffère de la base, ou si elle n'y est pas. Chaque session est rangée sous son identité, l'instant du premier point (`summary.startMs` de la fiche ; sans fiche lisible, lu dans le GPX). Les noms de fichiers ne servent jamais d'identité : ils sont tirés de l'heure **locale** (`sessionFileName`, `formatLocalDate`), donc différents d'un fuseau à l'autre, et `-2` peut s'y ajouter.

**Sessions, par identité.** Notations : O présent sur l'ordinateur, T présent sur le téléphone, B présent dans la base ; « changé » = fiche ou `.imu` dont le tampon diffère de la base **et** dont le contenu diffère hors résumé (voir plus bas).

| O | T | B | Cas | Action |
|---|---|---|---|---|
| oui | non | non | neuve sur l'ordinateur | recopiée sur le téléphone (§2.4) |
| non | oui | non | neuve sur le téléphone | recopiée sur l'ordinateur, si elle est complète (GPX fini par `</gpx>` et fiche présente ; sinon laissée pour la fois suivante et dite) |
| oui | oui | non | première rencontre (réunion, ou après une coupure) | GPX de même taille : fiches fondues sans ancêtre (`completeRecord` dans les deux sens, puis blocs datés par `savedAt` ; un champ saisi différent des deux côtés est un conflit dit, l'ordinateur l'emporte), écrites là où elles changent ; tailles différentes : voir « deux traces » |
| oui | oui | oui | suivi | rien si aucun côté n'a changé ; un seul côté : sa fiche et son `.imu` sont recopiés à l'octet ; les deux : fusion à trois, écrite des deux côtés |
| oui | non | oui | supprimée sur le téléphone | l'ordinateur la met à la corbeille (origine : le téléphone) ; si elle a changé ici depuis la base : voir §3.3 |
| non | oui | oui | supprimée sur l'ordinateur | si le téléphone l'a changée depuis la base, sa fiche est d'abord fondue dans la copie de la corbeille ; puis retirée du téléphone (GPX, fiche, `.imu`) |
| non | non | oui | supprimée des deux côtés | la base l'oublie |

Après chaque identité traitée, sa ligne de base est réécrite avec les tampons relus sur les deux côtés (`stat` après écriture).

**Fusion à trois d'une fiche (proposé, `library/syncRecordMerge.ts`).** `edits = addRecordEdits(base, téléphone)` sans le chemin `summary` (les champs de manœuvres de `ANALYSIS_SUMMARY_FIELDS`, posés par l'analyse, restent) ; `mergeChangedRecord(ordinateur, téléphone, edits)` ; la fiche fondue est écrite sur l'ordinateur avec le résumé de l'ordinateur et sur le téléphone avec celui du téléphone. Les conflits passent par `conflictLabels` pour le compte rendu.

**Le résumé ne voyage pas pour une session déjà présente des deux côtés.** Il dépend des réglages de l'appareil (`optionsKey`) : sans cette règle, chaque appareil refait le résumé avec ses seuils, réécrit la fiche, et la synchronisation recopierait sans fin l'un sur l'autre. Une fiche dont seul le résumé a changé n'est donc pas « changée » ; sa nouvelle date entre dans la base, rien n'est recopié. Le résumé ne voyage qu'avec une session neuve, recopiée entière.

**Deux traces de même identité** (même instant de départ, GPX de tailles différentes : par exemple l'enregistrement du téléphone et le FIT de la montre converti sur l'ordinateur) : aucun GPX n'est remplacé ; seuls les champs saisis (`RECORD_EDIT_FIELDS`) se fondent ; dit une fois dans le compte rendu.

**Doublons d'un même dossier** (deux fichiers pour un instant) : `dedupeSessions` choisit celui qui compte ; les autres ne voyagent pas et sont signalés.

**Fiches et dossiers d'une version future.** Une fiche que `isWritableRecord` refuse n'est jamais réécrite ni fondue : recopiée à l'octet quand elle seule a changé ; changée des deux côtés, elle l'emporte entière et l'autre version va à la corbeille de l'ordinateur, ce qui est dit. Les champs inconnus et illisibles traversent intacts (`parseRecordWithRaw`, `serializeRecord`).

**Itinéraires.** Identité : base du nom de fichier et `createdAt`. Même base, `createdAt` différents : deux itinéraires, le second recopié sous une base libre (`routeFileBase`). Changé d'un seul côté : recopié (GPX puis fiche, la fiche faisant foi). Changé des deux côtés : pas de fusion champ par champ (des points de passage ne se fondent pas) ; le plus récent `updatedAt` l'emporte, l'autre va à la corbeille de l'ordinateur. Suppressions : comme les sessions, par la base (§3.5).

**Fichiers de réglages par appareil.** Recopiés comme des fichiers, jamais adoptés : l'adoption reste « Reprendre » et le bandeau existant. Normalement un seul côté change un fichier donné (son appareil) ; changé des deux côtés, le plus grand `savedAt` l'emporte. Même nom de fichier et `device.id` différents : jamais d'écrasement, conflit dit (l'application de chaque appareil sait déjà prendre un nom libre). Le fichier propre de l'ordinateur n'est jamais supprimé par la synchronisation.

**`fc-repos.json` et `lieux.json`.** Union par les fonctions existantes, écrite des deux côtés si elle diffère ; un fichier illisible ou d'une version future d'un côté n'est pas réécrit, et c'est dit. Ces fichiers n'ont pas de mémoire des retraits (limite déjà écrite dans le code) : la synchronisation ne la corrige pas.

**Hors synchronisation.** `gtracker.json` (chaque côté garde le sien ; l'ordinateur y ajoute seulement le champ `id` s'il manque, §5.1), `LISEZMOI.txt`, `journaux/`, et sur l'ordinateur `corbeille/` et `synchro/`.

### 2.4 Ordre des écritures, coupure et reprise (proposé)

**Une session recopiée** : `.imu`, puis fiche, puis **GPX en dernier**. Une coupure laisse une fiche ou des capteurs sans GPX, que l'application ignore (`planReconcile`, `orphanRecords`), jamais un GPX sans fiche, qui recevrait une fiche neuve au lancement et perdrait les saisies. C'est l'ordre déjà suivi par l'attente du téléphone.

**Un fichier sur le téléphone** suit le protocole de `MemoryFolderPlugin.java` : un fichier neuf s'écrit sous `nom.gtracker-new`, sa taille est vérifiée, puis il est renommé ; un fichier existant s'écrit sous `nom.gtracker-tmp`, sa taille est vérifiée, l'original est retiré, puis le temporaire est renommé. Par débogage USB, le renommage par `mv` remplace en un seul geste. Une coupure laisse donc soit l'original intact (temporaire effacé par le téléphone à son prochain listage), soit un `.gtracker-tmp` complet et seul, que le téléphone reprend sous son nom. Ne jamais employer `.tmp` sur le téléphone : un `.tmp` orphelin y est renommé tel quel.

**Une session retirée** : GPX d'abord, puis fiche et `.imu`, comme `removeSession`. Une coupure laisse des orphelins ; la reprise les retire, puisque la base en garde les noms.

**Mise à la corbeille sur l'ordinateur** : copie des trois fichiers dans la corbeille, entrée de son index écrite, puis retrait des originaux (GPX d'abord). Une coupure laisse au pire la session des deux côtés de la corbeille ; la reprise reconnaît l'entrée déjà faite (même identité, mêmes tailles) et ne la double pas.

**Reprise.** Le plan est recalculé à chaque fois depuis les deux dossiers et la base, et chaque opération est sans effet si elle est déjà faite : une session recopiée dont la base n'a pas été réécrite redevient une « première rencontre » aux fiches identiques, une suppression achevée redevient « supprimée des deux côtés ». Un fichier `synchro/en-cours.json`, posé au départ et retiré à la fin, sert seulement à dire « La dernière synchronisation a été interrompue : elle reprend. ». La base est réécrite après chaque identité (écriture sûre du disque de l'ordinateur), pour qu'une suppression faite au téléphone entre deux ne ramène pas une session qu'on vient de recopier.

**Verrou.** Pendant la synchronisation, l'ordinateur suspend ses propres écritures dans la mémoire (saisies en cours écrites d'abord par `flushWrites`, imports et recalculs grisés, comme pendant un import), puis relit la mémoire à la fin (`refreshLibrary`, « Mettre à jour »).

### 2.5 Compte rendu (proposé)

Une carte en fin de synchronisation, en phrases courtes, sans jargon, chaque ligne absente si son nombre est nul :
- « 3 sessions copiées vers le téléphone, 5 vers l'ordinateur. »
- « 2 fiches mises à jour (nom, notes). » ; « 1 session modifiée des deux côtés : notes gardées du téléphone (plus récentes). »
- « 1 session supprimée sur le téléphone : mise à la corbeille de l'ordinateur (30 jours). » ; « 2 sessions supprimées ici : retirées du téléphone. »
- « 1 session laissée pour la prochaine fois : sa fiche manque sur le téléphone (ouvrez Gtracker sur le téléphone, puis synchronisez de nouveau). »
- « Rouvrez Gtracker sur le téléphone, ou touchez « Mettre à jour », pour y voir les changements. »
- Les erreurs par fichier, comme `ImportOutcome.failedFiles`, sans arrêter les autres.

Le détail (liste des sessions par nom calculé, `library/sessionName.ts`) se déplie.

## 3. Les suppressions

### 3.1 Deux façons de les connaître

| | A. Le téléphone note ses suppressions | B. L'ordinateur les déduit de la base |
|---|---|---|
| Principe | `removeSession` du téléphone écrit une note (identité, date) dans un journal du dossier ; l'ordinateur la lit et l'applique | l'ordinateur compare chaque dossier à l'état laissé par la dernière synchronisation |
| APK | oui, et tant que le téléphone a une ancienne version, aucune suppression n'est notée | non |
| Suppression à la main (gestionnaire de fichiers, le `LISEZMOI.txt` l'autorise) | non vue : la session reviendrait | vue |
| « Tout supprimer » | efface le journal avec le reste (`isAppMemoryFile`) ou doit être exclu exprès | repéré par le marqueur (§5.1) |
| Session réimportée exprès | la note doit être levée à la main ou par l'import, sinon la session est supprimée de nouveau | rien à faire : la base l'avait oubliée, la session est neuve |
| Durée de vie des notes | à décider (combien de jours, que faire d'un appareil absent plus longtemps) | aucune : la base vit jusqu'à la synchronisation suivante, quel que soit le délai |
| Dossier vide ou mal désigné | sans danger (aucune note) | danger : tout semble supprimé. Fermé par l'identifiant du dossier, le garde-fou de masse et la corbeille (§5) |
| Fusion des fiches changées des deux côtés | demande quand même une base | la base sert aux deux |

**Recommandé : B.** La base est nécessaire de toute façon pour fondre les fiches ; elle voit aussi les suppressions faites à la main ; elle ne demande aucune APK ni aucune mémoire de notes à purger ; une session réimportée exprès revient sans rien faire. Son seul vrai risque, prendre une absence accidentelle pour une suppression, est fermé au §5, et la corbeille de l'ordinateur rattrape ce qui passerait. A peut s'ajouter plus tard comme confirmation, sans changer le reste.

### 3.2 La base (proposé)

Rangée dans le dossier mémoire de l'ordinateur, sous `synchro/` (portable avec lui, et effacée par « Tout supprimer » de l'ordinateur, ce qui en fait une paire neuve) :
- `synchro/<id du téléphone>.json` : le dossier du téléphone (identifiant, chemin, numéro de série du canal), la date de la dernière synchronisation réussie, et une ligne par identité : `startMs`, nom des fichiers de chaque côté, taille et date de chaque fichier de chaque côté, empreinte du texte de la fiche ; une ligne par itinéraire, par fichier de réglages, et pour `fc-repos.json` et `lieux.json`.
- `synchro/<id du téléphone>/fiches/<startMs>.json` : le texte de la fiche à la dernière synchronisation, ancêtre de la fusion à trois (quelques Ko chacune : environ 1,5 Mo pour 300 sessions).

Une base par paire : un second téléphone a la sienne, et une suppression faite sur l'un passe à l'autre par l'ordinateur.

### 3.3 Supprimée d'un côté, modifiée de l'autre

« Modifiée » veut dire une fiche dont les champs saisis ont changé depuis la base, ou un `.imu` ajouté ; le GPX ne change jamais.

Proposé, conforme à la décision du 18/11 : **la suppression l'emporte, sans rien perdre**. Supprimée au téléphone et modifiée sur l'ordinateur : la version de l'ordinateur va à la corbeille. Supprimée sur l'ordinateur et modifiée au téléphone : la fiche du téléphone est fondue dans la copie de la corbeille avant le retrait. Dans les deux cas une ligne du compte rendu le dit, et « Restaurer » ramène la version la plus complète partout. L'autre choix (la modification l'emporte, la session revient) est une question pour l'utilisateur (§8, Q1).

### 3.4 Session réimportée exprès après suppression

Avec la base, rien de spécial : la synchronisation qui a appliqué la suppression a retiré la session de la base ; réimportée d'un côté, elle y est neuve et passe de l'autre. Si elle est encore dans la corbeille de l'ordinateur, son entrée est retirée de la corbeille quand la session revient dans la mémoire de l'ordinateur (import ou synchronisation), pour ne pas la montrer deux fois.

### 3.5 Itinéraires

Même règle par la base : un itinéraire disparu d'un côté, inchangé de l'autre, est retiré de l'autre (fiche d'abord, puis GPX, comme `removeRoute`) et passe par la corbeille de l'ordinateur ; modifié de l'autre côté : même règle qu'au §3.3.

## 4. La corbeille de l'ordinateur (proposé)

**Où.** Dans le dossier mémoire de l'ordinateur, sous `corbeille/` : elle suit le dossier quand on le copie ou réinstalle le programme, et reste à côté de ce qu'elle protège. Ni l'application du téléphone ni l'import ne la lisent (le balayage ne lit que `sessions/` et la racine ; `folderImportPaths` aussi) ; la synchronisation ne la recopie jamais. « Tout supprimer » sur l'ordinateur la vide : `corbeille/` et `synchro/` s'ajoutent aux dossiers de `memoryResetTargets` (code commun, sans effet sur le téléphone qui n'en a pas).

**Forme.** Une entrée par suppression, dans son propre sous-dossier (`corbeille/<instant de suppression>-<startMs>/`), qui garde les noms d'origine (`sessions/…gpx`, `.json`, `.imu`, ou `itineraires/…`), et un index `corbeille/corbeille.json` : identité, nom montré, date de suppression (horloge de l'ordinateur), origine (« sur cet ordinateur », « sur le téléphone » avec son nom), raison (« supprimée », « version écartée à la synchronisation »).

**Ce qui y entre.** Une session ou un itinéraire supprimé sur l'ordinateur (`removeSession` et `removeRoute` y rangent au lieu d'effacer, sur l'ordinateur seulement) ; une session ou un itinéraire retiré par la synchronisation parce qu'il a été supprimé sur le téléphone ; la version écartée d'une fiche d'une version future ou d'un itinéraire changé des deux côtés. Pas ce qu'efface « Tout supprimer ».

**Purge.** Au lancement et à la fin de chaque synchronisation, les entrées de plus de 30 jours sont effacées : fichiers d'abord, entrée de l'index ensuite ; un sous-dossier absent de l'index est effacé à la purge suivante. Une date de suppression dans le futur (horloge reculée) n'est pas purgée. Le compte part du jour où la session entre dans la corbeille de l'ordinateur, pas du jour où elle a été supprimée au téléphone (date que l'ordinateur ne connaît pas).

**Restauration.** Les fichiers reviennent dans `sessions/` (`.imu`, fiche, GPX en dernier, sous un nom libre), puis l'entrée quitte l'index. Si la session est déjà revenue entre-temps, la copie de la corbeille ne fait que compléter sa fiche (`completeRecord`, rien d'écrasé). Effet sur le téléphone : la base ne la connaît plus, elle y est donc recopiée à la synchronisation suivante ; restaurée avant toute synchronisation, elle n'a jamais quitté le téléphone et rien ne bouge.

**Ce que voit l'utilisateur** (ordinateur seulement). Dans Réglages › Mémoire, une ligne « Corbeille : 4 sessions, gardées 30 jours » quand elle n'est pas vide ; dépliée, la liste (nom, date de la session, supprimée le…, sur quel appareil), et pour chacune « Restaurer » et « Supprimer définitivement » ; « Vider la corbeille » avec confirmation. La confirmation de suppression d'une session sur l'ordinateur dit « mise à la corbeille pour 30 jours ». Les sessions de la corbeille ne comptent ni dans la liste, ni dans les statistiques, ni dans le Profil.

**Fusion et déduplication.** La corbeille est hors de la mémoire : elle ne participe ni à `dedupeSessions`, ni à `findSessionAt`. Une session dont l'identité est dans la corbeille et qui arrive par un import ou par le téléphone est rangée comme neuve ; son entrée de corbeille est retirée (§3.4).

## 5. Les dangers à fermer

### 5.1 « Tout supprimer » ou « Réglages d'usine » sur un appareil, puis une synchronisation

Lu : « Tout supprimer » efface les sessions, les itinéraires, `fc-repos.json`, `lieux.json`, tous les fichiers de réglages et le marqueur **en dernier** ; il efface aussi l'identifiant de l'appareil ; au rechargement, `ensureLayout` réécrit un marqueur sans autre champ que `format` et `version`.

Proposé : à la première synchronisation d'une paire, l'ordinateur écrit dans le marqueur de chaque dossier un champ `id` tiré au hasard, s'il n'y en a pas (aucune APK : le téléphone ne lit que `format` et `version` et ne réécrit le marqueur que s'il manque). Un dossier remis à zéro revient avec un marqueur sans `id` : c'est un dossier neuf, rien ne s'en déduit comme supprimé. Quand le canal reconnaît le même téléphone (numéro de série) avec un dossier neuf alors qu'une base existait, l'ordinateur demande quoi faire (§8, Q2) au lieu de choisir seul. Symétrique : « Tout supprimer » sur l'ordinateur efface `synchro/` et son marqueur ; la paire est neuve, rien n'est retiré du téléphone.

Reste un trou : « Tout supprimer » **interrompu** au téléphone garde le marqueur avec son `id` et une partie des sessions. Fermé par le garde-fou de masse (§5.2) et la corbeille. Une petite APK peut le fermer tout à fait : « Tout supprimer » retire d'abord le champ `id` du marqueur (lot S6, facultatif).

« Réglages d'usine » ne touche que le fichier de réglages de l'appareil : sa disparition puis sa réapparition se recopient comme celles de tout fichier de réglages, sans danger pour les sessions.

### 5.2 Dossier du téléphone vide ou mal désigné

- Pas de marqueur : refus de synchroniser (« Ce dossier n'est pas un dossier Gtracker »).
- Marqueur sans `id`, ou `id` inconnu : première rencontre, réunion sans aucune suppression.
- Même `id` que le dossier de l'ordinateur (un dossier recopié tel quel, ce que le `LISEZMOI.txt` conseille pour changer d'appareil) : le dossier distant reçoit un nouvel `id`, et c'est une première rencontre.
- Chemin différent de celui retenu pour la paire (par exemple une vieille copie du dossier ailleurs sur le téléphone) : traité comme un dossier neuf, après l'avoir dit.
- **Garde-fou de masse** : si une synchronisation doit retirer plus de 10 sessions, ou plus du quart des sessions d'un côté, elle s'arrête avant toute suppression et montre la liste ; l'utilisateur confirme ou annule (§8, Q3). Les copies et les fusions ne sont pas bloquées.
- Toute suppression déduite d'un listage est revérifiée par `stat` sur le chemin exact (listage en retard du canal « Transfert de fichiers »).
- `sessions/` illisible d'un côté : rien n'est déduit, la synchronisation s'arrête avec un message.

### 5.3 Deux versions différentes de l'application

- Marqueur d'une version plus récente que `MEMORY_VERSION` sur l'un des deux dossiers : la synchronisation est refusée (l'ordinateur ne réécrit pas un dossier qu'il ne comprend pas) ; « Récupérer » aussi si c'est le téléphone. Message : mettre à jour Gtracker sur l'appareil en retard.
- Fiche d'une version future : jamais réécrite ni fondue (§2.3).
- Un programme d'ordinateur plus récent que l'APK écrira des fiches que le téléphone ouvre en lecture seule ; le compte rendu le dit quand il recopie une fiche de version supérieure à celle des fiches écrites par le téléphone.
- Résumés calculés par deux versions du calcul (`SUMMARY_CALC_VERSION`) ou deux jeux de réglages : sans effet, le résumé ne voyage pas (§2.3).

### 5.4 Enregistrement en cours ou session en attente sur le téléphone

- L'enregistrement en cours et les sessions en attente vivent dans le dossier privé de l'application (`en-attente/`, journal) : le câble ne les voit pas, et la synchronisation ne peut ni les perdre ni les copier. Elles entrent dans le dossier mémoire à l'arrêt ou au rangement, et passent à la synchronisation suivante.
- Une session en train d'être rangée au moment du listage (GPX sans fiche, ou GPX non fini) n'est pas recopiée cette fois (§2.3).
- Aucune déduction ne porte sur un fichier apparu après le listage : seul ce qui était dans la base peut être supprimé.
- L'application du téléphone ouverte pendant la synchronisation garde sa liste en mémoire ; une saisie faite sur une session que l'ordinateur vient de retirer laisse une fiche orpheline, ignorée. Le compte rendu demande de rouvrir l'application ou de toucher « Mettre à jour ».

### 5.5 Horloges différentes

L'identité est l'instant GPS du premier point ; les tampons (taille, date) ne sont jamais comparés d'un appareil à l'autre, seulement à ceux du même appareil gardés dans la base ; une date nulle ne prouve rien (`sameStamp`). Seuls servent encore l'horloge : le `savedAt` des blocs `notes` et `analysis` quand le même champ a changé des deux côtés, celui des lieux appris et des fichiers de réglages, et la durée de la corbeille (horloge de l'ordinateur seule). Un décalage de quelques minutes ne change que le côté retenu dans un conflit, et le conflit est dit.

### 5.6 Fichiers temporaires

Jamais recopiés, jamais pris pour une session : `.tmp`, `.gtracker-tmp`, `.gtracker-new`, et ceux de la synchronisation. Lecture du téléphone selon ses propres règles (§2.1). Un `.gtracker-tmp` seul sur le téléphone est une session présente (le téléphone le reprendra). L'ordinateur n'écrit jamais `.tmp` sur le téléphone.

### 5.7 Un troisième appareil

- Un second téléphone : une base par paire, la propagation passe par l'ordinateur.
- Un second ordinateur synchronisé avec le même téléphone : de même, chaque ordinateur ayant sa base avec ce téléphone.
- Un outil de synchronisation tiers sur le même dossier (Syncthing, Drive) en même temps que celle-ci : non pris en charge ; les deux se contrediraient. À écrire dans l'aide.
- Fichiers de réglages d'un troisième appareil présents d'un côté : recopiés comme les autres, jamais adoptés.

## 6. La preuve

### 6.1 Tests sur des paires de dossiers fabriqués (proposé)

Un faux dossier plus fidèle (`src/test/syncFolder.fixture.ts`) : octets écrits, date qui avance à chaque écriture, protocole de temporaires du téléphone, coupure injectée après la n-ième opération, listage « en retard » qui omet des fichiers récents. Des fiches et des GPX synthétiques ; aucun GPX réel.

Cas à couvrir, chacun à 1 Hz et 5 Hz quand une trace intervient :
1. Réunion de deux dossiers sans base, sessions disjointes puis communes : rien de supprimé, tout présent des deux côtés, base posée.
2. Session neuve de chaque côté ; noms de fichiers différents pour la même identité (fuseaux) ; nom pris de l'autre côté (`-2`).
3. Fiche changée d'un seul côté : recopiée à l'octet, champs inconnus et illisibles intacts.
4. Fiche changée des deux côtés : champs différents fondus ; même champ, `savedAt` le plus récent dans les blocs datés, conflit dit ; lieu corrigé des deux côtés.
5. Résumé seul refait d'un côté (autres réglages) : rien n'est recopié, deux synchronisations de suite ne changent plus rien (pas de va-et-vient).
6. Supprimée d'un côté : retirée de l'autre, et à la corbeille de l'ordinateur ; supprimée d'un côté et modifiée de l'autre : rien de perdu.
7. Réimportée après suppression : revient des deux côtés.
8. Restaurée de la corbeille : revient sur le téléphone à la synchronisation suivante ; restaurée avant toute synchronisation : rien ne bouge.
9. Coupure après chaque opération possible d'une synchronisation complète : à chaque fois, l'application de chaque côté lit un dossier sans session perdue ni fiche neuve à la place d'une fiche saisie, et la synchronisation suivante finit dans l'état attendu.
10. « Tout supprimer » d'un côté, entier puis interrompu : aucune suppression déduite sans confirmation.
11. Dossier sans marqueur, marqueur de même `id` que l'ordinateur, marqueur d'une version future, fiche d'une version future, chemin changé.
12. Garde-fou de masse : 11 suppressions s'arrêtent, 10 passent ; listage en retard : `stat` empêche la suppression.
13. GPX sans fiche, GPX non fini : laissés pour la fois suivante.
14. Deux traces de même instant et de tailles différentes : aucun GPX remplacé.
15. Itinéraires : neuf, changé d'un côté, des deux côtés, même nom créé des deux côtés, supprimé.
16. Fichiers de réglages : jamais adoptés ; même nom et deux identifiants ; `fc-repos.json` et `lieux.json` fondus, illisible jamais réécrit.
17. Corbeille : purge à 30 jours et un jour de moins, horloge reculée, entrée sans fichiers, sous-dossier sans entrée.
18. Un second téléphone : une suppression faite sur le premier atteint le second.

Le banc (`outils/banc/`) prouve en plus que les pages de l'ordinateur sont inchangées quand rien n'est synchronisé, et rend la carte du compte rendu sur un dossier fabriqué.

### 6.2 Ce qui restera à essayer sur le vrai téléphone

Avant le premier essai réel, copier les deux dossiers mémoire à part : c'est la seule sauvegarde.
- Première synchronisation de la vraie mémoire par le câble : même nombre de sessions des deux côtés, aucune dans la corbeille.
- Une session supprimée au téléphone : dans la corbeille de l'ordinateur après synchronisation ; restaurée : de retour au téléphone.
- Câble débranché au milieu d'une synchronisation, application du téléphone rouverte avant de rebrancher : aucune session perdue, saisies intactes, la synchronisation suivante finit.

## 7. Les lots

Tous après le lot de la coquille (étude sœur : programme Windows et dossier du disque). Modèles d'après `docs/MODELES.md`.

| Lot | But, utile seul | Fichiers touchés (proposés) | Taille | Modèle | APK |
|---|---|---|---|---|---|
| S1 · Le téléphone par câble | L'ordinateur voit le dossier du téléphone branché (débogage USB) : le lister, lire et écrire selon le protocole du téléphone ; utile seul pour regarder le dossier et préparer S2 | `bureau/` (pont de la coquille vers l'outil du câble), `src/platform/phoneFolder.ts` (sorte neuve de `MemoryFolder`), `src/library/remoteTemps.ts` et son test, `src/architecture.test.ts` si la liste des modules de plateforme change | moyen | Opus high | non |
| S2 · « Récupérer » | Un bouton qui range sur l'ordinateur les sessions, réglages, FC repos, lieux et itinéraires du téléphone branché, sans rien écrire sur le téléphone | `src/hooks/sessionLibrary/importer.ts` (préfiltre par `startMs`), `src/hooks/sessionLibrary/recover.ts` (neuf), Réglages › Mémoire et le « … » des Sessions (ordinateur seulement), dictionnaires | moyen | Sonnet high | non |
| S3 · Corbeille de l'ordinateur | Une session ou un itinéraire supprimé sur l'ordinateur se restaure pendant 30 jours | `src/library/trash.ts` (index, purge, restauration, purs) et son test, `src/hooks/sessionLibrary/trash.ts`, `sessionRecords.ts` (`removeSession`), `src/hooks/routeFiles.ts` (`removeRoute`), `src/library/resetPlan.ts` (`corbeille/`, `synchro/`), Réglages › Mémoire, dictionnaires | moyen | Opus high | non |
| S4 · « Synchroniser » les sessions | Sessions dans les deux sens, base, fusion à trois, suppressions, garde-fous, reprise, compte rendu | `src/library/syncBase.ts`, `syncPlan.ts`, `syncRecordMerge.ts` (purs) et leurs tests, `src/hooks/sessionLibrary/sync.ts` (exécutant, verrou), `src/test/syncFolder.fixture.ts`, marqueur (`folderLayout.ts` : champ `id`), carte du compte rendu, dictionnaires | gros | Fable high (plan Opus high par `Plan`, relecture) | non |
| S5 · Le reste du dossier | Itinéraires, fichiers de réglages, `fc-repos.json`, `lieux.json` dans les deux sens, avec suppressions pour les deux premiers | `syncPlan.ts`, `sync.ts`, tests | moyen | Opus high | non |
| S6 · Fermeture côté téléphone (facultatif) | « Tout supprimer » retire d'abord l'`id` du marqueur : un effacement interrompu ne peut plus passer pour des suppressions | `src/library/resetPlan.ts`, `src/hooks/sessionLibrary/reset.ts` | petit | Sonnet medium | **oui** |

S1 à S5 ne demandent aucune APK : le câble écrit avec les suffixes que le téléphone connaît déjà, et l'`id` ajouté au marqueur est sans effet sur l'application du téléphone. S2 et S3 sont utiles seuls ; S4 suppose S1 et S3 ; S5 suppose S4.

Le canal sans fil viendra plus tard sur la même interface : seul un adaptateur s'ajoute (étude à part). Le canal « Transfert de fichiers », pour un acheteur sans débogage USB, aussi.

## 8. Questions pour l'utilisateur

Q1 · Une session supprimée d'un côté et modifiée de l'autre depuis la dernière synchronisation : disparaît-elle quand même ? **Par défaut : oui, la suppression l'emporte, et la version modifiée est gardée 30 jours dans la corbeille de l'ordinateur** (l'autre choix : la session revient des deux côtés).

Q2 · Un appareil vidé par « Tout supprimer », puis synchronisé : faut-il le remplir depuis l'autre, ou vider l'autre aussi ? **Par défaut : demander à ce moment-là, le bouton principal étant « Le remplir depuis l'autre appareil » ; jamais vider l'autre sans confirmation.**

Q3 · Garde-fou : au-delà de combien de sessions supprimées d'un coup la synchronisation s'arrête-t-elle pour demander ? **Par défaut : plus de 10 sessions, ou plus du quart des sessions d'un appareil, avec leur liste.**

Q4 · Une corbeille aussi sur le téléphone ? **Par défaut : non ; celle de l'ordinateur garde tout ce que la synchronisation retire de l'un ou l'autre, et une suppression faite au téléphone sans synchronisation reste définitive, comme aujourd'hui.**

Q5 · La synchronisation se lance-t-elle d'elle-même quand le téléphone est branché ? **Par défaut : non, par un bouton ; le programme dit seulement qu'un téléphone est branché.**
