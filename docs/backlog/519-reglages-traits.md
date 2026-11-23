# 519 · Réglages : des traits fins entre les parties d'un bloc

Modèle | Réflexion : Sonnet | high

## Tel que noté (23/11, sur la 0.02.22)

« Dans les réglages, il faut prévoir des petits traits noirs qui séparent différentes parties. Un exemple, dans le bloc connexion, il y a un bloc ordinateur et à la fin de ce bloc, il est écrit ceinture et montre ajouter. Et bien ces deux blocs doivent être séparés par un petit trait noir. Et je précise que ceinture et montre doit être mis dans la même police et la même taille que ordinateur. Il y a le même problème dans mémoire, il faut séparer le bloc mise à jour, le bloc réglage, le bloc téléphone, etc. Les différents blocs ainsi que remise à 0. Sinon c'est pas clair. Voilà, les blocs par logique. »

## Où

Réglages (`src/pages/SettingsPage.tsx`) : le bloc « Connexion » (`src/components/ConnectionSettings.tsx`, lot 512 : cartes `ComputerLinkCard`, `WirelessPhoneCard`, `PhoneAppCard`, puis `HeartRateBeltSettings`) et le bloc « Mémoire » (`src/components/MemoryStatus.tsx` : emplacement, copie de sécurité, mise à jour, fichiers de réglages, lieu des sessions, corbeille, remise à zéro).

## Voulu

- Dans chaque bloc de Réglages qui réunit plusieurs parties, un trait fin à l'encre entre deux parties, « par logique » : une partie, un titre, son contenu, puis le trait.
- Dans « Connexion » : un trait entre « Ordinateur » et « Ceintures et montres » (téléphone), et entre « Téléphone », « Application du téléphone » et « Ceintures et montres » (programme Windows).
- « Ceintures et montres » dans la même police et la même taille que « Ordinateur » : tous les titres de partie d'un bloc ont le même style.
- Dans « Mémoire » : les parties séparées de même (mise à jour, réglages, etc.), « Remise à zéro » comprise.

## Tranché sur la planche du 23/11 (`D:\gong tracker\atelier\planche-519\planche.html`, images dans `images\`)

Réponse de l'utilisateur : « A1, B1, C2, D1 » ; E sans réponse, pris comme recommandé (E1), dit à l'utilisateur.

- **A1, le trait** : fin, sur toute la largeur du bloc, le même qu'entre les parties d'une activité : le jeton `--trait-encre` (1 px à l'encre), déjà employé par `.settings-part`. Une seule classe de partie, le trait venant entre deux parties voisines (`partie + partie { border-top: var(--trait-encre); padding-top: var(--space-3) }`), jamais avant la première ni après la dernière.
- **B1, les titres de partie** : gras, à la taille d'« Ordinateur » aujourd'hui. Une seule classe de titre de partie (`--font-title`, `--title-weight`, `--title-spacing`, `--title-case`, taille `--text-m`, encre), qui remplace `computer-link__title`, `wireless-card__title`, `phone-app__title`, `connection-settings__title` et `set-files-title`. Images de référence : `connexion-tel-A1.jpg`, `connexion-pc-A1.jpg`.
- **Connexion, téléphone** : « Ceintures et montres » devient un titre de partie avec son « ? » sur la même ligne (c'était un libellé de ligne, 13 px gris) ; « aucune » passe à côté d'« Ajouter ». Sur l'ordinateur, « Téléphones reliés » (dans `WirelessPhoneCard`) a aujourd'hui la taille d'un titre de partie : il passe un cran en dessous.
- **C2, Mémoire** : des parties, chacune avec son titre, dans cet ordre : « Mise à jour » (la ligne d'état « 48 sessions · Documents/Gtracker », « Mettre à jour », « Ajouter les sessions d'un dossier »), « Emplacement » (le dossier, « Changer de dossier » ou « Choisir un dossier » ; les messages sur les fichiers en double, illisibles ou trop gros restent sous l'emplacement), « Copies de sécurité » (ordinateur seulement), « Réglages » (nom de l'appareil, fichiers par appareil, import), « Lieu des sessions », « Corbeille » (ordinateur avec dossier), « Remise à zéro ». Les préfixes « Emplacement : » et « Copies de sécurité : » partent des phrases, le titre le disant. Image de référence : `memoire-tel-C1.jpg`, avec en plus le titre « Mise à jour » en tête.
- **D1, autres blocs** : seul « Pratiquant » suit, en deux parties, « Écran Profil » et « Corps et cœur » (image `pratiquant-tel-A1.jpg`). Enregistrement, Affichage et Autorisations ne changent pas.
- **E1** : dans la partie « Réglages » de Mémoire, le nom de l'appareil en gras dans la liste des fichiers (« Téléphone », `strong.ui-text-m` d'un `.set-files-row`) passe en plus petit (`--text-s`), pour ne plus ressembler à un titre.
- Textes neufs (titres de partie) : par `t`, avec leurs traductions anglaise et espagnole ; réemployer une clé existante quand le mot existe déjà.

## À prévoir

- Une courte planche avant de coder (téléphone et ordinateur) : le découpage de « Mémoire » en parties et leurs titres ne sont pas tous donnés par la note, et le lot change ce que l'utilisateur voit dans Réglages. La note cite un « bloc téléphone » dans « Mémoire » : depuis le lot 512 les cartes de liaison sont dans « Connexion » ; à vérifier sur la 0.02.22 ce qu'il désigne (sans doute les fichiers de réglages des autres appareils).
- Charte : trait et titres par les variables de `src/theme/tokens.css` ; une seule classe de titre de partie et une seule de séparation, réemployées par tous les blocs (les titres des cartes ont aujourd'hui chacun leur classe : `computer-link__title`, `wireless-card__title`, `phone-app__title`, `connection-settings__title`).
- Voir si les autres blocs à plusieurs parties (Pratiquant, Enregistrement, Affichage, Autorisations) doivent suivre : à poser dans la planche.
- Banc : `reglages`, `reglages-aide`, `tailles`, et les scripts du programme Windows qui lisent ces cartes ; texte identique attendu, captures avant et après.
- `docs/DECISIONS.md` §11 à compléter à la passe de documentation.
