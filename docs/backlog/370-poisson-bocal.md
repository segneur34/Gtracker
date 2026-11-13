# 370 · Profil : le poisson dans son bocal

Modèle | Réflexion : Opus | high. Lot gros, coupé en deux parties, chacune son agent et son commit. Avant d'y toucher : `docs/DECISIONS.md` §9 (Profil) et §11 (Réglages), à accorder dans le même travail.

Matière, hors dépôt : `D:\gong tracker\atelier\maquette-poisson-1311\` : `LISEZMOI.md`, `reflexion-codage.md` (architecture proposée, à suivre sauf ce que cette fiche change), planches `planche-poisson-v2.png` et `planche-poisson-v2-A.png`, `-B`, `-F`, `-G`, scripts `poisson.mjs`, `etats6.mjs`, `rangees2/`.

## Arrêté sur maquette (13/11)

Trois voies à partir du même alevin (beau, agressif, les deux), six niveaux par voie dont le premier commun, quatre styles de dessin (A trait fin, B pinceau, F estampe, G pictogramme). « Tu peux changer le style mais pas le niveau et tu peux voir que les niveaux que tu as débloqués. »

## Demande de l'utilisateur (13/11 au soir)

« Tu vas aller chercher les infos sur les différents poissons […] Le fait qu'il faut changer le poisson quand on clique dessus, on a les options qui s'ouvrent, dans un pop-up, les différents poissons, les différents stades […] qu'on a débloqués. On va décaler le bouton 2026, on va le mettre en gros sous l'icône qu'on choisit. Et […] le poisson, du coup, il va à la place de 2026. Il faut que le bocal soit plutôt petit pour le petit poisson et plutôt gros pour le dernier stade. Et moi, pour que je teste, il me faut dans Pratiquant un réglage "seuil de poisson" que je peux faire varier, pour voir les différentes variétés, donc de seuil 1 à 6. »

## À faire

Partie A : les dessins, le calcul, le bocal sur le Profil.
1. Les 64 dessins (4 styles × l'alevin et 3 voies × 5 niveaux) exportés une fois depuis la maquette en SVG statiques dans `src/assets/poisson/`, chargés à la demande ; couleurs d'encre et de papier reliées aux variables du thème là où la réflexion le prévoit ; identifiants uniques par fichier ; le générateur ne rentre pas dans `src/`.
2. Le calcul pur du niveau (1 à 6), testé : voir « Tranché » plus bas.
3. Dans le profil du pratiquant (qui voyage avec le dossier mémoire) : le style, la voie, et le réglage d'essai du niveau.
4. Sur le Profil : le bocal prend la place du bouton « 2026 », à droite de la ligne « Test de FC repos » ; sa taille grandit avec le niveau, petite pour l'alevin, grosse au niveau 6, sans jamais pousser le nom ni déborder à 320 px.
5. Le bouton de période (« 2026 » / « Tout ») descend sous la photo ronde du Profil (l'icône que l'on choisit), en plus gros ; il garde ce qu'il fait.
6. Dans Réglages › Pratiquant : un réglage « Niveau du poisson (essai) », de 1 à 6 plus « automatique », qui impose le niveau montré et débloque les niveaux jusqu'à lui ; libellé qui dit que c'est provisoire.

Partie B : la fenêtre de choix.
7. Toucher le bocal ouvre une fenêtre (`ui/Dialog`) : les poissons que l'on peut choisir (les quatre styles et les trois voies, montrés au niveau actuel), et la frise des niveaux débloqués du poisson choisi, à regarder seulement ; les niveaux à venir sont comptés, pas dessinés. Le choix s'applique tout de suite et se garde.
8. Clair, sombre, Économe ; lecteur d'écran (bouton nommé, « Poisson, niveau 3 sur 6 ») ; téléphone droit, tourné, ordinateur.
9. Script du banc `profil` accordé, un contrôle neuf pour la fenêtre ; DECISIONS §9 et §11, INVENTAIRE accordés.

## Tranché par l'orchestrateur (provisoire, à redire à l'utilisateur)

- Ce qui fait monter : les semaines tenues sur l'objectif par semaine, par le compte de `rootGrowth`, paliers à 2, 5, 9, 14 et 20 semaines (recommandation de la réflexion).
- Sans pratique : les niveaux débloqués restent acquis, aucun recul.
- La voie : choisie par l'utilisateur dans la fenêtre, comme le style (« les différents poissons »).
- La racine reste cachée ; le poisson ne la remplace pas dans le code, il s'ajoute.
- Le style F, lourd (1,7 Mo) : allégé à l'export si c'est simple, sinon gardé tel quel, chargé à la demande.
- Le filtre de pinceau du style B : s'il est lent à peindre, un dessin figé sans filtre.

## Ce qui ne change pas

Les chiffres du Profil, les cadres au pinceau, le fond de page, la photo ronde et son choix.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, captures du Profil à 390 et 320 px aux niveaux 1, 3 et 6. Par l'orchestrateur : `npm run verif`, relecture, banc sur `profil`, `cacher`, `reglages`, `tailles` (Profil).

## Essai au téléphone

Dans Réglages › Pratiquant, faire varier le niveau du poisson de 1 à 6 : le bocal du Profil grandit ; toucher le bocal, changer de poisson, voir les niveaux débloqués ; le style pinceau ne ralentit pas la page.

## Plan (agent Plan, 13/11 au soir, relu par l'orchestrateur)

Partie A, dans l'ordre :
1. Calcul : `src/library/rootGrowth.ts` gagne un champ `heldTotal` (total des semaines tenues, ajout seul, ses tests ne changent pas). À créer : `src/library/fishGrowth.ts` et son test : `FISH_LEVELS = 6`, `FISH_RULES = { thresholds: [2, 5, 9, 14, 20] }`, `fishGrowth(sessions, goalMin, nowMs, rules)` rend `{ level, heldWeeks, nextAtWeeks }`, `fishLevelOf(heldWeeks, rules)`, `fishShown(g, trialLevel)` rend `{ level, unlocked }` (avec un essai posé, les deux valent l'essai), types `FishStyle = 'A' | 'B' | 'F' | 'G'`, `FishPath = 'beau' | 'agressif' | 'lesDeux'`, listes `FISH_STYLES` et `FISH_PATHS` (identifiant et nom). Tests : aucune session donne 1 ; chaque palier à sa semaine ; plafond à 6 ; des semaines manquées ne font pas reculer ; une session future ignorée ; une semaine sous l'objectif ne compte pas ; l'essai impose niveau et débloqué.
2. Profil du pratiquant : `src/library/athleteProfile.ts`, trois champs relus un par un dans `sanitizeAthleteProfile` : `fishStyle` (défaut A), `fishPath` (défaut beau), `fishTrialLevel` (entier de 1 à 6, `null` = automatique) ; une valeur inconnue est relue à `null` (testé) ; accorder `PROFILE_BOUNDS` (`library/profilePrompt.ts`), le setter dans `hooks/useAthleteProfile.ts`, et les tests qui comparent le profil vide ou le fichier de réglages champ par champ.
3. Export : un script `exporter-svg.mjs` rangé dans l'atelier (pas dans le dépôt), qui écrit `src/assets/poisson/<A|B|F|G>/depart-1.svg` et `<beau|agressif|lesDeux>-<2..6>.svg`. Retouches : l'encre (`#000` en A et G, `#161616` en B) devient `currentColor` ; le papier `#f7f5f0` devient une classe `pz-p` (`fill: var(--bg)`, `pz-ps` pour un trait) ; un élément rempli de `#aaff00` garde son pourtour noir ; en B le verre `#72b0bd` prend une classe `pz-b` qui lit `--brush` ; F n'est pas retouché ; tous les identifiants préfixés `pz-<style>-<voie>-<n>-` ; le filtre `#rugueux` recopié et renommé dans chaque fichier B. F allégé à l'export : une décimale, zéros de tête ôtés ; au-delà, gardé tel quel.
4. Chargeur : `src/components/fishDrawings.ts` et son test : `import.meta.glob('../assets/poisson/*/*.svg', { query: '?raw', import: 'default' })` sans `eager` (un morceau par dessin, rien dans le paquet principal) ; `fishDrawingKey(style, voie, niveau)` (le niveau 1 donne `depart-1` quelle que soit la voie) ; `withInstanceIds(svg, suffixe)`, pure, pour que deux copies du même dessin ne se volent pas leurs découpes ; une constante pour ôter le filtre du style B à l'injection (ôté aussi en mode Économe). Test des dessins par `node:fs` : 64 fichiers, `viewBox` de 240, identifiants préfixés et uniques, chaque `url(#)` résolu dans son fichier, ni encre ni papier en dur en A, B et G (sauf le pourtour du vert).
5. Hook `src/hooks/useProfileFish.ts`, sur le modèle de `hooks/useProfileRoot.ts` (toutes les sessions visibles, `athleteRootGoalMin(profile)`), puis le réglage d'essai.
6. Bocal : `src/components/ProfileFish.tsx` et `.css`, un bouton nommé (« Poisson, niveau 3 sur 6 »), dessin injecté par `dangerouslySetInnerHTML` (fichiers statiques de l'application), boîte de taille fixe pendant le chargement, `color: var(--ink)`.
7. Page Profil (`src/pages/ProfilePage.tsx` et `.css`) : la photo passe dans une colonne `.profile-head__side` avec, dessous, le bouton de période (il garde sa classe `profile-periods`, son nom et son action) ; le bocal devient la troisième colonne de `.profile-head`, calée en bas, à droite de « Test de FC repos » ; `.profile-head__row` ne garde que le lien ; la racine reste cachée, `ROOT_CARDS` inchangé.
8. Taille du bocal (côté du carré) : `f × M`, `M = min(84px, 100cqi − 222px)` lu sur `.profile-head` (`container-type: inline-size`), `f` = 0,48 / 0,57 / 0,67 / 0,76 / 0,88 / 1 du niveau 1 au niveau 6 ; soit 40 à 84 px à 390 px de large, 28 à 58 px à 320 px. Aucune requête d'écran neuve (`src/hooks/mediaQueries.test.ts`).
9. Réglages › Pratiquant (`src/pages/SettingsPage.tsx`), après les seuils cardio : une liste « Niveau du poisson (essai, provisoire) », « Automatique » puis 1 à 6.
10. Banc `outils/banc/profil.mjs` : le contrôle du bouton de période devient « sous la photo ronde » ; contrôles neufs : nom du bocal, taille qui croît du niveau 1 au niveau 6 sans déborder à 320 px ; `racine-periodes.mjs` lit `.profile-periods`, à repasser.

Partie B :
11. `src/components/FishPicker.tsx` et `.css`, chargé par `lazy` à l'ouverture, dans `ui/Dialog` (titre « Poisson ») : une grille des 4 styles par les 3 voies au niveau actuel, en boutons `aria-pressed` (« Pinceau, agressif »), choix appliqué tout de suite ; dessous, la frise des niveaux 1 à n du poisson choisi, sans action, puis « k niveaux à découvrir » ; au niveau 1, une ligne dit que les trois voies partent du même alevin.
12. Banc : 12 choix, frise égale au niveau, « à découvrir », choix gardé au rechargement, Échap ferme. Documents : DECISIONS §9 et §11, INVENTAIRE.

Tranché par l'orchestrateur sur les questions mineures du plan : défauts A et beau ; une semaine compte dès qu'elle est tenue, sans attendre sa fin ; le bouton de période sous la photo en grande taille (« en gros », dit l'utilisateur) ; pas de voile derrière le bocal ; le mode Économe ôte le filtre du style B ; le réglage d'essai voyage avec le profil, c'est provisoire. Règle 14 : aucun numéro de lot dans les commentaires de `src/`.
