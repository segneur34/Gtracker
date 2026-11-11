import type { JumpDetection } from './jumps';
import type { HeartRateZoneModel } from './heartRate';
import type { AttitudeParams } from './imuVertical';
import type { PumpDetection } from './pumping';
import type { SpeedRangeMs } from './speedGradient';
import type { SportType, TopTarget } from './types';
import { DEFAULT_MAX_DETOUR_RATIO } from './kinematics';
import { J_PER_KCAL, kmhToMs, knotsToMs, METERS_PER_DISTANCE_UNIT, type SpeedUnit } from './units';

/**
 * Profil d'un support. Regroupe tout ce qui varie d'une activité à l'autre :
 * unité d'affichage, seuils d'activité, fenêtres de filtrage, cibles de
 * meilleurs segments.
 *
 * Aucune de ces valeurs n'est figée dans le code de calcul. Le profil ne
 * fournit qu'un défaut : la valeur réellement utilisée est passée en paramètre
 * aux fonctions, et l'utilisateur peut la surcharger à tout moment.
 */

/** Réglage du calcul de dénivelé. */
export interface ElevationProfile {
  /** Lissage passe-bas de l'altitude avant tout cumul, en secondes. */
  smoothingSeconds: number;
  /**
   * Écart minimal, en mètres, entre un creux local et l'altitude courante pour
   * qu'une montée soit comptabilisée. Sans ce seuil, le bruit de l'altitude
   * GPS suffit à doubler le dénivelé réel.
   */
  minGainM: number;
}

/**
 * Pas plus long que cette durée : trou de la trace (arrêt sans point, GPS
 * perdu), en secondes, commun à tous les supports (décision du 27/10).
 */
export const MAX_GAP_S = 10;

/**
 * Lissage de l'altitude et plus petit dénivelé compté. Le réglage « route »
 * sert partout depuis le 21/10 : l'altitude de l'IGN est déjà propre, et le
 * choix du terrain par activité et par session a été retiré ; « trail » reste
 * pour mémoire et pour les tests.
 */
export const ELEVATION_PRESETS: Record<'route' | 'trail', ElevationProfile> = {
  route: { smoothingSeconds: 20, minGainM: 3 },
  trail: { smoothingSeconds: 30, minGainM: 5 },
};

/**
 * Réglage de l'enregistrement GPS sur téléphone. L'enregistreur ne filtre
 * rien : il demande au système une position par intervalle et garde tout ce
 * qui arrive, l'intelligence restant dans le pipeline d'analyse.
 */
export interface RecordingProfile {
  /** Intervalle demandé entre deux positions, en millisecondes. */
  intervalMs: number;
  /** Déplacement minimal avant une nouvelle position, en mètres ; 0 n'en impose aucun. */
  distanceFilterM: number;
  /**
   * Écart de temps de trace, en secondes, au-delà duquel les positions reçues
   * sont écrites dans le journal. C'est la perte maximale en cas d'arrêt brutal.
   */
  journalFlushS: number;
  /**
   * Vitesse système en dessous de laquelle une immobilité prolongée déclenche
   * la pause automatique, en m/s ; 0 la désactive.
   */
  autoPauseSpeedMs: number;
  /** Temps réel, en secondes, sous ce seuil avant que la pause se déclenche. */
  autoPauseDelayS: number;
  /**
   * Temps réel sans position, en secondes, au bout duquel le GPS est dit
   * perdu (alerte, son, notification ; `recording/gpsWatch.ts`).
   */
  gpsLostDelayS: number;
  /**
   * Temps réel, en secondes, pendant lequel le GPS revenu doit livrer ses
   * positions sans trou avant qu'une nouvelle perte soit signalée.
   */
  gpsLostRearmS: number;
  /**
   * Temps réel sans mesure lisible d'une ceinture qui en donnait, en secondes, au
   * bout duquel la fréquence cardiaque est dite perdue (`hooks/useRecorder.ts`).
   */
  beltLostDelayS: number;
  /** Temps réel de mesures revenues, en secondes, avant qu'une nouvelle perte de la FC soit signalée. */
  beltLostRearmS: number;
  /**
   * Temps réel depuis la dernière ligne du journal, en secondes, en deçà duquel
   * une application tuée puis rouverte propose « Continuer l'enregistrement »
   * (`recording/resume.ts`) ; au-delà, la session attend sa décision.
   */
  resumeOfferMaxAgeS: number;
}

/**
 * Identique pour tous les supports au départ : 1 Hz, sans filtre de distance.
 * Le 1 Hz tient aussi le coût du recalcul du vent (`docs/HISTORIQUE.md`, point 23).
 * Pause automatique sous 0,3 m/s (environ 1 km/h, sous le bruit GPS au repos)
 * pendant 60 s. GPS perdu après 1 min sans position, signalé de nouveau
 * seulement après 2 min de positions revenues (décision du 01/11).
 */
