import { describe, expect, it } from 'vitest';
import { TRAVELLING_KEYS } from '../library/settingsFile';
import { LANGUAGE_STORAGE_KEY, langOfTag, resolveLanguage } from './language';

describe('langue de l’interface', () => {
  it('reconnaît les trois langues dans une étiquette, quelle qu’en soit la forme', () => {
    expect(langOfTag('fr-FR')).toBe('fr');
    expect(langOfTag('fr')).toBe('fr');
    expect(langOfTag('en-GB')).toBe('en');
    expect(langOfTag('EN_us')).toBe('en');
    expect(langOfTag('es-419')).toBe('es');
    expect(langOfTag('de-DE')).toBeNull();
    expect(langOfTag('')).toBeNull();
    expect(langOfTag(undefined)).toBeNull();
  });

  it('le réglage de l’appareil d’abord', () => {
    expect(resolveLanguage('es', 'fr-FR')).toBe('es');
    expect(resolveLanguage('fr', 'de-DE')).toBe('fr');
  });

  it('sinon la langue de l’appareil, si l’interface la parle', () => {
    expect(resolveLanguage(null, 'fr-CA')).toBe('fr');
    expect(resolveLanguage(null, 'es-ES')).toBe('es');
    expect(resolveLanguage(undefined, 'en-AU')).toBe('en');
  });

  it('sinon l’anglais, et un réglage abîmé ne compte pas', () => {
    expect(resolveLanguage(null, 'de-DE')).toBe('en');
    expect(resolveLanguage(null, undefined)).toBe('en');
    expect(resolveLanguage('it', 'fr-FR')).toBe('fr');
    expect(resolveLanguage({ lang: 'es' }, 'pt-BR')).toBe('en');
  });

  it('le réglage reste sur l’appareil : il ne voyage pas avec le dossier mémoire', () => {
    expect((TRAVELLING_KEYS as readonly string[]).includes(LANGUAGE_STORAGE_KEY)).toBe(false);
  });
});
