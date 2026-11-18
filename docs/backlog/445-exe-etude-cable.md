# 445 : le .exe et le câble, étude des deux canaux (débogage USB, Transfert de fichiers)

Étude documentaire du 18/11/2026, sans code, sans commande vers un téléphone. Elle part de la fiche `D:\gong tracker\atelier\backlog-clos\exe-ordinateur-etude-tracker.md` (12/11) et de la recherche d'origine dans l'autre application (parties D, E, F, section « Tableau de synthèse »). Ce qui y est établi n'est pas refait ; les renvois « (217) » désignent cette recherche.

Convention : **Vérifié** = lu à une adresse citée, ou dit par la source ; **Supposé** = connaissance générale ou déduction, à éprouver sur le téléphone ; **Non trouvé** = cherché sans résultat.

Décision de l'utilisateur du 18/11 : première version par le câble, « la version facile, avec un message clair qui explique ce qui doit être fait sur le téléphone » ; son téléphone est un Xiaomi qui revient en « charge seule » à chaque branchement.

## 1. Le dossier à servir

`Documents/Gtracker` : `gtracker.json`, `reglages/<appareil>.json`, `fc-repos.json`, `LISEZMOI.txt`, `itineraires/` (fiche `.json` et `.gpx`), `sessions/` (`.gpx`, `.json`, `.imu`) (`docs/ETAT_DU_PROJET.md` §6.1). Ce sont tous des fichiers **non médias** (aucun `.jpg`, `.mp3`, `.mp4`), nombreux (146 fichiers, 69 Mo mesurés en 217 pour une vraie mémoire), de quelques Ko à quelques Mo. Les noms peuvent porter des espaces, des accents et un tiret (« AAAA-MM-JJ Activité - Nom.gpx »). Le point commun avec le besoin : lister avec taille et date, lire, écrire (créer ou remplacer), supprimer.

## 2. Canal 1 : le débogage USB (adb)

### 2.1 Ce qui est vérifié

