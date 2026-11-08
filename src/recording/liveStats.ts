import { accumulateElevation, computeElevationStats, type ElevationStats } from '../core/elevation';
import { heartRateStats, smoothHeartRate } from '../core/heartRate';
import { resumeKinematics, type KinematicsRun } from '../core/kinematics';
import { referenceSpeedMs } from '../core/sessionSpeed';
import {
  MIN_ELEVATION_COVERAGE, buildCumulativeTrack, computeActiveDistanceM, computeActiveTimeMs, segmentDistanceM, thresholdActivityMask,
} from '../core/sessionStats';
import { SAILING_SPORTS, hasActiveThreshold, sportTreatment, type HeartRateProfile, type SportProfile } from '../core/sportProfiles';
import { bestWindowSpeedMs } from '../core/topSegments';
import type { CumulativeTrack, RawTrackPoint, TrackPoint } from '../core/types';
import type { LocationFix } from '../platform/location';
import { EMPTY_LIVE_LEGS, combineLiveLegs, splitLiveLegs, type LiveLegSplit, type LiveLegs } from './liveLegs';

/**
 * Statistiques affichées pendant l'enregistrement, calculées sur la trace en
 * cours avec la même chaîne que l'analyse (`computeKinematics`, dénivelé,
 * tops). La pente, la puissance et l'énergie de la course et du vélo sont
 * parties aux lots 303 et 305. Chaque segment est traité à part : rien ne
 * franchit une pause. Tout en unités SI ; la page convertit.
 *
 * Avec une mémoire (`LiveStatsMemory`, tenue par `useLiveRecording`), un
 * segment fermé n'est calculé qu'une fois et le segment en cours reprend sa
 * cinématique là où elle en était (`resumeKinematics`) : le coût de chaque
 * recalcul ne croît plus avec la durée que par le reste du segment en cours
 * (dénivelé, FC, tops), bien plus léger (27/10). Le résultat est
 * celui du calcul sans mémoire (`liveStats.test.ts`).
 */

export interface LiveStatsOptions {
  /** Fenêtre glissante des tops de voile et du D+ récent, en secondes. */
  recentWindowS: number;
  /** Durées des tops de voile sur la fenêtre récente, en secondes. */
  topDurationsS: number[];
  /** Distance de l'allure « dernier kilomètre », en mètres. */
  lastDistanceM: number;
  /** Distance de la vitesse des « derniers mètres », en mètres. */
  recentDistanceM: number;
  /** Durée de la vitesse max de la session, en secondes : une meilleure vitesse tenue, pas un point isolé. */
  maxDurationS: number;
  /** Le chiffre « moyenne » du direct est la moyenne active (`usesActiveAverage`) : libellés et valeur la disent. */
  activeAverage?: boolean;
  /**
   * Seuil d'activité de la moyenne active, dans l'unité du profil, passé par
   * l'appelant (règle 4 : aucune mise à l'échelle par défaut dans le calcul) ;
   * absent : elle n'est pas calculée.
   */
  activeThreshold?: number;
}

export const LIVE_STATS_DEFAULTS: LiveStatsOptions = {
  recentWindowS: 300,
  topDurationsS: [5, 10],
  lastDistanceM: 1000,
  recentDistanceM: 300,
  maxDurationS: 2,
};

export interface LiveStats {
  distanceM: number;
  /** Temps enregistré hors pauses, en millisecondes. */
  movingTimeMs: number;
  /** Vitesse filtrée du dernier point, en m/s. */
  currentSpeedMs: number | null;
  /** Vitesse moyenne hors pauses, en m/s ; sert aussi au temps restant, en voile et en surf comme ailleurs. */
  averageSpeedMs: number | null;
  /**
   * Moyenne active, en m/s, comme l'analyse : distance et temps en action au
   * seuil de `activeThreshold` (`thresholdActivityMask`) ; `null` sans seuil
   * passé, ou avant le premier point en action.
   */
  activeAverageSpeedMs: number | null;
  /** Vitesse sur les `lastDistanceM` derniers mètres, en m/s ; `null` tant qu'ils ne sont pas parcourus. */
  lastDistanceSpeedMs: number | null;
  /** Vitesse sur les `recentDistanceM` derniers mètres, en m/s ; `null` tant qu'ils ne sont pas parcourus. */
  recentDistanceSpeedMs: number | null;
  /** Meilleure vitesse de chaque durée de `topDurationsS` sur la fenêtre récente, en m/s, dans le même ordre. */
  recentTopsMs: (number | null)[];
  /** Meilleure vitesse tenue `maxDurationS` sur toute la session, en m/s. */
  maxSpeedMs: number | null;
  /** Dénivelé cumulé, `null` si l'altitude manque. */
  elevationGainM: number | null;
  elevationLossM: number | null;
  /** D+ sur la fenêtre récente, `null` si l'altitude manque. */
  recentGainM: number | null;
  /** Bord en cours et bord précédent, en voile seulement. */
  legs: LiveLegs;
  /** FC moyenne depuis le départ, pondérée par le temps, en bpm ; `null` sans ceinture. */
  averageHeartRateBpm: number | null;
}

