# 438 · Surf : vagues et remontées au téléphone, un cadre par ligne (dessin D)

| Modèle | Réflexion |
|---|---|
| Sonnet | medium |

## Tel que dit (18/11)

Devant la planche du 17/11 au soir (vagues au téléphone, quatre dessins), après la validation du dessin A ce matin (essai 295) : « pour les vagues je dirais : D ». Confirmé par l'utilisateur le même jour : D pour le tableau des vagues **et** pour celui des remontées de l'onglet rame (lot 435), pour que les deux se ressemblent. Le trait au pinceau entre deux activités de Réglages reste (lot 428), ainsi que les traits noirs de l'activité dépliée et des listes de la voile.

## Aujourd'hui

`src/pages/SurfModule.tsx` : sur téléphone, les deux tableaux (vagues, onglet vagues ; remontées, onglet rame) suivent le dessin A du lot 434 : tableau natif, intitulés courts une fois en haut (`an-wave-long`, `an-wave-short`), une ligne par vague ou remontée, trait à l'encre entre deux lignes, unité dite une fois au-dessus (`an-wave-unit`), classes `an-man-podium an-man-podium--waves`.

## Voulu : le dessin D de la planche, sur téléphone seulement

Planche hors dépôt : `D:\gong tracker\atelier\planche-434-428\index.html`, section « D · Un cadre par vague » ; son style et son script d'essai sont dans le dossier des variantes de la planche (fichiers D en css et en js, à lire, pas à recopier tels quels : ils forcent par `!important` et réécrivent le texte en JS, le code le fait proprement en JSX et en CSS).
- Chaque vague dans son petit cadre fin à l'encre (1 px, `--ink`), coins `--radius-m`, fond `--surface`, 8 px entre deux cadres ; plus de trait entre les lignes : le cadre sépare.
- En titre du cadre : « Vague 3 · 09:05 » (numéro et heure), en gras, et le bouton « Voir » à droite sur la même rangée.
- Dessous, une rangée serrée de valeurs, chacune avec son petit intitulé au-dessus (Durée, Dist., Max, Moy., Vir., et Vol sur foil), en colonnes égales ; intitulé en `--muted`, `--text-xs`.
- Plus d'en-tête de tableau ; l'unité reste dite une fois au-dessus (« Max et moy. en {unit} »).
- Remontées, même dessin : titre « Après la vague 3 » (ou « Départ » pour la première sortie, le mot « enchaîné » gardé dans la valeur du retour), « Voir » à droite, puis Retour, Dist., Rem., Rame, Att. ; l'unité au-dessus comme aujourd'hui (« Remontée et rame en {unit} »).
- Valeurs en variables du thème (`tokens.css`), aucun `style={{` neuf ; textes par `t()`, clés neuves dans `en.json` et `es.json`.

Rien ne change sur ordinateur (tableaux d'aujourd'hui), ni dans les chiffres, ni le tri des vagues s'il existe au téléphone (le garder accessible).

## Vérification

- `npm run verif` ; banc du surf identique avant et après sur ordinateur.
- Rendu relevé par l'orchestrateur sur une copie compilée à 390, 360 et 320 px, de jour et de nuit, avec et sans foil, vagues et remontées : rien de rogné, aucun défilement de côté à 390 et 360.
- Validé sur lecture si le rendu est relevé.
