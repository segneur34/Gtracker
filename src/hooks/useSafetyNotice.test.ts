import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../core/appIdentity';

/** Module relu à neuf : chaque essai est un lancement de l'application. */
const launch = async () => {
  vi.resetModules();
  const notice = await import('./useSafetyNotice');
  const { jsonStore } = await import('../platform/storage');
  return { ...notice, jsonStore };
};

describe('mise en garde de la première ouverture, gardée sur l\'appareil', () => {
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

  it('paraît au premier lancement, sur un appareil neuf', async () => {
    const { safetyNoticeShownThisLaunch } = await launch();
    expect(safetyNoticeShownThisLaunch()).toBe(true);
  });

  it('ne paraît plus au lancement suivant une fois lue, sous la forme que garde « J\'ai compris »', async () => {
    // La forme exacte qu'écrit `useStoredRecord` pour `update({ vue: true })`.
    memory.set(STORAGE_KEYS.miseEnGarde, JSON.stringify({ fenetre: { vue: true } }));
    const { safetyNoticeShownThisLaunch } = await launch();
    expect(safetyNoticeShownThisLaunch()).toBe(false);
  });

  it('reste « parue » jusqu\'à la fin du lancement, même lue entre-temps : les autres cartes attendent le suivant', async () => {
    const { safetyNoticeShownThisLaunch, jsonStore } = await launch();
    expect(safetyNoticeShownThisLaunch()).toBe(true);
    jsonStore.write(STORAGE_KEYS.miseEnGarde, { fenetre: { vue: true } });
    expect(safetyNoticeShownThisLaunch()).toBe(true);
    const next = await launch();
    expect(next.safetyNoticeShownThisLaunch()).toBe(false);
  });

  it('revient quand la valeur gardée est effacée (« Tout supprimer ») ou abîmée', async () => {
    memory.set(STORAGE_KEYS.miseEnGarde, JSON.stringify({ fenetre: { vue: 'oui' } }));
    expect((await launch()).safetyNoticeShownThisLaunch()).toBe(true);
    memory.delete(STORAGE_KEYS.miseEnGarde);
    expect((await launch()).safetyNoticeShownThisLaunch()).toBe(true);
  });
});
