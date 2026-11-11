import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITIES } from '../core/activities';
import { EMPTY_ATHLETE_PROFILE } from './athleteProfile';
import {
  SETTINGS_FORMAT,
  SETTINGS_VERSION,
  adoptedValues,
  buildSettingsFile,
  checkedValues,
  cleanDeviceName,
  deviceFileName,
  freeDeviceName,
  importedSettingsFileName,
  newestSettingsEntry,
  ownSettingsEntry,
  parseSettingsFile,
  serializeSettingsFile,
  settingsActivityCount,
  settingsEntryKey,
  settingsEntryName,
  settingsFileInfo,
  settingsSignature,
  sortedSettingsFiles,
  unseenSettingsEntries,
  type SettingsEntry,
} from './settingsFile';
import { STORAGE_KEYS } from '../core/appIdentity';

const values = { [STORAGE_KEYS.sportSettings]: { thresholds: { wingfoil: 9 } } };

describe('parseSettingsFile', () => {
  it('relit un fichier écrit, avec son appareil', () => {
    const file = buildSettingsFile(values, 1234, null, { id: 'abc', name: 'Téléphone' });
    expect(parseSettingsFile(serializeSettingsFile(file))).toEqual(file);
    expect(file.version).toBe(2);
  });

  it('écrit les tableaux de nombres sur une ligne, se relit pareil, et relit un fichier indenté d’avant (lot 80)', () => {
    const rich = { ...values, 'gtracker.profile': { zones: [120, 140, 155, 170], poids: 72.5, noms: ['a', 'b'] }, 'gtracker.nav': [[1, 2], [3]] };
    const file = buildSettingsFile(rich, 1234, null, { id: 'abc', name: 'Téléphone' });
    const text = serializeSettingsFile(file);
    expect(text).toContain('"zones": [120,140,155,170],\n');
    expect(text).toContain('"noms": [\n');
    expect(text.endsWith('\n')).toBe(true);
    expect(parseSettingsFile(text)).toEqual(file);
    const old = `${JSON.stringify(file, null, 2)}\n`;
    expect(parseSettingsFile(old)).toEqual(parseSettingsFile(text));
    expect(serializeSettingsFile(parseSettingsFile(old)!)).toBe(text);
  });

  it('relit un fichier de la version 1, sans appareil', () => {
    const old = JSON.stringify({ format: SETTINGS_FORMAT, version: 1, savedAt: 5, values });
    expect(parseSettingsFile(old)).toEqual({ format: SETTINGS_FORMAT, version: 1, savedAt: 5, device: null, values });
  });

  it('écarte un appareil abîmé, et nettoie son nom', () => {
    const read = (device: unknown) => parseSettingsFile(JSON.stringify({ format: SETTINGS_FORMAT, version: 2, savedAt: 5, device, values }))?.device;
    expect(read({ id: '', name: 'PC' })).toBeNull();
    expect(read({ id: 'x', name: '   ' })).toBeNull();
    expect(read('PC')).toBeNull();
    expect(read({ id: 'x', name: '  PC   du   bureau ' })).toEqual({ id: 'x', name: 'PC du bureau' });
  });

  it('rend `null` pour un fichier absent, illisible ou d\'un autre format', () => {
    expect(parseSettingsFile(null)).toBeNull();
    expect(parseSettingsFile('{')).toBeNull();
    expect(parseSettingsFile(JSON.stringify({ format: 'autre', version: 1, savedAt: 1, values: {} }))).toBeNull();
    expect(parseSettingsFile(JSON.stringify({ format: SETTINGS_FORMAT, version: 1, values: {} }))).toBeNull();
  });

  const file = (over: Record<string, unknown> = {}) => JSON.stringify({
    format: SETTINGS_FORMAT, version: 2, savedAt: 1790000000000, device: { id: 'abc', name: 'Téléphone' }, values, ...over,
  });

  it('lit une version future comme une autre, et sa réécriture garde son numéro et ses clés', () => {
    const read = parseSettingsFile(file({ version: 7, values: { [STORAGE_KEYS.sportSettings]: {}, 'gtracker.futur': { x: 1 } } }));
    expect(read?.version).toBe(7);
    const written = buildSettingsFile({ [STORAGE_KEYS.sportSettings]: { ancien: true } }, 1, read, { id: 'abc', name: 'T' });
    expect(written.version).toBe(7);
    expect(written.values['gtracker.futur']).toEqual({ x: 1 });
  });

  it('champs mal typés : savedAt en texte ou values en tableau, fichier ignoré ; appareil mal formé, null', () => {
    expect(parseSettingsFile(file({ savedAt: '1790000000000' }))).toBeNull();
    expect(parseSettingsFile(file({ values: [] }))).toBeNull();
    expect(parseSettingsFile(file({ device: { id: 3, name: 'x' } }))?.device).toBeNull();
  });

  it("accepte sans contrôle une valeur de gtracker.sportSettings d'une autre forme", () => {
    expect(parseSettingsFile(file({ values: { [STORAGE_KEYS.sportSettings]: 'texte' } }))?.values[STORAGE_KEYS.sportSettings]).toBe('texte');
  });

  it('une clé __proto__ ne pollue rien et se réécrit telle quelle', () => {
    const text = `{"format":"${SETTINGS_FORMAT}","version":2,"savedAt":1,"device":null,"values":{"__proto__":{"pollue":true},"${STORAGE_KEYS.sportSettings}":{}}}`;
    const read = parseSettingsFile(text)!;
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    const again = parseSettingsFile(serializeSettingsFile(buildSettingsFile({}, 2, read, null)))!;
    expect(Object.prototype.hasOwnProperty.call(again.values, '__proto__')).toBe(true);
  });

  it('lit un fichier précédé d’un BOM ou aux fins de ligne CRLF', () => {
    expect(parseSettingsFile('﻿' + file())).not.toBeNull();
    expect(parseSettingsFile(serializeSettingsFile(parseSettingsFile(file())!).replace(/\n/g, '\r\n'))).not.toBeNull();
  });
});

