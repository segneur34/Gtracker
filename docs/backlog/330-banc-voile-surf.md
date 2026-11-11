# 330 · Banc remis sur la voile et le surf : découpage en trois parties

Brief : `docs/backlog/319-revue-apres-fork.md`, section « ## Lot 330 », lignes 1885 à 2073 (à lire par `offset`/`limit`, jamais le fichier entier ; le tableau des 79 scripts est aux lignes 1926 à 2012). Ses numéros de ligne datent du commit `ddc7b57` : tout revérifier dans le code d'aujourd'hui. Cette fiche dit ce qui a changé depuis et l'ordre retenu ; elle prime sur le brief.

## Ce qui a changé depuis le brief (état au 11/11 au soir)

- Le renommage (lot 322) est fait : clés `gtracker.*`, `window.gtrackerBack`, brouillon `gtracker-banc`, plus aucun « tracker » seul dans `outils/`. La « vague 1 bis » (constantes posées avant le renommage) n'a plus d'urgence : ne poser une constante dans `lib/cdp.mjs` que si elle évite une recopie dans les scripts réécrits.
- `lib/cdp.mjs` est déjà sur le port 5174 ; `shots.mjs` est encore sur 5173.
- `scripts.mjs` : `PASSAGE_COURANT` vaut encore `general, library, statistiques, profil, planning, onglets, bench, familles, cardio`, et `PAGES` porte encore `course`, `velo`, `fractionne`.
- Lot 304 (planification réduite) : plus de calcul d'itinéraire, de revêtement, de types de voie ni d'altitude du terrain ; `planning` se met encore en Course et ouvre l'onglet du revêtement, 16 scripts bloquent encore les hôtes du calcul d'itinéraire, `donnees.mjs` écrit le revêtement et l'altitude du terrain, `balises` et `planification-verrou` ne posent plus leur troisième balise (ce sont les scripts : l'essai au téléphone du 11/11 a posé ses trois balises).
- Lot 335 (onze activités de départ) : l'activité de voile par défaut s'appelle « Wingfoil » et non plus « Voile » ; `notification`, `gps-perdu` et `session-save-resume` butent sur le préfixe « Voile » de la notification et des titres ; `reglages` sort en erreur des deux côtés.
- Lot 313 (la fin d'un enregistrement ouvre l'analyse) : la carte « Session terminée » n'existe plus que comme filet ; `materiel-fin` et `partage` l'attendent encore (5 échecs de `partage` des deux côtés) ; `rendus` enregistre encore « À pied ».
- Lot 341 : le menu « … » dit « Partager l'image », la fenêtre aussi ; `partage.mjs` et `satellite.mjs` suivent déjà.
- Lot 328 a : `manoeuvres-diagnostic.mjs` est déjà adapté (ne pas y toucher).
- Vus aussi le 11/11 : le script `partage` rend une image différente avant et après même sur un arbre intact, `miseajour` plante des deux côtés, `imports` est marqué manuel et n'est plus joué, `cardio` montre une graduation de plus d'un côté (« 170 ») quel que soit le lot.

## Trois parties, dans cet ordre

**A · Socle et enregistrement.** Restes de la vague 1 (`shots.mjs`, `PAGES`, étiquettes et `pages` de `scripts.mjs`, `PRECHAUFFE` de `passe.mjs`, `reduire.mjs`, `reglages-aide.mjs`, `energie-fc-diagnostic.mjs` retiré, commentaires périmés) ; `lib/traces.mjs` (vague 2 : `traceVoile`, `traceSurf`, `traceLongue`, `traceSansType`, en-tête commun) ; puis les scripts de l'enregistrement et de sa fin, réparés et sans `manuel` : `notification`, `gps-perdu`, `session-save`, `session-save-resume`, `materiel-fin`, `partage`, `rendus`. Ce sont les preuves du lot 329 (découpage de `useRecorder.ts`) : ils doivent sortir sans échec sur l'arbre d'aujourd'hui.

**B · Passage courant, bibliothèque et import.** `familles`, `statistiques`, `profil`, `racine`, `racine-periodes` ; `library`, `imports` devenu `import-session` (la porte d'import, point 9 du brief, sur le jeu d'essai `src/test/legacyImport.fixture.ts`), `import-fit`, `fichier-recu`, `miseajour`, `donnees`, `classer` ; `PASSAGE_COURANT` recomposé (point 6 du brief) ; fini quand `node outils/banc/passe.mjs -j 1` (passage courant, sans nom) ne rend aucun échec.

