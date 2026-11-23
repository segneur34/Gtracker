# 498 · Relier le téléphone à l'ordinateur sans risque d'intrus : plan retenu

Plan de l'agent Plan du 23/11 (deux passes), confronté par l'orchestrateur. Brief : section 498 de `493-relecture-avant-vente.md`. Lignes citées : celles du commit `d13131e`.

## Ce qui passe aujourd'hui, et pourquoi le code se retrouve hors ligne

Découverte en UDP : tout appareil du sous-réseau reçoit le port, l'identifiant fixe du PC et son nom Windows en clair (plafond de 20 réponses par seconde commun à tous, `sansFil.ts:1315-1324`). Un téléphone pas encore relié garde la première réponse (`ComputerLinkPlugin.java:352`), puis ouvre une liaison TLS sans vérifier le certificat (`:360`, `:1119`). Dans la liaison : `appairer{nonceT}`, `defi{nonceP}`, `preuve` = HMAC-SHA256(clé = les 6 chiffres, étiquette ‖ empreinte ‖ nonceT ‖ nonceP), `appaire{preuve du PC, jeton}`. Le téléphone prouve le premier, à un hôte qu'il n'a pas vérifié : un faux PC connaît l'empreinte et les deux nonces, la seule inconnue est le code (10^6 essais, quelques secondes), puis il fabrique la preuve du PC et son certificat est fixé dans le téléphone. Côté téléphone, `Connection.next` n'a pas d'échéance globale.

## Voie retenue : SPAKE2 (RFC 9382), calculé par la même bibliothèque des deux côtés

Rien ne change à l'écran : l'ordinateur affiche ses 6 chiffres dès « Relier un téléphone », on les tape sur le téléphone, puis « Relier ». Seuls changent des messages d'échec (dont `version` face à un appareil resté à l'ancienne version).

