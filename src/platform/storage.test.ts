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
