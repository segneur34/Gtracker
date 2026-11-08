import { describe, expect, it } from 'vitest';
import { SLOW_COLOR, gradientColor, speedGradientColor } from './speedGradient';

// Repris de l'ancien test des analyses de course (lot 303) : le dégradé de vitesse est commun à tous les supports.
describe('dégradé de vitesse', () => {
  const kmh = (v: number) => v / 3.6;
  // Bornes de l'ancienne course : 4 et 15 km/h.
  const { minMs, maxMs } = { minMs: kmh(4), maxMs: kmh(15) };

  it('met la marche en gris', () => {
    expect(speedGradientColor(kmh(3), minMs, maxMs)).toBe(SLOW_COLOR);
    expect(speedGradientColor(kmh(4.5), minMs, maxMs)).not.toBe(SLOW_COLOR);
  });

  it('atteint le rouge à la borne haute, 15 km/h par défaut, et pas avant', () => {
    const red = gradientColor(1);
    expect(speedGradientColor(kmh(15), minMs, maxMs)).toBe(red);
    expect(speedGradientColor(kmh(20), minMs, maxMs)).toBe(red);
    expect(speedGradientColor(kmh(9.4), minMs, maxMs)).not.toBe(red);
    expect(speedGradientColor(kmh(12), minMs, maxMs)).not.toBe(red);
  });

  it('varie continûment entre les bornes', () => {
    const a = speedGradientColor(kmh(8), minMs, maxMs);
    const b = speedGradientColor(kmh(8.5), minMs, maxMs);
    const c = speedGradientColor(kmh(11), minMs, maxMs);
    expect(a).not.toBe(c);
    expect(a).not.toBe(b);
  });

  it('suit des bornes personnalisées', () => {
    const red = gradientColor(1);
    expect(speedGradientColor(kmh(12), kmh(5), kmh(12))).toBe(red);
    expect(speedGradientColor(kmh(12), kmh(5), kmh(18))).not.toBe(red);
  });
});
