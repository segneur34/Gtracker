# 456 · Enregistrer : la page s'appelle « Enregistrement… » pendant un enregistrement

Modèle | Réflexion : Sonnet | medium

## Tel que dit par l'utilisateur (note du 19/11)

« Quand on est en train d'enregistrer la page s'appelle [Enregistrer] et pas "enregistrement..." Ce qui serait mieux. »

## Constat (lu dans le code le 19/11, à revérifier)

`src/pages/RecordingPage.tsx` : `PageHeader` porte le titre « Enregistrer » dans tous les états de la page. La clé « Enregistrement… » (avec le caractère « … ») existe déjà dans les dictionnaires, employée par la planification.

## Voulu

- Dès qu'un enregistrement tourne (`busy`), pause manuelle ou automatique comprise, le titre de la page est « Enregistrement… » ; il redevient « Enregistrer » à l'arrêt. Une session en attente (« Continuer / Analyser / Jeter ») garde « Enregistrer ».
- Le sous-titre ne change pas.
- Si une feuille de style cache l'en-tête pendant l'enregistrement, ou si le mot « Enregistrer » que l'utilisateur voit à ce moment-là est ailleurs (titre de l'onglet du navigateur, barre), le dire dans le rapport au lieu de deviner.

## Contraintes

- Texte par `t`, clé existante reprise telle quelle ; aucune clé neuve attendue.
- Rien d'autre sur la page (`docs/DECISIONS.md` §6).

## Banc

Scripts qui lisent la page Enregistrer pendant un enregistrement : « Enregistrement… » à la place de « Enregistrer » dans le titre, rien d'autre.

## Essai au téléphone

Aucun : le banc le lit.
