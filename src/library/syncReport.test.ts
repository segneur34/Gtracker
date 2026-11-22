import { describe, expect, it } from 'vitest';
import { emptySyncOutcome, type SyncOutcome } from './syncOutcome';
import type { SyncCase, SyncItem, SyncOp, SyncPlan } from './syncPlan';
import {
  describePhoneState, describePhoneSync, describeSync, describeSyncQuestion, syncProgressText, syncQuestionConfirmLabel, syncQuestionLeaveLabel,
  syncQuestionListLabel, type SyncQuestion,
} from './syncReport';
import type { RouteSyncItem, RouteSyncOp } from './syncRoutes';

const T0 = Date.UTC(2026, 10, 1, 10, 0, 0);
const stamp = (name: string) => ({ name, size: 10, mtimeMs: 0 });
const files = { gpx: stamp('a.gpx'), record: stamp('a.json'), imu: null };
const target = { gpx: 'a.gpx', record: 'a.json', imu: null };

const OPS: Record<string, SyncOp> = {
  toPhone: { kind: 'copy', to: 'phone', source: files, target, recordText: null },
  toComputer: { kind: 'copy', to: 'computer', source: files, target, recordText: null },
  record: { kind: 'writeRecord', on: 'phone', file: stamp('a.json'), text: '{}' },
  trash: { kind: 'trash', files: [stamp('a.gpx')], absent: 'a.gpx' },
  remove: { kind: 'removeFromPhone', files: [stamp('a.gpx')], absent: 'a.gpx', keep: 'none', recordText: null },
};

let next = 0;
const item = (kind: SyncCase, ops: SyncOp[], patch: Partial<SyncItem> = {}): SyncItem => ({
  startMs: T0 + ++next * 3_600_000, case: kind, files: { computer: 'a.gpx', phone: 'a.gpx' }, ops, base: { kind: 'keep' }, left: null,
  conflicts: [], twoTracks: false, withoutAncestor: false, ...patch,
});

const planOf = (items: SyncItem[]): SyncPlan => ({
  pair: { first: null, base: null, newId: { computer: false, phone: false } }, saveBase: true, items, duplicates: [], unknown: [],
  guard: { tripped: false, toTrash: 0, fromPhone: 0, count: { computer: 0, phone: 0 } },
});

const outcomeOf = (items: SyncItem[], patch: Partial<SyncOutcome> = {}): SyncOutcome => ({
  ...emptySyncOutcome(null), phoneWritable: true, complete: true, plan: planOf(items), done: items, ...patch,
});

