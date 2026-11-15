import { t } from '../../core/i18n';
import type { RecordingProfile } from '../../core/sportProfiles';
import { armBeltWatch, armGpsWatch, disarmBeltWatch, disarmGpsWatch, onBeltLost, onGpsLost } from '../../platform/beeper';
import {
  RECORDING_BELT_HOLDER, beltState, holdBelt, retryBelt, subscribeBeltState, subscribeHeartRate, type HeartRateBelt,
} from '../../platform/heartRate';
import {
  START_GPS_WATCH, beltWatchSettings, gpsWatchOnExpired, gpsWatchOnFix, gpsWatchOnPause, watchesGps, type GpsWatchState, type GpsWatchStep,
} from '../../recording/gpsWatch';
import { refreshGpsAssistance } from '../../platform/location';
import { nativeErrorMessage } from '../../platform/nativeMessages';
import { openLocationSettings } from '../../platform/permissions';
import { readableBpm } from '../../recording/heartRate';
import { journalBeltLine, journalGpsLine, type JournalBeltEvent, type JournalGpsEvent } from '../../recording/journal';
import { GPS_RETRY_FEEDBACK_MS } from '../../recording/recordingRetry';
import { flushJournal, queueJournalLines } from './journalBuffer';
import { exclusive, joinMessages, session, setState, state } from './store';

/**
 * Veilles de l'enregistrement en cours : le GPS qui se tait, la ceinture qui ne mesure plus (machine
 * `recording/gpsWatch.ts`, minuteur natif), et la ceinture elle-même, tenue jusqu'à l'arrêt.
 */

/**
 * État des deux veilles, partagé par les parties de l'enregistreur : un seul objet, modifié en place, car une
 * variable importée ne se réaffecte pas.
 */
interface Watches {
  /** Veille du GPS de l'enregistrement en cours. */
  gps: GpsWatchState;
  /** Vrai si l'enregistrement en cours veille sur son GPS (`watchesGps`), fixé au départ comme les options de la source. */
  gpsOn: boolean;
  /** Désabonnement de l'échéance du minuteur ; `null` tant que personne n'y est abonné. */
  offGpsLost: (() => void) | null;
  /** Veille de la ceinture de l'enregistrement en cours. */
  belt: GpsWatchState;
  /** Vrai dès qu'une ceinture est tenue par l'enregistrement. */
  beltOn: boolean;
  /** Désabonnement de l'échéance du minuteur ; `null` tant que personne n'y est abonné. */
  offBeltLost: (() => void) | null;
}

export const watch: Watches = {
  gps: START_GPS_WATCH,
  gpsOn: false,
  offGpsLost: null,
  belt: START_GPS_WATCH,
  beltOn: false,
  offBeltLost: null,
};

/** Alerte de la page Enregistrer quand le GPS se tait. */
export const GPS_LOST_ERROR = t("GPS perdu : plus aucune position. L'enregistrement continue, la trace reprendra au retour du GPS.");

/** L'alerte avec « GPS perdu » ajouté à la suite de ce qu'elle disait déjà. */
const withGpsLost = (error: string | null): string => (error ? `${withoutGpsLost(error)} ${GPS_LOST_ERROR}` : GPS_LOST_ERROR);

/** L'alerte sans « GPS perdu » : ce qu'elle disait avant, ou après (un message ajouté entre-temps), est gardé ; `null` s'il ne reste rien. */
export const withoutGpsLost = (error: string | null): string | null => {
  if (error === null) return null;
  const rest = error.replace(` ${GPS_LOST_ERROR}`, '').replace(GPS_LOST_ERROR, '').trim();
  return rest === '' ? null : rest;
};

/**
 * Applique un pas de la veille : minuteur, et « GPS perdu » ajouté à l'alerte
 * ou retiré seul, sans effacer ce qu'elle disait déjà (notifications
 * refusées, capteurs, erreur de la source).
 */
export const applyGpsWatch = (step: GpsWatchStep): void => {
  watch.gps = step.state;
  if (step.disarm) void disarmGpsWatch().catch(() => {});
  if (step.armMs !== null) void armGpsWatch(step.armMs).catch(() => {});
  if (step.lost) setState({ gpsLost: true, error: withGpsLost(state.error) });
  else if (step.cleared && state.gpsLost) setState({ gpsLost: false, error: withoutGpsLost(state.error) });
};

/** Échéance du minuteur : revérifiée par la veille (une position a pu la repousser entre-temps). */
const onGpsWatchExpired = (): void => {
  if (!watch.gpsOn || (state.status !== 'starting' && state.status !== 'recording' && state.status !== 'paused')) return;
  applyGpsWatch(gpsWatchOnExpired(watch.gps, Date.now()));
};

