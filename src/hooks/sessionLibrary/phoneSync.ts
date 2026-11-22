import { useSyncExternalStore } from 'react';
import { t } from '../../core/i18n';
import type { SyncOutcome } from '../../library/syncOutcome';
import {
  describeSyncQuestion, mergeSyncPasses, phoneArrivalText, syncHasChangedItems, type PhoneLinkChannel, type PhoneNotReady, type PhoneSyncResult,
  type SyncQuestion,
} from '../../library/syncReport';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import {
  listPhoneFiles, phoneCanWrite, phoneChannel, phoneIsRecording, phoneListsRoutes, phoneMemoryFolder, phoneSafetyCopy, phoneState, type PhoneState,
} from '../../platform/phoneCable';
import { wirelessAvailable, wirelessState } from '../../platform/wirelessPhone';
import { createStore } from '../createStore';
import {
  synchronizePhone, type SyncDeletionKey, type SyncHeldAnswer, type SyncLockOptions, type SyncRouteDeletionKey,
} from './sync';

/**
 * « Synchroniser », dans le programme Windows : la couche du bouton, sous la fenêtre. Elle cherche le téléphone (relié
 * par le Wi-Fi, sinon branché par câble), ouvre son dossier `Documents/Gtracker` comme un dossier mémoire, et lance la
 * synchronisation des deux appareils (`synchronizePhone`), dont elle publie les étapes hors des composants
 * (`usePhoneSync`) : la fenêtre peut être fermée et rouverte pendant la synchronisation, qui continue.
 *
 * - Le téléphone n'est écrit que si son canal le sait (`phoneCanWrite` : le câble, ou le Wi-Fi d'un téléphone à jour
 *   qui n'enregistre pas) ; sinon la synchronisation ne fait que la moitié de l'ordinateur, et dit ce qui attend la
 *   mise à jour du téléphone, ou que le téléphone enregistre (`phoneIsRecording`).
 * - À la première synchronisation d'un téléphone qu'on peut écrire, la coquille copie d'abord les deux dossiers
 *   (`phoneSafetyCopy`) ; si la copie échoue, rien n'est fait.
 * - Une question (suppressions en nombre, sessions de la corbeille encore sur le téléphone) arrête sur l'étape
 *   `question`. Ses deux réponses la règlent (`answerPhoneSyncQuestion`) : la synchronisation repart sans repasser par
 *   la recherche du téléphone, et son compte rendu reprend ce que la première passe avait fait. Fermer la question ne
 *   décide rien (`leavePhoneSyncQuestion`) : le compte rendu de ce qui est fait le dit, et elle revient.
 * - Une session, un itinéraire ou un fichier changé pendant l'opération est repris une fois, seul, avant le compte
 *   rendu : il n'est dit que s'il a encore changé.
 * - Un téléphone relié qui se présente par le sans-fil ne déclenche rien : une ligne invite à « Synchroniser »
 *   (`notePhoneArrival`, `usePhoneArrivalNote`).
 */

/** Chemin du dossier lu sur le téléphone, retenu par la base : un autre chemin ferait une paire neuve. */
const PHONE_FOLDER_PATH = 'Documents/Gtracker';

type SyncedResult = Extract<PhoneSyncResult, { kind: 'synced' }>;

/** Où en est la synchronisation ; `phone` : le nom du téléphone, `channel` : par où il est lu. */
export type PhoneSyncStep =
  | { step: 'idle' }
  | { step: 'searching' }
  | { step: 'comparing'; phone: string; channel: PhoneLinkChannel }
  /** Copie de sécurité des deux dossiers, avant une première synchronisation. */
  | { step: 'safetyCopy'; phone: string; channel: PhoneLinkChannel }
  /** `done` fichiers de sessions traités sur `total` ; `first` : première synchronisation, rien n'est supprimé. */
  | { step: 'copying'; phone: string; channel: PhoneLinkChannel; done: number; total: number; first: boolean }
  /** Une question attend sa réponse ; `result` : ce qui a déjà été fait. */
  | { step: 'question'; question: SyncQuestion; result: SyncedResult }
  /**
   * L'issue ; `unanswered` : la question fermée sans réponse, ou dont la réponse n'a pas pu s'appliquer, que le compte
   * rendu rappelle ; `answerFailed` : la passe de cette réponse, qui n'a rien pu faire (le compte rendu dit pourquoi).
   */
  | { step: 'over'; result: PhoneSyncResult; unanswered?: SyncQuestion; answerFailed?: PhoneSyncResult };

