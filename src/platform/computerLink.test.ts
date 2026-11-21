import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComputerLinkRefused, computerLink, linkFolderOf, readComputerLinkStatus, refusalOf, type ComputerLinkStatus } from './computerLink';

type Listener = (status: unknown) => void;

const fake = vi.hoisted(() => {
  const state = {
    calls: [] as { method: string; options?: unknown }[],
    answer: {} as unknown,
    rejection: null as unknown,
    listeners: new Set<Listener>(),
    removed: 0,
  };
  const answer = async (method: string, options?: unknown): Promise<unknown> => {
    state.calls.push({ method, options });
    if (state.rejection !== null) throw state.rejection;
    return state.answer;
  };
  const plugin = {
    status: () => answer('status'),
    pair: (options: unknown) => answer('pair', options),
    connect: (options: unknown) => answer('connect', options),
    forget: () => answer('forget'),
    addListener: async (event: string, listener: Listener) => {
      state.calls.push({ method: `listen:${event}` });
      state.listeners.add(listener);
      return {
        remove: async () => {
          state.listeners.delete(listener);
          state.removed++;
        },
      };
    },
  };
  return { state, plugin };
});
const runtime = vi.hoisted(() => ({ native: true }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => fake.plugin }));
vi.mock('./runtime', () => ({ isNativeApp: () => runtime.native }));

/** L'état tel que le greffon le rend à la page. */
const RAW = {
  state: 'linked', error: null, paired: true, computerName: 'PC-SALON', address: '192.168.1.20:48217',
  lastSentMs: 1_700_000_000_000, sentFiles: 3, onLocalNetwork: true,
};

beforeEach(() => {
  runtime.native = true;
  fake.state.calls = [];
  fake.state.answer = RAW;
  fake.state.rejection = null;
  fake.state.listeners.clear();
  fake.state.removed = 0;
});

describe('computerLink : présence', () => {
  it('rend null hors du téléphone, le port sur le téléphone', () => {
    runtime.native = false;
    expect(computerLink()).toBeNull();
    runtime.native = true;
    expect(computerLink()).not.toBeNull();
  });
});

describe('readComputerLinkStatus : l\'état du greffon remis dans sa forme', () => {
  it('relit chaque champ', () => {
    expect(readComputerLinkStatus(RAW)).toEqual<ComputerLinkStatus>({
      state: 'linked', error: null, paired: true, computerName: 'PC-SALON', address: '192.168.1.20:48217',
      lastSentMs: 1_700_000_000_000, sentFiles: 3, onLocalNetwork: true,
    });
  });

  it('un état inconnu se lit au repos, une raison inconnue est une coupure', () => {
    expect(readComputerLinkStatus({ ...RAW, state: 'demain', error: 'inconnue' })).toMatchObject({ state: 'idle', error: 'network' });
    expect(readComputerLinkStatus({ paired: false, state: 'demain' })).toMatchObject({ state: 'unpaired', error: null });
  });

  it('les champs absents ou mal typés prennent leur valeur vide', () => {
    expect(readComputerLinkStatus(null)).toEqual<ComputerLinkStatus>({
      state: 'unpaired', error: null, paired: false, computerName: null, address: null, lastSentMs: null, sentFiles: 0, onLocalNetwork: false,
    });
    expect(readComputerLinkStatus({ ...RAW, computerName: '', address: 4, lastSentMs: 'hier', sentFiles: -2 })).toMatchObject({
      computerName: null, address: null, lastSentMs: null, sentFiles: 0,
    });
  });
});

