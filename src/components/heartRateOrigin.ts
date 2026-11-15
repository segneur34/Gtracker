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
  const kind = source.kind === 'test' ? t('test') : t('séance');
  if (source.atMs === null) return kind;
  const date = new Date(source.atMs);
  return t('{kind} du {date}', { kind, date: `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}` });
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
  const offset = zones.offsetBpm !== 0 ? ` ${t('({offset} pour cette activité)', { offset: formatOffsetBpm(zones.offsetBpm) })}` : '';
  const seuils = `${t('S1 {s1} et S2 {s2} bpm', { s1: zones.s1, s2: zones.s2 })}${offset}`;
  const hrMax = zones.hrMax === null ? '' : t('FC max {hrMax} ({origin})', { hrMax: zones.hrMax, origin: hrMaxOriginLabel(zones, profile) });
  if (zones.method === 'saisis') return t('{seuils}, saisis dans Réglages › Pratiquant.', { seuils });
  if (zones.method === 'reserve') {
    const rest = athleteHrSource(profile, 'hrRest');
    return t('{seuils}, tirés de la FC repos {hrRest} ({origin}) et de la {hrMax}.', {
      seuils, hrRest: profile.hrRest ?? '', origin: rest ? hrSourceLabel(rest) : t('saisie'), hrMax,
    });
  }
  return t('{seuils}, tirés de la {hrMax}, sans FC repos.', { seuils, hrMax });
};
