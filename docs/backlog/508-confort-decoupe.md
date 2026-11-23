# 508 · Confort : découpe en parts sans fichier commun

Découpe du 23/11 (constats vérifiés dans le code ce jour-là : 12 sur 13 tiennent, E-04 reste à mesurer). Le détail de chaque constat est dans `docs/backlog/493-relecture-avant-vente.md`, section « ## 508 ». Résultat attendu de toutes les parts : rien de visible, un code plus simple à reprendre. Chaque part a son commit (lot coupé en parties).

## Parts à lancer ensemble

### S1 · Formats (D-06, D-08 hors Réglages) · Sonnet, effort élevé

Dates, heures et saisie des nombres refaites à la main, ramenées aux pièces communes. `units.ts` (`formatTimeOfDay`, `formatSessionDate`) et `calendar.ts` existent tous deux ; huit recettes locales de date dans six fichiers ; `StatisticsPage.tsx` (vers la ligne 698) recopie `dayMonthNumeric`, qui existe. Cinq recettes de saisie de nombre : `BeepCurveEditor.tsx` (vers 76), `SpeedRangeEditor.tsx` (vers 35 et 78), `SessionThresholdField.tsx` (vers 46), `ProfilePrompt.tsx` (vers 64). `SpeedRangeEditor.tsx` vers 78 lit par `parseFloat(text)` sans traiter la virgule : si le champ est du texte libre, « 12,5 » donne 12 ; à vérifier, et à corriger si c'est le cas (le dire dans le rapport).

Fichiers : `src/core/units.ts`, `src/core/calendar.ts`, `src/components/{SessionRow,ActivityChart,FollowTracePicker,RouteList,BeepCurveEditor,SpeedRangeEditor,SessionThresholdField,ProfilePrompt}.tsx`, `src/library/activityChart.ts`, `src/pages/StatisticsPage.tsx` (la recopie de `dayMonthNumeric` seulement), `src/core/{units,calendar}.test.ts`. Hors de la part : `library/syncReport.ts` (liaison) et `recording/session.ts` (noms de fichier écrits).

À prouver : des tests qui figent les sorties actuelles **avant** la refonte, en français, anglais et espagnol, écrits et verts sur le code d'avant puis gardés ; au banc, texte identique (sessions, statistiques, itinéraires, réglages d'analyse).

### S2 · Titre repliable et ménage (part de D-07, D-11 hors coquille) · Sonnet, effort élevé

`PanelTitle` est un `<strong role=button>` avec un style en ligne, importé dans 19 fichiers ; `ChartFold`, `PlanBlock` et le pli du détail du Profil font chacun le leur. Une pièce commune (`src/components/ui/FoldTitle.tsx`, neuve) que ces quatre-là emploient, sans changer leur rendu ni leurs classes. Code mort confirmé : `ActivityBubbles.tsx` (vers 63) refait `usePrefersReducedMotion` ; `.ui-photo-banner`, `.route-list__icon-btn` et le sélecteur `.brush-rule` n'ont aucun emploi.

Fichiers : `src/components/ui/FoldTitle.tsx` (neuf), `src/components/ui/ui.css`, `src/components/{PanelTitle,ChartFold,ActivityBubbles}.tsx`, `src/pages/PlanningPage.tsx` (`PlanBlock` seulement), `src/pages/ProfilePage.tsx` (pli du détail), `src/components/RouteList.css`, `src/components/BrushFrame.css` (le sélecteur `.brush-rule` seulement), `outils/styles-en-ligne.json` (ses lignes seulement, sans régénérer le fichier), `docs/INVENTAIRE.md` (la ligne de la pièce neuve). Hors de la part : `SettingsPart.tsx`, `SettingsPage.tsx`, `ActivityChart.tsx` (part S1).

À prouver : texte identique au banc ; `aria-expanded` présent sur chaque titre ; les sélecteurs `ui-panel-title` qu'emploient les scripts du banc trouvent encore leur élément (la classe reste) ; captures avant et après des panneaux, ordinateur et téléphone.

### S3 · Manœuvres sans styles en ligne (part de D-04) · Sonnet, effort élevé