export const DEFAULT_RECORDING: RecordingProfile = {
  intervalMs: 1000,
  distanceFilterM: 0,
  journalFlushS: 10,
  autoPauseSpeedMs: 0.3,
  autoPauseDelayS: 60,
  gpsLostDelayS: 60,
  gpsLostRearmS: 120,
  beltLostDelayS: 60,
  beltLostRearmS: 120,
  resumeOfferMaxAgeS: 600,
};

/**
 * Surf : pause automatique coupée, l'attente au pic est immobile (reprise du
 * fractionné, retiré au lot 302). Le délai reste, pour qui la rallume.
 */
const SURF_RECORDING: RecordingProfile = { ...DEFAULT_RECORDING, autoPauseSpeedMs: 0 };

/**
 * Bateau (21/10) : pause automatique sous 0,2 km/h pendant 60 s, plus bas que
 * le défaut : un bord lent, sous 1 km/h, ne doit pas mettre la trace en pause.
 */
const BOAT_RECORDING: RecordingProfile = { ...DEFAULT_RECORDING, autoPauseSpeedMs: kmhToMs(0.2) };

/**
 * Ceinture cardio Bluetooth à l'enregistrement (`platform/heartRate.ts`) et
 * analyse de la FC (`core/heartRate.ts`), dans tous les sports.
 */
export interface HeartRateProfile {
  /**
   * Écart de temps au-delà duquel une mesure de la ceinture n'est plus jointe
   * à une position, en secondes : une ceinture émet environ une fois par seconde.
   */
  maxAgeS: number;
  /** Lissage de la FC, en secondes. */
  smoothS: number;
  /** Intervalle sans FC au-delà duquel c'est un trou, ni compté ni tracé, en secondes. */
  gapS: number;
  /** Temps couvert par la FC au-dessous duquel la session est dite sans FC, en secondes. */
  minCoverageS: number;
  /** Seuils S1 et S2, et zones 1 à 5 calées dessus (`heartRateZones`). */
  zoneModel: HeartRateZoneModel;
  /**
   * Décalage de S1 et de S2 pour ce calcul, en bpm, par rapport à la course
   * (Gemini, 25/10 : masse musculaire, posture, contraction) ; surchargeable
   * par activité dans Réglages, la Marche a le sien en pré-réglage.
   */
  thresholdOffsetBpm: number;
  /**
   * Coefficients de la charge par minute, de « sous Z1 » à Z5 : ceux d'Edwards
   * (1 à 5), plus le temps sous Z1, qui compte aussi (choix de l'utilisateur).
   */
  loadWeights: readonly number[];
  /** Temps actif à FC au-dessous duquel la dérive n'est pas donnée, en secondes. */
  driftMinS: number;
  /** Dérive sous laquelle la FC est dite stable, en %. */
  driftStablePct: number;
  /** Délai de la récupération d'une répétition, en secondes. */
  recoveryS: number;
  /** Durée d'un bloc du nuage FC / vitesse, en secondes. */
  scatterBlockS: number;
}

/**
 * Seuils et zones (25/10, d'après la synthèse demandée à Gemini) : S1 à 70 %
 * et S2 à 85 % de la réserve cardiaque (Karvonen), 78 et 89 % de la FC max
 * sans FC de repos. Z3 commence à S1, Z4 aux 2/3 de S1 à S2 (seuil lactique
 * stable), Z5 un peu au-dessus de S2. Z1 et Z2 sous S1, placées pour tomber
 * au même endroit avec et sans FC de repos (Z2 environ 15 bpm sous S1).
 */
export const HEART_RATE_ZONE_MODEL: HeartRateZoneModel = {
  reserveThresholds: [0.7, 0.85],
  maxThresholds: [0.78, 0.89],
  belowS1Reserve: [0.65, 0.85],
  belowS1Max: [0.77, 0.9],
  z4: 0.68,
  z5: 0.22,
};

const HEART_RATE: HeartRateProfile = {
  maxAgeS: 3,
  smoothS: 5,
  gapS: 10,
  minCoverageS: 60,
  zoneModel: HEART_RATE_ZONE_MODEL,
  thresholdOffsetBpm: 0,
  loadWeights: [0.5, 1, 2, 3, 4, 5],
  driftMinS: 20 * 60,
  driftStablePct: 5,
  recoveryS: 60,
  scatterBlockS: 30,
};

/**
 * Réglage cardio de référence, sans décalage (lot 187) : celui du Pratiquant (seuils et zones affichés dans Réglages
 * et dans Statistiques hors activité), et la base que chaque calcul décale de `thresholdOffsetBpm`. C'est le même
 * objet que celui de la course, qui reste la référence des décalages ; le transverse le lit ici, sans nommer un calcul.
 */
export const REFERENCE_HEART_RATE: HeartRateProfile = HEART_RATE;

