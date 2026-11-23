# Architecture de Gtracker

Les règles d'architecture du code, puis ce qu'il faut toujours faire en ajoutant du code. Le code y renvoie par « règle N » : les numéros ne changent pas. Les tests de `src/` en gardent une partie, nommés règle par règle ; les dépendances entre couches sont au §3 de `docs/ETAT_DU_PROJET.md`, la carte des fichiers dans `docs/INVENTAIRE.md`.

<!-- atelier -->
Ce fichier est remis avec le dépôt et importé par `CLAUDE.md`. Un renvoi à un fichier qui ne part pas avec le dépôt remis (`outils/livraison.mjs`, liste `ATELIER`) va dans un bloc d'atelier, entre une ligne `<!-- atelier -->` et une ligne `<!-- /atelier -->` seules, et le texte doit rester juste sans ses blocs.
<!-- /atelier -->

## Règles d'architecture

1. `src/core/` en unités SI (m/s, m, s ou ms, caps en degrés). Conversion en sortie seulement (`core/units.ts`, profil du support).
2. Fenêtres en secondes, jamais en nombre de points : une trace à 1 Hz et à 5 Hz donne le même résultat (testé).
3. Un seuil qui dépend du support ou que l'utilisateur règle vient de `SPORT_PROFILES`, est passé en paramètre, surchargeable, et la surcharge est persistée. Une constante d'algorithme, commune à tous les supports, est une constante nommée et commentée de son module, passée en option avec son défaut quand un test doit la faire varier.
   <!-- atelier -->
   En voile : `docs/DECISIONS.md` §1.
   <!-- /atelier -->
