import { memo, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import AnalysisBaseLayers from '../components/AnalysisBaseLayers';
import './analysisMobile.css';
import { ReferenceArea } from 'recharts';
import Swatch from '../components/ui/Swatch';
import SessionActivityField from '../components/SessionActivityField';
import SessionSettingsHeader from '../components/SessionSettingsHeader';
import CardioTab from '../components/CardioTab';
import NotesTab from '../components/NotesTab';
import FoilPumpingFields from '../components/FoilPumpingFields';
import { GraphFoldHead } from '../components/ChartFold';
import { HoverReadout, type Readout } from '../components/ChartReadout';
import { HEART_RATE_COLOR } from '../components/heartRateColors';
import { ANALYSIS_MAP_ANCHOR } from '../components/AnalysisMap';
import { SessionMarksList } from '../components/SessionMarks';
import { markReferenceLines } from '../components/markReferenceLines';
import { HelpText } from '../components/Help';
import PanelTitle, { PanelHeading, SessionDate } from '../components/PanelTitle';
import ResizablePanel from '../components/ResizablePanel';
import { gearFieldsFor } from '../components/gearFields';
import GeneralStats from '../components/GeneralStats';
import type { ShareStat } from '../core/shareImage';
import SpeedGradientLegend from '../components/SpeedGradientLegend';
import SessionThresholdField from '../components/SessionThresholdField';
import { SessionColorRangeField } from '../components/SpeedRangeEditor';
import TrackSpanLayer, { type TrackSpanShown } from '../components/TrackSpanLayer';
import { PUMPING_OFF_NOTE, pumpingHighlightSpans } from '../components/pumpingHighlight';
import { FlightsPanel, PumpingPanel, type FlightColumn } from '../components/FlightPumpingPanel';
import { t } from '../core/i18n';
import { tdStyle, thStyle } from '../components/tableStyle';
import TopsPanel, { TopsHighlight } from '../components/TopsPanel';
import HeartRateChart from '../components/HeartRateChart';
import { CardioCompanion } from '../components/HeartRatePanel';
import { heartRateReadout, speedReadout } from '../components/chartReadouts';
import { useAnalysisHeart, useCardioShortcuts, useHeartRateZoneHighlight } from '../hooks/useAnalysisHeart';
import TrackArrows from '../components/TrackArrows';
import TrackSegmentsLayer, { type TrackSegment } from '../components/TrackSegmentsLayer';
import TrackChart, { type TrackSeries } from '../components/TrackChart';
import { zoomHint } from '../components/zoomHint';
import { HIGHLIGHT_PODIUM_COLORS, HIGHLIGHT_SHOWN_COLOR } from '../components/highlightColors';
import { ANALYSIS_PANEL_STYLE, PANEL_BLOCK_STYLE } from '../components/styles';
import Button from '../components/ui/Button';
import { SURF_TABS, tabDefaults, type SurfTab } from '../core/analysisTabs';
import { lastByRange, sampledIndicesKeeping, visibleIndexRange } from '../core/chartZoom';
import { CHART_MAX_POINTS, trackBounds } from '../core/displayConfig';
import { defaultActiveThresholdOf, sportTreatment } from '../core/sportProfiles';
import { nearestIndexAtTime } from '../core/search';
import { computeAllTopSegments } from '../core/topSegments';
import { effectiveSpeedRange, trackColorSegments } from '../core/trackColor';
import {
  SPEED_UNIT_LABEL, speedSourceText, formatDistance, formatDuration, formatShortDuration, formatSpeed, formatSpeedValue, formatTimeOfDay,
  fromDisplaySpeed, toDisplaySpeed, formatDecimal, orDash, speedCellOf
} from '../core/units';
import { useTimeChartAxis } from '../hooks/useTimeChartAxis';
import { useGpxSession } from '../hooks/useGpxSession';
import { useAnalysisSession } from '../hooks/useAnalysisSession';
import { carriedSettings } from '../library/record';
import { carriedThresholdNote, sessionActivitySettings } from '../library/summaryOptions';
import { useAnalysisTabs } from '../hooks/useAnalysisTabs';
import { useZoomOnMap } from '../hooks/useZoomOnMap';
import { shownMarkOf, useSessionMarks } from '../hooks/useSessionMarks';
import { useNarrowScreen } from '../hooks/useNarrowScreen';
import { useOpenSections } from '../hooks/useOpenSections';
import { useFlightPumping, useSessionPumping, type PumpingStatus } from '../hooks/useSessionPumping';
import { useHasGearList, useSportSettings } from '../hooks/useSportSettings';
import { notesHaveGear } from '../settings/gearReminder';
import type { SurfFlight, SurfPhase, SurfReturn, SurfSpan, SurfWave } from '../surfing/surfAnalysis';
import { effectiveWaveThreshold, runSurfSession, surfProfileOf } from '../surfing/surfSession';
import { gyroWaveTurns } from '../surfing/gyroTurns';
import StatTile from '../components/ui/StatTile';
import MapToggle from '../components/ui/MapToggle';
import SegmentedControl from '../components/ui/SegmentedControl';
import { SPEED_COLOR } from '../components/chartStyle';
import AnalysisShell from '../components/AnalysisShell';
import ZoomView from '../components/ZoomView';
import type { ChartZoom } from '../hooks/useChartZoom';
import { heartRateShareStats, shareExtraStats } from '../library/shareStats';

/**
 * Analyse d'une session de surf, selon le patron commun
 * (`docs/MISE_EN_PAGE.md`) : carte colorée par la vitesse, puis les onglets.
 * « général » porte la synthèse ; « vagues » le tableau des vagues ; « rame »
 * les remontées et le retour au pic ; « vols », sur foil seulement, les vols
 * qui relient plusieurs vagues en pompant, et à part « pumping »,
 * les séries de coups mesurées par les capteurs si la session les a ; « tops », si l'activité le coche
 * dans Réglages (paddle, kayak, downwind), les meilleurs passages sur chaque
 * durée ou distance ; « graphiques » la vitesse au fil
 * de la session, vagues en bandes ; « matériel et notes » le matériel (deux
 * champs nommés par activité dans Réglages), les conditions, l'appréciation et
 * le commentaire ; « réglages » ceux de la session. Leur liste est `SURF_TABS`
 * (`core/analysisTabs.ts`), où chaque activité choisit dans Réglages ceux qu'elle montre.
 */

const SURF_SECTION_DEFAULTS = tabDefaults(SURF_TABS);

/** Préfixe des identifiants mémorisés (tailles des panneaux, onglets ouverts) : ne pas le renommer. */
const STORAGE_ID = 'surf';
const panelId = (name: string) => `${STORAGE_ID}.${name}`;

/**
 * Graphes de l'onglet « graphiques » dépliés : avec la FC, chacun se replie à
 * part pour ne comparer que ceux qui restent ouverts. Choix gardé sur l'appareil.
 */
const GRAPH_FOLDS_DEFAULT = { vitesse: true, fc: true };
/** Hauteur de base d'un graphe : le panneau suit le nombre de graphes dépliés. */
const CHART_HEIGHT_PX = 170;
const chartBox = (heightPx: number): CSSProperties => ({ width: '100%', flex: `1 0 ${heightPx}px`, height: `${heightPx}px`, marginTop: '4px' });
const ACCENT = 'var(--surf)';
/** Capteurs coupés pour le pumping (case décochée) : ni mesures, ni lecture en cours. */
const SENSORS_OFF: { status: PumpingStatus; error: string | null; recording: null } = { status: 'none', error: null, recording: null };

/** Couleurs de la répartition du temps (données, en dur) : glisse, rame, attente, sans signal. */
const PHASE_COLORS: Record<SurfPhase, string> = { glisse: '#1e88e5', rame: '#8d6e63', attente: '#bdbdbd', trou: '#eceff1' };
const PHASE_LABELS: Record<SurfPhase, string> = { glisse: t('sur la vague'), rame: t('rame'), attente: t('attente'), trou: t('sans signal') };
/** Bandes des vagues et des vols sur le graphe de vitesse. */
const WAVE_BAND_COLOR = '#1e88e5';
const FLIGHT_BAND_COLOR = '#7e57c2';

type WaveSort = 'ordre' | 'distance' | 'vitesse' | 'duree';
const WAVE_SORT_LABEL: Record<WaveSort, string> = { ordre: t('Ordre'), distance: t('Distance'), vitesse: t('Vitesse'), duree: t('Durée') };


/** Colonnes des vols propres au surf : vagues du vol, temps de vol hors des vagues vu par le GPS (ce n'est pas du pumping). */
const SURF_FLIGHT_PODIUM_COLUMNS: FlightColumn<SurfFlight>[] = [
  { header: t('Vagues'), cell: (f) => f.waveCount },
  { header: t('Hors vague'), cell: (f) => formatShortDuration(f.pumpS) },
];
const SURF_FLIGHT_ALL_COLUMNS: FlightColumn<SurfFlight>[] = [{ header: t('Vagues'), cell: (f) => f.waveCount }];

/** Bouton « Voir » d'une ligne de tableau : montre ou masque son passage sur la carte. */
const ShowButton = ({ shown, onClick, disabled }: { shown: boolean; onClick: () => void; disabled?: boolean }) => (
  <MapToggle shown={shown} disabled={disabled} color={ACCENT} ink="var(--on-ink)" onClick={onClick} />
);

/** Une ligne du graphe : `index` renvoie au point de trace d'origine. */
/** Curseur commun aux graphes de vitesse et de FC : ils lisent les mêmes lignes. */
const SURF_SYNC_ID = 'surf';
/** Graphes mémoïsés : sans changement de leurs props, un clic d'onglet ou un tri ne refait pas le dessin Recharts. */
const MemoTrackChart = memo(TrackChart) as typeof TrackChart;
const MemoHeartRateChart = memo(HeartRateChart) as typeof HeartRateChart;
const CHART_STYLE = chartBox(CHART_HEIGHT_PX);
const FILL_STYLE: CSSProperties = { width: '100%', flex: 1, minHeight: 0 };
const SPEED_SERIES: TrackSeries<ChartRow>[] = [{ kind: 'line', key: 'speed', name: t('Vitesse'), color: SPEED_COLOR, width: 1.5, activeDotR: 4 }];

interface ChartRow {
  index: number;
  /** Temps écoulé depuis le départ, en minutes : l'axe et son zoom. */
  minutes: number;
  speed: number;
  speedMs: number;
  /** FC lissée, `null` là où elle manque. */
  hr: number | null;
}

function SurfModule() {
  const {
    activity, setActivity, profile, thresholdOverride, speedUnit, distanceUnit, speedRange, defaultSpeedRange, foil: activityFoil,
    pumping: activityPumping, gearLabels, gearGroups, hrOffsetBpm,
  } = useSportSettings('surf');
  const gpx = useGpxSession({ profile });

  // Session de l'adresse et son brouillon : seuils, foil, couleurs ; écrit dans sa fiche par « Enregistrer la session ».
  const {
    sessionFile, requested: requestedFile, shownFile, error: sessionError, reading, draft, record: draftRecord, allActivities, changeActivity: changeSessionActivity,
  } = useAnalysisSession({ family: 'surf', activity, setActivity, load: gpx.loadGpxContent, loadedFile: gpx.fileName, preparing: gpx.reading });

  /** Seuil et foil de l'activité : ceux que la fiche de la session porte, sinon ceux de cet appareil. */
  const carried = sessionActivitySettings(draftRecord, { thresholdOverride: thresholdOverride ?? undefined, foil: activityFoil });
  /** Foil de la session (brouillon, puis fiche), sinon celui de l'activité. */
  const foil = draft.edits.foil ?? carried.foil ?? false;
  /** Pumping foil de la session (brouillon, puis fiche), sinon celui de l'activité ; sur foil seulement. */
  const pumping = foil && (draft.edits.pumping ?? activityPumping);
  /** Seuil de la glisse : celui de la session, sinon de l'activité, sinon le défaut, de vague ou de vol selon le foil. */
  const defaultThreshold = defaultActiveThresholdOf(profile, foil);
  const sessionDefaultThreshold = carried.thresholdOverride ?? defaultThreshold;
  const threshold = draft.edits.activeThreshold ?? sessionDefaultThreshold;
  const surfProfile = surfProfileOf(profile);
  const waveThreshold = surfProfile ? effectiveWaveThreshold(surfProfile.surf, draft.edits.waveThreshold) : 0;

  // Onglets de l'activité, rangée « avancé », surbrillance unique de la carte, point survolé effacé à chaque session.
  const { open, toggle, toggleOf, reveal, closeAll, advanced, shown, highlight } = useAnalysisTabs({
    tabs: SURF_TABS, defaults: SURF_SECTION_DEFAULTS, activity, sessionKey: gpx.sessionKey,
  });
  /** L'activité a une liste de matériel : de quoi proposer le rappel qui suit un enregistrement (`GearReminder`). */
  const hasGearList = useHasGearList(activity);
  const graphFolds = useOpenSections(`${STORAGE_ID}.graphes`, GRAPH_FOLDS_DEFAULT);
  /** FC de la session (ceinture, montre) et zones du pratiquant : l'onglet « cardio » et sa courbe sous la vitesse. */
  const { athlete, retainHr, heart, hrZones } = useAnalysisHeart(gpx.track, profile.heartRate, hrOffsetBpm);
  // Pumping des vols, par les capteurs de la session : il suit les vols, donc le seuil du brouillon.
  // Capteurs lus à l'ouverture de l'onglet « vols » ou « pumping », Pumping coché, comme en voile : une capture entière pèse plusieurs Mo ;
  // et à celle de l'onglet « vagues », pour les virages du gyroscope.
  const sensors = useSessionPumping(shownFile, (pumping && (open.vols || open.pumping)) || open.vagues);
  const pumpDetection = surfProfile?.pump ?? null;
  /** Seuils de l'aide des onglets « vagues » et « rame », lus ici en texte : un nombre tiré du profil, passé tel quel à `t`, fait renoncer le compilateur React à mémoïser le composant. */
  const cadenceMin = String(pumpDetection?.cadenceMinPerMin ?? 0);
  const cadenceMax = String(pumpDetection?.cadenceMaxPerMin ?? 0);
  const minWaveS = String(surfProfile?.surf.minWaveS ?? 0);
  const minWaveM = String(surfProfile?.surf.minWaveM ?? 0);
  const minWaitS = String(surfProfile?.surf.minWaitS ?? 0);
  const turnMinDeg = String(surfProfile?.surf.turnMinDeg ?? 0);
  const gyroMinDeg = String(surfProfile?.surf.gyroTurns.minDeg ?? 0);
  /** Capteurs vus du pumping : rien tant que Pumping est décoché, même lus pour les virages de l'onglet « vagues ». */
  const pumpSensors = pumping ? sensors : SENSORS_OFF;
  /** Onglet « pumping » : sur foil, pour un calcul qui le mesure, si la session a ses capteurs ; Pumping décoché, il le dit. */
  const pumpingVisible = foil && pumpDetection !== null && sensors.hasMotion;
  const sections = useMemo(
    () => shown((s) => (s.key !== 'vols' || foil) && (s.key !== 'pumping' || pumpingVisible) && (s.key !== 'cardio' || heart.present)),
    [shown, foil, pumpingVisible, heart.present]
  );
  const [waveSort, setWaveSort] = useState<WaveSort>('ordre');
  const narrow = useNarrowScreen();

  const { track, cumulative } = gpx;
  // Repères du bouton « Note » : fanions, liste de « Général », traits du graphe.
  const marks = useSessionMarks(draft, track, cumulative.cumDist);
  const shownMark = shownMarkOf(highlight);
  /** Zone cardiaque montrée sur la carte (onglet « cardio »). */
  const hrZone = useHeartRateZoneHighlight(highlight, open.cardio, heart, hrZones, track, profile.heartRate.gapS);
  const result = useMemo(
    () => (surfProfile && track.length > 1
      ? runSurfSession(track, cumulative, surfProfile, { threshold, foil, waveThreshold: draft.edits.waveThreshold })
      : null),
    [surfProfile, track, cumulative, threshold, foil, draft.edits.waveThreshold]
  );
  const summary = result?.summary ?? null;
  const analysis = result?.analysis ?? null;
  /** Meilleurs segments, calculés à l'ouverture de leur onglet. */
  const tops = useMemo(
    () => (open.tops && track.length > 1
      ? computeAllTopSegments(track, cumulative, profile.topTargets, (ms) => toDisplaySpeed(ms, speedUnit), { decimals: 1 })
      : null),
    [open.tops, track, cumulative, profile.topTargets, speedUnit]
  );
  const topShown = highlight.shownIn('tops');
  const totalDistanceM = cumulative.cumDist[cumulative.cumDist.length - 1] ?? 0;

  /** Bornes du dégradé de couleur, en m/s : celles de la session, sinon de Réglages, sinon le défaut de l'activité. */
  const range = effectiveSpeedRange({ sessionRange: draft.edits.speedRange, activityRange: speedRange, suggested: null, fallback: defaultSpeedRange });
  const treatment = sportTreatment(activity.base);
  const mapSegments = useMemo(
    (): TrackSegment[] => trackColorSegments(track, treatment, { minMs: range.minMs, maxMs: range.maxMs }),
    [track, treatment, range.minMs, range.maxMs]
  );
  const mapBounds = useMemo(() => trackBounds(track), [track]);

  const wavePct = summary && summary.totalS > 0 ? formatDecimal((summary.waveS / summary.totalS) * 100, 1) : '0';
  const flightPct = summary && summary.totalS > 0 ? formatDecimal((summary.flightS / summary.totalS) * 100, 1) : '0';
  /** Chiffres de l'onglet « général », proposés aussi pour l'image de partage. */
  const generalStats: ShareStat[] = summary ? [
    { key: 'totalTime', label: t('Durée de la session'), value: formatDuration(summary.totalS * 1000) },
    { key: 'waveTime', label: t('Sur la vague ({pct} %)', { pct: wavePct }), value: formatShortDuration(summary.waveS) },
    { key: 'waves', label: t('Vagues'), value: `${summary.waveCount}${summary.wavesPerHour !== null && summary.waveCount > 0 ? ` (${formatDecimal(summary.wavesPerHour, 1)} / h)` : ''}` },
    { key: 'averageWave', label: t('Distance moyenne'), value: orDash(summary.avgWaveDistanceM, (m) => `${Math.round(m)} m`) },
    { key: 'longestWave', label: t('Plus longue vague'), value: orDash(summary.longestWaveM, (m) => `${Math.round(m)} m`) },
    { key: 'maxSpeed', label: t('Vitesse max'), value: orDash(summary.maxWaveSpeedMs, (v) => formatSpeed(v, speedUnit)) },
    { key: 'waveSpeed', label: t('Moyenne sur la vague'), value: orDash(summary.avgWaveSpeedMs, (v) => formatSpeed(v, speedUnit)) },
    { key: 'paddleSpeed', label: t('Vitesse de rame'), value: orDash(summary.paddleSpeedMs, (v) => formatSpeed(v, speedUnit)), title: t('Moyenne en mouvement, arrêts courts exclus') },
    { key: 'return', label: t('Retour au pic (moyen)'), value: orDash(summary.avgReturnS, formatShortDuration), title: t("De la fin d'une vague à la première attente") },
    ...(foil ? [
      { key: 'longestFlight', label: t('Plus long vol'), value: orDash(summary.longestFlightS, formatShortDuration) },
      { key: 'flightTime', label: t('Ratio de vol ({pct} %)', { pct: flightPct }), value: formatShortDuration(summary.flightS) },
      { key: 'wavesInFlight', label: t('Vagues en un vol'), value: String(summary.maxWavesInFlight ?? '—'), title: t('Le plus de vagues reliées par un même vol') },
    ] : []),
    { key: 'distance', label: t('Distance totale'), value: formatDistance(totalDistanceM, distanceUnit) },
    ...heartRateShareStats(heart),
    // Appréciation, comme le résumé d'une fiche.
    ...shareExtraStats('surf', { rating: draft.edits.notes.rating }),
  ] : [];

  /**
   * Chiffres de l'onglet « général » : l'essentiel, le détail restant dans « avancé ».
   * L'image de partage garde la liste entière (`generalStats`).
   */
  const overviewKeys = ['totalTime', 'waves', 'waveTime', 'longestWave', 'maxSpeed', ...(foil ? ['flightTime', 'longestFlight'] : []), 'heartRate'];
  const overviewStats = overviewKeys.flatMap((key) => generalStats.filter((stat) => stat.key === key));

  // Une seule surbrillance : une vague (son numéro) ou le podium, un vol, une remontée.
  const waveShown = highlight.shownIn('vagues');
  const flightShown = highlight.shownIn('vols');
  const pumpingShown = highlight.shownIn('pumping');
  const returnShown = highlight.shownIn('rame');
  const waves = useMemo(() => analysis?.waves ?? [], [analysis]);
  const flights = useMemo(() => analysis?.flights ?? [], [analysis]);
  const returns = useMemo(() => analysis?.returns ?? [], [analysis]);
  /** Virages du gyroscope de chaque vague ; absente : vague sans capture, qui garde ceux du GPS. */
  const gyroTurns = useMemo(() => {
    const byWave = new Map<SurfWave, number>();
    if (!sensors.recording || !surfProfile) return byWave;
    const counts = gyroWaveTurns(sensors.recording, surfProfile.surf.gyroTurns, waves);
    waves.forEach((w, i) => {
      const n = counts[i];
      if (n !== null) byWave.set(w, n);
    });
    return byWave;
  }, [sensors.recording, surfProfile, waves]);

  const {
    byFlight: flightPumping, summary: pumpSummary, podium: podiumFlights, series: pumpSeriesList, seriesPodium,
  } = useFlightPumping(pumpSensors.recording, pumpDetection, track, cumulative, flights);
  const speedCell = speedCellOf(speedUnit);
  /** Colonnes « Tous les vols » du GPS, sans pumping mesuré : temps et vitesse hors des vagues (unité de l'activité). */
  const surfFlightGpsColumns: FlightColumn<SurfFlight>[] = [
    { header: t('Hors vague'), cell: (f) => formatShortDuration(f.pumpS) },
    { header: t('Vitesse hors vague ({unit})', { unit: SPEED_UNIT_LABEL[speedUnit] }), cell: (f) => speedCell(f.pumpSpeedMs) },
  ];

  /** Point d'arrivée d'une remontée sur la carte : le pic (début de l'attente), sinon la glisse suivante. */
  const returnEnd = useCallback(
    (r: SurfReturn): number => {
      const targetMs = r.returnS !== null ? r.startMs + r.returnS * 1000 : r.endMs;
      return nearestIndexAtTime(track, targetMs);
    },
    [track]
  );
  const shownSpans = useMemo((): TrackSpanShown[] => {
    /** Libellé d'un passage montré sur la carte : une phrase entière par genre de passage. */
    const spanLabel = (kind: 'vague' | 'vol', s: SurfSpan) => {
      const vars = {
        n: s.n,
        time: formatTimeOfDay(s.startMs),
        duration: formatShortDuration(s.durationS),
        distance: Math.round(s.distanceM),
        speed: formatSpeed(s.maxSpeedMs, speedUnit),
      };
      return kind === 'vague'
        ? t('Vague {n} · {time} · {duration} · {distance} m · max {speed}', vars)
        : t('Vol {n} · {time} · {duration} · {distance} m · max {speed}', vars);
    };
    if (waveShown === 'podium') {
      return [...waves].sort((a, b) => b.distanceM - a.distanceM).slice(0, 3)
        .map((w, k) => ({ key: `vague-${w.n}`, start: w.start, end: w.end, color: HIGHLIGHT_PODIUM_COLORS[k], label: spanLabel('vague', w) }));
    }
    if (waveShown !== null) {
      const w = waves.find((x) => String(x.n) === waveShown);
      return w ? [{ key: `vague-${w.n}`, start: w.start, end: w.end, color: HIGHLIGHT_SHOWN_COLOR, label: spanLabel('vague', w) }] : [];
    }
    // Onglets « vols » et « pumping » : un vol, une série de coups, ou l'un des deux podiums (`PumpingHighlightKey`).
    const flightOrSeries = flightShown ?? pumpingShown;
    if (flightOrSeries !== null) return pumpingHighlightSpans(flightOrSeries, flights, podiumFlights, pumpSeriesList, seriesPodium, (f) => spanLabel('vol', f));
    if (returnShown !== null) {
      const r = returns.find((x) => String(x.after) === returnShown);
      if (!r) return [];
      const start = nearestIndexAtTime(track, r.startMs);
      // Sur foil, les remontées suivent les vols, numérotés comme eux.
      const label = r.after === 0
        ? t('Première sortie')
        : foil ? t('Remontée après le vol {n}', { n: r.after }) : t('Remontée après la vague {n}', { n: r.after });
      return [{ key: `remontee-${r.after}`, start, end: returnEnd(r), color: HIGHLIGHT_SHOWN_COLOR, label: `${label} · ${formatTimeOfDay(r.startMs)}` }];
    }
    return [];
  }, [waveShown, flightShown, pumpingShown, returnShown, waves, flights, podiumFlights, pumpSeriesList, seriesPodium, returns, track, returnEnd, speedUnit, foil]);

  const sortedWaves = useMemo(() => {
    const list = [...waves];
    if (waveSort === 'distance') list.sort((a, b) => b.distanceM - a.distanceM);
    if (waveSort === 'vitesse') list.sort((a, b) => b.maxSpeedMs - a.maxSpeedMs);
    if (waveSort === 'duree') list.sort((a, b) => b.durationS - a.durationS);
    return list;
  }, [waves, waveSort]);

  // Graphe de vitesse au fil de la session, en heure du jour, zoomable.
  const timeChart = useTimeChartAxis(track, gpx.sessionKey);
  const { minutes: trackMinutes, zoom, cardioZoom } = timeChart;
  const speedSeries = useMemo(() => track.map((p) => p.smoothedSpeedMs), [track]);
  /**
   * Lignes des graphes sur une plage, au plus `CHART_MAX_POINTS` : lues dans le bloc qui suit le zoom (`ZoomView`),
   * gardées pour la dernière plage (`lastByRange`) : le panneau et la carte en plein écran ne les refont pas.
   */
  const chartDataAt = useMemo(() => lastByRange((view): ChartRow[] => {
    if (track.length === 0 || !open.graphiques) return [];
    const [first, last] = visibleIndexRange(trackMinutes, view);
    // Les extrêmes de la vitesse et de la FC restent : un pic bref de FC ne disparaît pas.
    return sampledIndicesKeeping(first, last, CHART_MAX_POINTS, [speedSeries, heart.smoothed]).map((i): ChartRow => ({
      index: i,
      minutes: trackMinutes[i],
      speed: parseFloat(toDisplaySpeed(track[i].smoothedSpeedMs, speedUnit).toFixed(2)),
      speedMs: track[i].smoothedSpeedMs,
      hr: heart.smoothed[i] === null || heart.smoothed[i] === undefined ? null : Math.round(heart.smoothed[i]!),
    }));
  }), [track, open.graphiques, trackMinutes, speedUnit, heart.smoothed, speedSeries]);
  /**
   * Les graphes ont des lignes, quelle que soit la plage : au moins deux points, la plage zoomée en garde toujours deux
   * (`visibleIndexRange` prend un voisin de chaque côté). Lu hors du bloc du zoom : le panneau ne dépend pas de la plage.
   */
  const chartsShown = open.graphiques && track.length > 1;
  /** Point survolé lu au-dessus des graphes (`HoverReadout`), s'il est dans la plage zoomée `z`. */
  const readAt = timeChart.readAt;
  const readSpeed = (z: ChartZoom) => (i: number): Readout | null => (timeChart.readable(z, i)
    ? speedReadout(formatSpeed(track[i].smoothedSpeedMs, speedUnit), readAt(i))
    : null);
  const readHeart = (z: ChartZoom) => (i: number): Readout | null => (timeChart.readable(z, i) ? heartRateReadout(heart.smoothed[i], readAt(i)) : null);
  /** Carte en plein écran (téléphone), seule ou avec les graphes d'un onglet. */
  const [mapExpanded, setMapExpanded] = useState(false);
  /** « +carte » des graphes zoomés : tronçon en violet, cadrage, plein écran carte + graphes au téléphone. */
  const zoomOnMap = useZoomOnMap({
    highlight,
    points: track,
    charts: {
      graphiques: { zoom, axis: trackMinutes },
      cardio: { zoom: cardioZoom, axis: trackMinutes },
    },
    narrow,
    mapAnchorId: ANALYSIS_MAP_ANCHOR,
    mapExpanded,
    openMap: () => setMapExpanded(true),
  });
  const { show: showZoomOnMap } = zoomOnMap;
  const { retainSessionHrMax, showCardioOnMap } = useCardioShortcuts(track, retainHr, showZoomOnMap);
  const showGraphsOnMap = useCallback(() => showZoomOnMap('graphiques'), [showZoomOnMap]);
  /** Axes, repères et bandes des graphes : stables tant que la session, l'unité et les repères ne changent pas. */
  const speedYAxes = useMemo(
    () => [{ color: SPEED_COLOR, unit: SPEED_UNIT_LABEL[speedUnit], domain: [0, 'auto'] as [number, 'auto'], width: 46, tickFormatter: (v: number) => formatSpeedValue(v, speedUnit) }],
    [speedUnit]
  );
  const speedOverlays = useMemo(() => {
    const t0 = track.length > 0 ? track[0].timeMs : 0;
    const minutes = (ms: number) => (track.length > 0 ? (ms - t0) / 60000 : 0);
    return [
      ...markReferenceLines(marks.located, (m) => minutes(m.mark.timeMs), shownMark),
      ...(foil ? flights : []).map((f) => (
        <ReferenceArea key={`vol-${f.n}`} x1={minutes(f.startMs)} x2={minutes(f.endMs)} fill={FLIGHT_BAND_COLOR} fillOpacity={0.1} ifOverflow="hidden" />
      )),
      ...waves.map((w) => (
        <ReferenceArea key={`vague-${w.n}`} x1={minutes(w.startMs)} x2={minutes(w.endMs)} fill={WAVE_BAND_COLOR} fillOpacity={0.18} ifOverflow="hidden" />
      )),
    ];
  }, [track, marks.located, shownMark, foil, flights, waves]);
  const heartOverlays = useMemo(() => {
    const t0 = track.length > 0 ? track[0].timeMs : 0;
    return markReferenceLines(marks.located, (m) => (m.mark.timeMs - t0) / 60000, shownMark, 'hr');
  }, [track, marks.located, shownMark]);
  const hrThresholds = useMemo(() => (hrZones ? { s1: hrZones.s1, s2: hrZones.s2 } : null), [hrZones]);

  /** Graphe de vitesse : bandes des vagues et des vols, repères ; dans l'onglet, et sous la carte en plein écran. */
  const speedChart = (z: ChartZoom, chartData: ChartRow[], style: CSSProperties) => (
    <MemoTrackChart rows={chartData} zoom={z} x={timeChart.timeX} series={SPEED_SERIES} syncId={SURF_SYNC_ID}
      yAxes={speedYAxes} onShowOnMap={showGraphsOnMap} style={style}>
      {speedOverlays}
    </MemoTrackChart>
  );
  /** Courbe de FC de « graphiques » ; ses boutons de zoom quand la vitesse est repliée. */
  const heartChart = (z: ChartZoom, chartData: ChartRow[], speedShown: boolean) => (
    <MemoHeartRateChart data={chartData} zoom={z} x={timeChart.timeX} zones={hrZones?.bounds ?? null} thresholds={hrThresholds}
      syncId={SURF_SYNC_ID} showReset={!speedShown} onShowOnMap={showGraphsOnMap} style={CHART_STYLE}>
      {heartOverlays}
    </MemoHeartRateChart>
  );
  /** Graphes de l'onglet d'où vient « +carte », sous la carte en plein écran (téléphone). */
  const companionCharts = (panel: SurfTab | null): ReactNode => {
    switch (panel) {
      case 'graphiques': {
        const speedShown = !heart.present || graphFolds.open.vitesse;
        return chartsShown ? (
          <ZoomView zoom={zoom}>
            {(z) => {
              const chartData = chartDataAt(z.view);
              return chartData.length > 1 ? (
                <>
                  {speedShown && (
                    <>
                      <HoverReadout line read={readSpeed(z)} label={t('Vitesse')} color={SPEED_COLOR} />
                      {speedChart(z, chartData, CHART_STYLE)}
                    </>
                  )}
                  {heart.present && graphFolds.open.fc && (
                    <>
                      <HoverReadout line read={readHeart(z)} label={t('FC')} color={HEART_RATE_COLOR} />
                      {heartChart(z, chartData, speedShown)}
                    </>
                  )}
                </>
              ) : null;
            }}
          </ZoomView>
        ) : null;
      }
      case 'cardio':
        return <CardioCompanion minutes={trackMinutes} heart={heart} zoom={cardioZoom} zones={hrZones} onShowOnMap={() => zoomOnMap.show('cardio')} style={chartBox(CHART_HEIGHT_PX)} />;
      default:
        return null;
    }
  };

  const mapLayers = (
    <AnalysisBaseLayers family="surf" file={sessionFile} track={track} zonePaths={hrZone.paths} zonePathsKey={hrZone.selectedZone}
      zoomPath={zoomOnMap.path} marks={marks.located} shownMark={shownMark}>
      <TrackSegmentsLayer segments={mapSegments} weight={5} family={'surf'} />
      <TrackArrows track={track} />
      <TrackSpanLayer track={track} spans={shownSpans} />
      <TopsHighlight tops={tops} selected={topShown} />
    </AnalysisBaseLayers>
  );

  const unitLabel = SPEED_UNIT_LABEL[speedUnit];
  const noWaveSpeed = formatSpeed(fromDisplaySpeed(foil ? waveThreshold : threshold, profile.thresholdUnit), speedUnit);
  const speedSource = speedSourceText(gpx.hasDeviceSpeed, gpx.deviceSpeedUnit);
  const hasCourse = track.some((p) => p.courseDeg !== undefined);
  const rideWord = foil ? t('vol') : t('vague');
  const measuredReturns = returns.filter((r) => r.after > 0);
  const firstOut = returns.find((r) => r.after === 0) ?? null;

  return (
    <AnalysisShell title={t('Analyse Surf')} family="surf" backLabel={t('Sessions')} file={gpx.fileName}
      share={{ segments: mapSegments, stats: generalStats }} error={sessionError} draft={draft} loadError={gpx.error}
      reading={reading}
      empty={!summary && !gpx.error && requestedFile === null}
      gearReminder={{
        activityId: activity.id, hasGearList, ready: shownFile !== null && draftRecord !== null,
        sessionHasGear: notesHaveGear(draft.edits.notes, gearFieldsFor(gearLabels)),
        tabShown: sections.some((s) => s.key === 'notes'), tabLabel: t('matériel et notes'),
        covered: mapExpanded, onAdd: () => reveal('notes'),
      }}
      map={{
        panelId: panelId('carte'),
        expanded: mapExpanded,
        onExpandedChange: (next) => {
          setMapExpanded(next);
          if (!next) zoomOnMap.closeCompanion();
        },
        focus: zoomOnMap.focus,
        companion: companionCharts(zoomOnMap.companionPanel),
        sessionKey: gpx.sessionKey,
        bounds: mapBounds,
        layers: mapLayers,
        defaultHeight: 480,
        legend: track.length === 0 ? null : <SpeedGradientLegend unit={speedUnit} range={range} slowLabel={t('rame et attente')} />,
      }}
      tabs={summary && analysis && surfProfile ? {
        sections, open, onToggle: toggle, onCloseAll: closeAll, advanced, accent: ACCENT, activityColor: activity.color, panels: (
          <>
            {open.general && (
              <ResizablePanel id={panelId('general')} style={ANALYSIS_PANEL_STYLE}>
                <PanelHeading label={t('Général')} extra={<SessionDate track={gpx.track} />} open={open.general} onToggle={toggleOf('general')} />
                <GeneralStats stats={overviewStats} />
                {draft.edits.foil === null && (
                  <div className="ui-muted ui-text-xs ui-mt-8">
                    {foil
                      ? t("Sur foil, supposé d'après l'activité : la session ne le dit pas. Il se règle dans l'onglet réglages.")
                      : t("Sans foil, supposé d'après l'activité : la session ne le dit pas. Il se règle dans l'onglet réglages.")}
                  </div>
                )}
                {summary.totalS > 0 && (
                  <div className="ui-mt-12">
                    <div className="an-surf-bar"
                      title={t('Répartition du temps de la session')}>
                      {(Object.keys(PHASE_COLORS) as SurfPhase[]).map((phase) => {
                        const s = phase === 'glisse' ? summary.glisseS : phase === 'rame' ? summary.rameS : phase === 'attente' ? summary.attenteS : summary.trouS;
                        return s > 0 ? <span key={phase} style={{ width: `${(s / summary.totalS) * 100}%`, backgroundColor: PHASE_COLORS[phase] }} /> : null;
                      })}
                    </div>
                    <div className="an-surf-legend">
                      {(Object.keys(PHASE_COLORS) as SurfPhase[]).map((phase) => {
                        const s = phase === 'glisse' ? summary.glisseS : phase === 'rame' ? summary.rameS : phase === 'attente' ? summary.attenteS : summary.trouS;
                        if (s <= 0) return null;
                        const label = phase === 'glisse' && foil ? t('en vol') : PHASE_LABELS[phase];
                        // Sans foil, la glisse est faite des vagues : son temps est déjà « Sur la vague » au-dessus,
                        // la légende ne le redit pas. Sur foil, « en vol » est une autre durée.
                        const repeated = phase === 'glisse' && !foil;
                        return (
                          <span key={phase} className="ui-inline-row-4 ui-center">
                            <Swatch color={PHASE_COLORS[phase]} bordered />
                            {label}{repeated ? '' : ` ${Math.round((s / summary.totalS) * 100)} %`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <SessionMarksList view={marks} distanceUnit={distanceUnit} shownMs={shownMark} accent={ACCENT}
                  onShow={(ms) => highlight.show('general', ms === null ? null : String(ms))} />
              </ResizablePanel>
            )}

            {open.vagues && (
              <ResizablePanel id={panelId('vagues')} style={ANALYSIS_PANEL_STYLE}>
                <div className="ui-row-10 ui-center ui-wrap ui-mb-10">
                  <PanelTitle label={t('Vagues ({n})', { n: waves.length })} open={open.vagues} onToggle={toggleOf('vagues')} helpKey="surf:vagues" />
                  <span className="ui-grow" />
                  {waves.length > 1 && (
                    <>
                      <label className="ui-text-xs ui-row-4 ui-center">
                        {t('Tri')}
                        <SegmentedControl<WaveSort> label={t('Tri des vagues')} accent={ACCENT} value={waveSort} onChange={setWaveSort}
                          items={(Object.keys(WAVE_SORT_LABEL) as WaveSort[]).map((k) => ({ key: k, label: WAVE_SORT_LABEL[k] }))} />
                      </label>
                      <Button size="s" aria-pressed={waveShown === 'podium'} onClick={() => highlight.show('vagues', waveShown === 'podium' ? null : 'podium')}>
                        {waveShown === 'podium' ? t('Masquer les 3 plus longues') : t('Les 3 plus longues')}
                      </Button>
                    </>
                  )}
                </div>
                <HelpText helpKey="surf:vagues" note>
                  {foil
                    ? t("Vague : un passage d'au moins {s} s au-dessus du seuil de vague en foil, pendant un vol.", { s: minWaveS })
                    : t('Vague : au moins {s} s et {m} m au-dessus du seuil de vague.', { s: minWaveS, m: minWaveM })}
                  {gyroTurns.size > 0
                    ? <>{' '}{t("Virages : comptés par le gyroscope du téléphone, chaque rotation du buste d'au moins {deg}°. * Vague sans capture : seuls les grands changements de direction (au moins {turn}°) vus par le GPS, valeur expérimentale.", { deg: gyroMinDeg, turn: turnMinDeg })}</>
                    : <>{' '}{t('* Virages : seuls les grands changements de direction (au moins {turn}°) se voient à une position par seconde ; un bottom turn ou un top turn bref peut échapper au GPS. Valeur expérimentale.', { turn: turnMinDeg })}</>}
                </HelpText>
                {waves.length === 0 ? (
                  <div className="ui-muted">
                    {foil
                      ? t("Aucune vague : rien n'a dépassé le seuil de vague en foil ({speed}) pendant {s} s. Il se règle dans l'onglet réglages.", { speed: noWaveSpeed, s: minWaveS })
                      : t("Aucune vague : rien n'a dépassé le seuil de vague ({speed}) pendant {s} s. Il se règle dans l'onglet réglages.", { speed: noWaveSpeed, s: minWaveS })}
                  </div>
                ) : (
                  <div className="ui-overflow-x">
                    <table className="ui-table">
                      <thead>
                        <tr className="ui-sunken">
                          <th style={thStyle}>{t('N°')}</th>
                          <th style={thStyle}>{t('Heure')}</th>
                          <th style={thStyle}>{t('Durée')}</th>
                          <th style={thStyle}>{t('Distance')}</th>
                          <th style={thStyle}>{t('Max ({unit})', { unit: unitLabel })}</th>
                          <th style={thStyle}>{t('Moy.')}</th>
                          {gyroTurns.size > 0
                            ? <th style={thStyle} title={t('Virages comptés par le gyroscope ; * : vague sans capture, grands changements de direction vus par le GPS')}>{t('Virages')}</th>
                            : <th style={thStyle} title={t('Grands changements de direction vus par le GPS')}>{t('Virages*')}</th>}
                          {foil && <th style={thStyle}>{t('Vol')}</th>}
                          <th style={thStyle}>{t('Carte')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedWaves.map((w) => {
                          const shown = waveShown === String(w.n);
                          return (
                            <tr key={w.n} className="ui-table__row">
                              <td className="ui-cell-tight ui-cell--bold">{w.n}</td>
                              <td style={tdStyle}>{formatTimeOfDay(w.startMs).slice(0, 5)}</td>
                              <td style={tdStyle}>{formatShortDuration(w.durationS)}</td>
                              <td className="ui-cell-tight ui-cell--bold">{Math.round(w.distanceM)} m</td>
                              <td style={tdStyle}>{formatSpeedValue(toDisplaySpeed(w.maxSpeedMs, speedUnit), speedUnit)}</td>
                              <td style={tdStyle}>{formatSpeedValue(toDisplaySpeed(w.avgSpeedMs, speedUnit), speedUnit)}</td>
                              <td style={tdStyle}>{gyroTurns.get(w) ?? (gyroTurns.size > 0 ? `${w.turns}*` : w.turns)}</td>
                              {foil && <td style={tdStyle}>{w.flight ?? '—'}</td>}
                              <td style={tdStyle}>
                                <ShowButton shown={shown} onClick={() => highlight.show('vagues', shown ? null : String(w.n))} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </ResizablePanel>
            )}

            {open.rame && (
              <ResizablePanel id={panelId('rame')} style={ANALYSIS_PANEL_STYLE}>
                <PanelHeading label={t('Rame et retour au pic')} open={open.rame} onToggle={toggleOf('rame')} helpKey="surf:rame" />
                <HelpText helpKey="surf:rame" note>
                  {foil
                    ? t("Retour au pic : de la fin d'un vol au début de la première attente (immobile au moins {s} s) ; un arrêt plus court (canard, série) compte dans la rame.", { s: minWaitS })
                    : t("Retour au pic : de la fin d'une vague au début de la première attente (immobile au moins {s} s) ; un arrêt plus court (canard, série) compte dans la rame.", { s: minWaitS })}
                  {' '}{t("Remontée : distance à vol d'oiseau jusqu'au pic, divisée par ce temps. Rame : vitesse en mouvement.")}
                </HelpText>
                <div className="an-sheet__stats an-sheet__stats--always">
                  <StatTile label={t('Vitesse de rame')} value={orDash(summary.paddleSpeedMs, (v) => formatSpeed(v, speedUnit))} title={t('Moyenne en mouvement, arrêts courts exclus')} />
                  <StatTile label={t('Vitesse de remontée')} value={orDash(summary.avgReturnSpeedMs, (v) => formatSpeed(v, speedUnit))} title={t("Distance à vol d'oiseau de la fin de la vague au pic, divisée par le temps du retour")} />
                  <StatTile label={t('Retour au pic (moyen)')} value={orDash(summary.avgReturnS, formatShortDuration)} />
                  <StatTile label={t('Meilleur retour')} value={orDash(summary.bestReturnS, formatShortDuration)} />
                  <StatTile label={t('Première sortie')} value={orDash(summary.firstOutS, formatShortDuration)} title={t('Du premier mouvement à la première attente, marche sur la plage comprise')} />
                  <StatTile label={foil ? t('Vols enchaînés') : t('Vagues enchaînées')} value={summary.chainedCount} title={t('Prise sans attente depuis la précédente : pas de retour au pic mesuré')} />
                  <StatTile label={t('Temps de rame')} value={formatShortDuration(summary.rameS)} />
                  <StatTile label={t("Temps d'attente")} value={formatShortDuration(summary.attenteS)} />
                </div>
                {(measuredReturns.length > 0 || firstOut) && (
                  <div className="ui-overflow-x ui-mt-10">
                    <table className="ui-table">
                      <thead>
                        <tr className="ui-sunken">
                          <th style={thStyle}>{t('Après')}</th>
                          <th style={thStyle}>{t('Retour')}</th>
                          <th style={thStyle}>{t('Distance')}</th>
                          <th style={thStyle}>{t('Remontée')}</th>
                          <th style={thStyle}>{t('Rame')}</th>
                          <th style={thStyle}>{t('Attente')}</th>
                          <th style={thStyle}>{t('Carte')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(firstOut ? [firstOut] : []), ...measuredReturns].map((r) => {
                          const shown = returnShown === String(r.after);
                          return (
                            <tr key={r.after} className="ui-table__row">
                              <td className="ui-cell-tight ui-cell--bold">{r.after === 0 ? t('départ') : `${rideWord} ${r.after}`}</td>
                              <td style={tdStyle}>{r.returnS === null ? t('enchaîné') : formatShortDuration(r.returnS)}</td>
                              <td style={tdStyle}>{r.straightM === null ? '—' : `${Math.round(r.straightM)} m`}</td>
                              <td style={tdStyle}>{orDash(r.returnSpeedMs, (v) => formatSpeed(v, speedUnit))}</td>
                              <td style={tdStyle}>{orDash(r.paddleSpeedMs, (v) => formatSpeed(v, speedUnit))}</td>
                              <td style={tdStyle}>{formatShortDuration(r.waitS)}</td>
                              <td style={tdStyle}>
                                <ShowButton shown={shown} onClick={() => highlight.show('rame', shown ? null : String(r.after))} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </ResizablePanel>
            )}

            {open.vols && foil && (
              <ResizablePanel id={panelId('vols')} style={ANALYSIS_PANEL_STYLE}>
                <FlightsPanel
                  helpKey="surf:vols" open={open.vols} onToggle={toggleOf('vols')}
                  help={<>
                    {t("Vol : au-dessus du seuil de vol, d'une traite ; ses vagues sont ses passages au-dessus du seuil de vague en foil.")}
                    {' '}
                    {flightPumping
                      ? t("Décollage : vitesse GPS quand les chocs de la planche sur l'eau cessent (expérimental) ; séries et temps pompé : ceux de l'onglet pumping.")
                      : t("Hors vague : le temps du vol passé hors des vagues, vu par le GPS ; sans les capteurs, rien ne dit s'il est pompé.")}
                  </>}
                  flights={flights} podium={podiumFlights}
                  extraFlightTiles={<StatTile label={t('Vagues en un vol')} value={summary.maxWavesInFlight ?? '—'} />}
                  pumping={flightPumping} pumpSummary={pumpSummary}
                  shown={flightShown} onShow={(key) => highlight.show('vols', key)} accent={ACCENT}
                  speedCell={speedCell} unitLabel={unitLabel}
                  podiumColumns={SURF_FLIGHT_PODIUM_COLUMNS}
                  allColumns={SURF_FLIGHT_ALL_COLUMNS}
                  allColumnsWithoutPumping={surfFlightGpsColumns}
                  sensors={pumpSensors} />
              </ResizablePanel>
            )}

            {open.pumping && pumpingVisible && (
              <ResizablePanel id={panelId('pumping')} style={ANALYSIS_PANEL_STYLE}>
                <PumpingPanel
                  helpKey="surf:pumping" open={open.pumping} onToggle={toggleOf('pumping')}
                  help={<>
                    {t('Pumping : en vol seulement (onglet vols), compté par séries de coups mesurées par les capteurs du téléphone ;')}
                    {pumpDetection
                      ? <>{' '}{t('une série ne compte que si ses coups suivent une cadence régulière, de {min} à {max} coups par minute.', { min: cadenceMin, max: cadenceMax })}</>
                      : null}
                    {' '}{t('Cadence : coups par minute de la série ; vitesse : au début, puis à la fin de la série.')}
                  </>}
                  pumping={flightPumping} pumpSummary={pumpSummary} series={pumpSeriesList} seriesPodium={seriesPodium}
                  shown={pumpingShown} onShow={(key) => highlight.show('pumping', key)} accent={ACCENT}
                  speedCell={speedCell} unitLabel={unitLabel}
                  pumpingOn={pumping} sensors={pumpSensors} flightTimeS={flights.reduce((sum, f) => sum + f.durationS, 0)}
                  offNote={PUMPING_OFF_NOTE} />
              </ResizablePanel>
            )}

            {open.tops && tops && (
              <ResizablePanel id={panelId('tops')} style={ANALYSIS_PANEL_STYLE}>
                <TopsPanel targets={profile.topTargets} tops={tops} unit={speedUnit} selected={topShown}
                  onSelect={(key) => highlight.show('tops', key)} accent={ACCENT} open={open.tops} onToggle={toggleOf('tops')} />
              </ResizablePanel>
            )}

            {chartsShown && (() => {
              // Sans FC, un seul graphe : pas de repli. Avec, chacun le sien, « Tout voir » sur le premier montré.
              const folds = heart.present;
              const speedShown = !folds || graphFolds.open.vitesse;
              const hrShown = heart.present && graphFolds.open.fc;
              return (
              <ResizablePanel id={panelId('graphiques')} defaultHeight={folds ? undefined : 360} minHeight={folds ? 120 : 200} direction="vertical"
                style={{ ...PANEL_BLOCK_STYLE, display: 'flex', flexDirection: 'column', overflow: folds ? 'auto' : 'hidden' }}>
                {/* Le panneau suit le zoom, pas le module. */}
                <ZoomView zoom={zoom}>
                  {(z) => {
                    const chartData = chartDataAt(z.view);
                    return (
                      <>
                        <div className="chart-head ui-mb-8 ui-pr-28">
                          <PanelTitle label={t('Vitesse')} open={open.graphiques} onToggle={toggleOf('graphiques')} helpKey="surf:graphiques" />
                          {!folds && <HoverReadout read={readSpeed(z)} />}
                        </div>
                        <HelpText helpKey="surf:graphiques" note>
                          {t('Le survol déplace le repère sur la carte.')}
                          {folds ? ` ${t('Chaque graphe se replie par son nom.')}` : ''}
                          {` ${zoomHint(narrow)}`}
                        </HelpText>
                        {folds && (
                          <GraphFoldHead label={t('Vitesse')} color={SPEED_COLOR} open={graphFolds.open.vitesse} onToggle={() => graphFolds.toggle('vitesse')}
                            read={speedShown ? readSpeed(z) : undefined}
                            title={graphFolds.open.vitesse ? t('Replier le graphe de vitesse') : t('Montrer le graphe de vitesse')} />
                        )}
                        {speedShown && speedChart(z, chartData, folds ? CHART_STYLE : FILL_STYLE)}
                        {folds && (
                          <GraphFoldHead label={t('FC')} color={HEART_RATE_COLOR} open={graphFolds.open.fc} onToggle={() => graphFolds.toggle('fc')}
                            read={hrShown ? readHeart(z) : undefined} style={{ marginTop: '8px' }}
                            title={graphFolds.open.fc ? t('Replier le graphe de FC') : t('Montrer le graphe de FC')} />
                        )}
                        {hrShown && heartChart(z, chartData, speedShown)}
                      </>
                    );
                  }}
                </ZoomView>
                <div className="ui-muted ui-text-xs ui-mt-6 ui-no-shrink">
                  {foil ? t('Bandes bleues : les vagues, violettes : les vols.') : t('Bandes bleues : les vagues.')}
                </div>
              </ResizablePanel>
              );
            })()}

            {open.cardio && heart.present && (
              <CardioTab id={panelId('cardio')} track={track} minutes={trackMinutes} heart={heart} params={profile.heartRate} hrEnergy={profile.hrEnergy} zones={hrZones} athlete={athlete}
                onRetainHrMax={retainSessionHrMax} zone={hrZone}
                zoom={cardioZoom} onShowOnMap={showCardioOnMap}
                open={open.cardio} onToggle={toggleOf('cardio')} />
            )}

            {open.notes && (
              <NotesTab id={panelId('notes')} draft={draft} family="surf" conditions="libre"
                gearFields={gearFieldsFor(gearLabels)} gearGroups={gearGroups} activityId={activity.id} open={open.notes} onToggle={toggleOf('notes')} />
            )}

            {open.reglages && (
              <ResizablePanel id={panelId('reglages')} style={ANALYSIS_PANEL_STYLE}>
                <SessionSettingsHeader helpKey="surf:reglages" open={open.reglages} onToggle={toggleOf('reglages')}>
                  {t('Vitesse : {source}', { source: speedSource })}
                  {' · '}{t('Cap : {source}.', { source: hasCourse ? t("fourni par l'appareil") : t('tiré des positions') })}
                </SessionSettingsHeader>
                <div className="ui-row-18 ui-center ui-wrap">
                  <SessionActivityField activities={allActivities} activity={activity} families={sessionFile ? undefined : ['surf']}
                    onChange={(next) => changeSessionActivity(sessionFile, next)} />
                  <FoilPumpingFields
                    foilTitle={t("Surf foil pour cette session, enregistré avec elle. Celui de l'activité se règle dans Réglages.")}
                    foil={foil} foilIsDefault={draft.edits.foil === null} onFoilChange={(next) => draft.update({ foil: next })}
                    showPumping={foil} pumping={pumping} pumpingIsDefault={draft.edits.pumping === null}
                    onPumpingChange={(next) => draft.update({ pumping: next === activityPumping ? null : next })} />
                </div>
                <div className="ui-stack-10 ui-mt-12">
                  <SessionThresholdField
                    label={foil ? t('Seuil de vol') : t('Seuil de vague')}
                    title={foil
                      ? t("Au-dessus, la planche vole. Seuil propre à cette session, enregistré avec elle. Sans lui, elle garde celui avec lequel elle a été calculée ; le changer dans Réglages recalcule les sessions de l'activité.")
                      : t("Au-dessus, la planche est sur la vague. Seuil propre à cette session, enregistré avec elle. Sans lui, elle garde celui avec lequel elle a été calculée ; le changer dans Réglages recalcule les sessions de l'activité.")}
                    value={threshold}
                    defaultValue={sessionDefaultThreshold}
                    isOverridden={draft.edits.activeThreshold !== null}
                    note={draftRecord && carriedThresholdNote(carriedSettings(draftRecord).threshold, thresholdOverride, (value) =>
                      `${formatDecimal(toDisplaySpeed(fromDisplaySpeed(value, profile.thresholdUnit), speedUnit), 1)} ${SPEED_UNIT_LABEL[speedUnit]}`)}
                    unit={speedUnit}
                    thresholdUnit={profile.thresholdUnit}
                    onChange={(next) => draft.update({ activeThreshold: next })} />
                  {foil && (
                    <SessionThresholdField
                      label={t('Seuil de vague en foil')}
                      title={t('Pendant un vol, au-dessus : porté par une vague ; en dessous : pompé.')}
                      value={waveThreshold}
                      defaultValue={surfProfile.surf.foilWaveThreshold}
                      isOverridden={draft.edits.waveThreshold !== null}
                      unit={speedUnit}
                      thresholdUnit={profile.thresholdUnit}
                      onChange={(next) => draft.update({ waveThreshold: next })} />
                  )}
                  {track.length > 0 && (
                    <SessionColorRangeField unit={speedUnit} range={range} isOverridden={draft.edits.speedRange !== null}
                      onChange={(next) => draft.update({ speedRange: next })} />
                  )}
                </div>
              </ResizablePanel>
            )}
          </>
        ),
      } : null} />
  );
}

export default SurfModule;
