import { meanOf } from '../core/basics';
import { haversineDistance } from '../core/geo';
import type { FlightSpan } from '../core/pumping';
import { activeRuns, spanOfRun, type ActiveRun } from '../core/sessionStats';
import { bestWindowSpeedMs } from '../core/topSegments';
import type { SportProfile, SurfProfile } from '../core/sportProfiles';
import type { CumulativeTrack, TrackPoint } from '../core/types';
import { countDirectionChanges } from './gpsTurns';
import { buildPeakZone, isInZone, zoneEntry, type PeakZone, type PeakZoneOptions } from './peakZone';
import { estimateWaveSense, isAgainstWaveSense, type WaveSense, type WaveSenseOptions } from './waveSense';

/**
 * Analyse d'une session de surf, en SI, sur la trace du noyau.
 *
 * La session se découpe pas à pas (le pas `i` va du point `i − 1` au point `i`) :
 * - **glisse** : dans une vague, ou dans un vol sur foil. C'est une suite du
 *   masque d'activité (le seuil de vague, ou le seuil de vol sur foil),
 *   gardée si elle dure `minWaveS` et couvre `minWaveM` ;
 * - **attente** : immobile (vitesse lissée sous `stillMs`, le plancher d'arrêt
 *   du profil, `stillThreshold`) pendant au moins `minWaitS` d'affilée, au pic
 *   le plus souvent ;
 * - **rame** : le reste, arrêts courts compris (canard, série qui passe) ;
 * - **sans signal** : un pas plus long que `maxGapS`, le téléphone sous l'eau,
 *   ou le pas de reprise d'une pause manuelle (`segmentStart`). Il n'est jamais
 *   interpolé (règle 10) : il borne la phase en cours.
 *
 * Entre deux glisses, une remontée. Le retour au pic va de la fin de la
 * glisse à l'entrée dans la zone du pic (`peakZone.ts`), celle des départs de
 * toute la session ; une glisse finie dans la zone a un retour nul. Une glisse
 * prise sans être rentrée dans la zone (une vague de l'intérieur) est
 * « enchaînée », et sa remontée n'entre pas dans la moyenne du retour. Avant la
 * première glisse, la première sortie va du premier coup de rame à la première
 * entrée dans la zone : la marche sur la plage y est comprise. L'attente reste
 * l'immobilité, mesurée à part.
 *
 * Sur foil, les glisses sont des vols : une suite au seuil de vol, qui peut
 * relier plusieurs vagues en pompant entre elles. Les vagues d'un vol sont ses
 * passages au-dessus du seuil de vague en foil (`waveMask`) ; le reste du vol
 * est pompé. Sans foil, les glisses sont les vagues.
 *
 * Le sens des vagues (`waveSense.ts`) s'estime sur la première vague de chaque
 * glisse. Sur foil, une vague candidate qui va contre lui est une remontée
 * pompée vers le large : elle sort des vagues et reste dans le vol, comptée
 * pompée. Sans sens estimable, rien n'est écarté.
 */

/** Durée maximale du recul du début d'une glisse, en secondes : une mise en vitesse entre les deux détentes en dure quelques-unes. */
export const RISE_MAX_S = 10;

/**
 * Fenêtre de la montée, en secondes : la vitesse d'un point se compare à celle
 * de la trace cette durée plus tôt. Assez longue pour qu'une mise en vitesse
 * lente (planche à pagaie, de 8 à 11 km/h en 8 s) y gagne nettement plus que le
 * bruit de la vitesse lissée sur une rame plate.
 */
export const RISE_WINDOW_S = 4;

/**
 * Un point est dans la montée si la vitesse de la fenêtre d'avant ne dépasse
 * pas cette part de la sienne : 0,95, au moins 5 % gagnés en `RISE_WINDOW_S`.
 * Un rapport, pas une pente : la même règle à 8 km/h et à 20 km/h. Une rame
 * plate n'en gagne pas autant, bruit du GPS compris (± 0,15 m/s : une seconde
 * de rame avalée au pire), et le recul s'y arrête.
 */
export const RISE_MAX_RATIO = 0.95;

/** Constantes du recul du début d'une glisse, surchargeables pour les tests. */
export interface RiseOptions {
  maxRiseS?: number;
  riseWindowS?: number;
  riseMaxRatio?: number;
}

