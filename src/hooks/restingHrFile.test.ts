import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_FORMATS } from '../core/appIdentity';
import { RESTING_HR_FILE } from '../library/folderLayout';
import { RESTING_HR_KEY, restingHrFileText, type StoredRestingResult } from '../library/restingHrStore';
import type { MemoryFolder } from '../platform/memoryFolder';
import { createFakeFolder } from '../test/memoryFolder.fixture';

/**
 * Tests de FC repos entre l'appareil et `fc-repos.json` : un fichier d'une version plus récente est lu (ses tests
 * passent sur l'appareil) sans jamais être réécrit ; un fichier de la version courante l'est comme avant.
 */

const files = new Map<string, string>();
const log: string[] = [];
const stored = new Map<string, string>();
const folder: MemoryFolder = createFakeFolder(files, log);

const result = (startedAtMs: number): StoredRestingResult => ({
  startedAtMs, version: 1, lowestBpm: 48, fromS: 60, toS: 120, meanBpm: 52, maxBpm: 60, coverage: 1, series: [50, 49, 48],
});

/** Texte d'un fichier de version `version`, avec un champ qu'une version plus récente aurait ajouté. */
const fileText = (version: number, results: StoredRestingResult[]): string =>
  `${JSON.stringify({ format: FILE_FORMATS.fcRepos, version, results, nouveau: true })}\n`;

const load = async () => {
  vi.resetModules();
  const module = await import('./restingHrFile');
  const { jsonStore } = await import('../platform/storage');
  return { ...module, jsonStore };
};

beforeEach(() => {
  files.clear();
  log.length = 0;
  stored.clear();
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

afterEach(() => vi.unstubAllGlobals());

describe("fichier d'une version plus récente", () => {
  it("à l'ouverture : ses tests passent sur l'appareil, le fichier n'est pas réécrit", async () => {
    stored.set(RESTING_HR_KEY, JSON.stringify([result(2000)]));
    const text = fileText(2, [result(1000)]);
    files.set(RESTING_HR_FILE, text);
    const { syncRestingHrFile, readDeviceRestingResults } = await load();
    await syncRestingHrFile(folder);
    expect(readDeviceRestingResults().map((r) => r.startedAtMs)).toEqual([2000, 1000]);
    expect(files.get(RESTING_HR_FILE)).toBe(text);
    expect(log).toEqual([]);
  });

  it("un test enregistré reste sur l'appareil, le fichier n'est pas réécrit", async () => {
    const text = fileText(9, []);
    files.set(RESTING_HR_FILE, text);
    const { saveRestingHrFile } = await load();
    await saveRestingHrFile(folder, [result(3000)]);
    expect(files.get(RESTING_HR_FILE)).toBe(text);
    expect(log).toEqual([]);
  });
});

describe('fichier de la version courante', () => {
  it("à l'ouverture : la fusion est écrite des deux côtés, comme avant", async () => {
    stored.set(RESTING_HR_KEY, JSON.stringify([result(2000)]));
    files.set(RESTING_HR_FILE, fileText(1, [result(1000)]));
    const { syncRestingHrFile, readDeviceRestingResults } = await load();
    await syncRestingHrFile(folder);
    expect(readDeviceRestingResults().map((r) => r.startedAtMs)).toEqual([2000, 1000]);
    expect(files.get(RESTING_HR_FILE)).toBe(restingHrFileText([result(2000), result(1000)]));
    expect(JSON.parse(files.get(RESTING_HR_FILE)!).version).toBe(1);
  });

  it('un test enregistré est écrit, absent compris ; un fichier illisible reste tel quel', async () => {
    const { saveRestingHrFile } = await load();
    await saveRestingHrFile(folder, [result(3000)]);
    expect(files.get(RESTING_HR_FILE)).toBe(restingHrFileText([result(3000)]));
    files.set(RESTING_HR_FILE, '{ abîmé');
    await saveRestingHrFile(folder, [result(4000)]);
    expect(files.get(RESTING_HR_FILE)).toBe('{ abîmé');
  });
});
