import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseActivity } from '../core/activities';
import { FILE_FORMATS, STORAGE_KEYS } from '../core/appIdentity';
import type { LocationFix, LocationSource, StopLocation } from '../platform/location';
import { parseJournal } from '../recording/journal';
import { EMPTY_RECORDING_STATS, addFixAfterManualPause, addFixToStats, displayedDurationMs, type RecordingStats } from '../recording/session';

/**
 * Reprise d'un enregistrement après une chute du moteur de la page. Une chute est simulée par des modules
 * neufs (`reload`) : la mémoire de la page est perdue, le journal et les services du téléphone restent.
 */

/** Journal en mémoire ; chaque `write` compté : une reprise n'en fait jamais. */
const journal = vi.hoisted(() => {
  const file = {
    text: null as string | null,
    writes: 0,
    readFails: false,
    read: async () => {
      if (file.readFails) throw new Error('lecture impossible');
      return file.text;
    },
    write: async (text: string) => {
      file.writes += 1;
      file.text = text;
    },
    append: async (text: string) => {
      file.text = (file.text ?? '') + text;
    },
    remove: async () => {
      file.text = null;
    },
    setAside: async () => 'de-cote.jsonl',
  };
  return file;
});
vi.mock('../platform/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/files')>()),
  recordingJournal: journal,
}));

/**
 * Service de position vu par `Recording.state()` : en route (`gps`), pour la session du journal de la page sauf
 * `session` dite, en pause manuelle ou non.
 */
const services = vi.hoisted(() => ({ gps: false, session: null as number | null, paused: false }));
vi.mock('../platform/recovery', () => ({
  readRecoveryServices: async () => {
    if (!services.gps) return { gps: false, session: null, paused: false };
    let ofJournal: number | null = null;
    try {
      ofJournal = (JSON.parse((journal.text ?? '').split('\n')[0]) as { startedAtMs?: number }).startedAtMs ?? null;
    } catch {
      // Journal illisible : le service ne dit aucune session connue.
    }
    return { gps: true, session: services.session ?? ofJournal, paused: services.paused };
  },
}));

/** Service de position : le raccord sans relance, les arrêts, et son journal des positions. */
const gpsService = vi.hoisted(() => ({
  onFix: null as ((fix: LocationFix) => void) | null,
  onError: null as ((message: string) => void) | null,
  adoptions: 0,
  adoptFails: false,
  stops: 0,
  orphanStops: 0,
  /** Journal des positions du service, en texte ; `null` : aucun (comme dans le navigateur). */
  log: null as string | null,
  /** Heures après lesquelles la page a demandé le journal, dans l'ordre. */
  logReads: [] as (number | null)[],
  logClears: 0,
  /** Juste avant, puis juste après que le service a lu son fichier : une position qui arrive à ce moment-là. */
  beforeLogRead: null as (() => void) | null,
  afterLogRead: null as (() => void) | null,
}));
vi.mock('../platform/location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/location')>()),
  attachDeviceLocation: async (onFix: (fix: LocationFix) => void, onError: (message: string) => void): Promise<StopLocation> => {
    if (gpsService.adoptFails) throw new Error('pont introuvable');
    gpsService.adoptions += 1;
    gpsService.onFix = onFix;
    gpsService.onError = onError;
    return async () => {
      gpsService.stops += 1;
      gpsService.onFix = null;
    };
  },
  stopOrphanedDeviceLocation: async () => {
    gpsService.orphanStops += 1;
  },
  readLoggedFixes: async (afterMs: number | null) => {
    gpsService.logReads.push(afterMs);
    gpsService.beforeLogRead?.();
    const text = gpsService.log;
    gpsService.afterLogRead?.();
    return text;
  },
  clearLoggedFixes: async () => {
    gpsService.logClears += 1;
    gpsService.log = null;
  },
}));

/** Capture : jamais de `start` pendant une reprise ; une relance en ajout au même fichier notée dans `continued`. */
const sensors = vi.hoisted(() => ({
  starts: 0,
  stops: 0,
  pauses: 0,
  resumes: 0,
  continued: [] as { startedAtMs: number; setup: { placement: string; foil: boolean }; append: true }[],
  continueFails: false,
  /** Ce que l'arrêt rend en plus ; `null` : deux mesures. */
  stopped: null as null | { samples: number; earlierMeasures: boolean },
  running: null as null | { path: string; listening: boolean; setup: { placement: 'poitrine'; foil: boolean } },
  found: null as null | { path: string; bytes: number; durationS: number; samples: number; longestGapS: number; error: null },
  /** La lecture de la capture attend ceci : la reprise reste en `starting` le temps d'une commande. */
  gate: null as Promise<void> | null,
}));
vi.mock('../platform/motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/motion')>()),
  startMotionCapture: async () => {
    sensors.starts += 1;
  },
  continueMotionCapture: async (startedAtMs: number, setup: { placement: 'poitrine'; foil: boolean }) => {
    if (sensors.continueFails) throw new Error('fichier de mesures illisible');
    sensors.continued.push({ startedAtMs, setup, append: true });
    sensors.running = { path: `capteurs/${startedAtMs}.imu`, listening: true, setup };
  },
  pauseMotionCapture: async () => {
    sensors.pauses += 1;
  },
  resumeMotionCapture: async () => {
    sensors.resumes += 1;
  },
  runningMotionCapture: async () => {
    await sensors.gate;
    return sensors.running;
  },
  stopMotionCapture: async () => {
    sensors.stops += 1;
    const path = sensors.running?.path;
    sensors.running = null;
    return path ? { path, bytes: 10, durationS: 1, samples: 2, longestGapS: 0, error: null, ...sensors.stopped } : null;
  },
  findMotionCapture: async () => sensors.found,
  readMotionCapture: async () => null,
  removeMotionCapture: async () => undefined,
}));

/** Ceinture : reprise sans `connect` ; prises à neuf comptées, adresse demandée notée, refus sur commande. */
const belt = vi.hoisted(() => {
  const listeners = new Set<(sample: { bpm: number; timeMs: number; contact: boolean | null }) => void>();
  const strap = {
    listeners,
    adoptable: false,
    holds: 0,
    adoptions: 0,
    /** Adresses demandées au greffon, dans l'ordre, refus compris. */
    asked: [] as string[],
    holdFails: false,
    saved: null as { address: string; name: string } | null,
    /** Dernière mesure reçue, jointe aux positions comme le fait le greffon. */
    latest: null as { bpm: number; timeMs: number; contact: boolean | null } | null,
    emit: (timeMs: number, bpm: number) => {
      const sample = { bpm, timeMs, contact: true };
      strap.latest = sample;
      listeners.forEach((l) => l(sample));
    },
  };
  return strap;
});
vi.mock('../platform/heartRate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/heartRate')>()),
  adoptBelt: async () => {
    if (!belt.adoptable) return null;
    belt.adoptions += 1;
    return () => undefined;
  },
  holdBelt: async (_holder: string, wanted: { address: string }) => {
    belt.asked.push(wanted.address);
    if (belt.holdFails) throw new Error('Bluetooth éteint');
    belt.holds += 1;
    return () => undefined;
  },
  savedBelt: () => belt.saved,
  latestHeartRate: () => belt.latest,
  subscribeHeartRate: (listener: (sample: { bpm: number; timeMs: number; contact: boolean | null }) => void) => {
    belt.listeners.add(listener);
    return () => belt.listeners.delete(listener);
  },
  releaseOrphanedBelt: async () => undefined,
}));

const gpsTimer = vi.hoisted(() => ({ arms: [] as number[], disarms: 0 }));
/** Minuteur de la veille de la ceinture : délais armés, et l'écoute de son échéance par la page en cours. */
const beltTimer = vi.hoisted(() => ({ arms: [] as number[], onLost: null as (() => void) | null }));
/** Sons joués, par nom. */
const sounds = vi.hoisted(() => ({ validated: 0, finished: 0, patterns: 0 }));
vi.mock('../platform/beeper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/beeper')>()),
  getBeeper: () => ({
    setInterval: async () => undefined,
    validated: async () => {
      sounds.validated += 1;
    },
    finished: async () => {
      sounds.finished += 1;
    },
    stop: async () => undefined,
  }),
  playPattern: async () => {
    sounds.patterns += 1;
  },
  armGpsWatch: async (delayMs: number) => {
    gpsTimer.arms.push(delayMs);
  },
  disarmGpsWatch: async () => {
    gpsTimer.disarms += 1;
  },
  onGpsLost: () => () => undefined,
  armBeltWatch: async (delayMs: number) => {
    beltTimer.arms.push(delayMs);
  },
  disarmBeltWatch: async () => undefined,
  onBeltLost: (listener: () => void) => {
    beltTimer.onLost = listener;
    return () => undefined;
  },
}));

