import { beforeEach, describe, expect, it, vi } from 'vitest';
import { journalFixLine, journalHeaderLine } from '../recording/journal';

/** Journaux mis de côté simulés : contenus par nom, lectures en échec, retraits faits. */
const aside = vi.hoisted(() => ({
  files: new Map<string, string>(),
  unreadable: new Set<string>(),
  removed: [] as string[],
}));
vi.mock('../platform/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/files')>()),
  recordingJournal: {
    listAside: async () => [...aside.files.keys()].sort(),
    readAside: async (name: string) => {
      if (aside.unreadable.has(name)) throw new Error('trop gros pour le pont');
      return aside.files.get(name) ?? null;
    },
    removeAside: async (name: string) => {
      aside.removed.push(name);
      aside.files.delete(name);
    },
  },
}));

vi.mock('../platform/motion', () => ({
  findMotionCapture: async () => null,
  readMotionCapture: async () => null,
  removeMotionCapture: async () => undefined,
}));

/**
 * Bibliothèque simulée : sessions rangées, dossier mémoire (`null` : aucun), écritures dans le dossier, messages du
 * démarrage. `saveFails` : le rangement lève ; `kept` : ce que dit le rangement ; `writeFails` : l'écriture lève.
 */
const library = vi.hoisted(() => ({
  saved: [] as { text: string; sport: unknown; activityId: unknown }[],
  saveFails: false,
  refuses: false,
  kept: true,
  folder: 'writable' as 'writable' | 'readOnly' | null,
  written: new Map<string, string>(),
  writeFails: false,
  reports: [] as string[],
}));
vi.mock('./useSessionLibrary', () => ({
  saveRecordedSession: async (text: string, sport: unknown, activityId: unknown) => {
    if (library.saveFails) throw new Error('écriture refusée');
    if (library.refuses) throw Object.assign(new Error('Pas assez de points horodatés.'), { refused: true });
    library.saved.push({ text, sport, activityId });
    return { file: 'rangee.gpx', location: 'dossier « Gtracker »', kept: library.kept };
  },
  currentMemoryFolder: async () => (library.folder === null ? null : {
    readOnly: library.folder === 'readOnly' ? true : undefined,
    writeText: async (path: string, text: string) => {
      if (library.writeFails) throw new Error('dossier plein');
      library.written.set(path, text);
    },
  }),
  reportStartupError: (text: string) => library.reports.push(text),
}));

vi.mock('./useSportSettings', () => ({ readStoredActivities: () => [], effectiveFoil: () => null }));

const T0 = Date.UTC(2026, 10, 15, 10, 0, 0);
const READABLE = 'recording-journal-2026-11-15T10-00-00-000Z.jsonl';
const GARBLED = 'recording-journal-2026-11-15T11-00-00-000Z.jsonl';
/** Lancement de l'application, après la mise de côté des deux journaux. */
const LAUNCH = Date.UTC(2026, 10, 15, 12, 0, 0);

/** Journal de dix positions à 1 Hz, sous l'activité Kite. */
const readableJournal = (): string =>
  journalHeaderLine('kite', T0, { id: 'a-kite', name: 'Kite' })
  + Array.from({ length: 10 }, (_, i) => journalFixLine({ timeMs: T0 + i * 1000, lat: 43 + i * 1e-5, lon: 3, speedMs: 4 })).join('');

/** Le module neuf, comme à un nouveau lancement. */
const launch = async () => {
  vi.resetModules();
  return import('./setAsideJournals');
};

beforeEach(() => {
  aside.files = new Map();
  aside.unreadable = new Set();
  aside.removed = [];
  library.saved = [];
  library.saveFails = false;
  library.refuses = false;
  library.kept = true;
  library.folder = 'writable';
  library.written = new Map();
  library.writeFails = false;
  library.reports = [];
});

