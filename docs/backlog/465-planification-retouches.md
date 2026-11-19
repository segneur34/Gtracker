# 465 · Sessions et liste des itinéraires : retouches après l'essai 310

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (19/11, à l'essai 310 du lot 457)

« Il faut revoir le bouton : il doit s'appeler "planification", le bouton "planifier" dedans doit être plus gros, 1.5X plus et noir texte blanc pour le moment et il faut enlever le bandeau "19 session. dossier << docume ...>>" qui n'a rien à faire ici ou je comprends pas pourquoi. »

## Constat (lu dans le code le 19/11, à revérifier)

- `src/pages/SessionsPage.tsx` : depuis le lot 457, la pastille à gauche de « Tris » dit « Itinéraires (n) », avec l'icône du fanion, et mène à `/itineraires/liste`.
- `src/pages/RoutesPage.tsx` (la liste des itinéraires) : « Planifier » est un petit bouton creux (`ui-btn--secondary ui-btn--s`) à côté de « Importer un itinéraire » ; sous le titre, `<MemoryStatus />` montre l'état de la mémoire en entier (« 19 sessions · dossier « Documents… » »), alors que la page Sessions emploie `<MemoryStatus compact />`, qui ne montre que ce qui demande attention.

## Voulu

1. La pastille de Sessions s'appelle « Planification », sans nombre, avec l'icône de « Planifier » (celle du parcours, `IconRoute`) ; elle mène toujours à la liste des itinéraires.
2. Dans la liste des itinéraires, « Planifier » est un bouton plein à l'encre (noir à texte blanc le jour, l'inverse la nuit : la variante pleine des boutons du dépôt), environ une fois et demie plus gros qu'aujourd'hui (hauteur et texte), par les variables de `theme/tokens.css` ; « Importer un itinéraire » ne change pas. À 320 px de large, rien ne déborde.
3. Le bandeau d'état de la mémoire de cette page passe en version courte (`compact`) : rien quand tout va bien, le message seulement quand la mémoire demande attention (dossier à rouvrir, erreur).
4. Les deux phrases du lot 457 qui citent « Itinéraires », à côté de « Tris » (la leçon « Planifier un parcours » de `src/tutorials/lessons.ts` et la liste vide de `src/components/FollowTracePicker.tsx`), disent « Planification », dans les trois langues ; les clés devenues inutiles quittent les dictionnaires.
5. `outils/banc/vides.mjs` : son contrôle de la pastille attend le nouveau nom.

## Contraintes

- Aucun style en ligne neuf ; texte par `t` ; le titre « Itinéraires planifiés » de la liste ne change pas.
- `docs/DECISIONS.md` n'est pas à toucher.

## Banc

`vides` : la pastille dit « Planification » ; rien d'autre.

## Essai au téléphone

Sessions puis la liste des itinéraires : la pastille « Planification », le bouton « Planifier » plus gros et plein, plus de bandeau de mémoire.
