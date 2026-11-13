# 343 · Réglages : remise à zéro

Modèle | Réflexion : Opus | high

## Tel que noté

Demande du 11/11 au soir, après une réinstallation qui rendait l'ancienne liste d'activités : un bouton de remise à zéro dans Réglages, qui propose deux choix : tout supprimer, sessions comprises ; ou ne supprimer que les réglages et revenir partout aux réglages d'usine. Vu ce soir-là : désinstaller ne suffit pas, le dossier mémoire (`Documents/Gtracker` sur le téléphone) survit, et ses fichiers de réglages (`reglages/`) rendent les anciens réglages à la première ouverture.

## Décisions déjà prises

- Deux choix dans Réglages : « réglages d'usine » (les réglages seuls) et « tout supprimer ».
- Geste protégé comme « Jeter » : tenu une seconde (`HoldButton`), puis une confirmation.
- Réponses de l'utilisateur du 13/11 :
  - « Tout supprimer » efface aussi les fichiers de sessions du dossier mémoire, leurs fiches et les réglages qui s'y trouvent. C'est définitif : la confirmation dit le nombre de sessions effacées.
  - « Tout supprimer » efface tout, sans exception : sessions, itinéraires, profil (pseudo, année de naissance, photo), réglages et fonds de carte gardés pour le hors-ligne. L'application redevient celle d'une première installation.
- « Réglages d'usine » : tous les réglages reviennent à leur défaut (activités de départ et leurs pré-réglages, unités, onglets, tailles de panneaux, couleurs de trace, tutoriels lus…), sur l'appareil et dans le fichier de réglages de cet appareil du dossier mémoire ; les sessions, leurs fiches, les itinéraires et le profil ne sont pas touchés.

## Tranché par l'orchestrateur (13/11)

