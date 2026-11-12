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
