import { describe, expect, it } from 'vitest';
import type { TrackPoint } from './types';
import { consecutiveSteps, pathsWhere } from './trackPaths';
import { sailTrack, upDownLegs } from '../test/sailing.fixture';

/**
 * Copie gelée d'un tracé conditionnel à la main (la boucle de `gradeZonePaths` avant le lot 70, sur un prédicat
 * quelconque) : `pathsWhere` doit la redonner. Fixture de voile depuis le retrait de la course (lot 303).
 */
const frozenPathsWhere = (track: TrackPoint[], keep: (i: number) => boolean): [number, number][][] => {
  const paths: [number, number][][] = [];
  let current: [number, number][] | null = null;
  for (let i = 1; i < track.length; i++) {
    if (!keep(i)) {
      current = null;
      continue;
    }
    if (current === null) {
      current = [[track[i - 1].lat, track[i - 1].lon]];
      paths.push(current);
    }
    current.push([track[i].lat, track[i].lon]);
  }
  return paths;
};

const pts = [0, 1, 2, 3, 4, 5].map((k) => ({ lat: k, lon: -k }));

describe('pathsWhere', () => {
  it('prolonge un tracé sur des pas qui se suivent, le coupe ailleurs', () => {
    const steps = [{ from: 0, to: 1 }, { from: 1, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 5 }];
    expect(pathsWhere(pts, steps, (s) => s.from !== 3)).toEqual([
      [[0, -0], [1, -1], [2, -2], [3, -3]],
      [[4, -4], [5, -5]],
    ]);
    expect(pathsWhere(pts, consecutiveSteps(pts.length), () => false)).toEqual([]);
  });

  it('redonne la copie gelée à l’identique, 1 Hz et 5 Hz, sur une session de wing et un seuil de vitesse', () => {
    for (const hz of [1, 5]) {
      const { track } = sailTrack({ windDeg: 0, legs: upDownLegs(4), hz, seed: 3 });
      for (const thresholdMs of [3, 5, 7]) {
        const fast = (i: number) => (track[i].smoothedSpeedMs ?? 0) >= thresholdMs;
        const expected = frozenPathsWhere(track, fast);
        expect(expected.length).toBeGreaterThan(0);
        expect(pathsWhere(track, consecutiveSteps(track.length), (s) => fast(s.to))).toEqual(expected);
      }
    }
  });
});
