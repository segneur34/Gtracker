import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { base64ToBytes } from '../core/base64';
import { IMU_FORMAT, decodeImu, decodeImuHeader } from '../core/imuFile';
import type { ImportEntry, MemoryFolder } from '../platform/memoryFolder';
import { settle, trackTestTimers } from '../test/library.fixture';
import {
  TRACKER_SURF_BUNDLE, TRACKER_SURF_GPX, TRACKER_SURF_RECORD, TRACKER_WING_BUNDLE, TRACKER_WING_GPX, TRACKER_WING_IMU, TRACKER_WING_RECORD,
} from '../test/legacyImport.fixture';
import { createFakeFolder } from '../test/memoryFolder.fixture';
import { RECORD_FORMAT, parseRecord, parseRecordWithRaw, serializeRecord, type SessionRecord } from './record';
import { unbundleSessionGpx } from './sessionBundle';

/**
 * Porte d'import des sessions de l'ancienne application (lot 320) : ce que Tracker 1.0.0 écrit pour une session de
 * wingfoil et une de surf (`test/legacyImport.fixture.ts`, produit par son propre code) est lu entièrement par le code
 * d'aujourd'hui : le GPX complet (paquet de session), la fiche et les capteurs posés à côté, le GPX seul.
 *
 * Les formats se disent par leurs constantes (`RECORD_FORMAT`, `IMU_FORMAT`) et non par leurs chaînes : le même test doit
 * rester vert quand ces constantes changent (lot 321).
 */

const WING_IMU = base64ToBytes(TRACKER_WING_IMU);

/** Ce que chacune des deux sessions du jeu d'essai porte, écrit à la main (les chiffres viennent du code d'origine). */
const SESSIONS = {
  wing: {
    sport: 'wingfoil',
    gpx: TRACKER_WING_GPX,
    record: TRACKER_WING_RECORD,
    bundle: TRACKER_WING_BUNDLE,
    imu: WING_IMU,
    name: 'Wing & foil, après-midi d\'essai',
    comment: 'Vent < 20 nœuds, rafales > 25 & houle courte.',
    startMs: Date.parse('2026-06-01T10:00:00Z'),
    pointCount: 101,
    marks: [
      { timeMs: 1780308020250, lat: 43.50107295150808, lon: 3.7996177564369553, label: 'Départ du bord' },
      { timeMs: 1780308070250, lat: 43.499215957339985, lon: 3.7983175015481856, label: null },
    ],
  },
  surf: {
    sport: 'surf',
    gpx: TRACKER_SURF_GPX,
    record: TRACKER_SURF_RECORD,
    bundle: TRACKER_SURF_BUNDLE,
    imu: null,
    name: 'Surf du matin',
    comment: 'Une belle vague, l\'eau était froide.',
    startMs: Date.parse('2026-09-20T10:00:00Z'),
    pointCount: 227,
    marks: [
      { timeMs: 1789898480250, lat: 43.6, lon: 3.8012021225359423, label: 'Départ du bord' },
      { timeMs: 1789898550250, lat: 43.6, lon: 3.8032487113161415, label: null },
    ],
  },
} as const;

type Kind = keyof typeof SESSIONS;
const KINDS: Kind[] = ['wing', 'surf'];

/** Fiche du jeu d'essai, relue entièrement. */
const recordOf = (kind: Kind): SessionRecord => {
  const record = parseRecord(SESSIONS[kind].record);
  if (!record) throw new Error(`fiche ${kind} illisible`);
  return record;
};

