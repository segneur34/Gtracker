# 349 · Logos d'activité et cadre au pinceau

Modèle | Réflexion : Opus | high

## Tel que noté

Les onze dessins validés le 12/11 (« ok pour les images », « surf foil ok ») et le cadre « coup de pinceau rond » (« très clairement, coup de pinceau rond »). Troisième lot du paquet de la nouvelle apparence, après le 344 (habillage) et le 338 (couleurs).

## Sources (hors dépôt, à lire, ne rien y écrire)

`D:\gong tracker\atelier\maquette-da-1211\icones-v3\` : un SVG par activité (`wingfoil`, `parawing`, `windsurf`, `windfoil`, `kite`, `kitefoil`, `bateau`, `surf`, `paddle`, `surffoil`, `pumping`), `pictos.json` (les mêmes tracés, un par clé, repère de 1000 sur 1000, remplissage pair-impair), `cadre-pinceau.svg`. L'emploi se lit dans `D:\gong tracker\atelier\maquette-da-1211\construire-finale.mjs` (fonctions `picto` et `logo`, lignes 56 à 63, et les tailles de la section 3).

## Décisions déjà prises

- Les onze dessins remplacent les neuf icônes d'activité d'aujourd'hui, partout où une activité montre son icône, choix d'icône de Réglages compris.
- Les dessins sont ceux fournis par l'utilisateur, sans retouche : ni affinage, ni redécoupage, ni redessin. « Alléger » veut dire seulement réduire le poids du tracé sans que rien ne se voie (arrondir les coordonnées, commandes relatives, retirer un point à moins d'une demi-unité du repère de 1000). Environ 350 Ko aujourd'hui, cadre compris ; viser le plus léger possible à dessin identique, et donner le poids obtenu dans le rapport. Les fichiers allégés entrent dans `src/` ; le script qui les produit reste dans le dossier de la maquette (`icones-v3\outils\`), pas dans le dépôt.
- Une pièce commune (`components/`) montre le logo d'une activité : son dessin dans le coup de pinceau rond, à la couleur de l'activité, le dessin posé dedans à 60 %, le cadre tourné d'une activité à l'autre. La rotation se déduit de l'identifiant de l'activité (tranché par l'orchestrateur : elle ne doit pas changer quand la liste change d'ordre), pas de son rang.
- À partir de 40 points de côté, le logo dans son cadre ; en dessous, le dessin seul, à l'encre, ou la pastille de couleur (là où il y avait une pastille).
- Mode nuit : le dessin passe au blanc ; le cadre garde la couleur de l'activité, celui du Surf devient blanc (c'est la couleur de nuit du Surf, posée au 338).
- Une activité créée prend le dessin deviné de son nom et de son calcul, comme aujourd'hui (`activityIcon`), parmi les onze.
- Activités déjà enregistrées (même choix qu'au 338) : une icône choisie parmi les neuf anciennes devient le logo qui lui correspond, par une fonction pure et testée, sans remise à zéro.
- Les icônes d'interface (`components/icons.tsx` : navigation, outils, actions) ne changent pas.

## Aujourd'hui (à vérifier dans le code)

`src/core/activityIcons.ts` (`BASE_ICON`, `ActivityIconId`, `activityIcon`), son test, `src/components/` (le composant d'icône d'activité et le choix d'icône), `src/pages/SettingsPage.tsx`, et les écrans qui montrent une icône d'activité : accueil, bibliothèques, Enregistrer, analyses, Statistiques, Profil, image de partage, listes dessinées par l'application.

## Voulu

1. Les onze dessins et le cadre, allégés, dans `src/`, chargés sans alourdir l'ouverture de l'application (dire dans le rapport le choix fait : module, feuille de symboles SVG, chargement différé).
2. La pièce commune du logo, et la bascule en dessous de 40 points.
3. Le remplacement des neuf icônes, avec la table des calculs (`BASE_ICON`), la devinette par le nom, le choix de Réglages (onze dessins) et la reprise des icônes enregistrées.
4. `src/core/sportProfiles.test.ts` et les tests d'icônes à jour ; un test dit que chaque activité de départ a son dessin propre.
5. Le logo dans son cadre là où la place le permet déjà aujourd'hui (40 points ou plus) ; ailleurs le dessin seul. Ne pas agrandir une zone pour y loger un cadre : la rangée de logos de la page Sessions arrive au 346.

## Ne pas faire

- Ne pas retoucher un dessin, ne pas en redessiner un, même s'il te paraît imparfait.
- Ni page Sessions (346), ni avatar (350) ; ne pas toucher à `docs/` hors de ce brief, ni à `package.json`, ni commit ni version.
- Budget : vers 140 tours, finis l'étape en cours et rends ton rapport, même partiel.

## Banc (lancé par l'orchestrateur)

`icones`, `reglages`, `cacher`, `general`, `surf`, `library`, `statistiques`, `profil` : texte identique, sauf le nombre et le nom des icônes proposées dans Réglages (à dire dans le rapport) ; captures de `icones` à regarder.

## Questions tranchées par l'orchestrateur (12/11), d'après le plan

- En dessous de 40 points, le dessin est à l'encre, comme sur la planche validée (dessin de 24 points, « Sport préféré »). Pour que la couleur de l'activité reste visible là où la petite icône la portait, une pastille cernée (celle du 338) accompagne le dessin dans les lignes d'activité de Réglages, dans la liste de choix d'une activité (`ActivitySelect`) et dans les lignes de la bibliothèque ; pas dans les onglets ni dans la liste des itinéraires.
- Aucun écran n'atteint 40 points aujourd'hui hors l'avatar : c'est attendu, le cadre se verra surtout sur la page Sessions (346). On n'agrandit rien. « Sport préféré » du Profil : dessin seul, comme sur la planche. Choix d'icône de Réglages : dessin seul dans sa case.
- Avatar du Profil (`ProfileAvatar`) : dès ce lot, le logo du sport préféré dans son cadre, sur un disque au fond de la page (plus de disque à la couleur de l'activité), et sa grille de choix sur les onze dessins ; l'avatar vide de départ et la photo restent au 350.
- Identifiant `surf-foil` gardé avec son trait d'union (la maquette écrit « surffoil ») : les choix enregistrés ne se convertissent pas.
- La rotation du cadre vient d'un hachage de l'identifiant ; inutile de retrouver les angles de la maquette.
- Le logo encadré porte un nom accessible quand le nom de l'activité n'est pas écrit à côté.
- `src/components/activityArt.tsx` et `outils/icones/vectoriser.cjs` s'en vont s'ils n'ont plus d'emploi ; dis dans le rapport chaque fichier supprimé, l'orchestrateur corrigera les documents qui les citent.

## Plan (agent Plan, 12/11), à suivre sauf constat contraire dans le code

- Aujourd'hui : neuf identifiants (`ACTIVITY_ICON_IDS`, `src/core/activityIcons.ts`) pour deux jeux de dessins : les petites icônes au trait (`ACTIVITY_ICON`, `src/components/familyIcons.ts`, vers neuf `Icon*` de `src/components/icons.tsx`) et les grands dessins (`ActivityArt`, `src/components/activityArt.tsx`). Le choix enregistré se relit par `readActivities` (`src/core/activities.ts`), sinon `activityIcon` le devine.
- Où une icône d'activité se montre : `ActivityIcon.tsx` (16 px par défaut) dans `SessionLibrary.tsx` 404, `ActivityFilterTabs.tsx` 30, `ActivitySelect.tsx` 85 et 135, `SettingsPage.tsx` 407 et 1031, `RouteList.tsx` 54 ; `IconPicker.tsx` 33 et 47 (20 px dans une case de 32) ; `ProfilePage.tsx` 237 (35 px) ; `ProfileAvatar.tsx` 33 (disque de 88 px) et sa grille 92-94. Rien sur l'accueil, les Statistiques ni l'image de partage.
- Embarquer : un fichier produit `src/components/logos/logoPaths.ts` (`LOGO_PATHS`, `FRAME_PATH`), importé seulement par `LogoSprite.tsx`, lui-même chargé par `lazy()` et monté une seule fois dans `AppShell` sous `Suspense fallback={null}` ; il pose un `<svg>` caché avec un `<symbol>` par dessin et un pour le cadre. Chaque logo n'est qu'un `<svg viewBox="0 0 1000 1000"><use href="#gt-logo-…"/></svg>`. Pas de feuille externe.
- Allègement (mesuré : 348 Ko de sources) : coordonnées entières et commandes relatives, arrondies sur la position absolue pour ne pas dériver ; pour le cadre seul (dessin de Claude, une ligne brisée de 5 194 segments), simplification à 0,5 unité, anneau par anneau, chaque anneau coupé en deux au point le plus éloigné. Aucun point retiré dans les courbes des dessins. Visé : environ 113 Ko brut, 35 Ko compressé. Vérification : `Path2D` avant et après sur un canevas de 1 000 × 1 000 dans le Chrome du banc, compte des pixels qui diffèrent (un liseré d'un pixel au plus), et captures avant et après des onze dessins à 132 px. Script dans `icones-v3\outils\`.
- Pièce commune : `src/components/logos/ActivityLogo.tsx` (+ `.css`) : `ActivityLogo({ activity, size, … })`, cadre à partir de `LOGO_FRAME_MIN_PX` (40), sinon `LogoGlyph({ logo, size })`, le dessin seul en `currentColor`. Cadre : `<use href="#gt-logo-frame" transform="rotate(r 500 500)">` à la couleur affichée de l'activité (celle du thème) ; dessin : `<use x=200 y=200 width=600 height=600>` en `var(--ink)`. `logoRotation(id)` pure, dans `core/activityIcons.ts`. `fill-rule="evenodd"` sur les dessins, pas sur le cadre ; la rotation se pose sur le `<use>`, jamais sur le `<svg>`.
- Reprise : `legacyIconToLogo`, pure : bateau, wingfoil, kite, surf, paddle, surf-foil inchangés ; planche → windsurf ; kayak → paddle ; paddle-foil → surf-foil. Branchée dans `readActivities` et dans la lecture de l'avatar (`src/library/athleteProfile.ts`, vers la ligne 96).
- Devinette : `BASE_ICON.windsurf` → windsurf ; les activités de départ a-parawing, a-windfoil, a-kitefoil, a-paddle, a-surf-foil, a-pumping vers leur propre dessin ; règles de nom dans l'ordre : parawing, kitefoil, windfoil, pump, paddle ou sup avec foil (surf-foil), avant leurs mots plus larges ; kayak → paddle.
- Tests : `activityIcons.test.ts` (onze dessins, les onze activités de départ ont onze dessins différents, devinettes, table de reprise, rotation stable et indépendante du rang) ; `activities.test.ts` et `athleteProfile.test.ts` (reprise) ; un test dit que chaque identifiant a son tracé ; `src/architecture.test.ts` : `logoPaths.ts` importé par le seul `LogoSprite`, lui-même par `lazy()` seulement, et `SPORT_TABLES` mis à jour.
- Banc : `outils/banc/icones.mjs` vérifie 9 choix, « Planche à voile » rangée `planche`, « Kayak » deviné, et la couleur de l'icône de la liste de choix : passer à 11, « Windsurf » rangée `windsurf`, « Paddle », et la pastille à la place de la couleur de l'icône ; `outils/banc/SCRIPTS.md` suit.
- Étapes : 1. script d'allègement et comparaison, `logoPaths.ts`, poids relevé ; 2. cœur (identifiants, libellés, devinette, reprise, rotation) et tests ; 3. `LogoSprite` et `ActivityLogo`/`LogoGlyph`, test d'architecture ; 4. remplacement des appels (`ActivityIcon` supprimé, `IconPicker`, `ProfilePage`, `ProfileAvatar`) ; 5. nettoyage (`ACTIVITY_ICON`, `activityArt.tsx`, les `Icon*` d'activité sauf `IconWingfoil` que `LessonIcon.tsx` emploie) ; 6. banc `icones`.
- Pièges : un seul `LogoSprite` dans la page (identifiants en double sinon) ; le commentaire d'en-tête du fichier produit ne cite aucun numéro de lot (règle 14).

## Rapport attendu

Le rapport habituel, avec : le poids avant et après, où les dessins sont rangés et comment ils se chargent, la table ancienne icône → nouveau logo, et la liste des écrans où le logo s'affiche dans son cadre.
