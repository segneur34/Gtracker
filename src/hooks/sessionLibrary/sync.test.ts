import { describe, expect, it } from 'vitest';
import { sessionPath } from '../../library/folderLayout';
import { imuFileName, recordFileName, type StoredSessionNotes } from '../../library/record';
import { parseSyncBase, readMarkerId, syncBasePath } from '../../library/syncBase';
import { TRASH_INDEX_PATH, parseTrashIndex, sessionRestorePlan, sessionTrashEntries, shownTrashEntries, type TrashEntry } from '../../library/trash';
import { copyFromTrash, dropTrashEntries, emptyTrash, stashInTrash } from '../../library/trashFolder';
import type { MemoryFolder } from '../../platform/memoryFolder';
import {
  SyncCutError, deleteSyncSession, editSyncRecord, putSyncSession, readSyncRecord, syncGpxName, syncMemoryFolder, syncSessionFiles,
  type SyncFolder,
} from '../../test/syncFolder.fixture';
import { SYNC_RUNNING_PATH, executeSync, type SyncOptions, type SyncOutcome } from './sync';

const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const at = (k: number): number => T0 + k * HOUR;
const fileOf = (k: number): string => syncGpxName(at(k));

const notes = (patch: Partial<StoredSessionNotes>): StoredSessionNotes => ({
  foil: '', mast: '', wing: '', gear1: '', gear2: '', conditions: '', gear: null, comment: '', windLevel: null, waterState: null, rating: null, savedAt: 100, ...patch,
});

interface Pair {
  computer: SyncFolder;
  phone: SyncFolder;
}

/** `cable` : le téléphone répond comme par le câble, `stat` et lectures d'après son dernier listage (par défaut). */
const pairOf = (cable = true): Pair => ({
  computer: syncMemoryFolder({ clockMs: 1_800_000_000_000 }), phone: syncMemoryFolder({ phone: true, clockMs: 1_800_000_417_000, cable }),
});

let ids = 0;
const run = (pair: Pair, options: SyncOptions = {}, phone: MemoryFolder = pair.phone, computer: MemoryFolder = pair.computer): Promise<SyncOutcome> =>
  executeSync(computer, phone, { now: () => NOW, newFolderId: () => `dossier-sync-${String(++ids).padStart(4, '0')}`, ...options });

const putBoth = (pair: Pair, k: number, imuBytes?: number): void => {
  putSyncSession(pair.computer, at(k), { imuBytes });
  putSyncSession(pair.phone, at(k), { imuBytes });
};

const syncedPair = async (count: number): Promise<Pair> => {
  const pair = pairOf();
  for (let k = 0; k < count; k++) putBoth(pair, k);
  expect((await run(pair)).complete).toBe(true);
  return pair;
};

const trashOf = (pair: Pair): TrashEntry[] => parseTrashIndex(pair.computer.text(TRASH_INDEX_PATH)).entries;

/** Supprime une session sur l'ordinateur comme l'application : copie à la corbeille, puis retrait, GPX d'abord. */
const trashOnComputer = async (pair: Pair, k: number): Promise<void> => {
  const names = [fileOf(k), recordFileName(fileOf(k)), imuFileName(fileOf(k))].map(sessionPath);
  await stashInTrash(pair.computer, { kind: 'session', paths: names, main: names[0], startMs: at(k), name: `session ${k}` }, NOW - 1000);
  for (const path of names) pair.computer.drop(path);
};

/** « Restaurer » comme Réglages › Mémoire : les fichiers reviennent dans `sessions/`, puis les entrées quittent la corbeille. */
const restoreOnComputer = async (pair: Pair, k: number): Promise<void> => {
  const entries = sessionTrashEntries(trashOf(pair), at(k));
  const plan = sessionRestorePlan(entries[0], await syncSessionFiles(pair.computer));
  await copyFromTrash(pair.computer, plan.copies);
  await dropTrashEntries(pair.computer, entries.map((e) => e.dir));
};

const baseOf = (pair: Pair) => {
  const id = readMarkerId(pair.phone.text('gtracker.json'));
  const read = id ? parseSyncBase(pair.computer.text(syncBasePath(id))) : null;
  return read?.state === 'ok' ? read.base : null;
};

