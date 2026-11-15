import { roundBearingDeg } from '../core/angles';
import { errorMessage } from '../core/basics';
import { t, tn } from '../core/i18n';
import { tRich, tnRich } from '../components/tRich';
import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ActivitySelect from '../components/ActivitySelect';
import BeltStatus from '../components/BeltStatus';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import HoldButton from '../components/ui/HoldButton';
import FollowTracePicker from '../components/FollowTracePicker';
import PageHeader from '../components/ui/PageHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ChoiceOption, ChoiceSheet } from '../components/ui/ChoiceSheet';
import SavedSessionShare from '../components/SavedSessionShare';
import SessionEndGear from '../components/SessionEndGear';
import { IconFlag, IconLock, IconPause, IconPlay, IconRoute } from '../components/icons';
import { parseGpx } from '../core/gpxParser';
import {
  FAMILY_ACCENT, FAMILY_LABEL, activitiesOfFamily, activityDisplayName, activityFamily, type Activity,
} from '../core/activities';
import { LIVE_TRACK_COLOR } from '../components/mapStyles';
import {
  sportFamily, sportTreatment, usesMarkCourse, type SportFamily,
} from '../core/sportProfiles';
import type { SportType } from '../core/types';
import { formatClock, formatDistance, formatShortDistance, formatSpeed, formatDecimal } from '../core/units';
import LiveMap from '../components/LiveMap';
import { clearFollowedTrace, useFollowedTrace } from '../hooks/useFollowedTrace';
import { useTransientValue } from '../hooks/useTransientValue';
import { liveStatsOptionsFor, useLiveRecording } from '../hooks/useLiveRecording';
import { useBeltLive } from '../hooks/useBeltLive';
import { useBeltWarmup } from '../hooks/useBeltWarmup';
import { useSatellites } from '../hooks/useSatellites';
import { useMissingPermissions } from '../hooks/usePermissions';
import { setBeepsMuted, skipMark, useMarkGuide } from '../hooks/useMarkGuide';
import { usePerActivityChoice } from '../hooks/usePerActivityChoice';
import { useOpenSections } from '../hooks/useOpenSections';
import { usePhoneLandscape } from '../hooks/useNarrowScreen';
import { readHeartRateZoneBounds } from '../hooks/useAthleteProfile';
import {
  effectiveDistanceUnit, effectiveFoil, effectiveHeartRate, effectiveJumpSettings, effectiveLiveFields, effectivePumping, effectiveSpeedUnit, effectiveStopHoldMs, effectiveTurns, lastRecordActivity, rememberRecordActivity, useVisibility,
} from '../hooks/useSportSettings';
import { getMotionCapabilities, type MotionCapabilities } from '../platform/motion';
import { beltLabels } from '../platform/beltList';
import { BELT_STATE_LABEL, chooseSavedBelt, savedBelt, savedBelts, type BeltState, type HeartRateBelt } from '../platform/heartRate';
import { JUMP_PLACEMENT_LABEL } from '../recording/jumpSettings';
import { PERMISSION_LABEL } from '../recording/permissionsPrompt';
import { useOpenSession } from '../hooks/useLibraryNavigation';
import { librarySession, updateSessionRecord, useLibrarySession } from '../hooks/useSessionLibrary';
import { EMPTY_NOTES, type GearChoice } from '../library/notes';
import { sessionDisplayName } from '../library/sessionName';
import {
  addRecordingMark, analyzePendingSession, changeRecordingActivity, continuePendingSession, discardPendingSession, dismissRecorderResult,
  finishingPendingSession, getLastFix, getLiveFixes, getLiveHeadingFixes, getLiveSegmentCount, markRecorderResultOpened,
  openRecordingLocationSettings, pauseRecording, resumeRecording, retakeRecordingBelt, retryRecordingBelt, retryRecordingGps, startRecording,
  stopRecording, stopRecordingBeltSearch, type RecorderState,
  useLivePosition, useRecordingClock, useRecorderSelector,
} from '../hooks/useRecorder';
import { followedTraceLengthM, splitFollowedTrace, type FollowProgress, type FollowedTrace } from '../recording/followedTrace';
import { travelHeading } from '../recording/heading';
import {
  recentWindowLabel,
  liveFieldLabel, liveFieldValue, type LiveFieldContext, type LiveFieldUnits,
} from '../recording/liveFields';
import { LIVE_LEG_DEFAULTS, type LiveLeg } from '../recording/liveLegs';
import { beltRetryOffer, beltRetryUnderAlert, gpsRetryOffer, warmupRetryShown } from '../recording/recordingRetry';
import { courseMarks, markName, type LatLon, type MarkGuideView } from '../recording/markGuide';
import { LIVE_STATS_DEFAULTS, type LiveStats, type LiveStatsOptions } from '../recording/liveStats';
import { canDownloadFiles, downloadTextFile, readPickedFile } from '../platform/files';
import { createReplaySource, deviceLocationSource, type LocationFix } from '../platform/location';
import { buzz } from '../platform/beeper';
import { isNativeApp } from '../platform/runtime';
import { canLockOrientation, isOrientationLocked, keepScreenOn, lockOrientation, subscribeOrientationLock } from '../platform/screen';
import { fixesFromRawPoints, recordingDurationMs, isAutoPause, isManualPause } from '../recording/session';
import './RecordingPage.css';

/**
 * Enregistrement d'une session : support, démarrer, arrêter, et ce qu'il faut
 * pour juger en direct que l'enregistrement tient (points, durée, plus long
 * trou, précision). À l'arrêt, la session se range seule dans la mémoire et
 * son analyse s'ouvre (`FinishRecording`, `App.tsx`) ; on la jette
 * depuis l'analyse. La carte de la session en attente ne reste que comme
 * filet : rangement en échec (« Analyser » réessaie, « Jeter » l'abandonne),
 * ou session reprise après une coupure qui peut encore continuer. La carte
 * « Session rangée » ne reste que pour une session hors de la mémoire ou à
 * classer. L'onglet « Enregistrer » de la barre de navigation.
 *
 * « Suivre une trace » choisit un itinéraire rangé ou une session déjà
 * enregistrée, dessiné sous la trace en cours, la partie faite en gris, avec
 * la distance restante le long de la trace ; au repos, la carte le montre en
 * aperçu. En voile, un itinéraire est un parcours : ses balises se valident
 * une à une, avec des bips d'approche (`useMarkGuide`), et l'avancement se
 * compte par balises.
 *
 * Dans le navigateur, une source « rejeu » relit un GPX en accéléré : toute la
 * chaîne s'éprouve sur le PC, jusqu'à l'analyse de la session obtenue.
 */

const REPLAY_SPEEDS = [1, 10, 60, 600];

type SourceChoice = 'device' | 'replay';

interface ReplayTrack {
  fileName: string;
  fixes: LocationFix[];
}

/** Lien « Réglages » d'une phrase à balise `<a>`. */
const settingsLink = (children: React.ReactNode) => <Link to="/parametres">{children}</Link>;

/** Message d'une famille sans activité, une phrase entière par famille. */
const NO_ACTIVITY_IN_FAMILY: Record<SportFamily, () => React.ReactNode> = {
  voile: () => tRich('Aucune activité avec vent : ajoutez-en une dans <a>Réglages</a>.', undefined, { a: settingsLink }),
  surf: () => tRich('Aucune activité sans vent : ajoutez-en une dans <a>Réglages</a>.', undefined, { a: settingsLink }),
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rec-stat">
    <span className="ui-muted ui-text-s">{label}</span>
    <span className="num rec-stat__value">{value}</span>
  </div>
);

/** Fréquence cardiaque du direct : tuile allongée sur une ligne, plus grosse que les autres. Seulement avec une ceinture ;
 *  hors mesure, l'état de la ceinture tient la place du chiffre. */