vi.mock('./useSessionLibrary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useSessionLibrary')>()),
  saveRecordedSession: async () => ({ file: 'rangee.gpx', location: 'ici' }),
}));

const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
});

const T0 = Date.UTC(2026, 10, 4, 9, 0, 0);
const activity = baseActivity('bateau');
const round = (ms: number) => Math.round(ms);

let recorder: typeof import('./useRecorder');

/** La page repart : plus rien en mémoire, le journal et les services du téléphone restent. */
const reload = async () => {
  // Les abonnés de la page tombée disparaissent avec elle.
  belt.listeners.clear();
  vi.resetModules();
  recorder = await import('./useRecorder');
  return recorder;
};

const fixAt = (s: number, speedMs = 3): LocationFix => ({ timeMs: T0 + round(s * 1000), lat: 43 + s * 1e-5, lon: 3, speedMs, accuracyM: 4 });

/** Source simulée, relevant ses démarrages. */
const fakeSource = () => {
  let onFix: ((fix: LocationFix) => void) | null = null;
  const source = {
    starts: 0,
    label: 'Simulée',
    start: async (_options: unknown, fix: (f: LocationFix) => void) => {
      source.starts += 1;
      onFix = fix;
      return async () => {
        onFix = null;
      };
    },
    emit: (s: number, speedMs = 3) => onFix?.(fixAt(s, speedMs)),
  };
  return source satisfies LocationSource & object;
};

/** Les écritures en file sont passées. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Positions de `from` à `to` secondes, horloge à leur heure. */
const run = (emit: (s: number) => void, from: number, to: number, hz: number) => {
  for (let k = Math.round(from * hz); k <= Math.round(to * hz); k++) {
    const s = k / hz;
    vi.setSystemTime(T0 + round(s * 1000));
    emit(s);
  }
};

/** Une position telle que le service l'écrit dans son journal : brute, sans fréquence cardiaque. */
const nativeFix = (s: number, speedMs = 3): string => {
  const fix = fixAt(s, speedMs);
  return `[${fix.timeMs},${fix.lat},${fix.lon},${fix.accuracyM},null,${fix.speedMs},null]\n`;
};

/** Les positions du service de `from` à `to` secondes, à `hz` Hz. */
const nativeFixes = (from: number, to: number, hz: number, speedMs = 3): string => {
  let lines = '';
  for (let k = Math.round(from * hz); k <= Math.round(to * hz); k++) lines += nativeFix(k / hz, speedMs);
  return lines;
};

/** Journal du service pour la session démarrée à `T0`, celle de tous les départs de ce fichier. */
const nativeLog = (...lines: string[]): string => `{"format":"${FILE_FORMATS.positions}","version":1,"session":${T0}}\n${lines.join('')}`;

/** Source qui, comme le service du téléphone, reçoit les ordres de pause : chacun relevé avec son heure. */
const serviceSource = () => {
  const pauses: { paused: boolean; atMs: number }[] = [];
  return Object.assign(fakeSource(), {
    pauses,
    setPaused: async (paused: boolean, atMs: number) => {
      pauses.push({ paused, atMs });
    },
  });
};

const lineCount = (marker: string): number => (journal.text ?? '').split('\n').filter((l) => l.startsWith(`["${marker}"`)).length;
/** Heure de la dernière ligne `marker` du journal de la page. */
const lastLineAt = (marker: string): number | undefined =>
  (journal.text ?? '').split('\n').filter((l) => l.startsWith(`["${marker}"`)).map((l) => (JSON.parse(l) as [string, number])[1]).at(-1);
const headerCount = (): number => (journal.text ?? '').split('\n').filter((l) => l.startsWith('{"format"')).length;

/** Le journal tel que l'écrivaient les versions d'avant : en-tête sans les réglages de la capture. */
const withoutMotionInHeader = () => {
  const [head, ...rest] = journal.text!.split('\n');
  const header = JSON.parse(head) as Record<string, unknown>;
  expect(header).toHaveProperty('motion');
  delete header.motion;
  journal.text = [JSON.stringify(header), ...rest].join('\n');
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  memory.clear();
  journal.text = null;
  journal.writes = 0;
  journal.readFails = false;
  services.gps = false;
  services.session = null;
  services.paused = false;
  gpsService.onFix = null;
  gpsService.adoptions = 0;
  gpsService.adoptFails = false;
  gpsService.stops = 0;
  gpsService.orphanStops = 0;
  gpsService.log = null;
  gpsService.logReads = [];
  gpsService.logClears = 0;
  gpsService.beforeLogRead = null;
  gpsService.afterLogRead = null;
  sensors.starts = 0;
  sensors.stops = 0;
  sensors.pauses = 0;
  sensors.resumes = 0;
  sensors.continued = [];
  sensors.continueFails = false;
  sensors.stopped = null;
  sensors.running = null;
  sensors.found = null;
  sensors.gate = null;
  belt.listeners.clear();
  belt.adoptable = false;
  belt.holds = 0;
  belt.adoptions = 0;
  belt.asked = [];
  belt.holdFails = false;
  belt.saved = null;
  belt.latest = null;
  beltTimer.arms = [];
  beltTimer.onLost = null;
  gpsTimer.arms = [];
  gpsTimer.disarms = 0;
  sounds.validated = 0;
  sounds.finished = 0;
  sounds.patterns = 0;
  await reload();
});
afterEach(() => {
  vi.useRealTimers();
});

