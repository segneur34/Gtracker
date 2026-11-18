# 445 · Plan de la coquille nue (étude coquille, lot A)

Plan du 18/11/2026, fait par l'agent de plan, confronté aux décisions par l'orchestrateur. L'étude `445-exe-etude-coquille.md` reste la référence pour le détail (§2 la coquille, §3 la fabrication, §4 la preuve) ; ce plan prime là où il la contredit.

## Ce qui change par rapport à l'étude : l'adresse de l'application

Les tuiles (`src/platform/tileCache.ts`) et les vignettes (`previewImages.ts`, `previewStore.ts`) sont rangées dans le Cache API sous des adresses relatives. Sous `app://gtracker`, `cache.put` refuse toute adresse qui n'est ni `http` ni `https`, et `tileCache` avale ses erreurs : les deux caches seraient morts sans message. Piste retenue : intercepter `https` (`protocol.handle('https')`) et servir l'application sur un hôte réservé (`https://gtracker.localhost`), les autres hôtes repartant sur le réseau par `net.fetch(req, { bypassCustomProtocolHandlers: true })`. On garde le contrôle de chemin, le repli sur `index.html` et l'en-tête CSP de l'étude. **La première étape le prouve avant tout le reste** ; l'origine retenue ne changera plus jamais (la mémoire du navigateur du .exe y est attachée).

Inchangé dans l'application : `BrowserRouter` (le repli sur `index.html` suffit), `base` de Vite à `/`, `isNativeApp()`, aucune ligne de `src/`. Dossier de profil `Gtracker` (`app.setName`, donc `%APPDATA%\Gtracker`).

## Fichiers

