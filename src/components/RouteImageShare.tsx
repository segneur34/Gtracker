import { useMemo } from 'react';
import { activityDisplayName, activityFamily, isLostOnBackground, shadeForTheme, type Activity } from '../core/activities';
import { t } from '../core/i18n';
import type { SavedRoute } from '../hooks/routeFiles';
import { effectiveDistanceUnit } from '../hooks/useSportSettings';
import { recordToRoute } from '../planning/routeRecord';
import { routeImageDescription, routeShareContent, routeShareStats } from '../planning/routeShareImage';
import { routeActivity } from '../planning/routeShown';
import { safeFileName } from '../platform/files';
import { lightToken } from '../theme/lightToken';
import ShareDialog from './ShareDialog';
import type { TrackSegment } from './TrackSegmentsLayer';

/** Un itinéraire n'a pas de trace colorée : son parcours la remplace. */
const NO_SEGMENTS: TrackSegment[] = [];

interface RouteImageShareProps {
  /** Itinéraire rangé : l'image montre sa fiche, jamais un tracé en cours de modification. */
  saved: SavedRoute;
  activities: Activity[];
  onClose: () => void;
}

/**
 * « Partager l'image » d'un itinéraire, depuis son menu « … » dans Planifier
 * comme dans la liste des itinéraires : la fenêtre de partage d'une session
 * (`ShareDialog`), qui montre le parcours, chaque bord annoté de sa distance et
 * de son cap, et les trois chiffres du bloc Parcours, sans choix. Le liseré est
 * à la couleur de l'activité de l'itinéraire, à l'encre sans activité ou si
 * cette couleur se perd sur le blanc ; distances dans l'unité de l'activité ;
 * fond de carte de sa famille, celle de la voile sans activité. Le choix du
 * fond est retenu à part de celui des sessions de la même activité.
 */
function RouteImageShare({ saved, activities, onClose }: RouteImageShareProps) {
  const prepared = useMemo(() => {
    const activity = routeActivity(saved, activities);
    const unit = activity ? effectiveDistanceUnit(activity) : 'km';
    const route = recordToRoute(saved.record);
    const course = routeShareContent(route, unit);
    const stats = routeShareStats(route, unit);
    const title = saved.record.name;
    const subtitle = activity ? t('{activity} · itinéraire', { activity: activityDisplayName(activity) }) : t('Itinéraire');
    // Palette claire : l'image reste claire en thème sombre.
    const shade = activity ? shadeForTheme(activity.color, false) : null;
    const accent = shade !== null && !isLostOnBackground(shade, false) ? shade : lightToken('--ink', '#000000');
    return {
      family: activity ? activityFamily(activity) : ('voile' as const),
      activityId: `itineraire:${activity?.id ?? ''}`,
      title,
      subtitle,
      fileName: safeFileName(title),
      stats,
      course,
      accent,
      description: routeImageDescription(title, subtitle, course, stats),
    };
  }, [saved, activities]);

  return <ShareDialog {...prepared} segments={NO_SEGMENTS} fixedStats onClose={onClose} />;
}

export default RouteImageShare;