describe.each([[1], [5]])('reprise silencieuse après une chute du moteur, à %i Hz', (hz) => {
  /** Enregistre de 0 à `toS` puis laisse le journal à jour ; à un multiple de 10 s, rien n'attend d'être écrit. */
  const recordUntil = async (toS: number) => {
    const source = fakeSource();
    await recorder.startRecording(activity, source);
    run(source.emit, 0, toS, hz);
    await settle();
    return source;
  };

  it('un seul en-tête, une seule frontière, service jamais relancé, redélivrance écartée', async () => {
    const source = await recordUntil(20);
    expect(source.starts).toBe(1);
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();

    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.pending).toBeNull();
    expect(state.resuming).toBe(false);
    expect(state.landOnRecording).toBe(true);
    expect(gpsService.adoptions).toBe(1);
    // Ni relance de la source d'avant, ni départ neuf.
    expect(source.starts).toBe(1);
    expect(state.activity?.id).toBe(activity.id);

    const before = state.stats;
    // Position déjà reçue, redélivrée par le service : écartée.
    gpsService.onFix!(fixAt(20));
    gpsService.onFix!(fixAt(19));
    expect(fresh.getRecorderState().stats).toEqual(before);
    expect(lineCount('break')).toBe(0);

    run((s) => gpsService.onFix!(fixAt(s)), 20 + 1 / hz, 30, hz);
    await settle();
    expect(headerCount()).toBe(1);
    expect(journal.writes).toBe(1);
    expect(lineCount('break')).toBe(1);
    expect(fresh.getLiveSegmentCount()).toBe(2);
  });

  it('statistiques égales à une session sans coupure, journal relu compris', async () => {
    await recordUntil(20);
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 20 + 1 / hz, 40, hz);
    await settle();

    let uncut: RecordingStats = EMPTY_RECORDING_STATS;
    run((s) => { uncut = addFixToStats(uncut, fixAt(s)); }, 0, 40, hz);
    expect(fresh.getRecorderState().stats).toEqual(uncut);

    // À l'arrêt, le GPX a tous les points, en deux segments.
    await fresh.stopRecording();
    const pending = fresh.getRecorderState().pending!;
    expect(pending.pointCount).toBe(40 * hz + 1);
    expect((pending.content.match(/<trkseg>/g) ?? []).length).toBe(2);
    expect(gpsService.stops).toBe(1);
    expect(pending.canContinue).toBe(false);
    const parsed = parseJournal(journal.text!);
    expect(parsed.fixes).toHaveLength(40 * hz + 1);
    expect(parsed.stoppedAtMs).not.toBeNull();
  });

  it('une coupure avec des positions perdues : le trou reste de la durée, comme un GPS muet', async () => {
    await recordUntil(20);
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 25, 30, hz);
    const { stats } = fresh.getRecorderState();
    expect(stats.pointCount).toBe(20 * hz + 1 + 5 * hz + 1);
    expect(displayedDurationMs(stats, null, T0)).toBe(30_000);
    expect(stats.longestGapS).toBe(5);
  });

  it('pause manuelle pendant la chute : reste en pause, durée figée, GPS gardé ; la reprise ne fait pas sauter la durée', async () => {
    const source = await recordUntil(20);
    await recorder.pauseRecording();
    run(source.emit, 21, 25, hz);
    await settle();
    const frozen = displayedDurationMs(recorder.getRecorderState().stats, recorder.getRecorderState().pauseClock, T0 + 25_000);
    expect(frozen).toBe(20_000);

    services.gps = true;
    vi.setSystemTime(T0 + 30_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('paused');
    expect(state.pausedReason).toBe('manual');
    expect(displayedDurationMs(state.stats, state.pauseClock, T0 + 300_000)).toBe(20_000);
    // Le minuteur « GPS perdu » reste coupé en pause manuelle.
    expect(gpsTimer.disarms).toBeGreaterThan(0);

    // Positions de la pause : pour la carte seule.
    run((s) => gpsService.onFix!(fixAt(s)), 31, 40, hz);
    expect(fresh.getRecorderState().stats.pointCount).toBe(20 * hz + 1);
    expect(fresh.getLivePosition()?.timeMs).toBe(T0 + 40_000);

    vi.setSystemTime(T0 + 41_000);
    await fresh.resumeRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 42, 50, hz);
    await settle();
    const after = fresh.getRecorderState();
    expect(after.status).toBe('recording');
    // 20 s avant la pause, 8 s après ; la pause et la chute ne comptent pas.
    expect(displayedDurationMs(after.stats, null, T0)).toBe(28_000);
    expect(headerCount()).toBe(1);
    expect(lineCount('break')).toBe(1);

    let uncut: RecordingStats = EMPTY_RECORDING_STATS;
    run((s) => { uncut = addFixToStats(uncut, fixAt(s)); }, 0, 20, hz);
    run((s) => { uncut = s === 42 ? addFixAfterManualPause(uncut, fixAt(s)) : addFixToStats(uncut, fixAt(s)); }, 42, 50, hz);
    expect(after.stats).toEqual(uncut);
  });

  it('pause levée, chute avant le point suivant : pas en pause, et la pause ne compte toujours pas', async () => {
    const source = await recordUntil(20);
    await recorder.pauseRecording();
    vi.setSystemTime(T0 + 60_000);
    await recorder.resumeRecording();
    await settle();
    expect(source.starts).toBe(1);

    services.gps = true;
    vi.setSystemTime(T0 + 62_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('recording');
    run((s) => gpsService.onFix!(fixAt(s)), 63, 70, hz);
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(27_000);
    await settle();
    expect(lineCount('break')).toBe(1);
  });

  it('deux chutes de suite : toujours un seul en-tête, une frontière par reprise, les mêmes chiffres', async () => {
    await recordUntil(20);
    services.gps = true;
    let page = await reload();
    await page.recoverInterruptedRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 20 + 1 / hz, 30, hz);
    await settle();
    page = await reload();
    await page.recoverInterruptedRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 30 + 1 / hz, 40, hz);
    await settle();
    expect(headerCount()).toBe(1);
    expect(journal.writes).toBe(1);
    expect(lineCount('break')).toBe(2);
    expect(page.getLiveSegmentCount()).toBe(3);
    expect(page.getRecorderState().stats.pointCount).toBe(40 * hz + 1);
    expect(displayedDurationMs(page.getRecorderState().stats, null, T0)).toBe(40_000);
  });
});

describe('reprise silencieuse, cas limites', () => {
  const source = fakeSource;

  it('appelée deux fois, ou par un départ qui arrive pendant celle du lancement : une seule reprise', async () => {
    await recorder.startRecording(activity, source());
    services.gps = true;
    const fresh = await reload();
    const start = fresh.startRecording(activity, fakeSource());
    await Promise.all([fresh.recoverInterruptedRecording(), fresh.recoverInterruptedRecording(), start]);
    expect(gpsService.adoptions).toBe(1);
    expect(journal.writes).toBe(1);
    expect(fresh.getRecorderState().status).toBe('recording');
  });

  it('dernière ligne tronquée par la coupure : la suite du journal reste lisible', async () => {
    const live = source();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await settle();
    journal.text += `[${T0 + 11_000},43.1`;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().stats.pointCount).toBe(11);
    run((s) => gpsService.onFix!(fixAt(s)), 12, 20, 1);
    await settle();
    expect(parseJournal(journal.text!).fixes).toHaveLength(20);
  });

  it('le raccord échoue : retour à l\'attente, journal intact, « Continuer » proposé puisqu\'il est frais', async () => {
    const live = source();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await settle();
    const text = journal.text;
    services.gps = true;
    gpsService.adoptFails = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(state.pending?.pointCount).toBe(11);
    expect(state.pending?.canContinue).toBe(true);
    expect(state.landOnRecording).toBe(true);
    expect(gpsService.orphanStops).toBe(1);
    expect(journal.text).toBe(text);
    expect(journal.writes).toBe(1);
  });

  it('ligne « stop » et service vivant : en attente, service arrêté, ni reprise ni offre', async () => {
    const live = source();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await recorder.stopRecording();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(gpsService.adoptions).toBe(0);
    expect(gpsService.orphanStops).toBe(1);
    expect(fresh.getRecorderState().pending?.canContinue).toBe(false);
  });

  it('sans journal et service vivant : service arrêté, rien d\'autre', async () => {
    services.gps = true;
    await recorder.recoverInterruptedRecording();
    expect(gpsService.orphanStops).toBe(1);
    expect(gpsService.adoptions).toBe(0);
    expect(recorder.getRecorderState().status).toBe('idle');
    expect(recorder.getRecorderState().pending).toBeNull();
  });

  it('sans journal ni service : rien', async () => {
    await recorder.recoverInterruptedRecording();
    expect(gpsService.orphanStops).toBe(0);
  });

  it('journal illisible et service vivant : service arrêté, journal mis de côté', async () => {
    journal.text = 'x';
    journal.readFails = true;
    services.gps = true;
    expect(await recorder.recoverInterruptedRecording()).toBe('setAside');
    expect(gpsService.orphanStops).toBe(1);
    expect(gpsService.adoptions).toBe(0);
  });

  it('capture ouverte : suivie, jamais redémarrée ; rendue à l\'arrêt', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await settle();
    expect(sensors.starts).toBe(1);
    const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
    sensors.running = { path: `capteurs/${startedAtMs}.imu`, listening: true, setup: { placement: 'poitrine', foil: false } };
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.measuringMotion).toBe(true);
    expect(state.motionSetup).toEqual({ placement: 'poitrine', foil: false });
    expect(sensors.starts).toBe(1);
    expect(sensors.continued).toEqual([]);
    expect(sensors.stops).toBe(0);
    await fresh.stopRecording();
    expect(sensors.stops).toBe(1);
    expect(fresh.getRecorderState().pending?.motion?.path).toBe(`capteurs/${startedAtMs}.imu`);
  });

  it('capture fermée avec l\'activité : relancée en complétant son fichier, rendue à l\'arrêt', async () => {
    const live = source();
    const setup = { placement: 'poitrine' as const, foil: true };
    await recorder.startRecording(activity, live, { motion: setup });
    run(live.emit, 0, 10, 1);
    await settle();
    const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
    // Rien ne tourne plus côté téléphone : le greffon a été refait avec l'activité.
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(sensors.continued).toEqual([{ startedAtMs, setup, append: true }]);
    expect(sensors.starts).toBe(1);
    expect(state.measuringMotion).toBe(true);
    expect(state.motionSetup).toEqual(setup);
    expect(state.error).toBeNull();
    await fresh.stopRecording();
    expect(fresh.getRecorderState().pending?.motion?.path).toBe(`capteurs/${startedAtMs}.imu`);
  });

  it('capture fermée et session en pause manuelle : relancée puis mise en pause', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await recorder.pauseRecording();
    const pausesBefore = sensors.pauses;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('paused');
    expect(sensors.continued).toHaveLength(1);
    expect(sensors.pauses).toBe(pausesBefore + 1);
    expect(fresh.getRecorderState().measuringMotion).toBe(true);
  });

  it.each([
    [true, false],
    [false, true],
  ])('capture relancée puis arrêtée sans mesure depuis, fichier qui en gardait d\'avant : %s ; averti : %s', async (earlierMeasures, warned) => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await recorder.pauseRecording();
    const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('paused');
    // Relancée puis mise en pause aussitôt : rien de mesuré depuis la relance.
    sensors.stopped = { samples: 0, earlierMeasures };
    await fresh.stopRecording();
    const state = fresh.getRecorderState();
    expect(state.pending?.motion?.path).toBe(`capteurs/${startedAtMs}.imu`);
    expect((state.error ?? '').includes('aucune mesure reçue')).toBe(warned);
  });

  it('capture qui ne repart pas : c\'est dit, la reprise continue', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await settle();
    const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
    sensors.found = { path: `capteurs/${startedAtMs}.imu`, bytes: 10, durationS: 0, samples: 0, longestGapS: 0, error: null };
    sensors.continueFails = true;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.measuringMotion).toBe(false);
    expect(state.error).toContain('la mesure ne reprend pas');
    await fresh.stopRecording();
    expect(fresh.getRecorderState().pending?.motion?.path).toBe(`capteurs/${startedAtMs}.imu`);
  });

  it('journal d\'avant, sans les réglages de la capture : rien n\'est relancé', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await settle();
    withoutMotionInHeader();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('recording');
    expect(sensors.continued).toEqual([]);
    expect(fresh.getRecorderState().measuringMotion).toBe(false);
  });

  it('capture et pause manuelle : un ordre perdu avec la page est rattrapé', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { motion: { placement: 'poitrine', foil: false } });
    run(live.emit, 0, 10, 1);
    await recorder.pauseRecording();
    const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
    const pausesBefore = sensors.pauses;
    sensors.running = { path: `capteurs/${startedAtMs}.imu`, listening: true, setup: { placement: 'poitrine', foil: false } };
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('paused');
    expect(sensors.pauses).toBe(pausesBefore + 1);
  });

  it('ceinture tenue par le téléphone : reprise sans nouvelle connexion, FC jointe de nouveau', async () => {
    const live = source();
    await recorder.startRecording(activity, live, { heartRate: { address: 'a', name: 'b' } });
    run(live.emit, 0, 10, 1);
    await settle();
    const holds = belt.holds;
    belt.adoptable = true;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(belt.adoptions).toBe(1);
    expect(belt.holds).toBe(holds);
    expect(fresh.getRecorderState().heartRate).not.toBeNull();
  });

  it('le repère et l\'activité changée en route suivent la session', async () => {
    const live = source();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 5, 1);
    expect(recorder.addRecordingMark()).not.toBeNull();
    recorder.changeRecordingActivity(baseActivity('kite'));
    await settle();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.activity?.base).toBe('kite');
    expect(state.marks).toHaveLength(1);
  });

  it('veille du GPS : le minuteur repart de la reprise', async () => {
    const live = source();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await settle();
    gpsTimer.arms = [];
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(gpsTimer.arms).toEqual([60_000]);
  });
});

