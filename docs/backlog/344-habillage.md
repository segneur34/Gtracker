# 344 · Habillage : la planche A dans les variables du thème

Modèle | Réflexion : Opus | high

## Tel que noté

Demande du 11/11 : « s'inspirer de la DA du site Gong ». Planche A retenue le 12/11 (« on va juste garder le A »), planche finale validée le 12/11 au soir (« je valide la planche »). Ce lot est le premier du paquet de la nouvelle apparence : il ne fait que l'habillage général. Les couleurs d'activité (338), les logos (349), la page Sessions (346), l'ouverture sur le Profil avec l'en-tête à photo et « Live for it. » (351) et l'avatar (350) viennent après, chacun dans son lot.

## Sources (hors dépôt, à lire, ne rien y écrire)

- `D:\gong tracker\atelier\maquette-da-1211\construire-finale.mjs`, constante `CSS` (lignes 152 à 231) : la planche finale ; `planche-finale.html` à côté pour la voir.
- `D:\gong tracker\atelier\maquette-da-1111\construire.mjs`, feuille de style à partir de la ligne 315 : la première planche A, qui montre l'analyse, Enregistrer, Statistiques et Réglages (pastilles `.pl`, bouton glissant `.seg`, boutons `.b`, tableaux `.tab`).
- `D:\gong tracker\gong\da\tokens\gong-tokens.css` : les variables du site de GONG, pour ce que les planches ne disent pas.

## Décisions déjà prises