/** Fin de « nouvelle tentative… » du GPS ; `null` hors de ce retour. */
let gpsRetryTimer: ReturnType<typeof setTimeout> | null = null;

/** Arrête la veille de l'enregistrement : minuteur désarmé, machine remise au départ, « nouvelle tentative… » oublié. */
export const stopGpsWatch = (): void => {
  if (watch.gpsOn) void disarmGpsWatch().catch(() => {});
  watch.gpsOn = false;
  watch.gps = START_GPS_WATCH;
  if (gpsRetryTimer !== null) clearTimeout(gpsRetryTimer);
  gpsRetryTimer = null;
};

/** Écrit une ligne du GPS au journal, tout de suite. */
const journalGps = (what: JournalGpsEvent): void => {
  queueJournalLines(journalGpsLine(Date.now(), what));
  void flushJournal();
};

/**
 * « Réessayer » du GPS pendant l'enregistrement : le téléphone recharge ses données d'aide au GPS
 * (`refreshGpsAssistance`), rien d'autre n'est touché (service, trace, notification). « nouvelle tentative… » reste
 * affiché `GPS_RETRY_FEEDBACK_MS`, même si la demande n'a rien pu envoyer (navigateur) : un retour visible à l'appui. Un
 * appui pendant ce retour est ignoré. L'appui et son résultat laissent chacun une ligne au journal.
 */
export const retryRecordingGps = async (): Promise<void> => {
  if (!recordingNow() || state.gpsRetrying) return;
  journalGps('retry');
  setState({ gpsRetrying: true });
  gpsRetryTimer = setTimeout(() => {
    gpsRetryTimer = null;
    if (state.gpsRetrying) setState({ gpsRetrying: false });
  }, GPS_RETRY_FEEDBACK_MS);
  const sent = await refreshGpsAssistance();
  if (recordingNow()) journalGps(sent ? 'assisted' : 'unassisted');
};

/** « Activer la localisation » : le réglage d'Android s'ouvre, l'enregistrement continue ; une ligne au journal. */
export const openRecordingLocationSettings = async (): Promise<void> => {
  if (!recordingNow()) return;
  journalGps('settings');
  await openLocationSettings().catch(() => undefined);
};

/**
 * Veille du GPS d'une session qui démarre, ou qui reprend d'un journal relu : remise au départ, puis allumée
 * selon le réglage de la session ; l'échéance du minuteur n'est écoutée qu'une fois.
 */
export const startGpsWatchFor = (profile: RecordingProfile): void => {
  stopGpsWatch();
  watch.gpsOn = watchesGps(profile, true);
  watch.offGpsLost ??= onGpsLost(onGpsWatchExpired);
};

/** Message de la perte de la fréquence cardiaque, ajouté à l'alerte comme « GPS perdu ». */
export const BELT_LOST_ERROR = t("Fréquence cardiaque perdue : plus aucune mesure de la ceinture. L'enregistrement continue, elle reprendra à son retour.");

/** L'alerte sans la perte de la FC : ce qu'elle disait par ailleurs est gardé ; `null` s'il ne reste rien. */
export const withoutBeltLost = (error: string | null): string | null => {
  if (error === null) return null;
  const rest = error.replace(` ${BELT_LOST_ERROR}`, '').replace(BELT_LOST_ERROR, '').trim();
  return rest === '' ? null : rest;
};

/** Applique un pas de la veille de la ceinture : minuteur, et message ajouté à l'alerte ou retiré seul. */
export const applyBeltWatch = (step: GpsWatchStep): void => {
  watch.belt = step.state;
  if (step.disarm) void disarmBeltWatch().catch(() => {});
  if (step.armMs !== null) void armBeltWatch(step.armMs).catch(() => {});
  if (step.lost) {
    const rest = withoutBeltLost(state.error);
    setState({ beltLost: true, error: rest ? `${rest} ${BELT_LOST_ERROR}` : BELT_LOST_ERROR });
  } else if (step.cleared && state.beltLost) {
    setState({ beltLost: false, error: withoutBeltLost(state.error) });
  }
};

/** Échéance du minuteur de la ceinture : revérifiée par la veille (une mesure a pu la repousser entre-temps). */
const onBeltWatchExpired = (): void => {
  if (!watch.beltOn || (state.status !== 'starting' && state.status !== 'recording' && state.status !== 'paused')) return;
  applyBeltWatch(gpsWatchOnExpired(watch.belt, Date.now()));
};

/**
 * Arrête la veille de la ceinture : minuteur désarmé, machine remise au départ. Désarmé même sans veille en
 * cours : le minuteur natif survit à une chute de la page, et la ceinture peut n'avoir pas été reprise.
 */
