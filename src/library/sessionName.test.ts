import { describe, expect, it } from 'vitest';
import type { SessionPlace } from './places';
import { placeLabel, sessionDisplayName, sessionFileBaseName } from './sessionName';

const carte: SessionPlace = { name: 'Carnon-Plage', source: 'carte', lat: 43.548, lon: 3.98 };
const startMs = new Date(2026, 9, 10, 14, 0).getTime();

describe('sessionDisplayName', () => {
  it("compose l'activité et le lieu tant qu'aucun nom n'est donné", () => {
    expect(sessionDisplayName({ name: null, place: carte }, 'Wingfoil')).toBe('Wingfoil · Carnon-Plage');
  });

  it('le nom donné prime, pour toujours ; effacé, le nom calculé revient', () => {
    expect(sessionDisplayName({ name: 'Mistral du soir', place: carte }, 'Wingfoil')).toBe('Mistral du soir');
    expect(sessionDisplayName({ name: '   ', place: carte }, 'Wingfoil')).toBe('Wingfoil · Carnon-Plage');
    expect(sessionDisplayName({ name: null, place: carte }, 'Wingfoil')).toBe('Wingfoil · Carnon-Plage');
  });

  it("suit un changement d'activité sans rien réécrire", () => {
    const record = { name: null, place: carte };
    expect(sessionDisplayName(record, 'Kite')).toBe('Kite · Carnon-Plage');
  });

  it("sans lieu (pas encore cherché, ou rien trouvé) : l'activité seule ; sans rien : le repli", () => {
    expect(sessionDisplayName({ name: null }, 'Surf')).toBe('Surf');
    expect(sessionDisplayName({ name: null, place: { ...carte, name: null } }, 'Surf')).toBe('Surf');
    expect(sessionDisplayName({ name: null, place: carte }, null)).toBe('Carnon-Plage');
    expect(sessionDisplayName({ name: null }, null)).toBe('Session');
    expect(sessionDisplayName({ name: null }, null, 'Voile')).toBe('Voile');
  });

  it("un lieu corrigé par l'utilisateur se lit comme un lieu de la carte", () => {
    const corrected: SessionPlace = { ...carte, name: 'Les Roquilles', source: 'utilisateur' };
    expect(sessionDisplayName({ name: null, place: corrected }, 'Wingfoil')).toBe('Wingfoil · Les Roquilles');
    expect(placeLabel(corrected)).toBe('Les Roquilles');
    expect(placeLabel(undefined)).toBeNull();
  });
});

describe('sessionFileBaseName', () => {
  it('nom donné, puis lieu, puis activité seule ; sans rien, null', () => {
    expect(sessionFileBaseName({ name: 'Soir', place: carte }, 'Wingfoil', startMs, 'x.gpx')).toBe('2026-10-10 Wingfoil - Soir');
    expect(sessionFileBaseName({ name: null, place: carte }, 'Wingfoil', startMs, 'x.gpx')).toBe('2026-10-10 Wingfoil - Carnon-Plage');
    expect(sessionFileBaseName({ name: null }, 'Wingfoil', startMs, 'x.gpx')).toBe('2026-10-10 Wingfoil');
    expect(sessionFileBaseName({ name: null }, null, startMs, 'x.gpx')).toBeNull();
  });
});
