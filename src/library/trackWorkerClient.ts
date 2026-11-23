import { t } from '../core/i18n';
import type { FitConversion } from './fitToGpx';
import {
  errorFromJob, runTrackJob, type TrackJobKind, type TrackJobs, type TrackRequest, type TrackResponse,
} from './trackWorkerProtocol';

/**
 * Client des workers des traces : `runInWorker` envoie un calcul à un worker (`trackWorker.ts`) et rend sa
 * réponse. Deux files, chacune son worker, le même script lancé deux fois : « analyse » pour la trace d'une analyse
 * qu'on ouvre et ses calculs (`prepare`, `analyzeSailing`, `analyzeSurf`, `release` : la mémoire de la session ouverte
 * vit dans ce worker-là), « fond » pour les résumés, les vignettes et la conversion des fichiers de montre
 * et le tri des GPX reçus entre itinéraire et session (`summarize`, `colorTrack`, `convertFit`, `routeCheck`). Un worker traite
 * ses demandes dans l'ordre d'arrivée : sans cette séparation, l'analyse touchée attendrait derrière toutes les
 * vignettes déjà demandées. Chaque worker est créé à la première demande de sa file. S'il meurt, les demandes en cours
 * de sa file sont refaites en ligne et la suivante le recrée ; s'il meurt avant d'avoir répondu une fois (fichier
 * introuvable, worker refusé), sa file se calcule en ligne jusqu'au rechargement ; l'autre file n'en est pas
 * touchée. Sans `Worker` (tests, vieux WebView) ou si sa création lève, le calcul se fait en ligne, toujours de
 * façon asynchrone : un seul chemin pour l'appelant, mêmes chiffres (`runTrackJob`).
 *
 * La file « fond » a un délai (`FOND_JOB_TIMEOUT_MS`) : un fichier fabriqué pour occuper le lecteur y bloquerait
 * sinon, jusqu'au rechargement, les résumés, les vignettes et le rangement des enregistrements. À l'échéance, son
 * worker est arrêté, la demande la plus ancienne refusée, et les suivantes repartent dans l'ordre sur un worker neuf,
 * jamais en ligne, où la même demande figerait la page. Sans worker, pas de délai : un calcul en ligne ne s'arrête pas.
 */

interface PendingJob {
  /** La demande telle qu'envoyée : renvoyée à un worker neuf quand celui de sa file est arrêté à l'échéance. */
  request: TrackRequest;
  /** Rend la réponse du worker. */
  answer(response: TrackResponse): void;
  /** Refait le calcul en ligne : le worker est mort sans répondre. */
  redo(): void;
  /** Rejette la demande : le délai de sa file est passé. */
  refuse(error: Error): void;
}

/** Files des calculs, chacune servie par son worker. */
export type TrackQueue = 'analyse' | 'fond';

/** File de chaque calcul : l'analyse ouverte ne passe jamais derrière les calculs de fond. */
export const TRACK_QUEUE: Readonly<Record<TrackJobKind, TrackQueue>> = {
  prepare: 'analyse',
  analyzeSailing: 'analyse',
  analyzeSurf: 'analyse',
  release: 'analyse',
  summarize: 'fond',
  colorTrack: 'fond',
  convertFit: 'fond',
  routeCheck: 'fond',
};

/**
 * Délai accordé par la file « fond » à sa demande la plus ancienne, réarmé à chaque réponse. Le résumé d'une longue
 * session honnête (4 h à 5 points par seconde, 20 Mo de GPX) prend moins de deux secondes sur un ordinateur : un
 * téléphone lent a de la marge, et un fichier fabriqué pour occuper le lecteur est refusé au bout d'une minute.
 */
export const FOND_JOB_TIMEOUT_MS = 60_000;

/** Délai de chaque file, `null` : aucun. L'analyse ouverte n'en a pas : la page attend son propre calcul. */
const QUEUE_TIMEOUT_MS: Readonly<Record<TrackQueue, number | null>> = { analyse: null, fond: FOND_JOB_TIMEOUT_MS };

/** État d'une file : son worker, ses demandes en attente de réponse. */
interface QueueState {
  worker: Worker | null;
  /** Le worker courant a répondu au moins une fois : sa mort n'est pas celle d'un worker qui ne démarre pas. */
  answered: boolean;
  /** Plus de worker pour cette file jusqu'au rechargement : sa création a levé, ou il est mort avant toute réponse. */
  inlineOnly: boolean;
  /** Demandes envoyées au worker, dans l'ordre d'envoi : la première est la plus ancienne. */
  pending: Map<number, PendingJob>;
  /** Délai de la file, `null` : aucun. */
  timeoutMs: number | null;
  /** Minuterie de la demande la plus ancienne, armée tant qu'une demande attend le worker. */
  deadline: ReturnType<typeof setTimeout> | null;
}

