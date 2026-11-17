# 430 · Profil et analyses de session : des cadres plus rapprochés

## Tel que dit par l'utilisateur (note du 17/11)

Les espaces entre les cadres sont trop grands sur le Profil et dans les analyses de session : « effet vide ».

## Voulu

Des cadres plus rapprochés et une page moins vide, sur téléphone et sur ordinateur : l'espace entre deux cadres voisins (et entre la carte, les onglets et le premier cadre d'une analyse) diminue, sans que les cadres se touchent ni que le trait de pinceau de l'un morde sur l'autre.

`docs/MISE_EN_PAGE.md` dit que rien ne se déplace sans redemander : la demande du 17/11 vaut accord pour les espaces ; l'ordre et la place des cadres ne changent pas.

## Planche d'abord

Valeurs retenues : voir « Variante retenue » plus bas, écrite par l'orchestrateur après la planche (`D:\gong tracker\atelier\planche-429-430\`). L'utilisateur peut en changer après coup : l'espace entre cadres doit tenir dans une variable (ou deux : téléphone, ordinateur), pas dans des valeurs éparses.

## Variante retenue (planche du 17/11, ouverte chez l'utilisateur, qui peut en changer)

Relevé de la planche (mêmes valeurs sur téléphone et sur ordinateur, sauf mention) :
- Profil, entre les cadres : `.ui-page.profile { gap: var(--brush-gap) }` (`ProfilePage.css`, vers l. 162), `--brush-gap: 30px` (`tokens.css`, vers l. 84), lue par le Profil seul. Bas de page : `.profile-body { gap: var(--space-5) }` (20 px) ; sur ordinateur dès 1000 px, `.profile-body--columns` à `calc(var(--space-6) + var(--space-2))` (32 px entre colonnes).
- Analyses : `.an-carte-col { gap: var(--space-3) }` (12 px, onglets puis panneaux), `.an-carte-panels { gap: 20px }` (en dur, entre panneaux), `.an-sheet { margin-bottom: var(--space-2) }`, et un style en ligne de `AnalysisShell` (`margin-top: 10px` de la rangée de la carte). Les panneaux ont `flex: 1 1 calc(50% - 10px)` (`HALF_PANEL_STYLE`, `src/components/styles.ts`), qui suppose un espace de 20 px : à accorder à la nouvelle valeur.
- `.an-carte-panels` est aussi lue par la page Statistiques.

Variante « Serré », retenue (environ deux tiers de l'espace actuel) : Profil `--brush-gap` 20 px, `.profile-body` 14 px, `.profile-body--columns` 20 px ; analyses `.an-carte-col` 8 px, `.an-carte-panels` 14 px. Écartée : « Très serré » (moitié : 15, 10, 16, 6, 10 px), où les traits de pinceau arrivent presque l'un sur l'autre sur téléphone.

Mise en œuvre : les espaces tiennent dans des variables de `tokens.css` (celle du Profil existe, `--brush-gap` ; une pour l'espace entre panneaux d'analyse, qui remplace le `20px` en dur), reprises partout où la valeur était écrite, demi-largeur des panneaux comprise. **Statistiques ne change pas** (la demande ne la cite pas) : elle garde ses 20 px, par sa propre règle ou une variable à elle, et le rapport le dit pour que l'utilisateur puisse la faire suivre.

## Contraintes

- `docs/MISE_EN_PAGE.md` en entier pour les analyses, `docs/DECISIONS.md` §9 pour le Profil, §12 pour la charte (traits de pinceau en trois niveaux).
- Variables de `src/theme/tokens.css` ; aucune valeur en dur, aucun style en ligne neuf.
- Ne pas resserrer l'intérieur des cadres (leurs marges internes restent), ni les autres pages (Sessions, Réglages, Statistiques, Enregistrer), sauf si elles lisent la même variable : dans ce cas le dire et proposer, sans élargir.

## Banc

Texte des pages identique avant et après ; scripts du Profil et des analyses voile et surf.

## Essai au téléphone

Un essai de rendu : Profil et une analyse, téléphone droit → les cadres sont plus proches, rien ne se chevauche, la page ne paraît plus vide.
