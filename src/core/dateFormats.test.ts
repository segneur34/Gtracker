import { afterEach, describe, expect, it } from 'vitest';
import { dateNumeric, dayMonthNumeric, monthNarrow, timeShort, weekdayDay, weekdayDayMonthLong, weekdayNarrow } from './calendar';
import { setLanguage, dateLocale, type Lang } from './i18n';

afterEach(() => setLanguage('fr'));

/**
 * Sorties gelées des écritures locales de date et d'heure d'avant leur ramenée aux formateurs de `calendar.ts` :
 * les mêmes appels de `toLocale*String`, une locale par langue de l'interface. Minuit, un jour et une heure à un
 * chiffre, une année différente.
 */
const SAMPLES = [new Date(2026, 9, 14, 0, 0), new Date(2026, 0, 3, 9, 5), new Date(2020, 11, 31, 23, 59)];

const LEGACY = {
  timeShort: (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }),
  weekdayDay: (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' }),
  dateNumeric: (d: Date) => d.toLocaleDateString(dateLocale()),
  dayMonthNumeric: (d: Date) => d.toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit' }),
  weekdayDayMonthLong: (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }),
};

const FROZEN: Record<Lang, Record<keyof typeof LEGACY, string[]>> = {
  fr: {
    timeShort: ['00:00', '09:05', '23:59'],
    weekdayDay: ['mer. 14', 'sam. 3', 'jeu. 31'],
    dateNumeric: ['14/10/2026', '03/01/2026', '31/12/2020'],
    dayMonthNumeric: ['14/10', '03/01', '31/12'],
    weekdayDayMonthLong: ['mercredi 14 octobre', 'samedi 3 janvier', 'jeudi 31 décembre'],
  },
  en: {
    timeShort: ['00:00', '09:05', '23:59'],
    weekdayDay: ['Wed 14', 'Sat 3', 'Thu 31'],
    dateNumeric: ['14/10/2026', '03/01/2026', '31/12/2020'],
    dayMonthNumeric: ['14/10', '03/01', '31/12'],
    weekdayDayMonthLong: ['Wednesday 14 October', 'Saturday 3 January', 'Thursday 31 December'],
  },
  es: {
    timeShort: ['00:00', '09:05', '23:59'],
    weekdayDay: ['mié 14', 'sáb 3', 'jue 31'],
    dateNumeric: ['14/10/2026', '3/1/2026', '31/12/2020'],
    dayMonthNumeric: ['14/10', '3/1', '31/12'],
    weekdayDayMonthLong: ['miércoles, 14 de octubre', 'sábado, 3 de enero', 'jueves, 31 de diciembre'],
  },
};

/** Initiales d'un jour (lundi 1er janvier 2024 et les suivants) et d'un mois, là où la langue n'a pas de table. */
const FROZEN_NARROW: Record<Lang, { weekdays: string[]; months: string[] }> = {
  fr: { weekdays: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], months: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
  en: { weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], months: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
  es: { weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], months: ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
};

const LANGS: Lang[] = ['fr', 'en', 'es'];

/** Les formateurs de `calendar.ts` qui ont remplacé chaque écriture locale. */
const COMMON = { timeShort, weekdayDay, dateNumeric, dayMonthNumeric, weekdayDayMonthLong };
const DAYS_2024 = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2024, 0, 1 + i));
const MONTHS_2024 = [...Array(12).keys()].map((m) => new Date(2024, m, 1));

describe('écritures locales de date et d’heure, gelées', () => {
  for (const lang of LANGS) {
    it(`${lang} : mêmes textes qu’avant`, () => {
      setLanguage(lang, {});
      for (const [name, legacy] of Object.entries(LEGACY)) {
        expect(SAMPLES.map(legacy), name).toEqual(FROZEN[lang][name as keyof typeof LEGACY]);
      }
      expect(DAYS_2024.map((d) => d.toLocaleDateString(dateLocale(), { weekday: 'narrow' }))).toEqual(FROZEN_NARROW[lang].weekdays);
      expect(MONTHS_2024.map((d) => d.toLocaleDateString(dateLocale(), { month: 'narrow' }))).toEqual(FROZEN_NARROW[lang].months);
    });

    it(`${lang} : les formateurs communs rendent les mêmes textes`, () => {
      setLanguage(lang, {});
      for (const [name, common] of Object.entries(COMMON)) {
        const expected = FROZEN[lang][name as keyof typeof LEGACY];
        expect(SAMPLES.map((d) => common(d)), name).toEqual(expected);
        expect(SAMPLES.map((d) => common(d.getTime())), `${name} (ms)`).toEqual(expected);
      }
      expect(DAYS_2024.map((d) => weekdayNarrow(d))).toEqual(FROZEN_NARROW[lang].weekdays);
      expect(MONTHS_2024.map((d) => monthNarrow(d))).toEqual(FROZEN_NARROW[lang].months);
    });
  }

  it('une date invalide donne « Invalid Date », comme toLocale*String', () => {
    for (const common of [timeShort, weekdayDay, dateNumeric, weekdayDayMonthLong]) expect(common(new Date('pas une date'))).toBe('Invalid Date');
    expect(new Date('pas une date').toLocaleDateString(dateLocale())).toBe('Invalid Date');
  });
});
