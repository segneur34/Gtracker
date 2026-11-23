# Gtracker

Analyse de sessions de voile (wingfoil, planche, kite, bateau) et de surf à partir de traces GPX, et enregistrement GPS sur le téléphone. Application 100 % client, sans backend à nous : les traces et les sessions ne partent jamais sur internet, mais l'application interroge des services publics (liste plus bas). Elle tourne dans le navigateur ; emballée par Capacitor, sur Android, avec enregistrement GPS natif, ceinture cardio Bluetooth et mémoire en dossier portable ; et, emballée par Electron, en programme Windows, qui garde les sessions dans un dossier du disque et se synchronise avec le téléphone.

Deux familles d'activités, chacune avec sa page d'analyse (carte, graphes, meilleurs segments, notes) : **Avec vent** (wingfoil, planche, kite, bateau) et **Sans vent** (surf, surf foil). Toutes les sessions sont dans une seule liste, **Sessions**, filtrable par activité. Autour : **Enregistrer**, **Planifier** (parcours de balises en ligne droite, import et export GPX), **Statistiques** (onglets général, graphique, régularité, records, cardio), **Profil** et **Réglages** (avec le test de FC repos).

## Mémoire

Les sessions vivent dans un dossier ordinaire, `Gtracker` : un GPX et une fiche JSON par session dans `sessions/`, et un fichier de réglages par appareil dans `reglages/` ; sa disposition complète, qui est le format des données des utilisateurs, est décrite une seule fois, au §6.1 de `docs/ETAT_DU_PROJET.md`. On le copie pour sauvegarder ou pour passer d'un appareil à l'autre. Sur Android, il se désigne une fois (en principe `Documents/Gtracker`) ; sur le programme Windows, c'est un dossier du disque, proposé au premier lancement (en principe `Documents\Gtracker`) ; dans le navigateur, c'est la mémoire privée du navigateur ou un dossier choisi (Chrome, Edge).

## Programme Windows

Le programme Windows (`bureau/`) est la même application, avec ce que le navigateur ne permet pas :
- **les sessions sur le disque** : le dossier des sessions est un vrai dossier de Windows, lu et écrit par le programme, avec une corbeille de 30 jours (Réglages › Mémoire) ;
- **la synchronisation avec le téléphone** : le bouton « Synchroniser », en haut de la fenêtre, met à jour les deux appareils dans les deux sens : sessions (ajouts, modifications, suppressions ; une session supprimée sur le téléphone passe dans la corbeille de l'ordinateur), itinéraires, fichiers de réglages, tests de FC repos et lieux appris. Quand une même information a changé des deux côtés, la plus récente est gardée. Avant la première synchronisation d'un téléphone, une copie de sécurité des deux dossiers est faite (par défaut `Documents\Gtracker-copies`) et rien n'est supprimé ; ensuite, le programme demande avant de retirer beaucoup de sessions. Pendant un enregistrement, le téléphone n'est pas modifié ;
- **l'application du téléphone** : l'installeur emporte l'APK de la même version, que Réglages › Connexion › « Application du téléphone » enregistre sur le disque ou installe par le câble.

Le téléphone se relie une fois, par un code de 6 chiffres affiché par l'ordinateur et tapé sur le téléphone (Réglages › Connexion : « Téléphone » sur l'ordinateur, « Ordinateur » sur le téléphone ; marche à suivre dans `docs/INSTALLATION.md`). La synchronisation passe ensuite par le Wi-Fi (même réseau, ou partage de connexion du téléphone), sinon par le câble USB avec le débogage USB du téléphone et l'outil `adb` de Google, absent de l'installeur.

