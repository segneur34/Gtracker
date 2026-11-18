import { signedDeltaHalfOpen } from '../core/angles';
import type { TrackPoint } from '../core/types';

/**
 * Grands changements de direction d'une vague, vus par le GPS.
 *
 * À une position par seconde, un bottom turn ou un top turn, qui dure à peu
 * près une seconde, ne laisse qu'un point : seuls les grands virages (cutback,
 * demi-tour) se voient. Ce compte est donc expérimental, et l'interface le
 * dit ; les virages du gyroscope les remplacent quand la capture existe.
 *
 * Le cap de chaque pas est celui de l'appareil s'il est là (Doppler, juste
 * même à 1 Hz), sinon celui des positions. On le déroule, puis on compte les
 * rotations d'un seul sens d'au moins `minDeg` : un virage est compté chaque
 * fois que le cap s'éloigne de `minDeg` de son dernier extrême, dans le sens
 * opposé au virage précédent (hystérésis, qui ignore le tremblement du cap).
 *
 * Un virage relie deux glisses. Trois règles l'assurent, toutes en temps
 * (`TurnRules`, appliquées par l'analyse d'une session) :
 * - le cap n'est pas lu sous une vitesse plancher, où il ne vaut rien ;
 * - il n'est pas lu non plus pendant les premières secondes au-dessus de ce
 *   plancher, la mise en vitesse ;
 * - un changement de direction ne compte que s'il reste assez de glisse après
 *   la fin de sa rotation : sinon c'est la sortie de la vague, pas un virage.
 *   « Assez de glisse » : la vague continue au-dessus du plancher, en ligne
 *   droite ou non ; des virages enchaînés comptent tous, sauf au plus le
 *   dernier. La rotation finit à sa première pause (`rotationEnds`).
 */

/**
 * Plancher de lecture du cap, en m/s (7,2 km/h). Dessous, le cap de l'appareil
 * saute de plusieurs dizaines de degrés d'une seconde à l'autre et celui des
 * positions suit le bruit du GPS : le pas n'est pas lu, le dernier cap lu est
 * gardé.
 */
export const COURSE_MIN_SPEED_MS = 2;

/**
 * Glisse minimale après un virage, en secondes, de la fin de la rotation à la
 * fin de la glisse. Celui qui quitte la vague se met en travers pendant que
 * sa vitesse tombe : la rotation est franche, mais rien ne la suit. Un vrai
 * virage, lui, est suivi d'une glisse. Trois secondes, avec une fin de
 * rotation mesurée sans finesse : une durée plus courte obligerait à situer
 * cette fin au degré près, ce que le cap du GPS ne permet pas. Vaut pour le
 * GPS et pour le gyroscope.
 */
export const TURN_MIN_RIDE_AFTER_S = 3;

/**
 * Mise en vitesse, en secondes : durée, après le passage du plancher, pendant
 * laquelle le cap n'est pas encore lu. Le cap de l'appareil met une ou deux
 * secondes à se poser, et ses écarts d'alors, mesurés depuis le cap de la
 * glisse, approchent le seuil d'un virage. Au GPS seulement : le cap du buste,
 * au gyroscope, ne tremble pas à basse vitesse.
 */
export const TURN_SETTLE_S = 2;

/**
 * Une rotation dure tant que le cap avance encore, dans le sens du virage,
 * d'au moins ce taux, en degrés par seconde, sur `TURN_PAUSE_WINDOW_S` ;
 * dessous, c'est une pause, et la rotation est finie. Assez haut pour qu'un
 * cap qui tremble de quelques degrés ou qui dérive lentement après le virage
 * ne la prolonge pas, assez bas pour suivre une sortie de vague qui s'étale
 * sur plusieurs secondes.
 */
export const TURN_PAUSE_RATE_DEG_S = 15;

/**
 * Fenêtre où se juge la pause d'une rotation, en secondes : l'avance du cap se
 * lit sur le plus petit écart entre deux lectures qui la couvre (un pas à
 * 1 Hz, cinq à 5 Hz, le pas lui-même s'il est plus long).
 */
export const TURN_PAUSE_WINDOW_S = 1;