/** Chaque GPX que l'application d'un côté verrait a sa fiche : rien qui recevrait une fiche neuve. */
const everyGpxHasRecord = async (folder: SyncFolder): Promise<void> => {
  for (const gpx of await syncSessionFiles(folder)) expect(await folder.readText(sessionPath(recordFileName(gpx))), gpx).not.toBeNull();
};

describe('exécutant de la synchronisation', () => {
  it('première rencontre : chaque côté reçoit ce qui lui manque, rien n’est supprimé, la base et les identifiants sont posés', async () => {
    const pair = pairOf();
    putSyncSession(pair.computer, at(0), { imuBytes: 40 });
    putSyncSession(pair.phone, at(1), { hz: 5 });
    putBoth(pair, 2);
    const outcome = await run(pair);
    expect(outcome).toMatchObject({ refusal: null, first: 'noComputerId', complete: true, interrupted: false, linkLost: null, error: null });
    for (const side of [pair.computer, pair.phone]) expect(await syncSessionFiles(side)).toEqual([fileOf(0), fileOf(1), fileOf(2)]);
    expect(pair.phone.text(sessionPath(imuFileName(fileOf(0))))).not.toBeNull();
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toEqual([at(0), at(1), at(2)]);
    expect(pair.computer.text(SYNC_RUNNING_PATH)).toBeNull();
    // Rien de plus à faire.
    const again = await run(pair);
    expect(again.plan?.items.flatMap((i) => i.ops)).toEqual([]);
  });

  it('refuse un ordinateur sans corbeille ou dont la corbeille ne se lit pas, sans rien écrire', async () => {
    const pair = pairOf();
    putSyncSession(pair.computer, at(0));
    const browser = { ...pair.computer, kind: 'browser' as const };
    expect((await run(pair, {}, pair.phone, browser)).refusal).toBe('noTrash');
    pair.computer.put(TRASH_INDEX_PATH, '{abîmé');
    expect((await run(pair)).refusal).toBe('trashLocked');
    expect(await syncSessionFiles(pair.phone)).toEqual([]);
    expect(pair.phone.steps()).toBe(0);
  });

  it('supprimée sur le téléphone : la copie de l’ordinateur passe à sa corbeille, d’origine « ordinateur »', async () => {
    const pair = await syncedPair(3);
    deleteSyncSession(pair.phone, fileOf(1));
    // Une sur trois : plus du quart, le garde-fou retient la suppression tant qu'elle n'est pas confirmée.
    const held = await run(pair);
    expect(held).toMatchObject({ deletions: 'awaitingConfirmation', complete: false });
    expect(held.withheldDeletions.map((i) => i.startMs)).toEqual([at(1)]);
    // « Sans rien supprimer » demandé : écartées, pas en attente de confirmation.
    expect(await run(pair, { withoutDeletions: true })).toMatchObject({ deletions: 'excluded', complete: false });
    expect(await syncSessionFiles(pair.computer)).toEqual([fileOf(0), fileOf(1), fileOf(2)]);
    const outcome = await run(pair, { confirmDeletions: true });
    expect(outcome.complete).toBe(true);
    expect(await syncSessionFiles(pair.computer)).toEqual([fileOf(0), fileOf(2)]);
    expect(trashOf(pair).map((e) => [e.startMs, e.origin, e.main])).toEqual([[at(1), 'ordinateur', fileOf(1)]]);
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toEqual([at(0), at(2)]);
  });

  it('restaurée de la corbeille : revient sur le téléphone ; restaurée avant toute synchronisation : rien ne bouge', async () => {
    const pair = await syncedPair(5);
    await trashOnComputer(pair, 1);
    expect((await run(pair)).complete).toBe(true);
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(1));
    await restoreOnComputer(pair, 1);
    await run(pair);
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(1));
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toContain(at(1));

    await trashOnComputer(pair, 2);
    await restoreOnComputer(pair, 2);
    const steps = pair.phone.steps();
    const quiet = await run(pair);
    expect(pair.phone.steps()).toBe(steps);
    expect(quiet.plan?.items.flatMap((i) => i.ops)).toEqual([]);
    expect(trashOf(pair)).toEqual([]);
  });

  it('réimportée après suppression : revient des deux côtés', async () => {
    const pair = await syncedPair(5);
    await trashOnComputer(pair, 3);
    await run(pair);
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(3));
    putSyncSession(pair.computer, at(3));
    await run(pair);
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(3));
    expect(await syncSessionFiles(pair.computer)).toContain(fileOf(3));
  });

  it('second téléphone : une suppression faite sur le premier atteint le second, par la corbeille de l’ordinateur', async () => {
    const pair = await syncedPair(5);
    const second = syncMemoryFolder({ phone: true, clockMs: 1_800_000_900_000 });
    expect((await run(pair, {}, second)).complete).toBe(true);
    expect(await syncSessionFiles(second)).toEqual(await syncSessionFiles(pair.phone));
    deleteSyncSession(pair.phone, fileOf(2));
    await run(pair);
    const outcome = await run(pair, {}, second);
    expect(outcome.done.find((i) => i.startMs === at(2))?.ops).toMatchObject([{ kind: 'removeFromPhone', keep: 'none' }]);
    expect(await syncSessionFiles(second)).not.toContain(fileOf(2));
    expect(trashOf(pair).map((e) => e.origin)).toEqual(['ordinateur']);
  });

  it('un fichier du téléphone qui change entre le plan et le retrait : la session reste, puis part avec sa fiche gardée', async () => {
    const pair = await syncedPair(5);
    await trashOnComputer(pair, 1);
    let lists = 0;
    const changing: MemoryFolder = {
      ...pair.phone,
      list: async (dir) => {
        const entries = await pair.phone.list(dir);
        // Juste après le listage du plan, le téléphone réécrit la fiche (l’application y était ouverte).
        if (dir === 'sessions' && ++lists === 1) editSyncRecord(pair.phone, fileOf(1), (r) => ({ ...r, notes: notes({ comment: 'écrit pendant la synchronisation' }) }));
        return entries;
      },
    };
    const outcome = await run(pair, {}, changing);
    expect(outcome.skipped.map((i) => i.startMs)).toEqual([at(1)]);
    expect(outcome.complete).toBe(false);
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(1));
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toContain(at(1));
    // La fois suivante, la fiche changée est gardée avant le retrait.
    await run(pair);
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(1));
    const kept = trashOf(pair).filter((e) => e.startMs === at(1));
    const texts = kept.map((e) => pair.computer.text(`corbeille/${e.dir}/${recordFileName(e.main)}`) ?? '');
    expect(texts.some((text) => text.includes('écrit pendant la synchronisation'))).toBe(true);
  });

  it('listage en retard : une session que le téléphone liste absente mais qui y est encore n’est pas mise à la corbeille', async () => {
    // Un canal qui liste en retard mais dont `stat` voit juste (transfert de fichiers) ; le câble, lui, ne liste pas en retard.
    const pair = pairOf(false);
    for (let k = 0; k < 5; k++) putBoth(pair, k);
    await run(pair);
    pair.phone.lag([`sessions/${fileOf(2)}`, `sessions/${recordFileName(fileOf(2))}`]);
    const outcome = await run(pair);
    expect(outcome.skipped.map((i) => i.startMs)).toEqual([at(2)]);
    expect(await syncSessionFiles(pair.computer)).toContain(fileOf(2));
    expect(trashOf(pair)).toEqual([]);
  });

  it('keep « all » : la copie du téléphone est rangée à part de celle de l’ordinateur, sous le même nom, d’origine « telephone »', async () => {
    const pair = await syncedPair(8);
    // Le même champ changé des deux côtés : l’ordinateur avant de supprimer, le téléphone après.
    editSyncRecord(pair.computer, fileOf(1), (r) => ({ ...r, name: 'Version ordinateur' }));
    await trashOnComputer(pair, 1);
    editSyncRecord(pair.phone, fileOf(1), (r) => ({ ...r, name: 'Version téléphone' }));
    // La corbeille vidée à la main entre-temps pour la session 3 : elle ne tient plus rien d’elle.
    await trashOnComputer(pair, 3);
    await dropTrashEntries(pair.computer, sessionTrashEntries(trashOf(pair), at(3)).map((e) => e.dir));
    const outcome = await run(pair);
    expect(outcome.done.find((i) => i.startMs === at(3))?.ops).toMatchObject([{ kind: 'removeFromPhone', keep: 'all' }]);
    expect(outcome.keptFromPhone.sort()).toEqual([at(1), at(3)]);
    const one = sessionTrashEntries(trashOf(pair), at(1));
    expect(one.map((e) => e.origin).sort()).toEqual(['ordinateur', 'telephone']);
    expect(new Set(one.map((e) => e.dir)).size).toBe(2);
    expect(one.every((e) => e.main === fileOf(1))).toBe(true);
    const nameIn = (e: TrashEntry) => JSON.parse(pair.computer.text(`corbeille/${e.dir}/${recordFileName(e.main)}`) ?? '{}').name;
    expect(one.map(nameIn).sort()).toEqual(['Version ordinateur', 'Version téléphone']);
    expect(sessionTrashEntries(trashOf(pair), at(3)).map((e) => [e.origin, e.files.length])).toEqual([['telephone', 2]]);
    expect(await syncSessionFiles(pair.phone)).toEqual([0, 2, 4, 5, 6, 7].map(fileOf));
  });

  it('keep « record » : la fiche du téléphone est fondue dans celle de la corbeille', async () => {
    const pair = await syncedPair(5);
    await trashOnComputer(pair, 1);
    editSyncRecord(pair.phone, fileOf(1), (r) => ({ ...r, notes: notes({ comment: 'ajouté au téléphone' }) }));
    const outcome = await run(pair);
    expect(outcome.done.find((i) => i.startMs === at(1))?.ops).toMatchObject([{ kind: 'removeFromPhone', keep: 'record' }]);
    const [entry] = sessionTrashEntries(trashOf(pair), at(1));
    const text = pair.computer.text(`corbeille/${entry.dir}/${recordFileName(entry.main)}`) ?? '';
    expect(text).toContain('ajouté au téléphone');
    expect(entry.files.find((f) => f.name.endsWith('.json'))?.size).toBe(new TextEncoder().encode(text).length);
    expect(outcome.keptFromPhone).toEqual([]);
  });

  it('une session qui échoue au milieu sur l’ordinateur garde sa ligne de base intacte ; les autres continuent', async () => {
    const pair = await syncedPair(4);
    editSyncRecord(pair.computer, fileOf(1), (r) => ({ ...r, name: 'Ordinateur' }));
    editSyncRecord(pair.phone, fileOf(1), (r) => ({ ...r, notes: notes({ comment: 'téléphone' }) }));
    putSyncSession(pair.computer, at(6));
    const before = baseOf(pair)?.sessions.find((s) => s.startMs === at(1));
    const failing: MemoryFolder = {
      ...pair.computer,
      writeBytes: async (path, bytes) => {
        if (path === sessionPath(recordFileName(fileOf(1)))) throw new Error('disque plein');
        return pair.computer.writeBytes(path, bytes);
      },
    };
    const outcome = await run(pair, {}, pair.phone, failing);
    expect(outcome.failed.map((f) => [f.item.startMs, f.detail])).toEqual([[at(1), 'disque plein']]);
    expect(outcome.complete).toBe(false);
    expect(baseOf(pair)?.sessions.find((s) => s.startMs === at(1))).toEqual(before);
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(6));
    // La fois suivante, sans panne, tout finit d’accord.
    expect((await run(pair)).complete).toBe(true);
    expect(readSyncRecord(pair.computer, fileOf(1))?.notes?.comment).toBe('téléphone');
    expect(readSyncRecord(pair.phone, fileOf(1))?.name).toBe('Ordinateur');
  });

  it('supprimée sur l’ordinateur avant toute synchronisation : laissée sur le téléphone, retenue par la base, jamais ramenée', async () => {
    const pair = pairOf();
    for (let k = 0; k < 5; k++) putBoth(pair, k);
    await trashOnComputer(pair, 2);
    const outcome = await run(pair);
    expect(outcome.done.find((i) => i.startMs === at(2))).toMatchObject({ left: 'inTrash', base: { kind: 'hold' }, ops: [] });
    expect(baseOf(pair)?.held).toEqual([at(2)]);
    // La corbeille purgée ensuite ne la fait pas revenir sur l'ordinateur.
    await dropTrashEntries(pair.computer, trashOf(pair).map((e) => e.dir));
    await run(pair);
    expect(await syncSessionFiles(pair.computer)).not.toContain(fileOf(2));
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(2));
  });

  it('« sans rien supprimer » : aucun retrait d’aucun côté, la base garde leurs lignes, les suppressions reviennent ensuite', async () => {
    const pair = await syncedPair(8);
    deleteSyncSession(pair.phone, fileOf(1));
    await trashOnComputer(pair, 2);
    putSyncSession(pair.phone, at(9));
    const steps = pair.phone.steps();
    const outcome = await run(pair, { withoutDeletions: true });
    expect(outcome).toMatchObject({ deletions: 'excluded', complete: false });
    expect(outcome.withheldDeletions.map((i) => i.startMs)).toEqual([at(1), at(2)]);
    expect(await syncSessionFiles(pair.computer)).toEqual([0, 1, 3, 4, 5, 6, 7, 9].map(fileOf));
    expect(await syncSessionFiles(pair.phone)).toEqual([0, 2, 3, 4, 5, 6, 7, 9].map(fileOf));
    expect(pair.phone.steps()).toBe(steps);
    expect(trashOf(pair).map((e) => e.startMs)).toEqual([at(2)]);
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9].map(at));
    const after = await run(pair);
    expect(after).toMatchObject({ deletions: 'made', complete: true });
    expect(after.done.filter((i) => i.ops.length > 0).map((i) => i.case)).toEqual(['deletedOnPhone', 'deletedOnComputer']);
    expect(await syncSessionFiles(pair.phone)).toEqual(await syncSessionFiles(pair.computer));
  });

  it('téléphone qu’on ne peut pas écrire : rien n’y est écrit ni retiré, la base reste juste, la synchronisation entière finit le travail', async () => {
    const pair = await syncedPair(8);
    putSyncSession(pair.computer, at(10));
    putSyncSession(pair.phone, at(11));
    editSyncRecord(pair.phone, fileOf(3), (r) => ({ ...r, name: 'Du téléphone' }));
    editSyncRecord(pair.computer, fileOf(4), (r) => ({ ...r, name: 'De l’ordinateur' }));
    await trashOnComputer(pair, 5);
    const steps = pair.phone.steps();
    const half = await run(pair, { phoneWritable: false });
    expect(half).toMatchObject({ phoneWritable: false, complete: false });
    expect(pair.phone.steps()).toBe(steps);
    expect(await syncSessionFiles(pair.computer)).toContain(fileOf(11));
    expect(readSyncRecord(pair.computer, fileOf(3))?.name).toBe('Du téléphone');
    expect(half.withheldDeletions.map((i) => i.startMs)).toEqual([at(5)]);
    const lines = baseOf(pair)?.sessions.map((s) => s.startMs);
    expect(lines).toContain(at(11));
    expect(lines).toContain(at(5));
    expect(lines).not.toContain(at(10));
    const whole = await run(pair);
    expect(whole.complete).toBe(true);
    expect(await syncSessionFiles(pair.phone)).toEqual(await syncSessionFiles(pair.computer));
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(5));
    expect(readSyncRecord(pair.phone, fileOf(4))?.name).toBe('De l’ordinateur');
  });

  it('la corbeille vidée entre le plan et le retrait : la copie du téléphone y est rangée avant de partir', async () => {
    const pair = await syncedPair(8);
    await trashOnComputer(pair, 1);
    let lists = 0;
    const emptying: MemoryFolder = {
      ...pair.phone,
      list: async (dir) => {
        const entries = await pair.phone.list(dir);
        // Le deuxième listage est celui que l'exécutant refait juste avant le retrait, le plan étant fait.
        if (dir === 'sessions' && ++lists === 2) await emptyTrash(pair.computer);
        return entries;
      },
    };
    const outcome = await run(pair, {}, emptying);
    expect(outcome.done.find((i) => i.startMs === at(1))?.ops).toMatchObject([{ kind: 'removeFromPhone', keep: 'none' }]);
    expect(outcome.keptFromPhone).toEqual([at(1)]);
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(1));
    expect(trashOf(pair).map((e) => [e.startMs, e.origin, e.files.length])).toEqual([[at(1), 'telephone', 2]]);
  });

  it('la corbeille qui ne s’écrit pas avant le premier retrait : rien ne part du téléphone', async () => {
    const pair = await syncedPair(8);
    await trashOnComputer(pair, 1);
    await dropTrashEntries(pair.computer, trashOf(pair).map((e) => e.dir));
    const failing: MemoryFolder = {
      ...pair.computer,
      writeBytes: async (path, bytes) => {
        if (path.startsWith('corbeille/')) throw new Error('disque plein');
        return pair.computer.writeBytes(path, bytes);
      },
    };
    const steps = pair.phone.steps();
    const outcome = await run(pair, {}, pair.phone, failing);
    expect(outcome.failed.map((f) => f.item.startMs)).toEqual([at(1)]);
    expect(pair.phone.steps()).toBe(steps);
    expect(await syncSessionFiles(pair.phone)).toContain(fileOf(1));
    expect(baseOf(pair)?.sessions.map((s) => s.startMs)).toContain(at(1));
  });

  it('des restes sans GPX vont avec l’entrée de la même session sans rien y écraser, sinon dans une entrée de restes cachée', async () => {
    const pair = await syncedPair(8);
    // Une mise à la corbeille coupée après le GPX : la fiche et les capteurs sont restés.
    putSyncSession(pair.computer, at(9), { imuBytes: 12 });
    putSyncSession(pair.phone, at(9), { imuBytes: 12 });
    await run(pair);
    const names = [fileOf(9), recordFileName(fileOf(9)), imuFileName(fileOf(9))].map(sessionPath);
    await stashInTrash(pair.computer, { kind: 'session', paths: names, main: names[0], startMs: at(9), name: 's9' }, NOW - 1000);
    pair.computer.drop(names[0]);
    deleteSyncSession(pair.phone, fileOf(9));
    await run(pair);
    expect(trashOf(pair).filter((e) => e.startMs === at(9)).map((e) => [e.kind, e.files.length])).toEqual([['session', 3]]);
    expect(pair.computer.text(names[1])).toBeNull();
    // Restes d’une autre session, dont la fiche a changé depuis son entrée : rien d’écrasé, une entrée de restes à part.
    await trashOnComputer(pair, 3);
    putSyncSession(pair.computer, at(3), { record: { name: 'Fiche changée depuis' } });
    pair.computer.drop(sessionPath(fileOf(3)));
    await run(pair, { confirmDeletions: true });
    const three = trashOf(pair).filter((e) => e.startMs === at(3));
    expect(three.map((e) => e.kind).sort()).toEqual(['restes', 'session']);
    expect(shownTrashEntries(three).map((e) => e.kind)).toEqual(['session']);
    // La session de la corbeille se restaure telle qu’elle était, sa fiche d’origine comprise.
    await restoreOnComputer(pair, 3);
    expect(readSyncRecord(pair.computer, fileOf(3))?.name).not.toBe('Fiche changée depuis');
  });

  it('liaison perdue : tout s’arrête, le témoin reste, la reprise le dit', async () => {
    const pair = await syncedPair(2);
    putSyncSession(pair.computer, at(5));
    pair.phone.cutAfter(0);
    const cut = await run(pair);
    expect(cut.linkLost).not.toBeNull();
    expect(pair.computer.text(SYNC_RUNNING_PATH)).not.toBeNull();
    pair.phone.cutAfter(null);
    const resumed = await run(pair);
    expect(resumed).toMatchObject({ interrupted: true, complete: true });
    expect(pair.computer.text(SYNC_RUNNING_PATH)).toBeNull();
  });
});

