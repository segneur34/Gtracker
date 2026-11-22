import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySyncOutcome, type SyncOutcome } from '../../library/syncOutcome';
import type { SyncItem } from '../../library/syncPlan';
import type { RouteSyncItem } from '../../library/syncRoutes';
import type { SyncLockOptions } from './sync';

/**
 * La couche du bouton « Synchroniser » : étapes publiées, options passées à la synchronisation, questions et réponses,
 * reprise sans recherche du téléphone, reprise automatique d'un élément changé en route, ligne de l'arrivée. Le
 * téléphone et la synchronisation elle-même sont simulés (l'exécutant a ses propres tests).
 */

type State =
  | { etat: 'pret'; nom: string; canal: 'cable' | 'sansFil'; ecriture: boolean; itineraires?: boolean; enregistrement?: boolean }
  | { etat: 'absent' };

let state: State;
let calls: SyncLockOptions[];
let outcomes: SyncOutcome[];

const held: SyncItem = {
  startMs: 1, case: 'deletedOnComputer', files: { computer: null, phone: 'a.gpx' }, ops: [], base: { kind: 'hold' }, left: 'inTrash',
  conflicts: [], twoTracks: false, withoutAncestor: false,
};

const stamp = (name: string) => ({ name, size: 10, mtimeMs: 0 });
const sent: SyncItem = {
  startMs: 2, case: 'newOnComputer', files: { computer: 'b.gpx', phone: null }, base: { kind: 'keep' }, left: null,
  ops: [{ kind: 'copy', to: 'phone', source: { gpx: stamp('b.gpx'), record: null, imu: null }, target: { gpx: 'b.gpx', record: null, imu: null }, recordText: null }],
  conflicts: [], twoTracks: false, withoutAncestor: false,
};

const synced = (patch: Partial<SyncOutcome> = {}): SyncOutcome => ({ ...emptySyncOutcome(null), phoneWritable: true, ...patch });
const inTrash = (): SyncOutcome => synced({ plan: { items: [held] } as never, done: [held] });
const guarded = (): SyncOutcome => synced({ deletions: 'awaitingConfirmation', withheldDeletions: [held] });

const load = async () => {
  vi.resetModules();
  vi.doMock('../../platform/phoneCable', () => ({
    phoneState: async () => state,
    phoneChannel: (s: { canal?: string }) => s.canal ?? 'cable',
    listPhoneFiles: async () => [],
    phoneCanWrite: (s: State) => s.etat === 'pret' && s.ecriture,
    phoneListsRoutes: (s: State) => s.etat === 'pret' && s.itineraires === true,
    phoneIsRecording: (s: State) => s.etat === 'pret' && s.enregistrement === true,
    phoneMemoryFolder: (label: string) => ({ label }),
    phoneSafetyCopy: async () => 'C:\\copies\\x',
  }));
  vi.doMock('../../platform/wirelessPhone', () => ({ wirelessAvailable: () => false, wirelessState: async () => null }));
  vi.doMock('./sync', () => ({
    synchronizePhone: async (_folder: unknown, options: SyncLockOptions) => {
      calls.push(options);
      options.onPlanned?.({} as never, 'noBase');
      options.onProgress?.(3, 5);
      return outcomes.shift() ?? synced({ complete: true });
    },
  }));
  return import('./phoneSync');
};

beforeEach(() => {
  state = { etat: 'pret', nom: 'Xiaomi', canal: 'cable', ecriture: true, itineraires: true };
  calls = [];
  outcomes = [];
});

