import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../core/appIdentity';
import { SETTINGS_FORMAT, SETTINGS_VERSION, buildSettingsFile, serializeSettingsFile } from '../../library/settingsFile';
import type { MemoryFolder } from '../../platform/memoryFolder';
import { settle, trackTestTimers } from '../../test/library.fixture';
import { createFakeFolder } from '../../test/memoryFolder.fixture';

/**
 * Fichier de réglages de l'appareil écrit par une version plus récente, sur un faux dossier : ni l'ouverture, ni un
 * réglage changé, ni « Reprendre », ni « Renommer », ni l'import ne le réécrivent ; « Réglages d'usine » le retire,
 * l'effacement étant voulu. Un fichier de la version courante est écrit comme avant, sans perdre les activités d'un
 * calcul que cette version ne connaît pas.
 */

const files = new Map<string, string>();
const log: string[] = [];
const stored = new Map<string, string>();
const reloads: string[] = [];

const folder: MemoryFolder = createFakeFolder(files, log);

const mockPlatform = (): void => {
  vi.doMock('../../platform/memoryFolder', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../platform/memoryFolder')>()),
    openMemoryFolder: async () => ({ state: 'ready', folder }),
    pendingFolder: () => null,
    browserMemoryCopy: async () => null,
    isFolderDesignated: async () => true,
  }));
  vi.doMock('../../platform/appReset', () => ({ clearDeviceFiles: async () => undefined }));
};

type Library = typeof import('../useSessionLibrary');

const openFresh = async (): Promise<Library> => {
  vi.resetModules();
  mockPlatform();
  const library = await import('../useSessionLibrary');
  await library.openLibrary();
  await settle(library);
  return library;
};

const SAVED_AT = 1_000;
const wing = { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#004aad' };
const kite = { id: 'kite', name: 'Kite', base: 'kite', color: '#d32f2f' };
/** Activité posée sur un calcul que cette version ne connaît pas. */
const futur = { id: 'futur', name: 'Futur', base: 'calcul-a-venir', color: '#123456' };

/** Texte d'un fichier de réglages de l'appareil `id`, à la version `version`. */
const settingsText = (id: string, name: string, version: number, sport: Record<string, unknown>): string =>
  serializeSettingsFile({
    ...buildSettingsFile({ [STORAGE_KEYS.sportSettings]: sport, 'gtracker.futur': { x: 1 } }, SAVED_AT, null, { id, name }),
    version,
  });

/** Appareil « moi », nommé PC, dont les réglages datent de `SAVED_AT`, et son fichier `reglages/pc.json` à la version `version`. */
const device = (version: number, fileSport: Record<string, unknown>, localSport: Record<string, unknown> = fileSport): string => {
  stored.set(STORAGE_KEYS.sportSettings, JSON.stringify(localSport));
  stored.set(STORAGE_KEYS.settingsSavedAt, JSON.stringify(SAVED_AT));
  stored.set(STORAGE_KEYS.deviceId, JSON.stringify('moi'));
  stored.set(STORAGE_KEYS.deviceName, JSON.stringify('PC'));
  files.set('gtracker.json', '{"format":"gtracker-memoire","version":1}');
  const text = settingsText('moi', 'PC', version, fileSport);
  files.set('reglages/pc.json', text);
  return text;
};

/** Change un réglage qui voyage, puis vide l'écriture différée. */
const changeSetting = async (library: Library, sport: Record<string, unknown>): Promise<void> => {
  library.startLibraryUi(() => true);
  const { jsonStore } = await import('../../platform/storage');
  jsonStore.write(STORAGE_KEYS.sportSettings, sport);
  const { flushWrites } = await import('./deviceSettings');
  await flushWrites();
};

let stopTestTimers: () => void = () => undefined;
beforeEach(() => {
  stopTestTimers = trackTestTimers();
  files.clear();
  log.length = 0;
  stored.clear();
  reloads.length = 0;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
    removeItem: (k: string) => void stored.delete(k),
    get length() {
      return stored.size;
    },
    key: (i: number) => [...stored.keys()][i] ?? null,
  });
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined, visibilityState: 'visible' });
  vi.stubGlobal('window', {
    addEventListener: () => undefined,
    location: { replace: (path: string) => void reloads.push(path), reload: () => void reloads.push('reload') },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  stopTestTimers();
});

const NEWER = SETTINGS_VERSION + 1;