/** Coefficients d'une équation de Keytel : débit en kJ/min = intercept + hr·FC + weight·poids + age·âge (bpm, kg, ans). */
export interface KeytelCoefficients {
  intercept: number;
  hr: number;
  weight: number;
  age: number;
}

/**
 * Énergie estimée par la FC (`core/hrEnergy.ts`), en voile et en surf, où la
 * vitesse ne dit rien de l'effort. Un ordre de grandeur : la formule n'est
 * validée sur aucun de ces sports (recherche du lot 96).
 */
export interface HrEnergyProfile {
  /** Équations sans VO2max, homme et femme ; sans sexe connu, la moyenne des deux. */
  keytel: { m: KeytelCoefficients; f: KeytelCoefficients };
  /** FC sous laquelle la formule n'est plus suivie : le débit retombe au repos, en bpm. */
  floorBpm: number;
  /** Plafond de la FC sans FC max saisie : base − âge + marge, en bpm. */
  ageHrMax: { baseBpm: number; marginBpm: number };
  /** Débit de repos (1 MET), en W par kg : jamais moins. */
  restWPerKg: number;
  /** Part du temps de session couverte par la FC à partir de laquelle le total est extrapolé à la session entière. */
  coverageForTotal: number;
  /** Arrondi de l'affichage, en kcal. */
  displayStepKcal: number;
}

/**
 * Keytel et al. 2005 (J Sports Sci 23(3):289-297, doi 10.1080/02640410470001730089),
 * sans VO2max, coefficients recoupés dans deux sources secondaires ; validée de
 * 18 à 45 ans, en effort stable. Plancher à 90 bpm : la formule n'est pas
 * testée au-dessous et s'effondre près du repos. Repos : 1 kcal/kg/h.
 */
const HR_ENERGY: HrEnergyProfile = {
  keytel: {
    m: { intercept: -55.0969, hr: 0.6309, weight: 0.1988, age: 0.2017 },
    f: { intercept: -20.4022, hr: 0.4472, weight: -0.1263, age: 0.074 },
  },
  floorBpm: 90,
  ageHrMax: { baseBpm: 220, marginBpm: 10 },
  restWPerKg: J_PER_KCAL / 3600,
  coverageForTotal: 0.8,
  displayStepKcal: 10,
};

/** Sauts mesurés par les capteurs du téléphone (`core/jumps.ts`) : voile, course, vélo. */
export interface JumpProfile {
  /** Hauteur minimale d'un saut montré, en mètres, surchargeable par activité. */
  defaultMinHeightM: number;
  detection: JumpDetection;
}

/**
 * Grille et verticale des capteurs, communes aux sauts et au pumping : pas de
 * la grille, trou toléré, repos qui amorce la gravité, filtre d'attitude.
 */
const ATTITUDE = {
  gridStepS: 0.01, maxGapS: 0.05,
  calmForceFraction: 0.15, calmRotationRadS: 0.3, minCalmS: 1,
  attitudeTauS: 3, attitudeMaxRotationRadS: 1.5, attitudeInitS: 1,
};

/**
 * Détection et mesure des sauts, communes aux supports qui sautent. Réglées sur
 * les séances de wingfoil du 08/10/2026, téléphone sur la poitrine : la séance
 * témoin ne donne aucun vol de 0,2 m, l'autre ses 10 sauts (0,66 à 1,72 m) et
 * rien d'autre au-dessus de 0,33 m. Les longs vols du kite restent à vérifier
 * sur une séance de kite. À pied et à vélo (VTT), les mêmes seuils écartent
 * la foulée (vol d'environ 0,1 s) ; ils restent à vérifier sur le terrain.
 * Rebonds (n° 27, 06/11) : sur les wings des 08/10 et 21/10, les 7 petits vols
 * de 0,20 à 0,37 m trouvés à 1 à 3 s d'un vrai saut (0,75 à 1,70 m) sont son
 * appel ou son rebond ; aucun vrai saut n'en a un autre à moins de 3 s.
 */
export const JUMP_DETECTION: JumpDetection = {
  ...ATTITUDE,
  smoothingS: 0.1, pushG: 0.4, pushSearchS: 0.5, landingG: 0.3, edgeSearchS: 0.05,
  minFlightS: 0.2, maxFlightS: 8, minFallG: 0.2, biasWindowS: 10,
  keepMinFlightS: 0.4, keepMinHeightM: 0.2, satelliteGapS: 3, satelliteHeightRatio: 0.5,
  pruneMinFlightS: 0.4, pruneMinHeightM: 0.15, pruneMarginS: 15, pruneChunkS: 300, pruneChunkMarginS: 20,
  dubiousBallisticFactor: 1.1, saturationFraction: 0.98, doubtMarginS: 2, attitudeMaxErrorM: 0.1,
  curveStepS: 0.05, curveMarginS: 0.5,
};