export const EMPTY_LIVE_STATS: LiveStats = {
  distanceM: 0,
  movingTimeMs: 0,
  currentSpeedMs: null,
  averageSpeedMs: null,
  activeAverageSpeedMs: null,
  lastDistanceSpeedMs: null,
  recentDistanceSpeedMs: null,
  recentTopsMs: [],
  maxSpeedMs: null,
  elevationGainM: null,
  elevationLossM: null,
  recentGainM: null,
  legs: EMPTY_LIVE_LEGS,
  averageHeartRateBpm: null,
};

const toRawPoint = (fix: LocationFix): RawTrackPoint => {
  const time = new Date(fix.timeMs);
  // Date lue une fois (lot 56) : celle de `time`, que `Date` arrondit à la milliseconde.
  return { lat: fix.lat, lon: fix.lon, time, rawTimeMs: time.getTime(), ele: fix.altitudeM, speedMs: fix.speedMs };
};

/** FC d'un segment, comme l'analyse : somme pondérée par le temps et temps couvert ; `null` sans FC. */
const heartPart = (
  segment: ReadonlyArray<Pick<LocationFix, 'timeMs' | 'heartRateBpm'>>, params: HeartRateProfile
): { sum: number; coveredS: number } | null => {
  const points = segment.map((fix) => ({ timeMs: fix.timeMs, hr: fix.heartRateBpm }));
  const stats = heartRateStats(points, smoothHeartRate(points, params.smoothS, params.gapS), params.gapS);
  return stats === null ? null : { sum: stats.avgBpm * stats.coveredS, coveredS: stats.coveredS };
};

/** Le direct donne la moyenne active en voile et en surf (04/11) ; pas en bateau, sans seuil, ni dans les autres familles. */
export const usesActiveAverage = (profile: SportProfile): boolean => {
  const treatment = sportTreatment(profile.id);
  return (treatment === 'voile' || treatment === 'surf') && hasActiveThreshold(profile);
};

/**
 * Allure de la session en cours (`referenceSpeedMs`, celle de l'analyse), sur
 * ses segments mis bout à bout : le pas de reprise d'une pause n'y compte pas.
 */
export const liveReferenceSpeedMs = (segments: ReadonlyArray<ReadonlyArray<LocationFix>>, maxGapS: number): number =>
  referenceSpeedMs(
    segments.flatMap((segment, k) => segment.map((fix, i) => ({ ...toRawPoint(fix), ...(k > 0 && i === 0 ? { segmentStart: true } : {}) }))),
    undefined,
    maxGapS
  );

/** Vitesse sur les `targetM` derniers mètres, en remontant les segments ; `null` s'ils ne suffisent pas. */
const lastDistanceSpeed = (tracks: TrackPoint[][], targetM: number): number | null => {
  let dist = 0;
  let timeS = 0;
  for (let s = tracks.length - 1; s >= 0; s--) {
    const track = tracks[s];
    for (let i = track.length - 1; i >= 1; i--) {
      const d = segmentDistanceM(track, i);
      const dt = (track[i].timeMs - track[i - 1].timeMs) / 1000;
      if (d > 0 && dist + d >= targetM) {
        timeS += (dt * (targetM - dist)) / d;
        return timeS > 0 ? targetM / timeS : null;
      }
      dist += d;
      timeS += dt;
    }
  }
  return null;
};

/**
 * Meilleure vitesse sur `durationS`, parmi les points postérieurs à `sinceMs`.
 * Segment par segment : rien ne franchit une pause ; un segment fini avant
 * `sinceMs` n'est pas relu.
 */
