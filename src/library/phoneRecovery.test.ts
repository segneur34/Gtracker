import { describe, expect, it } from 'vitest';
import type { ImportReport } from './importReport';
import { choosePhoneFiles, describePhoneRecovery } from './phoneRecovery';

/** Choix des fichiers du téléphone à lire : une session déjà sur le PC n'est pas lue, tout le reste passe à l'import. */

const f = (path: string, size: number) => ({ path, size });

describe('choosePhoneFiles', () => {
  it('rien sur le PC : tout est importé, GPX, fiches et capteurs lus', () => {
    const phone = [f('sessions/a.gpx', 100), f('sessions/a.json', 20), f('sessions/a.imu', 50), f('sessions/b.gpx', 80)];
    expect(choosePhoneFiles(phone, [])).toEqual({ toImport: phone.map((x) => x.path), alreadyHere: [], toRead: 4 });
  });

  it('même GPX, même taille, sans capteurs : déjà là, fiche comprise, rien de lu', () => {
    const phone = [f('sessions/a.gpx', 100), f('sessions/a.json', 20), f('sessions/b.gpx', 80)];
    const choice = choosePhoneFiles(phone, [f('a.gpx', 100), f('a.json', 999)]);
    expect(choice).toEqual({ toImport: ['sessions/b.gpx'], alreadyHere: ['sessions/a.gpx'], toRead: 1 });
  });

  it('capteurs de même taille des deux côtés : déjà là', () => {
    const choice = choosePhoneFiles([f('sessions/a.gpx', 100), f('sessions/a.imu', 50)], [f('a.gpx', 100), f('a.imu', 50)]);
    expect(choice.alreadyHere).toEqual(['sessions/a.gpx']);
    expect(choice.toImport).toEqual([]);
  });

  it('capteurs absents du PC ou de taille différente : la session passe à l’import, qui les ajoutera', () => {
    const phone = [f('sessions/a.gpx', 100), f('sessions/a.imu', 50)];
    expect(choosePhoneFiles(phone, [f('a.gpx', 100)]).toImport).toEqual(['sessions/a.gpx', 'sessions/a.imu']);
    expect(choosePhoneFiles(phone, [f('a.gpx', 100), f('a.imu', 49)]).alreadyHere).toEqual([]);
  });

  it('GPX de taille différente : importé (l’import reconnaît une session déjà rangée par son départ)', () => {
    expect(choosePhoneFiles([f('sessions/a.gpx', 101)], [f('a.gpx', 100)])).toEqual({ toImport: ['sessions/a.gpx'], alreadyHere: [], toRead: 1 });
  });

  it('noms comparés sans la casse, comme le disque de Windows', () => {
    expect(choosePhoneFiles([f('sessions/A.GPX', 100)], [f('a.gpx', 100)]).alreadyHere).toEqual(['sessions/A.GPX']);
  });

  it('une fiche ou des capteurs sans GPX ne sont pas comptés à lire ; un FIT l’est', () => {
    const choice = choosePhoneFiles([f('profil.json', 10), f('sessions/x.imu', 5), f('montre.fit', 40)], []);
    expect(choice.toImport).toEqual(['profil.json', 'sessions/x.imu', 'montre.fit']);
    expect(choice.toRead).toBe(1);
  });

  it('un GPX de la racine et un de sessions/ du même nom restent deux sessions distinctes, sans se prendre leurs fiches', () => {
    const choice = choosePhoneFiles([f('a.gpx', 100), f('sessions/a.gpx', 200), f('sessions/a.json', 20)], [f('a.gpx', 200)]);
    expect(choice.alreadyHere).toEqual(['sessions/a.gpx']);
    expect(choice.toImport).toEqual(['a.gpx']);
  });
});

const report = (patch: Partial<ImportReport> = {}): ImportReport => ({
  added: [], existing: [], duplicates: 0, invalid: [], ignored: [], notActivities: [], otherSports: [], unsaved: 0, failed: [], retryable: [],
  motionAdded: 0, motionFailed: [], recordCompleted: 0, recordNotRead: 0, legacyRecordsIgnored: [], ...patch,
});

describe('describePhoneRecovery', () => {
  it('chaque état du téléphone a sa phrase et propose « Réessayer »', () => {
    const texts = (['absent', 'autorisation', 'horsLigne', 'occupe'] as const).map((state) => describePhoneRecovery({ kind: 'phone', state }));
    expect(new Set(texts.map((x) => x.paragraphs[0])).size).toBe(4);
    expect(texts.every((x) => x.retry && x.folder === null)).toBe(true);
    expect(texts[0].paragraphs[1]).toContain('Débogage USB');
  });

  it('outil introuvable : le dossier où le poser, à part', () => {
    const text = describePhoneRecovery({ kind: 'tool-missing', folder: 'C:\\Gtracker\\profil' });
    expect(text.folder).toBe('C:\\Gtracker\\profil');
    expect(text.paragraphs.join(' ')).toContain('platform-tools');
    expect(text.retry).toBe(true);
  });

  it('compte rendu : ajoutées et déjà présentes, sans « Réessayer »', () => {
    const text = describePhoneRecovery({ kind: 'done', phone: 'Xiaomi', report: report({ added: ['a.gpx', 'b.gpx', 'c.gpx'], duplicates: 2 }), sessionsOnPhone: 5, unplugged: false });
    expect(text).toEqual({ paragraphs: ['3 sessions ajoutées, 2 déjà présentes.'], folder: null, retry: false });
  });

  it('débranché en route : ce qui est rangé reste, « Réessayer » proposé', () => {
    const text = describePhoneRecovery({ kind: 'done', phone: 'Xiaomi', report: report({ added: ['a.gpx'], failed: ['b.gpx : téléphone débranché'], retryable: ['b.gpx'] }), sessionsOnPhone: 2, unplugged: true });
    expect(text.retry).toBe(true);
    expect(text.paragraphs[0]).toContain('débranché');
    expect(text.paragraphs[1]).toBe('1 session ajoutée.');
  });

  it('fichiers non rangés : nommés, « Réessayer » si un nouvel essai peut réussir', () => {
    const text = describePhoneRecovery({ kind: 'done', phone: 'Xiaomi', report: report({ failed: ['b.gpx : délai'], retryable: ['b.gpx'] }), sessionsOnPhone: 1, unplugged: false });
    expect(text.paragraphs[1]).toBe('1 fichier non rangé (b.gpx : délai).');
    expect(text.retry).toBe(true);
  });

  it('rien sur le téléphone : une phrase qui le dit', () => {
    const text = describePhoneRecovery({ kind: 'done', phone: 'Xiaomi', report: report(), sessionsOnPhone: 0, unplugged: false });
    expect(text.paragraphs[0]).toContain('Aucune session');
  });
});
