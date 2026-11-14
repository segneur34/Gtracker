# 383 · Banc : le script du bouton glissant repasse

Sonnet | medium. Outil de l'atelier : rien dans `src/`, aucun essai au téléphone, pas de version.

## Constat (14/11)

`outils/banc/glisser.mjs` prouve que la case d'un bouton glissant (`components/ui/SegmentedControl`) s'attrape et glisse. Il plante dès sa première partie : il cherche sur le Profil un bouton glissant de période (`.ui-segmented[aria-label="Période"]`) qui n'y est plus, la période du Profil étant devenue un bouton ovale unique. Sa partie Statistiques a été réécrite le 14/11 pour la fenêtre de sélection (choisir Voile dans la fenêtre, valider, famille dans l'adresse, vue retenue au rechargement) mais n'a jamais pu être rejouée, le script s'arrêtant avant. Les Statistiques n'ont plus de bouton glissant non plus.

## Ce qui est demandé

- Faire viser aux parties qui éprouvent le glisser un bouton glissant qui existe encore : chercher dans `src/` les emplois de `SegmentedControl` (Réglages en a plusieurs, la page Sessions peut-être) et prendre celui qui se prête le mieux aux mêmes preuves (la case suit le pointeur, se pose sur le choix le plus proche au lâcher, le choix est appliqué et retenu). Garder l'intention de chaque contrôle d'origine ; un contrôle qui n'a plus de sens (propre au Profil) est retiré en le disant.
- La partie Statistiques, déjà réécrite, est rejouée et corrigée si besoin ; si elle ne prouve plus rien du glisser, la garder courte (elle prouve que la fenêtre applique et que la vue est retenue) ou la retirer si `statistiques.mjs` le prouve déjà, en le disant.
- Le script passe seul (`node outils/banc/passe.mjs glisser -j 1 --sans-cache`) puis avec deux autres (`glisser statistiques barre -j 3`), sans erreur de console. Mode d'emploi et pièges : `outils/banc/LISEZMOI.md`. Attentes sur l'état de la page, pas de pause fixe.
- `outils/banc/scripts.mjs` et `outils/banc/SCRIPTS.md` accordés si l'étiquette de page du script change.

## Ce qui n'est pas demandé

Rien hors de `outils/banc/`. Pas de commit, pas de version, pas de `docs/BACKLOG.md`. Si le glisser se révèle cassé dans l'application elle-même (et non dans le script), ne corrige pas : dis exactement quoi dans le rapport.
