import { describe, expect, it } from 'vitest';
import type { ImportReport } from './importReport';
import { choosePhoneFiles, describeArrivalRecovery, describePhoneRecovery, type PhoneRecoveryOutcome } from './phoneRecovery';

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

  it('téléphone absent, sans-fil à l\'écoute : d\'abord ouvrir Gtracker sur le même réseau, le câble en second', () => {
    const text = describePhoneRecovery({ kind: 'phone', state: 'absent', wireless: 'listening' });
    expect(text.paragraphs[0]).toContain('Ouvrez Gtracker sur votre téléphone');
    expect(text.paragraphs[0]).toContain('même réseau');
    expect(text.paragraphs[0]).toContain('partage de connexion');
    expect(text.paragraphs[1]).toContain('câble USB');
    expect(text.retry).toBe(true);
  });

  it('téléphone absent, sans-fil éteint : le câble, puis de quoi allumer le sans-fil', () => {
    const text = describePhoneRecovery({ kind: 'phone', state: 'absent', wireless: 'off' });
    expect(text.paragraphs[0]).toContain('câble USB');
    expect(text.paragraphs[2]).toContain('sans-fil');
    expect(describePhoneRecovery({ kind: 'phone', state: 'absent' }).paragraphs).toHaveLength(2);
  });

  it('liaison coupée par le Wi-Fi : rouvrir Gtracker sur le téléphone, pas rebrancher', () => {
    const text = describePhoneRecovery({ kind: 'done', phone: 'Pixel', report: report({ added: ['a.gpx'] }), sessionsOnPhone: 2, unplugged: true, channel: 'sansFil' });
    expect(text.paragraphs[0]).toContain('liaison');
    expect(text.paragraphs[2]).toContain('Rouvrez Gtracker');
    const failed = describePhoneRecovery({ kind: 'error', detail: 'délai.', channel: 'sansFil' });
    expect(failed.paragraphs[0]).toContain('Gtracker est ouvert sur le téléphone');
    expect(describePhoneRecovery({ kind: 'error', detail: 'délai.', channel: 'cable' }).paragraphs[0]).toContain('le câble');
  });
});

describe('describeArrivalRecovery', () => {
  const done = (patch: Partial<Extract<PhoneRecoveryOutcome, { kind: 'done' }>> = {}): PhoneRecoveryOutcome => ({
    kind: 'done', phone: 'Pixel', report: report(), sessionsOnPhone: 3, unplugged: false, channel: 'sansFil', ...patch,
  });

  it('sessions ajoutées, ou toutes déjà là, ou rien à récupérer : une phrase au nom du téléphone', () => {
    expect(describeArrivalRecovery(done({ report: report({ added: ['a.gpx', 'b.gpx'] }) }), 'Pixel')).toBe('Téléphone Pixel relié : 2 sessions ajoutées.');
    expect(describeArrivalRecovery(done({ report: report({ added: ['a.gpx'] }) }), 'Pixel')).toBe('Téléphone Pixel relié : 1 session ajoutée.');
    expect(describeArrivalRecovery(done({ report: report({ duplicates: 3 }) }), 'Pixel')).toBe('Téléphone Pixel relié : toutes ses sessions sont déjà là.');
    expect(describeArrivalRecovery(done({ sessionsOnPhone: 0 }), 'Pixel')).toBe('Téléphone Pixel relié : aucune session à récupérer.');
  });

  it('fichier non rangé ou liaison coupée : dit, avec « Récupérer » pour finir', () => {
    expect(describeArrivalRecovery(done({ report: report({ added: ['a.gpx'], failed: ['b.gpx : délai'] }) }), 'Pixel'))
      .toBe("Téléphone Pixel relié : 1 session ajoutée. 1 fichier n'a pas pu être rangé : cliquez sur « Récupérer » pour réessayer.");
    expect(describeArrivalRecovery(done({ unplugged: true }), 'Pixel')).toContain('« Récupérer »');
  });

  it('téléphone reparti, import déjà en cours, outil du câble manquant : rien à dire', () => {
    expect(describeArrivalRecovery({ kind: 'phone', state: 'absent' }, 'Pixel')).toBeNull();
    expect(describeArrivalRecovery({ kind: 'busy' }, 'Pixel')).toBeNull();
    expect(describeArrivalRecovery({ kind: 'tool-missing', folder: 'C:\\x' }, 'Pixel')).toBeNull();
  });

  it('mémoire fermée ou panne : la raison, en une phrase', () => {
    expect(describeArrivalRecovery({ kind: 'memory', text: 'Pas de dossier.' }, 'Pixel')).toBe('Pas de dossier.');
    expect(describeArrivalRecovery({ kind: 'error', detail: 'délai dépassé.' }, 'Pixel')).toBe('Téléphone Pixel relié, mais ses sessions n\'ont pas pu être lues (délai dépassé).');
  });
});