**C · Cartes, Réglages, le reste, et les documents.** `carte-perf`, `carte-reveil`, `survol`, `vignettes`, `vignettes-relance`, `zoom-carte`, `satellite`, `fluidite` ; `reglages`, `reglages-aide`, `prereglages`, `icones`, `cacher`, `materiel` ; `activite`, `aides`, `barre`, `coquille`, `notes`, `onglets`, `tailles`, `vides`, `planning`, `balises`, `planification-verrou` ; scripts à supprimer (`boucle`, `denivele-direct`, `recherche-sans-reponse`, `surface`, s'ils existent encore) ; `outils/banc/LISEZMOI.md`, `outils/banc/SCRIPTS.md`, `outils/LISEZMOI.md` remis d'accord (point 7 du brief), puis ajoutés à `DOCUMENTS` de `outils/docs-cites.mjs` s'ils passent.

## Règles communes

- On ne modifie que `outils/` (et `outils/docs-cites.mjs`, `outils/docs-inventaire.mjs` pour leurs listes). Jamais `src/`, `android/` ni `docs/` hors cette fiche. Si un script révèle un vrai défaut de l'application, il se signale dans le rapport, il ne se corrige pas.
- Un script réécrit n'éprouve que de la voile ou du surf, sur les traces de `lib/traces.mjs`, et perd son `manuel`. Chaque `check` gardé doit pouvoir échouer : un script qui n'injecte plus rien passe « neutre » à tort.
- Preuve d'un script réécrit : il sort sans échec sur l'arbre d'aujourd'hui par `node outils/banc/passe.mjs <script> -j 1 --sans-cache`, et ses `check` se lisent un par un dans le relevé. Toujours `-j 1`. Lire d'abord `outils/banc/LISEZMOI.md` (mode d'emploi, pièges du poste).
- Pendant qu'un script du banc tourne, ne lancer ni `vitest` ni `npm run verif` (le serveur du banc les fait échouer). D'autres agents peuvent éditer des commentaires dans `src/` en même temps : un relevé qui change à cause d'eux n'existe pas (commentaires seuls) ; jamais de `git stash`, `checkout`, `restore` ni `clean`.
- Ne pas retirer un symbole de `src/` ; les `export` que le banc lit (`surfProfileOf`, `waveTurnTrace`, `pumpSignal`, `pumpCadence`, `imuSynthetic.fixture.ts`) restent.
- Questions du brief déjà tranchées : l'import FIT est gardé ; `classer` (session sans type) reste une fonction ; « Bateau » est une activité de départ, cachée ; `energie-fc-diagnostic` est retiré.

## Partie A, décisions d'exécution (11/11)

- Restes de la vague 1 : `shots.mjs` sur 5174, `PAGES`, étiquettes et `pages` de `scripts.mjs` sans `course`, `velo`, `fractionne`, `PRECHAUFFE` avec `/surf` et `/itineraires/liste`, `reduire.mjs` et `reglages-aide.mjs` sur deux familles, commentaires périmés retirés. `energie-fc-diagnostic.mjs` n'existait plus.
- `lib/traces.mjs` : `traceVoile` (motif de `make-gpx.mjs`, octet pour octet à `virageMin: 3`), `traceSurf` (phases), `traceLongue`, `traceSansType`, `enveloppeGpx` et `pointGpx` (en-tête `creator="banc"`). Options de `traceVoile` : `secondes` (coupe net), `sauter` (trou de trace), `fc`, `hz`. `traceDeVoileAvecFiche` reste à la partie B (porte d'import).
- `session-save` n'a plus l'argument `{gpx}` (il fabrique sa trace) ; `session-save-resume` est autonome (il importe sa session, enregistre un seuil, passe la session de Wingfoil à Kite) : plus de `manuel`.
- `materiel-fin` est réorienté : la fin d'un enregistrement ouvre l'analyse, la rangée « Matériel » de la carte « Session terminée » n'est plus atteinte que par une session reprise encore continuable (`SessionEndGear`, filet). Le script éprouve maintenant le choix de pièce dans l'onglet « matos et conditions » (brouillon, fiche, rechargement, rien repris, Surf sans liste). À décider : garder ce script réorienté, le retirer, ou rétablir le choix à l'arrêt ; `DECISIONS.md` §2 dit encore « proposé sur la carte Session terminée ».
- `partage` : la taille du PNG varie d'un passage à l'autre parce que le fond est fait des tuiles d'OpenStreetMap lues en direct (même passage : taille identique ; sans tuiles : 263 753 octets chaque fois ; avec : 1 265 694, 1 264 236, 1 264 159 sur trois passages). Le script ne relève plus la taille.
- `rendus` : un verdict par plafonds larges (page entière non redessinée, carte réduite sans carte, accueil sans chiffres) ; comptes masqués au relevé.
