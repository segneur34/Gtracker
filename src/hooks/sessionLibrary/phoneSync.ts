import { useSyncExternalStore } from 'react';
import { t } from '../../core/i18n';
import type { SyncOutcome } from '../../library/syncOutcome';
import type { SyncHeldChoice } from '../../library/syncPlan';
import {
  describeSyncQuestion, phoneArrivalText, type PhoneLinkChannel, type PhoneNotReady, type PhoneSyncResult, type SyncQuestion,
} from '../../library/syncReport';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import {
  listPhoneFiles, phoneCanWrite, phoneChannel, phoneIsRecording, phoneListsRoutes, phoneMemoryFolder, phoneSafetyCopy, phoneState, type PhoneState,
} from '../../platform/phoneCable';
import { wirelessAvailable, wirelessState } from '../../platform/wirelessPhone';
import { createStore } from '../createStore';
import { synchronizePhone, type SyncDeletionKey, type SyncLockOptions, type SyncRouteDeletionKey } from './sync';

/**
 * « Synchroniser », dans le programme Windows : la couche du bouton, sous la fenêtre. Elle cherche le téléphone (relié
 * par le Wi-Fi, sinon branché par câble), ouvre son dossier `Documents/Gtracker` comme un dossier mémoire, et lance la
 * synchronisation des deux appareils (`synchronizePhone`), dont elle publie les étapes hors des composants
 * (`usePhoneSync`) : la fenêtre peut être fermée et rouverte pendant la synchronisation, qui continue.
 *
 * - Le téléphone n'est écrit que si son canal le sait (`phoneCanWrite` : le câble, ou le Wi-Fi d'un téléphone à jour
 *   qui n'enregistre pas) ; sinon la synchronisation ne fait que la moitié de l'ordinateur, et dit ce qui attend le
 *   câble ou la mise à jour du téléphone, ou que le téléphone enregistre (`phoneIsRecording`).
 * - À la première synchronisation d'un téléphone qu'on peut écrire, la coquille copie d'abord les deux dossiers
 *   (`phoneSafetyCopy`) ; si la copie échoue, rien n'est fait.
 * - Une question (garde-fou des suppressions, sessions de la corbeille encore sur le téléphone) arrête sur l'étape
 *   `question` ; la réponse (`answerPhoneSyncQuestion`) relance la synchronisation avec ce qu'elle permet, ou s'en tient
 *   à ce qui est fait.
 * - Un téléphone relié qui se présente par le sans-fil ne déclenche rien : une ligne invite à « Synchroniser »
 *   (`notePhoneArrival`, `usePhoneArrivalNote`).
 */

/** Chemin du dossier lu sur le téléphone, retenu par la base : un autre chemin ferait une paire neuve. */
const PHONE_FOLDER_PATH = 'Documents/Gtracker';

/** Où en est la synchronisation ; `phone` : le nom du téléphone, `channel` : par où il est lu. */
export type PhoneSyncStep =
  | { step: 'idle' }
  | { step: 'searching' }
  | { step: 'comparing'; phone: string; channel: PhoneLinkChannel }
  /** Copie de sécurité des deux dossiers, avant une première synchronisation. */
  | { step: 'safetyCopy'; phone: string; channel: PhoneLinkChannel }
  /** `done` fichiers de sessions traités sur `total` ; `first` : première synchronisation, rien n'est supprimé. */
  | { step: 'copying'; phone: string; channel: PhoneLinkChannel; done: number; total: number; first: boolean }
  /** Une question attend sa réponse ; `result` : ce qui a déjà été fait, montré si l'on s'en tient là. */
  | { step: 'question'; question: SyncQuestion; result: Extract<PhoneSyncResult, { kind: 'synced' }> }
  | { step: 'over'; result: PhoneSyncResult };

/**
 * Réponse à une question : au garde-fou, `withoutDeletions` (« Synchroniser sans rien supprimer »),
 * `confirmDeletions` (« Supprimer ces N sessions ») ou `cancel` ; aux sessions de la corbeille encore sur le
 * téléphone, `removeHeld` (« Retirer du téléphone ») ou `leave` (« Les laisser » : la question reviendra).
 */
export type PhoneSyncAnswer = 'withoutDeletions' | 'confirmDeletions' | 'cancel' | 'removeHeld' | 'leave';

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

