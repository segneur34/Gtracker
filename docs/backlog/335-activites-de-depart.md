# 335 · Activités de départ séparées

**Modèle | Réflexion** : Sonnet | medium. À lancer après le lot 314 (mêmes fichiers).

Demande de l'utilisateur, 11/11. Remplace « Voile » (une seule activité de départ, calcul wingfoil, identifiant `wingfoil`) par une liste complète, pré-créée à l'installation. Absorbe le 315 (« Bateau »).

Résultat attendu : toutes les activités sur la feuille de départ, « Bateau » compris, dès l'installation ; quatre visibles, sept cachées, affichables par l'œil de Réglages.

## Liste (décidée)

« Les pré-réglages que j'ai faits dans l'autre application » : Tracker complet n'a de pré-réglage que par calcul (`BASE_PRESETS` : wingfoil et windsurf = WING, kite = sauts à 1 m, surf = virages) ; ils sont déjà identiques ici. Chaque activité les reprend par son calcul.

Ordre de la liste, dans chaque famille, celui du tableau.

| Activité | Famille | Calcul | Foil coché d'office | Pumping coché d'office | Cachée au départ |
|---|---|---|---|---|---|
| Wingfoil | voile | wingfoil | oui (profil) | non | non |
| Parawing | voile | wingfoil | oui (profil) | non | oui |
| Windsurf | voile | windsurf | non | non | oui |
| Windfoil | voile | windsurf | oui | non | oui |
| Kite | voile | kite | non | non | non |
| Kitefoil | voile | kite | oui | non | oui |
| Bateau | voile | bateau | non | non | oui |
| Surf | surf | surf | non | non | non |
| Paddle | surf | surf | non | non | oui |
| Surf foil | surf | surf | oui | non | oui |
| Pumping | surf | surf | oui | oui | non |

Visibilité : réponse de l'utilisateur du 11/11 (visibles Wingfoil, Kite, Surf et Pumping ; cachées Parawing, Windsurf, Windfoil, Kitefoil, Paddle, Surf foil et Bateau).

## Tranché par l'orchestrateur (11/11)

