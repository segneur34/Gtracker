# 343 · Réglages : remise à zéro

Modèle | Réflexion : Opus | high

## Tel que noté

Demande du 11/11 au soir, après une réinstallation qui rendait l'ancienne liste d'activités : un bouton de remise à zéro dans Réglages, qui propose deux choix : tout supprimer, sessions comprises ; ou ne supprimer que les réglages et revenir partout aux réglages d'usine. Vu ce soir-là : désinstaller ne suffit pas, le dossier mémoire (`Documents/Gtracker` sur le téléphone) survit, et ses fichiers de réglages (`reglages/`) rendent les anciens réglages à la première ouverture.

## Décisions déjà prises

- Deux choix dans Réglages : « réglages d'usine » (les réglages seuls) et « tout supprimer ».
- Geste protégé comme « Jeter » : tenu une seconde (`HoldButton`), puis une confirmation.
- Réponses de l'utilisateur du 13/11 :
  - « Tout supprimer » efface aussi les fichiers de sessions du dossier mémoire, leurs fiches et les réglages qui s'y trouvent. C'est définitif : la confirmation dit le nombre de sessions effacées.
  - « Tout supprimer » efface tout, sans exception : sessions, itinéraires, profil (pseudo, année de naissance, photo), réglages et fonds de carte gardés pour le hors-ligne. L'application redevient celle d'une première installation.
- « Réglages d'usine » : tous les réglages reviennent à leur défaut (activités de départ et leurs pré-réglages, unités, onglets, tailles de panneaux, couleurs de trace, tutoriels lus…), sur l'appareil et dans le fichier de réglages de cet appareil du dossier mémoire ; les sessions, leurs fiches, les itinéraires et le profil ne sont pas touchés.

## Tranché par l'orchestrateur (13/11)

- « Réglages d'usine » ne retire du dossier mémoire que le fichier de réglages de cet appareil ; ceux des autres appareils restent (on peut encore les « Reprendre »). « Tout supprimer » retire tout ce que l'application a écrit dans le dossier mémoire, fichiers de réglages des autres appareils compris, mais jamais un fichier qu'elle n'a pas écrit ni rangé (un fichier étranger déposé là par l'utilisateur reste) ; le dossier lui-même reste désigné, vide.
- Sur ordinateur (navigateur), même chose : la mémoire interne ou le dossier désigné sont vidés de ce que l'application y a écrit.
- Pendant un enregistrement en cours, les deux boutons sont refusés avec une phrase qui dit pourquoi.
- Après l'un ou l'autre, l'application se recharge et s'ouvre comme à une première installation (pour « tout supprimer ») ou sur le Profil (pour « réglages d'usine »).
- Emplacement : en bas de la carte « Mémoire » de Réglages, dans une zone repliée « Remise à zéro », pour ne pas être sous le pouce.
- Tout passe par `src/platform/` (règle 12) : stockage, fichiers, dossier mémoire, cache des tuiles.

## Voulu

1. Les deux actions, en fonctions testées là où c'est pur (la liste de ce qui s'efface, le texte de la confirmation), et par les modules de `src/platform/` pour l'effacement lui-même.
2. La zone « Remise à zéro » de Réglages, avec une aide « ? » qui dit en clair ce que fait chaque bouton et que « tout supprimer » est définitif.
3. Tests, dont un qui garde que rien d'autre que les fichiers de l'application n'est visé dans le dossier mémoire.
4. Banc : un script neuf `remise-a-zero` (réglages d'usine : une activité créée et une unité changée reviennent au défaut, les sessions restent ; tout supprimer : plus de session, plus de profil, liste d'activités de départ, dossier mémoire simulé vidé de ses fichiers d'application et pas d'un fichier étranger), écrit et lancé par l'agent une fois le code fini.

## Ne pas faire

- Ne jamais effacer hors du dossier mémoire désigné ni hors du stockage de l'application.
- Ne pas toucher à `docs/` hors de ce brief, ni à `CLAUDE.md`, ni à `package.json`, ni commit ni version.

## Rapport attendu

Le rapport habituel, avec : la liste exacte de ce que chaque bouton efface (clés de l'appareil, fichiers et dossiers du dossier mémoire, caches), les textes des confirmations, le résultat du script du banc.
