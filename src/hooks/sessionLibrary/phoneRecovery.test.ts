import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describePhoneRecovery } from '../../library/phoneRecovery';
import type { MemoryFolder } from '../../platform/memoryFolder';
import { gpxAt, settle, trackTestTimers } from '../../test/library.fixture';
import { createFakeFolder } from '../../test/memoryFolder.fixture';

/**
 * « Récupérer » : les sessions du téléphone branché entrent dans la mémoire du PC par l'import, sans doublon ; une
 * session déjà là n'est pas relue ; un débranchement laisse entier ce qui est rangé.
 */

const files = new Map<string, string>();
const log: string[] = [];
const byteSize = (path: string): number => new TextEncoder().encode(files.get(path) ?? '').length;
const fakeFolder: MemoryFolder = createFakeFolder(files, log, {}, byteSize);

/** Le téléphone : ses fichiers (chemin relatif à Documents/Gtracker → texte), ses lectures, sa coupure. */
let phoneFiles: Map<string, string>;
let phoneReads: string[];
let cutAfter: number | null;
let phoneGone: boolean;

const answer = <T,>(valeur: T) => Promise.resolve({ ok: true as const, valeur });

/** Le sans-fil du PC tel que la coquille le dit ; `null` : une coquille qui n'en a pas. */
let wireless: { actif: boolean; ecoute: boolean } | null;

const plugPhone = (): void => {
  const telephone = {
    etat: () => answer(phoneGone ? { etat: 'absent' } : { etat: 'pret', nom: 'Xiaomi' }),
    lister: () => answer([...phoneFiles].map(([chemin, text]) => ({ chemin, taille: new TextEncoder().encode(text).length, dateMs: 0 }))),
    lireOctets: ({ chemin }: { chemin: string }) => {
      phoneReads.push(chemin);
      if (cutAfter !== null && phoneReads.length > cutAfter) phoneGone = true;
      if (phoneGone) return Promise.resolve({ ok: false as const, code: 'UNKNOWN', message: 'perdu' });
      return answer(new TextEncoder().encode(phoneFiles.get(chemin) ?? ''));
    },
  };
  const sansFil = wireless && {
    etat: () => answer({ ...wireless, port: 48217, adresses: ['192.168.1.20'], pareFeu: 'inconnu', erreur: null, appairage: null, relies: [] }),
    activer: () => answer(null), ouvrirAppairage: () => answer(null), telephones: () => answer([]), retirer: () => answer(false),
    surArrivee: () => () => undefined,
  };
  vi.stubGlobal('window', { gtrackerBureau: { version: '0.0.0', memoire: { ouvrir: async () => null }, textes: async () => null, telephone, ...(sansFil ? { sansFil } : {}) } });
};

const openFresh = async () => {
  vi.resetModules();
  vi.doMock('../../platform/memoryFolder', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../platform/memoryFolder')>()),
    openMemoryFolder: async () => ({ state: 'ready', folder: fakeFolder }),
    pendingFolder: () => null,
  }));
  const library = await import('../useSessionLibrary');
  await library.openLibrary();
  await settle(library);
  const recovery = await import('./phoneRecovery');
  plugPhone();
  return { library, recovery };
};

/** Récupère, puis rend l'issue et ses phrases. */
const recover = async (recovery: typeof import('./phoneRecovery')) => {
  await recovery.recoverFromPhone();
  const step = recovery.phoneRecoveryStep();
  if (step.step !== 'over') throw new Error(`récupération non finie : ${step.step}`);
  return { outcome: step.outcome, text: describePhoneRecovery(step.outcome) };
};

const pcGpx = (): string[] => [...files.keys()].filter((p) => p.startsWith('sessions/') && p.endsWith('.gpx')).sort();

let stopTimers = () => {};
beforeEach(() => {
  files.clear();
  log.length = 0;
  phoneFiles = new Map([
    ['sessions/a.gpx', gpxAt(1)], ['sessions/a.json', '{}'],
    ['sessions/b.gpx', gpxAt(2)],
    ['sessions/c.gpx', gpxAt(3)],
    ['lieux.json', '{}'],
  ]);
  phoneReads = [];
  cutAfter = null;
  phoneGone = false;
  wireless = null;
  stopTimers = trackTestTimers();
});
afterEach(() => {
  stopTimers();
  vi.unstubAllGlobals();
  vi.doUnmock('../../platform/memoryFolder');
});