- **Identifiants** : « Wingfoil » reprend `wingfoil` (plus d'installation à garder avant la livraison, lot 306 : aucune migration), « Surf » garde `surf`, « Surf foil » garde `a-surf-foil`. Les nouvelles : l'identifiant du calcul pour l'activité principale d'un calcul (`windsurf`, `kite`, `bateau`), le préfixe `a-` pour les autres (`a-parawing`, `a-windfoil`, `a-kitefoil`, `a-paddle`, `a-pumping`), sauf si le code montre qu'un identifiant égal à un calcul pose un problème (le dire alors dans le rapport et tout préfixer).
- **Nuances, provisoires** : l'utilisateur veut repenser les couleurs d'activité (plusieurs couleurs franches, pas seulement des nuances de bleu : élément 338, maquette d'abord). En attendant, on reste sur les six nuances de chaque famille (`FAMILY_SHADES`, `palette.test.ts` inchangé) : chaque activité de voile a sa nuance, sauf Windfoil qui prend celle de Windsurf et Kitefoil celle de Kite ; Bateau garde `BASE_COLOR.bateau` ; les quatre activités de surf ont chacune la leur. Ne pas ajouter de septième nuance.
- **Icônes** : celles que `guessActivityIcon` devine déjà (Wingfoil et Parawing : wingfoil ; Windsurf et Windfoil : planche ; Kite et Kitefoil : kite ; Bateau : bateau ; Surf : surf ; Paddle : paddle ; Surf foil : surf-foil) ; « Pumping » prend l'icône du surf foil (une planche à foil), pas celle du surf. Pas d'icône neuve dans ce lot.

## Ce que le code dit (relevé le 11/11)

- `src/core/activities.ts` : `Activity` (`:21`, champs id, name, base, color, `hidden?`, `icon?`), `FAMILY_SHADES` (`:46`), `BASE_COLOR` (`:76`), `SURF_ACTIVITY` et `SURF_FOIL_ACTIVITY` (`:85`), `DEFAULT_ACTIVITIES` (`:92`, trois entrées) ; `readActivities(undefined)` (`:120`) copie `DEFAULT_ACTIVITIES` : un `hidden: true` posé là vaut à l'installation ; `isActivityShown` (`:170`), `withHidden` (`:174`). Plus d'`ACTIVITIES_VERSION`.
- Foil : `defaultFoil` (`src/settings/activitySettings.ts:299`) teste `activity.id === SURF_FOIL_ACTIVITY.id` ; `resolveFoil` (`:302`) ; `foilDefault: true` du profil wingfoil (`src/core/sportProfiles.ts:589`) ; la case de Réglages compare à `defaultFoil` (`src/pages/SettingsPage.tsx:491`). Le commentaire `activities.ts:84` renvoie à `useSportSettings.ts` : périmé, à corriger.
- Pumping : `resolvePumping` (`activitySettings.ts:310`) rend le réglage, sinon `false` : aucun défaut par activité aujourd'hui.
- Pré-réglages : `ActivityPreset` (`src/settings/activityPresets.ts:14`), `BASE_PRESETS` (`:48`), `ACTIVITY_PRESETS` (`:56`, clé = identifiant, `'a-surf-foil': { turns: true }` remplace en entier celui du calcul), `presetOf` (`:65`).
- Icônes : `BASE_ICON` (`src/core/activityIcons.ts:35`), `ID_ICON` (`:44`), `NAME_ICON` (`:47`), `guessActivityIcon` (`:59`).
- Aucun identifiant ni nom de l'activité « Voile » n'est en dur hors de `activities.ts:93`.

## À faire

1. `DEFAULT_ACTIVITIES` : les onze activités du tableau, dans l'ordre, avec `hidden: true` pour les sept cachées ; commentaires réécrits.
2. Foil d'office par activité : remplacer le test sur le seul identifiant de Surf foil par une donnée (un champ du pré-réglage de l'activité, ou une table d'identifiants à côté de `ACTIVITY_PRESETS`) qui couvre Windfoil, Kitefoil, Surf foil et Pumping ; Wingfoil et Parawing l'ont par le profil.
3. Pumping d'office pour « Pumping » : un défaut par activité lu par `resolvePumping` (et son `default*Of`, pour que la case de Réglages dise « par défaut » comme pour le foil). Vérifier d'abord que le calcul surf porte bien la capacité de pumping ; sinon s'arrêter et le dire (question).
4. Pré-réglages : chaque activité prend celui de son calcul ; garder `'a-surf-foil': { turns: true }` ; « Pumping » : comme Surf foil s'il lui faut une entrée propre (le dire dans le rapport).
5. Icône de « Pumping » (surf-foil) par `ID_ICON` ou `NAME_ICON`.
6. Tests refaits : `src/core/activities.test.ts` (`:17`, `:136`), `src/core/activityIcons.test.ts:17`, `src/settings/activitySettings.test.ts:146`, `src/settings/activityPresets.test.ts:18`, `:48` ; un test qui fige la liste de départ (noms, calculs, cachées, foil et pumping d'office).
7. Le rapport liste les scripts du banc dont le relevé change (attendu : `prereglages`, `icones`, `balises`, `activite`, `cardio`, `cacher`, `onglets`, `familles`, `reglages`).

`CLAUDE.md` (« Activités : … au départ « Voile » en voile ») et `docs/DECISIONS.md` §11 sont mis à jour par l'orchestrateur au commit, pas par l'agent.

## Pièges

- Le foil d'une activité est un réglage par activité (`resolveFoil`), pas un calcul : pas de nouveau `SportType`.
- Une activité cachée garde son adresse et ses sessions (décision « Activités » de `CLAUDE.md`).
- Le lot 314 vient de modifier `src/core/activityIcons.ts` (devinette du calcul d'après le nom) et `src/pages/SettingsPage.tsx` : partir de son code, ne pas le défaire.
- Hors lot : l'accueil par activités (332), les images (337), les couleurs libres (338).

## Vérification

- `node outils/verif.mjs --rapide` ; `src/library/summaryFrozen.test.ts` sans refigeage.
- Banc : `general` (accueil et bibliothèques), `reglages`, `cacher`.
- Essai au téléphone, joint à celui du 314 : dans Réglages, les onze activités sont là, quatre visibles ; une session de « Wingfoil » passée en « Bateau » n'a plus ni foil ni « Temps en vol ».
