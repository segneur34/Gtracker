import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_FIELDS, DEFAULT_NOTIFICATION_FIELDS, MAX_LIVE_FIELDS, MAX_NOTIFICATION_FIELDS, defaultLiveFieldsOf, defaultNotificationFieldsOf,
  liveFieldLabel, liveFieldShortLabel, liveFieldValue, liveFieldsOfTreatment, recentWindowLabel, sanitizeLiveFields, type LiveFieldContext,
  type LiveFieldKey, type LiveFieldUnits,
} from './liveFields';
import { SPORT_PROFILES, sportTreatment } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import { EMPTY_LIVE_STATS, LIVE_STATS_DEFAULTS } from './liveStats';
import type { DistanceUnit, SpeedUnit } from '../core/units';
import type { Treatment } from '../core/sportProfiles';

const context = (patch: Partial<LiveFieldContext> = {}): LiveFieldContext => ({
  stats: EMPTY_LIVE_STATS,
  durationMs: 0,
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

describe('liveFieldsOfTreatment', () => {
  it('ne propose que les chiffres qui ont un sens pour le traitement', () => {
    expect(liveFieldsOfTreatment('voile')).toContain('recentTopShort');
    for (const treatment of ['voile', 'surf'] as const) {
      expect(liveFieldsOfTreatment(treatment)).toEqual(expect.arrayContaining(['heartRate', 'averageHeartRate', 'heartRateZone']));
    }
    expect(liveFieldsOfTreatment('voile')).toContain('markDistance');
    expect(liveFieldsOfTreatment('surf')).toEqual(expect.arrayContaining(['markDistance', 'markBearing']));
    expect(liveFieldsOfTreatment('surf')).not.toContain('heading');
    expect(liveFieldsOfTreatment('surf')).not.toContain('recentTopShort');
  });

  it('propose les défauts de chaque traitement', () => {
    for (const treatment of ['voile', 'surf'] as const) {
      for (const key of DEFAULT_LIVE_FIELDS[treatment]) expect(liveFieldsOfTreatment(treatment)).toContain(key);
      for (const key of DEFAULT_NOTIFICATION_FIELDS[treatment]) expect(liveFieldsOfTreatment(treatment)).toContain(key);
      expect(DEFAULT_NOTIFICATION_FIELDS[treatment].length).toBeLessThanOrEqual(MAX_NOTIFICATION_FIELDS);
    }
  });

  it('propose les défauts de chaque calcul, permis par son traitement', () => {
    for (const sport of Object.keys(SPORT_PROFILES) as SportType[]) {
      const treatment = sportTreatment(sport);
      expect(sanitizeLiveFields(defaultLiveFieldsOf(sport), treatment)).toEqual(defaultLiveFieldsOf(sport));
      expect(sanitizeLiveFields(defaultNotificationFieldsOf(sport), treatment, MAX_NOTIFICATION_FIELDS, 'notification'))
        .toEqual(defaultNotificationFieldsOf(sport));
    }
  });

  it('bateau : vitesse, moyenne, distance et cap ; notification vitesse et distance', () => {
    expect(defaultLiveFieldsOf('bateau')).toEqual(['speed', 'average', 'distance', 'heading']);
    expect(defaultNotificationFieldsOf('bateau')).toEqual(['speed', 'distance']);
    expect(defaultLiveFieldsOf('wingfoil')).toEqual(DEFAULT_LIVE_FIELDS.voile);
  });
});

describe('sanitizeLiveFields', () => {
  it('garde les clés connues et permises, sans doublon, dans la limite', () => {
    expect(sanitizeLiveFields(['speed', 'heading', 'speed', 'inconnu', 'recentTopShort'], 'surf')).toEqual(['speed']);
    expect(sanitizeLiveFields(['speed', 'average', 'max', 'distance', 'duration'], 'voile')).toHaveLength(MAX_LIVE_FIELDS);
  });

  it('écarte une clé qui n\'est plus un chiffre du direct, dans une liste rangée plus tôt', () => {
    expect(sanitizeLiveFields(['speed', 'ancienne', 'heading', 'autre'], 'voile')).toEqual(['speed', 'heading']);
    expect(sanitizeLiveFields(['ancienne', 'autre'], 'surf')).toBeNull();
  });

  it('borne au maximum demandé, celui de la notification', () => {
    expect(sanitizeLiveFields(['speed', 'average', 'max', 'distance'], 'voile', MAX_NOTIFICATION_FIELDS)).toEqual(['speed', 'average']);
    expect(sanitizeLiveFields(['heading', 'speed', 'max', 'average', 'distance'], 'surf', 3)).toEqual(['speed', 'max', 'average']);
  });

  it("rend null quand rien ne reste, pour retomber sur le défaut", () => {
    expect(sanitizeLiveFields([], 'surf')).toBeNull();
    expect(sanitizeLiveFields(['heading'], 'surf')).toBeNull();
    expect(sanitizeLiveFields('speed', 'surf')).toBeNull();
    expect(sanitizeLiveFields(undefined, 'surf')).toBeNull();
  });
});

describe('moyenne du direct : « Moyenne active » en voile et en surf (04/11)', () => {
  const stats = { ...EMPTY_LIVE_STATS, averageSpeedMs: 3, activeAverageSpeedMs: 5 };
  const active = { ...LIVE_STATS_DEFAULTS, activeAverage: true };

  it('nomme et donne la moyenne active quand le calcul la porte', () => {
    expect(liveFieldLabel('average', { speedUnit: 'kn', distanceUnit: 'km', options: active })).toBe('Moyenne active');
    expect(liveFieldShortLabel('average', { speedUnit: 'kn', distanceUnit: 'km', options: active })).toBe('Moy. act.');
    expect(liveFieldValue('average', context({ stats, speedUnit: 'kmh', options: active }))).toBe('18,0 km/h');
  });

  it("pas de chiffre tant que rien n'est en action, jamais la moyenne hors pauses", () => {
    expect(liveFieldValue('average', context({ stats: { ...stats, activeAverageSpeedMs: null }, options: active }))).toBe(liveFieldValue('average', context()));
  });

  it('le bateau, sans seuil, garde son chiffre et son nom', () => {
    expect(liveFieldLabel('average', { speedUnit: 'kmh', distanceUnit: 'km' })).toBe('Moyenne');
    expect(liveFieldShortLabel('average', { speedUnit: 'kmh', distanceUnit: 'km' })).toBe('Moy.');
    expect(liveFieldValue('average', context({ stats, speedUnit: 'kmh' }))).toBe('10,8 km/h');
  });

  it('le temps restant garde la moyenne hors pauses', () => {
    expect(liveFieldValue('remainingTime', context({ stats, remainingM: 5400, options: active }))).toBe('0:30:00');
  });
});

describe('liveFieldLabel', () => {
  it('parle de mille en milles nautiques', () => {
    expect(liveFieldLabel('average', { speedUnit: 'kn', distanceUnit: 'nm' })).toBe('Moyenne');
    expect(liveFieldLabel('lastDistance', { speedUnit: 'kn', distanceUnit: 'nm' })).toBe('Dernier mille');
    expect(liveFieldLabel('recentDistanceSpeed', { speedUnit: 'kmh', distanceUnit: 'km' })).toBe('300 derniers m');
  });
});

describe('liveFieldShortLabel', () => {
  it('abrège', () => {
    expect(liveFieldShortLabel('speed', { speedUnit: 'kmh', distanceUnit: 'km' })).toBe('Vit.');
    expect(liveFieldShortLabel('lastDistance', { speedUnit: 'kn', distanceUnit: 'nm' })).toBe('Dern. mille');
  });
});

describe('liveFieldValue', () => {
  it('donne le temps restant à la moyenne actuelle, et rien sans trace', () => {
    const stats = { ...EMPTY_LIVE_STATS, averageSpeedMs: 3 };
    expect(liveFieldValue('remainingTime', context({ stats, remainingM: 5400 }))).toBe('0:30:00');
    expect(liveFieldValue('remainingTime', context({ stats }))).toBe('—');
    expect(liveFieldValue('remaining', context({ stats, remainingM: 5400 }))).toBe('5,40 km');
  });

  it('marque les valeurs manquantes', () => {
    for (const key of ['heading', 'legAverage', 'markDistance', 'markBearing'] as const) {
      expect(liveFieldValue(key, context())).toBe('—');
    }
    expect(liveFieldValue('heading', context({ headingDeg: 359.7 }))).toBe('0°');
    expect(liveFieldValue('markBearing', context({ markBearingDeg: 245.2 }))).toBe('245°');
    expect(liveFieldValue('heartRate', context({ heartRateBpm: 142.4 }))).toBe('142 bpm');
    expect(liveFieldValue('heartRate', context())).toBe('—');
    expect(liveFieldValue('averageHeartRate', context({ stats: { ...EMPTY_LIVE_STATS, averageHeartRateBpm: 151.6 } }))).toBe('152 bpm');
    expect(liveFieldValue('averageHeartRate', context())).toBe('—');
    const bounds = [100, 120, 140, 160, 180];
    expect(liveFieldValue('heartRateZone', context({ heartRateBpm: 152, heartRateZoneBounds: bounds }))).toBe('Z3 · 152');
    expect(liveFieldValue('heartRateZone', context({ heartRateBpm: 92, heartRateZoneBounds: bounds }))).toBe('sous Z1 · 92');
    expect(liveFieldValue('heartRateZone', context({ heartRateBpm: 152 }))).toBe('—');
    expect(liveFieldValue('markDistance', context({ markDistanceM: 143 }))).toBe('143 m');
  });
});

describe('libellés sur les options du direct (lot 67)', () => {
  // Copie gelée des libellés d'avant le lot 67, tirés de LIVE_STATS_DEFAULTS.
  const oldRecentWindowLabel = `${Math.round(LIVE_STATS_DEFAULTS.recentWindowS / 60)} min`;
  const [TOP_SHORT_S, TOP_LONG_S] = LIVE_STATS_DEFAULTS.topDurationsS;

  const oldLiveFieldLabel = (key: LiveFieldKey, { distanceUnit }: LiveFieldUnits): string => {
    switch (key) {
      case 'speed': return 'Vitesse';
      case 'average': return 'Moyenne';
      case 'max': return `Max (${LIVE_STATS_DEFAULTS.maxDurationS} s)`;
      case 'recentDistanceSpeed': return `${LIVE_STATS_DEFAULTS.recentDistanceM} derniers m`;
      case 'lastDistance': return distanceUnit === 'nm' ? 'Dernier mille' : 'Dernier km';
      case 'distance': return 'Distance';
      case 'duration': return 'Durée';
      case 'clock': return 'Heure';
      case 'remaining': return 'Restant';
      case 'remainingTime': return 'Temps restant';
      case 'recentTopShort': return `Top ${TOP_SHORT_S} s (${oldRecentWindowLabel})`;
      case 'recentTopLong': return `Top ${TOP_LONG_S} s (${oldRecentWindowLabel})`;
      case 'heading': return 'Cap';
      case 'legAverage': return 'Moyenne du bord';
      case 'markDistance': return 'Balise';
      case 'markBearing': return 'Cap balise';
      case 'heartRate': return 'Fréquence cardiaque';
      case 'averageHeartRate': return 'FC moyenne';
      case 'heartRateZone': return 'Zone cardiaque';
    }
  };

  const oldLiveFieldShortLabel = (key: LiveFieldKey, { distanceUnit }: LiveFieldUnits): string => {
    switch (key) {
      case 'speed': return 'Vit.';
      case 'average': return 'Moy.';
      case 'max': return 'Max';
      case 'recentDistanceSpeed': return `${LIVE_STATS_DEFAULTS.recentDistanceM} m`;
      case 'lastDistance': return distanceUnit === 'nm' ? 'Dern. mille' : 'Dern. km';
      case 'distance': return 'Dist.';
      case 'duration': return 'Durée';
      case 'clock': return 'Heure';
      case 'remaining': return 'Reste';
      case 'remainingTime': return 'Temps rest.';
      case 'recentTopShort': return `Top ${TOP_SHORT_S} s`;
      case 'recentTopLong': return `Top ${TOP_LONG_S} s`;
      case 'heading': return 'Cap';
      case 'legAverage': return 'Bord';
      case 'markDistance': return 'Balise';
      case 'markBearing': return 'Cap bal.';
      case 'heartRate': return 'FC';
      case 'averageHeartRate': return 'FC moy.';
      case 'heartRateZone': return 'Zone';
    }
  };


  const KEYS = Object.keys(DEFAULT_LIVE_FIELDS).flatMap((t) => liveFieldsOfTreatment(t as Treatment, 'notification'));
  const UNITS: { speedUnit: SpeedUnit; distanceUnit: DistanceUnit }[] = [
    { speedUnit: 'kmh', distanceUnit: 'km' }, { speedUnit: 'kn', distanceUnit: 'nm' },
  ];

  it('identiques à avant avec les options par défaut, données ou non', () => {
    for (const units of UNITS) {
      for (const key of new Set(KEYS)) {
        expect(liveFieldLabel(key, units)).toBe(oldLiveFieldLabel(key, units));
        expect(liveFieldLabel(key, { ...units, options: LIVE_STATS_DEFAULTS })).toBe(oldLiveFieldLabel(key, units));
        expect(liveFieldShortLabel(key, units)).toBe(oldLiveFieldShortLabel(key, units));
        expect(liveFieldShortLabel(key, { ...units, options: LIVE_STATS_DEFAULTS })).toBe(oldLiveFieldShortLabel(key, units));
      }
    }
    expect(recentWindowLabel()).toBe(oldRecentWindowLabel);
    expect(recentWindowLabel()).toBe('5 min');
  });

  it('suivent des options changées', () => {
    const units: LiveFieldUnits = {
      speedUnit: 'kmh', distanceUnit: 'km',
      options: { ...LIVE_STATS_DEFAULTS, recentWindowS: 600, topDurationsS: [3, 20], recentDistanceM: 500, maxDurationS: 5 },
    };
    expect(liveFieldLabel('recentTopShort', units)).toBe('Top 3 s (10 min)');
    expect(liveFieldLabel('recentTopLong', units)).toBe('Top 20 s (10 min)');
    expect(liveFieldLabel('recentDistanceSpeed', units)).toBe('500 derniers m');
    expect(liveFieldLabel('max', units)).toBe('Max (5 s)');
    expect(liveFieldShortLabel('recentTopShort', units)).toBe('Top 3 s');
    expect(liveFieldShortLabel('recentDistanceSpeed', units)).toBe('500 m');
    expect(recentWindowLabel(units.options)).toBe('10 min');
  });
});
