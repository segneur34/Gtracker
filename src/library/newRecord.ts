import { decodeImuHeader } from '../core/imuFile';
import { JUMPS_CALC_VERSION } from '../core/jumps';
import type { SessionMark } from '../core/sessionMarks';
import {
  RECORD_FORMAT, RECORD_VERSION, readAnalysis, type RecordWithoutSummary, type SessionRecord, type SessionSource,
} from './record';
import { withSummary, type AnalyzedGpx } from './summaryOptions';

/**
 * Fiche d'une session qui entre dans la mémoire (lot 113, sortie de la bibliothèque) : neuve, ou celle qui
 * l'accompagne, avec ce que l'enregistrement y range. L'horloge est passée en paramètre : la bibliothèque
 * donne `Date.now`.
 */

/** Ce que la fiche neuve prend hors du GPX. */
export interface NewRecordContext {
  /** Instant présent, en ms. */
  now: () => number;
}

/** Ce qu'une session apporte à sa fiche en entrant dans la mémoire (`addGpx` de la bibliothèque). */
export interface NewRecordOptions {
  /** Activité choisie à l'enregistrement. */
  activityId?: string;
  /** Fiche qui accompagne le GPX, lors de l'import d'un dossier ; son résumé est refait. */
  record?: RecordWithoutSummary | null;
  /** Repères du bouton « Note », rangés dans la fiche. */
  marks?: SessionMark[];
  /** Capteurs de l'enregistrement (`.imu`), rangés à côté du GPX. */
  motion?: Uint8Array;
  /** Foil de l'activité à l'enregistrement, rangé dans les réglages de la session. */
  foil?: boolean;
}

/** Fiche neuve d'un GPX rangé sous le nom `gpx`, sans nom ni réglages d'analyse. */
export const newRecord = (
  gpx: string, analyzed: AnalyzedGpx, source: SessionSource, activityId: string | null, context: NewRecordContext
): SessionRecord => ({
  format: RECORD_FORMAT,
  version: RECORD_VERSION,
  gpx,
  sport: analyzed.sport,
  activityId,
  source,
  addedAt: new Date(context.now()).toISOString(),
  title: analyzed.title,
  name: null,
  summary: analyzed.summary,
  notes: null,
  analysis: null,
});

/**
 * Fiche d'une session qui entre dans la mémoire sous le nom `gpx` : celle qui l'accompagne (import d'un
 * dossier, session en attente), son résumé refait, sinon une neuve, à l'activité et au foil choisis à
 * l'enregistrement ; avec les repères de l'enregistrement.
 */
export const recordFor = (
  gpx: string, analyzed: AnalyzedGpx, source: SessionSource, options: NewRecordOptions, context: NewRecordContext
): SessionRecord => {
  const made = options.record
    ? withSummary({ ...options.record, gpx, sport: analyzed.sport }, analyzed.summary)
    : {
      ...newRecord(gpx, analyzed, source, options.activityId ?? null, context),
      ...(options.foil !== undefined ? { analysis: readAnalysis({ foil: options.foil, savedAt: context.now() }) } : {}),
    };
  // Capture de la seule cadence : la fiche dit tout de suite qu'il n'y a pas de sauts à chercher.
  const jumpsUnmeasured = options.motion && decodeImuHeader(options.motion)?.setup.jumps === false;
  return {
    ...made,
    ...(options.marks && options.marks.length > 0 ? { marks: options.marks } : {}),
    ...(jumpsUnmeasured && !made.jumps
      ? { jumps: { version: JUMPS_CALC_VERSION, computedAt: new Date(context.now()).toISOString(), jumps: [], measured: false as const } }
      : {}),
  };
};
