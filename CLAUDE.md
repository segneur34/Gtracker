# Gtracker : analyse de sessions de voile et de surf à partir de traces GPX

Application 100 % client (React 19, TypeScript, Vite 8, Recharts, Leaflet), sans backend. Deux familles, `voile` et `surf` (identifiants, adresses et mots de ce fichier ; noms montrés à l'écran : `docs/DECISIONS.md` §11) : voile (`/voile/analyse` : wingfoil, planche, kite, bateau) et surf (`/surf/analyse`), une page d'ouverture `/profil`, la liste `/sessions`, et les pages `/enregistrer`, `/itineraires`, `/statistiques` et `/parametres`. Interface et commentaires en français. Application Android via Capacitor, avec enregistrement GPS natif et mémoire en dossier portable.

Chaque information a une seule place :
- `docs/ETAT_DU_PROJET.md` : pipeline, persistance, dette et limites connues, et **l'avancement du plan mobile (§12), tenu là seulement**. Le lire avant de toucher au noyau ou aux analyses voile.
- `docs/DECISIONS.md` : les décisions de l'utilisateur propres à un domaine, en sections 1 à 12 ; les transverses restent ici. Lire la section du domaine avant d'y toucher (table plus bas).
- `docs/HISTORIQUE.md` : décisions et pièges, en points numérotés (« §10, point N ») ; le consulter par recherche sur le sujet, pas en entier.
- `docs/INVENTAIRE.md` : carte des fichiers ; les signatures se lisent dans le code.
- `docs/GLOSSAIRE.md` : les mots du code qui trompent (« course », « mark », calcul, support et activité, famille et traitement, noms de la FC, seuils), en une page.
- `docs/MISE_EN_PAGE.md` : patron commun des pages d'analyse (structure, règles ordinateur et téléphone, pièces partagées). Le suivre pour toute page d'analyse, existante ou nouvelle.
- `docs/BACKLOG.md` : le seul reste à faire : lots, idées, dette, essais au téléphone, questions ; `docs/backlog/` pour les détails ; `node outils/backlog.mjs` pour le tableau de bord.
- `docs/MODELES.md` : quel modèle et quel effort pour quelle tâche, et les sous-agents de `.claude/agents/`.

## Commandes

```
npm run verif                    vérification complète, sortie courte : lint, tous les tests, build, renvois des documents (fichiers cités, carte d'INVENTAIRE)
node outils/verif.mjs --rapide   typecheck, lint, tests touchés (sans build)
node outils/banc/passe.mjs       passage du banc, avant/après (options en tête du script)
```

Les autres (serveur, typecheck seul, un seul test, JDK d'Android…) : `docs/DEVELOPPER.md`. Android : procédure, signature et version au §12 de l'état ; clé hors dépôt, jamais régénérée ni versionnée ; version unique dans `package.json`, à augmenter avant chaque APK diffusé.

Vérifications, toutes doivent passer :
- pendant le travail, après une modification du code : typecheck, lint, tests touchés (`--rapide`) ;
- à la fin de chaque étape rendue à l'utilisateur, et avant tout commit, banc ou APK : lint, tous les tests, build, qui fait le typecheck (`npm run verif`) ;
- rien pour une modification de la seule documentation.

Vérifications et banc se lancent depuis la conversation (sous-agents `banc` et `doc` : `docs/MODELES.md`).

## Documentation

- Une passe après chaque lot que l'utilisateur a validé sur données réelles, jamais entre deux modifications, sans attendre la fin de session : sections touchées d'ETAT (jamais le récit du lot, qui va dans HISTORIQUE), un point daté de quelques lignes dans HISTORIQUE (décision, pourquoi, piège ; ni fichiers touchés ni récit de livraison, que git garde), la carte d'INVENTAIRE si un fichier apparaît ou change de rôle.
- `CLAUDE.md` : seulement si une règle ou une décision transverse de l'utilisateur a changé ; une décision propre à un domaine va dans la section de `docs/DECISIONS.md`. Ni état d'avancement, ni procédure détaillée, dans l'un comme dans l'autre.

## Environnement

- Franchise avant exécution : si une demande de l'utilisateur semble erronée (hypothèse fausse, approche qui ne mène pas à ce qu'il cherche, conflit avec une décision déjà prise), le dire clairement avant d'agir et proposer une alternative, plutôt que d'acquiescer puis de travailler longtemps dans une mauvaise direction. De même, si une demande est ambiguë ou si Claude n'est pas sûr de l'avoir comprise, il pose la question : l'utilisateur préfère une question de trop à un lot parti de travers. Cela vaut pour le sens d'une demande ; les détails d'implémentation restent à trancher seul.
- Dépôt git, doublé d'un dépôt GitHub privé : un commit par lot vérifié, marqué « à valider » ; validation par paquets en mode chaîne (`docs/MODELES.md`, `docs/BACKLOG.md` fait foi) ; un envoi après accord de l'utilisateur. Un lot couvre un sujet entier (plusieurs étapes), pas une petite étape isolée : peu de lots, donc peu de commits. Fins de ligne fixées par `.gitattributes` : LF partout, CRLF pour les `.bat`.
- Banc de test dans `outils/banc/` (mode d'emploi dans son `LISEZMOI.md`) : Claude y éprouve lui-même l'application dans un Chrome sans fenêtre ; il prouve la neutralité d'un changement par le texte de la page relevé avant et après.
- Essais au téléphone : n'en demander que peu, les vraiment critiques (ce que ni les tests ni le banc ne peuvent voir : GPS, capteurs, ceinture, notification, écran éteint, rendu tactile) et ceux où Claude a un vrai doute ; une question à trancher par l'utilisateur en fait partie. Tout ce que le banc ou les tests prouvent (changement neutre, chiffres identiques, mise en page relevée) n'y va pas. Quelques essais par paquet, jamais une longue liste. Ils vont dans `docs/BACKLOG.md`, en sous-lignes de leur lot.
- Windows 11, terminal `cmd` : ne jamais donner de commande PowerShell à recopier. L'utilisateur colle parfois lui-même la sortie.
- Aucun GPX réel dans le projet : les tests sont synthétiques, la validation sur données réelles revient à l'utilisateur.
- Une question d'algorithmique peut partir chez Gemini : la formuler de façon autonome et complète.
- Modèle de la session nettement inadapté à la demande (gros décalage, dans un sens ou dans l'autre) : le dire dans le premier message, avant tout travail (`docs/MODELES.md`, « Mauvais modèle »).

## Règles d'architecture

1. `src/core/` en unités SI (m/s, m, s ou ms, caps en degrés). Conversion en sortie seulement (`core/units.ts`, profil du support).
2. Fenêtres en secondes, jamais en nombre de points : une trace à 1 Hz et à 5 Hz donne le même résultat (testé).
3. Un seuil qui dépend du support ou que l'utilisateur règle vient de `SPORT_PROFILES`, est passé en paramètre, surchargeable, et la surcharge est persistée. Une constante d'algorithme, commune à tous les supports, est une constante nommée et commentée de son module, passée en option avec son défaut quand un test doit la faire varier (en voile : `docs/DECISIONS.md` §1).
4. En voile, un seuil de vitesse s'accorde à l'allure de la session (`core/sessionSpeed.ts`), surchargeable. Les valeurs du profil sont des plafonds : la mise à l'échelle ne fait qu'abaisser. Elle est appliquée dans les hooks, jamais par défaut dans les calculs (tests neutres). Préférer un rapport sans dimension à des nœuds absolus (vol perdu : conservation de vitesse sous 0,5).
5. `sailing/*` travaille en nœuds sur `PointData` (`sailing/pointData.ts`) : héritage assumé, pas de conversion sans plan dédié.
6. Distance = intégrale de la vitesse retenue (`segmentDistanceM`), ni celle du fichier ni une somme de Haversine ; seule exception, le trou de trace (pas plus long que `maxGapS`, 10 s), borné par la corde × 1,5 et hors du mouvement s'il est immobile (`gapDistanceM`, posé par `computeKinematics`).
7. Vent : lu à la bissectrice de chaque manœuvre classée, toutes comprises ; statistiques pondérées par la symétrie du virage, jamais filtrées (`calculateWindStats`). L'estimation globale (`estimateWind`) repose sur la polaire et les manœuvres à caps stabilisés (`windSamplesFrom`). Polaire glissante et corde entrée → sortie ont été essayées puis retirées : ne pas les réintroduire.
8. Lecteur GPX maison (`core/gpxParser.ts`) : ne pas réinstaller `gpxparser`, qui ignore les extensions (Doppler, FC, cadence).
9. Une famille, un module d'analyse, une adresse (`/voile/analyse`, `/surf/analyse`, `core/parentPage.ts`) ; le module ne reprend que les activités de sa famille : `useSportSettings(family)`. Une session qui change de famille change de module.
10. Cadence variable : une application économique peut compresser un virage entier dans un seul intervalle. Ne jamais supposer plusieurs points dans une fenêtre de quelques secondes.
11. Cartes : composants maison sur `leaflet` (`components/map/`), jamais `react-leaflet` ; le style d'un trait ou d'un rond passe par `pathOptions`, réappliqué (`setStyle`) quand l'objet change : le garder stable (constante ou `useMemo`).
12. Stockage, fichiers (reçus d'une autre application compris), position, son, vibreur, capteurs, ceinture cardio, autorisations, notification, écran allumé et orientation figée : uniquement via `src/platform/` (liste des modules : `docs/INVENTAIRE.md`), chaque module y choisissant sa version navigateur ou téléphone par `isNativeApp()`. Hors de ce dossier, ni API du navigateur pour ces capacités ni paquet `@capacitor/*` ou `@capgo/*` : `src/architecture.test.ts` le garde (`PLATFORM_ONLY`).
13. Deux familles seulement, voile et surf (`SPORT_FAMILIES`) : ni course à pied, ni vélo, ni Entraînement, ni allure en min/km, ni dossier `running`, `cycling` ou `land`. Aucune donnée d'une autre application n'est relue hors de la porte d'import (`library/legacyImport.ts`), et l'ancien nom n'est pas écrit (seule exception : le nom sans son G, sous le logo GONG du Profil). Gardes : `src/landWords.test.ts` (relevé `outils/heritage.json`, qui ne fait que baisser), `src/architecture.test.ts`, `src/heritage.test.ts`.
14. Un commentaire de `src/` tient seul : ni numéro de lot, ni question, ni numéro du reste à faire, ni renvoi au journal, ni date d'atelier ; la raison s'écrit en clair. `src/architecture.test.ts` le garde (tests compris, dates exceptées), avec une liste de faux amis qui ne fait que diminuer.

## Où ajouter quoi

Recettes rares : quand le lot ajoute l'une de ces choses, lire son entrée dans `docs/DEVELOPPER.md`, « Où ajouter quoi » :
- un nouveau calcul de support ;
- un réglage utilisateur ;
- une page d'analyse (une seule par famille, règle 9 ; un calcul neuf n'en crée pas) ;
- une section de module (onglet) ;
- une métrique de manœuvre ;
- un calcul de glisse neuf (vol, vague, run de downwind…).

Toujours :
- Famille et traitement (`sportFamily`, `sportTreatment` : `docs/GLOSSAIRE.md`) : à l'intérieur d'une famille, un comportement se lit dans les capacités du profil, jamais par un nom de calcul en dur (`=== 'kite'`) : `src/architecture.test.ts` le garde, hors des tables qui décrivent les calculs (`SPORT_TABLES`).
- Graphe relié à la carte, surbrillance sur la carte d'une analyse : `docs/MISE_EN_PAGE.md` (« Graphes reliés à la carte », « Une seule surbrillance »).
- Donnée propre à une session (notes, vent saisi, seuil d'activité, allure imposée, foil, pumping, repères du bouton « Note », support et activité) : dans sa fiche (`library/record.ts`), écrite par `updateSessionRecord` (`hooks/sessionLibrary/sessionRecords.ts`) ; dans le module, par le brouillon (`useSessionDraft`, `library/sessionEdits.ts`) et « Enregistrer la session » ; jamais dans une clé de l'appareil. Une donnée recalculable depuis le GPX va dans `summary`, avec `SUMMARY_CALC_VERSION` augmenté si son calcul change.
- Calcul pur : dans `core/`, `sailing/`, `surfing/`, `planning/`, `recording/` ou `library/`, avec son `*.test.ts` sur trace synthétique.
- Texte visible : par `t` ou `tn` (pluriel, `core/i18n.ts`), `tRich` ou `tnRich` pour une phrase à balises (`components/tRich.ts`) ; la clé est le texte français, toujours un littéral ; une donnée enregistrée se traduit à l'affichage, jamais à l'écriture. Dictionnaires `src/locales/en.json` et `es.json`, sans clé manquante ; gardes `outils/i18n.mjs` et `src/i18nGuard.test.ts`.
- Couleur, police, rayon, espacement : une variable de `src/theme/tokens.css`, jamais une valeur en dur dans un écran neuf. Composants communs dans `components/ui`, icônes dans `components/icons.tsx` (pas d'emoji). Les couleurs de données des graphes et de la carte restent en dur (attributs SVG). Styles en ligne : `outils/styles-en-ligne.json` fige leur nombre par fichier, qui ne fait que baisser, et un fichier neuf n'a aucun `style={{` (`src/theme/inlineStyles.test.ts`).

## Décisions de l'utilisateur

Celles d'un domaine sont dans `docs/DECISIONS.md`, celles de la disposition des analyses dans `docs/MISE_EN_PAGE.md`, de même autorité que ce fichier. Avant de toucher à un domaine, lire sa section :

| Avant de toucher à | Section de `DECISIONS.md` |
|---|---|
| `sailing/`, `SailingModule`, vent, manœuvres, foil, balises (`markGuide`, `useMarkGuide`) | 1. Voile |
| graphes et leur zoom, temps en mouvement, matériel et notes, altitude | 2. Analyses communes |
| sauts (`core/jumps.ts`, `platform/motion.ts`, `useSessionJumps`, `JumpsPanel`) | 3. Sauts |
| `surfing/`, `SurfModule` | 4. Surf |
| test de FC repos (`restingHrTest`, `RestingHrTestPage`, sous Réglages) | 5. Test de FC repos |
| `recording/`, `useRecorder`, `RecordingPage`, pause, journal | 6. Enregistrement |
| `planning/`, `PlanningPage`, `RoutesPage`, `usePlannedRoute` | 7. Planification et itinéraires |
| `library/`, `useSessionLibrary`, `pages/SessionsPage`, `SessionRow`, `platform/memoryFolder.ts`, `platform/tileCache.ts`, fond des cartes (`BaseTileLayer`), réglages par appareil, GPX téléchargé | 8. Mémoire et fichiers |
| `pages/ProfilePage`, `ProfileAvatar`, `ProfilePrompt` | 9. Profil |
| `pages/StatisticsPage` | 10. Statistiques |
| `pages/SettingsPage`, `core/activities`, la rangée de logos de la page Sessions (`ActivityBubbles`), `core/navigation.ts` | 11. Réglages, Sessions et ouverture |
| `core/sportProfiles.ts` (familles, profils, capacités), `core/analysisTabs.ts`, `recording/liveFields.ts`, `settings/activityPresets.ts` | 1. Voile et 4. Surf, et « Où ajouter quoi » plus haut |
| `components/AnalysisShell.tsx`, `pages/SailingModule.tsx`, `pages/SurfModule.tsx` | `docs/MISE_EN_PAGE.md` |

Décisions transverses (un « § » renvoie ici à une section de `DECISIONS.md`) :

- Disposition des analyses, toutes (carte, onglets, « général » et « avancé », panneaux, graphes repliables, téléphone, aides « ? », surbrillance unique) : `docs/MISE_EN_PAGE.md` ; rien ne s'y déplace sans redemander. Ordre des onglets et liste de « général » par sport aux §1 et §4, onglets montrés choisis par activité (§11).
- Couleur de trace : dégradé sur une échelle absolue (`core/speedGradient.ts`), en 64 nuances, sans paliers visibles, gris sous la borne basse ; une seule coloration d'une session, la même dans son analyse et sa vignette (`core/trackColor.ts`), la vitesse lissée du noyau, sans lissage de plus. Bornes effectives : celles de la trace (sa fiche, réglées dans l'onglet réglages de son analyse), sinon celles du support dans Réglages, sinon le pré-réglage de l'activité, la suggestion du kite en voile, ou celles du traitement (valeurs aux §1 et §4) ; la légende ne fait qu'afficher (`docs/MISE_EN_PAGE.md`).
- Session : vent saisi, seuil, allure imposée, couleurs de la trace, repères et notes restent en brouillon jusqu'à « Enregistrer la session » (Annuler, avertissement en quittant). Le seuil est propre à chaque session, dans sa fiche, et prime sur celui du support. Le support se change immédiatement.
- Activités : l'utilisateur crée les siennes dans Réglages, sur un calcul ; elles seules sont proposées partout, jamais en dur. Départ, liste, œil, suppression et adresses : §11.
- Activité d'une session : celle de la trace suivie est proposée à l'enregistrement ; elle se change pendant l'enregistrement et dans l'onglet réglages de l'analyse, d'une famille à l'autre comprise (recalcul complet, la session change de module).
- Pré-réglages : chaque activité de départ démarre sur les réglages du téléphone de l'utilisateur, sa référence en cas de doute (`settings/activityPresets.ts`) ; ils sont le « défaut » de Réglages, et une activité créée prend ceux de son calcul. Valeurs par sport aux §1 et §4.
- Formats d'affichage : virgule décimale et durées espacées (« 12,4 km », « 1 h 24 ») partout, par `core/units.ts` (`formatDecimal`, `formatDuration`) ; saisie, fichiers et fiches inchangés.
- Réglages d'affichage (unités de vitesse et de distance) choisis dans Réglages seulement, par activité (donc par support : bateau et wing peuvent différer), actifs partout ; distance en km par défaut, milles nautiques au choix. Les autres réglages par activité sont dans la section de leur domaine.
- Charte graphique (§12) : tout passe par les variables de `theme/tokens.css` ; le vert vif est toujours en aplat sous du noir, jamais en texte ; la couleur d'une activité ne remplit jamais une grande surface et ne porte pas de texte ; ce qui est allumé l'est à l'encre, noire le jour, blanche la nuit.
- Navigation (ouverture sur le Profil, une seule page Sessions, ordre des barres, retour d'Android, brouillon à confirmer) : §11.
- Reste à faire (`docs/BACKLOG.md`) : règles dans son en-tête ; ce que l'utilisateur lit ne porte aucun jargon.
