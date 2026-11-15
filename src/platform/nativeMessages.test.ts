import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isNativeMessage, nativeErrorMessage, nativePhrase, nativeText } from './nativeMessages';

describe('messages des greffons, en français', () => {
  it('rendus au caractère près', () => {
    expect(nativeText('Bluetooth éteint')).toBe('Bluetooth éteint');
    expect(nativeText('Écriture impossible : java.io.IOException: EIO')).toBe('Écriture impossible : java.io.IOException: EIO');
    expect(nativePhrase('Lecture impossible')).toBe('Lecture impossible');
    expect(nativeErrorMessage(new Error('Fichier reçu illisible'))).toBe('Fichier reçu illisible');
    expect(nativeErrorMessage('pas une erreur', 'repli')).toBe('repli');
  });

  it('reconnus par leur phrase, seule ou suivie du détail d’Android', () => {
    expect(isNativeMessage('Bluetooth éteint')).toBe(true);
    expect(isNativeMessage('Suppression impossible : null')).toBe(true);
    expect(isNativeMessage('Suppression impossible')).toBe(true);
    expect(isNativeMessage('écriture refusée')).toBe(false);
    expect(isNativeMessage('Session : Bluetooth éteint')).toBe(false);
  });
});

describe('messages des greffons, dans une autre langue', () => {
  let i18n: typeof import('../core/i18n');
  let english: typeof import('./nativeMessages');
  beforeEach(async () => {
    vi.resetModules();
    i18n = await import('../core/i18n');
    i18n.setLanguage('en', {
      'Bluetooth éteint': 'Bluetooth is off',
      'Écriture impossible': 'Cannot write',
      '{phrase} : {detail}': '{phrase}: {detail}',
    });
    english = await import('./nativeMessages');
  });
  afterEach(() => {
    i18n.setLanguage('fr');
    vi.resetModules();
  });

  it('la phrase traduite, le détail d’Android gardé, tout autre texte tel quel', () => {
    expect(english.nativeText('Bluetooth éteint')).toBe('Bluetooth is off');
    expect(english.nativeText('Écriture impossible : java.io.IOException: EIO')).toBe('Cannot write: java.io.IOException: EIO');
    expect(english.nativeText('Bluetooth is off')).toBe('Bluetooth is off');
    expect(english.nativeText('Sans phrase connue : détail')).toBe('Sans phrase connue : détail');
    expect(english.nativeErrorMessage(new Error('Bluetooth éteint'))).toBe('Bluetooth is off');
    // Sans traduction au dictionnaire : le français.
    expect(english.nativeText('Partage impossible.')).toBe('Partage impossible.');
  });
});
