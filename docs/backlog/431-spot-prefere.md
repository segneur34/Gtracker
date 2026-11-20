# 431 · Profil : encart « Spot préféré » accroché au cadre des sports préférés

Modèle | Réflexion : Opus | high.

Demande : `node outils/backlog.mjs --ligne 431`. Planche du 20/11 : `D:\gong tracker\atelier\planche-431-432\431.html` (images dans `images-431\`, CSS et HTML de la variante B dans `outils-431\variantes\spot.css` et `spot.mjs`, à reprendre comme point de départ, pas tels quels).

## Choix de l'utilisateur (20/11, devant la planche)

« plutôt B mais un peu plus bas et avec le contour style coup de pinceau pour le spot » : la variante B (une languette à cheval sur le bord haut du cadre « Activités favorites », en haut à droite, le cadre ne grandit pas), avec deux retouches :
- la languette descend un peu : elle mord davantage sur le cadre (à peu près moitié dehors, moitié dedans, au lieu d'être presque toute au-dessus), sans toucher le titre « Activités favorites » ni la rangée des sports ;
- son contour est un vrai coup de pinceau, du même dessin que le cadre (`BrushFrame`, trait fin ou moyen, même couleur que le cadre), pas l'ovale lisse des boutons de la planche.

## Contenu de l'encart

- Intitulé « Spot préféré » (petites capitales grises, avec le petit repère de lieu en trait, comme sur la planche), le nom du lieu en gras, « 12 sessions » en gris (`tn` pour le pluriel).
- Le lieu : celui qui revient le plus parmi les sessions de la période choisie (la même liste que les sports préférés : `ProfilePage.tsx`, `inPeriod`), compté par nom exact du lieu de départ (`record.place`, `SessionPlace`, `library/record.ts` ; `place.name`, pas `placeLabel`, qui dit « Départ → Arrivée »). À égalité : le lieu de la session la plus récente.
- Défauts de l'orchestrateur : le nom tel que les sessions le portent (il n'existe pas de « nom court » dans les données) ; un nom long passe sur deux lignes au plus, puis se coupe par des points de suspension ; l'encart est caché quand aucune session de la période n'a de lieu ; aucune carte, aucun emoji, aucun vert vif, la couleur d'activité ne porte pas de texte (DECISIONS §12).

## Pièces en place

- Cadre : `src/components/ProfileFavorites.tsx` (section `.profile-favs`, rangée `.profile-favs__row`) et `ProfileFavorites.css` (téléphone sous 600 px) ; appelé par `ProfilePage.tsx` avec `frames.favs` (`brushFrame(0, brushColor)`, classes `brush-frame brush-frame--bd`) ; trait peint dans `src/components/BrushFrame.css` (masque `::before`, `--brush-pad-*` ; le cadre est `position: relative`, une languette en absolu y tient). Le cadre fait environ 350 px sur téléphone, 550 px sur ordinateur.
- Sur la planche, la languette avait un fond opaque `var(--bg)` qui interrompt le trait du cadre et masque le dessin du fond de page derrière elle : garder l'interruption nette du trait du cadre sous la languette, et vérifier le rendu sur le fond dessiné, clair et sombre.

## À faire

1. Calcul pur du spot préféré (dans `src/library/`, à côté de ce qui compte les sports préférés s'il y a lieu), avec son test : lieu le plus fréquent, égalité, sessions sans lieu, liste vide.
2. Encart dans `ProfileFavorites` (ou un composant voisin), styles dans le `.css`, variables de `tokens.css`, aucun `style={{`.
3. Textes par `t` / `tn`, dictionnaires anglais et espagnol.
4. Rendu à relire par toi sur capture avant de rendre la main : téléphone 390 px et ordinateur 1280 px, clair et sombre, nom court (« Carnon ») et long (« Saint-Pierre-la-Mer », « Plage du Petit Travers »), par une copie compilée servie à part (`npx vite build --outDir` vers `D:\gong tracker\atelier\planche-431-432\site-431`, serveur sur le port 4210, Chrome sans fenêtre sur 9495, fonctions de `outils/banc/lib/`, exemples dans `D:\gong tracker\atelier\planche-431-432\outils-431\` : `base.mjs`, `capture.mjs`). Images dans `D:\gong tracker\atelier\planche-431-432\images-431\lot-*.png`. Jamais les ports du banc (4195, 4196, 9480) ; jamais `chrome.exe --version`.

## Banc

Script `profil` (texte de la page : l'encart ajoute « Spot préféré », le lieu et son nombre de sessions quand les sessions d'essai ont un lieu ; sinon identique).

## Passe de doc (après validation)

DECISIONS §9 (Profil) : l'encart, sa règle de compte, son dessin.
