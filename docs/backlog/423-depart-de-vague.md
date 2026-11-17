# 423 · Surf : le début des vagues n'est pas compté

## Tel que noté (16/11, après une session)

« il faut revoir aussi la façon dont on calcule le départ de la vague. Là j'ai fait une petite session, clairement la fin de mes surfs il est compté en surf mais pas les débuts. Alors après les conditions étaient très légères, etc., pas facile, mais je pense qu'il y a un truc à revoir avec ça. »

Activités citées avec la note voisine (virages, élément 424) : surf, paddle foil, paddle surf.

## Aujourd'hui (lu dans le code le 16/11)

`src/surfing/surfAnalysis.ts` : une vague est une suite de pas dont la vitesse lissée dépasse le seuil de vague de la session (sur foil : un vol au seuil de vol, les vagues étant ses passages au-dessus du seuil de vague en foil), gardée si elle dure et couvre un minimum. Son début est donc le premier point au-dessus du seuil, rien avant.

Conséquence attendue par petites conditions : la planche accélère lentement, le seuil n'est franchi qu'une fois la vague bien entamée, et tout le départ (la mise en vitesse) reste compté en rame. La fin, elle, est comptée jusqu'au retour sous le seuil. Durée, distance et nombre de virages de chaque vague sont alors trop courts, et une vague molle peut ne pas être comptée du tout.

Hypothèse à vérifier, pas un fait : le lissage de la vitesse retarde aussi le franchissement du seuil au départ et le prolonge à la fin, ce qui irait dans le sens de ce que l'utilisateur a vu.

## Premier geste du lot

Comme pour le calage du GPS (lot 417) : une trace synthétique de vagues molles (accélération lente de la vitesse de rame à une vitesse à peine au-dessus du seuil, puis retour) pour mesurer de combien le début est rogné, à 1 Hz et à 5 Hz, avec et sans foil. Rien n'est corrigé avant cette mesure.

## Pistes, à trancher au plan

- Remonter le début d'une vague retenue jusqu'au début de sa mise en vitesse : le dernier moment, avant le franchissement du seuil, où la vitesse était encore à l'allure de rame (borné en secondes, jamais en nombre de points : règles 2 et 10). La fin n'est pas touchée.
- Un rapport sans dimension plutôt qu'un seuil absolu de plus (part de la vitesse de la vague, ou accélération soutenue).
- Corriger le décalage du lissage au départ s'il est mesuré.

## Ce que l'utilisateur peut essayer dès maintenant

Dans l'analyse de cette session, onglet réglages : baisser le seuil de vague de la session. Si les débuts reviennent, le calcul est juste mais le seuil par défaut est trop haut pour de petites conditions ; s'ils ne reviennent pas ou si la rame devient des vagues, c'est bien le départ qu'il faut recalculer.

## Données demandées à l'utilisateur (16/11, en clair)

- L'activité de la session (surf, paddle surf, paddle foil).
- Le seuil de vague affiché dans l'onglet réglages de son analyse.
- À peu près combien de secondes manquent au début d'une vague.
- Ce que donne l'essai du seuil baissé.

## Contraintes

- Noyau du surf : DECISIONS §4 à relire avant tout (« Vague : au-dessus du seuil de vague »), la phrase sera amendée à la passe de documentation.
- Les chiffres des sessions déjà rangées changent : le numéro de version du résumé augmente, les sessions se recalculent.
- Aucun GPX réel dans le dépôt : la validation se fait par l'utilisateur, sur cette session.

## Plan (agent Plan, 17/11), lu et tranché par l'orchestrateur

### Ce que fait le code