/**
 * Réglages de l'analyse : ceux du surf, le trou de la trace et la fenêtre de la
 * vitesse max du calcul, et `stillMs`, le plancher d'arrêt du profil
 * (`stillThreshold`) en m/s : un seul plancher pour le masque et l'attente.
 * `rideExitMs` et `waveExitMs` : détentes basses, en m/s, du masque de la
 * glisse et de celui des vagues sur foil (`null` sans foil), celles où une
 * glisse finit ; le début d'une glisse remonte jusqu'à elles (`riseStartOf`).
 */
export type SurfParams = Pick<
  SurfProfile, 'minWaitS' | 'minWaveS' | 'minWaveM' | 'takeoffSearchS' | 'turnMinDeg'
> & Pick<SportProfile, 'maxGapS' | 'maxSpeedWindowS'> & RiseOptions & WaveSenseOptions & PeakZoneOptions & {
  stillMs: number;
  rideExitMs: number;
  waveExitMs: number | null;
};

/** Ce que fait le pratiquant sur un pas. */
export type SurfPhase = 'glisse' | 'rame' | 'attente' | 'trou';

/** Un passage de la trace, entre deux points. */
export interface SurfSpan extends FlightSpan {
  /** Vitesse max : la meilleure moyenne sur `maxSpeedWindowS` ; la moyenne du passage s'il est plus court. */
  maxSpeedMs: number;
  avgSpeedMs: number;
}

export interface SurfWave extends SurfSpan {
  /**
   * Rame de départ : le mouvement continu qui précède la vague, au plus
   * `takeoffSearchS`, en secondes ; `null` pour une vague prise en vol (foil).
   */
  takeoffS: number | null;
  takeoffSpeedMs: number | null;
  /** Grands changements de direction vus par le GPS (`gpsTurns.ts`). */
  turns: number;
  /** Numéro du vol qui la porte, sur foil ; `null` sans foil. */
  flight: number | null;
}

export interface SurfFlight extends SurfSpan {
  takeoffS: number;
  takeoffSpeedMs: number | null;
  /** Vagues reliées par ce vol. */
  waveCount: number;
  /** Temps porté par les vagues, puis temps pompé, en secondes. */
  waveS: number;
  pumpS: number;
  pumpDistanceM: number;
  pumpSpeedMs: number | null;
}

/** Remontée après une glisse (`after` ≥ 1), ou première sortie (`after` = 0). */
export interface SurfReturn {
  after: number;
  startMs: number;
  /** Début de la glisse suivante, sinon fin de la session. */
  endMs: number;
  /** Retour au pic : jusqu'à l'entrée dans la zone du pic, en secondes ; `null` sans entrée (glisse enchaînée). */
  returnS: number | null;
  /** Instant de l'entrée dans la zone ; `null` sans entrée. */
  entryMs: number | null;
  /** Distance à vol d'oiseau de la fin de la glisse au point d'entrée dans la zone. */
  straightM: number | null;
  /** Vitesse de remontée : `straightM` ÷ `returnS` ; `null` pour un retour nul (glisse finie dans la zone). */
  returnSpeedMs: number | null;
  /** Rame en mouvement (arrêts courts exclus), sur toute la remontée. */
  paddleS: number;
  paddleDistanceM: number;
  paddleSpeedMs: number | null;
  /** Attente, sur toute la remontée. */
  waitS: number;
}

export interface SurfAnalysis {
  /** Phase de chaque pas ; celle du pas 0, qui n'existe pas, vaut `trou`. */
  phases: SurfPhase[];
  waves: SurfWave[];
  /** Vols, sur foil ; vide sans foil. */
  flights: SurfFlight[];
  /** Première sortie (si elle entre dans la zone du pic), puis une remontée après chaque glisse sauf la dernière. */
  returns: SurfReturn[];
  /** Sens des vagues de la session ; `null` s'il n'est pas estimable. */
  waveSense: WaveSense | null;
  /** Zone du pic de la session ; `null` sans glisse. */
  peakZone: PeakZone | null;
}

const stepS = (track: TrackPoint[], i: number): number => (track[i].timeMs - track[i - 1].timeMs) / 1000;

/**
 * Mesure d'un passage entre les points `start` et `end`. Vitesse max : la
 * meilleure moyenne sur `maxSpeedWindowS` dans le passage, sinon (passage plus
 * court, ou coupé de trous) sa moyenne.
 */
