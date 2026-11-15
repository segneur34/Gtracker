# 404 · Dette de structure relevée par la revue du 15/11

Ce que l'équipe technique d'un acheteur relèverait, sans effet visible pour l'utilisateur. À piocher par morceaux ; chaque morceau est un lot à lui.

## Ce qui pèse sur le prix

1. **Pages en une seule fonction** : `SurfModule` (714 lignes dans la fonction), `StatisticsPage` (683, 29 `useMemo`), `PlanningPage` (680, 20 états ; déjà à l'élément 309), `SailingModule` (676), l'écran d'enregistrement (550, 14 états). Le calcul est déjà sorti ; c'est l'assemblage qui déborde. Premier pas utile : un `components/surf/` symétrique de `components/sailing/` (liste des vagues, rame, graphes et réglages du surf vivent encore dans la page), et les identifiants de panneaux écrits de la même façon des deux côtés.
2. **Interface sans test dans la vérification automatique** : aucun test de rendu, `pages/` sans test, et le banc (76 scripts, dont 70 rendent un verdict, Chrome trouvé sous Windows, macOS et Linux) n'est pas dans `.github/workflows/verif.yml`. Y brancher une poignée de scripts stables serait le meilleur rapport ; `fluidite-compile.mjs` reste lié à Windows.

## Remarques

3. **Typage un cran plus strict** : `noUncheckedIndexedAccess` absent alors que le code de traces fait environ 970 accès par indice ; `.oxlintrc.json` réduit à une catégorie ; `tsconfig.node.json` sans `strict` ; fiche allégée typée comme une fiche entière (`library/record.ts`, vers 867) ; 22 tests contournent l'absence des types Node.
4. **`hooks/` ne contient pas que des hooks** : magasins, accès aux fichiers, et environ 7 200 lignes de logique avec entrées-sorties (`hooks/sessionLibrary/`, `hooks/recorder/`).
5. **Tuiles de carte au téléphone** : chaque tuile traverse le pont natif en texte, dans les deux sens, et la première carte attend l'index complet du dossier des tuiles (`platform/tileCache.ts:57-104`). `Capacitor.convertFileSrc` laisserait la WebView lire le fichier. Risque sur l'éviction.
6. **Démarrage** : 721 ko de JavaScript avant le premier affichage, en chaîne, puis jusqu'à 1,5 s d'attente de la mémoire (`main.tsx:35-41`, `boot.tsx:27,33`) ; 60 à 90 ko ne servent qu'à l'import (`importer`, `fitParser`, `legacyImport`…) et pourraient se charger à la demande. À mesurer au téléphone avant d'y toucher.
7. **Android** : une position ponctuelle (Itinéraires) lance le service au premier plan (`platform/location.ts:373-405`) ; filtres d'intention larges (`AndroidManifest.xml` : `application/octet-stream`, `text/xml`) ; dossier mémoire à redésigner si Android tue l'application pendant le sélecteur (`MemoryFolderPlugin.java:103-104`) ; `minWebViewVersion` sans page d'erreur ; `viewport-fit=cover` absent pour l'affichage bord à bord ; R8 coupé.
8. **Fenêtres** : `Dialog` ne prend ni ne rend le focus (`components/ui/Dialog.tsx:21-48`).
9. **Outils de l'atelier que la livraison (308) doit retirer** et que sa fiche ne cite pas : `outils/backlog.mjs`, `fin-de-lot.mjs` et leurs tests, `outils/banc/SCRIPTS.md`, `lancer-gtracker.bat` ; les cliquets `landWords.test.ts`, `heritage.test.ts` et `outils/heritage.json` ne parlent qu'à l'histoire du projet.

## Choix d'architecture que la revue remet en cause, à garder en tête

Deux systèmes d'unités (`sailing/` en nœuds, règle 5) ; le texte français comme clé de traduction ; les formats persistés en français (`reglages/`, `?activite=`) ; les tests sans isolation (`isolate: false`). Aucun n'est à changer sans plan dédié.

## Relevé pendant le paquet 394 à 400 (15/11), à piocher ici

- Page Sessions : les lignes hors écran ne sont pas allégées (`content-visibility`), parce que le retour à la position retenue se compte en pixels (`hooks/useRetainedScroll.ts`) et tomberait à côté dès que des lignes ont des hauteurs différentes ; il faudrait retenir la ligne affichée plutôt que des pixels.
- `TrackPoint.time` (heure en texte de chaque point) traverse encore du calcul en arrière-plan à la page : aucun lecteur dans l'application, deux tests le relisent (`surfing/surfAnalysis.test.ts`, copie gelée de `core/prepareTrack.test.ts`).
- `summarizeGpxText` (image de partage d'une session pas encore rangée) tourne encore sur le fil de l'affichage.
- Le texte du GPX repart à chaque demande d'analyse (seuil, vent, couleurs) ; à n'envoyer que si la mémoire du calcul ne tient plus la session, si une mesure le montre coûteux. Un changement de bornes de couleur renvoie toute la demande.
- « Tout supprimer » ne vide pas le sous-dossier `journaux` du dossier mémoire (journaux d'enregistrement rendus à l'utilisateur, lot 396) : à décider.
- Un journal d'enregistrement que le téléphone n'arrive pas à lire reste dans le dossier privé, retenté à chaque lancement : rien ne permet de le copier vers le dossier mémoire sans le lire.
- `docs/DECISIONS.md` §9, « Pas de carte Bravo avant les objectifs » : phrase laissée telle quelle au retrait de la plante ; l'objectif « par semaine » retiré en faisait peut-être partie, à relire avec l'utilisateur.
- Deux calculs en arrière-plan (analyse, fond) : la mémoire de la trace est doublée tant qu'une analyse est ouverte ; à regarder sur un téléphone modeste.
