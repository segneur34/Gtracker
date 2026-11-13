# 365 · Analyses, à l'essai : les cadres des panneaux en un coup de pinceau plus fin

Modèle | Réflexion : Sonnet | high. Suite du lot 364 (fiche `docs/backlog/364-cadres-pinceau-profil.md`, à lire : même trait, même pièce). Disposition des analyses : `docs/MISE_EN_PAGE.md`, de même autorité que `CLAUDE.md`, à lire avant de toucher à un panneau, et à accorder dans le même travail pour ce seul point.

## Demande de l'utilisateur (13/11)

En voyant la planche finale des cadres du Profil : « je pense qu'on va essayer de le faire en plus fin dans les cadres de l'analyse ». Puis : « à la fin le mieux c'est de faire une apk, quitte à revenir en arrière ». C'est donc un essai, sans planche, jugé sur le téléphone, et qui doit pouvoir se défaire d'un seul commit.

## À faire

1. Dans les deux analyses (`/voile/analyse` et `/surf/analyse`), chaque panneau (les cadres des onglets ouverts : général, graphes, manœuvres, sauts, matériel, réglages…) perd son trait fin et reçoit le coup de pinceau du lot 364, par la pièce déjà écrite (`brushFrame`, `.brush-frame`), sans copie.
2. Le trait est plus fin que sur le Profil : la moitié de son épaisseur (6 px pour 12 px), par une variable de `src/theme/tokens.css` que la pièce accepte en paramètre ; les marges intérieures qu'il demande sont réduites d'autant, pour ne pas manger la place des graphes.
3. L'angle ouvert tourne d'un panneau au suivant, dans l'ordre où ils s'affichent, comme sur le Profil.
4. Sa couleur est celle de l'activité de la session analysée, par la même règle que le Profil (`core/brushColor.ts` : éclaircie la nuit si elle ne se verrait pas, encre si elle se confond avec le fond).
5. La carte, la barre d'onglets, l'en-tête de l'analyse et les vues en plein écran ne changent pas.
6. Rien de la disposition ne bouge : panneaux redimensionnables et leur taille mémorisée (leurs `id` ne changent pas), poignées de redimensionnement toujours attrapables (le trait ne prend pas les touchers), repli des graphes, téléphone droit et tourné, ordinateur. Aucun texte, axe ou bouton sous le trait ; aucun défilement horizontal ; rien de coupé par un `overflow`.
7. Sans prise en charge du masque en bordure, le panneau garde son trait fin, comme sur le Profil.
8. `docs/MISE_EN_PAGE.md` dit l'essai en une phrase (cadres des panneaux en un coup de pinceau fin à la couleur de l'activité de la session, essai du 13/11), `docs/INVENTAIRE.md` reçoit tout fichier neuf.

## Ce qui ne change pas

Le contenu des panneaux, tous les chiffres, l'image de partage, les autres pages.

## Tranché par l'orchestrateur

- Couleur : l'activité de la session (l'utilisateur ne l'a pas dite ; le Profil prend l'activité favorite, une analyse n'a qu'une activité).
- Épaisseur : la moitié de celle du Profil.
- La carte n'est pas peinte.

## Vérification

`node outils/verif.mjs --rapide` par l'agent. Par l'orchestrateur : `npm run verif`, puis le passage courant du banc (`node outils/banc/passe.mjs`), dont le texte doit rester identique avant et après, et `tailles` avec captures.

## Essai au téléphone

Ouvrir une analyse de voile puis de surf, en clair puis en sombre, déplier « avancé » : chaque panneau est entouré d'un trait de pinceau fin à la couleur de l'activité ; redimensionner un panneau ; dire si l'essai est à garder ou à défaire.
