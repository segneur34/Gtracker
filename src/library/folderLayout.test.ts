import { describe, expect, it } from 'vitest';
import {
  JOURNALS_DIR, MARKER_FILE, MEMORY_FORMAT, MEMORY_VERSION, README_SEPARATOR, RESTING_HR_FILE, LEARNED_PLACES_FILE,
  markerText, readMarkerVersion, readmeText,
} from './folderLayout';

describe('readmeText', () => {
  const parts = readmeText().split(`${README_SEPARATOR}\r\n`);

  it('dit la même chose en français, en anglais puis en espagnol, dans un seul fichier', () => {
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^Dossier mémoire de Gtracker\r\n/);
    expect(parts[1]).toMatch(/^\r\nGtracker storage folder\r\n/);
    expect(parts[2]).toMatch(/^\r\nCarpeta de almacenamiento de Gtracker\r\n/);
  });

  it('nomme dans chaque langue les mêmes fichiers et dossiers du disque, et les fins de ligne sont celles de Windows', () => {
    const names = ['sessions/', 'itineraires/', 'reglages/', RESTING_HR_FILE, LEARNED_PLACES_FILE, `${JOURNALS_DIR}/`, MARKER_FILE, '.imu'];
    for (const part of parts) for (const name of names) expect(part).toContain(name);
    expect(readmeText().replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
});

describe('readMarkerVersion', () => {
  it('relit le marqueur écrit', () => {
    expect(readMarkerVersion(markerText())).toBe(MEMORY_VERSION);
  });

  it('rend une version plus récente telle quelle', () => {
    expect(readMarkerVersion(JSON.stringify({ format: MEMORY_FORMAT, version: 7, futur: true }))).toBe(7);
  });

  it('absent, illisible, vide ou d\'un autre format : version 1', () => {
    for (const text of [null, '', '{ cassé', '[]', '3', JSON.stringify({ format: 'autre', version: 7 }), JSON.stringify({ format: MEMORY_FORMAT, version: '7' }), JSON.stringify({ format: MEMORY_FORMAT })]) {
      expect(readMarkerVersion(text)).toBe(1);
    }
  });
});