describe('jeu d\'essai de la porte d\'import : le paquet de session', () => {
  it('le jeu lui-même : les textes sont ceux du code d\'origine, finis par un saut de ligne', () => {
    for (const kind of KINDS) {
      expect(SESSIONS[kind].gpx.endsWith('</gpx>\n')).toBe(true);
      expect(SESSIONS[kind].record.endsWith('}\n')).toBe(true);
      expect(SESSIONS[kind].bundle.length).toBeGreaterThan(SESSIONS[kind].gpx.length);
    }
    expect(TRACKER_WING_GPX).toContain('<type>wingfoil</type>');
    expect(TRACKER_SURF_GPX).toContain('<type>surf</type>');
  });

  for (const kind of KINDS) {
    const expected = SESSIONS[kind];

    it(`${kind} : le GPX rendu est le GPX d'origine, à l'octet`, () => {
      const bundle = unbundleSessionGpx(expected.bundle);
      expect(bundle.gpx).toBe(expected.gpx);
      // Le paquet porte bien les retouches du nom et des repères : sinon le test ne prouverait rien.
      expect(expected.bundle).toContain('<tracker:edit ');
      expect(expected.bundle).toContain(`<name>${expected.marks[0].label}</name>`);
      expect(expected.bundle).not.toBe(expected.gpx);
    });

    it(`${kind} : la fiche du paquet est celle du jeu, relue entièrement (rien d'illisible)`, () => {
      const bundle = unbundleSessionGpx(expected.bundle);
      expect(bundle.recordText).toBe(expected.record);
      expect(bundle.unreadable).toEqual({});
      const record = bundle.record;
      if (!record) throw new Error('fiche du paquet illisible');
      expect(record.format).toBe(RECORD_FORMAT);
      expect(record.sport).toBe(expected.sport);
      expect(record.name).toBe(expected.name);
      expect(record.notes?.comment).toBe(expected.comment);
      expect(record.marks).toEqual(expected.marks);
      expect(record.summary?.calcVersion).toBe(18);
      expect(record.summary?.startMs).toBe(expected.startMs);
      expect(record.summary?.pointCount).toBe(expected.pointCount);
    });

    it(`${kind} : la fiche écrite se relit puis se réécrit à l'octet`, () => {
      const parsed = parseRecordWithRaw(expected.record);
      expect(parsed?.unreadable).toEqual({});
      expect(serializeRecord(recordOf(kind))).toBe(expected.record);
    });
  }

  it('wingfoil : réglages d\'analyse complets, vent, foil, pumping, notes et sauts', () => {
    const record = recordOf('wing');
    expect(record.analysis).toEqual({
      windDeg: 300, activeThreshold: null, referenceSpeedMs: null, speedRange: null, effortThresholdMs: null, foil: true, pumping: true,
      waveThreshold: null, bikeWeightKg: null, loadKg: null, savedAt: 1780310700000,
    });
    expect(record.notes).toMatchObject({
      foil: 'Axis 1050', mast: 'Mât 85', wing: 'Aile 5 m', windLevel: 'moyen', waterState: 'clapot', rating: 4,
      gear: [{ groupId: 'g-aile', groupName: 'Aile', itemId: 'i-aile-5', itemName: 'Aile 5 m' }],
    });
    expect(record.summary).toMatchObject({
      pumpingShare: 0.42, windDirDeg: 300, maneuverCount: 3, maneuverResults: { tackSuccess: 1, tackFail: 0, jibeSuccess: 1, jibeFail: 1 },
      optionsKey: '[null,null,null,null]', activitySettings: { threshold: null },
    });
    expect(record.jumps?.jumps).toHaveLength(2);
    expect(record.jumps?.jumps.map((j) => j.doubts)).toEqual([[], ['parabole']]);
    expect(record.jumps?.jumps[0]).toMatchObject({ flightS: 0.5, heightM: 0.31, speedMs: 7.4, lengthM: 3.7 });
    expect(record.jumps?.measured).toBeUndefined();
  });

  it('surf : seuil de vague et foil de la session, résumé des vagues', () => {
    const record = recordOf('surf');
    expect(record.analysis).toMatchObject({ foil: true, waveThreshold: 3.5, windDeg: null, pumping: null });
    expect(record.summary).toMatchObject({ waveCount: 1, longestFlightS: 41, flightS: 41, optionsKey: '[null,null,true,3.5]' });
    expect(record.summary).toMatchObject({ activitySettings: { threshold: null, foil: true } });
    expect(record.jumps).toBeUndefined();
  });

  it('wingfoil : les capteurs du paquet sont ceux du .imu, et se lisent entièrement', async () => {
    const bundle = unbundleSessionGpx(TRACKER_WING_BUNDLE);
    expect(bundle.motion).not.toBeNull();
    expect(bundle.motion).toEqual(WING_IMU);
    const header = decodeImuHeader(WING_IMU);
    expect(header?.format).toBe(IMU_FORMAT);
    expect(header?.setup).toEqual({ placement: 'poitrine', foil: true, jumps: true, cadence: false });
    const recording = await decodeImu(WING_IMU);
    expect(recording).not.toBeNull();
    expect(recording?.truncated).toBe(false);
    expect(recording?.skippedChunks).toBe(0);
    expect(recording?.series.map((s) => s.t.length)).toEqual([200, 200, 20]);
  });

  it('surf : un paquet sans capteurs n\'en invente pas', () => {
    expect(unbundleSessionGpx(TRACKER_SURF_BUNDLE).motion).toBeNull();
  });
});

