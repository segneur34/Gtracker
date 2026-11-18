# 439 · Surf : la zone du pic sort ronde et le retour au pic ne colle pas au vécu

| Modèle | Réflexion |
|---|---|
| Fable | high (plan par l'agent `Plan` d'abord ; une partie peut passer sur Opus si le plan la juge à sa portée) |

## Tel que dit (18/11, sur l'APK 0.01.27, sessions réelles)

- Essai 298 (lot 436 : « les retours au pic collent-ils à ce que vous avez vécu ? ») : « non ».
- Lot 437 (la zone sur la carte) : « elle a pas la bonne forme ». Puis : « pour ce qui est de la zone de vague, il faudrait avoir une zone oblongue. Actuellement, les rondes. Donc ça va pas du tout. »
- Retour au pic, redit : « l'idée, c'est qu'il faut partir de la fin d'une vague qui est prise et regarder à partir de quand on retourne, en gros, dans la zone du pic, quoi. Et à partir de là, on enlève l'attente. »
- Demande : le confier à Fable, avec la détection des vagues (élément 440) et l'algorithme des virages (élément 424).

## Aujourd'hui (lots 436 A et B, 437, commits 2cedaa0, 008a197, 9128482)

- `src/surfing/waveSense.ts` : sens des vagues = moyenne vectorielle du déplacement des 5 premières secondes de chaque glisse, pondérée par la longueur ; `null` sous 4 mesures ou si R < 0,5.
- `src/surfing/peakZone.ts` : ellipse des départs, petit axe le long du sens, grand axe au moins 1,5 fois le petit, marge 15 m ; sans sens : axe principal des départs (3 au moins), sinon un **cercle** ; départs à plus de 40 m vers la plage écartés seulement si le sens est connu.
- `returnOf` (`surfAnalysis.ts`) : retour = fin de glisse → entrée dans la zone (sur le segment) ; l'attente n'y entre pas.
- La définition redite par l'utilisateur est donc celle du code : l'écart vient de la zone elle-même (forme, place, taille), pas de la règle de mesure. À vérifier avant de rien changer.

## Pistes de Claude, non vérifiées (à confirmer sur les sessions réelles avant tout code)

1. **Sens perdu en surf** : sur une vague, le surfeur part vers la plage puis tourne le long de la vague ; sur 5 s, le déplacement peut être surtout latéral. Gauches et droites mêlées se compensent (R faible → `null`, repli sur l'axe des départs ou le cercle) ; que des gauches (ou que des droites) donnent un « sens » le long de la plage, faux de 90°, et la zone s'allonge alors dans le mauvais axe.
2. **Cercle** : moins de trois départs, ou repli sans sens ; ou une zone si petite que la marge de 15 m domine et que le rapport 1,5 ne se voit plus à l'écran.
3. **Zone trop grande** : une seule zone pour la session, qui contient tous les départs (sauf ceux de l'intérieur, écartés seulement si le sens est connu) ; un départ loin du pic l'étire et raccourcit tous les retours.
4. Sens et zone n'ont jamais vu de session réelle : seules des traces synthétiques (départs étalés est-ouest, vagues vers le sud) les ont éprouvés.

## Premier geste : les données

Avant tout code, sur les sessions où l'essai 298 a été fait :
- récupérer la ou les sessions (GPX et fiche) depuis le téléphone (dossier `Documents/Gtracker`, par adb, téléphone branché) ou par l'utilisateur, et les ranger hors dépôt dans `D:\memoire Tracker\essais\439-zone-du-pic\` ;
- relever pour chacune : nombre de vagues et de départs, sens estimé (`directionDeg`, R, nombre de mesures) ou `null`, orientation retenue (vagues, départs, cercle), demi-axes, et les retours obtenus ;
- demander à l'utilisateur, en clair, ce qu'il a vécu (où était le pic, sens des vagues par rapport à la plage, temps de retour approximatifs) ;
- dire laquelle des pistes explique l'écart, puis seulement corriger.

## Voulu

- Une zone **oblongue** dans tous les cas où il y a des départs (jamais un cercle à l'écran), son grand axe le long de la ligne de déferlement (en travers du sens des vagues), à la place réelle du pic.
- Retour au pic : de la fin d'une vague prise au premier retour dans cette zone ; l'attente qui suit n'y entre pas (règle déjà en place, à garder).
- Le sens des vagues fiable en surf (gauches, droites, ou d'un seul côté) ; il sert aussi à l'élément 440 (orientation à la main).
- DECISIONS §4 (« retour au pic … première attente ») à amender à la passe de documentation.

## Contraintes

Règles 2, 3, 7 et 10 de `CLAUDE.md` ; tests sur traces synthétiques **qui reproduisent ce que les sessions réelles ont montré** ; les GPX réels restent hors dépôt.

## Essais au téléphone

- Les mêmes sessions qu'à l'essai 298 → zone oblongue, en travers des vagues, sur le pic ; retours au pic qui collent au vécu.

## Pour la conversation Fable (préparé le 18/11)

Conversation neuve sur Fable, effort high (questions de produit ouvertes au 440), ouverte dans ce dépôt ; coller :

> /chaine Enchaîne 439, puis 440, puis 424 : le chantier surf confié à Fable le 18/11 (détection et orientation des vagues, zone et retour au pic, virages). Lis d'abord les fiches 439 et 440 et la ligne 424. Premier geste du 439 : récupérer les sessions réelles où l'essai 298 a raté (sur le téléphone par adb s'il est branché, sinon me les demander), relever sens, zone et retours, et me demander ce que j'ai vécu avant tout code. Le 440 a des questions de produit et une planche (flèche du sens sur la carte) : pose-les-moi avant de le coder. Le 424 se reprend sur les mêmes sessions. Un lot clos avant d'ouvrir le suivant, une seule APK à la fin.
