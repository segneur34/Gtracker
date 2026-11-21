import { describe, expect, it } from 'vitest';
import { RECORD_VERSION, serializeRecord, type SessionRecord, type StoredSessionNotes } from './record';
import { inspectSyncRecord, mergeSyncRecords, renamedSyncRecord, syncRecordChanged, type SyncRecordMerge } from './syncRecordMerge';
import { sessionRecord } from '../test/record.fixture';

const notes = (patch: Partial<StoredSessionNotes>): StoredSessionNotes => ({
  foil: '', mast: '', wing: '', gear1: '', gear2: '', conditions: '', gear: null, comment: '', windLevel: null, waterState: null, rating: null, savedAt: 100, ...patch,
});

const MARK = { timeMs: 5000, lat: null, lon: null, label: 'chute' };

type Loose = SessionRecord & Record<string, unknown>;

/** La fiche de l'ordinateur : son GPX, sa date d'entrée et son résumé à lui. */
const onComputer = (patch: Partial<Loose> = {}): Loose =>
  ({ ...sessionRecord({ gpx: 'pc.gpx', addedAt: '2026-11-02T08:00:00.000Z', source: 'import' }, { distanceM: 25_100, optionsKey: '[8]' }), ...patch });

/** La même session sur le téléphone. */
const onPhone = (patch: Partial<Loose> = {}): Loose =>
  ({ ...sessionRecord({ gpx: 'tel.gpx', addedAt: '2026-11-01T18:00:00.000Z' }, { distanceM: 24_900, optionsKey: '[6]' }), ...patch });

const text = (record: SessionRecord): string => serializeRecord(record);

interface Sides {
  computer: Loose;
  phone: Loose;
}

/** Fond deux fiches ; `before` : ce qu'elles étaient à la dernière synchronisation, absent à une première rencontre. */
const merge = (now: Sides, before?: Sides, options?: { editsOnly?: boolean }): SyncRecordMerge => {
  const merged = mergeSyncRecords({
    computer: text(now.computer), phone: text(now.phone),
    computerAncestor: before ? text(before.computer) : null, phoneAncestor: before ? text(before.phone) : null,
  }, options);
  if (!merged) throw new Error('fiches non fondues');
  return merged;
};

/** Les fiches après la fusion : le texte écrit, sinon la fiche restée telle quelle. */
const after = (now: Sides, merged: SyncRecordMerge): Sides => ({
  computer: merged.computer === null ? now.computer : JSON.parse(merged.computer),
  phone: merged.phone === null ? now.phone : JSON.parse(merged.phone),
});

describe('ce que la synchronisation peut faire d’une fiche', () => {
  it('fiche ordinaire, d’une version plus récente, illisible, sans résumé', () => {
    expect(inspectSyncRecord(text(onPhone()))).toMatchObject({ state: 'ok', startMs: onPhone().summary.startMs });
    expect(inspectSyncRecord(text(onPhone({ version: RECORD_VERSION + 1 })))).toMatchObject({ state: 'future', startMs: onPhone().summary.startMs });
    expect(inspectSyncRecord('{ coupé')).toEqual({ state: 'unreadable', startMs: null, record: null });
    expect(inspectSyncRecord(JSON.stringify({ ...onPhone(), summary: null }))).toEqual({ state: 'unreadable', startMs: null, record: null });
  });

  it('une fiche recopiée sous un autre nom nomme son nouveau GPX et garde tout le reste', () => {
    const renamed = JSON.parse(renamedSyncRecord(text(onPhone({ futur: { a: 1 } })), 'tel-2.gpx') as string);
    expect(renamed).toEqual({ ...onPhone({ futur: { a: 1 } }), gpx: 'tel-2.gpx' });
    expect(renamedSyncRecord(text(onPhone({ version: RECORD_VERSION + 1 })), 'tel-2.gpx')).toBeNull();
  });
});