export const stopBeltWatch = (): void => {
  void disarmBeltWatch().catch(() => {});
  watch.beltOn = false;
  watch.belt = START_GPS_WATCH;
};

/** Prend la ceinture pour l'enregistrement et suit ses mesures dans l'état. */
export const takeBelt = async (belt: HeartRateBelt, maxAgeS: number): Promise<void> => {
  wireBelt(await holdBelt(RECORDING_BELT_HOLDER, belt), maxAgeS);
};

/** Alerte d'une ceinture qui ne répond pas, au départ comme à la reprise : l'enregistrement continue sans elle. */
export const beltUnreachableError = (err: unknown): string =>
  t("Ceinture cardio injoignable : {detail}. L'enregistrement continue sans elle.", { detail: nativeErrorMessage(err, t('erreur inconnue')) });

/**
 * Retient la ceinture demandée par la session, même rendue ensuite : « Réessayer » et « Reprendre la ceinture » la
 * redemandent. `stopped` : l'utilisateur avait cessé de la chercher (journal relu), la page propose de la reprendre.
 */
export const rememberRecordingBelt = (belt: HeartRateBelt, maxAgeS: number, stopped = false): void => {
  session.recordingBelt = { belt, maxAgeS };
  if (stopped) setState({ beltAside: 'stopped' });
};

/**
 * Prend la ceinture comme `takeBelt`, sans jamais lever : si elle ne répond pas, elle est rendue, la tuile BPM
 * retirée, et l'alerte le dit (`beltUnreachableError`). L'enregistrement, départ ou reprise, continue sans elle ; la
 * ceinture reste retenue pour « Réessayer ».
 */
export const takeBeltOrWarn = async (belt: HeartRateBelt, maxAgeS: number): Promise<void> => {
  rememberRecordingBelt(belt, maxAgeS);
  session.beltError = null;
  try {
    await takeBelt(belt, maxAgeS);
  } catch (err) {
    releaseRecordingBelt();
    session.beltError = beltUnreachableError(err);
    setState({ heartRate: null, beltAside: 'failed', error: session.beltError });
  }
};

/** L'alerte sans le message de la ceinture injoignable : ce qu'elle disait par ailleurs est gardé ; `null` s'il ne reste rien. */
const withoutBeltError = (error: string | null): string | null => {
  const message = session.beltError;
  if (error === null || message === null) return error;
  const rest = error.replace(` ${message}`, '').replace(message, '').trim();
  return rest === '' ? null : rest;
};

/** Vrai pendant l'enregistrement, en cours ou en pause : les boutons de la ceinture n'agissent que là. */
const recordingNow = (): boolean => state.status === 'recording' || state.status === 'paused';

/** Numéro du dernier essai ou de la dernière reprise : seul le plus récent éteint « nouvelle tentative… ». */
let beltAttempt = 0;

/** Écrit une ligne de la ceinture au journal, tout de suite. */
const journalBelt = (what: JournalBeltEvent): void => {
  queueJournalLines(journalBeltLine(Date.now(), what));
  void flushJournal();
};

/**
 * « Reprendre la ceinture », après l'avoir laissée (injoignable, ou plus cherchée) : la ceinture de la session est
 * redemandée, le message de la ceinture injoignable retiré, et la veille de la FC repart de zéro, comme au départ (rien
 * avant la première mesure ; en pause manuelle, elle attend la reprise). En échec, le nouveau message remplace l'ancien.
 * Le journal le dit (`'asked'`) : une reprise après une chute de la page la redemande de nouveau. Prise dans la file des
 * commandes : un arrêt demandé pendant la prise l'attend, la ceinture ne peut pas être reprise après lui. Un
 * « Arrêter de chercher » appuyé pendant la prise l'emporte : la ceinture prise ensuite est rendue aussitôt, sans tuile
 * ni ligne au journal, et un échec ne ramène ni le message ni la proposition de réessayer.
 */
export const retakeRecordingBelt = exclusive(async (): Promise<void> => {
  const asked = session.recordingBelt;
  if (asked === null || !recordingNow() || state.beltRetrying) return;
  const mine = ++beltAttempt;
  releaseRecordingBelt();
  journalBelt('asked');
  setState({ beltRetrying: true, beltLost: false, error: withoutBeltError(withoutBeltLost(state.error)) });
  session.beltError = null;
  try {
    await takeBelt(asked.belt, asked.maxAgeS);
    if (beltAttempt !== mine) {
      // Abandonnée pendant la prise : l'abandon tient.
      releaseRecordingBelt();
      setState({ heartRate: null });
      return;
    }
    if (state.pausedReason === 'manual') applyBeltWatch(gpsWatchOnPause(watch.belt));
    setState({ beltAside: null });
  } catch (err) {
    releaseRecordingBelt();
    if (beltAttempt !== mine) return;
    journalBelt('failed');
    session.beltError = beltUnreachableError(err);
    setState({ heartRate: null, beltAside: 'failed', error: joinMessages(state.error, session.beltError) });
  } finally {
    if (beltAttempt === mine) setState({ beltRetrying: false });
  }
});

