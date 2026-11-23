import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { patchedDraft, type SessionEdits } from '../library/sessionEdits';
import { jsonStore } from '../platform/storage';
import { withSetting } from '../settings/activitySettings';
import {
  addStoredActivity, readStoredSettings, removeStoredActivity, setStoredActivityHidden, setStoredFamilyHidden,
  subscribeStoredSettings, updateStoredActivity, updateStoredSettings,
} from './useSportSettings';
import { STORAGE_KEYS } from '../core/appIdentity';

const KEY = STORAGE_KEYS.sportSettings;
const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('lecture des réglages par useSyncExternalStore (A4)', () => {
  it('rend le même instantané tant que rien n\'est écrit, un neuf après une écriture', () => {
    jsonStore.write(KEY, { thresholds: { wingfoil: 10 } });
    const first = readStoredSettings();
    expect(readStoredSettings()).toBe(first);
    jsonStore.write('gtracker.autreCle', { x: 1 });
    expect(readStoredSettings()).toBe(first);
    jsonStore.write(KEY, { thresholds: { wingfoil: 11 } });
    expect(readStoredSettings()).not.toBe(first);
    expect(readStoredSettings().thresholds?.wingfoil).toBe(11);
  });

  it("voit une écriture faite entre le rendu et l'abonnement", () => {
    // Rendu : l'instantané est lu ; puis une écriture d'ailleurs ; puis l'abonnement de l'effet.
    jsonStore.write(KEY, { thresholds: { wingfoil: 10 } });
    const rendered = readStoredSettings();
    jsonStore.write(KEY, { thresholds: { wingfoil: 14 } });
    const listener = vi.fn();
    const unsubscribe = subscribeStoredSettings(listener);
    // useSyncExternalStore relit l'instantané après l'abonnement et redessine s'il a changé.
    expect(readStoredSettings()).not.toBe(rendered);
    expect(readStoredSettings().thresholds?.wingfoil).toBe(14);
    unsubscribe();
  });

  it('premier lancement, rien de rangé : le même objet vide à chaque lecture (sinon le rendu boucle)', () => {
    jsonStore.write(KEY, { thresholds: { wingfoil: 10 } });
    readStoredSettings();
    memory.clear();
    const first = readStoredSettings();
    expect(first).toEqual({});
    expect(readStoredSettings()).toBe(first);
    jsonStore.write('gtracker.autreCle', { x: 1 });
    expect(readStoredSettings()).toBe(first);
  });

  it('rend les réglages tels que rangés, sans rien écarter ni ajouter', () => {
    const stored = { thresholds: { wingfoil: 10 }, cleInconnue: { x: 1 } };
    jsonStore.write(KEY, stored);
    expect(readStoredSettings()).toEqual(stored);
    updateStoredSettings((s) => ({ ...s, longPressMs: 900 }));
    expect(readStoredSettings()).toEqual({ ...stored, longPressMs: 900 });
  });

  it("n'est réveillé que par les écritures des réglages", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStoredSettings(listener);
    jsonStore.write(STORAGE_KEYS.panelSizes, {});
    expect(listener).not.toHaveBeenCalled();
    jsonStore.write(KEY, {});
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    jsonStore.write(KEY, { a: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('activité d\'un calcul inconnu dans la liste de l\'appareil', () => {
  const futur = { id: 'a-ski', name: 'Ski', base: 'ski', color: '#123456', reglage: 1 };
  const wing = { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#003e52' };
  const kite = { id: 'kite', name: 'Kite', base: 'kite', color: '#ff7a1a' };
  const surf = { id: 'surf', name: 'Surf', base: 'surf', color: '#000000' };
  const rawIds = () => (readStoredSettings().activities as unknown as { id: string }[]).map((a) => a.id);
  const rawFutur = () => (readStoredSettings().activities as unknown as { id: string }[]).find((a) => a.id === 'a-ski');

  beforeEach(() => jsonStore.write(KEY, { activities: [wing, futur, kite, surf], thresholds: { 'a-ski': 7 } }));

  it('ajouter « Ski » : l\'entrée reste à son rang et l\'activité neuve ne reprend pas son identifiant', () => {
    const id = addStoredActivity('Ski', 'kite', '#e0218a');
    expect(id).toBe('a-ski-2');
    expect(rawFutur()).toEqual(futur);
    const ids = rawIds();
    expect(ids.indexOf('a-ski')).toBe(1);
    expect(ids).toContain('a-ski-2');
    // L'entrée inconnue garde ses réglages, la neuve n'en hérite pas.
    expect(readStoredSettings().thresholds).toEqual({ 'a-ski': 7 });
  });

  it('renommer une activité connue', () => {
    updateStoredActivity('kite', { name: 'Kite foil' });
    expect(rawIds()).toEqual(['wingfoil', 'a-ski', 'kite', 'surf']);
    expect(rawFutur()).toEqual(futur);
    expect((readStoredSettings().activities as unknown as { name: string }[])[2].name).toBe('Kite foil');
  });

  it('supprimer une activité connue : elle part, l\'entrée inconnue reste', () => {
    removeStoredActivity('kite');
    expect(rawIds()).toEqual(['wingfoil', 'a-ski', 'surf']);
    expect(rawFutur()).toEqual(futur);
  });

  it('cacher puis ré-afficher une activité, cacher puis ré-afficher une famille', () => {
    setStoredActivityHidden('kite', true);
    expect(rawIds()).toEqual(['wingfoil', 'a-ski', 'kite', 'surf']);
    expect(rawFutur()).toEqual(futur);
    setStoredActivityHidden('kite', false);
    expect(rawIds()).toEqual(['wingfoil', 'a-ski', 'kite', 'surf']);
    setStoredFamilyHidden('surf', true);
    expect(readStoredSettings().hiddenFamilies).toEqual(['surf']);
    expect(rawIds()).toEqual(['wingfoil', 'a-ski', 'kite', 'surf']);
    setStoredFamilyHidden('surf', false);
    expect(readStoredSettings().hiddenFamilies).toEqual([]);
    expect(rawFutur()).toEqual(futur);
  });

  it('sans entrée inconnue, une activité neuve garde l\'identifiant tiré de son nom', () => {
    jsonStore.write(KEY, { activities: [wing, kite, surf] });
    expect(addStoredActivity('Ski', 'kite', '#e0218a')).toBe('a-ski');
  });
});

describe('deux écritures dans un même geste (A5)', () => {
  it('se cumulent dans les réglages', () => {
    jsonStore.write(KEY, { thresholds: { wingfoil: 10 } });
    updateStoredSettings((s) => ({ ...s, speedUnits: { ...s.speedUnits, wingfoil: 'kmh' } }));
    updateStoredSettings((s) => ({ ...s, distanceUnits: { ...s.distanceUnits, wingfoil: 'nm' } }));
    const stored = readStoredSettings();
    expect(stored.speedUnits?.wingfoil).toBe('kmh');
    expect(stored.distanceUnits?.wingfoil).toBe('nm');
    expect(stored.thresholds?.wingfoil).toBe(10);
  });

  it('case « Sauts » puis onglet : la seconde relit la première au lieu de l’écraser', () => {
    jsonStore.write(KEY, {});
    const jumps = { enabled: true, placement: 'poitrine' as const, minHeightM: 1.5 };
    updateStoredSettings((s) => withSetting(s, 'kite', 'jumps', jumps));
    updateStoredSettings((s) => withSetting(s, 'kite', 'tabs', { sauts: true }));
    expect(readStoredSettings().jumps).toEqual({ kite: jumps });
    expect(readStoredSettings().tabs).toEqual({ kite: { sauts: true } });
  });

  it("n'écrit rien quand le changement rend null", () => {
    jsonStore.write(KEY, { thresholds: { wingfoil: 10 } });
    const listener = vi.fn();
    const unsubscribe = subscribeStoredSettings(listener);
    updateStoredSettings(() => null);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('se cumulent dans le brouillon de session', () => {
    const saved = { notes: { comment: '' } } as unknown as SessionEdits;
    const first = patchedDraft(null, saved, () => ({ customThreshold: 7 } as Partial<SessionEdits>));
    const second = patchedDraft(first, saved, (edits) => ({ notes: { ...edits.notes, comment: 'vent fort' } }));
    expect((second as unknown as { customThreshold: number }).customThreshold).toBe(7);
    expect(second.notes).toEqual({ comment: 'vent fort' });
    expect(saved.notes).toEqual({ comment: '' });
  });
});