const spanOf = (track: TrackPoint[], cum: CumulativeTrack, n: number, run: ActiveRun, windowS: number): SurfSpan => {
  const span = spanOfRun(track, cum, run);
  const avgSpeedMs = span.durationS > 0 ? span.distanceM / span.durationS : 0;
  const maxSpeedMs = bestWindowSpeedMs(track, cum, windowS, run.start, run.end) ?? avgSpeedMs;
  return { n, ...span, maxSpeedMs, avgSpeedMs };
};

/** Dernier point à `windowS` secondes ou plus avant le point `i`, le premier de la trace au plus tôt. */
const pointBefore = (track: TrackPoint[], i: number, windowS: number): number => {
  const atMs = track[i].timeMs - windowS * 1000;
  let j = i - 1;
  while (j > 0 && track[j].timeMs > atMs) j--;
  return Math.max(0, j);
};

/**
 * Début remonté d'une glisse qui part du point `start`. Le masque n'entre en
 * glisse qu'à sa détente haute et n'en sort qu'à sa détente basse : sans recul,
 * la mise en vitesse entre les deux détentes resterait de la rame au départ,
 * alors que la même plage de vitesse est de la glisse à la fin. Le début
 * remonte donc d'un pas tant que :
 * - le point d'arrivée de ce pas, comme dans `activeRuns`, a une vitesse lissée
 *   au moins égale à la détente basse `lowMs` (la mise en vitesse dessous reste
 *   de la rame de départ) ;
 * - ce point est encore dans la montée : la vitesse de `riseWindowS` secondes
 *   plus tôt n'atteint pas `riseMaxRatio` de la sienne. Jugée sur une fenêtre en
 *   secondes, pas d'un point au suivant, la règle tient à toute cadence (règle
 *   2), et une rame plate entre les deux détentes n'est pas avalée ;
 * - le recul ne dépasse pas `maxRiseS` secondes ;
 * - le pas n'est ni un trou de la trace (plus long que `maxGapS`) ni la reprise
 *   d'une pause (`segmentStart`), et ne part pas avant le point `floor` (la fin
 *   de la glisse précédente, ou le début du vol qui porte une vague).
 * Un long pas (règle 10) se juge comme un autre, sur son point d'arrivée.
 */
export const riseStartOf = (
  track: TrackPoint[], start: number, floor: number, lowMs: number, p: Pick<SportProfile, 'maxGapS'> & RiseOptions
): number => {
  const maxRiseS = p.maxRiseS ?? RISE_MAX_S;
  const windowS = p.riseWindowS ?? RISE_WINDOW_S;
  const ratio = p.riseMaxRatio ?? RISE_MAX_RATIO;
  const startMs = track[start].timeMs;
  let s = start;
  while (s - 1 >= Math.max(0, floor)) {
    const arrival = track[s];
    if (arrival.segmentStart || stepS(track, s) > p.maxGapS) break;
    if ((startMs - track[s - 1].timeMs) / 1000 > maxRiseS) break;
    const v = arrival.smoothedSpeedMs;
    if (v < lowMs) break;
    if (track[pointBefore(track, s, windowS)].smoothedSpeedMs > ratio * v) break;
    s--;
  }
  return s;
};

/** Suites du masque dont le début est remonté (`riseStartOf`), chacune après la fin de la précédente et pas avant `floor`. */
const risenRuns = (track: TrackPoint[], runs: ActiveRun[], floor: number, lowMs: number, p: SurfParams): ActiveRun[] =>
  runs.map((r, k) => ({ start: riseStartOf(track, r.start, k > 0 ? runs[k - 1].end : floor, lowMs, p), end: r.end }));

const keptRuns = (track: TrackPoint[], cum: CumulativeTrack, runs: ActiveRun[], p: SurfParams): ActiveRun[] =>
  runs.filter((r) => {
    const { durationS, distanceM } = spanOfRun(track, cum, r);
    return durationS >= p.minWaveS && distanceM >= p.minWaveM;
  });

