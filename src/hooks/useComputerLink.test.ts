import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputerLinkPort, ComputerLinkStatus } from '../platform/computerLink';
import type { ScreenOnReason } from '../platform/screen';
import { RELINK_INTERVAL_MS, autoConnect, holdScreenDuringExchange, keepLinking } from './useComputerLink';

const fake = vi.hoisted(() => ({
  port: null as unknown as ComputerLinkPort,
  recording: false,
  foreground: true,
  screen: [] as [boolean, ScreenOnReason][],
}));

vi.mock('../platform/computerLink', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/computerLink')>()),
  computerLink: () => fake.port,
}));
vi.mock('../platform/memoryFolder', () => ({ deviceFolderLocation: () => null }));
vi.mock('../platform/permissions', () => ({ onAppResume: () => () => {} }));
vi.mock('../platform/screen', () => ({
  isForeground: () => fake.foreground,
  keepScreenOn: (on: boolean, reason: ScreenOnReason) => { fake.screen.push([on, reason]); },
}));
vi.mock('./useRecorder', () => ({ isRecordingActive: () => fake.recording, useRecorderStatus: () => 'idle' }));
vi.mock('./useSessionLibrary', () => ({ useLibraryFields: () => ({ status: 'opening', folderKind: null }) }));

const STATUS: ComputerLinkStatus = {
  state: 'idle', error: null, paired: true, computerName: 'PC-SALON', address: '192.168.1.20:48217',
  lastSentMs: null, sentFiles: 0, onLocalNetwork: true, lastExchangeMs: null,
};

const makePort = (status: ComputerLinkStatus) => {
  const calls: { method: string; options?: unknown }[] = [];
  const listeners = new Set<(next: ComputerLinkStatus) => void>();
  const port: ComputerLinkPort = {
    status: async () => {
      calls.push({ method: 'status' });
      return status;
    },
    pair: async (options) => {
      calls.push({ method: 'pair', options });
      return status;
    },
    connect: async (options) => {
      calls.push({ method: 'connect', options });
      return status;
    },
    forget: async () => status,
    onStatus: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  const emit = (next: ComputerLinkStatus) => listeners.forEach((listener) => listener(next));
  return { port, calls, listeners, emit };
};

/** Dernier état demandé à l'écran pour la liaison, `null` si jamais demandé. */
const screenForLink = (): boolean | null => {
  const mine = fake.screen.filter(([, reason]) => reason === 'computerLink');
  return mine.length === 0 ? null : mine[mine.length - 1][0];
};

beforeEach(() => {
  fake.recording = false;
  fake.foreground = true;
  fake.screen = [];
});

describe('autoConnect : la liaison tentée toute seule', () => {
  it('ordinateur connu sur un réseau local : relie, avec le dossier mémoire', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    await autoConnect('content://arbre');
    expect(calls).toEqual([{ method: 'status' }, { method: 'connect', options: { folder: 'content://arbre', base: '' } }]);
  });

  it('mémoire dans un sous-dossier du dossier désigné : le sous-dossier part avec le dossier', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    await autoConnect('content://documents', 'Gtracker');
    expect(calls).toEqual([{ method: 'status' }, { method: 'connect', options: { folder: 'content://documents', base: 'Gtracker' } }]);
  });

  it('jamais pendant un enregistrement : le greffon n\'est même pas interrogé', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    fake.recording = true;
    await autoConnect('content://arbre');
    expect(calls).toEqual([]);
  });

  it('sans réseau local ou sans ordinateur connu : interroge, ne relie pas', async () => {
    for (const status of [{ ...STATUS, onLocalNetwork: false }, { ...STATUS, paired: false, state: 'unpaired' as const }]) {
      const { port, calls } = makePort(status);
      fake.port = port;
      await autoConnect('content://arbre');
      expect(calls.map((c) => c.method)).toEqual(['status']);
    }
  });

  it('hors du téléphone : rien', async () => {
    fake.port = null as unknown as ComputerLinkPort;
    await expect(autoConnect('content://arbre')).resolves.toBeUndefined();
  });

  it('une seule tentative à la fois : un second appel pendant le premier ne fait rien', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    await Promise.all([autoConnect('content://arbre'), autoConnect('content://arbre')]);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(1);
  });

  it('une panne du greffon ne remonte pas : elle se note en console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { port } = makePort(STATUS);
    fake.port = { ...port, connect: async () => { throw new Error('réseau coupé'); } };
    await expect(autoConnect('content://arbre')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('keepLinking : la liaison relancée tant que Gtracker est affiché', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Laisse passer `ms` puis les tentatives lancées, qui attendent le greffon. */
  const pass = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
  };

  it('tout de suite, puis toutes les 20 s au premier plan', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    const stop = keepLinking('content://arbre');
    await pass(0);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(1);
    await pass(RELINK_INTERVAL_MS);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(2);
    await pass(RELINK_INTERVAL_MS);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(3);
    stop();
    await pass(3 * RELINK_INTERVAL_MS);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(3);
  });

  it('pas de relance pendant un enregistrement : le greffon n\'est même pas interrogé', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    fake.recording = true;
    const stop = keepLinking('content://arbre');
    await pass(5 * RELINK_INTERVAL_MS);
    expect(calls).toEqual([]);
    stop();
  });

  it('pas de relance quand Gtracker n\'est plus à l\'écran', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    const stop = keepLinking('content://arbre');
    await pass(0);
    fake.foreground = false;
    await pass(5 * RELINK_INTERVAL_MS);
    expect(calls.filter((c) => c.method === 'connect')).toHaveLength(1);
    stop();
  });
});

describe('holdScreenDuringExchange : l\'écran allumé pendant un échange', () => {
  const T0 = Date.UTC(2026, 10, 22, 10, 0, 0);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('allumé à une demande de l\'ordinateur, rendu 30 s après la dernière', async () => {
    const { port, emit } = makePort(STATUS);
    const stop = holdScreenDuringExchange(port);
    await vi.advanceTimersByTimeAsync(0);
    expect(screenForLink()).toBe(false);
    emit({ ...STATUS, state: 'linked', lastExchangeMs: T0 });
    expect(screenForLink()).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    emit({ ...STATUS, state: 'linked', lastExchangeMs: T0 + 20_000 });
    await vi.advanceTimersByTimeAsync(29_000);
    expect(screenForLink()).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(screenForLink()).toBe(false);
    stop();
  });

  it('liaison fermée : rendu aussitôt ; seule la raison de la liaison est touchée', async () => {
    const { port, emit } = makePort(STATUS);
    const stop = holdScreenDuringExchange(port);
    emit({ ...STATUS, state: 'linked', lastExchangeMs: T0 });
    emit({ ...STATUS, state: 'idle', lastExchangeMs: T0 });
    expect(screenForLink()).toBe(false);
    expect(fake.screen.every(([, reason]) => reason === 'computerLink')).toBe(true);
    stop();
  });

  it('relié sans demande (greffon plus ancien) : l\'écran n\'est pas tenu', async () => {
    const { port, emit } = makePort(STATUS);
    const stop = holdScreenDuringExchange(port);
    emit({ ...STATUS, state: 'linked', lastExchangeMs: null });
    expect(screenForLink()).toBe(false);
    stop();
  });

  it('l\'arrêt rend l\'écran et retire l\'écoute', async () => {
    const { port, emit, listeners } = makePort(STATUS);
    const stop = holdScreenDuringExchange(port);
    emit({ ...STATUS, state: 'linked', lastExchangeMs: T0 });
    stop();
    expect(screenForLink()).toBe(false);
    expect(listeners.size).toBe(0);
  });
});
