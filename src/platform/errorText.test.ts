import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DENIED_TEXT, LOCATION_DENIED_TEXT, UNKNOWN_ERROR_TEXT, fileErrorCode, plainError } from './errorText';
import { locationErrorText } from './location';

const withCode = (message: string, code: string): Error => Object.assign(new Error(message), { code });
const domException = (name: string): Error => Object.assign(new Error('x'), { name });

describe('plainError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('traduit les codes des greffons', () => {
    expect(plainError(withCode('boom', 'NOT_AUTHORIZED'))).toBe(DENIED_TEXT);
    expect(plainError(withCode('boom', 'PERMISSION'))).toBe(DENIED_TEXT);
    expect(plainError(withCode('boom', 'NOT_FOUND'))).toMatch(/introuvable/);
    expect(plainError(withCode('boom', 'NO_SPACE'))).toMatch(/place/);
    expect(plainError(withCode('boom', 'TOO_LARGE'))).toMatch(/volumineux/);
  });

  it('traduit les noms de DOMException', () => {
    expect(plainError(domException('QuotaExceededError'))).toMatch(/place/);
    expect(plainError(domException('NotAllowedError'))).toBe(DENIED_TEXT);
  });

  it('reconnaît les messages techniques d’Android', () => {
    expect(plainError(new Error('Missing file for primary:Documents/Gtracker'))).toMatch(/introuvable/);
    expect(plainError(new Error('write failed: ENOSPC (No space left on device)'))).toMatch(/place/);
    expect(plainError(new Error('Failed to fetch'))).toMatch(/Réseau/);
  });

  it('garde une phrase française de l’application telle quelle', () => {
    expect(plainError(new Error('Écriture impossible : disque plein'))).toBe('Écriture impossible : disque plein');
  });

  it('ne recolle pas un texte technique inconnu : préfixe français, sinon repli, détail en console', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(plainError(new Error('Lecture impossible : java.lang.IllegalStateException: boom'), 'repli')).toBe('Lecture impossible.');
    expect(plainError(new Error('Unexpected token < in JSON'), 'repli')).toBe('repli');
    expect(plainError(new Error('Unexpected token < in JSON'))).toBe(UNKNOWN_ERROR_TEXT);
    expect(warn).toHaveBeenCalled();
  });

  it('prend le repli pour ce qui n’est pas une erreur', () => {
    expect(plainError('texte', 'repli')).toBe('repli');
    expect(fileErrorCode('texte')).toBe('UNKNOWN');
  });
});

describe('plainError, message d’un greffon en français', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passe tel quel, ou réduit à sa phrase quand le détail d’Android est technique', () => {
    expect(plainError(new Error('Bluetooth éteint'))).toBe('Bluetooth éteint');
    expect(plainError(withCode('Lecture impossible : null', 'UNKNOWN'), 'repli')).toBe('Lecture impossible.');
    expect(plainError(new Error('permission Bluetooth refusée'), 'repli')).toBe('repli');
  });
});

/** Dictionnaire de test : la langue est posée avant d’importer les modules, comme à l’amorçage. */
const EN = {
  'Lecture du fichier impossible.': 'Cannot read the file.',
  'Bluetooth éteint': 'Bluetooth is off',
  'Lecture impossible': 'Cannot read',
  'Écriture impossible': 'Cannot write',
  '{phrase} : {detail}': '{phrase}: {detail}',
};

describe('plainError dans une autre langue', () => {
  let i18n: typeof import('../core/i18n');
  let english: typeof import('./errorText');
  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.resetModules();
    i18n = await import('../core/i18n');
    i18n.setLanguage('en', EN);
    english = await import('./errorText');
  });
  afterEach(() => {
    i18n.setLanguage('fr');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('garde une phrase de l’application traduite, même quand elle porte les mots anglais du technique', () => {
    expect(english.plainError(new Error(i18n.t('Lecture du fichier impossible.')), 'repli')).toBe('Cannot read the file.');
    expect(english.plainError(new Error('Belt not found: Polar H10.'), 'repli')).toBe('Belt not found: Polar H10.');
    expect(english.plainError(new Error('Location denied: Settings › Permissions.'), 'repli')).toBe('Location denied: Settings › Permissions.');
  });

  it('reconnaît encore le technique à ses marques, et coupe à la ponctuation de la langue', () => {
    expect(english.plainError(new Error('Cannot read: java.lang.IllegalStateException: boom'), 'repli')).toBe('Cannot read.');
    expect(english.plainError(new Error('Failed to fetch'))).toMatch(/Réseau/);
    expect(english.plainError(new Error('write failed: ENOSPC (No space left on device)'))).toMatch(/place/);
    expect(english.plainError(new Error('/storage/emulated/0 missing'), 'repli')).toBe('repli');
  });

  it('rend le message d’un greffon dans la langue de l’interface, jugé comme en français', () => {
    expect(english.plainError(new Error('Bluetooth éteint'))).toBe('Bluetooth is off');
    expect(english.plainError(withCode('Lecture impossible : java.io.IOException: boom', 'UNKNOWN'), 'repli')).toBe('Cannot read.');
    expect(english.plainError(withCode('Lecture impossible : null', 'UNKNOWN'), 'repli')).toBe('Cannot read.');
    expect(english.plainError(new Error('Écriture impossible : disque plein'))).toBe('Cannot write: disque plein');
    expect(english.plainError(new Error('permission Bluetooth refusée'), 'repli')).toBe('repli');
  });
});

describe('locationErrorText', () => {
  it('dit où réactiver la localisation au premier refus', () => {
    expect(locationErrorText({ message: 'User denied location permission', code: 'NOT_AUTHORIZED' })).toBe(LOCATION_DENIED_TEXT);
    expect(locationErrorText({ message: 'User denied location permission' })).toBe(LOCATION_DENIED_TEXT);
  });
});
