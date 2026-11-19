# 459 · Planifier, sur téléphone : une carte moins haute

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (note du 19/11)

« La carte elle est trop longue ce qui veut dire que quand on arrive sur la page pour descendre plus bas il faut forcément aller attraper soit le haut de l'image soit par les côtés […] on peut essayer de faire une carte qui serait un peu moins longue dans la hauteur et pour pouvoir directement aller attraper le bas de la page et le faire monter. C'est un test à faire. »

## Constat (lu dans le code le 19/11, à revérifier)

`src/pages/PlanningPage.css`, règle de base de `.plan-map` : `height: 58vh`, `min-height: 300px`. La carte est un `ResizablePanel` vertical (`id="planning.carte"`, `minHeight={240}`) : une hauteur déjà réglée à la poignée est peut-être mémorisée et prime alors sur la feuille de style.

## Voulu

- Téléphone droit seulement : la carte prend environ 45 % de la hauteur de l'écran au lieu de 58 %, pour laisser sous elle une bande de page que le pouce saisit. Hauteur minimale gardée.
- Ordinateur et téléphone tourné inchangés (leurs règles plus bas dans la feuille).
- Vérifier comment `ResizablePanel` applique une hauteur mémorisée sur téléphone : si une ancienne hauteur réglée par l'utilisateur masquerait le changement sur son téléphone, le dire dans le rapport (sans rien effacer de ses réglages), avec ce qu'il devrait faire pour voir la nouvelle hauteur.

## Contraintes

- Une valeur, pas de mécanisme neuf ; pas de style en ligne.
- `src/pages/PlanningPage.tsx` n'est pas à toucher (un autre lot y retouche un commentaire).

## Banc

Neutre : le texte de la page ne change pas.

## Essai au téléphone

Planifier, téléphone droit : dire si la carte laisse assez de page à saisir, ou s'il faut encore la réduire.
