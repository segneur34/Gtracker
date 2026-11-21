import { describe, expect, it } from 'vitest';
import type { Waypoint } from '../planning/route';
import { ROUTE_VERSION, routeToRecord } from '../planning/routeRecord';
import { PLACE_RULES, type PlaceSpot, type SessionPlace } from './places';
import { routeDisplayName, routeKind, routePlace, routePlaceTarget, routeRecordWithPlace, type RouteNameSource } from './routeName';

/** Mètres par degré de latitude, sur le rayon terrestre de `haversineDistance`. */
const M_PER_DEG = (6371e3 * Math.PI) / 180;
const START: Waypoint = { lat: 43.54, lon: 3.95 };
const north = (m: number, from: Waypoint = START): Waypoint => ({ lat: from.lat + m / M_PER_DEG, lon: from.lon });

/** Une boucle de trois balises, revenue au départ. */
const LOOP: Waypoint[] = [START, north(800), north(400, { lat: START.lat, lon: START.lon + 0.01 }), START];
/** Un aller qui finit à 5 km du départ. */
const AWAY: Waypoint[] = [START, north(2500), north(5000)];
/** Un aller qui finit à 1 km du départ. */
const NEAR: Waypoint[] = [START, north(600), north(1000)];

const CREATED = new Date(2026, 10, 20, 9, 30).toISOString();
const spot = (name: string | null, at: Waypoint = START): PlaceSpot => ({ name, source: 'carte', lat: at.lat, lon: at.lon });
const record = (over: Partial<RouteNameSource> = {}): RouteNameSource => ({ name: '', waypoints: AWAY, createdAt: CREATED, ...over });

describe('routeDisplayName', () => {
  it('les cinq gabarits', () => {
    expect(routeDisplayName(record({ waypoints: LOOP, place: { ...spot('Carnon-Plage'), arrival: null } }))).toBe('Boucle à Carnon-Plage le 20/11');
    expect(routeDisplayName(record({ place: { ...spot('Carnon-Plage'), arrival: spot('Palavas-les-Flots', north(5000)) } })))
      .toBe('Aller de Carnon-Plage à Palavas-les-Flots le 20/11');
    expect(routeDisplayName(record({ place: { ...spot('Carnon-Plage'), arrival: null } }))).toBe('Aller de Carnon-Plage le 20/11');
    expect(routeDisplayName(record({ waypoints: LOOP }))).toBe('Boucle du 20/11');
    expect(routeDisplayName(record())).toBe('Aller du 20/11');
  });

  it('arrivée du même nom, ou pas encore regardée : le départ seul', () => {
    expect(routeDisplayName(record({ place: { ...spot('Carnon-Plage'), arrival: spot('carnon-plage', north(5000)) } })))
      .toBe('Aller de Carnon-Plage le 20/11');
    expect(routeDisplayName(record({ place: spot('Carnon-Plage') }))).toBe('Aller de Carnon-Plage le 20/11');
  });

  it('une boucle ne montre pas l\'arrivée d\'un ancien aller', () => {
    expect(routeDisplayName(record({ waypoints: LOOP, place: { ...spot('Carnon-Plage'), arrival: spot('Palavas', north(5000)) } })))
      .toBe('Boucle à Carnon-Plage le 20/11');
  });

  it('départ sans nom trouvé : le nom sans lieu', () => {
    expect(routeDisplayName(record({ place: { ...spot(null), arrival: spot('Palavas', north(5000)) } }))).toBe('Aller du 20/11');
  });

  it('le nom saisi prime, rogné ; un nom blanc rend le nom composé', () => {
    expect(routeDisplayName(record({ name: '  Tour des îles ', place: spot('Carnon-Plage') }))).toBe('Tour des îles');
    expect(routeDisplayName(record({ name: 'Itinéraire du 18/11/2026', waypoints: LOOP }))).toBe('Itinéraire du 18/11/2026');
    expect(routeDisplayName(record({ name: '   ', waypoints: LOOP }))).toBe('Boucle du 20/11');
  });

  it('la date est le jour de création, jour et mois', () => {
    expect(routeDisplayName(record({ createdAt: new Date(2026, 0, 3, 23, 50).toISOString() }))).toBe('Aller du 03/01');
  });

  it('un lieu mal formé dans la fiche est ignoré', () => {
    expect(routeDisplayName(record({ place: { name: 'Carnon', source: 'inconnue', lat: 43, lon: 3 } }))).toBe('Aller du 20/11');
    expect(routePlace({ place: 'Carnon' })).toBeUndefined();
  });
});

