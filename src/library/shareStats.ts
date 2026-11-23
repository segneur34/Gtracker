import { t } from '../core/i18n';
import type { ShareStat } from '../core/shareImage';
import { FOIL_RATIO_LABEL, type SportFamily } from '../core/sportProfiles';
import type { PumpingSummary } from '../core/pumping';
import {
  MISSING, commaDecimal, formatDecimal, formatDistance, formatDuration, formatSessionDate, formatShortDuration, formatSpeed, orDash, type DistanceUnit, type SpeedUnit,
} from '../core/units';
import { downloadBaseName } from './naming';
import { RATINGS, WIND_LEVELS, type Rating, type WindLevel } from './notes';
import type { SessionSummary } from './record';
import { customName, sessionDisplayName, sessionFileBaseName, type NamedRecord } from './sessionName';

/**
 * Lignes ajoutées à l'image de partage, à la fin de la liste,
 * les mêmes clés dans l'analyse ouverte et dans le résumé d'une fiche : le choix
 * retenu pour l'activité vaut aux deux endroits. Voile : manœuvres réussies, part
 * du vol pompée (sur foil), vent ; partout : l'appréciation.
 */
export const SHARE_EXTRA_KEYS: Record<SportFamily, readonly string[]> = {
  voile: ['maneuverSuccess', 'pumpingShare', 'wind', 'rating'],
  surf: ['rating'],
};

/** Ce qui donne les lignes ajoutées : l'analyse ouverte (ses calculs) ou la fiche (son résumé, ses notes) ; absent ou `null` : « — ». */
export interface ShareExtras {
  /** Voile : virements et empannages réussis, sur le total classé. */
  maneuvers?: { success: number; total: number } | null;
  /** Voile sur foil : part du vol pompée, de 0 à 1. */
  pumpingShare?: number | null;
  /** Voile : direction du vent retenue, en degrés, et sa force notée dans « matos et conditions ». */
  windDeg?: number | null;
  windLevel?: WindLevel | null;
  /** Appréciation de la séance. */
  rating?: Rating | null;
}

/** Libellé de l'appréciation, sans icône ni emoji (« Bien ») ; `null` sans appréciation. */
const ratingLabel = (rating: Rating | null | undefined): string | null => RATINGS.find((r) => r.value === rating)?.label ?? null;

/** « 230° · moyen », « 230° », « Moyen » : le vent dit en clair, « — » sans rien. */
const windShareValue = (deg: number | null | undefined, level: WindLevel | null | undefined): string => {
  const dir = deg === null || deg === undefined || !Number.isFinite(deg) ? null : `${Math.round(((deg % 360) + 360) % 360)}°`;
  const force = WIND_LEVELS.find((w) => w.value === level)?.label ?? null;
  if (dir && force) return `${dir} · ${force.toLowerCase()}`;
  return dir ?? force ?? MISSING;
};

/** « 83 % (10/12) » : la réussite des manœuvres, « — » sans manœuvre classée. */
const maneuverSuccessValue = (m: { success: number; total: number } | null | undefined): string =>
  m && m.total > 0 ? `${Math.round((m.success / m.total) * 100)} % (${m.success}/${m.total})` : MISSING;

/**
 * Ligne « FC moyenne » de « général » et du partage, dans les deux modules : présente
 * seulement si la session a assez de FC (`present`) ; une liste, à étaler dans les chiffres.
 */
export const heartRateShareStats = (heart: { present: boolean; stats: { avgBpm: number } | null }): ShareStat[] =>
  heart.present && heart.stats ? [{ key: 'heartRate', label: t('FC moyenne'), value: `${Math.round(heart.stats.avgBpm)} bpm` }] : [];

/** Hauteur d'un saut, comme dans l'onglet « sauts » : deux décimales. */
const jumpHeightText = (m: number): string => `${formatDecimal(m, 2)} m`;

/** Cadence de pumping, comme dans l'onglet « pumping » : coups par minute, arrondis. */
const cadenceText = (perMin: number): string => `${Math.round(perMin)} /min`;

/**
 * Tuiles des sauts de « général » (voile), hors image de partage : nombre de sauts et plus haut saut ;
 * `null` : sauts inconnus (pas de capture, calcul en cours ou impossible), aucune tuile. Aucun saut : « 0 » et « — ».
 * L'appelant décide si l'onglet « sauts » est montré.
 */
