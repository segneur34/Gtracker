import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME, XML } from '../core/appIdentity';
import { base64ToBytes } from '../core/base64';
import { IMU_FORMAT, decodeImu, decodeImuHeader, joinImu, splitImu } from '../core/imuFile';
import { gpxDocument } from '../core/xml';
import type { ImportEntry, MemoryFolder } from '../platform/memoryFolder';
import { settle, trackTestTimers } from '../test/library.fixture';
import {
  LEGACY_SURF_BUNDLE, LEGACY_SURF_GPX, LEGACY_SURF_RECORD, LEGACY_WING_BUNDLE, LEGACY_WING_GPX, LEGACY_WING_IMU, LEGACY_WING_RECORD,
} from '../test/legacyImport.fixture';
import { createFakeFolder } from '../test/memoryFolder.fixture';
import { importRecordChoice } from './importEntry';
import { isIgnoredLegacyRecord, parseImportedRecord, upgradeImportedImu } from './legacyImport';
import { RECORD_FORMAT, applyRecordPatch, parseRecord, parseRecordWithRaw, serializeRecord, type SessionRecord } from './record';
import { bundleSessionGpx, unbundleSessionGpx } from './sessionBundle';

/**
 * Porte d'import des sessions de l'ancienne application (lot 320) : ce que Tracker 1.0.0 écrit pour une session de
 * wingfoil et une de surf (`test/legacyImport.fixture.ts`, produit par son propre code) est lu entièrement par le code
 * d'aujourd'hui : le GPX complet (paquet de session), la fiche et les capteurs posés à côté, le GPX seul.
 *
 * Les formats se disent par leurs constantes (`RECORD_FORMAT`, `IMU_FORMAT`) et non par leurs chaînes : le même test doit
 * rester vert quand ces constantes changent (lot 321).
 */

const WING_IMU = base64ToBytes(LEGACY_WING_IMU);

