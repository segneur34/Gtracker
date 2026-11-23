# 526 · Restes de la livraison qui ne dépendent pas de GONG

Modèle | Réflexion : Opus | high

Relevés le 23/11 par l'outil de livraison (`node outils/livraison.mjs`, recherche « vendeur : github ») et par la note de remise à GONG (hors dépôt), vérifiés dans le code le même jour. Avis donné à l'utilisateur le 23/11 (réécrire les essais d'import, retirer la seconde phrase de l'aide, corriger le rafraîchissement) : à lancer après sa réponse.

## 1. Essais d'import : l'ancien espace de noms porte le compte GitHub du vendeur

- `src/library/legacyImport.test.ts` (vers la ligne 494) et `src/test/legacyImport.fixture.ts` (vers 743 et 1119) écrivent l'adresse de l'ancien espace de noms dans des GPX d'essai. Le code d'import ne lit pas cette adresse (elle n'apparaît dans aucun fichier de `src/` hors essais : le vérifier d'abord, puis l'écrire dans un essai : une session de l'ancienne application se reconnaît quel que soit l'espace de noms déclaré).
- À faire : une adresse neutre dans les décors (domaine réservé `example.invalid`), essais inchangés par ailleurs. Pas d'exemption dans l'outil de livraison.
- Hors du lot : `capacitor.config.ts` et `src/platform/capacitorConfig.test.ts` (contact des requêtes, lot 308, attend GONG).

## 2. Aide de Réglages › Cartes hors ligne

- `src/pages/SettingsPage.tsx` (vers la ligne 785) : « Chaque morceau de carte vu avec le réseau reste visible sans réseau. Pour préparer une sortie, parcourez la zone en ligne, de loin puis de près. » La seconde phrase invite à un préchargement que la règle d'usage des serveurs d'OpenStreetMap n'admet pas.
- À faire : garder la première phrase seule ; clés de `src/locales/en.json` et `es.json` ; scripts du banc qui lisent cette aide (`reglages-aide`, chercher la phrase dans `outils/banc/`).

## 3. Rafraîchissement d'une image de carte gardée (constat C-27)

- `src/core/tiles.ts` (`refreshAgeMs`, 7 jours) : une image gardée plus vieille est redemandée en entier, sans lire les en-têtes de cache ni envoyer de requête conditionnelle. La règle technique d'OpenStreetMap demande de respecter la durée donnée par le serveur et de revalider (`If-None-Match`, `If-Modified-Since`).
- À établir d'abord : ce que chaque version peut faire (navigateur : `fetch` et le cache HTTP ; Android : `src/platform/mapTiles.ts`, `src/platform/tileCache.ts` ; Windows : relais `net.fetch` de `bureau/`), et où garder l'empreinte (`ETag`) d'une image. Si la revalidation demande de changer le format du cache sur le disque, s'arrêter et rendre BLOQUÉ avec les options : le lot ne casse pas les cartes déjà gardées.
- Minimum acceptable : requête conditionnelle quand l'empreinte est connue, réponse 304 qui remet l'âge à zéro sans réécrire l'image.

## 4. Adresse de carte en `http://`

- `isTileTemplate` (`src/core/mapBase.ts`) accepte `http://` alors que l'écran dit « ou elle ne commence pas par https:// ». À faire : n'accepter que `https://`, avec son essai ; une adresse `http://` déjà choisie retombe sur l'adresse d'origine, comme toute adresse non retenue.

## Vérification

`node outils/verif.mjs --rapide` par l'agent ; `npm run verif`, banc (`reglages`, `reglages-aide`, un script de carte) et `node outils/livraison.mjs` par l'orchestrateur : la recherche « vendeur : github » ne doit plus trouver que la configuration et son essai.

## Point 3, tranché le 23/11 d'après le plan (agent `Plan`, règle d'OSM relue le jour même)

Pas de code, des commentaires justes. La règle dit : suivre les en-têtes de cache et revalider par requête conditionnelle, ou, pour un cache qui ne peut pas les lire, garder chaque tuile sept jours au moins : c'est ce que fait l'application. La page ne peut pas faire mieux : le serveur d'OSM n'expose pas son `ETag` à une page d'une autre origine (ni `Last-Modified`, absent) et sa réponse préliminaire n'admet pas `If-None-Match` ; deux nœuds de cache ont d'ailleurs rendu deux `ETag` pour la même tuile. Une revalidation native (requête hors de la page sur le téléphone, `ETag` gardé par le relais du programme Windows) reste possible mais ajoute un chemin réseau et un fichier dans le dossier des tuiles, pour un fournisseur que l'acheteur doit de toute façon remplacer : laissé à l'acheteur, dit dans la note de remise. Relevé au passage, non traité : dans le navigateur et sur le téléphone, une image de refus rendue par OSM (réponse 200 marquée d'un en-tête que la page ne lit pas) serait gardée comme une tuile.
