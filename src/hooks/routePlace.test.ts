import { describe, expect, it } from 'vitest';
import type { LatLon } from '../core/types';
import { PLACE_RULES, type LearnedPlace, type SessionPlace } from '../library/places';
import { routeDisplayName, routeRecordWithPlace } from '../library/routeName';
import { parsePhotonFeatures } from '../planning/geocoding';
import type { Waypoint } from '../planning/route';
import { routeToRecord, type RouteRecord } from '../planning/routeRecord';
import type { SavedRoute } from './routeFiles';
import { createRoutePlaceFinder, type RoutePlaceDeps } from './routePlace';

/** Mètres par degré de latitude, sur le rayon terrestre de `haversineDistance`. */
const M_PER_DEG = (6371e3 * Math.PI) / 180;
const START: Waypoint = { lat: 43.54, lon: 3.95 };
const north = (m: number): Waypoint => ({ lat: START.lat + m / M_PER_DEG, lon: START.lon });
const LOOP: Waypoint[] = [START, north(800), { lat: START.lat, lon: START.lon + 0.01 }, START];
const AWAY: Waypoint[] = [START, north(2500), north(5000)];
const CREATED = new Date(2026, 10, 20, 9).toISOString();

/** Faux service : un village nommé d'après la distance au départ (Carnon près de lui, Palavas loin). */
const village = (point: LatLon) => parsePhotonFeatures({
  features: [{
    properties: { name: point.lat - START.lat < 0.01 ? 'Carnon-Plage' : 'Palavas-les-Flots', osm_key: 'place', osm_value: 'village' },
    geometry: { coordinates: [point.lon, point.lat] },
  }],
});

/** Mémoire simulée d'un seul itinéraire, et l'appareil autour. */
const setup = (waypoints: Waypoint[], over: Partial<RoutePlaceDeps> = {}) => {
  let stored: RouteRecord = routeToRecord({ waypoints, legs: [] }, { name: '', activityId: null, createdAt: CREATED, updatedAt: 'u1' });
  const searched: LatLon[] = [];
  const state = { online: true, enabled: true, learned: [] as LearnedPlace[] };
  const find = createRoutePlaceFinder({
    enabled: () => state.enabled,
    learned: () => state.learned,
    search: async (point) => {
      searched.push(point);
      if (!state.online) throw new Error('hors ligne');
      return village(point);
    },
    save: async (base, place, expected) => {
      const next = routeRecordWithPlace(stored, place, expected);
      if (!next) return null;
      stored = next;
      return { base, record: next, readOnly: false };
    },
    rules: PLACE_RULES,
    intervalMs: 0,
    ...over,
  });
  const saved = (): SavedRoute => ({ base: 'r', record: stored, readOnly: false });
  return {
    find, saved, searched, state,
    get stored() { return stored; },
    rename: (name: string) => { stored = { ...stored, name }; },
    resave: () => { stored = { ...stored, updatedAt: 'u2' }; },
  };
};

