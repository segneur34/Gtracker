import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../core/appIdentity';
import { learnedPlacesFileText } from './learnedPlaces';
import type { LearnedPlace } from './places';
import { restingHrFileText, type StoredRestingResult } from './restingHrStore';
import { buildSettingsFile, serializeSettingsFile } from './settingsFile';
import { planSyncExtras, unknownSyncActivity, type SyncExtrasInput } from './syncExtras';

const PC = 'appareil-ordinateur';
const TEL = 'appareil-telephone';

/** Texte d'un fichier de réglages écrit par l'appareil `id`, à l'instant `savedAt`. */
const settings = (id: string | null, name: string, savedAt: number, activities: string[] = ['wingfoil'], version?: number): string => {
  const file = buildSettingsFile(
    { [STORAGE_KEYS.sportSettings]: { activities: activities.map((a) => ({ id: a, name: a, base: 'wingfoil' })) } },
    savedAt, null, id === null ? null : { id, name },
  );
  return serializeSettingsFile(version ? { ...file, version } : file);
};

const input = (patch: Partial<SyncExtrasInput>): SyncExtrasInput => ({
  settings: { computer: [], phone: [] }, restingHr: { computer: null, phone: null }, places: { computer: null, phone: null },
  computerDeviceId: PC, ...patch,
});

const resting = (startedAtMs: number): StoredRestingResult => ({
  startedAtMs, version: 1, lowestBpm: 48, fromS: 60, toS: 120, meanBpm: 52, maxBpm: 60, coverage: 1, series: [50, 49, 48],
});

const place = (name: string, lat: number, savedAt: number): LearnedPlace => ({ name, lat, lon: 3.9, savedAt });

