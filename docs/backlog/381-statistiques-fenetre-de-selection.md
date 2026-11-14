# 381 · Statistiques : la sélection dans une grande fenêtre

Partie A (code) : Opus | high. Partie B (script du banc) : Sonnet | medium, sur un agent neuf, après le commit de la A.

Maquette validée par l'utilisateur le 14/11 : `D:\gong tracker\atelier\maquette-selection-stats-1411\planche-2.html` (« c'est ça l'idée », avec une retouche : les boutons de matériel posés sur la page « doivent être un peu plus petits »). L'ouvrir et lire son HTML avant de coder : elle fait foi pour la disposition ; les couleurs, tailles et rayons viennent des variables de `src/theme/tokens.css`, pas de ses valeurs en dur.

## Demande de l'utilisateur (14/11)

« Dans statistiques, actuellement quand je clique sur sélection, il y a un certain nombre de choses qui s'ouvrent et c'est pas très pratique. […] un petit bouton paramètres avec des barres verticales un peu comme des potards sur un clavier de mixage […] ça ouvre une espèce de pop-up qui est assez grand dans la page […] avec tous les choix. Une fois qu'on les valide, ça applique le réglage. […] le matériel, ça doit être séparé. On doit pouvoir le régler dedans, mais il faut qu'on puisse le régler de manière séparée, comme ça on peut basculer d'un matériel à l'autre. » Puis, sur la première planche : « il faut que ça ouvre une fenêtre […] grande, qui fasse quasiment la taille de l'écran, où on peut correctement bien régler. Parce qu'actuellement, si on a beaucoup d'activités, ça ne marche pas. […] il faut faire gaffe à ce que les boutons soient plus opaques. On voit trop les traits du champ derrière. »

## Partie A : ce qui est demandé

Aujourd'hui (`src/pages/StatisticsPage.tsx`, bloc `.stats-choice`) : un bouton « Sélection » déplie dans la page trois boutons glissants (famille, activité, période) et un bouton « Matériel » qui déplie une rangée glissante par groupe. Avec beaucoup d'activités, la rangée glissante ne suffit plus.

