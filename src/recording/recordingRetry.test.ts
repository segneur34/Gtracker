import { describe, expect, it } from 'vitest';
import { beltRetryOffer, beltRetryUnderAlert, warmupRetryShown, type BeltRetryInput } from './recordingRetry';
import type { BeltState } from '../platform/heartRate';

const input = (patch: Partial<BeltRetryInput>): BeltRetryInput => ({
  active: true,
  heartRate: { state: 'connected' },
  beltLost: false,
  beltAside: null,
  ...patch,
});

const NONE = { retry: false, stop: false, retake: false };
const RETRY_AND_STOP = { retry: true, stop: true, retake: false };
const STOP_ONLY = { retry: false, stop: true, retake: false };

describe('boutons de la ceinture pendant l’enregistrement', () => {
  it('ceinture qui mesure : rien', () => {
    expect(beltRetryOffer(input({}))).toEqual(NONE);
  });

  it.each<BeltState>(['connecting', 'searching', 'lost', 'off'])('ceinture tenue pas jointe (%s) : réessayer et arrêter de chercher', (state) => {
    expect(beltRetryOffer(input({ heartRate: { state } }))).toEqual(RETRY_AND_STOP);
  });

  it('jointe sans mesure, alerte de FC perdue : arrêter de chercher seulement', () => {
    expect(beltRetryOffer(input({ beltLost: true }))).toEqual(STOP_ONLY);
    expect(beltRetryUnderAlert(input({ beltLost: true }))).toBe(true);
  });

  it("appareil sans fréquence cardiaque : arrêter de chercher seulement", () => {
    expect(beltRetryOffer(input({ heartRate: { state: 'unsupported' } }))).toEqual(STOP_ONLY);
  });

  it('injoignable au départ : réessayer et arrêter de chercher, aussi sous l’alerte rouge', () => {
    const failed = input({ heartRate: null, beltAside: 'failed' });
    expect(beltRetryOffer(failed)).toEqual(RETRY_AND_STOP);
    expect(beltRetryUnderAlert(failed)).toBe(true);
  });

  it('après « Arrêter de chercher » : reprendre la ceinture, et plus rien sous l’alerte', () => {
    const stopped = input({ heartRate: null, beltAside: 'stopped' });
    expect(beltRetryOffer(stopped)).toEqual({ retry: false, stop: false, retake: true });
    expect(beltRetryUnderAlert(stopped)).toBe(false);
  });

  it('sans ceinture : rien', () => {
    expect(beltRetryOffer(input({ heartRate: null }))).toEqual(NONE);
    expect(beltRetryUnderAlert(input({ heartRate: null }))).toBe(false);
  });

  it('hors enregistrement (démarrage, arrêt, repos) : rien, même ceinture perdue ou laissée', () => {
    for (const patch of [{ heartRate: { state: 'lost' as const } }, { beltAside: 'failed' as const }, { beltAside: 'stopped' as const }, { beltLost: true }]) {
      expect(beltRetryOffer(input({ ...patch, active: false }))).toEqual(NONE);
      expect(beltRetryUnderAlert(input({ ...patch, active: false }))).toBe(false);
    }
  });
});

describe('« Réessayer » avant le départ', () => {
  it('après un échec, ou pendant que la ceinture est cherchée ; pas une fois connectée', () => {
    expect(warmupRetryShown('off', true)).toBe(true);
    expect(warmupRetryShown('connecting', false)).toBe(true);
    expect(warmupRetryShown('searching', false)).toBe(true);
    expect(warmupRetryShown('lost', false)).toBe(true);
    expect(warmupRetryShown('connected', false)).toBe(false);
    expect(warmupRetryShown('off', false)).toBe(false);
    expect(warmupRetryShown('unsupported', false)).toBe(false);
  });
});
