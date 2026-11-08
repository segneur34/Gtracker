import { describe, expect, it } from 'vitest';
import { ELEVATION_PRESETS, REFERENCE_HEART_RATE, SAILING_SPORTS, SPORT_PROFILES, UNCLASSIFIED_PROFILE, isSportType } from './sportProfiles';
import type { SportType } from './types';

describe('isSportType', () => {
  it('ne reconnaît que les supports du profil', () => {
    expect(isSportType('wingfoil')).toBe(true);
    expect(isSportType('surf')).toBe(true);
    // Les calculs de l'application complète n'en sont plus (lot 305).
    expect(isSportType('running')).toBe(false);
    expect(isSportType('muscu')).toBe(false);
    expect(isSportType('toString')).toBe(false);
    expect(isSportType(42)).toBe(false);
  });
});

describe('hrEnergy', () => {
  it("n'est donné qu'en voile et en surf", () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
      const expected = SAILING_SPORTS.includes(sport) || sport === 'surf';
      expect(SPORT_PROFILES[sport].hrEnergy !== null, sport).toBe(expected);
    }
  });
});

describe('références du transverse (lot 187)', () => {
  it('le cardio de référence, sans décalage (valeurs de la course d\'avant le lot 305)', () => {
    expect(REFERENCE_HEART_RATE.thresholdOffsetBpm).toBe(0);
    expect([REFERENCE_HEART_RATE.maxAgeS, REFERENCE_HEART_RATE.smoothS, REFERENCE_HEART_RATE.gapS, REFERENCE_HEART_RATE.minCoverageS]).toEqual([3, 5, 10, 60]);
    expect(REFERENCE_HEART_RATE.loadWeights).toEqual([0.5, 1, 2, 3, 4, 5]);
    // Chaque calcul le décale, et seulement de son écart.
    expect({ ...SPORT_PROFILES.surf.heartRate, thresholdOffsetBpm: 0 }).toEqual(REFERENCE_HEART_RATE);
  });

  it("le profil d'une session sans calcul donne ce que la course donnait : dénivelé, fenêtre de vitesse max, cardio", () => {
    expect(UNCLASSIFIED_PROFILE.elevation).toBe(ELEVATION_PRESETS.route);
    expect(UNCLASSIFIED_PROFILE.maxSpeedWindowS).toBe(2);
    expect(UNCLASSIFIED_PROFILE.heartRate).toBe(REFERENCE_HEART_RATE);
  });
});