- Échange authentifié par mot de passe SPAKE2, suite P256-SHA256-HKDF-HMAC de la RFC 9382 : un intrus actif n'a qu'un code essayé par tentative (10^-6), rien à tester hors ligne.
- Une seule bibliothèque pour les opérations de courbe : `@noble/curves` 2.4.0 et `@noble/hashes` 2.4.0 (MIT, auditées, pur JavaScript), déjà posées à la racine par l'orchestrateur. Aucune arithmétique de courbe écrite à la main ; l'assemblage du protocole suit la RFC à la lettre et joue ses vecteurs.
- Sur le téléphone, le calcul se fait dans la page (TypeScript, même module que l'ordinateur) ; le greffon Java ne fait que transporter et ne voit jamais le code. Pas de BouncyCastle (4 à 6 Mo de moins, aucune inconnue sur les vieux Android).
- Écartées : la comparaison d'un code court tiré de la liaison (elle ajoute deux gestes : code affiché seulement une fois le téléphone trouvé, puis « Confirmer » sur l'ordinateur) ; le PC qui prouve le premier avec un code à usage unique (le code se retrouve hors ligne, et un intrus au milieu s'en sert contre le téléphone) ; le QR (change la décision du code tapé).

Texte de la RFC, à recopier pour M, N et les vecteurs de l'annexe B, jamais de mémoire : `D:\gong tracker\atelier\rfc9382\rfc9382.txt` (téléchargé de rfc-editor.org le 23/11).

## Spécification commune

- A = téléphone, B = PC. idA = « gtracker-telephone » ; idB = l'empreinte TLS vue (32 octets), ce qui lie l'échange à la liaison et fait échouer un relais. AAD = « gtracker-appairage-2 ».
- w = OS2IP(SHA-512(« gtracker-spake2-w » ‖ 0x00 ‖ code ASCII)) mod n. pA = x·G + w·M, pB = y·G + w·N, encodés SEC1 non compressés (65 octets).
- Contrôles : point décodé et validé par la bibliothèque, point neutre refusé ; K neutre refusé.
- TT, Ke‖Ka, KcA‖KcB et les confirmations (32 octets) : formules exactes de la RFC.
- Messages : `appairer` garde `nonceT` et ajoute `partA` (65 octets en hexadécimal) et la capacité `spake2` ; `defi` ajoute `partB` ; `preuve` porte cA (le téléphone confirme en premier) ; `appaire` porte cB (vérifié avant de rien garder), le jeton, l'identifiant et le nom du PC.
- Le PC refuse avec `version` tout `appairer` sans `partA`. Le téléphone neuf qui reçoit un `defi` sans `partB` (PC ancien) s'arrête sur `version` : il n'envoie jamais de preuve HMAC, ce qui interdit tout retour forcé à l'ancien échange.
- Découverte v2 : question à l'octet de version 2 ; la réponse remplace l'identifiant par HMAC-SHA256(identifiantPc, « gtracker-sonde » ‖ nonce) tronqué à 16 octets, nom vide.
- Les trames et sondes neuves sont figées par `bureau/sansFil.vecteurs.json` (partie B1), que le PC et le téléphone relisent dans leurs tests.

## Compatibilité

Appareils déjà reliés : `bonjour`, le jeton et le certificat fixé ne changent pas. Le PC neuf répond encore aux questions v1 (identifiant en clair, nom vide) : une APK ancienne déjà reliée retrouve son PC. Le téléphone neuf envoie les questions v1 et v2, préfère les réponses v2, accepte la v1 d'un PC ancien. Programme neuf et APK ancienne, ou l'inverse : la liaison par jeton marche, un nouvel appairage s'arrête sur `version` (« mettez à jour le plus ancien »). L'installeur embarque l'APK de la même version.

## Partie A (un agent) : B-06, B-07 pour le nom, D-10

- B-06 : compter par adresse source : 2 liaisons non reconnues par adresse (plafond global porté à 16), 3 réponses de découverte par seconde par adresse ; plafond global de la découverte porté à 200 par seconde (en UDP l'adresse source se falsifie ; au-delà, l'adresse connue ou tapée reste possible) ; délai de 3 s pour le premier message d'un inconnu (entrée `presentation` dans `DELAIS`) ; 3 codes faux ferment encore la fenêtre, mais le PC montre l'adresse d'origine de la tentative refusée.
- B-07 : nom vide dans toute réponse de découverte (le téléphone ne le lit pas). L'identifiant sous HMAC vient avec la découverte v2 (parties B2 et C).
- D-10 : `CODE_LENGTH` ajouté au test des constantes communes (`nativeConstants.test.ts:371`) ; `ComputerLinkCard.tsx` lit `maxLength` et le texte d'exemple de la constante ; un test vérifie que les textes contiennent « {CODE_LENGTH} chiffres », sans changer les clés de traduction ; `TAILLE_*` remplacent 32 et 16 dans `trames.ts` (déplacées dans `trames.ts`, réexportées par `appairage.ts`, pour éviter une boucle d'imports).

Fichiers de A : bureau/sansFil.ts, sansFil.test.ts (vers l. 356), trames.ts, appairage.ts ; src/components/ComputerLinkCard.tsx ; src/library/computerLink.test.ts ; src/platform/nativeConstants.test.ts ; pour l'origine des codes faux : src/platform/desktopBridge.ts, src/components/WirelessPhoneCard.tsx (et son `.css` si une classe s'ajoute ; aucun `style={{`), src/locales/en.json, es.json ; bureau/pont.ts seulement s'il recopie l'état champ par champ.

## Partie B1 (un agent, en même temps que A) : le calcul et les vecteurs

