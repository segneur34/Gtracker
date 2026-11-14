# 374 · Profil : le banc de poissons et la mer qui monte (remplace le bocal)

Modèle | Réflexion : Opus | high, plan d'abord (agent `Plan`). Lot gros, en deux parties, chacune son agent et son commit. Avant d'y toucher : `docs/DECISIONS.md` §9 (Profil) et §11 (Réglages), `docs/MISE_EN_PAGE.md` n'est pas concerné (le Profil n'est pas une page d'analyse). Répond à l'élément 356 (« Profil : remplir la page »).

Matière, hors dépôt : `D:\gong tracker\atelier\maquette-banc-poissons-1411\` : `LISEZMOI.md` (planches 2 à 7, comment se transpose dans l'application), `LISEZMOI-poissons.md`, `reponses-utilisateur.md` (toutes les réponses, dans l'ordre), scripts `poissons.mjs` (sept styles, huit formes, `symbole()`), `banc.mjs` (places stables), `scene.mjs` (eau, bord marée, contournement des cadres). Planches de référence : `planche-6-maree.html` (forme du banc et de l'eau) et `planche-7-variete.html` (formes et tailles variées, rangées P4).

## Demande de l'utilisateur (14/11)

« Un banc de poissons qui s'agrandit et qui vient progressivement remplir l'accueil […] derrière lui ça doit être quasiment blanc », « que le banc de poissons grossisse par l'angle où il y a le bocal actuellement […] que les petits traits qu'il y a en dessous deviennent progressivement transparents, voire quasiment invisibles, et qu'il y ait une espèce de zone d'eau qui se répande juste devant les poissons […] comme si la mer était en train de monter progressivement dans la page, et remplacer le vent », « qu'ils arrivent depuis l'angle, qu'ils regardent l'intérieur de la page […] une forme de banc qui épouse les côtés des cadres […] comme si les cadres étaient des trucs rigides », puis : « L'installer sur l'application. Avec du coup les petits poissons, le fait qu'ils se répandent, le choix de poissons dans [le profil de l'utilisateur], moi je veux pouvoir garder le choix d'augmenter le nombre de poissons […] c'est temporaire, donc on va enlever le bocal aussi. »

## Arrêté sur maquette (14/11)

- **Le bocal part** : le poisson dans son bocal (lot 370) est retiré en entier, sa fenêtre de choix, ses 64 dessins (`src/assets/poisson/`), son calcul de niveau et son réglage d'essai « Niveau du poisson » ; git le garde. Les champs du profil du pratiquant qu'il ajoutait (`fishStyle`, `fishPath`, `fishTrialLevel`) sont retirés ; un ancien fichier qui les porte se relit sans erreur (champs ignorés, testé). Le champ `heldTotal` de `rootGrowth` reste s'il sert ailleurs, sinon part aussi.
- **Sessions comptées** : toutes les sessions de la bibliothèque, quelle que soit la période choisie par le bouton « 2026 / Tout ».
- **Nombre de poissons** : trois par session pour les 30 premières sessions, deux par session de la 31ᵉ à la 40ᵉ, puis un par session (« comme ça moins de chance que ça rentre ») : 90 poissons à 30 sessions, 110 à 40, 120 à 50, 170 à 100.
- **Départ et forme** : le banc et l'eau entrent par l'angle haut droit de la page, juste sous la photo d'en-tête. Les places sont prises dans l'ordre de la distance à cet angle mesurée en contournant les cadres et les textes (cadres et textes sont des obstacles rigides) : le banc longe les cadres et descend dans les couloirs. Quand les marges sont pleines, les poissons entrent dans les cadres **par leurs ouvertures** (le trait au pinceau des cadres du Profil a une ouverture), **sans jamais toucher un texte ni un chiffre**, pâlis dans les cadres comme sur la planche 6.
- **Stabilité** : une session de plus ajoute ses poissons sans déplacer ni changer les autres (forme, taille, angle), tant que la mise en page ne change pas. Les places dépendent de la mise en page réelle (cadres mesurés) : elles se recalculent quand elle change (largeur, rotation, ordinateur).
- **Orientation** : chaque poisson regarde à l'opposé de l'angle (il en sort) ; un écart propre à chaque poisson grandit avec son rang (planche 6 : 6° au départ, 0,45° de plus par poisson, 120° au plus) : les premiers sortent ensemble, puis les têtes se dispersent.
- **Petits poissons** : environ 10 à 15 px, surtout des moyens ; les poissons ne grossissent pas avec l'âge (essayé, refusé : « c'est bien quand c'est des petits poissons »). Huit formes par style (ordinaire, fin et long, rond, grande queue, fin fourchu, rond à grand œil, voilier, trapu courbé), tirées du rang, stables. Aucun chevauchement.
- **Styles** : les sept de la maquette (P1 Alevin au trait, P2 Silhouette, P3 Pictogramme, P4 Deux arcs, P5 Couleur d'activité, P6 Pinceau, P7 Ajouré), **P4 par défaut** ; le choix se fait dans Réglages › Pratiquant et voyage avec le profil du pratiquant. P5 prend la couleur de l'activité de la session du poisson (palette des activités). Le style n'est qu'un dessin : changer de style ne recalcule aucune place (chaque poisson est un `<use>` vers un `<symbol>` défini une fois).
- **L'eau** : une zone bleu très pâle (`#eef5f7` le jour, `#121b21` la nuit, en variables de `theme/tokens.css`), qui avance environ 26 px devant le banc et ne recule jamais, suit la même distance que les poissons et coule autour des cadres (son bord passe sous le trait du cadre). Bord « marée » : bord ondulé et deux lignes de marée à l'intérieur (planche 5, rangée marée ; planche 6). Sous l'eau, les traînées du fond de page ne gardent que 3 % de leur force (l'eau presque opaque posée sur le fond suffit) ; hors de l'eau, la page ne change pas.
- **Réglage d'essai** : dans Réglages › Pratiquant, « Nombre de sessions du banc (essai, provisoire) » : « Automatique » (le vrai compte) ou un nombre imposé (0 à 150 au moins), qui voyage avec le profil comme l'ancien réglage du niveau.

