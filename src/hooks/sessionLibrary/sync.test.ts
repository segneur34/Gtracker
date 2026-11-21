import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../core/appIdentity';
import { sessionPath } from '../../library/folderLayout';
import { learnedPlacesFileText } from '../../library/learnedPlaces';
import type { LearnedPlace } from '../../library/places';
import { restingHrFileText, type StoredRestingResult } from '../../library/restingHrStore';
import { buildSettingsFile, serializeSettingsFile } from '../../library/settingsFile';
import { imuFileName, recordFileName, type StoredSessionNotes } from '../../library/record';
import { parseSyncBase, readMarkerId, syncBasePath } from '../../library/syncBase';
import { describeSync, describeSyncQuestion } from '../../library/syncReport';
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

  it('téléphone qu’on ne peut pas écrire : le garde-fou ignore les retraits du téléphone, les mises à la corbeille se font', async () => {
    const pair = await syncedPair(20);
    for (let k = 0; k < 12; k++) await trashOnComputer(pair, k);
    deleteSyncSession(pair.phone, fileOf(15));
    const steps = pair.phone.steps();
    const half = await run(pair, { phoneWritable: false });
    expect(half).toMatchObject({ deletions: 'made', withheldDeletions: [] });
    expect(describeSyncQuestion(half)).toBeNull();
    expect(pair.phone.steps()).toBe(steps);
    expect(await syncSessionFiles(pair.computer)).not.toContain(fileOf(15));
    expect(trashOf(pair).some((e) => e.startMs === at(15))).toBe(true);
    expect(half.withheldForPhone).toHaveLength(12);
    expect(describeSync(half).paragraphs).toContain('12 changements attendent le câble ou la mise à jour du téléphone.');
    // Par le câble, les douze retraits du téléphone dépassent le garde-fou.
    const whole = await run(pair);
    expect(whole).toMatchObject({ deletions: 'awaitingConfirmation' });
    expect(whole.withheldDeletions).toHaveLength(12);
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
    expect(half.withheldDeletions).toEqual([]);
    expect(half.withheldForPhone.map((i) => i.startMs)).toContain(at(5));
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

describe('ce que la couche du bouton reçoit', () => {
  it('copie de sécurité : appelée à la première rencontre d’un téléphone qu’on écrit, avant toute écriture, et seulement là', async () => {
    const pair = pairOf();
    putSyncSession(pair.phone, at(1));
    const calls: string[] = [];
    const outcome = await run(pair, {
      beforeWrites: async (first) => {
        calls.push(`copie ${first} ${pair.computer.text(SYNC_RUNNING_PATH) === null && readMarkerId(pair.phone.text('gtracker.json')) === null}`);
        return 'C:\\Documents\\Gtracker-copies\\2026-11-21 12-00-00';
      },
    });
    expect(calls).toEqual(['copie noComputerId true']);
    expect(outcome).toMatchObject({ complete: true, safetyCopy: 'C:\\Documents\\Gtracker-copies\\2026-11-21 12-00-00' });
    // Paire suivie : plus de copie.
    expect((await run(pair, { beforeWrites: async () => (calls.push('encore'), null) })).safetyCopy).toBeNull();
    expect(calls).toHaveLength(1);
    // Téléphone qu'on ne peut pas écrire : pas de copie, même à une première rencontre.
    const lone = pairOf();
    putSyncSession(lone.phone, at(1));
    await run(lone, { phoneWritable: false, beforeWrites: async () => (calls.push('sans écriture'), null) });
    expect(calls).toHaveLength(1);
  });

  it('copie de sécurité en échec : refus, rien n’est écrit d’aucun côté', async () => {
    const pair = pairOf();
    putSyncSession(pair.computer, at(0));
    putSyncSession(pair.phone, at(1));
    const outcome = await run(pair, { beforeWrites: async () => Promise.reject(new Error('disque plein')) });
    expect(outcome).toMatchObject({ refusal: 'safetyCopy', error: 'disque plein', first: 'noComputerId', complete: false });
    expect(pair.phone.steps()).toBe(0);
    expect(pair.computer.text(SYNC_RUNNING_PATH)).toBeNull();
    expect(readMarkerId(pair.computer.text('gtracker.json'))).toBeNull();
    expect(await syncSessionFiles(pair.computer)).toEqual([fileOf(0)]);
  });

  it('le plan est annoncé avant la première copie ; l’avancement compte les fichiers jusqu’au total', async () => {
    const pair = pairOf();
    putSyncSession(pair.computer, at(0), { imuBytes: 40 });
    putSyncSession(pair.phone, at(1));
    const seen: string[] = [];
    await run(pair, {
      onPlanned: (plan, first) => seen.push(`plan ${plan.items.length} ${first} ${pair.phone.text(sessionPath(fileOf(0))) === null ? 'rien de copié' : 'déjà copié'}`),
      onProgress: (done, total) => seen.push(`${done}/${total}`),
    });
    // GPX, fiche et capteurs vers le téléphone ; GPX et fiche vers l'ordinateur.
    expect(seen).toEqual(['plan 2 noComputerId rien de copié', '0/5', '3/5', '5/5', '5/5']);
  });

  it('session de la corbeille encore sur le téléphone : la première passe la laisse et la question se pose ; « Retirer du téléphone » la retire', async () => {
    const pair = pairOf();
    for (let k = 0; k < 5; k++) putBoth(pair, k);
    await trashOnComputer(pair, 2);
    const first = await run(pair);
    const question = describeSyncQuestion(first);
    expect(question).toMatchObject({ kind: 'inTrash', count: 1, sessions: [{ startMs: at(2), side: 'phone', file: fileOf(2) }] });
    // « Les laisser » : rien ne change, la question revient.
    expect(describeSyncQuestion(await run(pair))?.kind).toBe('inTrash');
    const second = await run(pair, { heldOnPhone: 'remove' });
    expect(second.done.find((i) => i.startMs === at(2))?.case).toBe('deletedOnComputer');
    expect(await syncSessionFiles(pair.phone)).not.toContain(fileOf(2));
    expect(trashOf(pair).some((e) => e.startMs === at(2))).toBe(true);
    expect(describeSyncQuestion(second)).toBeNull();
    expect(describeSync(second).paragraphs).toContain("1 session supprimée sur l'ordinateur : retirée du téléphone.");
  });

  it('téléphone qu’on ne peut pas écrire : pas de question sur la corbeille, ce qui l’attend est dit', async () => {
    const pair = pairOf();
    for (let k = 0; k < 5; k++) putBoth(pair, k);
    await trashOnComputer(pair, 2);
    putSyncSession(pair.computer, at(7));
    const half = await run(pair, { phoneWritable: false });
    expect(describeSyncQuestion(half)).toBeNull();
    expect(half.withheldForPhone.map((i) => i.startMs)).toEqual([at(7)]);
    expect(describeSync(half, 'sansFil').paragraphs).toContain('1 changement attend le câble ou la mise à jour du téléphone.');
  });
});

const PC_ID = 'appareil-ordinateur';
const TEL_ID = 'appareil-telephone';

/** Texte d'un fichier de réglages écrit par l'appareil `id` à l'instant `savedAt`. */
const settingsText = (id: string, name: string, savedAt: number): string =>
  serializeSettingsFile(buildSettingsFile({ [STORAGE_KEYS.sportSettings]: { activities: [] } }, savedAt, null, { id, name }));

const resting = (startedAtMs: number): StoredRestingResult => ({
  startedAtMs, version: 1, lowestBpm: 48, fromS: 60, toS: 120, meanBpm: 52, maxBpm: 60, coverage: 1, series: [50, 49, 48],
});
const place = (name: string, lat: number, savedAt: number): LearnedPlace => ({ name, lat, lon: 3.9, savedAt });

/**
 * Une paire avec, de chaque côté, le fichier de réglages de l'appareil et une vieille copie de celui de l'autre (le
 * téléphone a changé ses réglages depuis), un fichier du même nom écrit par deux tablettes différentes, et des tests
 * de FC repos et des lieux appris que l'autre n'a pas.
 */
const extrasPair = (cable = true): Pair => {
  const pair = pairOf(cable);
  putBoth(pair, 0);
  pair.computer.put('reglages/PC.json', settingsText(PC_ID, 'PC', 100));
  pair.computer.put('reglages/Téléphone.json', settingsText(TEL_ID, 'Téléphone', 200));
  pair.phone.put('reglages/Téléphone.json', settingsText(TEL_ID, 'Téléphone', 300));
  pair.computer.put('reglages/Tablette.json', settingsText('tablette-une', 'Tablette', 50));
  pair.phone.put('reglages/Tablette.json', settingsText('tablette-deux', 'Tablette', 60));
  pair.computer.put('fc-repos.json', restingHrFileText([resting(3), resting(1)]));
  pair.phone.put('fc-repos.json', restingHrFileText([resting(2), resting(1)]));
  pair.computer.put('lieux.json', learnedPlacesFileText([place('Carnon', 43.5, 20)]));
  pair.phone.put('lieux.json', learnedPlacesFileText([place('Palavas', 43.6, 10)]));
  return pair;
};

const EXTRA_PATHS = ['reglages/PC.json', 'reglages/Téléphone.json', 'reglages/Tablette.json', 'fc-repos.json', 'lieux.json'];

/** Texte de chaque fichier transporté, tel que l'application de chaque côté le lirait. */
const extrasOf = async (pair: Pair): Promise<(string | null)[]> => {
  const texts: (string | null)[] = [];
  for (const folder of [pair.computer, pair.phone]) {
    await folder.list('');
    for (const path of EXTRA_PATHS) texts.push(await folder.readText(path));
  }
  return texts;
};

describe('fichiers de réglages, FC repos et lieux', () => {
  it('réglages recopiés sans jamais être adoptés, même nom d’un autre appareil laissé, FC repos et lieux fondus des deux côtés', async () => {
    const pair = extrasPair();
    const tablettes = [pair.computer.text('reglages/Tablette.json'), pair.phone.text('reglages/Tablette.json')];
    const outcome = await run(pair, { computerDeviceId: PC_ID });
    expect(outcome.complete).toBe(true);
    expect(pair.phone.text('reglages/PC.json')).toBe(pair.computer.text('reglages/PC.json'));
    expect(pair.computer.text('reglages/Téléphone.json')).toBe(settingsText(TEL_ID, 'Téléphone', 300));
    expect([pair.computer.text('reglages/Tablette.json'), pair.phone.text('reglages/Tablette.json')]).toEqual(tablettes);
    expect(outcome.extras.left).toEqual([{ kind: 'settings', path: 'reglages/Tablette.json', side: null, reason: 'otherDevice' }]);
    const union = restingHrFileText([resting(3), resting(2), resting(1)]);
    const places = learnedPlacesFileText([place('Carnon', 43.5, 20), place('Palavas', 43.6, 10)]);
    for (const folder of [pair.computer, pair.phone]) {
      expect(folder.text('fc-repos.json')).toBe(union);
      expect(folder.text('lieux.json')).toBe(places);
    }
    expect(outcome.extras.done.map((op) => [op.kind, op.to, op.added]).sort()).toEqual([
      ['places', 'computer', 1], ['places', 'phone', 1], ['restingHr', 'computer', 1], ['restingHr', 'phone', 1],
      ['settings', 'computer', 0], ['settings', 'phone', 0],
    ]);
    // Rien de plus à faire, et rien n'est écrit sur le téléphone.
    const steps = pair.phone.steps();
    const again = await run(pair, { computerDeviceId: PC_ID });
    expect(again.extras.done).toEqual([]);
    expect(pair.phone.steps()).toBe(steps);
  });

  it('un fichier illisible ou d’une version plus récente n’est ni réécrit ni fondu, et c’est dit', async () => {
    const pair = pairOf();
    const pcResting = restingHrFileText([resting(3)]);
    const futurePlaces = `${JSON.stringify({ format: 'gtracker-lieux', version: 9, places: [place('Sète', 43.4, 5)] })}\n`;
    pair.computer.put('fc-repos.json', pcResting);
    pair.phone.put('fc-repos.json', '{abîmé');
    pair.computer.put('lieux.json', learnedPlacesFileText([place('Carnon', 43.5, 20)]));
    pair.phone.put('lieux.json', futurePlaces);
    pair.phone.put('reglages/Abîmé.json', 'pas du json');
    const outcome = await run(pair);
    expect(pair.computer.text('fc-repos.json')).toBe(pcResting);
    expect(pair.phone.text('fc-repos.json')).toBe('{abîmé');
    expect(pair.phone.text('lieux.json')).toBe(futurePlaces);
    expect(pair.computer.text('reglages/Abîmé.json')).toBeNull();
    expect(outcome.extras.done).toEqual([]);
    expect(outcome.extras.left.map((l) => [l.kind, l.side, l.reason])).toEqual([
      ['settings', 'phone', 'unreadable'], ['restingHr', 'phone', 'unreadable'], ['places', 'phone', 'newer'],
    ]);
  });

  it('téléphone qu’on ne peut pas écrire : seul l’ordinateur reçoit, le reste attend', async () => {
    const pair = extrasPair();
    const steps = pair.phone.steps();
    const half = await run(pair, { computerDeviceId: PC_ID, phoneWritable: false });
    expect(pair.phone.steps()).toBe(steps);
    expect(pair.computer.text('reglages/Téléphone.json')).toBe(settingsText(TEL_ID, 'Téléphone', 300));
    expect(half.extras.withheld.map((op) => [op.kind, op.to]).sort()).toEqual([['places', 'phone'], ['restingHr', 'phone'], ['settings', 'phone']]);
    expect(half.complete).toBe(false);
  });

  it.each(['phone', 'computer'] as const)('coupure du côté %s après chaque opération, puis reprise : rien de perdu, rien en double', async (side) => {
    const reference = extrasPair();
    expect((await run(reference, { computerDeviceId: PC_ID })).complete).toBe(true);
    const expected = await extrasOf(reference);
    const initial = await extrasOf(extrasPair());
    let cuts = 0;
    for (let n = 0; n < 200; n++) {
      const pair = extrasPair();
      pair[side].cutAfter(n);
      const outcome = await run(pair, { computerDeviceId: PC_ID });
      pair[side].cutAfter(null);
      if (outcome.linkLost === null && outcome.error === null && outcome.failed.length === 0 && outcome.extras.left.every((l) => l.reason !== 'failed')) break;
      cuts += 1;
      // Chaque fichier est, des deux côtés, tel qu'avant ou tel qu'attendu : jamais perdu ni à moitié écrit.
      (await extrasOf(pair)).forEach((text, i) => expect([initial[i], expected[i]], `coupure après ${n}, fichier ${i}`).toContain(text));
      await run(pair, { computerDeviceId: PC_ID });
      const final = await run(pair, { computerDeviceId: PC_ID });
      expect(final.complete, `coupure après ${n}`).toBe(true);
      expect(final.extras.done, `coupure après ${n}`).toEqual([]);
      expect(await extrasOf(pair), `coupure après ${n}`).toEqual(expected);
    }
    expect(cuts).toBeGreaterThan(3);
  });

  it('activité inconnue de l’appareil qui reçoit la session : signalée de son côté', async () => {
    const pair = pairOf();
    putSyncSession(pair.phone, at(1), { record: { activityId: 'a-moth' } });
    putSyncSession(pair.phone, at(2), { record: { activityId: 'wingfoil' } });
    putSyncSession(pair.computer, at(3), { record: { activityId: 'a-bateau-pc' } });
    const outcome = await run(pair, { knownActivities: { computer: ['wingfoil'], phone: ['wingfoil', 'a-moth'] } });
    expect(outcome.unknownActivities).toEqual([
      { side: 'computer', startMs: at(1), activityId: 'a-moth' },
      { side: 'phone', startMs: at(3), activityId: 'a-bateau-pc' },
    ]);
    // Sans liste pour un côté, il n'est pas vérifié.
    const unchecked = pairOf();
    putSyncSession(unchecked.phone, at(1), { record: { activityId: 'a-moth' } });
    expect((await run(unchecked)).unknownActivities).toEqual([]);
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
