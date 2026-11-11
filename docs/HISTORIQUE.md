# Historique des décisions et pièges de Gtracker

Ce fichier est le §10 de `docs/ETAT_DU_PROJET.md`. C'est le journal de Gtracker, la version voile et surf : il commence au point 323, le premier écrit après la séparation, et sa numérotation ne change jamais. À consulter par recherche (sujet, nom de fonction, « point N ») sur le sujet qu'on touche, avant de retenter ce qui a déjà été essayé.

**Points 1 à 322** : ils appartiennent à l'historique de Tracker d'avant le 11 novembre 2026 et ne sont pas repris ici (décision de l'utilisateur du 11/11 : ne pas réécrire deux mois d'historique d'une autre application). Un renvoi « §10, point N » qui vise l'un d'eux s'y lit : copie figée hors dépôt (dossier d'atelier, `historique-avant-1111/HISTORIQUE.md`), ou `git show 012f55a:docs/HISTORIQUE.md`. Ce journal ne part pas chez l'acheteur.

**Un point nouveau tient en quelques lignes** : ce qui a été décidé, pourquoi, le piège à retenir. On n'y met ni la liste des fichiers touchés ni le récit de la livraison, que git garde.

323. Logo et icône de Gtracker à partir du logo GONG (lot 310, validé le 11/11 sur téléphone, essais 201 à 203, version 0.00.01 ; essayé sur l'APK 0.00.05).
    - **Décision** : icône du lanceur en symbole GONG noir sur fond blanc (marge de 22 %, noir ou blanc seulement d'après le brief du DA), pour se distinguer de Tracker ; accueil, barre du haut et « À propos » portent le logo GONG complet puis « Gtracker » (composant `GongLogo`) ; le pied de l'image de partage dessine le même logo en gris, puis « Gtracker », pseudo à droite. Le tracé est lu une seule fois dans le SVG (`gongLogoPath.ts`). Police Shrikhand retirée (code, licences, dépendance) ; l'écran de démarrage reste l'ancien (lot 311).
    - **Pourquoi** : le logo de l'application vendue est celui de GONG ; une icône blanche sur noir n'a pas été retenue sur la maquette du 08/11.
    - **Piège** : `text-shadow` n'atteint pas un SVG, l'ombre de l'accueil passe par `drop-shadow` ; le logo GONG est une marque, pas une licence libre, d'où une entrée dans les licences hors JS.

324. Unions et réglages réduits à la voile et au surf (lot 305, validé le 11/11 sur téléphone, essai 208, version 0.00.05).
    - **Décision** : `SportType`, `Treatment` et `SportFamily` valent `'voile' | 'surf'`, et les activités, pré-réglages, `StoredSettings`, chiffres du direct, thème et icônes suivent ; les migrations de la terre deviennent des fonctions sans effet, nommées, les versions des réglages restent inchangées, le lecteur de fiche passe en version 2. La planification tourne sur des valeurs neutres jusqu'au lot 304. Essai 208 : seules Voile et Surf apparaissent (accueil, bibliothèque, Réglages). Les essais 211 (mise à jour depuis la 0.00.04, impossible : la 0.00.05 a été installée directement) et 212 (ouvrir le dossier mémoire de Tracker) n'ont pas été joués, le second abandonné parce que l'ouverture de ce dossier est coupée (décision du 11/11).
    - **Pourquoi** : le compilateur ne doit plus rien lister de la terre ; une fiche ou un réglage d'une famille disparue est ignoré à la lecture, jamais rejeté ni réécrit autrement.
    - **Piège** : relecture d'Opus le 11/11 : validable tel quel, cinq défauts faibles reportés au lot 325.

325. Porte d'import bornée aux sessions de voile et de surf (lot 321, validé le 11/11 sur téléphone, essais 213 à 215, version 0.00.12).
    - **Décision** : une session de l'ancienne application n'entre que par un fichier (GPX complet, paquet de session, « Ajouter les sessions d'un dossier »), convertie au format neuf à l'entrée ; rien d'autre n'est repris (ni itinéraires ni réglages), sauf les mesures des capteurs. Une session de course, de vélo ou d'entraînement est laissée de côté avec une phrase du compte rendu ; le dossier de l'ancienne application est refusé comme dossier mémoire. Formats neufs (`gtracker-session`, `gtracker-capteurs`, `gtracker-memoire`, table de `core/appIdentity.ts`) ; l'ancien format n'est lu que dans `library/legacyImport.ts`. Constaté : le dossier des sessions de l'ancienne application ne range que voile et surf (essais 213 et 214), son dossier mémoire est refusé (essai 215).
    - **Pourquoi** : un seul endroit connaît l'ancien format, donc le reste du code, lui, n'a plus rien à tolérer et une garde peut le vérifier ; une fiche ancienne plus récente ou illisible ne bloque pas la session, la trace seule est rangée.
    - **Piège** : à la relecture, le refus du dossier de l'ancienne application arrivait après que le choix était gardé, et le dossier en service était oublié ; le refus se fait maintenant avant, et le dossier en service reste.

326. Fiche et résumé détachés de la terre ; test de FC repos sous le Profil (lot 301, validé le 11/11 sur téléphone, essai 204 sur la 0.00.13 : Profil, « Test de FC repos », le retour d'Android ramène au Profil ; fait en 0.00.02).
    - **Décision** : le test de FC repos vit sous le Profil (`/profil/fc-repos`), plus sous l'Entraînement ; le pop-up du profil se réduit au pseudo et à l'année de naissance ; la fiche et le résumé ne lisent plus rien de la terre, `SUMMARY_CALC_VERSION` inchangé. Les voies suivies et l'altitude du terrain d'une fiche venue de l'application complète passent bruts, réécrits tels quels ; les lots 306 et 325 ont ensuite retiré le reste (saisies, séances, test, cadence).
    - **Pourquoi** : le test et le profil servent la voile et le surf (FC de repos, zones) et n'ont pas à attendre le retrait de l'Entraînement ; un chiffre du résumé qui ne bouge pas laisse les résumés figés et les fiches rangées intacts.
    - **Piège** : un champ qu'on cesse de lire est perdu à la réécriture de la fiche ; il doit passer par le reste inconnu, d'où le test d'écriture à l'octet.

327. Restes morts de la terre et de l'Entraînement retirés (lot 325, validé le 11/11 sur téléphone, essai 218 sur la 0.00.13 : la notification d'enregistrement est là, sa durée avance, et « Partager » l'image d'une analyse ouvre le partage d'Android ; fait en 0.00.07 et 0.00.10).
    - **Décision** : part tout ce que le retrait de la terre avait laissé sans lecteur : altitude et dénivelé du direct, allure min/km, temps estimé des itinéraires (avec Overpass et le rattachement aux voies), champs et fonctions sans appelant, son « final » et chronomètre à rebours de la notification, noms hérités. Le D+ du Profil est retiré sur décision du 11/11 : l'altitude du GPS en mer n'est que du bruit ; il reste dans le résumé des fiches, pour ne pas changer `SUMMARY_CALC_VERSION`. Le partage d'Android ne sert plus que le dossier de cache.
    - **Pourquoi** : une garde peut vérifier ce qui n'existe plus, pas ce qui traîne inerte ; chaque retrait a été prouvé neutre par les tests, les résumés figés et le banc.
    - **Piège** : la copie gelée du lecteur GPX (résumés figés) a dû être retouchée des deux côtés pour les champs retirés. L'option des sauts n'est plus écrite mais reste lue avec tolérance, pour un fichier de capteurs venu de l'ancienne application. Le côté « avant » du banc trébuche quand deux serveurs se disputent le cache de Vite : rejouer sans relevé réutilisé avant de conclure.

328. Banc : l'import de GPX réparé sur ce poste (lot 312, validé le 11/11 sur lecture).
    - **Décision** : les scripts du banc lisent le dossier mémoire « Gtracker » de l'OPFS ; trente d'entre eux lisaient encore « Tracker », nom d'avant la copie. Les passes voile et surf (`general`, `surf`, `partage`) repassent sans échec.
    - **Pourquoi** : sans import fonctionnel, le banc ne pouvait plus prouver la neutralité des lots de retrait.
    - **Piège** : le symptôme (« import … : absent », fiches absentes, 21 à 29 échecs, identiques à HEAD) ressemblait à un défaut de l'application ; la cause était dans les scripts. Un renommage de dossier mémoire doit passer aussi par `outils/banc/`.

329. Course et vélo retirés (lot 303, validé le 11/11 sur téléphone, essai 210 sur la 0.00.20 : un enregistrement de wing avec capture des sauts montre ses sauts dans l'analyse ; fait en 0.00.04).
    - **Décision** : les dossiers `running`, `cycling` et `land`, `LandModule`, les panneaux de cadence, de pente, d'énergie, de poids et de charge, et la cadence du plugin de mouvement partent ; les familles À pied et Vélo sont cachées. La planification perd sa dépendance à la terre par `planning/grade.ts`. Les deux listes de la couture de `architecture.test.ts` sont vides.
    - **Pourquoi** : l'application vendue ne couvre que la voile et le surf ; le code commun ne devait plus rien importer de la terre pour que le retrait soit vérifiable.
    - **Piège** : le plugin de mouvement servait aussi aux sauts ; retirer la cadence sans casser la capture des sauts est ce que l'essai 210 a confirmé sur téléphone.

330. Atelier remis à jour pour Fable 5.2 (lot 318, validé le 11/11 sur lecture, hors version).
    - **Décision** : effort medium pour l'orchestrateur, seuil de contexte en jetons, `/clore` n'envoie plus sans « avec envoi », bloc des lots en parallèle sorti de `/chaine`, alerte des relectures oubliées dans le tableau de bord du reste à faire ; `.claude/` et `docs/MODELES.md` ne nomment plus l'ancien projet ni un chemin du poste ; port 5174 par défaut du banc.
    - **Pourquoi** : des agents qui lisent un renvoi cassé ou un nom d'ancien projet travaillent sur du faux.
    - **Piège** : `CLAUDE.md` et `DECISIONS.md` n'ont pas été touchés par ce lot (repris au lot 331) ; `/reprise` dans une session ouverte dans le dépôt reste à éprouver.

331. Jeu d'essai figé de la porte d'import (lot 320, validé le 11/11 sur lecture, hors version).
    - **Décision** : une session de wingfoil et une de surf, telles que le code d'origine les écrit (GPX, fiche, capteurs, paquet), servent de jeu figé ; un test de 19 cas prouve que la porte actuelle les lit sans rien perdre.
    - **Pourquoi** : la porte d'import (point 325) doit rester fidèle à l'ancien format même quand le code autour change.
    - **Piège** : le générateur du jeu n'est pas dans le dépôt, seul le résultat figé l'est ; aucun code de production touché.

332. Renommage « tracker » → « gtracker » (lot 322, validé le 11/11 sur lecture, version 0.00.11).
    - **Décision** : un renommage sec, par une table unique des noms (`core/appIdentity.ts`) : clés de l'appareil, formats de fichier, caches, base, créateur écrit dans chaque GPX, libellés visibles, ressources Android ; aucune relecture de l'ancien nom, donc les réglages d'un appareil repartent de zéro.
    - **Pourquoi** : une application vendue ne doit plus porter le nom de l'autre ; une lecture de l'ancien nom aurait gardé un lien technique que le lot 323 cherchait à couper.
    - **Piège** : l'ancien nom était dispersé jusque dans le banc et les outils ; une garde permanente (`src/heritage.test.ts`) refuse son retour et ne tolère que la porte d'import et les lignes encore dues aux lots suivants.

333. Identité Android et clé de signature propres à Gtracker (lot 323, validé le 11/11 sur téléphone, essai 219 réussi sur la 0.00.20, version 0.00.12).
    - **Décision** : identifiant, `namespace` et paquet Java `io.github.segneur.gtracker`, étiquettes de journal `Gtracker…`, clé de signature neuve, hors dépôt, propre à Gtracker.
    - **Pourquoi** : une application sans lien technique avec Tracker : ni mise à jour croisée, ni installation qui écrase l'autre.
    - **Piège** : la clé ne se régénère jamais, l'utilisateur doit la sauvegarder ; l'essai 219 (enregistrement de wing avec les capteurs, puis « Ouvrir avec » Gtracker sur un GPX) a confirmé que l'identifiant neuf reçoit bien les fichiers.

334. Zone cardiaque visée et ses bips retirés (lot 333, validé le 11/11 sur lecture, version 0.00.13).
    - **Décision** : plus de bouton « Zone visée » sur Enregistrer, plus de bip de sortie de zone, ni le ton « bref » qui ne servait qu'à eux, côté TypeScript et Java ; la ceinture, la FC en direct, les zones des analyses et le test de FC repos restent.
    - **Pourquoi** : réponse de l'utilisateur à l'essai 216, « pas de FC visée », qui annule la décision du 30/10.
    - **Piège** : la clé de l'appareil de la zone visée est retirée aussi ; la section 6 de `DECISIONS.md` dit la fonction retirée, pour qu'elle ne soit pas réintroduite.

335. Supprimer un itinéraire depuis la liste (lot 317, validé le 11/11 sur téléphone, essai 222 réussi sur la 0.00.20, version 0.00.16).
    - **Décision** : un menu « … » par ligne de la liste des itinéraires, avec « Partager » et « Supprimer », la suppression confirmée sur la ligne par « Supprimer définitivement » / « Garder », comme dans Planifier.
    - **Pourquoi** : ranger un itinéraire ne devait pas obliger à repasser par Planifier pour l'effacer.
    - **Piège** : aucun script du banc ne couvre cette page ; la preuve vient de l'essai au téléphone.

336. « Partager la trace » dans le menu « … » des analyses (lot 316, validé le 11/11 sur téléphone, essai 221 réussi sur la 0.00.20, version 0.00.15).
    - **Décision** : une entrée « Partager la trace » juste après « Partager », en voile et en surf, qui ouvre le partage d'Android avec le GPX de la session ; sans partage de fichier, repli en téléchargement ; message si le GPX manque.
    - **Pourquoi** : le GPX et l'image sont deux partages distincts, il faut les deux (réponse du 11/11).
    - **Piège** : le libellé voisin « Partager » ne dit pas qu'il s'agit de l'image ; l'utilisateur voudrait « Partager l'image », gardé comme élément à part (341).

337. Planification réduite au parcours de balises et aux itinéraires importés (lot 304, validé le 11/11 sur téléphone, essai 222 réussi sur la 0.00.20, version 0.00.18).
    - **Décision** : option b de la Q55 du 04/11, confirmée le 11/11 : `RouteMode` vaut `'straight' | 'imported'` ; partent le calcul d'itinéraire (BRouter et son profil), le revêtement, les types de voie, l'altitude du terrain, la pente, le dénivelé et le temps estimé, la boucle de retour calculée. Restent la recherche de lieu (Photon, si elle ne gêne pas la vente) et `isLooped` / `closeLoop`, car le parcours de balises boucle. Les fiches de l'autre application ne sont plus relues ; un GPX simple se charge, sans altitude.
    - **Pourquoi** : aucun service de calcul d'itinéraire ni d'altitude ne doit plus être appelé dans l'application vendue.
    - **Piège** : les fiches d'itinéraire sont en version 4 et non 1 ; à 1, celles des versions 2 et 3 s'ouvraient en lecture seule sous un message trompeur ; la remise à 1 attend la livraison (lot 308). Les conditions d'usage de la recherche de lieu restent à vérifier à ce moment.

338. Petits restes retirés (lot 334, validé le 11/11 sur lecture, version 0.00.20).
    - **Décision** : la fonction de `core/search` lue par son seul test, le paramètre de type de `usePerActivityChoice` et deux versions de bibliothèques de test jamais lues dans `android/variables.gradle` partent.
    - **Pourquoi** : des restes signalés par les agents des lots 325 et 333, sans effet visible mais qui faisaient croire à un usage.
    - **Piège** : le quatrième reste annoncé (taille du titre de l'accueil) était déjà parti ; vérifier avant de retirer.

339. Gardes d'architecture, première partie (lot 327, validé le 11/11 sur lecture, sans version : tests et outil seulement).
    - **Décision** : un test (`src/landWords.test.ts`) et son relevé figé (`outils/heritage.json`) refusent toute hausse du vocabulaire de la terre ; les chemins du poste et l'allure en min/km sont refusés en dur ; la couture vide quitte `architecture.test.ts`, qui garde les deux familles et leurs adresses.
    - **Pourquoi** : ni la terre, ni l'ancien nom, ni l'allure min/km ne doivent revenir sans qu'un test échoue ; la contre-épreuve (un mot ajouté fait échouer le test) a été faite.
    - **Piège** : le relevé est figé, il ne peut que baisser ; la suite (aucun nom de calcul en dur, garde étendue) est l'élément 339 du reste à faire.
