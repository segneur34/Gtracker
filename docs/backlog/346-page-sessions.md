# 346 · La page « Sessions »

Modèle | Réflexion : Opus | high

## Tel que noté

Demande du 12/11 : « Actuellement, la page d'accueil, c'est la page d'analyse. Et ce serait bien que la page d'accueil soit la page de profil. Changer la logique […] avec un moyen simple de passer de l'un à l'autre. » Réponse du 11/11 (ancien élément 332) : les groupes Voile et Surf s'effacent, on voit directement les activités. Tranché le 12/11 sur la planche : deux pages, Profil et Sessions. Planche finale validée le 12/11 au soir, avec la précision : « la rangée se fait glisser de côté pour atteindre toutes les activités ».

Quatrième lot du paquet de la nouvelle apparence, après le 344 (habillage), le 338 (couleurs) et le 349 (logos). Cet élément ne porte que la page Sessions ; l'ouverture sur le Profil, la barre du bas dans son ordre final, l'ordinateur côte à côte et l'en-tête à photo sont au 351.

## Source (hors dépôt, à lire, ne rien y écrire)

`D:\gong tracker\atelier\maquette-da-1211\construire-finale.mjs` : `sessionsCorps`, `bulles`, `ligne`, `actions` (lignes 66 à 118) et leur feuille de style (lignes 201 à 216) ; `planche-finale.html` à côté pour la voir (écrans « Sessions », « Un appui sur un logo », « La nuit »).

## Décisions déjà prises