- Le début d'une glisse est fixé par `activeRuns` (`src/core/sessionStats.ts`, vers l. 241) sur le masque de `thresholdMaskOptions` (l. 167-184), qui lit `getActiveThresholds` (`src/core/sportProfiles.ts`, vers l. 709). Masques posés dans `src/surfing/surfSession.ts` (l. 38-39), découpage dans `analyzeSurf` (`src/surfing/surfAnalysis.ts`, l. 221, et l. 236 pour les vagues d'un vol).
- **Cause probable du constat** : l'hystérésis du surf est asymétrique (`SURF_PROFILE` : entrée à seuil + 1, sortie à seuil − 2). Au seuil de 9 km/h, une vague commence à 10 km/h et ne finit que sous 7 km/h : la montée de 7 à 10 km/h reste en rame, la descente de 10 à 7 km/h est en vague. Pareil sur foil (vol de 11 à 8 km/h, vague de 19 à 16 km/h).
- Dépendent du début : `spanOf` (durée, distance, moyenne, max), `takeoffOf` (rame de départ), `countDirectionChanges` (virages GPS), `stepPhases` (temps de glisse et de rame), `returnOf`, `waveS` et `pumpS` d'un vol, `src/library/summary.ts` (l. 119-130 : temps en mouvement, nombre de vagues, plus longue vague, vitesse max, donc Statistiques ; `surfRides` l. 74), `src/surfing/gyroTurns.ts` (l. 87), `measureFlightPumping` (`src/hooks/useSessionPumping.ts`, l. 77). Le direct de l'enregistrement compte au masque et ne change pas.

### Partie A : la mesure, avant toute correction (un agent, un commit)