- « Réglages d'usine » ne retire du dossier mémoire que le fichier de réglages de cet appareil ; ceux des autres appareils restent (on peut encore les « Reprendre »). « Tout supprimer » retire tout ce que l'application a écrit dans le dossier mémoire, fichiers de réglages des autres appareils compris, mais jamais un fichier qu'elle n'a pas écrit ni rangé (un fichier étranger déposé là par l'utilisateur reste) ; le dossier lui-même reste désigné, vide.
- Sur ordinateur (navigateur), même chose : la mémoire interne ou le dossier désigné sont vidés de ce que l'application y a écrit.
- Pendant un enregistrement en cours, les deux boutons sont refusés avec une phrase qui dit pourquoi.
- Après l'un ou l'autre, l'application se recharge et s'ouvre comme à une première installation (pour « tout supprimer ») ou sur le Profil (pour « réglages d'usine »).
- Emplacement : en bas de la carte « Mémoire » de Réglages, dans une zone repliée « Remise à zéro », pour ne pas être sous le pouce.
- Tout passe par `src/platform/` (règle 12) : stockage, fichiers, dossier mémoire, cache des tuiles.

## Plan (agent Plan, 13/11) et questions tranchées

« U » = réglages d'usine, « T » = tout supprimer.

**Aujourd'hui.** Aucune fonction n'efface une clé : `StorageBackend` n'a pas de retrait (`src/platform/storage.ts`), ni sa version miroir. Les clés de l'appareil sont dans `STORAGE_KEYS` et les caches du navigateur dans `CACHE_NAMES` (`src/core/appIdentity.ts`) ; la disposition du dossier mémoire dans `src/library/folderLayout.ts`. `remove` du dossier mémoire refuse un dossier non vide dans le navigateur, mais **efface un dossier entier, contenu compris, sur le téléphone** (`MemoryFolderPlugin.java`, `deleteDocument`). Un appareil sans `settingsSavedAt` reprend tout seul le fichier de réglages le plus récent du dossier (`hooks/sessionLibrary/deviceSettings.ts`) ; le surveillant réécrit le fichier de l'appareil 2 s après un changement, et `flushWrites` part à `pagehide` (`hooks/sessionLibrary/lifecycle.ts`). À reprendre : « Jeter » (`components/SessionNameEditor.tsx` : tenu 1 s puis `window.confirm`), `HoldButton`, `isBusy` (`hooks/recorder/store.ts`), la fin de la carte Mémoire (`components/MemoryStatus.tsx`, après `SettingsFiles`).

**Ce que chaque bouton efface.**
- Clés effacées par U et T : `sportSettings`, `theme`, `sections`, `profil`, `tutoriels`, `statistiques`, `panelSizes`, `partage`, `fondCarte`, `planning`, `routeList`, `triBibliotheque`, `heartRateBelts`, `tileCache`, `tileUrls`, `seenSettingsFiles`.
- Clés effacées par T seulement : `athleteProfile`, `restingHr`, `followedTrace`, `libraryCache`, `summaryGestures`, `deviceId`, `deviceName`, `permissionsSeenVersion`, `settingsSavedAt`. U ne retire pas `settingsSavedAt` : il le pose à maintenant.
- Jamais effacé : `memoryFolder` et la poignée du dossier (IndexedDB) : le dossier reste désigné.
- T retire aussi toute clé restante qui commence par `gtracker.` (Preferences `keys()` et `localStorage`, par `platform/storage.ts`).
- Dossier mémoire, U : seulement `reglages/<appareil>.json` de cet appareil.
- Dossier mémoire, T, fichiers de l'application seulement : dans `sessions/` les `*.gpx`, `*.json`, `*.imu` ; dans `itineraires/` les `*.json`, `*.gpx` ; dans `reglages/` les `*.json` ; à la racine `gtracker.json`, `LISEZMOI.txt`, `fc-repos.json`, l'ancien `reglages.json` ; et leurs temporaires (`.tmp`, `.gtracker-new`, `.gtracker-tmp`). Jamais : une autre extension, un autre sous-dossier, un sous-dossier de `sessions/`.
- Fichiers privés de l'application, T : `en-attente/`, `recording-journal*.jsonl`, `capteurs/`, `tuiles/`, `vignettes.json`, `vignettes-images/`, la file des fichiers reçus (sinon un fichier reçu se rangerait au lancement suivant), `partage/` du cache.
- Navigateur, T : Cache API des tuiles et des vignettes ; et la mémoire interne du navigateur quand un dossier du PC est désigné, car elle en garde une copie.

**Fichiers.** À créer : `src/library/resetPlan.ts` et son test (pur : classement exhaustif des clés `Record<keyof typeof STORAGE_KEYS, 'reglage'|'donnee'|'dossier'>`, `isAppMemoryFile(dir, name)`, `memoryResetTargets(listings)`, `resetConfirmText(kind, {sessions, pending, routes})`, `resetRefusal({recorder, pending, memoryStatus, readOnly, designated})`) ; `src/platform/appReset.ts` (fichiers privés et caches, liste nommée, jamais tout le dossier privé) ; `src/hooks/sessionLibrary/reset.ts` (`factoryReset`, `eraseEverything`) ; `src/components/ResetZone.tsx` ; `outils/banc/remise-a-zero.mjs`. À modifier : `platform/storage.ts` (`removeStoredKeys(keys)` attendu et silencieux, `storedKeys()`, `suspendWrites()`), `platform/memoryFolder.ts` (écritures refusées une fois la remise lancée), `platform/previewStore.ts`, `previewImages.ts`, `tileCache.ts` (un `clear()` et le respect de la suspension), `lifecycle.ts` (`stopForReset()`, qui reprend `detach` et garde le dossier), `deviceSettings.ts` (vider le minuteur d'écriture), `MemoryStatus.tsx`, `outils/banc/scripts.mjs` et `SCRIPTS.md`.

**Étapes.**
1. `resetPlan.ts` et ses tests.
2. `storage.ts` : retrait et suspension, testés sur un faux backend et la version miroir.
3. `appReset.ts` et les `clear()` ; test des noms visés.
4. `reset.ts` : refus d'abord. U : `flushWrites`, `settingsSavedAt` = maintenant, retrait des clés de réglage, suspension, retrait du fichier de l'appareil (un échec n'y fait rien : il sera réécrit au lancement), rechargement. T : suspension et arrêt de la bibliothèque, puis le dossier (tous les GPX, puis fiches et `.imu`, itinéraires, `reglages/`, `fc-repos.json`, `LISEZMOI.txt`, le marqueur en dernier), puis fichiers privés et caches, puis les clés, puis rechargement sur `/`. Échec sur le dossier : arrêt, rien d'autre touché, suspension levée, liste relue, et un message qui dit où on en est (« Remise à zéro interrompue : 12 sessions effacées sur 40 ; réglages, profil et cartes intacts. Redonnez l'accès au dossier puis recommencez. »). Test du déroulé sur un dossier factice : un fichier étranger reste, un échec à mi-chemin s'arrête et le dit.
5. `ResetZone` : deux `HoldButton` tenus 1 s puis `window.confirm` ; grisés avec la phrase pendant un enregistrement ou une session arrêtée en attente (« Impossible pendant un enregistrement : arrêtez-le d'abord. ») ; aide « ? ». Confirmation de T : « Tout supprimer ? 42 sessions, leurs fiches, les itinéraires, le profil, les réglages et les cartes gardées seront effacés définitivement. »
6. Banc `remise-a-zero` (mémoire interne du navigateur ; fichiers étrangers posés par `evaluate`, comme `fc-repos.mjs`). Préparation : 2 GPX importés, une activité créée, une unité changée, un pseudo, `reglages/autre.json`, `a-moi.txt`, `sessions/notes.txt`, une entrée dans le cache des tuiles. U : activité et unité au défaut, 2 fiches, pseudo gardé, `autre.json` présent, fichier de l'appareil réécrit sans l'activité. T : plus de fiche, Profil sans pseudo, activités de départ, cache des tuiles absent ; restent les fichiers étrangers et ce que l'ouverture réécrit (marqueur, `LISEZMOI`, réglages de l'appareil).

**Tests.** Classement des clés égal à `Object.keys(STORAGE_KEYS)`, `memoryFolder` dans aucune liste d'effacement ; fichiers étrangers jamais visés (`a-moi.txt`, `sessions/notes.txt`, `sessions/sous/x.gpx`, `photos/x.jpg`, `reglages/lisez.txt`, un `x.gpx` à la racine) ; ordre (GPX avant fiche, marqueur en dernier) ; U ne vise que le fichier de l'appareil ; textes au singulier, au pluriel et à 0 ; refus selon l'état de l'enregistreur et de la mémoire.

**Pièges.**
- Ne jamais retirer `settingsSavedAt` avec U : l'appareil se croirait neuf et reprendrait le fichier d'un autre appareil (le défaut du 11/11 sous une autre forme).
- Ne jamais passer un dossier à `remove` sur le téléphone (effacement récursif).
- Ce qui tourne encore réécrirait après l'effacement (recalcul des résumés en fond, cache des fiches à 1 s, fichier de réglages à 2 s, vignettes à la mise en arrière-plan, `flushWrites` à `pagehide`) : d'où la suspension avant tout effacement.
- `Preferences.remove` est à attendre avant le rechargement.

**Tranché par l'orchestrateur (13/11), sur le plan.**
- Dossier désigné mais inaccessible (autorisation à redonner) ou mémoire en lecture seule (écrite par une version plus récente) : T refusé avec une phrase. Aucun dossier désigné : T permis.
- Les sous-dossiers vides (`sessions/`, `itineraires/`, `reglages/`) restent en place : plus sûr que de les retirer.
- U garde `summaryGestures` (les résumés suivent les seuils remis au défaut ; à vérifier au banc), `deviceId`, `deviceName`, `followedTrace`, `permissionsSeenVersion` ; U efface `heartRateBelts`.
- « Le profil n'est pas touché » par U couvre tout le bloc Pratiquant (pseudo, année de naissance, photo, poids, taille, FC max et de repos, objectif par semaine) et les tests de FC repos : U n'y touche pas. À dire à l'utilisateur.
- Un GPX déposé à la main dans `sessions/` est une session pour l'application : T l'efface, comme l'utilisateur l'a demandé pour les fichiers de sessions ; l'aide « ? » le dit (« toutes les sessions du dossier, y compris un GPX que vous y auriez déposé vous-même »). À dire à l'utilisateur.
- Noms des fichiers et des fonctions : ceux du plan.
- Arrivé depuis le plan, avec le lot 352 (nom de session par le lieu), à classer aussi : la clé de la case « Chercher le lieu des sessions » (`rechercheLieu` dans `STORAGE_KEYS`) est un réglage, effacé par U et T (elle revient cochée) ; les lieux appris (clé de l'appareil `lieuxAppris` de `STORAGE_KEYS`, et le fichier `lieux.json` à la racine du dossier mémoire, `LEARNED_PLACES_FILE` de `src/library/folderLayout.ts`, écrit par `src/hooks/learnedPlacesFile.ts`) sont une donnée saisie par l'utilisateur, comme le profil : U n'y touche pas, T les efface, `lieux.json` rejoignant la liste des fichiers de l'application à la racine. Le lieu d'une session vit dans sa fiche : il part avec elle. À dire à l'utilisateur.
- Le compte des fermetures du rappel du matériel (lot 345) vit dans les réglages des activités : il repart à zéro avec U comme avec T.

## Voulu

1. Les deux actions, en fonctions testées là où c'est pur (la liste de ce qui s'efface, le texte de la confirmation), et par les modules de `src/platform/` pour l'effacement lui-même.
2. La zone « Remise à zéro » de Réglages, avec une aide « ? » qui dit en clair ce que fait chaque bouton et que « tout supprimer » est définitif.
3. Tests, dont un qui garde que rien d'autre que les fichiers de l'application n'est visé dans le dossier mémoire.
4. Banc : un script neuf `remise-a-zero` (réglages d'usine : une activité créée et une unité changée reviennent au défaut, les sessions restent ; tout supprimer : plus de session, plus de profil, liste d'activités de départ, dossier mémoire simulé vidé de ses fichiers d'application et pas d'un fichier étranger), écrit et lancé par l'agent une fois le code fini.

## Ne pas faire

- Ne jamais effacer hors du dossier mémoire désigné ni hors du stockage de l'application.
- Ne pas toucher à `docs/` hors de ce brief, ni à `CLAUDE.md`, ni à `package.json`, ni commit ni version.

## Rapport attendu

Le rapport habituel, avec : la liste exacte de ce que chaque bouton efface (clés de l'appareil, fichiers et dossiers du dossier mémoire, caches), les textes des confirmations, le résultat du script du banc.