/** Phase de chaque pas, glisses données. */
const stepPhases = (track: TrackPoint[], rides: ActiveRun[], p: SurfParams): SurfPhase[] => {
  const phases = new Array<SurfPhase>(track.length).fill('rame');
  phases[0] = 'trou';
  for (const r of rides) for (let i = r.start + 1; i <= r.end; i++) phases[i] = 'glisse';
  // Arrêts : une suite de pas immobiles ; d'au moins `minWaitS`, c'est une attente.
  let from = -1;
  const closeStop = (to: number) => {
    if (from < 0) return;
    if ((track[to].timeMs - track[from - 1].timeMs) / 1000 >= p.minWaitS) for (let k = from; k <= to; k++) phases[k] = 'attente';
    from = -1;
  };
  for (let i = 1; i < track.length; i++) {
    // Trou de la trace, ou reprise après une pause manuelle : ni rame ni attente.
    if (stepS(track, i) > p.maxGapS || track[i].segmentStart) {
      closeStop(i - 1);
      phases[i] = 'trou';
      continue;
    }
    if (phases[i] === 'glisse') {
      closeStop(i - 1);
      continue;
    }
    if (track[i].smoothedSpeedMs < p.stillMs) {
      if (from < 0) from = i;
    } else closeStop(i - 1);
  }
  closeStop(track.length - 1);
  return phases;
};

/** Rame de départ d'une glisse qui part du point `start` : les pas de rame en mouvement qui la précèdent. */
const takeoffOf = (
  track: TrackPoint[], cum: CumulativeTrack, phases: SurfPhase[], start: number, p: SurfParams
): { takeoffS: number; takeoffSpeedMs: number | null } => {
  const endMs = track[start].timeMs;
  let b = start;
  while (b > 0 && phases[b] === 'rame' && track[b].smoothedSpeedMs >= p.stillMs && (endMs - track[b - 1].timeMs) / 1000 <= p.takeoffSearchS) b--;
  const takeoffS = (endMs - track[b].timeMs) / 1000;
  return { takeoffS, takeoffSpeedMs: takeoffS > 0 ? (cum.cumDist[start] - cum.cumDist[b]) / takeoffS : null };
};

/** Pas de rame en mouvement, au-dessus de l'immobilité (les arrêts courts n'en sont pas). */
const isPaddling = (track: TrackPoint[], phases: SurfPhase[], i: number, stillMs: number): boolean =>
  phases[i] === 'rame' && track[i].smoothedSpeedMs >= stillMs;

/**
 * Remontée des pas `from + 1` à `to`, partie du point `from` ; le retour au
 * pic se mesure du point `origin` à l'entrée dans la zone qui le suit, au plus
 * tard au point `to`.
 */
const returnOf = (
  track: TrackPoint[], cum: CumulativeTrack, phases: SurfPhase[], p: SurfParams, zone: PeakZone | null,
  after: number, from: number, to: number, origin: number
): SurfReturn => {
  let paddleS = 0;
  let paddleDistanceM = 0;
  let waitS = 0;
  for (let i = from + 1; i <= to; i++) {
    const dt = stepS(track, i);
    if (phases[i] === 'attente') waitS += dt;
    else if (isPaddling(track, phases, i, p.stillMs)) {
      paddleS += dt;
      paddleDistanceM += cum.cumDist[i] - cum.cumDist[i - 1];
    }
  }
  const entry = zone === null ? null : zoneEntry(track, zone, origin, to, p.maxGapS);
  const returnS = entry === null ? null : (entry.timeMs - track[origin].timeMs) / 1000;
  const straightM = entry === null ? null : haversineDistance(track[origin].lat, track[origin].lon, entry.lat, entry.lon);
  return {
    after, startMs: track[from].timeMs, endMs: track[to].timeMs,
    returnS, entryMs: entry?.timeMs ?? null, straightM, returnSpeedMs: returnS && straightM !== null ? straightM / returnS : null,
    paddleS, paddleDistanceM, paddleSpeedMs: paddleS > 0 ? paddleDistanceM / paddleS : null, waitS,
  };
};

/**
 * Analyse d'une session. `rideMask` : le masque d'activité au seuil de la
 * session (vague, ou vol sur foil) ; `waveMask` : sur foil, le masque au seuil
 * de vague en foil, `null` sans foil. Une glisse qui traverse un trou de la
 * trace parcouru en mouvement reste une glisse (`activeRuns`) ; le pas du
 * trou garde sa phase « trou » dans la frise (`stepPhases`).
 */