const BpmTile = ({ belt }: { belt: { state: BeltState; bpm: number | null } }) => {
  const measured = belt.state === 'connected' && belt.bpm !== null;
  const text = measured
    ? String(Math.round(belt.bpm as number))
    : belt.state === 'connected' ? t('connectée, sans contact avec la peau') : BELT_STATE_LABEL[belt.state];
  return (
    <div className="rec-bpm">
      <span className="rec-bpm__label">{t('BPM')}</span>
      <span className={measured ? 'num rec-bpm__value' : 'rec-bpm__state'}>{text}</span>
    </div>
  );
};

const STAT_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' } as const;

/** Distance restante et part faite de la trace suivie ; « à rejoindre » tant qu'on ne l'a pas rejointe. */
const followStatItems = (activity: Activity, progress: FollowProgress | null, totalM: number): { label: string; value: string }[] => {
  const distanceUnit = effectiveDistanceUnit(activity);
  const total = formatDistance(totalM, distanceUnit, 1);
  return [
    { label: t('Restant'), value: progress ? formatDistance(progress.remainingM, distanceUnit) : '—' },
    {
      label: t('Fait, sur {total}', { total }),
      value: progress ? `${Math.round((100 * progress.progressM) / Math.max(1, progress.totalM))} %` : t('à rejoindre'),
    },
  ];
};

/** Avancement d'un parcours de voile : distance restante par les balises, et balises validées. */
const courseStatItems = (activity: Activity, view: MarkGuideView): { label: string; value: string }[] => [
  { label: t('Restant'), value: view.remainingM !== null ? formatDistance(view.remainingM, effectiveDistanceUnit(activity)) : '—' },
  { label: t('Balises validées'), value: `${view.outcomes.filter((o) => o === 'validated').length}/${view.marks.length}` },
];

/**
 * Guidage vers la balise visée : son nom, sa distance et son cap ; « Passer »
 * la laisse pour la suivante, « Bips » coupe ou remet sons et vibrations.
 */
