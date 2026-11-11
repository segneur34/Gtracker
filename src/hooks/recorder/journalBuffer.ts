import { errorMessage } from '../../core/basics';
import { recordingJournal } from '../../platform/files';
import { shouldFlushJournal } from '../../recording/session';
import { setState } from './store';

/**
 * Tampon du journal d'enregistrement : les lignes s'y ajoutent à mesure, et s'écrivent par paquets, dans l'ordre.
 * Le tampon n'est touché que par ces fonctions, pour qu'aucune partie ne puisse l'écrire hors de la file.
 */

let pendingLines = '';
let lastFlushMs: number | null = null;
/** Écritures du journal, enchaînées pour qu'elles arrivent dans l'ordre. */
let writes: Promise<void> = Promise.resolve();

/** Ajoute des lignes au tampon, écrites à la prochaine écriture (`flushJournal`). */
export const queueJournalLines = (lines: string): void => {
  pendingLines += lines;
};

/** Oublie les lignes pas encore écrites : une reprise abandonnée laisse le journal tel qu'il est sur le disque. */
export const dropJournalLines = (): void => {
  pendingLines = '';
};

/** Tampon d'une session qui démarre, ou qui reprend d'un journal relu : vide, et la prochaine position s'écrit. */
export const resetJournalBuffer = (): void => {
  pendingLines = '';
  lastFlushMs = null;
};

/**
 * Vrai si le paquet est dû à cette position (`shouldFlushJournal`) : son heure est alors retenue comme celle de
 * la dernière écriture, avant que l'appelant ne lance l'écriture.
 */
export const journalFlushDue = (fixMs: number, journalFlushS: number): boolean => {
  if (!shouldFlushJournal(lastFlushMs, fixMs, journalFlushS)) return false;
  lastFlushMs = fixMs;
  return true;
};

const enqueueWrite = (write: () => Promise<void>): Promise<void> => {
  writes = writes.then(write).catch((err) => {
    setState({ error: `Écriture du journal impossible : ${errorMessage(err, 'erreur inconnue')}` });
  });
  return writes;
};

/**
 * Écrit les lignes en attente, prises au moment de l'écriture (pas de
 * l'appel) : des écritures enchaînées gardent l'ordre. Une écriture qui échoue
 * remet ses lignes en tête du tampon, pour l'écriture suivante ; un saut de
 * ligne les précède, au cas où une ligne aurait été écrite à moitié.
 */
export const flushJournal = (): Promise<void> => {
  if (pendingLines === '') return writes;
  return enqueueWrite(async () => {
    const lines = pendingLines;
    if (lines === '') return;
    pendingLines = '';
    try {
      await recordingJournal.append(lines);
    } catch (err) {
      pendingLines = '\n' + lines + pendingLines;
      throw err;
    }
  });
};