/**
 * Réponse à une question : aux suppressions en nombre, `keepAll` (« Tout garder » : chacune est défaite là où elle a
 * été faite) ou `deleteBoth` (« Supprimer des deux côtés ») ; aux sessions de la corbeille encore sur le téléphone,
 * `keepHeld` (« Les garder » : elles sortent de la corbeille) ou `removeHeld` (« Les retirer du téléphone »).
 */
export type PhoneSyncAnswer = 'keepAll' | 'deleteBoth' | 'keepHeld' | 'removeHeld';

/** La ligne dite quand un téléphone relié se présente par le sans-fil. */
export interface PhoneArrivalNote {
  text: string;
  /** Heure à laquelle elle a été posée, en millisecondes depuis 1970 : le composant la laisse s'effacer. */
  atMs: number;
}

const progress = createStore<PhoneSyncStep>({ step: 'idle' });
const arrival = createStore<PhoneArrivalNote | null>(null);

/** Étape de la synchronisation, lue hors d'un composant. */
export const phoneSyncStep = progress.get;

/** Étape de la synchronisation, suivie par le composant. */
export const usePhoneSync = (): PhoneSyncStep => useSyncExternalStore(progress.subscribe, progress.get);

/** Ligne de la dernière arrivée, lue hors d'un composant. */
export const phoneArrivalNote = arrival.get;

/** Ligne de la dernière arrivée, suivie par le composant ; `null` quand il n'y en a pas. */
export const usePhoneArrivalNote = (): PhoneArrivalNote | null => useSyncExternalStore(arrival.subscribe, arrival.get);

/** Efface la ligne de l'arrivée (elle s'est affichée assez longtemps, ou une synchronisation commence). */
export const clearPhoneArrivalNote = (): void => arrival.set(null);

/** Ce que permet une passe : les réponses déjà données pendant cette synchronisation, et l'enregistreur de l'appelant. */
interface RunOptions {
  recording?: () => boolean;
  confirmDeletions?: boolean;
  /** Les suppressions que la question a montrées, seules couvertes par « Supprimer des deux côtés ». */
  confirmedDeletions?: SyncDeletionKey[];
  /** Les suppressions d'itinéraires que la même question a montrées. */
  confirmedRouteDeletions?: SyncRouteDeletionKey[];
  /** « Tout garder » : les suppressions montrées, que l'utilisateur refuse. */
  keepRefused?: { sessions: SyncDeletionKey[]; routes: SyncRouteDeletionKey[] };
  heldOnPhone?: SyncHeldAnswer;
  /** Les sessions de la corbeille que la question a montrées, seules à retirer du téléphone. */
  heldToRemove?: number[];
  /** Les itinéraires de la corbeille que la même question a montrés (leurs identités). */
  heldRoutesToRemove?: string[];
  /** « Les garder » : les sessions et les itinéraires de la corbeille que la question a montrés. */
  heldToKeep?: number[];
  heldRoutesToKeep?: string[];
}

/** Comment une passe part : `resume`, téléphone déjà trouvé, sans repasser par sa recherche ; `previous`, ce qu'avait fait la passe d'avant. */
interface LaunchHow {
  resume?: { phone: string; channel: PhoneLinkChannel };
  previous?: SyncOutcome;
  /** La question à laquelle cette passe répond, et ce qui avait été fait : rendus tels quels si la réponse ne s'applique pas. */
  answering?: { question: SyncQuestion; result: SyncedResult; before: RunOptions };
}

/** Vrai si une passe n'a rien pu faire : téléphone pas prêt, panne avant la synchronisation, ou synchronisation refusée. */
const passFailed = (pass: PhoneSyncResult): boolean => pass.kind !== 'synced' || pass.outcome.refusal !== null;

/** Les réponses de la synchronisation en cours ou de la dernière, reprises par la passe suivante. */
let current: RunOptions = {};

let running: Promise<void> | null = null;

/** Où en est le sans-fil du PC, pour le message d'un téléphone absent ; `undefined` quand il n'y a rien à en dire. */
const wirelessMode = async (): Promise<'listening' | 'off' | undefined> => {
  if (!wirelessAvailable()) return undefined;
  try {
    const state = await wirelessState();
    if (!state.actif) return 'off';
    return state.ecoute ? 'listening' : undefined;
  } catch {
    return undefined;
  }
};

const notReady = async (state: Exclude<PhoneState, { etat: 'pret' }>): Promise<PhoneNotReady> => {
  if (state.etat === 'adbIntrouvable') return { kind: 'tool-missing', folder: state.dossier };
  if (state.etat !== 'absent') return { kind: 'phone', state: state.etat };
  const wireless = await wirelessMode();
  return wireless ? { kind: 'phone', state: 'absent', wireless } : { kind: 'phone', state: 'absent' };
};

