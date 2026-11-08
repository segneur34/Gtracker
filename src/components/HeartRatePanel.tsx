import { toFixedNumber } from '../core/basics';
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BandShareTable from './BandShareTable';
import CardioLoadHelp from './CardioLoadHelp';
import { HoverReadout, type Readout } from './ChartReadout';
import HeartRateChart from './HeartRateChart';
import { inChartView } from './chartHover';
import { HelpText, HelpToggle } from './Help';
import { useHelp } from './helpContext';
import { PanelHeading } from './PanelTitle';
import { HEART_RATE_COLOR, HEART_ZONE_COLORS, zoneLabel } from './heartRateColors';
import Button from './ui/Button';
import { bandRangeLabel } from '../core/bands';
import { sampledIndices, visibleIndexRange } from '../core/chartZoom';
import { CHART_MAX_POINTS } from '../core/displayConfig';
import {
  edwardsLoad, timeInZones, type HeartRatePoint, type HeartRateZones,
} from '../core/heartRate';
import { estimateHrEnergy, hrEnergyKcal } from '../core/hrEnergy';
import type { HeartRateProfile, HrEnergyProfile } from '../core/sportProfiles';
import { formatClock, formatShortDuration } from '../core/units';
import { useZoomState, type ChartZoomSource } from '../hooks/useChartZoom';
import { runnerAge, type RunnerProfile } from '../library/athleteProfile';
import type { SessionHeartRate } from '../hooks/useSessionHeartRate';
import { zonesOriginText } from './heartRateOrigin';
import StatTile from './ui/StatTile';
import { elapsedX } from './chartAxes';
import { heartRateReadout } from './chartReadouts';

interface Props {
  track: readonly HeartRatePoint[];
  /** Temps de chaque point de la trace, en minutes depuis le premier (`useTimeChartAxis`). */
  minutes: readonly number[];
  heart: SessionHeartRate;
  params: HeartRateProfile;
  /** Énergie estimée par la FC (voile et surf, `SportProfile.hrEnergy`) ; `null` : pas de tuile (à pied, à vélo, l'énergie mécanique reste seule). */
  hrEnergy: HrEnergyProfile | null;
  /** Zones du pratiquant, `null` sans FC max ni âge. */
  zones: HeartRateZones | null;
  /** FC max saisie dans Pratiquant. */
  profileHrMax: number | null;
  /** Profil du pratiquant, pour dire d'où viennent les zones. */
  runner: RunnerProfile;
  /** « La retenir » : la FC max de la sortie devient celle du pratiquant. */
  onRetainHrMax: (bpm: number) => void;
  /** Zone montrée sur la carte (1 à 5, 0 sous Z1), ou `null`. */
  selectedZone: number | null;
  onSelectZone: (zone: number | null) => void;
  /** Zoom de la courbe, tenu par le module (« +carte », plein écran carte + graphes) ; « tout voir » à chaque session. Lu par la courbe seule. */
  zoom: ChartZoomSource;
  /** « +carte » de la courbe zoomée. */
  onShowOnMap?: () => void;
  open: boolean;
  onToggle: () => void;
}

const minutesLabel = (v: unknown) => formatClock(Number(v) * 60_000);

/**
 * Courbe de FC de l'onglet « cardio », sur le temps écoulé, avec sa lecture
 * au-dessus : dans le panneau, et sous la carte en plein écran. `minutes` est
 * le temps de chaque point de la trace (`useTimeChartAxis`) ; `children` ajoute
 * des éléments au graphe (bandes des phases, traits des repères). Elle suit
 * son zoom elle-même : zoomer ne redessine qu'elle (lot 127).
 */
