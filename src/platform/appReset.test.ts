import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fichiers de l'application hors du dossier mémoire, effacés par « Tout supprimer » : seulement ceux qu'elle
 * nomme, jamais la racine du dossier privé ni un fichier qu'elle n'a pas écrit.
 */

const calls: string[] = [];
const runtime = vi.hoisted(() => ({ native: true }));
const received = vi.hoisted(() => ({ ids: ['r1', 'r2'] as string[], removed: [] as string[] }));
/** Racine du dossier privé, telle que le téléphone la liste. */
const ROOT = [
  { name: 'recording-journal.jsonl', type: 'file' },
  { name: 'recording-journal-2026-11-03T14-25-01-123Z.jsonl', type: 'file' },
  { name: 'vignettes.json', type: 'file' },
  { name: 'autre.txt', type: 'file' },
  { name: 'recording-journal.jsonl.bak', type: 'file' },
  { name: 'tuiles', type: 'directory' },
];

vi.mock('./runtime', () => ({ isNativeApp: () => runtime.native }));
vi.mock('./incomingFile', () => ({
  incomingFiles: {
    list: async () => received.ids.map((id) => ({ id, name: `${id}.gpx`, size: 1, refusal: null })),
    remove: async (id: string) => void received.removed.push(id),
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readdir: async ({ path, directory }: { path: string; directory: string }) => {
      calls.push(`readdir ${directory}:${path}`);
      return { files: path === '' ? ROOT : [] };
    },
    deleteFile: async ({ path, directory }: { path: string; directory: string }) => void calls.push(`delete ${directory}:${path}`),
    rmdir: async ({ path, directory, recursive }: { path: string; directory: string; recursive?: boolean }) =>
      void calls.push(`rmdir ${directory}:${path}${recursive ? ' (tout)' : ''}`),
  },
}));

beforeEach(() => {
  vi.resetModules();
  calls.length = 0;
  received.removed = [];
  runtime.native = true;
});

describe('fichiers de l\'appareil effacés par « Tout supprimer »', () => {
  it('au téléphone : la liste nommée seulement, jamais la racine du dossier privé', async () => {
    const { clearDeviceFiles } = await import('./appReset');
    await clearDeviceFiles();
    const removed = calls.filter((c) => c.startsWith('delete') || c.startsWith('rmdir'));
    expect(removed.sort()).toEqual([
      'delete DATA:recording-journal-2026-11-03T14-25-01-123Z.jsonl',
      'delete DATA:recording-journal.jsonl',
      'delete DATA:vignettes.json',
      'rmdir CACHE:partage (tout)',
      'rmdir DATA:capteurs (tout)',
      'rmdir DATA:en-attente (tout)',
      'rmdir DATA:tuiles (tout)',
      'rmdir DATA:vignettes-images (tout)',
    ]);
    expect(removed.some((c) => /:(\s|$|\/)/.test(c) || c.includes('autre.txt') || c.endsWith('.bak'))).toBe(false);
    expect(received.removed).toEqual(['r1', 'r2']);
  });

  it('dans le navigateur : les caches des tuiles et des vignettes, rien du dossier privé', async () => {
    runtime.native = false;
    const deleted: string[] = [];
    vi.stubGlobal('caches', { delete: async (name: string) => { deleted.push(name); return true; }, open: async () => null });
    try {
      const { clearDeviceFiles } = await import('./appReset');
      await clearDeviceFiles();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(deleted.sort()).toEqual(['gtracker-tuiles', 'gtracker-vignettes', 'gtracker-vignettes-images']);
    expect(calls).toEqual([]);
    expect(received.removed).toEqual([]);
  });
});
