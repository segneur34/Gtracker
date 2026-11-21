# 475 · Profil : la languette « Spot préféré » encore un peu plus bas

Modèle | Réflexion : Sonnet | medium.

Demande : `node outils/backlog.mjs --ligne 475`. Retouche du lot 431 (commit 513e5d9), validé le 21/11 à l'essai 327 avec ces mots : « ok, encore un peut plus bas ». À la planche du 20/11, l'utilisateur avait déjà dit « plutôt B mais un peu plus bas » : il veut la languette moins haut perchée sur le bord du cadre.

## Décidé

- Seule la hauteur de la languette change : elle descend d'une dizaine de pixels (8 à 12, à régler sur captures), sur téléphone comme sur ordinateur. Elle reste à cheval sur le bord haut du cadre « Activités favorites », en haut à droite : elle doit encore dépasser franchement au-dessus du trait, pas rentrer toute dans le cadre.
- Rien d'autre ne bouge : trait au pinceau, aplat qui coupe le trait du cadre, nom sur deux lignes au plus puis coupé, encart caché quand aucune session de la période n'a de lieu (le cadre est alors exactement comme avant le lot 431).
- La languette ne doit toucher ni le titre ni la rangée des activités : si la descendre la rapproche trop de la rangée, c'est la rangée qui descend d'autant (un écart égal à celui d'aujourd'hui), seulement quand la languette est là.

## Pièces en place

- `src/components/ProfileFavorites.css`, bloc « Spot préféré » : `--favs-spot-in` (10 px aujourd'hui) tient le bas de la languette sous la première ligne du titre ; `margin-top` de `.profile-favs--spot` réserve la place au-dessus du cadre pour une languette à deux lignes : si la languette dépasse moins vers le haut, cette marge peut baisser d'autant, sans que la languette touche ce qui est au-dessus.
- Le banc de poissons contourne la languette et se remesure quand elle change de taille (`ProfilePage`, `ProfileFavorites`) : vérifier qu'il suit la nouvelle place sans retouche, sinon l'ajuster.

## Vérification

- Captures avant et après, à ranger dans le dossier de brouillon donné par l'orchestrateur : Profil à 390 × 844 et à 320 de large, clair et sombre, nom court et nom long (deux lignes), et à 1 280 de large. Le script `outils/banc/profil.mjs` et ceux qui ont servi au lot 431 (`outils/banc/SCRIPTS.md`) disent comment ouvrir le Profil avec des sessions qui portent un lieu.
- Aucun texte de la page ne change : le relevé du banc reste identique.

## Passe de doc (après validation)

DECISIONS §9 : l'encart « Spot préféré » (lot 431 et cette retouche), d'après le message du commit 513e5d9 et la hauteur retenue ici.