- Dans `src/surfing/surfAnalysis.test.ts` : le générateur `buildSurfSession` reçoit une phase en rampe (champ `to?`, cap compris) et une option « sans Doppler » (vitesse tirée des positions).
- Vague molle : rame à 1,2 m/s pendant 30 s, rampe de 1,2 à 3,0 m/s en 8 s, plateau à 3,0 m/s 6 s, retour de 3,0 à 1,0 m/s en 4 s, puis rame et attente. Variantes : mise en vitesse en 12 s ; vague qui ne dépasse 10 km/h que 2 s (écartée aujourd'hui) ; rame de planche à pagaie plate à 8 km/h, entre les deux bornes ; changement de cap au début de la rampe ; sur foil, rampe de 1,5 à 4 m/s pour le vol puis vague de 4 à 5,8 m/s. Chaque cas à 1 Hz, 5 Hz et cadence variable (un pas de 6 s en pleine rampe).
- La mesure sépare, en secondes : (a) la part perdue entre borne basse et borne haute (l'asymétrie) ; (b) la part perdue sous la borne basse ; (c) le décalage du lissage, avec et sans Doppler ; (d) les vagues molles écartées ; (e) les virages en plus si le départ remonte.
- Le test fige le constat (bloc « départ des vagues molles » : secondes rognées au début, ≈ 0 à la fin). Le rapport donne le tableau des mesures. Si (a) fait l'essentiel, la partie B s'applique telle quelle ; si (b) domine, s'arrêter et le dire : c'est une question pour l'utilisateur (qu'appelle-t-il le début de la vague).

### Partie B : la correction (un agent neuf, un commit)

- Remonter le début d'une glisse retenue tant que : la vitesse lissée reste au-dessus de la borne basse de son masque (symétrie avec la fin, rien de neuf à régler) ; elle monte encore (en remontant le temps, arrêt dès qu'elle cesse de baisser, à une tolérance en rapport près, `RISE_TOLERANCE_RATIO` ≈ 0,98, ce qui protège la rame plate) ; la durée remontée ne dépasse pas `MAX_RISE_S` (≈ 10 s). Valeurs à caler sur la variante planche à pagaie et sur une variante bruitée (bruit à graine).
- Bornes dures : jamais avant la fin de la glisse précédente, ni avant le début du vol pour une vague sur foil, ni à travers un trou de trace (`maxGapS`, `segmentStart`). La fin n'est pas touchée.
- Ordre : `activeRuns`, recul du début, puis filtre `keptRuns` (les vagues molles reviennent).
- Fichiers : `src/surfing/surfAnalysis.ts` (fonction pure `riseStartOf`, appliquée aux glisses et aux vagues d'un vol) ; `SurfParams` reçoit `rideExitMs`, `waveExitMs` (m/s, de `thresholdMaskOptions(...).exitThresholdMs` dans `surfSession.ts`) et `maxRiseS` (constante nommée par défaut) ; `src/library/record.ts` : `SUMMARY_CALC_VERSION` de 18 à 19, `src/library/summaryFrozen.test.ts` refigé en le disant.
- Tests : les traces en paliers existantes ne bougent pas (neutralité) ; les attentes de la partie A s'inversent ; `src/recording/liveStats.test.ts` (vers l. 441) reste sous 1 %.

### Résultat de la mesure (partie A, 17/11) : il corrige la partie B ci-dessus

Mesuré sur sept cas, à 1 Hz, 5 Hz et avec un pas de 6 s, avec et sans Doppler (bloc « départ des vagues molles » de `src/surfing/surfAnalysis.test.ts`, qui fige le comportement d'aujourd'hui) :
- Vague molle (1,2 → 3 m/s en 8 s) : 7 s et 13,9 m rognés au début sur environ 18 s, la vague comptée fait 9 s ; rien n'est rogné à la fin (moins de 0,4 s, moins de 1 m), dans tous les cas.
- (a), la part entre borne basse et borne haute (l'asymétrie) : environ 53 % du rognage en secondes et 63 % en mètres (3,7 s sur 7 pour la vague molle ; 100 % sur planche à pagaie ; 65 % pour la vague sur foil). (b), la part sous la borne basse : 3,3 s sur 7 pour la vague molle. (c), le lissage : nul à un pas près, la médiane centrée ne retarde pas une rampe.
- Une vague qui ne dépasse la borne haute que 2 s est écartée aujourd'hui (≈ 4 s, ≈ 11 m, sous les 15 m) ; elle revient si son début remonte (≈ 8 s, ≈ 19 m).
- Pas de 6 s en pleine rampe : avec Doppler il est compté en entier dès que son point d'arrivée passe la borne haute ; sans Doppler sa vitesse moyenne reste dessous et il est perdu.
- Remonter jusqu'à la borne basse n'ajoute aucun virage GPS ; remonter jusqu'au début de la rampe en ajouterait un.

Tranché par l'orchestrateur : la correction rend (a) seulement, le début compté comme la fin, à la borne basse ; c'est ce que dit la plainte (« la fin de mes surfs il est compté en surf mais pas les débuts »). (b), la mise en vitesse sous la borne basse, reste de la rame de départ : à faire dire par l'utilisateur à l'essai sur sa session du 16/11, sans bloquer.

Critère corrigé par la mesure :
- Pas de comparaison d'un point au suivant (`RISE_TOLERANCE_RATIO` point à point dépend de la cadence : à 5 Hz une rampe gagne moins de 2 % par pas et le recul s'arrête aussitôt). « La vitesse monte encore » se juge sur une fenêtre en secondes (pente ou rapport entre la vitesse d'un instant et celle d'une fenêtre plus tard), même résultat à 1 Hz, 5 Hz et cadence variable.
- Le recul teste la vitesse du pas qu'il ajoute (son point d'arrivée), comme `activeRuns`, et non celle du point d'avant ; sinon il perd un pas et le pas de 6 s sans Doppler n'est jamais repris.
- La rame plate entre les deux bornes (planche à pagaie à 8 km/h) ne doit pas être avalée : le recul s'arrête au début de la rampe.

### Tranché par l'orchestrateur

- La fonction reste dans `surfing/`, la voile n'est pas concernée ; le recul se fait avant `keptRuns`.
- Sur foil, les vols remontent aussi, par symétrie (même hystérésis) : le temps de vol s'allonge un peu ; dit à l'utilisateur dans le compte rendu et vérifié à l'essai.
- Un virage GPS de plus au départ : mesuré en (e), traité au lot 424, pas ici.

### Banc et essais

- Scripts : `surf` (neutre par construction), `virages`, `pumping`, `general`, `statistiques`, `library`, `zoom-carte`, `graphes` ; `surf.mjs` complété d'une vague molle en marches de 2 s (1,2 / 1,7 / 2,1 / 2,5 / 2,9 m/s), durée vérifiée dans l'onglet vagues (partie à part, sur Sonnet).
- Essais au téléphone : rouvrir la session du 16/11 et regarder les débuts de vague ; une session de paddle surf, pour vérifier que la rame n'est pas avalée.