export const jumpTiles = (jumps: ReadonlyArray<{ heightM: number }> | null): ShareStat[] => {
  if (jumps === null) return [];
  const highest = jumps.length > 0 ? Math.max(...jumps.map((j) => j.heightM)) : null;
  return [
    { key: 'jumps', label: t('Sauts'), value: String(jumps.length) },
    { key: 'highestJump', label: t('Plus haut saut'), value: orDash(highest, jumpHeightText) },
  ];
};

/**
 * Tuiles du pumping de « général » (voile et surf sur foil), hors image de partage : cadence de pumping
 * et part du vol pompée ; rien sans résumé ou si la capture ne touche aucun vol. Cadence sans coup : « — ».
 * L'appelant décide si l'onglet « pumping » est montré.
 */
export const pumpingTiles = (summary: Pick<PumpingSummary, 'strokesPerMin' | 'pumpShare' | 'measured'> | null): ShareStat[] => {
  if (summary === null || summary.measured <= 0) return [];
  return [
    { key: 'pumpCadence', label: t('Cadence de pumping'), value: orDash(summary.strokesPerMin, cadenceText), title: t('Coups par minute, sur les séries') },
    {
      key: 'pumpShare', label: t('Part du vol pompée'), value: `${Math.round(summary.pumpShare * 100)} %`,
      title: t('Temps pompé sur le temps de vol couvert par les capteurs'),
    },
  ];
};

/**
 * Lignes ajoutées de l'image de partage (`SHARE_EXTRA_KEYS`), dans leur ordre ;
 * la part du vol pompée sur foil seulement. Une valeur absente vaut « — ».
 */
export const shareExtraStats = (
  family: SportFamily,
  extras: ShareExtras,
  options: { foil?: boolean } = {}
): ShareStat[] => {
  const { foil = false } = options;
  const value = (v: number | null | undefined, format: (n: number) => string): string =>
    v === null || v === undefined || !Number.isFinite(v) ? MISSING : format(v);
  const rows: Record<string, ShareStat> = {
    maneuverSuccess: { key: 'maneuverSuccess', label: t('Manœuvres réussies'), value: maneuverSuccessValue(extras.maneuvers) },
    pumpingShare: { key: 'pumpingShare', label: t('Pumping'), value: value(extras.pumpingShare, (s) => t('{n} % du vol', { n: Math.round(s * 100) })) },
    wind: { key: 'wind', label: t('Vent'), value: windShareValue(extras.windDeg, extras.windLevel) },
    rating: { key: 'rating', label: t('Appréciation'), value: ratingLabel(extras.rating) ?? MISSING },
  };
  return SHARE_EXTRA_KEYS[family].filter((key) => key !== 'pumpingShare' || foil).map((key) => rows[key]);
};

/** Ratio de vol d'une voile sur foil : temps en vol sur temps en mouvement, en pour cent, comme « général » (`activeRatio`). */
const flightRatioValue = (movingS: number | null, inMotionS: number | undefined): string =>
  movingS === null || inMotionS === undefined || inMotionS <= 0 ? MISSING : `${commaDecimal(Math.min(100, (movingS / inMotionS) * 100).toFixed(1))}%`;

/**
 * Chiffres de l'image de partage tirés du résumé d'une fiche, là où l'analyse
 * n'est pas ouverte (fin d'un enregistrement). Les clés sont celles des
 * onglets « général » des analyses : le choix retenu pour l'activité vaut
 * aux deux endroits ; un chiffre que la session n'a pas vaut « — ». Sans
 * seuil d'activité (`withActiveThreshold` faux, bateau), la voile n'a ni
 * distance, temps ni moyenne actifs, comme son onglet « général », mais un
 * « Temps en mouvement ». Sur foil
 * (`foil`), le temps actif est le temps en vol, et le dit, suivi du ratio de
 * vol. Les lignes ajoutées (`shareExtraStats`) suivent, l'appréciation
 * et la force du vent lues dans les notes de la fiche (`notes`).
 */
export const summaryShareStats = (
  summary: SessionSummary,
  family: SportFamily,
  units: { speed: SpeedUnit; distance: DistanceUnit },
  withActiveThreshold = true,
  foil = false,
  notes: { rating?: Rating | null; windLevel?: WindLevel | null; windDeg?: number | null } = {}
): ShareStat[] => {
  const results = summary.maneuverResults;
  const success = results ? results.tackSuccess + results.jibeSuccess : 0;
  const extras = shareExtraStats(family, {
    maneuvers: results ? { success, total: success + results.tackFail + results.jibeFail } : null,
    pumpingShare: summary.pumpingShare,
    // Le vent saisi dans la fiche, sinon celui que l'analyse a retenu.
    windDeg: notes.windDeg ?? summary.windDirDeg,
    windLevel: notes.windLevel,
    rating: notes.rating,
  }, { foil });
  return [...summaryBaseStats(summary, family, units, withActiveThreshold, foil), ...extras];
};

