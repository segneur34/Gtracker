import { describe, expect, it } from 'vitest';
import { shareableStats } from '../core/shareImage';
import { SAILING_SPORTS, getSportProfile, hasActiveThreshold } from '../core/sportProfiles';
import type { SessionSummary } from './record';
import { formatSessionDate } from '../core/units';
import { SHARE_EXTRA_KEYS, heartRateShareStats, shareExtraStats, shareLabels, summaryShareStats } from './shareStats';

describe('heartRateShareStats', () => {
  it('donne la FC moyenne arrondie quand la session a de la FC', () => {
    expect(heartRateShareStats({ present: true, stats: { avgBpm: 141.6 } })).toEqual([{ key: 'heartRate', label: 'FC moyenne', value: '142 bpm' }]);
  });
  it('ne donne rien sans FC suffisante ni statistiques', () => {
    expect(heartRateShareStats({ present: false, stats: { avgBpm: 141.6 } })).toEqual([]);
    expect(heartRateShareStats({ present: true, stats: null })).toEqual([]);
  });
});

const summary = (patch: Partial<SessionSummary> = {}): SessionSummary => ({
  calcVersion: 6,
  startMs: 0,
  endMs: 3600_000,
  distanceM: 10_000,
  movingTimeS: 3000,
  movingDistanceM: 9000,
  elevationGainM: 120,
  maxSpeedMs: 5,
  pointCount: 3600,
  samplingS: 1,
  ...patch,
});

const values = (stats: ReturnType<typeof summaryShareStats>) => Object.fromEntries(stats.map((s) => [s.key, s.value]));

describe('summaryShareStats', () => {
  it('donne en voile les chiffres de l\'onglet « général », sous les mêmes clés', () => {
    const v = values(summaryShareStats(summary(), 'voile', { speed: 'kmh', distance: 'km' }));
    expect(v.distance).toBe('10,00 km');
    expect(v.totalTime).toBe('1 h 00');
    expect(v.activeTime).toBe('50 min');
    expect(v.activeAverage).toBe('10,8 km/h');
    expect(v.averageSpeed).toBe('10,0 km/h');
    // Ni dénivelé ni cadence, partis avec la course et le vélo.
    expect(v.elevationGain).toBeUndefined();
  });

  it('un calcul sans seuil (bateau) montre « Temps en mouvement », jamais de temps actif ni en vol, foil ou non', () => {
    const units = { speed: 'kmh', distance: 'km' } as const;
    for (const sport of SAILING_SPORTS) {
      const withThreshold = hasActiveThreshold(getSportProfile(sport));
      for (const foil of [false, true]) {
        const stats = summaryShareStats(summary(), 'voile', units, withThreshold, foil);
        const keys = stats.map((s) => s.key);
        if (withThreshold) {
          expect(keys).toContain('activeTime');
          expect(keys).not.toContain('movingTime');
        } else {
          expect(keys).not.toContain('activeTime');
          expect(keys).not.toContain('activeRatio');
          expect(stats.find((s) => s.key === 'movingTime')).toEqual({ key: 'movingTime', label: 'Temps en mouvement', value: '50 min' });
          expect(stats.map((s) => s.label)).not.toContain('Temps en vol');
        }
      }
    }
    expect(SAILING_SPORTS.some((sport) => !hasActiveThreshold(getSportProfile(sport)))).toBe(true);
  });

  it("surf sans vague : vitesse max « — », jamais 0 ; écartée de l'image", () => {
    const units = { speed: 'kmh', distance: 'km' } as const;
    const none = summaryShareStats(summary({ maxSpeedMs: 0, waveCount: 0 }), 'surf', units);
    expect(values(none).maxSpeed).toBe('—');
    expect(shareableStats(none).map((s) => s.key)).not.toContain('maxSpeed');
    expect(values(summaryShareStats(summary({ maxSpeedMs: 5 }), 'surf', units)).maxSpeed).toBe('18,0 km/h');
  });

  it('donne en voile la moyenne active et les manœuvres, dans l\'unité de l\'activité', () => {
    const v = values(summaryShareStats(summary({ maneuverCount: 14 }), 'voile', { speed: 'kn', distance: 'nm' }));
    expect(v.activeAverage).toBe('5,8 nds');
    expect(v.maneuvers).toBe('14');
    expect(v.distance).toBe('5,40 NM');
  });

  it('donne en surf les vagues, sans vol hors foil', () => {
    const stats = shareableStats(summaryShareStats(summary({ waveCount: 12, longestWaveM: 84.4, longestFlightS: null }), 'surf', { speed: 'kmh', distance: 'km' }));
    const v = values(stats);
    expect(v.waves).toBe('12');
    expect(v.longestWave).toBe('84 m');
    expect(v.longestFlight).toBeUndefined();
  });
});

