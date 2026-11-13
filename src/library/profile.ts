/**
 * Profil : une période en un coup d'œil (totaux, répartition du temps par
 * activité), tiré des mêmes sessions et des mêmes totaux que les statistiques
 * (`stats.ts`). Logique pure ; l'heure est celle de l'appareil, comme le graphe
 * d'activités et les statistiques.
 */

import type { SportFamily } from '../core/sportProfiles';
import { groupTotals, type StatSession, type StatsTotals } from './stats';

/** Part d'une activité dans le temps total de la période. */
export interface ActivityShare {
  activityId: string;
  totals: StatsTotals;
  /** Fraction de la durée totale, de 0 à 1. */
  share: number;
}

/**
 * Répartition du temps par activité, de la plus longue à la plus courte ; à
 * durée égale, dans l'ordre des activités. Une activité sans session n'y est pas.
 */
export const activityShares = (sessions: readonly StatSession[], activityOrder: readonly string[]): ActivityShare[] => {
  const groups = groupTotals(sessions, (s) => s.activityId, activityOrder);
  const totalS = groups.reduce((n, g) => n + g.totals.durationS, 0);
  return groups
    .map((g) => ({ activityId: g.key, totals: g.totals, share: totalS > 0 ? g.totals.durationS / totalS : 0 }))
    .sort((a, b) => b.totals.durationS - a.totals.durationS);
};

/**
 * Sport préféré : l'activité qui a le plus de temps ; à durée égale, celle
 * pratiquée le plus récemment. `null` sans temps sur la période.
 */
export const favoriteActivity = (sessions: readonly StatSession[], activityOrder: readonly string[]): string | null => {
  const shares = activityShares(sessions, activityOrder);
  const top = shares[0];
  if (!top || top.totals.durationS <= 0) return null;
  const lastStart = (id: string): number => sessions.reduce((n, s) => (s.activityId === id ? Math.max(n, s.startMs) : n), -Infinity);
  return shares
    .filter((s) => s.totals.durationS === top.totals.durationS)
    .reduce((best, s) => (lastStart(s.activityId) > lastStart(best.activityId) ? s : best)).activityId;
};

/**
 * Les activités favorites : celles qui ont le plus de temps sur la période, au plus `count`, de la première à la
 * dernière place, avec leurs sessions et leur distance. À durée égale, celle qui a le plus de sessions, puis la
 * pratiquée le plus récemment, puis l'ordre des activités. Une activité sans temps n'y est pas.
 */
export const favoriteActivities = (sessions: readonly StatSession[], activityOrder: readonly string[], count = 3): ActivityShare[] => {
  const lastStart = new Map<string, number>();
  for (const s of sessions) lastStart.set(s.activityId, Math.max(lastStart.get(s.activityId) ?? -Infinity, s.startMs));
  return activityShares(sessions, activityOrder)
    .filter((s) => s.totals.durationS > 0)
    .sort((a, b) => b.totals.durationS - a.totals.durationS
      || b.totals.sessions - a.totals.sessions
      || (lastStart.get(b.activityId) ?? 0) - (lastStart.get(a.activityId) ?? 0))
    .slice(0, count);
};

/** Famille du sport préféré, qui choisit le fond des pages (`useFavoriteBackdrop`) ; `null` sans temps. */
export const favoriteFamily = (sessions: readonly StatSession[], activityOrder: readonly string[]): SportFamily | null => {
  const id = favoriteActivity(sessions, activityOrder);
  return id === null ? null : sessions.find((s) => s.activityId === id)?.family ?? null;
};
