import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonStore } from '../platform/storage';
import { getSportProfile } from '../core/sportProfiles';
import { ROOT_GOAL } from '../library/rootGrowth';
import { EMPTY_ATHLETE_PROFILE, ATHLETE_NAME_MAX, athleteHeartRateZones, storedAthleteProfile, type AthleteProfile } from '../library/athleteProfile';
import { missingProfileFields, shouldPromptProfile } from '../library/profilePrompt';
import { readAthleteProfile } from './useAthleteProfile';

describe('profil lu au premier rendu du pop-up', () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const full = { ...EMPTY_ATHLETE_PROFILE, name: 'Tom', birthYear: 1985, sex: 'm' as const, weightKg: 72, heightCm: 178 };
  const open = (profile: AthleteProfile) =>
    shouldPromptProfile({ native: true, missing: missingProfileFields(profile), askedThisLaunch: false, otherCardShown: false });

  it("ne s'ouvre pas quand le profil rempli est déjà rangé (régression : il revenait à chaque ouverture)", () => {
    jsonStore.write('tracker.runnerProfile', { me: full });
    expect(readAthleteProfile()).toMatchObject({ name: 'Tom', weightKg: 72 });
    expect(open(readAthleteProfile())).toBe(false);
  });

  it("s'ouvre quand rien n'est rangé", () => {
    expect(open(readAthleteProfile())).toBe(true);
  });
});

describe("profil repris d'un autre appareil, contrôlé champ par champ", () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const heartRate = getSportProfile('wingfoil').heartRate;

  it('une FC de repos écrite en texte est écartée : zones plausibles, plus de 5 098 bpm', () => {
    jsonStore.write('tracker.runnerProfile', { me: { hrMax: 190, hrRest: '50' } });
    const profile = readAthleteProfile();
    expect(profile.hrRest).toBeNull();
    expect(profile.hrMax).toBe(190);
    const zones = athleteHeartRateZones(profile, heartRate, 0)!;
    for (const bpm of [zones.s1, zones.s2, ...zones.bounds]) {
      expect(bpm).toBeGreaterThan(60);
      expect(bpm).toBeLessThanOrEqual(190);
    }
  });

  it('chaque champ hors de sa plage ou de la mauvaise forme est écarté, les autres restent', () => {
    const profile = storedAthleteProfile({ birthYear: '1985', weightKg: 900, heightCm: 178, sex: 'x', rootWeeklyGoalMin: 5, hrThresholds: 'a', inconnu: 1 }, ROOT_GOAL);
    expect(profile).toEqual({ ...EMPTY_ATHLETE_PROFILE, heightCm: 178 });
  });

  it("un profil valide est relu à l'identique", () => {
    const valid: AthleteProfile = {
      ...EMPTY_ATHLETE_PROFILE, name: 'Tom', weightKg: 72, heightCm: 178, birthYear: 1985, sex: 'm', hrMax: 190, hrMaxSource: { kind: 'test', atMs: 1000 },
      hrRest: 50, hrRestSource: { kind: 'saisie', atMs: null }, hrThresholds: [140, 170], rootWeeklyGoalMin: 120,
    };
    expect(storedAthleteProfile(valid, ROOT_GOAL)).toEqual(valid);
    jsonStore.write('tracker.runnerProfile', { me: valid });
    expect(readAthleteProfile()).toEqual(valid);
  });

  it('le nom reste tel que tapé, espaces de fin compris, sans dépasser sa longueur', () => {
    expect(storedAthleteProfile({ name: 'Jean ' }, ROOT_GOAL).name).toBe('Jean ');
    expect(storedAthleteProfile({ name: 'x'.repeat(ATHLETE_NAME_MAX + 5) }, ROOT_GOAL).name).toHaveLength(ATHLETE_NAME_MAX);
    expect(storedAthleteProfile({ name: 12 }, ROOT_GOAL).name).toBeNull();
    expect(storedAthleteProfile({ name: '   ' }, ROOT_GOAL).name).toBeNull();
  });

  it('rien de rangé ou une forme inattendue : le profil vide', () => {
    expect(readAthleteProfile()).toEqual(EMPTY_ATHLETE_PROFILE);
    expect(storedAthleteProfile('texte', ROOT_GOAL)).toEqual(EMPTY_ATHLETE_PROFILE);
    expect(storedAthleteProfile(null, ROOT_GOAL)).toEqual(EMPTY_ATHLETE_PROFILE);
  });
});