describe('reprise silencieuse : refus du service', () => {
  it('dit à l\'écran comme pour une source démarrée, effacé à la position suivante', async () => {
    const live = fakeSource();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await settle();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    gpsService.onError!('Localisation coupée');
    expect(fresh.getRecorderState().error).toBe('Localisation coupée');
    expect(fresh.getRecorderState().status).toBe('recording');
    gpsService.onFix!(fixAt(11));
    expect(fresh.getRecorderState().error).toBeNull();
  });
});

describe('commandes pendant le `starting` d\'une reprise silencieuse', () => {
  /** Une chute en plein enregistrement ; la reprise s'arrête en `starting`, jusqu'à `open`. */
  const resumingHeld = async () => {
    const live = fakeSource();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 10, 1);
    await settle();
    services.gps = true;
    let open!: () => void;
    sensors.gate = new Promise((resolve) => {
      open = resolve;
    });
    const fresh = await reload();
    const recovered = fresh.recoverInterruptedRecording();
    for (let i = 0; i < 20 && fresh.getRecorderState().status !== 'starting'; i++) await settle();
    expect(fresh.getRecorderState().status).toBe('starting');
    expect(gpsService.adoptions).toBe(0);
    return { fresh, recovered, open };
  };

  it('« Arrêter » attend la fin de la reprise, puis arrête : session gardée, service arrêté une fois, rien de doublé', async () => {
    const { fresh, recovered, open } = await resumingHeld();
    const stop = fresh.stopRecording();
    await settle();
    expect(fresh.getRecorderState().status).toBe('starting');
    expect(lineCount('stop')).toBe(0);
    open();
    await Promise.all([recovered, stop]);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(state.pending?.pointCount).toBe(11);
    expect(state.pending?.recovered).toBe(false);
    expect(gpsService.adoptions).toBe(1);
    expect(gpsService.stops).toBe(1);
    expect(gpsService.orphanStops).toBe(0);
    expect(headerCount()).toBe(1);
    expect(journal.writes).toBe(1);
    expect(lineCount('stop')).toBe(1);
    expect(lineCount('break')).toBe(0);
  });

  it('une pause, une reprise ou la bascule sont refusées sans dégât : la session reprend, en enregistrement', async () => {
    const { fresh, recovered, open } = await resumingHeld();
    await Promise.all([fresh.pauseRecording(), fresh.resumeRecording(), fresh.togglePauseRecording()]);
    expect(lineCount('pause')).toBe(0);
    expect(lineCount('resume')).toBe(0);
    open();
    await recovered;
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.pausedReason).toBeNull();
    gpsService.onFix!(fixAt(11));
    await settle();
    expect(fresh.getRecorderState().stats.pointCount).toBe(12);
    expect(headerCount()).toBe(1);
    expect(lineCount('break')).toBe(1);
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(11_000);
  });

  it('un départ pendant la reprise est ignoré : ni en-tête, ni source neuve', async () => {
    const { fresh, recovered, open } = await resumingHeld();
    const other = fakeSource();
    await fresh.startRecording(activity, other);
    open();
    await recovered;
    expect(other.starts).toBe(0);
    expect(journal.writes).toBe(1);
    expect(fresh.getRecorderState().status).toBe('recording');
  });

  it('un « Arrêter » pendant une reprise qui échoue : session en attente, service arrêté, journal intact', async () => {
    const { fresh, recovered, open } = await resumingHeld();
    const text = journal.text;
    gpsService.adoptFails = true;
    const stop = fresh.stopRecording();
    open();
    await Promise.all([recovered, stop]);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(state.pending?.pointCount).toBe(11);
    expect(gpsService.orphanStops).toBe(1);
    expect(journal.text).toBe(text);
  });

  it('commandes de nouveau libres après la reprise', async () => {
    const { fresh, recovered, open } = await resumingHeld();
    open();
    await recovered;
    await fresh.pauseRecording();
    expect(fresh.getRecorderState().status).toBe('paused');
    expect(lineCount('pause')).toBe(1);
  });
});

