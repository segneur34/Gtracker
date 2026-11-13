import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITIES, readActivities, type Activity } from './activities';
import {
  LEGACY_ICON_IDS, LOGO_FRAME_MIN_PX, LOGO_IDS, LOGO_LABEL, activityLogo, guessActivityBase, guessActivityLogo, isLogoId,
  legacyIconToLogo, logoRotation, storedLogo,
} from './activityLogos';

const moth: Activity = { id: 'a-moth', name: 'Moth à foil', base: 'wingfoil', color: '#2e7d32' };

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
    expect(Object.fromEntries(LEGACY_ICON_IDS.map((icon) => [icon, legacyIconToLogo(icon)]))).toEqual({
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

  it('tourne le cadre de 47 degrés d’un logo au suivant, comme sur la planche', () => {
    expect(Object.fromEntries(LOGO_IDS.map((logo) => [logo, logoRotation(logo)]))).toEqual({
      wingfoil: 0, parawing: 47, windsurf: 94, windfoil: 141, kite: 188, kitefoil: 235, bateau: 282,
      surf: 329, paddle: 16, 'surf-foil': 63, pumping: 110,
    });
  });

  it('la rotation ne dépend pas du rang de l’activité dans une liste', () => {
    const angles = (list: readonly Activity[]) => new Map(list.map((a) => [a.id, logoRotation(activityLogo(a))]));
    expect(angles([...DEFAULT_ACTIVITIES].reverse())).toEqual(angles(DEFAULT_ACTIVITIES));
  });
});

describe('logo d’une activité', () => {
  it('chaque activité de départ a son dessin propre', () => {
    const logos = DEFAULT_ACTIVITIES.map(activityLogo);
    expect(logos).toEqual([
      'wingfoil', 'parawing', 'windsurf', 'windfoil', 'kite', 'kitefoil', 'bateau', 'surf', 'paddle', 'surf-foil', 'pumping',
    ]);
    expect(new Set(logos).size).toBe(DEFAULT_ACTIVITIES.length);
  });

  it('garde aux activités de départ leur dessin quand elles sont renommées', () => {
    for (const activity of DEFAULT_ACTIVITIES) {
      expect(activityLogo({ ...activity, name: 'Sortie du dimanche' }), activity.id).toBe(activityLogo(activity));
    }
  });

  it('devine du nom, du plus précis au plus large', () => {
    expect(guessActivityLogo('Parawing', 'wingfoil')).toBe('parawing');
    expect(guessActivityLogo('Kitefoil', 'kite')).toBe('kitefoil');
    expect(guessActivityLogo('Kite foil', 'wingfoil')).toBe('kitefoil');
    expect(guessActivityLogo('Windfoil', 'windsurf')).toBe('windfoil');
    expect(guessActivityLogo('Pumping', 'surf')).toBe('pumping');
    expect(guessActivityLogo('Paddle foil', 'surf')).toBe('surf-foil');
    expect(guessActivityLogo('SUP foil', 'surf')).toBe('surf-foil');
    expect(guessActivityLogo('SUP', 'surf')).toBe('paddle');
    expect(guessActivityLogo('Super session', 'surf')).toBe('surf');
    expect(guessActivityLogo('Kayak de mer', 'surf')).toBe('paddle');
    expect(guessActivityLogo('Randonnée', 'surf')).toBe('surf');
    expect(guessActivityLogo('Dériveur', 'wingfoil')).toBe('bateau');
    expect(guessActivityLogo('Wing', 'kite')).toBe('wingfoil');
    expect(guessActivityLogo('Planche', 'wingfoil')).toBe('windsurf');
    expect(guessActivityLogo('Foil', 'surf')).toBe('surf-foil');
    expect(guessActivityLogo(moth.name, moth.base)).toBe('bateau');
  });

  it('se replie sur le calcul quand le nom ne dit rien', () => {
    expect(guessActivityLogo('Sortie', 'windsurf')).toBe('windsurf');
    expect(guessActivityLogo('Foil', 'wingfoil')).toBe('wingfoil');
    expect(guessActivityLogo('Régate', 'bateau')).toBe('bateau');
    expect(guessActivityLogo('Matin', 'kite')).toBe('kite');
    expect(guessActivityLogo('Matin', 'surf')).toBe('surf');
  });

  it('le choix de Réglages prime, et se relit', () => {
    const chosen = { ...moth, icon: 'windfoil' as const };
    expect(activityLogo(chosen)).toBe('windfoil');
    // Une ancienne icône se relit en son logo, une inconnue est ignorée.
    const [kept, legacy, ignored] = readActivities([
      chosen, { ...moth, id: 'a-ancienne', icon: 'kayak' }, { ...moth, id: 'a-autre', icon: 'pétanque' },
    ]);
    expect(kept).toEqual(chosen);
    expect(legacy.icon).toBe('paddle');
    expect('icon' in ignored).toBe(false);
  });
});

describe('calcul deviné d’une activité qu’on ajoute', () => {
  it('lit le nom, dans sa famille', () => {
    expect(guessActivityBase('Bateau', 'voile')).toBe('bateau');
    expect(guessActivityBase('Mon voilier', 'voile')).toBe('bateau');
    expect(guessActivityBase('Dériveur', 'voile')).toBe('bateau');
    expect(guessActivityBase('Catamaran', 'voile')).toBe('bateau');
    expect(guessActivityBase('Kite', 'voile')).toBe('kite');
    expect(guessActivityBase('Kitefoil', 'voile')).toBe('kite');
    expect(guessActivityBase('Planche', 'voile')).toBe('windsurf');
    expect(guessActivityBase('Windfoil', 'voile')).toBe('windsurf');
    expect(guessActivityBase('Wing', 'voile')).toBe('wingfoil');
    // « Parawing » ne dit rien au mot-clé : le premier calcul de la voile est le wingfoil.
    expect(guessActivityBase('Parawing', 'voile')).toBe('wingfoil');
    expect(guessActivityBase('Windsurf', 'voile')).toBe('windsurf');
    // Un nom qui ne dit rien : le premier calcul de la famille.
    expect(guessActivityBase('Sortie', 'voile')).toBe('wingfoil');
    expect(guessActivityBase('', 'voile')).toBe('wingfoil');
    // Famille respectée : un nom de voile en surf rend le premier calcul du surf.
    expect(guessActivityBase('Bateau', 'surf')).toBe('surf');
    expect(guessActivityBase('Kite', 'surf')).toBe('surf');
    expect(guessActivityBase('Paddle', 'surf')).toBe('surf');
  });
});