/**
 * Pumping sur foil, téléphone sur la poitrine (point 104) : verticale calculée
 * comme pour les sauts ; coups, séries et décollage provisoires, à régler sur
 * une première session réelle. Cadence qui valide une série (lot 50) : fenêtre
 * de 6 s, corrélation 0,5, de 40 à 130 coups par minute, provisoires aussi (n° 27).
 */
const PUMP_DETECTION: PumpDetection = {
  ...ATTITUDE,
  strokeSmoothingS: 0.15, strokeBaselineS: 2, strokeMinG: 0.12, strokeMinPeriodS: 0.3, strokeMaxGapS: 2.5, minSeriesStrokes: 3,
  seriesEdgeGapRatio: Infinity, jumpMaskBeforeS: 0.5, jumpMaskAfterS: 1,
  cadenceGridS: 0.05, cadenceWindowS: 6, cadenceStepS: 0.5, cadenceMinCorrelation: 0.5, cadencePeakFraction: 0.85,
  cadenceMinCoverage: 0.5, cadenceMinPerMin: 40, cadenceMaxPerMin: 130,
  liftoffHighPassS: 0.1, liftoffRoughWindowS: 0.5, liftoffCalmG: 0.08, liftoffCalmS: 1.5,
  liftoffSearchBeforeS: 10, liftoffSearchAfterS: 5,
  pruneCapture: false, pruneMarginS: 30,
  // Le surf a ses vols à lui (`SurfFlight`) : tous listés.
  minFlightS: 0,
};

/**
 * Pumping en voile sur foil (wing, planche, kite ; lot 22, décision du 28/10) :
 * ceux du surf, réglés le 06/11 sur la wing du 02/11, capturée entière (n° 27).
 * Deux groupes bien séparés : les vrais coups de 90 à 130 par minute, amples et
 * réguliers ; le clapot de 20 à 70, trois fois plus faible ; presque rien entre
 * les deux, d'où le bas de la plage à 75. Le haut à 150 laisse de la marge, aucun
 * coup plus rapide n'ayant été capté. Une série compte 5 coups au moins (règle
 * de l'utilisateur : « 4 ou 5 coups bien marqués »). Le seuil de coup reste bas :
 * le relever perd de vrais coups sans rien écarter de plus. Pas d'élagage propre
 * au pumping : Pumping coché, la capture est rangée entière
 * (`keepsWholeCaptureForPumping`). Un vol est une suite au-dessus du seuil
 * d'activité ; ceux de moins de 10 s ne sont pas listés (`minFlightS`).
 */
const SAILING_PUMP_DETECTION: PumpDetection = {
  ...PUMP_DETECTION,
  cadenceMinPerMin: 75, cadenceMaxPerMin: 150, minSeriesStrokes: 5, seriesEdgeGapRatio: 1.4,
  minFlightS: 10,
};

/** Libellé du ratio de temps actif d'une session sur foil, quel que soit le calcul. */
export const FOIL_RATIO_LABEL = 'Ratio de vol';

/**
 * Analyse d'une session de surf (`surfing/`, §10, point 97) : vagues, rame,
 * attente, vols sur foil. Les seuils de vitesse de la vague et du vol sont le
 * seuil d'activité (`defaultActiveThreshold`, `foilActiveThreshold`) ; le
 * reste est ici. Défauts provisoires, à valider sur des sessions réelles.
 */
export interface SurfProfile {
  /** Arrêt plus court ignoré (canard, série qui passe) : pas encore l'attente au pic, en secondes. */
  minWaitS: number;
  /** Vague plus courte écartée, en secondes… */
  minWaveS: number;
  /** …ou plus courte que cette distance, en mètres. */
  minWaveM: number;
  /** Rame de départ : le mouvement continu qui précède la vague, cherché au plus cette durée, en secondes. */
  takeoffSearchS: number;
  /** Seuil de vol sur foil, dans `thresholdUnit` : le seuil d'activité par défaut d'une session sur foil. */
  foilActiveThreshold: number;
  /** Seuil de vague sur foil, dans `thresholdUnit` : au-dessus, le vol est porté par une vague ; en dessous, il est pompé. */
  foilWaveThreshold: number;
  /** Changement de direction compté par le GPS : rotation d'au moins cette valeur depuis l'extrême précédent, en degrés. */
  turnMinDeg: number;
  /** Virages mesurés par le gyroscope du téléphone (`surfing/gyroTurns.ts`). */
  gyroTurns: GyroTurnDetection;
}

/**
 * Virages d'une vague vus par le gyroscope, téléphone sur la poitrine : la
 * verticale comme pour les sauts et le pumping (`core/imuVertical.ts`), puis la
 * rotation du buste autour d'elle.
 */
