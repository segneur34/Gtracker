import { describe, expect, it } from 'vitest';
import type { SportType } from '../core/types';
import { sessionRecord } from '../test/record.fixture';
import { gpxOf, sailRaw, slowPolar, upDownLegs } from '../test/sailing.fixture';
import type { SessionAnalysis, SessionRecord } from './record';
import { summarizeGpx, summarizeGpxOptions } from './summarizeGpx';
import { analyzeGpx, type ActivitySummarySettings } from './summaryOptions';

/**
 * `summarizeGpx` (lot 126 B) : le résumé de la file, réglages résolus en table avant d'aller au worker, est celui
 * d'`analyzeGpx` avec les réglages lus par une fonction, à 1 Hz et à 5 Hz. Les options traversent un clonage
 * structuré sans rien perdre.
 */

const analysis = (patch: Partial<SessionAnalysis>): SessionAnalysis => ({
  windDeg: null, activeThreshold: null, referenceSpeedMs: null, speedRange: null, effortThresholdMs: null, foil: null, waveThreshold: null, ...patch,
} as SessionAnalysis);

/** Réglages de l'activité par calcul, différents d'un calcul à l'autre : une table mal résolue se verrait. */
const activityOf = (sport: SportType): ActivitySummarySettings => ({
  thresholdOverride: sport === 'kite' ? 1.5 : sport === 'wingfoil' ? 9 : sport === 'surf' ? 4 : undefined,
  foil: sport === 'surf' || sport === 'wingfoil' ? true : null,
});

/** Le même résumé par les deux chemins, options passées par un clonage structuré comme vers le worker. */
const both = (text: string, record: SessionRecord | undefined) => {
  const options = summarizeGpxOptions(record, activityOf);
  const direct = analyzeGpx(text, record ? record.sport : undefined, record?.analysis, activityOf);
  return { direct, viaTable: summarizeGpx(text, structuredClone(options)), options };
};

describe('summarizeGpx : le résumé d’analyzeGpx, réglages en table', () => {
  for (const hz of [1, 5]) {
    it(`voile avec allure imposée et seuil de la session, à ${hz} Hz`, () => {
      const text = gpxOf(sailRaw({ windDeg: 20, legs: upDownLegs(4, 60), hz }));
      const record = sessionRecord({ sport: 'wingfoil', analysis: analysis({ referenceSpeedMs: 5, activeThreshold: 7 }) });
      const { direct, viaTable, options } = both(text, record);
      expect(direct).not.toBeNull();
      expect(viaTable).toStrictEqual(direct);
      expect(Object.keys(options.activitySettings)).toEqual(['wingfoil']);
    });

    it(`kite et l'altitude du terrain d'une fiche, ignorée depuis le lot 303, à ${hz} Hz`, () => {
      const raw = sailRaw({ windDeg: 0, legs: upDownLegs(2, 120), hz, polar: slowPolar });
      const text = gpxOf(raw);
      const startMs = Date.parse(String(raw[0].time));
      const terrainElevation = {
        source: 'ign' as const, resource: 'test', version: 1, stepM: 20, fetchedAt: '2026-11-04T08:00:00Z', startMs,
        t: Array.from({ length: 24 }, (_, i) => i * 10_000), z: Array.from({ length: 24 }, (_, i) => 50 + (i % 6) * 3),
      };
      const record = sessionRecord({ sport: 'kite', terrainElevation });
      const { direct, viaTable } = both(text, record);
      expect(direct).not.toBeNull();
      expect(viaTable).toStrictEqual(direct);
      // L'altitude du terrain n'est plus substituée (lot 303) : l'altitude du GPS donne le même résumé.
      const gps = both(text, { ...record, elevationSource: 'gps' });
      expect(gps.viaTable).toStrictEqual(gps.direct);
      expect(gps.direct?.summary).toStrictEqual(direct?.summary);
    });

    it(`surf sur foil, à ${hz} Hz`, () => {
      const text = gpxOf(sailRaw({ windDeg: 90, legs: upDownLegs(3, 40), hz }));
      const record = sessionRecord({ sport: 'surf', analysis: analysis({ foil: true, waveThreshold: 6 }) });
      const { direct, viaTable } = both(text, record);
      expect(direct).not.toBeNull();
      expect(viaTable).toStrictEqual(direct);
    });
  }

  it('GPX neuf, calcul deviné du type de la trace : les cinq calculs en table', () => {
    const text = gpxOf(sailRaw({ windDeg: 0, legs: upDownLegs(2, 60), polar: slowPolar }), 'simple', { name: 'Vagues', type: 'surfing' });
    const { direct, viaTable, options } = both(text, undefined);
    expect(direct?.sport).toBe('surf');
    expect(viaTable).toStrictEqual(direct);
    expect(options.sport).toBeUndefined();
    expect(Object.keys(options.activitySettings)).toHaveLength(5);
    // Le calcul à deviner reste à deviner de l'autre côté du clonage.
    expect('sport' in structuredClone(options) && structuredClone(options).sport === undefined).toBe(true);
  });

  it('fiche sans calcul : aucun réglage, résumé sans calcul', () => {
    const text = gpxOf(sailRaw({ windDeg: 0, legs: upDownLegs(2, 60) }));
    const { direct, viaTable, options } = both(text, sessionRecord({ sport: null }));
    expect(options.activitySettings).toEqual({});
    expect(viaTable).toStrictEqual(direct);
  });

  it('moins de deux points : null ; XML illisible : la même erreur', () => {
    const one = gpxOf(sailRaw({ windDeg: 0, legs: [{ twa: 90, durationS: 0 }] }));
    expect(summarizeGpx(one, summarizeGpxOptions(sessionRecord({ sport: 'kite' }), activityOf))).toBeNull();
    expect(() => summarizeGpx('<gpx>', summarizeGpxOptions(undefined, activityOf))).toThrow(/illisible/);
  });

  it('table qui ne porte pas le calcul retenu : erreur, pas de réglages inventés', () => {
    const text = gpxOf(sailRaw({ windDeg: 0, legs: upDownLegs(2, 60) }));
    expect(() => summarizeGpx(text, { sport: 'kite', analysis: null, activitySettings: {}, elevation: null })).toThrow(/kite/);
  });
});