/** Une passe : état du téléphone, listage, puis la synchronisation. `resume` : l'étape « Comparaison » n'est pas montrée. */
const synchronize = async (options: RunOptions, resume: boolean): Promise<PhoneSyncResult> => {
  let channel: PhoneLinkChannel | undefined;
  try {
    const state = await phoneState();
    if (state.etat !== 'pret') return await notReady(state);
    const phone = state.nom;
    const link: PhoneLinkChannel = phoneChannel(state);
    channel = link;
    if (!resume) progress.set({ step: 'comparing', phone, channel: link });
    let listed: Awaited<ReturnType<typeof listPhoneFiles>>;
    try {
      listed = await listPhoneFiles();
    } catch (err) {
      // Parti entre l'état et le listage : l'état du moment, plutôt qu'une panne.
      const now = await phoneState().catch(() => null);
      if (now && now.etat !== 'pret') return await notReady(now);
      throw err;
    }
    if (listed === null) return { kind: 'no-phone-folder', phone };
    let first = false;
    const lock: SyncLockOptions = {
      phoneWritable: phoneCanWrite(state),
      phoneRecording: phoneIsRecording(state),
      phonePath: PHONE_FOLDER_PATH,
      recording: options.recording,
      confirmDeletions: options.confirmDeletions,
      confirmedDeletions: options.confirmedDeletions,
      confirmedRouteDeletions: options.confirmedRouteDeletions,
      keepRefused: options.keepRefused,
      heldOnPhone: options.heldOnPhone,
      heldToRemove: options.heldToRemove,
      heldRoutesToRemove: options.heldRoutesToRemove,
      heldToKeep: options.heldToKeep,
      heldRoutesToKeep: options.heldRoutesToKeep,
      // Sans listage d'`itineraires/` (téléphone ou coquille plus anciens), les itinéraires ne sont pas touchés.
      phoneRoutes: phoneListsRoutes(state),
      beforeWrites: () => {
        progress.set({ step: 'safetyCopy', phone, channel: link });
        return phoneSafetyCopy();
      },
      onPlanned: (_plan, reason) => {
        // Sans écriture du téléphone, il n'a pas d'identifiant et chaque passe serait « la première » : rien à annoncer.
        first = reason !== null && lock.phoneWritable === true;
        progress.set({ step: 'copying', phone, channel: link, done: 0, total: 0, first });
      },
      onProgress: (done, total) => progress.set({ step: 'copying', phone, channel: link, done, total, first }),
    };
    const outcome: SyncOutcome = await synchronizePhone(phoneMemoryFolder(phone), lock);
    return { kind: 'synced', phone, channel: link, outcome };
  } catch (err) {
    return { kind: 'error', detail: nativeErrorMessage(err, t('erreur inconnue')), ...(channel ? { channel } : {}) };
  }
};

/** L'issue d'une passe, jointe à ce qu'avait fait la passe d'avant quand les deux ont synchronisé. */
const joined = (previous: SyncOutcome | undefined, pass: PhoneSyncResult): PhoneSyncResult =>
  previous && pass.kind === 'synced' ? { ...pass, outcome: mergeSyncPasses(previous, pass.outcome) } : pass;

/**
 * Une synchronisation, de la recherche du téléphone (ou de la reprise, `how.resume`) à la question ou au compte rendu.
 * Ce qui a changé pendant l'opération est repris par une seconde passe, une seule fois ; si elle ne trouve plus le
 * téléphone, le compte rendu de la première reste. Une réponse qui ne peut pas s'appliquer (téléphone parti,
 * synchronisation refusée) rend le compte rendu de ce qui était fait, la raison (`answerFailed`), et la question
 * laissée sans réponse, à laquelle « Répondre » revient.
 */
const launch = (options: RunOptions, how: LaunchHow = {}): Promise<void> => {
  current = options;
  progress.set(how.resume
    ? { step: 'copying', phone: how.resume.phone, channel: how.resume.channel, done: 0, total: 0, first: false }
    : { step: 'searching' });
  arrival.set(null);
  const run = async (): Promise<void> => {
    const pass = await synchronize(options, how.resume !== undefined);
    if (how.answering && passFailed(pass)) {
      // La réponse n'a rien réglé : la suivante repart des choix d'avant elle.
      current = how.answering.before;
      progress.set({ step: 'over', result: how.answering.result, unanswered: how.answering.question, answerFailed: pass });
      return;
    }
    let result = joined(how.previous, pass);
    let question = result.kind === 'synced' ? describeSyncQuestion(result.outcome) : null;
    if (question === null && result.kind === 'synced' && pass.kind === 'synced' && syncHasChangedItems(pass.outcome)) {
      progress.set({ step: 'copying', phone: result.phone, channel: result.channel, done: 0, total: 0, first: false });
      const again = await synchronize(options, true);
      if (again.kind === 'synced') {
        const merged: SyncedResult = { ...again, outcome: mergeSyncPasses(result.outcome, again.outcome) };
        result = merged;
        question = describeSyncQuestion(merged.outcome);
      }
    }
    progress.set(question && result.kind === 'synced' ? { step: 'question', question, result } : { step: 'over', result });
  };
  running = run().finally(() => {
    running = null;
  });
  return running;
};

