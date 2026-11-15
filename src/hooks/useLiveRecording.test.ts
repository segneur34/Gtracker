import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseActivity } from '../core/activities';
import type { LocationFix } from '../platform/location';

/** État de l'enregistreur, tenu par le test. */
const recorder = vi.hoisted(() => ({
  state: { status: 'recording', activity: null as unknown, stats: { pointCount: 0 } },
  segments: [[]] as unknown[][],
  listeners: [] as (() => void)[],
}));

vi.mock('./useRecorder', () => ({
  getRecorderState: () => recorder.state,
  getLiveSegments: () => recorder.segments,
  getLiveHeartSegments: () => [],
  subscribeToRecorder: (listener: () => void) => {
    recorder.listeners.push(listener);
    return () => {};
  },
}));

/** Calcul du direct qui lève à la demande, comme une erreur du calcul sur une trace inattendue. */
const failing = vi.hoisted(() => ({ on: false }));
vi.mock('../recording/liveStats', async (importOriginal) => {
  const original = await importOriginal<typeof import('../recording/liveStats')>();
  return {
    ...original,
    computeLiveStats: (...args: Parameters<typeof original.computeLiveStats>) => {
      if (failing.on) throw new Error('calcul en panne');
      return original.computeLiveStats(...args);
    },
  };
});

// Une page qui lit le direct : sans rendu, seul son abonnement compte ici.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useSyncExternalStore: (subscribe: (listener: () => void) => () => void, get: () => unknown) => {
    subscribe(() => {});
    return get();
  },
}));

/**
 * Le direct, neuf à chaque test, avec un enregistrement vide : son rythme se lit sur l'instant du dernier calcul, et
 * un test qui le laisserait plus tard que l'horloge du suivant y figerait les calculs (l'horloge ne recule jamais pour
 * de vrai).
 */
let direct: typeof import('./useLiveRecording');
beforeEach(async () => {
  recorder.state.stats = { pointCount: 0 };
  recorder.segments = [[]];
  recorder.listeners = [];
  failing.on = false;
  vi.resetModules();
  direct = await import('./useLiveRecording');
});
const getLiveRecording = () => direct.getLiveRecording();
const startLiveRecording = () => direct.startLiveRecording();
const subscribeToLiveRecording = (listener: () => void) => direct.subscribeToLiveRecording(listener);
const useLiveRecording = () => direct.useLiveRecording();

const T0 = Date.UTC(2026, 10, 4, 14, 0, 0);

const addFix = (nowMs: number) => {
  vi.setSystemTime(nowMs);
  const n = recorder.state.stats.pointCount;
  const fix: LocationFix = { timeMs: nowMs, lat: 43.6 + n * 1e-4, lon: 3.3, speedMs: 3 } as LocationFix;
  recorder.segments[0].push(fix);
  recorder.state.stats = { pointCount: n + 1 };
  recorder.listeners.forEach((listener) => listener());
};

describe('direct de l’enregistrement, écran éteint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    recorder.state.activity = baseActivity('kite');
  });
  afterEach(() => vi.useRealTimers());

  it('avance à l’arrivée des positions même si son différé ne part plus : la notification en dépend', async () => {
    startLiveRecording();
    useLiveRecording();
    await vi.advanceTimersByTimeAsync(0);
    let published = 0;
    subscribeToLiveRecording(() => { published += 1; });

    addFix(T0);
    expect(published).toBe(1);
    // Moins de 2 s après le calcul : un différé part, qui reste gelé page cachée (l'horloge avance, pas les minuteries).
    addFix(T0 + 1000);
    expect(vi.getTimerCount()).toBe(1);
    expect(published).toBe(1);

    addFix(T0 + 60_000);
    expect(published).toBe(2);
    expect(getLiveRecording().updatedMs).toBe(T0 + 60_000);
    expect(vi.getTimerCount()).toBe(0);
    addFix(T0 + 120_000);
    expect(published).toBe(3);
  });

  it("une erreur du calcul ne remonte pas jusqu'à l'enregistreur et garde les derniers chiffres", async () => {
    startLiveRecording();
    addFix(T0 + 200_000);
    const before = getLiveRecording();
    const beforeStats = JSON.stringify(before.stats);
    expect(before.updatedMs).toBe(T0 + 200_000);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    failing.on = true;
    try {
      expect(() => addFix(T0 + 300_000)).not.toThrow();
      expect(getLiveRecording()).toBe(before);
      expect(JSON.stringify(getLiveRecording().stats)).toBe(beforeStats);
    } finally {
      failing.on = false;
      vi.mocked(console.warn).mockRestore();
    }
    addFix(T0 + 400_000);
    expect(getLiveRecording().updatedMs).toBe(T0 + 400_000);
    expect(JSON.stringify(getLiveRecording().stats)).not.toBe(beforeStats);
  });
});
