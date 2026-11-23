import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';
import {
  N_P256, commencerAppairage, conclure, confirmationValide, octetsDepuisHex, octetsEnHex, scalaireDuCode, type EtatSpake2,
} from '../../bureau/spake2';
import type {
  ComputerLinkStatus, PairConfirmResult, PairFinishOptions, PairOfferResult, PairStepFailure,
} from '../platform/computerLink';
import { PAIR_CANDIDATES_MAX, pairWithComputer, pairingCode, worseFailure, type PairingSteps } from './computerPairing';

const CODE = '042917';

const STATUS: ComputerLinkStatus = {
  state: 'pairing', error: null, paired: false, computerName: null, address: null, lastSentMs: null, sentFiles: 0,
  onLocalNetwork: true, lastExchangeMs: null,
};

/** Aléa fixé, mais neuf à chaque appel : 32 octets égaux à un compteur (toujours sous l'ordre de P-256). */
const counter = () => {
  let n = 0;
  const alea = (taille: number): Uint8Array => new Uint8Array(taille).fill(++n);
  return { alea, calls: () => n };
};

/**
 * Comportement d'un appareil qui répond à la recherche :
 * - `pc` : le vrai ordinateur, qui connaît `code` (mené par le même calcul, rôle B) ;
 * - `guess` : un intrus qui joue le rôle B avec un code deviné ;
 * - `wN` : un intrus qui rend w·N pour le vrai code (K neutre chez le téléphone) ;
 * - `old` : un ordinateur resté à l'ancien échange (`defi` sans part) ;
 * - un échec d'étape (`unreachable`, `window`…) rendu dès `appairer`.
 */
type Device =
  | { kind: 'pc'; code: string; fingerprint: number }
  | { kind: 'guess'; code: string; fingerprint: number }
  | { kind: 'wN'; fingerprint: number }
  | { kind: 'old'; fingerprint: number }
  | { kind: 'offerFails'; failure: PairStepFailure };

const fingerprintOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);

/** Faux greffon : chaque appel est noté, avec ses options, pour vérifier ce qui passe le pont. */
const fakeSteps = (devices: Record<string, Device>, order: string[] = Object.keys(devices)) => {
  const calls: { method: string; options: Record<string, unknown> }[] = [];
  const pcAlea = counter();
  /** L'appareil du candidat en cours et l'état de son côté. */
  let current: { device: Device; etat: EtatSpake2 | null } | null = null;
  const steps: PairingSteps = {
    pairSearch: async (options) => {
      calls.push({ method: 'pairSearch', options });
      return { status: { ...STATUS, state: 'searching' }, generation: 5, candidates: order };
    },
    pairOffer: async (options): Promise<PairOfferResult> => {
      calls.push({ method: 'pairOffer', options });
      const device = devices[options.endpoint];
      current = null;
      if (device.kind === 'offerFails') return { status: STATUS, failure: device.failure };
      const fingerprint = octetsEnHex(fingerprintOf(device.fingerprint));
      if (device.kind === 'old') return { status: STATUS, failure: null, fingerprint, partB: null };
      if (device.kind === 'wN') {
        const wN = p256.Point.fromHex(N_P256).multiply(scalaireDuCode(CODE)).toBytes(false);
        current = { device, etat: null };
        return { status: STATUS, failure: null, fingerprint, partB: octetsEnHex(wN) };
      }
      const etat = commencerAppairage('B', device.code, fingerprintOf(device.fingerprint), pcAlea.alea);
      current = { device, etat: { ...etat, identites: etat.identites } };
      // L'ordinateur retient la part reçue pour conclure à la confirmation.
      (current as { partA?: Uint8Array }).partA = octetsDepuisHex(options.partA, 65) ?? undefined;
      return { status: STATUS, failure: null, fingerprint, partB: octetsEnHex(etat.part) };
    },
    pairConfirm: async (options): Promise<PairConfirmResult> => {
      calls.push({ method: 'pairConfirm', options });
      const held = current as ({ device: Device; etat: EtatSpake2 | null; partA?: Uint8Array } | null);
      if (held === null || held.etat === null || held.partA === undefined) return { status: STATUS, failure: 'network' };
      const cles = conclure(held.etat, held.partA);
      const cA = octetsDepuisHex(options.cA, 32);
      // Le vrai ordinateur vérifie la confirmation du téléphone avant de rien envoyer qui dépende du code.
      if (held.device.kind === 'pc' && (cA === null || !confirmationValide(cles, cA))) return { status: STATUS, failure: 'code' };
      return { status: STATUS, failure: null, cB: octetsEnHex(cles.confirmationEnvoyee) };
    },
    pairFinish: async (options: PairFinishOptions) => {
      calls.push({ method: 'pairFinish', options: { ...options } });
      return options.keep
        ? { ...STATUS, state: 'linked', paired: true, computerName: 'BUREAU' }
        : { ...STATUS, state: options.notFound ? 'notFound' : 'unpaired', error: options.error };
    },
  };
  const of = (method: string) => calls.filter((c) => c.method === method);
  return { steps, calls, of };
};