- Une seule page « Sessions » remplace l'accueil et les deux bibliothèques (Voile, Surf). Plus de groupes Voile et Surf à l'écran.
- En tête : le titre « Sessions », puis une ligne de totaux (« 102 sessions · 2 846 km · 187 h sur l'eau » ; filtrée : « 42 sessions de wingfoil · 1 204 km · 61 h »).
- Une rangée de ronds : « Toutes » (le nombre de sessions dans un rond) puis les activités visibles, chacune par son logo dans son cadre au pinceau (pièce du 349), son nom dessous ; la rangée se fait glisser de côté quand elle dépasse. Un appui sur un logo ne garde que cette activité, « Toutes » rend la liste entière ; le rond choisi a son nom en gras, souligné.
- La liste : une ligne par session (pastille et nom de l'activité, date ; nom de la session ; ses chiffres ; la vignette de sa trace à droite), un trait fin entre les lignes.
- En bas de page : « Créer un parcours » (plein) et « Itinéraires (n) » (creux), comme sur l'accueil d'aujourd'hui (réponse du 12/11 : « on reste sur le mode actuel et je verrai après »).
- La leçon du jour est en pause : elle ne se montre plus (un interrupteur, rien n'est supprimé, comme pour la plante du Profil).
- Rien de ce que les bibliothèques savent faire ne disparaît (ajout de fichiers et de dossiers, choix multiple, suppression, classement, tri, recherche, téléchargement… : tout ce que le code offre aujourd'hui) : chaque fonction garde une place sur la nouvelle page.
- Les adresses des analyses ne changent pas (`/voile/analyse`, `/surf/analyse`, règle 9). Les anciennes adresses `/voile` et `/surf` s'ouvrent toujours : elles mènent à Sessions.
- Les sessions d'une activité cachée ne se listent pas, comme aujourd'hui.
- Tranché par l'orchestrateur : la page vit à l'adresse `/sessions` ; dans ce lot `/` y mène (le 351 y mettra le Profil) ; dans la barre du bas et la barre du haut, la case « Accueil » devient « Sessions » à la même place (le 351 pose l'ordre final) ; le parent d'une analyse devient Sessions (`core/parentPage.ts`, retour d'Android).

## Voulu

1. La page Sessions, sur téléphone, téléphone tourné et ordinateur (sur ordinateur : la même page en large, la disposition de la bibliothèque d'aujourd'hui pour guide ; le Profil et les sessions côte à côte sont au 351).
2. L'accueil et les deux bibliothèques retirés, leurs adresses redirigées, la navigation et le retour d'Android à jour.
3. Les leçons et les aides « ? » qui citent l'accueil ou une bibliothèque réécrites (`src/tutorials/lessons.ts`).
4. Tests : `src/architecture.test.ts` (adresses), `core/parentPage`, les calculs purs neufs (totaux de la ligne d'en-tête, filtre).
5. Banc : les scripts qui passent par l'accueil ou une bibliothèque adaptés (voir le plan pour leur nombre et la façon de faire).

## Ne pas faire

- Ni ouverture sur le Profil, ni ordre final de la barre, ni en-tête à photo (351) ; ni avatar (350).
- Ne pas toucher à `docs/` hors de ce brief, ni à `package.json`, ni commit ni version.

## Questions tranchées par l'orchestrateur (12/11), d'après le plan

- Rangée de logos : toutes les activités visibles, même sans session (comme la maquette), puis le calcul des sessions dont l'activité a été supprimée, s'il y en a.
- Totaux : dans l'unité de distance commune aux activités listées ; si elles diffèrent, en km. La durée est la somme des durées de session, comme au Profil.
- « Toutes (n) » compte les sessions listées ; les sessions à classer ont leur carte, au-dessus de la liste, et n'y comptent pas.
- Le menu « … » de la bibliothèque (note mémoire, ajout de fichiers et d'un dossier, mise à jour, aide du dossier) va à droite du titre, son libellé « Importer, mettre à jour » gardé ; « Tris » à droite de la ligne de totaux ; l'état de la mémoire et « n sessions à mettre à jour » sous la ligne de totaux ; « n sessions en moins » sous la rangée.
- Les cartes de l'accueil qui ne sont pas sur la maquette (mémoire, autorisations, invitation du profil) viennent en tête de Sessions, dans le même ordre et avec les mêmes gardes ; le 351 les portera sur la page d'ouverture.
- « Réalisées / Planifiées » par famille disparaît : « Itinéraires (n) » mène à la liste des itinéraires, comme sur la planche validée ; `/voile?vue=planifiees` et `/surf?vue=planifiees` y mènent aussi.
- Une adresse s'ouvre toujours (décision de `CLAUDE.md`) : `/sessions?activite=<une activité cachée>` montre ses sessions ; « Toutes » ne les liste pas, et la ligne « n sessions en moins » le dit.
- Pas de fond dessiné sur la page. Les images de l'accueil et des bandeaux, sans emploi, sont supprimées.
- La case « Sessions » des barres reste allumée sur une analyse.
- Actions d'une ligne (Classer, Renommer, Supprimer) : réponse de l'utilisateur du 13/11 à Q110 : un « … » par ligne, comme dans la liste des itinéraires, Supprimer gardant sa confirmation.
- Banc : l'adaptation des scripts ne fait pas partie du travail de l'agent qui code la page ; elle part ensuite, par paquets, chez d'autres agents. L'agent qui code garde les classes `lib-list`, `lib-row`, `lib-row__main`, `lib-row__name`, `lib-row__icon`, `lib-row__warning`, `lib-row__rename`, `lib-row__preview`, `lib-row__preview-image`, `lib-row__preview-credit*` et le libellé du « … », que la plupart des scripts lisent.

## Depuis le lot 349 (13/11), à savoir avant de suivre le plan

- `ActivityIcon` n'existe plus. Les pièces sont dans `src/components/logos/` : `ActivityLogo` (`{ logo, color, size, label?, className? }`, cadre à partir de 40 px), `LogoGlyph` (dessin seul, `currentColor`), `ActivityGlyph` (dessin puis pastille cernée, lignes de liste). Le logo d'une activité : `activityLogo(activity)` de `core/activityLogos.ts` ; sa couleur affichée se prend comme le fait `ProfileAvatar`.
- Tranché par l'orchestrateur : un cadre dont la couleur se confond avec le fond (le blanc d'une activité créée le jour, son noir la nuit) reçoit un cerne gris fin, celui des pastilles (`.ui-swatch`), posé dans `ActivityLogo` pour valoir partout, photo du Profil comprise.
- Les numéros de ligne du plan sont ceux d'avant le 349 : les retrouver.

## Plan (agent Plan, 12/11), à suivre sauf constat contraire dans le code

Aujourd'hui (A = `src/pages/Home.tsx`, B = `src/pages/SessionLibrary.tsx`), et où va chaque fonction :
- A 67-74 : photo d'en-tête, logo, version, « Bienvenue » : supprimés ici (l'en-tête revient au 351, la version reste dans Réglages › À propos). A 76-80 : carte mémoire, autorisations, invitation du profil (`profilePromptGate`) : en tête de Sessions. A 82 : leçon du jour (`TutorialOfDay`, `tutorialCardGate`) : interrupteur `TUTORIAL_OF_DAY_VISIBLE = false`, calqué sur `core/profilePlant.ts`, avec un test. A 84-100 : cartes de famille → la rangée de logos. A 102-109 : les deux boutons (nombre tiré de `shownRoutes`) → le bas de page.
- B 593-618 : bandeau photo → titre et ligne de totaux. B 596-608 : menu « … ». B 620-628 : `MemoryStatus compact`, `OutdatedSummaries`, aide du dossier. B 630-634 : rappel d'une famille cachée, qui disparaît. B 639-648 et 675-686 : vues réalisées / planifiées et `RouteList`, remplacées par « Itinéraires (n) » vers `/itineraires/liste`. B 650-659 : « Tris » (`library/sessionSort.ts`, clé `STORAGE_KEYS.triBibliotheque` à ne pas renommer). B 663-666 : `ActivityFilterTabs` et `?activite=` → la rangée, filtre gardé dans l'adresse. B 668-673 : « n sessions en moins ». B 688-695 : carte « À classer » et `ActivitySheet` avant l'analyse (381-389). B 398-413 : ligne de session, recomposée selon la maquette, commentaire et avertissement gardés en petites lignes. B 424-453 : Classer, Renommer (`SessionRenameField`), Supprimer avec confirmation. B 697-707 : liste et message « aucune session », à réécrire sans famille. B 481-490 : ménage des vignettes, gardé. B 573 : `useRetainedScroll` (clé `'sessions'`).

Structure :
- `git mv src/pages/SessionLibrary.tsx src/pages/SessionsPage.tsx`, avec un `SessionsPage.css` de disposition seulement (variables du thème). `SessionPreviewMap` (lignes 109-344, caches compris) sort dans `src/components/SessionPreviewMap.tsx`, `SessionRow` et `rowStats` dans `src/components/SessionRow.tsx`. `Home.tsx`, `Home.css`, `SessionLibrary.css`, `assets/bandeaux/*.webp`, `assets/accueil/vignette-*.webp` supprimés.
- Ce que `family` commandait : bandeau, accent, fond, vue planifiée (retirés) ; la clé de défilement ; le repli de `useOpenSession(file, fallback)` ; la vignette (`cacheKey`, `previewFingerprint`, `sessionColorTrack`, `sessionSpeedRange`). Chaque ligne reçoit donc `sessionFamily(session, SPORT_FAMILIES[0])` (`core/parentPage.ts`) : pour une session classée c'est la famille de sa page d'aujourd'hui, les empreintes restent les mêmes et aucune vignette n'est redessinée.
- Calcul pur neuf `src/library/sessionsList.ts` et son test : `filterChoices`, `filterSessions`, `sessionsTotals` (`{ count, distanceM, durationMs }`), `totalsLine` (« 102 sessions · 2 846 km · 187 h sur l'eau » ; « 42 sessions de wingfoil · 1 204 km · 61 h » ; `formatDecimal`, `formatDuration`, `plural`).
- `src/components/ActivityBubbles.tsx` : « Toutes » (un rond avec le nombre), puis une case par activité (`ActivityLogo` à 58 px, pièce du 349, et son nom), `aria-pressed` ; rangée en `overflow-x: auto`, `scroll-snap`, `overscroll-behavior-x: contain` ; la page ne glisse jamais de côté ; le rond choisi revient à l'écran au retour d'une analyse.

Adresses et navigation :
- `src/App.tsx` : `/sessions` → `SessionsPage` (importée d'office, comme `Home` aujourd'hui) ; `/` → `<Navigate to="/sessions" replace/>` ; `/voile` et `/surf` → redirection vers `/sessions` qui garde `?activite=` ; préchargement à nettoyer.
- `core/parentPage.ts` : `SESSIONS_PATH` et `sessionsPath(activityId?)` remplacent `libraryPath` ; parent d'une analyse : `/sessions?activite=` ; `parentPage('/sessions')` rend `null` (sinon le retour d'Android tourne en rond et ne quitte jamais l'application) ; les autres pages restent sur `/`. Tests de `parentPage.test.ts` à reprendre.
- Appelants de `libraryPath` : `AnalysisShell.tsx` 100 (et le texte 128), `ActivityChart.tsx` 151, `ProfilePage.tsx` 162, `useTutorials.ts` 51. `backLabel` (`SailingModule.tsx` 536, `SurfModule.tsx` 473) → « Sessions ». `PlanningPage.tsx` 608 et `RoutesPage.tsx` 113 : retour vers `/sessions`, « Sessions ».
- `AppShell.tsx` : `HOME` devient `{ to: '/sessions', label: 'Sessions' }` avec une icône de liste neuve (`icons.tsx`) ; les liens Voile et Surf du haut laissent la place à un seul « Sessions », en tête ; le logo et `goHome` restent.
- `src/architecture.test.ts` 160-167 : les routes `/voile` et `/surf` restent (redirections), `/sessions` s'ajoute.

Leçons et textes : `src/tutorials/lessons.ts` (cible `'bibliotheque'` et branche `favoriteFamily` de `useLessonPath` retirées ; cibles des lignes 54, 68, 129, 209 et `/voile` ligne 182 → `/sessions` ; textes 56, 83, 99, 157) ; `FollowTracePicker.tsx` 124 (« depuis l'accueil »), `ErrorBoundary.tsx` 58 (« Revenir à l'accueil »), `SettingsPage.tsx` 904 (« bibliothèque »). Clés à ne pas renommer : `accueil.graphe`, `accueil-profil:*`, `biblio:dossier`.

Étapes, chacune suivie de `node outils/verif.mjs --rapide` : 1. calculs purs et tests (`sessionsList`, `sessionsPath` et `parentPage`, interrupteur de la leçon du jour) ; 2. sortie de `SessionPreviewMap` et `SessionRow` sans rien changer ; 3. `SessionsPage` et `ActivityBubbles`, sur téléphone, téléphone tourné et ordinateur ; 4. adresses, barres, parents, appelants, retour d'Android, test d'architecture, suppression de `Home` et des images ; 5. leçons et textes.

Pièges : `parentPage('/sessions')` vaut `null` ; la famille de la vignette vient de la fiche ; les rappels passés à `SessionRow` (en `memo`) restent stables ; `ActivityLogo`, jamais `ActivityIcon` ; la rangée qui glisse ne déborde pas la page et ne gêne pas le geste retour au bord de l'écran.

Banc (pour l'orchestrateur) : `scripts.mjs` (`PAGES` : `'accueil'` et `'bibliotheque'` → `'sessions'`, 21 scripts étiquetés), `passe.mjs` 34 (`PRECHAUFFE`) ; paquet A (accueil, barre, leçon) : `icones`, `surf`, `fluidite`, `tutoriels`, `profil`, `vides`, `aides`, `cacher`, `rendus` ; paquet B (adresses et lignes) : `session-save`, `session-save-resume`, `classer`, `fichier-recu`, `library`, `rename`, `donnees`, `miseajour`, `import-session`, `import-fit` ; paquet C (vignettes, mise en page) : `vignettes`, `vignettes-relance`, `carte-perf`, `satellite`, `tailles`, `barre`.

## Rapport attendu

Le rapport habituel, avec : où est passée chaque fonction de l'accueil et des bibliothèques, les textes neufs, les scripts du banc adaptés et les changements de texte attendus.
