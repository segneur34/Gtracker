# 482 · « Synchroniser » sans câble dans les deux sens (partie « 449-c ») : plan

Plan de l'agent Plan du 21/11, retenu par l'orchestrateur. Plan d'ensemble : `docs/backlog/449-plan-synchroniser.md` ; sans-fil existant : `docs/backlog/450-plan-sans-fil.md` ; itinéraires : `docs/backlog/481-itineraires.md`.

## L'existant

Côté page, tout est déjà indépendant du canal : `phoneCanWrite(state)` et `phoneListsRoutes(state)` (`src/platform/phoneCable.ts`) ne lisent que `ecriture` et `itineraires` de l'état prêt (`bureau/telephone.ts`), `phoneSync.ts` les transmet, `syncReport.ts` en tire les phrases « attendent le câble ». Le trou est dans la coquille et le greffon : `dossierSansFil()` (`bureau/sansFil.ts`) n'a ni `ecrire` ni `effacer` ; la `liste` est filtrée par `cheminAdmis` (racine et `sessions/` seulement, `trames.ts`) ; le greffon ferme la liaison sur toute commande inconnue (`ComputerLinkPlugin.java`, `ComputerLinkProtocol.java`).

## À réutiliser, sans rien créer

- l'interface commune `DossierDistant` (`telephone.ts`) : `ecrire?(chemin, fichierLocal, taille)` et `effacer?` ;
- les gestionnaires `telephone:ecrireOctets` et `telephone:effacer` (`telephone.ts`) ; `dossierSansFilPuisCable` (`sansFil.ts`) ;
- `cheminEcrivable`, `cheminDuCable`, `nomProvisoire`, `commeLeTelephone` (`telephone.ts`) ; `blocsDeLecture`, `Commandes`, `reponseAttendue` (`sansFil.ts`) ;
- côté Android : `replace`, `createNew`, `finishInterruptedReplace` (`MemoryFolderPlugin.java`), `RecordingService.snapshot().running`, `MemoryTree`.

## Protocole et compatibilité

- `PROTOCOLE_SANS_FIL` reste à 1 : l'ancien PC refuse toute autre version, changer couperait une APK neuve d'un programme ancien, et inversement.
- Négociation par un champ facultatif `capacites: ["ecriture"]` dans `appairer` et `bonjour` (les champs inconnus sont ignorés par contrat). Un PC ancien lit une APK neuve en lecture seule ; un PC neuf face à une APK ancienne (sans le champ) annonce `ecriture: false, itineraires: false`, n'envoie jamais de commande neuve, et la ligne « attendent le câble » reste.
- La capacité « ecriture » vaut listage complet ET écriture, jamais l'un sans l'autre (écrire sans lister `reglages/` ferait recopier une copie ancienne par-dessus le fichier de réglages propre au téléphone).
- Commandes neuves : `ecrire { id, chemin, debut, taille }` avec un corps de 1 Mio au plus (seule commande à corps), `valider { id, chemin, taille }`, `effacer { id, chemin }`. Réponses neuves : `ecrit { id, chemin, taille, dateMs }`, `fait { id }` ; `pong` reçoit un champ facultatif `enregistre`.
- `lire` et `liste` passent à `cheminDuCable` (`itineraires/`, `reglages/`) ; `ecrire`, `valider` et `effacer` sont bornés à `cheminEcrivable`, des deux côtés.

## Protections du greffon

- appairage et jeton (déjà en place) ;
- liste blanche Java `writeAllowed`, identique à `cheminEcrivable` (contrôlée par `nativeConstants.test.ts`) ; `inBase` vérifié ;
- refus si `RecordingService.snapshot().running` à chaque `ecrire` et `effacer` ;
- écriture sous `.gtracker-new` ou `.gtracker-tmp` (choisi par le téléphone, qui sait ce qui existe), flux tenu ouvert pour la liaison, blocs dans l'ordre (`debut` égal à ce qui est déjà écrit) ; `valider` relit la taille puis supprime l'original et renomme (ordre de `replace`) ;
- liaison coupée : flux fermé et provisoire effacé ;
- `lister` termine d'abord les échanges interrompus (sinon un `.gtracker-tmp` resté seul ferait croire la session supprimée sur le téléphone) ;
- une liste des noms en cours d'écriture, dans `MemoryTree`, que `MemoryFolderPlugin.list` ne nettoie pas.

