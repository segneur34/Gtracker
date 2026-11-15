# Glossaire : les mots qui trompent

Pour qui reprend le code sans connaître son histoire. Chaque entrée dit ce que le mot désigne ici, où il vit, et avec quoi ne pas le confondre.

## Course, repère, balise

| Mot | Ce qu'il désigne | Où | Faux ami |
|---|---|---|---|
| course | Le cap fourni par l'appareil pour un point : `courseDeg`, lu par `readCourse` dans la balise `<course>` du GPX. Le parcours de balises, lui : `courseMarks` (balises à dessiner), `CourseLeg` / `courseLegs` (tronçons d'un itinéraire planifié). | `src/core/gpxParser.ts`, `src/recording/markGuide.ts`, `src/planning/route.ts` | Jamais la course à pied, qui n'existe pas ici. `courseDeg` n'est pas `bearing`, cap calculé depuis les positions. |
| `SessionMark` | Repère posé par le bouton « Note » pendant l'enregistrement : instant, position (ou aucune), nom donné ensuite. | `src/core/sessionMarks.ts` | Pas une balise : il vit dans la fiche de la session. |
| `CourseMark` | Balise du parcours à dessiner sur la carte : position, numéro, sort (laissée, visée, à venir). | `src/recording/markGuide.ts` | Pas un repère de « Note ». |

## Le calcul d'une session

| Mot | Ce qu'il désigne | Où |
|---|---|---|
| `SportType` | Identifiant d'un calcul (wingfoil, windsurf, kite, bateau, surf) ; porté par le champ `sport` des fiches. Sa configuration : `SPORT_PROFILES`. | `src/core/types.ts`, `src/core/sportProfiles.ts` |
| `Activity` | Ce que l'utilisateur voit et crée (nom, couleur, icône) ; son `base` est le `SportType` sur lequel elle s'appuie ; `activityId` la désigne dans les fiches et les réglages. | `src/core/activities.ts` |
| support, calcul | Dans l'interface, « support » et « calcul » disent le `SportType` ; « activité » dit `Activity`. Faux ami : `base` n'est pas une base de données ni un fond de carte (`MapBase`). | |
| `sportFamily` | Range les activités et leurs sessions (page Sessions, listes d'activités, Réglages, module d'analyse d'une session) et choisit aussi comment elles se calculent et s'affichent (unités, chiffres du direct, onglets) : `SportFamily`, identifiant `voile` ou `surf`, écrit une fois dans le profil du calcul (`SportProfile.family`). Son nom montré est « Avec vent » ou « Sans vent » (`FAMILY_LABEL`) : l'identifiant n'est pas ce que l'écran affiche, et « Surf » à l'écran est l'activité, pas la famille. | `src/core/sportProfiles.ts` |

## Fréquence cardiaque

- `hr` : la valeur d'un point de trace (`TrackPoint`, `src/core/types.ts`), et celle du tableau de lignes de `SurfModule`.
- `heartRateBpm` : la valeur portée par un échantillon de position à l'enregistrement (`src/platform/location.ts`).
- `bpm` : l'échantillon de la ceinture (`src/platform/heartRate.ts`) et les calculs de zones et d'énergie (`src/core/heartRate.ts`). Même grandeur, en battements par minute.

## Seuil

- Seuil d'activité d'une session : au-dessus, on est en vol (foil) ou en mouvement (sinon). Propre à la fiche, il prime sur celui du support. Réglage : `activityThresholdKn`, défaut par `defaultThresholdOf` (`src/settings/activitySettings.ts`).
- Plafond du profil : valeur de `SPORT_PROFILES`. La mise à l'échelle ne fait que l'abaisser.
- Seuil accordé à l'allure de la session : calculé sur la vitesse de croisière (`referenceSpeedMs`, `src/core/sessionSpeed.ts`), appliqué dans les hooks, jamais par défaut dans les calculs.

## Vocabulaire de glisse

- vol : tronçon où le foil porte (`sailingFlights`, `src/sailing/sailingStats.ts` ; `SurfFlight`, `src/surfing/surfAnalysis.ts` ; `FlightSpan`, `src/core/pumping.ts`).
- bord : tronçon de cap tenu entre deux virages ; en direct sans vent, `src/recording/liveLegs.ts`. Faux ami : `Tack` (tribord ou bâbord) est l'amure, pas le bord.
- manœuvre : virement (`tack`), empannage (`jibe`) ou sens incertain (`undecided`), type `ManeuverKind` dans `src/sailing/maneuvers.ts`.
- vague : `SurfWave`, détectée dans `src/surfing/surfAnalysis.ts`.
- pumping : mouvements de pompe sur la planche ou la vague, comptés dans `src/core/pumping.ts`.

## Unités

- `src/core/` : unités SI (m/s, m, s ou ms, degrés) ; ex. `speedMs`, `smoothedSpeedMs` sur `TrackPoint`.
- `src/sailing/` : nœuds, sur `PointData` (`smoothedSpeed`, `speedKn`), produit par `trackToPointData` (`src/sailing/pointData.ts`). Héritage assumé : ne pas convertir sans plan.
- `src/surfing/` : SI. La conversion se fait en sortie (`src/core/units.ts`).
