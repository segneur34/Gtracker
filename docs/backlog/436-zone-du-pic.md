# 436 · Surf : le pic devient une zone, et le retour au pic le temps d'y rentrer

| Partie | Modèle | Réflexion |
|---|---|---|
| Plan (agent `Plan`) | Opus | high |
| A : sens des vagues, et sur foil une remontée en pumping n'est plus une vague | Fable | high |
| B : zone du pic, et retour au pic = temps pour y rentrer | Fable | high (Opus si le plan la juge à sa portée, décision du 16/11 dans `docs/MODELES.md`) |
| C : la zone dessinée sur la carte | Sonnet | medium, après planche |

## Tel que noté

17/11 à 23 h 31 : « revoir la logique de retour au pic aussi ».

18/11, précisé : « le retour au pic il est juste un point sur la carte actuellement, il faut qu'à chaque fois qu'on a un départ en surf une zone se crée sur l'endroit où est le pic et s'agrandit pour faire rentrer tous les départs, elle doit être relativement perpendiculaire au tracé de vitesse des vagues prises et un peu oblongue. Et c'est le temps pour y re-rentrer en gros. Faire attention surf foil, et foil en général, de pas prendre une remontée en pumping pour une remontée descente en surf. Peut-être on peut mettre un système de calcul de sens de vague qui reprend celui du vent mais pour les vagues. »

## Aujourd'hui (lu dans le code le 18/11)