const summaryBaseStats = (
  summary: SessionSummary,
  family: SportFamily,
  units: { speed: SpeedUnit; distance: DistanceUnit },
  withActiveThreshold: boolean,
  foil: boolean
): ShareStat[] => {
  const totalS = Math.max((summary.endMs - summary.startMs) / 1000, 0);
  const movingS = summary.movingTimeS;
  const movingM = summary.movingDistanceM ?? null;
  const distance = formatDistance(summary.distanceM, units.distance);
  const speed = (ms: number | null) => (ms === null || !Number.isFinite(ms) ? MISSING : formatSpeed(ms, units.speed));
  const per = (m: number | null, s: number | null) => (m === null || s === null || s <= 0 ? null : m / s);

  if (family === 'voile') {
    const active = new Set(['activeDistance', 'activeTime', 'activeRatio', 'activeAverage']);
    // Sans seuil (bateau), `movingTimeS` est le temps en mouvement (toute la navigation, pauses et trous immobiles ôtés).
    const movingTime = { key: 'movingTime', label: t('Temps en mouvement'), value: movingS === null ? MISSING : formatDuration(movingS * 1000) };
    return [
      { key: 'distance', label: t('Distance'), value: distance },
      { key: 'activeDistance', label: t('Distance active'), value: movingM === null ? MISSING : formatDistance(movingM, units.distance) },
      { key: 'totalTime', label: t('Temps total'), value: formatDuration(totalS * 1000) },
      ...(withActiveThreshold ? [] : [movingTime]),
      { key: 'activeTime', label: foil ? t('Temps en vol') : t('Temps actif'), value: movingS === null ? MISSING : formatDuration(movingS * 1000) },
      // Sur foil : la part du temps en mouvement passée en vol, comme « général ».
      ...(foil ? [{ key: 'activeRatio', label: FOIL_RATIO_LABEL, value: flightRatioValue(movingS, summary.inMotionS) }] : []),
      { key: 'averageSpeed', label: t('Vitesse moyenne'), value: speed(per(summary.distanceM, totalS)) },
      { key: 'activeAverage', label: t('Moyenne active'), value: speed(per(movingM, movingS)) },
      { key: 'maxSpeed', label: t('Vitesse max'), value: speed(summary.maxSpeedMs) },
      { key: 'maneuvers', label: t('Manœuvres'), value: summary.maneuverCount === undefined ? MISSING : String(summary.maneuverCount) },
    ].filter((stat) => withActiveThreshold || !active.has(stat.key));
  }
  // Surf.
  return [
    { key: 'totalTime', label: t('Durée de la session'), value: formatDuration(totalS * 1000) },
    { key: 'waves', label: t('Vagues'), value: summary.waveCount === undefined ? MISSING : String(summary.waveCount) },
    { key: 'longestWave', label: t('Plus longue vague'), value: summary.longestWaveM == null ? MISSING : `${Math.round(summary.longestWaveM)} m` },
    // Sans vague, pas de vitesse max : « — », comme sa page.
    { key: 'maxSpeed', label: t('Vitesse max'), value: summary.maxSpeedMs > 0 ? speed(summary.maxSpeedMs) : MISSING },
    { key: 'longestFlight', label: t('Plus long vol'), value: summary.longestFlightS == null ? MISSING : formatShortDuration(summary.longestFlightS) },
    { key: 'distance', label: t('Distance totale'), value: distance },
  ];
};

/**
 * Titre de l'image de partage (le nom montré de la session, `sessionDisplayName`, sinon sa famille), sa
 * ligne d'activité et de date (l'activité seulement sous un nom donné, le nom calculé la porte déjà), et le
 * nom du fichier partagé (`sessionFileBaseName`), sans extension ni nettoyage (`safeFileName`). `record` :
 * la fiche, `null` hors de la mémoire.
 */
export const shareLabels = (
  record: NamedRecord | null,
  activityName: string | null,
  familyLabel: string,
  startMs: number,
  file: string
): { title: string; subtitle: string; baseName: string } => {
  const named = record ?? { name: null };
  const custom = customName(named);
  return {
    title: sessionDisplayName(named, activityName, familyLabel),
    subtitle: [custom ? activityName : null, formatSessionDate(startMs)].filter(Boolean).join(' · '),
    baseName: sessionFileBaseName(named, activityName, startMs, file) ?? downloadBaseName(familyLabel, null, startMs, file),
  };
};
