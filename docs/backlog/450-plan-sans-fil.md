# 450 · Synchroniser sans câble : plan en six parties

Modèle | Réflexion : par partie (ci-dessous). Plan de l'agent `Plan` du 20/11 sur l'étude `docs/backlog/445-exe-etude-sans-fil.md`, condensé par l'orchestrateur. Demande : `node outils/backlog.mjs --ligne 450`.

## Ce que 450 livre sans le 449

Le Wi-Fi devient un second canal derrière le « dossier distant » du lot 447 (`bureau/telephone.ts`, interface `DossierDistant` : `etat / lister / lire`, lecture seule ; bouton « Récupérer » : `src/platform/phoneCable.ts`, `src/hooks/sessionLibrary/phoneRecovery.ts`, `src/library/phoneRecovery.ts`, `src/components/PhoneRecoverButton.tsx`), dans le sens téléphone → PC seulement : on ouvre l'application du téléphone près du PC allumé, et le PC range les sessions qu'il n'a pas, sans câble ni débogage USB. Rien n'est écrit sur le téléphone. Le sens PC → téléphone, les fiches modifiées et les suppressions viennent avec le 449, branché sur ce canal sans rien refaire.

## Architecture

- Le PC (processus principal d'Electron) écoute ; le téléphone se connecte, rien n'écoute sur le téléphone.
- Liaison inversée (écart à l'étude, §2.2) : une fois connecté, le téléphone se présente et c'est le PC qui le lit par cette liaison, comme il lit le câble ; le contrat du 447 et le moteur du 449 sont pilotés par le PC.
- Découverte : dernière adresse connue (1 s), puis une question en diffusion UDP sur le réseau local à laquelle le PC répond par adresse, port et identifiant (3 s), sinon l'adresse se saisit. Pas de mDNS (l'emballage ne copie aucun `node_modules` : `outils/bureau.mjs`), pas de QR.
- Protocole : socket TLS brute (`node:tls` côté PC, `SSLSocket` Java côté téléphone), pas de HTTP. Trames : longueur, en-tête JSON, octets. Commandes du PC : `lister`, `lire(chemin, début, longueur)` par blocs de 1 Mo, `ping`. Certificat auto-signé fabriqué par le programme (encodeur DER maison sur `crypto.sign`, relu en test par `X509Certificate`) ; le téléphone fixe son empreinte à l'appairage.
- Appairage par code tapé : le PC ouvre une fenêtre de 2 minutes, affiche adresse, port et code de 6 chiffres ; les deux se prouvent la connaissance du code par un HMAC du code sur l'empreinte et deux nonces, sans envoyer le code ; trois échecs ferment la fenêtre ; le PC donne alors au téléphone un jeton de 256 bits.
- Secrets : PC, hachage du jeton et nom du téléphone dans le profil (`%APPDATA%\Gtracker`), jamais dans le dossier mémoire ; clé du certificat chiffrée par `safeStorage`. Téléphone : jeton, empreinte, dernière adresse dans les SharedPreferences privées du greffon ; la page web ne voit jamais le jeton.
- Ce qui transite : la liste et les octets des fichiers de la racine et de `sessions/` du dossier mémoire désigné du téléphone (arbre SAF).
- Dépendances : aucun paquet npm, aucun greffon tiers ; un greffon Java maison ; permission `ACCESS_NETWORK_STATE` ; `ACCESS_LOCAL_NETWORK` déclarée et demandée seulement à partir de l'API 37 (cible 36). Pare-feu Windows : fenêtre au premier `listen()`, annoncée par l'application juste avant ; essai d'auto-connexion pour dire « Windows bloque Gtracker ».
- Déjà tranché (étude et utilisateur) : le PC écoute ; code tapé ; application du téléphone ouverte seulement, ni tâche de fond ni service ; écoute sur les réseaux privés seulement ; sans-fil éteint tant qu'on n'a pas appairé ; pas d'installeur avant le 451 ; le câble reste en repli.
- Tranché par l'orchestrateur le 20/11 : un PC accepte plusieurs téléphones, un téléphone ne connaît qu'un PC (D3) ; quand le PC ne trouve aucun téléphone, le message invite d'abord à ouvrir Gtracker sur le téléphone, sur le même Wi-Fi, et propose le câble en second (D4).

## Parties (un commit chacune, arbre vert)

**P1 · Protocole et appairage, calcul pur** (Opus high, aucune décision). Fichiers neufs, chacun avec son `*.test.ts` : `bureau/trames.ts` (encodage, décodage, limites de taille), `bureau/appairage.ts` (code, preuves HMAC, jeton et son hachage, fichier des téléphones appairés, durée de la fenêtre), `bureau/certificat.ts`, `bureau/sonde.ts` (question et réponse UDP), `bureau/sansFil.vecteurs.json` (jeux d'essai partagés avec les tests Java). À réutiliser : `segmentAdmis`, `ErreurDisque` (`bureau/disque.ts`), `cheminAdmis`, `fichiersAdmis` (`bureau/telephone.ts`). Tests : aller-retour des trames, trame tronquée ou trop longue, bon et mauvais code, nonce rejoué, fenêtre expirée, jeton révoqué, certificat relu avec sa clé.

**P2 · Serveur du PC dans la coquille** (Opus high, après P1, aucune décision). Neufs : `bureau/sansFil.ts` (serveur TLS sur le port 48217 avec repli sur un port voisin, lié aux seules adresses IPv4 privées ; téléphones connectés, liaison surveillée, `dossierSansFil()`, lecture par blocs en comparant les tailles, essai d'auto-connexion), `bureau/fauxTelephone.ts` (client Node qui joue le téléphone, pour les tests et le banc), leurs tests. Modifiés : `bureau/main.ts` (« Wi-Fi d'abord, sinon câble » ; canaux `sansfil:etat|activer|ouvrirAppairage|telephones|retirer` ; avis « téléphone arrivé » à la page ; variables d'essai `GTRACKER_BANC_SANSFIL*`), `bureau/preload.ts`, `bureau/pont.test.ts`. Tests sur une vraie socket en 127.0.0.1 : appairage complet, refus hors fenêtre, jeton révoqué, gros fichier, coupure en pleine lecture (rien dans le dossier temporaire), retour au câble sans téléphone.

**P3 · Page du PC** (Sonnet high, attend D1). Modifiés : `src/platform/desktopBridge.ts`, `src/platform/phoneCable.ts` (l'état dit le canal), `src/hooks/sessionLibrary/phoneRecovery.ts` (déclenchement à l'arrivée du téléphone), `src/components/PhoneRecoverButton.tsx`, la section Mémoire de Réglages, dictionnaires. Neufs : `src/platform/wirelessPhone.ts` et son test, `src/components/WirelessPhoneCard.tsx` et son `.css` (activer avec l'explication du pare-feu, appairer : adresse, code, compte à rebours ; liste des téléphones avec « Retirer »).

**P4 · Greffon Java du téléphone** (Opus high, après P1). Neufs : `ComputerLinkPlugin.java`, `ComputerLinkProtocol.java`, `ComputerLinkProtocolTest.java` sur les mêmes jeux d'essai. Sonde UDP, TLS à empreinte fixée, preuve d'appairage, jeton, réponses à `lister` et `lire` depuis l'arbre SAF ; l'accès à l'arbre sort de `MemoryFolderPlugin.java` dans une classe commune en lecture seule, sans changer son comportement ; `.gtracker-tmp` et `.gtracker-new` cachés. Modifiés : `MainActivity.java`, `AndroidManifest.xml`, `src/platform/androidManifest.test.ts`, `src/platform/nativeConstants.test.ts`.

**P5 · Téléphone, côté page** (Sonnet high, après P4, attend D2). Neufs : `src/platform/computerLink.ts` et son test, `src/hooks/useComputerLink.ts` (connexion à l'ouverture et au retour au premier plan, sur Wi-Fi seulement), le bloc « Ordinateur » de Réglages › Mémoire (PC trouvé ou adresse à saisir, code, état, « Oublier cet ordinateur »), dictionnaires.

**P6 · Banc** (Sonnet high, après P2 et P3). `outils/banc/exe-sansfil.mjs`, hors registre comme `memoire-disque.mjs` : vrai programme en mode d'essai avec `fauxTelephone` ; code lu sur la page, appairage, « 3 ajoutées » puis « 3 déjà là », mauvais code, fenêtre expirée, téléphone retiré puis refusé, coupure en plein transfert. `exe-recuperer.mjs` (le câble marche toujours) et `memoire-disque.mjs` (aucun secret dans le dossier mémoire) s'étendent ; `SCRIPTS.md` à jour.

Ordre : P1, puis P2 et P4 ensemble ; P3 après P2, P5 après P4 ; P6 après P3.

## P1 livré le 20/11 (ce que P2 et P4 doivent savoir)

- Le format exact (ordre des octets, encodages, entrées du HMAC, forme du registre) est décrit en tête de `bureau/trames.ts`, `appairage.ts`, `certificat.ts` et `sonde.ts` ; les jeux d'essai communs aux deux côtés sont dans `bureau/sansFil.vecteurs.json`, trames invalides comprises (dont l'en-tête précédé d'une marque d'ordre d'octets, refusé).
- Messages : `appairer`, `bonjour`, `defi`, `preuve`, `appaire`, `bienvenue`, `refus` ; commandes `lister`, `lire`, `ping` (avec `id`) ; réponses `liste`, `bloc` (octets dans le corps), `pong`, `erreur`. Constantes : `PROTOCOLE_SANS_FIL` 1, `PORT_SANS_FIL` 48217, `PORT_SONDE` 48218, bloc de 1 Mio.
- `new DecodeurTrames()` part avec `LIMITES_ACCUEIL` (en-tête 16 Kio, corps 0) : les limites larges (`LIMITES`) se posent explicitement une fois le téléphone reconnu (`bienvenue` ou `appaire`).
- Appairage : nonces de 32 octets, HMAC-SHA256 dont la clé est le code ; le téléphone prouve le premier ; une tentative ne se conclut qu'une fois ; un succès ou trois échecs ferment la fenêtre, de même que la onzième tentative commencée (`TENTATIVES_MAX`). Jeton de 32 octets, le PC n'en garde que le SHA-256.
- Certificat ECDSA P-256 auto-signé ; sonde : l'adresse du PC n'est pas dans la réponse, le téléphone prend l'adresse source du paquet ; seules les plages privées RFC 1918 sont admises.

## P2 livré le 20/11 (ce que P3 et P6 doivent savoir)

- `bureau/sansFil.ts` (`ServeurSansFil`) : éteint tant que l'utilisateur n'a pas activé le sans-fil (choix gardé dans le profil) ; secrets dans `%APPDATA%\Gtracker\sansfil\` ; `dossierSansFil()` rend un `DossierDistant` sur le dernier téléphone arrivé ; `main.ts` prend le Wi-Fi d'abord, sinon le câble, et `EtatTelephone.pret` dit son canal (`canal?: 'sansFil' | 'cable'`).
- Pont `window.gtrackerBureau.sansFil` (chaque appel rend `{ ok, valeur }` ou `{ ok: false, code, message }`) : `etat()` → `{ actif, ecoute, port, adresses, pareFeu: 'ouvert'|'bloque'|'inconnu', erreur, appairage: AppairageOuvert|null, relies: {id, nom}[] }` ; `activer({ actif })` → le même état ; `ouvrirAppairage()` → `{ adresse, port, code, expireA, restantMs }` (refusé si le sans-fil est éteint ou sans réseau) ; `telephones()` → `[{ id, nom, ajouteLe, vuLe, relie }]` ; `retirer({ id })` → booléen ; `surArrivee(rappel)` : le rappel reçoit `{ id, nom, nouveau }`, l'appel rend le désabonnement.
- L'essai de pare-feu peut dire « ouvert » alors que le téléphone reste bloqué (Windows ne filtre pas le trafic du PC vers lui-même) : la page ne le présente pas comme une certitude. Aucun canal ne ferme une fenêtre d'appairage : elle se ferme à 2 minutes, au succès ou au troisième échec.
- Variables d'essai (lues seulement avec `GTRACKER_BANC=1`, serveur sur 127.0.0.1) : `GTRACKER_BANC_SANSFIL_ACTIF=1`, `_PORT` (0 par défaut : port libre, à lire dans `etat`), `_SONDE`, `_FENETRE_MS`, `_PROFIL`. `bureau/fauxTelephone.ts` : `sonder(hote, port)`, `new FauxTelephone({ dossier, coupureApresBlocs? })`, `.appairer(hote, port, code)`, `.connecter()` ; compilé dans `bureau/dist`.

## P4 livré le 20/11 (ce que P5 doit savoir)

- Greffon `ComputerLink` (`ComputerLinkPlugin.java`, protocole pur dans `ComputerLinkProtocol.java`, lecture SAF commune dans `MemoryTree.java`). Méthodes, chacune rend l'objet d'état : `status()` ; `pair({ code, address?, folder? })` (code de 6 chiffres, adresse « a.b.c.d[:port] » privée seulement, `folder` = adresse SAF du dossier mémoire) ; `connect({ address?, folder? })` (sans effet si la liaison existe, met à jour `folder`) ; `forget()`. Refus d'appel : `BAD_CODE`, `BAD_ADDRESS`. Événement `status`, de même contenu, à chaque changement.
- Objet d'état : `{ state, error, paired, computerName, address, lastSentMs, sentFiles, onLocalNetwork }` ; `state` : `unpaired | idle | searching | pairing | linked | notFound` ; `error` : `null | noLocalNetwork | localNetwork | code | window | nonce | token | version | certificate | proof | network | protocol`. Jeton et empreinte ne sont jamais rendus à la page.
- La page passe `folder` à `pair` et `connect` ; le hook se règle sur `onLocalNetwork`, pas sur le Wi-Fi (partage de connexion compris) ; la liaison se ferme quand l'application passe à l'arrière-plan (`handleOnStop`) : la relancer au retour au premier plan. Un refus `token` efface le jumelage du téléphone.

## Reste à faire après le 20/11 (parties 1 à 5 commitées, rien d'éprouvé sur le vrai programme ni sur le téléphone)

1. **Sous-dossier du dossier mémoire, à corriger avant tout essai** (vu par la partie 5) : `ComputerLinkPlugin` lit la racine de l'arbre SAF passé en `folder` et ne connaît pas le sous-dossier `base` de `src/platform/memoryFolder.ts`. Quand l'utilisateur a désigné `Documents` et que la mémoire est dans `Documents/Gtracker`, le PC lirait `Documents`. La page coupe ce cas pour l'instant (le bloc « Ordinateur » dit de désigner le dossier Gtracker lui-même et ne relie pas). Correction propre : un paramètre `base` que la page passe à `pair` et `connect`, résolu côté Java dans `MemoryTree` ; relecture, tests Java. Vérifier d'abord quel dossier le téléphone de l'utilisateur a désigné.
2. **P6, le banc** (Sonnet high) : `outils/banc/exe-sansfil.mjs` sur le vrai programme avec `fauxTelephone` (variables `GTRACKER_BANC_SANSFIL*`), `exe-recuperer.mjs` (le câble marche toujours) et `memoire-disque.mjs` (aucun secret dans le dossier mémoire) étendus. Sélecteurs du bloc du PC : `.wireless-card`, `__toggle`, `__status`, `__warning`, `__hint`, `__error`, `__pairing` (`__address`, `__code`, `__countdown`), `__result`, `__phones li` ; ligne d'arrivée `.phone-recover__arrival`. Textes attendus : « Gtracker attend votre téléphone sur le réseau (adresse 127.0.0.1). », « Téléphone d'essai relié : 3 sessions ajoutées. » puis « … toutes ses sessions sont déjà là. ». Une capture du bloc du PC et du bloc « Ordinateur » du téléphone, à relire.
3. **Limites connues** : l'essai du pare-feu peut dire « ouvert » à tort ; Windows classe un réseau neuf (partage de connexion) en « Public » alors que le serveur n'écoute que sur les adresses privées et que la règle du pare-feu peut ne valoir que pour « Privé » : à éprouver en premier ; un enregistrement qui démarre pendant une liaison ouverte ne la ferme pas (le greffon n'a pas de méthode d'arrêt) ; `fauxTelephone` est compilé dans `bureau/dist` avec le programme ; la faiblesse du code de 6 chiffres attend la relecture de sécurité d'avant la vente.
4. **Textes à faire relire par l'utilisateur** : bloc du PC (« Téléphone sans câble », « Recevoir les sessions du téléphone sans câble », « Relier un téléphone », « Téléphones reliés », « Retirer ») et bloc du téléphone (« Ordinateur », « Relier », « Chercher l'ordinateur », « Oublier cet ordinateur », et les phrases d'état et d'échec de `src/library/computerLink.ts`).
5. **Essais au téléphone, après 1 et 2** : ceux de la section « Essais au téléphone », en commençant par le partage de connexion dans les deux sens (l'utilisateur n'a pas de box), puis le câble toujours possible.

## Questions posées à l'utilisateur le 20/11, et sa réponse

Réponse du 20/11 au soir, pour les trois : « j'ai pas d'avis, le plus simple je dirais et surtout le plus robuste ». L'orchestrateur retient donc les recommandations, qui sont les plus simples :

- D1, quand le téléphone se présente : le PC range seul les sessions neuves et le dit par une ligne discrète (l'ajout ne supprime ni n'écrase jamais rien). P3 n'attend plus.
- D2, où le téléphone dit qu'il est relié : dans Réglages › Mémoire seulement, rien ne bouge dans les écrans principaux. P5 n'attend plus.
- Sécurité de l'appairage : code de 6 chiffres pendant 2 minutes, trois essais ; faiblesse connue : pendant ces 2 minutes, un intrus actif sur le même Wi-Fi pourrait retrouver le code ; relecture de sécurité avant la vente, parade possible : code plus long.

## Sans box : partage de connexion (dit par l'utilisateur le 20/11 au soir)

« par exemple moi j'ai pas la wifi ça marcherait avec un partage de connexion du pc ? », et « il faudra quand même une connexion par câble possible » (le câble reste : « Récupérer » prend le Wi-Fi quand un téléphone y est relié, sinon le câble). L'utilisateur lui-même essaiera donc sur un partage de connexion. Deux cas à tenir, sans réglage : le PC partage sa connexion (point d'accès de Windows, PC en 192.168.137.1) et le téléphone s'y connecte ; le téléphone partage la sienne et le PC s'y connecte (le réseau actif du téléphone est alors le réseau mobile). Conséquences : côté téléphone, aucune condition « Wi-Fi seulement » fondée sur le réseau actif, sonde envoyée vers l'adresse de diffusion de chaque interface locale privée, liaison ouverte depuis la bonne interface ; côté PC, le point d'accès de Windows est une adresse privée comme une autre, mais Windows peut classer ce réseau « public » et le pare-feu bloquer alors le téléphone : à dire dans la page (cocher aussi les réseaux publics dans ce cas, ou le câble) et à éprouver à l'essai.

## Risques

Pare-feu Windows (compte non administrateur : règles de blocage quel que soit le choix ; réseau « Public » bloqué, voulu) ; Android coupe la liaison en veille (rien d'écrit à moitié côté PC, reprise au retour au premier plan) ; cible 37 : `ACCESS_LOCAL_NETWORK` bloquée par défaut, à éprouver le jour venu ; Wi-Fi invité qui isole ses appareils (message en clair, câble en repli).

## Essais au téléphone (3)

1. Activer le sans-fil sur le PC (fenêtre de Windows, cocher « privés »), appairer par le code, rouvrir l'application : les sessions arrivent sur le PC, dont une avec un gros fichier de capteurs, de taille identique.
2. Changer l'adresse du PC (redémarrer la box) : à l'ouverture suivante, le téléphone le retrouve sans rien saisir.
3. Quitter l'application ou éteindre l'écran en plein transfert : rien d'écrit à moitié sur le PC, la fin arrive à la réouverture.
