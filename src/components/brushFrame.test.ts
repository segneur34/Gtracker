import { describe, expect, it } from 'vitest';
import { brushFrame } from './brushFrame';

describe('brushFrame', () => {
  it('l\'ouverture tourne d\'un cadre au suivant, en partant d\'en bas à droite', () => {
    const classes = [0, 1, 2, 3, 4].map((i) => brushFrame(i, '#000000').className);
    expect(classes.map((c) => c.split('--')[1])).toEqual(['bd', 'bg', 'hg', 'hd', 'bd']);
    expect(classes.every((c) => c.startsWith('brush-frame '))).toBe(true);
  });

  it('porte la couleur dans la variable du pinceau', () => {
    expect(brushFrame(0, '#2986a4').style).toEqual({ '--brush': '#2986a4' });
  });
});
