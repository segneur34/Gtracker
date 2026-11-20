# 470 · Toucher une tuile de « général » ouvre son onglet

Modèle | Réflexion : Opus | high (code) ; Sonnet | medium (contrôles ajoutés aux scripts du banc).

Demande : `node outils/backlog.mjs --ligne 470`. Plan de l'agent `Plan` du 20/11, condensé par l'orchestrateur. À lancer après le commit du 471 (mêmes fichiers).

## Décidé

- Pas de maquette : les tuiles gardent leur dessin. L'onglet s'ouvre en plus de « général » (« avancé » se déplie s'il y est rangé), puis la page défile jusqu'à son panneau s'il n'est pas déjà à l'écran. Une tuile sans onglet, ou dont l'onglet n'est pas montré pour la session (activité, données), reste un simple bloc.
- Signe, un seul : le chevron `IconChevronRight` (`components/icons.tsx`) en 10 px, `aria-hidden`, couleur `var(--muted)`, au bout du libellé ; ni couleur d'activité ni vert. État pressé en `opacity: .6`, curseur main sous `(pointer: fine)`, contour `var(--ink)` au clavier.
- Tranché par l'orchestrateur : en voile sur foil, les tuiles que le profil nomme « en vol » (distance et temps en vol) ouvrent l'onglet `vols` quand il est montré, même si leurs chiffres viennent du seuil de vitesse : l'utilisateur veut « chaque tuile qui a son onglet », et c'est l'onglet du détail des vols. À lire dans les capacités du profil, jamais par un nom de calcul en dur. Si le code ne permet pas de savoir simplement que la tuile est « en vol », ne pas la relier et le dire dans le rapport.

## Table tuile → onglet (clés de `overviewStats`)

- Voile (`pages/SailingModule.tsx`, vers 400-419, et `library/shareStats.ts`) : `top2s` → `tops` ; `tacks`, `jibes` → `manoeuvres` ; `jumps`, `highestJump` → `sauts` ; `pumpCadence`, `pumpShare` → `pumping` ; `heartRate` → `cardio` ; les autres (distances, temps, moyennes) : aucun, sauf le cas « en vol » ci-dessus.
- Surf (`pages/SurfModule.tsx`, vers 280-306) : `waves`, `waveTime`, `longestWave`, `maxSpeed` → `vagues` ; `flightTime`, `longestFlight` → `vols` ; `pumpCadence`, `pumpShare` → `pumping` ; `heartRate` → `cardio` ; `totalTime` : aucun.

## Pièces en place

- `revealTab` (`core/analysisTabs.ts`), exposée comme `reveal` par `hooks/useAnalysisTabs.ts` : ouvre un onglet, mais ferme « général » quand elle ouvre « avancé » : il lui faut une option qui garde « général ».
- Onglets montrés : la liste déjà filtrée du module (`sailingPanels` avec `panelShown`, `sections` en surf). Un onglet absent de cette liste ne donne aucun bouton.
- Défilement : aucune ancre sur les panneaux d'onglet ; `ResizablePanel` accepte `anchorId` (seule la carte s'en sert, `ANALYSIS_MAP_ANCHOR`). Modèle : `hooks/useZoomOnMap.ts` (ne défile que si l'élément n'est pas déjà entier à l'écran, `scroll-margin-top` dans `pages/analysisMobile.css`). Sur ordinateur, `panelPacking.ts` remonte les panneaux après un `ResizeObserver` : défiler une image plus tard (`requestAnimationFrame`), et pas si le haut du panneau est déjà visible. Sur téléphone : `block: 'start'`, en tenant compte de la barre « Non enregistré » collée en haut.
- Le banc relève `document.body.innerText` : un `aria-label` ou une icône SVG ne change pas le texte relevé.

## Étapes

1. `core/analysisTabs.ts` : tables `SAILING_TILE_TABS`, `SURF_TILE_TABS`, `TILE_TABS` par famille (sur le modèle de `MODULE_TABS`), `tileTab(family, statKey, shownKeys)` (null si onglet caché, absent ou clé inconnue), option `{ keepPrimary: true }` de `revealTab`, `tabAnchorId(key)`, `panelNeedsScroll(top, topInset, viewportH)`. Tests dans `analysisTabs.test.ts` : table entière, chaque cible est une clé de son module et jamais `general`, cas null, `keepPrimary` (« avancé » fermé, ouvert, onglet déjà ouvert), bornes de `panelNeedsScroll`.
2. `hooks/useAnalysisTabs.ts` : `openFromGeneral(key)` (ouvre par `revealTab` avec `keepPrimary`, note le défilement à faire), puis un effet qui défile quand le panneau est là ; défile aussi si l'onglet était déjà ouvert. Ajouter du code après `reveal`, sans toucher à `toggle`, `closeAll` ni à ce que le lot 471 a posé.
3. `anchorId?` transmis à `ResizablePanel` dans `CardioTab.tsx`, `EmptyTabPanel.tsx`, `sailing/ManeuversPanel.tsx`, `JumpsPanel.tsx` (deux `return`) ; les panneaux écrits dans les modules le reçoivent directement.
4. `ui/StatTile.tsx` : `onClick?` et `ariaLabel?` ; s'ils sont donnés, la racine devient un `<button type="button">` de classe `an-sheet__stat an-sheet__stat--link`, à la même profondeur que le `div` (grille et paires gardées) ; sinon rien ne change pour les autres usages.
5. `GeneralStats.tsx` : prop facultative `linkOf?: (statKey) => { tabLabel, onOpen } | null`, passée à chaque tuile.
6. `pages/analysisMobile.css` : `.an-sheet__stat--link` (bouton remis à zéro, états ci-dessus), `scroll-margin-top` sur `[id^='an-onglet-']`. Aucun `style={{`.
7. Modules : `linkOf` construit avec `tileTab` et la liste filtrée, ancres posées. `AnalysisShell.tsx` n'est pas touché.
8. Test `src/components/GeneralStats.test.tsx` (`renderToStaticMarkup`) : tuile reliée = `button` avec `aria-label`, tuile sans onglet = `div`, paires gardées.
9. Une clé de traduction : `{label} : {value}. Ouvrir l'onglet {tab}` (« {label}: {value}. Open the {tab} tab », « {label}: {value}. Abrir la pestaña {tab} »).

## Banc (partie à part, Sonnet)

`passe.mjs` avant/après : texte relevé identique. À compléter : `general.mjs` (voile : « Virements réussis » ouvre manœuvres et « avancé », « général » reste ouvert, la page défile ; « Temps total » n'est pas un bouton ; surf : « Vagues » ouvre vagues ; de même à 390×844, brouillon ouvert, pour la barre collée) ; `onglets.mjs` (onglet caché par l'activité : tuile sans bouton). Entrées de `SCRIPTS.md` à jour.

## Passe de doc (après validation)

`docs/MISE_EN_PAGE.md`, sous-point « général » de la Structure : « Une tuile de « général » dont l'onglet est montré pour la session se touche : elle ouvre cet onglet en plus de « général » (« avancé » se déplie s'il y est rangé) et la page défile jusqu'à son panneau s'il n'est pas déjà à l'écran ; un petit chevron à l'encre atténuée, au bout du libellé, le signale ; une tuile sans onglet, ou dont l'onglet est caché par l'activité, reste un simple bloc (table `TILE_TABS`, `core/analysisTabs.ts`). »
