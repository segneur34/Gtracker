import { useCallback, useMemo } from 'react';
import { heartRateZonePaths, type HeartRatePoint, type HeartRateZones } from '../core/heartRate';
import type { HeartRateProfile } from '../core/sportProfiles';
import { athleteHeartRateZones } from '../library/athleteProfile';
import { useAthleteProfile } from './useAthleteProfile';
import { useSessionHeartRate, type SessionHeartRate } from './useSessionHeartRate';

/**
 * FC d'une analyse, la même dans les quatre modules : le pratiquant (`athlete`,
 * son âge, `retainHr` pour garder une FC max lue dans la séance), la FC de la
 * session (`heart`) et ses zones, décalées de celui de l'activité (`hrZones`).
 */
export const useAnalysisHeart = (track: readonly HeartRatePoint[], params: HeartRateProfile, hrOffsetBpm: number) => {
  const { profile: athlete, age, retainHr } = useAthleteProfile();
  const heart = useSessionHeartRate(track, params);
  const hrZones = useMemo(() => athleteHeartRateZones(athlete, params, hrOffsetBpm), [athlete, params, hrOffsetBpm]);
  return { athlete, age, retainHr, heart, hrZones };
};

/**
 * Rappels de l'onglet « cardio », stables : le panneau, mémoïsé, ne se redessine pas au zoom d'un autre graphe.
 * `retainSessionHrMax` garde une FC max lue dans la séance (datée du premier point), `showCardioOnMap` montre
 * sur la carte la partie vue de la courbe (`useZoomOnMap`, `show`).
 */
export const useCardioShortcuts = (
  track: ReadonlyArray<{ timeMs: number }>,
  retainHr: ReturnType<typeof useAthleteProfile>['retainHr'],
  showZoomOnMap: (panel: 'cardio') => void
) => {
  const firstMs = track[0]?.timeMs ?? null;
  const retainSessionHrMax = useCallback((bpm: number) => retainHr('hrMax', bpm, { kind: 'seance', atMs: firstMs }), [retainHr, firstMs]);
  const showCardioOnMap = useCallback(() => showZoomOnMap('cardio'), [showZoomOnMap]);
  return { retainSessionHrMax, showCardioOnMap };
};

/** Surbrillance de l'onglet « cardio » : la zone montrée, par son numéro en chaîne. */
export interface CardioHighlight {
  shownIn: (panel: 'cardio') => string | null;
  show: (panel: 'cardio', key: string | null) => void;
}

/**
 * Zone cardiaque montrée sur la carte depuis l'onglet « cardio » : son numéro
 * (`selectedZone`), le choix d'une autre (`select`, `null` l'efface) et ses
 * passages à tracer (`paths`), tant que l'onglet est ouvert et la FC présente.
 */
export const useHeartRateZoneHighlight = (
  highlight: CardioHighlight,
  cardioOpen: boolean,
  heart: SessionHeartRate,
  hrZones: HeartRateZones | null,
  track: readonly (HeartRatePoint & { lat: number; lon: number })[],
  gapS: number
) => {
  const shown = highlight.shownIn('cardio');
  const selectedZone = shown === null ? null : Number(shown);
  const paths = useMemo(
    () => (selectedZone !== null && cardioOpen && heart.present && hrZones
      ? heartRateZonePaths(track, heart.smoothed, hrZones.bounds, selectedZone, gapS)
      : []),
    [selectedZone, cardioOpen, heart, hrZones, track, gapS]
  );
  const { show } = highlight;
  const select = useCallback((zone: number | null) => show('cardio', zone === null ? null : String(zone)), [show]);
  return { selectedZone, select, paths };
};
