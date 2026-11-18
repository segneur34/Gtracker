import { describe, expect, it } from 'vitest';
import type { WaveSense } from '../../surfing/waveSense';
import { waveSenseView } from './waveSenseView';

const estimated = (directionDeg: number, R: number, reliable: boolean): WaveSense => ({ directionDeg, R, samples: 5, reliable, source: 'estime' });

describe('waveSenseView : saisi lu dans le brouillon, calculé dans l’analyse', () => {
  it('un sens saisi prime tout de suite, même si l’analyse porte encore l’ancien', () => {
    expect(waveSenseView(120, estimated(200, 0.9, true))).toEqual({ shownDeg: 120, manual: true, reliable: true, autoDeg: 200 });
  });

  it('saisi sans calcul exploitable : pas de calculé rappelé', () => {
    expect(waveSenseView(90, null).autoDeg).toBeNull();
    expect(waveSenseView(90, estimated(200, 0.3, false)).autoDeg).toBeNull();
  });

  it('rien de saisi : le calculé est montré, sûr ou non', () => {
    expect(waveSenseView(null, estimated(200.4, 0.9, true))).toEqual({ shownDeg: 200, manual: false, reliable: true, autoDeg: null });
    expect(waveSenseView(null, estimated(359.6, 0.6, false))).toEqual({ shownDeg: 0, manual: false, reliable: false, autoDeg: null });
  });

  it('rien de saisi et calcul trop dispersé ou absent : non estimé', () => {
    expect(waveSenseView(null, estimated(200, 0.3, false)).shownDeg).toBeNull();
    expect(waveSenseView(null, null).shownDeg).toBeNull();
  });
});
