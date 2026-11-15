# 399 · Carte et fond de page allégés : trace en 64 nuances, direct par blocs, fond en image légère

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11 (auditeur « affichage », sondes hors dépôt). L'utilisateur, le 15/11 : « ça ne me pose aucun problème d'avoir 64 nuances pour la trace, c'est largement suffisant ». Aucun chiffre d'analyse ne change. Lire dans `CLAUDE.md` la décision « Couleur de trace » et la règle 11.

## 1. Trace colorée en 64 nuances

`src/core/trackColor.ts:72,95` (`pathsByColor`) regroupe les traits par couleur exacte ; `src/core/speedGradient.ts:37-45` (`gradientColor`) en donne environ 770 distinctes ; le redessin a lieu à chaque fin de déplacement ou de zoom (`src/components/coloredTrackPath.ts:168-173`). Sonde sur vitesse synthétique : 9 100 tracés pour 4 h à 1 Hz, 16 900 pour 4 h à 5 Hz ; à 64 niveaux, environ 3 000.

Attendu : la couleur d'un trait est prise parmi 64 nuances réparties sur l'échelle (le nombre est une constante nommée, à un seul endroit) ; même échelle absolue, mêmes bornes, gris sous la borne basse, légende inchangée ; la vignette de Sessions et l'image de partage suivent la même coloration (`core/trackColor.ts` est leur seule source). Tests : nombre de couleurs distinctes borné par la constante ; bornes et gris inchangés. Compter dans le rapport les tracés avant et après sur `traceLongue` du banc.

## 2. Carte du direct : seul le dernier bloc change

`src/components/LiveMap.tsx:149,169-171` : à chaque position, `panTo` fait retravailler toute la trace par Leaflet, et toutes les 2 s le dernier segment est recopié en entier (`setLatLngs` sur 14 400 points après 4 h à 1 Hz, deux fois avec le liseré). Attendu : le segment en cours est découpé en blocs figés de quelques centaines de points ; seul le dernier bloc reçoit les positions neuves. Même rendu (couleur, liseré, jonction sans trou entre deux blocs), pauses et reprises comme aujourd'hui. `pathOptions` stables (règle 11).

## 3. Fond de page

`champ-clair.svg` et `champ-sombre.svg` : 345 ko chacun, 17 711 sous-tracés dans 54 tracés qui portent chacun une opacité (une couche de peinture par tracé), posés en fond plein écran (`src/components/AppShell.css:27-38`). Attendu : une image WebP par thème, en deux tailles (téléphone, ordinateur), tirée des SVG tels quels (mémoire « images fournies : sans retouche » : même dessin, même cadrage, aucune retouche), de rendu indiscernable aux tailles d'écran visées ; les SVG sources restent dans le dépôt hors du paquet compilé s'ils servent à refaire les images. Montrer à l'utilisateur une planche avant/après (jour et nuit) ouverte dans le navigateur avant de conclure.

## 4. Petits restes

- Polaire encore animée (`src/components/.../SpeedPolarChart.tsx:28`, `isAnimationActive`) : couper, comme les autres graphes.
- Quatre fichiers de police `.woff` de repli embarqués et jamais lus (environ 125 ko) : vérifier dans `dist` puis retirer de l'import d'Inter.
- Page Sessions : `content-visibility: auto` et `contain-intrinsic-size` sur les lignes (`.lib-row`), pour que les lignes hors écran ne coûtent rien ; vérifier que le défilement retenu et le filtre par logo tiennent.

## Plan du 15/11 (agent Plan) et questions tranchées par l'orchestrateur

Les constats tiennent, avec deux corrections : `src/pages/StatisticsPage.css` (vers 149-154) pose aussi les deux SVG du fond, à traiter comme `AppShell.css` ; et le gain de poids annoncé (environ 700 ko) est surestimé, un SVG compressé pesant environ 130 ko dans l'APK : le vrai gain du fond est le coût de dessin (démarrage, changement de thème, rotation). Les poids réels vont sur la planche et dans le rapport.

