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
