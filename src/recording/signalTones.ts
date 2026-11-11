import { BRIEF_SPACING_MS } from '../core/beepDurations';
import type { PatternTone } from '../platform/beeper';

/**
 * Signaux sonores d'un guidage (lot 187) : les sons que jouent l'alerte de zone cardiaque et le test de FC de repos,
 * les mêmes partout pour que l'oreille les reconnaisse.
 */

/** Un signal du guidage : départ, dans la zone, trop haut, trop bas (accélérer), fin du test. */
export type GuideSignal = 'debut' | 'bien' | 'trop' | 'accelere' | 'finGuide';

/** Un bip court seul, ou n bips brefs rapprochés (« bip-bip ») pour trop vite et trop lent. */
const briefs = (n: number): PatternTone[] => Array.from({ length: n }, (_, i) => ({ delayMs: i * BRIEF_SPACING_MS, tone: 'bref' as const }));

export const GUIDE_SIGNAL_TONES: Record<GuideSignal, PatternTone[]> = {
  debut: [{ delayMs: 0, tone: 'court' }],
  bien: [{ delayMs: 0, tone: 'court' }],
  trop: briefs(2),
  accelere: briefs(3),
  finGuide: [{ delayMs: 0, tone: 'long' }],
};
