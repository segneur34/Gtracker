# 419 · Autorisations : suites des essais du lot 408

## Tel que dit par l'utilisateur (16/11, APK 0.01.11)

- « 283 Le texte est visible mais se voit pas bien mais sinon le bouton fonctionne et tout reste bon »
- « le démarrage auto est marqué comme non autorisé mais si je clique sur autorisé la fenêtre qui ouvre dit que c'est déjà le cas »

## Deux corrections

### 1. L'état du démarrage automatique n'est plus affiché

Aujourd'hui : sur un Xiaomi, la ligne « Démarrage automatique » de la carte « Autorisations » (`src/components/PermissionsStatus.tsx`) affiche « activé » ou « désactivé », lu par une opération propre à Xiaomi (`PermissionsPlugin.java`, `src/platform/permissions.ts`, `src/recording/permissionsPrompt.ts`). Sur le téléphone de l'utilisateur, elle dit « désactivé » alors que le réglage est activé.

Voulu, décidé d'avance au lot 408 (« si rien ne s'affiche ou ne change : seule la pastille sera retirée ») :
- plus aucun état affiché ni lu pour le démarrage automatique : la ligne garde sa phrase (« Pour que l'enregistrement continue, application fermée. ») et son bouton ; elle reste réservée aux Xiaomi (Redmi et POCO compris) ;
- le code de lecture devenu inutile part, côté Java comme côté page (la marque du téléphone reste lue : elle décide de montrer la ligne), ainsi que les mots « activé » et « désactivé » des dictionnaires s'ils ne servent plus ailleurs ;
- « Tout autoriser » : aujourd'hui il finit par l'écran du démarrage automatique tant que l'état n'est pas lu « activé ». Sans lecture, il ne l'ouvre qu'une fois par appareil (retenu dans un réglage de l'appareil, par `src/platform/`), pour ne pas rouvrir cet écran à chaque appui ; le bouton de la ligne reste là pour y revenir. Le démarrage automatique ne compte toujours pas dans ce qui manque.

### 2. L'avertissement de batterie se lit d'un coup d'œil

Aujourd'hui : sur la page Enregistrer, au repos, la rangée « Batterie restreinte : Android peut couper l'enregistrement, application fermée. » (`src/pages/RecordingPage.tsx`) est écrite en gris pâle, comme une note.

Confirmé et précisé par l'utilisateur le 16/11 : « oui c'est ça, il le faudrait en rouge ou avec un cadre ».

Voulu : la rangée devient un cadre d'alerte, celui que la page emploie déjà pour ses autres alertes (localisation coupée, ceinture déconnectée), avec la phrase et son bouton « Autoriser » dedans : on sait ce que le bouton relance, comme le lot 416 le demandera pour toutes les alertes. Choix de Claude entre les deux formes proposées : un texte rouge seul se lit moins bien dehors qu'un cadre, et la charte garde la couleur hors du texte quand elle le peut. Variables du thème, aucune valeur en dur, aucun style en ligne neuf ; le départ n'est jamais bloqué ; rien d'autre ne bouge sur la page, le lot 416 redessinera l'ensemble.

## Contraintes

- Capacités natives par `src/platform/` seulement ; textes par `t`, dictionnaires sans clé manquante ni clé morte ; tests de `permissionsPrompt` et de `nativeConstants` à suivre.
- Banc : la carte « Autorisations » n'existe que sur le téléphone ; le texte des pages relevé avant et après doit rester identique dans le navigateur.

## Essais au téléphone

- Le 281, remis à cette APK : batterie en « Optimisée », « Tout autoriser » → écran de la batterie, puis celui du démarrage automatique.
- Un essai neuf : la ligne « Démarrage automatique » ne montre plus d'état, et l'avertissement de batterie de la page Enregistrer se lit bien dehors.
