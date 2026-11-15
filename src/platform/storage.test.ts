import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonStore, createMirroredBackend, loadNativeEntries, type PreferencesReader, type StorageBackend } from './storage';
import { STORAGE_KEYS } from '../core/appIdentity';

/** Preferences simulées du téléphone, pour `initStorage`. */
const preferences = {
  values: {} as Record<string, string>,
  failures: {} as Record<string, number>,
  keysFail: false,
  written: [] as string[],
};

vi.mock('./runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./runtime')>()),
  isNativeApp: () => true,
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    keys: async () => {
      if (preferences.keysFail) throw new Error('liste illisible');
      return { keys: Object.keys(preferences.values) };
    },
    get: async ({ key }: { key: string }) => {
      if ((preferences.failures[key] ?? 0) > 0) {
        preferences.failures[key] -= 1;
        throw new Error('lecture refusée');
      }
      return { value: preferences.values[key] ?? null };
    },
    set: async ({ key }: { key: string }) => {
      preferences.written.push(key);
    },
    remove: async ({ key }: { key: string }) => {
      delete preferences.values[key];
    },
  },
}));

beforeEach(() => {
  preferences.values = {};
  preferences.failures = {};
  preferences.keysFail = false;
  preferences.written = [];
});

/** Module du stockage neuf, sans le chargement d'un test précédent. */
const freshStorage = async () => {
  vi.resetModules();
  return import('./storage');
};

/** Stockage en mémoire, qui se comporte comme `localStorage`. */
const memoryBackend = (initial: Record<string, string> = {}): StorageBackend & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
};

/** Stockage qui refuse tout, comme un navigateur aux données de site bloquées ou au quota plein. */
const failingBackend: StorageBackend = {
  getItem: () => {
    throw new Error('stockage bloqué');
  },
  setItem: () => {
    throw new Error('quota dépassé');
  },
};

