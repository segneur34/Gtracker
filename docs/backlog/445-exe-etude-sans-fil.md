# 445 · Étude : synchroniser sans câble le dossier mémoire du téléphone avec le programme Windows

Étude documentaire du 18/11/2026, sans code ni installation. Chaque affirmation porte l'une de ces marques : **[vérifié]** (lu sur la page citée), **[supposé]** (déduit, ou lu sur un blog ou un forum, ou non retrouvé), **[code]** (lu dans le dépôt).

## 0. En bref

- **Recommandation** : le PC écoute, le téléphone est le client et décide quand synchroniser. Liaison TLS dont l'empreinte du certificat est transmise à l'appairage, jeton gardé par le téléphone, découverte par l'annonce `_gtracker._tcp` avec repli sur la dernière adresse connue puis sur une adresse saisie. Application ouverte seulement : au lancement du téléphone si le PC répond, plus un bouton. Pas de tâche de fond, pas de service au premier plan.
- **Effort** : 4 lots, dont un seul est propre au sans-fil côté téléphone (un greffon Java d'environ 300 lignes) ; le moteur de synchronisation, son interface « dossier distant » et son écran sont communs avec le câble.
- **Plus gros risque** : le réseau lui-même (isolement des clients d'une box ou d'un Wi-Fi de club) et le pare-feu Windows ; les deux se traitent par un message clair et par le repli câble, jamais par un contournement.

## 1. Architectures

### 1.1 Qui écoute

| | A. PC écoute, téléphone client | B. Téléphone écoute, PC tire |
|---|---|---|
| Déclencheur | Le téléphone ouvre l'application : il appelle le PC s'il répond. Le PC n'a rien à faire. | Le PC ouvre le .exe : il cherche le téléphone, qui doit être allumé, éveillé, application ouverte. |
| Côté téléphone | Un client HTTPS. Rien n'écoute. | Un serveur dans l'application, donc une connexion entrante : permission réseau local en plus, et, pour l'écran éteint, un service au premier plan (§2.4). |
| Côté PC | Serveur dans le processus principal d'Electron, actif tant que le .exe est ouvert. | Un client. Aucune fenêtre de pare-feu (une connexion sortante n'en provoque pas **[supposé]**, la fenêtre naît à l'écoute, cf. §3.1). |
| Ce que voit l'utilisateur | Une fenêtre de pare-feu au premier lancement du .exe. | Aucune fenêtre Windows ; mais un téléphone qui doit rester éveillé. |
| Si l'autre n'est pas là | Le téléphone voit « PC introuvable » et continue de fonctionner. | Le PC voit « téléphone introuvable » ; le cas courant (téléphone en veille, application fermée) devient une panne ordinaire. |
| Un autre appareil du réseau | Il voit un port ouvert sur le PC, pendant que le .exe tourne. | Il voit un port ouvert sur le téléphone, qui bouge de réseau en réseau (plage, club, 4G). |

Choix : **A**. Le téléphone est l'appareil qui bouge et qui sait quand une session vient d'être écrite ; le PC est celui qui reste. Avec B, la demande de l'utilisateur (« ça évite de devoir valider le transfert ») deviendrait « garder le téléphone éveillé avec l'application ouverte », pire que ce qu'il fuit. Le cas B n'est pas exclu pour plus tard : l'interface « dossier distant » (§7.4) le permettrait sans refaire le moteur.

### 1.2 Découverte de l'autre appareil

1. **Code QR, à l'appairage seulement.** Le PC affiche un QR portant adresse, port, empreinte du certificat et secret d'appairage. Problème : le téléphone doit le lire, donc l'autorisation Caméra ou le lecteur de codes de Google (ML Kit, qui n'en demande pas, **[supposé]**, non retrouvé dans cette étude). Un greffon de plus. Alternative sans caméra : le PC affiche « 192.168.1.23 : 48217 » et un code à 6 chiffres que l'utilisateur tape une seule fois.
2. **Annonce sur le réseau local (mDNS / DNS-SD), `_gtracker._tcp`.** Le PC annonce (bibliothèque Node du type `bonjour-service`, **[supposé]**, non vérifiée) ; le téléphone cherche par `NsdManager`. Une page web ne sait pas faire de mDNS : greffon Java obligatoire **[supposé, cohérent avec la doc Android citée au §2]**. Sert à retrouver le PC quand sa adresse a changé (bail DHCP). Dépend du multicast, souvent filtré sur un Wi-Fi public (§3.3).
3. **Adresse saisie.** Repli universel : l'adresse IP et le port se lisent dans la fenêtre du PC. Aussi la seule voie quand le multicast est filtré mais que le trafic direct passe.

