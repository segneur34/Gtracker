import { describe, expect, it } from 'vitest';
import { routePath } from '../../library/folderLayout';
import { parseSyncBase, readMarkerId, readMarkerSync, syncBasePath, type SyncBase } from '../../library/syncBase';
import { describeSync, describeSyncQuestion, syncQuestionConfirmLabel, syncQuestionListLabel } from '../../library/syncReport';
import { syncRouteListing } from '../../library/syncRoutes';
import { TRASH_INDEX_PATH, parseTrashIndex, trashFilePath, type TrashEntry } from '../../library/trash';
import { stashInTrash } from '../../library/trashFolder';
import { ROUTE_FORMAT, ROUTE_VERSION, parseRouteRecord, serializeRouteRecord } from '../../planning/routeRecord';
import { putSyncSession, syncMemoryFolder, type SyncFolder } from '../../test/syncFolder.fixture';
import { executeSync, type SyncOptions, type SyncOutcome } from './sync';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
/** Date ISO du jour de rang `k`. */
const iso = (k: number): string => new Date(T0 + k * DAY).toISOString();

interface Pair {
  computer: SyncFolder;
  phone: SyncFolder;
}

const pairOf = (): Pair => ({
  computer: syncMemoryFolder({ clockMs: 1_800_000_000_000 }), phone: syncMemoryFolder({ phone: true, clockMs: 1_800_000_417_000, cable: true }),
});

let ids = 0;
const run = (pair: Pair, options: SyncOptions = {}): Promise<SyncOutcome> =>
  executeSync(pair.computer, pair.phone, { now: () => NOW, newFolderId: () => `dossier-route-${String(++ids).padStart(4, '0')}`, phoneRoutes: true, ...options });

const recordText = (createdAt: string, updatedAt: string, { lat = 43.5, version = ROUTE_VERSION } = {}): string =>
  serializeRouteRecord({
    format: ROUTE_FORMAT, version, name: '', activityId: null, createdAt, updatedAt,
    waypoints: [{ lat, lon: 3.9 }, { lat: lat + 0.01, lon: 3.91 }], legs: [],
  });

/** Range un itinéraire comme l'application de l'appareil : GPX puis fiche. */
const putRoute = (folder: SyncFolder, base: string, createdAt: string, updatedAt: string, options: { lat?: number; version?: number } = {}): void => {
  folder.put(routePath(`${base}.gpx`), `<gpx>${base} ${updatedAt} ${options.lat ?? 43.5}</gpx>`);
  folder.put(routePath(`${base}.json`), recordText(createdAt, updatedAt, options));
};

const dropRoute = (folder: SyncFolder, base: string): void => {
  folder.drop(routePath(`${base}.json`));
  folder.drop(routePath(`${base}.gpx`));
};

/** Supprime un itinéraire sur l'ordinateur comme l'application : copie à la corbeille, puis fiche et GPX retirés. */
const trashOnComputer = async (pair: Pair, base: string): Promise<void> => {
  const record = parseRouteRecord(pair.computer.text(routePath(`${base}.json`)) as string);
  const paths = [routePath(`${base}.json`), routePath(`${base}.gpx`)];
  await stashInTrash(pair.computer, { kind: 'itineraire', paths, main: paths[0], routeBase: base, createdAt: record?.createdAt, name: base }, NOW - 1000);
  dropRoute(pair.computer, base);
};

const routesOf = async (folder: SyncFolder): Promise<string[]> => syncRouteListing(await folder.list('itineraires')).routes.map((r) => r.base).sort();
const updatedOf = (folder: SyncFolder, base: string): string | undefined => parseRouteRecord(folder.text(routePath(`${base}.json`)) ?? '')?.updatedAt;
const trashOf = (pair: Pair): TrashEntry[] => parseTrashIndex(pair.computer.text(TRASH_INDEX_PATH)).entries;
const baseOf = (pair: Pair): SyncBase | null => {
  const id = readMarkerId(pair.phone.text('gtracker.json'));
  const read = id ? parseSyncBase(pair.computer.text(syncBasePath(id))) : null;
  return read?.state === 'ok' ? read.base : null;
};
const said = (outcome: SyncOutcome): string[] => describeSync(outcome).paragraphs;

/** Une paire synchronisée avec les itinéraires `r0`… des deux côtés. */
const syncedPair = async (count: number): Promise<Pair> => {
  const pair = pairOf();
  for (let k = 0; k < count; k++) putRoute(pair.computer, `r${k}`, iso(k), iso(k));
  expect((await run(pair)).complete).toBe(true);
  return pair;
};