const newQueueState = (timeoutMs: number | null): QueueState => ({
  worker: null, answered: false, inlineOnly: false, pending: new Map(), timeoutMs, deadline: null,
});

const queues: Record<TrackQueue, QueueState> = { analyse: newQueueState(QUEUE_TIMEOUT_MS.analyse), fond: newQueueState(QUEUE_TIMEOUT_MS.fond) };
let nextId = 1;

/**
 * Messages d'erreur du calcul qui peuvent arriver à l'écran, indexés par leur texte français au caractère près. Le
 * worker n'a pas de dictionnaire : ses messages sortent toujours en français, et se traduisent ici, côté page, dans
 * la langue de l'interface. La traduction se lit à l'appel, pas au chargement du module, pour suivre la langue
 * posée. Une phrase changée dans le calcul se change ici aussi.
 */
const JOB_MESSAGES: Readonly<Record<string, () => string>> = {
  'Fichier GPX illisible : le XML est mal formé.': () => t('Fichier GPX illisible : le XML est mal formé.'),
  'fichier vide': () => t('fichier vide'),
  "ce n'est pas un fichier FIT": () => t("ce n'est pas un fichier FIT"),
};

/**
 * Raisons d'un fichier de montre refusé (`fitToGpx`), rendues dans le résultat de `convertFit` : écrites en français
 * par le worker, traduites ici comme `JOB_MESSAGES`. Une raison changée dans `fitToGpx.ts` se change ici aussi.
 */
const FIT_REFUSALS: Readonly<Record<string, () => string>> = {
  'fichier coupé avant le premier point': () => t('fichier coupé avant le premier point'),
  'aucune position dans ce fichier (tapis, salle) : pas de trace à ranger': () => t('aucune position dans ce fichier (tapis, salle) : pas de trace à ranger'),
  'trop de points pour une seule session : fichier refusé': () => t('trop de points pour une seule session : fichier refusé'),
};

/** Erreur du calcul dans la langue de l'interface, même nom ; tout autre message, tel quel. */
const inPageLanguage = (error: unknown): unknown => {
  if (!(error instanceof Error) || !Object.hasOwn(JOB_MESSAGES, error.message)) return error;
  const translated = new Error(JOB_MESSAGES[error.message]());
  translated.name = error.name;
  return translated;
};

/** Résultat rendu par le worker, dans la langue de l'interface : la raison d'un fichier de montre refusé ; tout autre, tel quel. */
const resultInPageLanguage = (kind: TrackJobKind, result: TrackJobs[TrackJobKind]['result']): TrackJobs[TrackJobKind]['result'] => {
  if (kind !== 'convertFit') return result;
  const fit = result as FitConversion;
  return fit.kind === 'refused' && Object.hasOwn(FIT_REFUSALS, fit.reason) ? { ...fit, reason: FIT_REFUSALS[fit.reason]() } : fit;
};

/**
 * Calcul en ligne, rendu par une promesse résolue au tour suivant : jamais par une minuterie (les tests de la
 * file des résumés comptent les leurs).
 */
const runInline = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): Promise<TrackJobs[K]['result']> =>
  Promise.resolve().then(() => runTrackJob(kind, gpxText, options)).catch((error: unknown) => Promise.reject(inPageLanguage(error)));

/** Arrête la minuterie d'une file. */
const clearDeadline = (queue: QueueState): void => {
  if (queue.deadline !== null) clearTimeout(queue.deadline);
  queue.deadline = null;
};

/** Arme, de nouveau, le délai de la demande la plus ancienne d'une file qui en a un ; rien si plus rien n'attend. */
const armDeadline = (queue: QueueState): void => {
  clearDeadline(queue);
  if (queue.timeoutMs === null || queue.pending.size === 0) return;
  queue.deadline = setTimeout(() => expire(queue), queue.timeoutMs);
};

/** Demandes en attente d'une file, retirées et refaites en ligne. */
const redoPending = (queue: QueueState): void => {
  clearDeadline(queue);
  const waiting = [...queue.pending.values()];
  queue.pending.clear();
  for (const job of waiting) job.redo();
};

/** Envoie une demande au worker d'une file ; refaite en ligne si ses options ne se clonent pas. */
const post = (queue: QueueState, target: Worker, job: PendingJob): void => {
  try {
    target.postMessage(job.request);
  } catch {
    // Options qu'on ne sait pas cloner : ce calcul-là se fait en ligne.
    queue.pending.delete(job.request.id);
    job.redo();
  }
};

