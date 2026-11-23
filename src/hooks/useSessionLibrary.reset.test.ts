import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../core/appIdentity';
import { markerText } from '../library/folderLayout';
import { buildSettingsFile, serializeSettingsFile } from '../library/settingsFile';
import { markerTextWithId, readMarkerId } from '../library/syncBase';
import type { MemoryFolder } from '../platform/memoryFolder';
import { gpxAt, settle, trackTestTimers } from '../test/library.fixture';
import { createFakeFolder } from '../test/memoryFolder.fixture';

/**
 * Remise à zéro sur un faux dossier : « Réglages d'usine » garde sessions, profil et fichiers des autres appareils,
 * pose l'instant des réglages à maintenant ; « Tout supprimer » ne laisse que les fichiers étrangers et le dossier
 * désigné, et s'arrête sans rien toucher d'autre au premier échec du dossier.
 */

const files = new Map<string, string>();
const log: string[] = [];
const stored = new Map<string, string>();
/** Chemin dont l'effacement échoue, `null` : aucun. */
let failingRemove: string | null = null;
const cleared = vi.hoisted(() => ({ count: 0 }));
/** Dossier désigné qui ne s'ouvre pas (`openLibrary` en « unavailable ») quand `closed` est vrai. */
const designation = vi.hoisted(() => ({ closed: false }));
/** Programme Windows (`desktop`) sans dossier retenu (`none`), et la mémoire du navigateur qu'il garde à part. */
const shell = vi.hoisted(() => ({ desktop: false, none: false, browserCopy: null as MemoryFolder | null }));
const reloads: string[] = [];

/** Chemin dont l'écriture échoue, `null` : aucun. */
let failingWrite: string | null = null;

/**
 * Faux dossier qui refuse les écritures pendant la suspension, comme les vrais (`memoryFolder.ts`). Le module de
 * stockage est relu à chaque appel : `vi.resetModules` en donne un neuf à chaque ouverture.
 */
const guardedFolder = (contents: Map<string, string>, entries: string[], overrides: Partial<MemoryFolder> = {}): MemoryFolder => {
  const base = createFakeFolder(contents, entries, overrides);
  const refuse = async (path: string): Promise<void> => {
    const { writesSuspended } = await import('../platform/storage');
    if (writesSuspended()) throw new Error('Remise à zéro en cours : rien ne s\'écrit.');
    if (path === failingWrite) throw new Error('écriture refusée');
  };
  return {
    ...base,
    writeText: async (path, text) => {
      await refuse(path);
      await base.writeText(path, text);
    },
    writeBytes: async (path, bytes) => {
      await refuse(path);
      await base.writeBytes(path, bytes);
    },
  };
};

const folder: MemoryFolder = guardedFolder(files, log, {
  remove: async (path) => {
    if (path === failingRemove) throw new Error('accès retiré');
    log.push(`remove ${path}`);
    files.delete(path);
  },
});

const mockPlatform = (): void => {
  vi.doMock('../core/gpxParser', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../core/gpxParser')>()),
    parseGpx: (text: string) => ({
      rawPoints: [...text.matchAll(/<trkpt lat="([\d.]+)" lon="([\d.]+)"><time>([^<]+)<\/time>/g)]
        .map((m) => ({ lat: Number(m[1]), lon: Number(m[2]), time: m[3] })),
      trackType: 'kite',
      hasDeviceSpeed: false,
    }),
  }));
  vi.doMock('../platform/memoryFolder', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../platform/memoryFolder')>()),
    openMemoryFolder: async () => {
      if (designation.closed) throw new Error('dossier introuvable');
      if (shell.none) return { state: 'unavailable', reason: 'Aucun dossier mémoire choisi.' };
      return { state: 'ready', folder };
    },
    pendingFolder: () => null,
    browserMemoryCopy: async () => shell.browserCopy,
    isFolderDesignated: async () => !shell.none,
  }));
  vi.doMock('../platform/runtime', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../platform/runtime')>()),
    isDesktopApp: () => shell.desktop,
  }));
  vi.doMock('../platform/appReset', () => ({ clearDeviceFiles: async () => void (cleared.count += 1) }));
};