describe('bouton « Synchroniser »', () => {
  it('par le câble : téléphone écrit, copie de sécurité branchée, étapes publiées jusqu’au compte rendu', async () => {
    const sync = await load();
    const steps: string[] = [];
    const recording = () => false;
    const done = sync.synchronizeWithPhone({ recording });
    steps.push(sync.phoneSyncStep().step);
    await done;
    expect(steps).toEqual(['searching']);
    expect(calls[0]).toMatchObject({ phoneWritable: true, phonePath: 'Documents/Gtracker', recording, phoneRoutes: true });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced', phone: 'Xiaomi', channel: 'cable' } });
    // Les rappels publient leur étape : copie de sécurité, puis avancement d'une première synchronisation.
    expect(await calls[0].beforeWrites?.('noBase')).toBe('C:\\copies\\x');
    expect(sync.phoneSyncStep()).toEqual({ step: 'safetyCopy', phone: 'Xiaomi', channel: 'cable' });
    calls[0].onPlanned?.({} as never, 'noBase');
    calls[0].onProgress?.(12, 50);
    expect(sync.phoneSyncStep()).toEqual({ step: 'copying', phone: 'Xiaomi', channel: 'cable', done: 12, total: 50, first: true });
  });

  it('par le sans-fil, téléphone ancien : le téléphone n’est pas écrit, les itinéraires ne sont pas touchés', async () => {
    state = { etat: 'pret', nom: 'Xiaomi', canal: 'sansFil', ecriture: false };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls[0]).toMatchObject({ phoneWritable: false, phoneRoutes: false, phoneRecording: false });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced', channel: 'sansFil' } });
  });

  it('par le sans-fil, téléphone à jour : écrit, itinéraires compris, copie de sécurité comprise', async () => {
    state = { etat: 'pret', nom: 'Xiaomi', canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls[0]).toMatchObject({ phoneWritable: true, phoneRoutes: true, phoneRecording: false });
    expect(await calls[0].beforeWrites?.('noBase')).toBe('C:\\copies\\x');
    calls[0].onPlanned?.({} as never, 'noBase');
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'copying', channel: 'sansFil', first: true });
  });

  it('par le sans-fil, téléphone qui enregistre : pas écrit, itinéraires listés, le compte rendu le sait', async () => {
    state = { etat: 'pret', nom: 'Xiaomi', canal: 'sansFil', ecriture: false, itineraires: true, enregistrement: true };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls[0]).toMatchObject({ phoneWritable: false, phoneRoutes: true, phoneRecording: true });
  });

  it('téléphone absent : l’issue le dit, sans synchroniser', async () => {
    state = { etat: 'absent' };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls).toEqual([]);
    expect(sync.phoneSyncStep()).toEqual({ step: 'over', result: { kind: 'phone', state: 'absent' } });
  });
});