describe('synchronisation des itinéraires, de bout en bout', () => {
  it('première rencontre : chaque appareil reçoit ce qui lui manque, la base retient les deux', async () => {
    const pair = pairOf();
    putRoute(pair.computer, 'tour du cap', iso(0), iso(0));
    putRoute(pair.phone, 'baie', iso(1), iso(1));
    const outcome = await run(pair);
    expect(outcome.complete).toBe(true);
    expect(await routesOf(pair.computer)).toEqual(['baie', 'tour du cap']);
    expect(await routesOf(pair.phone)).toEqual(['baie', 'tour du cap']);
    expect(pair.phone.text(routePath('tour du cap.json'))).toBe(pair.computer.text(routePath('tour du cap.json')));
    expect(baseOf(pair)?.routes.map((r) => r.id)).toEqual([iso(0), iso(1)]);
    expect(said(outcome)).toContain("1 itinéraire copié vers le téléphone, 1 vers l'ordinateur.");
    expect(readMarkerSync(pair.phone.text('gtracker.json'))).toBe(NOW);
    expect((await run(pair)).routes.done).toEqual([]);
  });

  it('créé sur le téléphone puis modifié sur l’ordinateur : le téléphone reçoit la nouvelle version', async () => {
    const pair = pairOf();
    putRoute(pair.phone, 'r0', iso(0), iso(0));
    await run(pair);
    putRoute(pair.computer, 'r0', iso(0), iso(3), { lat: 44 });
    const outcome = await run(pair);
    expect(updatedOf(pair.phone, 'r0')).toBe(iso(3));
    expect(pair.phone.text(routePath('r0.gpx'))).toBe(pair.computer.text(routePath('r0.gpx')));
    expect(said(outcome)).toContain('1 itinéraire modifié recopié.');
    expect(said(outcome)).toContain('Sur le téléphone, touchez « Mettre à jour » pour voir les changements.');
  });

  it('supprimé sur le téléphone : la copie de l’ordinateur va à sa corbeille', async () => {
    const pair = await syncedPair(2);
    dropRoute(pair.phone, 'r1');
    // Une suppression sur deux itinéraires dépasse la part que le garde-fou laisse passer : confirmée d'avance.
    const outcome = await run(pair, { confirmDeletions: true });
    expect(await routesOf(pair.computer)).toEqual(['r0']);
    const entry = trashOf(pair).find((e) => e.kind === 'itineraire');
    expect(entry).toMatchObject({ routeBase: 'r1', createdAt: iso(1), origin: 'ordinateur', main: 'r1.json' });
    expect(entry?.files.map((f) => f.name).sort()).toEqual(['r1.gpx', 'r1.json']);
    expect(said(outcome)).toContain("1 itinéraire supprimé sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours).");
    expect(baseOf(pair)?.routes.map((r) => r.id)).toEqual([iso(0)]);
  });

  it('supprimé sur l’ordinateur : retiré du téléphone, sans copie de plus quand la corbeille tient la même fiche', async () => {
    const pair = await syncedPair(2);
    await trashOnComputer(pair, 'r0');
    const outcome = await run(pair, { confirmDeletions: true });
    expect(await routesOf(pair.phone)).toEqual(['r1']);
    expect(trashOf(pair).filter((e) => e.kind === 'itineraire')).toHaveLength(1);
    expect(said(outcome)).toContain("1 itinéraire supprimé sur l'ordinateur : retiré du téléphone.");
  });

  // Le nom de fichier d'un itinéraire vient de son nom affiché : un itinéraire créé au même lieu le même jour, sans
  // nom saisi, reprend celui d'un itinéraire supprimé juste avant. La suppression ne doit pas l'en empêcher.
  it('supprimé sur l’ordinateur puis un autre rangé sous le même nom : retiré du téléphone, le neuf copié, puis plus rien à faire', async () => {
    const pair = await syncedPair(1);
    await trashOnComputer(pair, 'r0');
    putRoute(pair.computer, 'r0', iso(5), iso(5), { lat: 44 });
    const outcome = await run(pair, { confirmDeletions: true });
    expect(outcome.routes.skipped).toEqual([]);
    expect(outcome.complete).toBe(true);
    expect(await routesOf(pair.phone)).toEqual(['r0-2']);
    expect(pair.phone.text(routePath('r0-2.json'))).toBe(pair.computer.text(routePath('r0.json')));
    expect(said(outcome)).toContain("1 itinéraire supprimé sur l'ordinateur : retiré du téléphone.");
    expect(baseOf(pair)?.routes.map((r) => r.id)).toEqual([iso(5)]);
    const next = await run(pair);
    expect([next.routes.done, next.routes.skipped]).toEqual([[], []]);
    expect(await routesOf(pair.phone)).toEqual(['r0-2']);
    expect(await routesOf(pair.computer)).toEqual(['r0']);
  });

  it('supprimé sur le téléphone puis un autre rangé sous le même nom : à la corbeille de l’ordinateur, le neuf copié, puis plus rien à faire', async () => {
    const pair = await syncedPair(1);
    dropRoute(pair.phone, 'r0');
    putRoute(pair.phone, 'r0', iso(5), iso(5), { lat: 44 });
    const outcome = await run(pair, { confirmDeletions: true });
    expect(outcome.routes.skipped).toEqual([]);
    expect(outcome.complete).toBe(true);
    expect(await routesOf(pair.computer)).toEqual(['r0-2']);
    expect(pair.computer.text(routePath('r0-2.json'))).toBe(pair.phone.text(routePath('r0.json')));
    expect(trashOf(pair).find((e) => e.kind === 'itineraire')).toMatchObject({ createdAt: iso(0), origin: 'ordinateur' });
    expect(baseOf(pair)?.routes.map((r) => r.id)).toEqual([iso(5)]);
    const next = await run(pair);
    expect([next.routes.done, next.routes.skipped]).toEqual([[], []]);
    expect(await routesOf(pair.computer)).toEqual(['r0-2']);
    expect(await routesOf(pair.phone)).toEqual(['r0']);
  });

  it('listage en retard : le même itinéraire encore là sous ce nom, ou une fiche illisible, retient la suppression', async () => {
    const back = await syncedPair(1);
    await trashOnComputer(back, 'r0');
    // Remis sur l'ordinateur juste après le listage, le même itinéraire n'est pas retiré du téléphone.
    const kept = await run(back, { confirmDeletions: true, onPlanned: () => putRoute(back.computer, 'r0', iso(0), iso(0)) });
    expect(kept.routes.skipped.map((i) => i.id)).toEqual([iso(0)]);
    expect(await routesOf(back.phone)).toEqual(['r0']);

    const unreadable = await syncedPair(1);
    await trashOnComputer(unreadable, 'r0');
    const held = await run(unreadable, { confirmDeletions: true, onPlanned: () => unreadable.computer.put(routePath('r0.json'), '{ pas une fiche') });
    expect(held.routes.skipped.map((i) => i.id)).toEqual([iso(0)]);
    expect(await routesOf(unreadable.phone)).toEqual(['r0']);

    const mirror = await syncedPair(1);
    dropRoute(mirror.phone, 'r0');
    const stays = await run(mirror, { confirmDeletions: true, onPlanned: () => putRoute(mirror.phone, 'r0', iso(0), iso(0)) });
    expect(stays.routes.skipped.map((i) => i.id)).toEqual([iso(0)]);
    expect(await routesOf(mirror.computer)).toEqual(['r0']);
  });

  it('supprimé sur l’ordinateur mais changé sur le téléphone depuis : la modification revient', async () => {
    const pair = await syncedPair(1);
    await trashOnComputer(pair, 'r0');
    putRoute(pair.phone, 'r0', iso(0), iso(4), { lat: 45 });
    await run(pair);
    expect(updatedOf(pair.computer, 'r0')).toBe(iso(4));
    expect(await routesOf(pair.phone)).toEqual(['r0']);
  });

  it('modifié des deux côtés : la plus récente gagne, l’autre est dans la corbeille', async () => {
    const pair = await syncedPair(1);
    putRoute(pair.computer, 'r0', iso(0), iso(2), { lat: 44 });
    putRoute(pair.phone, 'r0', iso(0), iso(5), { lat: 46 });
    const outcome = await run(pair);
    expect(updatedOf(pair.computer, 'r0')).toBe(iso(5));
    const loser = trashOf(pair).find((e) => e.kind === 'itineraire');
    expect(loser?.origin).toBe('ordinateur');
    expect(parseRouteRecord(pair.computer.text(trashFilePath(loser?.dir as string, 'r0.json')) as string)?.updatedAt).toBe(iso(2));
    expect(said(outcome)).toContain("1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours).");
  });

  it('une fiche d’une version plus récente n’est jamais écrasée', async () => {
    const pair = await syncedPair(1);
    putRoute(pair.phone, 'r0', iso(0), iso(1), { version: ROUTE_VERSION + 1 });
    putRoute(pair.computer, 'r0', iso(0), iso(2), { lat: 44 });
    const outcome = await run(pair);
    expect(parseRouteRecord(pair.phone.text(routePath('r0.json')) as string)?.version).toBe(ROUTE_VERSION + 1);
    expect(said(outcome)).toContain("1 itinéraire laissé tel quel : illisible, ou d'une version plus récente de Gtracker.");
  });

  it('un itinéraire changé sur le téléphone pendant la synchronisation est laissé pour la fois suivante', async () => {
    const pair = await syncedPair(1);
    putRoute(pair.computer, 'r0', iso(0), iso(2), { lat: 44 });
    // Le téléphone range une autre version juste après le listage : le remplacement ne se fait pas.
    const outcome = await run(pair, {
      onPlanned: () => putRoute(pair.phone, 'r0', iso(0), iso(3), { lat: 47 }),
    });
    expect(outcome.routes.skipped.map((i) => i.id)).toEqual([iso(0)]);
    expect(updatedOf(pair.phone, 'r0')).toBe(iso(3));
    expect(outcome.complete).toBe(false);
  });

  it('sans listage des itinéraires, rien n’est touché, et le compte rendu le dit', async () => {
    const pair = pairOf();
    putRoute(pair.computer, 'r0', iso(0), iso(0));
    putRoute(pair.phone, 'r1', iso(1), iso(1));
    const waiting = await run(pair, { phoneRoutes: false });
    expect(await routesOf(pair.phone)).toEqual(['r1']);
    expect(await routesOf(pair.computer)).toEqual(['r0']);
    expect(said(waiting)).toContain('Les itinéraires attendent le câble ou la mise à jour du téléphone.');
    expect(said(await run(pair, { phoneRoutes: undefined }))).not.toContain('Les itinéraires attendent le câble ou la mise à jour du téléphone.');
    expect(baseOf(pair)?.routes).toEqual([]);
  });

  it('garde-fou : une seule question pour les sessions et les itinéraires, qui ne vaut que pour ce qu’elle a montré', async () => {
    const pair = await syncedPair(12);
    putSyncSession(pair.computer, T0);
    putSyncSession(pair.phone, T0);
    await run(pair);
    for (let k = 0; k < 11; k++) await trashOnComputer(pair, `r${k}`);
    const held = await run(pair);
    expect(held.deletions).toBe('awaitingConfirmation');
    expect(await routesOf(pair.phone)).toHaveLength(12);
    const question = describeSyncQuestion(held);
    expect(question?.text).toBe("Cette synchronisation retirerait 11 itinéraires. Rien n'est encore supprimé.");
    expect(question?.routes).toHaveLength(11);
    expect(syncQuestionConfirmLabel(question!)).toBe('Supprimer ces 11 itinéraires');
    expect(syncQuestionListLabel(question!)).toBe('Voir les 11 itinéraires');
    const shown = question!.routes.map((r) => ({ id: r.id, side: r.side }));
    // Une suppression de plus depuis la question : rien n'est supprimé, la question revient.
    await trashOnComputer(pair, 'r11');
    const again = await run(pair, { confirmDeletions: true, confirmedDeletions: [], confirmedRouteDeletions: shown });
    expect(again.deletions).toBe('awaitingConfirmation');
    expect(await routesOf(pair.phone)).toHaveLength(12);
    const all = describeSyncQuestion(again)!.routes.map((r) => ({ id: r.id, side: r.side }));
    const confirmed = await run(pair, { confirmDeletions: true, confirmedDeletions: [], confirmedRouteDeletions: all });
    expect(confirmed.deletions).toBe('made');
    expect(await routesOf(pair.phone)).toEqual([]);
  });

  it('itinéraire de la corbeille encore sur le téléphone, sans ligne de base : joint à la question, retiré sur réponse', async () => {
    const pair = pairOf();
    putRoute(pair.computer, 'r0', iso(0), iso(0));
    await trashOnComputer(pair, 'r0');
    putRoute(pair.phone, 'r0', iso(0), iso(0));
    const first = await run(pair);
    expect(await routesOf(pair.phone)).toEqual(['r0']);
    const question = describeSyncQuestion(first);
    expect(question?.kind).toBe('inTrash');
    expect(question?.text).toBe("1 itinéraire supprimé sur l'ordinateur est encore sur le téléphone. Le retirer du téléphone ? Il reste 30 jours dans la corbeille de l'ordinateur.");
    // Un autre itinéraire de la corbeille apparu depuis la question : aucun n'est retiré.
    putRoute(pair.computer, 'r1', iso(1), iso(1));
    await trashOnComputer(pair, 'r1');
    putRoute(pair.phone, 'r1', iso(1), iso(1));
    await run(pair, { heldOnPhone: 'remove', heldToRemove: [], heldRoutesToRemove: [iso(0)], confirmDeletions: true });
    expect(await routesOf(pair.phone)).toEqual(['r0', 'r1']);
    // Retirer tout ce qu'a le téléphone passe le garde-fou : sa question suit, ici confirmée d'avance.
    const removing = await run(pair, { heldOnPhone: 'remove', heldToRemove: [], heldRoutesToRemove: [iso(0), iso(1)] });
    expect(describeSyncQuestion(removing)?.kind).toBe('guard');
    await run(pair, { heldOnPhone: 'remove', heldToRemove: [], heldRoutesToRemove: [iso(0), iso(1)], confirmDeletions: true });
    expect(await routesOf(pair.phone)).toEqual([]);
    // La corbeille tenait déjà ces mêmes fiches : rien de plus n'y est rangé.
    expect(trashOf(pair).filter((e) => e.kind === 'itineraire')).toHaveLength(2);
  });
});
