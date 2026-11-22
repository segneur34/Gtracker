# 489 · « Synchroniser » : remise à plat de la logique et des messages

Demande de l'utilisateur du 22/11, après les essais 337, 338, 341 et 334 sur le programme Windows 0.01.91 et l'APK 0.01.91. Tout fonctionne (sessions et itinéraires passent dans les deux sens, par le câble comme par le Wi-Fi), mais l'ensemble est jugé confus : trop de messages, des phrases fausses ou obscures, des attentes inexpliquées. Lot Fable : revoir le parcours entier avant de corriger au cas par cas ; plan et maquette des messages montrés à l'utilisateur avant tout code.

## Tel que noté

- 22/11 : « Mais il y a quand même beaucoup de messages. Voulez-vous confirmer ? Réessayer ? Ensuite, par exemple, quand je réinstalle une session depuis la corbeille et que je fais synchroniser, il me dit que ça supprime une session. Alors oui, peut-être que ça en supprime une de la corbeille pour la mettre ailleurs, mais du coup, le message n'est pas clair. Donc là, je pense qu'il y a un gros coup de logique à remettre là-dedans. Note tout ça proprement et peut-être qu'un agent fable serait plus pertinent pour tout revoir la logique générale là-dessus. Même si tout fonctionne. Il faut quand même mettre un gros coup d'amélioration. »
- 22/11, essai 337 : « Actuellement, il impose un endroit où […] les copies de sauvegarde sont faites, il faut pouvoir choisir. » (ancien élément 484)
- 22/11, essai 337 : « il m'a proposé sur le téléphone de reprendre le setup du PC. Je pense qu'il faut pouvoir choisir à ce moment-là, est-ce que vous voulez garder la configuration téléphone ou PC. » (ancien élément 485)
- 22/11, essai 341 : message « 1 itinéraire laissé pour la prochaine fois : il a changé pendant la synchronisation » : « ce message n'est pas très clair, je ne comprends pas exactement ce qu'il veut dire ». (La cause, une suppression bloquée à tort, est corrigée au lot 487, qui a aussi reformulé la phrase ; la phrase reste à revoir avec les autres.)
- 22/11, essai 334 (Wi-Fi) : « il s'est instantanément connecté au téléphone, mais il a fallu attendre quasiment 1 minute avant qu'il accepte que je puisse cliquer sur le bouton synchroniser ».
- 22/11, essai 334 : après une synchronisation réussie, un second message « Aucun téléphone ne se présente. […] À défaut, branchez votre téléphone […] La première fois, il faut aussi activer le « Débogage USB » […] » ; téléphone allumé, Gtracker ouvert (écran déverrouillé et application au premier plan : pas certain).

## Points à reprendre

1. **Trop de fenêtres et de questions** : confirmation des suppressions (garde-fou), « Réessayer », compte rendu, puis « touchez Mettre à jour » sur le téléphone. Viser un parcours d'un seul geste quand tout va bien, une question seulement quand une perte est possible.
2. **Restaurer depuis la corbeille, puis « Synchroniser »** : le compte rendu parle d'une session supprimée. Retrouver ce qui est dit et pourquoi (une entrée de corbeille retirée ? la session comptée comme supprimée d'un côté ?) ; le compte rendu ne doit dire que ce que l'utilisateur reconnaît : « 1 session restaurée, recopiée vers le téléphone ».
3. **Copie de sécurité de la première synchronisation** : l'utilisateur choisit son dossier ; le compte rendu dit où elle est.
4. **Réglages des deux appareils** : le bandeau « Nouveau fichier de réglages » du téléphone (`SettingsOfferBanner`, `src/components/SettingsFiles.tsx`, « Reprendre » / « Fermer ») devient un choix nommé : garder ceux du téléphone ou prendre ceux du PC ; aucun réglage remplacé sans ce choix dit en clair. À penser avec la fenêtre « Matériel des deux appareils » (lot 478), qui traite déjà le matériel.
5. **« Laissé pour la prochaine fois »** et les autres phrases du compte rendu (`src/library/syncReport.ts`) : relues une à une avec l'utilisateur ; aucune phrase de mécanique interne.
6. **Attente d'environ une minute** avant que « Synchroniser » soit permis, téléphone déjà relié par le Wi-Fi : trouver ce qu'on attend (présentation du téléphone, listage, délais du sans-fil dans `bureau/sansFil.ts`) et le raccourcir, ou au moins dire ce qui se passe.
7. **« Aucun téléphone ne se présente »** : ne plus conseiller le débogage USB (Q138 : il ne convient pas aux acheteurs, le sans-fil est le moyen de base) ; dire la vraie condition : écran du téléphone allumé et déverrouillé, Gtracker affiché, même réseau ; et le pare-feu (élément 488).
8. **« Sur le téléphone, touchez Mettre à jour »** : le téléphone ne pourrait-il pas se remettre à jour seul quand l'ordinateur l'a modifié ?

## Liens

- Plans d'origine : `docs/backlog/449-plan-synchroniser.md`, `450-plan-sans-fil.md`, `481-itineraires.md`, `482-sans-fil-deux-sens.md`.
- Élément 488 (pare-feu demandé par un message) : à part, plus urgent, mais ses messages se relisent ici.
- Lots 449, 450, 481, 482 et 487 : leurs essais restent à finir sur le programme 0.01.92 ; cette remise à plat ne les bloque pas.
