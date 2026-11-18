# 424 · Surf : le compte des virages

| Modèle | Réflexion |
|---|---|
| Fable | high (après le 440 ; plan par l'agent `Plan`) |

## Tel que dit

- 16/11 : « il faut revoir le calcul des virages en surf, paddle foil et paddle surf. Parce que là je pense qu'il y a une petite erreur de calcul. »
- 18/11 : confié à Fable avec les éléments 439 et 440, « revoir un peu l'algo » des virages sur les sessions réelles, sans attendre d'autre détail.

## Aujourd'hui

- Au gyroscope (`src/surfing/gyroTurns.ts`) quand la capture couvre la vague : retournements d'au moins 60° du cap du buste. Case « Mesurer les virages » cochée d'office pour Surf et Surf foil seulement.
- Sinon au GPS (`src/surfing/gpsTurns.ts`) : rotations d'au moins 60° du cap, celui de l'appareil s'il est là, sinon celui des positions ; affiché avec un astérisque.

## Relevé du 18/11 sur la session réelle (hors dépôt, `D:\memoire Tracker\essais\439-zone-du-pic\releve-424.txt`)

Les trois sessions de surf du téléphone : seule celle du Paddle du 16/11 à 15 h 32 a des vagues (2), et elle n'a pas de capture des capteurs : ses virages sont donc ceux du GPS. Aucune session réelle ne permet de juger les virages du gyroscope sur une vague (le Sup foil du 14/10 a une capture mais aucune vague).

- Les deux vagues comptent **1 virage chacune**, au seuil de la session (6 km/h) comme au seuil par défaut (9 km/h).
- Dans les deux cas, ce virage est la **sortie de vague** : le cap tient pendant la glisse (autour de 0° pour la vague 1, de 290° à 340° pour la vague 2), puis part de 80 à 100° vers la droite dans les 4 à 7 dernières secondes, quand la vitesse retombe de 10 à 13 km/h vers 4 à 7 km/h. Le rameur quitte la vague et se remet en travers.
- Le cap de l'appareil saute d'une seconde à l'autre à basse vitesse (51°, 105°, 91° sous 6,5 km/h) : sous quelques km/h il ne vaut plus grand-chose.
- Avec le début de vague remonté (lot 423), la mise en vitesse entre aussi dans la vague : 4 à 6 secondes sous 7 km/h, au cap peu sûr.

## Pistes de Claude, à confirmer avec l'utilisateur avant tout code

1. La sortie de vague ne devrait pas compter pour un virage : ne juger le cap que dans la partie rapide de la vague (au-dessus de la détente basse du seuil, ou d'une part de la vitesse maximale de la vague), pas dans sa mise en vitesse ni dans sa fin.
2. Ne pas lire le cap de l'appareil sous une vitesse plancher.
3. Sur paddle et paddle foil, sans capture, le compte reste celui du GPS, expérimental : cocher « Mesurer les virages » d'office pour ces activités serait une décision de l'utilisateur (DECISIONS §4 la réserve à Surf et Surf foil).

## À demander à l'utilisateur

- Sur ces deux vagues du 16/11, combien de virages a-t-il faits ? (Hypothèse : aucun, une ligne droite puis la sortie.)
- Qu'est-ce qui lui a paru faux : trop de virages, pas assez, ou un compte qui change d'une vague à l'autre sans raison ? Sur quelle session ?
- A-t-il une session de surf ou de foil avec de vrais virages et la capture des capteurs ? Sans elle, le gyroscope ne se règle que sur des traces synthétiques.

## Réponses de l'utilisateur, le 18/11 au soir (Q132)

- Sur les deux vagues du 16/11 : « Aucun virage » (une ligne droite, puis la sortie en travers) ; le virage compté est bien la sortie.
- Ce qui paraissait faux : « Trop de virages ».
- La règle proposée (un changement de direction ne compte que s'il reste de la glisse après lui, cap non lu sous 7,2 km/h) est acceptée avec sa valeur à lui : **2 secondes**, pas 3. Sur le relevé, 2 s écartent encore les deux sorties, avec moins de marge : vague 1, 1,3 s de glisse après la rotation (0,7 s de marge) ; vague 2, 0 à 1 s (1 s de marge ou plus).
- Pas de session avec de vrais virages et la capture des capteurs : le gyroscope ne se règle que sur des traces fabriquées.
- Le 18/11, plus tard dans la soirée, après avoir vu que sa vague 2 tombait pile à 2,0 s de glisse dès que la fin de la rotation n'était plus mesurée au degré près : **3 secondes, avec une mesure tolérante de la fin de rotation**. Les « 2 secondes » d'abord données obligeaient à une mesure au degré près, que le cap du GPS ne permet pas.

## Plan retenu le 18/11 au soir (agent `Plan`, repris après objection de l'orchestrateur)

Écarté : ne juger le cap qu'au-dessus de 85 % de la vitesse maximale de la vague. Calé sur deux vagues de paddle lentes, il ne garderait que le pic de départ d'une vraie vague de surf, dont les virages se font à 60 ou 75 % de ce pic.

Retenu, « un virage relie deux glisses » :
- **Plancher de lecture du cap** : `COURSE_MIN_SPEED_MS` = 2 m/s (7,2 km/h), constante de `src/surfing/gpsTurns.ts` ; sous lui, un pas n'est lu ni par le cap de l'appareil ni par celui des positions, le dernier cap lu est gardé.
- **Sortie de vague** : un changement de direction ne compte que s'il reste au moins `TURN_MIN_RIDE_AFTER_S` = 2 s (valeur de l'utilisateur ; le plan disait 3) de glisse entre la fin de la rotation (le dernier extrême du cap, pas l'instant où les 60° sont atteints) et le dernier instant de la vague au-dessus du plancher. Sur le relevé : vague 1, 1,3 s de glisse après la rotation ; vague 2, 0 à 1 s ; les deux sont écartées avec 2 s de marge. Vaut pour le GPS et pour le gyroscope.
- **Mise en vitesse, au GPS seulement** : un virage dont l'extrême de départ tombe dans les `TURN_SETTLE_S` = 2 premières secondes au-dessus du plancher ne compte pas (sur la vague 1, le plancher seul laissait 3° de marge sous les 60°). Rien au gyroscope : le cap du buste ne tremble pas à basse vitesse.
- Tout se juge en temps, bornes interpolées entre deux points (règles 2 et 10) ; avec un pas de 4 s, la glisse après le virage peut être surestimée d'un pas : le test n'y exige que « au plus 1 virage, sans erreur ».
- Les trois constantes sont nommées, commentées, passées en option avec un défaut neutre pour les appels directs des tests existants (règle 3).

Fichiers : `src/surfing/gpsTurns.ts` (constantes ; `directionChanges` y est déjà et rend `from`, `at` et le sens de chaque virage ; la fin de rotation, `extremeAfter` et le calcul de `until`, y remonte depuis `gyroTurns.ts` ; `countDirectionChanges(track, start, end, minDeg, opts)` garde l'heure de chaque cap lu) ; `src/surfing/surfAnalysis.ts` (`SurfWave` gagne `turnRideEndMs`, dernier instant au-dessus du plancher, ou fin de la vague sur foil ; les deux appels, avec et sans foil) ; `src/surfing/gyroTurns.ts` (`gyroWaveTurns` reçoit cette heure et écarte un virage suivi de moins de 3 s de glisse ; la couverture par la capture se juge toujours sur la vague entière) ; `src/pages/SurfModule.tsx` (passer l'heure aux virages du gyroscope). La voile n'est pas touchée.

Ne change pas : `SUMMARY_CALC_VERSION` (les virages ne sont pas dans le résumé, ni dans « général », ni dans Statistiques), l'astérisque du GPS, la case « Mesurer les virages » (Surf et Surf foil seulement, DECISIONS §4), les notes de l'écran.

Ce que la règle perd, assumé : un vrai dernier virage suivi dans les 3 s de la fermeture de la vague (indiscernable d'une sortie à 1 Hz) ; au GPS, un virage amorcé dans les 2 s qui suivent le passage du plancher. Ce qu'elle garde à tort : une sortie suivie de 3 s ou plus de glisse droite dans la mousse.

Tests (1 Hz et 5 Hz, avec et sans Doppler ; pas de 4 s : au plus 1, sans erreur) : sortie en travers avec chute de vitesse, 0 ; mise en vitesse au cap bruité, 0 ; pic bref au départ puis glisse à 65 % du maximum avec deux virages de 90°, 2 ; dernier cutback suivi de 5 s de glisse, 1 ; dernier virage puis fermeture dans les 2 s, 0 ; foil, deux virages dans la vague puis se dégager pour pomper, 2 ; gyroscope : rotation du buste de 90° dans les 2 dernières secondes non comptée, les trois virages du test existant toujours 3. Diagnostic : `outils/banc/virages-diagnostic.mjs`, capture `.imu` rendue facultative, à lancer sur la session réelle hors dépôt aux seuils 6 et 9 (attendu : 0 et 0). Banc : `surf.mjs` et `virages.mjs`, neutres attendus.

Passe de documentation, après validation : la règle dans DECISIONS §4.

## Partie A, codée le 18/11 (le compte ; ni banc ni diagnostic)

Les trois règles sont dans `src/surfing/gpsTurns.ts` (`TurnRules`, `surfTurnRules()`), appliquées par `analyzeSurf` et, pour le gyroscope, par `SurfModule` ; un appel direct sans option garde le compte brut. Deux écarts à la lettre du plan, à relire :

- **Mise en vitesse** : le cap n'est pas lu pendant les 2 premières secondes au-dessus du plancher, plutôt que « un virage dont l'extrême de départ y tombe ne compte pas ». Sur une glisse droite, l'extrême d'où part le premier vrai virage est souvent le tout premier cap lu : la règle à la lettre l'aurait écarté. Le passage du plancher se cherche jusque devant la vague : une vague prise en vol n'a pas de mise en vitesse.
- **Fin de la rotation**, reprise le soir même avec la décision des 3 s (`TURN_MIN_RIDE_AFTER_S = 3`) : ce n'est plus un extrême du cap, c'est la première pause de la rotation (`rotationEnds`). À partir du pas où le changement est compté, la rotation dure tant que le cap avance encore dans son sens d'au moins 15 °/s (`TURN_PAUSE_RATE_DEG_S`) sur la seconde qui suit (`TURN_PAUSE_WINDOW_S`, le plus petit écart entre deux lectures qui la couvre ; ce qui reste de lectures en fin de vague). Un cap qui tremble de ± 5°, une dérive de 3 °/s ou une sortie dans le même sens que le virage ne repoussent plus la fin. Rejeu hors dépôt des deux vagues du relevé, seuils 6 et 9, cap de l'appareil et des positions : 0 partout ; glisse restante de 0,0 à 1,3 s sur la vague 1, 2,0 s sur la vague 2 (fin de rotation à t+18).
- Ce que la règle perd encore, assumé : des virages dont les fins sont à moins de 3 s l'une de l'autre, quand la vague ferme dans la seconde après le dernier, perdent les deux derniers (l'avant-dernier n'a pas ses 3 s de vague non plus).

Reste : le diagnostic (`outils/banc/virages-diagnostic.mjs` : capture facultative, passer la vague et `surfTurnRules()` à `waveTurnTrace`, dire pourquoi un retournement est écarté, rotation lente ou glisse restante `rideAfterS` trop courte) et le banc (`surf.mjs`, `virages.mjs` : seule la colonne des virages peut baisser).