const settingsFile = (id: string, name: string, savedAt: number): string =>
  serializeSettingsFile(buildSettingsFile({ [STORAGE_KEYS.sportSettings]: { thresholds: { kite: 9 } } }, savedAt, null, { id, name }));

const OLD_SAVED_AT = 1_000;

/** Un appareil qui a servi : réglages, profil, lieux appris, deux fichiers de réglages, une session, des fichiers étrangers. */
const usedDevice = (): void => {
  stored.set(STORAGE_KEYS.sportSettings, JSON.stringify({ activities: [{ id: 'moth', name: 'Moth', base: 'wingfoil', color: 3 }], speedUnits: { wingfoil: 'kmh' } }));
  stored.set(STORAGE_KEYS.theme, JSON.stringify('dark'));
  stored.set(STORAGE_KEYS.athleteProfile, JSON.stringify({ me: { name: 'Léa' } }));
  stored.set(STORAGE_KEYS.lieuxAppris, JSON.stringify([]));
  stored.set(STORAGE_KEYS.settingsSavedAt, JSON.stringify(OLD_SAVED_AT));
  stored.set(STORAGE_KEYS.deviceId, JSON.stringify('moi'));
  stored.set(STORAGE_KEYS.deviceName, JSON.stringify('PC'));
  stored.set(STORAGE_KEYS.memoryFolder, JSON.stringify({ uri: 'x', base: '', label: 'dossier' }));
  stored.set('gtracker.ancienne', '1');
  stored.set('autre.application', '1');
  files.set('gtracker.json', '{"format":"gtracker-memoire","version":1}');
  files.set('reglages/pc.json', settingsFile('moi', 'PC', OLD_SAVED_AT));
  files.set('reglages/lea.json', settingsFile('lea', 'Léa', 500));
  files.set('sessions/2026-10-27_10-00-00_kite.gpx', gpxAt(0));
  files.set('sessions/2026-10-27_11-00-00_kite.gpx', gpxAt(30));
  files.set('journaux/journal-1.jsonl', '{"t":1}');
  files.set('a-moi.txt', 'à moi');
  files.set('sessions/notes.txt', 'à moi aussi');
};

type Library = typeof import('./useSessionLibrary');

const openFresh = async (): Promise<Library> => {
  vi.resetModules();
  mockPlatform();
  const library = await import('./useSessionLibrary');
  await library.openLibrary();
  await settle(library);
  return library;
};

let stopTestTimers: () => void = () => undefined;
beforeEach(() => {
  stopTestTimers = trackTestTimers();
  files.clear();
  log.length = 0;
  stored.clear();
  reloads.length = 0;
  failingRemove = null;
  failingWrite = null;
  cleared.count = 0;
  designation.closed = false;
  shell.desktop = false;
  shell.none = false;
  shell.browserCopy = null;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
    removeItem: (k: string) => void stored.delete(k),
    get length() {
      return stored.size;
    },
    key: (i: number) => [...stored.keys()][i] ?? null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  stopTestTimers();
});

/** `window` réduit à ce que la remise à zéro touche : le rechargement. */
const stubWindow = (): void => {
  vi.stubGlobal('window', { location: { replace: (path: string) => void reloads.push(path) }, addEventListener: () => undefined });
};

