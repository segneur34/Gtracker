# 463 · Sessions, sur ordinateur : faire défiler la rangée des activités à la souris

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (19/11)

« Quand on a plus de sept sports différents qui sont visionnables dans les sessions, on n'a aucun moyen de sélectionner différents sports dans la barre. Sur téléphone on peut faire scroller de droite à gauche pour faire apparaître d'autres, mais pas sur la version PC. Donc il faut trouver un moyen avec une flèche vers la droite par exemple, plus le fait de pouvoir attraper et faire glisser vers la droite avec la souris. Et vers la gauche évidemment. »

## Constat (lu dans le code le 19/11, à revérifier)

`src/components/ActivityBubbles.tsx` et `.css` : la rangée des ronds (« Toutes », puis un logo par activité visible) défile de côté (`overflow-x: auto`) mais sa barre de défilement est cachée. Au doigt elle glisse ; à la souris, sans molette horizontale, les activités au-delà du bord sont hors d'atteinte.

## Voulu

1. Quand la rangée dépasse, une flèche ronde à droite tant qu'il reste des activités cachées à droite, et une à gauche tant qu'il en reste à gauche ; aucune flèche du côté où il n'y a plus rien, aucune quand tout tient. Un appui fait glisser la rangée d'environ les trois quarts de sa largeur visible, en douceur (sans animation si le système demande moins de mouvement).
2. À la souris, on attrape la rangée et on la fait glisser à droite ou à gauche. Un glissement de plus de quelques pixels ne choisit pas l'activité sous le pointeur ; un simple clic la choisit comme aujourd'hui.
3. Au doigt, rien ne change (défilement du système, pas de glissement maison) ; les flèches ne se montrent qu'avec une souris (pointeur fin), téléphone et tablette gardant la rangée d'aujourd'hui.
4. Les flèches sont de vrais boutons, atteignables au clavier, nommés « Activités suivantes » et « Activités précédentes » (par `t`, anglais et espagnol dans `src/locales/`). Elles ne cachent jamais durablement un rond ni son nom : la rangée leur laisse la place, ou un fondu discret à la couleur de la page.
5. Si le composant sert ailleurs que sur Sessions, il s'y comporte de même.

## Contraintes

- Charte : variables de `src/theme/tokens.css`, icônes de `src/components/icons.tsx` (pas d'emoji), boutons ronds en creux à l'encre ; aucun style en ligne (`style={{`) neuf.
- La logique est pure et testée : quelles flèches montrer d'après la position, la largeur visible et la largeur totale ; à partir de combien de pixels un appui devient un glissement.
- `docs/DECISIONS.md` §11 (« Page Sessions » : la rangée de ronds « se fait glisser de côté ») : ne pas y toucher, complété à la validation.

## Banc

Format téléphone : neutre, le texte de la page Sessions ne change pas. Dire dans le rapport si un script lit la page en format ordinateur.

## Essai, sur le PC

Dans le programme Windows ou le navigateur, plus de sept activités visibles : les flèches apparaissent et disparaissent du bon côté, la rangée se tire à la souris, un clic choisit toujours l'activité.
