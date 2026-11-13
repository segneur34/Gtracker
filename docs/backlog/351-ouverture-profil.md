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
- Photo d'en-tête (réponse de l'utilisateur du 13/11 à Q109 : « comme sur la planche ») : la 2 (wingfoil) sur téléphone, la 5 (paddle en surf) sur ordinateur. Ces photos sont à GONG ou à ses photographes : bonnes pour une démonstration faite à GONG, leur accord est à obtenir avant toute diffusion (à porter dans les crédits, élément 308).
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

## Questions tranchées par l'orchestrateur (13/11), d'après le plan

- Retour d'Android depuis Itinéraires et Planifier : il remonte à Sessions, où est leur entrée sur téléphone (« Créer un parcours », « Itinéraires »), comme le test de FC repos remonte à son entrée ; les autres pages (Statistiques, Réglages, Enregistrer) remontent au Profil.
- Sur ordinateur, un appui sur un logo de « Vos activités » filtre les cinq lignes sur place, et « Toutes les sessions » ouvre Sessions avec ce filtre.
- La photo du téléphone ne fait que 565 px de large : embarquée telle quelle, sans agrandissement ; sa netteté est à regarder au téléphone, l'original se demandera à GONG.
- L'ordre des barres vit dans un module pur `src/core/navigation.ts`, testé. Deux colonnes à partir de 1000 px. Sans pseudo : « Bienvenue » seul. Les cartes d'ouverture viennent sous l'en-tête à photo. Les lignes de session du Profil n'ont pas de « … ». `PageBackdrop`, `useFavoriteBackdrop` et les variables `--backdrop-*` s'en vont s'ils n'ont plus d'emploi. Titres des cadres : ceux d'aujourd'hui, sauf s'ils contredisent la planche ; « Depuis le début » gardé. Le lien du test de FC repos reste sous le pseudo. Le script de conversion des photos reste hors du dépôt.

## Plan (agent Plan, 13/11), à suivre sauf constat contraire dans le code

Il part de l'état où le 346 est fait ; les numéros de ligne sont ceux d'avant le 346 et le 349, à retrouver.