describe('routeDisplayName : lieu périmé', () => {
  const loopPlace: SessionPlace = { ...spot('Carnon-Plage'), arrival: null };
  const awayPlace: SessionPlace = { ...spot('Carnon-Plage'), arrival: spot('Palavas-les-Flots', AWAY[2]) };

  it('départ déplacé de plus de 500 m : le lieu n\'est plus cité ; de moins, il l\'est encore', () => {
    const moved = (m: number) => [north(m), ...LOOP.slice(1, -1), north(m)];
    expect(routeDisplayName(record({ waypoints: moved(600), place: loopPlace }))).toBe('Boucle du 20/11');
    expect(routeDisplayName(record({ waypoints: moved(300), place: loopPlace }))).toBe('Boucle à Carnon-Plage le 20/11');
    expect(routeDisplayName(record({ waypoints: [north(600), ...AWAY.slice(1)], place: awayPlace }))).toBe('Aller du 20/11');
  });

  it('arrivée seule déplacée : le départ reste cité, l\'arrivée périmée ne l\'est plus', () => {
    expect(routeDisplayName(record({ waypoints: [START, north(2500), north(4000)], place: awayPlace }))).toBe('Aller de Carnon-Plage le 20/11');
  });

  it('boucle changée en aller : le départ cité, sans arrivée tant qu\'elle n\'est pas trouvée', () => {
    expect(routeDisplayName(record({ waypoints: AWAY, place: loopPlace }))).toBe('Aller de Carnon-Plage le 20/11');
  });

  it('sans point : le nom sans lieu', () => {
    expect(routeDisplayName(record({ waypoints: [], place: loopPlace }))).toBe('Aller du 20/11');
  });
});

describe('routeKind', () => {
  it('boucle : trois points au moins, le dernier sur le départ', () => {
    expect(routeKind(LOOP)).toBe('boucle');
    expect(routeKind(AWAY)).toBe('aller');
    expect(routeKind([START, START])).toBe('aller');
    expect(routeKind([])).toBe('aller');
  });
});

describe('routePlaceTarget', () => {
  it('moins de deux points : rien à chercher', () => {
    expect(routePlaceTarget(undefined, [START], PLACE_RULES)).toBeNull();
  });

  it('jamais cherché : le départ, et l\'arrivée d\'un aller lointain', () => {
    expect(routePlaceTarget(undefined, AWAY, PLACE_RULES)).toEqual({ start: START, departure: null, end: AWAY[2], arrival: null });
    expect(routePlaceTarget(undefined, NEAR, PLACE_RULES)).toEqual({ start: START, departure: null, end: null, arrival: null });
    expect(routePlaceTarget(undefined, LOOP, PLACE_RULES)).toEqual({ start: START, departure: null, end: null, arrival: null });
  });

  it('lieu à jour : rien à faire', () => {
    const away: SessionPlace = { ...spot('Carnon-Plage'), arrival: spot('Palavas', AWAY[2]) };
    expect(routePlaceTarget(away, AWAY, PLACE_RULES)).toBeNull();
    expect(routePlaceTarget({ ...spot('Carnon-Plage'), arrival: null }, LOOP, PLACE_RULES)).toBeNull();
    expect(routePlaceTarget({ ...spot(null), arrival: null }, NEAR, PLACE_RULES)).toBeNull();
  });

  it('départ déplacé de plus de 500 m : cherché de nouveau ; de moins, gardé', () => {
    const place: SessionPlace = { ...spot('Carnon-Plage'), arrival: null };
    const moved = (m: number) => [north(m), ...LOOP.slice(1, -1), north(m)];
    expect(routePlaceTarget(place, moved(600), PLACE_RULES)).toEqual({ start: north(600), departure: null, end: null, arrival: null });
    expect(routePlaceTarget(place, moved(300), PLACE_RULES)).toBeNull();
  });

  it('boucle retirée : l\'arrivée devient à chercher, le départ reste', () => {
    const place: SessionPlace = { ...spot('Carnon-Plage'), arrival: null };
    expect(routePlaceTarget(place, AWAY, PLACE_RULES)).toEqual({ start: START, departure: spot('Carnon-Plage'), end: AWAY[2], arrival: null });
  });

  it('aller bouclé : l\'arrivée devient nulle, sans recherche', () => {
    const place: SessionPlace = { ...spot('Carnon-Plage'), arrival: spot('Palavas', AWAY[2]) };
    expect(routePlaceTarget(place, LOOP, PLACE_RULES)).toEqual({ start: START, departure: spot('Carnon-Plage'), end: null, arrival: null });
  });

  it('arrivée déplacée de plus de 500 m : cherchée de nouveau', () => {
    const place: SessionPlace = { ...spot('Carnon-Plage'), arrival: spot('Palavas', north(4000)) };
    expect(routePlaceTarget(place, AWAY, PLACE_RULES)).toEqual({ start: START, departure: spot('Carnon-Plage'), end: AWAY[2], arrival: null });
  });

  it('arrivée pas encore regardée sur un aller proche : rangée nulle', () => {
    expect(routePlaceTarget(spot('Carnon-Plage'), NEAR, PLACE_RULES)).toEqual({ start: START, departure: spot('Carnon-Plage'), end: null, arrival: null });
  });
});

describe('routeRecordWithPlace', () => {
  const META = { name: '', activityId: null, createdAt: CREATED, updatedAt: 'u1' };
  const stored = routeToRecord({ waypoints: LOOP, legs: [] }, META);
  const place: SessionPlace = { ...spot('Carnon-Plage'), arrival: null };

  it('range le lieu, updatedAt gardé', () => {
    expect(routeRecordWithPlace(stored, place, 'u1')).toEqual({ ...stored, place });
  });

  it('fiche rangée de nouveau, nommée ou d\'une version plus récente entre-temps : rien', () => {
    expect(routeRecordWithPlace({ ...stored, updatedAt: 'u2' }, place, 'u1')).toBeNull();
    expect(routeRecordWithPlace({ ...stored, name: 'Tour' }, place, 'u1')).toBeNull();
    expect(routeRecordWithPlace({ ...stored, version: ROUTE_VERSION + 1 }, place, 'u1')).toBeNull();
  });
});