export function CardioCurve({ minutes, smoothed, zoom: source, zones, thresholds, zoneLines = false, onShowOnMap, style, children }: {
  minutes: readonly number[];
  smoothed: readonly (number | null)[];
  zoom: ChartZoomSource;
  /** Bornes basses des zones 1 à 5, ou `null` sans zones. */
  zones: readonly number[] | null;
  thresholds?: { s1: number; s2: number } | null;
  /** Limites des zones en traits fins (`HeartRateChart`). */
  zoneLines?: boolean;
  onShowOnMap?: () => void;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const zoom = useZoomState(source);
  const rows = useMemo(() => {
    if (minutes.length < 2) return [];
    const [first, last] = visibleIndexRange(minutes, zoom.view);
    return sampledIndices(first, last, CHART_MAX_POINTS, smoothed).map((i) => ({
      index: i,
      minutes: toFixedNumber(minutes[i], 3),
      hr: smoothed[i] === null ? null : Math.round(smoothed[i]!),
    }));
  }, [minutes, zoom.view, smoothed]);
  if (rows.length < 2) return null;
  /** Lecture au point survolé (`HoverReadout`), s'il est dans la plage zoomée. */
  const read = (hoveredIndex: number): Readout | null => {
    if (minutes[hoveredIndex] === undefined || !inChartView(zoom.view, minutes[hoveredIndex])) return null;
    return heartRateReadout(smoothed[hoveredIndex], minutesLabel(minutes[hoveredIndex]));
  };
  return (
    <>
      <HoverReadout read={read} label="FC" color={HEART_RATE_COLOR} line />
      <HeartRateChart data={rows} zoom={zoom} zones={zones} thresholds={thresholds} zoneLines={zoneLines} onShowOnMap={onShowOnMap}
        style={style} x={elapsedX()}>
        {children}
      </HeartRateChart>
    </>
  );
}

/**
 * Courbe de FC qui accompagne les graphes de la voile, du surf et de la
 * course : rien sans FC, zones et seuils du pratiquant s'il en a.
 */
export function CardioCompanion({ minutes, heart, zoom, zones, zoneLines = false, onShowOnMap, style }: {
  minutes: readonly number[];
  heart: SessionHeartRate;
  zoom: ChartZoomSource;
  zones: HeartRateZones | null;
  /** Limites des zones en traits fins (case « Zones » de l'onglet cardio). */
  zoneLines?: boolean;
  onShowOnMap?: () => void;
  style?: CSSProperties;
}) {
  if (!heart.present) return null;
  return (
    <CardioCurve minutes={minutes} smoothed={heart.smoothed} zoom={zoom} zones={zones?.bounds ?? null}
      thresholds={zones ? { s1: zones.s1, s2: zones.s2 } : null} zoneLines={zoneLines} onShowOnMap={onShowOnMap} style={style} />
  );
}

/**
 * Onglet « cardio » de la voile et du surf : FC moyenne, max et charge, courbe
 * reliée à la carte, temps par zone avec ses passages sur la carte, FC max
 * observée à retenir.
 * Posé dans le `ResizablePanel` du module.
 */
function HeartRatePanel({
  track, minutes, heart, params, hrEnergy, zones, profileHrMax, runner, onRetainHrMax, selectedZone, onSelectZone,
  zoom, onShowOnMap, open, onToggle,
}: Props) {
  const { smoothed, stats } = heart;

  const zoneTimes = useMemo(() => (zones ? timeInZones(track, smoothed, zones.bounds, params.gapS) : null), [zones, track, smoothed, params.gapS]);
  const loadHelp = useHelp('analyse:charge');
  /** Âge à la date de la session ; poids et sexe du pratiquant. */
  const energy = useMemo(() => {
    if (!hrEnergy || track.length === 0) return null;
    const athlete = { weightKg: runner.weightKg, age: runnerAge(runner, track[0].timeMs), sex: runner.sex, hrMax: runner.hrMax };
    return estimateHrEnergy(track, smoothed, athlete, params, hrEnergy);
  }, [hrEnergy, track, smoothed, runner, params]);

  if (!stats) return null;
  const aboveProfile = profileHrMax === null || stats.maxBpm > profileHrMax;

  return (
    <>
      <PanelHeading label="Cardio" open={open} onToggle={onToggle} helpKey="analyse:cardio" />
      <HelpText helpKey="analyse:cardio" note>
        FC lissée sur {params.smoothS} s ; un trou de plus de {params.gapS} s (ceinture retirée, pause) n'est pas compté.
        {' Le survol de la courbe déplace le repère sur la carte.'}
        {zones && " Les traits noirs S1 et S2 de la courbe sont vos seuils aérobie et anaérobie."}
        {zones && " « Voir » montre les passages d'une zone sur la carte, en violet."}
      </HelpText>
      <div className="an-sheet__stats an-sheet__stats--always">
        <StatTile label="FC moyenne" value={<>{Math.round(stats.avgBpm)} bpm</>} />
        <StatTile label="FC max" value={<>{stats.maxBpm} bpm</>} />
        {zones && (
          <StatTile label="S1 · S2" value={<>{zones.s1} · {zones.s2} bpm</>} />
        )}
        {zoneTimes && (
          <StatTile
            label={<>Charge <HelpToggle helpKey="analyse:charge" label="Qu'est-ce que la charge ?" /></>}
            value={Math.round(edwardsLoad(zoneTimes, params.loadWeights))} />
        )}
        <StatTile label="Temps mesuré" value={formatShortDuration(stats.coveredS)} />
        {hrEnergy && energy?.kind === 'estimation' && (
          <StatTile
            label={<>Énergie estimée <HelpToggle helpKey="analyse:energie-fc" label="Énergie estimée" /></>}
            value={<>env. {hrEnergyKcal(energy.totalJ, hrEnergy.displayStepKcal)} kcal</>}
            detail={<>
              dont env. {hrEnergyKcal(energy.restJ, hrEnergy.displayStepKcal)} kcal au repos
              {!energy.extrapolated && <>, sur {formatShortDuration(energy.measuredS)} avec FC</>}
            </>} />
        )}
      </div>
      {loadHelp?.open && zones && <CardioLoadHelp bounds={zones.bounds} weights={params.loadWeights} />}
      <HelpText helpKey="analyse:energie-fc" note>
        Calculée à partir de votre rythme cardiaque, de votre poids, de votre âge et de votre sexe. C'est un ordre de grandeur,
        pas une mesure : comptez 25 % d'écart, davantage par temps froid ou en position de rappel.
      </HelpText>
      {energy?.kind === 'profil-incomplet' && (
        <p className="ui-muted ui-text-s ui-my-8">
          Pour l'énergie estimée, renseignez votre poids et votre année de naissance dans <Link to="/parametres">Réglages › Pratiquant</Link>.
        </p>
      )}

      {aboveProfile && (
        <div className="ui-row-10 ui-center ui-wrap ui-my-8 ui-text-s">
          <span>
            {profileHrMax === null
              ? `Aucune FC max dans Réglages › Pratiquant : celle de cette sortie est de ${stats.maxBpm} bpm.`
              : `FC max de la sortie : ${stats.maxBpm} bpm, au-dessus de celle de Pratiquant (${profileHrMax}).`}
          </span>
          <Button size="s" onClick={() => onRetainHrMax(stats.maxBpm)}>La retenir</Button>
        </div>
      )}

      <div className="ui-mt-6">
        <CardioCurve minutes={minutes} smoothed={smoothed} zoom={zoom} zones={zones?.bounds ?? null} thresholds={zones ? { s1: zones.s1, s2: zones.s2 } : null}
          onShowOnMap={onShowOnMap} style={{ width: '100%', height: '200px' }} />
      </div>

      {zones && zoneTimes ? (
        <>
          <BandShareTable head="Zone" detailHead="FC" shareWidth="30%" marginTop="10px"
            rows={zoneTimes.map((timeS, zone) => ({ color: HEART_ZONE_COLORS[zone], label: zoneLabel(zone), detail: bandRangeLabel(zones.bounds, zone), timeS }))}
            selected={selectedZone} onSelect={onSelectZone} />
          <div className="ui-muted ui-text-xs ui-mt-6">
            Zones calées sur {zonesOriginText(zones, runner)}
          </div>
        </>
      ) : (
        <p className="ui-muted ui-text-s ui-mt-10">
          Pour les zones d'effort, saisir la FC max ou l'année de naissance dans <Link to="/parametres">Réglages</Link>, bloc « Pratiquant ».
        </p>
      )}

    </>
  );
}

/** Mémoïsé : le zoom d'un autre graphe de l'analyse ne le redessine pas (lot 63). */
export default memo(HeartRatePanel);