export interface GyroTurnDetection extends AttitudeParams {
  /** Virage compté : rotation d'au moins cette valeur depuis l'extrême précédent, en degrés. */
  minDeg: number;
  /** …et seulement si la rotation lissée a atteint cette vitesse pendant le virage, en °/s : le buste qui tourne, pas une dérive lente. */
  minRateDegS: number;
  /** Largeur de la moyenne glissante de la vitesse de rotation, en secondes. */
  smoothingS: number;
  /** Mesures lues avant et après la vague pour la verticale, en secondes : le filtre est déjà posé au départ de la vague. */
  leadS: number;
}

export interface SportProfile {
  id: SportType;
  label: string;
  /** Unité d'affichage principale des vitesses. */
  speedUnit: SpeedUnit;
  /** Unité dans laquelle le seuil d'activité est saisi, stocké et comparé. */
  thresholdUnit: SpeedUnit;
  /**
   * Calcul sans seuil d'activité (bateau, 21/10) : toute la session compte en
   * navigation, sans temps actif, ratio ni moyenne active ; la réussite des
   * manœuvres se lit à ce seuil fixe, non réglable, dans `thresholdUnit`.
   * `null` : seuil d'activité réglable (`defaultActiveThreshold`).
   */
  withoutActiveThreshold: { maneuverSuccess: number } | null;
  /**
   * Seuil séparant « en action » de « à l'arrêt », exprimé dans `thresholdUnit`.
   * Selon l'activité il correspond au début de vol, au début de planing ou à
   * la sortie de l'arrêt : ces notions ne se recouvrent pas, d'où un réglage
   * par support.
   */
  defaultActiveThreshold: number;
  /**
   * Écarts appliqués au seuil pour obtenir les deux détentes.
   * Démarrage au-dessus de seuil + `enterOffset`, arrêt en dessous de
   * seuil + `exitOffset`, ce dernier étant négatif. Quand seuil + `exitOffset`
   * n'est pas positif (seuil bas, la marche à 0,5 km/h), l'arrêt se fait sous
   * seuil × `EXIT_FLOOR_RATIO` : la détente basse n'est jamais nulle
   * (`getActiveThresholds`).
   */
  activeHysteresis: { enterOffset: number; exitOffset: number };
  /**
   * Plancher d'arrêt, dans `thresholdUnit` : quand aucun seuil d'activité
   * n'est réglé (seuil 0), un arrêt complet est ôté d'office du temps en
   * mouvement sous ce plancher (décision du 27/10). En bateau, sans seuil, il
   * ne sert qu'à juger un trou de la trace immobile.
   */
  stillThreshold: number;
  /** Pas plus long que cette durée : trou de la trace (arrêt sans point, GPS perdu), en secondes. */
  maxGapS: number;
  /**
   * Vitesse max : la meilleure moyenne sur cette durée, en secondes, partout
   * (voile, vagues du surf, résumé de la bibliothèque ; Q34, lot 81), jamais
   * le pic d'un point (`bestWindowSpeedMs`).
   */
  maxSpeedWindowS: number;
  /** Durée de confirmation avant tout changement d'état d'activité, en secondes. */
  minStateDurationS: number;
  /** Largeur du filtre médian appliqué à la vitesse, en secondes. */
  medianWindowSeconds: number;
  /**
   * Détour maximal par un point, en fois le chemin direct entre ses voisins :
   * au-delà, si la vitesse qu'il donne est impossible, sa position a sauté
   * (`detourSpikes`). Rapport sans dimension, le même pour tous les supports.
   */
  maxDetourRatio: number;
  /**
   * Vitesse maximale physiquement plausible pour ce support, en m/s. Au-delà,
   * c'est une aberration GPS, quelle que soit l'accélération qui y mène.
   */
  maxPlausibleSpeedMs: number;
  /** Vitesse minimale, dans `thresholdUnit`, pour qu'un point alimente le diagramme polaire. */
  defaultPolarMinSpeed: number;
  /**
   * Bornes de couleur de la trace du calcul, en m/s, à défaut de pré-réglage et
   * de réglage ; en voile, celles d'une trace trop courte pour suggérer les siennes.
   */
  speedRange: SpeedRangeMs;
  /**
   * Couleurs suggérées selon l'allure de chaque session tant que le pré-réglage
   * n'en fixe pas (voile, sauf le bateau) ; le seuil d'activité de même.
   */
  speedRangeFollowsPace: boolean;
  /**
   * Libellé du ratio de temps actif, propre au vocabulaire du support, hors
   * foil : sur foil, c'est `FOIL_RATIO_LABEL` (`activeRatioLabel`).
   */
  activeRatioLabel: string;
  /**
   * Support sur foil par défaut. Surchargeable par activité (Réglages) et par
   * session (onglet réglages de l'analyse) ; sans objet hors voile.
   */
  foilDefault: boolean;
  /** Réglage du dénivelé. */
  elevation: ElevationProfile;
  /**
   * Cibles de recherche des meilleurs segments. L'onglet « tops » est natif en
   * voile et à vélo, générique à pied et en surf (`core/analysisTabs.ts`).
   */
  topTargets: readonly TopTarget[];
  /** Réglage de l'enregistrement GPS. */
  recording: RecordingProfile;
  /** Sauts mesurés par les capteurs du téléphone ; `null` en bateau, en fractionné et en surf. */
  jumps: JumpProfile | null;
  /** Ceinture cardio proposée à l'enregistrement et analyse de la FC, dans tous les sports. */
  heartRate: HeartRateProfile;
  /**
   * Énergie estimée par la FC, dans l'onglet « cardio » : voile et surf seulement ;
   * `null` à pied, à vélo et en Entraînement, où l'énergie mécanique reste seule.
   */
  hrEnergy: HrEnergyProfile | null;
  /** Analyse des vagues ; `null` hors surf. */
  surf: SurfProfile | null;
  /**
   * Pumping sur foil, mesuré par les capteurs du téléphone (`core/pumping.ts`) :
   * surf (point 104) et voile sur foil (lot 22) ; `null` en bateau, à pied, à vélo.
   */
  pump: PumpDetection | null;
}

