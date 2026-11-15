import { plainError } from '../platform/errorText';
import { t } from '../core/i18n';
import { useEffect, useRef, useState } from 'react';
import { FAMILY_LABEL, activityDisplayName, type Activity } from '../core/activities';
import { shareableStats } from '../core/shareImage';
import { getSportProfile, hasActiveThreshold, sportFamily, sportTreatment } from '../core/sportProfiles';
import { coloredSegments } from '../core/trackColor';
import { librarySession, summarizeGpxText } from '../hooks/useSessionLibrary';
import { activitySpeedRanges, effectiveDistanceUnit, effectiveFoil, effectiveSpeedUnit } from '../hooks/useSportSettings';
import { shareLabels, summaryShareStats } from '../library/shareStats';
import { sessionFoil } from '../library/summaryOptions';
import { safeFileName } from '../platform/files';
import { IconShare } from './icons';
import { sessionSpeedRange } from '../library/sessionTrack';
import { runInWorker } from '../library/trackWorkerClient';
import ShareDialog from './ShareDialog';
import type { TrackSegment } from './TrackSegmentsLayer';
import Button from './ui/Button';
import MoreMenu from './ui/MoreMenu';

type Prepared = {
  segments: TrackSegment[];
  props: Omit<Parameters<typeof ShareDialog>[0], 'segments' | 'onClose'>;
};

interface SavedSessionShareProps {
  /** Le GPX de la session. */
  gpx: string;
  activity: Activity;
  /** Nom du GPX ; celui de la mémoire si elle y est rangée (`libraryFile`). */
  fileName: string;
  /** Rangée dans la mémoire : sa fiche donne le nom, l'allure imposée, les bornes et le résumé. */
  libraryFile: string | null;
}

/**
 * Menu « … » des cartes de fin d'enregistrement (« Session terminée »,
 * « Session rangée ») : « Partager l'image » ouvre la même fenêtre que dans
 * l'analyse (`ShareDialog`), la trace colorée comme l'analyse la colorerait
 * (`sessionColorTrack`, calculée hors du fil de l'affichage) et les chiffres du résumé (`summaryShareStats`) : celui
 * de la fiche si la session est rangée, sinon calculé sur le GPX avec les
 * réglages de son activité.
 */
function SavedSessionShare({ gpx, activity, fileName, libraryFile }: SavedSessionShareProps) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Demande en cours : la trace colorée arrive du worker, une réponse d'une demande dépassée (menu rouvert) ou
   * arrivée après la disparition de la carte est jetée.
   */
  const request = useRef(0);
  useEffect(() => () => { request.current = -1; }, []);

  const open = async () => {
    setError(null);
    const id = ++request.current;
    try {
      const record = libraryFile === null ? undefined : librarySession(libraryFile)?.record;
      const sport = record?.sport ?? activity.base;
      const family = sportFamily(sport);
      // Hors de la mémoire : calculé avec les réglages de l'activité, comme la fiche le sera (E-B12).
      const summary = record?.summary ?? summarizeGpxText(gpx, sport, activity.id);
      const track = await runInWorker('colorTrack', gpx, { sport, referenceOverrideMs: record?.analysis?.referenceSpeedMs ?? null, family });
      if (request.current !== id) return;
      if (track === null || summary === null) throw new Error(t('trace trop courte.'));
      const range = track ? sessionSpeedRange(record ?? { analysis: null, sport }, activity ? activitySpeedRanges(activity) : null, family, track.suggested) : null;
      const labels = shareLabels(record ?? null, activityDisplayName(activity), FAMILY_LABEL[family], summary.startMs, libraryFile ?? fileName);
      const units = { speed: effectiveSpeedUnit(activity), distance: effectiveDistanceUnit(activity) };
      // Foil de la session, sinon celui de l'activité : « Temps en vol » au lieu de « Temps actif ».
      const foil = sessionFoil(record, effectiveFoil(activity));
      setPrepared({
        segments: track && range ? coloredSegments(track.points, range) : [],
        props: {
          family,
          file: record && libraryFile !== null ? libraryFile : undefined,
          activityId: record?.activityId ?? activity.id,
          title: labels.title,
          subtitle: labels.subtitle,
          fileName: safeFileName(labels.baseName),
          // Appréciation et force du vent des notes, vent saisi de la fiche.
          stats: shareableStats(summaryShareStats(summary, sportTreatment(sport), units, hasActiveThreshold(getSportProfile(sport)), foil, {
            rating: record?.notes?.rating ?? null, windLevel: record?.notes?.windLevel ?? null, windDeg: record?.analysis?.windDeg ?? null,
          })),
        },
      });
    } catch (err) {
      if (request.current !== id) return;
      setError(t('Partage impossible : {reason}', { reason: plainError(err, t('erreur inconnue')) }));
    }
  };

  return (
    <>
      <MoreMenu label={t("Plus d'actions sur la session")}>
        <Button onClick={() => void open()}>
          <IconShare size={18} />
          {t("Partager l'image")}
        </Button>
      </MoreMenu>
      {error && <span role="status" style={{ fontSize: 'var(--text-s)', color: 'var(--danger)' }}>{error}</span>}
      {prepared && <ShareDialog {...prepared.props} segments={prepared.segments} onClose={() => setPrepared(null)} />}
    </>
  );
}

export default SavedSessionShare;