/**
 * Règles d'un virage, surchargeables. Absentes, aucune ne s'applique : le
 * compte brut des rotations. L'analyse d'une session passe `surfTurnRules()`.
 */
export interface TurnRules {
  /** Plancher de lecture du cap, en m/s (`COURSE_MIN_SPEED_MS`). */
  turnCourseMinSpeedMs?: number;
  /** Glisse minimale après le virage, en secondes (`TURN_MIN_RIDE_AFTER_S`). */
  turnMinRideAfterS?: number;
  /** Mise en vitesse non lue, en secondes (`TURN_SETTLE_S`). */
  turnSettleS?: number;
  /** Taux sous lequel une rotation est en pause, en degrés par seconde (`TURN_PAUSE_RATE_DEG_S`). */
  turnPauseRateDegS?: number;
  /** Fenêtre de la pause, en secondes (`TURN_PAUSE_WINDOW_S`). */
  turnPauseWindowS?: number;
}

/** Règles des virages d'une session : les constantes du module, sauf surcharge. */
export const surfTurnRules = (o: TurnRules = {}): Required<TurnRules> => ({
  turnCourseMinSpeedMs: o.turnCourseMinSpeedMs ?? COURSE_MIN_SPEED_MS,
  turnMinRideAfterS: o.turnMinRideAfterS ?? TURN_MIN_RIDE_AFTER_S,
  turnSettleS: o.turnSettleS ?? TURN_SETTLE_S,
  turnPauseRateDegS: o.turnPauseRateDegS ?? TURN_PAUSE_RATE_DEG_S,
  turnPauseWindowS: o.turnPauseWindowS ?? TURN_PAUSE_WINDOW_S,
});

/** Options du compte au GPS : les règles, la fin de glisse si elle est déjà connue, et le trou de la trace. */
export interface GpsTurnOptions extends TurnRules {
  /** Fin de glisse, en ms ; absente : `rideEndMsOf` au plancher de lecture. */
  rideEndMs?: number;
  /** Pas le plus long où une borne s'interpole, en secondes ; au-delà, c'est un trou. Défaut : aucun trou. */
  maxGapS?: number;
}

const headingOf = (p: TrackPoint): number => p.courseDeg ?? p.bearing;

/** Un changement de direction : l'extrême d'où il part, et le point où il atteint `minDeg`. */
export interface DirectionChange {
  /** Indice du dernier extrême du cap (le début du virage). */
  from: number;
  /** Indice où le cap s'en est éloigné de `minDeg` (le virage est compté). */
  at: number;
  /** Sens de la rotation : 1 cap croissant, −1 décroissant. */
  direction: 1 | -1;
}

/**
 * Changements de direction d'au moins `minDeg` d'un cap déroulé (en degrés,
 * sans saut de 360°), par hystérésis : commun aux virages du GPS et à ceux du
 * gyroscope (`surfing/gyroTurns.ts`). Le premier cap sert de départ.
 */
export const directionChanges = (heading: ArrayLike<number>, minDeg: number): DirectionChange[] => {
  const out: DirectionChange[] = [];
  if (heading.length < 2) return out;
  let lo = heading[0];
  let hi = heading[0];
  let loAt = 0;
  let hiAt = 0;
  let extreme = heading[0];
  let extremeAt = 0;
  let direction: -1 | 0 | 1 = 0;
  for (let i = 1; i < heading.length; i++) {
    const h = heading[i];
    if (direction === 0) {
      if (h < lo) {
        lo = h;
        loAt = i;
      }
      if (h > hi) {
        hi = h;
        hiAt = i;
      }
      if (h - lo >= minDeg) {
        direction = 1;
        out.push({ from: loAt, at: i, direction });
        extreme = h;
        extremeAt = i;
      } else if (hi - h >= minDeg) {
        direction = -1;
        out.push({ from: hiAt, at: i, direction });
        extreme = h;
        extremeAt = i;
      }
    } else if (direction === 1) {
      if (h > extreme) {
        extreme = h;
        extremeAt = i;
      } else if (extreme - h >= minDeg) {
        direction = -1;
        out.push({ from: extremeAt, at: i, direction });
        extreme = h;
        extremeAt = i;
      }
    } else {
      if (h < extreme) {
        extreme = h;
        extremeAt = i;
      } else if (h - extreme >= minDeg) {
        direction = 1;
        out.push({ from: extremeAt, at: i, direction });
        extreme = h;
        extremeAt = i;
      }
    }
  }
  return out;
};

