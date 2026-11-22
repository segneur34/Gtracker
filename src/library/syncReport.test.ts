import { describe, expect, it } from 'vitest';
import { emptySyncOutcome, type SyncOutcome } from './syncOutcome';
import type { SyncCase, SyncItem, SyncOp, SyncPlan } from './syncPlan';
import {
  describePhoneState, describePhoneSync, describeQuestion, describeSync, describeSyncQuestion, mergeSyncPasses, syncHasChangedItems,
  syncProgressText, syncSubtitle, type SyncQuestion, type SyncReport,
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

/** Les lignes du compte rendu, « geste : ce qu'il a touché ». */
const rowsOf = (report: SyncReport): string[] => report.rows.map((row) => `${row.label} : ${row.text}`);
const notesOf = (report: SyncReport): string[] => report.notes.map((note) => note.text);

describe('compte rendu : ce qui s’est échangé', () => {
  it('rien à faire : « Tout est à jour », un seul bouton', () => {
    expect(describeSync(outcomeOf([]))).toEqual({
      title: 'Tout est à jour', paragraphs: ['Rien à échanger : les deux appareils ont les mêmes sessions et les mêmes itinéraires.'],
      detail: null, rows: [], notes: [], folder: null, action: 'close',
    });
  });

  it('rangé par geste : reçu, envoyé, modifié, supprimé par appareil ; sessions et itinéraires comptés à part, jamais additionnés', () => {
    const items = [
      item('newOnComputer', [OPS.toPhone]), item('newOnComputer', [OPS.toPhone]), item('newOnComputer', [OPS.toPhone]),
      ...Array.from({ length: 5 }, () => item('newOnPhone', [OPS.toComputer])),
      item('followed', [OPS.record]), item('followed', [OPS.record]),
      item('deletedOnPhone', [OPS.trash]), item('deletedOnComputer', [OPS.remove]), item('deletedOnComputer', [OPS.remove]),
    ];
    const routes = [
      route('newOnComputer', [copyTo('phone')]), route('newOnComputer', [copyTo('phone')]), route('newOnPhone', [copyTo('computer')]),
      route('followed', [copyTo('phone')]),
    ];
    const said = describeSync(outcomeOf(items, routesOf(routes)));
    expect(said.title).toBe('Synchronisation terminée');
    expect(rowsOf(said)).toEqual([
      'Reçu du téléphone : 5 sessions, 1 itinéraire',
      'Envoyé au téléphone : 3 sessions, 2 itinéraires',
      "Modifié : 2 sessions, 1 itinéraire, recopiés sur l'autre appareil",
      "Supprimé : 1 session supprimée sur le téléphone : elle est dans la corbeille de l'ordinateur pour 30 jours",
      "Supprimé : 2 sessions supprimées sur l'ordinateur, retirées du téléphone : elles restent 30 jours dans la corbeille de l'ordinateur",
    ]);
    expect(said.notes).toEqual([]);
    expect(said.action).toBe('close');
    // « Touchez Mettre à jour » est parti : le téléphone se met à jour seul.
    expect(JSON.stringify(said)).not.toMatch(/Mettre à jour/);
  });

  it('chaque ligne se déplie en noms : le nom montré de l’issue, sinon la date de départ', () => {
    const named = item('deletedOnPhone', [OPS.trash]);
    const dated = item('deletedOnPhone', [OPS.trash]);
    const tour = route('deletedOnPhone', [{ kind: 'trash', files: listed, absent: 'tour.json' }]);
    const said = describeSync(outcomeOf([named, dated], {
      ...routesOf([tour]), names: { sessions: { [named.startMs]: 'sam. 14 nov. · Wing · Carnon-Plage' }, routes: { [tour.id]: 'Tour du cap' } },
    }));
    expect(said.rows).toHaveLength(1);
    expect(said.rows[0].text).toBe("2 sessions, 1 itinéraire supprimés sur le téléphone : ils sont dans la corbeille de l'ordinateur pour 30 jours");
    expect(said.rows[0].names[0]).toBe('sam. 14 nov. · Wing · Carnon-Plage');
    expect(said.rows[0].names[1]).toMatch(/\d/);
    expect(said.rows[0].names[2]).toBe('Tour du cap');
  });

  it('restaurée : dite « Restauré », jamais « envoyée » ni « supprimée »', () => {
    const back = item('newOnComputer', [OPS.toPhone], { restored: true });
    const both = item('firstMeeting', [], { restored: true });
    const tour = route('newOnComputer', [copyTo('phone')], { restored: true });
    const said = describeSync(outcomeOf([back, both], routesOf([tour])));
    expect(rowsOf(said)).toEqual([
      'Restauré : 1 session, 1 itinéraire sortis de la corbeille : renvoyés au téléphone',
      'Restauré : 1 session sortie de la corbeille : de nouveau sur les deux appareils',
    ]);
    expect(JSON.stringify(said)).not.toMatch(/Envoyé au téléphone|supprimé/i);
  });

  it('« Tout garder » ou « Les garder » : une ligne « Gardé », ces sessions ne sont pas dites envoyées', () => {
    const recopied = item('newOnComputer', [OPS.toPhone]);
    const said = describeSync(outcomeOf([recopied], {
      kept: { sessions: [recopied.startMs, T0], routes: ['r'], fromTrash: { sessions: [T0], routes: [] } },
      names: { sessions: { [T0]: 'Palavas' }, routes: { r: 'Baie' } },
    }));
    expect(rowsOf(said)).toEqual(['Gardé : 2 sessions, 1 itinéraire gardés : remis là où ils manquaient']);
    expect(said.rows[0].names).toEqual([expect.stringMatching(/\d/), 'Palavas', 'Baie']);
  });

  it('première synchronisation : rien n’a été supprimé, et où est la copie de sécurité', () => {
    const said = describeSync(outcomeOf([item('newOnPhone', [OPS.toComputer])], { first: 'noBase', safetyCopy: 'C:\\copies\\x' }));
    expect(said.paragraphs).toEqual(["Première synchronisation : rien n'a été supprimé.", 'Copie de sécurité :']);
    expect(said.folder).toBe('C:\\copies\\x');
  });

  it('la synchronisation précédente arrêtée en route est dite terminée', () => {
    expect(describeSync(outcomeOf([], { interrupted: true })).paragraphs[0]).toBe("La synchronisation précédente s'était arrêtée en route : elle vient d'être terminée.");
  });

  it('modifiée des deux côtés : l’encadré dit ce qui est gardé', () => {
    expect(notesOf(describeSync(outcomeOf([item('followed', [OPS.record], { conflicts: ['notes'] })])))).toEqual([
      "1 session modifiée sur les deux appareils : là où les deux ont changé la même chose, c'est la version de l'ordinateur qui est gardée.",
    ]);
    const tour = route('followed', [{ kind: 'loserToTrash', side: 'phone', files: listed }, copyTo('phone')], { conflict: true });
    expect(notesOf(describeSync(outcomeOf([], routesOf([tour]))))).toEqual([
      "1 itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours).",
    ]);
  });
});

describe('compte rendu : ce qui n’a pas été fait', () => {
  it('session pas finie, trace différente, version plus récente : la raison, puis la suite', () => {
    const items = [
      item('newOnPhone', [], { left: 'unfinishedGpx', files: { computer: null, phone: 'b.gpx' } }),
      item('followed', [], { left: 'changedGpx' }),
      item('followed', [], { left: 'futureRecord' }),
    ];
    expect(notesOf(describeSync(outcomeOf(items, { done: [] })))).toEqual([
      "1 session du téléphone n'a pas été prise : elle est encore en cours d'enregistrement ou de rangement. Elle viendra à la prochaine synchronisation.",
      "1 session n'a pas été touchée : son fichier de trace n'est plus le même sur les deux appareils. Gtracker ne choisit pas à votre place.",
      "1 session n'a pas été touchée : elle vient d'une version plus récente de Gtracker. Installez la dernière version de ce programme.",
    ]);
  });

  it('fichiers illisibles nommés ; sessions de la corbeille encore sur le téléphone : pas dans le compte rendu', () => {
    const plan = { items: [route('newOnPhone', [], { left: 'unreadable', files: { computer: null, phone: 'abîmé' } })], aside: [{ side: 'phone' as const, base: 'x', reason: 'unreadable' as const }], guard: noGuard };
    const held = item('deletedOnComputer', [], { left: 'inTrash', base: { kind: 'hold' } });
    const said = describeSync(outcomeOf([held], { done: [], ...routesOf([], { plan }) }));
    expect(notesOf(said)).toEqual(["2 fichiers illisibles n'ont pas été touchés : « abîmé », « x »."]);
  });

  it('changée pendant l’opération (après la reprise) : elle passera à la prochaine synchronisation', () => {
    const changed = item('followed', []);
    expect(notesOf(describeSync(outcomeOf([], { skipped: [changed], ...routesOf([], { skipped: [route('followed', [])] }) })))).toEqual([
      '1 session, 1 itinéraire étaient en cours de modification : ils passeront à la prochaine synchronisation.',
    ]);
  });

  it('le téléphone qui enregistre : rien ne lui a été envoyé', () => {
    const said = describeSync(outcomeOf([], { phoneWritable: false, phoneRecording: true, withheldForPhone: [item('newOnComputer', [OPS.toPhone])] }));
    expect(notesOf(said)).toEqual(['Le téléphone enregistre une session : rien ne lui a été envoyé. Ce qui lui manque partira à la prochaine synchronisation.']);
    expect(said.title).toBe('Synchronisation terminée');
  });

  it('ancien Gtracker par le Wi-Fi : une seule phrase, avec ce qui l’attend, sessions et itinéraires à part', () => {
    const said = describeSync(outcomeOf([], {
      phoneWritable: false, first: 'noBase', withheldForPhone: [item('newOnComputer', []), item('deletedOnComputer', [])],
      ...routesOf([], { withheldForPhone: [route('newOnComputer', [])] }),
    }));
    expect(said.paragraphs).toEqual([]);
    expect(notesOf(said)).toEqual([
      "Le Gtracker du téléphone est trop ancien pour recevoir par le Wi-Fi : mettez-le à jour (Réglages › Application du téléphone). 2 sessions et 1 itinéraire l'attendent.",
    ]);
  });

  it('écriture ratée sur l’ordinateur : « Recommencer », la raison repliée', () => {
    const broken = item('newOnPhone', [OPS.toComputer]);
    const said = describeSync(outcomeOf([], { failed: [{ item: broken, detail: 'Disque plein.' }], complete: false }));
    expect(said.notes).toEqual([{ text: "1 session n'a pas pu être rangée sur l'ordinateur.", detail: 'Disque plein' }]);
    expect(said.action).toBe('restart');
  });

  it('liaison perdue ou panne : arrêtée en route, ce qui est fait est gardé, « Recommencer »', () => {
    const lost = describeSync(outcomeOf([], { linkLost: 'perdu', complete: false }));
    expect(lost).toMatchObject({ title: 'Synchronisation arrêtée', action: 'restart' });
    expect(lost.notes[0].text).toBe("Le téléphone n'est plus relié : la synchronisation s'est arrêtée en route. Ce qui est fait est gardé.");
    const broken = describeSync(outcomeOf([], { error: 'Panne.', complete: false }));
    expect(broken.notes).toEqual([{ text: "La synchronisation s'est arrêtée. Ce qui est fait est gardé.", detail: 'Panne' }]);
  });

  it('question fermée sans réponse : ce qui attend, par appareil, et « Répondre »', () => {
    const question: SyncQuestion = {
      kind: 'guard',
      sessions: [
        { startMs: 1, side: 'computer', file: 'a.gpx', label: 'a' }, { startMs: 2, side: 'computer', file: 'b.gpx', label: 'b' },
      ],
      routes: [{ id: 'r', side: 'phone', label: 'tour' }],
    };
    const said = describeSync(outcomeOf([item('newOnPhone', [OPS.toComputer])]), question);
    expect(notesOf(said)).toEqual(["Des suppressions attendent votre réponse : 2 sessions sur le téléphone, 1 itinéraire sur l'ordinateur."]);
    expect(said.action).toBe('answer');
    const held: SyncQuestion = { kind: 'inTrash', sessions: [{ startMs: 1, side: 'phone', file: 'a.gpx', label: 'a' }], routes: [] };
    expect(notesOf(describeSync(outcomeOf([]), held))).toEqual(['1 session de la corbeille de cet ordinateur, encore sur le téléphone, attend votre réponse.']);
  });

  it('réponse qui n’a pas pu s’appliquer : ce qui était fait reste, la raison et « Répondre »', () => {
    const question: SyncQuestion = { kind: 'guard', sessions: [{ startMs: 1, side: 'computer', file: 'a.gpx', label: 'a' }], routes: [] };
    const done = { kind: 'synced' as const, phone: 'X', channel: 'cable' as const, outcome: outcomeOf([item('newOnComputer', [OPS.toPhone])]) };
    const gone = describePhoneSync(done, question, { kind: 'error', detail: 'Liaison fermée.' });
    expect(rowsOf(gone)).toEqual(['Envoyé au téléphone : 1 session']);
    expect(gone.notes).toEqual([
      { text: "Votre réponse n'a pas pu s'appliquer : rien n'a été supprimé ni remis. Le téléphone ne répond plus. Répondez de nouveau quand il est là : écran allumé, Gtracker affiché.", detail: 'Liaison fermée' },
      { text: 'Des suppressions attendent votre réponse : 1 session sur le téléphone.', detail: null },
    ]);
    expect(gone.action).toBe('answer');
    const busy = describePhoneSync(done, question, { ...done, outcome: emptySyncOutcome('busy') });
    expect(busy.notes[0].text).toBe("Votre réponse n'a pas pu s'appliquer : rien n'a été supprimé ni remis. L'ordinateur est occupé (import ou enregistrement en cours). Répondez de nouveau quand il a fini.");
    const locked = describePhoneSync(done, question, { ...done, outcome: emptySyncOutcome('trashLocked') });
    expect(locked.notes[0].text).toMatch(/s'appliquer.*La corbeille de cet ordinateur est illisible/);
  });

  it('réglages : rien dit quand ils sont recopiés ; deux appareils du même nom ; échange arrêté', () => {
    const extras = {
      done: [{ kind: 'settings' as const, to: 'phone' as const, path: 'reglages/PC.json', text: '{}', replaces: null, added: 0 }],
      left: [
        { kind: 'settings' as const, path: 'reglages/Redmi.json', side: null, reason: 'otherDevice' as const },
        { kind: 'places' as const, path: 'lieux.json', side: 'phone' as const, reason: 'failed' as const },
      ],
      withheld: [],
    };
    expect(notesOf(describeSync(outcomeOf([], { extras })))).toEqual([
      "Deux appareils s'appellent « Redmi » : renommez-en un dans Réglages › Mémoire pour que leurs réglages s'échangent.",
      "Réglages, lieux et FC repos n'ont pas pu être échangés cette fois : ils le seront à la prochaine.",
    ]);
    expect(describeSync(outcomeOf([], { extras: { ...extras, left: [] } })).title).toBe('Tout est à jour');
  });

  it('activité inconnue de l’ordinateur : elle sera demandée à l’ouverture', () => {
    expect(notesOf(describeSync(outcomeOf([], { unknownActivities: [{ side: 'computer', startMs: T0, activityId: 'a-moth' }] })))).toEqual([
      "1 session utilise une activité que cet ordinateur n'a pas. Elle vous sera demandée à son ouverture, ou prenez les réglages du téléphone dans Réglages › Mémoire.",
    ]);
  });
});

describe('synchronisation impossible et téléphone pas prêt', () => {
  it('refus : une phrase, avec où agir ; trois versions plus récentes en une seule', () => {
    expect(describeSync({ ...emptySyncOutcome('safetyCopy'), error: 'disque plein' })).toMatchObject({
      title: 'Synchronisation impossible', paragraphs: ["La copie de sécurité n'a pas pu être faite : rien n'a été synchronisé."], detail: 'disque plein', action: 'restart',
    });
    const newer = ['computerNewer', 'phoneNewer', 'newerBase'] as const;
    expect(new Set(newer.map((r) => describeSync(emptySyncOutcome(r)).paragraphs[0])).size).toBe(1);
    expect(describeSync(emptySyncOutcome('newerBase')).action).toBe('close');
    expect(describeSync(emptySyncOutcome('memory')).paragraphs).toEqual(["La mémoire de cet ordinateur n'est pas disponible. Vérifiez son dossier dans Réglages › Mémoire."]);
    expect(describeSync(emptySyncOutcome('phoneNoMarker')).paragraphs).toEqual(describePhoneSync({ kind: 'no-phone-folder', phone: 'X' }).paragraphs);
  });

  it('téléphone pas prêt : sa phrase et « Réessayer » ; avancement et sous-titre', () => {
    expect(describePhoneState({ kind: 'tool-missing', folder: 'C:\\adb' })).toMatchObject({ folder: 'C:\\adb', action: 'retry' });
    expect(describePhoneSync({ kind: 'phone', state: 'horsLigne' }).paragraphs).toHaveLength(1);
    expect(describePhoneSync({ kind: 'synced', phone: 'Xiaomi', channel: 'cable', outcome: outcomeOf([]) }).title).toBe('Tout est à jour');
    expect(syncProgressText(12, 50)).toBe('Échange des sessions et des itinéraires : 12 fichiers sur 50.');
    expect(syncProgressText(0, 0)).toBe('Échange des sessions et des itinéraires…');
    expect(syncSubtitle('Redmi', 'sansFil')).toBe('Redmi · par le Wi-Fi');
    expect(syncSubtitle('Redmi', 'cable')).toBe('Redmi · par le câble');
  });
});

describe('deux passes, un compte rendu', () => {
  it('la reprise d’une session changée en route : ce que la première a fait reste, la seconde dit l’état final', () => {
    const changed = item('newOnPhone', [OPS.toComputer]);
    const sent = item('newOnComputer', [OPS.toPhone]);
    const first = outcomeOf([sent], { first: 'noBase', safetyCopy: 'C:\\c', skipped: [changed], complete: false, names: { sessions: { [sent.startMs]: 'A' }, routes: {} } });
    expect(syncHasChangedItems(first)).toBe(true);
    const second = outcomeOf([{ ...sent, ops: [] }, changed], { names: { sessions: { [changed.startMs]: 'B' }, routes: {} } });
    const merged = mergeSyncPasses(first, second);
    expect(syncHasChangedItems(merged)).toBe(false);
    expect(merged).toMatchObject({ first: 'noBase', safetyCopy: 'C:\\c', skipped: [] });
    const said = describeSync(merged);
    expect(rowsOf(said)).toEqual(['Reçu du téléphone : 1 session', 'Envoyé au téléphone : 1 session']);
    expect(said.rows.flatMap((r) => r.names)).toEqual(['B', 'A']);
    expect(notesOf(said)).toEqual([]);
  });

  it('une passe refusée laisse l’issue de la première ; une liaison perdue n’appelle pas de reprise', () => {
    const first = outcomeOf([item('newOnComputer', [OPS.toPhone])]);
    expect(mergeSyncPasses(first, emptySyncOutcome('busy'))).toBe(first);
    expect(syncHasChangedItems(outcomeOf([], { skipped: [item('followed', [])], linkLost: 'perdu' }))).toBe(false);
  });
});

describe('la question', () => {
  it('suppressions en nombre : rangées par appareil, noms visibles, deux réponses', () => {
    const onPhone = Array.from({ length: 8 }, () => item('deletedOnPhone', [OPS.trash]));
    const onComputer = Array.from({ length: 4 }, () => item('deletedOnComputer', [OPS.remove]));
    const tour = route('deletedOnComputer', []);
    const outcome = outcomeOf([], {
      deletions: 'awaitingConfirmation', withheldDeletions: [...onPhone, ...onComputer], complete: false,
      names: { sessions: { [onPhone[0].startMs]: 'sam. 14 nov. · Wing · Carnon-Plage' }, routes: {} }, ...routesOf([], { withheldDeletions: [tour] }),
    });
    const question = describeSyncQuestion(outcome) as SyncQuestion;
    expect(question.kind).toBe('guard');
    expect(question.sessions.filter((s) => s.side === 'computer')).toHaveLength(8);
    const text = describeQuestion(question);
    expect(text).toMatchObject({
      title: "Beaucoup de suppressions d'un coup", intro: 'Depuis la dernière synchronisation :',
      ask: "Faut-il les supprimer aussi de l'autre appareil ? Rien n'est perdu : tout reste 30 jours dans la corbeille de l'ordinateur.",
      keepLabel: 'Tout garder', removeLabel: 'Supprimer des deux côtés',
      hint: '« Tout garder » remet chaque session et chaque itinéraire là où ils manquent. Fermer la fenêtre ne décide rien : la question reviendra.',
    });
    expect(rowsOf({ ...describeSync(outcomeOf([])), rows: text.rows })).toEqual([
      'Sur le téléphone : 8 sessions supprimées', "Sur l'ordinateur : 4 sessions, 1 itinéraire supprimés",
    ]);
    expect(text.rows[0].names[0]).toBe('sam. 14 nov. · Wing · Carnon-Plage');
    expect(text.rows[0].names).toHaveLength(8);
    expect(text.rows[1].names[4]).toBe('tour');
  });

  it('une seule suppression : le titre et la question s’accordent', () => {
    const question = describeSyncQuestion(outcomeOf([], { deletions: 'awaitingConfirmation', withheldDeletions: [item('deletedOnPhone', [OPS.trash])] })) as SyncQuestion;
    expect(describeQuestion(question)).toMatchObject({
      title: 'Une suppression à confirmer', hint: '« Tout garder » remet chaque session là où elle manque. Fermer la fenêtre ne décide rien : la question reviendra.',
    });
    expect(describeQuestion(question).ask).toMatch(/^Faut-il la supprimer/);
  });

  it('corbeille encore sur le téléphone : seulement si le téléphone s’écrit, les suppressions permises et rien d’arrêté', () => {
    const held = [item('deletedOnComputer', [], { left: 'inTrash', base: { kind: 'hold' } })];
    expect(describeSyncQuestion(outcomeOf(held))).toMatchObject({ kind: 'inTrash' });
    expect(describeSyncQuestion(outcomeOf(held, { phoneWritable: false }))).toBeNull();
    expect(describeSyncQuestion(outcomeOf(held, { deletions: 'excluded' }))).toBeNull();
    expect(describeSyncQuestion(outcomeOf(held, { linkLost: 'perdu' }))).toBeNull();
    expect(describeSyncQuestion(emptySyncOutcome('busy'))).toBeNull();
  });

  it('corbeille : même forme, réponses accordées à ce qu’elle nomme', () => {
    const two = [0, 1].map(() => item('deletedOnComputer', [], { left: 'inTrash' }));
    const text = describeQuestion(describeSyncQuestion(outcomeOf(two)) as SyncQuestion);
    expect(text).toMatchObject({
      title: 'Supprimée ici, encore sur le téléphone', intro: '2 sessions sont dans la corbeille de cet ordinateur, mais encore sur le téléphone :',
      keepLabel: 'Les garder', removeLabel: 'Les retirer du téléphone',
      hint: '« Les garder » les sort de la corbeille : elles sont de nouveau sur les deux appareils.', ask: null,
    });
    expect(text.names).toHaveLength(2);
    const tour = route('newOnPhone', [], { left: 'inTrash', files: { computer: null, phone: 'tour' } });
    const onlyRoute = describeQuestion(describeSyncQuestion(outcomeOf([], routesOf([tour], { done: [] }))) as SyncQuestion);
    expect(onlyRoute).toMatchObject({ title: 'Supprimé ici, encore sur le téléphone', keepLabel: 'Le garder', names: ['tour'] });
    const mixed = describeQuestion(describeSyncQuestion(outcomeOf([two[0]], routesOf([tour], { done: [] }))) as SyncQuestion);
    expect(mixed.intro).toBe('1 session, 1 itinéraire sont dans la corbeille de cet ordinateur, mais encore sur le téléphone :');
    expect(mixed.keepLabel).toBe('Les garder');
  });
});
