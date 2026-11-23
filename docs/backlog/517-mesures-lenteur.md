# 517 · Mesures de lenteur et de mémoire (E-01, E-02, E-04)

Mesures du 23/11/2026, version 0.02.24 compilée (`fluidite-compile.mjs`, Chrome sans fenêtre sur le poste de travail, seul sur la machine), session synthétique de voile de 4 h à 5 points par seconde (72 000 points, 9,4 Mo de GPX), 12 autres sessions d'une heure en mémoire. Deux passages de deux prises chacun, ralenti du processeur ×1 (le poste) et ×6 (un Android moyen). « Gel » = plus longue tâche qui bloque le fil de la page. Le tas est relevé après un ramasse-miettes forcé, pour la page et pour les calculs de fond (un fichier de calcul de fond par file, deux après un changement de seuil). Le relevé du tas est neuf dans `outils/banc/fluidite.mjs`.

## Chiffres (fourchette des deux passages)

| Mesure (4 h à 5 Hz) | ×1 | ×6 |
|---|---|---|
| Ouverture de l'analyse : jusqu'aux chiffres | 1,21 à 1,23 s | 2,8 à 3,6 s |
| Ouverture : gel (temps bloqué en tout) | 0,11 à 0,12 s (0,26 s) | 0,73 à 1,0 s (1,6 à 2,4 s) |
| Changement de seuil : jusqu'aux chiffres | 0,07 à 0,08 s | 1,03 à 1,04 s |
| Changement de seuil : écran calme / gel | 0,33 s / 0,10 s | 1,35 à 1,53 s / 0,57 à 0,66 s |
| Démarrage (préchargement des pages) : Profil / utilisable | 0,17 à 0,33 s / 0,32 à 0,56 s | 0,83 à 0,88 s / 2,2 à 2,6 s |
| Démarrage : gel (temps bloqué sur 8 s) | 0,10 à 0,12 s (0,10 à 0,22 s) | 0,53 à 0,57 s (1,4 à 1,5 s) |
| Démarrage sans préchargement : gel | 0 | 0,19 à 0,21 s (0,46 à 0,53 s) |
| Tas à l'ouverture : page / calcul de fond | 48 Mo / 50 Mo | idem |
| Tas après un changement de seuil : page / calcul de fond | 80 Mo / 100 Mo | idem |
| Tas au démarrage (préchargement) : page / calcul de fond | 107 Mo / 100 Mo | 117 Mo / 100 Mo |
| Tas au démarrage sans préchargement : page | 48 à 50 Mo | idem |

Point de comparaison, 1 h à 1 point par seconde (3 600 points, un passage de deux prises) : ouverture jusqu'aux chiffres 0,11 s (×1) et 0,41 s (×6), gel 0 puis 0,125 s ; changement de seuil 0,05 s et 0,38 s, gel 0 puis 0,34 s ; tas 9 à 10 Mo / 4 Mo à l'ouverture, 24 Mo / 7 Mo après un seuil. La lecture du GPX ne passe plus par la page (aucun `DOMParser` mesuré).

## Taille du build (`dist/assets`, 79 fichiers JS, 2 775 ko ; hors images et polices)

Chargé au démarrage (`index` et `boot` avec leurs importations directes, 28 fichiers) : 1 016 ko, 345 ko compressés. Les plus gros : `boot` 404 ko (131 gzip), `useSessionLibrary` 356 ko (119), `icons` 59, `HoldButton` 42, `chunk-6KYCQHYJ` 38, `screen` 29, `activityLogos` 23.

À la demande (pages, 41 fichiers, 1 172 ko, 370 gzip), préchargées après le premier écran : `vendor-charts` 413 ko (114 gzip), `vendor-map` 145 (42), `LogoSprite` 107 (36), `ZoomView` 70 (24), `SettingsPage` 66 (20), `SailingModule` 63 (20), `RecordingPage` 39, `SurfModule` 35, `StatisticsPage` 29, `PlanningPage` 23, etc. Autres morceaux à la demande (587 ko, 182 gzip) : traductions `es` 248 ko (73) et `en` 235 (70), calcul de fond `trackWorker` 90 ko (34), modules du système Android.
Hors JS : quatre fonds `champ-*.webp` de 281 à 420 ko chacun (1,4 Mo en tout, non compressibles), feuille de style 129 ko (27), en-têtes 97 et 43 ko.

## Conclusion

Règle de la fiche 508 : refaire le calcul de fond seulement si l'écran reste figé plus de 0,5 s au ralenti ×6.

- E-01 (très longue session) : confirmé, et au-dessus du seuil. À 4 h, 5 points par seconde et ×6, l'écran se fige de 0,73 à 1,0 s à l'ouverture et de 0,57 à 0,66 s à un changement de seuil, et les chiffres mettent 3 à 4 s à venir. Sur le poste, rien (0,1 s). Pour l'usage courant (1 h à 1 Hz), le gel reste sous 0,35 s : le défaut ne touche que les sessions rares et très longues. Un lot de code est justifié par la règle (trace en tableaux transférables), mais son gain se verra seulement sur ces sessions ; priorité basse. Le profileur n'a pas été lancé : où part le gel (réception des résultats ou redessin) reste à dire au début du lot.
- E-02 (démarrage) : confirmé en partie. Le poids chargé avant le premier écran est de 1 016 ko (345 compressés), plus que les 941 ko de la fiche (autre manière de compter). Le préchargement des pages gèle l'écran 0,53 à 0,57 s à ×6 (0,19 à 0,21 s sans lui) et repousse le moment « utilisable » de 1,7 s à 2,2 à 2,6 s ; la fiche annonçait 0,8 s, ce n'est pas ce qu'on mesure. Juste au-dessus du seuil de 0,5 s : un lot est défendable, mais petit (précharger par morceaux ou après le premier geste), à juger au téléphone.
- E-04 (mémoire) : confirmé à peu près, sans gravité. L'analyse de 4 h garde 50 Mo dans le calcul de fond à l'ouverture et 100 Mo après un changement de seuil (deux files, chacune avec la trace), plus 48 à 80 Mo dans la page : de 100 à 180 Mo en tout, d'où les « environ 200 Mo » du constat. Une page sans analyse tient autour de 48 Mo. Sur un téléphone de 3 Go ce n'est pas bloquant ; pas de lot seul, à traiter avec E-01 si ce lot se fait (la trace en tableaux typés réduit les deux).

## Non mesuré

Pas de profil par fonction (`FLUIDITE_PROFIL`) ; pas de téléphone réel (le ralenti ×6 du processeur n'imite ni la mémoire ni le stockage d'un Android) ; une seule cadence longue (5 Hz) à 4 h.

## Correction du 23/11 (lot 521)

La ligne « Démarrage sans préchargement » de ce tableau neutralisait tous les calculs différés de la page, pas le seul préchargement. Remesuré : le gel de 0,53 s du démarrage ne vient pas du préchargement mais du calcul du banc de poissons du Profil ; le préchargement ne produit aucune tâche de plus de 0,3 s. La conclusion E-02 ci-dessus est donc fausse sur sa cause. Chiffres : `docs/backlog/521-prechargement.md`.