/**
 * Indice où s'achève la rotation de chaque changement de direction : sa
 * première pause. À partir du pas `at`, où le seuil est seulement atteint, la
 * rotation dure tant que le cap avance encore dans son sens d'au moins
 * `pauseRateDegS` sur la fenêtre qui suit : le plus petit écart entre deux
 * lectures qui couvre `pauseWindowS`, ou ce qui reste de lectures s'il n'y en
 * a plus autant ; l'avance s'y compare au taux fois la durée de l'écart. Ce
 * n'est pas un extrême du cap : un cap qui tremble ou dérive après le virage,
 * ou une sortie de vague dans le même sens que lui, plus tard, ne repoussent
 * pas la fin. `timeMsOf` : l'heure de chaque lecture, en ms.
 */
export const rotationEnds = (
  heading: ArrayLike<number>, timeMsOf: (i: number) => number, changes: readonly DirectionChange[],
  pauseRateDegS = TURN_PAUSE_RATE_DEG_S, pauseWindowS = TURN_PAUSE_WINDOW_S
): number[] => {
  const last = heading.length - 1;
  return changes.map((c) => {
    let k = c.at;
    let j = k;
    for (; k < last; k++) {
      if (j <= k) j = k + 1;
      while (j < last && timeMsOf(j) - timeMsOf(k) < pauseWindowS * 1000) j++;
      const spanS = (timeMsOf(j) - timeMsOf(k)) / 1000;
      if (c.direction * (heading[j] - heading[k]) < pauseRateDegS * spanS) break;
    }
    return k;
  });
};

const isGapStep = (track: TrackPoint[], i: number, maxGapS: number): boolean =>
  track[i].segmentStart === true || (track[i].timeMs - track[i - 1].timeMs) / 1000 > maxGapS;

/**
 * Instant, en ms, où la vitesse lissée passe `floorMs` sur le pas `i` (du
 * point `i − 1` au point `i`, l'un dessous, l'autre pas), interpolé en temps.
 * Un trou de la trace ne s'interpole pas : l'instant est celui du point qui
 * est au-dessus du plancher.
 */
const floorCrossingMs = (track: TrackPoint[], i: number, floorMs: number, maxGapS: number): number => {
  const a = track[i - 1];
  const b = track[i];
  if (isGapStep(track, i, maxGapS)) return a.smoothedSpeedMs >= floorMs ? a.timeMs : b.timeMs;
  return a.timeMs + ((floorMs - a.smoothedSpeedMs) / (b.smoothedSpeedMs - a.smoothedSpeedMs)) * (b.timeMs - a.timeMs);
};

/**
 * Fin de glisse d'une vague entre les points `start` et `end`, en ms : le
 * dernier instant où la vitesse lissée tient le plancher `floorMs`, interpolé
 * entre deux points. C'est la fin de la vague si son dernier point le tient,
 * son début si aucun ne le tient.
 */
export const rideEndMsOf = (track: TrackPoint[], start: number, end: number, floorMs: number, maxGapS = Infinity): number => {
  let k = end;
  while (k >= start && track[k].smoothedSpeedMs < floorMs) k--;
  if (k < start) return track[start].timeMs;
  return k === end ? track[end].timeMs : floorCrossingMs(track, k + 1, floorMs, maxGapS);
};

/**
 * Instant, en ms, depuis lequel la vitesse tient le plancher au point `k`,
 * qui le tient : le passage du plancher, interpolé, cherché en arrière jusque
 * devant la vague (une vague prise en vol est lancée depuis longtemps), sans
 * remonter plus de `settleMs`, qui suffit à dire la mise en vitesse finie.
 */