describe('createJsonStore', () => {
  it('rend null pour une clé jamais écrite', () => {
    const store = createJsonStore(() => memoryBackend());
    expect(store.read(STORAGE_KEYS.sportSettings)).toBeNull();
  });

  it('relit ce qu\'il a écrit', () => {
    const backend = memoryBackend();
    const store = createJsonStore(() => backend);
    const settings = { sport: 'windsurf', thresholds: { windsurf: 6.5 } };

    store.write(STORAGE_KEYS.sportSettings, settings);

    expect(store.read(STORAGE_KEYS.sportSettings)).toEqual(settings);
  });

  it('écrit le même JSON que l\'ancien accès direct, pour relire les données déjà enregistrées', () => {
    // Les réglages, notes et tailles de panneaux de l'utilisateur ont été
    // écrits par `localStorage.setItem(clé, JSON.stringify(valeur))` : le
    // format ne doit pas changer d'un octet.
    const value = { 'sailing.carte': { width: 640, height: 600 } };
    const backend = memoryBackend();
    createJsonStore(() => backend).write(STORAGE_KEYS.panelSizes, value);

    expect(backend.data.get(STORAGE_KEYS.panelSizes)).toBe(JSON.stringify(value));

    const legacy = memoryBackend({ [STORAGE_KEYS.panelSizes]: JSON.stringify(value) });
    expect(createJsonStore(() => legacy).read(STORAGE_KEYS.panelSizes)).toEqual(value);
  });

  it('rend null sur un JSON illisible au lieu de lever une erreur', () => {
    const store = createJsonStore(() => memoryBackend({ [STORAGE_KEYS.sections]: '{"sailing": ' }));
    expect(store.read(STORAGE_KEYS.sections)).toBeNull();
  });

  it('ne lève aucune erreur quand le stockage refuse de lire ou d\'écrire', () => {
    const store = createJsonStore(() => failingBackend);
    expect(store.read('gtracker.uneCle')).toBeNull();
    expect(() => store.write('gtracker.uneCle', { a: 1 })).not.toThrow();
  });

  it('absorbe aussi l\'erreur levée dès l\'accès au stockage', () => {
    const store = createJsonStore(() => {
      throw new Error('localStorage inaccessible');
    });
    expect(store.read(STORAGE_KEYS.athleteProfile)).toBeNull();
    expect(() => store.write(STORAGE_KEYS.athleteProfile, { me: {} })).not.toThrow();
  });

  it('garde pour la session une valeur que le stockage refuse, au lieu de relire l\'ancienne', () => {
    // Quota plein : l'ancienne valeur reste lisible, la nouvelle ne s'écrit pas.
    const backend = memoryBackend({ [STORAGE_KEYS.sportSettings]: '{"sport":"wingfoil"}' });
    const full: StorageBackend = { getItem: backend.getItem, setItem: () => { throw new Error('quota dépassé'); } };
    let refuse = true;
    const store = createJsonStore(() => (refuse ? full : backend));

    store.write(STORAGE_KEYS.sportSettings, { sport: 'kite' });
    expect(store.read(STORAGE_KEYS.sportSettings)).toEqual({ sport: 'kite' });
    expect(backend.data.get(STORAGE_KEYS.sportSettings)).toBe('{"sport":"wingfoil"}');

    // Le stockage accepte de nouveau : la valeur écrite fait foi.
    refuse = false;
    store.write(STORAGE_KEYS.sportSettings, { sport: 'windsurf' });
    expect(backend.data.get(STORAGE_KEYS.sportSettings)).toBe('{"sport":"windsurf"}');
    refuse = true;
    expect(store.read(STORAGE_KEYS.sportSettings)).toEqual({ sport: 'windsurf' });
  });

  it("ne prévient l'abonné d'une clé que des écritures de cette clé, refusées comprises", () => {
    let refuse = false;
    const backend = memoryBackend();
    const store = createJsonStore(() => (refuse ? { getItem: backend.getItem, setItem: () => { throw new Error('quota'); } } : backend));
    let calls = 0;
    const unsubscribe = store.subscribeKey(STORAGE_KEYS.sportSettings, () => calls++);
    store.write(STORAGE_KEYS.panelSizes, {});
    expect(calls).toBe(0);
    store.write(STORAGE_KEYS.sportSettings, {});
    refuse = true;
    store.write(STORAGE_KEYS.sportSettings, { a: 1 });
    expect(calls).toBe(2);
    unsubscribe();
    store.write(STORAGE_KEYS.sportSettings, {});
    expect(calls).toBe(2);
  });

  it('signale chaque refus, et seulement les refus, y compris ceux constatés plus tard', () => {
    let refuse = false;
    const backend = memoryBackend();
    const store = createJsonStore(() => (refuse ? failingBackend : backend));
    const failures: string[] = [];
    const unsubscribe = store.subscribeFailure((key) => failures.push(key));
    store.write(STORAGE_KEYS.panelSizes, {});
    refuse = true;
    store.write(STORAGE_KEYS.libraryCache, {});
    store.reportFailure(STORAGE_KEYS.followedTrace);
    unsubscribe();
    store.write(STORAGE_KEYS.sections, {});
    expect(failures).toEqual([STORAGE_KEYS.libraryCache, STORAGE_KEYS.followedTrace]);
  });

  it("signale chaque écriture aux abonnés, même refusée, jusqu'au désabonnement", () => {
    const store = createJsonStore(() => failingBackend);
    const keys: string[] = [];
    const unsubscribe = store.subscribe((key) => keys.push(key));
    store.write(STORAGE_KEYS.sportSettings, { sport: 'kite' });
    unsubscribe();
    store.write(STORAGE_KEYS.athleteProfile, {});
    expect(keys).toEqual([STORAGE_KEYS.sportSettings]);
  });
});