const request = { code: CODE, folder: 'content://arbre', base: 'Gtracker' };

describe('pairWithComputer : l’appairage par le code, conduit par la page', () => {
  it('le vrai ordinateur : sa confirmation vérifiée, il est gardé avec le dossier mémoire', async () => {
    const { steps, of } = fakeSteps({ '192.168.1.20:48217': { kind: 'pc', code: CODE, fingerprint: 7 } });
    const status = await pairWithComputer(steps, request, counter().alea);
    expect(status.state).toBe('linked');
    expect(of('pairConfirm')).toHaveLength(1);
    expect(of('pairFinish').map((c) => c.options)).toEqual([{ generation: 5, keep: true, folder: 'content://arbre', base: 'Gtracker' }]);
    expect(of('pairOffer')[0].options).toMatchObject({ generation: 5, endpoint: '192.168.1.20:48217' });
  });

  it('jamais gardé quand la confirmation de l’ordinateur est fausse : un intrus qui ne connaît pas le code', async () => {
    const { steps, of } = fakeSteps({ '192.168.1.66:48217': { kind: 'guess', code: '111111', fingerprint: 9 } });
    const status = await pairWithComputer(steps, request, counter().alea);
    expect(of('pairFinish').map((c) => c.options)).toEqual([{ generation: 5, keep: false, error: 'proof', notFound: false }]);
    expect(status.error).toBe('proof');
  });

  it('w·N rendu par un intrus (K neutre) : traité comme une confirmation fausse, rien ne part vers lui', async () => {
    const { steps, of } = fakeSteps({ '192.168.1.66:48217': { kind: 'wN', fingerprint: 9 } });
    await pairWithComputer(steps, request, counter().alea);
    expect(of('pairConfirm')).toHaveLength(0);
    expect(of('pairFinish').map((c) => c.options)).toEqual([{ generation: 5, keep: false, error: 'proof', notFound: false }]);
  });

  it('un intrus qui répond le premier n’empêche pas l’appairage : chaque candidat a son scalaire neuf', async () => {
    const { steps, of } = fakeSteps({
      '192.168.1.66:48217': { kind: 'guess', code: '111111', fingerprint: 9 },
      '192.168.1.67:48217': { kind: 'wN', fingerprint: 10 },
      '192.168.1.20:48217': { kind: 'pc', code: CODE, fingerprint: 7 },
    });
    const alea = counter();
    const status = await pairWithComputer(steps, request, alea.alea);
    expect(status.state).toBe('linked');
    const parts = of('pairOffer').map((c) => c.options.partA);
    expect(parts).toHaveLength(3);
    expect(new Set(parts).size).toBe(3);
    expect(alea.calls()).toBe(3);
    expect(of('pairFinish').map((c) => c.options.keep)).toEqual([true]);
  });

  it(`au plus ${PAIR_CANDIDATES_MAX} candidats essayés à chaque appui, sans nouvelle recherche`, async () => {
    const devices: Record<string, Device> = {};
    for (let i = 0; i < 6; i++) devices[`192.168.1.${60 + i}:48217`] = { kind: 'guess', code: '111111', fingerprint: 60 + i };
    const { steps, of } = fakeSteps(devices);
    await pairWithComputer(steps, request, counter().alea);
    expect(PAIR_CANDIDATES_MAX).toBe(4);
    expect(of('pairOffer')).toHaveLength(4);
    expect(of('pairConfirm')).toHaveLength(4);
    expect(of('pairSearch')).toHaveLength(1);
    expect(of('pairFinish').map((c) => c.options.keep)).toEqual([false]);
  });

  it('ordinateur resté à l’ancien échange : « version », sans confirmation envoyée', async () => {
    const { steps, of } = fakeSteps({ '192.168.1.20:48217': { kind: 'old', fingerprint: 7 } });
    await pairWithComputer(steps, request, counter().alea);
    expect(of('pairConfirm')).toHaveLength(0);
    expect(of('pairFinish')[0].options).toMatchObject({ keep: false, error: 'version' });
  });

  it('le même ordinateur trouvé à deux adresses : une seule confirmation', async () => {
    const { steps, of } = fakeSteps({
      '192.168.1.20:48217': { kind: 'pc', code: '999999', fingerprint: 7 },
      '10.0.0.20:48217': { kind: 'pc', code: '999999', fingerprint: 7 },
    });
    await pairWithComputer(steps, request, counter().alea);
    expect(of('pairOffer')).toHaveLength(2);
    expect(of('pairConfirm')).toHaveLength(1);
    expect(of('pairFinish')[0].options).toMatchObject({ keep: false, error: 'code' });
  });

  it('raison gardée quand rien n’aboutit : la plus parlante ; tous injoignables : introuvable', async () => {
    const mixed = fakeSteps({
      a: { kind: 'offerFails', failure: 'unreachable' },
      b: { kind: 'offerFails', failure: 'window' },
      c: { kind: 'pc', code: '999999', fingerprint: 3 },
      d: { kind: 'offerFails', failure: 'network' },
    });
    await pairWithComputer(mixed.steps, request, counter().alea);
    expect(mixed.of('pairFinish')[0].options).toEqual({ generation: 5, keep: false, error: 'code', notFound: false });

    const none = fakeSteps({ a: { kind: 'offerFails', failure: 'unreachable' }, b: { kind: 'offerFails', failure: 'unreachable' } });
    const status = await pairWithComputer(none.steps, request, counter().alea);
    expect(none.of('pairFinish')[0].options).toEqual({ generation: 5, keep: false, error: 'network', notFound: true });
    expect(status.state).toBe('notFound');

    expect(worseFailure(null, 'network')).toBe('network');
    expect(worseFailure('window', 'proof')).toBe('proof');
    expect(worseFailure('code', 'proof')).toBe('code');
    expect(worseFailure('protocol', 'network')).toBe('protocol');
  });

  it('aucun ordinateur trouvé : l’état de la recherche, sans autre étape', async () => {
    const { steps, calls } = fakeSteps({}, []);
    const status = await pairWithComputer(steps, { ...request, address: '192.168.1.20:48217' }, counter().alea);
    expect(status.state).toBe('searching');
    expect(calls.map((c) => c.method)).toEqual(['pairSearch']);
    expect(calls[0].options).toEqual({ address: '192.168.1.20:48217' });
  });

  it('code mal formé : refusé avant toute tentative ; espaces retirés, rien d’autre', async () => {
    const { steps, calls } = fakeSteps({ a: { kind: 'pc', code: CODE, fingerprint: 7 } });
    for (const bad of ['42917', '0429170', '04291a', '０４２９１７', '']) {
      await expect(pairWithComputer(steps, { ...request, code: bad }, counter().alea)).rejects.toMatchObject({ refusal: 'code' });
    }
    expect(calls).toHaveLength(0);
    expect(pairingCode(' 042 917 ')).toBe(CODE);
    expect(pairingCode('042-917')).toBeNull();
    const status = await pairWithComputer(steps, { ...request, code: '042 917' }, counter().alea);
    expect(status.state).toBe('linked');
  });

  it('panne du pont pendant une étape : l’appairage est fermé sans rien garder, la panne remonte', async () => {
    const { steps, of } = fakeSteps({ a: { kind: 'pc', code: CODE, fingerprint: 7 } });
    const broken: PairingSteps = { ...steps, pairConfirm: async () => { throw new Error('pont fermé'); } };
    await expect(pairWithComputer(broken, request, counter().alea)).rejects.toThrow('pont fermé');
    expect(of('pairFinish').map((c) => c.options)).toEqual([{ generation: 5, keep: false, error: 'network', notFound: false }]);
  });

  it('seuls la part et la confirmation du téléphone passent le pont : ni le code, ni rien de l’échange', async () => {
    const { steps, calls } = fakeSteps({
      a: { kind: 'guess', code: '111111', fingerprint: 9 },
      b: { kind: 'pc', code: CODE, fingerprint: 7 },
    });
    await pairWithComputer(steps, request, counter().alea);
    const allowed = new Set(['address', 'generation', 'endpoint', 'partA', 'cA', 'keep', 'folder', 'base', 'error', 'notFound']);
    const w = octetsEnHex(new Uint8Array(scalaireDuCode(CODE).toString(16).padStart(64, '0').match(/../g)!.map((h) => parseInt(h, 16))));
    for (const { options } of calls) {
      for (const [key, value] of Object.entries(options)) {
        expect(allowed.has(key), key).toBe(true);
        expect(String(value)).not.toContain(CODE);
        expect(String(value)).not.toContain(w);
      }
    }
    for (const c of calls.filter((x) => x.method === 'pairOffer')) expect(String(c.options.partA)).toMatch(/^04[0-9a-f]{128}$/);
    for (const c of calls.filter((x) => x.method === 'pairConfirm')) expect(String(c.options.cA)).toMatch(/^[0-9a-f]{64}$/);
  });
});
