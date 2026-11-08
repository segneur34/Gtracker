# 310 · Logo et icône de Gtracker à partir du logo GONG

Noté le 08/11 (décision de l'utilisateur : le logo de l'application est celui de GONG ; aucune APK installée avant). Maquette validée le 08/11 : https://claude.ai/artifact/4E1k2LpoTJfuAmkNnVL3iD (privée). Modèle | Réflexion : Sonnet | medium. Brief du DA GONG : `D:\gong tracker\gong\da\DA_GONG_GALAXY_PROMPT.md`, § 5 « Logos & assets de marque » (symbole centré, marge ≈ 22 %, **noir ou blanc seulement**, jamais une autre couleur).

## Décisions de l'utilisateur (08/11, sur la maquette)

1. **Icône de lanceur** : variante inversée, **symbole GONG noir sur fond blanc** (pas blanc sur noir).
2. **Accueil et barre du haut** : le **logo GONG complet** (symbole + mot « GONG ») **suivi du mot « Gtracker »**, pas le logo seul.
3. **Écran de démarrage** : pas dans ce lot (n° 311, plus tard ; il portera la signature « Live for it. »). `assets/splash.png` et `drawable*/splash.png` ne bougent pas.
4. Image de partage : le pied suit l'accueil (logo GONG + « Gtracker »).

## Sources (lecture seule, à copier dans le dépôt)