/** Worker d'une file mort : oublié, et ce qu'il devait rendre refait en ligne. */
const fail = (queue: QueueState, dead: Worker): void => {
  if (queue.worker !== dead) return;
  queue.worker = null;
  dead.terminate();
  if (!queue.answered) queue.inlineOnly = true;
  redoPending(queue);
};

/**
 * Délai passé : le worker de la file est arrêté, sa demande la plus ancienne refusée, et les suivantes renvoyées dans
 * l'ordre à un worker neuf. Si ce worker ne peut pas être créé, la file passe en ligne comme sans `Worker`.
 */
const expire = (queue: QueueState): void => {
  queue.deadline = null;
  const stuck = queue.worker;
  const head = queue.pending.values().next().value;
  if (!stuck || !head) return;
  queue.pending.delete(head.request.id);
  queue.worker = null;
  queue.answered = false;
  stuck.terminate();
  head.refuse(new Error(t('lecture trop longue : fichier refusé')));
  if (queue.pending.size === 0) return;
  const fresh = currentWorker(queue);
  if (!fresh) {
    redoPending(queue);
    return;
  }
  for (const job of [...queue.pending.values()]) post(queue, fresh, job);
  armDeadline(queue);
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
    // Réponse tardive d'un worker remplacé (mort, arrêté à l'échéance) : ses demandes ont été refaites ou renvoyées.
    if (queue.worker !== created) return;
    queue.answered = true;
    const job = queue.pending.get(event.data.id);
    if (!job) return;
    queue.pending.delete(event.data.id);
    armDeadline(queue);
    job.answer(event.data);
  };
  created.onerror = () => fail(queue, created);
  created.onmessageerror = () => fail(queue, created);
  return created;
};

/**
 * Lit et prépare un GPX (`prepare`, `core/prepareTrack.ts`), le résume (`summarize`, `summarizeGpx.ts`), en tire
 * la trace colorée d'une vignette (`colorTrack`, `sessionTrack.ts`) ou convertit un fichier de montre (`convertFit`,
 * `fitToGpx.ts`) hors du fil de l'affichage, dans la file du
 * calcul (`TRACK_QUEUE`). La promesse rend le même résultat que le calcul en ligne, ou est rejetée par une erreur de
 * même nom et même message, dans la langue de l'interface. Analyse de la session ouverte (`analyzeSailing`,
 * `analyzeSurf`) de même ; `release` vide sa mémoire sans jamais créer de worker. Une demande de la file « fond »
 * restée sans réponse au-delà de son délai est rejetée par « lecture trop longue : fichier refusé ».
 */
export const runInWorker = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): Promise<TrackJobs[K]['result']> => {
  const queue = queues[TRACK_QUEUE[kind]];
  if (kind === 'release') {
    // La trace a pu être gardée des deux côtés (un `prepare` refait en ligne, worker mort) : la mémoire en ligne est
    // toujours vidée, celle du worker s'il vit ; jamais un worker créé pour être vidé.
    const inline = runInline(kind, gpxText, options);
    if (!queue.worker) return inline;
    return Promise.all([inline, send(queue, queue.worker, kind, gpxText, options)]).then(() => null as TrackJobs[K]['result']);
  }
  const target = currentWorker(queue);
  if (!target) return runInline(kind, gpxText, options);
  return send(queue, target, kind, gpxText, options);
};

/** Envoie un calcul au worker d'une file et rend sa réponse ; refait en ligne s'il meurt ou si les options ne se clonent pas. */
const send = <K extends TrackJobKind>(
  queue: QueueState, target: Worker, kind: K, gpxText: string, options: TrackJobs[K]['options']
): Promise<TrackJobs[K]['result']> =>
  new Promise<TrackJobs[K]['result']>((resolve, reject) => {
    const job: PendingJob = {
      request: { id: nextId++, kind, gpxText, options } as TrackRequest,
      answer: (response) => {
        if ('error' in response) reject(inPageLanguage(errorFromJob(response.error)));
        // La réponse à la demande `id` est celle de son calcul : TypeScript ne relie pas l'identifiant au type.
        else resolve(resultInPageLanguage(kind, response.result) as TrackJobs[K]['result']);
      },
      redo: () => {
        runInline(kind, gpxText, options).then(resolve, reject);
      },
      refuse: reject,
    };
    queue.pending.set(job.request.id, job);
    post(queue, target, job);
    if (queue.deadline === null) armDeadline(queue);
  });

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
