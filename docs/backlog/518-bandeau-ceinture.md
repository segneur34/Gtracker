# 518 · Enregistrer : le bandeau rouge « Aucune ceinture choisie » ne doit paraître que si la ceinture est demandée

## Tel que noté (23/11, sur la 0.02.22)

« Là, j'ai lancé un enregistrement. Et j'ai un bandeau rouge qui s'affiche sur mon écran de téléphone avec écrit aucune ceinture choisie, réglage, bloc, connexion. Moi, je veux qu'un bandeau comme ça s'affiche si j'ai coché la case ceinture cardio. Et là, actuellement, elle n'était pas cochée. À mon avis, il faut revoir les conditions d'affichage de ce bandeau. »

## Aujourd'hui (vérifié dans le code le 23/11)

Page Enregistrer (`src/pages/RecordingPage.tsx`, option « Ceinture cardio », vers la ligne 894) : quand aucune ceinture n'est choisie (`belt === null`), la case est grisée et sa note s'affiche en alerte (`noteAlert`), avec la phrase « Aucune ceinture choisie : Réglages, bloc « Connexion ». », que la case soit cochée ou non. Ce n'est pas une régression du lot 512, qui n'a changé que la fin de la phrase (« bloc « Capteurs » » devenu « bloc « Connexion » ») ; la condition d'affichage est plus ancienne.

## Voulu

L'alerte rouge ne paraît que si l'utilisateur a demandé la ceinture (case « Ceinture cardio » cochée) et qu'aucune ceinture n'est choisie. Sans ceinture demandée : pas de rouge.

## À trancher par le lot, sans redemander

- Sans ceinture choisie, la case est aujourd'hui grisée, donc jamais cochée : voir ce que vaut alors « cochée » (le réglage de l'activité qui propose la ceinture, `heartRateSetting`, ou le dernier choix retenu) et faire que le rouge suive la demande réelle.
- Ce qui reste à l'écran quand la ceinture n'est pas demandée et qu'aucune n'est choisie : une note discrète, sans alerte, qui garde le lien vers Réglages › Connexion, pour que la case grisée reste comprise.
- Regarder si le même bandeau existe pendant l'enregistrement en cours ou dans le test de FC repos, et leur appliquer la même règle.

Décisions : `docs/DECISIONS.md` §6 (enregistrement, ceinture). Un essai au téléphone : sans ceinture retenue, page Enregistrer → pas de rouge.