describe('lieu d\'un itinéraire', () => {
  it('boucle : le départ cherché en ligne, une requête, puis le nom composé', async () => {
    const s = setup(LOOP);
    const result = await s.find(s.saved());
    expect(s.searched).toHaveLength(1);
    expect(result?.record.place).toMatchObject({ name: 'Carnon-Plage', source: 'carte', arrival: null });
    expect(routeDisplayName(s.stored)).toBe('Boucle à Carnon-Plage le 20/11');
    expect(s.stored.updatedAt).toBe('u1');
    // Lieu à jour : plus de requête.
    expect(await s.find(s.saved())).toBeNull();
    expect(s.searched).toHaveLength(1);
  });

  it('aller lointain : départ et arrivée, deux requêtes', async () => {
    const s = setup(AWAY);
    await s.find(s.saved());
    expect(s.searched).toHaveLength(2);
    expect(routeDisplayName(s.stored)).toBe('Aller de Carnon-Plage à Palavas-les-Flots le 20/11');
  });

  it('hors ligne : rien de rangé, cherché de nouveau la fois suivante', async () => {
    const s = setup(LOOP);
    s.state.online = false;
    expect(await s.find(s.saved())).toBeNull();
    expect(s.stored.place).toBeUndefined();
    expect(routeDisplayName(s.stored)).toBe('Boucle du 20/11');
    s.state.online = true;
    await s.find(s.saved());
    expect(routeDisplayName(s.stored)).toBe('Boucle à Carnon-Plage le 20/11');
  });

  it('arrivée sans réponse : le départ rangé, l\'arrivée laissée à regarder', async () => {
    const s = setup(AWAY, {});
    let calls = 0;
    const find = createRoutePlaceFinder({
      enabled: () => true, learned: () => [], rules: PLACE_RULES, intervalMs: 0,
      search: async (point) => {
        if (++calls > 1) throw new Error('hors ligne');
        return village(point);
      },
      save: async (base, place, expected) => {
        const next = routeRecordWithPlace(s.stored, place, expected);
        return next ? { base, record: next, readOnly: false } : null;
      },
    });
    const result = await find(s.saved());
    expect(result?.record.place).toEqual({ name: 'Carnon-Plage', source: 'carte', lat: 43.54, lon: 3.95 });
  });

  it('lieu appris par les sessions : pris sans réseau, recherche coupée comprise', async () => {
    const s = setup(LOOP);
    s.state.online = false;
    s.state.enabled = false;
    s.state.learned = [{ name: 'Le Grand Travers', lat: START.lat, lon: START.lon, savedAt: 1 }];
    await s.find(s.saved());
    expect(s.searched).toHaveLength(0);
    expect(routeDisplayName(s.stored)).toBe('Boucle à Le Grand Travers le 20/11');
  });

  it('recherche coupée sans lieu appris : aucune requête, rien de rangé', async () => {
    const s = setup(AWAY);
    s.state.enabled = false;
    expect(await s.find(s.saved())).toBeNull();
    expect(s.searched).toHaveLength(0);
    expect(s.stored.place).toBeUndefined();
  });

  it('fiche rangée de nouveau ou nommée entre-temps : le lieu n\'est pas écrit', async () => {
    const s = setup(LOOP);
    const before = s.saved();
    s.resave();
    expect(await s.find(before)).toBeNull();
    expect(s.stored.place).toBeUndefined();
    const named = setup(LOOP);
    const old = named.saved();
    named.rename('Tour');
    expect(await named.find(old)).toBeNull();
    expect(named.stored.place).toBeUndefined();
  });

  it('nom saisi : rien de cherché', async () => {
    const s = setup(LOOP);
    s.rename('Tour');
    expect(await s.find(s.saved())).toBeNull();
    expect(s.searched).toHaveLength(0);
  });

  it('rangé de nouveau après un déplacement, recherche impossible : le lieu périmé n\'est plus cité', async () => {
    // Départ déplacé de plus de 500 m, recherche coupée : la fiche garde l'ancien lieu, le nom ne le cite plus.
    const loop = setup(LOOP);
    await loop.find(loop.saved());
    loop.state.enabled = false;
    const moved = north(700);
    const movedLoop: RouteRecord = { ...loop.stored, waypoints: [moved, north(1500), { lat: moved.lat, lon: moved.lon + 0.01 }, moved] };
    expect(await loop.find({ base: 'r', record: movedLoop, readOnly: false })).toBeNull();
    expect(routeDisplayName(movedLoop)).toBe('Boucle du 20/11');

    // Arrivée seule déplacée, hors ligne : le départ reste cité, l'arrivée périmée non.
    const away = setup(AWAY);
    await away.find(away.saved());
    away.state.online = false;
    const movedEnd: RouteRecord = { ...away.stored, waypoints: [START, north(2500), north(4000)] };
    await away.find({ base: 'r', record: movedEnd, readOnly: false });
    expect(routeDisplayName(movedEnd)).toBe('Aller de Carnon-Plage le 20/11');

    // Boucle changée en aller, hors ligne : plus « Boucle à », le départ cité seul.
    const opened = setup(LOOP);
    await opened.find(opened.saved());
    opened.state.online = false;
    const unlooped: RouteRecord = { ...opened.stored, waypoints: AWAY };
    await opened.find({ base: 'r', record: unlooped, readOnly: false });
    expect(routeDisplayName(unlooped)).toBe('Aller de Carnon-Plage le 20/11');
  });

  it('départ déplacé de plus de 500 m : cherché de nouveau', async () => {
    const s = setup(LOOP);
    await s.find(s.saved());
    const moved = north(700);
    const record: RouteRecord = { ...s.stored, waypoints: [moved, north(1500), { lat: moved.lat, lon: moved.lon + 0.01 }, moved] };
    const result = await s.find({ base: 'r', record, readOnly: false });
    expect(s.searched).toHaveLength(2);
    expect((result!.record.place as SessionPlace).lat).toBeCloseTo(moved.lat, 3);
  });
});
