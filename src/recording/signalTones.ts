import type { PatternTone } from '../platform/beeper';

/**
 * Signaux sonores du guidage du test de FC de repos (lot 187) : un court au départ, un long à la fin.
 */

/** Un signal du guidage : départ, fin du test. */
type GuideSignal = 'debut' | 'finGuide';

export const GUIDE_SIGNAL_TONES: Record<GuideSignal, PatternTone[]> = {
  debut: [{ delayMs: 0, tone: 'court' }],
  finGuide: [{ delayMs: 0, tone: 'long' }],
};
