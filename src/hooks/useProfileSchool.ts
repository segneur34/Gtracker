import { useMemo } from 'react';
import { sessionActivity } from '../core/activities';
import { athleteSchoolTrialSessions, type AthleteProfile } from '../library/athleteProfile';
import type { LibrarySession } from '../library/record';
import { useVisibility } from './useSportSettings';
import { brushColorFor } from '../core/brushColor';
import { fishForDuration } from '../core/schoolBasics';
import { useAppliedTheme } from './useTheme';

/** Ce que la couche du banc de poissons du Profil reçoit : son nombre de sessions et la couleur de chacune. */
export interface ProfileSchool {
  /** Nombre de sessions du banc : toutes celles de la bibliothèque, quelle que soit la période, ou le nombre imposé par le réglage d'essai. */
  sessions: number;
  /** Poissons de chaque session (de la plus ancienne à la plus récente), selon sa durée : 1 à 3. */
  fish: readonly number[];
  /**
   * Couleur d'activité de chaque session, vue du thème comme le pinceau des cadres (`brushColorFor` : éclaircie la nuit,
   * l'encre si elle se confond avec le fond), de la plus ancienne à la plus récente : la session de chaque poisson suit
   * cet ordre. `null` pour une session à classer (l'encre). Activités cachées comprises.
   */
  colors: readonly (string | null)[];
}

export const useProfileSchool = (
  sessions: readonly LibrarySession[],
  profile: Partial<Pick<AthleteProfile, 'schoolTrialSessions'>>,
): ProfileSchool => {
  const { activities } = useVisibility();
  const dark = useAppliedTheme().theme === 'dark';
  const colors = useMemo(
    () => [...sessions]
      .sort((a, b) => a.record.summary.startMs - b.record.summary.startMs)
      .map((s) => {
        const a = sessionActivity(activities, s.record.activityId, s.record.sport);
        return a ? brushColorFor(a.color, dark) : null;
      }),
    [sessions, activities, dark],
  );
  // Poissons de chaque session d'après sa durée totale, dans le même ordre que les couleurs ; le réglage d'essai donne
  // des sessions de durée inconnue, un poisson chacune.
  const trial = athleteSchoolTrialSessions(profile);
  const fish = useMemo(
    () => trial !== null
      ? Array.from({ length: trial }, () => fishForDuration(null))
      : [...sessions]
        .sort((a, b) => a.record.summary.startMs - b.record.summary.startMs)
        .map((s) => fishForDuration((s.record.summary.endMs - s.record.summary.startMs) / 1000)),
    [sessions, trial],
  );
  return { sessions: fish.length, fish, colors };
};
