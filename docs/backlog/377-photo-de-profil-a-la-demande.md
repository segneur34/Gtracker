# 377 · Réglages du Profil : le choix de la photo à la demande

Modèle | Réflexion : Sonnet | high. Lot petit, un seul agent.

## Demande

Remarque de l'utilisateur du 14/11 au soir sur l'APK 0.00.63, en regardant Réglages › Pratiquant : « il faudrait pas avoir tout le temps les propositions de profil, il faudrait un bouton changer image, et là les propositions s'ouvrent, et aussi le bouton importer une image ».

Aujourd'hui la ligne « Photo de profil » des réglages de l'écran Profil montre en permanence la grille des logos d'activité, « Importer une image » et « Retirer » (`AvatarPicker`, dans `src/components/ProfileAvatar.tsx`, montré par `src/components/ProfileScreenSettings.tsx`). Cela allonge beaucoup la tête de Pratiquant et le panneau « Réglages du Profil ».

## Résultat attendu

À la ligne « Photo de profil » : la photo actuelle en petit rond (ou le rond vide s'il n'y en a pas) et un bouton « Changer l'image ». Rien d'autre au repos. Toucher le bouton déplie dessous les logos proposés, « Importer une image » et « Retirer » ; le retoucher les replie.

## Compris ainsi, et tranché par l'orchestrateur

1. Aux deux endroits : le panneau ouvert par la photo ronde du Profil et Réglages › Pratiquant, puisque c'est la même pièce partagée (lot 376, « tous les paramètres qui vont avec l'écran doivent être aux deux endroits »). Une seule modification, dans la pièce.
2. Replié à chaque ouverture : l'état déplié est local à la pièce, jamais gardé dans le profil ni dans une clé de l'appareil.
3. Après un choix (logo, image importée, « Retirer »), les propositions restent ouvertes, pour en essayer plusieurs ; le petit rond à côté du bouton montre tout de suite le choix. Le bouton sert à refermer.
4. Le bouton garde le même mot ouvert et fermé (« Changer l'image »), avec `aria-expanded` et `aria-controls` ; pas de second libellé.
5. Rien ne change dans ce qui est gardé : même champ du profil, même lecture de l'image importée, mêmes messages d'erreur. Une erreur d'import reste visible tant que les propositions sont ouvertes.

## À faire

- `AvatarPicker` : l'état replié ou déplié, le petit rond de la photo actuelle (reprendre le rendu de la photo ronde déjà dans `ProfileAvatar.tsx`, sans le copier), le bouton, le bloc déplié. Style par classes dans la feuille de la pièce, variables de `src/theme/tokens.css`, aucun style en ligne (`src/theme/inlineStyles.test.ts`), zones de toucher de 44 points au moins pour le bouton.
- Bouton dans la DA : pilule, bouton d'action secondaire comme « Importer une image » aujourd'hui (pièces de `components/ui`).
- Le texte d'aide « ? » de la ligne (« pratiquant:photo ») s'il ne dit plus juste.
- Scripts du banc : `outils/banc/profil.mjs` contrôle le choix de la photo depuis le Profil et depuis Réglages (contrôles écrits au lot 376) ; les accorder (toucher « Changer l'image » avant de choisir) et ajouter deux contrôles : au repos, ni grille ni « Importer une image » aux deux endroits ; après le bouton, les deux présents. Voir si `outils/banc/reglages.mjs` ou un autre script touche la photo (Grep) et l'accorder.
- `docs/DECISIONS.md` §9 et §11 et `docs/INVENTAIRE.md` : accorder la phrase qui décrit le choix de la photo, si elle existe, en une demi-phrase datée du 14/11.

## À ne pas faire

Pas de commit, pas de version, pas de passe sur ETAT ni HISTORIQUE. Ne pas toucher au choix du poisson, au nom, au nombre de sessions d'essai, ni à la photo ronde de l'en-tête du Profil elle-même. Commentaires de `src/` sans numéro de lot ni date (règle 14 de `CLAUDE.md`).

## Vérification

`node outils/verif.mjs --rapide` vert. Le script `profil` du banc joué seul du côté modifié pour régler ses contrôles (`outils/banc/LISEZMOI.md`) ; le passage avant/après complet est fait par l'orchestrateur.
