import { t } from '../core/i18n';
import { pad2 } from '../core/units';
import type { HeartRateZones } from '../core/heartRate';
import { athleteHrSource, type HrSource, type AthleteProfile } from '../library/athleteProfile';

/**
 * D'où viennent les seuils et les zones cardiaques, en clair : dans l'onglet
 * cardio, le test de FC repos, Pratiquant et les Statistiques.
 */

/** « test du 24/10 », « séance du 20/10 », « saisie ». */
export const hrSourceLabel = (source: HrSource): string => {
  if (source.kind === 'saisie') return t('saisie');
  const isTest = source.kind === 'test';
  if (source.atMs === null) return isTest ? t('test') : t('séance');
  const date = new Date(source.atMs);
  const day = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  return isTest ? t('test du {date}', { date: day }) : t('séance du {date}', { date: day });
};

/** Origine de la FC max retenue par les zones : estimée par l'âge, ou celle de Pratiquant. */
const hrMaxOriginLabel = (zones: Pick<HeartRateZones, 'estimated'>, profile: AthleteProfile): string => {
  const source = athleteHrSource(profile, 'hrMax');
  return zones.estimated || source === null ? t("estimée par l'âge") : hrSourceLabel(source);
};

/** Décalage signé, avec le vrai signe moins : « −7 », « +3 ». */
export const formatOffsetBpm = (offsetBpm: number): string => (offsetBpm < 0 ? `−${-offsetBpm}` : `+${offsetBpm}`);

/**
 * « S1 141 et S2 162 bpm (−7 pour cette activité), tirés de la FC repos 50
 * (test du 25/10) et de la FC max 190 (saisie). »
 */
export const zonesOriginText = (zones: HeartRateZones, profile: AthleteProfile): string => {
  const shifted = zones.offsetBpm !== 0;
  const offset = formatOffsetBpm(zones.offsetBpm);
  const { s1, s2 } = zones;
  // Une phrase entière par cas (décalage ou non, méthode) : seuls des nombres et des libellés d'origine complets y entrent.
  if (zones.method === 'saisis') {
    return shifted
      ? t('S1 {s1} et S2 {s2} bpm ({offset} pour cette activité), saisis dans Réglages › Pratiquant.', { s1, s2, offset })
      : t('S1 {s1} et S2 {s2} bpm, saisis dans Réglages › Pratiquant.', { s1, s2 });
  }
  // Sans FC max, aucune méthode autre que « saisis » ne donne de zones : le repli ne sert qu'au typage.
  const hrMax = zones.hrMax ?? '';
  const maxOrigin = hrMaxOriginLabel(zones, profile);
  if (zones.method === 'reserve') {
    const rest = athleteHrSource(profile, 'hrRest');
    const vars = { s1, s2, offset, hrRest: profile.hrRest ?? '', restOrigin: rest ? hrSourceLabel(rest) : t('saisie'), hrMax, maxOrigin };
    return shifted
      ? t('S1 {s1} et S2 {s2} bpm ({offset} pour cette activité), tirés de la FC repos {hrRest} ({restOrigin}) et de la FC max {hrMax} ({maxOrigin}).', vars)
      : t('S1 {s1} et S2 {s2} bpm, tirés de la FC repos {hrRest} ({restOrigin}) et de la FC max {hrMax} ({maxOrigin}).', vars);
  }
  return shifted
    ? t('S1 {s1} et S2 {s2} bpm ({offset} pour cette activité), tirés de la FC max {hrMax} ({maxOrigin}), sans FC repos.', { s1, s2, offset, hrMax, maxOrigin })
    : t('S1 {s1} et S2 {s2} bpm, tirés de la FC max {hrMax} ({maxOrigin}), sans FC repos.', { s1, s2, hrMax, maxOrigin });
};