// --- Par la bibliothèque : importEntries sur un faux dossier mémoire ---

const files = new Map<string, string>();
const bytes = new Map<string, Uint8Array>();
const log: string[] = [];
const fakeFolder: MemoryFolder = createFakeFolder(files, log, {
  writeBytes: async (path, data) => {
    bytes.set(path, data);
  },
  readBytes: async (path) => bytes.get(path) ?? null,
});

const openFresh = async () => {
  vi.resetModules();
  vi.doMock('../platform/memoryFolder', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../platform/memoryFolder')>()),
    openMemoryFolder: async () => ({ state: 'ready', folder: fakeFolder }),
    pendingFolder: () => null,
  }));
  const library = await import('../hooks/useSessionLibrary');
  await library.openLibrary();
  await settle(library);
  return library;
};

const entry = (name: string, content: string | Uint8Array): ImportEntry => ({
  name,
  key: name.replace(/\.[a-z]+$/i, '').toLowerCase(),
  readText: async () => (typeof content === 'string' ? content : null),
  readBytes: async () => (typeof content === 'string' ? new TextEncoder().encode(content) : content),
});

let stopTimers = () => {};
beforeEach(() => {
  files.clear();
  bytes.clear();
  log.length = 0;
  stopTimers = trackTestTimers();
});
afterEach(() => {
  stopTimers();
  vi.doUnmock('../platform/memoryFolder');
});

/** Ce que l'import a rangé : le GPX, la fiche relue du disque, les capteurs, et la session telle que la bibliothèque la montre. */
const stored = (library: Awaited<ReturnType<typeof openFresh>>, added: string[]) => {
  expect(added).toHaveLength(1);
  const file = added[0];
  const session = library.readLibraryState().sessions.find((s) => s.file === file);
  if (!session) throw new Error('session absente de la bibliothèque');
  const recordText = files.get(`sessions/${file.replace(/\.gpx$/i, '.json')}`);
  const onDisk = recordText === undefined ? null : parseRecord(recordText);
  return {
    gpx: files.get(`sessions/${file}`),
    onDisk,
    motion: bytes.get(`sessions/${file.replace(/\.gpx$/i, '.imu')}`),
    record: session.record,
  };
};