describe('questions et réponses', () => {
  it('une réponse repart sans repasser par la recherche du téléphone, et le compte rendu reprend la première passe', async () => {
    outcomes = [synced({ done: [sent], deletions: 'awaitingConfirmation', withheldDeletions: [held] })];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    const answered = sync.answerPhoneSyncQuestion('deleteBoth');
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'copying', phone: 'Xiaomi', channel: 'cable', done: 0, total: 0, first: false });
    await answered;
    const step = sync.phoneSyncStep();
    expect(step.step).toBe('over');
    // La session envoyée à la première passe est encore dans le compte rendu de la seconde.
    expect(step.step === 'over' && step.result.kind === 'synced' && step.result.outcome.done.map((i) => i.startMs)).toEqual([2]);
  });

  it('« Tout garder » : les suppressions montrées partent comme refusées, aucune confirmation', async () => {
    outcomes = [guarded()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('keepAll');
    expect(calls[1]).toMatchObject({ keepRefused: { sessions: [{ startMs: 1, side: 'phone' }], routes: [] }, confirmDeletions: false });
    expect(calls[1].confirmedDeletions).toBeUndefined();
    expect(sync.phoneSyncStep().step).toBe('over');
  });

  it('« Les garder » : les sessions et itinéraires montrés sortent de la corbeille', async () => {
    outcomes = [inTrash()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('keepHeld');
    expect(calls[1]).toMatchObject({ heldOnPhone: 'keep', heldToKeep: [1], heldRoutesToKeep: [] });
    expect(calls[1].heldToRemove).toBeUndefined();
  });

  it('une réponse qui n’est pas celle de la question posée est sans effet', async () => {
    outcomes = [inTrash()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('keepAll');
    await sync.answerPhoneSyncQuestion('deleteBoth');
    expect(calls).toHaveLength(1);
    expect(sync.phoneSyncStep().step).toBe('question');
  });

  it('corbeille puis garde-fou : « Les retirer du téléphone » relance, et la confirmation garde ce choix', async () => {
    outcomes = [inTrash(), guarded()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'inTrash' } });
    await sync.answerPhoneSyncQuestion('removeHeld');
    expect(calls[1].heldOnPhone).toBe('remove');
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    await sync.answerPhoneSyncQuestion('deleteBoth');
    expect(calls[2]).toMatchObject({ heldOnPhone: 'remove', confirmDeletions: true });
    expect(sync.phoneSyncStep().step).toBe('over');
  });

  it('garde-fou puis corbeille : la confirmation donnée ne couvre pas « Les retirer du téléphone », qui rouvre le garde-fou', async () => {
    outcomes = [guarded(), inTrash(), guarded()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('deleteBoth');
    // Chaque réponse emporte la liste que sa question a montrée.
    expect(calls[1]).toMatchObject({ confirmDeletions: true, confirmedDeletions: [{ startMs: 1, side: 'phone' }] });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'inTrash' } });
    await sync.answerPhoneSyncQuestion('removeHeld');
    expect(calls[2]).toMatchObject({ heldOnPhone: 'remove', heldToRemove: [1], confirmDeletions: false, confirmedDeletions: undefined });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    await sync.answerPhoneSyncQuestion('deleteBoth');
    expect(calls[3]).toMatchObject({ heldOnPhone: 'remove', confirmDeletions: true });
    expect(sync.phoneSyncStep().step).toBe('over');
  });

  it('les itinéraires entrent dans les mêmes questions, et chaque réponse emporte ceux qu’elle a montrés', async () => {
    const route: RouteSyncItem = {
      id: '2026-11-01T10:00:00.000Z', createdAt: '2026-11-01T10:00:00.000Z', case: 'deletedOnComputer', files: { computer: null, phone: 'tour' },
      ops: [], base: { kind: 'hold' }, left: 'inTrash', conflict: false, revived: false,
    };
    const routes = (patch: Partial<SyncOutcome['routes']>): SyncOutcome['routes'] => ({ ...emptySyncOutcome(null).routes, ...patch });
    outcomes = [
      synced({ deletions: 'awaitingConfirmation', withheldDeletions: [held], routes: routes({ withheldDeletions: [route] }) }),
      synced({ routes: routes({ plan: { items: [route], aside: [] } as never }) }),
    ];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard', routes: [{ id: route.id, side: 'phone', label: 'tour' }] } });
    await sync.answerPhoneSyncQuestion('deleteBoth');
    expect(calls[1]).toMatchObject({ confirmedDeletions: [{ startMs: 1, side: 'phone' }], confirmedRouteDeletions: [{ id: route.id, side: 'phone' }] });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'inTrash' } });
    await sync.answerPhoneSyncQuestion('removeHeld');
    expect(calls[2]).toMatchObject({ heldOnPhone: 'remove', heldToRemove: [], heldRoutesToRemove: [route.id], confirmedRouteDeletions: undefined });
  });

  it('fermer la question ne décide rien : compte rendu de ce qui est fait, « Répondre » y revient, rien n’est relancé', async () => {
    outcomes = [guarded()];
    const sync = await load();
    await sync.synchronizeWithPhone();
    sync.leavePhoneSyncQuestion();
    expect(calls).toHaveLength(1);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced' }, unanswered: { kind: 'guard' } });
    sync.reopenPhoneSyncQuestion();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    // Rouvert puis fermé de nouveau, la prochaine synchronisation repart du début et repose la question.
    sync.leavePhoneSyncQuestion();
    outcomes = [guarded()];
    await sync.synchronizeWithPhone();
    expect(calls).toHaveLength(2);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question' });
  });
});

