import { describe, expect, it } from 'vitest';
import {
  EMPTY_ATHLETE_PROFILE, ATHLETE_NAME_MAX, athleteAge, athleteAvatar, athleteHrSource, athleteName, sanitizeAthleteProfile, type AthleteAvatar, type AthleteProfile,
} from './athleteProfile';

describe('athleteName', () => {
  it('rend le nom saisi, sans les espaces autour', () => {
    expect(athleteName({ name: '  Tom  ' })).toBe('Tom');
  });

  it('rend null sans nom, ou vide', () => {
    expect(athleteName({ name: null })).toBeNull();
    expect(athleteName({ name: '   ' })).toBeNull();
    expect(athleteName({} as { name: string | null })).toBeNull();
  });

  it('écarte une valeur qui n\'est pas du texte (fichier de réglages importé)', () => {
    expect(athleteName({ name: 42 as unknown as string })).toBeNull();
  });

  it('tronque un nom trop long', () => {
    expect(athleteName({ name: 'a'.repeat(60) })).toHaveLength(ATHLETE_NAME_MAX);
  });
});

describe('athleteAvatar', () => {
  it('reprend un dessin connu et une photo réduite', () => {
    expect(athleteAvatar({ avatar: { kind: 'dessin', icon: 'kite' } })).toEqual({ kind: 'dessin', icon: 'kite' });
    const photo = { kind: 'photo' as const, dataUrl: 'data:image/jpeg;base64,AAAA' };
    expect(athleteAvatar({ avatar: photo })).toEqual(photo);
  });

  it('écarte un profil sans photo, un dessin inconnu, une adresse qui n’est pas une image ou une image trop lourde', () => {
    expect(athleteAvatar({})).toBeNull();
    expect(athleteAvatar({ avatar: null })).toBeNull();
    expect(athleteAvatar({ avatar: { kind: 'dessin', icon: 'pétanque' } as unknown as AthleteAvatar })).toBeNull();
    expect(athleteAvatar({ avatar: { kind: 'photo', dataUrl: 'https://exemple.fr/moi.jpg' } })).toBeNull();
    expect(athleteAvatar({ avatar: { kind: 'photo', dataUrl: `data:image/jpeg;base64,${'A'.repeat(300_000)}` } })).toBeNull();
  });
});


describe('athleteHrSource', () => {
  it("rend l'origine rangée avec la FC", () => {
    const profile: Partial<AthleteProfile> = { hrMax: 192, hrMaxSource: { kind: 'test', atMs: 1_000 }, hrRest: 48, hrRestSource: { kind: 'seance', atMs: null } };
    expect(athleteHrSource(profile, 'hrMax')).toEqual({ kind: 'test', atMs: 1_000 });
    expect(athleteHrSource(profile, 'hrRest')).toEqual({ kind: 'seance', atMs: null });
  });

  it("dit saisie une FC d'avant les origines, ou à l'origine mal formée", () => {
    expect(athleteHrSource({ hrMax: 185 }, 'hrMax')).toEqual({ kind: 'saisie', atMs: null });
    expect(athleteHrSource({ hrMax: 185, hrMaxSource: { kind: 'labo' } as unknown as AthleteProfile['hrMaxSource'] }, 'hrMax')).toEqual({ kind: 'saisie', atMs: null });
  });

  it('rend null sans FC', () => {
    expect(athleteHrSource({ ...EMPTY_ATHLETE_PROFILE, hrMaxSource: { kind: 'test', atMs: 1 } }, 'hrMax')).toBeNull();
  });
});

describe('sanitizeAthleteProfile (fichier de réglages repris, lot 143)', () => {
  const GOAL = { min: 15, max: 600 };

  it('garde les champs valides et vide ceux hors plage ou de travers', () => {
    const p = sanitizeAthleteProfile({
      name: '  Léa ', weightKg: 62, heightCm: 1000, birthYear: '1990', sex: 'f', hrMax: 188,
      hrMaxSource: { kind: 'test', atMs: 5 }, hrRest: 10, hrRestSource: { kind: 'test', atMs: 5 },
      hrThresholds: [150, 140], economyMlKgKm: 200, rootWeeklyGoalMin: 5, autre: true,
    }, GOAL);
    expect(p).toEqual({
      name: 'Léa', avatar: null, weightKg: 62, heightCm: null, birthYear: null, sex: 'f',
      hrMax: 188, hrMaxSource: { kind: 'test', atMs: 5 }, hrRest: null, hrRestSource: null,
      hrThresholds: null, rootWeeklyGoalMin: null,
    });
  });

  it('rend un profil vide pour ce qui n’est pas un objet', () => {
    expect(sanitizeAthleteProfile('profil', GOAL)).toEqual(EMPTY_ATHLETE_PROFILE);
    expect(sanitizeAthleteProfile(null, GOAL)).toEqual(EMPTY_ATHLETE_PROFILE);
    expect(sanitizeAthleteProfile([1], GOAL)).toEqual(EMPTY_ATHLETE_PROFILE);
  });

  it('garde des seuils valides et un objectif dans sa plage', () => {
    const p = sanitizeAthleteProfile({ hrThresholds: [140, 165], rootWeeklyGoalMin: 120 }, GOAL);
    expect(p.hrThresholds).toEqual([140, 165]);
    expect(p.rootWeeklyGoalMin).toBe(120);
  });
});

describe('athleteAge', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();
  const born = (birthYear: number | null): AthleteProfile => ({ ...EMPTY_ATHLETE_PROFILE, birthYear });

  it('sans année de naissance, pas d’âge', () => {
    expect(athleteAge(EMPTY_ATHLETE_PROFILE, at(2026, 10, 4))).toBeNull();
  });

  it('année en cours moins année de naissance, sans regard pour l’anniversaire', () => {
    expect(athleteAge(born(1990), at(2026, 0, 1))).toBe(36);
    expect(athleteAge(born(1990), at(2026, 11, 31))).toBe(36);
    expect(athleteAge(born(1990), at(2027, 0, 1))).toBe(37);
  });

  it('année de naissance courante : 0', () => {
    expect(athleteAge(born(2026), at(2026, 5, 1))).toBe(0);
  });

  it('sans date donnée, prend la date du jour', () => {
    expect(athleteAge(born(2000))).toBe(new Date().getFullYear() - 2000);
  });
});
