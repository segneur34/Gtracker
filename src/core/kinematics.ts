import { firstIndexAfter, firstIndexAtOrAfter } from './search';
import { median } from './basics';
import { haversineDistance, initialBearing } from './geo';
import {
  DEFAULT_MAX_ACCELERATION,
  DEFAULT_MEDIAN_WINDOW_S,
  clampByAccelerationFrom,
  medianFilterByTimeFrom,
} from './speedFilter';
import type { RawTrackPoint, SpeedSource, TrackPoint } from './types';
import { MS_TO_KMH, MS_TO_KNOTS } from './units';

/** Convertit un horodatage de point en millisecondes depuis l'époque. */
export const pointTimeMs = (time: string | Date): number =>
  typeof time === 'string' ? new Date(time).getTime() : time.getTime();

/** Date d'un point brut, en millisecondes : celle lue une fois (`rawTimeMs`), sinon relue de `time`. */
export const rawPointTimeMs = (point: Pick<RawTrackPoint, 'time' | 'rawTimeMs'>): number =>
  point.rawTimeMs ?? pointTimeMs(point.time);

/**
 * Dates des points, en millisecondes, avec les points d'une même date répartis
 * régulièrement jusqu'à la date suivante. Certaines applications tronquent
 * l'heure à la seconde : à 5 Hz, cinq points partagent alors la même date, les
 * quatre pas de durée nulle n'ont pas de vitesse et celui qui franchit la
 * seconde ne porte qu'un cinquième du chemin. Une suite de `n` points
 * de date `T` suivie d'une date `T' > T` prend `T + k × (T' − T) / n` ; un point
 * à la même position que le précédent de la suite (vrai doublon) garde la date
 * de celui-ci, son pas reste nul. La dernière suite de la trace s'étale sur
 * l'écart qui la précède ; rien si elle commence la trace. Des points sans
 * position (FC seule) passent pour des doublons : leurs dates restent égales.
 */
export const spreadEqualTimes = (
  points: ReadonlyArray<{ lat?: number; lon?: number }>,
  timesMs: readonly number[]
): number[] => {
  const spread = timesMs.slice();
  let start = 0;
  while (start < timesMs.length) {
    let end = start + 1;
    while (end < timesMs.length && timesMs[end] === timesMs[start]) end++;
    const n = end - start;
    if (n >= 2) {
      const t = timesMs[start];
      let spanMs = 0;
      if (end < timesMs.length) spanMs = timesMs[end] > t ? timesMs[end] - t : 0;
      else if (start >= 1 && t > timesMs[start - 1]) spanMs = t - timesMs[start - 1];
      if (spanMs > 0) {
        for (let k = 1; k < n; k++) {
          const i = start + k;
          const same = points[i].lat === points[i - 1].lat && points[i].lon === points[i - 1].lon;
          spread[i] = same ? spread[i - 1] : t + (k * spanMs) / n;
        }
      }
    }
    start = end;
  }
  return spread;
};

/** Unité dans laquelle un fichier exprime la vitesse de l'appareil. */
export type DeviceSpeedUnit = 'ms' | 'kmh' | 'kn';

/** Facteur multiplicatif pour ramener une vitesse appareil en m/s. */
export const DEVICE_SPEED_FACTOR: Record<DeviceSpeedUnit, number> = {
  ms: 1,
  kmh: 1 / MS_TO_KMH,
  kn: 1 / MS_TO_KNOTS,
};

/** Nombre minimal de points comparables pour trancher sur l'unité. */
const UNIT_DETECTION_MIN_SAMPLES = 10;
/** Vitesse dérivée minimale, en m/s, pour qu'un point serve à la détection. */
const UNIT_DETECTION_MIN_DERIVED_MS = 1;

/** Unité dont le facteur explique le mieux le rapport médian. */
const unitFromRatio = (ratio: number): DeviceSpeedUnit => {
  let best: DeviceSpeedUnit = 'ms';
  let bestDistance = Infinity;
  for (const unit of Object.keys(DEVICE_SPEED_FACTOR) as DeviceSpeedUnit[]) {
    // Comparaison en logarithme : un rapport de 3,6 est aussi loin de 1 que
    // 1 l'est de 0,28, ce qui rend le choix symétrique.
    const distance = Math.abs(Math.log(ratio) - Math.log(1 / DEVICE_SPEED_FACTOR[unit]));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = unit;
    }
  }
  return best;
};

