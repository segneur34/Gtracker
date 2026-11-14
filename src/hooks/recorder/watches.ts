import { errorMessage } from '../../core/basics';
import { t } from '../../core/i18n';
import type { RecordingProfile } from '../../core/sportProfiles';
import { armBeltWatch, armGpsWatch, disarmBeltWatch, disarmGpsWatch, onBeltLost, onGpsLost } from '../../platform/beeper';
import {
  RECORDING_BELT_HOLDER, beltState, holdBelt, subscribeBeltState, subscribeHeartRate, type HeartRateBelt,
} from '../../platform/heartRate';
import {
  START_GPS_WATCH, beltWatchSettings, gpsWatchOnExpired, gpsWatchOnFix, watchesGps, type GpsWatchState, type GpsWatchStep,
} from '../../recording/gpsWatch';
import { readableBpm } from '../../recording/heartRate';
import { journalBeltLine } from '../../recording/journal';
import { flushJournal, queueJournalLines } from './journalBuffer';
import { session, setState, state } from './store';

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

/** Arrête la veille de l'enregistrement : minuteur désarmé, machine remise au départ. */
export const stopGpsWatch = (): void => {
  if (watch.gpsOn) void disarmGpsWatch().catch(() => {});
  watch.gpsOn = false;
  watch.gps = START_GPS_WATCH;
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
  t("Ceinture cardio injoignable : {detail}. L'enregistrement continue sans elle.", { detail: errorMessage(err, t('erreur inconnue')) });

/**
 * Prend la ceinture comme `takeBelt`, sans jamais lever : si elle ne répond pas, elle est rendue, la tuile BPM
 * retirée, et l'alerte le dit (`beltUnreachableError`). L'enregistrement, départ ou reprise, continue sans elle.
 */
export const takeBeltOrWarn = async (belt: HeartRateBelt, maxAgeS: number): Promise<void> => {
  try {
    await takeBelt(belt, maxAgeS);
  } catch (err) {
    releaseRecordingBelt();
    setState({ heartRate: null, error: beltUnreachableError(err) });
  }
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
 * « Arrêter de chercher », ceinture perdue ou jamais trouvée en route : l'enregistrement la rend et continue
 * sans cardio, tuile BPM et alerte de FC perdue retirées. Plus rien ne la recherche jusqu'à la fin de la sortie : le
 * greffon n'est plus demandé (fin de sa reprise seule), la pause ne la reprend pas, et une reprise après une chute de
 * la page ne la redemande pas, le journal le disant. Seul « Continuer l'enregistrement », après une application
 * tuée, la redemande, comme au départ.
 */
export const stopRecordingBeltSearch = (): void => {
  if (session.dropBelt === null) return;
  if (state.status === 'idle' || state.status === 'stopping') return;
  releaseRecordingBelt();
  queueJournalLines(journalBeltLine(Date.now(), 'stopped'));
  void flushJournal();
  setState({ heartRate: null, beltLost: false, error: withoutBeltLost(state.error) });
};
