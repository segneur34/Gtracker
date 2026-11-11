import { describe, expect, it } from 'vitest';
import { GUIDE_SIGNAL_TONES } from './signalTones';

describe('GUIDE_SIGNAL_TONES', () => {
  it('un court au départ, un long à la fin', () => {
    expect(GUIDE_SIGNAL_TONES.debut.map((t) => t.tone)).toEqual(['court']);
    expect(GUIDE_SIGNAL_TONES.finGuide.map((t) => t.tone)).toEqual(['long']);
  });
});
