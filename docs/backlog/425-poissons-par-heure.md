# 425 · Profil : le banc de poissons compte les heures de session

Modèle | Réflexion : Sonnet | medium.

Demande : `node outils/backlog.mjs --ligne 425`. Note de l'utilisateur du 16/11 : « plutôt que de faire trois petits poissons par session, un petit poisson en plus par heure de session jusqu'à un maximum de 3 par session ».

## Décidé (Q125, répondue « ok » au défaut le 18/11)

- Une session donne un poisson dès sa première minute, puis un de plus par heure pleine, trois au plus : moins d'une heure, 1 ; d'une heure à moins de deux, 2 ; deux heures et plus, 3.
- Les paliers selon le nombre de sessions (trois poissons par session jusqu'à la 30ᵉ, deux jusqu'à la 40ᵉ, puis un) sont retirés : seule la durée de chaque session compte.
- La durée est celle que la session porte déjà dans son résumé (la durée totale de la session, pas le temps en mouvement) ; une session sans durée connue donne un poisson. Une session de moins d'une minute : à lire dans le code d'aujourd'hui si une telle session compte déjà pour le banc ; garder ce comportement et le dire dans le rapport.
- Rien d'autre ne change : dessin des poissons, mer qui monte, période choisie, banc caché par son réglage, contournement de la languette « Spot préféré ».

## Pièces en place

- Compte d'aujourd'hui : `src/core/fishSchool.ts` et `src/core/schoolBasics.ts` (tests `fishSchool.test.ts`, `schoolWater.test.ts`), dessinés par `src/components/fishSchool/FishSchool.tsx`, nourris par `src/pages/ProfilePage.tsx` avec les sessions de la période. Lire `docs/DECISIONS.md` §9 pour la règle actuelle et ce qui dépend du nombre de poissons (plafond du banc, hauteur de l'eau) : si la hauteur de l'eau ou un plafond se déduisait du nombre de sessions par ces paliers, les garder cohérents avec la règle neuve et le dire dans le rapport.
- Le calcul reste pur, dans `core/`, avec ses tests : les trois tranches de durée, la borne exacte d'une heure et de deux heures, durée absente, plusieurs sessions qui s'additionnent.

## Banc

`outils/banc/profil.mjs` : si un contrôle compte les poissons, l'adapter à la règle neuve ; le texte de la page ne change pas.

## Passe de doc (après validation)

DECISIONS §9 : la règle du compte, récrite.
