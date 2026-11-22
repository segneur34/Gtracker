import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderEntry, MemoryFolder } from '../platform/memoryFolder';
import {
  TRASH_INDEX_PATH, TRASH_KEEP_MS, deletesToTrash, parseTrashIndex, routeDeleteButton, serializeTrashIndex, sessionDeleteQuestion,
  sessionDiscardQuestion, type TrashEntry,
} from '../library/trash';
import { gpxAt, settle, trackTestTimers } from '../test/library.fixture';

/**
 * Corbeille du programme Windows, de la bibliothèque au dossier : une session supprimée y passe au lieu d'être
 * effacée, revient par « Restaurer » ou par un import, et la corbeille est purgée à l'ouverture. Sur un autre
 * dossier que celui du disque, la suppression reste un effacement.
 */

const files = new Map<string, string>();
const dirs = new Set<string>();
const log: string[] = [];
/** Sorte du dossier ouvert, et programme Windows (`desktop`) ou non. */
const shell = vi.hoisted(() => ({ kind: 'disk' as MemoryFolder['kind'], desktop: false }));
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const addParents = (path: string) => {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
};
const put = (path: string, text: string) => {
  log.push(`write ${path}`);
  addParents(path);
  files.set(path, text);
};

const folder = (): MemoryFolder => ({
  kind: shell.kind,
  label: 'Gtracker',
  list: async (dir) => {
    const entries: FolderEntry[] = [];
    const name = (p: string) => p.slice(dir === '' ? 0 : dir.length + 1);
    for (const [p, text] of files) if (parentOf(p) === dir) entries.push({ name: name(p), kind: 'file', size: text.length, mtimeMs: 1 });
    for (const d of dirs) if (parentOf(d) === dir) entries.push({ name: name(d), kind: 'directory', size: 0, mtimeMs: 1 });
    return entries;
  },
  readText: async (path) => files.get(path) ?? null,
  writeText: async (path, text) => put(path, text),
  readBytes: async (path) => (files.has(path) ? encoder.encode(files.get(path)) : null),
  writeBytes: async (path, bytes) => put(path, decoder.decode(bytes)),
  stat: async (path) => (files.has(path) ? { size: files.get(path)!.length, mtimeMs: 1 } : null),
  remove: async (path) => {
    log.push(`remove ${path}`);
    files.delete(path);
  },
  ...(shell.kind === 'disk' ? {
    removeDir: async (path: string) => {
      if ([...files.keys()].some((p) => p.startsWith(`${path}/`))) throw new Error('pas vide');
      dirs.delete(path);
    },
  } : {}),
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
    openMemoryFolder: async () => ({ state: 'ready', folder: folder() }),
    pendingFolder: () => null,
  }));
  vi.doMock('../platform/runtime', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../platform/runtime')>()),
    isDesktopApp: () => shell.desktop,
  }));
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

/** Laisse finir ce qui part sans être attendu (purge, relecture de la corbeille). */
const drain = async (library: Library): Promise<void> => {
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0));
  await settle(library);
};

const GPX = 'sessions/2026-10-27_10-00-00_kite.gpx';
const trashFiles = () => [...files.keys()].filter((p) => p.startsWith('corbeille/') && p !== TRASH_INDEX_PATH).sort();
const index = () => parseTrashIndex(files.get(TRASH_INDEX_PATH) ?? null);

let stopTestTimers: () => void = () => undefined;
beforeEach(() => {
  stopTestTimers = trackTestTimers();
  files.clear();
  dirs.clear();
  log.length = 0;
  shell.kind = 'disk';
  shell.desktop = false;
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
    removeItem: (k: string) => void stored.delete(k),
    get length() {
      return stored.size;
    },
    key: (i: number) => [...stored.keys()][i] ?? null,
  });
  files.set('gtracker.json', '{"format":"gtracker-memoire","version":1}');
  files.set(GPX, gpxAt(0));
  files.set('sessions/2026-10-27_10-30-00_kite.gpx', gpxAt(30));
});

