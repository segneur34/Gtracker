# 454 · Programme Windows : les cartes d'OpenStreetMap sont refusées

Modèle | Réflexion : Sonnet | high

## Ce que l'utilisateur a vu (19/11, essai 303 du lot 445, programme Windows 0.01.41)

Dans le .exe, toutes les cartes (vignettes de la liste, carte de l'analyse) montrent à la place du fond l'image « Access blocked. App is not following the tile usage policy of OpenStreetMap's volunteer-run servers: http://osm.wiki/Blocked », avec « 403 ». Au navigateur et sur le téléphone, les mêmes cartes se chargent.

## Ce qui est lu dans le code (par l'orchestrateur, le 19/11)

- `bureau/main.ts`, `brancherProtocole` : toute requête `https` de la page passe par `protocol.handle('https', …)` ; pour un hôte autre que celui de l'application, elle repart par `net.fetch(requete, { bypassCustomProtocolHandlers: true })`, depuis le processus principal.
- `src/core/mapBase.ts` : le fond est `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- Le mode d'essai (banc) refuse tout hôte extérieur : le banc n'a donc jamais vu ce défaut.

Supposition de l'orchestrateur, à vérifier avant de corriger : la requête relayée part sans `Referer` (ou avec un `User-Agent` générique d'Electron), et le serveur de tuiles, qui exige qu'un programme se présente, la refuse.

## Travail

1. Premier geste, avant toute correction : mesurer. Un petit script lancé par l'Electron de `bureau/` (hors mode d'essai, profil temporaire) qui demande **une seule tuile** comme le fait `brancherProtocole` aujourd'hui, et relève le statut et les en-têtes envoyés. Puis la même demande avec un `User-Agent` qui nomme le programme (`Gtracker/<version>`) et un `Referer` (`https://gtracker.localhost/`), ensemble puis séparément, pour savoir ce qui suffit. Quelques requêtes en tout, pas davantage : c'est un serveur de bénévoles.
2. Corriger dans la coquille : les requêtes qui repartent sur le réseau se présentent comme le programme Gtracker. La fabrication des en-têtes est une fonction pure, testée dans `bureau/`. Aucune donnée personnelle (ni adresse de courriel, ni nom d'utilisateur) dans un en-tête.
3. Même contrôle pour la recherche de lieux (Nominatim), qui a la même règle : une seule requête de preuve.
4. Les images de refus déjà reçues : dire si le cache des tuiles (`src/platform/tileCache.ts`) et celui des vignettes ont pu les garder (une réponse 403 est-elle rangée ?). Si oui, ne plus ranger une réponse qui n'est pas réussie, et dire comment la mémoire de l'utilisateur s'en débarrasse (elles ne doivent pas rester à l'écran après la correction).
5. Le mode d'essai ne change pas : aucun hôte extérieur, banc identique.

## Ce que le lot ne fait pas

- Pas de changement de fournisseur de cartes, pas de clé d'API.
- Pas de commit, pas de version, aucune décision de l'utilisateur.
- `src/` seulement si le point 4 le demande.

## Preuve attendue dans le rapport

- Statut relevé avant (refus) et après (200, `image/png`) sur une tuile, et sur une recherche de lieu.
- Ce qui suffisait (`User-Agent`, `Referer`, les deux).
- Réponse au point 4.
- `node outils/verif.mjs --rapide` et les tests de `bureau/` passés.

## À dire à l'utilisateur après le lot

Les serveurs de tuiles d'OpenStreetMap sont tenus par des bénévoles et leur règle d'usage limite les gros usages : pour un programme vendu, le fournisseur de cartes est à rapprocher de la livraison (lot 308).
