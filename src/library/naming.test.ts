import { describe, expect, it } from 'vitest';
import { downloadBaseName, guessSport, uniqueSessionFileName } from './naming';

describe('uniqueSessionFileName', () => {
  it("garde le nom s'il est libre, sinon ajoute un numéro", () => {
    expect(uniqueSessionFileName('a.gpx', [])).toBe('a.gpx');
    expect(uniqueSessionFileName('a.gpx', ['a.gpx'])).toBe('a-2.gpx');
    expect(uniqueSessionFileName('a.gpx', ['a.gpx', 'a-2.gpx'])).toBe('a-3.gpx');
  });

  it('écarte aussi un nom dont la fiche est prise', () => {
    expect(uniqueSessionFileName('a.gpx', ['a.json'])).toBe('a-2.gpx');
  });

  it('écarte aussi un nom dont les capteurs sont restés seuls', () => {
    expect(uniqueSessionFileName('a.gpx', ['a.imu'])).toBe('a-2.gpx');
  });

  it('ignore la casse, comme Windows', () => {
    expect(uniqueSessionFileName('Sortie.gpx', ['sortie.GPX'])).toBe('Sortie-2.gpx');
  });
});

describe('guessSport', () => {
  it('reconnaît nos supports tels que notre GPX les écrit', () => {
    expect(guessSport('wingfoil')).toBe('wingfoil');
    expect(guessSport('bateau')).toBe('bateau');
    expect(guessSport('surf')).toBe('surf');
  });

  it("une trace de course ou de vélo, de l'application complète ou d'ailleurs, est à classer (lot 305)", () => {
    for (const type of ['running', 'cycling', 'run-intervals', 'muscu', 'Trail Running', 'trail_running', 'Road Cycling', 'mountain_biking', 'Ride']) {
      expect(guessSport(type), type).toBeNull();
    }
  });

  it('reconnaît les types des autres applications, quelle que soit leur graphie', () => {
    expect(guessSport('Windsurfing')).toBe('windsurf');
    expect(guessSport('wind_surf')).toBe('windsurf');
    expect(guessSport('kitesurfing')).toBe('kite');
    expect(guessSport('Wing Foiling')).toBe('wingfoil');
    expect(guessSport('Surfing')).toBe('surf');
    expect(guessSport('surf')).toBe('surf');
    // Le kitesurf reste du kite.
    expect(guessSport('Kitesurf')).toBe('kite');
  });

  it('rend `null` pour un type inconnu ou absent', () => {
    expect(guessSport('parapente')).toBeNull();
    expect(guessSport('9')).toBeNull();
    expect(guessSport(undefined)).toBeNull();
    expect(guessSport('toString')).toBeNull();
  });
});

describe('downloadBaseName', () => {
  it("écrit la date du début, l'activité puis le nom", () => {
    const startMs = new Date(2026, 9, 10, 10, 0).getTime();
    expect(downloadBaseName('Carnon', 'Wingfoil', startMs, 'x.gpx')).toBe('2026-10-10 Wingfoil - Carnon');
  });

  it('prend sinon la date du nom de fichier', () => {
    expect(downloadBaseName(' Carnon ', 'Wingfoil', null, '2026-10-09_10-00-00_wingfoil.gpx')).toBe('2026-10-09 Wingfoil - Carnon');
  });

  it("se passe de date et d'activité inconnues", () => {
    expect(downloadBaseName('Carnon', null, null, 'sortie.gpx')).toBe('Carnon');
  });
});