describe('lignes ajoutées du partage', () => {
  const kn = { speed: 'kn', distance: 'nm' } as const;
  const km = { speed: 'kmh', distance: 'km' } as const;
  const tail = (stats: ReturnType<typeof summaryShareStats>, n: number) => stats.slice(-n).map((s) => s.key);

  it('mêmes clés, à la fin, dans le résumé et dans l’analyse ouverte (`shareExtraStats`)', () => {
    for (const family of ['surf'] as const) {
      const keys = SHARE_EXTRA_KEYS[family];
      expect(tail(summaryShareStats(summary(), family, km), keys.length)).toEqual([...keys]);
      expect(shareExtraStats(family, {}).map((s) => s.key)).toEqual([...keys]);
    }
    expect(tail(summaryShareStats(summary(), 'voile', kn, true, true), 4)).toEqual([...SHARE_EXTRA_KEYS.voile]);
    // Hors foil, pas de pumping.
    expect(tail(summaryShareStats(summary(), 'voile', kn), 3)).toEqual(['maneuverSuccess', 'wind', 'rating']);
  });

  it('une valeur absente vaut « — »', () => {
    const v = values(summaryShareStats(summary(), 'surf', km));
    expect(v.rating).toBe('—');
    expect(values(summaryShareStats(summary(), 'voile', kn)).maneuverSuccess).toBe('—');
  });

  it('voile : manœuvres réussies, vent, appréciation, sans emoji', () => {
    const v = values(summaryShareStats(summary({ maneuverResults: { tackSuccess: 4, tackFail: 1, jibeSuccess: 6, jibeFail: 1 }, windDirDeg: 230 }), 'voile', kn, true, false,
      { rating: 4, windLevel: 'moyen' }));
    expect(v.maneuverSuccess).toBe('83 % (10/12)');
    expect(v.wind).toBe('230° · moyen');
    expect(v.rating).toBe('Bien');
    // Le vent saisi dans la fiche passe avant celui de l'analyse.
    expect(values(summaryShareStats(summary({ windDirDeg: 230 }), 'voile', kn, true, false, { windDeg: 10 })).wind).toBe('10°');
    expect(values(summaryShareStats(summary(), 'voile', kn)).wind).toBe('—');
  });

  it('voile sur foil seulement : ratio de vol et part du vol pompée', () => {
    const foil = values(summaryShareStats(summary({ movingTimeS: 2700, inMotionS: 3000, pumpingShare: 0.35 }), 'voile', kn, true, true));
    expect(foil.activeRatio).toBe('90,0%');
    expect(foil.pumpingShare).toBe('35 % du vol');
    const notFoil = values(summaryShareStats(summary({ inMotionS: 3000, pumpingShare: 0.35 }), 'voile', kn, true, false));
    expect(notFoil.activeRatio).toBeUndefined();
    expect(notFoil.pumpingShare).toBeUndefined();
  });

});

describe('shareLabels', () => {
  const startMs = new Date(2026, 9, 10, 14, 5).getTime();
  const place = { name: 'Carnon-Plage', source: 'carte' as const, lat: 43.549, lon: 3.981 };
  const date = formatSessionDate(startMs);

  it('session nommée : son nom en titre, l\'activité avec la date, le nom dans le fichier', () => {
    expect(shareLabels({ name: 'Soir', place }, 'Wingfoil', 'Voile', startMs, 'x.gpx'))
      .toEqual({ title: 'Soir', subtitle: `Wingfoil · ${date}`, baseName: '2026-10-10 Wingfoil - Soir' });
  });

  it('sans nom : le nom calculé en titre et le lieu dans le fichier ; sans lieu, l\'activité', () => {
    expect(shareLabels({ name: null, place }, 'Wingfoil', 'Voile', startMs, 'x.gpx'))
      .toEqual({ title: 'Wingfoil · Carnon-Plage', subtitle: date, baseName: '2026-10-10 Wingfoil - Carnon-Plage' });
    expect(shareLabels({ name: null }, 'Wingfoil', 'Voile', startMs, 'x.gpx'))
      .toEqual({ title: 'Wingfoil', subtitle: date, baseName: '2026-10-10 Wingfoil' });
  });

  it('hors de la mémoire et sans activité : la famille', () => {
    expect(shareLabels(null, null, 'Voile', startMs, 'x.gpx')).toEqual({ title: 'Voile', subtitle: date, baseName: '2026-10-10 Voile' });
  });
});
