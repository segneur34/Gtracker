import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  onWirelessArrival, openWirelessPairing, removeWirelessPhone, setWirelessActive, wirelessAvailable, wirelessPhones, wirelessState,
  type WirelessArrival,
} from './wirelessPhone';
import type { DesktopWirelessBridge } from './desktopBridge';

/**
 * Le sans-fil du PC, vu de la page : le pont est le vrai serveur de la coquille (`bureau/sansFil.ts`) sur une vraie
 * socket en 127.0.0.1, dans un profil temporaire, et un faux téléphone (`bureau/fauxTelephone.ts`) s'y relie.
 */

// Les types de Node ne sont pas ceux de l'application : le peu qui sert est décrit à la main, et le code de la
// coquille est chargé par un chemin en variable.
interface NodeFs {
  mkdtemp(prefix: string): Promise<string>;
  mkdir(dir: string, options?: { recursive?: boolean }): Promise<unknown>;
  rm(target: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(file: string, data: string | Uint8Array): Promise<void>;
}
const fs = (await import(/* @vite-ignore */ 'node:fs/promises' as string)) as NodeFs;
const { join } = (await import(/* @vite-ignore */ 'node:path' as string)) as { join(...parts: string[]): string };
const { tmpdir } = (await import(/* @vite-ignore */ 'node:os' as string)) as { tmpdir(): string };
const { fileURLToPath } = (await import(/* @vite-ignore */ 'node:url' as string)) as { fileURLToPath(url: URL): string };

type Reponse = { ok: true; valeur: unknown } | { ok: false; code: string; message: string };
interface ShellServer {
  activer(actif: boolean): Promise<unknown>;
  arreter(): Promise<void>;
}
interface ShellFake {
  appairer(hote: string, port: number, code: string): Promise<unknown>;
}
interface ShellSansFil {
  ServeurSansFil: new (options: Record<string, unknown>) => ShellServer;
  gestionnairesSansFil(serveur: ShellServer): Record<string, (argument: unknown) => Promise<Reponse>>;
  stockageDossier(dossier: string): unknown;
}
const SHELL_SERVER = fileURLToPath(new URL('../../bureau/sansFil.ts', import.meta.url));
const SHELL_FAKE = fileURLToPath(new URL('../../bureau/fauxTelephone.ts', import.meta.url));
const shell = (await import(/* @vite-ignore */ SHELL_SERVER)) as ShellSansFil;
const fake = (await import(/* @vite-ignore */ SHELL_FAKE)) as { FauxTelephone: new (options: { dossier: string; delaiMs?: number }) => ShellFake };

/** Chiffrement d'essai : réversible, mais la clé n'apparaît pas en clair dans le fichier. */
const chiffreur = {
  disponible: async () => true,
  chiffrer: async (texte: string) => new TextEncoder().encode(`essai:${btoa(texte)}`),
  dechiffrer: async (octets: Uint8Array) => atob(new TextDecoder().decode(octets).replace(/^essai:/, '')),
};

let tmp: string;
let server: ShellServer;
/** Rappels abonnés à `surArrivee`, appelés par le serveur à chaque téléphone qui se présente. */
let listeners: Set<(avis: unknown) => void>;

const plug = (): void => {
  const g = shell.gestionnairesSansFil(server);
  const sansFil: DesktopWirelessBridge = {
    etat: () => g['sansfil:etat'](undefined) as ReturnType<DesktopWirelessBridge['etat']>,
    activer: (argument) => g['sansfil:activer'](argument) as ReturnType<DesktopWirelessBridge['activer']>,
    ouvrirAppairage: () => g['sansfil:ouvrirAppairage'](undefined) as ReturnType<DesktopWirelessBridge['ouvrirAppairage']>,
    telephones: () => g['sansfil:telephones'](undefined) as ReturnType<DesktopWirelessBridge['telephones']>,
    retirer: (argument) => g['sansfil:retirer'](argument) as ReturnType<DesktopWirelessBridge['retirer']>,
    surArrivee: (rappel) => {
      listeners.add(rappel);
      return () => listeners.delete(rappel);
    },
  };
  vi.stubGlobal('window', { gtrackerBureau: { version: '0.0.0', memoire: { ouvrir: async () => null }, textes: async () => null, sansFil } });
};

const waitFor = async (condition: () => boolean | Promise<boolean>): Promise<void> => {
  for (let i = 0; i < 200; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('condition jamais remplie');
};

beforeEach(async () => {
  tmp = await fs.mkdtemp(join(tmpdir(), 'gtk-wireless-'));
  await fs.mkdir(join(tmp, 'telephone'), { recursive: true });
  await fs.writeFile(join(tmp, 'telephone', 'index.json'), '{}');
  listeners = new Set();
  server = new shell.ServeurSansFil({
    stockage: shell.stockageDossier(join(tmp, 'profil')),
    chiffreur,
    adresses: () => [{ adresse: '127.0.0.1', masque: '255.0.0.0' }],
    port: 0,
    portSonde: null,
    nomPc: 'PC de test',
    surArrivee: (avis: unknown) => listeners.forEach((rappel) => rappel(avis)),
  });
});

afterEach(async () => {
  await server.arreter();
  vi.unstubAllGlobals();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('sans-fil du programme Windows, vu de la page', () => {
  it('absent hors du programme Windows et d\'une coquille plus ancienne : rien ne s\'exécute', async () => {
    expect(wirelessAvailable()).toBe(false);
    vi.stubGlobal('window', { gtrackerBureau: { version: '0.0.0', memoire: { ouvrir: async () => null }, textes: async () => null } });
    expect(wirelessAvailable()).toBe(false);
    expect(() => wirelessState()).toThrow();
    const arrivals: WirelessArrival[] = [];
    expect(onWirelessArrival((a) => arrivals.push(a))()).toBeUndefined();
    expect(arrivals).toEqual([]);
  });

  it('éteint par défaut : rien n\'écoute, la fenêtre de liaison est refusée', async () => {
    plug();
    expect(wirelessAvailable()).toBe(true);
    expect(await wirelessState()).toMatchObject({ actif: false, ecoute: false, appairage: null, relies: [] });
    await expect(openWirelessPairing()).rejects.toThrow();
    expect(await wirelessPhones()).toEqual([]);
  });

  it('allumé : à l\'écoute, fenêtre de liaison par code, arrivée annoncée, téléphone listé puis retiré', async () => {
    plug();
    const arrivals: WirelessArrival[] = [];
    const stop = onWirelessArrival((a) => arrivals.push(a));
    const state = await setWirelessActive(true);
    expect(state).toMatchObject({ actif: true, ecoute: true, adresses: ['127.0.0.1'], erreur: null });

    const pairing = await openWirelessPairing();
    expect(pairing).toMatchObject({ adresse: '127.0.0.1', port: state.port });
    expect(pairing.code).toMatch(/^\d{6}$/);
    expect(pairing.restantMs).toBeGreaterThan(100_000);
    expect((await wirelessState()).appairage).toMatchObject({ code: pairing.code });

    await new fake.FauxTelephone({ dossier: join(tmp, 'telephone'), delaiMs: 5_000 }).appairer(pairing.adresse, pairing.port, pairing.code);
    await waitFor(() => arrivals.length === 1);
    expect(arrivals[0]).toMatchObject({ name: "Téléphone d'essai", isNew: true });
    // La fenêtre se ferme au succès.
    expect((await wirelessState()).appairage).toBeNull();
    const phones = await wirelessPhones();
    expect(phones).toEqual([expect.objectContaining({ nom: "Téléphone d'essai", relie: true })]);
    expect(await wirelessState()).toMatchObject({ relies: [{ nom: "Téléphone d'essai" }] });

    expect(await removeWirelessPhone(phones[0].id)).toBe(true);
    expect(await wirelessPhones()).toEqual([]);
    expect(await removeWirelessPhone(phones[0].id)).toBe(false);

    stop();
    expect(listeners.size).toBe(0);
    expect((await setWirelessActive(false)).actif).toBe(false);
  });

  it('un avis qui n\'a pas la forme attendue est ignoré', async () => {
    plug();
    const arrivals: WirelessArrival[] = [];
    onWirelessArrival((a) => arrivals.push(a));
    listeners.forEach((rappel) => {
      rappel(null);
      rappel({ id: 3, nom: 'x', nouveau: true });
      rappel({ id: 'a', nom: 'Pixel', nouveau: false });
    });
    expect(arrivals).toEqual([{ id: 'a', name: 'Pixel', isNew: false }]);
  });
});