Ce qui passe sur le réseau local, et seulement quand la case « Relier le téléphone sans câble » est cochée (elle ne l'est pas au départ) :

| Quoi | Comment |
|---|---|
| Écoute de l'ordinateur | TCP 48217 (ou l'un des neuf ports suivants s'il est pris), sur ses seules adresses IPv4 privées, jamais une adresse publique |
| Découverte | UDP 48218 : le téléphone demande où est l'ordinateur ; la réponse porte une empreinte calculée pour cette question, jamais l'identifiant ni le nom Windows de l'ordinateur ; le téléphone peut aussi taper l'adresse affichée |
| Appairage | le code n'est jamais envoyé : chaque côté prouve qu'il le connaît (échange SPAKE2), lié au certificat de la connexion ; trois codes faux ferment la fenêtre d'appairage |
| Synchronisation | connexion chiffrée (TLS, certificat de l'ordinateur retenu par le téléphone à l'appairage) : l'ordinateur liste, lit et écrit les fichiers du dossier `Gtracker` du téléphone, dans les seuls dossiers de l'application ; Gtracker doit être ouvert sur le téléphone |

Rien de tout cela ne sort sur internet. Pour ses cartes et ses lieux, le programme appelle les mêmes services que l'application (tableau ci-dessous), en se présentant sous le nom `Gtracker/<version>` et sans donnée personnelle. Les secrets de la liaison (certificat et sa clé chiffrée par Windows, téléphones reliés) sont gardés dans le profil du programme (`%APPDATA%\Gtracker`), jamais dans le dossier des sessions. Si le pare-feu de Windows bloque la liaison, le bouton « Autoriser Gtracker » y pose deux règles pour ce seul programme, sur le réseau local, après confirmation de Windows ; la désinstallation les retire.

## Services appelés

Aucune clé, aucun compte, aucune télémétrie ; seuls ces services reçoivent des requêtes, et seulement dans ces cas :

| Service | Quand | Ce qui part |
|---|---|---|
| Tuiles OpenStreetMap (`tile.openstreetmap.org`) | à chaque carte, image de partage ou vignette de session en vue « plan », sauf tuile déjà gardée sur l'appareil | la position de la tuile (zoom, colonne, ligne), donc la zone regardée |
| Photon (`photon.komoot.io`), recherche inverse | pour nommer une session par son lieu : à la fin d'un enregistrement, à l'import, à l'ouverture d'une analyse et pour les sessions de la liste qui n'ont pas encore de lieu ; allumée d'office, se coupe dans Réglages › Mémoire | le point de départ de la session, et son point d'arrivée s'il est éloigné du départ, arrondis à trois décimales (une centaine de mètres), avec la langue (français ou anglais) et le rayon de recherche ; jamais la trace, l'heure ni le nom de la session |
| Photon (`photon.komoot.io`), recherche par nom | recherche d'un lieu dans Planifier | le texte tapé et le centre de la carte |

Un lieu déjà appris sur l'appareil (corrigé par l'utilisateur) est repris sans interroger le service. Réglages permet aussi de remplacer l'adresse des tuiles du plan par celle d'un autre serveur : les tuiles sont alors demandées à cette adresse.

Ouvrir un GPX, l'analyser, enregistrer et lire les Statistiques n'appellent rien d'autre que les tuiles de la carte et, sauf si on l'a coupée, la recherche du lieu des sessions. Aucun service de calcul d'itinéraire ni d'altitude n'est appelé.

## Commandes

```
npm run dev          serveur de développement
npx tsc -b           typecheck incrémental (strict, noUnusedLocals, verbatimModuleSyntax) ; --force pour tout revérifier
npm run lint         oxlint
npx vitest run --changed   tests qui importent, même de loin, un fichier modifié non commité
npx vitest run       tous les tests de src/, bureau/ et outils/, en node, sans navigateur
npx vitest run src/sailing/wind.test.ts -t "nom"   un fichier, un test
npm run build        tsc -b && vite build
npm run verif        lint, tous les tests, build et renvois des documents, en une commande
npm run installeur   installeur du programme Windows (voir docs/DEVELOPPER.md, « Windows »)
```

Les tests Java d'Android se lancent par Gradle (`docs/DEVELOPPER.md`) ; ce que couvrent les tests : `docs/ETAT_DU_PROJET.md`, §8.

## Documentation

- `ARCHITECTURE.md` : règles d'architecture (« règle N » dans le code) et conventions à suivre en ajoutant du code.
- `docs/ETAT_DU_PROJET.md` : pipeline, persistance et disposition du dossier des sessions (§6.1), tests (§8), dette, chantiers, avancement du plan mobile (§12).
- `docs/INVENTAIRE.md` : carte des fichiers.
- `docs/MISE_EN_PAGE.md` : patron commun des pages d'analyse.
- `docs/GLOSSAIRE.md` : les mots du code qui trompent, en une page.
- `docs/DEVELOPPER.md` : construire l'application (Node, JDK 21, signature, APK, hébergement web) et le programme Windows (installeur).
- `docs/INSTALLATION.md` : installer l'APK sur un téléphone Android, puis le programme Windows, et relier les deux.
- `outils/banc/LISEZMOI.md` : banc de test dans un Chrome sans fenêtre, mode d'emploi.

<!-- atelier -->
Documents de l'atelier, qui ne partent pas avec le dépôt remis :

- `CLAUDE.md` : consignes de l'assistant et décisions transverses de l'utilisateur ; il importe `ARCHITECTURE.md`.
- `docs/DECISIONS.md` : décisions de l'utilisateur propres à chaque domaine.
- `docs/HISTORIQUE.md` : décisions et pièges, en points numérotés.
- `docs/MODELES.md` : quel modèle et quel effort pour quelle tâche, sous-agents de `.claude/agents/`.
- `docs/BACKLOG.md` : le reste à faire.
<!-- /atelier -->