describe('« Continuer l\'enregistrement », application tuée puis rouverte', () => {
  /** Enregistre jusqu'à 20 s, puis l'application est tuée : plus aucun service. */
  const killedAt20 = async (hz: number) => {
    const live = fakeSource();
    await recorder.startRecording(activity, live);
    run(live.emit, 0, 20, hz);
    await settle();
  };

  it('proposé à moins de 10 min de la dernière ligne, plus au-delà', async () => {
    await killedAt20(1);
    vi.setSystemTime(T0 + 20_000 + 599_000);
    let fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().pending?.canContinue).toBe(true);
    expect(fresh.getRecorderState().pending?.recovered).toBe(true);
    expect(fresh.getRecorderState().landOnRecording).toBe(true);

    vi.setSystemTime(T0 + 20_000 + 601_000);
    fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().pending?.canContinue).toBe(false);
    expect(fresh.getRecorderState().landOnRecording).toBe(false);
  });

  it.each([[1], [5]])('même journal, segment neuf, source relancée par le geste, durée sans saut, à %i Hz', async (hz) => {
    await killedAt20(hz);
    vi.setSystemTime(T0 + 200_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    fresh.acknowledgeRecordingLanding();
    const next = fakeSource();
    await fresh.continuePendingSession(next);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.pending).toBeNull();
    expect(state.landOnRecording).toBe(false);
    expect(next.starts).toBe(1);
    expect(gpsService.adoptions).toBe(0);
    run(next.emit, 201, 210, hz);
    await settle();
    expect(headerCount()).toBe(1);
    expect(journal.writes).toBe(1);
    expect(lineCount('break')).toBe(1);
    // 20 s, puis 9 s : les 3 min hors de l'application ne comptent pas.
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(29_000);
    await fresh.stopRecording();
    expect(fresh.getRecorderState().pending?.pointCount).toBe(20 * hz + 1 + 9 * hz + 1);
    expect((fresh.getRecorderState().pending?.content.match(/<trkseg>/g) ?? []).length).toBe(2);
  });

  it('une chute après « Continuer » : la durée reste juste', async () => {
    await killedAt20(1);
    vi.setSystemTime(T0 + 200_000);
    let fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const next = fakeSource();
    await fresh.continuePendingSession(next);
    run(next.emit, 201, 210, 1);
    await settle();
    services.gps = true;
    fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(29_000);
  });

  it('la source ne démarre pas : session toujours en attente, journal gardé', async () => {
    await killedAt20(1);
    vi.setSystemTime(T0 + 60_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const failing: LocationSource = {
      label: 'Refus',
      start: async () => {
        throw new Error('localisation refusée');
      },
    };
    await fresh.continuePendingSession(failing);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(state.pending?.canContinue).toBe(true);
    expect(state.error).toContain('localisation refusée');
    expect(parseJournal(journal.text!).fixes).toHaveLength(21);
    expect(headerCount()).toBe(1);
  });

  describe('capture des capteurs', () => {
    const setup = { placement: 'taille' as const, foil: true };

    /** Enregistre jusqu'à 20 s, capture prise au départ, puis l'application est tuée : son fichier reste sur le téléphone. */
    const killedWithCapture = async (motion: typeof setup | null = setup) => {
      const live = fakeSource();
      await recorder.startRecording(activity, live, { motion });
      run(live.emit, 0, 20, 1);
      await settle();
      const startedAtMs = parseJournal(journal.text!).header!.startedAtMs;
      const path = `capteurs/${startedAtMs}.imu`;
      if (motion) sensors.found = { path, bytes: 10, durationS: 0, samples: 0, longestGapS: 0, error: null };
      return { startedAtMs, path };
    };

    /** Rouverte à 60 s, « Continuer l'enregistrement ». */
    const continueAt60 = async () => {
      vi.setSystemTime(T0 + 60_000);
      const fresh = await reload();
      await fresh.recoverInterruptedRecording();
      const next = fakeSource();
      await fresh.continuePendingSession(next);
      return { fresh, next };
    };

    it('relancée en complétant son fichier : elle mesure de nouveau, et le même fichier est rendu à l\'arrêt', async () => {
      const { startedAtMs, path } = await killedWithCapture();
      const { fresh, next } = await continueAt60();
      const state = fresh.getRecorderState();
      expect(state.status).toBe('recording');
      expect(sensors.continued).toEqual([{ startedAtMs, setup, append: true }]);
      expect(sensors.starts).toBe(1);
      expect(state.measuringMotion).toBe(true);
      expect(state.motionSetup).toEqual(setup);
      expect(state.error ?? '').not.toContain('Capteurs');
      run(next.emit, 61, 65, 1);
      const stops = sensors.stops;
      await fresh.stopRecording();
      expect(sensors.stops).toBe(stops + 1);
      expect(sensors.starts).toBe(1);
      expect(fresh.getRecorderState().pending?.motion?.path).toBe(path);
      expect(fresh.getRecorderState().error ?? '').not.toContain('Capteurs');
    });

    it('journal d\'avant, sans ses réglages : elle ne reprend pas, c\'est dit, et le fichier d\'avant reste avec la session', async () => {
      const { path } = await killedWithCapture();
      withoutMotionInHeader();
      const { fresh, next } = await continueAt60();
      expect(sensors.continued).toEqual([]);
      expect(fresh.getRecorderState().status).toBe('recording');
      expect(fresh.getRecorderState().measuringMotion).toBe(false);
      expect(fresh.getRecorderState().error).toContain('Capteurs : la mesure ne reprend pas');
      run(next.emit, 61, 65, 1);
      await fresh.stopRecording();
      expect(sensors.starts).toBe(1);
      expect(fresh.getRecorderState().pending?.motion?.path).toBe(path);
    });

    it('relance refusée : c\'est dit, l\'enregistrement continue, le fichier d\'avant reste avec la session', async () => {
      const { path } = await killedWithCapture();
      sensors.continueFails = true;
      const { fresh, next } = await continueAt60();
      const state = fresh.getRecorderState();
      expect(state.status).toBe('recording');
      expect(state.measuringMotion).toBe(false);
      expect(state.error).toContain('Capteurs : la mesure ne reprend pas');
      run(next.emit, 61, 65, 1);
      await fresh.stopRecording();
      expect(fresh.getRecorderState().pending?.motion?.path).toBe(path);
    });

    it('relance refusée sans fichier d\'avant : dit comme au départ, sans parler de mesures gardées', async () => {
      await killedWithCapture();
      sensors.found = null;
      sensors.continueFails = true;
      const { fresh } = await continueAt60();
      expect(fresh.getRecorderState().status).toBe('recording');
      expect(fresh.getRecorderState().error).toContain('Mesure des capteurs impossible');
      expect(fresh.getRecorderState().error).not.toContain('gardé');
    });

    it('départ sans capture : rien n\'est relancé ni dit', async () => {
      await killedWithCapture(null);
      const { fresh } = await continueAt60();
      expect(sensors.continued).toEqual([]);
      expect(fresh.getRecorderState().measuringMotion).toBe(false);
      expect(fresh.getRecorderState().error ?? '').not.toContain('Capteurs');
    });
  });

  it('rangement seul à la réouverture : la session reprise trop vieille pour continuer est rangée, la fraîche attend', async () => {
    await killedAt20(1);
    vi.setSystemTime(T0 + 60_000);
    let fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().pending?.canContinue).toBe(true);
    expect(fresh.finishingPendingSession(fresh.getRecorderState())).toBe(false);
    expect(await fresh.finishPendingSession()).toBeNull();
    expect(fresh.getRecorderState().pending).not.toBeNull();
    expect(journal.text).not.toBeNull();

    vi.setSystemTime(T0 + 3_600_000);
    fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().pending?.canContinue).toBe(false);
    expect(fresh.finishingPendingSession(fresh.getRecorderState())).toBe(true);
    const saved = await fresh.finishPendingSession();
    expect(saved?.libraryFile).toBe('rangee.gpx');
    expect(saved?.recovered).toBe(true);
    expect(fresh.getRecorderState().pending).toBeNull();
    expect(journal.text).toBeNull();
  });

  it('sans offre : le bouton ne fait rien', async () => {
    await killedAt20(1);
    vi.setSystemTime(T0 + 3_600_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const next = fakeSource();
    await fresh.continuePendingSession(next);
    expect(next.starts).toBe(0);
    expect(fresh.getRecorderState().pending).not.toBeNull();
  });
});

