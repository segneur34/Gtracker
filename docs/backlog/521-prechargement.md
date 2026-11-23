# 521 · Démarrage : le préchargement des pages ne fige plus l'écran

Modèle | Réflexion : Sonnet | high

Suite du lot 517 (`docs/backlog/517-mesures-lenteur.md`, lignes « Démarrage ») : au ralenti × 6, le préchargement des pages fige l'écran 0,53 à 0,57 s (0,19 à 0,21 s sans lui) et repousse le moment « utilisable » de 1,7 s à 2,2 à 2,6 s. Accord de l'utilisateur du 23/11 pour un petit lot avant la vente, mesuré avant et après.

## Ce qui existe

`preloadPages` (`src/App.tsx`) : une fois la première page rendue, il charge les pages une à une par `requestIdleCallback` (repli : 1,5 s), dans l'ordre Sessions, Enregistrer, analyses, Statistiques, Réglages, Planifier, Itinéraires, test de FC repos, tutoriels. Le gel mesuré est la plus longue tâche : très probablement l'évaluation d'un gros morceau (`vendor-charts` 413 ko, `vendor-map` 145 ko, `useSessionLibrary`), qu'un simple étalement ne coupe pas.

## À faire

1. **Mesurer d'abord** (poste calme, rien d'autre ne tourne) : `outils/banc/fluidite-compile.mjs` et `outils/banc/fluidite.mjs` (lire leurs en-têtes et `outils/banc/LISEZMOI.md`), ralenti × 6, démarrage avec et sans préchargement, deux prises ; relever quelle tâche fait le gel (profil par fonction `FLUIDITE_PROFIL` si le script le permet, sinon la liste des longues tâches et le morceau chargé à ce moment).
2. **Choisir le remède le plus petit** qui passe sous 0,5 s de gel pendant les 8 premières secondes : par exemple ne commencer le préchargement qu'après un vrai temps de repos (premier écran affiché et quelques secondes sans geste), charger en dernier les gros morceaux que la première page n'emploie pas, laisser un repos entre deux morceaux. Ne pas toucher au découpage du build (`vite.config.ts`) sans le dire.
3. **Mesurer après**, mêmes conditions : gel au démarrage, moment « utilisable », et temps de la première ouverture de Sessions, d'Enregistrer et d'une analyse juste après le démarrage (elle ne doit pas ralentir de façon sensible : une page ouverte avant son préchargement se charge à la demande, comme aujourd'hui).
4. Si aucun remède simple ne passe sous 0,5 s, ou si la première ouverture d'une page y perd : ne rien changer, rendre les chiffres et le dire. Le lot ne vaut que par ses mesures.

## Limites

Un seul fichier de l'application attendu (`src/App.tsx`), plus son essai s'il y en a un. Aucun texte visible. Les chiffres vont dans cette fiche (tableau avant / après), pas dans le code.
