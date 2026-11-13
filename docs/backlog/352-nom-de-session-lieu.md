# 352 · Nom de base d'une session : l'activité et le lieu

Modèle | Réflexion : Opus | high

## Rangé dans Gtracker le 12/11

Copie du brief écrit par l'utilisateur depuis son autre projet (`D:\gong tracker\atelier\brief-nom-de-session-lieu.md`), gardé mot pour mot ci-dessous. Ce qui a changé ici depuis qu'il a été écrit, à lire avant de coder :

- Le paquet de la nouvelle apparence est en cours : la liste des sessions quitte `src/pages/SessionLibrary.tsx` pour `src/pages/SessionsPage.tsx` et `src/components/SessionRow.tsx` (élément 346), où la ligne d'une session montre déjà son nom en gras. Ce lot se mène après ce paquet.
- DECISIONS §8 dit d'une session importée : « ce que le fichier ne porte pas reste nul, rien n'est inventé ni emprunté à une autre session ». Le lieu cherché à l'import et les lieux appris sont une exception voulue par l'utilisateur (ses choix 2 et 3 du 12/11) : la phrase du §8 est à compléter dans le lot.
- DECISIONS §7 : la recherche de lieu (Photon) est gardée tant qu'elle ne gêne pas la vente, ses conditions d'usage étant à vérifier à la livraison. Ce lot ajoute un second emploi du même service : la vérification du point 1 des « Points propres à la version vendue » se fait dans le plan du lot, pas à la livraison.
- DECISIONS §8, GPX téléchargé : une session nommée part déjà sous `AAAA-MM-JJ Activité - Nom.gpx` ; le point 7 du « Voulu » le prolonge aux sessions non renommées.

## Réponses de l'utilisateur du 12/11 au soir (aux « Points propres à la version vendue » du brief)

