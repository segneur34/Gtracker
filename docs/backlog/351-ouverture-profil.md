# 351 · L'application s'ouvre sur le Profil

Modèle | Réflexion : Opus | high

## Tel que noté

Demande du 12/11 : « ce serait bien que la page d'accueil soit la page de profil […] avec un moyen simple de passer de l'un à l'autre ». Tranché le 12/11 sur la planche : deux pages, la barre du bas devient Profil, Sessions, bouton rond, Statistiques, Réglages. Planche finale validée le 12/11 au soir. Cinquième lot du paquet de la nouvelle apparence, après la page Sessions (346), dont il est la seconde moitié.

## Source (hors dépôt, à lire, ne rien y écrire)

`D:\gong tracker\atelier\maquette-da-1211\construire-finale.mjs` : le Profil (lignes 98 à 104), les barres et l'ordinateur (lignes 108 à 125), leur feuille de style (lignes 190 à 226) ; `planche-finale.html` à côté pour la voir. Photos : `D:\gong tracker\gong\da\assets\photos\` (six captures, dans l'ordre alphabétique des noms : la 2 est le wingfoil, la 5 le paddle en surf).

## Décisions déjà prises

- L'application s'ouvre sur le Profil. Le logo GONG et « Profil » mènent tous deux à cette page.
- Barre du bas, sur téléphone (rail à gauche sur téléphone tourné) : Profil, Sessions, le bouton rond, Statistiques, Réglages.
- Barre du haut, sur ordinateur : Profil, Sessions, Planifier, Statistiques, Réglages en liens, puis le bouton vert « Enregistrer ». « Planifier » remplace le bouton « Itinéraires » d'aujourd'hui et mène au même endroit.
- Le Profil, sur téléphone : un en-tête à photo (logo GONG et « Gtracker » en haut à gauche, « Live for it. » en bas à droite), l'avatar à cheval sur le bas de la photo, « Bienvenue » et le pseudo ; puis les périodes en pastilles et les cadres d'aujourd'hui (chiffres, temps par activité, heures par semaine), dans l'allure de la planche. La plante reste cachée.
- Le Profil, sur ordinateur : l'en-tête à photo en grand (« Live for it. » en très grand), puis deux colonnes : à gauche le Profil, à droite « Vos activités » (la rangée de logos de la page Sessions, le bouton « Toutes les sessions », les cinq dernières sessions).
- Photo d'en-tête (question Q109, sans réponse à ce jour : son défaut vaut) : la 2 (wingfoil) sur téléphone, la 5 (paddle en surf) sur ordinateur. Ces photos sont à GONG ou à ses photographes : bonnes pour une démonstration faite à GONG, leur accord est à obtenir avant toute diffusion (à porter dans les crédits, élément 308).
- Le retour d'Android remonte de l'analyse à Sessions, puis de Sessions au Profil, puis quitte ; Statistiques, Réglages et les autres pages remontent au Profil. Un brouillon non enregistré demande toujours confirmation.
- Les cartes d'ouverture (mémoire à désigner, autorisations, invitation du profil), que le 346 a posées en tête de Sessions, viennent en tête du Profil, mêmes gardes, même ordre.
- La leçon du jour reste en pause.
- Tranché par l'orchestrateur : le Profil garde son adresse `/profil` et `/` y mène ; `/sessions` garde la sienne.

## Voulu

1. L'ouverture, les deux barres et le rail dans leur ordre final ; le parent de chaque page (`core/parentPage.ts`) et le retour d'Android.
2. Le Profil selon la planche, sur téléphone, téléphone tourné et ordinateur ; les deux photos converties et embarquées à une taille raisonnable (dire dans le rapport le poids et la façon de faire).
3. Les leçons et les aides « ? » qui parlent de l'accueil ou de l'ordre des barres réécrites.
4. Tests : `src/architecture.test.ts`, `core/parentPage`, ce qui lit l'ordre des destinations.
5. Banc : les scripts qui lisent la barre, l'ouverture ou le Profil adaptés (liste à donner par le plan).

## Ne pas faire

- Ni avatar vide ni choix de photo d'avatar (350) : l'avatar reste celui du lot 349.
- Ne pas toucher à `docs/` hors de ce brief (l'orchestrateur met à jour `CLAUDE.md`, décision « Navigation », et DECISIONS §9 et §11), ni à `package.json`, ni commit ni version.

## Rapport attendu

Le rapport habituel, avec : les textes neufs, le poids des photos, les scripts du banc adaptés et les changements de texte attendus, et ce qui est à regarder au téléphone.