/**
 * Devine l'unité de la vitesse fournie par l'appareil.
 *
 * La norme GPX veut des m/s, mais certaines applications écrivent des km/h,
 * plus rarement des nœuds. Lue en m/s, une vitesse en km/h paraît 3,6 fois
 * trop grande : toute la trace passe pour un sprint. On compare la vitesse
 * de l'appareil à la vitesse dérivée des positions, dont l'unité est sûre, et
 * on retient l'unité dont le facteur explique le mieux le rapport médian.
 */
export const detectDeviceSpeedUnit = (
  deviceSpeedsMs: (number | undefined)[],
  derivedSpeedsMs: number[]
): DeviceSpeedUnit => {
  const ratios: number[] = [];
  for (let i = 0; i < deviceSpeedsMs.length; i++) {
    const device = deviceSpeedsMs[i];
    const derived = derivedSpeedsMs[i];
    if (device === undefined || device <= 0 || derived < UNIT_DETECTION_MIN_DERIVED_MS) continue;
    ratios.push(device / derived);
  }
  if (ratios.length < UNIT_DETECTION_MIN_SAMPLES) return 'ms';

  return unitFromRatio(median(ratios));
};

/** Unité de la vitesse appareil d'une trace brute, ou `null` si elle n'en porte pas. */
export const detectTrackDeviceSpeedUnit = (points: RawTrackPoint[]): DeviceSpeedUnit | null => {
  if (!points.some((p) => p.speedMs !== undefined)) return null;
  const timesMs = spreadEqualTimes(points, points.map(rawPointTimeMs));
  const derived: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dt = (timesMs[i] - timesMs[i - 1]) / 1000;
    derived.push(
      dt > 0
        ? haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon) / dt
        : 0
    );
  }
  return detectDeviceSpeedUnit(points.map((p) => p.speedMs), derived);
};

/**
 * Détour maximal par un point, en fois le chemin direct entre ses voisins.
 * Au-delà, et si la vitesse qu'il donne est impossible, la position a sauté.
 */
export const DEFAULT_MAX_DETOUR_RATIO = 3;

/** Plancher du chemin direct, en mètres : à l'arrêt, les voisins se confondent. */
const DETOUR_FLOOR_M = 1;

/**
 * Indices des points dont la position a sauté puis est revenue : le détour par
 * le point dépasse `maxDetourRatio` fois le chemin direct entre ses voisins, et
 * la vitesse d'entrée ou de sortie s'écarte de la vitesse directe de plus que
 * `maxAccel`. Le rapport ne dépend ni de la cadence ni de l'allure, et le test
 * ne regarde que les deux voisins, quel que soit leur écart de temps : un point
 * déplacé suivi d'un trou échappe à `clampByAcceleration`, qui cherche le
 * retour dans les 3 s (session Komoot à 41 nd). La seconde condition
 * garde un vrai demi-tour serré, parcouru à vitesse constante. Deux points de
 * suite ne sont jamais écartés : le suivant d'un point écarté est sauté. Un
 * point de reprise après une pause (`segmentStart`), ou qui la précède, n'est
 * pas testé : son pas enjambe la pause.
 */
export const detourSpikes = (
  points: { lat: number; lon: number; segmentStart?: boolean }[],
  timesMs: number[],
  maxDetourRatio: number = DEFAULT_MAX_DETOUR_RATIO,
  maxAccel: number = DEFAULT_MAX_ACCELERATION
): number[] => detourSpikesFrom(points, timesMs, maxDetourRatio, maxAccel, 1, false, null);

/**
 * `detourSpikes` à partir du point `from` ; `skipFirst` : le point d'avant
 * est un saut, `from` est sauté comme son suivant. Sert à la reprise d'un
 * calcul (`resumeKinematics`). `chordsM` : cordes des pas déjà calculées
 * (`chordsM[i]` du point `i - 1` au point `i`), sinon recalculées.
 */
const detourSpikesFrom = (
  points: { lat: number; lon: number; segmentStart?: boolean }[],
  timesMs: number[],
  maxDetourRatio: number,
  maxAccel: number,
  from: number,
  skipFirst: boolean,
  chordsM: ArrayLike<number> | null
): number[] => {
  const spikes: number[] = [];
  for (let i = skipFirst ? from + 1 : from; i < points.length - 1; i++) {
    if (points[i].segmentStart || points[i + 1].segmentStart) continue;
    const dtIn = (timesMs[i] - timesMs[i - 1]) / 1000;
    const dtOut = (timesMs[i + 1] - timesMs[i]) / 1000;
    if (dtIn <= 0 || dtOut <= 0) continue;
    const [p0, p1, p2] = [points[i - 1], points[i], points[i + 1]];
    const inM = chordsM ? chordsM[i] : haversineDistance(p0.lat, p0.lon, p1.lat, p1.lon);
    const outM = chordsM ? chordsM[i + 1] : haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    const directM = haversineDistance(p0.lat, p0.lon, p2.lat, p2.lon);
    if ((inM + outM) / Math.max(directM, DETOUR_FLOOR_M) <= maxDetourRatio) continue;
    const directMs = directM / (dtIn + dtOut);
    const accel = Math.max((inM / dtIn - directMs) / dtIn, (outM / dtOut - directMs) / dtOut);
    if (accel <= maxAccel) continue;
    spikes.push(i);
    i++;
  }
  return spikes;
};

