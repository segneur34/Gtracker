import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../core/appIdentity';
import { savedEdits } from '../library/sessionEdits';
import type { SessionDraft } from '../library/sessionDrafts';
import { createJsonStore, type StorageBackend } from '../platform/storage';
import { DRAFT_WRITE_DELAY_MS, createDraftStore } from './sessionDraftStore';

/**
 * Magasin des brouillons sur un faux stockage de l'appareil et des minuteries simulées : un second magasin sur le
 * même stockage tient lieu d'application relancée.
 */

/** Faux stockage de l'appareil, qui compte ses écritures. */
const fakeBackend = () => {
  const data = new Map<string, string>();
  let writes = 0;
  const backend: StorageBackend = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { backend, data, writes: () => writes };
};

const base = savedEdits(null);
const draft = (comment: string): SessionDraft => ({ base, edits: { ...base, notes: { ...base.notes, comment } } });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('brouillons de session gardés sur l’appareil', () => {
  it('écrit puis rendu par un magasin neuf sur le même stockage', () => {
    const device = fakeBackend();
    const first = createDraftStore(createJsonStore(() => device.backend));
    first.set('a.gpx', draft('Un long commentaire'));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const relaunched = createDraftStore(createJsonStore(() => device.backend));
    expect(relaunched.get('a.gpx')?.edits.notes.comment).toBe('Un long commentaire');
    expect(relaunched.get('b.gpx')).toBeNull();
  });

  it('une seule écriture après plusieurs frappes, différée', () => {
    const device = fakeBackend();
    const store = createDraftStore(createJsonStore(() => device.backend));
    for (const text of ['U', 'Un', 'Un l', 'Un long']) {
      store.set('a.gpx', draft(text));
      vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS / 4);
    }
    expect(device.writes()).toBe(0);
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    expect(device.writes()).toBe(1);
    expect(JSON.parse(device.data.get(STORAGE_KEYS.brouillons) ?? 'null')['a.gpx'].edits.notes.comment).toBe('Un long');
  });

  it('effacé à l’enregistrement comme à l’annulation (brouillon retiré)', () => {
    const device = fakeBackend();
    const store = createDraftStore(createJsonStore(() => device.backend));
    store.set('a.gpx', draft('A'));
    store.set('b.gpx', draft('B'));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    store.set('a.gpx', null);
    store.set('b.gpx', null);
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const relaunched = createDraftStore(createJsonStore(() => device.backend));
    expect(relaunched.get('a.gpx')).toBeNull();
    expect(relaunched.get('b.gpx')).toBeNull();
  });

  it('un brouillon qui ne change rien n’est pas écrit', () => {
    const device = fakeBackend();
    const store = createDraftStore(createJsonStore(() => device.backend));
    store.set('a.gpx', { base, edits: base });
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    expect(device.writes()).toBe(0);
    expect(store.get('a.gpx')).toBeNull();
  });

  it('jeté si la session n’existe plus : supprimée, ou absente de la mémoire lue en entier', () => {
    const device = fakeBackend();
    const store = createDraftStore(createJsonStore(() => device.backend));
    store.enterMemory('navigateur:');
    store.set('a.gpx', draft('A'));
    store.set('b.gpx', draft('B'));
    store.set('c.gpx', draft('C'));
    store.forget(['a.gpx']);
    store.keepOnly('navigateur:', new Set(['b.gpx', 'b.json']));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const relaunched = createDraftStore(createJsonStore(() => device.backend));
    expect(['a.gpx', 'b.gpx', 'c.gpx'].map((file) => relaunched.get(file) !== null)).toEqual([false, true, false]);
  });

  it('un changement de mémoire ne jette pas le brouillon : dossier désigné, puis retour au navigateur', () => {
    const device = fakeBackend();
    const store = createDraftStore(createJsonStore(() => device.backend));
    store.enterMemory('navigateur:');
    store.set('x.gpx', draft('Saisie pas enregistrée'));
    // Dossier désigné : lu en entier avant la recopie des sessions, il ne porte pas encore x.gpx.
    store.enterMemory('dossier:Voile');
    store.keepOnly('dossier:Voile', new Set(['autre.gpx']));
    expect(store.get('x.gpx')?.edits.notes.comment).toBe('Saisie pas enregistrée');
    // Retour à la mémoire du navigateur, qui porte toujours la session.
    store.enterMemory('navigateur:');
    store.keepOnly('navigateur:', new Set(['x.gpx']));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    expect(createDraftStore(createJsonStore(() => device.backend)).get('x.gpx')?.edits.notes.comment).toBe('Saisie pas enregistrée');
  });

  it('la session recopiée garde son brouillon, qui suit alors la mémoire où il est repris', () => {
    const store = createDraftStore(createJsonStore(() => fakeBackend().backend));
    store.enterMemory('navigateur:');
    store.set('x.gpx', draft('A'));
    store.enterMemory('dossier:Voile');
    expect(store.get('x.gpx')).not.toBeNull();
    store.set('x.gpx', draft('A, repris dans le dossier'));
    store.keepOnly('navigateur:', new Set(['autre.gpx']));
    expect(store.get('x.gpx')?.edits.notes.comment).toBe('A, repris dans le dossier');
  });

  it('deux onglets : chacun n’écrit que ses propres brouillons', () => {
    const device = fakeBackend();
    const tabA = createDraftStore(createJsonStore(() => device.backend));
    tabA.set('x.gpx', draft('X'));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const tabB = createDraftStore(createJsonStore(() => device.backend));
    expect(tabB.get('x.gpx')).not.toBeNull();
    tabB.set('y.gpx', draft('Y'));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    tabA.set('x.gpx', draft('X modifié'));
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const relaunched = createDraftStore(createJsonStore(() => device.backend));
    expect(relaunched.get('x.gpx')?.edits.notes.comment).toBe('X modifié');
    expect(relaunched.get('y.gpx')?.edits.notes.comment).toBe('Y');
    // Un retrait d'un onglet n'efface que son entrée.
    tabB.set('y.gpx', null);
    vi.advanceTimersByTime(DRAFT_WRITE_DELAY_MS);
    const after = createDraftStore(createJsonStore(() => device.backend));
    expect(after.get('x.gpx')?.edits.notes.comment).toBe('X modifié');
    expect(after.get('y.gpx')).toBeNull();
  });

  it('forme illisible ignorée', () => {
    const device = fakeBackend();
    device.data.set(STORAGE_KEYS.brouillons, '{pas du json');
    expect(createDraftStore(createJsonStore(() => device.backend)).get('a.gpx')).toBeNull();
    device.data.set(STORAGE_KEYS.brouillons, JSON.stringify({ 'a.gpx': { base: 1, edits: 'x' } }));
    expect(createDraftStore(createJsonStore(() => device.backend)).get('a.gpx')).toBeNull();
  });

  it('vidé tout de suite quand la page est cachée, sans attendre le délai', async () => {
    const device = fakeBackend();
    const listeners = new Map<string, () => void>();
    const target = { addEventListener: (type: string, listener: () => void) => listeners.set(type, listener) };
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', { ...target, visibilityState: 'hidden' });
    vi.stubGlobal('localStorage', device.backend);
    vi.resetModules();
    try {
      const { sessionDraftStore } = await import('./sessionDraftStore');
      sessionDraftStore.set('a.gpx', draft('Avant la fermeture'));
      expect(device.writes()).toBe(0);
      listeners.get('visibilitychange')?.();
      expect(device.writes()).toBe(1);
      expect(device.data.get(STORAGE_KEYS.brouillons)).toContain('Avant la fermeture');
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
