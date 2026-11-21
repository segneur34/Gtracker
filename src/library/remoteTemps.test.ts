import { describe, expect, it } from 'vitest';
import { NEW_SUFFIX, REPLACE_SUFFIX, isRemoteTemp, phoneVisibleNames, tempNameFor } from './remoteTemps';

describe('noms provisoires du téléphone', () => {
  it('cache une création interrompue', () => {
    expect(phoneVisibleNames(['a.gpx', 'b.gpx.gtracker-new'])).toEqual([{ name: 'a.gpx', actual: 'a.gpx' }]);
  });

  it('cache un remplacement interrompu à côté de son original, intact', () => {
    expect(phoneVisibleNames(['a.json.gtracker-tmp', 'a.json'])).toEqual([{ name: 'a.json', actual: 'a.json' }]);
  });

  it('montre sous son nom un remplacement dont l’original était déjà retiré', () => {
    expect(phoneVisibleNames(['a.json.gtracker-tmp', 'b.gpx'])).toEqual([
      { name: 'a.json', actual: 'a.json.gtracker-tmp' },
      { name: 'b.gpx', actual: 'b.gpx' },
    ]);
  });

  it('compare les suffixes en casse exacte, et ne prend pas un suffixe seul pour un provisoire', () => {
    expect(phoneVisibleNames(['A.GTRACKER-TMP', '.gtracker-tmp', '.gtracker-new'])).toEqual([
      { name: 'A.GTRACKER-TMP', actual: 'A.GTRACKER-TMP' },
      { name: '.gtracker-tmp', actual: '.gtracker-tmp' },
      { name: '.gtracker-new', actual: '.gtracker-new' },
    ]);
    expect(isRemoteTemp('a.gtracker-new')).toBe(true);
    expect(isRemoteTemp('a.gtracker-tmp')).toBe(true);
    expect(isRemoteTemp('a.tmp')).toBe(false);
    expect(isRemoteTemp('.gtracker-tmp')).toBe(false);
  });

  it('écrit un fichier neuf sous .gtracker-new, un remplacement sous .gtracker-tmp, jamais .tmp seul', () => {
    expect(tempNameFor('sessions/a.gpx', false)).toBe(`sessions/a.gpx${NEW_SUFFIX}`);
    expect(tempNameFor('sessions/a.gpx', true)).toBe(`sessions/a.gpx${REPLACE_SUFFIX}`);
    for (const exists of [false, true]) expect(tempNameFor('x', exists)).not.toMatch(/(?<!gtracker-)\.tmp$/);
  });
});