describe("fichier de l'appareil d'une version plus récente", () => {
  it("n'est réécrit ni à l'ouverture ni après un réglage changé, qui reste sur l'appareil", async () => {
    const text = device(NEWER, { activities: [wing, futur] }, { activities: [wing] });
    const library = await openFresh();
    expect(files.get('reglages/pc.json')).toBe(text);
    await changeSetting(library, { activities: [wing], thresholds: { wingfoil: 12 } });
    expect(files.get('reglages/pc.json')).toBe(text);
    expect(log.filter((l) => l.includes('reglages/'))).toEqual([]);
    expect(JSON.parse(stored.get(STORAGE_KEYS.sportSettings)!)).toEqual({ activities: [wing], thresholds: { wingfoil: 12 } });
    expect(library.readLibraryState().error ?? '').toBe('');
  });

  it('ni renommé, ni réécrit par « Reprendre le matériel » ou « Reprendre ceux de … »', async () => {
    const text = device(NEWER, { activities: [wing, futur] });
    files.set('reglages/lea.json', settingsText('lea', 'Léa', SETTINGS_VERSION, { activities: [wing, kite] }));
    const library = await openFresh();
    expect(await library.renameDevice('Atelier')).toBeNull();
    await library.adoptSettingsGear('lea.json');
    library.startLibraryUi(() => true);
    await library.adoptSettingsFile('lea.json');
    expect(files.get('reglages/pc.json')).toBe(text);
    expect(files.has('reglages/atelier.json')).toBe(false);
    expect(log.filter((l) => l.includes('reglages/'))).toEqual([]);
  });

  it("l'import ne remplace pas le fichier plus récent d'un autre appareil", async () => {
    device(SETTINGS_VERSION, { activities: [wing] });
    const newer = settingsText('lea', 'Léa', NEWER, { activities: [wing, futur] });
    files.set('reglages/lea.json', newer);
    const library = await openFresh();
    const picked = new File([settingsText('lea', 'Léa', SETTINGS_VERSION, { activities: [wing] })], 'lea.json');
    const result = await library.importSettingsFile(picked);
    expect(result).toEqual({ refusal: 'Import impossible : une version plus récente y est déjà' });
    expect(files.get('reglages/lea.json')).toBe(newer);
  });

  it('« Réglages d’usine » le retire, comme le fichier de la version courante : l’effacement est voulu', async () => {
    device(NEWER, { activities: [wing, futur] });
    files.set('reglages/lea.json', settingsText('lea', 'Léa', NEWER, { activities: [wing] }));
    const library = await openFresh();
    expect(await library.factoryReset()).toBeNull();
    expect(reloads).toEqual(['/profil']);
    expect(files.has('reglages/pc.json')).toBe(false);
    expect(files.has('reglages/lea.json')).toBe(true);
  });
});

describe("fichier de l'appareil de la version courante", () => {
  it('écrit comme avant après un réglage changé, à la version de cette application', async () => {
    device(SETTINGS_VERSION, { activities: [wing, kite] });
    const library = await openFresh();
    await changeSetting(library, { activities: [wing, kite], thresholds: { kite: 9 } });
    const written = JSON.parse(files.get('reglages/pc.json')!);
    expect(written).toMatchObject({ format: SETTINGS_FORMAT, version: SETTINGS_VERSION, device: { id: 'moi', name: 'PC' } });
    expect(written.values[STORAGE_KEYS.sportSettings]).toEqual({ activities: [wing, kite], thresholds: { kite: 9 } });
    expect(written.values['gtracker.futur']).toEqual({ x: 1 });
  });

  it("garde à sa place l'activité d'un calcul inconnu que la liste de l'appareil a perdue, sans réécrire à l'ouverture", async () => {
    const text = device(SETTINGS_VERSION, { activities: [wing, futur, kite] }, { activities: [wing, futur, kite] });
    const library = await openFresh();
    expect(files.get('reglages/pc.json')).toBe(text);
    await changeSetting(library, { activities: [wing, kite], thresholds: { kite: 9 } });
    const sport = JSON.parse(files.get('reglages/pc.json')!).values[STORAGE_KEYS.sportSettings];
    expect(sport).toEqual({ activities: [wing, futur, kite], thresholds: { kite: 9 } });
    log.length = 0;
    await openFresh();
    expect(log.filter((l) => l.includes('reglages/'))).toEqual([]);
  });

  it("une activité d'un calcul connu retirée sur l'appareil quitte le fichier", async () => {
    device(SETTINGS_VERSION, { activities: [wing, kite] });
    const library = await openFresh();
    await changeSetting(library, { activities: [wing] });
    expect(JSON.parse(files.get('reglages/pc.json')!).values[STORAGE_KEYS.sportSettings]).toEqual({ activities: [wing] });
  });
});