4. En voile, un seuil de vitesse s'accorde à l'allure de la session (`core/sessionSpeed.ts`), surchargeable. Les valeurs du profil sont des plafonds : la mise à l'échelle ne fait qu'abaisser. Elle est appliquée dans les hooks, jamais par défaut dans les calculs (tests neutres). Préférer un rapport sans dimension à des nœuds absolus (vol perdu : conservation de vitesse sous 0,5).
5. `sailing/*` travaille en nœuds sur `PointData` (`sailing/pointData.ts`) : héritage assumé, pas de conversion sans plan dédié.
6. Distance = intégrale de la vitesse retenue (`segmentDistanceM`), ni celle du fichier ni une somme de Haversine ; seule exception, le trou de trace (pas plus long que `maxGapS`, 10 s), borné par la corde × 1,5 et hors du mouvement s'il est immobile (`gapDistanceM`, posé par `computeKinematics`).
7. Vent : lu à la bissectrice de chaque manœuvre classée, toutes comprises ; statistiques pondérées par la symétrie du virage, jamais filtrées (`calculateWindStats`). L'estimation globale (`estimateWind`) repose sur la polaire et les manœuvres à caps stabilisés (`windSamplesFrom`). Polaire glissante et corde entrée → sortie ont été essayées puis retirées : ne pas les réintroduire.
8. Lecteur GPX maison (`core/gpxParser.ts`) : ne pas réinstaller `gpxparser`, qui ignore les extensions (Doppler, FC, cadence).
9. Une famille, un module d'analyse, une adresse (`/voile/analyse`, `/surf/analyse`, `core/parentPage.ts`) ; le module ne reprend que les activités de sa famille : `useSportSettings(family)`. Une session qui change de famille change de module.
10. Cadence variable : une application économique peut compresser un virage entier dans un seul intervalle. Ne jamais supposer plusieurs points dans une fenêtre de quelques secondes.
11. Cartes : composants maison sur `leaflet` (`components/map/`), jamais `react-leaflet` ; le style d'un trait ou d'un rond passe par `pathOptions`, réappliqué (`setStyle`) quand l'objet change : le garder stable (constante ou `useMemo`).
12. Stockage, fichiers (reçus d'une autre application compris), position, son, vibreur, capteurs, ceinture cardio, autorisations, notification, écran allumé et orientation figée : uniquement via `src/platform/` (liste des modules : `docs/INVENTAIRE.md`), chaque module y choisissant sa version navigateur ou téléphone par `isNativeApp()`, et sa version programme Windows par la présence du pont de la coquille. Hors de ce dossier, ni API du navigateur pour ces capacités, ni paquet `@capacitor/*` ou `@capgo/*`, ni pont de la coquille (`gtrackerBureau`) : `src/architecture.test.ts` le garde (`PLATFORM_ONLY`).
13. Deux familles seulement, voile et surf (`SPORT_FAMILIES`) : ni course à pied, ni vélo, ni Entraînement, ni allure en min/km, ni dossier `running`, `cycling` ou `land`. Aucune donnée d'une autre application n'est relue hors de la porte d'import (`library/legacyImport.ts`). Garde : `src/architecture.test.ts`.
    <!-- atelier -->
    L'ancien nom n'est pas écrit (seule exception : le nom sans son G, sous le logo GONG du Profil). Gardes de plus, qui ne partent pas avec le dépôt remis : `src/landWords.test.ts` (relevé `outils/heritage.json`, qui ne fait que baisser) et `src/heritage.test.ts`.
    <!-- /atelier -->
14. Un commentaire de `src/` tient seul : ni numéro de lot, ni question, ni numéro du reste à faire, ni renvoi au journal, ni date d'atelier ; la raison s'écrit en clair. `src/architecture.test.ts` le garde (tests compris, dates exceptées), avec une liste de faux amis qui ne fait que diminuer.

## Toujours, en ajoutant du code

Les recettes des ajouts plus rares (calcul de support, réglage utilisateur, page d'analyse, onglet, métrique de manœuvre, calcul de glisse) sont dans `docs/DEVELOPPER.md`, « Où ajouter quoi ». Ce qui suit vaut pour tout ajout :

- Famille (`sportFamily`, écrite dans le profil du calcul : `docs/GLOSSAIRE.md`) : elle range les activités et choisit module, onglets, unités et chiffres du direct ; à l'intérieur d'une famille, un comportement se lit dans les capacités du profil, jamais par un nom de calcul en dur (`=== 'kite'`) : `src/architecture.test.ts` le garde, hors des tables qui décrivent les calculs (`SPORT_TABLES`).
- Graphe relié à la carte, surbrillance sur la carte d'une analyse : `docs/MISE_EN_PAGE.md` (« Graphes reliés à la carte », « Une seule surbrillance »).
- Donnée propre à une session (notes, vent saisi, seuil d'activité, allure imposée, foil, pumping, repères du bouton « Note », support et activité) : dans sa fiche (`library/record.ts`), écrite par `updateSessionRecord` (`hooks/sessionLibrary/sessionRecords.ts`) ; dans le module, par le brouillon (`useSessionDraft`, `library/sessionEdits.ts`) et « Enregistrer la session » ; jamais dans une clé de l'appareil. Une donnée recalculable depuis le GPX va dans `summary`, avec `SUMMARY_CALC_VERSION` augmenté si son calcul change.
- Calcul pur : dans `core/`, `sailing/`, `surfing/`, `planning/`, `recording/` ou `library/`, avec son `*.test.ts` sur trace synthétique.
- Texte visible : par `t` ou `tn` (pluriel, `core/i18n.ts`), `tRich` ou `tnRich` pour une phrase à balises (`components/tRich.ts`) ; la clé est le texte français, toujours un littéral ; une donnée enregistrée se traduit à l'affichage, jamais à l'écriture. Dictionnaires `src/locales/en.json` et `es.json`, sans clé manquante ; gardes `outils/i18n.mjs` et `src/i18nGuard.test.ts`.
- Couleur, police, rayon, espacement : une variable de `src/theme/tokens.css`, jamais une valeur en dur dans un écran neuf. Composants communs dans `components/ui`, icônes dans `components/icons.tsx` (pas d'emoji). Les couleurs de données des graphes et de la carte restent en dur (attributs SVG). Styles en ligne : `outils/styles-en-ligne.json` fige leur nombre par fichier, qui ne fait que baisser, et un fichier neuf n'a aucun `style={{` (`src/theme/inlineStyles.test.ts`).
