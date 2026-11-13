# 359 · Boutons colorés, à l'essai

Demandes de l'utilisateur du 13/11. Petit lot d'habillage, Sonnet/medium. Aucun calcul touché.

## Ce qui est demandé

1. **Analyses (voile et surf), bouton « tout fermer »** à droite de la barre d'onglets : « il ne se différencie pas assez des autres ». Il passe en rouge, à l'essai. Tranché par l'orchestrateur : contour et texte rouges (`--danger`), fond inchangé, pas d'aplat rouge, pour qu'il reste plus discret qu'un onglet allumé ; même rendu sur ordinateur, téléphone et téléphone tourné, thème clair et sombre.
   - Fichiers : `src/components/CollapsibleSectionTabs.tsx`, `src/pages/analysisMobile.css` (bloc « tout fermer », vers la ligne 132), et la feuille de style de la barre sur ordinateur si le bouton y est stylé ailleurs.
2. **Enregistrer, écran d'une session en attente** (« Continuer l'enregistrement », « Analyser », « Jeter », `src/pages/RecordingPage.tsx` vers la ligne 1000) : « il faudrait colorier en vert continuer, noir analyser et rouge jeter ».
   - « Continuer l'enregistrement » : aplat vert vif (`--record`), texte noir dans les deux thèmes (la charte : le vert est toujours un aplat sous du noir, jamais un texte).
   - « Analyser » : aplat à l'encre (`--ink`), texte de la couleur du fond ; noir le jour, donc blanc la nuit, comme tout ce qui est allumé.
   - « Jeter » : aplat rouge (`--danger`), texte blanc.
   - Formes, tailles, ordre et gestes inchangés (pilules, capitales d'action). Si « Continuer » n'est pas proposé, les deux autres gardent leur couleur.

## Règles

- Uniquement des variables de `src/theme/tokens.css` ; en ajouter une seulement si aucune ne convient, dans les deux thèmes.
- Ne pas toucher aux fichiers du lot 358, qui tourne en même temps dans le même dossier : `src/pages/ProfilePage.tsx`, ses styles, `src/library/activityChart.ts`, `src/library/stats.ts` et leurs tests. Jamais de `git stash`, `checkout`, `restore`, `clean` ni `reset` ; un échec de test hors de ses fichiers se signale, il ne se corrige pas.
- Pas de commit, pas de version, pas de décision de l'utilisateur.

## Vérification

- `node outils/verif.mjs --rapide` vert.
- Le texte des pages ne change pas : le banc doit rester identique (l'orchestrateur le passe). Dire dans le rapport quels scripts du banc voient ces deux endroits.

## Essai au téléphone (posé par l'orchestrateur)

Un coup d'œil sur les deux endroits, clair et sombre : à garder ou à défaire.