describe('createJsonStore, écriture à texte identique', () => {
  /** Stockage en mémoire qui relève chaque `setItem`. */
  const countingBackend = (initial: Record<string, string> = {}) => {
    const backend = memoryBackend(initial);
    const writes: string[] = [];
    return { backend, writes, store: createJsonStore(() => ({ ...backend, setItem: (key, value) => { writes.push(key); backend.setItem(key, value); } })) };
  };

  it("n'écrit pas un texte déjà rangé, mais prévient les abonnés", () => {
    const { writes, store } = countingBackend({ 'gtracker.cache': '{"a":1}' });
    const heard: string[] = [];
    store.subscribe((key) => heard.push(key));
    store.write('gtracker.cache', { a: 1 });
    expect(writes).toEqual([]);
    expect(heard).toEqual(['gtracker.cache']);
  });

  it('écrit dès que le texte change, et une clé absente', () => {
    const { backend, writes, store } = countingBackend({ 'gtracker.cache': '{"a":1}' });
    store.write('gtracker.cache', { a: 2 });
    store.write('gtracker.autre', { a: 1 });
    store.write('gtracker.cache', { a: 2 });
    expect(writes).toEqual(['gtracker.cache', 'gtracker.autre']);
    expect(backend.data.get('gtracker.cache')).toBe('{"a":2}');
  });

  it('relit la valeur rangée à chaque écriture : changée par un autre écrivain, elle est réécrite', () => {
    const { backend, writes, store } = countingBackend({ 'gtracker.cache': '{"a":1}' });
    backend.data.set('gtracker.cache', '{"a":9}');
    store.write('gtracker.cache', { a: 1 });
    expect(writes).toEqual(['gtracker.cache']);
    expect(backend.data.get('gtracker.cache')).toBe('{"a":1}');
  });

  it('retente une valeur refusée, même identique, et une valeur dont le refus est signalé plus tard', () => {
    const { backend, writes, store } = countingBackend();
    let refuse = true;
    const guarded = createJsonStore(() => (refuse ? failingBackend : backend));
    guarded.write('gtracker.cache', { a: 1 });
    refuse = false;
    guarded.write('gtracker.cache', { a: 1 });
    expect(backend.data.get('gtracker.cache')).toBe('{"a":1}');
    // Refus constaté après coup (Preferences natives) : la mémoire a la valeur, le stockage durable peut-être pas.
    store.write('gtracker.x', { b: 1 });
    store.reportFailure('gtracker.x');
    store.write('gtracker.x', { b: 1 });
    store.write('gtracker.x', { b: 1 });
    expect(writes).toEqual(['gtracker.x', 'gtracker.x']);
  });

  it('écritures suspendues : rien, même à texte changé, comme avant', () => {
    const { writes, store } = countingBackend({ 'gtracker.cache': '{"a":1}' });
    store.suspendWrites();
    store.write('gtracker.cache', { a: 2 });
    expect(writes).toEqual([]);
  });
});

describe('createJsonStore, lecture mise en cache (E-O3)', () => {
  it('rend le même objet tant que la valeur brute ne change pas, un neuf après une écriture', () => {
    const backend = memoryBackend({ 'gtracker.x': '{"a":{"b":1}}' });
    const store = createJsonStore(() => backend);
    const first = store.read<{ a: { b: number } }>('gtracker.x');
    expect(store.read('gtracker.x')).toBe(first);
    store.write('gtracker.x', { a: { b: 2 } });
    const second = store.read<{ a: { b: number } }>('gtracker.x');
    expect(second).not.toBe(first);
    expect(second?.a.b).toBe(2);
    // Valeur changée par un autre écrivain (autre onglet) : relue.
    backend.data.set('gtracker.x', '{"a":{"b":3}}');
    expect(store.read<{ a: { b: number } }>('gtracker.x')?.a.b).toBe(3);
  });

  it("gèle en profondeur l'objet rendu en développement : un appelant ne peut pas le modifier en douce", () => {
    const store = createJsonStore(() => memoryBackend({ 'gtracker.x': '{"a":{"b":1}}' }));
    const value = store.read<{ a: { b: number } }>('gtracker.x')!;
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
  });
});

