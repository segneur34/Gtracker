import { describe, expect, it } from 'vitest';
import type { LiveFieldContext } from './liveFields';
import { liveNotification, liveNotificationKey, notificationStateKey, type LiveNotificationInput } from './liveNotification';
import { EMPTY_LIVE_STATS, LIVE_STATS_DEFAULTS } from './liveStats';

const context = (patch: Partial<LiveFieldContext> = {}): LiveFieldContext => ({
  stats: { ...EMPTY_LIVE_STATS, currentSpeedMs: 10, averageSpeedMs: 5, distanceM: 12_345 },
  durationMs: 3_725_000,
  nowMs: 0,
  remainingM: null,
  headingDeg: null,
  markDistanceM: null,
  markBearingDeg: null,
  heartRateBpm: null,
  heartRateZoneBounds: null,
  speedUnit: 'kmh',
  distanceUnit: 'km',
  ...patch,
});

const NOW = 1_700_000_000_000;

const input = (patch: Partial<LiveNotificationInput> = {}): LiveNotificationInput => ({
  activityName: 'Wingfoil',
  fields: ['speed', 'distance'],
  context: context(),
  paused: null,
  gpsLost: false,
  beltLost: false,
  startedAtMs: NOW - 3_725_000,
  ...patch,
});

describe('liveNotification', () => {
  it("donne l'activité, les chiffres en une ligne et la durée au chronomètre", () => {
    const n = liveNotification(input());
    expect(n.title).toBe('Wingfoil');
    expect(n.text).toBe('Vit. 36,0 km/h · Dist. 12,35 km');
    expect(n.lines).toEqual(['Vitesse : 36,0 km/h', 'Distance : 12,35 km']);
    expect(n.chrono).toEqual({ baseMs: NOW - 3_725_000, countDown: false });
  });

  it("parle d'allure en min/km", () => {
    const n = liveNotification(input({ fields: ['speed'], context: context({ speedUnit: 'minkm' }) }));
    expect(n.text.startsWith('Allure ')).toBe(true);
    expect(n.lines[0].startsWith('Allure : ')).toBe(true);
  });

  it('dit la moyenne active en voile et en surf, la moyenne ailleurs', () => {
    const stats = { ...EMPTY_LIVE_STATS, averageSpeedMs: 3, activeAverageSpeedMs: 5 };
    const active = liveNotification(input({ fields: ['average'], context: context({ stats, options: { ...LIVE_STATS_DEFAULTS, activeAverage: true } }) }));
    expect(active.text).toBe('Moy. act. 18,0 km/h');
    expect(active.lines).toEqual(['Moyenne active : 18,0 km/h']);
    const plain = liveNotification(input({ fields: ['average'], context: context({ stats }) }));
    expect(plain.text).toBe('Moy. 10,8 km/h');
    expect(plain.lines).toEqual(['Moyenne : 10,8 km/h']);
  });

  it('marque les valeurs absentes', () => {
    const n = liveNotification(input({ fields: ['grade', 'heading'] }));
    expect(n.text).toBe('Pente — · Cap —');
  });

  it('en pause manuelle : durée figée dans le titre, deux chiffres sur la ligne, pas de chronomètre', () => {
    const n = liveNotification(input({ paused: 'manual' }));
    expect(n.title).toBe('Wingfoil · en pause 1:02:05');
    expect(n.text).toBe('Vit. 36,0 km/h · Dist. 12,35 km');
    expect(n.chrono).toBeNull();
  });

  it('en pause automatique, le chronomètre continue', () => {
    const n = liveNotification(input({ paused: 'auto' }));
    expect(n.title).toBe('Wingfoil · pause auto');
    expect(n.chrono?.countDown).toBe(false);
  });

  it('GPS perdu : dit au titre, le chronomètre continue (lot 115)', () => {
    const n = liveNotification(input({ gpsLost: true }));
    expect(n.title).toBe('Wingfoil · GPS perdu');
    expect(n.chrono?.countDown).toBe(false);
    expect(liveNotification(input({ gpsLost: true, paused: 'auto' })).title).toBe('Wingfoil · GPS perdu · pause auto');
    expect(liveNotification(input({ beltLost: true })).title).toBe('Wingfoil · FC perdue');
    expect(liveNotification(input({ gpsLost: true, beltLost: true })).title).toBe('Wingfoil · GPS perdu · FC perdue');
    expect(notificationStateKey({ status: 'recording', pausedReason: null, gpsLost: false, beltLost: true, activityId: 'running', computed: true })).toContain('fc-perdue');
  });

  it('sans premier point, pas de chronomètre', () => {
    expect(liveNotification(input({ startedAtMs: null })).chrono).toBeNull();
  });
});

describe('liveNotificationKey', () => {
  it('ne change pas pour un même chronomètre recalculé à la seconde près', () => {
    const a = liveNotification(input());
    const b = liveNotification(input({ startedAtMs: NOW - 3_725_000 + 300 }));
    expect(liveNotificationKey(a, false)).toBe(liveNotificationKey(b, false));
  });

  it('distingue la notification posée seule', () => {
    const n = liveNotification(input());
    expect(liveNotificationKey(n, true)).not.toBe(liveNotificationKey(n, false));
  });
});

describe('notificationStateKey (lot 67, sortie de recordingNotification)', () => {
  /** Copie gelée de l'ancienne clé du service (`stateKeyNow`), sur les mêmes lectures. */
  const oldKey = (status: string, pausedReason: 'manual' | 'auto' | null, activity: { id: string } | null, computed: boolean): string =>
    `${status}|${pausedReason ?? ''}|${activity?.id ?? ''}||${computed}`;
  const cases: [string, 'manual' | 'auto' | null, string | null, boolean][] = [
    ['recording', null, 'running', true],
    ['paused', 'auto', 'running', true],
    ['paused', 'manual', 'wingfoil', true],
    ['recording', null, 'running', false],
    ['starting', null, null, false],
  ];

  it.each(cases)('%s %s %s : la même clé qu\'avant', (status, pausedReason, activityId, computed) => {
    expect(notificationStateKey({ status, pausedReason, gpsLost: false, beltLost: false, activityId, computed }))
      .toBe(oldKey(status, pausedReason, activityId === null ? null : { id: activityId }, computed));
  });

  it('change avec la pause et le premier calcul', () => {
    const key = (patch: Partial<Parameters<typeof notificationStateKey>[0]>) =>
      notificationStateKey({ status: 'recording', pausedReason: null, gpsLost: false, beltLost: false, activityId: 'running', computed: true, ...patch });
    expect(key({})).toBe('recording||running||true');
    expect(key({ status: 'paused', pausedReason: 'auto' })).not.toBe(key({ status: 'paused', pausedReason: 'manual' }));
    expect(key({ computed: false })).not.toBe(key({}));
  });

  it('change quand le GPS est perdu, puis revient (lot 115)', () => {
    const key = (gpsLost: boolean) =>
      notificationStateKey({ status: 'recording', pausedReason: null, gpsLost, beltLost: false, activityId: 'running', computed: true });
    expect(key(true)).not.toBe(key(false));
    expect(key(false)).toBe('recording||running||true');
  });
});
