import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputerLinkPort, ComputerLinkStatus } from '../platform/computerLink';
import { autoConnect } from './useComputerLink';

const fake = vi.hoisted(() => ({
  port: null as unknown as ComputerLinkPort,
  recording: false,
}));

vi.mock('../platform/computerLink', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../platform/computerLink')>()),
  computerLink: () => fake.port,
}));
vi.mock('../platform/memoryFolder', () => ({ deviceFolderLocation: () => null }));
vi.mock('../platform/permissions', () => ({ onAppResume: () => () => {} }));
vi.mock('./useRecorder', () => ({ isRecordingActive: () => fake.recording, useRecorderStatus: () => 'idle' }));
vi.mock('./useSessionLibrary', () => ({ useLibraryFields: () => ({ status: 'opening', folderKind: null }) }));

const STATUS: ComputerLinkStatus = {
  state: 'idle', error: null, paired: true, computerName: 'PC-SALON', address: '192.168.1.20:48217',
  lastSentMs: null, sentFiles: 0, onLocalNetwork: true,
};

const makePort = (status: ComputerLinkStatus) => {
  const calls: { method: string; options?: unknown }[] = [];
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
    onStatus: () => () => {},
  };
  return { port, calls };
};

beforeEach(() => {
  fake.recording = false;
});

describe('autoConnect : la liaison tentée toute seule', () => {
  it('ordinateur connu sur un réseau local : relie, avec le dossier mémoire', async () => {
    const { port, calls } = makePort(STATUS);
    fake.port = port;
    await autoConnect('content://arbre');
    expect(calls).toEqual([{ method: 'status' }, { method: 'connect', options: { folder: 'content://arbre' } }]);
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