Aujourd'hui :
- `src/App.tsx` : `/` (le 346 y met `Navigate` vers `/sessions` et importe `SessionsPage` d'office), `*` → `/`, `ProfilePage` chargée à la demande.
- `src/components/AppShell.tsx` : `HOME` (« Sessions » après le 346), le logo et `goHome` vers `/`, les liens du haut, le bouton « Itinéraires » (`.shell-topplan`), la barre du bas ; le rail est la même barre, posée en CSS.
- `src/core/parentPage.ts` : `/` vaut `null` (et `/sessions` après le 346), `/` pour les Statistiques et par défaut.
- `src/pages/ProfilePage.tsx` : fond `PageBackdrop` et `useFavoriteBackdrop`, avatar, titre, lien du test de FC repos, `RootSlot`, périodes, `MemoryStatus compact`, les cadres, `ActivityChart` ; classes `profile-*`.
- Cartes d'ouverture : en tête de `SessionsPage` depuis le 346 (`profilePromptGate`, `tutorialCardGate`, `PermissionsPrompt`, `ProfilePrompt`, `TutorialOfDay`).

Structure :
- Créer `src/assets/profil/entete-telephone.webp` (photo 2) et `entete-ordinateur.webp` (photo 5) ; `src/core/navigation.ts` et son test (les deux barres en listes de `{ to, label }`, `AppShell` y ajoute les icônes).
- Modifier `App.tsx` (`ProfilePage` d'office, `SessionsPage` à la demande et en tête du préchargement, `/` et `*` → `<Navigate to={PROFILE_PATH} replace/>`, commentaires), `AppShell.tsx` et son CSS, `parentPage.ts` et son test, `ProfilePage.tsx` et son CSS, `SessionsPage.tsx` (les cartes d'ouverture en sortent), `ErrorBoundary.tsx` (« Revenir au Profil »), les commentaires de `platform/backButton.ts`, `lessons.ts`, `architecture.test.ts`.
- Réutiliser sans copie : `ActivityBubbles`, `SessionRow`, `sessionsList.filterSessions`, `sortSessions`, `sessionsPath`, `SESSIONS_PATH` ; `useNarrowScreen` (la colonne de droite n'est pas montée sur téléphone, ses vignettes ne se calculent pas pour rien) ; `GongLogo`, `ProfileAvatar`, `MemoryStatus`, `Button`.
- Photos : aucun outil d'image dans `node_modules` ; conversion par un script jetable hors dépôt, qui ouvre le Chrome du banc (`outils/banc/cdp.mjs`), dessine la photo sur un canevas et l'exporte en WebP à 0,8. Téléphone : 565 × 430 gardée telle quelle, 40 à 60 Ko visés ; ordinateur : 1117 × 738, 130 Ko au plus. En `background-image` dans `ProfilePage.css`, sous les deux requêtes d'écran d'`AppShell.css` : seule celle de l'écran se télécharge ; aucune en mode économe ; un aplat du thème tient la place pendant le chargement. Un commentaire en clair dit que les photos sont à GONG et que leur accord est à obtenir avant diffusion.

Adresses, barres, retour :
- `PROFILE_PATH = '/profil'` ; `parentPage` : `/` et `/profil` → `null` ; `/sessions` → `/profil` ; une analyse → `sessionsPath(activite)` ; le haut des Statistiques → `/profil` ; `/profil/fc-repos` → `/profil` en comparaison exacte ; itinéraires et planification → `/sessions` ; le reste → `/profil`.
- Bas et rail : Profil, Sessions, rond, Statistiques, Réglages. Haut : Profil, Sessions, Planifier (vers `/itineraires`, `NavLink` sans `end`), Statistiques, Réglages, puis « Enregistrer » ; `.shell-topplan` disparaît ; le logo et `goHome` mènent à `/profil` directement.
- Tests : `parentPage.test.ts` (dont « Sessions remonte au Profil » et « Profil : rien au-dessus »), `architecture.test.ts` (`/profil` et `/sessions` présentes, `/` et `*` vers le Profil), `navigation.test.ts`.

Disposition :
- Téléphone : en-tête photo pleine largeur d'environ 160 px, logo GONG et « Gtracker » en haut à gauche, « Live for it. » en bas à droite ; avatar de 80 px à cheval sur le bas de la photo, « Bienvenue » au-dessus du pseudo (classe `profile-head__title` gardée) ; lien du test de FC repos ; `RootSlot` sous son interrupteur ; cartes d'ouverture, mêmes gardes et même ordre ; périodes, `MemoryStatus compact` (si la carte mémoire complète n'est pas montrée), les cadres. Classes `ROOT_CARDS` gardées.
- Téléphone tourné : même colonne, rail à gauche, en-tête d'environ 110 px.
- Ordinateur : pas de logo dans la photo ; en-tête de 230 px, « Live for it. » très grand (variable neuve dans `tokens.css`) ; page large d'environ 1180 px, deux colonnes à partir de 1000 px, une seule de 768 à 999 px ; à gauche le Profil ; à droite « Vos activités » (h2), `ActivityBubbles`, le bouton creux « Toutes les sessions », les cinq dernières sessions visibles par date décroissante, en `SessionRow` sans « … ».

Leçons et textes : la leçon `profil` de `lessons.ts` réécrite (l'application s'ouvre ici, Sessions à côté dans la barre, « Vos activités » à droite sur ordinateur) ; relire celles qui parlent du bouton rond et des barres, et le commentaire « barre du bas » de `SettingsPage.tsx`. Clés `accueil.graphe` et `accueil-profil:*` à ne pas renommer.

Étapes, chacune suivie de `node outils/verif.mjs --rapide` : 1. `navigation.ts`, `PROFILE_PATH`, `parentPage` et tests ; 2. `App.tsx`, `AppShell`, `ErrorBoundary`, `architecture.test.ts` (relever le poids du morceau d'entrée de `vite build` avant et après) ; 3. photos ; 4. Profil sur téléphone et téléphone tourné, cartes d'ouverture retirées de Sessions, fond retiré ; 5. colonne « Vos activités » ; 6. leçons et textes.

Pièges : Sessions ne vaut plus `null` (le retour mène au Profil) ; `ProfilePage` d'office fait entrer `ProfileRoot` et `drawRoot` dans le morceau d'entrée : les charger à la demande si le poids monte ; `LogoSprite` est chargé à la demande, l'avatar peut rester vide un instant à l'ouverture : le précharger au besoin ; texte sur la photo en blanc fixe, de jour comme de nuit ; rappels de `SessionRow` stables ; ne rien changer sous `profile-head__title` et `profile-head__link`, que le banc lit.

Banc (pour l'orchestrateur, après le 346) : barre : `aides`, `cacher`, `profil`, `vides`, `surf`, `statistiques`, `rendus`, `tailles` (ordre « Profil | Sessions | Statistiques | Réglages », « Planifier » à la place d'« Itinéraires », le logo ouvre le Profil) ; ouverture : `icones`, `surf`, `tutoriels`, `donnees`, `fichier-recu`, `cacher`, `vides`, `profil` passent par `/sessions`, `fluidite` prend le repère du Profil, `PRECHAUFFE` de `passe.mjs` reçoit `/profil` ; Profil : `profil`, `aides`, `glisser`, `racine`, `racine-periodes`, `reduire`, `fc-repos`, `test-fcrepos`, `donnees`, `tailles`. Textes neufs : « Gtracker » sur téléphone, « Live for it. », « Bienvenue », « Vos activités », « Toutes les sessions » et cinq lignes sur ordinateur ; plus de cartes d'ouverture sur Sessions.

## Rapport attendu

Le rapport habituel, avec : les textes neufs, le poids des photos, les scripts du banc adaptés et les changements de texte attendus, et ce qui est à regarder au téléphone.