- Clair : fond blanc `#fff`, surface secondaire `#fbfbfb`, traits `#efefef`, encre `#000`, libellés `#6b6b6b` (plus foncé que le `#959595` de GONG, tranché le 12/11), texte faible `#959595`.
- Sombre : le thème sombre d'aujourd'hui, repeint : fond `#0e0e0e`, surface `#1a1a1a`, traits `#2a2a2a`, encre `#fff`, libellés `#a8a8a8`, texte faible `#7d7d7d`. Le thème économe garde son noir pur et l'absence d'effets.
- Une touche de vert vif `#AAFF00`, toujours en aplat sous du noir, jamais en texte sur blanc : le bouton rond au repos (point noir au centre), le bouton « Enregistrer » de la barre du haut, la case allumée de la barre du bas. Rouge `#E53935` pendant l'enregistrement.
- Barre du bas (et rail du téléphone tourné) : noire, icônes et libellés blancs, case allumée en vert vif, dans les deux thèmes. Barre du haut : fond de page, liens en gris, lien allumé en encre, gras, souligné d'un trait.
- Plus de couleur de famille : là où le bleu de la voile ou le gris du surf servaient d'accent (onglet allumé, pastille, bouton, bandeau, `FAMILY_ACCENT`, `--voile`, `--surf`, `--neutral-accent`, `--home-action`), l'accent devient l'encre : noir sous du texte blanc en clair, blanc sous du texte noir en sombre. Les versions douces (`--voile-soft`, `--surf-soft`) deviennent la surface secondaire. La règle d'architecture ne change pas (un comportement se lit dans les capacités, la famille range) : seule la couleur s'efface.
- Boutons en pilule (rayon 30 px), trait fin d'encre : plein (fond encre, texte inversé) ou creux (fond transparent, texte encre) ; pastilles et bouton glissant de même. Cadres et cartes à bords francs, un trait fin, sans ombre portée ni rayon ; champs de saisie à 2 px.
- Police : Inter (la planche a été vue dans cette police ; Helvetica Now Display, celle de GONG, est payante). `@fontsource/inter` est déjà installé par l'orchestrateur (poids 400, 500, 600, 700) : `fonts.css` et `--font` suffisent ; Montserrat n'est plus importé (l'orchestrateur retirera le paquet).
- Titres : gras, dans leur casse, serrés (plus de capitales légères espacées). Boutons d'action : capitales, graisse normale (le bouton vert « Enregistrer » reste gras). Passer par `--title-*` et `--action-*`, en ajoutant les variables qui manquent (casse comprise) plutôt que d'écrire en dur.
- Fonds de page unis : plus de courbes de niveau (`--contour`) ni d'encre de fond surf.
- Tailles de texte, espacements, hauteur des zones tactiles : inchangés (lisibilité sur l'eau). Aucun texte, aucune disposition, aucune adresse ne change.
- Restent tels quels : les couleurs de données des graphes et de la carte, le dégradé de vitesse des traces, le bleu du tracé de la planification, les couleurs d'état (succès, danger, avertissement), les variables de la plante du Profil (cachée), les nuances d'activité (`FAMILY_SHADES`, `FAMILY_SHADES_DARK`, `ShadePicker` : c'est le lot 338).

## Voulu

1. `src/theme/tokens.css` repeint d'après ces décisions, dans ses trois palettes (claire, sombre, économe), avec son commentaire d'en-tête. Vérifier le contraste du texte sur chaque fond (4,5 au moins pour le texte courant) et compléter `src/core/palette.test.ts` ou le test de thème qui convient ; le test qui liait `--voile` et `--surf` à la première nuance de famille s'adapte (le lien disparaît, les nuances restent pour le 338).
2. Tout ce qui ne passe pas par les variables et contredit la planche est ramené à une variable : rayons et ombres en dur, `text-transform` et graisses des titres et boutons, texte blanc en dur sur un accent, couleurs en dur dans une feuille de style ou un style en ligne d'écran (hors couleurs de données). Relever par Grep, corriger, et lister dans le rapport ce qui reste en dur et pourquoi.
3. Pièces communes à l'allure de la planche : boutons, pastilles, onglets des analyses, `SegmentedControl`, cadres (`components/ui`), barre du haut, barre du bas et rail, bouton rond (repos, enregistrement, pause s'il a un état propre), bandeaux d'enregistrement, fenêtres de dialogue, menus dessinés par l'application.
4. Android : les couleurs natives qui suivent le fond (`src/theme/androidColors.test.ts` dit lesquelles) passent aux nouveaux fonds, clair et nuit.
5. L'image de partage et ce qui vit sous `.theme-light` ou `.leaflet-container` (outils posés sur la carte, légende) restent lisibles : le vérifier dans le code et le dire.
6. L'accueil et les deux bibliothèques d'aujourd'hui (remplacés au 346) et le Profil (refait au 351) reçoivent les variables comme les autres pages, sans retouche de disposition ; leurs photos et bandeaux restent.

## Ne pas faire

- Ni changement de texte, de libellé, d'ordre, de disposition ou de navigation ; ni page neuve ; ni en-tête à photo ni « Live for it. » (351) ; ni couleurs ou logos d'activité (338, 349).
- Ne pas toucher à `docs/` hors de ce brief, ni à `package.json`, ni commit ni version.
- Ne pas lancer deux bancs ni `npm run verif` ; `node outils/verif.mjs --rapide` après chaque étape.
- Budget : vers 140 tours, finis l'étape en cours et rends ton rapport, même partiel, en disant ce qui reste.

## Banc (lancé par l'orchestrateur)

Changement neutre pour le texte : `general`, `surf`, `statistiques`, `profil`, `reglages`, `tutoriels`, `icones`, `apropos`, `cacher` doivent rendre le même texte avant et après. `tailles` et `aides` mesurent des largeurs, que la police change : ils servent ici à voir qu'aucun texte ne déborde.

## Questions tranchées par l'orchestrateur (12/11), d'après le plan

- Rouge : `#E53935` ne porte pas de texte blanc (contraste 4,2). Il va au bouton rond en enregistrement, sans texte. Ce qui porte du texte blanc sur du rouge (bandeau d'enregistrement, bouton « Arrêter », `.ui-btn--danger`) garde le rouge sombre d'aujourd'hui `#c62828`, par une variable à part, la même dans les deux thèmes ; un texte rouge sur fond clair passe par `--danger`.
- La couleur qui distinguait voile et surf (ligne de groupe des Statistiques, trait de gauche de la bibliothèque, dessin de l'avatar, accent de l'image de partage) devient l'encre : c'est voulu (« plus de groupes Voile et Surf nulle part »), les couleurs d'activité arrivent au 338. Les fonds de page par famille s'effacent (transparents), leurs classes restent pour le banc.
- Sombre : la surface des cadres est le fond `#0e0e0e`, un trait seul les dessine ; `#1a1a1a` est la surface secondaire (creux, champs).
- Bouton rond en pause : disque vert vif, barres noires. Son anneau prend la couleur de la barre.
- Fenêtres flottantes (dialogues, menus, liste d'activités) : elles gardent une ombre légère, plus un trait fin ; les cadres posés dans la page n'en ont pas.
- « Créer un parcours » : plus de liseré rouge (`--home-action-edge` devient l'encre).
- L'orange du test de FC repos reste.
- Le bouton vert « Enregistrer » de la barre du haut reste sans bord, comme sur la planche.
- Sous la barre du bas noire : si la marge du bas (`--inset-bottom`) n'est pas déjà peinte par la barre, la peindre en noir, et dire dans le rapport si la couleur de la barre de navigation d'Android est à changer.
- Le test de `palette.test.ts` sur les nuances sombres se mesure contre l'ancienne surface sombre figée en constante (les nuances partent au 338).
- `FAMILY_ACCENT` garde ses chaînes (`var(--voile)`, `var(--surf)`) et les classes `page-backdrop--voile` et `--surf` restent : des scripts du banc les lisent.

## Plan (agent Plan, 12/11), à suivre sauf constat contraire dans le code

Variables de `src/theme/tokens.css`, en clair / sombre / économe :
- Police : `--font: 'Inter', system-ui, …` ; `fonts.css` importe `@fontsource/inter/latin-{400,500,600,700}.css` à la place de Montserrat ; Grep « Montserrat » dans `src` avant de finir.
- Titres : `--title-weight` 700, `--title-spacing` -0.01em, nouveau `--title-case: none`. Actions : `--action-weight` 400, nouveau `--action-case: uppercase`, nouveau `--action-strong: 700` (bouton vert). Nouveau `--stroke: 0.8px` (trait des boutons et pastilles).
- Rayons : `--radius-s` 2px, `--radius-m` et `--radius-l` 0, `--radius-pill` inchangé.
- Fonds : `--bg` #fff / #0e0e0e / #000 ; `--surface` #fff / #0e0e0e / #000 ; `--surface-sunken` #fbfbfb / #1a1a1a / #0e0e0e ; `--surface-hover` #f5f5f5 / #222 / #141414.
- Traits : `--line` #efefef / #2a2a2a / #222 ; `--line-soft` #f5f5f5 / #1f1f1f / #1a1a1a ; `--line-strong` #cfcfcf / #3a3a3a / #2f2f2f.
- Encres : `--ink` #000 / #fff ; `--ink-2` #333 / #d4d4d4 ; `--muted` #6b6b6b / #a8a8a8 ; `--faint` #959595 / #7d7d7d.
- `--on-accent` reste #fff (texte sur le rouge, sur une photo, sur une couleur de donnée). Nouveau `--on-ink: var(--bg)` : le texte posé sur l'accent devenu encre.
- Accents : `--voile`, `--surf`, `--neutral-accent`, `--home-action`, `--home-action-edge` valent `var(--ink)` ; `--voile-soft` et `--surf-soft` valent `var(--surface-sunken)` (à retirer s'ils n'ont aucun lecteur) ; `--contour` et `--backdrop-surf` transparents. Piège : retirer leurs valeurs en dur des blocs sombre et économe, sinon elles priment.
- Enregistrement : `--record` #AAFF00, `--recording` #E53935, dans les deux thèmes ; nouveaux `--on-record: #000`, `--tabbar-bg: #000`, `--tabbar-ink: #fff`, `--tabbar-on: var(--record)`.
- Inchangées : états, `--focus`, `--chart-*` (sauf `--chart-grid` sombre, #2a2a2a), plante du Profil, `--rest-accent`, `--shadow-*`.

Ce qui ne passe pas par les variables :
- `text-transform` à passer par `--title-case` ou `--action-case` : `ui.css` 98, 135, 144, 151, 227, 783 (343 garde sa première lettre en capitale) ; `Home.css` 40, 98, 142 ; `ProfilePage.css` 60, 149 ; `SettingsPage.css` 225, 316 ; `SessionLibrary.css` 253 ; `AppShell.css` 307 ; `ActivityChart.css` 87 ; `ZoomableChart.css` 117 ; `analysisMobile.css` 148 ; `ChartFold.tsx` 31 (en ligne).
- Graisses des pastilles à ramener à 400 : `ui.css` 115, 338, 429 ; `AppShell.css` 113, 324, 382.
- Rayons en dur à corriger : `ui.css` 183, `StatisticsPage.css` 222, `analysisMobile.css` 652 ; en ligne `MapToggle.tsx` 30, `SessionNotesPanel.tsx` 65 et 148, `ManeuversPanel.tsx` vers 252. À laisser : ronds à 50 %, carré d'arrêt, barres de graphe, `ShareBar.tsx`, légende de vitesse, `ProfileRoot.css`, repères de carte. Rayons par variable qui doivent devenir pilule : `Home.css` 74 et 136, `ui.css` 378, 396, 424, 576.
- Ombres : cadres `ProfilePage.css` 19, `ProfileAvatar.css` 89 (à retirer) ; flottantes `Dialog.css` 14, `ui.css` 558, `ActivitySelect.css` 48 (gardées, voir plus haut) ; carte `BaseTileLayer.css` 42, `PlanningPage.css` 136 (gardées).
- Couleurs en dur des feuilles de style : seulement les voiles sur photo (`Home.css`, `SessionLibrary.css`), à garder.
- `--on-accent` posé sur l'accent, à passer en `--on-ink` : `ui.css` 281 et 355 ; `Home.css` 76 et 138 ; `ProfileAvatar.css` 19 ; `Tutorials.css` 12 ; `SessionMarks.tsx` 95 ; `SessionNotesPanel.tsx` 66. À garder : sur le rouge (`AppShell.css` 39 et 49, `ui.css` 291), sur une photo (`ui.css` 194), repères de route (`PlanningPage.css` 132 et 243). Sur le vert, `--on-record` : `AppShell.css` 155 et 405, `ui.css` 286 et l'anneau du point `ui.css` 311.

Où l'accent de famille est lu :
- Onglets, pastilles, bouton glissant (encre, texte `--on-ink`) : `SectionTabs`, `ActivityFilterTabs`, `ShareDialog` 149, `SettingsPage` 134, `StatisticsPage` 141, 345, 347, `SessionLibrary` 637, `RoutesPage` 110, `RecordingPage` 763 et 765, `JumpsPanel` 229, `ManeuversPanel` 136 et 239, `SurfModule` 493 et 545.
- `MapToggle` (`ManeuversPanel` 115 et 303, `VmgPanel` 54, `JumpsPanel` 215, `SurfModule` 130, `TopsPanel`, `FlightPumpingPanel`) reçoit aussi des couleurs de données (`BandShareTable` 66, `JumpsPanel` 262 et 263), qui gardent le texte blanc : lui donner une propriété d'encre, par défaut `--on-accent`.
- Accent en couleur de texte (devient l'encre, rien à faire) : `base.css` 41, `ui.css` 113, 302, 508, `analysisMobile.css` 128-129 et 231-232, `ActivitySelect` 76, `SettingsPage` 981.
- `AppShell.tsx` 50-61, 123, 135 : `--tab-color` devient `--tabbar-on` en bas et `--ink` en haut.

Tests et Android :
- `src/core/palette.test.ts` : retirer le lien `--voile`/`--surf` ↔ première nuance (lignes 55, 65-71, première assertion de 114-120) ; en 122-131, l'ancienne surface sombre `#1c2229` figée en constante.
- Nouveau `src/theme/tokens.test.ts`, contraste par palette : encre et `--muted` sur `--bg`, `--surface`, `--surface-sunken` ; `--on-ink` sur l'encre ; `--on-record` sur `--record` ; `--tabbar-ink` et `--tabbar-on` sur `--tabbar-bg` ; texte blanc sur le rouge qui en porte.
- `android/app/src/main/res/values/app_colors.xml` : #FFFFFF ; `values-night/app_colors.xml` : #0E0E0E.
- `src/theme/inlineStyles.test.ts` : aucun `style={{` en plus.

Pièces communes : `components/ui/ui.css` (boutons : primaire plein en encre, secondaire et fantôme creux à trait d'encre, enregistrement vert vif à texte noir gras ; `.ui-tab`, `.ui-segmented`, `.ui-card`, `.ui-card-col`, `.ui-field`, `.ui-alert`, `.ui-savebar`, `.ui-more`, `.page-backdrop`), `components/ui/Dialog.css`, `components/ActivitySelect.css`, `components/ui/MapToggle.tsx`, `components/ChartFold.tsx`, `components/AppShell.css` (barre du bas et rail, bouton rond et ses états, barre du haut : lien allumé en encre, gras, souligné de 2 px, sans pastille ; bandeaux).

Étapes, chacune suivie de `node outils/verif.mjs --rapide` : 1. variables, police, Android, tests ; 2. partage de `--on-accent` (`--on-ink`, `--on-record`, encre de `MapToggle`, texte d'erreur) ; 3. casse et graisses ; 4. pièces communes ; 5. pages (Home, bibliothèque, Profil, Statistiques, Réglages, Planification, Enregistrer, `analysisMobile`) ; 6. Grep final de ce qui reste en dur.

Pièges : `data-eco` passe après le sombre ; `.theme-light` et `.leaflet-container` recopient toute la palette claire, `--on-ink` compris ; l'image de partage (`drawShareImage`) lit `--surface-sunken`, `--line` (très pâle désormais : vérifier que ses traits se voient) et `--faint` ; le banc lit le texte tel qu'affiché, la casse des titres et boutons y changera, c'est attendu.

## Rapport attendu

Le rapport habituel (FAIT, BLOQUÉ ou ÉCHEC), avec : la liste des variables ajoutées ou retirées, ce qui reste en dur et pourquoi, les endroits où l'accent de famille a été remplacé, et les deux ou trois écrans où le rendu te laisse un doute (à regarder par l'orchestrateur au banc, captures à l'appui).
