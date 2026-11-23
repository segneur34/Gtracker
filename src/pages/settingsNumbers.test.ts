import { describe, expect, it } from 'vitest';
import { toFixedNumber } from '../core/basics';
import { fromDisplaySpeed, msToKmh, toDisplaySpeed, toRoundedDisplaySpeed, type SpeedUnit } from '../core/units';

/**
 * Les nombres que Réglages montre dans le résumé d'une activité (seuil, vitesse de pause) : les formules
 * d'avant, écrites à la main, et les pièces communes qui les remplacent donnent les mêmes valeurs.
 */
const UNITS: SpeedUnit[] = ['kn', 'kmh', 'ms'];
const VALUES = [0, 0.05, 0.25, 0.5, 1, 1.25, 2.675, 3.14159, 4.5, 7.35, 10, 12.345, 25.05, 60];

describe('nombres de Réglages', () => {
  it('seuil montré : même arrondi qu\'avant, dans chaque unité', () => {
    for (const calcUnit of UNITS) {
      for (const shownUnit of UNITS) {
        for (const stored of VALUES) {
          const before = parseFloat(
            toDisplaySpeed(fromDisplaySpeed(stored, calcUnit), shownUnit).toFixed(shownUnit === 'ms' ? 2 : 1),
          );
          expect(toRoundedDisplaySpeed(fromDisplaySpeed(stored, calcUnit), shownUnit)).toBe(before);
        }
      }
    }
  });

  it('vitesse de pause en km/h : une décimale, comme avant', () => {
    for (const ms of VALUES) {
      expect(toFixedNumber(msToKmh(ms), 1)).toBe(parseFloat(msToKmh(ms).toFixed(1)));
    }
  });
});
