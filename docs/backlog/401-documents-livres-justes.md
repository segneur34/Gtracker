# 401 · Les documents livrés disent vrai

Modèle | Réflexion : Sonnet | high

## Origine

Revue globale du 15/11 (auditeurs « documents » et « maintenabilité » ; le point 1 relu par l'orchestrateur). À faire après les lots 396 à 400, dont il décrit le résultat. Documentation seule. Recouvre le second temps de l'élément 331 : le dire dans le rapport pour que l'orchestrateur accorde sa ligne.

## 1. README : ce qui sort de l'appareil (relu par Opus avant commit)

`README.md`, « Services appelés » : il cite BRouter et l'IGN (`data.geopf.fr`), qu'aucune ligne de `src/` n'appelle plus, et affirme « Ouvrir un GPX, l'analyser, enregistrer et lire les Statistiques n'appellent rien d'autre que les tuiles de la carte ». Or `src/hooks/sessionLibrary/placeQueue.ts` et `src/planning/geocoding.ts` (`PHOTON_REVERSE_URL`) envoient à Photon le départ et l'arrivée de chaque session, arrondis à trois décimales (une centaine de mètres), pour la nommer par son lieu ; c'est allumé d'office (`src/hooks/usePlaceSearch.ts`) et se coupe dans Réglages › Mémoire. L'écran À propos le dit déjà juste (`src/components/AboutSettings.tsx:122`) : le README dit la même chose. Une adresse de tuiles personnalisée est aussi permise (`SettingsPage.tsx`, vers 1171). Refaire la table à partir du code (Grep sur `fetch(` et les adresses), pas de mémoire.

Décision (orchestrateur, à défaut de réponse de l'utilisateur) : la recherche du lieu reste allumée d'office ; le README et, à la livraison (308), la politique de confidentialité le disent en clair.

Même fichier : « Deux familles d'activités, chacune avec sa bibliothèque […] Voile […] Surf » : une seule page Sessions, familles montrées « Avec vent » et « Sans vent » ; la ligne « Planifier propose des types de voie » part.

## 2. Phrases démenties par le code (vérifier chacune avant de corriger)

- ETAT §11 : « Appréciations en emoji » (`library/notes.ts:86` : sans emoji) ; « Couleurs des familles : rouge, orange, vert » (plus de couleur de famille) ; fluidité : « lecture par `DOMParser` 40 à 55 % », « 10 à 18 s », « le reste est le dessin », « le démarrage compilé est sain » : à réécrire d'après les mesures du lot 400, sans affirmer ce qui n'a pas été mesuré au téléphone.
- ETAT §12 : « carte Autorisations de la page Sessions » (elle est sur le Profil et dans Réglages) ; « `accept=".gpx"` grise les GPX sous Android » (`ImportButtons.tsx:40`) ; « Repli si des points se perdent : Capawesome, payant » (le greffon installé garde un journal natif des positions, `locationLog`).
- ETAT §8 : `screen` rangé parmi les modules non testés (`platform/screen.test.ts` existe) ; §3 : « treize parties » de `hooks/sessionLibrary/` (compter) ; §9 contre §12 sur `npm audit` (0 alerte le 15/11) ; §6.1 renvoie à une section de CLAUDE.md qui n'existe plus ; §1 : « ci-dessus » sans rien au-dessus, puces collées.
- INSTALLATION §4.3 : « touchez Analyser » (l'arrêt ouvre seul l'analyse) ; « l'accueil propose Choisir le dossier » (c'est le Profil) ; puce collée.
- MISE_EN_PAGE (« l'accueil passe sur deux colonnes »), GLOSSAIRE (`sportFamily` : « bibliothèque, accueil ») : il n'y a plus d'accueil.
- DEVELOPPER : « l'architecture est dans `CLAUDE.md` », qui ne part pas chez l'acheteur : renvoyer aux documents livrés.
- Commentaires de code qui trompent, à corriger dans ce lot (commentaires seuls) : `src/hooks/sessionAsset.ts:7-8` (revêtement, IGN) ; `src/pages/SurfModule.tsx:194` (compilateur React, qui n'est pas installé).

## 3. Sections d'ETAT touchées par le paquet de la revue

Enregistrement (journal mis de côté repris, abonnés protégés), brouillon gardé sur l'appareil, plante retirée, trace en 64 nuances, calcul en arrière-plan élargi : la passe `doc` de chaque lot validé les écrit ; ce lot ne fait que contrôler qu'elles ne se contredisent pas.

## Hors du lot (avec la livraison, 308)

Les quelque 465 renvois « point N » antérieurs au point 323 dans ETAT, INVENTAIRE, DECISIONS et MISE_EN_PAGE (historique hors dépôt, que `outils/docs-cites.mjs` exempte), l'architecture en une page, le format du dossier mémoire, la notice de traduction, la liste des greffons natifs.

## Vérification

`npm run verif` (ligne « documents »). Rapport : chaque phrase corrigée, avec le fichier de code qui la fonde ; celles qui se sont révélées justes.