describe('porte d\'import : la bibliothèque range les sessions de l\'ancienne application', () => {
  for (const kind of KINDS) {
    const expected = SESSIONS[kind];
    const original = recordOf(kind);

    /** Ce que toute forme d'entrée avec fiche doit donner : GPX d'origine, fiche entière, résumé non refait. */
    const expectWholeSession = (got: ReturnType<typeof stored>) => {
      expect(got.gpx).toBe(expected.gpx);
      expect(got.record.sport).toBe(expected.sport);
      expect(got.record.name).toBe(expected.name);
      expect(got.record.notes).toEqual(original.notes);
      expect(got.record.marks).toEqual(expected.marks);
      expect(got.record.analysis).toEqual(original.analysis);
      expect(got.record.jumps).toEqual(original.jumps);
      expect(got.record.activityId).toBe(original.activityId);
      expect(got.record.summary).toEqual(original.summary);
      expect(got.record.summary.calcVersion).toBe(18);
      // La fiche rangée sur le disque dit la même chose que la bibliothèque.
      expect(got.onDisk).toEqual(got.record);
      expect(got.onDisk?.format).toBe(RECORD_FORMAT);
    };

    /** Les capteurs, rangés octet pour octet (wingfoil), ou absents (surf). */
    const expectMotion = (got: ReturnType<typeof stored>) => {
      if (expected.imu) expect(got.motion).toEqual(expected.imu);
      else expect(got.motion).toBeUndefined();
    };

    it(`${kind} : le paquet seul (un GPX complet)`, async () => {
      const library = await openFresh();
      const report = await library.importEntries([entry(`${kind}-paquet.gpx`, expected.bundle)]);
      expect(report.failed).toEqual([]);
      expect(report.duplicates).toBe(0);
      const got = stored(library, report.added);
      expectWholeSession(got);
      expectMotion(got);
    });

    it(`${kind} : le GPX, la fiche .json et les capteurs .imu posés à côté`, async () => {
      const library = await openFresh();
      const entries = [entry(`${kind}.gpx`, expected.gpx), entry(`${kind}.json`, expected.record)];
      if (expected.imu) entries.push(entry(`${kind}.imu`, expected.imu));
      const report = await library.importEntries(entries, { fromFolder: true });
      expect(report.failed).toEqual([]);
      const got = stored(library, report.added);
      expectWholeSession(got);
      expectMotion(got);
    });

    it(`${kind} : le GPX seul, son calcul reconnu par <type>, sans fiche`, async () => {
      const library = await openFresh();
      const report = await library.importEntries([entry(`${kind}.gpx`, expected.gpx)]);
      expect(report.failed).toEqual([]);
      const got = stored(library, report.added);
      expect(got.gpx).toBe(expected.gpx);
      expect(got.record.sport).toBe(expected.sport);
      expect(got.record.name).toBeNull();
      expect(got.record.summary.calcVersion).toBe(18);
      expect(got.record.summary).toMatchObject({
        startMs: original.summary.startMs, endMs: original.summary.endMs, pointCount: original.summary.pointCount,
        distanceM: original.summary.distanceM,
      });
      expect(got.motion).toBeUndefined();
    });
  }

  it('le même paquet importé deux fois : « déjà présente », rien n\'est écrasé', async () => {
    const library = await openFresh();
    const first = await library.importEntries([entry('wing-paquet.gpx', TRACKER_WING_BUNDLE)]);
    const before = files.get(`sessions/${first.added[0]}`);
    const again = await library.importEntries([entry('wing-paquet.gpx', TRACKER_WING_BUNDLE)]);
    expect(again.added).toEqual([]);
    expect(again.duplicates).toBe(1);
    expect(files.get(`sessions/${first.added[0]}`)).toBe(before);
  });

  it('le GPX seul d\'abord, puis le paquet : la session reçoit sa fiche et ses capteurs', async () => {
    const library = await openFresh();
    const first = await library.importEntries([entry('wing.gpx', TRACKER_WING_GPX)]);
    expect(first.added).toHaveLength(1);
    const again = await library.importEntries([entry('wing-paquet.gpx', TRACKER_WING_BUNDLE)]);
    expect(again.added).toEqual([]);
    expect(again.duplicates).toBe(1);
    expect(again.recordCompleted).toBe(1);
    expect(again.motionAdded).toBe(1);
    const got = stored(library, first.added);
    expect(got.record.name).toBe(SESSIONS.wing.name);
    expect(got.record.marks).toEqual(SESSIONS.wing.marks);
    expect(got.record.jumps).toEqual(recordOf('wing').jumps);
    expect(got.motion).toEqual(WING_IMU);
  });
});
