import { describe, expect, it } from 'vitest';
import {
  ELEVATION_PRESETS, REFERENCE_HEART_RATE, SAILING_SPORTS, SPORT_FAMILIES, SPORT_PROFILES, UNCLASSIFIED_PROFILE,
  familySports, isSportType, sportFamily,
} from './sportProfiles';
import type { SportType } from './types';
import { guessActivityLogo, isLogoId } from './activityLogos';
import { ACTIVITY_PALETTE, BASE_COLOR, FAMILY_BASE } from './activities';

describe('chaque calcul est complet', () => {
  it('a son logo, quand le nom de l’activité ne dit rien', () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) expect(isLogoId(guessActivityLogo('', sport)), sport).toBe(true);
  });

  for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
    const p = SPORT_PROFILES[sport];
    it(`${sport} : identifiant, famille, couleur et sous-profils accordés`, () => {
      expect(p.id).toBe(sport);
      expect(SPORT_FAMILIES).toContain(p.family);
      expect(sportFamily(sport)).toBe(p.family);
      // Sa couleur de base est une couleur de la palette des activités.
      expect(ACTIVITY_PALETTE.map((c) => c.light)).toContain(BASE_COLOR[sport]);
      // Le module surf lit les vagues dans `surf` : tout calcul de la famille surf en a un, aucun autre.
      expect(p.surf !== null).toBe(p.family === 'surf');
      // `sailing/` lit les seuils en nœuds, `stillThreshold` compris.
      if (p.family === 'voile') expect(p.thresholdUnit).toBe('kn');
      expect(p.hrEnergy).not.toBeNull();
    });
  }

  it('chaque famille a son calcul par défaut, rangé chez elle', () => {
    for (const family of SPORT_FAMILIES) {
      expect(familySports(family).length, family).toBeGreaterThan(0);
      expect(sportFamily(FAMILY_BASE[family]), family).toBe(family);
    }
  });

  it('les supports à voile se déduisent de la famille', () => {
    expect(SAILING_SPORTS).toEqual(familySports('voile'));
    expect(SAILING_SPORTS).not.toContain('surf');
  });
});

describe('isSportType', () => {
  it('ne reconnaît que les supports du profil', () => {
    expect(isSportType('wingfoil')).toBe(true);
    expect(isSportType('surf')).toBe(true);
    // Ni la course ni l'Entraînement n'en sont.
    expect(isSportType('running')).toBe(false);
    expect(isSportType('muscu')).toBe(false);
    expect(isSportType('toString')).toBe(false);
    expect(isSportType(42)).toBe(false);
  });
});

describe('garde contre un enregistrement jamais repris', () => {
  it('la même pour tous les supports : 200 m, 1 h, et 12 h après la fermeture', () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
      const { guardStillRadiusM, guardStillDelayS, guardMaxClosedS } = SPORT_PROFILES[sport].recording;
      expect([guardStillRadiusM, guardStillDelayS, guardMaxClosedS], sport).toEqual([200, 3600, 43200]);
    }
  });
});

describe('références du transverse', () => {
  it('le cardio de référence, sans décalage (valeurs de la course d\'avant son retrait)', () => {
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