## Parties (un commit chacune)

- **A · Protocole pur, bureau (Opus high).** (1) `trames.ts` : types, `lireMessage`, `encoderMessage`, en-tête du fichier ; corps admis pour `ecrire`. (2) `capacites` lu dans `appairer` et `bonjour`. (3) Filtres `cheminDuCable` et `cheminEcrivable`. (4) `sansFil.vecteurs.json` : trames valides (`ecrire` avec corps, `valider`, `effacer`, `ecrit`, `fait`, `bonjour` avec capacités) et invalides (chemin hors liste, corps sur `valider`, `debut` négatif), plus une table `cheminsEcriture` (admis et refusés). (5) `trames.test.ts`.
- **B · Serveur et faux téléphone (Opus high).** (1) `Relie.capacites` ; `etat()` donne `ecriture` et `itineraires`, et un `ping` frais quand le téléphone écrit (`enregistre` donne `ecriture: false`). (2) `ecrire` (lecture du fichier local par blocs de 1 Mio, puis `valider`, qui rend le `FichierTelephone`) et `effacer` ; refus sans rien envoyer à un téléphone sans la capacité. (3) `Commandes.recevoir` accepte `ecrit` et `fait`. (4) `dossierSansFilPuisCable` lit `ecriture` dans l'état, et non plus la présence des méthodes. (5) `fauxTelephone.ts` écrit comme le greffon (provisoires, `valider`, `effacer`, listage des trois dossiers et `commeLeTelephone`), avec les options `ancien`, `enregistre`, `coupureApresEcritures`. (6) Tests sur socket réelle (`sansFil.test.ts`) : fichier neuf, remplacement, effacement, chemin refusé, taille fausse, coupure en pleine écriture (original intact, aucun provisoire visible), téléphone ancien, enregistrement en cours, gros fichier.
- **C · Greffon Android (Opus high, APK).** (1) `ComputerLinkProtocol.java` : décodage et encodeurs neufs, `capacites` dans `encodeHello` et `encodePair`, `pathAllowed` étendu, `writeAllowed`, machine pure `WriteSession` (ordre des blocs, taille annoncée, suffixe). (2) `ComputerLinkPlugin.java` : `serve` traite `ecrire`, `valider`, `effacer` ; listage des trois dossiers ; garde de l'enregistrement ; nettoyage à la coupure. (3) Écriture partagée sortie de `MemoryFolderPlugin` vers `MemoryTree`, ou vers un `MemoryWriter.java` neuf (alors `docs/INVENTAIRE.md` dans le même commit), comportement inchangé ; noms en cours d'écriture épargnés. (4) `ComputerLinkProtocolTest.java` sur les vecteurs, plus `WriteSession` ; `MemoryTreeTest` si une pièce pure y entre. (5) `nativeConstants.test.ts` : même nom de capacité et même liste blanche des deux côtés.
- **D · Page (Sonnet high).** (1) `desktopBridge.ts` et `phoneCable.ts` : `enregistrement` dans l'état prêt. (2) `syncReport.ts` : la ligne « Le téléphone enregistre une session : il n'a pas été modifié cette fois. » à la place de « N changements attendent… ». (3) `en.json`, `es.json` ; tests de `syncReport` et de `phoneSync`. (4) La phrase du bloc « Ordinateur » (voir « Tranché »).
- **E · Banc, commit à part (Sonnet).** `outils/banc/exe-sansfil.mjs`, téléphone à jour : première synchronisation par le Wi-Fi (copie de sécurité, `id` et `synchro` posés dans `gtracker.json` du faux téléphone, sessions copiées vers lui, aucun provisoire) ; plus de « Sans câble… » ni de ligne des itinéraires ; itinéraires dans les deux sens ; suppressions de chaque côté (corbeille de l'ordinateur) ; coupure en pleine écriture puis « Réessayer ». Téléphone `ancien` : les contrôles actuels, inchangés. Téléphone `enregistre` : rien d'écrit, la phrase. `outils/banc/exe-synchroniser.mjs` : une option `--sansfil` qui rejoue les cas c, d, e, f, r et rg sur le faux téléphone, mêmes contrôles (preuve que le même moteur sert) ; `SCRIPTS.md`.

Ordre : A, puis B et C (indépendants), puis D, puis `npm run exe` et E, puis l'APK. Règles : 12 (aucun pont hors de `src/platform/` ; les canaux `telephone:*` sont inchangés, `pont.test.ts` aussi), 14, textes par `t` et `tn`, aucun `style={{` neuf, DECISIONS §8.

## Risques

- course entre `MemoryFolderPlugin.list` (relecture du téléphone pendant la synchronisation) et un provisoire en cours : parée par les noms épargnés, à éprouver ;
- fournisseur SAF sans renommage : repli en écriture directe, comme `replace` ;
- Android coupe la liaison en arrière-plan en pleine écriture ;
- première copie de sécurité longue par le Wi-Fi ;
- un PC appairé peut désormais effacer sur le téléphone : à verser dans la relecture de sécurité d'avant la vente (code de 6 chiffres).

## Tranché par l'orchestrateur le 21/11, l'utilisateur absent (à lui dire)

- L'appairage vaut accord, comme le câble : un ordinateur relié par son code modifie et supprime sur le téléphone quand on touche « Synchroniser » sur l'ordinateur, sans accord de plus à l'écran du téléphone. Le bloc « Ordinateur » du téléphone le dit : « L'ordinateur relié peut copier et retirer des sessions quand vous touchez « Synchroniser » sur l'ordinateur. » Raison : c'est ce que l'utilisateur a demandé (« tout par le bouton », suppression dans les deux sens, le sans-fil préféré parce qu'il évite de valider sur le téléphone). À lui de dire s'il veut une case à cocher.
- Téléphone qui enregistre : la moitié de l'ordinateur est faite, avec la phrase dédiée, plutôt qu'un refus complet.
- Pas d'événement « fichiers changés » : la relecture du marqueur (25 s à l'écran, et au retour au premier plan) suffit.
- Flux tenu ouvert par liaison plutôt que l'ajout en fin de fichier, mal suivi par certains fournisseurs.
- Capacité unique « ecriture », dans une liste extensible.