/** Ce que chacune des deux sessions du jeu d'essai porte, écrit à la main (les chiffres viennent du code d'origine). */
const SESSIONS = {
  wing: {
    sport: 'wingfoil',
    gpx: LEGACY_WING_GPX,
    record: LEGACY_WING_RECORD,
    bundle: LEGACY_WING_BUNDLE,
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
    gpx: LEGACY_SURF_GPX,
    record: LEGACY_SURF_RECORD,
    bundle: LEGACY_SURF_BUNDLE,
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

/** Fiche du jeu d'essai, relue entièrement par la porte d'import (lot 321 : la mémoire ne lit plus l'ancien format). */
const recordOf = (kind: Kind): SessionRecord => {
  const parts = parseImportedRecord(SESSIONS[kind].record).parsed?.parts;
  if (!parts?.summary) throw new Error(`fiche ${kind} illisible`);
  return { ...parts, summary: parts.summary };
};

/** Fiche de l'ancienne application, retouchée par `patch` (champs de premier niveau, analyse, résumé). */
const legacyRecord = (patch: { top?: Record<string, unknown>; analysis?: Record<string, unknown>; summary?: Record<string, unknown> }): string => {
  const raw = JSON.parse(LEGACY_WING_RECORD) as Record<string, Record<string, unknown>>;
  return JSON.stringify({
    ...raw, ...patch.top, analysis: { ...raw.analysis, ...patch.analysis }, summary: { ...raw.summary, ...patch.summary },
  });
};

/** Sans GPX complet (`importRecordChoice`). */
const NO_BUNDLE = { record: null, recordText: null, unreadable: {}, otherSport: null };

/** En-tête brut d'un `.imu`, relu en JSON. */
const imuHeaderJson = (file: Uint8Array): Record<string, unknown> => {
  const split = splitImu(file);
  if (!split) throw new Error('.imu illisible');
  return JSON.parse(split.headerText) as Record<string, unknown>;
};

/**
 * Capteurs rangés depuis ceux de l'ancienne application (`original`) : les mesures à l'octet, l'en-tête récrit au
 * format de Gtracker (lot 321 : sa longueur change, le fichier entier ne se compare plus à l'octet).
 */
const expectSameMeasures = (motion: Uint8Array | undefined, original: Uint8Array): void => {
  if (!motion) throw new Error('capteurs absents');
  expect(splitImu(motion)?.body).toEqual(splitImu(original)?.body);
  expect(decodeImuHeader(motion)?.format).toBe(IMU_FORMAT);
  expect(imuHeaderJson(motion).setup).not.toHaveProperty('cadence');
};

describe('jeu d\'essai de la porte d\'import : le paquet de session', () => {
  it('le jeu lui-même : les textes sont ceux du code d\'origine, finis par un saut de ligne', () => {
    for (const kind of KINDS) {
      expect(SESSIONS[kind].gpx.endsWith('</gpx>\n')).toBe(true);
      expect(SESSIONS[kind].record.endsWith('}\n')).toBe(true);
      expect(SESSIONS[kind].bundle.length).toBeGreaterThan(SESSIONS[kind].gpx.length);
    }
    expect(LEGACY_WING_GPX).toContain('<type>wingfoil</type>');
    expect(LEGACY_SURF_GPX).toContain('<type>surf</type>');
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
      const parsed = parseImportedRecord(expected.record).parsed;
      expect(parsed?.unreadable).toEqual({});
      // Lot 321 : réécrite au format de Gtracker, sans rien perdre ni changer ; lot 306 : sans les trois lignes de
      // l'analyse retirées à l'entrée (`withoutOriginFields`).
      expect(expected.record).toContain('"format": "tracker-session"');
      const lines = expected.record.replace('"format": "tracker-session"', `"format": "${RECORD_FORMAT}"`).split('\n');
      const kept = lines.filter((line) => !/^ {4}"(effortThresholdMs|bikeWeightKg|loadKg)": null,$/.test(line));
      expect(kept).toHaveLength(lines.length - 3);
      expect(serializeRecord(recordOf(kind))).toBe(kept.join('\n'));
    });
  }

  it('wingfoil : réglages d\'analyse complets, vent, foil, pumping, notes et sauts', () => {
    const record = recordOf('wing');
    expect(record.analysis).toEqual({
      windDeg: 300, activeThreshold: null, referenceSpeedMs: null, speedRange: null, foil: true, pumping: true,
      waveThreshold: null, savedAt: 1780310700000,
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
    const bundle = unbundleSessionGpx(LEGACY_WING_BUNDLE);
    expect(bundle.motion).not.toBeNull();
    expect(bundle.motion).toEqual(WING_IMU);
    // Lot 321 : l'en-tête de l'ancienne application, tel qu'écrit, ne se lit qu'une fois converti par la porte d'import.
    expect(imuHeaderJson(WING_IMU)).toMatchObject({ format: 'tracker-capteurs', setup: { placement: 'poitrine', foil: true, jumps: true, cadence: false } });
    expect(decodeImuHeader(WING_IMU)).toBeNull();
    const upgraded = upgradeImportedImu(WING_IMU);
    if (!upgraded) throw new Error('capteurs non convertis');
    const header = decodeImuHeader(upgraded);
    expect(header?.format).toBe(IMU_FORMAT);
    expect(header?.setup).toEqual({ placement: 'poitrine', foil: true, jumps: true });
    const recording = await decodeImu(upgraded);
    expect(recording).not.toBeNull();
    expect(recording?.truncated).toBe(false);
    expect(recording?.skippedChunks).toBe(0);
    expect(recording?.series.map((s) => s.t.length)).toEqual([200, 200, 20]);
  });

  it('surf : un paquet sans capteurs n\'en invente pas', () => {
    expect(unbundleSessionGpx(LEGACY_SURF_BUNDLE).motion).toBeNull();
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

    /** Les capteurs, mesures rangées octet pour octet sous l'en-tête de Gtracker (wingfoil, lot 321), ou absents (surf). */
    const expectMotion = (got: ReturnType<typeof stored>) => {
      if (expected.imu) expectSameMeasures(got.motion, expected.imu);
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
    const first = await library.importEntries([entry('wing-paquet.gpx', LEGACY_WING_BUNDLE)]);
    const before = files.get(`sessions/${first.added[0]}`);
    const again = await library.importEntries([entry('wing-paquet.gpx', LEGACY_WING_BUNDLE)]);
    expect(again.added).toEqual([]);
    expect(again.duplicates).toBe(1);
    expect(files.get(`sessions/${first.added[0]}`)).toBe(before);
  });

  it('le GPX seul d\'abord, puis le paquet : la session reçoit sa fiche et ses capteurs', async () => {
    const library = await openFresh();
    const first = await library.importEntries([entry('wing.gpx', LEGACY_WING_GPX)]);
    expect(first.added).toHaveLength(1);
    const again = await library.importEntries([entry('wing-paquet.gpx', LEGACY_WING_BUNDLE)]);
    expect(again.added).toEqual([]);
    expect(again.duplicates).toBe(1);
    expect(again.recordCompleted).toBe(1);
    expect(again.motionAdded).toBe(1);
    const got = stored(library, first.added);
    expect(got.record.name).toBe(SESSIONS.wing.name);
    expect(got.record.marks).toEqual(SESSIONS.wing.marks);
    expect(got.record.jumps).toEqual(recordOf('wing').jumps);
    expectSameMeasures(got.motion, WING_IMU);
  });
});

// --- Lot 321 : la porte lit l'ancien format et le convertit en entrant ---

describe('porte d\'import : lecture de l\'ancien format (fonctions pures)', () => {
  it('une fiche de l\'ancienne application se lit, sans les champs que Gtracker ne lit pas', () => {
    const read = parseImportedRecord(legacyRecord({
      top: { surfaces: { asphalt: 10 }, terrainElevation: [1, 2], elevationSource: 'terrain', intervals: [{ s: 1 }], test: { kind: 'vma' } },
      summary: { cadence: 82, bests: { '1km': 300 }, best1kmS: 300, best5minMs: 4.2, avgPowerW: 180 },
      analysis: { effortThresholdMs: 3.1, bikeWeightKg: 9, loadKg: 4 },
    }));
    expect(read.legacy).toBe(true);
    expect(read.otherSport).toBeNull();
    expect(isIgnoredLegacyRecord(read)).toBe(false);
    const parts = read.parsed?.parts;
    if (!parts) throw new Error('fiche illisible');
    expect(parts.format).toBe(RECORD_FORMAT);
    for (const field of ['surfaces', 'terrainElevation', 'elevationSource', 'intervals', 'test']) expect(parts).not.toHaveProperty(field);
    for (const field of ['cadence', 'bests', 'best1kmS', 'best5minMs', 'avgPowerW']) expect(parts.summary).not.toHaveProperty(field);
    for (const field of ['effortThresholdMs', 'bikeWeightKg', 'loadKg']) expect(parts.analysis).not.toHaveProperty(field);
    expect(read.parsed?.unreadable).toEqual({});
    expect(parts.name).toBe(SESSIONS.wing.name);
    expect(parts.marks).toEqual(SESSIONS.wing.marks);
  });

  it('repère une fiche d\'un sport que Gtracker ne range pas, avant que la lecture ne l\'efface', () => {
    for (const sport of ['running', 'cycling', 'run-intervals', 'bike-intervals', 'run-test', 'muscu']) {
      const read = parseImportedRecord(legacyRecord({ top: { sport } }));
      expect(read.otherSport).toBe(sport);
      expect(read.parsed?.parts.sport).toBeNull();
    }
    expect(parseImportedRecord(LEGACY_SURF_RECORD).otherSport).toBeNull();
    // Un sport inconnu n'est pas refusé : la session reste « à classer ».
    expect(parseImportedRecord(legacyRecord({ top: { sport: 'hiking' } })).otherSport).toBeNull();
  });

  it('une fiche de l\'ancienne application plus récente ou illisible n\'est pas rangée', () => {
    expect(isIgnoredLegacyRecord(parseImportedRecord(legacyRecord({ top: { version: 2 } })))).toBe(true);
    expect(isIgnoredLegacyRecord(parseImportedRecord(legacyRecord({ top: { gpx: '' } })))).toBe(true);
    expect(isIgnoredLegacyRecord(parseImportedRecord('pas du JSON'))).toBe(false);
  });

  it('récrit l\'en-tête des capteurs de l\'ancienne application, mesures intactes', async () => {
    const upgraded = upgradeImportedImu(WING_IMU);
    if (!upgraded) throw new Error('capteurs non convertis');
    expect(splitImu(upgraded)?.body).toEqual(splitImu(WING_IMU)?.body);
    const before = imuHeaderJson(WING_IMU);
    const after = imuHeaderJson(upgraded);
    expect(after.format).toBe(IMU_FORMAT);
    expect(after.setup).toEqual({ placement: 'poitrine', foil: true, jumps: true });
    const { format: _f1, setup: _s1, ...restBefore } = before;
    const { format: _f2, setup: _s2, ...restAfter } = after;
    expect(restAfter).toEqual(restBefore);
    const recording = await decodeImu(upgraded);
    expect(recording?.series.map((s) => s.t.length)).toEqual([200, 200, 20]);
    expect(recording?.skippedChunks).toBe(0);
    // Un fichier converti, ou qui n'est pas à l'ancien format, est rendu sans y toucher.
    expect(upgradeImportedImu(upgraded)).toBe(upgraded);
    const other = new Uint8Array([1, 2, 3]);
    expect(upgradeImportedImu(other)).toBe(other);
  });

  it('des capteurs de l\'ancienne application d\'une version plus récente ne sont pas convertis', () => {
    const split = splitImu(WING_IMU);
    if (!split) throw new Error('.imu illisible');
    const newer = joinImu({ ...imuHeaderJson(WING_IMU), version: 2 }, split.body);
    expect(upgradeImportedImu(newer)).toBeNull();
    const broken = joinImu({ ...imuHeaderJson(WING_IMU), clock: null }, split.body);
    expect(upgradeImportedImu(broken)).toBeNull();
  });

  it('fiche à côté ou du paquet : se fond comme une fiche de Gtracker', () => {
    const choice = importRecordChoice(LEGACY_WING_RECORD, NO_BUNDLE);
    expect(choice.record?.name).toBe(SESSIONS.wing.name);
    expect(choice.keepRecordText).toBeUndefined();
    expect(choice.legacyRecordIgnored).toBe(false);
  });

  it('fiche plus récente ou illisible : ni fondue ni rangée telle quelle, seul le GPX entre', () => {
    for (const text of [legacyRecord({ top: { version: 2 } }), legacyRecord({ top: { gpx: null } })]) {
      expect(importRecordChoice(text, NO_BUNDLE)).toEqual({
        record: null, unreadable: undefined, keepRecordText: undefined, otherSport: null, legacyRecordIgnored: true,
      });
      const fromBundle = importRecordChoice(undefined, { ...NO_BUNDLE, recordText: text });
      expect(fromBundle.record).toBeNull();
      expect(fromBundle.keepRecordText).toBeUndefined();
      expect(fromBundle.legacyRecordIgnored).toBe(true);
    }
  });

  it('dit le sport que Gtracker ne range pas, de la fiche à côté ou du paquet', () => {
    expect(importRecordChoice(legacyRecord({ top: { sport: 'running' } }), NO_BUNDLE).otherSport).toBe('running');
    expect(importRecordChoice(undefined, { ...NO_BUNDLE, otherSport: 'cycling' }).otherSport).toBe('cycling');
    const running = LEGACY_WING_BUNDLE.replace('"sport": "wingfoil"', '"sport": "running"');
    expect(running).not.toBe(LEGACY_WING_BUNDLE);
    expect(unbundleSessionGpx(running).otherSport).toBe('running');
  });

  it('la mémoire ne lit plus l\'ancien format : seule la porte d\'import le lit', () => {
    expect(parseRecordWithRaw(LEGACY_WING_RECORD)).toBeNull();
    expect(parseRecord(LEGACY_SURF_RECORD)).toBeNull();
    expect(parseImportedRecord(LEGACY_WING_RECORD).legacy).toBe(true);
  });

  it('un paquet écrit par Gtracker ne porte aucun ancien nom, et se relit sans passer par l\'ancien format', () => {
    const bundled = bundleSessionGpx(LEGACY_WING_GPX, recordOf('wing'), upgradeImportedImu(WING_IMU));
    expect(bundled).not.toMatch(/(^|[^g])tracker[:-]/);
    expect(bundled).toContain(`<${XML.session.prefix}:session xmlns:${XML.session.prefix}="${XML.session.ns}" version="1">`);
    const back = unbundleSessionGpx(bundled);
    expect(back.gpx).toBe(LEGACY_WING_GPX);
    expect(back.record?.name).toBe(SESSIONS.wing.name);
    expect(back.recordText && parseImportedRecord(back.recordText).legacy).toBe(false);
    expect(back.motion && decodeImuHeader(back.motion)?.format).toBe(IMU_FORMAT);
  });

  it('un GPX de Gtracker empaqueté puis relu : aller-retour exact, aucun ancien nom nulle part', () => {
    const gpx = gpxDocument(['  <trk><name>Essai</name><trkseg></trkseg></trk>']);
    const bundled = bundleSessionGpx(gpx, recordOf('wing'), upgradeImportedImu(WING_IMU));
    expect(bundled).not.toMatch(/(?<![gG])tracker/i);
    expect(bundled).toContain(`creator="${APP_NAME}"`);
    const back = unbundleSessionGpx(bundled);
    expect(back.gpx).toBe(gpx);
    expect(back.record?.name).toBe(SESSIONS.wing.name);
    expect(back.recordText && JSON.parse(back.recordText).format).toBe(RECORD_FORMAT);
    expect(back.motion && decodeImuHeader(back.motion)?.format).toBe(IMU_FORMAT);
    expect(back.motion && splitImu(back.motion)?.body).toEqual(splitImu(WING_IMU)?.body);
  });

  it('relit un paquet de l\'ancienne application sans retouches ni capteurs (0.2.82)', () => {
    // Déménagé de `sessionBundle.test.ts` (lot 321) : la fiche et rien d'autre, sous l'ancien préfixe.
    const escaped = LEGACY_WING_RECORD.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const old = LEGACY_WING_GPX.replace('</gpx>', '<extensions><tracker:session xmlns:tracker="https://github.com/segneur34/Tracker/session" version="1">'
      + `<tracker:record>${escaped}</tracker:record></tracker:session></extensions></gpx>`);
    const back = unbundleSessionGpx(old);
    expect(back.gpx).toBe(LEGACY_WING_GPX);
    expect(back.record?.name).toBe(SESSIONS.wing.name);
    expect(back.record?.format).toBe(RECORD_FORMAT);
    expect(back.motion).toBeNull();
  });

  it('fiche de septembre de l\'ancienne application (58aa8bb) : lue sans perte, réécrite sans perte au format neuf', () => {
    // Déménagé de `compat.fiche.test.ts` (lot 321). Forme de la fiche au 24/09 : pas d'activité, de nom, de gear1/2,
    // conditions, gear ; analysis à trois champs ; un ancien `terrain`.
    const september = {
      format: 'tracker-session', version: 1, gpx: '2026-09-23_14-00-00_wingfoil.gpx', sport: 'wingfoil', source: 'enregistrement',
      addedAt: '2026-09-24T10:00:00.000Z', title: 'Wingfoil',
      summary: { calcVersion: 2, startMs: 1790000000000, endMs: 1790003600000, distanceM: 20000, movingTimeS: 2500, elevationGainM: null, maxSpeedMs: 11, pointCount: 3601, samplingS: 1, maneuverCount: 12 },
      notes: { foil: 'Axis 900', mast: '75', wing: '5 m', windLevel: 'moyen', waterState: 'clapot', rating: 4, comment: 'Bien', savedAt: 1790004000000 },
      analysis: { windDeg: 270, activeThreshold: 9, referenceSpeedMs: null, terrain: 'route', savedAt: 1790004000000 },
    };
    const parsed = parseImportedRecord(JSON.stringify(september)).parsed;
    if (!parsed?.parts.summary) throw new Error('fiche de septembre illisible');
    expect(parsed.unreadable).toEqual({});
    expect(parsed.parts.summary.calcVersion).toBe(2);
    const { record } = applyRecordPatch({ ...parsed.parts, summary: parsed.parts.summary }, { name: 'Renommée' });
    const out = JSON.parse(serializeRecord(record, parsed.unreadable)) as Record<string, unknown>;
    expect(out.format).toBe(RECORD_FORMAT);
    expect(out.notes).toMatchObject(september.notes);
    expect(out.analysis).toMatchObject(september.analysis);
    expect((out.summary as Record<string, unknown>).maneuverCount).toBe(12);
  });
});

describe('porte d\'import : ce que la bibliothèque range est au format de Gtracker', () => {
  /** Fiche rangée sur le disque, relue en JSON brut. */
  const diskRecord = (file: string): Record<string, unknown> => {
    const text = files.get(`sessions/${file.replace(/\.gpx$/i, '.json')}`);
    if (text === undefined) throw new Error('fiche non rangée');
    expect(text).not.toContain('"tracker-session"');
    return JSON.parse(text) as Record<string, unknown>;
  };

  it('(b) le paquet, ou les fichiers posés à côté : fiche et capteurs écrits sous les noms neufs', async () => {
    for (const entries of [
      [entry('wing-paquet.gpx', LEGACY_WING_BUNDLE)],
      [entry('wing.gpx', LEGACY_WING_GPX), entry('wing.json', LEGACY_WING_RECORD), entry('wing.imu', WING_IMU)],
    ]) {
      files.clear();
      bytes.clear();
      const library = await openFresh();
      const report = await library.importEntries(entries, { fromFolder: entries.length > 1 });
      expect(report.failed).toEqual([]);
      const got = stored(library, report.added);
      const disk = diskRecord(report.added[0]);
      expect(disk.format).toBe(RECORD_FORMAT);
      for (const field of ['effortThresholdMs', 'bikeWeightKg', 'loadKg']) expect(disk.analysis).not.toHaveProperty(field);
      expect(imuHeaderJson(got.motion!).format).toBe(IMU_FORMAT);
      expectSameMeasures(got.motion, WING_IMU);
    }
  });

  it('(c) une session de course ou de vélo de l\'ancienne application est refusée avec le message, rien n\'est rangé', async () => {
    const library = await openFresh();
    const report = await library.importEntries([
      // GPX et fiche de course posée à côté.
      entry('course.gpx', LEGACY_WING_GPX.replace('<type>wingfoil</type>', '<type>running</type>')),
      entry('course.json', legacyRecord({ top: { sport: 'running' } })),
      // GPX seul, son `<type>` de vélo.
      entry('velo.gpx', LEGACY_SURF_GPX.replace('<type>surf</type>', '<type>cycling</type>')),
      // Paquet dont la fiche dit un fractionné.
      entry('fractionne.gpx', LEGACY_WING_BUNDLE.replace('"sport": "wingfoil"', '"sport": "run-intervals"')),
    ], { fromFolder: true });
    expect(report.added).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(report.invalid).toEqual([]);
    expect(report.otherSports).toEqual(['course.gpx', 'velo.gpx', 'fractionne.gpx']);
    expect(library.readLibraryState().message)
      .toBe("3 sessions de course, de vélo ou d'entraînement laissées de côté : Gtracker ne range que la voile et le surf.");
    expect([...files.keys()].filter((path) => path.startsWith('sessions/'))).toEqual([]);
  });

  it('fiche de l\'ancienne application plus récente : la trace seule est rangée, le compte rendu le dit', async () => {
    const library = await openFresh();
    const report = await library.importEntries([entry('wing.gpx', LEGACY_WING_GPX), entry('wing.json', legacyRecord({ top: { version: 2 } }))], { fromFolder: true });
    expect(report.added).toHaveLength(1);
    expect(report.legacyRecordsIgnored).toEqual(['wing.gpx']);
    const got = stored(library, report.added);
    expect(got.record.name).toBeNull();
    expect(got.record.marks).toBeUndefined();
    expect(got.record.sport).toBe('wingfoil');
    expect(library.librarySession(report.added[0])?.readOnly).toBe(false);
    expect(diskRecord(report.added[0])).toMatchObject({ format: RECORD_FORMAT, version: 1 });
    expect(library.readLibraryState().message).toContain("fiche de l'autre application d'une version plus récente ou illisible pour 1 session (wing.gpx)");
  });

  it('capteurs de l\'ancienne application qu\'on ne sait pas convertir : session rangée sans eux, comptés à part', async () => {
    const split = splitImu(WING_IMU);
    if (!split) throw new Error('.imu illisible');
    const newer = joinImu({ ...imuHeaderJson(WING_IMU), version: 2 }, split.body);
    const library = await openFresh();
    const report = await library.importEntries([
      entry('wing.gpx', LEGACY_WING_GPX), entry('wing.json', LEGACY_WING_RECORD), entry('wing.imu', newer),
    ], { fromFolder: true });
    expect(report.added).toHaveLength(1);
    expect(report.motionFailed).toEqual(['wing.gpx']);
    const got = stored(library, report.added);
    expect(got.motion).toBeUndefined();
    expect(got.record.name).toBe(SESSIONS.wing.name);
  });

  it('capteurs posés à côté qu\'on ne sait pas convertir : ceux du paquet servent', async () => {
    const split = splitImu(WING_IMU);
    if (!split) throw new Error('.imu illisible');
    const newer = joinImu({ ...imuHeaderJson(WING_IMU), version: 2 }, split.body);
    const library = await openFresh();
    const report = await library.importEntries([entry('wing.gpx', LEGACY_WING_BUNDLE), entry('wing.imu', newer)], { fromFolder: true });
    expect(report.added).toHaveLength(1);
    expect(report.motionFailed).toEqual([]);
    expectSameMeasures(stored(library, report.added).motion, WING_IMU);
  });

  it('(d) une fiche de l\'ancienne application posée dans la mémoire reste en lecture seule, jamais réécrite', async () => {
    const file = '2026-06-01_12-00-00_wingfoil.gpx';
    const json = `sessions/${file.replace(/\.gpx$/, '.json')}`;
    files.set(`sessions/${file}`, LEGACY_WING_GPX);
    files.set(json, LEGACY_WING_RECORD);
    const library = await openFresh();
    const session = library.readLibraryState().sessions.find((s) => s.file === file);
    expect(session).toBeDefined();
    expect(session?.readOnly).toBe(true);
    expect(files.get(json)).toBe(LEGACY_WING_RECORD);
    expect(log.filter((line) => line === `write ${json}`)).toEqual([]);
  });
});
