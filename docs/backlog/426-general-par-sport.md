# 426 · Analyse › « général » : ce qui compte pour chaque sport

## Tel que dit par l'utilisateur (note du 17/11)

« Le saut doit être indiqué de base en kite et en wing s'il n'est pas décoché ; les cadences de pumping cochées de base en surf foil, en [mot dicté « camping »] et en paddle foil, ce genre de chose. »

## Relevé dans le code (17/11, à revérifier)

Les sauts sont déjà cochés d'office en wing, planche et kite (`src/settings/activityPresets.ts`), le pumping seulement pour l'activité « Pumping ». Ce que la fenêtre « général » montre n'est pas encore propre au sport.

## Décisions

- **Q124, tranchée par son défaut le 17/11 sur consigne de l'utilisateur** : des tuiles dans « général », chacune décochable comme le reste, et non les seuls onglets montrés d'office.
  - Sauts (activités dont le calcul sait les sauts : kite, wing, planche) : nombre de sauts et plus haut saut.
  - Pumping (surf foil, paddle foil, et l'activité « Pumping ») : cadence de pumping et part du vol.
- **Le mot dicté « camping »** : lu par l'orchestrateur comme « pumping », l'activité « Pumping » de la famille surf, qui a déjà son pumping coché ; à confirmer par l'utilisateur à la validation, sans bloquer le lot.
- Les pré-réglages suivent : la cadence de pumping est cochée d'office pour surf foil et paddle foil (activités de départ, `activityPresets`), comme elle l'est pour « Pumping » ; les sauts restent cochés d'office en kite, wing et planche. Une activité déjà réglée par l'utilisateur garde ses choix : seul le « défaut » change.
- Une tuile ne se montre que si la session porte la donnée (pas de tuile « 0 saut » sur une session sans capture de sauts, pas de cadence sans mesure) : même règle que les tuiles existantes de « général ».

## Voulu

La fenêtre « général » de chaque famille et de chaque activité porte d'office ce qui compte pour elle, décochable comme le reste (liste de « général » par sport : `docs/DECISIONS.md` §1 et §4 ; disposition : `docs/MISE_EN_PAGE.md`, « général » et « avancé »).

## Contraintes

- Un comportement se lit dans les capacités du profil, jamais par un nom de calcul en dur (`src/architecture.test.ts`).
- Recette « un réglage utilisateur » de `docs/DEVELOPPER.md` si une case neuve apparaît ; textes par `t`, `tn`, trois langues ; formats par `core/units.ts`.
- Les chiffres viennent des calculs existants (sauts : `core/jumps.ts`, `useSessionJumps` ; pumping : le calcul de cadence existant) : aucun calcul neuf, aucun changement de `summary` sauf nécessité dite dans le plan.
- Sessions existantes : rien ne change pour une activité dont l'utilisateur a déjà réglé les cases.

## Banc

Sessions de kite ou de wing avec sauts, session de surf foil avec pumping : « général » montre les tuiles neuves ; les autres pages gardent leur texte.

## Essai au téléphone

Un essai : une session de wing avec sauts et une de surf foil → « général » montre les tuiles de sauts et de pumping, et les décocher dans Réglages les retire.
