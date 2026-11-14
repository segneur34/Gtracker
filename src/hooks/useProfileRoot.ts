import { useMemo } from 'react';
import type { StatSession } from '../library/stats';
import { rootGrowth, type RootGrowth, type RootSession } from '../library/rootGrowth';
import { athleteRootGoalMin } from '../library/profilePrompt';
import type { AthleteProfile } from '../library/athleteProfile';

/** Ce que la racine retient d'une session : son début et son temps en mouvement, sinon sa durée. */
export const rootSessionsOf = (sessions: readonly StatSession[]): RootSession[] =>
  sessions.map((s) => ({ startMs: s.startMs, durationS: s.movingTimeS ?? (s.endMs - s.startMs) / 1000 }));

/**
 * Racine du Profil : son niveau, rejoué sur les sessions du Profil (classées,
 * visibles), toutes périodes confondues, avec l'objectif par semaine du
 * pratiquant. Le temps d'une session est son temps en mouvement, sinon sa durée.
 */
export const useProfileRoot = (sessions: readonly StatSession[], profile: AthleteProfile, nowMs: number): { growth: RootGrowth; goalMin: number } => {
  const goalMin = athleteRootGoalMin(profile);
  const growth = useMemo(() => rootGrowth(rootSessionsOf(sessions), goalMin, nowMs), [sessions, goalMin, nowMs]);
  return { growth, goalMin };
};