describe('réponse qui ne peut pas s’appliquer', () => {
  it('le téléphone parti avant la réponse : ce qui était fait, la raison, et la question à reprendre', async () => {
    outcomes = [synced({ done: [sent], deletions: 'awaitingConfirmation', withheldDeletions: [held] })];
    const sync = await load();
    await sync.synchronizeWithPhone();
    state = { etat: 'absent' };
    await sync.answerPhoneSyncQuestion('keepAll');
    expect(calls).toHaveLength(1);
    expect(sync.phoneSyncStep()).toMatchObject({
      step: 'over', result: { kind: 'synced', outcome: { done: [sent] } }, unanswered: { kind: 'guard' },
      answerFailed: { kind: 'phone', state: 'absent' },
    });
    // « Répondre » revient à la question ; la réponse suivante ne garde rien de celle qui a échoué.
    sync.reopenPhoneSyncQuestion();
    state = { etat: 'pret', nom: 'Xiaomi', canal: 'cable', ecriture: true, itineraires: true };
    await sync.answerPhoneSyncQuestion('deleteBoth');
    expect(calls[1]).toMatchObject({ confirmDeletions: true });
    expect(calls[1].keepRefused).toBeUndefined();
  });

  it('la synchronisation de la réponse refusée : le refus est dit, la question ne revient pas toute seule', async () => {
    outcomes = [synced({ done: [sent], deletions: 'awaitingConfirmation', withheldDeletions: [held] }), emptySyncOutcome('busy')];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('keepAll');
    const step = sync.phoneSyncStep();
    expect(step).toMatchObject({ step: 'over', result: { outcome: { done: [sent] } }, unanswered: { kind: 'guard' }, answerFailed: { kind: 'synced', outcome: { refusal: 'busy' } } });
  });
});

describe('reprise automatique', () => {
  it('un élément changé en route est repris une fois, seul, sans recherche du téléphone, avant le compte rendu', async () => {
    outcomes = [synced({ done: [sent], skipped: [held] }), synced({ done: [held] })];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls).toHaveLength(2);
    const step = sync.phoneSyncStep();
    expect(step).toMatchObject({ step: 'over', result: { kind: 'synced', outcome: { skipped: [] } } });
    expect(step.step === 'over' && step.result.kind === 'synced' && step.result.outcome.done.map((i) => i.startMs)).toEqual([2, 1]);
  });

  it('changé encore à la reprise : pas de troisième passe, le compte rendu le dit', async () => {
    outcomes = [synced({ skipped: [held] }), synced({ skipped: [held] })];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls).toHaveLength(2);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { outcome: { skipped: [held] } } });
  });

  it('le téléphone parti avant la reprise : le compte rendu de la première passe reste', async () => {
    outcomes = [synced({ done: [sent], skipped: [held] })];
    const sync = await load();
    const done = sync.synchronizeWithPhone();
    // L'état du téléphone de la première passe est déjà lu : seule la reprise le trouve parti.
    state = { etat: 'absent' };
    await done;
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced', outcome: { done: [sent], skipped: [held] } } });
  });
});

describe('arrivée d’un téléphone', () => {
  it('arrivée par le sans-fil : seulement une ligne, rien ne se lance', async () => {
    const sync = await load();
    sync.notePhoneArrival();
    expect(calls).toEqual([]);
    expect(sync.phoneSyncStep().step).toBe('idle');
    expect(sync.phoneArrivalNote()?.text).toBe('Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour.');
    sync.clearPhoneArrivalNote();
    expect(sync.phoneArrivalNote()).toBeNull();
    // Une synchronisation efface la ligne.
    sync.notePhoneArrival();
    await sync.synchronizeWithPhone();
    expect(sync.phoneArrivalNote()).toBeNull();
  });
});