export interface KinematicsOptions {
  /** Largeur du filtre médian appliqué à la vitesse, en secondes. */
  medianWindowSeconds?: number;
  /** Détour maximal par un point, en fois le chemin direct entre ses voisins (`detourSpikes`). */
  maxDetourRatio?: number;
  /** Accélération maximale plausible, en m/s². */
  maxAcceleration?: number;
  /** Vitesse maximale plausible pour le support, en m/s. */
  maxSpeedMs?: number;
  /** Ignorer la vitesse de l'appareil et toujours dériver depuis les positions. */
  forceDerivedSpeed?: boolean;
  /**
   * Pas plus long que cette durée : trou de la trace, en secondes (`SportProfile.maxGapS`).
   * Défaut `Infinity` : sans profil, aucun pas n'est un trou.
   */
  maxGapS?: number;
}

/**
 * Pas d'un trou de la trace : sa distance est bornée par la corde du pas
 * multipliée par ce facteur, sans dimension. La vitesse lue à la
 * reprise ne dit rien de ce qui s'est passé pendant le trou : intégrée sur
 * toute sa durée, une reprise à 20 nœuds après 45 min d'arrêt ajouterait 27 km.
 */
export const GAP_CHORD_FACTOR = 1.5;

/** Pas plus court que cette corde, en mètres : positions identiques, le pas n'a pas de cap. */
const NULL_STEP_M = 0.01;

/**
 * Mémoire d'un calcul de cinématique, pour le reprendre sur la même trace
 * prolongée (`resumeKinematics`, direct de l'enregistrement) : les points,
 * la trace rendue, les étapes intermédiaires, et d'où les refaire. Une
 * reprise prolonge ses tableaux sur place : elle la consomme.
 */
export interface KinematicsRun {
  points: RawTrackPoint[];
  track: TrackPoint[];
  options: KinematicsOptions;
  useDeviceSpeed: boolean;
  rawTimesMs: number[];
  timesMs: number[];
  chordsM: number[];
  /** Vitesse dérivée et cap de chaque pas, avant reprise de pause et sauts de position. */
  derivedRaw: number[];
  bearingsRaw: number[];
  /** Les mêmes après reprise de pause, trous et pas nuls, avant les sauts de position. */
  derivedAdjusted: number[];
  bearingsAdjusted: number[];
  /** Premier indice dont le cap, reprise de pause et trous faits, est connu ; -1 s'il n'y en a pas. */
  firstBearingAt: number;
  /** Les mêmes, sauts de position compris : ceux de la trace. */
  derivedSpeeds: number[];
  bearings: number[];
  /** Points dont la position a sauté (`detourSpikes`), croissants. */
  spikes: number[];
  rawSpeeds: number[];
  clamped: number[];
  smoothed: number[];
  unit: DeviceSpeedUnit;
  /** Rapports vitesse appareil / dérivée des points figés (indices < `ratiosUpTo`), triés. */
  sortedRatios: number[];
  ratiosUpTo: number;
  /** Début de la dernière suite de dates égales : avant, les dates réparties sont figées. */
  tailStart: number;
  /** Premier indice dont les étapes locales sont à refaire à la reprise (au moins 3, sinon tout est refait). */
  resumeFrom: number;
  /** Indice de reprise de l'écrêtage à la reprise ; -1 : tout l'écrêtage est à refaire. */
  clampRestart: number;
  /**
   * Nombre de points de `track` que la prochaine reprise gardera tels quels
   * (mêmes objets), si elle ne refait pas tout : ce qui ne dépend que d'eux
   * peut être gardé d'un calcul à l'autre, tant que `track[frozenUpTo - 1]`
   * reste le même objet.
   */
  frozenUpTo: number;
}

/** Les mêmes réglages, champ à champ. */
const sameOptions = (a: KinematicsOptions, b: KinematicsOptions): boolean =>
  a.medianWindowSeconds === b.medianWindowSeconds && a.maxDetourRatio === b.maxDetourRatio
  && a.maxAcceleration === b.maxAcceleration && a.maxSpeedMs === b.maxSpeedMs
  && a.forceDerivedSpeed === b.forceDerivedSpeed && a.maxGapS === b.maxGapS;

