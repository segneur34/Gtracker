# 471 · Fermer un onglet efface de la carte ce qu'il y faisait afficher

Modèle | Réflexion : Opus | high (code) ; Sonnet | medium (contrôle ajouté au script du banc).

Demande et constat : `node outils/backlog.mjs --ligne 471`. Plan de l'agent `Plan` du 20/11, relu par l'orchestrateur.

## Constat du plan

- Un onglet est ouvert quand `open[clé]` est vrai, rendu par `useAnalysisTabs` (`src/hooks/useAnalysisTabs.ts`) après `maskHiddenTabs` et `maskAdvancedTabs` : pastille éteinte, titre replié, « tout fermer », « avancé » refermé, onglet caché par Réglages et changement de session donnent tous `false`.
- La surbrillance unique s'efface déjà à la fermeture : `src/hooks/useMapHighlight.ts` (`if (shown !== null && !open[shown.panel]) setShown(null)`, pendant le rendu), instancié par `useAnalysisTabs` avec `open` déjà masqué.
- Seules échappent à la règle les trois cases de l'onglet `manoeuvres` de la voile : `showTacksOnMap`, `showJibesOnMap`, `showUndecidedOnMap` (`src/pages/SailingModule.tsx`, simples `useState`, passés par `ManeuversOnMap` à `ManeuversPanel`, dessinés dans `staticMapLayers`).
- Déjà conformes (par `highlight` ou par `open`), rien à faire : tops, podiums, VMG, sauts, vols, pumping, zone cardio, repère de note, « Afficher » des graphes ; en surf : vagues, podium, remontées, zone du pic et sens des vagues. `SurfModule.tsx` ne change pas.
- Hors lot : trace, flèches, légende, fond, fanions des repères, boussoles du vent et du sens des vagues, `focus`. Les vues du panneau manœuvres (`maneuversView` : détails, listes) ne dessinent rien et restent retrouvées à la réouverture.

## À faire

1. `src/core/analysisTabs.ts` : fonction pure `keepOpenTabEntries(entries, open)`, qui retire les entrées dont l'onglet est fermé et rend l'objet reçu quand rien ne change. Tests dans `src/core/analysisTabs.test.ts` : rien de fermé (même référence), un onglet fermé (ses entrées partent, les autres restent), liste vide.
2. `src/hooks/useMapHighlight.ts` : à côté de la surbrillance unique, des cases cumulables rattachées à un onglet : `toggled(panel, key)` et `toggle(panel, key)`, état `{ panel, key }[]` élagué au même endroit et de la même façon que la surbrillance, par la fonction commune. Rien n'est ramené à la réouverture. Commentaire d'en-tête à revoir.
3. `src/pages/SailingModule.tsx` : retirer les trois `useState` ; `maneuversOnMap` lit `highlight.toggled('manoeuvres', …)` et bascule par `highlight.toggle('manoeuvres', …)` ; `ManeuversOnMap` et `ManeuversPanel` gardent leur forme ; commentaire voisin (« l'onglet rouvert les retrouve » ne vaut plus que pour les vues) et dépendances du `useMemo` de `staticMapLayers` à revoir.
4. Toute case future d'un onglet qui dessine sur la carte passe par `highlight.toggle` : pas de `useEffect` par case.

Tranché par l'orchestrateur : « avancé » refermé ou onglet décoché dans Réglages effacent aussi les cases, sans les ramener, comme la surbrillance aujourd'hui (c'est le sens de « la carte ne montre que ce que demandent les onglets ouverts »).

## Banc (partie à part, Sonnet)

`outils/banc/bench.mjs`, en fin de script : virements allumés, fermer l'onglet « manœuvres », compter les ronds de manœuvre sur la carte (0 attendu) ; rouvrir : toujours 0 et le bouton redit « Voir » ; de même en refermant « avancé ». Entrée de `outils/banc/SCRIPTS.md` mise à jour. Les autres scripts (`general`, `onglets`, `zoom-carte`, `surf`, `pumping`, `sauts`, `cardio`) doivent rester identiques.

## Passe de doc (après validation)

`docs/MISE_EN_PAGE.md`, à la suite de « Une seule surbrillance » : « Tout ce qu'un onglet fait dessiner sur la carte (surbrillance, cases cumulables comme virements, empannages et indécis) s'efface quand il se ferme, pastille éteinte, titre replié, « avancé » refermé ou « tout fermer » compris, et rien n'est ramené à sa réouverture (`useMapHighlight`) ; les vues du panneau (détails, listes dépliées) restent. »
