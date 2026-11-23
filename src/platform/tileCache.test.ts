import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserTileStore, purgeRetiredTiles, RETIRED_TILE_PREFIXES, tileCapMb, writeTileCapMb, type TileStore } from './tileCache';

/** Cache API factice : réponses rangées par chemin, lectures comptées. */
class FakeCache {
  readonly entries = new Map<string, Response>();
  matches = 0;

  private path(request: RequestInfo | URL): string {
    const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
    return new URL(url, 'http://local').pathname;
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    this.matches++;
    return this.entries.get(this.path(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    // Le corps est lu, comme le fait le navigateur.
    const body = await response.arrayBuffer();
    this.entries.set(this.path(request), new Response(body, { headers: response.headers }));
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((p) => new Request(`http://local${p}`));
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(this.path(request));
  }
}

const fakeStorage = () => {
  let cache = new FakeCache();
  return {
    get cache() { return cache; },
    open: async () => cache as unknown as Cache,
    delete: async () => { cache = new FakeCache(); return true; },
  };
};

const tile = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/png' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tuiles gardées dans le navigateur', () => {
  it('liste les tuiles écrites, sans celles effacées', async () => {
    const store = createBrowserTileStore(fakeStorage());
    await store.write('14_1_1', tile(10));
    vi.setSystemTime(2_000_000);
    await store.write('sat_14_1_2', tile(30));
    await store.remove(['14_1_1']);
    expect(await store.list()).toEqual([{ key: 'sat_14_1_2', bytes: 30, savedAtMs: 2_000_000 }]);
    expect((await store.read('sat_14_1_2'))?.savedAtMs).toBe(2_000_000);
    expect(await store.read('14_1_1')).toBeNull();
  });

  it('range l’index après une seconde de calme ; la page suivante le relit sans lire chaque tuile', async () => {
    const storage = fakeStorage();
    const first = createBrowserTileStore(storage);
    for (let i = 0; i < 5; i++) await first.write(`14_1_${i}`, tile(10 + i));
    expect(storage.cache.entries.has('/tuiles-gardees/_index.json')).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.cache.entries.has('/tuiles-gardees/_index.json')).toBe(true);

    const next = createBrowserTileStore(storage);
    storage.cache.matches = 0;
    const listed = await next.list();
    expect(listed.map((e) => e.key).sort()).toEqual(['14_1_0', '14_1_1', '14_1_2', '14_1_3', '14_1_4']);
    expect(listed.find((e) => e.key === '14_1_3')?.bytes).toBe(13);
    // L'index seul est lu.
    expect(storage.cache.matches).toBe(1);
  });

  it('refait l’index en lisant chaque tuile s’il manque, ou s’il ne compte pas les tuiles du cache', async () => {
    const storage = fakeStorage();
    const first = createBrowserTileStore(storage);
    await first.write('14_1_1', tile(10));
    await first.write('14_1_2', tile(20));
    await first.flushIndex();
    // Une tuile gardée par une page fermée avant d'avoir rangé l'index.
    await storage.cache.put('/tuiles-gardees/14_1_3.png', new Response(tile(30), { headers: { 'content-length': '30', 'x-gtracker-saved-at': '5' } }));
    const next = createBrowserTileStore(storage);
    // L'index rangé sert aussitôt, puis il est refait en arrière-plan.
    expect(await next.list()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(0);
    expect((await next.list()).map((e) => [e.key, e.bytes]).sort()).toEqual([['14_1_1', 10], ['14_1_2', 20], ['14_1_3', 30]]);

    storage.cache.entries.delete('/tuiles-gardees/_index.json');
    const bare = createBrowserTileStore(storage);
    expect(await bare.list()).toHaveLength(3);
    // Refait, il est rangé de nouveau.
    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.cache.entries.has('/tuiles-gardees/_index.json')).toBe(true);
  });

  it('vide tout, index compris', async () => {
    const storage = fakeStorage();
    const store = createBrowserTileStore(storage);
    await store.write('14_1_1', tile(10));
    await store.clear();
    expect(await store.list()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await createBrowserTileStore(storage).list()).toEqual([]);
  });

  it('ne garde rien sans Cache API', async () => {
    const store = createBrowserTileStore(null);
    await store.write('14_1_1', tile(10));
    expect(await store.read('14_1_1')).toBeNull();
    expect(await store.list()).toEqual([]);
  });
});