const bestRecentTop = (tracks: TrackPoint[][], durationS: number, sinceMs: number): number | null => {
  let best: number | null = null;
  for (const track of tracks) {
    if (track[track.length - 1].timeMs < sinceMs) continue;
    const recent = track.filter((p) => p.timeMs >= sinceMs);
    const value = bestWindowSpeedMs(recent, buildCumulativeTrack(recent), durationS);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
};

/** Ce qu'un segment apporte au direct ; calculé une fois pour un segment fermé. */
interface SegmentParts {
  /** Trace du segment ; vide sous deux positions. */
  track: TrackPoint[];
  cum: CumulativeTrack;
  pointCount: number;
  withEle: number;
  distanceM: number;
  movingTimeMs: number;
  /** Distance et temps en action, avec un seuil passé (`activeThreshold`). */
  active: { distanceM: number; timeMs: number } | null;
  heart: { sum: number; coveredS: number } | null;
  /** Meilleure vitesse tenue `maxDurationS` ; `null` si la trace est trop courte. */
  maxSpeedMs: number | null;
  /** Bords, en voile seulement. */
  legs: LiveLegSplit | null;
  /** Dénivelé, demandé quand l'altitude est établie. */
  elevation: { stats: ElevationStats } | null;
}

/** Un segment de l'enregistrement, tel que vu la dernière fois, et ce qui en a été calculé. */
interface SegmentEntry {
  fixes: ReadonlyArray<LocationFix>;
  raw: RawTrackPoint[];
  run: KinematicsRun | null;
  parts: SegmentParts | null;
}

/** Mémoire du direct d'une session, à créer par `createLiveStatsMemory` et à passer à `computeLiveStats`. */
export interface LiveStatsMemory {
  /** Profil et réglages du dernier calcul : s'ils changent, tout est refait. */
  key: string;
  entries: SegmentEntry[];
}

export const createLiveStatsMemory = (): LiveStatsMemory => ({ key: '', entries: [] });

/** Les positions déjà vues sont les mêmes objets, au début du segment. */
const samePrefix = (seen: ReadonlyArray<LocationFix>, segment: ReadonlyArray<LocationFix>): boolean => {
  if (segment.length < seen.length) return false;
  for (let k = 0; k < seen.length; k++) if (segment[k] !== seen[k]) return false;
  return true;
};

export const computeLiveStats = (
  segments: LocationFix[][],
  profile: SportProfile,
  options: LiveStatsOptions = LIVE_STATS_DEFAULTS,
  memory?: LiveStatsMemory
): LiveStats => {
  const mem = memory ?? createLiveStatsMemory();
  const key = `${profile.id}|${JSON.stringify(options)}`;
  if (mem.key !== key) {
    mem.key = key;
    mem.entries = [];
  }
  const kinematicsOptions = {
    medianWindowSeconds: profile.medianWindowSeconds,
    maxSpeedMs: profile.maxPlausibleSpeedMs,
    maxGapS: profile.maxGapS,
  };

  // Un segment déjà vu tel quel garde tout ; prolongé, il reprend sa cinématique ; autre, il repart de zéro.
  const entries: SegmentEntry[] = segments.map((segment, k) => {
    const seen = mem.entries[k];
    const entry: SegmentEntry = seen && samePrefix(seen.fixes, segment) ? seen : { fixes: [], raw: [], run: null, parts: null };
    if (entry.fixes.length !== segment.length) {
      for (let i = entry.raw.length; i < segment.length; i++) entry.raw.push(toRawPoint(segment[i]));
      entry.fixes = segment;
      entry.run = resumeKinematics(entry.raw, kinematicsOptions, entry.run);
      entry.parts = null;
    }
    return entry;
  });
  mem.entries = entries;

  const sailing = SAILING_SPORTS.includes(profile.id);
  for (const entry of entries) {
    if (entry.parts) continue;
    const track = entry.run && entry.run.track.length >= 2 ? entry.run.track : [];
    const cum = buildCumulativeTrack(track);
    let distanceM = 0;
    for (let i = 1; i < track.length; i++) distanceM += segmentDistanceM(track, i);
    const mask = options.activeThreshold === undefined ? null : thresholdActivityMask(track, profile, options.activeThreshold);
    entry.parts = {
      track,
      cum,
      pointCount: entry.fixes.length,
      withEle: entry.fixes.filter((f) => f.altitudeM !== undefined && isFinite(f.altitudeM)).length,
      distanceM,
      movingTimeMs: track.length >= 2 ? track[track.length - 1].timeMs - track[0].timeMs : 0,
      active: mask === null ? null : { distanceM: computeActiveDistanceM(track, mask), timeMs: computeActiveTimeMs(track, mask) },
      heart: heartPart(entry.fixes, profile.heartRate),
      maxSpeedMs: bestWindowSpeedMs(track, cum, options.maxDurationS),
      legs: sailing && track.length >= 2 ? splitLiveLegs(track) : null,
      elevation: null,
    };
  }
  // Un segment fermé ne reprend jamais : ses étapes intermédiaires et ses points bruts ne servent plus.
  for (let k = 0; k < entries.length - 1; k++) {
    entries[k].run = null;
    entries[k].raw = [];
  }

  const active = entries.map((e) => e.parts!).filter((p) => p.track.length >= 2);
  if (active.length === 0) return { ...EMPTY_LIVE_STATS, recentTopsMs: options.topDurationsS.map(() => null) };
  const tracks = active.map((p) => p.track);

  let distanceM = 0;
  let movingTimeMs = 0;
  let activeDistanceM = 0;
  let activeTimeMs = 0;
  for (const p of active) {
    distanceM += p.distanceM;
    movingTimeMs += p.movingTimeMs;
    activeDistanceM += p.active?.distanceM ?? 0;
    activeTimeMs += p.active?.timeMs ?? 0;
  }

  const lastTrack = tracks[tracks.length - 1];
  const lastMs = lastTrack[lastTrack.length - 1].timeMs;
  const sinceMs = lastMs - options.recentWindowS * 1000;

  let pointCount = 0;
  let withEle = 0;
  for (const entry of entries) {
    pointCount += entry.parts!.pointCount;
    withEle += entry.parts!.withEle;
  }
  const hasElevation = withEle / pointCount >= MIN_ELEVATION_COVERAGE;
  let gainM = 0;
  let lossM = 0;
  let recentGainM = 0;
  if (hasElevation) {
    active.forEach((p) => {
      const { track } = p;
      p.elevation ??= { stats: computeElevationStats(track, profile.elevation) };
      const elevation = p.elevation.stats;
      gainM += elevation.gainM;
      lossM += elevation.lossM;
      // Un segment fini avant la fenêtre récente n'y apporte rien.
      if (track[track.length - 1].timeMs >= sinceMs) {
        const recent = elevation.smoothed.filter((_, i) => track[i].timeMs >= sinceMs);
        recentGainM += accumulateElevation(recent, profile.elevation.minGainM).gainM;
      }
    });
  }

  let maxSpeedMs: number | null = null;
  for (const p of active) if (p.maxSpeedMs !== null && (maxSpeedMs === null || p.maxSpeedMs > maxSpeedMs)) maxSpeedMs = p.maxSpeedMs;

  let heartSum = 0;
  let heartCoveredS = 0;
  for (const entry of entries) {
    const heart = entry.parts!.heart;
    if (heart === null) continue;
    heartSum += heart.sum;
    heartCoveredS += heart.coveredS;
  }

  return {
    distanceM,
    movingTimeMs,
    currentSpeedMs: lastTrack[lastTrack.length - 1].smoothedSpeedMs,
    averageSpeedMs: movingTimeMs > 0 ? distanceM / (movingTimeMs / 1000) : null,
    activeAverageSpeedMs: activeTimeMs > 0 ? activeDistanceM / (activeTimeMs / 1000) : null,
    lastDistanceSpeedMs: lastDistanceSpeed(tracks, options.lastDistanceM),
    recentDistanceSpeedMs: lastDistanceSpeed(tracks, options.recentDistanceM),
    recentTopsMs: options.topDurationsS.map((d) => bestRecentTop(tracks, d, sinceMs)),
    maxSpeedMs,
    elevationGainM: hasElevation ? gainM : null,
    elevationLossM: hasElevation ? lossM : null,
    recentGainM: hasElevation ? recentGainM : null,
    legs: sailing ? combineLiveLegs(active.map((p) => p.legs!)) : EMPTY_LIVE_LEGS,
    averageHeartRateBpm: heartCoveredS > 0 ? heartSum / heartCoveredS : null,
  };
};