const aboveFloorSinceMs = (track: TrackPoint[], k: number, floorMs: number, settleMs: number, maxGapS: number): number => {
  let j = k;
  while (
    j > 0 && !isGapStep(track, j, maxGapS) && track[j - 1].smoothedSpeedMs >= floorMs && track[k].timeMs - track[j].timeMs < settleMs
  ) j--;
  if (j === 0 || isGapStep(track, j, maxGapS) || track[j - 1].smoothedSpeedMs >= floorMs) return track[j].timeMs;
  return floorCrossingMs(track, j, floorMs, maxGapS);
};

/** Un changement de direction d'une vague, vu par le GPS, compté ou écarté selon la glisse qui le suit. */
export interface GpsTurn {
  /** Heures, en ms, de l'extrême d'où il part, du pas où il atteint `minDeg`, et de la fin de sa rotation. */
  fromMs: number;
  atMs: number;
  endMs: number;
  /** Sens de la rotation : 1 cap croissant, −1 décroissant. */
  direction: 1 | -1;
  /** Glisse restante, en secondes, de la fin de la rotation à la fin de glisse de la vague. */
  rideAfterS: number;
  /** Vrai s'il reste assez de glisse après la rotation : un virage. */
  counted: boolean;
}

/**
 * Changements de direction d'au moins `minDeg` entre les points `start` et
 * `end` : les caps des pas `start + 1` à `end`, chacun à l'heure de son point
 * d'arrivée. Avec les règles `o` (aucune par défaut) : un pas n'est lu que si
 * son point d'arrivée tient le plancher et la mise en vitesse est passée (elle
 * ne se juge qu'une fois : un repassage sous le plancher en cours de vague ne
 * la relance pas), et un changement ne compte que suivi d'assez de glisse. Sur
 * un long pas (cadence variable), la glisse restante se mesure depuis le point
 * d'arrivée du dernier pas lu : elle peut être surestimée d'un pas.
 */
export const gpsTurnsOf = (
  track: TrackPoint[], start: number, end: number, minDeg: number, o: GpsTurnOptions = {}
): GpsTurn[] => {
  if (end - start < 2) return [];
  const floorMs = o.turnCourseMinSpeedMs ?? 0;
  const settleMs = (o.turnSettleS ?? 0) * 1000;
  const minRideAfterMs = (o.turnMinRideAfterS ?? 0) * 1000;
  const maxGapS = o.maxGapS ?? Infinity;
  let first = start;
  while (first <= end && track[first].smoothedSpeedMs < floorMs) first++;
  if (first > end) return [];
  const readFromMs = aboveFloorSinceMs(track, first, floorMs, settleMs, maxGapS) + settleMs;
  const heading: number[] = [];
  const timeMs: number[] = [];
  let lastRead = 0;
  for (let i = start + 1; i <= end; i++) {
    const p = track[i];
    if (p.smoothedSpeedMs < floorMs || p.timeMs < readFromMs) continue;
    const read = headingOf(p);
    heading.push(heading.length === 0 ? 0 : heading[heading.length - 1] + signedDeltaHalfOpen(lastRead, read));
    timeMs.push(p.timeMs);
    lastRead = read;
  }
  const changes = directionChanges(heading, minDeg);
  if (changes.length === 0) return [];
  const rideEndMs = o.rideEndMs ?? rideEndMsOf(track, start, end, floorMs, maxGapS);
  const ends = rotationEnds(heading, (i) => timeMs[i], changes, o.turnPauseRateDegS, o.turnPauseWindowS);
  return changes.map((c, j) => {
    const rideAfterMs = rideEndMs - timeMs[ends[j]];
    return {
      fromMs: timeMs[c.from], atMs: timeMs[c.at], endMs: timeMs[ends[j]], direction: c.direction,
      rideAfterS: rideAfterMs / 1000, counted: rideAfterMs >= minRideAfterMs,
    };
  });
};

/** Nombre de virages du GPS entre les points `start` et `end` : les changements de direction comptés de `gpsTurnsOf`. */
export const countDirectionChanges = (
  track: TrackPoint[], start: number, end: number, minDeg: number, o: GpsTurnOptions = {}
): number => gpsTurnsOf(track, start, end, minDeg, o).filter((c) => c.counted).length;
