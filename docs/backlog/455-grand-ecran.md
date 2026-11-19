# 455 · Grand écran : le banc de poissons au milieu du Profil, un trou dans l'analyse

Modèle | Réflexion : Opus | high

Deux défauts vus par l'utilisateur le 19/11 dans le programme Windows, fenêtre large (environ 1 700 px). Deux parties sans fichier commun, écrites en parallèle par deux agents.

## Partie A : le banc de poissons part du coin haut gauche, sur ordinateur

Vu : « le banc de poisson, il est en plein milieu de l'image. Il faudrait le faire partir depuis un angle. Par exemple, sous le profil donc depuis l'angle en haut à gauche juste en dessous du petit cercle où on peut mettre une image avec soi-même, avec son profil, vers la gauche. »

Aujourd'hui (`docs/DECISIONS.md` §9, « Banc de poissons et mer qui monte ») : le banc et l'eau entrent par l'angle haut droit, sous la photo d'en-tête ; sur ordinateur, c'est le coin haut droit de la colonne du Profil, qui tombe au milieu d'une fenêtre large, contre « Vos activités ». L'angle est posé dans `src/components/fishSchool/measureSchoolLayout.ts` (`corner`, `cornerInset`), le calcul est dans `src/core/fishSchool.ts`.

Voulu, décision de l'utilisateur du 19/11 :
- Sur ordinateur (la disposition où la colonne du Profil est à côté de « Vos activités »), le banc et l'eau entrent par le coin haut gauche de la colonne du Profil, juste sous la photo ronde, contre le bord gauche.
- Sur téléphone (une seule colonne), rien ne change : angle haut droit, sous la photo d'en-tête.
- Tout le reste de la décision du §9 tient, vu depuis le nouvel angle : places dans l'ordre de la distance à l'angle, têtes à l'opposé de l'angle, eau devant le banc, cadres et textes contournés, photo ronde et bouton de période jamais touchés, rien d'animé.

À vérifier : que le calcul ne suppose nulle part un angle à droite (orientation des têtes, avancée de l'eau, entrée dans les cadres par l'ouverture de leur trait). Tests sur trace synthétique du calcul pour un angle à gauche.

## Partie B : plus de trou entre les panneaux de l'analyse

Vu, analyse voile, tous les onglets ouverts : « il y a un gros trou alors que j'ai rien demandé ». Sur la capture, deux colonnes : à gauche le panneau qui finit par « Par amure » (Virements, Empannages, Résumé, Détails) est court ; à droite son voisin (un graphe de vitesse puis la polaire) est bien plus haut ; sous le panneau de gauche, un grand vide, jusqu'à la rangée suivante (« Analyse VMG » à gauche, « Variations du Vent » à droite), alignée sur le bas du panneau de droite.

Voulu : dans chaque colonne, les panneaux se suivent sans vide, quelle que soit la hauteur du voisin. L'ordre des panneaux et leur colonne ne changent pas (`docs/MISE_EN_PAGE.md` : rien ne s'y déplace sans redemander ; le lire avant de toucher). Si le défaut ne peut pas se corriger sans changer la colonne d'un panneau, le dire dans le rapport au lieu de trancher.

Premier geste : dire d'où vient le vide (rangées d'une grille, hauteur étirée, panneau redimensionné) et s'il se voit aussi au navigateur à la même largeur, ou seulement dans le programme Windows. La correction vaut pour le surf aussi si la même disposition y sert.

## Ce que le lot ne fait pas

Pas de commit, pas de version, aucune décision de l'utilisateur, pas de document hors de cette fiche.
