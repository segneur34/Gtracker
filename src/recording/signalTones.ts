import { BRIEF_SPACING_MS } from '../core/beepDurations';
import type { ClockTone } from '../platform/beeper';

/**
 * Signaux sonores d'un guidage (lot 187) : les sons que jouent l'alerte de zone cardiaque et le test de FC de repos,
 * les mêmes partout pour que l'oreille les reconnaisse. Ceux du test de FC max (palier, fin de rampe) sont partis
 * avec lui (lot 302).
 */

/** Un signal du guidage : départ, dans la zone, trop haut, trop bas (accélérer), fin du test. */
export type TestSignal = 'debut' | 'bien' | 'trop' | 'accelere' | 'finTest';

/** Un bip court seul, ou n bips brefs rapprochés (« bip-bip ») pour trop vite et trop lent. */
const briefs = (n: number): ClockTone[] => Array.from({ length: n }, (_, i) => ({ delayMs: i * BRIEF_SPACING_MS, tone: 'bref' as const }));

export const TEST_SIGNAL_TONES: Record<TestSignal, ClockTone[]> = {
  debut: [{ delayMs: 0, tone: 'court' }],
  bien: [{ delayMs: 0, tone: 'court' }],
  trop: briefs(2),
  accelere: briefs(3),
  finTest: [{ delayMs: 0, tone: 'long' }],
};
