# 362 · Profil : le bouton de période, plus petit, à droite, « 2026 » seul

Retouche du lot 358 (fiche `docs/backlog/358-profil-periode-un-bouton.md`, à lire d'abord : elle dit où est le bouton et comment sa période est mémorisée). Modèle | Réflexion : Sonnet | medium.

## Demande

Essai 239 du 13/11, sur l'APK 0.00.43. Le bouton marche (il bascule entre l'année et « Tout », les chiffres suivent), mais l'utilisateur le veut autrement : « en plus petit et à droite, juste "2026" ».

## À faire

1. Le bouton affiche l'année seule, « 2026 » (l'année civile en cours, jamais écrite en dur), au lieu d'« Année 2026 ». L'autre état reste « Tout ».
2. Il est calé à droite de sa rangée, sur téléphone droit, téléphone tourné et ordinateur.
3. Il est plus petit : la taille des petites pastilles de l'application (variables de `src/theme/tokens.css`, aucune valeur en dur), toujours en pilule, et sa zone tactile reste confortable au doigt.
4. Pour un lecteur d'écran, son nom dit toujours la période entière (« Année 2026 » ou « Tout »), puisque « 2026 » seul ne dit pas que c'est une période.
5. `docs/DECISIONS.md` §9 est accordé dans le même travail : le bouton affiche « 2026 », calé à droite, en petit (décision du 13/11) ; l'année civile reste la règle.
6. Le script `profil` du banc est adapté s'il lit le libellé du bouton, et son journal (`outils/banc/SCRIPTS.md`) le dit.

## Ce qui ne change pas

La bascule, la période mémorisée et le repli d'une ancienne période sur l'année ; les Statistiques ; le reste de la page Profil.

## Tranché par l'orchestrateur

- L'autre état reste « Tout » : l'utilisateur n'a parlé que de l'année.
- Le nom lu par un lecteur d'écran garde « Année 2026 ».

## Vérification

`node outils/verif.mjs --rapide` par l'agent ; `npm run verif` puis `node outils/banc/passe.mjs profil` par l'orchestrateur (seul changement attendu : le libellé du bouton).

## Essai au téléphone

Regarder le bouton « 2026 » en haut à droite du Profil, téléphone droit puis tourné, et le toucher deux fois.
