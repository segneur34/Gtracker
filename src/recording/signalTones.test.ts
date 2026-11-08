import { describe, expect, it } from 'vitest';
import { TEST_SIGNAL_TONES } from './signalTones';

describe('TEST_SIGNAL_TONES', () => {
  it('un bip court, ou 2 ou 3 bips brefs serrés ; un long à la fin', () => {
    expect(TEST_SIGNAL_TONES.bien.map((t) => t.tone)).toEqual(['court']);
    expect(TEST_SIGNAL_TONES.trop.map((t) => t.tone)).toEqual(['bref', 'bref']);
    expect(TEST_SIGNAL_TONES.accelere.map((t) => t.tone)).toEqual(['bref', 'bref', 'bref']);
    expect(TEST_SIGNAL_TONES.accelere[2].delayMs).toBeLessThan(1000);
    expect(TEST_SIGNAL_TONES.trop.map((t) => t.delayMs)).toEqual([0, 165]);
    expect(TEST_SIGNAL_TONES.finTest.map((t) => t.tone)).toEqual(['long']);
  });
});
