import { describe, expect, it } from 'vitest';
import { describeImport, describeRefresh, type ImportReport } from './importReport';

const report = (patch: Partial<ImportReport> = {}): ImportReport => ({
  added: [], existing: [], duplicates: 0, invalid: [], ignored: [], notActivities: [], otherSports: [], unsaved: 0, failed: [], retryable: [], motionAdded: 0,
  motionFailed: [], recordCompleted: 0, recordNotRead: 0, legacyRecordsIgnored: [], ...patch,
});

describe("compte rendu d'un import (lot 72)", () => {
  it('un FIT qui n\'est pas une activité : dit seulement s\'il n\'y a rien d\'autre à dire (lot 35)', () => {
    expect(describeImport(report({ notActivities: ['r.fit'] }))).toBe("Ce fichier de montre n'est pas une activité (réglages, parcours…) : rien n'a été importé.");
    expect(describeImport(report({ notActivities: ['r.fit', 's.fit'] }))).toBe("Ces 2 fichiers de montre ne sont pas des activités (réglages, parcours…) : rien n'a été importé.");
    expect(describeImport(report({ notActivities: ['r.fit'], added: ['a.gpx'] }))).toBe('1 session ajoutée.');
    expect(describeImport(report({ notActivities: ['r.fit'], duplicates: 1 }))).toBe('0 sessions ajoutées, 1 déjà présente.');
  });

  it('dit à part les capteurs illisibles, session gardée sans eux (lot 148)', () => {
    expect(describeImport(report({ added: ['a.gpx'], motionFailed: ['a.gpx'] })))
      .toBe('1 session ajoutée, capteurs illisibles pour 1 session (a.gpx), gardée sans eux : un nouvel import les ajoutera.');
    expect(describeImport(report({ added: ['a.gpx', 'b.gpx'], motionFailed: ['a.gpx', 'b.gpx'] })))
      .toContain('capteurs illisibles pour 2 sessions (a.gpx, b.gpx), gardées sans eux');
  });

  it('dit les sessions ajoutées, au singulier comme au pluriel', () => {
    expect(describeImport(report({ added: ['a.gpx'] }))).toBe('1 session ajoutée.');
    expect(describeImport(report())).toBe('0 sessions ajoutées.');
  });

  it('ajoute les déjà présentes, complétées, illisibles et non rangées, dans cet ordre', () => {
    expect(describeImport(report({
      added: ['a.gpx', 'b.gpx'], duplicates: 2, motionAdded: 1, recordCompleted: 3, invalid: ['x.gpx'], unsaved: 1,
    }))).toBe(
      '2 sessions ajoutées, 2 déjà présentes, capteurs ajoutés à 1 session déjà présente, '
      + 'fiche complétée pour 3 sessions déjà présentes, 1 illisible (x.gpx), '
      + "1 non rangée : désignez d'abord le dossier mémoire (Réglages › Mémoire).",
    );
  });

  it('dit les déjà présentes dont la fiche n’a pas pu être relue, non complétées (lot 116)', () => {
    expect(describeImport(report({ duplicates: 1, recordNotRead: 1 }))).toBe(
      '0 sessions ajoutées, 1 déjà présente, fiche non relue pour 1 session déjà présente : non complétée.',
    );
    expect(describeImport(report({ duplicates: 2, recordNotRead: 2 }))).toBe(
      '0 sessions ajoutées, 2 déjà présentes, fiche non relue pour 2 sessions déjà présentes : non complétées.',
    );
  });

  it('compte les sessions de course, de vélo ou d’entraînement laissées de côté, sans les nommer (lot 321)', () => {
    expect(describeImport(report({ otherSports: ['course.fit'] }))).toBe(
      "1 session de course, de vélo ou d'entraînement laissée de côté : Gtracker ne range que la voile et le surf.",
    );
    expect(describeImport(report({ added: ['a.gpx'], otherSports: ['c.fit', 'v.gpx', 'r.gpx'] }))).toBe(
      "1 session ajoutée. 3 sessions de course, de vélo ou d'entraînement laissées de côté : Gtracker ne range que la voile et le surf.",
    );
    // Avec un FIT qui n'est pas une activité : il y a autre chose à dire que lui.
    expect(describeImport(report({ otherSports: ['c.fit'], notActivities: ['r.fit'] }))).toBe(
      "1 session de course, de vélo ou d'entraînement laissée de côté : Gtracker ne range que la voile et le surf.",
    );
    expect(describeImport(report({ otherSports: ['c.fit'] }))).not.toContain('c.fit');
  });

  it('dit la fiche de l’autre application non reprise, la trace rangée seule (lot 321)', () => {
    expect(describeImport(report({ added: ['a.gpx'], legacyRecordsIgnored: ['a.gpx'] }))).toBe(
      "1 session ajoutée, fiche de l'autre application d'une version plus récente ou illisible pour 1 session (a.gpx) : "
      + 'trace seule rangée, sans nom, notes ni repères.',
    );
  });
});

describe('compte rendu de « Mettre à jour » (lot 113)', () => {
  it('dit les sessions apparues et disparues, d’après leurs débuts de trace', () => {
    expect(describeRefresh(new Set([1, 2]), new Set([1, 2]))).toBe('Dossier relu : rien de nouveau.');
    expect(describeRefresh(new Set([1]), new Set([1, 2]))).toBe('Dossier relu : 1 session de plus.');
    expect(describeRefresh(new Set([1, 2, 3]), new Set([4]))).toBe('Dossier relu : 1 session de plus, 3 sessions en moins.');
  });
});
