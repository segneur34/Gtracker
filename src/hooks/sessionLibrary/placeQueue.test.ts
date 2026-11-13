import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatLon } from '../../core/types';
import { PLACE_RULES, type LearnedPlace, type SessionPlace } from '../../library/places';
import { reversePlaces } from '../../planning/geocoding';
import { createPlaceQueue, type PlaceQueueDeps, type PlaceQueueSession } from './placeQueue';

const START: LatLon = { lat: 43.5401, lon: 3.9502 };
const BEACH = { features: [{ properties: { name: 'Plage du Grand Travers', osm_key: 'natural', osm_value: 'beach' }, geometry: { coordinates: [3.951, 43.541] } }] };

/** Réponse du faux service, tenue ouverte jusqu'à ce que le test la rende. */
interface Pending {
  url: string;
  answer: (json: unknown) => void;
  fail: () => void;
}

let requests: Pending[];
let sessions: Map<string, PlaceQueueSession>;
let written: [string, SessionPlace][];
let on: boolean;
let learned: LearnedPlace[];
/** Mètres par degré de latitude, sur le rayon terrestre de `haversineDistance`. */
const M_PER_DEG = (6371e3 * Math.PI) / 180;

const add = (file: string, patch: Partial<PlaceQueueSession> = {}): void => {
  sessions.set(file, { place: undefined, readOnly: false, startMs: sessions.size, ...patch });
};

/** File sur un faux `fetch` : la vraie recherche inverse, son adresse et sa lecture. */
const queueWith = (over: Partial<PlaceQueueDeps> = {}) => createPlaceQueue({
  enabled: () => on,
  session: (file) => sessions.get(file) ?? null,
  learned: () => learned,
  pointsOf: async () => ({ start: START, end: START }),
  search: (point, rules) => reversePlaces(point, { limit: rules.resultLimit, radiusM: rules.waterRadiusM }),
  write: (file, place) => {
    written.push([file, place]);
    const s = sessions.get(file);
    if (s) s.place = place;
  },
  rules: PLACE_RULES,
  intervalMs: 1000,
  maxWaiting: 20,
  ...over,
});

