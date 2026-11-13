# 345 · Rappel du matériel à l'analyse

Modèle | Réflexion : Sonnet | high

## Tel que noté

Réponse du 12/11 à Q107 : « Si dans une session dans un sport on a coché le type de matériel et qu'il n'y a pas de matériel de sélectionné, on peut avoir une petite pop-up qui s'ouvre dans la page d'analyse qui dit voulez-vous ajouter le matériel. Ça doit s'ouvrir au moins à la première session et à la deuxième fois, si ça recoche non, on laisse fermé. » Depuis le lot 313, la carte de fin d'enregistrement a disparu : le matériel ne se choisit plus que dans l'onglet « matos et conditions » (voile) ou « matériel et notes » (surf) de l'analyse, sans rappel.

## Décisions déjà prises

- La fenêtre « Voulez-vous ajouter le matériel ? » s'ouvre à l'analyse qui suit la fin d'un enregistrement, pas à la réouverture d'une ancienne session (lecture de Claude confirmée le 12/11 : « globalement oui »).
- Elle ne s'ouvre que si l'activité de la session a une liste de matériel (au moins un type de matériel coché ou une pièce dans Réglages pour cette activité) et que la session n'en porte aucun.
- « Oui » ouvre l'onglet du matériel de l'analyse (en dépliant « avancé » s'il le faut) ; « Non » ou la croix la ferme.
- Après deux fermetures sans ajout, elle ne s'ouvre plus (corrigé par l'utilisateur le 12/11) ; aucune case dans Réglages pour la remettre : la personne va d'elle-même dans l'onglet du matériel.
- Le compte des fermetures est tenu par activité (choix de Claude).
- Une seule pièce, partagée par les deux analyses (`components/`), jamais une copie par module.

## Tranché par l'orchestrateur (13/11)

- Le compte des fermetures est un réglage de l'appareil rangé par identifiant d'activité, par le magasin des réglages (`settings/activitySettings.ts`, `PER_ACTIVITY_KEYS`, `SETTING_FIELDS`), sans ligne dans la page Réglages ; jamais `localStorage` en direct (règle 12).
- « Oui » compte comme une réponse qui ne ferme pas le rappel pour de bon : seules les fermetures sans ajout comptent.
- La fenêtre emploie `ui/Dialog` ; elle n'apparaît pas tant qu'une autre vue est posée sur la page (avertissements de l'arrêt en tête de l'analyse compris : elle vient après eux, sans les cacher).
- Le signal « cette analyse suit la fin d'un enregistrement » existe déjà pour les avertissements de l'arrêt (lot 313) : le réutiliser, ne pas en créer un second.

## Voulu

1. La pièce partagée et son branchement dans `SailingModule` et `SurfModule` (ou dans `AnalysisShell` si c'est là que vit le signal de fin d'enregistrement).
2. La règle « faut-il la montrer » en fonction pure et testée (activité avec liste de matériel, session sans matériel, moins de deux fermetures, analyse qui suit un enregistrement).
3. Le compte par activité, persisté.
4. Tests de la règle et du réglage.
5. Banc : un contrôle dans le script qui joue la fin d'un enregistrement (`session-save` ou celui qui convient) : la fenêtre s'ouvre quand l'activité a du matériel, « Non » deux fois puis plus rien, « Oui » ouvre l'onglet ; `outils/banc/SCRIPTS.md` suit. Lance ce script seul (`node outils/banc/passe.mjs <nom> -j 1`), une fois le code fini.

## Ne pas faire

- Pas de case dans Réglages, pas de rappel à la réouverture d'une ancienne session, aucun matériel repris d'une autre session (décision « Matériel et notes » de `CLAUDE.md`).
- Ne pas toucher à `docs/` hors de ce brief, ni à `CLAUDE.md`, ni à `package.json`, ni commit ni version.

## Rapport attendu

Le rapport habituel, avec : où vit le signal de fin d'enregistrement, les textes de la fenêtre, le résultat du script du banc.
