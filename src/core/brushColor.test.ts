import { describe, expect, it } from 'vitest';
import { ACTIVITY_PALETTE, THEME_BACKGROUND, contrastRatio } from './activities';
import { brushColorFor, lightenForNight } from './brushColor';

describe('lightenForNight', () => {
  it('éclaircit les couleurs trop sombres pour le fond de nuit, même teinte', () => {
    expect(lightenForNight('#003e52')).toBe('#2986a4');
    expect(lightenForNight('#6236c9')).toBe('#8866d6');
    expect(lightenForNight('#8e1b2e')).toBe('#d24c62');
    expect(lightenForNight('#646464')).toBe('#7b7b7b');
  });

  it('laisse en l\'état une couleur déjà contrastée', () => {
    for (const c of ['#ff7a1a', '#1e88e5', '#72b0bd', '#e6c229', '#0e8f4f', '#ffffff']) {
      expect(lightenForNight(c)).toBe(c);
    }
  });

  it('laisse en l\'état une écriture hors `#rrggbb`', () => {
    expect(lightenForNight('var(--ink)')).toBe('var(--ink)');
  });
});

describe('brushColorFor', () => {
  it('le jour, garde la couleur de la fiche', () => {
    expect(brushColorFor('#003e52', false)).toBe('#003e52');
    expect(brushColorFor('#ff7a1a', false)).toBe('#ff7a1a');
  });

  it('prend l\'encre quand la couleur vue du thème se confond avec le fond : le blanc le jour, le noir la nuit', () => {
    expect(brushColorFor('#ffffff', false)).toBe('var(--ink)');
    // Le blanc de la fiche devient noir la nuit, donc perdu sur le fond noir.
    expect(brushColorFor('#ffffff', true)).toBe('var(--ink)');
  });

  it('la nuit, le noir de la fiche devient blanc et l\'océan est éclairci', () => {
    expect(brushColorFor('#000000', false)).toBe('#000000');
    expect(brushColorFor('#000000', true)).toBe('#ffffff');
    expect(brushColorFor('#003e52', true)).toBe('#2986a4');
  });

  it('chaque couleur de la palette se lit sur le fond de nuit (4,5:1) ou prend l\'encre', () => {
    for (const { light } of ACTIVITY_PALETTE) {
      const shown = brushColorFor(light, true);
      if (shown.startsWith('var(')) continue;
      expect(contrastRatio(shown, THEME_BACKGROUND.dark)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
