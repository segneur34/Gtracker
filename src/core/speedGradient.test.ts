import { describe, expect, it } from 'vitest';
import { SLOW_COLOR, TRACK_COLOR_LEVELS, gradientColor, speedGradientColor } from './speedGradient';

// Repris de l'ancien test des analyses de course : le dégradé de vitesse est commun à tous les supports.
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

  it(`prend au plus ${TRACK_COLOR_LEVELS} nuances entre les bornes`, () => {
    const colors = new Set<string>();
    for (let i = 0; i <= 10_000; i++) colors.add(speedGradientColor(minMs + ((maxMs - minMs) * i) / 10_000, minMs, maxMs));
    expect(colors.size).toBeLessThanOrEqual(TRACK_COLOR_LEVELS);
    // Les nuances couvrent toute l'échelle : aucune ne manque sur une vitesse balayée finement.
    expect(colors.size).toBe(TRACK_COLOR_LEVELS);
    expect(colors.has(SLOW_COLOR)).toBe(false);
  });

  it('garde la couleur exacte des deux bornes, le gris dessous et le rouge au-dessus', () => {
    expect(speedGradientColor(minMs, minMs, maxMs)).toBe(gradientColor(0));
    expect(gradientColor(0)).toBe('rgb(30, 136, 229)');
    expect(speedGradientColor(maxMs, minMs, maxMs)).toBe(gradientColor(1));
    expect(gradientColor(1)).toBe('rgb(229, 57, 53)');
    expect(speedGradientColor(maxMs * 3, minMs, maxMs)).toBe('rgb(229, 57, 53)');
    expect(speedGradientColor(minMs * 0.99, minMs, maxMs)).toBe('#9e9e9e');
    expect(speedGradientColor(Number.NaN, minMs, maxMs)).toBe(SLOW_COLOR);
  });

  it('prend la nuance la plus proche du dégradé continu', () => {
    const t = 0.37;
    const level = Math.round(t * (TRACK_COLOR_LEVELS - 1));
    expect(speedGradientColor(minMs + t * (maxMs - minMs), minMs, maxMs)).toBe(gradientColor(level / (TRACK_COLOR_LEVELS - 1)));
  });

  it('suit des bornes personnalisées', () => {
    const red = gradientColor(1);
    expect(speedGradientColor(kmh(12), kmh(5), kmh(12))).toBe(red);
    expect(speedGradientColor(kmh(12), kmh(5), kmh(18))).not.toBe(red);
  });
});