À créer :
- `bureau/package.json` : `electron` épinglé, `@electron/packager`, `@electron/fuses` en dépendances de développement ; champ `version` figé, la vraie est posée à l'emballage.
- `bureau/tsconfig.json` : CommonJS, sortie dans `bureau/dist/`, `tsc` de la racine lancé avec `-p bureau`.
- `bureau/origine.ts` : l'hôte, écrit une seule fois (protocole, verrou de navigation, et plus tard contrôle de l'expéditeur des messages).
- `bureau/protocole.ts` : le chemin dans `dist/` en fonction pure, la CSP ; `bureau/protocole.test.ts` : chemins refusés (`..`, absolu, lettre de lecteur), repli sur `index.html`.
- `bureau/main.ts` : instance unique, fenêtre retenue, menu retiré, agent HTTP `Gtracker/<version>` ; `will-navigate` verrouillé, `setWindowOpenHandler` qui envoie les liens `https:` au navigateur de Windows ; autorisations refusées par défaut (journalisées en mode d'essai) ; `will-prevent-unload` qui demande « Quitter sans enregistrer ? ».
- `bureau/preload.ts` : un seul fichier, `sandbox: true`, n'expose que `gtrackerBureau.version`.
- `outils/bureau.mjs` : lit la version de `package.json` racine et la convertit (`0.01.40` → `0.1.40`, `0.10.05` → `0.10.5`), lance `vite build`, `tsc -p bureau`, le packager (`appVersion`, `buildVersion`, `extraResource: ../dist`, asar, icône), coupe les fusibles (`RunAsNode`, `NodeOptions`, `NodeCliInspect`), retire `ELECTRON_RUN_AS_NODE` avant de lancer quoi que ce soit ; `outils/bureau.test.mjs` : la conversion de version.

À toucher : `.gitignore` (`bureau/sortie/`), `package.json` racine (scripts `bureau` : essai sur `dist/` ; `exe` : dossier `bureau/sortie/Gtracker-win32-x64/`). Rien dans `docs/` hors cette fiche, rien dans `src/`, rien dans `fin-de-lot.mjs` (la version suit seule).

Gardes : `oxlint` lit `bureau/*.ts` ; `tsc -b` ne voit pas `bureau/` ; `vitest` prend `bureau/*.test.ts` et `outils/*.test.mjs` ; `src/heritage.test.ts` lit `outils/` (le nom toujours avec son G, règle 13). Les gardes de `src/` ne s'étendent à `bureau/` qu'au lot 446.

## Parties

**Partie A (Opus/high) : la sonde puis la coquille.**
1. Sonde : `npm install` dans `bureau/`, un `main.ts` minimal servant `dist/` sous `app://gtracker` et sous l'hôte `https` ; dans chaque fenêtre, évaluer `caches.open` puis `put('/a', …)`, `navigator.storage.persist()`, OPFS, le travailleur, un `fetch` de tuile. Retenir l'origine et écrire le résultat dans cette fiche (« Résultat de la sonde »).
2. Coquille complète, scripts et tests. Vérifier : `npm run bureau` ouvre l'application ; `npm run exe` produit le dossier ; `ELECTRON_RUN_AS_NODE=1` ne casse pas le .exe emballé ; un lien externe ouvre le navigateur ; `node outils/verif.mjs --rapide`.
3. Mode d'essai prêt pour le banc : `GTRACKER_BANC=1`, `GTRACKER_PROFIL=<dossier>`, fenêtre 1400 × 1000 cachée, `backgroundThrottling: false`, `--remote-debugging-port` accepté seulement avec `GTRACKER_BANC` (sinon quitter), `GTRACKER_BANC_QUITTER=non` pour répondre seul à la question de fermeture, journal de `will-prevent-unload`.

**Partie B (Sonnet/high) : le banc branché sur le .exe.** Option `--exe <Gtracker.exe>` de `passe.mjs` (ou `outils/banc/exe.mjs`) : une instance par script avec son profil, `--lang=fr-FR`, lecture de `/json/list`, `BANC_WS` et `BASE=https://<hôte>` posés, `taskkill /T`. Référence : Chrome sur le même `dist/` servi par `vite preview`. Exclus : `shots.mjs`, le mode `isolated`. À constater : `Network.setBlockedURLs` et `lib/tuiles.mjs` sous interception `https` ; `Page.javascriptDialogOpening`. Ordre : `general`, `import-session` (les deux voies de l'étude, §2.8), puis `PASSAGE_COURANT`. Attendu : relevés identiques, console vide, aucune violation de CSP. Puis les deux derniers non-prouvés : fermeture avec brouillon (`brouillon-voile`, puis `taskkill /PID` sans `/F`, la fenêtre doit rester) ; poids (dossier `sortie/`, son ZIP, mémoire vive, `node_modules` de `bureau/`).

## Tranché par l'orchestrateur (18/11)

- Hôte `gtracker.localhost`, si la sonde le confirme ; sinon l'agent propose et rend un rapport BLOQUÉ.
- `@electron/packager`, pas electron-builder ; l'installeur reste au 451.
- `tsc -p bureau` dans `outils/verif.mjs`, seulement si `bureau/node_modules` existe.
- Textes de la coquille en français seulement jusqu'au 446.
- La coquille quitte si `--remote-debugging-port` est donné sans `GTRACKER_BANC`.
- Les vraies sessions de l'utilisateur n'entrent pas dans le .exe avant le 446 (la mémoire sur le disque) : le .exe du 445 s'essaie à vide ou avec un fichier d'essai.

## Essais pour l'utilisateur, sur son PC

La croix avec un brouillon en attente (la vraie boîte de dialogue) ; le premier lancement face à SmartScreen ; une carte vue puis relancée hors réseau (tuiles gardées).

## Laissé prêt pour le 446, sans le construire

Preload isolé déjà chargé sous `sandbox` ; `origine.ts` ; `protocole.ts` comme modèle des contrôles de chemin ; tests de `bureau/` pris par Vitest ; lanceur du banc qui passe un profil ; origine et dossier de profil figés.

## Résultat de la sonde (18/11, Electron 45.3.4, `dist/` du dépôt, profil temporaire, fenêtre cachée, CSP de l'étude posée)

- **Origine retenue : `https://gtracker.localhost`**, `https` intercepté, les autres hôtes repartis sur le réseau par `net.fetch(req, { bypassCustomProtocolHandlers: true })`.
- Sous `app://gtracker` : `caches.open` puis `put('/a', …)` échoue, « Request scheme 'app' is unsupported » (le constat du plan, mesuré) ; une clé absolue `https://…` passe. Tout le reste marche.
- Sous `https://gtracker.localhost` : contexte sûr ; `put('/a')` et `put` d'une tuile absolue relus ; `navigator.storage.persist()` vrai ; OPFS écrit et relu ; `localStorage` et IndexedDB ; un travailleur servi par la coquille répond, le travailleur de l'application (`trackWorker`, module) se charge sans erreur ; une tuile d'OpenStreetMap lue (200, image/png) et rangée au cache ; quota annoncé de l'ordre de 100 Go.
- La page d'ouverture s'affiche (« Gtracker Profil Sessions … Bienvenue ») ; les adresses profondes (`/sessions`, `/voile/analyse`) rechargées dans la même fenêtre rendent `index.html` ; console sans erreur.
- Pourquoi `.localhost` : domaine réservé (RFC 6761), jamais attribué sur Internet, donc jamais en conflit avec un vrai site ; si l'interception manquait, Chromium l'enverrait à la machine elle-même, pas au réseau.
- Écart vu, sans effet sur la coquille : dans la sonde, une seconde fenêtre ouverte après la destruction de la première échoue à charger (ERR_FAILED), sous les deux origines, même sans rien évaluer ; la coquille n'a qu'une fenêtre, le banc une instance par script.
- Lecture des fichiers de `dist/` : `fs` et `Response` plutôt que `net.fetch(file://)`, pour poser soi-même le type et la CSP (les deux marchent).

## Mesures de la partie B (18/11, programme 0.01.40 refabriqué, Electron 45.3.4)

Commande : `node outils/banc/passe.mjs [noms…] --exe bureau/sortie/Gtracker-win32-x64/Gtracker.exe -j 1` (mode d'emploi : `outils/banc/LISEZMOI.md`, « Programme Windows »). « Avant » = Chrome sur `vite preview` qui sert le `resources/dist` du programme, « après » = une instance du programme par script.

**Passage courant** (26 scripts, 24 min à `-j 1`) : 3 écartés (`sauts`, `virages`, `pumping` importent `/src/`, absent du build de production) ; sur les 23 joués, 19 relevés identiques au caractère près (dont `general`, `graphes`, `cardio`, `library`, `import-session`, `statistiques`, `session-save`), console vide des deux côtés, aucune violation de la politique de contenu ni requête bloquée par elle. Quatre scripts échouent sur le build de production **des deux côtés** (`profil` 6 échecs, `import-session` 2, `apropos` 2, `tutoriels` 5) : ils supposent le serveur de développement. Quatre différences, toutes expliquées, aucune ne vient de la page ni de la politique de contenu :
- `general` : la boussole de réglage centrée à 692,4 px au lieu de 700 : barre de défilement de 15 px de la fenêtre. `apropos` : bordure de 1 px mesurée 0,8 px : écran du poste à 125 %. Réglé du côté du banc (`--force-device-scale-factor=1`, `--hide-scrollbars`) ; ensuite identiques.
- `planning` : distance des balises posées par clic sur la carte, 6,50 km sous Chrome contre 6,78 (fenêtre 1382 × 953) puis 6,55 km (page remise à 1382 × 904 comme Chrome) ; reste d'écart non expliqué (géométrie de la carte ou tuiles réelles chargées sous Chrome, refusées dans le programme).
- `surf`, `cacher` : « © OpenStreetMap » sous Chrome, « Carte… » dans le programme, dans la liste des sessions (la vignette n'est pas finie à l'instant du relevé). `cacher` ne bloque pas le réseau : Chrome charge les vraies tuiles, le programme n'en reçoit aucune, d'où l'écart (et un `check` de plus qui échoue, « profil identique au départ »). `surf` bloque le réseau : l'écart de la première passe a disparu à la seconde (identique), c'est l'instant du relevé.
- `lieu` : 27 échecs, voir ci-dessous.

**`Network.setBlockedURLs` et `Fetch` sous l'interception `https`** (sonde sur un hôte `.invalid`, Chrome contre programme) : `setBlockedURLs` bloque bien dans le programme (raison « inspector », comme sous Chrome). `Fetch.enable` ne voit **aucune** requête de la page : elles passent par le gestionnaire de la coquille dans le processus principal, pas par le réseau du navigateur. Conséquences : `lib/tuiles.mjs` et `lib/lieux.mjs` (fausses tuiles, faux lieux) ne servent à rien dans le programme, et une requête non bloquée partait pour de bon (`lieu` a reçu le vrai service de lieux et en a tiré « Mauguio » ; `exe-tuiles`, la première fois, a chargé de vraies tuiles d'OpenStreetMap, quelques dizaines de requêtes, avant la correction). Corrigé dans la coquille, mode d'essai seulement : les hôtes autres que le sien sont refusés et journalisés (« réseau refusé »), le banc n'atteint jamais le réseau réel. Les scripts qui importent ces deux bibliothèques sont écartés du passage du programme. `confirm` : `Page.javascriptDialogOpening` fonctionne (`library`, `session-save`, `session-save-resume`, `planning` identiques).

**Import** : les deux voies de l'étude (§2.8), `exe-import` identique sous Chrome et dans le programme. Trois GPX donnés au champ des GPX (`DOM.setFileInputFiles`) : trois sessions ajoutées. Une liste de GPX donnée au champ « dossier » (`webkitdirectory`) : le champ garde **0 fichier**, aussi sous Chrome : le raté du 12/11 vient du protocole de débogage, pas de la coquille. `import-session` (voie par `File` dans la page) identique, mêmes 2 échecs des deux côtés.

**Tuiles gardées** (`exe-tuiles`, sans réseau réel : adresse des tuiles réglée sur `favicon.png` de l'application) : la carte demande ses tuiles, des entrées sont rangées dans le Cache API (`gtracker-tuiles`, clés `https://gtracker.localhost/tuiles-gardees/…`), puis, adresse coupée et page rechargée, 10 images se dessinent depuis le cache ; relevé identique à Chrome. Avec les vraies tuiles d'OpenStreetMap (premier essai), 26 entrées gardées pour 27 demandées.

**Fermeture avec un brouillon** (`outils/banc/exe-fermeture.mjs`, `taskkill /PID` sans `/F`, vrai clic du protocole d'abord) : sans brouillon, le programme se ferme ; avec un brouillon (vent saisi, barre « Enregistrer la session ») et `GTRACKER_BANC_QUITTER=non`, la fenêtre reste, la page répond, le journal dit « fermeture retenue par la page : rester » ; avec `oui`, il dit « quitter » et le programme se ferme. La vraie boîte (« Quitter » / « Rester ») ne se voit qu'à la main. **À vérifier à la main** : après un `Page.navigate` ou un rechargement de la page, la demande de fermeture ne ferme plus la fenêtre cachée du mode d'essai (même sans brouillon, avec un client de débogage minimal ; cause non établie). L'application recharge la page (`deviceSettings.ts`, remise à zéro, garde d'erreur) : essayer la croix sur la fenêtre visible après un tel rechargement.

**Poids** : dossier `Gtracker-win32-x64` 362 Mo (dont l'application `resources/dist` 5 Mo, la coquille `app.asar` 22 Ko, le reste Electron) ; ZIP 160,6 Mo (`tar -a`, compression ordinaire) ; `bureau/node_modules` 389 Mo (développement seulement). **Mémoire vive** (`tasklist`, somme du jeu de travail des 4 processus `Gtracker.exe`, qui compte deux fois les pages partagées) : 492 Mo page d'ouverture, 529 Mo avec l'analyse d'une session de voile d'une heure ouverte.

**Corrections à la coquille** (`bureau/main.ts`, mode d'essai seulement) : page de 1382 × 904 (`useContentSize`) pour égaler Chrome sans fenêtre ; hôtes autres que le sien refusés et journalisés. Rien de changé hors du mode d'essai.

## Fermeture après rechargement

- **Cause** : artefact du mode d'essai, pas un défaut de la coquille. Après tout chargement de document (`Page.navigate`, `Page.reload` ou `location.reload()` de la page), Chromium ajoute au processus une seconde fenêtre cachée sans titre (`Chrome_WidgetWin_0`), placée avant celle de l'application dans la liste de Windows ; les deux étant cachées, `taskkill` sans `/F` envoie sa demande à celle-là, et la fenêtre de l'application ne la reçoit jamais (aucun événement `close` dans la coquille). Client de débogage attaché ou non : même résultat.
- **Preuve** (Electron non emballé puis .exe refabriqué) : fenêtre cachée, rechargement par le protocole ou par la page, puis `taskkill` : reste ouverte ; la même fenêtre montrée (`GTRACKER_BANC_MONTRER`, `1` ou `transparente`) : fermée après `location.reload()` comme après `Page.navigate` ; fenêtre cachée rechargée fermée par `window.close()` ; liste des fenêtres du processus relevée avant et après le rechargement.
- **Banc** : `exe-fermeture` joue en plus D, E et F, page rechargée par elle-même, fenêtre transparente : sans brouillon fermée ; brouillon et « Rester » : reste, brouillon gardé ; brouillon et « Quitter » : fermée. Tout passe. La croix de la fenêtre visible n'est pas touchée par ce piège ; reste l'essai à la main de la vraie boîte de dialogue.
