# 430 · Profil et analyses de session : des cadres plus rapprochés

## Tel que dit par l'utilisateur (note du 17/11)

Les espaces entre les cadres sont trop grands sur le Profil et dans les analyses de session : « effet vide ».

## Voulu

Des cadres plus rapprochés et une page moins vide, sur téléphone et sur ordinateur : l'espace entre deux cadres voisins (et entre la carte, les onglets et le premier cadre d'une analyse) diminue, sans que les cadres se touchent ni que le trait de pinceau de l'un morde sur l'autre.

`docs/MISE_EN_PAGE.md` dit que rien ne se déplace sans redemander : la demande du 17/11 vaut accord pour les espaces ; l'ordre et la place des cadres ne changent pas.

## Planche d'abord

Valeurs retenues : voir « Variante retenue » plus bas, écrite par l'orchestrateur après la planche (`D:\gong tracker\atelier\planche-429-430\`). L'utilisateur peut en changer après coup : l'espace entre cadres doit tenir dans une variable (ou deux : téléphone, ordinateur), pas dans des valeurs éparses.

## Contraintes

- `docs/MISE_EN_PAGE.md` en entier pour les analyses, `docs/DECISIONS.md` §9 pour le Profil, §12 pour la charte (traits de pinceau en trois niveaux).
- Variables de `src/theme/tokens.css` ; aucune valeur en dur, aucun style en ligne neuf.
- Ne pas resserrer l'intérieur des cadres (leurs marges internes restent), ni les autres pages (Sessions, Réglages, Statistiques, Enregistrer), sauf si elles lisent la même variable : dans ce cas le dire et proposer, sans élargir.

## Banc

Texte des pages identique avant et après ; scripts du Profil et des analyses voile et surf.

## Essai au téléphone

Un essai de rendu : Profil et une analyse, téléphone droit → les cadres sont plus proches, rien ne se chevauche, la page ne paraît plus vide.
