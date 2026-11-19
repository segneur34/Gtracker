# 457 · Sessions : l'entrée des itinéraires monte à côté de « Tris »

Modèle | Réflexion : Sonnet | high

## Tel que dit par l'utilisateur (note du 19/11)

« Le bouton planifier et itinéraire planifié ils sont actuellement tout en bas de la liste des sessions c'est vraiment pas pratique surtout quand elle va s'allonger […] il faudrait un bouton à cet endroit-là [à côté de « Tris »] qui nous amène vers le côté planification […] il faut le mettre ailleurs parce que ça va pas du tout. »

Tranché le 19/11 par l'utilisateur, entre quatre dispositions dessinées : un bouton « Itinéraires (n) » à côté de « Tris », qui ouvre la liste des itinéraires, où « Planifier » crée un parcours ; plus rien en bas de la liste.

## Constat (lu dans le code le 19/11, à revérifier)

- `src/pages/SessionsPage.tsx` : sous la dernière session, le bloc `sessions-actions` porte « Créer un parcours » (vers `/itineraires`) et « Itinéraires (n) » (vers `/itineraires/liste`). En tête, la seconde ligne de `sessions-head` porte les totaux et, à droite, la pastille « Tris ».
- `src/pages/RoutesPage.tsx` (la liste des itinéraires) a déjà un bouton « Planifier ».
- Deux phrases disent « en bas de la page Sessions » : la leçon « Planifier un parcours » (`src/tutorials/lessons.ts`) et la liste vide de « Suivre une trace » (`src/components/FollowTracePicker.tsx`).

## Voulu

1. Sur la ligne des totaux, à gauche de « Tris », un lien « Itinéraires (n) » vers `/itineraires/liste` : même dessin de pastille que « Tris », l'icône du fanion, le nombre entre parenthèses une fois les itinéraires lus (comme aujourd'hui). À 320 px de large et téléphone tourné, rien ne déborde : si la ligne est trop courte, les deux pastilles passent sous les totaux, alignées à droite.
2. Le bloc du bas (`sessions-actions`) disparaît, avec son CSS. Si ce bloc avait une règle propre à l'ordinateur (où « Planifier » est dans la barre du haut), la pastille neuve suit la même règle.
3. Vérifier que la liste des itinéraires offre bien « Planifier » dans tous ses états, liste vide comprise ; sinon l'y mettre : c'est désormais le seul chemin du téléphone vers la planification.
4. Les deux phrases citées disent le nouveau chemin (« Itinéraires », à côté de « Tris », puis « Planifier »), dans les trois langues ; les clés devenues inutiles quittent `src/locales/en.json` et `es.json`.
5. Les commentaires de `src/` qui disent « en bas » ou « Créer un parcours » depuis Sessions sont remis d'aplomb (`SessionsPage`, `PlanningPage.tsx`, `core/parentPage.ts`, `core/navigation.ts`).
6. Le retour d'Android ne change pas : Planifier et la liste des itinéraires remontent toujours à Sessions.

## Contraintes

- Charte : variables de `theme/tokens.css`, pas de style en ligne neuf, pas d'emoji ; texte par `t`.
- `docs/DECISIONS.md` §7 et §11 décrivent l'ancien emplacement : ne pas y toucher, ils seront récrits à la validation.
- Script du banc à adapter s'il passe par les boutons du bas : `outils/banc/vides.mjs` (seul à les citer le 19/11).

## Banc

`vides`, `barre`, `langues` : le texte de la page Sessions perd « Créer un parcours » et gagne « Itinéraires (n) » en tête ; rien d'autre ne change.

## Essai au téléphone

Un coup d'œil : la pastille « Itinéraires » à côté de « Tris », et le chemin jusqu'à « Planifier ».
