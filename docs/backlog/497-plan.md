# 497 · Programme Windows nettoyé : plan retenu

Plan de l'agent Plan du 23/11, confronté par l'orchestrateur. Brief : section 497 de `493-relecture-avant-vente.md`. Lignes citées : celles du commit `d13131e`.

Le banc construit son programme par `npm run exe` (`outils/bureau.mjs:principal` → `compiler()`, qui écrit dans `bureau/dist` par tsc et `paquetDeLaCoquille`, puis `emballer()`, qui produit `bureau/sortie/Gtracker-win32-x64/Gtracker.exe`). Les scripts `exe-*.mjs`, `memoire-disque.mjs` et `passe.mjs --exe` lancent cet exe emballé (`app.isPackaged` vrai) avec `GTRACKER_BANC=1`, `GTRACKER_PROFIL` et `--remote-debugging-port`. `exe-sansfil.mjs:116` et `exe-synchroniser.mjs:99` chargent `bureau/dist/fauxTelephone.js` depuis le dossier compilé, jamais depuis l'asar. L'installeur recompile tout dans `bureau/sortie/installeur/coquille`. Pour le banc, aucun script ne bouge : seul le `package.json` de `bureau/dist` porte désormais `gtrackerEssai: true`.

## Partie 1 (orchestrateur, faite le 23/11) : B-08 et B-09

Electron 45.4.1 (dernière 45.x lue en ligne le 23/11), `bureau/node_modules` et `bureau/package-lock.json` régénérés en ligne, chaque entrée du verrou portant son empreinte (315 entrées, aucune sans). Piège relevé : le paquet electron 45.4.1 n'a plus de script d'installation, `npm install` ne télécharge donc pas le binaire ; `node node_modules/electron/install.js` le fait (contrôle : `node_modules\electron\dist\version` dit 45.4.1). À écrire dans l'étape de la fiche 308.

## Partie 2 (agent) : B-04, F-07, garde des empreintes, fiche 308

