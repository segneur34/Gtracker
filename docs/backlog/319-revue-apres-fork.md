# 319 · Revue d'après fork du 11/11/2026 : restes de la terre, coupure d'avec l'ancien projet, pertinence du code

Revue demandée par l'utilisateur le 11/11/2026, faite dans la nuit par une conversation Fable 5.2 et vingt-cinq agents (Haiku pour le balayage, Sonnet pour l'analyse des huit zones du code, des documents et du banc, Opus pour quatre sujets d'architecte et la relecture en retard du lot 305, deux contre-vérificateurs Sonnet). **Rien n'a été modifié dans le code** : ce fichier ne contient que des propositions. Il est le brief d'exécution des lots 320 à 331 et des compléments aux lots 304, 306, 308, 314, 315 et 318 : il tient seul, sans la conversation.

## Comment lire ce fichier

- Une section par lot, titrée `## Lot N · …` : la chercher par Grep, puis lire par `offset` (le sommaire donne la ligne de début). Ne pas lire le fichier en entier.
- Chaque section donne le but, la taille, le modèle et l'effort, les dépendances, la liste exacte des `chemin:ligne`, les pièges, la vérification et les questions liées.
- Les numéros de ligne sont ceux du commit `ddc7b57` (HEAD du 11/11). Les revérifier avant d'éditer : chaque lot exécuté déplace ceux des suivants.
- Annexes : les rapports bruts des agents sont dans `D:\gong tracker\atelier\revue-1111\` (inventaires par zone, rapports d'architecte, contre-vérifications, corrections des documents ligne à ligne, relevé mécanique `knip.txt`). **Ce fichier prime sur les annexes** : il intègre la contre-vérification, qui a écarté 13 suppressions fausses et précisé une quarantaine d'autres.

## Décisions de l'utilisateur qui cadrent la revue (11/11)

1. Tout ce qui est lié « à pied », « à vélo » et aux entraînements part définitivement.
2. Coupure complète des anciennes données de Tracker, avec une seule porte gardée : pouvoir charger des sessions venues de Tracker. Hypothèse retenue en attendant sa confirmation : la porte passe par des fichiers (un GPX, un paquet de session, un dossier de sessions), pas par l'ouverture du dossier mémoire de Tracker.
3. Une fois les recommandations appliquées, plus aucun lien entre ce projet et l'ancien (chemins du poste, dépôt, mémoires, règles, documents, noms).

## Verdict

- **Santé** : typecheck et lint verts, 214 fichiers de tests et 3 233 tests passent (11/11, commit `ddc7b57`).
- **Le retrait des lots 301 à 305 est propre là où il compte.** `src/sailing/` et `src/surfing/` ne portent aucun reste ; Android n'a plus ni service ni permission de la terre ; aucun composant entier ni fichier statique de la terre ne traîne. La relecture du lot 305, jamais faite, l'a été par Opus : **validable tel quel**, cinq défauts faibles, tous repris au lot 325.
- **Ce qui reste, par ordre de poids** :
  1. un étage entier de compatibilité avec les données de Tracker (migrations et versions des réglages, lecteurs de fiche, champs gardés bruts, redirections d'adresses), que la décision 2 permet de retirer (lots 320, 321, 306) ;
  2. le nom de l'ancien projet : environ 1 100 traces dans le dépôt, dont 28 clés de stockage `tracker.*`, les caches, les formats de fichier, `creator="Tracker"` dans chaque GPX exporté, l'agent utilisateur envoyé aux serveurs de cartes, des libellés visibles, le paquet Java, et une clé de signature partagée avec Tracker (lots 322 à 324) ;
  3. du code mort de la terre et de l'Entraînement hors compatibilité : le dénivelé du suivi, l'altitude calculée pour rien, l'allure en min/km, la « course à bornes » de l'alerte cardiaque, des champs de fiche sans lecteur, le temps estimé d'un parcours, des textes visibles (lot 325) ;
  4. deux notions devenues identiques, la famille et le traitement (lot 326) ;
  5. un banc dont le passage courant est cassé et dont le port par défaut est celui de l'ancien Tracker (lot 330) ;
  6. des documents qui décrivent encore l'ancienne application, alors que leurs deux contrôleurs automatiques sont verts (lots 318 et 331).
- **Bogue 314, cause trouvée** : le foil et le pumping restent dans la fiche quand on change l'activité d'une session (`src/library/record.ts:1188-1207`). Voir le lot 314 + 315.
- **Fenêtre à ne pas manquer** : la seule APK de Gtracker installée est la 0.00.05, version d'essai jetable (corrigé le 11/11 : la revue la croyait non installée). Tout renommage (clés, formats, identifiant, clé de signature) est gratuit aujourd'hui ; après l'installation d'une version que l'on garde, chacun devient une migration.
- **Contre-vérification** : 184 suppressions contrôlées une à une, 130 confirmées, 41 nuancées, 13 infirmées (section « Suppressions écartées par la contre-vérification »).

## Ordre conseillé

| Rang | Lot | Quoi | Taille | Modèle/effort | Dépend de |
|---|---|---|---|---|---|
| 0 | 319 | Réponses de l'utilisateur aux questions ci-dessous | petit | - | - |
| 1 | 314 + 315 | Foil gardé au changement d'activité ; « Bateau » activité de départ | petit | Sonnet/high | session de bateau de l'utilisateur |
| 2 | 330, première étape | Banc : passage courant réparé, port 5174, constantes communes | petit | Sonnet/medium | - |
| 3 | 320 | Jeu d'essai figé de la porte d'import | petit | Sonnet/high | - |
| 4 | 321 | Porte d'import bornée, formats de session neufs | gros | Opus/high | 320 |
| 5 | 306 (réécrit) | Coupure des relectures d'anciennes données | gros | Opus/high | 321 |
| 6 | 322 | Renommage « tracker » → « gtracker » et garde | gros | Sonnet/high | 306, 330 première étape |
| 7 | 323 | Identité Android et clé de signature neuve | petit | Sonnet/high | 322 |
| 8 | 325 | Restes morts de la terre, en sous-lots | gros | Sonnet/high | sous-lots libres, sauf mention dans la section |
| 9 | 304 | Planificateur routier, avec les compléments de cette fiche | gros | Opus/high | 325 (temps estimé) |
| 10 | 326 | Familles aplaties | gros | Opus/high | 304, 306 |
| 11 | 328 | Voile : une seule voie de calcul, seuils sans défaut caché | gros | Opus/high | - |
| 12 | 329 | Enregistrement : « Jeter » sans message d'échec (avec le 313) | petit | Opus/high | 313 |
| 13 | 327 | Gardes d'architecture | petit | Sonnet/medium | 322, 325 |
| 14 | 330, suite | Banc : scripts réécrits sur la voile et le surf | gros | Sonnet/medium | 322 |
| 15 | 318, 331, 324 | Atelier, documents, coupure hors du code | gros | Sonnet/medium | lots de code faits pour la seconde moitié |
| 16 | 307, 308 | Renvois d'atelier dans `src/`, livraison | gros | voir BACKLOG | tout ce qui précède |

Les rangs 3 à 7 se font **avant toute APK que l'on garde** (voir la première question). Le lot 325 peut s'intercaler à tout moment, par sous-lots, sauf ceux qui touchent les mêmes fichiers que le 306 (`library/record.ts`, `settings/activitySettings.ts`), à faire après lui.

## Questions pour l'utilisateur

Chacune a sa réponse par défaut ; les sections de lot donnent le détail. Seule la première est aussi dans `docs/BACKLOG.md` (Q105), la limite y étant de cinq questions.

1. **Installer la 0.00.05 ?** Comme l'identifiant de l'application changera (lot 323), la 0.00.06 sera une application neuve. La 0.00.05 peut donc servir de version d'essai jetable pour valider les lots 301 à 305, à condition de la désinstaller et de supprimer son dossier `Documents/Gtracker` avant la 0.00.06 : rien de ce qu'elle enregistre ne sera repris. *Par défaut : version d'essai jetable.* L'autre choix : ne rien installer avant la fin des lots 320 à 323. **Réponse (11/11) : version d'essai jetable.** Elle était en fait déjà sur le téléphone depuis le 08/11 à 22 h 06 (relevé adb du 11/11), et l'utilisateur y a fait ses essais le 11/11.
2. **La porte d'import passe-t-elle par des fichiers seulement** (un GPX, un paquet de session, ou « Ajouter les sessions d'un dossier »), sans jamais ouvrir le dossier de Tracker comme mémoire ? *Par défaut : oui.*
3. **Une session de course, de vélo ou d'entraînement qui se présente à l'import** : refusée avec un message, ou rangée « à classer » ? *Par défaut : refusée.*
4. **Reprend-on les mesures des capteurs (sauts, pumping) d'une session de Tracker ?** *Par défaut : oui*, sans quoi une session de wing importée perd ses sauts.
5. **Les itinéraires et les réglages de Tracker ne sont plus repris ?** *Par défaut : on coupe.*
6. **Nom technique** : préfixe `gtracker` pour les clés et les formats, figé dès la première installation gardée ; et quel identifiant d'application, sachant que `io.github.segneur.…` porte encore l'identité du vendeur ? *Par défaut : `gtracker` ; identifiant `io.github.segneur.gtracker` jusqu'à la livraison, à changer maintenant si GONG a déjà le sien.*
7. **Une clé de signature neuve avant la première installation gardée ?** *Par défaut : oui.*
8. **Le dénivelé (D+) retiré sur l'eau** (tuile du Profil, Statistiques, bibliothèque) : l'altitude du GPS en mer est du bruit. *Par défaut : retiré.*
9. **Bogue 314** : votre activité « Bateau » est-elle bien posée sur le calcul bateau (Réglages) ? Et le foil d'une session doit-il suivre la nouvelle activité quand on en change ? *Par défaut : oui, il suit.* À noter : hors foil, le libellé du code est « Temps actif », pas « Temps en mouvement ».
10. **`docs/HISTORIQUE.md`** : un journal neuf de Gtracker qui garde les numéros d'origine (le code y renvoie), l'ancien sortant du dépôt ? Et le journal est-il livré à l'acheteur ? *Par défaut : journal neuf, non livré.*
11. **Les archives `D:\gong tracker\atelier\`** (audits et revues faits sur Tracker) : les sortir de ce dossier sans les supprimer ? *Par défaut : oui.*
12. **Les mémoires de Claude des deux dossiers de Gtracker** : les réécrire sans Tracker ? Et le refus d'écrire dans le dossier de Tracker, aujourd'hui dans `.claude/settings.json` du dépôt, passe-t-il dans vos réglages personnels ? *Par défaut : oui aux deux.*
13. **Deux familles gardées (voile, surf), le traitement fondu dans la famille** (lot 326) ? *Par défaut : oui.* GONG attend-il un sport qui ne serait pas une simple activité (downwind, SUP) ? *Par défaut : aucun pour l'instant.*
14. **L'import d'un fichier FIT (montres) est-il gardé ?** *Par défaut : oui.*
15. **Planificateur (lot 304)** : la recherche d'adresse (Photon) reste-t-elle ? Les conditions d'usage des fonds de carte OSM et Esri sont à faire valider avant la vente (fiche 152).
16. **Q102 du BACKLOG** change de sens : la décision 3 impose d'inclure `docs/DECISIONS.md` dès maintenant dans la remise à jour des documents. *Par défaut : inclus.*

### Réponses de l'utilisateur (11/11/2026)

**« Défaut partout », sauf trois points.** Les défauts des questions 2 à 12, 14 et 16 sont donc des décisions : porte par fichiers seulement ; session de course, de vélo ou d'entraînement refusée avec un message ; mesures des capteurs reprises ; itinéraires et réglages de Tracker coupés ; préfixe `gtracker` et identifiant `io.github.segneur.gtracker` jusqu'à la livraison ; clé de signature neuve ; dénivelé retiré sur l'eau ; le foil suit la nouvelle activité ; journal d'historique neuf, non livré ; archives d'`atelier\` sorties sans être supprimées ; mémoires de Claude réécrites et refus d'écriture passé dans les réglages personnels ; import FIT gardé ; `docs/DECISIONS.md` inclus dès maintenant (Q102). Q103 : `/clore` n'envoie plus, `/clore avec envoi` pour envoyer. Q104 : orchestrateur à `medium`, `high` s'il reste une question ou un lot du noyau.

- **Question 1** : version d'essai jetable (voir plus haut).
- **Q101 du BACKLOG (lot 316)** : le GPX **et** l'image se partagent tous les deux, ce sont deux partages distincts. « Partager la trace » envoie le GPX ; le partage en image existant reste.
- **Question 13, réponse qui change le lot 326** : l'utilisateur veut « décompacter » les deux groupes pour avoir directement sur l'accueil les activités (wing, kite, paddle, pumping, surf…), avec toujours la possibilité de les cacher et d'en créer. C'est une idée de produit neuve, rangée en **332** (maquette d'abord, questions à lui poser : bibliothèque, barre, Réglages, calcul de « paddle » et de « pumping »). **Le lot 326 ne part pas avant que le 332 soit décidé** : la famille reste peut-être le rangement interne du calcul, mais plus celui de l'accueil.
- **Question 15** (recherche de lieu dans Planifier) : pas comprise, réexpliquée le 11/11 ; à reposer avant le lot 304. Défaut de la section du 304 en attendant : on la garde, avec une phrase dans la politique de confidentialité.
- **Question 9, première moitié** (l'activité « Bateau » est-elle sur le calcul bateau ?) : réponse lue dans les fichiers du téléphone le 11/11 (copie hors dépôt : `D:\gong tracker\atelier\session-bateau-1111\`). La session en cause est « Régate j24 » du 08/11 (`sessions\2026-11-08_11-28-30_wingfoil.json`) : `sport: "wingfoil"`, `activityId: "wingfoil"` (l'activité de départ « Voile »), `analysis.foil: true`. Il n'y a **aucune activité « Bateau »** sur ce téléphone (`reglages\telephone.json` ne porte que le profil) : la régate a été enregistrée sous « Voile », qui repose sur le calcul wingfoil, d'où « Temps en vol ». Le lot 315 (« Bateau » activité de départ) est donc le vrai remède ; le 314 (le foil suit l'activité quand on en change) reste nécessaire pour que cette session, une fois passée en « Bateau », perde son foil.

## Ce que la revue n'a pas fait

- Ni banc, ni build, ni essai au téléphone : tout vient de la lecture du code et des tests.
- Les agents de zone ont travaillé par recherche de mots puis lecture autour ; ils n'ont pas lu chaque fichier en entier (hooks : les fichiers cités seulement). Les tailles « ≈ N lignes » sont des estimations.
- Les contre-vérificateurs ont contrôlé les suppressions et les « toujours vrai », pas les constats qui ne touchent que des commentaires. Les défauts ont été instruits par un architecte Opus (lot par lot : confirmés, latents, infirmés).
- `docs/HISTORIQUE.md` a été classé par mots-clés, pas relu point par point.
- Le fichier de plan de la nuit a été écrit dans `~/.claude/plans/tu-es-chef-programmeur-recursive-sparrow.md`, sur l'accord de l'utilisateur ; c'est le seul fichier posé là, il peut être supprimé.

## Sommaire

- ligne 126 · **Partie A · La coupure d'avec l'ancien projet (lots 320, 321, 306 réécrit, 322, 323, 324)**
- ligne 139 · Lot 320 · Jeu d'essai figé de la porte d'import
- ligne 187 · Lot 321 · Porte d'import bornée, formats de session neufs
- ligne 293 · Lot 306 (réécrit) · Coupure des relectures d'anciennes données
- ligne 459 · Lot 322 · Renommage sec « tracker » → « gtracker », libellés visibles, banc, garde permanente
- ligne 626 · Lot 323 · Identité Android et clé de signature
- ligne 682 · Lot 324 · Coupure hors du code
- ligne 754 · Liste de contrôle : plus aucun lien avec l'ancien projet
- ligne 793 · **Partie B · Le code (lots 314 + 315, 325 à 329, suppressions écartées, bon à savoir)**
- ligne 797 · Lot 314 + 315 · Foil gardé au changement d'activité ; « Bateau » activité de départ
- ligne 860 · Lot 325 · Restes morts de la terre et de l'Entraînement, hors coupure
- ligne 896 · 325a · Dénivelé de la trace suivie (Enregistrer) (sous-lot)
- ligne 927 · 325b · Altitude calculée pour rien ; D+ sur l'eau (sous condition) (sous-lot)
- ligne 968 · 325c · Allure en min/km et profil de marche gelé des tests (sous-lot)
- ligne 1004 · 325d · « Course à bornes » de l'alerte cardiaque (sous-lot)
- ligne 1033 · 325e · Champs sans lecteur (types, profils, points de trace) (sous-lot)
- ligne 1060 · 325f · Temps estimé des itinéraires, Overpass et `wayMatch` (morts dès aujourd'hui) (sous-lot)
- ligne 1086 · 325g · Textes visibles et commentaires qui racontent la terre (sous-lot)
- ligne 1164 · 325h · Fonctions, exports, props, CSS, icônes, constantes et ressources Android sans utilisateur (sous-lot)
- ligne 1243 · 325i · Tests et jeux d'essai qui ne couvrent plus que la terre (sous-lot)
- ligne 1270 · 325j · Noms hérités de la terre (sous-lot)
- ligne 1304 · Lot 326 · Aplatissement prudent des familles
- ligne 1417 · Lot 327 · Gardes d'architecture
- ligne 1549 · Lot 328 · Voile : une seule voie de calcul, seuils sans défaut caché
- ligne 1625 · Lot 329 · Enregistrement : « Jeter » qui échoue sans message, message faux, découpage de `useRecorder`
- ligne 1676 · Suppressions écartées par la contre-vérification
- ligne 1698 · Bon à savoir, pas maintenant
- ligne 1733 · **Partie C · Planificateur, banc, documents, atelier (lots 304, 330, 331, 318, corrections du reste à faire, 308)**
- ligne 1737 · Lot 304 (compléments) · Planificateur routier : ce que la liste oublie
- ligne 1875 · Lot 330 · Banc remis sur la voile et le surf
- ligne 2066 · Lot 331 · Documents remis à jour
- ligne 2220 · Lot 318 (compléments) · Atelier : ce que la fiche 318 a manqué
- ligne 2264 · Corrections proposées au reste à faire (`docs/BACKLOG.md` et fiches de `docs/backlog/`)
- ligne 2314 · Lot 308 (recentré) · Livraison : ce qui lui reste


---

# Partie A · La coupure d'avec l'ancien projet (lots 320, 321, 306 réécrit, 322, 323, 324)

Cette partie suit l'ordre d'exécution : **320 → 321 → 306 → 322 → 323**, puis **324** (hors du code, en partie à la main).

Sources, par ordre d'autorité : `D:\gong tracker\atelier\revue-1111\O2-coupure-donnees.md` (architecte : table de renommage §2.2, blocs B1 à B15 §3, lots 1 à 5 §5 ; ses lots 1, 2, 3, 4, 5 sont ici 320, 321, 306, 322, 323) ; `D4-atelier-coupure.md` (liste de contrôle de 98 lignes, §4 et §5) ; constats [L], [B], [P] des huit rapports `zone*.md` ; `H2-liens-ancien-projet.md` ; `V1-verification-zones-1-3-6.md`, `V2-verification-zones-2-4-5-7-8.md` ; `D3-outils-banc.md` ; `O3-relecture-305.md`. Toutes les lignes ont été relues sur HEAD `ddc7b57` le 11/11 ; quand un rapport donnait une ligne fausse, la ligne juste est écrite ici et l'écart est dit.

Trois faits commandent toute la partie :
1. **Aucune APK Gtracker n'est installée** (`docs/BACKLOG.md:15`). Tout nom rangé (clé, cache, format, marqueur, identifiant, clé de signature) se change aujourd'hui sans migration ; après la première installation, chaque renommage coûte une migration, que la décision 2 refuse. Les lots 321, 306, 322 et 323 passent donc **avant la première APK** ; la 0.00.05 (ancien identifiant, anciens formats) ne peut servir que de version d'essai jetable, désinstallée avec son dossier `Documents/Gtracker` avant la 0.00.06 (question 1 de l'en-tête).
2. **Une seule porte reste ouverte** (variante V1 d'O2) : charger une session de voile ou de surf venue de Tracker **par des fichiers** (GPX, GPX complet dit « paquet de session », fiche `.json` et capteurs `.imu` posés à côté, un par un ou par dossier). Gtracker n'ouvre plus le dossier mémoire de Tracker comme sa propre mémoire.
3. **Les anciens noms ne s'écrivent plus qu'en trois fichiers** : `src/library/legacyImport.ts`, `src/library/legacyImport.test.ts`, `src/test/legacyImport.fixture.ts`. Tout le reste du dépôt finit sans « tracker » ni « Tracker » (hors `Gtracker`/`gtracker`).

---

## Lot 320 · Jeu d'essai figé de la porte d'import

**But.** Figer, en octets, ce que Tracker 1.0.0 écrit pour une session de voile et une session de surf (GPX, fiche, capteurs, paquet), et prouver sur le code d'aujourd'hui que la porte d'import les lit entièrement. C'est fini quand `npx vitest run src/library/legacyImport.test.ts` est vert sur HEAD sans qu'aucun fichier de `src/` hors des deux nouveaux n'ait changé.
**Taille** petit (≈ 250 lignes, surtout produites par le code d'origine) · **Modèle** Sonnet / high (la vérification compte : un jeu d'essai faux ferait passer une porte cassée) · **Risque** faible (deux fichiers neufs, aucun code de production touché).
**Avant** : aucun · **Après** : 321, 306, 322 (le test reste vert à chaque lot, il les garde) · **Avant la première APK** : oui.

### À faire

**Ce que contient le jeu d'essai** (`src/test/legacyImport.fixture.ts`, neuf) :
- `TRACKER_WING_GPX` : GPX d'une session de wingfoil écrit par l'enregistreur d'origine (`recording/gpxWriter.ts` `buildGpx` → `core/xml.ts`, `creator="Tracker"`, `<type>wingfoil</type>`), trace tirée de `src/test/sailing.fixture.ts` d'origine.
- `TRACKER_SURF_GPX` : idem en surf (`<type>surf</type>`), trace tirée de `src/test/surf.fixture.ts` d'origine (`SURF_TWO_WAVES` ou `SURF_FOIL_FLIGHTS`).
- `TRACKER_WING_RECORD`, `TRACKER_SURF_RECORD` : fiches `.json` écrites par `serializeRecord` d'origine après `summarizeGpx` d'origine : `format: 'tracker-session'`, `version: 1`, résumé `calcVersion` 18 avec `optionsKey` et `activitySettings`, nom, notes, deux repères (`marks`), `analysis` complète avec ses 11 champs (dont `bikeWeightKg: null`, `loadKg: null`, `effortThresholdMs: null`), vent, foil, seuil de vague en surf, sauts (`jumps`) en voile.
- `TRACKER_WING_IMU` (base64) : `.imu` produit par `encodeImu` d'origine, deux secondes de mesures, en-tête dans l'ordre des champs du Java (`android/app/src/test/java/io/github/segneur/tracker/ImuReference.java:28-31` d'origine : `format: 'tracker-capteurs'`, `setup.cadence: false`, comme `MotionPlugin.java:376-392` de `2eed9e7` l'écrit).
- `TRACKER_WING_BUNDLE`, `TRACKER_SURF_BUNDLE` : paquets produits par `bundleSessionGpx` d'origine (bloc `<tracker:session xmlns:tracker="https://github.com/segneur34/Tracker/session" version="1">` avec `<tracker:record>`, `<tracker:imu>`, `<tracker:edit>`).
- Une ligne d'en-tête : « Produit par le code du commit 2eed9e7 (copie de Tracker 1.0.0), ne pas retoucher à la main. » suivie des commandes qui l'ont produit.

**Comment le produire** (jamais à la main, jamais en lisant `C:\Users\segne\tracker`) :
1. Extraire le code d'origine **de ce dépôt-ci**, hors du dépôt, sans commande git qui modifie :
   `git archive 2eed9e7 src android/app/src/test package.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json | tar -x -C "%TEMP%\origine-2eed9e7"`
2. Donner à l'extrait les dépendances du dépôt sans `npm install` : jonction `mklink /J "%TEMP%\origine-2eed9e7\node_modules" "D:\gong tracker\Gtracker\node_modules"` (les dépendances n'ont perdu que `@fontsource/shrikhand` depuis `2eed9e7`, `git diff 2eed9e7 HEAD -- package.json`, sans usage ici).
3. Écrire **dans l'extrait** (pas dans le dépôt) un test `vitest` générateur qui appelle les fonctions d'origine ci-dessus et écrit les octets obtenus dans un fichier JSON de `%TEMP%` ; le lancer depuis l'extrait : `npx vitest run src/produire-jeu.test.ts`.
4. Recopier ces octets en littéraux (`.imu` en base64) dans `src/test/legacyImport.fixture.ts`. Ne rien reformater (fins de ligne, indentation) : l'aller-retour du paquet est comparé à l'octet.

**Le test** (`src/library/legacyImport.test.ts`, neuf), cas écrits dès ce lot, sur le code actuel :
- (a) paquet voile et paquet surf : `unbundleSessionGpx` rend le GPX d'origine à l'octet, la fiche (sport, nom, notes, repères, vent, foil, seuil de vague) et les capteurs ;
- (b) les trois formes passées par `importEntries` (`hooks/sessionLibrary/importer.ts:132`) sur le faux dossier `src/test/memoryFolder.fixture.ts` : paquet seul (entrées E1, E4 d'O2), GPX + `.json` + `.imu` côte à côte (E2, E3), GPX seul (`<type>` reconnu) ; chaque fois : session ajoutée au bon calcul, nom, notes, repères et sauts présents, résumé non refait (`calcVersion` 18), corps des mesures du `.imu` rangé identique octet pour octet.
- Écrire les attendus de format avec les constantes (`RECORD_FORMAT`, `IMU_FORMAT`) et non avec les chaînes : le même test doit rester vert après le lot 321, où ces constantes changent.

### Pièges

- `2eed9e7` est la copie de Tracker 1.0.0 (commit `deee974` de Tracker) déjà retouchée au fork : dossier mémoire `Gtracker` (`memoryFolder.ts:182`), identifiant `.voile`. Les **formats de session** y sont ceux de Tracker 1.0.0, vérifiés : `RECORD_FORMAT = 'tracker-session'` (`record.ts:51` d'origine), espace de noms du paquet (`sessionBundle.ts:20`), `SUMMARY_CALC_VERSION = 18` (`record.ts:117`), `IMU_FORMAT = 'tracker-capteurs'` (`imuFile.ts:37`), `setup.put("cadence", …)` (`MotionPlugin.java:392`). Le jeu fige donc « Tracker 1.0.0 au 08/11 » ; Tracker continue sa vie et peut écrire autrement plus tard (voir lot 321, Pièges, fiche « plus récente »).
- Le jeu d'essai contient forcément `creator="Tracker"`, `tracker-session`, `tracker-capteurs` et l'adresse `segneur34/Tracker` : c'est l'un des trois fichiers d'exception de la garde du lot 322. Ne pas « nettoyer » ces chaînes.
- `OLD_BUNDLE` (`sessionBundle.test.ts:103-105`) n'a ni capteurs ni retouches et la fiche « de septembre » (`compat.fiche.test.ts:83-101`) est partielle : ils ne remplacent pas ce jeu (aucun jeu complet n'existe à `2eed9e7`, `git ls-tree 2eed9e7 src/test`). Ils déménageront dans `legacyImport.test.ts` au lot 321.
- Le cas « fiche écrite sans `bikeWeightKg`, `loadKg`, `effortThresholdMs` » d'O2 (§4 b) n'est vrai qu'**après le lot 306** (B11) : jusque-là `readAnalysis` réécrit ces trois champs à `null` (`ANALYSIS_FIELDS`, `record.ts:593`, `:597-598`). Ne pas l'écrire ici ; il s'ajoute au lot 306.
- Rien dans le dépôt ne doit garder le générateur ni l'extrait : ils restent dans `%TEMP%`.

### Vérification

- `npx vitest run src/library/legacyImport.test.ts src/library/summaryFrozen.test.ts` vert sur HEAD ; `summaryFrozen` inchangé à l'octet.
- `npm run verif` vert.
- `git status` : seuls `src/test/legacyImport.fixture.ts` et `src/library/legacyImport.test.ts` apparaissent.

### Questions liées

- **Comment reprendre une session de Tracker ?** (O2 Q1) · Par défaut : par des fichiers seulement (un GPX ou un GPX complet, un par un ou un dossier entier par « Ajouter les sessions d'un dossier ») ; Gtracker n'ouvre plus le dossier de Tracker comme sa mémoire · Change : tout le code qui relit les réglages, les versions et les fiches de Tracker hors de cette porte part (lots 321 et 306).

---

## Lot 321 · Porte d'import bornée, formats de session neufs

**But.** La fiche, le paquet et les capteurs s'écrivent sous des noms neufs (`gtracker-session`, `urn:gtracker:session`, `gtracker-capteurs`) ; l'ancien nom n'est plus lu qu'en trois points de la porte, depuis un seul fichier `src/library/legacyImport.ts`, et la porte refuse une session de course, de vélo ou d'entraînement ainsi que le dossier de Tracker choisi comme mémoire. C'est fini quand `legacyImport.test.ts` (a) à (d) est vert et que `rg "tracker-session|tracker-capteurs|Tracker/session|tracker:" src android/app/src --glob '!**/legacyImport*'` ne rend rien.
**Taille** gros (≈ +250 / −60 lignes de code, ≈ 300 de test) · **Modèle** Opus / high (format de fichiers, trois chemins de lecture, Java et TypeScript ensemble) · **Risque** moyen (oubli d'un des trois points de lecture : la session entre sans nom, notes, repères ni sauts ; conversion `.imu` fausse : sauts perdus ; désaccord Java / TS sur le format).
**Avant** : 320 · **Après** : 306, 322 · **Avant la première APK** : **oui, obligatoire** (sinon la mémoire de l'utilisateur se remplit de fiches `tracker-session` et la coupure devient une migration).

### À faire

**1. Table d'identité amorcée** (`src/core/appIdentity.ts`, neuf ; dans `core/` parce que `theme/` ne peut pas importer `platform/`, `src/architecture.test.ts:40-53`)
- `APP_NAME = 'Gtracker'` ; `APP_SLUG = 'gtracker'`.
- `FILE_FORMATS.session = `${APP_SLUG}-session``, `FILE_FORMATS.capteurs = `${APP_SLUG}-capteurs`` ; `XML.session = { prefix: APP_SLUG, ns: 'urn:gtracker:session' }` (aucun domaine, aucun dépôt : question Q6 d'O2).
- `MARKER_FILE = `${APP_SLUG}.json``, `FILE_FORMATS.memoire = `${APP_SLUG}-memoire`` (avancés du lot 322 : le refus du dossier de Tracker, étape 6, en a besoin ; voir Pièges).
- Commentaire en tête : « valeurs figées dès la première installation ; les changer ensuite fait perdre toutes les données ». Test `src/core/appIdentity.test.ts` qui fige la table et vérifie que chaque valeur commence par `APP_SLUG` (le lot 322 le complète).

**2. Le seul fichier qui lit les anciens noms** (`src/library/legacyImport.ts`, neuf, ≈ 90 lignes)
- `parseImportedRecord(text)` : lit une fiche sous `tracker-session` **ou** sous le format neuf (passe `formats` à `readRecordParts`), retire `withoutOriginFields`, dit si `sport` est un sport d'une autre famille (`OTHER_SPORT_IDS`).
- `LEGACY_BUNDLE` : préfixe `tracker` ; ouverture reconnue par le motif `/<extensions><tracker:session xmlns:tracker="[^"]*" version="1">/`, **sans écrire l'adresse `segneur34/Tracker`**.
- `upgradeImportedImu(bytes)` : réécrit l'en-tête JSON du `.imu` (`format` neuf, `setup.cadence` retiré) ; magie `TRKIMU1\n` et corps des mesures intacts.
- `withoutOriginFields(record)` : retire à l'entrée ce que Tracker écrit et que Gtracker ne lit pas : `analysis.effortThresholdMs`, `analysis.bikeWeightKg`, `analysis.loadKg`, `summary.cadence`, `summary.bests`, `summary.best1kmS`, `summary.best5minMs`, `summary.avgPowerW`, `surfaces`, `terrainElevation`, `elevationSource`, `intervals`, `test`.
- `OTHER_SPORT_IDS = ['running', 'cycling', 'run-intervals', 'bike-intervals', 'run-test', 'muscu']` (d'après `git show 2eed9e7:src/core/types.ts:15-16`).
- `LEGACY_MARKER_FILE = 'tracker.json'` (lu par le seul refus de l'étape 6).

**3. Fiche** (`src/library/record.ts`)
- `record.ts:45` · `RECORD_FORMAT` prend `FILE_FORMATS.session` (`gtracker-session`) · `RECORD_VERSION` (`:46`) reste 1, `SUMMARY_CALC_VERSION` (`:111`) reste 18.
- `record.ts:770-771` · `readRecordParts` reçoit un paramètre `formats` (défaut `[RECORD_FORMAT]`) ; `:780` réécrit déjà `format: RECORD_FORMAT`, donc une fiche lue sous l'ancien nom s'écrit sous le neuf sans code de plus · ≈ 5 lignes.
- `parseRecordWithRaw` (7 appelants) **ne change pas de comportement** pour les 4 lecteurs de la mémoire (`hooks/sessionLibrary/memory.ts:225`, `pending.ts:54`, `recordWrites.ts:82`, `scan.ts:178`, `sessionRecords.ts:159,175`) : ils ne lisent que le format neuf.

**4. Les trois points de lecture de la porte**
- `src/library/importEntry.ts:30` (fiche posée à côté) et `:35` (fiche du paquet gardée telle quelle) · remplacer `parseRecordWithRaw` par `parseImportedRecord`.
- `src/library/sessionBundle.ts:20-22` (constantes `NS`, `OPEN`, `CLOSE`), `:132-136` (écriture : préfixe et espace de noms neufs, `XML.session`), `:148-160` (`undoEdits` paramétré par le préfixe), `:163-181` (`unbundleSessionGpx` : cherche le bloc neuf, à défaut `LEGACY_BUNDLE` ; fiche lue par `parseImportedRecord` à `:170`) · ≈ 20 lignes · commentaire `:15` (`tracker:edit`) réécrit.
- `src/hooks/sessionLibrary/importer.ts:178` (`const motion = sideMotion ?? bundle.motion ?? undefined;`) · faire passer les capteurs, posés à côté ou du paquet, par `upgradeImportedImu`.

**5. Capteurs** (`.imu`)
- `src/core/imuFile.ts:37` · `IMU_FORMAT` prend `FILE_FORMATS.capteurs` · magie `IMU_MAGIC` (`:36`, `TRKIMU1\n`) **gardée** (neutre).
- `src/core/imuFile.ts:186-191` · extraire la découpe magie / longueur / en-tête / corps, déjà faite dans `decodeImuHeader`, pour que `upgradeImportedImu` la réutilise · ≈ 15 lignes.
- `src/core/imuFile.ts:69-71`, `:179` · retirer `setup.cadence` (cadence à pied ; aucun écrivain, `platform/motion.ts` ni Java, V1) · tests `imuFile.test.ts:46`, `imuFile.reference.test.ts:61`, `library/newRecord.test.ts:30` · ≈ 6 lignes.
- `android/app/src/main/java/io/github/segneur/tracker/MotionPlugin.java:373` · `header.put("format", "gtracker-capteurs")`.
- `android/app/src/test/java/io/github/segneur/tracker/ImuReference.java:28` (format) et `:31` (`"cadence":false` retiré de `setup`) ; refaire `src/core/imuFile.reference.imu` par `node outils/imu-reference.mjs` (JDK seul) ; `imuFile.reference.test.ts:46`, `:56`, `:61`, `:174` suivent.

**6. Refus du dossier de Tracker comme mémoire** (question Q3 d'O2)
- `src/library/folderLayout.ts:24` (`MARKER_FILE`) et `:32` (`MEMORY_FORMAT`) · prennent `appIdentity` (`gtracker.json`, `gtracker-memoire`).
- `src/platform/memoryFolder.ts:245`, `:260` · `names.has('tracker.json')` en dur → importer `MARKER_FILE` · tests `memoryFolder.test.ts:18`, `reconcile.test.ts`, `useSessionLibrary.perte.test.ts` (marqueur), banc `outils/banc/miseajour.mjs:145`, `outils/docs-cites.mjs:34` (`'tracker.json'` → `'gtracker.json'`).
- `src/hooks/sessionLibrary/lifecycle.ts` `attach` (`:57`), avant `guardedFolder` (`:36-39`) et `ensureLayout` (`:42-46`, qui **écrit** le marqueur et **récrit** `LISEZMOI.txt`) · un dossier qui porte `LEGACY_MARKER_FILE` sans `MARKER_FILE` n'est pas ouvert ; message : « Ce dossier est celui de l'autre application : ajoutez ses sessions par « Ajouter les sessions d'un dossier ». » · ≈ 10 lignes · test dans `legacyImport.test.ts` ou `useSessionLibrary.memoire.test.ts`.

**7. Refus d'une session d'un sport retiré** (choix R1 d'O2 §1.3, question Q2)
- Fiche de Tracker dont `sport ∈ OTHER_SPORT_IDS` : refusée (`parseImportedRecord` le dit ; `importer.ts` après `:171`).
- GPX dont le `<type>` est un sport connu non pris en charge : `src/library/summaryOptions.ts:156-160`, `:183-189` · `AnalyzedGpx` porte le type brut ; `hooks/sessionLibrary/addSession.ts:119-125` · `addGpx` rend un statut `other-sport`.
- `src/library/naming.ts:53-84` · `FOREIGN_TYPES` : ses **16** entrées `null` (`:54-58` course, `:69-79` vélo ; O2 disait 17, V1 a compté 16) deviennent la liste `OTHER_SPORT_TYPES` (même place, sens neuf) ; `guessSport` (`:86-92`, `?? null` à `:91` ; V1 disait `:99`, c'est `:91`) inchangé ; commentaire `:46-52` réécrit sans « application complète ».
- `src/library/fitToGpx.ts:107-108` · un FIT de course rend le `kind: 'refused'` qui existe déjà, raison « course à pied : Gtracker ne range que la voile et le surf » (au lieu d'écrire `<type>running</type>`, `:107-110`).
- `src/library/importReport.ts:8` · champ `otherSports: string[]` ; `:40` (`describeImport`) · phrase « N sessions de course, de vélo ou d'entraînement laissées de côté ».
- `hooks/sessionLibrary/importer.ts:206` · branche FIT : compter le refus dans `otherSports`.
- « À classer » **reste** pour un sport inconnu (`sport: null`) : écran `pages/SessionLibrary.tsx:535`, `:687-694`, `UNCLASSIFIED_PROFILE` (`core/sportProfiles.ts:524-533`), `importer.ts:41` (journal sans en-tête), `addSession.ts:76`.
- Tests : `hooks/sessionLibrary/addSession.test.ts:162-168` devient un test de refus ; `library/naming.test.ts:31-35` réécrit ; `library/fitToGpx.test.ts:69`, `:145-170` ; `hooks/useSessionLibrary.balayage.test.ts:91` ; `legacyImport.test.ts` (c).

**8. Porte délimitée** (garder, dire ce qu'elle est)
- Garder tels quels : `hooks/sessionLibrary/importer.ts` (260 lignes), `library/importEntry.ts`, `library/sessionBundle.ts`, `hooks/sessionLibrary/incoming.ts`, `platform/incomingFile.ts`, `platform/memoryFolder.ts:438-494` (`folderImportPaths` `:447-453`, `pickFolderToImport` `:474-494` ; `shouldDescendIntoMemory` `:240-246` et `isMemorySubfolder` `:258-261` ne servent qu'à choisir le bon niveau du dossier), `library/fitToGpx.ts`, `library/naming.ts:86-92` (`guessSport`), lecteurs génériques de `record.ts` (`...rest` `:775-779`, `readAnalysis` `...raw`), `isSummaryOutdated` (`summaryOptions.ts:107-114`) et `carriedSettings` (`record.ts:852-864`) qui servent les fiches de Tracker de septembre et octobre.
- Garder `core/types.ts:19` et `core/gpxParser.ts:36-38` (`trackType`, lu par `guessSport` : porte des GPX tiers ou de Tracker ; zone 1 [B], seul le commentaire cite `running`, acceptable).
- Garder la lecture tolérante de `setup.jumps === false` (`.imu` sans sauts, V2 nuancé 12) : `hooks/useSessionJumps.ts:40`, `library/newRecord.ts:71`, `library/record.ts:351`, `core/imuFile.ts:178`, `pages/RecordingPage.tsx:776`, `platform/motion.ts:140`.
- Les commentaires de la porte qui nomment Tracker (`importer.ts:235`, `ImportButtons.tsx:10`, `memoryFolder.ts:443`, `:469`, `fitToGpx.ts:16`, `:41`, `:46`) sont réécrits au lot 306 (B14) ; ceux de `incoming.ts`, `incomingFile.ts`, `IncomingFileNotice.tsx` au lot 322.

**9. Tests à suivre dans ce lot**
- `library/sessionBundle.test.ts:9`, `:94`, `:103-105` · passe sur le format neuf ; `OLD_BUNDLE` (`:103-105`, paquet de Tracker) déménage dans `legacyImport.test.ts`.
- `library/compat.formats.test.ts:75-106` (GPX complet, `:103`) · format neuf.
- `library/compat.fiche.test.ts:74` · format neuf ; bloc (d) « fiche de septembre » (`:83-101`) déménage dans `legacyImport.test.ts`, lu par `parseImportedRecord` sous l'ancien format.
- `hooks/useSessionLibrary.perte.test.ts` (fiches `tracker-session`, `:656`), `planning/routeRecord.test.ts:74-75` (valeur `'tracker-session'`) · constantes.
- `core/imuFile.reference.test.ts:46`, `:56`, `:61`, `:174` ; JUnit `ImuFormatTest`.
- `legacyImport.test.ts` · ajouter (c) une fiche de Tracker `sport: 'running'` et un GPX `<type>running</type>` refusés avec le message ; (d) une fiche `tracker-session` posée **directement** dans `sessions/` de la mémoire reste en lecture seule et n'est jamais réécrite (la lecture de l'ancien est bornée à la porte) ; (b) complété : fiche écrite en `gtracker-session`, `.imu` écrit en `gtracker-capteurs`, corps des mesures identique.

**10. Banc** (même lot, sinon le script « passe » à tort)
- `outils/banc/imports.mjs:70` (fiche `format: 'tracker-session'`) et `:180` (paquet sous `https://github.com/segneur34/Tracker/session`) · le point 7 (GPX complet d'une version plus récente) éprouve la porte : écrire le paquet sous l'ancien préfixe **sans** l'adresse, ou sous le neuf, selon ce qu'il veut prouver ; le reste du script (course, vélo, fiche du 24/09) relève du lot 330.
- `outils/banc/miseajour.mjs:145` · marqueur `gtracker.json` / `gtracker-memoire`.

### Pièges

- **Ordre d'O2 corrigé.** O2 place le refus du dossier de Tracker (étape 6) au lot 2 et le renommage du marqueur au lot 4 : impossible, tant que les deux applications écrivent `tracker.json` on ne peut pas les distinguer. Le marqueur (`MARKER_FILE`, `MEMORY_FORMAT`, `memoryFolder.ts:245`, `:260`) est donc renommé **ici** ; le lot 322 n'y revient pas.
- Le refus vise un dossier **choisi** (`chooseFolder`, `lifecycle.ts:209`). La mémoire de développement (OPFS `Gtracker` du Firefox du PC, `localhost:5174`) porte encore `tracker.json` et des fiches `tracker-session` : après ce lot elle est refusée ou illisible. Sans enjeu (aucune donnée de l'utilisateur) : la vider une fois (O2, « Vérifications »).
- **NE PAS** « lire les deux noms pour les fiches déjà écrites par l'APK 0.00.05 » (zone 6 [L] `record.ts:45`, zone 7 [L] `routeGpx.ts:21-23`) : aucune APK n'est installée, il n'y a rien à relire.
- Fiche de Tracker « plus récente » (version > 1, si Tracker change de format après le 08/11) ou illisible : `recordToKeep` (`library/recordText.ts:29-31`) la range **telle quelle**, au caractère près, donc sous `tracker-session` dans la mémoire de Gtracker ; la session devient en lecture seule et l'ancien nom reste dans le dossier. À VÉRIFIER à l'exécution, et à trancher : à la porte, ne garder que le GPX (fiche ignorée, dite dans le rapport d'import) plutôt que de ranger la fiche.
- `withoutOriginFields` retire bien les champs à l'entrée, mais tant que le lot 306 (B11) n'a pas retiré `effortThresholdMs`, `bikeWeightKg`, `loadKg` d'`ANALYSIS_FIELDS` (`record.ts:593`, `:597-598`), `readAnalysis` les réécrit à `null`. L'assertion « fiche sans ces trois champs » s'ajoute au lot 306.
- Le refus R1 d'un FIT de course d'une montre prêtée : `confirmWatchFolder` (`importer.ts:84-97`) demande déjà avant un dossier de montre ; le message doit **compter** ces fichiers sans les nommer un par un.
- « À classer » ne sert pas qu'à Tracker : un GPX de montre ou de Strava sans `<type>` (ou `hiking`, `paddling`), un journal sans en-tête, y arrivent. Ne pas retirer l'écran ni `UNCLASSIFIED_PROFILE` (zone 1 [?] `core/types.ts:11-16`, zone 5 [B] `SessionLibrary.tsx:535`, zone 3 [B] `addSession.ts:76` : tranchés par O2 §1.3). Le script du banc `classer` reste donc utile (D3, doute 2 ; sa réécriture sur la voile est au lot 330).
- Garder `src/test/gpx/corpus.ts`, `src/test/gpxParser.legacy.ts` et `core/gpxParser.corpus.test.ts` : c'est la lecture des GPX des autres applications, la porte des fichiers sans fiche (O2 §4, zone 1 [P], zone 8 [P]). Leurs `<type>running</type>` restent : ce sont les fichiers que Strava ou Garmin écrivent, et R1 doit les reconnaître (zone 1 proposait de les passer en `wingfoil`, ne pas le faire). `timedPoints` de `gpxParser.legacy.ts:24-31` relève du lot 325. Le renommage de `trackerEntry()` (`gpxParser.corpus.test.ts:37-55`) est au lot 322.
- Le défaut n° 1 d'O3 (fiche de course de Tracker relue sans calcul puis réécrite par la file des résumés, `summaryOptions.ts:112-114`, `summaryQueue.ts:251`) **disparaît** : une fiche de course est refusée à la porte, et une fiche `tracker-session` posée dans la mémoire est illisible, donc jamais réécrite (cas (d)). Aucun code de plus ; voir lot 306.
- Java et TS doivent dire le même format : `imuFile.reference.test.ts:174` contrôle déjà `header.put("format", "${IMU_FORMAT}")` dans `MotionPlugin.java`. Refaire `src/core/imuFile.reference.imu` : il contient l'ancien format en binaire (H2 le signale).
- Le banc des lots 321 et 322 se lance avec `--scripts-par-cote` : sinon le côté « avant » reçoit les scripts neufs et ne voit rien.

### Vérification

- `npx tsc -b --force`, `npm run verif`.
- `npx vitest run src/library/legacyImport.test.ts src/library/summaryFrozen.test.ts src/library/sessionBundle.test.ts src/library/compat.formats.test.ts src/library/compat.fiche.test.ts src/core/imuFile.reference.test.ts` ; `SUMMARY_CALC_VERSION` = 18, `RECORD_VERSION` = 1.
- Java : depuis `android/`, `gradlew.bat testDebugUnitTest` (`ImuFormatTest`).
- Banc : `node outils/banc/passe.mjs imports partage surf general --avant HEAD --scripts-par-cote -j 1 --sans-cache`.
- Recherche de contrôle à zéro : `rg -n "tracker-session|tracker-capteurs|Tracker/session|tracker:" src android/app/src --glob '!**/legacyImport*'`.
- Essai au téléphone (avec la première APK, lot 323) : « Ajouter les sessions » avec un GPX complet de voile exporté par l'autre application → session dans la bibliothèque, nom, notes, repères et onglet des sauts présents ; avec un GPX de course → refusé avec un message clair.

### Questions liées

- **Une session de course, de vélo ou d'entraînement arrive à l'import : la refuser avec un message, ou la ranger « à classer » ?** (O2 Q2) · Par défaut : refusée (« Gtracker ne range que la voile et le surf ») ; une trace dont on ne connaît pas le sport reste « à classer » · Change : ≈ 50 lignes de plus pour le refus ; sans refus (R2), les 16 entrées `null` de `FOREIGN_TYPES` partent simplement au lot 306.
- **Si l'on choisit par erreur le dossier de Tracker comme mémoire : refuser avec un message ?** (O2 Q3) · Par défaut : oui · Sans refus, ses sessions s'affichent en lecture seule, et Gtracker ajoute son marqueur et récrit le mode d'emploi dans ce dossier.
- **Les mesures des capteurs (sauts, pumping) d'une session venue de Tracker : les reprendre ?** · O2 (Q4) répond par défaut **oui** (le GPX complet les porte déjà ; ≈ 20 lignes pour les convertir ; sans elles, une session de wing importée perd son onglet des sauts) ; D4 (question 8) répondait par défaut **non** (« le `.imu` non repris »). **L'architecte O2 retient oui** ; c'est ce que ce lot fait (étape 5) · Change : si non, `upgradeImportedImu` et le cas `.imu` du jeu d'essai tombent, le paquet importé perd ses capteurs.
- **Le nom technique `gtracker` (clés, formats, `urn:gtracker:session`) sera figé à la première installation : le garder ?** (O2 Q6) · Par défaut : oui · Si GONG veut un autre nom ou son propre domaine, c'est maintenant (une ligne de `core/appIdentity.ts` tant que rien n'est installé).
- **L'import de fichiers FIT de montre reste-t-il ?** (D3, doute 1) · Par défaut : oui (une montre enregistre aussi du kite, de la planche, du surf) · Change : sinon le refus R1 du FIT est sans objet et `fitToGpx.ts`, le bouton « GPX ou FIT » et le script `import-fit` partent (lot 325).
- **Fiche de Tracker d'une version plus récente que 1.0.0 : ranger seulement le GPX ?** (À VÉRIFIER, Pièges) · Par défaut : oui, la fiche est ignorée et le rapport d'import le dit · Change : aucun ancien nom n'entre dans la mémoire.

---

## Lot 306 (réécrit) · Coupure des relectures d'anciennes données

**But.** Plus aucun code ne relit ce que Tracker a écrit hors de la porte du lot 321 : migrations et versions des réglages, mises à jour au démarrage, ancien `reglages.json`, reliques de `StoredSettings`, champs de la terre de la fiche, graines, vieilles adresses, vieilles clés d'onglets et de notes, tests et jeux d'essai de compatibilité. C'est fini quand la recherche de contrôle de la section « Vérification » rend zéro et que `summaryFrozen` et `legacyImport` restent verts.
**Taille** gros (≈ −700 lignes de code, −900 de test, ≈ 20 fichiers de production, ≈ 20 de test) · **Modèle** Opus / high (beaucoup de fichiers, gardes à supprimer en connaissance de cause) · **Risque** moyen (défaut silencieux possible : familles cachées, activité retenue, cache ; atténué par `tsc` sur des unions fermées et par `summaryFrozen`).
**Avant** : 320, 321 · **Après** : 322 (qui renommerait sinon pour rien ce que ce lot supprime), 304 (reçoit B12) · **Avant la première APK** : **oui, fortement** (sinon les réglages installés gardent `activitiesVersion: 9`, `presetsVersion: 5`, et une future graine « version 2 » serait sautée).

Remplace la ligne 306 de `docs/BACKLOG.md:43` (« fiches au calcul retiré masquées au lieu de « À classer » ; clés terre plus écrites à `null` ; un dossier de Tracker complet s'ouvre sans bruit ») : le dossier de Tracker ne s'ouvre plus comme mémoire (lot 321), « clés terre à `null` » = B11 + `withoutOriginFields`, « masquées » devient « refusées à l'import » (R1).

**Règle de plomberie des versions** (O2 §3) : **tout enlever, sans constante remise à 1.** Une valeur absente se lit déjà « version 1 » (`useSportSettings.ts:155`, `?? 1`) ou « 0 » (`activitySettings.ts:353`, `?? 0`) : la première vraie migration de Gtracker réintroduira le champ avec cette convention. Condition : le faire avant la première installation (le magasin recopie `...stored`).

**Ordre interne** : B1 → B2 → B3/B4 (le compilateur guide) → B5/B6 → B7/B8/B9 → B10/B11 → B13/B14 → B15 au fil de l'eau ; B16 à part, à la fin. B12 attend le lot 304.

### À faire

**B1 · Démarrage** (`src/main.tsx`)
- `main.tsx:16` · retirer `settingsUpgraded` et `reportStartupError` de l'import (l'export `reportStartupError` reste : `hooks/useRestingHrResults.ts:6,34` l'emploie).
- `main.tsx:19` · retirer `upgradeStoredActivities`, `upgradeStoredPresets` de l'import ; `:20` · retirer l'import de `forgetFormerAnalysisTabs`.
- `main.tsx:46-65` · retirer le commentaire, `upgradeError`, l'enveloppe `upgrade`, les deux mises à jour, `settingsUpgraded()` et l'oubli des onglets · ≈ 20 lignes.
- `main.tsx:74-77` · retirer le message « Réglages de l'appareil non mis à jour pour cette version ».
- Reste de la plomberie : rien.

**B2 · Magasin des réglages** (`src/hooks/useSportSettings.ts`)
- `:3-4` · imports `ACTIVITIES_VERSION`, `upgradeActivities` ; `:25-26` · imports `PRESETS_VERSION`, `resetStoredPresets`.
- `:85-99` · `referenceSpeeds` (« ancienne allure imposée par support ») écarté : `readStoredSettings` lit tel quel · ≈ 6 lignes.
- `:124-130` · `writeStored` n'écrit plus `presetsVersion`.
- `:143-176` · retirer `upgradeStoredActivities` (`:153`) et `upgradeStoredPresets` (`:168`) · ≈ 30 lignes.
- `:236` · doc de `hiddenFamilies` (« celles de l'application complète comprises (`readHiddenFamilies`) ») réécrite.
- `:358`, `:371`, `:391` · plus d'`activitiesVersion` écrit.
- `:510-513` · `legacySport` (`stored.sport` passé à `moduleActivity`) retiré.
- Reste : `writeStored`, `updateStoredSettings`.

**B3 · Réglages purs** (`src/settings/activitySettings.ts`, `src/settings/activityPresets.ts`)
- `activitySettings.ts:120-123` · `StoredSettings.sport` (« ancienne clé : le support choisi dans le module voile ») ; `:738` · repli `?? (family === 'voile' ? stored.sport : undefined)` dans `moduleActivity` · ≈ 8 lignes.
- `:129-132` · `activitiesVersion`, `presetsVersion` de `StoredSettings`.
- `:133-137` · `hiddenFamilies` devient `SportFamily[]`.
- `:165-171` · champ `bikeTypes` (« relique de l'application complète », aucun lecteur, V1) et commentaire qui liste les tables de la terre gardées brutes (`terrainSteps`, `gradeRanges`, `cadence`, `bikeWeights`, `carriedLoads`, `energyModels`, `paceLevels`, `customFlatSpeeds`, `wayTypes`, `loopReturnRatios`).
- `:194-196` · commentaire « séances du compteur… partis avec l'Entraînement… restent dans le fichier ».
- `:292-305` · `FULL_APP_FAMILY_IDS` (`:298`), `isKnownFamily` (`:300`), `readHiddenFamilies` (`:304`) → un filtre sur `SPORT_FAMILIES` · appelants `useSportSettings.ts:236`, `:255`, `:405`, `:424`, `:478`.
- `:311` · `activitiesVersion` retiré de `withVisibility`.
- `:313-369` · `PRESETS_VERSION` (5), `PRESET_RESETS` (`:331-351`), `resetStoredPresets` ; entrées mortes `:64-68`, `:343-344` avec · ≈ 50 lignes.
- `activityPresets.ts:68-69` · `PRESET_BASES` (lu aussi par `activityPresets.test.ts:3,39,51,53`, à suivre).
- `activitySettings.ts:28` · commentaire « Le magasin (`tracker.sportSettings`) » : voir lot 322.
- Reste : `withVisibility`, `moduleActivity`. Version : `PRESETS_VERSION` supprimé.

**B4 · Activités** (`src/core/activities.ts`)
- `:97-118` · `ACTIVITIES_VERSION` (9) et `ACTIVITY_SEEDS` (`:115-118`, deux graines de version 5 : Surf, Surf foil).
- `:238-291` · `upgradeActivities` (`:256`, appelant unique `useSportSettings.ts:159`) et `recolorActivities` (`:276`, migrations de version 4 et 7, appelée par `upgradeActivities` seule).
- `:131-137` · commentaire de `readActivities` (« ceux de la course… lot 305 ») réécrit.
- Reste : `readActivities` (le rejet d'un calcul inconnu reste utile). Version : `ACTIVITIES_VERSION` supprimé.

**B5 · Ancien `reglages.json` et reprise des réglages de Tracker**
- `hooks/sessionLibrary/deviceSettings.ts:189-201` · `settingsUpgraded` ; `hooks/useSessionLibrary.ts:47` · son réexport.
- `deviceSettings.ts:251-259` (doc de `syncSettings`), `:265` (`legacy`), `:273` (`?? legacy`), `:280-283` (branche `chooseSettings`), `:291` (**effacement de `reglages.json` dans le dossier ouvert**, zone 6 [D]).
- `library/settingsFile.ts:19-22` (doc, « avant le point 90 »), `:262-275` (`SettingsChoice`, `chooseSettings`).
- `library/folderLayout.ts:10-11` (commentaire du schéma), `:26-27` (`SETTINGS_FILE`).
- `library/reconcile.ts:2`, `:111` (`name !== SETTINGS_FILE`).
- Reste : `syncSettings` à un seul chemin (fichiers `reglages/`). Version : `SETTINGS_VERSION` reste 2 ; `device: null` de `SettingsFile` à retirer seulement si plus rien ne le produit (À VÉRIFIER à l'exécution, doute d'O2).

**B6 · Choix retenus de la terre**
- `library/settingsFile.ts:215-223` · retirer `'sport'`, `'lastIntervalWorkout'`, `'lastTimerWorkout'`, `'heartBands'` de `REMEMBERED_CHOICES` · tests `settingsFile.test.ts:112`, `:234-247`.
- Reste : `moduleActivity`, `recordActivity`.

**B7 · Notes d'avant le dossier**
- `hooks/sessionLibrary/summarySettings.ts:134-139` · `LEGACY_NOTES_KEY = 'tracker.sailingNotes'` (lue seulement, jamais écrite par Gtracker).
- `library/newRecord.ts:19-20`, `:52` · `legacyNotes` de `NewRecordContext`.
- `library/record.ts:972-989` · `findLegacyNotes` (fonction à `:977`) · tests `record.test.ts`, `newRecord.test.ts` (`legacyNotes`).

**B8 · Onglets d'avant le 05/11**
- `hooks/useOpenSections.ts:30-45` · `FORMER_TAB_KEYS` (`:32`, dont `'running'`, `'cycling'`, `'intervals'`, `'muscu'`) et `forgetFormerAnalysisTabs` (`:40`) ; les deux `'tracker.sections'` en dur `:41`, `:44` partent avec.

**B9 · Vieilles adresses** (`src/App.tsx`)
- `App.tsx:80-84` · `RestingHrRedirect` ; `:2` · `useLocation` sort de l'import.
- `App.tsx:110-119` · routes `/course/*`, `/velo/*`, `/fractionne`, `/fractionne/analyse`, `/fractionne/tests/fc-repos`, `/fractionne/*` et leurs commentaires.
- **Ajouter** dans le cadre `AppShell`, en dernier : `<Route path="*" element={<Navigate to="/" replace />} />` (aujourd'hui aucune route `*` : une adresse inconnue donne une page vide).
- `core/parentPage.ts` · commentaires `:6`, `:12-18` (« sous l'Entraînement avant », « depuis le lot 301 ») réécrits ; aucun code propre à ces adresses n'y reste (zone 1). `core/parentPage.test.ts:24-26`, `:42-43`, `:47` éprouvent qu'une adresse inconnue remonte à l'accueil : garder.
- Banc : `outils/banc/passe.mjs:33` · retirer `'/course'`, `'/course/analyse'`, `'/fractionne'`, `'/fractionne/analyse'` de `PRECHAUFFE` (D3 conseille d'y ajouter `'/surf'`, `'/itineraires/liste'` : lot 330).
- Reste : une seule route « tout le reste → accueil ».

**B10 · Lecteur de fiche et cache**
- `library/record.ts:698-704` · retirer `'intervals'`, `'test'` de `GUARDED_FIELDS` (`:702-704`) ; `'surfaces'`, `'terrainElevation'`, `'elevationSource'` partent avec le lot 304 (B12) ; commentaire `:698-701` réécrit.
- `record.ts:774` · commentaire « Voies, altitude du terrain, séances et test guidé… passent bruts » réécrit.
- `record.ts:1009-1018` · `RECORD_READER_VERSION` **remis à 1**, commentaire réécrit sans « course, vélo, Entraînement ».
- `library/libraryCache.ts:14-26` · `light`, `reader` obligatoires ; `:43` · `?? 1` et `=== true` retirés.
- Reste : **le mécanisme est gardé** (un lecteur qui change refait le cache de Gtracker). Versions : `RECORD_READER_VERSION` 2 → 1 ; **`SUMMARY_CALC_VERSION` reste 18** (remis à 1, `isSummaryStale` `record.ts:952-953` ne referait plus jamais une fiche de Tracker) ; `RECORD_VERSION` reste 1.

**B11 · Champs de la terre de la fiche** (non liés au planificateur ; constats zone 6 A1, rangés ici par O2)
- `library/record.ts:156-169` (`SessionSummary.cadence`, `best1kmS`, `best5minMs`, `avgPowerW`, `bests`), `:206-217` (`SummaryCadence`, `readSummaryCadence`), `:420-448` (`SummaryBests`, `readSummaryBests`), `:14-27` (`SUMMARY_BESTS_BOUNDS`), `:239` (`avgPowerW` de `ANALYSIS_SUMMARY_FIELDS`), `:245-247` (`SHARE_NUMBER_RANGES` : `avgPowerW`, `best1kmS`, `best5minMs`), `:489-499` (lecture cadence et meilleurs efforts), `:1098-1099` (`RecordPatch.avgPowerW`), `:1180` (`'avgPowerW'` dans la boucle).
- `record.ts:296-301`, `:593` (`effortThresholdMs`, partie `'effort'`), `:318-329`, `:597-612` (`bikeWeightKg`, `loadKg`, `isValidBikeWeight` `:605`, `isValidCarriedLoad` `:610`, partie `'charge'`), `:564` (`AnalysisPart` sans `'effort'`, `'charge'`).
- `record.ts:386-396`, `:404`, `:413-416` · types `intervals`, `test` de `SessionRecord`.
- `record.ts:902`, `:904` · `completeRecord` (`intervals`, `test`).
- `record.ts:997-1000` · `RECORD_LIGHT_FIELDS` sans `intervals`, `test`.
- `record.ts:107-109` et commentaire de `SUMMARY_CALC_VERSION` (`:64`, `:74`, `:78`, `:104-109`) · réduire aux versions qui touchent la voile et le surf, **sans toucher la valeur 18**.
- `library/sessionEdits.ts:20-21` (commentaire), `:82-86` (`EDITED_PART_LABEL.effort`, `.charge` ; appelant `hooks/useSessionDraft.ts:104`).
- Ajouter à `legacyImport.test.ts` (b) : fiche importée écrite **sans** `bikeWeightKg`, `loadKg`, `effortThresholdMs`.
- Lignes reprises du rapport zone 6 et contrôlées par échantillon par O2 (`:702-704`, `:902-914`, `:997-1000`, `:1009-1018`) : relire le bloc entier avant de couper.

**B12 · Champs et modes liés au planificateur** · **voir lot 304**, pas avant : `surfaces`, `terrainElevation`, `elevationSource` (`record.ts:392-394`, `:906-911`, `:925-927`, `:1100-1105`, `:1148-1167`, `:1215`), `planning/route.ts:82-101` (`LEGACY_ROUTE_MODES`, `LEGACY_WAY_TYPES`, `parseWays` `:89-93`), `planning/routeRecord.ts:27-35` (versions 2, 3 ; `ROUTE_VERSION` 3 → 1 avec le 304), `summaryQueue.ts:60-61`, `recordMerge.ts:147` (V1). `planning/surface.ts:433` et `record.test.ts` les lisent encore.

**B13 · Profil d'avant les seuils** (lignes corrigées : O2 donnait `athleteProfile.ts:64-66, 135, 166, 179`, le code est aux lignes ci-dessous, V1 et zone 1)
- `library/athleteProfile.ts:59` (type `hrZones`), `:78` (défaut), `:84` (exclusion de `RunnerNumberField`), `:165`, `:181` (lecture) ; commentaires associés.
- `core/heartRate.ts:107-109` (`HeartRateAthlete.hrZones`), `:169-178` (branche de `enteredThresholds`), `:162` (`isValidZoneBounds`, qui ne sert qu'à ce chemin, V1 ; test `heartRate.test.ts:111`).
- `hooks/useRunnerProfile.ts:86` · `hrZones: null` à la saisie des seuils.
- `library/restingHrStore.ts:35` · version de repli `: 1` (la clé n'a jamais existé sans version dans Gtracker).
- Test `library/athleteProfile.test.ts:67-72`.

**B14 · Commentaires de la porte et du « à classer »** (et ceux qui nomment Tracker sur la porte)
- `core/types.ts:13-15` (« Les calculs de l'application complète… se relit sans calcul, « à classer » »).
- `library/fitToGpx.ts:16`, `:41`, `:46` (« à l'image d'une pause de Tracker »).
- `hooks/sessionLibrary/importer.ts:235` (« un dossier Tracker copié depuis le PC »).
- `components/ImportButtons.tsx:10` (« un dossier Tracker copié d'un autre appareil » → « un dossier de sessions »).
- `platform/memoryFolder.ts:443`, `:469` (porte d'import : dire « session venue d'une autre application » et les formats lus).
- `pages/SessionLibrary.tsx:690` (**visible**) : « Traces dont l'activité n'est pas connue : choisissez-la pour les ranger en voile, à pied, à vélo, en surf ou en entraînement. » → « … en voile ou en surf. »

**B15 · Tests et jeux d'essai de compatibilité**
- Supprimer : `hooks/useSportSettings.guard.test.ts` (97 lignes), `src/test/settings0461.fixture.ts` (55 ; importeur unique : le précédent), `library/settingsImport.guard.test.ts` (167), `library/compat.reglages.test.ts` (97 ; ne déplacer dans `settingsFile.test.ts` que les cas BOM, CRLF, version future s'il y en a), `library/compat.fiche.test.ts:126-160` (bloc f, fiche de l'application complète).
- Réduire `src/test/record.fixture.ts:111-148` (`familyRecords()` : retirer `course` `:113-119`, `velo` `:120-127`, `fractionne` `:130-142`) ; suivre `library/record.test.ts:969-999` (réécrire « tableaux de nombres sur une ligne » `:991-1000` sur `voile`/`surf` avec `marks`, `jumps`, `heartRate.histogram`), `library/sessionBundle.test.ts:202` (passe sur `voile`), `library/sessionEdits.test.ts:366-427` (le `:427` lit `.voile`, garder).
- `library/record.test.ts` · blocs à retirer ou réduire (zone 6) : `:40-48`, `:116-125`, `:191-225` (`bikeWeightKg`, `loadKg`, `effortThresholdMs`), `:293-325` (`intervals`), `:405-447` (cache allégé : retirer `intervals`), `:659-680` (`test`), `:725-745`, `:806-900` (illisibles : retirer `intervals`, `test`), `:905-960` (`oldReadAnalysis` : retirer les trois champs), `:1058-1100` (meilleurs efforts et « fiche de l'application complète … lot 305 » ; garder un cas générique `sport: 'moth'` pour `unreadable.sport`). Les blocs `surfaces` (`:262-290`) et `terrainElevation` (`:358-390`) suivent B12 (lot 304).
- `library/sessionEdits.test.ts:27-45`, `:64-143`, `:266-352`, `:384-395` (`oldSavedEdits`, `oldChangedParts`, `oldEditsPatch`, `oldRebaseDraft`) · garder la comparaison, retirer les trois champs ; `:65`, `:89-90`, `:136`, `:293`, `:297` fixent l'ordre des parties (V1).
- `core/activities.test.ts:58-90`, `:180-206` ; `settings/activitySettings.test.ts:43-125`, `:138-146`, `:304-305`.
- `hooks/sessionLibrary/couches.test.ts` et `hooks/useSessionLibrary.resumes.test.ts:292`, `:296` (appels `settingsUpgraded`, `upgradeStoredPresets`).
- `hooks/useSessionLibrary.perte.test.ts:684-712` (lecteur v2 ; usages de `RECORD_READER_VERSION` `:696-697`).
- `library/libraryCache.test.ts:17-31` (`toBe(2)` → 1 ; `:23` construit des caches avec `light` explicite, à relire, V1).
- `hooks/useVisibleStatSessions.test.ts:59-70`.
- Données de la terre dans des tests de la bibliothèque (zone 6, à vérifier ligne à ligne) : `library/summary.test.ts:27-52` **à garder** (prouve que le calcul n'écrit plus ces champs) ; `library/summaryOptions.test.ts:57-59`, `:124-130` (remplacer `running|cycling|muscu` par le sport inconnu `moth`, déjà présent) ; `library/stats.test.ts:18`, `:152` ; `library/shareStats.test.ts:30` ; `library/newRecord.test.ts:58-65` ; `library/summarizeGpx.test.ts:43-58` ; `library/previewImages.test.ts:7-22` (clés `running`) ; `library/reconcile.test.ts:67-70` (nom `running.GPX`, sans enjeu) ; `recording/liveFields.test.ts:70-80`, `:157` et suivantes ; `library/restingHrTest.test.ts:47-50` (variable `running`, faux ami : garder).
- Le cas `addSession.test.ts:162-168` est déjà devenu un refus au lot 321.

**B16 · Double clé de la ceinture cardio** (demandée par la répartition de la fiche ; O2 la disait « hors coupure, ne pas mêler » : la faire en dernier, dans un commit à part)
- `platform/heartRate.ts:145-148`, `:184` · `BELT_KEY = 'tracker.heartRateBelt'` (actif, « l'ancienne clé, d'avant la liste ») et `BELTS_KEY = 'tracker.heartRateBelts'` (liste) ; `platform/beltList.ts:6`, `:27-30` · `readBeltList` ajoute « l'appareil actif absent de la liste (choisi par une version d'avant la liste) ».
- Ne garder que la liste, avec l'actif noté dedans (`active: true` ou premier élément) ; supprimer `BELT_KEY`, `saveBelt`, le second argument de `readBeltList` et son cas d'amorçage · appelants via `savedBelt`, `savedBelts`, `chooseSavedBelt`, `addSavedBelt`, `forgetSavedBelt` (`hooks/*`) ; tests `beltList.test.ts`, `heartRate.test.ts:257-295` · ≈ 40 lignes.

**Banc à adapter dans ce lot** (sinon ces scripts échouent ou éprouvent ce qui n'existe plus ; V1 nuancé 23, D3)
- `outils/banc/reglages.mjs:31-32` (`PRESETS_VERSION = 3`), `:89`, `:108` (`activitiesVersion: 3`), `:130`, `:170`, `:177-178` (affichage de la mise à jour) · retirer les étapes de mise à jour ; un fichier de réglages de Tracker n'est plus repris.
- `outils/banc/prereglages.mjs:5`, `:60` (`activitiesVersion: 6`), `:79`, `:279`, `:287`, `:294`, `:303` · retirer l'étape 1 (effacements à la mise à jour) ; ne garder que les défauts du bateau et de la Voile (D3 : renommer `defauts-reglages`, au lot 330).
- `outils/banc/allure-session.mjs:76-81`, `:112` (D3 ; V1 cite `:78`, `:115`) · retirer les étapes 0 et 6 (« ancienne allure par support » posée puis effacée).
- Les scripts qui vont encore à `/course` ou `/velo` (`activite.mjs:153`, `cacher.mjs:60`, `:71`, `carte-perf.mjs:193`, V2 nuancé 6) tombent sur l'accueil grâce à la route `*` ; leur réécriture est au lot 330.

### Pièges

- **NE PAS garder `RECORD_READER_VERSION` à 2** (zone 6 le proposait pour un cache écrit par l'APK 0.00.05) : aucune APK n'est installée et la clé du cache est renommée au lot 322 ; O2 retient 1.
- **NE PAS remettre `SUMMARY_CALC_VERSION` à 1** : une fiche de Tracker à 18 doit rester à jour.
- **NE PAS retirer** `runnerHrSource` et son repli `{ kind: 'saisie', atMs: null }` (`library/athleteProfile.ts:41-47`, `:124-139`, zone 6) : il sert aussi aux fichiers de réglages importés d'un autre appareil.
- Les `hrZones` de `useAnalysisHeart.ts:16`, `SailingModule.tsx:214`, `SurfModule.tsx:188`, `StatisticsPage.tsx:365` sont des **zones calculées** (faux amis) : seul le champ `RunnerProfile.hrZones` part.
- `ACTIVITY_SEEDS` et `PRESET_RESETS` ne sont pas « sans effet » (V1 nuancés) : les graines de version 5 rajoutent Surf et Surf foil à une liste d'avant la version 5, et 3 des 4 effacements de pré-réglages agissent. Leur retrait est justifié par la décision 2 (seules les données de Tracker les déclenchent), pas par leur inutilité.
- `FOREIGN_TYPES` : traité au lot 321 (devenu `OTHER_SPORT_TYPES`). Si l'utilisateur choisit R2 (tout « à classer »), retirer ici les 16 entrées `null` (`library/naming.ts:54-58`, `:69-79`, sans effet puisque `guessSport` fait `?? null`, `:91`) et réécrire `naming.test.ts:31-35`.
- Défaut n° 1 d'O3 (fiche de course de Tracker à `calcVersion` < 18 recalculée sans calcul puis réécrite) : il **tombe** avec la coupure, sans code (refus R1 à la porte, fiche `tracker-session` illisible dans la mémoire). Le test qu'O3 proposait (« fiche de course à `calcVersion` 15 jamais rafraîchie ni réécrite ») est couvert par `legacyImport.test.ts` (c) et (d).
- Hors coupure, à ne pas mêler (O2) : `src/test/walkProfile.fixture.ts` et `minkm` (profil de la terre, pas une donnée de Tracker ; zones 6 et 8 [B]) → lot 325 ; `src/test/gpxParser.legacy.ts` (garde du lecteur GPX) → garder (lot 321) ; `useSportSettings.ts:306-321` (valeurs neutres du planificateur, V2 nuancé 8) → lot 304.
- La clé de fond de carte `tracker.fondCarte` est rangée par famille (`hooks/useMapBase.ts:17-23`, `:54`) : d'anciennes entrées `course`/`velo` peuvent rester dans le stockage d'un appareil, sans lecteur ; rien à faire, la clé change de nom au lot 322 (zone 3 [B]).
- `docs/backlog/305-*.md` décrit ces compatibilités comme voulues (`:13`, `:66-68`, `:72-74`) : une ligne en tête « ses transitions sont reprises par le lot 306 réécrit » (D4 §2) évite qu'un lecteur les restaure ; c'est une retouche de document (lot 331).
- Les tests de garde supprimés (`useSportSettings.guard`, `settingsImport.guard`, `settings0461`) étaient les « gardes du lot 187 » : les supprimer est le but, pas une perte ; `summaryFrozen.test.ts` reste la garde des résumés.

### Vérification

- `npx tsc -b --force`, `npm run verif`.
- `npx vitest run src/library/summaryFrozen.test.ts src/library/legacyImport.test.ts` vert ; `SUMMARY_CALC_VERSION` = 18.
- Banc en `-j 1` : `node outils/banc/passe.mjs reglages prereglages familles onglets general surf statistiques --avant HEAD -j 1 --sans-cache` (texte de page identique attendu hors des étapes retirées).
- Recherche de contrôle à zéro :
  `rg -n "activitiesVersion|presetsVersion|PRESET_RESETS|PRESET_BASES|ACTIVITY_SEEDS|upgradeActivities|recolorActivities|upgradeStored|settingsUpgraded|FULL_APP|readHiddenFamilies|bikeTypes|referenceSpeeds|legacySport|stored\.sport|SETTINGS_FILE|chooseSettings|findLegacyNotes|legacyNotes|sailingNotes|FORMER_TAB_KEYS|forgetFormerAnalysisTabs|RestingHrRedirect|bikeWeightKg|loadKg|effortThresholdMs|hrZones\b|BELT_KEY|application complète" src outils/banc`
  (attendu : seuls les `hrZones` des zones calculées, faux amis listés plus haut ; `PRESET_BASES` retiré de `activityPresets.test.ts` aussi).
- Un essai au téléphone suffit, avec la première APK (lot 323) : premier lancement → Réglages ne montre que Voile et Surf, aucune activité étrangère (essai 211 réécrit, D4 §3.2).

### Questions liées

- **Itinéraires et réglages de Tracker : ne plus les reprendre ?** (O2 Q5) · Par défaut : oui, couper · Change : un GPX d'itinéraire de Tracker se charge encore comme un simple tracé (sans ses balises ni ses bips) ; un fichier de réglages de Tracker est refusé comme « illisible » ; les activités et réglages se refont à la main dans Gtracker.

---

## Lot 322 · Renommage sec « tracker » → « gtracker », libellés visibles, banc, garde permanente

**But.** Plus aucun identifiant, libellé, commentaire, test ni nom de fichier ne dit « tracker » ou « Tracker » dans le code, le banc et les ressources, hors des trois fichiers de la porte ; tous les noms techniques viennent d'une table unique (`src/core/appIdentity.ts`). C'est fini quand la garde permanente `src/heritage.test.ts` est verte et ne tolère plus que les lignes du lot 323 (paquet Java, étiquettes de journal, configuration de signature).
**Taille** gros mais mécanique (≈ 450 occurrences : ≈ 30 clés dans ≈ 25 fichiers, 32 fichiers de test, 58 fichiers du banc, ≈ 60 libellés et commentaires) · **Modèle** Sonnet / high (mécanique, mais la vérification compte : banc et Java) · **Risque** moyen (une clé oubliée dans le banc : le script n'injecte plus rien et « passe » à tort ; d'où `--scripts-par-cote`).
**Avant** : 321, 306 (ce lot ne renomme pas ce que 306 supprime) · **Après** : 323, 327 (qui étend la garde aux mots de la terre), 330 (banc remis sur la voile et le surf, sur les clés neuves) · **Avant la première APK** : **oui, obligatoire**.

Règle : renommage « sec », sans aucune lecture de l'ancien nom. Rien n'est installé ; les seules données touchées sont celles du PC de développement (réglages de Firefox sur `localhost:5174`, tuiles et vignettes gardées, poignée du dossier choisi), à redonner ou vider une fois.

### À faire

**1. Table unique** (`src/core/appIdentity.ts`, amorcée au lot 321)
- Ajouter `STORAGE_KEYS` (chaque clé `` `${APP_SLUG}.<nom>` as const ``), les formats restants de `FILE_FORMATS` (`reglages`, `fc-repos`, `journal`, `itineraire`), `XML.itineraire = { prefix: APP_SLUG, ns: 'urn:gtracker:itineraire' }`, `CACHE_NAMES` (tuiles, vignettes, vignettes-images, base IndexedDB, en-tête `x-gtracker-saved-at`).
- Chaque module importe sa clé au lieu de répéter la chaîne. `src/core/appIdentity.test.ts` fige la table entière et vérifie que chaque valeur commence par `APP_SLUG`.
- Java ne peut pas importer le TS : chaînes en dur, contrôlées par `src/platform/nativeConstants.test.ts` (ajouter `.gtracker-tmp`, `.gtracker-new`, `gtracker.sons`).

**2. Table de renommage complète** (nom actuel · où · nom neuf · tests qui l'imposent ; lignes relues le 11/11)

Formats de fichiers et espaces de noms (ceux de la fiche, du paquet, des capteurs et du marqueur sont faits au lot 321) :

| Nom actuel | Où | Nom neuf | Tests et banc qui l'écrivent en dur |
|---|---|---|---|
| `'tracker-reglages'` | `library/settingsFile.ts:25` | `gtracker-reglages` | `library/settingsFile.test.ts`, `hooks/useSessionLibrary.perte.test.ts` ; banc `reglages.mjs:88`, `:106`, `:196` |
| `'tracker-fc-repos'` | `library/restingHrStore.ts:74` | `gtracker-fc-repos` | `library/restingHrStore.test.ts` ; banc `fc-repos.mjs:72` |
| `'tracker-journal'` (4 fois en dur) | `recording/journal.ts:20`, `:34`, `:138`, `:139` | `gtracker-journal` (une constante) | `recording/journal.test.ts`, `hooks/useRecorder.test.ts`, `library/compat.formats.test.ts:39` |
| `'tracker-itineraire'` | `planning/routeRecord.ts:19` | `gtracker-itineraire` | `planning/routeRecord.test.ts`, `library/compat.formats.test.ts:11`, `hooks/sessionLibrary/incoming.test.ts` |
| NS `https://github.com/segneur34/Tracker/itineraire`, `<tracker:itineraire>` | `planning/routeGpx.ts:21-23` | `urn:gtracker:itineraire`, préfixe `gtracker:` | `planning/routeGpx.test.ts` ; le fichier reste après le lot 304, ne pas l'attendre |
| `creator="Tracker"` (chaque GPX écrit) | `core/xml.ts:27-28` | `creator="Gtracker"` (`APP_NAME`) ; jamais lu (Grep `creator` : écriture seule) | `core/xml.test.ts:25`, `:38`, `library/sessionBundle.test.ts:9` |
| texte de `LISEZMOI.txt` écrit dans le dossier mémoire (« Dossier mémoire de Tracker », « Documents > Tracker », « tracker.json », « séances du compteur ») | `library/folderLayout.ts:53-90` (`:55`, `:74`, `:77`) ; schéma `:6-7` | texte Gtracker ; retirer « Fusionner deux dossiers : copiez le contenu de l'un dans l'autre » | `library/folderLayout.test.ts` s'il compare le texte |
| suffixes `.tracker-tmp`, `.tracker-new` (fichiers écrits dans le dossier mémoire) | `MemoryFolderPlugin.java:65`, `:70` ; commentaires `:48`, `:51`, `:52`, `:335`, `:366` | `.gtracker-tmp`, `.gtracker-new` | aucun TS ; contrôle à ajouter à `nativeConstants.test.ts` |
| magie `TRKIMU1\n` | `core/imuFile.ts:36`, `ImuWriter.java:25` | **garder** (« TRK » = trace, aucun « tracker ») | `imuFile.reference.test.ts:41` |
| `<type>` du GPX (`wingfoil` … `surf`) | `recording/gpxWriter.ts` | **inchangé** (identifiant de calcul, lu par `guessSport`) | aucun |

Clés de l'appareil (`jsonStore` : Preferences natives, `localStorage`), préfixe `gtracker.` :

| Clé actuelle | Où (écriture en dur, commentaires compris) | Remarque |
|---|---|---|
| `tracker.sportSettings` | `hooks/useSportSettings.ts:43` (commentaire `:34`) ; `library/settingsFile.ts:30`, `:210`, `:231`, `:234`, `:257`, `:259`, `:262` ; commentaire `settings/activitySettings.ts:28` | clé **qui voyage** : clé de `values` dans chaque `reglages/<appareil>.json` ; `TRAVELLING_KEYS` (`settingsFile.ts:30`) lit `STORAGE_KEYS` |
| `tracker.runnerProfile` | `hooks/useRunnerProfile.ts:22` (commentaire `:15`) ; `library/settingsFile.ts:30`, `:239`, `:244` | voyage ; `gtracker.athleteProfile` si le renommage `useRunnerProfile` → `useAthleteProfile` (zone 3 §6) passe avant |
| `tracker.theme` | `theme/theme.ts:32` (`THEME_STORAGE_KEY`) | `index.html` ne la lit pas |
| `tracker.sections` | `hooks/useOpenSections.ts:10` (commentaire `:31`) ; `components/CollapsibleSectionTabs.tsx:34` | `:41`, `:44` partent au lot 306 (B8) |
| `tracker.profil` | `components/ProfileRoot.tsx:40`, `pages/ProfilePage.tsx:58` | deux écrivains, une constante |
| `tracker.tutoriels` | `hooks/useTutorials.ts:14` | |
| `tracker.statistiques` | `pages/StatisticsPage.tsx:110` (commentaire `:99`) | |
| `tracker.panelSizes` | `components/ResizablePanel.tsx:25` | |
| `tracker.partage` | `components/ShareDialog.tsx:20` | |
| `tracker.libraryCache` | `hooks/sessionLibrary/cache.ts:13` | le cache repart vide (`RECORD_READER_VERSION` remis à 1 au lot 306) |
| `tracker.settingsSavedAt`, `tracker.deviceId`, `tracker.deviceName`, `tracker.seenSettingsFiles` | `hooks/sessionLibrary/deviceSettings.ts:43`, `:46`, `:48`, `:51` | |
| `tracker.summaryGestures` | `hooks/sessionLibrary/summarySettings.ts:48` ; commentaire `library/summaryGestures.ts:12` | |
| `tracker.followedTrace` | `hooks/useFollowedTrace.ts:16` ; commentaire `recording/followedTrace.ts:116` | |
| `tracker.fondCarte` | `hooks/useMapBase.ts:15` (commentaire `:9`) | |
| `tracker.brouterProfile` | `hooks/usePlannedRoute.ts:39` | part avec le lot 304 s'il passe avant ; sinon renommée ici |
| `tracker.zoneAlertTarget` | `hooks/useZoneAlert.ts:45` | |
| `tracker.restingHr` | `library/restingHrStore.ts:55` (commentaire `:7`) | |
| `tracker.planning` | `pages/PlanningPage.tsx:116` | |
| `tracker.routeList` | `pages/RoutesPage.tsx:33` (commentaire `:24`) | |
| `tracker.triBibliotheque` | `pages/SessionLibrary.tsx:468` | |
| `tracker.heartRateBelts` | `platform/heartRate.ts:148` | `tracker.heartRateBelt` (`:146`) part au lot 306 (B16) |
| `tracker.memoryFolder` | `platform/memoryFolder.ts:333` | |
| `tracker.permissionsSeenVersion` | `platform/permissions.ts:106` | |
| `tracker.tileCache`, `tracker.tileUrls` | `platform/tileCache.ts:341`, `:361` | |
| `tracker.sailingNotes` | `summarySettings.ts:134` | **supprimée au lot 306** (B7), pas renommée |

Autres stockages et noms techniques :

| Nom actuel | Où | Nom neuf | Tests et banc |
|---|---|---|---|
| Cache API `tracker-tuiles`, en-tête `x-tracker-saved-at` | `platform/tileCache.ts:134`, `:135` | `gtracker-tuiles`, `x-gtracker-saved-at` | `platform/tileCache.test.ts:90` ; banc `satellite.mjs:67`, `vignettes.mjs:155-161` |
| Cache API `tracker-vignettes` | `platform/previewStore.ts:45` (commentaire `:12`) | `gtracker-vignettes` | banc `vignettes-relance.mjs:5`, `:158` |
| Cache API `tracker-vignettes-images` | `platform/previewImages.ts:107` (commentaire `:14`) | `gtracker-vignettes-images` | banc `vignettes-relance.mjs:8`, `:83-84`, `:158` |
| base IndexedDB `tracker-memoire` et `id: 'tracker-memoire'` du sélecteur | `platform/memoryFolder.ts:203`, `:517` | `gtracker-memoire` | perd la poignée du dossier choisi sur le PC : à redonner une fois |
| Préférences Android `tracker.sons` | `TonePlayer.java:74` | `gtracker.sons` | `nativeConstants.test.ts` (à ajouter) |
| `window.trackerBack` (poignée du banc en développement) | `platform/backButton.ts:57`, `:61` | `gtrackerBack` | banc `tutoriels.mjs:8`, `:78`, `zoom-carte.mjs:19`, `:370`, `SCRIPTS.md:287`, `:326` |
| dossier temporaire du banc `tracker-banc` | `outils/banc/passe.mjs:39`, `fluidite-compile.mjs:12`, `outils/banc/LISEZMOI.md:30` | `gtracker-banc` | le cache « avant » du banc se refait une fois |
| ressources `tracker_colors.xml` (deux fichiers), couleur `tracker_background` | `android/app/src/main/res/values/tracker_colors.xml:4`, `values-night/tracker_colors.xml:5`, `res/values/styles.xml:20` ; commentaire `src/platform/systemBars.ts:8` | `app_colors.xml`, `app_background` (zone 8) | `src/theme/androidColors.test.ts:4`, `:17-18` |

Tests qui écrivent un ancien nom en dur (nombre de lignes ; ils importeront `STORAGE_KEYS` ou les constantes au lieu de recopier la chaîne) : `platform/storage.test.ts` (61), `library/settingsFile.test.ts` (20 ; `:39` a aussi `'tracker.profile'`, `'tracker.nav'`, clés fictives à renommer), `library/compat.reglages.test.ts` (13, supprimé au lot 306), `hooks/useSessionLibrary.perte.test.ts` (12), `hooks/useSessionLibrary.resumes.test.ts` (12), `recording/journal.test.ts` (6), `library/sessionBundle.test.ts` (5), `platform/heartRate.test.ts` (5, `:257-295`), `hooks/useSessionLibrary.memoire.test.ts` (4), `platform/memoryFolder.test.ts` (4), `hooks/createStore.test.ts` (3), `hooks/useRunnerProfile.test.ts` (3), `hooks/useSportSettings.store.test.ts` (3, `:46`), `library/reconcile.test.ts` (3), `theme/androidColors.test.ts` (3), `core/imuFile.reference.test.ts` (2, fait au lot 321), `hooks/useSportSettings.test.ts` (2), `library/compat.formats.test.ts` (2), `library/restingHrStore.test.ts` (2), `library/settingsImport.guard.test.ts` (2, supprimé au lot 306), `planning/routeRecord.test.ts` (2), `hooks/sessionLibrary/incoming.test.ts` (1), `hooks/useMarkGuide.test.ts` (1), `hooks/useRecorder.test.ts` (1), `hooks/useSessionLibrary.balayage.test.ts` (1), `hooks/useSportSettings.guard.test.ts` (1, supprimé au lot 306), `hooks/useVisibleStatSessions.test.ts` (1), `library/compat.fiche.test.ts` (1), `platform/tileCache.test.ts` (1), `recording/gpxWriter.test.ts:29` (`not.toContain('tracker:accuracy')` : écrire `':accuracy'`), `test/settings0461.fixture.ts` (1, supprimé au lot 306), `theme/theme.test.ts:7` (1).

**3. Libellés visibles qui disent « Tracker »** (texte vu par l'utilisateur ou par un serveur ; « Tracker » → « Gtracker » sauf mention)
- `src/platform/location.ts:383` · titre de la notification du service GPS `notificationTitle: 'Tracker'` (montré avant la première réécriture par la notification d'enregistrement).
- `src/hooks/useRecorder.ts:614` · `notificationTitle: 'Tracker enregistre'` → « Gtracker enregistre ».
- `android/…/RecordingNotificationPlugin.java:51` · titre par défaut `"Tracker"` (jamais montré : le TS passe toujours un titre, `liveNotification.ts:41-58`).
- `android/…/IncomingFilePlugin.java:258` · toast « Tracker n'a pas pu recevoir ce fichier. » (fichier reçu refusé).
- `src/components/AboutSettings.tsx:95` · « Tracker s'appuie sur ces composants… » ; banc `outils/banc/apropos.mjs:114` dans le même commit.
- `src/components/PermissionsStatus.tsx:168`, `:169` · « Tracker peut enregistrer écran éteint », « Tracker a besoin de ce qui suit ».
- `src/components/MemoryStatus.tsx:175` (« Tracker garde vos sessions… »), `:203`, `:210`, `:229` (« ouvrez Tracker dans Chrome ou Edge »), `:228` (« créez-le dans Documents, sous le nom Tracker » : contredit déjà `:143-144`, `:170`, `:176`, `:202` qui disent « Gtracker »).
- `src/components/SettingsFiles.tsx:83`, `:84` · « (Tracker › reglages) » → « (Gtracker › reglages) » (le dossier s'appelle bien `Gtracker`, `MEMORY_FOLDER_NAME`, `memoryFolder.ts:182`).
- `src/hooks/sessionLibrary/deviceSettings.ts:387` · « … n'est pas un fichier de réglages de Tracker. ».
- `src/hooks/sessionLibrary/incoming.ts:65` (« Tracker n'a pas pu le lire »), `:132`, `:170` (« Tracker le garde et réessaiera ») ; tests `incoming.test.ts:175`, `:202`, `:227`.
- `src/platform/memoryFolder.ts:715` · `READ_ONLY_MEMORY_MESSAGE` (« Ce dossier vient d'une version plus récente de Tracker », montré par `MemoryStatus.tsx:11`, `incoming.ts:5`, `:42`).
- `src/library/recordText.ts:8` (`FUTURE_RECORD_WARNING`), `:12` (`READ_ONLY_MEMORY_WARNING`) ; tests `recordText.test.ts` ; banc `outils/banc/miseajour.mjs:152` dans le même commit.
- `src/pages/SessionLibrary.tsx:625` · aide du navigateur (« Tracker n'envoie rien sur internet », « pendant que Tracker est ouvert ») ; la phrase sur les fichiers `.fit` du même texte reste (porte d'import).
- `src/tutorials/lessons.ts:190` (leçon « Sauts et pumping » : « Tracker s'en sert… »), `:204` (leçon « Partager et exporter » : « Tracker le relit tout entier »).
- `src/library/folderLayout.ts:53-90` · `LISEZMOI.txt` écrit dans le dossier mémoire (table ci-dessus).
- `public/licences-hors-js.json:26` · licence du logo, affichée dans Réglages › À propos (`AboutSettings.tsx:83`) : « reproduit ici pour la version de Tracker proposée à GONG » → « reproduit dans Gtracker avec l'accord de GONG SUP » ; changer ensemble `outils/licences-hors-js.mjs:49` (qui écrit ce fichier) et `src/core/licenses.test.ts:26`, `:144-195`.
- `capacitor.config.ts:22` · agent envoyé avec chaque tuile OpenStreetMap `Tracker/${version} (+https://github.com/segneur34)` → `Gtracker/${version} (+…)` ; adapter `src/platform/capacitorConfig.test.ts:24-29` (l'expression impose `^Tracker\/…segneur34\)$`). Le contact reste jusqu'au lot 308 (question ci-dessous).
- `src/core/xml.ts:27-28` · `creator` (table ci-dessus) : visible dans Strava, Garmin et tout lecteur d'un GPX exporté.

**4. Commentaires qui disent « Tracker »** (repris ici pour que la garde soit complète à la fin du lot ; O2 les laissait au 307, qui ne garde que les renvois « lot N », « Qnn »)
- `src/theme/tokens.css:2` (« Direction artistique de Tracker »).
- `src/assets/logo/gong-symbol.svg:1`, `src/assets/logo/gong-logo-full.svg:1`, `public/favicon.svg:1` (« reproduit pour la version de Tracker proposée à GONG »).
- `src/platform/incomingFile.ts:6` ; `src/components/IncomingFileNotice.tsx:14` ; `src/hooks/sessionLibrary/incoming.ts:13`, `:25` (« Ouvrir avec Tracker », « Partager vers Tracker », « itinéraire de Tracker »).
- `src/platform/memoryFolder.ts:15-16` (schéma `Tracker/`, `tracker.json`, `reglages.json`), `:238-239`, `:338`, `:348` (« dossier `Tracker` », « Documents/Tracker ») ; `:443`, `:469` sont au lot 306 (B14).
- `src/planning/routeImport.ts:8`, `:15`, `:17`, `:58` (« Partager vers Tracker », « itinéraire de Tracker », « GPX de Tracker »).
- `src/hooks/routeFiles.ts:67` (« la fiche en extension pour Tracker »).
- `src/library/folderLayout.ts:6-7` (schéma).
- `android/app/src/main/AndroidManifest.xml:30`, `:47`, `:60` (« Ouvrir avec Tracker », « Tracker apparaît… », « Tracker est proposé », « Partager vers Tracker »).
- `IncomingFilePlugin.java:39`, `:125` ; `MemoryFolderPlugin.java:95`, `:573`, `:620-621` (« dossier Tracker », `primary:Documents/Tracker/sessions`, `home:Tracker`).
- Commentaires qui citent une clé : listés dans la table des clés.

**5. Tests et faux dossiers qui disent « Tracker »**
- `src/test/memoryFolder.fixture.ts:23` (`label: 'Tracker'`) ; `hooks/useSessionLibrary.balayage.test.ts:35` ; `hooks/useSessionLibrary.perte.test.ts:59`, `:124`, `:276` (« version future de Tracker »), `:510`.
- `src/platform/memoryFolder.test.ts:18`, `:22`, `:30`, `:36`, `:67`, `:90` ; `src/platform/memoryFolder.realisations.test.ts:58`, `:155` ; `src/platform/errorText.test.ts:30` (`Missing file for primary:Documents/Tracker`).
- `src/platform/androidManifest.test.ts:131` (« Tracker ne se propose pas pour tout ») ; `src/platform/capacitorConfig.test.ts:24`, `:25`, `:29`.
- `src/planning/routeImport.test.ts:50`, `:73` ; `src/library/previewTracks.test.ts:43-44` ; `src/hooks/sessionLibrary/importer.fit.test.ts:210`.
- `src/core/gpxParser.corpus.test.ts:37-55` (`trackerEntry()`, « sortie de l'enregistreur de Tracker »), `:49`, `:144` · renommer en « GPX d'un enregistreur de la même famille » ; l'entrée reste (porte des fichiers sans fiche).

**6. Noms de fichiers**
- `outils/lancer-tracker.bat` → `outils/lancer-gtracker.bat` ; commentaires `:2`, `:4`, titre de fenêtre `:10` (« Tracker - serveur » → « Gtracker - serveur ») ; fins de ligne CRLF fixées par `.gitattributes`, à garder.
- `outils/icone-tracker.ico` → `outils/icone-gtracker.ico` ; références `outils/logo/icones-android.mjs:66`, `:107`.
- `outils/LISEZMOI.md:3` · « ouvre Tracker », « port 5173 » (faux : 5174, `vite.config.ts:11`), « Tracker - serveur », raccourci « Tracker », `icone-tracker.ico` → textes Gtracker.
- `android/app/src/main/res/values/tracker_colors.xml`, `values-night/tracker_colors.xml` → `app_colors.xml` (table ci-dessus).
- (Les deux dossiers `…/io/github/segneur/tracker` changent au lot 323.)

**7. Banc à adapter dans ce lot** (D3 ; 58 fichiers d'`outils/` citent un ancien nom, 216 lignes)
- D'abord centraliser dans `outils/banc/lib/cdp.mjs` : `export const DOSSIER_MEMOIRE = 'Gtracker'` (aujourd'hui `'Gtracker'` écrit à la main dans 24 scripts, `cdp.mjs:276-279`) et les clés (`CLES.sections`, `CLES.sportSettings`… recopiées de `appIdentity.ts`, qu'un script `.mjs` ne peut pas importer sans le crochet `charge-ts`). Puis remplacer dans chaque script.
- Fichiers et nombre de lignes : `reglages.mjs` 25, `SCRIPTS.md` 13, `prereglages.mjs` 13, `balises.mjs` 8, `onglets.mjs` 7, `statistiques.mjs` 7, `donnees.mjs` 6, `partage.mjs` 6, `boucle.mjs` 5 (part au 304), `cardio.mjs` 5, `materiel.mjs` 5, `reduire.mjs` 5, `satellite.mjs` 5, `tutoriels.mjs` 5, `vignettes-relance.mjs` 5, `denivele-direct.mjs` 4 (part au 304), `familles.mjs` 4, `fc-repos.mjs` 4, `icones.mjs` 4, `lib/onglets.mjs` 4 (`:3-4`, `:14-27`, `:30`), `notification.mjs` 4, `racine.mjs` 4, `vignettes.mjs` 4, `activite.mjs` 3, `allure-session.mjs` 3, `imports.mjs` 3, `library2.mjs` 3, `planning.mjs` 3, `reglages-aide.mjs` 3, `test-fcrepos.mjs` 3, `vides.mjs` 3, `apropos.mjs` 2, `bench.mjs` 2, `library.mjs` 2, `materiel-fin.mjs` 2, `miseajour.mjs` 2, `racine-periodes.mjs` 2, `sauts.mjs` 2, `surface.mjs` 2 (part au 304), `survol.mjs` 2, `zoom-carte.mjs` 2, `banc/LISEZMOI.md` 2, `outils/LISEZMOI.md` 2, `logo/icones-android.mjs` 2, `barre.mjs` 1, `classer.mjs` 1, `fluidite.mjs` 1, `fluidite-compile.mjs` 1, `graphes.mjs` 1, `notes.mjs` 1, `passe.mjs` 1, `planification-verrou.mjs` 1, `profil.mjs` 1, `rename.mjs` 1, `shots.mjs` 1, `surf.mjs` 1, `docs-cites.mjs` 1, `imu-reference.mjs` 1 (lot 323).
- Textes : `apropos.mjs:114`, `miseajour.mjs:152` (avec `src/`) ; `sauts-diagnostic.mjs:45`, `virages-diagnostic.mjs:71` (« pas un fichier des capteurs de Tracker »).
- `outils/docs-cites.mjs:33` · `'Tracker/'` → `'Gtracker/'` (`'tracker.json'` de `:34` changé au lot 321).
- `outils/banc/LISEZMOI.md:30` (`tracker-banc`), `:79` (chemin du poste `D:/gong tracker/Gtracker/node_modules` → `<dépôt>/node_modules`, D3 §4).
- Le reste de la remise du banc sur la voile et le surf (jeux de données, `lib/traces.mjs`, ports `5173`) est au lot 330.

**8. Garde permanente** (fin du lot)
- `src/heritage.test.ts` (nom proposé par D3 G1 ; le lot 327 y ajoutera les mots de la terre) : lit les fichiers suivis par git (`git ls-files`, ou `readdirSync` comme `src/architecture.test.ts:70-74`) sous `src/`, `android/app/src/`, `outils/`, `public/`, plus `capacitor.config.ts`, `index.html`, `android/app/build.gradle`, `android/.gitignore` ; seulement les fichiers texte (`.ts`, `.tsx`, `.css`, `.mjs`, `.cjs`, `.js`, `.java`, `.xml`, `.json`, `.md`, `.bat`, `.html`, `.svg`, `.gradle`) ; refuse `/(?<![gG])tracker/i`.
- Exceptions nommées : `src/library/legacyImport.ts`, `src/library/legacyImport.test.ts`, `src/test/legacyImport.fixture.ts`. Exceptions temporaires, retirées au lot 323 : `io.github.segneur.tracker` et `io/github/segneur/tracker` (paquet Java et ses citations), étiquettes de journal `Tracker[A-Z]\w+`, `signingConfigs.tracker`, `android/.gitignore:56`.
- Compléter `src/core/appIdentity.test.ts` (table entière figée).

### Pièges

- **Ordre** : 306 avant 322 (sinon on renomme des clés, tests et jeux d'essai qu'on supprime ensuite) ; 321 a déjà renommé fiche, paquet, capteurs et marqueur.
- **Banc** : une clé oubliée côté banc ne casse rien, le script injecte dans une clé que plus rien ne lit et « passe » sur des valeurs par défaut. Toujours `--scripts-par-cote` (chaque côté avec ses scripts), et relire les `check` des scripts qui posent des réglages (`reglages`, `prereglages`, `familles`, `onglets`, `cardio`).
- Les tests de `memoryFolder.test.ts` utilisent `Tracker` comme nom de dossier dans des chemins fictifs ; ils n'éprouvent pas le dossier d'origine (doute b13 de D4 levé). En passant à `Gtracker`, relire chaque attendu : un faux dossier nommé comme `MEMORY_FOLDER_NAME` peut changer le chemin pris par `shouldDescendIntoMemory` (`memoryFolder.ts:240-246`) ou `isMemorySubfolder` (`:258-261`).
- Les clés qui voyagent (`sportSettings`, `runnerProfile`) sont aussi les clés de `values` des fichiers `reglages/<appareil>.json` : renommer sans relire l'ancien est voulu (un fichier de Tracker n'est plus repris, lot 306).
- `useMapBase.ts:17-23`, `:54` : d'anciennes entrées `course`/`velo` sous l'ancienne clé restent sans lecteur dans le stockage d'un appareil ; rien à faire (zone 3 [B]).
- `src/planning/brouterProfile.ts:207` (« # Profil Tracker », envoyé à BRouter) part avec le fichier au lot 304 ; si le 304 passe après ce lot, l'ajouter aux exceptions temporaires de la garde.
- `src/pages/RecordingPage.tsx:515` (« en courant », classé [L] par la zone 5) est un reste de la terre : lot 325. `src/core/activities.ts:19` (« §10, point 53 ») est un renvoi d'historique : lot 307.
- Les écrans de démarrage `res/drawable*/splash.png` et `assets/splash.png` (ancien écran de Tracker, signalés « binaire » par H2) sont remplacés au lot 311 ; la garde ne lit que les fichiers texte.
- `public/licences-hors-js.json` est écrit par `outils/licences-hors-js.mjs` (`writeFileSync`) et contrôlé par `core/licenses.test.ts` : changer les trois ensemble, sinon le test échoue.
- Données du PC de développement : réglages de Firefox (`localhost:5174`), tuiles, vignettes et poignée du dossier repartent de zéro ; sans enjeu.
- Les documents (`docs/ETAT_DU_PROJET.md` §6.2 `:248-294` liste les clés `tracker.*`, `docs/INVENTAIRE.md`, `CLAUDE.md`) ne sont pas dans ce lot : lot 331 (ou 308).

### Vérification

- `npx tsc -b --force`, `npm run verif` (dont `src/heritage.test.ts` et `src/core/appIdentity.test.ts`).
- `npx vitest run src/library/summaryFrozen.test.ts src/library/legacyImport.test.ts` vert ; ajouter au cas (e) de `legacyImport.test.ts` : un paquet écrit par Gtracker se relit (aller-retour) et ne contient plus « tracker ».
- Java : depuis `android/`, `gradlew.bat testDebugUnitTest assembleDebug`.
- Banc complet, chaque côté avec ses scripts : `node outils/banc/passe.mjs --tous --scripts-par-cote -j 1 --sans-cache` ; changements de texte attendus : « Tracker » → « Gtracker » (À propos, mémoire, notifications).
- Recherche de contrôle (attendu : seules les lignes du lot 323) :
  `rg -n -i -P "(?<![gG])tracker" src android/app/src outils public capacitor.config.ts index.html android/app/build.gradle android/.gitignore --glob '!**/legacyImport*' --glob '!**/*.png' --glob '!**/*.ico'`
- Noms de fichiers (attendu : les deux dossiers Java seulement, lot 323) : `find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./android/app/build -o -path ./android/.gradle \) -prune -o -iname "*tracker*" ! -iname "*gtracker*" -print`.

### Questions liées

- **Quel contact mettre dans l'agent envoyé à OpenStreetMap avec chaque tuile ?** (zones 7 et 8, fiche 152) · Par défaut : le nom passe à `Gtracker/<version>` dans ce lot, le contact (`https://github.com/segneur34`, identité du vendeur) reste jusqu'au lot 308, qui le remplace par celui de l'acheteur · Change : OpenStreetMap exige un contact ; le retirer sans le remplacer enfreint sa politique.
- **Faut-il fixer le préfixe `gtracker.` avant de réécrire le banc ?** (D3, doute 8) · Par défaut : oui, ce lot passe avant le lot 330 · Change : sinon les 58 scripts sont réécrits deux fois.

---

## Lot 323 · Identité Android et clé de signature

**But.** Gtracker devient pour Android une application nouvelle, sans « tracker » ni ancienne clé : identifiant d'application, paquet Java, `namespace`, `appId`, étiquettes de journal et clé de signature neuve. C'est fini quand `gradlew.bat clean testDebugUnitTest assembleRelease` passe, que l'APK 0.00.06 s'installe sous le nouvel identifiant et que la garde du lot 322 n'a plus d'exception temporaire.
**Taille** petit (≈ 17 fichiers déplacés, ≈ 40 lignes) · **Modèle** Sonnet / high (mécanique, contrôlé par Gradle et JUnit ; D4 proposait Opus / medium, O2 retient Sonnet / high) · **Risque** moyen (un `package` oublié : greffon non enregistré, l'application démarre sans capteurs ; contrôlé par `nativeConstants.test.ts` et par l'APK).
**Avant** : 322 ; réponses de l'utilisateur sur l'identifiant et la clé (questions ci-dessous) ; la clé neuve créée par l'utilisateur · **Après** : 308 (APK de livraison), 324 (suppression des APK 0.00.01 et 0.00.05) · **Avant la première APK** : **oui, obligatoire** (changer l'identifiant ou la clé après = désinstaller, données du téléphone perdues).

### À faire

**Identifiant et paquet** (valeur par défaut : `io.github.segneur.gtracker`, question 1)
- `android/app/build.gradle:31` · `applicationId "io.github.segneur.tracker.voile"` → nouvel identifiant.
- `android/app/build.gradle:28` · `namespace = "io.github.segneur.tracker"` → nouveau paquet (garder `namespace` et `applicationId` indépendants, zone 8).
- `capacitor.config.ts:10` · `appId` → nouvel identifiant ; `:7` (« `docs/ETAT_DU_PROJET.md` §12 ») : relire le renvoi, le garder s'il décrit toujours l'emballage Android, sinon le retirer.
- `android/app/src/main/res/values/strings.xml:5`, `:6` · `package_name`, `custom_url_scheme` : nouvelle valeur (V2 : aucun code ne les lit ; si le lot 325 les a retirés, rien à faire).
- Déplacer `android/app/src/main/java/io/github/segneur/tracker/` (15 fichiers : `BeeperPlugin`, `DownloadsPlugin`, `GnssPlugin`, `HeartRatePlugin`, `ImuWriter`, `IncomingFilePlugin`, `MainActivity`, `MemoryFolderPlugin`, `MotionPlugin`, `PermissionsPlugin`, `RecordingNotificationPlugin`, `RecoveryPlugin`, `ScreenPlugin`, `ShareFilePlugin`, `TonePlayer`) et `android/app/src/test/java/io/github/segneur/tracker/` (`ImuFormatTest.java`, `ImuReference.java`) par `git mv` ; changer la ligne `package` (`:1`) de chacun des 17.
- Citations du chemin Java : `src/platform/beeper.ts:47`, `heartRate.ts:81`, `memoryFolder.ts:315`, `motion.ts:53`, `notification.ts:27`, `permissions.ts:17` (commentaires) ; `src/platform/nativeConstants.test.ts:38` (chemin lu) ; `src/core/imuFile.reference.test.ts:173` (chemin lu) ; `outils/imu-reference.mjs:17` (`PAQUET`), `:36` (classe `…ImuReference`). Relire `nativeConstants.test.ts:144`, `:165` (comparaisons de paquet du service GPS) après le déplacement.

**Étiquettes de journal** (visibles par `adb logcat`)
- `BeeperPlugin.java:42`, `:93` (`TrackerBeeper`) ; `DownloadsPlugin.java:75`, `:76` (`TrackerDownloads`) ; `HeartRatePlugin.java:117`, `:118` (`TrackerHR`) ; `IncomingFilePlugin.java:64` (`TrackerRecu`) ; `MainActivity.java:17` (`TrackerRendu`) ; `MotionPlugin.java:40` (`TrackerMotion`), `:90` (fil `TrackerCapteurs`) ; `RecoveryPlugin.java:23` (`TrackerRecovery`) ; `ShareFilePlugin.java:71`, `:72` (`TrackerShare`) → `Gtracker…` ; les commandes `adb logcat -s …` des commentaires (`DownloadsPlugin.java:75`, `HeartRatePlugin.java:117`, `ShareFilePlugin.java:71`) suivent ; `src/platform/heartRate.ts:27` (renvoi à `TrackerHR`).

**Clé de signature** (D4 e5, question 2)
- L'utilisateur crée une clé neuve (`keytool`, procédure de `docs/DEVELOPPER.md`), alias `gtracker`, fichier hors de `C:\Users\segne\tracker-signing\`, et met à jour `android/keystore.properties:1-4` (fichier ignoré par git, jamais livré ; aujourd'hui `storeFile=C:/Users/segne/tracker-signing/tracker-release.jks`, `keyAlias=tracker`, commentaire « Signature des APK de Tracker »).
- `android/app/build.gradle:44` · `signingConfigs.tracker` → `signingConfigs.gtracker` (zone 8 proposait `release`) ; `:55` (debug) et `:58` (release) suivent. Les APK de débogage sont signées de la même clé.
- `android/.gitignore:56` · « Clé de signature et mot de passe de Tracker » → « … de Gtracker ».
- `android/keystore.properties.exemple` : déjà neutre, rien à faire.

**Nom de l'APK**
- `android/app/build.gradle:63-65` produit déjà `Gtracker-<version>.apk` : rien à changer. Construire la **0.00.06** (version posée avant la construction) ; ne jamais installer la 0.00.05 (ancien identifiant, anciens formats, ancienne clé).

**Garde**
- Retirer de `src/heritage.test.ts` les exceptions temporaires du lot 322.

### Pièges

- **Ce qui casse, et pourquoi c'est gratuit aujourd'hui** : un nouvel identifiant est une autre application pour Android (Preferences, droit d'accès au dossier mémoire, dossier privé, notifications et autorisations séparés) ; une autre clé interdit d'installer par-dessus une APK signée de l'ancienne. Aucune APK Gtracker n'étant installée, rien n'est perdu ; le dossier `Documents/Gtracker` et ses sessions, s'il existe, restent et se rouvrent. Après la première installation, ces deux changements coûtent une désinstallation et les données de l'appareil.
- Le manifeste et le partage suivent l'identifiant tout seuls : `AndroidManifest.xml:77` (`android:authorities="${applicationId}.fileprovider"`) et `ShareFilePlugin.java:59` (`getContext().getPackageName() + ".fileprovider"`), `PermissionsPlugin.java:75` (`getPackageName()`) ; doute de D4 levé, aucune chaîne en dur.
- `MainActivity` enregistre les greffons par classe (`registerPlugin(…)`) : un fichier dont le `package` n'a pas changé ne compile plus dans le nouveau dossier, Gradle le dit ; `nativeConstants.test.ts` lit les sources par leur chemin.
- Après le déplacement, lancer `npx cap sync android` (le dossier `android/app/src/main/assets/public/` est une copie de construction, ignorée par git, qui se régénère).
- L'identifiant par défaut garde le pseudo du vendeur (`segneur`) : c'est son identité, à remplacer par celle de l'acheteur au contrat (lot 308), pas un lien avec l'ancien projet.
- `clore/SKILL.md:62` (`dumpsys package io.github.segneur.tracker.voile`), `docs/ETAT_DU_PROJET.md:477`, `:479-482`, `docs/DEVELOPPER.md:41`, `docs/INVENTAIRE.md:182-184`, `docs/BACKLOG.md:15` et les mémoires de Claude citent l'ancien identifiant ou l'ancienne clé : lots 318, 331 et 324.

### Vérification

- Depuis `android/`, `gradlew.bat clean testDebugUnitTest assembleRelease` (chemin complet de `gradlew.bat` entre guillemets, mémoire `apk-chemins-poste`).
- `npm run verif` (garde `heritage` sans exception temporaire).
- Recherches à zéro : `rg -n "segneur\.tracker|segneur/tracker|signingConfigs\.tracker|\"Tracker[A-Z]" android src outils capacitor.config.ts --glob '!android/app/build/**' --glob '!android/app/src/main/assets/**'` ; `rg -n "applicationId|namespace" android/app/build.gradle` sans `tracker` ; `keytool -list -v -keystore <nouveau .jks>` montre un alias qui n'est pas `tracker`.
- À la première installation : `adb shell dumpsys package <nouvel identifiant>`.
- Un essai au téléphone : enregistrer 2 min avec les capteurs (sauts), puis « Ouvrir avec » un GPX ; l'analyse s'ouvre et l'onglet des sauts est là (greffons bien enregistrés).

### Questions liées

- **Nouvel identifiant d'application ?** (D4 question 1) · Par défaut : `io.github.segneur.gtracker`, à remplacer par celui de l'acheteur au contrat ; le paquet Java suit · Change : figé à la première installation.
- **Clé de signature : en créer une neuve ?** (D4 question 2) · Par défaut : oui, neuve, avant la première installation ; vous gardez le mot de passe · Change : sinon l'acheteur ne peut pas en hériter proprement (elle signe aussi Tracker).
- **Attendre la fin des lots 321 à 323 pour installer la première APK (0.00.06), et ne pas installer la 0.00.05 ?** (O2 question 7) · Par défaut : oui · Change : sinon chaque renommage demande une migration des données du téléphone. Nuance de l'orchestrateur (question 1 de l'en-tête) : l'identifiant changeant au lot 323, la 0.00.05 peut servir de version d'essai jetable si elle est désinstallée, et son dossier `Documents/Gtracker` supprimé, avant la 0.00.06.

---

## Lot 324 · Coupure hors du code

**But.** Retirer les liens avec l'ancien projet qui ne sont pas dans le code : droits de `.claude/settings.json`, règle « Tracker complet en lecture seule » de `CLAUDE.md`, en-tête de `docs/BACKLOG.md`, identité git, mémoires de Claude, carte `D:\gong tracker\LISEZMOI.md`, archives `atelier\`, réglages globaux. C'est fini quand les contrôles hors Grep de la liste finale sont faits et que la recherche hors dépôt (étape 4 de la liste) ne rend rien.
**Taille** petit · **Modèle** Sonnet / medium pour les lignes de texte (agent `doc` ou conversation) ; les mémoires de Claude se réécrivent en conversation, à la demande de l'utilisateur ; le reste est fait par l'utilisateur · **Risque** faible (seul risque : retirer la protection de Tracker sans la recopier dans les réglages personnels).
**Avant** : 320 à 323 pour les phrases qui décrivent l'état (« aucune donnée d'une autre application n'est relue, sauf… ») · **Après** : 308 (commit orphelin de livraison) · **Avant la première APK** : non (sauf la suppression des vieilles APK, après le lot 323).

Qui : **vous** = l'utilisateur, à la main ; **doc** = un lot de texte (Sonnet / medium) ; **Claude** = réécrit en conversation sur demande (mémoires).

### À faire

**Droits et règles** (dans le dépôt)
- `.claude/settings.json:10-18` · supprimer le bloc `deny` (7 règles `:11-17` : `Edit`, `Write`, `NotebookEdit` sur `//c/Users/segne/tracker/**`, `Edit`, `Write` sur `~/.claude/plans/**`, `Edit`, `Write` sur `~/.claude/projects/c--Users-segne-tracker/**`) ; garder `allow` · **doc**, **après** que vous avez recopié ces refus dans `~/.claude/settings.json` (`permissions.deny`) si vous voulez garder la protection de Tracker (question 6).
- `CLAUDE.md:51` · supprimer la ligne entière « **Tracker complet en lecture seule.** … » (ne pas la reformuler) · doc.
- `CLAUDE.md:50` · « doublé d'un dépôt GitHub privé (`segneur34/Tracker`) » → « dépôt git ; envoi sur GitHub après accord », sans nom de dépôt · doc.
- `docs/BACKLOG.md:3` · retirer la parenthèse « (numéros à part de ceux de Tracker complet : une correction commune se note dans les deux) » · doc (et `node outils/backlog.mjs` après).
- `docs/BACKLOG.md:11` · remplacer la ligne par : « **Ce dépôt est la version voile et surf destinée à la vente.** La terre (course, vélo, Entraînement) et le planificateur routier en partent (fiche 154, E2 à E8) ; aucune donnée d'une autre application n'est relue, sauf le chargement d'une session de voile ou de surf venue d'un fichier GPX (lots 320 et 321) ; dépôt GitHub privé. » · doc.
- Les autres lignes du BACKLOG qui citent Tracker (`:15`, `:17`, `:18`, `:21`, `:33`, `:34`, `:43`, `:49`, `:55`, textes proposés par D4 §3.2) et `docs/backlog/318-atelier-fable-52.md:21`, `:85` : lot 331 et lot 318 (compléments).

**Git**
- `.git/config` · `user.name = Tracker`, `user.email = tracker@users.noreply.github.com` → `git config user.name "Gtracker"` et un e-mail `noreply` neutre · **vous** (une commande ; à faire avant le prochain commit).
- Historique : 14 commits signés `Tracker <tracker@…>` · le commit orphelin du lot 308 les efface ; **vérifier son auteur avant de l'envoyer** · vous, à la livraison.
- `git remote -v` : `origin https://github.com/segneur34/Gtracker.git` · propre, rien à faire. `.github/workflows/verif.yml` · propre.

**Mémoires de Claude** (hors dépôt, chargées dans chaque session ; à réécrire par Claude à votre demande, en retirant toute comparaison avec Tracker et en gardant rythme et pièges du poste)
- `C:\Users\segne\.claude\projects\d--gong-tracker\memory\MEMORY.md:2` · « origine Tracker et ~/.claude/plans intouchables (copier ici) », « mémoires séparées à garder » → retirer.
- `…\d--gong-tracker\memory\projet-gtracker-vente-gong.md:3` (« version voile et surf de Tracker », « origine intouchable »), `:11` (« copie de Tracker 1.0.0 du 08/11, identifiant `io.github.segneur.tracker.voile` »), `:15`, `:19` (Tracker complet dans `C:\Users\segne\tracker`, « ne jamais y toucher ni dans `~/.claude/plans` », « celle de Tracker complet qui continue sa vie ») → réécrire, ou supprimer le fichier (question 5).
- `…\d--gong-tracker\memory\feedback-agents-economes.md:11` et `…\D--gong-tracker-Gtracker\memory\feedback-agents-economes.md` · « (et Tracker) » → retirer (le poids « Fable ≈ 2,5 × Opus » est déjà au lot 318).
- `…\D--gong-tracker-Gtracker\memory\MEMORY.md:1` (« copie de Tracker 1.0.0 du 08/11, liens avec Tracker complet »), `:10` (« à part de Tracker ») → une ligne chacune, sans Tracker.
- `…\D--gong-tracker-Gtracker\memory\point-de-reprise-gtracker.md:3`, `:8` (« copie de Tracker 1.0.0 (commit `deee974`…) », renvoi à `D:\gong tracker\atelier`), `:10` (« Différences avec Tracker », « installable à côté de Tracker », « **Même clé de signature que Tracker** (clé dans `C:\Users\segne\tracker-signing\`) »), `:12` (« Rythme (le même que Tracker) »), `:14`, `:16` (« Mémoires de l'utilisateur : … `Documents/Tracker`, `D:\memoire Tracker\essais\` », session Claude ouverte sur Tracker en même temps, « Les mémoires coexistent… `c--Users-segne-tracker` », « une correction commune se refait à la main des deux côtés ») → réécrire ; mettre à jour l'identifiant et la clé après le lot 323.
- `…\D--gong-tracker-Gtracker\memory\edition-sources-jamais-via-powershell.md:3`, `:11` (« Sur Tracker… les sources de `c:\Users\segne\tracker` ») → garder la règle d'encodage, sans le chemin.
- `…\D--gong-tracker-Gtracker\memory\banc-de-test-chrome.md:11` (« le banc de Tracker sur 4191 »), `:13` (lien mort `[[point-de-reprise-cible-mobile]]`) → retirer la phrase, corriger le lien.
- `…\D--gong-tracker-Gtracker\memory\version-sur-deux-chiffres.md:8` (« à part de Tracker (1.0.0) ») → retirer.
- À garder : `optimisation-tokens-a-faire.md:17` (`C:\Users\segne\.local\bin`), `apk-chemins-poste.md` (JAVA_HOME, ANDROID_HOME) : chemins d'outils, pas de l'ancien projet. Hors périmètre : `c--Users-segne-tracker` (la mémoire de Tracker, gardée pour Tracker).
- Le `MEMORY.md` du dossier parent est injecté dans toute session ouverte depuis `D:\gong tracker` : le mettre à jour avant de rouvrir une session là.

**Carte et archives hors dépôt**
- `D:\gong tracker\LISEZMOI.md:1` (« la version voile et surf de Tracker »), `:3` (« Le dépôt complet de Tracker reste dans `C:\Users\segne\tracker` »), `:7` (« copie de Tracker 1.0.0 », ancien identifiant), `:8` (« à installer à côté de Tracker »), `:11-14` (description des quatre dossiers `atelier\`), `:16` (« copies d'origine … dans `~/.claude/plans/` ») → réécrire la carte sans l'ancien dépôt, après le rangement d'`atelier\` · doc (hors dépôt).
- `D:\gong tracker\atelier\revue-2710\` (20 fichiers, revue de code de Tracker) · sortir du dossier de travail ; retirer ses renvois (`.claude/agents/lot.md:20`, `:26` au lot 318, ETAT §12 au lot 331) · vous + doc.
- `D:\gong tracker\atelier\archives\` (anciens A-FAIRE, ESSAIS, file des lots de Tracker) · sortir ; renvois d'ETAT et INVENTAIRE au lot 331 · vous + doc.
- `D:\gong tracker\atelier\fork-0811\` (procédure de copie : cite `C:\Users\segne\tracker`, `git archive`) · sortir · vous.
- `D:\gong tracker\atelier\audit-vente-0111\` (audit de Tracker complet avant le fork) · **garder** tant que les fiches 151 à 154 renvoient à `angle-X1.md`, `angle-V1.md` ; le copier hors du dossier de vente avant la livraison · vous.
- `D:\gong tracker\atelier\revue-1111\` (cette revue) · même sort que l'audit : garder jusqu'à la fin des lots qui y renvoient, puis sortir · vous.
- `D:\gong tracker\Gtracker-0.00.01.apk`, `Gtracker-0.00.05.apk` · ancien identifiant, clé de Tracker : supprimer après le lot 323 · vous.

**Réglages globaux** (`~/.claude/settings.json`, non lu par la revue)
- Recopier, si vous le voulez, les refus d'écriture dans `C:\Users\segne\tracker`, `~/.claude/plans`, `~/.claude/projects/c--Users-segne-tracker` (question 6) · vous.
- `docs/MODELES.md:48`, `:65-69` décrivent ces réglages comme les vôtres : retirer « communs à Tracker complet » là où un document le dit (318 `:21`) · doc (lot 318).
- `.claude/settings.local.json` absent, `.claude/worktrees/` ignoré : rien.
- Les autres liens de `.claude/` (chemins `D:\gong tracker\Gtracker` en dur dans les dix agents et commandes, `clore/SKILL.md:61-62`, `:84`, adb et numéro de série du téléphone, `lot.md:20`, `:26`) : lot 318 (compléments).

### Pièges

- Retirer les `deny` du dépôt **sans** les recopier dans vos réglages personnels laisse une session ouverte dans Gtracker libre d'écrire dans `C:\Users\segne\tracker` et `~/.claude/plans`. Ordre : recopier d'abord, retirer ensuite.
- Renommer le dossier `D:\gong tracker` change le dossier de mémoire de Claude (`~/.claude/projects/D--gong-tracker-Gtracker`) : il faudrait recopier les fichiers de mémoire (question 4).
- Ne pas sortir `atelier\audit-vente-0111\` ni `revue-1111\` trop tôt : les fiches de `docs/backlog/` y renvoient.
- Une mémoire de Claude se modifie par Claude, à votre demande ; pas par un lot de code ni par un agent.

### Vérification

- Les contrôles hors Grep et la recherche hors dépôt de la liste finale ci-dessous (étapes 3 et 4).
- `node outils/backlog.mjs` après l'édition du BACKLOG ; `npm run verif` après celle de `CLAUDE.md`.

### Questions liées

- **Tracker est-il toujours installé sur le téléphone, pour les essais côte à côte ?** (D4 question 3) · Par défaut : oui, garder, mais sans citer Tracker dans les textes du dépôt (« l'autre application ») · Change : l'essai 201 (« à côté de celle de Tracker ») reste possible ou est retiré.
- **Faut-il renommer le dossier `D:\gong tracker` ?** (D4 question 4) · Par défaut : non (c'est le dossier de travail, pas l'ancien projet) · Change : renommer oblige à recopier la mémoire de Claude, et la recherche hors dépôt doit alors exclure « gong tracker » (voir la liste finale).
- **Que faire de la mémoire du dossier parent `d--gong-tracker` (3 fichiers, doublon de celle de Gtracker) ?** (D4 question 5) · Par défaut : la réécrire sans Tracker et la garder ; rien supprimé sans votre accord.
- **Garder la protection d'écriture contre Tracker ailleurs ?** (D4 question 6) · Par défaut : oui, la recopier dans `~/.claude/settings.json`, que vous modifiez à la main.
- **Les archives `atelier\` (1,9 Mo, tout sur Tracker) : sortir ou supprimer ?** (D4 question 7) · Par défaut : sortir de `D:\gong tracker` vers un dossier personnel, ne rien supprimer.

---

## Liste de contrôle : plus aucun lien avec l'ancien projet

À dérouler après les lots 320 à 324 **et** les lots de texte qui portent le reste (318 compléments pour `.claude/`, 331 pour `CLAUDE.md` et `docs/`, 308 pour `README.md`, `HISTORIQUE.md`, l'identité du vendeur et le commit orphelin, 311 pour l'écran de démarrage, 304 pour `brouterProfile.ts`). Tout doit rendre **zéro**. Aucun Grep ne voit `~/.claude` ni les mémoires : d'où les contrôles 3 et 4. Origine : D4 §5, adaptée à la porte du lot 321.

**1. Contenu du dépôt** (depuis `D:\gong tracker\Gtracker`)
```
rg -n -i -P "(?<![gG])tracker|C:[\\\\/]+Users[\\\\/]+segne|\.claude[\\\\/]plans|segneur34/Tracker|application complète|appli complète|application d'origine|version complète|dans les deux BACKLOG|\bcorrection commune\b" --glob "!node_modules" --glob "!dist" --glob "!.git" --glob "!package-lock.json" --glob "!android/app/build" --glob "!android/.gradle" --glob "!android/app/src/main/assets/public" --glob "!android/keystore.properties" --glob "!**/legacyImport*" .
```
Exclusions, toutes voulues : dépendances et sorties de construction (`node_modules`, `dist`, `android/app/build`, `android/.gradle`, la copie `android/app/src/main/assets/public` régénérée par `npx cap sync`) ; `package-lock.json` (noms et adresses de paquets) ; `android/keystore.properties` (ignoré par git, jamais livré ; il cite `C:/Users/segne/…` jusqu'à la clé neuve) ; les trois fichiers de la porte (`src/library/legacyImport.ts`, `src/library/legacyImport.test.ts`, `src/test/legacyImport.fixture.ts`), seuls autorisés à écrire les anciens noms et, pour le jeu d'essai, l'adresse `segneur34/Tracker` produite par le code d'origine. `Gtracker`/`gtracker` ne sont pas trouvés (regard en arrière). Le chemin `D:\gong tracker` est trouvé (« tracker » précédé d'une espace) : il doit avoir disparu du dépôt (`.claude/` au lot 318, `outils/banc/LISEZMOI.md:79` au lot 322). Les fichiers binaires (`*.png` de l'écran de démarrage, lot 311) sont sautés par `rg`.
Contrôle plus étroit de la porte (O2) : `rg -n "segneur34/Tracker" src outils android/app/src --glob '!src/test/legacyImport.fixture.ts'` → 0 (la porte lit le préfixe, jamais l'adresse).
La garde permanente `src/heritage.test.ts` (lots 322 et 323) refait le contrôle du code à chaque `npm run verif`.

**2. Noms de fichiers et de dossiers** (dépôt)
```
find . \( -path ./node_modules -o -path ./.git -o -path ./dist -o -path ./android/app/build -o -path ./android/.gradle \) -prune -o -iname "*tracker*" ! -iname "*gtracker*" -print
```
Attendu : vide. Aujourd'hui : `outils/lancer-tracker.bat`, `outils/icone-tracker.ico`, `android/app/src/main/res/values/tracker_colors.xml`, `android/app/src/main/res/values-night/tracker_colors.xml` (lot 322), `android/app/src/main/java/io/github/segneur/tracker`, `android/app/src/test/java/io/github/segneur/tracker` (lot 323).

**3. Identité, hors Grep**
- `rg -n "applicationId|namespace" android/app/build.gradle` : aucun `tracker` (lot 323).
- `git log --format='%an %ae' | sort -u` : aucun `tracker` (vrai seulement après le commit orphelin du lot 308) ; `git config user.name`, `git config user.email` : plus `Tracker`, plus `tracker@users.noreply.github.com` (lot 324).
- `git remote -v` : `segneur34/Gtracker` seulement.
- `keytool -list -v -keystore <nouveau .jks>` : l'alias n'est pas `tracker` ; `android/keystore.properties` ne pointe plus dans `C:\Users\segne\tracker-signing\` (lot 323).
- `adb shell pm list packages | findstr segneur` sur le téléphone : la nouvelle application sous le nouvel identifiant ; aucune APK Gtracker sous `io.github.segneur.tracker.voile`.

**4. Hors dépôt** (à la main, une fois les mémoires réécrites et `atelier\` rangé)
```
rg -n -i -P "(?<![gG])(?<!gong )(?<!gong-)tracker|C:[\\\\/]+Users[\\\\/]+segne[\\\\/]+tracker|\.claude[\\\\/]plans" "D:\gong tracker\LISEZMOI.md" "D:\gong tracker\gong" "C:\Users\segne\.claude\projects\D--gong-tracker-Gtracker\memory" "C:\Users\segne\.claude\projects\d--gong-tracker\memory"
```
Attendu : vide. Le motif écarte « gong tracker » et « gong-tracker » (nom du dossier de travail, gardé si la question 4 du lot 324 reçoit la réponse par défaut) ; sans ces deux exclusions, le contrôle de D4 §5 ne peut jamais tomber à zéro. `D:\gong tracker\atelier\` est exclu une fois sorti du dossier ; `C:\Users\segne\.claude\projects\c--Users-segne-tracker` (mémoire de Tracker) est hors périmètre.
- `~/.claude/settings.json` : contient les refus d'écriture vers Tracker si vous avez choisi de les garder (lot 324, question 6) ; `.claude/settings.json` du dépôt n'en a plus.
- `D:\gong tracker\` : plus de `Gtracker-0.00.01.apk` ni `Gtracker-0.00.05.apk`.

**5. Mémoires de Claude : phrases qui doivent avoir disparu** (détail au lot 324)
- Dossier `d--gong-tracker` : `MEMORY.md:2` ; `projet-gtracker-vente-gong.md:3`, `:11`, `:15`, `:19` ; `feedback-agents-economes.md:11`.
- Dossier `D--gong-tracker-Gtracker` : `MEMORY.md:1`, `:10` ; `point-de-reprise-gtracker.md:3`, `:8`, `:10`, `:12`, `:14`, `:16` ; `edition-sources-jamais-via-powershell.md:3`, `:11` ; `banc-de-test-chrome.md:11`, `:13` ; `version-sur-deux-chiffres.md:8` ; `feedback-agents-economes.md` (« (et Tracker) »).

---

# Partie B · Le code (lots 314 + 315, 325 à 329, suppressions écartées, bon à savoir)

---

## Lot 314 + 315 · Foil gardé au changement d'activité ; « Bateau » activité de départ

**But** : une session passée d'une activité foil à une activité sans foil (Voile → Bateau, Surf foil → Surf) prend le foil de sa nouvelle activité, et « Bateau » existe dès l'installation, au calcul `bateau`. On verra que c'est fini quand une session de voile passée en Bateau n'affiche plus ni case Foil, ni « Temps en vol », ni ligne « Pumping » au partage, et qu'une session de Surf foil passée en Surf compte des vagues.
**Taille** petit · **Modèle** Sonnet / high (bug avec scénario, la vérification compte) · **Risque** faible (≈ 6 lignes dans `applyRecordPatch`, une entrée de `DEFAULT_ACTIVITIES`, une devinette pure).
**Avant** : aucun (le 305 est fait) · **Après** : 326 (F2 renomme `treatmentChanged` dans les mêmes lignes de `record.ts`) · **Avant la première APK** : oui pour le 315 (une activité de départ ajoutée après une installation demanderait une graine de version, mécanisme que le 306 retire) ; non pour le 314.

Demande d'origine : `docs/BACKLOG.md:38` (314, « un bateau affiche « Temps en vol » au lieu de « Temps en mouvement » … résultat attendu : « Temps en mouvement » pour un bateau, partout (analyse et image de partage) ») et `docs/BACKLOG.md:39` (315, « « Bateau » comme activité de départ, à côté de « Voile », avec le calcul bateau et la nuance de voile »). Analyse complète : `D:\gong tracker\atelier\revue-1111\O4-pertinence-defauts.md`, §0.

### Ce que le code dit (vérifié le 11/11)

- Le libellé « Temps en vol » ne sort qu'avec un seuil d'activité : `src/pages/SailingModule.tsx:331` (`const activeTimeWord = foil ? 'Temps en vol' : 'Temps actif'`) et `:344-346`, `:378-383` (montrés seulement si `hasActiveThreshold`) ; `src/library/shareStats.ts:126` (`label: foil ? 'Temps en vol' : 'Temps actif'`) et `:133`. Le calcul `bateau` n'a pas de seuil (`src/core/sportProfiles.ts:634` `withoutActiveThreshold`, `:671`). **Une session au calcul `bateau` ne peut donc pas afficher « Temps en vol »** ; « Temps en mouvement » n'existe dans aucun libellé de `src/` (un bateau n'a que « Temps total »).
- **Cause A (celle qui explique l'écran décrit)** : l'activité « Bateau » de l'utilisateur a été créée dans Réglages, et le formulaire part sur le premier calcul de la famille : `src/pages/SettingsPage.tsx:1091` (`useState<SportType>(familySports('voile')[0])`, soit `wingfoil`), alors que l'icône se devine du nom (`src/core/activityIcons.ts:54`, motif `bateau|voilier|dériveur|deriveur|catamaran|moth|laser|optimist|régate|regate` ; `SettingsPage.tsx:1125`). L'activité ressemble à un bateau mais calcule en wingfoil, foil coché par défaut (`sportProfiles.ts:606`) : « Temps en vol », « Distance en vol », « Ratio de vol », onglet « vols », et un seuil de 8 nœuds (un bateau à 5 nœuds a 0 de temps actif).
- **Cause B (défaut réel, quelle que soit A)** : le foil de la fiche survit au changement d'activité et de calcul.
  - `src/hooks/useRecorder.ts:567-569` écrit le foil de l'activité dans chaque fiche enregistrée (`effectiveFoil` rend un booléen pour toute voile et tout surf) → `importer.ts:42` → `newRecord.ts:68` `analysis.foil`.
  - Changer l'activité : `src/hooks/useLibraryNavigation.ts:46-50` n'écrit que `{ sport, activityId }` ; `applyRecordPatch` (`src/library/record.ts:1188-1207`) remet à `null` `activeThreshold` et `waveThreshold` (et `speedRange` d'une famille à l'autre) au changement de calcul, **ni `foil` ni `pumping`** ; un changement d'activité au même calcul n'efface rien.
  - Le module lit `foil = edits.foil ?? activityFoil` (`SailingModule.tsx:202`) : le foil de la fiche gagne.
  - Effets en bateau : case Foil cochée, champs « Foil » et « Mât » au matériel (`SailingModule.tsx:738`), ligne « Pumping » sur l'image de partage (`shareStats.ts:67`), « % de vol » d'un bateau dans Statistiques (`library/stats.ts:370`), « hors vol » dans les manœuvres (`components/sailing/ManeuversPanel.tsx:191`).
  - Même défaut en surf, plus grave : « Surf foil » → « Surf » (même calcul) garde `analysis.foil: true` (`SurfModule.tsx:170-172`, `summaryOptions.ts:80`) : la session reste comptée en vols au lieu de vagues (nombre de vagues, plus longue vague, résumé, Statistiques).

### À faire

Étape 1, le foil suit l'activité (cause B) :
- `src/library/record.ts:1186-1208` · dans `applyRecordPatch`, quand `activityChanged || sportChanged`, remettre `analysis.foil` et `analysis.pumping` à `null` (le réglage de la nouvelle activité s'applique), comme le seuil · ≈ 6 lignes. Attention : la comparaison `cleared … !== next.analysis…` (`:1201-1204`) ne regarde que trois champs : y ajouter `foil` et `pumping`, sinon l'objet effacé n'est pas retenu. Le recalcul suit déjà (`resummarize` vrai sur `activityChanged || sportChanged`, `:1217`).
- `src/library/record.test.ts` (bloc `describe('applyRecordPatch')`, `:537`) · ajouter : (a) fiche `{ sport: 'wingfoil', analysis.foil: true, analysis.pumping: true }` + patch `{ sport: 'bateau', activityId: null }` → `foil: null`, `pumping: null` ; (b) fiche `{ sport: 'surf', activityId: 'a-surf-foil', analysis.foil: true }` + patch `{ activityId: 'surf' }` → `foil: null`, `resummarize: true` ; (c) patch qui ne change ni activité ni calcul → `foil` gardé. Les tests `:558-576` restent verts (ils partent de `foil: null`).
- `src/library/summaryOptions.ts` (en-tête) · écrire en quelques lignes qui l'emporte pour le foil : activité (Réglages), `analysis.foil` de la fiche (case de l'onglet réglages de la session), résumé porté (`summary.activitySettings` / `optionsKey`, `record.ts:852-879`), relus par `sessionFoil`, `sessionActivitySettings`, `carriedSettings`, `summaryOptions` ; et quand le foil de la fiche s'efface (changement d'activité ou de calcul) · ≈ 8 lignes de commentaire.
- Garde de non-régression (O4) · un test qui parcourt `SAILING_SPORTS` et vérifie qu'un calcul sans seuil (`hasActiveThreshold` faux) ne produit jamais `activeTime` dans `summaryShareStats`, foil ou non (à poser dans `src/library/shareStats.test.ts`).

Étape 2, l'ajout d'activité ne part plus sur Wingfoil en silence (cause A) :
- `src/pages/SettingsPage.tsx:1091` et `:1096` (`pickFamily`) · deviner le calcul du nom, avec la même table que l'icône (`src/core/activityIcons.ts:47-56`, `NAME_ICON`) : `bateau|voilier|dériveur|deriveur|catamaran` → `bateau`, `kite` → `kite`, `planche|windsurf|windfoil` → `windsurf`, `wing` → `wingfoil` ; le sélecteur « calcul » reste modifiable et montre la devinette dès que le nom change. Fonction pure à côté de `guessActivityIcon` (même fichier), testée dans `src/core/activityIcons.test.ts` (nom → calcul, famille respectée : un nom de voile en famille surf rend le premier calcul du surf) · ≈ 10 lignes + test. Variante possible : ne rien pré-choisir et exiger le choix (voir Questions).

Étape 3, « Bateau » activité de départ (315) :
- `src/core/activities.ts:92-96` · ajouter à `DEFAULT_ACTIVITIES`, juste après Voile : `{ id: 'bateau', name: 'Bateau', base: 'bateau', color: BASE_COLOR.bateau }` (`BASE_COLOR.bateau` = `FAMILY_SHADES.voile[1]`, nuance de voile, `:79`) ; réécrire le commentaire `:88-91` (« Voile, Bateau, et les deux du surf »).
- Pas de montée de `ACTIVITIES_VERSION` ni de graine (contrairement à la ligne 315 du BACKLOG) : aucune APK n'est installée, et le 306 retire ce mécanisme (`core/activities.ts:97-118`). Si le 306 n'est pas fait et qu'une APK a été installée entre-temps, revenir à la ligne du BACKLOG (graine de version 10).
- Tests à mettre à jour : `src/core/activities.test.ts:24` (liste `[['Voile','wingfoil'],['Bateau','bateau'],['Surf','surf'],['Surf foil','surf']]`), `:109-110` (ordre des noms après `insertActivity`), `src/core/activityIcons.test.ts:18` (`['wingfoil', 'bateau', 'surf', 'surf-foil']`) ; relancer `src/settings/activityPresets.test.ts` (O3 : la règle « une activité de départ qui a son pré-réglage le garde en entier » n'est plus éprouvée que par Surf foil ; vérifier que Bateau prend bien `BASE_PRESETS.bateau` via `presetOf`, `activityPresets.ts:65-66`).
- `CLAUDE.md` et `docs/DECISIONS.md` §11 · dire les quatre activités de départ (demande de la ligne 315).

Étape 4, « Temps en mouvement » pour un bateau (résultat attendu de la ligne 314, **si l'utilisateur le confirme**, voir Questions) :
- `src/pages/SailingModule.tsx:331-383` (onglet Général) et `src/library/shareStats.ts:120-135` (image de partage) · pour un calcul sans seuil, montrer une ligne « Temps en mouvement » tirée du temps en mouvement déjà calculé (`summary.inMotionS` côté partage, déjà lu par `flightRatioValue`, `shareStats.ts:127`) ; À VÉRIFIER côté module : quel champ des statistiques de séance porte ce temps (ne pas recalculer). Aucun chiffre du résumé ne change (`summaryFrozen` intact).

### Pièges

- Ne pas proposer de migration des fiches déjà touchées : la case Foil de l'onglet réglages de la session la décoche (O4 §0, point 3).
- Le foil est lu à « Analyser » et non au départ (`useRecorder.ts:567-568`) : c'est le lot 329 (avec le 313), pas celui-ci.
- `record.ts:1192` `treatmentChanged` sera renommé `familyChanged` au 326 (F2) : faire le 314 avant, ou reprendre les mêmes lignes.
- Les identifiants réels : l'activité « Surf foil » a l'id `a-surf-foil` (`core/activities.ts:86`), pas `surf-foil` (O4 l'écrit ainsi par erreur).
- Le banc : `familles`, `reglages`, `prereglages` comptent ou listent les activités de départ ; avec Bateau en plus, leurs relevés changent (attendu, à dire au passage du banc ; ces scripts sont de toute façon à réécrire au 330).

### Vérification

- `npx vitest run src/library/record.test.ts src/library/summaryOptions.test.ts src/library/shareStats.test.ts src/core/activities.test.ts src/core/activityIcons.test.ts src/settings/activityPresets.test.ts src/hooks/useSessionLibrary*.test.ts` ; `npx vitest run src/library/summaryFrozen.test.ts` identique sans refigeage.
- Banc : `node outils/banc/passe.mjs general brouillon-voile --avant HEAD -j 1 --sans-cache`.
- Recherche de contrôle : `rg -n "familySports\('voile'\)\[0\]" src` → 0.
- Essai au téléphone (un seul) : une session enregistrée en « Voile » passée en « Bateau » → ni case Foil cochée, ni ligne Pumping au partage, pas de « Temps en vol » ; « Surf foil » → « Surf » → vagues comptées ; « Bateau » présent dans Réglages dès l'installation.

### Questions liées

1. Votre session de bateau est-elle rangée au calcul `wingfoil` (une activité « Bateau » créée sur Wingfoil) ? · défaut : oui, c'est la seule explication du libellé · si oui, l'étape 2 et la correction à la main de votre activité (choisir le calcul Bateau dans sa carte, ou la recréer) règlent l'écran ; les sessions se corrigent en les repassant sur l'activité.
2. Une session changée d'activité prend-elle le foil de sa nouvelle activité (proposé) ou garde-t-elle celui du jour ? · défaut : celui de la nouvelle activité · l'étape 1 suppose cette réponse.
3. Voulez-vous une ligne « Temps en mouvement » pour un bateau (elle n'existe pas aujourd'hui : un bateau n'a que « Temps total ») ? · défaut : oui, c'est le résultat attendu écrit au 314 · décide l'étape 4.
4. À l'ajout d'une activité, deviner le calcul d'après le nom (proposé) ou obliger à le choisir ? · défaut : deviner, choix modifiable · change l'étape 2.

---

## Lot 325 · Restes morts de la terre et de l'Entraînement, hors coupure

**But** : retirer de `src/`, `android/` et du banc tout ce qui ne sert plus à rien en voile ni en surf et qui n'est pas une relecture d'anciennes données (ce dernier point est le 306) : altitude calculée pour rien, allure en min/km, « course à bornes », temps estimé, exports, props, classes, textes et commentaires qui racontent la terre. On verra que c'est fini quand les recherches de contrôle de chaque sous-lot rendent 0 et que `src/library/summaryFrozen.test.ts` est resté identique à l'octet sans refigeage.
**Taille** gros (dix sous-lots de taille petite, chacun une session Sonnet) · **Modèle** Sonnet / medium par défaut, Sonnet / high pour 325b, 325c, 325d et 325e (chaînes à défaire, tests à réécrire) · **Risque** faible (code sans lecteur, vérifié par les contre-vérifications V1 et V2 ; le compilateur guide).
**Avant** : rien d'obligatoire ; ordre conseillé dans chaque sous-lot · **Après** : 327 (gardes (c) « aucune allure » et (e) « vocabulaire de la terre » attendent 325c et 325j), 326 (moins de surface) · **Avant la première APK** : non (aucun format de fichier ni clé de stockage ne change, sauf 325h « en-tête `.imu` », à faire après le 321).

Sources : constats [A] et [C] des huit rapports de zone, `H1-orphelins.md`, `O3-relecture-305.md`, filtrés par `V1-verification-zones-1-3-6.md` et `V2-verification-zones-2-4-5-7-8.md` (tous sous `D:\gong tracker\atelier\revue-1111\`).

### Découpage

| Sous-lot | Sujet | Modèle |
|---|---|---|
| 325a | Dénivelé de la trace suivie (Enregistrer) | Sonnet / medium |
| 325b | Altitude calculée pour rien ; D+ sur l'eau sous condition | Sonnet / high |
| 325c | Allure en min/km et profil de marche gelé des tests | Sonnet / high |
| 325d | « Course à bornes » de l'alerte cardiaque | Sonnet / high |
| 325e | Champs sans lecteur (types, profils, points de trace) | Sonnet / high |
| 325f | Temps estimé des itinéraires, Overpass, `wayMatch` | Sonnet / medium |
| 325g | Textes visibles et commentaires qui racontent la terre | Sonnet / medium |
| 325h | Fonctions, exports, props, CSS, icônes, constantes, Android | Sonnet / medium |
| 325i | Tests et jeux d'essai qui ne couvrent plus que la terre | Sonnet / medium |
| 325j | Noms hérités de la terre (`useRunnerProfile`, `train-*`…) | Sonnet / medium |

Ordre conseillé : 325f (avant que le 304 ne retouche `PlanningPage`), 325a, 325b, 325d, 325c, 325e, 325h, 325i, 325j, 325g en dernier (les commentaires des fichiers déjà retouchés auront disparu avec leur code).

### Hors de ce lot (ne pas le refaire ici)

Ces constats des zones sont rangés ailleurs ; les citer ici pour éviter le double emploi :
- **Lot 306** (coupure des relectures, O2 blocs B1 à B15) : migrations de réglages (`main.tsx:19-20,46-65`, `useSportSettings.ts:85-99,124-176,358,371,391,510-513`, `activitySettings.ts:120-137,165-171,194-196,292-305,313-369,738`, `activityPresets.ts:68-69`, `core/activities.ts:97-118,238-291`) ; ancien `reglages.json` (`deviceSettings.ts:189-201,251-291`, `settingsFile.ts:19-22,262-275`, `folderLayout.ts:26-27`, `reconcile.ts:2,111`) ; `REMEMBERED_CHOICES` (`settingsFile.ts:215-223`) ; notes d'avant le dossier (`summarySettings.ts:134-139`, `newRecord.ts:19-20,52`, `record.ts:972-989`) ; `FORMER_TAB_KEYS` (`useOpenSections.ts:30-45`) ; routes `App.tsx:80-84,110-119` et route `*` ; `GUARDED_FIELDS`, `RECORD_READER_VERSION`, `libraryCache.ts` ; **champs terre de la fiche et du résumé** (`record.ts:156-169,206-217,420-448,14-27,239,245-247,489-499,296-301,318-329,564,593,597-612,386-396,404,413-416,902,904,997-1000,1098-1099,1180`, `sessionEdits.ts:20-21,82-86`) ; `hrZones` (`athleteProfile.ts:64-66,135,166,179`, `core/heartRate.ts:107-109,169-178`, `useRunnerProfile.ts:86`) ; `restingHrStore.ts:35` ; la phrase visible `SessionLibrary.tsx:690` ; tests et jeux d'essai de compatibilité (`useSportSettings.guard.test.ts`, `settings0461.fixture.ts`, `settingsImport.guard.test.ts`, `compat.reglages.test.ts`, `compat.fiche.test.ts:126-160`, `familyRecords()` de `record.fixture.ts`, blocs terre de `record.test.ts`, `useVisibleStatSessions.test.ts:59-70` avec le commentaire `useVisibleStatSessions.ts:14-18`, `useSessionLibrary.perte.test.ts:684-712`, `libraryCache.test.ts:17-31`). Le défaut O3 « fiche de la terre périmée réécrite sans calcul » (`summaryOptions.ts:112-114`) est aussi au 306.
- **Lot 304, avec le planificateur** (O2 B12) : champs `surfaces`, `terrainElevation`, `elevationSource` de la fiche (`record.ts:392-394,906-911,925-927,1100-1105,1148-1167,1215`, `recordMerge.ts:147`) et leurs déclencheurs de recalcul (défaut O3 « couture 301 à 303 », `record.ts:914,944`) ; `FOLLOWED_TRACE_ELEVATION_TOLERANCE_M`, `eleM`, `simplifyAlongElevation` (`followedTrace.ts:107,118-130`) ; `ElevationProfileMini`, `routeProfileChart`, `gradeGradientDefs`, prop `gradient` de `TrackChart`, `HighlightPath`/`highlightColors` ; `grade.ts`, `segmentGrid.ts` ; les fonctions de boucle calculée de `route.ts` ; la branche `!markCourse` de `PlanningPage.tsx:1149-1187` ; la leçon « Planifier un parcours » (`tutorials/lessons.ts:142-153`) ; les trois autres valeurs neutres de `useSportSettings.ts:306-316` (`effectiveLoopReturnRatio`, `effectiveGradeRange`, `effectiveWayTypes`).
- **Lot 321** (porte d'import) : `FOREIGN_TYPES` (`naming.ts:46-84`), `FIT_SPORT_NAMES` et commentaires de `fitToGpx.ts:16,41,46`, `creator="Tracker"` (`core/xml.ts:27-28`), `setup.cadence` de l'en-tête `.imu` (`imuFile.ts:69-71,179`, `ImuReference.java:31`), cas « à classer » des tests (`addSession.test.ts:162-168`, `useSessionLibrary.balayage.test.ts:91`, `naming.test.ts:31-35`, `fitToGpx.test.ts:69,145-170`).
- **Lot 322** (renommage) : tout libellé, clé ou format « Tracker », dont le `LISEZMOI.txt` du dossier (`folderLayout.ts:53-90`, qui contient aussi « séances du compteur, barre du bas », `:68,71-73`), `useRecorder.ts:614`, `recordText.ts:8,12`, `lessons.ts:190,204`, `SessionLibrary.tsx:625`. **Lot 323** : `strings.xml:5-6` (`package_name`, `custom_url_scheme`). **Lot 307** : simples renvois « lot N », « Qnn » (`styles.xml:12`, `androidManifest.test.ts:8-9`, titres « A-B1 » de `sessionStats.test.ts`).
- **Lot 326** : drapeaux toujours vrais et tables égales (O1 §2.3), dont `SessionLibrary.tsx:99-104` (branche `else` morte avec son « D+ »), `thresholdHelp`, `usesMarkCourse`, `PLANNING_FAMILIES`, `TRACK_COLOR_SMOOTHING_S`, `hrEnergy` non nul, `StatSession.treatment`, `FAMILY_PHOTO`, `banner?`, `tabDefaults`. **Lot 328** : exports et API de test de `sailing/` et `surfing/`, défauts « wingfoil ».

---

### 325a · Dénivelé de la trace suivie (Enregistrer)

Toute la chaîne est figée par `const elevationOffered: boolean = false;` (`src/pages/RecordingPage.tsx:723`, seule affectation).

#### À faire
- `src/pages/RecordingPage.tsx:723-728` · retirer `elevationOffered`, `elevationShown`, `pageRef`, `phoneUpright`, `mapFit`, l'appel `useRecMapFit(pageRef, mapFit)` · appelants : la page seule · ≈ 6 lignes
- `src/pages/RecordingPage.tsx:721-722` · retirer le commentaire (« Dénivelé de la trace suivie : à terre seulement (course, vélo)… ») · 2 lignes
- `src/pages/RecordingPage.tsx:279-306` · retirer `useRecMapFit` (et son doc `:282`, classe `rec-page--fit`) ; aux imports `:3`, retirer `useLayoutEffect` et `RefObject` s'ils n'ont plus d'usage · ≈ 28 lignes
- `src/pages/RecordingPage.tsx:799` · `className={mapFit ? … : 'ui-page rec-page'}` → `className="ui-page rec-page"`, retirer `ref={pageRef}` · 1 ligne
- `src/pages/RecordingPage.tsx:277` · `RECORDING_SECTION_DEFAULTS = { carte: true }` (retirer `denivele`) ; `:610` type `useOpenSections<'carte'>` · 2 lignes
- `src/pages/RecordingPage.tsx:991-993` · retirer le bouton « Dénivelé » (`{elevationOffered && (<Button …>Dénivelé</Button>)}`) · 3 lignes
- `src/pages/RecordingPage.tsx:1016` · retirer `hoverPoints={elevationShown && followed ? followedProfile(followed).rows : undefined}` ; `:410`, `:416`, `:451` · retirer la prop `hoverPoints` de `RecordingMap` ; `RecordingMap` est le seul à la passer à `LiveMap` (vérifié le 11/11), donc retirer aussi `src/components/LiveMap.tsx:53` (type), `:187` (paramètre), `:246` (`{hoverPoints && <HoveredTrackMarker …/>}`) ; `HoveredTrackMarker` reste (lu par `AnalysisBaseLayers`) · ≈ 7 lignes
- `src/pages/RecordingPage.tsx:1021` · retirer le montage `<FollowedElevation …>` · 1 ligne
- `src/pages/RecordingPage.tsx:11` et `:58` · retirer les imports `FollowedElevation` et `followedProfile` ; `:39` retirer `useNarrowScreen` de l'import si `:726` était son seul usage (`usePhoneLandscape` reste, `:712`)
- `src/pages/RecordingPage.tsx:87-88` · réécrire le doc (« À terre, « Dénivelé » ouvre son profil sous la carte… (`FollowedElevation`) ») : ne garder que la phrase sur la voile · 2 lignes
- `src/components/FollowedElevation.tsx` (fichier entier, 122 lignes) · supprimer · seul importeur : `RecordingPage.tsx:11` ; il est aussi le seul lecteur de production de `effectiveGradeRange` hors `PlanningPage` (`FollowedElevation.tsx:9,82`, la fonction reste pour le 304)
- `src/recording/followedProfile.ts` (77 lignes) et `src/recording/followedProfile.test.ts` (128 lignes) · supprimer · importeurs de production : `FollowedElevation.tsx:10` et `RecordingPage.tsx:58` seulement (V1 et V2 : pas « tests seuls » au sens strict, mais derrière la constante fausse) ; `remainingGainM`, `followedAltitudeAt`, `hasFollowedElevation` : tests seuls
- `src/pages/RecordingPage.css:32-54` et `:99-134` · blocs `.rec-elevation`, `--rec-elevation-h`, `.rec-page--fit`, `.rec-elevation__gain` (`:129`) · supprimer (seul `FollowedElevation.tsx:65-117` porte ces classes) · ≈ 60 lignes (lignes exactes : V2 ; la zone 5 disait `:30-54` et `:96-134`, relire les bornes)
- `outils/banc/denivele-direct.mjs` (script entier : `.rec-elevation`, `.rec-elevation__gain`, bouton « Dénivelé », `:99-121,190,289-292,341-350,437`) · supprimer, avec son entrée `outils/banc/scripts.mjs:60` et son paragraphe `outils/banc/SCRIPTS.md:31`

#### Pièges
- NE PAS retirer `useRouteProfileChart`, `ElevationProfileMini`, `routeProfileChart` : encore importés par `PlanningPage.tsx:15,25,525` (ils partent au 304).
- La clé `denivele` reste dans l'état mémorisé `recording` des appareils de développement : ignorée sans erreur.

#### Vérification
- `npx tsc -b --force` (imports orphelins), `npx vitest run src/recording src/pages`.
- `rg -n "FollowedElevation|followedProfile|elevationOffered|elevationShown|rec-elevation|rec-page--fit|denivele" src outils` → 0.
- Banc : `node outils/banc/passe.mjs balises --avant HEAD -j 1 --sans-cache` (Enregistrer avec un itinéraire suivi, texte identique hors bouton « Dénivelé », qui n'était jamais montré).

---

### 325b · Altitude calculée pour rien ; D+ sur l'eau (sous condition)

Première partie, sans condition : le calcul d'altitude que personne ne lit.

#### À faire
- `src/recording/liveStats.ts:81-84`, `:101-103`, `:193`, `:271`, `:300-324`, `:305-348`, `:1`, `:6` · retirer `LiveStats.elevationGainM`, `elevationLossM`, `recentGainM`, le calcul par segment (`computeElevationStats`, `accumulateElevation`, `withEle`, bloc `hasElevation`) et l'import de `MIN_ELEVATION_COVERAGE` · appelants : aucun lecteur (`liveFields.ts` ne lit que `currentSpeedMs…heartRate…legs`, `LiveFieldKey` `:22-25` sans dénivelé ; Grep des trois noms : leurs seules définitions) · ≈ 45 lignes ; c'est aussi le défaut O3 n° 3 (calcul inutile à chaque position dès que le GPS donne l'altitude)
- `src/recording/liveStats.ts:17-18` et `:30-32` · corriger les commentaires (« tops de voile et du D+ récent » → « tops de voile ») ; `recentWindowS` reste (tops)
- `src/recording/liveStats.test.ts:85-113` · retirer les tests de `elevationGainM`, `elevationLossM`, `recentGainM` ; garder l'équivalence mémoire/sans mémoire sur les autres chiffres
- `src/core/types.ts:152-159` · retirer `BaseSessionStats.elevationGain`, `elevationLoss`, `elevationMin`, `elevationMax`, `hasElevation` · lecteurs de production : aucun (les `hasElevation` de `PlanningPage.tsx:526,1064` et `ProfilePage.tsx:176` sont des variables locales) · ≈ 8 lignes
- `src/core/sessionStats.ts:1-2`, `:242-245`, `:265`, `:273`, `:285-289` · retirer les options `elevation` et `elevationStats` de `BaseSessionStatsOptions`, l'appel `computeElevationStats(…)` et les imports `ELEVATION_PRESETS`/`ElevationProfile` · seul appelant : `src/sailing/sailingStats.ts:78`, qui passe déjà `elevationStats: EMPTY_ELEVATION` (`:86`, à retirer avec) ; le surf n'appelle pas `buildBaseSessionStats` (V1 : code mort, pas « travail inutile en surf » comme le disaient la zone 1 et O4) · ≈ 20 lignes
- `src/sailing/sailingStats.test.ts:58-63` · retirer le test « pas de dénivelé en voile » (il lit `stats.hasElevation` et `stats.elevationGain`, V1)
- `src/core/sportProfiles.ts:44-47` · retirer `ELEVATION_PRESETS.trail` (« pour mémoire et pour les tests », `:41-43`) · seul lecteur `src/core/elevation.test.ts:69-73` (à retirer avec) · ≈ 8 lignes
- `src/library/summary.ts:50-51`, `:176-177` · retirer l'option `SummaryOptions.elevation?: ElevationProfile` (jamais passée) ; garder `computeElevationStats(track, profile.elevation)` · ≈ 3 lignes
- `src/library/summaryOptions.ts:56-60` (`SessionElevation`), `src/library/summarizeGpx.ts:19-20`, `:33`, `:44-49` (champ `elevation` de `SummarizeGpxOptions`, jamais lu par `summarizeGpx`, destructuration `:62`) · retirer · c'est le défaut O3 n° 4 (jusqu'à quelques milliers de nombres envoyés au calculateur à chaque résumé) · appelants à retoucher : `summarizeGpxOptions` (`hooks/sessionLibrary/summaryQueue.ts`, `library/trackWorkerClient.ts`), forme du message `library/trackWorkerProtocol.ts` (à synchroniser) · ≈ 25 lignes
- `src/hooks/sessionLibrary/summaryQueue.ts:60-61` · retirer la comparaison de `terrainElevation`/`elevationSource` qui servait à `SessionElevation` (les champs eux-mêmes partent au 304, O2 B12)
- Tests : `src/library/summarizeGpx.test.ts:43-58`, `:96` ; `src/library/summaryFrozen.test.ts:63` (seule retouche permise de cette garde : retirer `elevation: null` des options ; les chaînes figées ne bougent pas) ; `src/hooks/sessionLibrary/summaryQueue.test.ts:95`
- `src/recording/followedTrace.ts:79-95` · retirer l'option `land` de `followedTraceFromSession` (et `smoothingM`, l'import `smoothElevationAlong`, `DEFAULT_IMPORT_SMOOTHING_M`) · unique appelant de production `src/components/FollowTracePicker.tsx:97` avec `{ land: false }` (à simplifier) ; tests `followedTrace.test.ts:420-443` à retirer · ≈ 12 lignes + ≈ 35 de test
- `src/core/sessionStats.ts:254-255` · `MIN_ELEVATION_COVERAGE` reste vivant (`library/summary.ts:6,194`) : après le retrait de `liveStats`, le déplacer dans `core/elevation.ts` (facultatif, V1 le reclasse en [C])

Seconde partie, **sous condition de la question 1** : le D+ des sorties sur l'eau.
- `src/library/stats.ts:240-242`, `:269-272` · ne plus cumuler `elevationGainM` ni compter `elevationSessions` pour les sessions de voile et de surf (toutes) ; la tuile du Profil se cache d'elle-même (`hasElevation`) · ≈ 5 lignes ; test `src/library/stats.test.ts` : sessions de voile avec D+ → `elevationSessions` 0
- `src/pages/ProfilePage.tsx:176`, `:219`, `:232-242` et `:41` · retirer la tuile « Dénivelé / D+ » et la variante `profile-figures--three` (CSS `src/pages/ProfilePage.css`) ; `src/library/stats.ts:50` (champ des totaux) avec
- `src/tutorials/lessons.ts:108` · leçon « Le Profil » : retirer « dénivelé » de « distance, dénivelé, sport préféré »
- Statistiques : rien à retirer. O1 dit le D+ montré aussi par Statistiques, mais `src/pages/StatisticsPage.tsx` ne lit aucune altitude (vérifié le 11/11 : `rg -n "elevation|D\+" src/pages/StatisticsPage.tsx` vide) ; seul le Profil l'affiche.
- **Garder** `elevationGainM` dans le résumé (`library/summary.ts:176-177,194`) : le retirer change le résumé, donc `SUMMARY_CALC_VERSION` (`record.ts:111`) et `summaryFrozen` ; or `SUMMARY_CALC_VERSION` doit rester 18 pour la porte d'import (O2). Son retrait est noté en « Bon à savoir ».

#### Pièges
- `summaryFrozen.test.ts` ne doit changer que d'une ligne (`:63`, option `elevation`) ; si une chaîne figée bouge, c'est une erreur.
- Le message vers le calculateur (`trackWorkerProtocol.ts`) change de forme : tester un résumé réel au banc (`general`), pas seulement les tests unitaires.
- NE PAS retirer `computeElevationStats`, `accumulateElevation`, `ElevationProfile`, `SportProfile.elevation` : le résumé (D+ de la fiche) et le planificateur (jusqu'au 304) les lisent encore.

#### Vérification
- `npx vitest run src/recording src/core src/library src/sailing` ; `npx vitest run src/library/summaryFrozen.test.ts` vert sans refigeage.
- `rg -n "elevationGainM|elevationLossM|recentGainM" src/recording src/pages` → 0 hors tests ; `rg -n "SessionElevation|land:" src/library src/components src/recording` → 0 ; `rg -n "ELEVATION_PRESETS.trail|elevationStats" src` → 0.
- Banc : `node outils/banc/passe.mjs general surf profil --avant HEAD -j 1 --sans-cache` (profil : tuile D+ absente si la question 1 est « retirer », sinon identique).

#### Questions liées
1. Le dénivelé (D+) d'une sortie sur l'eau n'est que du bruit du GPS : on le retire du Profil et des Statistiques ? · défaut : oui, on le retire (O1 Q2, O4, zones 1 et 5) · décide la seconde partie ; la valeur reste dans le résumé des fiches sans être montrée.

---

### 325c · Allure en min/km et profil de marche gelé des tests

`SAILING_UNITS`/`SURF_UNITS` (`src/settings/activitySettings.ts:33-34`) ne proposent jamais `minkm` ; seul un fichier de réglages repris pouvait le porter (`isKnownSpeedUnit`, `:286-287`, accepte toute clé de `SPEED_UNIT_LABEL`) : la machinerie « allure » est morte.

#### À faire
- `src/core/units.ts:13` · retirer `'minkm'` de l'union `SpeedUnit` ; le compilateur liste ensuite chaque `switch`
- `src/core/units.ts:55-77` · retirer `PACE_MIN_SPEED_MS` (`:56`, lu `:67` seul), `CHART_PACE_MIN_SPEED_MS` (`:58`) et `INTERVAL_PACE_MIN_SPEED_MS` (`:60`) (aucun lecteur hors `units.test.ts:216-218`), `msToPace` (`:67`, lu `:74`, `:89`), `formatPace` (`:73`, lu `:176`) et leurs commentaires `:57-60` · ≈ 25 lignes
- `src/core/units.ts:88-89`, `:102-103`, `:126`, `:152`, `:175-176`, `:192` · branches `minkm` de `toDisplaySpeed`, `fromDisplaySpeed`, `SPEED_UNIT_LABEL`, `SPEED_UNIT_SYMBOL`, `formatSpeed`, `formatSpeedValue` · ≈ 15 lignes
- `src/core/units.ts:223` · branche `unit === 'minkm'` de `knotsToChartValue` · 1 ligne (NE PAS retirer `knotsToDisplay`, voir Pièges)
- `src/core/units.ts:140-145` · `speedUnitLabel(unit)` et `speedUnitSymbol(unit)` perdent le paramètre `distanceUnit` ; `speedUnitSymbol` n'a d'appelant que `formatSpeed` (`:176`) ; appelants de `speedUnitLabel` : `components/SpeedGradientLegend.tsx:29`, `pages/SettingsPage.tsx:392,455`, `pages/StatisticsPage.tsx:412` (remplacer par `SPEED_UNIT_LABEL[unit]` si plus simple)
- `src/core/units.ts:156` `isInverseUnit` (toujours faux) · supprimer ; appelants : `pages/StatisticsPage.tsx:26,459` ; `recording/liveFields.ts:6,144,171` et ses étiquettes mortes « Allure », « Meilleure » (`liveFields.ts:147-149`)
- `src/core/units.ts:163` `editSpeedUnit` (identité) · supprimer ; appelants : `components/SpeedRangeEditor.tsx:3,32`, `pages/SettingsPage.tsx:14,370` (passer l'unité directement)
- `src/core/units.ts:180-187` `formatLandSpeed` (alias de `formatSpeed` qui force `distanceUnit`) · supprimer ; appelants restants à passer à `formatSpeed` : `library/shareStats.ts:3,117`, `pages/StatisticsPage.tsx:26,424,490,589` ; `pages/SessionLibrary.tsx:30,101` (la ligne `:101` part au 326 avec la branche morte : si le 326 n'est pas fait, remplacer) ; `pages/PlanningPage.tsx:42,1069` (part au 325f) ; le paramètre `distanceUnit` de `formatSpeed` disparaît
- `src/core/units.ts:57-60`, `:181-184`, `:291-292` · commentaires de l'allure, partent avec le code
- `src/components/SpeedRangeEditor.tsx:10` · doc « allure (min/km) se saisit en km/h » · réécrire
- `src/settings/activitySettings.ts:286-290` · `isKnownSpeedUnit` se ferme seul (plus de `minkm` dans `SPEED_UNIT_LABEL`) ; un fichier de réglages qui le porterait est écarté (voulu)
- Tests de `units` : `src/core/units.test.ts:55`, `:72-82`, `:110-120`, `:159-163`, `:172-173`, `:216-220`, `:231`, `:267-274` · retirer ce qui teste `minkm`, `formatPace`, `PACE_*`, `formatLandSpeed` ; **garder** `:27-31` (`knotsToDisplay`)
- Tests des chiffres du direct : `src/recording/liveFields.test.ts:10`, `:104`, `:116`, `:126`, `:172`, `:197`, `:224` (`minkm`, `isInverseUnit`) ; `src/recording/liveNotification.test.ts:43-46` (« parle d'allure en min/km ») · retirer ou réécrire en km/h
- `src/library/settingsImport.guard.test.ts:50` · cite `minkm` : le fichier entier part au 306 ; si le 306 n'est pas fait, retirer la ligne
- `src/test/walkProfile.fixture.ts` (32 lignes, seul `speedUnit: 'minkm'` en `:16`) · supprimer, et réécrire ses deux importeurs : `src/core/sessionStats.test.ts:7`, `:72-73` (et les cas `:100-235` « marche 5 km/h », « A-B1 », confirmation 3 s) ; `src/recording/liveStats.test.ts:14`, `:41-42` (≈ 15 usages de l'alias `running`) · réécrire sur un profil synthétique **nommé sans « à pied »**, construit depuis `SPORT_PROFILES.surf` avec les seuls champs qu'exigent ces cas surchargés (seuil en km/h, `medianWindowSeconds: 5`, `minStateDurationS: 3`) · ≈ 40 lignes retirées, ≈ 150 de tests réécrites
- `src/recording/liveStats.test.ts:41` · commentaire « sans moyenne active » faux (O3) : disparaît avec la réécriture
- Banc : `rg -n "minkm|min/km" outils/banc` avant de finir ; adapter ce qui sort

#### Pièges
- NE PAS retirer `knotsToDisplay` (`core/units.ts:200`) : lu par `formatKnots` (`:211`) et `knotsToChartValue` (`:222`), eux-mêmes en production (`components/sailing/sailingChartParts.tsx:9,94`, `pages/SailingModule.tsx:31,170,421`). Seule sa branche `minkm` part (V1, infirmé n° 1).
- `minStateDurationS` reste (O1 §2.5 : bouton d'un support lent) : les cas de confirmation à 3 s sont, avec `core/topSegments.test.ts:201`, les seuls qui l'éprouvent. Les **garder** dans la réécriture, sur le profil synthétique.
- `WALK_PROFILE` emprunte l'identifiant `surf` (O3) : tout calcul qui choisit par `profile.id` le traite en surf ; le profil synthétique doit le dire dans son nom et son commentaire.
- `formatSpeed` perd un paramètre : `tsc` liste les appelants ; ne pas garder un paramètre ignoré.

#### Vérification
- `npx tsc -b --force`, `npm run lint`, `npx vitest run src/core src/recording src/library src/pages`.
- `rg -n "minkm|formatPace|msToPace|formatLandSpeed|isInverseUnit|editSpeedUnit|PACE_MIN_SPEED_MS|walkProfile|WALK_PROFILE" src outils` → 0.
- Banc : `node outils/banc/passe.mjs general surf statistiques --avant HEAD -j 1 --sans-cache` (unités de vitesse identiques ; `statistiques` est cassé aujourd'hui, D3 : ne lire que `general` et `surf` si le 330 n'est pas fait).

---

### 325d · « Course à bornes » de l'alerte cardiaque

Reste de l'Entraînement (05/11) : une alerte sur une bande de BPM choisie à la main. La production ne vise plus qu'une **zone** (1 à 5). Une partie des pièces de bande sert encore à calculer la zone visée : ne retirer que la chaîne morte.

#### À faire
- `src/recording/zoneAlert.ts:54-62` · retirer `BoundChoice`, `BOUND_CHOICES` · tests seuls
- `src/recording/zoneAlert.ts:71-91` · retirer `boundBpm` (et son doc)
- `src/recording/zoneAlert.ts:101-107` · retirer `sanitizeBand` (seul appelant `src/hooks/useZoneAlert.ts:54`, qui part ci-dessous)
- `src/recording/zoneAlert.ts:109-164` · retirer `BoundPick`, `HeartBandPicks`, `NO_BAND_PICKS`, `sanitizePick`, `sanitizeBandPicks`, `picksBand`, `outOfRangePick`, `armableBand`, `bandLabel`
- `src/recording/zoneAlert.ts:233-243` · `ZoneAlertSetup` ne garde que `{ bounds; target }` (retirer la variante `{ band: HeartBand }`, doc « ou une bande (course à bornes) ») ; `setupBand` devient `zoneBand(setup.target, setup.bounds)` filtré par `validBand`
- `src/recording/zoneAlert.ts:23-24` · commentaires de la course à bornes (zone 6)
- `src/recording/zoneAlert.test.ts:128-254` · retirer les tests de la chaîne morte ; garder ceux de `zoneBand`, `validBand`, `stepZoneAlert`
- `src/hooks/useZoneAlert.ts:160-164` `armHeartBand`, `:166-181` `setLiveBand`, `:184` `getZoneAlertTarget`, `:186-187` `getHeartGuide` · supprimer · appelants : `src/hooks/useRecorder.resume.test.ts:823-870` seuls (`armHeartBand` `:847`, `setLiveBand` `:853,856`, `getHeartGuide` `:852-868`, `getZoneAlertTarget` `:823-866`)
- `src/hooks/useZoneAlert.ts:8-12`, `:47-54`, `:60-63`, `:66`, `:70-71`, `:76`, `:83-85`, `:89-93` · ramener `HeartGuide = ZoneTarget | HeartBand` à `ZoneTarget` : `readStoredGuide` sans `sanitizeBand`, champ `band` de `ZoneAlertView` retiré (jamais lu : `RecordingPage.tsx:483,509` lisent `active` et `target`), `publish` ne compare plus `band`, branche `typeof guide !== 'number'` retirée · ≈ 30 lignes
- `src/hooks/useZoneAlert.ts:6` (« se taisent pendant une activité de test »), `:25-26`, `:37-42` (doc « Course à bornes (Entraînement, 05/11) »), `:44` (« ou de la bande (un objet) ») · réécrire · ≈ 10 lignes
- `src/hooks/useRecorder.resume.test.ts:823-870` · retirer les tests « course à bornes » et ceux de `getZoneAlertTarget` · ≈ 45 lignes

#### Pièges
- NE PAS retirer `HeartBand` (`zoneAlert.ts:38`), `zoneBand` (`:48`, appelé `:73` et `:241`), `validBand` (`:94`, appelé `:152`, `:157`, `:242` et `hooks/useZoneAlert.ts:91`), `typedBoundBpm` (`:68`, appelé par `validBand` `:96`) ni `BAND_BPM_RANGE` (`:65`, défaut de `typedBoundBpm`) : ils calculent la zone visée sur le chemin vivant `setupBand` → `stepZoneAlert` (V1, infirmés n° 2 et 3). Après le retrait, `typedBoundBpm` et `BAND_BPM_RANGE` ne servent plus qu'à `validBand` : retirer leur `export` seulement.
- La clé `REMEMBERED_CHOICES` `'heartBands'` est au 306 (`settingsFile.ts:223`), pas ici.
- La clé de stockage de la zone visée (aujourd'hui `tracker.zoneAlertTarget`) peut contenir un objet bande sur un poste de développement : `readStoredGuide` le rejettera (zone 0), sans erreur.

#### Vérification
- `npx vitest run src/recording/zoneAlert.test.ts src/hooks/useZoneAlert*.test.ts src/hooks/useRecorder*.test.ts`.
- `rg -n "armHeartBand|setLiveBand|getHeartGuide|getZoneAlertTarget|sanitizeBand|HeartGuide|BoundChoice|BOUND_CHOICES|HeartBandPicks|NO_BAND_PICKS|picksBand|armableBand|bandLabel|boundBpm|outOfRangePick" src outils` → 0.
- Banc : `node outils/banc/passe.mjs cardio --avant HEAD -j 1 --sans-cache` (alerte de zone pendant un enregistrement rejoué : signaux identiques).

---

### 325e · Champs sans lecteur (types, profils, points de trace)

Les champs de la **fiche** et du **résumé** de la terre (cadence, meilleurs efforts, puissance, `bikeWeightKg`, `loadKg`, `effortThresholdMs`, `intervals`, `test`) sont au 306 (O2 B11) ; `surfaces`, `terrainElevation`, `elevationSource` au 304 (O2 B12). Restent ici les champs des types du noyau, des profils et des points de trace.

#### À faire
- `src/core/sportProfiles.ts:157-164` et `:191-194` · retirer `HeartRateProfile.driftMinS`, `driftStablePct`, `recoveryS`, `scatterBlockS` (dérive, récupération et nuage FC/vitesse du fractionné) · lecteurs de production : aucun ; `recoveryS` n'est lu que par `spanHeartRate` (325h) et `src/core/heartRate.test.ts:206,216` · ≈ 12 lignes · à faire **avec** le retrait de `spanHeartRate` (325h), dans la même session
- `src/core/types.ts:50-51` et `:84` · retirer `RawTrackPoint.cadence` et `TrackPoint.cadence` · chaîne sans lecteur : `src/core/gpxParser.ts:371` (`'cad'` de `POINT_FIELDS`) et `:601`, `src/core/kinematics.ts:493` (recopie), `src/core/fitParser.ts:28-29`, `:278-279` ; jeux d'essai `src/test/fit.fixture.ts:128`, `src/core/fitParser.test.ts:12` · les autres `cadence` de `src/` sont le pumping, le rythme des points GPS ou du texte (faux amis) ; `library/record.ts:490` lit `raw.cadence` d'une fiche, champ du résumé, retiré au 306 · ≈ 12 lignes
- `src/core/types.ts:59-70` (`TimedTrackPoint`, point sans position de la muscu) et `src/core/gpxParser.ts:27-31`, `:538`, `:566-580`, `:608` (`timedPoints`) · retirer · lecteurs : `src/planning/routeImport.ts:25` (test « fichier sans trace ni itinéraire » : le réduire à `rawPoints.length`) ; jeux d'essai et maquettes : `src/hooks/useSessionLibrary.deuxappareils.test.ts:63`, `src/hooks/useSessionLibrary.resumes.test.ts:50`, `src/library/summaryOptions.test.ts:14`, `src/library/fitToGpx.test.ts:29,63`, `src/core/gpxParser.test.ts:108-131,170-176`, `src/core/gpxParser.corpus.test.ts:168` · ≈ 60 lignes de code + 70 de tests
- `src/core/heartRateSession.ts:21-35` · retirer `heartRatePointsFrom` (tests seuls dans `src/` : `heartRateSession.test.ts`) **et** le script du banc qui l'importe : `outils/banc/energie-fc-diagnostic.mjs:27,69` (il lit aussi `parsed.timedPoints` ; il est déjà cassé, D3 : il importe `src/running/energy.ts`, supprimé) ; retirer son entrée de `outils/banc/scripts.mjs` et de `outils/banc/SCRIPTS.md` s'il en a une
- `src/library/athleteProfile.ts:58-61`, `:79`, `:84` (type `RunnerNumberField`), `:115`, `:182` · retirer `economyMlKgKm` (« économie de course en ml/kg/km ») · aucun lecteur ni écran (Grep : `athleteProfile`, `library/profilePrompt.ts:12` via `...RUNNER_BOUNDS`, tests `src/library/athleteProfile.test.ts:67,72`, `src/hooks/useRunnerProfile.test.ts:70`) ; `sanitizeRunnerProfile` reconstruit l'objet champ par champ : le champ disparaît des profils relus (voulu) · ≈ 6 lignes
- `src/library/athleteProfile.ts:56-57` · commentaire « à pied » sur `hrThresholds` · reformuler
- `src/core/windowMean.ts:7-12`, `:20-24` et `:1-4` · réduire `WindowSample` à la FC : retirer `speedMs` et le paramètre `field: 'speedMs' | 'hrBpm'` · seul appel `src/recording/zoneAlert.ts:279` avec `'hrBpm'` (ne renseigne jamais `speedMs`) ; test `src/core/windowMean.test.ts` · ≈ 8 lignes
- `src/hooks/sessionAsset.ts:64` · `SessionAssetField = 'surfaces' | 'terrainElevation' | 'jumps'` → `'jumps'` (seul appelant `src/hooks/useSessionJumps.ts:59`) ; revoir la généricité (`createSessionAssetCache`, `read`, `isCurrent` servent un seul client) ; commentaire `:76` (« le revêtement et l'altitude y sont bruts depuis le lot 301 ») à réécrire · ≈ 10 lignes

#### Pièges
- `src/test/gpxParser.legacy.ts` (copie gelée du lecteur GPX, garde de la porte d'import, O2 §4 : **à garder**) produit encore `cadence` (`:75,84-85,101,209`) et `timedPoints` (`:32,144-218`) ; `src/core/gpxParser.corpus.test.ts:59-128` compare les deux lecteurs nombre à nombre. Retirer les deux champs **des deux côtés** dans la même session (la copie gelée n'est alors plus gelée que sur les champs vivants : le dire dans son en-tête), ou faire ignorer ces deux champs par la comparaison. Ne pas supprimer la copie gelée.
- `minStateDurationS` n'est PAS à retirer (O1 §2.5, gardé en prudent), même s'il vaut 0 partout.
- `UNCLASSIFIED_PROFILE` (`sportProfiles.ts:529-533`) reste : il sert les sessions « à classer », qui restent (O2 §1.3).
- `isValidZoneBounds` (`core/heartRate.ts:162`) : la zone 1 la croyait propre à `hrZones` ; V1 la dit seulement sur ce chemin (`+ heartRate.test.ts:111`) : son sort est au 306 avec `hrZones`.

#### Vérification
- `npx tsc -b --force`, `npx vitest run src/core src/library src/hooks src/recording src/planning`.
- `rg -n "driftMinS|driftStablePct|scatterBlockS|recoveryS|TimedTrackPoint|timedPoints|heartRatePointsFrom|economyMlKgKm" src outils` → 0 ; `rg -n "\.cadence\b" src --glob '!**/pumping*'` → 0.
- Banc : `node outils/banc/passe.mjs general surf cardio --avant HEAD -j 1 --sans-cache` (texte identique).

---

### 325f · Temps estimé des itinéraires, Overpass et `wayMatch` (morts dès aujourd'hui)

`effectiveDurationSettings` et `effectivePace` rendent toujours `null` (`src/hooks/useSportSettings.ts:319` et `:322`) : tout le temps estimé est mort à l'exécution, sans attendre le 304.

#### À faire
- `src/hooks/useSportSettings.ts:319-322` · retirer `effectivePace` et `effectiveDurationSettings` ; aux imports `:20`, retirer `DurationSettings`, `PaceLevel` (types de `planning/duration`) · ≈ 8 lignes
- `src/planning/duration.ts` (87 lignes) et `src/planning/duration.test.ts` (59) · supprimer · importeurs réels : `useSportSettings.ts:20` (types), `pages/PlanningPage.tsx:57`, `planning/routeList.ts:3` ; `PRESET_PACE_LEVELS` (`:19`), `DEFAULT_PACE_LEVEL` (`:30`), `isPaceLevel` (`:32`), `LEVEL_FLAT_SPEED_MS` (`:39`), `isValidFlatSpeed` (`:51`) n'ont même aucun usage dans le fichier (V2) ; aucun usage dans `outils/` ni `android/`
- `src/planning/routeList.ts:3`, `:34-65`, `:95-111` · retirer `routeDurationS`, `estimateRouteDurationS` (`:102`), `RecordFigures.durations` et l'import de `duration` ; test `src/planning/routeList.test.ts:72-76` ; commentaire `routeList.ts:10` (« bibliothèque Voile ou Course ») à corriger · ≈ 40 lignes
- `src/components/RouteList.tsx:4`, `:8`, `:9`, `:44-50`, `:57`, `:69` · retirer `riderKg` (`useRunnerProfile().profile.weightKg`), la table `durations`, l'appel `effectiveDurationSettings`, `ELEVATION_PRESETS`, l'affichage « ≈ durée » ; doc `:18` (« Commune à l'accueil, aux bibliothèques Voile et Course ») à réécrire · ≈ 15 lignes
- `src/pages/PlanningPage.tsx` · retirer la chaîne du temps estimé : `:346` (`effortDistance`), `:354` (`riderKg`) et l'import `useRunnerProfile` `:50` s'il n'a plus d'usage, `:355-357` (`durationSettings`, `pace`), `:523-524` (`durationS`), `:1064` (`|| (durationSettings && pace)` de `helpKey`), `:1067-1072` (texte « Temps estimé au niveau… »), `:1074` (`plan-stats--four` → `plan-stats`), `:1079-1084` (tuile « Temps »), import `:57` (`PACE_LEVEL_LABEL`, `estimateDurationFromProfile`), `effectiveDurationSettings` et `effectivePace` de l'import `:52`, `formatLandSpeed` de l'import `:42` (seul usage `:1069`) ; doc `:89` (« avec le temps estimé en course et à vélo ») · ≈ 30 lignes ; CSS `plan-stats--four` de `src/pages/PlanningPage.css` si plus utilisé
- `src/planning/overpass.ts` (132) + `src/planning/overpass.test.ts` (79) · supprimer · aucun importeur (seul son test) ; `fetchWays` sans appelant ; le banc ne fait que bloquer l'adresse (`outils/banc/barre.mjs:41`, à laisser ou à réduire)
- `src/planning/wayMatch.ts` (153) + `src/planning/wayMatch.test.ts` (89) · supprimer · seuls importeurs : `overpass.ts:4` (type `OsmWay`) et son test ; `WAY_MATCH_VERSION` (`:21`) n'est cité qu'en commentaire (`src/planning/surface.ts:441`, à retoucher)
- `src/planning/grade.ts:105` · retirer `DEFAULT_CYCLING_GRADE_RANGE` (tests seuls, `src/planning/grade.test.ts`) · ≈ 3 lignes

#### Pièges
- NE PAS retirer `effectiveLoopReturnRatio`, `effectiveGradeRange`, `effectiveWayTypes` (`useSportSettings.ts:310-316`) : ils sont lus par `PlanningPage.tsx:319,348` et partent au 304 ; `effectiveGradeRange` rend `DEFAULT_GRADE_RANGE`, pas `null` (V2).
- `segmentGrid.ts` garde un lecteur (`loopReturn.ts:3`) après le retrait de `wayMatch` : il part au 304.
- Le 304 retouche les mêmes zones de `PlanningPage` : faire 325f d'abord, ou l'intégrer au 304 s'il passe avant.

#### Vérification
- `npx tsc -b --force`, `npx vitest run src/planning src/components src/hooks`.
- `rg -n "effectiveDurationSettings|effectivePace|planning/duration|PACE_LEVEL|estimateRouteDurationS|routeDurationS|overpass|wayMatch|DEFAULT_CYCLING_GRADE_RANGE" src outils` → 0 (sauf `BLOCKED_URLS` du banc, qui bloque une adresse).
- Banc : `node outils/banc/passe.mjs balises --avant HEAD -j 1 --sans-cache` (Itinéraires : texte identique, aucun « Temps estimé » n'était montré en voile ni en surf).

---

### 325g · Textes visibles et commentaires qui racontent la terre

Les libellés « Tracker » sont au 322, les renvois « lot N » au 307, la phrase « À classer » (`SessionLibrary.tsx:690`) au 306.

#### Textes visibles (texte actuel exact → texte proposé)
- `src/pages/SettingsPage.tsx:288` · « Ces valeurs sont celles de la course ; chaque activité les décale (sa carte, partie « onglet analyse »). » → « Ces valeurs sont celles de référence ; chaque activité les décale (sa carte, partie « onglet analyse »). »
- `src/pages/SettingsPage.tsx:526` · « S1, S2 et les zones cardio de cette activité, décalés par rapport à ceux de la course (Réglages › Pratiquant) : la FC y monte moins haut pour un même effort (vélo −7, marche −4, planche −5, wing et kite −8, surf −10 par défaut). » → « S1, S2 et les zones cardio de cette activité, décalés par rapport aux valeurs de référence (Réglages › Pratiquant) : la FC y monte moins haut pour un même effort (planche et bateau −5, wing et kite −8, surf −10 par défaut). » (décalages vérifiés : `core/sportProfiles.ts:587,607,616,625,642`)
- `src/pages/SettingsPage.tsx:551` · « Noms des deux champs de matériel de l'onglet « matériel et notes » (chaussures, vélo…). » → « … (aile, planche…). »
- `src/pages/SettingsPage.tsx:720` · « Chaque activité part des valeurs de son calcul (wingfoil, course, vélo…) ; » → « Chaque activité part des valeurs de son calcul (wingfoil, kite, surf…) ; »
- `src/pages/SettingsPage.tsx:794` · « Pour l'énergie des analyses à pied et à vélo, les zones cardiaques de toutes les activités, et la racine du Profil. Tout est facultatif. » → « Pour l'énergie estimée des analyses, les zones cardiaques de toutes les activités, et la racine du Profil. Tout est facultatif. » (l'énergie par la FC vit en voile et en surf : `core/hrEnergy.ts`, `components/HeartRatePanel.tsx`)
- `src/pages/SettingsPage.tsx:804` · « Pour l'énergie, et la puissance à vélo. » → « Pour l'énergie. »
- `src/pages/SettingsPage.tsx:819` · « Pour les seuils et les zones cardiaques. Le test de FC max (Entraînement › Tests) la mesure ; sans elle, elle est estimée par l'âge. » → « Pour les seuils et les zones cardiaques. Sans elle, elle est estimée par l'âge. »
- `src/components/PermissionsStatus.tsx:30` · « Pour la notification de l'enregistrement, lisible écran verrouillé, et celle du compteur du fractionné. » → « Pour la notification de l'enregistrement, lisible écran verrouillé. »
- `src/components/AboutSettings.tsx:115` · « Les fonds de carte, la recherche de lieux, les itinéraires, ainsi que l'altitude et le revêtement des parcours à pied et à vélo, passent par des services en ligne. » → « Les fonds de carte, la recherche de lieux, le calcul des itinéraires et leur altitude passent par des services en ligne. » (le 304 reprendra la phrase quand BRouter et l'IGN partiront ; le banc `apropos.mjs` lit ce paragraphe)
- `src/pages/RecordingPage.tsx:134` et `:815` · « Aucune activité voile : ajoutez-en une dans Réglages. » → « Aucune activité de voile : ajoutez-en une dans Réglages. » : retirer `FAMILY_NOUN` (`:133-134`) et lire la tournure `of` déjà écrite dans `src/pages/SessionLibrary.tsx:72-75` (`'de voile'`, `'de surf'`), à déplacer à côté de `FAMILY_LABEL` dans `src/core/activities.ts` pour les deux pages
- `src/pages/PlanningPage.tsx:879` · placeholder « Chercher un lieu : commune, sommet, refuge… » → « Chercher un lieu : port, plage, spot… » (voir Questions)

#### Commentaires à réécrire ou supprimer (sans effet de comportement)
Règle : le commentaire dit ce que le code fait aujourd'hui, jamais ce qui est parti ; une phrase qui ne parle que d'une fonction retirée se supprime.

`src/core/` et `src/settings/` :
- `core/analysisTabs.ts:71-72`, `:85-86` (« fractionné », « test », « comme à la course ») ; `:118-122` (« un onglet retiré ne casse rien » : garder le code, reformuler) ; `:94` est réécrit avec `tabDefaults` au 326
- `core/activities.ts:8-11` (« Trail », « 10 000 m » en exemple d'activité) ; les commentaires `:100-118`, `:131-137`, `:249` partent au 306
- `core/activityIcons.ts:6-9` (icônes `course/vélo/fractionné` ignorées : le comportement « icône inconnue ignorée » reste, le dire sans les nommer)
- `core/backdropPattern.ts:17-18` ; `core/parentPage.ts:6`, `:12-18` (« sous l'Entraînement avant », « depuis le lot 301 ») ; `core/speedGradient.ts:4` (« marche en course ») ; `core/periodicity.ts:4` (« cadence à pied partie avec la course ») ; `core/jumps.ts:11` (« voile, course, vélo »), `:386` (« un double à vélo ») ; `core/sessionMarks.ts:8` ; `core/chartZoom.ts:175` (« lissée de la course ») ; `core/imuVertical.ts:22` ; `core/imuFile.ts:201`
- `core/sportProfiles.ts:116-119`, `:147-149`, `:213`, `:250`, `:272-273`, `:395`, `:456`, `:461`, `:474`, `:557` (« par rapport à la course » : c'est le cardio de référence, `REFERENCE_HEART_RATE`) ; `:467-469` et `:677-690` sont réécrits au 326
- `core/heartRate.ts:106` (si le 306 ne l'a pas déjà retiré avec `hrZones`), `:136`, `:181` (« S1 et S2 à pied », « Seuils à pied », « par rapport à la course ») ; `:335` part avec `timeSpanHeartRate` (325h)
- `settings/activitySettings.ts:480-481` · `SportSettingsView.heartRate` : « `null` en voile et en surf » est faux (type `boolean`, proposé dans tous les sports) · corriger

`src/hooks/` :
- `useRecorder.ts:106-108` (en-tête : « la muscu… compteur d'intervalles… partis avec l'Entraînement (lot 302)… ») → une ligne (« toute session a des positions ») ; `:968` et `:1151` (« (muscu, retirée au lot 302) ») · retirer la parenthèse. Ne pas toucher `:118`, `:143`, `:853` (« à classer » d'un journal sans en-tête : le cas reste possible pour un journal abîmé) ; `:872-874` est au 329
- `useSessionJumps.ts:14`, `:76` (« (voile, course, vélo) ») → « voile » ; `:22`, `:39` (« capture de la seule cadence ») : c'est l'en-tête `.imu` d'une marche de Tracker (`setup.jumps === false`, porte d'import, V2) → écrire « capture sans mesure des sauts (fichier venu d'ailleurs) »
- `useAnalysisTabs.ts:12` (« (course et vélo) »), `:30` (« une zone de pente ») ; `useMapHighlight.ts:5-6`, `:11` (« zone de pente ») partent avec le paramètre `T` (325h)
- `useRestingHrResults.ts:9-13` (« ce sera celle du lot « Muscu » ») ; `restingHrFile.ts:6-8` (« Pont avant que ces tests rejoignent les sessions ») ; `useStoredRecord.ts:3-4` (« profil du coureur »)
- `useSportSettings.ts:497-502` (« la course n'hérite pas du seuil de vol du wingfoil » → « le surf n'hérite pas du seuil de vol du wingfoil », O1 §3.1)

`src/components/` et `src/theme/` :
- `components/icons.tsx:48` (`IconPulse` : « les tests de l'Entraînement (FC max) » → icône du cardio, `LessonIcon.tsx:17`), `:252` (« la course reprend IconRun » : supprimer)
- `components/AppShell.tsx:38` (bandeau du compteur du fractionné : supprimer la phrase) ; `components/ActivitySelect.tsx:13` (« (Voile, À pied, Vélo, Fractionné) » → « (Voile, Surf) ») ; `components/AnalysisBaseLayers.tsx:28`, `components/TrackArrows.tsx:36` (« voile, course, vélo, fractionné ») ; `components/JumpMapLayer.tsx:8`, `components/JumpsPanel.tsx:25` (« (voile, course, vélo) ») ; `components/SessionMarks.tsx:12` (« (voile, course, vélo, surf) ») ; `components/PanelTitle.tsx:54` (« du fractionné ») ; `components/CollapsibleSectionTabs.tsx:7`
- `components/drawShareImage.ts:155` (« sans fond (muscu, fond décoché) ») et `:169` (« Sans trace (muscu) ») · réécrire seulement : la branche `content.withMap && track.view` reste vivante (« fond décoché » est un choix de `ShareDialog`, V2)
- `components/chartAxes.ts:5`, `components/ChartFold.tsx:7-8`, `components/chartHover.ts:30`, `components/ChartReadout.tsx:26`, `components/HeartRateChart.tsx:17`, `components/EmptyTabPanel.tsx:9`, `components/ZoomableChart.css:1`, `components/HeartRateBeltSettings.tsx:28-29`, `components/chartStyle.ts:8` (`SPEED_COLOR` : « à pied, à vélo, en surf, test guidé, fractionné » → « vitesse en surf »)
- `components/heartRateOrigin.ts:7` (« le test de FC max ») et `:30` (exemple « FC max 190 (test du 24/10) ») · réécrire sur le test de FC repos
- `components/PageBackdrop.tsx:7` (« courbes de dénivelé ») · relire : la variante `contours` est vivante (V2) ; dire « courbes de niveau » si c'est le motif
- `theme/tokens.css:1-14` (« Direction artistique de Tracker », Shrikhand, « rouge à pied, vert vélo… orange fractionné ») → deux lignes (bleu voile, gris surf) ; le nom « Tracker » de cet en-tête part ici avec le reste ; `:207` (« l'orange, déjà au plus clair »)

`src/pages/` et `src/App.tsx` :
- `pages/RecordingPage.tsx:92-94` (« L'Entraînement (compteur d'intervalles, chrono, tests guidés, muscu, course à bornes) est retiré… ») · supprimer ; `:515` (« un appui par mégarde, en courant ») → « en navigation »
- `pages/SettingsPage.tsx:74`, `:118-121` (« voile sauf bateau, course, vélo », « tops à pied et en surf », « sauts à la course, tops au VTT »), `:297`, `:352` (posé sur `units`, sans rapport), `:358`, `:369`, `:644` (« (Voile, À pied, Vélo, Surf ; l'Entraînement est retiré) »), `:1082` (« (en voile et en fractionné) ») ; `:909` est réécrit avec `thresholdHelp` au 326
- `pages/SessionLibrary.tsx:56` (« Voile, À pied, Vélo, Surf, Entraînement ») et `:61` (« le fractionné et le surf, qui ne planifient pas » : faux, le surf planifie)
- `pages/StatisticsPage.tsx:92-95`, `:364` (« ceux de la course sans activité » → « de référence »)
- `pages/SailingModule.tsx:113-116` (« vers une activité de course, la session part dans le module course ») → « vers une activité de surf, la session part dans le module surf » ; `:336` (« (comme à pied) ») · supprimer la parenthèse
- `pages/analysisMobile.css:3` (« commune à la voile, à pied et à vélo, au surf et au muscu ») ; `pages/Home.css:94` (« pour loger « Entraînement » entier » : le `clamp(var(--text-l), 5.6vw, var(--text-xl))` peut devenir `var(--text-xl)`, à vérifier au banc à 360 px)

`src/library/`, `src/recording/`, `src/platform/` :
- `library/record.ts:64`, `:74`, `:78`, `:104-109` (historique de `SUMMARY_CALC_VERSION` : versions 6, 10, 11, 17, 18 de la cadence à pied, de la Marche, des meilleurs efforts) · réduire aux versions qui touchent voile et surf ; **ne pas toucher la valeur 18**
- `library/record.ts:19`, `:21`, `:138`, `:174`, `:223`, `:225`, `:405` (« Sauts mesurés (voile, course, vélo) »), `:1122-1126` (« voile ↔ course ↔ vélo », « de la course au fractionné à pied ») ; ceux qui tombent dans une plage retirée au 306 disparaissent avec elle
- `library/summary.ts:36` (« en course, filtres et seuil du profil »), `:174` (« le même résumé qu'avec la course » : la fiche sans calcul de `summaryFrozen` garde `UNCLASSIFIED_PROFILE`) ; `library/summaryOptions.ts:88` (« Le vélo y avait une cinquième place »), `:105` (« (muscu, résumé sans réglage) ») ; `library/sessionSort.ts:6` ; `library/sessionBundle.ts:63` (« muscu ») ; `library/settingsFile.ts:9` (« séances du compteur » ; le même texte du `LISEZMOI.txt`, `folderLayout.ts:68`, est au 322)
- `recording/journal.ts:190-195` (le journal ignore déjà les lignes `hr`, `intervals`, `test`) ; `recording/gpxWriter.ts:10-11` (`gpxtpx:cad` retiré) ; `recording/jumpSettings.ts:5` ; `recording/signalTones.ts:5-6` (« Ceux du test de FC max… sont partis avec lui (lot 302) »)
- `platform/beeper.ts:14-15` (« Le compteur du fractionné et son service sont partis… »), `:75`, `:163` ; `platform/motion.ts:29` (« La cadence à pied est partie avec la course ») ; `platform/heartRate.ts:33-34` ; `platform/recovery.ts:11` ; `platform/files.ts:72` (« le journal d'une course » → « d'une session »)

`android/` (Java et manifeste) :
- `BeeperPlugin.java:19-20`, `HeartRatePlugin.java:63-64`, `MotionPlugin.java:122-123`, `RecoveryPlugin.java:27` (chemins sous `android/app/src/main/java/io/github/segneur/tracker/`) · supprimer les phrases sur le fractionné, la muscu, la cadence à pied
- `android/app/src/main/AndroidManifest.xml:85` · « Récepteur du greffon GPS, retiré » : dire que c'est un marqueur `tools:node="remove"` qui retire à la fusion le récepteur du greffon (il doit rester, gardé par `androidManifest.test.ts:48-62`)

#### Pièges
- Le banc lit certains de ces textes : `outils/banc/apropos.mjs` (À propos), `reglages-aide.mjs:40`, `aides.mjs` (aides de Réglages). Relancer ces scripts et accepter le changement de texte attendu, ligne par ligne.
- Faux amis à ne pas toucher : « course » au sens parcours de balises (`plan-course`, `courseMarks*`, `courseDeg`), « cadence » du pumping ou des points GPS, `running` au sens « en cours », « marche sur la plage » (`SurfModule.tsx:630`), `sailingConfig.ts:82-92` (« applications de randonnée » : cas réel d'un GPX économique, à garder ou reformuler en « enregistreurs économiques d'autres applications »).

#### Vérification
- `npm run verif` (lint, tests, renvois des documents).
- Recherche de contrôle : `rg -n -i "à pied|à vélo|vélo|fractionn|entraînement|muscu|compteur d'intervalles|course à bornes" src android/app/src/main` ne rend plus que les faux amis et les lignes que les lots 304, 306 et 321 retirent.
- Banc : `node outils/banc/passe.mjs reglages-aide aides apropos --avant HEAD -j 1 --sans-cache` (seuls les textes listés changent).

#### Questions liées
1. Le champ de recherche des Itinéraires propose « commune, sommet, refuge » : on passe à « port, plage, spot » ? · défaut : oui · une ligne ; à revoir au 304 si la recherche de lieux (Photon) part.

---

### 325h · Fonctions, exports, props, CSS, icônes, constantes et ressources Android sans utilisateur

#### Fonctions et constantes mortes (avec leurs tests)
- `src/core/heartRateSession.ts:49-90` · retirer `heartRatePreviewPath` (tests seuls, `heartRateSession.test.ts:23-36`) ; `src/core/displayConfig.ts:12-17` · retirer `PREVIEW_MAX_POINTS` (`:17`, aucun usage, même hors `src`) · ≈ 55 lignes
- `src/core/heartRateSession.ts` (fichier) · après les deux retraits (325e, ci-dessus), il ne reste que `activeDurationS` et le type `HeartRateSessionPoint`, lus par `src/core/hrEnergy.ts:2,109` : les fusionner dans `hrEnergy.ts`, supprimer le fichier et son en-tête « muscu » (`:7-12`) · ≈ −20 lignes nettes
- `src/core/heartRate.ts:277-316` (`SpanHeartRate` `:278`, `spanHeartRate` `:286`) et `:335-347` (`timeSpanHeartRate` `:336`) · retirer (« une répétition du fractionné ») · tests seuls `src/core/heartRate.test.ts:202-257` · ≈ 75 lignes ; avec les champs de `HeartRateProfile` (325e)
- `src/core/basics.ts:114-134` · retirer `DatedCommand` (`:116`) et `readCommands` (`:125`) (« journal chrono, compteur ») · tests seuls `src/core/basics.test.ts:118-122` · ≈ 25 lignes
- `src/core/units.ts:305-315` · retirer `formatMinSecHours` (`:308`, « dixièmes d'un chronomètre ») · tests seuls (`units.test.ts`) · ≈ 10 lignes
- `src/core/search.ts:57` · `bracketAt` : tests seuls (`search.test.ts:133`) · retirer (proposé ; la zone 1 laissait le choix)
- `src/hooks/createStore.ts:76-131` · retirer `TickingStore` (`:76-85`) et `createTickingStore` (`:86-131`, conçu pour « compteur d'intervalles, chrono », doc `:88`) · tests seuls `src/hooks/createStore.test.ts:2`, `:34-76` (à retirer) · ≈ 55 + 43 lignes
- `src/hooks/useSportSettings.ts:187-190` · retirer `lastRecordedOrFirst` (aucun usage, même en test)
- `src/recording/liveNotification.ts:75-80` · retirer le segment vide `||` (« ancienne phase du compteur ») de la clé `${activityId}||${computed}` ; la clé n'est comparée qu'en mémoire · **mettre à jour** `src/recording/liveNotification.test.ts:108,125,134`, qui reconstruit la clé à la main avec `||` (V1)
- `src/recording/liveFields.ts:13-14` · commentaire de ces tables ; **ne pas retirer** `NOTIFICATION_ONLY_FIELDS` (`:54-59`) ni `SPORT_NOTIFICATION_FIELDS` (`:73-75`) : O1 les garde jusqu'à la version poussée (voir Pièges)

#### Son « final » (TS et Java ensemble)
- `src/core/beepDurations.ts:18` (`BEEP_FINAL_MS`), `:21` (`'final'` de `ToneKind`), `:24` (entrée `final` de `TONE_MS`) · retirer ; commentaires `:3-5`, `:8`, `:16-20` (« Sons du compteur et des tests guidés », « long double de fin de séance du compteur ») → « test de FC repos et alerte de zone » ; `BEEP_BRIEF_MS` (`:9`) reste (émis par `signalTones.ts:14`)
- `android/app/src/main/java/io/github/segneur/tracker/TonePlayer.java:34` (`TONE_FINAL`), `:37` (commentaire), `:40` (`"final"`), `:49` (`FINAL_MS`), `:54` (`FINAL_VIBRATION_MS`), `:142-145` (`playFinal`) et `BeeperPlugin.java:180` · retirer **dans le même commit** (`beepDurations.ts:5` impose de changer les deux côtés) ; `BeeperPlugin.finished` (trois bips longs des balises, `:145-157`) reste
- Aucun test ne cite `final` (V2) ; aucun motif de `src/` ni d'`outils/` ne le produit

#### Paramètres devenus constants
- `countDown` (chronomètre à rebours de la notification, toujours `false`) · `src/platform/notification.ts:23-24`, `:34`, `:52` (« rebours » du journal navigateur), `:61` ; `src/recording/liveNotification.ts:56` ; type `chrono` de `src/hooks/recordingNotification.ts` s'il le répète ; Java `RecordingNotificationPlugin.java:63`, `:81` (`getBoolean("countDown")`, `setChronometerCountDown`) (V2 : c'est ce fichier, pas `MotionPlugin.java`) ; tests `src/recording/liveNotification.test.ts:40,74,80` · ≈ 12 lignes
- Option `jumps` de `Motion.start` (toujours `true` à l'écriture : `src/pages/RecordingPage.tsx:789,792`) · retirer le paramètre à l'écriture : `src/platform/motion.ts:26-31` (`MotionSetup.jumps`), `:56`, `:59`, `:92` ; Java `MotionPlugin.java:44-46`, `:73`, `:119-125`, `:135`, `:137`, `:159`, `:165-167`, `:255`, `:369`, `:387-388` ; **garder tolérante la lecture** de `setup.jumps === false` (en-tête `.imu` d'une marche venue de Tracker, porte d'import) : `src/hooks/useSessionJumps.ts:40`, `src/library/newRecord.ts:71`, `src/library/record.ts:351`, `src/core/imuFile.ts:178`, `src/pages/RecordingPage.tsx:776`, `src/platform/motion.ts:140` ; tests qui posent `jumps: false` : `src/hooks/useRecorder.test.ts:589`, `src/core/analysisTabs.test.ts:50,52` (à garder s'ils éprouvent la lecture) ; référence `ImuReference.java:31` · ≈ 25 lignes · **après le lot 321** (qui réécrit l'en-tête `.imu` et `ImuReference.java`), avec `imuFile.reference.test.ts` et `ImuFormatTest` mis à jour ensemble
- `src/hooks/useRestingHrTest.ts:56`, `:58`, `:78`, `:81`, `:157`, `:165` · retirer l'option `protocol?: RestingHrProtocol` (jamais passée : `RestingHrTestPage.tsx:70-75` ne passe que `speed`) ; utiliser `RESTING_HR_TEST` directement · ≈ 6 lignes
- Paramètre de type `T` de `useMapHighlight` (`src/hooks/useMapHighlight.ts:12-16`, `:21`, `:31-32`, `HighlightKeys`/`HighlightKey`), `useAnalysisTabs` (`src/hooks/useAnalysisTabs.ts:32`, `:63`) et `useZoomOnMap` (`src/hooks/useZoomOnMap.ts:66`) · aucun appel avec type explicite (il ne servait qu'aux « zones de pente ») · retirer ; commentaires `useMapHighlight.ts:5-6`, `:11` avec · ≈ 15 lignes

#### Props sans appelant
- `src/components/JumpsPanel.tsx:74-79`, `:152`, `:202-203` · retirer les props `panelPrefix` (défaut `'sailing'`, doc « `sailing`, `running`, `cycling` »), `accent`, `sailing` et la branche « des pieds ou des roues au-dessus du sol » · seul appelant `src/pages/SailingModule.tsx:667-684`, qui n'en passe aucune · **ne pas changer** les `id` `sailing.sauts*` des `ResizablePanel` (tailles mémorisées) · ≈ 12 lignes
- `src/components/CardioTab.tsx:12` (doc « absent sans carte (muscu) »), `:18`, `:23`, `:29` · rendre `zone` obligatoire et retirer `NO_SELECTION` · les deux appelants (`SailingModule.tsx:653`, `SurfModule.tsx:770`) passent `zone` · ≈ 5 lignes ; la phrase `hrEnergy` du doc (`:13-14`) est au 326
- `src/components/BaseTileLayer.tsx:406-411` · `family?` jamais omis (trois appelants : `AnalysisBaseLayers.tsx:52`, `LiveMap.tsx:211`, `PlanningPage.tsx:904`) · rendre obligatoire, retirer le cas « carte sans bouton de fond »
- `src/components/SessionMarks.tsx:66`, `:69-70`, `:92` · retirer `SessionMarksList.withDistance` (« Faux sans trace (muscu) ») : aucun appelant ne le passe (`SailingModule.tsx:623`, `SurfModule.tsx:539`)
- `src/pages/SettingsPage.tsx:164-167` · retirer la clé `'itineraires'` de `ActivityPartKey` et des défauts (aucun `togglePart('itineraires')` ni `openPart.itineraires`) ; commentaire `:164` avec

#### Icônes, couleurs, classes CSS
- `src/components/icons.tsx:390-397` · retirer `IconBook` (aucun usage, ni test)
- `src/components/chartStyle.ts:17-18` `ENERGY_COLOR`, `:20-21` `TREND_COLOR`, `:23-24` `PHASE_FILL` · retirer (une seule occurrence chacune : la définition)
- `src/components/ui/ui.css:795` (`.ui-pointer`), `:851-853` (`.ui-mb-14`), `:867` (`.ui-mt-4`), `:879` (`.ui-mt-8-only`), `:1027-1030` (`.ui-chart-200`) · retirer (aucun usage dans `.ts/.tsx/.mjs/.html/.md`, aucun gabarit `ui-mt-${…}` ; le fichier fait 1102 lignes, pas 918)
- `src/components/ui/ui.css:77` (`.page-backdrop__dots`), `:82` (`__thin`), `:86` (`__fill`) · retirer, et réduire `TilePath.kind` (`src/core/backdropPattern.ts:29`) à `'major'` (seul `kind` produit, `:180`) ; `__major` (`:63`) reste
- `src/pages/analysisMobile.css:598` (`.an-cad-title`), `:603` (`.an-chip-row`), `:610` (`.an-ivl-toggle`), `:633` (`.an-muscu-legend`), `:684` (`.an-panel-head`), `:693` (`.an-panel-head--mb10`) · retirer les blocs (la zone 5 donne les fins : `598-601`, `603-608`, `610-623`, `633-640`, `684-695`, à relire) ; relancer le script des classes orphelines (`D:\gong tracker\atelier\revue-1111\orph.js`, depuis `src/`)

#### Ressources et gabarit Android
- `android/app/src/main/res/layout/activity_main.xml` · supprimer (`MainActivity` n'appelle aucun `setContentView` ; `BridgeActivity.java:28` pose le gabarit de la bibliothèque ; non régénéré par `cap sync`)
- `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` · supprimer (l'icône adaptative vise `@mipmap/ic_launcher_foreground`, `mipmap-anydpi-v26/ic_launcher*.xml:4`)
- `android/app/src/main/res/drawable/ic_launcher_background.xml` (vecteur blanc, inutilisé) · supprimer **et** diriger le test `src/platform/androidManifest.test.ts:160-168` (« fond blanc uni ») vers `res/values/ic_launcher_background.xml` (`#F6F5F2`, lu par `mipmap-anydpi-v26/ic_launcher.xml:3`, `ic_launcher_round.xml:3`) · après la question 2
- `android/app/build.gradle:101-108` (bloc `google-services.json`) et `android/build.gradle:11` (`classpath 'com.google.gms:google-services:4.4.4'`) · supprimer (aucun Firebase, `app/google-services.json` absent)
- `android/app/build.gradle:94-95` (`androidTestImplementation`) et `:36` (`testInstrumentationRunner`) · supprimer (aucun dossier `androidTest`)
- `android/app/src/main/res/xml/file_paths.xml:3` · retirer `<external-path name="my_images" path="." />` (seul `ShareFilePlugin.java:45,59` sert le FileProvider, depuis `getCacheDir()/partage`) ; essai « Partager » au téléphone obligatoire

#### Retirer seulement le mot `export` (usage interne seul ; knip, V1, V2)
Avant chaque retrait : `rg -n "<nom>" outils/` (knip ne voit pas le banc).
- `core` : `reliefOf` (`backdropPattern.ts:73`), `BEEP_BRIEF_MS`, `GPS_LOST_LOW_RATIO` (`beepDurations.ts:43`), `BELT_LOST_NOTE_MS` (`:54,57`), `IMU_TIME_STEP_US` (`imuFile.ts:248,350`), `detectFlights` (`jumps.ts:343,407`), `GAP_CHORD_FACTOR` (`kinematics.ts:484`), `validatedPumpSeries` (`pumping.ts:532`), `liftoffAt` (`:499`), `seededRandom`, `REFERENCE_CARD_HEIGHTS`, `REFERENCE_GAP`, `freeSide` (`rootPath.ts`), `computeTotalTimeMs` (`sessionStats.ts:269`), `DEFAULT_MAX_OUTLIER_S`, `SEED_WINDOW_S` (`speedFilter.ts`), `HEART_RATE_ZONE_MODEL` (`sportProfiles.ts:188`), `EXIT_FLOOR_RATIO` (`:746`), `DEFAULT_TOP_COUNT` (`topSegments.ts:99`), `speedUnitSymbol` (`units.ts`, après 325c), `noiseSource` (`imuSynthetic.fixture.ts`) ; types `TilePath`, `ZoneMethod`, `ImuStreamKind`, `ImuStreamStats`, `JumpCurve`, `Flight`, `PumpCadenceWindow`, `PumpCadence`, `RootPieceKind`, `Rootlet` ; `IMU_MAGIC` (`imuFile.ts:187,274,390`) **après le 321**
- `hooks` : `incomingVerdict` et `IncomingVerdict` (`sessionLibrary/incoming.ts:156`), `readMapBase` (`useMapBase.ts:47`), `useMediaQuery` (`useNarrowScreen.ts:61,66,71`), `readHeartRateZones` (`useRunnerProfile.ts:36`), `useSessionJumps` (`useSessionJumps.ts:90`) ; types `PendingSession`, `SavedSession`, `JournalRecovery` (`useRecorder.ts`), `Visibility` (`useSportSettings.ts:234`), `LiveRecording` (`useLiveRecording.ts:42`), `ZoneAlertView`, `ElementSize`, `LoadedList`, `LoadedListStore`, `ChartZoomEntry`, `ChartZoomStore`, `ZoomedChart`, `ZoomOnMap`, `HistoryPort`
- `library` : `PENDING_TEMP_SUFFIX` (`pendingTemps.ts`), `PREVIEW_IMAGE_VERSION` (`previewImages.ts:51`), `PROFILE_BOUNDS` (`profilePrompt.ts:18,30`), `sameManeuverResults` (`record.ts:1177`), `readGear` (`:533`), `readSessionName` (`:789,1132`), `RECORD_EDIT_FIELDS` (`:938`), `readStoredRestingResult` (`restingHrStore.ts:49`), `ratingLabel`, `windShareValue`, `maneuverSuccessValue` (`shareStats.ts:62-65`), `STATS_METRICS` (`stats.ts:385-397`), `RECORD_VALUE` (`:618`), `jobErrorOf` (`trackWorkerProtocol.ts:56`) ; types `PendingTempSession`, `UnreadableField`, `StatsMetricUnit`, `StatsMetricSeries`, `ChartTotal` (`activityChart.ts`), `CachedRecord` (`reconcile.ts`) ; ceux de `record.ts` **après le 306**
- `recording` : `HEADING_DEFAULTS` (`heading.ts:32`), `isJumpPlacement` (`jumpSettings.ts:62`), `SIMULATED_APPROACH_MS` (`markGuide.ts:62`, la table est retypée au 326), `ZONE_ALERT_DEFAULTS` (`zoneAlert.ts:183`), `typedBoundBpm` et `BAND_BPM_RANGE` (après 325d) ; types `MarkOutcome`, `ZoneAlertDelays`, `GpsWatchPhase`, `JournalHeader`, `JournalActivity`, `ManualBreak`, `RestingPhase`, `AutoPauseEvent`
- `settings` : `SAILING_UNITS`, `SURF_UNITS` (`activitySettings.ts:33-34`), `isValidThreshold` (`:219,226,541,620`), `isValidHrOffset` (`:282,574,674`), `isKnownSpeedUnit` (`:242,550,618`), `isKnownDistanceUnit` (`:374,552,619`), `sanitizeNotificationFields` (`:433,545,632`), type `ByActivity`
- `components` : `ChartReadout` défaut (`ChartReadout.tsx:24`), `export default HoverMarker` (`HoverMarker.tsx:30`), `SpeedRangeEditor` défaut (`SpeedRangeEditor.tsx:128`), `CardioCurve` (`HeartRatePanel.tsx:67`), `heartRateValue` (`chartReadouts.ts:11`), `TRACK_PREVIEW` (`drawTrackPreview.ts:21`), `HIGHLIGHT_WEIGHT` (`highlightColors.ts:29`), `seriesSpanLabel`, `flightSpanLabel` (`pumpingHighlight.ts:19,23`), `hrMaxOriginLabel` (`heartRateOrigin.ts`, aucun test ne l'importe ; `formatOffsetBpm`, lui, est importé par `heartRateOrigin.test.ts` : garder) ; types `JumpsPanelProps`, `SessionShare`, `ButtonVariant`
- `platform` : `EXAMPLE_BELT` (`heartRate.ts:98`), `MOTION_DIR` (`motion.ts:48`), `TILE_CAP_LIMITS_MB` (`tileCache.ts:344`), `createCachePreviewImageBackend` (`previewImages.ts:114`)
- `tutorials` : type `LessonTarget` (`lessons.ts`)
- Facultatif, jeux d'essai : exports internes de `src/test/gpx/corpus.ts` et `src/test/sailing.fixture.ts` (V2)
- Hors de ce sous-lot : exports de `sailing/` et `surfing/` (lot 328) ; de `planning/` (304, ils partent avec leur fichier ; `duration.ts` et `wayMatch.ts` au 325f)

#### Pièges
- NE PAS retirer (INFIRMÉS) : `.ui-btn--l` et la taille `'l'` de `Button.tsx:9` (7 boutons de `RecordingPage.tsx:317,342,357,927,933,944,948`) ; `.ui-help--s` et `.ui-help--xs` ; `.page-backdrop--contours/--surf/--voile` ; `--surf-soft` et `--voile-soft` (`SessionNotesPanel.tsx:63,148`) ; la prop `families?` d'`ActivitySelect`/`SessionActivityField` ; `res/xml/config.xml` ; `@fontsource/montserrat`. Détail : section « Suppressions écartées ».
- Exports à **garder** parce que le banc les lit : `hrEnergyCeilingBpm` (tant que `energie-fc-diagnostic.mjs` existe), `hrEnergyPowerW`, `pumpSignal`, `pumpCadence` (`pumping-diagnostic.mjs`), `waveTurnTrace` (`virages-diagnostic.mjs`), `imuSynthetic.fixture.ts` (`pumping.mjs:162`, `virages.mjs:89`) ; `setSummaryRunner` (point d'injection de test) ; les exports de `platform/` « pour les tests » (`dispatchBack`, `createJsonStore`…) : règle de conception du projet.
- `NOTIFICATION_ONLY_FIELDS` et `SPORT_NOTIFICATION_FIELDS` (vides) : O1 les garde comme surcharges par calcul jusqu'à la version poussée F4 (O1 prime sur la zone 6, qui les retirait).
- `assets/logo.png`, `assets/splash.png`, `public/_redirects` ne sont pas morts (entrées manuelles de `@capacitor/assets` pour le lot 311, et de l'hébergeur web) : ne pas les retirer ici.
- Java : après tout retrait, `./gradlew testDebugUnitTest assembleDebug` ; `nativeConstants.test.ts` doit rester vert.

#### Vérification
- `npx tsc -b --force`, `npm run lint`, `npx vitest run` complet ; `npx cap sync android` puis `./gradlew testDebugUnitTest assembleDebug`.
- `rg -n "heartRatePreviewPath|PREVIEW_MAX_POINTS|spanHeartRate|SpanHeartRate|readCommands|DatedCommand|formatMinSecHours|bracketAt|createTickingStore|TickingStore|lastRecordedOrFirst|BEEP_FINAL_MS|IconBook|ENERGY_COLOR|TREND_COLOR|PHASE_FILL|countDown|panelPrefix|withDistance|NO_SELECTION" src outils` → 0 ; `rg -n "TONE_FINAL|FINAL_MS|playFinal|countDown|google-services|androidTest" android/app` → 0 ; `rg -n "\"final\"" android/app/src/main/java` → 0.
- Banc : `node outils/banc/passe.mjs general surf sauts partage notification --avant HEAD -j 1 --sans-cache`.
- Essai au téléphone (un seul) : « Partager » une image (FileProvider réduit), notification d'enregistrement (titre, chronomètre qui monte).

#### Questions liées
1. Catégorie Android de la notification d'enregistrement (`RecordingNotificationPlugin.java:77`, `CATEGORY_WORKOUT`, « entraînement ») : passer à `CATEGORY_SERVICE` ? · défaut : non, sans effet visible hors du tri des notifications.
2. Fond de l'icône Android : blanc (test du lot 310) ou `#F6F5F2` (ressource réelle) ? · défaut : `#F6F5F2`, ce que voit l'utilisateur aujourd'hui · fixe la valeur attendue par le test réécrit.

---

### 325i · Tests et jeux d'essai qui ne couvrent plus que la terre

Les tests de compatibilité (relecture d'anciennes données) sont au 306 ; les cas « à classer » de la porte au 321. Restent les tests dont le **sujet** est la terre.

#### À faire
- `src/core/activities.test.ts:40-45`, `:153`, `:254` ; `src/core/parentPage.test.ts:24-25`, `:42-43`, `:47`, `:57` (`running`, `cycling`, `run-intervals`, `muscu`, `a-marche`, `a-vtt`, `/course`, `/velo`, `/fractionne`, `?famille=velo`) · réécrire avec des identifiants inconnus neutres (« ski », « parapente », déjà présents) ; garder les cas négatifs (le comportement « inconnu ignoré » reste)
- `src/core/activityIcons.test.ts:50-52` · même chose (icône inconnue ignorée, sans nommer course ni vélo)
- `src/core/gpxParser.test.ts:17`, `:25` (`<type>running</type>`) · passer sur un type de voile ou un type inconnu neutre
- `src/test/gpx/corpus.ts:295` (`RUN = { name: 'Course à pied du matin', type: 'running' }`, utilisé `:352-353,387-390,399,404,419-420,424,429,458`), `:325`, `:357-358`, `:367-368`, `:415` (Wahoo « Sortie vélo », « Tour à vélo », `cycling`), `:362-363`, `:394` (Strava « Morning Run ») · renommer `RUN` en `FOREIGN`, types `sailing`/`kitesurfing`/`windsurfing`, noms « Session du matin » ; **garder au moins un** type étranger inconnu (`cycling`) pour éprouver qu'il est lu tel quel ; changer les mêmes chaînes dans les attentes de `src/core/gpxParser.corpus.test.ts` (`trackType`, `trackName`), comparées nombre à nombre à la copie gelée · ≈ 14 lignes
- `src/core/prepareTrack.test.ts:20`, `:55` · retirer « à pied » du titre (le cas « sans profil, avec trou et pause » reste utile)
- `src/core/topSegments.test.ts` · titre « tops à pied et en surf » sur des cibles de voile (O3) · corriger
- `src/hooks/useSessionLibrary.resumes.test.ts:15` (« Course de trois points » → « Trace de trois points »), `:76-81` (constantes `COURSE`, `COURSE_SEUIL`, `VELO` sur des fichiers `_surf.gpx`/`_wingfoil.gpx` → `SURF`, `SURF_SEUIL`, `WING`), variable `walking` (`:371`, `:374`, `:377`, `:414-416` → `other`), titre `:399` (« seuil de Course changé… les courses sont refaites ») · renommage mécanique, ≈ 60 occurrences entre `:100` et `:474` ; les champs `bikeWeightKg: null, loadKg: null` de `:72` et de `src/hooks/sessionLibrary/summaryQueue.test.ts:140` partent au 306
- `src/recording/journal.test.ts:128-135` (sport `running`), `:156-165` (« journaux d'avant 302 », « de muscu, de course ») · retirer ; **garder** les tests d'en-tête illisible générique (`parapente`, `:59`)
- `src/recording/liveFields.test.ts:70-80`, `:157` et suivants (chiffres de la terre, étape du compteur) · réécrire en voile et surf (les lignes `minkm` sont au 325c)
- `src/library/previewImages.test.ts:7-22` (clés `running`) · passer sur `wingfoil`/`surf` ; `src/library/reconcile.test.ts:67-70` (nom `running.GPX`) : facultatif, sans enjeu
- `src/platform/androidManifest.test.ts:67-73` · retirer les deux `it.each` négatifs (`.IntervalTimerService`, `.HeartRateService`, `FOREGROUND_SERVICE_SPECIAL_USE/CONNECTED_DEVICE` « parti avec l'Entraînement ») : l'absence au manifeste suffit · ≈ 8 lignes

#### Pièges
- NE PAS toucher : `src/core/sportProfiles.test.ts:10-11` (`isSportType('running')`, `('muscu')` : bons cas négatifs) ; `src/library/summary.test.ts:27-52` (prouvent que le calcul n'écrit plus les champs de la terre) ; `src/library/naming.test.ts:31-35` (porte, 321) ; `src/test/gpxParser.legacy.ts` (garde) ; `src/test/library.fixture.ts` et `fit.fixture.ts` (`running` y est une promesse ou l'état d'un chronomètre FIT : faux amis) ; `restingHrTest.test.ts:47-50` (faux ami).
- `src/test/walkProfile.fixture.ts` est au 325c ; `familyRecords()` et `settings0461.fixture.ts` au 306.

#### Vérification
- `npx vitest run src/core src/hooks src/recording src/library src/platform`.
- `rg -n "'running'|'cycling'|run-intervals|a-marche|a-vtt|Morning Run|Course à pied|Sortie vélo|COURSE_SEUIL|\bVELO\b|walking" src --glob '*.test.ts' --glob 'src/test/**'` ne rend plus que les cas négatifs voulus (sportProfiles, naming, corpus « type inconnu », et ceux du 306 et du 321 tant qu'ils ne sont pas faits).

---

### 325j · Noms hérités de la terre

Renommages mécaniques, guidés par `tsc`. Les **clés de stockage** qui portent ces noms (`tracker.runnerProfile`…) sont renommées au 322 : ne toucher ici qu'aux identifiants du code.

#### À faire
- `src/hooks/useRunnerProfile.ts` → `src/hooks/useAthleteProfile.ts` · exports `useRunnerProfile` → `useAthleteProfile`, `readRunnerProfile` (`:29`) → `readAthleteProfile` ; importeurs (13 + 2 tests) : `components/ProfilePrompt.tsx:38`, `components/RouteList.tsx:44` (s'il reste après 325f), `components/ShareDialog.tsx:61`, `hooks/recordingNotification.ts:9`, `hooks/useAnalysisHeart.ts:5,14`, `hooks/useZoneAlert.ts:16`, `pages/Home.tsx:51`, `pages/PlanningPage.tsx:354` (s'il reste), `pages/ProfilePage.tsx:108`, `pages/RecordingPage.tsx:504,706`, `pages/RestingHrTestPage.tsx:69` (et commentaire `:22`), `pages/SettingsPage.tsx:627`, `pages/StatisticsPage.tsx:363` ; tests `hooks/useRunnerProfile.test.ts`, `library/settingsImport.guard.test.ts:157` (parti au 306 si fait avant)
- `src/library/athleteProfile.ts:18-142` · `RunnerProfile` → `AthleteProfile`, `EMPTY_RUNNER_PROFILE`, `RUNNER_BOUNDS` → `ATHLETE_BOUNDS`, `runnerName`, `runnerAvatar`, `runnerAge`, `runnerHrSource`, `sanitizeRunnerProfile`, `storedRunnerProfile`, `RUNNER_NAME_MAX`, `RunnerAvatar`, `runnerHeartRateZones` · ≈ 60 occurrences dans 13 fichiers et plus
- Variable et prop `runner` → `athlete` : `pages/SailingModule.tsx:214`, `:652`, `pages/SurfModule.tsx:188`, `:769` (`CardioTab runner={runner}`), `components/CardioTab.tsx`, `components/HeartRatePanel.tsx`, `components/heartRateOrigin.ts`, `components/ProfilePrompt.tsx`, `components/ProfileAvatar.tsx`, `components/ShareDialog.tsx` ; `pages/ProfilePage.tsx:20`, `pages/Home.tsx:18-19`, `:51-52`, `pages/RestingHrTestPage.tsx:14`, `:22`, `pages/StatisticsPage.tsx:35-36`
- `src/pages/SettingsPage.tsx:151-154`, `:793-795` · clé de bloc `coureur` (`SettingsBlock`, défauts, `open.coureur`) → `pratiquant` (l'état mémorisé repart fermé, sans gravité)
- `src/pages/SettingsPage.tsx:237-249` · retirer l'alias `RUNNING_HEART_RATE = REFERENCE_HEART_RATE`, utiliser `REFERENCE_HEART_RATE` (usages `:247`, `:249`)
- `src/pages/RestingHrTestPage.tsx:38-49`, `:92`, `:110`, `:129`, `:151`, `:163`, `:192`, `:207` et `src/pages/RestingHrTestPage.css:3-61` · classes héritées de l'Entraînement `train-page`, `train-actions`, `train-list`, `train-item*`, `fit-steps` → `rest-*` (la feuille a déjà `rest-actions`, `rest-history*`) ; variable `--test-accent` (`RestingHrTestPage.css:6`) → `--rest-accent` ; commentaire CSS « règles reprises des pages de l'Entraînement » · ≈ 40 occurrences ; aucune cible dans `outils/` (V2)
- `src/platform/beeper.ts:42` · `ClockTone` (« Clock » = compteur d'intervalles) → `PatternTone` ; appelants `pages/SettingsPage.tsx:159`, `recording/restingHrTest.ts:126`, `recording/signalTones.ts:14,16`, `hooks/useRestingHrTest.ts`, `hooks/useZoneAlert.ts`
- `src/recording/signalTones.ts:11-23` · `TestSignal`, `TEST_SIGNAL_TONES`, clé `finTest` → `GuideSignal`, `GUIDE_SIGNAL_TONES` ; consommateurs `hooks/useZoneAlert.ts:7`, `recording/restingHrTest.ts:2` ; doc `zoneAlert.ts:166`
- `src/recording/restingHrTest.ts:19` · `RestingHrTestId = 'fc-repos'` (union d'un seul littéral, plusieurs protocoles n'existent plus) → constante ; vérifier `hooks/useRestingHrResults.ts`

#### Pièges
- `adoptRunningService`, `RunningMotionCapture` (`platform/motion.ts`) : « running » = « en cours », faux amis, ne pas renommer.
- `HrSource.kind` garde `'test'` : c'est le test de FC repos (gardé).
- Les clés de stockage (`tracker.runnerProfile`, `tracker.sections` qui mémorise `coureur`) suivent le 322 ; ce sous-lot ne change aucune clé.

#### Vérification
- `npx tsc -b --force`, `npm run lint`, `npx vitest run`.
- `rg -n "useRunnerProfile|RunnerProfile|RUNNER_|runnerName|runnerAvatar|runnerAge|runnerHrSource|RUNNING_HEART_RATE|\bcoureur\b|train-|fit-steps|--test-accent|ClockTone|TestSignal|TEST_SIGNAL_TONES|finTest" src outils` → 0.
- Banc : `node outils/banc/passe.mjs cardio fc-repos profil --avant HEAD -j 1 --sans-cache` (texte identique).

#### Questions liées
1. La couleur du test de FC repos (`--test-accent`, aujourd'hui dans `RestingHrTestPage.css:6`) : la ranger dans `theme/tokens.css` comme les autres couleurs ? · défaut : oui, sous le nom `--rest-accent` · convention de `CLAUDE.md` (« couleur = variable de `tokens.css` », O3).

### Questions liées au lot 325 (récapitulatif)

Voir 325b (D+ sur l'eau), 325g (champ de recherche des Itinéraires), 325h (catégorie Android, fond de l'icône), 325j (couleur du test de FC repos).

---

## Lot 326 · Aplatissement prudent des familles

**But** : une seule notion pour « voile ou surf », la famille (`SportFamily`), écrite une fois dans le profil de chaque calcul, et plus aucun drapeau toujours vrai ni table à entrées égales. On verra que c'est fini quand `Treatment`, `sportTreatment`, `usesMarkCourse`, `PLANNING_FAMILIES` et `TRACK_COLOR_SMOOTHING_S` n'existent plus, et que les résumés figés et le banc voile et surf sont identiques.
**Taille** gros (deux étapes : F1 petit, F2 moyen) · **Modèle** F1 : Sonnet / high (mécanique, guidé par `tsc`, la vérification compte) ; F2 : Opus / high (`docs/MODELES.md` classe « refonte transverse (famille/traitement) » en Fable high, mais la décision est prise par ce document et l'exécution est mécanique ; O1 §5) · **Risque** faible (aucun chiffre ne change ; seul `record.ts:1192` porte un comportement, identique).
**Avant** : 314 (mêmes lignes de `record.ts`) ; de préférence 304 (il emporte `planning/route.ts:112`, `planning/wayTypes.ts:49`, quatre sites `usesMarkCourse` et `PLANNING_FAMILIES` de `PlanningPage`) et 306 (il emporte `PRESET_RESETS`, qui enfreindrait la garde (a) du 327) ; F1 peut passer avant eux · **Après** : 327 (gardes (a) et (b), règles de `CLAUDE.md`), 328 · **Avant la première APK** : non.

Source : `D:\gong tracker\atelier\revue-1111\O1-familles-architecture.md`, §1, §2 et §5 (F1, F2, F4).

### Le modèle aujourd'hui (O1 §1, en bref)
- Calcul (`SportType`, `src/core/types.ts:17`) : `wingfoil | windsurf | kite | bateau | surf`. Profil (`SPORT_PROFILES`, `src/core/sportProfiles.ts:598-648`) : tout réglage numérique d'un calcul ; sous-profils qui sont des **capacités** : `jumps`, `pump`, `surf`, `withoutActiveThreshold`, `speedRangeFollowsPace`.
- Famille (`SportFamily`, `sportProfiles.ts:691`, table `SPORT_FAMILY` `:704-710`, `sportFamily` `:714`) : choisit la route et donc le module (`/${family}`, `/${family}/analyse`, `App.tsx:108-109,120-121`, `core/parentPage.ts:45-57`), l'apparence et le rangement. 227 occurrences dans 47 fichiers.
- Traitement (`Treatment`, `sportProfiles.ts:683`, table `SPORT_TREATMENT` `:696-702` **identique** à `SPORT_FAMILY`, `sportTreatment` `:712`, `activityTreatment` `core/activities.ts:168`) : 86 lignes dans 24 fichiers. Il ne distinguait quelque chose que pour le fractionné, parti.
- Trois prédicats pour « c'est de la voile » : `SAILING_SPORTS.includes(sport)` (`sportProfiles.ts:651`, lu par `core/sessionSpeed.ts:268`, `library/summaryOptions.ts:78`, `library/summary.ts:114`, `recording/liveStats.ts:252`), `sportTreatment(x) === 'voile'`, `sportFamily(x) === 'voile'` (`RecordingPage.tsx:528`) ; un pour le surf : `profile.surf !== null` / `surfProfileOf` (`surfing/surfSession.ts:49-50`).

### À faire

#### Étape F1 · Drapeaux toujours vrais et tables égales (Sonnet / high)
- `src/core/sportProfiles.ts:716-721` · supprimer `usesMarkCourse` (vaut toujours vrai) ; sites : `src/hooks/routeFiles.ts:2,38` → `activity ? markLabel : waypointLabel` ; `src/hooks/useLiveRecording.ts:3,69` → `trace && !trace.marks ? trace : null` ; `src/hooks/useMarkGuide.ts:4,118` · condition retirée ; `src/pages/RecordingPage.tsx:24,719` → `courseMarksOf = followed?.marks && liveActivity ? followed.marks : null` ; `src/pages/SettingsPage.tsx:8,603` · condition retirée (la variable `family` `:345` reste, lue `:445`) ; `src/pages/PlanningPage.tsx:40,342,395,398,691` **au 304** (si le 304 n'est pas fait, garder la fonction jusqu'à lui plutôt que d'y écrire `true`) ; test `src/core/activities.test.ts:273-278`
- `src/settings/activitySettings.ts:443-444` · supprimer `PLANNING_FAMILIES = SPORT_FAMILIES` ; `src/pages/PlanningPage.tsx:54,332` (filtre `plannable`, commentaire `:331` qui parle du fractionné), `:861` (retirer `families={PLANNING_FAMILIES}` : la prop `families` reste, d'autres appelants passent un sous-ensemble) ; `src/pages/SessionLibrary.tsx:38,503-504,635-647` (`plans` toujours vrai)
- `src/core/trackColor.ts:12-26`, `:58-65` · retirer `TRACK_COLOR_SMOOTHING_S = { voile: 0, surf: 0 }` et le paramètre `treatment` : `trackColorSpeedsMs(track)` = `track.map((p) => p.smoothedSpeedMs)`, `trackColorSegments(track, range)` ; appelants `src/pages/SailingModule.tsx:327` (littéral `'voile'`), `src/pages/SurfModule.tsx:232-235` (calcule un `treatment` pour rien), `src/library/sessionTrack.ts:44-45` ; commentaires `trackColor.ts:15-17` ; test `src/core/trackColor.test.ts:2,43-58,73` ; `meanFilterByTime` reste (lu par `core/heartRate.ts:38`) ; la phrase de `CLAUDE.md` sur la couleur de trace est au 331 (D1, précisée par O1 §3.0 : « la vitesse lissée du noyau, sans lissage de plus »)
- `src/recording/liveFields.ts:95-98`, `:105` · `DEFAULT_NOTIFICATION_FIELDS` : deux entrées égales → une constante `LiveFieldKey[]`
- `src/settings/activitySettings.ts:386-391`, `:469-470`, `:637` · `resolveFoil` ne rend jamais `null` (union fermée ; `readActivities` écarte tout calcul inconnu, `core/activities.ts:144`) → `boolean` ; `SportSettingsView.foil: boolean` (`:470`) ; lecteurs du `null` à adapter (V1) : `src/pages/SettingsPage.tsx:494` (`s.foil !== null`), `activitySettings.ts:637` (`resolveFoil(...) === null`), `src/hooks/useSportSettings.ts:283`, `:533` (`?? false`) ; la constante `FOIL_NULL` citée par la zone 1 n'existe pas
- `src/recording/liveStats.ts:123-127` · `usesActiveAverage` = `hasActiveThreshold(profile)` (la première moitié `voile || surf` est toujours vraie) ; appelants `src/hooks/useLiveRecording.ts:64,121`
- `src/hooks/sessionLibrary/addSession.ts:6`, `:105` · retirer `if (sportTreatment(sport) === 'voile')` (placé après le `return` de la branche `profile.surf`, toujours vrai) et l'import s'il n'a plus d'emploi
- `src/pages/SessionLibrary.tsx:94`, `:99-104` · `rowStats` : `else if surf` puis `else` mort (vitesse `formatLandSpeed`, « D+ ») → `else` simple, branche morte supprimée (fin réelle `:104`, V2)
- `src/pages/SettingsPage.tsx:906-920` · `thresholdHelp` : le troisième cas (`:919`, « Sous cette vitesse, la session est comptée à l'arrêt… ») n'est jamais atteint → deux cas ; commentaire `:909` avec · appelant unique `:481`
- `src/recording/markGuide.ts:59-62` · `SIMULATED_APPROACH_MS[family === 'surf' ? 'surf' : 'voile']` → `SIMULATED_APPROACH_MS[family]`, table typée `Record<SportFamily, number>`
- `src/library/stats.ts:54`, `:91` · supprimer `StatSession.treatment` (écrit, jamais lu en production : O1, non vu par les zones) ; `src/library/stats.test.ts` (≈ 10 lignes `treatment:`), `src/test/record.fixture.ts:53,68,73`
- `src/pages/Home.tsx:41-44`, `:96` · `FAMILY_PHOTO: Partial<Record<SportFamily, string>>` → `Record` complet, garde `FAMILY_PHOTO[family] &&` retirée, commentaire « les familles retirées n'ont plus de carte ni de photo » ; `src/pages/SessionLibrary.tsx:72-74`, `:592` · `banner` obligatoire, `style={(banner ? … : {})}` simplifié
- `src/core/analysisTabs.ts:91-103` · `tabDefaults(...lists)` variadique « pour un module qui change d'onglets avec l'activité (course et vélo) » → un paramètre ; appelants `src/pages/SailingModule.tsx:90`, `src/pages/SurfModule.tsx:91` ; commentaire `:94`
- `src/core/sportProfiles.ts:465-469` · `SportProfile.hrEnergy` toujours non nul (`HR_ENERGY` aux défauts voile `:552` et surf `:588`, `null` seulement dans l'ancien `WALK_PROFILE`) → type `HrEnergyProfile` ; `src/components/HeartRatePanel.tsx:37-38` (doc « `null` : pas de tuile (à pied, à vélo…) »), `:144`, `:173` · retirer les `hrEnergy &&` ; `src/components/CardioTab.tsx:13-14` (doc « rien à pied, à vélo ni en muscu ») ; test `src/core/sportProfiles.test.ts:17-22` devenu tautologique · retirer

Rangé ailleurs, à ne pas refaire en F1 (O1 les mettait dans F1) : champs morts de `HeartRateProfile` (`sportProfiles.ts:157-164,191-194`) au 325e ; `ELEVATION_PRESETS.trail` (`:44-47`) au 325b ; défauts « wingfoil » cachés (`sailing/sailingConfig.ts:17-25` et appelants) au 328.

#### Étape F2 · Fusion famille/traitement, famille dans le profil, garde de complétude (Opus / high)
Garder le nom `SportFamily` (« famille ») : 227 occurrences contre 86, c'est le mot de l'interface (« familles cachées », bibliothèque par famille) et c'est déjà lui qui choisit le module.

Ordre interne (O1 §5, F2), `tsc` vert à chaque fichier :
1. `src/core/sportProfiles.ts` · ajouter `family: SportFamily` à `SportProfile` et à chaque entrée de `SPORT_PROFILES` (via `SAILING_DEFAULTS` et `SURF_PROFILE`) ; `sportFamily = (s) => SPORT_PROFILES[s].family` ; supprimer la table `SPORT_FAMILY` (`:704-710`) ; `SAILING_SPORTS = familySports('voile')` (`:651`, même API, lecteurs inchangés).
2. `type Treatment = SportFamily` provisoire.
3. Remplacer les appelants fichier par fichier : `src/core/activities.ts:3,168` (`activityTreatment` → `activityFamily`, qui existe déjà `:166`) ; `src/core/analysisTabs.ts:2,67,74-76` (`TREATMENT_TABS` → `MODULE_TABS` ; pas `FAMILY_TABS`, nom pris par `components/AppShell.tsx:58`) ; `src/settings/activitySettings.ts:36` (`TREATMENT_UNITS` → `FAMILY_UNITS`, lu par `pages/SettingsPage.tsx:353`), `:53`, `:379`, `:387`, `:429`, `:544`, `:628` ; `src/recording/liveFields.ts:30-50` (`LIVE_FIELD_TREATMENTS` → `LIVE_FIELD_FAMILIES`), `:74-77` (`DEFAULT_LIVE_FIELDS`), `liveFieldsOfTreatment` → `liveFieldsOfFamily`, `sanitizeLiveFields` (`:115-125`) ; `src/library/shareStats.ts:14-17` (`SHARE_EXTRA_KEYS`), `:120` (`summaryBaseStats`), lu par `src/components/SavedSessionShare.tsx:71` ; `src/pages/SettingsPage.tsx:346-359`, `:481`, `:495`, `:506`, `:910-920` ; `src/pages/RecordingPage.tsx:195`, `:772-776` ; `src/pages/SessionLibrary.tsx:91-104` ; `src/hooks/useLiveRecording.ts:3,124` (`sportTreatment(activity.base) === 'surf'` à côté de `profile.surf` : garder `profile.surf`, une seule source) ; `src/library/record.ts:1192` (`treatmentChanged` → `familyChanged`, même comportement : couleurs de la trace effacées au changement de famille) ; `src/library/stats.ts:91` (déjà retiré en F1) ; avant le 304 seulement : `src/planning/route.ts:112`, `src/planning/wayTypes.ts:49`, `src/pages/PlanningPage.tsx:359,396` (paramètre `_treatment` ignoré).
4. Supprimer l'alias `Treatment`, `SPORT_TREATMENT` (`:696-702`), `sportTreatment` (`:712`), `activityTreatment`.
5. Renommer les paramètres `treatment` en `family` partout.
6. Garde de complétude dans `src/core/sportProfiles.test.ts` (squelette d'O1 §4.3, à adapter aux imports) :
```ts
describe('chaque calcul est complet', () => {
  for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
    const p = SPORT_PROFILES[sport];
    it(sport, () => {
      expect(p.id).toBe(sport);
      expect(SPORT_FAMILIES).toContain(p.family);
      expect(FAMILY_SHADES[p.family]).toContain(BASE_COLOR[sport]);
      expect(p.surf !== null).toBe(p.family === 'surf');             // le module surf lit `surf`
      if (p.family === 'voile') expect(p.thresholdUnit).toBe('kn');   // sailing/ lit les seuils en nœuds
      expect(p.hrEnergy).not.toBeNull();
    });
  }
  it('SAILING_SPORTS se déduit de la famille', () => expect(SAILING_SPORTS).toEqual(familySports('voile')));
});
```
   Elle tient aussi le défaut latent « `profile.stillThreshold` lu en nœuds » (`sailing/sailingSession.ts:110-111,162`, zone 2 D-6) et rend inutile le test tautologique de F1.
7. Réécrire les commentaires `src/core/sportProfiles.ts:677-690` (dont `:678-679` « module d'analyse », faux : le module se choisit par la famille).

Tests touchés : `src/core/activities.test.ts:4,95,100`, `src/settings/activitySettings.test.ts:8,257-258,270`, `src/recording/liveFields.test.ts:7,11,50,222`, `src/library/stats.test.ts`, `src/test/record.fixture.ts:53,68,73`, `src/core/sportProfiles.test.ts`. Taille : ≈ 20 fichiers de production après le 304 (+3 avant), ≈ 80 lignes touchées, ≈ −35 nettes.

Tables **à garder** bien qu'indexées par famille, parce que leurs entrées diffèrent : `MODULE_TABS` (ex-`TREATMENT_TABS`), `FAMILY_UNITS` (ordre différent), `LIVE_FIELD_FAMILIES` (cap, top et bord en voile seulement, `liveFields.ts:36-39`), `DEFAULT_LIVE_FIELDS`, `SHARE_EXTRA_KEYS`.

### Ce qu'il ne faut PAS aplatir (cela sert à ajouter un support demain ; O1 §2.4 et §2.5)
- **Deux familles vraies** : `sailing/` (vent, polaire, manœuvres, VMG, en nœuds sur `PointData`) contre `surfing/` (vagues, rame, attente, virages au gyroscope, en SI) ; seuil qui suit l'allure en voile, qui dépend du foil en surf (et second seuil `waveThreshold`) ; nœuds contre km/h jusque dans le stockage ; 12 onglets contre 10. Garder deux modules et `useSportSettings(family)`.
- Les **boutons par calcul du profil**, même à valeur unique : `maxGapS`, `maxSpeedWindowS`, `medianWindowSeconds`, `maxDetourRatio`, `stillThreshold`, `maxPlausibleSpeedMs`, `recording`, **`minStateDurationS`** (vaut 0 partout, mais c'est le bon outil d'un support lent qui oscille autour du seuil, déjà testé).
- Les **capacités** nulles ou non (`jumps`, `pump`, `surf`, `withoutActiveThreshold`, `speedRangeFollowsPace`, `foilDefault`) et leurs filtres d'onglets (`analysisTabs.ts:75-76,89`).
- Les **surcharges par calcul** : `SPORT_LIVE_FIELDS` (`liveFields.ts:83-85`, sert au bateau), `BASE_PRESETS` et `ACTIVITY_PRESETS` (`activityPresets.ts:48-60`) ; `SPORT_NOTIFICATION_FIELDS` et `NOTIFICATION_ONLY_FIELDS` (vides) restent jusqu'à F4.
- Les **branches `surfProfile` nul** de `src/pages/SurfModule.tsx:180,193,213,279,500` : un calcul neuf de la famille surf sans vagues y passerait. Ne pas les retirer (la zone 2 et V2 les disent mortes, O1 prime) ; la garde de complétude dit « tout calcul de la famille surf a un `surf` ».
- `speedUnit` et `thresholdUnit` distincts (`thresholdUnit` est le contrat des seuils rangés, `speedUnit` un défaut d'affichage).
- `SPORT_FAMILIES`, `hiddenFamilies`, `visibleFamilies`, le paramètre `family` de `useSportSettings` (règle 9) et des composants (`AnalysisShell`, `LiveMap`, `BaseTileLayer`…), le mécanisme d'onglet `generic` (`TopsPanel`), `Lesson.families` (`tutorials/lessons.ts:25`), les surcharges de `ManeuverOptions`.

### Ajouter un calcul, après l'aplatissement (référence ; O1 §2.5)
1. `src/core/types.ts:17` : ajouter l'identifiant à `SportType` (le compilateur liste ensuite chaque table exhaustive).
2. `src/core/sportProfiles.ts:598` : une entrée `{ ...SAILING_DEFAULTS ou ...SURF_PROFILE, id, label, family, defaultActiveThreshold, heartRate: heartRateOffset(n), … }` ; ses seuils, rien en dur ailleurs (règle 3).
3. `src/core/activities.ts:76` : `BASE_COLOR`, une nuance de sa famille.
4. `src/core/activityIcons.ts:35` : `BASE_ICON` ; icône neuve seulement si besoin (`ACTIVITY_ICON_IDS`, `ACTIVITY_ICON_LABEL`, `components/familyIcons.ts`, `components/activityArt.tsx`, `ICON_FAMILY` de `components/ProfileAvatar.tsx:20`).
5. Facultatif : `src/settings/activityPresets.ts:48` (pré-réglage), `src/recording/liveFields.ts:83` (chiffres du direct), `src/library/naming.ts:53` (`<type>` des autres applications).
6. Rien dans `pages/`, `hooks/`, `App.tsx` : le module vient de la famille (`/${family}/analyse`) ; les onglets, unités et chiffres du direct de la famille ; les capacités du profil allument sauts, pumping, vagues.
7. Tests : la garde de complétude (F2, étape 6) passe ou dit quoi compléter ; `summaryFrozen` inchangé ; un test du calcul sur trace synthétique si un seuil nouveau joue.
8. Banc : une session synthétique du calcul dans les deux pages (analyse, bibliothèque).

Une **famille** neuve coûte, elle, ≈ 20 tables et une page (tables de la famille listées en O1 §1, plus `MODULE_TABS`, `FAMILY_UNITS`, `LIVE_FIELD_FAMILIES`, `DEFAULT_LIVE_FIELDS`, `SHARE_EXTRA_KEYS`, `library/stats.ts:606-609`, `SIMULATED_APPROACH_MS`, `tokens.css` dans trois thèmes, routes de `App.tsx`) : seulement sur demande ; la garde (b) du 327 le rappelle.

### Plus tard : version poussée F4 (au premier calcul neuf demandé par GONG, pas avant)
- `SportProfile` en union discriminée par la famille : `{ family: 'voile', sailing: SailingProfile }` | `{ family: 'surf', surf: SurfProfile }` ; `SailingProfile` reçoit `defaultPolarMinSpeed` (0 jamais lu en surf), `speedRangeFollowsPace` et, si voulu, les seuils de `sailing/sailingConfig.ts`.
- `surfProfileOf`, `SAILING_SPORTS` et les branches nulles de `SurfModule` disparaissent (rétrécissement par `profile.family`) ; avec eux `minStateDurationS` s'il vaut toujours 0, `SPORT_NOTIFICATION_FIELDS` et `NOTIFICATION_ONLY_FIELDS`, `elevation` selon la réponse sur le D+.
- Fichiers (≈ 15) : `core/sportProfiles.ts`, `surfing/surfSession.ts:48-50`, `library/summary.ts:86,114,121`, `library/summaryOptions.ts:78`, `recording/liveStats.ts:252`, `core/sessionSpeed.ts:268`, `sailing/sailingConfig.ts:154,163`, `hooks/sessionLibrary/addSession.ts:100`, `settings/activitySettings.ts:50,401`, `pages/SurfModule.tsx:179-286,500`, et les tests qui construisent un profil à la main.
- Modèle Fable / high (forme du type central) ; risque moyen ; prérequis : `src/test/walkProfile.fixture.ts` parti (325c).
- Preuve : résumés figés identiques, banc voile et surf complet, `vitest run` entier.

### Pièges
- `useLiveRecording.ts:69` : la trace suivie à balises ne se compte plus « le long » ; comportement identique, le terme était toujours vrai.
- `library/sessionTrack.ts:49` suggère des couleurs pour toute la voile, bateau compris, alors que `speedRangeFollowsPace` est faux en bateau : garder tel quel en F2 (neutralité) ; passer à la capacité serait un changement à prouver au banc (vignette d'une session de bateau).
- `outils/` ne cite aucun des symboles touchés (O1 : Grep `sportTreatment|Treatment|usesMarkCourse|TRACK_COLOR_SMOOTHING_S|SAILING_SPORTS|sportFamily` vide) ; le refaire avant de finir.
- Le plan du 305 voulait garder deux types (`docs/backlog/305-e6-reduire-unions-reglages.md:50`) : la fusion revient volontairement sur ce choix (O1 §2.1).

### Vérification
- À chaque étape : `npx tsc -b --force`, `npm run lint`, `npx vitest run` complet ; `npx vitest run src/library/summaryFrozen.test.ts` identique à l'octet **sans refigeage**.
- Contrôle F1 : `rg -n "usesMarkCourse|PLANNING_FAMILIES|TRACK_COLOR_SMOOTHING_S" src` → 0 (hors `PlanningPage` si le 304 n'est pas fait). Contrôle F2 : `rg -n "\bTreatment\b|sportTreatment|activityTreatment|TREATMENT_|SPORT_FAMILY\b" src` → 0 ; `rg -n -i "traitement" src` ne rend plus rien.
- Banc avant/après : `node outils/banc/passe.mjs general surf balises --avant HEAD -j 1 --sans-cache` (F1 : analyse « général », bibliothèque avec vignettes, Réglages, Enregistrer avec un itinéraire de balises) ; F2 en plus : partage et Statistiques (scripts `partage`, `statistiques` une fois réécrits au 330).

### Questions liées
1. Deux familles, voile et surf, chacune avec sa page d'analyse : on garde ainsi ? (Si GONG voulait le kite à part, ce serait une activité « Kite » dans la voile, avec sa liste dans la bibliothèque, sans nouvelle page.) · défaut : oui · fonde F2.
2. La version « poussée » (rendre impossible, dès l'écriture du code, un sport mal décrit) : maintenant, ou le jour où GONG demande un nouveau sport ? · défaut : le jour du premier nouveau sport · F4.
3. Un sport attendu par GONG qui ne serait pas une simple activité (par exemple un « downwind foil » dont le vol commence plus bas) ? · défaut : aucun pour l'instant · s'il y en a un, il sert d'essai au chemin « ajouter un calcul ».

---

## Lot 327 · Gardes d'architecture

**But** : des tests qui empêchent le retour de la terre, de l'allure, du nom de l'ancien projet et des noms de calcul en dur, posés chacun dès que son compte est à zéro, avec un cliquet pour les comptes qui baissent encore. On verra que c'est fini quand `src/architecture.test.ts` ne contient plus la couture vide et que `src/heritage.test.ts` refuse toute hausse.
**Taille** petit par étape (cinq étapes, chacune courte) · **Modèle** Sonnet / medium (tests et documents d'après un texte donné ; O1 F3a et F3b) · **Risque** nul (faux positifs possibles sur les faux amis : exceptions nommées, jamais un motif élargi en silence).
**Avant** : selon l'étape (ci-dessous) · **Après** : aucun · **Avant la première APK** : non.

Sources : `D:\gong tracker\atelier\revue-1111\O1-familles-architecture.md` §3 et §4 ; `D:\gong tracker\atelier\revue-1111\D3-outils-banc.md` §6.

### Quand poser quoi

| Étape | Garde | Peut se poser | Attend |
|---|---|---|---|
| 327a | G1 `heritage.test.ts` à cliquet (motifs « durs » à zéro tout de suite) ; retrait de la couture vide ; garde (b) familles et routes ; règle 13, première phrase | tout de suite | rien |
| 327b | garde (a) « aucun nom de calcul en dur » ; règle 9, « Où ajouter quoi », table de `CLAUDE.md` | après 326 (F2), 306 (`PRESET_RESETS`) et 328 (`DEFAULT_SAILING_SPORT`) | ces trois lots |
| 327c | garde (c) « aucune allure (min/km) » | après 325c | 325c |
| 327d | garde (e) « vocabulaire de la terre dans les identifiants » ; motifs `runner|Runner|RUNNER` de G1 passés en dur | après 325j | 325j |
| 327e | garde (d) « aucun nom de l'ancien projet » en dur ; règle 13, seconde phrase ; G2 étendue à `android/`, `public/`, `outils/` | après 321, 322, 323 et 307 | ces lots |

Rangées ailleurs : la garde des identifiants « tracker » (`(?<![gG])tracker[.:\-_]|tracker\.json|trackerBack`, hors `legacyImport*`) est posée par le 322 (O2 §4, « garde permanente ») ; G3 (`docs-cites.mjs` refuse « Tracker » seul) au 331 ; G4 (vérificateur du registre du banc) et G6 (banc et clés de l'application) au 330 ; G5 (test de route : plus aucune route `course`, `velo`, `fractionne`) au 306, qui retire ces routes ; G7 (licences) est couverte par G1/G2.

### À faire

#### 327a · tout de suite
- `src/heritage.test.ts` (neuf) et `outils/heritage.json` (neuf) · même méthode que `src/theme/inlineStyles.test.ts` + `outils/styles-en-ligne.json` : une liste de motifs ; pour chacun un relevé figé fichier → nombre ; le test refuse une hausse ou un fichier absent du relevé, et signale une baisse pour qu'on fige plus bas. Lit tous les `.ts`, `.tsx`, `.css` de `src/` (comme `architecture.test.ts:70-74`), **commentaires compris** (la décision 3 vise aussi les commentaires). Comptes au 11/11 dans `src/`, tests compris (hors tests entre parenthèses) :
  - en dur, zéro toléré dès maintenant : `C:\\Users`, `\.claude/plans`, `D:\\gong` (0 aujourd'hui) ; y joindre le motif « chemin du poste » d'O1 (`/Users[\\/]+segne[\\/]+tracker|~\/\.claude\/plans/i`)
  - à cliquet : `(^|[^G])Tracker` 90 (53) dans 41 fichiers ; `segneur34` 5 (2) dans 4 fichiers ; `'running'` 27 (8) et `'cycling'` 11 (5) (avec les guillemets, pour écarter `adoptRunningService`) ; `\b[lL]and[A-Z]\w+` 19 (9) ; `[Ff]ractionn|[Mm]uscu|Entraînement` 74 + 55 + 37 ; `à pied|À pied` 74 ; `[Vv]élo` 162 ; `Gravel|VTT` 35 ; `runner|Runner|RUNNER` 369 dans 36 fichiers (liste blanche de noms `useRunnerProfile`, `RUNNER_BOUNDS` jusqu'au 325j) ; `Tracker complet|application complète` 32 (10)
  - refaire les comptes au moment de poser le test (ils auront baissé avec 325, 306…) ; un motif passe « en dur » dès que son compte est à zéro
- `src/architecture.test.ts:155-198` · supprimer le bloc « couture » (`TRANSVERSE`, `LAND_TARGETS`, `LAND_FILES = []` `:167`, `SEAM = []` `:170` et ses quatre `it`) : un dossier `running`, `cycling` ou `land` recréé n'aurait pas de ligne dans `ALLOWED` et ferait déjà échouer « chaque dossier de src/ a une règle » (`:131-136`) ; un import vers un dossier absent ne compile pas · −44 lignes ; en-tête `:12-14` (« land, running et cycling (course, vélo, Entraînement) sont partis aux lots 302 et 303 ») · supprimer la phrase
- Documents qui citent `LAND_FILES`/`SEAM`, dans le même commit : `CLAUDE.md:73` (règle 13, voir texte ci-dessous), `docs/ETAT_DU_PROJET.md:44,75`, `docs/INVENTAIRE.md:346`
- Garde (b) dans `src/architecture.test.ts` (O1 §4.3) :
```ts
import { SPORT_FAMILIES } from './core/sportProfiles';
it('chaque famille a sa bibliothèque et son module (règle 9)', () => {
  const app = fs.readFileSync(new URL('App.tsx', SRC), 'utf8');
  for (const f of SPORT_FAMILIES) {
    expect(app).toContain(`path="/${f}"`);
    expect(app).toContain(`path="/${f}/analyse"`);
  }
  expect(SPORT_FAMILIES).toEqual(['voile', 'surf']);
});
```
  (`App.tsx:108-109,120-121` écrivent bien ces chemins en littéraux, vérifié le 11/11.)
- Aides communes à ajouter au fichier (réutilisent `fs`, `SRC`, `sourceFiles`, `withoutComments`) :
```ts
/** Tous les fichiers .ts/.tsx/.css de src/, tests et fixtures compris. */
const allFiles = (dir: URL = SRC, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allFiles(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`)
      : /\.(ts|tsx|css)$/.test(e.name) ? [`${prefix}${e.name}`] : []);
const linesMatching = (files: string[], re: RegExp, strip = false): string[] =>
  files.flatMap((f) => {
    const text = fs.readFileSync(new URL(f, SRC), 'utf8');
    return (strip ? withoutComments(text) : text).split('\n').flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}`] : []));
  });
```
- `CLAUDE.md:73`, règle 13, première phrase (O1 §3.2) : « 13. Deux familles seulement, voile et surf (`SPORT_FAMILIES`) : ni course à pied, ni vélo, ni Entraînement, ni allure en min/km ; aucune donnée d'une autre application n'est relue, sauf par la porte d'import (GPX, FIT, paquet de session `library/sessionBundle.ts`). »

#### 327b · après 326 (F2), 306 et 328
- Garde (a) dans `src/architecture.test.ts` (aujourd'hui seuls `settings/activitySettings.ts:332,337,343` `PRESET_RESETS` et `sailing/sailingConfig.ts:17` l'enfreignent, tous deux retirés par ces lots) :
```ts
/** Seuls ces fichiers nomment un calcul : ils le décrivent. Ailleurs, on lit le profil. */
const SPORT_TABLES = ['core/types.ts', 'core/sportProfiles.ts', 'core/activities.ts', 'core/activityIcons.ts',
  'settings/activityPresets.ts', 'library/naming.ts', 'recording/liveFields.ts', 'components/familyIcons.ts',
  'components/activityArt.tsx', 'components/ProfileAvatar.tsx'];
const SPORT_NAME_EXCEPTIONS: readonly string[] = [];
it('aucune comparaison à un nom de calcul hors de ses tables (capacités du profil)', () => {
  const files = sourceFiles(SRC).filter((f) => !SPORT_TABLES.includes(f));
  expect(linesMatching(files, /[=!]==\s*'(wingfoil|windsurf|kite|bateau|surf)'|'(wingfoil|windsurf|kite|bateau)'\s*[,)\]]/, true)
    .filter((l) => !SPORT_NAME_EXCEPTIONS.includes(l))).toEqual([]);
});
```
  `'surf'` est aussi une famille : si les comparaisons de famille (`sportFamily(...) === 'surf'`) gênent, retirer `surf` du motif (décision technique, pas pour l'utilisateur). Ne jamais élargir `SPORT_TABLES` sans le dire.
- `CLAUDE.md` (O1 §3, qui prime sur D1 pour `:78`) :
  - `:69`, règle 9 : « 9. Une famille, un module d'analyse, une adresse (`/voile/analyse`, `/surf/analyse`, `core/parentPage.ts`) ; le module ne reprend que les activités de sa famille : `useSportSettings(family)`. Une session qui change de famille change de module. »
  - `:77` (nouveau calcul) : « Nouveau calcul de support : son identifiant dans `SportType` (`core/types.ts`), une entrée de `SPORT_PROFILES` avec sa famille et tous ses seuils (`core/sportProfiles.ts`), sa couleur (`BASE_COLOR`, `core/activities.ts`) et son icône (`BASE_ICON`, `core/activityIcons.ts`) ; le module, les onglets et les chiffres du direct viennent de sa famille, sauts, pumping et vagues des capacités de son profil. `core/sportProfiles.test.ts` vérifie qu'il est complet. Une activité (moth, paddle, SUP foil…) n'est jamais en dur : l'utilisateur la crée dans Réglages sur un calcul (`core/activities.ts`). »
  - `:78` (famille et traitement) : « Famille d'un calcul (`SportProfile.family`, `sportFamily`) : elle range ses sessions (bibliothèque, accueil, barre, listes d'activités, Réglages), choisit son module et ses tables propres (onglets `core/analysisTabs.ts`, unités, chiffres du direct `recording/liveFields.ts`, partage `library/shareStats.ts`). À l'intérieur d'une famille, un comportement se lit dans les capacités du profil (`jumps`, `pump`, `surf`, `withoutActiveThreshold`, `speedRangeFollowsPace`), jamais par un nom de calcul en dur (`=== 'kite'`) : `src/architecture.test.ts` le garde. »
  - `:79` (réglage utilisateur) : « Réglage utilisateur : un champ de `StoredSettings` (`settings/activitySettings.ts`), rangé par identifiant d'activité (`PER_ACTIVITY_KEYS`), écrit par une règle de `SETTING_FIELDS`, lu par son `resolve*` et `settingsView`, montré dans `pages/SettingsPage.tsx` ; son défaut par `default*Of`, qui lit le pré-réglage (`settings/activityPresets.ts`, `presetOf`) puis le profil du calcul. Le magasin et `useAllSportSettings` sont dans `hooks/useSportSettings.ts`. »
  - `:80` (page d'analyse) : « Page d'analyse : une seule par famille (règle 9) ; un calcul neuf n'en crée pas. Suivre `docs/MISE_EN_PAGE.md` (`AnalysisShell`, `AnalysisMap`, `analysisMobile.css`, `PanelTitle`, `SessionNameEditor`) ; ce qui devient commun aux deux modules va dans une pièce partagée (`components/`), pas dans une copie. »
  - `:81` (section de module) : texte de D1, complété : « … une entrée dans `SAILING_TABS` ou `SURF_TABS` (`core/analysisTabs.ts`, défauts déduits par `tabDefaults`) ; si elle dépend d'une capacité du calcul, son filtre dans `analysisTabs`/`activityTabs` ; puis un bloc `{open.cle && …}` dans un `ResizablePanel` d'`id` unique … »
  - `:85` (donnée propre à une session) : texte de D1, en précisant « écrite par `updateSessionRecord` (`hooks/sessionLibrary/sessionRecords.ts`) ».
  - Puce à ajouter après `:86` : « Calcul de glisse neuf (vol, vague, run de downwind…) : pur, dans le dossier de sa famille (`sailing/` ou `surfing/`), seuils dans le profil (règle 3) ou son sous-profil (`surf`), en SI hors `sailing/` (règle 5), testé sur trace synthétique à 1 Hz et 5 Hz (règle 2) ; s'il change un chiffre du résumé, `SUMMARY_CALC_VERSION` augmente et `library/summaryFrozen.test.ts` est refigé en le disant. »
  - Table « Avant de toucher à » (`:93-105`) : ajouter la ligne `core/sportProfiles.ts` (familles, profils, capacités), `core/analysisTabs.ts`, `recording/liveFields.ts`, `settings/activityPresets.ts` → « 1. Voile et 4. Surf, et « Où ajouter quoi » plus haut » ; `:105` devient « `pages/SettingsPage`, `pages/Home`, `core/activities` | 11. Réglages et accueil » ; les lignes `:96`, `:99`, `:101` suivent D1 (lot 331).
  - Le lot 331 (documents) ne retouche pas ces lignes : il prend le reste de D1.

#### 327c · après 325c
```ts
it('aucune allure (min/km) : des vitesses seulement', () => {
  expect(linesMatching(allFiles(), /'minkm'|min\/km|\b(formatPace|msToPace|isInverseUnit|PACE_MIN_SPEED_MS)\b/)).toEqual([]);
});
```

#### 327d · après 325j
```ts
const LAND_WORDS = /\b\w*(Runner|Cycling|Bike|Walk|Muscu|Fractionne|Interval(?!Ms))\w*\b|formatLandSpeed|RUNNER_/;
const LAND_EXCEPTIONS: readonly string[] = [];  // ex. « hooks/useRecorder.ts:NNN » pour adoptRunningService si le motif l'attrape
```
`BeeperPlugin.setInterval` et `intervalMs` sont exclus par le motif. Passer en dur les motifs `runner|Runner|RUNNER` de G1.

#### 327e · après 321, 322, 323 et 307
```ts
const OLD_PROJECT: readonly [string, RegExp][] = [
  ['chemin du poste', /Users[\\/]+segne[\\/]+tracker|~\/\.claude\/plans/i],
  ['dépôt', /segneur34\/Tracker\b/],
  ['application complète', /application complète|Tracker complet/i],
  ['nom', /\bTracker\b/],                    // « Gtracker » ne correspond pas (pas de frontière de mot)
  ['clé ou format', /['"`<]tracker[._:-]/],  // déjà tenu par la garde du 322
];
/** Lus par la porte d'import (« fichier:ligne  nom ») : la liste ne fait que diminuer. */
const IMPORT_DOOR: readonly string[] = [];
it('aucune trace de l’ancien projet dans les sources (décision du 11/11)', () => {
  const found = allFiles().flatMap((f) => OLD_PROJECT.flatMap(([name, re]) =>
    linesMatching([f], re).map((l) => `${l}  ${name}`)));
  expect(found.filter((l) => !IMPORT_DOOR.includes(l))).toEqual([]);
});
it('chaque exception de la porte d’import existe encore', () => { /* comme architecture.test.ts:143-147 */ });
```
- `IMPORT_DOOR` : les lignes de `src/library/legacyImport.ts`, `legacyImport.test.ts`, `src/test/legacyImport.fixture.ts` (O2) qui lisent l'ancien préfixe ; rien d'autre.
- G2 : étendre G1 et (d), si l'utilisateur le veut, à `index.html`, `package.json`, `capacitor.config.ts`, `android/app/src/main/res/values/*.xml`, `android/app/src/main/java`, `public/`, `outils/` (chemins hors `src/` : `new URL('../…', SRC)`) ; `outils/` compte 14 « Tracker » hors `tracker.*` (D3 §4-5).
- `CLAUDE.md:73`, règle 13, seconde phrase : « Aucun nom de l'ancien projet dans les sources ; `src/architecture.test.ts` le garde, avec sa liste nommée d'exceptions de la porte d'import, qui ne fait que diminuer. »

### Pièges
- `src/architecture.test.ts` lit le disque : `vitest --changed` ne le prend pas ; le lancer à part.
- Ne pas mélanger G1 (cliquet, tolère l'existant) et (d) (dur) : (d) ne se pose qu'une fois les comptes de G1 à zéro pour ses motifs.
- Faux amis du brief (`<course>`, `gpxtpx:course`, « cadence » du pumping, `running` « en cours », `landingMs`, `--surface`, `TURN_STRIDE_MIN_S`, `BeeperPlugin.setInterval`) : les motifs les écartent ; sinon exception nommée.

### Vérification
- `npx vitest run src/architecture.test.ts src/heritage.test.ts` ; `npm run verif` (renvois des documents).
- À chaque garde posée : un essai volontaire (ajouter `'minkm'`, `Tracker` ou `=== 'kite'` dans un fichier, voir l'échec, retirer).
- Après 327a : `rg -n "LAND_FILES|SEAM" src CLAUDE.md docs` → 0 (hors `docs/HISTORIQUE.md`).

---

## Lot 328 · Voile : une seule voie de calcul, seuils sans défaut caché

**But** : le calcul de la voile n'a plus qu'un chemin, celui que l'application livre, et aucune fonction ne retombe en silence sur les seuils du wingfoil. On verra que c'est fini quand les recherches de contrôle rendent 0 (y compris dans `outils/banc/`) et que le banc `general` est identique avant et après.
**Taille** moyen (étape a : ≈ 100 lignes de code et des tests à réorienter ; étape b : ≈ 30 lignes ; étapes c et d facultatives) · **Modèle** a : Opus / high (noyau du calcul, mais neutre) ; b : Sonnet / high (le compilateur trouve les appelants, le banc prouve la neutralité) ; c : Sonnet / high ; d : Sonnet / high (déplacements purs) · **Risque** moyen pour a (on touche les tests du noyau : un test réorienté qui éprouve moins qu'avant passerait inaperçu), faible pour b.
**Avant** : rien d'obligatoire ; 326 (F1) de préférence, qui retire le paramètre `treatment` de `trackColor` appelé par les deux modules · **Après** : 327b (garde (a) « aucun nom de calcul en dur » : `sailingConfig.ts:17` l'enfreint aujourd'hui) · **Avant la première APK** : non.

Sources : `D:\gong tracker\atelier\revue-1111\zone2-sailing-surfing.md` (§2 à §5), `O4-pertinence-defauts.md` (§1, §3 points 5, 6, 11), nuances de `V2-verification-zones-2-4-5-7-8.md`.

### Règles à ne pas enfreindre (`CLAUDE.md`)
- **Règle 5** : `sailing/*` travaille en nœuds sur `PointData` (`sailing/pointData.ts`) : héritage assumé, **pas de conversion** sans plan dédié. Aucun de ces changements ne passe la voile en SI.
- **Règle 7** : le vent se lit à la bissectrice de chaque manœuvre classée, toutes comprises ; statistiques pondérées par la symétrie du virage, **jamais filtrées** (`calculateWindStats`) ; l'estimation globale (`estimateWind`) repose sur la polaire et les manœuvres à caps stabilisés (`windSamplesFrom`). **Polaire glissante et corde entrée → sortie ont été essayées puis retirées : ne pas les réintroduire**, même en réécrivant les tests de la seconde voie.
- Règles 2 (fenêtres en secondes, test 1 Hz / 5 Hz), 3 (aucun seuil en dur, surchargeable : les surcharges de `ManeuverOptions` restent), 10 (un virage peut tenir dans un seul intervalle).

### À faire

#### Étape a · une seule voie (Opus / high)
Seconde API de la polaire et de la mesure que seuls des tests exercent ; un acheteur qui lit les tests croirait que c'est le chemin livré (O4 §2).
- `src/sailing/wind.ts:719-723` `estimateWindPolar` et `:703-708` `WindEstimateOptions` · supprimer · tests seuls (`wind.test.ts:239`, `maneuvers.test.ts:1239,1285,1309`) ; la production passe par `prepareWindPolar` → `orientPolar` (`estimateWind`)
- `src/sailing/wind.ts:401-404` `estimateWindFromPolar` · supprimer (seul appelant `estimateWindPolar`, `:722` ; tests `wind.test.ts:161`, `maneuvers.test.ts:1205`)
- `src/sailing/wind.ts:357-361` `polarWindCandidates` · supprimer (interne via `estimateWindFromPolar` `:404` ; la production appelle `candidatesOf` dans `prepareWindPolar` `:817` ; tests `wind.test.ts:234`, `windSessions.test.ts:80`)
- `src/sailing/wind.ts:386-390` `describeWindCandidate` · supprimer (production : `describeDirection` ; tests `wind.test.ts:191-206`, `maneuvers.test.ts:1294`)
- `src/sailing/wind.ts:246` `scoreWindCandidate` · retirer seulement `export` (interne `:335`, `:336`, `:366` ; test `wind.test.ts:116` à réorienter)
- `src/sailing/maneuvers.ts:1084-1106` `measureManeuver` (fonction `:1101`) et `:966-975` `DetectedTurn` (`:967`) · supprimer (la production passe par `measureRotation` + `windwardGainM` ; tests `maneuvers.test.ts:14,730,759`)
- `src/sailing/maneuvers.ts:1932-1942` `analyzeManeuvers` (doc dès `:1932`, fonction `:1938`) · supprimer ; **adapter dans le même commit** `outils/banc/manoeuvres-diagnostic.mjs:42`, `:147`, `:153` (il l'appelle : passer à `classifyManeuvers(prepareManeuverDetection(...))`, V2) et le paragraphe `outils/banc/SCRIPTS.md:110-117` s'il cite la fonction
- `src/sailing/sailingSession.ts:276-290` `analyzeSailingSession` et `sailingSessionThresholds` · six lignes qui enchaînent les mêmes étapes que le hook (`prepareSailingTrack`, `analyzeSailingAtThreshold`, `analyzeSailingWind`, `sailingPolarGraph`) ; le hook `src/hooks/useSailingSession.ts:93-132` les rejoue avec ses `useMemo` et son seuil différé. Deux consommateurs, tous deux de test : `src/test/sailing.fixture.ts:11,387` **et** `src/sailing/sailingSession.test.ts` (`:15,36,46,84,116,128`, tests de la règle 4 et du seuil, V2) · par défaut, déplacer la fonction dans un fichier d'aide de test (`src/test/sailing.fixture.ts`, nommée comme telle) et garder `sailingSession.test.ts` tel quel en changeant son import ; `sailingSessionThresholds` n'est utilisé qu'en interne (`:286`) : il suit la fonction. Variante (O4) : supprimer et réécrire `sailingSession.test.ts` sur les étapes que le hook appelle.
- Réécrire les tests touchés (`src/sailing/wind.test.ts`, `src/sailing/windSessions.test.ts`, `src/sailing/maneuvers.test.ts`) sur `prepareWindPolar` / `estimateWind` / `prepareManeuverDetection` + `classifyManeuvers`, c'est-à-dire le comportement livré ; à chaque test retiré, dire dans le commit quel test de la voie livrée couvre le même cas.
- Exports à retirer (usage interne seul ; knip, V2), une fois les tests réorientés : `tackOf` (`maneuvers.ts:92`, interne `:1916`), `maneuverAgreement` (`:356`, interne `:529`), `stableSegment` (`:690`, interne `:1617` ; commentaire `:681` « Exporté pour son test ») si les tests passent par `classifyManeuvers` ; `longestUnderMs` (`:1144`), `windwardGainM` (`:1275`, utilisé `:1105,:1919`), `measureRotation` (`:1292`, utilisé `:1103,:1670`) : garder les fonctions, retirer `export` ; types `ManeuverRejections`, `RejectedTurn`, `SpeedMeasure`, `RotationMeasure`, `SpeedSample`, `DetectionSettings`, `TurnReading` ; `toPointData` (`pointData.ts:40`, utilisé `:58`) ; `WIND_INPUT_WARNING_DEG` (`sailingAnalytics.ts:471`), types `VmgCell`, `ManeuverTypeSummary`, `ManeuverTackSummary`, `ManeuversByTack` ; `SPEED_RANGE_MAX_MARGIN_KN` (`sailingConfig.ts:176`) ; `NO_GO_HALF_ANGLE` (`wind.ts:219`), `UPWIND_SECTOR` (`:221`), `buildMaxSpeedsByBearing`, `POLAR_SUPPORT_INTERVAL_S` (`:294`), `TURNING_RATE_MIN_DEG_S` (`:424`), `orientationVotes` (`:670`, utilisé `:740`), type `OrientationVote` ; `surfing/gyroTurns.ts` : types `GyroTurn`, `WaveTurnTrace` (la fonction `waveTurnTrace` garde son `export` : banc `virages-diagnostic.mjs:42,99`)
- `src/sailing/maneuvers.test.ts` (2 375 lignes) · le scinder par thème (détection, classement, mesure, vent) pendant la réorientation, sans changer les attentes

#### Étape b · seuils sans défaut caché et petites corrections (Sonnet / high)
- `src/sailing/sailingConfig.ts:16-17` `DEFAULT_SAILING_SPORT = 'wingfoil'`, `:19-21` `getDefaultThresholdKn`, `:23-25` `getStillSpeedKn` · supprimer ; rendre obligatoires les paramètres qui y puisaient : `src/sailing/sailingStats.ts:9` (import), `:67` (`options.sport ?? DEFAULT_SAILING_SPORT`), `:69` (`activeThresholdKn ?? getDefaultThresholdKn(sport)`) ; `src/sailing/maneuvers.ts:22-23` (imports), `:1386` (`stillSpeedKn ?? getStillSpeedKn()`), `:1694` (`successThresholdKn ?? getDefaultThresholdKn()`) ; `src/sailing/sailingAnalytics.ts:6`, `:585` et `:685` (`minSpeedKn = getDefaultThresholdKn()`). Tous les appelants de production passent déjà ces valeurs (`src/sailing/sailingSession.ts:111,123,152,159,162,203,231-232`) ; `summary.ts` et `recording/liveLegs.ts` n'appellent aucune de ces fonctions ; seul le banc `manoeuvres-diagnostic.mjs:102` appelle `buildSailingSessionStats`, avec `sport`. Les tests (`src/sailing/sailingConfig.test.ts:100` et ceux qui comptaient sur 8 nœuds) passent le support. Scénario évité : un appelant futur pour un bateau ou un kite tomberait sans le savoir sur un plancher d'arrêt de 1 nœud et une réussite à 8 nœuds de wingfoil · ≈ 15 lignes
- `src/sailing/wind.ts:410-413` · supprimer `ORIENTATION_MIN_TURN_DEG = 60` et `ORIENTATION_WINDOW_S = 12` ; `observeTurns` (`:598-655`, qui importe déjà `MANEUVER_MIN_COHERENCE` et `MANEUVER_MAX_STEP_S`) lit `MANEUVER_MIN_TURN_DEG` et `MANEUVER_WINDOW_S` (`sailingConfig.ts:29,70`) : une seule source pour « un virage est vu des deux côtés ou d'aucun » (mêmes valeurs, mêmes comparaisons strictes que `maneuvers.ts:1379,1387,1531,1535`) · ≈ 4 lignes
- `src/sailing/maneuvers.ts:627` · nommer le coefficient `0.9` (`Math.max(polarConfidence, maneuverConfidence * 0.9)`) : `MANEUVER_CONFIDENCE_DISCOUNT`, à côté de `POLAR_MIN_WEIGHT`, `MANEUVER_WEIGHT`, `MANEUVERS_FOR_FULL_WEIGHT` (`:319-324`) · 2 lignes, valeur inchangée
- `src/sailing/wind.ts:60-65` · `PolarManeuver.type: string` → `ManeuverKind` (import de type seulement ; `polarExcludedPoints` compare à `'tack'`)
- `src/sailing/sailingAnalytics.ts:581-591` (`calculateVmgStats(trackData, wind, minSpeedKn, windowSeconds, maxGapS, maneuvers)`) et `:681-690` (`vmgSeries(trackData, wind, minSpeedKn, maneuvers, windowSeconds, maxGapS)`) · paramètres dans deux ordres ; l'appel `src/sailing/sailingSession.ts:231-232` saute deux positions (`…, computeThresholdKn, undefined, undefined, maneuvers`) → un objet d'options `{ minSpeedKn, maneuvers, windowSeconds?, maxGapS? }` pour les deux ; tests à suivre
- `src/sailing/sailingAnalytics.ts:125-133` · `calculateWindStats(trackData, …)` ne lit `trackData` que pour `trackData.length === 0` (`:130`) : retirer le paramètre, garde sur `maneuverStats` ; appelant `sailingSession.ts:217` + tests (non recontrôlé par V2 : relire avant)
- `src/sailing/sailingAnalytics.ts:79`, `:226` · alias `MAX_INTERPOLATION_GAP_MIN = WIND_LOCAL_MAX_GAP_MIN` et `type ManeuverType = ManeuverKind` : utiliser directement
- `src/sailing/sailingStats.ts:37-38`, `:46-48`, `:104-108` · `sailingActivityMask`, `sailingRatioMask`, `sailingFlights` rappellent `getSportProfile(sport)` alors que l'appelant (`sailingSession.ts:149`) a déjà `prepared.profile` (qui peut être surchargé, `:65`, le `sport` non) : leur passer le profil, ce qui supprime aussi un risque d'incohérence · ≈ 6 lignes
- `src/sailing/sailingStats.ts:462` · le commentaire renvoie à « DECISIONS §2, « Rien en voile » » (section Course et vélo) : la règle vit en §1 (voile)
- `src/surfing/gpsTurns.ts:6-8` · « les vrais virages viendront du gyroscope » → « les virages du gyroscope les remplacent quand la capture existe » (`gyroTurns.ts` existe)
- `src/surfing/surfSession.ts` · ajouter un test direct de `effectiveWaveThreshold` (`null` → seuil du profil, valeur → valeur), trois lignes

#### Étape c · doublons entre `SailingModule` et `SurfModule` (Sonnet / high, facultatif)
« Ce qui devient commun à deux modules va dans une pièce partagée » (`CLAUDE.md`, « Où ajouter quoi »).
- (a) `firstMs` + `retainSessionHrMax` + `showCardioOnMap` : `src/pages/SailingModule.tsx:482-485` ≈ `src/pages/SurfModule.tsx:386-389`
- (b) `speedCell` : `SurfModule.tsx:291`, recopié en ligne `SailingModule.tsx:700,721`
- (c) ligne « FC moyenne » : `SailingModule.tsx:337-339` ≈ `SurfModule.tsx:256`
- (d) `useZoomOnMap` + `useAnalysisHeart` + `useSessionMarks` + `shownMark` : `SailingModule.tsx:273-277,467-480` ≈ `SurfModule.tsx:207-211,373-384`
- (e) bloc `FlightsPanel`/`PumpingPanel` : `SailingModule.tsx:686-726`, quasi identique à celui du surf
- `thStyle`, `tdStyle`, `orDash` définis à l'identique dans `SurfModule.tsx:120-123` et `components/FlightPumpingPanel.tsx:70-77` → `components/tableStyle.ts`
- Proposé : un hook `useCardioShortcuts(track, retainHr, zoomOnMap)` et un formateur `speedCellOf(unit)` règlent (a), (b), (c) · ≈ 40 lignes retirées · banc voile et surf avant/après

#### Étape d · découpages (après a, facultatif)
- `src/sailing/maneuvers.ts` (1 942 lignes, quatre rôles) : estimation du vent par les manœuvres (`:356-636`), mesure d'une rotation (`:741-1348`), détection (`:1354-1676`), classement (`:1678-1930`) → `maneuverMeasure.ts`, `windEstimate.ts` et le reste : trois fichiers de 500 à 700 lignes. Après l'étape a, sinon on déplace du code mort.
- `src/pages/SailingModule.tsx` (`SailingModule` `:92-755`, ≈ 660 lignes) et `src/pages/SurfModule.tsx` (`:157-833`, ≈ 680 lignes) : extraire les panneaux ; pour le surf, constantes et petits composants `:94-155` → `surf/surfParts.ts`, tables de vagues `:544-617` (+ tri `:202`, `:333-337`) → `components/surf/WavesPanel.tsx`, table de rame `:618-672` → `PaddlePanel.tsx`, sur le modèle de `components/sailing/*` ; lié au lot 309 (dette de l'audit).

### Pièges
- `outils/banc/manoeuvres-diagnostic.mjs` appelle `analyzeManeuvers` : le supprimer sans adapter le script le casse (V2). Les scripts qui chargent le TypeScript par `outils/banc/charge-ts.mjs` ne sont pas vus par knip ni par `tsc` : `rg` dans `outils/` avant chaque suppression.
- `analyzeSailingSession` a deux consommateurs de test, pas un (V2) : `sailingSession.test.ts` est tout un fichier de tests de la règle 4 et du seuil.
- NE PAS retirer les surcharges de `ManeuverOptions` (`maneuvers.ts:27-71`, dix noms jamais passés par la production) : la règle 3 les veut surchargeables (zone 2, question 2, défaut « garder »).
- NE PAS rendre obligatoires `PointData.speedKn?` et `stepDistanceM?` (`pointData.ts:25-33,44`) : gain faible, réécriture des générateurs de test (zone 2, question 3, défaut « ne pas toucher »).
- NE PAS retirer les branches `surfProfile` nul de `SurfModule` (O1 §2.5, voir 326).
- `trackColorSegments(track, 'voile', …)` (`SailingModule.tsx:327`) est au 326 ; le renommage `runner` des modules au 325j ; la garde « `thresholdUnit === 'kn'` en voile » au 326 (garde de complétude).
- La fonction d'orientation `observeTurns` ne reçoit pas les surcharges de la détection (`windowSeconds`, `minTurnDeg`, `minCoherence`, `maxStepSeconds`) : l'étape b partage les constantes, mais ne fait pas passer `DetectionSettings` à `observeTurns` (voir « Bon à savoir »).

### Vérification
- `npx vitest run src/sailing src/surfing src/core/trackColor.test.ts src/library/summary.test.ts` après chaque suppression ; `npm run verif` en fin d'étape ; `npx vitest run src/library/summaryFrozen.test.ts` identique.
- Banc avant/après identique : `node outils/banc/passe.mjs general graphes vides --avant HEAD -j 1 --sans-cache` (étapes a et b) ; plus `surf` pour l'étape c ; essai à la main de `node outils/banc/manoeuvres-diagnostic.mjs <brouillon>/voile.gpx` après `node outils/banc/make-gpx.mjs <brouillon>/voile.gpx` (attendu : 12 virements ratés, 12 empannages réussis, vent 4°, `SCRIPTS.md:117`).
- Recherches de contrôle → 0 dans `src/` et `outils/` : `rg -n "analyzeManeuvers|measureManeuver|estimateWindPolar|estimateWindFromPolar|polarWindCandidates|describeWindCandidate|DetectedTurn|WindEstimateOptions" src outils` (hors l'aide de test si `analyzeSailingSession` y est déplacée) ; `rg -n "DEFAULT_SAILING_SPORT|getDefaultThresholdKn|getStillSpeedKn|ORIENTATION_MIN_TURN_DEG|ORIENTATION_WINDOW_S" src outils`.

### Questions liées
1. Les seuils nommés en tête des fichiers de calcul de la voile (une trentaine : `CLASSIFICATION_TOLERANCE_DEG`, `SHORT_ARC_DOUBT_DEG`, `RELAUNCH_MAX_S`, `NO_GO_HALF_ANGLE`, `UPWIND_SECTOR`, `POLAR_BIN_DEG`… dans `maneuvers.ts:293-294,743-777,1459`, `wind.ts:218-223,411-417`, `sailingAnalytics.ts:101,103,471`) ne sont ni dans le profil ni surchargeables : on les tolère en le disant dans la règle 3 de `CLAUDE.md`, ou on les remonte tous dans `sailingConfig.ts` ? · défaut : tolérés, une phrase dans la règle 3 (zone 2, D-3) · « les remonter » est un gros lot à part.
2. `analyzeSailingSession` : la déplacer dans les aides de test (proposé) ou la supprimer en réécrivant ses tests ? · défaut : la déplacer · change la taille de l'étape a.

---

## Lot 329 · Enregistrement : « Jeter » qui échoue sans message, message faux, découpage de `useRecorder`

**But** : aucune action de fin d'enregistrement n'échoue sans le dire ni ne dit une chose fausse, et `useRecorder.ts` devient testable étape par étape. On verra que c'est fini quand un échec d'effacement du journal donne un message juste, et que le découpage laisse `useRecorder*.test.ts` et le banc d'enregistrement identiques.
**Taille** petit (étapes 1 et 2) puis gros (étape 3) · **Modèle** 1 et 2 : Sonnet / high (petits bugs avec scénario) ; 3 : Opus / high (machine à état de module, ≈ 1 350 lignes) · **Risque** nul pour 1, faible pour 2, moyen pour 3 (état partagé entre départ, pause, reprise, arrêt et reprise après chute).
**Avant** : étape 1, aucun ; étapes 2 et 3, le lot **313** (`docs/BACKLOG.md:44` : « la fin d'un enregistrement ouvre directement l'analyse, sans écran « Analyser / Jeter » ; « Jeter » devient une action de la page d'analyse, en appui long… », qui retouche les mêmes lignes) · **Après** : aucun · **Avant la première APK** : non.

Sources : `D:\gong tracker\atelier\revue-1111\O4-pertinence-defauts.md` §2 et §3 (point 10), `zone3-hooks.md` §8, `O3-relecture-305.md` (journal sans position).

### Ce qui se fait avant le 313, avec lui, après lui
| Étape | Quoi | Quand |
|---|---|---|
| 1 | Message faux quand le journal ne s'efface pas ; journal sans position supprimé sans le dire (commentaire à aligner) | avant le 313, indépendant |
| 2 | « Jeter » sans `catch` ; foil lu au moment d'« Analyser » | avec le 313 (il déplace « Jeter » dans l'analyse et rend l'analyse immédiate) |
| 3 | `useRecorder.ts` en quatre pièces, état de session en un objet | après le 313 |

### À faire

#### Étape 1 · avant le 313
- `src/hooks/useRecorder.ts:566-578` (`rangePendingSession`) · aujourd'hui une seule `try` couvre l'écriture du GPX (`saveRecordedSession`, `:569`) **et** le ménage (`recordingJournal.remove()` `:570`, `removeMotionCapture` `:571`) ; si le GPX est rangé mais que le journal ne s'efface pas, le message dit « Enregistrement du GPX impossible : … La session reste en attente. » (`:576`) alors qu'elle est dans la mémoire, et « Analyser » de nouveau la retrouve en double sans rien faire de plus (`hooks/sessionLibrary/addSession.ts:152-175`). Séparer : écriture du GPX dans sa `try` (message actuel en cas d'échec) ; ménage dans une seconde `try` qui, en cas d'échec, range quand même la session (`saved`) et dit « Session rangée ; le journal d'enregistrement n'a pas pu être effacé » · ≈ 8 lignes ; test dans `src/hooks/useRecorder.test.ts` (journal dont `remove` rejette : `saved` posé, message juste)
- `src/hooks/useRecorder.ts:844-862` (avec `buildPendingSession`, `:518-532`) · un journal sans en-tête lisible et sans aucune position (cas d'un journal de muscu d'une version d'avant le 302 : `muscu` n'est plus un calcul) est supprimé sans rien dire (`recordingJournal.remove()`), alors que le commentaire `:872-874` promet qu'un journal présent n'est jamais pris pour absent ; le lot 305 a retiré la branche « Session de muscu interrompue… » et son test (O3). Scénario quasi impossible (Gtracker 0.00.00 à 0.00.02 seulement, aucune APK installée) · par défaut : **accepter** et corriger le commentaire `:872-874` (dire qu'un journal sans position est effacé) ; variante : mettre de côté un journal sans en-tête lisible au lieu de le supprimer (`setJournalAside`). Le commentaire d'en-tête `:106-108` est réécrit au 325g.

#### Étape 2 · avec le 313
- `src/hooks/useRecorder.ts:603-608` (`discardPendingSession`) et `src/pages/RecordingPage.tsx:762-766` (`void discardPendingSession()`) · `recordingJournal.remove()` et `removeMotionCapture()` sans `catch`, appelés en `void` : un échec laisse la session en attente, sans message, et une promesse rejetée non traitée · ajouter un `catch` qui garde la session en attente et pose un message (« La session n'a pas pu être jetée : … ») ; à écrire là où le 313 pose « Jeter » (page d'analyse, appui long puis confirmation) · ≈ 5 lignes + test
- `src/hooks/useRecorder.ts:567-568` · le commentaire dit « le foil de l'activité au moment de l'enregistrement », mais il est lu à « Analyser », qui peut venir des heures plus tard (session reprise du journal) : un foil changé dans Réglages entre-temps est pris pour celui du jour ; c'est aussi ce qui fige le foil dans chaque fiche (cause B du 314) et rend la case « par défaut » (`foilIsDefault`) toujours fausse pour une session enregistrée · avec le 313 (analyse ouverte dès la fin), l'écart disparaît presque : corriger le commentaire ; si le 313 n'ouvre pas l'analyse immédiatement, lire le foil au départ (en-tête du journal) · risque faible

#### Étape 3 · après le 313 : `useRecorder.ts` en quatre pièces (sans changement de comportement)
Le fichier fait 1 354 lignes et partage une trentaine de variables de module (`:243-299` : `fixes`, `segmentBreaks`, `pendingLines`, `lastFlushMs`, `stopSource`, `currentSource`, `currentProfile`, `lastReceivedMs`, `lastReceivedFix`, `lastReceivedAtMs`, `belowSinceMs`, `pendingBreak`, `manualBreakAutoPartMs`, `resumedSession`, `pauseFixes`, `writes`, `startedAtMs`, `marks`, `heartRateMaxAgeS`, `dropBelt`, `sourceError` ; `:318-368` veilles ; `:582` `ranging` ; `:621` `running` ; `:826` `recovering`) entre départ, pause, reprise, arrêt, reprise après chute et rangement. Le code est soigné (commandes sérialisées par `runCommand`/`exclusive`/`afterCurrent`, journal ordonné, chaque `catch` dit) ; le but est qu'un repreneur puisse tester une étape seule. Lignes de coupe (O4, précisées par la zone 3) :
- `src/hooks/recorderJournal.ts` · tampon du journal (`pendingLines`, `lastFlushMs`), `flushJournal`, `enqueueWrite`, `writes`
- `src/hooks/recorderWatches.ts` · veilles GPS perdu et ceinture perdue, `useRecorder.ts:307-406` (`GPS_LOST_ERROR`, `BELT_LOST_ERROR`, `applyGpsWatch`, `applyBeltWatch`, `gpsWatch` `:318`, `beltWatch` `:364` et leurs messages) : ≈ 120 lignes jumelles, comme `src/platform/beeper.ts:210-316` ; avec, si on le veut, la ceinture `:889-940` (`takeBelt`, `wireBelt`, `releaseRecordingBelt`, ≈ 50 lignes)
- `src/hooks/recorderRecovery.ts` · reprise et récupération, `:660-884` (`setJournalAside`, `journalSession`, `recoveryFactsOf`, `restoreFromJournal`, `resumeSilently`, `recoverOnce`, `recoverInterruptedRecording`, `continuePendingSession`) : ≈ 225 lignes, déjà couvertes par `src/hooks/useRecorder.resume.test.ts` (915 lignes)
- l'état de session dans un objet unique `session` plutôt que quinze `let`
- (zone 3, facultatif) lectures hors React et hooks `:1284-1337` (`getLive*`, `useLivePosition`, `useRecorderSelector`, `useRecordingClock`) → `src/hooks/useRecorderViews.ts`
- Les variables de module restent partagées : passer l'état par l'objet commun, sans import cyclique.

### Pièges
- Le 313 retouche `rangePendingSession`, `discardPendingSession` et `RecordingPage.tsx` : l'étape 1 est courte et indépendante ; les étapes 2 et 3 se font sur le code du 313, pas avant.
- `useRecorder.ts:614` (`notificationTitle: 'Tracker enregistre'`) est au 322 ; les commentaires `:106-108`, `:968`, `:1151` au 325g.
- Règle 12 : le découpage ne fait sortir aucun accès direct au stockage, aux fichiers ni aux capteurs de `src/platform/`.
- Garder chaque message d'erreur existant à l'octet (le banc les lit).

### Vérification
- `npx vitest run src/hooks/useRecorder.test.ts src/hooks/useRecorder.resume.test.ts src/recording` ; `npm run verif`.
- Banc (étape 3, avant/après identique) : `node outils/banc/passe.mjs session-save session-save-resume gps-perdu notification --avant HEAD -j 1 --sans-cache`.
- Essai au téléphone (un seul, après l'étape 2) : enregistrer deux minutes, finir, jeter depuis l'analyse ; puis enregistrer, couper l'application, la rouvrir (reprise du journal), ranger.

### Questions liées
1. Le foil d'une session enregistrée : celui de l'activité au départ (proposé) ou au moment de l'analyse ? · défaut : au départ · ne compte que si le 313 n'ouvre pas l'analyse immédiatement.
2. Un journal d'enregistrement illisible et sans position : l'effacer (aujourd'hui) ou le mettre de côté ? · défaut : l'effacer et le dire dans le commentaire · aucun cas réel connu.

---

## Suppressions écartées par la contre-vérification

Treize constats des rapports de zone ont été **infirmés** par `V1-verification-zones-1-3-6.md` (n° 1 à 3) et `V2-verification-zones-2-4-5-7-8.md` (n° 4 à 13). Ne pas les reproposer.

1. `src/core/units.ts:200` · retirer `knotsToDisplay` (« tests seuls ») · faux : lu par `formatKnots` (`:211`) et `knotsToChartValue` (`:222`), eux-mêmes en production (`components/sailing/sailingChartParts.tsx:9,94`, `pages/SailingModule.tsx:31,170,421`) ; seule sa branche `minkm` part (325c).
2. `src/recording/zoneAlert.ts:68` et `:65` · retirer `typedBoundBpm` et `BAND_BPM_RANGE` (« aucun appelant hors zoneAlert.ts et tests ») · faux : `validBand` (`:94`) appelle `typedBoundBpm` (`:96`), qui prend `BAND_BPM_RANGE` par défaut ; `validBand` est sur le chemin vivant de l'alerte de zone (`setupBand`, `:241-242`). Retirer seulement `export`, après 325d.
3. `src/recording/zoneAlert.ts:38`, `:48`, `:94` · retirer `HeartBand`, `zoneBand`, `validBand` avec la « course à bornes » · faux : ils calculent la zone visée (`zoneBand` appelé `:73` et `:241` ; `validBand` appelé `:152`, `:157`, `:242` et `hooks/useZoneAlert.ts:91`).
4. `src/components/ui/Button.tsx:9` et `ui.css` `.ui-btn--l` · retirer la taille `'l'` (« aucun `size="l"` ») · faux : sept boutons la posent, `src/pages/RecordingPage.tsx:317,342,357,927,933,944,948` (classe construite `ui-btn--${size}`, `Button.tsx:18`).
5. `src/components/ui/ui.css` `.ui-help--s`, `.ui-help--xs` · retirer · faux : `xs` est le défaut de `HelpToggle` (`components/Help.tsx:38`) ; `s` est passé par `JumpsPanel.tsx:301`, `MemoryStatus.tsx:123`, `PanelTitle.tsx:34`, `RestingHrTestPage.tsx:105,168,205`, `SettingsPage.tsx:900` ; le banc vise `button.ui-help--xs` (`outils/banc/cardio.mjs:188,192`).
6. `src/components/ui/ui.css` `.page-backdrop--contours`, `--surf`, `--voile` · retirer · faux : `BackdropVariant = 'contours' | SportFamily` (`core/backdropPattern.ts:260`) ; `'contours'` est le repli de `hooks/useFavoriteBackdrop.ts:17` ; `voile` et `surf` viennent de `PageBackdrop variant={family}` (`pages/SessionLibrary.tsx:590`). (Les classes `__dots`, `__thin`, `__fill`, elles, sont mortes : 325h.)
7. `src/theme/tokens.css:143,231,283` · retirer `--surf-soft` (« jamais lu ») · faux : `components/SessionNotesPanel.tsx:63` construit `` `var(--${family}-soft)` `` et le lit `:148` ; `NotesTab family="surf"` (`pages/SurfModule.tsx:776`) le pose. Même mécanisme pour `--voile-soft`.
8. `src/components/ActivitySelect.tsx:36,103` et `SessionActivityField.tsx:15` · retirer la prop `families?` · faux : trois appelants passent un sous-ensemble, `components/sailing/SailingSettingsPanel.tsx:71` (`['voile']`), `pages/SurfModule.tsx:787` (`['surf']`), `pages/PlanningPage.tsx:861` (`PLANNING_FAMILIES`).
9. `src/planning/route.ts` · retirer `isLooped` et `closeLoop` avec le calcul de boucle de retour (304) · faux : le parcours de balises boucle (`PlanningPage.tsx:970,972,1197,1200` appellent `planner.closeLoop(…)`, « Boucler ici », « Boucler » ; `usePlannedRoute.ts:272` ; `isLooped` lu `PlanningPage.tsx:471` et `planning/routeGpx.ts:57`, qui reste). Ils survivent au 304.
10. `src/planning/route.ts:59` · défaut actif « un parcours de balises en mer part en calcul de sentier BRouter » · non reproduit : pour une activité de voile ou de surf, `editMode = markCourse ? 'straight' : mode` (`PlanningPage.tsx:370`) et toutes les poses passent `editMode` ; `sentier` ne joue que sans aucune activité planifiable (`:342`) ou comme repli de l'interrupteur (`:964`). Latent, réglé par le 304.
11. `android/app/src/main/res/xml/config.xml` · supprimer (« aucune référence, reliquat Cordova ») · faux : lu par convention par le cadre (`node_modules/@capacitor/android/…/Bridge.java:1593`, `new ConfigXmlParser()`) ; produit par `cap sync`, ignoré par git (`android/.gitignore:102`). Ni supprimer ni suivre.
12. `src/test/walkProfile.fixture.ts` (zone 8 §7) · « `'minkm'` ne se retrouve plus hors `core/units.ts` », donc retrait limité · faux pour ce qui en dépend : `isInverseUnit` (`units.ts:156`) est appelé par `pages/StatisticsPage.tsx:459` et `recording/liveFields.ts:6,144,171`, `editSpeedUnit` (`:163`) aussi ; le retrait de `minkm` entraîne ces branches et leurs tests (325c, liste complète).
13. `package.json` · dépendance `@fontsource/montserrat` « inutilisée » (knip) · faux positif : `src/theme/fonts.css:7-10` fait quatre `@import '@fontsource/montserrat/latin-{400,500,600,700}.css'`, importé par `src/theme/base.css:8` ; lu aussi par `outils/licences-hors-js.mjs:140` et `src/core/licenses.test.ts:163`.

Écartés aussi par les architectes (O4), pour mémoire : `src/sailing/sailingAnalytics.ts:636` `trackData[i + 1]` sans garde (zone 2 D-4) n'est pas une erreur possible (la ligne n'est atteinte que si `durationS > 0`, donc `i + 1 ≤ n − 1`) ; `RecordingNotificationPlugin.java:34-35` et `RecoveryPlugin.java:25` « non gardés » (zone 8) le sont par `src/platform/nativeConstants.test.ts:73-86,143-147`.

---

## Bon à savoir, pas maintenant

### Défauts latents (sans effet aujourd'hui ; O4 §1, sauf mention)
- `src/planning/route.ts:59` `DEFAULT_ROUTE_MODE = 'sentier'` · mordrait si toutes les activités sont cachées : `editMode` vaut alors `planner.mode` = `'sentier'` et un tronçon part en BRouter (`PlanningPage.tsx:340,342`) · réglé par le 304 (défaut `'straight'`).
- `src/sailing/wind.ts:598-655` `observeTurns` · lit les seuils de la détection en dur (12 s, 60°, cohérence, pas maximal) alors que la détection honore les surcharges de `ManeuverOptions` ; mordrait le jour où un appelant passe `windowSeconds`, `minTurnDeg`, `minCoherence` ou `maxStepSeconds` (la production n'en passe aucun : `sailingSession.ts:123`) · l'étape b du 328 partage les constantes ; faire passer `DetectionSettings` à `observeTurns` et `prepareWindPolar` seulement si une fenêtre devient réglable (zone 2 D-1, ≈ 30 lignes, risque moyen).
- `src/core/sessionStats.ts:263-265` · O4 le croyait « calculé à chaque analyse de surf » : faux (V1), le surf n'appelle pas `buildBaseSessionStats` ; c'est du code mort, retiré au 325b.
- `src/hooks/useRecorder.ts:567` foil lu à « Analyser » · voir 329, étape 2.
- `src/recording/session.ts:46-47` `isNewerFix` · une horloge GPS qui recule fait ignorer toutes les positions jusqu'à repasser la dernière heure gardée : un trou silencieux ; rare (horloge GNSS), à noter seulement.
- `src/platform/beeper.ts:128-145` · version navigateur : `finished` programme trois minuteurs que `validated` et `setInterval` n'annulent pas ; un `setInterval(1000)` posé après `finished()` rejoue le bip court au milieu des trois bips de fin ; navigateur et banc seulement (le greffon Android gère).
- `src/settings/activitySettings.ts:286-290` `minkm` accepté par `isKnownSpeedUnit` · seulement par un fichier de réglages repris ; se ferme avec le 325c.
- `profile.stillThreshold` lu en nœuds (`sailingSession.ts:111,162`) · vrai tant que toute la voile est en `thresholdUnit: 'kn'` ; tenu par la garde de complétude du 326.
- `src/surfing/surfAnalysis.ts:205` `returnOf` · rend `null` si `returnS` vaut exactement 0 s, sans conséquence visible (zone 2 D-8).
- `src/recording/liveLegs.ts:5` · importe quatre constantes `MANEUVER_*` de `sailing/sailingConfig` pour les bords en direct : une règle de plus qui double la détection (zone 2, question 5).
- `src/hooks/useZoneAlert.ts:8-9` · écriture du stockage à chaque `sync()` même quand rien ne change ; `src/hooks/useRestingHrResults.ts:23-28` relit deux fois au premier rendu ; `src/hooks/useOpenSections.ts:21-23` omet `defaults` des dépendances (valable tant que c'est une constante de module) · sans gravité (zone 3 §8).
- `src/platform/mapTiles.ts:187` · `fetch(url, { credentials: 'omit' })` sans `referrerPolicy` : en WebView le `Referer` est `https://localhost/` ; à vérifier que le serveur de tuiles OpenStreetMap l'accepte (zone 7 §3).
- `src/architecture.test.ts:44-46,51-52,63-64` · exceptions `hooks/useTimeChartAxis → components/chartAxes` et `chartHover` : un hook qui importe des composants ; dette ancienne, déplacer `chartAxes`/`chartHover` dans `core/` ou `hooks/` (zone 5 §7).
- `android/…/BeeperPlugin.java:42-43` · `watchBelt` utilise `gpsHandler()` (nom trompeur → `watchHandler`) ; `MainActivity.java:34-39` · le son « GPS perdu » sert aussi à une chute du moteur de rendu (zone 8 §8).
- Hors de cette partie, sans lot attribué : double clé de la ceinture (`src/platform/heartRate.ts:145-172`, `src/platform/beltList.ts:6,27-30`, ancienne clé d'avant la liste) : relecture d'anciennes données que O2 laisse « hors coupure » ; à rattacher au 306 ou au 322.

### Améliorations qui ne valent pas un lot cette semaine (détail dans les rapports de zone, `D:\gong tracker\atelier\revue-1111\`)
Découpages des gros fichiers (un fichier par commit, banc avant/après, après les retraits qui les allègent) :
- `src/pages/SettingsPage.tsx` (1 203 lignes) · `NumberField` `:172-234` → `components/ui/NumberField.tsx` ; `HeartRateThresholdsField` `:236-293` → `components/HeartRateThresholdsField.tsx` ; `ActivityCard` `:303-619` + `JumpsSetting` `:73-114` + `AnalysisTabsSetting` `:116-146` + `FieldsSetting` `:922-965` + `GearLabelsField` `:1048-1080` + `thresholdHelp`/`UNIT_HELP` `:906-920` → `pages/settings/ActivityCard.tsx` (≈ 450 lignes) ; `FamilyHeading`, `EyeButton`, `ActivityNameField`, `AddActivityForm` `:967-1130` → `pages/settings/ActivitiesBlock.tsx` ; `DisplaySettings`, `TutorialsSettings`, `OfflineMapsSettings`, `TileUrlField` `:845-888` et `:1132-1201` → `pages/settings/DeviceBlocks.tsx` ; le fichier tombe à ≈ 300 lignes ; déplacer aussi le gros commentaire `:295-302`, posé au-dessus de `ActivityCardActions` au lieu de `SettingsPage` (`:621`) · zone 5 §3.
- `src/pages/PlanningPage.tsx` (1 331 lignes, `PlanningPage` `:328-1331`) · après le 304 : carte et surcouches `:900-990` → `PlanningMap.tsx` ; bloc Parcours `:1013-1062` → `CourseBlock.tsx` ; bloc Tracé `:1133-1212` → `TraceBlock.tsx` ; bloc Points `:1214-1260` ; ouverture et enregistrement `:640-800` → `usePlanningSave.ts` ; styles de carte `:134-215` → `planningMapStyle.ts` ; et chaque `markCourse ? A : B` → `A` (≈ 30 sites) · lot 309, zone 5 §4.
- `src/pages/RecordingPage.tsx` (1 132 lignes, `RecordingScreen` `:593-1132`) · après 325a : tuiles, guidage, bord de voile, cartes du direct `:109-275` → `pages/recording/LiveParts.tsx` ; `StopButton`, `NoteButton`, `OrientationLockButton`, `useScreenOnWhile`, `CaptureOption` `:308-397` → `pages/recording/Controls.tsx` ; `RecordingMap`, `MarkGuideSlot`, `RecordingFigures`, `RecordingGpsCard` `:398-577` → `pages/recording/LiveDisplay.tsx` ; rejeu GPX (`:683-686`, `:730-742`, `createReplaySource` `:784-786`) → `pages/recording/useReplaySource.ts` ; libellés purs `liveStatItems`, `liveSummaryItems`, `followStatItems`, `courseStatItems` (`:138-154`, `:192-211`, `:266-274`) → `recording/liveItems.ts`, testable · zone 5 §2.
- `src/pages/StatisticsPage.tsx` (908 lignes, `StatisticsPage` `:226-908`) · panneau graphique `:632-737` → `StatsChartPanel.tsx` ; régularité `:738-776` ; cardio `:777-865` (+ `CardioLoadHelpSlot` `:218-224`) → `StatsCardioPanel.tsx` ; records `:866-908` ; panneau général `:572-631` ; `Chips`, `GroupRow`, `SerieShape`, `WeekLineShape` `:131-212` → `components/stats/` ; calculs restés dans la page (`toAxis`, `axisLabel`, `axisTick`, `metricText`, `pointText`, `recordValue`, choix `metricKey`, `:339-346`, `:393-397`, `:404-432`, `:463-471`, `:487-497`) → `library/statsChartFormat.ts`, pur, testé · zone 5 §5.
- `src/library/record.ts` (1 218 lignes) · après le 306 (≈ −400 lignes) : `library/recordSummary.ts` (types `SessionSummary`, `SummaryHeartRate`, `ManeuverResults`, lecteurs, `ANALYSIS_SUMMARY_FIELDS`, `:14-270`, `:440-540`), `library/recordAnalysis.ts` (`SessionAnalysis`, `ANALYSIS_FIELDS`, `mapAnalysis`, `readAnalysis`, `:280-330`, `:560-640`), `library/recordUnreadable.ts` (`GUARDED_*`, `unreadableFields`, `withUnreadable`, `:677-835`) ; `record.ts` garde le format, les lecteurs de fiche, `applyRecordPatch`/`completeRecord` ; ≈ 60 importeurs : ré-exports le temps du lot ; `record.test.ts` (1 100 lignes) scindé de même · zone 6 E.
- `src/library/stats.ts` (759 lignes) · matériel croisé `:105-229` → `gearStats.ts` ; graduations de dates `:624-684` → `dateTicks.ts` ; cardio `:685-759` · zone 6 E.
- `src/sailing/maneuvers.ts` (1 942 lignes) et les deux modules d'analyse · détail au lot 328, étape d.
- Autres : `src/platform/memoryFolder.ts` (733 lignes) → `memoryFolder/browser.ts`, `device.ts`, `private.ts`, `import.ts` (zone 7 §4.4) ; `src/platform/beeper.ts:210-316`, deux blocs jumeaux de veille → `createWatch(kind, nativeMethods, playBrowserSound)` (zone 7) ; `src/components/BaseTileLayer.tsx` (416 lignes : extraire la classe de cache `retryMissing`/`tilesToRetry`) ; `src/components/ui/ui.css` (1 102 lignes, lot 309) ; `src/core/units.ts` (`formatDuration*` et horloge → `time.ts`) ; `src/core/sportProfiles.ts` (cardio → `heartRateProfile.ts`) ; `src/settings/activitySettings.ts` (`SETTING_FIELDS`/`withSetting` `:583-711`) ; `src/hooks/useSessionLibrary.perte.test.ts` (851 lignes, couper vers `:700`) · non urgents.
- Petites pièces : `src/core/activities.ts:46-64` `FAMILY_SHADES` / `FAMILY_SHADES_DARK` en tableaux parallèles indexés par rang → un objet `{ light, dark }` par nuance ; `src/components/ProfileAvatar.tsx:20-23` `ICON_FAMILY` à comparer avec `core/activityIcons.ts` (doublon possible) ; `src/library/sessionEdits.test.ts:266-352` (quatre copies `old*` de l'ancien code, oracle du lot 80) à remplacer par des cas figés.
- Tests manquants (zone 1 §7) : `SPEED_UNIT_LABEL` n'accepte que des unités proposées (après 325c) ; `SURF_TABS` sur des réglages vides d'un premier lancement ; `estimateHrEnergy` sur `SPORT_PROFILES[sport].hrEnergy` des cinq calculs.
- Le D+ dans le résumé des fiches (`library/summary.ts:176-177,194`) : s'il n'est plus montré nulle part (325b, question 1), son retrait du résumé demande `SUMMARY_CALC_VERSION` 19 et le refigeage de `summaryFrozen` ; à ne faire qu'avec une raison de plus, puisque la porte d'import tient à la version 18 (O2).

---

# Partie C · Planificateur, banc, documents, atelier (lots 304, 330, 331, 318, corrections du reste à faire, 308)

---

## Lot 304 (compléments) · Planificateur routier : ce que la liste oublie

La liste du lot 304 existe déjà (`docs/BACKLOG.md`, ligne 304) et son détail est dans `docs/backlog/154-vente-extraction-voile-surf.md`, partie E5 (option b de la Q55, réponse du 04/11). **Cette section ne la réécrit pas** : elle donne le tableau des 43 fichiers de `src/planning/`, tout ce que la liste oublie, le résultat attendu corrigé et les questions. Sources : `zone7-planning-platform.md` (§0 à §3, §6), `zone3-hooks.md` §9, `zone4-components-theme.md`, `zone5-pages.md` §4, `zone6-library-recording.md`, `zone1-core-settings.md`, `zone8-android-config-tests.md`, contrôlé par `V2-verification-zones-2-4-5-7-8.md` et `O2-coupure-donnees.md` (B12). Annexes : `D:\gong tracker\atelier\revue-1111\zone7-planning-platform.md` et les autres du même dossier.

**But** : le planificateur routier (calcul d'itinéraire, revêtement, types de voie, altitude du terrain, durée, boucle de retour calculée) disparaît ; il ne reste que le parcours de balises en ligne droite et les itinéraires importés (GPX). On le verra à ceci : `RouteMode` vaut `'straight' | 'imported'`, la recherche de contrôle de la section « Vérification » rend zéro, et le banc ne voit plus aucune requête vers BRouter, Overpass ni l'IGN.
**Taille** gros · **Modèle** Opus / high (déjà fixé par la ligne du lot ; avec un agent `Plan` d'abord, vu le nombre de fichiers) · **Risque** moyen (`route.ts` de 888 lignes est amaigri de moitié, et `PlanningPage.tsx` de 1331 lignes perd ses branches sans que le compilateur les liste toutes).
**Avant** : 303 (fait) ; conseillé après le 325 (qui emporte les pièces déjà mortes, voir C) · **Après** : 322 (le renommage n'a plus à toucher `tracker.brouterProfile`), 326 (O1 : le 304 emporte `routeVehicle`, `wayTypes.ts:49` et 4 sites de `usesMarkCourse` avant la fusion), 330 (le banc supprime ses scripts du routier, voir lot 330) · **Avant la première APK** : oui, conseillé (le lot remet `ROUTE_VERSION` à 1 et supprime une clé de stockage ; après une installation, chaque changement de format de fiche d'itinéraire coûte une migration).

### À faire

#### A. Tableau des 43 fichiers de `src/planning/` et de leur sort

Légende : **304L** = part, et la liste du lot le dit ; **304O** = part, mais la liste l'oublie ; **RESTE** = sert au parcours de balises et aux itinéraires importés ; **RESTE (réduit)** = reste mais perd une part ; **MORT** = déjà sans appelant ou sans effet aujourd'hui, rangé au lot 325 (voir C) ; **?** = dépend d'une question (section Questions). « Imp. » = importeurs hors `planning/`, tests exclus.

| # | Fichier (lignes) | Sort | Imp. et remarques |
|---|---|---|---|
| 1 | `brouter.ts` (227) | 304L | `hooks/usePlannedRoute.ts` ; `BROUTER_URL` :25 |
| 2 | `brouter.test.ts` (333) | 304L | |
| 3 | `brouterProfile.ts` (341) | 304L | `components/WayTypeTabs.tsx`, `hooks/useSportSettings.ts`, `pages/PlanningPage.tsx` ; :207 « # Profil Tracker » part avec le fichier |
| 4 | `duration.ts` (87) | 304L, **MORT** (voir C) | `PlanningFamily = 'course' \| 'velo'` :37 ; importeurs : `useSportSettings.ts:20` (types), `PlanningPage.tsx:57`, `routeList.ts:3` |
| 5 | `duration.test.ts` (59) | 304L | |
| 6 | `fetchJson.ts` (95) | **304O ?** | `components/AboutSettings.tsx:3` (`fetchWithin`, charge la liste des licences, fichier local) et `PlanningPage.tsx:59` (`isAbortError`) : **ne part pas tel quel**. À déménager vers `platform/network.ts` ou `core/` avec `fetchWithin` et `isAbortError` ; en-tête :2-4 (« OpenStreetMap, altitude de l'IGN ») à réécrire |
| 7 | `fetchJson.test.ts` (86) | suit le 6 | |
| 8 | `geocoding.ts` (70) | **304O ?** | `pages/PlanningPage.tsx:60` (`searchPlaces`) ; Photon de Komoot (`PHOTON_URL` :12) : question C |
| 9 | `geocoding.test.ts` (47) | suit le 8 | |
| 10 | `grade.ts` (199) | **304O ?** | module « de transition » (:7-8) ; importeurs : `hooks/useSportSettings.ts:22`, `pages/PlanningPage.tsx:74`, `components/gradeGradientDefs.tsx`, `planning/route.ts:6`, test `settings/activitySettings.test.ts:5` ; `DEFAULT_CYCLING_GRADE_RANGE` :105 voir C ; sort lié à la question B (D+ d'un GPX importé) |
| 11 | `grade.test.ts` (162) | suit le 10 | |
| 12 | `ignAltimetry.ts` (104) | 304L | `usePlannedRoute.ts:4` ; `IGN_ALTI_URL` :20 |
| 13 | `ignAltimetry.test.ts` (59) | 304L | |
| 14 | `importedElevation.ts` (205) | 304L (voir question B) | `usePlannedRoute.ts`, `PlanningPage.tsx` (`PLANNING_TERRAIN_STEP_M`) |
| 15 | `importedElevation.test.ts` (212) | 304L | |
| 16 | `legCalculation.ts` (114) | 304L | `usePlannedRoute.ts` |
| 17 | `legCalculation.test.ts` (115) | 304L | |
| 18 | `legJoin.ts` (45) | **RESTE (réduit)** | via `route.ts` ; `isWaysMode`, `isComputedLeg`, `WaysMode` partent (:11-14, et `route.ts:56` `export { isWaysMode }`) ; `joinLegs`, `samePlace` restent |
| 19 | `legJoin.test.ts` (37) | RESTE (réduit) | |
| 20 | `loopReturn.ts` (240) | 304L | `usePlannedRoute.ts` |
| 21 | `loopReturn.test.ts` (157) | 304L | |
| 22 | `overpass.ts` (132) | 304L, **MORT** (voir C) | aucun importeur ; `fetchWays` :114 et `OVERPASS_URL` :20 jamais appelés |
| 23 | `overpass.test.ts` (79) | 304L | |
| 24 | `plannedRouteReducer.ts` (95) | **RESTE (réduit)** | `usePlannedRoute.ts` ; garde la boucle, l'annulation, les `Edit` ; le calcul de la boucle de retour part (`withLoopReturn`, `openLoop` :77) |
| 25 | `plannedRouteReducer.test.ts` (78) | RESTE (réduit) | |
| 26 | `route.ts` (888) | **RESTE, très amaigri** | voir B4 : la liste du lot ne nomme presque rien de ce qui y part |
| 27 | `route.test.ts` (731) | RESTE (réduit) | `:520` teste `routeVehicle` |
| 28 | `routeGpx.ts` (76) | RESTE | :21-23 espace de noms et balise `tracker:itineraire` : renommage du lot 322, **pas du 304** (le fichier reste, c'est le round-trip Gtracker vers Gtracker) |
| 29 | `routeGpx.test.ts` (27) | RESTE | |
| 30 | `routeImport.ts` (78) | **RESTE** (cœur de la porte d'import des itinéraires) | `hooks/routeFiles.ts`, `hooks/sessionLibrary/incoming.ts` ; :15, :17, :58 lisent une fiche « de Tracker » : question A |
| 31 | `routeImport.test.ts` (98) | RESTE | :50, :73 libellés « de Tracker » |
| 32 | `routeList.ts` (111) | **RESTE (réduit)** | perd la durée (:3, :34-65, :95-111) ; :10 « bibliothèque Voile ou Course » à corriger ; importeurs `FollowTracePicker.tsx`, `RouteList.tsx`, `RoutesPage.tsx`, `SessionLibrary.tsx` |
| 33 | `routeList.test.ts` (78) | RESTE (réduit) | :72-76 testent `estimateRouteDurationS` |
| 34 | `routeRecord.ts` (189) | **RESTE (réduit)** | perd `readSurfaceRuns` (:3), le champ `surfaces` de `StoredLeg` (:36-41) et les versions 2 et 3 (:27-35) ; `ROUTE_VERSION` 3 devient 1 (O2 B12) ; `ROUTE_FORMAT` :19 : lot 322 |
| 35 | `routeRecord.test.ts` (150) | RESTE (réduit) | :74-75 valeurs `'tracker-session'`, `'tracker-itineraire'` : lot 322 |
| 36 | `routeShown.ts` (25) | RESTE | `pages/Home.tsx`, `PlanningPage.tsx` |
| 37 | `segmentGrid.ts` (57) | **304O** | seuls lecteurs : `loopReturn.ts:3`, `wayMatch.ts:3` (la fiche 154 le dit au plan du 07/11, la liste du lot l'oublie) |
| 38 | `segmentGrid.test.ts` (42) | 304O | |
| 39 | `surface.ts` (452) | 304L | `components/SurfaceBar.tsx`, `SurfaceHighlight.tsx`, `SurfaceLayer.tsx`, `PlanningPage.tsx` ; `routeRecord.ts` et `route.ts` l'importent : à couper à la main ; **`library/record.test.ts` l'importe** : à décrocher avant de supprimer |
| 40 | `surface.test.ts` (308) | 304L | |
| 41 | `wayMatch.ts` (153) | 304L, **MORT** (voir C) | aucun importeur hors `overpass.ts` (mort) ; `WAY_MATCH_VERSION` :21 jamais lue |
| 42 | `wayMatch.test.ts` (89) | 304L | |
| 43 | `wayTypes.ts` (56) | 304L | `pages/PlanningPage.tsx` ; :47 commentaire sur la terre |

Bilan : 304L = 12 sources et 11 tests ; 304O = `segmentGrid`, `grade` (avec leurs tests), plus `geocoding` et `fetchJson` à trancher ; RESTE = `legJoin`, `plannedRouteReducer`, `route`, `routeGpx`, `routeImport`, `routeList`, `routeRecord`, `routeShown` (avec leurs tests).

#### B. Ce que la liste du lot 304 oublie

**B1. Réglages et crochets (`hooks/`)**
- `src/hooks/useSportSettings.ts:306-322` · retirer les cinq fonctions « valeurs neutres jusqu'au 304 » : `effectiveLoopReturnRatio` (:310), `effectiveGradeRange` (:313, rend `DEFAULT_GRADE_RANGE`, pas `null`), `effectiveWayTypes` (:316), `effectivePace` (:319), `effectiveDurationSettings` (:322), et les imports de `DurationSettings`, `PaceLevel`, `WayType`, `DEFAULT_GRADE_RANGE`, `GradeRange` (:20-22) · appelants : `pages/PlanningPage.tsx:52,319,348,356,357,361` ; `components/RouteList.tsx:9,48` ; `components/FollowedElevation.tsx:9,82` (composant jamais montré, lot 325) · ≈ 20 lignes · (`effectivePace` et `effectiveDurationSettings` partent plus tôt, au 325)
- `src/hooks/usePlannedRoute.ts` (278 lignes) · **réduire, ne pas supprimer** : `PlanningPage` s'en sert pour les balises (`planner.closeLoop`, :272). Retirer `fetchLeg`, `fetchIgnElevations`, `computeLeg`, `computeReturn`, `LOOP_RETURN_DEFAULTS`, `importedElevation`, `recomputeSurfaces` · ≈ -200 lignes
- `src/hooks/usePlannedRoute.ts:39-42` · `PROFILE_KEY = 'tracker.brouterProfile'` : la clé resterait écrite sur l'appareil sans lecteur ; retirer avec `brouter.ts` (si le 304 passe avant le 322, elle disparaît au lieu d'être renommée) · ≈ 6 lignes
- `src/hooks/useExclusiveToggles.ts` (:6 : « Voir sur la carte du revêtement et de la pente ») · seul importeur `pages/PlanningPage.tsx:41,456` · supprimer le fichier · ≈ 20 lignes
- `riderKg` (`useRunnerProfile().profile.weightKg`) lu par `components/RouteList.tsx:44` et `pages/PlanningPage.tsx:354` · n'a plus d'emploi : retirer le paramètre et l'import de `useRunnerProfile` dans `PlanningPage.tsx:50`

**B2. Composants (la liste dit seulement « composants de revêtement et de profil » : les nommer)**
- `src/components/ElevationProfileMini.tsx` (seuls importeurs : `PlanningPage.tsx:15` et `FollowedElevation.tsx`), `src/components/routeProfileChart.ts` (`PlanningPage.tsx:25,525` et `FollowedElevation.tsx:15`), `src/components/GradeLegendRow.tsx` (`PlanningPage.tsx:19`), `src/components/SurfaceBar.tsx` + `SurfaceBar.css` (`PlanningPage.tsx:27`), `src/components/SurfaceLayer.tsx`, `src/components/SurfaceHighlight.tsx` (`PlanningPage.tsx:28`), `src/components/WayTypeTabs.tsx` (`PlanningPage.tsx:30`) · supprimer · ne pas toucher `HoveredTrackMarker` de `HoverMarker.tsx` (utile à `AnalysisBaseLayers`, `LiveMap`) · risque faible
- `src/components/gradeGradientDefs.tsx` + prop `gradient` de `src/components/TrackChart.tsx:48,138` + série `kind:'area'` à dégradé et import `GradientStop` · seul alimenteur : `ElevationProfileMini` · vérifier qu'aucun autre `area` ne reste · ≈ 40 lignes · (le retrait de `GradientStop` touche `core/speedGradient`)
- `src/components/RouteList.tsx:8,18,44-50` · `durations`, `riderKg`, `ELEVATION_PRESETS`, l'appel `routeDurationS` (:49) · ≈ 12 lignes
- `src/components/HighlightPath.tsx:15` et `src/components/highlightColors.ts:5,22,31` · retirer la prop « le trait laisse passer les clics (revêtement) » qui ne sert qu'à `SurfaceHighlight` ; réécrire les commentaires qui citent « zone de pente, cadence, revêtement » · risque faible
- `src/components/AboutSettings.tsx:115` · texte visible « l'altitude et le revêtement des parcours à pied et à vélo, passent par des services en ligne » : supprimer le membre de phrase (il décrit IGN et revêtement) · risque nul

**B3. Pages**
- `src/pages/PlanningPage.tsx:1149-1187` · aide du Tracé « non balises » (« À vélo… à pied… sens interdits… difficulté VTT… », 7 `<li>`) · ≈ 40 lignes · NUANCE V2 : la branche `!markCourse` s'affiche si `activity === null` (aucune activité planifiable, toutes masquées) ; atteignable dans ce cas limite, donc à retirer ici avec le reste, pas avant
- `src/pages/PlanningPage.tsx:342, 365, 368, 370, 395-398, 457, 460, 497, 501-502, 529, 840-847, 854-856, 863-873, 959-960, 985, 1013, 1104, 1134-1149, 1214, 1235` · `markCourse ? A : B` partout : après le 304, `markCourse` est la seule voie, chaque test devient `A` (blocs 1063-1101, 1104-1131, 1149-1187, 906-941 partiels) · ≈ 350 lignes · à faire dans le même mouvement que le 304 mais **hors du lot 309** (qui découpera ensuite la page)
- `src/pages/PlanningPage.tsx:89` · commentaire « avec le temps estimé en course et à vélo (niveau choisi dans Réglages) » · risque nul
- `src/pages/PlanningPage.tsx:331-332, 861` et `src/pages/SessionLibrary.tsx:503-504, 635-647` · `PLANNING_FAMILIES = SPORT_FAMILIES` (`settings/activitySettings.ts:444`) : filtre `plannable`, prop `families={PLANNING_FAMILIES}`, `plans`, tests `plans ||` et `{plans && …}` tautologiques ; le commentaire :331 parle du fractionné · supprimer avec ses tests · appelants : 3 fichiers + `activitySettings.ts` · NUANCE V2 : la prop `families?` de `ActivitySelect.tsx:36,103` et `SessionActivityField.tsx:15` **reste** (trois appelants passent un sous-ensemble) · si le lot 326 est passé avant, déjà fait
- La chaîne du temps estimé de `PlanningPage` (`:345-346, 354-357, 524, 1064-1084`) · voir C (lot 325)

**B4. `src/planning/route.ts` (888 lignes), fonctions qui ne servent qu'au calcul routier, non nommées par la liste.** Chaque suppression : Grep du nom dans `hooks/usePlannedRoute.ts`, `pages/PlanningPage.tsx`, `components/`, `recording/` avant.
- `LoopReturn` (:157), `withLoopReturn`, `acceptLoopReturn`, `addBeforeReturn`, `removeLoopStart`, `nextReturnVariant` (zone 330-440), `ReturnRequest`, `returnRequest`, `withReturnResult`, `withReturnError` (:447-505), `openLoop` (appelé seulement par `plannedRouteReducer.ts:77`, même branche que `withLoopReturn`) · appelés seulement quand `looping = !openedMarkCourse && isLooped(read)` (`PlanningPage.tsx:694`) ou par le reducer de la boucle calculée
- `legKey`, `withLegResult`, `withLegError`, `recomputeLegsWithoutSurfaces`, `retryFailedLegs`, `pendingLegRequests`, `LegRequest` (:656-735) ; statut `'pending'` et `'error'` de `LegStatus` (:131) ; `DEFAULT_MAX_SNAP_M`, `snapToWaypoints` (:740-775)
- `WAY_TYPE_LABEL`, `WAY_TYPE_HINT` (:32-50), `toggleWayType` (:76), `routeVehicle` et `RouteVehicle` (:105-112, rend toujours `'pieton'` ; appelants `PlanningPage.tsx:359,396`, test `route.test.ts:520` ; retirer le paramètre `vehicle` de `brouter.ts`, `legCalculation.ts`, `usePlannedRoute.ts`, `PlanningPage.tsx`) ; commentaires :105-108, :316 qui parlent de la terre et du vélo
- `isFixedMode` (:115) et `rebuiltMode` (:122) : deviennent constants avec `isWaysMode`
- `RouteMode = WaysMode | 'straight' | 'imported'` (:53) devient `'straight' | 'imported'` (déjà dans la liste) ; `DEFAULT_ROUTE_MODE` (:59) `'sentier'` devient `'straight'` ; `STRAIGHT_LABEL`/`STRAIGHT_HINT` (:61-62, « tout droit, sans suivre la carte ») à reformuler
- Données d'avant (O2 B12, coupure de la décision 2) : `LEGACY_ROUTE_MODES` (:82-83, `foot/mtb/bike`, « À pied, Vélo, VTT »), `LEGACY_WAY_TYPES` (:85-86, `chemin` devenu `sentier`), `parseWays` (:89-93), `straightenRoute` (:509, sert aux fiches de balises ouvertes : plutôt compatibilité que calcul, à retirer s'il ne sert qu'à elles)
- `DEFAULT_IMPORT_SMOOTHING_M` (:561-571, lissage de l'altitude à 100 m « pour le D+ et le temps estimé ») · à retirer **si** la question B répond « pas de D+ » · appelant : `recording/followedTrace.ts`
- NE PAS retirer (voir Pièges) : `isLooped`, `closeLoop`

**B5. Fiche, trace suivie, noyau**
- `src/library/record.ts:392-394, 906-911, 925-927, 1100-1105, 1148-1167, 1215` · champs `surfaces`, `terrainElevation`, `elevationSource` de la fiche de session et leurs branches de `completeRecord`, `carryRecordEdits`, `RecordPatch` · **fait avec le 304, pas avant** (O2 B12 : `planning/surface.ts:433` et `record.test.ts` les lisent encore)
- Lecteurs de production de ces champs à retoucher dans le même mouvement (V1, O3) : `hooks/sessionLibrary/summaryQueue.ts:60-61` ; `library/summarizeGpx.ts:20, 33, 44-49` (option `elevation`, jamais lue par `summarizeGpx` : la construction `summarizeGpxOptions` l'envoie quand même) ; `library/summaryOptions.ts:55-62` (`SessionElevation`) ; `library/recordMerge.ts:147` ; déclencheurs `record.ts:914` et `:944` · scénario (O3) : un import ou une retouche relance un recalcul et une réécriture de fiche pour un résumé identique
- `src/recording/followedTrace.ts:84, 107, 118-130` · `FOLLOWED_TRACE_ELEVATION_TOLERANCE_M`, `simplifyAlongElevation`, champ `eleM` ; `followedTraceFromSession` et son option `land` (`followedTrace.ts:79-90`, toujours `false` depuis `FollowTracePicker.tsx:97`) · à rattacher ici : leur sort suit la question B ; `smoothElevationAlong` (`core/elevation.ts`, appelé par `planning/route.ts:581` et `recording/followedTrace.ts:92`) reste tant que la trace suivie garde l'altitude
- `src/tutorials/lessons.ts:142-153` · leçon « Planifier un parcours » (« le tracé suit les chemins qui conviennent… distance, dénivelé et temps estimé… « Boucle » vous ramène au départ par un autre chemin ») · à réécrire (balises en ligne droite ; voir la leçon `voile` :179) · c'est la seule leçon qui décrit le routeur
- `src/architecture.test.ts:60-62` · exception `planning/routeRecord → recording/markGuide` (« réglages de balise rangés avec l'itinéraire ») : à revoir (si `planning/` ne garde que les balises, `markGuide` peut remonter dans `planning/` et l'exception disparaît ; le test échoue si une exception devient inutile)

**B6. Réseau et réglages natifs**
- `src/core/mapBase.ts:38,47` (tuiles OSM et Esri) · **restent**, voir D
- `android/app/src/main/AndroidManifest.xml` permission `INTERNET` (zone 8, :93) · **reste** (tuiles, licences)
- Dépendances : `leaflet` et `recharts` restent (cartes et graphes d'analyse), rien ne devient inutile dans `package.json`

#### C. Ce qui peut partir sans attendre le 304 : voir lot 325
Rangés au lot 325 (l'orchestrateur les y a mis) : la chaîne du temps estimé (`planning/duration.ts` et son test, la durée de `routeList.ts` et de `components/RouteList.tsx:48-49`, le bloc de `PlanningPage.tsx:1064-1079`, `effectiveDurationSettings` et `effectivePace`) ; `planning/overpass.ts` et `planning/wayMatch.ts` avec leurs tests ; `DEFAULT_CYCLING_GRADE_RANGE` (`planning/grade.ts:105`). **Si le 325 est passé avant**, rayer ces pièces du tableau A ; sinon elles partent ici, sans changer de nature.

#### D. Résultat attendu à corriger
La ligne du lot (`docs/BACKLOG.md`, 304) promet « plus aucun service public gratuit appelé ». **C'est faux** : la carte appelle les tuiles d'OpenStreetMap (`tile.openstreetmap.org`, `core/mapBase.ts:38`) et d'Esri World Imagery (`server.arcgisonline.com`, `core/mapBase.ts:47`) par `platform/mapTiles.ts:187`, et la recherche de lieux appelle Photon de Komoot (`planning/geocoding.ts:12`). Texte proposé : **« parcours de balises et itinéraires importés seulement ; plus aucun service de calcul d'itinéraire ni d'altitude (BRouter, Overpass, IGN) ; restent appelés les fonds de carte (OpenStreetMap, Esri) et, selon la réponse C, la recherche de lieux (Photon) »**. Cette correction se reporte dans la fiche 154 (E5), la politique de confidentialité du lot 308 (`docs/backlog/151-vente-mentions-legales.md` cite BRouter, IGN et Overpass) et `README.md:21-26` (lot 331).

### Pièges
- **INFIRMÉ (V2 nuancé 6)** : ne pas retirer `isLooped` ni `closeLoop` de `route.ts`. Le parcours de balises boucle : `PlanningPage.tsx:970, 972, 1197, 1200` appellent `planner.closeLoop(editMode | 'straight')` (boutons « Boucler ici », « En ligne droite », « Boucler »), `usePlannedRoute.ts:272`, `PlanningPage.tsx:471` (`isLooped`) et `planning/routeGpx.ts:57` (`isLooped`, fichier qui reste). Le doute D2 de la zone 7 est tranché.
- **INFIRMÉ (V2 nuancé 7)** : le « défaut » de la zone 7 §0 (`DEFAULT_ROUTE_MODE = 'sentier'` enverrait un parcours de balises en mer vers BRouter) **n'est pas reproduit** : pour une activité de voile ou de surf, `editMode = markCourse ? 'straight' : mode` (`PlanningPage.tsx:370`) ; toutes les poses, déplacements et bouclages passent `editMode` (:546, :594, :970). Le mode `sentier` ne vaut que si `activity === null` (:342) ou comme repli de l'interrupteur `straightOff` (:964). Passer le défaut à `'straight'` reste sain, mais ne corrige aucun bogue.
- Ne pas confondre les `surfaces` des tronçons d'itinéraire (`planning/*`, `usePlannedRoute.ts`, `PlanningPage.tsx`) avec le champ `surfaces` de la fiche de session (V1) : deux structures, deux retraits, tous deux dans ce lot, l'un après l'autre.
- `fetchJson.ts` est importé par `components/AboutSettings.tsx:3` : le supprimer avec le dossier fait casser les licences de Réglages.
- `library/record.test.ts` importe `planning/surface` : décrocher avant de supprimer `surface.ts`.
- `architecture.test.ts` : si une exception ou une liste ne fait que diminuer, une entrée sans objet fait échouer le test ; les listes `LAND_FILES` et `SEAM` sont déjà vides.
- Les gardes à laisser vertes telles quelles : `src/library/summaryFrozen.test.ts` (résumés à l'octet).
- Le banc : `boucle`, `surface`, `recherche-sans-reponse` tombent avec ce lot ; `planning`, `planification-verrou`, `balises` sont à rejouer (voir lot 330). `lib/cdp.mjs:14` `BLOCKED_URLS` est à revoir en même temps.

### Vérification
- Recherche de contrôle à zéro : `rg -n "overpass|wayMatch|segmentGrid|planning/duration|ignAltimetry|brouter|WayTypeTabs|SurfaceBar|SurfaceLayer|SurfaceHighlight|GradeLegendRow|gradeGradientDefs|PlanningFamily|RouteVehicle|routeVehicle|effectiveDurationSettings|effectivePace|effectiveWayTypes|effectiveGradeRange|effectiveLoopReturnRatio|useExclusiveToggles|brouterProfile" src outils` (hors ce qui est dit « reste » plus haut).
- `npx tsc -b --force`, `npm run verif`, `npx vitest run src/architecture.test.ts src/library src/planning src/hooks`.
- Résumés identiques : `src/library/summaryFrozen.test.ts` sans refigeage.
- Banc : `node outils/banc/passe.mjs planning planification-verrou balises --avant HEAD -j 1 --sans-cache` (les deux premiers exigent `--gpx` aujourd'hui : voir lot 330) ; aucune requête vers `brouter.de`, `overpass-api.de`, `data.geopf.fr` (D3 : la liste `BLOCKED_URLS` de `lib/cdp.mjs:14` devient la liste des domaines dont toute requête fait ÉCHOUER le script ; D3 propose en plus `openstreetmap.org` et `server.arcgisonline.com` pour les scripts hors réseau, À VÉRIFIER à la lecture de `cdp.mjs`).
- Un essai au téléphone : Itinéraires en voile, poser 3 balises, « Boucler », enregistrer, charger un GPX simple ; la carte et les tuiles apparaissent, l'écran n'attend aucun calcul.

### Questions liées
- **A. Les itinéraires déjà enregistrés par l'autre application restent-ils lisibles ?** (fiche d'itinéraire `tracker-itineraire`, GPX avec `tracker:itineraire`). La réponse du 04/11 (fiche 154) disait oui ; la décision 2 du 11/11 n'ouvre la porte qu'aux sessions. · Par défaut : non pour la fiche, oui pour un GPX simple (un tracé se charge sans ses balises ni ses bips) · Change : `routeImport.ts:15,17,58`, `ROUTE_VERSION` 3 vers 1, `routeRecord.ts:27-35`, `LEGACY_ROUTE_MODES`, `routeImport.test.ts:50,73`.
- **B. Faut-il garder le dénivelé (D+) et la pente d'un GPX importé ?** En voile et en surf l'altitude GPS n'est que du bruit. · Par défaut : non (réponse O1 Q2 identique) · Change : si non, `grade.ts`, `routeProfileRows`, `ProfileRow`, `profileGradeStops` (`route.ts:880-888`), `accumulateElevation`, `DEFAULT_IMPORT_SMOOTHING_M`, `importedElevation.ts` et l'altitude de `followedTrace.ts` partent ; si oui, `grade.ts` reste (renommé `slope.ts`) avec `DEFAULT_GRADE_RANGE`, et le lot grossit.
- **C. Garde-t-on la recherche de lieux (Photon) pour poser une balise ?** · Par défaut : oui, une phrase dans la politique de confidentialité (texte tapé et centre de la carte partent chez Komoot) · Change : `geocoding.ts` et son test restent ou partent ; le résultat attendu D se réécrit.
- **D. Les conditions d'usage des tuiles OpenStreetMap et Esri permettent-elles une application vendue, avec cache disque jusqu'à 20 Go (`tileCache.ts`, `TILE_CAP_LIMITS_MB`) ?** Hors code. · Par défaut : à faire valider avant la vente (Q5 de la fiche 152) · Change : un fournisseur de tuiles sous contrat (clé d'API) remplace `core/mapBase.ts:38,47`. Aussi : `mapTiles.ts:187` n'envoie pas de `referrerPolicy` (OSM demande un `Referer` valide) : à vérifier en WebView.

---

## Lot 330 · Banc remis sur la voile et le surf

Source : `D3-outils-banc.md` en entier (annexe : `D:\gong tracker\atelier\revue-1111\D3-outils-banc.md`), plus `V1-verification-zones-1-3-6.md` et `V2-verification-zones-2-4-5-7-8.md` pour les symboles que d'autres lots retirent.

**But** : le banc (`outils/banc/`, 79 scripts) n'éprouve plus que de la voile et du surf, le passage courant tourne sans échec, une seule bibliothèque (`lib/traces.mjs`) fabrique les traces, et les noms que le renommage du lot 322 va changer sont posés une fois dans `lib/cdp.mjs`. On le verra à ceci : `node outils/banc/passe.mjs` (passage courant) ne rend aucun échec, les recherches de contrôle de la section « Vérification » rendent zéro, et `SCRIPTS.md` ne décrit plus que des scripts qui existent.
**Taille** gros (quatre vagues) · **Modèle** Sonnet / high (la vérification compte : un script réécrit peut passer « neutre » à tort ; `docs/MODELES.md`, ligne « Lot medium où la vérification compte ») ; le script `import-session` et le test du registre (G4) : Sonnet / high aussi · **Risque** moyen (un script qui n'injecte plus rien ne le dit pas : d'où `--scripts-par-cote`).
**Avant** : 320 (jeu d'essai de la porte, pour `import-session`) ; la vague 1 (constantes) avant le 322 · **Après** : 327 (G4 et G6 de D3 §6 sont rangés au 327) · **Avant la première APK** : oui pour la vague 1 (les constantes précèdent le renommage 322), non pour le reste.

### À faire

#### 0. Comptes
Sur 79 scripts : 39 bons tels quels (certains avec une retouche de quelques lignes), 35 à réécrire sur une session de voile ou de surf, 4 à supprimer (`boucle`, `denivele-direct`, `recherche-sans-reponse`, `surface`), 1 à archiver (`energie-fc-diagnostic`, cassé). Aucun script n'est à supprimer en entier pour « compatibilité d'anciennes données » : elle se trouve dans des étapes.

#### 1. Vague 1, tout de suite, sans risque (D3 « Ordre conseillé » 1)
- `outils/banc/lib/cdp.mjs:10` et `outils/banc/shots.mjs:4,12` · adresse par défaut `http://localhost:5173` devient `5174` (`vite.config.ts:11` impose 5174 ; 5173 est le port de l'application d'origine : un script lancé sans `BASE` éprouverait l'ancienne application) ou, mieux, lecture du port de `vite.config.ts`
- `outils/banc/passe.mjs:33-34` `PRECHAUFFE` · retirer `'/course'`, `'/course/analyse'`, `'/fractionne'`, `'/fractionne/analyse'` (redirigés vers l'accueil) ; **ajouter** `'/surf'` et `'/itineraires/liste'` (le chargement à vide de la bibliothèque du surf se fait en premier dans `surf`, `general`, `cacher`)
- `outils/banc/scripts.mjs:12` · doc des étiquettes `voile, course, velo, surf, fractionne, …` devient `voile, surf, enregistrer, bibliotheque, planification, statistiques, profil, reglages, accueil`
- `outils/banc/scripts.mjs:151` `PAGES` et `:127` (`tailles`) · retirer `course`, `velo`, `fractionne` (les 12 étiquettes de `tailles` tombent à 9)
- `outils/banc/scripts.mjs:92` (`notification`) · retirer `fractionne` ; `:96` (`partage`) et `:33` (`aides`) · retirer `course` des `pages`
- `outils/banc/reduire.mjs:38` (`settings-families` : retirer `course`, `velo`, `fractionne` ; :35 bloc `coureur` à vérifier) ; `outils/banc/reglages-aide.mjs:40` (idem)
- `outils/banc/energie-fc-diagnostic.mjs:30` · importe `src/running/energy.ts` (dossier supprimé) : le script plante au chargement. **Archiver** (hors registre depuis le lot 96, absent de `SCRIPTS.md`) ; seules `DEFAULT_ENERGY_PARAMS.joulesPerMlO2` et `restingMlKgMin` servent (:106) : 3 lignes pour inliner si l'utilisateur veut le garder (question). Il lit aussi `timedPoints` et `heartRatePointsFrom` (`:27,69`) et `hrEnergyCeilingBpm` (V1) : ces symboles ne sont plus à protéger
- `outils/banc/LISEZMOI.md:60` · « `tailles`, `general`, `pentes` » devient « `tailles` et `general` » (`pentes` est supprimé)
- `outils/docs-inventaire.mjs:63` `DOSSIERS` · retirer `running` et `cycling` (dossiers supprimés) ; ajouter `theme` et `tutorials` ; `HORS_DEPOT` (:21) contient `fc-repos.json`
- `outils/banc/brouillon-voile.mjs` · en-tête « remplace `session-save.mjs`, périmé » est faux (`SCRIPTS.md:18` dit que `session-save` est refait) ; `outils/banc/sauts.mjs:16,328` étape 6 « retirée » à supprimer du commentaire ; `outils/banc/notification.mjs:11` étape retirée ; `outils/banc/rendus.mjs:23` retirer `'IntervalBanner'` (absent de `src/`, compte 0) ; `outils/banc/cardio.mjs:18` cite « fractionné » retiré ; `outils/banc/sauts-diagnostic.mjs:45` et `outils/banc/virages-diagnostic.mjs:71` libellé « capteurs de Tracker » (lot 322)

#### 2. Vague 1 bis : constantes dans `outils/banc/lib/cdp.mjs`, avant le renommage du lot 322
Le banc écrit les noms de l'application en dur : clé `tracker.sections` (92 occurrences), `tracker.sportSettings` (46), `tracker.profil` (9), `tracker.runnerProfile` (7), `tracker.followedTrace` (7)…, nom du dossier mémoire `'Gtracker'` dans 24 scripts (correctif du commit `d5db0af`, lot 312), noms de caches, `window.trackerBack`. **Renommer côté `src/` sans cela casse le banc sans bruit.** Poser dans `lib/cdp.mjs` (exports) :
- `DOSSIER_MEMOIRE = 'Gtracker'` (`cdp.mjs:276-279`, `donnees.mjs:~58`, `miseajour.mjs`, `reglages.mjs`, `library2.mjs`, `fc-repos.mjs`)
- `PORT_DEV`, `BASE` (point 1)
- une fonction `cle('sections')` et le préfixe de clé de l'appareil (aujourd'hui `tracker.`, demain `gtracker.` : la valeur finale est fixée par la table de renommage de `O2-coupure-donnees.md` §2.2, lot 322) ; la liste des clés qui voyagent dans `reglages.json`
- noms de caches (`tracker-tuiles`, `tracker-vignettes`, `tracker-vignettes-images`, en-tête `x-tracker-saved-at`), nom de la base IndexedDB (`tracker-memoire`), poignée du banc `window.trackerBack` (`gtrackerBack` après le 322 ; scripts : `tutoriels.mjs:78`, `zoom-carte.mjs:370`), dossier temporaire `tracker-banc` (`passe.mjs:39`, `fluidite-compile.mjs:12`, `LISEZMOI.md:30` : `gtracker-banc`), formats de fichiers (`tracker-reglages` suit `SETTINGS_FORMAT` de `src/library/settingsFile.ts:25`)
- Option, à vérifier : une fois `src/core/appIdentity.ts` créé (lot 321), `cdp.mjs` pourrait l'importer par le crochet `charge-ts.mjs` plutôt que recopier les valeurs (À VÉRIFIER : le crochet charge-t-il ce fichier hors vitest ?)
- Les scripts remplacent chaque chaîne en dur par la constante dans le même passage que leur réécriture (vague 3) ; ceux qui ne sont pas réécrits (bons tels quels) sont retouchés mécaniquement par le lot 322 (58 fichiers, 242 occurrences selon O2) : **pas deux fois**.

#### 3. Vague 2 : `outils/banc/lib/traces.mjs`
18 scripts redéfinissent chacun leur générateur (`aides barre bench cardio coquille donnees fichier-recu fluidite general graphes imports materiel miseajour onglets statistiques tailles vides zoom-carte` : `hillGpx`, `lineGpx`, `wingGpx`, `rideGpx`) et 44 fichiers écrivent `creator="banc"`. Créer `lib/traces.mjs` qui exporte :
- `traceVoile(options)` (wingfoil, kite, bateau), `traceSurf(options)` (vagues, foil), `traceLongue(heures, hz, type)` (voile ou surf, pour les mesures de fluidité), `traceSansType()`, `traceDeVoileAvecFiche(version)` (porte d'import, voir 9) et l'en-tête commun `creator="banc"`
- Les trois jeux terre à remplacer : `hillGpx('running', 2400, 3, 0.03)` (`aides:89`, `coquille:110`, `tailles:223`, `onglets:116`, `vides:93`), `hillGpx('cycling', 3000, 7, 0.02)` (`coquille:111`, `tailles:224`), `rideGpx` cycling (`donnees`, `miseajour`, `cacher`, `statistiques`), `lineGpx('running')` (`barre:68`), courses de 3 h ou 2 h (`carte-perf:54-71`, `survol:52-66`, `fluidite:223-281`, `carte-reveil:61`), 150 courses de 20 min (`vignettes:59`, `vignettes-relance:54`), 13 courses d'un lundi (`racine-periodes:37`, `racine:53`), course à 3 m/s avec FC (`zoom-carte:85-105`), FIT « course » (`import-fit`, `src/test/fit.fixture.ts`)
- `make-gpx.mjs` reste la trace commune (voile, 1 Hz, 3 750 points, vent du nord, sans `<type>`) : à étendre par ces fonctions
- Jeux de fichiers pour `--gpx` : `outils/banc/donnees/` (3 à 7 petits GPX, voile et surf) **fabriqué par un script plutôt que commité** : aujourd'hui `library` exige `voile.gpx`, `course.gpx`, `sans-type.gpx` et `planning` exige `sans-heure.gpx`, `route-rte.gpx`, `boucle.gpx`, `pas-un-gpx.gpx`, et aucun `.gpx` n'existe dans le dépôt : ces deux scripts ne se rejouent que sur le poste de l'utilisateur

#### 4. Tableau des 79 scripts (D3 §1)
Légende : BT bon tel quel ; RÉ à réécrire sur une session de voile ou de surf ; SUP à supprimer ; ARC à archiver. Les lignes sont celles des scripts.

| Script | Verdict | Lignes à changer, ce qui change |
|---|---|---|
| activite | RÉ | :4-6 :63 (`running: {reglages:true}`) :97 :117 :147 (`chooseOption('Course')`) :153 (`go('/course')`) : basculer Voile et Surf (ou Kite et Foil) ; attendus « en course » (`Allure\|D+\|D−`) à refaire |
| aides | RÉ | :88-89 (`hillGpx('running')`, page course) :116 section « course » : jouer sur une session de voile ; garder 3 à 5 aides (voile, statistiques, barre) |
| allure-session | BT | retirer les étapes 0 et 6 (:76-81, :112) : « ancienne allure par support » posée dans les réglages puis effacée = compatibilité (décision 2). Lit `referenceSpeeds` (:78, :115), voir Pièges |
| apropos | BT | :114 attend « Tracker s'appuie… » (texte de `src/components/AboutSettings.tsx:95`) : à changer avec le lot 322 (libellés visibles), jamais un seul côté |
| balises | BT | garde la planification en ligne droite ; à revérifier après le lot 304 (`RouteMode`) |
| barre | RÉ | :68 (`lineGpx('running')`) :151 :156-157 (« Course », `?famille=course`, sous-titre « À pied ») : remplacer par voile ; :41 `blockNetwork` en dur |
| bench | BT | rien à changer |
| boucle | SUP | planificateur routier (lot 304) ; :101 `['running','cycling']` ; n'éprouve que BRouter ; `reseau: true` disparaît avec |
| brouillon-voile | BT | corriger l'en-tête (voir vague 1) |
| cacher | RÉ | :3-5 :29-35 (sortie à vélo, `<type>cycling`) :60 :64 :71 (`/velo`, bouton « Vélo », « Route ») : cacher Surf puis une activité de Voile ; la règle « la dernière famille visible ne se cache pas » devient « il reste une famille » (2 familles) |
| carte-direct | BT | déjà repris sur la voile (303) |
| carte-perf | RÉ | :54-71 (course 3 h `running`) :193 :201 (`/course`, `/course/analyse`) : même trace en `wingfoil` sur `/voile` |
| carte-reveil | RÉ | :61 (`running`) :172 :177 : analyse de voile |
| cardio | BT | `tracker.runnerProfile` :69-70 : nom de clé hérité (suit le renommage de `useRunnerProfile`) ; en-tête :18 cite « fractionné » |
| cdp (`lib/cdp.mjs`) | BT | `shots.mjs` et `cdp.mjs` n'ont rien de terre ; points 1 et 2 de la vague 1 |
| charge-ts | BT | rien à changer |
| classer | RÉ | :4-7 :43 (`/course`) :61 (Gravel) : importer par `/voile`, choisir « Surf foil » ou une activité de voile, attendre `/surf/analyse` ; garder seulement si « session sans type » reste une fonction (elle reste : voir Questions) |
| coquille | RÉ | :5 :7-8 :110-111 (`hillGpx('running'/'cycling')`) :169 (`/course/analyse`, `/fractionne/analyse`) : ne garder que `/voile/analyse`, `/surf/analyse` et une session introuvable |
| denivele-direct | SUP | :70-72 (`activityId: 'running'`) ; teste `FollowedElevation`, importé mais jamais monté (`RecordingPage.tsx:722-723`) : **à supprimer avec le composant (lot 325)** ; ses cas « voile avec balises, surf » (sans bouton) tiennent dans `balises` ; repères `.rec-elevation`, `.rec-elevation__gain`, bouton « Dénivelé » (lignes 99-121, 190, 289-292, 341-350, 437) |
| donnees | RÉ | :6-8 :27-33 (`rideGpx` `<type>cycling`, altitude IGN, voies) :79 :93 :95 (`/velo`) : point 1 (cycling + IGN + Overpass) à retirer ou refaire en voile sans IGN ; points 2 à 5 inchangés sur voile ; surveiller `tracker.libraryCache` ; :89-98 écrit les champs terre d'une fiche (lot 306) |
| energie-fc-diagnostic | ARC | voir vague 1 |
| familles | RÉ | :43 `FAMILIES = ['voile','course','velo','fractionne','surf']` devient `['voile','surf']` ; :88 `familyCount === 4 \|\| 5` devient `=== 2` ; :9 en-tête. Échoue aujourd'hui dans le passage courant |
| fc-repos | BT | « jamais encore joué » (`SCRIPTS.md:261`) : à jouer une fois ; clé `tracker.restingHr` |
| fichier-recu | RÉ | :86 :120 (`gpxText(…,'running')`) :95 (`/course/analyse`) :6 (session à classer) : types `wingfoil` et `surf`, `/voile/analyse` ; **garder, c'est la porte d'import** (paquet partagé) |
| fluidite | RÉ | :223-235 :249-281 (courses de 2 h, `bruit-tel`) :317 :322 (`/course`) :533-536 (variantes `course-pc`, `course-tel`) :326 (`FLUIDITE_ZOOM` par défaut) : voile et surf seulement (`voile-tel`, `surf-tel`) |
| fluidite-compile | BT | :12 `tracker-banc`, :21 chemins de Chrome en dur (utiliser `lib/chrome.mjs`, voir 7) ; variantes `course-*` suivent `fluidite` |
| general | BT | déjà repris au 303 ; modèle pour les réécritures |
| glisser | BT | :112-119 : vérifier qu'il reste au moins 2 choix dans la rangée « Famille » (sinon y ajouter l'activité) |
| gps-perdu | BT | rien à changer |
| graphes | BT | repris au 303 |
| icones | RÉ | :54 (`SESSIONS` running, cycling) :69 :89 (`['Voile','À pied','Vélo','Surf']`) :110-116 (`/velo`, « Route, Gravel, VTT ») : attendus à refaire (`['Voile','Surf']`, activités de voile) |
| import-fit | RÉ (?) | :5 :80 (`/course`) ; `src/test/fit.fixture.ts` fabrique des FIT « course » : refaire avec un sport de voile ou de surf ; SUP si l'import FIT n'est plus voulu (question) |
| imports | RÉ | :147-163 (course, vélo) à retirer ; point 2 (« fiche de la première version 24/09 ») = compatibilité à retirer ; **:180 espace de noms `https://github.com/segneur34/Tracker/session`** à aligner sur le lot 321 ; **garder et renommer `import-session`** le point 7 (GPX complet portant une fiche d'une version plus récente) = porte d'import ; non documenté dans `SCRIPTS.md` |
| library | RÉ | exige `voile.gpx`, `course.gpx`, `sans-type.gpx` dans `--gpx` (`scripts.mjs:82`) ; :85 :90 :100 (`/course`) : remplacer `course.gpx` par `surf.gpx` ; aucun de ces GPX n'est dans le dépôt (voir vague 2) |
| library2 | BT | dépend de `library` (même profil) ; :1 `reglages/` ; pas de terre |
| make-gpx | BT | la seule trace commune ; à étendre |
| manoeuvres-diagnostic | BT | recalage d'une vraie session ; chemin en argument. **Appelle `analyzeManeuvers` (:42, :147, :153)** et `buildSailingSessionStats` (:102) : voir Pièges |
| materiel | RÉ | :4-5 :65 (`settings-activities: wingfoil, running, cycling, surf`) : cartes Voile et Surf seulement ; les intitulés « Chaussures/Sac » n'existent plus ; matériel croisé (point 5) sur des sessions de voile ou de surf ; non documenté dans `SCRIPTS.md` |
| materiel-fin | RÉ | :3-7 :62-66 (`gearGroups.running`) :72 (`recordUntilEnd('À pied','running',…)`) : famille Surf avec une liste de matériel, Voile sans liste |
| miseajour | RÉ | :4 :26-37 (`rideGpx` cycling, noms `…_cycling.gpx`) :77 :117 :149 (`/velo`, `/velo/analyse`) :146-147 ; **:152 « version plus récente de Tracker »** (texte de `src/platform/memoryFolder.ts:715` et `library/recordText.ts:8,12` : lot 322) ; échoue « code 1 au bout de 4 s » depuis le 06/11 (`SCRIPTS.md:323`) |
| notes | RÉ | :4 :9 (famille Course, étape 3 « en Course seulement ») : la partie « nommer, supprimer, enregistrer la session » passe à la voile |
| notification | BT | retirer l'étiquette `fractionne` du registre (:92) ; en-tête :11 |
| onglets | RÉ | :4-9 :90 :116 (course 40 min) :7-9 « Route, Fractionné à pied, Surf foil » : ne garder que Voile, Surf, Surf foil ; DUMP `x-course.txt`, `x-velo.txt` retirés ; 311 lignes, 35 occurrences terre |
| partage | BT | retirer l'étiquette `course` du registre (:96) ; :40 `blockNetwork` en dur ; l'altitude IGN bloquée (:126) disparaît avec le lot 304 |
| passe | BT | lignes mortes du point 6 |
| planification-verrou | BT | à revérifier après le lot 304 |
| planning | RÉ | :57-58 `tracker.planning = { activityId: 'running' }` devient une activité de voile ; GPX d'entrée à fournir (vague 2) ; `<type>hiking</type>` à remplacer ; à rejouer après le lot 304 |
| prereglages | RÉ (réduit) | :1 :9-19 :43-47 (`RUN`, Marche, Gravel, VTT, `presetsVersion` 4) : l'étape 1 (effacements à la mise à jour) est de la compatibilité à retirer ; ne garder que les défauts du bateau (1 à 15 nd, pause 0,2 km/h) et de la Voile (8 nd, couleurs 8-24) ; renommer `defauts-reglages` ; lit `activitiesVersion`, `presetsVersion` (:5, :60, :79, :279, :287, :294, :303) |
| profil | BT | repris au 303 (:5, :230) |
| pumping | BT | `dev: true` ; utilise `core/imuSynthetic.fixture.ts` (:162) |
| pumping-diagnostic | BT | recalage ; lit `pumpSignal`, `pumpCadence` (garder leur `export`) |
| racine-periodes | RÉ | :4 :37 (`<type>running`) :54 (`/course`) : 13 sessions de voile |
| racine | RÉ | :8 :53 :139 : sessions de voile ou de surf ; deux fichiers gardés ou fusionnés |
| recherche-sans-reponse | SUP | planificateur routier (lot 304) ; :71 :80 ; 143 lignes ; `reseau: true` |
| reduire | BT | :38 `settings-families` : retirer `course`, `velo`, `fractionne` ; :35 bloc `coureur` à vérifier |
| reglages-aide | RÉ | :40 (idem) :116-122 : cherche la carte « Couleur de Route » et « Type de vélo » (introuvables ; le `waitFor` n'échoue pas mais le `check` du :122 échoue) : prendre une rangée d'une carte Voile ou Surf |
| reglages | RÉ | :101-103 :113 (`running`, Trail, `cycling`, `recordActivity: 'running'`) :109 :132 (`tracker.runnerProfile`) :278-295 (seuil de la course, `go('/course')`) : activités de « Léa » en `wingfoil`/`a-moth`/`surf` ; étape 10 sur une session de voile ; `format: 'tracker-reglages'` (:~107) suit `SETTINGS_FORMAT` ; lit `activitiesVersion`, `presetsVersion` (:31, :32, :89, :108, :130, :170, :177, :178) |
| rename | BT | rien à changer |
| rendus | BT | :23 `'IntervalBanner'` à retirer ; :75-84 course de 400 s devient voile |
| satellite | RÉ | :5 :91-92 (running, cycling) : voile, surf ; clé `tracker.fondCarte` ; cache `tracker-tuiles` (:67) |
| sauts | BT | :16 :328 étape 6 « retirée » dans le commentaire |
| sauts-diagnostic | BT | :45 libellé « capteurs de Tracker » |
| scripts (registre) | BT | point 6 |
| session-save | BT | seul à éprouver le seuil et les notes |
| session-save-resume | BT | rien à changer |
| shots | BT | :4, :12 `5173` devient `5174` |
| statistiques | RÉ | :4-6 :12-14 :23-27 :75-79 :114 :387 ; parties 5c (« niveau ») et fractionné à supprimer ; jeu à refaire en voile (wing, kite, foil) et surf ; 469 lignes, 76 occurrences terre ; échoue aujourd'hui dans le passage courant |
| surf | BT | rien à changer |
| surface | SUP | lot 304 ; :4 :77 (`activityId: 'running'`) :132 :136 ; écrit les champs terre d'une fiche |
| survol | RÉ | :52-73 (course 3 h `running`, `/course`) : même trace en voile ; masque `ms` du registre |
| tailles | RÉ | :4 :223-224 :260-261 :265 :319 : retirer course, vélo, fractionné ; 12 étiquettes de `pages` (`scripts.mjs:127`) tombent à 9 |
| test-fcrepos | BT | rien à changer |
| tutoriels | BT | vérifier que `src/tutorials` n'a pas de leçon de course (la leçon routière part au 304) ; utilise `window.trackerBack` (:78) |
| vides | RÉ | :4 :68 :92-93 :120 : retirer l'étape 3 (course sans altitude, « zones de pente ») ; le reste passe |
| vignettes | RÉ | :1 :59 :63 :73 :139 (`<type>run…`, `/course`) : 150 sessions de voile sur `/voile` ; cache `tracker-vignettes-images` (:155-161) |
| vignettes-relance | RÉ | :54 :58 :98 :104 (`/course`) ; caches (:5, :8, :83-84, :158) |
| virages | BT | `dev: true` ; `imuSynthetic.fixture.ts` (:89) |
| virages-diagnostic | BT | :71 libellé ; lit `surfProfileOf` (:41, :56) et `waveTurnTrace` (:42, :99) : garder |
| zoom-carte | RÉ | :85-105 (`runGpx` en ligne droite) :135 :151-217 (parties 2 et 3 : course, cardio, énergie, zones de pente) : refaire sur la voile (déjà là pour surf et voile) |

Les 25 scripts `manuel: 'course et vélo retirés (303), à revoir'` de `scripts.mjs` (lignes :32, :34, :40, :45, :51, :54, :57, :59, :62, :66, :75, :78, :80, :86, :88, :91, :94, :101, :107, :115, :123, :125, :136, :143, :145) : 23 sont à réécrire (`activite, aides, barre, cacher, carte-perf, carte-reveil, classer, coquille, donnees, fichier-recu, fluidite, import-fit, imports, materiel, materiel-fin, notes, onglets, prereglages, satellite, survol, vignettes, vides, zoom-carte`) et 2 à supprimer (`recherche-sans-reponse`, `surface`) ; **retirer le drapeau `manuel` au fur et à mesure**, sinon le lanceur (`passe.mjs:~125`, fonction `lancable`) les écarte en silence.

#### 5. Vague 3 : réécritures par jeu de données commun (D3 « Ordre conseillé » 3)
(a) `familles`, `statistiques`, `profil`/`racine`/`racine-periodes` (le passage courant) ; (b) bibliothèque et import : `library`, `imports` devenu `import-session`, `import-fit`, `fichier-recu`, `miseajour`, `donnees`, `classer` ; (c) cartes : `carte-perf`, `carte-reveil`, `survol`, `vignettes`, `vignettes-relance`, `zoom-carte`, `satellite`, `fluidite` ; (d) Réglages : `reglages`, `reglages-aide`, `prereglages`, `icones`, `cacher`, `materiel`, `materiel-fin` ; (e) le reste : `activite`, `aides`, `barre`, `coquille`, `notes`, `onglets`, `tailles`, `vides`. Une vague ne se commence qu'après la précédente ; chaque script réécrit perd son `manuel`.

#### 6. `passe.mjs`, `scripts.mjs`, `lib/*`
- `outils/banc/passe.mjs:39` · brouillon par défaut `tracker-banc` devient `gtracker-banc` (sinon les anciens relevés de l'application d'origine se mélangent) ; `:53-70` `trouverChrome` recopié dans `fluidite-compile.mjs:~21` avec trois chemins en dur : extraire dans `lib/chrome.mjs` ; l'option `--aide`/`-h` existe mais n'est pas écrite dans le LISEZMOI
- `outils/banc/scripts.mjs:149` `PASSAGE_COURANT` · **recomposer** (le passage courant est cassé en trois endroits : le lanceur retire les scripts `manuel` en silence, il ne reste que `general, statistiques, profil, bench, familles, cardio`, dont `statistiques` et `familles` échouent). Proposition sans réseau : `general`, `surf`, `bench`, `cardio`, `graphes`, `sauts`, `virages`, `pumping`, `profil`, `statistiques` (une fois réécrit), `familles` (une fois corrigé), `rename`, `session-save`, `apropos`, `tutoriels`, `planification-verrou`. Les scripts `solo` (`balises`, `carte-direct`, `gps-perdu`, `notification`, `fc-repos`, `test-fcrepos`) restent par nom ou par `--pages`. **Retirer `library`, `planning`, `onglets` du passage** tant qu'ils exigent `--gpx` ou `manuel`. D3 chiffre ≈ 10 min à `-j 4` ; la règle de l'orchestration est `-j 1` (voir Pièges) : remesurer.
- `lib/cdp.mjs:14` `BLOCKED_URLS` · voir lot 304 (Vérification)
- `lib/onglets.mjs:3-4,14-27,30` · clés `tracker.sections`, `running`, `cycling`, `intervals`, `muscu` dans le commentaire : seules la clé `sailing-onglets` et `surf` servent (`MODULES` déjà réduit) ; réécrire l'en-tête
- `lib/graphes.mjs`, `lib/horloge.mjs`, `lib/tuiles.mjs` : rien de terre ; `LISEZMOI.md:27,43` citent `compteur-course` et `test-fcmax`
- Le registre manque d'un champ « ce script vise une page qui n'existe plus » : voir G4 au lot 327

#### 7. Documents du banc et autres outils
- `outils/banc/LISEZMOI.md` · :12 « jamais 5174, celui de l'utilisateur » est faux depuis le fork (5174 est le port de Gtracker) : écrire « 4195 et 4196 pour le lanceur ; 5174 est le serveur de développement de l'utilisateur » ; :21 liste des étiquettes (retirer `course`, `velo`, `fractionne`) et passage courant (liste du point 6) ; :27 parenthèse « `compteur-course` et `test-fcmax` partis au lot 302 » ; :30 `tracker-banc` ; :35 « piège d'un ancien script de la charge portée, retiré au lot 303 » ; :37 `BASE` « `http://localhost:5173` » devient 5174 ; :43 « (et alors de `compteur-course` et `test-fcmax`, retirés au lot 302) » ; :60 voir vague 1 ; :63 piège Overpass (lot 304) ; :64 « mémorisés dans `tracker.sections` » exact tant que la clé s'appelle ainsi (lot 322) ; :72 « `npm run dev` écoute sur `[::1]:5173` » devient 5174 (à vérifier sur le poste) ; :79 chemin `D:/gong tracker/Gtracker/node_modules` **en dur** : remplacer par `<dépôt>/node_modules` (décision 3) ; ajouter dans « Pièges » : « Les scripts visent des textes de l'application (`Tracker s'appuie…`) : renommer côté `src/` impose de relancer `apropos` et `miseajour` »
- `outils/LISEZMOI.md` · :3 « ouvre Tracker », « port 5173 », « fenêtre réduite « Tracker - serveur » », « raccourci « Tracker » du bureau », « `icone-tracker.ico` » devient Gtracker, 5174, « Gtracker - serveur », `icone-gtracker.ico` (fichier référencé par `outils/logo/icones-android.mjs:66,107`) ; :5 `imu-reference.mjs` : exact, mentionner le chemin `io/github/segneur/tracker` (lot 323) ; **ajouter les lignes qui manquent** : `verif.mjs`, `docs-cites.mjs`, `docs-inventaire.mjs`, `licences-hors-js.mjs`, `styles-en-ligne.mjs` + `styles-en-ligne.json`, `icones/vectoriser.cjs` (le LISEZMOI ne décrit que 5 des 14 fichiers)
- `outils/banc/SCRIPTS.md` (336 lignes, 74 Ko, jamais lu en entier : Grep puis lecture par `offset`) · :7 « 57 des 83 scripts du registre » (le registre en a 67, 79 fichiers) : recalculer ou supprimer le compte ; :10-12 tableau « Sans verdict » cite `chrono` (supprimé au 302) ; lignes à supprimer avec leur script : :22 et suite (planning, texte à refaire), :31 `denivele-direct`, :39-44 `surface`, :45-53 `boucle`, :132-138 et :332 `recherche-sans-reponse` ; lignes à réécrire avec les scripts RÉ : :21-22 (`library` sans `course.gpx`), :23-28 (`activite`), :29, :58-67 (`classer`, `cardio`), :69-77 (`reglages`), :123-130 (`donnees`), :131-137 (`survol`), :150-153 (`cacher`), :168-176 (`statistiques`, la plus longue), :177-182 (`barre`), :196-203 (`profil`), :213-219 (`vides`), :220-228 (`satellite`), :229-237 (`prereglages`), :238-243 (`icones`), :244-250, :303-311 (`racine-periodes`, `tailles`, `aides`) ; :315-317 récits à ne pas recopier ; :319-332 « Scripts à revoir » : remplacer par une courte liste « à écrire » (porte d'import, `lib/traces.mjs`, voile-surf), :323 et :324 deviennent sans objet, :328 (lot 303 : liste des scripts retirés) supprimer ; :329 « adresse par défaut `5173` » devient 5174 (et le port 4190 refusé par Chrome : exact) ; aucune entrée pour `carte-direct`, `coquille`, `energie-fc-diagnostic` (part), `fichier-recu`, `gps-perdu`, `import-fit`, `imports`, `materiel`, `materiel-fin`, `vignettes-relance` (10 scripts : en ajouter une pour les 9 qui restent) ; références mortes que `docs-cites.mjs` relève : :17 `SHOT=x.png`, :70 `reglages/pc.json`, :123 `/src/hooks/useSessionLibrary.ts`, :131 `/src/planning/brouter.ts`, :246 `docs/backlog/114-fluidite-mesure.md` (n'existe plus), :304 `rapport.md`, :315 `entrainement`, :328 `depense`, `library3` (16 faux aujourd'hui)
- `outils/docs-cites.mjs` · `HORS_DEPOT` (:33-34) garde `'Tracker/'` (le dossier mémoire s'appelle `Gtracker/`) et `'tracker.json'` : suivre le lot 322 ; `DOCUMENTS` (:16-27) ne couvre pas `outils/LISEZMOI.md`, `outils/banc/LISEZMOI.md`, `outils/banc/SCRIPTS.md` : les y ajouter une fois leurs renvois corrigés (G3, lot 327)
- `outils/imu-reference.mjs:17,36` paquet `io/github/segneur/tracker` : suit le lot 323 ; `outils/licences-hors-js.mjs:49` texte de la licence du logo GONG « …pour la version de Tracker proposée à GONG » (lien) : réécrire en « pour Gtracker » ; ce script réécrit `public/licences-hors-js.json` (`writeFileSync`) : ne pas le lancer pour vérifier
- `outils/lancer-tracker.bat` et `outils/icone-tracker.ico` · renommer `lancer-gtracker.bat` (commentaires :2 et :4, titre :10) et `icone-gtracker.ico` (`outils/logo/icones-android.mjs:66,107`) ; si ce renommage n'a pas été fait au lot 322, il est ici ; le raccourci du bureau pointe sur l'ancien nom : à refaire par l'utilisateur
- `outils/icones/vectoriser.cjs` · outil d'une seule fois (la planche de 16 dessins n'est pas versionnée) : archiver ; sinon retirer `SKIPPED` des trois dessins de course, vélo et fractionné ; cité par `docs/INVENTAIRE.md` et deux fiches de `docs/backlog/`

#### 8. Banc et rédaction de `docs/INVENTAIRE.md`
`docs/INVENTAIRE.md:371-377` décrit `outils/banc/` et répète `LISEZMOI.md` et `SCRIPTS.md` : voir lot 331.

#### 9. Script à écrire : `outils/banc/import-session.mjs` (la porte d'import)
Le banc n'a aucun script dédié à « charger une session de voile ou de surf venue de l'autre application » ; seuls `imports` (point 7) et `fichier-recu` s'en approchent. À écrire sur `lib/traces.mjs`, **après** les lots 320 (octets figés produits par le code d'origine : `src/test/legacyImport.fixture.ts`) et 321 (formats neufs). Cas à éprouver, un par `check` (d'après `O2-coupure-donnees.md` §4) :
- (a) paquet de voile et paquet de surf (GPX complet portant fiche, capteurs et retouches) : la session entre au bon calcul, nom, notes, repères et sauts présents
- (b) les trois formes d'entrée : paquet seul (« Importer des GPX ou FIT » ; « Ouvrir avec »), GPX + `.json` + `.imu` côte à côte (« Ajouter les sessions d'un dossier »), GPX seul à `<type>` reconnu
- (c) une fiche de l'autre application `sport: 'running'` ou un GPX `<type>running</type>` : refusés avec le message du lot 321 (« Gtracker ne range que la voile et le surf »)
- (d) une fiche de l'ancien format posée **directement** dans `sessions/` du dossier mémoire : lecture seule, jamais réécrite
- (e) fiche d'une version plus récente (porte, lecture seule) et paquet d'un autre espace de noms
- (f) refus d'ouvrir un dossier qui porte l'ancien marqueur comme mémoire (message du lot 321)
- Aucun fichier de l'autre application n'est jamais mis dans le dépôt : les octets viennent du jeu d'essai du lot 320 (À VÉRIFIER : le crochet `charge-ts.mjs` charge-t-il ce fichier hors vitest ? sinon recopier les octets en base64 dans le script)

### Pièges
- **Symboles que d'autres lots retirent et que le banc lit (V1, V2)** : si le lot qui retire le symbole passe avant l'adaptation du script, le script casse sans bruit ou plante.
  - `activitiesVersion`, `presetsVersion`, `PRESETS_VERSION`, `referenceSpeeds` : lus ou écrits par `reglages.mjs:31,32,89,108,130,170,177,178`, `prereglages.mjs:5,60,79,279,287,294,303`, `allure-session.mjs:78,115` · le lot 306 les retire : **adapter ces trois scripts dans le même lot que le 306**
  - `analyzeManeuvers` (`sailing/maneuvers.ts:1938`) : appelé par `manoeuvres-diagnostic.mjs:42,147,153` · si un lot le retire (zone 2), passer le script à `classifyManeuvers(prepareManeuverDetection(...))` ou le supprimer
  - champs terre écrits dans des fiches : `donnees.mjs:89-98`, `imports.mjs:152-158`, `surface.mjs` (`surfaces`, `terrainElevation`) · retirés au 306 (fiche de session) et au 304 (`surface`)
  - `TimedTrackPoint`/`timedPoints`, `heartRatePointsFrom`, `hrEnergyCeilingBpm` : lus par `energie-fc-diagnostic.mjs:27,69` · le script part ici
  - `surfProfileOf` (`virages-diagnostic.mjs:41,56`), `waveTurnTrace` (`:42,99`), `pumpSignal`, `pumpCadence` (`pumping-diagnostic.mjs`), `imuSynthetic.fixture.ts` (`pumping.mjs:162`, `virages.mjs:89`) : **ne pas retirer ces `export`** (knip les croit inutilisés : `outils/banc/*.mjs` sont tous « fichiers inutilisés » pour knip). Règle générale : avant de supprimer un `export` de `src/`, `grep -rn <nom> outils/`
  - routes `/course`, `/velo`, `/fractionne` : `activite.mjs:153`, `cacher.mjs:60,71`, `carte-perf.mjs:193`, et d'autres scripts qui posent des GPX `running` (V2 nuancé 6) · si le lot 306 supprime les redirections de `App.tsx:110-119` avant que ces scripts soient réécrits, ils ouvrent une page vide : **réécrire (vague 3) avant ou avec le 306**, ou garder les redirections jusque-là
  - `FollowedElevation` : `denivele-direct.mjs` part avec lui (lot 325), ainsi que son entrée de `scripts.mjs` et de `SCRIPTS.md` ; autre pièce qui part : `recording/followedProfile.ts` et son test (V2)
- **INFIRMÉS** (ne pas faire) : retirer la classe `ui-btn--l` (`size="l"` sert, `RecordingPage.tsx:317,342,357,927,933,944,948`) ; `ui-help--s`/`--xs` (le banc vise `button.ui-help--xs`, `cardio.mjs:188,192`) ; `--surf-soft` ; `res/xml/config.xml`.
- `--scripts-par-cote` est obligatoire pour les lots 321 et 322 : sinon le côté « avant » reçoit les clés neuves et ne voit rien. Le banc se lance toujours avec `-j 1` (piège noté dans la mémoire de reprise de l'orchestration).
- Le lot 312 (`d5db0af`, banc relisant le dossier « Gtracker ») : correct, 30 scripts corrigés ; les 24 qui écrivent `'Gtracker'` à la main passent par `DOSSIER_MEMOIRE` ici ; le test qui aurait évité la panne (comparer les clés et le nom OPFS du banc aux constantes de `src/`) est G6, lot 327.

### Vérification
- Après chaque vague : `node outils/banc/passe.mjs <scripts> --avant HEAD -j 1 --sans-cache` ; pour une réécriture, « relevé identique » n'a pas de sens (le jeu change) : lire les `check` un par un. À contrôler d'abord (lot 312 « à valider sur lecture ») : `general surf partage balises` puis `profil cardio sauts`.
- `node outils/docs-cites.mjs outils/LISEZMOI.md outils/banc/LISEZMOI.md outils/banc/SCRIPTS.md` doit passer (16 faux aujourd'hui).
- `npm run verif` reste vert à chaque étape (lint, vitest mélangé dont `outils/backlog.test.mjs`, build, docs) ; le workflow GitHub ne change pas.
- Recherches de contrôle à zéro : `Grep "go\('/(course|velo|fractionne)" outils/banc` ; `Grep "'(running|cycling)'" outils/banc` (hors liste blanche des littéraux d'anciennes données) ; `Grep "localhost:5173" outils` ; `Grep "src/(running|cycling|land)" outils` ; `Grep "(^|[^G])Tracker" outils` (reste `tracker.*` jusqu'au 322).
- Aucun essai au téléphone.

### Questions liées
- **FIT** : garde-t-on l'import de fichiers FIT de montre pour la voile et le surf (`ImportButtons.tsx:39` propose « Importer des GPX ou FIT » ; une montre peut enregistrer un FIT de kite, de planche ou de surf) ? · Par défaut : oui, garder · Change : `import-fit` refait en voile ou supprimé, avec `fitToGpx.ts` et `src/test/fit.fixture.ts` si non.
- **`classer`** : la session « à classer » (GPX sans type) reste-t-elle une fonction ? · Par défaut : oui (O2 §1.3 : elle ne sert pas qu'aux données de l'autre application) · Change : `classer` réécrit sur `/voile` au lieu de supprimé.
- **`prereglages`** : « Bateau » est-il une activité de départ (lot 315) ? · Par défaut : oui, garder les défauts du bateau · Change : le contenu de `defauts-reglages`.
- **`energie-fc-diagnostic`** : archiver ou réparer (3 lignes) ? La FC et l'énergie par FC restent en voile et en surf, mais le script compare à une méthode que personne n'a dit vouloir garder · Par défaut : archiver.
- **Préfixe des clés** (`gtracker.`) : fixé par le lot 322 avant la vague 3, pour ne pas la faire deux fois.
- **Noms hérités** (`useRunnerProfile`, `RUNNER_BOUNDS`, `tracker.runnerProfile`) : à lister comme tolérés par la garde du lot 327 tant que le renommage n'est pas fait.

---

## Lot 331 · Documents remis à jour

Sources : `D1-claude-decisions-mep.md` (`CLAUDE.md`, `docs/DECISIONS.md`, `docs/MISE_EN_PAGE.md`), `D2-etat-inventaire-readme.md` (`docs/ETAT_DU_PROJET.md`, `docs/INVENTAIRE.md`, `README.md`, `docs/DEVELOPPER.md`, `docs/INSTALLATION.md`, `docs/HISTORIQUE.md`), `O1-familles-architecture.md` §3 (qui **prime** sur D1 pour les règles 9 et 13, `CLAUDE.md:78`, `:79` et la table « Avant de toucher à »). Annexes (ligne à ligne, texte actuel, ce que dit le code, texte proposé) : `D:\gong tracker\atelier\revue-1111\D1-claude-decisions-mep.md`, `D2-etat-inventaire-readme.md`, `O1-familles-architecture.md` (section 3).

**But** : les documents (`CLAUDE.md`, `docs/*.md`, `README.md`) décrivent la voile et le surf, ne parlent plus de course, de vélo ni d'Entraînement, ne nomment plus l'ancien projet, et ne citent plus de chemin du poste ni de lien hors dépôt. On le verra à ceci : les deux recherches de contrôle de la section « Vérification » ne rendent que des faux amis, et `node outils/docs-cites.mjs` et `node outils/docs-inventaire.mjs` passent.
**Taille** gros (≈ 250 lignes de correction réparties sur neuf fichiers) · **Modèle** Sonnet / medium (agent `doc` ou conversation Sonnet ; aucun code ; `docs/MODELES.md`, ligne « Passe de doc ») ; relecture par l'orchestrateur du seul `CLAUDE.md` · **Risque** faible (un document qui devance le code devient faux : d'où le découpage en deux temps).
**Avant** : temps 1, rien. Temps 2 : 304, 321, 306, 322, 323, 324, 326, 327 (voir le tableau « Ce qui attend un lot de code ») · **Après** : 308 (livraison) · **Avant la première APK** : non (mais le temps 1 est utile avant, `INSTALLATION.md` est lu par les testeurs).

### Règles du lot (à appliquer partout)
1. **Le code dit vrai** ; une description qui n'a pas de fichier cité n'est vue par aucun outil : `docs-cites` et `docs-inventaire` sont verts alors que les documents disent faux (ils ne contrôlent ni les phrases, ni les chiffres, ni les clés `tracker.*`, ni les chemins du poste).
2. **La documentation ne devance pas le code** (D1 R10) : une phrase qui décrit ce que supprime un lot de code (`PRESET_RESETS`, relectures d'anciennes données, fiches « à classer ») ne s'écrit qu'après ce lot. Chaque correction ci-dessous porte donc [maintenant] ou [après le lot N].
3. Les numéros de ligne datent du 11/11, avant toute retouche : appliquer de bas en haut dans chaque fichier, ou chercher le texte cité.
4. **Ne pas renuméroter `DECISIONS.md`** (voir plus bas). `§2` devient « Analyses communes », `§5` devient « Test de FC repos » ; les numéros 1 à 11 restent.
5. Ne plus écrire de chiffres qui périment (« 415 fichiers », « 226 styles », « 13 pages ») : renvoyer à la commande qui les donne.
6. Faux amis à garder : `course` = parcours de balises, `cadence` = rythme des points GPS ou cadence du pumping, `marche` du cap (`heading.ts`), `allure` de voile, `landingMs`, `running` = « en cours ».
7. Les corrections d'atelier de `CLAUDE.md` que la fiche 318 (partie C) listait sont **reprises ici** (un constat, un lot) ; la fiche 318 ne garde que `.claude/`, `MODELES.md` et les règles du BACKLOG.

### Temps 1 : le faux d'aujourd'hui [maintenant]

#### `CLAUDE.md` (125 lignes ; 27 corrections, dont 12 déjà en 318 C)
- `:5` · « # Tracker : analyse de sessions sportives à partir de traces GPX » → « # Gtracker : analyse de sessions de voile et de surf à partir de traces GPX » (`AppShell.tsx:186-188`)
- `:7` · « … la course, le vélo et l'Entraînement retirés aux lots 302 et 303 (bibliothèque `/fractionne` gardée en lecture), pages … » → « Application 100 % client (React 19, TypeScript, Vite 8, Recharts, Leaflet), sans backend. Deux familles : voile (`/voile` : wingfoil, planche, kite, bateau) et surf (`/surf`), plus les pages `/enregistrer`, `/itineraires`, `/statistiques`, `/profil` et `/parametres`. Interface et commentaires en français. Application Android via Capacitor, avec enregistrement GPS natif et mémoire en dossier portable. » (aucune mention de la terre ; `App.tsx:110-119` redirige les anciennes adresses, `:105-134` liste les vraies)
- `:11` · titres de sections → « … en sections 1 à 11 (voile, analyses communes, sauts, surf, test de FC repos, enregistrement, planification, mémoire, Profil, Statistiques, Réglages et accueil) »
- `:50` · « dépôt GitHub privé (`segneur34/Tracker`) » → « un dépôt GitHub privé, envoi seulement sur accord » (sans nom : l'adresse du vendeur est une identité, fiche 153)
- `:51` · « **Tracker complet en lecture seule.** … `C:\Users\segne\tracker` … `~/.claude/plans` … une correction commune se refait dans Tracker » → **supprimer la puce entière** (décision 3). Les refus d'écriture de `.claude/settings.json` (lignes 11-17) restent jusqu'au lot 324 : ce sont des droits, pas de la documentation
- `:55` · « Aucun GPX réel dans le projet : les tests sont synthétiques » → à vérifier : `src/core/gpxParser.corpus.test.ts` et `src/test/gpx/corpus.ts` existent ; garder si le corpus est synthétique (il l'est)
- `:77` (texte O1, d'accord avec D1 sur « moth, paddle ») · → « Nouveau calcul de support : son identifiant dans `SportType` (`core/types.ts`), une entrée de `SPORT_PROFILES` avec sa famille et tous ses seuils (`core/sportProfiles.ts`), sa couleur (`BASE_COLOR`, `core/activities.ts`) et son icône (`BASE_ICON`, `core/activityIcons.ts`) ; le module, les onglets et les chiffres du direct viennent de sa famille, sauts, pumping et vagues des capacités de son profil. `core/sportProfiles.test.ts` vérifie qu'il est complet. Une activité (moth, paddle, SUP foil…) n'est jamais en dur : l'utilisateur la crée dans Réglages sur un calcul (`core/activities.ts`). » (« trail » était la course à pied)
- `:78` **en deux temps, O1 prime** · [maintenant, texte provisoire sans le faux] « Famille et traitement : la famille range les sessions (bibliothèque, accueil, barre, listes d'activités, Réglages : `sportFamily`), le traitement dit comment elles se calculent et s'affichent (unités, chiffres du direct, onglets, module d'analyse : `sportTreatment`). Les deux valent aujourd'hui `'voile' | 'surf'`. » (retirer « énergie, vélo, altitude, revêtement » et « le fractionné les distingue » : faux, `core/sportProfiles.ts:683-714`) · [après le lot 326, fusion faite ; **O1 tranche : fusion**, pas le texte de D1 qui garde une distinction qu'aucun code ne réalise] « Famille d'un calcul (`SportProfile.family`, `sportFamily`) : elle range ses sessions (bibliothèque, accueil, barre, listes d'activités, Réglages), choisit son module et ses tables propres (onglets `core/analysisTabs.ts`, unités, chiffres du direct `recording/liveFields.ts`, partage `library/shareStats.ts`). À l'intérieur d'une famille, un comportement se lit dans les capacités du profil (`jumps`, `pump`, `surf`, `withoutActiveThreshold`, `speedRangeFollowsPace`), jamais par un nom de calcul en dur (`=== 'kite'`) : `src/architecture.test.ts` le garde. »
- `:79` **O1 corrige D1** (D1 le disait exact ; il est inexact : le défaut n'est pas « lu par la fonction de défaut du hook », ce sont les `default*Of` de `settings/activitySettings.ts:42-89`) · [maintenant] → « Réglage utilisateur : un champ de `StoredSettings` (`settings/activitySettings.ts`), rangé par identifiant d'activité (`PER_ACTIVITY_KEYS`), écrit par une règle de `SETTING_FIELDS`, lu par son `resolve*` et `settingsView`, montré dans `pages/SettingsPage.tsx` ; son défaut par `default*Of`, qui lit le pré-réglage (`settings/activityPresets.ts`, `presetOf`) puis le profil du calcul. Le magasin et `useAllSportSettings` sont dans `hooks/useSportSettings.ts`. »
- `:80` (O1) · → « Page d'analyse : une seule par famille (règle 9) ; un calcul neuf n'en crée pas. Suivre `docs/MISE_EN_PAGE.md` (`AnalysisShell`, `AnalysisMap`, `analysisMobile.css`, `PanelTitle`, `SessionNameEditor`) ; ce qui devient commun aux deux modules va dans une pièce partagée (`components/`), pas dans une copie. »
- `:81` (D1 et O1, d'accord) · → « Section de module : une entrée dans `SAILING_TABS` ou `SURF_TABS` (`core/analysisTabs.ts`, défauts déduits par `tabDefaults`) ; si elle dépend d'une capacité du calcul, son filtre dans `analysisTabs`/`activityTabs` ; puis un bloc `{open.cle && …}` dans un `ResizablePanel` d'`id` unique … » (les modules d'analyse n'ont pas de `*_SECTION_DEFAULTS` : seul `PlanningPage.tsx:249` en a un)
- `:83` · « (top, podium, zone de pente, répétition, saut) » → « (top, podium de manœuvres, saut, vol, zone cardio, partie d'un graphe) » (`components/highlightColors.ts`)
- `:85` · « … foil, pumping, poids du vélo, charge portée, repères du bouton « Note » … » → « Donnée propre à une session (notes, vent saisi, seuil d'activité, allure imposée, foil, pumping, repères du bouton « Note », support et activité) : … écrite par `updateSessionRecord` (`hooks/sessionLibrary/sessionRecords.ts`) … » (reste de la puce exact)
- puce à ajouter après `:86` (O1) · « Calcul de glisse neuf (vol, vague, run de downwind…) : pur, dans le dossier de sa famille (`sailing/` ou `surfing/`), seuils dans le profil (règle 3) ou son sous-profil (`surf`), en SI hors `sailing/` (règle 5), testé sur trace synthétique à 1 Hz et 5 Hz (règle 2) ; s'il change un chiffre du résumé, `SUMMARY_CALC_VERSION` augmente et `library/summaryFrozen.test.ts` est refigé en le disant. »
- Table « Avant de toucher à » (`:93-105`) · `:96` → « graphes et leur zoom, temps en mouvement, matériel et notes, altitude | 2. Analyses communes » ; `:99` → « test de FC repos (`restingHrTest`, `RestingHrTestPage`, sous le Profil) | 5. Test de FC repos » ; `:105` → « `pages/SettingsPage`, `pages/Home`, `core/activities` | 11. Réglages et accueil » (`activityPresets` passe à la ligne suivante) ; **lignes à ajouter (O1)** : « `core/sportProfiles.ts` (familles, profils, capacités), `core/analysisTabs.ts`, `recording/liveFields.ts`, `settings/activityPresets.ts` | 1. Voile et 4. Surf, et « Où ajouter quoi » plus haut » ; **et (D1)** : « `components/AnalysisShell.tsx`, `pages/SailingModule.tsx`, `pages/SurfModule.tsx` | `docs/MISE_EN_PAGE.md` » ; `:101` voir temps 2
- `:110` (D1 plus la précision d'O1) · → « … une seule coloration d'une session, la même dans son analyse et sa vignette (`core/trackColor.ts`) : la vitesse lissée du noyau, sans lissage de plus … (valeurs aux §1 et §4) … » (« sans lissage » seul laisserait croire la trace brute)
- `:111` · → « Session : vent saisi, seuil, allure imposée, couleurs de la trace, repères et notes restent en brouillon jusqu'à « Enregistrer la session » (Annuler, avertissement en quittant). Le seuil est propre à chaque session, dans sa fiche, et prime sur celui du support. Le support se change immédiatement. »
- `:112` · retirer « (et « fractionné » en famille Fractionné) » et « §2 » : « la barre commence par « général », puis … (liste par sport aux §1 et §4) … »
- `:113` · → « Onglets des analyses : ordre par sport aux §1 et §4, onglets montrés choisis par activité (§11). Chaque graphe se replie à sa place, partout, dès qu'un panneau en a plusieurs. … » (« compris » n'a plus de sens : ce sont les deux seuls modules)
- `:114` · → « Matériel et notes : un onglet dans les deux analyses, juste avant « réglages » (« matos et conditions » en voile, « matériel et notes » en surf), avec partout l'appréciation et le commentaire ; champs de matériel du surf au §2 ; aucun matériel repris d'une autre session, vide si pas donné (§8). »
- `:115` · → « Activités : … au départ « Voile » en voile, « Surf » et « Surf foil » en surf ; … » (`core/activities.ts:92-96`) ; le lot 315 y ajoutera « Bateau » (et DECISIONS §11) : à mettre à jour avec lui
- `:117` · **[après le lot 306]** retirer la phrase « Des pré-réglages changés effacent une fois les anciens réglages qu'ils couvrent (`PRESET_RESETS`) » et écrire « Pré-réglages : chaque activité de départ démarre sur les réglages du téléphone de l'utilisateur, sa référence en cas de doute (`settings/activityPresets.ts`) ; ils sont le « défaut » de Réglages, et une activité créée prend ceux de son calcul. Valeurs par sport aux §1 et §4. » (la règle serait fausse avant le code)
- `:120` · → « DA de la maquette Canva : Montserrat, logo GONG, fond gris bleuté, cartes blanches, vert Enregistrer ; tout passe par les variables. … Une couleur par famille (bleu voile #004aad, gris surf #5b6670), qui porte du texte blanc ; chaque activité prend une des six nuances de sa famille ; familles dans l'ordre Voile, Surf. … » (`theme/tokens.css:140-143`, `core/activities.ts:46-50`)
- `:121` · « l'accueil par le logo « Tracker » » → « l'accueil par le logo GONG et le nom « Gtracker », sans lien « Accueil » en haut »
- `:122-125` · puce « Reste à faire » qui répète l'en-tête de `BACKLOG.md:3-9` → une ligne (« règles dans son en-tête ; ce que l'utilisateur lit ne porte aucun jargon ») ; `:53` et `:124` disent la même chose sur les essais au téléphone : garder `:53`
- règle 12 (`:72`) · liste de `src/platform/` incomplète (manquent `compass.ts`, `recovery.ts`, `share.ts`, `mapTiles.ts`, `tileCache.ts`, `previewStore.ts`, `systemBars.ts`, `backButton.ts`, `runtime.ts`) → ajouter « … `permissions.ts`, `compass.ts`, `share.ts` » ou « (liste complète : `docs/INVENTAIRE.md`) »
- règle 9 (`:69`, **O1**) · [maintenant, vrai aujourd'hui] → « 9. Une famille, un module d'analyse, une adresse (`/voile/analyse`, `/surf/analyse`, `core/parentPage.ts`) ; le module ne reprend que les activités de sa famille : `useSportSettings(family)`. Une session qui change de famille change de module. » (avec elle, le commentaire `hooks/useSportSettings.ts:497-502`, « la course n'hérite pas du seuil de vol du wingfoil », devient « le surf n'hérite pas … » : c'est du code, lot 325)
- `CLAUDE.md` exact, rien à faire : règles 2 à 8, 10 à 12 (la règle 10 « cadence variable » est la cadence des points GPS, faux ami), règle 4 (`core/sessionSpeed.ts`), `:9-16` liste « Chaque information a une seule place », `:118`, `:119`
- **Ne pas écrire** de règle « ajouter une famille » (D1 Q5 et O1 : ≈ 20 tables et une page, à ne faire que sur demande ; la garde « chaque famille a sa route et son module » le rappelle)

#### `docs/DECISIONS.md` (179 lignes ; 52 corrections ; annexe : D1 §2)
Structure : **ne pas renuméroter**. 27 renvois « DECISIONS §N » vivent dans `HISTORIQUE.md` (lignes 289, 301, 321, 322, 340, 372, 377, 381, 390, 410, 436, 772, 1038, 1077, 1172, 1177, 1181, 1186, 1190, 1195, 1205, 1210, 1215, 1220, 1230, 1235, 1240, 1245), 8 dans `src/` et `docs/`. Renuméroter (table 1→1, 3→2, 4→3, 6→4, 7→5, 8→6, 9→7, 10→8, 11→9) obligerait à toucher 17 renvois de `CLAUDE.md`, 14 de `DECISIONS`, 7 de `src/` (`SessionEndGear.tsx:18`, `restingHrFile.ts:12`, `record.ts:736`, `sailingStats.ts:85`, `AnalysisBaseLayers.tsx:15`, `drawTrackPreview.ts:12`, `recording/session.ts:121`), `ETAT:441, 450`, 28 de `HISTORIQUE`, `BACKLOG.md:55`, fiches 154 (`:30`), 160 (`:22`), 151 (`:23`) : **déconseillé**. Renvois de `src/` à garder valides : `sailingStats.ts:85` « DECISIONS §2, « Rien en voile » » (garder la phrase d'altitude en §2), `AnalysisBaseLayers.tsx:15` « §2, « le violet suit le zoom » » (garder la phrase dans la puce-pointeur), `hooks/restingHrFile.ts:12` « (DECISIONS §5) » (reformuler : « Les tests restent sur l'appareil et dans ce fichier. »).
- `§1 Voile` · AJOUTER (venant de §2) : « Temps en mouvement : les pauses de l'enregistrement et les arrêts complets sont ôtés d'office (plancher d'arrêt `stillThreshold` : 1 nœud en voile, 2 km/h en surf) ; un seuil d'activité à 0 veut dire « aucun seuil réglé », pas « aucun plancher » (décision du 27/10). » et « Vitesse maximale (Q34, 30/10) : la meilleure moyenne sur 2 s, partout (liste, résumé, direct, voile), jamais le maximum d'un point ; sur une trace à plus de `maxGapS` par point, repli sur la plus haute vitesse lissée. » ; `:10` « lus comme à pied et à vélo (§2) » → « zoomables comme tous les graphes d'analyse (`docs/MISE_EN_PAGE.md`) »
- `§2` « 2. Course et vélo » (`:32-51`, 20 puces) → « **2. Analyses communes** », **trois puces** : (1) « Graphes d'analyse : zoom, « +carte » et « Afficher » décrits dans `docs/MISE_EN_PAGE.md` (pièces `ZoomableChart`, `useChartZoom`, `useZoomOnMap`). Le violet de « Afficher » suit le zoom ; « Tout voir » efface un tronçon montré zoomé et ramène à toute la trace un tronçon montré entier ; le retour d'Android referme le plein écran et rend l'analyse telle qu'avant le clic. » (copier les deux premières phrases aussi dans `MISE_EN_PAGE.md:37`) ; (2) la puce `:41` « Onglet « matériel et notes » … » **gardée**, sans « (fractionné compris) » ; (3) « Altitude : ni la voile ni le surf n'affichent d'altitude ni de dénivelé. » (remplace `:42`, ancre de `sailing/sailingStats.ts:85`). **Supprimer** les 17 autres puces (`:34-40`, `:43-51` sauf `:41` et `:49` déplacé en §1) : énergie, pente, cadence, revêtement, IGN, couleurs par défaut de la course, allure en min/km, tops à pied, tranches par kilomètre, niveau, bornes. Alternative si l'utilisateur préfère supprimer §2 : matériel et notes en §4, phrase d'altitude en §1, et « 2. (retirée) »
- `§3 :55` (sauts) · [maintenant] retirer « en course et à vélo », « à terre », « Course, Marche… sauf au VTT », « La Course part en plus avec la case décochée » ; **garder jusqu'au lot 306** la phrase « un choix d'onglets déjà rangé garde tout le reste et gagne « sauts » décoché » (compatibilité) ; texte cible : « Sauts, en voile sauf bateau : mesurés par l'accéléromètre et le gyroscope du téléphone fixé au corps (« Mesurer les sauts » sur Enregistrer, Android seulement), réglés par activité dans Réglages (case « Sauts », emplacement, hauteur minimale ; ni en bateau ni en surf). … Onglet « sauts » entre vmg et vols, proposé si la session a ses capteurs et si l'activité garde l'onglet. … Défaut de la case : coché en wingfoil, planche et kite, décoché ailleurs. » (D1 §3 :55 donne le texte complet ; `core/analysisTabs.ts:43-45`, `core/sportProfiles.ts:600-621`)
- `§4 :66` · « Comme les pas à pied, chaque série a sa cadence d'abord » → « Chaque série a sa cadence d'abord, puis sa durée, … » (`core/pumping.ts`, cadence du pumping, à garder)
- `§5` « Fractionné » → « **5. Test de FC repos** », **une puce** : « Test de FC repos (24/10), sous le Profil (`/profil/fc-repos`, lien dans la page Profil) : 3 min sans GPS, la moyenne sur 30 s la plus basse après la première minute (protocole v2, 25/10) et sa courbe ; une page à part, sans enregistreur ; gardé sur l'appareil et recopié dans `fc-repos.json` à la racine du dossier mémoire (HISTORIQUE, point 288) ; « La retenir comme FC repos » pour Pratiquant. » · **supprimer** `:73-81` (page Entraînement, Timer, Muscu, compteur, chrono, boutons orange, famille Entraînement, page Séances, analyse « fractionné », test de FC max) et la fin de `:82` (« il ira dans les sessions avec la muscu … point 145 », fausse)
- `§6` · `:86` couper « , à ne pas confondre avec l'« Arrêter » du compteur d'intervalles, tenu 1 s fixe (§5) » ; `:88` → « Réglés par activité, partie « enregistrement » de sa carte de Réglages : la pause automatique, les chiffres de la carte réduite à l'enregistrement (quatre au plus) et ceux de la notification lisible écran verrouillé (deux au plus, au-delà Android coupe la ligne : vitesse et distance par défaut ; en pause manuelle, « en pause » et la durée figée dans le titre, chiffres figés). » ; `:91` « après une course de 32 min » → « après une sortie de 32 min » ; `:95` retirer le compteur et le chrono (« Écran gardé allumé … pendant un enregistrement (pause comprise) … ») ; `:98` **supprimer** (graphe de dénivelé de la trace suivie : `FollowedElevation` jamais monté, lot 325) ; `:99` retirer « rangée « Type » … « Test » dessous » ; `:102` couper « FC et récupération par répétition ; » ; `:103` retirer « muscu ou GPS du téléphone » et « ni un test guidé » ; `:104` **supprimer** « Course à bornes » en gardant la dernière phrase (case « Zones » du graphe cardio) collée à `:102` ; `:105` **supprimer** (case « Mesurer la cadence » absente du code)
- `§7` Planification · `:111` [maintenant] « Voile et Surf ont « Réalisées / Planifiées » » ; [après le lot 304] supprimer `:113-116, 119, 120, 122` (types de voie, recalcul, revêtement, temps estimé, boucle, altitude IGN) et « surface » de `:117`, garder `:109, 110, 111, 117, 118, 121` allégée (voir D1 §4 « DECISIONS §7 »)
- `§8` · `:126` « un dossier portable `Tracker/` » → « `Gtracker/` » (`MEMORY_FOLDER_NAME`, `platform/memoryFolder.ts:182`) ; `:134` « Ouvrir avec Tracker » → « Gtracker » (nom final au lot 323) ; `:142` « (activité, repères, séances, test, foil) » → « (activité, repères, foil) » **[après le lot 306]** ; `:128` AJOUTER en fin de puce (porte d'import) : « C'est ce paquet, ou un GPX simple, que l'import accepte d'où qu'il vienne. » ; `:135` **[après les lots 321 et 306]** → « Session importée d'un paquet ou d'un GPX : ce que le fichier ne porte pas reste nul, rien n'est inventé ni emprunté à une autre session ; sans foil dans sa fiche, celui de l'activité est montré « supposé » ; une fiche au résumé abîmé reste lisible et son résumé est refait depuis le GPX. » (conserve la porte, supprime « version ancienne ») ; `:139` [après le 304] couper la seconde moitié (« en planification, toucher un revêtement … ») ; `:143` « Ordre de lecture : seuil de la session, puis seuil porté par sa fiche… » à revoir si le lot 306 retire une branche de `record.ts`
- `§9` · `:150` « un des seize dessins » → « un des neuf dessins » (`core/activityIcons.ts:12-15`) ; « bande de quatre chiffres (activités, distance, D+, sport préféré) » : **attend la réponse à la question D+** (D1 Q6 / O1 Q2, défaut : retirer, avec `ProfilePage.tsx:232-241` et `library/stats.ts:240-271`)
- `§10` · `:161` couper « D+ à pied et à vélo ; cadence moyenne à pied ; » et « % de vol (foil) » → « % de vol (foil, voile et surf) » ; `:162` **supprimer** (onglet « niveau ») ; `:165` « À venir… étape 2 (W/kg, poids passé…) » → « À venir, à décider avec l'utilisateur : d'autres onglets. »
- `§11` · `:171` « (§2, §6, §7) » → « (§1, §4, §6, §7) » ; `:172` « (« tops » à pied et en surf) » → « (« tops » en surf) » ; `:173` « parmi 14 » → « parmi 13 » (à confirmer par `tutorials/tutorials.test.ts`) ; `:178` supprimer « Motif à pied « Relief et sentier » depuis le 28/10 » ; `:179` → « bouton glissant pour « Résumé / Détails », le tri des sauts et des vagues et « Itinéraires / Sessions » »

#### `docs/MISE_EN_PAGE.md` (84 lignes ; 15 corrections ; annexe : D1 §3)
Toutes [maintenant] sauf `:50` et `:64`. · `:3` → « Patron commun aux modules d'analyse (voile, surf) et à tout sport à venir. » ; `:8` retirer « (la course ne passe pas `kept`, et la voile non plus) » (la prop `kept` de `SessionSaveBar.tsx:10` est du code mort, lot 325) ; `:10` « onglets `primary` (« général ») » ; `:11` couper « (avec « fractionné » quand la session en a, HISTORIQUE, point 89) » et « D+ et profil d'altitude compact `ElevationProfileMini` à pied et à vélo, zoomable avec son « +carte » » ; `:13` → « … activité, seuils, source de vitesse, bornes de couleur de la trace (`SpeedRangeEditor`). Seuil et couleurs passent par le brouillon ; l'activité s'applique tout de suite. » (pas de source d'altitude) ; `:14` → « La même disposition en voile et en surf (HISTORIQUE, points 86 et 97). » ; `:36` → « … montrer un top, un podium de manœuvres, un saut, un vol, une zone cardio ou la partie d'un graphe (« Afficher ») retire la précédente » ; `:37` « (profil du fractionné) » → « (courbe des sauts) » (`hoveredRow` n'est lu que par `JumpsPanel.tsx:11`), retirer « profil superposé des répétitions », AJOUTER le violet qui suit le zoom et « Tout voir » (texte de DECISIONS §2) ; `:47` « commun aux deux modules » ; `:58` retirer « (celle de la pente est partie avec la course et le vélo, lot 303) » ; `:82` → « Une liste d'onglets du module dans `core/analysisTabs.ts` (`*_TABS`, le défaut s'en déduit par `tabDefaults`) et `useAnalysisTabs` ; chaque panneau est titré par `PanelTitle`. » · [après le 304] `:50` retirer la ligne `ElevationProfileMini.tsx` (planification seule), `:64` supprimer la ligne `SurfaceHighlight.tsx` ; [maintenant] `:64` → « (planification) » · `:34` `--land-w`, `--land-side-min` : variables réelles (`tokens.css:97-98`) à renommer avec le texte (`--side-w`, `--side-min`) : lot de code, pas de doc seule

#### `docs/ETAT_DU_PROJET.md` (annexe : D2, section ETAT ; les corrections suivantes sont les plus lourdes)
- `:1` « # État du projet Tracker » → Gtracker ; `:11` « Tracker est une application web 100 % client… » → « Gtracker est une application web 100 % client qui lit une trace GPX de voile ou de surf et en tire des analyses. Capacitor l'emballe… »
- `:14` (Course), `:15` (Vélo) · **supprimer** ; `:16` (Fractionné) → « - **Test de FC repos** (points 145 et 288) : sous le Profil (`/profil/fc-repos`, `RestingHrTestPage`), résultats gardés sur l'appareil et recopiés dans `fc-repos.json` du dossier mémoire. » ; `:18` « (`/voile`, `/course`, `/velo`, `/fractionne`, `/surf`) » → « (`/voile`, `/surf`) »
- `:30` · « `main` suit `origin/main` (`segneur34/Tracker`, dépôt privé), identifiants mémorisés » → « dépôt git local avec un dépôt GitHub privé, envoi seulement sur accord » (`git remote -v` vérifié par le rapport D4 : `origin` est `segneur34/Gtracker.git`, déjà propre ; ne pas écrire son nom) ; `:31` retirer « auteur Tom Briere »
- `:42` (famille/traitement) · **[après le lot 326]** « Une seule notion, la famille (`SportFamily`, `'voile' | 'surf'`), écrite une fois dans le profil » ; [maintenant] « Les deux portent les mêmes noms (`'voile' | 'surf'`) depuis le lot 305. »
- `:54` · « seize composants de `pages/` sur vingt-quatre adresses… » → « treize composants de `pages/` sur quatorze adresses, routées dans `App.tsx` (accueil, bibliothèque commune aux deux familles, analyses de voile et de surf, test de FC repos sous le Profil, Enregistrer, planification, liste des itinéraires, statistiques, profil, Réglages, tutoriels), toutes dans `AppShell`… ; les anciennes adresses de la course, du vélo et de l'Entraînement mènent à l'accueil. » (**mais ne plus écrire de chiffre**, règle 5)
- `:64-67` · tableau des dépendances : supprimer les lignes `running` et `land` (64, 65) ; `planning` → `core` ; `recording` → `core`, `platform`, `sailing`, `planning` ; ajouter `tutorials | core` (à confirmer par `grep`)
- `:153-155` §4.3 « Course, vélo et fractionné (retirés) » → un renvoi : « ### 4.3 (supprimé) : Course, vélo et Entraînement ont été retirés aux lots 302, 303 et 305 ; numéro de section gardé, car le code y renvoie. » (supprimer les phrases « fiche de l'application complète », `core/retiredLand.ts`)
- `:180-181` · « Tracker/ ; tracker.json marqueur { format: "tracker-memoire" } » → « Gtracker/ » ; le marqueur : **[après le lot 322]** (renommé `gtracker.json`)
- `:201-207` (champs de fiche) · [maintenant] ajouter « (`effortThresholdMs`, `terrain`, `bikeWeightKg`, `loadKg` : champs d'avant le fork, plus lus par l'interface) » et supprimer `:204` (séances du compteur), `:205` (test guidé), `:206` (`surfaces` à pied), `:207` (altitude du terrain) ; **[après les lots 306 et 304]** la ligne devient « `analysis { windDeg; activeThreshold; referenceSpeedMs; speedRange; foil; waveThreshold; pumping; savedAt }` »
- `:212` · « `SUMMARY_CALC_VERSION` 18 depuis le 05/11 : champ `bests` … onglet « niveau » … » → « (`SUMMARY_CALC_VERSION` 18 ; les versions 17 et 18, qui ajoutaient des meilleurs temps à pied et à vélo, ne servent plus qu'à garder le numéro ; 16 du 04/11 : …) » ; `:219`, `:229`, `:198` : retirer la cadence à pied (`library/summary.ts` n'écrit plus de cadence ; `library/fitToGpx.ts:41`)
- `:283-287` (réglages d'activité) · retirer « et de pente (en fraction) », « type et poids du vélo, charge portée en course (`carriedLoads`) », « niveau du temps estimé … types de voie cochés d'office … pas de l'altitude du terrain (`terrainSteps`) », « modèle de dépense à pied (`energyModels`…) », les séances du compteur (`intervalPresets`, `lastIntervalWorkout`), « en course et à vélo » de `jumps`
- `:262` (sections ouvertes) · supprimer les clés `running.energie`, `cycling.energie`, `<module>.zones`, `<module>.cadence`, `intervals` et la phrase sur l'effacement des anciennes clés [après le lot 306, avec `FORMER_TAB_KEYS`]
- §7 (`:298`) retirer la pente (`GradeProfile`) et l'énergie ; `:308-309` supprimer les lignes Course et Vélo ; `:314` supprimer la ligne Fractionné ; `:315` « des profils de voile » ; `:310-312`, `:318` [après le lot 304] (rangs de difficulté, altitude du terrain, revêtement, `GRADE_COLOR_STEPS`)
- §9 (`:348-358`) · `:348` « Plus de fichier mort ni de `any` » → « Pas de `any` dans `src/` ; le code mort laissé par le retrait de la terre est suivi au reste à faire (lots 304 à 309, 325). » ; supprimer `:350` (distance pour les allures) et `:351` (pente manquante) ; `:356` « (voile, surf, itinéraires) » ; `:358` « 268 `style={{` … 91 » → ne plus donner de chiffre (`node outils/styles-en-ligne.mjs`)
- §11 · supprimer `:371` (énergie), `:372-375` « Course » (garder une puce « **Cardio** » : zones communes, FC moyenne dans « général », bips de sortie de zone, énergie estimée par la FC en voile et en surf, Keytel 2005, ordre de grandeur à 25 % près, jamais éprouvée sur l'eau avec une ceinture → essai 75), `:373` (`keepCapture`), `:386` (couleurs des familles), `:385` → « **Test de FC repos** (points 145 et 288) : gardé sous le Profil ; ses résultats sont dans la clé de l'appareil, recopiés dans `fc-repos.json` du dossier mémoire, hors des sessions. » ; `:370` (« Distance (point 300) … Rapport : fiche 184, restée dans Tracker complet ») réécrire ou supprimer ; `:377` → « **Sauts** (point 96 et 291) : le comptage en wing (une dizaine de sauts les 08/10 et 21/10) est juste depuis l'écart des rebonds. » ; `:376` retirer « cadence » ; `:387`, `:389-390`, `:375` : mots « course » (sortie, activité de la montre) ; **tous les « reste à faire n° N » de §11** (`:344, :369, :373, :374, :375, :376, :383, :385, :386, :401, :389`, numéros 26, 29, 36, 41, 42, 44, 97, 107, 126, 127, 164, 191) renvoient à l'ancien suivi : à contrôler un par un dans `docs/BACKLOG.md` ou à retirer
- §12 · `:407` (« Copie de Tracker 1.0.0 … `C:Userssegne	racker` ») → « **Gtracker**, version voile et surf (série 0.00.xx, APK `Gtracker-<version>.apk`). Identifiant `<…>` [après le lot 323], dossier mémoire `Documents/Gtracker`, banc sur 4195 (Chrome 9480). » (le chemin du poste est abîmé par une tabulation) ; `:409` supprimer l'appareil de l'utilisateur ; `:415-416` supprimer le lien `claude.ai` de la maquette ; `:417-427` (plan en six lots, hors plan, audit du 09/10, revue du 27/10 avec chemins `D:\gong tracker\atelier\…`) → une phrase : « Phases 0 à 3 et plan en six lots : faits avant le fork (23/09 au 08/11), détail aux points 36 à 322 de `docs/HISTORIQUE.md`. » ; `:428-430` retirer « mini-courbes du fractionné » ; `:431` → « **Version voile et surf** (fiche 154) : E1 avant le fork ; après lui, lots 301 (fiche et résumé), 302 (Entraînement), 303 (course et vélo), 305 (types et réglages) faits le 08/11, puis la suite au reste à faire (`docs/BACKLOG.md`). » ; `:432-437` supprimer « Suite possible : calcul des itinéraires hors ligne » ; `:445`, `:452`, `:458` retirer le compteur, l'« Étape », « muscu » ; `:462`, `:465`, `:469` « Tracker » → « Gtracker » (`lancer-gtracker.bat` [après le lot 322 ou 330]) ; `:471-472` retirer les chemins du JDK et du SDK ; `:479` « Signature : clé dédiée … » → « clé dédiée hors du dépôt (chemin et mots de passe dans `android/keystore.properties`, voir `DEVELOPPER.md`) » [le détail après le lot 323] ; `:482-484` repère de version → « série `0.00.NN`, `versionCode` = formule + 1 (`android/app/build.gradle:8`) ; chaque APK diffusée porte un tag annoté `v<version>` » (supprimer 0.4.89, 0.4.104 et `git push origin main --follow-tags`)
- Illisible pour un lecteur neuf (D2) : `:3-7`, §2 (identifiants mémorisés, Node 26 « comme le poste »), §9 (« élément 160 », « cliquet »), §10, §11 entier (« essai 132 », « Q28 », « fiche 184 », « APK 0.4.80 »), §12 (« POCO 2412DPC0AG », « HyperOS »). À court terme, ne corriger que le faux ; la refonte lisible est au lot 308 (livraison) ; paragraphes de 1,5 à 4 Ko sur une ligne (`:424`, `:85`, `:212`, `:294`, `:219`) à couper en puces de 400 caractères au plus

#### `docs/INVENTAIRE.md` (annexe : D2, section INVENTAIRE ; 41 lignes de description fausses ou à suivre)
[maintenant] : `:8` (routes) → « `/` (accueil), `/voile` et `/surf` (bibliothèques), `/voile/analyse` et `/surf/analyse` (`?session=`), `/enregistrer`, `/itineraires` (`?itineraire=`), `/itineraires/liste`, `/statistiques` (`?famille=&activite=&periode=`), `/profil`, `/profil/fc-repos`, `/parametres`, `/tutoriels` et `/tutoriels/:id` ; les anciennes adresses `/course/*`, `/velo/*`, `/fractionne*` mènent à l'accueil. » (les redirections tombent au lot 306 : alors la dernière phrase saute) ; `:14` retirer « cadence, séances et type de vélo partis au lot 305 » ; `:17` `formatLandSpeed` → « allure par km ou par mille, unité obligatoire ; nom hérité » ; `:26` (`trackPaths.ts`) → « (zones de FC) » ; `:32` (`windowMean.ts`) ; `:58` (`backdropPattern.ts`, motif « à pied ») ; `:85` (`signalTones.ts`, « sortis du test de FC max ») ; `:93` (`liveStats.ts`) → « statistiques en direct par segment (`computeLiveStats`, `LIVE_STATS_DEFAULTS`), « Moyenne active » en voile et en surf calculée comme l'analyse. » ; `:114` (`restingHrStore.ts`, « sorti de `running/restingHrResults` ») ; `:116` (`record.ts`) → « `SessionRecord` avec `activityId`, `SessionAnalysis` avec le pumping, repères `marks` ; champs d'avant le fork (`intervals`, `test`, `surfaces`, `terrainElevation`, `bikeWeightKg`, `loadKg`) gardés bruts (`GUARDED_FIELDS`), à retirer au lot 306 » ; `:133` (`fitToGpx.ts`, « FC, vitesse et cap gardés ») ; `:171` (`incomingFile.ts`) ; `:204` (`createTickingStore` : retirer « compteur d'intervalles, chrono, test guidé » ; si aucun appelant, code mort, lot 325) ; `:207`, `:209` (`useSessionJumps.ts`, « de la voile »), `:225` (`useLiveRecording.ts`, sans « énergie »), `:242` (`useRunnerProfile.ts`, sans « économie de course »), `:265` (`RecordingPage.tsx`, sans « carte « Compteur » »), `:267` (`--test-accent` : vrai, posé dans `RestingHrTestPage.css:6`), `:269` (`SettingsPage.tsx` sans vélo ni temps estimé), `:277` (`JumpsPanel.tsx`, `JumpMapLayer.tsx` : « de la voile »), `:278` (`TopsPanel.tsx` : « voile et surf »), `:282` (`ZoomableChart.tsx` : « analyses de voile et de surf, planification, statistiques »), `:292` (`HeartRatePanel.tsx`), `:298` (`AnalysisShell.tsx`, « surf et voile »), `:371` (retirer `D:\gong tracker\atelier\archives\`), `:377` (`outils/banc/`) ; `:346`, `:212` exacts. · [après le lot 304] `:138` (`route.ts`, `presetWayTypes`), `:144` (`duration.ts`), `:151` (`grade.ts`), `:152` (`importedElevation.ts`), `:266` (`PlanningPage.tsx` : onglets Général, Tracé, Points, Enregistrer et « Partir », Mes itinéraires ; sans « Surface (hors voile) »), `:281` (`gradeGradientDefs.tsx`), `:303` (`ElevationProfileMini.tsx`), `:298` (`GradeLegendRow.tsx`) · [après le lot 322] `:128`, `:145-146`, `:175-176` (`tracker_colors.xml`, `window.trackerBack`), `:179`, `:206`, `:212`, `:235-252`, `:268`, `:313` (clés `tracker.*`, formats) · [après le lot 323] `:182-184` (chemins Java) · [après le renommage du `.bat` et de l'icône] `:357`, `:363`
- Les garde-fous : `outils/docs-inventaire.mjs:63` `DOSSIERS` (lot 330) ; renvoyer les clés de stockage à ETAT seul (14 lignes d'INVENTAIRE les répètent)

#### `README.md`
- `:1` · « Ce dépôt est **Gtracker**, la version voile et surf de Tracker destinée à la vente (copie de Tracker 1.0.0 du 08/11). » → **supprimer** ; `:3` « # Tracker » → « # Gtracker » ; `:5` → « Analyse de sessions de voile (wingfoil, planche, kite, bateau) et de surf à partir de traces GPX, et enregistrement GPS sur le téléphone. Application 100 % client… » ; `:7` → « Deux familles d'activités, chacune avec sa bibliothèque et sa page d'analyse (carte, graphes, meilleurs segments, notes) : **Voile** (wingfoil, planche, kite, bateau) et **Surf** (surf, surf foil). Autour : **Enregistrer**, **Planifier** (parcours de balises, export GPX), **Statistiques** (onglets général, graphique, régularité, records, cardio), **Profil** (avec le test de FC repos) et **Réglages**. » ; `:11` « `Tracker/` … `Documents/Tracker` » → « `Gtracker/` … `Documents/Gtracker` »
- Services en ligne (proposition D2 Q7) : retirer maintenant `:13` (types de voie, BRouter), `:24` (BRouter), `:26` (Overpass), réduire `:25` (IGN : « altitude du terrain d'un GPX importé en planification, sans activité choisie » ; part avec le lot 304) ; garder `:21-23` (OSM, Esri, Photon) et `:28` ; ajouter que l'application s'annonce par un `User-Agent` (`capacitor.config.ts:22`) : après le lot 323
- `:45`, `:50` (`docs/MODELES.md` : document d'outillage, à ne pas livrer ; question). Manquent une ligne d'installation de l'APK (renvoi vers `INSTALLATION.md`) et le crédit GONG (lot 308)

#### `docs/DEVELOPPER.md` et `docs/INSTALLATION.md`
- `DEVELOPPER.md` · `:1` « # Construire Gtracker » ; `:34` « Tracker-<version>.apk » → « Gtracker-<version>.apk » (`android/app/build.gradle:63-65`) ; `:27` `keytool … -keystore tracker-release.jks -alias tracker` et `:41` l'identifiant `io.github.segneur.tracker.voile` : **[après le lot 323]** (clé neuve, alias `gtracker`, nouvel identifiant) ; `:18` à vérifier contre `.github/workflows/verif.yml` ; exacts : Node 22.18, JDK 21, Gradle 8.14.3, SDK 36, `public/_redirects`, `versionCode`
- `INSTALLATION.md` (16 occurrences du nom ; texte lu par les testeurs) · [maintenant] `:1`, `:15`, `:19`, `:25`, `:44`, `:68`, `:72`, `:81`, `:82` « Tracker » → « Gtracker » ; `:3` → « Gtracker enregistre vos sessions de voile et de surf avec le GPS du téléphone, puis les analyse. » ; `:22` « un dossier **Tracker** » → « **Gtracker** » (`MEMORY_FOLDER_NAME`, contredit `:66-68`) ; `:34` couper « Le compteur d'intervalles de l'Entraînement s'en sert aussi : … » (service supprimé au 302) ; `:40, 42, 46, 48` « Applications, puis Tracker » → « Gtracker » ; `:52-54` « faites un essai de dix minutes en marchant, écran éteint, téléphone en poche » et « choisissez l'activité (Wingfoil ou Surf conviennent pour l'essai) » (il n'y a plus d'activité à pied) ; `:56` exact

### Temps 2 : après les lots de code
Rien de ceci ne s'écrit avant le lot qui le rend vrai (règle 2). Environ **40 lignes d'ETAT et d'INVENTAIRE** dépendent du seul renommage du lot 322.

| Lot | Lignes à écrire ensuite |
|---|---|
| 304 | `DECISIONS.md` §7 refonte, `:117` sans « surface », `:139` ; `MISE_EN_PAGE.md:50, :64` ; `CLAUDE.md:101` → « `planning/`, `PlanningPage`, `RoutesPage`, `usePlannedRoute`, balises \| 7. Planification et itinéraires » ; `CLAUDE.md:120` (« tracé de planification ») ; `README.md:25` ; `ETAT:310-312, :318, :369, :266, :432-437` ; `INVENTAIRE:138, :144, :151, :152, :266, :281, :298, :303` |
| 306 | `CLAUDE.md:117` (`PRESET_RESETS`) ; `DECISIONS.md:55` (phrase de compatibilité), `:135`, `:142` ; `ETAT:201-207, :255-262` (clés d'onglets d'avant), `:283-287` ; `INVENTAIRE:116, :8` (fin de phrase des redirections) ; suppression des garde-fous « 0.4.61 » citées dans `ETAT`/`INVENTAIRE` |
| 321 | une puce de `DECISIONS.md §8` ou de `CLAUDE.md` (règle 13) disant **quels formats la porte accepte** (GPX simple ; paquet de session `library/sessionBundle.ts` ; fiche et capteurs posés à côté) : sans elle, l'exécutant du nettoyage de `record.ts` ne sait pas ce qui se garde ; `ETAT:246`, `INVENTAIRE:171` |
| 322 | `ETAT:52, :181, :217, :224, :227, :231-234, :246, :252-279 (tableau des clés), :294, :385` ; `INVENTAIRE:128, :145-146, :175-176, :179, :206, :212, :235-252, :268, :313` ; la règle « Pas de nom « Tracker » dans un libellé, un commentaire, un nom de fichier ou un identifiant » (D1 R11) : **seulement après** les lots 322 et 324, sinon elle est fausse (`MEMORY_FOLDER_NAME`, `tracker.json`, `tracker-memoire`, `lancer-tracker.bat`, `icone-tracker.ico`) |
| 323 | `ETAT:407, :477, :479`, `DEVELOPPER.md:27, :41`, `INVENTAIRE:182-184`, `README.md` (User-Agent), `BACKLOG:15` |
| 324 | `ETAT:30, :416, :425-427, :471-472, :479` ; `INVENTAIRE:371` ; chemins `D:\gong tracker\atelier\…` |
| 326 | `CLAUDE.md:78` (texte O1), `ETAT:42, :75` |
| 327 | `CLAUDE.md:69` règle 9 si elle cite la garde, **règle 13** (texte ci-dessous), `ETAT:44, :75`, `INVENTAIRE:346` (la couture `LAND_FILES`/`SEAM` est retirée de `architecture.test.ts`) |

**Règle 13 (O1 prime sur D1)**. Aujourd'hui : « 13. Le code commun n'importe rien de la terre (course, vélo, Entraînement), retirée aux lots 302 et 303 ; `src/architecture.test.ts` garde `LAND_FILES` et `SEAM` vides, et aucun dossier `running`, `cycling` ou `land` ne revient. » Le texte de D1 est juste sur le fond mais ne dit ni « deux familles » ni ce qui la garde. Texte d'O1, en deux temps : première phrase avec le lot 327 (F3a), **après** les lots 321 et 306 (elle affirme qu'aucune donnée d'une autre application n'est relue) : « 13. Deux familles seulement, voile et surf (`SPORT_FAMILIES`) : ni course à pied, ni vélo, ni Entraînement, ni allure en min/km ; aucune donnée d'une autre application n'est relue, sauf par la porte d'import (GPX, FIT, paquet de session `library/sessionBundle.ts`). » ; seconde phrase avec F3b, après les lots 322 et 324 : « Aucun nom de l'ancien projet dans les sources ; `src/architecture.test.ts` le garde, avec sa liste nommée d'exceptions de la porte d'import, qui ne fait que diminuer. » **Ne pas** laisser la règle dire « garde `LAND_FILES` et `SEAM` vides » quand le test est simplifié. Aujourd'hui, dans l'attente : ne pas toucher la règle (elle est vraie).

### HISTORIQUE (`docs/HISTORIQUE.md`, 322 points, 1 553 lignes, 345 160 octets)
**Points 323 à 326 déjà rédigés** (à ne pas confondre avec les lots 323 à 326 : ce sont des numéros de **points** de l'historique, la suite du point 322) : `D:\gong tracker\atelier\revue-1111\D2-etat-inventaire-readme.md`, section « Points d'HISTORIQUE à écrire (301 à 305) » : 323 = lot 301 (fiche et résumé détachés), 324 = lot 302 (Entraînement retiré), 325 = lot 303 (course et vélo retirés), 326 = lot 305 (types et réglages réduits) ; un point 327 pourrait réunir les lots 310 et 312 (logo, banc sur « Gtracker »). Le 304 aura son propre point plus tard. **Règle (`CLAUDE.md`) : un point ne s'écrit qu'après la validation du lot par l'utilisateur** (« une passe après chaque lot que l'utilisateur a validé »). Le texte de D2 est à relire à ce moment : celui du point 326 dit « ces relectures sont proposées au retrait (lot 306, décision 2 du 11/11) », qui sera vrai ou faux selon l'ordre réel des lots ; il garde en revanche les pièges utiles (`SUMMARY_CALC_VERSION` 18, gardes du 187). Dès que les quatre sont écrits, `ETAT:3` devient « dernière passe d'ensemble le 11 novembre 2026 (§10, points 323 à 326) ».

**Sort d'`HISTORIQUE.md` : trois options chiffrées** (mesures de D2, script `hist.mjs`, à ± 5 points)
- Terre ou Entraînement seulement : 48 points ≈ 55 Ko (16 %), à relire avant de couper 98, 99, 115, 145, 224, 253, 257, 287, 305, 315 (paquet de session, ceinture, FC perdue, pause, FC repos : choses gardées) ; 70 points mêlent terre et voile ou surf ; ≈ 204 sont neutres. Le nom « Tracker » seul : 14 points (36, 40, 88, 89, 99, 105, 117, 173, 195, 300, 306, 308, 309, 312). Chemins du poste ou dépôt : points 36 (`segneur34/Tracker`), 38, 172 (`~/.claude/plans/FILE-DES-LOTS.md`), 173 (`C:\Users\segne\tracker`), 190, 309 (`https://github.com/segneur34`). Outils d'IA : 12 points (2, 6, 47, 93, 135, 149, 157, 159, 169, 171, 172, 173). Renvois depuis `src/` : 103 « point N » dans 49 fichiers (39 numéros) ; dont 3 visent un point purement terre : 80, 81, 89.
- **(a) Garder tel quel + points 323 et suivants.** Coût minime (une demi-heure). La décision 3 n'est pas tenue (14 points avec le nom, 6 avec chemin ou dépôt) ; 48 points sur une application qui n'existe plus ; numéros stables.
- **(b) Élaguer et nettoyer.** Retirer ≈ 40 points terre purs (≈ 45 à 55 Ko), réécrire les ≈ 20 qui portent nom, dépôt ou chemin, laisser les numéros absents. Coût moyen (2 à 3 h d'agent Sonnet, par lots de 40 points avec relecture) ; touche 3 commentaires de `src/` (80, 81, 89) et ≈ 50 renvois d'ETAT et d'INVENTAIRE ; risque de couper un piège utile (98, 224, 253, 305, 315). Résultat : 290 Ko, encore 70 points mêlés.
- **(c) Historique neuf de Gtracker.** Ne garde que les décisions et pièges encore vrais (≈ 150 à 180 points, 120 à 150 Ko), réécrits sans « Tracker », chemin ni outil d'IA ; l'ancien fichier part en archive hors dépôt (`git show 2eed9e7:docs/HISTORIQUE.md` le conserve de toute façon). Coût élevé (4 à 6 h d'agents) ; **numéros d'origine conservés pour les points gardés** (numérotation clairsemée), sinon 103 renvois de `src/` et ≈ 300 des documents sont à réécrire.
- **Avis (D2) : (c) à numéros conservés, en deux temps.** Premier temps, court : (b) limité aux 14 points qui portent « Tracker », aux 6 qui portent un chemin ou un dépôt et aux 3 numéros cités par `src/`. Deuxième temps : le fichier neuf, sous le titre « Historique des décisions de Gtracker ». Raison : la décision 3 exige « plus aucun lien » et un journal est de la prose sur l'ancien projet (dates, versions 0.x.yy, APK, essais) que (b) ne nettoie pas mécaniquement et que (a) enfreint. Si l'acheteur n'a pas à recevoir le journal, la meilleure option est de ne pas le livrer (archive hors dépôt, (c) pour les seuls points utiles aux repreneurs) : **la question 1 ci-dessous le tranche**. Ce lot ne fait que le premier temps si l'utilisateur répond « à livrer » ; sinon HISTORIQUE sort de la livraison (lot 308) et ce lot n'y touche pas. Contrôle à ajouter pour (c) : un script qui vérifie que tout « point N » cité dans `src/`, `ETAT`, `INVENTAIRE`, `DECISIONS`, `MISE_EN_PAGE` existe dans le fichier neuf (dans `docs-cites.mjs`).

### Pièges
- **Collision de numéros** : les « points » 323 à 326 de l'historique et les lots 323 à 326 de cette revue n'ont rien à voir.
- Les outils sont **verts à tort** : `docs-cites` (fichiers et noms cités) et `docs-inventaire` (carte) ne voient pas les phrases fausses ; leurs listes sont à corriger (`DOSSIERS` de `outils/docs-inventaire.mjs:63`, `HORS_DEPOT` de `docs-cites.mjs:33-34`, lot 330) et à étendre (refuser dans `README.md` et `docs/*.md` hors HISTORIQUE les motifs `\bTracker\b`, `C:\\Users`, `~/.claude`, `segneur34`, `claude.ai/`, `atelier` : garde G3, lot 327).
- **Ne pas** déplacer ni supprimer les phrases que le code cite : `DECISIONS §2` (« Rien en voile », « le violet suit le zoom »), `§5`, `§8`, `§6`.
- **`MISE_EN_PAGE.md` n'est pas fautive sur `:18-35, :38-46, :66-81`** (exactes) ; ne pas les retoucher.
- Le mot « Tracker » encore légitime avant les lots 322 et 324 : le nom du dossier d'origine dans les passages qui décrivent la porte d'import ; écrire « l'autre application » (D4 q.3), jamais le nom, en attendant.
- `ETAT:350` (`formatLandSpeed`) : le nom est hérité (C), la puce décrivait une limite sans objet ; la supprimer sans toucher au code.
- Ne pas modifier `docs/backlog/*` ni `docs/BACKLOG.md` ici (voir « Corrections proposées au reste à faire »).

### Vérification
- `node outils/docs-cites.mjs` et `node outils/docs-inventaire.mjs` verts après chaque fichier (`npm run verif` n'est pas utile pour la seule documentation, règle de `CLAUDE.md`).
- Recherche de contrôle de D2 : `grep -nE "Tracker|segne|C:\\\\Users|~/.claude|claude\.ai|atelier|Tom|Briere|à pied|vélo|Entraînement|fractionn|cadence|\bcourse\b" README.md docs/ETAT_DU_PROJET.md docs/INVENTAIRE.md docs/DEVELOPPER.md docs/INSTALLATION.md` ne rend plus que des faux amis (hors passages [après le lot N]).
- Même recherche sur `CLAUDE.md`, `docs/DECISIONS.md`, `docs/MISE_EN_PAGE.md` : `grep -nE "Tracker|à pied|À pied|vélo|Vélo|fractionn|Fractionn|Entraînement|muscu|cadence|course|trail|Gravel|VTT" CLAUDE.md docs/DECISIONS.md docs/MISE_EN_PAGE.md`.
- À lire dans le code avant d'écrire : `src/main.tsx` (liste des `start…`, `ETAT:50`), `grep -n "sessionReading" src` (`ETAT:85`), `src/core/sportProfiles.ts` (`getActiveThresholds`, `GradeProfile`, `ETAT:104, :298`), `src/core/backdropPattern.ts` (`INVENTAIRE:58`), `src/components/HeartRatePanel.tsx` (`INVENTAIRE:292`), `android/app/src/main/res/values/strings.xml` et le manifeste (libellés « Ouvrir avec… »), `.github/workflows/verif.yml` (`DEVELOPPER:18`), `src/tutorials/tutorials.test.ts` (nombre de leçons).
- Aucun essai au téléphone.

### Questions liées
- **HISTORIQUE : le journal doit-il être remis à l'acheteur ?** (345 Ko, dont 16 % de terre pure) · Par défaut : non livré (archive hors dépôt), sinon option (c) à numéros conservés · Change : le travail d'un lot de 4 à 6 h d'agent, et la livraison (lot 308).
- **Les documents de pilotage (`docs/BACKLOG.md`, `docs/backlog/`, `docs/MODELES.md`, `.claude/`, `CLAUDE.md`, `DECISIONS.md`) sont-ils livrés ?** Ils citent le vendeur, Fable, Opus et Sonnet, `D:\gong tracker\atelier`. · Par défaut (D1 Q8) : `MISE_EN_PAGE.md` livré (pas d'histoire propre), `DECISIONS.md` non livré, `CLAUDE.md` réécrit en `ARCHITECTURE` et `CONTRIBUER` au 308 · Change : si livrés, ils passent tous la décision 3.
- **Numérotation de `DECISIONS.md`** : garder les numéros 1 à 11 · Par défaut : garder (recommandation, D1 Q1) · Change : sinon ≈ 70 renvois à refaire.
- **« Tracker complet en lecture seule » dans `CLAUDE.md` (`:51`)** : retirer la règle maintenant, en gardant les refus d'écriture de `.claude/settings.json` jusqu'au lot 324 · Par défaut : oui (D1 Q2).
- **D+ au Profil et dans les Statistiques** (tuile `ProfilePage.tsx:232-241`, `library/stats.ts:240-271`) · Par défaut : retirer (comme la question B du lot 304) · Change : `DECISIONS §9:150`, `§10:161`, `ETAT`, et un refigeage de `summaryFrozen` avec `SUMMARY_CALC_VERSION` qui augmente (O1).
- **Fusion `SportFamily` / `Treatment`** (D1 Q7) · Par défaut : fusionner (O1 a tranché) · Change : `CLAUDE.md:78`, `ETAT:42`.
- **Texte de la porte d'import** (`DECISIONS §8:135`) : garder « ce que le fichier ne porte pas reste nul… » réécrite sans « version ancienne » · Par défaut : oui (D1 Q4).
- **`INSTALLATION.md`, essai de l'étape 4** : en marchant, avec l'activité Wingfoil ou Surf, est-ce acceptable pour des testeurs voile et surf ? · Par défaut : oui (D2 Q8).
- Les questions de D2 sur le préfixe des clés (Q3), le marqueur du dossier (Q4), l'alias de signature (Q6) sont **tranchées par les lots 321 à 323** ; le dépôt distant (Q5) est déjà propre (`origin` : `segneur34/Gtracker.git`, D4 c1).

---

## Lot 318 (compléments) · Atelier : ce que la fiche 318 a manqué

La fiche `docs/backlog/318-atelier-fable-52.md` existe et reste le brief du lot ; **elle n'est pas recopiée ici**. Cette section donne ce que la revue du 11/11 y ajoute ou y change (source : `D4-atelier-coupure.md` §1, vérifié sur le disque ; annexe : `D:\gong tracker\atelier\revue-1111\D4-atelier-coupure.md`). Les dix `fichier:ligne` de la fiche pris au hasard par D4 sont **justes** (`clore/SKILL.md:13` et `:67`, `chaine/SKILL.md:35` et `:68`, `banc.md:15`, `lot.md:24`, `relecture.md:16`, `doc.md:14`, `Plan.md:13`, `MODELES.md:67` et `:69`, `CLAUDE.md:5, :50, :51, :122-125`, `src/App.tsx:114-119`, `core/trackColor.ts:19`, `core/activities.ts:92-96`, `AppShell.tsx:186-188`) ; leurs numéros n'ont pas bougé depuis le 10/11.

**But** : l'atelier (`.claude/`, `docs/MODELES.md`, règles du `BACKLOG.md`) ne dit plus rien de faux et ne nomme plus l'ancien projet, ni un chemin du poste, ni le numéro de série d'un téléphone. On le verra à ceci : la recherche de contrôle de la section « Vérification » rend zéro dans `.claude/` et `docs/MODELES.md`.
**Taille** petit · **Modèle** Sonnet / medium (comme la fiche) · **Risque** faible (aucun code) · **Avant** : réponses à Q102, Q103, Q104 (voir plus bas pour Q102) ; **les corrections de `CLAUDE.md` et de `docs/DECISIONS.md` sont reprises par le lot 331**, la fiche 318 n'en garde plus que le renvoi · **Après** : 308 (l'atelier est retiré à la livraison) · **Avant la première APK** : non.

### À faire (en plus de la fiche 318)

#### Ce que la fiche a manqué
- `.claude/skills/clore/SKILL.md:61` · chemin de l'adb sous `C:/Users/segne/AppData/Local/Android/Sdk/…` **et** numéro de série du téléphone écrits dans un fichier versionné → variable d'environnement (`%ANDROID_HOME%`) ; le numéro de série va dans la mémoire de Claude, pas dans le dépôt
- `.claude/skills/clore/SKILL.md:62` · `dumpsys package io.github.segneur.tracker.voile` (identifiant d'application) → suivre le lot 323 ; `:84` · `cmd //c "cd /d \"D:\gong tracker\Gtracker\" …"` → sans chemin
- Le chemin `D:\gong tracker\Gtracker` en dur dans **les dix** fichiers : `agents/banc.md:11`, `doc.md:10`, `Explore.md:12`, `lot.md:20`, `Plan.md:11`, `relecture.md:11` ; `skills/chaine:10`, `clore:10`, `reprise:10`, `todo:10` → « le dépôt » sans chemin (la fiche ne remplace que « Tracker » par « Gtracker »)
- `.claude/agents/lot.md:20` et `:26` · `D:\gong tracker\atelier\revue-2710\RAPPORT.md` et `lotN-brief.md` = archive d'une revue **faite sur l'autre application** (402 Ko, 20 fichiers) : la fiche dit « garder une phrase au plus » ; avec la décision 3 la phrase **disparaît** (les briefs sont dans `docs/backlog/`)
- `skills/clore/SKILL.md:56` et `skills/reprise/SKILL.md:16` · la fiche corrige le nom `point-de-reprise-cible-mobile.md` mais pas le fait que cette mémoire est un **héritage** de l'autre application (elle est aussi citée par `[[point-de-reprise-cible-mobile]]` dans la mémoire `banc-de-test-chrome.md:13`, lien mort) : réécrire la mémoire elle-même est du lot 324
- `.claude/settings.json:11-17` · sept règles `deny` (`//c/Users/segne/tracker/**`, `~/.claude/plans/**`, `~/.claude/projects/c--Users-segne-tracker/**`) : liens purs ; la fiche ne propose **aucune** retouche et sa partie E s'appuie même dessus → **lot 324** (voir ce lot) ; le texte de la fiche doit cesser de s'y appuyer
- `.claude/hooks/garde-lot.mjs` : propre, rien à faire
- `docs/MODELES.md` · la fiche ne dit pas : `:48` et `:65-69` décrivent `~/.claude/settings.json` (réglages de l'utilisateur) ; `:63` renvoie au « point 157 d'HISTORIQUE » (document appelé à être nettoyé) ; `:73` mentionne un hook « à éprouver dans une session neuve » (périmé) ; `:61` « rien n'est envoyé sur GitHub sans son accord » à aligner avec la réponse à Q103 ; **ajouter en tête une ligne** : « tout l'atelier (`.claude/`, ce fichier) part à la livraison » (ou laisser le lot 308 l'effacer) ; pas un seul « Tracker » dans ce fichier (bien)
- `docs/MODELES.md` · aucune ligne pour l'import d'une session venue de l'autre application : à ajouter si la porte d'import est confiée à un lot (lot 321 : Opus / high, format de fichiers, trois chemins de lecture, Java et TS ; le lecteur de GPX seul serait Sonnet / medium)
- `src/components/highlightColors.ts:5, 22, 31` (commentaires « zone de pente, répétition, cadence, revêtement ») : le fichier de la fiche (partie C) est juste sur le code mais pas sur les commentaires : code, **lot 325** (et lot 304 pour la prop de `HighlightPath`)

#### Ce que les décisions 2 et 3 changent à la fiche
- **Partie E, « Fichier de plan »** (`:85`) · la raison d'être (`.claude/settings.json` refuse `~/.claude/plans`, « dossier de Tracker complet ») **tombe** si les `deny` sont retirés (lot 324) : le mode plan écrit de nouveau dans `~/.claude/plans` sans blocage. Mais ce dossier est aussi celui de l'autre application. Garder l'idée du réglage de projet qui range les plans dans le dépôt (`.claude/plans/`, ignoré par git), **en la justifiant autrement** : ne plus partager `~/.claude/plans` avec l'autre application. À vérifier dans la documentation des réglages (nom supposé `plansDirectory`) avant de l'écrire, comme la fiche le dit déjà
- **`:21`** (« réglages globaux … communs à Tracker complet : on ne les change que sur demande ») → « réglages de l'utilisateur, hors dépôt ; on ne les change que sur demande »
- **Partie B, première ligne** (« Tracker → Gtracker, 16 fois ») reste juste ; **ajouter à la même passe** : `D:\gong tracker\Gtracker` (nom de dossier), `clore:61-62, 84`, `lot.md:20, 26`, `settings.json:11-17` (ce dernier : lot 324)
- **Partie C** · `:50` ne doit **pas** devenir `segneur34/Gtracker` (l'adresse du vendeur est une identité, fiche 153) : « un dépôt GitHub privé » sans nom ; `:51` (« Tracker complet en lecture seule ») : **supprimer la ligne entière**, pas la reformuler ; `:85` et `:111` (poids du vélo, charge portée) : la décision 2 dit **retirer** au lieu de « reliques sans lecteur » : le texte suit le retrait du code (lot 306), il ne le précède pas. **Toute la partie C passe au lot 331** (`CLAUDE.md`) ; la fiche 318 la renvoie
- **Partie D**, « Règles du BACKLOG » · ajouter la suppression de `BACKLOG.md:3` (« numéros à part de ceux de Tracker complet ») et de `:11` (« une correction commune se refait à la main des deux côtés ») : textes dans « Corrections proposées au reste à faire » plus bas
- **Partie A, « Mémoires de Gtracker »** (étape 5 de l'ordre d'exécution) · la mémoire du dossier **parent** (`~/.claude/projects/d--gong-tracker/memory`, 3 fichiers) porte la même règle « origine intouchable » ; la fiche l'oublie → lot 324
- **Q102** · le défaut proposé change : **tout, y compris `DECISIONS.md`** (la décision 3 impose de retirer les mots « Tracker » et « course et vélo » ; ne plus attendre la validation des lots 302 et 303). `DECISIONS.md` est traité par le lot 331. **Q103 et Q104** : inchangées
- **Ordre d'exécution** · le lot 318 peut passer avant le 306 pour tout ce qui est de la documentation d'atelier ; **non** pour les lignes de `CLAUDE.md` qui disent « reliques sans lecteur » (`:85`, `:111`) : voir 331
- **Vérification de la fiche** (Grep final « plus de Fable 5.1, `cible-mobile`, `4191`, `segneur34/Tracker`, « dépôt Tracker » ») → à remplacer par : `rg -n -i -P "(?<![gG])tracker|C:[\\\\/]+Users[\\\\/]+segne|\.claude[\\\\/]plans|segneur34/Tracker|application complète|appli complète|application d'origine|version complète|dans les deux BACKLOG|\bcorrection commune\b" .claude docs/MODELES.md` → zéro résultat (les chemins hors dépôt et les mémoires sont vérifiés par le lot 324)

### Pièges
- Ne pas corriger `CLAUDE.md` ici et au lot 331 : un constat, un lot.
- `.claude/` part à la livraison (lot 308) : ne pas investir plus que les corrections de faux.

### Vérification
- `npm run verif` (les renvois des documents y sont contrôlés), `node outils/backlog.mjs` après toute édition du BACKLOG, la recherche ci-dessus, et une session neuve ouverte dans `D:\gong tracker\Gtracker` : `/reprise` trouve sa mémoire et rend son compte rendu sans écart signalé. Rien à essayer au téléphone.

### Questions liées
- Q102 : voir ci-dessus (défaut changé). · Q103 (`/clore` sans précision envoie-t-il sur GitHub ?) · par défaut : plus d'envoi sans « /clore avec envoi » · Q104 (effort de `/chaine`) · par défaut : medium, high s'il reste une question ou un lot du noyau.

---

## Corrections proposées au reste à faire (`docs/BACKLOG.md` et fiches de `docs/backlog/`)

Sources : `D4-atelier-coupure.md` §2 et §3, `O3-relecture-305.md` (écarts brief / code), `O2-coupure-donnees.md` §5. Format : ligne actuelle (abrégée) → ligne proposée. **Faites le 11/11 par l'orchestrateur, et elles seules** : les lignes des lots 319 à 331, « Prochains numéros », la cause du 314, l'état du 305 (relecture faite) et la question Q105. **Tout le reste de cette section est une proposition**, à appliquer après les réponses de l'utilisateur, puis `node outils/backlog.mjs`.

### Dans `docs/BACKLOG.md`

- `:3` · « Prochains numéros : élément 319, essai 213, question Q105 (numéros à part de ceux de Tracker complet : une correction commune se note dans les deux). » → « Prochains numéros : élément (suite des lots de la fiche 319), essai 213, question Q105. » (la parenthèse part ; le numéro d'élément dépend des lignes que l'orchestrateur crée pour 319 à 331)
- `:11` · « **Ce dépôt est la version voile et surf destinée à la vente** (copie de Tracker 1.0.0, `C:\Users\segne\tracker`, commit d'origine au §12 d'ETAT) : … une correction commune aux deux versions se refait à la main des deux côtés et se note dans les deux BACKLOG ; dépôt GitHub privé `segneur34/Gtracker`. » → « - **Ce dépôt est la version voile et surf destinée à la vente.** La terre (course, vélo, Entraînement) et le planificateur routier en partent (fiche 154, E2 à E8) ; aucune donnée d'une autre application n'est relue, sauf le chargement d'une session de voile ou de surf venue d'un fichier GPX (lots 321 et 306) ; dépôt GitHub privé. » (supprime « copie de Tracker 1.0.0 », le chemin du poste, « se refait à la main des deux côtés », le nom du dépôt)
- `:15` (APK) · « APK 0.00.05 construite le 08/11 au soir (…, identifiant `io.github.segneur.tracker.voile`, installable à côté de Tracker ; copie dans `D:gong tracker`), **à installer par l'utilisateur** … pour les essais 201 à 212 … la 0.00.01 n'a pas été installée. » → « APK 0.00.05 construite le 08/11 au soir (`Gtracker-0.00.05.apk`, versionCode 6, tag `v0.00.05`) : **ne pas l'installer** (ancien identifiant, anciens noms de clés et de formats, clé de signature partagée avec l'autre application) ; une 0.00.06 sera construite après les lots 321, 306, 322 et 323, puis installée pour les essais 201 à 212 ; la 0.00.01 n'a pas été installée. La série repart de 0.00.00 à sa demande (08/11). » **Sous réserve** de la réponse de l'utilisateur à la question 7 d'`O2-coupure-donnees.md` (attendre la fin des lots 321 à 323 avant d'installer ; défaut : oui). Si l'identifiant change, la 0.00.05 est périmée et l'essai 211 ne vaut plus (il n'existe aucune 0.00.04 installée)
- `:17` (310) · « … logo de l'accueil (aujourd'hui « Tracker » en Shrikhand) … puis APK 0.00.01 installée à côté de Tracker ; résultat attendu : deux applications reconnaissables d'un coup d'œil sur le téléphone » → retirer la parenthèse (faux depuis le commit : l'accueil porte GONG et « Gtracker ») et réécrire le résultat : « l'icône de Gtracker est reconnaissable d'un coup d'œil sur le téléphone »
- `:18` (essai 201) · « icône Gtracker sur le lanceur, à côté de celle de Tracker → … » → « icône Gtracker sur le lanceur (à côté de l'autre application si elle est sur le téléphone) → symbole GONG noir sur fond blanc, centré, masque du téléphone respecté, reconnaissable d'un coup d'œil » (D4 q. 3 ; mêmes retouches dans `docs/backlog/310-logo-gong.md:39`)
- `:21` (312) · « … l'import de GPX échoue sur ce poste depuis la copie … cause à trouver (…) … à valider sur lecture (commit du 08/11 ; cause : les scripts lisaient l'OPFS sous « Tracker », dossier renommé « Gtracker » au fork ; 30 scripts corrigés, rien dans src/) » → « 312 · [outil] Banc : l'import de GPX échouait (« import … : absent », 21 à 29 échecs) parce que les scripts lisaient le dossier mémoire sous l'ancien nom ; résultat attendu : `node outils/banc/passe.mjs general surf partage` sans échec · noté 08/11 · petit · Sonnet/high · **à valider sur lecture** (commit `d5db0af` ; **verdict de la revue du 11/11 : correction juste**, `ImportButtons.tsx:39` garde `accept=".gpx,.fit"` que le sélecteur `[accept*=".gpx"]` trouve encore ; reste à relancer `general surf partage balises` puis `profil cardio sauts` ; les 24 scripts qui écrivent `'Gtracker'` à la main passent par `DOSSIER_MEMOIRE` au lot 330, et la garde G6 du lot 327 aurait attrapé la panne à la source) ; la ligne disparaît à la passe doc après validation »
- `:22` (301) · « … lecteurs terre (`bikeWeightKg`, `loadKg`, `surfaces`, `terrainElevation`, `intervals`, `test`) **retirés de `record.ts`**, bruts gardés par `...rest` et `GUARDED_FIELDS` … poids du vélo et charge portée restent dans la fiche jusqu'au 303 » → **inexacte** (O3, `BACKLOG.md:22`) : ils sont toujours dans `library/record.ts` (types `:323` et `:329`, lecteurs `:597-598`, validateurs privés `:605-613` déplacés là par le 305 « retrait au 306 »), et le 303 ne les a pas retirés ; `effortThresholdMs` (`record.ts:593`) est dans le même cas sans que le 306 le cite. Texte proposé : « … lecteurs terre retirés du résumé et de l'interface ; `record.ts` garde leur lecture brute (`bikeWeightKg`, `loadKg`, `effortThresholdMs`, `surfaces`, `terrainElevation`, `intervals`, `test`) par `...rest` et `GUARDED_FIELDS`, à retirer aux lots 306 et 304 … » et retirer la phrase « poids du vélo et charge portée restent dans la fiche jusqu'au 303 ». **À ajouter à la liste du 306** : `effortThresholdMs`
- `:30` (essai 209) · « une session voile et une session surf déjà enregistrées s'ouvrent comme avant → chiffres du général identiques à la 0.00.01 » → **impossible tel qu'écrit** (O3 : la 0.00.01 n'a jamais été installée, aucune session Gtracker n'existe sur le téléphone). Texte proposé : « essai 209 : « Ajouter les sessions » avec un GPX de voile et un GPX de surf → chacun s'ouvre en analyse (général, carte), mêmes chiffres que dans le navigateur au banc (`general`, `surf`) »
- `:31` (essai 210) · garder (« enregistrement wing avec capture des sauts → les sauts apparaissent dans l'analyse » : le greffon natif de mouvement a changé au 303) ; à rejouer sur la 0.00.06 (le paquet Java est renommé au lot 323)
- `:32` (305) · « à valider (commit du 08/11, version 0.00.05 ; exécuté sur Opus ; verif verte, gardes du 187 intactes, banc general et surf identiques ; relecture Sonnet non faite, quota épuisé : à lancer mardi sur le diff du commit avant validation) » → « à valider (… ; **relecture faite le 11/11** par un architecte Opus sur le diff `0036bb3..c40f910` : **verdict, le lot peut être validé tel quel côté voile et surf** ; aucun défaut moyen ou élevé, 730 tests verts (37 fichiers), tests modifiés justifiés, gardes du 187 et `settings0461.fixture.ts` intacts ; quatre défauts faibles reportés : fiche de la terre périmée réécrite sans calcul (`summaryOptions.ts:112-114`, lots 321 et 306), journal de muscu supprimé sans message (`useRecorder.ts:844-862`, lot 306), altitude du direct calculée pour rien (`liveStats.ts:81-84, 101-103, 305-322, 346-348`, lot 325), option `elevation` portée pour rien (`summarizeGpx.ts:20, 44-49`, lot 304) ; **banc : seuls `general` et `surf` ont été passés** (le brief demandait aussi `balises`, `partage`, `profil`, `cardio`, `sauts`) : à passer avant la validation, `node outils/banc/passe.mjs balises partage profil cardio sauts --avant 0036bb3 -j 1 --sans-cache`) »
- `:33` (essai 211) · « mise à jour depuis la 0.00.04 → réglages de voile et de surf retrouvés … » → **périmé** (aucune 0.00.04 n'a existé ni été installée ; aucune donnée Gtracker à migrer). Texte proposé : « essai 211 : premier lancement de l'APK → Réglages ne montre que Voile et Surf, aucune activité étrangère »
- `:34` (essai 212) · « ouvrir le dossier mémoire de Tracker complet → la bibliothèque ne plante pas, les sessions de course et vélo sont « à classer » » → **retirer** (la décision 2 ne rouvre pas ce dossier ; O2 V1 : un dossier qui porte l'ancien marqueur est refusé comme mémoire). Texte proposé : « essai 212 : « Ajouter les sessions » avec un GPX de voile ou de surf exporté par l'autre application → la session apparaît dans la bibliothèque, analyse ouverte ; avec un GPX de course → refusé avec un message clair » (vaut après le lot 321). Note : le dernier risque du lot 305 (réglages migrés effacés une seconde fois) n'est vérifiable que par la garde `useSportSettings.guard.test.ts` (verte) ; elle disparaît avec le lot 306
- `:36` (zone « Ensuite ») · la limite de 7 lignes et de 3 lots avec essais au téléphone (`:5`) : les lots 319 à 331 sont à placer par l'orchestrateur ; le 313 (fin d'enregistrement) et le 329 (même fichiers `RecordingPage.tsx`, `useRecorder.ts`) sont liés
- `:42` (304) · voir « Lot 304 (compléments) », section D : « … retrait de `brouter`, `brouterProfile`, `overpass`, `wayMatch`, `surface`, `wayTypes`, `legCalculation`, `loopReturn`, `ignAltimetry`, `importedElevation`, `duration`, `segmentGrid`, `grade` (selon la question du D+), des composants de revêtement et de profil nommés dans la fiche 319, et des champs de fiche `surfaces`, `terrainElevation`, `elevationSource` ; … résultat attendu : parcours de balises et itinéraires importés seulement, plus aucun service de calcul d'itinéraire ni d'altitude (restent les fonds de carte OpenStreetMap et Esri et, selon la réponse, la recherche de lieux Photon) … détail : docs/backlog/154-vente-extraction-voile-surf.md et docs/backlog/319-revue-apres-fork.md ». La phrase « anciens itinéraires encore lisibles » est retirée jusqu'à la réponse à la question A du lot 304
- `:43` (306) · « E7, données d'une application complète : fiches au calcul retiré masquées au lieu de « À classer » ; clés terre plus écrites à `null` dans une fiche de voile ; … petit · Sonnet/medium · dépend de : 305 » → « 6. 306 · [dette] E7, couper les relectures d'anciennes données : retirer tous les lecteurs de compatibilité (fiches « à classer » d'un calcul retiré, champs terre bruts, vieux réglages et leurs migrations, effacements de pré-réglages, vieilles adresses et clés d'onglets) et leurs tests ; la seule porte (charger une session de voile ou de surf venue d'un fichier) est faite et gardée par les lots 320 et 321 ; résultat attendu : plus aucun code qui lit ce que l'autre application a écrit, hors la porte · noté 08/11 · gros · Opus/high · dépend de : 305, 321 · détail : docs/backlog/319-revue-apres-fork.md (lot 306) ». Passer de petit / Sonnet à gros / Opus : le périmètre a décuplé (≈ −700 lignes de code et −900 de test, O2). **Fiche à créer** ou renvoi à la fiche 319 (D4 proposait `docs/backlog/306-e7-couper-donnees.md`)
- `:49` (318) · garder `dépend de : Q102, Q103, Q104` ; le texte « « Tracker » → « Gtracker » » devient « plus aucun « Tracker » dans `.claude/`, `docs/MODELES.md` et les règles du BACKLOG ; `CLAUDE.md` et `DECISIONS.md` : lot 331 »
- `:52` (307) · « dépend de : 303 » : garder ; ajouter « et 306 » (la garde complète des mots « Tracker » vient après lui)
- `:55` (308) · voir « Lot 308 (recentré) » plus bas : « identifiant d'application et espace de noms des GPX (ancien lu, nouveau écrit, fiche 153) » → les noms techniques passent aux lots 321 à 323 ; ne restent que l'identité du vendeur et la livraison ; « dépend de : 306, 307 » → « dépend de : 321 à 324, 331, 307 »
- `:65` (Q102) · « par défaut : tout sauf DECISIONS, qui attend la validation des lots 302 et 303 » → « par défaut : tout, y compris `DECISIONS.md` (la décision 3 l'exige : « Tracker » et « course et vélo » ne peuvent plus y figurer) » ; Q101, Q103, Q104 : garder
- **Nouvelle question** (`:62-67` ; la limite est de 5, il y en a 4) : l'identifiant d'application (D4 q. 1) est une des questions de l'en-tête de la fiche 319 ; la place restante (Q105) y va, les autres restent dans le rapport à l'utilisateur

### Dans les fiches de `docs/backlog/`

| Fiche | Sort | Ce qui change |
|---|---|---|
| `151-vente-mentions-legales.md` | **corriger** | `:15` cite `IntervalTimerService` et `HeartRateService` (retirés au 302) ; `:23` règles de sauvegarde sur `tracker.deviceId`, `tracker.memoryFolder` → les nouvelles clés (lot 322) ; la liste « Ce qui part de l'appareil (pour la politique) » cite BRouter, IGN, Overpass : à corriger après le lot 304 (restent OpenStreetMap, Esri, Photon) ; le texte du bloc de confidentialité « l'altitude et le revêtement des parcours à pied et à vélo » est faux ; le reste (politique, À propos, Play) est le lot 308 |
| `152-vente-fonds-de-carte.md` | **corriger** | `:19`, `:32` donnent l'agent « Tracker/<version> (+https://github.com/segneur34) » (`capacitor.config.ts:22`, avec `capacitorConfig.test.ts:24-29`) → « Gtracker/<version> (+<contact>) » (lot 323 pour le nom, lot 308 pour le contact) ; Q5 (fournisseur de tuiles) reste ouverte |
| `153-vente-identite-images.md` | **corriger, c'est la plus touchée** | `:12-14` décrivent « ancien lu, nouveau écrit » → « ancien lu **seulement pour la porte d'import** » (`sessionBundle`) ; formats `tracker-*` (`:14`) renommés, sauf la lecture de `tracker-session` et de l'ancien espace de noms ; `:12` cite `IntervalTimerService.java` (retiré) ; « 15 fichiers Java » à recompter ; « Voulu » `:19-22` ; `:30` (réponse du 07/11, « une correction du code commun se refait à la main dans les deux dépôts ») → « Gtracker n'a plus de lien avec l'autre application » |
| `154-vente-extraction-voile-surf.md` | **corriger** | E5 (`:27`) : ajouter « le planificateur » aux restes selon le lot 304 de la fiche 319 ; **E7 (`:29`)** « Données de l'application complète : fiches au calcul retiré masquées au lieu de « À classer » » (décision 1) devient « retirer les lecteurs de compatibilité (fiches « à classer » d'un calcul retiré, champs terre bruts, vieux réglages et migrations, effacements de pré-réglages) et les gardes de la 0.4.61 ; garder la porte d'import » ; **E8 (`:30`)** « DECISIONS §2 et §5 retirées » → « réduites » ; « Les trois risques » (`:32-36`) : les risques 1 et 3 (migrations d'activités, lecteurs à type fermé) tombent avec le lot 306, les gardes (a) et (c) du lot 187 sont supprimées, la garde (b) `summaryFrozen` reste ; `:42-44` (réponse du 04/11) « les anciens itinéraires restent lisibles » et « la version de l'utilisateur garde le routeur complet » → retirer (renvoi à la question A du lot 304) ; `:48` « Dépôt neuf … correction commune refaite à la main des deux côtés » → « Gtracker n'a plus de lien avec l'autre application » ; `:83-89` règle d'architecture 13 (forme courte) → remplacée par le texte du lot 331 |
| `160-dette-audit-vente.md` | **corriger** | `:16` « Version vendue … clés terre écrites à null, fiches au calcul retiré dans « À classer » » → renvoi aux lots 321 et 306 ; `:22` « DECISIONS §1 et §4 en retard » valide ; le reste (pages d'une fonction, styles en ligne, accessibilité) : garder |
| `301-e2-fiche-resume-detaches.md` | garder | historique du lot (`:7` décrit les lecteurs « conservés bruts » : vrai, la suite est au lot 306) |
| `302-e3-retirer-entrainement.md` | garder | `:69` chemin Java `…/io/github/segneur/tracker/` : à renommer avec le lot 323 |
| `303-e4-retirer-course-velo.md` | garder | idem |
| `305-e6-reduire-unions-reglages.md` | garder, **ajouter une ligne en tête** | « ses transitions (`FULL_APP_FAMILY_IDS`, `PRESET_RESETS` « sans effet », fiche de course `sport: null`, `RECORD_READER_VERSION` 1 → 2, `:13`, `:66-68`, `:72-74`) sont reprises par le lot 306 réécrit », pour qu'un lecteur ne les restaure pas |
| `310-logo-gong.md` | **corriger** | `:39` « à côté de celle de Tracker » (essai 201) → voir `BACKLOG.md:18` ; `:3` « aucune APK installée avant » exact |
| `312-banc-import.md` | garder | texte « dossier d'origine », `%TEMP%\tracker-banc` : le renommage `gtracker-banc` est du lot 330 ; la fiche disparaît après la validation |
| `318-atelier-fable-52.md` | **corriger** | voir « Lot 318 (compléments) » |
| `319-revue-apres-fork.md` | à créer | le brief de cette revue (en cours de rédaction) |
| (aucune fiche à retirer avant la livraison : elles sont le brief des lots restants et partent à la livraison avec l'atelier, lot 308) | | |

Les fiches 151 à 154 portent chacune un paragraphe de réponses datées du 04/11 et du 07/11 qui supposent **deux dépôts vivants** (« la version de l'utilisateur garde le routeur complet », « Dépôt neuf … correction commune refaite à la main des deux côtés ») : à réécrire en une ligne (« Gtracker n'a plus de lien avec l'autre application »), voir 154 `:44, :48` et 153 `:30`.

---

## Lot 308 (recentré) · Livraison : ce qui lui reste

Sources : `D4-atelier-coupure.md` (§3.2 et §4, listes d'atelier) et `O2-coupure-donnees.md` §5 (recouvrement du BACKLOG). La ligne actuelle (`BACKLOG.md:55`) liste : identifiant d'application et espace de noms des GPX, crédits des images, politique de confidentialité, écran « À propos », brouillons des formulaires Play, manifeste, fonds de carte sous contrat, **docs réécrites**, **atelier retiré**, **banc rebranché**, puis dépôt réécrit en un seul commit. Une fois les lots 321 à 324 et 331 faits, **les noms techniques, les documents et le banc ne sont plus à lui**.

**But** : l'identité du vendeur et les pièces de la vente (légal, Play, fonds de carte, crédits) sont prêtes, les documents de pilotage sont retirés ou livrés selon la réponse, et le dépôt est réécrit en un seul commit sans trace de l'ancien projet. On le verra à ceci : les trois recherches de contrôle du lot 324 rendent zéro sur le dépôt livré et `git log --format='%an %ae' | sort -u` ne contient ni « tracker » ni l'adresse de l'utilisateur.
**Taille** gros · **Modèle** Opus / high (inchangé) · **Risque** moyen (la réécriture de l'historique est irréversible ; contrôles avant)
**Avant** : 321, 322, 323, 324, 331, 307, 306, 304 · **Après** : rien · **Avant la première APK** : non (les parties techniques, elles, le sont : lots 321 à 323).

### À faire (dix lignes)
1. **Identité du vendeur dans l'application** · « ex. Tom » dans `components/ProfilePrompt.tsx:91` et `pages/SettingsPage.tsx:938` ; nom de l'application et contact du vendeur dans les textes de vente ; adresse de contact de l'agent HTTP des tuiles (`capacitor.config.ts:22`, le nom `Gtracker/<version>` est posé au lot 323)
2. **Crédits des images** (relevé par l'utilisateur, fiche 153) : un fichier `CREDITS` ou `ASSETS.md` (source, compte, licence, date, droit de céder de chaque image : `src/assets/accueil/*.webp` (6), `src/assets/bandeaux/*.webp` (5), `assets/logo.png`, `assets/splash.png`, `res/drawable*/splash.png`, `components/activityArt.tsx`) ; remplacer ce qui n'est pas cessible ; ne pas déposer le logo comme marque sans en avoir établi l'origine
3. **Politique de confidentialité et écran « À propos »** (fiche 151) : texte juste après le lot 304 (restent OpenStreetMap, Esri et, selon la réponse, Photon ; BRouter, IGN et Overpass n'existent plus)
4. **Brouillons des trois formulaires Play** (« Sécurité des données », « Applications de santé », « Services au premier plan ») ; manifeste Android : retirer `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (ou le justifier par écrit ou le remplacer par l'ouverture de la liste système), `GeofenceBootReceiver` et `RECEIVE_BOOT_COMPLETED` du greffon GPS (`tools:node="remove"`), vérifier `allowBackup` (fiches 151 et 171 ; les deux services au premier plan sont déjà partis au 302)
5. **Fonds de carte sous contrat** ou tuiles de l'acheteur (Q5, fiche 152) : conditions d'usage d'OpenStreetMap et d'Esri World Imagery pour une application vendue, cache disque jusqu'à 20 Go
6. **Identifiant d'application final** : le nom technique `io.github.segneur.gtracker` (ou celui de l'acheteur au contrat) est posé au lot 323 ; reste à le remplacer par celui de l'acheteur **avant toute diffusion** (`${applicationId}` pour l'action d'intent, `capacitor.config.ts`, `build.gradle`, `strings.xml`) ; clé de signature cédée ou neuve : la clé neuve est faite au lot 323, la cession au contrat
7. **Documents** : décider ce qui est livré (réponse aux questions du lot 331 : `MISE_EN_PAGE.md` livré, `DECISIONS.md` non, `HISTORIQUE.md` à numéros conservés ou en archive) ; réécrire `CLAUDE.md` en `ARCHITECTURE.md` et `CONTRIBUER.md` ; faire lisible `ETAT_DU_PROJET.md` (§11 en entier, §12) ; ligne d'installation de l'APK et crédit GONG dans `README.md` ; licence de l'ensemble (`package.json` sans `license` ni `author`)
8. **Atelier retiré de la livraison** : `.claude/`, `docs/BACKLOG.md`, `docs/backlog/`, `docs/MODELES.md`, `DOCUMENTS` de `outils/docs-cites.mjs` réduit ; les archives `D:\gong tracker\atelier\` sont sorties du dossier de vente par le lot 324
9. **Dépôt réécrit en un seul commit** (`git checkout --orphan`) : **vérifier l'auteur du commit avant** (`.git/config` porte `user.name = Tracker`, `email = tracker@users.noreply.github.com`, les 14 commits existants aussi ; `git config user.name "Gtracker"` et un e-mail `noreply` neutre) ; l'historique et l'adresse e-mail de l'utilisateur ne sont pas cédés (réponse du 07/11, Q4 de la fiche 153)
10. **Contrôle final** : les trois recherches de la section 5 de `D4-atelier-coupure.md` (contenu du dépôt, noms de fichiers, identité de l'APK) à zéro sur le dépôt livré ; APK de livraison construite et installée une fois sur un téléphone propre : lancer, enregistrer, importer, « Ouvrir avec »

### Pièges
- Le lot 308 n'a plus à renommer des clés, des formats ni des chemins Java : s'il le fait, c'est que les lots 321 à 323 n'ont pas été faits.
- Après la réécriture en un commit, plus rien ne passe d'une version à l'autre par git : toute correction oubliée se refait à la main.
- Le dossier parent `D:\gong tracker` garde son nom (c'est le dossier de travail, pas l'ancien projet) ; le renommer ferait ouvrir à Claude un autre dossier de mémoire.

### Vérification
- Les recherches de la section 5 de `D4-atelier-coupure.md` ; `npm run verif` ; `./gradlew clean testDebugUnitTest assembleRelease` ; `adb shell dumpsys package <identifiant final>` à la première installation.

### Questions liées
- **Quel identifiant définitif pour l'application ?** · Par défaut : `io.github.segneur.gtracker`, à remplacer par celui de l'acheteur au contrat · Change : tout ce que le lot 323 a posé, et la perte des données si c'est fait après une installation.
- **Les documents de pilotage sont-ils livrés ?** voir lot 331.
- **Les archives `atelier\` (1,9 Mo, tout sur l'ancien projet) : sortir, supprimer ?** · Par défaut : sortir du dossier de vente vers un dossier personnel, ne rien supprimer (lot 324).
