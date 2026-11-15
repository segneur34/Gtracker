# 326 · Familles aplaties : traitement fondu dans la famille, conditions toujours vraies retirées

Modèle | Réflexion : Opus | high

Extrait le 15/11 de la fiche 319 (revue d'après fork du 11/11/2026, 424 000 caractères, partie « Lot 326 » et réponses de l'utilisateur qui le concernent). Les numéros de ligne cités ci-dessous sont ceux du commit `ddc7b57` (HEAD du 11/11) : les revérifier avant d'éditer, chaque lot exécuté depuis a déplacé ceux des suivants. Les rapports bruts des agents de la revue sont dans `D:\gong tracker\atelier\revue-1111\`.

## Ce que l'utilisateur a répondu le 11/11 (extrait de la fiche 319)

**« Défaut partout », sauf trois points** : les défauts des questions de la revue sont des décisions. Sur la question 13 : « deux familles gardées (voile, surf), le traitement fondu dans la famille » : défaut oui ; « GONG attend-il un sport qui ne serait pas une simple activité (downwind, SUP) ? » défaut : aucun pour l'instant.

- **Question 13, réponse qui change le lot 326** : l'utilisateur veut « décompacter » les deux groupes pour avoir directement sur l'accueil les activités (wing, kite, paddle, pumping, surf…), avec toujours la possibilité de les cacher et d'en créer. C'est une idée de produit neuve, rangée alors en 332 (maquette d'abord) ; **le lot 326 ne partait pas avant que le 332 soit décidé** : la famille reste peut-être le rangement interne du calcul, mais plus celui de l'accueil. (Depuis, la page Sessions unique et sa rangée de logos d'activités ont été faites : lot 346.)
- Question 9, première moitié : l'activité « Bateau » n'existait pas sur le téléphone de l'utilisateur (la régate avait été enregistrée sous « Voile », calcul wingfoil, d'où « Temps en vol ») ; sans effet sur le 326, sinon que le foil suit l'activité au changement (lot 314, mêmes lignes de `record.ts`).
- Les trois questions du lot, plus bas (« Questions liées »), ont leur défaut pour réponse : deux familles gardées, version poussée au premier sport neuf demandé, aucun sport hors activité attendu.

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
