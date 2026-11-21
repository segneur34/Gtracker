import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopPhoneBridge } from './desktopBridge';
import { listPhoneFiles, phoneCableAvailable, phoneCanWrite, phoneImportEntries, phoneIsRecording, phoneListsRoutes, phoneMemoryFolder, phoneState } from './phoneCable';

/**
 * Le téléphone branché, vu de la page : le pont est le vrai code de la coquille (`bureau/telephone.ts`), sur un
 * dossier temporaire qui joue la mémoire du téléphone (`dossierLocal`, celui du banc).
 */

// Les types de Node ne sont pas ceux de l'application : le peu qui sert est décrit à la main, et le code de la
// coquille est chargé par un chemin en variable.
interface NodeFs {
  mkdtemp(prefix: string): Promise<string>;
  mkdir(dir: string, options?: { recursive?: boolean }): Promise<unknown>;
  rm(target: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(file: string, data: string | Uint8Array): Promise<void>;
  readFile(file: string, encoding: 'utf8'): Promise<string>;
  readdir(dir: string): Promise<string[]>;
}
const fs = (await import(/* @vite-ignore */ 'node:fs/promises' as string)) as NodeFs;
const { join } = (await import(/* @vite-ignore */ 'node:path' as string)) as { join(...parts: string[]): string };
const { tmpdir } = (await import(/* @vite-ignore */ 'node:os' as string)) as { tmpdir(): string };
const { fileURLToPath } = (await import(/* @vite-ignore */ 'node:url' as string)) as { fileURLToPath(url: URL): string };

type Reponse = { ok: true; valeur: unknown } | { ok: false; code: string; message: string };
type EtatImpose = { etat: 'pret'; nom: string } | { etat: 'absent' } | { etat: 'autorisation' } | { etat: 'horsLigne' } | { etat: 'adbIntrouvable'; dossier: string } | { etat: 'occupe' };
interface ShellPhone {
  dossierLocal(stockage: string | null, options?: { etatImpose?: EtatImpose | null; coupureApres?: number | null }): unknown;
  gestionnairesTelephone(dossier: unknown, dossierTemp: string): Record<string, (argument: unknown) => Promise<Reponse>>;
}
const SHELL_PHONE = fileURLToPath(new URL('../../bureau/telephone.ts', import.meta.url));
const shell = (await import(/* @vite-ignore */ SHELL_PHONE)) as ShellPhone;

let tmp: string;
let stockage: string;
/** Lectures demandées à la coquille, par chemin. */
let reads: string[];

const write = async (path: string, text: string): Promise<void> => {
  const full = join(stockage, 'Documents', 'Gtracker', ...path.split('/'));
  await fs.mkdir(join(full, '..'), { recursive: true });
  await fs.writeFile(full, text);
};

/** Le programme Windows avec un téléphone branché, joué par `stockage`. */
const plug = (options: { etatImpose?: EtatImpose | null; coupureApres?: number | null; lectureSeule?: boolean } = {}): void => {
  const g = shell.gestionnairesTelephone(shell.dossierLocal(stockage, options), join(tmp, 'lecture'));
  const telephone = {
    etat: () => g['telephone:etat'](undefined),
    lister: () => g['telephone:lister'](undefined),
    lireOctets: (argument: { chemin: string }) => {
      reads.push(argument.chemin);
      return g['telephone:lireOctets'](argument);
    },
    ...(options.lectureSeule ? {} : {
      ecrireOctets: (argument: { chemin: string; octets: Uint8Array }) => g['telephone:ecrireOctets'](argument),
      effacer: (argument: { chemin: string }) => g['telephone:effacer'](argument),
    }),
  } as unknown as DesktopPhoneBridge;
  vi.stubGlobal('window', {
    gtrackerBureau: { version: '0.0.0', memoire: { ouvrir: async () => ({ ok: true, valeur: { etat: 'aucun' } }) }, textes: async () => ({ ok: true, valeur: null }), telephone },
  });
};

beforeEach(async () => {
  tmp = await fs.mkdtemp(join(tmpdir(), 'gtracker-cable-'));
  stockage = join(tmp, 'sdcard');
  await fs.mkdir(stockage, { recursive: true });
  reads = [];
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('téléphone branché par câble', () => {
  it("absent hors du programme Windows et d'une coquille qui ne lit pas le téléphone", () => {
    expect(phoneCableAvailable()).toBe(false);
    vi.stubGlobal('window', { gtrackerBureau: { version: '0.0.0', memoire: { ouvrir: async () => null }, textes: async () => null } });
    expect(phoneCableAvailable()).toBe(false);
    plug();
    expect(phoneCableAvailable()).toBe(true);
  });

  it('état du téléphone, prêt ou imposé', async () => {
    plug();
    expect(await phoneState()).toEqual({ etat: 'pret', nom: "Téléphone d'essai", itineraires: true });
    expect(phoneListsRoutes(await phoneState())).toBe(true);
    expect(phoneListsRoutes({ etat: 'pret', nom: 'x', canal: 'sansFil' })).toBe(false);
    plug({ etatImpose: { etat: 'adbIntrouvable', dossier: 'C:\\profil\\platform-tools' } });
    expect(await phoneState()).toEqual({ etat: 'adbIntrouvable', dossier: 'C:\\profil\\platform-tools' });
  });

  it('listage : racine et sessions/, `null` sans dossier Documents/Gtracker', async () => {
    plug();
    expect(await listPhoneFiles()).toBeNull();
    await write('sessions/a.gpx', '<gpx/>');
    await write('lieux.json', '{}');
    expect(await listPhoneFiles()).toEqual([{ path: 'lieux.json', size: 2 }, { path: 'sessions/a.gpx', size: 6 }]);
  });

  it('lire un GPX lit aussi sa fiche et ses capteurs, rendus ensuite sans relire le téléphone', async () => {
    await write('sessions/a.gpx', '<gpx>é</gpx>');
    await write('sessions/a.json', '{"n":1}');
    await write('sessions/a.imu', 'IMU');
    plug();
    await listPhoneFiles();
    const seen: string[] = [];
    const { entries, unplugged } = phoneImportEntries(['sessions/a.gpx', 'sessions/a.json', 'sessions/a.imu'], (path) => seen.push(path));
    expect(entries.map((e) => [e.name, e.key])).toEqual([['a.gpx', 'sessions/a'], ['a.json', 'sessions/a'], ['a.imu', 'sessions/a']]);
    expect(await entries[0].readText()).toBe('<gpx>é</gpx>');
    expect(seen).toEqual(['sessions/a.gpx', 'sessions/a.json', 'sessions/a.imu']);
    expect(await entries[1].readText()).toBe('{"n":1}');
    expect(new TextDecoder().decode((await entries[2].readBytes())!)).toBe('IMU');
    expect(reads).toEqual(['sessions/a.gpx', 'sessions/a.json', 'sessions/a.imu']);
    expect(unplugged()).toBe(false);
  });

  it('débranché en route : la session en cours échoue entière, les lectures suivantes échouent sans rien demander', async () => {
    await write('sessions/a.gpx', '<gpx/>');
    await write('sessions/a.json', '{}');
    await write('sessions/b.gpx', '<gpx/>');
    plug({ coupureApres: 1 });
    await listPhoneFiles();
    const { entries, unplugged } = phoneImportEntries(['sessions/a.gpx', 'sessions/a.json', 'sessions/b.gpx']);
    await expect(entries[0].readText()).rejects.toThrow('téléphone débranché');
    expect(unplugged()).toBe(true);
    const asked = reads.length;
    await expect(entries[2].readText()).rejects.toThrow('téléphone débranché');
    expect(reads.length).toBe(asked);
  });

  it('écriture : seulement pour un téléphone prêt dont le canal écrit, dans une coquille qui en a les canaux', () => {
    plug();
    expect(phoneCanWrite({ etat: 'pret', nom: 'x', canal: 'cable', ecriture: true })).toBe(true);
    expect(phoneCanWrite({ etat: 'pret', nom: 'x', canal: 'sansFil', ecriture: false })).toBe(false);
    // Un téléphone à jour, relié par le Wi-Fi, s'écrit comme par le câble.
    expect(phoneCanWrite({ etat: 'pret', nom: 'x', canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false })).toBe(true);
    expect(phoneCanWrite({ etat: 'pret', nom: 'x' })).toBe(false);
    expect(phoneCanWrite({ etat: 'absent' })).toBe(false);
    plug({ lectureSeule: true });
    expect(phoneCanWrite({ etat: 'pret', nom: 'x', canal: 'cable', ecriture: true })).toBe(false);
  });

  it('enregistrement : lu dans l’état prêt seulement, faux quand l’état ne le dit pas', () => {
    expect(phoneIsRecording({ etat: 'pret', nom: 'x', canal: 'sansFil', ecriture: false, itineraires: true, enregistrement: true })).toBe(true);
    expect(phoneIsRecording({ etat: 'pret', nom: 'x', canal: 'sansFil', ecriture: true, itineraires: true, enregistrement: false })).toBe(false);
    expect(phoneIsRecording({ etat: 'pret', nom: 'x', canal: 'sansFil', ecriture: false })).toBe(false);
    expect(phoneIsRecording({ etat: 'absent' })).toBe(false);
  });

  it('dossier mémoire du téléphone : liste, lit, écrit, remplace et efface par la coquille', async () => {
    await write('gtracker.json', '{"v":1}');
    await write('sessions/a.gpx', '<gpx/>');
    await write('reglages/tel.json', '{}');
    plug();
    const phone = phoneMemoryFolder('Téléphone');
    expect(phone.kind).toBe('phone');
    expect((await phone.list('')).map((e) => [e.name, e.kind])).toEqual([['gtracker.json', 'file'], ['reglages', 'directory'], ['sessions', 'directory']]);
    expect((await phone.list('sessions')).map((e) => [e.name, e.size])).toEqual([['a.gpx', 6]]);
    expect(await phone.readText('sessions/a.gpx')).toBe('<gpx/>');
    expect(await phone.readText('sessions/absent.gpx')).toBeNull();
    expect(await phone.stat('sessions/absent.gpx')).toBeNull();
    await phone.writeText("sessions/b d'été.json", '{"n":1}');
    expect(await phone.stat("sessions/b d'été.json")).toMatchObject({ size: 7 });
    expect(await phone.readText("sessions/b d'été.json")).toBe('{"n":1}');
    await phone.writeBytes('sessions/a.gpx', new TextEncoder().encode('<gpx>2</gpx>'));
    await phone.remove('sessions/absent.gpx');
    await phone.remove("sessions/b d'été.json");
    const dossier = join(stockage, 'Documents', 'Gtracker', 'sessions');
    expect(await fs.readdir(dossier)).toEqual(['a.gpx']);
    expect(await fs.readFile(join(dossier, 'a.gpx'), 'utf8')).toBe('<gpx>2</gpx>');
  });

  it('dossier mémoire du téléphone : la coquille refuse un chemin hors de sa liste blanche', async () => {
    await write('LISEZMOI.txt', 'à lire');
    plug();
    const phone = phoneMemoryFolder('Téléphone');
    await expect(phone.writeText('journaux/a.json', '{}')).rejects.toMatchObject({ code: 'PERMISSION' });
    await expect(phone.remove('LISEZMOI.txt')).rejects.toMatchObject({ code: 'PERMISSION' });
    expect(await fs.readFile(join(stockage, 'Documents', 'Gtracker', 'LISEZMOI.txt'), 'utf8')).toBe('à lire');
    plug({ lectureSeule: true });
    await expect(phoneMemoryFolder('Téléphone').writeText('sessions/a.json', '{}')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('une lecture en échec, téléphone toujours prêt : son erreur, sans débranchement', async () => {
    await write('sessions/a.gpx', '<gpx/>');
    plug();
    await listPhoneFiles();
    const { entries, unplugged } = phoneImportEntries(['sessions/z.gpx']);
    await expect(entries[0].readText()).rejects.toThrow();
    expect(unplugged()).toBe(false);
  });
});
