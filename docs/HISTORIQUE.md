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

340. « Partager l'image » (lot 341, validé le 12/11 sur lecture, version 0.00.21).
    - **Décision** : dans le menu « … » d'une analyse, « Partager » devient « Partager l'image », à côté de « Partager la trace » ; la fenêtre de partage, la carte de fin d'enregistrement et la leçon « Partager et exporter » suivent. Le bouton « Partager » de la fenêtre et celui des itinéraires gardent leur nom.
    - **Pourquoi** : deux entrées voisines, l'une pour l'image, l'autre pour le fichier de la trace, que l'utilisateur confondait à l'essai.
    - **Piège** : les scripts du banc qui cherchaient le libellé « Partager » devaient suivre ; seul le libellé et le titre de la fenêtre changent à l'écran.

341. Voile : une seule voie de calcul (lot 328, validé le 12/11 sur lecture, versions 0.00.23 et 0.00.25).
    - **Décision** : la seconde voie de la voile, que seuls des tests et un script du banc appelaient (`estimateWindPolar`, `measureManeuver`, `analyzeManeuvers`…), est supprimée ; les tests passent par la voie livrée (aide `detectAndClassify`). Les seuils n'ont plus de défaut caché sur le wingfoil : plancher d'arrêt et seuil de réussite sont des paramètres obligatoires de la détection, du classement et de l'estimation du vent (les surcharges de `ManeuverOptions` restent). Cinq doublons de `SailingModule` et `SurfModule` deviennent des pièces partagées (`useCardioShortcuts`, `speedCellOf`, `heartRateShareStats`, `shownMarkOf`, `tableStyle`) ; trois sont laissés, leurs copies différant pour une raison.
    - **Pourquoi** : un calcul qui n'existe que dans les tests prouve autre chose que ce que l'utilisateur voit, et un seuil par défaut oublié donnait les chiffres du wingfoil à un autre support (règle 3).
    - **Piège** : une attente de test affaiblie en passant (aucune manœuvre dirigée quand les sens sont incertains) a été rétablie. Preuve de neutralité : résumés figés identiques sans refigeage. L'étape d (découpage des gros fichiers) n'est pas faite, elle reste avec la dette 309.

