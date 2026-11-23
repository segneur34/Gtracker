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

## Mesures du 23/11

Version 0.02.24 compilée (`fluidite-compile.mjs`, poste seul), ralenti ×6, 14 sessions en mémoire, deux prises par état (prise 1 / prise 2), fenêtre de 8 s. La première prise de chaque série est une prise « chaude » (Profil rendu vers 0,4 s), la seconde plus lente (0,8 s) : l'écart tient à la machine, pas à l'état mesuré.

**Constat qui corrige le lot 517.** La mesure « sans préchargement » du lot 517 neutralisait tous les `requestIdleCallback` de la page, pas seulement celui du préchargement : elle retirait aussi le calcul du banc de poissons du Profil (`FishSchool`, au plus tard une demi-seconde après le premier rendu). Le gel de 0,53 s n'est pas celui du préchargement : c'est celui du banc de poissons. Le script neutralise désormais seulement les appels sans échéance (ceux du préchargement).

| Démarrage, ×6, 8 s | Profil rendu | Interactif | Tâche max | Bloqué (nb) |
|---|---|---|---|---|
| Avant : avec préchargement (68 modules) | 0,41 / 0,80 s | 1,81 / 2,34 s | 0,53 / 0,52 s | 1,04 (3) / 1,60 (8) s |
| Avant : préchargement seul neutralisé (36 modules) | 0,46 / 0,77 s | 1,92 / 1,94 s | 0,53 / 0,53 s | 1,23 (3) / 1,14 (5) s |
| Avant : tous les `requestIdleCallback` neutralisés (mesure du lot 517) | 0,45 / 1,20 s | 0,45 / 1,20 s | 0 / 0,18 s | 0 / 0,34 s |
| Essai : préchargement différé de 10 s et de 2 s de repos sans geste (36 modules dans la fenêtre) | 0,42 / 0,80 s | 1,75 / 2,16 s | 0,50 / 0,53 s | 1,08 (4) / 1,53 (8) s |

Les tâches longues sont les mêmes avec et sans préchargement : une de 0,5 s vers 0,5 à 1,0 s (juste après l'arrivée de la page Sessions, mais présente sans préchargement), puis deux de 0,25 à 0,3 s vers 1,1 et 1,6 s ; le profil par fonction nomme `FishSchool` (calcul du banc) et `toBlob` (vignettes), le reste est du travail natif sans nom (analyse du code). Le préchargement ne pèse que par le temps de réception et d'analyse de ses morceaux, étalé sur 1 à 2 s, sans tâche plus longue que 0,3 s.

| Première ouverture après le Profil (×6, durée jusqu'au contenu) | +0 s | +4 s |
|---|---|---|
| Sessions, avec préchargement | 0,49 / 0,44 s | 0,41 / 0,43 s |
| Sessions, sans préchargement | 0,67 / 0,46 s | 0,41 / 0,43 s |
| Enregistrer, avec | 0,41 / 0,54 s | 0,40 / 0,46 s |
| Enregistrer, sans | 0,45 / 0,46 s | 0,48 / 0,47 s |
| Analyse, avec | 0,53 / 0,59 s | 0,42 / 0,39 s |
| Analyse, sans | 0,60 / 0,44 s | 0,44 / 0,51 s |

Le préchargement ne fait gagner aucune durée mesurable à l'ouverture (écart dans le bruit, 0 à 0,1 s), sur la boucle locale de la mesure.

**Décision d'après la règle de la fiche** : le gel au démarrage ne passe pas sous 0,5 s (0,50 à 0,53 s avec le remède essayé, comme sans), parce qu'il ne vient pas du préchargement. `src/App.tsx` est remis dans son état de départ ; rien ne change dans l'application. Pistes pour un autre lot : étaler ou alléger le calcul du banc de poissons du Profil (gel de 0,5 s puis deux de 0,25 à 0,3 s à ×6), et les vignettes (`toBlob`) ; ou retirer le préchargement, qui ne rapporte rien mesurable sur la boucle locale (à juger sur un vrai téléphone, où la lecture des morceaux n'est pas celle d'un serveur local).

Non mesuré : un vrai téléphone ; la boucle réseau d'un navigateur distant (où le préchargement pourrait gagner) ; le ralenti ×1 ; le calcul du banc de poissons isolé (neutralisé seul), ce qui confirmerait la part exacte des 0,5 s.

## Limites

Un seul fichier de l'application attendu (`src/App.tsx`), plus son essai s'il y en a un. Aucun texte visible. Les chiffres vont dans cette fiche (tableau avant / après), pas dans le code.