/** Cibles de tops utilisées par tous les supports à voile ; leurs clés font le type des tops de la voile (`SailingTopKey`). */
export const SAILING_TOP_TARGETS = [
  { key: 't2s', label: '2 s', value: 2, kind: 'time' },
  { key: 't5s', label: '5 s', value: 5, kind: 'time' },
  { key: 't10s', label: '10 s', value: 10, kind: 'time' },
  { key: 'd100m', label: '100 m', value: 100, kind: 'distance' },
  { key: 'd500m', label: '500 m', value: 500, kind: 'distance' },
  { key: 'd1000m', label: '1000 m', value: 1000, kind: 'distance' },
  { key: 'd1NM', label: '1 mille', value: METERS_PER_DISTANCE_UNIT.nm, kind: 'distance' },
] as const satisfies readonly TopTarget[];

/** Clé d'une cible de tops de la voile (`t2s` … `d1NM`). */
export type SailingTopKey = (typeof SAILING_TOP_TARGETS)[number]['key'];

/**
 * Cibles de tops de la famille surf (surf, paddle, SUP foil, kayak,
 * downwind) : la pointe et la glisse d'une vague, les distances du kayak
 * (200, 500, 1000 m) et celles d'un downwind. Onglet caché tant que
 * l'activité ne le coche pas dans Réglages.
 */
export const SURF_TOP_TARGETS: TopTarget[] = [
  { key: 't2s', label: '2 s', value: 2, kind: 'time' },
  { key: 't10s', label: '10 s', value: 10, kind: 'time' },
  { key: 't1min', label: '1 min', value: 60, kind: 'time' },
  { key: 't10min', label: '10 min', value: 600, kind: 'time' },
  { key: 'd100m', label: '100 m', value: 100, kind: 'distance' },
  { key: 'd200m', label: '200 m', value: 200, kind: 'distance' },
  { key: 'd500m', label: '500 m', value: 500, kind: 'distance' },
  { key: 'd1km', label: '1 km', value: 1000, kind: 'distance' },
  { key: 'd5km', label: '5 km', value: 5000, kind: 'distance' },
  { key: 'd10km', label: '10 km', value: 10000, kind: 'distance' },
];

/** Réglages communs à tous les calculs, surchargés au cas par cas. */
const COMMON_DEFAULTS = {
  maxGapS: MAX_GAP_S,
  maxSpeedWindowS: 2,
  maxDetourRatio: DEFAULT_MAX_DETOUR_RATIO,
  withoutActiveThreshold: null,
  speedRangeFollowsPace: false,
  elevation: ELEVATION_PRESETS.route,
  foilDefault: false,
  recording: DEFAULT_RECORDING,
};

/**
 * Profil d'une session sans calcul connu (`sport` null : fiche non classée, lot 187) pour le peu que son résumé
 * calcule : dénivelé, fenêtre de la vitesse max et FC. Les valeurs communes à tous les calculs, et le cardio de
 * référence : le même résumé qu'avec le calcul de la course, qui tenait ce rôle avant (test d'identité).
 */
export const UNCLASSIFIED_PROFILE: Pick<SportProfile, 'elevation' | 'maxSpeedWindowS' | 'heartRate'> = {
  elevation: COMMON_DEFAULTS.elevation,
  maxSpeedWindowS: COMMON_DEFAULTS.maxSpeedWindowS,
  heartRate: HEART_RATE,
};