describe('createMirroredBackend', () => {
  it('lit depuis la mémoire amorcée et recopie chaque écriture', () => {
    const persisted: [string, string][] = [];
    const backend = createMirroredBackend({ [STORAGE_KEYS.sections]: '{"sailing":{"global":true}}' }, (key, value) => {
      persisted.push([key, value]);
    });
    const store = createJsonStore(() => backend);

    expect(store.read(STORAGE_KEYS.sections)).toEqual({ sailing: { global: true } });
    store.write(STORAGE_KEYS.panelSizes, { 'sailing.carte': { width: 600 } });

    expect(store.read(STORAGE_KEYS.panelSizes)).toEqual({ 'sailing.carte': { width: 600 } });
    expect(persisted).toEqual([[STORAGE_KEYS.panelSizes, '{"sailing.carte":{"width":600}}']]);
  });
});

describe('chargement du stockage du téléphone (A3)', () => {
  const reader = (values: Record<string, string>, failures: Record<string, number>): PreferencesReader => ({
    keys: async () => ({ keys: Object.keys(values) }),
    get: async ({ key }) => {
      if ((failures[key] ?? 0) > 0) {
        failures[key] -= 1;
        throw new Error('lecture refusée');
      }
      return { value: values[key] };
    },
  });

  it('lit les autres clés quand une lecture échoue, et la relève', async () => {
    const load = await loadNativeEntries(reader({ a: '1', b: '2', c: '3' }, { b: 2 }));
    expect(load.initial).toEqual({ a: '1', c: '3' });
    expect(load.failedKeys).toEqual(['b']);
  });

  it('refait une fois une lecture en échec', async () => {
    const load = await loadNativeEntries(reader({ a: '1', b: '2' }, { b: 1 }));
    expect(load.initial).toEqual({ a: '1', b: '2' });
    expect(load.failedKeys).toEqual([]);
  });

  it('lève si la liste des clés est illisible', async () => {
    await expect(loadNativeEntries({ keys: async () => { throw new Error('non'); }, get: async () => ({ value: null }) })).rejects.toThrow();
  });

  it("au démarrage, garde une clé illisible en mémoire seulement et relève l'échec", async () => {
    preferences.values = { 'gtracker.a': '"un"', 'gtracker.b': '"deux"' };
    preferences.failures = { 'gtracker.b': 2 };
    const storage = await freshStorage();
    await storage.initStorage();
    expect(storage.storageStartupFailure()).toEqual({ all: false, keys: ['gtracker.b'] });
    expect(storage.jsonStore.read('gtracker.a')).toBe('un');
    expect(storage.jsonStore.read('gtracker.b')).toBeNull();
    storage.jsonStore.write('gtracker.b', 'défaut');
    storage.jsonStore.write('gtracker.a', 'autre');
    expect(storage.jsonStore.read('gtracker.b')).toBe('défaut');
    // La vraie valeur, peut-être encore sur le téléphone, n'est jamais écrasée.
    expect(preferences.written).toEqual(['gtracker.a']);
  });

  it('reste en mémoire, sans localStorage, si rien ne peut être lu', async () => {
    preferences.values = { 'gtracker.a': '"un"' };
    preferences.keysFail = true;
    const storage = await freshStorage();
    await storage.initStorage();
    expect(storage.storageStartupFailure()).toEqual({ all: true, keys: [] });
    storage.jsonStore.write('gtracker.a', 'autre');
    expect(storage.jsonStore.read('gtracker.a')).toBe('autre');
    expect(preferences.written).toEqual([]);
  });

  it('sans échec, ne relève rien', async () => {
    preferences.values = { 'gtracker.a': '"un"' };
    const storage = await freshStorage();
    await storage.initStorage();
    expect(storage.storageStartupFailure()).toBeNull();
    expect(storage.jsonStore.read('gtracker.a')).toBe('un');
  });
});