const MarkGuideCard = ({ view, activity }: { view: MarkGuideView; activity: Activity }) => {
  const count = view.marks.length;
  const aim = view.finished
    ? t('Parcours fini')
    : view.distanceM === null || view.bearingDeg === null
      ? t('en attente du GPS')
      : `${formatShortDistance(view.distanceM, effectiveDistanceUnit(activity))} · ${roundBearingDeg(view.bearingDeg)}°`;
  return (
    <Card>
      <div className="rec-mark-row">
        <div className="rec-mark-text">
          <span className="ui-muted ui-text-s">
            {view.finished ? tn(count, '{n} balise', '{n} balises', undefined, true) : `${markName(view.target, count)} · ${view.target + 1}/${count}`}
          </span>
          <span className="num rec-mark-aim">{aim}</span>
        </div>
        <div className="rec-mark-actions">
          <Button onClick={skipMark} disabled={view.finished}>{t('Passer')}</Button>
          <Button variant={view.muted ? 'secondary' : 'ghost'} aria-pressed={!view.muted} onClick={() => setBeepsMuted(!view.muted)}
            title={view.muted ? t('Remettre les bips et les vibrations') : t('Couper les bips et les vibrations')}>
            {view.muted ? t('Bips coupés') : t('Bips')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

/**
 * Statistiques en direct propres au traitement du calcul de l'activité.
 * Libellés tirés des options du calcul (`options`).
 */
const liveStatItems = (activity: Activity, live: LiveStats, options: LiveStatsOptions): { label: string; value: string }[] => {
  const unit = effectiveSpeedUnit(activity);
  const distanceUnit = effectiveDistanceUnit(activity);
  if (sportTreatment(activity.base) === 'voile') {
    return [
      ...options.topDurationsS.map((d, i) => ({
        label: t('Top {d} s ({window})', { d, window: recentWindowLabel(options) }),
        value: formatSpeed(live.recentTopsMs[i] ?? null, unit),
      })),
      { label: t('Distance'), value: formatDistance(live.distanceM, distanceUnit) },
    ];
  }
  // Surf.
  return [
    { label: t('Vitesse'), value: formatSpeed(live.currentSpeedMs, unit) },
    // Sur toute la trace : pas la « Vitesse max » de l'analyse, celle d'une vague, que le direct ne détecte pas.
    { label: liveFieldLabel('max', { speedUnit: unit, distanceUnit, options }), value: formatSpeed(live.maxSpeedMs, unit) },
    { label: t('Distance'), value: formatDistance(live.distanceM, distanceUnit) },
  ];
};

/** Durée d'un bord : m:ss, h:mm:ss au-delà d'une heure. */
const formatLegDuration = (ms: number): string => {
  const clock = formatClock(ms);
  return clock.startsWith('0:') ? clock.slice(2).replace(/^0(?=\d:)/, '') : clock;
};

/**
 * Un bord de voile en direct : cap moyen (le vent est inconnu, donc pas
 * d'amure), durée, vitesse moyenne et max sur 2 s. `leg` nul : `empty`.
 */
const LegCard = ({ title, leg, empty, activity }: { title: string; leg: LiveLeg | null; empty: string; activity: Activity }) => {
  const unit = effectiveSpeedUnit(activity);
  const detail = leg
    ? `${leg.headingDeg === null ? t('cap —') : t('cap {deg}°', { deg: roundBearingDeg(leg.headingDeg) })} · ${formatLegDuration(leg.endMs - leg.startMs)}`
    : empty;
  return (
    <div className="ui-stack-2">
      <div className="rec-leg-head">
        <span className="ui-bold">{title}</span>
        <span className="num ui-muted ui-text-s">{detail}</span>
      </div>
      <div className="rec-leg-grid">
        <Stat label={t('Moyenne')} value={formatSpeed(leg?.averageSpeedMs ?? null, unit)} />
        <Stat label={t('Max ({s} s)', { s: LIVE_LEG_DEFAULTS.topDurationS })} value={formatSpeed(leg?.maxSpeedMs ?? null, unit)} />
      </div>
    </div>
  );
};

/**
 * Chiffres en grand quand la carte est réduite : ceux choisis pour l'activité
 * dans Réglages (`effectiveLiveFields`), déjà formatés.
 */
const LiveSummary = ({ items }: { items: { label: string; value: string }[] }) => (
  <Card>
    <div className="ui-stack-2">
      {items.map((item) => (
        <div key={item.label} className="rec-live-row">
          <span className="rec-live-label">{item.label}</span>
          {/* Une valeur longue (« sous Z1 · 142 ») passe à la ligne à son « · », jamais au milieu d'un morceau. */}
          <span className="num rec-live-value">
            {item.value.split(' · ').map((part, i) => (
              <Fragment key={i}>{i > 0 && ' · '}<span className="ui-nowrap">{part}</span></Fragment>
            ))}
          </span>
        </div>
      ))}
    </div>
  </Card>
);

/** Lignes de la carte réduite, dans les unités de l'activité, libellés tirés des options du calcul (`options`). */
const liveSummaryItems = (
  activity: Activity, context: Omit<LiveFieldContext, keyof LiveFieldUnits>, options: LiveStatsOptions,
): { label: string; value: string }[] => {
  const units: LiveFieldUnits = { speedUnit: effectiveSpeedUnit(activity), distanceUnit: effectiveDistanceUnit(activity), options };
  return effectiveLiveFields(activity).map((key) => ({
    label: liveFieldLabel(key, units),
    value: liveFieldValue(key, { ...units, ...context }),
  }));
};

/** Carte de l'enregistrement en cours, réduite ou non ; mémorisé sur l'appareil. */
const RECORDING_SECTION_DEFAULTS = { carte: true };

/**
 * « Arrêter » : tenu le temps réglé dans Réglages (2 s par défaut), pour qu'un
 * geste involontaire ne coupe pas la session ; un appui court le rappelle. À 0,
 * un simple appui arrête. Le grand cadran montre l'appui sous le doigt (`HoldButton`).
 */
function StopButton({ status }: { status: RecorderState['status'] }) {
  const stop = useCallback(() => void stopRecording(), []);
  return (
    <HoldButton onHold={stop} getHoldMs={effectiveStopHoldMs} disabled={status === 'starting' || status === 'stopping'}
      size="l" style={{ flex: 1 }} lead={<span className="ui-record-dot ui-record-dot--stop" />}
      dialTitle={t('Arrêter')}
      label={status === 'stopping' ? t('Enregistrement du fichier…') : t('Arrêter')} />
  );
}

/** Durée du retour du bouton « Note », en millisecondes. */
const NOTE_FEEDBACK_MS = 3000;
/** Vibration qui confirme une note posée, en millisecondes. */
const NOTE_BUZZ_MS = 80;

/**
 * Bouton « Note » : pose un repère à cet instant et à la dernière position
 * (`addRecordingMark`), sans rien saisir, puisqu'on est en mouvement ; il se
 * nomme ensuite dans l'analyse. Le bouton dit lui-même « Note N posée »
 * quelques secondes, et le téléphone vibre.
 */
function NoteButton({ className }: { className?: string }) {
  const [feedback, setFeedback] = useTransientValue<string>(NOTE_FEEDBACK_MS);
  const note = () => {
    const added = addRecordingMark();
    setFeedback(added ? t('Note {n} posée', { n: added.n }) : t('Pas encore de position : note impossible'));
    if (added) void buzz(NOTE_BUZZ_MS).catch(() => undefined);
  };
  return (
    <Button variant="secondary" size="l" block className={className ? `ui-btn--hold ${className}` : 'ui-btn--hold'} onClick={note} aria-live="polite">
      <IconFlag size={20} />
      {feedback ?? t('Note')}
    </Button>
  );
}

/**
 * Cadenas à droite de « Note » (téléphone seulement) : fige l'écran dans son orientation du moment, pour qu'un
 * geste ne le fasse pas tourner pendant la séance ; un second toucher le libère, l'arrêt de l'enregistrement aussi
 * (`AppShell`).
 */
function OrientationLockButton() {
  const locked = useSyncExternalStore(subscribeOrientationLock, isOrientationLocked);
  return (
    <Button variant={locked ? 'primary' : 'secondary'} size="l" aria-pressed={locked} onClick={() => lockOrientation(!locked)}
      aria-label={locked ? t("Libérer l'orientation de l'écran") : t("Figer l'écran dans son orientation")}
      title={locked ? t('Orientation figée : toucher pour la libérer') : t("Figer l'écran dans son orientation")}>
      <IconLock size={20} open={!locked} />
    </Button>
  );
}

/** Écran gardé allumé tant que `on`, sur la page qui le demande seulement. */
const useScreenOnWhile = (on: boolean): void => {
  useEffect(() => {
    if (!on) return undefined;
    keepScreenOn(true);
    return () => keepScreenOn(false);
  }, [on]);
};

/**
 * Case d'une mesure proposée au départ (sauts, ceinture, pumping) et
 * son explication dessous ; `children` après elle (état de la ceinture).
 */
function CaptureOption({ label, checked, disabled, onChange, note, children }: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  note: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="ui-stack-1">
      <label className="ui-row-10 ui-center">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      <span className="ui-muted ui-text-s rec-indent">{note}</span>
      {children}
    </div>
  );
}

/** Trace suivie : itinéraire, ou balises d'un parcours de voile ; `null` sans trace. */
interface FollowedProps {
  followed: FollowedTrace | null;
  /** Balises d'un parcours guidé (voile, surf), `null` hors parcours : l'avancement se compte alors le long de la trace. */
  courseMarksOf: LatLon[] | null;
}

/**
 * Carte du direct, ou aperçu de la trace suivie au repos : redessinée à chaque
 * position (position et cap), à chaque calcul du direct (trace, avancement) et
 * à chaque pas du guidage, sans le reste de la page.
 */
function RecordingMap({ busy, followed, courseMarksOf, liveActivity, family, onReduce }: FollowedProps & {
  busy: boolean;
  liveActivity: Activity | null;
  family: SportFamily;
  onReduce: () => void;
}) {
  // La carte suit chaque position gardée, et en pause manuelle chaque position reçue (le GPS reste allumé), avec son cap.
  const livePosition = useLivePosition();
  const notes = useRecorderSelector((s) => s.marks);
  const live = useLiveRecording();
  const markGuide = useMarkGuide();
  /** Balises laissées derrière soi : toutes celles d'avant la visée. */
  const leftMarks = markGuide.active ? markGuide.target : 0;
  // Avancement sur la trace suivie, recalculé avec la trace en direct (toutes les 2 s au plus).
  const progress = busy && followed && !courseMarksOf ? live.progress : null;
  // Au mètre près : un nouveau calcul sans avancée ne redécoupe pas la trace suivie, et la carte ne la redessine pas.
  const progressM = progress ? Math.round(progress.progressM) : null;
  const guide = useMemo(() => {
    // Sur un parcours de balises, il va de balise en balise : fait jusqu'à la dernière laissée, à faire ensuite.
    if (courseMarksOf) return { done: courseMarksOf.slice(0, leftMarks), remaining: courseMarksOf.slice(Math.max(0, leftMarks - 1)) };
    return followed && progressM !== null ? splitFollowedTrace(followed, progressM) : { done: [], remaining: followed?.points ?? [] };
  }, [followed, progressM, courseMarksOf, leftMarks]);
  const mapMarks = useMemo(
    () => (courseMarksOf ? courseMarks(courseMarksOf, markGuide.active ? markGuide : null) : undefined),
    [courseMarksOf, markGuide]
  );
  const travel = busy ? travelHeading(getLiveHeadingFixes()) : undefined;
  // Une position de la pause manuelle n'est pas gardée : aucun trait ne la joint à la trace.
  const position = busy ? livePosition : null;
  const positionSegment = position !== null && position === getLastFix() ? getLiveSegmentCount() - 1 : null;
  return (
    // Au repos, un aperçu de la trace suivie, sans position : remonté à chaque trace pour s'y cadrer. Sur un téléphone
    // tourné, la carte se fixe à droite (`RecordingPage.css`).
    <div className="rec-map">
      <LiveMap key={busy ? 'direct' : `apercu-${followed?.name}-${followed?.points.length}`}
        segments={busy ? live.segments : []} position={position} positionSegment={positionSegment} height="45vh"
        guide={guide.remaining} guideDone={guide.done} travel={travel}
        marks={mapMarks} validationRadiusM={markGuide.active ? markGuide.validationRadiusM : undefined}
        notes={busy ? notes : undefined}
        color={LIVE_TRACK_COLOR[liveActivity ? sportFamily(liveActivity.base) : 'voile']}
        family={liveActivity ? activityFamily(liveActivity) : family}
        overlay={busy ? (
          <Button size="s" onClick={onReduce} className="rec-tool-shadow">
            {t('Réduire la carte')}
          </Button>
        ) : undefined} />
    </div>
  );
}

/** Carte du guidage vers la balise visée, pendant un parcours guidé : redessinée à chaque pas du guidage seulement. */
function MarkGuideSlot({ activity }: { activity: Activity }) {
  const markGuide = useMarkGuide();
  return markGuide.active ? <MarkGuideCard view={markGuide} activity={activity} /> : null;
}

/**
 * Boutons de secours de la ceinture pendant l'enregistrement (`beltRetryOffer`) : « Réessayer » une ceinture
 * cherchée, perdue ou injoignable, « Arrêter de chercher » (sans confirmation : « Reprendre la ceinture » la rend), et
 * « Reprendre la ceinture » après l'abandon. `underAlert` : la rangée posée sous l'alerte rouge, montrée seulement
 * quand l'alerte parle de la ceinture. Aucun ne touche à la trace ni à la notification.
 */
function BeltRescue({ underAlert }: { underAlert: boolean }) {
  const status = useRecorderSelector((s) => s.status);
  const heartRate = useRecorderSelector((s) => s.heartRate);
  const beltLost = useRecorderSelector((s) => s.beltLost);
  const beltAside = useRecorderSelector((s) => s.beltAside);
  const retrying = useRecorderSelector((s) => s.beltRetrying);
  const input = { active: status === 'recording' || status === 'paused', heartRate, beltLost, beltAside };
  const offer = beltRetryOffer(input);
  if (underAlert && !beltRetryUnderAlert(input)) return null;
  if (!offer.retry && !offer.stop && !offer.retake) return null;
  return (
    <div className="rec-rescue">
      {!underAlert && offer.stop && <span className="ui-muted">{t("Sans elle, l'enregistrement continue, sans cardio.")}</span>}
      <span className="rec-rescue__actions">
        {offer.retry && (
          <Button size="s" disabled={retrying} onClick={() => void retryRecordingBelt()}>
            {retrying ? t('nouvelle tentative…') : t('Réessayer')}
          </Button>
        )}
        {offer.stop && <Button size="s" onClick={stopRecordingBeltSearch}>{t('Arrêter de chercher')}</Button>}
        {offer.retake && (
          <Button size="s" disabled={retrying} onClick={() => void retakeRecordingBelt()}>
            {retrying ? t('nouvelle tentative…') : t('Reprendre la ceinture')}
          </Button>
        )}
      </span>
    </div>
  );
}

/**
 * Boutons de secours du GPS pendant l'enregistrement (`gpsRetryOffer`) : « Réessayer » tant qu'aucune position n'est
 * venue ou que le GPS est perdu, hors pause manuelle, « nouvelle tentative… » quelques secondes après l'appui ;
 * « Activer la localisation » quand elle est coupée. `underAlert` : la rangée posée sous l'alerte rouge (GPS perdu,
 * localisation coupée) ; sinon sous la ligne d'état, avec l'attente écrite. Aucun ne touche à la trace ni à la
 * notification.
 */
function GpsRescue({ underAlert }: { underAlert: boolean }) {
  const status = useRecorderSelector((s) => s.status);
  const pausedReason = useRecorderSelector((s) => s.pausedReason);
  const awaitingFix = useRecorderSelector((s) => s.awaitingFix);
  const gpsLost = useRecorderSelector((s) => s.gpsLost);
  const locationOff = useRecorderSelector((s) => s.locationOff);
  const retrying = useRecorderSelector((s) => s.gpsRetrying);
  const offer = gpsRetryOffer({
    active: status === 'recording' || status === 'paused',
    manualPause: isManualPause({ status, pausedReason }),
    awaitingFix,
    gpsLost,
    locationOff,
  });
  if (offer.underAlert !== underAlert || (!offer.retry && !offer.openSettings)) return null;
  return (
    <div className="rec-rescue">
      {offer.waiting && <span className="ui-muted">{t('en attente de la première position')}</span>}
      <span className="rec-rescue__actions">
        {offer.retry && (
          <Button size="s" disabled={retrying} onClick={() => void retryRecordingGps()}>
            {retrying ? t('nouvelle tentative…') : t('Réessayer')}
          </Button>
        )}
        {offer.openSettings && (
          <Button size="s" onClick={() => void openRecordingLocationSettings()}>{t('Activer la localisation')}</Button>
        )}
      </span>
    </div>
  );
}

/**
 * Chiffres de l'enregistrement en cours : les grands chiffres de la carte
 * réduite (ou du téléphone tourné), puis la carte « En cours ». Seuls à suivre
 * l'horloge, le direct, la ceinture et le guidage : le reste de la page n'est
 * pas redessiné à chaque position.
 */
function RecordingFigures({ summaryShown, clockShown, liveActivity, followed, courseMarksOf, followedLengthM }: FollowedProps & {
  summaryShown: boolean;
  /** Chiffre « Heure » affiché : l'horloge bat chaque seconde. */
  clockShown: boolean;
  liveActivity: Activity | null;
  followedLengthM: number;
}) {
  const heartRate = useRecorderSelector((s) => s.heartRate);
  // Horloge : la durée tourne en pause automatique ; l'heure, si la carte réduite l'affiche, bat chaque seconde.
  const { nowMs, durationMs } = useRecordingClock(clockShown);
  // Calculé hors de la page, repris par la notification de l'enregistrement.
  const live = useLiveRecording();
  const markGuide = useMarkGuide();
  // Libellés sur les options du calcul du direct, celles de l'activité.
  const options = useMemo(() => (liveActivity ? liveStatsOptionsFor(liveActivity) : LIVE_STATS_DEFAULTS), [liveActivity]);
  const progress = followed && !courseMarksOf ? live.progress : null;
  return (
    <>
      {summaryShown && liveActivity && (
        <LiveSummary items={liveSummaryItems(liveActivity, {
          stats: live.stats,
          durationMs,
          nowMs,
          remainingM: courseMarksOf ? (markGuide.active ? markGuide.remainingM : null) : progress?.remainingM ?? null,
          headingDeg: travelHeading(getLiveFixes()).headingDeg ?? null,
          markDistanceM: markGuide.active ? markGuide.distanceM : null,
          markBearingDeg: markGuide.active ? markGuide.bearingDeg : null,
          heartRateBpm: heartRate?.bpm ?? null,
          heartRateZoneBounds: readHeartRateZoneBounds(liveActivity),
        }, options)} />
      )}

      <Card heading={t('En cours')}>
        {heartRate && <BpmTile belt={heartRate} />}
        <BeltRescue underAlert={false} />
        <div style={STAT_GRID}>
          <Stat label={t('Durée')} value={formatClock(durationMs)} />
          {liveActivity && followed && (courseMarksOf && markGuide.active
            ? courseStatItems(liveActivity, markGuide)
            : followStatItems(liveActivity, progress, followedLengthM)
          ).map((item) => <Stat key={item.label} {...item} />)}
          {liveActivity && liveStatItems(liveActivity, live.stats, options).map((item) => <Stat key={item.label} {...item} />)}
        </div>
        {liveActivity && sportFamily(liveActivity.base) === 'voile' && (
          <div className="rec-grid-fit">
            <LegCard title={t('Bord en cours')} leg={live.stats.legs.current}
              empty={live.stats.movingTimeMs > 0 ? t('en manœuvre') : t('pas encore')} activity={liveActivity} />
            <LegCard title={t('Bord précédent')} leg={live.stats.legs.previous} empty={t('pas encore')} activity={liveActivity} />
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * Partie « GPS » : durée couverte par les positions, points, intervalle, trou,
 * précision et satellites ; redessinée à chaque position, à part du reste. Les
 * satellites sont suivis sur le téléphone tant que le GPS tourne (coupé en
 * pause manuelle), que la partie soit affichée ou non.
 */
function RecordingGpsCard({ busy, deviceGps }: {
  busy: boolean;
  /** GPS du téléphone (pas le navigateur, pas un rejeu) : le nombre de satellites a un sens. */
  deviceGps: boolean;
}) {
  const stats = useRecorderSelector((s) => s.stats);
  const recording = useRecorderSelector((s) => s.status === 'recording');
  const satellites = useSatellites(deviceGps && recording);
  if (!(busy || stats.pointCount > 0)) return null;
  // Durée couverte par les positions : celle du GPS ; la durée affichée de la session suit l'horloge (`useRecordingClock`).
  const pointsDurationMs = recordingDurationMs(stats);
  const meanIntervalS = stats.pointCount > 1 ? pointsDurationMs / 1000 / (stats.pointCount - 1) : null;
  return (
    <Card heading={busy ? undefined : t('Dernier enregistrement')}>
      <details open={!busy}>
        <summary className="ui-eyebrow rec-summary">{t('GPS')}</summary>
        <div style={STAT_GRID}>
          <Stat label={t('Durée')} value={formatClock(pointsDurationMs)} />
          <Stat label={t('Points')} value={String(stats.pointCount)} />
          <Stat label={t('Intervalle moyen')} value={meanIntervalS === null ? '—' : `${formatDecimal(meanIntervalS, 1)} s`} />
          <Stat label={t('Plus long trou')} value={`${Math.round(stats.longestGapS)} s`} />
          <Stat label={t('Précision')} value={stats.lastAccuracyM === null ? '—' : `${Math.round(stats.lastAccuracyM)} m`} />
          {busy && deviceGps && (
            <Stat label={t('Satellites utilisés')} value={satellites === null ? '—' : t('{used} sur {visible}', { used: satellites.used, visible: satellites.visible })} />
          )}
        </div>
      </details>
    </Card>
  );
}

/** Ce qui est dit quand le matériel choisi à la fin n'a pas pu entrer dans la fiche de la session rangée. */
const gearNotWrittenText = () => t("Le matériel choisi n'a pas pu être écrit dans la fiche : choisissez-le de nouveau dans l'onglet « matériel et notes » de l'analyse.");

/**
 * Écrit le matériel choisi à la fin dans la fiche de la session rangée, sans
 * toucher au reste de ses notes (session déjà dans la mémoire comprise). Rend
 * faux s'il n'y est pas entré : session hors de la mémoire (en attente d'un
 * dossier, non rangée) ou fiche en lecture seule.
 */
const writeEndGear = (file: string | null, gear: GearChoice[]): boolean => {
  if (!file) return false;
  const notes = librarySession(file)?.record.notes ?? null;
  updateSessionRecord(file, { notes: { ...EMPTY_NOTES, ...notes, gear, savedAt: Date.now() } });
  return librarySession(file)?.record.notes?.gear === gear;
};

function RecordingScreen() {
  const status = useRecorderSelector((s) => s.status);
  const pausedReason = useRecorderSelector((s) => s.pausedReason);
  const recordedActivity = useRecorderSelector((s) => s.activity);
  const sourceLabel = useRecorderSelector((s) => s.sourceLabel);
  const measuringMotion = useRecorderSelector((s) => s.measuringMotion);
  const motionSetup = useRecorderSelector((s) => s.motionSetup);
  const pending = useRecorderSelector((s) => s.pending);
  const motionUnreadable = useRecorderSelector((s) => s.motionUnreadable);
  const saved = useRecorderSelector((s) => s.saved);
  // Fiche de la session rangée : son nom montré, qui se complète quand son lieu est trouvé.
  const savedRecord = useLibrarySession(saved?.libraryFile ?? null)?.record ?? null;
  const error = useRecorderSelector((s) => s.error);
  const manualPause = isManualPause({ status, pausedReason });
  const autoPause = isAutoPause({ status, pausedReason });
  const openSession = useOpenSession();
  const followed = useFollowedTrace();
  const [picking, setPicking] = useState(false);
  const native = isNativeApp();
  const { open: shown, toggle: toggleShown } = useOpenSections<'carte'>('recording', RECORDING_SECTION_DEFAULTS);

  // Famille puis activité : celle demandée par l'adresse (`?activite=`), sinon celle de la trace suivie, sinon la dernière
  // enregistrée.
  // Seules les visibles sont proposées : une activité cachée dans Réglages n'est pas reprise.
  const [params] = useSearchParams();
  const { activities, families, isShown } = useVisibility();
  const shownActivities = useMemo(() => activities.filter(isShown), [activities, isShown]);
  const [chosenId, setChosenId] = useState<string | null>(() => {
    const last = lastRecordActivity();
    const asked = shownActivities.find((a) => a.id === params.get('activite'));
    return (asked ?? shownActivities.find((a) => a.id === followed?.activityId) ?? (last && isShown(last) ? last : null) ?? shownActivities[0])?.id ?? null;
  });
  const chosen = activities.find((a) => a.id === chosenId) ?? null;
  const [family, setFamily] = useState<SportFamily>(chosen ? sportFamily(chosen.base) : families[0] ?? 'voile');
  const familyActivities = activitiesOfFamily(shownActivities, family);
  const pickFamily = (next: SportFamily) => {
    setFamily(next);
    setChosenId(activitiesOfFamily(shownActivities, next)[0]?.id ?? null);
  };
  const pickActivity = (activity: Activity) => {
    setFamily(sportFamily(activity.base));
    setChosenId(activity.id);
  };
  /** Une trace choisie propose son activité (celle de l'itinéraire, ou de la session). */
  const proposeActivityOf = (trace: FollowedTrace) => {
    const activity = shownActivities.find((a) => a.id === trace.activityId);
    if (activity) pickActivity(activity);
  };
  /** Changement d'activité en cours d'enregistrement : l'enregistreur la prend, la page la garde pour la suite. */
  const changeLiveActivity = (activity: Activity) => {
    changeRecordingActivity(activity);
    pickActivity(activity);
  };
  // Sauts : proposés seulement si l'activité les mesure (case de Réglages), cochés d'office alors, sur le
  // téléphone seulement ; la case vaut pour cet enregistrement.
  const activityJumps = chosen ? effectiveJumpSettings(chosen) : null;
  const jumpSettings = activityJumps?.enabled === true ? activityJumps : null;
  const chosenActivityId = chosen?.id ?? null;
  const [jumpPicked, setJumpPicked] = usePerActivityChoice(chosenActivityId, true);
  const measureJumps = chosen !== null && jumpSettings !== null && jumpPicked;
  // Pumping foil : proposé par l'activité de surf ou de voile (foil et pumping cochés dans Réglages), coché d'office ; la case vaut pour cet enregistrement.
  const pumpingOffered = chosen !== null && effectiveFoil(chosen) === true && effectivePumping(chosen) === true;
  const [pumpPicked, setPumpPicked] = usePerActivityChoice(chosenActivityId, true);
  const measurePumping = pumpingOffered && pumpPicked;
  // Virages du surf : proposés par l'activité (case « Mesurer les virages » de Réglages), cochés d'office ; la case vaut
  // pour cet enregistrement. Avec le pumping, une seule capture.
  const turnsOffered = chosen !== null && effectiveTurns(chosen) === true;
  const [turnsPicked, setTurnsPicked] = usePerActivityChoice(chosenActivityId, true);
  const measureTurns = turnsOffered && turnsPicked;
  // Ceinture cardio : proposée par l'activité, cochée d'office si Réglages le dit ; la case vaut pour cet enregistrement.
  const heartRateSetting = chosen ? effectiveHeartRate(chosen) : null;
  // Appareil actif, changé d'un geste par « Changer » s'il y en a plusieurs de retenus ; jamais une fois parti.
  const [retainedBelt, setRetainedBelt] = useState<HeartRateBelt | null>(savedBelt);
  const retainedBelts = useMemo(() => savedBelts(), []);
  const [choosingBelt, setChoosingBelt] = useState(false);
  const pickBelt = (next: HeartRateBelt) => {
    chooseSavedBelt(next);
    setRetainedBelt(savedBelt());
    setChoosingBelt(false);
  };
  const belt = retainedBelt;
  // Noms montrés : un nom porté par deux appareils prend la fin de leur adresse.
  const retainedLabels = useMemo(() => beltLabels(retainedBelts), [retainedBelts]);
  const beltLabel = belt === null ? '' : retainedLabels[retainedBelts.findIndex((b) => b.address === belt.address)] ?? belt.name;
  const [heartRatePicked, setHeartRatePicked] = usePerActivityChoice(chosenActivityId, heartRateSetting ?? false);
  const measureHeartRate = chosen !== null && heartRateSetting !== null && belt !== null && heartRatePicked;
  const [motionCaps, setMotionCaps] = useState<MotionCapabilities | null>(null);
  useEffect(() => {
    let alive = true;
    void getMotionCapabilities().then((caps) => { if (alive) setMotionCaps(caps); });
    return () => { alive = false; };
  }, []);
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>('device');
  const [replay, setReplay] = useState<ReplayTrack | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replaySpeed, setReplaySpeed] = useState(60);

  const busy = status !== 'idle';
  // Ceinture cochée : connectée dès maintenant, avant le départ, pour voir qu'elle répond.
  const beltWarmup = useBeltWarmup(belt, native && sourceChoice === 'device' && measureHeartRate && !busy && pending === null);
  const beltLive = useBeltLive();
  const missingPermissions = useMissingPermissions();
  const analyzing = useRecorderSelector((s) => s.analyzing);
  // Rangement seul à l'arrêt, ou celui d'« Analyser », en cours ou sur le point de partir : « Rangement… » au lieu de la carte.
  const finishing = useRecorderSelector(finishingPendingSession);
  // Session rangée dont l'analyse a été ouverte : son message y est dit, pas ici. Sinon (hors mémoire, à classer,
  // ouverture refusée pour garder un brouillon), la carte « Session rangée » l'annonce, avec son message.
  const resultOpened = useRecorderSelector((s) => s.resultOpened);
  const savedOpened = saved !== null && resultOpened;
  /** Ouvre l'analyse de la session rangée ; son message, s'il y en a un, et le rappel du matériel la suivent. */
  const openSaved = (file: string, sport: SportType) => {
    markRecorderResultOpened();
    openSession(file, sportFamily(sport));
  };
  // Matériel choisi à la fin de la session, vide d'office : remis à zéro pour chaque session en attente.
  const [endGear, setEndGear] = useState<GearChoice[] | null>(null);
  const [endGearOf, setEndGearOf] = useState(pending);
  if (endGearOf !== pending) {
    setEndGearOf(pending);
    setEndGear(null);
  }
  // Matériel choisi qui n'a pas pu être écrit dans la fiche de la session rangée.
  const [gearNotWritten, setGearNotWritten] = useState(false);
  const canStart = !busy && pending === null && chosen !== null && (sourceChoice === 'device' || replay !== null);
  const liveActivity = recordedActivity ?? chosen;
  const mapReduced = busy && !shown.carte;
  // Téléphone tourné : les grands chiffres à gauche de la carte, sans avoir à la réduire.
  const landscape = usePhoneLandscape();
  const summaryShown = (mapReduced || (busy && landscape)) && liveActivity !== null;
  const clockShown = summaryShown && effectiveLiveFields(liveActivity).includes('clock');
  // Écran allumé tant qu'un enregistrement tourne (pause comprise), sur cette page seulement.
  useScreenOnWhile(busy);

  // Parcours de balises : la trace suivie a des balises et l'activité navigue sur un parcours (voile, surf). L'avancement se compte par balises.
  const courseMarksOf = followed?.marks && liveActivity && usesMarkCourse(sportFamily(liveActivity.base)) ? followed.marks : null;
  const followedLengthM = useMemo(() => (followed ? followedTraceLengthM(followed) : 0), [followed]);

  const handleReplayFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const fixes = fixesFromRawPoints(parseGpx(await readPickedFile(file)).rawPoints);
      if (fixes.length < 2) throw new Error(t('Le fichier ne contient pas assez de points horodatés.'));
      setReplay({ fileName: file.name, fixes });
      setReplayError(null);
    } catch (err) {
      setReplay(null);
      setReplayError(errorMessage(err, t('Lecture du fichier impossible.')));
    }
  };

  /**
   * « Analyser » de la carte filet (rangement seul en échec, ou session reprise qui peut continuer) : range la
   * session, puis l'ouvre si elle est entrée dans la mémoire. `withoutMotion` : « Analyser sans les capteurs »,
   * proposé après une capture illisible.
   */
  const handleAnalyze = async (withoutMotion = false) => {
    const gear = endGear;
    const result = await analyzePendingSession(withoutMotion);
    // Le matériel choisi va dans la fiche, comme le reste ; s'il n'y entre pas, il se refait dans l'onglet de l'analyse.
    const gearWritten = result && gear ? writeEndGear(result.libraryFile, gear) : true;
    setGearNotWritten(!gearWritten);
    if (!gearWritten && result?.libraryFile) window.alert(gearNotWrittenText());
    // Session à classer (journal sans en-tête) : rangée sans activité, la carte « Session rangée » le dit, et elle se
    // classe depuis la bibliothèque.
    if (result?.libraryFile && result.sport !== null) {
      // Un ménage en échec (journal resté sur l'appareil) est dit par l'analyse ouverte.
      openSaved(result.libraryFile, result.sport);
    }
  };

  /** « Jeter » du filet : un échec de l'effacement garde la session et s'affiche (`discardPendingSession` ne lève pas). */
  const handleDiscard = () => {
    if (window.confirm(t('Jeter cette session ? Elle ne sera pas rangée dans la mémoire, et ne pourra pas être récupérée.'))) {
      void discardPendingSession();
    }
  };

  /** Ce que mesurent les capteurs pendant l'enregistrement : sauts (pumping et virages en surf, sauts et pumping en voile sur foil). */
  const motionWhat = (() => {
    const setup = motionSetup;
    const treatment = liveActivity ? sportTreatment(liveActivity.base) : null;
    const pumpingToo = treatment === 'voile' && setup?.foil === true && liveActivity !== null && effectivePumping(liveActivity) === true;
    // Pumping seul en voile : les sauts n'ont pas été mesurés (case de Réglages ou de l'enregistrement décochée).
    const surfWhat = measurePumping && measureTurns ? t('Pumping et virages') : measureTurns ? t('Virages') : t('Pumping');
    return treatment === 'surf' ? surfWhat : pumpingToo ? (measureJumps ? t('Sauts et pumping') : t('Pumping')) : t('Sauts');
  })();

  const handleStart = () => {
    if (!chosen) return;
    rememberRecordActivity(chosen.id);
    const source = sourceChoice === 'replay' && replay
      ? createReplaySource(replay.fixes, replaySpeed)
      : deviceLocationSource();
    const capture = motionCaps?.available === true && sourceChoice === 'device';
    const motion = capture && measureJumps && jumpSettings
      ? { placement: jumpSettings.placement, foil: effectiveFoil(chosen) ?? false }
      : capture && (measurePumping || measureTurns)
        // Pumping et virages : une seule capture, téléphone sur la poitrine.
        ? { placement: 'poitrine' as const, foil: effectiveFoil(chosen) ?? false }
        : null;
    const heartRate = native && sourceChoice === 'device' && measureHeartRate ? belt : null;
    void beltWarmup.handOver(() => startRecording(chosen, source, { motion, heartRate }));
  };

  return (
    <div className={`ui-page rec-page${busy ? ' rec-page--busy' : ''}`}>
      <PageHeader title={t('Enregistrer')} subtitle={t("Une position par seconde, gardée brute : l'analyse se fait ensuite.")} />

      {!busy && !pending && <Card className="rec-options">
        <div className="rec-test-form">
          {/* Boutons glissants en cascade : la famille, puis ses activités. */}
          <div className="ui-stack-2">
            <SegmentedControl fit label={t('Famille')} items={families.map((f) => ({ key: f, label: FAMILY_LABEL[f] }))} value={family}
              accent={FAMILY_ACCENT[family]} onChange={pickFamily} />
            {familyActivities.length > 0 && (
              <SegmentedControl label={t('Activité')} value={chosenId ?? ''} accent={FAMILY_ACCENT[family]} onChange={setChosenId}
                items={familyActivities.map((a) => ({ key: a.id, label: activityDisplayName(a), title: activityDisplayName(a) }))} />
            )}
          </div>
          {familyActivities.length === 0 && (
            <div className="ui-alert ui-alert--warning">
              {NO_ACTIVITY_IN_FAMILY[family]()}
            </div>
          )}

          {chosen && jumpSettings && native && (
            <CaptureOption label={t('Mesurer les sauts')} checked={measureJumps && motionCaps?.available === true} disabled={!motionCaps?.available}
              onChange={setJumpPicked}
              note={<>
                {motionCaps && !motionCaps.available
                  ? motionCaps.reason
                  : effectiveFoil(chosen)
                    ? t('Téléphone fixé au corps : {placement}, sur foil (Réglages).', { placement: JUMP_PLACEMENT_LABEL[jumpSettings.placement].toLowerCase() })
                    : t('Téléphone fixé au corps : {placement} (Réglages).', { placement: JUMP_PLACEMENT_LABEL[jumpSettings.placement].toLowerCase() })}
                {motionCaps?.available && motionCaps.accelMaxG !== null && motionCaps.accelMaxG < 8 &&
                  ` ${t("L'accéléromètre plafonne à {g} g : les chocs à l'atterrissage seront écrêtés.", { g: Math.round(motionCaps.accelMaxG) })}`}
              </>} />
          )}

          {chosen && heartRateSetting !== null && native && (
            <CaptureOption label={t('Ceinture cardio')} checked={measureHeartRate} disabled={belt === null}
              onChange={setHeartRatePicked}
              note={belt === null
                ? tRich('Aucune ceinture choisie : <a>Réglages</a>, bloc « Capteurs ».', undefined, { a: settingsLink })
                : <>
                  {t("{label}, portée et humidifiée : elle n'émet qu'au contact de la peau.", { label: beltLabel })}
                  {retainedBelts.length >= 2 && (
                    <>{' '}<Button size="s" onClick={() => setChoosingBelt(true)}>{t('Changer')}</Button></>
                  )}
                </>}>
              {measureHeartRate && sourceChoice === 'device' && (
                <span className="ui-text-s rec-indent">
                  <BeltStatus state={beltLive.state} bpm={beltLive.bpm}
                    offText={beltWarmup.error ? t('connexion impossible : {error}', { error: beltWarmup.error }) : null}>
                    {/* Échec de la connexion, ou ceinture encore cherchée : un essai tout de suite, sans attendre le suivant. */}
                    {warmupRetryShown(beltLive.state, beltWarmup.error !== null) && (
                      <Button size="s" disabled={beltWarmup.retrying} onClick={beltWarmup.retry}>
                        {beltWarmup.retrying ? t('nouvelle tentative…') : t('Réessayer')}
                      </Button>
                    )}
                    {/* Ceinture encore cherchée : on peut y renoncer, comme en décochant la case. */}
                    {(beltLive.state === 'connecting' || beltLive.state === 'searching' || beltLive.state === 'lost') && (
                      <Button size="s" onClick={() => setHeartRatePicked(false)}>{t('Annuler la recherche')}</Button>
                    )}
                  </BeltStatus>
                </span>
              )}
            </CaptureOption>
          )}
          {choosingBelt && (
            // Appareil du prochain départ, parmi ceux retenus dans Réglages › Capteurs : liste dessinée, jamais le menu d'Android.
            <ChoiceSheet label={t('Appareil cardio')} onClose={() => setChoosingBelt(false)}>
              <div className="activity-select__heading"><strong>{t('Appareil cardio')}</strong></div>
              {retainedBelts.map((b, i) => (
                <ChoiceOption key={b.address} label={retainedLabels[i]} selected={b.address === retainedBelt?.address} onClick={() => pickBelt(b)} />
              ))}
            </ChoiceSheet>
          )}

          {chosen && pumpingOffered && native && (
            <CaptureOption label={t('Mesurer le pumping')} checked={measurePumping && motionCaps?.available === true} disabled={!motionCaps?.available}
              onChange={setPumpPicked}
              note={motionCaps && !motionCaps.available
                ? motionCaps.reason
                : t('Téléphone fixé sur la poitrine : fréquence de pumping, distance par coup et décollage de chaque vol (Réglages).')} />
          )}

          {chosen && turnsOffered && native && (
            <CaptureOption label={t('Mesurer les virages')} checked={measureTurns && motionCaps?.available === true} disabled={!motionCaps?.available}
              onChange={setTurnsPicked}
              note={motionCaps && !motionCaps.available
                ? motionCaps.reason
                : t('Téléphone fixé sur la poitrine : virages de chaque vague, plus fins que ceux du GPS (Réglages).')} />
          )}

          {native ? (
            <div><span className="ui-eyebrow">{t('Source')}</span> <span className="ui-ml-8">{t('GPS du téléphone')}</span></div>
          ) : (
            <div className="ui-stack-8">
              <span className="ui-eyebrow">{t('Source')}</span>
              <label>
                <input type="radio" checked={sourceChoice === 'device'} disabled={busy}
                  onChange={() => setSourceChoice('device')} /> {t('GPS du navigateur')}
              </label>
              <label>
                <input type="radio" checked={sourceChoice === 'replay'} disabled={busy}
                  onChange={() => setSourceChoice('replay')} /> {t("Rejeu d'un GPX, pour éprouver l'enregistrement")}
              </label>
              {sourceChoice === 'replay' && (
                <div className="rec-replay-row">
                  <input type="file" accept=".gpx" disabled={busy} onChange={handleReplayFile} />
                  <label>
                    {t('Vitesse :')}{' '}
                    <select value={replaySpeed} disabled={busy} onChange={(e) => setReplaySpeed(Number(e.target.value))} className="ui-field ui-field--s">
                      {REPLAY_SPEEDS.map((s) => <option key={s} value={s}>×{s}</option>)}
                    </select>
                  </label>
                  {replay && <span className="ui-muted">{tn(replay.fixes.length, '{n} point', '{n} points', undefined, true)}</span>}
                </div>
              )}
              {replayError && <div className="ui-danger-text">{replayError}</div>}
            </div>
          )}
        </div>
      </Card>}

      {busy ? (
        <div className="ui-row-10">
          {status === 'recording' && (
            <Button variant="secondary" size="l" className="ui-btn--hold ui-grow" onClick={() => void pauseRecording()}>
              <IconPause size={20} />
              {t('Pause')}
            </Button>
          )}
          {manualPause && (
            <Button variant="record" size="l" className="ui-btn--hold ui-grow" onClick={() => void resumeRecording()}>
              <IconPlay size={20} />
              {t('Reprendre')}
            </Button>
          )}
          <StopButton status={status} />
        </div>
      ) : !pending && (
        // Au repos, la moitié du bouton choisit une trace à suivre ; l'un sous l'autre quand la place manque (écran
        // étroit, texte d'Android agrandi).
        <div className="rec-actions ui-row-10 ui-wrap">
          <Button variant="record" size="l" className="rec-action-btn" onClick={handleStart} disabled={!canStart}>
            <span className="ui-record-dot" />
            {t('Démarrer')}
          </Button>
          <Button variant="secondary" size="l" className="rec-action-btn" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
            <IconRoute size={20} />
            {t('Suivre une trace')}
          </Button>
        </div>
      )}

      {(status === 'recording' || status === 'paused') && (canLockOrientation() ? (
        <div className="ui-row-10">
          <NoteButton className="ui-grow" />
          <OrientationLockButton />
        </div>
      ) : <NoteButton />)}

      {busy && (
        // Source du GPS et activité : au-dessus de la carte, pour rester visibles carte ouverte.
        <div className="rec-status">
          {sourceLabel && <span className="rec-status__source">{sourceLabel}</span>}
          {liveActivity && (
            // Changer d'activité en route, d'une famille à l'autre comprise : la session sera rangée sous la nouvelle.
            <label className="rec-status__activity">
              <span className="ui-eyebrow">{t('Activité')}</span>
              <ActivitySelect
                activities={activities}
                value={liveActivity.id}
                extra={liveActivity}
                className="ui-field"
                disabled={status !== 'recording' && status !== 'paused'}
                onChange={changeLiveActivity} />
            </label>
          )}
        </div>
      )}
      {busy && <GpsRescue underAlert={false} />}

      {picking && !busy && !pending && <FollowTracePicker onClose={() => setPicking(false)} onPicked={proposeActivityOf} />}

      {followed && (
        <div className="ui-alert ui-row-10 ui-center ui-wrap rec-follow">
          <IconRoute size={18} />
          <span className="ui-grow">
            {followed.source === 'session'
              ? tRich('Trace suivie : <strong>{name}</strong> (session)', { name: followed.name })
              : tRich('Trace suivie : <strong>{name}</strong>', { name: followed.name })}
            {liveActivity && <> · {formatDistance(followedLengthM, effectiveDistanceUnit(liveActivity), 1)}</>}
          </span>
          <Button size="s" variant="ghost" onClick={clearFollowedTrace}>{t('Retirer')}</Button>
        </div>
      )}

      {manualPause && (
        <div className="ui-alert ui-alert--warning">
          {measuringMotion
            ? t("En pause : rien n'est compté ; le GPS reste allumé pour la carte, la mesure des capteurs est suspendue.")
            : t("En pause : rien n'est compté ; le GPS reste allumé pour la carte.")}
        </div>
      )}
      {busy && measuringMotion && status !== 'paused' && (
        <div className="ui-alert">{t('{what} : les capteurs du téléphone mesurent.', { what: motionWhat })}</div>
      )}
      {autoPause && (
        <div className="ui-alert ui-alert--warning">{t('En pause automatique : aucun mouvement détecté. Reprend dès que vous bougez.')}</div>
      )}

      {error && !savedOpened && <div className="ui-alert ui-alert--danger">{error}</div>}
      {error && !savedOpened && busy && <GpsRescue underAlert />}
      {error && !savedOpened && busy && <BeltRescue underAlert />}

      {liveActivity && <MarkGuideSlot activity={liveActivity} />}

      {(busy || (followed && !pending)) && !mapReduced && (
        <RecordingMap busy={busy} followed={followed} courseMarksOf={courseMarksOf} liveActivity={liveActivity} family={family}
          onReduce={() => toggleShown('carte')} />
      )}

      {/* Carte réduite : elle n'est plus dessinée, les vitesses prennent sa place ; tourné, elles sont à côté d'elle. */}
      {mapReduced && <Button variant="secondary" block onClick={() => toggleShown('carte')}>{t('Afficher la carte')}</Button>}
      {busy && (
        <RecordingFigures summaryShown={summaryShown} clockShown={clockShown} liveActivity={liveActivity} followed={followed}
          courseMarksOf={courseMarksOf} followedLengthM={followedLengthM} />
      )}

      <RecordingGpsCard busy={busy} deviceGps={native && sourceChoice === 'device'} />

      {pending && finishing && (
        <p role="status" aria-live="polite" className="ui-muted">{t('Rangement…')}</p>
      )}

      {pending && !finishing && (
        <Card heading={(
          <span className="ui-flex-between">
            {pending.recovered ? t('Session interrompue récupérée') : t('Session terminée')}
            {pending.activity && (
              <SavedSessionShare gpx={pending.content} activity={pending.activity} fileName={pending.fileName} libraryFile={null} />
            )}
          </span>
        )}>
          <p className="rec-saved-text">
            {tnRich(pending.pointCount, '{name}, {n} point.<br />', '{name}, {n} points.<br />', { name: pending.activity ? activityDisplayName(pending.activity) : t('À classer') }, {}, true)}
            <span className="ui-muted ui-text-s">
              {t("Pas encore rangée dans la mémoire. Aucun nouvel enregistrement avant de l'analyser ou de la jeter.")}
            </span>
          </p>
          <SessionEndGear activity={pending.activity} gear={endGear} onChange={setEndGear} />
          <div className="ui-row-10 ui-wrap">
            <Button variant="primary" onClick={() => void handleAnalyze()} disabled={analyzing}>
              {t('Analyser')}
            </Button>
            {motionUnreadable && (
              <Button onClick={() => void handleAnalyze(true)} disabled={analyzing}>
                {t('Analyser sans les capteurs')}
              </Button>
            )}
            {pending.canContinue && (
              <Button variant="record" onClick={() => void continuePendingSession(deviceLocationSource())} disabled={analyzing}>
                {t("Continuer l'enregistrement")}
              </Button>
            )}
            {canDownloadFiles() && (
              <Button onClick={() => downloadTextFile(pending.fileName, pending.content)}>
                {t('Télécharger le GPX')}
              </Button>
            )}
            <Button variant="danger" onClick={handleDiscard} disabled={analyzing}>
              {t('Jeter')}
            </Button>
          </div>
        </Card>
      )}

      {/* Session rangée hors de la mémoire (aucun dossier), à classer, ou dont l'ouverture a été refusée pour garder un
          brouillon : rien ne s'est ouvert, cette carte le dit. */}
      {saved && !savedOpened && (
        <Card heading={(
          <span className="ui-flex-between">
            {t('Session rangée')}
            {saved.activity && (
              <SavedSessionShare gpx={saved.content} activity={saved.activity} fileName={saved.fileName} libraryFile={saved.libraryFile} />
            )}
          </span>
        )}>
          <p className="rec-saved-text">
            {tnRich(saved.pointCount, '{name}, {n} point.<br />', '{name}, {n} points.<br />', {
              name: savedRecord
                ? sessionDisplayName(savedRecord, saved.activity ? activityDisplayName(saved.activity) : t('À classer'))
                : saved.activity ? activityDisplayName(saved.activity) : t('À classer'),
            }, {}, true)}
            <span className="ui-muted ui-text-s rec-break-all">{t('Rangée dans : {location}', { location: saved.location })}</span>
            {gearNotWritten && (
              <>
                <br />
                <span className="ui-text-s">{gearNotWrittenText()}</span>
              </>
            )}
            {!saved.libraryFile && native && (
              <>
                <br />
                <span className="ui-muted ui-text-s">
                  {t("Pour l'analyser, choisissez le dossier mémoire (Réglages › Mémoire) : elle y sera rangée.")}
                </span>
              </>
            )}
          </p>
          <div className="ui-row-10 ui-wrap">
            {/* Ouverture refusée pour garder un brouillon : elle se fait d'ici. */}
            {saved.libraryFile && saved.sport !== null && (
              <Button variant="primary" onClick={() => openSaved(saved.libraryFile!, saved.sport!)}>
                {t('Analyser')}
              </Button>
            )}
            {canDownloadFiles() && (
              <Button onClick={() => downloadTextFile(saved.fileName, saved.content)}>
                {t('Télécharger le GPX')}
              </Button>
            )}
            <Button variant="ghost" onClick={dismissRecorderResult}>
              {t('Fermer')}
            </Button>
          </div>
        </Card>
      )}

      {native && !busy && !pending && (
        <p className="rec-footnote">
          {missingPermissions.length > 0 && (
            <>
              {tRich('Pour un enregistrement écran éteint, il manque : {list} (<a>Réglages</a>, bloc « Autorisations »).', {
                list: missingPermissions.map((key) => PERMISSION_LABEL[key].toLowerCase()).join(', '),
              }, { a: settingsLink })}{' '}
            </>
          )}
          {t("Pendant l'enregistrement, ne pas balayer l'application hors des applications récentes.")}
        </p>
      )}
    </div>
  );
}

export default RecordingScreen;