`ManeuversPanel.tsx` porte 51 des 196 styles en ligne. Les passer en classes (variables de `theme/tokens.css`), sans changer le rendu ; ajouter un cliquet sur le nombre de `!important` des feuilles de style (43 aujourd'hui : 29 dans `analysisMobile.css`, 5 dans `ui.css`, 3 dans `BrushFrame.css`, 3 dans `PlanningPage.css`, 2 dans `RecordingPage.css`, 1 dans `FlightPumpingPanel.css`), sur le modèle du relevé des styles en ligne : un relevé par fichier qui ne fait que baisser.

Fichiers : `src/components/sailing/ManeuversPanel.tsx`, une feuille de style à lui (neuve, ou celle qu'il emploie déjà), `src/pages/analysisMobile.css` seulement s'il le faut, `src/theme/inlineStyles.test.ts` et le relevé du cliquet dans `outils/`, `outils/styles-en-ligne.json` (sa ligne seulement). Les couleurs de données des graphes et de la carte restent en dur (attributs SVG).

À prouver : texte identique ; captures de l'onglet manœuvres (scripts `virages` et `rendus` du banc), ordinateur et téléphone ; relevé ramené de 196 à 145 environ.

### S4 · Fichiers d'une version plus récente (A-09, et l'élément 479) · Opus, effort élevé

`parseSettingsFile` ignore `version`, et `buildSettingsFile` écrit `Math.max(SETTINGS_VERSION, previous.version)` : une ancienne version du programme peut réécrire le fichier de réglages d'une version plus récente et en retirer des activités qu'elle ne connaît pas. De même `syncRestingHrFile` (`hooks/restingHrFile.ts`, vers 35) réécrit un fichier de FC repos de version future, alors que `isNewerRestingHrFile` existe et que `syncExtras.ts` (vers 247) s'en sert déjà. Le patron « non réinscriptible » existe : `library/learnedPlaces.ts`, `library/record.ts` (vers 758).

Fichiers : `src/library/settingsFile.ts`, `src/hooks/sessionLibrary/deviceSettings.ts`, `src/hooks/restingHrFile.ts`, leurs `*.test.ts`.

À prouver, par tests synthétiques : un fichier d'une version plus récente n'est jamais réécrit ni rétrogradé ; aucune version écrite ne dépasse la constante ; une activité sur un calcul inconnu n'est jamais retirée. Silencieux : aucun texte neuf à l'écran. Au banc, `reglages` et `fc-repos` inchangés.

## Part à lancer seule, poste calme

### S5 · Mesures (E-01, E-02, E-04), sans code de l'application · agent du banc, Sonnet

`outils/banc/fluidite.mjs` : ajouter le relevé du tas mémoire de la page et du calcul de fond ; mesurer par `fluidite-compile.mjs` (`FLUIDITE_HEURES=4 FLUIDITE_RALENTI=6` : ouverture, seuil, démarrage) et la taille des morceaux du build. Les autres lots en parallèle faussent les durées. Le gain se juge ensuite : refaire le calcul de fond seulement si l'écran reste figé plus de 0,5 s au ralenti × 6.

## Plus tard

- S6 · Réglages (reste de D-07 et D-08) : `SettingsPart.tsx`, `SettingsPage.tsx` (deux bascules, recettes de nombres). Après les lots 511 et 512 et la part S2.
- S7 · Tiret unique (D-09) : `units.ts` rend « - » dans dix cas et « — » dans deux ; « — » écrit à la main dans 16 fichiers, « - » dans 8. Visible : après la décision de l'utilisateur, et après S1 et S3.
- Types sans emploi de `platform/desktopBridge.ts` : après les lots 505 et 510.

## À laisser avant la vente

- D-01 (grandes pages d'un seul bloc) : grande refonte, portée par les éléments 404 et 309.
- D-04 hors `ManeuversPanel` : idem.
- D-05 (quatorze `window.confirm` et un `window.alert`, dans dix fichiers, onze scripts du banc à revoir, `hooks/leaveGuard.ts` synchrone) : changement visible, maquette à valider d'abord ; à l'utilisateur de dire.
- E-01, E-04 (calcul de fond des très longues sessions) et E-02 (démarrage) : mesure d'abord (S5), aucun code avant.
- A-11 (heure d'une session lue dans un autre fuseau) : aucun décalage horaire n'est stocké ; décision de produit, à l'utilisateur.
- knip (recherche de code mort par outil) : dépendance de plus, points d'entrée du banc et de la coquille à régler.

## Réponses de l'utilisateur (23/11)

- A-11, heure d'une session faite dans un autre fuseau : « l'écrire, sans code ». L'heure affichée est celle de l'appareil qui lit la session ; à écrire dans `docs/DECISIONS.md` §2 à la passe de documentation, et dans la note de remise (507).
- D-05, confirmations par la boîte du système : « non, à laisser » avant la vente.
- D-09, valeur absente : le tiret long « — » partout (part S7, après S1 et S3).

## Avancement

- S1, S2 et S3 codées et commitées le 23/11, le banc restant à passer. Écarts admis de S2 : le chevron du pli du Profil s'anime (0,15 s) comme les autres ; celui de `ChartFold` ne rétrécit plus quand le libellé déborde. De S1 : le constat de la virgule dans `SpeedRangeEditor` était faux (champs numériques), rien n'est corrigé.

## Ensuite

Mettre à jour les lignes 309 et 404 du reste à faire (D-04 en partie fait, cliquet) et retirer l'élément 479 (fait par S4).