describe('compte rendu de la synchronisation', () => {
  it('rien à faire : les deux appareils sont à jour', () => {
    expect(describeSync(outcomeOf([]))).toEqual({ paragraphs: ['Les deux appareils sont à jour.'], folder: null, retry: false });
  });

  it('une ligne par cas non nul, et « Mettre à jour » dès qu’une écriture a visé le téléphone', () => {
    const items = [
      item('newOnComputer', [OPS.toPhone]), item('newOnComputer', [OPS.toPhone]), item('newOnPhone', [OPS.toComputer]),
      item('followed', [OPS.record], { conflicts: ['notes'] }), item('deletedOnPhone', [OPS.trash]), item('deletedOnComputer', [OPS.remove]),
      item('newOnPhone', [], { left: 'unfinishedGpx', files: { computer: null, phone: 'b.gpx' } }),
    ];
    const outcome = outcomeOf(items, { unknownActivities: [{ side: 'computer', startMs: T0, activityId: 'a-moth' }] });
    expect(describeSync(outcome).paragraphs).toEqual([
      "2 sessions copiées vers le téléphone, 1 vers l'ordinateur.",
      '1 session modifiée recopiée.',
      "1 session supprimée sur le téléphone : mise dans la corbeille de l'ordinateur (30 jours).",
      "1 session supprimée sur l'ordinateur : retirée du téléphone.",
      "1 session modifiée sur les deux appareils : les changements de l'ordinateur l'ont emporté.",
      "1 session laissée pour la prochaine fois : elle n'est pas finie sur le téléphone.",
      "1 session d'une activité que l'ordinateur ne connaît pas : reprenez les réglages du téléphone (Réglages, Mémoire).",
      'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.',
    ]);
  });

  it('première synchronisation avec copie de sécurité : dit, et le dossier est rendu à part', () => {
    const text = describeSync(outcomeOf([item('newOnPhone', [OPS.toComputer])], { first: 'noBase', safetyCopy: 'C:\\copies\\x' }));
    expect(text.paragraphs[0]).toBe("Première synchronisation avec ce téléphone : rien n'a été supprimé.");
    expect(text.folder).toBe('C:\\copies\\x');
  });

  it('par le sans-fil : ce qui attend le câble est compté, rien n’est dit du téléphone mis à jour', () => {
    const waiting = [item('newOnComputer', [OPS.toPhone]), item('deletedOnComputer', [OPS.remove])];
    const text = describeSync(outcomeOf([item('newOnPhone', [OPS.toComputer])], { phoneWritable: false, complete: false, withheldForPhone: waiting }), 'sansFil');
    expect(text.paragraphs).toEqual([
      "Sans câble, le téléphone n'est pas modifié : seules ses sessions sont copiées vers l'ordinateur.",
      "1 session copiée vers l'ordinateur.", '2 changements attendent le câble ou la mise à jour du téléphone.',
    ]);
  });

  it('par le sans-fil, téléphone à jour : plus aucune ligne d’attente, comme par le câble', () => {
    const text = describeSync(outcomeOf([item('newOnComputer', [OPS.toPhone]), item('newOnPhone', [OPS.toComputer])]), 'sansFil');
    expect(text.paragraphs).toEqual([
      "1 session copiée vers le téléphone, 1 vers l'ordinateur.", 'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.',
    ]);
    expect(text.paragraphs.join(' ')).not.toMatch(/câble|attend/);
  });

  it('par le sans-fil, le téléphone qui enregistre : sa phrase à la place de l’attente, la moitié de l’ordinateur est faite', () => {
    const waiting = [item('newOnComputer', [OPS.toPhone]), item('deletedOnComputer', [OPS.remove])];
    const outcome = outcomeOf([item('newOnPhone', [OPS.toComputer])], { phoneWritable: false, phoneRecording: true, complete: false, withheldForPhone: waiting });
    expect(describeSync(outcome, 'sansFil').paragraphs).toEqual([
      "1 session copiée vers l'ordinateur.", "Le téléphone enregistre une session : il n'a pas été modifié cette fois.",
    ]);
    // Rien à copier : la phrase est dite quand même, et pas « à jour ».
    expect(describeSync(outcomeOf([], { phoneWritable: false, phoneRecording: true }), 'sansFil').paragraphs).toEqual([
      "Le téléphone enregistre une session : il n'a pas été modifié cette fois.",
    ]);
  });

  it('par le sans-fil, le téléphone sans identifiant n’est pas « la première synchronisation » à chaque passe', () => {
    const text = describeSync(outcomeOf([], { phoneWritable: false, first: 'noBase' }), 'sansFil');
    expect(text.paragraphs).toEqual([
      "Sans câble, le téléphone n'est pas modifié : seules ses sessions sont copiées vers l'ordinateur.",
      'Les deux appareils sont à jour.',
    ]);
  });

  it('liaison perdue, échec et session changée en route : dits, « Réessayer » proposé', () => {
    const broken = item('newOnPhone', [OPS.toComputer]);
    const text = describeSync(outcomeOf([], { failed: [{ item: broken, detail: 'Disque plein.' }], skipped: [broken], linkLost: 'perdu', complete: false }));
    expect(text.retry).toBe(true);
    expect(text.paragraphs).toEqual([
      '1 session non synchronisée cette fois : elle a été modifiée pendant l’opération. Elle le sera au prochain « Synchroniser ».',
      "1 session n'a pas pu être écrite sur l'ordinateur (Disque plein).",
      'Le téléphone a été débranché pendant la synchronisation. Ce qui est fait est gardé : rebranchez-le, puis cliquez sur « Réessayer » pour finir.',
    ]);
  });

  it('refus : une phrase, sans compte rendu ; la copie de sécurité dit sa raison', () => {
    expect(describeSync({ ...emptySyncOutcome('safetyCopy'), error: 'disque plein' }).paragraphs).toEqual([
      "La copie de sécurité des deux appareils n'a pas pu être faite (disque plein) : rien n'a été synchronisé.",
    ]);
    expect(describeSync(emptySyncOutcome('busy')).retry).toBe(true);
    expect(describeSync(emptySyncOutcome('newerBase')).retry).toBe(false);
  });

  it('état du téléphone et issue entière du bouton', () => {
    expect(describePhoneState({ kind: 'tool-missing', folder: 'C:\\adb' }).folder).toBe('C:\\adb');
    expect(describePhoneSync({ kind: 'phone', state: 'horsLigne' }).paragraphs).toHaveLength(1);
    expect(describePhoneSync({ kind: 'synced', phone: 'Xiaomi', channel: 'cable', outcome: outcomeOf([]) }).paragraphs).toEqual(['Les deux appareils sont à jour.']);
    expect(syncProgressText(12, 50)).toBe('12 fichiers sur 50');
  });
});

