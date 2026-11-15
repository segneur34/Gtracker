# 385 · Profil : les étiquettes de semaines du graphe se touchent en anglais

Modèle | Réflexion : Sonnet | medium

## Constat (essai 260 du lot 382, le 15/11, sur l'APK 0.00.76, téléphone droit)

L'utilisateur, application en anglais : « dans profil, le graph de toutes les sessions avec w1, w2 etc : comme le w est plus long que le s ça a tendance à faire une ligne sans trou du style "w25w26w27w28", il faudrait que ça fasse "w25 w26 w27 w28" ».

Le graphe est `src/components/ActivityChart.tsx` (et son CSS), ses étiquettes viennent de `src/library/activityChart.ts` (clé `S{week}`, « W{week} » en anglais, « S{week} » en espagnol). En français « S25 » tient avec un blanc entre deux étiquettes ; « W25 », plus large, n'en laisse plus.

## Attendu

- Entre deux étiquettes voisines, toujours un blanc visible, dans les trois langues, à 390 px et à 320 px de large (téléphone droit), et sur téléphone tourné.
- En français, le rendu ne change pas si c'est possible (texte de la page identique au banc) ; si la correction change aussi le français, le dire dans le rapport.
- Aucune étiquette tronquée, aucune semaine décalée : chaque étiquette reste sous sa barre.
- Le moyen est libre (blanc minimal garanti, étiquette une semaine sur deux quand la place manque, taille de police…), tant qu'il ne suppose pas une largeur de lettre : la mesure ou la mise en page doit tenir pour une autre langue et pour un texte agrandi.
- `src/library/stats.ts` emploie la même clé `S{week}` pour les Statistiques : regarder si le même défaut s'y produit ; si la pièce est la même, la correction le couvre ; sinon le signaler dans le rapport sans élargir.

## Vérification

- Mesurer avec le banc (`outils/banc/langues.mjs` contrôle déjà les largeurs par langue ; `outils/banc/profil.mjs` relève le Profil) : en anglais à 390 et 320 px, les boîtes de deux étiquettes voisines ne se touchent plus. Si un contrôle de ce chevauchement s'ajoute en quelques lignes à `langues.mjs`, l'ajouter.
- Ne pas toucher aux dictionnaires (`src/locales/`) : « W{week} » est la bonne traduction.
