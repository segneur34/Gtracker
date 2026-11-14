# 379 · L'ancien fond dessiné des pages part

Sonnet | medium. Changement neutre : rien ne doit bouger à l'écran.

## Constat (vérifié le 14/11 dans le code)

`components/PageBackdrop.tsx` pose encore, sous Statistiques, Réglages et les deux pages de tutoriels, un motif en tuile par famille (`core/backdropPattern.ts`). Depuis que les fonds de page sont unis puis couverts par le champ de traînées, ses trois encres valent `transparent` dans `theme/tokens.css` (`--contour`, `--backdrop-voile`, `--backdrop-surf`, pour tous les thèmes : à revérifier, mode sombre compris) : le motif est calculé et dessiné, mais ne se voit pas.

## Ce qui est demandé

Retirer ce fond et tout ce qui ne sert qu'à lui :
- `components/PageBackdrop.tsx`, `core/backdropPattern.ts` et son test, `hooks/useFavoriteBackdrop.ts` ;
- leurs emplois dans `pages/StatisticsPage.tsx`, `pages/SettingsPage.tsx`, `pages/TutorialsPage.tsx`, `pages/TutorialPage.tsx` ;
- les règles `.page-backdrop*` de `components/ui/ui.css`, les variables `--contour`, `--backdrop-voile`, `--backdrop-surf` de `theme/tokens.css` et leurs lignes dans `theme/tokens.test.ts`, la règle du mode économe qui cache ce fond ;
- la classe `ui-page--backdrop` : elle met le contenu de la page en `position: relative`. La retirer seulement si rien d'autre n'en dépend (chercher les sélecteurs qui la citent, et ce qui se place en absolu dans ces pages) ; dans le doute, la garder sous son nom et corriger son commentaire, et le dire dans le rapport ;
- `favoriteFamily` (`library/profile.ts`) reste si autre chose s'en sert (la photo par défaut du Profil, le cadre peint), part avec son test sinon ; les commentaires qui citent `useFavoriteBackdrop` ou « fond de page dessiné » sont corrigés (`hooks/useFavoriteBrush.ts`, `library/profile.ts`).

Puis accorder ce qui cite ces fichiers : `docs/INVENTAIRE.md` et `docs/ETAT_DU_PROJET.md` (lignes des fichiers retirés seulement ; un autre agent peut éditer `docs/INVENTAIRE.md` en même temps : relis-le juste avant de l'éditer et ne change que tes lignes), `outils/styles-en-ligne.json` s'il compte des styles d'un fichier retiré (le régénérer par son script, voir `outils/LISEZMOI.md`), `outils/banc/profil.mjs` et `outils/banc/statistiques.mjs` s'ils attendent l'élément `.page-backdrop` (retirer cette attente, rien d'autre).

## Ce qui n'est pas demandé

- Rien d'autre dans `pages/StatisticsPage.tsx` : un lot à venir (381) refait sa sélection.
- Le champ de traînées (le fond d'aujourd'hui) ne bouge pas.
- Pas de commit, pas de version, pas de `docs/BACKLOG.md`, pas de `docs/HISTORIQUE.md`.

## Vérification

`node outils/verif.mjs --rapide`. L'orchestrateur passera le banc avant et après sur `statistiques` et `profil` (texte de la page identique) : ne lance pas le banc toi-même.