/** Ce que permet la relance : les choix déjà faits pendant cette synchronisation, et l'enregistreur de l'appelant. */
interface RunOptions {
  recording?: () => boolean;
  withoutDeletions?: boolean;
  confirmDeletions?: boolean;
  /** Les suppressions que la question du garde-fou a montrées, seules couvertes par sa confirmation. */
  confirmedDeletions?: SyncDeletionKey[];
  /** Les suppressions d'itinéraires que la même question a montrées. */
  confirmedRouteDeletions?: SyncRouteDeletionKey[];
  heldOnPhone?: SyncHeldChoice;
  /** Les sessions de la corbeille que la question a montrées, seules à retirer du téléphone. */
  heldToRemove?: number[];
  /** Les itinéraires de la corbeille que la même question a montrés (leurs identités). */
  heldRoutesToRemove?: string[];
}

/** Les choix de la synchronisation en cours ou de la dernière, repris par une relance. */
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

const synchronize = async (options: RunOptions): Promise<PhoneSyncResult> => {
  let channel: PhoneLinkChannel | undefined;
  try {
    const state = await phoneState();
    if (state.etat !== 'pret') return await notReady(state);
    const phone = state.nom;
    const link: PhoneLinkChannel = phoneChannel(state);
    channel = link;
    progress.set({ step: 'comparing', phone, channel: link });
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
      withoutDeletions: options.withoutDeletions,
      confirmDeletions: options.confirmDeletions,
      confirmedDeletions: options.confirmedDeletions,
      confirmedRouteDeletions: options.confirmedRouteDeletions,
      heldOnPhone: options.heldOnPhone,
      heldToRemove: options.heldToRemove,
      heldRoutesToRemove: options.heldRoutesToRemove,
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

/** Une synchronisation, de la recherche du téléphone à la question ou au compte rendu. */
const launch = (options: RunOptions): Promise<void> => {
  current = options;
  progress.set({ step: 'searching' });
  arrival.set(null);
  running = synchronize(options)
    .then((result) => {
      const question = result.kind === 'synced' ? describeSyncQuestion(result.outcome) : null;
      progress.set(question && result.kind === 'synced' ? { step: 'question', question, result } : { step: 'over', result });
    })
    .finally(() => {
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
 * Répond à la question posée (étape `question`) : relance la synchronisation avec ce que la réponse permet, en gardant
 * les choix déjà faits (« Retirer du téléphone » puis le garde-fou confirmé retire encore ces sessions ; une
 * confirmation donnée avant « Retirer du téléphone » ne couvre pas ces retraits), ou s'en tient à
 * ce qui est fait et montre son compte rendu. Sans effet hors de l'étape `question`.
 */
export const answerPhoneSyncQuestion = (answer: PhoneSyncAnswer): Promise<void> => {
  const step = progress.get();
  if (step.step !== 'question' || running) return running ?? Promise.resolve();
  switch (answer) {
    case 'withoutDeletions':
      return launch({ ...current, withoutDeletions: true, confirmDeletions: false, confirmedDeletions: undefined, confirmedRouteDeletions: undefined });
    // Une réponse ne vaut que pour les sessions que sa question a montrées : l'exécutant reçoit leur liste, et si le
    // plan du moment en touche une autre, il ne supprime rien et la question revient.
    case 'confirmDeletions':
      return launch({
        ...current, confirmDeletions: true, withoutDeletions: false,
        confirmedDeletions: step.question.sessions.map((s) => ({ startMs: s.startMs, side: s.side })),
        confirmedRouteDeletions: step.question.routes.map((r) => ({ id: r.id, side: r.side })),
      });
    case 'removeHeld':
      // Des retraits qui dépassent le garde-fou rouvrent sa fenêtre : une confirmation donnée avant ne les couvre pas.
      return launch({
        ...current, heldOnPhone: 'remove', heldToRemove: step.question.sessions.map((s) => s.startMs),
        heldRoutesToRemove: step.question.routes.map((r) => r.id),
        confirmDeletions: false, confirmedDeletions: undefined, confirmedRouteDeletions: undefined,
      });
    default:
      progress.set({ step: 'over', result: step.result });
      return Promise.resolve();
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
