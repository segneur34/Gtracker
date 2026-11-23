# Contribuer à Gtracker

Pour qui reprend le dépôt : ce qu'il faut lire, lancer et respecter pour y travailler sans le casser. Ce fichier ne répète pas les autres documents, il dit lequel ouvrir et quand.

## Par où commencer

1. `README.md` : ce que fait l'application, le programme Windows, les services qu'elle appelle, la liste des documents.
2. `ARCHITECTURE.md` : les quatorze règles d'architecture, citées « règle N » dans le code, et ce qu'il faut toujours faire en ajoutant du code. À lire en entier avant la première modification.
3. `docs/DEVELOPPER.md` : outils à installer, commandes, construction de l'APK et du programme Windows, recettes des ajouts (un calcul, un réglage, un onglet), ce qu'un changement casse.
4. `docs/GLOSSAIRE.md` : les mots du code qui ne veulent pas dire ce qu'on croit (« course », « mark », famille, activité…). Une page, à lire tôt.
5. Selon ce qu'on touche : `docs/ETAT_DU_PROJET.md` (couches, pipeline, persistance, format du dossier des sessions au §6.1, tests au §8, limites connues, Android au §12), `docs/INVENTAIRE.md` (carte des fichiers), `docs/MISE_EN_PAGE.md` (avant toute page d'analyse).

## Installer et lancer

Node 22.18 ou plus (la plage permise est dans `engines` de `package.json`, la version de départ dans `.nvmrc`), puis `npm ci` à la racine et `npm run dev` : le serveur de développement écoute sur le port 5174. Android (JDK 21, SDK, clé de signature) et Windows (dépendances de `bureau/`) : `docs/DEVELOPPER.md`.

## Vérifier

```
node outils/verif.mjs --rapide    pendant le travail : typecheck, lint, tests touchés par les fichiers modifiés
npm run verif                     avant chaque commit : lint, tous les tests en ordre mélangé, build, renvois des documents
```

Les deux sortent court : quelques lignes si tout passe, sinon les seuls échecs. Le lint refuse le moindre avertissement. En mode complet, l'ordre des tests change à chaque passage ; un échec donne la graine et la commande qui rejoue le même ordre. La même vérification tourne en ligne à chaque envoi vers `main` (`.github/workflows/verif.yml`), avec les tests Java d'Android en plus.

Une partie des tests ne vérifie pas un calcul mais une règle du dépôt :
- `src/architecture.test.ts` : le sens des dépendances entre les dossiers de `src/` (`core` vers les domaines, puis `settings`, `hooks`, `components`, `pages`) ; les API de l'appareil seulement dans `src/platform/` (règle 12) ; aucun nom de calcul comparé en dur hors de ses tables ; aucun renvoi numéroté à un suivi de tâches dans `src/` (règle 14) ; les adresses des deux familles (règle 9) ; la porte d'import d'une ancienne application (règle 13) ;
- `src/i18nGuard.test.ts`, qui lit `outils/i18n.mjs` : chaque texte traduit a une clé littérale, et les dictionnaires anglais et espagnol n'ont ni clé manquante, ni traduction orpheline, ni variable ou balise différente du français ;
- `src/theme/inlineStyles.test.ts` : le nombre de `style={{` par fichier `.tsx` ne remonte pas (relevé `outils/styles-en-ligne.json`) ;
- `src/library/summaryFrozen.test.ts` : les chiffres du résumé des sessions sont figés ; un calcul qui les change augmente `SUMMARY_CALC_VERSION`, sans quoi les sessions déjà rangées garderaient l'ancien chiffre.

Un échec de ces gardes se corrige dans le code, pas dans la garde. Leurs listes d'exceptions sont une dette nommée qui ne fait que diminuer : y ajouter une ligne, refiger un relevé à la hausse (`node outils/styles-en-ligne.mjs --figer`) ou refiger le résumé est une décision, à écrire avec sa raison dans le message du commit.

## Conventions qui surprennent

