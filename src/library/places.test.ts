import { describe, expect, it } from 'vitest';
import { parsePhotonFeatures } from '../planning/geocoding';
import {
  PLACE_RULES, choosePlace, correctedPlace, firstTrackPoint, foundPlace, isElsewhere, isPlaceToFind, isUsablePlaceName,
  lastTrackPoint, learnPlace, learnedAfterCorrection, learnedReplacing, learnedSpot, nearestLearnedPlace, placeDraftOf,
  placeRenames, placesToLearn, readSessionPlace, renamedLearnedPlaces, renamedPlace, spotFromSearch, trackEnds,
  type LearnedPlace, type PlaceSource, type PlaceSpot, type SessionPlace,
} from './places';

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

describe('spotFromSearch', () => {
  const json = response({ at: north(80), props: { osm_key: 'place', osm_value: 'village', name: 'Carnon-Plage' } });

  it('le nom choisi sur la carte, au point arrondi', () => {
    expect(spotFromSearch(parsePhotonFeatures(json), START, [], PLACE_RULES)).toEqual({ name: 'Carnon-Plage', source: 'carte', lat: 43.54, lon: 3.95 });
  });

  it('un nom de la carte renommé alentour prend le nom appris', () => {
    const learned: LearnedPlace[] = [{ name: 'Le Grand Travers', lat: START.lat, lon: START.lon, savedAt: 1, replaces: ['Carnon-Plage'] }];
    expect(spotFromSearch(parsePhotonFeatures(json), START, learned, PLACE_RULES)).toEqual({ name: 'Le Grand Travers', source: 'appris', lat: 43.54, lon: 3.95 });
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

describe('arrivée dans la fiche', () => {
  const carte = { name: 'Carnon-Plage', source: 'carte' as const, lat: 43.549, lon: 3.981 };

  it('absente (fiche plus ancienne) : à regarder ; nulle ou lieu : regardée', () => {
    expect(readSessionPlace(carte)).toEqual(carte);
    expect(isPlaceToFind(readSessionPlace(carte)!)).toBe(true);
    expect(readSessionPlace({ ...carte, arrival: null })).toEqual({ ...carte, arrival: null });
    const arrival = { name: 'Palavas-les-Flots', source: 'carte' as const, lat: 43.53, lon: 3.93 };
    expect(readSessionPlace({ ...carte, arrival })).toEqual({ ...carte, arrival });
    expect(isPlaceToFind({ ...carte, arrival: null })).toBe(false);
    expect(isPlaceToFind(undefined)).toBe(true);
    // Mal formée : lue comme pas encore regardée, le départ gardé.
    expect(readSessionPlace({ ...carte, arrival: { name: 'X', source: 'deviné', lat: 1, lon: 1 } })).toEqual(carte);
  });

  it('un lieu de la carte posé en (0, 0) est lu absent, cherché de nouveau ; un lieu saisi est gardé', () => {
    const zero = { lat: 0, lon: 0 };
    expect(readSessionPlace({ name: 'Golfe de Guinée', source: 'carte', ...zero })).toBeNull();
    expect(readSessionPlace({ name: null, source: 'carte', ...zero, arrival: null })).toBeNull();
    expect(readSessionPlace({ ...carte, arrival: { name: 'Golfe de Guinée', source: 'carte', ...zero } })).toEqual(carte);
    const typed = { name: 'Chez moi', source: 'utilisateur' as const, ...zero };
    expect(readSessionPlace(typed)).toEqual(typed);
    expect(readSessionPlace({ ...carte, lat: 0 })).toEqual({ ...carte, lat: 0 });
  });

  it('une arrivée compte comme ailleurs au-delà de `elsewhereM`', () => {
    const at = (m: number) => ({ lat: START.lat + m / M_PER_DEG, lon: START.lon });
    expect(isElsewhere(START, at(1999), PLACE_RULES)).toBe(false);
    expect(isElsewhere(START, at(2001), PLACE_RULES)).toBe(true);
    expect(isElsewhere(START, null, PLACE_RULES)).toBe(false);
  });
});

describe('lieux appris', () => {
  const at = (m: number) => ({ lat: START.lat + m / M_PER_DEG, lon: START.lon });
  const learned = (name: string, m: number, savedAt = 1): LearnedPlace => ({ name, ...at(m), savedAt });

  it('un lieu appris vaut à moins de `learnedRadiusM` : 499 m oui, 501 m non', () => {
    expect(nearestLearnedPlace(START, [learned('Les Roquilles', 499)], PLACE_RULES)?.name).toBe('Les Roquilles');
    expect(nearestLearnedPlace(START, [learned('Les Roquilles', 501)], PLACE_RULES)).toBeNull();
    expect(nearestLearnedPlace(START, [learned('Loin', 450), learned('Près', -100)], PLACE_RULES)?.name).toBe('Près');
    expect(nearestLearnedPlace(START, [], PLACE_RULES)).toBeNull();
  });

  it('corriger deux fois au même endroit remplace le lieu appris, sans doublon ; ailleurs, il s\'ajoute', () => {
    const first = learnPlace([], { name: 'Les Roquilles', source: 'utilisateur', ...at(0) }, PLACE_RULES, 1);
    const second = learnPlace(first, { name: 'Plage des Roquilles', source: 'utilisateur', ...at(300) }, PLACE_RULES, 2);
    expect(second).toEqual([{ name: 'Plage des Roquilles', ...at(300), savedAt: 2 }]);
    const third = learnPlace(second, { name: 'Port de Carnon', source: 'utilisateur', ...at(3000) }, PLACE_RULES, 3);
    expect(third.map((p) => p.name)).toEqual(['Port de Carnon', 'Plage des Roquilles']);
  });

  it('pris d\'un lieu appris : source `appris`, au point arrondi', () => {
    expect(learnedSpot(learned('Les Roquilles', 100), { lat: 43.54012, lon: 3.95049 }))
      .toEqual({ name: 'Les Roquilles', source: 'appris', lat: 43.54, lon: 3.95 });
  });
});

describe('« Lieu » : correction', () => {
  const carte: SessionPlace = { name: 'Carnon-Plage', source: 'carte', lat: 43.549, lon: 3.981, arrival: null };

  it('le nom saisi passe en `utilisateur` et s\'apprend ; inchangé, rien ne bouge', () => {
    const after = correctedPlace(carte, START, '  Les Roquilles ');
    expect(after).toEqual({ ...carte, name: 'Les Roquilles', source: 'utilisateur' });
    expect(placesToLearn(carte, after)).toEqual([after]);
    expect(correctedPlace(carte, START, 'Carnon-Plage')).toBe(carte);
    // Valider de nouveau le même nom corrigé n'apprend rien de plus.
    expect(placesToLearn(after, correctedPlace(after, START, 'Les Roquilles'))).toEqual([]);
  });

  it('vidé : plus de lieu, `utilisateur`, rien d\'appris', () => {
    const after = correctedPlace(carte, START, '   ');
    expect(after).toEqual({ ...carte, name: null, source: 'utilisateur' });
    expect(placesToLearn(carte, after)).toEqual([]);
  });

  it('jamais cherché : le lieu saisi au point de départ arrondi, l\'arrivée laissée à regarder', () => {
    expect(correctedPlace(undefined, { lat: 43.54012, lon: 3.95049 }, 'Les Roquilles'))
      .toEqual({ name: 'Les Roquilles', source: 'utilisateur', lat: 43.54, lon: 3.95 });
    expect(correctedPlace(undefined, START, '')).toEqual({ name: null, source: 'utilisateur', lat: 43.54, lon: 3.95 });
  });

  it('arrivée corrigée seule : le départ garde sa source, l\'arrivée s\'apprend à son point', () => {
    const arrival = { name: 'Palavas', source: 'carte' as const, lat: 43.53, lon: 3.93 };
    const place = { ...carte, arrival };
    const after = correctedPlace(place, START, 'Carnon-Plage', 'Port de Palavas');
    expect(after).toEqual({ ...carte, arrival: { ...arrival, name: 'Port de Palavas', source: 'utilisateur' } });
    expect(placesToLearn(place, after)).toEqual([after.arrival]);
    expect(placeDraftOf(after)).toEqual({ departure: 'Carnon-Plage', arrival: 'Port de Palavas' });
    expect(placeDraftOf(carte)).toEqual({ departure: 'Carnon-Plage', arrival: null });
    expect(placeDraftOf(undefined)).toEqual({ departure: '', arrival: null });
  });
});

describe('lieu renommé : les voisines du même nom', () => {
  const at = (m: number) => ({ lat: START.lat + m / M_PER_DEG, lon: START.lon });
  const spot = (name: string | null, m: number, source: PlaceSource = 'carte'): PlaceSpot => ({ name, source, ...at(m) });
  const vailhes = (m: number, source: PlaceSource = 'carte'): SessionPlace => ({ ...spot('Les Vailhés', m, source), arrival: null });
  const corrected = correctedPlace(vailhes(0), START, 'Les Vailhes');
  const renames = placeRenames(vailhes(0), corrected);

  it('un nom non vide changé en un autre est un renommage, au point du lieu corrigé ; vidé ou neuf, non', () => {
    expect(renames).toEqual([{ from: 'Les Vailhés', to: 'Les Vailhes', ...at(0) }]);
    expect(placeRenames(vailhes(0), correctedPlace(vailhes(0), START, '  '))).toEqual([]);
    expect(placeRenames(undefined, correctedPlace(undefined, START, 'Les Vailhes'))).toEqual([]);
    expect(placeRenames({ ...vailhes(0), name: null }, correctedPlace({ ...vailhes(0), name: null }, START, 'Les Vailhes'))).toEqual([]);
    const withArrival: SessionPlace = { ...vailhes(0), arrival: spot('Port de Celles', 2500) };
    expect(placeRenames(withArrival, correctedPlace(withArrival, START, 'Les Vailhés', 'Celles')))
      .toEqual([{ from: 'Port de Celles', to: 'Celles', ...at(2500) }]);
  });

  it('le même nom exactement, à moins de `renameRadiusM` : renommé, `appris` ; 2 999 m oui, 3 001 m non', () => {
    expect(renamedPlace(vailhes(2999), renames, PLACE_RULES)).toEqual({ ...vailhes(2999), name: 'Les Vailhes', source: 'appris' });
    const far = vailhes(3001);
    expect(renamedPlace(far, renames, PLACE_RULES)).toBe(far);
  });

  it('un autre nom, même tout près, ne bouge pas : accents et casse comptent', () => {
    for (const name of ['Celles', 'Les Vailhes', 'les Vailhés', 'Lac des Vailhés']) {
      const place: SessionPlace = { ...spot(name, 300), arrival: null };
      expect(renamedPlace(place, renames, PLACE_RULES)).toBe(place);
    }
  });

  it('un lieu déjà corrigé par l\'utilisateur le reste ; départ et arrivée se répondent dans les deux sens', () => {
    expect(renamedPlace(vailhes(500, 'utilisateur'), renames, PLACE_RULES).source).toBe('utilisateur');
    const arriving: SessionPlace = { ...spot('Celles', -2500), arrival: spot('Les Vailhés', 800) };
    expect(renamedPlace(arriving, renames, PLACE_RULES)).toEqual({ ...arriving, arrival: { ...spot('Les Vailhes', 800, 'appris') } });
    // Une arrivée renommée renomme le départ d'une autre session.
    const fromArrival = [{ from: 'Les Vailhés', to: 'Les Vailhes', ...at(800) }];
    expect(renamedPlace(vailhes(0), fromArrival, PLACE_RULES).name).toBe('Les Vailhes');
  });

  it('lieux appris : l\'ancien nom alentour renommé, daté, l\'ancien nom retenu ; rien à changer, la même liste', () => {
    const learned: LearnedPlace[] = [
      { name: 'Les Vailhés', ...at(1500), savedAt: 1 },
      { name: 'Celles', ...at(300), savedAt: 1 },
      { name: 'Les Vailhés', ...at(5000), savedAt: 1 },
    ];
    expect(renamedLearnedPlaces(learned, renames, PLACE_RULES, 9)).toEqual([
      { name: 'Les Vailhes', ...at(1500), savedAt: 9, replaces: ['Les Vailhés'] },
      learned[1],
      learned[2],
    ]);
    expect(renamedLearnedPlaces(learned, [], PLACE_RULES, 9)).toBe(learned);
  });

  it('après « Lieu » : le nom corrigé appris retient l\'ancien nom, et ceux du lieu appris qu\'il remplace', () => {
    expect(learnedAfterCorrection([], vailhes(0), corrected, PLACE_RULES, 5))
      .toEqual([{ name: 'Les Vailhes', ...at(0), savedAt: 5, replaces: ['Les Vailhés'] }]);
    // Deuxième changement au même endroit : le nom de la carte mène au dernier.
    const learned = learnedAfterCorrection([], vailhes(0), corrected, PLACE_RULES, 5);
    const second = correctedPlace({ ...corrected, source: 'appris' }, START, 'Lac des Vailhés');
    expect(learnedAfterCorrection(learned, { ...corrected, source: 'appris' }, second, PLACE_RULES, 6))
      .toEqual([{ name: 'Lac des Vailhés', ...at(0), savedAt: 6, replaces: ['Les Vailhes', 'Les Vailhés'] }]);
    // Ni renommage ni nom appris : la même liste.
    const empty: LearnedPlace[] = [];
    expect(learnedAfterCorrection(empty, corrected, corrected, PLACE_RULES, 7)).toBe(empty);
  });

  it('un nom de la carte remplacé alentour prend le nom appris ; ailleurs, ou un autre nom, non', () => {
    const learned: LearnedPlace[] = [{ name: 'Les Vailhes', ...at(0), savedAt: 5, replaces: ['Les Vailhés'] }];
    expect(learnedReplacing('Les Vailhés', at(2900), learned, PLACE_RULES)?.name).toBe('Les Vailhes');
    expect(learnedReplacing('Les Vailhés', at(3100), learned, PLACE_RULES)).toBeNull();
    expect(learnedReplacing('Celles', at(100), learned, PLACE_RULES)).toBeNull();
    expect(learnedReplacing(null, at(100), learned, PLACE_RULES)).toBeNull();
  });
});

describe('lastTrackPoint et trackEnds', () => {
  it('lit le dernier point lisible, préfixe d\'espace de noms compris', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="43.54" lon="3.95"/><gpx:trkpt lon="4" lat="44"><time>t</time></gpx:trkpt><trkpt lat="x" lon="1"></trkpt></trkseg></trk></gpx>';
    expect(lastTrackPoint(gpx)).toEqual({ lat: 44, lon: 4 });
    expect(trackEnds(gpx)).toEqual({ start: { lat: 43.54, lon: 3.95 }, end: { lat: 44, lon: 4 } });
    expect(lastTrackPoint('<gpx><trk/></gpx>')).toBeNull();
    expect(trackEnds('<gpx><trk/></gpx>')).toBeNull();
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

  it('saute le (0, 0) d\'un enregistreur sans satellites et les positions hors de la Terre, au départ comme à l\'arrivée', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="200" lon="3"/><trkpt lat="43.54" lon="3.95"/>'
      + '<trkpt lat="44" lon="4"/><trkpt lat="44" lon="181"/><trkpt lat="0.0" lon="0.000"/></trkseg></trk></gpx>';
    expect(firstTrackPoint(gpx)).toEqual({ lat: 43.54, lon: 3.95 });
    expect(lastTrackPoint(gpx)).toEqual({ lat: 44, lon: 4 });
    expect(firstTrackPoint('<trkpt lat="0" lon="0"/>')).toBeNull();
  });
});
