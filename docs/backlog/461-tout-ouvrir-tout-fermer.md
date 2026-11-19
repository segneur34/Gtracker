# 461 · Analyses : « tout ouvrir » vert, puis « tout fermer » rouge

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (note du 19/11)

« Dans les analyses le bouton tout fermer doit devenir un bouton "tout ouvrir" vert qui ouvre tout et quand il y a au moins 2 onglets ouverts il devient un "tout fermer" rouge. »

## Constat (lu dans le code le 19/11, à revérifier)

- `src/components/CollapsibleSectionTabs.tsx` : un seul bouton, « tout fermer » (`an-tabs-close-all`, contour et texte rouges), qui appelle `onCloseAll`.
- `src/hooks/useAnalysisTabs.ts` rend `closeAll` (fonction pure `closeAllTabs`) ; `SailingModule` et `SurfModule` le passent à `AnalysisShell`.

## Voulu

1. Un seul bouton, à la même place. Moins de deux onglets ouverts (parmi ceux montrés) : « tout ouvrir ». Deux ou plus : « tout fermer », comme aujourd'hui.
2. « tout ouvrir » ouvre tous les onglets montrés pour l'activité, ceux de la rangée « avancé » compris, et déplie cette rangée si elle en a, pour que les onglets ouverts s'y voient. Un onglet caché par le choix de l'activité (Réglages, ligne « Onglets ») ou absent de la session (cardio sans fréquence cardiaque) reste fermé. Aucune surbrillance n'est posée sur la carte.
3. Couleurs, par les variables de `theme/tokens.css` seulement : « tout fermer » garde son contour et son texte rouges ; « tout ouvrir » est un aplat du vert vif sous du texte noir, de jour comme de nuit (la charte interdit le vert vif en texte ou en contour ; reprendre les variables du bouton « Enregistrer » de la barre du haut).
4. Libellés en minuscules comme aujourd'hui, par `t` ; infobulle « Ouvrir tous les onglets » ; anglais et espagnol dans `src/locales/`.
5. La logique est pure et testée : la fonction qui ouvre tout (à côté de `closeAllTabs`) et celle qui dit lequel des deux boutons montrer.
6. Voile et surf, ordinateur et téléphone (`src/pages/analysisMobile.css` et la feuille de l'ordinateur).

## Contraintes

- `docs/MISE_EN_PAGE.md` : rien d'autre ne bouge dans la barre d'onglets.
- `docs/DECISIONS.md` §12 dit encore « Tout fermer […] en contour et texte rouges » : ne pas y toucher, récrit à la validation.
- Scripts du banc qui citent le bouton : `outils/banc/barre.mjs`, `outils/banc/onglets.mjs` ; les adapter seulement si le changement les casse.

## Banc

`onglets`, `barre`, `general`, `surf` : texte identique tant que deux onglets ou plus sont ouverts ; « tout ouvrir » à la place de « tout fermer » quand il y en a moins de deux.

## Essai au téléphone

Sur une longue session, « tout ouvrir » : dire si l'attente est acceptable.