describe('questions de la synchronisation', () => {
  it('garde-fou : le nombre et la liste, chaque session du côté dont elle serait retirée', () => {
    const withheld = [item('deletedOnPhone', [OPS.trash]), item('deletedOnComputer', [OPS.remove])];
    const question = describeSyncQuestion(outcomeOf([], { deletions: 'awaitingConfirmation', withheldDeletions: withheld, complete: false }));
    expect(question).toMatchObject({ kind: 'guard', count: 2, text: "Cette synchronisation retirerait 2 sessions. Rien n'est encore supprimé." });
    expect(question?.sessions.map((s) => s.side)).toEqual(['computer', 'phone']);
  });

  it('sessions de la corbeille encore sur le téléphone : seulement si le téléphone s’écrit, les suppressions permises et rien d’arrêté', () => {
    const held = [item('deletedOnComputer', [], { left: 'inTrash', base: { kind: 'hold' } })];
    expect(describeSyncQuestion(outcomeOf(held))).toMatchObject({ kind: 'inTrash', count: 1 });
    expect(describeSyncQuestion(outcomeOf(held, { phoneWritable: false }))).toBeNull();
    expect(describeSyncQuestion(outcomeOf(held, { deletions: 'excluded' }))).toBeNull();
    expect(describeSyncQuestion(outcomeOf(held, { linkLost: 'perdu' }))).toBeNull();
    expect(describeSyncQuestion(emptySyncOutcome('busy'))).toBeNull();
  });
});