describe('récupérer les sessions du téléphone', () => {
  it('trois sessions ajoutées ; au second clic, trois déjà présentes, sans rien relire', async () => {
    const { recovery } = await openFresh();
    const first = await recover(recovery);
    expect(first.text.paragraphs).toEqual(['3 sessions ajoutées.']);
    expect(pcGpx()).toHaveLength(3);
    // Le téléphone range ses sessions sous les mêmes noms que le PC.
    phoneFiles = new Map(pcGpx().map((p) => [p, files.get(p)!]));
    phoneReads = [];
    const second = await recover(recovery);
    expect(second.text.paragraphs).toEqual(['0 session ajoutée, 3 déjà présentes.']);
    expect(phoneReads).toEqual([]);
    expect(pcGpx()).toHaveLength(3);
  });

  it('sous un autre nom, une session déjà là est reconnue par son départ : jamais doublée', async () => {
    const { recovery } = await openFresh();
    await recover(recovery);
    phoneReads = [];
    const again = await recover(recovery);
    expect(again.text.paragraphs).toEqual(['0 session ajoutée, 3 déjà présentes.']);
    expect(pcGpx()).toHaveLength(3);
  });

  it('débranché en route : la session lue reste entière, les suivantes échouent sans rien demander, « Réessayer »', async () => {
    cutAfter = 2;
    const { recovery } = await openFresh();
    const { outcome, text } = await recover(recovery);
    expect(outcome.kind === 'done' && outcome.unplugged).toBe(true);
    expect(pcGpx()).toHaveLength(1);
    expect(text.retry).toBe(true);
    expect(text.paragraphs[1]).toBe('1 session ajoutée.');
    // a.gpx et sa fiche lus, b.gpx demandé une fois ; c.gpx jamais.
    expect(phoneReads).toEqual(['sessions/a.gpx', 'sessions/a.json', 'sessions/b.gpx']);
  });

  it('téléphone pas prêt : son état, rien de lu ni de rangé', async () => {
    phoneGone = true;
    const { recovery } = await openFresh();
    const { outcome } = await recover(recovery);
    expect(outcome).toEqual({ kind: 'phone', state: 'absent' });
    expect(pcGpx()).toEqual([]);
    expect(phoneReads).toEqual([]);
  });

  it('téléphone absent : l\'issue dit si le sans-fil attend un téléphone, est éteint ou n\'existe pas', async () => {
    phoneGone = true;
    wireless = { actif: true, ecoute: true };
    const { recovery } = await openFresh();
    expect((await recover(recovery)).outcome).toEqual({ kind: 'phone', state: 'absent', wireless: 'listening' });
    wireless = { actif: false, ecoute: false };
    plugPhone();
    expect((await recover(recovery)).outcome).toEqual({ kind: 'phone', state: 'absent', wireless: 'off' });
    wireless = { actif: true, ecoute: false };
    plugPhone();
    expect((await recover(recovery)).outcome).toEqual({ kind: 'phone', state: 'absent' });
  });
});

describe('récupération à l\'arrivée d\'un téléphone relié', () => {
  it('range seule les sessions neuves et dit le résultat par une ligne', async () => {
    const { recovery } = await openFresh();
    await recovery.recoverOnArrival('Pixel');
    expect(pcGpx()).toHaveLength(3);
    expect(recovery.arrivalNote()?.text).toBe('Téléphone Pixel relié : 3 sessions ajoutées.');
    // Le téléphone range ses sessions sous les mêmes noms que le PC : au retour, rien à relire.
    phoneFiles = new Map(pcGpx().map((p) => [p, files.get(p)!]));
    phoneReads = [];
    await recovery.recoverOnArrival('Pixel');
    expect(recovery.arrivalNote()?.text).toBe('Téléphone Pixel relié : toutes ses sessions sont déjà là.');
    expect(phoneReads).toEqual([]);
    expect(pcGpx()).toHaveLength(3);
    recovery.clearArrivalNote();
    expect(recovery.arrivalNote()).toBeNull();
  });

  it('une arrivée pendant une récupération attend sa fin, et les arrivées suivantes se joignent à elle', async () => {
    const { recovery } = await openFresh();
    const manual = recovery.recoverFromPhone();
    const first = recovery.recoverOnArrival('Pixel');
    const second = recovery.recoverOnArrival('Pixel');
    expect(second).toBe(first);
    await manual;
    // La récupération manuelle ne laisse aucune ligne d'arrivée ; la suivante n'a pas encore commencé.
    expect(recovery.arrivalNote()).toBeNull();
    await first;
    expect(pcGpx()).toHaveLength(3);
    expect(recovery.arrivalNote()?.text).toContain('Téléphone Pixel relié');
    expect(recovery.phoneRecoveryStep().step).toBe('over');
  });

  it('téléphone reparti entre l\'arrivée et la lecture : aucune ligne', async () => {
    phoneGone = true;
    const { recovery } = await openFresh();
    await recovery.recoverOnArrival('Pixel');
    expect(recovery.arrivalNote()).toBeNull();
    expect(pcGpx()).toEqual([]);
  });
});
