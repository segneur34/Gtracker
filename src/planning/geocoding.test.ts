import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePhoton, parsePhotonFeatures, photonReverseUrl, photonUrl, reversePlaces, roundedPoint, searchPlaces } from './geocoding';

describe('Photon', () => {
  it('cherche en français, près du centre de la carte arrondi à environ un kilomètre', () => {
    const url = photonUrl('pic saint loup', { lat: 43.61234, lon: 3.87654 });
    expect(url).toBe('https://photon.komoot.io/api/?q=pic+saint+loup&limit=6&lang=fr&lat=43.61&lon=3.88');
  });

  it('lit nom, situation et position des lieux', () => {
    // Extrait réel (25/09/2026), plus une entrée sans position et une adresse sans nom.
    const places = parsePhoton({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Refuge de la Pra', street: 'Crête NW Grand Colon', city: 'Revel', county: 'Isère', country: 'France' },
          geometry: { type: 'Point', coordinates: [5.9445494, 45.1615471] },
        },
        { type: 'Feature', properties: { name: 'Sans position' }, geometry: { type: 'Point' } },
        {
          type: 'Feature',
          properties: { housenumber: '3', street: 'Rue de la Loge', city: 'Montpellier', county: 'Hérault', country: 'France' },
          geometry: { type: 'Point', coordinates: [3.877, 43.61] },
        },
        { type: 'Feature', properties: { name: 'Montpellier', city: 'Montpellier', country: 'France' }, geometry: { type: 'Point', coordinates: [3.87, 43.61] } },
      ],
    });
    expect(places).toEqual([
      { label: 'Refuge de la Pra', detail: 'Revel, Isère, France', lat: 45.1615471, lon: 5.9445494 },
      { label: '3 Rue de la Loge', detail: 'Montpellier, Hérault, France', lat: 43.61, lon: 3.877 },
      { label: 'Montpellier', detail: 'France', lat: 43.61, lon: 3.87 },
    ]);
    expect(parsePhoton(null)).toEqual([]);
  });
});

describe('recherche de lieux par le serveur', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('une réponse illisible donne un message en français', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>', { status: 200 }));
    await expect(searchPlaces('pic')).rejects.toThrow('Réponse de la recherche de lieux illisible.');
  });

  it('la recherche inverse ne demande que la position arrondie, la langue, le nombre et le rayon', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({
        features: [{ properties: { name: 'Plage du Petit Travers', osm_key: 'natural', osm_value: 'beach', city: 'Mauguio' }, geometry: { coordinates: [3.99, 43.55] } }],
      }), { status: 200 });
    });
    const found = await reversePlaces({ lat: 43.548765, lon: 3.981234 }, { limit: 25, radiusM: 1500 });
    expect(found).toEqual([{ name: 'Plage du Petit Travers', osmKey: 'natural', osmValue: 'beach', city: 'Mauguio', lat: 43.55, lon: 3.99 }]);
    expect(asked).toEqual(['https://photon.komoot.io/reverse?lat=43.549&lon=3.981&lang=fr&limit=25&radius=1.5']);
  });

  it('sans réseau, la recherche inverse échoue en clair', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(reversePlaces({ lat: 1, lon: 1 }, { limit: 5, radiusM: 1000 })).rejects.toThrow('Pas de réseau');
  });
});

describe('recherche inverse', () => {
  it('arrondit la position à trois décimales, une centaine de mètres', () => {
    expect(roundedPoint({ lat: -12.34567, lon: 120.00049 })).toEqual({ lat: -12.346, lon: 120 });
    expect(photonReverseUrl({ lat: -12.34567, lon: 120.00049 }, { limit: 10, radiusM: 2000 }))
      .toBe('https://photon.komoot.io/reverse?lat=-12.346&lon=120.000&lang=fr&limit=10&radius=2');
  });

  it('garde nom, étiquettes et commune de chaque objet ; écarte ceux sans position', () => {
    expect(parsePhotonFeatures({
      features: [
        { properties: { osm_key: 'highway', osm_value: 'residential', city: 'Sète' }, geometry: { coordinates: [3.6, 43.4] } },
        { properties: { name: 'Sans position' }, geometry: {} },
      ],
    })).toEqual([{ name: null, osmKey: 'highway', osmValue: 'residential', city: 'Sète', lat: 43.4, lon: 3.6 }]);
  });
});
