import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySyncOutcome, type SyncOutcome } from '../../library/syncOutcome';
import type { SyncItem } from '../../library/syncPlan';
import type { SyncLockOptions } from './sync';

/**
 * La couche du bouton « Synchroniser » : étapes publiées, options passées à la synchronisation, questions et relances,
 * ligne de l'arrivée. Le téléphone et la synchronisation elle-même sont simulés (l'exécutant a ses propres tests).
 */

type State = { etat: 'pret'; nom: string; canal: 'cable' | 'sansFil'; ecriture: boolean } | { etat: 'absent' };

let state: State;
let calls: SyncLockOptions[];
let outcomes: SyncOutcome[];

const held: SyncItem = {
  startMs: 1, case: 'deletedOnComputer', files: { computer: null, phone: 'a.gpx' }, ops: [], base: { kind: 'hold' }, left: 'inTrash',
  conflicts: [], twoTracks: false, withoutAncestor: false,
};

const load = async () => {
  vi.resetModules();
  vi.doMock('../../platform/phoneCable', () => ({
    phoneState: async () => state,
    phoneChannel: (s: { canal?: string }) => s.canal ?? 'cable',
    listPhoneFiles: async () => [],
    phoneCanWrite: (s: State) => s.etat === 'pret' && s.ecriture,
    phoneMemoryFolder: (label: string) => ({ label }),
    phoneSafetyCopy: async () => 'C:\\copies\\x',
  }));
  vi.doMock('../../platform/wirelessPhone', () => ({ wirelessAvailable: () => false, wirelessState: async () => null }));
  vi.doMock('./sync', () => ({
    synchronizePhone: async (_folder: unknown, options: SyncLockOptions) => {
      calls.push(options);
      options.onPlanned?.({} as never, 'noBase');
      options.onProgress?.(3, 5);
      return outcomes.shift() ?? { ...emptySyncOutcome(null), phoneWritable: true, complete: true };
    },
  }));
  return import('./phoneSync');
};

beforeEach(() => {
  state = { etat: 'pret', nom: 'Xiaomi', canal: 'cable', ecriture: true };
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
    expect(calls[0]).toMatchObject({ phoneWritable: true, phonePath: 'Documents/Gtracker', recording });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced', phone: 'Xiaomi', channel: 'cable' } });
    // Les rappels publient leur étape : copie de sécurité, puis avancement d'une première synchronisation.
    expect(await calls[0].beforeWrites?.('noBase')).toBe('C:\\copies\\x');
    expect(sync.phoneSyncStep()).toEqual({ step: 'safetyCopy', phone: 'Xiaomi', channel: 'cable' });
    calls[0].onPlanned?.({} as never, 'noBase');
    calls[0].onProgress?.(12, 50);
    expect(sync.phoneSyncStep()).toEqual({ step: 'copying', phone: 'Xiaomi', channel: 'cable', done: 12, total: 50, first: true });
  });

  it('par le sans-fil : le téléphone n’est pas écrit', async () => {
    state = { etat: 'pret', nom: 'Xiaomi', canal: 'sansFil', ecriture: false };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls[0].phoneWritable).toBe(false);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced', channel: 'sansFil' } });
  });

  it('téléphone absent : l’issue le dit, sans synchroniser', async () => {
    state = { etat: 'absent' };
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(calls).toEqual([]);
    expect(sync.phoneSyncStep()).toEqual({ step: 'over', result: { kind: 'phone', state: 'absent' } });
  });

  it('corbeille puis garde-fou : « Retirer du téléphone » relance, et la confirmation garde ce choix', async () => {
    outcomes = [
      { ...emptySyncOutcome(null), phoneWritable: true, plan: { items: [held] } as never, done: [held] },
      { ...emptySyncOutcome(null), phoneWritable: true, deletions: 'awaitingConfirmation', withheldDeletions: [held] },
    ];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'inTrash', count: 1 } });
    await sync.answerPhoneSyncQuestion('removeHeld');
    expect(calls[1].heldOnPhone).toBe('remove');
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard', count: 1 } });
    await sync.answerPhoneSyncQuestion('confirmDeletions');
    expect(calls[2]).toMatchObject({ heldOnPhone: 'remove', confirmDeletions: true });
    expect(sync.phoneSyncStep().step).toBe('over');
  });

  it('garde-fou puis corbeille : la confirmation donnée ne couvre pas « Retirer du téléphone », qui rouvre le garde-fou', async () => {
    const guarded = { ...emptySyncOutcome(null), phoneWritable: true, deletions: 'awaitingConfirmation' as const, withheldDeletions: [held] };
    outcomes = [
      guarded,
      { ...emptySyncOutcome(null), phoneWritable: true, plan: { items: [held] } as never, done: [held] },
      guarded,
    ];
    const sync = await load();
    await sync.synchronizeWithPhone();
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    await sync.answerPhoneSyncQuestion('confirmDeletions');
    expect(calls[1].confirmDeletions).toBe(true);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'inTrash' } });
    await sync.answerPhoneSyncQuestion('removeHeld');
    expect(calls[2]).toMatchObject({ heldOnPhone: 'remove', confirmDeletions: false });
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'question', question: { kind: 'guard' } });
    await sync.answerPhoneSyncQuestion('confirmDeletions');
    expect(calls[3]).toMatchObject({ heldOnPhone: 'remove', confirmDeletions: true });
    expect(sync.phoneSyncStep().step).toBe('over');
  });

  it('« Annuler » ou « Les laisser » : rien n’est relancé, le compte rendu de ce qui est fait s’affiche', async () => {
    outcomes = [{ ...emptySyncOutcome(null), phoneWritable: true, plan: { items: [held] } as never, done: [held] }];
    const sync = await load();
    await sync.synchronizeWithPhone();
    await sync.answerPhoneSyncQuestion('leave');
    expect(calls).toHaveLength(1);
    expect(sync.phoneSyncStep()).toMatchObject({ step: 'over', result: { kind: 'synced' } });
  });

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
