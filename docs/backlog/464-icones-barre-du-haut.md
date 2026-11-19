# 464 · Barre du haut, sur ordinateur : une petite icône à côté de chaque nom

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (19/11)

« En haut dans l'application, il y a les noms des différents onglets, profils, paramètres, etc. Il faudrait essayer de mettre des petites images à côté. Genre dans paramètres, c'est l'engrenage, dans statistiques, c'est un graphique avec des barres. Je crois qu'on a la même chose en fait dans l'application. Profil, c'est avec une petite forme de personnage, etc. Ça serait plus joli et on s'y repérerait mieux. »

## Constat (lu dans le code le 19/11, à revérifier)

`src/components/AppShell.tsx` : la barre du bas du téléphone montre déjà une icône par destination (`NAV_ICON` : Profil, Sessions, Planifier, Statistiques, Réglages) ; les liens de la barre du haut (`shell-toplink`) n'ont que leur nom.

## Voulu

- Dans la barre du haut, chaque lien porte, à gauche de son nom, la même icône que dans la barre du bas (celle de `NAV_ICON`, « Planifier » compris), en petit (de l'ordre de 18 px), à la couleur du texte du lien, allumé ou non. L'icône est décorative : le nom reste le texte du lien, rien de neuf n'est lu par un lecteur d'écran.
- La barre tient toujours sur une ligne à 1000 px de large, en français, en anglais et en espagnol. Si ce n'est pas le cas dans une langue, le dire dans le rapport avec la largeur qui manque, sans changer le seuil.
- Le bouton vert « Enregistrer » de la barre et la barre du bas du téléphone ne changent pas.

## Contraintes

- Charte : variables de `src/theme/tokens.css`, icônes de `src/components/icons.tsx`, aucun style en ligne neuf.
- `docs/DECISIONS.md` §11 (barre du haut) : ne pas y toucher, complété à la validation.

## Banc

Neutre : le texte de la barre ne change pas (`barre`).

## Essai, sur le PC

Un coup d'œil à la barre du haut, fenêtre large puis réduite vers 1000 px : dire si les icônes conviennent.
