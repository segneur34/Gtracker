import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_SLUG, FILE_FORMATS, MARKER_FILE, XML } from './appIdentity';

/**
 * Noms techniques figés : la première installation les range dans les fichiers de l'utilisateur, les changer ensuite
 * ferait perdre ses données. Ce test les écrit en toutes lettres pour qu'un changement se voie.
 */
describe('noms techniques de l\'application', () => {
  it('sont ceux de Gtracker, figés', () => {
    expect(APP_NAME).toBe('Gtracker');
    expect(APP_SLUG).toBe('gtracker');
    expect(FILE_FORMATS).toEqual({ session: 'gtracker-session', capteurs: 'gtracker-capteurs', memoire: 'gtracker-memoire' });
    expect(XML.session).toEqual({ prefix: 'gtracker', ns: 'urn:gtracker:session' });
    expect(MARKER_FILE).toBe('gtracker.json');
  });

  it('commencent tous par le nom technique', () => {
    const values = [...Object.values(FILE_FORMATS), XML.session.prefix, MARKER_FILE];
    for (const value of values) expect(value.startsWith(APP_SLUG)).toBe(true);
    expect(XML.session.ns.startsWith(`urn:${APP_SLUG}:`)).toBe(true);
  });
});
