# 432 · Surf : le départ de chaque vague, en orange et compté dans la vague

La ligne du reste à faire porte la demande et les choix de l'utilisateur du 20/11 (orange, choix B). Planche : `D:\gong tracker\atelier\planche-431-432\432.html` (départ orange avec un point plein à son début, la vague ensuite à sa couleur ; sur la courbe, une bande orange avant chaque bande de vague, et la montée en vitesse tracée en orange).

## L'existant

`analyzeSurf` (`src/surfing/surfAnalysis.ts`) fait déjà remonter le début d'une vague jusqu'à la détente basse (`riseStartOf`, `RISE_MAX_S` à 10 s, fenêtre de 4 s, rapport 0,95). La mise en vitesse sous cette détente reste de la rame (`phases`, `takeoffOf`).

## Plan (agent Plan, 21/11, retenu par l'orchestrateur)

Calcul, `src/surfing/surfAnalysis.ts` :
- Deux constantes du module, nommées, commentées, surchargeables en option : `DEPART_MAX_S = 15` (départs relevés le 16/11 : 9 s et 5 s ; 10 s sur la planche) et `DEPART_MIN_GAIN_MS = 0,3` m/s en 4 s (deux fois le bruit de ±0,15 m/s : à 3 km/h le rapport seul se laisse tromper).
- `riseStartOf` reçoit une option `riseMinGainMs`, à 0 par défaut (neutre pour le recul actuel).
- Les glisses sont gardées comme aujourd'hui : le départ ne fait jamais compter une vague, le nombre de vagues ne bouge pas.
- Sans foil, le départ de la glisse k recule depuis son début compté tant que : le point d'arrivée reste au-dessus du plancher d'arrêt ; la vitesse 4 s plus tôt reste sous 0,95 fois la sienne et sous la sienne moins le gain minimal (une rame à allure constante arrête le recul) ; le recul reste sous `DEPART_MAX_S` ; on ne passe ni un trou, ni une reprise de pause, ni la fin de la vague d'avant.
- Fenêtres en secondes ; un long pas se juge sur son point d'arrivée (un seul pas de 1 à 8 km/h fait tout le départ).
- `SurfWave` gagne `rideStart`, `rideStartMs` (début compté) et `departS`. Durée, distance et moyenne par `spanOf` sur départ → fin ; vitesse max sur la partie comptée ; virages (GPS et gyroscope), sens des vagues et zone du pic sur le début compté, donc neutres ; les pas du départ passent en « glisse » dans `stepPhases` (« sur la vague » reste la somme des vagues) ; `returnOf` et la première sortie s'arrêtent au début du départ ; `takeoffOf` part du début du départ.
- Sur foil, rien ne change : `rideStart = start`, `departS = 0`.
- `src/library/record.ts` : `SUMMARY_CALC_VERSION` augmente, commentaire en clair.

Affichage :
- `src/components/TrackSpanLayer.tsx` et `HighlightSpan.tsx` : option facultative `lead?: { end: number; color: string }` ; le trait et le point du début prennent la couleur du départ, le reste celle du passage. Sans `lead`, rien ne change, voile comprise. `pathOptions` stables.
- `src/components/highlightColors.ts` : `WAVE_DEPART_COLOR = '#ff8f00'` (couleur de données, en dur).
- `src/pages/SurfModule.tsx` : `lead` pour une vague montrée (`shownSpans`) ; bande orange de `startMs` à `rideStartMs` puis bande de vague (`speedOverlays`) ; série orange `depart`, nulle hors des départs (`chartDataAt`, `SPEED_SERIES`), les bornes des départs gardées parmi les points conservés à l'échantillonnage ; `gyroWaveTurns` reçoit le début compté ; une phrase dans la légende et dans l'aide.
- `src/locales/en.json`, `es.json`.
- `outils/banc/virages-diagnostic.mjs` : le début passé à `waveTurnTrace` est le début compté.

Tests synthétiques (`surfAnalysis.test.ts`) : départ depuis 1 km/h puis rampe, même résultat à 1 Hz, 5 Hz et avec un pas de 6 s ; rame plate à 4 km/h avant la rampe non avalée, trente graines de bruit à ±0,15 m/s ; départ borné par la vague d'avant, un trou, une pause et `DEPART_MAX_S` ; résumé (vitesse max inchangée, durée, distance et moyenne avec le départ, `glisseS` égal à `waveS`, nombre de vagues inchangé) ; foil sans départ ; `measureSoftRide` lit `rideStartMs` pour que les tests du recul restent identiques ; tests existants à mettre à jour là où la rame de départ devient le départ.

Chiffres qui changent : tableau des vagues (durée, distance, moyenne, tri), podium des plus longues, « général » et image de partage (Sur la vague, Distance moyenne, Plus longue vague, Moyenne sur la vague, Vitesse de rame), rame et remontées, `longestWaveM` de la fiche (Sessions, Statistiques). Ne changent pas : nombre de vagues, vitesse max, retour au pic, vols.

Banc : `surf`, `graphes`, `zoom-carte`, `general`, `aides`, `virages` ; avant/après, seuls les chiffres du surf bougent, la voile est identique. L'adaptation des scripts est une partie à part.

## Tranché par l'orchestrateur le 21/11 (à dire à l'utilisateur)

- Sur foil, pas de départ dans ce lot : la vague y est prise en vol, et la mise en vitesse avant le décollage est celle du vol. À lui de dire s'il le veut plus tard.
- Podium : l'orange du 2e se confond avec celui du départ ; le départ n'est orange que sur une vague montrée seule, et dans le podium la vague entière, départ compris, est à la couleur de sa marche.
- Zone du pic et sens des vagues : sur le début compté, donc inchangés.
- Valeurs de départ : 15 s au plus, gain d'au moins 0,3 m/s en 4 s.

Essai sur données réelles : la session de paddle du 16/11, départs d'environ 9 s et 5 s, orange au bon endroit, sans manger la rame plate.
