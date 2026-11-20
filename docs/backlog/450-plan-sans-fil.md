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

Ordre : P1, puis P2 et P4 ensemble ; P3 et P5 attendent les réponses ; P6 après P3.

## Questions posées à l'utilisateur le 20/11, et sa réponse

Réponse du 20/11 au soir, pour les trois : « j'ai pas d'avis, le plus simple je dirais et surtout le plus robuste ». L'orchestrateur retient donc les recommandations, qui sont les plus simples :

- D1, quand le téléphone se présente : le PC range seul les sessions neuves et le dit par une ligne discrète (l'ajout ne supprime ni n'écrase jamais rien). P3 n'attend plus.
- D2, où le téléphone dit qu'il est relié : dans Réglages › Mémoire seulement, rien ne bouge dans les écrans principaux. P5 n'attend plus.
- Sécurité de l'appairage : code de 6 chiffres pendant 2 minutes, trois essais ; faiblesse connue : pendant ces 2 minutes, un intrus actif sur le même Wi-Fi pourrait retrouver le code ; relecture de sécurité avant la vente, parade possible : code plus long.

## Risques

Pare-feu Windows (compte non administrateur : règles de blocage quel que soit le choix ; réseau « Public » bloqué, voulu) ; Android coupe la liaison en veille (rien d'écrit à moitié côté PC, reprise au retour au premier plan) ; cible 37 : `ACCESS_LOCAL_NETWORK` bloquée par défaut, à éprouver le jour venu ; Wi-Fi invité qui isole ses appareils (message en clair, câble en repli).

## Essais au téléphone (3)

1. Activer le sans-fil sur le PC (fenêtre de Windows, cocher « privés »), appairer par le code, rouvrir l'application : les sessions arrivent sur le PC, dont une avec un gros fichier de capteurs, de taille identique.
2. Changer l'adresse du PC (redémarrer la box) : à l'ouverture suivante, le téléphone le retrouve sans rien saisir.
3. Quitter l'application ou éteindre l'écran en plein transfert : rien d'écrit à moitié sur le PC, la fin arrive à la réouverture.