1. **La ligne « Sélection »** devient un seul bouton en pilule, à fond plein, sur toute la largeur : « Sélection », le choix en cours (le `choiceSummary` d'aujourd'hui, coupé par des points de suspension s'il déborde), et à droite un disque d'encre portant l'icône aux trois curseurs verticaux. Toute la ligne ouvre la fenêtre. Icône neuve dans `components/icons.tsx` (trois traits verticaux, un bouton rond sur chacun à une hauteur différente), dans le style des autres.
2. **La fenêtre** (pièce commune `components/ui/Dialog`, titre « Sélection ») : sur téléphone presque tout l'écran, sur ordinateur une grande fenêtre au milieu (large de 720 px environ, haute des trois quarts de la page) ; le corps défile de haut en bas, « ANNULER » et « VALIDER » restent en bas. Elle porte, dans cet ordre : Famille (« Tout » et les familles visibles), Activité (« Toutes » et les activités de la famille choisie, chacune avec sa pastille de couleur cernée ; bloc absent quand la famille est « Tout »), Période (les cinq de `STATS_PERIODS`), Matériel (un groupe par ligne : son nom, puis « Tous » et ses pièces ; bloc absent sans activité choisie ou sans liste de matériel pour elle).
3. **De gros boutons qui passent à la ligne**, jamais de rangée qui glisse : une pièce commune neuve dans `components/ui/` (un groupe de choix exclusif, `role="radiogroup"`, boutons en pilule à fond plein, celui qui est choisi à l'encre), avec la disposition de la maquette (famille et période sur trois colonnes, activités sur deux, pièces de matériel à la suite) et deux tailles : la normale, à hauteur de cible tactile (`--touch-target`), dans la fenêtre ; une petite pour la page.
4. **Un brouillon** : la fenêtre travaille sur une copie du choix (famille, activité, période, matériel). Changer de famille ou d'activité dans le brouillon remet son matériel à « Tous », comme `go` le fait aujourd'hui. Le matériel proposé dans la fenêtre est celui de l'activité du brouillon, sur la période du brouillon (mêmes fonctions qu'aujourd'hui : `useGearGroups`, `gearFilterItems`, `gearFilterRows`), avec le même texte quand aucune pièce n'est portée par les sessions de la période. « VALIDER » applique tout d'un coup par un seul changement d'adresse : empilé dans l'historique si la famille, l'activité ou le matériel a changé, remplacé si seule la période a changé (règle d'aujourd'hui), rien si rien n'a changé ; puis la fenêtre se ferme. « ANNULER », la croix, le fond, Échap et le retour d'Android ferment sans rien changer (la `Dialog` le fait déjà).
5. **Le matériel sur la page**, hors de la fenêtre : sous la ligne « Sélection », le bouton « Matériel » d'aujourd'hui (replié ou non, état retenu sous la même clé), à fond plein, qui montre les pièces choisies ; déplié, un groupe par ligne dans la petite taille de la pièce du point 3 (boutons nettement plus petits que ceux de la fenêtre : c'est la retouche de l'utilisateur), appliqués tout de suite comme aujourd'hui. Ce bloc n'apparaît plus du tout sans activité choisie ou sans liste de matériel (aujourd'hui il est grisé).
6. **Fonds pleins** sur la page Statistiques seulement (règles limitées à `.stats-page`) : la ligne « Sélection », le bouton « Matériel », les boutons de choix, et les onglets de la page s'ils sont transparents aujourd'hui, prennent le fond de surface (`--surface`) pour que le champ de traînées ne passe plus derrière. Regarder d'abord ce qui est déjà voilé (`--field-veil`) et ne rien changer hors de cette page.
7. Les trois boutons glissants et les deux replis « choix » et « activité » partent de la page, avec leurs clés d'état devenues inutiles et leurs styles ; la note « Cette famille est cachée… » reste sous la ligne. Le reste de la page (reprise du dernier affichage, mémoire de la vue, onglets, graphes) ne bouge pas.

La fenêtre et son brouillon vont dans un fichier à part, à côté de la page, pour ne pas grossir `StatisticsPage.tsx` (913 lignes). La comparaison du brouillon et du choix en cours (« qu'est-ce qui a changé ») est une fonction pure de `library/stats.ts`, testée.

### Ce qui n'est pas demandé

- `outils/banc/statistiques.mjs` (partie B), `docs/DECISIONS.md` §10 et les autres documents (passe de doc après validation), sauf `docs/INVENTAIRE.md` pour les fichiers neufs si `node outils/verif.mjs --rapide` le réclame.
- `SegmentedControl` ne change pas : il sert ailleurs.
- Pas de commit, pas de version, pas de `docs/BACKLOG.md`.

### Rapport attendu

Fichiers neufs et touchés, ce qui s'écarte de la maquette et pourquoi, les libellés et attributs (`aria-label`, `title`, classes) que le script du banc devra viser pour ouvrir la fenêtre, choisir et valider.

## Partie B : le script du banc

`outils/banc/statistiques.mjs` ouvre aujourd'hui « Sélection » et y manipule les boutons glissants : l'adapter à la fenêtre (ouvrir, choisir, valider), sans retirer de contrôle sur les chiffres ; ajouter trois contrôles : annuler ne change ni l'adresse ni les chiffres ; valider un changement de famille, d'activité et de période ne fait qu'un pas dans l'historique ; le matériel choisi sur la page s'applique sans ouvrir la fenêtre. Mode d'emploi du banc : `outils/banc/LISEZMOI.md`.

## Essais au téléphone (à poser au commit)

- la fenêtre de sélection sur le téléphone, toutes les activités montrées dans Réglages → tout se voit sans glisser de côté, « Valider » applique, le retour d'Android ferme sans rien changer ;
- le matériel sur la page → on bascule d'une pièce à l'autre en un appui, les boutons ont la bonne taille, les traits du fond ne passent derrière aucun bouton.