describe('fusion à trois : ce qu’un côté a changé passe à l’autre', () => {
  const before: Sides = { computer: onComputer(), phone: onPhone() };

  it('rien de changé : rien à écrire', () => {
    expect(merge(before, before)).toEqual({ computer: null, phone: null, conflicts: [], union: false });
  });

  it('le résumé seul refait d’un côté n’est pas un changement', () => {
    const now = { ...before, computer: onComputer({ summary: { ...before.computer.summary, distanceM: 26_000, optionsKey: '[10]' } }) };
    expect(merge(now, before)).toMatchObject({ computer: null, phone: null });
    expect(syncRecordChanged(text(before.computer), text(now.computer))).toBe(false);
  });

  it('nom changé sur le téléphone : l’ordinateur le reçoit, et garde son GPX, sa date d’entrée et son résumé', () => {
    const now = { ...before, phone: onPhone({ name: 'Mistral', futur: { a: 1 } }) };
    const merged = merge(now, before);
    expect(merged.phone).toBeNull();
    expect(merged.conflicts).toEqual([]);
    // Un champ que cette version ne connaît pas voyage comme les autres.
    expect(after(now, merged).computer).toEqual({ ...before.computer, name: 'Mistral', futur: { a: 1 } });
    expect(syncRecordChanged(text(before.phone), text(now.phone))).toBe(true);
  });

  it('un champ que cette version ne sait pas lire reste intact du côté qui reçoit', () => {
    const computer = onComputer({ mapBase: 'relief' as never, analysis: { windDeg: 400 } as never });
    const start: Sides = { computer, phone: onPhone() };
    const now = { ...start, phone: onPhone({ name: 'Mistral' }) };
    const written = after(now, merge(now, start)).computer;
    expect(written.name).toBe('Mistral');
    expect(written.mapBase).toBe('relief');
    expect((written.analysis as unknown as Record<string, unknown>).windDeg).toBe(400);
  });

  it('champs différents changés des deux côtés : chacun reçoit ceux de l’autre, sans message', () => {
    const start: Sides = { computer: onComputer({ notes: notes({ comment: 'lu' }) }), phone: onPhone({ notes: notes({ comment: 'lu' }) }) };
    const now: Sides = {
      computer: onComputer({ name: 'Mistral', notes: notes({ comment: 'lu', conditions: 'clapot', savedAt: 300 }) }),
      phone: onPhone({ notes: notes({ comment: 'belle session', savedAt: 200 }), marks: [MARK] }),
    };
    const merged = merge(now, start);
    const both = after(now, merged);
    expect(merged.conflicts).toEqual([]);
    for (const side of [both.computer, both.phone]) {
      expect(side.name).toBe('Mistral');
      expect(side.marks).toEqual([MARK]);
      expect(side.notes).toMatchObject({ comment: 'belle session', conditions: 'clapot' });
    }
    // Chaque bloc garde la date de son appareil : aucune ne passe de l'un à l'autre.
    expect(both.computer.notes?.savedAt).toBe(300);
    expect(both.phone.notes?.savedAt).toBe(200);
    expect(both.computer.summary).toEqual(now.computer.summary);
    expect(both.phone.summary).toEqual(now.phone.summary);
    expect(both.phone.gpx).toBe('tel.gpx');
  });

  it('même champ de notes changé des deux côtés : l’ordinateur l’emporte et c’est dit, quelle que soit l’horloge du téléphone', () => {
    const start: Sides = { computer: onComputer({ notes: notes({ comment: 'lu' }) }), phone: onPhone({ notes: notes({ comment: 'lu' }) }) };
    // Le téléphone est en avance d'un an : sa date ne fait pas de lui le gagnant, et elle ne passe pas à l'ordinateur.
    const ahead = 200 + 365 * 86_400_000;
    const now: Sides = {
      computer: onComputer({ notes: notes({ comment: 'ordinateur', savedAt: 200 }) }),
      phone: onPhone({ notes: notes({ comment: 'téléphone', rating: 4, savedAt: ahead }) }),
    };
    const merged = merge(now, start);
    const both = after(now, merged);
    expect(merged.conflicts).toEqual(['notes.comment']);
    expect(both.computer.notes).toEqual(notes({ comment: 'ordinateur', rating: 4, savedAt: 200 }));
    expect(both.phone.notes).toEqual(notes({ comment: 'ordinateur', rating: 4, savedAt: ahead }));
    expect(merge(both, both)).toMatchObject({ computer: null, phone: null });
  });

  it('notes nées des deux côtés depuis : fondues champ par champ, aucun bloc n’écrase l’autre', () => {
    const now: Sides = {
      computer: onComputer({ notes: notes({ conditions: 'clapot', savedAt: 200 }) }),
      phone: onPhone({ notes: notes({ comment: 'belle session', savedAt: 300 }) }),
    };
    const merged = merge(now, before);
    expect(merged.conflicts).toEqual([]);
    for (const side of Object.values(after(now, merged))) expect(side.notes).toMatchObject({ comment: 'belle session', conditions: 'clapot' });
  });

  it('même nom changé des deux côtés : celui de l’ordinateur, et c’est dit', () => {
    const now: Sides = { computer: onComputer({ name: 'Ordinateur' }), phone: onPhone({ name: 'Téléphone' }) };
    const merged = merge(now, before);
    expect(merged.conflicts).toEqual(['name']);
    expect(merged.computer).toBeNull();
    expect(after(now, merged).phone.name).toBe('Ordinateur');
  });

  it('lieu corrigé des deux côtés : celui de l’ordinateur, et c’est dit ; un lieu corrigé ne cède pas à un lieu trouvé', () => {
    const found = { name: 'Carnon', source: 'carte' as const, lat: 43.5, lon: 3.9 };
    const start: Sides = { computer: onComputer({ place: found }), phone: onPhone({ place: found }) };
    const fixed = (name: string) => ({ ...found, name, source: 'utilisateur' as const });
    const twice: Sides = { computer: onComputer({ place: fixed('Le Grand Travers') }), phone: onPhone({ place: fixed('Petit Travers') }) };
    const merged = merge(twice, start);
    expect(merged.conflicts).toEqual(['place']);
    expect(after(twice, merged).phone.place).toEqual(fixed('Le Grand Travers'));
    const once: Sides = { computer: onComputer({ place: { ...found, name: 'Palavas' } }), phone: onPhone({ place: fixed('Petit Travers') }) };
    const both = after(once, merge(once, start));
    expect(both.computer.place).toEqual(fixed('Petit Travers'));
    expect(both.phone.place).toEqual(fixed('Petit Travers'));
  });

  it('un nom effacé d’un côté s’efface de l’autre', () => {
    const start: Sides = { computer: onComputer({ name: 'Mistral' }), phone: onPhone({ name: 'Mistral' }) };
    const now = { ...start, phone: onPhone({ name: null }) };
    expect(after(now, merge(now, start)).computer.name).toBeNull();
  });

  it('une activité changée emporte son calcul, et le résumé de l’autre côté est à refaire', () => {
    const start: Sides = {
      computer: onComputer({ activityId: 'a-wing-2', summary: { ...onComputer().summary, activitySettings: { threshold: 8 } } }),
      phone: onPhone({ activityId: 'a-wing-2' }),
    };
    const now = { ...start, phone: onPhone({ sport: 'kite', activityId: null }) };
    const computer = after(now, merge(now, start)).computer;
    expect(computer.sport).toBe('kite');
    expect(computer.activityId).toBeNull();
    expect(computer.summary.optionsKey).toBeUndefined();
    expect(computer.summary.activitySettings).toBeUndefined();
    expect(computer.summary.distanceM).toBe(start.computer.summary.distanceM);
  });

  it('les manœuvres comptées par une analyse voyagent, pas le reste du résumé', () => {
    const now = { ...before, phone: onPhone({ summary: { ...before.phone.summary, maneuverCount: 12, distanceM: 1 } }) };
    const computer = after(now, merge(now, before)).computer;
    expect(computer.summary).toEqual({ ...before.computer.summary, maneuverCount: 12 });
  });

  it('une fois les deux fiches écrites et gardées, la fusion suivante n’a plus rien à faire', () => {
    const now: Sides = { computer: onComputer({ name: 'Ordinateur', mapBase: 'satellite' }), phone: onPhone({ name: 'Téléphone', notes: notes({ comment: 'x' }) }) };
    const settled = after(now, merge(now, before));
    expect(merge(settled, settled)).toMatchObject({ computer: null, phone: null, conflicts: [] });
  });

  it('une moitié seulement écrite : la fusion suivante finit l’autre sans rien défaire', () => {
    const now: Sides = { computer: onComputer({ name: 'Ordinateur' }), phone: onPhone({ name: 'Téléphone', notes: notes({ comment: 'x' }) }) };
    const full = after(now, merge(now, before));
    // Seule la fiche de l'ordinateur a été écrite, et les fiches gardées sont restées celles d'avant.
    const half: Sides = { computer: full.computer, phone: now.phone };
    const second = merge(half, before);
    expect(second.computer).toBeNull();
    expect(after(half, second).phone).toEqual(full.phone);
  });
});

