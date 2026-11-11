import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonSelector, createListeners, createStore } from './createStore';
import { jsonStore } from '../platform/storage';

describe('createListeners', () => {
  it('prévient les abonnés et ne prévient plus un désabonné', () => {
    const listeners = createListeners();
    const a = vi.fn();
    const b = vi.fn();
    const offA = listeners.subscribe(a);
    listeners.subscribe(b);
    listeners.notify();
    offA();
    listeners.notify();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    expect(listeners.size()).toBe(1);
  });
});

describe('createStore', () => {
  it('rend l\'état, le remplace et le fusionne en prévenant', () => {
    const store = createStore({ n: 1, label: 'a' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.patch({ n: 2 });
    expect(store.get()).toEqual({ n: 2, label: 'a' });
    store.set({ n: 3, label: 'b' });
    expect(store.get()).toEqual({ n: 3, label: 'b' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('createListeners : arguments et abonnés en échec (lot 72)', () => {
  it('passe ses arguments à chaque abonné', () => {
    const listeners = createListeners<[number, string]>();
    const a = vi.fn();
    listeners.subscribe(a);
    listeners.notify(3, 'x');
    expect(a).toHaveBeenCalledWith(3, 'x');
  });

  it("sûr : un abonné qui lève ne prive pas les suivants, ni l'appelant", () => {
    const listeners = createListeners({ safe: true });
    const after = vi.fn();
    listeners.subscribe(() => {
      throw new Error('échec');
    });
    listeners.subscribe(after);
    expect(() => listeners.notify()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("ordinaire : l'erreur d'un abonné remonte", () => {
    const listeners = createListeners();
    listeners.subscribe(() => {
      throw new Error('échec');
    });
    expect(() => listeners.notify()).toThrow('échec');
  });
});

describe('createJsonSelector (lot 72)', () => {
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

  const KEY = 'gtracker.essaiSelecteur';

  it("ne refait la sélection qu'à une écriture de la clé, et garde la même valeur si elle n'a pas changé", () => {
    const select = vi.fn((raw: unknown) => ({ a: (raw as { a?: number } | null)?.a ?? 0 }));
    const selector = createJsonSelector(KEY, select);
    jsonStore.write(KEY, { a: 1, b: 1 });
    const first = selector.get();
    expect(first).toEqual({ a: 1 });
    expect(selector.get()).toBe(first);
    expect(select).toHaveBeenCalledTimes(1);
    jsonStore.write('gtracker.autre', { a: 9 });
    expect(selector.get()).toBe(first);
    jsonStore.write(KEY, { a: 1, b: 2 });
    expect(selector.get()).toBe(first);
    jsonStore.write(KEY, { a: 2, b: 2 });
    expect(selector.get()).toEqual({ a: 2 });
  });

  it('suit sa clé seule, et sa comparaison si elle en a une', () => {
    const listener = vi.fn();
    const selector = createJsonSelector(KEY, (raw) => raw, () => true);
    const unsubscribe = selector.subscribe(listener);
    jsonStore.write('gtracker.autre', 1);
    expect(listener).not.toHaveBeenCalled();
    jsonStore.write(KEY, 1);
    const kept = selector.get();
    jsonStore.write(KEY, 2);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(selector.get()).toBe(kept);
    unsubscribe();
  });
});
