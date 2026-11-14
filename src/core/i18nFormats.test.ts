import { afterEach, describe, expect, it } from 'vitest';
import { dayMonthYear, shortDate } from './calendar';
import { setLanguage } from './i18n';
import { commaDecimal, formatDecimal, formatDuration, formatSessionDate, parseDecimal } from './units';

afterEach(() => setLanguage('fr'));

/** Mercredi 14 octobre 2026, 10:02, heure locale (fuseau fixé par la mise en place des tests). */
const WHEN = new Date(2026, 9, 14, 10, 2).getTime();

describe('formats selon la langue', () => {
  it('français : virgule, dates et jours en français', () => {
    expect([formatDecimal(12.4), commaDecimal('12.4'), commaDecimal(3)]).toEqual(['12,4', '12,4', '3']);
    expect(formatSessionDate(WHEN)).toBe('mer. 14/10/2026 · 10:02');
    expect(shortDate(WHEN)).toBe('14 oct.');
    expect(formatDuration(1234 * 3600_000)).toBe('1 234 h 00');
  });

  it('anglais : point décimal, dates britanniques', () => {
    setLanguage('en', {});
    expect([formatDecimal(12.4), formatDecimal(-0.256, 2), commaDecimal('12.4')]).toEqual(['12.4', '-0.26', '12.4']);
    expect(parseDecimal(formatDecimal(12.4))).toBe(12.4);
    expect(formatSessionDate(WHEN)).toBe('Wed 14/10/2026 · 10:02');
    expect(dayMonthYear(WHEN)).toBe('14 Oct 2026');
    expect(formatDuration(1234 * 3600_000)).toBe('1,234 h 00');
  });

  it('espagnol : virgule, dates espagnoles', () => {
    setLanguage('es', {});
    expect(formatDecimal(12.4)).toBe('12,4');
    expect(shortDate(WHEN)).toBe(new Date(WHEN).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
    expect(formatSessionDate(WHEN)).toMatch(/^\S+ 14\/10\/2026 · 10:02$/);
  });

  it('un formateur de date suit le changement de langue', () => {
    expect(shortDate(WHEN)).toBe('14 oct.');
    setLanguage('en', {});
    expect(shortDate(WHEN)).toBe('14 Oct');
    setLanguage('fr');
    expect(shortDate(WHEN)).toBe('14 oct.');
  });
});
