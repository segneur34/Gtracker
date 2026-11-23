# 493 · Photo satellite coupée : plan retenu

Plan de l'agent Plan du 23/11, confronté par l'orchestrateur. Brief : section 493 de `493-relecture-avant-vente.md`. Lignes citées : celles du commit `d13131e`.

Vérifié par le plan : rien à toucher dans `bureau/` (la coquille relaie les requêtes et ne garde aucune tuile ; l'ordinateur passe par le magasin du navigateur de `tileCache.ts`), rien dans `android/`, aucun pré-téléchargement de tuiles, aucune mention d'Esri dans `AboutSettings.tsx` ni dans `outils/licences-hors-js.mjs`.

## Partie A : code de l'application

- A1 (C-01, le descripteur). `src/core/mapBase.ts` ne garde que `plan` : `MAP_BASES = { plan: {...} } as const satisfies Record<string, MapBaseSource>`, `type MapBase = keyof typeof MAP_BASES`, `isMapBase` par `Object.hasOwn(MAP_BASES, v)` (un « satellite » rangé n'est plus un fond). `MapBaseSource` gagne `label` (t('Plan')), `photo: boolean` (liseré blanc sous les traits, mention repliable sur téléphone) et `creditUrl`. En tête du fichier, un commentaire « ajouter un fond » (l'entrée : adresse, mentions, `keyPrefix`, `overzoomDepth`, `fetchAncestors` ; puis son champ d'adresse dans Réglages). Aucune adresse du fournisseur retiré, même en commentaire. `baseOfTileKey` et `tileCacheUsageByBase` supprimés s'ils ne servent plus.
- A2. Le repli sur le plan est déjà fait par les filtres `isMapBase` : `src/hooks/useMapBase.ts:readMapBase` (réglage de l'appareil), `src/library/record.ts:parseRecord` vers l. 692 (fiche), `src/platform/tileCache.ts:tileUrlOverrides` (adresses saisies). Restent les commentaires « plan ou satellite » (useMapBase.ts:9, record.ts:348).
- A3. `src/components/BaseTileLayer.tsx` : `BASE_CHOICES` construit depuis `MAP_BASES` ; `BaseSwitch` ne se monte que s'il y a au moins deux fonds (analyse, planification et direct d'un coup) ; `foldAttribution` teste `MAP_BASES[base].photo`. Les règles `.is-foldable` de `src/theme/base.css` restent, leurs commentaires sur le fournisseur changent (comme `BaseTileLayer.css`).
- A4. Liseré blanc : `=== 'satellite'` devient `MAP_BASES[base].photo` dans `src/components/LiveMap.tsx:201`, `src/components/TrackSegmentsLayer.tsx:42`, `src/pages/PlanningPage.tsx:251` ; commentaires de `mapStyles.ts:9`, `icons.tsx:251`, `ShareDialog.tsx:81`.
- A5 (C-26). Pour le plan, `creditUrl: 'openstreetmap.org/copyright'` ; `shareCredit(base)` exporté de mapBase.ts (« © OpenStreetMap · openstreetmap.org/copyright »), employé dans `src/components/drawShareImage.ts:183`. Le champ `credit` ne change pas : la vignette (`SessionPreviewMap.tsx:24`) garde « © OpenStreetMap ».
- A6. Réglages et textes : `src/pages/SettingsPage.tsx` sans la ligne « dont satellite » (1139) ni le champ d'adresse du satellite (1153), aide 1148 : « Au-delà, les plus anciens morceaux sont effacés. » ; `src/hooks/useTileCache.ts` sans l'état `satellite` ; `src/tutorials/lessons.ts:73` sans la phrase du bouton ; `en.json` et `es.json` : clés orphelines retirées (« Satellite », les deux « Powered by Esri… », « , dont satellite… », l'ancienne aide, « Adresse des tuiles du satellite », la phrase du tutoriel), « Satellites utilisés » gardée, nouvelle clé ajoutée ; `README.md:18,22` sans la ligne du fournisseur ni « ou du satellite ».
- A7. Effacement une seule fois, `src/platform/tileCache.ts` : `RETIRED_TILE_PREFIXES = ['sat_']` et `purgeRetiredTiles(store = tileStore)` : `store.list()`, `store.remove(clés préfixées)`, puis le drapeau, écrit seulement après la fin de l'effacement (coupé en route : on recommence au lancement suivant). Drapeau dans la clé existante `STORAGE_KEYS.tileCache` (`{ capMb?, purged?: string[] }`), que `writeTileCapMb` doit garder. Le même code sert le téléphone (`nativeStore`), le navigateur et le programme Windows. Appel : `void purgeRetiredTiles()` dans `src/boot.tsx:startApp`, après le rendu.
- A8 (C-27) : laissé à l'acheteur (tranché par l'orchestrateur, voir plus bas). Seuls les commentaires disent vrai : `src/core/tiles.ts:8-10` et `refreshAgeMs` (une nouvelle demande complète au bout de 7 jours, sans lire les en-têtes de cache du serveur) ; `src/platform/mapTiles.ts:175` sans « chez Esri ».

Fichiers de la partie A : src/core/mapBase.ts, mapBase.test.ts, tiles.ts ; src/platform/mapTiles.ts, mapTiles.test.ts, tileCache.ts, tileCache.test.ts ; src/boot.tsx ; src/hooks/useTileCache.ts, useMapBase.ts ; src/components/BaseTileLayer.tsx, BaseTileLayer.css, LiveMap.tsx, TrackSegmentsLayer.tsx, mapStyles.ts, icons.tsx, ShareDialog.tsx, drawShareImage.ts ; src/theme/base.css ; src/pages/PlanningPage.tsx, SettingsPage.tsx ; src/tutorials/lessons.ts ; src/library/record.ts, record.test.ts, syncRecordMerge.test.ts (et syncPlan.test.ts si le typage refuse 'satellite') ; src/locales/en.json, es.json ; README.md.

Tests : mapBase.test.ts (cas du fournisseur retirés ; `isMapBase('satellite') === false`, `resolveMapBase('satellite','plan') === 'plan'`, `shareCredit('plan')`, adresse d'origine valide) ; tileCache.test.ts (l'effacement ne prend que les clés `sat_`, n'est fait qu'une fois, est refait s'il a échoué, `writeTileCapMb` garde le drapeau) ; mapTiles.test.ts (cas satellite 168-183 et 285-289 : dépendance `sources?`, défaut `MAP_BASES`, donnée à `createTileResolver`, pour éprouver `fetchAncestors` et `overzoomDepth` sur un fond factice) ; record.test.ts et syncRecordMerge.test.ts (une fiche `mapBase:'satellite'` se lit sans `mapBase`, sans erreur ni lecture seule).

## Partie B : banc (`outils/banc/` seulement, sur Sonnet, après la partie A)

- `satellite.mjs` réécrit sous le même nom, sans réseau, avec les tuiles synthétiques de `lib/tuiles.mjs` : aucun `.map-base-switch` en voile, en surf ni en planification ; une fiche `mapBase: 'satellite'` et une clé `fondCarte` `{voile:'satellite'}` donnent la mention du plan ; aucune requête vers le serveur retiré ; une tuile `/tuiles-gardees/sat_14_1_2.png` posée dans le cache a disparu après rechargement, la tuile de plan voisine est restée ; Réglages › Cartes hors ligne n'a plus de « satellite ».
- `carte-perf.mjs` sans son étape 4 ; `scripts.mjs:104` (`reseau` retiré ; pages voile, surf, planification, reglages) ; `SCRIPTS.md` lignes 96 et 100. `lib/cdp.mjs` et `lib/tuiles.mjs` inchangés.
- Passage : `satellite`, `carte-perf`, `partage` (la mention sur l'image), `reglages` et `tutoriels` pour le texte avant et après.

## Questions mineures, tranchées par l'orchestrateur le 23/11

- C-27 (requête conditionnelle) laissé à l'acheteur, commentaire corrigé : inutile s'il change de fournisseur, et l'effort n'est pas petit (en-tête lisible seulement si le serveur l'expose, pas d'index des tuiles sur le téléphone).
- Cache HTTP du moteur (programme Windows, WebView) : rien à faire, sa durée est celle que fixe le serveur.
- Vignettes : « © OpenStreetMap » sans l'adresse, faute de place ; l'adresse est sur la carte de l'analyse et sur l'image de partage.
- Une fiche déjà rangée avec `mapBase:'satellite'` oublie ce choix à sa prochaine écriture : accepté, c'est un choix d'affichage.
- L'adresse du fournisseur retiré n'est pas gardée en commentaire : git la garde.

Aucun essai au téléphone.
