import { afterEach, describe, expect, it } from 'vitest';
import { CONTEXT_MARK, LANGUAGES, LANGUAGE_NAME, currentLang, dateLocale, decimalSeparator, isLang, setLanguage, t, tn } from './i18n';

afterEach(() => setLanguage('fr'));

describe('i18n : français sans amorçage', () => {
  it('français par défaut, la clé rendue telle quelle', () => {
    expect(currentLang()).toBe('fr');
    for (const key of ['Enregistrer la session', '', 'Accolade {seule} sans variable', "L'activité « Kite »"]) expect(t(key)).toBe(key);
  });

  it('remplace les variables données, laisse les autres et ne remplace jamais le contexte', () => {
    expect(t('{n} sessions ajoutées', { n: 3 })).toBe('3 sessions ajoutées');
    expect(t('{a} et {b}', { a: '12,4', b: 0 })).toBe('12,4 et 0');
    expect(t('{a} et {inconnu}', { a: 'x' })).toBe('x et {inconnu}');
    expect(t('vol', { ctx: 'foil' })).toBe('vol');
    expect(t('{ctx}', { ctx: 'foil' })).toBe('{ctx}');
  });

  it('pluriel français : n > 1 par défaut, la règle du site si elle est donnée', () => {
    const files = (n: number, rule?: boolean) => tn(n, '{n} fichier', '{n} fichiers', undefined, rule);
    expect([0, 1, 2].map((n) => files(n))).toEqual(['0 fichier', '1 fichier', '2 fichiers']);
    expect([0, 1, 2].map((n) => files(n, n !== 1))).toEqual(['0 fichiers', '1 fichier', '2 fichiers']);
    expect(tn(2, 'une session', 'deux sessions')).toBe('deux sessions');
  });

  it('`vars.n` prime sur le nombre (déjà formaté)', () => {
    expect(tn(1.5, '{n} nœud', '{n} nœuds', { n: '1,5' })).toBe('1,5 nœuds');
    expect(tn(3, '{n} {what}', '{n} {what}s', { what: 'run' })).toBe('3 runs');
  });

  it('formats français', () => {
    expect(decimalSeparator()).toBe(',');
    expect(dateLocale()).toBe('fr-FR');
  });

  it('un dictionnaire posé en français est ignoré', () => {
    setLanguage('fr', { 'Enregistrer la session': 'Save session' });
    expect(t('Enregistrer la session')).toBe('Enregistrer la session');
  });
});

describe('i18n : une langue avec dictionnaire', () => {
  const EN = {
    'Enregistrer la session': 'Save session',
    '{n} sessions ajoutées': '{n} sessions added',
    '{n} fichier': '{n} file',
    '{n} fichiers': '{n} files',
    vol: 'theft',
    [`vol${CONTEXT_MARK}foil`]: 'flight',
  };

  it('traduit, remplace les variables, retombe sur le français sans traduction', () => {
    setLanguage('en', EN);
    expect(currentLang()).toBe('en');
    expect(t('Enregistrer la session')).toBe('Save session');
    expect(t('{n} sessions ajoutées', { n: 4 })).toBe('4 sessions added');
    expect(t('Texte sans traduction {x}', { x: 1 })).toBe('Texte sans traduction 1');
  });

  it('contexte : son entrée, sinon la clé seule, sinon le français', () => {
    setLanguage('en', EN);
    expect(t('vol', { ctx: 'foil' })).toBe('flight');
    expect(t('vol')).toBe('theft');
    expect(t('vol', { ctx: 'autre' })).toBe('theft');
    expect(t('saut', { ctx: 'kite' })).toBe('saut');
  });

  it('pluriel anglais et espagnol : n !== 1, la règle française ignorée', () => {
    setLanguage('en', EN);
    expect([0, 1, 2].map((n) => tn(n, '{n} fichier', '{n} fichiers', undefined, n > 1))).toEqual(['0 files', '1 file', '2 files']);
    setLanguage('es', {});
    expect(tn(0, '{n} fichier', '{n} fichiers')).toBe('0 fichiers');
  });

  it('formats : point en anglais, virgule en espagnol, locale des dates', () => {
    setLanguage('en', EN);
    expect([decimalSeparator(), dateLocale()]).toEqual(['.', 'en-GB']);
    setLanguage('es', {});
    expect([decimalSeparator(), dateLocale()]).toEqual([',', 'es-ES']);
  });
});

describe('i18n : langues', () => {
  it('trois langues nommées dans leur propre langue', () => {
    expect(LANGUAGES).toEqual(['fr', 'en', 'es']);
    expect(LANGUAGES.map((l) => LANGUAGE_NAME[l])).toEqual(['Français', 'English', 'Español']);
    expect([isLang('en'), isLang('de'), isLang(undefined)]).toEqual([true, false, false]);
  });
});