- **Français** : l'interface, les commentaires, les noms des tests, les documents, les outils (`outils/`) et le programme Windows (`bureau/`) sont en français ; les noms du code de `src/` sont surtout en anglais.
- **Texte visible** : toujours par `t` ou `tn` (pluriel) de `src/core/i18n.ts`, ou `tRich` pour une phrase à balises ; la clé est le texte français lui-même, écrit en littéral. Tout texte neuf demande sa traduction dans `src/locales/en.json` et `src/locales/es.json`, sinon la garde échoue.
- **Formats** : nombres à virgule et durées espacées (« 12,4 km », « 1 h 24 ») par `formatDecimal` et `formatDuration` de `src/core/units.ts` ; une valeur absente s'affiche par `MISSING`, jamais par un tiret écrit à la main.
- **Thème** : couleur, police, rayon et espacement passent par les variables de `src/theme/tokens.css` ; pas de valeur en dur dans un écran neuf, pas de style en ligne dans un fichier neuf.
- **Unités** : le noyau (`src/core/`) calcule en unités SI ; la conversion se fait à l'affichage seulement. Exception historique : `src/sailing/` travaille en nœuds (règles 1 et 5).
- **Système** : stockage, fichiers, position, capteurs, Bluetooth, notification et autorisations passent uniquement par `src/platform/`, qui choisit la version navigateur, Android ou Windows (règle 12).
- **Commentaires** : un commentaire tient seul ; il dit la raison en clair, sans renvoyer à un ticket, à une date ou à un document de suivi (règle 14).
- **Tests** : un calcul pur a son `*.test.ts` à côté de lui, sur une trace synthétique fabriquée par le test (décors communs dans `src/test/`). Le dépôt ne contient aucune trace GPS réelle et n'en reçoit pas : une trace réelle porte les lieux et les heures d'une personne. Un calcul à fenêtre de temps se teste à 1 Hz et à 5 Hz (règle 2).

Le détail de chacune, et les autres règles, sont dans `ARCHITECTURE.md`.

## Documents tenus avec le code

Les documents décrivent le code d'aujourd'hui, et la vérification le contrôle : `outils/docs-cites.mjs` refuse un fichier ou un nom cité entre accents graves qui n'existe plus, `outils/docs-inventaire.mjs` refuse un fichier de `src/`, du code Java ou d'`outils/` absent de la carte `docs/INVENTAIRE.md`. Un fichier neuf, renommé ou supprimé se reporte donc dans la carte dans le même commit ; un changement de pipeline, de persistance ou de limite connue, dans la section concernée de `docs/ETAT_DU_PROJET.md`. La disposition du dossier des sessions (§6.1) est le format des données des utilisateurs, partagé par le téléphone, le navigateur et le programme Windows : la lire avant de toucher à `src/library/`.

## Version, fins de ligne, secrets

- **Version** : une seule, `version` de `package.json` (reprise par `package-lock.json`), sous la forme `0.MM.NN`, le dernier nombre sur deux chiffres ; après `.99`, le nombre du milieu augmente. L'APK en tire `versionCode`, qui doit croître, et le programme Windows sa propre version. Elle se monte avant chaque APK ou installeur diffusé ; chaque APK diffusée porte une étiquette annotée `v<version>` sur son commit (`docs/ETAT_DU_PROJET.md`, §12).
- **Fins de ligne** : LF partout, CRLF pour les `.bat` et `.cmd`, fixées par `.gitattributes` ; ne pas les laisser réécrire par un éditeur.
- **Jamais versionnés** : la clé de signature Android (`.jks`) et `android/keystore.properties`, qui donne son chemin et ses mots de passe (`android/keystore.properties.exemple` en donne la forme), ni `android/local.properties`. La clé se garde hors du dépôt et se sauvegarde : perdue, plus aucune mise à jour de l'application installée n'est possible.

## Banc de test

Les tests tournent sous Node, sans navigateur : ils ne voient ni les pages montées ni la mémoire du navigateur. Le banc (`outils/banc/`) pilote l'application dans un Chrome sans fenêtre, ou le programme Windows, et compare le texte des pages avant et après un changement : il prouve qu'un changement est neutre, ou qu'un écran affiche ce qu'il doit. À lancer après un changement d'interface, de mise en page ou de mémoire, avant de le livrer ; mise en place et lanceur dans `outils/banc/LISEZMOI.md`, chaque script dans `outils/banc/SCRIPTS.md`.

## Ce qui ne se change pas sans plan

Certains noms portent les données des utilisateurs ou l'identité de l'application : l'identifiant Android (`appId`), la clé de signature, l'identité du programme Windows après sa première diffusion (`ID_PROGRAMME`, nom du profil, adresse servie), `versionCode`. Changés, ils installent une seconde application à côté de la première ou font repartir l'utilisateur de zéro. La liste et les conséquences : `docs/DEVELOPPER.md`, « Ce qu'un changement casse ». De même, l'`id` d'un panneau d'analyse est la clé de sa taille mémorisée, et les clés de stockage de l'appareil (`docs/ETAT_DU_PROJET.md`, §6.2) sont lues par les versions installées.