export const analyzeSurf = (
  track: TrackPoint[], cum: CumulativeTrack, rideMask: boolean[], waveMask: boolean[] | null, p: SurfParams
): SurfAnalysis => {
  if (track.length < 2) return { phases: track.map(() => 'trou'), waves: [], flights: [], returns: [], waveSense: null, peakZone: null };
  // Début remonté avant le filtre de durée et de distance : une vague molle, rognée de sa mise en vitesse, était écartée.
  const rides = keptRuns(track, cum, risenRuns(track, activeRuns(track, rideMask), 0, p.rideExitMs, p), p);
  const phases = stepPhases(track, rides, p);

  // Sur foil, vagues candidates de chaque vol : les suites du masque de vague entre ses bornes, sans reparcourir la trace.
  // Leur début remonte comme celui des vols, à la détente basse des vagues, jamais avant le début du vol.
  const candidates = waveMask === null
    ? null
    : rides.map((r) => keptRuns(
      track, cum, risenRuns(track, activeRuns(track, waveMask, r.start + 1, r.end), r.start, p.waveExitMs ?? p.rideExitMs, p), p
    ));
  // Sens des vagues : sans foil, toutes les vagues ; sur foil, la vague qui lance chaque vol (les remontées pompées tireraient la moyenne vers zéro).
  const waveSense = estimateWaveSense(track, candidates === null ? rides : candidates.flatMap((c) => c.slice(0, 1)), p);

  const waves: SurfWave[] = [];
  const flights: SurfFlight[] = [];
  if (candidates === null) {
    rides.forEach((r, k) => {
      waves.push({
        ...spanOf(track, cum, k + 1, r, p.maxSpeedWindowS), ...takeoffOf(track, cum, phases, r.start, p),
        turns: countDirectionChanges(track, r.start, r.end, p.turnMinDeg), flight: null,
      });
    });
  } else {
    rides.forEach((r, k) => {
      // Une candidate qui va contre le sens des vagues est une remontée pompée : elle reste dans le vol, comptée pompée.
      const flightWaves = waveSense === null
        ? candidates[k]
        : candidates[k].filter((w) => !isAgainstWaveSense(track, w, waveSense, p));
      let waveS = 0;
      let waveDistanceM = 0;
      for (const w of flightWaves) {
        const span = spanOf(track, cum, waves.length + 1, w, p.maxSpeedWindowS);
        waveS += span.durationS;
        waveDistanceM += span.distanceM;
        waves.push({
          ...span, takeoffS: null, takeoffSpeedMs: null,
          turns: countDirectionChanges(track, w.start, w.end, p.turnMinDeg), flight: k + 1,
        });
      }
      const span = spanOf(track, cum, k + 1, r, p.maxSpeedWindowS);
      const pumpS = span.durationS - waveS;
      const pumpDistanceM = span.distanceM - waveDistanceM;
      flights.push({
        ...span, ...takeoffOf(track, cum, phases, r.start, p),
        waveCount: flightWaves.length, waveS, pumpS, pumpDistanceM, pumpSpeedMs: pumpS > 0 ? pumpDistanceM / pumpS : null,
      });
    });
  }

  // Zone du pic : les départs de toutes les glisses, décollages des vols sur foil.
  const peakZone = buildPeakZone(track, rides.map((r) => r.start), waveSense, p);
  const returns: SurfReturn[] = [];
  // Première sortie : du premier coup de rame à la première entrée dans la zone, avant la première glisse.
  // Partie de la zone même (enregistrement lancé au pic), elle n'a pas de sens.
  const firstRideStart = rides.length > 0 ? rides[0].start : track.length - 1;
  let firstMove = -1;
  for (let i = 1; i <= firstRideStart && firstMove < 0; i++) if (isPaddling(track, phases, i, p.stillMs)) firstMove = i - 1;
  if (firstMove >= 0 && peakZone !== null && !isInZone(peakZone, track[firstMove])) {
    const out = returnOf(track, cum, phases, p, peakZone, 0, 0, firstRideStart, firstMove);
    if (out.returnS !== null) returns.push(out);
  }
  for (let k = 0; k + 1 < rides.length; k++) {
    returns.push(returnOf(track, cum, phases, p, peakZone, k + 1, rides[k].end, rides[k + 1].start, rides[k].end));
  }
  return { phases, waves, flights, returns, waveSense, peakZone };
};