describe('compte rendu et questions des itinéraires', () => {
  const listed = { base: 'tour', json: stamp('tour.json'), gpx: stamp('tour.gpx') };
  const noGuard = { tripped: false, toTrash: 0, fromPhone: 0, count: { computer: 0, phone: 0 } };
  const route = (kind: SyncCase, ops: RouteSyncOp[], patch: Partial<RouteSyncItem> = {}): RouteSyncItem => ({
    id: `id-${++next}`, createdAt: null, case: kind, files: { computer: 'tour', phone: 'tour' }, ops, base: { kind: 'keep' }, left: null,
    conflict: false, revived: false, ...patch,
  });
  const copyTo = (to: 'computer' | 'phone'): RouteSyncOp => ({ kind: 'copy', to, source: listed, base: 'tour', replaces: { json: null, gpx: null } });
  const routesOf = (items: RouteSyncItem[], patch: Partial<SyncOutcome['routes']> = {}): Partial<SyncOutcome> => ({
    routes: { ...emptySyncOutcome(null).routes, plan: { items, aside: [], guard: noGuard }, done: items, ...patch },
  });

  it('une ligne par cas, et « Mettre à jour » quand le téléphone a reçu un itinéraire', () => {
    const items = [
      route('newOnComputer', [copyTo('phone')]), route('newOnComputer', [copyTo('phone')]), route('newOnPhone', [copyTo('computer')]),
      route('followed', [copyTo('phone')]),
      route('deletedOnPhone', [{ kind: 'trash', files: listed, absent: 'tour.json' }]),
      route('deletedOnComputer', [{ kind: 'removeFromPhone', files: listed, absent: 'tour.json', keep: false }]),
      route('followed', [{ kind: 'loserToTrash', side: 'phone', files: listed }, copyTo('phone')], { conflict: true }),
    ];
    expect(describeSync(outcomeOf([], routesOf(items))).paragraphs).toEqual([
      "2 itinéraires copiés vers le téléphone, 1 vers l'ordinateur.",
      '1 itinéraire modifié recopié.',
      "1 itinéraire supprimé sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours).",
      "1 itinéraire supprimé sur l'ordinateur : retiré du téléphone.",
      "1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours).",
      'Sur le téléphone, touchez « Mettre à jour » pour voir les changements.',
    ]);
  });

  it('laissés tels quels, attente du câble, changés en route', () => {
    const left = [route('followed', [], { left: 'newer' }), route('newOnPhone', [], { left: 'unreadable' })];
    const plan = { items: left, aside: [{ side: 'phone' as const, base: 'x', reason: 'unreadable' as const }], guard: noGuard };
    const said = describeSync(outcomeOf([], routesOf([], { waiting: true, skipped: [route('followed', [])], plan })));
    expect(said.paragraphs).toEqual([
      'Les itinéraires attendent le câble ou la mise à jour du téléphone.',
      "3 itinéraires laissés tels quels : illisibles, ou d'une version plus récente de Gtracker.",
      '1 itinéraire non synchronisé cette fois : il a été modifié pendant l’opération. Il le sera au prochain « Synchroniser ».',
    ]);
    expect(said.retry).toBe(true);
  });

  it('corbeille encore sur le téléphone : sessions et itinéraires dans une seule question', () => {
    const held = route('newOnPhone', [], { left: 'inTrash', files: { computer: null, phone: 'tour' } });
    const onlyRoute = describeSyncQuestion(outcomeOf([], routesOf([held], { done: [] })));
    expect(onlyRoute).toMatchObject({ kind: 'inTrash', count: 1, routes: [{ id: held.id, side: 'phone', label: 'tour' }] });
    expect(syncQuestionLeaveLabel(onlyRoute as SyncQuestion)).toBe('Le laisser');
    const both = describeSyncQuestion(outcomeOf([item('deletedOnComputer', [], { left: 'inTrash' })], routesOf([held], { done: [] })));
    expect(both?.text).toBe("1 session et 1 itinéraire supprimés sur l'ordinateur sont encore sur le téléphone. Les retirer du téléphone ? Ils restent 30 jours dans la corbeille de l'ordinateur.");
    expect(syncQuestionLeaveLabel(both as SyncQuestion)).toBe('Les laisser');
  });

  it('garde-fou : les deux familles comptées dans la phrase, la liste et le bouton', () => {
    const removals = Array.from({ length: 3 }, () => route('deletedOnComputer', []));
    const sessions = Array.from({ length: 14 }, () => item('deletedOnPhone', []));
    const question = describeSyncQuestion(outcomeOf([], { deletions: 'awaitingConfirmation', withheldDeletions: sessions, ...routesOf([], { withheldDeletions: removals }) })) as SyncQuestion;
    expect(question.text).toBe("Cette synchronisation retirerait 14 sessions et 3 itinéraires. Rien n'est encore supprimé.");
    expect(question.count).toBe(17);
    expect(syncQuestionListLabel(question)).toBe('Voir les 17 sessions et itinéraires');
    expect(syncQuestionConfirmLabel(question)).toBe('Supprimer ces 17 sessions et itinéraires');
  });
});