## Essais au vrai téléphone (deux au plus)

1. Synchroniser par le Wi-Fi : une session supprimée sur l'ordinateur part du téléphone ; une créée sur l'ordinateur et un itinéraire modifié arrivent ; le téléphone les montre sans relancer, aucun provisoire ne reste.
2. Pendant un enregistrement, ou l'écran éteint en pleine copie : rien d'écrit à moitié, la synchronisation suivante finit.

Ni le banc ni les tests ne voient l'écriture SAF réelle, la garde de `RecordingService`, la course avec « Mettre à jour », ni une vraie APK ancienne.

## Limites connues après la relecture du greffon (21/11), à verser dans la relecture de sécurité d'avant la vente

- Chez un fournisseur de stockage sans renommage (rare : le stockage ordinaire du téléphone sait renommer), un remplacement venu de l'ordinateur dont la recopie échoue peut laisser le fichier absent du téléphone, son contenu complet restant sous un nom provisoire que la lecture ne sait pas remettre ; si le retrait de la copie partielle échoue aussi, un fichier tronqué reste sous le vrai nom.
- Si l'application réécrit un fichier pendant que l'ordinateur écrit le même, elle reprend le provisoire de l'ordinateur (cas rare, comportement de l'application non modifié).
- Un ordinateur relié peut effacer sur le téléphone : la force du code d'appairage (6 chiffres) est à revoir.