/** Rend chaque requête qui part, seconde après seconde, jusqu'à ce que la file soit vide. */
const answerAll = async (json: unknown = BEACH): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await vi.advanceTimersByTimeAsync(0);
    for (const r of requests.splice(0)) r.answer(json);
    await vi.advanceTimersByTimeAsync(1000);
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  sessions = new Map();
  written = [];
  on = true;
  learned = [];
  vi.stubGlobal('fetch', (url: string) => new Promise<Response>((resolve, reject) => {
    requests.push({
      url,
      answer: (json) => resolve(new Response(JSON.stringify(json), { status: 200 })),
      fail: () => reject(new TypeError('Failed to fetch')),
    });
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('file des lieux', () => {
  it('cherche le lieu et le range dans la fiche, avec la position arrondie', async () => {
    add('a.gpx');
    const q = queueWith();
    q.queue('a.gpx');
    await vi.advanceTimersByTimeAsync(0);
    expect(requests.map((r) => r.url)).toEqual(['https://photon.komoot.io/reverse?lat=43.540&lon=3.950&lang=fr&limit=25&radius=1.5']);
    requests.splice(0)[0].answer(BEACH);
    await q.idle();
    expect(written).toEqual([['a.gpx', { name: 'Plage du Grand Travers', source: 'carte', lat: 43.54, lon: 3.95, arrival: null }]]);
  });

  it('une requête à la fois, au plus une par seconde', async () => {
    for (const f of ['a', 'b', 'c']) add(f);
    const q = queueWith();
    for (const f of ['a', 'b', 'c']) q.queue(f);
    await vi.advanceTimersByTimeAsync(5000);
    expect(requests).toHaveLength(1);
    requests.splice(0)[0].answer(BEACH);
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(1);
    requests.splice(0)[0].answer(BEACH);
    // La précédente vient d'être rendue, la suivante attend la fin de la seconde.
    await vi.advanceTimersByTimeAsync(10);
    expect(requests).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests).toHaveLength(1);
    requests.splice(0)[0].answer(BEACH);
    await q.idle();
    // L'appel le plus récent passe devant.
    expect(written.map(([f]) => f)).toEqual(['c', 'b', 'a']);
  });

  it('au plus vingt en attente, les plus récentes ; sans doublon', () => {
    for (let i = 0; i < 30; i++) add(`s${i}`);
    const q = queueWith();
    for (let i = 0; i < 30; i++) q.queue(`s${i}`);
    q.queue('s29');
    expect(q.waiting()).toHaveLength(20);
    expect(q.waiting()[0]).toBe('s29');
    expect(new Set(q.waiting()).size).toBe(20);
    expect(q.waiting()).not.toContain('s5');
  });

  it('pas de rafale quand cent lignes défilent', async () => {
    for (let i = 0; i < 100; i++) add(`s${i}`);
    const q = queueWith();
    let asked = 0;
    for (let i = 0; i < 100; i++) {
      q.queue(`s${i}`);
      await vi.advanceTimersByTimeAsync(20);
      asked += requests.length;
      for (const r of requests.splice(0)) r.answer(BEACH);
    }
    // Deux secondes de défilement : trois requêtes au plus.
    expect(asked).toBeLessThanOrEqual(3);
    expect(q.waiting().length).toBeLessThanOrEqual(20);
  });

  it('recherche coupée : rien en file, rien d\'envoyé, rien d\'écrit d\'une réponse en route', async () => {
    add('a');
    add('b');
    on = false;
    const q = queueWith();
    q.queue('a');
    await vi.advanceTimersByTimeAsync(3000);
    expect(requests).toHaveLength(0);
    expect(q.waiting()).toEqual([]);
    on = true;
    q.queue('b');
    await vi.advanceTimersByTimeAsync(0);
    on = false;
    requests.splice(0)[0].answer(BEACH);
    await q.idle();
    expect(written).toEqual([]);
  });

  it('hors ligne : la file s\'arrête sans rien écrire, et reprend au prochain appel', async () => {
    add('a');
    add('b');
    const q = queueWith();
    q.queue('a');
    await vi.advanceTimersByTimeAsync(0);
    requests.splice(0)[0].fail();
    await q.idle();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests).toHaveLength(0);
    expect(written).toEqual([]);
    expect(sessions.get('a')!.place).toBeUndefined();
    q.queue('b');
    await answerAll();
    await q.idle();
    expect(written.map(([f]) => f)).toEqual(['b', 'a']);
  });

  it('saute les sessions déjà cherchées, en lecture seule, inconnues ou sans point', async () => {
    add('cherchee', { place: { name: null, source: 'carte', lat: 1, lon: 1, arrival: null } });
    add('lecture', { readOnly: true });
    add('vide');
    const pointsOf = vi.fn(async (file: string) => (file === 'vide' ? null : { start: START, end: START }));
    const q = queueWith({ pointsOf });
    for (const f of ['cherchee', 'lecture', 'inconnue', 'vide']) q.queue(f);
    await q.idle();
    q.queue('vide');
    await q.idle();
    expect(requests).toHaveLength(0);
    // Sans point lisible, la trace n'est pas relue à chaque appel.
    expect(pointsOf).toHaveBeenCalledTimes(1);
  });

  it('rien trouvé : le lieu est rangé sans nom, et n\'est plus cherché', async () => {
    add('a');
    const q = queueWith();
    q.queue('a');
    await answerAll({ features: [] });
    await q.idle();
    expect(written).toEqual([['a', { name: null, source: 'carte', lat: 43.54, lon: 3.95, arrival: null }]]);
    q.queue('a');
    await vi.advanceTimersByTimeAsync(2000);
    expect(requests).toHaveLength(0);
  });

  it('prend le point de départ donné par l\'analyse, sans relire la trace', async () => {
    add('a');
    const pointsOf = vi.fn(async () => ({ start: START, end: START }));
    const q = queueWith({ pointsOf });
    const paris = { lat: 48.8566, lon: 2.3522 };
    q.queue('a', { start: paris, end: paris });
    await vi.advanceTimersByTimeAsync(0);
    expect(requests[0].url).toContain('lat=48.857&lon=2.352');
    expect(pointsOf).not.toHaveBeenCalled();
    await answerAll();
  });

  it('un lieu appris qui couvre le départ : aucune requête, recherche active ou coupée', async () => {
    learned = [{ name: 'Les Roquilles', lat: START.lat + 400 / M_PER_DEG, lon: START.lon, savedAt: 1 }];
    add('a');
    add('b');
    const q = queueWith();
    q.queue('a');
    await q.idle();
    on = false;
    q.queue('b');
    await q.idle();
    await vi.advanceTimersByTimeAsync(3000);
    expect(requests).toHaveLength(0);
    expect(written).toEqual([
      ['a', { name: 'Les Roquilles', source: 'appris', lat: 43.54, lon: 3.95, arrival: null }],
      ['b', { name: 'Les Roquilles', source: 'appris', lat: 43.54, lon: 3.95, arrival: null }],
    ]);
  });

  it('recherche coupée, départ hors des lieux appris : rien d\'envoyé ni d\'écrit, la trace relue une fois', async () => {
    learned = [{ name: 'Ailleurs', lat: 45, lon: 5, savedAt: 1 }];
    on = false;
    add('a');
    const pointsOf = vi.fn(async () => ({ start: START, end: START }));
    const q = queueWith({ pointsOf });
    q.queue('a');
    await q.idle();
    q.queue('a');
    await q.idle();
    expect(requests).toHaveLength(0);
    expect(written).toEqual([]);
    expect(pointsOf).toHaveBeenCalledTimes(1);
    // Un lieu appris de plus : la session est regardée de nouveau, et le prend.
    learned = [...learned, { name: 'Les Roquilles', lat: START.lat, lon: START.lon, savedAt: 2 }];
    q.queue('a');
    await q.idle();
    expect(written.map(([, p]) => p.name)).toEqual(['Les Roquilles']);
  });

  it('arrivée loin du départ : une seule requête de plus, pour l\'arrivée', async () => {
    add('a');
    const end = { lat: START.lat + 5000 / M_PER_DEG, lon: START.lon };
    const q = queueWith({ pointsOf: async () => ({ start: START, end }) });
    q.queue('a');
    await vi.advanceTimersByTimeAsync(0);
    requests.splice(0)[0].answer(BEACH);
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('lat=43.585&lon=3.950');
    requests.splice(0)[0].answer({ features: [{ properties: { name: 'Port de Carnon', osm_key: 'leisure', osm_value: 'marina' }, geometry: { coordinates: [end.lon, end.lat] } }] });
    await q.idle();
    await vi.advanceTimersByTimeAsync(3000);
    expect(requests).toHaveLength(0);
    expect(written).toEqual([['a', {
      name: 'Plage du Grand Travers', source: 'carte', lat: 43.54, lon: 3.95,
      arrival: { name: 'Port de Carnon', source: 'carte', lat: 43.585, lon: 3.95 },
    }]]);
  });

  it('arrivée à moins de la distance « ailleurs » : aucune requête pour elle', async () => {
    add('a');
    const end = { lat: START.lat + 1900 / M_PER_DEG, lon: START.lon };
    const q = queueWith({ pointsOf: async () => ({ start: START, end }) });
    q.queue('a');
    await answerAll();
    await q.idle();
    expect(written).toEqual([['a', { name: 'Plage du Grand Travers', source: 'carte', lat: 43.54, lon: 3.95, arrival: null }]]);
  });

  it('fiche plus ancienne, lieu sans arrivée regardée : seule l\'arrivée est cherchée, le départ gardé', async () => {
    add('a', { place: { name: 'Les Roquilles', source: 'utilisateur', lat: 43.54, lon: 3.95 } });
    const end = { lat: START.lat + 5000 / M_PER_DEG, lon: START.lon };
    const q = queueWith({ pointsOf: async () => ({ start: START, end }) });
    q.queue('a');
    await answerAll();
    await q.idle();
    expect(written).toHaveLength(1);
    expect(written[0][1]).toMatchObject({ name: 'Les Roquilles', source: 'utilisateur', arrival: { source: 'carte' } });
  });

  it('lieu corrigé pendant la recherche : rien n\'est écrasé', async () => {
    add('a');
    const q = queueWith();
    q.queue('a');
    await vi.advanceTimersByTimeAsync(0);
    sessions.set('a', { ...sessions.get('a')!, place: { name: 'Les Roquilles', source: 'utilisateur', lat: 43.54, lon: 3.95, arrival: null } });
    requests.splice(0)[0].answer(BEACH);
    await q.idle();
    expect(written).toEqual([]);
  });
});