Ordre de tentative du téléphone : dernière adresse connue (une requête, 1 s) puis annonce mDNS (3 s) puis message « PC introuvable, saisir l'adresse ? ».

### 1.3 Appairage une seule fois, jeton gardé

- L'utilisateur clique « Appairer un téléphone » dans le .exe : une fenêtre d'appairage s'ouvre pour 2 minutes (le serveur refuse tout appairage hors de cette fenêtre).
- Le téléphone présente le secret d'appairage ; le PC répond par un **jeton** aléatoire de 256 bits, nom de l'appareil, droits (lecture et écriture). Le PC garde l'empreinte (hachage) du jeton ; le téléphone garde le jeton dans le stockage privé de l'application.
- Le PC liste les téléphones appairés et sait en retirer un (jeton révoqué). Le téléphone sait « oublier ce PC ».
- Chaque appel suivant porte le jeton. Pas de compte, pas de serveur tiers.

### 1.4 Chiffrement et protection contre un autre appareil du même réseau

Menace réaliste : le Wi-Fi d'un club, où n'importe qui peut atteindre le port du PC, écouter, ou se faire passer pour lui. Le dossier contient des positions et de la fréquence cardiaque (donnée de santé, DECISIONS §8).

| Option | Écoute | Usurpation du PC | Coût |
|---|---|---|---|
| HTTP clair + jeton | exposée (jeton compris) | possible | nul, mais Android bloque le clair (§2.2) |
| HTTPS, certificat auto-signé, **empreinte fixée à l'appairage** (comme une clé SSH) | chiffrée | impossible une fois appairé | un certificat généré par le .exe, un client Java qui compare l'empreinte (`HttpsURLConnection` + TrustManager maison, ou OkHttp) |
| HTTPS, certificat d'une autorité | chiffrée | impossible | impossible sans nom de domaine public ; écarté |

