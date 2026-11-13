import { describe, expect, it } from 'vitest';
import { FISH_LEVELS, FISH_RULES, fishGrowth, fishLevelOf, fishShown, isFishLevel, isFishPath, isFishStyle } from './fishGrowth';

/** Lundi 6 janvier 2025, 10 h, heure de l'appareil : début de la semaine 0. */
const week = (i: number, day = 0, hour = 10): number => new Date(2025, 0, 6 + 7 * i + day, hour).getTime();
/** Une session de `min` minutes le lundi de chacune des semaines données. */
const sessions = (weeks: readonly number[], min = 60) => weeks.map((i) => ({ startMs: week(i), durationS: min * 60 }));
const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => from + i);
const GOAL = 45;

describe('fishLevelOf', () => {
  it('règle fixée : paliers à 2, 5, 9, 14 et 20 semaines', () => {
    expect(FISH_RULES.thresholds).toEqual([2, 5, 9, 14, 20]);
    expect(FISH_LEVELS).toBe(6);
  });

  it('chaque palier à sa semaine', () => {
    expect([0, 1, 2, 4, 5, 8, 9, 13, 14, 19, 20].map((w) => fishLevelOf(w))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  });

  it('plafond à 6', () => {
    expect(fishLevelOf(200)).toBe(6);
    expect(fishLevelOf(5, { thresholds: [1, 2, 3, 4, 5, 6, 7] })).toBe(6);
  });
});

describe('fishGrowth', () => {
  it('aucune session : l’alevin', () => {
    expect(fishGrowth([], GOAL, week(10))).toEqual({ level: 1, heldWeeks: 0, nextAtWeeks: 2 });
  });

  it('les semaines tenues font monter, palier par palier', () => {
    expect(fishGrowth(sessions(range(2)), GOAL, week(2)).level).toBe(2);
    expect(fishGrowth(sessions(range(4)), GOAL, week(4))).toEqual({ level: 2, heldWeeks: 4, nextAtWeeks: 5 });
    expect(fishGrowth(sessions(range(5)), GOAL, week(5)).level).toBe(3);
    expect(fishGrowth(sessions(range(14)), GOAL, week(14)).level).toBe(5);
    expect(fishGrowth(sessions(range(20)), GOAL, week(20))).toEqual({ level: 6, heldWeeks: 20, nextAtWeeks: null });
    expect(fishGrowth(sessions(range(40)), GOAL, week(40)).level).toBe(6);
  });

  it('des semaines manquées ne font pas reculer', () => {
    // neuf semaines tenues, puis six mois sans rien : toujours le niveau 4
    const g = fishGrowth(sessions(range(9)), GOAL, week(40));
    expect(g).toEqual({ level: 4, heldWeeks: 9, nextAtWeeks: 14 });
    // tenues une semaine sur deux : chacune compte
    expect(fishGrowth(sessions([0, 2, 4, 6, 8]), GOAL, week(9)).level).toBe(3);
  });

  it('la semaine en cours compte dès qu’elle est tenue', () => {
    expect(fishGrowth(sessions([0]), GOAL, week(0, 3)).heldWeeks).toBe(1);
    expect(fishGrowth(sessions([0, 1]), GOAL, week(1, 2)).level).toBe(2);
  });

  it('une semaine sous l’objectif ne compte pas, deux séances la tiennent', () => {
    expect(fishGrowth(sessions(range(5), 30), GOAL, week(5)).heldWeeks).toBe(0);
    const twice = [...sessions(range(5), 30), ...range(5).map((i) => ({ startMs: week(i, 2), durationS: 30 * 60 }))];
    expect(fishGrowth(twice, GOAL, week(5)).level).toBe(3);
  });

  it('une session future est ignorée', () => {
    expect(fishGrowth(sessions([0, 1, 30]), GOAL, week(5)).heldWeeks).toBe(2);
  });
});

describe('fishShown', () => {
  it('sans essai : le niveau atteint, débloqué jusqu’à lui', () => {
    expect(fishShown({ level: 3 }, null)).toEqual({ level: 3, unlocked: 3 });
  });

  it('un essai impose le niveau et les niveaux débloqués, plus haut ou plus bas', () => {
    expect(fishShown({ level: 2 }, 6)).toEqual({ level: 6, unlocked: 6 });
    expect(fishShown({ level: 5 }, 1)).toEqual({ level: 1, unlocked: 1 });
  });

  it('un essai hors de 1 à 6 est sans effet', () => {
    expect(fishShown({ level: 2 }, 7)).toEqual({ level: 2, unlocked: 2 });
    expect(fishShown({ level: 2 }, 2.5)).toEqual({ level: 2, unlocked: 2 });
  });
});

describe('contrôles des choix', () => {
  it('style, voie et niveau inconnus refusés', () => {
    expect(['A', 'B', 'F', 'G'].every(isFishStyle)).toBe(true);
    expect(isFishStyle('C')).toBe(false);
    expect(['beau', 'agressif', 'lesDeux'].every(isFishPath)).toBe(true);
    expect(isFishPath('joli')).toBe(false);
    expect([1, 6].every(isFishLevel)).toBe(true);
    expect([0, 7, 3.5, '3', null].some(isFishLevel)).toBe(false);
  });
});