B-04, mode d'essai. Le marqueur est dans le `package.json` de la coquille, lui-même dans l'asar, verrouillé par le fusible `OnlyLoadAppFromAsar`.
- Fichier neuf `bureau/modeEssai.ts`, pur, sans electron : `essaiPermis({ emballe, paquet })` rend `!emballe || paquet?.gtrackerEssai === true` ; `environnementDeLaCoquille(env, permis)` rend `env` tel quel si le mode est permis, sinon une copie sans aucune clé `/^GTRACKER_/i`.
- `outils/bureau.mjs` : `paquetDeLaCoquille(version, { essai = false } = {})` n'ajoute `gtrackerEssai: true` que si `essai` est vrai ; `compiler({ vite, sortie, essai = true })` le transmet ; `construireInstalleur` appelle `compiler({ vite, sortie: coquille, essai: false })`. L'en-tête dit que `--exe` est le programme d'essai, jamais diffusé.
- `bureau/main.ts` : lire le `package.json` une seule fois, en tête (le contenu de `versionAffichee`, l. 117-127, remonte avant la l. 75) ; `const ENV = environnementDeLaCoquille(process.env, essaiPermis(...))` ; chaque `process.env` devient `ENV` (l. 75-78, 130, 134, 375, 405, 408, 437, 451, 475) ; le nom `BANC` et son sens restent (le lot 496 s'en sert) ; commentaire d'en-tête l. 4-26 mis à jour. Les sous-modules ne changent pas : ils reçoivent `ENV`.

F-07 : `.github/workflows/verif.yml` : avant `npm run verif`, l'étape `- run: npm ci --ignore-scripts` avec `working-directory: bureau` ; pour setup-node, `cache-dependency-path` sur les deux verrous. `outils/verif.mjs:briqueTsc` (l. 140-146) : sans `bureau/node_modules/electron`, la ligne « coquille non vérifiée (dépendances de bureau/ absentes) » ; sous `CI`, c'est un échec.

B-09, garde : `outils/verrous.test.mjs` lit les deux verrous et exige `integrity` sur chaque entrée hors racine et hors `link` ; il tourne dans `npm run verif`, sans ligne de plus à la sortie.

Fiche 308 (`docs/backlog/308-e8-livraison.md`) : une étape « Electron : dernière 45.x avant l'installeur livré » (`npm view electron@45 version`, version exacte dans `bureau/package.json`, `node_modules` et verrou refaits, contrôle des empreintes).

Fichiers de la partie 2 : bureau/main.ts, bureau/modeEssai.ts et modeEssai.test.ts (nouveaux), outils/bureau.mjs (`paquetDeLaCoquille` l. 69-80, `compiler` l. 303-318, l'appel de `construireInstalleur` l. 393, en-tête), outils/bureau.test.mjs, outils/verif.mjs, outils/verrous.test.mjs (nouveau), .github/workflows/verif.yml, docs/backlog/308-e8-livraison.md.

Tests de la partie 2 : `modeEssai.test.ts` (non emballé : permis ; emballé sans marqueur : refusé ; emballé avec marqueur : permis ; refusé : plus aucune `GTRACKER_*` quelle que soit la casse, le reste intact) ; `bureau.test.mjs` (`paquetDeLaCoquille` sans le marqueur par défaut, avec lui sous `{ essai: true }`) ; `verrous.test.mjs` (les deux vrais verrous, et un faux verrou dont l'entrée sans empreinte est citée).

## Partie 3 (agent neuf, après la partie 2, même copie) : D-03, E-03, C-25, contrôle à la construction

- D-03 : le faux téléphone reste où il est, exclu de l'emballage. Dans `outils/bureau.mjs`, après `environnementPropre` (l. 288), deux fonctions pures exportées : `modulesUtiles(lire, departs = ['main.js','preload.js'])` (fermeture transitive des `require("./x")` du JS compilé) et `ignorerHorsModules(utiles)` (vrai pour tout nom autre que `''`, `/package.json` et `/<module utile>.js` ; Packager passe des noms relatifs à barres droites, et une fonction remplace ses exclusions par défaut). `emballer` gagne `ignore: ignorerHorsModules(modulesUtiles(...))`, à l'emballage d'essai comme à l'installeur. Le filtre doit laisser passer ce qu'un autre lot ferait embarquer exprès (lot 498 : un module de calcul regroupé en un fichier) : il suit les `require` relatifs, sans liste figée.
- E-03 : `LANGUES_GARDEES = ['fr','en-US','en-GB','es','es-419']` (en-US sert de repli à Chromium) et `languesAOter(noms)`, pure ; dans `emballer`, un crochet `afterExtract` efface `locales/*.pak` hors de la liste (les fichiers de langue sont dans le binaire extrait, pas dans la copie).
- C-25 : dans `configNsis`, `allowElevation: false,` juste après `perMachine: false,` (l. 265), sans toucher à la suite.
- Contrôle à la construction : `controlerProgramme(dossier, { utiles })`, pure sur une liste de fichiers, lecture séparée ; écarts : `resources/elevate.exe` présent, fichiers `locales` différents des 5 attendus, contenu de l'asar différent de `utiles` plus `package.json` (lu par `@electron/asar` `listPackage` via `importerDuBureau`), `gtrackerEssai` présent dans le `package.json` de l'asar. Appelée dans `construireInstalleur` après `build()` et avant le rangement (l. 406-410) : un écart arrête la construction.

Fichiers de la partie 3 : outils/bureau.mjs (bloc neuf après la l. 288, `emballer` l. 338-362, une ligne dans `configNsis`, `construireInstalleur` l. 406-410), outils/bureau.test.mjs.

Tests de la partie 3 : `configNsis().nsis.allowElevation === false` ; `languesAOter` ; `modulesUtiles` sur une fausse carte ; `ignorerHorsModules` ; `controlerProgramme` (un cas propre, un cas par écart) ; garde sur les sources : la fermeture des imports non-`type` de main.ts et preload.ts couvre tous les `bureau/*.ts` hors tests, sauf exactement `fauxTelephone.ts`.

## Vérification par l'orchestrateur, sur le poste

- `npm run exe`, puis `exe-fermeture`, `exe-sansfil`, `memoire-disque`, `exe-application`, `exe-synchroniser --sansfil`, et `passe.mjs langues apropos reglages exe-import --exe <exe> -j 1` (puis `--langue en` et `--langue es`).
- Installeur : sans elevate.exe, 5 fichiers de langue, asar sans fauxTelephone.js ni `gtrackerEssai` (le contrôle à la construction le dit) ; taille attendue vers 104 Mo avec l'APK.
- Variables ignorées : `bureau\sortie\installeur\Gtracker-win32-x64\Gtracker.exe` lancé avec `GTRACKER_BANC=1`, `GTRACKER_PROFIL=%TEMP%\gtk-ctl` et `--remote-debugging-port=9556` → port muet, `%TEMP%\gtk-ctl` jamais créé ; la même commande sur l'exe du banc ouvre le port.

## Questions tranchées par l'orchestrateur le 23/11

- La vérification en ligne installe les dépendances de `bureau/` (environ une minute de plus par envoi, cache npm sur les deux verrous) : oui.
- Electron mis à jour maintenant, et l'étape écrite dans la fiche 308 pour la livraison.
- Le faux téléphone n'est pas déplacé : l'exclusion par le filtre suffit et ne touche ni au banc ni aux tests.
- Le marqueur d'essai est posé aussi par `--exe`, qui devient explicitement le programme d'essai.
- Le lot 500 ne compte pas sur elevate.exe pour la désinstallation : il demande ses droits par ses propres moyens.