Trois agents successifs, un commit chacun :
1. **Parties 1 et 4.** D'abord, sur le code inchangé, un compteur de tracés dans `outils/banc/carte-perf.mjs` (appels de `stroke` du canevas au premier dessin et sur un geste, sur `traceLongue`), relevé avant. Puis : `TRACK_COLOR_LEVELS = 64` dans `src/core/speedGradient.ts`, appliqué dans `speedGradientColor` (seul appelant : `coloredSegments` de `core/trackColor.ts`, source de l'analyse, de la vignette et du partage) ; gris sous la borne basse et rouge au-dessus de la borne haute inchangés ; légende (`gradientCss`, `SpeedGradientLegend`) et bornes inchangées ; commentaires de `pathsByColor` et de `coloredTrackPath.ts` accordés ; la clé des vignettes gardées (`previewImageKey`, `library/previewImages.ts`) reçoit une version de dessin, pour qu'une vignette rangée ne garde pas l'ancienne coloration. Polaire sans animation (`SpeedPolarChart.tsx`, tracé et infobulle) ; Inter en woff2 seul (`theme/fonts.css` : quatre `@font-face` recopiés de `@fontsource/inter`, plus aucun `.woff` dans `dist/assets`) ; `.lib-row` (`components/SessionRow.css`) en `content-visibility: auto` avec `contain-intrinsic-size`, le défilement retenu (`hooks/useRetainedScroll.ts`) et le cadre peint contrôlés.
2. **Partie 2.** Fonction pure `liveBlocks(longueur, taille)` dans `src/recording/livePath.ts` (plages qui partagent leur point de jonction, blocs de 300 points, taille en constante nommée), cache des blocs dans `LiveMap.tsx` sur le modèle de `pathCache`, un bloc fermé garde son tableau, seul le dernier grandit ; styles stables. Jonction : le point un peu plus foncé de deux bouts ronds superposés est accepté (le raccord de fin de trace le fait déjà aujourd'hui) ; pas de calque d'opacité, qui changerait l'empilement des objets de la carte.
3. **Partie 3.** Sources déplacées dans `outils/champ/` avec un script `rendre.mjs` qui refait les images par le Chrome sans fenêtre du banc (même moteur que l'application, donc le rendu le plus fidèle, sans dépendance neuve) ; WebP par thème en deux cadrages (image entière pour ordinateur et téléphone tourné, bande centrale que `cover` montre déjà pour le téléphone en portrait) ; `AppShell.css` et `StatisticsPage.css` ; planche avant/après hors dépôt (`D:\gong tracker\atelier\`), SVG à gauche et WebP à droite, jour et nuit, tailles téléphone et ordinateur, poids affichés ; ouverte par `cmd /c start`, le paquet continue sans attendre (consigne de l'utilisateur), signalée à l'arrêt.

## Vérification

`npm run verif`. Banc contre HEAD : `carte-direct`, `carte-perf`, `library`, `partage`, `profil` (texte identique) ; `fluidite-compile` avant et après pour la carte (dire la durée avant de lancer : mémoire « mesures longues »). Aucun essai au téléphone demandé ; l'utilisateur verra la trace et le fond sur la prochaine APK.

## Mesures du 15/11 (avant, après)

- Tracés par dessin de la carte, trace d'une heure à 5 Hz (`carte-perf`, compteur de tracés du canevas) : 11 444, puis 1 948. Dix déplacements de la carte : 0,060 s de script, puis 0,017 s ; dix zooms : 0,307 s, puis 0,250 s (serveur de développement, ordinateur, script joué seul).
- Police Inter dans le paquet : 221 304 octets, puis 96 744 (woff2 seul).
- Fond de page dans le paquet : deux SVG, 674 ko bruts et 252 ko compressés, puis quatre WebP, 1 379 ko (non compressibles). APK entière : 5,56 Mo (0.00.86), puis 6,60 Mo (0.00.96), soit environ 1 Mo de plus tout compris. Dessin du fond à l'ouverture : 83 à 93 ms, puis environ 41 ms ; rotation aller-retour : 179 à 215 ms, puis environ 48 ms (navigateur sans fenêtre, écran de téléphone simulé ; le ralentissement du processeur ne touche pas ces fils de dessin). L'allègement de 700 ko annoncé par la fiche est démenti : question Q118.
- Ouverture d'une session de voile d'une heure à 5 Hz, version compilée (`fluidite-compile`) : trace rendue en 0,359 s puis 0,353 s à vitesse normale, 1,640 s puis 1,608 s processeur ralenti six fois : inchangé au bruit près, cette mesure ne déplaçant pas la carte.
- Écarté : l'allègement des lignes hors écran de la page Sessions (voir la fiche 404).
- Remarque de l'utilisateur devant la planche : des points visibles à chaque changement de couleur sur le fond sombre ; ils sont dans le dessin d'origine (élément 406).