/**
 * Les points du calcul précédent sont les mêmes objets, au début de `points`.
 * Le même tableau que celui du calcul précédent n'a pu que s'allonger : il
 * n'est pas relu.
 */
const samePrefix = (points: RawTrackPoint[], previous: KinematicsRun): boolean => {
  // `timesMs` a un rang par point du calcul précédent, même si `previous.points` s'est allongé depuis.
  const count = previous.timesMs.length;
  if (points.length < count) return false;
  if (points === previous.points) return true;
  for (let k = 0; k < count; k++) if (points[k] !== previous.points[k]) return false;
  return true;
};

/** Un point de `from` à la fin porte une vitesse appareil. */
const hasDeviceSpeedFrom = (points: RawTrackPoint[], from: number): boolean => {
  for (let i = from; i < points.length; i++) if (points[i].speedMs !== undefined) return true;
  return false;
};

/**
 * Point qui prend la vitesse ou le cap du pas suivant : reprise après une
 * pause, ou point d'arrivée d'un trou de la trace (son cap seulement).
 */
const takesNextStep = (points: RawTrackPoint[], timesMs: number[], maxGapS: number, i: number): boolean =>
  points[i].segmentStart === true || (timesMs[i] - timesMs[i - 1]) / 1000 > maxGapS;

/**
 * Premier indice dont la vitesse et le cap, reprise de pause, trous et pas
 * nuls faits, peuvent changer à la reprise qui refait les pas depuis `from` :
 * un point qui prend le pas suivant dépend de lui, de proche en proche ; et
 * tant qu'aucun cap n'est connu avant, les pas nuls du début attendent le
 * premier (1 : tout est refait). Les dates d'avant `from` sont figées.
 */
const adjustStart = (points: RawTrackPoint[], timesMs: number[], maxGapS: number, from: number, firstBearingAt: number): number => {
  let start = from;
  while (start >= 2 && takesNextStep(points, timesMs, maxGapS, start - 1)) start--;
  return firstBearingAt >= 0 && firstBearingAt < start ? start : 1;
};

/** Premier indice d'où vitesses et caps de la trace (sauts de position compris) sont refaits : un saut touche aussi le point suivant. */
const finalStart = (adjustFrom: number): number => Math.max(1, adjustFrom - 1);

/** Début de la dernière suite de dates brutes égales. */
const lastEqualRunStart = (rawTimesMs: number[]): number => {
  let start = rawTimesMs.length - 1;
  while (start > 0 && rawTimesMs[start - 1] === rawTimesMs[start]) start--;
  return start;
};

/** `values` ramené à ses `length` premières valeurs, sur place. */
const truncated = <T>(values: T[], length: number): T[] => {
  values.length = length;
  return values;
};

/** Insère `value` dans `sorted` (croissant), à sa place. */
const insertSorted = (sorted: number[], value: number): void => {
  sorted.splice(firstIndexAtOrAfter(sorted, value), 0, value);
};

/** Au-delà, des valeurs à ajouter à un tableau trié sont ajoutées puis le tout retrié, plutôt qu'insérées une à une. */
const INSERT_ONE_BY_ONE_MAX = 32;

/** Ajoute `added` à `sorted` (croissant), sur place, chacun à sa place. */
const addSorted = (sorted: number[], added: number[]): void => {
  if (added.length > INSERT_ONE_BY_ONE_MAX) {
    for (const value of added) sorted.push(value);
    sorted.sort((a, b) => a - b);
    return;
  }
  for (const value of added) insertSorted(sorted, value);
};

/**
 * Valeur de rang `k` (à partir de 0) de la réunion de deux tableaux
 * croissants non vides ensemble, sans les fusionner : la plus petite valeur
 * de l'un ou de l'autre dont le nombre de valeurs inférieures ou égales, dans
 * les deux, dépasse `k`.
 */
