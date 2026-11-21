# 481 · « Synchroniser » porte aussi les itinéraires : plan

Plan de l'agent Plan du 21/11, relu par l'orchestrateur. Suite du lot 449 (« 449-b » de son plan) : mêmes règles que les sessions.

## L'existant

- Les itinéraires vivent dans `itineraires/<base>.json` (la fiche, qui fait foi, avec `createdAt` et `updatedAt`) et `<base>.gpx` (l'export). Le nom de fichier est figé au premier rangement (`src/hooks/routeFiles.ts`). La corbeille d'itinéraires existe : `removeRoute` passe par `stashRoute`, puis efface la fiche et ensuite le GPX.
- La synchronisation ne porte aujourd'hui que `sessions/`, les fichiers de réglages, `fc-repos.json` et `lieux.json`.
- **Point bloquant** : le câble écrit déjà dans `itineraires/` (`cheminEcrivable`) mais ne le liste pas (`DOSSIERS_DU_CABLE`, `COMMANDE_LISTAGE_REPLI` de `bureau/telephone.ts` et `bureau/adb.ts` : `sessions/` et `reglages/` seulement). Le greffon du sans-fil ne liste que la racine et `sessions/`. Un listage vide serait lu comme « tout supprimé sur le téléphone » : il faut un drapeau de capacité, sans lequel les itinéraires ne sont pas touchés.

## À réutiliser

- Fiche : `parseRouteRecord`, `isWritableRouteRecord`, `routeFileBase`, `ROUTE_VERSION` (`src/planning/routeRecord.ts`) ; `ROUTES_DIR`, `routePath` (`src/library/folderLayout.ts`) ; `routeDisplayName` (`src/library/routeName.ts`).
- Corbeille : `reusableRouteEntry`, `routeRestorePlan` (`src/library/trash.ts`) ; `stashInTrash`, `stashFilesInTrash` (à étendre au genre `itineraire`), `readTrashIndex` (`src/library/trashFolder.ts`) ; `stashRoute`, `holdTrashDuring` (`src/hooks/sessionLibrary/trash.ts`).
- Synchronisation : `SyncStamp`, `withSyncDone`, `parseSyncBase`, `serializeSyncBase` (`syncBase.ts`) ; `SYNC_GUARD_MAX_REMOVALS`, `SYNC_GUARD_MAX_SHARE`, le modèle de `guardOf` (`syncPlan.ts`) ; `syncExtraFiles` comme modèle d'exécutant qui relit avant d'écrire (`sync.ts`) ; `SyncLinkError` ; `src/test/syncFolder.fixture.ts` ; `describeSync`, `describeSyncQuestion` (`syncReport.ts`) ; `phoneCanWrite` (`src/platform/phoneCable.ts`).

## Format de la base (`synchro/<id>.json`, `SYNC_BASE_VERSION` reste à 1)

- Trois champs facultatifs : `routes: [{ id, computer: { json, gpx, updatedAt }, phone: { … } }]` (`json` : `SyncStamp` ; `gpx` : `SyncStamp | null` ; `id` : le `createdAt`, ou `nom:<base en minuscules>` s'il manque ou vaut l'époque) ; `removedRoutes: string[]` ; `heldRoutes: string[]` (modèle de `removed` et `held`).
- La version actuelle lit ce fichier (champs inconnus ignorés) ; si elle le réécrit elle les perd, sans danger : la synchronisation suivante est une première rencontre pour les itinéraires, rien n'est supprimé. En plus : `parseSyncBase` garde les champs inconnus et les réécrit.
- Pas de fiche ancêtre : un itinéraire se recopie entier.

## Parties (un commit chacune, Opus high)

**A · Le pur, testé.**
- `syncBase.ts` : les champs, `withRouteLine`, `withoutRouteLine`, `withRouteHeld`, et `withSyncDone` qui réduit `removedRoutes` à ce que la corbeille tient encore.
- Neuf, `src/library/syncRoutes.ts` et son test : `syncRouteListing` (apparie fiche et GPX par base, écarte les temporaires) ; `routeRecordsToRead` (relit la fiche seulement si son tampon diffère de la base, ou si sa date vaut 0) ; `planRouteSync({ base, computer, phone, trash, heldOnPhone })` : opérations `copy` (vers un côté, GPX puis fiche, base libre de ce côté par `routeFileBase`, avec ce qu'elle remplace), `trash` (copie de l'ordinateur, origine `ordinateur`), `removeFromPhone` (copie du téléphone rangée d'abord, origine `telephone`, sauf si la corbeille tient déjà la même fiche, comparée au contenu) et `loserToTrash` ; raisons de laisser : `newer`, `unreadable`, `duplicate`, `inTrash` ; `routeGuardOf`, `restrictRouteSyncPlan`.
- Règles : sans ligne de base, aucune suppression ; modifié d'un seul côté, recopié à l'octet ; modifié des deux côtés, le plus grand `updatedAt` gagne et l'autre version va dans la corbeille de l'ordinateur (à égalité de date et contenu différent, l'ordinateur gagne) ; modifié d'un côté et supprimé de l'autre, la modification revient ; une fiche de version supérieure à `ROUTE_VERSION` n'est jamais écrasée.
- Tests : première rencontre (union), suppression de chaque côté, conflit, supprimé contre modifié, restauration depuis la corbeille (revient sur les deux), version future, fiche illisible, doublon, collision de base, garde-fou, téléphone en lecture seule.

**B · Exécutant, coquille, compte rendu.**
- Coquille : `itineraires` dans `DOSSIERS_DU_CABLE` (`bureau/telephone.ts`), `COMMANDE_LISTAGE_REPLI` complété et état prêt qui annonce `itineraires: true` (`bureau/adb.ts`), `bureau/fauxTelephone.ts`, tests.
- `src/platform/phoneCable.ts` : `phoneListsRoutes(state)` ; coquille ancienne ou sans-fil : faux.
- `src/library/trashFolder.ts` : `stashFilesInTrash` accepte `kind: 'itineraire'` (`routeBase`, `createdAt`).
- `sync.ts` : `syncRouteFiles`, après les sessions et avant les fichiers annexes, seulement si l'option `phoneRoutes` est vraie ; listage relu avant d'écrire ou d'effacer, `stat` avant chaque effacement, fiche puis GPX ; base réécrite après chaque itinéraire.
- `syncOutcome.ts` (`SyncRoutesOutcome`), `syncReport.ts` et son test, `phoneSync.ts` (passe `phoneRoutes`) ; `routeStore.reload()` appelé par `PhoneSyncButton` (pas dans `sessionLibrary/`, pour éviter une boucle d'imports) ; vérifier que le téléphone relit ses itinéraires à « Mettre à jour » et au rechargement automatique, sinon le brancher sur `refreshLibrary`.
- Dictionnaires, INVENTAIRE. Banc (Sonnet) : un cas d'itinéraires dans `exe-synchroniser.mjs`.

## Compte rendu

- « 2 itinéraires copiés vers le téléphone, 1 vers l'ordinateur. »
- « 1 itinéraire modifié recopié. »
- « 1 itinéraire supprimé sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours). »
- « 1 itinéraire supprimé sur l'ordinateur : retiré du téléphone. »
- « 1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours). »
- « 1 itinéraire laissé tel quel : illisible, ou d'une version plus récente de Gtracker. »
- « Les itinéraires attendent le câble ou la mise à jour du téléphone. »

## Tranché par l'orchestrateur

- Garde-fou : compte propre aux itinéraires, mêmes seuils, mais une seule fenêtre et une seule confirmation (« Cette synchronisation retirerait 14 sessions et 3 itinéraires. Rien n'est encore supprimé. ») ; une confirmation ne vaut que pour ce qu'elle a montré, comme pour les sessions.
- Identité par `createdAt` ; par le sans-fil les itinéraires sont sautés, avec leur ligne, jusqu'à l'élément 482.
- Itinéraire de la corbeille de l'ordinateur encore sur le téléphone, sans ligne de base : joint à la question des sessions (« Retirer du téléphone », « Les laisser »).

Essai au téléphone, un seul : un itinéraire créé sur le téléphone puis modifié sur le PC ; après « Synchroniser », le téléphone montre la nouvelle version.
