import { useMemo, useState } from 'react';
import type { PathOptions } from 'leaflet';
import { Polygon, Polyline } from './map/paths';
import { useMap, useMapEvents } from './map/mapContext';
import { metersPerPixel } from '../core/displayConfig';
import type { PeakZone } from '../surfing/peakZone';
import { waveSenseMarks } from '../surfing/waveSenseMarks';

/** Couleurs de donnée en dur : encre noire, la même de jour et de nuit (la carte reste claire). Sans interaction. */
const LINE_STYLE: PathOptions = { color: '#000000', weight: 1.5, lineCap: 'round', interactive: false };
const SHAFT_STYLE: PathOptions = { color: '#000000', weight: 2, lineCap: 'butt', interactive: false };
const HEAD_STYLE: PathOptions = {
  color: '#000000', weight: 0, fillColor: '#000000', fillOpacity: 1, interactive: false,
};

const toPair = (p: { lat: number; lon: number }): [number, number] => [p.lat, p.lon];

/**
 * Sens des vagues sur la carte de l'analyse surf : une ligne de vague côté
 * large de la zone du pic et une flèche du centre de la zone vers la plage.
 * Longueurs fixes en pixels : converties en mètres d'après le zoom, recalculées
 * à la fin de chaque zoom, comme les flèches de la trace. Rien sans zone ou sans sens.
 */
function WaveSenseLayer({ zone, directionDeg }: { zone: PeakZone | null; directionDeg: number | null }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const lat = zone?.center.lat ?? 0;
  const marks = useMemo(
    () => (zone && directionDeg !== null ? waveSenseMarks(zone, directionDeg, metersPerPixel(zoom, lat)) : null),
    [zone, directionDeg, zoom, lat],
  );
  const positions = useMemo(
    () => (marks ? {
      line: marks.line.map(toPair),
      shaft: marks.shaft.map(toPair),
      head: marks.head.map(toPair),
    } : null),
    [marks],
  );
  if (!positions) return null;
  return (
    <>
      <Polyline positions={positions.line} pathOptions={LINE_STYLE} />
      <Polyline positions={positions.shaft} pathOptions={SHAFT_STYLE} />
      <Polygon positions={positions.head} pathOptions={HEAD_STYLE} />
    </>
  );
}

export default WaveSenseLayer;
