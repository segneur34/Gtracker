import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARKER_FILE } from '../core/appIdentity';
import { setLanguage } from '../core/i18n';
import {
  MISSING_FOLDER_MESSAGE, READ_ONLY_MEMORY_MESSAGE, fileErrorCode, folderImportPaths, isMemorySubfolder, memoryLabelText, readOnlyFolder, readableFolderError, shouldDescendIntoMemory,
} from './memoryFolder';
import { createFakeFolder } from '../test/memoryFolder.fixture';

describe('shouldDescendIntoMemory', () => {
  it('garde le dossier Gtracker désigné, même vide', () => {
    expect(shouldDescendIntoMemory('Gtracker', new Set())).toBe(false);
    expect(shouldDescendIntoMemory('Documents/Gtracker', new Set(['Gtracker']))).toBe(false);
  });

  it('descend dans Gtracker quand on a désigné son parent', () => {
    expect(shouldDescendIntoMemory('Documents', new Set(['Gtracker', 'Factures']))).toBe(true);
  });

  it('garde un dossier mémoire renommé, reconnu à son contenu', () => {
    expect(shouldDescendIntoMemory('Sauvegarde', new Set([MARKER_FILE, 'Gtracker']))).toBe(false);
    expect(shouldDescendIntoMemory('Sauvegarde', new Set([MARKER_FILE, 'sessions', 'Gtracker']))).toBe(false);
    expect(shouldDescendIntoMemory('Sauvegarde', new Set(['sessions']))).toBe(false);
  });

  it('garde un dossier quelconque sans Gtracker : il deviendra la mémoire', () => {
    expect(shouldDescendIntoMemory('Traces', new Set(['a.gpx']))).toBe(false);
  });
});

describe('isMemorySubfolder', () => {
  it('refuse le dossier sessions, itineraires ou journaux d\'une mémoire', () => {
    expect(isMemorySubfolder('sessions', new Set(['a.gpx', 'a.json']))).toBe(true);
    expect(isMemorySubfolder('Documents/Gtracker/Sessions', new Set())).toBe(true);
    expect(isMemorySubfolder('itineraires', new Set(['Boucle.json']))).toBe(true);
    expect(isMemorySubfolder('journaux', new Set(['recording-journal-2026.jsonl']))).toBe(true);
  });

  it('accepte un dossier marqué comme mémoire, quel que soit son nom, et tout autre dossier', () => {
    expect(isMemorySubfolder('sessions', new Set([MARKER_FILE, 'sessions']))).toBe(false);
    expect(isMemorySubfolder('Gtracker', new Set(['sessions']))).toBe(false);
    expect(isMemorySubfolder('Mes sessions', new Set())).toBe(false);
  });
});

describe('folderImportPaths', () => {
  const file = (name: string) => ({ name, kind: 'file' as const });
  const dir = (name: string) => ({ name, kind: 'directory' as const });

  it("reprend les GPX, les fiches et les capteurs de la racine et de sessions/", () => {
    expect(folderImportPaths(
      [file(MARKER_FILE), file('a.GPX'), dir('sessions')],
      [file('b.gpx'), file('b.json'), file('b.imu')]
    )).toEqual([MARKER_FILE, 'a.GPX', 'sessions/b.gpx', 'sessions/b.json', 'sessions/b.imu']);
  });

  it('reprend aussi les fichiers de montre, à la racine comme dans sessions/', () => {
    expect(folderImportPaths([file('a.FIT'), dir('sessions')], [file('b.fit')])).toEqual(['a.FIT', 'sessions/b.fit']);
  });

  it('ignore les autres fichiers et les dossiers', () => {
    expect(folderImportPaths(
      [file('LISEZMOI.txt'), dir('x.gpx')],
      [file('photo.jpg'), dir('vieux')]
    )).toEqual([]);
  });
});

