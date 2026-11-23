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
    pairSearch: (options: unknown) => answer('pairSearch', options),
    pairOffer: (options: unknown) => answer('pairOffer', options),
    pairConfirm: (options: unknown) => answer('pairConfirm', options),
    pairFinish: (options: unknown) => answer('pairFinish', options),
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
  lastSentMs: 1_700_000_000_000, sentFiles: 3, onLocalNetwork: true, lastExchangeMs: 1_700_000_005_000,
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
      lastSentMs: 1_700_000_000_000, sentFiles: 3, onLocalNetwork: true, lastExchangeMs: 1_700_000_005_000,
    });
  });

  it('la dernière demande de l\'ordinateur est facultative : un greffon plus ancien ne la donne pas', () => {
    const { lastExchangeMs: _absent, ...older } = RAW;
    expect(readComputerLinkStatus(older)).toMatchObject({ state: 'linked', lastSentMs: 1_700_000_000_000, lastExchangeMs: null });
    expect(readComputerLinkStatus({ ...RAW, lastExchangeMs: 'hier' }).lastExchangeMs).toBeNull();
    expect(readComputerLinkStatus({ ...RAW, lastExchangeMs: null }).lastExchangeMs).toBeNull();
  });

  it('un état inconnu se lit au repos, une raison inconnue est une coupure', () => {
    expect(readComputerLinkStatus({ ...RAW, state: 'demain', error: 'inconnue' })).toMatchObject({ state: 'idle', error: 'network' });
    expect(readComputerLinkStatus({ paired: false, state: 'demain' })).toMatchObject({ state: 'unpaired', error: null });
  });

  it('les champs absents ou mal typés prennent leur valeur vide', () => {
    expect(readComputerLinkStatus(null)).toEqual<ComputerLinkStatus>({
      state: 'unpaired', error: null, paired: false, computerName: null, address: null, lastSentMs: null, sentFiles: 0, onLocalNetwork: false,
      lastExchangeMs: null,
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

  it('pairSearch, pairFinish et connect ne passent que ce qui est donné : ni adresse vide, ni dossier absent, ni sous-dossier vide', async () => {
    const link = computerLink()!;
    await link.pairSearch({ address: '' });
    await link.pairSearch({ address: '192.168.1.20:48217' });
    await link.pairFinish({ generation: 3, keep: true, folder: 'content://arbre', base: '' });
    await link.pairFinish({ generation: 3, keep: false, error: 'proof', notFound: false });
    await link.connect({ folder: 'content://arbre' });
    await link.connect({ address: undefined, folder: null });
    await link.connect({ folder: 'content://arbre', base: '' });
    expect(fake.state.calls.map((c) => c.options)).toEqual([
      {},
      { address: '192.168.1.20:48217' },
      { generation: 3, keep: true, folder: 'content://arbre' },
      { generation: 3, keep: false, error: 'proof', notFound: false },
      { folder: 'content://arbre' },
      {},
      { folder: 'content://arbre' },
    ]);
  });

  it('le sous-dossier où est la mémoire accompagne le dossier, jamais seul', async () => {
    const link = computerLink()!;
    await link.pairFinish({ generation: 1, keep: true, folder: 'content://documents', base: 'Gtracker' });
    await link.connect({ folder: 'content://documents', base: 'Gtracker' });
    await link.connect({ folder: null, base: 'Gtracker' });
    expect(fake.state.calls.map((c) => c.options)).toEqual([
      { generation: 1, keep: true, folder: 'content://documents', base: 'Gtracker' },
      { folder: 'content://documents', base: 'Gtracker' },
      {},
    ]);
  });

  it('les étapes de l\'appairage relisent ce que rend le greffon ; une raison inconnue est une coupure', async () => {
    const link = computerLink()!;
    fake.state.answer = { ...RAW, state: 'searching', generation: 7, candidates: ['192.168.1.20:48217', 4, '', '192.168.1.21:48217'] };
    expect(await link.pairSearch({})).toMatchObject({ generation: 7, candidates: ['192.168.1.20:48217', '192.168.1.21:48217'], status: { state: 'searching' } });
    fake.state.answer = { ...RAW, candidates: ['192.168.1.20:48217'] };
    expect(await link.pairSearch({})).toMatchObject({ generation: -1, candidates: [] });

    fake.state.answer = { ...RAW, state: 'pairing', failure: null, fingerprint: 'ab', partB: '04cd' };
    expect(await link.pairOffer({ generation: 7, endpoint: '192.168.1.20:48217', partA: '04' })).toEqual({
      status: expect.objectContaining({ state: 'pairing' }), failure: null, fingerprint: 'ab', partB: '04cd',
    });
    expect(fake.state.calls.at(-1)?.options).toEqual({ generation: 7, endpoint: '192.168.1.20:48217', partA: '04' });
    fake.state.answer = { ...RAW, failure: null, fingerprint: 'ab', partB: null };
    expect(await link.pairOffer({ generation: 7, endpoint: 'x', partA: '04' })).toMatchObject({ failure: null, partB: null });
    fake.state.answer = { ...RAW, failure: null };
    expect(await link.pairOffer({ generation: 7, endpoint: 'x', partA: '04' })).toMatchObject({ failure: 'network' });
    fake.state.answer = { ...RAW, failure: 'unreachable' };
    expect(await link.pairOffer({ generation: 7, endpoint: 'x', partA: '04' })).toMatchObject({ failure: 'unreachable' });
    fake.state.answer = { ...RAW, failure: 'demain' };
    expect(await link.pairOffer({ generation: 7, endpoint: 'x', partA: '04' })).toMatchObject({ failure: 'network' });

    fake.state.answer = { ...RAW, failure: null, cB: 'ef' };
    const confirmed = await link.pairConfirm({ generation: 7, cA: '01' });
    expect(confirmed).toMatchObject({ failure: null, cB: 'ef' });
    expect(Object.keys(confirmed).sort()).toEqual(['cB', 'failure', 'status']);
    fake.state.answer = { ...RAW, failure: 'code' };
    expect(await link.pairConfirm({ generation: 7, cA: '01' })).toMatchObject({ failure: 'code' });
    fake.state.answer = { ...RAW, failure: null };
    expect(await link.pairConfirm({ generation: 7, cA: '01' })).toMatchObject({ failure: 'network' });
  });

  it('forget rend l\'état', async () => {
    fake.state.answer = { ...RAW, state: 'unpaired', paired: false, computerName: null };
    expect(await computerLink()!.forget()).toMatchObject({ state: 'unpaired', paired: false });
  });

  it('un appel refusé comme mal formé devient ComputerLinkRefused, toute autre erreur passe telle quelle', async () => {
    fake.state.rejection = Object.assign(new Error('mal formé'), { code: 'BAD_ADDRESS' });
    await expect(computerLink()!.pairSearch({ address: 'x' })).rejects.toMatchObject({ refusal: 'address' });
    await expect(computerLink()!.connect({ address: 'x', folder: null })).rejects.toBeInstanceOf(ComputerLinkRefused);
    const other = new Error('autre');
    fake.state.rejection = other;
    await expect(computerLink()!.status()).rejects.toBe(other);
  });

  it('refusalOf lit le code du greffon', () => {
    expect(refusalOf({ code: 'BAD_ADDRESS' })).toBe('address');
    // Le code tapé ne va plus au greffon : son refus vient de la page.
    expect(refusalOf({ code: 'BAD_CODE' })).toBeNull();
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