- Source unique du calcul : `bureau/spake2.ts`, pur, sur `@noble/curves/nist.js` et `@noble/hashes` (SHA-256, SHA-512, HMAC, HKDF), sans `node:` ; aléa et horloge passés en paramètre. La coquille l'importera par `appairage.ts` ; la page par `src/library/computerPairing.ts` (`../../bureau/spake2`). `bureau/tsconfig.json` a `rootDir "."` : la coquille ne peut pas importer `src/`, la page peut importer hors de son `include` (aucun précédent : à vérifier par `tsc -b`, le build de Vite et les gardes de `src/architecture.test.ts` ; l'agent pose pour cela un import d'essai dans un test de `src/`). Repli si c'est refusé : deux copies tenues égales par une section `spake2` des vecteurs communs.
- `bureau/spake2.test.ts` : vecteurs de l'annexe B de la RFC ; point neutre, hors courbe ou de mauvaise longueur refusés ; mauvais code ; relais entre deux empreintes qui échoue.
- `bureau/sansFil.vecteurs.json` : sondes v2, trames `appairer` et `defi` avec leurs champs neufs (et la section `spake2` : code, empreinte, x et y fixés, pA, pB, K, cA, cB).
- À vérifier : les noms de l'API de noble 2.x (`p256.Point`, `fromHex`, `ZERO`) ; le chargement du module depuis du CommonJS (la sortie de tsc de la coquille fait `require` d'un paquet qui n'existe qu'en ESM).

Fichiers de B1 : bureau/spake2.ts, spake2.test.ts (nouveaux), bureau/sansFil.vecteurs.json, un test d'essai de l'import côté `src/`. `docs/INVENTAIRE.md` est écrit par l'orchestrateur.

## Partie B2 (un agent neuf, après A et B1) : le PC

