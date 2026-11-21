import { describe, expect, it } from 'vitest';
import { MEMORY_VERSION, markerText } from './folderLayout';
import {
  SYNC_BASE_FORMAT, SYNC_BASE_VERSION, emptySyncBase, isSyncId, markerTextWithId, markerTextWithSync, parseSyncBase, readMarkerId,
  readMarkerSync, serializeSyncBase,
  syncAncestorPath, syncBaseLine, syncBasePath, syncRefusal, withSyncDone, withSyncHeld, withSyncLine, withoutSyncLine,
  type SyncBaseSession, type SyncFiles,
} from './syncBase';

const files = (name: string, mtimeMs = 1000): SyncFiles => ({
  gpx: { name: `${name}.gpx`, size: 900, mtimeMs },
  record: { name: `${name}.json`, size: 300, mtimeMs: mtimeMs + 1 },
  imu: null,
});

const line = (startMs: number): SyncBaseSession => ({ startMs, computer: files(`pc-${startMs}`), phone: files(`tel-${startMs}`, 5000) });

const base = () => ({ ...emptySyncBase('ordinateur-0001', 'telephone-0001', 'Documents/Gtracker'), sessions: [line(10), line(20)] });

describe('identifiant du dossier dans son marqueur', () => {
  it('un marqueur tel que l’application l’écrit n’a pas d’identifiant', () => {
    expect(readMarkerId(markerText())).toBeNull();
    expect(readMarkerId(null)).toBeNull();
  });

  it('l’identifiant s’ajoute sans rien retirer du marqueur, champs inconnus compris', () => {
    const text = markerTextWithId(JSON.stringify({ format: 'gtracker-memoire', version: 1, synchro: 123, futur: { a: 1 } }), 'abcdef-123456');
    expect(JSON.parse(text as string)).toEqual({ format: 'gtracker-memoire', version: 1, synchro: 123, futur: { a: 1 }, id: 'abcdef-123456' });
    expect(readMarkerId(text)).toBe('abcdef-123456');
  });

  it('un texte qui n’est pas un marqueur n’en devient pas un', () => {
    expect(markerTextWithId(null, 'abcdef-123456')).toBeNull();
    expect(markerTextWithId('{"format":"autre","version":1}', 'abcdef-123456')).toBeNull();
    expect(markerTextWithId('pas du json', 'abcdef-123456')).toBeNull();
  });

  it('l’instant d’une synchronisation s’ajoute sans rien retirer, et change toujours', () => {
    const before = JSON.stringify({ format: 'gtracker-memoire', version: 1, id: 'abcdef-123456', futur: [1, 2] });
    expect(readMarkerSync(before)).toBeNull();
    const text = markerTextWithSync(before, 5000);
    expect(JSON.parse(text as string)).toEqual({ format: 'gtracker-memoire', version: 1, id: 'abcdef-123456', futur: [1, 2], synchro: 5000 });
    expect(readMarkerSync(text)).toBe(5000);
    expect(readMarkerId(text)).toBe('abcdef-123456');
    // Même milliseconde qu'à la synchronisation précédente : l'instant change quand même.
    expect(readMarkerSync(markerTextWithSync(text, 5000))).toBe(5001);
    expect(readMarkerSync(markerTextWithSync(text, 9000))).toBe(9000);
  });

  it('un marqueur d’une version plus récente, ou qui n’en est pas un, ne reçoit pas d’instant', () => {
    expect(markerTextWithSync(JSON.stringify({ format: 'gtracker-memoire', version: MEMORY_VERSION + 1, id: 'abcdef-123456' }), 5000)).toBeNull();
    expect(markerTextWithSync(null, 5000)).toBeNull();
    expect(markerTextWithSync('{"format":"autre","version":1}', 5000)).toBeNull();
    expect(readMarkerSync('{"format":"autre","version":1,"synchro":5}')).toBeNull();
    expect(readMarkerSync(JSON.stringify({ format: 'gtracker-memoire', version: 1, synchro: 'hier' }))).toBeNull();
  });

  it('un identifiant qui ne peut pas nommer un fichier est tenu pour absent', () => {
    expect(isSyncId('../ailleurs')).toBe(false);
    expect(isSyncId('court')).toBe(false);
    expect(isSyncId(42)).toBe(false);
    expect(isSyncId('3f2c9c1e-8a51-4a0e-9b7e-0d6c2b1a4f55')).toBe(true);
    expect(readMarkerId(JSON.stringify({ format: 'gtracker-memoire', version: 1, id: '../ailleurs' }))).toBeNull();
  });
});

describe('refus avant tout listage', () => {
  const future = JSON.stringify({ format: 'gtracker-memoire', version: MEMORY_VERSION + 1 });

  it('deux dossiers mémoire de cette version se synchronisent', () => {
    expect(syncRefusal(markerText(), markerText())).toBeNull();
  });

  it('un dossier sans marqueur n’est pas un dossier mémoire', () => {
    expect(syncRefusal(markerText(), null)).toBe('phoneNoMarker');
    expect(syncRefusal(null, markerText())).toBe('computerNoMarker');
    expect(syncRefusal(markerText(), '{"format":"autre"}')).toBe('phoneNoMarker');
  });

  it('un dossier d’une version plus récente n’est pas réécrit', () => {
    expect(syncRefusal(markerText(), future)).toBe('phoneNewer');
    expect(syncRefusal(future, markerText())).toBe('computerNewer');
  });
});