342. Renvois d'atelier retirés de `src/` (lot 307, validé le 12/11 sur lecture, versions 0.00.22, 0.00.24, 0.00.27 et 0.00.28).
    - **Décision** : plus de « lot N », « Qnn », « point N » du journal, date d'atelier ni numéro du reste à faire dans les commentaires et titres de test de `src/` et des sources Java ; la raison s'écrit en clair, le journal n'étant pas livré. `docs/GLOSSAIRE.md` dit les mots du code qui trompent (course, repère et balise, calcul, support et activité, noms de la FC, seuils).
    - **Pourquoi** : l'acheteur reçoit le dépôt seul ; un commentaire doit tenir sans l'atelier.
    - **Piège** : preuve de neutralité par le code transpilé sans commentaires, identique avant et après (trois titres de test paramétrés exceptés, relus). Dans le noyau de la voile, des pièges que le commentaire ne portait que par renvoi ont dû être récrits (marge des caps stabilisés, vitesse d'entrée commune au vent et aux manœuvres).

343. Gardes d'architecture, suite (lot 339, validé le 12/11 sur lecture, version 0.00.28).
    - **Décision** : `src/architecture.test.ts` refuse tout renvoi d'atelier dans `src/` (cinq faux amis nommés, liste qui ne fait que diminuer), tout nom de calcul en dur hors des tables qui les décrivent (`SPORT_TABLES`, sans exception), et limite à six fichiers nommés l'import de la porte d'import ; `src/heritage.test.ts` refuse aussi « application complète ». La règle 14 de `CLAUDE.md` et la fin de la règle 13 le disent.
    - **Pourquoi** : poser les gardes dès que plus rien ne les violait, sans attendre la fusion famille et traitement.
    - **Piège** : « surf » est écarté du motif des noms de calcul, car c'est aussi une famille ; chaque garde a été éprouvée par une contre-épreuve.

344. Coupure hors du code (lot 324, validé le 12/11 sur lecture, sans version).
    - **Décision** : les refus d'écriture quittent `.claude/settings.json` pour `.claude/settings.local.json` (ignoré par git, protection inchangée) ; identité git du dépôt passée à Gtracker ; l'acheteur reçoit le dépôt seul, le dossier parent est l'atelier et y reste, la livraison se préparera sur une copie du dépôt.
    - **Pourquoi** : rien de l'atelier ni de l'ancien projet ne doit partir avec le dépôt vendu.
    - **Piège** : un nom entre accents graves dans la ligne du reste à faire était pris par le contrôle des renvois pour un nom de code.

345. Banc remis sur la voile et le surf (lot 330, validé le 12/11 sur lecture, sans version : outils seuls).
    - **Décision** : registre et lanceur sans course, vélo ni fractionné ; `outils/banc/lib/traces.mjs` fabrique les traces (voile, surf, longue, sans type) pour tous les scripts, qui n'ont plus de fichier à fournir ni de réseau ; une cinquantaine de scripts réparés ou réécrits et sortis de « manuel », chacun éprouvé par une contre-épreuve (un contrôle faussé échoue). `import-session` remplace `imports` pour la porte d'import ; `fluidite.mjs` mesure de nouveau sur la voile et le surf.
    - **Pourquoi** : le banc est la preuve de neutralité des changements ; la moitié de ses scripts échouaient sur une application qui n'avait plus la terre.
    - **Piège** : la taille variable de l'image de partage venait des tuiles OpenStreetMap lues en direct, pas de l'application ; la graduation flottante des axes fait échouer les relevés de texte tant qu'elle n'est pas masquée. Aucun défaut de l'application trouvé. Non rejoués : la variante compilée de la fluidité et la mesure de l'arrêt d'un enregistrement, à la demande.

346. Enregistreur découpé en couches (lot 329, étape 3, validée le 12/11 sur lecture, version 0.00.26).
    - **Décision** : `useRecorder.ts` (1 422 lignes) garde les commandes publiques et reste le seul point d'entrée ; l'état, les veilles du GPS et de la ceinture, la réception des positions, le tampon du journal et la reprise après une coupure vivent sous `src/hooks/recorder/`. Un objet session remplace dix-sept variables de module.
    - **Pourquoi** : un fichier unique que personne ne pouvait relire d'un trait, pour la fonction la plus sensible (ne jamais perdre une session).
    - **Piège** : à comportement égal, il faut garder l'ordre des opérations, les réinitialisations et les liaisons vivantes ; preuves : aucun test existant modifié, 185 chaînes littérales identiques, banc d'enregistrement identique. Le faux ami `landOnRecording` du relevé de la terre se répartit sur trois fichiers, total inchangé.

347. Note des Statistiques sans numéro de version (lot 342, validé le 12/11 sur lecture, version 0.00.27).
    - **Décision** : la note dit « Réussite connue seulement des sessions déjà ouvertes dans l'analyse : N sessions à rouvrir », sans citer de version de l'ancienne série.
    - **Pourquoi** : le numéro appartenait à une série de versions abandonnée et n'aurait rien dit à l'acheteur.
    - **Piège** : aucun.

348. Plante du Profil cachée (lot 347, validé le 13/11 sur l'APK 0.00.40, version 0.00.29).
    - **Décision** : un interrupteur unique, `PROFILE_PLANT_VISIBLE` (`core/profilePlant.ts`), à faux : racine, fleur, papillon, bulle et carré à droite du pseudo ne sont plus montés, « Objectif par semaine » disparaît de Réglages, la leçon « Le Profil » est réécrite sans la plante. Rien n'est supprimé : calculs, tests et objectif enregistré restent, la remettre à vrai rend tout.
    - **Pourquoi** : demande de l'utilisateur, la plante ne s'accorde pas à ces sports.
    - **Piège** : le calcul de la racine tourne encore sans être montré ; un test garantit que plus aucune leçon ne la cite.

349. Habillage de la planche A dans les variables du thème (lot 344, validé le 13/11 sur l'APK 0.00.40, version 0.00.30).
    - **Décision** : Inter, fond blanc, encre noire, traits fins, cadres francs sans ombre, pilules ; plus de bleu voile ni de gris surf, ce qui est allumé l'est à l'encre (`--on-ink`) ; le vert vif porte du noir (`--on-record`), le rouge vif ne porte pas de texte, le bandeau d'enregistrement garde le rouge sombre (`--stop`). Mode sombre repeint aux mêmes couleurs.
    - **Pourquoi** : tout passe par les variables pour qu'un habillage ne demande plus de toucher aux écrans.
    - **Piège** : deux défauts de lisibilité à la relecture (onglet de Planifier en sombre, arc de l'appui long à la reprise) ; les titres changent de casse, seul écart du banc.

350. Couleurs d'activité libres (lot 338, validé le 13/11 sur l'APK 0.00.40, version 0.00.31).
    - **Décision** : une palette de douze couleurs commune aux deux familles remplace les nuances par famille ; le blanc cerclé va d'abord à une activité créée. Les activités déjà enregistrées prennent leur nouvelle couleur à la lecture (`withPaletteColors`), sans remise à zéro.
    - **Pourquoi** : une activité n'a plus de couleur de famille ; chacune a la sienne.
    - **Piège** : la nuit, noir et blanc s'échangent à l'affichage seulement ; une pastille blanche ou noire se confond avec le fond, d'où le cerne gris et les icônes passées à l'encre.

351. Logos d'activité et cadre au pinceau (lot 349, validé le 13/11 sur l'APK 0.00.40, version 0.00.32).
    - **Décision** : onze dessins remplacent les neuf icônes, partout ; une ancienne icône enregistrée est reprise à la lecture (planche vers windsurf, kayak vers paddle, paddle-foil vers surf foil). L'angle du cadre vient du logo (rang fois 47 degrés), pas de l'activité. Le logo dans son coup de pinceau ne se voit que sur le Profil, ailleurs le dessin seul à l'encre.
    - **Pourquoi** : les logos sont ceux de la planche validée.
    - **Piège** : la feuille des dessins est chargée à part et montée une seule fois ; dessins allégés de 340 à 107 Ko, au pixel près.

352. La page Sessions (lot 346, validé le 13/11 sur l'APK 0.00.40, version 0.00.33).
    - **Décision** : une seule page `/sessions` remplace l'accueil et les deux bibliothèques ; les adresses `/voile` et `/surf` y mènent, filtre gardé. Une rangée de logos filtre la liste ; Classer, Renommer et Supprimer passent derrière un « … » par ligne (réponse du 13/11), Supprimer gardant sa confirmation. La leçon du jour est en pause par un interrupteur.
    - **Pourquoi** : plus de groupes Voile et Surf à l'écran, les activités visibles suffisent.
    - **Piège** : la barre de suppression revenait après un renommage annulé ; vignettes de 96 sur 72 sur téléphone, écart à la planche accepté.

353. L'application s'ouvre sur le Profil (lot 351, validé le 13/11 sur l'APK 0.00.40, version 0.00.34).
    - **Décision** : l'ouverture et toute adresse inconnue mènent au Profil ; l'ordre des barres vit dans `core/navigation.ts` (testé) ; retour d'Android : analyse, Sessions, Profil, sortie. Le Profil a un en-tête à photo (deux photos de GONG, une seule téléchargée selon l'écran, aucune en mode économe) et, sur ordinateur dès 1000 px, la colonne « Vos activités ».
    - **Pourquoi** : le Profil est la porte d'entrée, Sessions une page comme les autres.
    - **Piège** : accord de GONG à obtenir pour les photos avant diffusion ; la photo du téléphone est une capture de 565 points de large, jugée très légèrement pixelisée, sans gravité, le 13/11.

354. Avatar du Profil vide au départ (lot 350, validé le 13/11 sur l'APK 0.00.40, version 0.00.35).
    - **Décision** : sans choix, la photo ronde est le rond à silhouette, plus le logo du sport préféré ; un choix déjà enregistré est gardé. Le bouton porte un nom accessible selon son état.
    - **Pourquoi** : le logo du sport préféré laissait croire à un choix de l'utilisateur.
    - **Piège** : aucun.

355. Écran de démarrage GONG (lot 311, validé le 13/11 sur l'APK 0.00.40, version 0.00.36).
    - **Décision** : douze images refaites à leur taille exacte, fond noir, logo GONG blanc et « Live for it. » au centre ; la fenêtre de lancement d'Android est noire de jour comme de nuit.
    - **Pourquoi** : aucun éclair blanc avant l'image, aucun rognage en portrait ou en paysage.
    - **Piège** : le thème de l'application ouverte ne doit pas changer ; seule la fenêtre de lancement est noire.

356. Rappel du matériel à l'analyse (lot 345, validé le 13/11 sur l'APK 0.00.40, version 0.00.37).
    - **Décision** : à l'analyse qui suit un enregistrement, « Voulez-vous ajouter le matériel ? » s'ouvre si l'option matériel de l'activité est cochée et la session sans matériel ; « Oui » ouvre l'onglet du matériel. « Non », la croix et le retour comptent une fermeture, deux et elle ne revient plus pour cette activité (compte gardé par « Par défaut »). Rouvrir une ancienne session ne rappelle rien.
    - **Pourquoi** : le matériel se renseigne mieux juste après la séance.
    - **Piège** : le compte rendu de l'enregistreur reste désormais jusqu'à l'analyse dans tous les cas, plus seulement avec un avertissement ; l'analyse l'efface une fois lu.

357. Activité changée, bateau et calcul deviné (lot 314, validé le 13/11 sur l'APK 0.00.43, version 0.00.14).
    - **Décision** : changer l'activité ou le calcul d'une session remet à zéro son foil et son pumping (« Surf foil » → « Surf » compris), qui n'ont plus de sens ailleurs ; un calcul sans seuil d'activité (le bateau) affiche « Temps en mouvement », dans « général » et sur l'image de partage, jamais « Temps en vol » ; à l'ajout d'une activité dans Réglages, le calcul se devine du nom, le sélecteur restant modifiable (« moth », « laser » et « optimist » restent sur le premier calcul de la famille).
    - **Pourquoi** : un bateau affichait un temps en vol qui n'existe pas pour lui, et une fiche gardait le matériel de son ancienne activité.
    - **Piège** : le recalcul suivait déjà le changement d'activité, seule la fiche restait en retard ; une garde de test interdit « Temps en vol » à tout calcul sans seuil.

358. Onze activités de départ séparées (lot 335, validé le 13/11 sur l'APK 0.00.43 remise à zéro, version 0.00.17).
    - **Décision** : onze activités pré-créées au lieu d'une « Voile » unique (voile : Wingfoil, Parawing, Windsurf, Windfoil, Kite, Kitefoil, Bateau ; surf : Surf, Paddle, Surf foil, Pumping), quatre visibles (Wingfoil, Kite, Surf, Pumping), sept cachées que l'œil de Réglages montre ; le foil et le pumping d'office sont des données du pré-réglage de l'activité, et la case Pumping range son écart au défaut. Pas de mise à jour d'une liste d'activités déjà installée (décision du 11/11) : on repart de zéro.
    - **Pourquoi** : demande de l'utilisateur du 11/11 : chaque activité avec sa nuance, son icône et son pré-réglage, toutes sur la feuille de départ dès l'installation.
    - **Piège** : désinstaller ne suffit pas, le dossier mémoire `Documents/Gtracker` survit et son fichier de réglages rend l'ancienne liste à chaque réinstallation ; la remise à zéro de Réglages (lot 343) y répond.

359. La fin d'un enregistrement ouvre l'analyse (lot 313, validé le 13/11 sur l'APK 0.00.40 puis 0.00.43, version 0.00.19 ; mené avec les étapes 1 et 2 du lot 329).
    - **Décision** : à l'arrêt la session se range seule et son analyse s'ouvre, sans écran « Analyser / Jeter » ; l'écran ne reste que comme filet (rangement en échec, session hors mémoire ou à classer, session reprise encore continuable). « Jeter » passe en dernière entrée du menu « … » de toute analyse, tenu une seconde puis confirmé, et sert aussi à supprimer une ancienne session ; les avertissements de l'arrêt s'affichent en tête de l'analyse ; le matériel se choisit dans l'onglet « matos et conditions » (confirmé le 12/11).
    - **Piège** : la relecture a trouvé deux défauts, corrigés : le retour arrière du navigateur après « Jeter » avec un brouillon, et la session rangée restée sans annonce quand on refuse de quitter un brouillon (d'où la carte « Session rangée » dans ce cas).

360. Boutons colorés, exception à la charte (lot 359, essai 238 réussi le 13/11 sur l'APK 0.00.43, version 0.00.41).
    - **Décision** : « tout fermer », à droite de la barre d'onglets des analyses (voile et surf), est en contour et texte rouges, fond inchangé ; sur l'écran d'une session en attente de la page Enregistrer, « Continuer l'enregistrement » est en aplat vert à texte noir, « Analyser » reste à l'encre et « Jeter » en rouge. Aucune variable ajoutée. L'utilisateur garde le rouge de « tout fermer » (« 238 ok »). C'est une exception assumée à la charte, qui réserve le rouge à l'enregistrement et le vert à trois éléments.
    - **Pourquoi** : demande du 13/11 : « il ne se différencie pas assez des autres », et « il faudrait colorier en vert continuer, noir analyser et rouge jeter ».
    - **Piège** : aucun.
361. L'Entraînement retiré de l'application (lot 302, E3 de l'extraction voile et surf ; validé le 13/11, essai 206 sur l'APK 0.00.43 : enregistrement de voile avec la ceinture cardio, « la ceinture fonctionne » ; fait le 08/11, version 0.00.03).
    - **Décision** : partent le fractionné, le compteur d'intervalles, le chrono, le test de FC max, la musculation et la course à bornes : pages, hooks, branches de l'enregistrement, du journal, de la notification et de la coque, côté Android les services du compteur d'intervalles et de la ceinture, les sons `TONE_*` et le manifeste. La famille « fractionne » reste déclarée mais cachée, et ses unions de types sont gardées pour le lot 305 ; le test de FC repos reste sous le Profil. Les vieux journaux et réglages sont relus sans bruit.
    - **Pourquoi** : la version vendue ne garde que la voile et le surf ; le résultat attendu était un enregistrement de voile et de surf inchangé, ce que le banc voile-surf (identique hors la carte Entraînement), la relecture et l'essai 206 ont confirmé.
    - **Piège** : aucun noté.

362. Coupure des données d'une application complète (lot 306, E7 de l'extraction voile et surf ; validé le 13/11, essai 217 sur l'APK 0.00.43 : la ceinture choisie dans Réglages reste la ceinture active après une relance et un enregistrement la retrouve, « la ceinture fonctionne » ; fait le 11/11, versions 0.00.08 et 0.00.09).
    - **Décision** : plus aucune relecture d'anciennes données hors de la porte d'import (`library/legacyImport.ts`) : ni mise à jour des réglages au démarrage, ni ancien `reglages.json`, anciennes notes ou redirections `/course`, `/velo`, `/fractionne` (une adresse inconnue mène à l'accueil). La fiche d'une session ne lit plus rien de la terre (`RECORD_READER_VERSION` à 1, cache des fiches refait une fois) ; les fiches au calcul retiré sont masquées au lieu d'aller dans « À classer », qui ne cite plus que la voile et le surf ; les clés de la terre ne sont plus écrites à `null` dans une fiche de voile. La ceinture cardio n'a plus qu'une clé, l'active marquée dans la liste.
    - **Pourquoi** : l'utilisateur a tranché le 11/11 une coupure complète, la seule version installée (0.00.05) étant jetable : aucune migration à garder ni à écrire.
    - **Piège** : la ceinture a dû être choisie de nouveau une fois. Une fiche déjà rangée par Gtracker doit se relire et se réécrire à l'octet, ce que garde un test neuf, comme le jeu d'essai de la porte d'import.

363. Profil : un seul bouton de période, « 2026 » en petit à droite (lots 358 et 362 ; essai 239 raté puis essai 241 réussi le 13/11 au soir sur l'APK 0.00.49 ; versions 0.00.42 et 0.00.44).
    - **Décision** : les cinq pastilles de période du Profil laissent la place à un seul bouton en pilule qui bascule entre l'année civile en cours et « Tout », l'année au départ ; choix mémorisé, une ancienne période mémorisée (semaine, 30 jours, 6 mois) retombe sur l'année. Après l'essai 239, le bouton affiche « 2026 » seul, en petite pilule calée à droite de sa rangée, sa zone tactile débordant de la pilule ; un lecteur d'écran entend toujours « Année 2026 » ou « Tout ». Les Statistiques gardent leurs cinq périodes.
    - **Pourquoi** : demande du 13/11 : « année en cours ou tout, un bouton, et le choix de base c'est année en cours, avec le numéro de l'année » ; puis, à l'essai 239 : « en plus petit et à droite, juste "2026" ».
    - **Piège** : la première version (« Année 2026 », lot 358) marchait mais n'était pas ce que voulait l'utilisateur. « 2026 » seul ne dit pas que c'est une période, d'où le nom complet gardé pour le lecteur d'écran. La rupture d'écran très étroit des anciennes pastilles, que plus rien ne lisait, a été retirée.
364. Profil : les trois activités favorites et la case « Total » à la place de la bande des trois chiffres (lot 357 ; essai 242 « ok » le 13/11 au soir ; version 0.00.46).
    - **Décision** : un cadre montre les trois activités qui ont le plus de temps sur la période (règle de l'ancien « sport préféré » ; à égalité, le plus de sessions), en ligne du premier au troisième, du plus grand au plus petit, sans effet de podium. Chacune a son logo dans son cadre au pinceau, avec dessous son nom, son nombre de sessions et sa distance dans l'unité de son activité ; à droite, une case « Total » avec la distance de la période. Moins de trois activités : celles qui existent, sans case vide ; aucune : le total et une ligne. Une activité supprimée reste comptée sous le nom de son calcul, comme dans l'anneau. Toucher une activité ne fait rien ; sur ordinateur « Vos activités » ne change pas.
    - **Pourquoi** : demande du 13/11, des activités de tailles différentes selon la place « à la place de "activités" » ; réponses sur croquis : « les 3 activités avec les logos par taille et en dessous : chacune leur nombre de fois et distance », « et on ajoute une case total km ».
    - **Piège** : à 320 px les logos débordaient, trouvé au banc puis corrigé. L'utilisateur a demandé en retour que les logos mènent à Sessions filtrée : lot à part, pas fait ici.
365. Profil : cadres en un coup de pinceau à la couleur de l'activité favorite, gardés (lot 364 ; essai 245 « ok » le 13/11 au soir sur l'APK 0.00.49 ; version 0.00.48).
    - **Décision** : chaque cadre du Profil perd son trait fin et reçoit un seul trait qui en fait presque le tour (le tracé du cadre des logos, étiré en neuf tranches par un masque en bordure), ouvert à un angle qui tourne d'un cadre au suivant dans l'ordre de la page (bas droite, bas gauche, haut gauche, haut droite, puis de nouveau bas droite), épaisseur de la proposition B de la planche. Couleur : celle de l'activité favorite de la période, l'encre sans session ; la nuit éclaircie si elle ne se verrait pas, l'encre ou son inverse si elle se confond avec le fond. Sans prise en charge du masque, le cadre garde son trait fin. Écart gardé à la charte (traits fins, bords francs), dit dans DECISIONS §9 et CLAUDE.md.
    - **Pourquoi** : demande du 13/11 : « les cadres dans Profil sont des petits traits fins. On va essayer de les remplacer par des coups de pinceau à la couleur de l'activité favorite. Ça remplira déjà pas mal cet espace. »
    - **Piège** : la première planche (traits séparés) a été refusée : « le trait doit faire quasiment le tour, genre 4/5, en un seul trait » ; la deuxième, avec un côté non dessiné, a donné « ce serait bien que ce soit un angle qui ne soit pas peint », puis « tous les angles pas les mêmes, genre avec une rotation ». Essai mené d'abord sur planche, puis dans l'application.
366. Analyses : cadres des panneaux en un coup de pinceau fin, gardés (lot 365 ; essai 247 « ok » le 13/11 au soir sur l'APK 0.00.49 ; version 0.00.49).
    - **Décision** : dans les analyses de voile et de surf, chaque panneau reçoit le trait du Profil, par la même pièce, à la moitié de son épaisseur, l'angle ouvert tournant d'un panneau au suivant, à la couleur de l'activité de la session. La carte, la barre d'onglets, l'en-tête et les vues en plein écran ne changent pas ; sans prise en charge du masque, le panneau garde son trait fin.
    - **Pourquoi** : demande du 13/11, en voyant la planche des cadres du Profil : « je pense qu'on va essayer de le faire en plus fin dans les cadres de l'analyse », puis « à la fin le mieux c'est de faire une apk quitte à revenir en arrière ».
    - **Piège** : aucun noté ; essai conçu pour se défaire d'un seul commit, d'où son commit à part.
367. Banc : les mesures de largeur de texte étaient faussées du côté « avant » (lot 348 ; validé sur lecture le 14/11 ; outil seul, sans version).
    - **Décision** : le serveur de développement du banc démarre depuis le dossier des dépendances, la racine servie étant donnée à part, de sorte que les scripts « tailles » et « aides » mesurent les mêmes largeurs des deux côtés.
    - **Pourquoi** : le côté « avant » est servi depuis un dossier temporaire sur un autre lecteur que le dépôt ; sous Windows, le serveur y cherchait les fichiers de la police sur le mauvais lecteur.
    - **Piège** : la police Inter ne se chargeait pas, le texte retombait sur la police de secours, environ 7 % plus étroite : un écart venu du banc, pas de l'application. Ne pas conclure d'une différence de largeur avant/après sans avoir vérifié que la police est chargée des deux côtés.
368. Profil : les logos des activités favorites mènent à Sessions filtrée (lot 366 ; essai 248 puis « 366 ok » le 14/11 sur l'APK 0.00.56 ; version 0.00.50).
    - **Décision** : chaque logo est un lien nommé « Sessions de … » vers la page Sessions, par l'adresse `?activite=` qu'elle lisait déjà. Une activité cachée mène à Sessions sans filtre ; la case « Total » n'est pas un lien ; l'aspect ne change pas.
    - **Pourquoi** : demande de l'utilisateur à l'essai 242 : « il faudrait que les icônes soient un lien vers les sessions avec l'icône cliquée comme sélection » ; le point 364 l'avait laissé à un lot à part.
    - **Piège** : aucun noté.
369. Analyses : sur téléphone droit, la carte va d'un bord à l'autre de l'écran (lot 368 ; « 368 ok » le 14/11 sur l'APK 0.00.56 ; version 0.00.52).
    - **Décision** : la carte sort des marges de la page, sans coins ni traits sur les côtés, boutons et légende en retrait des bords. Téléphone tourné et ordinateur inchangés.
    - **Pourquoi** : demande de l'utilisateur en voyant les captures du fond de page : « on peut faire que la carte prenne toute la largeur de l'écran ? 100 % ».
    - **Piège** : aucun noté ; le banc a montré les analyses « general » et « surf » identiques avant et après, hors la carte.
370. Profil : le poisson dans son bocal et la fenêtre de choix du poisson (lot 370 ; essai 249 « ok » le 14/11 sur l'APK 0.00.56, avec « on continue à travailler sur d'autres idées », précisé le même jour : « le poisson me va pas vraiment donc je continue à chercher des idées », la racine restant cachée ; versions 0.00.55 et 0.00.56).
    - **Décision** : un bocal sur le Profil, à droite de « Test de FC repos », petit pour l'alevin, plus gros au dernier stade ; toucher le bocal ouvre une fenêtre « Poisson » : douze choix (quatre styles, trois voies, au niveau montré), appliqués tout de suite et gardés avec le profil, la frise des niveaux débloqués dessous. Le niveau (1 à 6) monte avec les semaines tenues sur l'objectif, paliers à 2, 5, 9, 14 et 20 semaines, sans recul ; la voie est choisie par l'utilisateur ; la racine reste cachée. Ces quatre choix ont été tranchés par Claude à titre provisoire et n'ont pas reçu de réponse point par point : ils restent tels que codés, comme le réglage d'essai du niveau de Réglages › Pratiquant. Le bouton de période repasse sous la photo, ce qui défait le lot 369 (bouton remonté à côté du lien, version 0.00.53), jamais validé pour lui-même.
    - **Pourquoi** : demande du 13/11 : le bocal à la place du bouton « 2026 », puis « changer le poisson quand on clique dessus, on a les options qui s'ouvrent, dans un pop-up, les différents poissons, les différents stades […] qu'on a débloqués ».
    - **Piège** : les 64 dessins (quatre styles, l'alevin puis trois voies sur cinq niveaux) sont chargés à la demande, hors du paquet principal. Zone de toucher du bocal d'au moins 44 points ; la fenêtre se ferme par le bouton, Échap et le retour d'Android.
