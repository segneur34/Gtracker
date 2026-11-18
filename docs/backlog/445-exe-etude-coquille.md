# 445 · Gtracker en programme Windows (.exe), mémoire dans un vrai dossier du disque

Étude du 18/11/2026, sans rien coder ni rien installer dans le dépôt. Elle repart de l'étude du 12/11 menée dans l'autre application (`D:\gong tracker\atelier\backlog-clos\exe-ordinateur-etude-tracker.md` et ses trois sources), et la refait pour Gtracker tel qu'il est au commit `673362b` (version 0.01.40).

Décisions de l'utilisateur du 18/11 : le .exe remplace l'usage de Firefox sur son PC (rien à déménager depuis Firefox) ; l'application sera vendue, le .exe doit donc pouvoir être remis à un acheteur plus tard.

Marques employées : **vérifié** (lu dans le code, mesuré, ou lu sur une page officielle ou dans le code source d'un outil le 18/11) ; **supposé** (raisonnement ou souvenir, à confirmer par un essai) ; **non prouvé** (laissé ouvert).

## 0. Résumé

- Le .exe est une troisième coquille autour de la même application compilée (`dist/`), écrite à la main avec Electron (45.3.4, sortie le 17/11/2026, Chromium 156, Node 24). Rien n'est à recoder : Electron embarque Chromium, donc **toute la version « navigateur » de `src/platform/` marche telle quelle dans la coquille** (mémoire privée OPFS, `localStorage`, Cache API, sons, thème, téléchargements). C'est le fait central de l'étude : le cas « ordinateur » n'est pas un troisième code à côté des deux autres, c'est la version navigateur plus quelques ajouts.
- Les ajouts se limitent à : la mémoire dans un vrai dossier du disque, lue et écrite par le processus principal à travers un pont étroit (nouvelle sorte `disk` de `MemoryFolder`) ; les fichiers .gpx et .fit ouverts depuis l'Explorateur (« Ouvrir avec Gtracker ») ; deux ou trois retouches d'écran (Enregistrer, Réglages › Mémoire).
- L'import raté du 12/11 s'explique très probablement par le script d'essai, pas par la coquille : il donnait 126 fichiers au champ « dossier » (`webkitdirectory`), qui n'attend qu'un dossier (détail au §2.8).
- Quatre lots, chacun utile seul : la coquille nue (aucune ligne de `src/` touchée), la mémoire sur le disque, les fichiers reçus et retouches, l'installeur. La vente (signature, Store, mise à jour automatique) vient après et se décidera à part.
- Piège trouvé : la version `0.01.40` n'est pas une version « semver » valide (zéro en tête) ; l'outil d'emballage et le module de mise à jour l'exigent. La coquille doit déclarer `0.1.40` (vérifié avec la bibliothèque `semver` du dépôt : stricte → refusée, souple → `0.1.40`).

## 1. Le cas « ordinateur » dans le code

### 1.1 Un choix à trois sans toucher aux 88 appels

Aujourd'hui `isNativeApp()` (`src/platform/runtime.ts`) vaut `Capacitor.isNativePlatform()` : vrai sur le téléphone, faux ailleurs. Il est appelé environ 90 fois, presque toutes dans `src/platform/` (vérifié : 12 dans `heartRate.ts`, 11 dans `motion.ts`, `location.ts` et `beeper.ts`, 10 dans `memoryFolder.ts`…), et une vingtaine de fois hors de `platform/` (`leaveGuard.ts`, `ImportButtons`, `RecordingPage`, `MemoryStatus`, `PermissionsStatus`, `deviceSettings.ts`, `SessionsPage`, `PlanningPage`, `RoutesPage`, `ProfilePrompt`).

Proposition :

- `isNativeApp()` garde son sens exact, « téléphone » ; aucun de ses appels ne change. Dans Electron, Capacitor n'est pas natif : il y vaut faux, et chaque module prend déjà sa branche navigateur, qui est la bonne.
- `runtime.ts` gagne `isDesktopApp()`, vrai quand le pont de la coquille est présent (`window.gtrackerBureau`, posé par le `preload`), et `appShell(): 'navigateur' | 'telephone' | 'ordinateur'` pour les rares endroits qui veulent les trois cas.
- Le commentaire de `runtime.ts` (« sur le PC, l'application ne voit jamais le téléphone ») devient faux le jour où « Récupérer » lira le téléphone par le câble ; il sera à récrire à ce moment-là.
- Renommer `isNativeApp` en `isPhoneApp` serait plus clair mais toucherait 90 lignes sans rien changer au comportement : écarté.
- Garde : `window.gtrackerBureau` s'ajoute à `PLATFORM_ONLY` de `src/architecture.test.ts`, comme `showDirectoryPicker` : seul `src/platform/` peut lire le pont.

### 1.2 Module par module

Les modules marqués « tel quel » prennent leur branche navigateur dans la coquille, qui est du Chromium 156.

| Module | Dans la coquille | Ce qu'il faut |
|---|---|---|
| `memoryFolder.ts` | Tel quel, il marche déjà : mémoire privée OPFS par défaut, ou dossier choisi par `showDirectoryPicker` (Chromium l'a). Mais l'autorisation d'un dossier choisi doit, dans Chrome, être redonnée d'un clic après un redémarrage, et son comportement dans Electron n'est pas documenté (non prouvé). Et le chemin complet du dossier n'est pas lisible depuis la page. | **Version ordinateur** : sorte `disk`, vrai dossier du disque lu et écrit par le processus principal (Node, `fs`) à travers le pont. Détail au §1.3. |
| `storage.ts` (`jsonStore`) | Tel quel : `localStorage`, gardé par Electron dans le dossier de profil de l'application (`%APPDATA%\Gtracker`). | Rien. Le stockage est lié à l'origine (`app://gtracker`) : ce nom ne doit plus jamais changer, sinon tout repart vide (supposé, conforme à la page officielle du protocole). |
| `tileCache.ts`, `mapTiles.ts` | Tel quel : Cache API (contexte sûr grâce au schéma `secure`), tuiles demandées par `fetch` avec CORS ; OpenStreetMap et Esri répondent déjà à une page d'une autre origine (c'est le cas dans le navigateur aujourd'hui). | Rien dans `src/`. La coquille ajoute à l'agent HTTP `Gtracker/<version> (+https://github.com/segneur34)`, comme `capacitor.config.ts` le fait sur Android (politique d'OpenStreetMap : une application de bureau doit s'annoncer par son nom). |
| `previewStore.ts`, `previewImages.ts` | Tel quel : Cache API. | Rien. |
| `files.ts` | Tel quel : `downloadTextFile` et `saveToDownloads` passent par un lien `download`, qu'Electron transforme en fenêtre « Enregistrer sous » (supposé, comportement par défaut d'Electron). Le journal d'enregistrement reste en mémoire comme dans le navigateur. | Rien au départ. Plus tard, éventuellement, un enregistrement direct dans Téléchargements par le pont. |
| `share.ts` | Le partage du système n'existe sans doute pas dans Electron sous Windows (supposé) : `navigator.canShare` absent, repli sur le téléchargement, déjà prévu. | Rien. |
| `incomingFile.ts` | Rien dans le navigateur. | **Version ordinateur** : un .gpx ou .fit ouvert depuis l'Explorateur arrive au processus principal (ligne de commande, ou seconde instance), qui le met dans une file ; la page la lit par le pont (`liste`, `lire`, `retirer`, événement « reçu »), avec la même suite que sur Android (`hooks/sessionLibrary/incoming.ts`). Association des extensions : §3.3. |
| `permissions.ts` | Sans objet hors du téléphone ; Réglages affiche « Sur l'application Android seulement ». | Rien. |
| `screen.ts` | Tel quel : écran gardé allumé par Screen Wake Lock (Chromium), thème sombre par `matchMedia` (Electron suit le thème de Windows), orientation sans objet. | Rien. |
| `backButton.ts` | Pas de touche retour ; l'historique du navigateur reste celui du routeur. | Facultatif : le bouton « précédent » d'une souris (événement `app-command` de Windows) mené à la même règle que le retour d'Android. Petit confort, pas un besoin. |
| `language.ts` | Tel quel : `navigator.languages` reflète la langue de Windows (supposé). | Rien. |
| `darkScheme.ts`, `systemBars.ts`, `appReset.ts`, `errorText.ts`, `nativeMessages.ts` | Tel quel (branches navigateur ; `appReset` vide les caches du navigateur). | `appReset` : rien de plus, le dossier mémoire sur le disque est vidé par la bibliothèque comme les autres. |
| `beeper.ts`, `compass.ts` | Web Audio et minuteries (tel quel) ; pas de boussole sur un PC. | Rien. |
| `location.ts` | Branche navigateur (`watchPosition`). Dans Electron, la position demande un service de Google et une clé ; elle échouera très probablement (supposé). | Voir « Pages concernées » ci-dessous. |
| `heartRate.ts`, `motion.ts`, `notification.ts`, `recovery.ts` | Sans objet hors du téléphone, déjà neutres dans le navigateur (`heartRateSupported()` faux, capteurs « indisponibles », notification en `console.debug`). | Rien. |

Hors de `platform/`, `deviceSettings.ts` nomme déjà « PC » un appareil qui n'est pas le téléphone : le fichier de réglages du .exe s'appellera `reglages/PC.json`. Firefox n'écrivait rien dans le dossier mémoire du téléphone (mémoire du navigateur) : pas de conflit de nom à craindre (supposé ; si un « PC » existait, la règle des noms déjà pris le renommerait « PC 2 »).

### 1.3 La mémoire sur le disque (sorte `disk`)

L'interface `MemoryFolder` (`list`, `readText`, `writeText`, `readBytes`, `stat`, `writeBytes`, `remove`, `label`, `kind`) se prête telle quelle à un dossier du disque. Ce qui change :

- `MemoryKind` gagne `disk`. Les endroits qui regardent la sorte sont peu nombreux (vérifié) : `MemoryStatus.tsx` (quatre conditions sur `browser` et `picked`), `SettingsFiles.tsx`, `hooks/sessionLibrary/lifecycle.ts` (recopie des sessions de la mémoire du navigateur vers un dossier neuf), `hooks/sessionLibrary/reset.ts`, et le jeu d'essai `src/test/memoryFolder.fixture.ts`. Chacun est à relire pour décider si `disk` s'y comporte comme `picked` (dossier choisi) : c'est le cas presque partout.
- `openMemoryFolder`, `chooseMemoryFolder`, `reconnectMemoryFolder`, `isFolderDesignated`, `forgetChosenFolder`, `canChooseFolder` gagnent une branche `isDesktopApp()`. Le choix du dossier passe par la fenêtre de Windows (`dialog.showOpenDialog`, dossier), ouverte par le processus principal ; le dossier choisi est gardé par la coquille dans son propre fichier de profil (`%APPDATA%\Gtracker\coquille.json`), pas dans `localStorage` : la page ne peut jamais désigner elle-même un chemin.
- Les règles existantes s'appliquent sans changement, puisqu'elles travaillent sur le contenu du dossier : descente dans `Gtracker` si l'on a désigné le parent (`shouldDescendIntoMemory`), refus d'un sous-dossier `sessions` (`isMemorySubfolder`), contrôle de l'appelant (`FolderCheck`, dossier de l'ancienne application).
- Le libellé montre le chemin complet (`dossier « D:\…\Gtracker »`), ce que le navigateur ne peut pas : la phrase de `memoryLabelText` couvre déjà la forme `dossier « … »`.
- Sessions en attente (`pendingFolder`) : sans objet, pas d'enregistrement GPS sur le PC ; reste `null`.
- `pickFolderToImport` (« Ajouter les sessions d'un dossier ») : le champ `webkitdirectory` de `ImportButtons` marche dans Chromium ; on le garde tel quel. Les fichiers passent par l'objet `File` du navigateur, sans le pont.

Le pont, côté processus principal (fichier Node pur, testable sans Electron) :

- une seule racine, celle du dossier désigné, tenue par le processus principal ;
- chaque chemin reçu est relatif, découpé sur `/`, refusé s'il contient `..`, une lettre de lecteur, un chemin absolu, `:` (flux secondaires de NTFS) ou un nom réservé de Windows ; le chemin résolu doit rester sous la racine ;
- écriture sûre comme sur le téléphone : `nom.gtracker-tmp` écrit puis renommé sur `nom` (`fs.rename` remplace la cible sous Windows) ; quelques nouveaux essais courts sur `EPERM` et `EBUSY`, que provoquent un antivirus ou OneDrive qui tient le fichier ;
- `list` rend nom, sorte, taille et date (`fs.stat`), sans les `.gtracker-tmp` ;
- les octets passent tels quels (`Uint8Array`) : le pont d'Electron copie les tableaux d'octets, sans base64 (vérifié dans le principe par la documentation du pont ; taille maximale raisonnable non mesurée, les `.imu` font environ 3 Mo par heure) ;
- chaque message vérifie qu'il vient bien de la page `app://gtracker` (recommandation 17 de la liste de sécurité d'Electron : valider l'expéditeur).

Piège à signaler à l'utilisateur : sous Windows 11, `Documents` est souvent redirigé vers OneDrive. Un dossier mémoire dans OneDrive marche, mais ses fichiers peuvent n'être « que dans le nuage » ou tenus pendant la synchronisation. C'est une raison de proposer l'emplacement plutôt que de l'imposer (question 1).

### 1.4 Ce qui n'a pas de sens sur ordinateur

- **Enregistrer** : la page est aujourd'hui celle du navigateur (choix « GPS du navigateur » ou « Rejeu d'un GPX », lignes 950-970 de `RecordingPage.tsx`) ; ceinture, sauts, pumping et virages y sont déjà masqués hors du téléphone (`native &&`). Dans le .exe, le rejeu marche ; le « GPS du navigateur » ne donnera très probablement rien (supposé : Electron n'a pas de service de position sans clé de Google) et laisserait l'utilisateur face à une erreur. Conseil : masquer ce choix sur ordinateur et garder le rejeu (question 3).
- **Ceinture cardio, capteurs, notification, autorisations, batterie** : déjà neutres hors du téléphone, rien à faire.
- **Test de FC repos** : il demande la ceinture, donc le téléphone ; comportement inchangé par rapport au navigateur.

## 2. La coquille

### 2.1 Où et comment

- Un dossier neuf à la racine, `bureau/`, comme `android/` : `main.ts` (processus principal), `preload.ts` (le pont), `disque.ts` (le dossier mémoire, Node pur), `fichiersRecus.ts`, `protocole.ts`, et **son propre `package.json`** avec `electron` et l'outil d'emballage en dépendances de développement.
- Pourquoi un paquet à part : `npm ci` à la racine resterait léger. Sinon chaque `npm ci` (banc, copies de travail du mode chaîne, `node_modules` des worktrees) téléchargerait le binaire d'Electron (158 Mo pour Windows, vérifié) et `package-lock.json` gagnerait plusieurs centaines de paquets. La coquille ne lit de la racine que `dist/` et la version de `package.json`.
- Compilation de `main.ts` et `preload.ts` : par `tsc` vers `bureau/dist/`, en CommonJS. Le `preload` doit être un seul fichier sans `require` de fichiers voisins, parce qu'il tourne dans le bac à sable (supposé d'après le fonctionnement connu du bac à sable d'Electron : un `preload` isolé n'a pas accès à `fs`, d'où le passage par le processus principal).

### 2.2 Processus principal

- `app.requestSingleInstanceLock()` : une seule fenêtre ; un second lancement (double-clic sur un .gpx) passe son fichier à la première par l'événement `second-instance`.
- Fenêtre unique, taille et position retenues dans le profil de la coquille, fond aux couleurs du thème pour éviter l'éclair blanc au lancement.
- Menu de Windows retiré (`Menu.setApplicationMenu(null)`) : l'application a sa propre barre ; F11 (plein écran) et Ctrl+molette (zoom) peuvent rester par raccourcis. Les outils de développement fermés dans la version diffusée.
- Navigation verrouillée : `will-navigate` refuse tout ce qui n'est pas `app://gtracker` ; `setWindowOpenHandler` envoie les liens externes (mention d'OpenStreetMap, page GitHub de « À propos ») au navigateur de Windows par `shell.openExternal`, seulement pour une adresse `https:` (recommandations 13, 14 et 15 de la liste de sécurité). Sans cela, un clic sur la mention « © OpenStreetMap » remplacerait l'application par le site dans la fenêtre.
- Sortie avec un brouillon non enregistré : `leaveGuard.ts` pose un `beforeunload`. Dans Electron, un `beforeunload` qui refuse bloque la fermeture **sans rien demander** (supposé, comportement connu d'Electron) ; la coquille doit écouter `will-prevent-unload` et poser elle-même la question « Quitter sans enregistrer ? ». Sinon la croix de la fenêtre semblerait ne rien faire.
- Gestionnaire d'autorisations (`setPermissionRequestHandler`) : refuser tout ce qui ne sert pas (caméra, micro, notifications, MIDI…) ; garder ce dont la page a besoin (écran allumé, éventuellement position si on garde ce choix). Par défaut Electron accorde tout (lu sur une analyse de Doyensec, recommandation 5 de la liste officielle).
- Fusibles d'Electron (`@electron/fuses`, ou l'option `electronFuses` d'electron-builder, présente dans sa configuration, vérifié) : couper `runAsNode` dans la version diffusée. C'est aussi ce qui évite le piège du 12/11 (`ELECTRON_RUN_AS_NODE=1` posé par le terminal de l'éditeur, qui fait démarrer Electron comme un simple Node).

### 2.3 Le pont (`preload`)

Réglages de la fenêtre : `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` (les trois sont les défauts actuels, vérifié sur la page de sécurité : défauts depuis Electron 12, 20 et 5), `webSecurity` laissé actif.

Le `preload` expose, par `contextBridge.exposeInMainWorld('gtrackerBureau', …)`, une fonction par message et rien d'autre (la documentation donne en contre-exemple l'exposition directe d'`ipcRenderer.send`, vérifié) :

- `version` ;
- `memoire` : `choisir()`, `ouvrir()`, `oublier()`, `lister(dir)`, `lireTexte(path)`, `lireOctets(path)`, `ecrireTexte(path, texte)`, `ecrireOctets(path, octets)`, `stat(path)`, `effacer(path)` ;
- `fichiersRecus` : `lister()`, `lire(id)`, `retirer(id)`, `surArrivee(rappel)`.

Le type du pont est déclaré une fois (`src/platform/bureau.d.ts` ou dans le module qui le lit), comme la documentation le conseille pour TypeScript.

### 2.4 Chargement de l'application : protocole propre plutôt que `file://`

- `dist/` référence ses fichiers par des chemins absolus (`/favicon.svg`, `/assets/…` : base `/` de Vite) et l'application emploie `BrowserRouter` (vérifié dans `App.tsx`) : chaque adresse (`/voile/analyse?…`) doit rendre `index.html`. Sous `file://`, rien de cela ne marche sans changer la base de Vite et passer à un routeur à dièse, ce qui toucherait l'application.
- La liste de sécurité d'Electron demande de servir les pages locales par un protocole propre plutôt que `file://` (recommandation 18, vérifié).
- Donc : `protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])` avant `ready`, puis `protocol.handle('app', …)` qui sert `dist/` et rend `index.html` pour toute adresse sans fichier. `protocol.handle` est l'API actuelle ; `registerFileProtocol` et `interceptFileProtocol` sont dépréciés (vérifié). Un schéma `standard` est indispensable : sans lui, `localStorage`, IndexedDB et l'accès aux fichiers sont désactivés (vérifié sur la page du protocole).
- Contrôle de chemin : celui de l'exemple officiel (chemin relatif à `dist/` refusé s'il commence par `..` ou s'il est absolu). Le `startsWith(DIST)` de l'essai du 12/11 était plus faible.
- Origine fixée une fois pour toutes : `app://gtracker`. Les essais du 12/11 ont montré, dans cette configuration, OPFS créé, `navigator.storage.persist()` accordé, `localStorage` écrit et une tuile lue (vérifié le 12/11 sur l'autre application, même socle).
- `corsEnabled` n'est pas nécessaire tant que la page ne se demande rien à elle-même par CORS (supposé).

### 2.5 Politique de sécurité du contenu (CSP)

`index.html` n'en a pas (vérifié). Dans la coquille, le gestionnaire du protocole pose l'en-tête lui-même sur `index.html`, sans toucher au fichier (la version navigateur et l'APK ne changent pas). Proposition, à éprouver au banc :

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
connect-src 'self' https:;
font-src 'self';
worker-src 'self' blob:;
object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

- `style-src 'unsafe-inline'` : l'application a des styles en ligne (relevé figé dans `outils/styles-en-ligne.json`) ; sans cela, ils sautent.
- `img-src` et `connect-src` en `https:` entier : les adresses des tuiles sont réglables par l'utilisateur (`gtracker.tileUrls`) ; on ne peut pas lister les serveurs. Ceux du code (vérifié) : `tile.openstreetmap.org`, `server.arcgisonline.com`, `photon.komoot.io` (recherche de lieux).
- `worker-src` : l'application lance un travailleur (`library/trackWorkerClient.ts`, vérifié).
- Une adresse de tuiles en `http:` réglée par l'utilisateur serait refusée : à dire dans le lot, ou à admettre.

### 2.6 Tuiles et agent HTTP

- `session.defaultSession.setUserAgent(<agent par défaut> + ' Gtracker/<version> (+https://github.com/segneur34)')`, la même mention que sur Android.
- Les tuiles sont demandées par la page (`fetch` avec `credentials: 'omit'`, vérifié dans `mapTiles.ts`) : pas de passage par le processus principal nécessaire, OpenStreetMap et Esri répondent déjà aux pages d'autres origines.
- La politique d'OpenStreetMap interdit le pré-chargement en masse ; le cache de Gtracker ne garde que ce qui a été vu (même situation que sur Android, inchangée).

### 2.7 Mise à jour

- `electron-updater` ne met à jour que la cible NSIS (installeur), pas le .exe portable (vérifié le 12/11 dans sa documentation ; la page du 18/11 parle de vérification Authenticode sous Windows, séparée du reste). Il lui faut un dépôt public ou un serveur de fichiers : le dépôt GitHub de l'utilisateur est privé, et un jeton dans l'application serait à proscrire.
- Conseil : pas de mise à jour automatique avant la vente. L'utilisateur installe la nouvelle version par-dessus, comme il le fait pour l'APK. La question se rouvre avec le choix du canal de vente (Store ou site).

### 2.8 L'import raté du 12/11 : cause probable

Relu dans la conversation du 12/11 (script `main2.cjs`, vérifié) : le script cherchait le champ `input[type=file][webkitdirectory]` (« Ajouter les sessions d'un dossier »), lui donnait par `DOM.setFileInputFiles` **la liste des 126 fichiers** du dossier `sessions/`, puis attendait « Import en cours ». Le champ était trouvé et actif (`desactive: false`), mais il gardait **0 fichier** et l'import n'a jamais commencé.

Cause probable (supposée, d'après le code de Chromium tel que je m'en souviens, non relu) : pour un champ `webkitdirectory`, Chromium ne prend que le **premier** chemin donné et l'énumère comme un dossier ; un chemin de fichier ne donne rien, aucun fichier n'arrive et l'événement de changement ne part pas. Il fallait donner **le dossier lui-même** (un seul chemin), ou viser le champ des GPX (`accept=".gpx,.fit"`), qui prend une liste de fichiers : c'est ce que fait `importFiles` du banc (`outils/banc/lib/cdp.mjs`, vérifié), et c'est pourquoi le banc importe sans peine sous Chrome.

Rien n'indique donc un défaut de la coquille ni de l'import. À confirmer au lot A par deux essais au banc : le dossier entier au champ « dossier », et les fichiers au champ des GPX.

Remarque voisine : dans le .exe, un humain qui clique « Ajouter les sessions d'un dossier » voit la fenêtre de choix de dossier de Windows ; ce chemin-là ne passe pas par le banc et ne pose pas de problème connu.

## 3. Fabrication

### 3.1 Outil d'emballage

État vérifié le 18/11 sur le registre npm :

| Outil | Version | Publiée le | Remarque |
|---|---|---|---|
| `electron` | 45.3.4 | 17/11/2026 | Chromium 156, Node 24.22 ; 46 en alpha (Chromium 160) |
| `electron-builder` | 26.18.0 (26.18.1 sur GitHub le 26/10) | 20/10/2026 | vivant ; 27 en alpha |
| `@electron/packager` | 20.3.0 | 11/08/2026 | fait seulement le dossier du programme, sans installeur |
| `@electron-forge/cli` | 8.0.1 | 29/09/2026 | l'outil que la documentation d'Electron recommande ; il enveloppe `@electron/packager` |
| `electron-updater` | 6.8.11 (6.8.12 sur GitHub) | 20/10/2026 | mise à jour, pour plus tard |

Choix conseillé : **electron-builder**, cible NSIS. Raisons :

- installeur « en un clic » **par utilisateur, sans droits d'administrateur** par défaut (`oneClick` vrai, `perMachine` faux, vérifié dans son code) ; les données de l'application ne sont pas effacées à la désinstallation par défaut (`deleteAppDataOnUninstall` faux, vérifié) ;
- cible `portable` disponible (un seul .exe qui s'extrait au lancement, vérifié), et `--dir` pour le seul dossier du programme ;
- seule cible que la mise à jour automatique sait suivre, le jour venu ;
- Forge, mis en avant par Electron, fabrique par défaut un installeur Squirrel.Windows, moins souple pour les associations de fichiers (supposé).

Piège connu : sans droits d'administrateur, electron-builder 26 peut échouer en dépliant l'archive `winCodeSign` (liens symboliques). Le ticket #8149 (vérifié le 18/11) montre que le réglage `toolsets.winCodeSign` existe depuis 26.8 mais que l'ancienne archive était encore téléchargée en 26.8.1 ; la 27 (alpha) change l'outillage par défaut. Parades connues : activer le mode développeur de Windows, ou déplier l'archive à la main dans le cache. Si cela bloque, le lot A peut se contenter de `@electron/packager` (prouvé le 12/11 sur ce poste : 15 s, sans droits d'administrateur) et repousser l'installeur au lot D.

### 3.2 Poids attendu

- Archive d'Electron 45.3.4 pour Windows : 158 Mo en ZIP (vérifié sur GitHub).
- Dossier du programme déplié : environ 360 Mo (mesuré le 12/11 sur l'autre application, dont l'application elle-même pèse 3 Mo ; Gtracker est du même ordre).
- Installeur NSIS : de l'ordre de 85 à 110 Mo (supposé : la compression de NSIS fait mieux que le ZIP ; chiffres de tiers relevés le 12/11). À mesurer au lot D.
- Mémoire vive au repos : environ 390 Mo sur quatre processus (mesuré le 12/11, somme brute).

### 3.3 Association des fichiers .gpx et .fit

- electron-builder sait déclarer des associations (`fileAssociations`), mais **sous NSIS seulement pour une installation pour tous les utilisateurs** (`perMachine: true`, vérifié dans son code : « On Windows (NSIS) works only if nsis.perMachine is set to true »), donc avec droits d'administrateur.
- Pour rester sans droits d'administrateur : écrire l'association dans la partie utilisateur du registre (`HKCU\Software\Classes`) par un petit script NSIS ajouté à l'installeur (`include`), et la retirer à la désinstallation (supposé, technique courante). Windows 11 ne laisse aucune application se déclarer d'office « par défaut » : Gtracker apparaîtra dans « Ouvrir avec », et l'utilisateur choisit (supposé, règle de Windows depuis 10).
- Le .exe portable ne peut pas s'associer proprement : raison de plus pour l'installeur.

### 3.4 Version unique

- La version reste dans `package.json` à la racine. Un script `outils/bureau.mjs` la lit et la passe à electron-builder (`-c.extraMetadata.version=…`), comme Gradle et `capacitor.config.ts` la lisent aujourd'hui.
- Conversion obligatoire : `0.01.40` n'est pas valide en semver strict (vérifié) ; la coquille déclare `0.1.40` (lecture souple). La version affichée dans l'application (`__APP_VERSION__`) reste `0.01.40`. Windows forme le numéro de fichier à quatre nombres (`0.1.40.0`, supposé).
- `outils/fin-de-lot.mjs`, qui augmente la version, n'a rien à changer.

### 3.5 Effet sur les gardes existantes

- **Licences** (`src/core/licenses.test.ts`) : la liste blanche ne regarde que les dépendances de production de `package-lock.json` à la racine (vérifié : les paquets `dev` sont écartés). Electron, dans le `package.json` de `bureau/` et en dépendance de développement, n'y entre pas. Mais le .exe embarque Chromium, Electron et Node : pour une version vendue, « À propos » doit les citer. Electron fournit ses avis de licences avec son binaire (fichier `LICENSES.chromium.html`, supposé d'après souvenir, à relire). Conseil : une ligne « Electron et Chromium (version ordinateur seulement) » dans le complément `public/licences-hors-js.json`, ou un complément propre au .exe ; le test qui compare ce complément au `package-lock` et à `android/variables.gradle` sera à étendre.
- **`src/architecture.test.ts`** : ajouter `gtrackerBureau` à `PLATFORM_ONLY`. Le dossier `bureau/` est hors de `src/`, donc hors des règles de dossiers (`ALLOWED`) et de la règle 14 sur les commentaires ; s'y astreindre quand même.
- **Mots hérités** (`src/landWords.test.ts`, `outils/heritage.json`) et traductions (`outils/i18n.mjs`) : à vérifier s'ils parcourent `bureau/`. Les textes visibles de la coquille (question « Quitter sans enregistrer ? », titre de la fenêtre de choix du dossier) doivent être traduits ; le plus simple est que la page les passe au pont, déjà traduits par `t`.
- **`outils/styles-en-ligne.json`** : aucun effet tant qu'aucun écran neuf n'est écrit ; une retouche de `MemoryStatus` ne doit pas ajouter de `style={{`.
- **Carte d'INVENTAIRE** (`outils/docs-inventaire.mjs`) : une section `bureau/` à écrire à la passe de documentation.
- **`npm run verif`** : ne fabrique pas le .exe (trop long, binaire lourd) ; ses tests unitaires couvrent `bureau/disque.ts` s'il est rangé là où Vitest le trouve (voir §4.2).
- **CLAUDE.md** : la règle 12 parle de « version navigateur ou téléphone par `isNativeApp()` » ; elle deviendra « navigateur, téléphone ou ordinateur ». **DECISIONS §8** dit encore « Sur le PC, l'utilisateur reste sur Firefox » : à récrire après validation, avec la décision du 18/11.

### 3.6 Commandes à ajouter

- `npm run bureau` : compile l'application (`vite build`), la coquille (`tsc -p bureau`), et lance la coquille sur `dist/` pour essayer.
- `npm run exe` : la même chose, puis l'installeur dans `bureau/sortie/` (hors du dépôt par `.gitignore`), nommé `Gtracker-Setup-<version>.exe`.
- Icône : `outils/icone-gtracker.ico` existe déjà (vérifié) ; à vérifier qu'elle porte les tailles 16 à 256 px.

## 4. Preuve

### 4.1 Le banc pilote le .exe

- Electron accepte `--remote-debugging-port` : le banc peut parler à la fenêtre du .exe par le même protocole que Chrome (supposé, comportement connu ; à confirmer au lot A).
- `outils/banc/lib/cdp.mjs` a déjà l'entrée prévue pour cela : `BANC_WS=<adresse websocket d'une page>` le branche sur une page existante au lieu d'ouvrir un onglet (vérifié, « prévu pour un lanceur »). `BASE=app://gtracker` fait naviguer `go('/voile')` dans l'application emballée.
- Ce qu'il faut ajouter : un lanceur (`outils/banc/exe.mjs`, ou une option `--exe` de `passe.mjs`) qui démarre la coquille avec un profil neuf (`--user-data-dir` ou une variable lue par la coquille en mode d'essai seulement), un port de débogage, lit `/json/list`, pose `BANC_WS` et `BASE`, et tue l'arbre de processus à la fin (`taskkill /T`, déjà pratiqué par le lanceur).
- `records()` du banc lit les fiches dans l'OPFS : avec la sorte `disk`, il doit lire le dossier du disque (simple lecture Node du dossier donné à la coquille).
- **Preuve de neutralité du lot A** : jouer le passage courant (`PASSAGE_COURANT`, voile et surf) une fois sous Chrome et Vite comme aujourd'hui, une fois dans le .exe sur `dist/`, et comparer les relevés de texte. Seules différences attendues : aucune, puisque l'application est la même et le moteur aussi (Chromium 156 dans le .exe, la version de Chrome du poste de l'autre côté ; même texte, pas forcément le même pixel).
- **Lot B** : les mêmes scripts sur le .exe, mémoire sur le disque, comparés au lot A ; seuls les libellés de la mémoire changent (chemin complet au lieu de « mémoire de ce navigateur »), à masquer dans le registre.
- Premier essai à faire au banc dans le .exe : l'import, par les deux voies du §2.8.

### 4.2 Tests unitaires

- `bureau/disque.ts` est du Node pur : ses tests tournent dans Vitest sur un vrai dossier temporaire (pas de faux système de fichiers), sans Electron : chemins refusés (`..`, absolu, lettre de lecteur, `:`, noms réservés), écriture par fichier temporaire puis renommage, remplacement d'un fichier existant, `.gtracker-tmp` absents du listage, `stat` d'un absent, effacement d'un absent sans erreur, octets relus à l'identique.
- Côté page, une suite de contrat commune à toutes les sortes de `MemoryFolder` : la même série (écrire, relire, lister, stat, effacer, sous-dossiers créés) jouée sur la sorte `disk` branchée sur `disque.ts` par un faux pont direct, et sur le jeu d'essai existant. Les règles de choix (`shouldDescendIntoMemory`, `isMemorySubfolder`) sont déjà testées et restent communes.
- `vite.config.ts` exclut déjà les copies de travail ; il faudra vérifier que Vitest prend les tests de `bureau/` (ou les ranger sous `src/platform/` pour la partie page, et sous `bureau/` avec une inclusion explicite pour la partie Node).

### 4.3 Essais pour l'utilisateur (peu)

Ce que ni les tests ni le banc ne voient : le double-clic sur un .gpx dans l'Explorateur ; la fenêtre de choix du dossier de Windows ; la fermeture par la croix avec un brouillon ; l'installation et le premier lancement (écran « Windows a protégé votre PC » attendu, .exe non signé).

## 5. État d'Electron vérifié sur le web (18/11/2026)

- Version stable : **45.3.4**, publiée le 17/11/2026, Chromium 156.0.8078.100, Node 24.22.3 (registre npm, GitHub, `releases.electronjs.org`). La 46 est en alpha (Chromium 160). Rythme : une version majeure environ toutes les 8 semaines, les trois dernières suivies (relevé le 12/11) : il faudra suivre, faute de quoi le Chromium embarqué ne reçoit plus ses correctifs.
- Liste de sécurité officielle (20 points, lue le 18/11) : contenu sûr, pas de Node dans la page, isolation du contexte, bac à sable, gestionnaire d'autorisations, `webSecurity` actif, CSP restrictive, navigation et fenêtres limitées, `shell.openExternal` prudent, Electron à jour, expéditeur des messages validé, protocole propre plutôt que `file://`, fusibles, rien d'Electron exposé à la page.
- Protocole : `protocol.handle` est l'API en vigueur ; `registerSchemesAsPrivileged` avant `ready` ; schéma `standard` nécessaire au stockage du navigateur ; l'exemple officiel sert les fichiers par `net.fetch(pathToFileURL(…))` avec un contrôle de sortie du dossier.
- Pont : `contextBridge.exposeInMainWorld` depuis le `preload`, une fonction par message, jamais `ipcRenderer` exposé tel quel ; types déclarés pour TypeScript.
- Emballage : Electron recommande Forge ; electron-builder reste vivant (26.18, 27 en alpha) et plus direct pour un installeur NSIS par utilisateur.
- Accès aux fichiers depuis la page (File System Access) : Electron a ajouté une autorisation `fileSystem` à ses gestionnaires et un événement pour les chemins réservés (commits relevés sur un miroir du dépôt d'Electron). La persistance de l'autorisation d'un dossier d'un lancement à l'autre n'est documentée nulle part : non prouvé, d'où le choix d'une mémoire par Node.
- Le greffon Capacitor vers Electron est à l'abandon (relevé le 12/11, non revérifié) : sans incidence, la coquille n'emploie pas Capacitor.

## 6. Découpage en lots

Chacun est utile seul, vérifiable, et laisse l'application en état de marche. Modèles d'après `docs/MODELES.md`.

### Lot A · La coquille nue (aucune ligne de `src/` touchée)

- **But** : un `Gtracker.exe` qui ouvre l'application telle qu'elle est, mémoire du navigateur (OPFS) ou dossier choisi par Chromium, avec une coquille propre et sûre. L'utilisateur peut quitter Firefox dès ce lot (sa mémoire garantie, contrairement à Firefox).
- **Fichiers** : `bureau/` neuf (`package.json`, `tsconfig.json`, `main.ts`, `preload.ts` presque vide, `protocole.ts`), `outils/bureau.mjs`, deux scripts dans `package.json` (`bureau`, `exe` en dossier seul par `--dir` ou `@electron/packager`), `.gitignore`, un lanceur de banc (`outils/banc/exe.mjs`).
- **Contenu** : protocole `app://gtracker` avec repli sur `index.html` et contrôle de chemin, CSP en en-tête, agent HTTP, instance unique, fenêtre retenue, menu retiré, navigation verrouillée et liens externes au navigateur de Windows, question à la fermeture avec brouillon (`will-prevent-unload`), gestionnaire d'autorisations, `runAsNode` coupé.
- **Preuve** : passage courant du banc dans le .exe, comparé au même passage sous Chrome ; import par les deux voies du §2.8 ; console vide.
- **Taille** : gros (neuf, multi-fichiers, sécurité). **Modèle** : Opus, effort high, avec un plan (`Plan`).
- **Risques** : piège `winCodeSign` (parade : `@electron/packager` pour ce lot) ; CSP qui coupe quelque chose (le banc le voit en erreur de console) ; banc et Electron (port de débogage, profil neuf) à mettre au point.

### Lot B · La mémoire dans un vrai dossier du disque

- **But** : la mémoire de Gtracker dans un dossier du disque choisi par la fenêtre de Windows, chemin complet affiché, sans autorisation à redonner, copiable comme celui du téléphone.
- **Fichiers** : `src/platform/runtime.ts` (`isDesktopApp`, `appShell`), `src/platform/memoryFolder.ts` (sorte `disk`), un type du pont, `src/components/MemoryStatus.tsx` et `SettingsFiles.tsx` (sorte `disk`), `hooks/sessionLibrary/lifecycle.ts` et `reset.ts` (à relire), `src/test/memoryFolder.fixture.ts`, `src/architecture.test.ts` (`PLATFORM_ONLY`), `src/locales/en.json` et `es.json` ; côté coquille `bureau/disque.ts`, `bureau/preload.ts`, `bureau/main.ts` ; tests de `disque.ts` et suite de contrat.
- **Preuve** : tests unitaires sur dossier temporaire ; banc dans le .exe (sessions importées, fiches relues sur le disque, « Mettre à jour » après une copie de fichiers à la main) ; navigateur et APK inchangés (banc sous Chrome identique au commit d'avant).
- **Taille** : gros. **Modèle** : Opus, effort high, plan d'abord ; relecture par `relecture`.
- **Risques** : écriture interrompue (le renommage la couvre) ; OneDrive ou antivirus qui tiennent un fichier (nouveaux essais courts) ; sécurité du pont (validation des chemins : la partie à relire en premier) ; recopie de la mémoire OPFS du lot A vers le dossier (le chemin existant du navigateur, `lifecycle.ts`, la fait déjà pour `picked`).

### Lot C · Fichiers reçus et retouches d'ordinateur

- **But** : un .gpx ou .fit ouvert depuis l'Explorateur ou glissé sur l'icône est rangé, comme « Ouvrir avec Gtracker » sur Android ; la page Enregistrer sans le « GPS du navigateur » sur ordinateur (si la réponse à la question 3 le confirme) ; le bouton « précédent » de la souris, si on le veut.
- **Fichiers** : `src/platform/incomingFile.ts` (branche ordinateur), `bureau/fichiersRecus.ts`, `bureau/main.ts` (ligne de commande, `second-instance`), `bureau/preload.ts`, `src/pages/RecordingPage.tsx` (une condition), éventuellement `src/platform/backButton.ts`.
- **Preuve** : test unitaire de la file côté coquille ; banc : la coquille lancée avec un .gpx en argument, la session rangée (script `fichier-recu.mjs` existant, à adapter).
- **Taille** : petit à moyen. **Modèle** : Sonnet, effort high (vérification qui compte, banc à compléter).
- **Risques** : un fichier reçu pendant que la mémoire s'ouvre (la file d'Android a déjà la règle : retenté plus tard) ; fichier énorme (même plafond de 30 Mo qu'Android).

### Lot D · L'installeur

- **But** : `Gtracker-Setup-<version>.exe`, installé par utilisateur sans droits d'administrateur, raccourcis menu Démarrer et bureau, association .gpx et .fit dans « Ouvrir avec », icône, avis de licences d'Electron et Chromium dans « À propos » (version ordinateur).
- **Fichiers** : configuration d'electron-builder dans `bureau/package.json`, script NSIS d'association par utilisateur, `outils/bureau.mjs` (version `0.01.40` → `0.1.40`), `public/licences-hors-js.json` ou un complément propre au .exe, son test.
- **Preuve** : installeur fabriqué et mesuré (poids, durée), installation, lancement, désinstallation sur le poste ; les données du profil gardées après une réinstallation.
- **Taille** : petit à moyen. **Modèle** : Sonnet, effort medium (high si le piège `winCodeSign` résiste).
- **Risques** : `winCodeSign` sans droits d'administrateur ; Smart App Control de Windows 11 qui bloque un .exe non signé (à voir sur le poste de l'utilisateur).

### Ensuite, hors de cette étude

- « Récupérer » les sessions du téléphone par le câble (débogage USB d'abord), puis « Synchroniser », comme l'étude du 12/11 le proposait ; la sorte `disk` et le pont du lot B en sont la base.
- Vente : signature (environ 209 € par an chez Certum pour un particulier, relevé le 12/11), Microsoft Store (compte gratuit, signature par Microsoft), mise à jour automatique. À décider avec le canal de vente. À noter aussi : les photos de GONG du Profil demandent l'accord de GONG avant toute diffusion (DECISIONS §9), .exe compris.

Ordre conseillé : A, B, puis C et D dans l'ordre qu'on veut (D avant C si l'utilisateur veut l'installeur tôt ; l'association des fichiers du lot D n'a d'effet qu'avec le lot C).

## 7. Questions pour l'utilisateur

1. **Où mettre la mémoire sur le PC ?** Conseil par défaut : au premier lancement, proposer `Documents\Gtracker` (créé s'il manque) avec un bouton « Choisir un autre dossier » ; le dossier se change ensuite dans Réglages › Mémoire. Si `Documents` est dans OneDrive, le dire et conseiller un dossier hors OneDrive.
2. **Installeur tout de suite, ou d'abord un dossier à lancer ?** Conseil : un simple dossier du programme pour les lots A et B (usage par l'utilisateur seul), l'installeur au lot D, avant toute remise à un tiers.
3. **La page Enregistrer sur le .exe.** Conseil : garder la page avec le rejeu d'un GPX, retirer le choix « GPS du navigateur », qui ne marchera vraisemblablement pas dans le .exe. Les deux barres de navigation restent celles du §11 (rien ne se déplace).
4. **Ouvrir les .gpx et .fit depuis l'Explorateur.** Conseil : oui, Gtracker proposé dans « Ouvrir avec », sans se déclarer de force programme par défaut.
5. **Mise à jour du .exe.** Conseil : à la main (installer la nouvelle version par-dessus) jusqu'à la vente ; la mise à jour automatique se décidera avec le canal de vente, puisqu'elle demande un endroit public où déposer les versions.

## 8. Vérifié, supposé, non prouvé

Vérifié le 18/11 :

- versions d'Electron et des outils (registre npm, GitHub, `releases.electronjs.org`) ; poids de l'archive d'Electron pour Windows (158 Mo) ;
- liste de sécurité, API de protocole et de pont (pages officielles d'Electron) ;
- défauts d'electron-builder (installation par utilisateur, données gardées à la désinstallation), associations de fichiers sous NSIS réservées à l'installation pour tous, cible portable, état du piège `winCodeSign` (code source et ticket) ;
- `0.01.40` refusée en semver strict, `0.1.40` en lecture souple ;
- dans le code de Gtracker : les branches navigateur de chaque module de `platform/`, `BrowserRouter`, absence de CSP, travailleur, serveurs contactés, champ `webkitdirectory`, liste blanche des licences limitée aux dépendances de production, entrée `BANC_WS` du banc ;
- le déroulé de l'essai du 12/11 (champ trouvé, actif, 0 fichier, import jamais lancé).

Supposé, à confirmer au lot A ou B :

- cause de l'import raté (premier chemin seul énuméré comme dossier par Chromium) ;
- `beforeunload` qui bloque la fermeture sans question dans Electron ;
- géolocalisation sans effet dans le .exe ; partage du système absent ; téléchargement par la fenêtre « Enregistrer sous » ;
- Cache API et travailleur sous `app://gtracker` (l'essai du 12/11 n'a montré aucune erreur, mais rien ne dit que l'autre application lançait un travailleur) ;
- `--remote-debugging-port` dans le .exe et branchement du banc par `BANC_WS` ;
- association par utilisateur par un script NSIS ; avis de licences fournis avec Electron.

Non prouvé :

- persistance, d'un lancement à l'autre, de l'autorisation d'un dossier choisi par Chromium dans Electron (sans objet si le lot B est fait) ;
- poids réel de l'installeur et mémoire vive au repos de Gtracker (chiffres de l'autre application) ;
- comportement de Smart App Control sur le poste de l'utilisateur face à un .exe non signé ;
- tenue de la mémoire dans un dossier synchronisé par OneDrive.
