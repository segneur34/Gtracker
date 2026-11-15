# 393 · Une charte des traits de pinceau : grands cadres, petits cadres, boutons

Modèle | Réflexion : Opus | high

## Demande (15/11, à l'essai 266 de la fenêtre de sélection des Statistiques, APK 0.00.85)

« ok mais il faudrait un trait plus fin encore, un peu au passage réduire aussi ceux de profil à l'épaisseur de statistique. Du coup, créer une charte genre avec les grands cadres avec les épaisseurs comme dans statistiques ou les analyses de session, ensuite les plus petits avec les épaisseurs comme les cadres dans les sessions, voilà. Et encore un petit peu plus fin avec du coup les boutons. Sachant que dans statistiques, c'est des cadres qui se déplient, enfin c'est des boutons et du coup on les garde fins. Surtout qu'on a beaucoup de choix. »

## L'existant

- `src/theme/tokens.css` : trois épaisseurs de trait de cadre, `--brush-trait` 12 px (cadres du Profil), `--brush-trait-fine` 6 px (panneaux des analyses et des Statistiques), `--brush-trait-hair` 3 px (cadres de Réglages, lignes de Sessions), chacune avec ses marges (`--brush-pad-*`).
- `src/components/BrushFrame.css` : cadres (`.brush-frame`, `.brush-frames`, `.brush-panels`, `--fine`, `--hair`), trait posé en masque de bordure (`trait-cadre-pinceau.svg`, `350 / calc(4 * var(--brush-trait))`) ; ovale des boutons (`.brush-oval`, masque `480 / var(--oval-r)`) : son trait est proportionnel au rayon de l'ovale, il n'a pas d'épaisseur réglable aujourd'hui.
- Usages : Profil (`ProfilePage.tsx`, `brushFrame(…)`, `.brush-frames`, bouton de période `.brush-oval`), Statistiques (panneaux `.brush-panels`, bouton « Sélection » et choix `.brush-oval`, fenêtre de sélection `.brush-frame`), analyses (`AnalysisShell.tsx`, `.brush-panels`), Réglages et Sessions (`.brush-panels--hair`).

## Charte retenue (orchestrateur, d'après la demande)

Trois niveaux, nommés dans `tokens.css` par leur rôle, et rien d'autre :

1. **Grand cadre** : 6 px, l'épaisseur des panneaux des Statistiques et des analyses, qui ne changent pas. Les cadres du Profil y descendent (12 px aujourd'hui), avec les marges du niveau. La fenêtre de sélection des Statistiques est un grand cadre.
2. **Petit cadre** : 3 px, l'épaisseur des lignes de Sessions et des cadres de Réglages, qui ne changent pas.
3. **Bouton** : plus fin que le petit cadre, autour de 2 px (à régler à l'œil : nettement plus fin que 3 px, encore lisible comme un coup de pinceau, jour et nuit). Tous les ovales au pinceau : les choix de la fenêtre de sélection des Statistiques (famille, activité, période, matériel), le bouton « Sélection » et les petites lignes de matériel de la page, le bouton de période du Profil.

## Attendu

1. Les trois niveaux dans `tokens.css` (épaisseur et marges), employés par `BrushFrame.css` ; plus de quatrième épaisseur qui traîne. Les noms de classes peuvent rester ; si une classe change de sens, le dire.
2. L'ovale reçoit une épaisseur réglable, indépendante de son rayon, tenue par la variable du niveau « bouton ». Le dessin du trait reste celui du fichier fourni (`trait-cadre-pinceau.svg`) : pas de retouche de l'image point par point ; un moyen de mise en page (masques composés, second calque, autre découpe du même fichier…) est attendu. Si aucun moyen propre ne donne un trait plus fin avec le même fichier, le dire et proposer le plus proche, sans bricoler une image neuve.
3. Rien d'autre ne bouge : couleurs, angle ouvert qui tourne, voile, tailles des boutons (cible d'un doigt), bouton choisi rempli d'encre avec son trait autour, repli sans prise en charge du masque.
4. Mesurer au banc avant et après (le script `statistiques.mjs` a des captures `stats-320` et `stats-telephone` ; `profil.mjs` pour le Profil) : rien ne déborde à 320 px, la fenêtre de sélection tient dans l'écran (le contrôle « 320 px : rien ne déborde, fenêtre et choix en vue » passe), le Profil garde sa disposition avec ses marges réduites. Aucun autre agent n'édite `src/` : le banc peut être lancé (`node outils/banc/passe.mjs statistiques profil --avant HEAD -j 1 --sans-cache`).
5. Texte des pages identique avant et après.

Hors lot : `docs/DECISIONS.md` (§9, §10 et §11 citent les épaisseurs) et `docs/MISE_EN_PAGE.md`, à la passe de doc après validation.
