# 327 · Gardes d'architecture, première partie (étapes a, c et d)

**Modèle | Réflexion** : Sonnet | medium. À lancer après le commit du lot 304 (qui retire l'exception « # Profil Tracker » de `src/heritage.test.ts` et fait baisser les comptes).

Brief d'origine : `docs/backlog/319-revue-apres-fork.md`, section « ## Lot 327 · Gardes d'architecture » (tableau « Quand poser quoi », étape 327a avec ses extraits de code). Cette fiche le met à jour sur l'état du 11/11 ; en cas d'écart, elle l'emporte.

**But** : des tests qui empêchent le retour de la terre (course, vélo, Entraînement) et de l'allure en min/km, avec un cliquet pour les comptes qui baissent encore. Rien de visible pour l'utilisateur.

## Ce qui a changé depuis l'écriture du brief

- `src/heritage.test.ts` **existe déjà** (lot 322, 97 lignes) : il refuse le mot « tracker » sans « g » dans les fichiers suivis par git de `src/`, `android/app/src/`, `outils/`, `public/` et quatre fichiers isolés, avec des exceptions nommées, sans relevé figé. **Ne pas le réécrire** : la garde du nom de l'ancien projet est faite. `outils/heritage.json` n'existe pas.
- Comptes dans `src/`, tests compris, relevés le 11/11 avant le lot 304 (à refaire au moment de poser le test) : `min/km` 0 ; `runner|Runner|RUNNER` 36 dans 2 fichiers ; `'running'` 11 dans 7 ; `'cycling'` 8 dans 6 ; `[Ff]ractionn|[Mm]uscu|Entraînement` 35 dans 16 ; `[Vv]élo` 74 dans 35 ; `à pied|À pied` 16 dans 9 ; `Gravel|VTT` 5 dans 4 ; `segneur34` 5 dans 3.
- Le bloc « couture » de `src/architecture.test.ts` : commentaire `:157-162`, `TRANSVERSE` `:163`, `LAND_TARGETS` `:164`, `LAND_FILES` `:167` (vide), `SEAM` `:170` (vide), `describe` `:172`, ses `it` `:176`, `:184`, `:189`, `:194` ; un `it` sur les routes d'`App.tsx` suit à `:199` (à garder ou à fondre dans la garde des familles, selon ce qu'il vérifie).

## À faire

1. **Cliquet du vocabulaire de la terre** (327a et 327d) : un test neuf (par exemple `src/landWords.test.ts`, ou un second `describe` dans `heritage.test.ts` si cela reste lisible) et son relevé figé `outils/heritage.json`, sur la méthode de `src/theme/inlineStyles.test.ts` et `outils/styles-en-ligne.json` : pour chaque motif, un relevé fichier → nombre ; le test refuse une hausse ou un fichier absent du relevé, et signale une baisse pour qu'on fige plus bas. Il lit tous les `.ts`, `.tsx`, `.css` de `src/`, commentaires compris. Motifs à cliquet : `'running'`, `'cycling'`, `\b[lL]and[A-Z]\w+`, `[Ff]ractionn|[Mm]uscu|Entraînement`, `à pied|À pied`, `[Vv]élo`, `Gravel|VTT`, `runner|Runner|RUNNER`, `segneur34`. Un motif dont le compte est à zéro est refusé en dur. Le fichier du test lui-même et son relevé sont exclus du compte.
2. **Motifs en dur, zéro toléré** : `C:\\Users`, `\.claude/plans`, `D:\\gong`, et le chemin du poste (`/Users[\\/]+segne[\\/]+tracker|~\/\.claude\/plans/i`).
3. **Garde « aucune allure »** (327c) : `min/km` refusé en dur dans `src/` (compte 0 aujourd'hui).
4. **Retrait de la couture vide** dans `src/architecture.test.ts` (`TRANSVERSE`, `LAND_TARGETS`, `LAND_FILES`, `SEAM` et leurs quatre `it`) et de la phrase d'en-tête sur `land`, `running`, `cycling` : un dossier recréé n'aurait pas de ligne dans `ALLOWED` et ferait déjà échouer « chaque dossier de src/ a une règle ».
5. **Garde des familles et des routes** dans `src/architecture.test.ts` (extrait donné dans le brief d'origine) : chaque famille de `SPORT_FAMILIES` a ses adresses `/<famille>` et `/<famille>/analyse` dans `App.tsx`, et `SPORT_FAMILIES` vaut `['voile', 'surf']`.
6. Si `outils/docs-inventaire.mjs` ou `outils/docs-cites.mjs` doivent connaître le fichier neuf pour que `npm run verif` reste vert (carte d'INVENTAIRE), le dire dans le rapport : l'orchestrateur met à jour `docs/INVENTAIRE.md`, `CLAUDE.md` (règle 13) et `docs/ETAT_DU_PROJET.md` au commit.

## Hors de ce lot

- 327b (aucun nom de calcul en dur) : attend les lots 326 et 328.
- 327e (garde étendue, règle 13 seconde phrase) : attend le lot 307.
- Faire baisser les comptes : non, on fige l'état ; un faux ami se traite par une exception nommée, jamais par un motif élargi en silence.

## Vérification

- `npx vitest run src/architecture.test.ts src/heritage.test.ts` et le test neuf ; `node outils/verif.mjs --rapide`.
- Contre-épreuve à dire dans le rapport : ajouter à la main un `'running'` dans un fichier fait bien échouer le test (puis le retirer).
- Banc : sans objet (aucun code de l'application ne change).