/**
 * Une paire déjà synchronisée, puis : session neuve de chaque côté (5 Hz pour celle du téléphone), fiche changée des
 * deux côtés, supprimée sur le téléphone, supprimée sur l'ordinateur, supprimée sur l'ordinateur et changée sur le
 * téléphone, supprimée sur l'ordinateur puis sortie de la corbeille (sa copie du téléphone y est rangée entière avant
 * son retrait), et supprimée à la main sur l'ordinateur sans sa fiche (des restes sans GPX).
 */
const SCENARIO = [...Array.from({ length: 16 }, (_, k) => k), 20, 21];

const scenario = async (cable = true): Promise<Pair> => {
  const pair = pairOf(cable);
  for (let k = 0; k < 16; k++) putBoth(pair, k, k === 2 || k === 6 ? 30 : undefined);
  await run(pair);
  putSyncSession(pair.computer, at(20), { imuBytes: 25 });
  putSyncSession(pair.phone, at(21), { hz: 5 });
  editSyncRecord(pair.computer, fileOf(2), (r) => ({ ...r, name: 'Nom ordinateur' }));
  editSyncRecord(pair.phone, fileOf(2), (r) => ({ ...r, notes: notes({ comment: 'Note téléphone' }) }));
  deleteSyncSession(pair.phone, fileOf(3));
  await trashOnComputer(pair, 4);
  await trashOnComputer(pair, 5);
  editSyncRecord(pair.phone, fileOf(5), (r) => ({ ...r, notes: notes({ comment: 'Écrit avant le retrait' }) }));
  await trashOnComputer(pair, 6);
  await dropTrashEntries(pair.computer, sessionTrashEntries(trashOf(pair), at(6)).map((e) => e.dir));
  pair.computer.drop(sessionPath(fileOf(8)));
  return pair;
};

