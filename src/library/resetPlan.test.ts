import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../core/appIdentity';
import { createFakeFolder } from '../test/memoryFolder.fixture';
import {
  KEY_CLASSES, RECORDING_REFUSAL, eraseAppFiles, eraseKeyPlan, factoryKeyPlan, isAppMemoryFile, memoryResetTargets,
  ownSettingsFiles, resetConfirmText, resetInterruptedText, resetRefusal, type MemoryListings, type ResetContext,
} from './resetPlan';

const file = (name: string) => ({ name, kind: 'file' as const });
const dir = (name: string) => ({ name, kind: 'directory' as const });

describe('clés de l\'appareil', () => {
  it('chaque clé est classée, et seulement elles', () => {
    expect(Object.keys(KEY_CLASSES).sort()).toEqual(Object.keys(STORAGE_KEYS).sort());
  });

  it('le dossier désigné ne s\'efface jamais', () => {
    const { remove, write } = factoryKeyPlan(1);
    expect(remove).not.toContain(STORAGE_KEYS.memoryFolder);
    expect(Object.keys(write)).not.toContain(STORAGE_KEYS.memoryFolder);
    expect(eraseKeyPlan([STORAGE_KEYS.memoryFolder, 'gtracker.autre'])).not.toContain(STORAGE_KEYS.memoryFolder);
  });

  it('réglages d\'usine : l\'instant des réglages posé à maintenant, jamais retiré', () => {
    const { remove, write } = factoryKeyPlan(1234);
    expect(remove).not.toContain(STORAGE_KEYS.settingsSavedAt);
    expect(write[STORAGE_KEYS.settingsSavedAt]).toBe(1234);
  });

  it('réglages d\'usine : les réglages des activités remis à vide, le reste des réglages retiré', () => {
    const { remove, write } = factoryKeyPlan(1);
    expect(write[STORAGE_KEYS.sportSettings]).toEqual({});
    expect(remove).not.toContain(STORAGE_KEYS.sportSettings);
    for (const key of [STORAGE_KEYS.theme, STORAGE_KEYS.panelSizes, STORAGE_KEYS.rechercheLieu, STORAGE_KEYS.heartRateBelts, STORAGE_KEYS.seenSettingsFiles]) {
      expect(remove).toContain(key);
    }
  });

  it('réglages d\'usine : profil, tests de FC repos, lieux corrigés et appareil gardés', () => {
    const { remove, write } = factoryKeyPlan(1);
    const touched = [...remove, ...Object.keys(write)];
    for (const key of [
      STORAGE_KEYS.athleteProfile, STORAGE_KEYS.restingHr, STORAGE_KEYS.lieuxAppris, STORAGE_KEYS.deviceId,
      STORAGE_KEYS.deviceName, STORAGE_KEYS.summaryGestures, STORAGE_KEYS.followedTrace, STORAGE_KEYS.libraryCache,
      STORAGE_KEYS.permissionsSeenVersion, STORAGE_KEYS.autostartOpened,
    ]) {
      expect(touched).not.toContain(key);
    }
  });

  it('tout supprimer : toutes les clés sauf le dossier, et toute autre clé de l\'application rangée', () => {
    const keys = eraseKeyPlan(['gtracker.ancienne', 'autre.application', STORAGE_KEYS.theme]);
    const expected = Object.values(STORAGE_KEYS).filter((k) => k !== STORAGE_KEYS.memoryFolder);
    expect(keys.filter((k) => k !== 'gtracker.ancienne').sort()).toEqual([...expected].sort());
    expect(keys).toContain('gtracker.ancienne');
    expect(keys).not.toContain('autre.application');
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('fichiers de l\'application dans le dossier mémoire', () => {
  it('les siens', () => {
    for (const [d, n] of [
      ['', 'gtracker.json'], ['', 'LISEZMOI.txt'], ['', 'fc-repos.json'], ['', 'lieux.json'], ['', 'reglages.json'],
      ['sessions', 'a.gpx'], ['sessions', 'a.GPX'], ['sessions', 'a.json'], ['sessions', 'a.imu'],
      ['sessions', 'a.json.gtracker-tmp'], ['sessions', 'a.gpx.gtracker-new'], ['sessions', 'a.gpx.tmp'],
      ['itineraires', 'r.json'], ['itineraires', 'r.gpx'], ['reglages', 'pc.json'], ['', 'gtracker.json.gtracker-tmp'],
    ]) {
      expect(isAppMemoryFile(d, n), `${d}/${n}`).toBe(true);
    }
  });

  it('jamais un fichier étranger', () => {
    for (const [d, n] of [
      ['', 'a-moi.txt'], ['', 'x.gpx'], ['', 'photo.jpg'], ['', 'autre.json'], ['', 'notes.txt.tmp'],
      ['sessions', 'notes.txt'], ['sessions', 'montre.fit'], ['sessions', 'sous/x.gpx'], ['sessions', '.gtracker-tmp'],
      ['photos', 'x.jpg'], ['photos', 'x.gpx'], ['reglages', 'lisez.txt'], ['reglages', 'pc.gpx'], ['itineraires', 'r.txt'],
      ['sessions/sous', 'x.gpx'],
    ]) {
      expect(isAppMemoryFile(d, n), `${d}/${n}`).toBe(false);
    }
  });

  const listings = (): MemoryListings => ({
    root: [file('gtracker.json'), file('LISEZMOI.txt'), file('fc-repos.json'), file('lieux.json'), file('a-moi.txt'), file('x.gpx'), dir('sessions'), dir('photos')],
    sessions: [file('a.json'), file('a.gpx'), file('a.imu'), file('b.gpx'), file('notes.txt'), dir('sous'), dir('c.gpx')],
    routes: [file('r.json'), file('r.gpx'), file('lisez.txt')],
    settings: [file('pc.json'), file('autre.json'), file('lisez.txt')],
    journals: [file('journal-1.jsonl'), dir('sous')],
  });

  it('dans l\'ordre : journaux, GPX, fiches et capteurs, itinéraires, réglages, racine, marqueur en dernier ; jamais un dossier', () => {
    const { paths, sessions, routes } = memoryResetTargets(listings());
    expect(paths).toEqual([
      'journaux/journal-1.jsonl',
      'sessions/a.gpx', 'sessions/b.gpx', 'sessions/a.json', 'sessions/a.imu',
      'itineraires/r.json', 'itineraires/r.gpx', 'reglages/pc.json', 'reglages/autre.json',
      'LISEZMOI.txt', 'fc-repos.json', 'lieux.json', 'gtracker.json',
    ]);
    expect(sessions).toBe(2);
    expect(routes).toBe(1);
  });

  it('corbeille du programme Windows : son index d\'abord, puis les fichiers de ses entrées ; rien d\'étranger', () => {
    const { paths, trash } = memoryResetTargets({
      ...listings(),
      trash: {
        root: [file('corbeille.json'), file('a-moi.txt'), dir('1763600000000-1763500000000'), dir('photos')],
        dirs: {
          '1763600000000-1763500000000': [file('a.gpx'), file('a.json'), file('a.imu'), file('notes.txt'), dir('sous')],
          '1763600000001-vide': [],
          photos: [file('x.gpx')],
        },
      },
    });
    expect(paths.slice(0, 5)).toEqual([
      'corbeille/corbeille.json',
      'corbeille/1763600000000-1763500000000/a.gpx', 'corbeille/1763600000000-1763500000000/a.json',
      'corbeille/1763600000000-1763500000000/a.imu',
      'journaux/journal-1.jsonl',
    ]);
    expect(paths.some((p) => p.includes('photos') || p.includes('notes.txt') || p.includes('a-moi'))).toBe(false);
    expect(trash).toBe(1);
    expect(memoryResetTargets(listings()).trash).toBe(0);
  });

  it('efface les fichiers de l\'application d\'un dossier, et laisse les autres', async () => {
    const files = new Map([
      ['gtracker.json', '{}'], ['LISEZMOI.txt', ''], ['a-moi.txt', 'à moi'], ['x.gpx', '<gpx/>'],
      ['sessions/a.gpx', ''], ['sessions/a.json', ''], ['sessions/notes.txt', ''], ['reglages/pc.json', ''],
      ['reglages/lisez.txt', ''], ['photos/x.jpg', ''], ['itineraires/r.json', ''], ['journaux/j.jsonl', ''],
    ]);
    const log: string[] = [];
    const progress: number[] = [];
    const result = await eraseAppFiles(createFakeFolder(files, log), (done) => progress.push(done));
    expect(result).toEqual({ sessionsDone: 1, sessionsTotal: 1, error: null });
    expect([...files.keys()].sort()).toEqual(['a-moi.txt', 'photos/x.jpg', 'reglages/lisez.txt', 'sessions/notes.txt', 'x.gpx']);
    expect(log[log.length - 1]).toBe('remove gtracker.json');
    expect(progress[progress.length - 1]).toBe(log.length);
  });

  it('un échec à mi-chemin arrête tout et dit où on en est', async () => {
    const files = new Map([['gtracker.json', '{}'], ['sessions/a.gpx', ''], ['sessions/b.gpx', ''], ['sessions/a.json', ''], ['reglages/pc.json', '']]);
    const log: string[] = [];
    const folder = createFakeFolder(files, log, {
      remove: async (path) => {
        if (path === 'sessions/b.gpx') throw new Error('accès retiré');
        log.push(`remove ${path}`);
        files.delete(path);
      },
    });
    const result = await eraseAppFiles(folder);
    expect(result.sessionsDone).toBe(1);
    expect(result.sessionsTotal).toBe(2);
    expect(String(result.error)).toContain('accès retiré');
    expect(log).toEqual(['remove sessions/a.gpx']);
    expect(files.has('reglages/pc.json') && files.has('gtracker.json') && files.has('sessions/a.json')).toBe(true);
  });

  it('un dossier illisible n\'efface rien', async () => {
    const log: string[] = [];
    const folder = createFakeFolder(new Map([['sessions/a.gpx', '']]), log, { list: async () => { throw new Error('illisible'); } });
    const result = await eraseAppFiles(folder);
    expect(result.error).not.toBeNull();
    expect(log).toEqual([]);
  });

  it('réglages d\'usine ne vise que le fichier de cet appareil', () => {
    expect(ownSettingsFiles([
      { fileName: 'pc.json', deviceId: 'moi' }, { fileName: 'lea.json', deviceId: 'lea' }, { fileName: 'vieux.json', deviceId: null },
    ], 'moi')).toEqual(['pc.json']);
  });
});

describe('textes', () => {
  it('confirmation de tout supprimer : le nombre de sessions, au singulier, au pluriel et à zéro', () => {
    expect(resetConfirmText('tout', { sessions: 42, pending: 0, routes: 3 })).toMatch(/^Tout supprimer \? Seront effacés définitivement : 42 sessions et leurs fiches, 3 itinéraires, le profil/);
    expect(resetConfirmText('tout', { sessions: 1, pending: 0, routes: 1 })).toContain(': 1 session et leur fiche, 1 itinéraire, le profil');
    expect(resetConfirmText('tout', { sessions: 40, pending: 2, routes: 0 })).toContain(': 42 sessions et leurs fiches (dont 2 en attente d\'un dossier), le profil');
    const none = resetConfirmText('tout', { sessions: 0, pending: 0, routes: 0 });
    expect(none).toContain(': le profil, les tests de FC repos, les lieux corrigés, les réglages et les cartes gardées.');
    expect(none).not.toMatch(/session|itinéraire/);
  });

  it('confirmation des réglages d\'usine : ce qui reste', () => {
    const usine = resetConfirmText('usine', { sessions: 5, pending: 0, routes: 0 });
    expect(usine).toContain('Les sessions, les itinéraires, le profil et les lieux corrigés restent.');
    expect(usine).toContain('Les activités que vous avez créées et vos listes de matériel sont effacées ; leurs sessions restent');
  });

  it('compte rendu d\'une interruption', () => {
    expect(resetInterruptedText({ sessionsDone: 12, sessionsTotal: 40 }, 'accès retiré')).toBe(
      "Remise à zéro interrompue (accès retiré) : 12 sessions effacées sur 40 ; réglages, profil et cartes intacts. Vérifiez l'accès au dossier mémoire, puis recommencez.",
    );
    expect(resetInterruptedText({ sessionsDone: 1, sessionsTotal: 2 }, 'x')).toContain('1 session effacée sur 2');
  });
});

describe('refus', () => {
  const free: ResetContext = { recording: false, pendingSession: false, memoryStatus: 'ready', readOnly: false, importing: false, designated: true };

  it('permis au repos', () => {
    expect(resetRefusal('usine', free)).toBeNull();
    expect(resetRefusal('tout', free)).toBeNull();
  });

  it('refusés pendant un enregistrement ou une session arrêtée en attente', () => {
    expect(resetRefusal('usine', { ...free, recording: true })).toBe(RECORDING_REFUSAL);
    expect(resetRefusal('tout', { ...free, recording: true })).toBe(RECORDING_REFUSAL);
    expect(resetRefusal('tout', { ...free, pendingSession: true })).not.toBeNull();
    expect(resetRefusal('usine', { ...free, pendingSession: true })).not.toBeNull();
  });

  it('refusés pendant un import ou l\'ouverture de la mémoire', () => {
    expect(resetRefusal('tout', { ...free, importing: true })).not.toBeNull();
    expect(resetRefusal('usine', { ...free, memoryStatus: 'opening' })).not.toBeNull();
  });

  it('tout supprimer refusé sans accès au dossier ou en lecture seule ; permis sans dossier', () => {
    expect(resetRefusal('tout', { ...free, memoryStatus: 'needs-permission' })).toMatch(/accès au dossier/);
    expect(resetRefusal('tout', { ...free, readOnly: true })).toMatch(/version plus récente/);
    expect(resetRefusal('tout', { ...free, memoryStatus: 'unavailable', designated: false })).toBeNull();
    expect(resetRefusal('usine', { ...free, memoryStatus: 'needs-permission' })).toBeNull();
  });

  it('tout supprimer refusé quand un dossier désigné n\'a pas pu s\'ouvrir ; réglages d\'usine permis', () => {
    expect(resetRefusal('tout', { ...free, memoryStatus: 'unavailable', designated: true })).toMatch(/accès au dossier/);
    expect(resetRefusal('usine', { ...free, memoryStatus: 'unavailable', designated: true })).toBeNull();
    expect(resetRefusal('usine', { ...free, readOnly: true })).toBeNull();
  });
});
