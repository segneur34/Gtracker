# 513 · Activités d'un calcul inconnu : gardées dans la liste de l'appareil, identifiant jamais repris

Modèle | Réflexion : Sonnet | high

Plan rendu par l'agent `Plan` le 23/11, condensé ici. Suite de la part S4 du lot 508 (commit `ee8c885`), qui protège le fichier de réglages du dossier (`withUnknownActivities`, `src/library/settingsFile.ts`) mais pas la liste gardée sur l'appareil (clé `gtracker.sportSettings`).

## Le défaut, vérifié dans le code le 23/11

- `readActivities` (`src/core/activities.ts`) écarte toute entrée dont `base` n'est pas un calcul connu (`isSportType`) ; le hook reçoit la liste déjà filtrée (`storedActivities`, `src/hooks/useSportSettings.ts`).
- Cinq écritures de la liste partent de cette liste filtrée, toutes dans `useAllSportSettings` : `addActivity`, `updateActivity`, `removeActivity`, `setActivityHidden` et `setFamilyHidden` (ces deux dernières par `withVisibility`, `src/settings/activitySettings.ts`). Les autres écritures recopient `stored` et laissent la liste intacte.
- `newActivityId(name, existing)` tire l'identifiant du nom (`a-ski`, puis `a-ski-2`) sur la liste filtrée : une activité neuve « Ski » reprend l'identifiant d'une activité inconnue, et hérite de ses réglages et de son matériel.
- Le défaut existe face à une version future, sans retour en arrière : « Reprendre les réglages », ou un appareil neuf qui reprend le fichier le plus récent, copie la liste brute de l'autre appareil (`adoptedValues`, `settingsFile.ts`), entrées inconnues comprises ; un programme Windows plus ancien qui reprend les réglages d'un téléphone plus récent les perd au premier changement d'activité.
- Ce que le correctif couvre : à partir de cette version, une entrée inconnue ne sort plus de la liste de l'appareil et son identifiant n'est plus repris. Rien pour les versions déjà diffusées.

## Étapes

1. `src/core/activities.ts` : y déplacer l'algorithme de `withUnknownActivities`, sous un nom comme `keepUnknownActivities(next, previous)` : chaque entrée inconnue revient après sa voisine d'avant ; une entrée absente dont le calcul est connu reste retirée. Ajouter `storedActivityIds(raw)` : tous les identifiants de la liste brute, entrées écartées comprises. `newActivityId(name, existing, reserved = [])` : troisième paramètre facultatif, les appels d'aujourd'hui ne changent pas.
2. `src/library/settingsFile.ts` : `withUnknownActivities` appelle `keepUnknownActivities`, même comportement ; ses tests passent sans retouche.
3. `src/settings/activitySettings.ts` : fonction pure `withActivities(stored, list)`, qui pose `activities` avec les entrées inconnues de `stored.activities` remises ; `withVisibility` s'en sert.
4. `src/hooks/useSportSettings.ts` : `addActivity`, `updateActivity` et `removeActivity` passent par `withActivities` ; `addActivity` donne `storedActivityIds(stored.activities)` comme identifiants réservés.
5. Tests synthétiques : `activities.test.ts` (rang gardé ; entrée de calcul connu retirée qui ne revient pas ; identifiant réservé jamais repris ; `newActivityId` sans réservés inchangé) ; `activitySettings.test.ts` (`withVisibility` garde l'entrée inconnue) ; `useSportSettings.store.test.ts` (liste avec `{id:'a-ski', base:'ski'}`, puis ajouter « Ski », renommer, supprimer, cacher une activité et une famille : l'entrée reste à son rang, l'activité neuve reçoit `a-ski-2`).
6. `node outils/verif.mjs --rapide`. Banc : `reglages` inchangé (aucun texte neuf), lancé par l'orchestrateur.

Aucune migration, aucun changement de format (ni version de fichier, ni `SUMMARY_CALC_VERSION`), aucun texte visible.

## Tranché par l'orchestrateur

- Type de `activities` dans `StoredSettings` : il reste `Activity[]` ; la donnée brute se lit par un transtypage commenté au seul endroit qui remet les entrées inconnues (diff le plus petit).
- Champs inconnus d'une activité connue (un logo futur) : hors du lot.
- Familles inconnues de `hiddenFamilies` : laissées (la règle 13 fige deux familles).
- Un identifiant repris après une suppression voulue (supprimer « Ski », recréer « Ski ») : comportement d'aujourd'hui gardé, hors du lot.
- Remettre dans la liste de l'appareil les activités inconnues de son propre fichier : écarté.