interface Picture {
  computer: string[];
  phone: string[];
  records: (string | null)[];
}

const pictureOf = async (pair: Pair): Promise<Picture> => {
  const computer = await syncSessionFiles(pair.computer);
  const phone = await syncSessionFiles(pair.phone);
  const strip = (text: string | null) => (text === null ? null : JSON.stringify({ ...JSON.parse(text), addedAt: undefined }));
  // Lus comme l'application de chaque côté les lit : sur le téléphone, un remplacement resté seul vaut son fichier.
  const records: (string | null)[] = [];
  for (const f of computer) records.push(strip(await pair.computer.readText(sessionPath(recordFileName(f)))));
  for (const f of phone) records.push(strip(await pair.phone.readText(sessionPath(recordFileName(f)))));
  return { computer, phone, records };
};

/** Toutes les identités du scénario sont encore quelque part : d'un côté, ou dans la corbeille de l'ordinateur. */
const nothingLost = async (pair: Pair): Promise<void> => {
  const names = new Set([...(await syncSessionFiles(pair.computer)), ...(await syncSessionFiles(pair.phone))]);
  const trashed = new Set(trashOf(pair).map((e) => e.startMs));
  for (const k of SCENARIO) expect(names.has(fileOf(k)) || trashed.has(at(k)), `session ${k}`).toBe(true);
};

