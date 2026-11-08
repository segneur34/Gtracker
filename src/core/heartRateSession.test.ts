import { describe, expect, it } from 'vitest';
import { activeDurationS, heartRatePointsFrom, heartRatePreviewPath } from './heartRateSession';

const T0 = Date.UTC(2026, 9, 28, 18, 0, 0);

describe('heartRatePointsFrom et activeDurationS', () => {
  it('lit les heures, garde la reprise, écarte un point qui ne vient pas après le précédent', () => {
    const p = heartRatePointsFrom([
      { time: new Date(T0).toISOString(), hr: 90 },
      { time: new Date(T0 + 1000).toISOString() },
      { time: new Date(T0 + 1000).toISOString(), hr: 95 },
      { time: new Date(T0 + 60_000).toISOString(), hr: 100, segmentStart: true },
      { time: new Date(T0 + 70_000).toISOString(), hr: 101 },
    ]);
    expect(p).toEqual([
      { timeMs: T0, hr: 90 }, { timeMs: T0 + 1000 }, { timeMs: T0 + 60_000, hr: 100, segmentStart: true }, { timeMs: T0 + 70_000, hr: 101 },
    ]);
    // Le pas qui mène à la reprise (la pause) n'est pas compté.
    expect(activeDurationS(p)).toBe(11);
  });
});

describe('heartRatePreviewPath', () => {
  it('trace la FC de bas en haut dans le cadre, coupée où elle manque ; rien sans deux FC', () => {
    const pts = [0, 1, 2, 3, 4].map((k) => ({ timeMs: T0 + k * 1000 }));
    expect(heartRatePreviewPath(pts, [100, 120, null, 110, 100], 100, 50, 100)).toBe('M0.0 50.0L25.0 0.0M75.0 25.0L100.0 50.0');
    expect(heartRatePreviewPath(pts, [100, null, null, null, null], 100, 50, 100)).toBeNull();
  });

  it('tient une série de 200 000 valeurs (pas de Math.min sur la série entière)', () => {
    const n = 200_000;
    const pts = Array.from({ length: n }, (_, k) => ({ timeMs: T0 + k * 200 }));
    const bpm = pts.map((_, k) => 100 + (k % 50));
    const path = heartRatePreviewPath(pts, bpm, 100, 49, 10)!;
    expect(path.startsWith('M0.0 49.0')).toBe(true);
  });
});
