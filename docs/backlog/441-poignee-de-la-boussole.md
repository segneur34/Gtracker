# 441 · Boussole de réglage : la poignée hors du cercle (vent et vagues)

| Modèle | Réflexion |
|---|---|
| Sonnet | medium (dessin choisi sur planche ; pas de plan) |

## Tel que dit (18/11, sur l'APK 0.01.33)

« Actuellement, le rond est sur la flèche, qu'on est censé déplacer pour mettre le sens des vagues. Donc je pense qu'il faudrait, je sais pas comment faire, le rond à l'extérieur du cercle avec nord, sud, est, ouest, comme ça on verrait mieux la flèche. Et je pense que c'est valable aussi pour le vent d'ailleurs. »

## Aujourd'hui

`src/components/CompassAdjustOverlay.tsx`, pièce commune du vent de la voile (`WindAdjustOverlay.tsx`, flèche du bord vers le centre) et du sens des vagues du surf (`surf/WaveSenseOverlay.tsx`, flèche du centre vers le bord). Cadran en SVG, `viewBox` 200 × 200, cercle de rayon 98 ; poignée : disque rouge #d32f2f de rayon 11, liseré blanc de 3, à 78 du centre, donc sur la flèche, que le doigt cache.

## Planche (hors dépôt, faite le 18/11)

`D:\gong tracker\atelier\planche-440\index.html`, section « La poignée de la boussole » ; valeurs dans `variantes.md` à côté ; images `images\poignee-vagues-*.jpg` et `images\poignee-vent-*.jpg`, envoyées à l'utilisateur le 18/11. Quatre dessins, pour les vagues et pour le vent :
- **P1** (recommandé) : le rond juste à l'extérieur du cercle (centre à 98 + 14), la flèche entière dedans ;
- **P2** : le rond à cheval sur le cercle (centre à 98), la flèche des vagues raccourcie ;
- **P3** : un anneau à l'extérieur (98 + 16), relié au bout de la flèche par un petit trait ;
- **P4** : P1 avec un rond plus gros (rayon 16), plus facile à attraper au doigt.
Le `viewBox` passe de 200 à 256 (272 pour P4) pour que rien ne soit rogné ; le cercle garde sa taille à l'écran, le dessin passe de 260 à 333 px (354 pour P4) et tient dans 390 px. Les images sont un dessin retouché dans la page, pas le code : le tirage de la poignée n'y a pas été essayé.

**Choix de l'utilisateur, le 18/11 au soir : P2**, le rond à cheval sur le cercle (images revues, planche rouverte). Valeurs de la planche pour P2 (`variantes.md`) : disque #d32f2f de rayon 11, liseré blanc de 3, centre sur le trait du cercle (à 98 du centre) ; flèche des vagues raccourcie pour ne pas passer sous le disque (pointe à 72, base à 56) ; flèche du vent de 80 à 12 ; `viewBox` `-28 -28 256 256`, élément de 333 px, le cercle restant à 260 px.

## Voulu

- La poignée hors du cercle, d'après le dessin choisi, pour le vent comme pour les vagues ; la flèche se voit en entier pendant qu'on tire.
- Le tirage reste juste : l'angle suit le doigt, que la poignée soit à l'intérieur ou à l'extérieur du cercle ; la zone sensible ne passe ni sous le bandeau du réglage ni hors de l'écran à 390 px, ni sous la barre « Non enregistré » posée sous le bandeau.
- Le rendu de la voile change : l'instantané de `src/components/WindAdjustOverlay.test.tsx` est mis à jour en connaissance de cause (dire ce qui change), et `outils/banc/general.mjs` et `surf.mjs`, qui tirent la poignée à une position calculée, sont adaptés (partie à part).
- Rendu relevé sur une copie compilée à 390 px, vent et vagues, bandeau sur une et deux rangées, avec la barre du brouillon.

## Joint à ce lot : l'élément 443

En voile sur téléphone, pendant le réglage du vent en plein écran, le bas de la polaire passe sous la barre de navigation (vu le 18/11 sur une copie compilée à 390 × 844 : la polaire va de 660 à 820 px, la barre de navigation commence vers 780 px ; non vérifié sur le téléphone, ni daté). Mêmes fichiers que la poignée (la boussole et sa mise en page sur téléphone), et le dessin agrandi déplace ce qui est dessous : à relever d'abord à 390 px, avant et après la poignée, puis à corriger si le défaut est confirmé ; voulu : la polaire entière au-dessus de la barre de navigation.

## Essai au téléphone

Régler le vent d'une session de voile et le sens des vagues d'une session de surf : le rond s'attrape bien, la flèche se voit pendant qu'on tire.