describe('buildSettingsFile', () => {
  it('garde les clés et la version d\'un fichier écrit par une version plus récente', () => {
    const previous = { format: SETTINGS_FORMAT, version: SETTINGS_VERSION + 1, savedAt: 1, device: null, values: { 'gtracker.futur': 1 } } as const;
    const file = buildSettingsFile(values, 2, previous);
    expect(file.values).toEqual({ 'gtracker.futur': 1, ...values });
    expect(file.version).toBe(SETTINGS_VERSION + 1);
  });
});

describe('settingsSignature', () => {
  const settings = {
    activities: [{ id: 'voile' }],
    moduleActivity: { voile: 'wingfoil' },
    recordActivity: 'voile',
    thresholds: { wingfoil: 9 },
  };
  const signature = settingsSignature({ [STORAGE_KEYS.sportSettings]: settings, [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 70 } } });

  it('ignore les choix retenus : activité du module, activité à enregistrer', () => {
    const reopened = { ...settings, moduleActivity: { voile: 'kite', surf: 'a-surf-foil' }, recordActivity: 'a-surf-foil' };
    expect(settingsSignature({ [STORAGE_KEYS.sportSettings]: reopened, [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 70 } } })).toBe(signature);
  });

  it('change avec un vrai réglage, de support ou de pratiquant', () => {
    const changed = { ...settings, thresholds: { wingfoil: 10 } };
    expect(settingsSignature({ [STORAGE_KEYS.sportSettings]: changed, [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 70 } } })).not.toBe(signature);
    expect(settingsSignature({ [STORAGE_KEYS.sportSettings]: settings, [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 71 } } })).not.toBe(signature);
  });

  it('tient un appareil sans réglage de support', () => {
    expect(settingsSignature({})).toBe('{}');
  });
});

