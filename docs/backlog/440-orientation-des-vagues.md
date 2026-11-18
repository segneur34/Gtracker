# 440 · Surf : orienter les vagues à la main, et une orientation automatique fiable

| Modèle | Réflexion |
|---|---|
| Fable | high (après le 439 ; plan par l'agent `Plan`) |

## Tel que dit (18/11)

« Ensuite, on le fera plus tard, mais dans un prochain lot, il va falloir pouvoir orienter les vagues. Et avoir une orientation automatique des vagues. » Confié à Fable avec les éléments 439 (zone du pic, retour au pic) et 424 (virages).

## Aujourd'hui

Le sens des vagues est seulement estimé (`src/surfing/waveSense.ts`, lot 436 A) et peut valoir `null` ; rien ne permet de le dire à la main. Il sert à écarter, sur foil, les remontées pompées prises pour des vagues, et à orienter la zone du pic (lot 436 B).

## Voulu

- **Orientation automatique** : le sens des vagues estimé sur chaque session de surf, fiable en surf comme sur foil, avec un repli dit clairement quand il n'est pas estimable (ce que le 439 aura appris sur les sessions réelles).
- **Orientation à la main** : dans l'onglet réglages de l'analyse surf, l'utilisateur donne le sens des vagues de la session, comme le vent saisi en voile (DECISIONS §1, règle 7 de `CLAUDE.md`, et « Donnée propre à une session » de `CLAUDE.md` : dans la fiche, par le brouillon et « Enregistrer la session ») ; le sens saisi prime sur l'estimé, et tout ce qui en dépend se recalcule (zone du pic, remontées pompées sur foil).
- Le sens se voit sur la carte (par exemple une flèche, comme le vent en voile) : dessin sur planche d'abord (« Maquette d'abord » de `/chaine`).
- Questions de produit à poser à l'utilisateur au plan : forme de la saisie (cap en degrés, rose des vents, glisser une flèche sur la carte), et si un sens saisi doit se retenir par lieu (même spot, même orientation) ou rester propre à la session.

## Réponses de l'utilisateur (18/11)