describe('réglages d\'usine', () => {
  it('réglages remis au défaut, instant posé à maintenant ; sessions, profil et autres appareils gardés', async () => {
    usedDevice();
    const library = await openFresh();
    expect(files.has('reglages/pc.json')).toBe(true);
    stubWindow();
    const before = Date.now();
    await library.factoryReset();
    expect(reloads).toEqual(['/profil']);
    expect(JSON.parse(stored.get(STORAGE_KEYS.sportSettings)!)).toEqual({});
    expect(stored.has(STORAGE_KEYS.theme)).toBe(false);
    expect(Number(stored.get(STORAGE_KEYS.settingsSavedAt))).toBeGreaterThanOrEqual(before);
    for (const key of [STORAGE_KEYS.athleteProfile, STORAGE_KEYS.lieuxAppris, STORAGE_KEYS.deviceId, STORAGE_KEYS.memoryFolder, 'gtracker.ancienne']) {
      expect(stored.has(key), key).toBe(true);
    }
    expect(files.has('reglages/pc.json')).toBe(false);
    expect(files.has('reglages/lea.json')).toBe(true);
    expect(files.has('journaux/journal-1.jsonl')).toBe(true);
    expect(files.has('sessions/2026-10-27_10-00-00_kite.gpx')).toBe(true);
    expect(files.has('sessions/2026-10-27_10-00-00_kite.json')).toBe(true);
    expect(log.filter((l) => l.startsWith('remove'))).toEqual(['remove reglages/pc.json']);
  });
});