- `src/surfing/surfAnalysis.ts` : entre deux glisses, une remontée (`returnOf`). Le retour au pic va de la fin de la glisse au début de la **première attente** (immobile sous `stillMs`, 2 km/h, au moins `minWaitS` d'affilée) ; une glisse prise sans attente est « enchaînée », son retour vaut `null` et sort de la moyenne. La remontée (`returnSpeedMs`) est la distance à vol d'oiseau de la fin de la glisse à ce point, divisée par le temps. La première sortie (`after === 0`) va du premier coup de rame à la première attente.
- Le « pic » n'existe donc que comme un point par remontée, la première attente ; sur la carte, « Voir » d'une remontée montre le trajet jusqu'à ce point (`returnEnd`, `SurfModule.tsx`).
- Sur foil, les glisses sont des vols, les vagues d'un vol sont ses passages au-dessus du seuil de vague en foil (`waveMask`), le reste du vol est pompé. Rien ne regarde la direction : une remontée vers le large faite en vol, en pompant assez vite, passe au-dessus du seuil de vague et devient une « vague ».
- Le retour n'entre pas dans le résumé de la bibliothèque (`library/summary.ts`), mais le nombre de vagues sur foil peut y entrer (`surfRides`) : à vérifier au plan, avec `SUMMARY_CALC_VERSION` augmenté si la partie A change un chiffre résumé.
- Décision en place, DECISIONS §4 : « retour au pic : de la fin d'une vague à la première attente ». Elle change par la présente demande de l'utilisateur ; la passe de documentation l'amendera.

## Voulu

### 1. Le sens des vagues (partie A)

Un sens de déferlement estimé pour la session, comme le vent l'est en voile (`estimateWind`, `calculateWindStats`, règle 7 de `CLAUDE.md`) mais pour les vagues : un cap moyen, avec sa dispersion, tiré des vagues prises. Pistes à trancher au plan : moyenne circulaire du cap de chaque vague sur ses premières secondes (la descente, avant les virages), les gauches et les droites se compensant vers le cap de la plage ; ou cap de la corde départ → fin ; contrôle par les remontées, qui vont à l'opposé. Pondération par la durée ou la régularité plutôt qu'un filtre (comme le vent). Fonction pure dans `surfing/`, son test sur trace synthétique, gauches et droites mêlées, à 1 Hz et 5 Hz.

Sur foil (surf foil, paddle foil, tout ce qui vole) : un passage au-dessus du seuil de vague dont le cap va **contre** le sens des vagues (vers le large, vers le pic) n'est pas une vague : c'est une remontée en pumping. Il reste dans le vol, compté pompé, et ne compte ni dans les vagues ni dans leurs chiffres. Le critère se juge en angle au sens des vagues, avec une constante nommée (une vague prise en biais reste une vague). Le plan dit ce qui arrive quand le sens n'est pas estimable (trop peu de vagues, dispersion trop large) : par défaut, rien n'est écarté, comme aujourd'hui.

### 2. La zone du pic (partie B)

- Chaque départ de vague (le début d'une vague, tel que le calcule le lot 423) est un point de la zone. La zone s'agrandit pour les faire tous rentrer : « faire rentrer tous les départs ».
- Forme : oblongue, son grand axe **à peu près perpendiculaire** au sens des vagues (le pic s'étale le long de la ligne de déferlement), un petit axe plus court. Ellipse ou rectangle arrondi : au plan. Une marge minimale en mètres (constante nommée) pour qu'une zone d'un seul départ ne soit pas un point, et qu'un départ au bord ne soit pas « hors zone » pour quelques mètres de bruit GPS.
- Zone de la session entière (une seule zone), sauf si le plan juge qu'une zone qui grandit au fil de la session (les départs passés seulement) colle mieux à « à chaque fois qu'on a un départ, une zone se crée et s'agrandit » ; par défaut de Claude : la zone de la session entière, plus simple à lire et la même pour chaque remontée. Question mineure, à trancher par l'orchestrateur et à noter ici.
- **Retour au pic** = de la fin d'une vague (ou d'un vol sur foil) au premier instant où la trace **rentre dans la zone**. Plus besoin d'une attente. La remontée (vitesse) se mesure jusqu'à ce point d'entrée.
- Une vague prise sans être rentrée dans la zone (vague de l'intérieur, reprise en chemin) : son retour est « enchaîné » comme aujourd'hui et sort de la moyenne ; à confirmer au plan.
- La première sortie : du premier coup de rame à la première entrée dans la zone.
- Attente et temps d'attente restent ce qu'ils sont (immobilité) : seule la mesure du retour change.

### 3. Sur la carte (partie C)

La zone se dessine sur la carte de l'analyse surf, dans l'onglet rame (et quand on montre une remontée, son trajet jusqu'au point d'entrée). Le dessin (couleur, trait, remplissage, de jour et de nuit) passe par une planche d'abord (garde « Maquette d'abord » de `/chaine`) : la forme et l'orientation sont celles que l'utilisateur a dites, le reste se montre. Composant maison sur `leaflet` (règle 11), style stable. Les parties A et B ne changent que des chiffres et peuvent partir sans attendre la planche.

## Contraintes

- Règles 2 et 10 : tout en secondes et en mètres, jamais en nombre de points ; cadence variable (un pas de plusieurs secondes peut sauter le bord de la zone : l'entrée se calcule sur le segment, pas seulement aux points).
- Règle 3 : constantes nommées et commentées (marge de la zone, rapport des axes s'il est fixe, angle « contre le sens des vagues ») ; pas de seuil neuf dans `SPORT_PROFILES` sans raison.
- Règle 7 : ne pas réintroduire la polaire glissante ni la corde entrée → sortie **pour le vent** ; le sens des vagues est un calcul neuf du surf, qui peut s'inspirer de `calculateWindStats` (pondération plutôt que filtre) sans le toucher.
- Lien avec les lots 423 (début des vagues, à valider, essai 293) et 432 (départ de chaque vague, attend le 423) : la zone prend les débuts de vague tels que le code les calcule au moment du lot ; si le 423 est repris, la zone suit sans retouche. Le 436 ne dépend pas de la validation du 423.
- Recalcul : les chiffres de retour changent pour toutes les sessions de surf ; si la partie A change un chiffre résumé (nombre de vagues sur foil), `SUMMARY_CALC_VERSION` augmente et `summaryFrozen.test.ts` se refige en le disant.
- Aucun GPX réel dans le dépôt : traces synthétiques (un pic, des vagues gauches et droites, des remontées à la rame, des remontées en vol pompé sur foil, une vague de l'intérieur) ; validation par l'utilisateur sur ses sessions.

## Vérification

- Tests purs des parties A et B, neutralité des traces existantes là où le sens ou la zone ne changent rien.
- `npm run verif`, `relecture` (lot Fable), banc du surf avant et après (le texte de l'onglet rame change : différence attendue, à décrire).

## Essais au téléphone (à graver par `fin-de-lot`)

- Une session de surf (ou de paddle surf) : onglet rame → le retour au pic de chaque vague est le temps pour revenir dans la zone du pic, la zone se voit sur la carte, oblongue et en travers des vagues, et tous les départs sont dedans ; dire si les temps collent à ce qui a été vécu.
- Une session de surf foil ou de paddle foil avec des remontées en vol → les remontées pompées ne sont plus comptées comme des vagues.

## Plan du 18/11 (agent Plan, Opus high), parties A et B

### A : sens des vagues (Opus high, environ cinq points)

- Fichier neuf `src/surfing/waveSense.ts` et son test : `estimateWaveSense(track, starts, opts?)` rend `{ directionDeg, R, samples }` ou `null` (`R` : longueur moyenne de `circularMean`, `core/angles.ts`).
- Une mesure par glisse, sur sa première vague (sans foil, toutes les vagues ; sur foil, la vague qui lance le vol) : le déplacement sur les `WAVE_SENSE_WINDOW_S` = 5 s qui suivent le début remonté (lot 423), positions interpolées dans le temps (un seul long pas suffit). Moyenne vectorielle, chaque déplacement pesant sa longueur en mètres : pondération, aucun filtre. Écartés : la corde départ → fin (trop latérale), toutes les vagues sur foil (les remontées pompées tirent la moyenne vers zéro), le contrôle par les remontées (rame sinueuse).
- Sens non estimable sous `WAVE_SENSE_MIN_WAVES` = 4 mesures ou `R` < `WAVE_SENSE_MIN_R` = 0,5 : `null`, rien n'est écarté, comme aujourd'hui.
- Sur foil, dans `analyzeSurf`, en deux passes (vagues candidates de tous les vols, puis le sens, puis le filtre) : une vague dont la corde s'écarte du sens de plus de `WAVE_AGAINST_DEG` = 120° devient du temps pompé ; `waveS`, `pumpS`, `waveCount` recalculés, vagues renumérotées. Constantes nommées dans `waveSense.ts`, surchargeables par options pour les tests, rien dans `SPORT_PROFILES`.
- Exposé : `SurfAnalysis.waveSense`. `SUMMARY_CALC_VERSION` de 19 à 20 (`library/record.ts`), `summaryFrozen.test.ts` refigé (sa trace de foil n'a qu'un vol en ligne droite : seul `calcVersion` change, à dire dans le commit).
- Tests : gauches et droites mêlées à ±50° autour de 180° (sens à ±5°) ; 1 Hz, 5 Hz et pas de 4 s ; foil à cinq vols, vague vers 180° puis remontée pompée vers 0° au-dessus du seuil (sortie des vagues, comptée pompée) ; vague en biais à 100° gardée ; trois vagues ou dispersion large : `null`, chiffres d'aujourd'hui.

### B : zone du pic (Opus high, six points)

- Fichier neuf `src/surfing/peakZone.ts` et son test : `buildPeakZone(track, departures, sense, opts?)`, `zoneEntry(track, zone, from, to)`, `isInZone`, `peakZoneOutline(zone, n)` (pour la partie C).
- Départs : les débuts de glisse remontés (`rides[k].start`), le décollage sur foil.
- Ellipse dans le plan local (`planeProjection`, `core/geo.ts`), petit axe le long du sens des vagues, grand axe en travers ; demi-axes tirés de la boîte des départs dans le repère tourné, agrandis pour contenir chaque départ, plus `ZONE_MARGIN_M` = 15 m, grand axe porté à au moins `ZONE_MIN_ASPECT` = 1,5 fois le petit (ne fait que grandir).
- Une zone pour toute la session (défaut du brief, gardé : une zone qui grandit donnerait de petites zones et des retours longs en début de session).
- Sans sens estimé : axe principal des départs (au moins trois), sinon un cercle ; mode exposé (`orientation`). Sans départ : pas de zone, retour `null`.
- Entrée calculée sur le segment (racine de la quadratique de l'ellipse, un long pas qui traverse la zone compte), instant et position interpolés ; pas d'interpolation à travers un trou de trace.
- `returnOf` réécrit : retour = entrée − fin de glisse, `straightM` jusqu'au point d'entrée, champ neuf `SurfReturn.entryMs` ; première sortie : du premier coup de rame à la première entrée ; attente, rame et `waitS` inchangés ; `summarizeSurf` et le résumé de la bibliothèque inchangés.
- `SurfModule` : `returnEnd` lit `entryMs` (corrige aussi la première sortie, qui partait de `track[0]`), quatre textes d'aide réécrits (« première attente », « prise sans attente »), dictionnaires.
- Exposé pour C : `SurfAnalysis.peakZone` (centre, demi-axes en m, cap du grand axe, orientation, départs) et `peakZoneOutline`.

### Questions mineures tranchées par l'orchestrateur le 18/11

- Glisse finie déjà dans la zone (pompé jusqu'au pic sur foil) : retour de 0 s, compté, vitesse de remontée `null`.
- Départs sur foil : les décollages des vols, pas les vagues reprises en plein vol.
- Constantes : 5 s, 4 mesures, R 0,5, 120°, 15 m, 1,5 ; à ajuster sur données réelles.
- Pas d'entrée interpolée à travers un trou de trace.

### Questions majeures répondues par l'utilisateur le 18/11

- Vague de l'intérieur : hors zone. Un départ à plus de `ZONE_INSIDE_M` (environ 40 m, constante nommée) vers la plage de la médiane des départs, le long du sens des vagues, n'entre pas dans la construction de la zone ; le retour qui précède cette vague, sans entrée dans la zone, est « enchaîné » et sort de la moyenne. Sans sens estimé, l'axe de repli (axe principal des départs) ne sait pas où est la plage : aucun départ n'est écarté.
- Une seule zone pour toute la session ; le pic qui glisse avec la marée l'élargit, limite connue à écrire dans ETAT.

### Partie B, écarts au plan acceptés par l'orchestrateur le 18/11

- Marge vérifiée par un disque de 15 m autour de chaque départ (sur 32 directions), qui ne fait qu'agrandir l'ellipse : avec la seule marge ajoutée aux axes, un départ au bout du grand axe en gardait moins.
- Première sortie qui part déjà de la zone (enregistrement lancé au pic) : non mesurée, « — », la sortie n'ayant pas été enregistrée.
- Sur une session de moins de quatre vagues, le sens n'est pas connu : la zone suit l'axe des départs et n'écarte aucune vague de l'intérieur (banc : la vague 3 de la matinée n'est plus « enchaînée »).

### Planche de la partie C (18/11, hors dépôt)

`D:\gong tracker\atelier\planche-436\index.html`, valeurs exactes dans le fichier des variantes à côté : A trait noir plein 2,5 px sans remplissage ; B tirets noirs `7 6` de 2 px, intérieur grisé à 8 % (recommandée : noir comme le reste, les tirets ne se confondent pas avec la trace, l'intérieur se voit sans la cacher) ; C trait violet plein et teinte à 14 %, un rond à chaque départ ; D petits points noirs sur liseré blanc, un anneau à chaque départ. Constat : la carte reste claire la nuit (`tokens.css` donne la palette claire à `.leaflet-container`), donc l'encre de la zone y reste noire de nuit, comme les autres tracés de la carte. Outils : dossier outils de la planche (l'objet carte se retrouve par les fibres de React depuis `.leaflet-container`).
- Choix de l'utilisateur, 18/11 : variante B (« je suis d'accord la B »). Élément 437.
