import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resume = vi.hoisted(() => ({ listeners: new Set<() => void>() }));
const native = vi.hoisted(() => ({ app: false, keepOn: [] as boolean[] }));

vi.mock('./permissions', () => ({
  onAppResume: (listener: () => void) => {
    resume.listeners.add(listener);
    return () => resume.listeners.delete(listener);
  },
}));
vi.mock('./runtime', () => ({ isNativeApp: () => native.app }));
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    keepOn: async ({ on }: { on: boolean }) => { native.keepOn.push(on); },
    lockOrientation: async () => undefined,
    isDarkMode: async () => ({ dark: false }),
    addListener: async () => ({ remove: async () => undefined }),
  }),
}));

import { isForeground, keepScreenOn, onForeground } from './screen';

describe('écran allumé : une demande par raison', () => {
  beforeEach(() => {
    native.app = true;
    native.keepOn = [];
  });
  afterEach(() => {
    keepScreenOn(false, 'recording');
    keepScreenOn(false, 'computerLink');
    keepScreenOn(false, 'restingHrTest');
    native.app = false;
  });

  it('deux raisons, l\'une rendue : l\'écran reste allumé ; éteint quand la seconde l\'est aussi', () => {
    keepScreenOn(true, 'recording');
    keepScreenOn(true, 'computerLink');
    expect(native.keepOn).toEqual([true]);
    keepScreenOn(false, 'computerLink');
    expect(native.keepOn).toEqual([true]);
    keepScreenOn(false, 'recording');
    expect(native.keepOn).toEqual([true, false]);
  });

  it('la liaison rendue avant l\'enregistreur ne l\'éteint pas, et l\'inverse non plus', () => {
    keepScreenOn(true, 'computerLink');
    keepScreenOn(true, 'recording');
    keepScreenOn(false, 'recording');
    expect(native.keepOn).toEqual([true]);
    keepScreenOn(false, 'computerLink');
    expect(native.keepOn).toEqual([true, false]);
  });

  it('une même raison demandée deux fois ne se compte qu\'une fois, et se rend d\'un coup', () => {
    keepScreenOn(true, 'computerLink');
    keepScreenOn(true, 'computerLink');
    keepScreenOn(false, 'computerLink');
    expect(native.keepOn).toEqual([true, false]);
    keepScreenOn(false, 'computerLink');
    expect(native.keepOn).toEqual([true, false]);
  });
});

/** Page factice : son état, et le changement qui prévient ses écouteurs. */
const stubPage = (initial: DocumentVisibilityState = 'visible') => {
  const listeners = new Set<() => void>();
  const page = {
    visibilityState: initial,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('document', page);
  return {
    listeners,
    set: (state: DocumentVisibilityState) => {
      page.visibilityState = state;
      listeners.forEach((listener) => listener());
    },
  };
};

const fireResume = () => resume.listeners.forEach((listener) => listener());

describe('retour au premier plan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resume.listeners.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('prévient quand la page redevient visible, pas quand elle se cache', () => {
    const page = stubPage();
    const listener = vi.fn();
    onForeground(listener);
    page.set('hidden');
    expect(listener).not.toHaveBeenCalled();
    expect(isForeground()).toBe(false);
    page.set('visible');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isForeground()).toBe(true);
  });

  it('prévient au signal du système, sans changement de la page', () => {
    stubPage();
    const listener = vi.fn();
    onForeground(listener);
    fireResume();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('un même retour, signalé deux fois, ne prévient qu’une fois', () => {
    const page = stubPage('hidden');
    const listener = vi.fn();
    onForeground(listener);
    page.set('visible');
    fireResume();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('un signal du système reçu page encore cachée attend la page', () => {
    const page = stubPage('hidden');
    const listener = vi.fn();
    onForeground(listener);
    fireResume();
    expect(listener).not.toHaveBeenCalled();
    page.set('visible');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('deux retours distincts préviennent deux fois', () => {
    const page = stubPage();
    const listener = vi.fn();
    onForeground(listener);
    page.set('hidden');
    page.set('visible');
    vi.advanceTimersByTime(5000);
    page.set('hidden');
    page.set('visible');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('le désabonnement retire les deux écoutes', () => {
    const page = stubPage();
    const listener = vi.fn();
    const stop = onForeground(listener);
    stop();
    expect(page.listeners.size).toBe(0);
    expect(resume.listeners.size).toBe(0);
    page.set('hidden');
    page.set('visible');
    fireResume();
    expect(listener).not.toHaveBeenCalled();
  });

  it('sans page, sans effet', () => {
    const listener = vi.fn();
    const stop = onForeground(listener);
    expect(resume.listeners.size).toBe(0);
    stop();
    expect(listener).not.toHaveBeenCalled();
  });
});