describe('ceinture cardio après une coupure', () => {
  /** Ceinture cochée sur la page Enregistrer, au départ ; le réglage de l'activité reste à son défaut, sans ceinture. */
  const strap = { address: 'AA:BB:CC:DD:EE:FF', name: 'Polar H10' };

  /** Enregistre jusqu'à 20 s, ceinture prise au départ ; `options` comme la page les passe. */
  const recordUntil20 = async (options: { heartRate?: { address: string; name: string } } = { heartRate: strap }) => {
    const live = fakeSource();
    await recorder.startRecording(activity, live, options);
    run(live.emit, 0, 20, 1);
    await settle();
  };

  /** L'application est tuée, rouverte à 60 s, et « Continuer l'enregistrement » est touché. */
  const killThenContinue = async () => {
    vi.setSystemTime(T0 + 60_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const next = fakeSource();
    await fresh.continuePendingSession(next);
    return { fresh, next };
  };

  it('« Continuer » redemande la ceinture du départ, réglage de l\'activité à faux : tuile BPM et veille armée', async () => {
    belt.saved = { address: 'autre', name: 'Montre' };
    await recordUntil20();
    expect(belt.asked).toEqual([strap.address]);
    const { fresh } = await killThenContinue();
    expect(belt.asked).toEqual([strap.address, strap.address]);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.heartRate).not.toBeNull();
    belt.emit(Date.now(), 120);
    expect(beltTimer.arms).toHaveLength(1);
  });

  it('« Continuer » avec une ceinture qui ne répond pas : l\'enregistrement continue, et c\'est dit', async () => {
    await recordUntil20();
    belt.holdFails = true;
    const { fresh, next } = await killThenContinue();
    expect(belt.asked).toEqual([strap.address, strap.address]);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.heartRate).toBeNull();
    expect(state.error).toContain('Ceinture cardio injoignable');
    run(next.emit, 61, 65, 1);
    await settle();
    await fresh.stopRecording();
    expect(fresh.getRecorderState().pending?.pointCount).toBe(26);
  });

  it('« Continuer » sans ceinture au départ : rien n\'est demandé, même réglage de l\'activité à vrai', async () => {
    memory.set(STORAGE_KEYS.sportSettings, JSON.stringify({ heartRate: { [activity.id]: true } }));
    belt.saved = strap;
    await recordUntil20({});
    const { fresh } = await killThenContinue();
    expect(belt.asked).toEqual([]);
    expect(fresh.getRecorderState().heartRate).toBeNull();
  });

  /** Le journal tel qu'une version d'avant l'écrivait : sans ceinture dans l'en-tête. */
  const toOldJournal = () => {
    journal.text = journal.text!.replace(/,"belt":null/, '');
    expect(parseJournal(journal.text).header).not.toHaveProperty('belt');
  };

  it('journal d\'avant, réglage de l\'activité à faux : « Continuer » ne demande rien, comme avant', async () => {
    await recordUntil20({});
    toOldJournal();
    belt.saved = strap;
    await killThenContinue();
    expect(belt.asked).toEqual([]);
  });

  it('journal d\'avant, réglage de l\'activité à vrai : « Continuer » prend la ceinture retenue, comme avant', async () => {
    await recordUntil20({});
    toOldJournal();
    memory.set(STORAGE_KEYS.sportSettings, JSON.stringify({ heartRate: { [activity.id]: true } }));
    belt.saved = strap;
    const { fresh } = await killThenContinue();
    expect(belt.asked).toEqual([strap.address]);
    expect(fresh.getRecorderState().heartRate).not.toBeNull();
  });

  it('reprise seule, aucune liaison à reprendre : la ceinture de l\'en-tête est redemandée', async () => {
    await recordUntil20();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(belt.adoptions).toBe(0);
    expect(belt.asked).toEqual([strap.address, strap.address]);
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(state.heartRate).not.toBeNull();
    belt.emit(Date.now(), 120);
    expect(beltTimer.arms).toHaveLength(1);
  });

  /** Pause manuelle à 20 s, puis chute du moteur, service vivant : la session reprend seule, en pause. */
  const pausedThenCrash = async () => {
    await recordUntil20();
    await recorder.pauseRecording();
    await settle();
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('paused');
    beltTimer.arms = [];
    return fresh;
  };

  it('reprise seule en pause manuelle, ceinture redemandée : pas de veille pendant la pause, elle repart à la première mesure après', async () => {
    const fresh = await pausedThenCrash();
    expect(belt.asked).toEqual([strap.address, strap.address]);
    belt.emit(Date.now(), 120);
    expect(beltTimer.arms).toEqual([]);
    vi.setSystemTime(T0 + 30_000);
    await fresh.resumeRecording();
    expect(beltTimer.arms).toEqual([]);
    belt.emit(Date.now(), 120);
    expect(beltTimer.arms).toHaveLength(1);
  });

  it('reprise seule en pause manuelle, ceinture reprise : en pause aussi, minuteur réarmé à la reprise', async () => {
    belt.adoptable = true;
    const fresh = await pausedThenCrash();
    expect(belt.asked).toEqual([strap.address]);
    belt.emit(Date.now(), 120);
    expect(beltTimer.arms).toEqual([]);
    vi.setSystemTime(T0 + 30_000);
    await fresh.resumeRecording();
    expect(beltTimer.arms).toHaveLength(1);
  });

  it('reprise seule, liaison à reprendre : aucune demande de plus', async () => {
    await recordUntil20();
    belt.adoptable = true;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(belt.adoptions).toBe(1);
    expect(belt.asked).toEqual([strap.address]);
    expect(fresh.getRecorderState().heartRate).not.toBeNull();
  });

  it('reprise seule, la ceinture ne répond pas : la reprise aboutit, et c\'est dit', async () => {
    await recordUntil20();
    belt.holdFails = true;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(gpsService.adoptions).toBe(1);
    expect(state.pending).toBeNull();
    expect(state.heartRate).toBeNull();
    expect(state.error).toContain('Ceinture cardio injoignable');
  });

  it('reprise seule, journal d\'avant : aucune demande, comme avant', async () => {
    await recordUntil20({});
    toOldJournal();
    memory.set(STORAGE_KEYS.sportSettings, JSON.stringify({ heartRate: { [activity.id]: true } }));
    belt.saved = strap;
    services.gps = true;
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('recording');
    expect(belt.asked).toEqual([]);
  });

  it('« Arrêter de chercher » en route : la reprise seule ne la redemande pas, « Continuer » si, puis la reprise suivante aussi', async () => {
    await recordUntil20();
    recorder.stopRecordingBeltSearch();
    await settle();
    services.gps = true;
    let fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('recording');
    expect(belt.asked).toEqual([strap.address]);

    services.gps = false;
    const { next } = await killThenContinue();
    expect(belt.asked).toEqual([strap.address, strap.address]);
    run(next.emit, 61, 70, 1);
    await settle();
    services.gps = true;
    fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().status).toBe('recording');
    expect(belt.asked).toEqual([strap.address, strap.address, strap.address]);
  });

  describe('ceinture qui mesurait avant la coupure et ne revient pas', () => {
    /** Enregistre jusqu'à 20 s, ceinture prise au départ et qui mesure : sa FC est jointe aux positions du journal. */
    const recordWithHeartRateUntil20 = async () => {
      const live = fakeSource();
      await recorder.startRecording(activity, live, { heartRate: strap });
      run((s) => {
        belt.emit(Date.now(), 120);
        live.emit(s);
      }, 0, 20, 1);
      await settle();
      expect(parseJournal(journal.text!).fixes.every((fix) => fix.heartRateBpm === 120)).toBe(true);
      beltTimer.arms = [];
    };

    /** Échéance du minuteur natif de la ceinture à `atMs`, telle que la page la reçoit. */
    const beltTimerFiresAt = (atMs: number) => {
      vi.setSystemTime(atMs);
      beltTimer.onLost?.();
    };

    /** Reprise à `atMs`, par « Continuer » (application tuée) ou seule (service vivant). */
    const resumeAt = async (how: 'continuer' | 'seule', atMs: number) => {
      vi.setSystemTime(atMs);
      services.gps = how === 'seule';
      const fresh = await reload();
      await fresh.recoverInterruptedRecording();
      if (how === 'continuer') await fresh.continuePendingSession(fakeSource());
      expect(fresh.getRecorderState().status).toBe('recording');
      return fresh;
    };

    it.each([['continuer' as const], ['seule' as const]])('reprise %s : FC perdue au bout d\'une minute, pas avant, et l\'enregistrement continue', async (how) => {
      await recordWithHeartRateUntil20();
      const fresh = await resumeAt(how, T0 + 60_000);
      expect(belt.asked).toEqual([strap.address, strap.address]);
      expect(beltTimer.arms).toEqual([60_000]);
      beltTimerFiresAt(T0 + 119_000);
      expect(fresh.getRecorderState().beltLost).toBe(false);
      beltTimerFiresAt(T0 + 120_000);
      const state = fresh.getRecorderState();
      expect(state.beltLost).toBe(true);
      expect(state.error).toContain(fresh.BELT_LOST_ERROR);
      expect(state.status).toBe('recording');
    });

    it.each([['continuer' as const], ['seule' as const]])('reprise %s sans FC dans le journal : aucune alerte, comme une ceinture jamais jointe', async (how) => {
      await recordUntil20();
      beltTimer.arms = [];
      const fresh = await resumeAt(how, T0 + 60_000);
      expect(belt.asked).toEqual([strap.address, strap.address]);
      expect(beltTimer.arms).toEqual([]);
      beltTimerFiresAt(T0 + 600_000);
      expect(fresh.getRecorderState().beltLost).toBe(false);
    });

    it.each([['continuer' as const], ['seule' as const]])('reprise %s, la ceinture revient avant le délai : aucune alerte', async (how) => {
      await recordWithHeartRateUntil20();
      const fresh = await resumeAt(how, T0 + 60_000);
      vi.setSystemTime(T0 + 100_000);
      belt.emit(Date.now(), 118);
      expect(beltTimer.arms).toEqual([60_000, 60_000]);
      beltTimerFiresAt(T0 + 120_000);
      expect(fresh.getRecorderState().beltLost).toBe(false);
      expect(fresh.getRecorderState().error ?? '').not.toContain(fresh.BELT_LOST_ERROR);
    });

    it('reprise seule en pause manuelle : rien pendant la pause, la veille repart à la reprise', async () => {
      await recordWithHeartRateUntil20();
      await recorder.pauseRecording();
      await settle();
      vi.setSystemTime(T0 + 60_000);
      services.gps = true;
      const fresh = await reload();
      await fresh.recoverInterruptedRecording();
      expect(fresh.getRecorderState().status).toBe('paused');
      expect(belt.asked).toEqual([strap.address, strap.address]);
      expect(beltTimer.arms).toEqual([]);
      beltTimerFiresAt(T0 + 600_000);
      expect(fresh.getRecorderState().beltLost).toBe(false);
      await fresh.resumeRecording();
      expect(beltTimer.arms).toEqual([60_000]);
      beltTimerFiresAt(T0 + 660_000);
      expect(fresh.getRecorderState().beltLost).toBe(true);
    });

    it('« Arrêter de chercher » avant la coupure : « Continuer » la redemande, sans la veiller avant sa première mesure', async () => {
      await recordWithHeartRateUntil20();
      recorder.stopRecordingBeltSearch();
      await settle();
      const fresh = await resumeAt('continuer', T0 + 60_000);
      expect(belt.asked).toEqual([strap.address, strap.address]);
      expect(beltTimer.arms).toEqual([]);
      beltTimerFiresAt(T0 + 600_000);
      expect(fresh.getRecorderState().beltLost).toBe(false);
    });
  });
});