describe('sans ancêtre : les deux fiches se complètent, rien n’est effacé', () => {
  it('chaque côté reçoit ce que l’autre a de plus', () => {
    const now: Sides = {
      computer: onComputer({ name: 'Mistral', notes: null, marks: [] }),
      phone: onPhone({ notes: notes({ comment: 'belle session' }), marks: [MARK], mapBase: 'satellite' }),
    };
    const merged = merge(now);
    const both = after(now, merged);
    expect(merged.union).toBe(true);
    expect(merged.conflicts).toEqual([]);
    for (const side of [both.computer, both.phone]) {
      expect(side.name).toBe('Mistral');
      expect(side.notes?.comment).toBe('belle session');
      expect(side.marks).toEqual([MARK]);
      expect(side.mapBase).toBe('satellite');
    }
    // Les notes arrivent sur l'ordinateur sans la date de l'horloge du téléphone.
    expect(both.computer.notes?.savedAt).toBe(0);
    expect(both.phone.notes?.savedAt).toBe(100);
  });

  it('notes des deux côtés : fondues champ par champ ; même champ, celui de l’ordinateur, sans regarder les dates', () => {
    const now: Sides = {
      computer: onComputer({ notes: notes({ comment: 'ordinateur', conditions: 'clapot', savedAt: 100 }) }),
      phone: onPhone({ notes: notes({ comment: 'téléphone', foil: '1100', savedAt: 300 }) }),
    };
    const merged = merge(now);
    const both = after(now, merged);
    expect(merged.conflicts).toEqual(['notes.comment']);
    expect(both.computer.notes).toEqual(notes({ comment: 'ordinateur', conditions: 'clapot', foil: '1100', savedAt: 100 }));
    expect(both.phone.notes).toEqual(notes({ comment: 'ordinateur', conditions: 'clapot', foil: '1100', savedAt: 300 }));
  });

  it('une seule des deux fiches gardées manque : fondue sans ancêtre, rien n’est effacé, et le côté resté suivi l’emporte', () => {
    const start: Sides = { computer: onComputer({ name: 'Avant' }), phone: onPhone({ name: 'Avant' }) };
    const now: Sides = { computer: onComputer({ name: 'Avant', mapBase: 'satellite' }), phone: onPhone({ name: 'Renommée' }) };
    const merged = mergeSyncRecords({ computer: text(now.computer), phone: text(now.phone), computerAncestor: null, phoneAncestor: text(start.phone) });
    expect(merged).toMatchObject({ union: true, conflicts: ['name'] });
    const both = after(now, merged as SyncRecordMerge);
    expect(both.computer).toMatchObject({ name: 'Renommée', mapBase: 'satellite' });
    expect(both.phone).toMatchObject({ name: 'Renommée', mapBase: 'satellite' });
  });

  it('nom différent des deux côtés : celui de l’ordinateur, et c’est dit', () => {
    const now: Sides = { computer: onComputer({ name: 'Ordinateur' }), phone: onPhone({ name: 'Téléphone' }) };
    const merged = merge(now);
    expect(merged.conflicts).toEqual(['name']);
    expect(after(now, merged).phone.name).toBe('Ordinateur');
  });

  it('même calcul : l’activité choisie d’un côté complète l’autre ; calculs différents : ceux de l’ordinateur', () => {
    const same: Sides = { computer: onComputer(), phone: onPhone({ activityId: 'a-wing-2' }) };
    expect(after(same, merge(same)).computer.activityId).toBe('a-wing-2');
    const differ: Sides = { computer: onComputer({ sport: 'kite', activityId: null }), phone: onPhone({ activityId: 'a-wing-2' }) };
    const phone = after(differ, merge(differ)).phone;
    expect(phone.sport).toBe('kite');
    expect(phone.activityId).toBeNull();
  });

  it('une fiche perdue puis recréée vide sur le téléphone n’efface rien sur l’ordinateur', () => {
    const start: Sides = {
      computer: onComputer({ name: 'Mistral', notes: notes({ comment: 'belle session' }) }),
      phone: onPhone({ name: 'Mistral', notes: notes({ comment: 'belle session' }) }),
    };
    const now = { ...start, phone: onPhone({ addedAt: '2026-11-20T09:00:00.000Z' }) };
    const merged = merge(now, start);
    expect(merged.union).toBe(true);
    expect(merged.computer).toBeNull();
    expect(after(now, merged).phone).toMatchObject({ name: 'Mistral', notes: { comment: 'belle session' }, addedAt: '2026-11-20T09:00:00.000Z' });
  });

  it('une fiche recréée sur l’ordinateur ne l’emporte pas sur celle du téléphone', () => {
    const start: Sides = { computer: onComputer({ name: 'Mistral' }), phone: onPhone({ name: 'Mistral' }) };
    const now: Sides = { computer: onComputer({ name: 'Import', addedAt: '2026-11-20T09:00:00.000Z' }), phone: onPhone({ name: 'Mistral' }) };
    const merged = merge(now, start);
    expect(merged.phone).toBeNull();
    expect(after(now, merged).computer.name).toBe('Mistral');
  });
});

