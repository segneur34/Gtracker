# 338 · Couleurs d'activité libres

Modèle | Réflexion : Opus | high

## Tel que noté

Réponse du 11/11 : « réfléchir à plusieurs couleurs, du blanc au noir, vert, orange, rouge… ». Palette validée le 12/11 sur la planche, « gardée telle quelle ». Deuxième lot du paquet de la nouvelle apparence, après le 344 (habillage) : l'accent de famille est déjà l'encre, ce lot ne porte que les couleurs des activités.

## Décisions déjà prises

- Les onze activités de départ et leur couleur : Wingfoil `#003E52`, Parawing `#72B0BD`, Windsurf `#1E88E5`, Windfoil `#6236C9`, Kite `#FF7A1A`, Kitefoil `#E0218A`, Bateau `#8E1B2E`, Surf `#000000`, Paddle `#E6C229`, Surf foil `#646464`, Pumping `#0E8F4F`.
- Une douzième couleur, « libre » : blanc cerclé `#FFFFFF`, proposée d'abord à une activité créée (première planche A, 11/11).
- La palette n'appartient plus à une famille : toute activité, de voile ou de surf, peut prendre n'importe laquelle des douze couleurs dans Réglages. Deux activités peuvent porter la même (tranché par l'orchestrateur : douze couleurs pour un nombre libre d'activités) ; à la création, la première couleur que personne ne porte, le blanc d'abord, puis l'ordre de la palette.
- Mode nuit (tranché par l'utilisateur le 12/11) : le noir du Surf devient blanc ; le bleu sombre du Wingfoil reste tel quel, même peu contrasté sur fond noir. Par symétrie (tranché par l'orchestrateur) : le blanc « libre » devient noir cerclé la nuit, sans quoi il se confondrait avec le Surf. Les dix autres ne changent pas.
- Règle d'emploi (première planche A) : la couleur d'une activité ne remplit jamais une grande surface et ne porte pas de texte : une pastille à côté du nom, sa part dans un graphe, son rond sur une courbe ; le nom ou le dessin l'accompagne toujours. La pastille porte un fin cerne gris, qui fait voir le blanc sur blanc et le noir sur noir (planche finale, `.pt`). Là où le code pose encore du texte sur la couleur d'une activité, le texte prend le noir ou le blanc selon la clarté de la couleur (fonction pure, testée), ou la couleur redevient une pastille : au choix de l'exécutant, écran par écran, dit dans le rapport.
- Activités déjà enregistrées sur un appareil (choix de Claude dit à l'utilisateur le 12/11, non contredit) : reprise automatique, sans remise à zéro. Une activité de départ (reconnue par son identifiant) qui porte encore une ancienne nuance, claire ou sombre, prend sa nouvelle couleur ; une activité créée par l'utilisateur qui porte une ancienne nuance prend la première couleur libre de la nouvelle palette. Une couleur qui est déjà dans la nouvelle palette ne bouge pas. La reprise se fait à la lecture, par une fonction pure et testée, et ce qui est relu s'écrit ensuite dans la nouvelle forme.

## Aujourd'hui (à vérifier dans le code)

`src/core/activities.ts` (`FAMILY_SHADES`, `FAMILY_SHADES_DARK`, `shadeForTheme`, `BASE_COLOR`, `DEFAULT_ACTIVITIES`, `nextActivityColor`, `readActivities`), `src/core/palette.test.ts`, `src/core/activities.test.ts`, `src/components/ShadePicker.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/StatisticsPage.tsx`, `src/pages/RecordingPage.tsx`, `src/recording/journal.ts`, `src/settings/activityPresets.ts`, et tout lecteur de la couleur d'une activité (accueil, bibliothèques, Profil, image de partage).

## Voulu

1. La palette des douze couleurs à la place des nuances de famille, avec sa version de nuit ; `BASE_COLOR` et les activités de départ sur leurs nouvelles couleurs.
2. Le choix de couleur de Réglages propose les douze, pour toute activité ; la couleur proposée à une activité créée suit la règle ci-dessus.
3. La reprise automatique des activités enregistrées, testée (activité de départ à l'ancienne nuance claire ou sombre, activité créée, couleur déjà neuve, couleur inconnue laissée telle quelle).
4. Partout où une couleur d'activité s'affiche : cerne de la pastille, texte lisible ou pastille, graphes de l'accueil, du Profil et des Statistiques (deux activités voisines s'y distinguent, le blanc et le noir y restent visibles sur le fond du thème).
5. Tests de palette refaits : douze couleurs distinctes entre elles, en clair et en nuit ; à distance du vert vif `#AAFF00` et du rouge d'enregistrement ; chaque calcul a sa couleur de base ; la fonction de texte lisible. Les anciens tests de contraste par famille s'en vont avec les nuances.
6. `src/architecture.test.ts` et les autres gardes restent verts ; si un garde cite les nuances de famille, l'adapter et le dire.

## Ne pas faire

- Ni logos ni icônes (349), ni page Sessions (346) ; ne pas toucher à `docs/` hors de ce brief (l'orchestrateur met à jour `CLAUDE.md` et DECISIONS §11), ni à `package.json`, ni commit ni version.
- Les couleurs de données des graphes d'analyse, le dégradé de vitesse et le tracé de la planification ne changent pas.
- Budget : vers 140 tours, finis l'étape en cours et rends ton rapport, même partiel.

## Banc (lancé par l'orchestrateur)

`reglages`, `icones`, `cacher`, `statistiques`, `profil`, `general`, `surf`, `library` : texte identique, sauf le nom des couleurs dans le choix de Réglages s'il est lu (à dire dans le rapport).

## Questions tranchées par l'orchestrateur (12/11), d'après le plan

- Icônes dessinées à la couleur de l'activité (Réglages, listes, bibliothèque, itinéraires, Profil) : elles le restent dans ce lot, mais passent à l'encre quand leur couleur se confond avec le fond du thème (fonction pure, testée) ; le lot 349 les remplace ensuite par les logos.
- Nom des couleurs dans le choix de Réglages, ceux de la première planche : Blanc, Océan (`#003E52`), Lagon (`#72B0BD`), Bleu (`#1E88E5`), Violet (`#6236C9`), Orange (`#FF7A1A`), Magenta (`#E0218A`), Bordeaux (`#8E1B2E`), Noir (`#000000`), Jaune (`#E6C229`), Graphite (`#646464`), Vert (`#0E8F4F`) ; dans cet ordre, le blanc en tête.
- Les noms `shadeForTheme` et `ShadePicker` restent (la carte d'INVENTAIRE les cite).
- La reprise n'écrit rien au démarrage : la nouvelle forme s'écrit à la prochaine écriture des activités.
- Trait et flèche de la carte du direct (`RecordingPage`, `LiveMap`) : ils gardent leurs deux couleurs d'aujourd'hui, par famille, en constantes de carte (couleurs de données, comme le bleu du tracé de la planification).
- Les seuils de distance des tests se posent sur les valeurs mesurées de la palette, qui est figée : on ne retouche aucune couleur pour faire passer un test.

## Plan (agent Plan, 12/11), à suivre sauf constat contraire dans le code

- La couleur n'est enregistrée que dans `Activity.color` (liste des activités) ; journal, fiche de session et fichier de réglages n'en portent pas d'autre. Toute lecture passe par `readActivities` (`src/core/activities.ts`) : la reprise s'y branche, à la fin, seulement quand une liste enregistrée existe.
- Forme : `ACTIVITY_PALETTE`, douze entrées `{ light, dark, name }` en minuscules ; `shadeForTheme(color, dark)` garde sa signature et lit la palette ; `nextActivityColor(activities)` sans famille (première couleur que personne ne porte, sinon `palette[activities.length % 12]`) ; `readableInk(color)` rend le noir ou le blanc qui contraste le plus ; reprise : un ensemble figé des 24 anciennes nuances (claires et sombres), passe 1 sur les activités de départ (identifiant trouvé dans `DEFAULT_ACTIVITIES`), passe 2 sur les activités créées, dans l'ordre de la liste. Aucun identifiant d'activité en dur dans un autre fichier (`src/architecture.test.ts`).
- Lecteurs : pastilles (`ActivityChart.tsx` 120 et 152, `StatisticsPage.tsx` 157, 718, 884, `ProfilePage.tsx` 96) ; graphes (`ActivityChart.tsx` 95, en couleur brute sans passage au thème, à corriger ; `StatisticsPage.tsx` 708, 767, 852 ; anneau de `ProfilePage.tsx` 142 et 258) ; icônes à la couleur (`SettingsPage.tsx` 407 et 1031, `ActivitySelect.tsx` 85 et 135, celle-ci en couleur brute, `SessionLibrary.tsx` 404, `RouteList.tsx` 54, `ProfilePage.tsx` 237, `IconPicker.tsx`) ; fond sous un dessin (`ProfileAvatar.tsx` 31-40 : le dessin prend `readableInk`) ; choix de Réglages (`ShadePicker.tsx`, `SettingsPage.tsx` 436-439 avec son aide « parmi les nuances de sa famille », 1091 à 1124) ; `RecordingPage.tsx` 410 ; `PlanningPage.tsx` 245 à regarder. Le commentaire de `activities.ts` qui cite un numéro d'élément est à réécrire (règle 14).
- Cerne et visibilité : `box-shadow: var(--ring-line)` sur les pastilles (`.ui-swatch`, `.profile-legend__dot`, `.actchart__stack`) ; un trait gris fin sur les barres et les points des Statistiques ; un anneau gris sous l'anneau du Profil.
- Tests : `palette.test.ts` réécrit ; `activities.test.ts` (appartenance à la palette, cas de la ligne 70 qui migre désormais, `nextActivityColor`, un bloc neuf pour la reprise : départ en ancienne nuance claire puis sombre, activité créée, deux créées dans l'ordre, couleur déjà neuve, couleur inconnue, majuscules) ; `useSportSettings.test.ts` à surveiller ; `outils/styles-en-ligne.json` ne doit que baisser (classes ou attributs SVG plutôt que `style=`).
- Banc : `outils/banc/reglages.mjs` (lignes 80-84 et 111) sème d'anciennes couleurs et les imprime : sa sortie changera, l'adapter et le dire.
- Étapes : 1. noyau et tests (en gardant un temps `FAMILY_SHADES` pour compiler) ; 2. Réglages ; 3. nettoyage (`RecordingPage`, suppression de `FAMILY_SHADES` et `FAMILY_SHADES_DARK`, commentaires de `tokens.css`) ; 4. cerne et visibilité ; 5. avatar et icônes ; 6. relevé final.
- Pièges : ne jamais écrire la couleur de nuit dans la liste (elle ne sert qu'à l'affichage) ; aucun test ne suppose que relire rend le texte brut.

## Rapport attendu

Le rapport habituel, avec : où la reprise est branchée, les écrans où du texte était posé sur une couleur d'activité et ce que tu en as fait, et ce qui est à regarder au téléphone.