describe.each([[1], [5]])('journal du service : ce que la page n\'a pas reçu est rattrapé, à %i Hz', (hz) => {
  /** Enregistre de 0 à `toS`, journal de la page à jour ; le service, lui, continue d'écrire seul ensuite. */
  const recordUntil = async (toS: number) => {
    const source = serviceSource();
    await recorder.startRecording(activity, source);
    run(source.emit, 0, toS, hz);
    await settle();
    // Un départ efface le journal du service laissé par la session d'avant : les relevés repartent d'ici.
    gpsService.logClears = 0;
    gpsService.logReads = [];
    return source;
  };

  /** Lignes de position écrites au journal de la page, doublons compris. */
  const journalFixLines = (): number => (journal.text ?? '').split('\n').filter((l) => /^\[\d/.test(l)).length;

  const uncutStats = (toS: number): RecordingStats => {
    let stats: RecordingStats = EMPTY_RECORDING_STATS;
    for (let k = 0; k <= Math.round(toS * hz); k++) stats = addFixToStats(stats, fixAt(k / hz));
    return stats;
  };

  const liveTimes = (page: typeof recorder): number[] => page.getLiveFixes().map((f) => f.timeMs);
  const strictlyIncreasing = (times: number[]): boolean => times.every((ms, i) => i === 0 || ms > times[i - 1]);

  it('reprise silencieuse après 20 s sans la page : aucune position perdue ni doublée, aucune frontière', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 40, hz));
    services.gps = true;
    vi.setSystemTime(T0 + 40_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();

    const state = fresh.getRecorderState();
    expect(state.status).toBe('recording');
    expect(gpsService.adoptions).toBe(1);
    // Demandé après la dernière position du journal de la page, puis après la dernière rattrapée.
    expect(gpsService.logReads).toEqual([T0 + 20_000, T0 + 40_000]);
    expect(state.stats).toEqual(uncutStats(40));
    expect(fresh.getLiveSegmentCount()).toBe(1);
    expect(parseJournal(journal.text!).fixes).toHaveLength(40 * hz + 1);
    // Les positions rattrapées ne portent pas de fréquence cardiaque.
    expect(fresh.getLiveFixes().every((f) => f.heartRateBpm === undefined)).toBe(true);

    // Redélivrance écartée, puis la suite en direct : toujours un seul segment.
    gpsService.onFix!(fixAt(40));
    run((s) => gpsService.onFix!(fixAt(s)), 40 + 1 / hz, 50, hz);
    await settle();
    expect(fresh.getRecorderState().stats).toEqual(uncutStats(50));
    expect(lineCount('break')).toBe(0);
    expect(headerCount()).toBe(1);
    expect(journal.writes).toBe(1);
    expect(strictlyIncreasing(liveTimes(fresh))).toBe(true);
    // Le journal du service n'est effacé qu'une fois la session rangée.
    expect(gpsService.logClears).toBe(0);
  });

  it('une position arrivée pendant la lecture du journal du service : ni perdue ni doublée', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 30, hz));
    // La page écoute déjà (seconde lecture) : une position écrite juste avant que le service lise son fichier, donc
    // dans le texte rendu et dans le tampon ; une autre juste après, dans le tampon seul.
    gpsService.beforeLogRead = () => {
      if (!gpsService.onFix) return;
      gpsService.beforeLogRead = null;
      gpsService.log += nativeFix(31);
      gpsService.onFix(fixAt(31));
    };
    gpsService.afterLogRead = () => {
      if (!gpsService.onFix) return;
      gpsService.afterLogRead = null;
      gpsService.log += nativeFix(32);
      gpsService.onFix(fixAt(32));
    };
    services.gps = true;
    vi.setSystemTime(T0 + 32_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();

    const times = liveTimes(fresh);
    expect(times).toHaveLength(30 * hz + 1 + 2);
    expect(strictlyIncreasing(times)).toBe(true);
    expect(times.slice(-2)).toEqual([T0 + 31_000, T0 + 32_000]);
    expect(fresh.getLiveSegmentCount()).toBe(1);
    expect(fresh.getRecorderState().stats.pointCount).toBe(30 * hz + 3);
    run((s) => gpsService.onFix!(fixAt(s)), 33, 40, hz);
    await settle();
    expect(liveTimes(fresh)).toHaveLength(30 * hz + 3 + 7 * hz + 1);
    // Au journal de la page aussi : chaque position une seule fois, les deux de la relecture comprises.
    const written = parseJournal(journal.text!).fixes;
    expect(written.length).toBeGreaterThanOrEqual(30 * hz + 3);
    expect(journalFixLines()).toBe(written.length);
    expect(lineCount('break')).toBe(0);
  });

  it('pause manuelle ouverte, page absente : rien de gardé, toujours en pause, la suite repart dans un segment neuf', async () => {
    const source = await recordUntil(20);
    vi.setSystemTime(T0 + 20_500);
    await recorder.pauseRecording();
    gpsService.log = nativeLog(nativeFixes(0, 20, hz), `["pause",${T0 + 20_500}]\n`, nativeFixes(21, 40, hz));
    services.gps = true;
    services.paused = true;
    vi.setSystemTime(T0 + 40_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(source.starts).toBe(1);

    const state = fresh.getRecorderState();
    expect(state.status).toBe('paused');
    expect(state.pausedReason).toBe('manual');
    expect(state.stats.pointCount).toBe(20 * hz + 1);
    expect(displayedDurationMs(state.stats, state.pauseClock, T0 + 300_000)).toBe(20_000);
    // Une position de la pause, redonnée par le service, reste écartée : la carte ne recule pas.
    gpsService.onFix!(fixAt(40));
    expect(fresh.getLivePosition()?.timeMs).toBe(T0 + 20_000);
    gpsService.onFix!(fixAt(41));
    expect(fresh.getLivePosition()?.timeMs).toBe(T0 + 41_000);

    vi.setSystemTime(T0 + 45_000);
    await fresh.resumeRecording();
    run((s) => gpsService.onFix!(fixAt(s)), 46, 50, hz);
    await settle();
    expect(fresh.getRecorderState().stats.pointCount).toBe(20 * hz + 1 + 4 * hz + 1);
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(24_000);
    expect(lineCount('break')).toBe(1);
  });

  it('service mort avec l\'application, puis « Continuer » : la trace va jusqu\'à sa dernière position, la suite dans un segment neuf', async () => {
    await recordUntil(20);
    // Le service a écrit seul jusqu'à 35 s, puis le processus a été tué.
    gpsService.log = nativeLog(nativeFixes(0, 35, hz));
    vi.setSystemTime(T0 + 100_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const pending = fresh.getRecorderState().pending!;
    expect(pending.pointCount).toBe(35 * hz + 1);
    expect((pending.content.match(/<trkseg>/g) ?? []).length).toBe(1);
    expect(pending.canContinue).toBe(true);
    expect(gpsService.orphanStops).toBe(1);
    expect(parseJournal(journal.text!).fixes).toHaveLength(35 * hz + 1);

    const next = serviceSource();
    await fresh.continuePendingSession(next);
    expect(fresh.getRecorderState().status).toBe('recording');
    expect(next.starts).toBe(1);
    // La levée de la pause posée par « Continuer » est dite au service, à l'heure de sa ligne.
    expect(next.pauses).toEqual([{ paused: false, atMs: T0 + 100_000 }]);
    expect(lastLineAt('resume')).toBe(T0 + 100_000);
    run(next.emit, 101, 110, hz);
    await settle();
    // 35 s, puis 9 s : le temps hors de l'application ne compte pas.
    expect(displayedDurationMs(fresh.getRecorderState().stats, null, T0)).toBe(44_000);
    expect(lineCount('break')).toBe(1);
    expect(headerCount()).toBe(1);

    await fresh.stopRecording();
    const stopped = fresh.getRecorderState().pending!;
    expect(stopped.pointCount).toBe(35 * hz + 1 + 9 * hz + 1);
    expect((stopped.content.match(/<trkseg>/g) ?? []).length).toBe(2);
    expect(gpsService.logClears).toBe(0);
    await fresh.analyzePendingSession();
    expect(fresh.getRecorderState().saved).not.toBeNull();
    expect(gpsService.logClears).toBe(1);
  });

  it('« Continuer » depuis une pause manuelle, puis « Arrêter » aussitôt : les positions de la pause n\'entrent jamais dans la trace', async () => {
    await recordUntil(20);
    vi.setSystemTime(T0 + 20_500);
    await recorder.pauseRecording();
    gpsService.log = nativeLog(nativeFixes(0, 20, hz), `["pause",${T0 + 20_500}]\n`, nativeFixes(21, 30, hz));
    vi.setSystemTime(T0 + 100_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(fresh.getRecorderState().pending?.pointCount).toBe(20 * hz + 1);
    await fresh.continuePendingSession(serviceSource());
    vi.setSystemTime(T0 + 101_000);
    await fresh.stopRecording();
    expect(fresh.getRecorderState().pending?.pointCount).toBe(20 * hz + 1);
    expect(parseJournal(journal.text!).fixes).toHaveLength(20 * hz + 1);
  });

  it('arrêt par la garde, application fermée : session en attente sans « Continuer », trace entière jusqu\'à l\'arrêt, rangée seule', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 50, hz), `["stop",${T0 + 60_000},"still"]\n`);
    // Rouverte 5 s après : sans la ligne d'arrêt, « Continuer » serait proposé.
    vi.setSystemTime(T0 + 65_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(state.pending?.pointCount).toBe(50 * hz + 1);
    expect((state.pending?.content.match(/<trkseg>/g) ?? []).length).toBe(1);
    expect(state.pending?.canContinue).toBe(false);
    expect(gpsService.adoptions).toBe(0);
    expect(parseJournal(journal.text!).stoppedAtMs).toBe(T0 + 60_000);
    expect(fresh.finishingPendingSession(state)).toBe(true);
    expect(await fresh.finishPendingSession()).not.toBeNull();
    expect(journal.text).toBeNull();
    expect(gpsService.logClears).toBe(1);
  });

  it('garde passée pendant que la page revenait : pas de reprise, la session se range', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 30, hz), `["stop",${T0 + 31_000},"timeout"]\n`);
    // Le service s'est dit en route, puis sa garde l'a arrêté avant la relecture de son journal.
    services.gps = true;
    vi.setSystemTime(T0 + 32_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    const state = fresh.getRecorderState();
    expect(state.status).toBe('idle');
    expect(gpsService.adoptions).toBe(0);
    expect(state.pending?.pointCount).toBe(30 * hz + 1);
    expect(state.pending?.canContinue).toBe(false);
  });

  it('service en route pour une autre session : ni reprise ni rattrapage, il est arrêté', async () => {
    await recordUntil(20);
    gpsService.log = `{"format":"${FILE_FORMATS.positions}","version":1,"session":${T0 + 7}}\n${nativeFixes(0, 40, hz)}`;
    services.gps = true;
    services.session = T0 + 7;
    vi.setSystemTime(T0 + 40_000);
    const fresh = await reload();
    await fresh.recoverInterruptedRecording();
    expect(gpsService.adoptions).toBe(0);
    expect(gpsService.orphanStops).toBe(1);
    expect(fresh.getRecorderState().pending?.pointCount).toBe(20 * hz + 1);
    expect(fresh.getRecorderState().pending?.canContinue).toBe(true);
  });

  it('« Arrêter », messages calés écran éteint : ce que la page n\'a pas reçu entre dans le GPX, pas ce qui suit l\'arrêt', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 30, hz), nativeFix(45));
    vi.setSystemTime(T0 + 31_000);
    await recorder.stopRecording();
    const pending = recorder.getRecorderState().pending!;
    expect(pending.pointCount).toBe(30 * hz + 1);
    expect((pending.content.match(/<trkseg>/g) ?? []).length).toBe(1);
    expect(pending.recovered).toBe(false);
    const parsed = parseJournal(journal.text!);
    expect(parsed.fixes).toHaveLength(30 * hz + 1);
    expect(parsed.stoppedAtMs).toBe(T0 + 31_000);
    expect(lineCount('break')).toBe(0);
  });

  it('« Arrêter », page qui a tout reçu : rien n\'est relu du journal de la page ni ajouté', async () => {
    await recordUntil(20);
    gpsService.log = nativeLog(nativeFixes(0, 20, hz));
    vi.setSystemTime(T0 + 21_000);
    await recorder.stopRecording();
    const text = journal.text!;
    expect(recorder.getRecorderState().pending?.pointCount).toBe(20 * hz + 1);
    expect(gpsService.logReads).toEqual([T0 + 20_000]);
    expect(text.trimEnd().endsWith(`["stop",${T0 + 21_000}]`)).toBe(true);
  });

  it('pause manuelle et reprise : dites au service, chacune à l\'heure de sa ligne du journal', async () => {
    const source = await recordUntil(20);
    vi.setSystemTime(T0 + 20_500);
    await recorder.pauseRecording();
    expect(source.pauses).toEqual([{ paused: true, atMs: T0 + 20_500 }]);
    expect(lastLineAt('pause')).toBe(T0 + 20_500);
    vi.setSystemTime(T0 + 30_250);
    await recorder.resumeRecording();
    await settle();
    expect(source.pauses).toEqual([{ paused: true, atMs: T0 + 20_500 }, { paused: false, atMs: T0 + 30_250 }]);
    expect(lastLineAt('resume')).toBe(T0 + 30_250);
  });
});

