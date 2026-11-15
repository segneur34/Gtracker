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

## Vérification

`npm run verif`. Banc contre HEAD : `carte-direct`, `carte-perf`, `library`, `partage`, `profil` (texte identique) ; `fluidite-compile` avant et après pour la carte (dire la durée avant de lancer : mémoire « mesures longues »). Aucun essai au téléphone demandé ; l'utilisateur verra la trace et le fond sur la prochaine APK.
