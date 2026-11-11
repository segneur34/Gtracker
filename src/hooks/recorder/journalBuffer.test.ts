import { beforeEach, describe, expect, it, vi } from 'vitest';

const append = vi.hoisted(() => vi.fn<(lines: string) => Promise<void>>());
vi.mock('../../platform/files', () => ({ recordingJournal: { append } }));

const { flushJournal, journalFlushDue, queueJournalLines, resetJournalBuffer } = await import('./journalBuffer');
const { getRecorderState } = await import('./store');

const written = (): string[] => append.mock.calls.map(([lines]) => lines);

describe('tampon du journal', () => {
  beforeEach(() => {
    append.mockReset();
    append.mockResolvedValue(undefined);
    resetJournalBuffer();
  });

  it("une écriture en échec remet ses lignes en tête du tampon, précédées d'un saut de ligne", async () => {
    append.mockRejectedValueOnce(new Error('disque plein'));
    queueJournalLines('a\n');
    await flushJournal();
    expect(getRecorderState().error).toBe('Écriture du journal impossible : disque plein');
    queueJournalLines('b\n');
    await flushJournal();
    expect(written()).toEqual(['a\n', '\na\nb\n']);
  });

  it("les lignes sont prises au moment de l'écriture : deux écritures enchaînées gardent l'ordre", async () => {
    let finish!: () => void;
    append.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    queueJournalLines('a\n');
    const first = flushJournal();
    queueJournalLines('b\n');
    const second = flushJournal();
    // Les deux appels sont faits avant que la première écriture ne parte : elle emporte tout, la seconde n'a plus rien.
    await vi.waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    queueJournalLines('c\n');
    const third = flushJournal();
    finish();
    await Promise.all([first, second, third]);
    expect(written()).toEqual(['a\nb\n', 'c\n']);
  });

  it('rien en attente : aucune écriture', async () => {
    await flushJournal();
    expect(append).not.toHaveBeenCalled();
  });

  // Le paquet suit le temps des positions, pas leur nombre : à 1 Hz comme à 5 Hz, une écriture toutes les 10 s.
  it.each([1, 5])('écrit par paquets de 10 s à %i Hz', (hz) => {
    const due = Array.from({ length: 60 * hz + 1 }, (_, i) => i * (1000 / hz))
      .filter((timeMs) => journalFlushDue(timeMs, 10));
    expect(due).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]);
  });
});