describe('lecture et écriture de la base', () => {
  it('se relit telle qu’elle a été écrite', () => {
    const written = { ...base(), syncedAtMs: 123, removed: [5] };
    const text = serializeSyncBase(written);
    expect(JSON.parse(text)).toMatchObject({ format: SYNC_BASE_FORMAT, version: SYNC_BASE_VERSION });
    expect(parseSyncBase(text)).toEqual({ state: 'ok', base: written });
  });

  it('absente, illisible, d’un autre format, ou d’une version plus récente', () => {
    expect(parseSyncBase(null)).toEqual({ state: 'absent' });
    expect(parseSyncBase('{ coupé')).toEqual({ state: 'unreadable' });
    expect(parseSyncBase(JSON.stringify({ format: 'gtracker-corbeille', version: 1 }))).toEqual({ state: 'unreadable' });
    expect(parseSyncBase(JSON.stringify({ ...JSON.parse(serializeSyncBase(base())), version: SYNC_BASE_VERSION + 1 }))).toEqual({ state: 'newer' });
    expect(parseSyncBase(JSON.stringify({ ...JSON.parse(serializeSyncBase(base())), phoneId: '../x' }))).toEqual({ state: 'unreadable' });
  });

  it('une ligne mal formée ou en double est écartée seule : sa session redevient une première rencontre', () => {
    const raw = JSON.parse(serializeSyncBase(base()));
    raw.sessions = [raw.sessions[0], { startMs: 20, computer: { gpx: { name: 'x.gpx' } }, phone: null }, raw.sessions[0], 'n’importe quoi'];
    raw.removed = [7, 'x', 10, 7];
    const read = parseSyncBase(JSON.stringify(raw));
    expect(read.state === 'ok' && read.base.sessions.map((s) => s.startMs)).toEqual([10]);
    // Une suppression retenue pour une session encore en ligne ne vaut rien.
    expect(read.state === 'ok' && read.base.removed).toEqual([7]);
  });

  it('une base sans date ni chemin se lit', () => {
    const raw = JSON.parse(serializeSyncBase(base()));
    delete raw.phonePath;
    delete raw.syncedAtMs;
    delete raw.removed;
    const read = parseSyncBase(JSON.stringify(raw));
    expect(read.state === 'ok' && read.base).toMatchObject({ phonePath: null, syncedAtMs: null, removed: [], held: [] });
  });

  it('une session laissée sur le téléphone se relit, sauf si elle a retrouvé sa ligne', () => {
    const raw = JSON.parse(serializeSyncBase(base()));
    raw.held = [7, 10, 'x', 7];
    raw.removed = [7, 8];
    const read = parseSyncBase(JSON.stringify(raw));
    expect(read.state === 'ok' && read.base).toMatchObject({ held: [7], removed: [8] });
  });
});

describe('lignes de la base', () => {
  it('poser une ligne remplace celle de la même session et lève sa suppression retenue', () => {
    const next = withSyncLine({ ...base(), removed: [15, 30] }, line(15));
    expect(next.sessions.map((s) => s.startMs)).toEqual([10, 15, 20]);
    expect(next.removed).toEqual([30]);
    const again = withSyncLine(next, { ...line(15), computer: files('autre') });
    expect(again.sessions).toHaveLength(3);
    expect(syncBaseLine(again, 15)?.computer.gpx.name).toBe('autre.gpx');
  });

  it('oublier une ligne retient la suppression, une seule fois', () => {
    const next = withoutSyncLine(withoutSyncLine(base(), 10), 10);
    expect(next.sessions.map((s) => s.startMs)).toEqual([20]);
    expect(next.removed).toEqual([10]);
    expect(syncBaseLine(next, 10)).toBeNull();
    expect(syncBaseLine(null, 10)).toBeNull();
  });

  it('en fin de synchronisation, seules restent retenues les suppressions que la corbeille tient encore', () => {
    const next = withSyncDone({ ...base(), removed: [1, 2, 3], held: [4] }, 999, new Set([2]));
    expect(next.syncedAtMs).toBe(999);
    expect(next.removed).toEqual([2]);
    // Une session laissée sur le téléphone le reste quand la corbeille l'a purgée : c'est pour cela qu'on s'en souvient.
    expect(next.held).toEqual([4]);
  });

  it('une session laissée sur le téléphone est retenue une fois, et oubliée quand elle retrouve une ligne ou disparaît', () => {
    const held = withSyncHeld(withSyncHeld({ ...base(), removed: [15] }, 15), 15);
    expect(held).toMatchObject({ held: [15], removed: [] });
    expect(withSyncLine(held, line(15)).held).toEqual([]);
    expect(withoutSyncLine(held, 15)).toMatchObject({ held: [], removed: [15] });
  });

  it('chemins de la base et des fiches gardées, par téléphone', () => {
    expect(syncBasePath('telephone-0001')).toBe('synchro/telephone-0001.json');
    expect(syncAncestorPath('telephone-0001', 1234, 'computer')).toBe('synchro/telephone-0001/fiches/1234-ordinateur.json');
    expect(syncAncestorPath('telephone-0001', 1234, 'phone')).toBe('synchro/telephone-0001/fiches/1234-telephone.json');
  });
});