describe('readableFolderError', () => {
  it('rend en clair un dossier désigné qui n’existe plus, le détail en console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = readableFolderError(new Error('Écriture impossible : Missing file for primary:Documents/Gtracker at /storage/emulated/0/Documents/Gtracker'));
    expect((err as Error).message).toBe(MISSING_FOLDER_MESSAGE);
    expect(fileErrorCode(err)).toBe('NOT_FOUND');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Missing file for'));
    warn.mockRestore();
  });

  it('rend telle quelle une autre erreur', () => {
    const other = new Error('Écriture impossible : disque plein');
    expect(readableFolderError(other)).toBe(other);
  });

  it('un code explicite du greffon prime sur le texte', () => {
    const refused = Object.assign(new Error('Lecture impossible : java.io.FileNotFoundException: open failed: EACCES (Permission denied)'), { code: 'PERMISSION' });
    expect((readableFolderError(refused) as Error).message).toBe('Autorisation refusée : Réglages › Autorisations.');
    expect(fileErrorCode(readableFolderError(refused))).toBe('PERMISSION');
    const full = Object.assign(new Error('Écriture impossible : Missing file for x'), { code: 'NO_SPACE' });
    expect(fileErrorCode(readableFolderError(full))).toBe('NO_SPACE');
    expect((readableFolderError(full) as Error).message).toMatch(/place/);
  });

  it('un NOT_FOUND du greffon, à ce texte, reste le dossier introuvable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = readableFolderError(Object.assign(new Error('Lecture impossible : Missing file for primary:Gtracker'), { code: 'NOT_FOUND' }));
    expect((err as Error).message).toBe(MISSING_FOLDER_MESSAGE);
    warn.mockRestore();
  });
});

describe('fileErrorCode', () => {
  it('lit le code du greffon', () => {
    for (const code of ['NOT_FOUND', 'PERMISSION', 'NO_SPACE', 'TOO_LARGE', 'UNKNOWN'] as const) {
      expect(fileErrorCode(Object.assign(new Error('x'), { code }))).toBe(code);
    }
  });

  it('lit le nom d\'une erreur du navigateur', () => {
    expect(fileErrorCode(new DOMException('x', 'NotFoundError'))).toBe('NOT_FOUND');
    expect(fileErrorCode(new DOMException('x', 'NotAllowedError'))).toBe('PERMISSION');
    expect(fileErrorCode(new DOMException('x', 'QuotaExceededError'))).toBe('NO_SPACE');
  });

  it('rend UNKNOWN pour le reste, code inconnu ou nom hérité compris', () => {
    expect(fileErrorCode(new Error('x'))).toBe('UNKNOWN');
    expect(fileErrorCode(Object.assign(new Error('x'), { code: 'AUTRE' }))).toBe('UNKNOWN');
    expect(fileErrorCode({ name: 'toString' })).toBe('UNKNOWN');
    expect(fileErrorCode('texte')).toBe('UNKNOWN');
    expect(fileErrorCode(null)).toBe('UNKNOWN');
  });
});

describe('readOnlyFolder', () => {
  it('lit, et refuse d\'écrire ou d\'effacer, sans toucher au dossier', async () => {
    const files = new Map([['a.txt', 'contenu']]);
    const log: string[] = [];
    const folder = readOnlyFolder(createFakeFolder(files, log));
    expect(folder.readOnly).toBe(true);
    expect(await folder.readText('a.txt')).toBe('contenu');
    expect(await folder.stat('a.txt')).toEqual({ size: 1, mtimeMs: 1 });
    expect(await folder.list('')).toHaveLength(1);
    await expect(folder.writeText('a.txt', 'autre')).rejects.toThrow(READ_ONLY_MEMORY_MESSAGE);
    await expect(folder.writeBytes('a.imu', new Uint8Array([1]))).rejects.toThrow(READ_ONLY_MEMORY_MESSAGE);
    await expect(folder.remove('a.txt')).rejects.toThrow(READ_ONLY_MEMORY_MESSAGE);
    expect(log).toEqual([]);
    expect(files.get('a.txt')).toBe('contenu');
  });
});

describe('libellé du dossier mémoire traduit à l’affichage seulement', () => {
  afterEach(() => setLanguage('fr', {}));

  it('en français, chaque forme ressort telle quelle', () => {
    for (const label of ['mémoire de ce navigateur', 'dossier privé de l\'application', 'dossier « Gtracker »', 'dossier « Documents/Gtracker »']) {
      expect(memoryLabelText(label)).toBe(label);
    }
  });

  it('dans une autre langue, les trois formes se traduisent, le nom du dossier gardé ; un autre libellé reste tel quel', () => {
    setLanguage('en', {
      'mémoire de ce navigateur': 'this browser storage',
      'dossier privé de l\'application': 'app private folder',
      'dossier « {name} »': 'folder “{name}”',
    });
    expect(memoryLabelText('mémoire de ce navigateur')).toBe('this browser storage');
    expect(memoryLabelText('dossier privé de l\'application')).toBe('app private folder');
    expect(memoryLabelText('dossier « Documents/Gtracker »')).toBe('folder “Documents/Gtracker”');
    expect(memoryLabelText('carte SD')).toBe('carte SD');
  });
});