Choix : le deuxième. Si le secret d'appairage voyage par QR (empreinte dedans), l'appairage est protégé de l'intermédiaire. Avec le code à 6 chiffres tapé, il faut éviter qu'un appareil du réseau s'insère pendant l'appairage : le téléphone et le PC se prouvent mutuellement la connaissance du code, par exemple un HMAC du code sur l'empreinte et un nonce, plutôt que d'envoyer le code **[supposé : conception à faire valider par une relecture sécurité, ce n'est pas un protocole éprouvé]**. Compléments : serveur qui n'accepte que des adresses privées (192.168/16, 10/8, 172.16/12, liaison locale) ; limitation du débit des essais de jeton ; serveur arrêté quand l'utilisateur coupe « synchronisation sans fil » ; chemins validés contre `..` (voir §7.4) ; jamais de listage hors du dossier mémoire.

## 2. Côté Android

### 2.1 Autorisations et ce que voit l'utilisateur

- **Android 16 et avant, application visant 36 ou moins** : tout accès réseau local est ouvert par `INTERNET`. Aucune demande, aucune fenêtre. **[vérifié]** https://developer.android.com/privacy-and-security/local-network-permission (« apps with INTERNET permission receive an implicit permission grant … targets SDK 36 or lower »). Le projet vise aujourd'hui 36 **[code : `android/variables.gradle`]**.
- **Android 17 (API 37), application visant 37 ou plus** : `ACCESS_LOCAL_NETWORK`, autorisation d'exécution, dans le groupe « Appareils à proximité » (`NEARBY_DEVICES`) ; bloquée par défaut ; elle couvre connexion TCP sortante *et* entrante, UDP unicast, multicast et diffusion, sur toutes les bibliothèques, y compris la WebView, qui hérite de l'état de l'application. Un refus ou une révocation produit des délais d'attente TCP. **[vérifié, même page]**.
- Si l'utilisateur a déjà accordé une autre autorisation du groupe, il n'est pas redemandé. **[vérifié, même page]**. L'application déclare déjà `BLUETOOTH_SCAN` et `BLUETOOTH_CONNECT` pour la ceinture cardio **[code : manifeste]** ; ce sont les mêmes groupes « Appareils à proximité » **[supposé : le groupe de Bluetooth est bien `NEARBY_DEVICES`, non relu ici]**, donc un utilisateur qui a la ceinture ne verrait probablement pas de fenêtre de plus.
- **Sélecteur système sans autorisation** : `NsdManager` offre `DiscoveryRequest` avec `FLAG_SHOW_PICKER` (API 37 et extensions T 22) : le système affiche une liste, l'utilisateur choisit un appareil, et la connexion à ses adresses se fait sans `ACCESS_LOCAL_NETWORK`. **[vérifié]** https://developer.android.com/privacy-and-security/local-network-permission et https://developer.android.com/reference/android/net/nsd/NsdManager. Intéressant pour l'appairage : un seul choix, pas d'autorisation large. Limite : les adresses obtenues ainsi sont à rafraîchir si le réseau change ; le choix est-il mémorisé pour les ouvertures suivantes ? **[non vérifié]**, point à essayer avant de s'y fier.
- Autorisations probablement ajoutées : aucune tant que la cible reste 36. Cible 37 : `ACCESS_LOCAL_NETWORK` (ou le sélecteur). `ACCESS_NETWORK_STATE` utile pour savoir si l'on est sur Wi-Fi (normale, sans fenêtre) **[supposé]**. `CHANGE_WIFI_MULTICAST_STATE` : nécessaire à un mDNS fait à la main, pas à `NsdManager` **[supposé, non vérifié]**.
- Échéance Google Play : cible 36 exigée pour les nouvelles applications et mises à jour au 31/08/2026 ; l'API 37 n'a pas de date publiée à ce jour. **[vérifié]** https://developer.android.com/google/play/requirements/target-sdk ; une source tierce parle d'un report au 01/11/2026, **[non confirmé]**. Conséquence : le jour de la cible 37 arrivera sans doute pendant la vie du produit ; prévoir l'autorisation dans le greffon dès le début (appel conditionnel à la version) évite une reprise.

### 2.2 Trafic non chiffré vers une adresse locale depuis la WebView

- Depuis l'API 28, le trafic en clair est refusé par défaut (`ERR_CLEARTEXT_NOT_PERMITTED`) ; solutions courantes : `server.cleartext` de la configuration Capacitor, ou une configuration de sécurité réseau (`network_security_config.xml`) qui autorise le clair vers un domaine ou une adresse, avec des adresses IP privées qui changent d'un domicile à l'autre, donc autoriser le clair pour tout le réseau privé : large. **[supposé : lu sur des forums et blogs, aucune page officielle Capacitor retrouvée]** https://forum.ionicframework.com/t/local-network-url-can-t-be-acessed-when-building-app/239607 ; https://medium.com/@aliyousefi-dev/ionic-http-not-working-on-lan-after-build-capacitor-fix-for-android-9-2fdd279aea84
- La page est servie en `https://localhost` par défaut dans Capacitor récent **[supposé, non relu dans la configuration du dépôt]** : un `fetch` vers `http://192.168…` est alors du contenu mixte, bloqué ; un `fetch` vers `https://` à certificat auto-signé est refusé par la WebView, qui ne sait pas épingler une empreinte.
- **Conclusion** : la partie web seule ne tient pas. Ni le clair (config large et clair sur un Wi-Fi public), ni l'auto-signé (refus) ne passent par `fetch`. D'où le **greffon Java client** (`RemoteFolderPlugin`, à côté de `MemoryFolderPlugin` **[code]**) : il ouvre la liaison TLS avec l'empreinte épinglée, ajoute le jeton, sert `list / read / write / remove / stat` à la partie web, dans le style de `MemoryFolderPlugin` (base64 pour le binaire). Ce greffon règle d'un coup clair, contenu mixte, épinglage et, plus tard, l'autorisation du §2.1. Il est inévitable aussi pour NSD.
- Les règles du dépôt vont dans ce sens : toute capacité de réseau local, comme le stockage et les capteurs, passe par `src/platform/` (règle 12 de `CLAUDE.md`) ; un module `platform/remoteFolder.ts` serait le seul à connaître le greffon.
- Chrome pour ordinateur a une fenêtre « accès au réseau local » (Chrome 142) pour les pages HTTPS qui appellent le réseau local ; elle ne concerne pas la WebView de Capacitor **[supposé]** et n'a de sens pour nous que si un jour une version web appelait le PC. https://developer.chrome.com/blog/local-network-access

### 2.3 Application ouverte seulement

Tout ce qui précède marche sans rien de plus : client sortant, application au premier plan. La synchronisation commence à l'ouverture et dure quelques secondes à quelques minutes (GPX et `.imu`, qui peut être lourd). Si l'utilisateur quitte l'application en cours de route, le transfert peut s'interrompre : écrire par fichier temporaire puis renommage, comme `memoryFolder` le fait déjà **[code : INVENTAIRE, `.tmp` renommé]** ; reprendre au prochain passage.

### 2.4 En tâche de fond, et à quel prix

- **Service au premier plan** (une notification permanente) : type `dataSync` limité à 6 heures par 24 h pour une cible 15 ou plus, remis à zéro quand l'utilisateur ouvre l'application ; au-delà, le système lève une exception si le service ne s'arrête pas ; un `dataSync` lancé depuis l'arrière-plan sans geste de l'utilisateur est contraint. **[vérifié]** https://developer.android.com/develop/background-work/services/fgs/timeout. Google conseille WorkManager pour ce genre de travail.
- **Déclaration Play Console** : tout type de service au premier plan se déclare dans « Contenu de l'application », avec la fonction qui l'utilise et l'effet pour l'utilisateur s'il est refusé. **[vérifié]** https://support.google.com/googleplay/android-developer/answer/13392821. L'application déclare déjà `location` pour l'enregistrement (`FOREGROUND_SERVICE_LOCATION`) **[code : manifeste]** : un deuxième type s'ajoute au dossier.
- **WorkManager périodique** (par exemple toutes les 15 min mini) : possible sans notification, mais Android l'exécute quand il veut (Doze, économie de batterie), et sans garantie que le PC soit joignable ; et l'accès réseau local depuis l'arrière-plan est soumis aux mêmes permissions. Intérêt faible pour le gain : le téléphone n'a pas de session nouvelle à envoyer tant que l'utilisateur ne l'a pas ouvert pour la lire.
- **Batterie** : un service permanent à l'écoute (cas B) est le pire poste ; un client déclenché par l'ouverture ne coûte rien.
- **Xiaomi** : l'ancien MIUI (10 à 14) coupe les tâches de fond par défaut ; il faut verrouiller l'application dans les récents, activer le démarrage automatique et mettre la batterie sur « sans restriction ». **[vérifié pour MIUI 10 à 14 ; la page ne parle pas de HyperOS, donc non vérifié pour HyperOS]** https://dontkillmyapp.com/xiaomi. L'application demande déjà `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` **[code : manifeste]**. Avec une synchronisation à l'ouverture, Xiaomi est sans conséquence ; c'est un argument de plus contre le fond.
- Conclusion : écarter le fond en première version ; si l'utilisateur le veut un jour, le modèle serait WorkManager, ou le service seulement pendant un transfert déclenché par lui.

## 3. Côté Windows et Electron

### 3.1 Écouter et la fenêtre du pare-feu

- Le premier `listen()` d'un programme sur une interface non locale fait apparaître la fenêtre « Le Pare-feu Windows Defender a bloqué certaines fonctionnalités de cette application », avec les cases « Réseaux privés » et « Réseaux publics » ; l'état initial de la case « Public » est rapporté de façons différentes **[non vérifié]**. https://geekrewind.com/what-to-do-when-windows-firewall-blocks-apps-you-need/
- Microsoft : un administrateur qui refuse ou ferme la fenêtre crée des règles de blocage ; **un utilisateur non administrateur qui est invité obtient des règles de blocage quel que soit son choix** ; les règles sont créées par paires TCP et UDP et il faut les supprimer pour revoir la fenêtre. **[vérifié]** https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/rules. Piège : un compte standard sans droits verrouille le serveur sans le savoir.
- Le nom dans la fenêtre sera celui de l'exécutable (celui d'Electron, ou du .exe emballé, selon l'emballage) **[supposé]**.
- **Réseau « public » ou « privé »** : Windows classe lui-même le réseau ; le Wi-Fi d'un club ou d'un hôtel est le plus souvent « public », la maison « privée » **[supposé]**. Une règle cochée seulement sur « Privé » ne vaut pas sur un réseau « Public » **[vérifié, même source Geek Rewind, à titre d'indice]**. Le sans-fil n'a de sens à la maison ; au club, le PC n'est en général pas là.
- **Deux chemins** : (a) laisser la fenêtre apparaître, et l'application explique avant d'écouter (« Windows va vous demander d'autoriser Gtracker ; cochez Réseaux privés ») ; (b) l'installateur (NSIS d'electron-builder, avec une installation pour toute la machine) ajoute la règle entrante, limitée au programme, au profil privé, par `netsh advfirewall firewall add rule … profile=private` : il faut alors les droits d'administrateur à l'installation. **[vérifié pour la commande]** https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-advfirewall ; **[supposé]** qu'electron-builder permet de l'accrocher sans remplacer le script (la doc dit de préférer `include` à un script complet) https://www.electron.build/docs/nsis. Si le .exe est portable (sans installateur), seul (a) est possible. Question pour l'utilisateur (§8).
- Port : fixe (par exemple 48217, à choisir et à tester), pour que la règle et l'adresse mémorisée tiennent ; repli sur un port voisin si pris.

### 3.2 Annonce et découverte

Voir 1.2 : annonce mDNS depuis le processus principal. Le pare-feu doit aussi laisser entrer l'UDP 5353 : la règle créée par la fenêtre couvre TCP et UDP du programme **[vérifié, même page Microsoft, « two rules … TCP and UDP »]**. Le multicast peut être refusé par un VPN ou une carte virtuelle active sur le PC (choix de la mauvaise interface) **[supposé]** : annoncer sur toutes les interfaces privées.

### 3.3 Quand les deux appareils ne se voient pas

- L'isolement des clients (AP isolation) est l'option des Wi-Fi invités et publics : il bloque l'échange direct entre appareils d'un même point d'accès, et parfois le multicast aussi ; selon les modèles, le multicast passe malgré tout, ce qui donne le cas piégeux « l'annonce arrive, la connexion échoue ». **[vérifié comme existant et variable]** https://www.tp-link.com/us/blog/2586/ ; https://watchguard.com/help/docs/help-center/en-us/Content/en-US/Fireware/wireless/ap_station_isolation_c.html ; https://community.tp-link.com/en/home/forum/topic/661906
- Une box domestique n'isole pas par défaut ; son réseau invité, si **[supposé]**. Le PC filaire et le téléphone en Wi-Fi sont sur le même réseau sur la plupart des box, pas sur toutes (deux réseaux distincts : box + routeur) **[supposé]**.
- Ce que fait l'application : après la tentative (§1.2), un message qui dit la cause probable en clair (« Le PC ne répond pas. Les deux appareils sont-ils sur le même réseau Wi-Fi, et pas sur un réseau invité ? ») et propose les repli : saisir l'adresse, retenter, ou passer au câble. Jamais de boucle d'essais silencieuse.
- Dépannage connu : le **partage de connexion du téléphone** donne un réseau sans isolement entre le téléphone et le PC qui s'y connecte (§5) **[supposé]**.

## 4. Ce que « automatique » peut vouloir dire

| Sens | Réaliste ? | Détail |
|---|---|---|
| À l'ouverture de l'application du téléphone, quand le PC est allumé avec le .exe ouvert | **Oui, c'est le sens retenu.** | Tentative en arrière-plan de l'écran, sans bloquer ; une ligne d'état discrète (« Synchronisé il y a 2 min », « PC introuvable ») ; pas de fenêtre. |
| À l'ouverture du .exe | Oui à moitié | Le PC ne peut pas réveiller l'application du téléphone (B) ; il peut seulement afficher « en attente d'un téléphone » et recevoir quand le téléphone se présente. Les deux sens se complètent : le PC affiche un indicateur. |
| Bouton « Synchroniser » | Oui, toujours | Dans Réglages et sur la page des sessions ; permet de retenter. |
| Pendant que l'application est ouverte, à la fin d'un enregistrement | Oui | Pousser la nouvelle session sitôt écrite, si le PC répond. |
| Application fermée, téléphone en poche | Non en V1 | §2.4. |

Quand l'autre n'est pas là : une ligne d'état et rien d'autre (pas de fenêtre d'erreur, pas de délai d'attente visible) ; l'application se comporte comme aujourd'hui ; dernière synchronisation réussie affichée. L'échec n'est jamais une alerte sauf à la demande explicite (bouton).

## 5. Autres voies sans fil

- **Wi-Fi Direct** (réseau d'égal à égal créé entre les deux appareils) : demande l'autorisation « Appareils Wi-Fi à proximité » (`NEARBY_WIFI_DEVICES`) et des API fragiles ; Windows ne le fait pas simplement de son côté **[supposé]**. Écarter.
- **Bluetooth** : le dépôt gère déjà la ceinture (`BLUETOOTH_*` **[code]**), mais le transfert de fichiers entre téléphone et programme Windows est lent (de l'ordre de 1 Mo/s au mieux, **[supposé]**) pour des `.imu` lourds, et demande un appairage Bluetooth plus un protocole côté Windows. Écarter.
- **Partage de connexion du téléphone** (le PC se connecte au point d'accès du téléphone) : ne demande rien de plus que la voie réseau ; sert de **repli** dans le cas des Wi-Fi isolés. Garder, sous forme d'une phrase d'aide, sans code : l'adresse est celle de la passerelle du téléphone, saisie une fois. **[supposé : non essayé]**
- **Débogage sans fil (adb)** : nécessite le mode développeur, un appairage adb, un `adb.exe` sur le PC ; inadapté à un produit vendu. Écarter pour les utilisateurs ; peut servir au développeur (déjà de l'usage de l'atelier, `docs/MODELES.md`).
- **Wi-Fi seul via un service dans le nuage** : exclu par la décision « aucun compte en ligne ».

## 6. Conséquences pour la vente

- **Politique de confidentialité** : ajouter un paragraphe « Synchronisation avec votre ordinateur » : elle est facultative, désactivée tant qu'on n'a pas appairé ; les données vont du téléphone à l'ordinateur de l'utilisateur sur son réseau local, chiffrées, sans passer par un serveur de l'éditeur ni d'un tiers ; le jeton d'appairage reste sur les deux appareils ; l'éditeur ne reçoit rien. Cela préserve l'argument « tout reste sur le téléphone », avec l'ordinateur de l'utilisateur comme deuxième lieu qu'il choisit.
- **Section « Sécurité des données » de Google Play** : la page de Google définit « collecte » comme un transfert hors de l'appareil **vers vous ou un tiers** **[supposé : non relu dans cette étude]** ; un transfert vers l'ordinateur personnel de l'utilisateur ne va ni chez l'éditeur ni chez un tiers, donc ne change pas les réponses de « collecte » et de « partage » **[supposé, à relire sur la page Play avant de remplir]** ; la case « données chiffrées en transit » devient « oui » pour la synchronisation. À confirmer avec le brouillon du lot 151 (`docs/backlog/151-vente-mentions-legales.md`).
- **Formulaires Play** : « Services au premier plan » inchangé tant qu'il n'y a pas de service de synchronisation ; « Applications de santé » inchangé.
- **Manifeste** : inchangé en V1 à cible 36. À cible 37 : `ACCESS_LOCAL_NETWORK`, ou le sélecteur sans autorisation (§2.1). Éventuellement `ACCESS_NETWORK_STATE` (normale).
- **Côté Windows** : signature du .exe (un .exe non signé déclenche SmartScreen, **[supposé]**) hors du périmètre ici ; une règle de pare-feu ajoutée par l'installateur est à dire dans sa description.

## 7. Recommandation

### 7.1 Architecture retenue

PC serveur (Electron, processus principal), téléphone client ; TLS à certificat auto-signé et empreinte épinglée à l'appairage ; jeton par téléphone, révocable ; découverte `_gtracker._tcp` plus dernière adresse plus saisie ; appairage par QR ou code, une fois ; synchronisation à l'ouverture et sur bouton ; pas de tâche de fond.

### 7.2 Effort

Quatre lots, un sujet entier chacun :
1. **Moteur de synchronisation et « dossier distant » commun**, branché d'abord sur le câble (§7.4) : plan de différences, fusion, suppressions, journal, écran d'état, tests sur faux dossiers (`createFakeFolder` **[code]**).
2. **Serveur du PC** : serveur HTTPS dans Electron, certificat, appairage, jetons, liste des téléphones, annonce mDNS, règle de pare-feu (installateur ou message), page « Synchronisation » dans le .exe.
3. **Client du téléphone** : greffon Java `RemoteFolderPlugin` (TLS épinglé, jeton, découverte NSD, autorisation d'API 37 conditionnée par la version), `platform/remoteFolder.ts`, écran d'appairage dans Réglages, déclenchement à l'ouverture.
4. **Essais sur le vrai téléphone, politique de confidentialité, formulaires Play, relecture sécurité.**

Ordre de grandeur du code : téléphone environ 300 lignes Java et 300 de TypeScript ; PC environ 500 lignes (serveur, appairage, annonce) ; moteur commun environ 700 lignes avec tests **[supposé : estimation]**. Le lot 1 se fait sans rien de réseau et profite aussitôt au câble.

### 7.3 Pièges propres à ce moteur (ils valent pour les deux canaux)

- **Suppressions** : sans mémoire de la dernière synchronisation, une session supprimée d'un côté revient de l'autre. Il faut un fichier d'état (la liste des fichiers vus à la dernière synchronisation, par appareil) ou des pierres tombales ; décision de l'utilisateur ci-dessous.
- **Fiches JSON modifiées des deux côtés** : le projet a déjà une règle de fusion non destructive (`completeRecord` : un fichier présent ne reçoit que ce qui manque **[code : ETAT §6.1]**) ; le GPX « ne se réécrit jamais » donc il n'y a pas de conflit sur lui ; `reglages/<appareil>.json` est propre à un appareil, sans conflit ; `fc-repos.json` « fusionné entre appareils » **[code]**. Réutiliser ces fusions, ne pas en inventer.
- **Date et taille** : les dates de modification du dossier SAF et du dossier Windows ne se comparent qu'avec marge ; le moteur compare d'abord nom et taille, la date seulement pour arbitrer.
- **Fichiers lourds** : `.imu` ; transfert par blocs ou en flux, reprise après coupure, écriture en `.tmp`.
- **Sauvegarde Google et deux téléphones** : l'identifiant d'appareil des réglages est un risque déjà noté au lot 151 ; l'appairage lie un jeton à un téléphone, donc un téléphone restauré doit se réappairer.

### 7.4 Ce qui est commun avec le canal par câble

Interface unique, par exemple `RemoteFolder` :

```
list(chemin)  -> [{ nom, estDossier, taille, modifie }]
read(chemin)  -> octets          (plage facultative pour la reprise)
write(chemin, octets)            (via .tmp puis renommage)
remove(chemin)
stat(chemin)  -> { taille, modifie } | absent
```

- Le moteur de synchronisation ne connaît que cette interface ; le câble (quelle que soit sa forme) et le réseau en sont deux réalisations ; le dossier mémoire local du téléphone est déjà une troisième, `platform/memoryFolder.ts` **[code]**, et le dossier du PC une quatrième (le système de fichiers de Node).
- Commun : la liste des chemins admis (`gtracker.json`, `reglages/`, `itineraires/`, `sessions/`), les fusions, le journal, le fichier d'état, l'écran d'état et les messages, les tests.
- Propre au sans-fil : serveur, appairage, jetons, TLS, découverte, pare-feu, greffon.
- Le même serveur peut alors un jour servir un autre client (une page web locale) sans changer le moteur.

### 7.5 Risques

1. **Réseau isolé ou changeant** : le sans-fil échoue en silence pour l'utilisateur de la plage ; le message et le câble sont la parade.
2. **Pare-feu** : un compte standard, ou « Public » : le serveur existe mais est invisible ; la parade est un test d'auto-connexion du PC (le .exe se rappelle lui-même par son adresse réseau et dit « Windows bloque Gtracker : cliquez ici »), **[supposé que cela détecte bien la plupart des cas]**.
3. **Sécurité** : un port ouvert sur un réseau partagé ; mitigation §1.4 ; relecture avant la vente.
4. **Android 17 à cible 37** : le jour du passage, tout accès local est bloqué par défaut ; tester sur un téléphone d'API 37 avant, avec l'adb `am compat` décrit sur la page Android **[vérifié pour la commande Android 16 ; la page déclare l'option dépréciée, donc la procédure d'essai API 37 est à retrouver]**.
5. **Adresse du PC qui change** : mDNS peut être filtré ; saisie en dernier recours ; réservation d'adresse dans la box hors périmètre.
6. **Dépendance** : bibliothèque mDNS non vérifiée ; en cas de souci, la saisie suffit, mDNS est un confort.

### 7.6 Essais sur le vrai téléphone (peu, les vraiment utiles)

1. À la maison : appairer par code (ou QR), synchroniser une session avec `.imu` volumineux, et vérifier que la fiche, le GPX et le `.imu` arrivent identiques (taille et empreinte).
2. Changer l'adresse du PC (redémarrer la box ou changer de réseau) et vérifier que la découverte le retrouve ; puis sur un Wi-Fi invité de la box : le message de panne est lisible.
3. Sur le Xiaomi de l'utilisateur : l'application ouverte quelques secondes seulement, puis écran éteint en cours de transfert : la reprise se fait-elle au retour ? (C'est ce que ni les tests ni le banc ne voient.)
4. Sur un téléphone Android 17, si l'utilisateur en a un ou si l'émulateur API 37 le permet : le comportement de l'autorisation et du sélecteur (§2.1, point non vérifié du choix mémorisé).

## 8. Questions pour l'utilisateur, avec la réponse par défaut

1. **Le .exe sera-t-il livré avec un installateur (droits d'administrateur) ou en version portable ?** Défaut : installateur, qui ajoute la règle de pare-feu « réseaux privés » ; version portable : message d'aide avant la fenêtre de Windows.
2. **Le sans-fil doit-il rester facultatif, désactivé tant qu'on n'a pas appairé ?** Défaut : oui, désactivé ; le .exe n'écoute pas tant qu'aucun téléphone n'est appairé et que l'utilisateur n'a pas activé l'option.
3. **Qui gagne quand une fiche est modifiée des deux côtés ?** Défaut : fusion non destructive comme aujourd'hui (jamais d'écrasement, on complète) ; au besoin un indicateur « différence à regarder ».
4. **Une suppression se propage-t-elle d'un appareil à l'autre ?** Défaut : non en V1 ; la suppression reste locale, et une session absente d'un côté est recopiée. Moins dangereux (rien ne se perd par erreur) mais une session supprimée revient ; l'utilisateur peut demander la propagation avec une corbeille.
5. **Sens de la synchronisation** : dans les deux sens, ou seulement téléphone vers PC ? Défaut : dans les deux sens (il l'a demandé : « plus ou moins automatique »).
6. **Appairage par code tapé ou par QR ?** Défaut : code tapé (6 chiffres plus l'adresse affichée ; sans caméra, sans greffon de plus) ; QR plus tard si le besoin est là.
7. **Accepter qu'il n'y ait pas de synchronisation application fermée ?** Défaut : oui pour la V1 (§2.4) ; à rediscuter si l'usage l'exige.
8. **Faut-il refuser les Wi-Fi « publics » côté PC ?** Défaut : on n'écoute que sur les interfaces classées privées par Windows, et on le dit.

## 9. Sources

- https://developer.android.com/privacy-and-security/local-network-permission (lue en entier)
- https://developer.android.com/reference/android/net/nsd/NsdManager (via recherche)
- https://developer.android.com/develop/background-work/services/fgs/timeout (lue)
- https://support.google.com/googleplay/android-developer/answer/13392821 (via recherche, déclaration des services au premier plan)
- https://developer.android.com/google/play/requirements/target-sdk (via recherche, date du 31/08/2026)
- https://dontkillmyapp.com/xiaomi (lue ; MIUI 10 à 14, HyperOS non couvert)
- https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/rules (via recherche : règles créées pour un non-administrateur)
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-advfirewall (via recherche)
- https://www.electron.build/docs/nsis (via recherche)
- https://developer.chrome.com/blog/local-network-access (via recherche)
- https://forum.ionicframework.com/t/local-network-url-can-t-be-acessed-when-building-app/239607 ; https://medium.com/@aliyousefi-dev/ionic-http-not-working-on-lan-after-build-capacitor-fix-for-android-9-2fdd279aea84 (forums, clair et Capacitor : niveau « supposé »)
- https://www.tp-link.com/us/blog/2586/ ; https://watchguard.com/help/docs/help-center/en-us/Content/en-US/Fireware/wireless/ap_station_isolation_c.html ; https://community.tp-link.com/en/home/forum/topic/661906 (isolement des clients, multicast)
- Dépôt : `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle`, `docs/ETAT_DU_PROJET.md` §6.1, `docs/INVENTAIRE.md` (`MemoryFolderPlugin`, `memoryFolder.ts`), `docs/backlog/151-vente-mentions-legales.md`.

## 10. Ce qui n'a pas pu être vérifié

Comportement de l'API 37 en pratique (choix du sélecteur mémorisé, autorisation déjà accordée via Bluetooth) ; le détail de la configuration Capacitor du dépôt (schéma `https://localhost`, `server.cleartext`) ; la bibliothèque mDNS pour Electron ; l'effet exact de la fenêtre de pare-feu sur un exécutable Electron emballé ; HyperOS ; la lecture de QR sans autorisation ; les réponses de la section « Sécurité des données » de Google Play pour un transfert vers l'ordinateur de l'utilisateur ; le report éventuel de l'échéance de cible 36.
