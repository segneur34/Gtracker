import { GARMIN_TRACKPOINT_NAMESPACE, escapeXmlAttr, gpxDocument } from '../core/xml';
import type { LocationFix } from '../platform/location';

/**
 * Écriture d'une session en GPX 1.1, le format pivot de l'application : ce
 * que l'enregistreur produit, `parseGpx` le relit sans rien de particulier, et
 * n'importe quelle autre application aussi.
 *
 * La vitesse du système va dans `gpxtpx:speed` (extension Garmin, en m/s), la
 * fréquence cardiaque de la ceinture dans `gpxtpx:hr`. La précision,
 * utile seulement en direct pendant l'enregistrement, n'est pas écrite :
 * elle alourdirait le fichier sans être relue par personne.
 *
 * Une pause, manuelle ou automatique, sépare la trace en segments continus :
 * chacun devient un `<trkseg>`.
 */

export interface GpxMeta {
  /** Nom de la trace, qui sert aussi à rattacher les notes de session. */
  name: string;
  /**
   * Calcul de la session, ou nom d'activité d'un autre appareil lu par `guessSport`, écrit dans `<type>` ; `null`
   * (journal sans en-tête lisible, FIT sans sport connu) : pas de `<type>`, session à classer.
   */
  sport: string | null;
}

const isoTime = (ms: number): string => new Date(ms).toISOString();

const trackPoint = (fix: LocationFix): string => {
  const children: string[] = [];
  if (fix.altitudeM !== undefined) children.push(`<ele>${fix.altitudeM}</ele>`);
  children.push(`<time>${isoTime(fix.timeMs)}</time>`);

  // Vitesse et cap du système (Doppler) ; le cap sert aux virages du surf (§10, point 97).
  const extension: string[] = [];
  // Ordre du schéma Garmin : la fréquence cardiaque, puis la vitesse.
  if (fix.heartRateBpm !== undefined) extension.push(`<gpxtpx:hr>${fix.heartRateBpm}</gpxtpx:hr>`);
  if (fix.speedMs !== undefined) extension.push(`<gpxtpx:speed>${fix.speedMs}</gpxtpx:speed>`);
  if (fix.bearingDeg !== undefined && fix.speedMs !== undefined && fix.speedMs > 0) {
    extension.push(`<gpxtpx:course>${fix.bearingDeg}</gpxtpx:course>`);
  }
  if (extension.length > 0) {
    children.push(`<extensions><gpxtpx:TrackPointExtension>${extension.join('')}</gpxtpx:TrackPointExtension></extensions>`);
  }

  return `      <trkpt lat="${fix.lat}" lon="${fix.lon}">${children.join('')}</trkpt>`;
};

const trackSegment = (fixes: LocationFix[]): string => ['    <trkseg>', ...fixes.map(trackPoint), '    </trkseg>'].join('\n');

/** `segments` : la trace, découpée en continus (`splitIntoSegments`) — un `<trkseg>` par pause. */
export const buildGpx = (segments: LocationFix[][], meta: GpxMeta): string => renderGpx(segments, meta, trackSegment);

const renderGpx = <F extends { timeMs: number }>(segments: F[][], meta: GpxMeta, segment: (fixes: F[]) => string): string => {
  const name = escapeXmlAttr(meta.name);
  const nonEmpty = segments.filter((s) => s.length > 0);
  const toRender = nonEmpty.length > 0 ? nonEmpty : [[]];
  const startTime = nonEmpty.length > 0 ? `<time>${isoTime(nonEmpty[0][0].timeMs)}</time>` : '';
  return gpxDocument(
    [
      `  <metadata><name>${name}</name>${startTime}</metadata>`,
      '  <trk>',
      `    <name>${name}</name>`,
      ...(meta.sport !== null ? [`    <type>${meta.sport}</type>`] : []),
      ...toRender.map(segment),
      '  </trk>',
    ],
    { gpxtpx: GARMIN_TRACKPOINT_NAMESPACE }
  );
};