describe('fichiers de réglages', () => {
  it('chaque côté reçoit le fichier que l’autre a et qu’il n’a pas, sans rien écraser', () => {
    const pc = settings(PC, 'PC', 100);
    const tel = settings(TEL, 'Téléphone', 200);
    const plan = planSyncExtras(input({ settings: { computer: [{ name: 'PC.json', text: pc }], phone: [{ name: 'Telephone.json', text: tel }] } }));
    expect(plan.ops).toEqual([
      { kind: 'settings', to: 'phone', path: 'reglages/PC.json', text: pc, replaces: null, added: 0 },
      { kind: 'settings', to: 'computer', path: 'reglages/Telephone.json', text: tel, replaces: null, added: 0 },
    ]);
    expect(plan.left).toEqual([]);
  });

  it('changé chez son propriétaire : la copie au plus grand savedAt du même appareil remplace l’autre, dans les deux sens', () => {
    const old = settings(TEL, 'Téléphone', 200);
    const fresh = settings(TEL, 'Téléphone', 300, ['wingfoil', 'a-moth']);
    const toComputer = planSyncExtras(input({ settings: { computer: [{ name: 'Telephone.json', text: old }], phone: [{ name: 'Telephone.json', text: fresh }] } }));
    expect(toComputer.ops).toEqual([{ kind: 'settings', to: 'computer', path: 'reglages/Telephone.json', text: fresh, replaces: old, added: 0 }]);
    // Une copie plus ancienne posée à la main sur l'ordinateur ne remplace jamais le fichier du téléphone : c'est l'inverse.
    const back = planSyncExtras(input({ settings: { computer: [{ name: 'Telephone.json', text: fresh }], phone: [{ name: 'Telephone.json', text: old }] } }));
    expect(back.ops.map((op) => [op.to, op.text])).toEqual([['phone', fresh]]);
  });

  it('le fichier propre de l’ordinateur fait foi : jamais remplacé sur l’ordinateur, jamais recopié sur lui', () => {
    const mine = settings(PC, 'PC', 100);
    const imported = settings(PC, 'PC', 900);
    const plan = planSyncExtras(input({ settings: { computer: [{ name: 'PC.json', text: mine }], phone: [{ name: 'PC.json', text: imported }] } }));
    expect(plan.ops).toEqual([{ kind: 'settings', to: 'phone', path: 'reglages/PC.json', text: mine, replaces: imported, added: 0 }]);
    // Absent de l'ordinateur sous ce nom : l'ordinateur écrit seul son fichier, celui du téléphone ne lui est pas donné.
    const absent = planSyncExtras(input({ settings: { computer: [], phone: [{ name: 'Ancien PC.json', text: imported }] } }));
    expect(absent.ops).toEqual([]);
    expect(absent.left).toEqual([{ kind: 'settings', path: 'reglages/Ancien PC.json', side: 'phone', reason: 'ownFile' }]);
  });

  it('même nom, appareils différents : rien n’est écrasé, c’est dit', () => {
    const a = settings(TEL, 'Téléphone', 100);
    const b = settings('autre-telephone', 'Téléphone', 900);
    const plan = planSyncExtras(input({ settings: { computer: [{ name: 'Téléphone.json', text: a }], phone: [{ name: 'téléphone.json', text: b }] } }));
    expect(plan.ops).toEqual([]);
    expect(plan.left).toEqual([{ kind: 'settings', path: 'reglages/Téléphone.json', side: null, reason: 'otherDevice' }]);
    // Un fichier sans appareil (version 1) et un fichier d'appareil du même nom ne sont pas le même fichier.
    const legacy = planSyncExtras(input({ settings: { computer: [{ name: 'PC.json', text: settings(null, 'PC', 50) }], phone: [{ name: 'PC.json', text: settings('x-appareil', 'PC', 60) }] } }));
    expect(legacy.left.map((l) => l.reason)).toEqual(['otherDevice']);
  });

  it('appareil renommé : l’ancien nom ne revient pas là où une version au moins aussi récente est déjà sous le nouveau', () => {
    const before = settings(TEL, 'Ancien', 200);
    const after = settings(TEL, 'Nouveau', 250);
    const plan = planSyncExtras(input({ settings: { computer: [{ name: 'Ancien.json', text: before }], phone: [{ name: 'Nouveau.json', text: after }] } }));
    expect(plan.ops.map((op) => [op.to, op.path])).toEqual([['computer', 'reglages/Nouveau.json']]);
    expect(plan.left).toEqual([{ kind: 'settings', path: 'reglages/Ancien.json', side: 'computer', reason: 'outdated' }]);
    // Renommé sans autre changement (même date) : on ne sait pas lequel est le nom du moment, aucun ne voyage.
    const same = planSyncExtras(input({ settings: { computer: [{ name: 'Ancien.json', text: before }], phone: [{ name: 'Nouveau.json', text: settings(TEL, 'Nouveau', 200) }] } }));
    expect(same.ops).toEqual([]);
    expect(same.left.map((l) => [l.path, l.reason])).toEqual([['reglages/Ancien.json', 'outdated'], ['reglages/Nouveau.json', 'outdated']]);
  });

  it('illisible : ni recopié, ni écrasé ; d’une version plus récente : jamais écrasé ; même date : laissé', () => {
    const good = settings(TEL, 'Téléphone', 200);
    const unreadable = planSyncExtras(input({ settings: { computer: [{ name: 'Abîmé.json', text: '{abîmé' }, { name: 'T.json', text: '{' }], phone: [{ name: 'T.json', text: good }] } }));
    expect(unreadable.ops).toEqual([]);
    expect(unreadable.left.map((l) => [l.path, l.side, l.reason])).toEqual([
      ['reglages/Abîmé.json', 'computer', 'unreadable'], ['reglages/T.json', 'computer', 'unreadable'],
    ]);
    const future = settings(TEL, 'Téléphone', 100, ['wingfoil'], 9);
    const newer = planSyncExtras(input({ settings: { computer: [{ name: 'T.json', text: future }], phone: [{ name: 'T.json', text: good }] } }));
    expect(newer.ops).toEqual([]);
    expect(newer.left.map((l) => [l.side, l.reason])).toEqual([['computer', 'newer']]);
    // Là où il manque, il est recopié tel quel : rien n'est réécrit.
    expect(planSyncExtras(input({ settings: { computer: [{ name: 'T.json', text: future }], phone: [] } })).ops.map((op) => op.to)).toEqual(['phone']);
    const sameDate = planSyncExtras(input({ settings: { computer: [{ name: 'T.json', text: good }], phone: [{ name: 'T.json', text: settings(TEL, 'Téléphone', 200, ['kite']) }] } }));
    expect(sameDate.ops).toEqual([]);
    expect(sameDate.left.map((l) => l.reason)).toEqual(['sameDate']);
  });

  it('les mêmes fichiers des deux côtés : rien à faire', () => {
    const files = [{ name: 'PC.json', text: settings(PC, 'PC', 1) }, { name: 'T.json', text: settings(TEL, 'T', 2) }];
    expect(planSyncExtras(input({ settings: { computer: files, phone: files } }))).toEqual({ ops: [], left: [] });
  });
});