describe('fiches qui ne se fondent pas, et deux traces du même instant', () => {
  it('une fiche d’une version plus récente, ou illisible, n’est ni fondue ni réécrite', () => {
    const texts = { computer: text(onComputer({ name: 'A' })), phone: text(onPhone({ version: RECORD_VERSION + 1 })), computerAncestor: null, phoneAncestor: null };
    expect(mergeSyncRecords(texts)).toBeNull();
    expect(mergeSyncRecords({ ...texts, phone: '{ coupé' })).toBeNull();
  });

  it('deux traces différentes : seuls les champs saisis passent, ni les sauts ni les manœuvres', () => {
    const jumps = { version: 1, computedAt: '2026-11-02T08:00:00.000Z', jumps: [] };
    const before: Sides = { computer: onComputer(), phone: onPhone() };
    const now = { ...before, phone: onPhone({ name: 'Mistral', jumps, summary: { ...before.phone.summary, maneuverCount: 12 } }) };
    const computer = after(now, merge(now, before, { editsOnly: true })).computer;
    expect(computer).toEqual({ ...before.computer, name: 'Mistral' });
    const first = after(now, merge(now, undefined, { editsOnly: true })).computer;
    expect(first).toEqual({ ...before.computer, name: 'Mistral' });
  });
});
