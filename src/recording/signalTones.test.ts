import { describe, expect, it } from 'vitest';
import { GUIDE_SIGNAL_TONES } from './signalTones';

describe('GUIDE_SIGNAL_TONES', () => {
  it('un bip court, ou 2 ou 3 bips brefs serrés ; un long à la fin', () => {
    expect(GUIDE_SIGNAL_TONES.bien.map((t) => t.tone)).toEqual(['court']);
    expect(GUIDE_SIGNAL_TONES.trop.map((t) => t.tone)).toEqual(['bref', 'bref']);
    expect(GUIDE_SIGNAL_TONES.accelere.map((t) => t.tone)).toEqual(['bref', 'bref', 'bref']);
    expect(GUIDE_SIGNAL_TONES.accelere[2].delayMs).toBeLessThan(1000);
    expect(GUIDE_SIGNAL_TONES.trop.map((t) => t.delayMs)).toEqual([0, 165]);
    expect(GUIDE_SIGNAL_TONES.finGuide.map((t) => t.tone)).toEqual(['long']);
  });
});