describe('guidages rejoués en silence', () => {
  it('balises : celles déjà validées le restent, aucun son', async () => {
    const wing = baseActivity('wingfoil');
    const north = (m: number) => 43 + m / 111_000;
    const marks = [{ lat: north(0), lon: 3 }, { lat: north(600), lon: 3 }, { lat: north(1200), lon: 3 }];
    const { followedTraceFromPoints } = await import('../recording/followedTrace');
    const trace = await import('./useFollowedTrace');
    trace.followTrace(followedTraceFromPoints(marks, 'Parcours', 'route', wing.id, marks)!);
    const guide = await import('./useMarkGuide');
    guide.startMarkGuide();
    const along = (s: number): LocationFix => ({ timeMs: T0 + s * 1000, lat: north(s * 10), lon: 3, speedMs: 10, accuracyM: 4 });
    let send: ((fix: LocationFix) => void) | null = null;
    const live: LocationSource = {
      label: 'Simulée',
      start: async (_options, onFix) => {
        send = onFix;
        return async () => undefined;
      },
    };
    await recorder.startRecording(wing, live);
    run((s) => send?.(along(s)), 0, 70, 1);
    await settle();
    const before = guide.getMarkGuideView();
    expect(before.target).toBe(2);
    expect(sounds.validated).toBe(2);

    services.gps = true;
    const fresh = await reload();
    const freshGuide = await import('./useMarkGuide');
    freshGuide.startMarkGuide();
    await fresh.recoverInterruptedRecording();
    const after = freshGuide.getMarkGuideView();
    expect(after.active).toBe(true);
    expect(after.target).toBe(2);
    expect(after.outcomes).toEqual(['validated', 'validated']);
    expect(after.distanceM).toBeCloseTo(before.distanceM!, 3);
    expect(sounds.validated).toBe(2);

    // La suite en direct continue de là, et sonne.
    run((s) => gpsService.onFix!(along(s)), 71, 125, 1);
    expect(freshGuide.getMarkGuideView().finished).toBe(true);
    expect(sounds.finished).toBe(1);
  });
});
