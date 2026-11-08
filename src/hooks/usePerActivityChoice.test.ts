import { describe, expect, it } from 'vitest';
import { choiceFor } from './usePerActivityChoice';

describe('choiceFor', () => {
  it('sans choix fait sur la page : celui de Réglages', () => {
    expect(choiceFor(null, 'kite', true)).toBe(true);
    expect(choiceFor(null, 'kite', false)).toBe(false);
  });

  it('le choix fait pour cette activité prime, coché ou décoché', () => {
    expect(choiceFor({ activityId: 'kite', measure: false }, 'kite', true)).toBe(false);
    expect(choiceFor({ activityId: 'kite', measure: true }, 'kite', false)).toBe(true);
  });

  it("le choix fait pour une autre activité ne la suit pas ; sans activité, celui de Réglages", () => {
    expect(choiceFor({ activityId: 'kite', measure: false }, 'surf', true)).toBe(true);
    expect(choiceFor({ activityId: 'kite', measure: false }, null, true)).toBe(true);
  });
});