describe('tests de FC repos et lieux appris', () => {
  it('FC repos : union écrite de chaque côté où elle diffère, rien de perdu', () => {
    const pc = restingHrFileText([resting(3), resting(1)]);
    const tel = restingHrFileText([resting(2), resting(1)]);
    const plan = planSyncExtras(input({ restingHr: { computer: pc, phone: tel } }));
    const union = restingHrFileText([resting(3), resting(2), resting(1)]);
    expect(plan.ops).toEqual([
      { kind: 'restingHr', to: 'computer', path: 'fc-repos.json', text: union, replaces: pc, added: 1 },
      { kind: 'restingHr', to: 'phone', path: 'fc-repos.json', text: union, replaces: tel, added: 1 },
    ]);
    // Absent d'un côté : il y est écrit ; absent des deux : rien.
    expect(planSyncExtras(input({ restingHr: { computer: null, phone: tel } })).ops.map((op) => [op.to, op.replaces])).toEqual([['computer', null]]);
    expect(planSyncExtras(input({})).ops).toEqual([]);
    expect(planSyncExtras(input({ restingHr: { computer: union, phone: union } })).ops).toEqual([]);
  });

  it('FC repos illisible ou d’une version plus récente d’un côté : rien n’est écrit d’aucun côté, c’est dit', () => {
    const tel = restingHrFileText([resting(2)]);
    const unreadable = planSyncExtras(input({ restingHr: { computer: '{abîmé', phone: tel } }));
    expect(unreadable.ops).toEqual([]);
    expect(unreadable.left).toEqual([{ kind: 'restingHr', path: 'fc-repos.json', side: 'computer', reason: 'unreadable' }]);
    const future = JSON.stringify({ ...JSON.parse(tel), version: 2 });
    const newer = planSyncExtras(input({ restingHr: { computer: restingHrFileText([resting(5)]), phone: future } }));
    expect(newer.ops).toEqual([]);
    expect(newer.left.map((l) => [l.side, l.reason])).toEqual([['phone', 'newer']]);
  });

  it('lieux : union dans les deux sens ; illisible ou plus récent jamais réécrit', () => {
    const far = 0.1;
    const pc = learnedPlacesFileText([place('Carnon', 43.5, 20)]);
    const tel = learnedPlacesFileText([place('Palavas', 43.5 + far, 10)]);
    const plan = planSyncExtras(input({ places: { computer: pc, phone: tel } }));
    const union = learnedPlacesFileText([place('Carnon', 43.5, 20), place('Palavas', 43.5 + far, 10)]);
    expect(plan.ops.map((op) => [op.to, op.text, op.added])).toEqual([['computer', union, 1], ['phone', union, 1]]);
    const future = JSON.stringify({ format: JSON.parse(tel).format, version: 9, places: [] });
    const newer = planSyncExtras(input({ places: { computer: pc, phone: future } }));
    expect(newer.ops).toEqual([]);
    expect(newer.left.map((l) => [l.kind, l.side, l.reason])).toEqual([['places', 'phone', 'newer']]);
    expect(planSyncExtras(input({ places: { computer: 'pas du json', phone: tel } })).left.map((l) => l.reason)).toEqual(['unreadable']);
  });
});

describe('activité inconnue de l’appareil qui reçoit une fiche', () => {
  it('ni dans sa liste, ni un calcul : son identifiant ; sinon rien', () => {
    expect(unknownSyncActivity(JSON.stringify({ activityId: 'a-moth' }), ['wingfoil'])).toBe('a-moth');
    expect(unknownSyncActivity(JSON.stringify({ activityId: 'a-moth' }), ['a-moth'])).toBeNull();
    expect(unknownSyncActivity(JSON.stringify({ activityId: 'kite' }), [])).toBeNull();
    expect(unknownSyncActivity(JSON.stringify({ activityId: null }), [])).toBeNull();
    expect(unknownSyncActivity('{abîmé', [])).toBeNull();
  });
});
