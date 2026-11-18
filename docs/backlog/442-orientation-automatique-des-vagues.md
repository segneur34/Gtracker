# 442 · Surf : une orientation automatique des vagues plus fiable

| Modèle | Réflexion |
|---|---|
| Opus | high (plan déjà fait le 18/11, ci-dessous ; relecture avant commit) |

## Tel que dit (18/11)

« Dans un prochain lot, il va falloir pouvoir orienter les vagues. Et avoir une orientation automatique des vagues. » La saisie à la main est faite (lot 440, validé le 18/11) ; reste l'automatique.

## Aujourd'hui

`src/surfing/waveSense.ts` : le sens est la moyenne vectorielle du déplacement des 5 premières secondes de chaque glisse, pondérée par la longueur ; `reliable` à partir de 4 mesures et R ≥ 0,5, exigé seulement pour écarter une remontée pompée sur foil ; la zone du pic prend tout sens utilisable (une mesure, R ≥ 0,5). Un sens saisi le remplace et vaut pour fiable. Faiblesses connues : des vagues toutes prises en biais du même côté faussent le sens ; gauches et droites mêlées se compensent et R baisse. La zone du pic, elle, suit déjà la ligne des départs quand ils s'étalent (`src/surfing/peakZone.ts`, `ZONE_LINE_MIN_M` = 30 m, `ZONE_MAX_TILT_DEG` = 45°).

## Plan retenu le 18/11 (agent `Plan`), accepté par l'utilisateur le 18/11 au soir

Aucun gain n'est démontrable sur données réelles : une seule session réelle a des vagues (Paddle du 16/11, deux vagues, hors dépôt dans `D:\memoire Tracker\essais\439-zone-du-pic\`). Le minimum prudent :
- quand les départs s'étalent sur au moins `ZONE_LINE_MIN_M` et que leur ligne reste à `ZONE_MAX_TILT_DEG` au plus de la perpendiculaire au sens estimé, le sens devient cette perpendiculaire, du côté du sens estimé : la garde que la zone applique déjà. La zone ne bouge pas ; la flèche affichée et le côté plage deviennent justes pour des vagues prises en biais jusqu'à 45° ;
- `principalAxisDeg` et l'étendue des départs sortent de `peakZone.ts` dans une fonction exportée (`departureLine`), commune à la zone et au sens ; `reliable` garde sa règle ;
- écarté : la corde entière de la glisse (une droite qui longe la plage la fausse plus que 5 s), un critère de fiabilité tiré des glisses seules, la direction de la première sortie ;
- sur foil, une vague proche de 120° du sens peut changer de camp : `SUMMARY_CALC_VERSION` passe de 20 à 21 (`src/library/record.ts`), les résumés de toutes les sessions se recalculent en tâche de fond ; les attendus en biais des tests et les retours du banc (`outils/banc/surf.mjs`) sont recalés d'après la construction de leur trace ;
- `estimatedWaveSense` (le sens calculé rappelé à côté d'un sens saisi) suit la même correction.

**Réponse de l'utilisateur à Q131, le 18/11 au soir : oui**, le changement se fait sans preuve sur ses données ; à valider sur lecture, puis sur la première session à vagues prises en biais.

## Contraintes

Règles 2, 3 et 10 de `CLAUDE.md` ; tests sur traces synthétiques (biais à 30° ramené, à 60° inchangé, à 1 Hz, 5 Hz et un pas de 4 s ; départs groupés sans correction) ; DECISIONS §4.

## Essai au téléphone

Aucun de possible avant une session de surf à vagues prises en biais : à valider sur lecture, puis sur la première session qui s'y prête.

## Tranché par l'orchestrateur le 18/11 au soir, après la relecture

- Le recalage exige **au moins trois départs gardés** (`SENSE_LINE_MIN_DEPARTURES`) : deux points font toujours une ligne, sans rien prouver, et un seul segment de 30 m aurait pu tourner le sens affiché de 45°. La zone du pic garde sa règle (deux départs suffisent pour son axe). Sur la seule session réelle à vagues (deux vagues), le sens calculé ne change donc pas.
- La garde se juge sur le sens mesuré brut ; la zone reçoit le sens saisi, sinon le mesuré, jamais le recalé : elle ne bouge pas. `R`, le nombre de mesures et `reliable` restent ceux des mesures brutes ; aucun champ ne dit « recalé », aucun texte d'écran ne change.
- `SUMMARY_CALC_VERSION` passe à 21 : sur foil, le sens recalé décide si une remontée pompée est écartée, donc le nombre de vagues, la plus longue vague et la vitesse maximale peuvent changer.