/**
 * Lance « Synchroniser » ; pendant qu'elle tourne, un nouvel appel rend la même. `recording` : vrai pendant un
 * enregistrement (l'enregistreur dépend de la bibliothèque : l'appelant le passe), qui fait refuser la synchronisation.
 */
export const synchronizeWithPhone = (options: { recording?: () => boolean } = {}): Promise<void> =>
  running ?? launch({ recording: options.recording });

/**
 * Répond à la question posée (étape `question`) : la synchronisation repart avec ce que la réponse règle, en gardant
 * les réponses déjà données (une confirmation donnée avant « Les retirer du téléphone » ne couvre pas ces retraits,
 * qui peuvent rouvrir le garde-fou). Chaque réponse ne vaut que pour ce que sa question a montré : l'exécutant reçoit
 * leur liste, et une suppression apparue depuis reste soumise au garde-fou. Sans effet hors de l'étape `question`, ou
 * pour une réponse qui n'est pas celle de la question posée.
 */
export const answerPhoneSyncQuestion = (answer: PhoneSyncAnswer): Promise<void> => {
  const step = progress.get();
  if (step.step !== 'question' || running) return running ?? Promise.resolve();
  const { question, result } = step;
  const forGuard = answer === 'keepAll' || answer === 'deleteBoth';
  if (forGuard !== (question.kind === 'guard')) return Promise.resolve();
  const how: LaunchHow = { resume: { phone: result.phone, channel: result.channel }, previous: result.outcome, answering: { question, result, before: current } };
  const sessions = question.sessions.map((s) => ({ startMs: s.startMs, side: s.side }));
  const routes = question.routes.map((r) => ({ id: r.id, side: r.side }));
  switch (answer) {
    case 'keepAll':
      return launch({
        ...current, keepRefused: { sessions, routes }, confirmDeletions: false, confirmedDeletions: undefined, confirmedRouteDeletions: undefined,
      }, how);
    case 'deleteBoth':
      return launch({ ...current, confirmDeletions: true, confirmedDeletions: sessions, confirmedRouteDeletions: routes }, how);
    case 'keepHeld':
      return launch({
        ...current, heldOnPhone: 'keep', heldToKeep: question.sessions.map((s) => s.startMs), heldRoutesToKeep: question.routes.map((r) => r.id),
        heldToRemove: undefined, heldRoutesToRemove: undefined,
      }, how);
    default:
      // Des retraits qui dépassent le garde-fou rouvrent sa fenêtre : une confirmation donnée avant ne les couvre pas.
      return launch({
        ...current, heldOnPhone: 'remove', heldToRemove: question.sessions.map((s) => s.startMs), heldRoutesToRemove: question.routes.map((r) => r.id),
        heldToKeep: undefined, heldRoutesToKeep: undefined, confirmDeletions: false, confirmedDeletions: undefined, confirmedRouteDeletions: undefined,
      }, how);
  }
};

/**
 * La question est fermée sans réponse : rien n'est décidé. L'étape passe au compte rendu de ce qui est fait, qui
 * rappelle ce qui attend la réponse (`unanswered`) ; la prochaine synchronisation repose la question.
 */
export const leavePhoneSyncQuestion = (): void => {
  const step = progress.get();
  if (step.step === 'question') progress.set({ step: 'over', result: step.result, unanswered: step.question });
};

/** Revient à la question fermée sans réponse (« Répondre » du compte rendu). Sans effet sans question laissée. */
export const reopenPhoneSyncQuestion = (): void => {
  const step = progress.get();
  if (step.step === 'over' && step.unanswered && step.result.kind === 'synced' && !running) {
    progress.set({ step: 'question', question: step.unanswered, result: step.result });
  }
};

/**
 * Un téléphone relié se présente par le sans-fil : rien ne se copie seul, une ligne invite à « Synchroniser »
 * (`usePhoneArrivalNote`). Rien n'est dit pendant une synchronisation.
 */
export const notePhoneArrival = (): void => {
  if (running) return;
  arrival.set({ text: phoneArrivalText(), atMs: Date.now() });
};
