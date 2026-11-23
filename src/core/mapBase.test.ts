import { describe, expect, it } from 'vitest';
import { fillTileTemplate, isMapBase, resolveMapBase, isTileTemplate, MAP_BASES, shareCredit, tileTemplate, tileUrl } from './mapBase';
import { tileKey } from './tiles';

describe('tileUrl', () => {
  const tile = { z: 15, x: 16808, y: 11953 };

  it('donne l’adresse OSM, sans sous-domaine', () => {
    expect(tileUrl('plan', tile)).toBe('https://tile.openstreetmap.org/15/16808/11953.png');
  });

  it('remplit un gabarit dans n’importe quel ordre des repères', () => {
    expect(fillTileTemplate('https://a.example/{z}/{y}/{x}', tile)).toBe('https://a.example/15/11953/16808');
  });
});

describe('clés des tuiles par fond', () => {
  it('garde la clé du plan sans préfixe : les tuiles déjà gardées restent lisibles', () => {
    expect(tileKey({ z: 14, x: 8310, y: 5980 }, MAP_BASES.plan.keyPrefix)).toBe('14_8310_5980');
  });
});

describe('isMapBase', () => {
  it('écarte une valeur stockée inconnue, et un fond retiré', () => {
    expect(isMapBase('plan')).toBe(true);
    expect(isMapBase('satellite')).toBe(false);
    expect(isMapBase('hybride')).toBe(false);
    expect(isMapBase('toString')).toBe(false);
    expect(isMapBase(undefined)).toBe(false);
  });
});

describe('resolveMapBase', () => {
  it('prend le fond de la session, sinon celui de la famille', () => {
    expect(resolveMapBase('plan', 'plan')).toBe('plan');
    expect(resolveMapBase(undefined, 'plan')).toBe('plan');
    expect(resolveMapBase('hybride', 'plan')).toBe('plan');
  });

  it('une fiche rangée avec le fond retiré prend celui de la famille', () => {
    expect(resolveMapBase('satellite', 'plan')).toBe('plan');
  });
});

describe('mentions', () => {
  it('le plan n’est pas un fond photographique', () => {
    expect(MAP_BASES.plan.photo).toBe(false);
  });

  it('l’image de partage porte l’adresse de la licence d’OpenStreetMap', () => {
    expect(shareCredit('plan')).toBe('© OpenStreetMap · openstreetmap.org/copyright');
  });

  it('la vignette garde la mention courte', () => {
    expect(MAP_BASES.plan.credit).toBe('© OpenStreetMap');
  });
});

describe('adresse des tuiles réglable', () => {
  const tile = { z: 15, x: 16808, y: 11953 };
  const custom = 'https://tuiles.example.org/{z}/{x}/{y}.png';

  it('vide ou absente : l’adresse d’origine', () => {
    expect(tileTemplate('plan')).toBe(MAP_BASES.plan.url);
    expect(tileTemplate('plan', {})).toBe(MAP_BASES.plan.url);
    expect(tileTemplate('plan', { plan: '' })).toBe(MAP_BASES.plan.url);
    expect(tileTemplate('plan', { plan: '   ' })).toBe(MAP_BASES.plan.url);
  });

  it('renseignée : la sienne, espaces autour retirés', () => {
    expect(tileTemplate('plan', { plan: `  ${custom} ` })).toBe(custom);
    expect(tileUrl('plan', tile, tileTemplate('plan', { plan: custom }))).toBe('https://tuiles.example.org/15/16808/11953.png');
  });

  it('sans les trois repères, ou pas une adresse web : l’adresse d’origine', () => {
    expect(tileTemplate('plan', { plan: 'https://tuiles.example.org/{z}/{x}.png' })).toBe(MAP_BASES.plan.url);
    expect(tileTemplate('plan', { plan: 'tuiles.example.org/{z}/{x}/{y}.png' })).toBe(MAP_BASES.plan.url);
    expect(isTileTemplate('ftp://a/{z}/{x}/{y}')).toBe(false);
    expect(isTileTemplate('http://a.example/{z}/{x}/{y}')).toBe(false);
    expect(tileTemplate('plan', { plan: 'http://tuiles.example.org/{z}/{x}/{y}.png' })).toBe(MAP_BASES.plan.url);
    expect(isTileTemplate('https://a b/{z}/{x}/{y}')).toBe(false);
  });

  it('un repère répété ou un repère inconnu ({s}) est refusé : il resterait en clair dans l’adresse demandée', () => {
    expect(isTileTemplate('https://a.example/{z}/{x}/{y}@{z}x.png')).toBe(false);
    expect(isTileTemplate('https://{s}.example/{z}/{x}/{y}.png')).toBe(false);
    expect(isTileTemplate('https://a.example/{z}/{x}/{y}?r={r}')).toBe(false);
    expect(isTileTemplate('https://a.example/{y}/{x}/{z}.png')).toBe(true);
  });

  it('l’adresse d’origine est valide', () => {
    expect(isTileTemplate(MAP_BASES.plan.url)).toBe(true);
  });
});