describe('effacement des tuiles d’un fond retiré', () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Magasin factice sur une liste de clés ; `fail` fait échouer l'effacement par préfixe. */
  const fakeStore = (keys: string[], fail = false) => {
    const kept = new Set(keys);
    const calls = { list: 0 };
    const store: TileStore = {
      read: async () => null,
      write: async (key) => void kept.add(key),
      list: async () => [...kept].map((key) => ({ key, bytes: 1, savedAtMs: 0 })),
      remove: async (removed) => removed.forEach((key) => kept.delete(key)),
      removeByPrefix: async (prefixes) => {
        calls.list++;
        if (fail) throw new Error('illisible');
        for (const key of [...kept]) if (prefixes.some((p) => key.startsWith(p))) kept.delete(key);
      },
      clear: async () => kept.clear(),
    };
    return { store, kept, calls };
  };

  it('dans le navigateur, efface aussi les tuiles absentes de l’index, et l’index ne les regagne pas', async () => {
    const storage = fakeStorage();
    const first = createBrowserTileStore(storage);
    await first.write('14_1_1', tile(10));
    await first.write('sat_14_1_1', tile(20));
    await first.flushIndex();
    // Une tuile gardée par une page fermée avant d'avoir rangé l'index.
    await storage.cache.put('/tuiles-gardees/sat_14_1_2.png', new Response(tile(30), { headers: { 'content-length': '30', 'x-gtracker-saved-at': '5' } }));
    const next = createBrowserTileStore(storage);
    await purgeRetiredTiles(next);
    expect([...storage.cache.entries.keys()].filter((p) => p !== '/tuiles-gardees/_index.json')).toEqual(['/tuiles-gardees/14_1_1.png']);
    // La comparaison de l'index aux tuiles, en arrière-plan, n'y remet rien.
    await vi.advanceTimersByTimeAsync(1000);
    expect((await next.list()).map((e) => e.key)).toEqual(['14_1_1']);
    expect((await createBrowserTileStore(storage).list()).map((e) => e.key)).toEqual(['14_1_1']);
    // Noté fait : le lancement suivant ne refait rien.
    const again = fakeStore(['sat_14_1_3']);
    await purgeRetiredTiles(again.store);
    expect(again.calls.list).toBe(0);
  });

  it('n’efface que les clés des fonds retirés, et le note une seule fois', async () => {
    expect(RETIRED_TILE_PREFIXES).toEqual(['sat_']);
    const { store, kept, calls } = fakeStore(['14_1_1', 'sat_14_1_1', 'sat_14_1_2', '15_2_2']);
    await purgeRetiredTiles(store);
    expect([...kept].sort()).toEqual(['14_1_1', '15_2_2']);
    // Une tuile qui porterait encore le préfixe n'est plus cherchée : l'effacement n'est fait qu'une fois.
    await store.write('sat_9_9_9', tile(1));
    await purgeRetiredTiles(store);
    expect(calls.list).toBe(1);
    expect(kept.has('sat_9_9_9')).toBe(true);
  });

  it('coupé en route, il est repris au lancement suivant', async () => {
    const broken = fakeStore(['sat_14_1_1'], true);
    await purgeRetiredTiles(broken.store);
    expect(broken.kept.has('sat_14_1_1')).toBe(true);
    const next = fakeStore(['sat_14_1_1']);
    await purgeRetiredTiles(next.store);
    expect(next.kept.size).toBe(0);
    expect(next.calls.list).toBe(1);
  });

  it('le plafond changé garde la trace de l’effacement, et inversement', async () => {
    writeTileCapMb(1000);
    const first = fakeStore(['sat_14_1_1']);
    await purgeRetiredTiles(first.store);
    expect(tileCapMb()).toBe(1000);
    writeTileCapMb(null);
    writeTileCapMb(2000);
    expect(tileCapMb()).toBe(2000);
    const again = fakeStore(['sat_14_1_1']);
    await purgeRetiredTiles(again.store);
    expect(again.calls.list).toBe(0);
  });
});
