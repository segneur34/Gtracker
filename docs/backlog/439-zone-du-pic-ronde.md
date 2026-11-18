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

## Relevé du 18/11 sur les sessions réelles (premier geste fait)

Sessions tirées du téléphone par adb, hors dépôt (`D:\memoire Tracker\essais\439-zone-du-pic\`, relevés `releve.txt` et `releve-bis.txt` à côté). Le téléphone n'a que trois sessions de surf ; une seule a des vagues.

- **Sup foil du 14/10** et **Paddle foil du 16/11 à 14 h 26** : aucune vague à aucun seuil essayé, donc ni sens ni zone. Rien à en tirer pour ce lot, ni pour l'essai 299.
- **Paddle du 16/11 à 15 h 32** (Akila LGM, seuil de la session 6 km/h) : 2 vagues, vers le nord (caps 354° et 355°), de 43 m et 52 m, parties à 125 m l'une de l'autre le long de la plage.
  - Sens : `null` (2 mesures, il en faut 4). Zone : **cercle de 77 m de rayon** (2 départs, il en faut 3 pour un axe) : la piste 2, pas la piste 1.
  - Retour après la vague 1 : **0 s**. La vague finit à 41 m de son départ, encore dans le cercle. Dans la trace, il remonte pourtant pendant 1 min 30 environ jusqu'à l'endroit où il attend.
  - Zone oblongue simulée avec le sens des deux vagues (354,5°) : 97 × 38 m, et le retour reste à **0 s**. Les deux départs sont décalés de 28 m le long du sens des vagues, la marge de 15 m s'y ajoute, et la fin de la vague 1 (27 m vers la plage) reste dedans.
  - Où il attend : 30 à 45 m **au large** des points de départ (le départ compté est l'instant où la vitesse passe le seuil, après la rame de départ). La zone faite des seuls départs est donc décalée vers la plage par rapport à l'endroit où il attend.
  - Avec un seuil à 5 km/h, 4 vagues : sens 20° (R 0,97), zone « vagues » de 98 × 49 m, retours de 36 s, 0 s et 0 s.

Ce que cela dit :
1. Sous 4 vagues il n'y a pas de sens, sous 3 pas d'axe : une petite session donne toujours un cercle. Le sens doit s'estimer dès la première vague.
2. Même oblongue, la zone est trop épaisse et mal placée pour des vagues courtes : faite des points où la vague est prise, élargie de 15 m, elle contient la fin de la vague.
3. Pistes 1 (sens faux de 90°) et 4 non vues ici : une seule session, deux vagues droites. À rejuger sur une session de surf à gauches et droites, qui manque.

### Réponses de l'utilisateur (18/11)

1. C'est bien cette session (Paddle du 16/11 à 15 h 32) qu'il a regardée ; pas d'autre session à vagues.
2. Retour après la vague 1 : « un peu moins » que 1 min 30, « mais ça ressemble à ça ». Cible : de l'ordre de 45 s à 1 min 15, jamais 0 s.
3. Le pic est l'endroit **où on prend la vague**, « et du coup juste en dessous de là où on attend, plus ou moins » (il précise qu'il n'est pas surfeur). La zone reste donc faite des départs, pas des attentes.
4. Une seule zone : « d'où la forme oblongue, le pic est parallèle à la plage et jamais au même endroit ». La zone s'allonge le long de la plage pour couvrir tous les départs.
5. Limite de trois lots en attente levée pour le paquet 439, 440, 424.

### Direction retenue par Claude (à confronter au plan)

- **Jamais de cercle** dès qu'il y a une glisse : le sens des vagues s'estime dès la première (la contrainte de 4 mesures tombe pour orienter la zone ; elle peut rester pour écarter les remontées pompées sur foil, où une erreur coûte plus cher : au plan de le dire).
- **Axe de la zone = la ligne des départs** quand ils s'étalent (ici cap 98°, 125 m), bornée autour de la perpendiculaire au sens des vagues ; sinon (un seul départ, ou départs groupés) la perpendiculaire au sens. La ligne des départs dit mieux « parallèle à la plage » que la perpendiculaire aux vagues, qui se surfent souvent en biais.
- **Zone mince** : son épaisseur ne vient que de la marge et de l'écart des départs à leur ligne, pas de leur décalage le long du sens des vagues. Sur la session réelle, avec l'axe à 98° : environ 100 × 20 m, la fin de la vague 1 est à 40 m de l'axe, donc dehors, et le retour redevient mesurable.
- Critère d'acceptation sur la session réelle (hors dépôt, relevé à la main) : zone oblongue le long de la plage, retour après la vague 1 entre 30 s et 1 min 30. Dans le dépôt : une trace synthétique qui reproduit cette session (2 vagues courtes vers le nord, départs à 125 m l'un de l'autre et décalés de 28 m, attente 30 à 45 m au large).

## Plan retenu (18/11, agent `Plan`, tranché par l'orchestrateur)

Constat du plan : l'interface ne lit nulle part `PeakZoneOrientation` (seuls les tests) ; le `summary` de la bibliothèque ne contient aucun retour : `SUMMARY_CALC_VERSION` ne bouge pas, à condition que le nombre de vagues sur foil ne change pas.

**Partie A, neutre (Sonnet/medium)** : `src/surfing/waveSense.ts`, `surfAnalysis.ts` et leurs tests.
- `estimateWaveSense` ne rend `null` que sans aucune mesure ; sinon `{ directionDeg, R, samples, reliable }`, `reliable = samples >= WAVE_SENSE_MIN_WAVES && R >= WAVE_SENSE_MIN_R` (les deux constantes restent).
- `isAgainstWaveSense` n'est appelé dans `analyzeSurf` que si le sens est fiable : le compte des vagues sur foil ne change pas.
- Dans cette partie, `buildPeakZone` ne reçoit encore que le sens fiable (sinon `null`) : aucun chiffre ne change. Seuls les attendus `toBeNull` du sens deviennent `reliable === false`.
- En-têtes de `waveSense.ts` et de `surfAnalysis.ts` mis à jour.

**Partie B, la géométrie (Opus/high)** : `src/surfing/peakZone.ts` et son test, `surfAnalysis.ts` (le sens utilisable passe à la zone) et son test.
- Sens utilisable pour la zone : au moins une mesure et `R >= WAVE_SENSE_MIN_R` (une seule vague : R = 1).
- Règle des départs de l'intérieur (`ZONE_INSIDE_M`) : gardée, seulement avec un sens utilisable, appliquée avant le calcul de l'axe.
- Axe : l'axe principal des départs gardés (dès 2 points) quand leur étendue le long de cet axe atteint `ZONE_LINE_MIN_M` = 30 m, borné à `ZONE_MAX_TILT_DEG` = 45° de la perpendiculaire au sens (au-delà : la perpendiculaire). Départs groupés ou départ unique : la perpendiculaire au sens, avec l'allongement `ZONE_MIN_ASPECT`. Sans sens utilisable : la ligne des départs, sans borne ; ni sens ni ligne (un départ, points confondus) : ellipse d'allongement minimal sur un axe conventionnel est-ouest. **Jamais de cercle.**
- Zone mince : grand demi-axe = demi-étendue le long de la ligne + marge ; petit demi-axe = demi-étendue de part et d'autre de la ligne + marge. Le gonflement `k` sur les deux axes est retiré : si un départ sort de l'ellipse, seul le petit axe grandit, juste assez.
- Marge côté plage réduite, tranchée par l'orchestrateur sur la session réelle : 15 m côté large, `ZONE_BEACH_MARGIN_M` = 5 m côté plage (centre décalé vers le large), seulement quand le sens est utilisable ; sans sens, 15 m des deux côtés. Mesuré sur le Paddle du 16/11 (zones posées à la main, `releve-ter.txt`) : au seuil de 6 km/h, retour après la vague 1 de 45 s en symétrique et 55 s avec 5 m côté plage, tous deux dans la cible ; au seuil de 5 km/h (4 vagues), 52 s, 0 s, 0 s en symétrique contre 69 s, 33 s, 0 s avec 5 m : la marge réduite avale moins de fins de vague.
- `PeakZoneOrientation` devient `'ligne' | 'vagues' | 'departs'` (ligne bornée par le sens, perpendiculaire au sens, ligne sans sens).
- Constantes nommées et commentées, dans `PeakZoneOptions` : `zoneLineMinM`, `zoneMaxTiltDeg`, `zoneBeachMarginM`.
- Tests : le cas qui reproduit la session réelle, à 1 Hz, 5 Hz et un pas de 4 s (2 vagues au cap 354° de 43 et 52 m, départs à 122 m l'un de l'autre vers l'est et décalés de 28 m le long du sens, retour vers le large jusqu'à 35 m au-delà des départs à 0,9 m/s ; attendus : `'ligne'`, axe 98° ± 5, fin de la vague 1 hors zone, retour après la vague 1 entre 30 et 75 s, `waveSense.reliable` faux) ; gauches et droites mêlées (axe à moins de 15° de la plage) ; une seule vague (ellipse en travers, jamais ronde) ; vagues toutes en biais du même côté, sens faussé de 50° (axe à moins de 10° de la plage) ; les attendus existants recalibrés, chacun justifié par la construction de sa trace.
- Prêt pour le 440 : une seule variable `waveSense` dans `analyzeSurf`, qui sert à la zone et aux remontées pompées ; un sens saisi s'y écrira `{ directionDeg, R: 1, samples: 0, reliable: true }`.

**Partie C, le banc (Sonnet/medium)** : `outils/banc/surf.mjs` (matinée, l.180-186 : commentaire « trois vagues ne disent pas le sens » et valeurs 54 s / 11 s à reprendre des tests de la matinée), passage noté dans `outils/banc/SCRIPTS.md`.

À la passe de documentation, après validation : `docs/DECISIONS.md` §4, `docs/ETAT_DU_PROJET.md` (surf, zone du pic), `docs/INVENTAIRE.md` (`waveSense`, `peakZone`).

## Résultat sur la session réelle, après les parties A et B (18/11, `releve-apres.txt`, hors dépôt)

Paddle du 16/11 à 15 h 32, recalculé par le code du lot :
- seuil de la session, 6 km/h : zone « ligne », grand axe à 98°, 153 × 20 m (cercle de 77 m de rayon avant) ; les deux vagues finissent hors de la zone ; retour après la vague 1 de **55 s** (0 s avant) ; première sortie 6 min 20 ;
- seuil par défaut, 9 km/h : zone 156 × 20 m, retour de 47 s ;
- seuil de 5 km/h, 4 vagues dont deux très molles : zone 152 × 72 m (les départs s'écartent de 17 m de leur ligne), retours de 53 s, 30 s et 0 s.

Tranché par l'orchestrateur :
- la borne de 45° autour de la perpendiculaire au sens est gardée : des vagues toutes prises en biais du même côté à plus de 45° calent la zone sur la perpendiculaire à ce sens faussé, pas sur la plage ; le sens saisi à la main du 440 y répondra ;
- relecture, un seul défaut, de commentaire : sur la perpendiculaire au sens (départs groupés ou étalés vers le large), le décalage des départs le long du sens épaissit la zone ; c'est voulu, la zone contient tous les départs gardés (« s'agrandit pour faire rentrer tous les départs »), et l'en-tête de `peakZone.ts` le dit maintenant.

Banc (partie C) : `surf.mjs`, matinée, retours de 54 s et 11 s devenus 27 s et 29 s, passage seul réussi, console vide. Écart relevé et non élucidé : le test unitaire du même scénario donne 15,6 s pour le premier retour, là où le banc et le test s'accordaient avant le lot (54 s et 55 s). Cause supposée par l'orchestrateur, non vérifiée : dans le test, le troisième départ est à 39 m vers la plage, à 1 m du seuil des départs de l'intérieur (40 m) ; la trace du banc, relue du GPX et lissée, peut le faire passer de l'autre côté, ce qui amincit la zone. À vérifier si un chiffre de retour paraît faux sur une session réelle.

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
