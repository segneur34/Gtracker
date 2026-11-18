import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WindAdjustOverlay from './WindAdjustOverlay';

/** Le DOM de la boussole du vent est figé : la pièce commune qui la porte ne doit rien y changer. */
const render = (props: { windDeg: number | null; autoWind: number | null; confidence: number | null; manual: boolean }) =>
  renderToStaticMarkup(
    <WindAdjustOverlay {...props} onChange={() => {}} onClose={() => {}} polarAt={() => []} unitSymbol="kn" />,
  );

describe('WindAdjustOverlay : DOM figé', () => {
  it('vent saisi, avec le calculé pour mémoire', () => {
    expect(render({ windDeg: 245, autoWind: 230, confidence: 0.8, manual: true })).toMatchSnapshot();
  });

  it('vent calculé, avec sa confiance', () => {
    expect(render({ windDeg: 230, autoWind: 230, confidence: 0.82, manual: false })).toMatchSnapshot();
  });

  it('sans vent', () => {
    expect(render({ windDeg: null, autoWind: null, confidence: null, manual: false })).toMatchSnapshot();
  });
});
