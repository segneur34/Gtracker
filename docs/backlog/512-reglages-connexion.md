# 512 · Réglages : un bloc « Connexion »

## Tel que noté (23/11)

« Il faudrait dans les paramètres créer un onglet connexion qui serait entre mémoire et autorisation qui reprendrait l'onglet tracker actuel et tout le volet connexion PC actuel. Enfin PC téléphone. Ce qui serait plus logique pour le chercher plus tard, si quelqu'un le cherche et qu'il sait pas où est-ce qu'il est, plutôt que dans mémoire. »

« L'onglet tracker » : aucun bloc de Réglages ne porte ce nom ; compris comme le bloc « Capteurs » (note dictée), à confirmer par l'utilisateur (réponse dans la ligne du reste à faire).

## Où

Réglages (`src/pages/SettingsPage.tsx`). Ordre des blocs aujourd'hui : Pratiquant, Activités, Capteurs, Enregistrement, Affichage, Cartes hors ligne, Mémoire, Autorisations, Tutoriels, À propos.

## Aujourd'hui (vérifié dans le code le 23/11)

- Tout ce qui relie le téléphone et l'ordinateur est dans le bloc Mémoire (`src/components/MemoryStatus.tsx`, en bas, quand il est détaillé) :
  - sur le programme Windows : « Téléphone sans câble » (`WirelessPhoneCard` : case du sans-fil, état, pare-feu et « Autoriser Gtracker », « Relier un téléphone » avec son code, téléphones reliés) et l'application du téléphone à installer par le câble (`PhoneAppCard`) ;
  - sur le téléphone : la carte de l'ordinateur (`ComputerLinkCard` : code à taper, adresse, ordinateur relié, « Oublier cet ordinateur »).
- La fenêtre « Synchroniser » renvoie à Réglages par `?bloc=relier`, qui ouvre Mémoire et la fenêtre du code (`SettingsPage.tsx`, vers la ligne 575).
- Les capteurs (ceinture cardio, montres) sont dans le bloc « Capteurs », entre Activités et Enregistrement.
- Une vingtaine de phrases et d'aides disent « Réglages › Mémoire » ou « Réglages › Capteurs » (cartes de liaison, bouton Synchroniser, aides, tutoriels), avec leurs traductions.

## Voulu

Un bloc « Connexion » entre Mémoire et Autorisations, qui réunit ce qui relie Gtracker à un autre appareil : la liaison entre le téléphone et l'ordinateur (les trois cartes ci-dessus, sorties de Mémoire) et, si « tracker » veut bien dire « Capteurs », la ceinture cardio et les montres. Mémoire ne garde que le dossier, la copie de sécurité, la corbeille et les fichiers.

## Pourquoi

Quelqu'un qui cherche comment relier son téléphone à son ordinateur ne pense pas à regarder dans « Mémoire ».

## À prévoir dans le lot

- Une courte planche avant de coder (ce qui va où, sur téléphone et sur ordinateur), le lot changeant la disposition de Réglages.
- `?bloc=relier` ouvre le bloc neuf ; les phrases « Réglages › Mémoire » qui parlent de la liaison, et « Réglages › Capteurs » si le bloc est repris, deviennent « Réglages › Connexion », traductions comprises ; aide « ? » du bloc.
- `docs/DECISIONS.md` §8 (liaison dans Réglages › Mémoire), §11 (ordre des blocs de Réglages) et §6 (ceinture dans Réglages › Capteurs) à mettre à jour à la passe de documentation.
- Banc : `reglages`, `exe-sansfil`, `exe-application` et les scripts qui ouvrent le bloc Mémoire pour la liaison.

## Questions

- « Tracker » : le bloc « Capteurs » ? Réponse du 23/11 : oui, le bloc « Capteurs » ; il disparaît comme bloc à part, son contenu passe dans « Connexion ».
- Rangement, réponse du 23/11 : prochain paquet, en tête d'Ensuite.
- Planche montrée le 23/11 (hors dépôt, dossier `planche-512` de l'atelier) et validée le 23/11 (« je suis d'accord avec tes recommandations »). La disposition retenue est dans « Disposition validée » ci-dessous.

## Disposition validée (23/11)

Ordre des blocs de Réglages : Pratiquant, Activités, Enregistrement, Affichage, Cartes hors ligne, Mémoire, **Connexion**, Autorisations, Tutoriels, À propos. Le bloc « Capteurs » n'existe plus.

Dans « Connexion », de haut en bas, chaque carte gardant son contenu, ses boutons et ses phrases :
- sur le téléphone : la carte « Ordinateur » (`ComputerLinkCard`), puis les ceintures et montres (`HeartRateBeltSettings`) ;
- sur le programme Windows : la carte « Téléphone » (`WirelessPhoneCard`, « Par câble (avancé) » compris), la carte « Application du téléphone » (`PhoneAppCard`), puis, en bas, la ligne des ceintures, précédée de son titre : « Ceintures et montres » et « Sur l'application Android seulement. » ;
- dans un navigateur : la seule ligne des ceintures (les cartes de liaison ne s'y montrent pas).

Tranché par l'orchestrateur :
- nom « Connexion », au singulier ; aide « ? » du bloc : « Ce qui relie Gtracker à un autre appareil : l'ordinateur ou le téléphone, les ceintures cardio et les montres. » ;
- restent dans Mémoire : emplacement, copie de sécurité, fichiers de réglages (dont « Reprendre le matériel » et « Matériel des deux appareils », et la phrase qui y renvoie), lieu des sessions, corbeille, remise à zéro ;
- le bloc démarre replié ; l'état ouvert de l'ancien bloc « Capteurs » n'est pas repris ;
- `?bloc=relier` ouvre « Connexion » et la fenêtre du code ; `?bloc=capteurs` (lien de la page Enregistrer) ouvre « Connexion » et amène les ceintures à l'écran, le retour d'Android ramenant toujours à Enregistrer ; les deux adresses gardent leur nom ;
- les phrases « Réglages › Mémoire » qui parlent de la liaison et toutes les « Réglages › Capteurs » deviennent « Réglages › Connexion » (français, anglais, espagnol), commentaires du code compris ; celles qui parlent du dossier, des fichiers de réglages ou du lieu restent « Réglages › Mémoire ».

Le lot part en deux parties : A, le code et ses tests (Sonnet, effort élevé) ; B, les scripts du banc qui ouvraient Mémoire pour la liaison ou « Capteurs » (Sonnet), après la A.
