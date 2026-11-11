import { describe, expect, it } from 'vitest';
import { SPORT_PROFILES } from '../core/sportProfiles';
import { effectiveWaveThreshold } from './surfSession';

describe('effectiveWaveThreshold', () => {
  const surfProfiles = Object.values(SPORT_PROFILES).filter((p) => p.surf !== null);

  it('des calculs de surf existent', () => {
    expect(surfProfiles.length).toBeGreaterThan(0);
  });

  it.each(surfProfiles.map((p) => [p.id, p] as const))('sans seuil réglé, celui du profil (%s)', (_id, profile) => {
    expect(effectiveWaveThreshold(profile.surf!, null)).toBe(profile.surf!.foilWaveThreshold);
  });

  it.each(surfProfiles.map((p) => [p.id, p] as const))('un seuil réglé prime, zéro compris (%s)', (_id, profile) => {
    expect(effectiveWaveThreshold(profile.surf!, 12.5)).toBe(12.5);
    expect(effectiveWaveThreshold(profile.surf!, 0)).toBe(0);
  });
});