afterEach(() => {
  vi.unstubAllGlobals();
  stopTestTimers();
});

/**
 * La première session supprimée sur l'ordinateur (fiche nommée « Ordinateur »), et à côté la copie du téléphone que
 * la synchronisation aurait rangée à part (nommée « Téléphone », avec des notes ; `phoneGpx` : son GPX, celui de
 * l'ordinateur par défaut). La bibliothèque est rouverte sur ces deux entrées.
 */
const twoOrigins = async (phoneGpx?: string): Promise<Library> => {
  const library = await openFresh();
  await library.removeSession('2026-10-27_10-00-00_kite.gpx');
  await drain(library);
  const [mine] = index().entries;
  const recordName = mine.files.find((f) => f.name.endsWith('.json'))?.name as string;
  const edit = (dir: string, patch: Record<string, unknown>): number => {
    const text = JSON.stringify({ ...JSON.parse(files.get(`corbeille/${mine.dir}/${recordName}`) as string), ...patch }, null, 2);
    put(`corbeille/${dir}/${recordName}`, text);
    return text.length;
  };
  const phoneDir = `${mine.dir}-2`;
  for (const f of mine.files) put(`corbeille/${phoneDir}/${f.name}`, files.get(`corbeille/${mine.dir}/${f.name}`) as string);
  if (phoneGpx !== undefined) put(`corbeille/${phoneDir}/${mine.main}`, phoneGpx);
  const notes = {
    foil: '', mast: '', wing: '', gear1: '', gear2: '', conditions: '', gear: null, comment: 'Note du téléphone', windLevel: null, waterState: null,
    rating: null, savedAt: 100,
  };
  const phoneSize = edit(phoneDir, { name: 'Téléphone', notes });
  const mineSize = edit(mine.dir, { name: 'Ordinateur' });
  const sized = (entry: TrashEntry, sizes: Record<string, number>): TrashEntry => ({ ...entry, files: entry.files.map((f) => ({ ...f, size: sizes[f.name] ?? f.size })) });
  const phoneSizes = { [recordName]: phoneSize, ...(phoneGpx !== undefined ? { [mine.main]: phoneGpx.length } : {}) };
  files.set(TRASH_INDEX_PATH, serializeTrashIndex([
    sized({ ...mine, dir: phoneDir, origin: 'telephone', name: 'Copie du téléphone' }, phoneSizes), sized(mine, { [recordName]: mineSize }),
  ]));
  const reopened = await openFresh();
  await drain(reopened);
  expect(reopened.trashStore.get().entries).toHaveLength(2);
  return reopened;
};

