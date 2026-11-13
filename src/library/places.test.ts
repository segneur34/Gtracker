import { describe, expect, it } from 'vitest';
import { parsePhotonFeatures } from '../planning/geocoding';
import { PLACE_RULES, choosePlace, firstTrackPoint, foundPlace, isUsablePlaceName, readSessionPlace } from './places';

const START = { lat: 43.54, lon: 3.95 };
/** Mètres par degré de latitude, sur le rayon terrestre de `haversineDistance`. */
const M_PER_DEG = (6371e3 * Math.PI) / 180;
const north = (m: number): [number, number] => [START.lon, START.lat + m / M_PER_DEG];

/** Réponse de la recherche inverse, à la forme de celles du service (FeatureCollection, coordonnées lon, lat). */
const response = (...features: { at: [number, number]; props: Record<string, unknown> }[]) => ({
  type: 'FeatureCollection',
  features: features.map(({ at, props }) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: at } })),
});

const choose = (json: unknown, rules = PLACE_RULES) => choosePlace(parsePhotonFeatures(json), START, rules);

describe('choosePlace', () => {
  it('retient la plage nommée la plus proche, devant les rues et la commune', () => {
    const json = response(
      { at: north(40), props: { osm_key: 'highway', osm_value: 'residential', name: 'Avenue Grassion Cibrand', city: 'Mauguio' } },
      { at: north(80), props: { osm_key: 'place', osm_value: 'village', name: 'Carnon-Plage', city: 'Mauguio' } },
      { at: north(300), props: { osm_key: 'natural', osm_value: 'beach', name: 'Plage du Grand Travers', city: 'Mauguio' } },
      { at: north(900), props: { osm_key: 'leisure', osm_value: 'marina', name: 'Port de Carnon', city: 'Mauguio' } },
    );
    expect(choose(json)).toBe('Plage du Grand Travers');
  });

  it('sans plan d\'eau nommé : la commune de l\'objet le plus proche, ou la localité elle-même', () => {
    const json = response(
      { at: north(40), props: { osm_key: 'highway', osm_value: 'residential', name: 'Rue du Port', city: 'Palavas-les-Flots' } },
      { at: north(300), props: { osm_key: 'natural', osm_value: 'beach' } },
    );
    expect(choose(json)).toBe('Palavas-les-Flots');
    const village = response({ at: north(60), props: { osm_key: 'place', osm_value: 'village', name: 'Carnon-Plage' } });
    expect(choose(village)).toBe('Carnon-Plage');
  });

  it('réponse vide ou illisible : rien', () => {
    expect(choose(response())).toBeNull();
    expect(choose(null)).toBeNull();
    expect(choose({ features: 'non' })).toBeNull();
  });

  it('écarte un nom vide ou fait de chiffres', () => {
    const json = response(
      { at: north(100), props: { osm_key: 'natural', osm_value: 'beach', name: '  ' } },
      { at: north(200), props: { osm_key: 'leisure', osm_value: 'marina', name: '12-3' } },
      { at: north(300), props: { osm_key: 'highway', osm_value: 'path', city: '34' } },
      { at: north(400), props: { osm_key: 'highway', osm_value: 'path', city: 'Mauguio' } },
    );
    expect(choose(json)).toBe('Mauguio');
    expect(isUsablePlaceName('Étang de l\'Or')).toBe(true);
    expect(isUsablePlaceName('2024')).toBe(false);
  });

  it('un plan d\'eau ne compte que dans le rayon : 499 m oui, 501 m non', () => {
    const rules = { ...PLACE_RULES, waterRadiusM: 500 };
    const at = (m: number) => response(
      { at: north(m), props: { osm_key: 'natural', osm_value: 'bay', name: 'Baie de l\'Aygade' } },
      { at: north(20), props: { osm_key: 'highway', osm_value: 'path', city: 'Hyères' } },
    );
    expect(choose(at(499), rules)).toBe('Baie de l\'Aygade');
    expect(choose(at(501), rules)).toBe('Hyères');
  });
});

describe('lieu de la fiche', () => {
  it('se range arrondi à trois décimales, et se relit', () => {
    const place = foundPlace('Carnon-Plage', { lat: 43.548765, lon: 3.981234 });
    expect(place).toEqual({ name: 'Carnon-Plage', source: 'carte', lat: 43.549, lon: 3.981 });
    expect(readSessionPlace(JSON.parse(JSON.stringify(place)))).toEqual(place);
    expect(readSessionPlace({ ...place, name: null })).toEqual({ ...place, name: null });
  });

  it('un lieu mal formé se lit absent ; un nom absurde se lit « rien trouvé »', () => {
    expect(readSessionPlace(null)).toBeNull();
    expect(readSessionPlace({ name: 'X', source: 'deviné', lat: 1, lon: 1 })).toBeNull();
    expect(readSessionPlace({ name: 'X', source: 'carte', lat: 91, lon: 1 })).toBeNull();
    expect(readSessionPlace({ name: 3, source: 'carte', lat: 1, lon: 1 })).toBeNull();
    expect(readSessionPlace({ name: '123', source: 'appris', lat: 1, lon: 1 })).toEqual({ name: null, source: 'appris', lat: 1, lon: 1 });
  });
});

describe('firstTrackPoint', () => {
  it('lit le premier point de la trace, attributs dans tous les ordres', () => {
    const gpx = '<gpx><wpt lat="1" lon="1"/><trk><trkseg><trkpt lon="3.95" lat=\'43.54\'><time>t</time></trkpt><trkpt lat="44" lon="4"/></trkseg></trk></gpx>';
    expect(firstTrackPoint(gpx)).toEqual({ lat: 43.54, lon: 3.95 });
  });

  it('saute un point illisible ; sans point, rien', () => {
    expect(firstTrackPoint('<trkpt lat="x" lon="1"></trkpt><trkpt lat="2" lon="3"/>')).toEqual({ lat: 2, lon: 3 });
    expect(firstTrackPoint('<gpx><trk/></gpx>')).toBeNull();
  });
});
