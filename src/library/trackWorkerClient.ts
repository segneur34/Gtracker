import { t } from '../core/i18n';
import {
  errorFromJob, runTrackJob, type TrackJobKind, type TrackJobs, type TrackRequest, type TrackResponse,
} from './trackWorkerProtocol';

/**
 * Client du worker des traces : `runInWorker` envoie un calcul au worker (`trackWorker.ts`) et rend sa
 * réponse. Un seul worker, créé à la première demande. S'il meurt, les demandes en cours sont refaites en ligne et
 * la suivante le recrée ; s'il meurt avant d'avoir répondu une fois (fichier introuvable, worker refusé), tout se
 * calcule en ligne jusqu'au rechargement. Sans `Worker` (tests, vieux WebView) ou si sa création lève, le calcul se
 * fait en ligne, toujours de façon asynchrone : un seul chemin pour l'appelant, mêmes chiffres (`runTrackJob`).
 */

interface PendingJob {
  /** Rend la réponse du worker. */
  answer(response: TrackResponse): void;
  /** Refait le calcul en ligne : le worker est mort sans répondre. */
  redo(): void;
}

let worker: Worker | null = null;
/** Le worker courant a répondu au moins une fois : sa mort n'est pas celle d'un worker qui ne démarre pas. */
let answered = false;
/** Plus de worker jusqu'au rechargement : sa création a levé, ou il est mort avant toute réponse. */
let inlineOnly = false;
let nextId = 1;
const pending = new Map<number, PendingJob>();

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

/** Worker mort : oublié, et ce qu'il devait rendre refait en ligne. */
const fail = (dead: Worker): void => {
  if (worker !== dead) return;
  worker = null;
  dead.terminate();
  if (!answered) inlineOnly = true;
  const waiting = [...pending.values()];
  pending.clear();
  for (const job of waiting) job.redo();
};

/** Le worker, créé à la première demande ; `null` s'il n'y en a pas (en ligne). `Worker` est lu à ce moment-là. */
const currentWorker = (): Worker | null => {
  if (worker || inlineOnly || typeof Worker === 'undefined') return worker;
  let created: Worker;
  try {
    // D'un seul tenant : c'est cette forme que Vite reconnaît pour émettre le fichier du worker.
    created = new Worker(new URL('./trackWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    inlineOnly = true;
    return null;
  }
  worker = created;
  answered = false;
  created.onmessage = (event: MessageEvent<TrackResponse>) => {
    if (worker === created) answered = true;
    const job = pending.get(event.data.id);
    if (!job) return;
    pending.delete(event.data.id);
    job.answer(event.data);
  };
  created.onerror = () => fail(created);
  created.onmessageerror = () => fail(created);
  return created;
};

/**
 * Lit et prépare un GPX (`prepare`, `core/prepareTrack.ts`) ou le résume (`summarize`, `summarizeGpx.ts`) hors du
 * fil de l'affichage. La promesse rend le même résultat que le calcul en ligne, ou est rejetée par une erreur de
 * même nom et même message, dans la langue de l'interface.
 */
export const runInWorker = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): Promise<TrackJobs[K]['result']> => {
  const target = currentWorker();
  if (!target) return runInline(kind, gpxText, options);
  return new Promise<TrackJobs[K]['result']>((resolve, reject) => {
    const id = nextId++;
    const redo = () => {
      runInline(kind, gpxText, options).then(resolve, reject);
    };
    pending.set(id, {
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
      pending.delete(id);
      redo();
    }
  });
};

/** Oublie le worker (tests) : le prochain appel relit `Worker` et en crée un. Les demandes en cours sont refaites en ligne. */
export const resetTrackWorker = (): void => {
  const current = worker;
  worker = null;
  inlineOnly = false;
  answered = false;
  current?.terminate();
  const waiting = [...pending.values()];
  pending.clear();
  for (const job of waiting) job.redo();
};