describe('appareils et noms de fichier', () => {
  it("tire le nom du fichier du nom de l'appareil", () => {
    expect(deviceFileName('Téléphone')).toBe('telephone.json');
    expect(deviceFileName('PC')).toBe('pc.json');
    expect(deviceFileName('Téléphone de Léa (bœuf)')).toBe('telephone-de-lea-boeuf.json');
    expect(deviceFileName('!!!')).toBe('appareil.json');
  });

  it('nettoie un nom saisi', () => {
    expect(cleanDeviceName('  Mon   PC ')).toBe('Mon PC');
    expect(cleanDeviceName('x'.repeat(60))).toHaveLength(40);
  });

  it('donne un nom libre quand un autre appareil porte déjà le sien', () => {
    expect(freeDeviceName('Téléphone', new Set(['pc.json']))).toBe('Téléphone');
    expect(freeDeviceName('Téléphone', new Set(['telephone.json']))).toBe('Téléphone 2');
    expect(freeDeviceName('Téléphone', new Set(['telephone.json', 'telephone-2.json']))).toBe('Téléphone 3');
  });

  const entry = (fileName: string, savedAt: number, device: { id: string; name: string } | null): SettingsEntry =>
    ({ fileName, file: buildSettingsFile(values, savedAt, null, device) });
  const phone = entry('telephone.json', 3000, { id: 'tel', name: 'Téléphone' });
  const pc = entry('pc.json', 2000, { id: 'pc', name: 'PC' });
  const friend = entry('lea.json', 4000, null);

  it("retrouve le fichier de l'appareil à son identifiant, pas à son nom", () => {
    expect(ownSettingsEntry([phone, pc, friend], 'pc')).toBe(pc);
    const sameName = entry('telephone.json', 1000, { id: 'autre', name: 'Téléphone' });
    expect(ownSettingsEntry([sameName], 'tel')).toBeNull();
  });

  it('montre un fichier comme Réglages › Mémoire : nom, date, activités, et s’il est celui de l’appareil (lot 113)', () => {
    expect(settingsFileInfo(phone, 'tel')).toEqual({
      fileName: 'telephone.json', name: 'Téléphone', savedAt: 3000, activityCount: settingsActivityCount(phone.file), own: true,
    });
    expect(settingsFileInfo(friend, 'tel')).toMatchObject({ name: 'lea', own: false });
  });

  it('range la liste : le fichier de l’appareil en tête, puis du plus récent au plus ancien (lot 113)', () => {
    expect(sortedSettingsFiles([pc, friend, phone], 'pc').map((f) => f.fileName)).toEqual(['pc.json', 'lea.json', 'telephone.json']);
    expect(sortedSettingsFiles([], 'pc')).toEqual([]);
  });

  it('désigne le plus récent, pour un appareil neuf', () => {
    expect(newestSettingsEntry([phone, pc, friend])).toBe(friend);
    expect(newestSettingsEntry([])).toBeNull();
  });

  it('nomme un fichier par son appareil, sinon par son nom de fichier', () => {
    expect(settingsEntryName(phone)).toBe('Téléphone');
    expect(settingsEntryName(friend)).toBe('lea');
  });

  it("compte les activités, celles du premier lancement sans liste rangée", () => {
    expect(settingsActivityCount(phone.file)).toBe(DEFAULT_ACTIVITIES.length);
    const two = buildSettingsFile({ [STORAGE_KEYS.sportSettings]: { activities: DEFAULT_ACTIVITIES.slice(0, 2) } }, 1);
    expect(settingsActivityCount(two)).toBe(2);
  });

  it("reconnaît un fichier à son appareil, même renommé, sinon à son nom de fichier", () => {
    const renamed = entry('telephone-de-lea.json', 5000, { id: 'tel', name: 'Téléphone de Léa' });
    expect(settingsEntryKey(renamed)).toBe(settingsEntryKey(phone));
    expect(settingsEntryKey(friend)).toBe(settingsEntryKey(entry('LEA.json', 1, null)));
    expect(settingsEntryKey(friend)).not.toBe(settingsEntryKey(pc));
  });

  it("propose les fichiers des autres appareils jamais vus, le plus récent en tête", () => {
    const seen = new Set([settingsEntryKey(pc)]);
    expect(unseenSettingsEntries([pc, phone, friend], seen, 'pc')).toEqual([friend, phone]);
    expect(unseenSettingsEntries([pc, phone, friend], new Set([settingsEntryKey(phone), settingsEntryKey(friend)]), 'pc')).toEqual([]);
  });

  it("ne propose jamais le fichier de l'appareil, même jamais vu", () => {
    expect(unseenSettingsEntries([pc], new Set(), 'pc')).toEqual([]);
  });

  it('tient pour vus tous les fichiers la première fois', () => {
    expect(unseenSettingsEntries([pc, phone, friend], null, 'pc')).toEqual([]);
  });

  it("range un fichier importé sous le nom de son appareil, sans écraser celui d'un autre", () => {
    const tablet = buildSettingsFile(values, 6000, null, { id: 'tab', name: 'Tablette' });
    expect(importedSettingsFileName(tablet, 'n-importe.json', [pc, phone], new Set(['pc.json', 'telephone.json']))).toBe('tablette.json');
    const otherPhone = buildSettingsFile(values, 6000, null, { id: 'tel-2', name: 'Téléphone' });
    expect(importedSettingsFileName(otherPhone, 'telephone.json', [pc, phone], new Set(['pc.json', 'telephone.json']))).toBe('telephone-2.json');
  });

  it("remplace le fichier du même appareil, même rangé sous un autre nom", () => {
    const newerPhone = buildSettingsFile(values, 9000, null, { id: 'tel', name: 'Téléphone de Léa' });
    expect(importedSettingsFileName(newerPhone, 'x.json', [pc, phone], new Set(['pc.json', 'telephone.json']))).toBe('telephone.json');
  });

  it("nomme un fichier sans appareil d'après le fichier choisi", () => {
    const old = buildSettingsFile(values, 1000);
    expect(importedSettingsFileName(old, 'Réglages Léa.json', [], new Set())).toBe('reglages-lea.json');
    expect(importedSettingsFileName(old, 'reglages-lea.JSON', [], new Set(['reglages-lea.json']))).toBe('reglages-lea-2.json');
  });
});