describe('journaux mis de côté, au lancement', () => {
  it('relisible : la session est rangée sous son activité, puis le journal retiré, et c’est dit', async () => {
    aside.files.set(READABLE, readableJournal());
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(library.saved).toHaveLength(1);
    expect(library.saved[0].sport).toBe('kite');
    expect(library.saved[0].activityId).toBe('a-kite');
    expect(library.saved[0].text.match(/<trkpt/g)).toHaveLength(10);
    expect(aside.removed).toEqual([READABLE]);
    expect(library.reports).toHaveLength(1);
    expect(library.reports[0]).toMatch(/retrouvée .*rangée \(dossier « Gtracker »\)/);
  });

  it('sans session : copié tel quel dans journaux/, puis retiré ; un seul message pour tous', async () => {
    aside.files.set(READABLE, readableJournal());
    aside.files.set(GARBLED, 'pas un journal');
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(library.written.get(`journaux/${GARBLED}`)).toBe('pas un journal');
    expect(aside.removed).toEqual([READABLE, GARBLED]);
    expect(library.reports).toHaveLength(1);
    expect(library.reports[0]).toContain(`journaux/${GARBLED}`);
  });

  it('copie en échec : rien n’est retiré, et le message dit où il reste', async () => {
    aside.files.set(GARBLED, 'pas un journal');
    library.writeFails = true;
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(aside.removed).toEqual([]);
    expect(aside.files.has(GARBLED)).toBe(true);
    expect(library.reports[0]).toMatch(new RegExp(`non copié .*dossier plein.*dossier privé .*${GARBLED}`));
  });

  it('sans dossier mémoire, ou dossier en lecture seule : rien ne bouge', async () => {
    aside.files.set(GARBLED, 'pas un journal');
    for (const folder of [null, 'readOnly'] as const) {
      library.folder = folder;
      library.reports = [];
      await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
      expect(library.written.size).toBe(0);
      expect(aside.removed).toEqual([]);
      expect(library.reports[0]).toMatch(/faute de dossier mémoire .*dossier privé/);
    }
  });

  it('rangement en échec, ou session rangée nulle part : le journal reste', async () => {
    aside.files.set(READABLE, readableJournal());
    library.saveFails = true;
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(aside.removed).toEqual([]);
    expect(library.reports[0]).toMatch(/non rangée \(écriture refusée\)/);

    library.saveFails = false;
    library.kept = false;
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(aside.removed).toEqual([]);
    expect(library.written.size).toBe(0);
  });

  it('session refusée par la mémoire pour son contenu : rendue comme illisible, copiée puis retirée', async () => {
    aside.files.set(READABLE, readableJournal());
    library.refuses = true;
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(library.written.get(`journaux/${READABLE}`)).toBe(readableJournal());
    expect(aside.removed).toEqual([READABLE]);
    expect(library.reports[0]).toContain(`copié tel quel dans le dossier mémoire : journaux/${READABLE}`);
  });

  it('mis de côté pendant ce lancement : laissé pour le suivant, qui le reprend', async () => {
    const thisLaunch = 'recording-journal-2026-11-15T12-00-05-000Z.jsonl';
    aside.files.set(thisLaunch, readableJournal());
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(library.saved).toEqual([]);
    expect(aside.removed).toEqual([]);
    expect(library.reports).toEqual([]);

    await (await launch()).retrySetAsideJournals(() => false, LAUNCH + 3_600_000);
    expect(library.saved).toHaveLength(1);
    expect(aside.removed).toEqual([thisLaunch]);
  });

  it('lecture impossible à chaque lancement (trop gros pour le pont) : ni copié, faute de texte, ni effacé ; gardé et retenté', async () => {
    aside.files.set(READABLE, readableJournal());
    aside.unreadable.add(READABLE);
    await (await launch()).retrySetAsideJournals(() => false, LAUNCH);
    expect(aside.removed).toEqual([]);
    expect(library.saved).toEqual([]);
    expect(library.written.size).toBe(0);
    expect(library.reports[0]).toMatch(/toujours illisible \(trop gros pour le pont\) : il reste dans le dossier privé .*nouvel essai au prochain lancement/);
  });

  it('pendant un enregistrement : rien ; une seule tournée par lancement', async () => {
    aside.files.set(READABLE, readableJournal());
    const module = await launch();
    await module.retrySetAsideJournals(() => true, LAUNCH);
    await module.retrySetAsideJournals(() => false, LAUNCH);
    expect(library.saved).toEqual([]);
    expect(aside.removed).toEqual([]);
    expect(library.reports).toEqual([]);
  });
});
