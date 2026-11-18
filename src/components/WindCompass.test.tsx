import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WindCompass from './WindCompass';

describe('WindCompass', () => {
  it('le vent dessine sa flèche rouge', () => {
    const html = renderToStaticMarkup(<WindCompass windAngle={90} size={64} />);
    expect(html).toContain('<svg');
    expect(html).toContain('stroke="red"');
  });

  it('un sens de vagues connu dessine sa flèche', () => {
    expect(renderToStaticMarkup(<WindCompass windAngle={0} size={64} waves />)).toContain('<svg');
  });

  it('un sens de vagues non estimé laisse le cadran sans flèche', () => {
    const html = renderToStaticMarkup(<WindCompass windAngle={null} size={64} waves />);
    expect(html).not.toContain('<svg');
    expect(html).toContain('>N<');
  });
});
