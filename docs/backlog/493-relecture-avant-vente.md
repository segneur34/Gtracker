# 493 à 508 · Relecture avant vente du 22 au 23/11 : le détail des lots

Noté le 23/11. La relecture générale avant vente (dossier hors dépôt `D:\gong tracker\atelier\audit-vente-2211\` : `RAPPORT.md`, `CONSTATS.md`, `JURIDIQUE.md`, `LOTS-PROPOSES.md`) a retenu 80 constats, relus au commit `6e77a6c` (version 0.02.03). L'utilisateur a demandé le 23/11 de tout inscrire au reste à faire. Cette fiche donne, pour chaque élément, ses constats avec leur endroit et la correction suggérée, pour qu'un lot se lance sans rouvrir l'audit ; le scénario et la preuve de chaque constat (extraits, sondes, sources) restent dans `CONSTATS.md`, sous le même code.

Gravités : « bloque la vente », « avant livraison » (visible par un client ou par l'informaticien de l'acheteur), « confort ». Une correction suggérée est une piste, à confronter au code du jour et aux décisions de `docs/DECISIONS.md` ; elle ne tranche aucune décision de l'utilisateur.

## 493 · Photo satellite coupée

Résultat attendu : plus aucune image satellite prise sans licence : le fond satellite est coupé, les images déjà gardées sur les appareils sont effacées à la mise à jour, et GONG pourra le rebrancher avec un compte chez le fournisseur. Modèle : Opus/high.

Réponse de l'utilisateur du 23/11 : « les images satellites peuvent être enlevées, c'est pas un problème si elles sont pas dans une première version ». Le fond satellite est donc retiré de cette version (plus proposé nulle part, plus aucune requête vers son serveur), les images satellite déjà gardées sur les appareils sont effacées à la mise à jour, et le code reste simple à rebrancher par GONG sur un fournisseur sous contrat. Change DECISIONS §8 pour le seul satellite (à écrire à la passe de documentation).

### C-01 · Images satellite prises sans compte ni licence, et gardées sans limite

- Gravité : bloque la vente ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : src/core/mapBase.ts:46-54 (fond « satellite ») ; src/platform/mapTiles.ts:80 et 137-144 ; src/platform/tileCache.ts:397-405
- Constat : La photo satellite vient d'un serveur d'Esri que l'application appelle sans compte ni licence, alors que les conditions d'Esri lues demandent un logiciel ou un abonnement Esri pour utiliser ces images. L'application les garde en plus sans limite de durée et les montre sans réseau, alors que même un client d'Esri ne peut les garder que le temps fixé par Esri (un jour aujourd'hui). Une version légale est possible avec un compte Esri payant, mais sans satellite hors ligne.
- Déjà connu : fiche 152 et audit du 03/11 (A2 · V1-2) ; état vérifié le 23/11 : mention « Powered by Esri » faite (mapBase.ts:49), toujours aucun compte ni clé, cache toujours sans limite de durée, pas de règle de cache propre au fond
- Correction suggérée : Avant la cession : couper le fond satellite dans core/mapBase.ts (le retirer n'est pas la seule issue), publier aux testeurs une version qui efface les tuiles préfixées sat_ du cache, et déclarer le point par écrit dans l'acte. GONG pourra le rebrancher sous contrat, sur son propre compte Esri (images gardées le temps permis par Esri, donc sans satellite hors ligne) ou chez un autre fournisseur, avec une règle de cache propre à chaque fond lue dans core/mapBase.ts.

### C-26 · Image de partage : « © OpenStreetMap » sans l'adresse de la licence

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : src/core/mapBase.ts:41 ; src/components/drawShareImage.ts:181-189
- Constat : L'image de partage d'une session porte « © OpenStreetMap » sans l'adresse de la page de licence, que les consignes d'OpenStreetMap demandent en toutes lettres quand le support ne permet pas de lien.
- Correction suggérée : Écrire « © OpenStreetMap · openstreetmap.org/copyright » sur l'image de partage en plan (champ credit de core/mapBase.ts) ; avec un autre fournisseur, sa propre mention.

### C-27 · Rafraîchissement des images de carte hors des règles techniques d'OpenStreetMap

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur.
- Endroit : src/core/tiles.ts:8-10 et 21 ; src/platform/mapTiles.ts:140-141
- Constat : Le rafraîchissement des tuiles ne suit pas les règles techniques d'OpenStreetMap : il ignore les durées données par le serveur et redemande au bout de 7 jours sans requête conditionnelle, alors que le commentaire du code affirme le contraire.
- Déjà connu : en partie : fiche 152 (« rafraîchissement à 7 jours sans requête conditionnelle ») ; état vérifié le 23/11 : inchangé
- Correction suggérée : Garder l'ETag de chaque tuile et redemander avec If-None-Match ; corriger le commentaire. Inutile si le fond change de fournisseur.

## 494 · Synchronisation et « Tout supprimer »

Résultat attendu : « Tout supprimer » marche de nouveau après une synchronisation, une copie du dossier du téléphone n'envoie plus de sessions à la corbeille, une note saisie pendant une synchronisation n'est plus perdue. Modèle : Opus/high.

Réponse de l'utilisateur du 23/11, sur un même champ modifié des deux côtés : « il faut que ce soit la dernière version écrite qui soit gardée, tel ou pc, et l'autre corbeille mais ça risque de créer des doublons de session non ? si oui on garde pas ». Donc : c'est la version écrite en dernier qui gagne, qu'elle vienne du téléphone ou de l'ordinateur (aujourd'hui l'ordinateur gagne toujours) ; la version perdante ne va à la corbeille que si cela ne peut pas faire apparaître une seconde fois la même session (dans la liste, ou à la restauration) ; sinon elle n'est pas gardée, et le compte rendu de la synchronisation dit qu'une version plus ancienne a été remplacée. Le plan doit dire sur quelle date s'appuyer, ce qui se passe quand les dates manquent ou sont égales (repli : l'ordinateur gagne, comme aujourd'hui), et si une copie en corbeille créerait un doublon.

### A-01 · « Tout supprimer » ne supprime plus rien après une première synchronisation

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/hooks/sessionLibrary/reset.ts:103 ; src/library/resetPlan.ts:304-305 ; src/platform/memoryFolder.ts:130, 160, 458, 470, 613
- Constat : Dès qu'un téléphone et un ordinateur ont été synchronisés une fois, « Tout supprimer » ne supprime plus rien, ni sur l'un ni sur l'autre, et le message accuse à tort l'accès au dossier.
- Correction suggérée : Retirer l'identifiant du marqueur dans eraseEverything avant suspendWrites(), comme étape propre dont l'échec arrête tout, ou donner à eraseAppFiles une écriture du marqueur permise pendant la suspension. Ajouter au test de reset le cas « marqueur avec identifiant » sur un faux dossier qui refuse les écritures suspendues comme les vrais.

### A-02 · Une copie du dossier du téléphone, remise plus tard ou sur un autre téléphone, envoie des sessions à la corbeille

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : src/hooks/sessionLibrary/phoneSync.ts:56 et 235 ; src/library/syncPlan.ts:108-117
- Constat : La synchronisation reconnaît le téléphone à un identifiant écrit dans son dossier : une copie de ce dossier remise plus tard, ou recopiée sur un second téléphone, passe pour le même téléphone, et les sorties enregistrées depuis la copie partent dans la corbeille de l'ordinateur.
- Correction suggérée : Reconnaître une copie : poser à chaque synchronisation menée au bout un instant dans le marqueur du téléphone et dans la base, et traiter comme une première rencontre, sans suppression et en le disant, un dossier dont le marqueur porte un instant plus ancien ou absent. Passer en phonePath le dossier réellement lu plutôt qu'une constante.

### A-04 · Une note saisie pendant une synchronisation peut être écrasée sans message

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/hooks/sessionLibrary/sync.ts:644-648 et 802-815 ; src/platform/phoneCable.ts:257-260
- Constat : Une note enregistrée sur le téléphone pendant une synchronisation peut être écrasée sans rien dire par la version venue de l'ordinateur, et disparaît alors des deux appareils.
- Correction suggérée : Relire le listage du téléphone avant les écritures d'une session qui remplacent une fiche existante du téléphone (une fois par session, comme pour les itinéraires dans syncRouteFiles.ts), puis comparer taille et date ; à terme, faire vérifier par le téléphone un tampon attendu avant de remplacer.

### A-08 · Avec deux téléphones reliés au même ordinateur, de vieux réglages peuvent remplacer les récents

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/library/syncExtras.ts:155-162
- Constat : Avec deux téléphones reliés au même ordinateur, la vieille copie des réglages du téléphone A gardée par le téléphone B remplace sur l'ordinateur la copie récente reçue de A.
- Correction suggérée : Ne donner la main au téléphone que pour son propre fichier (son identifiant d'appareil, à faire connaître à l'ordinateur, par exemple dans le marqueur) ; pour le fichier d'un tiers, garder la copie au plus grand savedAt, ou n'en écraser aucune.

## 495 · Fichiers reçus : plafonds et points aberrants

Résultat attendu : un fichier GPX ou de montre fabriqué exprès, ou simplement trop gros, est refusé avec un message au lieu de figer l'application, et un point à la position zéro n'abîme plus la carte. Modèle : Opus/high.

### B-02 · Un fichier GPX fabriqué exprès fige l'application à chaque lancement

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : src/core/gpxParser.ts:266, 432-445, 171-174 ; src/hooks/sessionLibrary/incoming.ts:88, 125-135, 154-193 ; src/planning/routeImport.ts:22-31
- Constat : Un fichier GPX fabriqué exprès, de moins d'un mégaoctet, occupe le lecteur de l'application pendant des secondes puis des minutes ; reçu par « Ouvrir avec » ou « Partager vers », il fige Gtracker et est repris à chaque lancement.
- Correction suggérée : Dans core/gpxParser.ts, des constantes nommées et commentées (attributs par balise, points ouverts à la fois, déclarations d'espace de noms) au-delà desquelles le fichier est refusé « mal formé », et le doublon d'attribut cherché par un Set ; `isRouteGpx` passé au worker. Dans incoming.ts, marquer l'entrée « en cours d'essai » avant de la traiter, pour la refuser avec un message au lancement suivant au lieu de la rejouer. Donner aussi un délai maximal à la file de fond du calcul (trackWorkerClient.ts:35, appelée par addSession.ts:129) : un GPX piégé importé par le sélecteur y bloque sinon, pendant tout le lancement, les résumés, les vignettes et le rangement des enregistrements (useRecorder.ts:164).

### B-03 · Un fichier de montre fabriqué exprès épuise la mémoire du téléphone

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/library/fitToGpx.ts:98-116 ; src/core/fitParser.ts:222-243, 290-295 ; src/hooks/sessionLibrary/importer.ts:236
- Constat : Un fichier de montre (FIT) fabriqué exprès se gonfle dix fois à la conversion, sur le fil de l'affichage et sans aucun plafond : quelques mégaoctets suffisent à épuiser la mémoire du téléphone, et le fichier reçu est repris à chaque lancement.
- Correction suggérée : Une constante nommée dans library/fitToGpx.ts bornant le nombre de points ou la taille du GPX produit (alignée sur MAX_LISTED_FILE_BYTES de library/reconcile.ts), au-delà de laquelle le FIT est refusé avec sa raison, et la conversion passée au worker. Le verrou anti-rejeu de B-02 couvre aussi ce cas.

### A-06 · Un point à la position zéro dans un fichier importé fausse la carte et la vignette

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/core/gpxParser.ts:559 ; src/core/displayConfig.ts:28 ; src/library/places.ts:85 et 391 ; src/library/sessionTrack.ts:42
- Constat : Un point à la position (0, 0) dans un GPX importé, défaut connu de certains enregistreurs avant de capter les satellites, est gardé : la carte et la vignette cadrent l'Atlantique entier, avec un trait jusqu'au large de l'Afrique, et s'il est le premier point la session reste sans lieu.
- Correction suggérée : Au lecteur GPX, écarter comme un point sans position une coordonnée hors bornes et le couple exact (0, 0), comme le lecteur FIT le fait pour les bornes ; même règle dans firstTrackPoint et lastTrackPoint. En complément, laisser hors de l'emprise de la carte les points jugés sautés par detourSpikes.

### B-11 · Le plafond de taille d'une session n'est pas vérifié à l'import

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/library/reconcile.ts:57-59 ; src/hooks/sessionLibrary/addSession.ts:120-226 ; src/hooks/sessionLibrary/importer.ts:69-75
- Constat : Le plafond de 30 Mo d'une session n'est vérifié qu'à la lecture du dossier et à la réception par Android, jamais à l'import : une session plus grosse est rangée, puis disparaît de la liste au lancement suivant.
- Correction suggérée : Vérifier MAX_LISTED_FILE_BYTES sur la taille du texte dans addGpx (et sur le fichier choisi avant lecture), avec un refus en clair, comme la réception d'Android le fait déjà ; ce plafond borne aussi B-03.

## 496 · Ne rien perdre à la fermeture, dire les coupures

Résultat attendu : une saisie est sur le disque avant que l'application se ferme, une session coupée par le téléphone le dit en tête de son analyse, une fenêtre du programme Windows restée blanche se recharge. Modèle : Opus/high.

Réponse de l'utilisateur du 23/11, sur l'arrêt seul d'un enregistrement application fermée (1 h sans s'éloigner de 200 m) : ajouter « sans bouger ». L'arrêt seul ne joue que si, en plus, aucune vraie vitesse n'a été vue pendant cette heure : un téléphone oublié sur une table s'arrête, un surfeur qui prend des vagues au même pic ou un bateau qui navigue continuent. La règle des 12 h après la fermeture ne change pas. Change DECISIONS §6 (à écrire à la passe de documentation). Le seuil de « vraie vitesse » est à proposer par le plan, d'après ce que le service connaît déjà (règle d'architecture 3 : pas de seuil en dur propre à un support).

### A-03 · Un enregistrement coupé par le téléphone est rangé sans le dire

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/hooks/recorder/recovery.ts:451-453 ; src/App.tsx:114-138 ; src/components/AnalysisShell.tsx:82-92
- Constat : Quand le téléphone coupe un enregistrement (application tuée par le gestionnaire de batterie, autorisation de position retirée, téléphone éteint) et que l'application est rouverte plus de 10 minutes après, la session est rangée et son analyse s'ouvre sans un mot sur la coupure.
- Correction suggérée : Dans recoverOnce, quand la session reprise ne peut pas continuer, poser un message traduit par t, par exemple « Enregistrement interrompu à 10 h 42 : le téléphone ou l'application s'est arrêté, la trace s'arrête là », l'heure tirée de la dernière position par core/units ; pour un arrêt par la garde, une phrase qui en dit la raison. RecorderNotice l'affiche déjà en tête de l'analyse.

### A-05 · Une saisie peut être perdue si l'application se ferme dans la seconde (plausible, non démontré)

- Gravité : avant livraison ; effort : moyen ; vérification : plausible.
- Endroit : src/hooks/sessionLibrary/recordWrites.ts:25 et 198-202 ; src/hooks/sessionLibrary/lifecycle.ts:259-273 ; bureau/main.ts:300-317 et 549-555 ; src/platform/backButton.ts:65-68
- Constat : Une saisie enregistrée (notes, nom, activité, « Enregistrer la session ») n'est écrite sur le disque qu'environ une seconde plus tard ; si l'application se ferme dans ce délai, elle est perdue sans aucun message.
- Correction suggérée : Programme Windows : intercepter close dans main.ts, demander à la page par le pont de vider ses écritures (flushWrites, settleStoredWrites), puis fermer. Android : attendre flushWrites() avant App.exitApp() dans installBackButton ; les deux par src/platform/ (règle 12).

### A-07 · Programme Windows : la fenêtre reste blanche après un plantage de la page

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/main.ts:549
- Constat : Dans le programme Windows, si la page plante (mémoire épuisée, pilote graphique, plantage de Chromium), la fenêtre reste blanche, sans message, sans rechargement ni raccourci pour recharger.
- Correction suggérée : Sur render-process-gone (raison autre que clean-exit), recharger ADRESSE_ACCUEIL avec un plafond comme l'APK, sinon une boîte de dialogue « La page s'est arrêtée : relancer ? » ; ajouter Ctrl+R à raccourcis().

## 497 · Programme Windows nettoyé

Résultat attendu : le programme livré ne contient plus ni mode d'essai ni outil de test, embarque un moteur web à jour, et son installeur est allégé et reproductible. Modèle : Opus/high.

### B-04 · Le programme Windows livré garde un mode d'essai qui ouvre une porte de pilotage à distance

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : bureau/main.ts:75, 114-115, 130, 133-134 (et memoire.ts:419, applicationTelephone.ts:192, copieSecurite.ts:296)
- Constat : Le programme Windows livré garde le « mode d'essai » du banc de test : une simple variable d'environnement le rallume, et il ouvre alors la porte de pilotage à distance de la page que le programme refuse autrement ; deux autres variables, lues même hors de ce mode, changent le dossier du profil et le dossier d'où l'application est servie.
- Correction suggérée : Écrire à l'emballage un marqueur dans le package.json de la coquille (outils/bureau.mjs, paquetDeLaCoquille) présent pour la construction du banc et absent pour l'installeur ; ne lire GTRACKER_BANC, GTRACKER_DIST et GTRACKER_PROFIL que si `!app.isPackaged` ou si ce marqueur est là.

### B-08 · Le moteur web du programme Windows est à remettre à jour avant de fabriquer l'installeur

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : bureau/package.json:9 (« electron »: « 45.3.4 »)
- Constat : Le programme Windows embarque Electron 45.3.4, déjà dépassé par une 45.4.1 qui apporte des correctifs de sécurité du moteur web, et aucune étape de la livraison ne prévoit de le remettre à jour avant de fabriquer l'installeur.
- Correction suggérée : Passer à la dernière 45.x juste avant de fabriquer l'installeur livré, et l'écrire comme étape de la procédure de livraison (fiche 308).

### D-03 · Le « faux téléphone » des essais est livré dans le programme Windows

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/tsconfig.json:20 ; bureau/fauxTelephone.ts:1 ; outils/banc/exe-sansfil.mjs:116
- Constat : Le « faux téléphone » qui sert seulement aux essais automatiques est compilé et livré à l'intérieur du programme Windows installé chez le client.
- Correction suggérée : Ranger fauxTelephone.ts à part (par exemple bureau/essai/) avec son propre tsconfig compilé pour le banc seulement, ou l'exclure de l'emballage dans outils/bureau.mjs ; un test peut vérifier que l'asar livré ne contient que les modules importés par main.ts et preload.ts.

### B-09 · Paquets du programme Windows figés sans leur empreinte de contrôle

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/package-lock.json (53 entrées sur 314, dont node_modules/electron)
- Constat : 53 paquets du programme Windows, dont Electron et ses outils d'emballage, sont figés sans leur empreinte dans le fichier de verrouillage : une réinstallation ne vérifie pas qu'on reçoit les mêmes fichiers.
- Correction suggérée : Régénérer le verrou de bureau/ en ligne (supprimer package-lock.json et node_modules, npm install), vérifier que chaque entrée porte « integrity », et ajouter ce contrôle à outils/verif.mjs pour les deux verrous.

### C-25 · Petit outil tiers glissé dans l'installeur, inutile et sans sa licence

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : outils/bureau.mjs:263-276 (bloc nsis, sans allowElevation) ; resources/elevate.exe du programme emballé
- Constat : L'installeur glisse dans le programme un petit outil tiers, elevate.exe (« Copyright (C) 2007 Johannes Passing »), dont la licence n'est écrite nulle part et qui ne sert à rien ici (installation par utilisateur, sans mise à jour automatique).
- Correction suggérée : Ajouter allowElevation: false au bloc nsis de configNsis et vérifier que resources/elevate.exe disparaît de l'installeur ; sinon, retrouver et joindre sa licence.

### E-03 · Installeur Windows de 117 Mo, dont 12 Mo de langues inutiles

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : outils/bureau.mjs:344-362
- Constat : L'installeur Windows pèse 116,7 Mo, dont environ 12 Mo de traductions du navigateur intégré dans 55 langues, alors que l'application n'en parle que trois.
- Correction suggérée : Ne garder que les fichiers de langue fr, en-US, en-GB, es et es-419 dans l'emballage (suppression des autres .pak dans un crochet afterCopy de @electron/packager, ou option electronLanguages si l'emballage passe par electron-builder) ; en-US reste obligatoire comme langue de repli de Chromium.

### F-07 · La vérification en ligne ne contrôle pas le code de la fenêtre du programme Windows

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : outils/verif.mjs:142-146 ; .github/workflows/verif.yml:18-20
- Constat : La vérification automatique en ligne ne contrôle jamais la cohérence du code de la fenêtre principale du programme Windows, et ne le signale pas.
- Correction suggérée : Ajouter à la CI `npm ci --ignore-scripts` dans bureau/ (les types d'Electron suffisent, sans télécharger le binaire), ou faire écrire par verif.mjs une ligne « coquille non vérifiée » quand ses dépendances manquent.

## 498 · Relier le téléphone à l'ordinateur sans risque d'intrus

Résultat attendu : sur un Wi-Fi partagé, personne ne peut se faire passer pour l'ordinateur pendant l'appairage ni empêcher le téléphone de trouver le sien, le code à 6 chiffres tapé restant tel quel. Modèle : Fable/high.

Réponses de l'utilisateur du 23/11 : trouver une solution pour qu'aucun intrus ne puisse se glisser dans l'appairage sans fil ; le risque est jugé relatif (réseau familial, appairage fait devant le téléphone et l'ordinateur), donc le sans-fil reste actif en attendant la correction. Contraintes : le geste de l'utilisateur change le moins possible (l'ordinateur affiche 6 chiffres, tapés sur le téléphone, DECISIONS §8) ; aucun secret ne doit pouvoir être retrouvé hors ligne à partir de ce qui passe sur le réseau ; primitives éprouvées seulement, aucune cryptographie à courbes écrite à la main ; les appareils déjà reliés le restent. Le plan compare au moins deux voies (échange authentifié par mot de passe avec une bibliothèque auditée ; code court dérivé de la liaison avec engagement préalable, qui demande une confirmation des deux côtés) et dit ce que chacune change à l'écran : tout geste en plus est une question à poser à l'utilisateur avant de coder.

### B-01 · Appairage sans fil : un intrus sur le même Wi-Fi peut prendre la place de l'ordinateur

- Gravité : bloque la vente ; effort : moyen ; vérification : confirmé.
- Endroit : android/app/src/main/java/io/github/segneur/gtracker/ComputerLinkPlugin.java:352, 360, 375, 1041, 1119, 1207-1216 ; bureau/appairage.ts:123-135 ; android/.../ComputerLinkProtocol.java:752-769 ; bureau/sansFil.ts:155 et 1319-1321
- Constat : Pendant les deux minutes de l'appairage sans fil, un appareil du même réseau peut se faire passer pour l'ordinateur, retrouver le code à six chiffres en quelques secondes et garder ensuite, sans que rien ne se voie, le droit de lire, d'écrire et d'effacer les sessions du téléphone.
- Déjà connu : fiche 450 (docs/backlog/450-plan-sans-fil.md:64 et :86 : « faiblesse connue : pendant ces 2 minutes, un intrus actif sur le même Wi-Fi pourrait retrouver le code ; relecture de sécurité avant la vente, parade possible : code plus long ») et 445-exe-etude-sans-fil.md:51. État vérifié le 23/11 : inchangé. La fiche sous-estime l'effet (prise de contrôle durable, pas seulement fuite du code) et sa parade ne suffit pas (8 chiffres : quelques minutes sur un cœur, et le temps de l'intrus n'est pas borné).
- Correction suggérée : Remplacer les preuves HMAC par un échange authentifié par mot de passe (CPace ou SPAKE2, empreinte du certificat du PC dans la transcription), qui ne laisse à l'intrus qu'un essai en ligne par tentative, déjà bornées à trois : le code à 6 chiffres tapé reste tel quel (docs/DECISIONS.md §8). Ajouter une échéance globale aux attentes du téléphone pendant l'appairage ; nouvelle version du protocole annoncée par `capacites` (trames.ts:8-12). Variante à ne retenir que sur décision de l'utilisateur, car elle change la décision du code tapé et demande la caméra : un QR affiché par le PC, portant l'empreinte du certificat et un secret de 128 bits, le code tapé restant en secours.

### B-06 · Un appareil du réseau peut empêcher le téléphone de trouver l'ordinateur ou de s'y relier

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/sansFil.ts:149 (INCONNUES_MAX = 8), :152 (CONNEXIONS_MAX = 32), :155 et :1319-1321 (plafond de découverte global), :1329-1331 ; bureau/appairage.ts:59, :66
- Constat : N'importe quel appareil du réseau peut empêcher le téléphone de trouver le PC, de s'y relier ou de s'appairer, sans rien connaître, aussi longtemps qu'il le veut.
- Correction suggérée : Compter connexions non reconnues et réponses de découverte par adresse source (2 ou 3 par adresse, plafond global gardé au-dessus) et raccourcir à 2-3 s le délai de présentation d'un inconnu ; pour la fenêtre, afficher sur le PC la tentative refusée et son origine plutôt que de la fermer à la troisième.

### B-07 · Sans-fil allumé, l'ordinateur donne son nom à tout appareil du réseau qui le demande

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/sansFil.ts:1315-1324, :634-636 (nomDuPc = os.hostname()), :928 et :939 ; bureau/sonde.ts:18-27
- Constat : Le sans-fil allumé, le PC donne son nom Windows et un identifiant qui ne change jamais à tout appareil du réseau qui le lui demande, alors que le téléphone ne se sert pas de ce nom.
- Correction suggérée : Envoyer un nom vide dans la réponse de découverte (le format l'admet, sonde.ts:26) et remplacer l'identifiant en clair par une valeur liée à la question, par exemple HMAC(identifiant, nonce), que seul un téléphone appairé sait vérifier.

### D-10 · Longueur du code d'appairage recopiée sans garde

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/library/computerLink.ts:12 ; src/platform/nativeConstants.test.ts:371 ; bureau/appairage.ts:72 ; bureau/trames.ts:450
- Constat : La longueur du code d'appairage (6 chiffres) est recopiée côté page sans être surveillée par le test qui compare déjà le PC et le téléphone, et une constante de taille déclarée côté PC n'est pas utilisée.
- Correction suggérée : Ajouter CODE_LENGTH au test « mêmes constantes au PC et au téléphone » de nativeConstants.test.ts (ou construire les textes « {n} chiffres » à partir de la constante), et employer TAILLE_PREUVE dans trames.ts à la place du 32 écrit en dur.

## 499 · Licences et phrases exactes

Résultat attendu : l'écran des licences dit vrai sur chaque appareil, cite le jeu d'icônes repris et donne le lien du code source de FFmpeg, et aucune phrase de l'application n'affirme un accord ou une confidentialité qu'on ne peut pas prouver. Modèle : Sonnet/high.

Réponse de l'utilisateur du 23/11 : pas d'accord écrit de GONG, et l'application ne va qu'à GONG. La phrase « reproduit avec l'accord de GONG SUP » devient une mention neutre, qui n'affirme aucun accord et ne nomme pas de société (le titulaire exact de la marque n'est pas établi).

### C-16 · Bibliothèque FFmpeg livrée sans lien vers son code source

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : programme Windows emballé : ffmpeg.dll et LICENSES.chromium.html (livrés par @electron/packager) ; src/components/AboutSettings.tsx ; outils/bureau.mjs:248-279 (installeur sans page de licence)
- Constat : Le programme Windows livre la bibliothèque FFmpeg d'Electron, sous licence LGPL 2.1 : sa licence est bien livrée dans un fichier de notices, mais rien n'indique où obtenir son code source, et les futures conditions d'utilisation devront permettre la rétro-ingénierie nécessaire au débogage de cette bibliothèque.
- Correction suggérée : Ajouter dans « À propos » du programme Windows et dans un fichier texte de l'installeur la phrase « Ce programme utilise des bibliothèques du projet FFmpeg sous LGPL 2.1 », avec un lien vers le code source de FFmpeg de la version de Chromium embarquée par Electron 45.3.4 (le fichier ffmpeg-v45.3.4-win32-x64.zip d'Electron n'est qu'une bibliothèque compilée), ou une offre écrite valable trois ans. GONG ne doit pas interdire cette rétro-ingénierie dans ses conditions. Faire vérifier si le ffmpeg.dll livré contient les décodeurs H.264 et AAC, couverts par des brevets (non vérifié : sa taille, près du double de la version sans ces codecs, le laisse penser), et s'il faut alors une licence de brevets pour une diffusion commerciale.

### C-17 · Icônes reprises d'un jeu libre (Feather) sans sa mention de droits

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : src/components/icons.tsx:78-82, 139-142, 183-186, 244-247, 340-343
- Constat : Cinq icônes d'interface reprennent presque à l'identique les tracés du jeu libre Feather (licence MIT), qui ne figure pas dans la liste des licences de l'application.
- Correction suggérée : Ajouter une ligne Feather (MIT, « Copyright (c) 2013-2023 Cole Bemis », avec le texte de la licence) à outils/licences-hors-js.mjs et régénérer public/licences-hors-js.json, ou redessiner les icônes concernées. Une ligne Lucide (ISC) est facultative : seul un trait droit de quatre unités en vient.

### C-05 · L'écran des licences affirme un accord de GONG dont aucune trace écrite n'existe

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : outils/licences-hors-js.mjs:43-48 → public/licences-hors-js.json (ligne « Logo GONG »), lu par src/components/AboutSettings.tsx
- Constat : L'écran des licences affirme que le logo GONG est reproduit « avec l'accord de GONG SUP », alors que le dossier ne garde aucune trace de cet accord, et que le mot « GONG » est enregistré comme marque au nom d'une autre société du groupe, GONG GALAXY (registre australien, issu d'un dépôt français de 2023).
- Déjà connu : en partie : fiches 153 et 308 point 2 (crédits des images absents, toujours vrai le 23/11) ; la phrase d'accord et le nom de la société : non
- Correction suggérée : Remplacer la phrase par une formulation exacte (par exemple « Logo GONG : marque de son titulaire, montrée pour une présentation à GONG ») ou obtenir l'accord écrit en nommant la bonne société ; source unique outils/licences-hors-js.mjs, puis régénération. Après l'achat, la ligne est réécrite avec le service juridique de GONG.

### C-09 · Deux textes disent que seul le point de départ part en ligne, alors que l'arrivée part aussi

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : src/components/AboutSettings.tsx:122 ; src/components/MemoryStatus.tsx:396 ; src/library/places.ts:75 et 117-119
- Constat : Les deux textes qui décrivent la recherche de lieux disent que seul le point de départ part en ligne (« rien d'autre »), alors que le point d'arrivée part aussi quand il est à plus de 2 km du départ.
- Correction suggérée : Corriger les deux phrases (« le point de départ et, si la sortie finit ailleurs, le point d'arrivée, arrondis à une centaine de mètres »), clés françaises et traductions en.json et es.json.

### C-24 · La liste des licences du programme Windows est celle d'Android

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : src/components/AboutSettings.tsx:108-133 ; public/licences-hors-js.json (source outils/licences-hors-js.mjs)
- Constat : La liste des licences montrée dans le programme Windows est celle de l'application Android : elle cite AndroidX, Cordova et Capacitor Android, absents du programme, et omet ce que le programme livre en propre (Electron, Chromium, Node.js, FFmpeg, l'installeur NSIS) ; la notice de Cordova n'y est pas reprise.
- Déjà connu : en partie : fiche 151 (écran des licences fait, sans distinction des plates-formes)
- Correction suggérée : Marquer chaque ligne du complément par plate-forme et filtrer à l'affichage par une capacité de src/platform/ ; ajouter pour Windows Electron (MIT), Chromium (renvoi à LICENSES.chromium.html), FFmpeg (voir C-16) et NSIS (zlib) ; joindre la notice Cordova à sa ligne.

### C-29 · La recherche d'un lieu par son nom envoie une position plus précise que nécessaire

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : src/planning/geocoding.ts:42-48 ; src/pages/PlanningPage.tsx:433
- Constat : La recherche d'un lieu par son nom (Planifier) envoie à komoot le centre de la carte à 4 décimales (environ 11 m), plus précis que nécessaire pour orienter une recherche de nom.
- Correction suggérée : Arrondir le centre à 2 décimales (environ 1 km) dans planning/geocoding.ts, et le dire dans la politique.

### C-32 · « Bluetooth Smart », dénomination abandonnée

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : texte « Ceinture ou montre qui diffuse sa fréquence cardiaque en Bluetooth Smart… » (clé française ; src/locales/en.json:211 et es.json)
- Constat : L'aide de la ceinture cardio emploie « Bluetooth Smart », une dénomination abandonnée par le Bluetooth SIG, dont les marques sont réservées à ses membres licenciés.
- Correction suggérée : Écrire « en Bluetooth (basse consommation) », sans logo, en clé française et traductions ; GONG soumet ses textes de vente à la même règle.

## 500 · Pare-feu de Windows : règle propre

Résultat attendu : la demande d'autorisation s'affiche au nom de Gtracker, ne retire que ses propres blocages, et la règle part à la désinstallation. Modèle : Opus/high.

### C-15 · Pare-feu de Windows : demande au nom de « Windows PowerShell », blocages de l'utilisateur retirés

- Gravité : avant livraison ; effort : moyen ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : bureau/pareFeu.ts:17-23, 188-208, 214-222
- Constat : Pour ouvrir le sans-fil, le programme Windows pose deux règles de pare-feu limitées au réseau local, actives aussi sur les réseaux « publics » (nécessaire pour le partage de connexion du téléphone). Il retire aussi les blocages visant Gtracker, même ceux que l'utilisateur aurait posés lui-même. La demande d'administrateur affiche « Windows PowerShell » au lieu de Gtracker, et les deux règles restent après la désinstallation.
- Déjà connu : en partie : axe B, constat B-10 (règle laissée après désinstallation) ; fiche 450 (« réseau Public bloqué, voulu », que le code autorise désormais) ; le retrait de tous les blocages et l'affichage « Windows PowerShell » : non
- Correction suggérée : Dire à l'écran, avant l'élévation, que la règle vaut aussi sur les réseaux publics pour le partage de connexion ; ne retirer que les blocages créés par Windows pour Gtracker ; retirer les deux règles à la désinstallation (élévation au désinstalleur, ou paquet MSIX qui déclare ses règles).

### B-10 · La règle de pare-feu reste après la désinstallation

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : bureau/pareFeu.ts:20-23 et :190-208 ; outils/bureau.mjs:187-197 et :264-265 (installeur par utilisateur, désinstallation sans retrait de la règle)
- Constat : La règle du pare-feu posée par « Autoriser Gtracker » reste après la désinstallation, et vise un programme rangé dans un dossier que tout logiciel de l'utilisateur peut remplacer sans droits d'administrateur.
- Correction suggérée : Retirer les règles Gtracker-SansFil-TCP et -UDP à la désinstallation (macro customUnInstall de l'inclus NSIS, élévation demandée seulement si elles existent), ou au minimum le dire dans la notice d'installation.

Questions tranchées par l'orchestrateur :
- À la désinstallation, la demande de confirmation de Windows quand les règles existent est le résultat attendu ; un refus n'affiche rien et n'arrête pas la désinstallation.
- Un blocage de Gtracker posé par l'utilisateur rend le cas non réparable, avec la phrase existante « Un réglage de l'administrateur de cet ordinateur empêche de l'autoriser ici. », sans texte neuf.
- Les règles d'autorisation « Query User » créées par Windows ne sont pas retirées à la désinstallation.
- Le détail du code 7 (blocage resté en place) s'écrit comme les messages voisins de la coquille ; le lot 502 les traduira tous.

Limites relevées par la relecture du 23/11, gardées telles quelles :
- Un blocage posé par l'utilisateur pour Gtracker compte même s'il ne vise qu'un autre profil de réseau ou un autre port : l'autorisation est alors posée et marche, mais le programme la dit empêchée. Cas rare, jugement prudent voulu (ni ports ni profils regardés).
- La demande de droits lance Gtracker.exe, installé dans le dossier de l'utilisateur, donc remplaçable par un logiciel du même utilisateur (constat B-10). L'ancien montage n'était pas plus sûr sur ce point : le script confié à PowerShell venait du même programme. À dire dans la note de remise (lot 507) : une installation par machine et un programme signé ferment ce point.
- Le banc `exe-sansfil` cherche encore les anciennes phrases (contrôles 1a, 7b, 7f, constante `ALLUMAGE`) : adapté avec les autres scripts du programme Windows, en fin de paquet.

## 501 · Android prêt pour Google Play

Résultat attendu : l'application Android se construit au format demandé par Google, ne demande plus de permission que Google refuse, et n'écrit plus de données du client dans ses traces. Modèle : Opus/high.

### C-12 · L'application demande à être exemptée de l'économie de batterie, ce que Google Play n'admet pas pour le sport

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur.
- Endroit : android/app/src/main/AndroidManifest.xml:123 ; android/app/src/main/java/io/github/segneur/gtracker/PermissionsPlugin.java:24-27 et 50
- Constat : L'application demande directement à être exemptée de l'économie de batterie, ce que Google Play n'admet que si la fonction principale en est empêchée ; le suivi sportif ne figure pas dans la liste des cas admis, et le code lui-même dit que ce choix vaut « hors boutique ».
- Déjà connu : fiche 308 point 4 et fiche 151 ; état vérifié le 23/11 : permission et demande directe toujours là
- Correction suggérée : Pour la version Play : retirer la permission et ouvrir la liste système (ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, sans permission) dans PermissionsPlugin, ou garder la demande en la justifiant par écrit auprès de Google (perte de points GPS écran éteint), en sachant que Google tranche. Le contrat dit qui le fait.

### C-13 · Application Android pas au format de Google Play, et compte développeur à ouvrir

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : android/app/build.gradle:28, 31, 62-65 ; capacitor.config.ts:10
- Constat : Le livrable Android n'est pas au format exigé par Google Play (APK au lieu d'« Android App Bundle ») et porte l'identifiant du vendeur ; GONG devra en outre ouvrir un compte développeur d'organisation (numéro D-U-N-S) et déclarer son statut de professionnel avant le 1er février 2027.
- Déjà connu : fiche 308 point 6 et fiche 153 (identifiant toujours celui du vendeur le 23/11) ; format AAB, D-U-N-S et statut de professionnel : non
- Correction suggérée : Avant la livraison, changer l'identifiant pour celui de GONG (prévu au 308, en tenant compte des identifiants du programme Windows relevés par l'axe F) ; le reste revient à GONG (compte d'organisation, bundleRelease, signature d'application par Google Play, statut de professionnel). Rien à faire pour la cible 36 ni pour l'alignement 16 Ko (aucun code natif).

### C-30 · Permission « réseau local » d'Android déclarée trop tôt

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession.
- Endroit : android/app/src/main/AndroidManifest.xml:128 ; android/app/src/main/java/io/github/segneur/gtracker/ComputerLinkPlugin.java:98-107
- Constat : La permission d'accès au réseau local est déclarée, et demandée sur les téléphones Android 17, alors que l'application vise Android 16 et que la documentation d'Android demande précisément de ne pas le faire tant que la cible est inférieure à 37 ; à partir du 25/08/2027, cette permission demandera aussi une déclaration Play.
- Correction suggérée : Conditionner la demande à la cible de l'application (targetSdkVersion >= 37) en plus de la version du téléphone, ou retirer la déclaration jusqu'au passage à la cible 37 ; noter pour GONG la déclaration Play de 2027.

### B-12 · Code Android livré ni réduit ni obscurci, avec ses traces de débogage (dont le nom de la ceinture cardio)

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : android/app/build.gradle:58 ; android/app/src/main/java/io/github/segneur/gtracker/HeartRatePlugin.java:394
- Constat : Le code Java de l'APK livrée n'est ni réduit ni obscurci, et ses traces de débogage restent, dont l'adresse Bluetooth et le nom de la ceinture cardio du client.
- Déjà connu : fiche 404, point 7 (« R8 coupé ») ; état vérifié : toujours `minifyEnabled false`. Les traces de la ceinture n'y sont pas citées.
- Correction suggérée : Activer R8 avec une règle -assumenosideeffects sur android.util.Log.d (règles de conservation de Capacitor à vérifier), ou retirer l'adresse et le nom de ces traces.

### B-13 · Gtracker se propose pour ouvrir trop de sortes de fichiers

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : android/app/src/main/AndroidManifest.xml:35-74
- Constat : Gtracker se propose pour ouvrir tout fichier binaire ou XML, et pas seulement les GPX et FIT.
- Déjà connu : fiche 404, point 7 (état vérifié : toujours présent, inchangé)
- Correction suggérée : Garder les types précis (GPX, FIT) et le motif par extension ; retirer octet-stream et les XML génériques si un essai au téléphone montre que les gestionnaires de fichiers courants passent par le motif.

### B-14 · Le partage de fichiers déclare plus de dossiers que nécessaire

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : android/app/src/main/res/xml/file_paths.xml:3
- Constat : Le partage de fichiers déclare tout le dossier cache de l'application alors qu'un seul sous-dossier sert.
- Déjà connu : fiche 160 (« file_paths.xml réduit à cache-path partage/ ») ; état vérifié : external-path retiré, `cache-path path="."` toujours là.
- Correction suggérée : `<cache-path name="partage" path="partage/" />`.

## 502 · Messages du programme Windows dans les trois langues

Résultat attendu : en anglais et en espagnol, plus un message d'erreur, plus un texte de l'installeur ni du fichier d'aide du dossier ne reste en français. Modèle : Sonnet/high.

### F-03 · Programme Windows en anglais ou en espagnol : messages, installeur et fichier d'aide restés en français

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : bureau/adb.ts:676 (et environ 80 messages « UNKNOWN » de bureau/*.ts) ; src/platform/errorText.ts:119-135 ; src/components/PhoneAppCard.tsx:40, 52 ; src/library/folderLayout.ts:60-90 ; outils/bureau.mjs:274
- Constat : Dans le programme Windows réglé en anglais ou en espagnol, une partie des messages d'erreur reste en français, de même que l'installeur et le fichier « LISEZMOI » écrit dans le dossier des sessions.
- Déjà connu : en partie : LISEZMOI.txt « laissé en français, à trancher par l'utilisateur » (fiche 382, reprises, fiche close sans décision) ; messages des greffons Java traités par la fiche 382 (nativeMessages.ts). Les messages de la coquille Windows et la langue de l'installeur : non (le programme Windows est postérieur à la fiche 382).
- Correction suggérée : Donner aux erreurs de la coquille un code par cas (ou une clé) traduit par la page, comme pour les greffons Android (table de nativeMessages.ts ou codes de errorText.ts), et faire passer PhoneAppCard par plainError. Ajouter en_US et es_ES à installerLanguages ; décider de la langue du LISEZMOI (écrit dans la langue de l'interface au moment de la création, ou en trois langues).

## 503 · Virages du surf identiques à toute cadence

Résultat attendu : le nombre de virages comptés au GPS ne dépend plus du nombre de points par seconde du fichier. Modèle : Fable/high.

### A-10 · Surf : le nombre de virages vus par le GPS dépend du nombre de points par seconde du fichier

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : src/surfing/gpsTurns.ts:109 et 296-301
- Constat : En surf, le nombre de virages vus par le GPS (chiffre marqué expérimental) dépend de la cadence du fichier quand celui-ci ne porte pas le cap de l'appareil : la même vague compte plus de virages à 5 points par seconde qu'à 1.
- Correction suggérée : Lire le cap des positions sur une corde d'au moins une seconde, comme les caps stabilisés de la voile, par une constante nommée de gpsTurns.ts passée en option.

Plan retenu : sans cap de l'appareil, chaque point se lit au cap de la corde des positions qui remonte d'environ `TURN_COURSE_STRIDE_S` (0,9 s, option `courseStrideS`, 0 pour le cap du pas), sans franchir un trou ni une reprise ; le cap du pas reste quand la corde n'a qu'un pas (1 Hz inchangé). Au codage, la lecture espacée d'au moins 0,9 s et la corde « au-delà de 0,9 s » ont été écartées : sur une cadence irrégulière (pas de 0,2 à 1,5 s), elles effaçaient les virages (0 au lieu de 3) ; l'ancrage est le point le plus proche de 0,9 s.
Tranché par l'orchestrateur : vraie corde des positions, pas une moyenne de caps ; le cap de l'appareil n'est pas relu par corde ; un fichier à 1 Hz aux pas irréguliers de moins de 0,9 s peut bouger d'une unité, accepté.

## 504 · Livraison complétée

Résultat attendu : les documents remis décrivent aussi le programme Windows et la synchronisation, la liste de ce qui change de nom couvre le programme Windows, et le dépôt remis ne garde aucune trace de l'ancien historique ni de l'atelier. Modèle : Opus/high.

### F-01 · Les documents remis ne parlent ni du programme Windows ni de la synchronisation

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : README.md:1-49 ; docs/INSTALLATION.md:1-84 ; docs/DEVELOPPER.md:1-61
- Constat : Les trois documents remis avec le produit (présentation, installation, construction) ne parlent pas du programme Windows, qui est pourtant la moitié de ce qui est vendu, ni de la synchronisation entre téléphone et ordinateur.
- Correction suggérée : Ajouter au README une section « Programme Windows » (ce qu'il fait, synchronisation, ce qui part sur le réseau local) ; à DEVELOPPER une section « Windows » (npm ci dans bureau/, APK de publication d'abord, npm run installeur, sortie, non signé) ; à INSTALLATION un chapitre « Installer sur le PC et relier le téléphone ».

### F-02 · La liste de ce qui change de nom à la cession oublie le programme Windows

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : outils/bureau.mjs:55, 73, 251-254 ; bureau/main.ts:129 ; bureau/origine.ts:11 ; docs/backlog/308-e8-livraison.md (point 6)
- Constat : La liste prévue pour remplacer l'identité du vendeur par celle de GONG ne couvre que l'application Android ; elle oublie les identifiants du programme Windows, dont deux ne doivent surtout pas changer après une première diffusion.
- Déjà connu : fiche 308 point 6 (état vérifié : Android seulement ; aucune ligne pour outils/bureau.mjs, bureau/main.ts ni bureau/origine.ts)
- Correction suggérée : Compléter la fiche 308 d'une liste « identité Windows » : ce qui se change librement avant la première diffusion (ID_PROGRAMME, productName, copyright, author, win32metadata), et ce qui ne se change plus ensuite sans migration (setName et donc %APPDATA%, origine gtracker.localhost). Le dire aussi dans DEVELOPPER, « Ce qu'un changement casse », qui ne parle que de l'appId Android.

### B-05 · La réécriture du dépôt prévue avant la cession laisse l'ancien historique dans le dossier

- Gravité : avant livraison ; effort : petit ; vérification : confirmé.
- Endroit : docs/backlog/308-e8-livraison.md:9 et :22 (procédure de réécriture du dépôt et contrôle)
- Constat : La réécriture du dépôt prévue avant la cession (« git checkout --orphan ») laisse tout l'ancien historique dans le dossier git, et le contrôle prévu pour s'en assurer passe quand même.
- Correction suggérée : Livrer un dépôt fait à neuf depuis un export de l'arbre (git archive HEAD décompressé dans un dossier vide, git init, un seul commit), jamais le dossier .git actuel. Remplacer le contrôle par « git rev-list --all --count » (attendu 1), « git tag » (attendu vide) et « git log --all --format='%an %ae' | sort -u », lancés dans le dépôt remis.

### D-02 · Outils et notes de l'atelier encore dans le dépôt à remettre

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : .claude/ ; docs/BACKLOG.md ; docs/backlog/ ; docs/MODELES.md ; outils/backlog.mjs ; outils/fin-de-lot.mjs ; outils/lancer-gtracker.bat ; outils/heritage.json ; src/landWords.test.ts ; src/heritage.test.ts
- Constat : Les outils et notes de l'atelier de développement (consignes de l'assistant, liste du reste à faire, scripts de fin de lot, cliquets sur l'ancien vocabulaire) sont toujours dans le dépôt qui sera remis à l'acheteur.
- Déjà connu : fiche 308 point 8 et fiche 404 point 9 (état vérifié : tout est encore là ; le retrait est prévu au lot de livraison 308, pas fait)
- Correction suggérée : Faire le lot 308 avant la remise : une branche ou une archive de livraison sans .claude/, docs/BACKLOG.md, docs/backlog/, docs/MODELES.md, outils/backlog.mjs, fin-de-lot.mjs et le script « backlog » de package.json ; décider si les cliquets de vocabulaire restent (ils protègent la règle 13) ou partent.

### C-22 · L'application ne dit pas qui l'édite ni comment le joindre

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : src/components/AboutSettings.tsx:108-133 ; capacitor.config.ts:23 ; bureau/sortant.ts:13-26 ; outils/bureau.mjs:256-257, 354, 361
- Constat : L'application ne dit pas qui l'édite ni comment le joindre (l'éditeur affiché par Windows est « Gtracker », qui n'est pas une société), et le seul contact qu'elle donne est la page GitHub personnelle du vendeur, envoyée avec chaque requête de carte et de lieu depuis Android ; le programme Windows n'en donne aucun. OpenStreetMap n'impose pas ce contact, mais s'en sert pour prévenir avant de bloquer.
- Déjà connu : fiche 308 point 1 et fiche 152 (« l'acheteur mettra son propre contact ») ; état vérifié le 23/11 : inchangé
- Correction suggérée : Avant la remise, le vendeur retire son propre contact de capacitor.config.ts ; GONG met sa raison sociale, son adresse, un courriel de contact et de signalement des failles et le lien de sa politique dans « À propos », dans l'agent des requêtes (Android et bureau/sortant.ts, stable d'une version à l'autre) et dans les métadonnées de l'exécutable et de l'installeur.

### F-05 · Les documents décrivent mal les tests

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : docs/ETAT_DU_PROJET.md:31, 32, 38, 315-334 ; docs/DEVELOPPER.md:20, 25 ; README.md:33 ; docs/INVENTAIRE.md:216
- Constat : Les documents décrivent les tests de façon fausse et plutôt à la baisse : ils disent non testé ce qui l'est, oublient les tests du programme Windows et d'Android, et donnent des durées et des sorties périmées.
- Déjà connu : en partie : fiche 308 point 7 (« faire lisible ETAT_DU_PROJET.md », « ETAT refait ») ; fiche 401 a traité d'autres phrases d'ETAT §8 (screen). DEVELOPPER, README et INVENTAIRE sur ces points : non.
- Correction suggérée : Réécrire ETAT §8 depuis l'arbre réel (git ls-files '*.test.*', tests JUnit, bureau/), corriger les mentions de durée et de nombre de lignes, et dire dans DEVELOPPER que la CI joue tous les tests JUnit.

### F-06 · Le format du dossier des sessions est décrit de façon incomplète

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : docs/ETAT_DU_PROJET.md:183-197 ; src/library/folderLayout.ts:6-25 ; src/library/folderLayout.ts:60-90 ; src/platform/memoryFolder.ts:20 ; src/pages/SettingsPage.tsx:243 ; src/recording/markGuide.ts:87 ; src/hooks/useFollowedTrace.ts:12 ; src/platform/tileCache.ts:342, 362
- Constat : Le contenu du dossier des sessions, qui est le format des données des clients, est décrit de façon incomplète à quatre endroits, et six commentaires du code renvoient encore à un ancien fichier de réglages qui n'existe plus.
- Déjà connu : en partie : fiche 401, « Hors du lot (avec la livraison, 308) : … le format du dossier mémoire » (état vérifié : pas encore écrit) ; commentaires « reglages.json » : non
- Correction suggérée : Écrire une fois la disposition complète du dossier (folderLayout.ts, que l'ETAT et le LISEZMOI reprennent) avec corbeille/ et synchro/, et remplacer « reglages.json » par « reglages/<appareil>.json » dans les six commentaires.

## 505 · Essais automatiques du côté téléphone de la liaison

Résultat attendu : le code du téléphone qui reçoit, écrit et efface des fichiers sur ordre de l'ordinateur a ses propres essais, comme le côté ordinateur. Modèle : Opus/high.

### F-04 · Aucun essai automatique du code du téléphone qui écrit et efface sur ordre de l'ordinateur

- Gravité : avant livraison ; effort : moyen ; vérification : confirmé.
- Endroit : android/app/src/main/java/io/github/segneur/gtracker/ComputerLinkPlugin.java (1 378 lignes) ; MemoryWriter.java (438 lignes) ; bureau/fauxTelephone.ts
- Constat : Côté téléphone, le code qui reçoit les ordres de l'ordinateur sans fil et écrit ou efface les fichiers des sessions n'a aucun test automatique ; seuls le format des messages et le rangement des dossiers sont testés.
- Déjà connu : en partie : ETAT §8 (l.333) range « les greffons Java » parmi les non testés (formulation périmée : 9 classes de test existent) ; aucune fiche ne vise ce manque
- Correction suggérée : Sortir de ComputerLinkPlugin la décision pure (message reçu, état « enregistre », chemin, empreinte attendue) vers ComputerLinkProtocol, déjà testé, et tester MemoryWriter avec un faux fournisseur de documents (Robolectric ou interface fine) ; CI les joue déjà par ./gradlew testDebugUnitTest.

## 506 · Dossier de la cession, à monter avec un avocat

Résultat attendu : un acte de cession écrit avec son annexe de déclarations, l'avis d'un avocat sur les conditions de l'abonnement d'IA, une copie datée de l'historique gardée comme preuve, un fichier de crédits pour chaque image. Modèle : sans code.

Réponse de l'utilisateur du 23/11 : l'application, avec les photos et le logo de GONG, ne va qu'à GONG ; pas d'accord écrit à ce jour.

### C-02 · Acte de cession et déclaration écrite des points connus à préparer

- Gravité : avant livraison ; effort : moyen ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : hors code : acte de cession à écrire ; package.json (sans license ni author) ; outils/bureau.mjs:252, 257, 354 (copyright et auteur « Gtracker »)
- Constat : Rien n'est prêt pour céder les droits proprement. La loi demande un acte écrit qui nomme chaque droit cédé, avec son étendue, sa destination, son lieu et sa durée. Elle oblige aussi le vendeur à dire ce qu'il sait d'important et que l'acheteur ignore, sans pouvoir l'écarter par contrat. Or le logiciel ne nomme aujourd'hui aucun titulaire (« Gtracker » n'est pas une personne).
- Déjà connu : en partie : fiche 308 (package.json sans license ni author, toujours vrai le 23/11), fiches 152, 153 et 452 pour les faits à déclarer ; ni l'acte ni la déclaration écrite ne sont dans aucune fiche
- Correction suggérée : Faire rédiger par un avocat l'acte (droits de L122-6 un par un, documentation et scripts générateurs compris, éléments de GONG exclus, évolutions futures par cessions séparées) et une annexe « déclarations du cédant » nourrie de cette relecture (faits datés, sans appréciations). Déclarer « license »: « UNLICENSED » et un auteur dans package.json.

### C-03 · Abonnement d'IA : clause « pas d'usage commercial » à faire lire par un avocat

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : docs/MODELES.md:9 (« Sur l'abonnement Max ») ; tous les commits (456 sur 456 portent « Co-Authored-By: Claude »)
- Constat : Le code a été écrit avec l'IA Claude sous un abonnement grand public (Max). Dans la version de ces conditions pour l'Union européenne et la Suisse, réservée aux « consommateurs », une phrase dit « pas d'usage commercial » ; la version pour le reste du monde ne l'a pas. Cette phrase est rangée parmi les limites de responsabilité, et sa portée réelle est incertaine. Ces conditions ne cèdent les droits sur les textes produits que « sous réserve du respect des conditions », et n'offrent aucune garantie contre la réclamation d'un tiers.
- Correction suggérée : Faire dire par un avocat si ces conditions s'appliquent au vendeur et quel effet a la clause sur la propriété ou la cession ; déclarer l'usage de l'IA par écrit à GONG (outils, offre, conditions, méthode) sans rien promettre au nom du fournisseur ; pour la suite, travailler sous des conditions commerciales.

### C-04 · Code écrit avec une IA : preuves de la part humaine à figer

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : historique git (456 commits), docs/HISTORIQUE.md, docs/DECISIONS.md, docs/BACKLOG.md ; fiche docs/backlog/153-vente-identite-images.md:30 (dépôt neuf en un seul commit)
- Constat : Un code écrit en grande partie par une IA n'est protégé par le droit d'auteur que pour les choix créatifs qu'un humain y a faits et qui se voient dans le résultat. Ces choix se prouvent d'abord par le logiciel lui-même ; l'historique et les journaux de travail (demandes, essais validés, refus) n'en sont qu'un appui. La livraison prévue (dépôt neuf en un seul commit) ne les transmet pas, mais le vendeur les garde.
- Déjà connu : en partie : fiche 153, Q4 (dépôt neuf décidé le 07/11 ; non fait au 23/11) ; le risque de preuve n'y est pas traité
- Correction suggérée : Garder le dépôt de travail complet et le figer à la date de la cession par un moyen daté (dépôt chez un tiers, constat de commissaire de justice ou séquestre), prévoir au contrat sa production en cas de litige, et joindre une note courte sur la méthode (l'utilisateur fixe chaque demande et valide chaque essai, l'IA écrit).

### C-18 · Dix logos d'activité produits par un générateur d'images : cessibles « sans exclusivité » seulement

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : src/components/logos/logoPaths.ts:1-5 ; src/components/icons.tsx:288 (IconWingfoil) ; atelier hors dépôt (planche des icônes)
- Constat : Dix des onze logos d'activité sont des images produites par le générateur d'images de Google Gemini, vectorisées sans retouche : elles ne sont probablement protégées par aucun droit d'auteur, le vendeur ne peut donc pas les céder comme une exclusivité ; l'origine de l'icône du wingfoil (« sur le modèle fourni », d'après une photo) n'est écrite nulle part.
- Déjà connu : en partie : fiche 153:8 (« les éléments Canva ne se cèdent pas », ancienne planche) et fiche 308 (crédits des images absents, toujours vrai le 23/11) ; l'origine Gemini et la photo du wingfoil : non
- Correction suggérée : Écrire le fichier de crédits prévu par la fiche 308 (origine et outil de chaque image), le reprendre dans l'acte où ces dessins sont livrés « sans garantie d'exclusivité » ; déclarer l'origine Gemini dans l'acte, ce que les conditions de Google imposent de toute façon (elles interdisent de faire passer une image d'IA pour une œuvre humaine) ; retrouver la source de la photo du wingfoil ou redessiner cette icône. Y joindre la source du trait de pinceau des cadres (trait-cadre-pinceau.svg), aujourd'hui non écrite, et rassembler les scripts générateurs (champ, poissons), aujourd'hui hors dépôt. Si GONG veut des logos protégeables, un graphiste les redessine et lui cède ses droits.

### C-33 · Relevé des six endroits où figurent le logo, le slogan et les photos de GONG

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : vendeur avant la cession, à confirmer par un professionnel du droit.
- Endroit : src/assets/logo/gong-logo-full.svg (lu par src/components/gongLogoPath.ts) ; src/assets/logo/gong-symbol.svg et outils/logo/icones-android.mjs ; public/favicon.svg ; assets/splash.png ; src/assets/profil/entete-telephone.webp, entete-ordinateur.webp ; src/pages/ProfilePage.tsx:403 ; outils/licences-hors-js.mjs:43-48
- Constat : Relevé, pas un défaut : le logo, le slogan et les photos de GONG, mis pour cet acheteur, se trouvent à six endroits distincts, chacun simple à remplacer.
- Déjà connu : fiche 310 (copie du logo) et fiche 153 (crédits) ; DECISIONS.md:135
- Correction suggérée : Rien à corriger tant que GONG accepte ses éléments ; s'il les refuse, remplacer les six endroits listés et régénérer. Garder ces éléments hors de la cession dans l'acte (ils appartiennent déjà à GONG).

## 507 · Note de remise à GONG : ce qui lui reviendra comme éditeur

Résultat attendu : une note écrite, remise avec le produit, qui dit à GONG ce qu'il devra régler avant de diffuser (fournisseurs de cartes, confidentialité, Google Play, nom, règlement européen, mises à jour, mise en garde nautique). Modèle : Sonnet/medium.

### C-06 · Plan OpenStreetMap : serveurs gratuits qui interdisent le « hors ligne » et peuvent couper sans préavis

- Gravité : avant livraison ; effort : moyen ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : src/core/mapBase.ts:39 ; src/platform/mapTiles.ts:137-144 ; src/core/tiles.ts:21-23 ; src/platform/tileCache.ts:346 ; src/pages/SettingsPage.tsx:779
- Constat : Le plan vient des serveurs gratuits d'OpenStreetMap. Leur règle permet de remontrer les morceaux de carte déjà vus, mais interdit toute fonction « hors ligne » et tout chargement d'une zone à l'avance ; elle prévient aussi qu'un service commercial peut être coupé à tout moment sans préavis. Or l'application présente ses morceaux gardés comme des cartes hors ligne (500 Mo par défaut, jusqu'à 20 Go, montrés sans limite de durée) et son aide invite à parcourir une zone avant de partir.
- Déjà connu : fiche 152 (Q5 ouverte), fiche 308 point 5, audit du 03/11 (A1 · V1-1) ; état vérifié le 23/11 : cache et texte d'aide inchangés, aucun fournisseur sous contrat
- Correction suggérée : GONG prend un fournisseur qui permet par contrat le cache des tuiles vues (Thunderforest le dit expressément ; MapTiler ou Stadia sous conditions) ou sert ses propres tuiles ; l'adresse est déjà réglable (mapBase.ts:70-84) et la règle de cache doit devenir une propriété de chaque fond dans core/mapBase.ts. Côté vendeur, petit geste avant remise : retirer la phrase « parcourez la zone » de l'aide (clé par t, trois langues).

### C-07 · Recherche de lieux sur un serveur de démonstration, qui peut être coupé

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur.
- Endroit : src/planning/geocoding.ts:17-20 ; src/hooks/sessionLibrary/placeQueue.ts:17-35 ; src/hooks/usePlaceSearch.ts:6-13
- Constat : Le nom du lieu de chaque session et la recherche de Planifier passent par le serveur public de démonstration de Photon (komoot), offert sans contrat ni garantie, qui ralentit ou bannit sans préavis une application trop utilisée.
- Déjà connu : en partie : docs/DECISIONS.md:100 (conditions lues le 13/11, « à redire à la livraison ») ; aucune fiche du reste à faire
- Correction suggérée : GONG héberge sa propre instance de Photon (logiciel libre Apache 2.0) ou prend un service payant de recherche inverse ; l'adresse se change à un seul endroit (planning/geocoding.ts). Ne pas basculer vers le serveur public de Nominatim, plus restrictif. Le vendeur le déclare par écrit.

### C-08 · Pas de politique de confidentialité (exigée par Google Play et le Microsoft Store)

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : aucun fichier de politique dans le dépôt ; src/components/AboutSettings.tsx:108-133 (aucun lien, aucune mention d'Esri)
- Constat : Il n'existe ni politique de confidentialité ni lien vers elle, alors que Google Play et le Microsoft Store l'exigent de toute application, et l'écran « À propos » ne nomme ni Esri, ni ce que reçoivent les serveurs de cartes, ni le passage de données aux États-Unis.
- Déjà connu : fiche 151 et BACKLOG 308 point 3 ; état vérifié le 23/11 : politique absente, aucun lien ; « À propos » fait mais sans Esri ni destinataires
- Correction suggérée : Le vendeur livre un brouillon de politique fidèle au code (traitement local, flux réseau listés, Esri et États-Unis, aucune télémétrie, dossier mémoire, désinstallation) et ajoute dans « À propos », par t, une phrase nommant OpenStreetMap et Esri avec un emplacement pour le lien ; GONG la publie à une adresse web publique sous son nom.

### C-10 · Déclarations de la console Google Play à préparer (position, santé, vidéo)

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : aucun brouillon des formulaires Play ; android/app/src/main/AndroidManifest.xml:89-93 (service de position) ; src/planning/geocoding.ts:26 (arrondi à 3 décimales)
- Constat : Les déclarations de la console Google Play (service au premier plan de type position avec sa vidéo, « Sécurité des données », « Applications de santé ») n'ont pas de brouillon, et leurs réponses ne sont pas évidentes : la recherche de lieux envoie à un tiers une position « précise » au sens de Google.
- Déjà connu : fiche 151, BACKLOG 308 point 4, fiche 403 (vidéo) ; état vérifié le 23/11 : brouillons absents ; neuf : la qualification de Photon en position précise partagée
- Correction suggérée : Le vendeur livre les brouillons tirés du code (position précise partagée avec komoot, zone de carte et adresse IP vers les serveurs de tuiles, FC et profil traités sur l'appareil seulement, chiffrement en transit, pas de compte) et la vidéo d'un départ d'enregistrement ; GONG les relit et les dépose.

### C-11 · Phrase « pas un dispositif médical » absente

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : aucune phrase « pas un dispositif médical » (textes de src/pages/RestingHrTestPage.tsx, src/components/HeartRatePanel.tsx:170-186) ; future description de la fiche Play
- Constat : Ni l'application ni un texte de fiche ne disent que Gtracker n'est pas un dispositif médical. Google Play exige cette phrase des applications de santé à fonction médicale non réglementée ; sa règle ne dit pas clairement si une application de sport en fait partie, mais la fréquence cardiaque et le test au repos l'en rapprochent. L'application, elle, ne fait aucune allégation médicale.
- Correction suggérée : GONG met la phrase demandée dans la description Play et évite dans toute sa communication les mots qui donneraient une finalité médicale (surveiller le cœur, détecter, alerter, prévenir) ; le vendeur peut ajouter la même phrase dans « À propos », par t.

### C-14 · En 2027, Google exigera un développeur vérifié et une clé enregistrée

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : diffusion de l'APK par lien (docs/ETAT_DU_PROJET.md §12, « Diffusion ») et par l'installeur Windows (outils/bureau.mjs:93-122, 385-394) ; clé de signature hors dépôt (android/app/build.gradle:21-25)
- Constat : Google a annoncé que, courant 2027, une application dont le développeur n'est pas vérifié et dont le nom technique n'est pas enregistré avec sa clé de signature ne s'installera plus normalement sur les téléphones Android certifiés, sauf par le câble de développement ; c'est le cas de l'APK actuelle, signée par la clé du vendeur.
- Déjà connu : fiche 405 point 1 (calendrier à recouper : recoupé ici) ; fiches 153:22 et 308 point 6 (clé cédée ou neuve) ; état vérifié le 23/11 : clé et identifiant du vendeur
- Correction suggérée : Au contrat : dire si la clé de signature est cédée (avec remise sécurisée) ou si GONG prend un identifiant et une clé neufs, et que le vendeur n'enregistre aucun nom technique à son nom. GONG fait vérifier son identité et enregistre le nom technique avant 2027 ; l'installation par câble reste une voie de secours.

### C-19 · Nom « Gtracker » ni recherché ni déposé, homonymes dans les boutiques

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : capacitor.config.ts:11 (appName « Gtracker ») ; android/app/src/main/res/values/strings.xml (app_name) ; outils/bureau.mjs:52, 70-80, 354-361
- Constat : Le nom « Gtracker » n'a été ni recherché dans les registres de marques ni déposé, alors que plusieurs applications de suivi GPS portent déjà le même nom, dont une de la catégorie Sports.
- Correction suggérée : Côté vendeur : écrire dans l'acte qu'il cède le code et ses droits d'auteur, aucun droit sur le nom « Gtracker », jamais déposé ni garanti. Côté GONG : choisir le nom final, faire faire une recherche d'antériorité (France, Union, Royaume-Uni ; classes 9 et 42, voisines 41 et 28) et déposer avant la mise en ligne ; le nom affiché tient dans quelques constantes, l'identifiant gtracker des formats de fichier n'a pas à suivre.

### C-20 · Règlement européen sur la cyberrésilience : rien de prêt

- Gravité : avant livraison ; effort : moyen ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : dépôt entier (aucun SECURITY.md, aucune nomenclature SPDX ou CycloneDX) ; src/components/AboutSettings.tsx:108-133 (aucun contact)
- Constat : Rien de ce que le règlement européen sur la cyberrésilience demande au « fabricant » n'existe encore : ni adresse pour signaler une faille, ni liste des composants dans un format standard, ni analyse des risques écrite, ni durée de suivi annoncée.
- Correction suggérée : Le vendeur remet à la cession une nomenclature produite par un outil (CycloneDX ou SPDX, depuis les deux package-lock.json et Gradle), la carte des échanges réseau (C-faits §1), l'état des constats de sécurité de l'axe B et une note d'architecture. GONG ajoute son identité et une adresse de signalement des failles, et décide de la durée de suivi.

### C-21 · Aucune mise à jour automatique ni avis de mise à jour

- Gravité : avant livraison ; effort : moyen ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : outils/bureau.mjs:279 (publish: null) ; bureau/ (aucun autoUpdater) ; diffusion de l'APK par lien (docs/ETAT_DU_PROJET.md §12)
- Constat : Aucune des deux applications ne sait se mettre à jour seule ni prévenir qu'une mise à jour existe : le programme Windows n'a pas de canal de mise à jour, et l'APK s'installe à la main depuis un lien (ou par le câble, depuis un programme Windows plus récent, qui embarque l'APK de sa version).
- Déjà connu : fiche 452 (« signature ou Microsoft Store, mise à jour ») ; état vérifié le 23/11 : toujours aucune mise à jour, ni sous Windows ni sur Android
- Correction suggérée : GONG passe par Google Play pour Android et met en place sous Windows une mise à jour signée (electron-updater ou Microsoft Store), l'annonce dans la page passant par une pièce de src/platform/ ; le vendeur signale la limite par écrit.

### C-23 · Pas d'avertissement « ni instrument de navigation ni équipement de sécurité »

- Gravité : avant livraison ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : src/pages/PlanningPage.tsx:774 (« En navigation (« Partir ») … bips de plus en plus rapides à l'approche ») ; src/components/AboutSettings.tsx:108-133
- Constat : L'application guide sur l'eau vers des balises, avec des bips d'approche, mais ne dit nulle part qu'elle n'est ni un instrument de navigation ni un équipement de sécurité.
- Correction suggérée : Une phrase dans « À propos » et dans l'aide de Planifier, par t dans les trois langues : « Gtracker n'est ni un instrument de navigation ni un équipement de sécurité ; gardez le matériel et les précautions exigés pour votre sortie. » GONG décide s'il l'affiche aussi à la première ouverture.

### C-28 · La désinstallation du programme Windows laisse le profil du pratiquant sur le PC

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur.
- Endroit : outils/bureau.mjs:272 (deleteAppDataOnUninstall: false) ; bureau/copieSecurite.ts:1-10
- Constat : Désinstaller le programme Windows laisse sur le PC le profil du pratiquant (poids, taille, année de naissance, sexe, fréquences cardiaques) dans la mémoire du programme, et les copies de sécurité complètes des deux appareils, sans que rien ne le dise.
- Correction suggérée : Le dire dans la politique de confidentialité et dans Réglages › Mémoire ou à la fin de l'installeur ; éventuellement un bouton « Effacer les données de ce PC ».

### C-31 · « Parawing » employé comme nom de discipline, alors qu'une société du groupe GONG en aurait demandé la marque

- Gravité : confort ; effort : petit ; vérification : sourcé ; côté : GONG comme éditeur, à confirmer par un professionnel du droit.
- Endroit : src/core/activities.ts:188 (activité de départ « Parawing », cachée d'office) ; src/locales/en.json et es.json ; src/components/logos/logoPaths.ts
- Constat : L'application présente « Parawing » comme un simple nom de discipline, à côté de « Wingfoil » ou « Kite », alors que GONG GALAXY, société du groupe, aurait demandé en 2025 la marque de l'Union « PARAWING » (d'après la presse ; statut non vérifié dans les registres).
- Correction suggérée : Question à poser à GONG, sans rien changer d'office : garder le mot, l'écrire comme sa marque, ou le remplacer par son propre terme ; le nom d'une activité de départ est une constante de core/activities.ts avec ses traductions.

## 508 · Confort relevé par la relecture, à piocher

Résultat attendu : rien de visible, un code plus simple à reprendre. Modèle : Sonnet/high.

### D-01 · Grandes pages écrites d'un seul bloc (déjà connu)

- Gravité : avant livraison ; effort : gros ; vérification : confirmé.
- Endroit : src/pages/SurfModule.tsx:182 ; src/pages/PlanningPage.tsx:235 ; src/pages/SailingModule.tsx:97 ; src/pages/StatisticsPage.tsx:240 ; src/pages/RecordingPage.tsx
- Constat : Les grandes pages (analyse du surf, planification, analyse de la voile, statistiques, enregistrement) restent écrites chacune en un seul bloc de 700 à 800 lignes, et elles ont encore grossi depuis la dernière revue.
- Déjà connu : fiche 404 point 1 et fiche 160 « Pages d'une seule fonction » (état vérifié : rien n'a été découpé depuis le 15/11, les quatre fonctions ont pris 3 à 107 lignes, SurfModule le plus)
- Correction suggérée : Commencer par components/surf/ sur le patron de components/sailing/ (un composant par onglet, états gardés dans le module comme au lot A du 06/11), puis Statistiques et Planification ; vérifier la neutralité au banc par le texte de page avant et après.

### D-04 · Près de 200 réglages d'apparence écrits dans le code des écrans (déjà connu)

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/components/sailing/ManeuversPanel.tsx:176 ; src/pages/analysisMobile.css:449 ; outils/styles-en-ligne.json
- Constat : Les réglages d'apparence écrits directement dans le code des écrans ont beaucoup baissé, mais il en reste près de 200, et les règles « forcées » qui servent à passer par-dessus ont augmenté.
- Déjà connu : fiche 160 « Styles en ligne » (état vérifié : 196 styles en ligne, cliquet en place ; les !important sont passés de 30 à 43 ; les 51 de ManeuversPanel restent à sortir)
- Correction suggérée : Sortir les blocs de ManeuversPanel et des panneaux voile en classes an-* de analysisMobile.css, puis retirer les !important devenus inutiles ; ajouter le nombre de !important au cliquet existant pour qu'il ne remonte plus.

### D-05 · Quatorze confirmations passent encore par la fenêtre grise du système

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/pages/SettingsPage.tsx:630 ; src/components/TrashZone.tsx:65 ; src/pages/RecordingPage.tsx:816 ; src/components/ui/Dialog.tsx:14
- Constat : Quatorze questions de confirmation (supprimer, vider la corbeille, effacer les cartes…) et un avertissement passent encore par la boîte grise du système au lieu de la fenêtre de l'application.
- Déjà connu : fiche 160 « Textes » (« confirmDialog() à la place des 19 window.confirm ») (état vérifié : 14 restent, plus 1 window.alert)
- Correction suggérée : Créer dans components/ui une confirmation à promesse bâtie sur Dialog (texte, bouton d'action, Annuler), puis remplacer les 15 appels ; leaveGuard garde un repli synchrone si la navigation l'exige.

### D-06 · Dates et heures mises en forme à plusieurs endroits

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/core/units.ts:256 ; src/core/calendar.ts:63 ; src/components/SessionRow.tsx:31 ; src/components/ActivityChart.tsx:50 ; src/components/FollowTracePicker.tsx:52 ; src/components/RouteList.tsx:61 ; src/pages/StatisticsPage.tsx:698
- Constat : Les dates et heures se mettent en forme à deux endroits officiels différents, plus une dizaine de petites recettes recopiées dans les écrans.
- Correction suggérée : Garder core/calendar.ts comme seule maison des dates et heures affichées (y ajouter timeOfDayShort et dateNumeric), y faire pointer formatTimeOfDay et formatSessionDate de units.ts, et remplacer les copies locales par ces formateurs nommés.

### D-07 · Titre de section repliable refait une dizaine de fois

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/components/PanelTitle.tsx:30 ; src/components/SettingsPart.tsx:12 ; src/pages/SettingsPage.tsx:351 ; src/pages/SettingsPage.tsx:967 ; src/components/ChartFold.tsx:26 ; src/pages/PlanningPage.tsx:213
- Constat : Le titre de section qui se replie avec une petite flèche est refait une dizaine de fois, chacun avec son code et son style.
- Correction suggérée : Créer dans components/ui une pièce « titre repliable » (vrai <button>, aria-expanded, chevron tourné par une classe ui-chevron--open de ui.css) et y ramener PanelTitle, SettingsPart, les deux bascules de Réglages et PlanBlock ; les autres suivront au fil des lots qui les touchent.

### D-08 · Saisie et arrondi des nombres refaits à la main

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/components/BeepCurveEditor.tsx:66 ; src/components/SpeedRangeEditor.tsx:35 ; src/components/SessionThresholdField.tsx:46 ; src/pages/SettingsPage.tsx:301 ; src/components/ProfilePrompt.tsx:64 ; src/core/units.ts:33
- Constat : La saisie et l'arrondi des nombres sont refaits à la main dans plusieurs écrans alors que des pièces communes existent déjà pour cela.
- Correction suggérée : Ajouter à core/units.ts une fonction speedDecimals(unit) et un arrondi d'affichage d'une vitesse, faire passer les champs par NumberField (ou une variante « valeur rangée à la sortie » dans components/), et remplacer les recettes par parseDecimal et toFixedNumber.

### D-09 · Valeur absente : tantôt petit tiret, tantôt tiret long

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/core/units.ts:114 ; src/library/shareStats.ts:37 ; src/components/sailing/ManeuversPanel.tsx:324
- Constat : Une valeur manquante s'affiche tantôt avec un petit tiret, tantôt avec un tiret long, parfois dans le même tableau.
- Correction suggérée : Nommer un seul signe de valeur absente dans core/units.ts (une constante MISSING) et le faire employer par tous les formateurs et écrans ; le changement est visible, donc à faire valider d'abord.

### D-11 · Un peu de code mort

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/hooks/useNarrowScreen.ts:62 ; src/components/ActivityBubbles.tsx:63 ; src/components/ui/ui.css:148 ; src/components/RouteList.css:64 ; src/components/BrushFrame.css:115 ; src/platform/desktopBridge.ts:253
- Constat : Le code vraiment mort est rare : une fonction, trois styles et deux descriptions de messages ne servent plus, et une de ces fonctions est même réécrite à la main ailleurs.
- Correction suggérée : Faire employer usePrefersReducedMotion par ActivityBubbles, retirer les trois classes et les deux types sans emploi ; ajouter knip en développement avec une configuration (points d'entrée du banc et de la coquille) pour garder ce niveau.

### E-01 · Très longue session (4 h à 5 points par seconde) : plusieurs secondes à l'affichage

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/library/trackWorkerClient.ts:108 ; src/library/analysisStore.ts:163,191 ; src/core/prepareTrack.ts:49 ; src/core/trackColor.ts:18-21 ; src/hooks/useSailingSession.ts:148 ; src/pages/SurfModule.tsx:219
- Constat : Une très longue session (4 heures enregistrées à 5 points par seconde) met plusieurs secondes à s'afficher à la vitesse d'un téléphone moyen, avec l'écran figé près d'une seconde ; changer son seuil fige encore l'écran près d'une seconde.
- Déjà connu : fiche 400 (état vérifié : étapes 1 et 2 faites, lecture et analyse dans un calcul de fond à deux files, points bruts plus renvoyés ; ses mesures du 15/11 ne portaient que sur 1 h à 5 Hz : 0,22 s de tâche max à x6, contre 0,72 à 0,90 s aujourd'hui sur 4 h) et ETAT §11 « Fluidité » (changement de seuil « pas plus rapide », le redessin en est le gros)
- Correction suggérée : Faire voyager la trace préparée et les traits colorés en tableaux typés transférables (positions en Float64Array, couleur en indice parmi les 64 nuances de TRACK_COLOR_LEVELS) plutôt qu'en dizaines de milliers d'objets clonés, et ne renvoyer à la page que ce qu'elle lit ; mêmes fonctions de calcul, donc mêmes chiffres (summaryFrozen.test.ts inchangé), pathOptions stables (règle 11). Mesurer ensuite au téléphone avec fluidite-compile.

### E-02 · Démarrage : 941 ko chargés avant le premier écran

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/main.tsx:38-41 ; src/boot.tsx:1-19 ; src/App.tsx:58-81,150
- Constat : Le démarrage charge 941 ko de code avant le premier écran (721 ko au 15/11, 774 ko au 03/11), et le préchargement de toutes les pages fige ensuite l'écran 0,8 s à la vitesse d'un téléphone moyen.
- Déjà connu : fiche 404 point 6 (état vérifié : rien n'a changé dans la structure, le poids avant le premier affichage est passé de 721 à 941 ko) et audit du 03/11, RAPPORT.md ligne 123 (« démarrage à 774 ko au lieu des 530 visés ») ; le gel dû au préchargement n'y est pas mesuré
- Correction suggérée : Sortir de la chaîne de boot.tsx ce qui ne sert pas au Profil (une partie de useSessionLibrary, l'import et la lecture des fichiers de montre) et précharger les pages après la première interaction ou par morceaux plus petits, en vérifiant au téléphone que le gain est réel (fiche 404 : « à mesurer au téléphone avant d'y toucher »).

### E-04 · Une analyse de 4 h occupe environ 200 Mo de mémoire en plus

- Gravité : confort ; effort : moyen ; vérification : plausible.
- Endroit : src/library/analysisStore.ts:142-152 ; src/library/trackWorkerProtocol.ts:27,83
- Constat : Une analyse de 4 heures ouverte occupe environ 200 Mo de mémoire de plus, la trace étant gardée à la fois par la page et par le calcul de fond.
- Déjà connu : fiche 404, relevé du 15/11 (« Deux calculs en arrière-plan (analyse, fond) : la mémoire de la trace est doublée tant qu'une analyse est ouverte ; à regarder sur un téléphone modeste ») ; état vérifié : inchangé, mesure d'aujourd'hui ci-contre
- Correction suggérée : Va de pair avec E-01 : des tableaux typés transférés au lieu d'objets clonés divisent la copie de la page, et la mémoire du calcul peut ne garder que la trace préparée, sans le texte du GPX une fois lu.

### A-09 · Une ancienne version du programme peut retirer des activités créées par une version plus récente

- Gravité : confort ; effort : petit ; vérification : confirmé.
- Endroit : src/library/settingsFile.ts:54-61 et 67-78 ; src/hooks/sessionLibrary/deviceSettings.ts:183-211
- Constat : Le fichier de réglages de l'appareil écrit par une version plus récente peut être réécrit par une version plus ancienne, qui en retire les activités posées sur un calcul qu'elle ne connaît pas, tout en gardant le numéro de version le plus haut.
- Correction suggérée : Lire version dans parseSettingsFile et tenir le fichier de l'appareil d'une version plus récente pour non inscriptible, comme lieux.json ; à défaut, ne jamais écrire un numéro supérieur à SETTINGS_VERSION. À traiter avec l'élément 479.

### A-11 · L'heure d'une session est celle du fuseau de l'appareil qui la lit, pas du lieu où elle a été faite

- Gravité : confort ; effort : moyen ; vérification : confirmé.
- Endroit : src/core/calendar.ts:11-56 ; src/core/units.ts:256-273 ; src/recording/session.ts:245-256
- Constat : Les dates et heures d'une session sont celles du fuseau de l'appareil qui la lit, pas de l'endroit où elle a été faite : une session faite en voyage change d'heure, voire de jour et d'année, au retour.
- Correction suggérée : Garder dans la fiche le décalage horaire de l'enregistrement (connu du téléphone au départ ; déduit de la position pour un GPX importé) et s'en servir pour la date montrée, les semaines et l'année ; ou décider et écrire que l'heure montrée est celle de l'appareil.
