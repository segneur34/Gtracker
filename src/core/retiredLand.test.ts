import { describe, expect, it } from 'vitest';
import { BIKE_DEFAULT_KG, isBikeType, isEnergyModel, isValidBikeWeight, isValidCarriedLoad } from './retiredLand';

describe('restes de la terre gardés par les types (lot 303, retirés au 305)', () => {
  it('relit les valeurs rangées sans les changer', () => {
    expect(isEnergyModel('marche')).toBe(true);
    expect(isEnergyModel('velo')).toBe(false);
    expect(isValidCarriedLoad(0)).toBe(true);
    expect(isValidCarriedLoad(51)).toBe(false);
    expect(isBikeType('gravel')).toBe(true);
    expect(isBikeType('toString')).toBe(false);
    expect(isValidBikeWeight(12)).toBe(true);
    expect(isValidBikeWeight(2)).toBe(false);
  });

  it('garde le poids par défaut de chaque type de vélo', () => {
    expect(BIKE_DEFAULT_KG).toEqual({ route: 8.5, gravel: 12, vtt: 13, ville: 16 });
  });
});
