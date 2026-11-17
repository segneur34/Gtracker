# 428 · Traits de séparation : Réglages et listes des analyses

## Tel que dit par l'utilisateur

Note du 17/11 : « des traits fins en coup de pinceau qui séparent les sections, genre entre windsurf et [l'activité d'après], et des traits noirs sans coup de pinceau, genre entre affichage et onglets d'analyse ». Le 17/11 au soir : « il faut aussi faire les traits entre les sous-sections dans les réglages, entre les vagues dans vague dans les analyses et ce genre d'endroit, juste un trait noir ».

## Dessin retenu

Planche du 17/11 au soir, hors dépôt : `D:\gong tracker\atelier\planche-434-428\index.html`, parties « Traits dans Réglages » et « Traits dans les listes de la voile » (images `images\reglages-liste-apres.jpg`, `reglages-activite-apres.jpg`, `voile-apres.jpg`). L'utilisateur étant absent, le lot code ce que la planche montre ; son avis pourra le reprendre. Maquette en CSS injecté, à lire sans la recopier telle quelle : `outils\variantes\traits-reglages.css`.

## Voulu

1. **Une variable du thème pour le trait simple** dans `src/theme/tokens.css` : un trait d'un pixel à l'encre (`var(--ink)` : noir le jour, blanc la nuit, dans tous les thèmes), nommée et commentée ; tout ce qui suit s'en sert, et le trait entre les vagues posé par le lot 434 dans `src/pages/analysisMobile.css` aussi.
2. **Réglages, entre deux activités de la liste** (`.settings-activity + .settings-activity`, `src/pages/SettingsPage.css`) : un trait fin au pinceau, horizontal, sur la largeur du cadre, à l'encre, à l'épaisseur la plus fine de la charte (`--brush-trait-bouton`), à la place du trait gris clair d'aujourd'hui. Aucun trait horizontal au pinceau n'existe encore : la maquette reprend le masque des cadres (`src/assets/profil/trait-cadre-pinceau.svg`, employé par `src/components/BrushFrame.css`) et n'en garde qu'une arête ; reprendre cette idée ou une plus propre, sans redessiner l'image fournie. Une pièce réutilisable (classe commune rangée avec les cadres au pinceau) vaut mieux qu'une règle propre à Réglages. Regarder aussi le trait entre une activité et le titre de famille qui la suit (règle voisine, ligne 49) : même trait fin au pinceau s'il sépare lui aussi deux lignes de la liste.
3. **Réglages, entre les sous-sections** (`.settings-part` : Affichage, Onglet analyse, Matériel, Enregistrement…, dans une activité comme dans les autres blocs de la page qui emploient cette classe) : le trait simple à l'encre, à la place du gris clair.
4. **Analyses, entre deux lignes d'un tableau** : le trait simple à l'encre à la place du gris clair de `.ui-table__row` (`src/components/ui/ui.css`), sur téléphone comme sur ordinateur. Cela couvre d'un coup les vagues sur ordinateur, les podiums et la liste des manœuvres, les vols, les sauts, et les autres tableaux des analyses (tops, zones, VMG), pour un même trait partout ; vérifier que la classe ne sert pas hors des analyses (sinon dire où, et ne changer que les analyses). Sur téléphone, les lignes passées en grille (`.an-man-podium`, `ui-table--cards`) gardent bien le trait entre deux lignes, et aucun double trait n'apparaît (sous un en-tête, autour d'un tableau, avec le trait du lot 434).

## Ce qui ne change pas

- Aucun texte : le relevé du banc doit être identique avant et après, sur Réglages comme sur les analyses.
- Les traits entre les lignes de réglage à l'intérieur d'une sous-section (`.settings-row`), les cadres au pinceau existants, Statistiques, Profil, Sessions.

## Contraintes

- `docs/DECISIONS.md` §11 (cadres de Réglages) et §12 (charte : ce qui est allumé l'est à l'encre), `docs/MISE_EN_PAGE.md`, par recherche.
- Variables de `src/theme/tokens.css`, aucune valeur en dur, aucun style en ligne neuf.

## Vérification

`node outils/verif.mjs --rapide`. Le banc et les captures à 390 px sont faits par l'orchestrateur.

## Essai au téléphone

Réglages, une activité dépliée → un trait fin au pinceau sépare deux activités, un trait noir simple sépare ses sous-sections ; une analyse de voile, onglet manœuvres → le même trait noir entre deux lignes ; de jour puis en thème de nuit.
