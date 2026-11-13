import { useMemo } from 'react';
import type { StatSession } from '../library/stats';
import { fishGrowth, fishShown, type FishGrowth, type FishPath, type FishStyle } from '../library/fishGrowth';
import { athleteRootGoalMin } from '../library/profilePrompt';
import { athleteFishPath, athleteFishStyle, athleteFishTrialLevel, type AthleteProfile } from '../library/athleteProfile';
import { rootSessionsOf } from './useProfileRoot';

export interface ProfileFish {
  /** Niveau gagné par les semaines tenues. */
  growth: FishGrowth;
  /** Niveau montré : celui de l'essai s'il est réglé, sinon celui gagné. */
  level: number;
  /** Niveaux débloqués, de 1 à `unlocked`. */
  unlocked: number;
  style: FishStyle;
  path: FishPath;
  /** Niveau d'essai réglé dans Pratiquant, `null` : automatique. */
  trialLevel: number | null;
}

/**
 * Poisson du Profil : son niveau, rejoué sur les mêmes sessions que la racine (classées, visibles, toutes périodes
 * confondues) avec l'objectif par semaine du pratiquant, puis le style, la voie et l'essai rangés dans son profil.
 */
export const useProfileFish = (sessions: readonly StatSession[], profile: AthleteProfile, nowMs: number): ProfileFish => {
  const goalMin = athleteRootGoalMin(profile);
  const growth = useMemo(() => fishGrowth(rootSessionsOf(sessions), goalMin, nowMs), [sessions, goalMin, nowMs]);
  const trialLevel = athleteFishTrialLevel(profile);
  const { level, unlocked } = fishShown(growth, trialLevel);
  return { growth, level, unlocked, style: athleteFishStyle(profile), path: athleteFishPath(profile), trialLevel };
};