- `bureau/appairage.ts` et son test : `commencer(nonceT, partA)` rend partB, `conclure(cA)` rend cB et le jeton ; les preuves HMAC sont retirées ; l'en-tête qui sert de spécification est réécrit.
- `bureau/trames.ts`, `bureau/sonde.ts` (v1 et v2), `bureau/sansFil.ts`, et leurs tests.
- `bureau/fauxTelephone.ts` : nouvel échange ; dissocier `ancien` (sans capacité d'écriture, appairé par le nouvel échange) d'une option qui rejoue l'ancien échange pour vérifier le refus.
- `outils/bureau.mjs` : faire arriver le calcul dans le programme emballé. Retenu : dans `compiler()`, après tsc, regrouper `bureau/spake2.ts` et ses dépendances en un seul fichier CommonJS `<sortie>/spake2.js` avec le regroupeur déjà présent dans le dépôt (pas de `node_modules` dans l'asar, pas de `require` d'un module ESM à l'exécution, et le filtre de l'asar du lot 497 suit les `require` relatifs). Repli, à dire dans le rapport : recopier `node_modules/@noble` dans `<sortie>/node_modules/@noble`.
- Tests : fenêtre (3 cA faux la ferment, `appairer` ancien refusé avec `version`) ; le scénario du faux PC de l'audit (CONSTATS.md, B-01) repris dans `sansFil.test.ts` : le faux PC n'obtient rien ; découverte sous bruit avec les plafonds par adresse.

Fichiers de B2 : bureau/appairage.ts, appairage.test.ts, trames.ts, trames.test.ts, sonde.ts, sonde.test.ts, sansFil.ts, sansFil.test.ts, fauxTelephone.ts ; outils/bureau.mjs (`compiler()` seulement).

## Partie C (un agent neuf, après A et B1, en même temps que B2) : le téléphone

Qui appelle le greffon aujourd'hui : `ComputerLinkCard.tsx:81` (`view.pair`), `useComputerLink.ts:249` (`link.pair`), `src/platform/computerLink.ts:142` (`plugin.pair`) ; côté Java, `startPair` lance `pairNow`, d'un bloc sur le fil unique `worker`. L'appairage demande déjà la page vivante (`handleOnStop` coupe toute tentative). Page et greffon sont dans la même APK : `pair` se retire sans compatibilité interne.

- Greffon, `pair` remplacé par : `pairSearch({address?})` (découverte Java v1 et v2, rend 4 candidats au plus, ouvre la génération) ; `pairOffer({endpoint, partA})` (TLS sans empreinte fixée, `nonceT` tiré en Java, `appairer`, rend `{partB, fingerprint}` ou un refus) ; `pairConfirm({cA})` (envoie `preuve`, rend `{cB, computerName}` ou un refus, garde le reste en attente) ; `pairFinish({keep, folder?, base?, error?})` (garde et sert, ou ferme en posant l'erreur choisie par la page).
- En attente dans un champ unique du greffon : la socket TLS et son empreinte, l'adresse, la génération, l'échéance, puis après `appaire` le jeton, l'identifiant et le nom du PC. Le jeton ne traverse jamais le pont. Les préférences (même bloc que `ComputerLinkPlugin.java:387-394`) puis `startServing` ne sont écrits qu'à l'ordre « garder » ; tout autre cas ferme et n'écrit rien.
- Pièges : chaque appel porte la génération du `pairSearch` qui l'a ouvert (`stopAll` l'augmente : l'étape suivante échoue en `network`) ; la socket en attente entre dans `attemptSockets` ; échéance globale de 20 s depuis l'ouverture, armée par une tâche planifiée qui ferme la socket (`ScheduledExecutorService` ou `Handler` différé), `setSoTimeout` recalculé à chaque lecture ; chaque étape fait sa lecture sur `worker` puis rend ; octets en hexadécimal dans les `JSObject` ; codes d'erreur filtrés par une liste comme `ERRORS`.
- La liaison par jeton, le HMAC de la sonde v2 (vérifié ; un certificat faux passe au candidat suivant) et l'échéance restent en Java, sans courbe.
- Page : `src/platform/computerLink.ts` (port) ; nouveau `src/library/computerPairing.ts`, qui conduit les étapes avec un port injecté (x neuf à chaque candidat ; un `defi` sans `partB` donne `version` ; ordre des erreurs : code, proof, fenêtre, réseau ; jamais `keep` si cB diffère) ; `src/hooks/useComputerLink.ts` ; `src/library/computerLink.ts` si une phrase change.
- Tests : `src/library/computerPairing.test.ts` avec un faux port (jamais `keep` si cB diffère, boucle sur les candidats, x neuf à chaque essai) ; `ComputerLinkProtocolTest.java` (`partA`, `partB`, sonde v2 par les vecteurs) ; `src/platform/nativeConstants.test.ts` (capacité `spake2`, version de sonde, étiquette de la sonde). Le test de bout en bout sans appareil (vrai serveur de `bureau/sansFil.ts` face à `computerPairing` sur un port en TLS de Node, dans `bureau/sansFil.test.ts`) est écrit après la fusion de B2 et de C.

Fichiers de C : android/app/src/main/java/io/github/segneur/gtracker/ComputerLinkPlugin.java, ComputerLinkProtocol.java ; android/app/src/test/java/…/ComputerLinkProtocolTest.java ; src/platform/computerLink.ts, nativeConstants.test.ts ; src/library/computerPairing.ts et computerPairing.test.ts (nouveaux), computerLink.ts ; src/hooks/useComputerLink.ts ; src/locales/en.json, es.json si un message change.

## Banc (un autre agent, après les commits)

`outils/banc/exe-sansfil.mjs` (vers l. 631 : téléphone « ancien » ; textes de l'origine des codes faux) et `exe-synchroniser.mjs` si les options du faux téléphone changent, après `npm run exe` (ils lisent `bureau/dist/fauxTelephone.js`).

## Questions tranchées par l'orchestrateur le 23/11

- La voie retenue n'ajoute aucun geste à l'écran : la question prévue pour l'utilisateur n'a pas lieu d'être posée.
- Calcul du téléphone dans la page, sans BouncyCastle.
- L'appairage d'une APK ancienne est refusé (`version`), sa liaison par jeton reste ; la réponse de découverte v1 est gardée pour elle, à retirer plus tard.
- 3 codes faux ferment encore la fenêtre, avec l'origine affichée ; délai de présentation de 3 s.
- Les notices MIT de noble rejoignent la liste des licences (suite du lot 499).

## Essais au téléphone

1. APK neuve et programme neuf : relier par code sur le partage de connexion, puis « Synchroniser » → le téléphone se relie avec le code à 6 chiffres comme avant, et la synchronisation passe.
2. Un téléphone relié avant la mise à jour → il reste relié après l'installation des deux, sans nouvel appairage.