/** Réglages communs aux supports à voile, surchargés au cas par cas. */
const SAILING_DEFAULTS = {
  ...COMMON_DEFAULTS,
  // Gris sous 8 nœuds, rouge franc à partir de 28 ; en voile, la suggestion tirée de l'allure prime.
  speedRange: { minMs: knotsToMs(8), maxMs: knotsToMs(28) },
  speedRangeFollowsPace: true,
  speedUnit: 'kn' as SpeedUnit,
  thresholdUnit: 'kn' as SpeedUnit,
  activeHysteresis: { enterOffset: 0.5, exitOffset: -1 },
  stillThreshold: 1,
  minStateDurationS: 0,
  medianWindowSeconds: 3,
  // 30 m/s font 58 nœuds : hors de portée en session ordinaire.
  maxPlausibleSpeedMs: 30,
  defaultPolarMinSpeed: 5,
  topTargets: SAILING_TOP_TARGETS,
  heartRate: HEART_RATE,
  hrEnergy: HR_ENERGY,
  surf: null,
  pump: SAILING_PUMP_DETECTION,
};

/** Seuils cardio d'un calcul décalés de `offsetBpm` par rapport à la course. */
const heartRateOffset = (offsetBpm: number): HeartRateProfile => ({ ...HEART_RATE, thresholdOffsetBpm: offsetBpm });

/**
 * Surf : pause automatique coupée, l'attente au pic est immobile. Seuil de
 * vague à 9 km/h (entrée à 10, sortie à 7) : la rame la plus vive reste sous
 * 7 km/h, une vague se surfe au-dessus de 10. Sur foil, le vol commence à
 * 11 km/h et finit sous 8 ; il est porté par une vague au-dessus de 18 km/h,
 * pompé en dessous. Valeurs de départ, à valider sur des sessions réelles.
 */
const SURF_PROFILE: SportProfile = {
  ...COMMON_DEFAULTS,
  id: 'surf',
  label: 'Surf',
  // 5 à 30 km/h : la rame, sous 5 km/h, reste grise ; la vague ressort en couleur.
  speedRange: { minMs: kmhToMs(5), maxMs: kmhToMs(30) },
  speedUnit: 'kmh',
  thresholdUnit: 'kmh',
  defaultActiveThreshold: 9,
  activeHysteresis: { enterOffset: 1, exitOffset: -2 },
  stillThreshold: 2,
  minStateDurationS: 0,
  medianWindowSeconds: 3,
  // 20 m/s font 72 km/h, au-delà d'une grosse vague ordinaire.
  maxPlausibleSpeedMs: 20,
  defaultPolarMinSpeed: 0,
  activeRatioLabel: 'Ratio sur la vague',
  topTargets: SURF_TOP_TARGETS,
  recording: SURF_RECORDING,
  jumps: null,
  heartRate: heartRateOffset(-10),
  hrEnergy: HR_ENERGY,
  surf: {
    minWaitS: 10, minWaveS: 3, minWaveM: 15, takeoffSearchS: 15,
    foilActiveThreshold: 10, foilWaveThreshold: 18, turnMinDeg: 60,
    // Valeurs provisoires, à régler sur une vraie sortie avec des vagues (essai 46).
    gyroTurns: { ...ATTITUDE, minDeg: 60, minRateDegS: 30, smoothingS: 0.3, leadS: 2 },
  },
  pump: PUMP_DETECTION,
};

export const SPORT_PROFILES: Record<SportType, SportProfile> = {
  wingfoil: {
    ...SAILING_DEFAULTS,
    id: 'wingfoil',
    label: 'Wingfoil',
    defaultActiveThreshold: 8,
    // Sans foil (case décochée), un wing se dit « en navigation » ; sur foil, « Ratio de vol ».
    activeRatioLabel: 'Ratio de navigation',
    foilDefault: true,
    heartRate: heartRateOffset(-8),
    jumps: { defaultMinHeightM: 0.5, detection: JUMP_DETECTION },
  },
  windsurf: {
    ...SAILING_DEFAULTS,
    id: 'windsurf',
    label: 'Planche à voile',
    defaultActiveThreshold: 10,
    activeRatioLabel: 'Ratio de planing',
    heartRate: heartRateOffset(-5),
    jumps: { defaultMinHeightM: 0.5, detection: JUMP_DETECTION },
  },
  kite: {
    ...SAILING_DEFAULTS,
    id: 'kite',
    label: 'Kitesurf',
    defaultActiveThreshold: 8,
    activeRatioLabel: 'Ratio de navigation',
    heartRate: heartRateOffset(-8),
    jumps: { defaultMinHeightM: 1, detection: JUMP_DETECTION },
  },
  bateau: {
    ...SAILING_DEFAULTS,
    id: 'bateau',
    label: 'Bateau',
    // Sans seuil (21/10) : un bord peut passer sous 1 nœud ; une manœuvre sous 1 nœud est ratée.
    defaultActiveThreshold: 1,
    withoutActiveThreshold: { maneuverSuccess: 1 },
    defaultPolarMinSpeed: 2,
    // Couleurs de 1 à 15 nœuds, fixes, plutôt que selon l'allure (21/10).
    speedRange: { minMs: knotsToMs(1), maxMs: knotsToMs(15) },
    speedRangeFollowsPace: false,
    recording: BOAT_RECORDING,
    activeRatioLabel: 'Ratio de navigation',
    // Voile au rappel, comme la planche (25/10).
    heartRate: heartRateOffset(-5),
    jumps: null,
    // Ni foil pompé ni capteurs du pumping.
    pump: null,
  },
  surf: SURF_PROFILE,
};