`D:\gong tracker\gong\da\assets\logo\` : `gong-symbol.svg` (viewBox 0 0 46 41, `fill="currentColor"`), `gong-logo-full.svg` (viewBox 0 0 235 41, idem), `favicon.svg` (symbole noir, blanc en `prefers-color-scheme: dark`). Chaque fichier porte un gros bloc `<metadata>` C2PA en base64 : le retirer dans la copie (garder `<title>`), et ne jamais modifier les originaux dans `gong\da\`. Ne rien toucher non plus dans `C:\Users\segne\tracker`.

Dans le dépôt : `src/assets/logo/gong-symbol.svg` et `src/assets/logo/gong-logo-full.svg` (importés par Vite, `?url` ou en composant React ; choisir la forme la plus simple qui laisse la couleur suivre `currentColor`, donc un composant SVG inline), `public/favicon.svg` (copie du favicon GONG). En tête de chaque SVG copié, un commentaire d'une ligne : « Logo GONG Galaxy, marque de GONG SUP ; reproduit pour la version de Tracker proposée à GONG (fiche 153 pour les crédits à la livraison). »

## Ce qui change, fichier par fichier

- **Android, icône adaptative** : `android/app/src/main/res/drawable/ic_launcher_background.xml` → fond blanc uni (`#FFFFFF`, sans la grille du gabarit). `mipmap-*/ic_launcher_foreground.png` : symbole noir centré, largeur ≈ 37 % de la couche de 108 dp (soit 56 % du cercle visible de 72 dp, marge de 22 %). `mipmap-*/ic_launcher.png` (carré arrondi blanc, rayon ≈ 20 %, symbole 56 %) et `ic_launcher_round.png` (disque blanc, symbole 56 %) pour les anciens Android. `mipmap-anydpi-v26/` inchangé.
- **Outil** : `outils/logo/icones-android.mjs` refait en place (pas de fichier nouveau) depuis `src/assets/logo/gong-symbol.svg` : les PNG ci-dessus, `public/favicon.png` (192 px, symbole noir sur blanc, repli des navigateurs sans SVG) et `outils/icone-tracker.ico`. Il faut `sharp`, absent du projet : l'installer dans un dossier de brouillon hors du dépôt (`%TEMP%\gtracker-sharp`, `npm i sharp`) et lancer le script depuis ce dossier, comme son en-tête l'explique ; mettre l'en-tête à jour (sources GONG, règles de marge, fond blanc). `assets/icone.svg` (ancienne icône) : supprimé ; `assets/logo.png` reste (écran de démarrage, lot 311).
- **Web** : `index.html` : `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` avant le PNG, `<title>Gtracker</title>`. Vérifier qu'aucun test ne fige le titre « Tracker » (`grep -rn "<title>" src`).
- **Accueil** (`src/pages/Home.tsx`, `Home.css`) : le `<h1 class="home-logo">` devient une ligne : logo GONG complet en blanc (hauteur 28 px, `fill: currentColor`, ombre portée par `filter: drop-shadow(...)` aux valeurs du `text-shadow` de `.home-header`, car `text-shadow` n'atteint pas un SVG), puis « Gtracker » (police `--font`, graisse 700, capitales espacées `--title-spacing`, taille `--text-xl`), puis la version comme aujourd'hui. Le `h1` garde un texte lisible : `aria-label="GONG Gtracker"` sur le `h1`, `aria-hidden` sur le SVG. Règle CLAUDE.md : aucune valeur en dur, les tailles neuves deviennent des variables de `tokens.css` (`--logo-height: 28px`, `--brand-height: 20px`).
- **Barre du haut** (`src/components/AppShell.tsx`, `AppShell.css`) : `.shell-brand` (Link vers `/`) : logo GONG complet noir (`var(--ink)`, 20 px de haut) puis « Gtracker » (même style que l'accueil, taille `--text-l`). Sur téléphone la barre du haut n'existe pas : rien à faire.
- **Image de partage** (`src/components/drawShareImage.ts`, pied, vers la ligne 236) : « TRACKER » en Shrikhand → le logo GONG complet dessiné par `Path2D` depuis le `d` du SVG (235 × 41, mis à l'échelle sur 26 px de haut, origine à `margin`, base alignée sur `footerY`), rempli `--faint`, puis « Gtracker » (`600 26px ${family}`, même couleur) à droite du logo avec un écart de 14 px ; le pseudo reste à droite. Mettre le `d` du logo dans un module partagé (`src/assets/logo/gongLogoPath.ts`, exporté par le composant et lu par le dessin) pour n'avoir qu'une source.
- **Police Shrikhand** : après le lot, `--font-logo` n'est plus utilisé que par `src/pages/SettingsPage.css:297` ; regarder ce que c'est. Si c'est le seul emploi, remplacer par `--font-title` et retirer Shrikhand (`src/theme/fonts.css`, fichiers de police, entrée dans `outils/licences-hors-js.mjs` → `public/licences-hors-js.json` régénéré ; `src/core/licenses.test.ts` peut y veiller). Sinon la garder et le dire dans le rapport.
- **Licences hors JS** : ajouter dans `outils/licences-hors-js.mjs` une entrée pour le logo GONG (« marque de GONG SUP, reproduite pour la version proposée à GONG, pas une licence libre »), dans la forme des entrées existantes, et régénérer le JSON.
- **Test léger** : dans `src/platform/androidManifest.test.ts` (ou `nativeConstants.test.ts`, le plus proche), figer : `ic_launcher_background.xml` contient `#FFFFFF` et plus aucune ligne de grille ; `index.html` porte `<title>Gtracker</title>` et `/favicon.svg` ; `public/favicon.svg` existe.
- **Inventaire** : si un fichier de code apparaît (`gongLogoPath.ts`, composant SVG) ou disparaît, ajouter ou retirer sa ligne dans `docs/INVENTAIRE.md`, une ligne dans le style du dossier, pour que `node outils/docs-inventaire.mjs` passe (seule exception à « ne pas toucher docs/ », accordée par l'orchestrateur).

## Vérifications

- `node outils/verif.mjs --rapide` après chaque étape ; tout vert avant le rapport.
- Banc (l'orchestrateur le lance) : `general` et `surf` ; changement de texte attendu : « TRACKER » de l'accueil et de la barre devient « GONG Gtracker » (ou le libellé lisible retenu), rien d'autre.
- Rendu : ouvrir `npm run dev` (port 5174) dans le Chrome du banc ou en mode appareil et vérifier l'accueil à 390 px et la barre à 1280 px ; décrire ce qu'on voit dans le rapport (pas de capture nécessaire).

## À valider sur le téléphone (par l'utilisateur, APK 0.00.01)

- essai : icône Gtracker à côté de celle de Tracker → symbole GONG noir sur blanc, reconnaissable, masque du téléphone respecté ;
- essai : accueil → logo GONG blanc + « Gtracker » + version sur la photo ;
- essai : partager une session en image → pied avec le logo GONG et « Gtracker ».

## Hors du lot

Écran de démarrage (n° 311), crédits et identité à la livraison (fiche 153), re-skin complet aux couleurs GONG (brief DA, après la vente).