describe('corbeille du programme Windows', () => {
  it('une session supprimée passe à la corbeille, GPX retiré en premier, et ne compte plus dans la liste', async () => {
    const library = await openFresh();
    const [first] = library.readLibraryState().sessions.filter((s) => s.file === '2026-10-27_10-00-00_kite.gpx');
    log.length = 0;
    await library.removeSession(first.file);
    await drain(library);
    expect(library.readLibraryState().sessions.map((s) => s.file)).toEqual(['2026-10-27_10-30-00_kite.gpx']);
    expect(files.has(GPX)).toBe(false);
    const writeIndex = log.indexOf(`write ${TRASH_INDEX_PATH}`);
    const removeGpx = log.indexOf(`remove ${GPX}`);
    expect(writeIndex).toBeGreaterThan(-1);
    expect(removeGpx).toBeGreaterThan(writeIndex);
    expect(log.filter((l) => l.startsWith('remove'))[0]).toBe(`remove ${GPX}`);
    const [entry] = index().entries;
    expect(entry).toMatchObject({ kind: 'session', startMs: first.record.summary.startMs, origin: 'ordinateur', reason: 'supprimee' });
    expect(trashFiles()).toEqual([`corbeille/${entry.dir}/2026-10-27_10-00-00_kite.gpx`, `corbeille/${entry.dir}/2026-10-27_10-00-00_kite.json`]);
    expect(library.trashStore.get().entries).toEqual([entry]);
  });

  it('« Restaurer » la ramène dans la liste et vide son entrée ; « Supprimer définitivement » et « Vider » effacent', async () => {
    const library = await openFresh();
    await library.removeSession('2026-10-27_10-00-00_kite.gpx');
    await drain(library);
    const [entry] = library.trashStore.get().entries;
    expect(await library.restoreFromTrash(entry)).toContain('est revenue dans la mémoire');
    await drain(library);
    expect(library.readLibraryState().sessions.map((s) => s.file).sort()).toEqual(['2026-10-27_10-00-00_kite.gpx', '2026-10-27_10-30-00_kite.gpx']);
    expect(files.get(GPX)).toBe(gpxAt(0));
    expect(index().entries).toEqual([]);
    expect(trashFiles()).toEqual([]);
    expect(library.trashStore.get().entries).toEqual([]);

    await library.removeSession('2026-10-27_10-00-00_kite.gpx');
    await library.removeSession('2026-10-27_10-30-00_kite.gpx');
    await drain(library);
    expect(library.trashStore.get().entries).toHaveLength(2);
    await library.deleteFromTrash(library.trashStore.get().entries[0]);
    expect(library.trashStore.get().entries).toHaveLength(1);
    await library.emptyWholeTrash();
    expect(library.trashStore.get().entries).toEqual([]);
    expect(trashFiles()).toEqual([]);
  });

  it('deux origines, une ligne : « Restaurer » ramène la copie de l’ordinateur, complétée par celle du téléphone, et vide la ligne', async () => {
    const library = await twoOrigins();
    const phoneEntry = library.trashStore.get().entries.find((e) => e.origin === 'telephone') as TrashEntry;
    // Restaurée depuis la ligne, quelle que soit l'entrée qui la porte : l'ordinateur fait foi, le téléphone complète.
    expect(await library.restoreFromTrash(phoneEntry)).toBe('« Kite » est revenue dans la mémoire.');
    await drain(library);
    // La fiche de l'ordinateur garde son nom et reçoit les notes du téléphone, qui lui manquaient.
    const restored = library.readLibraryState().sessions.find((s) => s.file === '2026-10-27_10-00-00_kite.gpx');
    expect(restored?.record).toMatchObject({ name: 'Ordinateur', notes: { comment: 'Note du téléphone' } });
    expect(JSON.parse(files.get('sessions/2026-10-27_10-00-00_kite.json') as string).notes?.comment).toBe('Note du téléphone');
    expect(library.readLibraryState().sessions).toHaveLength(2);
    expect(index().entries).toEqual([]);
    expect(trashFiles()).toEqual([]);

    // « Supprimer définitivement » retire la ligne entière.
    const again = await twoOrigins();
    await again.deleteFromTrash(again.trashStore.get().entries.find((e) => e.origin === 'ordinateur') as TrashEntry);
    expect(index().entries).toEqual([]);
    expect(trashFiles()).toEqual([]);
  });

  it.each([
    ['tronquée (GPX illisible)', (): string => '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>', false],
    ['autre trace du même instant', (): string => gpxAt(0).replace('lat="43.6"', 'lat="43.7"'), true],
  ])('deux origines, copie du téléphone %s : la session revient, la copie reste dans la corbeille et c’est dit', async (_, phoneGpx, completes) => {
    const library = await twoOrigins(phoneGpx());
    const message = await library.restoreFromTrash(library.trashStore.get().entries[0]);
    await drain(library);
    expect(message).toBe('« Kite » est revenue dans la mémoire. Une autre copie de cette session reste dans la corbeille : elle n\'a pas pu compléter sa fiche.');
    expect(files.get(GPX)).toBe(gpxAt(0));
    const restored = library.readLibraryState().sessions.find((s) => s.file === '2026-10-27_10-00-00_kite.gpx');
    expect(restored?.record.notes?.comment ?? null).toBe(completes ? 'Note du téléphone' : null);
    const [left] = index().entries;
    expect(index().entries.map((e) => e.origin)).toEqual(['telephone']);
    expect(files.get(`corbeille/${left.dir}/${left.main}`)).toBe(phoneGpx());
    expect(library.trashStore.get().entries.map((e) => e.origin)).toEqual(['telephone']);
  });

  it('une session revenue par un import quitte la corbeille', async () => {
    const library = await openFresh();
    await library.removeSession('2026-10-27_10-00-00_kite.gpx');
    await drain(library);
    expect(library.trashStore.get().entries).toHaveLength(1);
    const text = gpxAt(0);
    await library.importEntries([{ name: 'reprise.gpx', key: 'reprise', readText: async () => text, readBytes: async () => encoder.encode(text) }]);
    await drain(library);
    expect(library.readLibraryState().sessions).toHaveLength(2);
    expect(library.trashStore.get().entries).toEqual([]);
    expect(index().entries).toEqual([]);
  });

  it('purge à l\'ouverture : plus de 30 jours effacé, le reste gardé', async () => {
    const now = Date.now();
    const entry = (dir: string, deletedAtMs: number): TrashEntry => ({
      dir, kind: 'session', startMs: 1, routeBase: null, createdAt: null, name: 'Kite', deletedAtMs, origin: 'ordinateur', reason: 'supprimee',
      main: 'x.gpx', files: [{ name: 'x.gpx', size: 3 }],
    });
    files.set(TRASH_INDEX_PATH, serializeTrashIndex([entry('1763000000000-vieille', now - TRASH_KEEP_MS - 60_000), entry('1763000000001-recente', now - 60_000)]));
    files.set('corbeille/1763000000000-vieille/x.gpx', 'old');
    files.set('corbeille/1763000000001-recente/x.gpx', 'new');
    addParents('corbeille/1763000000000-vieille/x.gpx');
    addParents('corbeille/1763000000001-recente/x.gpx');
    const library = await openFresh();
    await drain(library);
    expect(index().entries.map((e) => e.dir)).toEqual(['1763000000001-recente']);
    expect(trashFiles()).toEqual(['corbeille/1763000000001-recente/x.gpx']);
    expect(dirs.has('corbeille/1763000000000-vieille')).toBe(false);
    expect(library.trashStore.get().entries.map((e) => e.dir)).toEqual(['1763000000001-recente']);
  });

  it('hors du dossier du disque : la suppression efface, sans corbeille', async () => {
    shell.kind = 'picked';
    const library = await openFresh();
    await library.removeSession('2026-10-27_10-00-00_kite.gpx');
    await drain(library);
    expect(files.has(GPX)).toBe(false);
    expect([...files.keys()].some((p) => p.startsWith('corbeille/'))).toBe(false);
    expect(library.trashStore.get().entries).toEqual([]);
  });

  it('programme Windows revenu à la mémoire du navigateur : suppression définitive, et la confirmation le dit', async () => {
    shell.kind = 'browser';
    shell.desktop = true;
    const library = await openFresh();
    const { folderKind, memoryReadOnly } = library.readLibraryState();
    const toTrash = deletesToTrash(folderKind, memoryReadOnly);
    expect(toTrash).toBe(false);
    expect(sessionDeleteQuestion(toTrash)).toBe('Supprimer cette session de la mémoire ?');
    expect(sessionDiscardQuestion(toTrash, false)).toContain('ne pourra pas être récupérée');
    expect(routeDeleteButton(toTrash, 'Supprimer définitivement')).toBe('Supprimer définitivement');
    await library.removeSession('2026-10-27_10-00-00_kite.gpx');
    await drain(library);
    expect(files.has(GPX)).toBe(false);
    expect([...files.keys()].some((p) => p.startsWith('corbeille/'))).toBe(false);
  });

  it('dossier du disque : la confirmation promet la corbeille, que la suppression tient', async () => {
    shell.desktop = true;
    const library = await openFresh();
    const { folderKind, memoryReadOnly } = library.readLibraryState();
    expect(sessionDeleteQuestion(deletesToTrash(folderKind, memoryReadOnly))).toContain('corbeille');
  });
});
