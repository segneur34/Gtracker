import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GeneralStats, { type TileLink } from './GeneralStats';

const STATS = [
  { key: 'totalTime', label: 'Temps total', value: '1 h 24' },
  { key: 'tacks', label: 'Virements réussis', value: '12 / 14 (86 %)' },
  { key: 'jibes', label: 'Empannages réussis', value: '9 / 10 (90 %)' },
];
const PAIRS = [['tacks', 'jibes']] as const;
const linkOf = (key: string): TileLink | null => (key === 'tacks' || key === 'jibes' ? { tabLabel: 'manœuvres', onOpen: () => {} } : null);

describe('GeneralStats : une tuile reliée à son onglet', () => {
  const html = renderToStaticMarkup(<GeneralStats stats={STATS} pairs={PAIRS} linkOf={linkOf} />);

  it('tuile reliée : un bouton nommé par son chiffre et son onglet, un chevron au bout du libellé', () => {
    expect(html).toContain('<button type="button" class="an-sheet__stat an-sheet__stat--link" aria-label="Virements réussis : 12 / 14 (86 %). Ouvrir l&#x27;onglet manœuvres"');
    expect(html.match(/an-sheet__stat--link/g)).toHaveLength(2);
    expect(html.match(/an-sheet__stat-chevron/g)).toHaveLength(2);
    expect(html).toMatch(/<span class="an-sheet__stat-label">Virements réussis<span class="an-sheet__stat-chevron"><svg[^>]*aria-hidden="true"/);
  });

  it('tuile sans onglet : un simple bloc, sans chevron', () => {
    expect(html).toContain('<div class="an-sheet__stat"><span class="an-sheet__stat-label">Temps total</span>');
  });

  it('paires gardées : les deux boutons dans le même bloc de deux colonnes', () => {
    expect(html).toMatch(/<div class="an-sheet__stat-pair"><button[^>]*Virements[^]*<\/button><button[^>]*Empannages[^]*<\/button><\/div>/);
  });

  it('sans `linkOf` : rien ne change, aucun bouton', () => {
    const plain = renderToStaticMarkup(<GeneralStats stats={STATS} pairs={PAIRS} />);
    expect(plain).not.toContain('<button');
    expect(plain).not.toContain('chevron');
  });
});