describe('coupure après chaque opération, puis reprise', () => {
  it.each([
    ['phone', true], ['computer', true], ['phone', false],
  ] as const)('coupure du côté %s (câble : %s)', async (side, cable) => {
    const reference = await scenario(cable);
    const first = await run(reference);
    expect(first.complete).toBe(true);
    expect(first.keptFromPhone.sort()).toEqual([at(6), at(8)]);
    const expected = await pictureOf(reference);
    const expectedTrash = new Set(trashOf(reference).map((e) => `${e.startMs}:${e.origin}:${e.kind}`));
    expect(expected.phone).not.toContain(fileOf(4));
    expect(expected.phone).not.toContain(fileOf(6));
    expect(expected.phone).not.toContain(fileOf(8));
    expect(expected.computer).not.toContain(fileOf(3));
    expect(expected.phone).toContain(fileOf(20));
    expect(expected.computer).toContain(fileOf(21));
    // La fiche restée seule sur l'ordinateur n'est pas une session de la corbeille : une entrée de restes.
    expect(trashOf(reference).filter((e) => e.startMs === at(8)).map((e) => [e.origin, e.kind]).sort()).toEqual([['ordinateur', 'restes'], ['telephone', 'session']]);

    let cuts = 0;
    for (let n = 0; n < 600; n++) {
      const pair = await scenario(cable);
      const folder = pair[side];
      folder.cutAfter(n);
      let outcome: SyncOutcome;
      try {
        outcome = await run(pair);
      } catch (err) {
        // L'exécutant ne lève jamais, même quand l'ordinateur ne répond plus.
        expect(err).not.toBeInstanceOf(SyncCutError);
        throw err;
      }
      folder.cutAfter(null);
      // Plus aucune coupure : la synchronisation a tenu dans `n` opérations, toutes les coupures ont été essayées.
      if (outcome.linkLost === null && outcome.failed.length === 0 && outcome.error === null) {
        expect(outcome.complete).toBe(true);
        break;
      }
      cuts += 1;
      await everyGpxHasRecord(pair.computer);
      await everyGpxHasRecord(pair.phone);
      await nothingLost(pair);
      await run(pair);
      const final = await run(pair);
      expect(final.complete, `coupure après ${n}`).toBe(true);
      expect(final.plan?.items.flatMap((i) => i.ops), `coupure après ${n}`).toEqual([]);
      expect(await pictureOf(pair), `coupure après ${n}`).toEqual(expected);
      for (const key of expectedTrash) expect(new Set(trashOf(pair).map((e) => `${e.startMs}:${e.origin}:${e.kind}`)).has(key), `coupure après ${n} : ${key}`).toBe(true);
      await nothingLost(pair);
    }
    expect(cuts).toBeGreaterThan(5);
  });
});