const kthOfSorted = (a: number[], b: number[], k: number): number => {
  const firstOver = (s: number[], other: number[]): number => {
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (firstIndexAfter(s, s[mid]) + firstIndexAfter(other, s[mid]) > k) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  const inA = firstOver(a, b);
  const inB = firstOver(b, a);
  if (inA === a.length) return b[inB];
  if (inB === b.length) return a[inA];
  return Math.min(a[inA], b[inB]);
};

/** Médiane de la réunion de deux tableaux croissants, comme `medianOfSorted` de leur fusion. */
const medianOfTwoSorted = (a: number[], b: number[]): number => {
  const count = a.length + b.length;
  if (count === 0) return 0;
  const mid = Math.floor(count / 2);
  return count % 2 === 0 ? (kthOfSorted(a, b, mid - 1) + kthOfSorted(a, b, mid)) / 2 : kthOfSorted(a, b, mid);
};

/** Rapport vitesse appareil / dérivée d'un point, s'il sert à la détection de l'unité ; `null` sinon. */
const unitRatio = (device: number | undefined, derived: number): number | null =>
  device === undefined || device <= 0 || derived < UNIT_DETECTION_MIN_DERIVED_MS ? null : device / derived;

/**
 * Le calcul, entier (`previous` nul) ou repris sur une trace prolongée.
 *
 * Reprise : les tableaux du calcul précédent sont tronqués puis prolongés
 * sur place. Les étapes locales (dates réparties, cordes, caps, sauts de
 * position) ne sont refaites qu'à partir de `previous.resumeFrom`, quatre
 * points avant la dernière suite de dates égales ; reprise de pause, trous
 * et pas nuls depuis `adjustStart`, vitesses et caps de la trace un point
 * plus tôt (`finalStart`), d'où la vitesse brute aussi ; l'unité de la
 * vitesse appareil est relue sur toutes les mesures (les rapports des points
 * figés restent triés, la médiane est lue sans fusionner) ; l'écrêtage
 * reprend à `previous.clampRestart`, dernier passage de sa boucle dont la
 * fenêtre de retour de 3 s ne touchait aucun point qui pouvait changer, avec
 * la valeur retenue juste avant ; la médiane reprend une demi-fenêtre plus
 * tôt. Tout ce qui précède est repris tel quel, points de la trace compris.
 * Si l'unité change, ou si la vitesse appareil apparaît, tout est refait. Le
 * résultat est celui du calcul entier (`kinematics.test.ts`).
 */
const runKinematics = (points: RawTrackPoint[], options: KinematicsOptions, previous: KinematicsRun | null): KinematicsRun => {
  const n = points.length;
  const medianWindowSeconds = options.medianWindowSeconds ?? DEFAULT_MEDIAN_WINDOW_S;
  const maxAcceleration = options.maxAcceleration ?? DEFAULT_MAX_ACCELERATION;
  const maxGapS = options.maxGapS ?? Infinity;

  // Mêmes réglages et mêmes premiers points : la vitesse appareil n'est cherchée que dans les points neufs.
  const seen = previous !== null && sameOptions(previous.options, options) && previous.resumeFrom >= 3
    && samePrefix(points, previous)
    ? previous
    : null;
  const useDeviceSpeed = !options.forceDerivedSpeed
    && (seen ? seen.useDeviceSpeed || hasDeviceSpeedFrom(points, seen.timesMs.length) : hasDeviceSpeedFrom(points, 0));
  const speedSource: SpeedSource = useDeviceSpeed ? 'doppler' : 'derived';

  const resumed = seen !== null && seen.useDeviceSpeed === useDeviceSpeed ? seen : null;
  /** Premier indice dont les étapes locales sont refaites. */
  const R = resumed ? resumed.resumeFrom : 1;
  /** Premier indice dont reprise de pause, trous et pas nuls sont refaits (dates d'avant `R` figées). */
  const A = resumed ? adjustStart(points, resumed.timesMs, maxGapS, R, resumed.firstBearingAt) : 0;
  /** Premier indice dont vitesses et caps de la trace sont refaits. */
  const F = resumed ? finalStart(A) : 0;

  // Dates réparties (`spreadEqualTimes`) : refaites depuis la dernière suite de dates égales du calcul précédent.
  let rawTimesMs: number[];
  let timesMs: number[];
  if (resumed) {
    const from = resumed.tailStart - 1;
    rawTimesMs = resumed.rawTimesMs;
    rawTimesMs.length = from;
    for (let i = from; i < n; i++) rawTimesMs.push(rawPointTimeMs(points[i]));
    const spread = spreadEqualTimes(points.slice(from), rawTimesMs.slice(from));
    timesMs = resumed.timesMs;
    timesMs.length = from + 1;
    for (let k = 1; k < spread.length; k++) timesMs.push(spread[k]);
  } else {
    rawTimesMs = points.map(rawPointTimeMs);
    timesMs = spreadEqualTimes(points, rawTimesMs);
  }

  // Pas : corde, vitesse dérivée, cap (`NaN` pour un pas nul, sans direction).
  const chordsM = resumed ? truncated(resumed.chordsM, R) : [0];
  const derivedRaw = resumed ? truncated(resumed.derivedRaw, R) : [0];
  const bearingsRaw = resumed ? truncated(resumed.bearingsRaw, R) : [NaN];
  for (let i = R; i < n; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const dt = (timesMs[i] - timesMs[i - 1]) / 1000;
    const chordM = haversineDistance(p0.lat, p0.lon, p1.lat, p1.lon);
    chordsM.push(chordM);
    derivedRaw.push(dt > 0 ? chordM / dt : 0);
    bearingsRaw.push(chordM < NULL_STEP_M ? NaN : initialBearing(p0.lat, p0.lon, p1.lat, p1.lon));
  }

  // Reprise après une pause : le pas qui y mène enjambe la pause, ni sa vitesse
  // ni son cap ne disent rien. Le point prend ceux du pas suivant, comme le
  // premier point de la trace ; une reprise en dernier point, ceux du pas précédent.
  // Trou de la trace (pas plus long que `maxGapS`) : le cap de
  // la corde pointe au milieu de ce qui s'est passé pendant le silence (un
  // enregistreur économique y compresse un virage entier, règle 10) et coupait
  // un virement de 90° en deux moitiés que personne ne lisait ; le point de
  // reprise prend le cap du pas suivant, son cap de bord. Sa vitesse dérivée,
  // corde sur durée, reste la moyenne du trou (`gapDistanceM`, masque d'activité).
  // Un dernier point après un trou garde la corde, faute de pas suivant.
  // À la reprise, rien n'est refait avant `A` : ce qui précède ne lit que des pas figés.
  const derivedAdjusted = resumed ? truncated(resumed.derivedAdjusted, A) : [];
  const bearingsAdjusted = resumed ? truncated(resumed.bearingsAdjusted, A) : [];
  for (let i = A; i < n; i++) {
    derivedAdjusted.push(derivedRaw[i]);
    bearingsAdjusted.push(bearingsRaw[i]);
  }
  for (let i = n - 2; i >= Math.max(A, 1); i--) {
    if (points[i].segmentStart) {
      derivedAdjusted[i] = derivedAdjusted[i + 1];
      bearingsAdjusted[i] = bearingsAdjusted[i + 1];
    } else if ((timesMs[i] - timesMs[i - 1]) / 1000 > maxGapS) {
      bearingsAdjusted[i] = bearingsAdjusted[i + 1];
    }
  }
  const last = n - 1;
  if (last >= 2 && points[last].segmentStart) {
    derivedAdjusted[last] = derivedAdjusted[last - 1];
    bearingsAdjusted[last] = bearingsAdjusted[last - 1];
  }

  // Pas nul : il garde le cap du pas précédent (un arrêt sur place ne tourne pas
  // au nord) ; les premiers pas nuls prennent celui du premier pas qui avance.
  const firstBearingAt = resumed && resumed.firstBearingAt >= 0 && resumed.firstBearingAt < A
    ? resumed.firstBearingAt
    : bearingsAdjusted.findIndex((b) => !Number.isNaN(b));
  const firstBearing = firstBearingAt >= 0 ? bearingsAdjusted[firstBearingAt] : 0;
  for (let i = Math.max(A, 1); i < n; i++) {
    if (Number.isNaN(bearingsAdjusted[i])) bearingsAdjusted[i] = i === 1 ? firstBearing : bearingsAdjusted[i - 1];
  }

  // Jusqu'où les entrées du prochain calcul sont figées : quatre points avant la dernière suite de dates égales,
  // et, pour ce qui suit les vitesses et les caps, le `F` de la prochaine reprise.
  const tailStart = lastEqualRunStart(rawTimesMs);
  const resumeFrom = Math.max(1, tailStart - 4);
  const nextFinalStart = finalStart(adjustStart(points, timesMs, maxGapS, resumeFrom, firstBearingAt));

  // Position qui saute puis revient : les deux intervalles du point prennent
  // la vitesse et le cap du chemin direct entre ses voisins. Le point reste
  // sur la carte ; seule sa vitesse tirée des positions change. Un point qui a
  // sa vitesse Doppler n'est pas touché, son cap non plus. À la reprise, les
  // sauts d'avant `R - 1` sont ceux du calcul précédent.
  const spikes = resumed ? resumed.spikes : [];
  while (resumed && spikes.length > 0 && spikes[spikes.length - 1] >= R - 1) spikes.pop();
  const spikeFrom = resumed ? R - 1 : 1;
  const skipFirst = resumed !== null && spikes.length > 0 && spikes[spikes.length - 1] === R - 2;
  for (const i of detourSpikesFrom(points, timesMs, options.maxDetourRatio ?? DEFAULT_MAX_DETOUR_RATIO, maxAcceleration, spikeFrom, skipFirst, chordsM)) {
    spikes.push(i);
  }
  const derivedSpeeds = resumed ? truncated(resumed.derivedSpeeds, F) : [];
  const bearings = resumed ? truncated(resumed.bearings, F) : [];
  for (let i = F; i < n; i++) {
    derivedSpeeds.push(derivedAdjusted[i]);
    bearings.push(bearingsAdjusted[i]);
  }
  // Un saut touche son point et le suivant : ceux d'avant `F - 1` sont déjà dans la trace reprise.
  let firstSpike = spikes.length;
  while (firstSpike > 0 && spikes[firstSpike - 1] >= F - 1) firstSpike--;
  for (let k = firstSpike; k < spikes.length; k++) {
    const i = spikes[k];
    if (useDeviceSpeed && points[i].speedMs !== undefined) continue;
    const p0 = points[i - 1];
    const p2 = points[i + 1];
    const directMs =
      haversineDistance(p0.lat, p0.lon, p2.lat, p2.lon) / ((timesMs[i + 1] - timesMs[i - 1]) / 1000);
    const bearing = initialBearing(p0.lat, p0.lon, p2.lat, p2.lon);
    derivedSpeeds[i] = derivedSpeeds[i + 1] = directMs;
    bearings[i] = bearings[i + 1] = bearing;
  }

  // L'unité de la vitesse appareil n'est pas garantie : on la déduit, sur toutes les mesures
  // (`detectDeviceSpeedUnit`) ; les rapports des points figés restent triés d'un calcul à l'autre.
  let unit: DeviceSpeedUnit = 'ms';
  let sortedRatios: number[] = [];
  let ratiosUpTo = 0;
  if (useDeviceSpeed) {
    const ratiosOf = (from: number, to: number): number[] => {
      const out: number[] = [];
      for (let i = from; i < to; i++) {
        const ratio = unitRatio(points[i].speedMs, derivedSpeeds[i]);
        if (ratio !== null) out.push(ratio);
      }
      return out;
    };
    // Rapports des points figés (avant le `F` de la prochaine reprise), triés ; ceux de la queue comptent pour la médiane.
    if (resumed) {
      sortedRatios = resumed.sortedRatios;
      ratiosUpTo = Math.max(resumed.ratiosUpTo, Math.min(R - 2, nextFinalStart));
      addSorted(sortedRatios, ratiosOf(resumed.ratiosUpTo, ratiosUpTo));
    }
    const tail = ratiosOf(ratiosUpTo, n).sort((a, b) => a - b);
    unit = sortedRatios.length + tail.length < UNIT_DETECTION_MIN_SAMPLES ? 'ms' : unitFromRatio(medianOfTwoSorted(sortedRatios, tail));
    // L'unité a changé : tout ce qui suit en dépend, on refait le calcul entier.
    if (resumed && unit !== resumed.unit) return runKinematics(points, options, null);
  }
  const deviceFactor = DEVICE_SPEED_FACTOR[unit];

  // Vitesse brute : celle de l'appareil, sinon la dérivée ; reprise avec les vitesses dérivées.
  const rawSpeeds = resumed ? truncated(resumed.rawSpeeds, F) : [];
  for (let i = F; i < n; i++) {
    const p = points[i];
    // Repli sur la vitesse dérivée pour les points où l'appareil n'a rien fourni.
    rawSpeeds.push(!useDeviceSpeed || p.speedMs === undefined ? derivedSpeeds[i] : p.speedMs * deviceFactor);
  }

  // Sans vitesse appareil, le premier point n'a pas de vitesse propre. Lui
  // donner zéro créerait un faux démarrage brutal que l'écrêtage prendrait
  // pour une aberration : on lui prête la vitesse du second point.
  if (!useDeviceSpeed && rawSpeeds.length > 1) rawSpeeds[0] = rawSpeeds[1];

  // Le premier point n'a pas de cap propre non plus. Un nord arbitraire
  // ferait, sur une trace qui démarre en route, un virage de premier point
  // que l'analyse des manœuvres prenait pour un virement : on lui prête le
  // cap du second.
  bearings[0] = bearings[1];

  const clampFrom = resumed && resumed.clampRestart >= 1 && resumed.clampRestart <= F
    ? { from: resumed.clampRestart, previous: resumed.clamped[resumed.clampRestart - 1], prefix: resumed.clamped }
    : null;
  const { out: clamped, restart: clampRestart } = clampByAccelerationFrom(
    rawSpeeds,
    timesMs,
    { maxAccel: maxAcceleration, maxSpeedMs: options.maxSpeedMs },
    clampFrom,
    nextFinalStart
  );
  // La médiane est centrée : elle reprend une demi-fenêtre avant l'écrêtage.
  const halfWindowMs = (medianWindowSeconds * 1000) / 2;
  let Q = 0;
  if (clampFrom) {
    Q = clampFrom.from;
    while (Q > 0 && timesMs[Q - 1] >= timesMs[clampFrom.from] - halfWindowMs) Q--;
  }
  const smoothed = medianFilterByTimeFrom(clamped, timesMs, medianWindowSeconds, Q, resumed ? resumed.smoothed : null);

  // Points de la trace : ceux d'avant `Q` sont repris tels quels ; `Q` ne dépasse pas `F`, d'où vitesses et caps sont refaits.
  const track: TrackPoint[] = resumed ? truncated(resumed.track, Q) : [];
  for (let i = Q; i < n; i++) {
    const p = points[i];
    // Trou de la trace : la distance du pas est bornée par sa corde (`GAP_CHORD_FACTOR`).
    let gapDistanceM: number | undefined;
    if (i > 0 && !p.segmentStart) {
      const dt = (timesMs[i] - timesMs[i - 1]) / 1000;
      if (dt > maxGapS) gapDistanceM = Math.min(clamped[i] * dt, chordsM[i] * GAP_CHORD_FACTOR);
    }
    track.push({
      lat: p.lat,
      lon: p.lon,
      time: p.time,
      timeMs: timesMs[i],
      ele: p.ele,
      hr: p.hr,
      speedMs: clamped[i],
      smoothedSpeedMs: smoothed[i],
      bearing: bearings[i],
      ...(p.courseDeg !== undefined ? { courseDeg: p.courseDeg } : {}),
      speedSource,
      ...(p.segmentStart ? { segmentStart: true as const } : {}),
      ...(gapDistanceM !== undefined ? { gapDistanceM } : {}),
    });
  }

  // Le `Q` de la prochaine reprise, lu sur des dates qu'elle reprendra telles quelles (indices avant `tailStart - 1`).
  let frozenUpTo = 0;
  if (resumeFrom >= 3 && clampRestart >= 1 && clampRestart <= nextFinalStart) {
    frozenUpTo = clampRestart;
    while (frozenUpTo > 0 && timesMs[frozenUpTo - 1] >= timesMs[clampRestart] - halfWindowMs) frozenUpTo--;
  }

  return {
    points, track, options, useDeviceSpeed, rawTimesMs, timesMs, chordsM, derivedRaw, bearingsRaw, derivedAdjusted, bearingsAdjusted,
    firstBearingAt, derivedSpeeds, bearings, spikes, rawSpeeds, clamped, smoothed,
    unit, sortedRatios, ratiosUpTo, tailStart, resumeFrom, clampRestart, frozenUpTo,
  };
};

/**
 * Calcule vitesse et cap pour chaque point d'une trace, en m/s.
 *
 * La vitesse retenue est celle de l'appareil lorsqu'elle existe : elle vient
 * du décalage Doppler du signal satellite et ne souffre pas des sauts de
 * position. À défaut, elle est dérivée des positions successives, puis
 * écrêtée sur l'accélération et filtrée par médiane temporelle.
 *
 * Les points d'une même date sont d'abord répartis dans leur intervalle
 * (`spreadEqualTimes`) : les `timeMs` rendus sont ces dates réparties. Un pas
 * plus long que `maxGapS` (trou de la trace) porte `gapDistanceM`, et son
 * point prend le cap du pas suivant, pas celui de la corde.
 */
export const computeKinematics = (
  points: RawTrackPoint[],
  options: KinematicsOptions = {}
): TrackPoint[] => (points.length < 2 ? [] : runKinematics(points, options, null).track);

/**
 * Le même calcul, repris sur une trace qui ne fait que s'allonger (direct de
 * l'enregistrement) : `previous` est le calcul précédent sur les
 * premiers points de `points` (mêmes objets) ; seule la fin est refaite, et
 * la trace rendue est celle de `computeKinematics`. Sans `previous`, ou s'il
 * ne vaut plus (autres points, autres réglages), tout est calculé. `null`
 * sous deux points.
 *
 * `previous` est consommé quand il sert : ses tableaux, trace comprise, sont
 * tronqués puis prolongés sur place pour devenir ceux du résultat ; ne plus
 * le relire. `points` peut être le tableau même de `previous.points`, s'il
 * n'a fait que s'allonger depuis.
 */
export const resumeKinematics = (
  points: RawTrackPoint[],
  options: KinematicsOptions,
  previous: KinematicsRun | null
): KinematicsRun | null => (points.length < 2 ? null : runKinematics(points, options, previous));
