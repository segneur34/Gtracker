# 347 · Profil : la plante cachée

Modèle | Réflexion : Sonnet | medium

## Tel que noté (12/11)

« on va aussi enlever l'histoire de la racine tu peux tout enlever, ou au moins la cacher pour le moment, ça ne s'y prête pas à ces sports », puis : « Utilise un agent pour cacher la plante. Je pense que c'est le mieux. »

## Décisions déjà prises

- Cacher, pas supprimer (utilisateur, 12/11) : aucun fichier de la plante n'est retiré, ses calculs et ses tests restent.
- « La plante » : la racine, la fleur, le papillon, les feuilles, la bulle qui les explique (DECISIONS §9, « Racine »).
- Le réglage « Objectif par semaine » (Réglages › Pratiquant) est caché avec elle s'il ne sert qu'à elle (choix de l'orchestrateur) ; s'il sert ailleurs, il reste et le rapport le dit.

## Aujourd'hui

À vérifier dans le code avant d'agir : `src/pages/ProfilePage.tsx`, `src/components/ProfileRoot.tsx` et `ProfileRoot.css`, `src/components/drawRoot.ts`, `src/core/rootPath.ts`, `src/library/rootGrowth.ts`, `src/hooks/useProfileRoot.ts`, `src/pages/SettingsPage.tsx` (objectif par semaine), `src/tutorials/lessons.ts` (leçons qui en parlent), les aides « ? » du Profil, `src/theme/tokens.css` (variables de la plante).

## Voulu

1. Plus rien de la plante à l'écran, nulle part : page Profil aux cinq périodes, sur téléphone, téléphone tourné et ordinateur ; aucune bulle, aucune leçon, aucune aide, aucun texte de Réglages qui la cite.
2. Les cadres du Profil reprennent la place que la racine se réservait : pas de marge vide là où elle passait, pas de page allongée pour elle.
3. Un seul interrupteur : une constante nommée (par exemple `PROFILE_PLANT_VISIBLE = false`, près de `library/rootGrowth.ts`), lue par chaque endroit concerné. La remettre à `true` rend tout comme avant. Ni réglage pour l'utilisateur, ni changement de ce qui est écrit dans les fichiers (la valeur de l'objectif déjà enregistrée n'est ni lue ni effacée tant que la plante est cachée).
4. Les tests purs de la plante continuent de tourner. Un test neuf dit que la plante est cachée là où un test en environnement node peut le voir (par exemple : aucune leçon ne la cite).
5. Banc : les scripts `racine` et `racine-periodes` passent en « manuel » dans `outils/banc/scripts.mjs`, avec la raison ; `outils/banc/SCRIPTS.md` le dit. Si un autre script lit un texte de la plante ou de l'objectif (`profil`, `reglages`, `tutoriels`, `aides`, `tailles`, `miseajour`), l'adapter et le dire dans le rapport.

## Ne pas faire

- Ne supprimer aucun fichier de la plante, ne pas toucher à `docs/` hors de ce brief, ni commit ni version.
- Ne pas redessiner le Profil : sa nouvelle disposition viendra de la maquette (éléments 344 et 346).

## Rapport attendu

Le rapport habituel (FAIT, BLOQUÉ ou ÉCHEC), avec la liste des endroits qui lisent la constante, ce que devient l'objectif par semaine, et les scripts du banc à rejouer avec les changements de texte attendus.
