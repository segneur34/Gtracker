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
