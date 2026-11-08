import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITIES, readActivities, type Activity } from './activities';
import { ACTIVITY_ICON_IDS, ACTIVITY_ICON_LABEL, activityIcon, guessActivityIcon, isActivityIconId } from './activityIcons';

const moth: Activity = { id: 'a-moth', name: 'Moth à foil', base: 'wingfoil', color: '#2e7d32' };

describe('icônes des activités', () => {
  it('chaque icône a son libellé', () => {
    expect(ACTIVITY_ICON_IDS).toHaveLength(9);
    expect(ACTIVITY_ICON_IDS.every((id) => ACTIVITY_ICON_LABEL[id].length > 0)).toBe(true);
    expect(isActivityIconId('kayak')).toBe(true);
    expect(isActivityIconId('pétanque')).toBe(false);
    expect(isActivityIconId('course')).toBe(false);
    expect(isActivityIconId(3)).toBe(false);
  });

  it('donne la sienne à chaque activité de départ', () => {
    expect(DEFAULT_ACTIVITIES.map(activityIcon)).toEqual(['wingfoil', 'surf', 'surf-foil']);
  });

  it('garde au Surf foil de départ son icône quand il est renommé', () => {
    const foil = DEFAULT_ACTIVITIES.find((a) => a.id === 'a-surf-foil')!;
    expect(activityIcon({ ...foil, name: 'Sortie du dimanche' })).toBe('surf-foil');
  });

  it('devine du nom, du plus précis au plus large', () => {

    expect(guessActivityIcon('Paddle foil', 'surf')).toBe('paddle-foil');
    expect(guessActivityIcon('SUP', 'surf')).toBe('paddle');
    expect(guessActivityIcon('Super session', 'surf')).toBe('surf');
    expect(guessActivityIcon('Kayak de mer', 'surf')).toBe('kayak');
    expect(guessActivityIcon('Randonnée', 'surf')).toBe('surf');
    expect(guessActivityIcon('Kitefoil', 'wingfoil')).toBe('kite');
    expect(guessActivityIcon('Dériveur', 'wingfoil')).toBe('bateau');
    expect(guessActivityIcon('Wing', 'kite')).toBe('wingfoil');
    expect(guessActivityIcon('Foil', 'surf')).toBe('surf-foil');
    expect(guessActivityIcon(moth.name, moth.base)).toBe('bateau');
  });

  it('se replie sur le calcul quand le nom ne dit rien', () => {
    expect(guessActivityIcon('Sortie', 'windsurf')).toBe('planche');
    expect(guessActivityIcon('Foil', 'wingfoil')).toBe('wingfoil');
    expect(guessActivityIcon('Régate', 'bateau')).toBe('bateau');
    expect(guessActivityIcon('Matin', 'surf')).toBe('surf');
  });

  it('le choix de Réglages prime, et se relit', () => {
    const chosen = { ...moth, icon: 'planche' as const };
    expect(activityIcon(chosen)).toBe('planche');
    // Une icône inconnue, ou de l'application complète (course, vélo, fractionné, lot 305), est ignorée.
    const [kept, ignored, land] = readActivities([chosen, { ...moth, id: 'a-autre', icon: 'pétanque' }, { ...moth, id: 'a-velo', icon: 'gravel' }]);
    expect('icon' in land).toBe(false);
    expect(kept).toEqual(chosen);
    expect('icon' in ignored).toBe(false);
  });
});
