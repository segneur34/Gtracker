# 389 · Statistiques : la fenêtre « Sélection » à la nouvelle apparence

Modèle | Réflexion : Opus | high

## Demande (15/11)

« dans la sélection des statistiques, actuellement c'est les anciens boutons qui restent, donc ça serait bien de remettre les nouveaux boutons. Donc avec des cadres, avec les coups de pinceau alors arrondis. Ça serait ovale plutôt je veux dire, ça serait très bien. Colorier avec les couleurs évidemment pour ceux qu'on peut colorier avec des couleurs. Et également casser un petit peu le blanc de la page de sélection qui est tout blanc et c'est pas fou. Enfin globalement retravailler la DA de cette page. »

Elle répond aussi à la question Q117 du 14/11 (« les boutons [des Statistiques] doivent en avoir un fin, de la taille de ceux des autres boutons ou cadres dans Réglages ») : le trait des boutons est le coup de pinceau.

Pas de planche avant le code, choix de l'orchestrateur dit à l'utilisateur : toutes les pièces demandées existent déjà et ont été validées ailleurs (ovale au pinceau du Profil, cadres au pinceau, voile sur le champ de traînées) ; l'utilisateur juge sur le téléphone.

## L'existant

- Fenêtre : `src/pages/StatisticsSelection.tsx` (`StatsSelectionDialog`, dans un `Dialog`), styles dans `src/pages/StatisticsPage.css` (`.stats-selection-dialog`, `.stats-selection__*`). Quatre blocs : Famille, Activité, Période, Matériel, en gros boutons `ChoiceButtons` ; pied « Annuler » et « Valider ».
- Les lignes de matériel (`GearChoiceRows`) servent aussi sur la page, en petit ; le bouton d'ouverture de la fenêtre est `.stats-selection` (`src/pages/StatisticsPage.tsx`, vers la ligne 534).
- Ovale au pinceau : le bouton de période du Profil (`src/pages/ProfilePage.css`, vers les lignes 398 à 440 : `trait-cadre-pinceau.svg` posé en masque de bordure, repli en ovale au trait fin sans prise en charge du masque). Cadres au pinceau : `src/components/BrushFrame.css`, `src/components/brushFrame.ts`. Couleurs : `src/core/brushColor.ts` (`brushColorFor`, thème et blanc cerclé), `src/hooks/useFavoriteBrush.ts`. Les panneaux de la page Statistiques sont déjà au pinceau, à la couleur de l'activité choisie, sinon de l'activité favorite.

## Attendu

1. **Boutons de choix en ovale au pinceau** (famille, activité, période, matériel), le trait de l'ovale du Profil. La pièce devient partagée (pas de copie du CSS du Profil) ; le bouton du Profil ne change pas à l'écran.
2. **Couleur** : un bouton d'activité a son trait à la couleur de l'activité (thème sombre et blanc cerclé compris) ; les autres (Tout, familles, périodes, pièces de matériel) à l'encre. Règles de la DA à tenir (`CLAUDE.md`, « DA ») : ce qui est allumé l'est à l'encre ; la couleur d'une activité ne remplit jamais une grande surface et ne porte pas de texte.
3. **Bouton choisi**, tranché par l'orchestrateur : ovale plein à l'encre, texte à la couleur du fond, le trait de pinceau gardé autour (à la couleur de l'activité pour une activité) ; non choisi : trait seul sur le voile. Le choix doit se lire d'un coup d'œil, jour et nuit. Si ce rendu ne tient pas (lisibilité, masque), prendre le plus proche et le dire dans le rapport.
4. **Le blanc de la fenêtre cassé** : la fenêtre laisse voir le champ de traînées du fond de page derrière le voile (`--field-veil`), comme les cadres et les panneaux (DECISIONS §11, « Fonds de page »), et elle est elle-même dans un cadre au pinceau à la couleur de l'activité du brouillon, sinon de l'activité favorite, comme les panneaux de la page. Si le `Dialog` commun ne s'y prête pas (fond plein voulu pour les autres fenêtres), ne changer que cette fenêtre.
5. **Ensemble de la fenêtre** : titres de blocs gras dans leur casse, air entre les blocs, pied « Annuler » / « Valider » en boutons d'action de l'application (capitales, pilule ; « Valider » reste le bouton principal). Rien n'est retiré ni déplacé : mêmes blocs, même ordre, mêmes libellés, même comportement (brouillon, Valider, Annuler, Échap, retour d'Android).
6. **Sur la page** : les petites lignes de matériel et le bouton qui ouvre la fenêtre prennent le même trait, pour que page et fenêtre se ressemblent. `ChoiceButtons` sert peut-être ailleurs : la nouvelle apparence ne s'applique qu'aux Statistiques (variante ou classe), sauf si la pièce n'a pas d'autre usage ; le dire dans le rapport.
7. **Tenue** : 320 px et 390 px, téléphone tourné, ordinateur (fenêtre large), thème sombre, noms d'activité longs, texte agrandi ; chaque bouton garde une hauteur d'un doigt (`--touch-target`) ; pas de valeur en dur, tout par les variables de `src/theme/tokens.css`.

## Vérification

- Aucun texte neuf : rien dans `src/locales/`. Texte de la page et de la fenêtre identique au banc avant et après (`statistiques.mjs`, neutre) ; les scripts cliquent sur ces boutons : ils doivent encore passer (sélecteurs et rôles gardés).
- Dans le rapport : décrire en quelques lignes ce que l'on voit (bouton au repos, bouton choisi, fond), et tout écart avec les points 2 à 4.