describe('tout supprimer', () => {
  it('compte les sessions, puis ne laisse que les fichiers étrangers et le dossier désigné', async () => {
    usedDevice();
    const library = await openFresh();
    expect(await library.countErasable()).toEqual({ sessions: 2, pending: 0, routes: 0, trash: 0 });
    stubWindow();
    const progress: number[] = [];
    expect(await library.eraseEverything((p) => progress.push(p.done))).toBeNull();
    expect(reloads).toEqual(['/']);
    expect([...files.keys()].sort()).toEqual(['a-moi.txt', 'sessions/notes.txt']);
    expect([...files.keys()].some((p) => p.startsWith('journaux/'))).toBe(false);
    expect([...stored.keys()].sort()).toEqual(['autre.application', STORAGE_KEYS.memoryFolder]);
    expect(cleared.count).toBe(1);
    expect(log.filter((l) => l.startsWith('remove')).pop()).toBe('remove gtracker.json');
    expect(progress.length).toBeGreaterThan(0);
  });

  it('après une synchronisation (marqueur avec identifiant) : plus rien de l\'application, rechargement', async () => {
    usedDevice();
    files.set('gtracker.json', markerTextWithId(markerText(), 'dossier-0001') as string);
    const library = await openFresh();
    stubWindow();
    expect(await library.eraseEverything()).toBeNull();
    expect(reloads).toEqual(['/']);
    expect([...files.keys()].sort()).toEqual(['a-moi.txt', 'sessions/notes.txt']);
    expect(log).toContain('write gtracker.json');
    expect(cleared.count).toBe(1);
    // Le faux dossier suit bien la suspension de l'application, levée seulement au rechargement.
    await expect(folder.writeText('x.json', '{}')).rejects.toThrow(/rien ne s'écrit/);
  });

  it('un marqueur qui ne perd pas son identifiant : rien n\'est effacé, mémoire relue, compte rendu dit', async () => {
    usedDevice();
    files.set('gtracker.json', markerTextWithId(markerText(), 'dossier-0001') as string);
    const library = await openFresh();
    const keysBefore = [...stored.keys()].sort();
    const filesBefore = [...files.keys()].sort();
    failingWrite = 'gtracker.json';
    stubWindow();
    const message = await library.eraseEverything();
    expect(message).toMatch(/^Remise à zéro interrompue \(.*écriture refusée.*\) : 0 session effacée sur 0/);
    expect(reloads).toEqual([]);
    expect(cleared.count).toBe(0);
    expect(log.some((l) => l.startsWith('remove'))).toBe(false);
    expect([...stored.keys()].sort()).toEqual(keysBefore);
    expect([...files.keys()].sort()).toEqual(filesBefore);
    expect(readMarkerId(files.get('gtracker.json') ?? null)).toBe('dossier-0001');
    await settle(library);
    expect(library.readLibraryState().sessions).toHaveLength(2);
  });

  it('sans dossier retenu, la mémoire du navigateur part dans le programme Windows, jamais dans le navigateur', async () => {
    for (const desktop of [false, true]) {
      const browserFiles = new Map([['gtracker.json', '{"format":"gtracker-memoire","version":1}'], ['sessions/2026-10-27_10-00-00_kite.gpx', gpxAt(0)]]);
      shell.desktop = desktop;
      shell.none = true;
      shell.browserCopy = guardedFolder(browserFiles, []);
      // Sans `window` au chargement des modules, comme dans les autres essais de ce fichier.
      vi.stubGlobal('window', undefined);
      const library = await openFresh();
      expect(library.readLibraryState().status).toBe('unavailable');
      stubWindow();
      expect(await library.eraseEverything()).toBeNull();
      expect([...browserFiles.keys()].length, desktop ? 'programme Windows' : 'navigateur').toBe(desktop ? 0 : 2);
    }
  });

  it('refusé quand le dossier désigné n\'a pas pu s\'ouvrir : rien n\'est touché', async () => {
    usedDevice();
    designation.closed = true;
    const library = await openFresh();
    expect(library.readLibraryState().status).toBe('unavailable');
    const keysBefore = [...stored.keys()].sort();
    const filesBefore = [...files.keys()].sort();
    stubWindow();
    expect(await library.eraseEverything()).toMatch(/Redonnez d'abord l'accès au dossier mémoire/);
    expect(reloads).toEqual([]);
    expect(cleared.count).toBe(0);
    expect([...stored.keys()].sort()).toEqual(keysBefore);
    expect([...files.keys()].sort()).toEqual(filesBefore);
  });

  it('une seconde remise à zéro, lancée pendant la première, est refusée', async () => {
    usedDevice();
    const library = await openFresh();
    stubWindow();
    const first = library.eraseEverything();
    expect(await library.factoryReset()).toBe('Une remise à zéro est déjà en cours.');
    expect(await library.eraseEverything()).toBe('Une remise à zéro est déjà en cours.');
    expect(await first).toBeNull();
    expect(reloads).toEqual(['/']);
    expect(JSON.parse(stored.get(STORAGE_KEYS.sportSettings) ?? 'null')).toBeNull();
  });

  it('un échec du dossier arrête tout : clés et fichiers de l\'appareil intacts, mémoire relue, compte rendu dit', async () => {
    usedDevice();
    const library = await openFresh();
    const keysBefore = [...stored.keys()].sort();
    failingRemove = 'sessions/2026-10-27_11-00-00_kite.gpx';
    stubWindow();
    const message = await library.eraseEverything();
    expect(message).toMatch(/^Remise à zéro interrompue \(.+\) : 1 session effacée sur 2 ; réglages, profil et cartes intacts\./);
    expect(reloads).toEqual([]);
    expect(cleared.count).toBe(0);
    expect([...stored.keys()].sort()).toEqual(keysBefore);
    expect(files.has('gtracker.json') && files.has('reglages/pc.json') && files.has('reglages/lea.json')).toBe(true);
    expect(files.has('sessions/2026-10-27_10-00-00_kite.gpx')).toBe(false);
    await settle(library);
    const state = library.readLibraryState();
    expect(state.status).toBe('ready');
    expect(state.sessions).toHaveLength(1);
    expect(state.error).toBe(message);
    // Les écritures ont repris : un réglage changé s'écrit de nouveau.
    library.updateSessionRecord(state.sessions[0].file, { name: 'Gardée' });
    await library.refreshLibrary();
    expect(JSON.parse(files.get(`sessions/${state.sessions[0].file.replace(/\.gpx$/, '.json')}`)!).name).toBe('Gardée');
  });
});
