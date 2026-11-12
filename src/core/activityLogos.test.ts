import { describe, expect, it } from 'vitest';
import { ACTIVITY_ICON_IDS } from './activityIcons';
import { LOGO_FRAME_MIN_PX, LOGO_IDS, LOGO_LABEL, isLogoId, legacyIconToLogo, logoRotation, storedLogo } from './activityLogos';

describe('logos des activités', () => {
  it('onze logos, chacun son libellé', () => {
    expect(LOGO_IDS).toHaveLength(11);
    expect(new Set(LOGO_IDS).size).toBe(11);
    expect(LOGO_IDS.every((id) => LOGO_LABEL[id].length > 0)).toBe(true);
    expect(new Set(Object.values(LOGO_LABEL)).size).toBe(11);
    expect(isLogoId('surf-foil')).toBe(true);
    expect(isLogoId('surffoil')).toBe(false);
    expect(isLogoId('planche')).toBe(false);
    expect(isLogoId(3)).toBe(false);
    expect(LOGO_FRAME_MIN_PX).toBe(40);
  });

  it('chaque ancienne icône a son logo', () => {
    expect(Object.fromEntries(ACTIVITY_ICON_IDS.map((icon) => [icon, legacyIconToLogo(icon)]))).toEqual({
      bateau: 'bateau', planche: 'windsurf', wingfoil: 'wingfoil', kite: 'kite', surf: 'surf',
      'surf-foil': 'surf-foil', kayak: 'paddle', paddle: 'paddle', 'paddle-foil': 'surf-foil',
    });
  });

  it('relit un choix enregistré, logo ou ancienne icône', () => {
    expect(storedLogo('parawing')).toBe('parawing');
    expect(storedLogo('kite')).toBe('kite');
    expect(storedLogo('planche')).toBe('windsurf');
    expect(storedLogo('kayak')).toBe('paddle');
    expect(storedLogo('paddle-foil')).toBe('surf-foil');
    expect(storedLogo('pétanque')).toBeUndefined();
    expect(storedLogo('toString')).toBeUndefined();
    expect(storedLogo(undefined)).toBeUndefined();
  });

  it('tourne le cadre selon l’identifiant, pas selon le rang', () => {
    const ids = ['wingfoil', 'a-parawing', 'windsurf', 'a-windfoil', 'kite', 'a-kitefoil', 'bateau', 'surf', 'a-paddle', 'a-surf-foil', 'a-pumping'];
    const angles = new Map(ids.map((id) => [id, logoRotation(id)]));
    const reversed = [...ids].reverse().map((id) => [id, logoRotation(id)] as const);
    expect(new Map(reversed)).toEqual(angles);
    for (const angle of angles.values()) {
      expect(Number.isInteger(angle)).toBe(true);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    }
    expect(new Set(angles.values()).size).toBeGreaterThan(8);
    // Valeurs figées : un hachage changé ferait tourner tous les cadres déjà vus.
    expect([logoRotation('wingfoil'), logoRotation('kite'), logoRotation('surf'), logoRotation('a-pumping')]).toEqual([220, 238, 1, 303]);
    expect(logoRotation('')).toBe(logoRotation(''));
  });
});