/** Supports dont l'analyse repose sur le vent. */
export const SAILING_SPORTS: SportType[] = ['wingfoil', 'windsurf', 'kite', 'bateau'];

export const getSportProfile = (sport: SportType): SportProfile => SPORT_PROFILES[sport];

/** Vrai si la valeur est l'identifiant d'un calcul de support (lecture d'une fiche, d'un journal, d'un nom de fichier). */
export const isSportType = (value: unknown): value is SportType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPORT_PROFILES, value);

/**
 * Seuil d'activité par défaut d'un calcul, dans `thresholdUnit`. En surf, il dépend du foil : le
 * seuil de vague sans lui, le seuil de vol avec (point 97). En voile, le foil n'y touche pas.
 */
export const defaultActiveThresholdOf = (profile: SportProfile, foil: boolean): number =>
  foil && profile.surf ? profile.surf.foilActiveThreshold : profile.defaultActiveThreshold;

/**
 * Calcul au seuil d'activité réglable : tous sauf le bateau (`withoutActiveThreshold`).
 * Un seuil réglé à 0 veut dire « aucun seuil réglé » ; les arrêts complets sont
 * pourtant ôtés d'office, sous le plancher `stillThreshold` (`thresholdActivityMask`).
 */
export const hasActiveThreshold = (profile: SportProfile): boolean => profile.withoutActiveThreshold === null;

/** Libellé du ratio de temps actif d'une session : « Ratio de vol » sur foil, sinon celui du calcul. */
export const activeRatioLabel = (profile: SportProfile, foil: boolean): string =>
  foil ? FOIL_RATIO_LABEL : profile.activeRatioLabel;

/**
 * Traitement d'un calcul : la façon dont ses sessions se calculent et
 * s'affichent (unités, chiffres du direct, onglets, module d'analyse). À ne
 * pas confondre avec la famille, qui les range ; les deux portent les mêmes
 * noms depuis le retrait de la terre (lot 305).
 */
export type Treatment = 'voile' | 'surf';

/**
 * Famille d'un calcul : où ses sessions se rangent (bibliothèque, accueil,
 * barre de navigation, listes d'activités, Réglages).
 */
export type SportFamily = 'voile' | 'surf';

/** Les familles, dans l'ordre de l'interface. */
export const SPORT_FAMILIES: SportFamily[] = ['voile', 'surf'];

const SPORT_TREATMENT: Record<SportType, Treatment> = {
  wingfoil: 'voile',
  windsurf: 'voile',
  kite: 'voile',
  bateau: 'voile',
  surf: 'surf',
};

const SPORT_FAMILY: Record<SportType, SportFamily> = {
  wingfoil: 'voile',
  windsurf: 'voile',
  kite: 'voile',
  bateau: 'voile',
  surf: 'surf',
};

export const sportTreatment = (sport: SportType): Treatment => SPORT_TREATMENT[sport];

export const sportFamily = (sport: SportType): SportFamily => SPORT_FAMILY[sport];

/**
 * Famille qui navigue sur un parcours de balises (voile, surf) : itinéraire
 * de balises numérotées en ligne droite, validées dans l'ordre avec des bips
 * d'approche. Le vent, les bords et les manœuvres restent propres à la voile.
 */
export const usesMarkCourse = (family: SportFamily): boolean => family === 'voile' || family === 'surf';

/** Calculs d'une famille, dans l'ordre de `SPORT_PROFILES`. */
export const familySports = (family: SportFamily): SportType[] =>
  (Object.keys(SPORT_PROFILES) as SportType[]).filter((sport) => SPORT_FAMILY[sport] === family);

/**
 * Détente basse d'un seuil plus petit que l'écart `exitOffset`, en fois le
 * seuil (rapport sans dimension, règle 4) : sans elle, la détente vaudrait 0 et
 * le masque d'activité ne sortirait plus jamais une fois entré (27/10).
 */
export const EXIT_FLOOR_RATIO = 0.5;

/**
 * Les deux détentes du seuil d'activité, dans l'unité du profil. La détente
 * basse vaut seuil + `exitOffset` si elle reste positive, sinon seuil ×
 * `EXIT_FLOOR_RATIO` ; un seuil de 0 donne une détente basse nulle.
 */
export const getActiveThresholds = (
  profile: SportProfile,
  threshold: number
): { enter: number; exit: number } => {
  const exit = threshold + profile.activeHysteresis.exitOffset;
  return {
    enter: threshold + profile.activeHysteresis.enterOffset,
    exit: exit > 0 ? exit : threshold * EXIT_FLOOR_RATIO,
  };
};
