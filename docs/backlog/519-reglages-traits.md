# 519 · Réglages : des traits fins entre les parties d'un bloc

## Tel que noté (23/11, sur la 0.02.22)

« Dans les réglages, il faut prévoir des petits traits noirs qui séparent différentes parties. Un exemple, dans le bloc connexion, il y a un bloc ordinateur et à la fin de ce bloc, il est écrit ceinture et montre ajouter. Et bien ces deux blocs doivent être séparés par un petit trait noir. Et je précise que ceinture et montre doit être mis dans la même police et la même taille que ordinateur. Il y a le même problème dans mémoire, il faut séparer le bloc mise à jour, le bloc réglage, le bloc téléphone, etc. Les différents blocs ainsi que remise à 0. Sinon c'est pas clair. Voilà, les blocs par logique. »

## Où

Réglages (`src/pages/SettingsPage.tsx`) : le bloc « Connexion » (`src/components/ConnectionSettings.tsx`, lot 512 : cartes `ComputerLinkCard`, `WirelessPhoneCard`, `PhoneAppCard`, puis `HeartRateBeltSettings`) et le bloc « Mémoire » (`src/components/MemoryStatus.tsx` : emplacement, copie de sécurité, mise à jour, fichiers de réglages, lieu des sessions, corbeille, remise à zéro).

## Voulu

- Dans chaque bloc de Réglages qui réunit plusieurs parties, un trait fin à l'encre entre deux parties, « par logique » : une partie, un titre, son contenu, puis le trait.
- Dans « Connexion » : un trait entre « Ordinateur » et « Ceintures et montres » (téléphone), et entre « Téléphone », « Application du téléphone » et « Ceintures et montres » (programme Windows).
- « Ceintures et montres » dans la même police et la même taille que « Ordinateur » : tous les titres de partie d'un bloc ont le même style.
- Dans « Mémoire » : les parties séparées de même (mise à jour, réglages, etc.), « Remise à zéro » comprise.

## À prévoir

- Une courte planche avant de coder (téléphone et ordinateur) : le découpage de « Mémoire » en parties et leurs titres ne sont pas tous donnés par la note, et le lot change ce que l'utilisateur voit dans Réglages. La note cite un « bloc téléphone » dans « Mémoire » : depuis le lot 512 les cartes de liaison sont dans « Connexion » ; à vérifier sur la 0.02.22 ce qu'il désigne (sans doute les fichiers de réglages des autres appareils).
- Charte : trait et titres par les variables de `src/theme/tokens.css` ; une seule classe de titre de partie et une seule de séparation, réemployées par tous les blocs (les titres des cartes ont aujourd'hui chacun leur classe : `computer-link__title`, `wireless-card__title`, `phone-app__title`, `connection-settings__title`).
- Voir si les autres blocs à plusieurs parties (Pratiquant, Enregistrement, Affichage, Autorisations) doivent suivre : à poser dans la planche.
- Banc : `reglages`, `reglages-aide`, `tailles`, et les scripts du programme Windows qui lisent ces cartes ; texte identique attendu, captures avant et après.
- `docs/DECISIONS.md` §11 à compléter à la passe de documentation.