## Tranché par l'orchestrateur (provisoire, à redire à l'utilisateur)

- La zone du banc est la page du Profil sous la photo d'en-tête, sur toute la hauteur du contenu ; le banc défile avec la page.
- Pâleur dans les cadres : celle de la planche 6 (32 %).
- Le mode Économe garde le banc (dessin fixe, rien n'est animé).

## À faire

Partie A : le banc et l'eau sur le Profil, le bocal retiré.
1. Retirer le bocal (fichiers ci-dessus et leurs tests, places dans `ProfilePage`, `SettingsPage`, `athleteProfile`, `useAthleteProfile`, `profilePrompt`, banc `outils/banc/profil.mjs`), relecture sans erreur d'un ancien profil.
2. Calcul pur, testé (dossier au choix du plan, parmi ceux des calculs purs) : le nombre de poissons d'un compte de sessions ; les places stables d'après les obstacles mesurés (rectangles des cadres, de leurs ouvertures et des textes) et l'angle de départ ; l'orientation ; la forme et la taille de chaque poisson ; le contour de l'eau. Tests : stabilité de n à n+1 sessions, aucun poisson sur un texte, aucun chevauchement, entrée dans un cadre seulement par son ouverture et seulement marges pleines, compte 3/2/1 aux bornes 30 et 40.
3. Les dessins : les sept styles × huit formes exportés une fois de `poissons.mjs` (script d'export rangé dans l'atelier, pas dans le dépôt), encre et papier reliés aux variables du thème.
4. La couche du Profil : eau (bord marée) puis poissons, entre le fond de page et le contenu ; jour et nuit ; mesures des cadres relues au changement de mise en page.
5. Réglage d'essai du nombre de sessions dans Réglages › Pratiquant.

Partie B : le choix du poisson.
6. Dans Réglages › Pratiquant, le choix du poisson parmi les sept styles (liste dessinée par l'application, aperçu du poisson), P4 par défaut ; P5 en couleurs d'activité.
7. Banc `profil` accordé (bocal retiré, banc présent, aucun poisson sur un texte à 320 et 390 px) ; DECISIONS §9 et §11, INVENTAIRE.

## Ce qui ne change pas

Les chiffres et cadres du Profil, la photo ronde et son choix, le bouton de période (redessiné à part, élément 375), le fond de page hors de l'eau.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, captures du Profil à 390 et 320 px à 0, 1, 15, 30, 50 et 100 sessions par le réglage d'essai, en clair et en sombre, en P4 et en P5. Par l'orchestrateur : `npm run verif`, relecture, banc sur `profil`, `cacher`, `reglages`, `tailles`.

## Essai au téléphone

Dans Réglages › Pratiquant, faire varier le nombre de sessions du banc de 0 à 100 et revenir au Profil : l'eau monte depuis l'angle et le banc contourne les cadres sans toucher un chiffre ; changer de poisson ; le Profil ne ralentit pas au défilement.
