# 311 · Écran de démarrage GONG

Modèle | Réflexion : Sonnet | medium

## Tel que noté

Décisions de l'utilisateur du 08/11 sur la maquette du logo (`docs/backlog/310-logo-gong.md`) : fond noir, logo GONG complet blanc centré, signature « Live for it. » dessous. L'ouverture de l'application doit suivre son icône.

## Sources (hors dépôt, lecture seule)

`D:\gong tracker\gong\da\assets\logo\` : `gong-logo-full.svg` (logo complet), `gong-symbol.svg`. Ne rien y écrire.

## Aujourd'hui (vérifié le 13/11)

`assets/splash.png` à la racine du dépôt, et onze `splash.png` sous `android/app/src/main/res/` : `drawable/`, `drawable-port-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`, `drawable-land-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`. Lis `docs/backlog/310-logo-gong.md` pour la façon dont l'icône a été produite, et le thème de lancement dans `android/app/src/main/res/values/styles.xml` (et `values-night`, s'il existe) pour la couleur de fond.

## Voulu

1. Les douze images refaites, chacune à la taille exacte de celle qu'elle remplace (même largeur, même hauteur, PNG) : fond noir uni (#000000), le logo GONG complet en blanc, centré, « Live for it. » dessous en blanc, police Inter grasse (celle de l'application), le tout dans la zone centrale pour ne pas être rogné sur un écran étroit ou tourné (bloc logo et signature dans le tiers central, largeur du logo vers 40 % du petit côté).
2. Le fond de la fenêtre de lancement noir, de jour comme de nuit, pour qu'aucun éclair blanc ne précède l'image (thème de lancement Android), sans changer le thème de l'application une fois ouverte.
3. Le logo n'est pas redessiné : c'est le SVG fourni, tel quel, mis en blanc.

## Façon de faire

Pas d'outil d'image dans `node_modules` : rendre chaque image par le Chrome sans fenêtre du banc (`outils/banc/cdp.mjs`), une page HTML à la taille voulue puis une capture PNG, par un script jetable rangé dans le dossier temporaire de la session, pas dans le dépôt. Vérifie les dimensions de chaque fichier produit, et regarde au moins une image en portrait et une en paysage.

## Ne pas faire

- Ne pas toucher à l'icône de l'application, ni à `src/`, ni à `docs/` hors de ce brief, ni à `CLAUDE.md`, ni à `package.json` ; ni commit ni version ; ne pas construire d'APK.
- D'autres agents travaillent en même temps dans le même dépôt, sur `src/` et `outils/banc/` : ne touche qu'à `assets/` et `android/app/src/main/res/` ; jamais de `git stash`, `checkout`, `restore` ni `clean` ; ignore un fichier modifié qui n'est pas le tien.

## Rapport attendu

Le rapport habituel, avec : la liste des fichiers refaits et leurs dimensions, le changement du thème de lancement, le chemin de deux images à regarder (portrait et paysage).
