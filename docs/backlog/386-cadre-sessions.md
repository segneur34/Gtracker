# 386 · Sessions : un cadre fin au pinceau autour de chaque session

Modèle | Réflexion : Sonnet | medium

## Demande (15/11)

« ajouter un cadre fin de même épaisseur que sur les réglages autour des sessions dans Sessions, adapté à la couleur de l'activité. Forcément sous forme de pinceau, de coups de pinceau avec […] un angle qui est ouvert, etc. Enfin, même DA que les autres quoi. »

## Attendu

- Page Sessions (`src/pages/SessionsPage.tsx`, `src/components/SessionRow.tsx` et leurs CSS) : chaque ligne de session est dans un cadre en un coup de pinceau.
- Même épaisseur que les cadres de Réglages : le trait « très fin » (`brush-panels--hair` de `src/components/BrushFrame.css`, 3 px ; voir `src/pages/SettingsPage.tsx`, DECISIONS §11 « Cadres de Réglages »).
- Couleur : celle de l'activité de la session, la même que sa pastille, thème clair et sombre compris (les cas particuliers de couleur, dont le blanc cerclé, sont déjà traités pour les autres cadres : `src/core/brushColor.ts`, `src/hooks/useFavoriteBrush.ts` ; réutiliser, ne pas recopier). Une session dont l'activité est supprimée prend la couleur de son calcul, comme sa pastille.
- Angle ouvert qui tourne d'une ligne à la suivante, comme partout (`brushFrame(index, color)` de `src/components/brushFrame.ts`).
- À l'intérieur du cadre, le voile de la page (`--field-veil`) reste, pour le contraste du texte (DECISIONS §11 « Fonds de page »).
- Les cadres ne se touchent ni ne se chevauchent : un blanc entre deux lignes ; le « … », la vignette de la trace et le contenu de la ligne gardent leur place ; rien ne déborde à 320 px ni sur ordinateur (même page en large).
- Seulement la liste des sessions de la page Sessions. Si la même pièce sert ailleurs (liste des itinéraires, « Suivre une trace », import), ces listes ne changent pas : le dire dans le rapport si un choix a dû être fait.
- Liste longue (plus de cent lignes) : le défilement doit rester fluide. Dire dans le rapport comment le cadre est dessiné (masque, image, trait) et s'il y a un risque de coût par ligne ; ne rien inventer de neuf si la pièce existante suffit.
- Réglage « Économe » et tout autre réglage qui retire déjà les cadres au pinceau ailleurs : même comportement ici.

## Vérification

- Texte de la page Sessions identique avant et après (banc `library.mjs`, neutre).
- Aucun texte neuf, donc rien dans `src/locales/`.
