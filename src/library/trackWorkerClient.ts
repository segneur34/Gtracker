import { t } from '../core/i18n';
import {
  errorFromJob, runTrackJob, type TrackJobKind, type TrackJobs, type TrackRequest, type TrackResponse,
} from './trackWorkerProtocol';

/**
 * Client des workers des traces : `runInWorker` envoie un calcul à un worker (`trackWorker.ts`) et rend sa
 * réponse. Deux files, chacune son worker, le même script lancé deux fois : « analyse » pour la trace d'une analyse
 * qu'on ouvre (`prepare`), « fond » pour les résumés et les vignettes (`summarize`, `colorTrack`). Un worker traite
 * ses demandes dans l'ordre d'arrivée : sans cette séparation, l'analyse touchée attendrait derrière toutes les
 * vignettes déjà demandées. Chaque worker est créé à la première demande de sa file. S'il meurt, les demandes en cours
 * de sa file sont refaites en ligne et la suivante le recrée ; s'il meurt avant d'avoir répondu une fois (fichier
 * introuvable, worker refusé), sa file se calcule en ligne jusqu'au rechargement ; l'autre file n'en est pas
 * touchée. Sans `Worker` (tests, vieux WebView) ou si sa création lève, le calcul se fait en ligne, toujours de
 * façon asynchrone : un seul chemin pour l'appelant, mêmes chiffres (`runTrackJob`).
 */

interface PendingJob {
  /** Rend la réponse du worker. */
  answer(response: TrackResponse): void;
  /** Refait le calcul en ligne : le worker est mort sans répondre. */
  redo(): void;
}

/** Files des calculs, chacune servie par son worker. */
export type TrackQueue = 'analyse' | 'fond';

/** File de chaque calcul : l'analyse ouverte ne passe jamais derrière les calculs de fond. */
export const TRACK_QUEUE: Readonly<Record<TrackJobKind, TrackQueue>> = {
  prepare: 'analyse',
  summarize: 'fond',
  colorTrack: 'fond',
};

/** État d'une file : son worker, ses demandes en attente de réponse. */
interface QueueState {
  worker: Worker | null;
  /** Le worker courant a répondu au moins une fois : sa mort n'est pas celle d'un worker qui ne démarre pas. */
  answered: boolean;
  /** Plus de worker pour cette file jusqu'au rechargement : sa création a levé, ou il est mort avant toute réponse. */
  inlineOnly: boolean;
  pending: Map<number, PendingJob>;
}

const newQueueState = (): QueueState => ({ worker: null, answered: false, inlineOnly: false, pending: new Map() });

const queues: Record<TrackQueue, QueueState> = { analyse: newQueueState(), fond: newQueueState() };
let nextId = 1;

/**
 * Messages d'erreur du calcul qui peuvent arriver à l'écran, indexés par leur texte français au caractère près. Le
 * worker n'a pas de dictionnaire : ses messages sortent toujours en français, et se traduisent ici, côté page, dans
 * la langue de l'interface. La traduction se lit à l'appel, pas au chargement du module, pour suivre la langue
 * posée. Une phrase changée dans le calcul se change ici aussi.
 */
const JOB_MESSAGES: Readonly<Record<string, () => string>> = {
  'Fichier GPX illisible : le XML est mal formé.': () => t('Fichier GPX illisible : le XML est mal formé.'),
};

/** Erreur du calcul dans la langue de l'interface, même nom ; tout autre message, tel quel. */
const inPageLanguage = (error: unknown): unknown => {
  if (!(error instanceof Error) || !Object.hasOwn(JOB_MESSAGES, error.message)) return error;
  const translated = new Error(JOB_MESSAGES[error.message]());
  translated.name = error.name;
  return translated;
};

/**
 * Calcul en ligne, rendu par une promesse résolue au tour suivant : jamais par une minuterie (les tests de la
 * file des résumés comptent les leurs).
 */
const runInline = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): Promise<TrackJobs[K]['result']> =>
  Promise.resolve().then(() => runTrackJob(kind, gpxText, options)).catch((error: unknown) => Promise.reject(inPageLanguage(error)));

/** Demandes en attente d'une file, retirées et refaites en ligne. */
const redoPending = (queue: QueueState): void => {
  const waiting = [...queue.pending.values()];
  queue.pending.clear();
  for (const job of waiting) job.redo();
};

/** Worker d'une file mort : oublié, et ce qu'il devait rendre refait en ligne. */
const fail = (queue: QueueState, dead: Worker): void => {
  if (queue.worker !== dead) return;
  queue.worker = null;
  dead.terminate();
  if (!queue.answered) queue.inlineOnly = true;
  redoPending(queue);
};

/** Le worker d'une file, créé à sa première demande ; `null` s'il n'y en a pas (en ligne). `Worker` est lu à ce moment-là. */
const currentWorker = (queue: QueueState): Worker | null => {
  if (queue.worker || queue.inlineOnly || typeof Worker === 'undefined') return queue.worker;
  let created: Worker;
  try {
    // D'un seul tenant : c'est cette forme que Vite reconnaît pour émettre le fichier du worker.
    created = new Worker(new URL('./trackWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    queue.inlineOnly = true;
    return null;
  }
  queue.worker = created;
  queue.answered = false;
  created.onmessage = (event: MessageEvent<TrackResponse>) => {
    if (queue.worker === created) queue.answered = true;
    const job = queue.pending.get(event.data.id);
    if (!job) return;
    queue.pending.delete(event.data.id);
    job.answer(event.data);
  };
  created.onerror = () => fail(queue, created);
  created.onmessageerror = () => fail(queue, created);
  return created;
};

/**
 * Lit et prépare un GPX (`prepare`, `core/prepareTrack.ts`), le résume (`summarize`, `summarizeGpx.ts`) ou en tire
 * la trace colorée d'une vignette (`colorTrack`, `sessionTrack.ts`) hors du fil de l'affichage, dans la file du
 * calcul (`TRACK_QUEUE`). La promesse rend le même résultat que le calcul en ligne, ou est rejetée par une erreur de
 * même nom et même message, dans la langue de l'interface.
 */
export const runInWorker = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): Promise<TrackJobs[K]['result']> => {
  const queue = queues[TRACK_QUEUE[kind]];
  const target = currentWorker(queue);
  if (!target) return runInline(kind, gpxText, options);
  return new Promise<TrackJobs[K]['result']>((resolve, reject) => {
    const id = nextId++;
    const redo = () => {
      runInline(kind, gpxText, options).then(resolve, reject);
    };
    queue.pending.set(id, {
      answer: (response) => {
        if ('error' in response) reject(inPageLanguage(errorFromJob(response.error)));
        // La réponse à la demande `id` est celle de son calcul : TypeScript ne relie pas l'identifiant au type.
        else resolve(response.result as TrackJobs[K]['result']);
      },
      redo,
    });
    try {
      target.postMessage({ id, kind, gpxText, options } as TrackRequest);
    } catch {
      // Options qu'on ne sait pas cloner : ce calcul-là se fait en ligne.
      queue.pending.delete(id);
      redo();
    }
  });
};

/** Oublie les workers des deux files (tests) : le prochain appel relit `Worker` et en crée un. Les demandes en cours sont refaites en ligne. */
export const resetTrackWorker = (): void => {
  for (const queue of Object.values(queues)) {
    const current = queue.worker;
    queue.worker = null;
    queue.inlineOnly = false;
    queue.answered = false;
    current?.terminate();
    redoPending(queue);
  }
};