- Architecture : client, serveur (processus de fond sur le poste, port TCP local **5037**, « tous les clients adb utilisent le port 5037 »), démon `adbd` sur le téléphone ; `adb kill-server` arrête le serveur. https://developer.android.com/tools/adb
- Version : les notes des Platform-Tools donnent 37.0.0 (février 2026), 37.0.1 (juillet 2026) et une 37.0.3 « Canary » de novembre 2026 ; la série 36.0.2 date de septembre 2025. La dernière stable lisible est donc 37.0.1 ou 37.0.2 (la page ne dit pas laquelle est « stable »). https://developer.android.com/tools/releases/platform-tools
- Les notes de plusieurs versions corrigent des défauts propres à Windows (fichier tronqué au dernier caractère à la lecture ou à l'écriture, « Windows only », dans les notes 36.0.x ; hotplug libusb sous Windows ; performances de push/pull) : le client Windows est entretenu, mais ces défauts montrent qu'il faut **figer une version éprouvée** et la vérifier sur un fichier de taille connue (même page).
- Autorisation : depuis Android 10, l'autorisation de l'ordinateur est révoquée automatiquement après 7 jours sans reconnexion (minimum 1 jour si réglé) ; une option des options pour développeurs la désactive (valeur 0). Source : le commit des Paramètres d'AOSP (dérivé /e/OS) https://gitlab.e.foundation/e/os/android_packages_apps_Settings/-/commit/0a189b3abe1e26274799ed0f9779ddd05f275183, et le contrôleur de préférence https://git.replicant.us/replicant-next/packages_apps_Settings/tree/src/com/android/settings/development/AdbAuthorizationTimeoutPreferenceController.java. Pas de page officielle developer.android.com trouvée sur cette option. Un guide tiers dit que le débogage **sans fil** se redemande parfois malgré l'option (https://mirfatif.github.io/adb-guide/android-11) ; rien de tel trouvé pour le câble.
- Licence du code : le module adb d'AOSP déclare Apache-2.0 avec un fichier NOTICE (https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/android17-release/Android.bp ; liste Debian https://sources.debian.org/src/android-platform-tools/35.0.2-1~exp6/packages/modules/adb).
- Licence du paquet : le contrat de licence du SDK (https://developer.android.com/studio/terms, version du 27/07/2021) donne un droit « limité, non cessible, non sous-licenciable » d'usage pour développer des applications (3.1), et interdit de « copier, modifier, adapter, redistribuer… » le SDK « sauf dans la mesure requise par des licences tierces applicables » (3.4) ; mais l'usage, la reproduction et la distribution des composants sous licence libre sont régis **uniquement** par cette licence libre (3.5). Lecture : le fichier `adb.exe` étant sous Apache-2.0, le redistribuer avec sa licence et son NOTICE est probablement permis par 3.5, mais le zip téléchargé l'est sous le contrat du SDK (« développer des applications »), ce qui n'est pas notre usage (outil pour utilisateurs finaux). **Zone grise, à faire trancher par un juriste avant la vente** ; une fiche de discussion ancienne (https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/11565689/android-adb-redistribution) va dans les deux sens et n'a pas de valeur juridique. Chemin sûr si le doute reste : compiler adb depuis les sources AOSP (lourd) ou ne pas l'embarquer.
- adb sans pilote sur Windows récent : `adbd` présente des descripteurs « Microsoft OS » depuis Android 10, et Windows charge alors WinUSB sans fichier INF (217, F.1, avec ses sources Microsoft et /e/OS).

### 2.2 Ce qui est supposé (à éprouver)

- Contenu et taille du zip Windows : `adb.exe` plus `AdbWinApi.dll` et `AdbWinUsbApi.dll` (listés par la configuration de construction du SDK, https://android.googlesource.com/platform/development/+/5284e5a48/build/sdk-windows-x86.atree, et des guides tiers) ; un site français donne environ 11,4 Mo pour le zip, sans date (https://lecrabeinfo.net/?p=1663463). Ni libusb, ni `libwinpthread` n'ont pu être confirmés dans le zip actuel : **ouvrir le zip 37.0.x et noter la liste exacte, la taille et le NOTICE**. En ne gardant que `adb.exe` et ses DLL (sans `fastboot`, `sqlite3`…), l'ordre de grandeur est de quelques Mo à une dizaine.
- Le débogage USB reste utilisable quand le téléphone est en « charge seule » : le démon adb ne dépend pas du mode de transfert (connaissance générale, très répandue, non sourcée ici). **C'est l'avantage décisif pour le Xiaomi** : le retour en « charge seule » à chaque branchement (217, E) ne gêne pas adb. À confirmer par l'essai 1.
- Lecture, écriture et suppression : `adb pull` / `adb push` (protocole de synchronisation, pas de passage par le shell, donc sûr pour les accents et espaces) et `adb shell rm`, `adb shell stat`, `adb shell mkdir -p`. Écriture en place, sans passer par MediaStore. Écraser = `push` sur le même chemin (supposé simple, à éprouver, y compris le propriétaire du fichier créé côté téléphone, pour que l'application le relise par le dossier choisi).
- Dates : `adb pull -a` conserve la date de modification (option documentée dans l'aide d'adb, non relue ici) ; `adb push` envoie la date du fichier local (supposé) ; un listage fiable avec taille et date s'obtient par `adb shell stat -c '%s %Y %n'` (toybox) ou par la commande `ls` du protocole de synchronisation (celle que Tango utilise). `find -printf` : non garanti sur toybox, éviter. **À mesurer : listage de 150 fichiers, écart d'horloge entre PC et téléphone sur les dates.**
- Accents : le client Windows corrige l'affichage Unicode depuis la 29.x (notes de version, page ci-dessus) ; passer les noms par `spawn` avec tableau d'arguments, jamais par une chaîne de commande, et guillemeter pour `shell rm`.
- Vitesse : 217 a mesuré 11 s pour 146 fichiers (69 Mo) et 0,1 s pour un listage de 126 fichiers ; chiffres de l'étude précédente, non revérifiés.
- Détection du branchement : `adb track-devices` (flux sur le port 5037, états `device`, `unauthorized`, `offline`) évite toute interrogation répétée. Supposé : l'état `unauthorized` est l'occasion d'afficher le message « acceptez la clé sur le téléphone ».
- Xiaomi : sur HyperOS, les options pour développeurs se débloquent en touchant plusieurs fois le numéro de version (guides tiers, https://techrushi.com/?p=7619, https://miuirom.org/updates/usb-debugging) ; « Installer via USB » ne sert qu'à `adb install` (sinon `INSTALL_FAILED_USER_RESTRICTED`) ; « Débogage USB (paramètres de sécurité) » ne sert qu'à simuler des saisies. Ces deux commutateurs ne devraient donc **pas** être nécessaires pour `push`, `pull` et `shell ls`, mais la seule source est un blog de faible qualité, qui parle aussi d'un compte Xiaomi et d'une carte SIM pour le second : à éprouver. Un résultat nul de recherche : rien trouvé sur `adb push` sous HyperOS en particulier.

### 2.3 Conflit avec un adb déjà lancé

Un seul serveur écoute le port 5037 et un seul peut tenir l'interface USB (vérifié pour le port ; pour l'exclusivité USB, 217 F.2 cite Tango). Si Android Studio, scrcpy ou l'adb de l'utilisateur tourne déjà : (a) notre client de même numéro de version se contente de parler au serveur existant (cas bon) ; (b) un client de version différente **arrête et relance** le serveur en place (message « server version doesn't match this client; killing… », supposé, comportement bien connu), ce qui coupe l'outil de l'autre ; (c) un serveur « maison » sur un autre port (`-P`) ne peut pas prendre l'USB déjà tenu. Parade proposée : essayer d'abord de joindre le serveur existant sans le relancer (`adb -P 5037 devices` avec un `adb` qui le sait), et sinon démarrer le nôtre ; **ne jamais appeler `kill-server`** sans l'accord de l'utilisateur ; message clair en cas d'échec. Pour un acheteur non technicien, ce cas est rare (il n'a pas adb) ; c'est le cas du développeur, donc de l'utilisateur d'aujourd'hui.

### 2.4 Variante sans `adb.exe` : adb en JavaScript (Tango / ya-webadb)

Dépôt vivant (217 F.2 : version 3.0.0-beta.5 du 06/11/2026, 2.6.4 stable de septembre), qui parle le protocole adb directement : en Electron, WebUSB du moteur Chromium. Avantages : rien d'autre à embarquer, licence logicielle à nous, pas de serveur 5037. Défauts : bêtas ; une seule application peut tenir l'interface (si un adb tourne, échec) ; gestion de la clé d'authentification à notre charge ; **Non trouvé** : un exemple documenté en Electron sous Windows, et la licence exacte à relire (supposé MIT). À garder comme variante, pas comme premier choix.

### 2.5 Ce que l'utilisateur doit faire

Première fois (une fois par téléphone) : ouvrir les options pour développeurs (toucher le numéro de version), activer « Débogage USB », brancher, accepter « Autoriser le débogage USB ? » en cochant « Toujours autoriser cet ordinateur », idéalement activer « Désactiver le délai d'expiration des autorisations adb ». Sur Xiaomi, ces écrans sont en anglais ou en français selon la langue, parfois sous « Paramètres supplémentaires » : 6 à 8 gestes. Ensuite à chaque branchement : **rien** si l'autorisation tient et si l'option d'expiration est cochée ; sinon une validation toutes les semaines. Le message d'état s'affiche selon l'état d'adb (aucun appareil, `unauthorized`, `device`).

## 3. Canal 2 : le « Transfert de fichiers » (MTP)

### 3.1 Moyens d'accès depuis Electron, Windows 10 et 11

Sous Windows, le téléphone en transfert est tenu par le pilote MTP de Windows ; la voie propre est l'API des appareils portables (WPD, COM). Une bibliothèque qui parle USB directement (libmtp, `nusb`) exige de remplacer le pilote par WinUSB : à éviter (217 D).

| Moyen | État | Lister | Lire | Écrire | Supprimer | Dates | Remarque |
|---|---|---|---|---|---|---|---|
| Module Node `node-mtp` (libmtp) | marqué déprécié ; instructions Linux et macOS seulement (https://www.npmjs.com/package/node-mtp, https://socket.dev/npm/package/node-mtp) | n/a | n/a | n/a | n/a | n/a | inutilisable sous Windows sans WinUSB. |
| `mtp-nodejs-port-native-addon` (libmtp) | dernier envoi le 13/10/2020, macOS (https://github.com/ganeshrvel/mtp-nodejs-port-native-addon) | n/a | n/a | n/a | n/a | n/a | écarté. |
| `webmtp` (WebUSB) | peu maintenu | n/a | n/a | n/a | n/a | n/a | libère le pilote Windows : même défaut que libmtp. |
| NodeRT | expose WinRT à Node et Electron (https://github.com/NodeRT/NodeRT) | ? | ? | ? | ? | ? | WPD est du COM, pas du WinRT (supposé) ; non trouvé qu'il le couvre. |
| Module natif C++ maison (WPD) | à écrire | oui | oui | oui | oui | oui | recompiler pour chaque Electron ; lourd. |
| `mtp-rs` (Rust, WPD sous Windows) | v0.38.1 du 11/11/2026, 423 commits, MIT ou Apache-2.0 (217 D.2 ; https://github.com/vdavid/mtp-rs, qui confirme licence et existence d'une CLI `mtp-rs-cli`) | oui (0,4 s pour 3 248 objets en une requête, mesure de l'auteur) | oui | oui | oui (dossier vidé d'abord) | à relire dans son README | meilleur candidat ; pas de module Node, donc un petit exécutable auxiliaire lancé par `child_process`, à compiler par nous (Rust) ; **non vérifié** : qu'il se compile et tourne sur ce poste, que la CLI existe pour Windows (l'installation citée est par `brew`), que les dates de modification sont lues. |
| `winmtp` (Rust) | 0.3.2 du 23/03/2026, MIT, auteur unique (217 D.2) | partiel | partiel | partiel | non documenté | ? | écarté devant `mtp-rs`. |
| .NET `MediaDevices` 2.0.0 | 20/08/2026, MIT, net8/9/10 Windows, sans dépendance, « sûr pour les fils, compatible AOT, élagable » (https://www.nuget.org/packages/MediaDevices) | à éprouver | à éprouver | à éprouver | à éprouver | à éprouver | **Non trouvé** : la liste des méthodes (la page NuGet ne la donne pas ; documentation : https://bassman2.github.io/MediaDevices/). Un petit exécutable .NET autonome est la voie la plus simple à écrire. Poids supposé : quelques Mo en AOT à une quarantaine de Mo autonome. |
| PowerShell et `Shell.Application` | fragile (217 D.4) | par éléments, lent | oui, asynchrone | oui, asynchrone | non confirmé | non confirmé | à n'utiliser que pour un essai. |

Aucun module npm maintenu à binaires précompilés pour WPD n'a été trouvé (recherche refaite le 18/11 : seuls des modules libmtp ou WebUSB). La documentation Microsoft de l'API des appareils portables n'a pas pu être lue (adresse essayée en 404) : les capacités de WPD citées viennent des crates qui l'enveloppent.

### 3.2 Défauts connus

- **Fichiers récents absents** : Android sert en MTP ce que MediaStore a indexé, pas le système de fichiers brut ; un fichier non indexé manque ou apparaît à 0 octet jusqu'à une analyse ou un redémarrage (sources anciennes, 217 E ; revérifiées le 18/11 : https://forum.getodk.org/t/request-odk-collect-to-call-mediascannerconnection-scanfile/16152, https://essential-books.onrender.com/essential/android/solving-invisible-mtp-files-problem.-816c620201c241448fc40d22d1f9f025.html, https://discussion.datalogic.com/t/csv-file-created-on-memor-10-external-storage-not-visible-in-window-explorer-until-i-reboot-the-device/1315). **Aucune source trouvée qui parle d'Android 14, 15 ou 16**, ni dans un sens ni dans l'autre : le défaut est donc possible mais inconnu sur les versions récentes. À mesurer, il décide du canal.
- **Remède côté téléphone** : `MediaScannerConnection.scanFile(contexte, chemins, types, rappel)` demande au service d'analyse de lire un fichier et de l'ajouter au fournisseur de médias ; la page officielle (https://developer.android.com/reference/android/media/MediaScannerConnection) ne le déclare pas obsolète et parle de « fichier média » ; si cela fonctionne pour un `.json`, un `.gpx` ou un `.imu` (type inconnu), **c'est supposé, non confirmé**. L'application Gtracker (Capacitor) pourrait lancer cet appel après chaque écriture du dossier mémoire, et un bouton « Préparer pour l'ordinateur » pourrait analyser tout le dossier. Dans `src/platform/`, un module à créer (règle 12). Un chemin réel est requis : celui du dossier choisi est de la forme `/storage/emulated/0/Documents/Gtracker/...` (supposé, à partir de l'identifiant de document SAF `primary:`).
- **Écriture de fichiers non médias** (PC vers téléphone) : le code MTP d'AOSP appelle `MediaStore.scanFile` après l'ajout d'un objet par MTP (217 E, commit /e/OS), donc le fichier posé par le PC devrait être visible côté téléphone, par le dossier SAF qui lit le système de fichiers (supposé) ; non éprouvé.
- **Écrasement** : un objet MTP n'a pas d'écriture en place : suppression puis création, ou création sous un nom temporaire, suppression de l'ancien, renommage. Une écriture échouée peut laisser un objet partiel (`mtp-rs`, 217 D.2) : vérifier la taille après écriture.
- **Lenteur** : 1 Go en 6,5 s en lecture et 4,8 s en écriture mesurés par l'auteur de `mtp-rs` sous Windows ; blocage possible du pilote pendant plusieurs minutes après des changements de fichiers côté téléphone (même source) : délais maximaux obligatoires.
- **Mode USB** : Android démarre en « charge seule » et le choix passe par la notification (https://anexplorer.io/solve/android-not-detecting-usb) ; Xiaomi : l'option « Configuration USB par défaut » (options pour développeurs) à « Transfert de fichiers » est la seule parade citée par Xiaomi (https://www.mi.com/global/support/faq/details/KA-92068/ ; guide https://www.techbone.de/xiaomi/smartphone/usb-standard-konfiguration-festlegen?from=mi-11) ; un guide allemand dit que la gestion USB de HyperOS applique automatiquement une fonction par défaut dès qu'un câble est vu, ce qui explique peut-être que le choix ne tienne pas ; la persistance **n'est pas confirmée** sur le Xiaomi de l'utilisateur. Autre signalement : un fil HyperOS.eu où ni MTP ni ADB ne sont détectés tout de suite (https://xiaomi.eu/community/threads/usb-only-charging-initially-uvc-misidentification-before-it-is-detected-on-redmi-note-13-4g-hyperos-eu-2-0-10-0-stable.75574), ROM non officielle : ne pas généraliser.
- **Déverrouillage de l'écran** : supposé nécessaire (non sourcé), à éprouver.
- **Détection du branchement** : (a) interroger la liste des appareils portables toutes les deux secondes par l'exécutable auxiliaire (simple, supposé fiable) ; (b) écouter les arrivées de périphériques Windows (supposé, non éprouvé) ; (c) le module npm `usb` donne `attach` et `detach` même sans pilote utilisable, mais impose un module natif, des événements natifs non pris en charge par libusb sous Windows (il sonde donc toutes les 500 ms par défaut) et des binaires à suivre à chaque Electron (https://www.npmjs.com/package/usb, https://tessl.io/registry/tessl/npm-usb/2.16.0/files/docs/event-handling.md). Seule la combinaison (c) + (a) distingue « téléphone vu mais en charge seule » (identifiant fabricant Xiaomi vu par USB, aucun appareil portable listé : supposé) de « rien branché ».

### 3.3 Ce que l'utilisateur doit faire

Première fois : rien d'installé ; idéalement, régler « Configuration USB par défaut » sur « Transfert de fichiers » dans les options pour développeurs (ce qui annule l'avantage « sans option pour développeurs » : à ne pas proposer à l'acheteur, seulement à l'utilisateur). À chaque branchement, avec un Xiaomi : déverrouiller, balayer vers le bas, toucher la notification USB, choisir « Transfert de fichiers ». Possible à rendre automatique : rien côté PC ; côté téléphone, ni l'application ni le PC ne peuvent changer le mode sans geste (supposé ; aucune source ne dit le contraire).

## 4. Autres voies par câble

- **Partage de connexion USB** : le téléphone devient une carte réseau et l'application du téléphone sert une page HTTP locale. Écarté pour la première version : geste à chaque branchement (comme MTP), serveur à écrire sur le téléphone, adresse à découvrir, application à rester ouverte, et le défaut de retour en « charge seule » s'applique aussi (217 F.3, non sourcé). **Non trouvé** de source utile le 18/11. À garder en idée seulement si on veut un jour une synchronisation sans fichier ni droits.
- **Android Open Accessory** : écarté (pilote WinUSB probable, application compagnon, difficulté haute ; 217 F.1).
- **Stockage de masse** : plus offert par Android depuis longtemps (supposé, non vérifié).
- **Copie manuelle** (l'Explorateur, déjà possible) : sert de solution de repli et de point de comparaison, pas de bouton.
- **Wi-Fi** : hors sujet (consigne : sans réseau).

## 5. Comparaison critère par critère

| Critère | 1. Débogage USB (adb) | 2. Transfert de fichiers (MTP) |
|---|---|---|
| Première fois sur le téléphone | options pour développeurs, débogage USB, autoriser l'ordinateur, option d'expiration (6 à 8 gestes) | rien (ou configuration USB par défaut, option pour développeurs) |
| À chaque branchement (Xiaomi) | rien tant que l'autorisation tient ; sinon une validation toutes les semaines (vérifié : 7 jours sans l'option) | déverrouiller, notification, « Transfert de fichiers » (non contournable : supposé) |
| Automatisable | détection par `track-devices`, tout le reste sans geste (supposé) | détection par sondage ; le mode ne se change pas sans geste |
| Vitesse | 146 fichiers, 69 Mo en 11 s ; liste 0,1 s (217) | 6,5 s par Go en lecture (mesure `mtp-rs`) ; liste 0,4 s par 3 000 objets ; 1 500 petits fichiers : non mesuré, dépend des requêtes par fichier |
| Fiabilité | bonne : système de fichiers direct, écriture en place ; risques : conflit adb 5037, autorisation expirée, noms accentués | moyenne : index MediaStore (inconnu sur Android 14 à 16), pilote bloquant, écrasement non atomique, débranchement |
| Lire | oui | oui, sous réserve de l'index |
| Écrire (créer et remplacer) | oui, en place | oui, mais remplacer = supprimer et recréer |
| Supprimer | oui (`rm`) | oui (objet par objet) |
| Dates | oui (`stat`, `pull -a`) ; à confirmer sur le Xiaomi | selon l'outil (WPD expose la date de modification ; à confirmer pour l'outil retenu) |
| À embarquer | `adb.exe` et DLL, de quelques Mo à une dizaine (à mesurer) ; ou Tango (JS) | un exécutable auxiliaire (Rust `mtp-rs` ou .NET `MediaDevices`) |
| Licence | code adb Apache-2.0 (vérifié) ; redistribution du paquet du SDK dans une zone grise (3.4 et 3.5) ; NOTICE à joindre ; **à faire valider par un juriste** | `mtp-rs` MIT ou Apache-2.0 ; `MediaDevices` MIT ; rien de Google |
| Acheteur non technicien | non : options pour développeurs, risque de les laisser actives | oui, mais le geste du mode à chaque branchement |

## 6. Recommandation

1. **Avant toute écriture de code, un essai d'une heure (section 8, essais 5 et 6)** : l'application du téléphone écrit une session ; on cherche le fichier dans l'Explorateur Windows, téléphone en « Transfert de fichiers », sans rien d'autre. Si le fichier apparaît tout de suite et avec sa taille, MTP devient le canal principal de la version vendue ; sinon il faut l'étape « Préparer pour l'ordinateur » (analyse côté téléphone) ou adb seul.
2. **Première version pour l'utilisateur : débogage USB**, comme le décidait déjà la fiche du 12/11 : plus rapide, plus fiable, lecture, écriture en place et suppression, aucun geste par branchement même avec le « charge seule » du Xiaomi, un seul sens de test sur le vrai téléphone. Il valide la synchronisation (fusion, suppressions), qui est l'essentiel du lot. Le message clair demandé couvre la première fois et l'état `unauthorized`.
3. **MTP en deuxième temps, derrière la même interface**, quand on prépare la vente : c'est le seul canal présentable à un acheteur. Le décider en connaissant le résultat de l'essai 5.
4. **Ne pas embarquer adb dans une version vendue sans avis juridique** (zone grise du contrat de licence du SDK). Pour l'utilisateur seul, rien n'oblige à l'embarquer : le .exe peut chercher un `adb.exe` posé dans un dossier connu ou dans le PATH et proposer de le télécharger lui-même depuis la page officielle de Google ; ce choix déplace la question de licence sur l'utilisateur.

## 7. Interface commune « dossier du téléphone »

Écrite en TypeScript, hors de toute dépendance Electron, côté processus principal ; la synchronisation ne connaît que cette interface (règle 12 : dans `src/platform/` pour le code du renderer, ici un module du processus principal). Les chemins sont relatifs à `Documents/Gtracker`, séparés par `/`, en UTF-8, sans `..`.

```ts
type PhoneFolderState =
  | { kind: 'absent' }                       // rien de branché (ou rien vu)
  | { kind: 'wrongMode'; hint: 'chargeOnly' } // vu mais pas utilisable (MTP : charge seule)
  | { kind: 'needsAuth' }                    // adb : appareil « unauthorized »
  | { kind: 'locked' }                       // MTP : écran verrouillé (supposé)
  | { kind: 'ready'; deviceName: string };

interface PhoneEntry { path: string; sizeBytes: number; modifiedMs: number; isDir: boolean }

interface PhoneFolder {
  readonly channel: 'adb' | 'mtp';
  onState(listener: (s: PhoneFolderState) => void): () => void;   // détection, avec désabonnement
  list(prefix: string): Promise<PhoneEntry[]>;                    // récursif, une seule requête si possible
  read(path: string, dest: string): Promise<void>;                // vers un fichier local ; date de modification conservée
  write(path: string, src: string, modifiedMs?: number): Promise<void>; // crée les dossiers ; remplace ; vérifie la taille
  remove(path: string): Promise<void>;                            // fichier seul
  close(): Promise<void>;
}
```

Règles communes : toute opération a un délai maximal et peut être annulée ; `write` sur un fichier existant doit laisser l'ancien intact si elle échoue (adb : pousser sous un nom temporaire puis `mv` ; MTP : créer, vérifier, supprimer l'ancien, renommer) ; aucune opération ne suppose l'ordre des fichiers ; `list` rend les dates en millisecondes UTC et le code tolère un écart d'horloge de quelques secondes (comparer taille puis date, jamais seulement la date) ; la synchronisation décide, l'interface exécute.

## 8. Messages à montrer

Adb, première fois, aucun appareil (état `absent`, après 5 s) :
« Branchez votre téléphone au câble USB. Sur le téléphone, ouvrez Paramètres, puis À propos du téléphone, et touchez sept fois « Version » pour afficher les options pour développeurs. Ouvrez-les, activez « Débogage USB », puis revenez ici. »
Adb, état `needsAuth` :
« Regardez l'écran du téléphone : une fenêtre demande « Autoriser le débogage USB ? ». Cochez « Toujours autoriser cet ordinateur », puis touchez « Autoriser ». »
Adb, autorisation expirée après une semaine : « Le téléphone demande de nouveau l'autorisation. Dans les options pour développeurs, vous pouvez cocher « Désactiver le délai d'expiration des autorisations adb » pour ne plus la voir. »
Adb, adb déjà lancé et incompatible : « Un autre programme utilise la liaison avec le téléphone (Android Studio, scrcpy…). Fermez-le, puis touchez « Réessayer ». »

MTP, état `wrongMode` (téléphone vu, pas en transfert) :
« Votre téléphone est branché mais il ne fait que charger. Sur le téléphone, faites glisser le haut de l'écran vers le bas, touchez la notification « Chargement par USB », puis choisissez « Transfert de fichiers ». Sur certains téléphones il faut le refaire à chaque branchement. »
MTP, `locked` : « Déverrouillez l'écran du téléphone. »
MTP, fichier récent manquant : « Sur le téléphone, ouvrez Gtracker, Réglages, Mémoire, puis « Préparer pour l'ordinateur » (à créer, si l'essai 5 le justifie). »

## 9. Essais à faire sur le vrai téléphone (Xiaomi), sans rien livrer

Sans programme : l'Explorateur et `adb` à la main, ou par un petit script, par quelqu'un qui peut lancer adb ; ici rien n'a été lancé.

1. Débogage USB : avec « charge seule » affiché, `adb devices` voit-il le téléphone en `device` ? (confirme le gain principal).
2. Avec seulement « Débogage USB » (sans « Installer via USB » ni « Débogage USB (paramètres de sécurité) »), `adb pull`, `adb push`, `adb shell rm` et `stat` sur `/sdcard/Documents/Gtracker` fonctionnent-ils ? Un nom accentué avec espaces passe-t-il ? Le fichier poussé est-il relu par l'application ?
3. Date des fichiers : `pull -a` et `push` conservent-ils les dates ? Écart d'horloge PC et téléphone ? Durée de listage de la vraie mémoire (146 fichiers) et de 1 500 fichiers fabriqués.
4. Autorisation : après une semaine, est-elle redemandée avec et sans l'option d'expiration ? (essai long, à lancer tôt.)
5. MTP, lecture : l'application écrit une session ; dans l'Explorateur, téléphone en « Transfert de fichiers », le fichier est-il présent, avec la bonne taille, immédiatement ? Si non, apparaît-il après un `scanFile` de l'application ? après un redémarrage seul ?
6. MTP, écriture : copier un `.json` et un `.imu` du PC vers `Documents/Gtracker/sessions` ; l'application les voit-elle sans action ? Remplacer un fichier existant : l'Explorateur le fait-il, et le téléphone voit-il le nouveau contenu ?
7. Mode USB : l'option « Configuration USB par défaut » à « Transfert de fichiers » tient-elle après débranchement, redémarrage, verrouillage ? L'écran verrouillé bloque-t-il la liste ?
8. Débranchement pendant une écriture : l'état du dossier (fichier partiel, objet fantôme) en adb puis en MTP.
9. Conflit : Android Studio ou un autre `adb` lancé, puis notre client : que devient le serveur ?
10. Poids : le zip des Platform-Tools 37.0.x (liste, taille, NOTICE).

## 10. Questions pour l'utilisateur

1. L'acheteur type est-il un utilisateur qui accepte d'activer le débogage USB ? **Réponse par défaut : non**, donc adb pour lui seul et MTP pour la vente.
2. Faut-il accepter d'ajouter dans l'application du téléphone un bouton « Préparer pour l'ordinateur » (analyse du dossier pour MTP) ? **Par défaut : oui, mais seulement si l'essai 5 montre le défaut.**
3. Le .exe peut-il demander à l'utilisateur de télécharger lui-même adb (pas de redistribution), ou doit-il l'embarquer ? **Par défaut : télécharger, jusqu'à un avis juridique.**
4. Une session supprimée d'un côté disparaît-elle de l'autre ? Reste ouverte depuis la fiche du 12/11 ; **par défaut : oui**, avec un fichier de suppressions dans le dossier. Le canal MTP rend ce choix plus risqué (liste incomplète = fausses suppressions) : **par défaut, ne jamais supprimer sur la foi d'une liste dont l'index est douteux.**
5. L'utilisateur veut-il une seule app sur son téléphone (aucune application serveur) ? **Par défaut : oui**, ce qui écarte le partage de connexion.
6. Quelle langue pour les messages du téléphone (Xiaomi en français) ? **Par défaut : par `t`, dictionnaires existants.**

## 11. Non vérifié, en une liste

Contenu et taille du zip Platform-Tools actuel ; redistribution licite de `adb.exe` ; persistance de l'autorisation sur câble avec l'option ; dates conservées par `push` ; `adb` utilisable en « charge seule » ; nécessité des deux commutateurs Xiaomi ; état de l'index MediaStore et effet de `scanFile` sur des fichiers non médias sur Android 14 à 16 et HyperOS ; besoin de déverrouiller en MTP ; persistance de « Configuration USB par défaut » ; compilation et dates de `mtp-rs` sous Windows ; méthodes de `MediaDevices` ; capacités de WPD (documentation Microsoft introuvable à l'adresse essayée).

## 12. Sources lues le 18/11/2026

https://developer.android.com/tools/releases/platform-tools ; https://developer.android.com/tools/adb ; https://developer.android.com/studio/terms ; https://developer.android.com/reference/android/media/MediaScannerConnection ; https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/android17-release/Android.bp ; https://gitlab.e.foundation/e/os/android_packages_apps_Settings/-/commit/0a189b3abe1e26274799ed0f9779ddd05f275183 ; https://git.replicant.us/replicant-next/packages_apps_Settings/tree/src/com/android/settings/development/AdbAuthorizationTimeoutPreferenceController.java ; https://mirfatif.github.io/adb-guide/android-11 ; https://github.com/vdavid/mtp-rs ; https://www.nuget.org/packages/MediaDevices ; https://github.com/Bassman2/MediaDevices ; https://www.npmjs.com/package/node-mtp ; https://github.com/NodeRT/NodeRT ; https://www.npmjs.com/package/usb ; https://www.mi.com/global/support/faq/details/KA-92068/ ; https://www.techbone.de/xiaomi/smartphone/usb-standard-konfiguration-festlegen?from=mi-11 ; https://techrushi.com/?p=7619 ; https://miuirom.org/updates/usb-debugging ; https://forum.getodk.org/t/request-odk-collect-to-call-mediascannerconnection-scanfile/16152 ; https://discussion.datalogic.com/t/csv-file-created-on-memor-10-external-storage-not-visible-in-window-explorer-until-i-reboot-the-device/1315 ; https://anexplorer.io/solve/android-not-detecting-usb ; https://android.googlesource.com/platform/development/+/5284e5a48/build/sdk-windows-x86.atree ; et les sources de la recherche d'origine (217) citées dans le texte.
