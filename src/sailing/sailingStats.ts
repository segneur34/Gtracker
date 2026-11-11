import { flightSpans, type FlightSpan } from '../core/pumping';
import { activeRuns, buildCumulativeTrack, buildBaseSessionStats, thresholdActivityMask } from '../core/sessionStats';
import { getActiveThresholds, getSportProfile, hasActiveThreshold, type SportProfile } from '../core/sportProfiles';
import { computeAllTopSegments } from '../core/topSegments';
import type { CumulativeTrack, SportType, TrackPoint } from '../core/types';
import { knotsToMs, msToKnots } from '../core/units';
import type { SessionStats } from './types';
import { SAILING_TOP_TARGETS } from './sailingConfig';

export interface SailingStatsOptions {
  /** Support analysé, qui fixe les défauts d'hystérésis. */
  sport: SportType;
  /**
   * Seuil d'activité en nœuds. Paramètre injecté : il vaut 8 en wingfoil mais
   * change selon le support, et l'utilisateur peut le régler. Ignoré en
   * bateau, sans seuil : toute la session y compte en navigation.
   */
  activeThresholdKn: number;
  /** Cumuls déjà calculés, pour ne pas reparcourir la trace. */
  cumulative?: CumulativeTrack;
  /**
   * Tops de vitesse déjà calculés (`computeSailingTops`) : ils ne dépendent
   * que de la trace, pas du seuil, et ne sont pas refaits à chaque réglage.
   */
  tops?: SessionStats['tops'];
  /** Masque d'activité au seuil déjà calculé (`sailingActivityMask`), partagé avec les vols. */
  activityMask?: boolean[];
  /**
   * Masque du ratio déjà calculé (`sailingRatioMask`) : il ne dépend pas du
   * seuil et n'est pas refait à chaque réglage. Ignoré en bateau, sans ratio.
   */
  ratioMask?: boolean[];
}

/** Masque d'activité d'une session à voile au seuil `activeThresholdKn` (tout en navigation en bateau, sans seuil). */
export const sailingActivityMask = (track: TrackPoint[], profile: SportProfile, activeThresholdKn: number): boolean[] =>
  thresholdActivityMask(track, profile, activeThresholdKn);

/**
 * Masque du dénominateur du ratio de vol (ou de navigation, de planing) : le
 * temps en mouvement, arrêts complets ôtés au plancher d'arrêt ; sur toute la session, une demi-heure passée à l'arrêt le divisait
 * par deux. Le bateau, sans seuil, n'a pas de ratio.
 */
export const sailingRatioMask = (track: TrackPoint[], profile: SportProfile): boolean[] | undefined =>
  hasActiveThreshold(profile) ? thresholdActivityMask(track, profile, 0) : undefined;

/** Tops de vitesse de la voile, en nœuds, sur les sept cibles du calcul. */
export const computeSailingTops = (track: TrackPoint[], cumulative: CumulativeTrack): SessionStats['tops'] => {
  const tops = computeAllTopSegments(track, cumulative, SAILING_TOP_TARGETS, msToKnots);
  return Object.fromEntries(SAILING_TOP_TARGETS.map(({ key }) => [key, tops[key]])) as SessionStats['tops'];
};

/**
 * Statistiques d'une session à voile : la base générique, plus les tops de
 * vitesse.
 */
export const buildSailingSessionStats = (
  track: TrackPoint[],
  options: SailingStatsOptions
): SessionStats | null => {
  if (track.length === 0) return null;

  const profile = getSportProfile(options.sport);
  const { activeThresholdKn } = options;
  const thresholds = getActiveThresholds(profile, activeThresholdKn);

  const cumulative = options.cumulative ?? buildCumulativeTrack(track);
  // Sans seuil (bateau) : toute la session en navigation, pauses de l'enregistrement et trous immobiles ôtés.
  const activityMask = options.activityMask ?? sailingActivityMask(track, profile, activeThresholdKn);
  // Ratio sur le temps en mouvement (`sailingRatioMask`) ; aucun en bateau.
  const ratioMask = hasActiveThreshold(profile) ? options.ratioMask ?? sailingRatioMask(track, profile) : undefined;

  const base = buildBaseSessionStats(track, {
    enterThresholdMs: knotsToMs(thresholds.enter),
    exitThresholdMs: knotsToMs(thresholds.exit),
    minStateDurationS: profile.minStateDurationS,
    cumulative,
    activityMask,
    ratioMask,
  });

  return { ...base, tops: options.tops ?? computeSailingTops(track, cumulative) };
};

/**
 * Vols d'une session de voile sur foil (pumping) : les suites du
 * masque d'activité au seuil de la session, celui des statistiques (temps et
 * ratio de vol) ; un trou de la trace parcouru en vol reste dans le vol, comme
 * dans le temps de vol (`activeRuns`) ; celles de moins de `minFlightS`
 * secondes ne sont pas listées. La détection n'est pas retouchée : c'est celle
 * des chiffres « en vol ». Rien en bateau, sans seuil.
 *
 * `threshold` : le seuil d'activité en nœuds, ou le masque d'activité déjà
 * calculé à ce seuil (`sailingActivityMask`), celui des statistiques.
 */
export const sailingFlights = (
  track: TrackPoint[], cumulative: CumulativeTrack, profile: SportProfile, threshold: number | boolean[], minFlightS: number
): FlightSpan[] => {
  if (track.length < 2 || !hasActiveThreshold(profile)) return [];
  const mask = typeof threshold === 'number' ? sailingActivityMask(track, profile, threshold) : threshold;
  return flightSpans(track, cumulative, activeRuns(track, mask), minFlightS);
};
