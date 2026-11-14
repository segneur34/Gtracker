# 373 · Le test de FC repos quitte le Profil pour Réglages › Pratiquant

Modèle | Réflexion : Sonnet | high.

## Demande de l'utilisateur (14/11)

« Il faut enlever le bouton test FC repos qu'il y a dans la page profil. Il faut faire un petit bouton test à droite ou plutôt à gauche de l'option où il faut remplir le nombre de BPM dans les paramètres utilisateurs. C'est plus judicieux là, il n'a rien à faire là-bas le bouton. »

## Décisions déjà prises (par l'utilisateur, ou tranchées par l'orchestrateur)

- Le lien « Test de FC repos » disparaît de la page Profil. Rien ne le remplace là.
- Dans Réglages, cadre Pratiquant, un petit bouton « Test » est posé à gauche du champ « Fréquence cardiaque de repos » (à gauche de la case où l'on tape les bpm, sur la même ligne). Il ouvre la page du test. Nom accessible : « Test de FC repos ».
- L'adresse de la page du test ne change pas (`RESTING_HR_PATH`) : une adresse s'ouvre toujours, et rien n'est à migrer.
- La page du test remonte désormais à Réglages : son bouton de retour (`PageHeader`, aujourd'hui « Profil ») et le retour d'Android (`core/parentPage.ts` ou ce qui en tient lieu) mènent à `/parametres`. Tranché par l'orchestrateur : on revient d'où l'on vient.
- Sur le Profil, le bocal du poisson garde sa place, à droite du texte de l'en-tête ; il était calé sur la ligne du lien, il se cale désormais sur le bas du bloc de texte (titre, pseudo). Le bouton de période reste sous la photo. Aucune autre retouche de la page.

## À faire

1. `pages/ProfilePage.tsx` et `ProfilePage.css` : retirer le lien, sa rangée et ses styles devenus morts ; accorder les commentaires qui parlent du lien ; vérifier la tenue de l'en-tête et du bocal à 320, 390 points et à l'ordinateur (pas de trou à la place du lien, pas de défilement horizontal).
2. `pages/SettingsPage.tsx` (vers la ligne 813, `NumberField` « Fréquence cardiaque de repos ») : le petit bouton « Test » à gauche du champ, avec les pièces de `components/ui` (pas de style en dur, variables de `theme/tokens.css`), zone de toucher d'au moins 44 points sur téléphone. L'aide du champ ne dit plus « (page Profil) » : « Le bouton Test la mesure avec la ceinture. » ou équivalent.
3. `pages/RestingHrTestPage.tsx` et `.css`, `recording/restingHrTest.ts` : retour vers Réglages, commentaires « sous le Profil » accordés. Le lien « Réglages » du texte « Votre FC repos actuelle » reste.
4. Chercher par Grep tout autre texte ou commentaire qui situe le test sous le Profil (`tutorials/lessons.ts`, `core/navigation.ts`, `core/parentPage.ts`, tests) et l'accorder ; un test qui fige le parent de la page du test est mis à jour en le disant.
5. `docs/DECISIONS.md` §5 (première ligne : « sous le Profil […] lien dans la page Profil ») et §9 si elle cite le lien : accorder en une phrase, datée du 14/11. `CLAUDE.md` : la table « Avant de toucher à » dit « test de FC repos (…, sous le Profil) » : accorder ces mots seulement. `docs/INVENTAIRE.md` seulement si une ligne situe la page sous le Profil.
6. Banc : chercher dans `outils/banc/` les scripts qui touchent ou attendent « Test de FC repos » sur le Profil (script profil, et celui du test s'il existe) et les accorder au nouveau chemin (Réglages › Pratiquant › « Test »).

## Ajout du 14/11, même lot : l'ordre des cadres de Réglages

« Il faut que dans l'ordre, ça soit quelque chose comme le pratiquant tout en haut, activité, capteur, enregistrement, affichage, carte hors ligne, et après les autres. »

Les cadres de premier niveau de `pages/SettingsPage.tsx` passent dans cet ordre : Pratiquant, Activités, Capteurs, Enregistrement, Affichage, Cartes hors ligne, puis les autres dans leur ordre actuel entre eux. Seul l'ordre change : ni contenu, ni état replié, ni identifiants. La rotation de l'angle du coup de pinceau (lot 371) suit le nouvel ordre. `docs/DECISIONS.md` §11 accordée si elle dit l'ordre.

## Ce qui ne change pas

Le test lui-même (protocole, sons, courbe, résultats gardés, « La retenir comme FC repos »), son adresse, le poisson, le bouton de période.

## Vérification

`node outils/verif.mjs --rapide` par l'agent. Par l'orchestrateur : `npm run verif`, puis le banc sur les scripts profil et reglages (et celui du test s'il existe), avant et après.

## Essai au téléphone

Sur l'APK : le Profil ne montre plus « Test de FC repos » ; Réglages › Pratiquant › « Test » à gauche de la FC de repos ouvre le test ; le retour d'Android ramène à Réglages.
