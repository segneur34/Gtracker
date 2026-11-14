# 363 · Sessions : un lieu corrigé renomme les sessions voisines du même nom

Modèle | Réflexion : Opus | high pour le code (partie A), Sonnet | high pour le script du banc (partie B).

## Demande

Lot 352, essai 236, remarque de l'utilisateur du 13/11 : « j'ai changé le lieu, en l'occurrence j'ai enlevé un accent, mais ça ne s'est pas mis à jour dans les autres sessions ». C'était voulu au lot 352 (DECISIONS §8 : « un lieu appris ne réécrit jamais le lieu déjà trouvé d'une session ») ; l'utilisateur renverse cette règle le 13/11 : toutes les sessions voisines dont le lieu s'écrivait exactement comme l'ancien nom prennent le nouveau, sans rien demander ; une session d'un autre nom, même partie tout près, ne bouge pas.

Résultat attendu : un lieu renommé une fois l'est pour toutes ses sessions.

## Cause (plan du 14/11, agent Plan)

Dans `src/hooks/sessionLibrary/placeQueue.ts`, `correctSessionPlace` écrit la seule session corrigée (`updateSessionRecord(file, { place: after })`), puis `learnPlace` (`src/library/places.ts`) ajoute un lieu appris à 500 m, qui ne sert qu'aux sessions sans lieu (`nearestLearnedPlace`, dans `lookup` de la file). Aucune autre fiche n'est lue ni réécrite.

## Plan

Le lieu ne passe pas par le brouillon : la correction s'écrit tout de suite dans la fiche (décision du 352, inchangée). La propagation part donc de `correctSessionPlace`, juste après l'écriture de la session corrigée. `SessionNameEditor.tsx` et `SessionRow.tsx` restent tels quels.

1. `src/library/places.ts` : un champ `renameRadiusM` dans `PlaceRules` et `PLACE_RULES` (3000 m), et trois fonctions pures, avec leurs tests dans `places.test.ts` (positions synthétiques) :
   - `placeRenames(before, after)` : la liste `{ from, to, lat, lon }` des points dont un nom non vide devient un autre nom non vide ;
   - `renamedPlace(place, renames, rules)` : rend le même objet si rien ne change ;
   - `renamedLearnedPlaces(learned, renames, rules, nowMs)`.
   Réutiliser `haversineDistance`, `correctedPlace`, `placesToLearn`, `learnPlace`.
2. `src/hooks/sessionLibrary/sessionRecords.ts` : une écriture groupée de fiches (variante de `updateSessionRecord` qui garde `noteRecordEdits`, `scheduleRecordWrite` et `cacheDirty`, `replaceSession(s, true)` pour chacune puis un seul `publish()`), pour ne pas redessiner la liste à chaque fiche. Si elle est exportée, la déclarer dans `couches.test.ts`.
3. `placeQueue.ts`, `correctSessionPlace` : après la correction, parcourir un instantané de `lib.all` (sauf la session corrigée et les fiches en lecture seule), appliquer `renamedPlace`, écrire en groupe, puis renommer aussi les lieux appris du même ancien nom (`writeDeviceLearnedPlaces`, `saveLearnedPlacesFile`).
4. L'ancien nom retenu : le lieu appris garde l'ancien nom (champ `replaces`, que les anciennes versions conservent sans le lire), et dans `lookup` un nom trouvé en ligne égal à un ancien nom retenu dans le rayon est remplacé par le nouveau. Sans cela, une session neuve partie à plus de 500 m de toute correction reprendrait l'ancien nom.
5. Tests de `placeQueue.test.ts` : la session corrigée plus deux du même nom renommées, une d'un autre nom à 300 m intacte, une en lecture seule sautée, un nom saisi conservé ; un faux `search` qui rend l'ancien nom, et c'est le nouveau qui est écrit.
6. `docs/DECISIONS.md` §8 : la phrase « un lieu appris ne réécrit jamais le lieu déjà trouvé d'une session » remplacée par la règle neuve, datée du 13/11 ; en dernier.

Partie B, script du banc `outils/banc/lieu.mjs`, à prolonger : deux sessions trouvées « carte » sous le même nom, plus une d'un autre nom (`autour(nom)` de `lib/lieux.mjs`) ; corriger l'une ; les lignes et la fiche de la deuxième suivent, la troisième ne bouge pas ; une session nommée à la main garde son nom.

## Ce qui bouge et ce qui ne bouge pas

- Filtre principal : le nom, à l'égalité stricte (accent et casse comptent, l'utilisateur a dit « exactement »). Les sessions de « Celles », à 350 m des « Vailhés », ne bougent donc pas.
- Distance mesurée entre points arrondis : celui du lieu corrigé et celui de chaque départ ou arrivée des autres fiches. Départs et arrivées se correspondent dans les deux sens.
- Une session renommée à la main garde son nom : seul son lieu change, le nom saisi prime toujours (`library/sessionName.ts`). Le nom de base n'est jamais écrit dans la fiche : il se recompose à l'affichage. Un nom saisi qui contient l'ancien lieu en toutes lettres n'est pas touché.
- Le GPX n'est pas touché, `SUMMARY_CALC_VERSION` ne bouge pas.
- Pendant un enregistrement : sans risque, la session en cours n'est pas encore dans la mémoire. Pendant un import : une session importée après la passe prend le nouveau nom par le lieu appris ou l'ancien nom retenu.

## Tranché par l'orchestrateur (14/11)

1. Borne de « voisines » : 3000 m, le double de `waterRadiusM` (deux sessions qui ont trouvé le même plan d'eau sont chacune à 1,5 km au plus de lui) ; 500 m laisserait l'ancien nom à une session partie de l'autre bout de la plage. Constante de `PLACE_RULES`, sans réglage persisté, comme ses voisines. À dire à l'utilisateur, sans le questionner.
2. Ancien nom retenu dans le lieu appris (point 4 du plan), plutôt qu'un lieu appris par session renommée.
3. Source d'un lieu renommé par propagation : « appris », sauf s'il était déjà « utilisateur », auquel cas il le reste.
4. Un lieu vidé ne vide pas les autres sessions : vider n'est pas renommer.

## Vérification

`node outils/verif.mjs --rapide` après chaque étape. Banc par l'orchestrateur : `lieu` du côté modifié, puis `classer`, `rename`, `library` et `session-save` identiques avant et après.

## Essai au téléphone

Un seul, qui reprend le 236 : corriger « Les Vailhés » sur une session et voir toutes les autres du lac suivre, celles de « Celles » non. Y joindre le reste du 352 : une session neuve au même endroit prend le nouveau nom.