- Confidentialité (point 2) : la recherche du lieu est active d'office ; une phrase le dit dans Réglages, avec un interrupteur pour s'en passer (le nom est alors l'activité seule, les lieux appris restant possibles).
- Sessions déjà rangées (point 3) : leur lieu se cherche au fil de l'eau, à l'ouverture d'une analyse et pour les lignes visibles de la liste, jamais toute la mémoire d'un coup.
- Service de cartes (point 1) : pas une décision de l'utilisateur ; ses conditions d'usage se vérifient dans le plan du lot, et le résultat lui est dit avant de coder s'il gêne la vente.
- Rang : à coder juste après le paquet de la nouvelle apparence (après l'avatar, élément 350), sur l'APK suivante.

## Service de lieux, vérifié en ligne le 13/11 (point 1 des « Points propres à la version vendue »)

- Serveur public de Photon (page d'accueil, « Terms of Use ») : « You can use the API for your project, but please be fair - extensive usage will be throttled. We do not guarantee for the availability and usage might be subject of change in the future. » ; le README ajoute qu'un usage excessif peut être coupé (« throttled or completely banned ») et conseille un serveur à soi pour un grand volume. Rien sur l'usage commercial, ni chiffre de cadence, ni identification demandée.
- Lecture de l'orchestrateur : une recherche par session, gardée dans la fiche, sans rafale ni rattrapage de masse, est un usage loyal ; rien n'empêche de coder. Ce qui reste pour la vente est l'absence de garantie de disponibilité : à redire à la livraison (élément 308), avec le choix d'un service garanti ou d'un Photon hébergé si l'acheteur le veut. Dit à l'utilisateur le 13/11.
- Recherche inverse (`docs/api-v1.md` du projet) : `/reverse?lon=…&lat=…`, `radius` en kilomètres, `limit`, `lang` (une seule langue), `osm_tag` répétable (`key:value`, `key`, `!key`…) mais marqué « Deprecated » au profit de filtres `include`/`exclude` par catégorie, et qui ne porte que sur les étiquettes principales (« not all OSM tag/value combinations can be searched »). Donc : demander plusieurs résultats sans filtre côté serveur et choisir côté application d'après `osm_key`, `osm_value` et la distance. Propriétés rendues : `name`, `osm_key`, `osm_value`, `osm_type`, `osm_id`, `city`, `state`, `country`, `street`, `postcode`, `extent`.
- Attribution : la mention des données OpenStreetMap et de leur licence ODbL est due dans « À propos », avec un lien vers la page du droit d'auteur d'OpenStreetMap.
- Nominatim, écarté : sa politique décourage les requêtes lancées par une application sans geste de l'utilisateur (« periodic requests from apps are considered bulk geocoding »).

## Questions tranchées par l'orchestrateur (13/11), d'après le plan

- Deux parties, deux commits : A, le nom calculé et le lieu trouvé (points 1 à 3 et 7 du « Voulu », la partie « plan d'eau sinon commune » du point 4, l'interrupteur de Réglages) ; B, à la suite, la correction du lieu, les lieux appris et « Départ → Arrivée » (reste du point 4, points 5 et 6).
- Ce qui part en ligne : le point de départ arrondi à trois décimales (environ 100 m), la langue, le nombre de résultats et le rayon ; rien d'autre, aucune donnée personnelle. La phrase de Réglages dit que le lieu est cherché en ligne d'après le point de départ.
- Le champ `place` est en haut de la fiche, pas dans `summary` (il ne se recalcule pas depuis le GPX ; `SUMMARY_CALC_VERSION` inchangé). `place` absent : pas encore cherché ; `place.name` nul : cherché, rien trouvé (pas de recherche en boucle).
- `PLACE_RULES` (rayon de recherche, rayon d'un lieu appris de 500 m, distance d'une arrivée « ailleurs ») : un objet passé en paramètre, sans réglage persisté.
- `fetchJson` reste dans `planning/` (la règle 12 ne vise pas le réseau).
- L'interrupteur va dans Réglages › Mémoire, avec sa phrase ; clé de l'appareil.
- Partie B : les lieux appris vivent sur l'appareil et dans un fichier `lieux.json` du dossier mémoire, fondus entre appareils comme le fichier de la FC de repos ; ils ne s'appliquent qu'aux sessions qui n'ont pas encore de lieu, interrupteur coupé compris. « Départ → Arrivée » : une seconde recherche seulement quand l'arrivée est loin du départ.
- Le lieu trouvé n'entre pas dans le brouillon d'une analyse : il s'écrit tout de suite dans la fiche, sans déclencher l'avertissement en quittant.
- Un import d'un dossier entier ne met rien en file d'office : ses sessions prennent leur lieu au fil de l'eau.

## Plan (agent Plan, 13/11), à suivre sauf constat contraire dans le code

Aujourd'hui :
- Le nom est `record.name` (`src/library/record.ts`), modifié par `applyRecordPatch`, dans `RECORD_LIGHT_FIELDS`. La position de départ n'est ni dans la fiche ni dans `summary`.
- Le nom est recomposé à six endroits : `components/SessionRow.tsx` (à défaut, l'activité), `components/SessionNameEditor.tsx` (« Sans nom », téléchargement, partage), `shareStats.ts` (`shareLabels`), `library/stats.ts` avec `pages/StatisticsPage.tsx`, `naming.ts` (`downloadBaseName`). `ProfileActivities` passe par `SessionRow`. L'écran de fin (`RecordingPage.tsx`) ne montre que l'activité.
- Service de lieux : Photon, `src/planning/geocoding.ts`, recherche par texte seulement, `fetchJson` de `planning/fetchJson.ts`, délai de 20 s ; `parsePhoton` jette `osm_key` et `osm_value`.

Structure :
- Créer `src/library/sessionName.ts` (+ test) : `sessionDisplayName(record, activityName)` et `placeLabel(place)`, seule source du nom. `src/library/places.ts` (+ test) : `SessionPlace`, `readSessionPlace`, `choosePlace(features, start, rules)`, `nearestLearnedPlace(point, learned, rules)` sur `haversineDistance`, `PLACE_RULES`, `firstTrackPoint(gpxText)` (premier `trkpt` sans tout lire). `src/hooks/sessionLibrary/placeQueue.ts` (+ test), nouvelle couche à déclarer dans `couches.test.ts`. Partie B seulement : `src/hooks/learnedPlacesFile.ts`, sur le modèle de `restingHrFile.ts`.
- Modifier `record.ts` (champ `place`, `RecordPatch.place`, `RECORD_LIGHT_FIELDS`) ; `geocoding.ts` (`photonReverseUrl`, `reversePlaces`, `parsePhoton` garde `osm_key`, `osm_value`, `city`) ; `naming.ts`, `shareStats.ts`, `stats.ts`, `StatisticsPage.tsx`, `SessionRow.tsx`, `SessionNameEditor.tsx` ; `importer.ts` (`saveRecordedSession` et l'import : mise en file) ; `appIdentity.ts` (clé de l'interrupteur ; en partie B la clé des lieux et `lieux.json` dans `folderLayout.ts`) ; `SettingsPage.tsx` (phrase et interrupteur) ; `AboutSettings.tsx` (ce qui part en ligne, mention d'OpenStreetMap).

Étapes, partie A, chacune suivie de `node outils/verif.mjs --rapide` :
1. Fonction pure du nom et champ `place` de la fiche (`{ name: string | null, source: 'carte' | 'appris' | 'utilisateur', lat, lon (arrondis) }`), avec leurs tests. Un changement d'activité ne touche pas `place`. Un nom vide rend le nom calculé.
2. `sessionDisplayName` branchée aux six endroits ; « Sans nom » disparaît ; `shareLabels` et `downloadBaseName` reçoivent le nom composé ; le GPX téléchargé d'une session non renommée part sous `AAAA-MM-JJ Activité - Lieu.gpx`, le nom écrit dans le GPX ne change pas (`retouchGpx` inchangé) ; le titre de l'enregistreur et le nom du fichier rangé ne bougent pas.
3. Recherche inverse pure : une adresse au point arrondi à trois décimales, `lang=fr`, `limit`, `radius`, sans filtre côté serveur ; choix parmi plage, port, marina, étang et baie, le plus proche dans le rayon ; sinon la commune ; sinon nul. Un nom vide ou réduit à des chiffres est écarté.
4. File d'attente : une requête à la fois, au plus une par seconde, au plus vingt sessions en attente (l'appel le plus récent passe devant), sans doublon ; un échec de réseau suspend la file jusqu'au prochain appel, sans rien écrire ; interrupteur coupé : rien en file, rien d'envoyé ; résultat écrit par `updateSessionRecord`, une fiche en lecture seule sautée. Appels : fin d'enregistrement et import d'un ou de quelques fichiers ; ouverture d'une analyse, en tête de file ; une ligne de la liste visible (`useNearViewport`, déjà employé par la vignette), qui ne fait que mettre en file. Le point de départ vient de `readSessionGpx` puis `firstTrackPoint`, ou de la trace déjà lue par l'analyse.
5. Réglages : la phrase et l'interrupteur, actif d'office ; « À propos ».

Partie B : 6. Le « … » qui porte Renommer, dans la liste comme dans l'analyse, reçoit « Lieu », qui corrige le lieu seul ; un lieu corrigé passe en `source: 'utilisateur'` et est appris. 7. Lieux appris sur l'appareil et dans `lieux.json`, fondus entre appareils ; une session neuve partie à moins de 500 m d'un lieu appris le prend (`'appris'`) sans interroger le service. 8. « Départ → Arrivée ».

Tests : `sessionName.test` (nom saisi qui prime, nom effacé, changement d'activité, sans lieu, lieu corrigé contre lieu de la carte) ; `places.test` (réponses Photon enregistrées : plage à 300 m, commune seule, réponse vide, nom absurde ; 499 et 501 m) ; `geocoding.test` (arrondi et paramètres) ; `record.test` (lecture, champ inconnu conservé, patch) ; `placeQueue.test` avec un faux `fetch` et de faux minuteurs (une requête à la fois, plafond de vingt, aucune requête interrupteur coupé, arrêt hors ligne puis reprise, pas de rafale quand cent lignes défilent) ; tests de `naming` et `shareStats` mis à jour.

Banc : ajouter `*://photon.komoot.io/*` à `BLOCKED_URLS` (`outils/banc/lib/cdp.mjs`), sans quoi tous les scripts interrogeraient le vrai service ; `outils/banc/lib/lieux.mjs` sur le modèle de `lib/tuiles.mjs` (interception, réponse enregistrée, compte des requêtes) ; script neuf `outils/banc/lieu.mjs` : import sans réseau (activité seule), réponse simulée (le nom se complète, une seule requête), renommer, effacer le nom, changer d'activité, couper l'interrupteur (zéro requête), et en partie B corriger le lieu puis une seconde session au même départ (zéro requête) ; `rename.mjs` adapté.

Pièges : ne pas confondre « pas encore cherché » et « rien trouvé » ; le départ est parfois le domicile, l'arrondi protège peu, la phrase de Réglages le dit ; une écriture de fond pendant qu'une analyse a un brouillon ouvert ne déclenche pas l'avertissement en quittant (`useSessionDraft`, `noteRecordEdits`) ; `SUMMARY_CALC_VERSION` inchangé.

## Brief d'origine : nom de base d'une session, l'activité et le lieu

Écrit le 12/11/2026 depuis le projet Tracker, où la même fonction porte le n° 215 (`C:\Users\segne\tracker\docs\backlog\215-nom-de-session-lieu.md`, prête, pas encore codée). Ce fichier est posé hors du dépôt Gtracker, qui avait ce soir-là un lot en cours : à ranger dans son reste à faire par `/todo` (numéro pris dans « Prochains numéros »), puis à copier dans `docs/backlog/N-nom-de-session-lieu.md`.

La règle des deux projets vaut ici : la fonction se code à la main de chaque côté et se note dans les deux restes à faire. Rien n'existe encore côté Tracker : le premier des deux qui la code sert de modèle à l'autre (mêmes noms de fichiers et de fonctions autant que possible).

## Tel que noté par l'utilisateur (12/11)

« GENERAL : quand on fait un enregistrement il faut que le nom de base soit l'activitée ( mis a jour si modifier et que nom a jamais etait modifier) mais il faudrait aussi le lieux genre la ville la plus proche, le nom de la plage.... tu propose quoi pour le nommage ? »

## Ce que l'utilisateur a choisi (12/11, réponses données dans Tracker, valables pour les deux projets)

1. **Forme du nom** : « Activité · Lieu », avec un point médian. Exemples : « Wing · Carnon-Plage », « Surf · Plage des Cavaliers ». La date reste écrite à côté, comme aujourd'hui. Sans lieu connu : l'activité seule.
2. **Lieu en voile et en surf** : la plage, le port, l'étang ou la baie nommés les plus proches du point de mise à l'eau ; la commune seulement si rien de nommé n'est trouvé à proximité.
3. **Lieux appris** : quand l'utilisateur corrige le lieu d'une session, les sessions suivantes parties du même endroit (à moins de 500 m) prennent ce nom toutes seules.
4. **Priorité** : à faire à la prochaine session de travail.

## Aujourd'hui dans Gtracker (relevé en lecture seule le 12/11, à revérifier avant de coder)

- Une session n'a pas de nom tant que l'utilisateur ne l'a pas saisi : `record.name` est vide, l'en-tête de l'analyse écrit « Sans nom » (`src/components/SessionNameEditor.tsx`, vers la ligne 139), la ligne de la liste des sessions ne montre que l'activité et la date (`src/pages/SessionLibrary.tsx`, vers 401).
- L'enregistreur écrit dans le GPX un titre figé « Activité, 23/09/2026 14:05 » (`src/recording/session.ts`, `sessionTitle`, vers 250) : il ne suit pas un changement d'activité et n'est pas montré comme nom.
- Aucun lieu n'est cherché ni gardé. La recherche d'un lieu par son nom existe en planification (`src/planning/geocoding.ts`, service Photon) ; la recherche inverse (un nom à partir d'une position) n'existe pas.
- Le GPX téléchargé d'une session nommée porte son nom (`src/library/sessionBundle.ts`, `retouchGpx`).
- Gtracker n'a que la voile et le surf (`SportType` : wingfoil, windsurf, kite, bateau, surf) : toutes les sessions ont une position de départ.

## Voulu

1. **Un nom calculé, jamais figé.** Tant que `record.name` est vide, le nom se compose à l'affichage à partir de l'activité de la session et de son lieu. Changer l'activité d'une session change donc son nom tout seul, sans rien réécrire. Dès qu'un nom est saisi (« Renommer »), c'est lui qui vaut, pour toujours ; l'effacer rend le nom calculé. Plus aucune session « Sans nom ».
2. **Une seule fonction pure** qui donne le nom à montrer (par exemple `sessionDisplayName(record, activité, lieu)` dans `src/library/sessionName.ts`, avec son test), appelée partout où un nom de session s'affiche : liste des sessions, en-tête des analyses, écran de fin d'enregistrement, image de partage, listes de Statistiques et du Profil, nom du GPX téléchargé. Aucun de ces endroits ne recompose le nom lui-même.
3. **Le lieu est gardé dans la fiche** (champ `place` de `src/library/record.ts`, écrit par `updateSessionRecord`), cherché une seule fois : à la fin de l'enregistrement ou à l'import. Sans réseau à ce moment-là, il est cherché plus tard, à l'ouverture de l'analyse ou de la liste, sans bloquer l'affichage (le nom est alors l'activité seule, puis se complète).
4. **Quel lieu** : d'après le point de mise à l'eau (premier point de la trace), le plan d'eau nommé le plus proche (plage, port, marina, étang, baie), sinon la commune. Pour une navigation qui finit ailleurs (bateau, descente au vent) : « Départ → Arrivée » quand l'arrivée est loin du départ et porte un autre lieu.
5. **Lieux appris.** La fiche distingue un lieu trouvé par la carte d'un lieu corrigé par l'utilisateur. Un lieu corrigé est retenu avec sa position ; toute session neuve qui part à moins du rayon prend ce nom sans interroger la carte. Les lieux appris font partie des réglages de l'utilisateur (ils doivent suivre la mémoire en dossier portable, pas rester sur un seul appareil).
6. **Corriger le lieu** se fait là où l'on renomme la session, par un geste distinct : « Renommer » change le nom entier, « Lieu » ne change que le lieu (et l'apprend).
7. **GPX téléchargé** d'une session non renommée : `AAAA-MM-JJ Activité - Lieu.gpx`. Le titre écrit dans le GPX à l'enregistrement reste tel quel.

## Règles à tenir

- Aucun seuil en dur : rayon de recherche d'un plan d'eau (ordre de grandeur 1 à 2 km), distance à partir de laquelle une arrivée compte comme « ailleurs », rayon d'un lieu appris (500 m) vont dans un profil ou un objet de réglages passé en paramètre.
- Tout accès au réseau et au stockage passe par les modules de `src/platform/` et les pièces existantes de la planification ; la fonction du nom reste pure.
- Une donnée propre à une session va dans sa fiche, jamais dans une clé de l'appareil.
- Le lieu vient d'un service de cartes : un échec, une réponse vide ou un nom absurde ne doit jamais empêcher de ranger, d'ouvrir ni de nommer une session.

## Points propres à la version vendue, à trancher côté Gtracker

1. **Service de cartes.** Trouver le lieu envoie la position du départ à un service public. Le serveur Photon de démonstration, employé aujourd'hui par la recherche de lieux, a des conditions d'usage raisonnable : à vérifier pour une application vendue à plusieurs utilisateurs, ainsi que la mention à ajouter dans les licences et « À propos » (données OpenStreetMap). Par défaut : même service que la planification, une seule demande par session, résultat gardé dans la fiche.
2. **Confidentialité.** Dire dans l'application, en une phrase, que le lieu est cherché en ligne d'après le point de départ ; prévoir un réglage pour s'en passer (le nom est alors l'activité seule, les lieux appris restant possibles). Par défaut : recherche active, réglage présent.
3. **Sessions déjà rangées.** Leur chercher un lieu d'office, une par une et en tâche de fond, ou seulement à leur ouverture ? Par défaut : à l'ouverture de l'analyse et pour les lignes visibles de la liste, jamais toute la bibliothèque d'un coup.

## Pistes techniques, non vérifiées

- Photon propose une recherche inverse (`/reverse?lon=…&lat=…`) ; elle rend l'objet le plus proche, qui peut être une rue : filtrer sur les types utiles (plage, port, plan d'eau, localité) ou demander plusieurs résultats et choisir.
- Autre voie pour le plan d'eau : une requête Overpass autour du départ sur les objets nommés `natural=beach`, `natural=bay`, `leisure=marina`, `harbour`, `natural=water`.
- La commune : champ `city` (ou équivalent) de la réponse du service.

## Vérification

- Tests de la fonction pure : nom saisi qui prime, nom effacé qui rend le calculé, changement d'activité suivi, sans lieu, « Départ → Arrivée », lieu appris dans le rayon et hors du rayon, lieu corrigé qui prime sur celui de la carte.
- Tests du choix du lieu sur des réponses de service enregistrées (plage à 300 m, rien de nommé donc commune, réponse vide, erreur).
- Banc : une session importée sans réseau (activité seule), puis avec une réponse simulée (nom complété), renommage, effacement du nom, changement d'activité, correction du lieu puis seconde session au même départ.
- Essai au téléphone, un seul : enregistrer une courte session depuis un spot connu, lire son nom, corriger le lieu, en enregistrer une seconde au même endroit.

## Taille

Petit à moyen : un lot Opus, effort high, avec un plan par l'agent `Plan` (la fonction touche tous les endroits qui affichent un nom). Lot à mener après la refonte de l'accueil et de la page des sessions si elle est en cours, pour ne pas croiser les mêmes fichiers.
