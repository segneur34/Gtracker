# 426 · Analyse › « général » : ce qui compte pour chaque sport

## Tel que dit par l'utilisateur (note du 17/11)

« Le saut doit être indiqué de base en kite et en wing s'il n'est pas décoché ; les cadences de pumping cochées de base en surf foil, en [mot dicté « camping »] et en paddle foil, ce genre de chose. »

## Relevé dans le code (17/11, à revérifier)

Les sauts sont déjà cochés d'office en wing, planche et kite (`src/settings/activityPresets.ts`), le pumping seulement pour l'activité « Pumping ». Ce que la fenêtre « général » montre n'est pas encore propre au sport.

## Décisions

- **Q124, tranchée par son défaut le 17/11 sur consigne de l'utilisateur** : des tuiles dans « général », chacune décochable comme le reste, et non les seuls onglets montrés d'office.
  - Sauts (activités dont le calcul sait les sauts : kite, wing, planche) : nombre de sauts et plus haut saut.
  - Pumping (surf foil, paddle foil, et l'activité « Pumping ») : cadence de pumping et part du vol.
- **Le mot dicté « camping »** : lu par l'orchestrateur comme « pumping », l'activité « Pumping » de la famille surf, qui a déjà son pumping coché ; à confirmer par l'utilisateur à la validation, sans bloquer le lot.
- Les pré-réglages suivent : la cadence de pumping est cochée d'office pour surf foil et paddle foil (activités de départ, `activityPresets`), comme elle l'est pour « Pumping » ; les sauts restent cochés d'office en kite, wing et planche. Une activité déjà réglée par l'utilisateur garde ses choix : seul le « défaut » change.
- Une tuile ne se montre que si la session porte la donnée (pas de tuile « 0 saut » sur une session sans capture de sauts, pas de cadence sans mesure) : même règle que les tuiles existantes de « général ».

## Voulu

La fenêtre « général » de chaque famille et de chaque activité porte d'office ce qui compte pour elle, décochable comme le reste (liste de « général » par sport : `docs/DECISIONS.md` §1 et §4 ; disposition : `docs/MISE_EN_PAGE.md`, « général » et « avancé »).

## Contraintes

- Un comportement se lit dans les capacités du profil, jamais par un nom de calcul en dur (`src/architecture.test.ts`).
- Recette « un réglage utilisateur » de `docs/DEVELOPPER.md` si une case neuve apparaît ; textes par `t`, `tn`, trois langues ; formats par `core/units.ts`.
- Les chiffres viennent des calculs existants (sauts : `core/jumps.ts`, `useSessionJumps` ; pumping : le calcul de cadence existant) : aucun calcul neuf, aucun changement de `summary` sauf nécessité dite dans le plan.
- Sessions existantes : rien ne change pour une activité dont l'utilisateur a déjà réglé les cases.

## Banc

Sessions de kite ou de wing avec sauts, session de surf foil avec pumping : « général » montre les tuiles neuves ; les autres pages gardent leur texte.

## Essai au téléphone

Un essai : une session de wing avec sauts et une de surf foil → « général » montre les tuiles de sauts et de pumping, et les décocher dans Réglages les retire.

## Plan (agent Plan, 17/11), lu et tranché par l'orchestrateur : il prime sur ce qui précède là où il le corrige

### Ce que la fiche supposait à tort

- Aucune tuile de « général » ne se décoche aujourd'hui : seuls les onglets se cochent (`src/core/analysisTabs.ts`, `isTabShown`, `activityTabs`).
- « Paddle foil » n'est pas une activité de départ ; Paddle (`a-paddle`) est sans foil et sans pré-réglage.
- Le chiffre de pumping n'est pas disponible à l'ouverture : la capture (plusieurs Mo) n'est lue qu'à l'ouverture des onglets « vols » ou « pumping » (`SailingModule` vers l. 248, `SurfModule` vers l. 220) ; `summary` ne porte que `pumpingShare`, en voile, après ouverture de ces onglets.

### Composition actuelle

- Voile, `src/pages/SailingModule.tsx` : `overviewStats` (l. 384-402), rendu par `<GeneralStats stats={overviewStats} pairs={[['tacks','jibes']]} />` (l. 617) ; l'image de partage a sa propre liste, `generalStats` (l. 348).
- Surf, `src/pages/SurfModule.tsx` : `overviewKeys` (l. 289) choisit dans `generalStats` (l. 264) ; rendu l. 549.
- Pré-réglages (`src/settings/activityPresets.ts`) : sauts cochés pour wingfoil (l. 48), Windsurf et Windfoil, Kite et Kitefoil (l. 56) ; pumping coché pour `a-pumping` seul (l. 68). Défaut du pumping lu par `defaultPumpingOf` et `resolvePumping` (`src/settings/activitySettings.ts`, l. 317-329) : seul l'écart au défaut est rangé.
- Chiffres : sauts par `useShownJumps` (déjà appelé à l'ouverture, `jumps.jumps`, `heightM`, `jumps.visible`, `status === 'ready'` ; formats de `JumpsPanel.tsx`) ; pumping par `useFlightPumping(...).summary` (`strokesPerMin`, `pumpShare` ; libellés de `FlightPumpingPanel.tsx`).

### Tranché par l'orchestrateur (17/11)

- **Lecture de la capture** : elle est lue aussi quand « général » est ouvert, sur une session à foil dont le pumping est coché (`|| open.general` dans la condition de `useSessionPumping`), sans retarder le premier affichage de la page : la tuile arrive quand le calcul est prêt. Rien n'est copié dans la fiche de la session, `summary` ne change pas. Un essai au téléphone sur une longue session dira si l'ouverture reste fluide.
- **Décocher** : une tuile part quand on décoche l'onglet correspondant (sauts, pumping) dans la ligne « Onglets » de l'activité. Aucun réglage neuf.
- **Paddle foil** : `pumping: true` sur la base `surf` de `BASE_PRESETS`, sans effet tant que le foil n'est pas coché ; Surf foil (`a-surf-foil`) l'a donc aussi. Une activité dont la case est déjà rangée garde son choix.
- Session avec capture et aucun saut : « Sauts 0 » et « Plus haut saut — ». Sauts en cours de calcul : pas de tuile. L'image de partage ne change pas. Libellés : « Sauts », « Plus haut saut », « Cadence de pumping », « Part du vol pompée » (reprendre les clés existantes quand elles existent).

### Étapes

1. Pré-réglages : `pumping: true` sur la base surf ; suivre `activityPresets.test.ts` (vers l. 27) et `activitySettings.test.ts` (vers l. 124).
2. Fonction pure neuve, par exemple `src/core/generalSportStats.ts` : `jumpTiles(jumps)` et `pumpingTiles(summary)` rendent des `ShareStat[]`, vides sans donnée ; son test (liste vide sans capture, « — » si cadence nulle, arrondis, virgule par `formatDecimal`).
3. Voile : tuiles insérées dans `overviewStats` après `jibes` et avant la FC, qui reste la dernière ; paires `['jumps','highestJump']` et `['pumpCadence','pumpShare']`. Sauts : `jumpsVisible`, `status === 'ready'` et onglet « sauts » montré. Pumping : `pumpingVisible`, pumping coché, `pumpSummary.measured > 0`.
4. Surf : même ajout, clés dans `overviewKeys` après les vols.
5. Textes par `t`, trois langues ; aucun style en ligne neuf ; aucune comparaison à un nom de calcul (capacités `profile.jumps`, `profile.pump`, foil, onglet montré).

### Banc (partie à part, sur Sonnet)

- `outils/banc/pumping.mjs` casse à son étape 1 (l. 141-144 : le clic décocherait la case maintenant cochée d'office) : vérifier « cochée d'office », puis lire dans « général » la cadence et la part du vol pompée.
- `sauts.mjs` : la session wing avec capture montre « Sauts » et « Plus haut saut » dans « général ».
- À rejouer : `general` (la wing sans capture garde exactement son texte), `prereglages`, `onglets`. Seuls changent le résumé de la carte Surf foil (« pumping ») et les tuiles neuves. `outils/banc/SCRIPTS.md` suit.
