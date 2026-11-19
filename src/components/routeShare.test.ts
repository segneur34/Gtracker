import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedRoute } from '../hooks/routeFiles';

const shareFile = vi.fn();
const routeShareFile = vi.fn();
vi.mock('../platform/share', () => ({ shareFile: (...args: unknown[]) => shareFile(...args) }));
vi.mock('../hooks/routeFiles', () => ({ routeShareFile: (...args: unknown[]) => routeShareFile(...args) }));

const { shareRouteGpx } = await import('./routeShare');

const saved = { base: '2026-11-19 Triangle', record: { name: 'Triangle' }, readOnly: false } as unknown as SavedRoute;

describe('shareRouteGpx', () => {
  beforeEach(() => {
    shareFile.mockReset();
    routeShareFile.mockReset();
    routeShareFile.mockResolvedValue({ fileName: '2026-11-19 Triangle.gpx', text: '<gpx/>' });
  });

  it('confie le GPX rangé au partage, sous son nom de fichier, et ne dit rien quand il aboutit', async () => {
    shareFile.mockResolvedValue('shared');
    expect(await shareRouteGpx(saved)).toBeNull();
    expect(routeShareFile).toHaveBeenCalledWith(saved);
    const [blob, fileName] = shareFile.mock.calls[0] as [Blob, string];
    expect(fileName).toBe('2026-11-19 Triangle.gpx');
    expect(blob.type).toBe('application/gpx+xml');
    expect(await blob.text()).toBe('<gpx/>');
  });

  it('un partage abandonné ne dit rien non plus', async () => {
    shareFile.mockResolvedValue('cancelled');
    expect(await shareRouteGpx(saved)).toBeNull();
  });

  it('dit qu\'un navigateur sans partage de fichier a téléchargé le GPX', async () => {
    shareFile.mockResolvedValue('downloaded');
    expect(await shareRouteGpx(saved)).toEqual({ text: 'Ce navigateur ne partage pas de fichier : le GPX est téléchargé.', error: false });
  });

  it('dit un échec en clair, sans lever', async () => {
    routeShareFile.mockRejectedValue(new Error('Dossier introuvable.'));
    const note = await shareRouteGpx(saved);
    expect(note?.error).toBe(true);
    expect(note?.text).toContain('Dossier introuvable.');
    expect(shareFile).not.toHaveBeenCalled();
  });
});