describe('adoptedValues', () => {
  it("prend les réglages de l'autre appareil, mais garde les choix retenus de celui-ci", () => {
    const theirs = {
      [STORAGE_KEYS.sportSettings]: {
        thresholds: { wingfoil: 12 }, recordActivity: 'a-kite', moduleActivity: { voile: 'a-kite' }, gearLabels: { surf: ['Planche', 'Combi'] },
      },
      [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 80 } },
    };
    const mine = {
      [STORAGE_KEYS.sportSettings]: { thresholds: { wingfoil: 9 }, recordActivity: 'wingfoil', moduleActivity: { surf: 'a-surf-foil' } },
    };
    expect(adoptedValues(theirs, mine)).toEqual({
      [STORAGE_KEYS.sportSettings]: {
        thresholds: { wingfoil: 12 }, gearLabels: { surf: ['Planche', 'Combi'] }, moduleActivity: { surf: 'a-surf-foil' }, recordActivity: 'wingfoil',
      },
      [STORAGE_KEYS.athleteProfile]: { me: { ...EMPTY_ATHLETE_PROFILE, weightKg: 80 } },
    });
  });

  it('rend tel quel un fichier sans réglage de support ni profil', () => {
    const theirs = { 'gtracker.autre': 1 };
    expect(adoptedValues(theirs, { [STORAGE_KEYS.sportSettings]: { recordActivity: 'x' } })).toBe(theirs);
  });

  it('relit le profil du pratiquant champ par champ (lot 143)', () => {
    const theirs = { [STORAGE_KEYS.athleteProfile]: { me: { weightKg: 9000, hrMax: 190, inconnu: 1 } } };
    expect(adoptedValues(theirs, {})).toEqual({ [STORAGE_KEYS.athleteProfile]: { me: { ...EMPTY_ATHLETE_PROFILE, hrMax: 190, hrMaxSource: { kind: 'saisie', atMs: null } } } });
  });

  it("ne reprend pas un profil qui n'a pas la forme attendue", () => {
    expect(checkedValues({ [STORAGE_KEYS.athleteProfile]: 'abîmé', [STORAGE_KEYS.sportSettings]: {} })).toEqual({ [STORAGE_KEYS.sportSettings]: {} });
  });
});