- **Saisie** : la boussole de la voile. Un bouton « Régler » ouvre la même grande boussole translucide que pour le vent (`WindAdjustOverlay`), posée sur la carte : flèche tirée au doigt, angle saisi, « Inverser », « Calculé » pour revenir à l'automatique.
- **Convention** : la flèche montre **où vont les vagues** (vers la plage), pas d'où vient la houle. C'est le `directionDeg` du calcul ; à l'inverse du vent, qui se dit d'où il vient.
- **Mémoire** : le sens saisi est **propre à la session**, dans sa fiche, par le brouillon et « Enregistrer la session » ; rien par lieu.
- **Dessin du sens sur la carte** : planche hors dépôt (`D:\gong tracker\atelier\planche-440\`), choix de l'utilisateur à venir.

## Ce que le 439 a appris (pour l'orientation automatique)

- Une seule session réelle à vagues (Paddle du 16/11, 2 vagues, caps 354° et 355°, départs étalés sur 125 m le long de la plage, ligne des départs à 98°) : rien ne permet de régler finement sur données réelles ; la saisie à la main est la voie sûre, l'automatique doit surtout ne pas se tromper en silence.
- Le sens actuel est la moyenne du déplacement des 5 premières secondes de chaque glisse. Faiblesses connues : des vagues toutes prises en biais du même côté le faussent ; gauches et droites mêlées se compensent (R baisse). La ligne des départs, quand ils s'étalent, dit la plage mieux que le sens (lot 439 : la zone la suit déjà).
- `WaveSense` porte `reliable` (4 mesures, R ≥ 0,5), exigé seulement pour écarter une remontée pompée sur foil ; la zone prend tout sens utilisable. Une seule variable `waveSense` dans `analyzeSurf` : un sens saisi s'y écrit `{ directionDeg, R: 1, samples: 0, reliable: true }`.

## Plan retenu (18/11, agent `Plan`, tranché par l'orchestrateur)

Le seuil de vague en foil (`waveThreshold`) suit déjà le chemin voulu, de la fiche au worker et au résumé : le sens saisi le recopie champ pour champ.

**Partie A, donnée et calcul (Opus/high)**, neutre sans saisie.
- Fiche : `waveDirectionDeg: number | null` dans `SessionAnalysis` (`src/library/record.ts`), degrés de 0 à 360, cap **vers lequel vont** les vagues, `null` = automatique ; sa ligne dans `ANALYSIS_FIELDS` après `waveThreshold`, partie `'sensVagues'` dans `AnalysisPart`, lecture et écriture comme `windDeg` (`normalizeDeg`) ; libellé `t('sens des vagues')` dans `EDITED_PART_LABEL` (`src/library/sessionEdits.ts`). Brouillon et `updateSessionRecord` suivent par la table.
- `applyRecordPatch` : `waveDirectionDeg` entre dans `analysisChanged` (le résumé se relance) ; remis à `null` quand la famille change ; gardé quand l'activité change dans le surf (il décrit le lieu, pas la planche).
- Calcul : `SurfSessionSettings.waveDirectionDeg` (`src/surfing/surfSession.ts`), passé à `analyzeSurf` ; un sens imposé y vaut `{ directionDeg, R: 1, samples: 0, reliable: true, source: 'saisi' }` et remplace l'estimé ; `WaveSense` gagne `source: 'saisi' | 'estime'`. `src/library/analysisStore.ts` : `sameSurfSettings` le compare. `SurfModule.tsx` : `surfSettings` reçoit la valeur du brouillon (une ligne, rien d'affiché dans cette partie). Fixtures de test complétées.
- Résumé : `SummaryOptions.waveDirectionDeg?` (`src/library/summary.ts`), rempli en surf par `summaryOptions` ; `summaryOptionsKey` ne l'ajoute **que s'il est défini** : l'empreinte des sessions déjà rangées ne bouge pas, seules celles qui ont un sens saisi se recalculent. `SUMMARY_CALC_VERSION` ne bouge pas dans cette partie.
- Tests : sens imposé ; remontée pompée écartée sur foil avec 2 vols seulement ; zone tournée par le sens imposé ; fiche ancienne lue `null` ; retour à `null` au changement de famille ; empreinte inchangée sans saisie, changée avec.

**Partie B, sens automatique (Opus/high)**, après A. Aucun gain n'est démontrable sur données réelles (une session, deux vagues) : le minimum prudent.
- Quand les départs s'étalent sur au moins `ZONE_LINE_MIN_M` et que leur ligne reste à `ZONE_MAX_TILT_DEG` au plus de la perpendiculaire au sens estimé, le sens devient cette perpendiculaire, du côté du sens estimé : la garde que la zone applique déjà. La zone ne bouge pas ; la flèche et le côté plage deviennent justes pour des vagues prises en biais jusqu'à 45°.
- `principalAxisDeg` et l'étendue des départs sortent de `peakZone.ts` dans une fonction exportée (`departureLine`), commune à la zone et au sens. `reliable` garde sa règle.
- Écarté : la corde entière de la glisse (une droite qui longe la plage la fausse plus que 5 s), un critère de fiabilité tiré des glisses seules, la direction de la première sortie.
- Sur foil, une vague proche de 120° du sens peut changer de camp : `SUMMARY_CALC_VERSION` passe de 20 à 21 (résumés recalculés en tâche de fond). Attendus en biais recalés d'après la construction de leur trace.

**Partie C, boussole commune et ligne des réglages (Sonnet/medium)**, après A.
- `src/components/CompassAdjustOverlay.tsx` tirée de `WindAdjustOverlay.tsx` (bandeau, champ, Inverser, Calculé, Terminé, cadran, tirage ; paramètres : textes, `arrow: 'versCentre' | 'versBord'`, emplacement d'un bouton en plus). `WindAdjustOverlay` devient une enveloppe qui rend **le même DOM, mêmes classes** : un test `renderToStaticMarkup` fige son HTML avant la factorisation, identique après ; le banc de la voile reste identique.
- Vagues : `arrow='versBord'` (trait du centre, pointe et poignée au bord, l'angle affiché est `directionDeg`).
- `src/components/surf/WaveSenseField.tsx` (aucun `style={{`) : ligne « Sens des vagues » dans l'onglet réglages du surf, sous les seuils : sens en degrés suivi de « calculé », « saisi · calculé N° » ou « calculé · peu sûr » ; « non estimé » quand le sens vaut `null` ou R < 0,5 ; bouton « Régler » et son « ? » (`MISE_EN_PAGE.md` : un réglage neuf vient avec son aide ; rien ne se déplace).
- Téléphone : même chemin qu'en voile (carte agrandie en plein écran sur écran étroit, la fermer met fin au réglage, rappel du matériel couvert).
- Traductions `en.json`, `es.json`.

**Partie D, dessin sur la carte (Sonnet/medium)**, après le choix de la planche : `src/components/WaveSenseLayer.tsx` (maison sur `components/map/paths`, styles constants, comme `PeakZoneLayer`), géométrie pure dans `src/surfing/waveSenseMarks.ts` avec son test. Visible comme la zone (onglet rame ouvert) et pendant le réglage.

**Partie E, banc (Sonnet)** : `outils/banc/surf.mjs` complété (ouvrir le réglage, tirer la flèche, « saisi », retours recalculés, « Enregistrer la session », rechargement, « Calculé », Annuler ; plein écran à 390 × 844) ; `general.mjs` et `brouillon-voile.mjs` identiques avant et après.

Mineures tranchées : sens gardé d'une activité à l'autre du surf, effacé au changement de famille ; « non estimé » sous R < 0,5 ; pas de mini-boussole dans « général ». Partie B : faite par défaut, l'utilisateur ayant demandé « une orientation automatique » fiable ; il est prévenu qu'elle n'est pas prouvée sur données réelles et peut la refuser.

Essai au téléphone, un seul : sur le Paddle du 16/11, régler le sens au doigt en plein écran, la flèche suit et le retour change, enregistrer, rouvrir.

## Dépend de

Le 439 : il dit sur données réelles pourquoi le sens automatique échoue, et ce lot en part.
