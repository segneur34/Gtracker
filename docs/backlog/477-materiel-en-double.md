# 477 · Matériel : lignes en double dans une session, sessions absentes des Statistiques

Modèle | Réflexion : Opus | high. Plan par l'agent `Plan` avant le code.

Demande : `node outils/backlog.mjs --ligne 477`. Bogue rapporté par l'utilisateur le 21/11 : « J'ai fait des sessions avec même voile, même foil, mais ils n'apparaissent pas dans les stats. Et quand je suis allé dans les sessions et regarder le matériel, il y avait deux fois la ligne foil, deux fois la ligne voile, avec les mêmes noms dans chaque ligne. » Il soupçonnait la synchronisation : ce n'est pas elle.

## Diagnostic du 21/11 (code lu par un agent, données lues dans le dossier mémoire du PC)

Ce que le code fait :
- Le catalogue du matériel est rangé par appareil, par activité : `gearGroups[idActivité]` des réglages du sport (`src/settings/activitySettings.ts`, vers 168), recopié dans `reglages/<appareil>.json`. Une ligne (groupe) et un article portent un identifiant tiré au hasard (`src/components/GearGroupsEditor.tsx`, vers 106 ; `src/settings/gear.ts`, vers 71).
- Une fiche garde une copie de chaque choix : `notes.gear[] = { groupId, groupName, itemId, itemName }` (`src/library/notes.ts`, `src/library/record.ts`).
- Dans l'analyse, `shownGroups` (`src/components/SessionNotesPanel.tsx`, vers 44) montre les lignes du catalogue, puis une ligne de plus par choix dont le `groupId` n'est pas dans le catalogue, sous le nom recopié : le rapprochement ne se fait que par identifiant. `withChoice` (vers 51) ne remplace que le choix du même `groupId` : choisir sur la ligne du catalogue laisse l'ancien choix dans la fiche.
- Dans les Statistiques, `matchesGear` (`src/library/stats.ts`, vers 151) cherche l'article par identifiant et ne se rabat sur le nom (ligne et article) que si l'identifiant est inconnu du catalogue ; le filtre ne propose que les articles du catalogue.
- Aucun passage d'un appareil à l'autre ne touche au catalogue : « Récupérer » et le sans-fil ne lisent que les sessions.

Ce que les données disent (dossier mémoire du PC, 20 sessions) :
- Les réglages du PC et du téléphone portent le même catalogue pour `wingfoil`, mêmes identifiants : « Voile » (Gong puls 6.5, Unit 5.5, Reedin 4.5, Strike 4.5) et « Foil » (Duotone glide 1085, Duotone glide 725). Une seule ligne de chaque nom.
- Les sessions du 13/11 (deux) et du 20/11 pointent sur ces identifiants.
- Les sessions du 01/11, du 02/11 et du 09/11 pointent sur d'autres lignes « Voile » et « Foil », d'un catalogue qui n'existe plus (il était rangé sous l'activité `a-wingfoil`, disparue quand les activités de départ ont été refaites), avec d'anciens articles : « Gong plus 6.5 », « Reedin 4.5 », « Glide v1 1085 ».

Donc : ces trois sessions montrent quatre lignes (les deux du catalogue, vides, et les deux anciennes, de même nom), et les Statistiques ne les comptent pas avec le matériel d'aujourd'hui quand l'article a changé de nom (« Gong plus 6.5 » contre « Gong puls 6.5 », « Glide v1 1085 » contre « Duotone glide 1085 ») ; seule « Reedin 4.5 », de même nom, est retrouvée. Le même défaut attend tout utilisateur qui change l'activité d'une session (l'autre activité a son propre catalogue, souvent aux mêmes noms de lignes) ou qui supprime puis recrée une ligne.

## À faire (à préciser par le plan)

1. Une ligne par nom dans l'analyse : un choix dont la ligne est inconnue mais porte le nom d'une ligne du catalogue (`sameGearName`, `src/settings/gear.ts`) se montre sur cette ligne, pas sur une ligne de plus ; son article se rattache par nom s'il existe, sinon il reste affiché tel quel sur cette ligne (« ancien article », sans être ajouté au catalogue).
2. Choisir un article sur une ligne remplace tout choix de la même ligne, par identifiant ou par nom : plus jamais deux choix « Foil » dans une fiche.
3. Statistiques : rapprocher par nom de ligne et d'article même quand l'identifiant diffère, et ne plus laisser disparaître en silence un article qui n'est plus au catalogue (le proposer dans le filtre sous son nom, ou le dire).
4. Données déjà en double : pas de réécriture en masse des fiches ; une fiche se corrige quand l'utilisateur y choisit un article (point 2). Les fiches qui portent déjà deux choix d'une même ligne gardent le dernier.
5. Tests sur des fiches synthétiques : ligne inconnue de même nom, article de même nom, article renommé, activité changée, deux choix d'une même ligne.

## Question laissée à l'utilisateur (défaut retenu si pas de réponse)

Faut-il, dans Réglages, un geste « ces anciennes sessions de l'article X comptent pour l'article Y » ? Défaut de Claude : non, l'utilisateur rechoisit l'article sur les quelques sessions concernées (trois chez lui : 01/11, 02/11, 09/11), ce que le point 2 rend propre.

## Lien avec le lot 449

La synchronisation dans les deux sens devra transporter le catalogue du matériel, ou au moins rapprocher par nom : sinon deux appareils qui créent chacun leurs lignes retombent dans ce défaut. À dire dans le plan du 449.