/** Chiffres d'une session, en SI ; `null` quand ils n'ont pas de sens (aucune vague, aucun retour). */
export interface SurfSummary {
  totalS: number;
  /** Temps par phase, en secondes. */
  glisseS: number;
  rameS: number;
  attenteS: number;
  trouS: number;
  /** Distance parcourue en glisse : avec `glisseS`, la moyenne en action des statistiques. */
  glisseDistanceM: number;
  waveCount: number;
  wavesPerHour: number | null;
  /** Temps et distance sur les vagues (sur foil : au-dessus du seuil de vague). */
  waveS: number;
  waveDistanceM: number;
  avgWaveDistanceM: number | null;
  longestWaveM: number | null;
  avgWaveSpeedMs: number | null;
  maxWaveSpeedMs: number | null;
  /** Rame en mouvement sur toute la session, arrêts courts exclus. */
  paddleSpeedMs: number | null;
  /** Retour au pic, sur les remontées qui entrent dans la zone du pic (première sortie exclue). */
  avgReturnS: number | null;
  bestReturnS: number | null;
  avgReturnSpeedMs: number | null;
  /** Glisses prises sans être rentré dans la zone du pic depuis la précédente. */
  chainedCount: number;
  firstOutS: number | null;
  flightCount: number;
  flightS: number;
  longestFlightS: number | null;
  maxWavesInFlight: number | null;
}

export const summarizeSurf = (track: TrackPoint[], cum: CumulativeTrack, analysis: SurfAnalysis, stillMs: number): SurfSummary => {
  const { phases, waves, flights, returns } = analysis;
  const time: Record<SurfPhase, number> = { glisse: 0, rame: 0, attente: 0, trou: 0 };
  let paddleS = 0;
  let paddleDistanceM = 0;
  let glisseDistanceM = 0;
  for (let i = 1; i < track.length; i++) {
    const dt = stepS(track, i);
    time[phases[i]] += dt;
    if (phases[i] === 'glisse') glisseDistanceM += cum.cumDist[i] - cum.cumDist[i - 1];
    if (isPaddling(track, phases, i, stillMs)) {
      paddleS += dt;
      paddleDistanceM += cum.cumDist[i] - cum.cumDist[i - 1];
    }
  }
  const totalS = track.length > 1 ? (track[track.length - 1].timeMs - track[0].timeMs) / 1000 : 0;
  const waveS = waves.reduce((s, w) => s + w.durationS, 0);
  const waveDistanceM = waves.reduce((s, w) => s + w.distanceM, 0);
  const measured = returns.filter((r) => r.after > 0 && r.returnS !== null);
  const returnTimes = measured.map((r) => r.returnS as number);
  const firstOut = returns.find((r) => r.after === 0);
  return {
    totalS,
    glisseS: time.glisse,
    rameS: time.rame,
    attenteS: time.attente,
    trouS: time.trou,
    glisseDistanceM,
    waveCount: waves.length,
    wavesPerHour: totalS > 0 ? waves.length / (totalS / 3600) : null,
    waveS,
    waveDistanceM,
    avgWaveDistanceM: waves.length > 0 ? waveDistanceM / waves.length : null,
    longestWaveM: waves.length > 0 ? Math.max(...waves.map((w) => w.distanceM)) : null,
    avgWaveSpeedMs: waveS > 0 ? waveDistanceM / waveS : null,
    maxWaveSpeedMs: waves.length > 0 ? Math.max(...waves.map((w) => w.maxSpeedMs)) : null,
    paddleSpeedMs: paddleS > 0 ? paddleDistanceM / paddleS : null,
    avgReturnS: meanOf(returnTimes),
    bestReturnS: returnTimes.length > 0 ? Math.min(...returnTimes) : null,
    avgReturnSpeedMs: meanOf(measured.flatMap((r) => (r.returnSpeedMs === null ? [] : [r.returnSpeedMs]))),
    chainedCount: returns.filter((r) => r.after > 0 && r.returnS === null).length,
    firstOutS: firstOut?.returnS ?? null,
    flightCount: flights.length,
    flightS: flights.reduce((s, f) => s + f.durationS, 0),
    longestFlightS: flights.length > 0 ? Math.max(...flights.map((f) => f.durationS)) : null,
    maxWavesInFlight: flights.length > 0 ? Math.max(...flights.map((f) => f.waveCount)) : null,
  };
};