/**
 * « Réessayer » pendant l'enregistrement : la ceinture tenue est cherchée tout de suite par le téléphone, sans attendre
 * sa tentative suivante, puis ses essais ordinaires reprennent ; rien d'autre n'est touché. Une ceinture rendue
 * (injoignable) ou que le téléphone ne demande plus est reprise (`retakeRecordingBelt`). Un appui pendant un essai est
 * ignoré. L'appui et son résultat laissent chacun une ligne au journal.
 */
export const retryRecordingBelt = async (): Promise<void> => {
  if (!recordingNow() || state.beltRetrying || session.recordingBelt === null) return;
  const current = beltState();
  if (session.dropBelt === null || current === 'off' || current === 'unsupported') {
    await retakeRecordingBelt();
    return;
  }
  const mine = ++beltAttempt;
  journalBelt('retry');
  setState({ beltRetrying: true });
  let result: JournalBeltEvent;
  try {
    result = (await retryBelt()) ? 'found' : 'missed';
  } catch {
    result = 'failed';
  }
  // Abandonnée entre-temps : le résultat ne vaut plus, le journal finit sur l'abandon.
  if (recordingNow() && beltAttempt === mine) journalBelt(result);
  if (beltAttempt === mine) setState({ beltRetrying: false });
};

/** Suit dans l'état les mesures d'une ceinture tenue ; `release` la rend. */
export const wireBelt = (release: () => void, maxAgeS: number): void => {
  session.heartRateMaxAgeS = maxAgeS;
  watch.belt = START_GPS_WATCH;
  watch.beltOn = true;
  watch.offBeltLost ??= onBeltLost(onBeltWatchExpired);
  setState({ heartRate: { state: beltState(), bpm: null } });
  const offSample = subscribeHeartRate((sample) => {
    const bpm = readableBpm(sample);
    // Une ceinture décollée qui émet encore ne mesure plus : seule une mesure lisible repousse le minuteur.
    if (watch.beltOn && bpm !== null && session.currentProfile) applyBeltWatch(gpsWatchOnFix(watch.belt, Date.now(), beltWatchSettings(session.currentProfile)));
    if (state.heartRate && (state.heartRate.bpm !== bpm || state.heartRate.state !== beltState())) {
      setState({ heartRate: { state: beltState(), bpm } });
    }
  });
  const offState = subscribeBeltState((beltNow) => {
    if (state.heartRate) setState({ heartRate: { state: beltNow, bpm: beltNow === 'connected' ? state.heartRate.bpm : null } });
  });
  session.dropBelt = () => {
    offSample();
    offState();
    release();
  };
};

/** Rend la ceinture, s'il y en a une. */
export const releaseRecordingBelt = (): void => {
  session.dropBelt?.();
  session.dropBelt = null;
  session.heartRateMaxAgeS = null;
  stopBeltWatch();
};

/**
 * « Arrêter de chercher », ceinture perdue, jamais trouvée, sans mesure ou injoignable en route : l'enregistrement la
 * rend et continue sans cardio, tuile BPM, alerte de FC perdue (minuteur désarmé, son compris) et message de la
 * ceinture injoignable retirés. Plus rien ne la recherche : le greffon n'est plus demandé (fin de sa reprise seule),
 * la pause ne la reprend pas, et une reprise après une chute de la page ne la redemande pas, le journal le disant.
 * « Reprendre la ceinture » (`retakeRecordingBelt`) la redemande, comme « Continuer l'enregistrement » après une
 * application tuée.
 */
export const stopRecordingBeltSearch = (): void => {
  if (session.dropBelt === null && state.beltAside !== 'failed') return;
  if (state.status === 'idle' || state.status === 'stopping') return;
  releaseRecordingBelt();
  journalBelt('stopped');
  // Un essai encore en cours ne rallume pas « nouvelle tentative… » à sa fin.
  beltAttempt += 1;
  const error = withoutBeltError(withoutBeltLost(state.error));
  session.beltError = null;
  setState({ heartRate: null, beltLost: false, beltAside: 'stopped', beltRetrying: false, error });
};
