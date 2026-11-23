# Gtracker

Analyse de sessions de voile (wingfoil, planche, kite, bateau) et de surf à partir de traces GPX, et enregistrement GPS sur le téléphone. Application 100 % client, sans backend à nous : les traces et les sessions ne partent jamais sur internet, mais l'application interroge des services publics (liste plus bas). Elle tourne dans le navigateur et, emballée par Capacitor, sur Android, avec enregistrement GPS natif, ceinture cardio Bluetooth et mémoire en dossier portable.

Deux familles d'activités, chacune avec sa page d'analyse (carte, graphes, meilleurs segments, notes) : **Avec vent** (wingfoil, planche, kite, bateau) et **Sans vent** (surf, surf foil). Toutes les sessions sont dans une seule liste, **Sessions**, filtrable par activité. Autour : **Enregistrer**, **Planifier** (parcours de balises en ligne droite, import et export GPX), **Statistiques** (onglets général, graphique, régularité, records, cardio), **Profil** et **Réglages** (avec le test de FC repos).

## Mémoire

Les sessions vivent dans un dossier ordinaire, `Gtracker` : un GPX et une fiche JSON par session dans `sessions/`, et un fichier de réglages par appareil dans `reglages/`. On le copie pour sauvegarder ou pour passer du téléphone au PC. Sur Android, il se désigne une fois (en principe `Documents/Gtracker`) ; dans le navigateur, c'est la mémoire privée du navigateur ou un dossier choisi (Chrome, Edge).

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
npx vitest run       tous les tests, fonctions pures uniquement, environnement node
npx vitest run src/sailing/wind.test.ts -t "nom"   un fichier, un test
npm run build        tsc -b && vite build
```

## Documentation

- `CLAUDE.md` : règles d'architecture, conventions et décisions transverses.
- `docs/ETAT_DU_PROJET.md` : pipeline, persistance, dette, chantiers, avancement du plan mobile (§12).
- `docs/DECISIONS.md` : décisions de l'utilisateur propres à chaque domaine.
- `docs/HISTORIQUE.md` : décisions et pièges, en points numérotés.
- `docs/INVENTAIRE.md` : carte des fichiers.
- `docs/MISE_EN_PAGE.md` : patron commun des pages d'analyse.
- `docs/MODELES.md` : quel modèle et quel effort pour quelle tâche, sous-agents de `.claude/agents/`.
- `docs/DEVELOPPER.md` : construire l'application (Node, JDK 21, signature, APK, hébergement web).
- `docs/INSTALLATION.md` : installer l'APK sur un téléphone Android, pour les testeurs.
- `outils/banc/LISEZMOI.md` : banc de test dans un Chrome sans fenêtre, mode d'emploi.
