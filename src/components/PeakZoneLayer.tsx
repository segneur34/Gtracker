import { useMemo } from 'react';
import type { PathOptions } from 'leaflet';
import { Polygon } from './map/paths';
import { peakZoneOutline, type PeakZone } from '../surfing/peakZone';

/**
 * Style de la zone du pic (couleur de donnée, en dur) : contour noir de 2 px
 * en tirets, remplissage de la même couleur à 8 %. Le même de jour et de nuit
 * (la carte reste claire). Sans interaction : elle ne capte ni clic ni survol.
 */
const ZONE_STYLE: PathOptions = {
  color: '#000000', weight: 2, dashArray: '7 6', lineCap: 'butt',
  fillColor: '#000000', fillOpacity: 0.08, interactive: false,
};

/** Zone du pic dessinée sur la carte de l'analyse surf ; à poser avant la trace pour qu'elle reste dessous. */
function PeakZoneLayer({ zone }: { zone: PeakZone | null }) {
  const positions = useMemo(
    () => (zone ? peakZoneOutline(zone).map((p) => [p.lat, p.lon] as [number, number]) : null),
    [zone],
  );
  if (!positions) return null;
  return <Polygon positions={positions} pathOptions={ZONE_STYLE} />;
}

export default PeakZoneLayer;