describe('remise à zéro du stockage', () => {
  /** Stockage en mémoire qui sait retirer et énumérer, comme `localStorage`. */
  const fullBackend = (initial: Record<string, string> = {}): StorageBackend & { data: Map<string, string> } => {
    const data = new Map(Object.entries(initial));
    return {
      data,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i] ?? null,
    };
  };

  it('retire une clé sans prévenir les abonnés, et la relit absente', () => {
    const backend = fullBackend({ 'gtracker.a': '"un"', 'gtracker.b': '"deux"' });
    const store = createJsonStore(() => backend);
    expect(store.read('gtracker.a')).toBe('un');
    const heard: string[] = [];
    store.subscribe((key) => heard.push(key));
    store.remove('gtracker.a');
    expect(store.read('gtracker.a')).toBeNull();
    expect(backend.data.has('gtracker.a')).toBe(false);
    expect(heard).toEqual([]);
    expect(store.keys()).toEqual(['gtracker.b']);
  });

  it('écritures suspendues : rien n\'est écrit ni annoncé, jusqu\'à la reprise ; un retrait reste permis', () => {
    const backend = fullBackend({ 'gtracker.a': '"un"' });
    const store = createJsonStore(() => backend);
    const heard: string[] = [];
    store.subscribe((key) => heard.push(key));
    store.suspendWrites();
    expect(store.writesSuspended()).toBe(true);
    store.write('gtracker.b', 'deux');
    store.remove('gtracker.a');
    expect([...backend.data.keys()]).toEqual([]);
    expect(heard).toEqual([]);
    store.resumeWrites();
    store.write('gtracker.b', 'deux');
    expect(backend.data.get('gtracker.b')).toBe('"deux"');
  });

  it('un stockage sans retrait ni liste ne lève pas', () => {
    const store = createJsonStore(() => memoryBackend({ 'gtracker.a': '"un"' }));
    store.remove('gtracker.a');
    expect(store.keys()).toEqual([]);
  });

  it('la version miroir retire de la mémoire, et l\'attente retire des Preferences', async () => {
    const persisted: Record<string, string> = { 'gtracker.a': '"un"', 'gtracker.b': '"deux"' };
    const removed: string[] = [];
    const backend = createMirroredBackend({ ...persisted }, () => undefined);
    const store = createJsonStore(() => backend);
    const { removeStoredKeys, storedKeys } = await freshStorage();
    let refusals = 1;
    const prefs = {
      keys: async () => ({ keys: Object.keys(persisted) }),
      remove: async ({ key }: { key: string }) => {
        if (key === 'gtracker.b' && refusals-- > 0) throw new Error('refusé une fois');
        removed.push(key);
        delete persisted[key];
      },
    };
    expect((await storedKeys(store, prefs)).sort()).toEqual(['gtracker.a', 'gtracker.b']);
    await removeStoredKeys(['gtracker.a', 'gtracker.b'], store, prefs);
    expect(store.read('gtracker.a')).toBeNull();
    expect(store.keys()).toEqual([]);
    expect(removed.sort()).toEqual(['gtracker.a', 'gtracker.b']);
    expect(persisted).toEqual({});
  });

  it('au téléphone, les retraits vont aux Preferences chargées au démarrage', async () => {
    preferences.values = { 'gtracker.a': '"un"', 'gtracker.memoryFolder': '"d"' };
    const storage = await freshStorage();
    await storage.initStorage();
    expect((await storage.storedKeys()).sort()).toEqual(['gtracker.a', 'gtracker.memoryFolder']);
    await storage.removeStoredKeys(['gtracker.a']);
    expect(preferences.values).toEqual({ 'gtracker.memoryFolder': '"d"' });
    expect(storage.jsonStore.read('gtracker.a')).toBeNull();
    storage.suspendWrites();
    storage.jsonStore.write('gtracker.c', 'trois');
    expect(preferences.written).toEqual([]);
    expect(storage.writesSuspended()).toBe(true);
  });
});
