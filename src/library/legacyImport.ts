import { isObject, parseJson } from '../core/basics';
import { IMU_FORMAT, IMU_VERSION, decodeImuHeader, joinImu, splitImu } from '../core/imuFile';
import { isOtherSportType } from './naming';
import { RECORD_FORMAT, isWritableRecord, parseRecordValue, type ParsedRecord } from './record';

/**
 * Porte d'import des sessions de l'ancienne application (lot 321) : le seul fichier qui connaît ses noms. Une session
 * de voile ou de surf entre par des fichiers (GPX, GPX complet, fiche `.json` et capteurs `.imu` posés à côté) et
 * s'y écrit aussitôt au format de Gtracker ; rien d'autre de l'ancienne application n'est lu.
 *
 * - fiche : `parseImportedRecord`, ancien format accepté, champs de l'ancienne application retirés ;
 * - GPX complet : son bloc sous l'ancien préfixe (`LEGACY_BUNDLE`, lu par `library/sessionBundle.ts`) ;
 * - capteurs : `upgradeImportedImu`, en-tête récrit, mesures intactes ;
 * - dossier mémoire de l'ancienne application : reconnu à son marqueur (`LEGACY_MARKER_FILE`), refusé comme mémoire.
 */

/** Format de la fiche de l'ancienne application. */
const LEGACY_RECORD_FORMAT = 'tracker-session';
/** Format de l'en-tête de ses capteurs. */
const LEGACY_IMU_FORMAT = 'tracker-capteurs';

/** Marqueur de son dossier mémoire : un dossier qui le porte sans celui de Gtracker est le sien. */
export const LEGACY_MARKER_FILE = 'tracker.json';

/**
 * Bloc de son GPX complet : préfixe des éléments, et ouverture reconnue quelle que soit l'adresse de son espace de
 * noms (on ne l'écrit pas). `open` est global : le dernier bloc du texte compte.
 */
export const LEGACY_BUNDLE = {
  prefix: 'tracker',
  open: /<extensions><tracker:session xmlns:tracker="[^"]*" version="1">/g,
} as const;

/**
 * Ce que l'ancienne application écrit et que Gtracker ne lit pas : réglages de la course et du vélo, records et
 * puissance du résumé, revêtement, altitude du terrain, séances et test guidé. Retiré à l'entrée.
 */
const ORIGIN_FIELDS = ['surfaces', 'terrainElevation', 'elevationSource', 'intervals', 'test'] as const;
const ORIGIN_ANALYSIS_FIELDS = ['effortThresholdMs', 'bikeWeightKg', 'loadKg'] as const;
const ORIGIN_SUMMARY_FIELDS = ['cadence', 'bests', 'best1kmS', 'best5minMs', 'avgPowerW'] as const;

const without = (value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

/** Fiche de l'ancienne application, relue en JSON, sans ce que Gtracker ne lit pas (`ORIGIN_FIELDS`…). */
const withoutOriginFields =(raw: Record<string, unknown>): Record<string, unknown> => {
  const out = without(raw, ORIGIN_FIELDS);
  if (isObject(out.analysis)) out.analysis = without(out.analysis, ORIGIN_ANALYSIS_FIELDS);
  if (isObject(out.summary)) out.summary = without(out.summary, ORIGIN_SUMMARY_FIELDS);
  return out;
};

/** Fiche apportée par un import. */
export interface ImportedRecord {
  /** Fiche lue (`parseRecordValue`), au format de Gtracker ; une version plus récente comprise ; `null` si illisible. */
  parsed: ParsedRecord | null;
  /** Vrai pour une fiche de l'ancienne application. */
  legacy: boolean;
  /** Sport de la fiche que Gtracker ne range pas (course, vélo, entraînement), tel qu'écrit ; `null` sinon. */
  otherSport: string | null;
}

/**
 * Lit une fiche apportée par un import : au format de Gtracker, ou à celui de l'ancienne application, dont les champs
 * que Gtracker ne lit pas sont retirés. Le sport est lu avant la fiche, dont la lecture remet à `null` un sport
 * qu'elle ne calcule pas.
 */
export const parseImportedRecord = (text: string): ImportedRecord => {
  const raw = parseJson(text);
  if (!isObject(raw)) return { parsed: null, legacy: false, otherSport: null };
  const legacy = raw.format === LEGACY_RECORD_FORMAT;
  const otherSport = typeof raw.sport === 'string' && isOtherSportType(raw.sport) ? raw.sport : null;
  const parsed = parseRecordValue(legacy ? withoutOriginFields(raw) : raw, [RECORD_FORMAT, LEGACY_RECORD_FORMAT]);
  return { parsed, legacy, otherSport };
};

/**
 * Fiche de l'ancienne application qu'on ne range pas : illisible, ou d'une version plus récente que celle qu'on sait
 * lire. Seul le GPX de la session entre, et le compte rendu de l'import le dit : la ranger telle quelle ferait entrer
 * l'ancien format dans la mémoire, en lecture seule.
 */
export const isIgnoredLegacyRecord = (read: Pick<ImportedRecord, 'parsed' | 'legacy'>): boolean =>
  read.legacy && (!read.parsed || !isWritableRecord(read.parsed.parts));

/**
 * Capteurs apportés par un import, au format de Gtracker : l'en-tête de l'ancienne application est récrit (format,
 * cadence à pied retirée), la marque et les mesures restent telles quelles. Un fichier qui n'est pas à l'ancien format
 * est rendu sans y toucher ; `null` pour un fichier à l'ancien format qu'on ne sait pas convertir (version plus
 * récente, en-tête incomplet) : la session entre sans eux.
 */
export const upgradeImportedImu = (bytes: Uint8Array): Uint8Array | null => {
  const split = splitImu(bytes);
  const header = split ? parseJson(split.headerText) : null;
  if (!split || !isObject(header) || header.format !== LEGACY_IMU_FORMAT) return bytes;
  if (typeof header.version !== 'number' || header.version > IMU_VERSION) return null;
  const setup = isObject(header.setup) ? without(header.setup, ['cadence']) : header.setup;
  const upgraded = joinImu({ ...header, format: IMU_FORMAT, setup }, split.body);
  return decodeImuHeader(upgraded) ? upgraded : null;
};