describe('appels du greffon', () => {
  it('status rend l\'état relu', async () => {
    const status = await computerLink()!.status();
    expect(status.state).toBe('linked');
    expect(fake.state.calls).toEqual([{ method: 'status', options: undefined }]);
  });

  it('pair et connect ne passent que ce qui est donné : ni adresse vide, ni dossier absent, ni sous-dossier vide', async () => {
    const link = computerLink()!;
    await link.pair({ code: '123456', address: '', folder: null });
    await link.pair({ code: '123456', address: '192.168.1.20:48217', folder: 'content://arbre' });
    await link.connect({ folder: 'content://arbre' });
    await link.connect({ address: undefined, folder: null });
    await link.connect({ folder: 'content://arbre', base: '' });
    expect(fake.state.calls.map((c) => c.options)).toEqual([
      { code: '123456' },
      { code: '123456', address: '192.168.1.20:48217', folder: 'content://arbre' },
      { folder: 'content://arbre' },
      {},
      { folder: 'content://arbre' },
    ]);
  });

  it('le sous-dossier où est la mémoire accompagne le dossier, jamais seul', async () => {
    const link = computerLink()!;
    await link.pair({ code: '123456', folder: 'content://documents', base: 'Gtracker' });
    await link.connect({ folder: 'content://documents', base: 'Gtracker' });
    await link.connect({ folder: null, base: 'Gtracker' });
    expect(fake.state.calls.map((c) => c.options)).toEqual([
      { code: '123456', folder: 'content://documents', base: 'Gtracker' },
      { folder: 'content://documents', base: 'Gtracker' },
      {},
    ]);
  });

  it('forget rend l\'état', async () => {
    fake.state.answer = { ...RAW, state: 'unpaired', paired: false, computerName: null };
    expect(await computerLink()!.forget()).toMatchObject({ state: 'unpaired', paired: false });
  });

  it('un appel refusé comme mal formé devient ComputerLinkRefused, toute autre erreur passe telle quelle', async () => {
    fake.state.rejection = Object.assign(new Error('mal formé'), { code: 'BAD_CODE' });
    await expect(computerLink()!.pair({ code: '12', folder: null })).rejects.toMatchObject({ refusal: 'code' });
    fake.state.rejection = Object.assign(new Error('mal formé'), { code: 'BAD_ADDRESS' });
    await expect(computerLink()!.connect({ address: 'x', folder: null })).rejects.toBeInstanceOf(ComputerLinkRefused);
    const other = new Error('autre');
    fake.state.rejection = other;
    await expect(computerLink()!.status()).rejects.toBe(other);
  });

  it('refusalOf lit le code du greffon', () => {
    expect(refusalOf({ code: 'BAD_CODE' })).toBe('code');
    expect(refusalOf({ code: 'BAD_ADDRESS' })).toBe('address');
    expect(refusalOf({ code: 'UNKNOWN' })).toBeNull();
    expect(refusalOf(null)).toBeNull();
    expect(refusalOf('texte')).toBeNull();
  });
});

describe('événement status', () => {
  it('chaque événement rend l\'état relu, et le désabonnement retire l\'écoute', async () => {
    const seen: ComputerLinkStatus[] = [];
    const stop = computerLink()!.onStatus((status) => seen.push(status));
    await Promise.resolve();
    expect(fake.state.listeners.size).toBe(1);
    fake.state.listeners.forEach((l) => l({ ...RAW, state: 'searching', sentFiles: 0 }));
    expect(seen).toHaveLength(1);
    expect(seen[0].state).toBe('searching');
    stop();
    await Promise.resolve();
    expect(fake.state.listeners.size).toBe(0);
  });

  it('un désabonnement avant que l\'écoute soit posée la retire aussitôt posée', async () => {
    const stop = computerLink()!.onStatus(() => {});
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.state.removed).toBe(1);
    expect(fake.state.listeners.size).toBe(0);
  });
});

describe('linkFolderOf : le dossier que l\'ordinateur lira', () => {
  it('dossier mémoire désigné : son adresse, sans sous-dossier', () => {
    expect(linkFolderOf({ uri: 'content://arbre', base: '' })).toEqual({ state: 'ok', uri: 'content://arbre', base: '' });
  });

  it('aucun dossier : rien', () => {
    expect(linkFolderOf(null)).toEqual({ state: 'none' });
    expect(linkFolderOf({ uri: '', base: '' })).toEqual({ state: 'none' });
  });

  it('dossier qui contient Gtracker : son adresse et le sous-dossier, que le greffon lira', () => {
    expect(linkFolderOf({ uri: 'content://arbre', base: 'Gtracker' })).toEqual({ state: 'ok', uri: 'content://arbre', base: 'Gtracker' });
  });
});
