import { describe, expect, it } from 'vitest';
import { MAX_LEARNED_PLACES, learnedPlacesFileText, mergeLearnedPlaces, parseLearnedPlacesFile, readLearnedPlaces } from './learnedPlaces';
import { PLACE_RULES, type LearnedPlace } from './places';

const M_PER_DEG = (6371e3 * Math.PI) / 180;
const place = (name: string, northM: number, savedAt: number): LearnedPlace =>
  ({ name, lat: 43.54 + northM / M_PER_DEG, lon: 3.95, savedAt });

describe('lieux appris : lecture', () => {
  it('garde les lieux bien formés, du plus récent au plus ancien, champs inconnus compris', () => {
    const raw = [
      { ...place('Les Roquilles', 0, 1), note: 'futur' },
      { name: '', lat: 1, lon: 1, savedAt: 2 },
      { name: '1234', lat: 1, lon: 1, savedAt: 2 },
      { name: 'Hors bornes', lat: 91, lon: 1, savedAt: 2 },
      'bruit',
      { name: ' Port de Carnon ', lat: 43.55, lon: 3.98 },
      place('Plage du Petit Travers', 5000, 3),
    ];
    expect(readLearnedPlaces(raw)).toEqual([
      place('Plage du Petit Travers', 5000, 3),
      { ...place('Les Roquilles', 0, 1), note: 'futur' },
      { name: 'Port de Carnon', lat: 43.55, lon: 3.98, savedAt: 0 },
    ]);
    expect(readLearnedPlaces(null)).toEqual([]);
    expect(readLearnedPlaces({ places: [] })).toEqual([]);
  });

  it(`au plus ${MAX_LEARNED_PLACES}`, () => {
    const many = Array.from({ length: MAX_LEARNED_PLACES + 5 }, (_, i) => place(`Lieu ${String.fromCharCode(65 + (i % 26))}`, i * 1000, i));
    expect(readLearnedPlaces(many)).toHaveLength(MAX_LEARNED_PLACES);
  });
});

describe('lieux appris : fusion entre appareils', () => {
  it('union des lieux éloignés ; au même endroit, la correction la plus récente', () => {
    const phone = [place('Plage des Roquilles', 0, 5), place('Port de Carnon', 4000, 2)];
    const pc = [place('Les Roquilles', 200, 3), place('Étang de l\'Or', 9000, 4)];
    expect(mergeLearnedPlaces(phone, pc, PLACE_RULES).map((p) => p.name)).toEqual(['Plage des Roquilles', 'Étang de l\'Or', 'Port de Carnon']);
    // Dans l'autre sens, même résultat.
    expect(mergeLearnedPlaces(pc, phone, PLACE_RULES).map((p) => p.name)).toEqual(['Plage des Roquilles', 'Étang de l\'Or', 'Port de Carnon']);
  });

  it('à même date, le premier de la liste ; une même liste ne change pas', () => {
    const a = [place('Ici', 0, 1)];
    const b = [place('Là', 100, 1)];
    expect(mergeLearnedPlaces(a, b, PLACE_RULES)).toEqual(a);
    expect(mergeLearnedPlaces(a, a, PLACE_RULES)).toEqual(a);
  });
});

describe('fichier lieux.json', () => {
  it('se relit tel qu\'écrit ; absent, vide et inscriptible', () => {
    const places = [place('Les Roquilles', 0, 1)];
    expect(parseLearnedPlacesFile(learnedPlacesFileText(places))).toEqual({ places, writable: true });
    expect(parseLearnedPlacesFile(null)).toEqual({ places: [], writable: true });
  });

  it('forme inconnue gardée : un fichier illisible ou d\'un autre format n\'est pas lu (jamais écrasé) ; d\'une version plus récente, lu sans être réécrit', () => {
    expect(parseLearnedPlacesFile('{abîmé')).toBeNull();
    expect(parseLearnedPlacesFile(JSON.stringify({ format: 'autre', version: 1, places: [] }))).toBeNull();
    expect(parseLearnedPlacesFile(JSON.stringify({ format: 'gtracker-lieux', version: 1, places: 'non' }))).toBeNull();
    const future = JSON.stringify({ format: 'gtracker-lieux', version: 2, places: [{ ...place('Les Roquilles', 0, 1), rayon: 300 }] });
    expect(parseLearnedPlacesFile(future)).toEqual({ places: [{ ...place('Les Roquilles', 0, 1), rayon: 300 }], writable: false });
  });
});
