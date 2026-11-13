# 364 · Profil, à l'essai : les cadres en un coup de pinceau à la couleur de l'activité favorite

Modèle | Réflexion : Sonnet | high. Décisions du domaine : `docs/DECISIONS.md` §9 (Profil) et la charte de `CLAUDE.md` (« DA d'après le site de GONG »), à accorder dans le même travail. Lot mené après le 357 (les trois activités favorites), dont il reprend le bloc.

## Demande de l'utilisateur (13/11)

- « Actuellement, les cadres dans Profil sont des petits traits fins. On va essayer de les remplacer par des coups de pinceau à la couleur de l'activité favorite. Ça remplira déjà pas mal cet espace. »
- Sur une première planche à traits séparés : « non, le trait doit faire quasiment le tour, genre 4/5, en un seul trait », puis « des traits légèrement plus fins ».
- Sur la seconde planche : « c'est pas mal du tout. Je changerais juste un truc. Actuellement, c'est un côté qui n'est pas dessiné. Ce serait bien que ce soit un angle qui ne soit pas peint. Genre l'angle en bas à droite. Avec l'épaisseur du trait du milieu, de l'option B. »

C'est un essai, à garder ou à défaire à l'œil sur le téléphone, comme les boutons colorés du 13/11 : un écart voulu à la charte (traits fins, cadres à bords francs).

## Maquette validée

`D:\gong tracker\atelier\maquette-cadres-profil-1311\planche-cadres-profil.png` (version finale : ouverture à l'angle d'en bas à droite, épaisseur de la proposition B), et dans `pieces\` du même dossier les fichiers SVG du trait et un `LISEZMOI.md` qui donne la recette de la planche (neuf tranches, épaisseur, marges, écart entre cartes, règle CSS, couleur du mode sombre). La planche est hors dépôt : ce qui sert à l'application est recopié dans `src/`.

## À faire

1. Chaque cadre de la page Profil (le bloc des activités favorites, l'anneau du temps par activité, le graphe d'activités, et tout autre cadre de la page, cartes d'ouverture comprises si elles ont un cadre) perd son trait fin et reçoit un seul coup de pinceau qui en fait presque le tour, ouvert à l'angle d'en bas à droite, à l'épaisseur de la planche.
2. Le trait est le tracé du cadre des logos, repris tel quel (déjà dans l'application, pièce des logos d'activité) : étiré en neuf tranches pour que les coins gardent leur forme et que l'épaisseur reste égale sur un cadre allongé. Rien n'est redessiné.
3. Sa couleur est celle de l'activité favorite de la période affichée (la première du bloc des favorites) ; elle suit le bouton de période. Aucune session sur la période : le trait est à l'encre.
4. En mode sombre, la couleur est éclaircie par la règle générale du `LISEZMOI.md` de la planche, valable pour les douze couleurs de la palette ; une couleur qui ne se verrait pas sur le fond (le blanc le jour, le noir la nuit) suit la règle déjà en place pour les logos (la nuit le noir devient blanc et le blanc noir).
5. Aucun texte ni chiffre n'est posé sur le trait ou dessous : les marges intérieures des cadres et l'écart entre cartes sont repris de la planche, par des variables de `src/theme/tokens.css`.
6. Téléphone droit (390 px et 320 px), téléphone tourné, ordinateur : le trait ne déborde pas de la page, ne crée aucun défilement horizontal et n'est pas coupé par un `overflow` du cadre.
7. La WebView d'Android doit le rendre : si le masque en bordure (`mask-border`, `-webkit-mask-box-image`) n'y est pas sûr, prendre le repli le plus simple qui donne la même image (bordure en image, ou un SVG en position absolue), et le dire dans le rapport.
8. Le reste de l'application ne change pas : seuls les cadres de la page Profil sont peints. Sur ordinateur, la colonne « Vos activités » suit le même habillage si elle partage la pièce des cadres du Profil ; sinon elle reste telle quelle, et le rapport le dit.
9. `docs/DECISIONS.md` §9 dit l'essai (cadres du Profil en un coup de pinceau à la couleur de l'activité favorite, ouvert en bas à droite, essai du 13/11), et `docs/INVENTAIRE.md` reçoit tout fichier neuf.
10. Scripts du banc qui mesurent les cadres du Profil (`profil`, `tailles`, `racine-periodes`) : adaptés seulement s'ils cassent, avec leur journal.

## Ce qui ne change pas

Le contenu des cadres, le bouton de période, la racine (toujours cachée), les autres pages.

## Tranché par l'orchestrateur

- « L'épaisseur du trait du milieu, de l'option B » : l'épaisseur de la proposition B, celle du milieu de la planche.
- Mode sombre : la couleur éclaircie, que la planche montrait à côté de la couleur telle quelle, à peine visible sur fond noir.
- Activité favorite : la première du bloc des favorites, donc celle qui a le plus de temps sur la période.

## Vérification

`node outils/verif.mjs --rapide` par l'agent ; `npm run verif`, puis `node outils/banc/passe.mjs profil tailles --captures` par l'orchestrateur, qui regarde les captures.

## Essai au téléphone

Ouvrir le Profil en clair puis en sombre, téléphone droit puis tourné : chaque cadre est entouré d'un seul coup de pinceau à la couleur de l'activité favorite, ouvert en bas à droite ; dire si l'essai est à garder ou à défaire.
